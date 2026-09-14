import {
  CONCIERGE_FLOW_REGISTRY,
  CONCIERGE_FLOW_REFERENCES,
  getConciergeFlowDefinition,
  type ConciergeFlowDefinition,
  type ConciergeFlowReference,
} from "./conciergeFlowRegistry";
import {
  evaluateConciergeFlowRequirements,
  type ConciergeRequirementDefinition,
} from "./conciergeFlowRequirements";

export type ConciergeFlowMapStepKey =
  | "start"
  | "details"
  | "provider"
  | "confirm"
  | "action"
  | "history";

export interface ConciergeFlowMapStep {
  key: ConciergeFlowMapStepKey;
  label: string;
  helper: string;
}

export interface ConciergeFlowMap {
  reference: ConciergeFlowReference;
  title: string;
  needsProvider: boolean;
  detailLabels: string[];
  missingProviderPrompt: string;
  savedProviderPrompt: string;
  confirmationPrompt: string;
  completionPrompt: string;
  steps: ConciergeFlowMapStep[];
}

const ACTION_LABELS: Record<ConciergeFlowReference, string> = {
  [CONCIERGE_FLOW_REFERENCES.transportBooking]: "Contact or book the ride",
  [CONCIERGE_FLOW_REFERENCES.otcPharmacy]: "Contact the pharmacy",
  [CONCIERGE_FLOW_REFERENCES.medicalAppointment]: "Contact the clinic or open booking",
  [CONCIERGE_FLOW_REFERENCES.homeService]: "Contact the home service",
  [CONCIERGE_FLOW_REFERENCES.shoppingSupport]: "Prepare options or a review",
  [CONCIERGE_FLOW_REFERENCES.careNavigation]: "Compare or contact providers",
  [CONCIERGE_FLOW_REFERENCES.scamCheck]: "Review the risk",
  [CONCIERGE_FLOW_REFERENCES.safeHomeSupport]: "Review safety and next step",
  [CONCIERGE_FLOW_REFERENCES.insuranceAdmin]: "Prepare or send the admin request",
  [CONCIERGE_FLOW_REFERENCES.toolGatedTask]: "Run the chosen action",
};

const START_LABELS: Record<ConciergeFlowReference, string> = {
  [CONCIERGE_FLOW_REFERENCES.transportBooking]: "Ride request starts",
  [CONCIERGE_FLOW_REFERENCES.otcPharmacy]: "Pharmacy help starts",
  [CONCIERGE_FLOW_REFERENCES.medicalAppointment]: "Appointment request starts",
  [CONCIERGE_FLOW_REFERENCES.homeService]: "Home service request starts",
  [CONCIERGE_FLOW_REFERENCES.shoppingSupport]: "Shopping help starts",
  [CONCIERGE_FLOW_REFERENCES.careNavigation]: "Provider search starts",
  [CONCIERGE_FLOW_REFERENCES.scamCheck]: "Review starts",
  [CONCIERGE_FLOW_REFERENCES.safeHomeSupport]: "Safety check starts",
  [CONCIERGE_FLOW_REFERENCES.insuranceAdmin]: "Admin task starts",
  [CONCIERGE_FLOW_REFERENCES.toolGatedTask]: "Action request starts",
};

function detailLabelsFor(flow: ConciergeFlowDefinition): string[] {
  return evaluateConciergeFlowRequirements({
    useCase: "",
    payload: { flow_reference: flow.reference },
    providerName: null,
    summary: null,
  }).requirements.map((requirement: ConciergeRequirementDefinition) => requirement.labelEn);
}

function providerCopy(flow: ConciergeFlowDefinition): Pick<ConciergeFlowMap, "missingProviderPrompt" | "savedProviderPrompt"> {
  if (!flow.savedData.includes("trusted_provider")) {
    return {
      missingProviderPrompt: "No provider setup is needed for this flow.",
      savedProviderPrompt: "Use saved profile details when available and only ask for what is missing.",
    };
  }

  const category = flow.providerCategory ? flow.providerCategory.replace(/_/g, " ") : "provider";
  return {
    missingProviderPrompt: `Ask the user to choose or add a trusted ${category} provider first.`,
    savedProviderPrompt: `Use the saved ${category} provider and do not ask for it again.`,
  };
}

export function buildConciergeFlowMap(flow: ConciergeFlowDefinition): ConciergeFlowMap {
  const detailLabels = detailLabelsFor(flow);
  const provider = providerCopy(flow);
  const needsProvider = flow.savedData.includes("trusted_provider");
  const detailHelper = detailLabels.length > 0
    ? `Ask only for missing details: ${detailLabels.join(", ")}.`
    : "Use saved context and ask only for anything missing.";

  return {
    reference: flow.reference,
    title: flow.actionName,
    needsProvider,
    detailLabels,
    ...provider,
    confirmationPrompt: "Show a final review before any booking, call, email, upload, purchase, form, or shared data.",
    completionPrompt: "Save the outcome, reply, and next step in completion history.",
    steps: [
      {
        key: "start",
        label: START_LABELS[flow.reference],
        helper: "Start from Home, Concierge, fast help, or voice when available.",
      },
      {
        key: "details",
        label: "Missing details",
        helper: detailHelper,
      },
      {
        key: "provider",
        label: needsProvider ? "Provider" : "Provider if needed",
        helper: needsProvider
          ? `${provider.savedProviderPrompt} If none is saved, ${provider.missingProviderPrompt.charAt(0).toLowerCase()}${provider.missingProviderPrompt.slice(1)}`
          : provider.missingProviderPrompt,
      },
      {
        key: "confirm",
        label: "User OK",
        helper: "Ask for a fresh confirmation before the outside action.",
      },
      {
        key: "action",
        label: ACTION_LABELS[flow.reference],
        helper: "Use test mode unless the live channel is ready.",
      },
      {
        key: "history",
        label: "Reply and history",
        helper: "Record simulated/live result, provider reply, and any action needed.",
      },
    ],
  };
}

export const CONCIERGE_FLOW_MAPS: ConciergeFlowMap[] = CONCIERGE_FLOW_REGISTRY.map(buildConciergeFlowMap);

export function getConciergeFlowMap(reference: ConciergeFlowReference): ConciergeFlowMap {
  const flow = getConciergeFlowDefinition(reference);
  return buildConciergeFlowMap(flow);
}
