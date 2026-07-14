import {
  conciergeFlowNeedsSavedProvider,
  CONCIERGE_FLOW_REFERENCES,
  type ConciergeFlowReference,
} from "./conciergeFlowRegistry";

export type ConciergeFlowRequirementKey =
  | "destination"
  | "pickup"
  | "time"
  | "otc_item"
  | "fulfillment"
  | "reason"
  | "service_type"
  | "urgency"
  | "home_access"
  | "source"
  | "concern"
  | "risk_type"
  | "location"
  | "document_or_task"
  | "recipient"
  | "deadline"
  | "goal"
  | "website_or_contact";

export type ConciergeRequirementDefinition = {
  key: ConciergeFlowRequirementKey;
  labelEn: string;
  labelEs: string;
  payloadKeys: string[];
  summaryFallback?: boolean;
};

export type ConciergeRequirementStatus = ConciergeRequirementDefinition & {
  isReady: boolean;
};

export type ConciergeFlowRequirementsInput = {
  useCase: string;
  payload?: Record<string, unknown> | null;
  providerName?: string | null;
  summary?: string | null;
};

export type ConciergeFlowRequirementsResult = {
  flowReference: ConciergeFlowReference;
  needsProvider: boolean;
  providerReady: boolean;
  requirements: ConciergeRequirementStatus[];
  missingRequirements: ConciergeRequirementStatus[];
  readyRequirements: ConciergeRequirementStatus[];
  firstMissingRequirement: ConciergeRequirementStatus | null;
};

const REQUIREMENTS_BY_FLOW: Record<ConciergeFlowReference, ConciergeRequirementDefinition[]> = {
  [CONCIERGE_FLOW_REFERENCES.transportBooking]: [
    { key: "destination", labelEn: "Destination", labelEs: "Destino", payloadKeys: ["destination_address", "destination"] },
    { key: "pickup", labelEn: "Pickup", labelEs: "Recogida", payloadKeys: ["pickup_address", "pickup", "home_address"] },
    { key: "time", labelEn: "Time", labelEs: "Hora", payloadKeys: ["requested_time", "time", "scheduled_for"] },
  ],
  [CONCIERGE_FLOW_REFERENCES.otcPharmacy]: [
    { key: "otc_item", labelEn: "Item", labelEs: "Producto", payloadKeys: ["item_text", "items", "item"] },
    { key: "fulfillment", labelEn: "Pickup or delivery", labelEs: "Recogida o entrega", payloadKeys: ["fulfillment_preference", "delivery_preference"] },
    { key: "time", labelEn: "Time", labelEs: "Hora", payloadKeys: ["requested_time", "time", "scheduled_for"] },
  ],
  [CONCIERGE_FLOW_REFERENCES.medicalAppointment]: [
    { key: "reason", labelEn: "Reason", labelEs: "Motivo", payloadKeys: ["reason", "detail", "appointment_reason"], summaryFallback: true },
    { key: "time", labelEn: "Preferred time", labelEs: "Hora preferida", payloadKeys: ["requested_time", "preferred_time", "scheduled_for"] },
  ],
  [CONCIERGE_FLOW_REFERENCES.homeService]: [
    { key: "service_type", labelEn: "Service type", labelEs: "Tipo de servicio", payloadKeys: ["service_type", "service_label"] },
    { key: "urgency", labelEn: "Urgency", labelEs: "Urgencia", payloadKeys: ["urgency", "priority", "requested_time"] },
    { key: "home_access", labelEn: "Address or access", labelEs: "Direccion o acceso", payloadKeys: ["home_access_or_safety_notes", "access_notes", "home_address", "address", "location"] },
  ],
  [CONCIERGE_FLOW_REFERENCES.scamCheck]: [
    { key: "source", labelEn: "Source", labelEs: "Fuente", payloadKeys: ["scam_type", "source_type", "document_url", "uploaded_file", "phone_number", "company_name", "email_body", "message"], summaryFallback: true },
    { key: "concern", labelEn: "Concern", labelEs: "Riesgo", payloadKeys: ["concern", "what_worries_you", "reason", "detail"], summaryFallback: true },
  ],
  [CONCIERGE_FLOW_REFERENCES.safeHomeSupport]: [
    { key: "risk_type", labelEn: "Risk type", labelEs: "Tipo de riesgo", payloadKeys: ["risk_type", "safety_source", "safety_category", "service_type", "appointment_type"], summaryFallback: true },
    { key: "location", labelEn: "Location", labelEs: "Lugar", payloadKeys: ["location", "home_address", "address", "room", "area"] },
    { key: "urgency", labelEn: "Urgency", labelEs: "Urgencia", payloadKeys: ["urgency", "priority", "requested_time"] },
  ],
  [CONCIERGE_FLOW_REFERENCES.insuranceAdmin]: [
    { key: "document_or_task", labelEn: "Task", labelEs: "Gestion", payloadKeys: ["document_type", "task_type", "admin_task", "reason", "detail"], summaryFallback: true },
    { key: "recipient", labelEn: "Recipient", labelEs: "Destinatario", payloadKeys: ["recipient", "recipient_name", "recipient_email", "provider_email", "email", "phone"] },
    { key: "deadline", labelEn: "Deadline", labelEs: "Fecha limite", payloadKeys: ["deadline", "due_date", "requested_time"] },
  ],
  [CONCIERGE_FLOW_REFERENCES.toolGatedTask]: [
    { key: "goal", labelEn: "Goal", labelEs: "Objetivo", payloadKeys: ["task_goal", "goal", "reason", "detail", "message", "draft_message"], summaryFallback: true },
    { key: "website_or_contact", labelEn: "Website or contact", labelEs: "Web o contacto", payloadKeys: ["recipient", "recipient_email", "website", "booking_url", "provider_name", "provider_email", "phone"] },
  ],
};

