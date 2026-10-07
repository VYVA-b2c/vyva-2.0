import { describe, expect, it } from "vitest";
import i18n from "./index";
import { LANGUAGES } from "./languages";
import knownMissing from "./knownMissingTranslations.json";

function keys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string" ? [path] : keys(child, path);
  });
}

describe("application-wide translation coverage", () => {
  const english = keys(i18n.getResourceBundle("en", "translation"));
  for (const { code } of LANGUAGES) {
    if (code === "en") continue;
    it(`${code} introduces no new English fallbacks`, () => {
      // This is an explicit backlog, not translated copy. Fix entries rather than
      // expanding it when a new string is added to the app.
      const backlog = new Set(knownMissing[code]);
      const localized = new Set(keys(i18n.getResourceBundle(code, "translation")));
      expect(english.filter((key) => !localized.has(key) && !backlog.has(key))).toEqual([]);
    });
  }
});
