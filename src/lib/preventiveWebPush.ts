import { apiFetch } from "@/lib/queryClient";

export type PreventiveWebPushConfig = {
  supported: boolean;
  enabled: boolean;
  reason: string;
  publicKey: string | null;
};

export type PreventiveWebPushStatus = {
  consentEnabled: boolean;
  consentRevision: number;
  subscribed: boolean;
  config: PreventiveWebPushConfig;
};

export type PreventiveWebPushEntryRedemption = {
  ok: true;
  entryId: string;
  route: "/health/check-in";
  flowId: "health.preventive_check";
  flowVersion: "1.0.0";
  status: "opened" | "flow_started" | "already_opened" | "already_started";
};

function bytesToBase64Url(bytes: ArrayBuffer | null): string {
  if (!bytes) return "";
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function base64UrlToUint8Array(value: string): Uint8Array {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}

export function isPreventiveWebPushSupported(): boolean {
  return typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;
}

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = response.statusText || "Request failed";
    try {
      const body = await response.json() as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch {
      // Keep the HTTP status text.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function getPreventiveWebPushStatus(): Promise<PreventiveWebPushStatus> {
  const response = await apiFetch("/api/preventive-web-push/status");
  return responseJson<PreventiveWebPushStatus>(response);
}

export async function enablePreventiveWebPush(): Promise<PreventiveWebPushStatus> {
  if (!isPreventiveWebPushSupported()) {
    throw new Error("This browser does not support web push.");
  }
  const configResponse = await apiFetch("/api/preventive-web-push/config");
  const config = await responseJson<PreventiveWebPushConfig>(configResponse);
  if (!config.enabled || !config.publicKey) {
    throw new Error("Preventive web push is not available.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  let createdDuringEnable = false;
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(config.publicKey),
  });
  if (!existing) createdDuringEnable = true;
  const response = await apiFetch("/api/preventive-web-push/subscriptions", {
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
  });
  try {
    await responseJson<{ ok: true }>(response);
  } catch (error) {
    if (createdDuringEnable) {
      await subscription.unsubscribe().catch(() => {});
    }
    throw error;
  }
  return getPreventiveWebPushStatus();
}

export async function disablePreventiveWebPush(): Promise<PreventiveWebPushStatus> {
  const response = await apiFetch("/api/preventive-web-push/subscriptions", {
    method: "DELETE",
  });
  await responseJson<{ ok: true }>(response);
  if (isPreventiveWebPushSupported()) {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    await subscription?.unsubscribe();
  }
  return getPreventiveWebPushStatus();
}

export async function redeemPreventivePushEntry(token: string): Promise<PreventiveWebPushEntryRedemption> {
  const response = await apiFetch("/api/preventive-web-push/entry/redeem", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  return responseJson<PreventiveWebPushEntryRedemption>(response);
}

export async function recordPreventivePushFlowStarted(entryId: string): Promise<void> {
  const response = await apiFetch("/api/preventive-web-push/entry/flow-started", {
    method: "POST",
    body: JSON.stringify({ entryId }),
  });
  await responseJson<{ ok: true }>(response);
}
