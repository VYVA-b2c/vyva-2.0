// Care Finder conversation state. Pure and framework-free so the exact same
// transitions run in the UI, in tests, and when resuming a saved task.

import type { ConciergeTaskProgressPayload, PersistedConciergeTaskStage } from "../conciergeTaskDrafts.js";
import {
  CARE_ACCESS_NEED_IDS,
  CARE_AREAS,
  CARE_AREA_IDS,
  CARE_COVERAGE_IDS,
  CARE_URGENCY_IDS,
  CARE_FINDER_WHO,
  careRouteOptions,
  classifyCareNeed,
  inferCareAccessNeeds,
  isCareNeedId,
  isCareTypeId,
  type CareAccessNeedId,
  type CareAccessRoute,
  type CareAreaId,
  type CareCoverageId,
  type CareFinderWho,
  type CareNeedId,
  type CareTypeId,
  type CareUrgencyId,
} from "./careRoutes.js";
import {
  careSafetyCheckRequired,
  detectCareRedFlags,
  isCareRedFlagId,
  type CareRedFlagId,
} from "./redFlags.js";
import { isCareFinderSearchResponse, type CareFinderSearchResponse } from "./search.js";

export const CARE_FINDER_PROGRESS_VERSION = "care_finder_v1";
export const CARE_FINDER_PROVIDER_SEARCH_MODE = "specialist";

export const CARE_FINDER_STEPS = [
  "who",
  "need",
  "area",
  "describe",
  "safety",
  "urgent",
  "timing",
  "profile",
  "coverage",
  "location",
  "route",
  "access",
  "results",
  "contact",
  "done",
] as const;
export type CareFinderStep = typeof CARE_FINDER_STEPS[number];

export const CARE_SHARE_ITEM_IDS = ["reason", "coverage", "access", "companion"] as const;
export type CareShareItemId = typeof CARE_SHARE_ITEM_IDS[number];

export const CARE_OUTCOME_IDS = ["booked", "call_back", "no_answer", "not_suitable"] as const;
export type CareOutcomeId = typeof CARE_OUTCOME_IDS[number];

export interface CareFinderProfileFacts {
  coverage: CareCoverageId | null;
  location: string;
  usualDoctorName: string | null;
}

export interface CareFinderState {
  step: CareFinderStep;
  history: CareFinderStep[];
  who: CareFinderWho | null;
  description: string;
  need: CareNeedId | null;
  area: CareAreaId | null;
  // The description was read but matched no everyday need.
  descriptionUnmatched: boolean;
  safetyAnswered: boolean;
  redFlags: CareRedFlagId[];
  urgentAcknowledged: boolean;
  urgency: CareUrgencyId | null;
  profileConsent: "accepted" | "declined" | null;
  coverage: CareCoverageId | null;
  location: string;
  careType: CareTypeId | null;
  careAccess: CareAccessRoute | null;
  accessAnswered: boolean;
  accessNeeds: CareAccessNeedId[];
  suggestedAccessNeeds: CareAccessNeedId[];
  results: CareFinderSearchResponse | null;
  selectedOptionId: string | null;
  shareItems: CareShareItemId[];
  outcome: CareOutcomeId | null;
  // Present when this state came from a pre-Care-Finder saved task.
  legacy: { foundAt: string | null; hadResults: boolean } | null;
}

export type CareFinderAction =
  | { type: "chooseWho"; who: CareFinderWho }
  | { type: "submitDescription"; text: string }
  | { type: "chooseNeed"; need: CareNeedId }
  | { type: "chooseArea"; area: CareAreaId }
  | { type: "answerSafety"; flags: CareRedFlagId[] }
  | { type: "acknowledgeUrgent" }
  | { type: "chooseUrgency"; urgency: CareUrgencyId }
  | { type: "acceptProfile"; facts: CareFinderProfileFacts }
  | { type: "declineProfile" }
  | { type: "chooseCoverage"; coverage: CareCoverageId }
  | { type: "setLocation"; location: string }
  | { type: "chooseRoute"; careType: CareTypeId; access: CareAccessRoute }
  | { type: "setAccessNeeds"; needs: CareAccessNeedId[] }
  | { type: "resultsLoaded"; results: CareFinderSearchResponse }
  | { type: "selectOption"; optionId: string }
  | { type: "setShareItems"; items: CareShareItemId[] }
  | { type: "recordOutcome"; outcome: CareOutcomeId }
  | { type: "searchAgain" }
  | { type: "back" }
  | { type: "change"; step: CareFinderStep }
  | { type: "restart" };

