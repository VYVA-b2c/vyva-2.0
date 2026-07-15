import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
  },
  pool: {
    query: vi.fn(),
  },
}));

vi.mock("../db.js", () => dbMock);

import { startPendingConciergeAction } from "./conciergeActions.js";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

function mockProfile() {
  dbMock.db.select.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => [{
          id: "user-1",
          full_name: "Carmen Rivera",
          preferred_name: "Carmen",
          date_of_birth: null,
          language: "en",
          language_preference: "en",
        }],
      }),
    }),
  });
}

function mockPendingRow(row: Record<string, unknown>) {
  dbMock.pool.query.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (sql.includes("from concierge_pending")) {
      return { rows: [row] };
    }
    if (sql.includes("update concierge_pending")) {
      return { rows: [], rowCount: 1, params };
    }
    return { rows: [] };
  });
}

function lastUpdatedPayload() {
  const updateCall = dbMock.pool.query.mock.calls.find(([sql]) => String(sql).includes("update concierge_pending"));
  expect(updateCall).toBeTruthy();
  const rawPayload = updateCall?.[1]?.[2];
  expect(typeof rawPayload).toBe("string");
  return JSON.parse(rawPayload as string) as Record<string, unknown>;
}

describe("confirmed Concierge action execution", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_CONCIERGE_CALLER_AGENT_ID;
    delete process.env.ELEVENLABS_CONCIERGE_OUTBOUND_AGENT_ID;
    delete process.env.ELEVENLABS_OUTBOUND_AGENT_ID;
    delete process.env.ELEVENLABS_CONCIERGE_PHONE_NUMBER_ID;
    delete process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID;
    dbMock.db.select.mockReset();
    dbMock.pool.query.mockReset();
    mockProfile();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("confirms a manual admin handoff into the operator queue without external execution", async () => {
    mockPendingRow({
      id: "11111111-1111-1111-1111-111111111111",
      user_id: "user-1",
      use_case: "paperwork",
      provider_id: null,
      provider_name: "VYVA review",
      provider_phone: null,
      found_externally: false,
      action_summary: "Prepare government form help",
      action_payload: {
        document_type: "government form",
        recipient: "Town hall",
        deadline: "Friday",
        execution_channel: "manual",
        requested_tool: "operator_review",
      },
      language: "en",
      status: "pending",
    });

    const result = await startPendingConciergeAction("11111111-1111-1111-1111-111111111111", "user-1");

    expect(result).toMatchObject({
      status: "pending",
      conversationId: null,
      callSid: null,
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();

    const payload = lastUpdatedPayload();
    expect(payload.execution_task).toMatchObject({
      lifecycle_status: "confirmed",
      user_confirmed: true,
      confirmation_source: "confirm_endpoint",
      active_tool: "operator_review",
    });
    expect(payload.execution_audit).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "operator_handoff_queued",
        mode: "operator_queue",
        external_action_allowed: false,
      }),
    ]));
  });

  it("blocks confirmation and records needs-info when a phone action is missing the provider number", async () => {
    mockPendingRow({
      id: "22222222-2222-2222-2222-222222222222",
      user_id: "user-1",
      use_case: "book_appointment",
      provider_id: null,
      provider_name: "Marbella Clinic",
      provider_phone: null,
      found_externally: false,
      action_summary: "Call clinic for an appointment",
      action_payload: {
        reason: "Follow-up",
        requested_time: "Friday morning",
        execution_channel: "phone",
      },
      language: "en",
      status: "pending",
    });

    await expect(startPendingConciergeAction("22222222-2222-2222-2222-222222222222", "user-1"))
      .rejects.toThrow(/Complete before confirming: Phone number/i);
    expect(globalThis.fetch).not.toHaveBeenCalled();

    const payload = lastUpdatedPayload();
    expect(payload.execution_task).toMatchObject({
      lifecycle_status: "needs_info",
      user_confirmed: false,
      failure_reason: "missing_requirements",
    });
    expect(payload.execution_audit).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "blocked_missing_info",
        mode: "needs_info",
        external_action_allowed: false,
      }),
    ]));
  });
});
