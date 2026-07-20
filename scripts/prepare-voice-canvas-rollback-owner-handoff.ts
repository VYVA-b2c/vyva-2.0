import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canvasLaunchReadinessFlows } from "../src/components/voice-canvas/canvasLaunchReadiness";

const args = process.argv.slice(2);
const artifactDatePlaceholder = "YYYY-MM-DD";
const artifactPathPlaceholder = `artifacts/voice-canvas/${artifactDatePlaceholder}-rollback-owner-handoff.md`;

function readArgValue(name: string): string | undefined {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim();
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    [
      "Prepare a copy-safe Voice Canvas rollback owner handoff artifact template.",
      "",
      "Usage:",
      "  npm run --silent canvas:qa:rollback-owner -- --template",
      `  npm run --silent canvas:qa:rollback-owner -- --template --output=${artifactPathPlaceholder}`,
      "",
      "Use --template to print the handoff artifact shape for Operations/rollback owner sign-off.",
      "The template is intentionally not launch approval until a real rollback owner, backup owner, decision window, rollback trigger, rollback action, endpoint/fallback/open-session evidence, privacy boundary, and fallback readiness are filled from the launch run.",
      "The generated template includes only feature names, endpoints, server keys, and named fallback paths from the launch manifest.",
      "Do not add addresses, saved-place labels, spoken transcripts, entered text, medication details, provider details, shopping details, account identifiers, contact details, or personal data.",
      "Use --output=<path> with --template to save the Markdown artifact.",
      "Existing output files are preserved by default; pass --force only when intentionally replacing one.",
      "This helper never calls feature endpoints, analytics, bookings, calls, messages, navigation, or application data writes.",
    ].join("\n"),
  );
  process.exit(0);
}

const templateOutput = args.includes("--template");
const forceOutput = args.includes("--force");
const outputPathArg = readArgValue("--output");

if (!templateOutput) {
  console.error("Expected --template.");
  process.exit(1);
}

if (outputPathArg === "") {
  console.error("Expected --output=<path>.");
  process.exit(1);
}

function rollbackOwnerHandoffTemplate(): string {
  const lines = [
    "# Voice Canvas rollback owner handoff artifact",
    "",
    "Use this copy-safe artifact for final Operations/rollback owner sign-off. Replace bracketed placeholders only after the deployed launch run is reviewed.",
    "",
    "Do not paste addresses, saved-place labels, spoken transcripts, entered text, medication details, provider details, shopping details, account identifiers, contact details, screenshots with personal data, raw endpoint bodies, unexpected payload field names, or personal data.",
    "",
    `Reviewed on: [${artifactDatePlaceholder}]`,
    "Reviewer: [reviewer]",
    "Operations/rollback owner: [owner name or team handle]",
    "Backup owner: [backup owner name or team handle]",
    "Decision window: [start/end time or launch-monitoring window]",
    "Rollback trigger: [clear trigger for disabling Canvas]",
    "Rollback action: [enable false or disabled rollout 0 action]",
    "Privacy boundary: [sanitized artifact references only; no personal details]",
    "Fallback readiness: [existing Concierge fallback verified and ready]",
    "",
    "## Required sanitized evidence",
    "",
    "- Enabled endpoint artifact: [sanitized enabled endpoint artifact reference]",
    "- Rollback-disabled endpoint artifact: [sanitized rollback endpoint artifact reference]",
    "- Fallback visibility artifact: [sanitized fallback screenshot/log/artifact reference]",
    "- Open-session Canvas closed or hidden artifact: [sanitized open-session rollback artifact reference]",
    "- No-write/no-resubmission/no-external-action evidence: [sanitized artifact reference]",
    "",
    "## Launch manifest coverage",
  ];

  for (const flow of canvasLaunchReadinessFlows.filter((candidate) => candidate.featureFlag)) {
    lines.push(
      "",
      `### ${flow.label}`,
      "",
      `- Endpoint: ${flow.featureFlag!.endpoint}`,
      `- Server key: ${flow.featureFlag!.serverFeatureKey}`,
      `- Named fallback path: ${flow.featureFlag!.fallback}`,
      "- Handoff confirmation: [owner and backup can disable this flag, verify rollback-disabled endpoint payload, confirm Canvas closed or hidden in an open session, and confirm the named fallback path is visible]",
    );
  }

  lines.push(
    "",
    "## Copy-ready final sign-off note",
    "",
    `Operations/rollback owner sign-off, reviewed on [${artifactDatePlaceholder}] by [reviewer]: rollback owner [owner] and backup owner [backup] confirmed the decision window [window], rollback trigger [trigger], enable false or disabled rollout 0 rollback action [action], sanitized endpoint/fallback/open-session evidence [references], Canvas closed or hidden behavior, privacy boundary, and fallback readiness before launch.`,
  );

  return lines.join("\n");
}

const output = `${rollbackOwnerHandoffTemplate()}\n`;

if (outputPathArg) {
  const outputPath = path.resolve(process.cwd(), outputPathArg);
  if (existsSync(outputPath) && !forceOutput) {
    console.error(
      `Output file already exists. Use a run-specific path or pass --force to overwrite: ${path.relative(process.cwd(), outputPath)}`,
    );
    process.exit(1);
  }

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, output);
  console.log(`Saved rollback owner handoff template to ${path.relative(process.cwd(), outputPath)}`);
  process.exit(0);
}

console.log(output);
