import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  conciergeToolForProductionChannel,
  evaluateConciergeChannelReadiness,
  type ConciergeProductionChannel,
} from "../../shared/conciergeChannelReadiness.js";
import {
  executeConciergeActionAdapter,
  runConciergeActionAdapterProbe,
} from "./conciergeActionAdapters.js";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

type ChannelSpec = {
  channel: ConciergeProductionChannel;
  configuredEnv: string;
  qaEnv: string;
  qaTarget: string;
  liveEnv?: string;
  liveTarget?: string;
  payload: Record<string, unknown>;
  providerPhone?: string | null;
};

const channelSpecs: ChannelSpec[] = [
  {
    channel: "phone_call",
    configuredEnv: "CONCIERGE_PHONE_CALL_CHANNEL_CONFIGURED",
    qaEnv: "CONCIERGE_PHONE_CALL_QA_PHONE_NUMBER",
    qaTarget: "+12025550100",
    payload: { execution_channel: "phone" },
    providerPhone: "+12025550100",
  },
  {
    channel: "email",
    configuredEnv: "CONCIERGE_EMAIL_CHANNEL_CONFIGURED",
    qaEnv: "CONCIERGE_EMAIL_QA_RECIPIENT",
    qaTarget: "concierge@example.test",
    liveEnv: "CONCIERGE_EMAIL_LIVE_ENDPOINT",
    liveTarget: "https://adapter.example.test/email",
    payload: { execution_channel: "email", provider_email: "concierge@example.test", email_body: "Hello" },
  },
  {
    channel: "whatsapp",
    configuredEnv: "CONCIERGE_WHATSAPP_CHANNEL_CONFIGURED",
    qaEnv: "CONCIERGE_WHATSAPP_QA_PHONE_NUMBER",
    qaTarget: "+12025550101",
    liveEnv: "CONCIERGE_WHATSAPP_LIVE_ENDPOINT",
    liveTarget: "https://adapter.example.test/whatsapp",
    payload: { execution_channel: "whatsapp", provider_whatsapp: "+12025550101", whatsapp_message: "Hello" },
  },
  {
    channel: "form_application",
    configuredEnv: "CONCIERGE_FORM_APPLICATION_CHANNEL_CONFIGURED",
    qaEnv: "CONCIERGE_FORM_APPLICATION_QA_URL",
    qaTarget: "https://forms.example.test/booking",
    liveEnv: "CONCIERGE_FORM_APPLICATION_LIVE_ENDPOINT",
    liveTarget: "https://adapter.example.test/form",
    payload: { execution_channel: "booking_url", booking_url: "https://forms.example.test/booking" },
  },
  {
    channel: "document_upload",
    configuredEnv: "CONCIERGE_DOCUMENT_UPLOAD_CHANNEL_CONFIGURED",
    qaEnv: "CONCIERGE_DOCUMENT_UPLOAD_QA_URL",
    qaTarget: "qa://document-upload",
    liveEnv: "CONCIERGE_DOCUMENT_UPLOAD_LIVE_ENDPOINT",
    liveTarget: "https://adapter.example.test/upload",
    payload: { execution_channel: "camera_or_upload", uploaded_document: "qa://document-upload" },
  },
];

