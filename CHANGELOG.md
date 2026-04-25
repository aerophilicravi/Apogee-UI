# Changelog

All notable changes to the Apogee GeoTag Suite will be documented in this file.

## [v0.2.2] - 2026-04-25

### Fixed
- Map interaction: Added `closeOnClick` and global map click listeners to ensure photo popups dismiss when clicking the map background.
- UI: Fine-tuned the 2D/3D toggle label alignment for perfect visual centering.

## [v0.2.1] - 2026-04-24

### Changed
- Reverted to map-centric floating UI design (removed top ribbon).
- Redesigned 2D/3D toggle into a tactile pill-shaped sliding switch.

### Removed
- Legacy Leaflet and React-Leaflet dependencies (fully standardized on MapLibre).

## [v0.2.0] - 2026-04-24

### Added
- **MapLibre GL JS Engine**: Hardware-accelerated mapping with superior performance.
- **2.5D/3D Terrain**: Integrated MapTiler RGB-DEM for real-world elevation visualization.
- **Dynamic Controls**: Pitch and bearing support for 3D navigation.
- **API Management**: Dedicated settings menu for MapTiler keys with `localStorage` persistence.
- **Developer Experience**: Added `dev:all` command for live-reload Electron development.

## [v0.1.0] - 2026-04-08

### Initial Release
- MAVLink log parsing and image timestamp alignment.
- EXIF GPS/Altitude injection.
- Basic 2D map visualization with Leaflet.
- Portable Windows executable packaging.