export function initialCareFinderState(overrides: Partial<CareFinderState> = {}): CareFinderState {
  return {
    step: "who",
    history: [],
    who: null,
    description: "",
    need: null,
    area: null,
    descriptionUnmatched: false,
    safetyAnswered: false,
    redFlags: [],
    urgentAcknowledged: false,
    urgency: null,
    profileConsent: null,
    coverage: null,
    location: "",
    careType: null,
    careAccess: null,
    accessAnswered: false,
    accessNeeds: [],
    suggestedAccessNeeds: [],
    results: null,
    selectedOptionId: null,
    shareItems: ["coverage", "access", "companion"],
    outcome: null,
    legacy: null,
    ...overrides,
  };
}

export function profileHasCareFacts(profile: CareFinderProfileFacts | null | undefined): profile is CareFinderProfileFacts {
  return Boolean(profile && (profile.coverage || profile.location.trim()));
}

/**
 * The first question that still needs an answer, in conversation order.
 * Every transition lands here, so changing one answer only re-asks what
 * genuinely depends on it.
 */
export function nextCareFinderStep(state: CareFinderState, profile?: CareFinderProfileFacts | null): CareFinderStep {
  if (!state.who) return "who";
  if (state.redFlags.length > 0 && !state.urgentAcknowledged) return "urgent";
  if (!state.need) return "need";
  if (state.need === "not_sure" && !state.area) return "area";
  if (state.need === "something_else" && !state.description.trim()) return "describe";
  if (careSafetyCheckRequired(state.need) && !state.safetyAnswered) return "safety";
  if (!state.urgency) return "timing";
  if (!state.coverage || !state.location.trim()) {
    if (state.profileConsent === null && profileHasCareFacts(profile)) return "profile";
    if (!state.coverage) return "coverage";
    return "location";
  }
  if (!state.careType || !state.careAccess) return "route";
  if (!state.accessAnswered) return "access";
  if (state.outcome) return "done";
  if (state.selectedOptionId && state.step === "contact") return "contact";
  return "results";
}

// Answers that become invalid when an earlier answer changes.
function clearAfterNeed(state: CareFinderState): CareFinderState {
  return {
    ...state,
    area: null,
    safetyAnswered: false,
    careType: null,
    careAccess: null,
    results: null,
    selectedOptionId: null,
    outcome: null,
  };
}

function clearRoute(state: CareFinderState): CareFinderState {
  return { ...state, careType: null, careAccess: null, results: null, selectedOptionId: null, outcome: null };
}

function clearResults(state: CareFinderState): CareFinderState {
  return { ...state, results: null, selectedOptionId: null, outcome: null };
}

function mergeAccessSuggestions(state: CareFinderState, text: string): CareFinderState {
  const inferred = inferCareAccessNeeds(text);
  if (inferred.length === 0) return state;
  return {
    ...state,
    suggestedAccessNeeds: Array.from(new Set([...state.suggestedAccessNeeds, ...inferred])),
  };
}

function advance(previous: CareFinderState, next: CareFinderState, profile?: CareFinderProfileFacts | null): CareFinderState {
  const step = nextCareFinderStep(next, profile);
  if (step === previous.step) return { ...next, step };
  return { ...next, step, history: [...previous.history, previous.step].slice(-30) };
}

