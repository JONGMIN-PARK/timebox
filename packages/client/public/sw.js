const CACHE_NAME = "timebox-v1";
const STATIC_ASSETS = ["/", "/index.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET requests and API calls
  if (request.method !== "GET" || request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || new Response("Offline", { status: 503 })))
  );
});

// ── Background reminder check ──

async function getStoredToken() {
  try {
    const cache = await caches.open("timebox-auth");
    const response = await cache.match("/auth-token");
    if (response) return response.text();
  } catch {}
  return null;
}

async function checkReminders() {
  try {
    const token = await getStoredToken();
    if (!token) return;

    const response = await fetch("/api/reminders/due", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) return;
    const data = await response.json();

    if (data.success && data.data && data.data.length > 0) {
      for (const reminder of data.data) {
        self.registration.showNotification(`⏰ ${reminder.title}`, {
          body: reminder.message || "리마인더 시간입니다!",
          icon: "/icon-192.png",
          tag: `reminder-${reminder.id}`,
          data: { reminderId: reminder.id },
          requireInteraction: true,
        });
      }
    }
  } catch {}
}

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      if (clients.length > 0) {
        clients[0].focus();
      } else {
        self.clients.openWindow("/");
      }
    })
  );
});

// Periodic background sync (if supported)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "check-reminders") {
    event.waitUntil(checkReminders());
  }
});
