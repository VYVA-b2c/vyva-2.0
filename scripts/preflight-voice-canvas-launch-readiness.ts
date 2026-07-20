import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const finalGate = args.includes("--final");
const forceOutput = args.includes("--force");
const outputArg = args.find((arg) => arg.startsWith("--output="));
const outputPathArg = outputArg?.slice("--output=".length).trim();
const matrixPathArg = args
  .find((arg) => arg.startsWith("--matrix="))
  ?.slice("--matrix=".length)
  .trim();
const packetPathArg = args
  .find((arg) => arg.startsWith("--packet="))
  ?.slice("--packet=".length)
  .trim();
const analyticsArg = args.find((arg) => arg.startsWith("--analytics="));
const analyticsPathArg = args
  .find((arg) => arg.startsWith("--analytics="))
  ?.slice("--analytics=".length)
  .trim();

const tsxCliPath = path.resolve(
  process.cwd(),
  "node_modules",
  "tsx",
  "dist",
  "cli.mjs",
);
const matrixValidatorPath = path.resolve(
  process.cwd(),
  "scripts",
  "validate-voice-canvas-qa-matrix.ts",
);
const packetValidatorPath = path.resolve(
  process.cwd(),
  "scripts",
  "validate-voice-canvas-evidence-packet.ts",
);
const analyticsValidatorPath = path.resolve(
  process.cwd(),
  "scripts",
  "validate-voice-canvas-analytics-evidence.ts",
);

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    [
      "Preflight the Voice Canvas launch-readiness evidence gates.",
      "",
      "Usage:",
      "  npm run canvas:qa:preflight",
      "  npm run canvas:qa:preflight -- --final",
      "  npm run --silent canvas:qa:preflight -- --json",
      "  npm run --silent canvas:qa:preflight -- --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-preflight.json",
      "  npm run canvas:qa:preflight -- --analytics=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json",
      "  npm run canvas:qa:preflight -- --matrix=docs/audits/voice-canvas-real-device-qa-matrix.md --packet=docs/audits/voice-canvas-real-device-evidence-packet.md",
      "",
      "Default mode accepts a structurally valid pending matrix and packet so QA can capture an in-progress launch artifact.",
      "Pass --analytics=<path> to validate sanitized analytics evidence in the same aggregate-only snapshot.",
      "Use --final after real-device evidence is filled; it exits non-zero unless both gates are ready and analytics evidence is supplied.",
      "Use --json to emit a machine-readable summary for QA artifacts or CI.",
      "Use --output=<path> with --json to also save the summary to a file.",
      "Existing output files are preserved by default; pass --force only when intentionally replacing one.",
      "This preflight is read-only and never calls feature endpoints, analytics, bookings, calls, messages, navigation, or data writes.",
    ].join("\n"),
  );
  process.exit(0);
}

if (outputArg && !outputPathArg) {
  console.error("Expected --output=<path>.");
  process.exit(1);
}
if (analyticsArg && !analyticsPathArg) {
  console.error("Expected --analytics=<path>.");
  process.exit(1);
}
if (outputPathArg && !jsonOutput) {
  console.error("Use --output only with --json.");
  process.exit(1);
}

interface ValidatorRun {
  status: number | null;
  stdout: string;
  stderr: string;
  summary: Record<string, unknown> | null;
}

function runValidator(
  scriptPath: string,
  artifactPath: string | undefined,
  options: { allowPending: boolean },
): ValidatorRun {
  const validatorArgs = [
    tsxCliPath,
    scriptPath,
    ...(artifactPath ? [artifactPath] : []),
    ...(options.allowPending ? ["--allow-pending"] : []),
    "--json",
  ];
  const result = spawnSync(process.execPath, validatorArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  let summary: Record<string, unknown> | null = null;
  try {
    summary = JSON.parse(result.stdout) as Record<string, unknown>;
  } catch {
    summary = null;
  }

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    summary,
  };
}

