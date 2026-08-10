import { describe, expect, it } from "vitest";
import {
  isConciergeExternalExecutionText,
  isConciergeSafetySensitiveText,
  resolveConciergeLegacyOutcome,
} from "./conciergeLegacyAdapter";
import {
  task18ConciergeParityFixtures,
  task18ExternalExecutionFixtures,
  task18SafetyPrecedenceFixtures,
  task18UnsupportedFixtures,
  task18ValidNavigationFixtures,
} from "./conciergeFixtures";

describe("Concierge legacy adapter", () => {
  it.each(task18ConciergeParityFixtures)(
    "preserves existing navigation/context semantics for $label",
    (fixture) => {
      expect(resolveConciergeLegacyOutcome(fixture.utterance)).toMatchObject({
        kind: "supported_action",
        actionType: fixture.expectedActionType,
        route: fixture.expectedRoute,
        capability: fixture.expectedCapability,
        requestCategory: fixture.expectedRequestCategory,
        presentationId: fixture.expectedPresentationId,
        requiresConfirmation: false,
        riskLevel: "low",
        externalAction: false,
      });
    },
  );

  it.each(task18ValidNavigationFixtures)(
    "keeps valid Concierge navigation/context eligible: %s",
    (utterance) => {
      expect(resolveConciergeLegacyOutcome(utterance)).toMatchObject({
        kind: "supported_action",
        externalAction: false,
      });
    },
  );

  it.each(task18ExternalExecutionFixtures)(
    "excludes real-world execution request: $utterance",
    (fixture) => {
      expect(isConciergeExternalExecutionText(fixture.utterance)).toBe(true);
      expect(resolveConciergeLegacyOutcome(fixture.utterance)).toMatchObject({
        kind: "fallback_to_legacy",
        reasonCode: fixture.expectedReasonCode,
      });
    },
  );

  it.each(task18SafetyPrecedenceFixtures)(
    "detects safety-sensitive Concierge wording: %s",
    (utterance) => {
      expect(isConciergeSafetySensitiveText(utterance)).toBe(true);
      expect(resolveConciergeLegacyOutcome(utterance)).toMatchObject({
        kind: "fallback_to_legacy",
        reasonCode: "concierge_safety_preempted",
      });
    },
  );

  it.each(task18UnsupportedFixtures)(
    "keeps unsupported or stale confirmation text outside the migrated slice: $utterance",
    (fixture) => {
      expect(resolveConciergeLegacyOutcome(fixture.utterance)).toMatchObject({
        kind: "fallback_to_legacy",
        reasonCode: fixture.expectedReasonCode,
      });
    },
  );
});
