import { type ConciergeFlowReference } from "./conciergeFlowRegistry";
import {
  getShowVyvaUseCase,
  inferShowVyvaPasteSource,
  type ShowVyvaCaptureSource,
  type ShowVyvaPastePayload,
  type ShowVyvaUseCaseId,
} from "./showVyvaFlow";
import {
  showVyvaFollowUpActionsFor,
  showVyvaFollowUpContextForUseCase,
  type ShowVyvaFollowUpAction,
  type ShowVyvaFollowUpActionId,
  type ShowVyvaFollowUpContext,
} from "./showVyvaFollowUp";
import { type WorkflowReference } from "./workflowRegistry";

export const SHOW_VYVA_REVIEW_INPUT_TYPES = {
  cameraPhoto: "camera_photo",
  uploadedImage: "uploaded_image",
  uploadedDocument: "uploaded_document",
  pastedText: "pasted_text",
  pastedLink: "pasted_link",
  phoneNumber: "phone_number",
  companyName: "company_name",
  documentText: "document_text",
} as const;

export type ShowVyvaReviewInputType =
  typeof SHOW_VYVA_REVIEW_INPUT_TYPES[keyof typeof SHOW_VYVA_REVIEW_INPUT_TYPES];

export const SHOW_VYVA_REVIEW_RISK_LEVELS = ["low", "medium", "high", "unknown"] as const;
export type ShowVyvaReviewRiskLevel = typeof SHOW_VYVA_REVIEW_RISK_LEVELS[number];

export const SHOW_VYVA_REVIEW_CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type ShowVyvaReviewConfidenceLevel = typeof SHOW_VYVA_REVIEW_CONFIDENCE_LEVELS[number];

export const SHOW_VYVA_FINAL_CONFIRMATION_RULE =
  "VYVA prepares the next step first. The user must confirm before anything is forwarded, sent, bought, booked, called, uploaded externally, submitted, or shared.";

export const SHOW_VYVA_REVIEW_CONTEXTS = {
  scam: "scam",
  safeHome: "safe_home",
  healthMedication: "health_medication",
  shoppingAdmin: "shopping_admin",
} as const;

export type ShowVyvaReviewContext = typeof SHOW_VYVA_REVIEW_CONTEXTS[keyof typeof SHOW_VYVA_REVIEW_CONTEXTS];

export interface ShowVyvaReviewInputDescriptor {
  useCaseId: ShowVyvaUseCaseId;
  source: ShowVyvaCaptureSource;
  value?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  hint?: ShowVyvaReviewInputType | null;
  followUpContext?: ShowVyvaFollowUpContext | null;
}

export interface ShowVyvaReviewContract {
  useCaseId: ShowVyvaUseCaseId;
  context: ShowVyvaReviewContext;
  followUpContext: ShowVyvaFollowUpContext;
  inputType: ShowVyvaReviewInputType;
  source: ShowVyvaCaptureSource;
  reviewedValue?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  workflow: WorkflowReference;
  conciergeFlow?: ConciergeFlowReference;
  concernSummary: string;
  riskLevel: ShowVyvaReviewRiskLevel;
  confidenceLevel: ShowVyvaReviewConfidenceLevel;
  verifiedObservations: string[];
  warningSigns: string[];
  unknowns: string[];
  noticed: string[];
  safeNextSteps: string[];
  followUpActions: ShowVyvaFollowUpAction[];
  finalConfirmationRequired: true;
  finalConfirmationRule: string;
}

export interface ShowVyvaReviewDraftInput extends ShowVyvaReviewInputDescriptor {
  concernSummary?: string | null;
  riskLevel?: ShowVyvaReviewRiskLevel | null;
  confidenceLevel?: ShowVyvaReviewConfidenceLevel | null;
  verifiedObservations?: string[] | null;
  warningSigns?: string[] | null;
  unknowns?: string[] | null;
  noticed?: string[] | null;
  safeNextSteps?: string[] | null;
  includeActions?: ShowVyvaFollowUpActionId[] | null;
  excludeActions?: ShowVyvaFollowUpActionId[] | null;
}

export interface ShowVyvaScamLikeResult {
  riskLevel?: string | null;
  resultTitle?: string | null;
  explanation?: string | null;
  steps?: string[] | null;
}

export interface ShowVyvaSafeHomeLikeResult {
  riskLevel?: string | null;
  resultTitle?: string | null;
  hazards?: string[] | null;
  advice?: string | null;
}

