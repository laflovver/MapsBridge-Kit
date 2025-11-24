"use strict";

class BrowserManager {
  
  static async getActiveTabUrl() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs && tabs.length ? tabs[0].url : null;
    } catch (error) {
      console.error("Error getting active tab URL:", error);
      return null;
    }
  }

  static async updateActiveTabWithCoordinates(coords) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || !tabs.length) {
        console.error("No active tab for URL update.");
        return false;
      }

      const tab = tabs[0];
      const currentUrlStr = tab.url;
      if (!currentUrlStr) {
        console.error("Tab URL is undefined.");
        return false;
      }

      let currentUrl;
      try {
        currentUrl = new URL(currentUrlStr);
      } catch (e) {
        console.error("Invalid URL format: " + currentUrlStr, e);
        return false;
      }

      const updatedUrl = this._generateUpdatedUrl(currentUrl, currentUrlStr, coords);
      if (!updatedUrl) {
        console.error("URL structure not supported: " + currentUrlStr);
        return false;
      }

      console.log("Updated URL:", updatedUrl);
      
      // Try to update URL via content script (no reload) first
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'updateUrl',
          url: updatedUrl
        });
        
        if (response && response.success) {
          console.log("URL updated via History API (no reload)");
          return true;
        } else if (response && response.needsReload) {
          console.log("Content script indicates reload needed, using tabs.update");
          // Fallback to reload if content script says it's needed
        } else {
          console.log("Content script update failed, using tabs.update");
        }
      } catch (messageError) {
        // Content script might not be loaded or not available (e.g., chrome:// pages)
        console.log("Content script not available, using tabs.update:", messageError.message);
      }
      
      // Fallback: use tabs.update (will reload page)
      await chrome.tabs.update(tab.id, { url: updatedUrl });
      return true;
    } catch (error) {
      console.error("Error updating tab URL:", error);
      return false;
    }
  }

  static async openExtensionInTab() {
    try {
      const popupUrl = chrome.runtime.getURL("popup.html");
      
      // Check if extension tab is already open
      const tabs = await chrome.tabs.query({ url: popupUrl });
      
      if (tabs.length > 0) {
        // If tab already open, switch to it
        await chrome.tabs.update(tabs[0].id, { active: true });
        await chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        // Open new extension tab
        await chrome.tabs.create({ 
          url: popupUrl,
          active: true 
        });
      }
      return true;
    } catch (error) {
      console.error("Error opening extension in tab:", error);
      return false;
    }
  }

  // Private methods for URL updating

  static _generateUpdatedUrl(currentUrl, currentUrlStr, coords) {
    const hostname = currentUrl.hostname;
    const mainPart = currentUrl.origin + currentUrl.pathname + (currentUrl.search || "");
    
    const rules = [
      this._createGoogleEarthRule(currentUrlStr, coords),
      this._createGoogleMapsRule(currentUrlStr, coords),
      this._createMapboxRule(currentUrl, mainPart, coords),
      this._createMapboxConsoleRule(currentUrlStr, coords),
      this._createHashMapRule(currentUrlStr, coords),
      this._createHashCenterRule(currentUrlStr, coords),
      this._createHashSlashRule(currentUrl, mainPart, coords),
      this._createSearchParamsRule(currentUrl, coords)
    ];

    for (const rule of rules) {
      if (rule.match(currentUrl)) {
        const updatedUrl = rule.transform(currentUrl);
        if (updatedUrl) return updatedUrl;
      }
    }

    return null;
  }

  static _createGoogleEarthRule(currentUrlStr, coords) {
    return {
      match: (url) => url.hostname.includes("earth.google.com") && url.pathname.includes("/@"),
      transform: (url) => {
        const parts = currentUrlStr.split("/@");
        if (parts.length > 1) {
          const segments = parts[1].split(",");
          if (segments.length >= 2) {
            segments[0] = String(coords.lat);
            segments[1] = String(coords.lon);
            if (segments.length >= 3) {
              const seg2 = segments[2];
              const match = seg2.match(/^([0-9\.]+)([a-zA-Z]*)/);
              segments[2] = match ? String(coords.zoom) + (match[2] || "a") : String(coords.zoom) + "a";
            }
            return parts[0] + "/@" + segments.join(",");
          }
        }
        return null;
      }
    };
  }

  static _createGoogleMapsRule(currentUrlStr, coords) {
    return {
      match: (url) => url.hostname.includes("google.com") && url.pathname.includes("/@"),
      transform: (url) => {
        // Match the pattern /@lat,lon,zoom followed by optional parameters
        const match = currentUrlStr.match(/^(.+\/@)[^\/]+(.*)$/);
        if (match) {
          const prefix = match[1];
          const suffix = match[2];
          const newCoordinatesSegment = `${coords.lat},${coords.lon},${coords.zoom}z`;
          return prefix + newCoordinatesSegment + suffix;
        }
        return null;
      }
    };
  }

  static _createMapboxRule(currentUrl, mainPart, coords) {
    return {
      match: (url) => {
        // Match Mapbox URLs but NOT if hash contains query parameters (like ?center=)
        // or if it's a Mapbox Sites URL (those use center= parameter)
        if (url.hostname.includes("sites.mapbox.com")) return false;
        return (url.hostname.includes("mapbox.com") || url.hostname.includes("api.mapbox.com")) && url.hash && !url.hash.includes('?');
      },
      transform: (url) => {
        const cleanHash = url.hash.replace(/^#\/?/, "");
        const segments = cleanHash.split("/");
        
        // Build hash based on available coordinates
        let hash = `#${coords.zoom}/${coords.lat}/${coords.lon}`;
        
        // Add bearing and pitch if they exist in the original URL or in coords (including 0)
        const hasOriginalBearing = segments.length >= 4;
        const hasOriginalPitch = segments.length >= 5;
        const hasCoordsBearing = coords.bearing !== undefined && coords.bearing !== null;
        const hasCoordsPitch = coords.pitch !== undefined && coords.pitch !== null;
        
        if (hasOriginalBearing || hasCoordsBearing) {
          hash += `/${coords.bearing !== undefined && coords.bearing !== null ? coords.bearing : (parseFloat(segments[3]) || 0)}`;
        }
        if (hasOriginalPitch || hasCoordsPitch) {
          hash += `/${coords.pitch !== undefined && coords.pitch !== null ? coords.pitch : (parseFloat(segments[4]) || 0)}`;
        }
        
        return mainPart + hash;
      }
    };
  }

  static _createMapboxConsoleRule(currentUrlStr, coords) {
    return {
      match: (url) => url.hostname.includes("console.mapbox.com") && currentUrlStr.includes('directions-debug'),
      transform: (url) => {
        // Format: #route=11.59,48.17;11.73,48.17;11.69,48.13&map=11.66,48.16,13.16z
        const newMapParam = `map=${coords.lon},${coords.lat},${coords.zoom}z`;
        
        // Replace the map parameter in the hash
        const updatedUrl = currentUrlStr.replace(/map=[^&]+/, newMapParam);
        
        return updatedUrl;
      }
    };
  }

  static _createHashMapRule(currentUrlStr, coords) {
    return {
      match: (url) => url.hash.includes("map="),
      transform: (url) => currentUrlStr.replace(/(map=)[^&]+/, `$1${coords.zoom}/${coords.lat}/${coords.lon}`)
    };
  }

  static _createHashCenterRule(currentUrlStr, coords) {
    return {
      match: (url) => url.hash.includes("center=") || url.search.includes("center="),
      transform: (url) => {
        // Check the original format in the URL to preserve it
        const centerMatch = currentUrlStr.match(/center=([^&]+)/);
        
        if (centerMatch) {
          const originalCenter = decodeURIComponent(centerMatch[1]);
          const parts = originalCenter.split(/[%2F\/]/).filter(p => p.trim() !== '');
          
          let newCenterValue;
          
          if (parts.length >= 3) {
            const p0 = parseFloat(parts[0]);
            const p1 = parseFloat(parts[1]);
            const p2 = parseFloat(parts[2]);
            
            // Determine format: zoom/lon/lat if first is 0-25 and second is -180 to 180
            if (p0 >= 0 && p0 <= 25 && p1 >= -180 && p1 <= 180 && p2 >= -90 && p2 <= 90) {
              // Format is zoom/lon/lat - preserve this format
              newCenterValue = `${coords.zoom}%2F${coords.lon}%2F${coords.lat}`;
            } else if (p0 >= -180 && p0 <= 180 && p1 >= -90 && p1 <= 90) {
              // Format is lon/lat/zoom - preserve this format
              newCenterValue = `${coords.lon}%2F${coords.lat}%2F${coords.zoom}`;
            } else {
              // Default: use zoom/lon/lat format
              newCenterValue = `${coords.zoom}%2F${coords.lon}%2F${coords.lat}`;
            }
            
            // Add bearing and pitch if they exist in original URL or in coords
            const hasOriginalBearing = parts.length >= 4;
            const hasOriginalPitch = parts.length >= 5;
            const hasCoordsBearing = coords.bearing !== undefined && coords.bearing !== null;
            const hasCoordsPitch = coords.pitch !== undefined && coords.pitch !== null;
            
            if (hasOriginalBearing || hasCoordsBearing) {
              newCenterValue += `%2F${coords.bearing !== undefined && coords.bearing !== null ? coords.bearing : (parts[3] || 0)}`;
            }
            if (hasOriginalPitch || hasCoordsPitch) {
              newCenterValue += `%2F${coords.pitch !== undefined && coords.pitch !== null ? coords.pitch : (parts[4] || 0)}`;
            }
          } else {
            // Default: use zoom/lon/lat format for unknown cases
            newCenterValue = `${coords.zoom}%2F${coords.lon}%2F${coords.lat}`;
            
            // Add bearing and pitch if they exist in coords
            if (coords.bearing !== undefined && coords.bearing !== null) {
              newCenterValue += `%2F${coords.bearing}`;
            }
            if (coords.pitch !== undefined && coords.pitch !== null) {
              newCenterValue += `%2F${coords.pitch}`;
            }
          }
          
          // Replace center parameter value while preserving everything else
          // Match center= followed by value until & or end of string/hash
          // This preserves the rest of the URL structure (hash fragments, other parameters, etc.)
          return currentUrlStr.replace(/center=([^&]+)/, `center=${newCenterValue}`);
        }
        
        // If center parameter doesn't exist, add it (but this shouldn't happen if match is true)
        // Default: use zoom/lon/lat format for unknown cases
        let defaultCenter = `${coords.zoom}%2F${coords.lon}%2F${coords.lat}`;
        if (coords.bearing !== undefined && coords.bearing !== null) {
          defaultCenter += `%2F${coords.bearing}`;
        }
        if (coords.pitch !== undefined && coords.pitch !== null) {
          defaultCenter += `%2F${coords.pitch}`;
        }
        return currentUrlStr.replace(/center=([^&]+)/, `center=${defaultCenter}`);
      }
    };
  }

  static _createHashSlashRule(currentUrl, mainPart, coords) {
    return {
      match: (url) => {
        // Match universal hash format: #zoom/lat/lon or #zoom/lat/lon/bearing/pitch
        // But NOT if hash contains query parameters (like ?center=)
        if (!url.hash) return false;
        if (url.hash.includes('?')) return false; // Don't match if hash has query params
        
        const hashPattern = /#\d+\.?\d*\/-?\d+\.?\d*\/-?\d+\.?\d*/;
        return hashPattern.test(url.hash);
      },
      transform: (url) => {
        const cleanHash = url.hash.replace(/^#\/?/, "");
        const segments = cleanHash.split("/");
        
        // Build new hash
        let hash = `#${coords.zoom}/${coords.lat}/${coords.lon}`;
        
        // Preserve bearing and pitch if they existed in original URL or in coords (including 0)
        const hasOriginalBearing = segments.length >= 4;
        const hasOriginalPitch = segments.length >= 5;
        const hasCoordsBearing = coords.bearing !== undefined && coords.bearing !== null;
        const hasCoordsPitch = coords.pitch !== undefined && coords.pitch !== null;
        
        if (hasOriginalBearing || hasCoordsBearing) {
          hash += `/${coords.bearing !== undefined && coords.bearing !== null ? coords.bearing : (parseFloat(segments[3]) || 0)}`;
        }
        if (hasOriginalPitch || hasCoordsPitch) {
          hash += `/${coords.pitch !== undefined && coords.pitch !== null ? coords.pitch : (parseFloat(segments[4]) || 0)}`;
        }
        
        return mainPart + hash;
      }
    };
  }

  static _createSearchParamsRule(currentUrl, coords) {
    return {
      match: (url) => url.searchParams.has("lat") || url.searchParams.has("lon"),
      transform: (url) => {
        url.searchParams.set("lat", String(coords.lat));
        url.searchParams.set("lon", String(coords.lon));
        if (coords.zoom) url.searchParams.set("zoom", String(coords.zoom));
        // Only add pitch and bearing if they exist and are non-zero
        if (coords.pitch && coords.pitch !== 0) url.searchParams.set("pitch", String(coords.pitch));
        if (coords.bearing && coords.bearing !== 0) url.searchParams.set("bearing", String(coords.bearing));
        return url.toString();
      }
    };
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BrowserManager;
} else {
  window.BrowserManager = BrowserManager;
}
