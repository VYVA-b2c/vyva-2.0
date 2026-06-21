import { describe, expect, it, vi } from "vitest";
import type { AppointmentProviderOption, AppointmentRequest } from "../../shared/schema.js";
import {
  detectAppointmentFormAdapter,
  evaluateAppointmentFormSafety,
  runAppointmentFormAutomation,
} from "./appointmentFormAutomation.js";

const request = {
  id: "request-1",
  user_id: "user-1",
  appointment_type: "social",
  reason_detail: "Dinner on Tuesday evening",
  preferences: {},
  status: "provider_selected",
  selected_provider_id: null,
  selected_provider_option_id: "option-1",
  selected_channel: null,
  linked_pending_id: null,
  linked_scheduled_event_id: null,
  route_prefill_source: null,
  language: "en",
  created_at: new Date(),
  updated_at: new Date(),
} as AppointmentRequest;

function optionFor(url: string) {
  return {
    id: "option-1",
    request_id: "request-1",
    user_id: "user-1",
    provider_id: null,
    provider_source: "external",
    provider_snapshot: {
      name: "The Good Table",
      booking_url: url,
      address: "Main Street 1",
    },
    match_reason: "Found online",
    available_channels: ["booking_url"],
    rank: 1,
    status: "suggested",
    created_at: new Date(),
    updated_at: new Date(),
  } as AppointmentProviderOption;
}

describe("appointment form automation", () => {
  it("detects known V1 adapters", () => {
    expect(detectAppointmentFormAdapter("https://calendly.com/clinic/consult")).toBe("calendly");
    expect(detectAppointmentFormAdapter("https://www.thefork.es/restaurante/example")).toBe("thefork");
    expect(detectAppointmentFormAdapter("https://www.opentable.com/r/example")).toBe("opentable");
    expect(detectAppointmentFormAdapter("https://example.com/book")).toBeNull();
  });

  it("blocks unsafe forms before browser automation", async () => {
    const urls = [
      "https://calendly.com/login",
      "https://www.thefork.es/checkout/payment",
      "https://www.opentable.com/captcha",
      "https://clinic.example.com/patient-portal/intake/medical-history",
    ];

    for (const url of urls) {
      const safety = evaluateAppointmentFormSafety({
        rawUrl: url,
        request,
        profile: { email: "karim@example.com" },
      });
      expect(safety.safe).toBe(false);
    }

    const runner = vi.fn();
    const result = await runAppointmentFormAutomation({
      userId: "user-1",
      request,
      option: optionFor("https://calendly.com/login"),
      bookingUrl: "https://calendly.com/login",
      providerName: "Clinic",
      profile: { email: "karim@example.com" },
    }, { browserRunner: runner });

    expect(result.status).toBe("blocked");
    expect(runner).not.toHaveBeenCalled();
  });

  it("keeps unsupported provider websites as VYVA tasks", async () => {
    const result = await runAppointmentFormAutomation({
      userId: "user-1",
      request,
      option: optionFor("https://provider.example.com/book"),
      bookingUrl: "https://provider.example.com/book",
      providerName: "Provider",
      profile: { email: "karim@example.com" },
    });

    expect(result.status).toBe("unsupported_form");
    expect(result.reason).toContain("not one of the supported");
  });

  it("returns confirmed booking details from a supported mocked adapter", async () => {
    const runner = vi.fn(async () => ({
      status: "confirmed" as const,
      adapter: "opentable" as const,
      booking_url: "https://www.opentable.com/r/example",
      reason: "Reservation confirmed by the adapter.",
      submitted: true,
      confirmed: true,
      scheduled_for: "2026-07-03T19:30:00.000Z",
      timezone: "Europe/Madrid",
      location: "Main Street 1",
      metadata: { confirmation_code: "ABC123" },
    }));

    const result = await runAppointmentFormAutomation({
      userId: "user-1",
      request,
      option: optionFor("https://www.opentable.com/r/example"),
      bookingUrl: "https://www.opentable.com/r/example",
      providerName: "The Good Table",
      profile: { email: "karim@example.com", phone: "+34600111222" },
    }, { browserRunner: runner });

    expect(runner).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      status: "confirmed",
      adapter: "opentable",
      scheduled_for: "2026-07-03T19:30:00.000Z",
      location: "Main Street 1",
    });
  });
});
