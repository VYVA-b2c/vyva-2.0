import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  base64UrlToUint8Array,
  disablePreventiveWebPush,
  enablePreventiveWebPush,
  isPreventiveWebPushSupported,
  redeemPreventivePushEntry,
} from "./preventiveWebPush";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

function okJson(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

function failedJson(statusText = "Unable to save push subscription") {
  return {
    ok: false,
    statusText,
    json: async () => ({ error: statusText }),
  } as Response;
}

describe("preventive web push client helper", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("converts base64url VAPID keys into bytes", () => {
    expect(Array.from(base64UrlToUint8Array("AQID"))).toEqual([1, 2, 3]);
  });

  it("does not claim support without browser push primitives", () => {
    expect(isPreventiveWebPushSupported()).toBe(false);
  });

  it("subscribes only after an explicit enable call and posts a normalized subscription", async () => {
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/token",
      expirationTime: null,
      getKey: vi.fn((name: PushEncryptionKeyName) =>
        name === "p256dh" ? new Uint8Array([1, 2, 3]).buffer : new Uint8Array([4, 5, 6]).buffer
      ),
    };
    const pushManager = {
      getSubscription: vi.fn(async () => null),
      subscribe: vi.fn(async () => subscription),
    };
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { requestPermission: vi.fn(async () => "granted") },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManager() {},
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager }) },
    });
    apiFetchMock
      .mockResolvedValueOnce(okJson({
        supported: true,
        enabled: true,
        reason: "preventive_web_push_allowed_user",
        publicKey: "AQID",
      }))
      .mockResolvedValueOnce(okJson({ ok: true }))
      .mockResolvedValueOnce(okJson({
        consentEnabled: true,
        consentRevision: 1,
        subscribed: true,
        config: { supported: true, enabled: true, reason: "selected", publicKey: "AQID" },
      }));

    await expect(enablePreventiveWebPush()).resolves.toMatchObject({
      consentEnabled: true,
      subscribed: true,
    });
    expect(pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array("AQID"),
    });
    expect(JSON.parse(String(apiFetchMock.mock.calls[1][1]?.body))).toMatchObject({
      subscription: {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: "AQID",
          auth: "BAUG",
        },
        contentEncoding: "aes128gcm",
      },
    });
  });

  it("uses an existing browser subscription idempotently", async () => {
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/existing-token",
      expirationTime: null,
      getKey: vi.fn((name: PushEncryptionKeyName) =>
        name === "p256dh" ? new Uint8Array([7, 8, 9]).buffer : new Uint8Array([10, 11, 12]).buffer
      ),
    };
    const pushManager = {
      getSubscription: vi.fn(async () => subscription),
      subscribe: vi.fn(),
    };
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { requestPermission: vi.fn(async () => "granted") },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManager() {},
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager }) },
    });
    apiFetchMock
      .mockResolvedValueOnce(okJson({
        supported: true,
        enabled: true,
        reason: "preventive_web_push_allowed_user",
        publicKey: "AQID",
      }))
      .mockResolvedValueOnce(okJson({ ok: true }))
      .mockResolvedValueOnce(okJson({
        consentEnabled: true,
        consentRevision: 1,
        subscribed: true,
        config: { supported: true, enabled: true, reason: "selected", publicKey: "AQID" },
      }));

    await enablePreventiveWebPush();
    expect(pushManager.subscribe).toHaveBeenCalledTimes(0);
    expect(JSON.parse(String(apiFetchMock.mock.calls[1][1]?.body))).toMatchObject({
      subscription: {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: "BwgJ",
          auth: "CgsM",
        },
      },
    });
  });

  it("unsubscribes a newly-created browser subscription if server persistence fails", async () => {
    const unsubscribe = vi.fn(async () => true);
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/new-token",
      expirationTime: null,
      getKey: vi.fn((name: PushEncryptionKeyName) =>
        name === "p256dh" ? new Uint8Array([1, 2, 3]).buffer : new Uint8Array([4, 5, 6]).buffer
      ),
      unsubscribe,
    };
    const pushManager = {
      getSubscription: vi.fn(async () => null),
      subscribe: vi.fn(async () => subscription),
    };
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { requestPermission: vi.fn(async () => "granted") },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManager() {},
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager }) },
    });
    apiFetchMock
      .mockResolvedValueOnce(okJson({
        supported: true,
        enabled: true,
        reason: "preventive_web_push_allowed_user",
        publicKey: "AQID",
      }))
      .mockResolvedValueOnce(failedJson());

    await expect(enablePreventiveWebPush()).rejects.toThrow("Unable to save push subscription");
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("preserves an existing browser subscription if server persistence fails", async () => {
    const unsubscribe = vi.fn(async () => true);
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/existing-token",
      expirationTime: null,
      getKey: vi.fn((name: PushEncryptionKeyName) =>
        name === "p256dh" ? new Uint8Array([7, 8, 9]).buffer : new Uint8Array([10, 11, 12]).buffer
      ),
      unsubscribe,
    };
    const pushManager = {
      getSubscription: vi.fn(async () => subscription),
      subscribe: vi.fn(),
    };
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { requestPermission: vi.fn(async () => "granted") },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManager() {},
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager }) },
    });
    apiFetchMock
      .mockResolvedValueOnce(okJson({
        supported: true,
        enabled: true,
        reason: "preventive_web_push_allowed_user",
        publicKey: "AQID",
      }))
      .mockResolvedValueOnce(failedJson());

    await expect(enablePreventiveWebPush()).rejects.toThrow("Unable to save push subscription");
    expect(pushManager.subscribe).toHaveBeenCalledTimes(0);
    expect(unsubscribe).toHaveBeenCalledTimes(0);
  });

  it("does not subscribe when permission is denied", async () => {
    const pushManager = {
      getSubscription: vi.fn(),
      subscribe: vi.fn(),
    };
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { requestPermission: vi.fn(async () => "denied") },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManager() {},
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager }) },
    });
    apiFetchMock.mockResolvedValueOnce(okJson({
      supported: true,
      enabled: true,
      reason: "preventive_web_push_allowed_user",
      publicKey: "AQID",
    }));

    await expect(enablePreventiveWebPush()).rejects.toThrow("Notification permission was not granted.");
    expect(pushManager.subscribe).toHaveBeenCalledTimes(0);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it("revokes server consent before browser unsubscribe", async () => {
    const unsubscribe = vi.fn(async () => true);
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: { requestPermission: vi.fn() },
    });
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: function PushManager() {},
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn(async () => ({ unsubscribe })),
          },
        }),
      },
    });
    apiFetchMock
      .mockResolvedValueOnce(okJson({ ok: true }))
      .mockResolvedValueOnce(okJson({
        consentEnabled: false,
        consentRevision: 2,
        subscribed: false,
        config: { supported: true, enabled: true, reason: "selected", publicKey: "AQID" },
      }));

    await disablePreventiveWebPush();
    expect(apiFetchMock.mock.calls[0][0]).toBe("/api/preventive-web-push/subscriptions");
    expect(apiFetchMock.mock.calls[0][1]?.method).toBe("DELETE");
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("redeems entry tokens through the dedicated API", async () => {
    apiFetchMock.mockResolvedValueOnce(okJson({
      ok: true,
      entryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      route: "/health/check-in",
      flowId: "health.preventive_check",
      flowVersion: "1.0.0",
      status: "opened",
    }));
    await expect(redeemPreventivePushEntry("a".repeat(43))).resolves.toMatchObject({
      route: "/health/check-in",
    });
    expect(apiFetchMock).toHaveBeenCalledWith("/api/preventive-web-push/entry/redeem", expect.objectContaining({
      method: "POST",
    }));
  });
});
