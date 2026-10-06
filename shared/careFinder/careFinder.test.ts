import { describe, expect, it } from "vitest";
import {
  careRouteOptions,
  careTypeSearchTerms,
  classifyCareNeed,
  inferCareAccessNeeds,
  normalizeCareCoverage,
} from "./careRoutes";
import { careEmergencyLines, careSafetyChecklist, detectCareRedFlags } from "./redFlags";
import {
  CARE_FINDER_PROGRESS_VERSION,
  careFinderProgressPayload,
  careFinderReducer,
  careFinderStateFromProgress,
  initialCareFinderState,
  nextCareFinderStep,
  type CareFinderAction,
  type CareFinderProfileFacts,
  type CareFinderState,
} from "./flow";
import type { CareFinderSearchResponse } from "./search";
import { conciergeTaskProgressPayloadSchema } from "../conciergeTaskDrafts";

const profile: CareFinderProfileFacts = { coverage: "public", location: "11380 Tarifa", usualDoctorName: "Centro de Salud Tarifa" };

function run(actions: CareFinderAction[], start = initialCareFinderState(), facts: CareFinderProfileFacts | null = profile): CareFinderState {
  return actions.reduce((state, action) => careFinderReducer(state, action, facts), start);
}

const results: CareFinderSearchResponse = {
  status: "ok",
  careType: "physiotherapy",
  access: "private",
  location: "11380 Tarifa",
  orderedBy: "travel_time",
  checkedAt: "2026-10-05T10:00:00.000Z",
  mapsSearchUrl: "https://www.google.com/maps/search/?api=1&query=fisioterapia",
  options: [{
    id: "place-1",
    name: "Fisioterapia Tarifa",
    care_type: "physiotherapy",
    address: "Calle Real 1, Tarifa",
    travel_text: "1,2 km · 4 min",
    travel_minutes: 4,
    wheelchair_entrance: true,
    matched: [],
    assumptions: [],
  }],
};

describe("red flag detection", () => {
  it.each([
    ["Tengo un dolor en el pecho desde esta mañana", "chest"],
    ["my chest hurts and my arm feels heavy", "chest"],
    ["No puedo respirar bien", "breathing"],
    ["Her face is drooping and her speech is slurred", "stroke"],
    ["Mi madre se ha caído y no se puede levantar", "fall_head"],
    ["I don't want to live any more", "self_harm"],
    ["De repente no veo por un ojo", "sudden_vision"],
    ["se me hincha la lengua", "allergic"],
  ])("flags %s", (text, flag) => {
    expect(detectCareRedFlags(text)).toContain(flag);
  });

  it("does not flag the knee example or simple negations", () => {
    expect(detectCareRedFlags("My knee has been hurting and stairs are difficult.")).toEqual([]);
    expect(detectCareRedFlags("No tengo dolor en el pecho, solo la rodilla")).toEqual([]);
    expect(detectCareRedFlags("I don't have chest pain")).toEqual([]);
  });

  it("asks only relevant warning signs and sends self-harm to 024 first", () => {
    expect(careSafetyChecklist("teeth")).toEqual([]);
    expect(careSafetyChecklist("mood")).toContain("self_harm");
    expect(careSafetyChecklist("pain")).not.toContain("self_harm");
    expect(careEmergencyLines(["self_harm"])).toEqual(["024", "112"]);
    expect(careEmergencyLines(["chest"])).toEqual(["112"]);
  });
});

