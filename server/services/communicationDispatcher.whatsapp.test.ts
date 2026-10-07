import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../db.js", () => ({ db: {} }));
vi.mock("./callbackOnboarding.js", () => ({ queueDueCallbackOnboardingCalls: vi.fn() }));
vi.mock("./cognitiveAssessmentReminders.js", () => ({ queueDueCognitiveAssessmentReminders: vi.fn() }));
vi.mock("./lifecycle.js", () => ({ queueDueConsentCalls: vi.fn() }));
import { buildWhatsappMessageParams, sendWhatsapp } from "./communicationDispatcher.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it.each([
  ["", "", "", "whatsapp:+12025550100", null],
  ["whatsapp:+12025550102", "", "", "whatsapp:+12025550102", null],
  ["", "+12025550103", "", "whatsapp:+12025550103", null],
  ["", "", "MG-test", null, "MG-test"],
])("resolves WhatsApp sender precedence (%s, %s, %s)", async (primary, alternate, service, expectedFrom, expectedService) => {
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC-test");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "test-token");
  vi.stubEnv("TWILIO_FROM_NUMBER", "+12025550100");
  vi.stubEnv("TWILIO_WHATSAPP_FROM", primary);
  vi.stubEnv("TWILIO_WHATSAPP_FROM_NUMBER", alternate);
  vi.stubEnv("TWILIO_WHATSAPP_MESSAGING_SERVICE_SID", service);
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sid: "SM-test", status: "queued" }) });
  vi.stubGlobal("fetch", fetchMock);
  await sendWhatsapp(communication());
  const params = new URLSearchParams(fetchMock.mock.calls[0][1].body);
  expect(params.get("From")).toBe(expectedFrom);
  expect(params.get("MessagingServiceSid")).toBe(expectedService);
});

function communication(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    intake_id: null,
    user_id: null,
    channel: "whatsapp",
    recipient: "+34600111222",
    purpose: "private_checkin",
    status: "queued",
    provider_message_id: null,
    body: "Neutral fallback",
    metadata: {},
    sent_at: null,
    created_at: new Date(),
    ...overrides,
  } as never;
}

describe("WhatsApp dispatcher content templates", () => {
  it("uses ContentSid and opaque variables without also sending Body", () => {
    const params = buildWhatsappMessageParams(communication({
      metadata: {
        content_sid: "HX123",
        content_variables: { "1": "opaque-ticket" },
      },
    }));
    expect(params.get("To")).toBe("whatsapp:+34600111222");
    expect(params.get("ContentSid")).toBe("HX123");
    expect(params.get("ContentVariables")).toBe('{"1":"opaque-ticket"}');
    expect(params.has("Body")).toBe(false);
  });

  it("preserves the existing inline-body behavior for all current callers", () => {
    const params = buildWhatsappMessageParams(communication());
    expect(params.get("Body")).toBe("Neutral fallback");
    expect(params.has("ContentSid")).toBe(false);
  });
});
