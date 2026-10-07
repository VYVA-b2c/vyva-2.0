import { describe, expect, it } from "vitest";
import { InMemoryPreventiveOutboundCallStore } from "./preventiveOutboundCallStore.js";
import {
  validPreventiveOutboundCallNow,
  validPreventiveOutboundCallPhone,
} from "./preventiveOutboundCallFixtures.js";

async function consentedStore() {
  const store = new InMemoryPreventiveOutboundCallStore();
  await store.provisionConsent({
    userId: "user.recent",
    profileId: "profile.recent",
    enabled: true,
    phoneE164: validPreventiveOutboundCallPhone,
    phoneVerifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    verificationSource: "admin_provisioned",
    verificationReference: "ticket.recent",
    now: validPreventiveOutboundCallNow,
  });
  return store;
}

describe("InMemoryPreventiveOutboundCallStore.listRecentAttempts", () => {
  it("only returns attempts for the given user/profile within the window, newest first", async () => {
    const store = await consentedStore();
    const consent = await store.readConsent({ userId: "user.recent", profileId: "profile.recent" });

    const older = new Date(validPreventiveOutboundCallNow.getTime() - 5 * 24 * 60 * 60_000);
    const newer = new Date(validPreventiveOutboundCallNow.getTime() - 1 * 24 * 60 * 60_000);

    await store.acquireCallClaim({
      userId: "user.recent",
      profileId: "profile.recent",
      scheduleOccurrenceId: "occurrence.older",
      scheduleId: "schedule.test",
      consent,
      policyAuditId: null,
      policyDecisionDigest: "sha256:" + "0".repeat(64),
      claimToken: "token.older",
      claimExpiresAt: new Date(older.getTime() + 60_000),
      confirmationTokenDigest: "digest.older",
      confirmationTokenExpiresAt: new Date(older.getTime() + 900_000),
      now: older,
    });
    await store.acquireCallClaim({
      userId: "user.recent",
      profileId: "profile.recent",
      scheduleOccurrenceId: "occurrence.newer",
      scheduleId: "schedule.test",
      consent,
      policyAuditId: null,
      policyDecisionDigest: "sha256:" + "1".repeat(64),
      claimToken: "token.newer",
      claimExpiresAt: new Date(newer.getTime() + 60_000),
      confirmationTokenDigest: "digest.newer",
      confirmationTokenExpiresAt: new Date(newer.getTime() + 900_000),
      now: newer,
    });
    // A different user's attempt must never leak into these results.
    await store.provisionConsent({
      userId: "user.other",
      profileId: "profile.other",
      enabled: true,
      phoneE164: validPreventiveOutboundCallPhone,
      phoneVerifiedAt: validPreventiveOutboundCallNow,
      verificationSource: "admin_provisioned",
      verificationReference: "ticket.other",
      now: validPreventiveOutboundCallNow,
    });
    const otherConsent = await store.readConsent({ userId: "user.other", profileId: "profile.other" });
    await store.acquireCallClaim({
      userId: "user.other",
      profileId: "profile.other",
      scheduleOccurrenceId: "occurrence.other",
      scheduleId: "schedule.test",
      consent: otherConsent,
      policyAuditId: null,
      policyDecisionDigest: "sha256:" + "2".repeat(64),
      claimToken: "token.other",
      claimExpiresAt: new Date(newer.getTime() + 60_000),
      confirmationTokenDigest: "digest.other",
      confirmationTokenExpiresAt: new Date(newer.getTime() + 900_000),
      now: newer,
    });

    const results = await store.listRecentAttempts({
      userId: "user.recent",
      profileId: "profile.recent",
      since: new Date(validPreventiveOutboundCallNow.getTime() - 3 * 24 * 60 * 60_000),
    });

    expect(results.map((attempt) => attempt.scheduleOccurrenceId)).toEqual(["occurrence.newer"]);
    expect(results[0]?.requestedAt).toEqual(newer);
  });
});
