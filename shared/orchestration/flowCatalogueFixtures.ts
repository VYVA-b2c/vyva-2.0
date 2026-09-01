import {
  VYVA_FLOW_CATALOGUE,
  type CapabilityDefinition,
  type FlowCatalogue,
  type FlowDefinition,
} from "./flowCatalogue";

function flow(flowId: string): FlowDefinition {
  return VYVA_FLOW_CATALOGUE.flows.find((item) => item.flowId === flowId)!;
}
function capability(capabilityId: string): CapabilityDefinition {
  return VYVA_FLOW_CATALOGUE.capabilities.find(
    (item) => item.capabilityId === capabilityId,
  )!;
}

export const preventiveHealthFlowFixture = flow("health.preventive_check");
export const emergencyCheckFlowFixture = flow("safety.emergency_check");
export const woundAssessmentFlowFixture = flow("health.visual.wound_assessment");
export const stoolAssessmentFlowFixture = flow("health.visual.stool_assessment");
export const medicationReminderFlowFixture = flow("medication.reminder");
export const moodCheckFlowFixture = flow("wellbeing.mood_check");
export const scamAssessmentFlowFixture = flow("trust.scam_assessment");
export const pushNotificationFlowFixture = flow("engagement.push_notification");
export const outboundCallFlowFixture = flow("engagement.outbound_call");
export const notificationResumeFlowFixture = flow("engagement.notification_resume");

export const imageCaptureCapabilityFixture = capability(
  "capability.multimodal.image_capture",
);
export const visionAnalysisCapabilityFixture = capability(
  "capability.multimodal.vision_analysis",
);
export const pushCapabilityFixture = capability("capability.communication.push");
export const outboundCallCapabilityFixture = capability(
  "capability.communication.outbound_call",
);

export const futureCapabilityFixture: CapabilityDefinition = {
  ...structuredClone(imageCaptureCapabilityFixture),
  capabilityId: "capability.future.signal_capture",
  description: "A provider-neutral future signal-capture capability.",
  inputKinds: ["measurement"],
  outputKinds: ["capability.future.signal_capture.result"],
  requiredConsentScopes: [],
  supportedDomains: ["future"],
};

export const futureFlowFixture: FlowDefinition = {
  ...structuredClone(preventiveHealthFlowFixture),
  flowId: "future.example_assessment",
  displayName: "Future Example Assessment",
  description: "An extensibility fixture for a future assessment.",
  domain: "future",
  kind: "assessment",
  status: "draft",
  ownerSpecialistId: "symptom_assessment",
  supportedTriggers: ["user"],
  capabilityIds: [futureCapabilityFixture.capabilityId],
  consentRequirements: [],
  outcomes: [{
    outcomeId: "future.example_assessment.completed",
    category: "completed",
    description: "The future example assessment completed.",
    terminal: true,
    allowedNextFlowIds: [],
    escalationRequirement: "none",
    followUpEligible: false,
    memorySummaryPolicy: "none",
  }],
  uiScenes: [{
    sceneId: "future.example_assessment.main",
    purpose: "Collect future provider-neutral input.",
    supportedInstructionTypes: ["show_measurement_input"],
  }],
  metadata: { fixture: true },
};

export const futureCatalogueFixture: FlowCatalogue = {
  ...structuredClone(VYVA_FLOW_CATALOGUE),
  flows: [...structuredClone(VYVA_FLOW_CATALOGUE.flows), futureFlowFixture],
  capabilities: [
    ...structuredClone(VYVA_FLOW_CATALOGUE.capabilities),
    futureCapabilityFixture,
  ],
};
