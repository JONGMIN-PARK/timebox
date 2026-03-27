export function registerServiceWorker() {
  if ("serviceWorker" in navigator && (import.meta as any).env?.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed, app works without it
      });
    });
  }
}

// Store auth token for service worker background checks
export async function syncTokenToSW() {
  try {
    const token = localStorage.getItem("timebox_token");
    if (token && "caches" in window) {
      const cache = await caches.open("timebox-auth");
      await cache.put("/auth-token", new Response(token));
    }
  } catch {}
}

// Register periodic background sync for reminder checking
export async function registerPeriodicSync() {
  try {
    const registration = await navigator.serviceWorker.ready;
    if ("periodicSync" in registration) {
      await (registration as any).periodicSync.register("check-reminders", {
        minInterval: 60000, // 1 minute minimum
      });
    }
  } catch {}
}
