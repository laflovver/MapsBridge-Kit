(function () {
  "use strict";

  const MBT_PATH_PREFIX = "/mbx-3dbuilding-tools";
  const POLL_MS = 250;
  const TIMEOUT_MS = 60000;
  const RETRY_HASH_MS = 6000;

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

  function stripSummaryFromHash(hash) {
    const h = hash || "";
    const q = h.indexOf("?");
    if (q < 0) return h;
    const path = h.slice(0, q);
    const params = parseHashQuery(h);
    if (!params.has("jira_summary")) return h;
    params.delete("jira_summary");
    const tail = params.toString();
    return tail ? `${path}?${tail}` : path;
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

  function findRowsForIssue(issueKey) {
    const upper = issueKey.toUpperCase();
    const out = [];
    const cells = document.querySelectorAll(
      '[data-test="table-cell_jira_issue_id"]'
    );
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (!(cell.textContent || "").toUpperCase().includes(upper)) continue;
      const tr = cell.closest("tr");
      if (tr && !rowLooksLikeHeader(tr)) out.push(tr);
    }
    if (out.length) return out;

    const tbodies = document.querySelectorAll("table tbody");
    for (let t = 0; t < tbodies.length; t++) {
      const trs = tbodies[t].querySelectorAll("tr");
      for (let r = 0; r < trs.length; r++) {
        const tr = trs[r];
        if (rowLooksLikeHeader(tr)) continue;
        if (!(tr.textContent || "").toUpperCase().includes(upper)) continue;
        out.push(tr);
      }
    }
    return out;
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
    const links = row.querySelectorAll("a[href]");
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

  function tryAutoNavigate(issueKey, gen) {
    if (gen !== runId) return false;

    const rows = findRowsForIssue(issueKey);
    for (let r = 0; r < rows.length; r++) {
      if (resolveRowNavigation(rows[r])) return true;
    }

    const fallback = document.querySelectorAll("a[href]");
    const upper = issueKey.toUpperCase();
    for (let i = 0; i < fallback.length; i++) {
      const a = fallback[i];
      const raw = a.getAttribute("href") || "";
      if (!raw.includes("model-slots") || !raw.includes("/model/")) continue;
      const tr = a.closest("tr");
      if (!tr) continue;
      if (rowLooksLikeHeader(tr)) continue;
      if (!(tr.textContent || "").toUpperCase().includes(upper)) continue;
      const hash = hrefToSlotHash(raw);
      if (hash && isDeepSlotHash(hash)) {
        navigateHash(hash);
        return true;
      }
    }
    return false;
  }

  function runSession(issueKey) {
    const gen = ++runId;
    const started = Date.now();
    let strippedSummary = false;
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

      if (
        !strippedSummary &&
        Date.now() - started > RETRY_HASH_MS &&
        parseHashQuery(h).has("jira_summary")
      ) {
        strippedSummary = true;
        navigateHash(stripSummaryFromHash(h));
        return;
      }

      if (tryAutoNavigate(issueKey, gen)) {
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
    runSession(key);
  }

  startIfNeeded();
  window.addEventListener("hashchange", () => {
    startIfNeeded();
  });
})();
