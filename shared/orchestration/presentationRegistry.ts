import { z } from "zod";
import {
  EVENT_SEMANTIC_RULES,
  INTERACTION_EVENT_SOURCES,
  INTERACTION_EVENT_TYPES,
  INTERACTION_MODALITIES,
  interactionTriggerSourceSchema,
} from "./events";
import {
  ANSWER_KIND_MODALITY_COMPATIBILITY,
  ANSWER_KINDS,
  expectedFlowInputSchema,
  type AnswerKind,
  type ExpectedFlowInput,
} from "./flowState";
import {
  boundedMetadataSchema,
  FLOW_CHANNELS,
  VYVA_FLOW_CATALOGUE,
} from "./flowCatalogue";
import {
  OrchestrationContractError,
  type OrchestrationContractErrorCode,
} from "./errors";
import {
  specialistUIInstructionSchema,
  type SpecialistUIInstruction,
} from "./specialist";

const stableIdSchema = z.string()
  .regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/);
const semanticReferenceSchema = z.string()
  .regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/)
  .max(240);
const semverSchema = z.string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
const localizationKeySchema = z.string()
  .regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/)
  .max(240);
const textSchema = z.string().min(1).max(2_000);
const unique = <T extends z.ZodTypeAny>(schema: T, minimum = 0) =>
  z.array(schema).min(minimum).superRefine((items, context) => {
    if (new Set(items).size !== items.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate values" });
    }
  });

type UIInstructionType = SpecialistUIInstruction["type"];
const UI_INSTRUCTION_TYPES = specialistUIInstructionSchema.options.map(
  (option) => option.shape.type.value,
) as UIInstructionType[];
export const REQUIRED_TASK2_UI_INSTRUCTION_TYPES = [
  "show_choice_question",
  "show_scale",
  "show_text_prompt",
  "show_measurement_input",
  "show_image_upload",
  "show_document_upload",
  "show_summary",
  "show_confirmation",
  "show_progress",
  "clear_scene",
] as const satisfies readonly UIInstructionType[];
const uiInstructionTypeSchema = z.custom<UIInstructionType>(
  (value) => (
    typeof value === "string" &&
    UI_INSTRUCTION_TYPES.includes(value as UIInstructionType)
  ),
  { message: "unsupported Task 2 UI instruction" },
);

export const PRESENTATION_STATUSES = [
  "draft", "approved", "pilot", "active", "deprecated", "retired",
] as const;
export const PRESENTATION_DEVICE_CLASSES = [
  "mobile", "tablet", "desktop", "kiosk", "television", "smart_display",
  "telephone_voice_only",
] as const;
export const PRESENTATION_ACTION_KINDS = [
  "submit_option", "submit_text", "submit_measurement", "capture_image",
  "upload_image", "retake_image", "capture_document", "upload_document",
  "confirm", "cancel", "defer", "dismiss", "request_help", "request_human",
  "retry", "continue", "go_back", "open_accessibility_help",
] as const;
export const PRESENTATION_CONTENT_SLOT_TYPES = [
  "title", "subtitle", "instruction", "question", "explanation",
  "privacy_notice", "safety_notice", "disclaimer", "acknowledgement",
  "helper_text", "status_message", "summary", "error_message", "action_label",
  "progress_label",
] as const;

const presentationCompatibilitySchema = z.object({
  isCurrent: z.boolean(),
  minimumCompatibleVersion: semverSchema.optional(),
  migrationPolicy: z.enum(["none", "explicit_adapter", "restart_required"]),
  breakingChange: z.boolean(),
  deprecatedVersions: unique(semverSchema),
  replacementId: stableIdSchema.optional(),
  replacementVersion: semverSchema.optional(),
}).strict().superRefine((value, context) => {
  if (Boolean(value.replacementId) !== Boolean(value.replacementVersion)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "replacement pair required" });
  }
});

export const presentationFamilySchema = z.object({
  familyId: stableIdSchema,
  version: semverSchema,
  displayName: z.string().min(1).max(160),
  description: textSchema,
  category: z.enum([
    "introduction", "choice", "input", "confirmation", "progress", "summary",
    "consent", "capture", "tool", "followup", "interruption", "resume",
    "safety", "error", "stale",
  ]),
  supportedInputKinds: unique(z.enum(ANSWER_KINDS)),
  supportedUIInstructionTypes: unique(uiInstructionTypeSchema),
  supportedChannels: unique(z.enum(FLOW_CHANNELS), 1),
  supportedDeviceClasses: unique(z.enum(PRESENTATION_DEVICE_CLASSES), 1),
  requiredContentSlots: unique(z.enum(PRESENTATION_CONTENT_SLOT_TYPES)),
  optionalContentSlots: unique(z.enum(PRESENTATION_CONTENT_SLOT_TYPES)),
  supportedActionKinds: unique(z.enum(PRESENTATION_ACTION_KINDS)),
  accessibilityCapabilities: unique(z.enum([
    "screen_reader", "keyboard_navigation", "large_text", "high_contrast",
    "reduced_motion", "captions", "voice_fallback", "touch_fallback",
    "repetition", "timeout_extension",
  ])),
  privacyCapabilities: unique(z.enum([
    "screen_obscuring", "app_switcher_hiding", "screenshot_restriction",
    "recording_restriction", "evidence_preview", "auto_clear",
    "consent_notice", "retention_notice", "safe_abandonment",
  ])),
  safetyCapabilities: unique(z.enum([
    "non_dismissible", "acknowledgement", "human_help", "emergency_action",
    "safe_fallback", "prohibited_claims", "disclaimer", "proposal_boundary",
  ])),
  providerNeutral: z.literal(true),
  runtimeResponsibility: textSchema,
  status: z.enum(PRESENTATION_STATUSES),
  compatibility: presentationCompatibilitySchema,
  metadata: boundedMetadataSchema,
}).strict();

export const presentationContentSlotSchema = z.object({
  slotId: semanticReferenceSchema,
  type: z.enum(PRESENTATION_CONTENT_SLOT_TYPES),
  localizationKey: localizationKeySchema,
  required: z.boolean(),
  maximumLength: z.number().int().positive().max(20_000).optional(),
  speechPolicy: z.enum(["never", "optional", "required"]),
  visualPolicy: z.enum(["hidden", "optional", "required"]),
  sensitivity: z.enum(["public", "personal", "sensitive", "restricted"]),
  interpolationKeys: unique(semanticReferenceSchema).optional(),
}).strict();

export const presentationActionSchema = z.object({
  actionId: semanticReferenceSchema,
  kind: z.enum(PRESENTATION_ACTION_KINDS),
  labelLocalizationKey: localizationKeySchema,
  optionId: semanticReferenceSchema.optional(),
  confirmationRequired: z.boolean(),
  destructive: z.boolean(),
  dismissesPresentation: z.boolean(),
  accessibilityLabelKey: localizationKeySchema,
  eventMappingId: semanticReferenceSchema,
  priority: z.number().int().min(0).max(100).optional(),
}).strict();

const mappingPathSchema = z.string()
  .regex(/^(?:payload|correlation)(?:\.[a-z][a-z0-9_]{0,63}){1,4}$/)
  .max(180);
const boundedOptionIdsSchema = unique(semanticReferenceSchema, 1)
  .refine((values) => values.length <= 50, "too many option references");

const payloadMappingSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("option"),
    source: z.enum(["fixed_action_option", "payload_option", "speech_resolution"]),
    sourceField: mappingPathSchema.optional(),
    optionId: semanticReferenceSchema.optional(),
  }).strict(),
  z.object({
    kind: z.literal("free_text"),
    source: z.enum(["submitted_text", "speech_transcript"]),
    sourceField: mappingPathSchema,
  }).strict(),
  z.object({
    kind: z.literal("structured"),
    source: z.literal("submitted_structure"),
    sourceField: mappingPathSchema,
    valueSchemaId: semanticReferenceSchema,
  }).strict(),
  z.object({
    kind: z.literal("measurement"),
    source: z.literal("submitted_measurement"),
    valueField: mappingPathSchema,
    unitField: mappingPathSchema.optional(),
    measurementSchemaId: semanticReferenceSchema,
  }).strict(),
  z.object({
    kind: z.literal("image"),
    source: z.literal("event_asset_reference"),
    assetReferenceField: mappingPathSchema,
  }).strict(),
  z.object({
    kind: z.literal("document"),
    source: z.literal("event_asset_reference"),
    assetReferenceField: mappingPathSchema,
  }).strict(),
  z.object({
    kind: z.literal("tool_result"),
    source: z.literal("event_tool_result"),
    resultField: mappingPathSchema,
    expectedToolResultId: semanticReferenceSchema,
  }).strict(),
  z.object({
    kind: z.enum(["confirmation", "control"]),
    source: z.enum(["action", "event"]),
  }).strict(),
]);

const normalizedAnswerIntentSchema = z.discriminatedUnion("answerKind", [
  z.object({
    answerKind: z.literal("option"),
    optionIdSource: z.enum([
      "fixed_action_option", "payload_option", "speech_resolution",
    ]),
    optionId: semanticReferenceSchema.optional(),
    allowedOptionIds: boundedOptionIdsSchema.optional(),
  }).strict(),
  z.object({
    answerKind: z.literal("free_text"),
    valueSource: z.enum(["submitted_text", "speech_transcript"]),
  }).strict(),
  z.object({
    answerKind: z.literal("structured"),
    valueSource: z.literal("submitted_structure"),
    valueSchemaId: semanticReferenceSchema,
  }).strict(),
  z.object({
    answerKind: z.literal("measurement"),
    valueSource: z.literal("submitted_value"),
    unitSource: z.enum(["submitted_unit", "expected_unit"]),
    measurementSchemaId: semanticReferenceSchema,
  }).strict(),
  z.object({
    answerKind: z.literal("image"),
    assetReferenceSource: z.literal("event_payload"),
  }).strict(),
  z.object({
    answerKind: z.literal("document"),
    assetReferenceSource: z.literal("event_payload"),
  }).strict(),
  z.object({
    answerKind: z.literal("tool_result"),
    expectedToolResultId: semanticReferenceSchema,
  }).strict(),
]).superRefine((value, context) => {
  if (
    value.answerKind === "option" &&
    (
      value.optionIdSource === "fixed_action_option"
        ? !value.optionId || value.allowedOptionIds !== undefined
        : value.optionId !== undefined || !value.allowedOptionIds?.length
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "invalid option source declaration",
    });
  }
});

export const presentationEventMappingSchema = z.object({
  eventMappingId: semanticReferenceSchema,
  actionId: semanticReferenceSchema.optional(),
  inputModality: z.enum(INTERACTION_MODALITIES),
  interactionEventType: z.enum(INTERACTION_EVENT_TYPES),
  eventSource: z.enum(INTERACTION_EVENT_SOURCES),
  triggerSource: interactionTriggerSourceSchema,
  payloadMapping: payloadMappingSchema,
  normalizedAnswerIntent: normalizedAnswerIntentSchema.optional(),
  passiveInput: z.boolean(),
  requiresCurrentQuestionCorrelation: z.boolean(),
  requiresCurrentSceneCorrelation: z.boolean(),
  requiresCurrentFlowVersionCorrelation: z.boolean(),
}).strict();

export type PresentationEventMapping = z.infer<
  typeof presentationEventMappingSchema
>;

export function validatePresentationEventMapping(
  input: unknown,
): PresentationEventMapping {
  const parsed = presentationEventMappingSchema.safeParse(input);
  if (!parsed.success) fail("PRESENTATION_EVENT_MAPPING_INVALID");
  const mapping = parsed.data;
  const rule = EVENT_SEMANTIC_RULES[mapping.interactionEventType];
  if (
    !rule.sources.includes(mapping.eventSource) ||
    !rule.modalities.includes(mapping.inputModality) ||
    !rule.triggers.includes(mapping.triggerSource)
  ) {
    fail("PRESENTATION_EVENT_MAPPING_INVALID");
  }
  if (JSON.stringify(mapping).length > 4_096) {
    fail("PRESENTATION_EVENT_MAPPING_INVALID");
  }
  return mapping;
}

