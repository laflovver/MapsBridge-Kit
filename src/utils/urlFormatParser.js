"use strict";

class UrlFormatParser {
  
  static parse(urlString) {
    if (!urlString || typeof urlString !== 'string') {
      return null;
    }

    const cleanString = urlString.trim().startsWith('#') 
      ? urlString.trim().substring(1) 
      : urlString.trim();

    const parts = cleanString.split('/').filter(p => p !== '');
    
    if (parts.length < 3) {
      return null;
    }

    const zoom = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    const lon = parseFloat(parts[2]);
    
    if (isNaN(zoom) || isNaN(lat) || isNaN(lon)) {
      return null;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return null;
    }

    const result = {
      zoom: zoom,
      lat: lat,
      lon: lon
    };

    if (parts.length >= 4 && parts[3] !== undefined && parts[3] !== '') {
      const bearing = parseFloat(parts[3]);
      if (!isNaN(bearing)) {
        result.bearing = bearing;
      }
    }

    if (parts.length >= 5 && parts[4] !== undefined && parts[4] !== '') {
      const pitch = parseFloat(parts[4]);
      if (!isNaN(pitch)) {
        result.pitch = pitch;
      }
    }

    return result;
  }

  static format(coords) {
    if (!coords || typeof coords !== 'object') {
      return '';
    }

    if (typeof coords.zoom !== 'number' || typeof coords.lat !== 'number' || typeof coords.lon !== 'number') {
      return '';
    }

    const parts = [
      coords.zoom.toString(),
      coords.lat.toString(),
      coords.lon.toString()
    ];

    const bearing = (typeof coords.bearing === 'number') ? coords.bearing : 0;
    parts.push(bearing.toString());

    const pitch = (typeof coords.pitch === 'number') ? coords.pitch : 0;
    parts.push(pitch.toString());

    return '#' + parts.join('/');
  }

  static isUrlFormat(str) {
    if (!str || typeof str !== 'string') {
      return false;
    }

    const cleanString = str.trim();
    if (!cleanString.startsWith('#')) {
      return false;
    }

    const parts = cleanString.substring(1).split('/').filter(p => p !== '');
    if (parts.length < 3) {
      return false;
    }

    const zoom = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    const lon = parseFloat(parts[2]);

    return !isNaN(zoom) && !isNaN(lat) && !isNaN(lon);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UrlFormatParser;
} else {
  window.UrlFormatParser = UrlFormatParser;
}

