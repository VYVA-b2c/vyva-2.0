import {
  VYVA_PRESENTATION_REGISTRY,
  type PresentationDefinition,
  type PresentationFamily,
  type PresentationRegistry,
} from "./presentationRegistry";

function presentation(presentationId: string): PresentationDefinition {
  return VYVA_PRESENTATION_REGISTRY.presentations.find(
    (item) => item.presentationId === presentationId,
  )!;
}

export const preventiveIntroductionPresentationFixture = presentation(
  "presentation.health.preventive.introduction",
);
export const preventiveChoicePresentationFixture = presentation(
  "presentation.health.preventive.choice",
);
export const preventiveScalePresentationFixture = presentation(
  "presentation.health.preventive.scale",
);
export const preventiveInterruptionPresentationFixture = presentation(
  "presentation.health.preventive.interruption",
);
export const preventiveResumePresentationFixture = presentation(
  "presentation.health.preventive.resume",
);
export const preventiveRestoredProgressPresentationFixture = presentation(
  "presentation.health.preventive.restored_progress",
);
export const preventiveTransitionCleanupPresentationFixture = presentation(
  "presentation.health.preventive.transition_cleanup",
);
export const medicationReminderPresentationFixture = presentation(
  "presentation.medication.reminder",
);
export const medicationConfirmationPresentationFixture = presentation(
  "presentation.medication.confirmation",
);
export const woundConsentPresentationFixture = presentation(
  "presentation.health.wound.consent",
);
export const woundCapturePresentationFixture = presentation(
  "presentation.health.wound.capture",
);
export const woundRetakePresentationFixture = presentation(
  "presentation.health.wound.retake",
);
export const woundContextPresentationFixture = presentation(
  "presentation.health.wound.context_questions",
);
export const scamEvidenceChoicePresentationFixture = presentation(
  "presentation.trust.scam.evidence_choice",
);
export const scamScreenshotPresentationFixture = presentation(
  "presentation.trust.scam.screenshot_capture",
);
export const scamImmediateActionsPresentationFixture = presentation(
  "presentation.trust.scam.immediate_actions",
);
export const scamNoObviousIndicatorsPresentationFixture = presentation(
  "presentation.trust.scam.no_obvious_indicators",
);
export const emergencyEscalationPresentationFixture = presentation(
  "presentation.safety.emergency_action",
);
export const notificationResumePresentationFixture = presentation(
  "presentation.engagement.notification_resume",
);
export const expiredNotificationPresentationFixture = presentation(
  "presentation.engagement.expired",
);
export const telephoneVoiceOnlyPresentationFixture = presentation(
  "presentation.health.preventive.telephone_fallback",
);
export const safeErrorPresentationFixture = presentation(
  "presentation.error.safe_generic",
);

export const futurePresentationFamilyFixture: PresentationFamily = {
  ...structuredClone(VYVA_PRESENTATION_REGISTRY.families[0]),
  familyId: "presentation.family.future.guidance",
  displayName: "Future Guidance",
  description: "Synthetic provider-neutral future Presentation Family.",
};

export const futurePresentationDefinitionFixture: PresentationDefinition = {
  ...structuredClone(preventiveIntroductionPresentationFixture),
  presentationId: "presentation.future.guidance",
  displayName: "Future Guidance",
  description: "Synthetic provider-neutral future Presentation Definition.",
  familyId: futurePresentationFamilyFixture.familyId,
  contentSlots: preventiveIntroductionPresentationFixture.contentSlots.map(
    (slot, index) => ({
      ...structuredClone(slot),
      slotId: `presentation.future.guidance.slot.${slot.type}_${index}`,
      localizationKey: `presentation.future.guidance.content.${slot.type}_${index}`,
    }),
  ),
  voiceSynchronization: {
    ...structuredClone(preventiveIntroductionPresentationFixture.voiceSynchronization),
    spokenContentSlotIds:
      preventiveIntroductionPresentationFixture.contentSlots.map(
        (slot, index) =>
          `presentation.future.guidance.slot.${slot.type}_${index}`,
      ),
  },
  localizationPolicy: {
    ...structuredClone(preventiveIntroductionPresentationFixture.localizationPolicy),
    requiredLocalizationKeys:
      preventiveIntroductionPresentationFixture.contentSlots.map(
        (slot, index) =>
          `presentation.future.guidance.content.${slot.type}_${index}`,
      ),
  },
  designArtifactReferences: [{
    referenceId: "presentation.future.guidance.design_spec",
    type: "design_spec",
    version: "1.0.0",
    status: "draft",
  }],
  metadata: { syntheticFixture: true, runtimeConnected: false },
};

export const futurePresentationRegistryFixture: PresentationRegistry = {
  ...structuredClone(VYVA_PRESENTATION_REGISTRY),
  families: [
    ...structuredClone(VYVA_PRESENTATION_REGISTRY.families),
    futurePresentationFamilyFixture,
  ],
  presentations: [
    ...structuredClone(VYVA_PRESENTATION_REGISTRY.presentations),
    futurePresentationDefinitionFixture,
  ],
};
