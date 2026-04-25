const { app, BrowserWindow, protocol, net, ipcMain, dialog, Menu } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { spawn, exec } = require('node:child_process')
const serve = require('electron-serve').default || require('electron-serve')

const loadURL = serve({ directory: 'out' })

const createWindow = async () => {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // Remove the top menu ribbon
  win.setMenuBarVisibility(false)
  Menu.setApplicationMenu(null)

  if (!app.isPackaged) {
    // Development: Load from local dev server
    win.loadURL('http://localhost:3000')
    win.webContents.openDevTools()
  } else {
    // Production: Load from 'out' directory
    await loadURL(win)
  }
}

app.whenReady().then(() => {
  protocol.handle('local-img', (request) => {
    const filePath = decodeURI(request.url.slice('local-img://'.length))
    return net.fetch('file://' + filePath)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers
ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory', 'multiSelections']
  })
  if (canceled) { return [] } 
  else { return filePaths }
})

ipcMain.handle('python:check', () => {
  return new Promise((resolve) => {
    exec('python --version', (err, stdout, stderr) => {
      if (err) resolve({ installed: false })
      else resolve({ installed: true, version: stdout.trim() || stderr.trim() })
    })
  })
})

ipcMain.handle('python:install', () => {
  return new Promise((resolve, reject) => {
    const psCommand = `Invoke-WebRequest -Uri "https://www.python.org/ftp/python/3.11.8/python-3.11.8-amd64.exe" -OutFile "$env:TEMP\\python_install.exe"; Start-Process -Wait -FilePath "$env:TEMP\\python_install.exe" -ArgumentList "/quiet", "InstallAllUsers=0", "PrependPath=1", "Include_test=0" -PassThru`
    exec(`powershell -Command "${psCommand}"`, (err, stdout, stderr) => {
      if (err) {
        reject(err.message)
      } else {
        resolve("Python successfully installed. Refresh environment to take effect.")
      }
    })
  })
})

const processMap = new Map()

/**
 * Resolves the geotag backend binary or script.
 * Returns { kind: 'exe', exePath } for production builds (PyInstaller .exe)
 * Returns { kind: 'py', scriptPath } for development (Python script).
 *
 * In electron-builder production builds:
 *   process.resourcesPath = <installDir>/resources
 *   extraResources with to:"backend" lands at:
 *     <installDir>/resources/backend/geotag.exe
 *
 * In development (npm run electron):
 *   app.isPackaged === false
 *   src/backend/geotag.py is at project root relative path
 */
function getGeotagBackend() {
  if (app.isPackaged) {
    const exePath = path.join(process.resourcesPath, 'backend', 'geotag.exe')
    return { kind: 'exe', exePath }
  }
  // Development: try app path first, then resourcesPath fallback
  let scriptPath = path.join(app.getAppPath(), 'src', 'backend', 'geotag.py')
  if (!fs.existsSync(scriptPath)) {
    scriptPath = path.join(process.resourcesPath, 'app', 'src', 'backend', 'geotag.py')
  }
  return { kind: 'py', scriptPath }
}

ipcMain.handle('geotag:run', (event, { imageDir, alt, auto, useMp }) => {
  return new Promise((resolve, reject) => {
    const backend = getGeotagBackend()

    if (backend.kind === 'exe') {
      // Production: use compiled Python executable from PyInstaller
      const args = ['--image-dir', imageDir]
      if (alt)   args.push('--alt-threshold', String(alt))
      if (auto)  args.push('--auto-write')
      if (useMp) args.push('--mp')

      const proc = spawn(backend.exePath, args, { cwd: imageDir })

      proc.on('error', (err) => {
        event.sender.send('geotag:stderr', `Process error: ${err.message}`)
        resolve(1)
      })
      proc.stdout.on('data', (data) => {
        processMap.set(event.sender.id, proc)
        event.sender.send('geotag:stdout', data.toString())
      })
      proc.stderr.on('data', (data) => {
        event.sender.send('geotag:stderr', data.toString())
      })
      proc.on('close', (code) => {
        processMap.delete(event.sender.id)
        resolve(code)
      })

    } else {
      // Development: use Python script with Python launchers
      const pythonCmds = process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python'];
      const args = ['-u', backend.scriptPath, '--image-dir', imageDir]  // -u = unbuffered so stdout flushes properly
      if (alt) args.push('--alt-threshold', String(alt))
      if (auto) args.push('--auto-write')
      if (useMp) args.push('--mp')

      function trySpawn(cmds) {
        if (cmds.length === 0) {
          event.sender.send('geotag:stderr', 'Python not found. Please install Python and ensure it is in your PATH.');
          resolve(1);
          return;
        }
        const cmd = cmds[0];
        const py = spawn(cmd, args, { cwd: imageDir })
        let launched = false;

        py.on('error', (err) => {
          if (!launched && err.code === 'ENOENT') {
            // Try the next command
            trySpawn(cmds.slice(1));
          } else {
            event.sender.send('geotag:stderr', `Process error: ${err.message}`);
            resolve(1);
          }
        });

        py.stdout.on('data', (data) => {
          launched = true;
          processMap.set(event.sender.id, py);
          event.sender.send('geotag:stdout', data.toString())
        })

        py.stderr.on('data', (data) => {
          launched = true;
          event.sender.send('geotag:stderr', data.toString())
        })

        py.on('close', (code) => {
          processMap.delete(event.sender.id)
          resolve(code)
        })
      }

      trySpawn(pythonCmds);
    }
  })
})

