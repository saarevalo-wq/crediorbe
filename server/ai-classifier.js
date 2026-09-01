// AI-based classifier — reads the full email AND its attachments (autos
// admisorios, requerimientos, etc., usually PDFs, sometimes scanned/photos)
// with Claude, since the information that actually matters — why we're
// being summoned, the real counterparty, the deadline — normally lives in
// the attached document, not in the email body itself.
//
// Replaces the old keyword/regex classifier (see git history) now that a
// backend exists to hold the API key. Claude reads PDFs natively (both
// text-based and scanned/image PDFs — no separate OCR step needed), so we
// just hand it the raw attachment bytes as document blocks.

import Anthropic from "@anthropic-ai/sdk";
import { ProcessType, Urgency } from "./classifier.js";
import { addBusinessDays } from "./holidays-co.js";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

let anthropic = null;
function client() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Falta ANTHROPIC_API_KEY en las variables de entorno del servidor.");
  }
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic;
}

const RANK = { URGENTE: 4, ALTA: 3, MEDIA: 2, BAJA: 1 };
const RANK_TO_LEVEL = { 4: Urgency.URGENTE, 3: Urgency.ALTA, 2: Urgency.MEDIA, 1: Urgency.BAJA };

function applyPriorityWeight(baseUrgency, weight) {
  let rank = RANK[baseUrgency] || RANK.MEDIA;
  if (weight === "alta") rank = Math.max(rank, RANK.ALTA);
  if (weight === "baja") rank = Math.min(rank, RANK.MEDIA);
  return RANK_TO_LEVEL[rank];
}

const CLASSIFY_TOOL = {
  name: "clasificar_proceso",
  description:
    "Registra la clasificación de un correo de notificación judicial/regulatoria colombiana, usando tanto el " +
    "cuerpo del correo como el contenido completo de sus documentos adjuntos (autos admisorios, requerimientos, etc.).",
  input_schema: {
    type: "object",
    properties: {
      es_proceso_judicial: {
        type: "boolean",
        description:
          "true si esto es realmente una notificación judicial/regulatoria que requiere acción (tutela, desacato, " +
          "impugnación, derecho de petición, requerimiento, demanda SIC, etc.). false para correos irrelevantes " +
          "(spam, boletines, confirmaciones genéricas sin acción requerida).",
      },
      tipo: {
        type: "string",
        enum: Object.values(ProcessType),
        description: "El tipo de proceso que mejor describe este caso.",
      },
      urgencia: {
        type: "string",
        enum: Object.values(Urgency),
        description:
          "Qué tan urgente es responder, según el contenido real del documento (plazos cortos, amenaza de arresto " +
          "por desacato, etc.), independientemente de prioridades configuradas por el usuario.",
      },
      contraparte: {
        type: "string",
        description:
          "El nombre real de la persona, empresa o entidad que instauró la acción o por la cual nos están " +
          "vinculando — sacado del documento adjunto cuando esté disponible, NO simplemente el remitente del correo " +
          "(que suele ser el juzgado o una dirección de notificaciones, no la contraparte real).",
      },
      motivo_vinculacion: {
        type: "string",
        description:
          "Explicación breve (2-4 frases) de POR QUÉ nos están vinculando o notificando: los hechos concretos del " +
          "caso según el auto admisorio o documento adjunto — qué se alega, qué se pide, en qué calidad nos vinculan. " +
          "Esta es la parte más importante: casi nunca está en el cuerpo del correo, está en el adjunto.",
      },
      numero_radicado: {
        type: "string",
        description: "Número de radicado/expediente si se encuentra en el correo o el adjunto. \"—\" si no aparece.",
      },
      plazo_cantidad: {
        type: ["integer", "null"],
        description:
          "Cantidad numérica del plazo para responder (ej. 10 para \"diez (10) días\", 48 para \"48 horas\"). " +
          "null si el documento no establece un plazo explícito o no se pudo determinar.",
      },
      plazo_unidad: {
        type: ["string", "null"],
        enum: ["horas", "dias", null],
        description: "Unidad del plazo detectado. \"dias\" son días hábiles judiciales colombianos. null si no aplica.",
      },
      resumen: {
        type: "string",
        description: "Resumen de una sola línea (máx. 180 caracteres) para mostrar en la lista de bandeja de entrada.",
      },
      puntos_clave: {
        type: "array",
        items: { type: "string" },
        description: "3-5 puntos clave (frases cortas) para la sección \"Resumen IA\" del detalle del proceso.",
      },
    },
    required: [
      "es_proceso_judicial",
      "tipo",
      "urgencia",
      "contraparte",
      "motivo_vinculacion",
      "numero_radicado",
      "plazo_cantidad",
      "plazo_unidad",
      "resumen",
      "puntos_clave",
    ],
  },
};

