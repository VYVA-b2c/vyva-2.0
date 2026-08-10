import { describe, expect, it } from "vitest";
import {
  CANONICAL_PRESENTATION_FAMILIES,
  REFERENCE_EXPERIENCES,
  REQUIRED_PRESENTATION_FAMILY_IDS,
  REQUIRED_REFERENCE_EXPERIENCES,
  REQUIRED_TASK2_UI_INSTRUCTION_TYPES,
  VYVA_PRESENTATION_REGISTRY,
  parsePresentationRegistry,
  validatePresentationEventMapping,
  type PresentationDefinition,
  type PresentationRegistry,
} from "./presentationRegistry";
import {
  emergencyEscalationPresentationFixture,
  expiredNotificationPresentationFixture,
  futurePresentationRegistryFixture,
  medicationConfirmationPresentationFixture,
  medicationReminderPresentationFixture,
  notificationResumePresentationFixture,
  preventiveChoicePresentationFixture,
  preventiveInterruptionPresentationFixture,
  preventiveIntroductionPresentationFixture,
  preventiveRestoredProgressPresentationFixture,
  preventiveResumePresentationFixture,
  preventiveScalePresentationFixture,
  preventiveTransitionCleanupPresentationFixture,
  safeErrorPresentationFixture,
  scamEvidenceChoicePresentationFixture,
  scamImmediateActionsPresentationFixture,
  scamNoObviousIndicatorsPresentationFixture,
  scamScreenshotPresentationFixture,
  telephoneVoiceOnlyPresentationFixture,
  woundCapturePresentationFixture,
  woundConsentPresentationFixture,
  woundContextPresentationFixture,
  woundRetakePresentationFixture,
} from "./presentationRegistryFixtures";
import { OrchestrationContractError } from "./errors";
import { VYVA_FLOW_CATALOGUE } from "./flowCatalogue";

const clone = <T>(value: T): T => structuredClone(value);
const expectCode = (action: () => unknown, code: string) => {
  try {
    action();
    throw new Error("Expected contract validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(OrchestrationContractError);
    expect((error as OrchestrationContractError).code).toBe(code);
  }
};
const mutatePresentation = (
  registry: PresentationRegistry,
  presentationId: string,
  mutation: (presentation: PresentationDefinition) => void,
) => {
  const presentation = registry.presentations.find(
    (item) => item.presentationId === presentationId,
  )!;
  mutation(presentation);
};

describe("Presentation identity and versioning", () => {
  it("accepts the canonical Presentation Registry", () => {
    expect(parsePresentationRegistry(VYVA_PRESENTATION_REGISTRY).presentations)
      .toHaveLength(62);
  });
  it("registers Mental Wellbeing support presentations through existing families", () => {
    const registry = parsePresentationRegistry(VYVA_PRESENTATION_REGISTRY);
    const presentations = new Map(
      registry.presentations.map((presentation) => [presentation.presentationId, presentation]),
    );

    expect(presentations.get("presentation.wellbeing.support.summary")).toMatchObject({
      familyId: "presentation.family.summary",
      supportedFlowIds: ["wellbeing.support"],
      sceneId: "wellbeing.support.main",
      supportedUIInstructionTypes: ["show_summary"],
    });
    expect(presentations.get("presentation.wellbeing.support.checkin")).toMatchObject({
      familyId: "presentation.family.input.free_text",
      supportedFlowIds: ["wellbeing.support"],
      sceneId: "wellbeing.support.main",
      supportedUIInstructionTypes: ["show_text_prompt"],
    });
    expect(presentations.get("presentation.wellbeing.support.safe_fallback")).toMatchObject({
      familyId: "presentation.family.error.safe_fallback",
      supportedFlowIds: ["wellbeing.support"],
      sceneId: "wellbeing.support.main",
      supportedUIInstructionTypes: ["show_summary", "show_choice_question"],
    });
  });
  it("accepts stable namespaced Presentation IDs", () => {
    expect(preventiveIntroductionPresentationFixture.presentationId)
      .toBe("presentation.health.preventive.introduction");
  });
  it.each(["Presentation Bad", "Presentation.Health.Bad", "copy:Continue"])(
    "rejects invalid Presentation ID %s",
    (presentationId) => {
      const registry = clone(VYVA_PRESENTATION_REGISTRY) as unknown as PresentationRegistry;
      registry.presentations[0].presentationId = presentationId;
      expectCode(
        () => parsePresentationRegistry(registry),
        "PRESENTATION_REGISTRY_INVALID",
      );
    },
  );
  it("rejects duplicate Presentation ID/version pairs", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations.push(clone(registry.presentations[0]));
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_ID_DUPLICATE",
    );
  });
  it("rejects duplicate Family ID/version pairs", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.families.push(clone(registry.families[0]));
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_ID_DUPLICATE",
    );
  });
  it("rejects multiple current versions of one Presentation", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations.push({
      ...clone(registry.presentations[0]),
      version: "1.1.0",
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_ID_DUPLICATE",
    );
  });
  it("accepts semantic versions", () => {
    expect(parsePresentationRegistry(VYVA_PRESENTATION_REGISTRY).registryVersion)
      .toBe("1.0.0");
  });
  it.each(["1", "v1.0.0", "1.0", "01.0.0"])(
    "rejects invalid semantic version %s",
    (version) => {
      const registry = clone(VYVA_PRESENTATION_REGISTRY);
      registry.registryVersion = version;
      expectCode(
        () => parsePresentationRegistry(registry),
        "PRESENTATION_VERSION_INVALID",
      );
    },
  );
  it("accepts an explicit deprecated replacement", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].status = "deprecated";
    registry.presentations[0].compatibility.isCurrent = false;
    registry.presentations[0].compatibility.replacementId =
      registry.presentations[1].presentationId;
    registry.presentations[0].compatibility.replacementVersion =
      registry.presentations[1].version;
    expect(parsePresentationRegistry(registry).presentations).toHaveLength(62);
  });
  it("rejects an unresolved deprecated replacement", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].status = "deprecated";
    registry.presentations[0].compatibility.isCurrent = false;
    registry.presentations[0].compatibility.replacementId =
      "presentation.missing.replacement";
    registry.presentations[0].compatibility.replacementVersion = "1.0.0";
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_REFERENCE_INVALID",
    );
  });
  it("rejects a retired current Presentation", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].status = "retired";
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_REGISTRY_INVALID",
    );
  });
});

