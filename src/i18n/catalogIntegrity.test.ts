import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const supportedLanguages = ["en", "es", "de", "fr", "it", "pt"] as const;

function loadCatalog(language: (typeof supportedLanguages)[number]) {
  return JSON.parse(
    readFileSync(`src/i18n/locales/${language}.json`, "utf8"),
  ) as Record<string, unknown>;
}

function loadOverrideSource(language: (typeof supportedLanguages)[number]) {
  return readFileSync(`src/i18n/${language}.ts`, "utf8");
}

const corruptTextPattern =
  /\uFFFD|\u00C3.|\u00C2.|\u00E2(?:\u20AC|\u2122)|\u00EF\u00BF\u00BD|\u00F0\u0178|\p{L}\?\p{L}|\?{2,}/u;

function collectStrings(value: unknown, path: string[] = []): Array<[string, string]> {
  if (typeof value === "string") {
    return [[path.join("."), value]];
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    collectStrings(child, [...path, key]),
  );
}

function atPath(catalog: Record<string, unknown>, path: string): string {
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, catalog);

  expect(typeof value, `Missing translation: ${path}`).toBe("string");
  return value as string;
}

describe("translation catalog integrity", () => {
  it.each(supportedLanguages)("%s contains no encoding corruption", (language) => {
    const corrupt = collectStrings(loadCatalog(language)).filter(([, value]) =>
      corruptTextPattern.test(value),
    );

    expect(corrupt).toEqual([]);
  });

  it.each(supportedLanguages)(
    "%s TypeScript overrides contain no encoding corruption",
    (language) => {
      expect(loadOverrideSource(language)).not.toMatch(corruptTextPattern);
    },
  );

  it("keeps medication confirmation copy readable in every language", () => {
    const expected = {
      en: ["Good job", "{{medicine}} was taken."],
      es: ["Buen trabajo", "{{medicine}} fue marcado como tomado."],
      de: ["Gut gemacht", "{{medicine}} wurde als eingenommen markiert."],
      fr: ["Bien jou\u00E9", "{{medicine}} a \u00E9t\u00E9 marqu\u00E9 comme pris."],
      it: ["Ottimo lavoro", "{{medicine}} \u00E8 stato segnato come assunto."],
      pt: ["Bom trabalho", "{{medicine}} foi marcado como tomado."],
    } as const;

    for (const language of supportedLanguages) {
      const catalog = loadCatalog(language);
      expect(atPath(catalog, "meds.takenToastTitle")).toBe(expected[language][0]);
      expect(atPath(catalog, "meds.takenToastDescription")).toBe(
        expected[language][1],
      );
    }
  });
});
