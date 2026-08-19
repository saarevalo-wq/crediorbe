// Server-side port of ../js/classifier.js (identical logic, no DOM
// dependency in the original so this is a straight copy) — used by the
// background poller since it can't import browser-served modules directly.
// Keep both in sync if you tune the classification rules.

import { addBusinessDays } from "./holidays-co.js";

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

export async function classify(email, priorities) {
  const text = `${email.subject}\n${email.body || email.snippet}`;
  const type = detectType(text);
  if (!type) return null;

  let urgency = BASE_URGENCY[type];
  if (type === ProcessType.DESACATO && URGENT_SIGNALS.some((p) => p.test(text))) {
    urgency = Urgency.URGENTE;
  }
  urgency = applyPriorityWeight(urgency, priorities[type] || "media");

  const receivedAt = new Date(email.receivedAt);
  const deadline = await detectDeadline(text, receivedAt);
  const summary = (email.snippet || text).replace(/\s+/g, " ").trim().slice(0, 180);

  return {
    id: email.id,
    type,
    counterparty: email.fromName || email.from,
    urgency,
    summary,
    deadline,
    receivedAt: receivedAt.toISOString(),
    read: false,
    caseNumber: extractCaseNumber(text),
    senderEmail: email.from,
    aiSummaryPoints: [summary],
    originalEmailExcerpt: (email.body || email.snippet || "").replace(/\s+/g, " ").trim().slice(0, 500),
  };
}
