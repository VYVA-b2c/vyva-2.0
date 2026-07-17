import { describe, expect, it } from "vitest";
import {
  adapterIncidentFromPayload,
  buildOperatorConciergeAdapterTotals,
  buildOperatorConciergeQueueTotals,
  executionTaskFromPayload,
  filterOperatorConciergeQueueItems,
  isOperatorConciergeQueueAction,
  normalizeOperatorConciergeQueueStatus,
  type OperatorConciergeQueueItem,
} from "../shared/conciergeOperatorQueue";

const baseItem: OperatorConciergeQueueItem = {
  id: "task-1",
  source: "pending",
  user_id: "user-1",
  user_label: "Carmen",
  user_contact: null,
  use_case: "book_ride",
  provider_name: "Safe Taxi",
  provider_phone: null,
  action_summary: "Book a ride",
  status: "ready",
  pending_status: "pending",
  flow_reference: "FLOW_TRANSPORT_BOOKING",
  action_type: "phone_call",
  active_tool: "phone_call",
  missing_labels: [],
  user_confirmed: true,
  confirmed_at: "2026-07-01T10:00:00.000Z",
  updated_at: "2026-07-01T10:00:00.000Z",
};

describe("concierge operator queue helpers", () => {
  it("normalizes execution and legacy statuses into operator statuses", () => {
    expect(normalizeOperatorConciergeQueueStatus("needs_info")).toBe("needs_info");
    expect(normalizeOperatorConciergeQueueStatus("confirmed")).toBe("confirmed");
    expect(normalizeOperatorConciergeQueueStatus("calling")).toBe("in_progress");
    expect(normalizeOperatorConciergeQueueStatus("completed")).toBe("done");
    expect(normalizeOperatorConciergeQueueStatus("cancelled")).toBeNull();
    expect(normalizeOperatorConciergeQueueStatus("draft")).toBeNull();
  });

  it("recognizes supported operator queue actions", () => {
    expect(isOperatorConciergeQueueAction("assign")).toBe(true);
    expect(isOperatorConciergeQueueAction("done")).toBe(true);
    expect(isOperatorConciergeQueueAction("retry_adapter")).toBe(true);
    expect(isOperatorConciergeQueueAction("manual_follow_up")).toBe(true);
    expect(isOperatorConciergeQueueAction("delete")).toBe(false);
  });

  it("extracts execution tasks from payloads only when present", () => {
    expect(executionTaskFromPayload({ execution_task: { lifecycle_status: "ready" } })?.lifecycle_status).toBe("ready");
    expect(executionTaskFromPayload({})).toBeNull();
    expect(executionTaskFromPayload(null)).toBeNull();
  });

  it("builds totals and filters by status", () => {
    const items: OperatorConciergeQueueItem[] = [
      baseItem,
      { ...baseItem, id: "task-2", status: "needs_info", missing_labels: ["Destination"] },
      { ...baseItem, id: "task-3", status: "done", source: "session" },
    ];

    expect(buildOperatorConciergeQueueTotals(items)).toMatchObject({
      needs_info: 1,
      ready: 1,
      confirmed: 0,
      in_progress: 0,
      done: 1,
      failed: 0,
    });
    expect(filterOperatorConciergeQueueItems(items, "ready")).toEqual([baseItem]);
    expect(filterOperatorConciergeQueueItems(items, "all")).toHaveLength(3);
  });

  it("extracts adapter incidents and recovery history from execution payloads", () => {
    const incident = adapterIncidentFromPayload({
      execution_adapter: {
        version: 1,
        adapter: "concierge_email_adapter",
        mode: "live",
        channel: "email",
        tool: "email",
        status: "failed",
        attempted_at: "2026-07-01T10:01:00.000Z",
        provider_name: "Clinic",
        provider_contact: "frontdesk@example.com",
        external_action_allowed: true,
        result: "failed",
        error: "Adapter endpoint failed with 500.",
        response_status: 500,
      },
      execution_audit: [
        {
          version: 1,
          event: "adapter_execution_failed",
          at: "2026-07-01T10:01:01.000Z",
          source: "confirm_endpoint",
          adapter_result: {
            version: 1,
            adapter: "concierge_email_adapter",
            mode: "live",
            channel: "email",
            tool: "email",
            status: "failed",
            attempted_at: "2026-07-01T10:01:00.000Z",
            provider_name: "Clinic",
            provider_contact: "frontdesk@example.com",
            external_action_allowed: true,
            result: "failed",
            error: "Adapter endpoint failed with 500.",
            response_status: 500,
          },
        },
        {
          version: 1,
          event: "adapter_retry_requested",
          at: "2026-07-01T10:03:00.000Z",
          source: "operator_queue",
          execution_mode: "live",
          reason: "retry after endpoint restored",
        },
        {
          version: 1,
          event: "adapter_manual_follow_up_queued",
          at: "2026-07-01T10:05:00.000Z",
          source: "operator_queue",
          execution_mode: "manual_review",
          reason: "called clinic manually",
        },
      ],
    });

    expect(incident).toMatchObject({
      status: "failed",
      live: true,
      simulated: false,
      channel: "email",
      provider_contact: "frontdesk@example.com",
      error: "Adapter endpoint failed with 500.",
      manual_follow_up_queued_at: "2026-07-01T10:05:00.000Z",
    });
    expect(incident?.attempts.map((attempt) => attempt.event)).toEqual([
      "adapter_execution_failed",
      "adapter_retry_requested",
      "adapter_manual_follow_up_queued",
    ]);
  });

  it("counts adapter statuses separately from task statuses", () => {
    const items: OperatorConciergeQueueItem[] = [
      { ...baseItem, id: "task-sent", adapter_incident: { ...adapterIncidentFromPayload({
        execution_adapter: {
          version: 1,
          adapter: "concierge_phone_call_adapter",
          mode: "live",
          channel: "phone_call",
          tool: "phone_call",
          status: "sent",
          attempted_at: "2026-07-01T10:00:00.000Z",
          provider_name: "Taxi",
          provider_contact: "+12025550123",
          external_action_allowed: true,
          result: "outbound_call_started",
        },
      })! } },
      { ...baseItem, id: "task-blocked", adapter_incident: { ...adapterIncidentFromPayload({
        execution_adapter: {
          version: 1,
          adapter: "concierge_whatsapp_adapter",
          mode: "live",
          channel: "whatsapp",
          tool: "whatsapp",
          status: "blocked",
          attempted_at: "2026-07-01T10:05:00.000Z",
          provider_name: "Pharmacy",
          provider_contact: "+12025550124",
          external_action_allowed: false,
          result: "blocked",
          blocker: "whatsapp_not_verified",
        },
      })! } },
    ];

    expect(buildOperatorConciergeAdapterTotals(items)).toEqual({
      blocked: 1,
      failed: 0,
      sent: 1,
      simulated: 0,
    });
  });
});
