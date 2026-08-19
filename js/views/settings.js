import { store } from "../state.js";
import { escapeHtml, deepClone } from "../util.js";
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

const debugLine = document.createElement("p");
debugLine.id = "settings-debug-line";
debugLine.style.cssText = "font-size:11px;opacity:0.55;margin-top:8px;";

function setDebug(text) {
  debugLine.textContent = text;
}

export function initSettings({ onConnected: connectedHandler }) {
  onConnected = connectedHandler;
  draft = deepClone(store.settings);
  store.subscribe(() => {
    // Only resync the draft from external changes (e.g. first load) when not mid-edit.
    if (!isDirty()) draft = deepClone(store.settings);
    render();
  });

  // Delegated listeners attached ONCE to the stable parent containers —
  // priorityRows/notificationRadios never get replaced, only their
  // innerHTML contents do, so this survives re-renders instead of being
  // re-attached (and potentially lost) on every render() call.
  priorityRows.addEventListener("change", (e) => {
    const input = e.target;
    if (input.tagName !== "INPUT" || input.type !== "radio") return;
    const seg = input.closest(".seg");
    if (!seg) return;
    draft.priorities[seg.dataset.type] = input.value;
    saveBtn.disabled = !isDirty();
    setDebug(`Cambio detectado: ${seg.dataset.type} = ${input.value}`);
  });

  notificationRadios.addEventListener("change", (e) => {
    const input = e.target;
    if (input.tagName !== "INPUT" || input.type !== "radio") return;
    draft.notificationMode = input.value;
    saveBtn.disabled = !isDirty();
    setDebug(`Cambio detectado: notificaciones = ${input.value}`);
  });

  saveBtn.insertAdjacentElement("afterend", debugLine);

  saveBtn.addEventListener("click", async () => {
    setDebug(`Guardando… (dirty=${isDirty()})`);
    try {
      store.saveSettings(deepClone(draft));
      saveBtn.disabled = true;
      const check = JSON.parse(localStorage.getItem("crediorbe.settings.v1") || "null");
      setDebug(`Guardado ✓ Desacato=${check?.priorities?.Desacato ?? "?"}`);
    } catch (err) {
      setDebug(`Error al guardar: ${err.message}`);
      throw err;
    }
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
    store.saveSettings(deepClone(draft));
    return;
  }
  btn.disabled = true;
  btn.textContent = "Conectando…";
  try {
    await gmail.connect();
    const profile = await gmail.fetchProfile();
    draft.mailbox = { email: profile.emailAddress, connected: true, provider: "gmail" };
    store.saveSettings(deepClone(draft));

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
}
