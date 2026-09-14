import { buildShowVyvaConfidenceEvidence } from "../../shared/showVyvaConfidenceEvidence";
import { buildShowVyvaDecisionHandoff } from "../../shared/showVyvaDecisionHandoff";
import { getShowVyvaUseCase } from "../../shared/showVyvaFlow";
import type { ShowVyvaReviewContract } from "../../shared/showVyvaReviewContract";
import type { ShowVyvaFollowUpAction } from "../../shared/showVyvaFollowUp";

export const SHOW_VYVA_REVIEW_HISTORY_KEY = "vyva:show-vyva-review-history:v1";
export const SHOW_VYVA_REVIEW_HISTORY_EVENT = "vyva:show-vyva-review-history-updated";
const MAX_HISTORY_ITEMS = 5;

export type ShowVyvaReviewHistoryItem = {
  id: string;
  reviewedAt: string;
  useCaseId: ShowVyvaReviewContract["useCaseId"];
  followUpContext: ShowVyvaReviewContract["followUpContext"];
  inputType: ShowVyvaReviewContract["inputType"];
  source: ShowVyvaReviewContract["source"];
  summary: string;
  decision: string;
  confidenceLabel: string;
  actionSaved: boolean;
  savedActionLabel?: string | null;
  resumeRoute: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function notifyHistoryUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SHOW_VYVA_REVIEW_HISTORY_EVENT));
}

function safeParseHistory(value: string | null): ShowVyvaReviewHistoryItem[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ShowVyvaReviewHistoryItem => (
      Boolean(item)
      && typeof item === "object"
      && typeof (item as ShowVyvaReviewHistoryItem).id === "string"
      && typeof (item as ShowVyvaReviewHistoryItem).summary === "string"
      && typeof (item as ShowVyvaReviewHistoryItem).resumeRoute === "string"
    ));
  } catch {
    return [];
  }
}

function writeHistory(items: ShowVyvaReviewHistoryItem[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(SHOW_VYVA_REVIEW_HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
  notifyHistoryUpdated();
}

function simpleHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function showVyvaReviewHistoryId(contract: ShowVyvaReviewContract): string {
  return simpleHash([
    contract.useCaseId,
    contract.followUpContext,
    contract.inputType,
    contract.source,
    contract.concernSummary,
    contract.fileName ?? "",
    contract.reviewedValue ? contract.reviewedValue.slice(0, 80) : "",
  ].join("|"));
}

export function readShowVyvaReviewHistory(): ShowVyvaReviewHistoryItem[] {
  if (!canUseStorage()) return [];
  return safeParseHistory(window.localStorage.getItem(SHOW_VYVA_REVIEW_HISTORY_KEY));
}

export function upsertShowVyvaReviewHistory(contract: ShowVyvaReviewContract): ShowVyvaReviewHistoryItem {
  const useCase = getShowVyvaUseCase(contract.useCaseId);
  const handoff = buildShowVyvaDecisionHandoff(contract);
  const confidence = buildShowVyvaConfidenceEvidence(contract);
  const id = showVyvaReviewHistoryId(contract);
  const existing = readShowVyvaReviewHistory();
  const previous = existing.find((item) => item.id === id);
  const item: ShowVyvaReviewHistoryItem = {
    id,
    reviewedAt: previous?.reviewedAt ?? new Date().toISOString(),
    useCaseId: contract.useCaseId,
    followUpContext: contract.followUpContext,
    inputType: contract.inputType,
    source: contract.source,
    summary: contract.concernSummary,
    decision: handoff.title,
    confidenceLabel: confidence.label,
    actionSaved: previous?.actionSaved ?? false,
    savedActionLabel: previous?.savedActionLabel ?? null,
    resumeRoute: previous?.resumeRoute ?? useCase.route,
  };
  writeHistory([item, ...existing.filter((historyItem) => historyItem.id !== id)]);
  return item;
}

export function markShowVyvaReviewHistoryActionSaved(
  contract: ShowVyvaReviewContract,
  action: ShowVyvaFollowUpAction,
  resumeRoute: string,
): ShowVyvaReviewHistoryItem {
  const item = upsertShowVyvaReviewHistory(contract);
  const updated: ShowVyvaReviewHistoryItem = {
    ...item,
    actionSaved: true,
    savedActionLabel: action.label,
    resumeRoute,
  };
  const existing = readShowVyvaReviewHistory();
  writeHistory([updated, ...existing.filter((historyItem) => historyItem.id !== updated.id)]);
  return updated;
}
