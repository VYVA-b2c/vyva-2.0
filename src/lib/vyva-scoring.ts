/**
 * VYVA Brain & Wellbeing Intelligence scoring engine.
 *
 * MVP principle:
 * - This is an internal wellbeing signal engine, not a clinical instrument.
 * - Higher signal values mean "more attention may help," not disease probability.
 * - User-facing text must stay warm, practical, and condition-free.
 */

export const FORBIDDEN_USER_FACING_TERMS = [
  "dementia",
  "alzheimer",
  "alzheimers",
  "alzheimer's",
  "mci",
  "cognitive impairment",
  "diagnosis",
  "clinical risk",
  "disease prediction",
  "pathology",
];

export type Domain =
  | "mood"
  | "social"
  | "sleep"
  | "routine"
  | "medication"
  | "nutrition"
  | "hydration"
  | "mobility"
  | "pain_fatigue"
  | "hearing_vision"
  | "subjective_memory"
  | "planning"
  | "language"
  | "prospective_memory"
  | "global_wellbeing"
  | string;

export type AnswerType =
  | "SCALE_CHANGE"
  | "SCALE_FREQUENCY"
  | "SCALE_DIFFICULTY"
  | "SCALE_SOCIAL"
  | "ACTION_PREFERENCE"
  | "YES_NO"
  | "FREE_TEXT"
  | "TASK_STORY"
  | "TASK_FLUENCY"
  | "TASK_PLANNING"
  | "TASK_PROSPECTIVE"
  | "NUMERIC"
  | string;

export type SignalSource =
  | "RESPONSE"
  | "MEDICATION"
  | "ROUTINE"
  | "CAREGIVER_NOTE"
  | "TRANSCRIPT_METADATA"
  | "response"
  | "medication"
  | "routine"
  | "caregiver_note"
  | "transcript_metadata";

export type TrendDirection = "improving" | "stable" | "worsening" | "unknown";
export type InsightSeverity = "POSITIVE" | "NEUTRAL" | "WATCH" | "ATTENTION";
export type AlertSeverity = "INFO" | "ATTENTION" | "URGENT";

export interface QuestionLike {
  id: string;
  domain: Domain;
  answerType: AnswerType;
  questionText?: string;
  triggerRule?: string | null;
}

export interface ResponseLike {
  id?: string;
  seniorId?: string;
  questionId: string;
  answerText?: string | null;
  answerValue?: number | null;
  answerJson?: string | null;
  createdAt: Date | string;
  question?: QuestionLike;
}

export interface SignalInput {
  seniorId?: string;
  responseId?: string;
  domain: Domain;
  value: number; // 0-100 internal concern scale
  normalizedValue?: number | null;
  source: SignalSource;
  confidence: number; // 0-1
  createdAt: Date;
  evidence?: Record<string, unknown>;
}

export interface BaselineMetricInput {
  seniorId?: string;
  domain: Domain;
  baselineMean: number;
  baselineStd: number;
  sampleCount: number;
  windowDays: number;
  status: "COLLECTING" | "ACTIVE";
  updatedAt: Date;
}

export interface TrendResult {
  domain: Domain;
  latestValue: number | null;
  average7d: number | null;
  average30d: number | null;
  baselineMean: number | null;
  baselineStd: number | null;
  sampleCount7d: number;
  sampleCount30d: number;
  changeFromBaseline: number | null;
  zChange: number | null;
  reliableChangeIndex: number | null;
  direction: TrendDirection;
  severity: InsightSeverity;
  confidence: number;
}

export interface InsightCard {
  type: string;
  domain: Domain | "combined";
  title: string;
  summary: string;
  evidence: Record<string, unknown>;
  severity: InsightSeverity;
  confidence: number;
}

export interface PreventionRecommendationCard {
  domain: Domain | "combined";
  title: string;
  body: string;
  actionType:
    | "plan_call"
    | "routine_reminder"
    | "hydration_reminder"
    | "meal_reminder"
    | "wind_down_reminder"
    | "movement_prompt"
    | "simplify_day"
    | "accessibility_adjustment"
    | "caregiver_share"
    | "professional_discussion"
    | "check_in_tomorrow";
}

