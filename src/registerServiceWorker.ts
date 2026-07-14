import { APP_VERSION } from "@/lib/appInfo";

const UPDATE_RELOAD_KEY = "vyva-sw-reloaded-build";

export function getServiceWorkerBuildToken() {
  const entryScript = Array.from(document.scripts)
    .map((script) => script.src)
    .find((src) => /\/assets\/index-[^/?]+\.js(?:\?|$)/.test(src));

  if (!entryScript) return APP_VERSION;

  try {
    const url = new URL(entryScript);
    return url.pathname.split("/").pop() ?? APP_VERSION;
  } catch {
    return APP_VERSION;
  }
}

function askWaitingWorkerToActivate(worker: ServiceWorker | null) {
  worker?.postMessage({ type: "SKIP_WAITING" });
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    const buildToken = getServiceWorkerBuildToken();
    const serviceWorkerUrl = `/service-worker.js?v=${encodeURIComponent(buildToken)}`;
    let alreadyControlled = Boolean(navigator.serviceWorker.controller);
    let isRefreshing = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!alreadyControlled) {
        alreadyControlled = true;
        return;
      }

      if (isRefreshing || sessionStorage.getItem(UPDATE_RELOAD_KEY) === buildToken) return;

      isRefreshing = true;
      sessionStorage.setItem(UPDATE_RELOAD_KEY, buildToken);
      window.location.reload();
    });

    void navigator.serviceWorker.register(serviceWorkerUrl)
      .then((registration) => {
        askWaitingWorkerToActivate(registration.waiting);
        void registration.update().catch(() => undefined);

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;

          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              askWaitingWorkerToActivate(worker);
            }
          });
        });
      })
      .catch(() => undefined);
  });
}
