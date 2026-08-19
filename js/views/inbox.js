import { store } from "../state.js";
import { escapeHtml, relativeTime, deadlineLabel, tagClass } from "../util.js";

const listEl = document.getElementById("inbox-list");
const gateEl = document.getElementById("inbox-connect-gate");
const errorEl = document.getElementById("inbox-error");
const unreadPill = document.getElementById("unread-pill");
const unreadLabel = document.getElementById("unread-count-label");

let onOpenItem = () => {};
let lastError = null;

export function initInbox({ onOpenItem: openHandler, onGoToSettings }) {
  onOpenItem = openHandler;
  document.getElementById("connect-gate-btn").addEventListener("click", onGoToSettings);

  document.getElementById("inbox-filter").addEventListener("change", (e) => {
    if (e.target.name === "filter") {
      store.filter = e.target.value;
      renderInbox();
    }
  });

  listEl.addEventListener("click", (e) => {
    const card = e.target.closest("[data-id]");
    if (card) onOpenItem(card.dataset.id);
  });

  store.subscribe(renderInbox);
  renderInbox();
}

export function setInboxError(message) {
  lastError = message;
  renderInbox();
}

function renderInbox() {
  const connected = store.settings.mailbox.connected || store.demo;
  gateEl.hidden = connected;
  listEl.hidden = !connected;

  errorEl.innerHTML = lastError
    ? `<div class="error-banner"><span>${escapeHtml(lastError)}</span><button class="btn btn-secondary" id="retry-btn">Reintentar</button></div>`
    : "";
  if (lastError) {
    document.getElementById("retry-btn")?.addEventListener("click", () => {
      lastError = null;
      window.dispatchEvent(new CustomEvent("crediorbe:refresh"));
    });
  }

  const count = store.unreadCount;
  unreadPill.hidden = count === 0;
  unreadLabel.textContent = `${count} sin leer`;

  if (!connected) return;

  const items = store.filteredItems;
  if (items.length === 0) {
    listEl.innerHTML = `<div class="empty-state">No hay procesos pendientes.</div>`;
    return;
  }

  listEl.innerHTML = items.map(cardHtml).join("");
}

function cardHtml(item) {
  return `
    <article class="process-card" data-id="${escapeHtml(item.id)}">
      <div class="process-top-row">
        <span class="tag ${tagClass(item.urgency)}">${escapeHtml(item.urgency)}</span>
        <span class="process-time">${relativeTime(item.receivedAt)}</span>
      </div>
      <h4 class="process-title">${escapeHtml(item.type)} — ${escapeHtml(item.counterparty)}</h4>
      <p class="process-summary">${escapeHtml(item.summary)}</p>
      <div class="process-meta">Plazo: ${escapeHtml(deadlineLabel(item.deadline))}</div>
    </article>`;
}
