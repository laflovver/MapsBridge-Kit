"use strict";

const Constants = {
  // Storage
  STORAGE_KEY: "recentCoordinates",
  MAX_SLOTS: 4,

  // API Rate Limits
  NOMINATIM_RATE_LIMIT_MS: 1000,
  GEOCODING_TIMEOUT_MS: 10000,

  // UI
  MAX_LOG_MESSAGES: 50,
  BUTTON_ANIMATION_DURATION_MS: 200,
  SCROLL_SNAP_DELAY_MS: 100,

  // Validation
  MAX_SERVICE_NAME_LENGTH: 50,
  MAX_SERVICE_URL_LENGTH: 2000,

  // Coordinates
  DEFAULT_ZOOM: 15,
  MIN_LATITUDE: -90,
  MAX_LATITUDE: 90,
  MIN_LONGITUDE: -180,
  MAX_LONGITUDE: 180,
  MAX_ZOOM: 22,
  MIN_ZOOM: 0,

  // Animation
  ANIMATION_STEPS: 12,
  ANIMATION_SPEED_MS: 100,

  // Coordinate format precision
  DEFAULT_DECIMAL_PLACES: 7,

  // Message types
  MESSAGE_TYPES: {
    INFO: "info",
    SUCCESS: "success",
    WARNING: "warning",
    ERROR: "error"
  }
};

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Constants;
} else {
  window.Constants = Constants;
}