describe("Family, Flow, scene, and fallback references", () => {
  it("resolves a valid Family", () => {
    expect(CANONICAL_PRESENTATION_FAMILIES.some(
      (family) => family.familyId === preventiveChoicePresentationFixture.familyId,
    )).toBe(true);
  });
  it("rejects a missing Family", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].familyId = "presentation.family.missing";
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_REFERENCE_INVALID",
    );
  });
  it("resolves valid Flow and scene references", () => {
    expect(() => parsePresentationRegistry(VYVA_PRESENTATION_REGISTRY))
      .not.toThrow();
  });
  it("rejects a missing Flow", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].supportedFlowIds = ["health.missing"];
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_REFERENCE_INVALID",
    );
  });
  it("rejects a scene not present in the supported Flow", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].sceneId = "health.preventive_check.missing";
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_SCENE_INVALID",
    );
  });
  it("rejects duplicate supported Flow IDs", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    const flowId = registry.presentations[0].supportedFlowIds[0];
    registry.presentations[0].supportedFlowIds = [flowId, flowId];
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_REGISTRY_INVALID",
    );
  });
  it("accepts a valid fallback", () => {
    expect(parsePresentationRegistry(VYVA_PRESENTATION_REGISTRY).presentations)
      .toContainEqual(woundCapturePresentationFixture);
  });
  it("rejects a missing fallback", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, woundCapturePresentationFixture.presentationId, (item) => {
      item.fallbackPresentationId = "presentation.missing.fallback";
      item.safetyTreatment.safeFallbackPresentationId =
        "presentation.missing.fallback";
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_FALLBACK_INVALID",
    );
  });
  it("rejects an unresolved safety fallback even when a visual fallback resolves", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, woundCapturePresentationFixture.presentationId, (item) => {
      item.safetyTreatment.safeFallbackPresentationId =
        "presentation.missing.safe_fallback";
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_FALLBACK_INVALID",
    );
  });
  it("rejects fallback cycles", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    const first = "presentation.health.preventive.introduction";
    const second = "presentation.health.preventive.progress";
    mutatePresentation(registry, first, (item) => {
      item.fallbackPresentationId = second;
    });
    mutatePresentation(registry, second, (item) => {
      item.fallbackPresentationId = first;
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_REFERENCE_CYCLE",
    );
  });
  it("rejects cycles formed only through safety fallbacks", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, preventiveIntroductionPresentationFixture.presentationId, (item) => {
      item.safetyTreatment.safeFallbackPresentationId =
        safeErrorPresentationFixture.presentationId;
    });
    mutatePresentation(registry, safeErrorPresentationFixture.presentationId, (item) => {
      item.safetyTreatment.safeFallbackPresentationId =
        preventiveIntroductionPresentationFixture.presentationId;
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_REFERENCE_CYCLE",
    );
  });
  it("rejects a safety downgrade through fallback", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, emergencyEscalationPresentationFixture.presentationId, (item) => {
      item.fallbackPresentationId = safeErrorPresentationFixture.presentationId;
      item.safetyTreatment.safeFallbackPresentationId =
        safeErrorPresentationFixture.presentationId;
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_FALLBACK_INVALID",
    );
  });
  it("rejects a privacy downgrade through fallback", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, scamScreenshotPresentationFixture.presentationId, (item) => {
      item.fallbackPresentationId = safeErrorPresentationFixture.presentationId;
      item.safetyTreatment.safeFallbackPresentationId =
        safeErrorPresentationFixture.presentationId;
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_FALLBACK_INVALID",
    );
  });
});

describe("Task 1 event, modality, and answer compatibility", () => {
  const choice = preventiveChoicePresentationFixture;
  it.each([
    ["touch", "USER_TAPPED_OPTION"],
    ["voice", "USER_SPOKE"],
    ["text", "USER_ENTERED_TEXT"],
  ] as const)("supports canonical option mapping through %s", (modality, eventType) => {
    expect(choice.eventMappings.some(
      (mapping) =>
        mapping.inputModality === modality &&
        mapping.interactionEventType === eventType &&
        mapping.normalizedAnswerIntent?.answerKind === "option",
    )).toBe(true);
  });
  it("allows spoken, tapped, and typed choices to resolve to the same option set", () => {
    const expected = choice.expectedInput;
    expect(expected?.answerKind).toBe("option");
    if (expected?.answerKind !== "option") throw new Error("fixture mismatch");
    for (const option of expected.options) {
      const modalities = choice.eventMappings.filter((mapping) => {
        const intent = mapping.normalizedAnswerIntent;
        return intent?.answerKind === "option" && (
          intent.optionId === option.id ||
          intent.allowedOptionIds?.includes(option.id)
        );
      }).map((mapping) => mapping.inputModality);
      expect(new Set(modalities)).toEqual(new Set(["voice", "touch", "text"]));
    }
  });
  it("supports canonical free-text mapping", () => {
    const item = VYVA_PRESENTATION_REGISTRY.presentations.find(
      (presentation) =>
        presentation.presentationId === "presentation.health.preventive.clarification",
    )!;
    expect(item.eventMappings.map((mapping) => mapping.interactionEventType))
      .toEqual(expect.arrayContaining(["USER_SPOKE", "USER_ENTERED_TEXT"]));
  });
  it("supports canonical image mapping", () => {
    expect(woundCapturePresentationFixture.eventMappings[0]).toMatchObject({
      inputModality: "image",
      interactionEventType: "USER_UPLOADED_IMAGE",
    });
  });
  it("supports canonical document mapping", () => {
    const item = VYVA_PRESENTATION_REGISTRY.presentations.find(
      (presentation) =>
        presentation.presentationId === "presentation.trust.scam.document_capture",
    )!;
    expect(item.eventMappings[0]).toMatchObject({
      inputModality: "document",
      interactionEventType: "USER_UPLOADED_DOCUMENT",
    });
  });
  it("supports canonical measurement mapping", () => {
    expect(validatePresentationEventMapping({
      eventMappingId: "presentation.measurement.mapping.submit",
      actionId: "presentation.measurement.action.submit",
      inputModality: "measurement",
      interactionEventType: "USER_ENTERED_MEASUREMENT",
      eventSource: "ui",
      triggerSource: "user",
      passiveInput: false,
      payloadMapping: {
        kind: "measurement",
        source: "submitted_measurement",
        valueField: "payload.value",
        unitField: "payload.unit",
        measurementSchemaId: "presentation.measurement.schema",
      },
      normalizedAnswerIntent: {
        answerKind: "measurement",
        valueSource: "submitted_value",
        unitSource: "submitted_unit",
        measurementSchemaId: "presentation.measurement.schema",
      },
      requiresCurrentQuestionCorrelation: true,
      requiresCurrentSceneCorrelation: true,
      requiresCurrentFlowVersionCorrelation: true,
    })).toMatchObject({
      inputModality: "measurement",
      interactionEventType: "USER_ENTERED_MEASUREMENT",
    });
  });
  it("supports a bounded structured-answer mapping", () => {
    expect(validatePresentationEventMapping({
      eventMappingId: "presentation.structured.mapping.submit",
      actionId: "presentation.structured.action.submit",
      passiveInput: false,
      inputModality: "text",
      interactionEventType: "USER_ENTERED_TEXT",
      eventSource: "ui",
      triggerSource: "user",
      payloadMapping: {
        kind: "structured",
        source: "submitted_structure",
        sourceField: "payload.value",
        valueSchemaId: "presentation.structured.value",
      },
      normalizedAnswerIntent: {
        answerKind: "structured",
        valueSource: "submitted_structure",
        valueSchemaId: "presentation.structured.value",
      },
      requiresCurrentQuestionCorrelation: true,
      requiresCurrentSceneCorrelation: true,
      requiresCurrentFlowVersionCorrelation: true,
    })).toMatchObject({ inputModality: "text" });
  });
  it("supports an inert Tool-result answer mapping", () => {
    expect(validatePresentationEventMapping({
      eventMappingId: "presentation.tool_result.mapping.receive",
      passiveInput: true,
      inputModality: "tool",
      interactionEventType: "TOOL_COMPLETED",
      eventSource: "tool",
      triggerSource: "system",
      payloadMapping: {
        kind: "tool_result",
        source: "event_tool_result",
        resultField: "payload.result",
        expectedToolResultId: "tool.result.medication_lookup",
      },
      normalizedAnswerIntent: {
        answerKind: "tool_result",
        expectedToolResultId: "tool.result.medication_lookup",
      },
      requiresCurrentQuestionCorrelation: true,
      requiresCurrentSceneCorrelation: true,
      requiresCurrentFlowVersionCorrelation: true,
    })).toMatchObject({ inputModality: "tool" });
  });
  it("rejects semantically incompatible modality", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    const mapping = registry.presentations[1].eventMappings[0];
    mapping.inputModality = "voice";
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_EVENT_MAPPING_INVALID",
    );
  });
  it("rejects an unknown event", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY) as unknown as {
      presentations: Array<{ eventMappings: Array<{ interactionEventType: string }> }>;
    };
    registry.presentations[1].eventMappings[0].interactionEventType = "UI_CLICKED";
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_REGISTRY_INVALID",
    );
  });
  it("rejects a noncanonical trigger", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY) as unknown as {
      presentations: Array<{ eventMappings: Array<{ triggerSource: string }> }>;
    };
    registry.presentations[1].eventMappings[0].triggerSource = "notification";
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_REGISTRY_INVALID",
    );
  });
  it("rejects an unknown option ID", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, choice.presentationId, (item) => {
      item.actions[0].optionId = "presentation.option.unknown";
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_EVENT_MAPPING_INVALID",
    );
  });
  it.each([
    "requiresCurrentQuestionCorrelation",
    "requiresCurrentSceneCorrelation",
    "requiresCurrentFlowVersionCorrelation",
  ] as const)("requires interactive %s", (field) => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[1].eventMappings[0][field] = false;
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_EVENT_MAPPING_INVALID",
    );
  });
  it("rejects expected-input kind absent from the Flow", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    const expected = registry.presentations[1].expectedInput!;
    registry.presentations[1].expectedInput = {
      questionId: expected.questionId,
      sceneId: expected.sceneId,
      flowVersion: expected.flowVersion,
      answerKind: "image",
      acceptedContentTypes: ["image/*"],
    };
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_FLOW_INCOMPATIBLE",
    );
  });
});

