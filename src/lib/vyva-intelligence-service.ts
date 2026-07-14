import {
  AlertSeverity as PrismaAlertSeverity,
  AlertStatus,
  BaselineStatus,
  InsightSeverity as PrismaInsightSeverity,
  InsightStatus,
  Prisma,
  RecommendationStatus,
  SessionType,
  SignalSource as PrismaSignalSource,
  type PrismaClient,
} from "@prisma/client";
import {
  buildBaseline,
  caregiverAlertFromInsight,
  computeTrend,
  generateInsights,
  generatePreventionRecommendation,
  medicationEventToSignal,
  normalizeAnswerToSignal,
  routineEventToSignal,
  type AlertCandidate,
  type BaselineMetricInput,
  type Domain,
  type InsightCard,
  type PreventionRecommendationCard,
  type SignalInput,
  type TrendResult,
} from "./vyva-scoring";

type VyvaDbClient = PrismaClient | Prisma.TransactionClient;

type AssessmentResponseWithQuestion = Prisma.AssessmentResponseGetPayload<{
  include: { question: true };
}>;

export type VyvaIntelligenceRunResult = {
  seniorId: string;
  responseSignalCount: number;
  medicationSignalCount: number;
  routineSignalCount: number;
  baselines: BaselineMetricInput[];
  trends: TrendResult[];
  insights: InsightCard[];
  recommendations: PreventionRecommendationCard[];
  alerts: AlertCandidate[];
};

export type VyvaIntelligenceRunOptions = {
  now?: Date;
  userPressedHelp?: boolean;
  rebuildWeeklyResponseSignals?: boolean;
  rebuildMedicationSignals?: boolean;
  rebuildRoutineSignals?: boolean;
  replaceExistingInsights?: boolean;
};

const VYVA_DOMAINS: Domain[] = [
  "mood",
  "social",
  "sleep",
  "routine",
  "medication",
  "nutrition",
  "hydration",
  "mobility",
  "pain_fatigue",
  "hearing_vision",
  "subjective_memory",
  "planning",
  "language",
  "prospective_memory",
  "global_wellbeing",
];

function json(value: unknown) {
  return JSON.stringify(value);
}

function signalValueForStorage(signal: SignalInput) {
  return Math.max(0, Math.min(100, signal.value));
}

function toPrismaSignalSource(source: SignalInput["source"]) {
  const key = source.toString().toUpperCase() as keyof typeof PrismaSignalSource;
  return PrismaSignalSource[key] ?? PrismaSignalSource.RESPONSE;
}

function toPrismaBaselineStatus(status: BaselineMetricInput["status"]) {
  return status === "ACTIVE" ? BaselineStatus.ACTIVE : BaselineStatus.COLLECTING;
}

function toPrismaInsightSeverity(severity: InsightCard["severity"]) {
  return PrismaInsightSeverity[severity as keyof typeof PrismaInsightSeverity] ?? PrismaInsightSeverity.NEUTRAL;
}

function toPrismaAlertSeverity(severity: AlertCandidate["severity"]) {
  return PrismaAlertSeverity[severity as keyof typeof PrismaAlertSeverity] ?? PrismaAlertSeverity.INFO;
}

function responseToSignal(response: AssessmentResponseWithQuestion): SignalInput | null {
  return normalizeAnswerToSignal({
    id: response.id,
    seniorId: response.seniorId,
    questionId: response.questionId,
    answerText: response.answerText,
    answerValue: response.answerValue,
    answerJson: response.answerJson,
    createdAt: response.createdAt,
    question: {
      id: response.question.id,
      domain: response.question.domain,
      answerType: response.question.answerType,
      questionText: response.question.questionText,
      triggerRule: response.question.triggerRule,
    },
  });
}