export interface ShowVyvaHealthLikeResult {
  severity?: string | null;
  resultTitle?: string | null;
  advice?: string | null;
  visibleObservations?: string[] | null;
  potentialConcerns?: string[] | null;
  uncertainty?: string[] | null;
  recommendedNextStep?: string | null;
}

const DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt"];
const DOCUMENT_MIME_MATCH = /pdf|msword|officedocument|text\/plain|rtf/i;
const PHONE_NUMBER_MATCH = /(?:\+?\d[\s().-]?){7,}\d/;

function cleanList(items: Array<string | null | undefined> | null | undefined): string[] {
  return (items ?? []).map((item) => item?.trim() ?? "").filter(Boolean);
}

function cleanOptional(value: string | null | undefined): string | null {
  const cleaned = value?.trim() ?? "";
  return cleaned || null;
}

function documentLike(input: ShowVyvaReviewInputDescriptor): boolean {
  const fileName = input.fileName?.trim().toLowerCase() ?? "";
  const mimeType = input.mimeType?.trim().toLowerCase() ?? "";
  return DOCUMENT_EXTENSIONS.some((extension) => fileName.endsWith(extension)) || DOCUMENT_MIME_MATCH.test(mimeType);
}

export function showVyvaReviewContextForUseCase(useCaseId: ShowVyvaUseCaseId): ShowVyvaReviewContext {
  return showVyvaReviewContextForFollowUp(showVyvaFollowUpContextForUseCase(useCaseId));
}

export function showVyvaReviewContextForFollowUp(followUpContext: ShowVyvaFollowUpContext): ShowVyvaReviewContext {
  if (followUpContext === "scam") return SHOW_VYVA_REVIEW_CONTEXTS.scam;
  if (followUpContext === "home_safety") return SHOW_VYVA_REVIEW_CONTEXTS.safeHome;
  if (followUpContext === "medicine" || followUpContext === "health_visual") return SHOW_VYVA_REVIEW_CONTEXTS.healthMedication;
  return SHOW_VYVA_REVIEW_CONTEXTS.shoppingAdmin;
}

export function inferShowVyvaReviewInputType(input: ShowVyvaReviewInputDescriptor): ShowVyvaReviewInputType {
  if (input.hint) return input.hint;
  if (input.source === "camera") return SHOW_VYVA_REVIEW_INPUT_TYPES.cameraPhoto;
  if (input.source === "upload") {
    return documentLike(input)
      ? SHOW_VYVA_REVIEW_INPUT_TYPES.uploadedDocument
      : SHOW_VYVA_REVIEW_INPUT_TYPES.uploadedImage;
  }

  const value = input.value?.trim() ?? "";
  if (inferShowVyvaPasteSource(value) === "paste_link") return SHOW_VYVA_REVIEW_INPUT_TYPES.pastedLink;
  if (PHONE_NUMBER_MATCH.test(value)) return SHOW_VYVA_REVIEW_INPUT_TYPES.phoneNumber;

  const useCase = getShowVyvaUseCase(input.useCaseId);
  if (useCase.id === "document_help") return SHOW_VYVA_REVIEW_INPUT_TYPES.documentText;
  if (useCase.id === "scam_check" && value.length > 2 && value.length <= 80 && !/[?!.]/.test(value)) {
    return SHOW_VYVA_REVIEW_INPUT_TYPES.companyName;
  }
  return SHOW_VYVA_REVIEW_INPUT_TYPES.pastedText;
}

function fallbackConcern(inputType: ShowVyvaReviewInputType): string {
  switch (inputType) {
    case "phone_number":
      return "Phone number review";
    case "company_name":
      return "Company reputation review";
    case "pasted_link":
      return "Link review";
    case "uploaded_document":
    case "document_text":
      return "Document review";
    case "camera_photo":
    case "uploaded_image":
      return "Image review";
    default:
      return "Text review";
  }
}

function fallbackNoticed(inputType: ShowVyvaReviewInputType, value?: string | null): string[] {
  if (value?.trim()) return [`Input type: ${fallbackConcern(inputType).toLowerCase()}.`, "No external action has been taken."];
  return [`Input type: ${fallbackConcern(inputType).toLowerCase()}.`];
}

