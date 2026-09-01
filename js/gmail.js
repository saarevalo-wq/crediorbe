// Client-side Gmail integration using Google Identity Services (GIS).
//
// This runs entirely in the browser: the access token lives in memory/
// sessionStorage and is used to call the Gmail API directly with fetch().
// Tradeoff of doing this without a backend: the token expires (~1 hour) and
// there's no refresh token, so the user has to tap "Conectar" again after it
// expires. A backend with offline access (see server/) removes that limit and
// is required anyway for background push notifications.

import { CONFIG } from "./config.js";

const TOKEN_KEY = "crediorbe.gmail.token.v1";
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

let tokenClient = null;
let accessToken = sessionStorage.getItem(TOKEN_KEY) || null;

function ensureTokenClient() {
  if (tokenClient) return tokenClient;
  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google Identity Services no cargó todavía. Revisa tu conexión e intenta de nuevo.");
  }
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    scope: SCOPE,
    callback: () => {}, // overridden per-call in connect()
  });
  return tokenClient;
}

export function isConnected() {
  return !!accessToken;
}

export function connect() {
  return new Promise((resolve, reject) => {
    try {
      const client = ensureTokenClient();
      client.callback = (resp) => {
        if (resp.error) return reject(new Error(resp.error));
        accessToken = resp.access_token;
        sessionStorage.setItem(TOKEN_KEY, accessToken);
        resolve(accessToken);
      };
      client.requestAccessToken({ prompt: "consent" });
    } catch (err) {
      reject(err);
    }
  });
}

export function disconnect() {
  if (accessToken && window.google?.accounts?.oauth2?.revoke) {
    window.google.accounts.oauth2.revoke(accessToken, () => {});
  }
  accessToken = null;
  sessionStorage.removeItem(TOKEN_KEY);
}

async function gmailFetch(path) {
  const res = await fetch(`https://www.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) {
    accessToken = null;
    sessionStorage.removeItem(TOKEN_KEY);
    throw new Error("La sesión de Gmail expiró. Conéctate de nuevo en Ajustes.");
  }
  if (!res.ok) throw new Error(`Gmail API error ${res.status}`);
  return res.json();
}

export async function fetchProfile() {
  return gmailFetch("profile");
}

// Search query: known judicial/regulatory senders, or subject keywords for
// the 5 process types this app classifies. Tune freely to your inbox.
const SEARCH_QUERY =
  '(from:ramajudicial.gov.co OR from:superfinanciera.gov.co OR from:notificacionesjudiciales ' +
  'OR subject:tutela OR subject:desacato OR subject:impugnación OR subject:impugnacion ' +
  'OR subject:"derecho de petición" OR subject:peticion OR subject:requerimiento) newer_than:60d';

// Attachment types Claude can read directly (PDF via its document blocks —
// text-based or scanned, no separate OCR step needed — and common image
// formats via image blocks, for admisorios sent as a photo/screenshot).
const READABLE_ATTACHMENT_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const MAX_ATTACHMENTS_PER_EMAIL = 5;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // Claude's per-document limit is ~32MB; keep well under it.

function collectAttachmentParts(payload, out = []) {
  if (!payload) return out;
  if (payload.filename && payload.body?.attachmentId && READABLE_ATTACHMENT_MIME.has(payload.mimeType)) {
    out.push({ filename: payload.filename, mimeType: payload.mimeType, attachmentId: payload.body.attachmentId });
  }
  if (payload.parts) payload.parts.forEach((p) => collectAttachmentParts(p, out));
  return out;
}

function base64UrlToBase64(data) {
  return data.replace(/-/g, "+").replace(/_/g, "/");
}

async function fetchAttachments(messageId, payload) {
  const refs = collectAttachmentParts(payload).slice(0, MAX_ATTACHMENTS_PER_EMAIL);
  const attachments = [];
  for (const ref of refs) {
    try {
      const att = await gmailFetch(`messages/${messageId}/attachments/${ref.attachmentId}`);
      const base64 = base64UrlToBase64(att.data);
      if (Math.ceil((base64.length * 3) / 4) > MAX_ATTACHMENT_BYTES) continue;
      attachments.push({ filename: ref.filename, mimeType: ref.mimeType, data: base64 });
    } catch (err) {
      console.error(`No se pudo descargar el adjunto "${ref.filename}":`, err.message);
    }
  }
  return attachments;
}

export async function fetchJudicialEmails({ maxResults = 25 } = {}) {
  const list = await gmailFetch(`messages?q=${encodeURIComponent(SEARCH_QUERY)}&maxResults=${maxResults}`);
  const ids = (list.messages || []).map((m) => m.id);
  const emails = [];
  for (const id of ids) {
    const msg = await gmailFetch(`messages/${id}?format=full`);
    const attachments = await fetchAttachments(id, msg.payload);
    emails.push({ ...parseMessage(msg), attachments });
  }
  return emails;
}

function header(headers, name) {
  const h = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : "";
}

function decodeBase64Url(data) {
  try {
    const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
    return decodeURIComponent(escape(atob(normalized)));
  } catch {
    return "";
  }
}

function extractPlainText(payload) {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data).replace(/<[^>]+>/g, " ");
  }
  return "";
}

function parseFrom(fromHeader) {
  const m = fromHeader.match(/^(.*?)\s*<(.+)>$/);
  if (m) return { name: m[1].replace(/"/g, "").trim(), email: m[2].trim() };
  return { name: fromHeader, email: fromHeader };
}

function parseMessage(msg) {
  const headers = msg.payload?.headers || [];
  const { name: fromName, email: from } = parseFrom(header(headers, "From"));
  return {
    id: msg.id,
    subject: header(headers, "Subject"),
    from,
    fromName,
    snippet: msg.snippet || "",
    body: extractPlainText(msg.payload) || msg.snippet || "",
    receivedAt: new Date(Number(msg.internalDate)).toISOString(),
  };
}
