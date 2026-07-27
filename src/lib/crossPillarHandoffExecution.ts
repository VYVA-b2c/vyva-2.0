import type { NavigateOptions } from "react-router-dom";
import type {
  CrossPillarCompletionActionId,
  CrossPillarSubflowResult,
} from "@/components/voice-canvas/CrossPillarSubflowCanvas";
import { buildWorkflowReceiptMoment, type WorkflowReceiptMoment } from "../../shared/workflowReceiptMoments";
import {
  APP_WORKFLOW_REFERENCES,
  type WorkflowReference,
} from "../../shared/workflowRegistry";
import { CONCIERGE_FLOW_REFERENCES } from "../../shared/conciergeFlowRegistry";
import { conciergeTaskPath } from "@/lib/conciergeTaskNavigation";

export const CROSS_PILLAR_HANDOFF_STORAGE_KEY = "vyva.cross-pillar-handoffs.v1";
export const CROSS_PILLAR_ACTIVE_HANDOFF_KEY = "vyva.cross-pillar-handoff.active.v1";

type HandoffKind = "route" | "preparation" | "provider_setup";
type Pillar = "health" | "mind" | "community" | "concierge";
type ProviderFocus = "doctor_clinic" | "home_service" | "personal_care";

export type CrossPillarHandoffReadiness = {
  hasSavedDoctor?: boolean;
  hasSavedHomeServiceProvider?: boolean;
  hasSavedPersonalCareProvider?: boolean;
};

export type CrossPillarHandoffRecord = {
  id: string;
  version: 1;
  actionId: CrossPillarCompletionActionId;
  optionId: string;
  optionLabel: string;
  pillar: Pillar;
  workflowReference: WorkflowReference;
  kind: HandoffKind;
  destinationPath: string;
  destinationState: Record<string, unknown>;
  returnPath: string;
  status: "opened" | "prepared" | "setup_required";
  receipt: WorkflowReceiptMoment;
  createdAt: string;
};

export type CrossPillarHandoffInput = {
  result: CrossPillarSubflowResult;
  locale?: string;
  readiness?: CrossPillarHandoffReadiness;
  doctorContext?: unknown;
  now?: string;
};

type ActionDefinition = {
  pillar: Pillar;
  workflowReference: WorkflowReference;
  route: string;
  kind?: HandoffKind;
  providerFocus?: ProviderFocus;
  providerReadinessKey?: keyof CrossPillarHandoffReadiness;
  stateKey?: string;
};

const ACTIONS: Record<CrossPillarCompletionActionId, ActionDefinition> = {
  "health-symptoms": {
    pillar: "health",
    workflowReference: APP_WORKFLOW_REFERENCES.symptomCheck,
    route: "/health/symptom-check",
    stateKey: "detailPreference",
  },
  "health-vitals": {
    pillar: "health",
    workflowReference: APP_WORKFLOW_REFERENCES.vitalsTracking,
    route: "/health/vitals",
    stateKey: "detailPreference",
  },
  "health-meds": {
    pillar: "health",
    workflowReference: APP_WORKFLOW_REFERENCES.medicationPlan,
    route: "/meds",
    stateKey: "detailPreference",
  },
  "health-doctor": {
    pillar: "health",
    workflowReference: APP_WORKFLOW_REFERENCES.doctorNextStep,
    route: "/concierge",
    kind: "preparation",
    providerFocus: "doctor_clinic",
    providerReadinessKey: "hasSavedDoctor",
  },
  "health-prevention": {
    pillar: "health",
    workflowReference: APP_WORKFLOW_REFERENCES.healthPrevention,
    route: "/health/prevention",
    stateKey: "activityPreference",
  },
  "health-visual-scan": {
    pillar: "health",
    workflowReference: APP_WORKFLOW_REFERENCES.visualScan,
    route: "/health",
    stateKey: "detailPreference",
  },
  "mind-memory": {
    pillar: "mind",
    workflowReference: APP_WORKFLOW_REFERENCES.memoryGames,
    route: "/memory-games",
    stateKey: "cognitiveActivityPreference",
  },
  "mind-reflexes": {
    pillar: "mind",
    workflowReference: APP_WORKFLOW_REFERENCES.attentionTraining,
    route: "/attention-boosters",
    stateKey: "cognitiveActivityPreference",
  },
  "mind-focus": {
    pillar: "mind",
    workflowReference: APP_WORKFLOW_REFERENCES.executiveFunction,
    route: "/executive-function",
    stateKey: "cognitiveActivityPreference",
  },
  "mind-senses": {
    pillar: "mind",
    workflowReference: APP_WORKFLOW_REFERENCES.sharpenSenses,
    route: "/senses",
    stateKey: "cognitiveActivityPreference",
  },
  "community-friends": {
    pillar: "community",
    workflowReference: APP_WORKFLOW_REFERENCES.socialMatch,
    route: "/social-rooms/kitchen-table",
    stateKey: "communityPreference",
  },
  "community-experts": {
    pillar: "community",
    workflowReference: APP_WORKFLOW_REFERENCES.socialAdvisor,
    route: "/social-rooms/experts",
    stateKey: "communityPreference",
  },
  "community-share": {
    pillar: "community",
    workflowReference: APP_WORKFLOW_REFERENCES.shareStory,
    route: "/social-rooms/share",
    stateKey: "communityPreference",
  },
  "community-activities": {
    pillar: "community",
    workflowReference: APP_WORKFLOW_REFERENCES.communityActivities,
    route: "/social-rooms/activities",
    stateKey: "communityPreference",
  },
  "concierge-home": {
    pillar: "concierge",
    workflowReference: CONCIERGE_FLOW_REFERENCES.homeService,
    route: "/concierge/task/new",
    kind: "preparation",
    providerFocus: "home_service",
    providerReadinessKey: "hasSavedHomeServiceProvider",
  },
  "concierge-care": {
    pillar: "concierge",
    workflowReference: CONCIERGE_FLOW_REFERENCES.careNavigation,
    route: "/concierge/task/new",
    kind: "preparation",
    providerFocus: "personal_care",
    providerReadinessKey: "hasSavedPersonalCareProvider",
  },
  "concierge-order": {
    pillar: "concierge",
    workflowReference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
    route: "/concierge/shopping",
    kind: "preparation",
  },
  "concierge-book": {
    pillar: "concierge",
    workflowReference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
    route: "/concierge",
    kind: "preparation",
    providerFocus: "doctor_clinic",
    providerReadinessKey: "hasSavedDoctor",
  },
};