function signalRowToInput(signal: Prisma.SignalGetPayload<Record<string, never>>): SignalInput {
  return {
    seniorId: signal.seniorId,
    responseId: signal.responseId ?? undefined,
    domain: signal.domain,
    value: signal.value,
    normalizedValue: signal.normalizedValue,
    source: signal.source,
    confidence: signal.confidence,
    createdAt: signal.createdAt,
  };
}

function baselineRowToInput(baseline: Prisma.BaselineMetricGetPayload<Record<string, never>>): BaselineMetricInput {
  return {
    seniorId: baseline.seniorId,
    domain: baseline.domain,
    baselineMean: baseline.baselineMean,
    baselineStd: baseline.baselineStd,
    sampleCount: baseline.sampleCount,
    windowDays: baseline.windowDays,
    status: baseline.status,
    updatedAt: baseline.updatedAt,
  };
}

function domainsFromSignals(signals: SignalInput[], extraDomains: Domain[] = []) {
  return Array.from(new Set([...VYVA_DOMAINS, ...extraDomains, ...signals.map((signal) => signal.domain)]));
}

async function saveSignal(client: VyvaDbClient, signal: SignalInput) {
  if (!signal.seniorId) {
    throw new Error("Cannot save a signal without seniorId.");
  }

  const value = signalValueForStorage(signal);

  return client.signal.create({
    data: {
      seniorId: signal.seniorId,
      responseId: signal.responseId ?? null,
      domain: signal.domain,
      value,
      normalizedValue: signal.normalizedValue ?? 100 - value,
      source: toPrismaSignalSource(signal.source),
      confidence: signal.confidence,
      createdAt: signal.createdAt,
    },
  });
}

export async function createSignalsFromAssessmentSession(client: VyvaDbClient, sessionId: string) {
  const session = await client.assessmentSession.findUnique({
    where: { id: sessionId },
    include: {
      responses: {
        include: { question: true },
      },
    },
  });

  if (!session) {
    throw new Error(`Assessment session ${sessionId} was not found.`);
  }

  const responseIds = session.responses.map((response) => response.id);
  if (responseIds.length) {
    await client.signal.deleteMany({
      where: {
        responseId: { in: responseIds },
        source: PrismaSignalSource.RESPONSE,
      },
    });
  }

  const signals = session.responses
    .map((response) => responseToSignal(response))
    .filter((signal): signal is SignalInput => Boolean(signal));

  for (const signal of signals) {
    await saveSignal(client, signal);
  }

  return {
    seniorId: session.seniorId,
    signals,
  };
}

export async function rebuildWeeklyResponseSignalsForSenior(client: VyvaDbClient, seniorId: string) {
  const weeklyResponses = await client.assessmentResponse.findMany({
    where: {
      seniorId,
      session: { sessionType: SessionType.WEEKLY },
    },
    include: { question: true },
  });

  const responseIds = weeklyResponses.map((response) => response.id);
  if (responseIds.length) {
    await client.signal.deleteMany({
      where: {
        responseId: { in: responseIds },
        source: PrismaSignalSource.RESPONSE,
      },
    });
  }

  const signals = weeklyResponses
    .map((response) => responseToSignal(response))
    .filter((signal): signal is SignalInput => Boolean(signal));

  for (const signal of signals) {
    await saveSignal(client, signal);
  }

  return signals;
}

export async function rebuildMedicationSignalsForSenior(client: VyvaDbClient, seniorId: string) {
  const events = await client.medicationEvent.findMany({
    where: {
      seniorId,
      status: { not: "PENDING" },
    },
    orderBy: { scheduledFor: "asc" },
  });

  await client.signal.deleteMany({
    where: {
      seniorId,
      source: PrismaSignalSource.MEDICATION,
    },
  });

  const signals = events.map((event) =>
    medicationEventToSignal({
      seniorId,
      status: event.status,
      scheduledFor: event.scheduledFor,
      recordedAt: event.recordedAt,
    }),
  );

  for (const signal of signals) {
    await saveSignal(client, signal);
  }

  return signals;
}

