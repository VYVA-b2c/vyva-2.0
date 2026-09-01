import { createHash } from "node:crypto";
import { z } from "zod";
import {
  type AnswerOption,
  type AnswerSubmissionModality,
  type ExpectedFlowInput,
  type FlowLifecycleState,
  type FlowState,
  type FlowTransition,
  type NormalizedAnswer,
  normalizeAnswer,
  parseFlowState,
  parseFlowTransition,
} from "../../shared/orchestration/flowState.js";
import {
  type FlowCatalogue,
  type FlowDefinition,
  VYVA_FLOW_CATALOGUE,
} from "../../shared/orchestration/flowCatalogue.js";
import {
  type PresentationDefinition,
  type PresentationRegistry,
  VYVA_PRESENTATION_REGISTRY,
} from "../../shared/orchestration/presentationRegistry.js";
import { eventStateCanonicalDigest } from "../orchestrator/interactionEventRuntime.js";

export const PREVENTIVE_HEALTH_FLOW_ID = "health.preventive_check" as const;
export const PREVENTIVE_HEALTH_FLOW_VERSION = "1.0.0" as const;
export const PREVENTIVE_HEALTH_SCENE_ID = "health.preventive_check.main" as const;
export const PREVENTIVE_HEALTH_SPECIALIST_ID = "preventive_health" as const;
export const PREVENTIVE_HEALTH_SPECIALIST_VERSION = "1.0.0" as const;

export type PreventiveHealthQuestionKey =
  | "energy_level"
  | "mood"
  | "body_areas"
  | "sleep_quality"
  | "symptoms"
  | "symptom_details"
  | "safety_flags"
  | "social_contact";

export type PreventiveHealthAnswers = {
  energy_level: number;
  mood: string;
  body_areas: string[];
  sleep_quality: string;
  symptoms: string[];
  symptom_details: string[];
  safety_flags: string[];
  social_contact: string;
};

export type PreventiveHealthAnswerSubmission = {
  questionId: string;
  sceneId: string;
  flowVersion: string;
  modality: AnswerSubmissionModality;
  answerId?: string;
  value?: unknown;
  transcript?: string;
  text?: string;
};

export type PreventiveHealthFlowDefinition = {
  flowId: typeof PREVENTIVE_HEALTH_FLOW_ID;
  flowVersion: typeof PREVENTIVE_HEALTH_FLOW_VERSION;
  sceneId: typeof PREVENTIVE_HEALTH_SCENE_ID;
  ownerSpecialistId: typeof PREVENTIVE_HEALTH_SPECIALIST_ID;
  questions: readonly PreventiveHealthQuestionDefinition[];
  completionId: "health.preventive_check.completed";
};

export type PreventiveHealthRuntimeContract = PreventiveHealthFlowDefinition & {
  catalogueVersion: string;
  presentationRegistryVersion: string;
  canonicalFlow: FlowDefinition;
  presentations: readonly PresentationDefinition[];
};

type PreventiveHealthQuestionDefinition = {
  key: PreventiveHealthQuestionKey;
  questionId: string;
  answerMode: "single_option" | "multi_option";
  options: readonly AnswerOption[];
  optional?: boolean;
};

const answerId = z.string().min(1).max(80);

export const preventiveHealthAnswersSchema = z.object({
  energy_level: z.number().int().min(1).max(5),
  mood: answerId,
  body_areas: z.array(answerId).max(7).default([]),
  sleep_quality: answerId,
  symptoms: z.array(answerId).max(7).default([]),
  symptom_details: z.array(answerId).max(16).default([]),
  safety_flags: z.array(answerId).max(8).default([]),
  social_contact: answerId,
}).strict();

const submissionSchema = z.object({
  questionId: z.string().min(1),
  sceneId: z.string().min(1),
  flowVersion: z.string().min(1),
  modality: z.enum([
    "voice",
    "touch",
    "text",
    "measurement",
    "tool",
    "image",
    "document",
  ]),
  answerId: z.string().min(1).optional(),
  value: z.unknown().optional(),
  transcript: z.string().min(1).optional(),
  text: z.string().min(1).optional(),
}).strict();