function buildContentBlocks(email) {
  const blocks = [
    {
      type: "text",
      text:
        `Correo recibido: ${email.receivedAt}\n` +
        `De: ${email.fromName || ""} <${email.from}>\n` +
        `Asunto: ${email.subject}\n\n` +
        `Cuerpo del correo:\n${email.body || email.snippet || "(sin cuerpo de texto)"}\n\n` +
        (email.attachments?.length
          ? `Este correo tiene ${email.attachments.length} documento(s) adjunto(s) — léelos completos, ahí suele estar la información real del caso.`
          : "Este correo no tiene documentos adjuntos legibles."),
    },
  ];
  for (const att of email.attachments || []) {
    if (att.mimeType === "application/pdf") {
      blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: att.data } });
    } else {
      blocks.push({ type: "image", source: { type: "base64", media_type: att.mimeType, data: att.data } });
    }
  }
  return blocks;
}

const SYSTEM_PROMPT =
  "Eres un asistente legal que triagea correos de notificaciones judiciales y regulatorias colombianas " +
  "(tutelas, desacatos, impugnaciones, derechos de petición, requerimientos, demandas ante la SIC) para una " +
  "empresa. Tu trabajo es leer el correo Y CUALQUIER DOCUMENTO ADJUNTO (los autos admisorios casi siempre vienen " +
  "adjuntos, no en el cuerpo del correo) y extraer la información que un abogado necesitaría de un vistazo: de qué " +
  "se trata, por qué a la empresa la están vinculando, quién es la contraparte real, y cuánto tiempo hay para " +
  "responder. Sé preciso citando lo que dice el documento — no inventes plazos ni motivos que no estén soportados " +
  "por el texto. Usa siempre la herramienta clasificar_proceso para responder.";

export async function classifyWithAI(email, priorities) {
  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    tools: [CLASSIFY_TOOL],
    tool_choice: { type: "tool", name: "clasificar_proceso" },
    messages: [{ role: "user", content: buildContentBlocks(email) }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) throw new Error("Claude no devolvió una clasificación estructurada.");
  const result = toolUse.input;

  if (!result.es_proceso_judicial) return null;

  const receivedAt = new Date(email.receivedAt);
  let deadline = null;
  if (result.plazo_cantidad && result.plazo_unidad) {
    deadline =
      result.plazo_unidad === "horas"
        ? new Date(receivedAt.getTime() + result.plazo_cantidad * 3600_000).toISOString()
        : (await addBusinessDays(receivedAt, result.plazo_cantidad)).toISOString();
  }

  const urgency = applyPriorityWeight(result.urgencia, priorities?.[result.tipo] || "media");

  return {
    id: email.id,
    type: result.tipo,
    counterparty: result.contraparte || email.fromName || email.from,
    motivoVinculacion: result.motivo_vinculacion,
    urgency,
    summary: (result.resumen || "").slice(0, 180),
    deadline,
    receivedAt: receivedAt.toISOString(),
    read: false,
    caseNumber: result.numero_radicado || "—",
    senderEmail: email.from,
    aiSummaryPoints: result.puntos_clave?.length ? result.puntos_clave : [result.resumen],
    originalEmailExcerpt: (email.body || email.snippet || "").replace(/\s+/g, " ").trim().slice(0, 500),
    hadAttachments: (email.attachments?.length || 0) > 0,
  };
}
