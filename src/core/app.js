"use strict";

/**
 * Main Coordinate Extractor application class
 * Coordinates all modules
 */
class CoordinateExtractorApp {
  
  constructor() {
    this.activeSlotId = "saved-coords-0";
    this.hotkeysDisabled = false;
    this.clipboardCoords = null;
    
    this.slotIds = [
      "saved-coords-0",
      "saved-coords-1", 
      "saved-coords-2",
      "saved-coords-3"
    ];
    
    this.serviceModal = null;
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      if (typeof UIComponents === 'undefined') {
        throw new Error("UIComponents is not defined");
      }
      UIComponents.init();
      
      this.setupEventListeners();
      window.appInstance = this;
      
      if (chrome.runtime && chrome.runtime.sendMessage && !this._popupReadySent) {
        this._popupReadySent = true;
        setTimeout(() => {
          chrome.runtime.sendMessage('popup-ready').catch(() => {});
        }, 100);
      }
      this.loadStoredCoordinates().catch(err => {
        console.error("Error loading stored coordinates:", err);
      });
      
      if (typeof ServiceModal !== 'undefined') {
        this.serviceModal = new ServiceModal();
        this.serviceModal.init().then(() => {
          window.serviceModalInstance = this.serviceModal;
        }).catch(err => {
          console.error("Error initializing service modal:", err);
        });
      }
      
      this.extractCurrentTabCoordinates().catch(err => {
        console.error("Error extracting coordinates:", err);
      });
      
    } catch (error) {
      console.error("App initialization error:", error);
      if (chrome.runtime && chrome.runtime.sendMessage && !this._popupReadySent) {
        this._popupReadySent = true;
        chrome.runtime.sendMessage('popup-ready').catch(() => {});
      }
    }
  }
  
  /**
   * Get active slot coordinates
   * For slots 1-3: returns coordinates from that slot
   * For slot 0 or if active slot is empty: returns coordinates from slot 0 (fallback)
   * @returns {Promise<Object|null>} Coordinates object or null if none found
   */
  async getActiveSlotCoordinates() {
    if (this.activeSlotId && this.activeSlotId !== "saved-coords-0") {
      const slotIndex = parseInt(this.activeSlotId.split("-").pop(), 10);
      const slot = await StorageManager.getSlot(slotIndex);
      if (slot && slot.lat && slot.lon) {
        return slot;
      }
    }
    
    const slot0 = await StorageManager.getSlot(0);
    if (slot0 && slot0.lat && slot0.lon) {
      return slot0;
    }
    
    return null;
  }


  /**
   * Load saved coordinates from storage
   */
  async loadStoredCoordinates() {
    const slots = await StorageManager.getAllSlots();
    
    this.slotIds.forEach((id, index) => {
      const element = document.getElementById(id);
      if (element) {
        const slot = slots[index];
        const displayText = StorageManager.getSlotDisplayText(slot, index);
        
        if (slot) {
          UIComponents.SlotRenderer.renderContent(element, displayText, slot.labelColor || "");
        } else {
          element.innerHTML = "";
          element.textContent = displayText;
        }
      }
    });

    this.attachSlotEventListeners();
    this.attachEditFunctionality();
    this.setupScrollSnapping();
    
    UIComponents.SlotRenderer.updateActiveIndicator();
  }

  /**
   * Handle keys in input fields
   */
  handleInputFieldKeys(e) {
    if ((e.code === "Delete" || e.code === "Backspace") && this.activeSlotId) {
      e.preventDefault();
      this.clearActiveSlot();
    }
  }

  /**
   * Handle global hotkeys
   */
  handleGlobalHotkeys(e) {
    switch (e.code) {
      case "KeyC":
        e.preventDefault();
        this.handleCopyToClipboard();
        break;
      case "KeyV":
        e.preventDefault();
        this.handlePasteFromClipboard();
        break;
      case "KeyG":
        e.preventDefault();
        this.handleNavigateToCoordinates();
        break;
      case "KeyE":
      case "KeyУ": // Russian layout
        e.preventDefault();
        this.handleEditSlot();
        break;
      case "KeyQ":
      case "KeyЙ": // Russian layout
        e.preventDefault();
        this.selectSlot(0);
        break;
      case "Digit1":
        e.preventDefault();
        this.selectSlot(1);
        break;
      case "Digit2":
        e.preventDefault();
        this.selectSlot(2);
        break;
      case "Digit3":
        e.preventDefault();
        this.selectSlot(3);
        break;
      case "Backspace":
      case "Delete":
        e.preventDefault();
        console.log('Clear slot hotkey pressed, activeSlotId:', this.activeSlotId);
        this.clearActiveSlot();
        break;
    }
  }

  /**
   * Copy coordinates to clipboard
   */
  async handleCopyToClipboard() {
    try {
      const coords = await this.getActiveSlotCoordinates();
      if (!coords) {
        return;
      }

      const cliString = CoordinateParser.formatToCli(coords);
      await navigator.clipboard.writeText(cliString);
    } catch (error) {
      console.error("Clipboard error:", error);
    }
  }


  /**
   * Add location name to coordinates (runs in background)
   * @param {Object} coords - Coordinates
   * @param {number} slotIndex - Slot index
   */
  async addLocationName(coords, slotIndex) {
    try {
      if (typeof Geocoder === 'undefined') {
        return;
      }
      
      const currentSlot = await StorageManager.getSlot(slotIndex);
      if (currentSlot && currentSlot.userNamed) {
        console.log('Slot has user-defined name, skipping geocoding');
        return;
      }
      
      if (currentSlot && (
        currentSlot.lat !== coords.lat || 
        currentSlot.lon !== coords.lon
      )) {
        console.log('Coordinates changed, skipping geocoding for old coordinates');
        return;
      }
      
      const slotElement = document.getElementById(`saved-coords-${slotIndex}`);
      if (slotElement) {
        slotElement.textContent = 'Loading location...';
      }
      
      const locationName = await Geocoder.reverseGeocode(coords.lat, coords.lon);
      
      const slotAfterGeocoding = await StorageManager.getSlot(slotIndex);
      if (!slotAfterGeocoding) {
        return;
      }
      
      if (slotAfterGeocoding.userNamed) {
        console.log('Slot was manually named during geocoding, skipping update');
        return;
      }
      
      if (slotAfterGeocoding.lat !== coords.lat || slotAfterGeocoding.lon !== coords.lon) {
        console.log('Coordinates changed during geocoding, skipping update');
        return;
      }
      
      if (locationName) {
        const shortName = Geocoder.createShortName(locationName);
        
        const updatedCoords = {
          ...slotAfterGeocoding,
          name: shortName,
          fullName: locationName,
          userNamed: false
        };
        
        await StorageManager.setSlot(slotIndex, updatedCoords);
        
        const element = document.getElementById(`saved-coords-${slotIndex}`);
        if (element) {
          const updatedSlot = await StorageManager.getSlot(slotIndex);
          const displayText = StorageManager.getSlotDisplayText(updatedSlot, slotIndex);
          UIComponents.SlotRenderer.renderContent(element, displayText, updatedSlot?.labelColor);
        }
      } else {
        const element = document.getElementById(`saved-coords-${slotIndex}`);
        if (element && slotAfterGeocoding) {
          const displayText = StorageManager.getSlotDisplayText(slotAfterGeocoding, slotIndex);
          UIComponents.SlotRenderer.renderContent(element, displayText, slotAfterGeocoding?.labelColor);
        }
      }
    } catch (error) {
      console.error('Error adding location name:', error);
      try {
        const element = document.getElementById(`saved-coords-${slotIndex}`);
        if (element) {
          const slot = await StorageManager.getSlot(slotIndex);
          if (slot) {
            const displayText = StorageManager.getSlotDisplayText(slot, slotIndex);
            UIComponents.SlotRenderer.renderContent(element, displayText, slot?.labelColor);
          }
        }
      } catch (restoreError) {
        console.error('Error restoring slot display:', restoreError);
      }
    }
  }
  
  
  /**
   * Navigation to coordinates
   * Uses coordinates from active slot (via getActiveSlotCoordinates)
   */
  async handleNavigateToCoordinates() {
    const coords = await this.getActiveSlotCoordinates();
    if (!coords || !coords.lat || !coords.lon) {
      UIComponents.Logger.log("No coordinates available", "error");
      return;
    }

    try {
      await BrowserManager.updateActiveTabWithCoordinates(coords);
      UIComponents.Logger.log("URL updated successfully", "success");
    } catch (error) {
      console.error("Navigation error:", error);
      UIComponents.Logger.log("Navigation error: " + error.message, "error");
    }
  }

  /**
   * Slot editing
   */
  handleEditSlot() {
    this.editActiveSlotLabel();
  }

  /**
   * Slot selection
   */
  selectSlot(slotIndex) {
    this.activeSlotId = `saved-coords-${slotIndex}`;
    this.updateSlotSelection();
  }

  /**
   * Clear active slot
   */
  async clearActiveSlot() {
    if (!this.activeSlotId) {
      console.log('No active slot to clear');
      return;
    }

    const slotIndex = this.getActiveSlotIndex();
    console.log('Clearing slot:', slotIndex);
    await StorageManager.setSlot(slotIndex, null);
    this.refreshUI();
  }

  /**
   * Get active slot index
   * @returns {number} Slot index (0-3)
   */
  getActiveSlotIndex() {
    return parseInt(this.activeSlotId.split('-').pop(), 10);
  }

  /**
   * Update slot visual selection
   */
  updateSlotSelection() {
    document.querySelectorAll('.saved-slot-item').forEach(item => {
      item.classList.remove('selected-saved');
    });

    const activeSlot = document.getElementById(`slot-${this.activeSlotId}`);
    if (activeSlot) {
      activeSlot.classList.add('selected-saved');
    }
  }

  /**
   * Parse CLI string to coordinates object
   * @param {string} cliString - CLI formatted string
   * @returns {Object|null} Coordinates object or null if parsing failed
   */
  parseCLIString(cliString) {
    if (typeof window !== 'undefined' && window.CliParser) {
      return window.CliParser.parse(cliString);
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
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Refresh UI by reloading stored coordinates
   */
  refreshUI() {
    this.loadStoredCoordinates().catch(err => {
      console.error("Error refreshing UI:", err);
    });
  }

  /**
   * Extract coordinates from active tab URL
   */
  async extractCurrentTabCoordinates() {
    const currentUrl = await BrowserManager.getActiveTabUrl();
    
    if (!currentUrl) {
      UIComponents.Logger.log("Could not get active tab URL", "warning");
      return;
    }

    const coords = CoordinateParser.extractFromUrl(currentUrl);
    
    if (coords) {
      await StorageManager.setSlot(0, { ...coords, name: "", labelColor: "" });
      UIComponents.CoordinateDisplay.display(coords);
      this.clipboardCoords = coords;
      const slot0Element = document.getElementById("saved-coords-0");
      if (slot0Element) {
        const cliString = CoordinateParser.formatToCli(coords);
        UIComponents.SlotRenderer.renderContent(slot0Element, cliString);
      }
      
      UIComponents.Logger.log(`Coordinates extracted: ${coords.lat}, ${coords.lon}, zoom: ${coords.zoom}`, "success");
    } else {
      const slot0Element = document.getElementById("saved-coords-0");
      if (slot0Element) {
        slot0Element.textContent = "Coordinates not found";
      }
      UIComponents.Logger.log(`Could not extract coordinates from URL: ${currentUrl}`, "warning");
    }
  }

  /**
   * Setup event handlers for main buttons
   */
  setupEventListeners() {
    this.setupCopyButton();
    this.setupPasteButton();
    this.setupNavigateButton();
    this.setupKeyboardShortcuts();
  }

  setupCopyButton() {
    const copyBtn = document.getElementById("copy-cli");
    if (!copyBtn) return;

    copyBtn.addEventListener("click", async () => {
      UIComponents.Utils.animateButton(copyBtn);
      
      let textToCopy = "";
      
      if (this.activeSlotId && this.activeSlotId !== "saved-coords-0") {
        const element = document.getElementById(this.activeSlotId);
        if (element) {
          if (element.dataset.coordinates) {
            textToCopy = element.dataset.coordinates;
          } else {
            const coordsSpan = element.querySelector(".slot-coords");
            textToCopy = coordsSpan ? coordsSpan.textContent : element.textContent;
          }
        }
      } else {
        textToCopy = UIComponents.CoordinateDisplay.getText();
      }

      await UIComponents.Clipboard.copy(textToCopy);
    });
  }

  setupPasteButton() {
    const pasteBtn = document.getElementById("paste-coords");
    if (!pasteBtn) return;

    pasteBtn.addEventListener("click", async () => {
      UIComponents.Utils.animateButton(pasteBtn);
      
      const text = await UIComponents.Clipboard.read();
      if (!text) return;

      const coords = CoordinateParser.parseFromCli(text);
      if (coords) {
        const formatted = CoordinateParser.formatToCli(coords);
        
        if (this.activeSlotId && this.activeSlotId !== "saved-coords-0") {
          const slotIndex = parseInt(this.activeSlotId.split("-").pop(), 10);
          const currentSlot = await StorageManager.getSlot(slotIndex);
          
          await StorageManager.setSlot(slotIndex, {
            ...coords,
            name: currentSlot?.name || "",
            labelColor: currentSlot?.labelColor || "",
            userNamed: currentSlot?.userNamed || false
          });
          
          const element = document.getElementById(this.activeSlotId);
          if (element) {
            const savedSlot = await StorageManager.getSlot(slotIndex);
            const displayText = StorageManager.getSlotDisplayText(savedSlot, slotIndex);
            UIComponents.SlotRenderer.renderContent(element, displayText, currentSlot?.labelColor);
          }
          
          if (slotIndex > 0 && coords.lat && coords.lon) {
            this.addLocationName(coords, slotIndex).catch(err => {
              console.error('Background geocoding failed:', err);
            });
          }
        } else {
          const element = document.getElementById("saved-coords-0");
          if (element) {
            UIComponents.SlotRenderer.renderContent(element, formatted);
          }
        }
        
        this.clipboardCoords = coords;
        UIComponents.Logger.log("Coordinates pasted from clipboard", "success");
      } else {
        UIComponents.Logger.log("Failed to parse coordinates", "error");
      }
    });
  }

  setupNavigateButton() {
    const navigateBtn = document.getElementById("navigate-url");
    if (!navigateBtn) return;

    const goText = navigateBtn.querySelector(".go-text");
    const goArrow = navigateBtn.querySelector(".go-arrow");
    const buttonHotkey = navigateBtn.querySelector(".button-hotkey");
    
    if (!goText || !goArrow || !buttonHotkey) return;
    
    let typewriterTimeout = null;
    let isTyping = false;
    const originalGoText = goText.textContent || "Go";
    
    const typeWriter = (text, element, speed = 30) => {
      if (isTyping) return;
      isTyping = true;
      element.textContent = "";
      let i = 0;
      
      const type = () => {
        if (i < text.length) {
          element.textContent += text.charAt(i);
          i++;
          typewriterTimeout = setTimeout(type, speed);
        } else {
          isTyping = false;
        }
      };
      
      type();
    };
    
    const showRandomMessage = () => {
      if (typewriterTimeout) {
        clearTimeout(typewriterTimeout);
        typewriterTimeout = null;
      }
      
      goArrow.style.opacity = "0";
      buttonHotkey.style.opacity = "0";
      
      const message = GoButtonMessages.getRandomMessage();
      typeWriter(message, goText, 30);
    };
    
    const restoreOriginal = () => {
      if (typewriterTimeout) {
        clearTimeout(typewriterTimeout);
        typewriterTimeout = null;
      }
      
      goText.textContent = originalGoText;
      goArrow.style.opacity = "1";
      buttonHotkey.style.opacity = "1";
      isTyping = false;
    };
    
    navigateBtn.addEventListener("mouseenter", () => {
      showRandomMessage();
    });
    
    navigateBtn.addEventListener("mouseleave", () => {
      restoreOriginal();
    });

    navigateBtn.addEventListener("click", async () => {
      UIComponents.Utils.animateButton(navigateBtn);
      
      let coordsToUse = null;

      if (this.activeSlotId && this.activeSlotId !== "saved-coords-0") {
        const slotIndex = parseInt(this.activeSlotId.split("-").pop(), 10);
        const slot = await StorageManager.getSlot(slotIndex);
        if (slot && slot.lat && slot.lon) {
          coordsToUse = slot;
        }
      }

      if (!coordsToUse) {
        coordsToUse = this.clipboardCoords;
      }

      if (!coordsToUse || !coordsToUse.lat || !coordsToUse.lon) {
        UIComponents.Logger.log("No coordinates available", "error");
        return;
      }

      const success = await BrowserManager.updateActiveTabWithCoordinates(coordsToUse);
      if (!success) {
        UIComponents.Logger.log("URL structure not supported", "error");
      } else {
        UIComponents.Logger.log("URL updated successfully", "success");
      }
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (this.hotkeysDisabled) return;
      
      const tag = e.target.tagName.toLowerCase();
      if ((tag === "input" || tag === "textarea") && e.target.id !== this.activeSlotId) {
        return;
      }

      switch (e.code) {
        case "KeyC":
          e.preventDefault();
          document.getElementById("copy-cli")?.click();
          break;
          
        case "KeyV":
          e.preventDefault();
          document.getElementById("paste-coords")?.click();
          break;
          
        case "KeyG":
          e.preventDefault();
          document.getElementById("navigate-url")?.click();
          break;
          
        case "KeyE":
          e.preventDefault();
          this.editActiveSlotLabel();
          break;
          
        case "Digit1":
        case "Digit2":
        case "Digit3":
        case "Digit4":
          if (e.altKey || e.metaKey) {
            e.preventDefault();
            const slotNumber = parseInt(e.code.replace("Digit", ""), 10);
            this.selectSlot(slotNumber);
          }
          break;
      }
    });
  }

  /**
   * Setup event handlers for coordinate slots
   */
  attachSlotEventListeners() {
    this.slotIds.forEach((innerId, index) => {
      const inner = document.getElementById(innerId);
      if (!inner) return;

      inner.setAttribute("tabindex", "0");
      const slotContainer = inner.closest(".saved-slot-item");
      
      if (slotContainer) {
        slotContainer.addEventListener("click", () => {
          this.selectSlot(index);
        });

        slotContainer.addEventListener("keydown", (e) => {
          if (e.code === "Delete") {
            this.clearSlot(index);
          }
        });
      }
    });
  }


  /**
   * Clear slot by index
   * @param {number} slotIndex - Slot index to clear
   */
  async clearSlot(slotIndex) {
    await StorageManager.clearSlot(slotIndex);
    
    const element = document.getElementById(`saved-coords-${slotIndex}`);
    if (element) {
      element.textContent = `Coordinate slot ${slotIndex} ...`;
    }
    
    UIComponents.Logger.log(`Slot ${slotIndex} cleared`, "info");
  }

  /**
   * Edit active slot label
   */
  editActiveSlotLabel() {
    const activeSlot = document.querySelector(".saved-slot-item.selected-saved");
    if (activeSlot && activeSlot.id !== "slot-saved-coords-0") {
      const editBtn = activeSlot.querySelector(".edit-btn");
      if (editBtn) {
        editBtn.click();
      }
    }
  }

  /**
   * Setup slot label editing functionality
   */
  attachEditFunctionality() {
    // Add hotkey handler for editing
    document.addEventListener("keydown", (e) => {
      if (e.code === "KeyE" && !this.hotkeysDisabled) {
        this.editActiveSlotLabel();
      }
    });

    document.querySelectorAll(".saved-slot-item .edit-btn").forEach((btn) => {
      const slot = btn.closest(".saved-slot-item");
      
      if (slot && slot.id === "slot-saved-coords-0") {
        btn.style.display = "none";
        return;
      }

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.startEditingSlotLabel(btn, slot);
      });
    });
  }

  /**
   * Start slot label editing process
   * @param {HTMLElement} btn - Edit button
   * @param {HTMLElement} slot - Slot element
   */
  startEditingSlotLabel(btn, slot) {
    if (!slot || slot.querySelector(".label-input")) return;

    btn.classList.add("edit-animate");
    btn.addEventListener("animationend", () => {
      btn.classList.remove("edit-animate");
    }, { once: true });

    this.hotkeysDisabled = true;

    const inner = slot.querySelector(".slot-inner") || slot;
    
    let currentLabel = "";
    const labelSpan = inner.querySelector(".slot-label");
    if (labelSpan) {
      currentLabel = labelSpan.textContent.replace(" - ", "");
    } else if (btn.dataset.label) {
      currentLabel = btn.dataset.label;
    }

    const originalContent = inner.innerHTML;
    inner.dataset.originalContent = originalContent;
    
    let labelColor = btn.dataset.labelColor;
    if (!labelColor) {
      labelColor = UIComponents.Utils.getRandomReadableColor();
      btn.dataset.labelColor = labelColor;
    }
    
    const input = document.createElement("input");
    input.type = "text";
    input.value = currentLabel;
    input.classList.add("label-input");
    Object.assign(input.style, {
      width: "100%",
      height: "100%",
      padding: "var(--space-md)",
      paddingRight: "120px",
      background: "var(--white)",
      border: "1px solid var(--primary)",
      borderRadius: "var(--border-radius)",
      fontFamily: "'Roboto Mono', monospace",
      fontSize: "11px",
      color: labelColor,
      outline: "none",
      boxSizing: "border-box",
      margin: "0",
      position: "relative"
    });
    
    inner.innerHTML = "";
    inner.appendChild(input);
    input.focus();
    input.setSelectionRange(0, input.value.length);

    const finishEditing = async () => {
      const newLabel = input.value.trim();
      btn.dataset.label = newLabel;
      
      const slotIndex = parseInt(inner.id.split("-").pop(), 10);
      await StorageManager.updateSlotLabel(slotIndex, newLabel, btn.dataset.labelColor);
      
      // Redraw slot with new label
      const slotData = await StorageManager.getSlot(slotIndex);
      if (slotData) {
        const displayText = StorageManager.getSlotDisplayText(slotData, slotIndex);
        UIComponents.SlotRenderer.renderContent(inner, displayText, btn.dataset.labelColor);
      }
      
      this.hotkeysDisabled = false;
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finishEditing();
      } else if (e.key === "Escape") {
        e.preventDefault();
        inner.innerHTML = originalContent;
        this.hotkeysDisabled = false;
      }
    });

    input.addEventListener("blur", finishEditing);
  }

  /**
   * Setup snap scrolling for slots
   */
  setupScrollSnapping() {
    document.querySelectorAll(".saved-slot-item .slot-inner").forEach((inner) => {
      inner.addEventListener("scroll", () => {
        clearTimeout(inner.snapTimeout);
        inner.snapTimeout = setTimeout(() => {
          UIComponents.Utils.snapScroll(inner);
        }, 100);
      });
    });
  }



}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CoordinateExtractorApp;
} else {
  window.CoordinateExtractorApp = CoordinateExtractorApp;
}
document.addEventListener("DOMContentLoaded", () => {
  if (typeof CoordinateExtractorApp !== 'undefined') {
    const app = new CoordinateExtractorApp();
    app.init().catch(error => {
      console.error('Failed to initialize app:', error);
    });
  } else {
    console.error('CoordinateExtractorApp is not defined');
  }
});
