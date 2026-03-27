export function registerServiceWorker() {
  if ("serviceWorker" in navigator && (import.meta as any).env?.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed, app works without it
      });
    });
  }
}
