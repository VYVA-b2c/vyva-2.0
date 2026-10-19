import { pool } from "../db.js";

export const EXPERT_CARE_METRICS = [
  "research_generated",
  "unsupported_claim_detected",
  "citation_coverage",
  "source_freshness",
  "emergency_handoff",
  "verification_failed",
  "sharing_consent",
  "consultation_ready",
  "specialist_response",
  "user_comprehension",
  "privacy_failure",
  "security_incident",
] as const;
export type ExpertCareMetric = typeof EXPERT_CARE_METRICS[number];
export type ExpertCareSafetySeverity = "info" | "warning" | "critical";

const AUTO_ROLLBACK_METRICS = new Set<ExpertCareMetric>(["unsupported_claim_detected", "privacy_failure", "security_incident"]);

export async function expertCareRuntimeControl() {
  try {
    const result = await pool.query<{ force_disabled: boolean; reason: string | null; incident_event_id: string | null; updated_at: Date | string }>(
      "select force_disabled, reason, incident_event_id, updated_at from expert_care_runtime_control where singleton = true limit 1",
    );
    const row = result.rows[0];
    return { forceDisabled: row?.force_disabled ?? false, reason: row?.reason ?? null, incidentEventId: row?.incident_event_id ?? null, updatedAt: row?.updated_at ?? null };
  } catch (error) {
    if (process.env.NODE_ENV === "production") return { forceDisabled: true, reason: "safety_control_unavailable", incidentEventId: null, updatedAt: null };
    const code = (error as { code?: string }).code;
    if (code !== "42P01" && code !== "ECONNREFUSED") console.warn("[expert-care/safety] runtime control unavailable", error);
    return { forceDisabled: false, reason: null, incidentEventId: null, updatedAt: null };
  }
}

export async function recordExpertCareSafetyEvent(input: {
  metric: ExpertCareMetric;
  severity?: ExpertCareSafetySeverity;
  caseId?: string | null;
  userId?: string | null;
  value?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const severity = input.severity ?? "info";
  const client = await pool.connect();
  try {
    await client.query("begin");
    const inserted = await client.query<{ id: string }>(
      `insert into expert_care_safety_events (case_id, user_id, metric_name, severity, value, metadata)
       values ($1::uuid, $2, $3, $4, $5, $6::jsonb) returning id`,
      [input.caseId ?? null, input.userId ?? null, input.metric, severity, input.value ?? null, JSON.stringify(input.metadata ?? {})],
    );
    const eventId = inserted.rows[0]!.id;
    const rollback = severity === "critical" && AUTO_ROLLBACK_METRICS.has(input.metric);
    if (rollback) {
      await client.query(
        `update expert_care_runtime_control
           set force_disabled = true, reason = $2, incident_event_id = $1::uuid, updated_by = 'automatic_safety_circuit', updated_at = now()
         where singleton = true`,
        [eventId, input.metric],
      );
    }
    await client.query("commit");
    return { eventId, rollbackTriggered: rollback };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function clearExpertCareSafetyRollback(input: { adminUserId: string; reason: string }) {
  const result = await pool.query(
    `update expert_care_runtime_control
       set force_disabled = false, reason = $1, incident_event_id = null, updated_by = $2, updated_at = now()
     where singleton = true and force_disabled = true
     returning force_disabled, reason, updated_at`,
    [`reviewed_reenable:${input.reason}`, input.adminUserId],
  );
  return result.rows[0] ?? null;
}

export async function expertCareMetricSummary(sinceHours = 168) {
  const result = await pool.query<{ metric_name: ExpertCareMetric; severity: ExpertCareSafetySeverity; event_count: string; average_value: string | null; latest_at: Date | string }>(
    `select metric_name, severity, count(*)::text as event_count, avg(value)::text as average_value, max(created_at) as latest_at
       from expert_care_safety_events
      where created_at >= now() - ($1::text || ' hours')::interval
      group by metric_name, severity order by metric_name, severity`,
    [Math.max(1, Math.min(24 * 365, Math.round(sinceHours)))],
  );
  return result.rows.map((row) => ({ metric: row.metric_name, severity: row.severity, count: Number(row.event_count), averageValue: row.average_value === null ? null : Number(row.average_value), latestAt: row.latest_at }));
}