const energyOptions: AnswerOption[] = [
  { id: "energy_1", value: 1, label: "Sin energia", voiceAliases: ["sin energia", "one", "uno", "1"] },
  { id: "energy_2", value: 2, label: "Algo cansada", voiceAliases: ["algo cansada", "algo cansado", "tired", "dos", "2"] },
  { id: "energy_3", value: 3, label: "Normal", voiceAliases: ["normal", "three", "tres", "3"] },
  { id: "energy_4", value: 4, label: "Bastante bien", voiceAliases: ["bastante bien", "well", "cuatro", "4"] },
  { id: "energy_5", value: 5, label: "Con mucha energia", voiceAliases: ["mucha energia", "high energy", "cinco", "5"] },
];

const moodOptions: AnswerOption[] = [
  { id: "alegre", label: "Alegre", voiceAliases: ["happy", "cheerful"] },
  { id: "tranquila", label: "Tranquila", voiceAliases: ["calm", "tranquilo"] },
  { id: "triste", label: "Triste", voiceAliases: ["sad"] },
  { id: "ansiosa", label: "Inquieta", voiceAliases: ["ansiosa", "anxious", "nervous"] },
  { id: "irritable", label: "Irritable", voiceAliases: ["irritable"] },
];

const bodyOptions: AnswerOption[] = [
  { id: "cabeza", label: "Cabeza", voiceAliases: ["head"] },
  { id: "pecho", label: "Pecho", voiceAliases: ["chest"] },
  { id: "estomago", label: "Estomago", voiceAliases: ["stomach", "belly"] },
  { id: "espalda", label: "Espalda", voiceAliases: ["back"] },
  { id: "articulaciones", label: "Articulaciones", voiceAliases: ["joints"] },
  { id: "piernas", label: "Piernas", voiceAliases: ["legs"] },
  { id: "ninguno", label: "Nada especial", voiceAliases: ["none", "nothing", "ninguno"] },
];

const sleepOptions: AnswerOption[] = [
  { id: "muy_bien", label: "Muy bien", voiceAliases: ["very well", "great"] },
  { id: "bien", label: "Bien", voiceAliases: ["well", "good"] },
  { id: "regular", label: "Regular", voiceAliases: ["okay", "so so"] },
  { id: "mal", label: "Mal", voiceAliases: ["bad", "poor"] },
  { id: "muy_mal", label: "Muy mal", voiceAliases: ["very bad", "terrible"] },
];

const symptomOptions: AnswerOption[] = [
  { id: "dolor_cabeza", label: "Dolor de cabeza", voiceAliases: ["headache"] },
  { id: "mareo", label: "Mareo", voiceAliases: ["dizzy", "dizziness"] },
  { id: "nauseas", label: "Nauseas", voiceAliases: ["nausea", "nauseous"] },
  { id: "fiebre", label: "Sensacion de fiebre", voiceAliases: ["fever", "feverish"] },
  { id: "falta_aire", label: "Me falta el aire", voiceAliases: ["short of breath", "breathless"] },
  { id: "confusion", label: "Siento confusion", voiceAliases: ["confused", "confusion"] },
  { id: "ninguno", label: "Ninguno de estos", voiceAliases: ["none", "nothing", "ninguno"] },
];

