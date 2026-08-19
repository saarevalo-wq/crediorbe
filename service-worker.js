const CACHE = "crediorbe-v4";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/modernist-styles.css",
  "./css/app.css",
  "./js/app.js",
  "./js/config.js",
  "./js/models.js",
  "./js/state.js",
  "./js/classifier.js",
  "./js/holidays-co.js",
  "./js/gmail.js",
  "./js/notify.js",
  "./js/util.js",
  "./js/router.js",
  "./js/mock.js",
  "./js/views/inbox.js",
  "./js/views/procesos.js",
  "./js/views/detail.js",
  "./js/views/settings.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return; // never cache Gmail API calls
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
            return res;
          })
          .catch(() => cached)
    )
  );
});

// ---- Push notifications (only fires if the optional server/ backend sends
// a Web Push message — see server/README.md) ----
self.addEventListener("push", (event) => {
  let payload = { title: "Crediorbe", body: "Tienes un nuevo proceso.", processId: null };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    /* ignore malformed payloads */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      data: { processId: payload.processId },
      tag: payload.processId || undefined,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const processId = event.notification.data?.processId;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const client = clients[0];
      if (client) {
        client.focus();
        if (processId) client.postMessage({ type: "open-process", id: processId });
      } else {
        self.clients.openWindow("./index.html");
      }
    })
  );
});
