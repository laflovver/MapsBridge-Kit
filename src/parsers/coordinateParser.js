"use strict";

const REGEX_PATTERNS = {
  pathFormat: /@(-?\d+\.?\d*),(-?\d+\.?\d*),(\d+\.?\d*)([a-z])?/,
  hashMapFormat: /#map=(\d+\.?\d*)\/(-?\d+\.?\d*)\/(-?\d+\.?\d*)/,
  hashSlashFormat: /#(\d+\.?\d*)\/(-?\d+\.?\d*)\/(-?\d+\.?\d*)(?:\/(-?\d+\.?\d*))?(?:\/(-?\d+\.?\d*))?/,
  latLonParams: /[?&#](?:lat|latitude)=(-?\d+\.?\d*)[&]?.*?(?:lon|lng|longitude)=(-?\d+\.?\d*)/i,
  lonLatParams: /[?&#](?:lon|lng|longitude)=(-?\d+\.?\d*)[&]?.*?(?:lat|latitude)=(-?\d+\.?\d*)/i,
  centerParam: /center=([^&]+)/,
  llParam: /[?&]ll=(-?\d+\.?\d*)[,~%2C](-?\d+\.?\d*)/i,
  cpParam: /[?&]cp=(-?\d+\.?\d*)[~%7E](-?\d+\.?\d*)/i,
  mapboxConsoleMap: /[&#]map=(-?\d+\.?\d*),(-?\d+\.?\d*),([\d\.]+)([z]?)/,
  mapboxConsoleRoute: /[&#]route=([^&]+)/,
  satellitesProFormat: /#(\d+\.?\d*),(\d+\.?\d*),(\d+)/,
  mapillaryFormat: /[?&]lat=(-?\d+\.?\d*)[&]?.*?[?&]lng=(-?\d+\.?\d*)/i,
  planetFormat: /\/mosaic\/[^\/]+\/center\/(-?\d+\.?\d*)\/(-?\d+\.?\d*)\/(\d+)/,
  zoomParam: /[?&](?:z|zoom|lvl)=(\d+)/i,
};

class CoordinateParser {
  
  static extractFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const fullUrl = urlObj.href;
      
      let coords = null;
      
      coords = this._extractFromPath(fullUrl);
      if (coords && this._validateCoordinates(coords)) {
        return this._normalizeCoordinates(coords);
      }
      
      coords = this._extractFromPlanet(fullUrl);
      if (coords && this._validateCoordinates(coords)) {
        return this._normalizeCoordinates(coords);
      }
      
      coords = this._extractFromHash(urlObj);
      if (coords && this._validateCoordinates(coords)) {
        return this._normalizeCoordinates(coords);
      }
      
      coords = this._extractFromQueryParams(urlObj);
      if (coords && this._validateCoordinates(coords)) {
        return this._normalizeCoordinates(coords);
      }
      
      coords = this._extractFromSpecialParams(urlObj, fullUrl);
      if (coords && this._validateCoordinates(coords)) {
        return this._normalizeCoordinates(coords);
      }
      
      return null;
    } catch (e) {
      console.error("Error parsing URL:", e);
      return null;
    }
  }
  
  static _extractFromPath(url) {
    const match = url.match(REGEX_PATTERNS.pathFormat);
    if (!match) return null;
    
    return {
      lat: parseFloat(match[1]),
      lon: parseFloat(match[2]),
      zoom: parseFloat(match[3]),
      bearing: 0,
      pitch: 0
    };
  }
  
  static _extractFromPlanet(url) {
    const match = url.match(REGEX_PATTERNS.planetFormat);
    if (!match) return null;
    
    return {
      lon: parseFloat(match[1]),
      lat: parseFloat(match[2]),
      zoom: parseFloat(match[3])
    };
  }
  
  static _extractFromHash(urlObj) {
    const hash = urlObj.hash;
    if (!hash) return null;
    
    let match = hash.match(REGEX_PATTERNS.hashMapFormat);
    if (match) {
      return {
        zoom: parseFloat(match[1]),
        lat: parseFloat(match[2]),
        lon: parseFloat(match[3]),
        bearing: 0,
        pitch: 0
      };
    }
    
    match = hash.match(REGEX_PATTERNS.hashSlashFormat);
    if (match) {
      const result = {
        zoom: parseFloat(match[1]),
        lat: parseFloat(match[2]),
        lon: parseFloat(match[3])
      };
      
      if (match[4] !== undefined && match[4] !== null && match[4] !== '') {
        result.bearing = parseFloat(match[4]);
      }
      if (match[5] !== undefined && match[5] !== null && match[5] !== '') {
        result.pitch = parseFloat(match[5]);
      }
      
      return result;
    }
    
    if (hash.includes('center=')) {
      match = hash.match(REGEX_PATTERNS.centerParam);
      if (match) {
        const centerValue = decodeURIComponent(match[1]);
        const parts = centerValue.split(/%2F|\//).filter(p => {
          const trimmed = p.trim();
          return trimmed !== '' && !isNaN(parseFloat(trimmed));
        });
        
        if (parts.length >= 3) {
          const p0 = parseFloat(parts[0]);
          const p1 = parseFloat(parts[1]);
          const p2 = parseFloat(parts[2]);
          
          if (p0 >= 0 && p0 <= 25 && p1 >= -180 && p1 <= 180 && p2 >= -90 && p2 <= 90) {
            return {
              zoom: p0,
              lon: p1,
              lat: p2,
              bearing: parts[3] ? parseFloat(parts[3]) : 0,
              pitch: parts[4] ? parseFloat(parts[4]) : 0
            };
          }
          if (p0 >= -180 && p0 <= 180 && p1 >= -90 && p1 <= 90) {
            return {
              lon: p0,
              lat: p1,
              zoom: p2,
              bearing: parts[3] ? parseFloat(parts[3]) : 0,
              pitch: parts[4] ? parseFloat(parts[4]) : 0
            };
          }
        }
      }
    }
    
    return null;
  }
  
  static _extractFromQueryParams(urlObj) {
    const url = urlObj.href;
    
    let match = url.match(REGEX_PATTERNS.latLonParams);
    if (match) {
      const result = {
        lat: parseFloat(match[1]),
        lon: parseFloat(match[2])
      };
      
      const zoomMatch = url.match(REGEX_PATTERNS.zoomParam);
      result.zoom = zoomMatch ? parseFloat(zoomMatch[1]) : 15;
      
      return result;
    }
    
    match = url.match(REGEX_PATTERNS.lonLatParams);
    if (match) {
      const result = {
        lon: parseFloat(match[1]),
        lat: parseFloat(match[2])
      };
      
      const zoomMatch = url.match(REGEX_PATTERNS.zoomParam);
      result.zoom = zoomMatch ? parseFloat(zoomMatch[1]) : 15;
      
      return result;
    }
    
    return null;
  }
  
  static _extractFromSpecialParams(urlObj, fullUrl) {
    let match = fullUrl.match(REGEX_PATTERNS.mapboxConsoleRoute);
    if (match) {
      const routeValue = match[1];
      const points = routeValue.split(';');
      
      const coords = points.map(point => {
        const parts = point.split(',');
        if (parts.length >= 2) {
          return {
            lon: parseFloat(parts[0]),
            lat: parseFloat(parts[1])
          };
        }
        return null;
      }).filter(c => c !== null);
      
      if (coords.length > 0) {
        const avgLon = coords.reduce((sum, c) => sum + c.lon, 0) / coords.length;
        const avgLat = coords.reduce((sum, c) => sum + c.lat, 0) / coords.length;
        
        let zoom = 15;
        const mapMatch = fullUrl.match(REGEX_PATTERNS.mapboxConsoleMap);
        if (mapMatch) {
          zoom = parseFloat(mapMatch[3]);
        }
        
        return {
          lon: avgLon,
          lat: avgLat,
          zoom: zoom
        };
      }
    }
    
    match = fullUrl.match(REGEX_PATTERNS.mapboxConsoleMap);
    if (match) {
      return {
        lon: parseFloat(match[1]),
        lat: parseFloat(match[2]),
        zoom: parseFloat(match[3])
      };
    }
    
    // Try ll parameter (ll=lon,lat or ll=lon~lat)
    match = fullUrl.match(REGEX_PATTERNS.llParam);
    if (match) {
      const result = {
        lon: parseFloat(match[1]),
        lat: parseFloat(match[2])
      };
      
      const zoomMatch = fullUrl.match(REGEX_PATTERNS.zoomParam);
      result.zoom = zoomMatch ? parseFloat(zoomMatch[1]) : 15;
      
      return result;
    }
    
    // Try cp parameter (cp=lat~lon)
    match = fullUrl.match(REGEX_PATTERNS.cpParam);
    if (match) {
      const result = {
        lat: parseFloat(match[1]),
        lon: parseFloat(match[2])
      };
      
      const zoomMatch = fullUrl.match(REGEX_PATTERNS.zoomParam);
      result.zoom = zoomMatch ? parseFloat(zoomMatch[1]) : 15;
      
      return result;
    }
    
    // Try Satellites.pro format (#lat,lon,zoom)
    match = fullUrl.match(REGEX_PATTERNS.satellitesProFormat);
    if (match) {
      return {
        lat: parseFloat(match[1]),
        lon: parseFloat(match[2]),
        zoom: parseFloat(match[3])
      };
    }
    
    // Try Mapillary format (?lat=X&lng=Y&z=Z)
    match = fullUrl.match(REGEX_PATTERNS.mapillaryFormat);
    if (match) {
      const result = {
        lat: parseFloat(match[1]),
        lon: parseFloat(match[2])
      };
      
      const zoomMatch = fullUrl.match(REGEX_PATTERNS.zoomParam);
      result.zoom = zoomMatch ? parseFloat(zoomMatch[1]) : 15;
      
      return result;
    }
    
    // Try center parameter in query
    if (fullUrl.includes('center=')) {
      match = fullUrl.match(REGEX_PATTERNS.centerParam);
      if (match) {
        const centerValue = decodeURIComponent(match[1]);
        const parts = centerValue.split(/[%2F\/]/).filter(p => {
          const trimmed = p.trim();
          return trimmed !== '' && !isNaN(parseFloat(trimmed));
        });
        
        if (parts.length >= 3) {
          const p0 = parseFloat(parts[0]);
          const p1 = parseFloat(parts[1]);
          const p2 = parseFloat(parts[2]);
          
          if (p0 >= 0 && p0 <= 25 && p1 >= -180 && p1 <= 180 && p2 >= -90 && p2 <= 90) {
            return {
              zoom: p0,
              lon: p1,
              lat: p2,
              bearing: parts[3] ? parseFloat(parts[3]) : 0,
              pitch: parts[4] ? parseFloat(parts[4]) : 0
            };
          }
          if (p0 >= -180 && p0 <= 180 && p1 >= -90 && p1 <= 90) {
            return {
              lon: p0,
              lat: p1,
              zoom: p2,
              bearing: parts[3] ? parseFloat(parts[3]) : 0,
              pitch: parts[4] ? parseFloat(parts[4]) : 0
            };
          }
        } else if (parts.length >= 2) {
          return {
            lon: parseFloat(parts[0]),
            lat: parseFloat(parts[1]),
            zoom: parts[2] ? parseFloat(parts[2]) : 15
          };
        }
      }
    }
    
    return null;
  }

  static parseFromCli(cliString) {
    if (typeof window !== 'undefined' && window.CliParser) {
      const result = window.CliParser.parse(cliString);
      return result ? this._normalizeCoordinates(result) : null;
    }
    
    const parts = cliString.split(/\s+/);
    const result = {};
    
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith("--")) {
        const key = parts[i].substring(2);
        const value = parts[i + 1];
        if (value && !isNaN(parseFloat(value))) {
          result[key] = parseFloat(value);
        }
        i++;
      }
    }
    
    return (result.lon && result.lat) ? this._normalizeCoordinates(result) : null;
  }

  static formatToCli(coords) {
    if (typeof window !== 'undefined' && window.CliParser) {
      return window.CliParser.format(coords);
    }
    
    if (!coords || typeof coords !== 'object') {
      return '';
    }

    const parts = [];
    if (typeof coords.lon === 'number') parts.push(`--lon ${coords.lon}`);
    if (typeof coords.lat === 'number') parts.push(`--lat ${coords.lat}`);
    if (typeof coords.zoom === 'number') parts.push(`--zoom ${coords.zoom}`);
    if (typeof coords.pitch === 'number' && coords.pitch !== 0) parts.push(`--pitch ${coords.pitch}`);
    if (typeof coords.bearing === 'number' && coords.bearing !== 0) parts.push(`--bearing ${coords.bearing}`);
    
    return parts.join(' ');
  }

  static parseFromUrlFormat(urlString) {
    if (typeof window !== 'undefined' && window.UrlFormatParser) {
      const result = window.UrlFormatParser.parse(urlString);
      return result ? this._normalizeCoordinates(result) : null;
    }
    return null;
  }

  static formatToUrlFormat(coords) {
    if (typeof window !== 'undefined' && window.UrlFormatParser) {
      return window.UrlFormatParser.format(coords);
    }
    return '';
  }

  static isUrlFormat(str) {
    if (typeof window !== 'undefined' && window.UrlFormatParser) {
      return window.UrlFormatParser.isUrlFormat(str);
    }
    return false;
  }

  static parseFromAnyFormat(str) {
    if (!str || typeof str !== 'string') {
      return null;
    }

    if (this.isUrlFormat(str)) {
      return this.parseFromUrlFormat(str);
    }

    return this.parseFromCli(str);
  }

  static _validateCoordinates(coords) {
    return coords && 
           typeof coords.lat === 'number' && 
           typeof coords.lon === 'number' &&
           coords.lat >= -90 && coords.lat <= 90 &&
           coords.lon >= -180 && coords.lon <= 180 &&
           !isNaN(coords.lat) && !isNaN(coords.lon);
  }

  static _normalizeCoordinates(coords) {
    const normalized = {
      lat: coords.lat || 0,
      lon: coords.lon || 0,
      zoom: coords.zoom || 0
    };
    
    if (coords.bearing !== undefined && coords.bearing !== null) {
      normalized.bearing = coords.bearing;
    }
    if (coords.pitch !== undefined && coords.pitch !== null) {
      normalized.pitch = coords.pitch;
    }
    
    return normalized;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CoordinateParser;
} else {
  window.CoordinateParser = CoordinateParser;
}

if (typeof window !== 'undefined') {
  window.CoordinateParser = CoordinateParser;
}
