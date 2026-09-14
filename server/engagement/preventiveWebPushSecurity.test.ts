import { describe, expect, it } from "vitest";
import {
  isSafeWebPushEndpoint,
  normalizePreventiveWebPushSubscription,
  parsePreventiveWebPushEntryToken,
} from "./preventiveWebPushSecurity.js";
import {
  validAuth,
  validP256dh,
  validPreventiveWebPushSubscription,
} from "./preventiveWebPushFixtures.js";

describe("Task 10 preventive web push security boundary", () => {
  it("normalizes an accepted browser push subscription and stores only endpoint digest metadata", () => {
    const normalized = normalizePreventiveWebPushSubscription(validPreventiveWebPushSubscription());
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    expect(normalized.subscription).toMatchObject({
      endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint-token",
      endpointDigest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      contentEncoding: "aes128gcm",
      keys: {
        p256dh: validP256dh,
        auth: validAuth,
      },
    });
  });

  it("rejects unsafe endpoints instead of acting as a generic SSRF sink", () => {
    expect(isSafeWebPushEndpoint("http://fcm.googleapis.com/fcm/send/token")).toBe(false);
    expect(isSafeWebPushEndpoint("https://127.0.0.1/fcm/send/token")).toBe(false);
    expect(isSafeWebPushEndpoint("https://localhost/fcm/send/token")).toBe(false);
    expect(isSafeWebPushEndpoint("https://example.com/fcm/send/token")).toBe(false);
    expect(isSafeWebPushEndpoint(" https://fcm.googleapis.com/fcm/send/token")).toBe(false);
    expect(isSafeWebPushEndpoint("https://fcm.googleapis.com/fcm/send/token#secret")).toBe(false);
    expect(isSafeWebPushEndpoint("https://fcm.googleapis.com/fcm/send/token")).toBe(true);
    expect(isSafeWebPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/token")).toBe(true);
    expect(isSafeWebPushEndpoint("https://web.push.apple.com/token")).toBe(true);
  });

  it("rejects caller-owned accessors before subscription parsing", () => {
    let getterCalls = 0;
    const unsafe = validPreventiveWebPushSubscription();
    Object.defineProperty(unsafe, "endpoint", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "https://fcm.googleapis.com/fcm/send/token";
      },
    });
    expect(normalizePreventiveWebPushSubscription(unsafe)).toEqual({
      ok: false,
      reason: "subscription_not_inert",
    });
    expect(getterCalls).toBe(0);
  });

  it("rejects malformed decoded subscription key material", () => {
    const sixtyByteP256dh = Buffer.alloc(60, 1).toString("base64url");
    const wrongPrefix = Buffer.from(validP256dh, "base64url");
    wrongPrefix[0] = 0x05;
    const twelveByteAuth = Buffer.alloc(12, 1).toString("base64url");

    expect(normalizePreventiveWebPushSubscription(validPreventiveWebPushSubscription({
      keys: { p256dh: sixtyByteP256dh, auth: validAuth },
    }))).toEqual({ ok: false, reason: "subscription_p256dh_invalid" });
    expect(normalizePreventiveWebPushSubscription(validPreventiveWebPushSubscription({
      keys: { p256dh: wrongPrefix.toString("base64url"), auth: validAuth },
    }))).toEqual({ ok: false, reason: "subscription_p256dh_invalid" });
    expect(normalizePreventiveWebPushSubscription(validPreventiveWebPushSubscription({
      keys: { p256dh: "-".repeat(validP256dh.length), auth: validAuth },
    }))).toEqual({ ok: false, reason: "subscription_p256dh_invalid" });
    expect(normalizePreventiveWebPushSubscription(validPreventiveWebPushSubscription({
      keys: { p256dh: validP256dh, auth: twelveByteAuth },
    }))).toEqual({ ok: false, reason: "subscription_auth_invalid" });
    expect(normalizePreventiveWebPushSubscription(validPreventiveWebPushSubscription({
      keys: { p256dh: `${validP256dh}=`, auth: validAuth },
    }))).toEqual({ ok: false, reason: "subscription_p256dh_invalid" });
    expect(normalizePreventiveWebPushSubscription(validPreventiveWebPushSubscription({
      keys: { p256dh: ` ${validP256dh}`, auth: validAuth },
    }))).toEqual({ ok: false, reason: "subscription_p256dh_invalid" });
  });

  it("accepts only bounded opaque entry tokens", () => {
    expect(parsePreventiveWebPushEntryToken("a".repeat(43))).toMatchObject({ ok: true });
    expect(parsePreventiveWebPushEntryToken("a".repeat(42))).toEqual({ ok: false, reason: "token_invalid" });
    expect(parsePreventiveWebPushEntryToken("a".repeat(129))).toEqual({ ok: false, reason: "token_invalid" });
    expect(parsePreventiveWebPushEntryToken("a".repeat(42) + "=")).toEqual({ ok: false, reason: "token_invalid" });
    expect(parsePreventiveWebPushEntryToken("../" + "a".repeat(43))).toEqual({ ok: false, reason: "token_invalid" });
  });
});