ipcMain.handle('geotag:finalize', (event, { imageDir, useMp }) => {
  return new Promise((resolve, reject) => {
    const backend = getGeotagBackend()

    if (backend.kind === 'exe') {
      // Production: use compiled Python executable from PyInstaller
      const args = ['--image-dir', imageDir, '--exif-only']
      if (useMp) args.push('--mp')

      const proc = spawn(backend.exePath, args, { cwd: imageDir })

      proc.on('error', (err) => {
        event.sender.send('geotag:stderr', `Process error: ${err.message}`)
        resolve(1)
      })
      proc.stdout.on('data', (data) => {
        processMap.set(event.sender.id, proc)
        event.sender.send('geotag:stdout', data.toString())
      })
      proc.stderr.on('data', (data) => {
        event.sender.send('geotag:stderr', data.toString())
      })
      proc.on('close', (code) => {
        processMap.delete(event.sender.id)
        resolve(code)
      })

    } else {
      // Development: use Python script with Python launchers
      const pythonCmds = process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python'];
      const args = ['-u', backend.scriptPath, '--image-dir', imageDir, '--exif-only']
      if (useMp) args.push('--mp')

      function trySpawn(cmds) {
        if (cmds.length === 0) {
          event.sender.send('geotag:stderr', 'Python not found.');
          resolve(1);
          return;
        }
        const cmd = cmds[0];
        const py = spawn(cmd, args, { cwd: imageDir })

        py.on('error', (err) => {
          if (err.code === 'ENOENT') trySpawn(cmds.slice(1));
          else {
            event.sender.send('geotag:stderr', `Process error: ${err.message}`);
            resolve(1);
          }
        });

        py.stdout.on('data', (data) => {
          processMap.set(event.sender.id, py);
          event.sender.send('geotag:stdout', data.toString())
        })

        py.stderr.on('data', (data) => {
          event.sender.send('geotag:stderr', data.toString())
        })

        py.on('close', (code) => {
          processMap.delete(event.sender.id)
          resolve(code)
        })
      }
      trySpawn(pythonCmds);
    }
  })
})

ipcMain.handle('geotag:stop', (event) => {
    const py = processMap.get(event.sender.id)
    if (py) {
        py.kill()
        processMap.delete(event.sender.id)
        return true
    }
    return false
})

ipcMain.handle('fs:check-kml-exists', async (event, dirPath) => {
    try {
        const kmlPath = path.join(dirPath, 'geotags.kml')
        return fs.existsSync(kmlPath)
    } catch (e) {
        return false
    }
})

ipcMain.handle('fs:read-geodata', async (event, dirPath) => {
    try {
        const kmlPath = path.join(dirPath, 'geotags.kml')
        if (fs.existsSync(kmlPath)) {
            const content = fs.readFileSync(kmlPath, 'utf8')
            const result = {
                geoData: [],
                triggerData: [],
                imgCount: undefined,
                trigCount: undefined
            }

            const metadataMatch = /<!-- \[METADATA\] photos:(\d+), triggers:(\d+) -->/.exec(content)
            result.imgCount = metadataMatch ? parseInt(metadataMatch[1]) : undefined
            result.trigCount = metadataMatch ? parseInt(metadataMatch[2]) : undefined

            // Parse Folders if they exist
            const folderRegex = /<Folder>([\s\S]*?)<\/Folder>/g
            let folderMatch
            let hasFolders = false
            
            while ((folderMatch = folderRegex.exec(content)) !== null) {
                hasFolders = true
                const folderBlock = folderMatch[1]
                const folderNameMatch = /<name>(.*?)<\/name>/.exec(folderBlock)
                const folderName = folderNameMatch ? folderNameMatch[1] : ''
                
                const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g
                let pmMatch
                while ((pmMatch = placemarkRegex.exec(folderBlock)) !== null) {
                    const block = pmMatch[1]
                    const coordMatch = /<coordinates>(.*?)<\/coordinates>/.exec(block)
                    if (coordMatch) {
                        const coords = coordMatch[1].split(',')
                        const lng = parseFloat(coords[0])
                        const lat = parseFloat(coords[1])
                        const alt = coords[2] ? parseFloat(coords[2]) : 0
                        
                        const nameMatch = /<name>(.*?)<\/name>/.exec(block)
                        const filename = nameMatch ? nameMatch[1] : ''

                        if (folderName === 'Log Triggers') {
                            result.triggerData.push({ lat, lon: lng, alt })
                        } else {
                            // Photos: Use thumbnail from description, filename from name tag
                            const thumbMatch = /<img src="(.*?)"/.exec(block)
                            const thumbnail = thumbMatch ? thumbMatch[1] : ''
                            
                            result.geoData.push({ lat, lon: lng, alt, photo_file: filename, thumbnail })
                        }
                    }
                }
            }

            // Fallback for flat KMLs (old versions)
            if (!hasFolders) {
                const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g
                let match
                while ((match = placemarkRegex.exec(content)) !== null) {
                    const block = match[1]
                    const coordMatch = /<coordinates>(.*?)<\/coordinates>/.exec(block)
                    if (coordMatch) {
                        const coords = coordMatch[1].split(',')
                        const lng = parseFloat(coords[0])
                        const lat = parseFloat(coords[1])
                        const alt = coords[2] ? parseFloat(coords[2]) : 0
                        
                        const nameMatch = /<name>(.*?)<\/name>/.exec(block)
                        const filename = nameMatch ? nameMatch[1] : ''
                        const thumbMatch = /<img src="(.*?)"/.exec(block)
                        const thumbnail = thumbMatch ? thumbMatch[1] : ''
                        result.geoData.push({ lat, lon: lng, alt, photo_file: filename, thumbnail })
                    }
                }
            }
            
            return result
        }
        return null
    } catch (e) {
        return null
    }
})
