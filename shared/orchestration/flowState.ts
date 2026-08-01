import { z } from "zod";
import {
  acceptedDocumentMimeTypeSchema,
  acceptedImageMimeTypeSchema,
  assetReferenceSchema,
  isAcceptedContentType,
} from "./assets";
import {
  OrchestrationContractError,
  contractError,
  type OrchestrationContractErrorCode,
} from "./errors";

export const FLOW_LIFECYCLE_STATES = [
  "idle",
  "initializing",
  "active",
  "waiting_for_user",
  "waiting_for_tool",
  "interrupted",
  "paused",
  "resuming",
  "completed",
  "escalated",
  "cancelled",
  "expired",
  "failed",
] as const;

export type FlowLifecycleState = typeof FLOW_LIFECYCLE_STATES[number];

export const FLOW_TRANSITIONS = {
  idle: ["initializing"],
  initializing: ["active", "escalated", "cancelled", "failed"],
  active: ["waiting_for_user", "waiting_for_tool", "completed", "interrupted", "failed"],
  waiting_for_user: ["active", "interrupted", "paused", "expired", "failed"],
  waiting_for_tool: ["active", "interrupted", "failed"],
  interrupted: ["paused", "escalated"],
  paused: ["resuming", "expired", "cancelled"],
  resuming: ["active", "expired", "failed"],
  completed: [],
  escalated: [],
  cancelled: [],
  expired: [],
  failed: ["resuming"],
} as const satisfies Record<FlowLifecycleState, readonly FlowLifecycleState[]>;

export const flowLifecycleStateSchema = z.enum(FLOW_LIFECYCLE_STATES);

export const answerOptionSchema = z.object({
  id: z.string().min(1),
  value: z.unknown().optional(),
  label: z.string().min(1),
  voiceAliases: z.array(z.string().min(1)).default([]),
}).strict();

export const ANSWER_KINDS = [
  "option",
  "free_text",
  "structured",
  "measurement",
  "image",
  "document",
  "tool_result",
] as const;

export type AnswerKind = typeof ANSWER_KINDS[number];

export const ANSWER_SUBMISSION_MODALITIES = [
  "voice",
  "touch",
  "text",
  "measurement",
  "tool",
  "image",
  "document",
] as const;

export type AnswerSubmissionModality = typeof ANSWER_SUBMISSION_MODALITIES[number];

/**
 * The only modality combinations accepted by answer normalization.
 * Structured/measurement variants further select an explicit subset through
 * their allowedModalities field.
 */
export const ANSWER_KIND_MODALITY_COMPATIBILITY = {
  option: ["voice", "touch", "text"],
  free_text: ["voice", "text"],
  structured: ["touch", "text", "measurement", "tool"],
  measurement: ["touch", "text", "measurement", "tool"],
  image: ["image"],
  document: ["document"],
  tool_result: ["tool"],
} as const satisfies Record<AnswerKind, readonly AnswerSubmissionModality[]>;

const expectedInputBase = {
  questionId: z.string().min(1),
  sceneId: z.string().min(1),
  flowVersion: z.string().min(1),
};

const optionExpectedInputSchema = z.object({
  ...expectedInputBase,
  answerKind: z.literal("option"),
  options: z.array(answerOptionSchema).min(1),
}).strict();

const freeTextExpectedInputSchema = z.object({
  ...expectedInputBase,
  answerKind: z.literal("free_text"),
  maxLength: z.number().int().positive().max(10_000).optional(),
}).strict();

const structuredModalitiesSchema = z.array(
  z.enum(["touch", "text", "measurement", "tool"]),
).min(1).refine((items) => new Set(items).size === items.length, "Modalities must be unique");

const structuredExpectedInputSchema = z.object({
  ...expectedInputBase,
  answerKind: z.literal("structured"),
  allowedModalities: structuredModalitiesSchema,
  valueSchemaId: z.string().min(1).max(128).optional(),
}).strict();

export const measurementDescriptorSchema = z.object({
  valueType: z.enum(["number", "integer", "structured"]),
  unit: z.string().min(1).max(32).optional(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  precision: z.number().int().min(0).max(12).optional(),
}).strict().superRefine((descriptor, context) => {
  if (descriptor.min !== undefined && descriptor.max !== undefined && descriptor.min > descriptor.max) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Measurement minimum exceeds maximum" });
  }
});

