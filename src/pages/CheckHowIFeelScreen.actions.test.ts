import { describe, expect, it } from "vitest";
import { addDirectGpActionsForCheckin, appActionsFor, checkinActionNavigationFor } from "./CheckHowIFeelScreen";

describe("daily check-in service action navigation", () => {
  it("adds appointment and transport to live health-priority check-in results", () => {
    const actions = appActionsFor(
      {
        energy_level: 2,
        mood: "ansiosa",
        body_areas: ["pecho"],
        sleep_quality: "regular",
        symptoms: [],
        symptom_details: [],
        safety_flags: [],
        social_contact: "algo",
      },
      {
        feeling_label: "Needs attention",
        overall_state: "moderate",
        vyva_reading: "Chest discomfort should be checked.",
        right_now: ["Check symptoms"],
        today_actions: ["Talk to care"],
        highlight: "Chest discomfort",
        flag_caregiver: true,
        watch_for: "Seek medical attention if it continues.",
      },
    );

    expect(actions.map((action) => action.key)).toEqual(["symptom", "appointment", "ride"]);
  });

  it("routes care actions straight to doctor help with report context", () => {
    expect(checkinActionNavigationFor(
      { key: "care", to: "/health" },
      {
        reportText: "Daily check-in: chest pressure and shortness of breath.",
        symptomClue: "Chest pressure",
        conciergeMessage: "Prepare help.",
      },
    )).toEqual({
      to: "/health/doctor",
      state: {
        autoStartVoice: true,
        latestSymptomReport: "Daily check-in: chest pressure and shortness of breath.",
      },
    });
  });

  it("adds direct GP call and email actions to care-related check-in results", () => {
    const actions = appActionsFor(
      {
        energy_level: 2,
        mood: "ansiosa",
        body_areas: ["pecho"],
        sleep_quality: "regular",
        symptoms: [],
        symptom_details: [],
        safety_flags: [],
        social_contact: "algo",
      },
      {
        feeling_label: "Needs attention",
        overall_state: "moderate",
        vyva_reading: "Chest discomfort should be checked.",
        right_now: ["Check symptoms"],
        today_actions: ["Talk to care"],
        highlight: "Chest discomfort",
        flag_caregiver: true,
        watch_for: "Seek medical attention if it continues.",
      },
    );

    const directActions = addDirectGpActionsForCheckin(
      actions,
      {
        gpName: "Dr Garcia",
        gpPhone: "+34 612 345 678",
        gpEmail: "gp@example.com",
      },
      "Daily check-in: chest discomfort should be checked.",
    );

    expect(directActions.map((action) => action.key)).toEqual([
      "call_gp",
      "email_gp",
      "symptom",
      "appointment",
      "ride",
    ]);
    expect(directActions[0]).toMatchObject({
      title: "Call Dr Garcia",
      href: "tel:+34612345678",
      primary: true,
    });
    expect(directActions[1]).toMatchObject({
      title: "Email GP",
      href: expect.stringContaining("mailto:gp@example.com"),
    });
    expect(directActions[1].href).toContain("Daily%20check-in%3A%20chest%20discomfort");
  });

  it("does not add GP links to non-care check-in results", () => {
    const actions = addDirectGpActionsForCheckin(
      [{ key: "music", title: "Music", description: "Listen", to: "/chat?q=music", primary: true }],
      { gpPhone: "+34 612 345 678", gpEmail: "gp@example.com" },
      "Feeling good today.",
    );

    expect(actions.map((action) => action.key)).toEqual(["music"]);
  });

  it("prefills the symptom checker from symptom actions", () => {
    expect(checkinActionNavigationFor(
      { key: "symptom", to: "/health/symptom-check" },
      {
        reportText: "",
        symptomClue: "Dizzy and tired today",
        conciergeMessage: "Prepare help.",
      },
    )).toEqual({
      to: "/health/symptom-check",
      state: {
        initialClue: "Dizzy and tired today",
        autoStartVoice: false,
      },
    });
  });

  it("turns appointment and ride actions into prepared care requests", () => {
    expect(checkinActionNavigationFor(
      { key: "appointment", to: "/concierge" },
      {
        reportText: "Daily check-in: chest pressure and shortness of breath.",
        symptomClue: "Chest pressure",
        conciergeMessage: "Prepare help.",
      },
    )).toEqual({
      to: "/concierge",
      state: {
        conciergePrefill: {
          kind: "appointment",
          message: "Please help me schedule a care appointment based on today's VYVA check-in. Ask me to confirm before booking.\n\nDaily check-in: chest pressure and shortness of breath.",
          source: "daily_checkin",
        },
      },
    });

    expect(checkinActionNavigationFor(
      { key: "ride", to: "/concierge" },
      {
        reportText: "",
        symptomClue: "Dizzy today",
        conciergeMessage: "Prepare help.",
      },
    )).toEqual({
      to: "/concierge",
      state: {
        conciergePrefill: {
          kind: "ride",
          message: "Please help me arrange safe transport for care based on today's VYVA check-in. Ask me to confirm before booking.\n\nDizzy today",
          source: "daily_checkin",
        },
      },
    });
  });

  it("turns concierge actions into prepared task requests", () => {
    expect(checkinActionNavigationFor(
      { key: "concierge", to: "/concierge" },
      {
        reportText: "",
        symptomClue: "",
        conciergeMessage: "Please prepare an easy outing with transport if needed.",
      },
    )).toEqual({
      to: "/concierge",
      state: {
        conciergePrefill: {
          kind: "task",
          message: "Please prepare an easy outing with transport if needed.",
          source: "daily_checkin",
        },
      },
    });
  });

  it("adds delivery and home help actions when the check-in suggests practical support", () => {
    const actions = appActionsFor(
      {
        energy_level: 3,
        mood: "tranquila",
        body_areas: ["ninguno"],
        sleep_quality: "bien",
        symptoms: ["ninguno"],
        symptom_details: [],
        safety_flags: [],
        social_contact: "algo",
      },
      {
        feeling_label: "Practical support",
        overall_state: "moderate",
        vyva_reading: "Hydration and home support would help today.",
        right_now: ["Order water or electrolytes for delivery."],
        today_actions: ["Have someone stay with you or request home help."],
        highlight: "Hydration and company",
        flag_caregiver: false,
        watch_for: null,
      },
    );

    expect(actions.map((action) => action.key)).toContain("order");
    expect(actions.map((action) => action.key)).toContain("quote");
  });

  it("keeps every applicable service action instead of stopping at three", () => {
    const actions = appActionsFor(
      {
        energy_level: 2,
        mood: "tranquila",
        body_areas: ["mareo"],
        sleep_quality: "regular",
        symptoms: ["mareo"],
        symptom_details: [],
        safety_flags: ["mild_stable"],
        social_contact: "algo",
      },
      {
        feeling_label: "Support needed",
        overall_state: "moderate",
        vyva_reading: "Dizziness, hydration, and home support should be handled today.",
        right_now: [
          "Use the symptom check if dizziness worsens.",
          "Take vital signs if you can.",
          "Order water and electrolytes for delivery.",
        ],
        today_actions: ["Have someone stay with you and request home care support."],
        highlight: "Dizziness with practical support needs",
        flag_caregiver: false,
        watch_for: "If dizziness worsens, use symptom check and take vital signs.",
      },
    );

    expect(actions.map((action) => action.key)).toEqual([
      "symptom",
      "vitals",
      "order",
      "quote",
    ]);
  });

  it("routes delivery and quote actions into confirmation-first service flows", () => {
    expect(checkinActionNavigationFor(
      { key: "order", to: "/concierge/shopping" },
      {
        reportText: "Daily check-in: hydration support would help.",
        symptomClue: "",
        conciergeMessage: "",
      },
    )).toEqual({
      to: "/concierge/shopping",
      state: {
        shoppingPrefill: {
          needText: "Please help me prepare a safe delivery based on today's VYVA check-in. Ask me to confirm before ordering or paying.\n\nDaily check-in: hydration support would help.",
          category: "groceries",
          priorities: ["delivery", "simplicity", "safety"],
        },
      },
    });

    expect(checkinActionNavigationFor(
      { key: "quote", to: "/concierge" },
      {
        reportText: "Daily check-in: someone should stay nearby today.",
        symptomClue: "",
        conciergeMessage: "",
      },
    )).toEqual({
      to: "/concierge",
      state: {
        conciergePrefill: {
          kind: "home_care_quote",
          message: "Please help me request a quote for companion or home support based on today's VYVA check-in. Ask me to confirm before requesting anything.\n\nDaily check-in: someone should stay nearby today.",
          source: "daily_checkin",
        },
      },
    });
  });

  it("leaves non-service leisure actions on their normal route", () => {
    expect(checkinActionNavigationFor(
      { key: "music", to: "/chat?q=music" },
      {
        reportText: "",
        symptomClue: "",
        conciergeMessage: "",
      },
    )).toEqual({ to: "/chat?q=music" });
  });
});
