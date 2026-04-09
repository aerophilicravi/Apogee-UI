# Apogee GeoTag Suite

**Professional MAVLink GPS Synchronization for Aerial Imaging**

A desktop application that seamlessly aligns drone photos with GPS/altitude data from MAVLink flight logs, automatically injecting precise geolocation metadata into images for professional photogrammetry and survey workflows.

![Version](https://img.shields.io/badge/version-0.1.0-blue) ![Author](https://img.shields.io/badge/author-Indrones%20Solutions%20Pvt.%20Ltd.-blue) ![License](https://img.shields.io/badge/license-Private-red)

---

## 🎯 Overview

Apogee automates the critical workflow of geotagging aerial survey images with precise GPS coordinates and altitude data extracted from MAVLink drone logs. Perfect for:

- **Photogrammetry Projects** - Generate accurate orthomosaics and 3D models
- **Surveying & Mapping** - Precise geolocation for technical surveys
- **Environmental Monitoring** - Track change over time with GPS-locked imagery
- **Insurance & Inspection** - Document property with certified coordinates
- **Research Applications** - Scientific image collection with verified locations

### Key Capabilities

✅ **Two-Step Processing Pipeline**
- **Step 1**: Parse MAVLink logs and align with flight images using altitude thresholds
- **Step 2**: Inject GPS/altitude EXIF metadata directly into image files

✅ **Multi-Flight Management**
- Process multiple flights in a single session
- Independent status tracking for each flight
- Batch operations for efficiency

✅ **Real-Time Visualization**
- Interactive map with photo pins and trigger points
- Thumbnail previews from image popups
- Altitude and coordinate inspection
- Visual mismatch detection (photos vs. triggers)

✅ **Flexible Configuration**
- Configurable airborne altitude threshold (default: 40m)
- Auto-write option to skip manual review and write EXIF in one step
- Multiprocessing support for batch optimization

✅ **Robust Backend**
- Auto-installation of Python dependencies (`piexif`, `pymavlink`, `Pillow`)
- Cross-platform Python launcher detection (Windows: `py` → `python3` → `python`)
- Real-time console logging with color-coded output
- Process control (stop/cancel at any time)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** (for Next.js and frontend dependencies)
- **Python 3.8+** (for geotag backend; auto-installer available)
- **Windows 11** (currently tested on Windows 11 Home)

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Python Setup:**
   - The app includes an auto-installer for Python 3.11 if not detected
   - Required packages (`piexif`, `pymavlink`, `Pillow`) are auto-installed on first run

### Development

**Run the development server:**
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Desktop Application (Electron)

**Build and launch as a native desktop app:**
```bash
npm run electron-build
```

This creates a portable `.exe` in the `dist/` directory.

**For development (live reload):**
```bash
npm run electron
```

---

## 📖 Usage Guide

### Basic Workflow

#### Step 1: Import Flight Data
1. Click **"Import Flight Folder"** for each flight
2. Select a directory containing:
   - Aerial images (`.jpg`, `.png`, etc.)
   - MAVLink log file (`.bin`, `.tlog`) in the same directory or parent
3. The app detects existing `geotags.kml` and adjusts status accordingly

#### Step 2: Configure Processing
- **Airborne Altitude Threshold (m)**: Only images taken above this altitude are geotagged (default: 40m)
  - *Why?* Filters out ground images and test shots
- **Auto-write EXIF**: Enable to inject coordinates in Step 1 (skips manual review)

#### Step 3: Run Step 1 - Alignment
- Click **"Step 1: Alignment"**
- The app:
  1. Parses the MAVLink log
  2. Extracts GPS/altitude waypoints above the threshold
  3. Generates `geotags.kml` with photo pins and trigger markers
  4. Creates thumbnails for map preview
  5. Updates the map in real-time

**Status Changes:**
- 🔴 `Idle` → 🟡 `Processed` (KML generated, ready for EXIF injection)
- Or 🟢 `Finalized` (if "Auto-write EXIF" was enabled)

#### Step 4: Review on Map
- Inspect photo locations and altitudes
- Check alignment with trigger points
- Look for mismatches (⚠️ if image count ≠ trigger count)

#### Step 5: Run Step 2 - Finalize EXIF (if needed)
- If you skipped auto-write, click **"Tag Current Flight"** or **"Batch Tag All"**
- The app writes GPS coordinates directly into image EXIF data
- Status changes to 🟢 `Finalized`

**Important:** Once finalized, images are modified. Backup originals before processing.

### Console Output

The system console at the bottom displays:
- `[SYSTEM]` - App state changes (cyan)
- `[PROCESS]` - Workflow progress (fuchsia)
- `[ERR]` - Errors and warnings (amber)
- Standard output from Python backend

---

## 🏗️ Project Architecture

### Frontend (Next.js + React)
```
src/
├── app/
│   ├── layout.tsx          # Root layout with font optimization
│   └── page.tsx            # Main application component
└── components/
    └── MapUI.tsx           # Interactive Leaflet map with markers
```

**Key Technologies:**
- **Next.js 16.2** - React framework with SSR/SSG support
- **React 19.2** - UI library
- **Tailwind CSS 4** - Utility-first styling
- **Leaflet + react-leaflet** - Interactive maps with Esri imagery
- **Lucide React** - Icon library

### Backend (Python)
```
backend/
└── Apogee-main/
    └── geotag.py           # Core processing script
```

**Responsibilities:**
- Parse MAVLink log files (`.bin`, `.tlog`)
- Match flight images with GPS waypoints using timestamp alignment
- Filter by altitude threshold
- Generate KML files with placemarks and folders
- Create image thumbnails (`local-img://` protocol)
- Inject EXIF GPS/altitude metadata using piexif

**Dependencies:**
- `pymavlink` - MAVLink log parsing
- `piexif` - EXIF metadata manipulation
- `Pillow` - Image thumbnail generation

### Desktop (Electron)
```
main.js                     # Electron main process
preload.js                  # Secure IPC bridge
```

**IPC Handlers:**
- `dialog:openDirectory` - File picker for flight folders
- `python:check` / `python:install` - Python environment setup
- `geotag:run` - Start Step 1 processing with progress streaming
- `geotag:finalize` - Start Step 2 EXIF injection
- `geotag:stop` - Gracefully terminate running processes
- `fs:check-kml-exists` - Verify KML file presence
- `fs:read-geodata` - Parse KML for map display

---

## 🔧 Configuration

### Environment Variables
Create a `.env.local` file if needed (not currently required):
```bash
# Example - add as needed
NEXT_PUBLIC_APP_NAME=Apogee GeoTag
```

### Build Configuration (Electron)

Edit `package.json` build section:
```json
{
  "build": {
    "appId": "com.apogee.app",
    "productName": "Apogee",
    "directories": { "output": "dist" },
    "files": ["main.js", "preload.js", "out/**/*"],
    "win": { "target": "portable" }
  }
}
```

---

## 🔐 Security Considerations

### Secure IPC
- **Context Isolation**: Enabled (`contextIsolation: true`)
- **Node Integration**: Disabled (`nodeIntegration: false`)
- **Preload Bridge**: Controlled API exposure via `preload.js`

### File System Access
- File operations isolated to selected flight directories
- KML parsing uses regex-based extraction (robust against malformed XML)
- Thumbnail generation uses safe image dimension limits

### Python Execution
- Subprocess spawning with explicit argument arrays (no shell injection)
- Python launcher fallback chain for cross-platform compatibility
- Process management with timeout and cleanup

---

## 📝 Script Reference

### npm Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start Next.js dev server (localhost:3000) |
| `npm run build` | Build Next.js for production (`out/` directory) |
| `npm run start` | Serve built application |
| `npm run lint` | Run ESLint on codebase |
| `npm run electron` | Launch Electron app in dev mode |
| `npm run electron-build` | Build and package as portable `.exe` |

### Python Backend Arguments

`geotag.py` accepts:
```bash
python geotag.py --image-dir <path> [options]

Options:
  --alt-threshold <float>    Airborne altitude threshold in meters (default: 40)
  --auto-write               Write EXIF in Step 1 (skips Step 2)
  --mp                       Enable multiprocessing for batch optimization
  --exif-only                Step 2 mode: inject EXIF only (used by geotag:finalize)
```

---

## 🗂️ Output Files

After processing, each flight folder contains:

| File | Purpose |
|------|---------|
| `geotags.kml` | Geographic markup with photo pins and altitude data |
| `*.jpg` (modified) | Original images with injected EXIF GPS metadata |
| Thumbnails | Auto-generated preview images (generated in Step 1) |

**KML Structure:**
```xml
<!-- [METADATA] photos:150, triggers:148 -->
<Folder>
  <name>Photos</name>
  <!-- Placemarks with photo coordinates, altitude, thumbnails -->
</Folder>
<Folder>
  <name>Log Triggers</name>
  <!-- Waypoints from MAVLink log (for mismatch detection) -->
</Folder>
```

---

## 🐛 Troubleshooting

### Python Not Found
- **Symptom**: "Python not found. Please install Python..."
- **Fix**: Install Python 3.8+ from [python.org](https://python.org), or use the in-app installer

### Missing Packages
- **Symptom**: "ModuleNotFoundError: No module named 'piexif'"
- **Fix**: The app auto-installs on first run. If it fails, manually run:
  ```bash
  pip install piexif pymavlink Pillow
  ```

### No Coordinates on Map
- **Causes**:
  1. Images taken below the altitude threshold → increase threshold or disable it
  2. MAVLink log not in flight directory → place `.bin` or `.tlog` file in folder
  3. Timestamp mismatch → ensure image EXIF timestamps match flight log times
- **Fix**: Check console for parsing errors; adjust threshold and retry

### Image Count ≠ Trigger Count
- **Normal if**: You deleted ground images before import (intended behavior)
- **Problem if**: Significant mismatch → indicates timestamp misalignment
- **Action**: Review MAVLink log and image timestamps; may need to adjust threshold

### EXIF Injection Fails
- **Causes**: Read-only file attributes, incompatible image format, corrupted EXIF
- **Fix**: Ensure images are writable and in standard formats (JPEG recommended)

### Electron Build Issues
- **Symptom**: `electron-builder` errors during packaging
- **Fix**: Clear cache and rebuild:
  ```bash
  rm -rf out dist node_modules/.cache
  npm install && npm run electron-build
  ```

---

## 📊 Performance Notes

### Optimization Tips
- **Enable Multiprocessing**: Use `--mp` flag for 500+ images
- **Batch Operations**: Process multiple flights with "Batch Tag All" when available
- **Altitude Threshold**: Adjust threshold to reduce processing (higher = fewer images)

### Known Limitations
- Map rendering may lag with 1000+ pins (Leaflet limitation)
- Thumbnail generation adds 10-30% overhead; use for quality assurance only
- Batch mode optimized for SSDs; HDD throughput may vary

---

## 🔄 Development Workflow

### Adding Features

1. **Frontend Changes**: Edit `src/app/page.tsx` or components
2. **IPC Handlers**: Modify `main.js` for new electron features
3. **Backend Logic**: Update `backend/Apogee-main/geotag.py`
4. **Testing**: Run `npm run dev` and reload browser/Electron app

### Building for Distribution

```bash
# Ensure production build is current
npm run build

# Package as portable Windows executable
npm run electron-build

# Output: dist/Apogee-0.1.0.exe
```

### Debugging

- **Frontend**: DevTools available in Electron (Ctrl+Shift+I)
- **Python**: Add `print()` statements; output streams to console
- **IPC**: Check browser DevTools console for IPC errors

---

## 📦 Dependencies

### Production
- **electron-serve** ^3.0.1 - Static file serving for Electron
- **leaflet** ^1.9.4 - Map library
- **lucide-react** ^1.7.0 - Icon library
- **next** ^16.2.2 - React framework
- **react** ^19.2.4 - UI library
- **react-dom** ^19.2.4 - React DOM binding
- **react-leaflet** ^5.0.0 - React Leaflet integration

### Development
- **@tailwindcss/postcss** ^4 - Utility CSS framework
- **@types/** - TypeScript type definitions
- **electron** ^41.1.1 - Desktop framework
- **electron-builder** ^26.8.1 - Packaging tool
- **typescript** ^5 - Language superset
- **eslint** ^9 - Code linting

---

## 📄 License

**Private Software** - Developed by Indrones Solutions Pvt. Ltd.

All rights reserved. This software is proprietary and confidential.

---

## 👥 Support & Contact

For issues, feature requests, or support:
- **Author**: Indrones Solutions Pvt. Ltd.
- **Version**: 0.1.0
- **Last Updated**: April 8, 2026

---

## 🎨 UI Design Notes

### Color Scheme
- **Primary**: Fuchsia/Violet gradients (action buttons)
- **Success**: Emerald (finalized flights)
- **Warning**: Amber (processed, awaiting finalization)
- **Error**: Rose (failed flights)
- **Neutral**: Slate grays (backgrounds and text)

### Component Hierarchy
```
Home (Main Container)
├── Left Panel (Control & Settings)
│   ├── Logo & Branding
│   ├── Data Management (Flight Tabs)
│   ├── Configuration (Altitude, Auto-write)
│   └── Execution Pipeline (Step 1 & 2 Buttons)
└── Right Panel (Map & Console)
    ├── MapUI (Leaflet Container)
    │   └── Markers, Triggers, Polylines
    └── System Console (Log Output)
```

---

## ✨ Key Innovations

1. **Seamless IPC Integration**: Real-time progress streaming from Python to React UI
2. **Dual-Mode Processing**: Step 1 for preview (KML generation) and Step 2 for finalization (EXIF injection)
3. **Auto-Dependency Management**: Transparent package installation without user friction
4. **Multi-Flight Orchestration**: Process multiple surveys simultaneously with independent status tracking
5. **MAVLink Expertise**: Robust parsing of drone flight logs with altitude-based filtering

---

*Built with ❤️ for professional aerial surveying*
