// Minimal JSON-file persistence — this server is meant for a single person's
// mailbox, so a flat file is enough. Swap for a real database if you ever
// need multi-user support.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data.json");

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

function readAll() {
  if (!fs.existsSync(DATA_FILE)) return structuredClone(DEFAULT_DATA);
  try {
    return { ...structuredClone(DEFAULT_DATA), ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) };
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

function writeAll(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

export function getRefreshToken() {
  return readAll().refreshToken;
}
export function setRefreshToken(token) {
  const data = readAll();
  data.refreshToken = token;
  writeAll(data);
}

export function addSubscription(sub) {
  const data = readAll();
  const exists = data.subscriptions.some((s) => s.endpoint === sub.endpoint);
  if (!exists) data.subscriptions.push(sub);
  writeAll(data);
}
export function removeSubscription(endpoint) {
  const data = readAll();
  data.subscriptions = data.subscriptions.filter((s) => s.endpoint !== endpoint);
  writeAll(data);
}
export function getSubscriptions() {
  return readAll().subscriptions;
}

export function getSettings() {
  return readAll().settings;
}
export function setSettings(settings) {
  const data = readAll();
  data.settings = settings;
  writeAll(data);
}

export function getSeenIds() {
  return new Set(readAll().seenIds);
}
export function addSeenIds(ids) {
  const data = readAll();
  const set = new Set(data.seenIds);
  ids.forEach((id) => set.add(id));
  // Keep the last 500 to bound file growth.
  data.seenIds = [...set].slice(-500);
  writeAll(data);
}