function fallbackUnknowns(inputType: ShowVyvaReviewInputType): string[] {
  if (inputType === SHOW_VYVA_REVIEW_INPUT_TYPES.phoneNumber) {
    return ["A phone number alone does not confirm who is calling or why."];
  }
  if (inputType === SHOW_VYVA_REVIEW_INPUT_TYPES.companyName || inputType === SHOW_VYVA_REVIEW_INPUT_TYPES.pastedLink) {
    return ["This item alone does not confirm the organisation's identity or reputation."];
  }
  if (inputType === SHOW_VYVA_REVIEW_INPUT_TYPES.cameraPhoto || inputType === SHOW_VYVA_REVIEW_INPUT_TYPES.uploadedImage) {
    return ["Details outside the image, or too small to read, cannot be confirmed."];
  }
  return ["Missing pages, context, identity, and authenticity cannot be confirmed from this item alone."];
}

function fallbackNextSteps(context: ShowVyvaReviewContext): string[] {
  if (context === "scam") {
    return ["Do not reply, pay, call back, or share details yet.", "Choose one safe follow-up step."];
  }
  if (context === "safe_home") {
    return ["Confirm whether anything needs urgent help.", "Choose whether to request help, call someone, or mark it handled."];
  }
  if (context === "health_medication") {
    return ["Do not change doses from this review.", "Prepare a doctor or pharmacist question before contacting anyone."];
  }
  return ["Compare the item or document first.", "Prepare a message or next step, then confirm before sending."];
}

function defaultActionIdsForInput(
  followUpContext: ShowVyvaFollowUpContext,
  inputType: ShowVyvaReviewInputType,
): ShowVyvaFollowUpActionId[] | null {
  if (followUpContext !== "scam") return null;

  if (inputType === "phone_number") {
    return ["do_not_reply", "block_or_report", "ask_someone", "check_number", "call_trusted_contact", "save_report", "scam_concierge"];
  }
  if (inputType === "pasted_link") {
    return ["do_not_reply", "block_or_report", "ask_someone", "check_link", "call_trusted_contact", "save_report", "scam_concierge"];
  }
  if (inputType === "company_name") {
    return ["do_not_reply", "block_or_report", "ask_someone", "check_company", "call_trusted_contact", "save_report", "scam_concierge"];
  }
  return ["do_not_reply", "block_or_report", "ask_someone", "forward_email", "check_company", "save_report", "call_trusted_contact", "scam_concierge"];
}

export function buildShowVyvaReviewContract(input: ShowVyvaReviewDraftInput): ShowVyvaReviewContract {
  const useCase = getShowVyvaUseCase(input.useCaseId);
  const inputType = inferShowVyvaReviewInputType(input);
  const followUpContext = input.followUpContext ?? showVyvaFollowUpContextForUseCase(input.useCaseId);
  const context = showVyvaReviewContextForFollowUp(followUpContext);
  const defaultIncludeActions = defaultActionIdsForInput(followUpContext, inputType);
  const actions = showVyvaFollowUpActionsFor(followUpContext, {
    include: input.includeActions ?? defaultIncludeActions ?? undefined,
    exclude: input.excludeActions ?? undefined,
  });
  const providedNoticed = cleanList(input.noticed);
  const verifiedObservations = cleanList(input.verifiedObservations).length
    ? cleanList(input.verifiedObservations)
    : providedNoticed.length
      ? providedNoticed
      : fallbackNoticed(inputType, input.value);
  const warningSigns = cleanList(input.warningSigns);
  const unknowns = cleanList(input.unknowns).length
    ? cleanList(input.unknowns)
    : fallbackUnknowns(inputType);
  const noticed = providedNoticed.length
    ? providedNoticed
    : [...verifiedObservations, ...warningSigns, ...unknowns].slice(0, 8);

  return {
    useCaseId: input.useCaseId,
    context,
    followUpContext,
    inputType,
    source: input.source,
    reviewedValue: cleanOptional(input.value),
    fileName: cleanOptional(input.fileName),
    mimeType: cleanOptional(input.mimeType),
    workflow: useCase.workflow,
    conciergeFlow: useCase.conciergeFlow,
    concernSummary: input.concernSummary?.trim() || fallbackConcern(inputType),
    riskLevel: input.riskLevel ?? "unknown",
    confidenceLevel: input.confidenceLevel ?? "low",
    verifiedObservations,
    warningSigns,
    unknowns,
    noticed,
    safeNextSteps: cleanList(input.safeNextSteps).length ? cleanList(input.safeNextSteps) : fallbackNextSteps(context),
    followUpActions: actions,
    finalConfirmationRequired: true,
    finalConfirmationRule: SHOW_VYVA_FINAL_CONFIRMATION_RULE,
  };
}

