import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock("../db.js", () => dbMock);

import {
  buildAdminConciergeChannelReadinessSnapshot,
  runAdminConciergeChannelVerificationProbe,
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
    "CONCIERGE_EMAIL_LIVE_ENDPOINT",
    "CONCIERGE_WHATSAPP_LIVE_ENDPOINT",
    "CONCIERGE_FORM_APPLICATION_LIVE_ENDPOINT",
    "CONCIERGE_DOCUMENT_UPLOAD_LIVE_ENDPOINT",
    "CONCIERGE_PHONE_CALL_QA_ENDPOINT",
    "CONCIERGE_PHONE_CALL_QA_PHONE_NUMBER",
    "CONCIERGE_EMAIL_QA_ENDPOINT",
    "CONCIERGE_EMAIL_QA_RECIPIENT",
    "CONCIERGE_WHATSAPP_QA_ENDPOINT",
    "CONCIERGE_WHATSAPP_QA_PHONE_NUMBER",
    "CONCIERGE_FORM_APPLICATION_QA_ENDPOINT",
    "CONCIERGE_FORM_APPLICATION_QA_URL",
    "CONCIERGE_DOCUMENT_UPLOAD_QA_ENDPOINT",
    "CONCIERGE_DOCUMENT_UPLOAD_QA_URL",
    "CONCIERGE_EMAIL_OWNED_ADAPTER_ENABLED",
    "CONCIERGE_EMAIL_INTERNAL_ADAPTER_ENABLED",
    "CONCIERGE_EMAIL_PILOT_RECIPIENTS",
    "CONCIERGE_EMAIL_PILOT_RECIPIENT",
    "CONCIERGE_EMAIL_PILOT_ALLOWLIST",
    "CONCIERGE_EMAIL_LIVE_ALLOWLIST",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "NOTIFY_FROM_EMAIL",
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
      adapter_setup: {
        configured: true,
        source: "environment",
        credential_reference: "ELEVENLABS_API_KEY",
      },
      probe: {
        status: "not_run",
      },
    });
    expect(JSON.stringify(snapshot)).not.toContain("super-secret-elevenlabs-key");
    expect(JSON.stringify(snapshot)).not.toContain("agent-secret");
    expect(JSON.stringify(snapshot)).not.toContain("phone-secret");
  });

  it("returns owned email pilot readiness without exposing provider secrets or pilot inboxes", async () => {
    process.env.CONCIERGE_EMAIL_OWNED_ADAPTER_ENABLED = "true";
    process.env.RESEND_API_KEY = "re_super_secret";
    process.env.RESEND_FROM_EMAIL = "concierge@vyva.life";
    process.env.CONCIERGE_EMAIL_PILOT_RECIPIENTS = "pilot-inbox@vyva.life";
    process.env.CONCIERGE_EMAIL_QA_RECIPIENT = "concierge@example.test";
    dbMock.pool.query.mockResolvedValue({ rows: [] });

    const snapshot = await buildAdminConciergeChannelReadinessSnapshot();
    const email = snapshot.channels.find((channel) => channel.channel === "email");

    expect(email).toMatchObject({
      configured: true,
      verified: false,
      ready: false,
      external_action_allowed: false,
      adapter_setup: {
        configured: true,
        source: "environment",
        live_endpoint_configured: true,
        live_endpoint_url: null,
        live_endpoint_reference: "CONCIERGE_EMAIL_OWNED_ADAPTER_ENABLED",
        credential_reference: "RESEND_API_KEY",
        qa_target_configured: true,
        qa_target: null,
        qa_target_reference: "CONCIERGE_EMAIL_QA_RECIPIENT",
      },
      probe: {
        status: "not_run",
      },
    });
    expect(JSON.stringify(snapshot)).not.toContain("re_super_secret");
    expect(JSON.stringify(snapshot)).not.toContain("pilot-inbox@vyva.life");
  });

  it("rejects marking a channel live-ready before setup is configured", async () => {
    dbMock.pool.query.mockResolvedValue({ rows: [] });

    await expect(updateAdminConciergeChannelReadiness({
      channel: "whatsapp",
      adminEnabled: true,
      updatedBy: "admin-1",
    })).rejects.toThrow(/required setup has not been configured/i);

    expect(dbMock.pool.query).toHaveBeenCalledTimes(1);
  });

  it("stores adapter setup references without marking the channel live-ready", async () => {
    let selectCount = 0;
    dbMock.pool.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (/select\s+channel/i.test(sql)) {
        selectCount += 1;
        return {
          rows: selectCount === 1 ? [] : [{
            channel: "whatsapp",
            admin_enabled: false,
            verified: false,
            notes: "Use WhatsApp adapter.",
            last_probe_status: null,
            last_probe_at: null,
            last_probe_blocker: "Verification reset after adapter setup changed.",
            last_probe_by: "admin-1",
            adapter_live_endpoint_url: "https://adapter.example.test/whatsapp",
            adapter_credential_reference: "vault/vyva/whatsapp-adapter",
            adapter_qa_target: "+12025550101",
            adapter_configured_by: "admin-1",
            adapter_configured_at: new Date("2026-07-16T10:05:00.000Z"),
            updated_by: "admin-1",
            updated_at: new Date("2026-07-16T10:05:00.000Z"),
          }],
        };
      }
      if (sql.includes("insert into concierge_channel_readiness_settings")) {
        expect(params).toEqual([
          "whatsapp",
          false,
          false,
          "Use WhatsApp adapter.",
          null,
          null,
          "Verification reset after adapter setup changed.",
          "admin-1",
          "https://adapter.example.test/whatsapp",
          "vault/vyva/whatsapp-adapter",
          "+12025550101",
          "admin-1",
          expect.any(String),
          "admin-1",
        ]);
        return { rows: [], rowCount: 1 };
      }
      return { rows: [] };
    });

    const row = await updateAdminConciergeChannelReadiness({
      channel: "whatsapp",
      notes: "Use WhatsApp adapter.",
      adapterLiveEndpointUrl: "https://adapter.example.test/whatsapp",
      adapterCredentialReference: "vault/vyva/whatsapp-adapter",
      adapterQaTarget: "+12025550101",
      updatedBy: "admin-1",
    });

    expect(row).toMatchObject({
      channel: "whatsapp",
      configured: true,
      verified: false,
      admin_enabled: false,
      ready: false,
      external_action_allowed: false,
      adapter_setup: {
        configured: true,
        source: "admin_console",
        live_endpoint_url: "https://adapter.example.test/whatsapp",
        credential_reference: "vault/vyva/whatsapp-adapter",
        qa_target: "+12025550101",
      },
      probe: {
        status: "not_run",
        blocker: "Run a safe QA verification probe before enabling live actions.",
      },
    });
    expect(JSON.stringify(row)).not.toContain("super-secret");
  });

  it("rejects secret-like credential values in adapter setup", async () => {
    dbMock.pool.query.mockResolvedValue({ rows: [] });

    await expect(updateAdminConciergeChannelReadiness({
      channel: "email",
      adapterCredentialReference: "Bearer sk-live-secret",
      updatedBy: "admin-1",
    })).rejects.toThrow(/reference name only/i);
  });

  it("runs probes against stored adapter QA targets", async () => {
    let selectCount = 0;
    dbMock.pool.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (/select\s+channel/i.test(sql)) {
        selectCount += 1;
        return {
          rows: selectCount === 1 ? [{
            channel: "email",
            admin_enabled: false,
            verified: false,
            notes: "Stored adapter config.",
            last_probe_status: null,
            last_probe_at: null,
            last_probe_blocker: null,
            last_probe_by: null,
            adapter_live_endpoint_url: "https://adapter.example.test/email",
            adapter_credential_reference: "vault/vyva/email-adapter",
            adapter_qa_target: "concierge@example.test",
            adapter_configured_by: "admin-1",
            adapter_configured_at: new Date("2026-07-16T10:05:00.000Z"),
            updated_by: "admin-1",
            updated_at: new Date("2026-07-16T10:05:00.000Z"),
          }] : [{
            channel: "email",
            admin_enabled: false,
            verified: true,
            notes: "Stored adapter config.",
            last_probe_status: "pass",
            last_probe_at: new Date("2026-07-16T10:10:00.000Z"),
            last_probe_blocker: null,
            last_probe_by: "admin-1",
            adapter_live_endpoint_url: "https://adapter.example.test/email",
            adapter_credential_reference: "vault/vyva/email-adapter",
            adapter_qa_target: "concierge@example.test",
            adapter_configured_by: "admin-1",
            adapter_configured_at: new Date("2026-07-16T10:05:00.000Z"),
            updated_by: "admin-1",
            updated_at: new Date("2026-07-16T10:10:00.000Z"),
          }],
        };
      }
      if (sql.includes("insert into concierge_channel_readiness_settings")) {
        expect(params).toEqual([
          "email",
          false,
          true,
          "Stored adapter config.",
          "pass",
          expect.any(String),
          null,
          "admin-1",
          "admin-1",
        ]);
        return { rows: [], rowCount: 1 };
      }
      return { rows: [] };
    });

    const row = await runAdminConciergeChannelVerificationProbe({
      channel: "email",
      updatedBy: "admin-1",
    });

    expect(row).toMatchObject({
      channel: "email",
      configured: true,
      verified: true,
      admin_enabled: false,
      can_mark_ready: true,
      adapter_setup: {
        source: "admin_console",
        qa_target: "concierge@example.test",
      },
      probe: {
        status: "pass",
        blocker: null,
      },
    });
  });

  it("records a failed probe and keeps live-ready blocked for unsafe QA targets", async () => {
    process.env.CONCIERGE_EMAIL_LIVE_ENDPOINT = "https://adapter.example.test/email";
    process.env.CONCIERGE_EMAIL_QA_RECIPIENT = "clinic@gmail.com";
    let selectCount = 0;
    dbMock.pool.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (/select\s+channel/i.test(sql)) {
        selectCount += 1;
        return {
          rows: selectCount === 1 ? [] : [{
            channel: "email",
            admin_enabled: false,
            verified: false,
            notes: null,
            last_probe_status: "fail",
            last_probe_at: new Date("2026-07-16T09:55:00.000Z"),
            last_probe_blocker: "The configured reserved QA email inbox is not a reserved test endpoint, so no probe was run.",
            last_probe_by: "admin-1",
            updated_by: "admin-1",
            updated_at: new Date("2026-07-16T10:00:00.000Z"),
          }],
        };
      }
      if (sql.includes("insert into concierge_channel_readiness_settings")) {
        expect(params).toEqual([
          "email",
          false,
          false,
          null,
          "fail",
          expect.any(String),
          "The configured reserved QA email inbox is not a reserved test endpoint, so no probe was run.",
          "admin-1",
          "admin-1",
        ]);
        return { rows: [], rowCount: 1 };
      }
      return { rows: [] };
    });

    const row = await runAdminConciergeChannelVerificationProbe({
      channel: "email",
      updatedBy: "admin-1",
    });

    expect(row).toMatchObject({
      channel: "email",
      configured: true,
      verified: false,
      admin_enabled: false,
      ready: false,
      external_action_allowed: false,
      can_mark_ready: false,
      probe: {
        status: "fail",
        blocker: expect.stringContaining("not a reserved test endpoint"),
      },
    });
  });

  it("runs safe QA probes for every production channel without enabling live contact", async () => {
    const channels = [
      {
        channel: "phone_call" as const,
        configuredEnv: "ELEVENLABS_API_KEY",
        extraConfiguredEnv: [
          ["ELEVENLABS_CONCIERGE_CALLER_AGENT_ID", "agent-id"],
          ["ELEVENLABS_CONCIERGE_PHONE_NUMBER_ID", "phone-id"],
        ],
        qaEnv: "CONCIERGE_PHONE_CALL_QA_PHONE_NUMBER",
        qaTarget: "+12025550100",
      },
      {
        channel: "email" as const,
        configuredEnv: "CONCIERGE_EMAIL_LIVE_ENDPOINT",
        qaEnv: "CONCIERGE_EMAIL_QA_RECIPIENT",
        qaTarget: "concierge@example.test",
      },
      {
        channel: "whatsapp" as const,
        configuredEnv: "CONCIERGE_WHATSAPP_LIVE_ENDPOINT",
        qaEnv: "CONCIERGE_WHATSAPP_QA_PHONE_NUMBER",
        qaTarget: "+12025550101",
      },
      {
        channel: "form_application" as const,
        configuredEnv: "CONCIERGE_FORM_APPLICATION_LIVE_ENDPOINT",
        qaEnv: "CONCIERGE_FORM_APPLICATION_QA_URL",
        qaTarget: "https://concierge-form.test/booking",
      },
      {
        channel: "document_upload" as const,
        configuredEnv: "CONCIERGE_DOCUMENT_UPLOAD_LIVE_ENDPOINT",
        qaEnv: "CONCIERGE_DOCUMENT_UPLOAD_QA_URL",
        qaTarget: "qa://document-upload",
      },
    ];

    for (const item of channels) {
      resetChannelEnv();
      process.env[item.configuredEnv] = item.channel === "phone_call" ? "test-key" : `https://adapter.example.test/${item.channel}`;
      item.extraConfiguredEnv?.forEach(([key, value]) => {
        process.env[key] = value;
      });
      process.env[item.qaEnv] = item.qaTarget;
      dbMock.pool.query.mockReset();
      let selectCount = 0;
      dbMock.pool.query.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (/select\s+channel/i.test(sql)) {
          selectCount += 1;
          return {
            rows: selectCount === 1 ? [] : [{
              channel: item.channel,
              admin_enabled: false,
              verified: true,
              notes: null,
              last_probe_status: "pass",
              last_probe_at: new Date("2026-07-16T09:55:00.000Z"),
              last_probe_blocker: null,
              last_probe_by: "admin-1",
              updated_by: "admin-1",
              updated_at: new Date("2026-07-16T10:00:00.000Z"),
            }],
          };
        }
        if (sql.includes("insert into concierge_channel_readiness_settings")) {
          expect(params).toEqual([
            item.channel,
            false,
            true,
            null,
            "pass",
            expect.any(String),
            null,
            "admin-1",
            "admin-1",
          ]);
          return { rows: [], rowCount: 1 };
        }
        return { rows: [] };
      });

      const row = await runAdminConciergeChannelVerificationProbe({
        channel: item.channel,
        updatedBy: "admin-1",
      });

      expect(row, item.channel).toMatchObject({
        channel: item.channel,
        configured: true,
        verified: true,
        admin_enabled: false,
        ready: false,
        external_action_allowed: false,
        can_mark_ready: true,
        probe: {
          status: "pass",
          blocker: null,
        },
      });
    }
  });

  it("marks a configured channel live-capable after its latest probe passed", async () => {
    process.env.CONCIERGE_EMAIL_LIVE_ENDPOINT = "https://adapter.example.test/email";
    let selectCount = 0;
    dbMock.pool.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (/select\s+channel/i.test(sql)) {
        selectCount += 1;
        return {
          rows: selectCount === 1 ? [{
            channel: "email",
            admin_enabled: false,
            verified: true,
            notes: "QA inbox verified.",
            last_probe_status: "pass",
            last_probe_at: new Date("2026-07-16T09:55:00.000Z"),
            last_probe_blocker: null,
            last_probe_by: "admin-1",
            updated_by: "admin-1",
            updated_at: new Date("2026-07-16T10:00:00.000Z"),
          }] : [{
            channel: "email",
            admin_enabled: true,
            verified: true,
            notes: "QA inbox verified.",
            last_probe_status: "pass",
            last_probe_at: new Date("2026-07-16T09:55:00.000Z"),
            last_probe_blocker: null,
            last_probe_by: "admin-1",
            updated_by: "admin-1",
            updated_at: new Date("2026-07-16T10:00:00.000Z"),
          }],
        };
      }
      if (sql.includes("insert into concierge_channel_readiness_settings")) {
        expect(params).toEqual([
          "email",
          true,
          true,
          "QA inbox verified.",
          "pass",
          "2026-07-16T09:55:00.000Z",
          null,
          "admin-1",
          null,
          null,
          null,
          null,
          null,
          "admin-1",
        ]);
        return { rows: [], rowCount: 1 };
      }
      return { rows: [] };
    });

    const row = await updateAdminConciergeChannelReadiness({
      channel: "email",
      adminEnabled: true,
      updatedBy: "admin-1",
    });

    expect(row).toMatchObject({
      channel: "email",
      configured: true,
      verified: true,
      admin_enabled: true,
      ready: true,
      external_action_allowed: true,
      can_mark_ready: true,
      probe: {
        status: "pass",
        checked_at: "2026-07-16T09:55:00.000Z",
        blocker: null,
      },
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
    process.env.CONCIERGE_EMAIL_LIVE_ENDPOINT = "https://adapter.example.test/email";
    let selectCount = 0;
    dbMock.pool.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (/select\s+channel/i.test(sql)) {
        selectCount += 1;
        return {
          rows: selectCount === 1 ? [{
          channel: "email",
          admin_enabled: true,
          verified: true,
          notes: "Previously ready.",
          last_probe_status: "pass",
          last_probe_at: new Date("2026-07-16T10:00:00.000Z"),
          last_probe_blocker: null,
          last_probe_by: "admin-1",
          updated_by: "admin-1",
          updated_at: new Date("2026-07-16T10:00:00.000Z"),
        }] : [{
          channel: "email",
          admin_enabled: false,
          verified: false,
          notes: "Previously ready.",
          last_probe_status: null,
          last_probe_at: null,
          last_probe_blocker: "Verification reset by admin.",
          last_probe_by: "admin-1",
          updated_by: "admin-1",
          updated_at: new Date("2026-07-16T10:05:00.000Z"),
        }],
        };
      }
      if (sql.includes("insert into concierge_channel_readiness_settings")) {
        expect(params).toEqual([
          "email",
          false,
          false,
          "Previously ready.",
          null,
          null,
          "Verification reset by admin.",
          "admin-1",
          null,
          null,
          null,
          null,
          null,
          "admin-1",
        ]);
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
