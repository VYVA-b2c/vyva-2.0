import { SHOW_VYVA_USE_CASE_IDS, type ShowVyvaUseCaseId } from "./showVyvaFlow";

export const SHOW_VYVA_FOLLOW_UP_CONTEXTS = {
  scam: "scam",
  healthVisual: "health_visual",
  homeSafety: "home_safety",
  medicine: "medicine",
  document: "document",
  providerDeal: "provider_deal",
} as const;

export type ShowVyvaFollowUpContext =
  typeof SHOW_VYVA_FOLLOW_UP_CONTEXTS[keyof typeof SHOW_VYVA_FOLLOW_UP_CONTEXTS];

export const SHOW_VYVA_FOLLOW_UP_ACTION_IDS = {
  checkCompany: "check_company",
  callTrusted: "call_trusted_contact",
  saveReport: "save_report",
  scamConcierge: "scam_concierge",
  callGp: "call_gp",
  emailGp: "email_gp",
  doctorHelp: "doctor_help",
  scheduleAppointment: "schedule_appointment",
  bookRide: "book_ride",
  saveNote: "save_note",
  buySafetyAid: "buy_safety_aid",
  requestQuote: "request_quote",
  callCareTeam: "call_care_team",
  markSafeNow: "mark_safe_now",
  pharmacistQuestions: "pharmacist_questions",
  medicineSafety: "medicine_safety",
  summarizeDocument: "summarize_document",
  draftReply: "draft_reply",
  prepareCall: "prepare_call",
  comparePrice: "compare_price",
  compareProximity: "compare_proximity",
  checkReputation: "check_reputation",
  checkTerms: "check_terms",
  continueConcierge: "continue_concierge",
} as const;

export type ShowVyvaFollowUpActionId =
  typeof SHOW_VYVA_FOLLOW_UP_ACTION_IDS[keyof typeof SHOW_VYVA_FOLLOW_UP_ACTION_IDS];

export type ShowVyvaFollowUpIcon =
  | "building"
  | "phone"
  | "save"
  | "concierge"
  | "basket"
  | "quote"
  | "check"
  | "pill"
  | "shield"
  | "document"
  | "reply"
  | "price"
  | "map"
  | "star"
  | "terms";

export type ShowVyvaFollowUpTone = "primary" | "safe" | "warm" | "quiet";

export interface ShowVyvaFollowUpAction {
  id: ShowVyvaFollowUpActionId;
  label: string;
  detail: string;
  icon: ShowVyvaFollowUpIcon;
  tone: ShowVyvaFollowUpTone;
  externalAction: boolean;
  requiresConfirmation: boolean;
}

