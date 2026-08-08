import {
  CONCIERGE_FLOW_REFERENCES,
  CONCIERGE_FLOW_REGISTRY,
  type ConciergeFlowReference,
} from "../../shared/conciergeFlowRegistry";
import { VYVA_PRESENTATION_REGISTRY } from "../../shared/orchestration/presentationRegistry";
import {
  getScreenContract,
  type ScreenContractId,
  type ScreenPrimarySurface,
  type ScreenTemplateKind,
} from "./screenContracts";

export type TrustedHelpServiceId =
  | "groceries"
  | "home-care"
  | "transport"
  | "wellness"
  | "other";

export type TrustedHelpStepId =
  | "dashboard"
  | "service"
  | "subservice"
  | "provider"
  | "controls"
  | "review"
  | "active-mission";

export type TrustedHelpPresentationMoment =
  | "overview"
  | "choice"
  | "refinement-choice"
  | "provider-choice"
  | "control-choice"
  | "confirmation-review"
  | "progress-status";

export type TrustedHelpProviderSource = "own" | "partner" | "vyva-find";

export type TrustedHelpVoicePolicy =
  | "spoken-summary-only"
  | "conversation-prompt"
  | "hidden-in-voice";

export type TrustedHelpCoverage = "Water" | "Food" | "Household" | "Meals";

export type TrustedHelpBackendSource =
  | "user_providers"
  | "trusted_help_partners"
  | "concierge_pending"
  | "concierge_sessions"
  | "local_user_preferences";

export type TrustedHelpUiInstruction =
  | "show_summary"
  | "show_choice_question"
  | "show_confirmation"
  | "show_progress";

export type TrustedHelpAllowedTemplate = Extract<
  ScreenTemplateKind,
  "setupDashboard" | "guidedFlow" | "outputReview"
>;

export interface TrustedHelpPresentationStep {
  stepId: TrustedHelpStepId;
  label: string;
  moment: TrustedHelpPresentationMoment;
  screenContractId: Extract<ScreenContractId, "concierge">;
  template: TrustedHelpAllowedTemplate;
  presentationFamilyId: string;
  uiInstruction: TrustedHelpUiInstruction;
  primarySurface: ScreenPrimarySurface;
  purpose: string;
  voicePolicy: TrustedHelpVoicePolicy;
  cards: "visible" | "hidden" | "contextual";
  chips: "hidden";
  confirmationBoundary: "none" | "finalConfirmationBeforeExternalAction";
  next: readonly TrustedHelpStepId[];
}

export interface TrustedHelpSubservicePresentation {
  id: string;
  label: string;
  userMeaning: string;
}

export interface TrustedHelpServicePresentation {
  serviceId: TrustedHelpServiceId;
  label: string;
  description: string;
  flowReference: ConciergeFlowReference;
  entryStep: Extract<TrustedHelpStepId, "subservice" | "provider">;
  requiresSubservice: boolean;
  subservices: readonly TrustedHelpSubservicePresentation[];
  providerSources: readonly TrustedHelpProviderSource[];
  backendSources: readonly TrustedHelpBackendSource[];
  coverageDriven: boolean;
  coverageValues: readonly TrustedHelpCoverage[];
  safetyModel: "prepareThenConfirm";
}

export const TRUSTED_HELP_SCREEN_CONTRACT_ID = "concierge" as const;

export const TRUSTED_HELP_PROVIDER_SCOPE_EXCLUSIONS = [
  "health.medical_provider",
  "medication.pharmacy_provider",
  "clinical_care_provider",
] as const;

