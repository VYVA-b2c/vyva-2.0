import {
  AlertSeverity,
  AlertStatus,
  AnswerType,
  BaselineStatus,
  BurdenLevel,
  Cadence,
  InsightSeverity,
  InsightStatus,
  MedicationEventStatus,
  PrismaClient,
  RecommendationStatus,
  SessionStatus,
  SessionType,
  SignalSource,
  UserRole,
} from "@prisma/client";
import {
  VYVA_WEEKLY_FORMS,
  VYVA_WEEKLY_QUESTION_BANK,
  validateVyvaWeeklyQuestionBank,
  type VyvaQuestionSeed,
} from "../src/lib/vyva-weekly-question-bank";
import { runVyvaIntelligenceForSenior } from "../src/lib/vyva-intelligence-service";

const prisma = new PrismaClient();

const demoNames = ["Maria Lopez", "John Miller", "Ana Lopez"];
const legacyWeeklyQuestionIds = [
  "weekly_word_recall_story",
  "weekly_planning_step",
  "weekly_prospective_memory",
];
const dailyQuestionIds = [
  "daily_memory_confidence",
  "daily_focus_energy",
  "daily_mood",
  "daily_social_connection",
  "daily_sleep_quality",
  "daily_routine_ease",
];

function json(value: unknown) {
  return JSON.stringify(value);
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysAgo(days: number, hour = 9, minute = 0) {
  const base = startOfUtcDay(new Date());
  base.setUTCDate(base.getUTCDate() - days);
  base.setUTCHours(hour, minute, 0, 0);
  return base;
}

function addDays(date: Date, days: number, hour = date.getUTCHours(), minute = date.getUTCMinutes()) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  next.setUTCHours(hour, minute, 0, 0);
  return next;
}

