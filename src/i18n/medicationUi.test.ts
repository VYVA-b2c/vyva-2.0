import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import i18n, { setLanguage, translate } from "./index";
import { LANGUAGES } from "./languages";
import { medicationUi, medicationUiDictionary } from "./medicationUi";
import { serviceGateTranslations } from "./serviceGate";
import { sharedControls } from "./sharedControls";

function strings(value: object, prefix = ""): [string, string][] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string" ? [[path, child] as [string, string]] : strings(child, path);
  });
}

const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();

describe("complete shared UI translations", () => {
  it.each(LANGUAGES.map(({ code }) => code))("%s has native medication and service-gate copy, without English fallback", (language) => {
    const dictionary = { ...medicationUiDictionary(language), serviceGate: serviceGateTranslations[language], canonicalControls: sharedControls[language] };
    const english = Object.fromEntries(strings({ ...medicationUiDictionary("en"), serviceGate: serviceGateTranslations.en, canonicalControls: sharedControls.en }));
    for (const [key, value] of strings(dictionary)) {
      expect(i18n.getResource(language, "translation", key), key).toBe(value);
      expect(placeholders(value), key).toEqual(placeholders(english[key]));
      expect(value.trim(), key).not.toBe("");
    }
    if (language !== "en") expect(medicationUi[language].emptyTitle).not.toBe(medicationUi.en.emptyTitle);
  });

  it("keeps both translation APIs on the selected language", () => {
    for (const { code } of LANGUAGES) {
      setLanguage(code);
      expect(i18n.t("meds.dashboard.priorityEmptyTitle")).toBe(medicationUi[code].emptyTitle);
      expect(translate(code, "meds.dashboard.priorityEmptyTitle")).toBe(medicationUi[code].emptyTitle);
      expect(i18n.t("meds.hub.dosesLeft", { count: 2 })).not.toContain("{{");
    }
    setLanguage("en");
  });

  it("does not allow untranslated text back into the medication hub", () => {
    const source = ts.createSourceFile("MedsScreen.tsx", readFileSync("src/pages/MedsScreen.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const literals: string[] = [];
    let found = false;
    function inspect(node: ts.Node) {
      if (ts.isJsxText(node) && /[A-Za-z]/.test(node.text)) literals.push(node.text.trim());
      if (ts.isJsxAttribute(node) && ["aria-label", "title", "placeholder"].includes(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) literals.push(node.initializer.text);
      ts.forEachChild(node, inspect);
    }
    function visit(node: ts.Node) {
      if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some((property) => ts.isJsxAttribute(property) && property.name.getText(source) === "data-testid" && property.initializer && ts.isStringLiteral(property.initializer) && property.initializer.text === "meds-master-layout")) {
        found = true;
        inspect(node);
      } else ts.forEachChild(node, visit);
    }
    visit(source);
    expect(found).toBe(true);
    expect(literals).toEqual([]);
  });
});