export const TRUSTED_HELP_PRESENTATION_STEPS = [
  {
    stepId: "dashboard",
    label: "Overview",
    moment: "overview",
    screenContractId: TRUSTED_HELP_SCREEN_CONTRACT_ID,
    template: "setupDashboard",
    presentationFamilyId: "presentation.family.summary",
    uiInstruction: "show_summary",
    primarySurface: "dashboard",
    purpose: "Show provider, order, and readiness status before setup.",
    voicePolicy: "spoken-summary-only",
    cards: "visible",
    chips: "hidden",
    confirmationBoundary: "none",
    next: ["service", "provider", "controls", "review"],
  },
  {
    stepId: "service",
    label: "Service",
    moment: "choice",
    screenContractId: TRUSTED_HELP_SCREEN_CONTRACT_ID,
    template: "guidedFlow",
    presentationFamilyId: "presentation.family.choice.single",
    uiInstruction: "show_choice_question",
    primarySurface: "singleStep",
    purpose: "Choose one concierge-only service.",
    voicePolicy: "conversation-prompt",
    cards: "visible",
    chips: "hidden",
    confirmationBoundary: "none",
    next: ["subservice", "provider"],
  },
  {
    stepId: "subservice",
    label: "Type",
    moment: "refinement-choice",
    screenContractId: TRUSTED_HELP_SCREEN_CONTRACT_ID,
    template: "guidedFlow",
    presentationFamilyId: "presentation.family.choice.single",
    uiInstruction: "show_choice_question",
    primarySurface: "singleStep",
    purpose: "Ask for a type only when the service needs one.",
    voicePolicy: "conversation-prompt",
    cards: "visible",
    chips: "hidden",
    confirmationBoundary: "none",
    next: ["provider"],
  },
  {
    stepId: "provider",
    label: "Provider",
    moment: "provider-choice",
    screenContractId: TRUSTED_HELP_SCREEN_CONTRACT_ID,
    template: "guidedFlow",
    presentationFamilyId: "presentation.family.choice.single",
    uiInstruction: "show_choice_question",
    primarySurface: "singleStep",
    purpose: "Choose own provider, VYVA partner, or VYVA search.",
    voicePolicy: "conversation-prompt",
    cards: "visible",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    next: ["controls"],
  },
  {
    stepId: "controls",
    label: "Controls",
    moment: "control-choice",
    screenContractId: TRUSTED_HELP_SCREEN_CONTRACT_ID,
    template: "guidedFlow",
    presentationFamilyId: "presentation.family.choice.single",
    uiInstruction: "show_choice_question",
    primarySurface: "singleStep",
    purpose: "Set approval, payment, caregiver, and spending rules.",
    voicePolicy: "conversation-prompt",
    cards: "visible",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    next: ["review"],
  },
  {
    stepId: "review",
    label: "Review",
    moment: "confirmation-review",
    screenContractId: TRUSTED_HELP_SCREEN_CONTRACT_ID,
    template: "outputReview",
    presentationFamilyId: "presentation.family.confirmation",
    uiInstruction: "show_confirmation",
    primarySurface: "answer",
    purpose: "Show exactly what VYVA may do before anything external happens.",
    voicePolicy: "spoken-summary-only",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    next: ["active-mission"],
  },
  {
    stepId: "active-mission",
    label: "Right now",
    moment: "progress-status",
    screenContractId: TRUSTED_HELP_SCREEN_CONTRACT_ID,
    template: "outputReview",
    presentationFamilyId: "presentation.family.progress",
    uiInstruction: "show_progress",
    primarySurface: "answer",
    purpose: "Track live VYVA work with user controls visible.",
    voicePolicy: "spoken-summary-only",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    next: ["dashboard"],
  },
] as const satisfies readonly TrustedHelpPresentationStep[];

