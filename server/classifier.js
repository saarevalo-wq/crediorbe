// Server-side port of ../js/classifier.js (identical logic, no DOM
// dependency in the original so this is a straight copy) — used by the
// background poller since it can't import browser-served modules directly.
// Keep both in sync if you tune the classification rules.

import { addBusinessDays } from "./holidays-co.js";
import { extractAllAttachmentsText } from "./attachment-text.js";

export const ProcessType = {
  DESACATO: "Desacato",
  TUTELA: "Tutela",
  RESPUESTA_TUTELA: "Respuesta a tutela",
  IMPUGNACION: "Impugnación",
  DERECHO_PETICION: "Derecho de petición",
  REQUERIMIENTO: "Requerimiento",
  DEMANDA_SIC: "Demanda SIC",
};

export const Urgency = { URGENTE: "URGENTE", ALTA: "ALTA", MEDIA: "MEDIA", BAJA: "BAJA" };

// Order matters: more specific rules (requiring two signals via lookahead)
// are checked before the generic single-keyword rules they'd otherwise be
// shadowed by — see js/classifier.js for the full rationale.
const TYPE_RULES = [
  {
    type: ProcessType.DEMANDA_SIC,
    patterns: [/(?=[\s\S]*(?:superintendencia de industria y comercio|\bsic\b))(?=[\s\S]*demanda)/i],
  },
  { type: ProcessType.DESACATO, patterns: [/desacato/i] },
  {
    type: ProcessType.RESPUESTA_TUTELA,
    patterns: [/(?=[\s\S]*tutela)(?=[\s\S]*\b(?:responder|conteste|contestaci[oó]n|traslado|dar respuesta)\b)/i],
  },
  { type: ProcessType.TUTELA, patterns: [/tutela/i, /acci[oó]n de tutela/i] },
  { type: ProcessType.IMPUGNACION, patterns: [/impugnaci[oó]n/i, /impugna/i, /recurso de apelaci[oó]n/i] },
  { type: ProcessType.DERECHO_PETICION, patterns: [/derecho de petici[oó]n/i, /\bpetici[oó]n\b/i] },
  { type: ProcessType.REQUERIMIENTO, patterns: [/requerimiento/i, /\brequiere\b/i, /\brequerido\b/i] },
];

const URGENT_SIGNALS = [/arresto/i, /inmediat[oa]/i, /veinticuatro \(24\)/i, /24 horas/i];
const BASE_URGENCY = {
  [ProcessType.DESACATO]: Urgency.ALTA,
  [ProcessType.TUTELA]: Urgency.ALTA,
  [ProcessType.RESPUESTA_TUTELA]: Urgency.ALTA,
  [ProcessType.IMPUGNACION]: Urgency.MEDIA,
  [ProcessType.DERECHO_PETICION]: Urgency.MEDIA,
  [ProcessType.REQUERIMIENTO]: Urgency.BAJA,
  [ProcessType.DEMANDA_SIC]: Urgency.ALTA,
};

const RANK = { URGENTE: 4, ALTA: 3, MEDIA: 2, BAJA: 1 };
const RANK_TO_LEVEL = { 4: Urgency.URGENTE, 3: Urgency.ALTA, 2: Urgency.MEDIA, 1: Urgency.BAJA };

const DEADLINE_PATTERNS = [
  { re: /(\d+|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*\(?(\d+)?\)?\s*horas/i, unit: "hours" },
  { re: /(\d+|un[oa]?|dos|tres|cuatro|cinco|diez|quince)\s*\(?(\d+)?\)?\s*d[ií]as/i, unit: "days" },
];
const WORD_NUM = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15 };

function detectType(text) {
  for (const rule of TYPE_RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.type;
  }
  return null;
}

async function detectDeadline(text, receivedAt) {
  for (const { re, unit } of DEADLINE_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const n = m[2] ? parseInt(m[2], 10) : WORD_NUM[m[1].toLowerCase()] || null;
    if (!n) continue;
    if (unit === "hours") {
      return new Date(receivedAt.getTime() + n * 3600_000).toISOString();
    }
    const deadline = await addBusinessDays(receivedAt, n);
    return deadline.toISOString();
  }
  return null;
}

function applyPriorityWeight(baseUrgency, weight) {
  let rank = RANK[baseUrgency];
  if (weight === "alta") rank = Math.max(rank, RANK.ALTA);
  if (weight === "baja") rank = Math.min(rank, RANK.MEDIA);
  return RANK_TO_LEVEL[rank];
}

function extractCaseNumber(text) {
  const m = text.match(/\b(20\d{2}-\d{3,6})\b/);
  return m ? m[1] : "—";
}

