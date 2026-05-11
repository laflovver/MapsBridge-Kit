"use strict";

function extractJiraIssueKeyFromUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return "";

  const asKey = (s) => {
    const t = (s || "").trim();
    return /^[A-Z][A-Z0-9]*-\d+$/i.test(t) ? t.toUpperCase() : "";
  };

  try {
    const u = new URL(urlStr);
    if (
      u.hostname === "mapbox.atlassian.net" ||
      u.hostname.endsWith(".atlassian.net")
    ) {
      const paramNames = [
        "selectedIssue",
        "issueKey",
        "issue",
        "key",
        "selectedId"
      ];
      for (let i = 0; i < paramNames.length; i++) {
        const k = asKey(u.searchParams.get(paramNames[i]));
        if (k) return k;
      }
    }
  } catch (_) {}

  let m = urlStr.match(/\/browse\/([A-Z][A-Z0-9]*-\d+)/i);
  if (m) return m[1].toUpperCase();

  m = urlStr.match(
    /[?&#](?:selectedIssue|issueKey|issue)=([A-Z][A-Z0-9]*-\d+)/i
  );
  if (m) return m[1].toUpperCase();

  m = urlStr.match(/\/issues\/([A-Z][A-Z0-9]*-\d+)(?:[^A-Z0-9-]|$)/i);
  if (m) return m[1].toUpperCase();

  return "";
}
