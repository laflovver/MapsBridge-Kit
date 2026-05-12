"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const emailEl = document.getElementById("jira-email");
  const tokenEl = document.getElementById("jira-api-token");
  const saveBtn = document.getElementById("jira-save");
  const savedEl = document.getElementById("jira-saved-hint");
  const compactEl = document.getElementById("jira-settings-compact");
  const expandedEl = document.getElementById("jira-settings-expanded");
  const updateTokenBtn = document.getElementById("jira-update-token");

  if (!emailEl || !tokenEl || !saveBtn || !compactEl || !expandedEl) return;

  let jiraEditingToken = false;

  function hasSavedToken() {
    return (tokenEl.value || "").trim().length > 0;
  }

  function applyJiraPanelLayout() {
    const compact = hasSavedToken() && !jiraEditingToken;
    compactEl.style.display = compact ? "block" : "none";
    expandedEl.style.display = compact ? "none" : "block";
  }

  if (updateTokenBtn) {
    updateTokenBtn.addEventListener("click", () => {
      jiraEditingToken = true;
      applyJiraPanelLayout();
      tokenEl.focus();
      try {
        tokenEl.select();
      } catch (_) {}
    });
  }

  chrome.storage.local
    .get({
      mapsbridgeJiraEmail: "",
      mapsbridgeJiraApiToken: ""
    })
    .then((r) => {
      emailEl.value = r.mapsbridgeJiraEmail || "";
      tokenEl.value = r.mapsbridgeJiraApiToken || "";
      applyJiraPanelLayout();
    })
    .catch(() => {
      applyJiraPanelLayout();
    });

  saveBtn.addEventListener("click", () => {
    chrome.storage.local
      .set({
        mapsbridgeJiraEmail: emailEl.value.trim(),
        mapsbridgeJiraApiToken: tokenEl.value.trim()
      })
      .then(() => {
        jiraEditingToken = false;
        applyJiraPanelLayout();
        if (savedEl) {
          savedEl.textContent = "Saved.";
          savedEl.style.display = "block";
          setTimeout(() => {
            savedEl.style.display = "none";
          }, 2000);
        }
      })
      .catch(() => {});
  });
});