function recordId(actionId: CrossPillarCompletionActionId, now: string): string {
  return `${actionId}:${now}`;
}

function isSpanish(locale: string | undefined): boolean {
  return locale?.toLowerCase().startsWith("es") ?? false;
}

function requiresMissingProviderSetup(
  definition: ActionDefinition,
  optionId: string,
  readiness: CrossPillarHandoffReadiness,
): boolean {
  return optionId === "saved-provider" || optionId === "usual-provider"
    ? Boolean(definition.providerReadinessKey && readiness[definition.providerReadinessKey] === false)
    : false;
}

function providerSetupPath(focus: ProviderFocus): string {
  return `/onboarding/profile/providers?focus=${encodeURIComponent(focus)}`;
}

function destinationState(
  input: CrossPillarHandoffInput,
  definition: ActionDefinition,
): Record<string, unknown> {
  const shared = {
    source: "home_completion_canvas",
    workflowReference: definition.workflowReference,
    originalActionId: input.result.actionId,
    originalOptionId: input.result.optionId,
    returnTo: "/",
    resumeAfterSetup: true,
  };

  if (definition.providerFocus) {
    Object.assign(shared, {
      setupFocus: definition.providerFocus,
      returnState: {
        source: "home_completion_canvas",
        workflowReference: definition.workflowReference,
        originalActionId: input.result.actionId,
        originalOptionId: input.result.optionId,
        resumeAfterSetup: true,
      },
    });
  }

  if (input.result.actionId === "health-doctor" || input.result.actionId === "concierge-book") {
    return {
      ...shared,
      conciergePrefill: {
        kind: "appointment",
        message: input.result.actionId === "health-doctor"
          ? "Help me prepare a doctor appointment. Ask for the reason and timing, and do not contact anyone without my confirmation."
          : "Help me prepare an appointment. Ask for the reason, provider, and timing, and do not contact or book anyone without my confirmation.",
        flowReference: input.result.actionId === "health-doctor"
          ? CONCIERGE_FLOW_REFERENCES.medicalAppointment
          : definition.workflowReference,
        source: "voice_action",
      },
      voiceActionPayload: {
        provider_preference: input.result.optionId,
        ...(input.result.actionId === "health-doctor" ? { latest_symptom_report: input.doctorContext } : {}),
      },
    };
  }

  if (input.result.actionId === "health-visual-scan") {
    return { ...shared, openVisualScan: true, detailPreference: input.result.optionId };
  }

  if (input.result.actionId === "concierge-home" || input.result.actionId === "concierge-care") {
    return {
      ...shared,
      conciergeTaskEntry: {
        kind: input.result.actionId === "concierge-home" ? "home_service" : "provider_contact",
        providerSearchMode: input.result.actionId === "concierge-care" ? "personal-care" : undefined,
        provider_preference: input.result.optionId,
        flowReference: definition.workflowReference,
        source: "home_completion_canvas",
      },
    };
  }

  if (input.result.actionId === "concierge-order") {
    return { ...shared, providerPreference: input.result.optionId };
  }

  return {
    ...shared,
    ...(definition.stateKey ? { [definition.stateKey]: input.result.optionId } : {}),
  };
}