export async function rebuildRoutineSignalsForSenior(client: VyvaDbClient, seniorId: string) {
  const events = await client.routineEvent.findMany({
    where: {
      seniorId,
      status: { not: "PENDING" },
    },
    orderBy: { scheduledFor: "asc" },
  });

  await client.signal.deleteMany({
    where: {
      seniorId,
      source: PrismaSignalSource.ROUTINE,
    },
  });

  const signals = events.map((event) =>
    routineEventToSignal({
      seniorId,
      status: event.status,
      scheduledFor: event.scheduledFor,
      recordedAt: event.recordedAt,
    }),
  );

  for (const signal of signals) {
    await saveSignal(client, signal);
  }

  return signals;
}

export async function updateBaselinesForSenior(
  client: VyvaDbClient,
  seniorId: string,
  options: { now?: Date; domains?: Domain[] } = {},
) {
  const signalRows = await client.signal.findMany({
    where: { seniorId },
    orderBy: { createdAt: "asc" },
  });
  const signals = signalRows.map(signalRowToInput);
  const baselines: BaselineMetricInput[] = [];

  for (const domain of domainsFromSignals(signals, options.domains)) {
    if (!signals.some((signal) => signal.domain === domain)) continue;

    const baseline = buildBaseline(signals, domain, { now: options.now });
    const saved = await client.baselineMetric.upsert({
      where: { seniorId_domain: { seniorId, domain } },
      update: {
        baselineMean: baseline.baselineMean,
        baselineStd: baseline.baselineStd,
        sampleCount: baseline.sampleCount,
        windowDays: baseline.windowDays,
        status: toPrismaBaselineStatus(baseline.status),
      },
      create: {
        seniorId,
        domain,
        baselineMean: baseline.baselineMean,
        baselineStd: baseline.baselineStd,
        sampleCount: baseline.sampleCount,
        windowDays: baseline.windowDays,
        status: toPrismaBaselineStatus(baseline.status),
      },
    });

    baselines.push(baselineRowToInput(saved));
  }

  await client.seniorProfile.update({
    where: { id: seniorId },
    data: {
      baselineStatus: baselines.some((baseline) => baseline.status === "ACTIVE")
        ? BaselineStatus.ACTIVE
        : BaselineStatus.COLLECTING,
    },
  });

  return baselines;
}

export async function computeTrendsForSenior(
  client: VyvaDbClient,
  seniorId: string,
  options: { now?: Date; domains?: Domain[] } = {},
) {
  const [signalRows, baselineRows] = await Promise.all([
    client.signal.findMany({ where: { seniorId }, orderBy: { createdAt: "asc" } }),
    client.baselineMetric.findMany({ where: { seniorId } }),
  ]);
  const signals = signalRows.map(signalRowToInput);
  const baselines = new Map(baselineRows.map((baseline) => [baseline.domain, baselineRowToInput(baseline)]));

  return domainsFromSignals(signals, options.domains)
    .filter((domain) => signals.some((signal) => signal.domain === domain))
    .map((domain) => computeTrend(signals, baselines.get(domain) ?? null, domain, { now: options.now }));
}

async function clearGeneratedCards(client: VyvaDbClient, seniorId: string) {
  await client.preventionRecommendation.deleteMany({ where: { seniorId } });
  await client.alert.deleteMany({ where: { seniorId } });
  await client.insight.deleteMany({ where: { seniorId } });
}

