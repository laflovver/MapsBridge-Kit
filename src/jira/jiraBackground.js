"use strict";

const JIRA_BASE = "https://mapbox.atlassian.net";
const MODEL_SLOTS_ORIGIN = "https://sites.mapbox.com";
const MODEL_SLOTS_PATH_PREFIX = "/mbx-3dbuilding-tools/";
const MBT_RELEASE_NUMBER = "2022-10-10";
const MODEL_SLOTS_HASH_ROUTE = `/model-slots/${MBT_RELEASE_NUMBER}`;

function utf8ToBase64(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return btoa(str);
  }
}

function adfToPlainText(node) {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (node.text != null && typeof node.text === "string") return node.text;
  if (Array.isArray(node))
    return node.map(adfToPlainText).join("");
  if (typeof node === "object") {
    if (Array.isArray(node.content))
      return node.content.map(adfToPlainText).join("");
    const parts = [];
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (k === "attrs" || k === "marks") continue;
      parts.push(adfToPlainText(v));
    }
    return parts.join(" ");
  }
  return "";
}

function collectAdfLinkHrefs(node, out) {
  if (node == null) return;
  if (Array.isArray(node)) {
    node.forEach((x) => collectAdfLinkHrefs(x, out));
    return;
  }
  if (typeof node !== "object") return;
  if (Array.isArray(node.marks)) {
    for (const m of node.marks) {
      if (
        m &&
        m.type === "link" &&
        m.attrs &&
        typeof m.attrs.href === "string"
      ) {
        out.push(m.attrs.href.trim());
      }
    }
  }
  if (Array.isArray(node.content)) {
    node.content.forEach((ch) => collectAdfLinkHrefs(ch, out));
  }
}

function collectAdfLinksFromIssueFields(issue) {
  const out = [];
  const fields = issue && issue.fields;
  if (!fields || typeof fields !== "object") return out;
  for (const key of Object.keys(fields)) {
    collectAdfLinkHrefs(fields[key], out);
  }
  return out;
}

function collectRenderedFieldsStrings(issue) {
  const out = [];
  const rf = issue && issue.renderedFields;
  if (!rf || typeof rf !== "object") return out;
  for (const key of Object.keys(rf)) {
    const v = rf[key];
    if (typeof v === "string" && v) out.push(v);
  }
  return out;
}

function candidateHrefsFromHtml(html) {
  if (!html || typeof html !== "string") return [];
  const out = [];
  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = hrefRe.exec(html)) !== null) {
    if (m[1]) out.push(m[1].trim());
  }
  return out;
}

function flattenFieldValue(val, out) {
  if (val == null) return;
  if (typeof val === "string") {
    out.push(val);
    return;
  }
  if (typeof val === "number" || typeof val === "boolean") {
    out.push(String(val));
    return;
  }
  if (Array.isArray(val)) {
    val.forEach((x) => flattenFieldValue(x, out));
    return;
  }
  if (typeof val === "object") {
    if (typeof val.url === "string") {
      out.push(val.url);
    }
    if (val.type === "doc" || val.content != null) {
      const t = adfToPlainText(val);
      if (t) out.push(t);
      return;
    }
    if (val.self != null && val.value != null) {
      flattenFieldValue(val.value, out);
      return;
    }
    for (const k of Object.keys(val)) {
      flattenFieldValue(val[k], out);
    }
  }
}

function collectIssueTextBlobs(issue) {
  const blobs = [];
  const fields = issue && issue.fields;
  if (!fields || typeof fields !== "object") return blobs;
  for (const key of Object.keys(fields)) {
    flattenFieldValue(fields[key], blobs);
  }
  return blobs;
}

function absoluteModelToolsUrlFromHash(hashPart) {
  let h = (hashPart || "").trim();
  if (!h.startsWith("#")) h = "#" + h;
  if (!h.includes("/model-slots/")) return null;
  return `${MODEL_SLOTS_ORIGIN}/mbx-3dbuilding-tools${h}`;
}

function normalizeHrefForCandidates(href) {
  if (!href || typeof href !== "string") return [];
  const t = href.trim();
  const out = [];
  if (
    /^https:\/\/sites\.mapbox\.com\/mbx-3dbuilding-tools#/i.test(t) ||
    /^#\/model-slots\//i.test(t)
  ) {
    out.push(t);
  }
  return out;
}