const measurementExpectedInputSchema = z.object({
  ...expectedInputBase,
  answerKind: z.literal("measurement"),
  allowedModalities: structuredModalitiesSchema,
  measurement: measurementDescriptorSchema,
}).strict();

const toolResultExpectedInputSchema = z.object({
  ...expectedInputBase,
  answerKind: z.literal("tool_result"),
  expectedToolId: z.string().min(1).max(128).optional(),
  expectedResultType: z.string().min(1).max(128).optional(),
}).strict();

const imageExpectedInputSchema = z.object({
  ...expectedInputBase,
  answerKind: z.literal("image"),
  acceptedContentTypes: z.array(acceptedImageMimeTypeSchema).min(1),
  maxSizeBytes: z.number().int().positive().optional(),
}).strict();

const documentExpectedInputSchema = z.object({
  ...expectedInputBase,
  answerKind: z.literal("document"),
  acceptedContentTypes: z.array(acceptedDocumentMimeTypeSchema).min(1),
  maxSizeBytes: z.number().int().positive().optional(),
}).strict();

const expectedFlowInputDiscriminatedSchema = z.discriminatedUnion("answerKind", [
  optionExpectedInputSchema,
  freeTextExpectedInputSchema,
  structuredExpectedInputSchema,
  measurementExpectedInputSchema,
  toolResultExpectedInputSchema,
  imageExpectedInputSchema,
  documentExpectedInputSchema,
]);

export const expectedFlowInputSchema = expectedFlowInputDiscriminatedSchema.superRefine(
  (input, context) => {
    if (input.answerKind === "option") {
      const ids = input.options.map((option) => option.id);
      if (new Set(ids).size !== ids.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Option IDs must be unique",
          path: ["options"],
        });
      }
    }
    if (
      input.answerKind === "tool_result"
      && !input.expectedToolId
      && !input.expectedResultType
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expected tool ID or result type is required",
      });
    }
  },
);

export type AnswerOption = z.infer<typeof answerOptionSchema>;
export type ExpectedFlowInput = z.infer<typeof expectedFlowInputSchema>;

const answerContextShape = {
  questionId: z.string().min(1),
  sceneId: z.string().min(1),
  flowVersion: z.string().min(1),
};

const definedValueSchema = z.unknown().refine(
  (value) => value !== undefined,
  "Answer value is required",
);

const answerSubmissionBaseSchema = z.discriminatedUnion("modality", [
  z.object({
    modality: z.literal("voice"),
    transcript: z.string().min(1),
    ...answerContextShape,
  }).strict(),
  z.object({
    modality: z.literal("touch"),
    answerId: z.string().min(1).optional(),
    value: definedValueSchema.optional(),
    ...answerContextShape,
  }).strict(),
  z.object({
    modality: z.literal("text"),
    text: z.string().min(1),
    ...answerContextShape,
  }).strict(),
  z.object({
    modality: z.literal("tool"),
    value: definedValueSchema,
    toolId: z.string().min(1).max(128),
    resultType: z.string().min(1).max(128).optional(),
    ...answerContextShape,
  }).strict(),
  z.object({
    modality: z.literal("measurement"),
    value: definedValueSchema,
    ...answerContextShape,
  }).strict(),
  z.object({
    modality: z.literal("image"),
    image: assetReferenceSchema,
    ...answerContextShape,
  }).strict(),
  z.object({
    modality: z.literal("document"),
    document: assetReferenceSchema,
    ...answerContextShape,
  }).strict(),
]);

export const answerSubmissionSchema = answerSubmissionBaseSchema.superRefine(
  (submission, context) => {
    if (
      submission.modality === "touch"
      && submission.answerId === undefined
      && submission.value === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Touch answers require answerId or value",
        path: ["answerId"],
      });
    }
  },
);

export const normalizedAnswerSchema = z.object({
  questionId: z.string().min(1),
  answerId: z.string().min(1).optional(),
  answerKind: z.enum(ANSWER_KINDS),
  value: definedValueSchema,
}).strict();

