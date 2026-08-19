import "dotenv/config";
import express from "express";
import cors from "cors";
import webpush from "web-push";
import cron from "node-cron";
import { fetchJudicialEmails } from "./gmail.js";
import { classify } from "./classifier.js";
import {
  addSubscription,
  removeSubscription,
  getSubscriptions,
  getSettings,
  setSettings,
  getSeenIds,
  addSeenIds,
  getRefreshToken,
} from "./store.js";

const RANK = { URGENTE: 4, ALTA: 3, MEDIA: 2, BAJA: 1 };

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(process.env.VAPID_CONTACT_EMAIL, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
} else {
  console.warn("VAPID keys no configuradas — corre `npm run vapid` y complétalas en .env antes de recibir push reales.");
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, gmailConnected: !!getRefreshToken() }));

app.post("/subscribe", (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: "subscription inválida" });
  addSubscription(subscription);
  res.json({ ok: true });
});

app.post("/unsubscribe", (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) removeSubscription(endpoint);
  res.json({ ok: true });
});

app.get("/settings", (_req, res) => res.json(getSettings()));
app.put("/settings", (req, res) => {
  setSettings(req.body);
  res.json({ ok: true });
});

function itemsToNotify(newItems, mode) {
  if (mode === "realtime" || mode === "ai") {
    return newItems.filter((i) => RANK[i.urgency] >= RANK.ALTA);
  }
  if (mode === "top3") {
    return [...newItems].sort((a, b) => RANK[b.urgency] - RANK[a.urgency]).slice(0, 3);
  }
  return newItems.filter((i) => i.urgency === "URGENTE"); // "digest": don't drop urgent items between digests
}

async function pushToAll(item) {
  const payload = JSON.stringify({
    title: `${item.urgency === "URGENTE" ? "🔴 " : ""}${item.type} · ${item.urgency}`,
    body: `${item.counterparty} — ${item.summary}`,
    processId: item.id,
  });
  const subs = getSubscriptions();
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, payload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) removeSubscription(sub.endpoint);
      else console.error("push error:", err.message);
    }
  }
}

async function pollAndNotify() {
  if (!getRefreshToken()) return; // Gmail not connected server-side yet — run `npm run auth`
  try {
    const settings = getSettings();
    const emails = await fetchJudicialEmails();
    const classified = emails.map((e) => classify(e, settings.priorities)).filter(Boolean);

    const seen = getSeenIds();
    const fresh = classified.filter((i) => !seen.has(i.id));
    if (fresh.length === 0) return;

    const toNotify = itemsToNotify(fresh, settings.notificationMode);
    for (const item of toNotify) await pushToAll(item);

    addSeenIds(fresh.map((i) => i.id));
    console.log(`[poll] ${classified.length} clasificados, ${fresh.length} nuevos, ${toNotify.length} notificados.`);
  } catch (err) {
    console.error("[poll] error:", err.message);
  }
}

const cronExpr = process.env.POLL_CRON || "*/15 * * * *";
cron.schedule(cronExpr, pollAndNotify);

const port = process.env.PORT || 8788;
app.listen(port, () => {
  console.log(`Crediorbe push server escuchando en :${port} (poll: "${cronExpr}")`);
  pollAndNotify(); // also run once on boot
});
