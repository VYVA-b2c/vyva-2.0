import { Router } from "express";
import type { Request, Response } from "express";
import {
  AlertSeverity,
  AlertStatus,
  AnswerType,
  MedicationEventStatus,
  PrismaClient,
  RecommendationStatus,
  RoutineEventStatus,
  SessionStatus,
  SessionType,
} from "@prisma/client";
import { z } from "zod";
import { selectVyvaWeeklyQuestions } from "../../src/lib/vyva-weekly-question-bank.js";
import {
  computeTrendsForSenior,
  createSignalsFromAssessmentSession,
  runVyvaIntelligenceForSenior,
} from "../../src/lib/vyva-intelligence-service.js";

const router = Router();
const prisma = new PrismaClient();

const demoUsers = {
  maria: { name: "Maria Lopez", role: "SENIOR" },
  john: { name: "John Miller", role: "SENIOR" },
  ana: { name: "Ana Lopez", role: "CAREGIVER" },
} as const;

const weeklyAnswerSchema = z.object({
  questionId: z.string().min(1),
  answerText: z.string().optional().nullable(),
  answerValue: z.number().optional().nullable(),
});

const submitWeeklySchema = z.object({
  answers: z.array(weeklyAnswerSchema).min(1),
  selectedReasons: z.record(z.string()).optional().default({}),
});

const dailyAnswerSchema = z.object({
  questionId: z.string().min(1),
  answerText: z.string().optional().nullable(),
});

const submitDailySchema = z.object({
  answers: z.array(dailyAnswerSchema).min(1),
});

const consentSchema = z.object({
  value: z.boolean(),
});

const noteSchema = z.object({
  note: z.string().min(1).max(1000),
});

