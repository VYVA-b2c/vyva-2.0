import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock("../db.js", () => dbMock);

import {
  buildAdminConciergeChannelReadinessSnapshot,
  updateAdminConciergeChannelReadiness,
} from "./conciergeChannelReadiness.js";

const originalEnv = { ...process.env };

function resetChannelEnv() {
  process.env = { ...originalEnv };
  [
    "ELEVENLABS_API_KEY",
    "ELEVENLABS_CONCIERGE_CALLER_AGENT_ID",
    "ELEVENLABS_CONCIERGE_OUTBOUND_AGENT_ID",
    "ELEVENLABS_OUTBOUND_AGENT_ID",
    "ELEVENLABS_CONCIERGE_PHONE_NUMBER_ID",
    "ELEVENLABS_AGENT_PHONE_NUMBER_ID",
    "CONCIERGE_PHONE_CALL_CHANNEL_READY",
    "CONCIERGE_PHONE_CALL_CHANNEL_CONFIGURED",
    "CONCIERGE_PHONE_CALL_CHANNEL_VERIFIED",
    "CONCIERGE_EMAIL_CHANNEL_READY",
    "CONCIERGE_EMAIL_CHANNEL_CONFIGURED",
    "CONCIERGE_EMAIL_CHANNEL_VERIFIED",
    "CONCIERGE_WHATSAPP_CHANNEL_READY",
    "CONCIERGE_WHATSAPP_CHANNEL_CONFIGURED",
    "CONCIERGE_WHATSAPP_CHANNEL_VERIFIED",
    "CONCIERGE_FORM_APPLICATION_CHANNEL_READY",
    "CONCIERGE_FORM_APPLICATION_CHANNEL_CONFIGURED",
    "CONCIERGE_FORM_APPLICATION_CHANNEL_VERIFIED",
    "CONCIERGE_DOCUMENT_UPLOAD_CHANNEL_READY",
    "CONCIERGE_DOCUMENT_UPLOAD_CHANNEL_CONFIGURED",
    "CONCIERGE_DOCUMENT_UPLOAD_CHANNEL_VERIFIED",
  ].forEach((key) => {
    delete process.env[key];
  });
}

describe("admin Concierge channel readiness", () => {
  beforeEach(() => {
    resetChannelEnv();
    dbMock.pool.query.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("returns safe channel readiness without exposing secret env values", async () => {
    process.env.ELEVENLABS_API_KEY = "super-secret-elevenlabs-key";
    process.env.ELEVENLABS_CONCIERGE_CALLER_AGENT_ID = "agent-secret";
    process.env.ELEVENLABS_CONCIERGE_PHONE_NUMBER_ID = "phone-secret";
    dbMock.pool.query.mockResolvedValue({ rows: [] });

    const snapshot = await buildAdminConciergeChannelReadinessSnapshot();

    expect(snapshot.channels).toHaveLength(5);
    const phone = snapshot.channels.find((channel) => channel.channel === "phone_call");
    expect(phone).toMatchObject({
      configured: true,
      verified: false,
      ready: false,
      external_action_allowed: false,
    });
    expect(JSON.stringify(snapshot)).not.toContain("super-secret-elevenlabs-key");
    expect(JSON.stringify(snapshot)).not.toContain("agent-secret");
    expect(JSON.stringify(snapshot)).not.toContain("phone-secret");
  });

  it("rejects marking a channel live-ready before setup is configured", async () => {
    dbMock.pool.query.mockResolvedValue({ rows: [] });

    await expect(updateAdminConciergeChannelReadiness({
      channel: "whatsapp",
      verified: true,
      adminEnabled: true,
      updatedBy: "admin-1",
    })).rejects.toThrow(/required setup is configured/i);

    expect(dbMock.pool.query).toHaveBeenCalledTimes(1);
  });

  it("marks a configured and verified channel as live-capable", async () => {
    process.env.CONCIERGE_EMAIL_CHANNEL_CONFIGURED = "true";
    let selectCount = 0;
    dbMock.pool.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("select channel")) {
        selectCount += 1;
        return {
          rows: selectCount === 1 ? [] : [{
            channel: "email",
            admin_enabled: true,
            verified: true,
            notes: "QA inbox verified.",
            updated_by: "admin-1",
            updated_at: new Date("2026-07-16T10:00:00.000Z"),
          }],
        };
      }
      if (sql.includes("insert into concierge_channel_readiness_settings")) {
        expect(params).toEqual(["email", true, true, "QA inbox verified.", "admin-1"]);
        return { rows: [], rowCount: 1 };
      }
      return { rows: [] };
    });

    const row = await updateAdminConciergeChannelReadiness({
      channel: "email",
      verified: true,
      adminEnabled: true,
      notes: "QA inbox verified.",
      updatedBy: "admin-1",
    });

    expect(row).toMatchObject({
      channel: "email",
      configured: true,
      verified: true,
      admin_enabled: true,
      ready: true,
      external_action_allowed: true,
      live: {
        status: "ready",
        external_action_allowed: true,
      },
      test_mode: {
        status: "test_mode",
        external_action_allowed: false,
      },
    });
  });

  it("turns off live-ready when a verified channel is unverified", async () => {
    process.env.CONCIERGE_EMAIL_CHANNEL_CONFIGURED = "true";
    let selectCount = 0;
    dbMock.pool.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("select channel")) {
        selectCount += 1;
        return {
          rows: selectCount === 1 ? [{
            channel: "email",
            admin_enabled: true,
            verified: true,
            notes: "Previously ready.",
            updated_by: "admin-1",
            updated_at: new Date("2026-07-16T10:00:00.000Z"),
          }] : [{
            channel: "email",
            admin_enabled: false,
            verified: false,
            notes: "Previously ready.",
            updated_by: "admin-1",
            updated_at: new Date("2026-07-16T10:05:00.000Z"),
          }],
        };
      }
      if (sql.includes("insert into concierge_channel_readiness_settings")) {
        expect(params).toEqual(["email", false, false, "Previously ready.", "admin-1"]);
        return { rows: [], rowCount: 1 };
      }
      return { rows: [] };
    });

    const row = await updateAdminConciergeChannelReadiness({
      channel: "email",
      verified: false,
      updatedBy: "admin-1",
    });

    expect(row).toMatchObject({
      channel: "email",
      configured: true,
      verified: false,
      admin_enabled: false,
      ready: false,
      external_action_allowed: false,
      live: {
        status: "disabled",
        external_action_allowed: false,
      },
    });
  });
});
