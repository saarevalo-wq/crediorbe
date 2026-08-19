import { store } from "./state.js";
import { initRouter, goTo } from "./router.js";
import { initInbox, setInboxError } from "./views/inbox.js";
import { initProcesos } from "./views/procesos.js";
import { initCalendario } from "./views/calendario.js";
import { initDetail, renderDetail } from "./views/detail.js";
import { initSettings } from "./views/settings.js";
import { classify } from "./classifier.js";
import * as gmail from "./gmail.js";
import { itemsToNotify, notifyNewItems } from "./notify.js";
import { mockItems } from "./mock.js";

const POLL_INTERVAL_MS = 5 * 60_000; // while the app is open/foregrounded

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch((err) => console.error("SW register failed", err));
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "open-process" && event.data.id) {
      renderDetail(event.data.id);
      goTo("detail");
    }
  });
}

initRouter();

initInbox({
  onOpenItem: (id) => {
    renderDetail(id);
    goTo("detail");
  },
  onGoToSettings: () => goTo("settings"),
});

initProcesos({
  onOpenItem: (id) => {
    renderDetail(id);
    goTo("detail");
  },
});

initCalendario({
  onOpenItem: (id) => {
    renderDetail(id);
    goTo("detail");
  },
});

initDetail({ onBack: () => goTo("inbox") });

initSettings({
  onConnected: () => {
    goTo("inbox");
    refresh();
  },
});

document.getElementById("connect-gate-demo-btn").addEventListener("click", () => {
  store.enableDemo(mockItems);
});

window.addEventListener("crediorbe:refresh", refresh);

async function refresh() {
  if (!gmail.isConnected()) return;
  try {
    const emails = await gmail.fetchJudicialEmails();
    const classifiedAll = await Promise.all(emails.map((e) => classify(e, store.settings.priorities)));
    const classified = classifiedAll.filter(Boolean);

    const previousIds = new Set(store.items.map((i) => i.id));
    store.setItems(classified);
    setInboxError(null);

    const newlyArrived = classified.filter((i) => !previousIds.has(i.id));
    const unseen = store.takeUnseen(newlyArrived.map((i) => i.id));
    const toNotify = itemsToNotify(newlyArrived.filter((i) => unseen.includes(i.id)), store.settings.notificationMode);
    if (toNotify.length) await notifyNewItems(toNotify);
  } catch (err) {
    setInboxError(err.message || "No se pudo sincronizar el correo.");
  }
}

// Initial load + periodic foreground refresh (real background push needs the
// optional server/ backend — see BUILD.md).
if (store.settings.mailbox.connected && gmail.isConnected()) {
  refresh();
}
setInterval(() => {
  if (document.visibilityState === "visible") refresh();
}, POLL_INTERVAL_MS);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refresh();
});