describe("care routes", () => {
  it("classifies everyday descriptions", () => {
    expect(classifyCareNeed("My knee has been hurting and stairs are difficult.")).toBe("pain");
    expect(classifyCareNeed("Me cuesta oír la tele")).toBe("hearing");
    expect(classifyCareNeed("Algo raro me pasa")).toBeNull();
    expect(classifyCareNeed("No oigo bien")).toBe("hearing");
    expect(classifyCareNeed("solo me duele la rodilla")).toBe("pain");
    expect(classifyCareNeed("Necesito una receta")).toBe("checkup");
  });

  it("infers step-free access from mentions of stairs", () => {
    expect(inferCareAccessNeeds("stairs are difficult")).toEqual(["step_free"]);
    expect(inferCareAccessNeeds("me cuesta subir escaleras")).toEqual(["step_free"]);
  });

  it("starts public patients with the family doctor and private patients directly", () => {
    const publicRoute = careRouteOptions({ need: "pain", coverage: "public", urgency: "this_week" });
    expect(publicRoute[0]).toMatchObject({ careType: "primary_care", access: "public", suggested: true });
    expect(publicRoute.map((option) => option.careType)).toEqual(["primary_care", "physiotherapy", "orthopaedics"]);

    const privateRoute = careRouteOptions({ need: "pain", coverage: "private", urgency: "this_week" });
    expect(privateRoute[0]).toMatchObject({ careType: "orthopaedics", access: "private", suggested: true });
  });

  it("puts same-day care first for today, never a specialist", () => {
    const today = careRouteOptions({ need: "pain", coverage: "public", urgency: "today" });
    expect(today[0]).toMatchObject({ careType: "same_day", suggested: true });
    expect(today).toHaveLength(3);
    expect(careRouteOptions({ need: "teeth", coverage: "public", urgency: "today" })[0].careType).toBe("urgent_dentist");
  });

  it("treats unknown coverage like the public system", () => {
    expect(careRouteOptions({ need: "unwell", coverage: "unknown", urgency: null })[0]).toMatchObject({ careType: "primary_care", access: "public" });
    expect(normalizeCareCoverage("not sure")).toBe("unknown");
    expect(normalizeCareCoverage("PRIVATE")).toBe("private");
  });

  it("never searches care homes for health needs", () => {
    const terms = careTypeSearchTerms("physiotherapy", "private", ["home_visit"]);
    expect(terms[0]).toBe("fisioterapia a domicilio");
    expect(terms.join(" ")).not.toMatch(/residencia|centro de dia|ayuda a domicilio/);
    expect(careTypeSearchTerms("primary_care", "public")).toEqual(["centro de salud"]);
  });
});

describe("care finder flow", () => {
  it("runs the knee journey with the fewest questions", () => {
    let state = run([{ type: "chooseWho", who: "self" }]);
    expect(state.step).toBe("need");
    state = careFinderReducer(state, { type: "submitDescription", text: "My knee has been hurting and stairs are difficult." }, profile);
    expect(state).toMatchObject({ need: "pain", step: "safety", suggestedAccessNeeds: ["step_free"] });
    state = run([
      { type: "answerSafety", flags: [] },
      { type: "chooseUrgency", urgency: "this_week" },
    ], state);
    expect(state.step).toBe("profile");
    state = run([{ type: "acceptProfile", facts: profile }], state);
    expect(state).toMatchObject({ step: "route", coverage: "public", location: "11380 Tarifa" });
    state = run([
      { type: "chooseRoute", careType: "physiotherapy", access: "private" },
      { type: "setAccessNeeds", needs: ["step_free"] },
    ], state);
    expect(state.step).toBe("results");
  });

  it("interrupts with the urgent step for warning signs in free text", () => {
    const state = run([
      { type: "chooseWho", who: "other" },
      { type: "submitDescription", text: "Tiene dolor en el pecho y le cuesta respirar" },
    ]);
    expect(state.step).toBe("urgent");
    expect(state.redFlags).toEqual(expect.arrayContaining(["chest", "breathing"]));
    const continued = careFinderReducer(state, { type: "acknowledgeUrgent" }, profile);
    expect(continued.step).not.toBe("urgent");
  });

  it("routes a checklist warning sign to the urgent step", () => {
    const state = run([
      { type: "chooseWho", who: "self" },
      { type: "chooseNeed", need: "unwell" },
      { type: "answerSafety", flags: ["stroke"] },
    ]);
    expect(state.step).toBe("urgent");
  });

  it("asks where it is for 'not sure' and skips the safety check for teeth", () => {
    const notSure = run([{ type: "chooseWho", who: "self" }, { type: "chooseNeed", need: "not_sure" }]);
    expect(notSure.step).toBe("area");
    const teeth = run([{ type: "chooseWho", who: "self" }, { type: "chooseNeed", need: "teeth" }]);
    expect(teeth.step).toBe("timing");
  });

  it("keeps unmatched descriptions and asks which need is closest", () => {
    const state = run([{ type: "chooseWho", who: "self" }, { type: "submitDescription", text: "Algo raro me pasa" }]);
    expect(state).toMatchObject({ step: "need", descriptionUnmatched: true, description: "Algo raro me pasa" });
  });

  it("asks coverage and place directly without saved details or when declined", () => {
    const base = run([
      { type: "chooseWho", who: "self" },
      { type: "chooseNeed", need: "checkup" },
      { type: "chooseUrgency", urgency: "few_weeks" },
    ], initialCareFinderState(), null);
    expect(base.step).toBe("coverage");
    const declined = run([{ type: "declineProfile" }], { ...base, step: "profile" });
    expect(declined.step).toBe("coverage");
    const afterCoverage = run([{ type: "chooseCoverage", coverage: "private" }], declined);
    expect(afterCoverage.step).toBe("location");
  });

  it("only re-asks what depends on a changed answer", () => {
    const done = run([
      { type: "chooseWho", who: "self" },
      { type: "chooseNeed", need: "pain" },
      { type: "answerSafety", flags: [] },
      { type: "chooseUrgency", urgency: "this_week" },
      { type: "acceptProfile", facts: profile },
      { type: "chooseRoute", careType: "physiotherapy", access: "private" },
      { type: "setAccessNeeds", needs: [] },
      { type: "resultsLoaded", results },
    ]);
    const changedPlace = run([{ type: "change", step: "location" }, { type: "setLocation", location: "Cádiz" }], done);
    expect(changedPlace).toMatchObject({ step: "results", results: null, careType: "physiotherapy" });

    const changedNeed = run([{ type: "change", step: "need" }, { type: "chooseNeed", need: "eyes" }], done);
    expect(changedNeed).toMatchObject({ step: "safety", careType: null, results: null, urgency: "this_week" });
  });

  it("goes back without losing answers", () => {
    const state = run([
      { type: "chooseWho", who: "self" },
      { type: "chooseNeed", need: "pain" },
      { type: "back" },
    ]);
    expect(state).toMatchObject({ step: "need", need: "pain" });
  });
});

