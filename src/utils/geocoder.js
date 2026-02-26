"use strict";

class RequestQueue {
  constructor(minInterval = 1000) {
    this.minInterval = minInterval;
    this.lastRequestTime = 0;
    this.queue = [];
    this.processing = false;
  }

  async enqueue(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      if (timeSinceLastRequest < this.minInterval) {
        await this.sleep(this.minInterval - timeSinceLastRequest);
      }

      const { requestFn, resolve, reject } = this.queue.shift();
      this.lastRequestTime = Date.now();

      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class Geocoder {

  static _osmQueue = new RequestQueue(1000);

  static getVersion() {
    return chrome.runtime.getManifest().version;
  }

  static getUserAgent() {
    return `MapsBridge-Kit/${this.getVersion()}`;
  }

  static async reverseGeocode(lat, lon, options = {}) {
    const { signal, timeout = 10000 } = options;

    try {
      // Create timeout controller if timeout specified
      let timeoutId;
      const timeoutController = new AbortController();

      if (timeout > 0) {
        timeoutId = setTimeout(() => timeoutController.abort(), timeout);
      }

      // Combine signals if both provided
      let combinedSignal = signal;
      if (signal && timeout > 0) {
        // If both signal and timeout are provided, we need to handle both
        combinedSignal = signal;
        signal.addEventListener('abort', () => timeoutController.abort());
      } else if (timeout > 0) {
        combinedSignal = timeoutController.signal;
      }

      // First try OpenStreetMap Nominatim (free) - rate limited
      const osmResult = await this._osmQueue.enqueue(() => this._queryOSM(lat, lon, combinedSignal));

      // Clear timeout if request completed
      if (timeoutId) clearTimeout(timeoutId);

      if (osmResult) {
        return osmResult;
      }

      // If OSM didn't work, try Mapbox (requires API key)
      const mapboxResult = await this._queryMapbox(lat, lon, combinedSignal);
      if (mapboxResult) {
        return mapboxResult;
      }

      return null;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Geocoding request aborted');
        return null;
      }
      console.error('Geocoding error:', error);
      return null;
    }
  }
  
  static async _queryOSM(lat, lon, signal = null) {
    try {
      // First try to find landmarks with high rating
      const poiUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&extratags=1&accept-language=en&namedetails=1&polygon_geojson=0`;

      const fetchOptions = {
        headers: {
          'User-Agent': this.getUserAgent(),
          'Accept-Language': 'en'
        }
      };

      // Add signal if provided
      if (signal) {
        fetchOptions.signal = signal;
      }

      const response = await fetch(poiUrl, fetchOptions);
      
      if (!response.ok) {
        throw new Error(`OSM API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.display_name) {
        const result = this._formatOSMName(data);
        console.log('OSM Geocoding result:', {
          original: data.display_name,
          address: data.address,
          extratags: data.extratags,
          namedetails: data.namedetails,
          result: result,
          landmark: this._findLandmark(data.address, data.extratags, data.namedetails),
          streetInfo: this._getStreetInfo(data.address)
        });
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('OSM geocoding error:', error);
      return null;
    }
  }
  
  static async _queryMapbox(lat, lon, signal = null) {
    try {
      // Mapbox API key required
      const apiKey = this._getMapboxApiKey();
      if (!apiKey) {
        return null;
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${apiKey}&types=place,locality,neighborhood,address&language=en`;

      const fetchOptions = {
        headers: {
          'Accept-Language': 'en'
        }
      };

      // Add signal if provided
      if (signal) {
        fetchOptions.signal = signal;
      }

      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        throw new Error(`Mapbox API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.features && data.features.length > 0) {
        return this._formatMapboxName(data.features[0]);
      }
      
      return null;
    } catch (error) {
      console.error('Mapbox geocoding error:', error);
      return null;
    }
  }
  
  static _formatOSMName(data) {
    const address = data.address || {};
    const extratags = data.extratags || {};
    const namedetails = data.namedetails || {};
    
    // 1. PRIORITY: Look for landmarks and important places
    const landmark = this._findLandmark(address, extratags, namedetails);
    if (landmark) {
      return landmark;
    }
    
    // 2. FALLBACK: Street and house number
    const streetInfo = this._getStreetInfo(address);
    if (streetInfo) {
      return streetInfo;
    }
    
    // 3. LAST OPTION: City or general name
    const city = address.city || address.town || address.village || address.hamlet || address.municipality;
    const region = address.state || address.region || address.county;
    const country = address.country;
    
    if (city) {
      return city;
    } else if (region) {
      return region;
    } else if (country) {
      return country;
    } else {
      return data.display_name.split(',')[0].trim();
    }
  }
  
  static _findLandmark(address, extratags, namedetails) {
    // 1. First search for name in namedetails (most accurate)
    const nameKeys = ['name:en', 'name', 'name:official', 'name:short'];
    for (const key of nameKeys) {
      if (namedetails[key] && namedetails[key].length > 2) {
        return namedetails[key];
      }
    }
    
    // 2. Search in address by priority
    const highPriorityFields = [
      'name', 'house_name', 'building', 'amenity', 'tourism', 
      'leisure', 'sport', 'historic', 'religion', 'shop', 
      'craft', 'office', 'healthcare', 'education'
    ];
    
    for (const field of highPriorityFields) {
      if (address[field] && address[field] !== 'yes' && address[field].length > 2) {
        return address[field];
      }
    }
    
    // 3. Search in extratags by priority
    const landmarkTypes = [
      'name', 'name:en', 'name:official', 'name:short',
      'tourism', 'amenity', 'leisure', 'sport', 'historic', 
      'religion', 'shop', 'craft', 'office', 'healthcare', 
      'education', 'building', 'natural', 'waterway', 
      'aeroway', 'railway', 'highway'
    ];
    
    for (const type of landmarkTypes) {
      if (extratags[type] && typeof extratags[type] === 'string' && 
          extratags[type].length > 2 && extratags[type] !== 'yes') {
        return extratags[type];
      }
    }
    
    // 4. Search in other extratags fields
    for (const [key, value] of Object.entries(extratags)) {
      if (typeof value === 'string' && value.length > 3 && 
          !key.includes('website') && !key.includes('phone') && 
          !key.includes('email') && !key.includes('opening_hours') &&
          !key.includes('capacity') && !key.includes('surface') &&
          value !== 'yes' && value !== 'no') {
        return value;
      }
    }
    
    return null;
  }
  
  static _getStreetInfo(address) {
    const street = address.road || address.street || address.pedestrian || 
                   address.footway || address.path || address.cycleway;
    const houseNumber = address.house_number;
    const suburb = address.suburb || address.neighbourhood || 
                   address.quarter || address.district;
    const city = address.city || address.town || address.village || 
                 address.hamlet || address.municipality;
    
    if (!street) {
      return null;
    }
    
    let result = street;
    
    // Add house number
    if (houseNumber) {
      result += ` ${houseNumber}`;
    }
    
    // Add district
    if (suburb && suburb !== city) {
      result += `, ${suburb}`;
    }
    
    // Add city
    if (city) {
      result += `, ${city}`;
    }
    
    return result;
  }
  
  static _formatMapboxName(feature) {
    const context = feature.context || [];
    const placeName = feature.place_name || feature.text;
    
    // Search for various place types in context
    const city = context.find(c => c.id.startsWith('place.'));
    const region = context.find(c => c.id.startsWith('region.'));
    const neighborhood = context.find(c => c.id.startsWith('neighborhood.'));
    const street = context.find(c => c.id.startsWith('street.'));
    const address = context.find(c => c.id.startsWith('address.'));
    
    let result = feature.text;
    
    // If not a specific place but street or address, add context
    if (street && street.text !== result) {
      result += `, ${street.text}`;
    } else if (neighborhood && neighborhood.text !== result) {
      result += `, ${neighborhood.text}`;
    } else if (city && city.text !== result) {
      result += `, ${city.text}`;
    } else if (region && region.text !== result) {
      result += `, ${region.text}`;
    }
    
    return result;
  }
  
  static _getMapboxApiKey() {
    // Can add setting for API key
    // For now return null to use only OSM
    return null;
  }
  
  static createShortName(fullName) {
    if (!fullName) return '';
    
    // Split into parts
    const parts = fullName.split(',').map(p => p.trim()).filter(p => p);
    
    if (parts.length === 0) return '';
    
    // If only one part, use it
    if (parts.length === 1) {
      let short = parts[0];
      if (short.length > 20) {
        short = short.substring(0, 17) + '...';
      }
      return short;
    }
    
    // Priority for short name:
    // 1. First part (usually street + house number or place name)
    // 2. If first part too long, take second part (district/city)
    let short = parts[0];
    
    // If first part too long, try second
    if (short.length > 25 && parts.length > 1) {
      short = parts[1];
    }
    
    // If still too long, trim
    if (short.length > 20) {
      short = short.substring(0, 17) + '...';
    }
    
    return short;
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Geocoder;
} else {
  window.Geocoder = Geocoder;
}