export type AnswerSubmission = z.infer<typeof answerSubmissionSchema>;
export type NormalizedAnswer = z.infer<typeof normalizedAnswerSchema>;

export const pendingToolSchema = z.object({
  toolId: z.string().min(1).max(128),
  requestId: z.string().min(1).max(128),
  startedAt: z.string().datetime({ offset: true }),
}).strict();

export const resumeMetadataSchema = z.object({
  previousState: flowLifecycleStateSchema,
  interruptedAt: z.string().datetime({ offset: true }),
  reason: z.string().min(1).max(256),
}).strict();

const TERMINAL_FLOW_STATES: readonly FlowLifecycleState[] = [
  "completed", "cancelled", "expired", "escalated", "failed",
];

function addContractIssue(
  context: z.RefinementCtx,
  code: OrchestrationContractErrorCode,
  path: Array<string | number>,
): void {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: code,
    path,
    params: { contractErrorCode: code },
  });
}

export const flowStateSchema = z.object({
  flowId: z.string().min(1).optional(),
  flowVersion: z.string().min(1).optional(),
  state: flowLifecycleStateSchema,
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  expectedInput: expectedFlowInputSchema.optional(),
  parentFlowId: z.string().min(1).optional(),
  interruptedState: flowLifecycleStateSchema.optional(),
  resumeMetadata: resumeMetadataSchema.optional(),
  pendingTool: pendingToolSchema.optional(),
  context: z.record(z.unknown()),
  updatedAt: z.string().datetime({ offset: true }),
}).strict().superRefine((flow, context) => {
  if (flow.state === "waiting_for_user" && !flow.expectedInput) {
    addContractIssue(context, "MISSING_EXPECTED_INPUT", ["expectedInput"]);
  }
  if (flow.state !== "waiting_for_user" && flow.expectedInput) {
    addContractIssue(
      context,
      TERMINAL_FLOW_STATES.includes(flow.state)
        ? "TERMINAL_STATE_HAS_EXPECTED_INPUT"
        : "UNEXPECTED_EXPECTED_INPUT",
      ["expectedInput"],
    );
  }
  if (flow.state === "waiting_for_tool" && !flow.pendingTool) {
    addContractIssue(context, "MISSING_PENDING_TOOL", ["pendingTool"]);
  }
  if (flow.state !== "waiting_for_tool" && flow.pendingTool) {
    addContractIssue(context, "INVALID_VALUE", ["pendingTool"]);
  }
  if (flow.state === "interrupted" && !flow.interruptedState && !flow.resumeMetadata) {
    addContractIssue(context, "MISSING_INTERRUPTED_STATE", ["interruptedState"]);
  }
  if (flow.state === "idle") {
    const hasActiveData = Boolean(
      flow.flowId
      || flow.flowVersion
      || flow.parentFlowId
      || flow.interruptedState
      || flow.resumeMetadata
      || flow.expectedInput
      || flow.pendingTool
      || Object.keys(flow.context).length,
    );
    if (hasActiveData) addContractIssue(context, "IDLE_STATE_HAS_ACTIVE_FLOW_DATA", ["state"]);
  } else if (!flow.flowId || !flow.flowVersion) {
    addContractIssue(context, "INVALID_VALUE", ["flowId"]);
  }
  if (flow.expectedInput && flow.expectedInput.flowVersion !== flow.flowVersion) {
    addContractIssue(context, "STALE_FLOW_VERSION", ["expectedInput", "flowVersion"]);
  }
});

export type FlowState = z.infer<typeof flowStateSchema>;

export const flowTransitionSchema = z.object({
  flowId: z.string().min(1),
  flowVersion: z.string().min(1),
  from: flowLifecycleStateSchema,
  to: flowLifecycleStateSchema,
  occurredAt: z.string().datetime({ offset: true }),
  eventId: z.string().min(1),
  reason: z.string().min(1),
}).strict().superRefine((transition, context) => {
  if (!canTransition(transition.from, transition.to)) {
    addContractIssue(context, "INVALID_STATE_TRANSITION", ["to"]);
  }
});

