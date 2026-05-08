import { describe, expect, it } from "vitest";
import { translate } from "@/i18n";
import type { LanguageCode } from "@/i18n/languages";
import attentionBoostersSource from "../AttentionBoostersPage.tsx?raw";
import dualTaskSource from "../DualTaskWalk.jsx?raw";
import faceNameSource from "../FaceNameMatch.jsx?raw";
import languageGamesSource from "../LanguageGamesPage.tsx?raw";
import spatialNavigatorSource from "../SpatialNavigator.jsx?raw";

const languages: LanguageCode[] = ["es", "en", "fr", "de", "it", "pt"];
const requiredKeys = [
  "brainGames.attentionBoosters.title",
  "brainGames.attentionBoosters.dualTask.title",
  "brainGames.attentionBoosters.rhythmTap.description",
  "brainGames.language.title",
  "brainGames.language.storyRecall.ariaLabel",
  "brainGames.faceName.title",
  "brainGames.faceName.f2n",
  "brainGames.dualTask.loading",
  "brainGames.dualTask.mathAnswer",
  "brainGames.spatialNav.loading",
  "brainGames.spatialNav.readySoon",
];

describe("brain game shared infrastructure", () => {
  it("resolves brain game translations for every app language", () => {
    languages.forEach((language) => {
      requiredKeys.forEach((key) => {
        expect(translate(language, key)).not.toBe(key);
      });
    });
  });

  it("falls back to Spanish for missing language overrides", () => {
    expect(translate("cy", "brainGames.dualTask.title")).toBe(translate("es", "brainGames.dualTask.title"));
  });

  it("keeps current games off local copy dictionaries", () => {
    [attentionBoostersSource, dualTaskSource, faceNameSource, languageGamesSource, spatialNavigatorSource].forEach((source) => {
      expect(source).not.toContain("const COPY =");
      expect(source).not.toContain("const TEXT =");
      expect(source).not.toContain("COPY[");
      expect(source).not.toContain("copyFor(");
    });
  });
});
