import { apiFetch } from "@/lib/queryClient";
import { base64UrlToUint8Array, isPreventiveWebPushSupported } from "@/lib/preventiveWebPush";

export type MedicationRefillPushStatus = {
  consentEnabled: boolean;
  subscribed: boolean;
  config: {
    supported: boolean;
    enabled: boolean;
    publicKey: string | null;
    reason: string;
  };
};

function bytesToBase64Url(bytes: ArrayBuffer | null): string {
  if (!bytes) return "";
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = response.statusText || "Request failed";
    try {
      const body = await response.json() as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch {
      // Preserve the HTTP message.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function getMedicationRefillPushStatus() {
  return responseJson<MedicationRefillPushStatus>(await apiFetch("/api/meds/refill-notifications/status"));
}

export async function enableMedicationRefillPush() {
  if (!isPreventiveWebPushSupported()) throw new Error("This browser does not support web push.");
  const config = await responseJson<MedicationRefillPushStatus["config"]>(
    await apiFetch("/api/meds/refill-notifications/config"),
  );
  if (!config.enabled || !config.publicKey) throw new Error("Medication refill push is not available.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(config.publicKey),
  });
  await responseJson<{ ok: true }>(await apiFetch("/api/meds/refill-notifications/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      subscription: {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        keys: {
          p256dh: bytesToBase64Url(subscription.getKey("p256dh")),
          auth: bytesToBase64Url(subscription.getKey("auth")),
        },
        contentEncoding: "aes128gcm",
        userAgent: navigator.userAgent,
      },
    }),
  }));
  return getMedicationRefillPushStatus();
}

export async function disableMedicationRefillPush() {
  await responseJson<{ ok: true }>(await apiFetch("/api/meds/refill-notifications/subscriptions", {
    method: "DELETE",
  }));
  return getMedicationRefillPushStatus();
}
