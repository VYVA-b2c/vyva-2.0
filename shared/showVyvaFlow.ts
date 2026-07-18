import { CONCIERGE_FLOW_REFERENCES, type ConciergeFlowReference } from "./conciergeFlowRegistry";
import { APP_WORKFLOW_REFERENCES, type WorkflowReference } from "./workflowRegistry";

export const SHOW_VYVA_CAPTURE_SOURCES = ["camera", "upload", "paste_text", "paste_link"] as const;
export type ShowVyvaCaptureSource = typeof SHOW_VYVA_CAPTURE_SOURCES[number];

export const SHOW_VYVA_USE_CASE_IDS = {
  scamCheck: "scam_check",
  medicineOrOtc: "medicine_or_otc",
  documentHelp: "document_help",
  providerOrDeal: "provider_or_deal",
  healthOrHomePhoto: "health_or_home_photo",
} as const;

export type ShowVyvaUseCaseId = typeof SHOW_VYVA_USE_CASE_IDS[keyof typeof SHOW_VYVA_USE_CASE_IDS];

export type ShowVyvaInputKind = "image_or_file" | "text_or_link";

export type ShowVyvaConciergeUseCase =
  | "scam_check"
  | "admin_task"
  | "paperwork"
  | "find_offers"
  | "find_provider"
  | "shopping_request";

export type ShowVyvaConciergeSource =
  | "visual_scan"
  | "medication_support"
  | "safe_home_scan"
  | "shopping_helper"
  | "scam_guard";

export interface ShowVyvaUseCase {
  id: ShowVyvaUseCaseId;
  label: string;
  shortLabel: string;
  prompt: string;
  workflow: WorkflowReference;
  conciergeFlow?: ConciergeFlowReference;
  conciergeUseCase: ShowVyvaConciergeUseCase;
  conciergeSource: ShowVyvaConciergeSource;
  acceptedSources: ShowVyvaCaptureSource[];
  route: string;
  confirmation: string;
  nextStep: string;
}

export interface ShowVyvaPastePayload {
  useCaseId: ShowVyvaUseCaseId;
  source: Extract<ShowVyvaCaptureSource, "paste_text" | "paste_link">;
  value: string;
  question?: string;
}

export type ShowVyvaConciergePrefill = {
  kind: "task";
  source: ShowVyvaConciergeSource;
  message: string;
  flowReference?: ConciergeFlowReference;
  requestedTool?: "camera_or_upload" | "web_search" | "operator_review";
  actionLabel: string;
  summary: string;
  useCase: ShowVyvaConciergeUseCase;
};

export const SHOW_VYVA_USE_CASES: ShowVyvaUseCase[] = [
  {
    id: SHOW_VYVA_USE_CASE_IDS.scamCheck,
    label: "Scam or safety check",
    shortLabel: "Scam",
    prompt: "Check a suspicious email, document, phone number, company, or link.",
    workflow: CONCIERGE_FLOW_REFERENCES.scamCheck,
    conciergeFlow: CONCIERGE_FLOW_REFERENCES.scamCheck,
    conciergeUseCase: "scam_check",
    conciergeSource: "scam_guard",
    acceptedSources: ["camera", "upload", "paste_text", "paste_link"],
    route: "/scam-guard",
    confirmation: "VYVA reviews risk first and asks before forwarding, uploading, searching, or contacting anyone.",
    nextStep: "Choose email, document, phone, company, or link review.",
  },
  {
    id: SHOW_VYVA_USE_CASE_IDS.medicineOrOtc,
    label: "Medicine or OTC item",
    shortLabel: "Medicine",
    prompt: "Review a medicine label, OTC item, or pharmacy question.",
    workflow: APP_WORKFLOW_REFERENCES.medicationSafety,
    conciergeFlow: CONCIERGE_FLOW_REFERENCES.otcPharmacy,
    conciergeUseCase: "shopping_request",
    conciergeSource: "medication_support",
    acceptedSources: ["camera", "upload", "paste_text", "paste_link"],
    route: "/meds",
    confirmation: "VYVA does not change doses. It prepares safe questions and asks before contacting a pharmacy or doctor.",
    nextStep: "Check label or question, then prepare OTC or pharmacist next steps.",
  },
  {
    id: SHOW_VYVA_USE_CASE_IDS.documentHelp,
    label: "Document or form",
    shortLabel: "Document",
    prompt: "Understand a letter, bill, form, application, or email draft.",
    workflow: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
    conciergeFlow: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
    conciergeUseCase: "paperwork",
    conciergeSource: "visual_scan",
    acceptedSources: ["camera", "upload", "paste_text", "paste_link"],
    route: "/concierge",
    confirmation: "VYVA explains and drafts first. It asks before sending, calling, uploading, or submitting anything.",
    nextStep: "Summarize the document and identify the safest next action.",
  },
  {
    id: SHOW_VYVA_USE_CASE_IDS.providerOrDeal,
    label: "Provider, quote, or deal",
    shortLabel: "Deal",
    prompt: "Compare a quote, provider page, service offer, price, or reputation signal.",
    workflow: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
    conciergeFlow: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
    conciergeUseCase: "find_offers",
    conciergeSource: "shopping_helper",
    acceptedSources: ["camera", "upload", "paste_text", "paste_link"],
    route: "/concierge",
    confirmation: "VYVA compares options and asks before contacting, booking, buying, or sharing details.",
    nextStep: "Check price, proximity, reputation, terms, and red flags.",
  },
  {
    id: SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto,
    label: "Health or home photo",
    shortLabel: "Photo",
    prompt: "Show a health photo, home-safety concern, label, or object.",
    workflow: APP_WORKFLOW_REFERENCES.visualScan,
    conciergeFlow: CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
    conciergeUseCase: "paperwork",
    conciergeSource: "safe_home_scan",
    acceptedSources: ["camera", "upload", "paste_text"],
    route: "/health",
    confirmation: "VYVA gives an assistive review only and asks before sharing or escalating.",
    nextStep: "Use existing scan support for photos, or prepare a safe Concierge handoff.",
  },
];

