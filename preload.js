const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  checkPython: () => ipcRenderer.invoke('python:check'),
  installPython: () => ipcRenderer.invoke('python:install'),
  runGeotag: (options) => ipcRenderer.invoke('geotag:run', options),
  finalizeGeotag: (options) => ipcRenderer.invoke('geotag:finalize', options),
  stopGeotag: () => ipcRenderer.invoke('geotag:stop'),
  readGeodata: (dirPath) => ipcRenderer.invoke('fs:read-geodata', dirPath),
  checkKmlExists: (dirPath) => ipcRenderer.invoke('fs:check-kml-exists', dirPath),
  onLogStdOut: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on('geotag:stdout', listener);
      return () => ipcRenderer.removeListener('geotag:stdout', listener);
  },
  onLogStdErr: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on('geotag:stderr', listener);
      return () => ipcRenderer.removeListener('geotag:stderr', listener);
  }
})
