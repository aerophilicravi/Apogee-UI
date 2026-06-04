# Apogee GeoTag Suite

**Professional MAVLink GPS Synchronization & 2.5D Mapping for Aerial Imaging**

A high-performance desktop application that seamlessly aligns drone photos with GPS/altitude data from MAVLink flight logs, featuring a professional-grade 2.5D mapping engine for mission verification.

![Version](https://img.shields.io/badge/version-0.2.2-emerald) ![Author](https://img.shields.io/badge/author-Ravi%20Singh.-blue) ![License](https://img.shields.io/badge/license-MIT-red)

---

## 🎯 Overview

Apogee automates the critical workflow of geotagging aerial survey images with precise GPS coordinates and altitude data. Version 0.2.x introduces a state-of-the-art mapping engine for superior mission visualization.

- **Photogrammetry Projects** - Generate accurate orthomosaics and 3D models.
- **2.5D Terrain Verification** - Visualize flight paths over real-world elevation data.
- **Surveying & Mapping** - Precise geolocation for technical GIS surveys.
- **Environmental Monitoring** - Track change over time with GPS-locked imagery.

### Key Capabilities

✅ **Advanced 2.5D Mapping Engine**
- Powered by **MapLibre GL JS** for hardware-accelerated rendering.
- Real-world 3D terrain visualization via MapTiler RGB-DEM.
- Interactive 2D/3D toggle with smooth camera transitions.

✅ **Professional Mission Dashboard**
- Consolidated mission telemetry (Photo Pins, Source Images, MAVLink Triggers).
- High-fidelity thumbnail previews and metadata inspection.
- Visual mismatch detection for quality assurance.

✅ **Two-Step Processing Pipeline**
- **Step 1: Alignment** - Parse MAVLink logs and align with images using altitude thresholds.
- **Step 2: Injection** - Inject GPS/altitude EXIF metadata directly into image files.

✅ **Enterprise Security & Obfuscation**
- Build-time obfuscation for core application logic (Main/Preload).
- Bundled standalone Python backend for zero-dependency deployment.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+**
- **Python 3.8+** (Auto-installer included)

### Development (Live Reload)
To iterate quickly on the UI with Hot Module Replacement:
```bash
npm run dev:all
```
This launches both the Next.js dev server and the Electron window simultaneously.

### Production Build
```bash
# Generate the obfuscated portable executable
npm run dist:win
```
Output: `dist_latest/Apogee 0.2.2.exe`

---

## 🔧 Configuration

### MapTiler Integration
Apogee uses MapTiler for high-resolution satellite imagery and 3D terrain.
- You can provide your own API key in the **Map Settings** menu within the app.
- Settings are persisted locally on your machine.

---

## 🏗️ Project Architecture

### Frontend
- **Framework**: Next.js 16.2 + React 19.2
- **Engine**: MapLibre GL JS (Migrated from Leaflet)
- **Styling**: Tailwind CSS 4
- **Components**: Lucide React + Glassmorphic UI Design

### Backend (Python)
- **Log Parsing**: `pymavlink`
- **Metadata**: `piexif`
- **Image Processing**: `Pillow`

---

## 📜 Changelog

### [v0.2.2] - 2026-04-25
- **Fix**: Added `closeOnClick` and global map listeners to auto-dismiss photo popups.
- **Polishing**: Refined 2D/3D toggle label alignment and visual centering.

### [v0.2.1] - 2026-04-24
- **UI**: Implemented tactile pill-shaped 2D/3D toggle switch.
- **Cleanup**: Removed all legacy Leaflet and React-Leaflet dependencies.
- **Security**: Hardened the obfuscation pipeline for production builds.

### [v0.2.0] - 2026-04-24
- **Engine**: Major migration to **MapLibre GL JS**.
- **Features**: Added **3D Terrain** support and dynamic pitch controls.
- **Settings**: Integrated MapTiler API key management and local persistence.
- **Workflow**: Added `dev:all` for faster live-reload development.

### [v0.1.0] - 2026-04-08
- Initial release with MAVLink parsing and basic Leaflet 2D mapping.

---

*Built with ❤️ for professional aerial surveying*