export function getShowVyvaUseCase(id: ShowVyvaUseCaseId): ShowVyvaUseCase {
  const useCase = SHOW_VYVA_USE_CASES.find((item) => item.id === id);
  if (!useCase) throw new Error(`Unknown Show VYVA use case: ${id}`);
  return useCase;
}

export function showVyvaUseCasesForSource(source: ShowVyvaCaptureSource): ShowVyvaUseCase[] {
  return SHOW_VYVA_USE_CASES.filter((useCase) => useCase.acceptedSources.includes(source));
}

export function showVyvaInputKind(source: ShowVyvaCaptureSource): ShowVyvaInputKind {
  return source === "camera" || source === "upload" ? "image_or_file" : "text_or_link";
}

export function inferShowVyvaPasteSource(value: string): Extract<ShowVyvaCaptureSource, "paste_text" | "paste_link"> {
  return /^https?:\/\//i.test(value.trim()) || /^www\./i.test(value.trim()) ? "paste_link" : "paste_text";
}

export function buildShowVyvaConciergePrefill(payload: ShowVyvaPastePayload, language = "en"): ShowVyvaConciergePrefill {
  const useCase = getShowVyvaUseCase(payload.useCaseId);
  const isSpanish = language.toLowerCase().startsWith("es");
  const itemType = payload.source === "paste_link"
    ? (isSpanish ? "enlace" : "link")
    : (isSpanish ? "texto" : "text");
  const common = isSpanish
    ? "No envies, llames, subas, compres ni compartas datos sin mi confirmacion final."
    : "Do not send, call, upload, buy, or share details without my final confirmation.";
  const question = payload.question?.trim();
  const message = isSpanish
    ? [
        `Ayudame con este ${itemType}: ${useCase.label}.`,
        `Contenido: ${payload.value.trim()}`,
        question ? `Mi pregunta: ${question}` : "",
        `Primero: ${useCase.nextStep}`,
        common,
      ].filter(Boolean).join("\n")
    : [
        `Please help me review this ${itemType}: ${useCase.label}.`,
        `Item: ${payload.value.trim()}`,
        question ? `My question: ${question}` : "",
        `First: ${useCase.nextStep}`,
        common,
      ].filter(Boolean).join("\n");

  return {
    kind: "task",
    source: useCase.conciergeSource,
    message,
    flowReference: useCase.conciergeFlow,
    requestedTool: payload.source === "paste_link" ? "web_search" : "operator_review",
    actionLabel: useCase.label,
    summary: isSpanish ? `Revision preparada: ${useCase.label}.` : `Review prepared: ${useCase.label}.`,
    useCase: useCase.conciergeUseCase,
  };
}
