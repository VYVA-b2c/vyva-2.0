import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  pool: {
    query: vi.fn(),
  },
}));

const readinessMock = vi.hoisted(() => ({
  conciergeChannelReadinessForToolWithAdminSettings: vi.fn(),
}));

const actionsMock = vi.hoisted(() => ({
  startPendingConciergeAction: vi.fn(),
}));

vi.mock("../db.js", () => dbMock);
vi.mock("../services/conciergeChannelReadiness.js", () => readinessMock);
vi.mock("../services/conciergeActions.js", () => actionsMock);

import adminConciergeQueueRouter from "./adminConciergeQueue.js";

function readiness(externalActionAllowed: boolean) {
  return {
    version: 1,
    tool: "email",
    channel: "email",
    label: "Email",
    status: externalActionAllowed ? "ready" : "not_verified",
    ready: externalActionAllowed,
    admin_enabled: true,
    configured: true,
    verified: externalActionAllowed,
    dry_run: false,
    external_action_allowed: externalActionAllowed,
    blockers: externalActionAllowed ? [] : ["email_not_verified"],
  };
}

const failedPendingRow = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "user-1",
  use_case: "paperwork",
  provider_id: null,
  provider_name: "City Clinic",
  provider_phone: null,
  found_externally: false,
  action_summary: "Email clinic paperwork",
  status: "failed",
  confirmed_at: "2026-07-01T10:00:00.000Z",
  expires_at: null,
  updated_at: "2026-07-01T10:20:00.000Z",
  full_name: "Elena Perez",
  preferred_name: "Elena",
  email: "elena@example.com",
  phone_number: null,
  action_payload: {
    provider_email: "frontdesk@example.com",
    deadline: "tomorrow",
    document_type: "insurance form",
    execution_task: {
      version: 1,
      flow_reference: "FLOW_INSURANCE_ADMIN",
      action_type: "message",
      requested_tool: "email",
      active_tool: "email",
      lifecycle_status: "failed",
      provider_ready: true,
      missing_requirements: [],
      confirmation_required: true,
      user_confirmed: true,
      external_action_allowed: true,
      execution_mode: "live",
      channel_readiness: readiness(true),
      confirmation_source: "confirm_endpoint",
      confirmed_at: "2026-07-01T10:00:00.000Z",
      created_at: "2026-07-01T09:59:00.000Z",
      updated_at: "2026-07-01T10:20:00.000Z",
      failure_reason: "Adapter endpoint failed with 500.",
    },
    execution_adapter: {
      version: 1,
      adapter: "concierge_email_adapter",
      mode: "live",
      channel: "email",
      tool: "email",
      status: "failed",
      attempted_at: "2026-07-01T10:19:00.000Z",
      provider_name: "City Clinic",
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
        at: "2026-07-01T10:19:01.000Z",
        source: "confirm_endpoint",
        adapter_result: {
          version: 1,
          adapter: "concierge_email_adapter",
          mode: "live",
          channel: "email",
          tool: "email",
          status: "failed",
          attempted_at: "2026-07-01T10:19:00.000Z",
          provider_name: "City Clinic",
          provider_contact: "frontdesk@example.com",
          external_action_allowed: true,
          result: "failed",
          error: "Adapter endpoint failed with 500.",
          response_status: 500,
        },
      },
    ],
  },
};

function cloneFailedPendingRow() {
  return JSON.parse(JSON.stringify(failedPendingRow)) as typeof failedPendingRow;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: "admin-1", email: "admin@example.com", role: "admin" };
    next();
  });
  app.use("/api/admin/concierge/queue", adminConciergeQueueRouter);
  return app;
}