describe("persistence and resume", () => {
  it("round-trips through the strict concierge progress whitelist", () => {
    const state = run([
      { type: "chooseWho", who: "other" },
      { type: "submitDescription", text: "Mi rodilla duele" },
      { type: "answerSafety", flags: [] },
      { type: "chooseUrgency", urgency: "this_week" },
      { type: "acceptProfile", facts: profile },
      { type: "chooseRoute", careType: "physiotherapy", access: "private" },
      { type: "setAccessNeeds", needs: ["step_free", "companion"] },
      { type: "resultsLoaded", results },
      { type: "selectOption", optionId: "place-1" },
    ]);
    const payload = conciergeTaskProgressPayloadSchema.parse(careFinderProgressPayload(state));
    expect(payload.answers?.version).toBe(CARE_FINDER_PROGRESS_VERSION);
    expect(payload.providerSearchMode).toBe("specialist");
    expect(payload.criteria).toEqual(["nearby", "accessible", "coverage", "available-soon"]);
    const restored = careFinderStateFromProgress(payload);
    expect(restored).toMatchObject({
      step: "contact",
      who: "other",
      need: "pain",
      careType: "physiotherapy",
      careAccess: "private",
      accessNeeds: ["step_free", "companion"],
      selectedOptionId: "place-1",
    });
    expect(restored.results?.options[0].name).toBe("Fisioterapia Tarifa");
  });

  it("never resumes past an unanswered question", () => {
    const restored = careFinderStateFromProgress({
      canvasStep: "results",
      answers: { version: CARE_FINDER_PROGRESS_VERSION, who: "self", need: "pain" },
    });
    expect(restored.step).toBe("safety");
  });

  it("migrates legacy specialist tasks without reusing unreliable results", () => {
    const restored = careFinderStateFromProgress({
      providerSearchMode: "specialist",
      query: "dolor de rodilla al subir escaleras",
      criteria: ["nearby", "reputation", "accessible"],
      providerResult: { options: [{ name: "Residencia Las Flores" }] },
      shortlistIds: ["residencia-las-flores-1"],
    }, { updatedAt: "2026-09-30T09:00:00.000Z" });
    expect(restored).toMatchObject({
      step: "who",
      description: "dolor de rodilla al subir escaleras",
      results: null,
      suggestedAccessNeeds: ["step_free"],
      legacy: { foundAt: "2026-09-30T09:00:00.000Z", hadResults: true },
    });
  });

  it("drops the old generic placeholder query on legacy resume", () => {
    expect(careFinderStateFromProgress({ query: "find a specialist" }).description).toBe("");
    expect(careFinderStateFromProgress(null, { entryQuery: "buscar especialista" }).description).toBe("");
  });

  it("asks the next question when nothing is saved", () => {
    expect(nextCareFinderStep(initialCareFinderState())).toBe("who");
  });
});