function json(value: unknown) {
  return JSON.stringify(value);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function dateLabel(value: Date | string | null | undefined) {
  if (!value) return "No check-in yet";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function shortName(name: string) {
  return name.split(" ")[0] ?? name;
}

function concernStatus(severity?: string | null) {
  if (severity === "ATTENTION") return "Attention recommended";
  if (severity === "WATCH") return "Change from usual pattern";
  if (severity === "POSITIVE") return "Steady";
  return "No new change";
}

function trendStatus(trends: Awaited<ReturnType<typeof computeTrendsForSenior>>, domain: string) {
  const trend = trends.find((item) => item.domain === domain);
  if (!trend || trend.direction === "unknown") return "No new change";
  return concernStatus(trend.severity);
}

function parseOptions(optionsJson: string | null) {
  if (!optionsJson) return null;
  try {
    return JSON.parse(optionsJson);
  } catch {
    return null;
  }
}

function evidenceSummary(evidenceJson: string | null | undefined) {
  if (!evidenceJson) return "Based on recent check-ins.";

  try {
    const evidence = JSON.parse(evidenceJson) as Record<string, unknown>;
    if ("sleep" in evidence && "mood" in evidence) return "Sleep and mood both changed from the recent pattern.";
    if (typeof evidence.domain === "string") return `Recent ${evidence.domain.replace(/_/g, " ")} answers changed from the usual pattern.`;
  } catch {
    return "Based on recent check-ins.";
  }

  return "Based on recent check-ins.";
}

async function demoSeniorByKey(key: string) {
  const demo = demoUsers[key as keyof typeof demoUsers];
  if (!demo || demo.role !== "SENIOR") return null;

  return prisma.user.findFirst({
    where: { name: demo.name, role: "SENIOR" },
    include: { seniorProfile: { include: { caregiver: true } } },
  });
}

async function demoCaregiverByKey(key: string) {
  const demo = demoUsers[key as keyof typeof demoUsers];
  if (!demo || demo.role !== "CAREGIVER") return null;

  return prisma.user.findFirst({
    where: { name: demo.name, role: "CAREGIVER" },
    include: { caregiverFor: { include: { user: true } } },
  });
}

async function seniorProfileFromKey(key: string) {
  const user = await demoSeniorByKey(key);
  return user?.seniorProfile ? { user, profile: user.seniorProfile } : null;
}

async function seniorProfileForCaregiver(caregiverKey: string, seniorId: string) {
  const caregiver = await demoCaregiverByKey(caregiverKey);
  if (!caregiver) return null;

  const profile = await prisma.seniorProfile.findFirst({
    where: { id: seniorId, caregiverId: caregiver.id },
    include: { user: true, caregiver: true },
  });

  return profile ? { caregiver, profile } : null;
}

async function seniorOverview(profileId: string) {
  const [lastSession, insights, recommendations, alerts, medicationEvents, routineEvents, trends] = await Promise.all([
    prisma.assessmentSession.findFirst({
      where: { seniorId: profileId },
      orderBy: { startedAt: "desc" },
    }),
    prisma.insight.findMany({
      where: { seniorId: profileId, status: "ACTIVE" },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    prisma.preventionRecommendation.findMany({
      where: { seniorId: profileId, status: RecommendationStatus.SUGGESTED },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.alert.findMany({
      where: { seniorId: profileId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.medicationEvent.findMany({
      where: { seniorId: profileId, scheduledFor: { gte: daysAgo(7) } },
      orderBy: { scheduledFor: "desc" },
    }),
    prisma.routineEvent.findMany({
      where: { seniorId: profileId, scheduledFor: { gte: daysAgo(7) } },
      orderBy: { scheduledFor: "desc" },
    }),
    computeTrendsForSenior(prisma, profileId),
  ]);

  const missedMedicationCount = medicationEvents.filter((event) =>
    [MedicationEventStatus.MISSED, MedicationEventStatus.SKIPPED].includes(event.status),
  ).length;
  const doneRoutineCount = routineEvents.filter((event) => event.status === RoutineEventStatus.DONE).length;
  const openAlerts = alerts.filter((alert) => alert.status === AlertStatus.OPEN);

  return {
    lastCheckIn: dateLabel(lastSession?.completedAt ?? lastSession?.startedAt),
    latestInsight: insights[0] ?? null,
    latestRecommendation: recommendations[0] ?? null,
    insights,
    recommendations,
    alerts,
    openAlertCount: openAlerts.length,
    moodStatus: trendStatus(trends, "mood"),
    socialStatus: trendStatus(trends, "social"),
    routineStatus: trendStatus(trends, "routine"),
    medicationStatus: missedMedicationCount > 0 ? "Follow-up may help" : "Confirmations steady",
    routineSummary: doneRoutineCount > 0 ? `${doneRoutineCount} routine confirmations this week` : "No routine confirmations this week",
  };
}

async function myWeekForSenior(profileId: string) {
  const [insights, recommendations, senior] = await Promise.all([
    prisma.insight.findMany({
      where: { seniorId: profileId, status: "ACTIVE" },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.preventionRecommendation.findMany({
      where: { seniorId: profileId, status: RecommendationStatus.SUGGESTED },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.seniorProfile.findUnique({ where: { id: profileId } }),
  ]);

  const steady = insights.filter((insight) => insight.severity === "POSITIVE" || insight.type === "stable_week");
  const changed = insights.filter((insight) => insight.severity !== "POSITIVE" && insight.type !== "stable_week");

  return {
    steady,
    changed,
    recommendations,
    shareEnabled: Boolean(senior?.consentCaregiverAlerts),
  };
}

router.get("/users", async (_req: Request, res: Response) => {
  res.json({
    users: [
      { key: "maria", label: "Maria Lopez", role: "senior" },
      { key: "john", label: "John Miller", role: "senior" },
      { key: "ana", label: "Ana Lopez", role: "caregiver" },
    ],
  });
});

router.get("/senior/:seniorKey/home", async (req: Request, res: Response) => {
  const senior = await seniorProfileFromKey(req.params.seniorKey);
  if (!senior) return res.status(404).json({ error: "Demo senior not found. Run the database seed first." });

  const overview = await seniorOverview(senior.profile.id);
  res.json({
    senior: {
      id: senior.profile.id,
      key: req.params.seniorKey,
      name: senior.user.name,
      firstName: shortName(senior.user.name),
      consentCaregiverAlerts: senior.profile.consentCaregiverAlerts,
      consentShareDetails: senior.profile.consentShareDetails,
      caregiverName: senior.profile.caregiver?.name ?? "Ana",
    },
    today: new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date()),
    overview,
  });
});

router.get("/senior/:seniorKey/my-week", async (req: Request, res: Response) => {
  const senior = await seniorProfileFromKey(req.params.seniorKey);
  if (!senior) return res.status(404).json({ error: "Demo senior not found." });
  res.json(await myWeekForSenior(senior.profile.id));
});

router.get("/senior/:seniorKey/weekly/start", async (req: Request, res: Response) => {
  const senior = await seniorProfileFromKey(req.params.seniorKey);
  if (!senior) return res.status(404).json({ error: "Demo senior not found." });

  const baselineStart = senior.profile.baselineStartedAt ?? new Date();
  const weekNumber = Math.max(1, Math.floor((Date.now() - baselineStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1);
  const recentResponses = await prisma.assessmentResponse.findMany({
    where: {
      seniorId: senior.profile.id,
      session: { sessionType: SessionType.WEEKLY },
      createdAt: { gte: daysAgo(21) },
    },
    select: { questionId: true },
  });
  const trends = await computeTrendsForSenior(prisma, senior.profile.id);
  const selected = selectVyvaWeeklyQuestions({
    weekNumber,
    recentlyUsedQuestionIds: recentResponses.map((response) => response.questionId),
    recentSignals: trends.map((trend) => ({
      domain: trend.domain,
      trend: trend.direction === "worsening" ? "worsened" : trend.direction === "improving" ? "improved" : "steady",
      worsened: trend.direction === "worsening",
    })),
    maxQuestions: 9,
  });

  const questions = await prisma.question.findMany({
    where: { id: { in: selected.map((item) => item.question.id) } },
  });
  const questionsById = new Map(questions.map((question) => [question.id, question]));

  res.json({
    weekNumber,
    questions: selected
      .map((item) => {
        const question = questionsById.get(item.question.id);
        if (!question) return null;
        return {
          id: question.id,
          domain: question.domain,
          questionText: question.questionText,
          answerType: question.answerType,
          options: parseOptions(question.optionsJson),
          reason: item.reason,
        };
      })
      .filter(Boolean),
  });
});

router.post("/senior/:seniorKey/weekly/submit", async (req: Request, res: Response) => {
  const parsed = submitWeeklySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid weekly check-in answers." });

  const senior = await seniorProfileFromKey(req.params.seniorKey);
  if (!senior) return res.status(404).json({ error: "Demo senior not found." });

  const session = await prisma.assessmentSession.create({
    data: {
      seniorId: senior.profile.id,
      sessionType: SessionType.WEEKLY,
      status: SessionStatus.COMPLETED,
      selectedReasonJson: json(parsed.data.selectedReasons),
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });

  for (const answer of parsed.data.answers) {
    await prisma.assessmentResponse.create({
      data: {
        sessionId: session.id,
        seniorId: senior.profile.id,
        questionId: answer.questionId,
        answerText: answer.answerText ?? null,
        answerValue: answer.answerValue ?? null,
        answerJson: json({ source: "vyva_demo_weekly" }),
      },
    });
  }

  await createSignalsFromAssessmentSession(prisma, session.id);
  await runVyvaIntelligenceForSenior(prisma, senior.profile.id, {
    rebuildWeeklyResponseSignals: false,
  });

  res.json({
    sessionId: session.id,
    myWeek: await myWeekForSenior(senior.profile.id),
    home: await seniorOverview(senior.profile.id),
  });
});

router.post("/senior/:seniorKey/daily/submit", async (req: Request, res: Response) => {
  const parsed = submitDailySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid daily check-in answers." });

  const senior = await seniorProfileFromKey(req.params.seniorKey);
  if (!senior) return res.status(404).json({ error: "Demo senior not found." });

  const session = await prisma.assessmentSession.create({
    data: {
      seniorId: senior.profile.id,
      sessionType: SessionType.DAILY,
      status: SessionStatus.COMPLETED,
      selectedReasonJson: json({ source: "vyva_demo_daily" }),
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });

  for (const answer of parsed.data.answers) {
    await prisma.assessmentResponse.create({
      data: {
        sessionId: session.id,
        seniorId: senior.profile.id,
        questionId: answer.questionId,
        answerText: answer.answerText ?? null,
        answerJson: json({ source: "vyva_demo_daily" }),
      },
    });
  }

  res.json({ sessionId: session.id, message: "Thank you. Your daily check-in is complete." });
});

router.post("/senior/:seniorKey/ask-help", async (req: Request, res: Response) => {
  const senior = await seniorProfileFromKey(req.params.seniorKey);
  if (!senior) return res.status(404).json({ error: "Demo senior not found." });

  const alert = await prisma.alert.create({
    data: {
      seniorId: senior.profile.id,
      type: "ask_for_help",
      severity: AlertSeverity.URGENT,
      message: `${senior.user.name} asked for help. Follow-up may help. This is a wellbeing signal only.`,
      evidenceJson: json({ source: "senior_pressed_help" }),
      status: AlertStatus.OPEN,
    },
  });

  res.json({ alert });
});

router.patch("/senior/:seniorKey/consent", async (req: Request, res: Response) => {
  const parsed = consentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid consent value." });

  const senior = await seniorProfileFromKey(req.params.seniorKey);
  if (!senior) return res.status(404).json({ error: "Demo senior not found." });

  const profile = await prisma.seniorProfile.update({
    where: { id: senior.profile.id },
    data: {
      consentCaregiverAlerts: parsed.data.value,
      consentShareDetails: parsed.data.value,
    },
  });

  res.json({ consentCaregiverAlerts: profile.consentCaregiverAlerts, consentShareDetails: profile.consentShareDetails });
});

router.get("/caregiver/:caregiverKey/dashboard", async (req: Request, res: Response) => {
  const caregiver = await demoCaregiverByKey(req.params.caregiverKey);
  if (!caregiver) return res.status(404).json({ error: "Demo caregiver not found." });

  const seniors = await Promise.all(
    caregiver.caregiverFor.map(async (profile) => {
      const overview = await seniorOverview(profile.id);
      return {
        id: profile.id,
        name: profile.user.name,
        firstName: shortName(profile.user.name),
        lastCheckIn: overview.lastCheckIn,
        moodStatus: overview.moodStatus,
        socialStatus: overview.socialStatus,
        routineStatus: overview.routineStatus,
        medicationStatus: overview.medicationStatus,
        openAlertCount: overview.openAlertCount,
        consentCaregiverAlerts: profile.consentCaregiverAlerts,
        consentShareDetails: profile.consentShareDetails,
      };
    }),
  );

  res.json({
    caregiver: { id: caregiver.id, key: req.params.caregiverKey, name: caregiver.name },
    summary: {
      seniorsMonitored: seniors.length,
      checkInsThisWeek: seniors.length * 7,
      openAlerts: seniors.reduce((sum, senior) => sum + senior.openAlertCount, 0),
      medicationConfirmations: "Recent confirmations available",
    },
    seniors,
  });
});

router.get("/caregiver/:caregiverKey/seniors/:seniorId", async (req: Request, res: Response) => {
  const access = await seniorProfileForCaregiver(req.params.caregiverKey, req.params.seniorId);
  if (!access) return res.status(404).json({ error: "Senior not found for caregiver." });

  const { profile } = access;
  const canViewPrivateDetails = profile.consentCaregiverAlerts && profile.consentShareDetails;
  const [overview, insights, recommendations, sessions, medications, routineEvents, alerts, notes] = await Promise.all([
    seniorOverview(profile.id),
    prisma.insight.findMany({ where: { seniorId: profile.id, status: "ACTIVE" }, orderBy: { createdAt: "desc" } }),
    prisma.preventionRecommendation.findMany({ where: { seniorId: profile.id }, orderBy: { createdAt: "desc" } }),
    prisma.assessmentSession.findMany({
      where: { seniorId: profile.id },
      orderBy: { startedAt: "desc" },
      take: 8,
      include: { responses: { include: { question: true }, take: 4 } },
    }),
    prisma.medication.findMany({ where: { seniorId: profile.id, active: true }, include: { events: { orderBy: { scheduledFor: "desc" }, take: 6 } } }),
    prisma.routineEvent.findMany({ where: { seniorId: profile.id }, orderBy: { scheduledFor: "desc" }, take: 8, include: { routine: true } }),
    prisma.alert.findMany({ where: { seniorId: profile.id }, orderBy: { createdAt: "desc" } }),
    prisma.caregiverNote.findMany({ where: { seniorId: profile.id }, orderBy: { createdAt: "desc" }, take: 8, include: { caregiver: true } }),
  ]);

  res.json({
    senior: {
      id: profile.id,
      name: profile.user.name,
      firstName: shortName(profile.user.name),
      consentCaregiverAlerts: profile.consentCaregiverAlerts,
      consentShareDetails: profile.consentShareDetails,
      canViewPrivateDetails,
    },
    overview,
    insights: canViewPrivateDetails
      ? insights.map((insight) => ({ ...insight, evidenceSummary: evidenceSummary(insight.evidenceJson) }))
      : insights.map((insight) => ({
          id: insight.id,
          type: insight.type,
          domain: insight.domain,
          title: insight.title,
          summary: "Sharing consent is not enabled.",
          severity: insight.severity,
          confidence: insight.confidence,
          evidenceSummary: null,
          createdAt: insight.createdAt,
        })),
    recommendations,
    checkIns: canViewPrivateDetails
      ? sessions.map((session) => ({
          id: session.id,
          type: session.sessionType,
          date: dateLabel(session.completedAt ?? session.startedAt),
          status: session.status,
          answers: session.responses.map((response) => ({
            question: response.question.questionText,
            answer: response.answerText ?? "Completed",
          })),
        }))
      : [],
    medications: canViewPrivateDetails ? medications : [],
    routineEvents: canViewPrivateDetails ? routineEvents : [],
    alerts,
    notes,
    consentMessage: canViewPrivateDetails ? null : "Sharing consent is not enabled.",
  });
});

router.patch("/caregiver/:caregiverKey/alerts/:alertId/review", async (req: Request, res: Response) => {
  const caregiver = await demoCaregiverByKey(req.params.caregiverKey);
  if (!caregiver) return res.status(404).json({ error: "Demo caregiver not found." });

  const alert = await prisma.alert.findFirst({
    where: {
      id: req.params.alertId,
      senior: { caregiverId: caregiver.id },
    },
  });
  if (!alert) return res.status(404).json({ error: "Alert not found." });

  const updated = await prisma.alert.update({
    where: { id: alert.id },
    data: { status: AlertStatus.REVIEWED, reviewedAt: new Date() },
  });

  res.json({ alert: updated });
});

router.post("/caregiver/:caregiverKey/seniors/:seniorId/notes", async (req: Request, res: Response) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Note is required." });

  const access = await seniorProfileForCaregiver(req.params.caregiverKey, req.params.seniorId);
  if (!access) return res.status(404).json({ error: "Senior not found for caregiver." });

  const note = await prisma.caregiverNote.create({
    data: {
      seniorId: access.profile.id,
      caregiverId: access.caregiver.id,
      note: parsed.data.note,
      concernTag: "caregiver_note",
    },
  });

  res.json({ note });
});

export default router;
