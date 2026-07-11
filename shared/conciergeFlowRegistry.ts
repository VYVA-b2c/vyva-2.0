export const CONCIERGE_FLOW_REFERENCES = {
  transportBooking: "FLOW_TRANSPORT_BOOKING",
  otcPharmacy: "FLOW_OTC_PHARMACY",
  medicalAppointment: "FLOW_MEDICAL_APPOINTMENT",
  homeService: "FLOW_HOME_SERVICE",
  scamCheck: "FLOW_SCAM_CHECK",
  insuranceAdmin: "FLOW_INSURANCE_ADMIN",
  toolGatedTask: "FLOW_TOOL_GATED_TASK",
} as const;

export type ConciergeFlowReference = typeof CONCIERGE_FLOW_REFERENCES[keyof typeof CONCIERGE_FLOW_REFERENCES];

export const CONCIERGE_PROVIDER_CATEGORIES = [
  { id: "pharmacy", label: "Pharmacy", placesType: "pharmacy" },
  { id: "doctor_clinic", label: "Doctor / Clinic", placesType: "health" },
  { id: "transport", label: "Transport / Taxi", placesType: "transport" },
  { id: "home_service", label: "Home service", placesType: "home_service" },
  { id: "personal_care", label: "Personal care", placesType: "beauty_salon" },
  { id: "food", label: "Restaurant / Food", placesType: "restaurant" },
  { id: "other", label: "Other" },
] as const;

export type ConciergeProviderCategoryId = typeof CONCIERGE_PROVIDER_CATEGORIES[number]["id"];

export const CONCIERGE_PROVIDER_CATEGORY_ALIASES: Record<string, ConciergeProviderCategoryId> = {
  doctor: "doctor_clinic",
  clinic: "doctor_clinic",
  hospital: "doctor_clinic",
  dentist: "doctor_clinic",
  physiotherapist: "doctor_clinic",
  gp: "doctor_clinic",
  health: "doctor_clinic",
  taxi: "transport",
  taxi_stand: "transport",
  ride: "transport",
  driver: "transport",
  car_service: "transport",
  "home-service": "home_service",
  home_repair: "home_service",
  repair: "home_service",
  plumber: "home_service",
  electrician: "home_service",
  cleaner: "home_service",
  beauty_salon: "personal_care",
  hair_care: "personal_care",
  spa: "personal_care",
  restaurant: "food",
  cafe: "food",
  meal_takeaway: "food",
  meal_delivery: "food",
};

export function normalizeConciergeProviderCategory(value: string | null | undefined): ConciergeProviderCategoryId {
  const key = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (CONCIERGE_PROVIDER_CATEGORIES.some((category) => category.id === key)) return key as ConciergeProviderCategoryId;
  return CONCIERGE_PROVIDER_CATEGORY_ALIASES[key] ?? "other";
}

export type ConciergeFlowLevel = "main_category" | "sub_action" | "fast_help" | "voice_handoff";
export type ConciergeFlowStatus = "ready" | "partial" | "planned" | "deferred";
export type ConciergeSavedDataKey =
  | "trusted_provider"
  | "coverage"
  | "mobility_preferences"
  | "home_address"
  | "contact_channel"
  | "document_or_media";
export type ConciergeToolRequirement =
  | "phone_call"
  | "email"
  | "whatsapp"
  | "booking_link"
  | "camera_or_upload"
  | "web_search"
  | "operator_review";

export interface ConciergeFlowDefinition {
  reference: ConciergeFlowReference;
  actionName: string;
  levels: ConciergeFlowLevel[];
  status: ConciergeFlowStatus;
  providerCategory?: ConciergeProviderCategoryId;
  setupFocus?: ConciergeProviderCategoryId;
  savedData: ConciergeSavedDataKey[];
  tools: ConciergeToolRequirement[];
  firstQuestions: string[];
  confirmationRule: string;
  nextImplementationStep?: string;
}