describe("admin Concierge queue adapter recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readinessMock.conciergeChannelReadinessForToolWithAdminSettings.mockResolvedValue(readiness(true));
    actionsMock.startPendingConciergeAction.mockResolvedValue({
      pendingId: failedPendingRow.id,
      status: "pending",
      conversationId: null,
      callSid: null,
      message: "sent",
    });
  });

  it("lists adapter incidents with current readiness retry policy", async () => {
    readinessMock.conciergeChannelReadinessForToolWithAdminSettings.mockResolvedValue(readiness(false));
    dbMock.pool.query
      .mockResolvedValueOnce({ rows: [failedPendingRow] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(buildApp())
      .get("/api/admin/concierge/queue")
      .expect(200);

    expect(response.body.items[0].adapter_incident).toMatchObject({
      status: "failed",
      channel: "email",
      live: true,
      retry_allowed: false,
      retry_blocker: "email_not_verified",
      manual_follow_up_allowed: true,
    });
    expect(response.body.items[0].adapter_payload_preview).toMatchObject({
      adapter: "concierge_email_adapter",
      channel: "email",
      provider_name: "City Clinic",
      provider_contact: "frontdesk@example.com",
      summary: "Email clinic paperwork",
      valid: true,
      outbound_payload: expect.objectContaining({
        pending_id: failedPendingRow.id,
        user_id: "user-1",
        channel: "email",
        provider_contact: "frontdesk@example.com",
      }),
    });
  });

  it("blocks live adapter retry when current readiness is not passing", async () => {
    readinessMock.conciergeChannelReadinessForToolWithAdminSettings.mockResolvedValue(readiness(false));
    dbMock.pool.query.mockResolvedValueOnce({ rows: [failedPendingRow] });

    const response = await request(buildApp())
      .patch(`/api/admin/concierge/queue/${failedPendingRow.id}`)
      .send({ action: "retry_adapter", outcome_note: "try again" })
      .expect(409);

    expect(response.body.error).toContain("email_not_verified");
    expect(actionsMock.startPendingConciergeAction).not.toHaveBeenCalled();
  });

  it("records a retry audit entry before calling the fresh live adapter path", async () => {
    dbMock.pool.query
      .mockResolvedValueOnce({ rows: [failedPendingRow] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await request(buildApp())
      .patch(`/api/admin/concierge/queue/${failedPendingRow.id}`)
      .send({ action: "retry_adapter", outcome_note: "endpoint restored" })
      .expect(200);

    const updateCall = dbMock.pool.query.mock.calls.find(([sql]) => String(sql).includes("update concierge_pending"));
    expect(updateCall).toBeTruthy();
    const payload = JSON.parse(updateCall?.[1]?.[1] as string) as Record<string, unknown>;
    expect(payload.execution_audit).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "adapter_retry_requested",
        source: "operator_queue",
        reason: "endpoint restored",
        execution_mode: "live",
      }),
    ]));
    expect(actionsMock.startPendingConciergeAction).toHaveBeenCalledWith(
      failedPendingRow.id,
      "user-1",
      "operator_adapter_retry",
    );
  });

  it("blocks adapter retry before start when the payload contract is incomplete", async () => {
    const row = cloneFailedPendingRow();
    const actionPayload = row.action_payload as Record<string, unknown>;
    delete actionPayload.provider_email;
    (actionPayload.execution_adapter as Record<string, unknown>).provider_contact = null;

    dbMock.pool.query.mockResolvedValueOnce({ rows: [row] });

    const response = await request(buildApp())
      .patch(`/api/admin/concierge/queue/${failedPendingRow.id}`)
      .send({ action: "retry_adapter", outcome_note: "try again" })
      .expect(409);

    expect(response.body.error).toContain("Provider email address");
    expect(dbMock.pool.query).toHaveBeenCalledTimes(1);
    expect(actionsMock.startPendingConciergeAction).not.toHaveBeenCalled();
  });

  it("lists missing payload contract fields before retry", async () => {
    const row = cloneFailedPendingRow();
    const actionPayload = row.action_payload as Record<string, unknown>;
    delete actionPayload.provider_email;
    (actionPayload.execution_adapter as Record<string, unknown>).provider_contact = null;

    dbMock.pool.query
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [] });

    const response = await request(buildApp())
      .get("/api/admin/concierge/queue")
      .expect(200);

    expect(response.body.items[0].adapter_payload_preview).toMatchObject({
      valid: false,
      missing_fields: expect.arrayContaining([
        expect.objectContaining({
          key: "provider_contact",
          label: "Provider email address",
        }),
      ]),
    });
    expect(response.body.items[0].adapter_incident).toMatchObject({
      retry_allowed: false,
      retry_blocker: "adapter_payload_missing_provider_contact",
    });
  });

  it("records manual follow-up without calling the live adapter path", async () => {
    dbMock.pool.query
      .mockResolvedValueOnce({ rows: [failedPendingRow] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });

    await request(buildApp())
      .patch(`/api/admin/concierge/queue/${failedPendingRow.id}`)
      .send({ action: "manual_follow_up", outcome_note: "calling clinic manually" })
      .expect(200);

    const updateCall = dbMock.pool.query.mock.calls.find(([sql]) => String(sql).includes("update concierge_pending"));
    const payload = JSON.parse(updateCall?.[1]?.[1] as string) as Record<string, unknown>;
    expect(payload.execution_audit).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "adapter_manual_follow_up_queued",
        reason: "calling clinic manually",
        execution_mode: "manual_review",
      }),
    ]));
    expect(actionsMock.startPendingConciergeAction).not.toHaveBeenCalled();
  });
});