const voiceSynchronizationSchema = z.object({
  spokenContentSlotIds: unique(semanticReferenceSchema),
  speakBeforeInteraction: z.boolean(),
  interactionAvailableDuringSpeech: z.boolean(),
  bargeInAllowed: z.boolean(),
  interruptSpeechOnSubmit: z.boolean(),
  repeatPolicy: z.enum(["none", "on_request", "once", "until_answered"]),
  silenceTimeoutPolicy: z.object({
    behavior: z.enum(["none", "repeat", "offer_help", "safe_fallback", "expire"]),
    timeoutSeconds: z.number().int().positive().max(3_600).optional(),
  }).strict(),
  acknowledgementPolicy: z.enum(["none", "brief", "required"]),
  screenUpdateTiming: z.enum([
    "before_speech", "with_speech", "after_speech", "voice_only",
  ]),
  optionSpeechAliases: z.array(z.object({
    optionId: semanticReferenceSchema,
    aliases: unique(z.string().min(1).max(120), 1)
      .refine((values) => values.length <= 12, "too many aliases"),
  }).strict()).max(50),
  useCanonicalLabelsAsSpeechAliases: z.boolean(),
  pronunciationKeys: unique(localizationKeySchema),
  captionsRequired: z.boolean(),
  voiceFallbackBehavior: z.enum([
    "none", "repeat_text", "accessible_text", "request_human", "safe_fallback",
  ]),
}).strict();

const visualBehaviorSchema = z.object({
  layoutDensity: z.enum(["comfortable", "spacious", "compact"]),
  focusTarget: z.enum(["title", "question", "primary_action", "status", "none"]),
  initialScrollPosition: z.enum(["top", "focused_content", "preserve"]),
  keyboardBehavior: z.enum(["none", "supported", "required"]),
  progressVisibility: z.enum(["hidden", "optional", "required"]),
  loadingTreatment: z.enum(["none", "inline", "blocking_with_cancel"]),
  errorPlacement: z.enum(["inline", "summary", "modal"]),
  confirmationPlacement: z.enum(["inline", "separate_step", "modal"]),
  contentPriority: unique(z.enum([
    "safety", "privacy", "question", "actions", "status", "support",
  ]), 1),
  reducedMotionAlternative: z.enum(["none_needed", "static", "fade_only"]),
  largeTextBehavior: z.enum(["reflow", "stack", "voice_only"]),
  highContrastBehavior: z.enum(["system", "enhanced"]),
  colorOnlyCommunication: z.literal(false),
}).strict();

const accessibilityPolicySchema = z.object({
  screenReaderRequired: z.boolean(),
  keyboardNavigationRequired: z.boolean(),
  minimumTouchTarget: z.number().int().min(44).max(96).optional(),
  largeTextSupported: z.boolean(),
  highContrastSupported: z.boolean(),
  reducedMotionSupported: z.boolean(),
  captionsRequired: z.boolean(),
  voiceOnlyFallback: z.boolean(),
  touchOnlyFallback: z.boolean(),
  cognitiveLoad: z.enum(["low", "moderate", "high"]),
  maximumPrimaryActions: z.number().int().min(1).max(5),
  errorRecoveryInstructions: z.boolean(),
  timeoutExtensionAllowed: z.boolean(),
  repetitionAvailable: z.boolean(),
  simplifiedAlternativePresentationId: stableIdSchema.optional(),
  highCognitiveLoadJustification: localizationKeySchema.optional(),
}).strict();

const localizationPolicySchema = z.object({
  defaultLocale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
  supportedLocales: unique(z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/), 1),
  requiredLocalizationKeys: unique(localizationKeySchema, 1),
  interpolationKeys: unique(semanticReferenceSchema),
  fallbackLocale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
  localeChangeAllowed: z.boolean(),
  rightToLeftSupported: z.boolean(),
  speechLocalizationRequired: z.boolean(),
}).strict();

const privacyTreatmentSchema = z.object({
  sensitivity: z.enum(["public", "personal", "sensitive", "restricted"]),
  screenObscuringAllowed: z.boolean(),
  hideInAppSwitcher: z.boolean(),
  screenshotPolicy: z.enum(["allowed", "warn", "prohibited"]),
  recordingPolicy: z.enum(["allowed", "consent_required", "prohibited"]),
  evidencePreviewPolicy: z.enum(["none", "optional", "required"]),
  autoClearPolicy: z.enum(["none", "on_exit", "after_submission", "timed"]),
  consentNoticeRequired: z.boolean(),
  retentionNoticeRequired: z.boolean(),
  shoulderSurfingWarning: z.boolean(),
  caregiverVisibility: z.enum(["none", "consent_required", "authorized_summary"]),
  operatorVisibility: z.enum(["none", "consent_required", "authorized_case"]),
  evidencePurposeLocalizationKey: localizationKeySchema.optional(),
  retakeAvailable: z.boolean(),
  deletionAvailable: z.boolean(),
  safeAbandonmentAvailable: z.boolean(),
}).strict();

const safetyTreatmentSchema = z.object({
  safetyCritical: z.boolean(),
  urgency: z.enum(["routine", "important", "urgent", "immediate"]),
  dismissalPolicy: z.enum(["allowed", "confirm", "prohibited"]),
  deferPolicy: z.enum(["allowed", "confirm", "prohibited"]),
  acknowledgementRequired: z.boolean(),
  confirmationRequired: z.boolean(),
  humanHelpAvailable: z.boolean(),
  emergencyActionVisible: z.boolean(),
  prohibitedClaims: unique(z.enum([
    "diagnosis", "guaranteed_safe", "safe_verdict", "clinical_certainty",
    "tool_already_executed",
  ])),
  requiredDisclaimers: unique(localizationKeySchema),
  safeFallbackPresentationId: stableIdSchema.optional(),
  timeoutBehavior: z.enum([
    "none", "remain_visible", "repeat", "safe_fallback", "expire",
  ]),
  coerciveDefault: z.boolean(),
  toolExecutionState: z.enum(["none", "proposal_only"]),
}).strict();

const designReferenceSchema = z.object({
  referenceId: semanticReferenceSchema,
  type: z.enum([
    "design_spec", "figma_frame", "prototype", "storyboard",
    "accessibility_spec", "content_spec",
  ]),
  version: semverSchema.optional(),
  description: textSchema.optional(),
  status: z.enum(["draft", "approved", "deprecated"]),
}).strict();

export const presentationDefinitionSchema = z.object({
  presentationId: stableIdSchema,
  version: semverSchema,
  displayName: z.string().min(1).max(160),
  description: textSchema,
  familyId: stableIdSchema,
  sceneId: semanticReferenceSchema,
  supportedFlowIds: unique(stableIdSchema, 1),
  status: z.enum(PRESENTATION_STATUSES),
  supportedChannels: unique(z.enum(FLOW_CHANNELS), 1),
  supportedDeviceClasses: unique(z.enum(PRESENTATION_DEVICE_CLASSES), 1),
  supportedOrientations: unique(z.enum(["portrait", "landscape"])).optional(),
  supportedUIInstructionTypes: unique(uiInstructionTypeSchema),
  expectedInput: expectedFlowInputSchema.nullable(),
  contentSlots: z.array(presentationContentSlotSchema).min(1),
  actions: z.array(presentationActionSchema).max(32),
  eventMappings: z.array(presentationEventMappingSchema).max(96),
  voiceSynchronization: voiceSynchronizationSchema,
  visualBehavior: visualBehaviorSchema,
  accessibilityPolicy: accessibilityPolicySchema,
  localizationPolicy: localizationPolicySchema,
  privacyTreatment: privacyTreatmentSchema,
  safetyTreatment: safetyTreatmentSchema,
  fallbackPresentationId: stableIdSchema.optional(),
  designSystemReferences: unique(semanticReferenceSchema),
  designArtifactReferences: z.array(designReferenceSchema).optional(),
  compatibility: presentationCompatibilitySchema,
  metadata: boundedMetadataSchema,
}).strict();

export const presentationRegistrySchema = z.object({
  registryVersion: semverSchema,
  families: z.array(presentationFamilySchema).min(1),
  presentations: z.array(presentationDefinitionSchema).min(1),
  metadata: boundedMetadataSchema,
}).strict();

export type PresentationFamily = z.infer<typeof presentationFamilySchema>;
export type PresentationDefinition = z.infer<typeof presentationDefinitionSchema>;
export type PresentationRegistry = z.infer<typeof presentationRegistrySchema>;

function fail(code: OrchestrationContractErrorCode): never {
  throw new OrchestrationContractError(code);
}
function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}
function rankSensitivity(value: PresentationDefinition["privacyTreatment"]["sensitivity"]): number {
  return ["public", "personal", "sensitive", "restricted"].indexOf(value);
}
function rankUrgency(value: PresentationDefinition["safetyTreatment"]["urgency"]): number {
  return ["routine", "important", "urgent", "immediate"].indexOf(value);
}
function rankPolicy<T extends string>(value: T, order: readonly T[]): number {
  return order.indexOf(value);
}
function isSuperset<T>(candidate: T[], required: T[]): boolean {
  const values = new Set(candidate);
  return required.every((value) => values.has(value));
}
function isInteractive(definition: PresentationDefinition): boolean {
  return definition.expectedInput !== null;
}

const PRESENTATION_METADATA_DENIED_KEYS = new Set([
  "hiddenreasoning", "chainofthought", "internalreasoning", "rationaletrace",
  "modelreasoning", "diagnosis", "diagnosticdecision", "clinicaldecision",
  "prescribe", "medicationadvice", "frauddecision", "scamdecision",
  "safeverdict", "trustverdict", "riskdecision", "rawprovidererror",
  "providererror", "providerstack", "stacktrace", "rawerror", "endpoint",
  "apiendpoint", "webhook", "url", "execute", "executable", "executetool",
  "toolexecution", "writememory", "memorywrite", "notifycaregiver",
  "notifyoperator", "contactclinician", "callemergencyservices",
  "schedulefollowup", "createschedule", "emitevent", "dispatchevent",
  "startflow", "startflowid", "selectflow", "selectflowid", "switchflow",
  "switchflowid", "token", "authtoken", "bearertoken", "sessiontoken",
  "authorizationheader", "authheader", "adapter", "provideradapter",
  "runtimeadapter", "sdkadapter", "callback", "handler",
]);

function hasDeniedPresentationMetadataKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasDeniedPresentationMetadataKey);
  }
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) => {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    return (
      PRESENTATION_METADATA_DENIED_KEYS.has(normalizedKey) ||
      hasDeniedPresentationMetadataKey(nested)
    );
  });
}

function validateRawMetadata(input: unknown): void {
  if (!input || typeof input !== "object") return;
  const candidate = input as {
    metadata?: unknown;
    families?: Array<{ metadata?: unknown }>;
    presentations?: Array<{ metadata?: unknown }>;
  };
  const families = Array.isArray(candidate.families) ? candidate.families : [];
  const presentations = Array.isArray(candidate.presentations)
    ? candidate.presentations
    : [];
  const values = [
    candidate.metadata,
    ...families.map((item) => item?.metadata),
    ...presentations.map((item) => item?.metadata),
  ];
  try {
    if (values.some(
      (value) =>
        !boundedMetadataSchema.safeParse(value).success ||
        hasDeniedPresentationMetadataKey(value),
    )) {
      fail("PRESENTATION_METADATA_INVALID");
    }
  } catch {
    fail("PRESENTATION_METADATA_INVALID");
  }
}

function validateExpectedInput(
  definition: PresentationDefinition,
  family: PresentationFamily,
): void {
  const expected = definition.expectedInput;
  if (!expected) return;
  if (
    expected.sceneId !== definition.sceneId ||
    !family.supportedInputKinds.includes(expected.answerKind)
  ) {
    fail("PRESENTATION_INPUT_INCOMPATIBLE");
  }
  const flows = definition.supportedFlowIds.map(
    (flowId) => VYVA_FLOW_CATALOGUE.flows.find((flow) => flow.flowId === flowId)!,
  );
  if (flows.some(
    (flow) => (
      expected.flowVersion !== flow.version ||
      !flow.expectedInputKinds.includes(expected.answerKind)
    ),
  )) {
    fail("PRESENTATION_FLOW_INCOMPATIBLE");
  }
  if (
    expected.answerKind === "image" &&
    !definition.supportedUIInstructionTypes.includes("show_image_upload")
  ) {
    fail("PRESENTATION_INPUT_INCOMPATIBLE");
  }
  if (
    expected.answerKind === "document" &&
    !definition.supportedUIInstructionTypes.includes("show_document_upload")
  ) {
    fail("PRESENTATION_INPUT_INCOMPATIBLE");
  }
  if (
    expected.answerKind === "measurement" &&
    !definition.supportedUIInstructionTypes.includes("show_measurement_input")
  ) {
    fail("PRESENTATION_INPUT_INCOMPATIBLE");
  }
}

