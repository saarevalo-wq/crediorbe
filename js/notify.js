// Two notification paths:
//  1. Foreground: while the installed app is open, we show notifications via
//     the service worker registration (`showNotification`) — this works on
//     iOS Safari even though the plain `Notification()` constructor doesn't.
//  2. Background (optional): true push-while-closed requires a server to
//     hold VAPID keys and push to a subscription — see server/. Without it,
//     iOS will only ever notify you while Crediorbe is open in the foreground.

import { CONFIG } from "./config.js";
import { NOTIFICATION_MODE_LABEL, URGENCY_RANK } from "./models.js";

export async function requestPermission() {
  if (!("Notification" in window)) return "unsupported";
  const perm = await Notification.requestPermission();
  return perm;
}

export function permissionState() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

async function showLocal(title, body, data) {
  if (Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.ready;
  reg.showNotification(title, {
    body,
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    data,
    tag: data?.processId,
  });
}

/** Decide which of the freshly-classified items deserve a notification, per notificationMode. */
export function itemsToNotify(newItems, mode) {
  if (mode === "realtime" || mode === "ai") {
    return newItems.filter((i) => URGENCY_RANK[i.urgency] >= URGENCY_RANK.ALTA);
  }
  if (mode === "top3") {
    return [...newItems].sort((a, b) => URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency]).slice(0, 3);
  }
  // "digest" is meant to batch at midday/close — for a foreground-only demo
  // we still surface urgent items immediately rather than silently drop them.
  return newItems.filter((i) => i.urgency === "URGENTE");
}

export async function notifyNewItems(items) {
  for (const item of items) {
    await showLocal(`${item.urgency === "URGENTE" ? "🔴 " : ""}${item.type} · ${item.urgency}`, `${item.counterparty} — ${item.summary}`, {
      processId: item.id,
    });
  }
}

// ---- Optional: real Web Push subscription (requires server/ deployed) ----

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function subscribeToPush() {
  if (!CONFIG.PUSH_BACKEND_URL || !CONFIG.VAPID_PUBLIC_KEY) {
    console.info("Push backend no configurado (CONFIG.PUSH_BACKEND_URL/VAPID_PUBLIC_KEY vacíos) — solo notificaciones en primer plano.");
    return null;
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(CONFIG.VAPID_PUBLIC_KEY),
  });
  await fetch(`${CONFIG.PUSH_BACKEND_URL}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub }),
  });
  return sub;
}

export { NOTIFICATION_MODE_LABEL };
