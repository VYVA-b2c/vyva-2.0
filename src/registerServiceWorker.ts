import { APP_VERSION } from "@/lib/appInfo";

const UPDATE_RELOAD_KEY = "vyva-sw-reloaded-build";
const DEV_CLEANUP_RELOAD_KEY = "vyva-dev-sw-cleanup-reloaded";

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
  if (!("serviceWorker" in navigator)) return;

  if (!import.meta.env.PROD) {
    window.addEventListener("load", () => {
      void (async () => {
        const wasControlled = Boolean(navigator.serviceWorker.controller);
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ("caches" in window) {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames
              .filter((cacheName) => cacheName.startsWith("vyva-pwa-"))
              .map((cacheName) => caches.delete(cacheName)),
          );
        }

        if (wasControlled && sessionStorage.getItem(DEV_CLEANUP_RELOAD_KEY) !== "true") {
          sessionStorage.setItem(DEV_CLEANUP_RELOAD_KEY, "true");
          window.location.reload();
          return;
        }

        sessionStorage.removeItem(DEV_CLEANUP_RELOAD_KEY);
      })().catch(() => undefined);
    });
    return;
  }

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
