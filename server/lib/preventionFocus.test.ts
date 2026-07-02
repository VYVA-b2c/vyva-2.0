import { describe, expect, it } from "vitest";
import { buildPreventionFocus } from "./preventionFocus.js";
import { PREVENTION_CONTENT_LIBRARY } from "./preventionContentLibrary.js";

const now = new Date("2026-07-02T10:00:00.000Z");

describe("prevention focus engine", () => {
  it("prioritizes Diabetes for diabetes context with high glucose", () => {
    const result = buildPreventionFocus({
      now,
      conditions: ["Type 2 diabetes"],
      recentVitals: [{ signalType: "glucose_mg_dl", value: 221, recordedAt: now }],
    });

    expect(result.focus).toBe("Diabetes");
    expect(result.primaryRoute).toBe("/health/vitals");
    expect(result.why.join(" ")).toContain("glucose");
    expect(result.insights.some((insight) => insight.value === "Glucose 221")).toBe(true);
    expect(result.guidance.some((item) => item.id === "eat" && item.headline.includes("steady plate"))).toBe(true);
    const eat = result.guidance.find((item) => item.id === "eat");
    expect(eat?.actionSheet?.recipes).toHaveLength(3);
    expect(eat?.actionSheet?.primaryAction.shoppingPrefill?.constraints).toEqual(expect.arrayContaining(["diabetic diet"]));
    expect(result.actions[0]).toMatchObject({ label: "Food ideas", route: "/health/doctor", mode: "voice" });
    expect(result.dailyActions).toHaveLength(3);
    expect(result.dailyActions.map((item) => item.id)).toEqual([
      "diabetes_water_first_005",
      "diabetes_after_meal_walk_006",
      "diabetes_no_sugary_drink_013",
    ]);
    expect(result.dailyActions.find((item) => item.id === "diabetes_water_first_005")?.actionSheet.primaryAction.route).toBe("/concierge/shopping");
    expect(result.dailyActions.find((item) => item.id === "diabetes_after_meal_walk_006")?.actionSheet.primaryAction.route).toBe("/social-rooms/morning-movement/exercises/seated-strength");
    expect(result.dailyActions.find((item) => item.id === "diabetes_no_sugary_drink_013")?.step).toBe("Protect");
  });

  it("prioritizes Heart for high blood pressure or heart context", () => {
    const result = buildPreventionFocus({
      now,
      conditions: ["High blood pressure"],
      recentVitals: [
        { signalType: "bp_systolic", value: 168, recordedAt: now },
        { signalType: "bp_diastolic", value: 96, recordedAt: now },
      ],
    });

    expect(result.focus).toBe("Heart");
    expect(result.primaryRoute).toBe("/health/vitals");
    expect(result.helpSigns).toContain("Chest pain");
    expect(result.insights.some((insight) => insight.value === "BP 168/96")).toBe(true);
    expect(result.profileSignals).toContain("BP 168/96");
    expect(result.personalizationSummary).toContain("Blood pressure profile");
    expect(result.personalizationSummary).not.toContain("BP 168/96");
    expect(result.guidance.some((item) => item.id === "eat" && item.headline.includes("lower-salt"))).toBe(true);
    const eat = result.guidance.find((item) => item.id === "eat");
    expect(eat?.actionSheet?.primaryAction).toMatchObject({ label: "Show groceries", route: "/concierge/shopping" });
    expect(eat?.actionSheet?.recipes?.map((item) => item.title)).toContain("Lemon chicken with vegetables");
    expect(eat?.actionSheet?.safetyNote).toContain("Check ingredients");
    expect(result.learning.detail).toContain("DASH meals");
    expect(result.dailyActions).toHaveLength(3);
    expect(result.dailyActions.map((item) => item.id)).toEqual([
      "heart_low_salt_meal_001",
      "heart_calm_breath_007",
      "heart_skip_salty_foods_010",
    ]);
    expect(result.dailyActions.find((item) => item.id === "heart_low_salt_meal_001")?.actionSheet.recipes?.length).toBeGreaterThan(0);
    expect(result.dailyActions.find((item) => item.id === "heart_low_salt_meal_001")?.step).toBe("Eat");
    expect(result.dailyActions.find((item) => item.id === "heart_calm_breath_007")?.step).toBe("Calm");
    expect(result.dailyActions.find((item) => item.id === "heart_calm_breath_007")?.actionSheet.primaryAction.route).toBe("/activities/relax-breathe");
    expect(result.dailyActions.find((item) => item.id === "heart_skip_salty_foods_010")?.actionSheet.primaryAction.route).toBe("/concierge/shopping");
  });

  it("prioritizes Falls for mobility and sedating medicine context", () => {
    const result = buildPreventionFocus({
      now,
      mobilityLevel: "Uses a walker",
      activeMedications: [{ medicationName: "Diazepam", scheduledTimes: [] }],
      adherence: { scheduledToday: 0, takenToday: 0, missedOrLate30: 0 },
    });

    expect(result.focus).toBe("Falls");
    expect(result.primaryRoute).toBe("/safe-home");
    expect(result.todayAction).toContain("Stand slowly");
    expect(result.guidance.some((item) => item.id === "avoid" && item.detail.includes("No fast standing"))).toBe(true);
    expect(result.guidance.find((item) => item.id === "move")?.actionSheet?.primaryAction.route).toBe("/social-rooms/morning-movement/exercises/sit-to-stand");
    expect(result.dailyActions.map((item) => item.id)).toEqual([
      "mobility_hydration_protein_007",
      "mobility_chair_strength_001",
      "mobility_clear_clutter_006",
    ]);
    expect(result.dailyActions.find((item) => item.id === "mobility_clear_clutter_006")?.step).toBe("Home");
    expect(result.dailyActions.find((item) => item.id === "mobility_clear_clutter_006")?.actionSheet.primaryAction.route).toBe("/safe-home");
  });

  it("prioritizes Medicine for missed doses or medication safety signals", () => {
    const result = buildPreventionFocus({
      now,
      activeMedications: [{ medicationName: "Metformin", scheduledTimes: ["08:00"] }],
      adherence: { scheduledToday: 1, takenToday: 0, missedOrLate30: 2 },
      medicationSafetySignals: [{
        signalType: "possible_side_effect",
        severity: "review",
        title: "Dizziness after medicine",
        summary: "Check medicine safety",
      }],
    });

    expect(result.focus).toBe("Medicine");
    expect(result.primaryRoute).toBe("/meds");
    expect(result.signals.some((signal) => signal.id === "medicine-safety")).toBe(true);
    expect(result.insights.some((insight) => insight.value === "Open signal")).toBe(true);
    expect(result.guidance.find((item) => item.id === "do")?.actionSheet?.primaryAction.route).toBe("/meds");
    expect(result.actions[0]).toMatchObject({ label: "Simplify routine", mode: "voice" });
    expect(result.dailyActions.map((item) => item.id)).toEqual([
      "meds_food_water_cue_008",
      "meds_pause_before_change_014",
      "meds_missed_dose_007",
    ]);
    expect(result.dailyActions.find((item) => item.id === "meds_food_water_cue_008")?.step).toBe("Eat");
    expect(result.dailyActions.find((item) => item.id === "meds_pause_before_change_014")?.step).toBe("Calm");
    expect(result.dailyActions.find((item) => item.id === "meds_missed_dose_007")?.actionSheet.primaryAction.route).toBe("/meds");
  });

  it("prioritizes Follow-up for a recent symptom report", () => {
    const result = buildPreventionFocus({
      now,
      latestSymptomReport: {
        id: "triage-1",
        chiefComplaint: "Mild dizziness",
        urgency: "routine",
        nextStepLevel: "doctor_today",
        watchSigns: ["Worse dizziness", "Fainting"],
        createdAt: "2026-07-01T09:00:00.000Z",
      },
    });

    expect(result.focus).toBe("Follow-up");
    expect(result.primaryRoute).toBe("/informes/triage-1");
    expect(result.helpSigns).toEqual(["Worse dizziness", "Fainting"]);
    expect(result.guidance.find((item) => item.id === "do")?.actionSheet?.primaryAction.route).toBe("/informes/triage-1");
    expect(result.dailyActions.map((item) => item.id)).toEqual([
      "symptom_simple_rest_005",
      "symptom_rest_note_009",
      "symptom_what_changed_001",
    ]);
    expect(result.dailyActions.find((item) => item.id === "symptom_simple_rest_005")?.step).toBe("Eat");
    expect(result.dailyActions.find((item) => item.id === "symptom_what_changed_001")?.actionSheet.primaryAction.route).toBe("/health/symptom-check");
    expect(result.dailyActions.find((item) => item.id === "symptom_rest_note_009")?.step).toBe("Calm");
  });

  it("returns Plan when no strong signal is available", () => {
    const result = buildPreventionFocus({ now });

    expect(result.focus).toBe("Plan");
    expect(result.confidence).toBe("limited");
    expect(result.primaryRoute).toBe("/health/check-in");
    expect(result.guidance).toHaveLength(4);
    expect(result.guidance.every((item) => item.actionSheet?.primaryAction)).toBe(true);
    expect(result.learning.detail).toContain("Vaccines");
    expect(result.dailyActions.map((item) => item.id)).toEqual([
      "prevention_easy_water_010",
      "prevention_daily_walk_004",
      "prevention_sleep_routine_005",
    ]);
  });

  it("uses saved diet and allergy context in food guidance", () => {
    const result = buildPreventionFocus({
      now,
      conditions: ["High blood pressure"],
      dietaryPreferences: ["Low salt"],
      allergies: ["Peanuts"],
      recentVitals: [{ signalType: "blood_pressure", value: "168/96", recordedAt: now }],
    });

    const eat = result.guidance.find((item) => item.id === "eat");
    expect(eat?.actionSheet?.safetyNote).toContain("Peanuts");
    expect(eat?.actionSheet?.primaryAction.shoppingPrefill?.constraints).toEqual(expect.arrayContaining([
      "low salt",
      "avoid saved allergies: Peanuts",
    ]));
  });

  it("keeps the prevention content library source-backed and action-ready", () => {
    expect(PREVENTION_CONTENT_LIBRARY.length).toBeGreaterThanOrEqual(75);

    for (const item of PREVENTION_CONTENT_LIBRARY) {
      expect(item.sourceRefs.length).toBeGreaterThan(0);
      expect(item.actionRoutes.length).toBeGreaterThan(0);
      expect(item.cardVersion.title.length).toBeGreaterThan(0);
      expect(item.cardVersion.detail.length).toBeGreaterThan(0);
      expect(item.redFlags.length).toBeGreaterThan(0);
      expect(item.doNotSay.length).toBeGreaterThan(0);
      expect(item.medicalBoundary).toBe("general_wellness");
    }

    const medicineItems = PREVENTION_CONTENT_LIBRARY.filter((item) => item.focus === "Medicine");
    expect(medicineItems.length).toBeGreaterThan(0);
    expect(medicineItems.every((item) => item.doNotSay.includes("Change, stop, double, or skip prescribed medicine."))).toBe(true);
    expect(PREVENTION_CONTENT_LIBRARY.some((item) => item.actionType === "Sleep")).toBe(true);
    expect(PREVENTION_CONTENT_LIBRARY.some((item) => item.actionType === "Home safety")).toBe(true);
    expect(PREVENTION_CONTENT_LIBRARY.some((item) => item.actionType === "Medicine")).toBe(true);
    expect(PREVENTION_CONTENT_LIBRARY.some((item) => item.actionType === "Calm")).toBe(true);
  });

  it("guarantees one food move, one movement or calm move, and one contextual support move", () => {
    const scenarios = [
      buildPreventionFocus({
        now,
        conditions: ["High blood pressure"],
        recentVitals: [{ signalType: "bp_systolic", value: 168, recordedAt: now }],
      }),
      buildPreventionFocus({
        now,
        conditions: ["Type 2 diabetes"],
        recentVitals: [{ signalType: "glucose_mg_dl", value: 221, recordedAt: now }],
      }),
      buildPreventionFocus({
        now,
        mobilityLevel: "Uses a walker",
        activeMedications: [{ medicationName: "Diazepam", scheduledTimes: [] }],
      }),
      buildPreventionFocus({
        now,
        activeMedications: [{ medicationName: "Metformin", scheduledTimes: ["08:00"] }],
        adherence: { scheduledToday: 1, takenToday: 0, missedOrLate30: 2 },
      }),
      buildPreventionFocus({
        now,
        latestSymptomReport: {
          id: "triage-1",
          chiefComplaint: "Mild dizziness",
          urgency: "routine",
          nextStepLevel: "doctor_today",
          watchSigns: ["Worse dizziness"],
          createdAt: "2026-07-01T09:00:00.000Z",
        },
      }),
      buildPreventionFocus({ now }),
    ];

    for (const result of scenarios) {
      const steps = result.dailyActions.map((item) => item.step);
      expect(steps).toContain("Eat");
      expect(steps.some((step) => step === "Move" || step === "Calm")).toBe(true);
      expect(new Set(steps).size).toBe(3);
    }
  });

  it("rotates recently shown actions instead of repeating the same first move", () => {
    const result = buildPreventionFocus({
      now,
      conditions: ["High blood pressure"],
      recentVitals: [{ signalType: "bp_systolic", value: 168, recordedAt: now }],
      loopContext: {
        clientHour: 10,
        recentFeedback: [{
          actionId: "heart_low_salt_meal_001",
          title: "Low-salt meal",
          step: "Eat",
          tone: "food",
          feedback: "shown",
          date: "2026-07-01",
        }],
      },
    });

    expect(result.dailyActions[0].step).toBe("Eat");
    expect(result.dailyActions[0].id).not.toBe("heart_low_salt_meal_001");
    expect(result.ranking.rankingReasons).toContain("Rotating recently seen moves");
  });

  it("uses too-hard barriers to pick a calmer movement replacement", () => {
    const result = buildPreventionFocus({
      now,
      conditions: ["Type 2 diabetes"],
      recentVitals: [{ signalType: "glucose_mg_dl", value: 221, recordedAt: now }],
      loopContext: {
        clientHour: 15,
        recentFeedback: [{
          actionId: "diabetes_after_meal_walk_006",
          title: "After-meal walk",
          step: "Move",
          tone: "movement",
          feedback: "too_hard",
          barrier: "physical",
          date: "2026-07-01",
        }],
      },
    });

    expect(result.dailyActions.map((item) => item.id)).toContain("diabetes_calm_pause_016");
    expect(result.dailyActions.find((item) => item.id === "diabetes_calm_pause_016")?.step).toBe("Calm");
    expect(result.weeklySummary.detail).toContain("movement felt hard");
  });

  it("uses time of day to favor evening prevention support", () => {
    const result = buildPreventionFocus({
      now,
      loopContext: {
        clientHour: 20,
        recentFeedback: [],
      },
    });

    expect(result.ranking.timeOfDay).toBe("evening");
    expect(result.dailyActions.map((item) => item.id)).toContain("prevention_sleep_routine_005");
  });

  it("keeps every daily action connected to a useful next step", () => {
    const result = buildPreventionFocus({
      now,
      conditions: ["High blood pressure"],
      recentVitals: [{ signalType: "bp_systolic", value: 168, recordedAt: now }],
    });

    for (const item of result.dailyActions) {
      expect(item.actionSheet.primaryAction.route).toMatch(/^\/|^http/);
      expect(item.actionSheet.primaryAction.label.length).toBeGreaterThan(0);
    }
  });

  it("returns weekly memory for VYVA, caregivers, and doctor context", () => {
    const result = buildPreventionFocus({
      now,
      conditions: ["High blood pressure"],
      loopContext: {
        clientHour: 9,
        recentFeedback: [
          {
            actionId: "heart_calm_breath_007",
            title: "Calm breathing",
            step: "Calm",
            tone: "movement",
            feedback: "done",
            date: "2026-07-01",
          },
          {
            actionId: "heart_low_salt_meal_001",
            title: "Low-salt meal",
            step: "Eat",
            tone: "food",
            feedback: "too_hard",
            barrier: "cooking",
            date: "2026-07-01",
          },
        ],
      },
    });

    expect(result.weeklySummary.headline).toBe("VYVA made today easier.");
    expect(result.weeklySummary.doctorSummary).toContain("Prevention focus");
    expect(result.weeklySummary.caregiverSummary).toContain("Smallest useful step");
    expect(result.doctorNote).toContain("Today's suggested moves");
  });
});
