const POPUP_PAGE = chrome.runtime.getURL("popup.html");
const POPUP_W = 680;
const POPUP_H = 720;

function focusExistingExtensionWindow() {
  return new Promise((resolve) => {
    chrome.windows.getAll({ populate: true }, (windows) => {
      if (chrome.runtime.lastError || !windows) {
        resolve(false);
        return;
      }
      let found = null;
      for (const w of windows) {
        for (const t of w.tabs || []) {
          if (t.url === POPUP_PAGE) {
            found = t;
            break;
          }
        }
        if (found) break;
      }
      if (!found) {
        resolve(false);
        return;
      }
      chrome.windows.update(found.windowId, { focused: true }, () => {
        if (chrome.runtime.lastError) {
          resolve(false);
          return;
        }
        chrome.tabs.update(found.id, { active: true }, () => {
          resolve(!chrome.runtime.lastError);
        });
      });
    });
  });
}

function openExtensionPopupWindow() {
  chrome.windows.create(
    {
      url: POPUP_PAGE,
      type: "popup",
      width: POPUP_W,
      height: POPUP_H,
      focused: true
    },
    (created) => {
      if (chrome.runtime.lastError || !created) {
        chrome.tabs.create({ url: POPUP_PAGE, active: true });
      }
    }
  );
}

async function openExtensionFromShortcut() {
  const focused = await focusExistingExtensionWindow();
  if (!focused) {
    openExtensionPopupWindow();
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "open-extension") {
    void openExtensionFromShortcut();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.commands.getAll((commands) => {
    const row = commands.find((c) => c.name === "open-extension");
    const shortcut = row && row.shortcut ? row.shortcut : "";
    chrome.storage.local.set({ mapsbridgeOpenShortcut: shortcut });
    if (!shortcut) {
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#B71C1C" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message === "popup-ready" || message.type === "popup-ready") {
    chrome.action.setBadgeText({ text: "" });
    sendResponse({ status: "ok" });
    return true;
  }

  return true;
});

console.log("Background service worker loaded");