function numericField(
  summary: Record<string, unknown> | null,
  field: string,
): number {
  const value = summary?.[field];
  return typeof value === "number" ? value : 0;
}

function booleanField(
  summary: Record<string, unknown> | null,
  field: string,
): boolean {
  return summary?.[field] === true;
}

function stringField(
  summary: Record<string, unknown> | null,
  field: string,
): string {
  const value = summary?.[field];
  return typeof value === "string" ? value : "unknown";
}

function messagesForNextAction(
  matrixRun: ValidatorRun,
  packetRun: ValidatorRun,
  analyticsRun: ValidatorRun | null,
): string[] {
  const messages: string[] = [];
  const matrixProblems = numericField(matrixRun.summary, "problemCount");
  const packetProblems = numericField(packetRun.summary, "problemCount");
  const analyticsProblems = numericField(analyticsRun?.summary ?? null, "problemCount");
  const matrixFailing = numericField(matrixRun.summary, "failingCellCount");
  const matrixIncomplete = numericField(matrixRun.summary, "incompleteCellCount");
  const packetIncomplete = numericField(packetRun.summary, "incompleteCellCount");

  if (!matrixRun.summary) {
    messages.push("Fix the QA matrix validator output before using the preflight artifact.");
  }
  if (!packetRun.summary) {
    messages.push("Fix the evidence packet validator output before using the preflight artifact.");
  }
  if (matrixProblems > 0 || matrixFailing > 0) {
    messages.push("Fix QA matrix structural or failing/not-ready rows before real-user rollout.");
  }
  if (packetProblems > 0) {
    messages.push("Fix evidence packet structural or privacy-safety rows before copying evidence into the matrix.");
  }
  if (analyticsRun && !analyticsRun.summary) {
    messages.push("Fix the analytics validator output before using the preflight artifact.");
  }
  if (analyticsProblems > 0) {
    messages.push("Fix sanitized analytics evidence before launch sign-off.");
  }
  if (finalGate && !analyticsRun) {
    messages.push("Provide --analytics=<path> for the sanitized analytics evidence artifact before final launch sign-off.");
  }
  if (packetIncomplete > 0) {
    messages.push("Fill the sanitized evidence packet artifact references and reviewer/date cells.");
  }
  if (matrixIncomplete > 0) {
    messages.push("Execute real-device and deployed rollback QA, then fill the QA matrix.");
  }
  if (messages.length === 0) {
    messages.push("Run final launch sign-off and keep rollback owners ready before enabling wider rollout.");
  }

  return messages;
}

const matrixRun = runValidator(matrixValidatorPath, matrixPathArg, {
  allowPending: !finalGate,
});
const packetRun = runValidator(packetValidatorPath, packetPathArg, {
  allowPending: !finalGate,
});
const analyticsRun = analyticsPathArg
  ? runValidator(analyticsValidatorPath, `--input=${analyticsPathArg}`, {
      allowPending: false,
    })
  : null;
const readyForLaunch =
  booleanField(matrixRun.summary, "readyForLaunch") &&
  booleanField(packetRun.summary, "readyForLaunchEvidencePacket") &&
  booleanField(analyticsRun?.summary ?? null, "readyForLaunchEvidence");
const structuralProblems =
  !matrixRun.summary ||
  !packetRun.summary ||
  (analyticsRun !== null && !analyticsRun.summary) ||
  numericField(matrixRun.summary, "problemCount") > 0 ||
  numericField(matrixRun.summary, "failingCellCount") > 0 ||
  numericField(packetRun.summary, "problemCount") > 0 ||
  numericField(analyticsRun?.summary ?? null, "problemCount") > 0;
const acceptedPending =
  !finalGate &&
  !structuralProblems &&
  matrixRun.status === 0 &&
  packetRun.status === 0 &&
  !readyForLaunch;
