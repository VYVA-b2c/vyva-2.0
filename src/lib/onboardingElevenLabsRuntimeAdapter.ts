import {
  buildOnboardingElevenLabsSystemPrompt,
  classifyOnboardingAgentEffect,
  createOnboardingElevenLabsSessionContext,
  onboardingElevenLabsSchemaForSection,
  ONBOARDING_ELEVENLABS_AGENT_CONTRACT,
  validateOnboardingElevenLabsOutput,
  type OnboardingElevenLabsAgentOutput,
  type OnboardingElevenLabsDraftOutput,
  type OnboardingElevenLabsSessionContextInput,
  type OnboardingElevenLabsOutputValidation,
} from "@/lib/onboardingElevenLabsAgentContract";
import type { ProfileOnboardingAgentSectionId } from "@/components/onboarding/profileOnboardingAgentSections";
import type { ProfileVoiceCommand, ProfileVoiceDraft } from "@/lib/profileVoiceCompletion";

export const VYVA_ONBOARDING_ELEVENLABS_OUTPUT_EVENT = "vyva:onboarding-elevenlabs-output";

type DynamicVariableValue = string | number | boolean;

export interface OnboardingElevenLabsRuntimeStartRequest {
  contextHint: string;
  systemPrompt: string;
  options: {
    agentSlug: typeof ONBOARDING_ELEVENLABS_AGENT_CONTRACT.agentSlug;
    autoStartListening: true;
    dynamicVariables: Record<string, DynamicVariableValue>;
  };
}

export type OnboardingElevenLabsRuntimeEvent =
  | {
      type: "draft";
      sectionId: ProfileOnboardingAgentSectionId;
      draft: ProfileVoiceDraft;
      output: OnboardingElevenLabsDraftOutput;
    }
  | {
      type: "command";
      sectionId: ProfileOnboardingAgentSectionId;
      command: ProfileVoiceCommand | { section: ProfileOnboardingAgentSectionId; kind: "confirm-locally"; target?: string };
      output: Extract<OnboardingElevenLabsAgentOutput, { eventType: "command" }>;
    }
  | {
      type: "clarification";
      sectionId: ProfileOnboardingAgentSectionId;
      question: string;
      missingFields: string[];
      output: Extract<OnboardingElevenLabsAgentOutput, { eventType: "clarification" }>;
    }
  | {
      type: "status";
      sectionId: ProfileOnboardingAgentSectionId;
      voiceStatus: "listening" | "thinking" | "error";
      message?: string;
      output: Extract<OnboardingElevenLabsAgentOutput, { eventType: "status" }>;
    };

export type OnboardingElevenLabsRuntimeDispatchResult =
  | { ok: true; event: OnboardingElevenLabsRuntimeEvent }
  | { ok: false; reason: string };

function stableDraftId(output: OnboardingElevenLabsDraftOutput) {
  const rowSignature = output.draft.rows
    .map((row) => `${row.id}:${row.value}`)
    .join("|")
    .toLowerCase();
  return `${output.sectionId}:${output.draft.kind}:${rowSignature}`;
}

function cleanStringMetadata(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0)
    .map(([key, entryValue]) => [key, entryValue.trim()] as const);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function createOnboardingElevenLabsRuntimeStartRequest({
  sectionConfig,
  language,
  mode,
  existingProfileSummary,
  activeDraftId,
}: OnboardingElevenLabsSessionContextInput): OnboardingElevenLabsRuntimeStartRequest {
  const context = createOnboardingElevenLabsSessionContext({
    sectionConfig,
    language,
    mode,
    existingProfileSummary,
    activeDraftId,
  });
  const sectionSchema = onboardingElevenLabsSchemaForSection(sectionConfig.sectionId);
  const dynamicVariables: Record<string, DynamicVariableValue> = {
    ...context,
    app_entrypoint: "onboarding-profile",
    active_section_schema_json: JSON.stringify(sectionSchema),
    onboarding_output_schema_json: JSON.stringify(ONBOARDING_ELEVENLABS_AGENT_CONTRACT.outputSchema),
    onboarding_agent_contract_json: JSON.stringify({
      id: ONBOARDING_ELEVENLABS_AGENT_CONTRACT.id,
      agentSlug: ONBOARDING_ELEVENLABS_AGENT_CONTRACT.agentSlug,
      conversationPlanId: ONBOARDING_ELEVENLABS_AGENT_CONTRACT.conversationPlanId,
      safetyRules: ONBOARDING_ELEVENLABS_AGENT_CONTRACT.safetyRules,
    }),
  };

  return {
    contextHint: sectionConfig.voicePrompt,
    systemPrompt: buildOnboardingElevenLabsSystemPrompt(),
    options: {
      agentSlug: ONBOARDING_ELEVENLABS_AGENT_CONTRACT.agentSlug,
      autoStartListening: true,
      dynamicVariables,
    },
  };
}

