importScripts("src/jira/jiraBackground.js");

const POPUP_PAGE = chrome.runtime.getURL("popup.html");
const POPUP_W = 760;
const POPUP_H = 820;

function popupPageUrlForSourceWindow(sourceWindowId) {
  if (sourceWindowId == null) {
    return POPUP_PAGE;
  }
  return `${POPUP_PAGE}?sourceWin=${String(sourceWindowId)}`;
}

async function getSourceMapWindowId() {
  try {
    const w0 = await chrome.windows.getLastFocused();
    if (w0 && w0.type === "normal" && w0.id != null) {
      return w0.id;
    }
  } catch (e) {
    // ignore
  }
  try {
    const w1 = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
    if (w1 && w1.id != null) {
      return w1.id;
    }
  } catch (e) {
    // ignore
  }
  try {
    const all = await chrome.windows.getAll({ windowTypes: ["normal"] });
    const f = all.find((x) => x.focused);
    if (f && f.id != null) {
      return f.id;
    }
    if (all[0] && all[0].id != null) {
      return all[0].id;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

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
          if (!t || !t.url) {
            continue;
          }
          if (t.url === POPUP_PAGE || t.url.indexOf(POPUP_PAGE + "?") === 0) {
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

function openExtensionPopupWindow(sourceWindowId) {
  const url = popupPageUrlForSourceWindow(sourceWindowId);
  chrome.windows.create(
    {
      url: url,
      type: "popup",
      width: POPUP_W,
      height: POPUP_H,
      focused: true
    },
    (created) => {
      if (chrome.runtime.lastError || !created) {
        chrome.tabs.create({ url, active: true });
      }
    }
  );
}

async function openActionPopupForWindow(windowId) {
  if (!chrome.action || typeof chrome.action.openPopup !== "function") {
    return false;
  }
  try {
    await chrome.action.setPopup({ popup: "popup.html" });
    const opts = windowId != null ? { windowId } : {};
    await chrome.action.openPopup(opts);
    return true;
  } catch (e) {
    console.warn("openPopup failed", e);
    try {
      await chrome.action.setPopup({ popup: "" });
    } catch (_) {}
    return false;
  }
}

async function openExtensionPopupAttachedToWindow(windowId) {
  const ok = await openActionPopupForWindow(windowId);
  if (ok) {
    return;
  }

  try {
    if (windowId != null && chrome.storage && chrome.storage.session) {
      await chrome.storage.session.set({
        mapsbridgeSourceWindowId: windowId
      });
    }
  } catch (e) {
    console.error("session set for fallback popup", e);
  }

  const focused = await focusExistingExtensionWindow();
  if (!focused) {
    openExtensionPopupWindow(windowId);
  }
}

async function openExtensionFromShortcut() {
  const sourceId = await getSourceMapWindowId();
  await openExtensionPopupAttachedToWindow(sourceId);
}

chrome.action.onClicked.addListener((tab) => {
  const wid =
    tab && tab.windowId != null ? tab.windowId : null;
  void openExtensionPopupAttachedToWindow(wid);
});

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

async function getActiveMapTabInWindow(sourceWindowId) {
  if (sourceWindowId == null) {
    return { url: null, tabId: null };
  }
  let list = await chrome.tabs.query({ active: true, windowId: sourceWindowId });
  let tab = list && list[0];
  if (!tab) {
    const w = await chrome.windows.get(sourceWindowId, { populate: true });
    if (w && w.tabs && w.tabs.length) {
      tab = w.tabs.find((t) => t.active) || w.tabs[0];
    }
  }
  if (!tab) {
    return { url: null, tabId: null };
  }
  return { url: tab.url, tabId: tab.id };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "get-active-map-tab" && message.sourceWindowId != null) {
    (async () => {
      try {
        const r = await getActiveMapTabInWindow(message.sourceWindowId);
        sendResponse({ url: r.url, tabId: r.tabId });
      } catch (e) {
        sendResponse({ url: null, tabId: null });
      }
    })();
    return true;
  }
  if (message && message.type === "resolve-model-slot" && message.issueKey) {
    (async () => {
      try {
        const result = await handleResolveModelSlot(message.issueKey);
        sendResponse(result);
      } catch (e) {
        sendResponse({
          ok: false,
          error: "exception",
          message: e && e.message ? String(e.message) : "Resolver failed"
        });
      }
    })();
    return true;
  }
  if (message === "popup-ready" || message.type === "popup-ready") {
    chrome.action.setBadgeText({ text: "" });
    sendResponse({ status: "ok" });
    return true;
  }

  return true;
});

console.log("Background service worker loaded");