export type FlowTransition = z.infer<typeof flowTransitionSchema>;

export function canTransition(
  from: FlowLifecycleState,
  to: FlowLifecycleState,
): boolean {
  return (FLOW_TRANSITIONS[from] as readonly FlowLifecycleState[]).includes(to);
}

function typedErrorFromZod(
  error: z.ZodError,
  fallback: OrchestrationContractErrorCode,
): OrchestrationContractError {
  const customIssue = error.issues.find(
    (issue) => issue.code === z.ZodIssueCode.custom
      && (issue as { params?: Record<string, unknown> }).params?.contractErrorCode,
  ) as ({ params?: Record<string, unknown> } | undefined);
  const typedCode = customIssue?.params?.contractErrorCode as OrchestrationContractErrorCode | undefined;
  return new OrchestrationContractError(typedCode ?? fallback);
}

export function parseFlowState(value: unknown): FlowState {
  const result = flowStateSchema.safeParse(value);
  if (!result.success) throw typedErrorFromZod(result.error, "INVALID_VALUE");
  return result.data;
}

export function parseFlowTransition(value: unknown): FlowTransition {
  const result = flowTransitionSchema.safeParse(value);
  if (!result.success) throw typedErrorFromZod(result.error, "INVALID_STATE_TRANSITION");
  return result.data;
}

function comparable(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[.!?,;:]+$/g, "")
    .replace(/\s+/g, " ");
}

function assertCurrentQuestion(
  expected: ExpectedFlowInput,
  submission: AnswerSubmission,
): void {
  if (submission.flowVersion !== expected.flowVersion) {
    contractError("STALE_FLOW_VERSION");
  }
  if (submission.sceneId !== expected.sceneId) {
    contractError("STALE_SCENE");
  }
  if (submission.questionId !== expected.questionId) {
    contractError("STALE_QUESTION");
  }
}

function resolveOption(
  expected: Extract<ExpectedFlowInput, { answerKind: "option" }>,
  submittedValue: string,
): AnswerOption | undefined {
  const candidate = comparable(submittedValue);
  return expected.options.find((option) => {
    const accepted = [option.id, option.label, ...option.voiceAliases];
    return accepted.some((value) => comparable(value) === candidate);
  });
}

function submittedOptionCandidate(submission: AnswerSubmission): string | undefined {
  switch (submission.modality) {
    case "voice":
      return submission.transcript;
    case "touch":
      return submission.answerId;
    case "text":
      return submission.text;
    case "tool":
    case "measurement":
    case "image":
    case "document":
      return undefined;
  }
}

function submittedStructuredValue(submission: AnswerSubmission): unknown {
  switch (submission.modality) {
    case "voice":
      return submission.transcript;
    case "text":
      return submission.text;
    case "tool":
    case "measurement":
      return submission.value;
    case "image":
      return submission.image;
    case "document":
      return submission.document;
    case "touch":
      if (submission.value === undefined) {
        contractError("INVALID_VALUE");
      }
      return submission.value;
  }
}

function normalizedMeasurementValue(
  expected: Extract<ExpectedFlowInput, { answerKind: "measurement" }>,
  rawValue: unknown,
): unknown {
  const descriptor = expected.measurement;
  if (descriptor.valueType === "structured") {
    if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
      contractError("INVALID_VALUE");
    }
    return rawValue;
  }

  const value = typeof rawValue === "string" && rawValue.trim() !== ""
    ? Number(rawValue)
    : rawValue;
  if (typeof value !== "number" || !Number.isFinite(value)) contractError("INVALID_VALUE");
  if (descriptor.valueType === "integer" && !Number.isInteger(value)) contractError("INVALID_VALUE");
  if (descriptor.min !== undefined && value < descriptor.min) contractError("INVALID_VALUE");
  if (descriptor.max !== undefined && value > descriptor.max) contractError("INVALID_VALUE");
  if (descriptor.precision !== undefined) {
    const factor = 10 ** descriptor.precision;
    if (Math.abs(value * factor - Math.round(value * factor)) > Number.EPSILON * factor) {
      contractError("INVALID_VALUE");
    }
  }
  return value;
}

