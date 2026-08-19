import { store } from "../state.js";
import { escapeHtml, relativeTime, daysRemainingLabel, tagClass } from "../util.js";
import { ProcessType } from "../models.js";

const listEl = document.getElementById("procesos-list");
const typeFilterEl = document.getElementById("procesos-type-filter");

let onOpenItem = () => {};
let typeFilter = "todos";

export function initProcesos({ onOpenItem: openHandler }) {
  onOpenItem = openHandler;

  typeFilterEl.innerHTML =
    `<option value="todos">Todos los tipos</option>` +
    Object.values(ProcessType)
      .map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`)
      .join("");

  typeFilterEl.addEventListener("change", (e) => {
    typeFilter = e.target.value;
    renderProcesos();
  });

  listEl.addEventListener("click", (e) => {
    const row = e.target.closest("[data-id]");
    if (row) onOpenItem(row.dataset.id);
  });

  store.subscribe(renderProcesos);
  renderProcesos();
}

function renderProcesos() {
  const items = store.items
    .filter((i) => typeFilter === "todos" || i.type === typeFilter)
    // Soonest deadline first; items without a detected deadline sort last.
    .sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    });

  if (items.length === 0) {
    listEl.innerHTML = `<div class="empty-state">No hay procesos${typeFilter === "todos" ? "" : ` de tipo "${escapeHtml(typeFilter)}"`}.</div>`;
    return;
  }

  listEl.innerHTML = items.map(rowHtml).join("");
}

function rowHtml(item) {
  const overdue = item.deadline && new Date(item.deadline) < new Date();
  return `
    <article class="process-card" data-id="${escapeHtml(item.id)}">
      <div class="process-top-row">
        <span class="tag ${tagClass(item.urgency)}">${escapeHtml(item.type)}</span>
        <span class="process-time">${relativeTime(item.receivedAt)}</span>
      </div>
      <h4 class="process-title">${escapeHtml(item.counterparty)}</h4>
      <div class="process-meta" style="font-weight:600; ${overdue ? "color:var(--color-accent-700);" : ""}">
        ${escapeHtml(daysRemainingLabel(item.deadline))}
      </div>
    </article>`;
}
