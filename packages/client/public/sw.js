const CACHE_NAME = "timebox-v3";

self.addEventListener("install", (event) => {
  // Clear all old caches on install, then activate immediately
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    ).then(() => self.skipWaiting())
  );
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

  // Skip non-GET, API calls, and non-http(s) schemes
  if (
    request.method !== "GET" ||
    request.url.includes("/api/") ||
    !request.url.startsWith("http")
  ) {
    return;
  }

  // HTML pages: network-first, never cache stale HTML
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || new Response("Offline", { status: 503 }))
      )
    );
    return;
  }

  // Hashed assets (/assets/): network-first with cache fallback
  if (request.url.includes("/assets/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || new Response("Asset not found", { status: 404 })))
    );
    return;
  }

  // Everything else: network-first with short cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
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

// Handle push events from server
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "TimeBox";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/favicon-32.png",
    tag: data.tag || "timebox-notification",
    data: data.url ? { url: data.url } : {},
    vibrate: [100, 50, 100],
  };
  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      // Update PWA badge count
      if (data.badgeCount && navigator.setAppBadge) {
        navigator.setAppBadge(data.badgeCount);
      }
    })
  );
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Clear badge on notification click
  if (navigator.clearAppBadge) navigator.clearAppBadge();
  const url = event.notification.data?.url || "/app";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

// Also update badge on periodic sync
async function updateBadge() {
  try {
    const token = await getStoredToken();
    if (!token) return;
    const res = await fetch("/api/inbox/unread-count", {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.success && data.data && navigator.setAppBadge) {
      const count = data.data.count || 0;
      if (count > 0) navigator.setAppBadge(count);
      else navigator.clearAppBadge();
    }
  } catch {}
}

// Periodic background sync (if supported)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "check-reminders") {
    event.waitUntil(Promise.all([checkReminders(), updateBadge()]));
  }
});