function validateActionsAndMappings(definition: PresentationDefinition): void {
  const actionIds = definition.actions.map((action) => action.actionId);
  const mappingIds = definition.eventMappings.map((mapping) => mapping.eventMappingId);
  const slotIds = definition.contentSlots.map((slot) => slot.slotId);
  if (
    hasDuplicates(actionIds) ||
    hasDuplicates(mappingIds) ||
    hasDuplicates(slotIds)
  ) {
    fail("PRESENTATION_ACTION_INVALID");
  }
  const mappings = new Map(
    definition.eventMappings.map((mapping) => [mapping.eventMappingId, mapping]),
  );
  const interactive = definition.expectedInput !== null;
  if (
    interactive &&
    (definition.actions.length === 0 || definition.eventMappings.length === 0)
  ) {
    fail("PRESENTATION_INTERACTION_INVALID");
  }
  for (const action of definition.actions) {
    const mapping = mappings.get(action.eventMappingId);
    if (!mapping || mapping.actionId !== action.actionId) {
      fail("PRESENTATION_ACTION_INVALID");
    }
  }
  let answerProducingMappings = 0;
  for (const mapping of definition.eventMappings) {
    validatePresentationEventMapping(mapping);
    if (
      Boolean(mapping.actionId) === mapping.passiveInput
    ) {
      fail("PRESENTATION_EVENT_MAPPING_INVALID");
    }
    if (
      mapping.actionId &&
      !definition.actions.some((action) => action.actionId === mapping.actionId)
    ) {
      fail("PRESENTATION_EVENT_MAPPING_INVALID");
    }
    if (
      interactive &&
      (
        !mapping.requiresCurrentQuestionCorrelation ||
        !mapping.requiresCurrentSceneCorrelation ||
        !mapping.requiresCurrentFlowVersionCorrelation
      )
    ) {
      fail("PRESENTATION_EVENT_MAPPING_INVALID");
    }
    const answerPayload = ANSWER_KINDS.includes(
      mapping.payloadMapping.kind as AnswerKind,
    );
    if (answerPayload !== Boolean(mapping.normalizedAnswerIntent)) {
      fail("PRESENTATION_EVENT_MAPPING_INVALID");
    }
    if (mapping.normalizedAnswerIntent) {
      const expected = definition.expectedInput;
      if (
        !expected ||
        mapping.normalizedAnswerIntent.answerKind !== expected.answerKind ||
        mapping.payloadMapping.kind !== expected.answerKind ||
        !ANSWER_KIND_MODALITY_COMPATIBILITY[expected.answerKind].includes(
          mapping.inputModality as never,
        )
      ) {
        fail("PRESENTATION_EVENT_MAPPING_INVALID");
      }
      answerProducingMappings += 1;
      validateNormalizedAnswerMapping(definition, mapping);
    }
  }
  if (interactive && answerProducingMappings === 0) {
    fail("PRESENTATION_INTERACTION_INVALID");
  }
  if (!interactive && answerProducingMappings > 0) {
    fail("PRESENTATION_INTERACTION_INVALID");
  }
  if (definition.expectedInput?.answerKind === "option") {
    const options = new Set(definition.expectedInput.options.map((option) => option.id));
    for (const action of definition.actions.filter(
      (item) => item.kind === "submit_option",
    )) {
      const mapping = mappings.get(action.eventMappingId);
      const isFixedOption =
        mapping?.normalizedAnswerIntent?.answerKind === "option" &&
        mapping.normalizedAnswerIntent.optionIdSource === "fixed_action_option";
      if (
        isFixedOption
          ? !action.optionId || !options.has(action.optionId)
          : action.optionId !== undefined
      ) {
        fail("PRESENTATION_ACTION_INVALID");
      }
    }
    const aliasRecords = definition.voiceSynchronization.optionSpeechAliases;
    if (hasDuplicates(aliasRecords.map((record) => record.optionId))) {
      fail("PRESENTATION_VOICE_SYNC_INVALID");
    }
    const aliases = new Map<string, string>();
    for (const record of aliasRecords) {
      if (!options.has(record.optionId)) fail("PRESENTATION_VOICE_SYNC_INVALID");
      const localAliases = new Set<string>();
      for (const alias of record.aliases) {
        const normalizedAlias = alias.trim().toLowerCase();
        if (
          localAliases.has(normalizedAlias) ||
          (
            aliases.has(normalizedAlias) &&
            aliases.get(normalizedAlias) !== record.optionId
          )
        ) {
          fail("PRESENTATION_VOICE_SYNC_INVALID");
        }
        localAliases.add(normalizedAlias);
        aliases.set(normalizedAlias, record.optionId);
      }
    }
    const voiceEnabled = definition.eventMappings.some(
      (mapping) =>
        mapping.inputModality === "voice" &&
        mapping.normalizedAnswerIntent?.answerKind === "option",
    );
    if (
      voiceEnabled &&
      !definition.voiceSynchronization.useCanonicalLabelsAsSpeechAliases &&
      aliasRecords.length !== options.size
    ) {
      fail("PRESENTATION_VOICE_SYNC_INVALID");
    }
  } else if (
    definition.actions.some((action) => action.optionId) ||
    definition.voiceSynchronization.optionSpeechAliases.length ||
    definition.voiceSynchronization.useCanonicalLabelsAsSpeechAliases
  ) {
    fail("PRESENTATION_INPUT_INCOMPATIBLE");
  }
}

function validateNormalizedAnswerMapping(
  definition: PresentationDefinition,
  mapping: PresentationEventMapping,
): void {
  const expected = definition.expectedInput;
  const intent = mapping.normalizedAnswerIntent;
  if (!expected || !intent) fail("PRESENTATION_EVENT_MAPPING_INVALID");
  if (intent.answerKind === "option") {
    if (expected.answerKind !== "option" || mapping.payloadMapping.kind !== "option") {
      fail("PRESENTATION_EVENT_MAPPING_INVALID");
    }
    const allowedOptions = new Set(expected.options.map((option) => option.id));
    const action = mapping.actionId
      ? definition.actions.find((item) => item.actionId === mapping.actionId)
      : undefined;
    if (
      intent.optionIdSource !== mapping.payloadMapping.source ||
      (
        intent.optionIdSource === "fixed_action_option" &&
        mapping.inputModality !== "touch"
      ) ||
      (
        intent.optionIdSource === "speech_resolution" &&
        mapping.inputModality !== "voice"
      ) ||
      (
        intent.optionIdSource === "payload_option" &&
        !["touch", "text"].includes(mapping.inputModality)
      ) ||
      (
        intent.optionIdSource === "fixed_action_option" &&
        (
          !intent.optionId ||
          !allowedOptions.has(intent.optionId) ||
          mapping.payloadMapping.optionId !== intent.optionId ||
          action?.optionId !== intent.optionId
        )
      ) ||
      (
        intent.optionIdSource !== "fixed_action_option" &&
        (
          !intent.allowedOptionIds?.every((id) => allowedOptions.has(id)) ||
          mapping.payloadMapping.optionId !== undefined ||
          !mapping.payloadMapping.sourceField
        )
      )
    ) {
      fail("PRESENTATION_EVENT_MAPPING_INVALID");
    }
    return;
  }
  if (intent.answerKind === "free_text") {
    if (
      mapping.payloadMapping.kind !== "free_text" ||
      intent.valueSource !== mapping.payloadMapping.source ||
      (
        intent.valueSource === "speech_transcript"
          ? mapping.inputModality !== "voice"
          : mapping.inputModality !== "text"
      )
    ) {
      fail("PRESENTATION_EVENT_MAPPING_INVALID");
    }
    return;
  }
  if (intent.answerKind === "structured") {
    if (
      expected.answerKind !== "structured" ||
      mapping.payloadMapping.kind !== "structured" ||
      intent.valueSchemaId !== expected.valueSchemaId ||
      intent.valueSchemaId !== mapping.payloadMapping.valueSchemaId
    ) {
      fail("PRESENTATION_EVENT_MAPPING_INVALID");
    }
    return;
  }
  if (intent.answerKind === "measurement") {
    if (
      expected.answerKind !== "measurement" ||
      mapping.payloadMapping.kind !== "measurement" ||
      intent.measurementSchemaId !== mapping.payloadMapping.measurementSchemaId ||
      (
        intent.unitSource === "submitted_unit"
          ? !mapping.payloadMapping.unitField
          : mapping.payloadMapping.unitField !== undefined
      )
    ) {
      fail("PRESENTATION_EVENT_MAPPING_INVALID");
    }
    return;
  }
  if (intent.answerKind === "image" || intent.answerKind === "document") {
    if (
      mapping.payloadMapping.kind !== intent.answerKind ||
      mapping.payloadMapping.source !== "event_asset_reference"
    ) {
      fail("PRESENTATION_EVENT_MAPPING_INVALID");
    }
    return;
  }
  if (
    expected.answerKind !== "tool_result" ||
    mapping.payloadMapping.kind !== "tool_result" ||
    intent.expectedToolResultId !== mapping.payloadMapping.expectedToolResultId
  ) {
    fail("PRESENTATION_EVENT_MAPPING_INVALID");
  }
}

function validateContentAndLocalization(
  definition: PresentationDefinition,
  family: PresentationFamily,
): void {
  const slotTypes = new Set(definition.contentSlots.map((slot) => slot.type));
  if (family.requiredContentSlots.some((type) => !slotTypes.has(type))) {
    fail("PRESENTATION_FAMILY_INVALID");
  }
  const requiredKeys = new Set(definition.localizationPolicy.requiredLocalizationKeys);
  const contentKeys = definition.contentSlots.map((slot) => slot.localizationKey);
  const actionKeys = definition.actions.flatMap(
    (action) => [action.labelLocalizationKey, action.accessibilityLabelKey],
  );
  if (
    hasDuplicates(contentKeys) ||
    [...contentKeys, ...actionKeys].some((key) => !requiredKeys.has(key)) ||
    !definition.localizationPolicy.supportedLocales.includes(
      definition.localizationPolicy.defaultLocale,
    ) ||
    !definition.localizationPolicy.supportedLocales.includes(
      definition.localizationPolicy.fallbackLocale,
    )
  ) {
    fail("PRESENTATION_LOCALIZATION_INVALID");
  }
  const allowedInterpolation = new Set(definition.localizationPolicy.interpolationKeys);
  if (definition.contentSlots.some(
    (slot) => slot.interpolationKeys?.some((key) => !allowedInterpolation.has(key)),
  )) {
    fail("PRESENTATION_LOCALIZATION_INVALID");
  }
}

