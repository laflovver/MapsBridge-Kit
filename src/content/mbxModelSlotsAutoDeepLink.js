(function () {
  "use strict";

  const MBT_PATH_PREFIX = "/mbx-3dbuilding-tools";
  const POLL_MS = 250;
  const TIMEOUT_MS = 60000;

  let runId = 0;

  function parseHashQuery(hash) {
    const q = (hash || "").indexOf("?");
    if (q < 0) return new URLSearchParams();
    try {
      return new URLSearchParams(hash.slice(q + 1));
    } catch {
      return new URLSearchParams();
    }
  }

  function issueKeyFromHash(hash) {
    const key = parseHashQuery(hash).get("jira_issue_id") || "";
    const u = key.trim().toUpperCase();
    return /^[A-Z][A-Z0-9]*-\d+$/.test(u) ? u : "";
  }

  function nameFilterFromHash(hash) {
    const p = parseHashQuery(hash || "");
    const raw = (p.get("name") || p.get("jira_summary") || "").trim();
    if (!raw) return "";
    return raw.replace(/\+/g, " ").trim();
  }

  function rowMatchesNameFilter(tr, nameFilter) {
    const n = (nameFilter || "").trim();
    if (!n) return true;
    const t = (tr.textContent || "").replace(/\s+/g, " ").toUpperCase();
    return t.includes(n.toUpperCase());
  }

  function cellIssueKeyMatchesCellText(text, keyUpper) {
    const k = (keyUpper || "").trim().toUpperCase();
    const raw = (text || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    if (!k || !raw) return false;
    const u = raw.toUpperCase();
    if (u === k) return true;
    const tokens = u.match(/\b[A-Z][A-Z0-9]+-\d+\b/g);
    if (!tokens || tokens.indexOf(k) < 0) return false;
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("(^|[^A-Z0-9])" + esc + "([^0-9A-Z]|$)").test(u);
  }

  function isDeepSlotHash(h) {
    const path = (h || "").split("?")[0];
    return /^#\/model-slots\/[^/]+\/[0-9a-fA-F-]{36}\/model\/\d+$/i.test(
      path
    );
  }

  function hrefToSlotHash(raw) {
    const t = (raw || "").trim();
    if (!t) return "";
    if (t.startsWith("#")) return t.split("?")[0];
    if (t.startsWith("/")) {
      const p = t.replace(/^\/+/, "");
      if (p.includes("model-slots/") && p.includes("/model/")) {
        return "#" + p.split("?")[0];
      }
    }
    if (/^https?:\/\//i.test(t)) {
      try {
        const u = new URL(t);
        if (u.hash && u.hash.indexOf("model-slots") >= 0) {
          return u.hash.split("?")[0];
        }
        const path = (u.pathname || "")
          .replace(new RegExp("^" + MBT_PATH_PREFIX + "/?"), "")
          .replace(/^\/+/, "");
        if (path.includes("model-slots/") && path.includes("/model/")) {
          return "#/" + path.split("?")[0];
        }
      } catch (_) {}
    }
    return "";
  }

  function isMbtHostPath() {
    try {
      const hostOk =
        location.hostname === "sites.mapbox.com" ||
        location.hostname.endsWith(".mapbox.com");
      const p = (location.pathname || "").replace(/\/+$/, "") || "/";
      return (
        hostOk &&
        (p === MBT_PATH_PREFIX || p.indexOf(MBT_PATH_PREFIX + "/") === 0)
      );
    } catch {
      return false;
    }
  }

  function isFilteredListState(hash) {
    const h = hash || "";
    if (!h) return false;
    const pathOnly = h.split("?")[0];
    if (isDeepSlotHash(h)) return false;
    return (
      parseHashQuery(h).has("jira_issue_id") &&
      pathOnly.indexOf("/model-slots/") >= 0
    );
  }

  function navigateHash(newHash) {
    const frag = newHash.startsWith("#") ? newHash.slice(1) : newHash;
    const cur = location.hash.replace(/^#/, "");
    if (cur === frag) return;
    location.hash = frag;
  }

  function extractSlotAndModelFromSlotLink(href) {
    const h = hrefToSlotHash(href) || href;
    const m = h.match(
      /#\/model-slots\/([^/]+)\/([0-9a-fA-F-]{36})\/model\/([^/#?]+)/i
    );
    if (!m) return null;
    return { release: m[1], slotId: m[2], modelId: m[3] };
  }

  function firstNumericModelHrefInRow(row) {
    const links = row.querySelectorAll("a[href]");
    for (let i = 0; i < links.length; i++) {
      const raw = links[i].getAttribute("href") || "";
      const h = hrefToSlotHash(raw) || raw;
      if (h.includes("model-slots")) continue;
      const m = h.match(/#\/model\/(\d+)/i);
      if (m) return m[1];
      const m2 = raw.match(/\/model\/(\d+)/i);
      if (m2 && !raw.includes("model-slots")) return m2[1];
    }
    return null;
  }

  function buildDeepHash(release, slotId, modelId) {
    return `#/model-slots/${release}/${slotId}/model/${modelId}`;
  }

  function rowLooksLikeHeader(tr) {
    return Boolean(
      tr.querySelector("th") ||
        tr.getAttribute("data-test") === "table-header-row"
    );
  }

  function findRowsForIssue(issueKey, nameFilter) {
    const k = (issueKey || "").trim().toUpperCase();
    if (!k) return [];
    const seen = new Set();
    const out = [];
    const pushTr = (tr) => {
      if (!tr || rowLooksLikeHeader(tr) || seen.has(tr)) return;
      seen.add(tr);
      out.push(tr);
    };

    const cellSelectors = [
      '[data-test="table-cell_jira_issue_id"]',
      '[data-test="table-cell_jira-issue-id"]',
      '[data-test*="jira_issue_id"]'
    ];
    for (let s = 0; s < cellSelectors.length; s++) {
      const cells = document.querySelectorAll(cellSelectors[s]);
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (!cellIssueKeyMatchesCellText(cell.textContent || "", k)) continue;
        pushTr(cell.closest("tr"));
      }
      if (out.length) break;
    }

    if (!out.length) {
      const dataRows = document.querySelectorAll("table tbody tr");
      for (let r = 0; r < dataRows.length; r++) {
        const tr = dataRows[r];
        if (rowLooksLikeHeader(tr)) continue;
        const cells = tr.querySelectorAll("[data-test]");
        for (let c = 0; c < cells.length; c++) {
          const dt = cells[c].getAttribute("data-test") || "";
          if (!/jira_issue|issue_id|jira-issue/i.test(dt)) continue;
          if (cellIssueKeyMatchesCellText(cells[c].textContent || "", k)) {
            pushTr(tr);
            break;
          }
        }
      }
    }

    return out.filter((tr) => rowMatchesNameFilter(tr, nameFilter));
  }

  function activateAnchor(a) {
    const raw = a.getAttribute("href") || "";
    const hash = hrefToSlotHash(raw);
    if (hash && isDeepSlotHash(hash)) {
      navigateHash(hash);
      return true;
    }
    try {
      a.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window
        })
      );
      return true;
    } catch (_) {
      try {
        a.click();
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  function resolveRowNavigation(row) {
    const deepHashes = [];
    const links = row.querySelectorAll("a[href]");
    for (let i = 0; i < links.length; i++) {
      const a = links[i];
      const raw = a.getAttribute("href") || "";
      if (!raw.includes("model-slots") || !raw.includes("model")) continue;
      const hash = hrefToSlotHash(raw);
      if (hash && isDeepSlotHash(hash)) {
        deepHashes.push(hash);
      }
    }
    const uniqDeep = [...new Set(deepHashes)];
    if (uniqDeep.length === 1) {
      navigateHash(uniqDeep[0]);
      return true;
    }
    if (uniqDeep.length > 1) {
      return false;
    }

    for (let i = 0; i < links.length; i++) {
      const a = links[i];
      const raw = a.getAttribute("href") || "";
      if (!raw.includes("model-slots") || !raw.includes("model")) continue;

      const hash = hrefToSlotHash(raw);
      if (hash && isDeepSlotHash(hash)) {
        navigateHash(hash);
        return true;
      }

      const parts = extractSlotAndModelFromSlotLink(raw);
      if (
        parts &&
        parts.slotId &&
        parts.release &&
        (parts.modelId === "undefined" ||
          parts.modelId === "null" ||
          !/^\d+$/.test(String(parts.modelId)))
      ) {
        const mid = firstNumericModelHrefInRow(row);
        if (mid) {
          navigateHash(buildDeepHash(parts.release, parts.slotId, mid));
          return true;
        }
      }

      if (
        raw.includes("/model-slots/") &&
        raw.includes("/model/") &&
        activateAnchor(a)
      ) {
        return true;
      }
    }
    return false;
  }

  function tryAutoNavigate(issueKey, nameFilter, gen) {
    if (gen !== runId) return false;

    const rows = findRowsForIssue(issueKey, nameFilter);
    for (let r = 0; r < rows.length; r++) {
      if (resolveRowNavigation(rows[r])) return true;
    }

    return false;
  }

  function runSession(issueKey, nameFilter) {
    const gen = ++runId;
    const started = Date.now();
    let iv = null;
    let obs = null;

    function stop() {
      if (iv != null) {
        clearInterval(iv);
        iv = null;
      }
      if (obs != null) {
        try {
          obs.disconnect();
        } catch (_) {}
        obs = null;
      }
    }

    function tick() {
      if (gen !== runId) {
        stop();
        return;
      }
      const h = location.hash || "";
      if (!isFilteredListState(h)) {
        stop();
        return;
      }
      if (Date.now() - started > TIMEOUT_MS) {
        stop();
        return;
      }

      if (tryAutoNavigate(issueKey, nameFilter, gen)) {
        stop();
      }
    }

    obs = new MutationObserver(tick);
    obs.observe(document.documentElement, { childList: true, subtree: true });
    iv = setInterval(tick, POLL_MS);
    tick();
  }

  function startIfNeeded() {
    if (!isMbtHostPath()) return;
    const h = location.hash || "";
    if (!isFilteredListState(h)) return;
    const key = issueKeyFromHash(h);
    if (!key) return;
    runSession(key, nameFilterFromHash(h));
  }

  startIfNeeded();
  window.addEventListener("hashchange", () => {
    startIfNeeded();
  });
})();
