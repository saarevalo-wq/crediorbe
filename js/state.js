import { defaultSettings } from "./models.js";

const SETTINGS_KEY = "crediorbe.settings.v1";
const ITEMS_KEY = "crediorbe.items.v1";
const READ_KEY = "crediorbe.readIds.v1";
const SEEN_KEY = "crediorbe.seenIds.v1"; // ids already considered for notifications

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

class Store {
  constructor() {
    this.settings = load(SETTINGS_KEY, defaultSettings());
    this.items = load(ITEMS_KEY, []);
    this.readIds = new Set(load(READ_KEY, []));
    this.seenIds = new Set(load(SEEN_KEY, []));
    this.filter = "todos";
    this.demo = false;
    this.listeners = new Set();
  }

  enableDemo(items) {
    this.demo = true;
    this.setItems(items);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    this.listeners.forEach((fn) => fn(this));
  }

  saveSettings(settings) {
    this.settings = settings;
    save(SETTINGS_KEY, this.settings);
    this.emit();
  }

  setItems(items) {
    this.items = items.map((item) => ({ ...item, read: this.readIds.has(item.id) }));
    save(ITEMS_KEY, this.items);
    this.emit();
  }

  markRead(id) {
    this.readIds.add(id);
    save(READ_KEY, [...this.readIds]);
    const item = this.items.find((i) => i.id === id);
    if (item) item.read = true;
    save(ITEMS_KEY, this.items);
    this.emit();
  }

  /** New ids not yet considered for a notification. Marks them seen as a side effect. */
  takeUnseen(ids) {
    const fresh = ids.filter((id) => !this.seenIds.has(id));
    fresh.forEach((id) => this.seenIds.add(id));
    save(SEEN_KEY, [...this.seenIds]);
    return fresh;
  }

  get unreadCount() {
    return this.items.filter((i) => !i.read).length;
  }

  get filteredItems() {
    const sorted = [...this.items].sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
    if (this.filter === "urgente") return sorted.filter((i) => i.urgency === "URGENTE");
    if (this.filter === "sinleer") return sorted.filter((i) => !i.read);
    return sorted;
  }
}

export const store = new Store();
