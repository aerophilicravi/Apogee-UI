@echo off
REM scripts/build-pyinstaller.bat
REM Compiles geotag.py into a standalone Windows .exe using PyInstaller.
REM Output: dist_pyinstaller/geotag.exe
REM
REM Hidden imports needed:
REM   - piexif: not auto-detected (lazy import in geotag.py)
REM   - pymavlink: not auto-detected (lazy import in geotag.py)
REM   - PIL / Pillow: not auto-detected (lazy import)
REM   - concurrent.futures, multiprocessing: standard lib, but must be explicit
REM     due to ProcessPoolExecutor usage in PyInstaller --onefile mode

set SCRIPT_DIR=%~dp0
set PROJECT_DIR=%SCRIPT_DIR%..
set SRC=%PROJECT_DIR%\src\backend\geotag.py
set OUT=%PROJECT_DIR%\dist_pyinstaller
set WORK=%PROJECT_DIR%\dist_pyinstaller\_build_work
set PYINSTALLER=%APPDATA%\Python\Python314\Scripts\pyinstaller.exe

%PYINSTALLER% ^
  --onefile ^
  --name geotag ^
  --distpath "%OUT%" ^
  --workpath "%WORK%" ^
  --specpath "%WORK%" ^
  --hidden-import piexif ^
  --hidden-import pymavlink ^
  --hidden-import pymavlink.mavutil ^
  --hidden-import pymavlink.dialects ^
  --hidden-import pymavlink.dialects.v20 ^
  --hidden-import pymavlink.dialects.v20.ardupilotmega ^
  --hidden-import PIL ^
  --hidden-import PIL.Image ^
  --hidden-import concurrent.futures ^
  --hidden-import multiprocessing ^
  --hidden-import multiprocessing.pool ^
  --hidden-import multiprocessing.managers ^
  --collect-all pymavlink ^
  --collect-all piexif ^
  --collect-all PIL ^
  --add-data "%PROJECT_DIR%\public\logo.png;." ^
  --noconfirm ^
  --log-level WARN ^
  "%SRC%"

if %ERRORLEVEL% NEQ 0 (
  echo [pyinstaller] FAILED with exit code %ERRORLEVEL%
  exit /b %ERRORLEVEL%
)

echo [pyinstaller] Success: %OUT%\geotag.exe