export const CONCIERGE_FLOW_REGISTRY: ConciergeFlowDefinition[] = [
  {
    reference: CONCIERGE_FLOW_REFERENCES.transportBooking,
    actionName: "Book ride / transport",
    levels: ["sub_action", "fast_help", "voice_handoff"],
    status: "partial",
    providerCategory: "transport",
    setupFocus: "transport",
    savedData: ["trusted_provider", "mobility_preferences", "home_address"],
    tools: ["phone_call", "whatsapp", "booking_link", "operator_review"],
    firstQuestions: ["destination", "pickup", "pickup_time"],
    confirmationRule: "Confirm pickup, destination, time, mobility needs, provider, and price before contacting or booking.",
    nextImplementationStep: "Use saved transport provider as the first actionable option when channels are available.",
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.otcPharmacy,
    actionName: "OTC pharmacy help",
    levels: ["sub_action", "fast_help"],
    status: "partial",
    providerCategory: "pharmacy",
    setupFocus: "pharmacy",
    savedData: ["trusted_provider"],
    tools: ["phone_call", "whatsapp", "email", "operator_review"],
    firstQuestions: ["otc_item", "pickup_or_delivery", "needed_time"],
    confirmationRule: "Only handle non-prescription items and confirm the item, pharmacy, timing, and contact action first.",
    nextImplementationStep: "Prepare the saved pharmacy channel handoff and keep prescription medicines blocked.",
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
    actionName: "Medical appointment",
    levels: ["sub_action", "voice_handoff"],
    status: "partial",
    providerCategory: "doctor_clinic",
    setupFocus: "doctor_clinic",
    savedData: ["trusted_provider", "coverage"],
    tools: ["phone_call", "email", "booking_link", "operator_review"],
    firstQuestions: ["reason", "preferred_time", "provider_preference"],
    confirmationRule: "Confirm provider, coverage note, channel, date, time, and location before VYVA acts or saves the appointment.",
    nextImplementationStep: "Unify provider channel readiness checks across phone, email, and booking form paths.",
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.homeService,
    actionName: "Home service",
    levels: ["sub_action", "fast_help", "voice_handoff"],
    status: "partial",
    providerCategory: "home_service",
    setupFocus: "home_service",
    savedData: ["trusted_provider", "home_address", "contact_channel"],
    tools: ["phone_call", "whatsapp", "email", "booking_link", "operator_review"],
    firstQuestions: ["service_type", "urgency", "home_access_or_safety_notes"],
    confirmationRule: "Confirm problem, urgency, address, provider, estimate/price, and visit time before booking or contacting.",
    nextImplementationStep: "Prefer saved home-service providers before external discovery.",
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.scamCheck,
    actionName: "Scam or safety check",
    levels: ["fast_help", "voice_handoff"],
    status: "partial",
    savedData: ["document_or_media"],
    tools: ["camera_or_upload", "web_search", "operator_review"],
    firstQuestions: ["email_or_document_or_phone_or_company", "what_worries_you"],
    confirmationRule: "Never submit personal details; summarize risk and ask before forwarding, uploading, or searching sensitive information.",
    nextImplementationStep: "Connect direct email forwarding, camera/upload, phone verification, and live company reputation lookup tools.",
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
    actionName: "Insurance / admin help",
    levels: ["sub_action", "voice_handoff"],
    status: "planned",
    savedData: ["coverage", "document_or_media"],
    tools: ["email", "phone_call", "camera_or_upload", "operator_review"],
    firstQuestions: ["document_or_task_type", "deadline", "who_it_is_for"],
    confirmationRule: "Confirm document/task, recipient, deadline, and whether VYVA is only preparing or also sending.",
    nextImplementationStep: "Separate general admin help from medical coverage readiness.",
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
    actionName: "Call, email, form, or application",
    levels: ["voice_handoff"],
    status: "planned",
    savedData: ["contact_channel", "document_or_media"],
    tools: ["phone_call", "email", "booking_link", "camera_or_upload", "operator_review"],
    firstQuestions: ["task_goal", "recipient_or_website", "deadline"],
    confirmationRule: "Check tool readiness first, prepare a draft/action plan, and ask before sending, calling, uploading, or submitting.",
    nextImplementationStep: "Create a shared tool-readiness gate used by all booking and admin flows.",
  },
];

export function getConciergeFlowDefinition(reference: ConciergeFlowReference): ConciergeFlowDefinition {
  const flow = CONCIERGE_FLOW_REGISTRY.find((item) => item.reference === reference);
  if (!flow) throw new Error(`Unknown Concierge flow reference: ${reference}`);
  return flow;
}

export function providerSetupFocusForFlow(reference: ConciergeFlowReference): ConciergeProviderCategoryId | null {
  return getConciergeFlowDefinition(reference).setupFocus ?? null;
}

export function conciergeFlowNeedsSavedProvider(reference: ConciergeFlowReference): boolean {
  return getConciergeFlowDefinition(reference).savedData.includes("trusted_provider");
}