describe("Task 2 UI instruction compatibility", () => {
  it.each([
    [preventiveChoicePresentationFixture, "show_choice_question"],
    [preventiveScalePresentationFixture, "show_scale"],
    [woundCapturePresentationFixture, "show_image_upload"],
    [scamScreenshotPresentationFixture, "show_image_upload"],
    [medicationReminderPresentationFixture, "show_text_prompt"],
    [medicationConfirmationPresentationFixture, "show_confirmation"],
  ] as const)("accepts supported instruction $1", (presentation, instruction) => {
    expect(presentation.supportedUIInstructionTypes).toContain(instruction);
  });
  it("accepts document-upload and summary instructions", () => {
    const document = VYVA_PRESENTATION_REGISTRY.presentations.find(
      (item) => item.presentationId === "presentation.trust.scam.document_capture",
    )!;
    const summary = scamNoObviousIndicatorsPresentationFixture;
    expect(document.supportedUIInstructionTypes).toContain("show_document_upload");
    expect(summary.supportedUIInstructionTypes).toContain("show_summary");
  });
  it("rejects an unknown UI instruction", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY) as unknown as {
      presentations: Array<{ supportedUIInstructionTypes: string[] }>;
    };
    registry.presentations[0].supportedUIInstructionTypes = ["render_card"];
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_REGISTRY_INVALID",
    );
  });
});

describe("actions and inert execution boundary", () => {
  it("accepts complete action/event mappings", () => {
    expect(preventiveChoicePresentationFixture.actions.every(
      (action) => preventiveChoicePresentationFixture.eventMappings.some(
        (mapping) =>
          mapping.eventMappingId === action.eventMappingId &&
          mapping.actionId === action.actionId,
      ),
    )).toBe(true);
  });
  it("rejects an action without its mapping", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[1].eventMappings =
      registry.presentations[1].eventMappings.filter(
        (mapping) =>
          mapping.eventMappingId !== registry.presentations[1].actions[0].eventMappingId,
      );
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_ACTION_INVALID",
    );
  });
  it("rejects duplicate action IDs", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[1].actions.push(clone(registry.presentations[1].actions[0]));
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_ACTION_INVALID",
    );
  });
  it("rejects duplicate mapping IDs", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[1].eventMappings.push(
      clone(registry.presentations[1].eventMappings[0]),
    );
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_ACTION_INVALID",
    );
  });
  it.each(["callback", "endpoint", "providerClient", "executeTool", "writeMemory"])(
    "rejects direct execution field %s",
    (field) => {
      const registry = clone(VYVA_PRESENTATION_REGISTRY) as unknown as {
        presentations: Array<{ actions: Array<Record<string, unknown>> }>;
      };
      registry.presentations[1].actions[0][field] = "not-allowed";
      expectCode(
        () => parsePresentationRegistry(registry),
        "PRESENTATION_REGISTRY_INVALID",
      );
    },
  );
  it("keeps human-help actions as event declarations only", () => {
    expect(scamImmediateActionsPresentationFixture.actions.every(
      (action) => !Object.keys(action).some(
        (key) => ["endpoint", "callback", "execute", "providerClient"].includes(key),
      ),
    )).toBe(true);
  });
});

describe("voice synchronization", () => {
  it("accepts synchronized screen and speech timing", () => {
    expect(preventiveChoicePresentationFixture.voiceSynchronization)
      .toMatchObject({
        screenUpdateTiming: "with_speech",
        bargeInAllowed: true,
        interruptSpeechOnSubmit: true,
      });
  });
  it("rejects an alias for an unknown option", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, preventiveChoicePresentationFixture.presentationId, (item) => {
      item.voiceSynchronization.optionSpeechAliases[0].optionId =
        "presentation.option.unknown";
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_VOICE_SYNC_INVALID",
    );
  });
  it("keeps spoken aliases aligned with visible options", () => {
    const expected = preventiveChoicePresentationFixture.expectedInput;
    if (expected?.answerKind !== "option") throw new Error("fixture mismatch");
    expect(new Set(
      preventiveChoicePresentationFixture.voiceSynchronization
        .optionSpeechAliases.map((alias) => alias.optionId),
    )).toEqual(new Set(expected.options.map((option) => option.id)));
  });
  it("accepts a telephone voice-only fallback", () => {
    expect(parsePresentationRegistry(VYVA_PRESENTATION_REGISTRY).presentations)
      .toContainEqual(telephoneVoiceOnlyPresentationFixture);
    expect(telephoneVoiceOnlyPresentationFixture.eventMappings.every(
      (mapping) => mapping.inputModality === "voice",
    )).toBe(true);
  });
  it("rejects visual instructions on telephone voice-only", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, telephoneVoiceOnlyPresentationFixture.presentationId, (item) => {
      item.supportedUIInstructionTypes = ["show_choice_question"];
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_DEVICE_INCOMPATIBLE",
    );
  });
});

