import { store } from "../state.js";
import { escapeHtml, relativeTime, deadlineLabel, tagClass } from "../util.js";

const contentEl = document.getElementById("detail-content");
const actionsEl = document.getElementById("detail-actions");

let currentItem = null;
let onBack = () => {};

export function initDetail({ onBack: backHandler }) {
  onBack = backHandler;
  document.getElementById("detail-back").addEventListener("click", () => onBack());
}

export function renderDetail(id) {
  const item = store.items.find((i) => i.id === id);
  if (!item) return;
  currentItem = item;
  store.markRead(id);

  contentEl.innerHTML = `
    <span class="tag ${tagClass(item.urgency)}">${escapeHtml(item.urgency)} · ${escapeHtml(item.type.toUpperCase())}</span>
    <h3 style="margin-top:12px;">${escapeHtml(item.type)} — ${escapeHtml(item.counterparty)}</h3>

    <div class="detail-meta-grid">
      <div><p class="meta-label">Radicado</p><p class="meta-value">${escapeHtml(item.caseNumber || "—")}</p></div>
      <div><p class="meta-label">Plazo</p><p class="meta-value">${escapeHtml(deadlineLabel(item.deadline))}</p></div>
      <div><p class="meta-label">Remitente</p><p class="meta-value">${escapeHtml(item.senderEmail)}</p></div>
      <div><p class="meta-label">Recibido</p><p class="meta-value">${relativeTime(item.receivedAt)}</p></div>
    </div>

    <div class="hr"></div>

    ${
      item.motivoVinculacion
        ? `<span class="kicker">Motivo de vinculación</span>
           <div class="card" style="margin-bottom:16px;"><p style="margin:0;font-size:13.5px;">${escapeHtml(item.motivoVinculacion)}</p></div>`
        : item.attachmentUnreadable
        ? `<div class="card" style="margin-bottom:16px; border-color:var(--color-accent-700, #b45309);"><p style="margin:0;font-size:13px;">⚠️ Este correo trae un documento adjunto que parece escaneado/foto y no se pudo leer automáticamente. Ábrelo manualmente para confirmar el motivo y el plazo.</p></div>`
        : !item.hadAttachments
        ? `<div class="card" style="margin-bottom:16px; opacity:0.75;"><p style="margin:0;font-size:13px;">Este correo no traía documentos adjuntos, así que no se pudo determinar el motivo exacto de vinculación.</p></div>`
        : ""
    }

    <span class="kicker">Resumen IA</span>
    ${item.aiSummaryPoints.map((p) => `<div class="card" style="margin-bottom:8px;"><p style="margin:0;font-size:13.5px;">${escapeHtml(p)}</p></div>`).join("")}

    <div style="margin-top:16px;">
      <span class="kicker">Correo original</span>
      <div class="card excerpt-card"><p>${escapeHtml(item.originalEmailExcerpt || "(sin contenido)")}</p></div>
    </div>
  `;

  actionsEl.innerHTML = `
    <button class="btn btn-primary" id="act-reply">Responder al juzgado</button>
    <div class="action-bar-row">
      <button class="btn btn-secondary" id="act-handled">Marcar atendido</button>
      <button class="btn btn-ghost" id="act-escalate">Escalar a legal</button>
    </div>
  `;
  document.getElementById("act-reply").addEventListener("click", () => toast("Acción registrada (mock): responder al juzgado."));
  document.getElementById("act-handled").addEventListener("click", () => toast("Marcado como atendido (mock)."));
  document.getElementById("act-escalate").addEventListener("click", () => toast("Escalado a legal (mock)."));
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}
