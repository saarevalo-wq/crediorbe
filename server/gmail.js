import { google } from "googleapis";
import { getRefreshToken } from "./store.js";

const SEARCH_QUERY =
  '(from:ramajudicial.gov.co OR from:superfinanciera.gov.co OR from:notificacionesjudiciales ' +
  'OR subject:tutela OR subject:desacato OR subject:impugnación OR subject:impugnacion ' +
  'OR subject:"derecho de petición" OR subject:peticion OR subject:requerimiento) newer_than:60d';

async function client() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error("No hay refresh token guardado. Visita /auth/google primero.");
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

function header(headers, name) {
  const h = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : "";
}

function decodeBase64Url(data) {
  return Buffer.from(data, "base64url").toString("utf8");
}

function extractPlainText(payload) {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) return decodeBase64Url(payload.body.data);
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
  const m = (fromHeader || "").match(/^(.*?)\s*<(.+)>$/);
  if (m) return { name: m[1].replace(/"/g, "").trim(), email: m[2].trim() };
  return { name: fromHeader, email: fromHeader };
}

// Attachment types Claude can read directly (PDF via its document blocks —
// text-based or scanned, no separate OCR step needed — and common image
// formats via image blocks, for admisorios sent as a photo/screenshot).
const READABLE_ATTACHMENT_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const MAX_ATTACHMENTS_PER_EMAIL = 5;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // Claude's per-document limit is ~32MB; keep well under it.

/** Recursively walks a Gmail message payload collecting attachment refs (filename + attachmentId). */
function collectAttachmentParts(payload, out = []) {
  if (!payload) return out;
  if (payload.filename && payload.body?.attachmentId && READABLE_ATTACHMENT_MIME.has(payload.mimeType)) {
    out.push({ filename: payload.filename, mimeType: payload.mimeType, attachmentId: payload.body.attachmentId });
  }
  if (payload.parts) payload.parts.forEach((p) => collectAttachmentParts(p, out));
  return out;
}

async function fetchAttachments(gmail, messageId, payload) {
  const refs = collectAttachmentParts(payload).slice(0, MAX_ATTACHMENTS_PER_EMAIL);
  const attachments = [];
  for (const ref of refs) {
    try {
      const { data } = await gmail.users.messages.attachments.get({
        userId: "me",
        messageId,
        id: ref.attachmentId,
      });
      const base64 = Buffer.from(data.data, "base64url").toString("base64");
      if (Buffer.byteLength(base64, "base64") > MAX_ATTACHMENT_BYTES) continue;
      attachments.push({ filename: ref.filename, mimeType: ref.mimeType, data: base64 });
    } catch (err) {
      console.error(`No se pudo descargar el adjunto "${ref.filename}" del correo ${messageId}:`, err.message);
    }
  }
  return attachments;
}

export async function fetchJudicialEmails({ maxResults = 25 } = {}) {
  const gmail = await client();
  const list = await gmail.users.messages.list({ userId: "me", q: SEARCH_QUERY, maxResults });
  const ids = (list.data.messages || []).map((m) => m.id);

  const emails = [];
  for (const id of ids) {
    const { data: msg } = await gmail.users.messages.get({ userId: "me", id, format: "full" });
    const headers = msg.payload?.headers || [];
    const { name: fromName, email: from } = parseFrom(header(headers, "From"));
    const attachments = await fetchAttachments(gmail, id, msg.payload);
    emails.push({
      id: msg.id,
      subject: header(headers, "Subject"),
      from,
      fromName,
      snippet: msg.snippet || "",
      body: extractPlainText(msg.payload) || msg.snippet || "",
      receivedAt: new Date(Number(msg.internalDate)).toISOString(),
      attachments,
    });
  }
  return emails;
}
