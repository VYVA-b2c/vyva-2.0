import type { TriageEscalationSource, TriageUrgency } from "../types.js";

export type TriageTelemetryEventName =
  | "triage_started"
  | "triage_completed"
  | "triage_escalated"
  | "caregiver_escalation_triggered";

export type TriageCompletionStatus = "started" | "in_progress" | "completed" | "safety_alert";

export type TriageTelemetryPayload = {
  symptom_path?: string;
  urgency?: TriageUrgency;
  profile_modifiers_applied?: string[];
  vitals_overlays_applied?: string[];
  caregiver_escalation_triggered?: boolean;
  rule_ids_fired?: string[];
  triage_completion_status?: TriageCompletionStatus;
  escalation_source?: TriageEscalationSource;
  trigger_source?: TriageEscalationSource | "triage_report_handoff";
};

export type TriageTelemetryEvent = {
  name: TriageTelemetryEventName;
  payload: TriageTelemetryPayload;
  timestamp: string;
};

export type TriageTelemetrySink = (event: TriageTelemetryEvent) => void | Promise<void>;
