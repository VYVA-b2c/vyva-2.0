import { describe, expect, it } from "vitest";
import { savedCheckinActionsWithGpContact, savedCheckinNavigationFor, savedCheckinServiceActionsFor } from "./CheckinHistoryScreen";

const baseReport = {
  id: "checkin-1",
  completed_at: "2026-06-01T10:00:00.000Z",
  energy_level: 2,
  mood: "ansiosa",
  sleep_quality: "regular",
  symptoms: [],
  social_contact: "no",
  feeling_label: "A careful day",
  overall_state: "moderate" as const,
  vyva_reading: "VYVA noticed a few things to watch.",
  right_now: ["Take vital signs if you can."],
  today_actions: ["Use the symptom check if this worsens.", "Look at For you today in Concierge."],
  highlight: "Chest discomfort should be checked carefully.",
  flag_caregiver: false,
  watch_for: "If chest pain or shortness of breath appears, seek medical attention.",
  language: "en",
};

describe("saved check-in service actions", () => {
  it("maps saved health and concierge suggestions into service buttons", () => {
    expect(savedCheckinServiceActionsFor(baseReport).map((action) => action.key)).toEqual([
      "care",
      "appointment",
      "ride",
      "symptom",
      "vitals",
    ]);
  });

  it("keeps saved concierge suggestions actionable when no health priority is present", () => {
    expect(savedCheckinServiceActionsFor({
      ...baseReport,
      right_now: ["Choose one pleasant activity."],
      today_actions: ["Look at For you today in Concierge for a nearby adapted idea."],
      highlight: "A calm outing may help today.",
      watch_for: null,
    })).toEqual([
      { key: "concierge", title: "Preparar ayuda", to: "/concierge" },
    ]);
  });

  it("routes saved doctor actions to doctor help with report context", () => {
    const action = savedCheckinServiceActionsFor(baseReport)[0];

    expect(savedCheckinNavigationFor(baseReport, "Karim", action)).toMatchObject({
      to: "/health/doctor",
      state: {
        autoStartVoice: true,
        latestSymptomReport: expect.stringContaining("Chest discomfort"),
      },
    });
  });

  it("prepends direct GP call and email links for saved care-related readings", () => {
    const actions = savedCheckinActionsWithGpContact(
      savedCheckinServiceActionsFor(baseReport),
      {
        gpName: "Dr Garcia",
        gpPhone: "+34 612 345 678",
        gpEmail: "gp@example.com",
      },
      baseReport,
      "Karim",
    );

    expect(actions.map((action) => action.key)).toEqual([
      "call_gp",
      "email_gp",
      "care",
      "appointment",
      "ride",
      "symptom",
      "vitals",
    ]);
    expect(actions[0]).toMatchObject({
      title: "Call Dr Garcia",
      href: "tel:+34612345678",
    });
    expect(actions[1]).toMatchObject({
      title: "Email GP",
      href: expect.stringContaining("mailto:gp@example.com"),
    });
    expect(actions[1].href).toContain("Chest%20discomfort");
  });

  it("does not add GP links to saved non-care readings", () => {
    const report = {
      ...baseReport,
      right_now: ["Choose one pleasant activity."],
      today_actions: ["Look at For you today in Concierge for a nearby adapted idea."],
      highlight: "A calm outing may help today.",
      watch_for: null,
    };

    const actions = savedCheckinActionsWithGpContact(
      savedCheckinServiceActionsFor(report),
      { gpPhone: "+34 612 345 678", gpEmail: "gp@example.com" },
      report,
      "Karim",
    );

    expect(actions.map((action) => action.key)).toEqual(["concierge"]);
  });

  it("routes saved concierge actions with a prepared confirmation request", () => {
    const report = {
      ...baseReport,
      right_now: ["Choose one pleasant activity."],
      today_actions: ["Look at For you today in Concierge for a nearby adapted idea."],
      highlight: "A calm outing may help today.",
      watch_for: null,
    };
    const action = savedCheckinServiceActionsFor(report)[0];

    expect(savedCheckinNavigationFor(report, "Karim", action)).toEqual({
      to: "/concierge",
      state: {
        conciergePrefill: {
          kind: "task",
          message: expect.stringContaining("check-in guardado de Karim"),
          source: "daily_checkin",
        },
      },
    });
  });

  it("routes saved appointment and ride actions with check-in context", () => {
    const [, appointment, ride] = savedCheckinServiceActionsFor(baseReport);

    expect(savedCheckinNavigationFor(baseReport, "Karim", appointment)).toEqual({
      to: "/concierge",
      state: {
        conciergePrefill: {
          kind: "appointment",
          message: expect.stringContaining("schedule a care appointment"),
          source: "daily_checkin",
        },
      },
    });
    expect(savedCheckinNavigationFor(baseReport, "Karim", ride)).toEqual({
      to: "/concierge",
      state: {
        conciergePrefill: {
          kind: "ride",
          message: expect.stringContaining("find safe transport options"),
          source: "daily_checkin",
        },
      },
    });
    expect(JSON.stringify(savedCheckinNavigationFor(baseReport, "Karim", ride).state)).toContain("Chest discomfort");
  });

  it("routes saved delivery and home-help quote actions with check-in context", () => {
    const report = {
      ...baseReport,
      right_now: ["Order water and electrolytes for delivery."],
      today_actions: ["Have someone stay with you and request a home care quote."],
      highlight: "Hydration and home support may help.",
      watch_for: null,
    };
    const actions = savedCheckinServiceActionsFor(report);

    expect(actions.map((action) => action.key)).toContain("order");
    expect(actions.map((action) => action.key)).toContain("quote");

    const order = actions.find((action) => action.key === "order")!;
    const quote = actions.find((action) => action.key === "quote")!;

    expect(savedCheckinNavigationFor(report, "Karim", order)).toEqual({
      to: "/concierge/shopping",
      state: {
        shoppingPrefill: {
          needText: expect.stringContaining("safe delivery"),
          category: "groceries",
          priorities: ["delivery", "simplicity", "safety"],
        },
      },
    });
    expect(savedCheckinNavigationFor(report, "Karim", quote)).toEqual({
      to: "/concierge",
      state: {
        conciergePrefill: {
          kind: "home_care_quote",
          message: expect.stringContaining("companion or home support"),
          source: "daily_checkin",
        },
      },
    });
  });

  it("keeps all saved service actions when a report has clinical and practical needs", () => {
    const actions = savedCheckinServiceActionsFor({
      ...baseReport,
      right_now: [
        "Take vital signs if you can.",
        "Order water and electrolytes for delivery.",
      ],
      today_actions: [
        "Use the symptom check if this worsens.",
        "Have someone stay with you and request a home care quote.",
      ],
      highlight: "Chest discomfort, hydration, and home support should be handled.",
      watch_for: "If chest pain or shortness of breath appears, seek medical attention.",
    });

    expect(actions.map((action) => action.key)).toEqual([
      "care",
      "appointment",
      "ride",
      "symptom",
      "vitals",
      "order",
      "quote",
    ]);
  });
});
