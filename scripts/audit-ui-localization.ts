import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import i18n from "../src/i18n/index";
import { LANGUAGES } from "../src/i18n/languages";

function flatten(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string" ? [path] : flatten(child, path);
  });
}

const englishKeys = flatten(i18n.getResourceBundle("en", "translation"));
const missing = Object.fromEntries(LANGUAGES.filter(({ code }) => code !== "en").map(({ code }) => {
  const keys = new Set(flatten(i18n.getResourceBundle(code, "translation")));
  return [code, englishKeys.filter((key) => !keys.has(key))];
}));

const literals: { file: string; line: number; text: string }[] = [];
function scan(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!["dev", "test", "i18n", "__tests__"].includes(entry.name)) scan(file);
      continue;
    }
    if (!file.endsWith(".tsx") || /\.(test|spec)\.tsx$/.test(file)) continue;
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      let text = "";
      if (ts.isJsxText(node)) text = node.text.trim();
      if (ts.isJsxAttribute(node) && ["aria-label", "placeholder", "title"].includes(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) text = node.initializer.text;
      if (/[A-Za-z]{2,}/.test(text) && text !== "VYVA") literals.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, text });
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
scan("src");
const report = { missing, hardcodedTextCandidates: literals };
if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
else {
  console.log("Missing catalogue keys (before English fallback):");
  for (const [language, keys] of Object.entries(missing)) console.log(`${language}: ${keys.length}`);
  console.log(`Hard-coded UI text candidates: ${literals.length}`);
  console.log("Use --json for file/line details. Candidates require review; names and user content must not be translated blindly.");
}
if (process.argv.includes("--strict") && (Object.values(missing).some((keys) => keys.length) || literals.length)) process.exitCode = 1;