describe("accessibility and localization", () => {
  it("provides the older-adult accessibility baseline", () => {
    expect(preventiveChoicePresentationFixture.accessibilityPolicy)
      .toMatchObject({
        screenReaderRequired: true,
        minimumTouchTarget: 48,
        largeTextSupported: true,
        highContrastSupported: true,
        cognitiveLoad: "low",
      });
  });
  it("rejects missing touch-target policy", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[1].accessibilityPolicy.minimumTouchTarget = undefined;
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_ACCESSIBILITY_INVALID",
    );
  });
  it("rejects missing screen-reader behavior", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[1].accessibilityPolicy.screenReaderRequired = false;
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_ACCESSIBILITY_INVALID",
    );
  });
  it("rejects safety content without repetition", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, emergencyEscalationPresentationFixture.presentationId, (item) => {
      item.accessibilityPolicy.repetitionAvailable = false;
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_SAFETY_INVALID",
    );
  });
  it("rejects color-only communication structurally", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY) as unknown as {
      presentations: Array<{ visualBehavior: { colorOnlyCommunication: boolean } }>;
    };
    registry.presentations[0].visualBehavior.colorOnlyCommunication = true;
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_REGISTRY_INVALID",
    );
  });
  it("rejects excessive primary actions", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[1].accessibilityPolicy.maximumPrimaryActions = 1;
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_ACCESSIBILITY_INVALID",
    );
  });
  it("rejects voice content without captions when a screen is present", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].voiceSynchronization.captionsRequired = false;
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_ACCESSIBILITY_INVALID",
    );
  });
  it("allows voice-only devices to omit visual accessibility", () => {
    expect(telephoneVoiceOnlyPresentationFixture.accessibilityPolicy)
      .toMatchObject({
        screenReaderRequired: false,
        keyboardNavigationRequired: false,
        captionsRequired: false,
      });
  });
  it("requires every content and action localization key", () => {
    const item = preventiveChoicePresentationFixture;
    const required = new Set(item.localizationPolicy.requiredLocalizationKeys);
    expect(item.contentSlots.every((slot) => required.has(slot.localizationKey)))
      .toBe(true);
    expect(item.actions.every(
      (action) =>
        required.has(action.labelLocalizationKey) &&
        required.has(action.accessibilityLabelKey),
    )).toBe(true);
  });
  it("rejects a missing localization key", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[1].localizationPolicy.requiredLocalizationKeys = [];
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_REGISTRY_INVALID",
    );
  });
  it("rejects duplicate ambiguous content keys", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    const item = registry.presentations[0];
    item.contentSlots[1].localizationKey = item.contentSlots[0].localizationKey;
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_LOCALIZATION_INVALID",
    );
  });
  it("rejects unknown interpolation keys", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].contentSlots[0].interpolationKeys = [
      "interpolation.not_declared",
    ];
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_LOCALIZATION_INVALID",
    );
  });
  it("rejects executable template syntax as a localization key", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].contentSlots[0].localizationKey = "${execute()}";
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_REGISTRY_INVALID",
    );
  });
  it("rejects an unavailable fallback locale", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].localizationPolicy.fallbackLocale = "ar";
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_LOCALIZATION_INVALID",
    );
  });
});

describe("privacy, safety, device, and Channel treatment", () => {
  it("accepts wound evidence privacy treatment", () => {
    expect(woundCapturePresentationFixture.privacyTreatment).toMatchObject({
      sensitivity: "sensitive",
      consentNoticeRequired: true,
      retentionNoticeRequired: true,
      evidencePreviewPolicy: "required",
      safeAbandonmentAvailable: true,
    });
  });
  it.each([
    "consentNoticeRequired",
    "safeAbandonmentAvailable",
  ] as const)("rejects image capture without %s", (field) => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, woundCapturePresentationFixture.presentationId, (item) => {
      item.privacyTreatment[field] = false;
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_PRIVACY_INVALID",
    );
  });
  it("rejects evidence without required retention notice", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, woundCapturePresentationFixture.presentationId, (item) => {
      item.privacyTreatment.autoClearPolicy = "on_exit";
      item.privacyTreatment.retentionNoticeRequired = false;
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_PRIVACY_INVALID",
    );
  });
  it("rejects scam evidence without sensitive treatment", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, scamScreenshotPresentationFixture.presentationId, (item) => {
      item.privacyTreatment.sensitivity = "personal";
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_SAFETY_INVALID",
    );
  });
  it("prevents silent emergency dismissal", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, emergencyEscalationPresentationFixture.presentationId, (item) => {
      item.safetyTreatment.dismissalPolicy = "allowed";
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_SAFETY_INVALID",
    );
  });
  it("requires visible emergency action", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, emergencyEscalationPresentationFixture.presentationId, (item) => {
      item.safetyTreatment.emergencyActionVisible = false;
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_SAFETY_INVALID",
    );
  });
  it("rejects visual-health removal of diagnostic prohibition", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, woundContextPresentationFixture.presentationId, (item) => {
      item.safetyTreatment.prohibitedClaims =
        item.safetyTreatment.prohibitedClaims.filter((claim) => claim !== "diagnosis");
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_SAFETY_INVALID",
    );
  });
  it.each(["guaranteed_safe", "safe_verdict"] as const)(
    "rejects scam removal of %s prohibition",
    (claim) => {
      const registry = clone(VYVA_PRESENTATION_REGISTRY);
      mutatePresentation(registry, scamNoObviousIndicatorsPresentationFixture.presentationId, (item) => {
        item.safetyTreatment.prohibitedClaims =
          item.safetyTreatment.prohibitedClaims.filter((value) => value !== claim);
      });
      expectCode(
        () => parsePresentationRegistry(registry),
        "PRESENTATION_SAFETY_INVALID",
      );
    },
  );
  it("rejects coercive consent defaults", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, woundConsentPresentationFixture.presentationId, (item) => {
      item.safetyTreatment.coerciveDefault = true;
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_SAFETY_INVALID",
    );
  });
  it("keeps Tool confirmation at proposal-only", () => {
    expect(
      VYVA_PRESENTATION_REGISTRY.presentations.find(
        (item) => item.familyId === "presentation.family.tool_confirmation",
      )?.safetyTreatment,
    ).toMatchObject({
      toolExecutionState: "proposal_only",
      prohibitedClaims: expect.arrayContaining(["tool_already_executed"]),
    });
  });
  it("accepts mobile image capture", () => {
    expect(woundCapturePresentationFixture.supportedDeviceClasses)
      .toContain("mobile");
  });
  it("rejects image capture without camera or fallback", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, woundCapturePresentationFixture.presentationId, (item) => {
      item.supportedDeviceClasses = ["desktop"];
      item.fallbackPresentationId = undefined;
      item.safetyTreatment.safeFallbackPresentationId = undefined;
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_DEVICE_INCOMPATIBLE",
    );
  });
  it("rejects a Channel unsupported by the Flow", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, medicationReminderPresentationFixture.presentationId, (item) => {
      item.supportedChannels = ["telephone"];
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_CHANNEL_INCOMPATIBLE",
    );
  });
  it("keeps notification resume on a compatible PWA Channel", () => {
    expect(notificationResumePresentationFixture.supportedChannels).toEqual(["pwa"]);
  });
  it("keeps an outbound-call Presentation on the telephone Channel", () => {
    const outbound = VYVA_PRESENTATION_REGISTRY.presentations.find(
      (item) =>
        item.presentationId === "presentation.engagement.outbound_call.voice",
    )!;
    expect(outbound).toMatchObject({
      supportedChannels: ["telephone"],
      supportedDeviceClasses: ["telephone_voice_only"],
      supportedUIInstructionTypes: [],
    });
    expect(outbound.eventMappings.every(
      (mapping) => mapping.inputModality === "voice",
    )).toBe(true);
  });
});

