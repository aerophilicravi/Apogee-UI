# Project Memory & Context Anchor

## 🎯 Current Goal
Field validation and distribution of the portable v0.2.2 executable. Collect feedback on MSL alignment and 2.5D map performance.

## 🏗️ Technical Implementation (Active)
- **Frontend**: Next.js (React) + **MapLibre GL JS**. Implements 2.5D rendering with 3D terrain support.
- **Backend**: Python (`geotag.py`) processing engine using `pymavlink` and `Pillow`.
- **Bridge**: Electron IPC handlers (`main.js`) with **JS obfuscation** for intellectual property protection.
- **Packaging**: **Portable .exe** (Win64) bundling all dependencies including the Python runtime.

## 📜 History of Implementation
1.  **Phase 1-12**: (See previous logs for foundation, core processing, diagnostic visualization, branding, MSL standardization, and v0.2.0 packaging).
13. **Phase 13: v0.2.2 Production Build**: Completed full production pipeline: Next.js static export, Electron script obfuscation, Python backend compilation (PyInstaller), and final packaging via `electron-builder`. Result: `Apogee 0.2.2.exe`.

## ⚠️ Known Issues / Technical Debt
- **Thumbnail Projection**: Brainstormed ground projection feature (Roll/Pitch/Yaw based) was deferred in favor of a production build release.
- **MapTiler Key**: The implementation requires a valid `MAPTILER_KEY` to be set in `MapUI.tsx` for production use.
- **Error Handling**: Missing logo assets or corrupted BIN logs currently trigger basic usage errors.