function riskFromLabel(label: string | null | undefined): ShowVyvaReviewRiskLevel {
  const normalized = label?.trim().toLowerCase() ?? "";
  if (/(scam|high|serious|urgent|danger)/.test(normalized)) return "high";
  if (/(suspicious|moderate|low risk|caution|review)/.test(normalized)) return "medium";
  if (/(safe|minor|low)/.test(normalized)) return "low";
  return "unknown";
}

export function showVyvaReviewContractFromScamResult(
  input: ShowVyvaReviewInputDescriptor,
  result: ShowVyvaScamLikeResult,
): ShowVyvaReviewContract {
  return buildShowVyvaReviewContract({
    ...input,
    concernSummary: result.resultTitle,
    riskLevel: riskFromLabel(result.riskLevel),
    confidenceLevel: result.riskLevel ? "medium" : "low",
    verifiedObservations: cleanList([result.explanation]),
    warningSigns: /suspicious|scam|high/i.test(result.riskLevel ?? "")
      ? cleanList([result.resultTitle])
      : [],
    unknowns: ["The image alone cannot confirm the sender's identity or whether the request is genuine."],
    noticed: [result.explanation ?? "", ...cleanList(result.steps).slice(0, 1)],
    safeNextSteps: cleanList(result.steps),
  });
}

export function showVyvaReviewContractFromSafeHomeResult(
  input: ShowVyvaReviewInputDescriptor,
  result: ShowVyvaSafeHomeLikeResult,
): ShowVyvaReviewContract {
  return buildShowVyvaReviewContract({
    ...input,
    concernSummary: result.resultTitle,
    riskLevel: riskFromLabel(result.riskLevel),
    confidenceLevel: result.riskLevel ? "medium" : "low",
    verifiedObservations: cleanList([result.advice]),
    warningSigns: cleanList(result.hazards),
    unknowns: ["Areas outside the photo and hazards hidden from view were not reviewed."],
    noticed: cleanList(result.hazards).length ? cleanList(result.hazards) : [result.advice ?? ""],
    safeNextSteps: cleanList([result.advice]),
  });
}

export function showVyvaReviewContractFromHealthResult(
  input: ShowVyvaReviewInputDescriptor,
  result: ShowVyvaHealthLikeResult,
): ShowVyvaReviewContract {
  return buildShowVyvaReviewContract({
    ...input,
    concernSummary: result.resultTitle,
    riskLevel: riskFromLabel(result.severity),
    confidenceLevel: result.severity ? "medium" : "low",
    verifiedObservations: cleanList(result.visibleObservations),
    warningSigns: cleanList(result.potentialConcerns),
    unknowns: cleanList(result.uncertainty),
    noticed: [
      ...cleanList(result.visibleObservations),
      ...cleanList(result.potentialConcerns),
      ...cleanList(result.uncertainty),
    ],
    safeNextSteps: cleanList([result.recommendedNextStep, result.advice]),
  });
}

export function showVyvaReviewContractFromPastePayload(payload: ShowVyvaPastePayload): ShowVyvaReviewContract {
  const trimmed = payload.value.trim();
  const inputType = inferShowVyvaReviewInputType({
    useCaseId: payload.useCaseId,
    source: payload.source,
    value: trimmed,
  });
  const valueHint = trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
  const concernSummary = fallbackConcern(inputType);
  const inputSummary = valueHint ? `${concernSummary}: ${valueHint}` : concernSummary;

  return buildShowVyvaReviewContract({
    useCaseId: payload.useCaseId,
    source: payload.source,
    value: trimmed,
    concernSummary,
    riskLevel: "unknown",
    confidenceLevel: "low",
    verifiedObservations: [`VYVA received this as ${concernSummary.toLowerCase()}.`],
    warningSigns: [],
    unknowns: ["The pasted item has not independently confirmed identity, authenticity, or full context."],
    noticed: [
      `VYVA reviewed this as ${concernSummary.toLowerCase()}.`,
      "Nothing has been sent, called, uploaded externally, paid, or shared.",
    ],
    safeNextSteps: [
      inputSummary,
      ...fallbackNextSteps(showVyvaReviewContextForUseCase(payload.useCaseId)),
    ],
  });
}