describe("bounded metadata and implementation isolation", () => {
  it("accepts safe bounded JSON metadata", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].metadata = {
      futurePolicy: { enabled: true, labels: ["one"], note: null },
    };
    expect(parsePresentationRegistry(registry).presentations).toHaveLength(62);
  });
  it.each(["apiKey", "providerClient", "callback"])(
    "rejects reserved metadata key %s",
    (key) => {
      const registry = clone(VYVA_PRESENTATION_REGISTRY);
      registry.presentations[0].metadata = { [key]: "forbidden" };
      expectCode(
        () => parsePresentationRegistry(registry),
        "PRESENTATION_METADATA_INVALID",
      );
    },
  );
  it("rejects class instances", () => {
    class ProviderFixture {
      name = "provider";
    }
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].metadata = { value: new ProviderFixture() } as never;
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_METADATA_INVALID",
    );
  });
  it("rejects excessive metadata depth", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].metadata = {
      a: { b: { c: { d: { e: { f: true } } } } },
    };
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_METADATA_INVALID",
    );
  });
  it("rejects excessive metadata size", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].metadata = { text: "x".repeat(17_000) };
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_METADATA_INVALID",
    );
  });
  it("rejects cyclic metadata", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    registry.presentations[0].metadata = cyclic as never;
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_METADATA_INVALID",
    );
  });
  it("accepts future Family and Presentation fixtures", () => {
    expect(parsePresentationRegistry(futurePresentationRegistryFixture).presentations)
      .toHaveLength(63);
  });
});

describe("registry completeness and frozen-catalogue coherence", () => {
  it("contains every required initial Family ID exactly once", () => {
    const ids = VYVA_PRESENTATION_REGISTRY.families.map((item) => item.familyId);
    expect(new Set(ids)).toEqual(new Set(REQUIRED_PRESENTATION_FAMILY_IDS));
    expect(ids).toHaveLength(24);
  });
  it("covers all six reference experiences", () => {
    const experiences = new Set(
      VYVA_PRESENTATION_REGISTRY.presentations.map(
        (item) => item.metadata.experience,
      ),
    );
    for (const experience of REFERENCE_EXPERIENCES) {
      expect(experiences.has(experience)).toBe(true);
    }
  });
  it("references only valid Families", () => {
    const families = new Set(
      VYVA_PRESENTATION_REGISTRY.families.map((item) => item.familyId),
    );
    expect(VYVA_PRESENTATION_REGISTRY.presentations.every(
      (item) => families.has(item.familyId),
    )).toBe(true);
  });
  it("references only valid Flows and scenes", () => {
    const flowMap = new Map(
      VYVA_FLOW_CATALOGUE.flows.map((flow) => [flow.flowId, flow]),
    );
    expect(VYVA_PRESENTATION_REGISTRY.presentations.every(
      (item) => item.supportedFlowIds.every(
        (flowId) => flowMap.get(flowId)?.uiScenes.some(
          (scene) => scene.sceneId === item.sceneId,
        ),
      ),
    )).toBe(true);
  });
  it("gives every interactive Presentation complete mappings", () => {
    expect(VYVA_PRESENTATION_REGISTRY.presentations.every(
      (item) =>
        item.expectedInput === null ||
        (
          item.eventMappings.length > 0 &&
          item.eventMappings.every(
            (mapping) =>
              mapping.requiresCurrentQuestionCorrelation &&
              mapping.requiresCurrentSceneCorrelation &&
              mapping.requiresCurrentFlowVersionCorrelation,
          )
        ),
    )).toBe(true);
  });
  it("gives every eligible Presentation accessibility policy", () => {
    expect(VYVA_PRESENTATION_REGISTRY.presentations.filter(
      (item) => ["approved", "pilot", "active"].includes(item.status),
    ).every((item) => Boolean(item.accessibilityPolicy))).toBe(true);
  });
  it("gives all wound Presentations privacy and diagnostic boundaries", () => {
    expect(VYVA_PRESENTATION_REGISTRY.presentations.filter(
      (item) => item.metadata.experience === "wound",
    ).every(
      (item) =>
        item.privacyTreatment.sensitivity === "sensitive" &&
        item.safetyTreatment.prohibitedClaims.includes("diagnosis"),
    )).toBe(true);
  });
  it("gives all scam Presentations safe-verdict prohibitions", () => {
    expect(VYVA_PRESENTATION_REGISTRY.presentations.filter(
      (item) => item.metadata.experience === "scam",
    ).every(
      (item) =>
        item.safetyTreatment.prohibitedClaims.includes("guaranteed_safe") &&
        item.safetyTreatment.prohibitedClaims.includes("safe_verdict"),
    )).toBe(true);
  });
  it("gives every emergency Presentation critical treatment", () => {
    expect(VYVA_PRESENTATION_REGISTRY.presentations.filter(
      (item) => item.metadata.experience === "emergency",
    ).every(
      (item) =>
        item.safetyTreatment.safetyCritical &&
        item.safetyTreatment.dismissalPolicy === "prohibited" &&
        item.safetyTreatment.emergencyActionVisible,
    )).toBe(true);
  });
  it("resolves every fallback", () => {
    const ids = new Set(
      VYVA_PRESENTATION_REGISTRY.presentations.map((item) => item.presentationId),
    );
    expect(VYVA_PRESENTATION_REGISTRY.presentations.every(
      (item) => !item.fallbackPresentationId || ids.has(item.fallbackPresentationId),
    )).toBe(true);
  });
  it("keeps registry data provider-neutral and inert", () => {
    const serialized = JSON.stringify(VYVA_PRESENTATION_REGISTRY);
    expect(serialized).not.toMatch(
      /apiKey|accessToken|providerClient|reactComponent|callback|endpoint/,
    );
    expect(VYVA_PRESENTATION_REGISTRY.metadata.runtimeConnected).toBe(false);
  });
  it("exports the required representative fixtures", () => {
    expect([
      preventiveIntroductionPresentationFixture,
      preventiveChoicePresentationFixture,
      preventiveScalePresentationFixture,
      medicationReminderPresentationFixture,
      medicationConfirmationPresentationFixture,
      woundConsentPresentationFixture,
      woundCapturePresentationFixture,
      woundRetakePresentationFixture,
      woundContextPresentationFixture,
      scamEvidenceChoicePresentationFixture,
      scamScreenshotPresentationFixture,
      scamImmediateActionsPresentationFixture,
      scamNoObviousIndicatorsPresentationFixture,
      emergencyEscalationPresentationFixture,
      notificationResumePresentationFixture,
      expiredNotificationPresentationFixture,
      telephoneVoiceOnlyPresentationFixture,
      safeErrorPresentationFixture,
    ].every(Boolean)).toBe(true);
  });
});