export function isAnswerModalityCompatible(
  expected: ExpectedFlowInput,
  modality: AnswerSubmissionModality,
): boolean {
  const compatible = (
    ANSWER_KIND_MODALITY_COMPATIBILITY[expected.answerKind] as readonly AnswerSubmissionModality[]
  ).includes(modality);

  if (!compatible) return false;
  if (expected.answerKind === "structured" || expected.answerKind === "measurement") {
    return expected.allowedModalities.includes(
      modality as "touch" | "text" | "measurement" | "tool",
    );
  }
  return true;
}

function assertAnswerModalityCompatible(
  expected: ExpectedFlowInput,
  submission: AnswerSubmission,
): void {
  if (!isAnswerModalityCompatible(expected, submission.modality)) {
    contractError("INVALID_MODALITY");
  }
}

/**
 * Produces the modality-independent answer consumed by a future flow runner.
 * The source modality remains available on the originating interaction event.
 */
export function normalizeAnswer(
  rawExpected: ExpectedFlowInput,
  rawSubmission: AnswerSubmission,
): NormalizedAnswer {
  const expectedResult = expectedFlowInputSchema.safeParse(rawExpected);
  if (!expectedResult.success) throw typedErrorFromZod(expectedResult.error, "INVALID_VALUE");
  const expected = expectedResult.data;
  const submissionResult = answerSubmissionSchema.safeParse(rawSubmission);
  if (!submissionResult.success) {
    const raw = rawSubmission as { modality?: string; answerId?: unknown };
    if (raw.answerId !== undefined && raw.modality !== "touch") {
      contractError("ANSWER_ID_NOT_ALLOWED");
    }
    contractError(
      raw.modality === "image" || raw.modality === "document"
        ? "INVALID_ASSET_REFERENCE"
        : "INVALID_VALUE",
    );
  }
  const submission = submissionResult.data;
  assertCurrentQuestion(expected, submission);
  assertAnswerModalityCompatible(expected, submission);

  if (expected.answerKind !== "option" && "answerId" in submission && submission.answerId !== undefined) {
    contractError("ANSWER_ID_NOT_ALLOWED");
  }

  if (expected.answerKind !== "option") {
    if (expected.answerKind === "tool_result") {
      if (submission.modality !== "tool") contractError("INVALID_MODALITY");
      if (expected.expectedToolId && submission.toolId !== expected.expectedToolId) {
        contractError("INVALID_VALUE");
      }
      if (expected.expectedResultType && submission.resultType !== expected.expectedResultType) {
        contractError("INVALID_VALUE");
      }
    }
    if (expected.answerKind === "image" || expected.answerKind === "document") {
      const asset = submission.modality === "image"
        ? submission.image
        : submission.modality === "document"
          ? submission.document
          : contractError("INVALID_MODALITY");
      if (!isAcceptedContentType(asset.contentType, expected.acceptedContentTypes)) {
        contractError("INVALID_MIME_TYPE");
      }
      if (expected.maxSizeBytes !== undefined && asset.sizeBytes !== undefined && asset.sizeBytes > expected.maxSizeBytes) {
        contractError("INVALID_ASSET_REFERENCE");
      }
    }
    const rawValue = submittedStructuredValue(submission);
    if (
      expected.answerKind === "free_text"
      && expected.maxLength !== undefined
      && typeof rawValue === "string"
      && rawValue.length > expected.maxLength
    ) {
      contractError("INVALID_VALUE");
    }
    const value = expected.answerKind === "measurement"
      ? normalizedMeasurementValue(expected, rawValue)
      : rawValue;
    return normalizedAnswerSchema.parse({
      questionId: expected.questionId,
      answerKind: expected.answerKind,
      value,
    });
  }

  const submittedValue = submittedOptionCandidate(submission);
  if (!submittedValue) {
    contractError("ANSWER_ID_REQUIRED");
  }
  const option = resolveOption(expected, submittedValue);
  if (!option) {
    contractError("OPTION_NOT_ALLOWED");
  }

  return normalizedAnswerSchema.parse({
    questionId: expected.questionId,
    answerId: option.id,
    answerKind: "option",
    value: option.value === undefined ? option.id : option.value,
  });
}