function validateAccessibilityAndVoice(
  definition: PresentationDefinition,
  registry: PresentationRegistry,
): void {
  const interactive = isInteractive(definition);
  const telephoneOnly = definition.supportedDeviceClasses.every(
    (device) => device === "telephone_voice_only",
  );
  const screenPresent = definition.supportedDeviceClasses.some(
    (device) => device !== "telephone_voice_only",
  );
  const touchAction = definition.eventMappings.some(
    (mapping) => mapping.actionId && mapping.inputModality === "touch",
  );
  if (
    interactive &&
    !telephoneOnly &&
    (
      !definition.accessibilityPolicy.screenReaderRequired ||
      definition.actions.some((action) => !action.accessibilityLabelKey)
    )
  ) {
    fail("PRESENTATION_ACCESSIBILITY_INVALID");
  }
  if (
    touchAction &&
    !telephoneOnly &&
    !definition.accessibilityPolicy.minimumTouchTarget
  ) {
    fail("PRESENTATION_ACCESSIBILITY_INVALID");
  }
  if (
    screenPresent &&
    definition.voiceSynchronization.spokenContentSlotIds.length > 0 &&
    (
      !definition.voiceSynchronization.captionsRequired ||
      !definition.accessibilityPolicy.captionsRequired
    )
  ) {
    fail("PRESENTATION_ACCESSIBILITY_INVALID");
  }
  if (
    definition.accessibilityPolicy.cognitiveLoad === "high" &&
    !definition.accessibilityPolicy.simplifiedAlternativePresentationId &&
    !definition.accessibilityPolicy.highCognitiveLoadJustification
  ) {
    fail("PRESENTATION_ACCESSIBILITY_INVALID");
  }
  if (
    definition.accessibilityPolicy.maximumPrimaryActions <
    definition.actions.filter((action) => (action.priority ?? 100) <= 20).length
  ) {
    fail("PRESENTATION_ACCESSIBILITY_INVALID");
  }
  if (
    definition.voiceSynchronization.spokenContentSlotIds.some(
      (slotId) => !definition.contentSlots.some((slot) => slot.slotId === slotId),
    )
  ) {
    fail("PRESENTATION_VOICE_SYNC_INVALID");
  }
  if (
    telephoneOnly &&
    (
      definition.supportedChannels.some((channel) => channel !== "telephone") ||
      definition.supportedUIInstructionTypes.length > 0 ||
      definition.contentSlots.some((slot) => slot.visualPolicy === "required") ||
      definition.eventMappings.some(
        (mapping) => mapping.inputModality !== "voice",
      ) ||
      definition.actions.some((action) => [
        "capture_image", "upload_image", "retake_image", "capture_document",
        "upload_document", "submit_measurement", "submit_text",
      ].includes(action.kind)) ||
      definition.voiceSynchronization.spokenContentSlotIds.length === 0 ||
      definition.voiceSynchronization.screenUpdateTiming !== "voice_only" ||
      definition.voiceSynchronization.repeatPolicy === "none" ||
      !["repeat_text", "request_human", "safe_fallback"].includes(
        definition.voiceSynchronization.voiceFallbackBehavior,
      ) ||
      definition.voiceSynchronization.captionsRequired ||
      definition.accessibilityPolicy.captionsRequired ||
      !definition.accessibilityPolicy.repetitionAvailable
    )
  ) {
    fail("PRESENTATION_DEVICE_INCOMPATIBLE");
  }
  if (
    definition.supportedChannels.includes("telephone") &&
    !telephoneOnly &&
    !definition.eventMappings.some((mapping) =>
      mapping.inputModality === "voice" &&
      mapping.normalizedAnswerIntent !== undefined) &&
    ![
      definition.fallbackPresentationId,
      definition.safetyTreatment.safeFallbackPresentationId,
    ].some((fallbackId) => {
      const fallback = registry.presentations.find(
        (item) =>
          item.presentationId === fallbackId &&
          item.compatibility.isCurrent,
      );
      return Boolean(
        fallback?.supportedChannels.includes("telephone") &&
        fallback.eventMappings.some(
          (mapping) =>
            mapping.inputModality === "voice" &&
            mapping.normalizedAnswerIntent !== undefined,
        ),
      );
    })
  ) {
    fail("PRESENTATION_DEVICE_INCOMPATIBLE");
  }
}

function validatePrivacyAndSafety(definition: PresentationDefinition): void {
  const isImage = definition.expectedInput?.answerKind === "image";
  const isDocument = definition.expectedInput?.answerKind === "document";
  const isEvidence = isImage || isDocument;
  if (
    isEvidence &&
    (
      !definition.privacyTreatment.evidencePurposeLocalizationKey ||
      !definition.privacyTreatment.consentNoticeRequired ||
      !definition.privacyTreatment.safeAbandonmentAvailable ||
      definition.privacyTreatment.evidencePreviewPolicy === "none"
    )
  ) {
    fail("PRESENTATION_PRIVACY_INVALID");
  }
  if (
    isImage &&
    (
      !definition.privacyTreatment.retakeAvailable ||
      !definition.privacyTreatment.deletionAvailable
    )
  ) {
    fail("PRESENTATION_PRIVACY_INVALID");
  }
  if (
    isEvidence &&
    definition.privacyTreatment.autoClearPolicy !== "after_submission" &&
    !definition.privacyTreatment.retentionNoticeRequired
  ) {
    fail("PRESENTATION_PRIVACY_INVALID");
  }
  const isVisualHealth = definition.supportedFlowIds.some(
    (flowId) => flowId.startsWith("health.visual."),
  );
  if (
    isVisualHealth &&
    !definition.safetyTreatment.prohibitedClaims.includes("diagnosis")
  ) {
    fail("PRESENTATION_SAFETY_INVALID");
  }
  const isTrust = definition.supportedFlowIds.some(
    (flowId) => flowId.startsWith("trust."),
  );
  if (
    isTrust &&
    (
      rankSensitivity(definition.privacyTreatment.sensitivity) <
        rankSensitivity("sensitive") ||
      !definition.safetyTreatment.prohibitedClaims.includes("guaranteed_safe") ||
      !definition.safetyTreatment.prohibitedClaims.includes("safe_verdict")
    )
  ) {
    fail("PRESENTATION_SAFETY_INVALID");
  }
  if (
    definition.safetyTreatment.safetyCritical &&
    (
      definition.safetyTreatment.dismissalPolicy !== "prohibited" ||
      !definition.safetyTreatment.humanHelpAvailable ||
      !definition.safetyTreatment.emergencyActionVisible ||
      !definition.accessibilityPolicy.repetitionAvailable ||
      !definition.accessibilityPolicy.errorRecoveryInstructions
    )
  ) {
    fail("PRESENTATION_SAFETY_INVALID");
  }
  if (
    definition.familyId === "presentation.family.consent" &&
    (
      definition.safetyTreatment.coerciveDefault ||
      !definition.accessibilityPolicy.repetitionAvailable ||
      !definition.accessibilityPolicy.errorRecoveryInstructions ||
      definition.actions.some(
        (action) => action.kind === "confirm" && !action.confirmationRequired,
      )
    )
  ) {
    fail("PRESENTATION_SAFETY_INVALID");
  }
  if (
    definition.familyId === "presentation.family.tool_confirmation" &&
    (
      definition.safetyTreatment.toolExecutionState !== "proposal_only" ||
      !definition.safetyTreatment.prohibitedClaims.includes("tool_already_executed")
    )
  ) {
    fail("PRESENTATION_SAFETY_INVALID");
  }
}

function validateFallbacks(registry: PresentationRegistry): void {
  const current = new Map(
    registry.presentations
      .filter((item) => item.compatibility.isCurrent)
      .map((item) => [item.presentationId, item]),
  );
  const fallbackIds = (presentation: PresentationDefinition): string[] => [
    presentation.fallbackPresentationId,
    presentation.safetyTreatment.safeFallbackPresentationId,
  ].filter(
    (value, index, values): value is string =>
      Boolean(value) && values.indexOf(value) === index,
  );
  const visit = (
    presentation: PresentationDefinition,
    activePath: Set<string>,
  ): void => {
    if (activePath.has(presentation.presentationId)) {
      fail("PRESENTATION_REFERENCE_CYCLE");
    }
    const nextPath = new Set(activePath).add(presentation.presentationId);
    for (const fallbackId of fallbackIds(presentation)) {
      const fallback = current.get(fallbackId);
      if (fallback) visit(fallback, nextPath);
    }
  };
  for (const presentation of registry.presentations) {
    visit(presentation, new Set());
  }
  for (const presentation of registry.presentations) {
    for (const fallbackId of fallbackIds(presentation)) {
      const fallback = current.get(fallbackId);
      if (!fallback) fail("PRESENTATION_FALLBACK_INVALID");
      const sharedFlowIds = presentation.supportedFlowIds.filter((flowId) =>
        fallback.supportedFlowIds.includes(flowId));
      const fallbackSceneIsShared = sharedFlowIds.some((flowId) =>
        VYVA_FLOW_CATALOGUE.flows.find(
          (flow) => flow.flowId === flowId,
        )?.uiScenes.some((scene) => scene.sceneId === fallback.sceneId));
      if (
        sharedFlowIds.length === 0 ||
        !fallbackSceneIsShared ||
        (
          fallback.expectedInput !== null &&
          (
            presentation.expectedInput === null ||
            fallback.expectedInput.answerKind !==
              presentation.expectedInput.answerKind
          )
        ) ||
        !presentation.supportedChannels.some((channel) =>
          fallback.supportedChannels.includes(channel)) &&
        !presentation.supportedDeviceClasses.some((device) =>
          fallback.supportedDeviceClasses.includes(device))
      ) {
        fail("PRESENTATION_FALLBACK_INVALID");
      }
      validatePrivacyFallback(presentation, fallback);
      validateSafetyFallback(presentation, fallback);
    }
  }

}

function validatePrivacyFallback(
  source: PresentationDefinition,
  fallback: PresentationDefinition,
): void {
  const sourcePolicy = source.privacyTreatment;
  const fallbackPolicy = fallback.privacyTreatment;
  const requiredTrue = [
    "hideInAppSwitcher", "screenObscuringAllowed", "consentNoticeRequired",
    "retentionNoticeRequired", "shoulderSurfingWarning",
  ] as const;
  if (
    rankSensitivity(fallbackPolicy.sensitivity) <
      rankSensitivity(sourcePolicy.sensitivity) ||
    requiredTrue.some((key) => sourcePolicy[key] && !fallbackPolicy[key]) ||
    rankPolicy(fallbackPolicy.screenshotPolicy, [
      "allowed", "warn", "prohibited",
    ]) < rankPolicy(sourcePolicy.screenshotPolicy, [
      "allowed", "warn", "prohibited",
    ]) ||
    rankPolicy(fallbackPolicy.recordingPolicy, [
      "allowed", "consent_required", "prohibited",
    ]) < rankPolicy(sourcePolicy.recordingPolicy, [
      "allowed", "consent_required", "prohibited",
    ]) ||
    rankPolicy(fallbackPolicy.evidencePreviewPolicy, [
      "none", "optional", "required",
    ]) < rankPolicy(sourcePolicy.evidencePreviewPolicy, [
      "none", "optional", "required",
    ]) ||
    rankPolicy(fallbackPolicy.autoClearPolicy, [
      "none", "timed", "on_exit", "after_submission",
    ]) < rankPolicy(sourcePolicy.autoClearPolicy, [
      "none", "timed", "on_exit", "after_submission",
    ]) ||
    rankPolicy(fallbackPolicy.caregiverVisibility, [
      "authorized_summary", "consent_required", "none",
    ]) < rankPolicy(sourcePolicy.caregiverVisibility, [
      "authorized_summary", "consent_required", "none",
    ]) ||
    rankPolicy(fallbackPolicy.operatorVisibility, [
      "authorized_case", "consent_required", "none",
    ]) < rankPolicy(sourcePolicy.operatorVisibility, [
      "authorized_case", "consent_required", "none",
    ])
  ) {
    fail("PRESENTATION_PRIVACY_INVALID");
  }
}

function validateSafetyFallback(
  source: PresentationDefinition,
  fallback: PresentationDefinition,
): void {
  const sourcePolicy = source.safetyTreatment;
  const fallbackPolicy = fallback.safetyTreatment;
  const requiredTrue = [
    "acknowledgementRequired", "confirmationRequired", "humanHelpAvailable",
    "emergencyActionVisible",
  ] as const;
  if (
    (sourcePolicy.safetyCritical && !fallbackPolicy.safetyCritical) ||
    rankUrgency(fallbackPolicy.urgency) < rankUrgency(sourcePolicy.urgency) ||
    rankPolicy(fallbackPolicy.dismissalPolicy, [
      "allowed", "confirm", "prohibited",
    ]) < rankPolicy(sourcePolicy.dismissalPolicy, [
      "allowed", "confirm", "prohibited",
    ]) ||
    rankPolicy(fallbackPolicy.deferPolicy, [
      "allowed", "confirm", "prohibited",
    ]) < rankPolicy(sourcePolicy.deferPolicy, [
      "allowed", "confirm", "prohibited",
    ]) ||
    requiredTrue.some((key) => sourcePolicy[key] && !fallbackPolicy[key]) ||
    !isSuperset(fallbackPolicy.prohibitedClaims, sourcePolicy.prohibitedClaims) ||
    !isSuperset(
      fallbackPolicy.requiredDisclaimers,
      sourcePolicy.requiredDisclaimers,
    ) ||
    rankPolicy(fallbackPolicy.timeoutBehavior, [
      "expire", "none", "safe_fallback", "repeat", "remain_visible",
    ]) < rankPolicy(sourcePolicy.timeoutBehavior, [
      "expire", "none", "safe_fallback", "repeat", "remain_visible",
    ])
  ) {
    fail("PRESENTATION_SAFETY_INVALID");
  }
}

