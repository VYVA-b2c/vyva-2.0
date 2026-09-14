import { describe, expect, it } from "vitest";
import {
  isSocialSupportExternalExecutionText,
  isSocialSupportSafetySensitiveText,
  resolveSocialSupportLegacyOutcome,
} from "./socialSupportLegacyAdapter";
import {
  task19CaregiverBoundaryFixtures,
  task19ConciergeOverlapFixtures,
  task19MentalWellbeingOverlapFixtures,
  task19SafetyPrecedenceFixtures,
  task19SocialParityFixtures,
  task19UnsupportedFixtures,
  task19ValidNavigationFixtures,
} from "./socialSupportFixtures";

describe("Social Support legacy adapter", () => {
  it.each(task19SocialParityFixtures)(
    "preserves existing community/social navigation semantics for $label",
    (fixture) => {
      expect(resolveSocialSupportLegacyOutcome(fixture.utterance)).toMatchObject({
        kind: "supported_action",
        actionType: fixture.expectedActionType,
        route: fixture.expectedRoute,
        capability: fixture.expectedCapability,
        requestCategory: fixture.expectedRequestCategory,
        presentationId: fixture.expectedPresentationId,
        requiresConfirmation: false,
        riskLevel: "low",
        externalAction: false,
        humanContact: false,
        caregiverAuthority: false,
      });
    },
  );

  it.each(task19ValidNavigationFixtures)(
    "keeps valid community/social navigation eligible: %s",
    (utterance) => {
      expect(resolveSocialSupportLegacyOutcome(utterance)).toMatchObject({
        kind: "supported_action",
        externalAction: false,
        humanContact: false,
        caregiverAuthority: false,
      });
    },
  );

  it.each(task19MentalWellbeingOverlapFixtures)(
    "does not steal Mental Wellbeing overlap: %s",
    (utterance) => {
      expect(resolveSocialSupportLegacyOutcome(utterance)).toMatchObject({
        kind: "fallback_to_legacy",
        reasonCode: "social_support_mental_wellbeing_legacy",
      });
    },
  );

  it.each(task19ConciergeOverlapFixtures)(
    "does not steal Concierge or Trusted Help overlap: %s",
    (utterance) => {
      expect(resolveSocialSupportLegacyOutcome(utterance)).toMatchObject({
        kind: "fallback_to_legacy",
        reasonCode: "social_support_concierge_legacy",
      });
    },
  );

  it.each(task19CaregiverBoundaryFixtures)(
    "does not create caregiver permission or human-contact authority: %s",
    (utterance) => {
      expect(resolveSocialSupportLegacyOutcome(utterance)).toMatchObject({
        kind: "fallback_to_legacy",
        reasonCode: "social_support_caregiver_authority_legacy",
      });
    },
  );

  it.each(task19SafetyPrecedenceFixtures)(
    "detects safety-sensitive support wording: %s",
    (utterance) => {
      expect(isSocialSupportSafetySensitiveText(utterance)).toBe(true);
      expect(resolveSocialSupportLegacyOutcome(utterance)).toMatchObject({
        kind: "fallback_to_legacy",
        reasonCode: "social_support_safety_preempted",
      });
    },
  );

  it.each(task19UnsupportedFixtures)(
    "keeps unsupported text outside the migrated slice: $utterance",
    (fixture) => {
      if (fixture.expectedReasonCode === "social_support_external_execution_legacy") {
        expect(isSocialSupportExternalExecutionText(fixture.utterance)).toBe(true);
      }
      expect(resolveSocialSupportLegacyOutcome(fixture.utterance)).toMatchObject({
        kind: "fallback_to_legacy",
        reasonCode: fixture.expectedReasonCode,
      });
    },
  );
});