function candidateDeepUrlsFromText(text) {
  if (!text || typeof text !== "string") return [];
  const out = [];
  const fullRe =
    /https:\/\/sites\.mapbox\.com\/mbx-3dbuilding-tools\/#\S+/gi;
  const full = text.match(fullRe);
  if (full) out.push(...full);

  const hashReModel =
    /#\/model-slots\/[^"'<\s#]+\/[0-9a-fA-F-]{36}\/model\/\d+/gi;
  const hashReMap =
    /#\/model-slots\/[^"'<\s#]+\/[0-9a-fA-F-]{36}\/map(?:[/?#"'<\s]|$)/gi;
  let hashes = text.match(hashReModel);
  if (hashes) {
    for (const h of hashes) {
      const abs = absoluteModelToolsUrlFromHash(h);
      if (abs) out.push(abs);
    }
  }
  hashes = text.match(hashReMap);
  if (hashes) {
    for (const raw of hashes) {
      const h = raw.replace(/["'<\s#]+$/, "");
      const abs = absoluteModelToolsUrlFromHash(h);
      if (abs) out.push(abs);
    }
  }
  return out;
}

function candidatesFromRawHref(href) {
  const out = [];
  const extras = normalizeHrefForCandidates(href);
  for (const x of extras) out.push(...candidateDeepUrlsFromText(x));
  out.push(...candidateDeepUrlsFromText(href));
  return out;
}

function validateDeepModelSlotUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.hostname !== "sites.mapbox.com") return false;
    const pathOk =
      u.pathname === "/mbx-3dbuilding-tools" ||
      u.pathname === "/mbx-3dbuilding-tools/";
    if (!pathOk) return false;
    const h = u.hash || "";
    const pathOnly = h.split("?")[0] || h;
    return /^#\/model-slots\/[^/]+\/[0-9a-fA-F-]{36}\/(?:model\/\d+|map)\/?$/i.test(
      pathOnly
    );
  } catch {
    return false;
  }
}

function extractSlotIdFromModelToolsDeepUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return null;
  try {
    const u = new URL(urlStr);
    if (u.hostname !== "sites.mapbox.com") return null;
    const h = u.hash || "";
    const m = h.match(/^#\/model-slots\/[^/]+\/([0-9a-fA-F-]{36})\//);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function extractDeepModelSlotUrlFromBlobList(blobs) {
  const seen = new Set();
  for (const b of blobs) {
    if (typeof b !== "string" || !b) continue;
    const sources = candidatesFromRawHref(b);
    for (const raw of [...candidateDeepUrlsFromText(b), ...sources]) {
      const trimmed = raw.replace(/[),.;]+$/, "");
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      if (validateDeepModelSlotUrl(trimmed)) return trimmed;
    }
  }
  const combined = blobs.filter((x) => typeof x === "string").join("\n");
  for (const raw of candidateDeepUrlsFromText(combined)) {
    const trimmed = raw.replace(/[),.;]+$/, "");
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    if (validateDeepModelSlotUrl(trimmed)) return trimmed;
  }
  return null;
}

function extractDeepModelSlotUrlFromIssue(issue) {
  const blobs = collectIssueTextBlobs(issue);
  collectAdfLinksFromIssueFields(issue).forEach((h) => blobs.push(h));
  collectRenderedFieldsStrings(issue).forEach((html) => {
    blobs.push(html);
    candidateHrefsFromHtml(html).forEach((h) => blobs.push(h));
  });
  return extractDeepModelSlotUrlFromBlobList(blobs);
}

function buildModelSlotsJiraFilterUrl(issueKey) {
  const params = new URLSearchParams();
  params.set("jira_issue_id", issueKey);
  return `${MODEL_SLOTS_ORIGIN}${MODEL_SLOTS_PATH_PREFIX}#${MODEL_SLOTS_HASH_ROUTE}?${params.toString()}`;
}

async function getJiraCredentials() {
  const r = await chrome.storage.local.get({
    mapsbridgeJiraEmail: "",
    mapsbridgeJiraApiToken: ""
  });
  return {
    email: (r.mapsbridgeJiraEmail || "").trim(),
    apiToken: (r.mapsbridgeJiraApiToken || "").trim()
  };
}

