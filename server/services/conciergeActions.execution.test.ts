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
import { conciergeProductionChannelForTool } from "../../shared/conciergeChannelReadiness";
import {
  buildConciergeAdapterApprovalFingerprint,
  compareConciergeAdapterApprovalFingerprint,
} from "../../shared/conciergeAdapterPayloadContract";

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

function mockPendingRow(row: Record<string, unknown>, channelSettingsRows: Record<string, unknown>[] = []) {
  dbMock.pool.query.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (sql.includes("from concierge_pending")) {
      return { rows: [row] };
    }
    if (sql.includes("from concierge_channel_readiness_settings")) {
      return { rows: channelSettingsRows };
    }
    if (sql.includes("receipt_kind") && sql.includes("insert into concierge_sessions")) {
      return { rows: [{ id: "session-live-email-receipt" }], rowCount: 1, params };
    }
    if (sql.includes("update concierge_pending")) {
      return { rows: [], rowCount: 1, params };
    }
    return { rows: [] };
  });
}

function passedChannelSettingsRow(channel: string, overrides: Record<string, unknown> = {}) {
  return {
    channel,
    admin_enabled: true,
    verified: true,
    notes: "QA probe passed.",
    last_probe_status: "pass",
    last_probe_at: new Date("2026-07-16T10:00:00.000Z"),
    last_probe_blocker: null,
    last_probe_by: "admin-1",
    updated_by: "admin-1",
    updated_at: new Date("2026-07-16T10:00:00.000Z"),
    ...overrides,
  };
}

function lastUpdatedPayload() {
  const updateCall = dbMock.pool.query.mock.calls.find(([sql]) => String(sql).includes("update concierge_pending"));
  expect(updateCall).toBeTruthy();
  const rawPayload = updateCall?.[1]?.[2];
  expect(typeof rawPayload).toBe("string");
  return JSON.parse(rawPayload as string) as Record<string, unknown>;
}

