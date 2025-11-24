"use strict";

class UIComponents {
  
  static Utils = class {
    
    static getRandomReadableColor() {
      const r = Math.floor(Math.random() * 128);
      const g = Math.floor(Math.random() * 128);
      const b = Math.floor(Math.random() * 128);
      return `rgb(${r}, ${g}, ${b})`;
    }

    static animateButton(btn) {
      if (!btn) return;
      btn.classList.add("key-animation", "stripe");
      setTimeout(() => btn.classList.remove("key-animation", "stripe"), 600);
    }

    static snapScroll(el) {
      const computedStyle = window.getComputedStyle(el);
      let lineHeight = parseFloat(computedStyle.lineHeight);
      if (isNaN(lineHeight)) {
        lineHeight = 21;
      }
      const twoLines = lineHeight * 2;
      const remainder = el.scrollTop % twoLines;
      const adjustment = remainder < twoLines / 2 ? -remainder : twoLines - remainder;
      el.scrollTo({ top: el.scrollTop + adjustment, behavior: "smooth" });
    }
  };

  static Logger = class {
    
    static _logContainer = null;
    static _lastMessages = [];
    
    static init() {
      this._logContainer = document.getElementById("log-output");
      this._interceptConsole();
    }
    
    static _interceptConsole() {
      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;
      
      console.log = (...args) => {
        originalLog.apply(console, args);
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        this.log(`[LOG] ${message}`, "info");
      };
      
      console.error = (...args) => {
        originalError.apply(console, args);
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        this.log(`[ERROR] ${message}`, "error");
      };
      
      console.warn = (...args) => {
        originalWarn.apply(console, args);
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        this.log(`[WARN] ${message}`, "warning");
      };
    }

    static log(msg, type = "info") {
      if (!this._logContainer) {
        this._logContainer = document.getElementById("log-output");
        if (!this._logContainer) return;
      }
      
      const recentMessages = this._lastMessages.slice(-3);
      const isDuplicate = recentMessages.some(entry => 
        entry.msg === msg && entry.type === type
      );
      
      if (isDuplicate) {
        return; // Skip duplicate message
      }
      
      const timestamp = new Date().toLocaleTimeString();
      this._lastMessages.push({ msg, type, timestamp });
      if (this._lastMessages.length > 50) {
        this._lastMessages = this._lastMessages.slice(-50);
      }
      
      const span = document.createElement("span");
      span.className = `log-message log-${type}`;
      span.textContent = `[${timestamp}] ${msg.replace(/\n/g, " ")}`;
      
      this._logContainer.appendChild(span);
      
      const messages = this._logContainer.querySelectorAll('.log-message');
      if (messages.length > 50) {
        for (let i = 0; i < messages.length - 50; i++) {
          messages[i].remove();
        }
      }
      
      setTimeout(() => {
        this._logContainer.scrollTop = this._logContainer.scrollHeight;
      }, 10);
    }
  };

  static SlotRenderer = class {
    
    static renderContent(element, text, storedLabelColor = "") {
      if (!element) return;
      
      let label = "";
      let coords = text;
      
      if (text.indexOf(" - ") !== -1) {
        const parts = text.split(" - ");
        label = parts[0].trim();
        coords = parts.slice(1).join(" - ").trim();
      }
      
      const labelColor = storedLabelColor || "";
      
      element.innerHTML = "";
      
      if (label) {
        const cleanLabel = label.replace(/^\.\.\.\s*/, '');
        
        const indicatorSpan = document.createElement("span");
        indicatorSpan.className = "slot-indicator";
        indicatorSpan.textContent = "...";
        element.appendChild(indicatorSpan);
        
        const labelSpan = document.createElement("span");
        labelSpan.className = "slot-label";
        labelSpan.textContent = cleanLabel;
        if (labelColor) {
          labelSpan.style.color = labelColor;
        }
        element.appendChild(labelSpan);
        
        element.dataset.coordinates = coords;
      } else {
        const coordsSpan = document.createElement("span");
        coordsSpan.className = "slot-coords";
        coordsSpan.textContent = coords;
        element.appendChild(coordsSpan);
      }
      
      const hiddenCoordsSpan = document.createElement("span");
      hiddenCoordsSpan.className = "slot-coords-hidden";
      hiddenCoordsSpan.textContent = coords;
      element.appendChild(hiddenCoordsSpan);
      
      const slotItem = element.closest('.saved-slot-item');
      if (slotItem) {
        slotItem.addEventListener('mouseenter', () => {
          hiddenCoordsSpan.scrollLeft = hiddenCoordsSpan.scrollWidth;
        });
      }
      
      element.scrollTop = 0;
    }

    static updateActiveIndicator() {
      const indicator = document.getElementById("slot-indicator");
      const activeSlot = document.querySelector(".saved-slot-item.selected-saved");
      
      if (indicator && activeSlot) {
        indicator.style.position = "absolute";
        indicator.style.top = activeSlot.offsetTop + "px";
        indicator.style.left = activeSlot.offsetLeft + "px";
        indicator.style.width = activeSlot.offsetWidth + "px";
        indicator.style.height = activeSlot.offsetHeight + "px";
        indicator.style.pointerEvents = "none";
      }
    }

    static selectSlot(slotNumber) {
      // Remove selection from all slots
      document.querySelectorAll(".saved-slot-item").forEach((slot) => {
        slot.classList.remove("selected-saved");
      });
      
      // Select the target slot
      const activeSlot = document.getElementById("slot-saved-coords-" + slotNumber);
      if (activeSlot) {
        activeSlot.classList.add("selected-saved");
        this.updateActiveIndicator();
        
        const inner = activeSlot.querySelector(".slot-inner") || activeSlot;
        if (inner) {
          // Store active slot in global variable for compatibility
          if (typeof window !== 'undefined') {
            window.activeSavedFieldId = inner.id;
          }
          UIComponents.Logger.log(`Slot ${slotNumber} selected`, "info");
        }
      }
    }
  };

  static Clipboard = class {
    
    static async copy(text) {
      try {
        await navigator.clipboard.writeText(text);
        UIComponents.Logger.log("Coordinates copied to clipboard", "success");
        return true;
      } catch (error) {
        UIComponents.Logger.log("Clipboard write error", "error");
        return false;
      }
    }

    static async read() {
      try {
        const text = await navigator.clipboard.readText();
        return text;
      } catch (error) {
        // UIComponents.Logger.log("Clipboard read error: " + error, "error");
        return null;
      }
    }
  };

  static CoordinateDisplay = class {
    
    static _cliOutput = null;

    static init() {
      this._cliOutput = document.getElementById("cli-output");
    }

    static display(coords, format = 'cli') {
      if (!this._cliOutput || !window.CoordinateParser) return;
      
      const formattedString = format === 'url'
        ? window.CoordinateParser.formatToUrlFormat(coords)
        : window.CoordinateParser.formatToCli(coords);
      this._cliOutput.value = formattedString;
    }

    static getText() {
      return this._cliOutput ? this._cliOutput.value : "";
    }

    static clear() {
      if (this._cliOutput) {
        this._cliOutput.value = "";
      }
    }
  };

  static init() {
    this.Logger.init();
    this.CoordinateDisplay.init();
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIComponents;
} else {
  window.UIComponents = UIComponents;
}
