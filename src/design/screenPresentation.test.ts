import { describe, expect, it } from "vitest";
import {
  PREVENTIVE_CHECK_PRESENTATION_SCENES,
  PREVENTIVE_CHECK_STAGE_IDS,
  SYMPTOM_ASSESSMENT_PRESENTATION_SCENES,
  SYMPTOM_ASSESSMENT_STAGE_IDS,
  getScreenPresentation,
  resolvePreventiveCheckPresentation,
  resolveSymptomAssessmentPresentation,
  shouldShowHeadingDetail,
} from "./screenPresentation";
import fr from "../i18n/fr";

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value as Record<string, unknown>).flatMap(collectStrings);
}

describe("screen presentation", () => {
  it("preserves all 11 ordered preventive-check stages in Voice and Touch", () => {
    expect(PREVENTIVE_CHECK_STAGE_IDS).toEqual([
      "welcome", "energy", "mood", "body", "sleep", "symptoms", "details", "safety", "social", "analyzing", "result",
    ]);
    expect(Object.keys(PREVENTIVE_CHECK_PRESENTATION_SCENES)).toEqual(PREVENTIVE_CHECK_STAGE_IDS);

    const voiceIds = new Set<string>();
    const touchIds = new Set<string>();
    for (const stageId of PREVENTIVE_CHECK_STAGE_IDS) {
      const scenes = resolvePreventiveCheckPresentation(stageId);
      expect(scenes).toEqual({
        voiceSceneId: `health.preventive_check.${stageId}`,
        touchSceneId: `check-how-i-feel.${stageId}`,
      });
      voiceIds.add(scenes.voiceSceneId);
      touchIds.add(scenes.touchSceneId);
    }
    expect(voiceIds.size).toBe(11);
    expect(touchIds.size).toBe(11);
  });

  it("maps the 11 symptom-assessment stages to registry, Voice, and Touch identities", () => {
    expect(SYMPTOM_ASSESSMENT_STAGE_IDS).toEqual([
      "describe", "safety_check", "urgent_escalation", "symptom_selection", "severity", "onset",
      "related_details", "review", "checking", "safest_next_step", "save_share_summary",
    ]);
    expect(Object.keys(SYMPTOM_ASSESSMENT_PRESENTATION_SCENES)).toEqual(SYMPTOM_ASSESSMENT_STAGE_IDS);
    for (const stageId of SYMPTOM_ASSESSMENT_STAGE_IDS) {
      const scenes = resolveSymptomAssessmentPresentation(stageId);
      expect(scenes.voiceSceneId).toBe(`health.symptom_assessment.${stageId}.voice`);
      expect(scenes.touchSceneId).toBe(`health.symptom_assessment.${stageId}.touch`);
      expect(scenes.voiceSceneId).not.toBe(scenes.touchSceneId);
      expect(scenes.registrySceneId).toMatch(/^health\.symptom_assessment\.(describe|safety|details|review|guidance)$/);
    }
  });

  it("keeps Home voice mode orb-first with cards and chips hidden", () => {
    const presentation = getScreenPresentation({ screenId: "home", mode: "voice" });

    expect(presentation.primarySurface).toBe("orb");
    expect(presentation.cards).toBe("hidden");
    expect(presentation.chips).toBe("hidden");
    expect(presentation.showHeadingDetail).toBe(true);
    expect(presentation.dataAttributes).toMatchObject({
      "data-screen-contract": "home",
      "data-screen-mode": "voice",
      "data-primary-surface": "orb",
      "data-cards": "hidden",
      "data-chips": "hidden",
      "data-heading-detail": "visible",
    });
  });

  it("makes Home touch mode the card surface without loose heading detail", () => {
    const presentation = getScreenPresentation({ screenId: "home", mode: "touch" });

    expect(presentation.primarySurface).toBe("cards");
    expect(presentation.cards).toBe("visible");
    expect(presentation.chips).toBe("hidden");
    expect(presentation.showHeadingDetail).toBe(false);
    expect(presentation.dataAttributes).toMatchObject({
      "data-screen-contract": "home",
      "data-screen-mode": "touch",
      "data-primary-surface": "cards",
      "data-cards": "visible",
      "data-chips": "hidden",
      "data-heading-detail": "hidden",
    });
  });

  it("keeps Health as a clean card hub with no loose heading detail", () => {
    const presentation = getScreenPresentation({ screenId: "health" });

    expect(presentation.template).toBe("cardHub");
    expect(presentation.primarySurface).toBe("cards");
    expect(presentation.cards).toBe("visible");
    expect(presentation.chips).toBe("hidden");
    expect(presentation.showHeadingDetail).toBe(false);
    expect(presentation.dataAttributes).toMatchObject({
      "data-screen-contract": "health",
      "data-template": "cardHub",
      "data-primary-surface": "cards",
      "data-cards": "visible",
      "data-chips": "hidden",
      "data-heading-detail": "hidden",
      "data-bottom-nav-clearance": "112",
    });
  });

  it("hides heading detail when a screen has cards or structured output", () => {
    expect(shouldShowHeadingDetail("cards", "visible")).toBe(false);
    expect(shouldShowHeadingDetail("dashboard", "visible")).toBe(false);
    expect(shouldShowHeadingDetail("answer", "contextual")).toBe(false);
  });

  it("carries bottom navigation clearance for fixed nav screens", () => {
    const presentation = getScreenPresentation({ screenId: "concierge" });

    expect(presentation.bottomNavClearancePx).toBeGreaterThanOrEqual(112);
    expect(presentation.bottomNavClearanceClassName).toBe("pb-[112px]");
    expect(presentation.dataAttributes["data-bottom-nav-clearance"]).toBe("112");
  });

  it("keeps French Home voice copy short and free of orb typos", () => {
    const frenchCopy = collectStrings(fr).join("\n");

    expect(frenchCopy).not.toContain("le l'orbe");
    expect(fr.home.master.touchOrbToBegin).toBe("Touchez l'orbe pour commencer.");
    expect(fr.home.master.conciergeIntent.voiceSubtitle).toBe("Touchez l'orbe pour commencer.");
    expect(fr.home.master.conciergeIntent.moreCompact).toBe("Autres");
  });
});