describe("final Task 3.5 interaction hardening", () => {
  it("rejects interactive Presentations without actions", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, preventiveChoicePresentationFixture.presentationId, (item) => {
      item.actions = [];
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_INTERACTION_INVALID",
    );
  });
  it("rejects interactive Presentations without mappings", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, preventiveChoicePresentationFixture.presentationId, (item) => {
      item.eventMappings = [];
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_INTERACTION_INVALID",
    );
  });
  it("rejects interactive Presentations with only non-answer mappings", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, preventiveChoicePresentationFixture.presentationId, (item) => {
      item.eventMappings = item.eventMappings.map((mapping) => ({
        ...mapping,
        payloadMapping: { kind: "control", source: "action" },
        normalizedAnswerIntent: undefined,
      }));
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_INTERACTION_INVALID",
    );
  });
  it("accepts an explicitly passive speech-answer mapping", () => {
    const mapping = preventiveChoicePresentationFixture.eventMappings.find(
      (item) => item.inputModality === "voice",
    )!;
    expect(mapping).toMatchObject({
      passiveInput: true,
      actionId: undefined,
      inputModality: "voice",
    });
    expect(() => parsePresentationRegistry(VYVA_PRESENTATION_REGISTRY))
      .not.toThrow();
  });
  it("accepts a noninteractive Presentation without mappings", () => {
    expect(preventiveRestoredProgressPresentationFixture).toMatchObject({
      expectedInput: null,
      actions: [],
      eventMappings: [],
    });
  });
  it("rejects a mapping with a mismatched answer intent", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, preventiveChoicePresentationFixture.presentationId, (item) => {
      item.eventMappings[0].normalizedAnswerIntent = {
        answerKind: "free_text",
        valueSource: "submitted_text",
      };
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_EVENT_MAPPING_INVALID",
    );
  });
  it("rejects executable fields in a payload mapping", () => {
    const mapping = clone(
      preventiveChoicePresentationFixture.eventMappings[0],
    ) as unknown as Record<string, unknown>;
    (mapping.payloadMapping as Record<string, unknown>).transform =
      "value => execute(value)";
    expectCode(
      () => validatePresentationEventMapping(mapping),
      "PRESENTATION_EVENT_MAPPING_INVALID",
    );
  });
  it("rejects an excessive serialized payload mapping", () => {
    const mapping = clone(
      preventiveChoicePresentationFixture.eventMappings.find(
        (item) => item.inputModality === "voice",
      )!,
    );
    if (mapping.normalizedAnswerIntent?.answerKind !== "option") {
      throw new Error("fixture mismatch");
    }
    mapping.normalizedAnswerIntent.allowedOptionIds = Array.from(
      { length: 50 },
      (_, index) =>
        `presentation.option.${String(index).padStart(2, "0")}.${"x".repeat(180)}`,
    );
    expectCode(
      () => validatePresentationEventMapping(mapping),
      "PRESENTATION_EVENT_MAPPING_INVALID",
    );
  });
});

describe("final Task 3.5 metadata hardening", () => {
  it.each([
    "diagnosis",
    "fraudDecision",
    "hiddenReasoning",
    "rawProviderError",
    "endpoint",
    "url",
    "executeTool",
    "writeMemory",
    "notifyCaregiver",
    "scheduleFollowup",
    "startFlow",
  ])("rejects semantic metadata key %s", (key) => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].metadata = { [key]: "redacted" };
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_METADATA_INVALID",
    );
  });
  it("rejects a prohibited key in a nested object", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].metadata = {
      architecture: { internal_reasoning: "redacted" },
    };
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_METADATA_INVALID",
    );
  });
  it("rejects a prohibited key in an object nested in an array", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].metadata = {
      architecture: [{ providerStack: "redacted" }],
    };
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_METADATA_INVALID",
    );
  });
  it.each(["token", "adapter", "authorizationHeader"])(
    "rejects prohibited top-level metadata key %s",
    (key) => {
      const registry = clone(VYVA_PRESENTATION_REGISTRY);
      registry.presentations[0].metadata = { [key]: "redacted" };
      expectCode(
        () => parsePresentationRegistry(registry),
        "PRESENTATION_METADATA_INVALID",
      );
    },
  );
  it.each([
    ["auth", "token"],
    ["integration", "adapter"],
    ["headers", "authorizationHeader"],
  ])("rejects nested metadata key %s.%s", (container, key) => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].metadata = {
      [container]: { [key]: "redacted" },
    };
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_METADATA_INVALID",
    );
  });
  it.each(["token", "adapter", "authorizationHeader"])(
    "rejects array-nested metadata key items[0].%s",
    (key) => {
      const registry = clone(VYVA_PRESENTATION_REGISTRY);
      registry.presentations[0].metadata = {
        items: [{ [key]: "redacted" }],
      };
      expectCode(
        () => parsePresentationRegistry(registry),
        "PRESENTATION_METADATA_INVALID",
      );
    },
  );
  it.each([
    "TOKEN",
    "auth_token",
    "provider_adapter",
    "authorization_header",
  ])("rejects case or separator variant %s", (key) => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].metadata = { [key]: "redacted" };
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_METADATA_INVALID",
    );
  });
  it("accepts safe declarative policy and identifier metadata", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].metadata = {
      adapterRequired: true,
      adapterPolicy: "future_authorized_only",
      migrationAdapterId: "architecture.migration.presentation",
      tokenPolicy: "credentials_prohibited",
      authorizationPolicy: "orchestrator_approved",
      providerNeutral: true,
      runtimeResponsibility: "future_channel_adapter",
    };
    expect(() => parsePresentationRegistry(registry)).not.toThrow();
  });
  it.each([
    "hiddenReasoning",
    "diagnosis",
    "medicationAdvice",
    "fraudDecision",
    "rawProviderError",
    "endpoint",
    "executeTool",
    "writeMemory",
    "notifyCaregiver",
    "scheduleFollowup",
    "apiKey",
    "accessToken",
    "providerClient",
    "providerAdapter",
    "sdkClient",
    "callback",
    "url",
  ])("continues to reject existing prohibited metadata key %s", (key) => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].metadata = { [key]: "redacted" };
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_METADATA_INVALID",
    );
  });
  it("returns a typed fixed metadata error without submitted values", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    const submittedValue = "never-echo-this-token-value";
    registry.presentations[0].metadata = { token: submittedValue };
    try {
      parsePresentationRegistry(registry);
      throw new Error("Expected contract validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(OrchestrationContractError);
      expect((error as OrchestrationContractError).code)
        .toBe("PRESENTATION_METADATA_INVALID");
      expect((error as Error).message).toBe(
        "Presentation Registry metadata is invalid.",
      );
      expect((error as Error).message).not.toContain(submittedValue);
      expect((error as Error).message).not.toContain("token");
    }
  });
});

