"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const emailEl = document.getElementById("jira-email");
  const tokenEl = document.getElementById("jira-api-token");
  const saveBtn = document.getElementById("jira-save");
  const savedEl = document.getElementById("jira-saved-hint");

  if (!emailEl || !tokenEl || !saveBtn) return;

  chrome.storage.local
    .get({
      mapsbridgeJiraEmail: "",
      mapsbridgeJiraApiToken: ""
    })
    .then((r) => {
      emailEl.value = r.mapsbridgeJiraEmail || "";
      tokenEl.value = r.mapsbridgeJiraApiToken || "";
    })
    .catch(() => {});

  saveBtn.addEventListener("click", () => {
    chrome.storage.local
      .set({
        mapsbridgeJiraEmail: emailEl.value.trim(),
        mapsbridgeJiraApiToken: tokenEl.value.trim()
      })
      .then(() => {
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
