// Upstash Redis persistence (REST-based, no connection pooling needed —
// works well from a serverless/scale-to-zero style host like Render's free
// tier). Everything lives under one key since this server is single-user.
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const KEY = "crediorbe:state";

const DEFAULT_DATA = {
  refreshToken: null,
  subscriptions: [], // Web Push subscription objects
  settings: {
    priorities: {
      Desacato: "alta",
      Tutela: "alta",
      "Respuesta a tutela": "alta",
      "Impugnación": "media",
      "Derecho de petición": "media",
      Requerimiento: "baja",
      "Demanda SIC": "alta",
    },
    notificationMode: "top3",
  },
  seenIds: [], // Gmail message ids already considered for a push
};

async function readAll() {
  const stored = await redis.get(KEY);
  if (!stored) return structuredClone(DEFAULT_DATA);
  return { ...structuredClone(DEFAULT_DATA), ...stored };
}

async function writeAll(data) {
  await redis.set(KEY, data);
}

export async function getRefreshToken() {
  return (await readAll()).refreshToken;
}
export async function setRefreshToken(token) {
  const data = await readAll();
  data.refreshToken = token;
  await writeAll(data);
}

export async function addSubscription(sub) {
  const data = await readAll();
  const exists = data.subscriptions.some((s) => s.endpoint === sub.endpoint);
  if (!exists) data.subscriptions.push(sub);
  await writeAll(data);
}
export async function removeSubscription(endpoint) {
  const data = await readAll();
  data.subscriptions = data.subscriptions.filter((s) => s.endpoint !== endpoint);
  await writeAll(data);
}
export async function getSubscriptions() {
  return (await readAll()).subscriptions;
}

export async function getSettings() {
  return (await readAll()).settings;
}
export async function setSettings(settings) {
  const data = await readAll();
  data.settings = settings;
  await writeAll(data);
}

export async function getSeenIds() {
  return new Set((await readAll()).seenIds);
}
export async function addSeenIds(ids) {
  const data = await readAll();
  const set = new Set(data.seenIds);
  ids.forEach((id) => set.add(id));
  // Keep the last 500 to bound the stored blob's size.
  data.seenIds = [...set].slice(-500);
  await writeAll(data);
}