const exitCode = readyForLaunch || acceptedPending ? 0 : 1;
const nextActions = messagesForNextAction(matrixRun, packetRun, analyticsRun);

const summary = {
  readyForLaunch,
  finalGate,
  acceptedPending,
  matrix: {
    path: stringField(matrixRun.summary, "matrixPath"),
    status: stringField(matrixRun.summary, "status"),
    state: stringField(matrixRun.summary, "state"),
    readyForLaunch: booleanField(matrixRun.summary, "readyForLaunch"),
    incompleteCellCount: numericField(matrixRun.summary, "incompleteCellCount"),
    failingCellCount: numericField(matrixRun.summary, "failingCellCount"),
    problemCount: numericField(matrixRun.summary, "problemCount"),
    pendingSections: matrixRun.summary?.pendingSections ?? [],
    message: stringField(matrixRun.summary, "message"),
  },
  evidencePacket: {
    path: stringField(packetRun.summary, "packetPath"),
    state: stringField(packetRun.summary, "state"),
    readyForLaunchEvidencePacket: booleanField(
      packetRun.summary,
      "readyForLaunchEvidencePacket",
    ),
    incompleteCellCount: numericField(packetRun.summary, "incompleteCellCount"),
    problemCount: numericField(packetRun.summary, "problemCount"),
    pendingSections: packetRun.summary?.pendingSections ?? [],
    message: stringField(packetRun.summary, "message"),
  },
  analyticsEvidence: {
    provided: Boolean(analyticsPathArg),
    path: stringField(analyticsRun?.summary ?? null, "inputPath"),
    readyForLaunchEvidence: booleanField(
      analyticsRun?.summary ?? null,
      "readyForLaunchEvidence",
    ),
    sampleCount: numericField(analyticsRun?.summary ?? null, "sampleCount"),
    problemCount: numericField(analyticsRun?.summary ?? null, "problemCount"),
    sampleLaunchSignalCounts:
      analyticsRun?.summary?.sampleLaunchSignalCounts ?? null,
  },
  nextActions,
  message: readyForLaunch
    ? "Voice Canvas launch evidence gates are ready."
    : acceptedPending
      ? "Voice Canvas launch evidence gates are structurally valid but still pending real-device QA."
      : "Voice Canvas launch evidence gates are not ready.",
};

if (jsonOutput) {
  const jsonSummary = JSON.stringify(summary, null, 2);
  if (outputPathArg) {
    const outputPath = path.resolve(process.cwd(), outputPathArg);
    if (existsSync(outputPath) && !forceOutput) {
      console.error(
        `Output file already exists. Use a run-specific path or pass --force to overwrite: ${path.relative(process.cwd(), outputPath)}`,
      );
      process.exit(1);
    }
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${jsonSummary}\n`);
  }
  console.log(jsonSummary);
  process.exit(exitCode);
}

console.log("Voice Canvas launch QA preflight");
console.log(`Final gate mode: ${finalGate ? "yes" : "no"}`);
console.log(`Ready for launch: ${readyForLaunch ? "yes" : "no"}`);
console.log(
  `QA matrix: ${summary.matrix.state}; incomplete ${summary.matrix.incompleteCellCount}; failing/not-ready ${summary.matrix.failingCellCount}; problems ${summary.matrix.problemCount}`,
);
console.log(
  `Evidence packet: ${summary.evidencePacket.state}; incomplete ${summary.evidencePacket.incompleteCellCount}; problems ${summary.evidencePacket.problemCount}`,
);
console.log(
  `Analytics evidence: ${summary.analyticsEvidence.provided ? (summary.analyticsEvidence.readyForLaunchEvidence ? "ready" : "not ready") : "not provided"}; samples ${summary.analyticsEvidence.sampleCount}; problems ${summary.analyticsEvidence.problemCount}`,
);
console.log("Next action:");
for (const action of nextActions) {
  console.log(`- ${action}`);
}
console.log(summary.message);

process.exit(exitCode);