export const TRUSTED_HELP_SERVICE_PRESENTATION_MAP = [
  {
    serviceId: "groceries",
    label: "Groceries",
    description: "Food, water, household",
    flowReference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
    entryStep: "provider",
    requiresSubservice: false,
    subservices: [
      {
        id: "supermarket",
        label: "Supermarket",
        userMeaning: "Food and household items.",
      },
      {
        id: "fresh-food",
        label: "Fresh food",
        userMeaning: "Produce, bakery, meat, and daily food.",
      },
      {
        id: "household",
        label: "Household",
        userMeaning: "Cleaning, toiletries, and water delivery.",
      },
    ],
    providerSources: ["own", "partner", "vyva-find"],
    backendSources: [
      "user_providers",
      "trusted_help_partners",
      "concierge_pending",
      "local_user_preferences",
    ],
    coverageDriven: true,
    coverageValues: ["Water", "Food", "Household", "Meals"],
    safetyModel: "prepareThenConfirm",
  },
  {
    serviceId: "home-care",
    label: "Home Care",
    description: "Repairs and cleaning",
    flowReference: CONCIERGE_FLOW_REFERENCES.homeService,
    entryStep: "subservice",
    requiresSubservice: true,
    subservices: [
      {
        id: "plumbing",
        label: "Plumber",
        userMeaning: "Leaks, drains, taps, toilets, and water problems.",
      },
      {
        id: "electrical",
        label: "Electrician",
        userMeaning: "Lights, sockets, power, and small electrical jobs.",
      },
      {
        id: "cleaning",
        label: "Cleaning",
        userMeaning: "Home cleaning, deep cleaning, and recurring help.",
      },
      {
        id: "safety-fixes",
        label: "Safety fixes",
        userMeaning: "Handrails, trip hazards, locks, and small home safety work.",
      },
    ],
    providerSources: ["own", "partner", "vyva-find"],
    backendSources: [
      "user_providers",
      "trusted_help_partners",
      "concierge_pending",
      "local_user_preferences",
    ],
    coverageDriven: false,
    coverageValues: [],
    safetyModel: "prepareThenConfirm",
  },
  {
    serviceId: "transport",
    label: "Transport",
    description: "Taxi or accessible ride",
    flowReference: CONCIERGE_FLOW_REFERENCES.transportBooking,
    entryStep: "subservice",
    requiresSubservice: true,
    subservices: [
      {
        id: "taxi",
        label: "Taxi",
        userMeaning: "Standard local ride.",
      },
      {
        id: "accessible",
        label: "Accessible ride",
        userMeaning: "Wheelchair, walker, ramp, or extra boarding time.",
      },
      {
        id: "assisted",
        label: "Assisted ride",
        userMeaning: "Driver or caregiver help from door to door.",
      },
    ],
    providerSources: ["own", "partner", "vyva-find"],
    backendSources: [
      "user_providers",
      "trusted_help_partners",
      "concierge_pending",
      "local_user_preferences",
    ],
    coverageDriven: false,
    coverageValues: [],
    safetyModel: "prepareThenConfirm",
  },
  {
    serviceId: "wellness",
    label: "Wellness",
    description: "Salon and body care",
    flowReference: CONCIERGE_FLOW_REFERENCES.careNavigation,
    entryStep: "subservice",
    requiresSubservice: true,
    subservices: [
      {
        id: "hair-care",
        label: "Hair care",
        userMeaning: "Haircut, blow dry, color, or barber.",
      },
      {
        id: "nail-care",
        label: "Nail care",
        userMeaning: "Manicure, pedicure, and basic nail support.",
      },
      {
        id: "massage",
        label: "Massage",
        userMeaning: "Relaxation, mobility, or pain-relief massage.",
      },
      {
        id: "foot-care",
        label: "Foot care",
        userMeaning: "Non-medical foot care and comfort support.",
      },
    ],
    providerSources: ["own", "partner", "vyva-find"],
    backendSources: [
      "user_providers",
      "trusted_help_partners",
      "concierge_pending",
      "local_user_preferences",
    ],
    coverageDriven: false,
    coverageValues: [],
    safetyModel: "prepareThenConfirm",
  },
  {
    serviceId: "other",
    label: "Other",
    description: "Tell VYVA what you need",
    flowReference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
    entryStep: "provider",
    requiresSubservice: false,
    subservices: [
      {
        id: "errand",
        label: "Errand",
        userMeaning: "A practical local task that does not fit another service.",
      },
      {
        id: "local-help",
        label: "Local help",
        userMeaning: "Find trusted local support before acting.",
      },
      {
        id: "describe",
        label: "Describe it",
        userMeaning: "Let the user explain the need in their own words.",
      },
    ],
    providerSources: ["own", "partner", "vyva-find"],
    backendSources: [
      "user_providers",
      "trusted_help_partners",
      "concierge_pending",
      "concierge_sessions",
      "local_user_preferences",
    ],
    coverageDriven: false,
    coverageValues: [],
    safetyModel: "prepareThenConfirm",
  },
] as const satisfies readonly TrustedHelpServicePresentation[];