export function careFinderReducer(
  state: CareFinderState,
  action: CareFinderAction,
  profile?: CareFinderProfileFacts | null,
): CareFinderState {
  switch (action.type) {
    case "chooseWho":
      return advance(state, { ...state, who: action.who }, profile);

    case "submitDescription": {
      const text = action.text.trim().slice(0, 2000);
      if (!text) return state;
      const flags = detectCareRedFlags(text);
      const classified = classifyCareNeed(text);
      let next: CareFinderState = mergeAccessSuggestions({
        ...state,
        description: text,
        redFlags: Array.from(new Set([...state.redFlags, ...flags])),
        urgentAcknowledged: flags.length > 0 ? false : state.urgentAcknowledged,
        descriptionUnmatched: false,
      }, text);
      if (state.step === "describe") {
        // "Something else": keep the person's own words as the need.
        next = { ...next, need: classified ?? "something_else", descriptionUnmatched: !classified };
        if (classified && classified !== state.need) next = { ...clearAfterNeed(next), need: classified };
      } else if (classified) {
        next = classified === state.need ? next : { ...clearAfterNeed(next), need: classified };
      } else {
        next = { ...next, descriptionUnmatched: true };
      }
      return advance(state, next, profile);
    }

    case "chooseNeed": {
      const changed = action.need !== state.need;
      const base = changed ? { ...clearAfterNeed(state), need: action.need } : state;
      return advance(state, { ...base, descriptionUnmatched: false }, profile);
    }

    case "chooseArea": {
      const need = CARE_AREAS[action.area].need;
      const base = need !== state.need ? clearAfterNeed(state) : state;
      return advance(state, { ...base, need, area: action.area }, profile);
    }

    case "answerSafety": {
      const flags = action.flags.filter(isCareRedFlagId);
      // "None of these" keeps any warning already acknowledged from free text.
      return advance(state, {
        ...state,
        safetyAnswered: true,
        redFlags: Array.from(new Set([...state.redFlags, ...flags])),
        urgentAcknowledged: flags.length === 0 ? state.urgentAcknowledged : false,
      }, profile);
    }

    case "acknowledgeUrgent":
      return advance(state, { ...state, urgentAcknowledged: true }, profile);

    case "chooseUrgency": {
      const base = action.urgency !== state.urgency ? clearRoute(state) : state;
      return advance(state, { ...base, urgency: action.urgency }, profile);
    }

    case "acceptProfile": {
      const coverage = action.facts.coverage ?? state.coverage;
      const location = action.facts.location.trim() || state.location;
      const base = coverage !== state.coverage ? clearRoute(state) : clearResults(state);
      return advance(state, { ...base, profileConsent: "accepted", coverage, location }, profile);
    }

    case "declineProfile":
      // Ask the questions directly; keep any earlier explicit answers.
      return { ...state, profileConsent: "declined", step: "coverage", history: [...state.history, state.step] };

    case "chooseCoverage": {
      const base = action.coverage !== state.coverage ? clearRoute(state) : state;
      const next = { ...base, coverage: action.coverage };
      // When someone declined the saved details, confirm the place too.
      if (state.profileConsent === "declined" && state.step === "coverage") {
        return { ...next, step: "location", history: [...state.history, state.step] };
      }
      return advance(state, next, profile);
    }

    case "setLocation": {
      const location = action.location.trim().slice(0, 200);
      if (!location) return state;
      const base = location !== state.location ? clearResults(state) : state;
      return advance(state, { ...base, location }, profile);
    }

    case "chooseRoute": {
      const changed = action.careType !== state.careType || action.access !== state.careAccess;
      const base = changed ? clearResults(state) : state;
      return advance(state, { ...base, careType: action.careType, careAccess: action.access }, profile);
    }

    case "setAccessNeeds": {
      const needs = action.needs.filter((need): need is CareAccessNeedId => (CARE_ACCESS_NEED_IDS as readonly string[]).includes(need));
      const changed = needs.slice().sort().join() !== state.accessNeeds.slice().sort().join();
      const base = changed ? clearResults(state) : state;
      return advance(state, { ...base, accessAnswered: true, accessNeeds: needs }, profile);
    }

    case "resultsLoaded":
      return { ...state, results: action.results, legacy: null, step: "results" };

    case "selectOption":
      return { ...state, selectedOptionId: action.optionId, step: "contact", history: [...state.history, state.step] };

    case "setShareItems":
      return { ...state, shareItems: action.items.filter((item) => (CARE_SHARE_ITEM_IDS as readonly string[]).includes(item)) };

    case "recordOutcome":
      return { ...state, outcome: action.outcome, step: "done", history: [...state.history, state.step] };

    case "searchAgain":
      return { ...clearResults(state), legacy: null, step: "results", history: [...state.history, state.step] };

    case "back": {
      const history = [...state.history];
      while (history.length > 0) {
        const previous = history.pop()!;
        if (previous !== state.step && previous !== "urgent") {
          return { ...state, step: previous, history };
        }
      }
      return { ...state, step: "who", history: [] };
    }

    case "change": {
      // Re-open an answered question from the summary without clearing it;
      // the person's next answer decides what has to be re-asked.
      const reopened = action.step === "profile" ? { ...state, profileConsent: null } : state;
      return { ...reopened, step: action.step, history: [...state.history, state.step] };
    }

    case "restart":
      return initialCareFinderState();

    default:
      return state;
  }
}

