import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
  },
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
}));

vi.mock("../db.js", () => dbMock);

import {
  completePendingConciergeAction,
  confirmPendingConciergeActionReview,
  startPendingConciergeAction,
} from "./conciergeActions.js";
import { CONCIERGE_DRY_RUN_FIXTURES } from "../../shared/conciergeDryRun";

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

function mockCompletionClient() {
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("insert into concierge_sessions")) {
        return { rows: [{ id: "session-dry-run" }], rowCount: 1, params };
      }
      return { rows: [], rowCount: 1, params };
    }),
    release: vi.fn(),
  };
  dbMock.pool.connect.mockResolvedValue(client);
  return client;
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
    dbMock.pool.connect.mockReset();
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

  it("records user-controlled draft confirmation without starting a direct call", async () => {
    mockPendingRow({
      id: "33333333-3333-3333-3333-333333333333",
      user_id: "user-1",
      use_case: "send_message",
      provider_id: null,
      provider_name: "Clinic desk",
      provider_phone: null,
      found_externally: false,
      action_summary: "Email draft prepared for the clinic.",
      action_payload: {
        execution_channel: "email",
        provider_email: "clinic@example.com",
        email_subject: "Question about my appointment",
        email_body: "Hello, I would like to confirm my appointment details.",
      },
      language: "en",
      status: "pending",
    });

    const result = await confirmPendingConciergeActionReview("33333333-3333-3333-3333-333333333333", "user-1");

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
      confirmation_source: "user_controlled_execution",
      active_tool: "email",
    });
    expect(payload.execution_audit).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "user_confirmed",
        mode: "user_controlled_handoff",
        external_action_allowed: true,
      }),
    ]));
  });

  it("confirms a dry-run phone action without starting the outbound caller", async () => {
    mockPendingRow({
      id: "44444444-4444-4444-4444-444444444444",
      user_id: "user-1",
      use_case: "book_ride",
      provider_id: null,
      provider_name: "VYVA Test Transport",
      provider_phone: "+12025550100",
      found_externally: false,
      action_summary: "Dry-run ride request to the city clinic.",
      action_payload: {
        dry_run: true,
        test_mode: "concierge_dry_run",
        no_real_provider_contact: true,
        flow_reference: "FLOW_TRANSPORT_BOOKING",
        execution_channel: "phone",
        requested_tool: "phone_call",
        pickup_address: "Saved home address",
        destination_address: "City Clinic test entrance",
        requested_time: "Tomorrow at 09:00",
        provider_phone: "+12025550100",
      },
      language: "en",
      status: "pending",
    });

    const result = await startPendingConciergeAction("44444444-4444-4444-4444-444444444444", "user-1");

    expect(result).toMatchObject({
      status: "pending",
      conversationId: null,
      callSid: null,
      message: expect.stringContaining("Dry-run confirmed"),
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();

    const payload = lastUpdatedPayload();
    expect(payload.execution_task).toMatchObject({
      lifecycle_status: "confirmed",
      user_confirmed: true,
      dry_run: true,
      active_tool: "phone_call",
    });
    expect(payload.execution_audit).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "operator_handoff_queued",
        mode: "operator_queue",
        dry_run: true,
        external_action_allowed: false,
        reason: "dry_run_simulation",
      }),
    ]));
  });

  it("stores dry-run completion history as a simulated outcome", async () => {
    mockPendingRow({
      id: "55555555-5555-5555-5555-555555555555",
      user_id: "user-1",
      use_case: "insurance_admin",
      provider_id: null,
      provider_name: null,
      provider_phone: null,
      found_externally: false,
      action_summary: "Dry-run insurance paperwork request.",
      action_payload: {
        dry_run: true,
        test_mode: "concierge_dry_run",
        no_real_provider_contact: true,
        flow_reference: "FLOW_INSURANCE_ADMIN",
        execution_channel: "email",
        requested_tool: "email",
        document_type: "insurance claim form",
        recipient_email: "concierge-dry-run+admin@example.test",
        deadline: "Next Friday",
      },
      language: "en",
      status: "pending",
    });
    const client = mockCompletionClient();

    const result = await completePendingConciergeAction("55555555-5555-5555-5555-555555555555", "user-1");

    expect(result).toEqual({ ok: true, status: "completed", sessionId: "session-dry-run" });
    const insertCall = client.query.mock.calls.find(([sql]) => String(sql).includes("insert into concierge_sessions"));
    expect(insertCall).toBeTruthy();
    const params = insertCall?.[1] as unknown[];
    const actionPayload = JSON.parse(params[8] as string) as Record<string, unknown>;
    const outcomePayload = JSON.parse(params[9] as string) as Record<string, unknown>;

    expect(params[10]).toBe("Simulated dry-run outcome: Dry-run insurance paperwork request.");
    expect(actionPayload.execution_task).toMatchObject({
      lifecycle_status: "done",
      user_confirmed: true,
      dry_run: true,
      outcome: "Simulated dry-run outcome: Dry-run insurance paperwork request.",
    });
    expect(outcomePayload).toMatchObject({
      dry_run: true,
      simulated_outcome: true,
      no_real_provider_contact: true,
    });
    expect(outcomePayload.execution_task).toMatchObject({
      dry_run: true,
      lifecycle_status: "done",
    });
  });

  it("stores every dry-run fixture completion as simulated completed history", async () => {
    for (const fixture of CONCIERGE_DRY_RUN_FIXTURES) {
      dbMock.pool.query.mockReset();
      dbMock.pool.connect.mockReset();
      mockPendingRow({
        id: "66666666-6666-4666-8666-666666666666",
        user_id: "user-1",
        use_case: fixture.useCase,
        provider_id: null,
        provider_name: fixture.provider?.name ?? null,
        provider_phone: fixture.provider?.phone ?? null,
        found_externally: false,
        action_summary: fixture.actionSummary,
        action_payload: fixture.actionPayload,
        language: "en",
        status: "pending",
      });
      const client = mockCompletionClient();

      const result = await completePendingConciergeAction("66666666-6666-4666-8666-666666666666", "user-1");

      expect(result.status, fixture.reference).toBe("completed");
      const insertCall = client.query.mock.calls.find(([sql]) => String(sql).includes("insert into concierge_sessions"));
      expect(insertCall, fixture.reference).toBeTruthy();
      const params = insertCall?.[1] as unknown[];
      const outcomePayload = JSON.parse(params[9] as string) as Record<string, unknown>;
      expect(params[10], fixture.reference).toContain("Simulated dry-run outcome");
      expect(outcomePayload, fixture.reference).toMatchObject({
        dry_run: true,
        simulated_outcome: true,
        no_real_provider_contact: true,
      });
    }
  });
});
