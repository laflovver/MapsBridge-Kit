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

function collectBlobsForSingleField(issue, fieldKey) {
  const blobs = [];
  const fields = issue && issue.fields;
  if (!fields || fields[fieldKey] == null) return blobs;
  flattenFieldValue(fields[fieldKey], blobs);
  return blobs;
}

function collectRenderedDescriptionBlobs(issue) {
  const out = [];
  const rf = issue && issue.renderedFields;
  if (!rf || typeof rf.description !== "string" || !rf.description) return out;
  out.push(rf.description);
  candidateHrefsFromHtml(rf.description).forEach((h) => out.push(h));
  return out;
}

function extractAllDeepUrlsFromBlobs(blobs) {
  const seen = new Set();
  const out = [];
  const push = (url) => {
    const t = (url || "").replace(/[),.;]+$/, "");
    if (!validateDeepModelSlotUrl(t) || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const b of blobs) {
    if (typeof b !== "string" || !b) continue;
    const sources = candidatesFromRawHref(b);
    for (const raw of [...candidateDeepUrlsFromText(b), ...sources]) {
      push(raw);
    }
  }
  const combined = blobs.filter((x) => typeof x === "string").join("\n");
  for (const raw of candidateDeepUrlsFromText(combined)) {
    push(raw);
  }
  return out;
}

function pickUnambiguousDeepLink(urls) {
  const valid = urls || [];
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0];
  const slotIds = valid
    .map((u) => extractSlotIdFromModelToolsDeepUrl(u))
    .filter(Boolean);
  if (new Set(slotIds).size !== 1) return null;
  const preferModel = valid.find((u) => {
    try {
      const h = new URL(u).hash || "";
      return /\/model\/\d+/i.test(h.split("?")[0]);
    } catch (e) {
      return false;
    }
  });
  return preferModel || valid[0];
}

function extractDeepModelSlotUrlFromBlobList(blobs) {
  return pickUnambiguousDeepLink(extractAllDeepUrlsFromBlobs(blobs));
}

function extractDeepModelSlotUrlFromIssueSummaryOnly(issue) {
  if (!issue) return null;
  const summaryAdfHrefs = [];
  if (issue.fields && issue.fields.summary != null) {
    collectAdfLinkHrefs(issue.fields.summary, summaryAdfHrefs);
  }
  const blobs = [
    ...collectBlobsForSingleField(issue, "summary"),
    ...summaryAdfHrefs
  ];
  return pickUnambiguousDeepLink(extractAllDeepUrlsFromBlobs(blobs));
}

function appendJiraContextToModelToolsUrl(urlStr, issueKey, summaryText) {
  try {
    const u = new URL(urlStr);
    if (u.hostname !== "sites.mapbox.com") return urlStr;
    let h = u.hash || "";
    if (!h.startsWith("#")) h = "#" + h;
    const q = h.indexOf("?");
    const pathOnly = q >= 0 ? h.slice(0, q) : h;
    const params = q >= 0 ? new URLSearchParams(h.slice(q + 1)) : new URLSearchParams();
    const ik = (issueKey || "").trim().toUpperCase();
    if (ik) params.set("jira_issue_id", ik);
    const s = (summaryText || "").trim();
    if (s) {
      const clipped = s.length > 400 ? s.slice(0, 400) : s;
      params.set("jira_summary", clipped);
      params.set("name", clipped);
    }
    u.hash = `${pathOnly}?${params.toString()}`;
    return u.toString();
  } catch (e) {
    return urlStr;
  }
}