describe("final Task 3.5 fallback coherence", () => {
  it("accepts a same-Flow fallback", () => {
    expect(() => parsePresentationRegistry(VYVA_PRESENTATION_REGISTRY))
      .not.toThrow();
  });
  it("accepts a shared multi-Flow generic fallback", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, preventiveChoicePresentationFixture.presentationId, (item) => {
      item.fallbackPresentationId = safeErrorPresentationFixture.presentationId;
      item.safetyTreatment.safeFallbackPresentationId =
        safeErrorPresentationFixture.presentationId;
    });
    mutatePresentation(registry, safeErrorPresentationFixture.presentationId, (item) => {
      item.supportedFlowIds.push("medication.reminder");
    });
    expect(() => parsePresentationRegistry(registry)).not.toThrow();
  });
  it("rejects an unrelated Flow fallback", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, preventiveChoicePresentationFixture.presentationId, (item) => {
      item.fallbackPresentationId =
        medicationConfirmationPresentationFixture.presentationId;
      item.safetyTreatment.safeFallbackPresentationId =
        medicationConfirmationPresentationFixture.presentationId;
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_FALLBACK_INVALID",
    );
  });
  it("rejects a fallback bound to an unrelated scene", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, safeErrorPresentationFixture.presentationId, (item) => {
      item.sceneId = "medication.reminder.main";
      if (item.expectedInput) item.expectedInput.sceneId = item.sceneId;
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_SCENE_INVALID",
    );
  });
  it("rejects a fallback declaration that can initiate another Flow", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations.find(
      (item) => item.presentationId === safeErrorPresentationFixture.presentationId,
    )!.metadata = { startFlowId: "medication.reminder" };
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_METADATA_INVALID",
    );
  });
});

describe("final Task 3.5 privacy fallback monotonicity", () => {
  const privacyDowngrades: Array<[
    string,
    (source: PresentationDefinition, fallback: PresentationDefinition) => void,
  ]> = [
    ["sensitivity", (source, fallback) => {
      source.privacyTreatment.sensitivity = "sensitive";
      fallback.privacyTreatment.sensitivity = "personal";
    }],
    ["hideInAppSwitcher", (source, fallback) => {
      source.privacyTreatment.hideInAppSwitcher = true;
      fallback.privacyTreatment.hideInAppSwitcher = false;
    }],
    ["screenObscuringAllowed", (source, fallback) => {
      source.privacyTreatment.screenObscuringAllowed = true;
      fallback.privacyTreatment.screenObscuringAllowed = false;
    }],
    ["screenshotPolicy", (source, fallback) => {
      source.privacyTreatment.screenshotPolicy = "prohibited";
      fallback.privacyTreatment.screenshotPolicy = "allowed";
    }],
    ["recordingPolicy", (source, fallback) => {
      source.privacyTreatment.recordingPolicy = "prohibited";
      fallback.privacyTreatment.recordingPolicy = "allowed";
    }],
    ["evidencePreviewPolicy", (source, fallback) => {
      source.privacyTreatment.evidencePreviewPolicy = "required";
      fallback.privacyTreatment.evidencePreviewPolicy = "optional";
    }],
    ["autoClearPolicy", (source, fallback) => {
      source.privacyTreatment.autoClearPolicy = "after_submission";
      fallback.privacyTreatment.autoClearPolicy = "timed";
    }],
    ["consentNoticeRequired", (source, fallback) => {
      source.privacyTreatment.consentNoticeRequired = true;
      fallback.privacyTreatment.consentNoticeRequired = false;
    }],
    ["retentionNoticeRequired", (source, fallback) => {
      source.privacyTreatment.retentionNoticeRequired = true;
      fallback.privacyTreatment.retentionNoticeRequired = false;
    }],
    ["shoulderSurfingWarning", (source, fallback) => {
      source.privacyTreatment.shoulderSurfingWarning = true;
      fallback.privacyTreatment.shoulderSurfingWarning = false;
    }],
    ["caregiverVisibility", (source, fallback) => {
      source.privacyTreatment.caregiverVisibility = "none";
      fallback.privacyTreatment.caregiverVisibility = "authorized_summary";
    }],
    ["operatorVisibility", (source, fallback) => {
      source.privacyTreatment.operatorVisibility = "none";
      fallback.privacyTreatment.operatorVisibility = "authorized_case";
    }],
  ];
  it.each(privacyDowngrades)("rejects a %s downgrade", (_name, downgrade) => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    const source = registry.presentations.find(
      (item) => item.presentationId === woundCapturePresentationFixture.presentationId,
    )!;
    const fallback = registry.presentations.find(
      (item) => item.presentationId === source.fallbackPresentationId,
    )!;
    downgrade(source, fallback);
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_PRIVACY_INVALID",
    );
  });
});

describe("final Task 3.5 safety fallback monotonicity", () => {
  const safetyDowngrades: Array<[
    string,
    (source: PresentationDefinition, fallback: PresentationDefinition) => void,
  ]> = [
    ["safetyCritical", (_source, fallback) => {
      fallback.safetyTreatment.safetyCritical = false;
    }],
    ["urgency", (_source, fallback) => {
      fallback.safetyTreatment.urgency = "routine";
    }],
    ["dismissalPolicy", (_source, fallback) => {
      fallback.safetyTreatment.dismissalPolicy = "allowed";
    }],
    ["deferPolicy", (_source, fallback) => {
      fallback.safetyTreatment.deferPolicy = "allowed";
    }],
    ["acknowledgementRequired", (_source, fallback) => {
      fallback.safetyTreatment.acknowledgementRequired = false;
    }],
    ["confirmationRequired", (_source, fallback) => {
      fallback.safetyTreatment.confirmationRequired = false;
    }],
    ["humanHelpAvailable", (_source, fallback) => {
      fallback.safetyTreatment.humanHelpAvailable = false;
    }],
    ["emergencyActionVisible", (_source, fallback) => {
      fallback.safetyTreatment.emergencyActionVisible = false;
    }],
    ["prohibitedClaims", (source, fallback) => {
      source.safetyTreatment.prohibitedClaims = ["diagnosis"];
      fallback.safetyTreatment.prohibitedClaims = [];
    }],
    ["requiredDisclaimers", (source, fallback) => {
      source.safetyTreatment.requiredDisclaimers = [
        "presentation.disclaimer.emergency",
      ];
      fallback.safetyTreatment.requiredDisclaimers = [];
    }],
    ["timeoutBehavior", (_source, fallback) => {
      fallback.safetyTreatment.timeoutBehavior = "expire";
    }],
  ];
  it.each(safetyDowngrades)("rejects a %s downgrade", (_name, downgrade) => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    const source = registry.presentations.find(
      (item) =>
        item.presentationId === emergencyEscalationPresentationFixture.presentationId,
    )!;
    const fallback = registry.presentations.find(
      (item) => item.presentationId === source.fallbackPresentationId,
    )!;
    downgrade(source, fallback);
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_SAFETY_INVALID",
    );
  });
});