export function careFinderRouteOptionsFor(state: CareFinderState) {
  return careRouteOptions({ need: state.need, coverage: state.coverage, urgency: state.urgency });
}

// ── Persistence ──────────────────────────────────────────────────────────────

const LEGACY_DEFAULT_QUERIES = new Set(["find a specialist", "buscar especialista"]);

function legacyCriteriaFor(state: CareFinderState): string[] {
  const criteria = ["nearby"];
  if (state.accessNeeds.includes("step_free")) criteria.push("accessible");
  if (state.coverage) criteria.push("coverage");
  if (state.urgency === "today" || state.urgency === "this_week") criteria.push("available-soon");
  return criteria;
}

function list(values: readonly string[]): string {
  return values.join(",");
}

/** Maps state onto the existing whitelisted concierge task progress payload. */
export function careFinderProgressPayload(state: CareFinderState): ConciergeTaskProgressPayload {
  const answers: Record<string, string> = {
    version: CARE_FINDER_PROGRESS_VERSION,
    who: state.who ?? "",
    need: state.need ?? "",
    area: state.area ?? "",
    safetyAnswered: state.safetyAnswered ? "yes" : "",
    redFlags: list(state.redFlags),
    urgentAcknowledged: state.urgentAcknowledged ? "yes" : "",
    urgency: state.urgency ?? "",
    profileConsent: state.profileConsent ?? "",
    coverage: state.coverage ?? "",
    location: state.location,
    careAccess: state.careAccess ?? "",
    accessAnswered: state.accessAnswered ? "yes" : "",
    accessNeeds: list(state.accessNeeds),
    suggestedAccessNeeds: list(state.suggestedAccessNeeds),
    shareItems: list(state.shareItems),
    outcome: state.outcome ?? "",
  };
  return {
    providerSearchMode: CARE_FINDER_PROVIDER_SEARCH_MODE,
    query: state.description,
    criteria: legacyCriteriaFor(state),
    providerResult: state.results as unknown as Record<string, unknown> | null,
    shortlistIds: (state.results?.options ?? []).map((option) => option.id).slice(0, 3),
    selectedProviderOptionId: state.selectedOptionId,
    canvasStep: state.step,
    serviceType: state.careType,
    answers,
    textDrafts: { description: state.description },
  };
}

export function careFinderTaskStage(state: CareFinderState): PersistedConciergeTaskStage {
  return state.results ? "review" : "details";
}

function oneOf<T extends string>(values: readonly T[], value: unknown): T | null {
  return typeof value === "string" && (values as readonly string[]).includes(value) ? value as T : null;
}

function listOf<T extends string>(values: readonly T[], value: unknown): T[] {
  if (typeof value !== "string" || !value) return [];
  return value.split(",").map((item) => item.trim()).filter((item): item is T => (values as readonly string[]).includes(item));
}

function stepOrNull(value: unknown): CareFinderStep | null {
  return oneOf(CARE_FINDER_STEPS, value);
}

