"use strict";

function setVisible(el, on) {
  if (el) el.style.display = on ? "" : "none";
}

function showError(statusEl, errEl, message) {
  if (statusEl) statusEl.textContent = "Could not open Model Slot.";
  if (errEl) {
    errEl.textContent = message || "Unknown error.";
    errEl.style.display = "block";
  }
}

async function runResolve(issueKeyRaw) {
  const statusEl = document.getElementById("resolve-status");
  const errEl = document.getElementById("resolve-err");
  const manual = document.getElementById("resolve-manual");
  const key = (issueKeyRaw || "").trim().toUpperCase();
  if (!key) {
    showError(statusEl, errEl, "Enter an issue key (e.g. RAVE3D-103).");
    setVisible(manual, true);
    return;
  }
  if (!/^[A-Z][A-Z0-9]*-\d+$/.test(key) && !/^\d{3,}$/.test(key)) {
    showError(
      statusEl,
      errEl,
      "Enter issue key (e.g. RAVE3D-103) or numeric Jira cloud issue id."
    );
    setVisible(manual, true);
    return;
  }

  if (statusEl) statusEl.textContent = "Opening Model Slot…";
  setVisible(errEl, false);
  if (errEl) errEl.style.display = "none";

  try {
    const res = await chrome.runtime.sendMessage({
      type: "resolve-model-slot",
      issueKey: key
    });

    if (res && res.ok && res.modelSlotUrl) {
      window.location.replace(res.modelSlotUrl);
      return;
    }

    showError(statusEl, errEl, (res && res.message) || "Resolution failed.");
    setVisible(manual, true);
  } catch (e) {
    showError(statusEl, errEl, e && e.message ? String(e.message) : "Message to extension failed.");
    setVisible(manual, true);
  }
}

(function init() {
  const params = new URLSearchParams(location.search);
  const keyFromQuery = params.get("key") || "";

  const statusEl = document.getElementById("resolve-status");
  const manual = document.getElementById("resolve-manual");
  const input = document.getElementById("resolve-key-input");
  const goBtn = document.getElementById("resolve-go");

  if (input && keyFromQuery) {
    input.value = keyFromQuery;
  }

  if (goBtn) {
    goBtn.addEventListener("click", () => runResolve(input ? input.value : ""));
  }
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        runResolve(input.value);
      }
    });
  }

  if (keyFromQuery) {
    runResolve(keyFromQuery);
  } else {
    if (statusEl) {
      statusEl.textContent =
        "Enter issue key (RAVE3D-103) or numeric id, or open with ?key=…";
    }
    setVisible(manual, true);
  }
})();
