import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// @ts-expect-error The committed restoration script is intentionally plain ESM JavaScript.
import { AUTO_REPLACEMENTS, TRANSLATION_FILES, replaceStringValue } from "../../scripts/i18n/restore-diacritics.mjs";

type StringEntry = { key: string; value: string };

function propertyName(node: ts.PropertyName) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  return node.getText();
}

function typeScriptValues(filePath: string): StringEntry[] {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const entries: StringEntry[] = [];

  function visit(node: ts.Node, keyPath: string[]) {
    if (ts.isPropertyAssignment(node)) {
      const nextPath = [...keyPath, propertyName(node.name)];
      if (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer)) {
        entries.push({ key: nextPath.join("."), value: node.initializer.text });
        return;
      }
      ts.forEachChild(node.initializer, (child) => visit(child, nextPath));
      return;
    }
    ts.forEachChild(node, (child) => visit(child, keyPath));
  }

  visit(sourceFile, []);
  return entries;
}

function jsonValues(value: unknown, keyPath: string[] = []): StringEntry[] {
  if (typeof value === "string") return [{ key: keyPath.join("."), value }];
  if (Array.isArray(value)) return value.flatMap((item, index) => jsonValues(item, [...keyPath, String(index)]));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => jsonValues(item, [...keyPath, key]));
  }
  return [];
}

describe("translation diacritics guard", () => {
  it("contains none of the stripped forms from the automatic replacement map", () => {
    const violations: string[] = [];

    for (const [language, files] of Object.entries(TRANSLATION_FILES) as Array<[keyof typeof AUTO_REPLACEMENTS, string[]]>) {
      for (const relativePath of files) {
        const filePath = path.resolve(relativePath);
        const entries = relativePath.endsWith(".json")
          ? jsonValues(JSON.parse(fs.readFileSync(filePath, "utf8")))
          : typeScriptValues(filePath);

        const joinedValues = entries.map((entry) => entry.value).join("\uE100");
        if (replaceStringValue(joinedValues, AUTO_REPLACEMENTS[language]).count === 0) continue;

        for (const entry of entries) {
          if (replaceStringValue(entry.value, AUTO_REPLACEMENTS[language]).count === 0) continue;
          for (const [word, replacement] of Object.entries(AUTO_REPLACEMENTS[language]) as Array<[string, string]>) {
            if (replaceStringValue(entry.value, { [word]: replacement }).count > 0) violations.push(`${relativePath}: ${entry.key} contains ${word}`);
          }
        }
      }
    }

    expect(violations, violations.join("\n")).toEqual([]);
  });
});
