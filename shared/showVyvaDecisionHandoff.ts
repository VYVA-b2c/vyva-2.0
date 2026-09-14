import type { ShowVyvaReviewContract } from "./showVyvaReviewContract";
import {
  showVyvaFollowUpActionsFor,
  type ShowVyvaFollowUpAction,
  type ShowVyvaFollowUpActionId,
} from "./showVyvaFollowUp";

export type ShowVyvaDecisionTone = "safe" | "care" | "warn" | "neutral";

export interface ShowVyvaDecisionHandoff {
  title: string;
  subtitle: string;
  tone: ShowVyvaDecisionTone;
  actions: ShowVyvaFollowUpAction[];
  explainItems: string[];
}

const TITLE_BY_CONTEXT: Record<ShowVyvaReviewContract["followUpContext"], string> = {
  scam: "This looks risky",
  document: "This needs checking",
  medicine: "Check before using",
  health_visual: "Check before acting",
  home_safety: "Make this safer",
  provider_deal: "Compare before deciding",
};

const ACTION_IDS_BY_CONTEXT: Record<ShowVyvaReviewContract["followUpContext"], ShowVyvaFollowUpActionId[]> = {
  scam: ["do_not_reply", "block_or_report", "ask_someone"],
  document: ["save_note", "ask_provider", "compare_options"],
  medicine: ["save_note", "pharmacist_questions", "call_gp"],
  health_visual: ["save_note", "doctor_help", "call_gp"],
  home_safety: ["mark_safe_now", "request_quote", "call_care_team"],
  provider_deal: ["find_alternatives", "save_note", "continue_concierge"],
};

function toneFor(contract: ShowVyvaReviewContract): ShowVyvaDecisionTone {
  if (contract.riskLevel === "high") return "warn";
  if (contract.riskLevel === "medium") return "care";
  if (contract.riskLevel === "low") return "safe";
  return "neutral";
}

function subtitleFor(contract: ShowVyvaReviewContract): string {
  return contract.safeNextSteps[0]
    ?? contract.warningSigns[0]
    ?? contract.verifiedObservations[0]
    ?? contract.concernSummary;
}

function uniqueItems(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const cleaned = item.trim();
    if (!cleaned || seen.has(cleaned)) return false;
    seen.add(cleaned);
    return true;
  });
}

export function buildShowVyvaDecisionHandoff(contract: ShowVyvaReviewContract): ShowVyvaDecisionHandoff {
  const preferredIds = ACTION_IDS_BY_CONTEXT[contract.followUpContext];
  const preferredActions = showVyvaFollowUpActionsFor(contract.followUpContext, { include: preferredIds });
  const fallbackActions = contract.followUpActions.length
    ? contract.followUpActions
    : showVyvaFollowUpActionsFor(contract.followUpContext);
  const actionsById = new Map<ShowVyvaFollowUpActionId, ShowVyvaFollowUpAction>();

  for (const action of [...preferredActions, ...fallbackActions]) {
    if (!actionsById.has(action.id)) actionsById.set(action.id, action);
  }

  return {
    title: TITLE_BY_CONTEXT[contract.followUpContext],
    subtitle: subtitleFor(contract),
    tone: toneFor(contract),
    actions: Array.from(actionsById.values()).slice(0, 3),
    explainItems: uniqueItems([
      ...contract.warningSigns,
      ...contract.verifiedObservations,
      ...contract.unknowns,
      ...contract.safeNextSteps,
    ]).slice(0, 6),
  };
}