function clamp(value: number, min = 1, max = 5) {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function concernFromFivePoint(value: number) {
  return round1((5 - value) * 20);
}

function answerText(value: number) {
  if (value >= 4.5) return "Very steady";
  if (value >= 3.8) return "Mostly steady";
  if (value >= 3.1) return "A little uneven";
  if (value >= 2.4) return "Needed extra support";
  return "Felt difficult";
}

function weeklyQuestionToPrisma(question: VyvaQuestionSeed) {
  const answerType = AnswerType[question.answerType as keyof typeof AnswerType];
  const cadence = Cadence[question.cadence as keyof typeof Cadence];
  const burdenLevel = BurdenLevel[question.burdenLevel as keyof typeof BurdenLevel];

  if (!answerType || !cadence || !burdenLevel) {
    throw new Error(`Question ${question.id} has an enum value that does not match the Prisma schema.`);
  }

  return {
    id: question.id,
    domain: question.domain,
    questionText: question.questionText,
    answerType,
    optionsJson: question.options === undefined ? null : json(question.options),
    cadence,
    burdenLevel,
    preventionDomain: question.preventionDomain ?? question.domain,
    triggerRule: question.triggerRule ?? null,
    cooldownDays: question.cooldownDays,
    active: question.active,
  };
}

function dailyValues(person: "maria" | "john", dayIndex: number) {
  const week = Math.floor(dayIndex / 7);
  const wave = Math.sin(dayIndex / 3) * 0.25;

  if (person === "maria") {
    return {
      memory: round1(clamp(4.2 + wave - (week >= 4 ? 0.25 : 0))),
      focus: round1(clamp(4.0 + Math.cos(dayIndex / 4) * 0.2)),
      mood: round1(clamp(4.3 + Math.sin(dayIndex / 5) * 0.2)),
      social: round1(clamp(4.1 + (dayIndex % 7 === 5 ? 0.4 : 0) - (dayIndex % 11 === 0 ? 0.5 : 0))),
      sleep: round1(clamp(3.8 + Math.cos(dayIndex / 5) * 0.35 - (dayIndex % 13 === 0 ? 0.6 : 0))),
      routine: round1(clamp(4.0 + wave - (dayIndex % 17 === 0 ? 0.5 : 0))),
    };
  }

  const lateWeekLoad = week >= 5 ? 0.65 : 0;

  return {
    memory: round1(clamp(3.7 + wave - week * 0.05)),
    focus: round1(clamp(3.8 + Math.cos(dayIndex / 4) * 0.25 - lateWeekLoad * 0.55)),
    mood: round1(clamp(3.6 + Math.sin(dayIndex / 6) * 0.3 - lateWeekLoad * 0.7)),
    social: round1(clamp(3.2 + (dayIndex % 7 === 6 ? 0.5 : 0) - (dayIndex % 10 === 0 ? 0.4 : 0) - lateWeekLoad)),
    sleep: round1(clamp(3.3 + Math.cos(dayIndex / 6) * 0.35 - (dayIndex % 9 === 0 ? 0.5 : 0) - lateWeekLoad * 0.8)),
    routine: round1(clamp(3.5 + wave - (dayIndex % 8 === 0 ? 0.45 : 0) - lateWeekLoad * 0.65)),
  };
}

async function seedQuestions() {
  const validation = validateVyvaWeeklyQuestionBank();
  if (!validation.ok) {
    throw new Error(`VYVA weekly question bank validation failed:\n${validation.errors.join("\n")}`);
  }

  const questions = [
    {
      id: "daily_memory_confidence",
      domain: "memory",
      questionText: "How easy was it to remember your usual plans today?",
      answerType: AnswerType.SCALE_DIFFICULTY,
      optionsJson: json({ min: 1, max: 5, lowLabel: "Hard today", highLabel: "Easy today" }),
      cadence: Cadence.DAILY,
      burdenLevel: BurdenLevel.LOW,
      preventionDomain: "brain_routine",
    },
    {
      id: "daily_focus_energy",
      domain: "focus",
      questionText: "How steady did your attention feel today?",
      answerType: AnswerType.SCALE_CHANGE,
      optionsJson: json({ min: 1, max: 5, lowLabel: "Scattered", highLabel: "Steady" }),
      cadence: Cadence.DAILY,
      burdenLevel: BurdenLevel.LOW,
      preventionDomain: "brain_routine",
    },
    {
      id: "daily_mood",
      domain: "mood",
      questionText: "How was your overall mood today?",
      answerType: AnswerType.SCALE_CHANGE,
      optionsJson: json({ min: 1, max: 5, lowLabel: "Low", highLabel: "Bright" }),
      cadence: Cadence.DAILY,
      burdenLevel: BurdenLevel.LOW,
      preventionDomain: "wellbeing",
    },
    {
      id: "daily_social_connection",
      domain: "social",
      questionText: "Did you have enough friendly contact today?",
      answerType: AnswerType.SCALE_SOCIAL,
      optionsJson: json({ min: 1, max: 5, lowLabel: "Not enough", highLabel: "Enough" }),
      cadence: Cadence.DAILY,
      burdenLevel: BurdenLevel.LOW,
      preventionDomain: "connection",
    },
    {
      id: "daily_sleep_quality",
      domain: "sleep",
      questionText: "How restful was your sleep?",
      answerType: AnswerType.SCALE_CHANGE,
      optionsJson: json({ min: 1, max: 5, lowLabel: "Restless", highLabel: "Restful" }),
      cadence: Cadence.DAILY,
      burdenLevel: BurdenLevel.LOW,
      preventionDomain: "daily_rhythm",
    },
    {
      id: "daily_routine_ease",
      domain: "routine",
      questionText: "How easy was it to keep your daily rhythm?",
      answerType: AnswerType.SCALE_DIFFICULTY,
      optionsJson: json({ min: 1, max: 5, lowLabel: "Hard", highLabel: "Easy" }),
      cadence: Cadence.DAILY,
      burdenLevel: BurdenLevel.LOW,
      preventionDomain: "daily_rhythm",
    },
  ];

  for (const question of questions) {
    const { id, ...questionData } = question;
    await prisma.question.upsert({
      where: { id },
      update: questionData,
      create: { id, ...questionData },
    });
  }

  for (const question of VYVA_WEEKLY_QUESTION_BANK.filter((item) => item.active)) {
    const { id, ...questionData } = weeklyQuestionToPrisma(question);
    await prisma.question.upsert({
      where: { id },
      update: questionData,
      create: { id, ...questionData },
    });
  }

  await prisma.question.updateMany({
    where: { id: { in: legacyWeeklyQuestionIds } },
    data: { active: false },
  });

  for (const form of VYVA_WEEKLY_FORMS) {
    await prisma.weeklyForm.upsert({
      where: { weekNumber: form.weekNumber },
      update: {
        title: form.title,
        questionIdsJson: json(form.questionIds),
        active: true,
      },
      create: {
        weekNumber: form.weekNumber,
        title: form.title,
        questionIdsJson: json(form.questionIds),
        active: true,
      },
    });
  }
}

async function clearDemoData() {
  const demoUsers = await prisma.user.findMany({
    where: { name: { in: demoNames } },
    include: { seniorProfile: true },
  });
  const userIds = demoUsers.map((user) => user.id);
  const seniorIds = demoUsers.flatMap((user) => user.seniorProfile?.id ? [user.seniorProfile.id] : []);

  if (seniorIds.length > 0 || userIds.length > 0) {
    await prisma.$transaction([
      prisma.transcriptMetadata.deleteMany({ where: { seniorId: { in: seniorIds } } }),
      prisma.signal.deleteMany({ where: { seniorId: { in: seniorIds } } }),
      prisma.assessmentResponse.deleteMany({ where: { seniorId: { in: seniorIds } } }),
      prisma.assessmentSession.deleteMany({ where: { seniorId: { in: seniorIds } } }),
      prisma.baselineMetric.deleteMany({ where: { seniorId: { in: seniorIds } } }),
      prisma.preventionRecommendation.deleteMany({ where: { seniorId: { in: seniorIds } } }),
      prisma.insight.deleteMany({ where: { seniorId: { in: seniorIds } } }),
      prisma.alert.deleteMany({ where: { seniorId: { in: seniorIds } } }),
      prisma.caregiverNote.deleteMany({
        where: {
          OR: [
            { seniorId: { in: seniorIds } },
            { caregiverId: { in: userIds } },
          ],
        },
      }),
      prisma.medicationEvent.deleteMany({ where: { seniorId: { in: seniorIds } } }),
      prisma.medication.deleteMany({ where: { seniorId: { in: seniorIds } } }),
      prisma.routineEvent.deleteMany({ where: { seniorId: { in: seniorIds } } }),
      prisma.routine.deleteMany({ where: { seniorId: { in: seniorIds } } }),
      prisma.seniorProfile.deleteMany({ where: { id: { in: seniorIds } } }),
      prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    ]);
  }
}

async function createDemoUsers() {
  const ana = await prisma.user.create({
    data: {
      name: "Ana Lopez",
      role: UserRole.CAREGIVER,
      preferredLanguage: "en",
    },
  });

  const maria = await prisma.user.create({
    data: {
      name: "Maria Lopez",
      role: UserRole.SENIOR,
      preferredLanguage: "en",
      seniorProfile: {
        create: {
          dateOfBirth: new Date("1948-03-14T00:00:00.000Z"),
          livingSituation: "Lives independently with family nearby",
          caregiver: { connect: { id: ana.id } },
          consentCaregiverAlerts: true,
          consentShareDetails: true,
          baselineStartedAt: daysAgo(41),
          baselineStatus: BaselineStatus.ACTIVE,
        },
      },
    },
    include: { seniorProfile: true },
  });

  const john = await prisma.user.create({
    data: {
      name: "John Miller",
      role: UserRole.SENIOR,
      preferredLanguage: "en",
      seniorProfile: {
        create: {
          dateOfBirth: new Date("1942-10-02T00:00:00.000Z"),
          livingSituation: "Lives alone with regular caregiver check-ins",
          caregiver: { connect: { id: ana.id } },
          consentCaregiverAlerts: true,
          consentShareDetails: false,
          baselineStartedAt: daysAgo(41),
          baselineStatus: BaselineStatus.ACTIVE,
        },
      },
    },
    include: { seniorProfile: true },
  });

  if (!maria.seniorProfile || !john.seniorProfile) {
    throw new Error("Demo senior profiles were not created.");
  }

  return {
    ana,
    maria: { user: maria, profile: maria.seniorProfile },
    john: { user: john, profile: john.seniorProfile },
  };
}

async function seedCheckIns(seniorId: string, person: "maria" | "john") {
  const startDate = daysAgo(41);
  const incompleteDays = person === "maria" ? new Set([16]) : new Set([9, 35]);
  const domainMap = {
    daily_memory_confidence: "memory",
    daily_focus_energy: "focus",
    daily_mood: "mood",
    daily_social_connection: "social",
    daily_sleep_quality: "sleep",
    daily_routine_ease: "routine",
  } as const;

  for (let dayIndex = 0; dayIndex < 42; dayIndex += 1) {
    const checkInDate = addDays(startDate, dayIndex, 9, person === "maria" ? 10 : 35);
    const status = incompleteDays.has(dayIndex) ? SessionStatus.INCOMPLETE : SessionStatus.COMPLETED;
    const session = await prisma.assessmentSession.create({
      data: {
        seniorId,
        sessionType: SessionType.DAILY,
        status,
        selectedReasonJson: json({ source: "seed", cadence: "daily", dayIndex }),
        startedAt: checkInDate,
        completedAt: status === SessionStatus.COMPLETED ? addDays(checkInDate, 0, checkInDate.getUTCHours(), checkInDate.getUTCMinutes() + 8) : null,
      },
    });

    const values = dailyValues(person, dayIndex);
    const dailyAnswers = [
      ["daily_memory_confidence", values.memory],
      ["daily_focus_energy", values.focus],
      ["daily_mood", values.mood],
      ["daily_social_connection", values.social],
      ["daily_sleep_quality", values.sleep],
      ["daily_routine_ease", values.routine],
    ] as const;
    const includedAnswers = status === SessionStatus.INCOMPLETE ? dailyAnswers.slice(0, 3) : dailyAnswers;

    for (const [questionId, value] of includedAnswers) {
      const response = await prisma.assessmentResponse.create({
        data: {
          sessionId: session.id,
          seniorId,
          questionId,
          answerText: answerText(value),
          answerValue: value,
          answerJson: json({ scale: 5, label: answerText(value) }),
          createdAt: checkInDate,
        },
      });
      await prisma.signal.create({
        data: {
          seniorId,
          responseId: response.id,
          domain: domainMap[questionId],
          value: concernFromFivePoint(value),
          normalizedValue: round1(value * 20),
          source: SignalSource.RESPONSE,
          confidence: 0.72,
          createdAt: checkInDate,
        },
      });
    }

    if (dayIndex % 7 === 5) {
      const weeklySession = await prisma.assessmentSession.create({
        data: {
          seniorId,
          sessionType: SessionType.WEEKLY,
          status: SessionStatus.COMPLETED,
          selectedReasonJson: json({ source: "seed", cadence: "weekly", weekNumber: Math.floor(dayIndex / 7) + 1 }),
          startedAt: addDays(checkInDate, 0, 16, 0),
          completedAt: addDays(checkInDate, 0, 16, 16),
        },
      });

      const story = person === "maria"
        ? "I watered the balcony plants, made soup, and spoke with Ana after lunch."
        : "I read the newspaper, walked to the corner shop, and watched a football match.";
      const plan = person === "maria"
        ? "I want to remember the video call on Sunday."
        : "I want to set out tomorrow morning's list before breakfast.";
      const supportAnswer = person === "maria"
        ? "Help me remember the Sunday video call."
        : "Help me keep tomorrow morning's list near the kettle.";

      const weeklyResponses = [
        ["CORE-02", story, null, "mood", person === "maria" ? 22 : 32],
        ["PLAN-TASK-01", plan, null, "planning", person === "maria" ? 18 : 28],
        ["PM-02", supportAnswer, null, "prospective_memory", person === "maria" ? 16 : 24],
      ] as const;

      for (const [questionId, answer, value, domain, concern] of weeklyResponses) {
        const response = await prisma.assessmentResponse.create({
          data: {
            sessionId: weeklySession.id,
            seniorId,
            questionId,
            answerText: answer,
            answerValue: value,
            answerJson: json({ source: "weekly_seed" }),
            createdAt: weeklySession.startedAt,
          },
        });
        await prisma.signal.create({
          data: {
            seniorId,
            responseId: response.id,
            domain,
            value: concern,
            normalizedValue: 100 - concern,
            source: SignalSource.RESPONSE,
            confidence: 0.65,
            createdAt: weeklySession.startedAt,
          },
        });
      }

      await prisma.transcriptMetadata.create({
        data: {
          seniorId,
          sessionId: weeklySession.id,
          wordCount: person === "maria" ? 34 + Math.floor(dayIndex / 7) : 25 + Math.floor(dayIndex / 8),
          durationSeconds: person === "maria" ? 72 : 84,
          averageWordsPerSentence: person === "maria" ? 8.4 : 6.8,
          hesitationCount: person === "maria" ? 2 : 4 + Math.floor(dayIndex / 14),
          repeatedPhraseCount: person === "maria" ? 1 : 2,
          transcriptText: story,
          createdAt: weeklySession.startedAt,
        },
      });
    }
  }
}

async function seedBaselines(seniorId: string, person: "maria" | "john") {
  const domains = ["memory", "focus", "mood", "social", "sleep", "routine"];
  for (const domain of domains) {
    const base = person === "maria" ? 20 : domain === "social" ? 34 : 28;
    await prisma.baselineMetric.create({
      data: {
        seniorId,
        domain,
        baselineMean: base,
        baselineStd: person === "maria" ? 7.5 : 9.2,
        sampleCount: 14,
        windowDays: 14,
        status: BaselineStatus.ACTIVE,
      },
    });
  }
}

async function seedMedications(seniorId: string, person: "maria" | "john") {
  const medicationInputs = person === "maria"
    ? [
        { name: "Morning tablet", doseLabel: "1 tablet", scheduledTime: "08:30" },
        { name: "Vitamin D", doseLabel: "1 capsule", scheduledTime: "12:00" },
      ]
    : [
        { name: "Morning tablet", doseLabel: "1 tablet", scheduledTime: "08:00" },
        { name: "Evening tablet", doseLabel: "1 tablet", scheduledTime: "20:00" },
      ];

  for (const medInput of medicationInputs) {
    const medication = await prisma.medication.create({
      data: {
        seniorId,
        ...medInput,
      },
    });

    for (let dayIndex = 0; dayIndex < 42; dayIndex += 1) {
      const [hour, minute] = medInput.scheduledTime.split(":").map(Number);
      const scheduledFor = addDays(daysAgo(41), dayIndex, hour, minute);
      const pattern = `${person}:${medInput.name}:${dayIndex}`;
      const status =
        pattern.includes("john") && dayIndex % 13 === 0 ? MedicationEventStatus.MISSED :
        pattern.includes("john") && dayIndex % 9 === 0 ? MedicationEventStatus.REMIND_LATER :
        pattern.includes("maria") && dayIndex % 17 === 0 ? MedicationEventStatus.SKIPPED :
        pattern.includes("maria") && dayIndex % 10 === 0 ? MedicationEventStatus.REMIND_LATER :
        MedicationEventStatus.TAKEN;

      await prisma.medicationEvent.create({
        data: {
          medicationId: medication.id,
          seniorId,
          status,
          scheduledFor,
          recordedAt: status === MedicationEventStatus.MISSED ? null : addDays(scheduledFor, 0, hour, minute + (status === MedicationEventStatus.REMIND_LATER ? 45 : 7)),
        },
      });

      if (status !== MedicationEventStatus.TAKEN) {
        await prisma.signal.create({
          data: {
            seniorId,
            domain: "medication_rhythm",
            value: status === MedicationEventStatus.MISSED ? 68 : 42,
            normalizedValue: status === MedicationEventStatus.MISSED ? 32 : 58,
            source: SignalSource.MEDICATION,
            confidence: 0.78,
            createdAt: scheduledFor,
          },
        });
      }
    }
  }
}

async function seedCaregiverNotes(seniorIds: { maria: string; john: string }, caregiverId: string) {
  const notes = [
    { seniorId: seniorIds.maria, days: 39, concernTag: "routine", note: "Maria enjoyed her morning tea routine and remembered the family call after a calendar prompt." },
    { seniorId: seniorIds.maria, days: 31, concernTag: "sleep", note: "Maria mentioned a restless night but still completed her check-in after breakfast." },
    { seniorId: seniorIds.maria, days: 18, concernTag: "connection", note: "Maria sounded upbeat after seeing her neighbor in the courtyard." },
    { seniorId: seniorIds.maria, days: 6, concernTag: "routine", note: "Maria asked for the grocery list to be written in one place before the weekend." },
    { seniorId: seniorIds.john, days: 36, concernTag: "connection", note: "John said the quiet afternoons feel longer when there is no planned call." },
    { seniorId: seniorIds.john, days: 24, concernTag: "daily_rhythm", note: "John completed the check-in later than usual after misplacing his paper list." },
    { seniorId: seniorIds.john, days: 13, concernTag: "medication_rhythm", note: "John used the reminder but logged the evening tablet late." },
    { seniorId: seniorIds.john, days: 3, concernTag: "planning", note: "John liked having tomorrow's errands written down before breakfast." },
  ];

  for (const note of notes) {
    await prisma.caregiverNote.create({
      data: {
        seniorId: note.seniorId,
        caregiverId,
        concernTag: note.concernTag,
        note: note.note,
        createdAt: daysAgo(note.days, 18, 30),
      },
    });
  }
}

async function seedInsightsAndAlerts(seniorIds: { maria: string; john: string }) {
  const mariaRoutine = await prisma.insight.create({
    data: {
      seniorId: seniorIds.maria,
      type: "trend",
      domain: "routine",
      title: "Morning routine stayed steady",
      summary: "Maria completed most morning check-ins and kept a consistent routine across the six-week sample.",
      evidenceJson: json({ windowDays: 42, completedDailyCheckIns: 41, domain: "routine" }),
      severity: InsightSeverity.POSITIVE,
      confidence: 0.82,
      status: InsightStatus.ACTIVE,
      createdAt: daysAgo(2, 10),
    },
  });
  await prisma.preventionRecommendation.create({
    data: {
      seniorId: seniorIds.maria,
      insightId: mariaRoutine.id,
      domain: "routine",
      title: "Keep the morning card visible",
      body: "Use the same simple morning card for tea, check-in, and the first planned activity.",
      actionType: "routine_prompt",
      status: RecommendationStatus.SUGGESTED,
      createdAt: daysAgo(2, 10, 10),
    },
  });

  const mariaSleep = await prisma.insight.create({
    data: {
      seniorId: seniorIds.maria,
      type: "watch",
      domain: "sleep",
      title: "A few restless nights appeared",
      summary: "Sleep check-ins were usually steady, with a few lower entries that may be worth watching in the next week.",
      evidenceJson: json({ windowDays: 42, lowerSleepEntries: 4 }),
      severity: InsightSeverity.WATCH,
      confidence: 0.7,
      status: InsightStatus.ACTIVE,
      createdAt: daysAgo(4, 11),
    },
  });
  await prisma.preventionRecommendation.create({
    data: {
      seniorId: seniorIds.maria,
      insightId: mariaSleep.id,
      domain: "sleep",
      title: "Offer a calm evening check-in",
      body: "Ask whether Maria wants a short evening reflection saved for the next day.",
      actionType: "caregiver_touchpoint",
      status: RecommendationStatus.SUGGESTED,
      createdAt: daysAgo(4, 11, 12),
    },
  });

  const johnConnection = await prisma.insight.create({
    data: {
      seniorId: seniorIds.john,
      type: "trend",
      domain: "social",
      title: "Afternoons looked quieter",
      summary: "John's social connection entries were lower on several weekdays, especially when no call was planned.",
      evidenceJson: json({ windowDays: 42, lowerSocialEntries: 11 }),
      severity: InsightSeverity.WATCH,
      confidence: 0.76,
      status: InsightStatus.ACTIVE,
      createdAt: daysAgo(3, 10),
    },
  });
  await prisma.preventionRecommendation.create({
    data: {
      seniorId: seniorIds.john,
      insightId: johnConnection.id,
      domain: "social",
      title: "Plan a short friendly call",
      body: "Add one planned afternoon call or message on quieter weekdays.",
      actionType: "connection_prompt",
      status: RecommendationStatus.ACCEPTED,
      createdAt: daysAgo(3, 10, 10),
    },
  });

  const johnMedication = await prisma.insight.create({
    data: {
      seniorId: seniorIds.john,
      type: "watch",
      domain: "medication_rhythm",
      title: "Evening reminders were used more often",
      summary: "John logged several evening medication events late or after a reminder.",
      evidenceJson: json({ windowDays: 42, reminderOrMissedEvents: 8 }),
      severity: InsightSeverity.ATTENTION,
      confidence: 0.8,
      status: InsightStatus.ACTIVE,
      createdAt: daysAgo(1, 12),
    },
  });
  await prisma.preventionRecommendation.create({
    data: {
      seniorId: seniorIds.john,
      insightId: johnMedication.id,
      domain: "medication_rhythm",
      title: "Review the evening routine",
      body: "Ana can check whether John wants the evening list made easier to find.",
      actionType: "caregiver_touchpoint",
      status: RecommendationStatus.SUGGESTED,
      createdAt: daysAgo(1, 12, 10),
    },
  });

  await prisma.alert.createMany({
    data: [
      {
        seniorId: seniorIds.maria,
        type: "missed_check_in",
        severity: AlertSeverity.INFO,
        message: "Maria had one incomplete check-in during the six-week sample.",
        evidenceJson: json({ incompleteDailyCheckIns: 1 }),
        status: AlertStatus.REVIEWED,
        createdAt: daysAgo(16, 13),
        reviewedAt: daysAgo(15, 10),
      },
      {
        seniorId: seniorIds.john,
        type: "connection_watch",
        severity: AlertSeverity.ATTENTION,
        message: "John had several lower social connection entries on weekdays.",
        evidenceJson: json({ lowerSocialEntries: 11, windowDays: 42 }),
        status: AlertStatus.OPEN,
        createdAt: daysAgo(3, 10),
      },
      {
        seniorId: seniorIds.john,
        type: "medication_event_watch",
        severity: AlertSeverity.ATTENTION,
        message: "John had multiple late or missed medication event logs in the sample.",
        evidenceJson: json({ reminderOrMissedEvents: 8, windowDays: 42 }),
        status: AlertStatus.OPEN,
        createdAt: daysAgo(1, 12),
      },
    ],
  });
}

async function main() {
  await clearDemoData();
  await seedQuestions();

  const { ana, maria, john } = await createDemoUsers();

  await seedCheckIns(maria.profile.id, "maria");
  await seedCheckIns(john.profile.id, "john");
  await seedBaselines(maria.profile.id, "maria");
  await seedBaselines(john.profile.id, "john");
  await seedMedications(maria.profile.id, "maria");
  await seedMedications(john.profile.id, "john");
  await seedCaregiverNotes({ maria: maria.profile.id, john: john.profile.id }, ana.id);
  const [mariaIntelligence, johnIntelligence] = await Promise.all([
    runVyvaIntelligenceForSenior(prisma, maria.profile.id),
    runVyvaIntelligenceForSenior(prisma, john.profile.id),
  ]);

  const weeklyQuestionIds = VYVA_WEEKLY_QUESTION_BANK.filter((question) => question.active).map((question) => question.id);
  const weeklyFormNumbers = VYVA_WEEKLY_FORMS.map((form) => form.weekNumber);
  const [users, sessions, medicationEvents, notes, insights, alerts, weeklyQuestions, weeklyForms] = await Promise.all([
    prisma.user.count({ where: { name: { in: demoNames } } }),
    prisma.assessmentSession.count({ where: { seniorId: { in: [maria.profile.id, john.profile.id] } } }),
    prisma.medicationEvent.count({ where: { seniorId: { in: [maria.profile.id, john.profile.id] } } }),
    prisma.caregiverNote.count({ where: { seniorId: { in: [maria.profile.id, john.profile.id] } } }),
    prisma.insight.count({ where: { seniorId: { in: [maria.profile.id, john.profile.id] } } }),
    prisma.alert.count({ where: { seniorId: { in: [maria.profile.id, john.profile.id] } } }),
    prisma.question.count({ where: { id: { in: weeklyQuestionIds }, active: true } }),
    prisma.weeklyForm.count({ where: { weekNumber: { in: weeklyFormNumbers }, active: true } }),
  ]);

  console.log(`Seeded ${weeklyQuestions} weekly questions and ${weeklyForms} weekly forms.`);
  console.log(`Seeded ${users} demo users, ${sessions} sessions, ${medicationEvents} medication events, ${notes} caregiver notes, ${insights} insights, and ${alerts} alerts.`);
  console.log(`Generated ${mariaIntelligence.baselines.length} Maria baselines, ${mariaIntelligence.insights.length} Maria insights, ${johnIntelligence.baselines.length} John baselines, and ${johnIntelligence.insights.length} John insights.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