export function getTrustedHelpPresentationStep(stepId: TrustedHelpStepId) {
  return TRUSTED_HELP_PRESENTATION_STEPS.find((step) => step.stepId === stepId);
}

export function getTrustedHelpServicePresentation(serviceId: TrustedHelpServiceId) {
  return TRUSTED_HELP_SERVICE_PRESENTATION_MAP.find(
    (service) => service.serviceId === serviceId,
  );
}

export function getTrustedHelpEntryStep(serviceId: TrustedHelpServiceId) {
  return getTrustedHelpServicePresentation(serviceId)?.entryStep;
}

export function validateTrustedHelpPresentationMap(): string[] {
  const errors: string[] = [];
  const conciergeContract = getScreenContract(TRUSTED_HELP_SCREEN_CONTRACT_ID);
  const presentationFamilyIds = new Set(
    VYVA_PRESENTATION_REGISTRY.families.map((family) => family.familyId),
  );
  const flowReferences = new Set(
    CONCIERGE_FLOW_REGISTRY.map((flow) => flow.reference),
  );
  const serviceIds = TRUSTED_HELP_SERVICE_PRESENTATION_MAP.map(
    (service) => service.serviceId,
  );
  const serviceIdSet = new Set(serviceIds);

  if (!conciergeContract) {
    errors.push("Missing Concierge screen contract.");
  }

  for (const step of TRUSTED_HELP_PRESENTATION_STEPS) {
    if (step.screenContractId !== TRUSTED_HELP_SCREEN_CONTRACT_ID) {
      errors.push(`${step.stepId} must use the Concierge screen contract.`);
    }

    if (!presentationFamilyIds.has(step.presentationFamilyId)) {
      errors.push(`${step.stepId} uses an unknown presentation family.`);
    }

    if (step.chips !== "hidden") {
      errors.push(`${step.stepId} must hide chips.`);
    }
  }

  for (const service of TRUSTED_HELP_SERVICE_PRESENTATION_MAP) {
    if (!flowReferences.has(service.flowReference)) {
      errors.push(`${service.serviceId} uses an unknown Concierge flow.`);
    }

    if (service.requiresSubservice && service.entryStep !== "subservice") {
      errors.push(`${service.serviceId} must route through the type step.`);
    }

    if (!service.requiresSubservice && service.entryStep !== "provider") {
      errors.push(`${service.serviceId} must go directly to provider.`);
    }

    if (service.safetyModel !== "prepareThenConfirm") {
      errors.push(`${service.serviceId} must be confirmation-first.`);
    }
  }

  if (serviceIdSet.has("water" as TrustedHelpServiceId)) {
    errors.push("Water must not be a top-level Trusted Help service.");
  }

  const groceries = getTrustedHelpServicePresentation("groceries");
  if (!groceries?.coverageDriven || !groceries.coverageValues.includes("Water")) {
    errors.push("Groceries must carry Water as provider coverage, not a service.");
  }

  const forbiddenTrustedHelpFlows: ConciergeFlowReference[] = [
    CONCIERGE_FLOW_REFERENCES.medicalAppointment,
    CONCIERGE_FLOW_REFERENCES.otcPharmacy,
  ];
  for (const service of TRUSTED_HELP_SERVICE_PRESENTATION_MAP) {
    if (forbiddenTrustedHelpFlows.includes(service.flowReference)) {
      errors.push(
        `${service.serviceId} must not use medical or pharmacy provider flows.`,
      );
    }
  }

  return errors;
}
