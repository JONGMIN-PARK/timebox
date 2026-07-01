import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { registerServiceWorker, syncTokenToSW, registerPeriodicSync } from "./registerSW";
import "./index.css";

// Keep a JS-measured viewport height in `--app-height`. iOS Safari resolves
// `dvh`/`vh` before the browser chrome settles on first paint, which leaves the
// bottom nav floated up until the user scrolls (which fires a resize). Tracking
// window.innerHeight and updating on resize/orientation self-corrects that
// without any user interaction. (innerHeight — not visualViewport — so the
// on-screen keyboard doesn't shrink the whole shell.)
function setAppHeight() {
  const h = window.innerHeight;
  if (h > 0) document.documentElement.style.setProperty("--app-height", `${h}px`);
}
setAppHeight();
window.addEventListener("resize", setAppHeight);
window.addEventListener("pageshow", setAppHeight);
window.addEventListener("orientationchange", () => {
  setAppHeight();
  window.setTimeout(setAppHeight, 300);
});
// Re-measure once the layout/chrome settles after initial load.
window.requestAnimationFrame(setAppHeight);
window.setTimeout(setAppHeight, 300);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

registerServiceWorker();
syncTokenToSW();
registerPeriodicSync();