export interface AlertCandidate {
  type: string;
  severity: AlertSeverity;
  message: string;
  evidence: Record<string, unknown>;
}

const SCORE_FLOOR_STD = 8;
const DEFAULT_RELIABILITY = 0.75;

const CHANGE_SCALE: Record<string, number> = {
  "better than usual": 10,
  better: 10,
  "about the same": 25,
  same: 25,
  "a little worse than usual": 60,
  "a little worse": 60,
  worse: 60,
  "much worse than usual": 90,
  "much worse": 90,
  "not sure": 50,
};

const FREQUENCY_SCALE: Record<string, number> = {
  "not this week": 10,
  never: 10,
  "once or twice": 35,
  sometimes: 45,
  "several times": 65,
  often: 75,
  "most days": 85,
  "not sure": 50,
};

const DIFFICULTY_SCALE: Record<string, number> = {
  easy: 10,
  "a little difficult": 45,
  difficult: 60,
  "very difficult": 80,
  "i could not do it": 92,
  "could not do it": 92,
  "not applicable": 35,
  "not sure": 50,
};

const SOCIAL_SCALE: Record<string, number> = {
  "yes, meaningful conversation": 10,
  yes: 10,
  "a short exchange only": 45,
  "not really": 75,
  "i avoided contact": 85,
  avoided: 85,
  "not sure": 50,
};

const ACTION_PREFERENCE_SCALE: Record<string, number> = {
  "yes, please": 40,
  yes: 40,
  "maybe later": 35,
  "no, thank you": 20,
  no: 20,
  "i want to tell my caregiver": 70,
  "tell my caregiver": 70,
  "i want help now": 95,
  "help now": 95,
};

