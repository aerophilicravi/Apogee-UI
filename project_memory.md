# Project Memory & Context Anchor

## 🎯 Current Goal
Complete environmental setup by fixing GitHub MCP configuration and then finalize production deployment of the **Indrones GeoTag Suite**. Ensure all branding and MSL standardization is verified.

## 🏗️ Technical Implementation (Active)
- **Frontend**: Next.js (React) + Leaflet for high-performance mapping. Dual-layer rendering of blue photo pins and purple trigger dots.
- **Backend**: Python (`geotag.py`) processing engine using `pymavlink` for log parsing and `Pillow` for branded thumbnail generation.
- **Bridge**: Electron IPC handlers (`main.js`) managing the lifecycle of the processing engine and KML metadata extraction.
- **Standardization**: MSL (Mean Sea Level) altitude is the universal standard for all coordinates across processing, UI, and exports.
- **Branding**: Watermarked thumbnails, dynamic KML naming (based on folder suffix), and established Windows executable metadata.

## 📜 History of Implementation
1.  **Phase 1: Foundation**: Established the Electron/Next.js boilerplate and local processing pipeline.
2.  **Phase 2: Core Processing**: Built the `geotag.py` engine for syncing drone logs (MAVLink BIN files) with image timestamps.
3.  **Phase 3: Diagnostic Visualization**: Implemented the dual-layer map to show both raw trigger locations and final geotagged results for mission QA.
4.  **Phase 4: Indrones Branding**: Integrated corporate logo, watermarks, and high-contrast survey-style UI.
5.  **Phase 5: MSL Standardization**: Transitioned all altitude measurements to MSL for professional grade accuracy.
6.  **Phase 6: Refinement**: Optimized map auto-zoom, dynamic KML naming (e.g. "Indrones - 0405"), and resolved startup errors.
7.  **Phase 7: Infrastructure Fix**: Resolved "Docker not found" error for GitHub MCP server by migrating configuration to Node.js/npx.cmd.

## ⚠️ Known Issues / Technical Debt
- **Build Efficiency**: The current development cycle requires full production rebuilds to verify certain metadata changes (like Windows Company Properties).
- **Resource Scope**: Absolute paths for branding assets (logo.png) are used; transitioning to a unified resource manager would improve portability.
- **Error Handling**: Missing logo assets or corrupted BIN logs currently trigger basic usage errors; could be improved with high-level visual alerts.