export function profileVoiceDraftFromOnboardingElevenLabsOutput(
  output: OnboardingElevenLabsDraftOutput,
): ProfileVoiceDraft {
  return {
    id: stableDraftId(output),
    section: output.sectionId,
    kind: output.draft.kind,
    title: output.draft.title?.trim() || output.draft.kind,
    helper: output.draft.helper?.trim() || "",
    rows: output.draft.rows,
    values: output.draft.values?.filter(Boolean) ?? output.draft.rows.map((row) => row.value),
    metadata: cleanStringMetadata(output.draft.metadata),
  };
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export function normalizeOnboardingElevenLabsToolPayload(parameters: unknown): unknown {
  const parsed = parseMaybeJson(parameters);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;

  const record = parsed as Record<string, unknown>;
  return parseMaybeJson(
    record.output ??
    record.payload ??
    record.event ??
    record.structured_output ??
    record.structuredOutput ??
    record.json ??
    record,
  );
}

export function adaptOnboardingElevenLabsOutput(
  value: unknown,
): OnboardingElevenLabsRuntimeDispatchResult {
  const validation: OnboardingElevenLabsOutputValidation = validateOnboardingElevenLabsOutput(
    normalizeOnboardingElevenLabsToolPayload(value),
  );
  if (!validation.ok) return { ok: false, reason: validation.reason };

  const effect = classifyOnboardingAgentEffect({
    source: "elevenlabs-agent",
    output: validation.output,
  });
  if (effect.mayPersistProfileData || effect.mayTriggerExternalAction) {
    return { ok: false, reason: "ElevenLabs onboarding output attempted an app-side effect." };
  }

  const output = validation.output;
  if (output.eventType === "draft") {
    return {
      ok: true,
      event: {
        type: "draft",
        sectionId: output.sectionId,
        draft: profileVoiceDraftFromOnboardingElevenLabsOutput(output),
        output,
      },
    };
  }

  if (output.eventType === "command") {
    return {
      ok: true,
      event: {
        type: "command",
        sectionId: output.sectionId,
        command: {
          section: output.sectionId,
          kind: output.command.kind,
          ...(output.command.target ? { target: output.command.target } : {}),
        },
        output,
      },
    };
  }

  if (output.eventType === "clarification") {
    return {
      ok: true,
      event: {
        type: "clarification",
        sectionId: output.sectionId,
        question: output.question,
        missingFields: output.missingFields ?? [],
        output,
      },
    };
  }

  return {
    ok: true,
    event: {
      type: "status",
      sectionId: output.sectionId,
      voiceStatus: output.voiceStatus,
      ...(output.message ? { message: output.message } : {}),
      output,
    },
  };
}

export function dispatchOnboardingElevenLabsOutput(
  parameters: unknown,
): OnboardingElevenLabsRuntimeDispatchResult {
  const result = adaptOnboardingElevenLabsOutput(parameters);
  if (!result.ok) return result;

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<OnboardingElevenLabsRuntimeEvent>(
        VYVA_ONBOARDING_ELEVENLABS_OUTPUT_EVENT,
        { detail: result.event },
      ),
    );
  }
  return result;
}

export function subscribeOnboardingElevenLabsRuntimeEvents(
  sectionId: ProfileOnboardingAgentSectionId,
  handler: (event: OnboardingElevenLabsRuntimeEvent) => void,
) {
  if (typeof window === "undefined") return () => undefined;

  const listener = (event: Event) => {
    const detail = (event as CustomEvent<OnboardingElevenLabsRuntimeEvent>).detail;
    if (!detail || detail.sectionId !== sectionId) return;
    handler(detail);
  };

  window.addEventListener(VYVA_ONBOARDING_ELEVENLABS_OUTPUT_EVENT, listener);
  return () => window.removeEventListener(VYVA_ONBOARDING_ELEVENLABS_OUTPUT_EVENT, listener);
}
