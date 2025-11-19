chrome.action.onClicked.addListener(async () => {
  console.log("Extension icon clicked (popup handled by manifest)");
});

console.log("Background service worker loaded");

// Loading animation state
let loadingAnimationInterval = null;
let loadingAnimationStep = 0;
let originalIconPath = null;
let iconBitmap = null;
const ANIMATION_STEPS = 12; // 12 steps = 30 degrees per step
const ANIMATION_SPEED = 100; // ms per step

/**
 * Load original icon image as ImageBitmap
 */
async function loadOriginalIcon() {
  if (iconBitmap) return iconBitmap;
  
  try {
    const iconUrl = chrome.runtime.getURL('image.png');
    const response = await fetch(iconUrl);
    const blob = await response.blob();
    iconBitmap = await createImageBitmap(blob);
    
    return iconBitmap;
  } catch (error) {
    console.error('Error loading icon:', error);
    return null;
  }
}

/**
 * Start loading animation by rotating icon
 */
async function startLoadingAnimation() {
  // Clear any existing animation
  await stopLoadingAnimation();
  
  // Store original icon path
  if (!originalIconPath) {
    originalIconPath = chrome.runtime.getURL('image.png');
  }
  
  // Load icon if not loaded
  const bitmap = await loadOriginalIcon();
  
  if (!bitmap) {
    console.error('Failed to load icon for animation');
    return;
  }
  
  loadingAnimationStep = 0;
  loadingAnimationInterval = setInterval(async () => {
    const degrees = (loadingAnimationStep * 360) / ANIMATION_STEPS;
    
    try {
      const canvas = new OffscreenCanvas(128, 128);
      const ctx = canvas.getContext('2d');
      
      ctx.clearRect(0, 0, 128, 128);
      ctx.save();
      ctx.translate(64, 64);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(bitmap, -64, -64);
      ctx.restore();
      
      const imageData = ctx.getImageData(0, 0, 128, 128);
      await chrome.action.setIcon({ imageData: { 128: imageData } });
    } catch (error) {
      console.error('Error rotating icon:', error);
    }
    
    loadingAnimationStep = (loadingAnimationStep + 1) % ANIMATION_STEPS;
  }, ANIMATION_SPEED);
}

/**
 * Stop loading animation and restore original icon
 */
async function stopLoadingAnimation() {
  if (loadingAnimationInterval) {
    clearInterval(loadingAnimationInterval);
    loadingAnimationInterval = null;
  }
  
  if (originalIconPath) {
    try {
      await chrome.action.setIcon({ path: originalIconPath });
    } catch (error) {
      console.error('Error restoring icon:', error);
    }
  } else {
    try {
      await chrome.action.setIcon({ path: 'image.png' });
    } catch (error) {
      console.error('Error restoring icon:', error);
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed/updated, commands should be registered");
  stopLoadingAnimation();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Message received in background:", message);
  
  if (message === 'popup-ready' || message.type === 'popup-ready') {
    stopLoadingAnimation();
    sendResponse({ status: 'ok' });
    return true;
  }
  
  return true;
});
chrome.commands.onCommand.addListener(async (command) => {
  console.log("Command received:", command);
  
  if (command === "open-extension") {
    console.log("Opening extension via keyboard shortcut...");
    
    startLoadingAnimation();
    
    const extensionUrl = chrome.runtime.getURL('popup.html');
    
    const windows = await chrome.windows.getAll({ populate: true });
    const existingPopup = windows.find(win => {
      if (win.type === 'popup' && win.tabs && win.tabs.length > 0) {
        return win.tabs.some(tab => tab.url === extensionUrl);
      }
      return false;
    });
    
    if (existingPopup) {
      await chrome.windows.update(existingPopup.id, { focused: true });
      console.log("Focused existing popup window");
      stopLoadingAnimation();
      return;
    }
    
    try {
      try {
        await chrome.action.openPopup();
        console.log("Popup opened via action.openPopup (Arc Browser?)");
        setTimeout(() => stopLoadingAnimation(), 3000);
        return;
      } catch (popupError) {
        console.log("action.openPopup not available, using window method");
      }
      
      const popupWindow = await chrome.windows.create({
        url: extensionUrl,
        type: 'popup',
        width: 680,
        height: 720,
        focused: true
      });
      console.log("Extension opened in popup window, window ID:", popupWindow.id);
      setTimeout(() => stopLoadingAnimation(), 3000);
    } catch (windowError) {
      console.error("Error opening extension via command:", windowError);
      stopLoadingAnimation();
    }
  } else {
    console.log("Unknown command:", command);
  }
});
