const serviceWorkerUrl = new URL(self.location.href);
const BUILD_TOKEN = serviceWorkerUrl.searchParams.get("v") || "v1";
const CACHE_VERSION = `vyva-pwa-${BUILD_TOKEN}`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = "/offline.html";
const PREVENTIVE_CHECK_NOTIFICATION_TAG = "vyva-preventive-check";
const PREVENTIVE_CHECK_ROUTE = "/health/check-in";
const MEDICATION_REFILL_ROUTE = "/meds/refills";
const PREVENTIVE_ENTRY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/favicon.png",
  "/apple-touch-icon.png",
  "/icons/vyva-icon-192.png",
  "/icons/vyva-icon-512.png",
  "/icons/vyva-maskable-512.png",
  "/assets/vyva/vyva-wordmark-launch.svg",
  "/og-vyva.png"
];

function parsePushData(event) {
  if (!event.data) return null;
  try {
    const payload = event.data.json();
    if (payload?.type === "vyva.preventive_check") {
      if (typeof payload.token !== "string" || !PREVENTIVE_ENTRY_TOKEN_PATTERN.test(payload.token)) return null;
      return { type: "preventive", token: payload.token };
    }
    if (payload?.type === "vyva.medication_refill") {
      if (typeof payload.deliveryId !== "string" || !UUID_PATTERN.test(payload.deliveryId)) return null;
      if (typeof payload.alertId !== "string" || !UUID_PATTERN.test(payload.alertId)) return null;
      return { type: "medication_refill", deliveryId: payload.deliveryId, alertId: payload.alertId };
    }
    return null;
  } catch {
    return null;
  }
}

function medicationRefillUrl(deliveryId) {
  const url = new URL(MEDICATION_REFILL_ROUTE, self.location.origin);
  url.searchParams.set("refillPush", deliveryId);
  return url.toString();
}

function preventiveCheckUrl(token) {
  const url = new URL(PREVENTIVE_CHECK_ROUTE, self.location.origin);
  url.searchParams.set("pushEntry", token);
  return url.toString();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("push", (event) => {
  const data = parsePushData(event);
  if (!data) return;
  if (data.type === "medication_refill") {
    event.waitUntil(
      self.registration.showNotification("Medicine supply reminder", {
        body: "Open VYVA to review your estimated medicine supply.",
        icon: "/icons/vyva-icon-192.png",
        badge: "/icons/vyva-icon-192.png",
        tag: `vyva-medication-refill-${data.alertId}`,
        data: {
          route: MEDICATION_REFILL_ROUTE,
          refillDelivery: data.deliveryId,
        },
      })
    );
    return;
  }
  event.waitUntil(
    self.registration.showNotification("VYVA check-in", {
      body: "It's time for your gentle daily check-in.",
      icon: "/icons/vyva-icon-192.png",
      badge: "/icons/vyva-icon-192.png",
      tag: PREVENTIVE_CHECK_NOTIFICATION_TAG,
      data: {
        route: PREVENTIVE_CHECK_ROUTE,
        pushEntry: data.token,
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const token = event.notification.data?.pushEntry;
  const refillDelivery = event.notification.data?.refillDelivery;
  const targetUrl = typeof refillDelivery === "string" && UUID_PATTERN.test(refillDelivery)
    ? medicationRefillUrl(refillDelivery)
    : typeof token === "string" && PREVENTIVE_ENTRY_TOKEN_PATTERN.test(token)
      ? preventiveCheckUrl(token)
      : null;
  if (!targetUrl) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const sameOriginClient = clients.find((client) => {
          try {
            return new URL(client.url).origin === self.location.origin;
          } catch {
            return false;
          }
        });
        if (sameOriginClient) {
          if ("navigate" in sameOriginClient) {
            return sameOriginClient.navigate(targetUrl).then((client) => client?.focus());
          }
          return sameOriginClient.focus();
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith("vyva-pwa-") && !cacheName.startsWith(CACHE_VERSION))
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

function isCacheableStaticRequest(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  return ["font", "image", "script", "style"].includes(request.destination);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error("Network request failed and no cache entry was available.");
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  if (isCacheableStaticRequest(request, url)) {
    event.respondWith(
      ["script", "style"].includes(request.destination)
        ? networkFirst(request)
        : cacheFirst(request)
    );
  }
});