const POSITIVE_WORDS = ["enjoy", "calm", "better", "helped", "good", "connected", "steady", "easier"];
const CONCERN_WORDS = [
  "lonely",
  "alone",
  "worried",
  "hard",
  "harder",
  "tired",
  "forgot",
  "missed",
  "pain",
  "unsteady",
  "afraid",
  "difficult",
  "couldn't",
  "could not",
];

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function normalizeText(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function mapScale(answerType: AnswerType, answerText?: string | null, answerValue?: number | null): number | null {
  if (typeof answerValue === "number" && Number.isFinite(answerValue)) return clamp(answerValue);

  const text = normalizeText(answerText);
  if (!text) return null;

  if (answerType === "SCALE_CHANGE") return CHANGE_SCALE[text] ?? null;
  if (answerType === "SCALE_FREQUENCY") return FREQUENCY_SCALE[text] ?? null;
  if (answerType === "SCALE_DIFFICULTY") return DIFFICULTY_SCALE[text] ?? null;
  if (answerType === "SCALE_SOCIAL") return SOCIAL_SCALE[text] ?? null;
  if (answerType === "ACTION_PREFERENCE") return ACTION_PREFERENCE_SCALE[text] ?? null;

  if (answerType === "YES_NO") {
    if (["yes", "y", "true"].includes(text)) return 75;
    if (["no", "n", "false"].includes(text)) return 20;
    return 50;
  }

  return null;
}

export function assertSafeUserFacingText(text: string): void {
  const lower = text.toLowerCase();
  const found = FORBIDDEN_USER_FACING_TERMS.find((term) => lower.includes(term));
  if (found) throw new Error(`Unsafe user-facing term detected: ${found}`);
}

export function safeInsight(card: InsightCard): InsightCard {
  assertSafeUserFacingText(`${card.title} ${card.summary}`);
  return card;
}

export function safeRecommendation(card: PreventionRecommendationCard): PreventionRecommendationCard {
  assertSafeUserFacingText(`${card.title} ${card.body}`);
  return card;
}

export function safeAlert(candidate: AlertCandidate): AlertCandidate {
  assertSafeUserFacingText(candidate.message);
  return candidate;
}

export function normalizeAnswerToSignal(response: ResponseLike): SignalInput | null {
  const question = response.question;
  if (!question) return null;

  const mapped = mapScale(question.answerType, response.answerText, response.answerValue);
  if (mapped !== null) {
    return {
      seniorId: response.seniorId,
      responseId: response.id,
      domain: question.domain,
      value: mapped,
      source: "RESPONSE",
      confidence: mapped === 50 ? 0.45 : 0.75,
      createdAt: asDate(response.createdAt),
      evidence: {
        questionId: response.questionId,
        answerType: question.answerType,
        answerText: response.answerText ?? null,
      },
    };
  }

  if (["FREE_TEXT", "TASK_STORY", "TASK_PLANNING", "TASK_PROSPECTIVE"].includes(question.answerType)) {
    return scoreNarrativeResponse(response, question);
  }

  if (question.answerType === "TASK_FLUENCY") {
    return scoreFluencyResponse(response, question);
  }

  return null;
}

export function scoreNarrativeResponse(response: ResponseLike, question: QuestionLike): SignalInput | null {
  const text = response.answerText ?? "";
  if (!text.trim()) return null;

  const metadata = extractTranscriptMetadata(text);
  const concernHits = countMatches(text, CONCERN_WORDS);
  const positiveHits = countMatches(text, POSITIVE_WORDS);
  const lowDetailPenalty = metadata.wordCount < 8 ? 18 : metadata.wordCount < 18 ? 8 : 0;
  const concernScore = concernHits * 10 - positiveHits * 5 + metadata.hesitationCount * 3 + lowDetailPenalty;

  return {
    seniorId: response.seniorId,
    responseId: response.id,
    domain: question.domain,
    value: clamp(35 + concernScore, 10, 90),
    source: "RESPONSE",
    confidence: 0.45,
    createdAt: asDate(response.createdAt),
    evidence: {
      questionId: response.questionId,
      transcript: metadata,
      concernHits,
      positiveHits,
    },
  };
}

export function scoreFluencyResponse(response: ResponseLike, question: QuestionLike): SignalInput | null {
  const text = response.answerText ?? "";
  if (!text.trim()) return null;

  const tokens = tokenize(text);
  const unique = new Set(tokens);
  const repetitions = Math.max(0, tokens.length - unique.size);
  // Internal MVP heuristic only. Later this should be normed by language, category, age, and education.
  const value = clamp(65 - unique.size * 2.2 + repetitions * 6, 10, 90);

  return {
    seniorId: response.seniorId,
    responseId: response.id,
    domain: question.domain,
    value,
    source: "RESPONSE",
    confidence: 0.5,
    createdAt: asDate(response.createdAt),
    evidence: {
      questionId: response.questionId,
      uniqueWordCount: unique.size,
      totalWordCount: tokens.length,
      repetitions,
    },
  };
}

export function medicationEventToSignal(args: {
  seniorId: string;
  status: string;
  scheduledFor: Date | string;
  recordedAt?: Date | string | null;
}): SignalInput {
  const status = args.status.toUpperCase();
  const value = status === "TAKEN" ? 12 : status === "REMIND_LATER" ? 45 : status === "SKIPPED" ? 65 : status === "MISSED" ? 88 : 50;
  return {
    seniorId: args.seniorId,
    domain: "medication",
    value,
    source: "MEDICATION",
    confidence: 0.85,
    createdAt: asDate(args.recordedAt ?? args.scheduledFor),
    evidence: { status },
  };
}

export function routineEventToSignal(args: {
  seniorId: string;
  status: string;
  scheduledFor: Date | string;
  recordedAt?: Date | string | null;
}): SignalInput {
  const status = args.status.toUpperCase();
  const value = status === "DONE" ? 15 : status === "REMIND_LATER" ? 45 : status === "SKIPPED" ? 62 : status === "MISSED" ? 82 : 50;
  return {
    seniorId: args.seniorId,
    domain: "routine",
    value,
    source: "ROUTINE",
    confidence: 0.8,
    createdAt: asDate(args.recordedAt ?? args.scheduledFor),
    evidence: { status },
  };
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function std(values: number[]): number {
  if (values.length < 2) return SCORE_FLOOR_STD;
  const m = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1);
  return Math.max(Math.sqrt(variance), SCORE_FLOOR_STD);
}

function withinDays(signal: SignalInput, now: Date, days: number): boolean {
  return signal.createdAt.getTime() >= now.getTime() - days * 24 * 60 * 60 * 1000;
}

function daysBetween(start: Date, end: Date): number {
  return Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
}

export function buildBaseline(
  signals: SignalInput[],
  domain: Domain,
  options: { minSamples?: number; windowDays?: number; now?: Date } = {},
): BaselineMetricInput {
  const minSamples = options.minSamples ?? 6;
  const windowDays = options.windowDays ?? 14;
  const domainSignals = signals
    .filter((signal) => signal.domain === domain)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (domainSignals.length < minSamples) {
    return {
      domain,
      baselineMean: mean(domainSignals.map((signal) => signal.value)),
      baselineStd: std(domainSignals.map((signal) => signal.value)),
      sampleCount: domainSignals.length,
      windowDays,
      status: "COLLECTING",
      updatedAt: options.now ?? new Date(),
    };
  }

  const firstDate = domainSignals[0].createdAt;
  let baselineSignals = domainSignals.filter((signal) => daysBetween(firstDate, signal.createdAt) <= windowDays);
  if (baselineSignals.length < minSamples) baselineSignals = domainSignals.slice(0, minSamples);

  const values = baselineSignals.map((signal) => signal.value);
  return {
    domain,
    baselineMean: mean(values),
    baselineStd: std(values),
    sampleCount: values.length,
    windowDays,
    status: values.length >= minSamples ? "ACTIVE" : "COLLECTING",
    updatedAt: options.now ?? new Date(),
  };
}

export function computeTrend(
  signals: SignalInput[],
  baseline: BaselineMetricInput | null,
  domain: Domain,
  options: { now?: Date; reliability?: number } = {},
): TrendResult {
  const now = options.now ?? new Date();
  const reliability = options.reliability ?? DEFAULT_RELIABILITY;
  const domainSignals = signals
    .filter((signal) => signal.domain === domain)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const recent7 = domainSignals.filter((signal) => withinDays(signal, now, 7));
  const recent30 = domainSignals.filter((signal) => withinDays(signal, now, 30));
  const latest = domainSignals.at(-1)?.value ?? null;
  const average7d = recent7.length ? mean(recent7.map((signal) => signal.value)) : null;
  const average30d = recent30.length ? mean(recent30.map((signal) => signal.value)) : null;

  if (!baseline || baseline.status !== "ACTIVE" || average7d === null) {
    return {
      domain,
      latestValue: latest,
      average7d,
      average30d,
      baselineMean: baseline?.baselineMean ?? null,
      baselineStd: baseline?.baselineStd ?? null,
      sampleCount7d: recent7.length,
      sampleCount30d: recent30.length,
      changeFromBaseline: null,
      zChange: null,
      reliableChangeIndex: null,
      direction: "unknown",
      severity: "NEUTRAL",
      confidence: confidenceFromSamples(recent7.length, baseline?.sampleCount ?? 0),
    };
  }

  const baselineStd = Math.max(baseline.baselineStd, SCORE_FLOOR_STD);
  const changeFromBaseline = average7d - baseline.baselineMean;
  const zChange = changeFromBaseline / baselineStd;
  const standardErrorMeasurement = baselineStd * Math.sqrt(1 - reliability);
  const reliableChangeIndex = changeFromBaseline / Math.sqrt(2 * standardErrorMeasurement ** 2);
  const confidence = confidenceFromSamples(recent7.length, baseline.sampleCount);

  let direction: TrendDirection = "stable";
  if (zChange >= 0.7) direction = "worsening";
  if (zChange <= -0.7) direction = "improving";

  let severity: InsightSeverity = "NEUTRAL";
  if (direction === "improving" && confidence >= 0.45) severity = "POSITIVE";
  if (zChange >= 0.7 && zChange < 1.3) severity = "WATCH";
  if (zChange >= 1.3 || reliableChangeIndex >= 1.96) severity = "ATTENTION";

  return {
    domain,
    latestValue: latest,
    average7d,
    average30d,
    baselineMean: baseline.baselineMean,
    baselineStd,
    sampleCount7d: recent7.length,
    sampleCount30d: recent30.length,
    changeFromBaseline,
    zChange,
    reliableChangeIndex,
    direction,
    severity,
    confidence,
  };
}

export function generateInsights(trends: TrendResult[]): InsightCard[] {
  const byDomain = new Map(trends.map((trend) => [trend.domain, trend]));
  const insights: InsightCard[] = [];

  const social = byDomain.get("social");
  if (isMeaningfulWorsening(social)) {
    insights.push(safeInsight({
      type: "lower_social_contact",
      domain: "social",
      title: "This week was quieter than usual",
      summary: "Recent check-ins suggest less meaningful conversation than your usual pattern. A short call or visit may help.",
      evidence: trendEvidence(social),
      severity: social.severity,
      confidence: social.confidence,
    }));
  }

  const sleep = byDomain.get("sleep");
  const mood = byDomain.get("mood");
  if (isMeaningfulWorsening(sleep) && isMeaningfulWorsening(mood)) {
    insights.push(safeInsight({
      type: "sleep_mood_dip",
      domain: "combined",
      title: "Sleep and mood both dipped this week",
      summary: "Sleep and mood answers changed together. A calmer evening routine may help make tomorrow easier.",
      evidence: { sleep: trendEvidence(sleep), mood: trendEvidence(mood) },
      severity: maxSeverity(sleep.severity, mood.severity),
      confidence: Math.min(sleep.confidence, mood.confidence),
    }));
  }

  const routine = byDomain.get("routine");
  const medication = byDomain.get("medication");
  if (isMeaningfulWorsening(routine) || isMeaningfulWorsening(medication)) {
    const trend = strongerTrend(routine, medication);
    insights.push(safeInsight({
      type: "routine_consistency_change",
      domain: "routine",
      title: "Routine was harder than usual",
      summary: "Recent signals suggest the week was less steady than your usual pattern. A simpler reminder may help.",
      evidence: trendEvidence(trend),
      severity: trend.severity,
      confidence: trend.confidence,
    }));
  }

  const sensory = byDomain.get("hearing_vision");
  if (isMeaningfulWorsening(sensory)) {
    insights.push(safeInsight({
      type: "sensory_barrier",
      domain: "hearing_vision",
      title: "Hearing or vision may be making things harder",
      summary: "Recent answers suggest hearing or vision barriers may be affecting daily activities or social contact.",
      evidence: trendEvidence(sensory),
      severity: sensory.severity,
      confidence: sensory.confidence,
    }));
  }

  const memory = byDomain.get("subjective_memory");
  if (isMeaningfulWorsening(memory)) {
    insights.push(safeInsight({
      type: "memory_support_need",
      domain: "subjective_memory",
      title: "Remembering felt harder this week",
      summary: "You reported more everyday memory difficulty than your usual pattern. Gentle reminders may make the week easier.",
      evidence: trendEvidence(memory),
      severity: memory.severity,
      confidence: memory.confidence,
    }));
  }

  const planning = byDomain.get("planning");
  if (isMeaningfulWorsening(planning)) {
    insights.push(safeInsight({
      type: "planning_load_change",
      domain: "planning",
      title: "Planning felt heavier than usual",
      summary: "Recent answers suggest appointments, calls, or daily steps may have felt more complicated this week.",
      evidence: trendEvidence(planning),
      severity: planning.severity,
      confidence: planning.confidence,
    }));
  }

  const mobility = byDomain.get("mobility");
  if (isMeaningfulWorsening(mobility)) {
    insights.push(safeInsight({
      type: "mobility_confidence_change",
      domain: "mobility",
      title: "Moving around felt less steady than usual",
      summary: "Recent answers suggest confidence moving around changed this week. Planning activities for safe times may help.",
      evidence: trendEvidence(mobility),
      severity: mobility.severity,
      confidence: mobility.confidence,
    }));
  }

  const hydration = byDomain.get("hydration");
  const nutrition = byDomain.get("nutrition");
  if (isMeaningfulWorsening(hydration) || isMeaningfulWorsening(nutrition)) {
    const trend = strongerTrend(hydration, nutrition);
    insights.push(safeInsight({
      type: "food_water_routine_change",
      domain: trend.domain,
      title: "Meals or water were less steady this week",
      summary: "Recent answers suggest food or water routines may need a little extra support.",
      evidence: trendEvidence(trend),
      severity: trend.severity,
      confidence: trend.confidence,
    }));
  }

  if (!insights.length) {
    insights.push(safeInsight({
      type: "stable_week",
      domain: "global_wellbeing",
      title: "Things look steady this week",
      summary: "Your recent check-ins look close to your usual pattern. Keeping small routines going can help VYVA support you.",
      evidence: { domainsChecked: trends.map((trend) => trend.domain) },
      severity: "POSITIVE",
      confidence: 0.65,
    }));
  }

  return insights;
}

export function generatePreventionRecommendation(insight: InsightCard): PreventionRecommendationCard | null {
  const recommendations: Record<string, PreventionRecommendationCard> = {
    lower_social_contact: {
      domain: "social",
      title: "Plan one short call",
      body: "VYVA can help choose one person and one simple time for a short conversation.",
      actionType: "plan_call",
    },
    sleep_mood_dip: {
      domain: "combined",
      title: "Try a calmer evening routine",
      body: "VYVA can add a gentle evening reminder to help make tomorrow easier.",
      actionType: "wind_down_reminder",
    },
    routine_consistency_change: {
      domain: "routine",
      title: "Simplify tomorrow morning",
      body: "VYVA can help plan two simple steps for the morning.",
      actionType: "routine_reminder",
    },
    sensory_barrier: {
      domain: "hearing_vision",
      title: "Adjust how VYVA supports you",
      body: "VYVA can use larger text, slower speech, or repeated reminders. It may also help to mention these changes to someone trusted or a professional.",
      actionType: "accessibility_adjustment",
    },
    memory_support_need: {
      domain: "subjective_memory",
      title: "Add one helpful reminder",
      body: "Choose one thing VYVA should help you remember next week.",
      actionType: "routine_reminder",
    },
    planning_load_change: {
      domain: "planning",
      title: "Make tomorrow simpler",
      body: "VYVA can help break tomorrow into two or three clear steps.",
      actionType: "simplify_day",
    },
    mobility_confidence_change: {
      domain: "mobility",
      title: "Choose a safe movement moment",
      body: "VYVA can suggest gentle movement only when you feel safe and ready.",
      actionType: "movement_prompt",
    },
    food_water_routine_change: {
      domain: insight.domain,
      title: "Add a small food or water reminder",
      body: "VYVA can add a simple meal or water reminder at a time that suits you.",
      actionType: insight.domain === "hydration" ? "hydration_reminder" : "meal_reminder",
    },
    stable_week: {
      domain: "global_wellbeing",
      title: "Keep the steady routine going",
      body: "VYVA can check in again next week and help keep the small routines that worked.",
      actionType: "check_in_tomorrow",
    },
  };

  const recommendation = recommendations[insight.type] ?? null;
  return recommendation ? safeRecommendation(recommendation) : null;
}

export function generatePreventionRecommendations(insights: InsightCard[]): PreventionRecommendationCard[] {
  return insights
    .map((insight) => generatePreventionRecommendation(insight))
    .filter((item): item is PreventionRecommendationCard => Boolean(item));
}

export function shouldCreateCaregiverAlert(args: {
  insight: InsightCard;
  consentCaregiverAlerts: boolean;
  userPressedHelp?: boolean;
}): boolean {
  if (args.userPressedHelp) return true;
  if (!args.consentCaregiverAlerts) return false;
  if (args.insight.severity === "ATTENTION") return true;
  return args.insight.severity === "WATCH" && args.insight.confidence >= 0.7;
}

export function caregiverAlertFromInsight(args: {
  seniorName: string;
  insight: InsightCard;
  consentCaregiverAlerts: boolean;
  userPressedHelp?: boolean;
}): AlertCandidate | null {
  if (!shouldCreateCaregiverAlert(args)) return null;

  const severity: AlertSeverity = args.userPressedHelp ? "URGENT" : args.insight.severity === "ATTENTION" ? "ATTENTION" : "INFO";
  return safeAlert({
    type: args.insight.type,
    severity,
    message: `${args.seniorName}: ${args.insight.title}. Follow-up may help. This is a wellbeing signal only.`,
    evidence: args.insight.evidence,
  });
}

export function extractTranscriptMetadata(text: string): {
  wordCount: number;
  averageWordsPerSentence: number;
  hesitationCount: number;
  repeatedPhraseCount: number;
} {
  const sentences = text.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
  const tokens = tokenize(text);
  const hesitationCount = tokens.filter((token) => ["um", "uh", "erm", "hmm"].includes(token)).length;
  let repeatedPhraseCount = 0;
  for (let index = 1; index < tokens.length; index += 1) {
    if (tokens[index] === tokens[index - 1]) repeatedPhraseCount += 1;
  }

  return {
    wordCount: tokens.length,
    averageWordsPerSentence: sentences.length ? tokens.length / sentences.length : tokens.length,
    hesitationCount,
    repeatedPhraseCount,
  };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function countMatches(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  return terms.reduce((count, term) => count + (lower.includes(term) ? 1 : 0), 0);
}

function confidenceFromSamples(recentSampleCount: number, baselineSampleCount: number): number {
  const recent = Math.min(1, recentSampleCount / 4) * 0.55;
  const baseline = Math.min(1, baselineSampleCount / 10) * 0.35;
  return Number((0.1 + recent + baseline).toFixed(2));
}

function isMeaningfulWorsening(trend?: TrendResult): trend is TrendResult {
  if (!trend) return false;
  return trend.direction === "worsening" && trend.severity !== "NEUTRAL" && trend.confidence >= 0.45;
}

function severityRank(severity: InsightSeverity): number {
  return { POSITIVE: 0, NEUTRAL: 1, WATCH: 2, ATTENTION: 3 }[severity];
}

function maxSeverity(a: InsightSeverity, b: InsightSeverity): InsightSeverity {
  return severityRank(a) >= severityRank(b) ? a : b;
}

function strongerTrend(a?: TrendResult, b?: TrendResult): TrendResult {
  if (a && !b) return a;
  if (b && !a) return b;
  if (!a && !b) throw new Error("Expected at least one trend");
  return severityRank(a!.severity) >= severityRank(b!.severity) ? a! : b!;
}

function trendEvidence(trend: TrendResult): Record<string, unknown> {
  return {
    domain: trend.domain,
    average7d: roundNullable(trend.average7d),
    average30d: roundNullable(trend.average30d),
    baselineMean: roundNullable(trend.baselineMean),
    zChange: roundNullable(trend.zChange),
    reliableChangeIndex: roundNullable(trend.reliableChangeIndex),
    direction: trend.direction,
    severity: trend.severity,
    sampleCount7d: trend.sampleCount7d,
    sampleCount30d: trend.sampleCount30d,
    confidence: trend.confidence,
  };
}

function roundNullable(value: number | null): number | null {
  return value === null ? null : Number(value.toFixed(2));
}