function extractDeepModelSlotUrlFromIssue(issue) {
  if (!issue) return null;
  const summaryAdfHrefs = [];
  if (issue.fields && issue.fields.summary != null) {
    collectAdfLinkHrefs(issue.fields.summary, summaryAdfHrefs);
  }
  const phases = [
    [...collectBlobsForSingleField(issue, "summary"), ...summaryAdfHrefs],
    collectBlobsForSingleField(issue, "description"),
    collectRenderedDescriptionBlobs(issue)
  ];
  for (let p = 0; p < phases.length; p++) {
    const pick = pickUnambiguousDeepLink(extractAllDeepUrlsFromBlobs(phases[p]));
    if (pick) return pick;
  }
  const rest = collectIssueTextBlobs(issue);
  collectAdfLinksFromIssueFields(issue).forEach((h) => rest.push(h));
  collectRenderedFieldsStrings(issue).forEach((html) => {
    rest.push(html);
    candidateHrefsFromHtml(html).forEach((h) => rest.push(h));
  });
  return pickUnambiguousDeepLink(extractAllDeepUrlsFromBlobs(rest));
}

function buildModelSlotsJiraFilterUrl(issueKey, summaryOpt, cloudIdOpt) {
  const params = new URLSearchParams();
  const key = (issueKey || "").trim().toUpperCase();
  params.set("jira_issue_id", key);
  params.set(
    "jira_issue_browse_url",
    `${JIRA_BASE}/browse/${encodeURIComponent(key)}`
  );
  const cid = cloudIdOpt != null ? String(cloudIdOpt).trim() : "";
  if (cid && /^\d+$/.test(cid)) {
    params.set("jira_issue_cloud_id", cid);
  }
  const s = (summaryOpt || "").trim();
  if (s) {
    const max = 400;
    const clipped = s.length > max ? s.slice(0, max) : s;
    params.set("jira_summary", clipped);
    params.set("name", clipped);
  }
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

  const fields = "summary,*navigable";
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

function getIssueSummaryText(issue) {
  if (!issue || !issue.fields) return "";
  const s = issue.fields.summary;
  if (typeof s === "string") return s.trim();
  if (typeof s === "object" && s != null) {
    return adfToPlainText(s).trim();
  }
  return "";
}

async function handleResolveModelSlot(issueKeyOrIdRaw) {
  const raw = (issueKeyOrIdRaw || "").trim();
  if (!raw) {
    return {
      ok: false,
      error: "bad_key",
      message: "Expected a Jira issue key (e.g. RAVE3D-103) or numeric issue id."
    };
  }

  let key = "";
  let fetched = null;
  let issue = null;

  if (/^\d{3,}$/.test(raw)) {
    fetched = await fetchJiraIssue(raw);
    if (!fetched.ok) {
      if (fetched.error === "missing_credentials") {
        return {
          ok: false,
          error: "missing_credentials",
          message: "Save Jira email and API token to resolve a numeric issue id."
        };
      }
      return fetched;
    }
    issue = fetched.issue;
    key = (issue && issue.key ? String(issue.key) : "").trim().toUpperCase();
    if (!key || !/^[A-Z][A-Z0-9]*-\d+$/.test(key)) {
      return {
        ok: false,
        error: "bad_key",
        message: "Jira response had no issue key."
      };
    }
  } else {
    key = raw.toUpperCase();
    if (!/^[A-Z][A-Z0-9]*-\d+$/.test(key)) {
      return {
        ok: false,
        error: "bad_key",
        message: "Expected a Jira issue key (e.g. RAVE3D-103) or numeric cloud id (3+ digits)."
      };
    }
    fetched = await fetchJiraIssue(key);
    issue = fetched.ok ? fetched.issue : null;
  }

  if (issue) {
    const summaryText = getIssueSummaryText(issue);
    let deep = extractDeepModelSlotUrlFromIssueSummaryOnly(issue);
    if (deep) {
      deep = appendJiraContextToModelToolsUrl(deep, key, summaryText);
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

  const filterSummary = getIssueSummaryText(issue);
  const cloudId =
    issue && issue.id != null && String(issue.id).trim() !== ""
      ? String(issue.id).trim()
      : "";
  const filterUrl = buildModelSlotsJiraFilterUrl(key, filterSummary, cloudId);
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
        : "No deep Model Slot link in the issue. Opened list filtered by Jira issue; summary is sent as name and jira_summary when the API returned it."
  };
}