function validateRegistry(registry: PresentationRegistry): void {
  const familyPairs = registry.families.map(
    (item) => `${item.familyId}@${item.version}`,
  );
  const presentationPairs = registry.presentations.map(
    (item) => `${item.presentationId}@${item.version}`,
  );
  if (hasDuplicates(familyPairs)) fail("PRESENTATION_ID_DUPLICATE");
  if (hasDuplicates(presentationPairs)) fail("PRESENTATION_ID_DUPLICATE");
  if (hasDuplicates(
    registry.families
      .filter((item) => item.compatibility.isCurrent)
      .map((item) => item.familyId),
  ) || hasDuplicates(
    registry.presentations
      .filter((item) => item.compatibility.isCurrent)
      .map((item) => item.presentationId),
  )) {
    fail("PRESENTATION_ID_DUPLICATE");
  }
  const families = new Map(
    registry.families
      .filter((item) => item.compatibility.isCurrent)
      .map((item) => [item.familyId, item]),
  );
  if (
    REQUIRED_PRESENTATION_FAMILY_IDS.some((familyId) =>
      !registry.families.some((family) => family.familyId === familyId)
    )
  ) {
    fail("PRESENTATION_FAMILY_INVALID");
  }
  const coveredUIInstructions = new Set(
    registry.families.flatMap((family) => family.supportedUIInstructionTypes),
  );
  if (
    REQUIRED_TASK2_UI_INSTRUCTION_TYPES.some(
      (instruction) => !coveredUIInstructions.has(instruction),
    )
  ) {
    fail("PRESENTATION_FAMILY_INVALID");
  }
  const flowMap = new Map(
    VYVA_FLOW_CATALOGUE.flows.map((flow) => [flow.flowId, flow]),
  );
  const familyVersionPairs = new Set(familyPairs);
  const presentationVersionPairs = new Set(presentationPairs);
  for (const family of registry.families) {
    if (
      ["deprecated", "retired"].includes(family.status) &&
      family.compatibility.isCurrent
    ) {
      fail("PRESENTATION_FAMILY_INVALID");
    }
    if (family.status === "deprecated" && !family.compatibility.replacementId) {
      fail("PRESENTATION_FAMILY_INVALID");
    }
    if (
      family.compatibility.replacementId &&
      !familyVersionPairs.has(
        `${family.compatibility.replacementId}@${family.compatibility.replacementVersion}`,
      )
    ) {
      fail("PRESENTATION_REFERENCE_INVALID");
    }
  }
  for (const definition of registry.presentations) {
    const family = families.get(definition.familyId);
    if (!family) fail("PRESENTATION_REFERENCE_INVALID");
    if (
      ["deprecated", "retired"].includes(definition.status) &&
      definition.compatibility.isCurrent
    ) {
      fail("PRESENTATION_REGISTRY_INVALID");
    }
    if (
      definition.status === "deprecated" &&
      !definition.compatibility.replacementId
    ) {
      fail("PRESENTATION_REGISTRY_INVALID");
    }
    if (
      definition.compatibility.replacementId &&
      !presentationVersionPairs.has(
        `${definition.compatibility.replacementId}@${definition.compatibility.replacementVersion}`,
      )
    ) {
      fail("PRESENTATION_REFERENCE_INVALID");
    }
    const flows = definition.supportedFlowIds.map((flowId) => flowMap.get(flowId));
    if (flows.some((flow) => !flow)) fail("PRESENTATION_REFERENCE_INVALID");
    if (!flows.some(
      (flow) => flow!.uiScenes.some((scene) => scene.sceneId === definition.sceneId),
    )) {
      fail("PRESENTATION_SCENE_INVALID");
    }
    if (flows.some(
      (flow) => definition.supportedChannels.some(
        (channel) => !flow!.supportedChannels.includes(channel),
      ),
    )) {
      fail("PRESENTATION_CHANNEL_INCOMPATIBLE");
    }
    if (
      definition.supportedChannels.some(
        (channel) => !family.supportedChannels.includes(channel),
      ) ||
      definition.supportedDeviceClasses.some(
        (device) => !family.supportedDeviceClasses.includes(device),
      ) ||
      definition.supportedUIInstructionTypes.some(
        (type) => !family.supportedUIInstructionTypes.includes(type),
      ) ||
      definition.actions.some(
        (action) => !family.supportedActionKinds.includes(action.kind),
      )
    ) {
      fail("PRESENTATION_FAMILY_INVALID");
    }
    const needsImage = definition.expectedInput?.answerKind === "image";
    const needsDocument = definition.expectedInput?.answerKind === "document";
    if (
      needsImage &&
      flows.some((flow) => !flow!.capabilityIds.some(
        (id) => id === "capability.multimodal.image_capture" ||
          id === "capability.multimodal.screenshot_capture",
      ))
    ) {
      fail("PRESENTATION_FLOW_INCOMPATIBLE");
    }
    if (
      needsDocument &&
      flows.some((flow) => !flow!.capabilityIds.includes(
        "capability.multimodal.document_capture",
      ))
    ) {
      fail("PRESENTATION_FLOW_INCOMPATIBLE");
    }
    const cameraCapable = definition.supportedDeviceClasses.some(
      (device) => ["mobile", "tablet", "kiosk", "smart_display"].includes(device),
    );
    if (needsImage && !cameraCapable && !definition.fallbackPresentationId) {
      fail("PRESENTATION_DEVICE_INCOMPATIBLE");
    }
    if (
      definition.accessibilityPolicy.simplifiedAlternativePresentationId &&
      !registry.presentations.some(
        (item) =>
          item.presentationId ===
          definition.accessibilityPolicy.simplifiedAlternativePresentationId,
      )
    ) {
      fail("PRESENTATION_REFERENCE_INVALID");
    }
    validateAccessibilityAndVoice(definition, registry);
    validateExpectedInput(definition, family);
    validateActionsAndMappings(definition);
    validateContentAndLocalization(definition, family);
    validatePrivacyAndSafety(definition);
  }
  validateFallbacks(registry);
}

export function parsePresentationRegistry(input: unknown): PresentationRegistry {
  validateRawMetadata(input);
  const parsed = presentationRegistrySchema.safeParse(input);
  if (!parsed.success) {
    const candidate = input as {
      registryVersion?: unknown;
      families?: Array<{ version?: unknown }>;
      presentations?: Array<{ version?: unknown }>;
    };
    const versions = [
      candidate?.registryVersion,
      ...(Array.isArray(candidate?.families)
        ? candidate.families.map((item) => item?.version)
        : []),
      ...(Array.isArray(candidate?.presentations)
        ? candidate.presentations.map((item) => item?.version)
        : []),
    ];
    if (versions.some(
      (value) => typeof value === "string" && !semverSchema.safeParse(value).success,
    )) {
      fail("PRESENTATION_VERSION_INVALID");
    }
    fail("PRESENTATION_REGISTRY_INVALID");
  }
  validateRegistry(parsed.data);
  return parsed.data;
}

const compatibility = {
  isCurrent: true,
  minimumCompatibleVersion: "1.0.0",
  migrationPolicy: "none",
  breakingChange: false,
  deprecatedVersions: [],
} as const;

type FamilySeed = {
  id: string;
  category: PresentationFamily["category"];
  inputs?: AnswerKind[];
  ui?: UIInstructionType[];
  actions?: PresentationFamily["supportedActionKinds"];
  required?: PresentationFamily["requiredContentSlots"];
};
const FAMILY_SEEDS: FamilySeed[] = [
  { id: "presentation.family.introduction", category: "introduction", ui: ["show_text_prompt"], actions: ["continue"], required: ["title", "instruction"] },
  { id: "presentation.family.choice.yes_no", category: "choice", inputs: ["option"], ui: ["show_choice_question"], actions: ["submit_option"], required: ["question"] },
  { id: "presentation.family.choice.single", category: "choice", inputs: ["option"], ui: ["show_choice_question"], actions: ["submit_option"], required: ["question"] },
  { id: "presentation.family.choice.multiple", category: "choice", inputs: ["structured"], ui: ["show_choice_question"], actions: ["submit_option"], required: ["question"] },
  { id: "presentation.family.input.scale", category: "input", inputs: ["option", "measurement"], ui: ["show_scale"], actions: ["submit_option", "submit_measurement"], required: ["question"] },
  { id: "presentation.family.input.free_text", category: "input", inputs: ["free_text"], ui: ["show_text_prompt"], actions: ["submit_text"], required: ["question"] },
  { id: "presentation.family.input.measurement", category: "input", inputs: ["measurement"], ui: ["show_measurement_input"], actions: ["submit_measurement"], required: ["question"] },
  { id: "presentation.family.confirmation", category: "confirmation", inputs: ["option"], ui: ["show_confirmation"], actions: ["confirm", "cancel", "defer", "submit_option"], required: ["question"] },
  { id: "presentation.family.progress", category: "progress", ui: ["show_progress"], required: ["progress_label"] },
  { id: "presentation.family.summary", category: "summary", ui: ["show_summary"], actions: ["continue"], required: ["summary"] },
  { id: "presentation.family.consent", category: "consent", inputs: ["option"], ui: ["show_confirmation"], actions: ["confirm", "cancel", "submit_option"], required: ["privacy_notice", "question"] },
  { id: "presentation.family.capture.image", category: "capture", inputs: ["image"], ui: ["show_image_upload"], actions: ["capture_image", "upload_image", "cancel"], required: ["instruction", "privacy_notice"] },
  { id: "presentation.family.capture.image_retake", category: "capture", inputs: ["image"], ui: ["show_image_upload"], actions: ["retake_image", "upload_image", "cancel"], required: ["instruction", "error_message"] },
  { id: "presentation.family.capture.document", category: "capture", inputs: ["document"], ui: ["show_document_upload"], actions: ["capture_document", "upload_document", "cancel"], required: ["instruction", "privacy_notice"] },
  { id: "presentation.family.capture.screenshot", category: "capture", inputs: ["image"], ui: ["show_image_upload"], actions: ["upload_image", "cancel"], required: ["instruction", "privacy_notice"] },
  { id: "presentation.family.tool_confirmation", category: "tool", inputs: ["option"], ui: ["show_confirmation"], actions: ["confirm", "cancel", "submit_option"], required: ["explanation", "question"] },
  { id: "presentation.family.waiting_for_tool", category: "tool", ui: ["show_progress"], actions: ["cancel", "request_help"], required: ["status_message"] },
  { id: "presentation.family.followup_choice", category: "followup", inputs: ["option"], ui: ["show_choice_question"], actions: ["submit_option", "defer", "cancel"], required: ["question"] },
  { id: "presentation.family.interruption", category: "interruption", inputs: ["option"], ui: ["show_confirmation", "clear_scene"], actions: ["continue", "defer", "cancel", "submit_option"], required: ["status_message", "question"] },
  { id: "presentation.family.resume", category: "resume", inputs: ["option", "free_text"], ui: ["show_choice_question", "show_text_prompt"], actions: ["submit_option", "submit_text", "defer", "cancel"], required: ["status_message"] },
  { id: "presentation.family.safety.warning", category: "safety", inputs: ["option"], ui: ["show_summary", "show_choice_question"], actions: ["submit_option", "request_help", "request_human"], required: ["safety_notice"] },
  { id: "presentation.family.safety.escalation", category: "safety", inputs: ["option"], ui: ["show_confirmation", "show_progress"], actions: ["confirm", "request_help", "request_human", "submit_option"], required: ["safety_notice", "question"] },
  { id: "presentation.family.error.safe_fallback", category: "error", inputs: ["option"], ui: ["show_summary", "show_choice_question"], actions: ["retry", "request_help", "request_human", "cancel", "submit_option"], required: ["error_message"] },
  { id: "presentation.family.expired_or_stale", category: "stale", inputs: ["option"], ui: ["show_summary", "show_choice_question", "clear_scene"], actions: ["retry", "cancel", "continue", "submit_option"], required: ["status_message"] },
];

