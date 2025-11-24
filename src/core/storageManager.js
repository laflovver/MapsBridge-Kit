"use strict";

class StorageManager {
  
  static STORAGE_KEY = "recentCoordinates";
  static MAX_SLOTS = 4;

  static async getAllSlots() {
    try {
      const result = await chrome.storage.local.get({ [this.STORAGE_KEY]: [] });
      const slots = result[this.STORAGE_KEY] || [];
      
      while (slots.length < this.MAX_SLOTS) {
        slots.push(null);
      }
      
      return slots;
    } catch (error) {
      console.error("Error getting slots from storage:", error);
      return new Array(this.MAX_SLOTS).fill(null);
    }
  }

  static async getSlot(slotIndex) {
    if (slotIndex < 0 || slotIndex >= this.MAX_SLOTS) {
      throw new Error(`Invalid slot index: ${slotIndex}`);
    }
    
    const slots = await this.getAllSlots();
    return slots[slotIndex];
  }

  static async setSlot(slotIndex, slotData) {
    if (slotIndex < 0 || slotIndex >= this.MAX_SLOTS) {
      throw new Error(`Invalid slot index: ${slotIndex}`);
    }

    try {
      const slots = await this.getAllSlots();
      slots[slotIndex] = slotData;
      
      await chrome.storage.local.set({ [this.STORAGE_KEY]: slots });
      return true;
    } catch (error) {
      console.error("Error saving slot to storage:", error);
      return false;
    }
  }

  static async updateSlotCoordinates(slotIndex, coordinates) {
    const currentSlot = await this.getSlot(slotIndex);
    const updatedSlot = currentSlot ? 
      { ...currentSlot, ...coordinates } : 
      { ...coordinates, name: "", labelColor: "" };
    
    return this.setSlot(slotIndex, updatedSlot);
  }

  static async updateSlotLabel(slotIndex, name, labelColor = "") {
    if (slotIndex === 0) {
      console.warn("Cannot update label for slot 0 (auto-extracted)");
      return false;
    }

    const currentSlot = await this.getSlot(slotIndex);
    if (!currentSlot) {
      console.warn(`Cannot update label for empty slot ${slotIndex}`);
      return false;
    }

    const updatedSlot = { 
      ...currentSlot, 
      name: name.trim(),
      labelColor: labelColor || currentSlot.labelColor || ""
    };
    
    return this.setSlot(slotIndex, updatedSlot);
  }

  static async clearSlot(slotIndex) {
    return this.setSlot(slotIndex, null);
  }

  static async clearAllSlots() {
    try {
      await chrome.storage.local.set({ [this.STORAGE_KEY]: new Array(this.MAX_SLOTS).fill(null) });
      return true;
    } catch (error) {
      console.error("Error clearing all slots:", error);
      return false;
    }
  }

  static createSlotFromCli(coordString, name = "", labelColor = "") {
    if (!window.CoordinateParser) {
      console.error("CoordinateParser not available");
      return null;
    }

    const coordinates = window.CoordinateParser.parseFromAnyFormat(coordString);
    if (!coordinates) {
      return null;
    }

    return {
      ...coordinates,
      name: name.trim(),
      labelColor: labelColor
    };
  }

  static formatSlotToCli(slot) {
    if (!slot || !window.CoordinateParser) {
      return "";
    }

    return window.CoordinateParser.formatToCli(slot);
  }

  static getSlotDisplayText(slot, slotIndex) {
    if (!slot) {
      return `Coordinate slot ${slotIndex} ...`;
    }

    const cliStr = this.formatSlotToCli(slot);
    return slot.name ? `${slot.name} - ${cliStr}` : cliStr;
  }

  static onStorageChanged(callback) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes[this.STORAGE_KEY]) {
        callback(changes[this.STORAGE_KEY].newValue || []);
      }
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
} else {
  window.StorageManager = StorageManager;
}
