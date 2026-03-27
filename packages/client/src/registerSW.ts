export function registerServiceWorker() {
  if ("serviceWorker" in navigator && (import.meta as any).env?.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed, app works without it
      });
    });
  }
}

// Token is no longer stored in cache storage for security
export async function syncTokenToSW() {
  // no-op
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