const ACTIONS: Record<ShowVyvaFollowUpActionId, ShowVyvaFollowUpAction> = {
  check_company: {
    id: "check_company",
    label: "Check company",
    detail: "Look up reputation first.",
    icon: "building",
    tone: "quiet",
    externalAction: true,
    requiresConfirmation: true,
  },
  call_trusted_contact: {
    id: "call_trusted_contact",
    label: "Call trusted contact",
    detail: "Ask someone you trust.",
    icon: "phone",
    tone: "safe",
    externalAction: true,
    requiresConfirmation: true,
  },
  save_report: {
    id: "save_report",
    label: "Save or report",
    detail: "Keep a record before acting.",
    icon: "save",
    tone: "warm",
    externalAction: false,
    requiresConfirmation: true,
  },
  scam_concierge: {
    id: "scam_concierge",
    label: "Continue with VYVA",
    detail: "Handle it step by step.",
    icon: "concierge",
    tone: "primary",
    externalAction: false,
    requiresConfirmation: true,
  },
  call_gp: {
    id: "call_gp",
    label: "Call GP",
    detail: "Talk to your doctor.",
    icon: "phone",
    tone: "safe",
    externalAction: true,
    requiresConfirmation: true,
  },
  email_gp: {
    id: "email_gp",
    label: "Email GP",
    detail: "Prepare the scan summary.",
    icon: "reply",
    tone: "quiet",
    externalAction: true,
    requiresConfirmation: true,
  },
  doctor_help: {
    id: "doctor_help",
    label: "Doctor help",
    detail: "Review the next step.",
    icon: "shield",
    tone: "primary",
    externalAction: false,
    requiresConfirmation: true,
  },
  schedule_appointment: {
    id: "schedule_appointment",
    label: "Appointment",
    detail: "Prepare before booking.",
    icon: "quote",
    tone: "warm",
    externalAction: true,
    requiresConfirmation: true,
  },
  book_ride: {
    id: "book_ride",
    label: "Find transport",
    detail: "Plan a safe ride.",
    icon: "map",
    tone: "quiet",
    externalAction: true,
    requiresConfirmation: true,
  },
  save_note: {
    id: "save_note",
    label: "Save note",
    detail: "Keep this for later.",
    icon: "save",
    tone: "quiet",
    externalAction: false,
    requiresConfirmation: false,
  },
  buy_safety_aid: {
    id: "buy_safety_aid",
    label: "Buy safety aid",
    detail: "Compare simple items first.",
    icon: "basket",
    tone: "primary",
    externalAction: true,
    requiresConfirmation: true,
  },
  request_quote: {
    id: "request_quote",
    label: "Request quote",
    detail: "Prepare home help.",
    icon: "quote",
    tone: "warm",
    externalAction: true,
    requiresConfirmation: true,
  },
  call_care_team: {
    id: "call_care_team",
    label: "Call care team",
    detail: "Share the concern.",
    icon: "phone",
    tone: "safe",
    externalAction: true,
    requiresConfirmation: true,
  },
  mark_safe_now: {
    id: "mark_safe_now",
    label: "Safe now",
    detail: "Mark this as handled.",
    icon: "check",
    tone: "safe",
    externalAction: false,
    requiresConfirmation: false,
  },
  pharmacist_questions: {
    id: "pharmacist_questions",
    label: "Pharmacist questions",
    detail: "Prepare what to ask.",
    icon: "pill",
    tone: "primary",
    externalAction: false,
    requiresConfirmation: true,
  },
  medicine_safety: {
    id: "medicine_safety",
    label: "Review safety",
    detail: "Check label and cautions.",
    icon: "shield",
    tone: "safe",
    externalAction: false,
    requiresConfirmation: true,
  },
  summarize_document: {
    id: "summarize_document",
    label: "Summarize",
    detail: "Make it easier to understand.",
    icon: "document",
    tone: "primary",
    externalAction: false,
    requiresConfirmation: true,
  },
  draft_reply: {
    id: "draft_reply",
    label: "Draft reply",
    detail: "Prepare, do not send.",
    icon: "reply",
    tone: "warm",
    externalAction: true,
    requiresConfirmation: true,
  },
  prepare_call: {
    id: "prepare_call",
    label: "Prepare call",
    detail: "Write the key points.",
    icon: "phone",
    tone: "quiet",
    externalAction: true,
    requiresConfirmation: true,
  },
  compare_price: {
    id: "compare_price",
    label: "Compare price",
    detail: "Check if it is fair.",
    icon: "price",
    tone: "primary",
    externalAction: false,
    requiresConfirmation: true,
  },
  compare_proximity: {
    id: "compare_proximity",
    label: "Compare nearby",
    detail: "Include distance and access.",
    icon: "map",
    tone: "quiet",
    externalAction: false,
    requiresConfirmation: true,
  },
  check_reputation: {
    id: "check_reputation",
    label: "Check reputation",
    detail: "Look for trust signals.",
    icon: "star",
    tone: "safe",
    externalAction: true,
    requiresConfirmation: true,
  },
  check_terms: {
    id: "check_terms",
    label: "Check terms",
    detail: "Find hidden conditions.",
    icon: "terms",
    tone: "warm",
    externalAction: false,
    requiresConfirmation: true,
  },
  continue_concierge: {
    id: "continue_concierge",
    label: "Continue with VYVA",
    detail: "Turn this into a plan.",
    icon: "concierge",
    tone: "primary",
    externalAction: false,
    requiresConfirmation: true,
  },
};

const CONTEXT_ACTIONS: Record<ShowVyvaFollowUpContext, ShowVyvaFollowUpActionId[]> = {
  scam: ["check_company", "call_trusted_contact", "save_report", "scam_concierge"],
  health_visual: ["doctor_help", "save_note", "call_gp", "email_gp", "schedule_appointment", "book_ride"],
  home_safety: ["buy_safety_aid", "request_quote", "call_care_team", "save_note", "mark_safe_now"],
  medicine: ["pharmacist_questions", "medicine_safety", "save_note", "continue_concierge"],
  document: ["summarize_document", "draft_reply", "prepare_call", "continue_concierge"],
  provider_deal: ["compare_price", "compare_proximity", "check_reputation", "check_terms", "continue_concierge"],
};

export function showVyvaFollowUpContextForUseCase(useCaseId: ShowVyvaUseCaseId): ShowVyvaFollowUpContext {
  if (useCaseId === SHOW_VYVA_USE_CASE_IDS.scamCheck) return "scam";
  if (useCaseId === SHOW_VYVA_USE_CASE_IDS.medicineOrOtc) return "medicine";
  if (useCaseId === SHOW_VYVA_USE_CASE_IDS.documentHelp) return "document";
  if (useCaseId === SHOW_VYVA_USE_CASE_IDS.providerOrDeal) return "provider_deal";
  return "home_safety";
}

export function showVyvaFollowUpActionsFor(
  context: ShowVyvaFollowUpContext,
  options: { include?: ShowVyvaFollowUpActionId[]; exclude?: ShowVyvaFollowUpActionId[] } = {},
): ShowVyvaFollowUpAction[] {
  const include = options.include ? new Set(options.include) : null;
  const exclude = new Set(options.exclude ?? []);

  return CONTEXT_ACTIONS[context]
    .filter((id) => (!include || include.has(id)) && !exclude.has(id))
    .map((id) => ACTIONS[id]);
}

export function getShowVyvaFollowUpAction(id: ShowVyvaFollowUpActionId): ShowVyvaFollowUpAction {
  return ACTIONS[id];
}
