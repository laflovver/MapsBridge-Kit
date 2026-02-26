"use strict";

class UndoStack {
  constructor(maxSize = 10) {
    this.maxSize = maxSize;
    this.stack = [];
    this.position = -1;
  }

  push(action) {
    // Remove any actions after current position (redo history)
    this.stack = this.stack.slice(0, this.position + 1);

    // Add new action
    this.stack.push(action);

    // Maintain max size
    if (this.stack.length > this.maxSize) {
      this.stack.shift();
    } else {
      this.position++;
    }
  }

  canUndo() {
    return this.position >= 0;
  }

  canRedo() {
    return this.position < this.stack.length - 1;
  }

  undo() {
    if (!this.canUndo()) return null;
    const action = this.stack[this.position];
    this.position--;
    return action;
  }

  redo() {
    if (!this.canRedo()) return null;
    this.position++;
    return this.stack[this.position];
  }

  clear() {
    this.stack = [];
    this.position = -1;
  }
}

class StorageManager {

  static STORAGE_KEY = "recentCoordinates";
  static MAX_SLOTS = 4;
  static _undoStack = new UndoStack(10);

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

  static async setSlot(slotIndex, slotData, skipUndo = false) {
    if (slotIndex < 0 || slotIndex >= this.MAX_SLOTS) {
      throw new Error(`Invalid slot index: ${slotIndex}`);
    }

    try {
      const slots = await this.getAllSlots();
      const previousData = slots[slotIndex];

      // Record undo action (don't record for slot 0 which is auto-extracted)
      if (!skipUndo && slotIndex > 0) {
        this._undoStack.push({
          type: 'setSlot',
          slotIndex,
          previousData,
          newData: slotData,
          timestamp: Date.now()
        });
      }

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

  // Undo/Redo functionality
  static async undo() {
    const action = this._undoStack.undo();
    if (!action) return false;

    if (action.type === 'setSlot') {
      await this.setSlot(action.slotIndex, action.previousData, true);
      return true;
    }
    return false;
  }

  static async redo() {
    const action = this._undoStack.redo();
    if (!action) return false;

    if (action.type === 'setSlot') {
      await this.setSlot(action.slotIndex, action.newData, true);
      return true;
    }
    return false;
  }

  static canUndo() {
    return this._undoStack.canUndo();
  }

  static canRedo() {
    return this._undoStack.canRedo();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
} else {
  window.StorageManager = StorageManager;
}
