// Shared vocab — mirrors the SwiftUI models in CrediorbeMobile/CrediorbeMobile/Models/
// and the API contract in CrediorbeMobile/design/design_handoff_email_priority_ai_app/API_SPEC.md.

export const ProcessType = {
  DESACATO: "Desacato",
  TUTELA: "Tutela",
  IMPUGNACION: "Impugnación",
  DERECHO_PETICION: "Derecho de petición",
  REQUERIMIENTO: "Requerimiento",
};

export const Urgency = {
  URGENTE: "URGENTE",
  ALTA: "ALTA",
  MEDIA: "MEDIA",
  BAJA: "BAJA",
};

export const URGENCY_RANK = { URGENTE: 4, ALTA: 3, MEDIA: 2, BAJA: 1 };

export const PriorityWeight = { ALTA: "alta", MEDIA: "media", BAJA: "baja" };

export const NotificationMode = {
  TOP3: "top3",
  DIGEST: "digest",
  REALTIME: "realtime",
  AI: "ai",
};

export const NOTIFICATION_MODE_LABEL = {
  top3: "Solo los 3 más urgentes",
  digest: "Resumen a mediodía y al cierre",
  realtime: "En tiempo real, al detectarse",
  ai: "La IA decide el momento",
};

export const PROCESS_TYPE_ROW_LABEL = {
  [ProcessType.DESACATO]: "Desacatos",
  [ProcessType.TUTELA]: "Tutelas",
  [ProcessType.IMPUGNACION]: "Impugnaciones",
  [ProcessType.DERECHO_PETICION]: "Derechos de petición",
  [ProcessType.REQUERIMIENTO]: "Requerimientos",
};

export function defaultSettings() {
  return {
    mailbox: { email: "", connected: false, provider: "gmail" },
    priorities: {
      [ProcessType.DESACATO]: PriorityWeight.ALTA,
      [ProcessType.TUTELA]: PriorityWeight.ALTA,
      [ProcessType.IMPUGNACION]: PriorityWeight.MEDIA,
      [ProcessType.DERECHO_PETICION]: PriorityWeight.MEDIA,
      [ProcessType.REQUERIMIENTO]: PriorityWeight.BAJA,
    },
    notificationMode: NotificationMode.TOP3,
  };
}