export const REQUIRED_PRESENTATION_FAMILY_IDS = [
  "presentation.family.introduction",
  "presentation.family.choice.yes_no",
  "presentation.family.choice.single",
  "presentation.family.choice.multiple",
  "presentation.family.input.scale",
  "presentation.family.input.free_text",
  "presentation.family.input.measurement",
  "presentation.family.confirmation",
  "presentation.family.progress",
  "presentation.family.summary",
  "presentation.family.consent",
  "presentation.family.capture.image",
  "presentation.family.capture.image_retake",
  "presentation.family.capture.document",
  "presentation.family.capture.screenshot",
  "presentation.family.tool_confirmation",
  "presentation.family.waiting_for_tool",
  "presentation.family.followup_choice",
  "presentation.family.interruption",
  "presentation.family.resume",
  "presentation.family.safety.warning",
  "presentation.family.safety.escalation",
  "presentation.family.error.safe_fallback",
  "presentation.family.expired_or_stale",
] as const;
export const CANONICAL_PRESENTATION_FAMILIES: PresentationFamily[] =
  FAMILY_SEEDS.map((seed) => ({
    familyId: seed.id,
    version: "1.0.0",
    displayName: seed.id.split(".").at(-1)!.replaceAll("_", " "),
    description: `Provider-neutral reusable presentation pattern for ${seed.id}.`,
    category: seed.category,
    supportedInputKinds: seed.inputs ?? [],
    supportedUIInstructionTypes: seed.ui ?? [],
    supportedChannels: [...FLOW_CHANNELS],
    supportedDeviceClasses: [...PRESENTATION_DEVICE_CLASSES],
    requiredContentSlots: seed.required ?? ["title"],
    optionalContentSlots: [...PRESENTATION_CONTENT_SLOT_TYPES],
    supportedActionKinds: seed.actions ?? [],
    accessibilityCapabilities: [
      "screen_reader", "keyboard_navigation", "large_text", "high_contrast",
      "reduced_motion", "captions", "voice_fallback", "touch_fallback",
      "repetition", "timeout_extension",
    ],
    privacyCapabilities: [
      "screen_obscuring", "app_switcher_hiding", "screenshot_restriction",
      "recording_restriction", "evidence_preview", "auto_clear",
      "consent_notice", "retention_notice", "safe_abandonment",
    ],
    safetyCapabilities: [
      "non_dismissible", "acknowledgement", "human_help", "emergency_action",
      "safe_fallback", "prohibited_claims", "disclaimer", "proposal_boundary",
    ],
    providerNeutral: true,
    runtimeResponsibility:
      "A future authorized Channel Adapter renders an Orchestrator-approved presentation.",
    status: "approved",
    compatibility: { ...compatibility },
    metadata: {},
  }));

type PresentationSeed = {
  id: string;
  familyId: string;
  flowId: string;
  sceneId: string;
  input?: AnswerKind;
  options?: string[];
  ui?: UIInstructionType[];
  channels?: PresentationDefinition["supportedChannels"];
  devices?: PresentationDefinition["supportedDeviceClasses"];
  fallback?: string;
  safetyCritical?: boolean;
  trust?: boolean;
  visualHealth?: boolean;
  privacyEvidence?: boolean;
  experience: string;
  moment: string;
};

const SEEDS: PresentationSeed[] = [
  { id: "presentation.health.preventive.introduction", familyId: "presentation.family.introduction", flowId: "health.preventive_check", sceneId: "health.preventive_check.main", ui: ["show_text_prompt"], experience: "preventive_health", moment: "introduction" },
  { id: "presentation.health.preventive.yes_no", familyId: "presentation.family.choice.yes_no", flowId: "health.preventive_check", sceneId: "health.preventive_check.main", input: "option", options: ["yes", "no"], ui: ["show_choice_question"], experience: "preventive_health", moment: "yes_no" },
  { id: "presentation.health.preventive.choice", familyId: "presentation.family.choice.single", flowId: "health.preventive_check", sceneId: "health.preventive_check.main", input: "option", options: ["today", "yesterday", "not_sure"], ui: ["show_choice_question"], experience: "preventive_health", moment: "multi_option" },
  { id: "presentation.health.preventive.scale", familyId: "presentation.family.input.scale", flowId: "health.preventive_check", sceneId: "health.preventive_check.main", input: "option", options: ["one", "two", "three", "four", "five"], ui: ["show_scale"], experience: "preventive_health", moment: "scale" },
  { id: "presentation.health.preventive.clarification", familyId: "presentation.family.input.free_text", flowId: "health.preventive_check", sceneId: "health.preventive_check.main", input: "free_text", ui: ["show_text_prompt"], experience: "preventive_health", moment: "clarification" },
  { id: "presentation.health.preventive.progress", familyId: "presentation.family.progress", flowId: "health.preventive_check", sceneId: "health.preventive_check.main", ui: ["show_progress"], experience: "preventive_health", moment: "progress" },
  { id: "presentation.health.preventive.interruption", familyId: "presentation.family.interruption", flowId: "health.preventive_check", sceneId: "health.preventive_check.main", input: "option", options: ["resume", "defer", "cancel_attempt"], ui: ["show_confirmation"], experience: "preventive_health", moment: "interruption" },
  { id: "presentation.health.preventive.resume", familyId: "presentation.family.resume", flowId: "health.preventive_check", sceneId: "health.preventive_check.main", input: "option", options: ["resume", "restart", "cancel_attempt"], ui: ["show_choice_question"], experience: "preventive_health", moment: "resume" },
  { id: "presentation.health.preventive.restored_progress", familyId: "presentation.family.progress", flowId: "health.preventive_check", sceneId: "health.preventive_check.main", ui: ["show_progress"], experience: "preventive_health", moment: "restored_progress" },
  { id: "presentation.health.preventive.transition_cleanup", familyId: "presentation.family.interruption", flowId: "health.preventive_check", sceneId: "health.preventive_check.main", ui: ["clear_scene"], experience: "preventive_health", moment: "transition_cleanup" },
  { id: "presentation.health.preventive.summary", familyId: "presentation.family.summary", flowId: "health.preventive_check", sceneId: "health.preventive_check.main", ui: ["show_summary"], experience: "preventive_health", moment: "summary" },
  { id: "presentation.health.preventive.followup", familyId: "presentation.family.followup_choice", flowId: "health.preventive_check", sceneId: "health.preventive_check.main", input: "option", options: ["continue_later", "finish_now"], ui: ["show_choice_question"], experience: "preventive_health", moment: "followup" },
  { id: "presentation.health.preventive.telephone_fallback", familyId: "presentation.family.choice.yes_no", flowId: "health.preventive_check", sceneId: "health.preventive_check.main", input: "option", options: ["yes", "no"], channels: ["telephone"], devices: ["telephone_voice_only"], ui: [], experience: "preventive_health", moment: "voice_only_fallback" },

  { id: "presentation.medication.reminder", familyId: "presentation.family.introduction", flowId: "medication.reminder", sceneId: "medication.reminder.main", ui: ["show_text_prompt"], experience: "medication", moment: "reminder" },
  { id: "presentation.medication.confirmation", familyId: "presentation.family.confirmation", flowId: "medication.dose_confirmation", sceneId: "medication.dose_confirmation.main", input: "option", options: ["confirm", "not_taken"], ui: ["show_confirmation"], experience: "medication", moment: "confirmation" },
  { id: "presentation.medication.defer", familyId: "presentation.family.followup_choice", flowId: "medication.dose_deferred", sceneId: "medication.dose_deferred.main", input: "option", options: ["defer", "cancel_attempt"], ui: ["show_choice_question"], experience: "medication", moment: "defer" },
  { id: "presentation.medication.missed_dose", familyId: "presentation.family.safety.warning", flowId: "medication.missed_dose", sceneId: "medication.missed_dose.main", input: "option", options: ["request_help", "acknowledge"], ui: ["show_choice_question"], experience: "medication", moment: "missed_dose" },
  { id: "presentation.medication.human_help_confirmation", familyId: "presentation.family.tool_confirmation", flowId: "medication.reminder", sceneId: "medication.reminder.main", input: "option", options: ["confirm", "cancel"], ui: ["show_confirmation"], experience: "medication", moment: "human_help_confirmation" },
  { id: "presentation.medication.followup", familyId: "presentation.family.followup_choice", flowId: "medication.reminder", sceneId: "medication.reminder.main", input: "option", options: ["follow_up", "dismiss"], ui: ["show_choice_question"], experience: "medication", moment: "followup" },

  { id: "presentation.health.wound.introduction", familyId: "presentation.family.introduction", flowId: "health.visual.wound_assessment", sceneId: "health.visual.wound_assessment.capture", ui: ["show_text_prompt"], visualHealth: true, experience: "wound", moment: "introduction_limitation" },
  { id: "presentation.health.wound.consent", familyId: "presentation.family.consent", flowId: "health.visual.wound_assessment", sceneId: "health.visual.wound_assessment.capture", input: "option", options: ["consent", "decline"], ui: ["show_confirmation"], visualHealth: true, experience: "wound", moment: "consent" },
  { id: "presentation.health.wound.capture", familyId: "presentation.family.capture.image", flowId: "health.visual.wound_assessment", sceneId: "health.visual.wound_assessment.capture", input: "image", ui: ["show_image_upload"], fallback: "presentation.health.wound.upload", visualHealth: true, privacyEvidence: true, experience: "wound", moment: "capture" },
  { id: "presentation.health.wound.upload", familyId: "presentation.family.capture.image", flowId: "health.visual.wound_assessment", sceneId: "health.visual.wound_assessment.capture", input: "image", ui: ["show_image_upload"], devices: ["mobile", "tablet", "desktop"], visualHealth: true, privacyEvidence: true, experience: "wound", moment: "upload_fallback" },
  { id: "presentation.health.wound.quality_failure", familyId: "presentation.family.capture.image_retake", flowId: "health.visual.wound_assessment", sceneId: "health.visual.wound_assessment.capture", input: "image", ui: ["show_image_upload"], fallback: "presentation.health.wound.upload", visualHealth: true, privacyEvidence: true, experience: "wound", moment: "quality_failure" },
  { id: "presentation.health.wound.retake", familyId: "presentation.family.capture.image_retake", flowId: "health.visual.wound_assessment", sceneId: "health.visual.wound_assessment.capture", input: "image", ui: ["show_image_upload"], fallback: "presentation.health.wound.upload", visualHealth: true, privacyEvidence: true, experience: "wound", moment: "retake" },
  { id: "presentation.health.wound.context_questions", familyId: "presentation.family.choice.single", flowId: "health.visual.wound_assessment", sceneId: "health.visual.wound_assessment.context_questions", input: "option", options: ["improving", "same", "worse"], ui: ["show_choice_question"], visualHealth: true, experience: "wound", moment: "context_questions" },
  { id: "presentation.health.wound.safety_warning", familyId: "presentation.family.safety.warning", flowId: "health.visual.wound_assessment", sceneId: "health.visual.wound_assessment.context_questions", input: "option", options: ["request_help", "acknowledge"], ui: ["show_choice_question"], visualHealth: true, experience: "wound", moment: "safety_warning" },
  { id: "presentation.health.wound.summary", familyId: "presentation.family.summary", flowId: "health.visual.wound_assessment", sceneId: "health.visual.wound_assessment.context_questions", ui: ["show_summary"], visualHealth: true, experience: "wound", moment: "summary" },

  { id: "presentation.trust.scam.introduction", familyId: "presentation.family.introduction", flowId: "trust.scam_assessment", sceneId: "trust.scam.evidence_capture", ui: ["show_text_prompt"], trust: true, experience: "scam", moment: "introduction" },
  { id: "presentation.trust.scam.evidence_choice", familyId: "presentation.family.choice.single", flowId: "trust.scam_assessment", sceneId: "trust.scam.evidence_capture", input: "option", options: ["describe", "screenshot", "document"], ui: ["show_choice_question"], trust: true, experience: "scam", moment: "evidence_choice" },
  { id: "presentation.trust.scam.evidence_safe_fallback", familyId: "presentation.family.summary", flowId: "trust.scam_assessment", sceneId: "trust.scam.evidence_capture", ui: ["show_summary"], trust: true, privacyEvidence: true, experience: "scam", moment: "evidence_safe_fallback" },
  { id: "presentation.trust.scam.screenshot_capture", familyId: "presentation.family.capture.screenshot", flowId: "trust.scam_assessment", sceneId: "trust.scam.evidence_capture", input: "image", ui: ["show_image_upload"], fallback: "presentation.trust.scam.evidence_safe_fallback", trust: true, privacyEvidence: true, experience: "scam", moment: "screenshot_capture" },
  { id: "presentation.trust.scam.document_capture", familyId: "presentation.family.capture.document", flowId: "trust.scam_assessment", sceneId: "trust.scam.evidence_capture", input: "document", ui: ["show_document_upload"], fallback: "presentation.trust.scam.evidence_safe_fallback", trust: true, privacyEvidence: true, experience: "scam", moment: "document_capture" },
  { id: "presentation.trust.scam.copied_text", familyId: "presentation.family.input.free_text", flowId: "trust.scam_assessment", sceneId: "trust.scam.evidence_capture", input: "free_text", ui: ["show_text_prompt"], trust: true, experience: "scam", moment: "copied_text" },
  { id: "presentation.trust.scam.exposure_questions", familyId: "presentation.family.choice.single", flowId: "trust.scam_assessment", sceneId: "trust.scam.exposure_questions", input: "option", options: ["no_action", "shared_information", "sent_payment", "remote_access"], ui: ["show_choice_question"], trust: true, experience: "scam", moment: "exposure_questions" },
  { id: "presentation.trust.scam.immediate_actions", familyId: "presentation.family.safety.warning", flowId: "trust.scam_assessment", sceneId: "trust.scam.immediate_actions", input: "option", options: ["review_steps", "request_human"], ui: ["show_choice_question"], trust: true, experience: "scam", moment: "immediate_actions" },
  { id: "presentation.trust.scam.help_choice", familyId: "presentation.family.followup_choice", flowId: "trust.scam_assessment", sceneId: "trust.scam.escalation", input: "option", options: ["caregiver_help", "operator_help", "no_help"], ui: ["show_choice_question"], trust: true, experience: "scam", moment: "human_help_choice" },
  { id: "presentation.trust.scam.insufficient_evidence", familyId: "presentation.family.summary", flowId: "trust.scam_assessment", sceneId: "trust.scam.escalation", ui: ["show_summary"], trust: true, experience: "scam", moment: "insufficient_evidence" },
  { id: "presentation.trust.scam.no_obvious_indicators", familyId: "presentation.family.summary", flowId: "trust.scam_assessment", sceneId: "trust.scam.escalation", ui: ["show_summary"], trust: true, experience: "scam", moment: "no_obvious_indicators" },
  { id: "presentation.trust.scam.risk_result", familyId: "presentation.family.safety.warning", flowId: "trust.scam_assessment", sceneId: "trust.scam.escalation", input: "option", options: ["request_human", "acknowledge"], ui: ["show_choice_question"], trust: true, experience: "scam", moment: "likely_or_suspicious" },
  { id: "presentation.trust.scam.followup", familyId: "presentation.family.followup_choice", flowId: "trust.scam_assessment", sceneId: "trust.scam.escalation", input: "option", options: ["follow_up", "finish"], ui: ["show_choice_question"], trust: true, experience: "scam", moment: "followup" },

  { id: "presentation.safety.emergency_warning", familyId: "presentation.family.safety.warning", flowId: "safety.emergency_check", sceneId: "safety.emergency_check.main", input: "option", options: ["emergency_help", "human_help"], ui: ["show_choice_question"], safetyCritical: true, fallback: "presentation.safety.emergency_safe_fallback", experience: "emergency", moment: "warning" },
  { id: "presentation.safety.emergency_action", familyId: "presentation.family.safety.escalation", flowId: "safety.emergency_check", sceneId: "safety.emergency_check.main", input: "option", options: ["confirm_help", "human_help"], ui: ["show_confirmation"], safetyCritical: true, fallback: "presentation.safety.emergency_safe_fallback", experience: "emergency", moment: "emergency_action" },
  { id: "presentation.safety.emergency_support", familyId: "presentation.family.safety.escalation", flowId: "safety.emergency_check", sceneId: "safety.emergency_check.main", input: "option", options: ["caregiver", "operator", "human_help"], ui: ["show_confirmation"], safetyCritical: true, fallback: "presentation.safety.emergency_safe_fallback", experience: "emergency", moment: "support" },
  { id: "presentation.safety.emergency_waiting", familyId: "presentation.family.safety.escalation", flowId: "safety.emergency_check", sceneId: "safety.emergency_check.main", input: "option", options: ["human_help"], ui: ["show_progress"], safetyCritical: true, fallback: "presentation.safety.emergency_safe_fallback", experience: "emergency", moment: "waiting" },
  { id: "presentation.safety.emergency_safe_fallback", familyId: "presentation.family.error.safe_fallback", flowId: "safety.emergency_check", sceneId: "safety.emergency_check.main", input: "option", options: ["human_help", "retry"], ui: ["show_choice_question"], safetyCritical: true, experience: "emergency", moment: "safe_fallback" },

  { id: "presentation.engagement.notification_resume", familyId: "presentation.family.resume", flowId: "engagement.notification_resume", sceneId: "engagement.notification_resume.main", input: "option", options: ["resume", "defer", "cancel_attempt"], channels: ["pwa"], ui: ["show_choice_question"], experience: "notification_resume", moment: "resume_introduction" },
  { id: "presentation.engagement.restored_question", familyId: "presentation.family.resume", flowId: "engagement.notification_resume", sceneId: "engagement.notification_resume.main", input: "free_text", channels: ["pwa"], ui: ["show_text_prompt"], experience: "notification_resume", moment: "restored_question" },
  { id: "presentation.engagement.stale_version", familyId: "presentation.family.expired_or_stale", flowId: "engagement.notification_resume", sceneId: "engagement.notification_resume.main", input: "option", options: ["restart", "cancel_attempt"], channels: ["pwa"], ui: ["show_choice_question"], experience: "notification_resume", moment: "stale_version" },
  { id: "presentation.engagement.expired", familyId: "presentation.family.expired_or_stale", flowId: "engagement.notification_resume", sceneId: "engagement.notification_resume.main", input: "option", options: ["restart", "dismiss"], channels: ["pwa"], ui: ["show_choice_question"], experience: "notification_resume", moment: "expired" },
  { id: "presentation.engagement.defer", familyId: "presentation.family.followup_choice", flowId: "engagement.notification_resume", sceneId: "engagement.notification_resume.main", input: "option", options: ["defer", "resume"], channels: ["pwa"], ui: ["show_choice_question"], experience: "notification_resume", moment: "defer" },
  { id: "presentation.engagement.cancel_attempt", familyId: "presentation.family.confirmation", flowId: "engagement.notification_resume", sceneId: "engagement.notification_resume.main", input: "option", options: ["cancel_attempt", "continue"], channels: ["pwa"], ui: ["show_confirmation"], experience: "notification_resume", moment: "cancel" },
  { id: "presentation.engagement.channel_fallback", familyId: "presentation.family.error.safe_fallback", flowId: "engagement.notification_resume", sceneId: "engagement.notification_resume.main", input: "option", options: ["retry", "dismiss"], channels: ["pwa"], ui: ["show_choice_question"], experience: "notification_resume", moment: "channel_fallback" },
  { id: "presentation.engagement.outbound_call.voice", familyId: "presentation.family.choice.yes_no", flowId: "engagement.outbound_call", sceneId: "engagement.outbound_call.main", input: "option", options: ["accept", "decline"], channels: ["telephone"], devices: ["telephone_voice_only"], ui: [], experience: "shared", moment: "outbound_call_compatibility" },

  { id: "presentation.error.safe_generic", familyId: "presentation.family.error.safe_fallback", flowId: "health.preventive_check", sceneId: "health.preventive_check.main", input: "option", options: ["retry", "request_help"], ui: ["show_choice_question"], experience: "shared", moment: "safe_error" },
];

