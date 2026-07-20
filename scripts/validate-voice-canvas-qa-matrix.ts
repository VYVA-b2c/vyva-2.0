import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CANVAS_REAL_DEVICE_QA_PENDING_STATUS,
  evaluateCanvasRealDeviceQaMatrix,
} from "../src/components/voice-canvas/canvasLaunchSignoff";

const defaultMatrixPath = "docs/audits/voice-canvas-real-device-qa-matrix.md";
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    [
      "Validate the Voice Canvas real-device QA sign-off matrix.",
      "",
      "Usage:",
      "  npm run canvas:qa:validate",
      "  npm run canvas:qa:validate -- --allow-pending",
      "  npm run canvas:qa:validate -- docs/audits/voice-canvas-real-device-qa-matrix.md",
      "",
      "The command exits non-zero unless the matrix is ready for launch.",
      "Use --allow-pending for in-progress review of the committed pending matrix.",
    ].join("\n"),
  );
  process.exit(0);
}

const allowPending = args.includes("--allow-pending");
const matrixArg = args.find((arg) => !arg.startsWith("-"));
const matrixPath = path.resolve(process.cwd(), matrixArg ?? defaultMatrixPath);
const matrix = readFileSync(matrixPath, "utf8");
const result = evaluateCanvasRealDeviceQaMatrix(matrix);
const relativeMatrixPath = path.relative(process.cwd(), matrixPath);

console.log(`Canvas QA matrix: ${relativeMatrixPath}`);
console.log(`Status: ${result.status ?? "missing"}`);
console.log(`State: ${result.state}`);
console.log(`Ready for launch: ${result.readyForLaunch ? "yes" : "no"}`);
console.log(`Incomplete cells: ${result.incompleteCellCount}`);
console.log(`Failing/not-ready cells: ${result.failingCellCount}`);

if (result.readyForLaunch) {
  console.log("Matrix is ready for launch.");
  process.exit(0);
}

if (
  allowPending &&
  result.status === CANVAS_REAL_DEVICE_QA_PENDING_STATUS &&
  result.problems.length === 0
) {
  console.log("Matrix is still pending execution, but its structure is valid.");
  process.exit(0);
}

if (result.problems.length > 0) {
  console.error("Matrix is not ready for launch:");
  for (const problem of result.problems) {
    console.error(`- ${problem}`);
  }
} else if (result.status === CANVAS_REAL_DEVICE_QA_PENDING_STATUS) {
  console.error(
    "Matrix is still pending execution. Fill every row, attach sanitized evidence, and change Status to ready for launch.",
  );
} else {
  console.error("Matrix is not ready for launch.");
}

process.exit(1);
