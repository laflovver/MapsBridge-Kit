# Changelog

All notable changes to MapsBridge Kit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.3.0] - 2024-12-XX

### Added
- **Dual format support**: Switch between CLI and URL coordinate formats
  - **CLI Format**: `--lon X --lat Y --zoom Z --bearing B --pitch P`
  - **URL Format**: `#zoom/lat/lon/bearing/pitch`
- **Format toggle button**: Click the format header to switch between CLI and URL formats
- **Format persistence**: Your preferred format is automatically saved and restored between sessions
- **Hotkey for format switching**: Press **R** to quickly toggle between formats
- **Automatic format detection**: When pasting, the extension automatically detects whether coordinates are in CLI or URL format
- **Console panel improvements**: Renamed "Current Location" to "Console" with clear button functionality
- **Separated parsers**: CLI and URL format parsers are now in separate files for better code organization

### Changed
- Improved coordinate display: Format is consistently applied across all coordinate displays
- Better code organization: Separated CLI and URL format parsing into dedicated modules
- Console panel: Enhanced with clear functionality and better naming

### Technical
- Added `urlFormatParser.js` for URL format parsing
- Refactored `coordinateParser.js` to use separate format parsers
- Improved format switching logic with state persistence

## [3.2.0] - 2024-12-XX

### Added
- **Alternative service URLs with Shift modifier**: Hold Shift and click service buttons to access alternative versions
  - **3D Buildings Box** → **3DLN Demo Box** (orange highlight)
  - **Labs HD Roads** → **Labs HD 3DLN Demo** (deep purple highlight)
  - **HD Roads Prod** → **HD Roads Demo** (cyan highlight)
  - **Google Maps** → **Google Earth** (blue highlight)
  - **3D Model Slots** → **Footprint** (purple highlight)
- **Color-coded Shift indicators**: Each alternative service has a unique color that matches its theme
- Enhanced logging for coordinate extraction and usage

### Changed
- Improved coordinate preservation: Pitch and bearing values (including 0) are now properly preserved in all operations
- Quick access buttons now always use fresh coordinates from current tab

### Fixed
- Fixed duplicate "popup-ready" messages in console
- Fixed coordinate freshness issues when using quick access buttons
- Better error handling with clear error messages when coordinates cannot be extracted or used

## [3.1.0] - 2024-XX-XX

### Added
- **Icon rotation animation**: Extension icon rotates while popup is loading for visual feedback
- **3D Model Slots service**: Added new service for 3D model visualization
- **Service navigation modal**: Added drag-and-drop reordering for services
- **Hotkeys 1-9**: Direct navigation to services using number keys
- **Color-coded service buttons**: Service buttons now have colored borders and background images based on service branding
- **Background images with blur effects**: Visual service identity with branded images
- **Service visibility toggle**: Hide/show services as needed
- **Custom service addition**: Add your own custom services with URL templates
- **Persistent service order**: Service order and preferences saved in localStorage
- Log panel now displays all console logs for better debugging

### Changed
- **Improved coordinate saving**: Coordinates in slots 1-3 save immediately; location names are fetched in the background
- Changed hotkey from Command+Shift+F to **Command+Shift+E** (Mac) / Ctrl+Shift+E (Windows/Linux)
- Updated hotkeys: Option+1,2,3,4 for slot selection
- Reordered quick access services (3D Model Slots at 8th, OpenStreetMap at 9th, Bing Maps at 10th)
- Improved popup window appearance and positioning
- Improved UI/UX with modern design inspired by 3D Buildings Box

### Fixed
- Fixed hotkey conflicts between slot selection and service navigation
- Better reliability: Coordinates are preserved even if geocoding fails or takes too long

## [3.0.0] - 2024-XX-XX

### Added
- **Universal coordinate parser**: Improved parser with support for various URL formats
- **Automatic location naming**: Background geocoding for slots 1-3 using OpenStreetMap Nominatim API
- **4-slot storage system**: Save and manage up to 4 coordinate sets
- **Comprehensive keyboard shortcuts**: Full hotkey support for all operations
- **Enhanced UI with animations**: Smooth transitions and visual feedback

### Changed
- **Modular architecture refactoring**: Simplified codebase for easier maintenance
- Fixed bearing/pitch handling (only added when non-zero)
- Better compatibility with various mapping services

### Technical
- Improved coordinate parser (universal support)
- Simplified codebase structure
- Better error handling

## [2.1] - 2025-03-21

### Added
- Basic coordinate extraction from URLs
- URL update functionality with coordinates
- Hotkey support for extension operations
- Basic popup interface

### Changed
- Improved coordinate parsing logic
- Better URL format support

### Fixed
- Fixed coordinate extraction for various map services
- Improved error handling

## [2.0] - 2025-03-XX

### Added
- Initial coordinate extraction functionality
- Basic URL coordinate parsing
- Chrome extension structure
- Popup interface for coordinate display

### Changed
- Initial implementation of MapsBridge Kit

## [1.0] - 2025-03-XX

### Added
- **Initial release**: First version of MapsBridge Kit
- Basic coordinate extraction from map URLs
- Simple UI for displaying coordinates
- Chrome extension manifest setup

---

## Version History

- **v3.3.0** - Dual format support (CLI/URL), format persistence, format toggle hotkey
- **v3.2.0** - Alternative service URLs, improved coordinate preservation, enhanced logging
- **v3.1.0** - Service navigation modal, hotkeys, visual improvements, icon animation
- **v3.0.0** - Major refactoring, universal parser, geocoding, 4-slot system
- **v2.1** - Basic coordinate extraction and URL updates with hotkeys
- **v2.0** - Initial coordinate extraction functionality
- **v1.0** - First release with basic coordinate extraction

