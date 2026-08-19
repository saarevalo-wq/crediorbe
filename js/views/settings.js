import { store } from "../state.js";
import { escapeHtml } from "../util.js";
import { PROCESS_TYPE_ROW_LABEL, NOTIFICATION_MODE_LABEL, ProcessType, NotificationMode } from "../models.js";
import * as gmail from "../gmail.js";
import { requestPermission, subscribeToPush } from "../notify.js";
import { CONFIG } from "../config.js";

const mailboxCard = document.getElementById("mailbox-card");
const priorityRows = document.getElementById("priority-rows");
const notificationRadios = document.getElementById("notification-radios");
const saveBtn = document.getElementById("save-settings");

let draft = null; // local edit buffer; committed to store.settings on Save
let onConnected = () => {};

function isDirty() {
  return JSON.stringify(draft) !== JSON.stringify(store.settings);
}

export function initSettings({ onConnected: connectedHandler }) {
  onConnected = connectedHandler;
  draft = structuredClone(store.settings);
  store.subscribe(() => {
    // Only resync the draft from external changes (e.g. first load) when not mid-edit.
    if (!isDirty()) draft = structuredClone(store.settings);
    render();
  });
  saveBtn.addEventListener("click", async () => {
    store.saveSettings(structuredClone(draft));
    saveBtn.disabled = true;
    if (CONFIG.PUSH_BACKEND_URL) {
      // Keep the background poller's notification rules in sync with what
      // the user configured here (it can't read localStorage on the phone).
      fetch(`${CONFIG.PUSH_BACKEND_URL}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priorities: draft.priorities, notificationMode: draft.notificationMode }),
      }).catch((err) => console.warn("No se pudo sincronizar ajustes con el backend de push:", err.message));
    }
  });
  render();
}

function render() {
  renderMailbox();
  renderPriorities();
  renderNotifications();
  saveBtn.disabled = !isDirty();
}

function renderMailbox() {
  const m = draft.mailbox;
  mailboxCard.innerHTML = `
    <div>
      <p class="mailbox-email">${m.connected ? escapeHtml(m.email) : "Ninguna cuenta conectada"}</p>
      <div class="status-row">
        <span class="status-dot ${m.connected ? "connected" : ""}"></span>
        <span class="status-label">${m.connected ? "Conectado" : "Desconectado"}</span>
      </div>
    </div>
    <button class="btn btn-secondary" id="toggle-connect">${m.connected ? "Desconectar" : "Conectar Gmail"}</button>
  `;
  document.getElementById("toggle-connect").addEventListener("click", handleToggleConnect);
}

async function handleToggleConnect() {
  const btn = document.getElementById("toggle-connect");
  if (draft.mailbox.connected) {
    gmail.disconnect();
    draft.mailbox = { ...draft.mailbox, connected: false, email: "" };
    store.saveSettings(structuredClone(draft));
    return;
  }
  btn.disabled = true;
  btn.textContent = "Conectando…";
  try {
    await gmail.connect();
    const profile = await gmail.fetchProfile();
    draft.mailbox = { email: profile.emailAddress, connected: true, provider: "gmail" };
    store.saveSettings(structuredClone(draft));

    const perm = await requestPermission();
    if (perm === "granted") await subscribeToPush().catch(() => {});

    onConnected();
  } catch (err) {
    alert(`No se pudo conectar con Gmail: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
}

function renderPriorities() {
  priorityRows.innerHTML = Object.values(ProcessType)
    .map(
      (type) => `
    <div class="priority-row">
      <span>${escapeHtml(PROCESS_TYPE_ROW_LABEL[type])}</span>
      <div class="seg" data-type="${escapeHtml(type)}">
        ${["alta", "media", "baja"]
          .map(
            (w) => `<label class="seg-opt"><input type="radio" name="pri-${escapeHtml(type)}" value="${w}" ${draft.priorities[type] === w ? "checked" : ""}><span>${w[0].toUpperCase() + w.slice(1)}</span></label>`
          )
          .join("")}
      </div>
    </div>`
    )
    .join("");

  priorityRows.querySelectorAll(".seg").forEach((seg) => {
    seg.addEventListener("change", (e) => {
      draft.priorities[seg.dataset.type] = e.target.value;
      saveBtn.disabled = !isDirty();
    });
  });
}

function renderNotifications() {
  notificationRadios.innerHTML = Object.values(NotificationMode)
    .map(
      (mode) => `
    <label class="radio">
      <input type="radio" name="notif-mode" value="${mode}" ${draft.notificationMode === mode ? "checked" : ""}>
      <span class="dot"></span>
      ${escapeHtml(NOTIFICATION_MODE_LABEL[mode])}
    </label>`
    )
    .join("");

  notificationRadios.querySelectorAll('input[name="notif-mode"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      draft.notificationMode = e.target.value;
      saveBtn.disabled = !isDirty();
    });
  });
}
