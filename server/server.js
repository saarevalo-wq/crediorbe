import "dotenv/config";
import express from "express";
import cors from "cors";
import webpush from "web-push";
import { google } from "googleapis";
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
  setRefreshToken,
} from "./store.js";

const RANK = { URGENTE: 4, ALTA: 3, MEDIA: 2, BAJA: 1 };

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(process.env.VAPID_CONTACT_EMAIL, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
} else {
  console.warn("VAPID keys no configuradas — corre `npm run vapid` y complétalas antes de recibir push reales.");
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", async (_req, res) => res.json({ ok: true, gmailConnected: !!(await getRefreshToken()) }));

// ---- One-time Gmail connection (visit /auth/google once in a browser —
// no local Node/CLI needed, this runs entirely on the deployed server) ----
function oauthClient() {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
}

app.get("/auth/google", (_req, res) => {
  const url = oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces a refresh_token even on repeat visits
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
  });
  res.redirect(url);
});

app.get("/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("Falta el parámetro 'code'.");
  try {
    const { tokens } = await oauthClient().getToken(code);
    await setRefreshToken(tokens.refresh_token);
    res.send("<h1>Listo</h1><p>Gmail conectado. Ya puedes cerrar esta pestaña.</p>");
  } catch (err) {
    res.status(500).send(`Error obteniendo el token: ${err.message}`);
  }
});

app.post("/subscribe", async (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: "subscription inválida" });
  await addSubscription(subscription);
  res.json({ ok: true });
});

app.post("/unsubscribe", async (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) await removeSubscription(endpoint);
  res.json({ ok: true });
});

app.get("/settings", async (_req, res) => res.json(await getSettings()));
app.put("/settings", async (req, res) => {
  await setSettings(req.body);
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
  const subs = await getSubscriptions();
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, payload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) await removeSubscription(sub.endpoint);
      else console.error("push error:", err.message);
    }
  }
}

async function pollAndNotify() {
  if (!(await getRefreshToken())) return { skipped: "gmail not connected" };
  const settings = await getSettings();
  const emails = await fetchJudicialEmails();
  const classifiedAll = await Promise.all(emails.map((e) => classify(e, settings.priorities)));
  const classified = classifiedAll.filter(Boolean);

  const seen = await getSeenIds();
  const fresh = classified.filter((i) => !seen.has(i.id));
  if (fresh.length === 0) return { classified: classified.length, fresh: 0, notified: 0 };

  const toNotify = itemsToNotify(fresh, settings.notificationMode);
  for (const item of toNotify) await pushToAll(item);
  await addSeenIds(fresh.map((i) => i.id));

  return { classified: classified.length, fresh: fresh.length, notified: toNotify.length };
}

// ---- Poll endpoint — triggered by Cloud Scheduler (every 15 min, see the
// deploy workflow), not by an in-process timer, since Cloud Run scales to
// zero between requests and can't run a background interval on its own. ----
app.get("/poll", async (req, res) => {
  if (process.env.POLL_SECRET && req.get("X-Poll-Secret") !== process.env.POLL_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const result = await pollAndNotify();
    console.log("[poll]", result);
    res.json(result);
  } catch (err) {
    console.error("[poll] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 8788;
app.listen(port, () => {
  console.log(`Crediorbe push server escuchando en :${port}`);
});
