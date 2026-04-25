# Project Memory & Context Anchor

## 🎯 Current Goal
Finalize standalone packaging with code obfuscation and deploy as a single portable .exe with no external dependencies. Field validation of v0.2.0 features.

## 🏗️ Technical Implementation (Active)
- **Frontend**: Next.js (React) + **MapLibre GL JS** (replacing Leaflet). Implements 2.5D rendering with 3D terrain support and a toggleable 2D/3D perspective.
- **Backend**: Python (`geotag.py`) processing engine using `pymavlink` for log parsing and `Pillow` for branded thumbnail generation.
- **Bridge**: Electron IPC handlers (`main.js`) managing the lifecycle of the processing engine and KML metadata extraction.
- **Standardization**: MSL (Mean Sea Level) altitude is the universal standard for all coordinates across processing, UI, and exports.
- **Branding**: Watermarked thumbnails, dynamic KML naming (based on folder suffix), and established Windows executable metadata.

## 📜 History of Implementation
1.  **Phase 1-11**: (See previous logs for foundation, core processing, diagnostic visualization, branding, MSL standardization, and telemetry v0.2.0).
12. **Phase 12: 2.5D Mapping Engine & Packaging**: Migrated from Leaflet to **MapLibre GL JS** to support terrain visualization. Integrated **MapTiler** for hybrid satellite/terrain data. Successfully packaged as a standalone portable .exe (**v0.2.0**) using `npm run dist:win`, including JS obfuscation and PyInstaller backend integration.

## ⚠️ Known Issues / Technical Debt
- **Build Efficiency**: The current development cycle requires full production rebuilds to verify certain metadata changes.
- **Resource Scope**: Absolute paths for branding assets (logo.png) are used.
- **Error Handling**: Missing logo assets or corrupted BIN logs currently trigger basic usage errors.
- **MapTiler Key**: The implementation requires a valid `MAPTILER_KEY` to be set in `MapUI.tsx` for production use.