function payloadHasValue(payload: Record<string, unknown> | null | undefined, keys: string[]): boolean {
  if (!payload) return false;
  return keys.some((key) => {
    const value = payload[key];
    if (typeof value === "string") return Boolean(value.trim());
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined;
  });
}

export function conciergeFlowReferenceForPendingAction(input: ConciergeFlowRequirementsInput): ConciergeFlowReference {
  const appointmentType = typeof input.payload?.appointment_type === "string"
    ? input.payload.appointment_type.trim().toLowerCase()
    : "";
  const flowReference = typeof input.payload?.flow_reference === "string"
    ? input.payload.flow_reference.trim()
    : "";

  if (Object.values(CONCIERGE_FLOW_REFERENCES).includes(flowReference as ConciergeFlowReference)) {
    return flowReference as ConciergeFlowReference;
  }
  if (input.useCase === "book_ride") return CONCIERGE_FLOW_REFERENCES.transportBooking;
  if (input.useCase === "order_medicine") return CONCIERGE_FLOW_REFERENCES.otcPharmacy;
  if (input.useCase === "home_service" || appointmentType === "home-service") return CONCIERGE_FLOW_REFERENCES.homeService;
  if (input.useCase === "book_appointment") return CONCIERGE_FLOW_REFERENCES.medicalAppointment;
  if (input.useCase === "scam_check") return CONCIERGE_FLOW_REFERENCES.scamCheck;
  if (input.useCase === "admin_task" || input.useCase === "paperwork") return CONCIERGE_FLOW_REFERENCES.insuranceAdmin;
  return CONCIERGE_FLOW_REFERENCES.toolGatedTask;
}

export function evaluateConciergeFlowRequirements(
  input: ConciergeFlowRequirementsInput,
): ConciergeFlowRequirementsResult {
  const flowReference = conciergeFlowReferenceForPendingAction(input);
  const requirements = REQUIREMENTS_BY_FLOW[flowReference].map((requirement) => {
    const isReady = payloadHasValue(input.payload, requirement.payloadKeys)
      || Boolean(requirement.summaryFallback && input.summary?.trim());
    return {
      ...requirement,
      isReady,
    };
  });
  const missingRequirements = requirements.filter((requirement) => !requirement.isReady);
  const readyRequirements = requirements.filter((requirement) => requirement.isReady);

  return {
    flowReference,
    needsProvider: conciergeFlowNeedsSavedProvider(flowReference),
    providerReady: Boolean(input.providerName?.trim()),
    requirements,
    missingRequirements,
    readyRequirements,
    firstMissingRequirement: missingRequirements[0] ?? null,
  };
}
