import { describe, expect, it } from "vitest";
import { getTogetherPlans, getTogetherRoomCopy } from "./togetherRoom";
import type { SocialGameLanguage } from "./types";

describe("togetherRoom copy", () => {
  it.each([
    { language: "fr", previewTitle: "La salle pour faire des choses ensemble", planLabel: "Partager un logement" },
    { language: "it", previewTitle: "La stanza per fare cose insieme", planLabel: "Condividere casa" },
    { language: "pt", previewTitle: "A sala para fazer coisas juntos", planLabel: "Partilhar casa" },
  ] satisfies Array<{ language: SocialGameLanguage; previewTitle: string; planLabel: string }>)(
    "localizes the Together Room preview for $language",
    ({ language, previewTitle, planLabel }) => {
      expect(getTogetherRoomCopy(language).previewTitle).toBe(previewTitle);
      expect(getTogetherPlans(language)[0].label).toBe(planLabel);
    },
  );
});