// Best-effort, zero-cost extraction of "who filed this against us" and "why"
// straight from the admisorio's text, using the phrasing Colombian judicial
// documents tend to use. This is inherently rougher than an AI reading the
// document with actual comprehension — it's pattern matching, not
// understanding — so treat its output as a helpful pointer, not a precise
// summary. It only fills in fields the AI classifier would otherwise handle.
const COUNTERPARTY_PATTERNS = [
  /(?:accionante|demandante|peticionario(?:\(a\))?|solicitante|denunciante)\s*:?\s*\n?\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ.\s]{4,90}?)(?=[\n,;.]|(?:\s+identificad|\s+quien|\s+en\s+contra))/i,
];
function extractCounterparty(text, fallback) {
  for (const re of COUNTERPARTY_PATTERNS) {
    const m = text.match(re);
    if (m) return m[1].replace(/\s+/g, " ").trim();
  }
  return fallback;
}

const MOTIVO_PATTERNS = [
  // "HECHOS" section headers, common in autos admisorios and tutelas.
  /\bHECHOS\b\s*:?\s*\n?([\s\S]{40,500}?)(?:\n\s*\n|\bPRETENSION|\bPETICION|\bFUNDAMENTOS DE DERECHO|$)/i,
  // Direct "se vincula/se admite/en calidad de" phrasing.
  /((?:por medio del presente|mediante el presente)?[^.\n]{0,40}(?:se\s+(?:le\s+)?(?:vincula|notifica|admite)|se\s+admite\s+la\s+demanda|en\s+calidad\s+de\s+accionad[oa])[^\n]{0,350}\.)/i,
];
function extractMotivo(text) {
  for (const re of MOTIVO_PATTERNS) {
    const m = text.match(re);
    if (m) return m[1].replace(/\s+/g, " ").trim().slice(0, 500);
  }
  return null;
}

/**
 * Free/no-AI classifier: keyword rules for type/urgency/deadline (same as
 * before) PLUS actual attachment reading — PDFs with a text layer are read
 * directly (reliable, instant, $0); scanned/photographed documents get a
 * best-effort local OCR pass (also $0, but slower and less accurate — see
 * attachment-text.js). Falls back to just the email text if an attachment
 * can't be read at all.
 *
 * This is what runs when no ANTHROPIC_API_KEY is configured — see
 * classifyWithAI (./ai-classifier.js) for the more accurate but paid path.
 */
export async function classifyHeuristic(email, priorities) {
  const attachmentResults = await extractAllAttachmentsText(email.attachments || []);
  const attachmentText = attachmentResults.map((a) => a.text).filter(Boolean).join("\n\n");
  const anyUnreadable = attachmentResults.some((a) => a.ocrFailed);

  const emailText = `${email.subject}\n${email.body || email.snippet}`;
  const text = attachmentText ? `${emailText}\n\n${attachmentText}` : emailText;

  const type = detectType(text);
  if (!type) return null;

  let urgency = BASE_URGENCY[type];
  if (type === ProcessType.DESACATO && URGENT_SIGNALS.some((p) => p.test(text))) {
    urgency = Urgency.URGENTE;
  }
  urgency = applyPriorityWeight(urgency, priorities[type] || "media");

  const receivedAt = new Date(email.receivedAt);
  const deadline = await detectDeadline(text, receivedAt);
  const motivoVinculacion = extractMotivo(attachmentText || text);
  const summary = (motivoVinculacion || email.snippet || text).replace(/\s+/g, " ").trim().slice(0, 180);

  const aiSummaryPoints = [summary];
  if (anyUnreadable) {
    aiSummaryPoints.push(
      "Uno o más adjuntos parecen ser un documento escaneado/foto que no se pudo leer automáticamente — revísalo manualmente."
    );
  }

  return {
    id: email.id,
    type,
    counterparty: extractCounterparty(text, email.fromName || email.from),
    motivoVinculacion,
    urgency,
    summary,
    deadline,
    receivedAt: receivedAt.toISOString(),
    read: false,
    caseNumber: extractCaseNumber(text),
    senderEmail: email.from,
    aiSummaryPoints,
    originalEmailExcerpt: (email.body || email.snippet || "").replace(/\s+/g, " ").trim().slice(0, 500),
    hadAttachments: (email.attachments?.length || 0) > 0,
    attachmentUnreadable: anyUnreadable,
    classifiedBy: "heuristic",
  };
}

export async function classify(email, priorities) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return classifyHeuristic(email, priorities);
  }
  try {
    const { classifyWithAI } = await import("./ai-classifier.js");
    const result = await classifyWithAI(email, priorities);
    return result ? { ...result, classifiedBy: "ai" } : null;
  } catch (err) {
    console.error(`[classify] Falló la IA para el correo ${email.id}, usando reglas de respaldo:`, err.message);
    return classifyHeuristic(email, priorities);
  }
}
