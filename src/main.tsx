import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n/index.ts";
import { registerServiceWorker } from "./registerServiceWorker.ts";

createRoot(document.getElementById("root")!).render(<App />);
registerServiceWorker();

const launchOverlay = document.getElementById("vyva-launch");
if (launchOverlay) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const visibleDurationMs = reduceMotion ? 0 : 120;

  window.setTimeout(() => {
    launchOverlay.classList.add("vyva-launch--leaving");
    window.setTimeout(() => launchOverlay.remove(), reduceMotion ? 0 : 420);
  }, visibleDurationMs);
}