function mockCompletionClient(existingReceiptId?: string) {
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes("from concierge_sessions") && sql.includes("receipt_kind")) {
        return { rows: existingReceiptId ? [{ id: existingReceiptId }] : [], rowCount: existingReceiptId ? 1 : 0, params };
      }
      if (sql.includes("update concierge_sessions")) {
        return { rows: [{ id: existingReceiptId ?? "session-dry-run" }], rowCount: 1, params };
      }
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
    delete process.env.CONCIERGE_PHONE_CALL_CHANNEL_READY;
    delete process.env.CONCIERGE_PHONE_CALL_CHANNEL_CONFIGURED;
    delete process.env.CONCIERGE_PHONE_CALL_CHANNEL_VERIFIED;
    delete process.env.CONCIERGE_EMAIL_CHANNEL_READY;
    delete process.env.CONCIERGE_EMAIL_CHANNEL_CONFIGURED;
    delete process.env.CONCIERGE_EMAIL_CHANNEL_VERIFIED;
    delete process.env.CONCIERGE_WHATSAPP_CHANNEL_READY;
    delete process.env.CONCIERGE_WHATSAPP_CHANNEL_CONFIGURED;
    delete process.env.CONCIERGE_WHATSAPP_CHANNEL_VERIFIED;
    delete process.env.CONCIERGE_FORM_APPLICATION_CHANNEL_READY;
    delete process.env.CONCIERGE_FORM_APPLICATION_CHANNEL_CONFIGURED;
    delete process.env.CONCIERGE_FORM_APPLICATION_CHANNEL_VERIFIED;
    delete process.env.CONCIERGE_DOCUMENT_UPLOAD_CHANNEL_READY;
    delete process.env.CONCIERGE_DOCUMENT_UPLOAD_CHANNEL_CONFIGURED;
    delete process.env.CONCIERGE_DOCUMENT_UPLOAD_CHANNEL_VERIFIED;
    delete process.env.CONCIERGE_EMAIL_LIVE_ENDPOINT;
    delete process.env.CONCIERGE_WHATSAPP_LIVE_ENDPOINT;
    delete process.env.CONCIERGE_FORM_APPLICATION_LIVE_ENDPOINT;
    delete process.env.CONCIERGE_DOCUMENT_UPLOAD_LIVE_ENDPOINT;
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
      message: "Concierge action confirmed and queued for VYVA review.",
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

  it("queues a direct phone action without calling when the phone channel is not admin-ready", async () => {
    mockPendingRow({
      id: "88888888-8888-4888-8888-888888888888",
      user_id: "user-1",
      use_case: "book_ride",
      provider_id: null,
      provider_name: "Radio Taxi",
      provider_phone: "+34600111222",
      found_externally: false,
      action_summary: "Call Radio Taxi for a ride.",
      action_payload: {
        pickup_address: "Home",
        destination_address: "Clinic",
        requested_time: "Friday morning",
        execution_channel: "phone",
      },
      language: "en",
      status: "pending",
    }, [passedChannelSettingsRow("email")]);

    const result = await startPendingConciergeAction("88888888-8888-4888-8888-888888888888", "user-1");

    expect(result).toMatchObject({
      status: "pending",
      conversationId: null,
      callSid: null,
      message: expect.stringContaining("phone calls channel is not ready"),
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();

    const payload = lastUpdatedPayload();
    expect(payload.execution_task).toMatchObject({
      lifecycle_status: "confirmed",
      user_confirmed: true,
      active_tool: "phone_call",
      external_action_allowed: false,
      execution_mode: "blocked",
      channel_readiness: {
        channel: "phone_call",
        status: "disabled",
        external_action_allowed: false,
      },
    });
    expect(payload.execution_audit).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "operator_handoff_queued",
        mode: "operator_queue",
        external_action_allowed: false,
        execution_mode: "blocked",
      }),
    ]));
  });

  it("records user-controlled draft confirmation without starting a direct call", async () => {
    process.env.CONCIERGE_EMAIL_LIVE_ENDPOINT = "https://adapter.example.test/email";
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      id: "email-adapter-1",
      result: "sent",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
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
    }, [passedChannelSettingsRow("email")]);

    const result = await confirmPendingConciergeActionReview("33333333-3333-3333-3333-333333333333", "user-1");

    expect(result).toMatchObject({
      status: "pending",
      conversationId: null,
      callSid: null,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://adapter.example.test/email",
      expect.objectContaining({ method: "POST" }),
    );

    const payload = lastUpdatedPayload();
    expect(payload.execution_task).toMatchObject({
      lifecycle_status: "confirmed",
      user_confirmed: true,
      confirmation_source: "user_controlled_execution",
      active_tool: "email",
      external_action_allowed: true,
      execution_mode: "live",
      channel_readiness: {
        channel: "email",
        status: "ready",
        external_action_allowed: true,
      },
    });
    expect(payload.execution_adapter).toMatchObject({
      adapter: "concierge_email_adapter",
      mode: "live",
      channel: "email",
      status: "sent",
      result_id: "email-adapter-1",
    });
    expect(payload.execution_audit).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "adapter_execution_succeeded",
        mode: "user_controlled_handoff",
        external_action_allowed: true,
        execution_mode: "live",
        adapter_result: expect.objectContaining({
          adapter: "concierge_email_adapter",
          status: "sent",
        }),
      }),
    ]));
  });

  it("resolves an operator reconfirmation request without firing the live channel", async () => {
    const originalApprovedPayload = {
      execution_channel: "email",
      provider_email: "clinic@example.com",
      email_subject: "Question about my appointment",
      email_body: "Hello, I would like to confirm my appointment details.",
    };
    const updatedPayload = {
      ...originalApprovedPayload,
      email_body: "Hello, please confirm the updated appointment paperwork.",
    };
    mockPendingRow({
      id: "96969696-9696-4696-8696-969696969696",
      user_id: "user-1",
      use_case: "send_message",
      provider_id: null,
      provider_name: "Clinic desk",
      provider_phone: null,
      found_externally: false,
      action_summary: "Email updated clinic paperwork.",
      action_payload: {
        ...updatedPayload,
        reconfirmation_request: {
          version: 1,
          status: "needed",
          requested_at: "2026-07-01T10:30:00.000Z",
          requested_by: "admin-1",
          changed_fields: ["payload"],
          payload_preview: {
            version: 1,
            adapter: "concierge_email_adapter",
            channel: "email",
            tool: "email",
            provider_name: "Clinic desk",
            provider_contact: "clinic@example.com",
            summary: "Email updated clinic paperwork.",
            pending_id: "96969696-9696-4696-8696-969696969696",
            user_id: "user-1",
            valid: true,
            missing_fields: [],
            blockers: [],
            outbound_payload: {
              provider_contact: "clinic@example.com",
              summary: "Email updated clinic paperwork.",
            },
          },
        },
        execution_adapter: {
          version: 1,
          adapter: "concierge_email_adapter",
          mode: "live",
          channel: "email",
          tool: "email",
          status: "failed",
          attempted_at: "2026-07-01T10:20:00.000Z",
          provider_name: "Clinic desk",
          provider_contact: "clinic@example.com",
          external_action_allowed: true,
          result: "failed",
          error: "adapter failed",
        },
        execution_task: {
          version: 1,
          flow_reference: "FLOW_TOOL_GATED_TASK",
          action_type: "message",
          requested_tool: "email",
          active_tool: "email",
          lifecycle_status: "ready",
          provider_ready: true,
          missing_requirements: [],
          confirmation_required: true,
          user_confirmed: false,
          external_action_allowed: false,
          execution_mode: "manual_review",
          channel_readiness: {
            version: 1,
            tool: "email",
            channel: "email",
            label: "Email",
            status: "ready",
            ready: true,
            admin_enabled: true,
            configured: true,
            verified: true,
            dry_run: false,
            external_action_allowed: true,
            blockers: [],
          },
          confirmation_source: "operator_reconfirmation_request",
          confirmed_at: "2026-07-01T10:00:00.000Z",
          created_at: "2026-07-01T09:59:00.000Z",
          updated_at: "2026-07-01T10:30:00.000Z",
          failure_reason: "user_reconfirmation_required",
          approval_fingerprint: buildConciergeAdapterApprovalFingerprint({
            tool: "email",
            payload: originalApprovedPayload,
            providerName: "Clinic desk",
            summary: "Email clinic paperwork.",
            approvedAt: "2026-07-01T10:00:00.000Z",
          }),
        },
      },
      language: "en",
      status: "pending",
    }, [passedChannelSettingsRow("email", {
      adapter_live_endpoint_url: "https://adapter.example.test/email",
    })]);

    const result = await confirmPendingConciergeActionReview("96969696-9696-4696-8696-969696969696", "user-1");

    expect(result).toMatchObject({
      status: "pending",
      message: "Updated Concierge action approved and ready for VYVA retry.",
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();

    const payload = lastUpdatedPayload();
    expect(payload.reconfirmation_request).toMatchObject({
      status: "resolved",
      resolved_source: "user_controlled_execution",
    });
    expect(payload.execution_adapter).toMatchObject({
      status: "failed",
      error: "adapter failed",
    });
    expect(payload.execution_task).toMatchObject({
      lifecycle_status: "confirmed",
      user_confirmed: true,
      confirmation_source: "user_controlled_execution",
      active_tool: "email",
    });
    const task = payload.execution_task as Record<string, unknown>;
    const comparison = compareConciergeAdapterApprovalFingerprint({
      tool: "email",
      payload,
      providerName: "Clinic desk",
      summary: "Email updated clinic paperwork.",
    }, task.approval_fingerprint);
    expect(comparison.requires_reconfirmation).toBe(false);
    expect(payload.execution_audit).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "user_reconfirmed",
        source: "user_controlled_execution",
        reason: "updated_details_approved",
      }),
    ]));
  });

  it("records a ready form/application confirmation as a live user-controlled channel", async () => {
    process.env.CONCIERGE_FORM_APPLICATION_LIVE_ENDPOINT = "https://adapter.example.test/form";
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      id: "form-adapter-1",
      result: "submitted",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    mockPendingRow({
      id: "12121212-1212-4212-8212-121212121212",
      user_id: "user-1",
      use_case: "book_appointment",
      provider_id: null,
      provider_name: "The Good Table",
      provider_phone: null,
      found_externally: false,
      action_summary: "Booking form ready for The Good Table.",
      action_payload: {
        appointment_type: "restaurant reservation",
        appointment_reason: "Dinner reservation",
        requested_time: "Tomorrow evening",
        location: "Marbella",
        execution_channel: "booking_url",
        booking_url: "https://www.thefork.es/restaurante/example",
        form_automation_plan: {
          adapter_label: "TheFork",
          missing_fields: [],
          next_step: "Use the supported booking page with the gathered details.",
          prefilled_url: "https://www.thefork.es/restaurante/example?date=tomorrow",
        },
      },
      language: "en",
      status: "pending",
    }, [passedChannelSettingsRow("form_application")]);

    const result = await startPendingConciergeAction("12121212-1212-4212-8212-121212121212", "user-1");

    expect(result).toMatchObject({
      status: "pending",
      conversationId: null,
      callSid: null,
      message: "submitted",
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://adapter.example.test/form",
      expect.objectContaining({ method: "POST" }),
    );

    const payload = lastUpdatedPayload();
    expect(payload.execution_task).toMatchObject({
      lifecycle_status: "confirmed",
      user_confirmed: true,
      confirmation_source: "confirm_endpoint",
      active_tool: "booking_link",
      external_action_allowed: true,
      execution_mode: "live",
      channel_readiness: {
        channel: "form_application",
        status: "ready",
        external_action_allowed: true,
      },
    });
    expect(payload.execution_adapter).toMatchObject({
      adapter: "concierge_form_application_adapter",
      mode: "live",
      channel: "form_application",
      status: "sent",
      result_id: "form-adapter-1",
    });
    expect(payload.execution_audit).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "adapter_execution_succeeded",
        mode: "operator_queue",
        external_action_allowed: true,
        execution_mode: "live",
        adapter_result: expect.objectContaining({
          adapter: "concierge_form_application_adapter",
          status: "sent",
        }),
      }),
    ]));
  });

  it("blocks user-controlled email confirmation when the admin channel gate is not ready", async () => {
    mockPendingRow({
      id: "77777777-7777-4777-8777-777777777777",
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

    await expect(confirmPendingConciergeActionReview("77777777-7777-4777-8777-777777777777", "user-1"))
      .rejects.toThrow(/email channel is not ready for live Concierge actions/i);
    expect(globalThis.fetch).not.toHaveBeenCalled();

    const payload = lastUpdatedPayload();
    expect(payload.execution_task).toMatchObject({
      lifecycle_status: "needs_info",
      user_confirmed: false,
      failure_reason: "channel_not_ready",
      external_action_allowed: false,
      execution_mode: "blocked",
      channel_readiness: {
        channel: "email",
        status: "disabled",
        external_action_allowed: false,
      },
    });
    expect(payload.execution_audit).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "adapter_execution_blocked",
        mode: "operator_queue",
        external_action_allowed: false,
        execution_mode: "blocked",
        adapter_result: expect.objectContaining({
          adapter: "concierge_email_adapter",
          status: "blocked",
        }),
      }),
    ]));
  });

  it("blocks live email confirmation when the latest admin probe failed", async () => {
    process.env.CONCIERGE_EMAIL_LIVE_ENDPOINT = "https://adapter.example.test/email";
    mockPendingRow({
      id: "17171717-1717-4717-8717-171717171717",
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
    }, [{
      channel: "email",
      admin_enabled: true,
      verified: false,
      notes: "Last probe failed.",
      last_probe_status: "fail",
      last_probe_at: new Date("2026-07-16T10:00:00.000Z"),
      last_probe_blocker: "QA inbox was not a reserved test endpoint.",
      last_probe_by: "admin-1",
      updated_by: "admin-1",
      updated_at: new Date("2026-07-16T10:00:00.000Z"),
    }]);

    await expect(confirmPendingConciergeActionReview("17171717-1717-4717-8717-171717171717", "user-1"))
      .rejects.toThrow(/email channel is not ready for live Concierge actions/i);
    expect(globalThis.fetch).not.toHaveBeenCalled();

    const payload = lastUpdatedPayload();
    expect(payload.execution_task).toMatchObject({
      lifecycle_status: "needs_info",
      failure_reason: "channel_not_ready",
      external_action_allowed: false,
      execution_mode: "blocked",
      channel_readiness: {
        channel: "email",
        status: "not_verified",
        admin_enabled: true,
        configured: true,
        verified: false,
        external_action_allowed: false,
      },
    });
  });

  it("lets admin console settings pause a configured channel before live handoff", async () => {
    process.env.CONCIERGE_EMAIL_LIVE_ENDPOINT = "https://adapter.example.test/email";
    mockPendingRow({
      id: "78787878-7878-4787-8787-787878787878",
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
    }, [passedChannelSettingsRow("email", {
      admin_enabled: false,
      notes: "Admin paused after QA.",
    })]);

    await expect(confirmPendingConciergeActionReview("78787878-7878-4787-8787-787878787878", "user-1"))
      .rejects.toThrow(/email channel is not ready for live Concierge actions/i);

    const payload = lastUpdatedPayload();
    expect(payload.execution_task).toMatchObject({
      active_tool: "email",
      external_action_allowed: false,
      execution_mode: "blocked",
      channel_readiness: {
        channel: "email",
        status: "disabled",
        admin_enabled: false,
        configured: true,
        verified: true,
        external_action_allowed: false,
      },
    });
  });

  it("uses admin console readiness settings to make a configured channel live-capable", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      id: "email-adapter-2",
      result: "sent",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    mockPendingRow({
      id: "89898989-8989-4898-8989-898989898989",
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
    }, [passedChannelSettingsRow("email", {
      notes: "QA inbox verified.",
      adapter_live_endpoint_url: "https://adapter.example.test/email",
      adapter_credential_reference: "vault/vyva/email-adapter",
      adapter_qa_target: "concierge@example.test",
    })]);

    await expect(confirmPendingConciergeActionReview("89898989-8989-4898-8989-898989898989", "user-1"))
      .resolves.toMatchObject({
        pendingId: "89898989-8989-4898-8989-898989898989",
        status: "pending",
      });

    const payload = lastUpdatedPayload();
    expect(payload.execution_task).toMatchObject({
      active_tool: "email",
      external_action_allowed: true,
      execution_mode: "live",
      channel_readiness: {
        channel: "email",
        status: "ready",
        admin_enabled: true,
        configured: true,
        verified: true,
        external_action_allowed: true,
      },
    });
    expect(payload.execution_adapter).toMatchObject({
      adapter: "concierge_email_adapter",
      mode: "live",
      status: "sent",
      result_id: "email-adapter-2",
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://adapter.example.test/email",
      expect.objectContaining({ method: "POST" }),
    );
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
    expect(payload.execution_adapter).toMatchObject({
      adapter: "concierge_phone_call_adapter",
      mode: "dry_run",
      channel: "phone_call",
      status: "simulated",
    });
    expect(payload.execution_audit).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "adapter_execution_simulated",
        mode: "operator_queue",
        dry_run: true,
        external_action_allowed: false,
        adapter_result: expect.objectContaining({
          adapter: "concierge_phone_call_adapter",
          status: "simulated",
        }),
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
    expect(actionPayload.execution_adapter).toMatchObject({
      adapter: "concierge_email_adapter",
      mode: "dry_run",
      channel: "email",
      status: "simulated",
    });
    expect(outcomePayload).toMatchObject({
      dry_run: true,
      simulated_outcome: true,
      no_real_provider_contact: true,
      adapter: "concierge_email_adapter",
      adapter_mode: "dry_run",
      adapter_channel: "email",
      adapter_status: "simulated",
    });
    expect(outcomePayload.execution_task).toMatchObject({
      dry_run: true,
      lifecycle_status: "done",
    });
  });

  it("stores live completion history with live execution markers", async () => {
    mockPendingRow({
      id: "99999999-9999-4999-8999-999999999999",
      user_id: "user-1",
      use_case: "send_message",
      provider_id: null,
      provider_name: "Clinic desk",
      provider_phone: null,
      found_externally: false,
      action_summary: "Email draft sent to the clinic.",
      action_payload: {
        execution_channel: "email",
        provider_email: "clinic@example.com",
        email_subject: "Question about my appointment",
        execution_task: {
          version: 1,
          flow_reference: "FLOW_TOOL_GATED_TASK",
          action_type: "message",
          requested_tool: "email",
          active_tool: "email",
          lifecycle_status: "confirmed",
          provider_ready: true,
          missing_requirements: [],
          confirmation_required: true,
          user_confirmed: true,
          external_action_allowed: true,
          execution_mode: "live",
          channel_readiness: {
            version: 1,
            tool: "email",
            channel: "email",
            label: "Email",
            status: "ready",
            ready: true,
            admin_enabled: true,
            configured: true,
            verified: true,
            dry_run: false,
            external_action_allowed: true,
            blockers: [],
          },
          created_at: "2026-07-14T10:00:00.000Z",
          updated_at: "2026-07-14T10:01:00.000Z",
        },
        execution_adapter: {
          version: 1,
          adapter: "concierge_email_adapter",
          mode: "live",
          channel: "email",
          tool: "email",
          status: "sent",
          attempted_at: "2026-07-14T10:02:00.000Z",
          provider_name: "Clinic desk",
          provider_contact: "clinic@example.com",
          external_action_allowed: true,
          result: "sent",
          result_id: "email-adapter-live-1",
        },
      },
      language: "en",
      status: "pending",
    });
    const client = mockCompletionClient();

    const result = await completePendingConciergeAction("99999999-9999-4999-8999-999999999999", "user-1", {
      outcomeSummary: "Email sent to the clinic.",
      outcomePayload: { provider_email: "clinic@example.com" },
    });

    expect(result).toEqual({ ok: true, status: "completed", sessionId: "session-dry-run" });
    const insertCall = client.query.mock.calls.find(([sql]) => String(sql).includes("insert into concierge_sessions"));
    expect(insertCall).toBeTruthy();
    const params = insertCall?.[1] as unknown[];
    const actionPayload = JSON.parse(params[8] as string) as Record<string, unknown>;
    const outcomePayload = JSON.parse(params[9] as string) as Record<string, unknown>;
    expect(actionPayload.execution_adapter).toMatchObject({
      adapter: "concierge_email_adapter",
      mode: "live",
      channel: "email",
      status: "sent",
      result_id: "email-adapter-live-1",
    });
    expect(outcomePayload).toMatchObject({
      provider_email: "clinic@example.com",
      execution_mode: "live",
      live_action: true,
      external_action_allowed: true,
      adapter: "concierge_email_adapter",
      adapter_mode: "live",
      adapter_channel: "email",
      adapter_provider: "Clinic desk",
      adapter_provider_contact: "clinic@example.com",
      adapter_attempted_at: "2026-07-14T10:02:00.000Z",
      adapter_status: "sent",
      adapter_result: expect.objectContaining({
        adapter: "concierge_email_adapter",
        result_id: "email-adapter-live-1",
      }),
      channel_readiness: {
        channel: "email",
        status: "ready",
        external_action_allowed: true,
      },
    });
    expect(outcomePayload.execution_task).toMatchObject({
      lifecycle_status: "done",
      user_confirmed: true,
      external_action_allowed: true,
      execution_mode: "live",
    });
  });

  it("carries an app-triggered live email send into completed history", async () => {
    process.env.CONCIERGE_EMAIL_LIVE_ENDPOINT = "https://adapter.example.test/email";
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      id: "email-adapter-smoke-1",
      result: "sent",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const pendingId = "19191919-1919-4919-8919-191919191919";
    const pendingRow = {
      id: pendingId,
      user_id: "user-1",
      use_case: "send_message",
      provider_id: null,
      provider_name: "Controlled Email Pilot Inbox",
      provider_phone: null,
      found_externally: false,
      action_summary: "Email pilot receipt from the app queue.",
      action_payload: {
        execution_channel: "email",
        provider_email: "concierge@vyva.life",
        email_subject: "VYVA Concierge app-triggered smoke",
        email_body: "Controlled app-triggered live email smoke.",
      },
      language: "en",
      status: "pending",
    };
    mockPendingRow(pendingRow, [passedChannelSettingsRow("email")]);

    const confirmed = await confirmPendingConciergeActionReview(pendingId, "user-1");

    expect(confirmed).toMatchObject({
      pendingId,
      status: "pending",
      message: "sent",
      historySessionId: "session-live-email-receipt",
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://adapter.example.test/email",
      expect.objectContaining({ method: "POST" }),
    );
    const confirmedPayload = lastUpdatedPayload();
    expect(confirmedPayload.execution_task).toMatchObject({
      lifecycle_status: "confirmed",
      user_confirmed: true,
      confirmation_source: "user_controlled_execution",
      external_action_allowed: true,
      execution_mode: "live",
    });
    expect(confirmedPayload.execution_adapter).toMatchObject({
      adapter: "concierge_email_adapter",
      mode: "live",
      channel: "email",
      status: "sent",
      provider_name: "Controlled Email Pilot Inbox",
      provider_contact: "concierge@vyva.life",
      result_id: "email-adapter-smoke-1",
    });
    const receiptCall = dbMock.pool.query.mock.calls.find(([sql]) => (
      String(sql).includes("receipt_kind") && String(sql).includes("insert into concierge_sessions")
    ));
    expect(receiptCall).toBeTruthy();
    const receiptParams = receiptCall?.[1] as unknown[];
    const receiptOutcomePayload = JSON.parse(receiptParams[9] as string) as Record<string, unknown>;
    expect(receiptParams[10]).toBe("Email sent to Controlled Email Pilot Inbox (concierge@vyva.life). Waiting for provider reply.");
    expect(receiptOutcomePayload).toMatchObject({
      receipt_kind: "provider_contact_sent",
      email_outcome: "sent",
      execution_mode: "live",
      live_action: true,
      external_action_allowed: true,
      user_confirmed: true,
      confirmation_source: "user_controlled_execution",
      provider_name: "Controlled Email Pilot Inbox",
      provider_email: "concierge@vyva.life",
      recipient_email: "concierge@vyva.life",
      provider_message_id: "email-adapter-smoke-1",
      adapter_status: "sent",
      waiting_for_provider: true,
      execution_task: expect.objectContaining({
        lifecycle_status: "confirmed",
        user_confirmed: true,
      }),
    });

    const repeated = await confirmPendingConciergeActionReview(pendingId, "user-1");
    expect(repeated).toMatchObject({ historySessionId: "session-live-email-receipt" });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    dbMock.pool.query.mockReset();
    mockPendingRow({
      ...pendingRow,
      action_payload: confirmedPayload,
      status: "pending",
    });
    const client = mockCompletionClient("session-live-email-receipt");

    const completed = await completePendingConciergeAction(pendingId, "user-1", {
      outcomeSummary: "App-triggered pilot email sent and receipt confirmed.",
      outcomePayload: { smoke_check: "app_triggered_live_email_history" },
    });

    expect(completed).toEqual({ ok: true, status: "completed", sessionId: "session-live-email-receipt" });
    const updateReceiptCall = client.query.mock.calls.find(([sql]) => String(sql).includes("update concierge_sessions"));
    expect(updateReceiptCall).toBeTruthy();
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes("insert into concierge_sessions"))).toBe(false);
    const params = updateReceiptCall?.[1] as unknown[];
    const actionPayload = JSON.parse(params[1] as string) as Record<string, unknown>;
    const outcomePayload = JSON.parse(params[2] as string) as Record<string, unknown>;

    expect(params[3]).toBe("App-triggered pilot email sent and receipt confirmed.");
    expect(actionPayload.execution_audit).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "adapter_execution_succeeded",
        source: "user_controlled_execution",
        execution_mode: "live",
        adapter_result: expect.objectContaining({
          adapter: "concierge_email_adapter",
          status: "sent",
          provider_contact: "concierge@vyva.life",
        }),
      }),
      expect.objectContaining({
        event: "completed",
        source: "completion_endpoint",
        execution_mode: "live",
      }),
    ]));
    expect(outcomePayload).toMatchObject({
      smoke_check: "app_triggered_live_email_history",
      receipt_kind: "final_task_completion",
      execution_mode: "live",
      live_action: true,
      external_action_allowed: true,
      adapter: "concierge_email_adapter",
      adapter_mode: "live",
      adapter_channel: "email",
      adapter_provider: "Controlled Email Pilot Inbox",
      adapter_provider_contact: "concierge@vyva.life",
      provider_email: "concierge@vyva.life",
      recipient_email: "concierge@vyva.life",
      provider_message_id: "email-adapter-smoke-1",
      email_outcome: "sent",
      adapter_status: "sent",
      adapter_result: expect.objectContaining({
        result_id: "email-adapter-smoke-1",
      }),
      execution_task: expect.objectContaining({
        lifecycle_status: "done",
        user_confirmed: true,
        execution_mode: "live",
        external_action_allowed: true,
      }),
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
      const actionPayload = JSON.parse(params[8] as string) as Record<string, unknown>;
      const outcomePayload = JSON.parse(params[9] as string) as Record<string, unknown>;
      const channel = conciergeProductionChannelForTool(fixture.endpoint.tool);
      expect(params[10], fixture.reference).toContain("Simulated dry-run outcome");
      expect(outcomePayload, fixture.reference).toMatchObject({
        dry_run: true,
        simulated_outcome: true,
        no_real_provider_contact: true,
      });
      if (channel) {
        expect(actionPayload.execution_adapter, fixture.reference).toMatchObject({
          adapter: `concierge_${channel}_adapter`,
          mode: "dry_run",
          channel,
          status: "simulated",
        });
        expect(outcomePayload, fixture.reference).toMatchObject({
          adapter: `concierge_${channel}_adapter`,
          adapter_mode: "dry_run",
          adapter_channel: channel,
          adapter_status: "simulated",
          adapter_result: expect.objectContaining({
            adapter: `concierge_${channel}_adapter`,
            mode: "dry_run",
            channel,
            status: "simulated",
          }),
        });
      } else {
        expect(actionPayload.execution_adapter, fixture.reference).toBeUndefined();
        expect(outcomePayload.adapter, fixture.reference).toBeUndefined();
      }
    }
  });
});