function title(id: string): string {
  return id.split(".").at(-1)!.replaceAll("_", " ");
}
function optionId(seed: PresentationSeed, value: string): string {
  return `${seed.id}.${value}`;
}
function createExpectedInput(seed: PresentationSeed): ExpectedFlowInput | null {
  if (!seed.input) return null;
  const base = {
    questionId: `${seed.id}.question`,
    sceneId: seed.sceneId,
    flowVersion: "1.0.0",
  };
  if (seed.input === "option") {
    return {
      ...base,
      answerKind: "option",
      options: (seed.options ?? ["continue"]).map((value) => ({
        id: optionId(seed, value),
        label: `presentation.option.${value}`,
        voiceAliases: [value.replaceAll("_", " ")],
      })),
    };
  }
  if (seed.input === "free_text") {
    return { ...base, answerKind: "free_text", maxLength: 2_000 };
  }
  if (seed.input === "image") {
    return {
      ...base,
      answerKind: "image",
      acceptedContentTypes: ["image/*"],
      maxSizeBytes: 20_000_000,
    };
  }
  if (seed.input === "document") {
    return {
      ...base,
      answerKind: "document",
      acceptedContentTypes: ["application/pdf", "text/plain"],
      maxSizeBytes: 20_000_000,
    };
  }
  if (seed.input === "measurement") {
    return {
      ...base,
      answerKind: "measurement",
      allowedModalities: ["measurement"],
      measurement: { valueType: "number" },
    };
  }
  return {
    ...base,
    answerKind: "structured",
    allowedModalities: ["touch", "text"],
    valueSchemaId: `${seed.id}.value`,
  };
}

function actionKindFor(seed: PresentationSeed): PresentationDefinition["actions"][number]["kind"] {
  if (seed.input === "image") {
    return seed.familyId.endsWith("image_retake") ? "retake_image" : "upload_image";
  }
  if (seed.input === "document") return "upload_document";
  if (seed.input === "free_text") return "submit_text";
  if (seed.input === "measurement") return "submit_measurement";
  return "submit_option";
}

function createInteractiveParts(seed: PresentationSeed): Pick<
  PresentationDefinition,
  "actions" | "eventMappings"
> {
  const expected = createExpectedInput(seed);
  if (!expected) return { actions: [], eventMappings: [] };
  const actions: PresentationDefinition["actions"] = [];
  const eventMappings: PresentationDefinition["eventMappings"] = [];
  const add = (
    suffix: string,
    modality: PresentationEventMapping["inputModality"],
    eventType: PresentationDefinition["eventMappings"][number]["interactionEventType"],
    source: PresentationEventMapping["eventSource"],
    payloadMapping: PresentationEventMapping["payloadMapping"],
    normalizedAnswerIntent: PresentationEventMapping["normalizedAnswerIntent"],
    option?: string,
    action = true,
  ) => {
    const actionId = `${seed.id}.action.${suffix}`;
    const mappingId = `${seed.id}.mapping.${suffix}`;
    if (action) {
      actions.push({
        actionId,
        kind: actionKindFor(seed),
        labelLocalizationKey: `${seed.id}.action.${suffix}.label`,
        optionId: option,
        confirmationRequired: seed.familyId === "presentation.family.consent",
        destructive: false,
        dismissesPresentation: false,
        accessibilityLabelKey: `${seed.id}.action.${suffix}.accessibility`,
        eventMappingId: mappingId,
        priority: 10,
      });
    }
    eventMappings.push({
      eventMappingId: mappingId,
      actionId: action ? actionId : undefined,
      passiveInput: !action,
      inputModality: modality,
      interactionEventType: eventType,
      eventSource: source,
      triggerSource: source === "tool" ? "system" : "user",
      payloadMapping,
      normalizedAnswerIntent,
      requiresCurrentQuestionCorrelation: true,
      requiresCurrentSceneCorrelation: true,
      requiresCurrentFlowVersionCorrelation: true,
    });
  };
  const telephoneOnly = seed.devices?.every(
    (device) => device === "telephone_voice_only",
  ) ?? false;
  if (expected.answerKind === "option") {
    for (const option of expected.options) {
      const suffix = option.id.split(".").at(-1)!;
      if (!telephoneOnly) {
        add(
          suffix,
          "touch",
          "USER_TAPPED_OPTION",
          "ui",
          {
            kind: "option",
            source: "fixed_action_option",
            optionId: option.id,
          },
          {
            answerKind: "option",
            optionIdSource: "fixed_action_option",
            optionId: option.id,
          },
          option.id,
        );
      }
    }
    const allowedOptionIds = expected.options.map((option) => option.id);
    add(
      "voice_answer",
      "voice",
      "USER_SPOKE",
      "voice",
      {
        kind: "option",
        source: "speech_resolution",
        sourceField: "payload.transcript",
      },
      {
        answerKind: "option",
        optionIdSource: "speech_resolution",
        allowedOptionIds,
      },
      undefined,
      telephoneOnly,
    );
    if (!telephoneOnly) {
      add(
        "text_answer",
        "text",
        "USER_ENTERED_TEXT",
        "ui",
        {
          kind: "option",
          source: "payload_option",
          sourceField: "payload.option_id",
        },
        {
          answerKind: "option",
          optionIdSource: "payload_option",
          allowedOptionIds,
        },
        undefined,
        false,
      );
    }
  } else if (expected.answerKind === "free_text") {
    if (!telephoneOnly) add(
      "text",
      "text",
      "USER_ENTERED_TEXT",
      "ui",
      { kind: "free_text", source: "submitted_text", sourceField: "payload.text" },
      { answerKind: "free_text", valueSource: "submitted_text" },
    );
    add(
      "voice",
      "voice",
      "USER_SPOKE",
      "voice",
      {
        kind: "free_text",
        source: "speech_transcript",
        sourceField: "payload.transcript",
      },
      { answerKind: "free_text", valueSource: "speech_transcript" },
      undefined,
      telephoneOnly,
    );
  } else if (expected.answerKind === "image") {
    add(
      "image",
      "image",
      "USER_UPLOADED_IMAGE",
      "ui",
      {
        kind: "image",
        source: "event_asset_reference",
        assetReferenceField: "payload.asset",
      },
      { answerKind: "image", assetReferenceSource: "event_payload" },
    );
  } else if (expected.answerKind === "document") {
    add(
      "document",
      "document",
      "USER_UPLOADED_DOCUMENT",
      "ui",
      {
        kind: "document",
        source: "event_asset_reference",
        assetReferenceField: "payload.asset",
      },
      { answerKind: "document", assetReferenceSource: "event_payload" },
    );
  } else if (expected.answerKind === "measurement") {
    add(
      "measurement",
      "measurement",
      "USER_ENTERED_MEASUREMENT",
      "ui",
      {
        kind: "measurement",
        source: "submitted_measurement",
        valueField: "payload.value",
        unitField: "payload.unit",
        measurementSchemaId: `${seed.id}.measurement`,
      },
      {
        answerKind: "measurement",
        valueSource: "submitted_value",
        unitSource: "submitted_unit",
        measurementSchemaId: `${seed.id}.measurement`,
      },
    );
  } else if (expected.answerKind === "structured") {
    add(
      "structured",
      "text",
      "USER_ENTERED_TEXT",
      "ui",
      {
        kind: "structured",
        source: "submitted_structure",
        sourceField: "payload.value",
        valueSchemaId: expected.valueSchemaId,
      },
      {
        answerKind: "structured",
        valueSource: "submitted_structure",
        valueSchemaId: expected.valueSchemaId,
      },
    );
  }
  return { actions, eventMappings };
}

