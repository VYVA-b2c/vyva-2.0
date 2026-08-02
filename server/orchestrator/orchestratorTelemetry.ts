import {
  orchestratorShellDecisionRecordSchema,
  type OrchestratorShellDecisionRecord,
} from "./orchestratorTypes.js";

export type OrchestratorTelemetrySink = (
  record: OrchestratorShellDecisionRecord,
) => void | Promise<void>;

const defaultOrchestratorTelemetrySink: OrchestratorTelemetrySink = () => {};
let orchestratorTelemetrySink = defaultOrchestratorTelemetrySink;

export function setOrchestratorTelemetrySink(
  sink: OrchestratorTelemetrySink,
): void {
  orchestratorTelemetrySink = sink;
}

export function resetOrchestratorTelemetrySink(): void {
  orchestratorTelemetrySink = defaultOrchestratorTelemetrySink;
}

export function emitOrchestratorTelemetry(
  record: OrchestratorShellDecisionRecord,
): void {
  let safeRecord: OrchestratorShellDecisionRecord;
  try {
    safeRecord = orchestratorShellDecisionRecordSchema.parse(record);
  } catch {
    return;
  }

  try {
    void Promise.resolve(orchestratorTelemetrySink(safeRecord)).catch(() => {});
  } catch {
    // Telemetry is deliberately non-authoritative and cannot affect delivery.
  }
}
