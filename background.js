chrome.action.onClicked.addListener(async () => {
  console.log("Extension icon clicked (popup handled by manifest)");
});

console.log("Background service worker loaded");

// Constants
const ANIMATION_STEPS = 12; // 12 steps = 30 degrees per step
const ANIMATION_SPEED_MS = 100; // ms per step

// Animation state (transient - OK for short animations)
// Service worker stays alive during animation (only 1-3 seconds)
let animationInterval = null;
let animationStep = 0;
let iconBitmap = null;

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
 * Note: Uses setInterval which is OK for short animations (1-3 seconds)
 * Service worker stays alive during this period
 */
async function startLoadingAnimation() {
  // Stop any existing animation
  await stopLoadingAnimation();

  // Load icon if not loaded
  const bitmap = await loadOriginalIcon();
  if (!bitmap) {
    console.error('Failed to load icon for animation');
    return;
  }

  animationStep = 0;
  animationInterval = setInterval(async () => {
    const degrees = (animationStep * 360) / ANIMATION_STEPS;

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

      animationStep = (animationStep + 1) % ANIMATION_STEPS;
    } catch (error) {
      console.error('Error rotating icon:', error);
      await stopLoadingAnimation();
    }
  }, ANIMATION_SPEED_MS);

  console.log('Animation started');
}

/**
 * Stop loading animation and restore original icon
 */
async function stopLoadingAnimation() {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }

  animationStep = 0;

  // Restore original icon
  try {
    await chrome.action.setIcon({ path: 'image.png' });
  } catch (error) {
    console.error('Error restoring icon:', error);
  }

  console.log('Animation stopped');
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

    try {
      // Get current window
      const currentWindow = await chrome.windows.getCurrent();
      const currentTab = await chrome.tabs.query({ active: true, windowId: currentWindow.id });

      if (currentTab && currentTab.length > 0) {
        // Try to open popup relative to current tab
        try {
          await chrome.action.openPopup({ windowId: currentWindow.id });
          console.log("Popup opened successfully");
          setTimeout(() => stopLoadingAnimation(), 1000);
          return;
        } catch (popupError) {
          console.log("openPopup failed, trying alternative method:", popupError.message);
        }
      }

      // Fallback: Create small window centered on current window
      console.log("Using fallback: creating small window");
      const popupWindow = await chrome.windows.create({
        url: chrome.runtime.getURL('popup.html'),
        type: 'popup',
        width: 680,
        height: 720,
        focused: true,
        left: currentWindow.left + Math.floor((currentWindow.width - 680) / 2),
        top: currentWindow.top + 100
      });

      console.log("Extension opened in popup window, window ID:", popupWindow.id);
      setTimeout(() => stopLoadingAnimation(), 1000);

    } catch (error) {
      console.error("Error opening extension via command:", error);
      stopLoadingAnimation();
    }
  }
});