describe("final Task 3.5 UI, device, alias, and status hardening", () => {
  it("covers every independently listed Task 2 UI instruction", () => {
    const covered = new Set(
      CANONICAL_PRESENTATION_FAMILIES.flatMap(
        (family) => family.supportedUIInstructionTypes,
      ),
    );
    expect(REQUIRED_TASK2_UI_INSTRUCTION_TYPES.every(
      (instruction) => covered.has(instruction),
    )).toBe(true);
    expect(covered.has("clear_scene")).toBe(true);
  });
  it("provides a noninteractive clear-scene Presentation", () => {
    expect(preventiveTransitionCleanupPresentationFixture).toMatchObject({
      expectedInput: null,
      supportedUIInstructionTypes: ["clear_scene"],
    });
  });
  it("rejects telephone-only touch input", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, telephoneVoiceOnlyPresentationFixture.presentationId, (item) => {
      item.eventMappings[0].inputModality = "touch";
      item.eventMappings[0].interactionEventType = "USER_TAPPED_OPTION";
      item.eventMappings[0].eventSource = "ui";
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_DEVICE_INCOMPATIBLE",
    );
  });
  it.each(["capture_image", "upload_document"] as const)(
    "rejects telephone-only %s action",
    (kind) => {
      const registry = clone(VYVA_PRESENTATION_REGISTRY);
      mutatePresentation(registry, telephoneVoiceOnlyPresentationFixture.presentationId, (item) => {
        item.actions[0].kind = kind;
        const family = registry.families.find(
          (candidate) => candidate.familyId === item.familyId,
        )!;
        family.supportedActionKinds.push(kind);
      });
      expectCode(
        () => parsePresentationRegistry(registry),
        "PRESENTATION_DEVICE_INCOMPATIBLE",
      );
    },
  );
  it("accepts a multimodal visual Presentation", () => {
    expect(() => parsePresentationRegistry(VYVA_PRESENTATION_REGISTRY))
      .not.toThrow();
  });
  it("accepts a visual telephone-capable Presentation with a voice fallback", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, preventiveChoicePresentationFixture.presentationId, (item) => {
      item.supportedChannels.push("telephone");
      item.eventMappings = item.eventMappings.filter(
        (mapping) => mapping.inputModality !== "voice",
      );
      item.fallbackPresentationId =
        telephoneVoiceOnlyPresentationFixture.presentationId;
      item.safetyTreatment.safeFallbackPresentationId =
        telephoneVoiceOnlyPresentationFixture.presentationId;
    });
    expect(() => parsePresentationRegistry(registry)).not.toThrow();
  });
  it("accepts canonical-label speech alias fallback", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, preventiveChoicePresentationFixture.presentationId, (item) => {
      item.voiceSynchronization.optionSpeechAliases = [];
      item.voiceSynchronization.useCanonicalLabelsAsSpeechAliases = true;
    });
    expect(() => parsePresentationRegistry(registry)).not.toThrow();
  });
  it("rejects duplicate option-alias records", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, preventiveChoicePresentationFixture.presentationId, (item) => {
      item.voiceSynchronization.optionSpeechAliases.push(
        clone(item.voiceSynchronization.optionSpeechAliases[0]),
      );
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_VOICE_SYNC_INVALID",
    );
  });
  it("rejects duplicate aliases case-insensitively", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, preventiveChoicePresentationFixture.presentationId, (item) => {
      const aliases = item.voiceSynchronization.optionSpeechAliases[0].aliases;
      aliases.push(aliases[0].toUpperCase());
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_VOICE_SYNC_INVALID",
    );
  });
  it("rejects one alias mapped to different options", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    mutatePresentation(registry, preventiveChoicePresentationFixture.presentationId, (item) => {
      item.voiceSynchronization.optionSpeechAliases[1].aliases[0] =
        item.voiceSynchronization.optionSpeechAliases[0].aliases[0].toUpperCase();
    });
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_VOICE_SYNC_INVALID",
    );
  });
  it.each(["deprecated", "retired"] as const)(
    "rejects a current %s Family",
    (status) => {
      const registry = clone(VYVA_PRESENTATION_REGISTRY);
      registry.families[0].status = status;
      expectCode(
        () => parsePresentationRegistry(registry),
        "PRESENTATION_FAMILY_INVALID",
      );
    },
  );
  it("rejects a current deprecated Presentation", () => {
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.presentations[0].status = "deprecated";
    registry.presentations[0].compatibility.replacementId =
      registry.presentations[1].presentationId;
    registry.presentations[0].compatibility.replacementVersion =
      registry.presentations[1].version;
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_REGISTRY_INVALID",
    );
  });
});

describe("final Task 3.5 independent and reference completeness", () => {
  it("keeps required Families independent from registry seed output", () => {
    expect(REQUIRED_PRESENTATION_FAMILY_IDS).toHaveLength(24);
    const registry = clone(VYVA_PRESENTATION_REGISTRY);
    registry.families = registry.families.filter(
      (family) => family.familyId !== REQUIRED_PRESENTATION_FAMILY_IDS[0],
    );
    expectCode(
      () => parsePresentationRegistry(registry),
      "PRESENTATION_FAMILY_INVALID",
    );
  });
  it("publishes six explicit required reference experience IDs", () => {
    expect(REQUIRED_REFERENCE_EXPERIENCES).toEqual([
      "preventive_health",
      "medication",
      "wound",
      "scam",
      "emergency",
      "notification_resume",
    ]);
    expect(REFERENCE_EXPERIENCES).toBe(REQUIRED_REFERENCE_EXPERIENCES);
  });
  it("covers Preventive Health interruption, resume, and restored progress", () => {
    expect([
      preventiveInterruptionPresentationFixture,
      preventiveResumePresentationFixture,
      preventiveRestoredProgressPresentationFixture,
    ].map((item) => item.sceneId)).toEqual([
      "health.preventive_check.main",
      "health.preventive_check.main",
      "health.preventive_check.main",
    ]);
  });
  it("does not claim domain-specific deferred telephone transitions", () => {
    const ids = VYVA_PRESENTATION_REGISTRY.presentations.map(
      (item) => item.presentationId,
    );
    expect(ids).not.toContain("presentation.medication.outbound_call");
    expect(ids).not.toContain("presentation.safety.emergency.telephone");
    expect(ids).not.toContain("presentation.engagement.notification_push_to_voice");
  });
});