async function saveInsightCards(
  client: VyvaDbClient,
  seniorId: string,
  insights: InsightCard[],
  recommendations: PreventionRecommendationCard[],
  alerts: AlertCandidate[],
) {
  for (const insight of insights) {
    const savedInsight = await client.insight.create({
      data: {
        seniorId,
        type: insight.type,
        domain: insight.domain,
        title: insight.title,
        summary: insight.summary,
        evidenceJson: json(insight.evidence),
        severity: toPrismaInsightSeverity(insight.severity),
        confidence: insight.confidence,
        status: InsightStatus.ACTIVE,
      },
    });

    const recommendation = generatePreventionRecommendation(insight);
    if (recommendation) {
      await client.preventionRecommendation.create({
        data: {
          seniorId,
          insightId: savedInsight.id,
          domain: recommendation.domain,
          title: recommendation.title,
          body: recommendation.body,
          actionType: recommendation.actionType,
          status: RecommendationStatus.SUGGESTED,
        },
      });
    }
  }

  for (const alert of alerts) {
    await client.alert.create({
      data: {
        seniorId,
        type: alert.type,
        severity: toPrismaAlertSeverity(alert.severity),
        message: alert.message,
        evidenceJson: json(alert.evidence),
        status: AlertStatus.OPEN,
      },
    });
  }

  return recommendations;
}

export async function refreshInsightCardsForSenior(
  client: VyvaDbClient,
  seniorId: string,
  trends: TrendResult[],
  options: { replaceExisting?: boolean; userPressedHelp?: boolean } = {},
) {
  const senior = await client.seniorProfile.findUnique({
    where: { id: seniorId },
    include: { user: true },
  });

  if (!senior) {
    throw new Error(`Senior profile ${seniorId} was not found.`);
  }

  const insights = generateInsights(trends);
  const recommendations = insights
    .map((insight) => generatePreventionRecommendation(insight))
    .filter((recommendation): recommendation is PreventionRecommendationCard => Boolean(recommendation));
  const alerts = insights
    .map((insight) =>
      caregiverAlertFromInsight({
        seniorName: senior.user.name,
        insight,
        consentCaregiverAlerts: senior.consentCaregiverAlerts,
        userPressedHelp: options.userPressedHelp,
      }),
    )
    .filter((alert): alert is AlertCandidate => Boolean(alert));

  if (options.replaceExisting ?? true) {
    await clearGeneratedCards(client, seniorId);
  }

  await saveInsightCards(client, seniorId, insights, recommendations, alerts);

  return { insights, recommendations, alerts };
}

export async function runVyvaIntelligenceForSenior(
  client: VyvaDbClient,
  seniorId: string,
  options: VyvaIntelligenceRunOptions = {},
): Promise<VyvaIntelligenceRunResult> {
  const responseSignals = options.rebuildWeeklyResponseSignals === false
    ? []
    : await rebuildWeeklyResponseSignalsForSenior(client, seniorId);
  const medicationSignals = options.rebuildMedicationSignals === false
    ? []
    : await rebuildMedicationSignalsForSenior(client, seniorId);
  const routineSignals = options.rebuildRoutineSignals === false
    ? []
    : await rebuildRoutineSignalsForSenior(client, seniorId);
  const baselines = await updateBaselinesForSenior(client, seniorId, { now: options.now });
  const trends = await computeTrendsForSenior(client, seniorId, { now: options.now });
  const { insights, recommendations, alerts } = await refreshInsightCardsForSenior(client, seniorId, trends, {
    replaceExisting: options.replaceExistingInsights,
    userPressedHelp: options.userPressedHelp,
  });

  return {
    seniorId,
    responseSignalCount: responseSignals.length,
    medicationSignalCount: medicationSignals.length,
    routineSignalCount: routineSignals.length,
    baselines,
    trends,
    insights,
    recommendations,
    alerts,
  };
}

export async function runVyvaIntelligenceForWeeklySession(
  client: VyvaDbClient,
  sessionId: string,
  options: Omit<VyvaIntelligenceRunOptions, "rebuildWeeklyResponseSignals"> = {},
) {
  const { seniorId, signals } = await createSignalsFromAssessmentSession(client, sessionId);
  const result = await runVyvaIntelligenceForSenior(client, seniorId, {
    ...options,
    rebuildWeeklyResponseSignals: false,
  });

  return {
    ...result,
    responseSignalCount: signals.length,
  };
}
