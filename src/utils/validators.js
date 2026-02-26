"use strict";

class Validators {
  /**
   * Validate latitude value
   * @param {number} lat - Latitude to validate
   * @returns {boolean} - True if valid
   */
  static isValidLatitude(lat) {
    if (typeof lat !== 'number' || isNaN(lat)) {
      return false;
    }
    return lat >= -90 && lat <= 90;
  }

  /**
   * Validate longitude value
   * @param {number} lon - Longitude to validate
   * @returns {boolean} - True if valid
   */
  static isValidLongitude(lon) {
    if (typeof lon !== 'number' || isNaN(lon)) {
      return false;
    }
    return lon >= -180 && lon <= 180;
  }

  /**
   * Validate zoom level
   * @param {number} zoom - Zoom level to validate
   * @returns {boolean} - True if valid
   */
  static isValidZoom(zoom) {
    if (typeof zoom !== 'number' || isNaN(zoom)) {
      return false;
    }
    return zoom >= 0 && zoom <= 22;
  }

  /**
   * Validate complete coordinate object
   * @param {Object} coords - Coordinates object with lat, lon, and optionally zoom
   * @returns {Object} - { valid: boolean, error?: string }
   */
  static isValidCoordinates(coords) {
    if (!coords || typeof coords !== 'object') {
      return { valid: false, error: 'Coordinates must be an object' };
    }

    if (!this.isValidLatitude(coords.lat)) {
      return { valid: false, error: 'Invalid latitude: must be between -90 and 90' };
    }

    if (!this.isValidLongitude(coords.lon)) {
      return { valid: false, error: 'Invalid longitude: must be between -180 and 180' };
    }

    if (coords.zoom !== undefined && coords.zoom !== null && !this.isValidZoom(coords.zoom)) {
      return { valid: false, error: 'Invalid zoom: must be between 0 and 22' };
    }

    return { valid: true };
  }

  /**
   * Sanitize and normalize coordinates
   * @param {Object} coords - Raw coordinates object
   * @returns {Object|null} - Sanitized coordinates or null if invalid
   */
  static sanitizeCoordinates(coords) {
    if (!coords) return null;

    const sanitized = {
      lat: parseFloat(coords.lat),
      lon: parseFloat(coords.lon)
    };

    // Add optional fields if present
    if (coords.zoom !== undefined && coords.zoom !== null) {
      sanitized.zoom = parseFloat(coords.zoom);
    }

    if (coords.bearing !== undefined && coords.bearing !== null) {
      sanitized.bearing = parseFloat(coords.bearing);
    }

    if (coords.pitch !== undefined && coords.pitch !== null) {
      sanitized.pitch = parseFloat(coords.pitch);
    }

    // Validate sanitized coordinates
    const validation = this.isValidCoordinates(sanitized);
    if (!validation.valid) {
      console.error('Coordinate validation failed:', validation.error);
      return null;
    }

    return sanitized;
  }

  /**
   * Clamp latitude to valid range
   * @param {number} lat - Latitude to clamp
   * @returns {number} - Clamped latitude
   */
  static clampLatitude(lat) {
    return Math.max(-90, Math.min(90, lat));
  }

  /**
   * Clamp longitude to valid range
   * @param {number} lon - Longitude to clamp
   * @returns {number} - Clamped longitude
   */
  static clampLongitude(lon) {
    return Math.max(-180, Math.min(180, lon));
  }

  /**
   * Clamp zoom to valid range
   * @param {number} zoom - Zoom level to clamp
   * @returns {number} - Clamped zoom
   */
  static clampZoom(zoom) {
    return Math.max(0, Math.min(22, zoom));
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Validators;
} else {
  window.Validators = Validators;
}