const symptomDetailOptions: AnswerOption[] = [
  { id: "fever_temp_38", label: "Tengo 38 grados o mas", voiceAliases: ["38", "thirty eight"] },
  { id: "fever_temp_39", label: "Tengo 39 grados o mas", voiceAliases: ["39", "thirty nine", "high fever"] },
  { id: "fever_unmeasured", label: "No la he medido", voiceAliases: ["not measured"] },
  { id: "breath_rest", label: "Me falta el aire en reposo", voiceAliases: ["at rest"] },
  { id: "breath_speaking", label: "Me cuesta hablar frases completas", voiceAliases: ["hard to speak"] },
  { id: "breath_exertion", label: "Solo al moverme", voiceAliases: ["when moving"] },
  { id: "dizzy_faint", label: "Siento que podria desmayarme", voiceAliases: ["might faint"] },
  { id: "dizzy_standing", label: "Empeora al levantarme", voiceAliases: ["standing"] },
  { id: "dizzy_mild", label: "Es leve y estable", voiceAliases: ["mild"] },
  { id: "nausea_vomiting", label: "He vomitado o no retengo liquidos", voiceAliases: ["vomiting"] },
  { id: "nausea_can_drink", label: "Puedo beber pequenos sorbos", voiceAliases: ["can drink"] },
  { id: "headache_sudden", label: "Dolor de cabeza muy fuerte o repentino", voiceAliases: ["sudden headache"] },
  { id: "headache_vision", label: "Viene con vision rara o debilidad", voiceAliases: ["vision changes"] },
  { id: "headache_mild", label: "Es parecido a otros dolores", voiceAliases: ["similar headache"] },
  { id: "chest_pressure_detail", label: "Presion opresion o dolor en el pecho", voiceAliases: ["chest pressure"] },
  { id: "chest_mild_detail", label: "Molestia leve y localizada", voiceAliases: ["mild chest"] },
  { id: "confusion_now_detail", label: "Me siento confuso ahora", voiceAliases: ["confused now"] },
  { id: "confusion_passed_detail", label: "Fue un momento y ya paso", voiceAliases: ["passed"] },
];

const safetyOptions: AnswerOption[] = [
  { id: "severe_now", label: "Es fuerte o esta empeorando", voiceAliases: ["strong", "getting worse"] },
  { id: "chest_pressure", label: "Hay presion o dolor en el pecho", voiceAliases: ["chest pressure"] },
  { id: "confusion_now", label: "Me noto confuso o desorientado", voiceAliases: ["confused now"] },
  { id: "sudden_weakness", label: "Hay debilidad repentina", voiceAliases: ["sudden weakness"] },
  { id: "mild_stable", label: "Es leve y estable", voiceAliases: ["mild stable"] },
  { id: "resolved", label: "Ya se ha pasado", voiceAliases: ["resolved", "passed"] },
];

const socialOptions: AnswerOption[] = [
  { id: "mucho", label: "Si bastante", voiceAliases: ["yes a lot", "mucho"] },
  { id: "algo", label: "Un poco", voiceAliases: ["a little", "algo"] },
  { id: "no", label: "No mucho", voiceAliases: ["not much", "no"] },
];

export const PREVENTIVE_HEALTH_FLOW_DEFINITION: PreventiveHealthFlowDefinition = {
  flowId: PREVENTIVE_HEALTH_FLOW_ID,
  flowVersion: PREVENTIVE_HEALTH_FLOW_VERSION,
  sceneId: PREVENTIVE_HEALTH_SCENE_ID,
  ownerSpecialistId: PREVENTIVE_HEALTH_SPECIALIST_ID,
  completionId: "health.preventive_check.completed",
  questions: [
    { key: "energy_level", questionId: "health.preventive_check.energy", answerMode: "single_option", options: energyOptions },
    { key: "mood", questionId: "health.preventive_check.mood", answerMode: "single_option", options: moodOptions },
    { key: "body_areas", questionId: "health.preventive_check.body", answerMode: "multi_option", options: bodyOptions, optional: true },
    { key: "sleep_quality", questionId: "health.preventive_check.sleep", answerMode: "single_option", options: sleepOptions },
    { key: "symptoms", questionId: "health.preventive_check.symptoms", answerMode: "multi_option", options: symptomOptions, optional: true },
    { key: "symptom_details", questionId: "health.preventive_check.details", answerMode: "multi_option", options: symptomDetailOptions, optional: true },
    { key: "safety_flags", questionId: "health.preventive_check.safety", answerMode: "multi_option", options: safetyOptions, optional: true },
    { key: "social_contact", questionId: "health.preventive_check.social", answerMode: "single_option", options: socialOptions },
  ],
};