async function fetchJiraIssue(issueKey) {
  const { email, apiToken } = await getJiraCredentials();
  if (!email || !apiToken) {
    return {
      ok: false,
      error: "missing_credentials",
      message: ""
    };
  }

  const fields = "*navigable";
  const expand = "renderedFields";
  const url = `${JIRA_BASE}/rest/api/3/issue/${encodeURIComponent(
    issueKey
  )}?fields=${encodeURIComponent(fields)}&expand=${encodeURIComponent(
    expand
  )}`;

  const auth = utf8ToBase64(`${email}:${apiToken}`);
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json"
    }
  });

  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      error: "auth_failed",
      message: "Jira rejected credentials. Check email and API token."
    };
  }

  if (res.status === 404) {
    return {
      ok: false,
      error: "not_found",
      message: `Issue ${issueKey} was not found.`
    };
  }

  if (!res.ok) {
    const t = await res.text();
    return {
      ok: false,
      error: "jira_http_error",
      message: `Jira HTTP ${res.status}: ${t.slice(0, 200)}`
    };
  }

  const issue = await res.json();
  return { ok: true, issue };
}

async function fetchJiraIssueCommentBlobs(issueKey) {
  const { email, apiToken } = await getJiraCredentials();
  if (!email || !apiToken) return [];
  const auth = utf8ToBase64(`${email}:${apiToken}`);
  try {
    const res = await fetch(
      `${JIRA_BASE}/rest/api/3/issue/${encodeURIComponent(
        issueKey
      )}/comment?maxResults=100`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json"
        }
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const out = [];
    for (const c of data.comments || []) {
      if (!c || !c.body) continue;
      const hrefs = [];
      collectAdfLinkHrefs(c.body, hrefs);
      hrefs.forEach((h) => out.push(h));
      const t = adfToPlainText(c.body);
      if (t) out.push(t);
    }
    return out;
  } catch {
    return [];
  }
}

function validateModelSlotsFilterUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.hostname !== "sites.mapbox.com") return false;
    const pathOk = /\/mbx-3dbuilding-tools\/?$/.test(
      u.pathname.replace(/\/+/g, "/")
    );
    const h = u.hash || "";
    return (
      pathOk &&
      h.includes(MODEL_SLOTS_HASH_ROUTE) &&
      h.includes("jira_issue_id=")
    );
  } catch {
    return false;
  }
}

async function handleResolveModelSlot(issueKey) {
  const key = (issueKey || "").trim().toUpperCase();
  if (!key || !/^[A-Z][A-Z0-9]*-\d+$/.test(key)) {
    return {
      ok: false,
      error: "bad_key",
      message: "Expected a Jira issue key (e.g. RAVE3D-103)."
    };
  }

  const fetched = await fetchJiraIssue(key);
  const issue = fetched.ok ? fetched.issue : null;

  if (issue) {
    let deep = extractDeepModelSlotUrlFromIssue(issue);
    if (!deep) {
      const commentBlobs = await fetchJiraIssueCommentBlobs(key);
      deep = extractDeepModelSlotUrlFromBlobList(commentBlobs);
    }
    if (deep) {
      const slotId = extractSlotIdFromModelToolsDeepUrl(deep);
      return {
        ok: true,
        modelSlotUrl: deep,
        issueKey: key,
        resolvedVia: "deep_link",
        ...(slotId ? { slotId } : {})
      };
    }
  }

  if (
    fetched &&
    !fetched.ok &&
    fetched.error &&
    fetched.message &&
    fetched.error !== "missing_credentials"
  ) {
    return fetched;
  }

  const filterUrl = buildModelSlotsJiraFilterUrl(key);
  if (!validateModelSlotsFilterUrl(filterUrl)) {
    return {
      ok: false,
      error: "url_build",
      message: "Could not build Model Slot URL."
    };
  }

  return {
    ok: true,
    modelSlotUrl: filterUrl,
    issueKey: key,
    resolvedVia: "filter",
    hint:
      fetched && fetched.error === "missing_credentials"
        ? "Save Jira email and API token to read links from the issue; otherwise only the filtered list opens."
        : "No deep Model Slot link in the issue. Opened list filtered by issue key."
  };
}
