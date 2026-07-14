import { describe, expect, it } from "vitest";
import {
  buildOperatorConciergeQueueTotals,
  executionTaskFromPayload,
  filterOperatorConciergeQueueItems,
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
    expect(normalizeOperatorConciergeQueueStatus("calling")).toBe("in_progress");
    expect(normalizeOperatorConciergeQueueStatus("completed")).toBe("done");
    expect(normalizeOperatorConciergeQueueStatus("cancelled")).toBeNull();
    expect(normalizeOperatorConciergeQueueStatus("draft")).toBeNull();
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
      in_progress: 0,
      done: 1,
      failed: 0,
    });
    expect(filterOperatorConciergeQueueItems(items, "ready")).toEqual([baseItem]);
    expect(filterOperatorConciergeQueueItems(items, "all")).toHaveLength(3);
  });
});
