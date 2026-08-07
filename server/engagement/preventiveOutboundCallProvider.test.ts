import { describe, expect, it, vi } from "vitest";
import {
  createPreventiveOutboundCallProvider,
  PREVENTIVE_OUTBOUND_CALL_AGENT_CONTRACT,
  resolvePreventiveOutboundCallProviderConfig,
} from "./preventiveOutboundCallProvider.js";
import {
  validPreventiveOutboundCallEnv,
  validPreventiveOutboundCallPhone,
} from "./preventiveOutboundCallFixtures.js";

describe("Task 11 preventive outbound call provider", () => {
  it("requires dedicated preventive configuration and does not infer Concierge or callback agents", () => {
    const env = validPreventiveOutboundCallEnv({
      VYVA_PREVENTIVE_OUTBOUND_CALL_ELEVENLABS_AGENT_ID: undefined,
      ELEVENLABS_CONCIERGE_CALLER_AGENT_ID: "agent.concierge",
      ELEVENLABS_CALLBACK_ONBOARDING_AGENT_ID: "agent.callback",
    });
    expect(resolvePreventiveOutboundCallProviderConfig(env)).toEqual({
      ok: false,
      reason: "missing",
    });
  });

  it("starts an ElevenLabs ConvAI Twilio outbound call with minimized metadata only", async () => {
    const resolved = resolvePreventiveOutboundCallProviderConfig(validPreventiveOutboundCallEnv());
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) throw new Error("invalid test config");
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      conversation_id: "conv.task11",
      callSid: "CA11111111111111111111111111111111",
    }), { status: 201 }));
    const provider = createPreventiveOutboundCallProvider({
      config: resolved.config,
      fetcher: fetcher as typeof fetch,
    });
    const token = "a".repeat(43);
    const result = await provider.start({
      callAttemptId: "attempt.task11",
      phoneE164: validPreventiveOutboundCallPhone,
      confirmationToken: token,
      callbackUrl: "https://vyva.example.com/api/preventive-outbound-call/elevenlabs/confirm",
    });
    expect(result).toMatchObject({
      outcome: "started",
      providerConversationId: "conv.task11",
      twilioCallSid: "CA11111111111111111111111111111111",
    });
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      agent_id: "agent.preventive.task11",
      agent_phone_number_id: "phone.preventive.task11",
      to_number: validPreventiveOutboundCallPhone,
      call_recording_enabled: false,
    });
    expect(body.conversation_initiation_client_data.dynamic_variables).toEqual({
      preventive_call_attempt_id: "attempt.task11",
      [PREVENTIVE_OUTBOUND_CALL_AGENT_CONTRACT.secretConfirmationTokenVariable]: token,
      preventive_call_confirmation_url: "https://vyva.example.com/api/preventive-outbound-call/elevenlabs/confirm",
    });
    expect(PREVENTIVE_OUTBOUND_CALL_AGENT_CONTRACT.confirmationTokenHeaderName)
      .toBe("X-VYVA-Preventive-Call-Token");
    expect(body.conversation_initiation_client_data.dynamic_variables)
      .not.toHaveProperty("preventive_call_confirmation_token");
    expect(JSON.stringify(body).match(new RegExp(token, "g"))).toHaveLength(1);
    expect(JSON.stringify(body)).not.toMatch(/symptom|medication|diagnosis|transcript/i);
  });

  it("fails uncertain when the provider omits mandatory correlation identifiers and ignores recording fields", async () => {
    const resolved = resolvePreventiveOutboundCallProviderConfig(validPreventiveOutboundCallEnv());
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) throw new Error("invalid test config");
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      conversation_id: "conv.task11",
      recording_url: "https://recordings.example.invalid/raw.mp3",
      transcript: "raw transcript must not be retained",
    }), { status: 201 }));
    const provider = createPreventiveOutboundCallProvider({
      config: resolved.config,
      fetcher: fetcher as typeof fetch,
    });
    await expect(provider.start({
      callAttemptId: "attempt.task11",
      phoneE164: validPreventiveOutboundCallPhone,
      confirmationToken: "a".repeat(43),
      callbackUrl: "https://vyva.example.com/api/preventive-outbound-call/elevenlabs/confirm",
    })).resolves.toMatchObject({
      outcome: "delivery_uncertain",
      reason: "provider_missing_required_correlation",
    });
  });

  it("cancels only the exact Twilio call Sid through the Twilio provider API", async () => {
    const resolved = resolvePreventiveOutboundCallProviderConfig(validPreventiveOutboundCallEnv());
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) throw new Error("invalid test config");
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 }));
    const provider = createPreventiveOutboundCallProvider({
      config: resolved.config,
      fetcher: fetcher as typeof fetch,
    });
    await expect(provider.cancel?.({
      twilioCallSid: "CA11111111111111111111111111111111",
      providerConversationId: "conv.task11",
    })).resolves.toEqual({ outcome: "cancel_requested" });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("/Calls/CA11111111111111111111111111111111.json");
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe("Status=canceled");
  });
});
