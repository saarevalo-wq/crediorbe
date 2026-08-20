// Firestore-backed persistence. A local JSON file (the original design)
// doesn't survive Cloud Run's scale-to-zero — each cold start gets a fresh,
// empty filesystem — so this needs a real database instead. Everything
// lives in a single document since this server is single-user.
//
// Uses Application Default Credentials: on Cloud Run this is automatic via
// the service's own identity (needs the "Cloud Datastore User" role — see
// server/README.md). No service account key file needed.
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const docRef = db.collection("crediorbe").doc("state");

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
  const snap = await docRef.get();
  if (!snap.exists) return structuredClone(DEFAULT_DATA);
  return { ...structuredClone(DEFAULT_DATA), ...snap.data() };
}

async function writeAll(data) {
  await docRef.set(data);
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
  // Keep the last 500 to bound document growth.
  data.seenIds = [...set].slice(-500);
  await writeAll(data);
}
