import webPush from "web-push";
import type {
  RequestOptions,
  SendResult,
  PushSubscription as WebPushSubscription,
} from "web-push";
import {
  isValidVapidKeyPair,
  isValidVapidPrivateKeyMaterial,
  isValidVapidPublicKeyMaterial,
  type NormalizedPreventiveWebPushSubscription,
} from "./preventiveWebPushSecurity.js";
import { isIP } from "node:net";

export const PREVENTIVE_WEB_PUSH_PROVIDER_ENV = Object.freeze({
  publicKey: "VYVA_WEB_PUSH_VAPID_PUBLIC_KEY",
  privateKey: "VYVA_WEB_PUSH_VAPID_PRIVATE_KEY",
  subject: "VYVA_WEB_PUSH_VAPID_SUBJECT",
} as const);

export type PreventiveWebPushProviderConfig = Readonly<{
  publicKey: string;
  privateKey: string;
  subject: string;
}>;

export type PreventiveWebPushProviderSendResult =
  | { outcome: "sent"; providerStatus: number | null }
  | { outcome: "failed_permanent"; providerStatus: number | null; reason: string }
  | { outcome: "failed_retryable"; providerStatus: number | null; reason: string };

export type PreventiveWebPushProvider = Readonly<{
  send(input: {
    subscription: NormalizedPreventiveWebPushSubscription;
    payload: PreventiveWebPushNotificationPayload;
  }): Promise<PreventiveWebPushProviderSendResult>;
}>;

export type PreventiveWebPushNotificationPayload =
  | Readonly<{
      type: "vyva.preventive_check";
      token: string;
    }>
  | Readonly<{
      type: "vyva.medication_refill";
      deliveryId: string;
      alertId: string;
    }>;

type WebPushSender = Readonly<{
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  sendNotification(
    subscription: WebPushSubscription,
    payload?: string | Buffer,
    options?: RequestOptions,
  ): Promise<SendResult>;
}>;

export function isValidVapidPublicKey(value: string | undefined): value is string {
  return isValidVapidPublicKeyMaterial(value);
}

export function isValidVapidPrivateKey(value: string | undefined): value is string {
  return isValidVapidPrivateKeyMaterial(value);
}

export function isValidVapidSubject(value: string | undefined): value is string {
  if (!value || value !== value.trim() || value.length > 200) return false;
  if (value.startsWith("mailto:")) {
    const email = value.slice("mailto:".length);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  if (!value.startsWith("https://")) return false;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    return parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      !parsed.hash &&
      isIP(hostname) === 0 &&
      hostname !== "localhost" &&
      !hostname.endsWith(".localhost") &&
      !hostname.endsWith(".local");
  } catch {
    return false;
  }
}

export function resolvePreventiveWebPushProviderConfig(
  env: Readonly<Record<string, string | undefined>>,
): { ok: true; config: PreventiveWebPushProviderConfig } | { ok: false; reason: "missing" | "invalid" } {
  const publicKey = env[PREVENTIVE_WEB_PUSH_PROVIDER_ENV.publicKey];
  const privateKey = env[PREVENTIVE_WEB_PUSH_PROVIDER_ENV.privateKey];
  const subject = env[PREVENTIVE_WEB_PUSH_PROVIDER_ENV.subject];
  if (!publicKey || !privateKey || !subject) return { ok: false, reason: "missing" };
  if (!isValidVapidKeyPair({ publicKey, privateKey }) || !isValidVapidSubject(subject)) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, config: { publicKey, privateKey, subject } };
}

export function isValidPreventiveWebPushProviderConfig(
  env: Readonly<Record<string, string | undefined>>,
): { reason: "valid" | "missing" | "invalid" } {
  const resolved = resolvePreventiveWebPushProviderConfig(env);
  return resolved.ok ? { reason: "valid" } : { reason: resolved.reason };
}

function classifyWebPushError(error: unknown): PreventiveWebPushProviderSendResult {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const statusCode = typeof record.statusCode === "number" ? record.statusCode : null;
  if (statusCode === 404 || statusCode === 410 || statusCode === 400 || statusCode === 413) {
    return {
      outcome: "failed_permanent",
      providerStatus: statusCode,
      reason: "provider_permanent_failure",
    };
  }
  if (statusCode === 429 || (statusCode !== null && statusCode >= 500)) {
    return {
      outcome: "failed_retryable",
      providerStatus: statusCode,
      reason: "provider_retryable_failure",
    };
  }
  return {
    outcome: "failed_retryable",
    providerStatus: statusCode,
    reason: "provider_unknown_failure",
  };
}

export function createPreventiveWebPushProvider(input: {
  config: PreventiveWebPushProviderConfig;
  sender?: WebPushSender;
}): PreventiveWebPushProvider {
  const sender = input.sender ?? webPush;
  sender.setVapidDetails(input.config.subject, input.config.publicKey, input.config.privateKey);
  return {
    async send({ subscription, payload }) {
      const providerSubscription: WebPushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      };
      try {
        const isRefill = payload.type === "vyva.medication_refill";
        const result = await sender.sendNotification(
          providerSubscription,
          JSON.stringify(payload),
          {
            TTL: 30 * 60,
            contentEncoding: subscription.contentEncoding,
            urgency: "normal",
            topic: isRefill ? `vyva-refill-${payload.alertId}` : "vyva-preventive-check",
          },
        );
        return {
          outcome: "sent",
          providerStatus: typeof result.statusCode === "number" ? result.statusCode : null,
        };
      } catch (error) {
        return classifyWebPushError(error);
      }
    },
  };
}

export function createDefaultPreventiveWebPushProvider(
  env: Readonly<Record<string, string | undefined>> = process.env,
): PreventiveWebPushProvider | null {
  const resolved = resolvePreventiveWebPushProviderConfig(env);
  if (!resolved.ok) return null;
  return createPreventiveWebPushProvider({ config: resolved.config });
}
