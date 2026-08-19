import { ProcessType, Urgency } from "./models.js";

const now = Date.now();
const minutesAgo = (n) => new Date(now - n * 60_000).toISOString();
const hoursAgo = (n) => new Date(now - n * 3_600_000).toISOString();
const daysFromNow = (n) => new Date(now + n * 86_400_000).toISOString();
const todayAt = (h, m) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export const mockItems = [
  {
    id: "p_001", type: ProcessType.DESACATO, counterparty: "Juzgado 12 Civil Municipal", urgency: Urgency.URGENTE,
    summary: "Auto de desacato por incumplimiento de tutela T-2291; riesgo de arresto para el representante legal.",
    deadline: todayAt(17, 0), receivedAt: minutesAgo(40), read: false, caseNumber: "2024-00187",
    senderEmail: "notificaciones@ramajudicial.gov.co",
    aiSummaryPoints: ["Se profiere auto de desacato por incumplimiento del fallo de tutela T-2291. El despacho ordena acreditar cumplimiento dentro de las próximas horas so pena de arresto para el representante legal."],
    originalEmailExcerpt: "…se REQUIERE al accionado dar cumplimiento inmediato a lo ordenado en el fallo de tutela T-2291…",
  },
  {
    id: "p_002", type: ProcessType.TUTELA, counterparty: "María Restrepo", urgency: Urgency.ALTA,
    summary: "Tutela por negativa de reporte a centrales de riesgo; los términos corren desde ayer.",
    deadline: daysFromNow(2), receivedAt: hoursAgo(1), read: false, caseNumber: "2026-00042",
    senderEmail: "notificaciones@ramajudicial.gov.co",
    aiSummaryPoints: ["La accionante solicita la corrección del reporte negativo en centrales de riesgo."],
    originalEmailExcerpt: "…se ADMITE la acción de tutela instaurada por María Restrepo contra Crediorbe…",
  },
  {
    id: "p_004", type: ProcessType.IMPUGNACION, counterparty: "Carlos Núñez", urgency: Urgency.MEDIA,
    summary: "Impugnación del fallo de primera instancia; se remite expediente a segunda instancia.",
    deadline: daysFromNow(5), receivedAt: hoursAgo(6), read: true, caseNumber: "2025-00298",
    senderEmail: "notificaciones@ramajudicial.gov.co",
    aiSummaryPoints: ["El fallo de primera instancia fue impugnado y el expediente fue remitido al superior jerárquico."],
    originalEmailExcerpt: "…en firme la impugnación presentada, se ordena la remisión del expediente…",
  },
  {
    id: "p_005", type: ProcessType.DERECHO_PETICION, counterparty: "Luisa Fernanda Gómez", urgency: Urgency.MEDIA,
    summary: "Derecho de petición solicitando copia del contrato y extracto de la deuda.",
    deadline: daysFromNow(10), receivedAt: hoursAgo(9), read: true, caseNumber: "2026-00063",
    senderEmail: "correo.legal@crediorbe.com",
    aiSummaryPoints: ["La peticionaria solicita copia del contrato original y un extracto detallado del estado de la deuda."],
    originalEmailExcerpt: "…solicito de manera respetuosa copia del contrato suscrito…",
  },
  {
    id: "p_006", type: ProcessType.REQUERIMIENTO, counterparty: "Superintendencia Financiera", urgency: Urgency.BAJA,
    summary: "Requerimiento de información periódica sobre indicadores de cartera del trimestre.",
    deadline: daysFromNow(15), receivedAt: hoursAgo(20), read: true, caseNumber: "SFC-2026-1187",
    senderEmail: "notificaciones@superfinanciera.gov.co",
    aiSummaryPoints: ["Se solicita el reporte trimestral de indicadores de cartera."],
    originalEmailExcerpt: "…en el marco de las funciones de inspección y vigilancia, se REQUIERE el envío del reporte trimestral…",
  },
];