function createPresentation(seed: PresentationSeed): PresentationDefinition {
  const expectedInput = createExpectedInput(seed);
  const interactive = createInteractiveParts(seed);
  const requiredSlotTypes =
    CANONICAL_PRESENTATION_FAMILIES.find(
      (family) => family.familyId === seed.familyId,
    )!.requiredContentSlots;
  const contentSlots = requiredSlotTypes.map((type, index) => ({
    slotId: `${seed.id}.slot.${type}_${index}`,
    type,
    localizationKey: `${seed.id}.content.${type}_${index}`,
    required: true,
    maximumLength: 2_000,
    speechPolicy: "required" as const,
    visualPolicy: seed.devices?.every(
      (device) => device === "telephone_voice_only",
    ) ? "hidden" as const : "required" as const,
    sensitivity: (seed.trust || seed.visualHealth)
      ? "sensitive" as const
      : "personal" as const,
    interpolationKeys: [],
  }));
  const requiredLocalizationKeys = [
    ...contentSlots.map((slot) => slot.localizationKey),
    ...interactive.actions.flatMap(
      (action) => [action.labelLocalizationKey, action.accessibilityLabelKey],
    ),
    ...(seed.privacyEvidence ? [`${seed.id}.evidence_purpose`] : []),
    ...(seed.visualHealth ? ["presentation.disclaimer.observation_only"] : []),
    ...(seed.trust ? ["presentation.disclaimer.no_safe_guarantee"] : []),
  ];
  const telephoneOnly = seed.devices?.every(
    (device) => device === "telephone_voice_only",
  ) ?? false;
  const safetyCritical = seed.safetyCritical ?? false;
  return {
    presentationId: seed.id,
    version: "1.0.0",
    displayName: title(seed.id),
    description: `Inert presentation definition for ${seed.experience}: ${seed.moment}.`,
    familyId: seed.familyId,
    sceneId: seed.sceneId,
    supportedFlowIds: [seed.flowId],
    status: "approved",
    supportedChannels: seed.channels ?? ["voice", "pwa", "touch", "text"],
    supportedDeviceClasses: seed.devices ?? ["mobile", "tablet", "desktop"],
    supportedOrientations: telephoneOnly ? undefined : ["portrait", "landscape"],
    supportedUIInstructionTypes: seed.ui ?? [],
    expectedInput,
    contentSlots,
    actions: interactive.actions,
    eventMappings: interactive.eventMappings,
    voiceSynchronization: {
      spokenContentSlotIds: contentSlots.map((slot) => slot.slotId),
      speakBeforeInteraction: true,
      interactionAvailableDuringSpeech: expectedInput !== null,
      bargeInAllowed: expectedInput !== null,
      interruptSpeechOnSubmit: expectedInput !== null,
      repeatPolicy: safetyCritical ? "until_answered" : "on_request",
      silenceTimeoutPolicy: {
        behavior: safetyCritical ? "repeat" : "offer_help",
        timeoutSeconds: 30,
      },
      acknowledgementPolicy: safetyCritical ? "required" : "brief",
      screenUpdateTiming: telephoneOnly ? "voice_only" : "with_speech",
      optionSpeechAliases: expectedInput?.answerKind === "option"
        ? expectedInput.options.map((option) => ({
          optionId: option.id,
          aliases: option.voiceAliases,
        }))
        : [],
      useCanonicalLabelsAsSpeechAliases: false,
      pronunciationKeys: [],
      captionsRequired: !telephoneOnly,
      voiceFallbackBehavior:
        safetyCritical || telephoneOnly ? "request_human" : "accessible_text",
    },
    visualBehavior: {
      layoutDensity: "spacious",
      focusTarget: expectedInput ? "question" : "title",
      initialScrollPosition: "top",
      keyboardBehavior: telephoneOnly ? "none" : "supported",
      progressVisibility: seed.familyId.includes("progress") ? "required" : "optional",
      loadingTreatment: "inline",
      errorPlacement: "inline",
      confirmationPlacement: "separate_step",
      contentPriority: safetyCritical
        ? ["safety", "actions", "support"]
        : ["privacy", "question", "actions", "status"],
      reducedMotionAlternative: "static",
      largeTextBehavior: telephoneOnly ? "voice_only" : "reflow",
      highContrastBehavior: "enhanced",
      colorOnlyCommunication: false,
    },
    accessibilityPolicy: {
      screenReaderRequired: !telephoneOnly,
      keyboardNavigationRequired: !telephoneOnly,
      minimumTouchTarget: interactive.eventMappings.some(
        (mapping) => mapping.actionId && mapping.inputModality === "touch",
      ) ? 48 : undefined,
      largeTextSupported: !telephoneOnly,
      highContrastSupported: !telephoneOnly,
      reducedMotionSupported: true,
      captionsRequired: !telephoneOnly,
      voiceOnlyFallback: true,
      touchOnlyFallback: !telephoneOnly,
      cognitiveLoad: "low",
      maximumPrimaryActions: 5,
      errorRecoveryInstructions: true,
      timeoutExtensionAllowed: !safetyCritical,
      repetitionAvailable: true,
    },
    localizationPolicy: {
      defaultLocale: "en",
      supportedLocales: ["en", "es", "de", "fr", "it", "pt"],
      requiredLocalizationKeys,
      interpolationKeys: [],
      fallbackLocale: "en",
      localeChangeAllowed: true,
      rightToLeftSupported: false,
      speechLocalizationRequired: true,
    },
    privacyTreatment: {
      sensitivity: seed.trust || seed.visualHealth ? "sensitive" : "personal",
      screenObscuringAllowed: Boolean(seed.trust || seed.visualHealth),
      hideInAppSwitcher: Boolean(seed.privacyEvidence),
      screenshotPolicy: seed.privacyEvidence ? "warn" : "allowed",
      recordingPolicy: seed.privacyEvidence ? "prohibited" : "consent_required",
      evidencePreviewPolicy: seed.privacyEvidence ? "required" : "none",
      autoClearPolicy: seed.privacyEvidence ? "after_submission" : "none",
      consentNoticeRequired: Boolean(seed.privacyEvidence),
      retentionNoticeRequired: Boolean(seed.privacyEvidence),
      shoulderSurfingWarning: Boolean(seed.trust || seed.privacyEvidence),
      caregiverVisibility: "consent_required",
      operatorVisibility: "consent_required",
      evidencePurposeLocalizationKey: seed.privacyEvidence
        ? `${seed.id}.evidence_purpose`
        : undefined,
      retakeAvailable: Boolean(seed.input === "image"),
      deletionAvailable: Boolean(seed.privacyEvidence),
      safeAbandonmentAvailable: Boolean(seed.privacyEvidence),
    },
    safetyTreatment: {
      safetyCritical,
      urgency: safetyCritical ? "immediate" : seed.trust ? "important" : "routine",
      dismissalPolicy: safetyCritical ? "prohibited" : "confirm",
      deferPolicy: safetyCritical ? "prohibited" : "allowed",
      acknowledgementRequired: safetyCritical,
      confirmationRequired: safetyCritical,
      humanHelpAvailable: Boolean(safetyCritical || seed.trust || seed.visualHealth),
      emergencyActionVisible: safetyCritical,
      prohibitedClaims: [
        ...(seed.visualHealth ? ["diagnosis" as const, "clinical_certainty" as const] : []),
        ...(seed.trust ? ["guaranteed_safe" as const, "safe_verdict" as const] : []),
        ...(seed.familyId === "presentation.family.tool_confirmation"
          ? ["tool_already_executed" as const]
          : []),
      ],
      requiredDisclaimers: [
        ...(seed.visualHealth ? ["presentation.disclaimer.observation_only"] : []),
        ...(seed.trust ? ["presentation.disclaimer.no_safe_guarantee"] : []),
      ],
      safeFallbackPresentationId: seed.fallback,
      timeoutBehavior: safetyCritical ? "remain_visible" : "none",
      coerciveDefault: false,
      toolExecutionState: seed.familyId === "presentation.family.tool_confirmation"
        ? "proposal_only"
        : "none",
    },
    fallbackPresentationId: seed.fallback,
    designSystemReferences: telephoneOnly
      ? ["component.voice_prompt", "token.type.spoken"]
      : ["component.voice_orb", "component.primary_action", "token.spacing.large"],
    designArtifactReferences: [{
      referenceId: `${seed.id}.design_spec`,
      type: "design_spec",
      version: "1.0.0",
      status: "draft",
    }],
    compatibility: { ...compatibility },
    metadata: {
      experience: seed.experience,
      moment: seed.moment,
      runtimeConnected: false,
    },
  };
}

export const CANONICAL_PRESENTATIONS: PresentationDefinition[] =
  SEEDS.map(createPresentation);
export const REQUIRED_PRESENTATION_IDS = CANONICAL_PRESENTATIONS.map(
  (presentation) => presentation.presentationId,
);
export const REQUIRED_REFERENCE_EXPERIENCES = [
  "preventive_health", "medication", "wound", "scam", "emergency",
  "notification_resume",
] as const;
export const REFERENCE_EXPERIENCES = REQUIRED_REFERENCE_EXPERIENCES;

export const VYVA_PRESENTATION_REGISTRY: PresentationRegistry = {
  registryVersion: "1.0.0",
  families: CANONICAL_PRESENTATION_FAMILIES,
  presentations: CANONICAL_PRESENTATIONS,
  metadata: {
    runtimeConnected: false,
    task1Commit: "fbbf7de3bef2ea9abb3829bd57e5253287c7e748",
    task2Commit: "c15ea0cddc8664ccd88976231f57060d9adeaa66",
    task3Commit: "e367cbfd5269212fa0e4437f029bb9eece7760aa",
  },
};