function clearConciergeEnv() {
  process.env = { ...originalEnv };
  [
    "ELEVENLABS_API_KEY",
    "ELEVENLABS_CONCIERGE_CALLER_AGENT_ID",
    "ELEVENLABS_CONCIERGE_PHONE_NUMBER_ID",
    "CONCIERGE_PHONE_CALL_CHANNEL_CONFIGURED",
    "CONCIERGE_EMAIL_CHANNEL_CONFIGURED",
    "CONCIERGE_WHATSAPP_CHANNEL_CONFIGURED",
    "CONCIERGE_FORM_APPLICATION_CHANNEL_CONFIGURED",
    "CONCIERGE_DOCUMENT_UPLOAD_CHANNEL_CONFIGURED",
    "CONCIERGE_PHONE_CALL_QA_PHONE_NUMBER",
    "CONCIERGE_EMAIL_QA_RECIPIENT",
    "CONCIERGE_WHATSAPP_QA_PHONE_NUMBER",
    "CONCIERGE_FORM_APPLICATION_QA_URL",
    "CONCIERGE_DOCUMENT_UPLOAD_QA_URL",
    "CONCIERGE_EMAIL_LIVE_ENDPOINT",
    "CONCIERGE_WHATSAPP_LIVE_ENDPOINT",
    "CONCIERGE_FORM_APPLICATION_LIVE_ENDPOINT",
    "CONCIERGE_DOCUMENT_UPLOAD_LIVE_ENDPOINT",
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

function readiness(spec: ChannelSpec, flags: { adminEnabled?: boolean; configured?: boolean; verified?: boolean } = {}) {
  return evaluateConciergeChannelReadiness({
    tool: conciergeToolForProductionChannel(spec.channel),
    dryRun: false,
    flags: {
      [spec.channel]: {
        adminEnabled: flags.adminEnabled ?? true,
        configured: flags.configured ?? true,
        verified: flags.verified ?? true,
      },
    },
  });
}

function adapterInput(spec: ChannelSpec, overrides: Record<string, unknown> = {}) {
  return {
    mode: "live" as const,
    tool: conciergeToolForProductionChannel(spec.channel),
    payload: spec.payload,
    providerName: "QA Provider",
    providerPhone: spec.providerPhone ?? null,
    pendingId: "pending-1",
    userId: "user-1",
    summary: "QA Concierge action",
    userConfirmed: true,
    dryRun: false,
    channelReadiness: readiness(spec),
    ...overrides,
  };
}

describe("Concierge action adapters", () => {
  beforeEach(() => {
    clearConciergeEnv();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("supports safe QA probes for every live-capable channel without external contact", () => {
    for (const spec of channelSpecs) {
      process.env[spec.qaEnv] = spec.qaTarget;
      const result = runConciergeActionAdapterProbe({
        channel: spec.channel,
        configured: true,
      });

      expect(result, spec.channel).toEqual({ status: "pass", blocker: null });
    }

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("simulates every channel in dry-run mode without contacting providers", async () => {
    for (const spec of channelSpecs) {
      const result = await executeConciergeActionAdapter(adapterInput(spec, {
        mode: "dry_run",
        dryRun: true,
      }));

      expect(result, spec.channel).toMatchObject({
        adapter: `concierge_${spec.channel}_adapter`,
        mode: "dry_run",
        channel: spec.channel,
        status: "simulated",
        result: "simulated",
        external_action_allowed: false,
      });
    }

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("blocks every live adapter before external contact when confirmation or readiness is missing", async () => {
    for (const spec of channelSpecs) {
      const result = await executeConciergeActionAdapter(adapterInput(spec, {
        userConfirmed: false,
        channelReadiness: readiness(spec, { verified: false }),
      }));

      expect(result, spec.channel).toMatchObject({
        mode: "live",
        channel: spec.channel,
        status: "blocked",
        result: "blocked",
        blocker: "user_confirmation_required",
        external_action_allowed: false,
      });
    }

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("blocks every live adapter before external contact when the payload contract is incomplete", async () => {
    for (const spec of channelSpecs) {
      vi.mocked(globalThis.fetch).mockReset();
      if (spec.liveEnv && spec.liveTarget) process.env[spec.liveEnv] = spec.liveTarget;

      const result = await executeConciergeActionAdapter(adapterInput(spec, {
        payload: { execution_channel: spec.channel },
        providerPhone: null,
      }));

      expect(result, spec.channel).toMatchObject({
        mode: "live",
        channel: spec.channel,
        status: "blocked",
        result: "blocked",
        external_action_allowed: false,
      });
      expect(result.blocker, spec.channel).toContain("adapter_payload_contract_incomplete");
      expect(result.blocker, spec.channel).toContain("adapter_payload_missing_provider_contact");
      expect(globalThis.fetch, spec.channel).not.toHaveBeenCalled();
    }
  });

  it("sends live email through the owned pilot adapter only after confirmation", async () => {
    const spec = channelSpecs.find((item) => item.channel === "email");
    if (!spec) throw new Error("Missing email channel spec");
    process.env.CONCIERGE_EMAIL_OWNED_ADAPTER_ENABLED = "true";
    process.env.CONCIERGE_EMAIL_PILOT_RECIPIENTS = "pilot-inbox@vyva.life";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "concierge@vyva.life";

    const unconfirmed = await executeConciergeActionAdapter(adapterInput(spec, {
      userConfirmed: false,
      payload: {
        execution_channel: "email",
        provider_email: "pilot-inbox@vyva.life",
        email_subject: "Pilot appointment request",
        email_body: "Please confirm this controlled pilot request.",
      },
    }));

    expect(unconfirmed).toMatchObject({
      status: "blocked",
      blocker: "user_confirmation_required",
      external_action_allowed: false,
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(JSON.stringify({ id: "resend-email-1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const result = await executeConciergeActionAdapter(adapterInput(spec, {
      payload: {
        execution_channel: "email",
        provider_email: "pilot-inbox@vyva.life",
        email_subject: "Pilot appointment request",
        email_body: "Please confirm this controlled pilot request.",
      },
    }));

    expect(result).toMatchObject({
      adapter: "concierge_email_adapter",
      mode: "live",
      channel: "email",
      status: "sent",
      result: "sent",
      result_id: "resend-email-1",
      external_action_allowed: true,
      provider_contact: "pilot-inbox@vyva.life",
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer re_test_key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: "VYVA <concierge@vyva.life>",
      to: ["pilot-inbox@vyva.life"],
      subject: "Pilot appointment request",
      reply_to: "concierge@vyva.life",
    });
    expect(String(JSON.parse(String(init.body)).text)).toContain("Sent by VYVA Concierge after explicit user confirmation.");
  });

  it("blocks the owned email pilot adapter before provider contact when the recipient is outside the allowlist", async () => {
    const spec = channelSpecs.find((item) => item.channel === "email");
    if (!spec) throw new Error("Missing email channel spec");
    process.env.CONCIERGE_EMAIL_OWNED_ADAPTER_ENABLED = "true";
    process.env.CONCIERGE_EMAIL_PILOT_RECIPIENTS = "pilot-inbox@vyva.life";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "concierge@vyva.life";

    const result = await executeConciergeActionAdapter(adapterInput(spec, {
      payload: {
        execution_channel: "email",
        provider_email: "real-clinic@example.org",
        email_subject: "Pilot appointment request",
        email_body: "Please confirm this controlled pilot request.",
      },
    }));

    expect(result).toMatchObject({
      mode: "live",
      channel: "email",
      status: "blocked",
      result: "blocked",
      blocker: "pilot_email_recipient_not_allowlisted",
      external_action_allowed: false,
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("returns failed live results for every channel when the live provider request fails", async () => {
    for (const spec of channelSpecs) {
      vi.mocked(globalThis.fetch).mockReset();
      if (spec.channel === "phone_call") {
        process.env.ELEVENLABS_API_KEY = "test-key";
        process.env.ELEVENLABS_CONCIERGE_CALLER_AGENT_ID = "agent-id";
        process.env.ELEVENLABS_CONCIERGE_PHONE_NUMBER_ID = "phone-id";
        vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response("upstream down", { status: 502 }));
      } else if (spec.liveEnv && spec.liveTarget) {
        process.env[spec.liveEnv] = spec.liveTarget;
        vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(JSON.stringify({ message: "adapter failed" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }));
      }

      const result = await executeConciergeActionAdapter(adapterInput(spec));

      expect(result, spec.channel).toMatchObject({
        mode: "live",
        channel: spec.channel,
        status: "failed",
        result: "failed",
        external_action_allowed: true,
      });
      expect(result.error, spec.channel).toBeTruthy();
      expect(globalThis.fetch, spec.channel).toHaveBeenCalledTimes(1);
    }
  });

  it("returns successful live results for every channel through the adapter backplane", async () => {
    for (const spec of channelSpecs) {
      vi.mocked(globalThis.fetch).mockReset();
      if (spec.channel === "phone_call") {
        process.env.ELEVENLABS_API_KEY = "test-key";
        process.env.ELEVENLABS_CONCIERGE_CALLER_AGENT_ID = "agent-id";
        process.env.ELEVENLABS_CONCIERGE_PHONE_NUMBER_ID = "phone-id";
        vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(JSON.stringify({
          conversation_id: "conv-1",
          message: "Outbound concierge call started.",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }));
      } else if (spec.liveEnv && spec.liveTarget) {
        process.env[spec.liveEnv] = spec.liveTarget;
        vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response(JSON.stringify({
          id: `${spec.channel}-result-1`,
          result: "sent",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }));
      }

      const result = await executeConciergeActionAdapter(adapterInput(spec));

      expect(result, spec.channel).toMatchObject({
        adapter: `concierge_${spec.channel}_adapter`,
        mode: "live",
        channel: spec.channel,
        status: "sent",
        external_action_allowed: true,
        provider_name: "QA Provider",
      });
      expect(result.result_id, spec.channel).toBeTruthy();
      expect(globalThis.fetch, spec.channel).toHaveBeenCalledTimes(1);
    }
  });
});