export function resolvePreventiveHealthRuntimeContract(input: {
  catalogue?: FlowCatalogue;
  presentationRegistry?: PresentationRegistry;
} = {}): PreventiveHealthRuntimeContract | null {
  const catalogue = input.catalogue ?? VYVA_FLOW_CATALOGUE;
  const presentationRegistry = input.presentationRegistry ?? VYVA_PRESENTATION_REGISTRY;
  const canonicalFlow = catalogue.flows.find((flow) =>
    flow.flowId === PREVENTIVE_HEALTH_FLOW_ID &&
    flow.version === PREVENTIVE_HEALTH_FLOW_VERSION);
  if (!canonicalFlow) return null;
  if (canonicalFlow.ownerSpecialistId !== PREVENTIVE_HEALTH_SPECIALIST_ID) return null;
  if (!["approved", "pilot", "active"].includes(canonicalFlow.status)) return null;
  if (!canonicalFlow.supportedChannels.includes("touch")) return null;
  if (!canonicalFlow.supportedChannels.includes("voice")) return null;
  if (!canonicalFlow.supportedChannels.includes("text")) return null;
  if (!canonicalFlow.uiScenes.some((scene) => scene.sceneId === PREVENTIVE_HEALTH_SCENE_ID)) {
    return null;
  }
  const presentations = presentationRegistry.presentations.filter((presentation) =>
    presentation.supportedFlowIds.includes(PREVENTIVE_HEALTH_FLOW_ID) &&
    presentation.sceneId === PREVENTIVE_HEALTH_SCENE_ID &&
    ["approved", "pilot", "active"].includes(presentation.status));
  if (presentations.length === 0) return null;
  return {
    ...PREVENTIVE_HEALTH_FLOW_DEFINITION,
    catalogueVersion: catalogue.catalogueVersion,
    presentationRegistryVersion: presentationRegistry.registryVersion,
    canonicalFlow,
    presentations,
  };
}

export type PreventiveHealthFlowRunResult = {
  normalizedAnswers: PreventiveHealthAnswers;
  normalizedAnswersByQuestion: Record<string, NormalizedAnswer>;
  transitions: FlowTransition[];
  finalState: FlowState;
  completionReference: string;
  answerDigest: string;
};

export type PreventiveHealthFlowEntryResult = {
  transitions: FlowTransition[];
  finalState: FlowState;
  expectedInput: ExpectedFlowInput;
  entryReference: string;
  entryDigest: string;
};

export type PreventiveHealthFlowFailureReason =
  | "contract_invalid"
  | "answers_invalid"
  | "answer_invalid"
  | "duplicate_answer"
  | "out_of_order_answer"
  | "stale_answer"
  | "flow_state_invalid"
  | "transition_invalid";

export type PreventiveHealthFlowRunOutcome =
  | { ok: true; result: PreventiveHealthFlowRunResult }
  | { ok: false; reasonCode: PreventiveHealthFlowFailureReason };

export type PreventiveHealthFlowEntryOutcome =
  | { ok: true; result: PreventiveHealthFlowEntryResult }
  | { ok: false; reasonCode: "contract_invalid" | "flow_state_invalid" };

function expectedInput(
  question: PreventiveHealthQuestionDefinition,
  contract: PreventiveHealthRuntimeContract,
): ExpectedFlowInput {
  return {
    questionId: question.questionId,
    sceneId: contract.sceneId,
    flowVersion: contract.flowVersion,
    answerKind: "option",
    options: [...question.options],
  };
}

function comparable(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase()
    .replace(/[.!?;:]+$/g, "")
    .replace(/\s+/g, " ");
}

function tokenizeMultiValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string | number => typeof item === "string" || typeof item === "number")
      .map(String);
  }
  if (typeof value === "string") {
    return value
      .split(/,|\by\b|\band\b|\+/i)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function optionMatches(option: AnswerOption, value: string): boolean {
  const normalized = comparable(value);
  return [option.id, option.label, ...option.voiceAliases].some((candidate) =>
    comparable(candidate) === normalized);
}

function normalizeSingleOption(
  question: PreventiveHealthQuestionDefinition,
  submission: PreventiveHealthAnswerSubmission,
  contract: PreventiveHealthRuntimeContract,
): NormalizedAnswer | null {
  if (submission.modality !== "voice" && submission.modality !== "touch" && submission.modality !== "text") {
    return null;
  }
  try {
    if (submission.modality === "voice") {
      if (!submission.transcript) return null;
      return normalizeAnswer(expectedInput(question, contract), {
        modality: "voice",
        transcript: submission.transcript,
        questionId: submission.questionId,
        sceneId: submission.sceneId,
        flowVersion: submission.flowVersion,
      });
    }
    if (submission.modality === "touch") {
      if (!submission.answerId) return null;
      return normalizeAnswer(expectedInput(question, contract), {
        modality: "touch",
        answerId: submission.answerId,
        questionId: submission.questionId,
        sceneId: submission.sceneId,
        flowVersion: submission.flowVersion,
      });
    }
    if (!submission.text) return null;
    return normalizeAnswer(expectedInput(question, contract), {
      modality: "text",
      text: submission.text,
      questionId: submission.questionId,
      sceneId: submission.sceneId,
      flowVersion: submission.flowVersion,
    });
  } catch {
    return null;
  }
}

function normalizeMultiOption(
  question: PreventiveHealthQuestionDefinition,
  submission: PreventiveHealthAnswerSubmission,
  contract: PreventiveHealthRuntimeContract,
): NormalizedAnswer | null {
  if (submission.modality !== "voice" && submission.modality !== "touch" && submission.modality !== "text") {
    return null;
  }
  if (
    submission.flowVersion !== contract.flowVersion ||
    submission.sceneId !== contract.sceneId ||
    submission.questionId !== question.questionId
  ) {
    return null;
  }

  const rawValue = submission.modality === "voice"
    ? submission.transcript
    : submission.modality === "text"
      ? submission.text
      : submission.value ?? submission.answerId;
  const fullMatch = typeof rawValue === "string"
    ? question.options.find((option) => optionMatches(option, rawValue))
    : undefined;
  const candidates = fullMatch ? [fullMatch.id] : tokenizeMultiValue(rawValue);
  const normalizedIds = candidates.map((candidate) =>
    question.options.find((option) => optionMatches(option, candidate))?.id);
  if (normalizedIds.some((id) => id === undefined)) return null;

  const values = Array.from(new Set(normalizedIds as string[]));
  const value = values.includes("ninguno")
    ? ["ninguno"]
    : values;
  return {
    questionId: question.questionId,
    answerKind: "option",
    value,
  };
}

export function normalizePreventiveHealthAnswer(
  rawSubmission: unknown,
  contract = resolvePreventiveHealthRuntimeContract(),
): NormalizedAnswer | null {
  if (!contract) return null;
  const parsed = submissionSchema.safeParse(rawSubmission);
  if (!parsed.success) return null;
  const submission = parsed.data;
  const question = contract.questions.find(
    (item) => item.questionId === submission.questionId,
  );
  if (!question) return null;
  return question.answerMode === "single_option"
    ? normalizeSingleOption(question, submission, contract)
    : normalizeMultiOption(question, submission, contract);
}

function answersFromNormalized(
  normalizedByQuestion: Record<string, NormalizedAnswer>,
  contract: PreventiveHealthRuntimeContract,
): PreventiveHealthAnswers | null {
  const byKey = Object.fromEntries(
    contract.questions.map((question) => [
      question.key,
      normalizedByQuestion[question.questionId]?.value,
    ]),
  ) as Partial<Record<PreventiveHealthQuestionKey, unknown>>;

  const parsed = preventiveHealthAnswersSchema.safeParse({
    energy_level: byKey.energy_level,
    mood: byKey.mood,
    body_areas: byKey.body_areas ?? [],
    sleep_quality: byKey.sleep_quality,
    symptoms: byKey.symptoms ?? [],
    symptom_details: byKey.symptom_details ?? [],
    safety_flags: byKey.safety_flags ?? [],
    social_contact: byKey.social_contact,
  });
  return parsed.success ? parsed.data : null;
}

function normalizedFromAnswers(
  answers: PreventiveHealthAnswers,
  contract: PreventiveHealthRuntimeContract,
): Record<string, NormalizedAnswer> {
  return Object.fromEntries(
    contract.questions.map((question) => {
      const value = answers[question.key];
      const answerId = typeof value === "string"
        ? value
        : typeof value === "number"
          ? question.options.find((option) => option.value === value)?.id
          : undefined;
      return [
        question.questionId,
        {
          questionId: question.questionId,
          ...(answerId !== undefined ? { answerId } : {}),
          answerKind: "option" as const,
          value,
        },
      ];
    }),
  );
}

function canonicalMultiValues(
  question: PreventiveHealthQuestionDefinition,
  values: string[],
): string[] {
  if (values.includes("ninguno")) return ["ninguno"];
  const allowed = new Set(question.options.map((option) => option.id));
  const unique = Array.from(new Set(values.filter((value) => allowed.has(value))));
  return question.options
    .map((option) => option.id)
    .filter((id) => unique.includes(id));
}

function canonicalizeAnswers(
  answers: PreventiveHealthAnswers,
  contract: PreventiveHealthRuntimeContract,
): PreventiveHealthAnswers | null {
  const canonical = { ...answers };
  for (const question of contract.questions) {
    const value = canonical[question.key];
    if (question.answerMode === "single_option") {
      const accepted = question.options.some((option) =>
        option.value === value || option.id === value);
      if (!accepted) return null;
      continue;
    }
    if (!Array.isArray(value)) return null;
    canonical[question.key] = canonicalMultiValues(question, value) as never;
  }
  return canonical;
}

function deterministicId(prefix: string, facts: unknown): string {
  const digest = createHash("sha256")
    .update(JSON.stringify({ prefix, digest: eventStateCanonicalDigest(facts) }))
    .digest("hex")
    .slice(0, 32);
  return `${prefix}.${digest}`;
}

function transition(
  from: FlowLifecycleState,
  to: FlowLifecycleState,
  occurredAt: string,
  eventId: string,
  reason: string,
  contract: PreventiveHealthRuntimeContract,
): FlowTransition {
  return parseFlowTransition({
    flowId: contract.flowId,
    flowVersion: contract.flowVersion,
    from,
    to,
    occurredAt,
    eventId,
    reason,
  });
}

function buildRunResult(input: {
  userId: string;
  profileId?: string;
  sessionId: string;
  occurredAt: string;
  normalizedAnswers: PreventiveHealthAnswers;
  normalizedAnswersByQuestion: Record<string, NormalizedAnswer>;
  modality: AnswerSubmissionModality;
  contract: PreventiveHealthRuntimeContract;
}): PreventiveHealthFlowRunResult {
  const answerDigest = eventStateCanonicalDigest({
    flowId: input.contract.flowId,
    flowVersion: input.contract.flowVersion,
    normalizedAnswers: input.normalizedAnswers,
  });
  const completionReference = deterministicId("completion.health.preventive_check", {
    answerDigest,
    userId: input.userId,
    sessionId: input.sessionId,
  });
  const baseEventFacts = {
    completionReference,
    sessionId: input.sessionId,
    answerDigest,
  };
  const transitions = [
    transition("idle", "initializing", input.occurredAt, deterministicId("event.health.preventive_check.started", baseEventFacts), "health.preventive_check.start", input.contract),
    transition("initializing", "active", input.occurredAt, deterministicId("event.health.preventive_check.active", baseEventFacts), "health.preventive_check.initialized", input.contract),
    transition("active", "waiting_for_user", input.occurredAt, deterministicId("event.health.preventive_check.waiting", baseEventFacts), "health.preventive_check.collect_answers", input.contract),
    transition("waiting_for_user", "active", input.occurredAt, deterministicId("event.health.preventive_check.answers", baseEventFacts), "health.preventive_check.answers_normalized", input.contract),
    transition("active", "completed", input.occurredAt, deterministicId("event.health.preventive_check.completed", baseEventFacts), "health.preventive_check.completed", input.contract),
  ];
  const finalState = parseFlowState({
    flowId: input.contract.flowId,
    flowVersion: input.contract.flowVersion,
    state: "completed",
    sessionId: input.sessionId,
    userId: input.userId,
    context: {
      completionOutcome: {
        completionReference,
        answerDigest,
        result: "structured_checkin_saved",
      },
      metadata: {
        flowRuntimeVersion: input.contract.flowVersion,
        canonicalCatalogueFlowId: input.contract.flowId,
        canonicalCatalogueVersion: input.contract.catalogueVersion,
        canonicalPresentationRegistryVersion: input.contract.presentationRegistryVersion,
        canonicalSceneId: input.contract.sceneId,
      },
    },
    updatedAt: input.occurredAt,
  });
  return {
    normalizedAnswers: input.normalizedAnswers,
    normalizedAnswersByQuestion: input.normalizedAnswersByQuestion,
    transitions,
    finalState,
    completionReference,
    answerDigest,
  };
}

function buildEntryResult(input: {
  userId: string;
  profileId?: string;
  sessionId: string;
  occurredAt: string;
  triggerReference: string;
  contract: PreventiveHealthRuntimeContract;
}): PreventiveHealthFlowEntryResult {
  const firstQuestion = input.contract.questions[0];
  if (!firstQuestion) throw new Error("preventive health entry question missing");
  const entryDigest = eventStateCanonicalDigest({
    flowId: input.contract.flowId,
    flowVersion: input.contract.flowVersion,
    userId: input.userId,
    profileId: input.profileId ?? null,
    sessionId: input.sessionId,
    triggerReference: input.triggerReference,
  });
  const entryReference = deterministicId("entry.health.preventive_check", {
    entryDigest,
    triggerReference: input.triggerReference,
    sessionId: input.sessionId,
  });
  const baseEventFacts = {
    entryReference,
    sessionId: input.sessionId,
    entryDigest,
  };
  const transitions = [
    transition("idle", "initializing", input.occurredAt, deterministicId("event.health.preventive_check.entry.initializing", baseEventFacts), "health.preventive_check.entry.start", input.contract),
    transition("initializing", "active", input.occurredAt, deterministicId("event.health.preventive_check.entry.active", baseEventFacts), "health.preventive_check.entry.initialized", input.contract),
    transition("active", "waiting_for_user", input.occurredAt, deterministicId("event.health.preventive_check.entry.waiting", baseEventFacts), "health.preventive_check.entry.awaiting_first_answer", input.contract),
  ];
  const expected = expectedInput(firstQuestion, input.contract);
  const finalState = parseFlowState({
    flowId: input.contract.flowId,
    flowVersion: input.contract.flowVersion,
    state: "waiting_for_user",
    sessionId: input.sessionId,
    userId: input.userId,
    expectedInput: expected,
    context: {
      entryOutcome: {
        entryReference,
        entryDigest,
        result: "preventive_health_flow_waiting_for_first_answer",
      },
      metadata: {
        flowRuntimeVersion: input.contract.flowVersion,
        canonicalCatalogueFlowId: input.contract.flowId,
        canonicalCatalogueVersion: input.contract.catalogueVersion,
        canonicalPresentationRegistryVersion: input.contract.presentationRegistryVersion,
        canonicalSceneId: input.contract.sceneId,
        triggerReference: input.triggerReference,
      },
    },
    updatedAt: input.occurredAt,
  });
  return {
    transitions,
    finalState,
    expectedInput: expected,
    entryReference,
    entryDigest,
  };
}

export function startPreventiveHealthFlowEntry(input: {
  userId: string;
  profileId?: string;
  sessionId: string;
  occurredAt: string;
  triggerReference: string;
  catalogue?: FlowCatalogue;
  presentationRegistry?: PresentationRegistry;
}): PreventiveHealthFlowEntryOutcome {
  const contract = resolvePreventiveHealthRuntimeContract({
    catalogue: input.catalogue,
    presentationRegistry: input.presentationRegistry,
  });
  if (!contract) return { ok: false, reasonCode: "contract_invalid" };
  try {
    return {
      ok: true,
      result: buildEntryResult({
        userId: input.userId,
        ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
        sessionId: input.sessionId,
        occurredAt: input.occurredAt,
        triggerReference: input.triggerReference,
        contract,
      }),
    };
  } catch {
    return { ok: false, reasonCode: "flow_state_invalid" };
  }
}

export function runPreventiveHealthFlowFromAnswers(input: {
  userId: string;
  profileId?: string;
  sessionId: string;
  occurredAt: string;
  answers: unknown;
  modality?: AnswerSubmissionModality;
  catalogue?: FlowCatalogue;
  presentationRegistry?: PresentationRegistry;
}): PreventiveHealthFlowRunOutcome {
  const contract = resolvePreventiveHealthRuntimeContract({
    catalogue: input.catalogue,
    presentationRegistry: input.presentationRegistry,
  });
  if (!contract) return { ok: false, reasonCode: "contract_invalid" };
  const parsedAnswers = preventiveHealthAnswersSchema.safeParse(input.answers);
  if (!parsedAnswers.success) return { ok: false, reasonCode: "answers_invalid" };
  const normalizedAnswers = canonicalizeAnswers(parsedAnswers.data, contract);
  if (!normalizedAnswers) return { ok: false, reasonCode: "answers_invalid" };
  try {
    return {
      ok: true,
      result: buildRunResult({
        userId: input.userId,
        ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
        sessionId: input.sessionId,
        occurredAt: input.occurredAt,
        normalizedAnswers,
        normalizedAnswersByQuestion: normalizedFromAnswers(normalizedAnswers, contract),
        modality: input.modality ?? "touch",
        contract,
      }),
    };
  } catch {
    return { ok: false, reasonCode: "flow_state_invalid" };
  }
}

export function runPreventiveHealthFlowFromSubmissions(input: {
  userId: string;
  profileId?: string;
  sessionId: string;
  occurredAt: string;
  submissions: readonly unknown[];
  modality?: AnswerSubmissionModality;
  catalogue?: FlowCatalogue;
  presentationRegistry?: PresentationRegistry;
}): PreventiveHealthFlowRunOutcome {
  const contract = resolvePreventiveHealthRuntimeContract({
    catalogue: input.catalogue,
    presentationRegistry: input.presentationRegistry,
  });
  if (!contract) return { ok: false, reasonCode: "contract_invalid" };
  const normalizedByQuestion: Record<string, NormalizedAnswer> = {};
  let questionIndex = 0;
  for (const rawSubmission of input.submissions) {
    const parsed = submissionSchema.safeParse(rawSubmission);
    if (!parsed.success) return { ok: false, reasonCode: "answer_invalid" };
    const expectedQuestion = contract.questions[questionIndex];
    if (!expectedQuestion) return { ok: false, reasonCode: "out_of_order_answer" };
    if (normalizedByQuestion[parsed.data.questionId]) {
      return { ok: false, reasonCode: "duplicate_answer" };
    }
    if (
      parsed.data.flowVersion !== contract.flowVersion ||
      parsed.data.sceneId !== contract.sceneId
    ) {
      return { ok: false, reasonCode: "stale_answer" };
    }
    if (parsed.data.questionId !== expectedQuestion.questionId) {
      return contract.questions.some(
        (question) => question.questionId === parsed.data.questionId,
      )
        ? { ok: false, reasonCode: "out_of_order_answer" }
        : { ok: false, reasonCode: "stale_answer" };
    }
    const normalized = normalizePreventiveHealthAnswer(parsed.data, contract);
    if (!normalized) return { ok: false, reasonCode: "answer_invalid" };
    normalizedByQuestion[parsed.data.questionId] = normalized;
    questionIndex += 1;
  }
  if (questionIndex !== contract.questions.length) {
    return { ok: false, reasonCode: "out_of_order_answer" };
  }
  const normalizedAnswers = answersFromNormalized(normalizedByQuestion, contract);
  if (!normalizedAnswers) return { ok: false, reasonCode: "answers_invalid" };
  try {
    return {
      ok: true,
      result: buildRunResult({
        userId: input.userId,
        ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
        sessionId: input.sessionId,
        occurredAt: input.occurredAt,
        normalizedAnswers,
        normalizedAnswersByQuestion: normalizedByQuestion,
        modality: input.modality ?? "touch",
        contract,
      }),
    };
  } catch {
    return { ok: false, reasonCode: "transition_invalid" };
  }
}