export function buildCrossPillarHandoff(input: CrossPillarHandoffInput): CrossPillarHandoffRecord {
  const definition = ACTIONS[input.result.actionId];
  const now = input.now ?? new Date().toISOString();
  const missingProvider = requiresMissingProviderSetup(
    definition,
    input.result.optionId,
    input.readiness ?? {},
  );
  const kind: HandoffKind = missingProvider ? "provider_setup" : definition.kind ?? "route";
  const path = missingProvider && definition.providerFocus
    ? providerSetupPath(definition.providerFocus)
    : definition.route === "/concierge/task/new"
      ? conciergeTaskPath()
      : definition.route;
  const state = destinationState(input, definition);
  const spanish = isSpanish(input.locale);
  const status = missingProvider ? "setup_required" : kind === "route" ? "opened" : "prepared";
  const nextStep = missingProvider
    ? (spanish
      ? "Añade tu proveedor habitual o busca opciones. Después volverás a esta tarea."
      : "Add your usual provider or find options. You will then return to this task.")
    : kind === "route"
      ? (spanish ? "Continúa en la pantalla que se ha abierto." : "Continue on the screen that opened.")
      : (spanish
        ? "Revisa los detalles. Nada se enviará ni reservará sin tu confirmación."
        : "Review the details. Nothing will be sent or booked without your confirmation.");
  const receipt = buildWorkflowReceiptMoment({
    workflowReference: definition.workflowReference,
    status: missingProvider ? "needs_review" : kind === "route" ? "done" : "prepared",
    actionLabel: input.result.optionLabel,
    capturedSummary: missingProvider
      ? (spanish ? "Falta un proveedor guardado. Tu elección sigue guardada." : "A saved provider is missing. Your choice is still saved.")
      : kind === "route"
        ? (spanish ? "VYVA abrió el siguiente paso." : "VYVA opened the next step.")
        : (spanish ? "VYVA preparó el siguiente paso." : "VYVA prepared the next step."),
    nextStep,
    details: [
      {
        key: "choice",
        label: spanish ? "Tu elección" : "Your choice",
        value: input.result.optionLabel,
      },
    ],
    locale: spanish ? "es" : "en",
  });

  return {
    id: recordId(input.result.actionId, now),
    version: 1,
    actionId: input.result.actionId,
    optionId: input.result.optionId,
    optionLabel: input.result.optionLabel,
    pillar: definition.pillar,
    workflowReference: definition.workflowReference,
    kind,
    destinationPath: path,
    destinationState: {
      ...state,
      crossPillarHandoffId: recordId(input.result.actionId, now),
      crossPillarReceipt: receipt,
    },
    returnPath: "/",
    status,
    receipt,
    createdAt: now,
  };
}

function storageOrNull(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function persistCrossPillarHandoff(
  handoff: CrossPillarHandoffRecord,
  storage: Storage | null = storageOrNull(),
): void {
  if (!storage) return;
  let history: CrossPillarHandoffRecord[] = [];
  try {
    const parsed = JSON.parse(storage.getItem(CROSS_PILLAR_HANDOFF_STORAGE_KEY) ?? "[]");
    history = Array.isArray(parsed) ? parsed : [];
  } catch {
    history = [];
  }
  storage.setItem(
    CROSS_PILLAR_HANDOFF_STORAGE_KEY,
    JSON.stringify([handoff, ...history.filter((item) => item?.id !== handoff.id)].slice(0, 30)),
  );
  storage.setItem(CROSS_PILLAR_ACTIVE_HANDOFF_KEY, JSON.stringify(handoff));
}

export function executeCrossPillarHandoff(
  input: CrossPillarHandoffInput,
  navigate: (path: string, options?: NavigateOptions) => boolean | void,
): CrossPillarHandoffRecord {
  const handoff = buildCrossPillarHandoff(input);
  persistCrossPillarHandoff(handoff);
  navigate(handoff.destinationPath, { state: handoff.destinationState });
  return handoff;
}