/**
 * Restores a saved provider_contact task. Care Finder tasks restore exactly.
 * Older "specialist" tasks (pre Care Finder) keep their description and any
 * saved results, which are shown with a clear "found earlier" notice.
 */
export function careFinderStateFromProgress(
  progress: ConciergeTaskProgressPayload | null | undefined,
  options: { entryQuery?: string | null; updatedAt?: string | null } = {},
): CareFinderState {
  const payload = progress ?? {};
  const answers = payload.answers ?? {};
  const savedResults = isCareFinderSearchResponse(payload.providerResult) ? payload.providerResult : null;

  if (answers.version === CARE_FINDER_PROGRESS_VERSION) {
    const state = initialCareFinderState({
      who: oneOf(CARE_FINDER_WHO, answers.who),
      description: payload.textDrafts?.description ?? payload.query ?? "",
      need: isCareNeedId(answers.need) ? answers.need : null,
      area: oneOf(CARE_AREA_IDS, answers.area),
      safetyAnswered: answers.safetyAnswered === "yes",
      redFlags: listOf(["chest", "breathing", "stroke", "fall_head", "confusion", "bleeding", "allergic", "severe_headache", "sudden_vision", "self_harm"] as const, answers.redFlags),
      urgentAcknowledged: answers.urgentAcknowledged === "yes",
      urgency: oneOf(CARE_URGENCY_IDS, answers.urgency),
      profileConsent: oneOf(["accepted", "declined"] as const, answers.profileConsent),
      coverage: oneOf(CARE_COVERAGE_IDS, answers.coverage),
      location: answers.location ?? "",
      careType: isCareTypeId(payload.serviceType) ? payload.serviceType : null,
      careAccess: oneOf(["public", "private"] as const, answers.careAccess),
      accessAnswered: answers.accessAnswered === "yes",
      accessNeeds: listOf(CARE_ACCESS_NEED_IDS, answers.accessNeeds),
      suggestedAccessNeeds: listOf(CARE_ACCESS_NEED_IDS, answers.suggestedAccessNeeds),
      results: savedResults,
      selectedOptionId: payload.selectedProviderOptionId ?? null,
      shareItems: answers.shareItems !== undefined ? listOf(CARE_SHARE_ITEM_IDS, answers.shareItems) : ["coverage", "access", "companion"],
      outcome: oneOf(CARE_OUTCOME_IDS, answers.outcome),
    });
    const savedStep = stepOrNull(payload.canvasStep);
    const pending = nextCareFinderStep({ ...state, step: savedStep ?? state.step });
    // Never resume past an unanswered question (or past an urgent warning).
    const resumable = savedStep && CARE_FINDER_STEPS.indexOf(savedStep) <= CARE_FINDER_STEPS.indexOf(pending)
      ? savedStep
      : pending;
    const step = resumable === "contact" && !state.selectedOptionId ? "results" : resumable;
    return { ...state, step };
  }

  // Legacy specialist search: no structured answers were ever captured.
  const rawQuery = (payload.query ?? options.entryQuery ?? "").trim();
  const description = LEGACY_DEFAULT_QUERIES.has(rawQuery.toLowerCase()) ? "" : rawQuery;
  const legacyOptions = Array.isArray((payload.providerResult as { options?: unknown } | null | undefined)?.options)
    ? ((payload.providerResult as { options: unknown[] }).options)
    : [];
  const accessNeeds: CareAccessNeedId[] = (payload.criteria ?? []).includes("accessible") ? ["step_free"] : [];
  return initialCareFinderState({
    description,
    suggestedAccessNeeds: Array.from(new Set([...accessNeeds, ...inferCareAccessNeeds(description)])),
    legacy: { foundAt: options.updatedAt ?? null, hadResults: legacyOptions.length > 0 },
  });
}

export function isCareFinderProviderTask(entry: { kind?: string; providerSearchMode?: string } | null | undefined): boolean {
  return entry?.kind === "provider_contact" && entry.providerSearchMode === CARE_FINDER_PROVIDER_SEARCH_MODE;
}
