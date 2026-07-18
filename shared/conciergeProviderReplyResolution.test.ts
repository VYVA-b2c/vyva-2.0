import { describe, expect, it } from "vitest";
import {
  buildConciergeProviderReplyDecisionPatch,
  buildConciergeProviderReplyResolution,
} from "./conciergeProviderReplyResolution";

describe("Concierge provider reply resolution", () => {
  it("extracts an offer and recommends confirmation", () => {
    const resolution = buildConciergeProviderReplyResolution({
      reply: "We can visit Thursday at 11:00. Estimated cost EUR 95. Ref: PL-19.",
      subject: "Kitchen leak",
      channel: "email",
    });

    expect(resolution).toMatchObject({
      availability: "available",
      dateTime: "Thursday at 11:00",
      price: "EUR 95",
      referenceNumber: "PL-19",
      primaryAction: "confirm",
      missingInformation: [],
      requiresFreshConfirmation: true,
    });
    expect(resolution.draftFollowUp).toMatchObject({
      subject: "Re: Kitchen leak",
    });
  });

  it("uses saved facts and asks only for information that is still missing", () => {
    const resolution = buildConciergeProviderReplyResolution({
      reply: "Please provide the insurance plan, policy number, and phone number.",
      knownFacts: {
        insurance_plan: "Sanitas Mas Salud",
        phone: "+34 600 111 222",
      },
    });

    expect(resolution.primaryAction).toBe("answer_provider");
    expect(resolution.requestedInformation).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "insurance_plan", value: "Sanitas Mas Salud", missing: false }),
      expect.objectContaining({ key: "policy_number", value: null, missing: true }),
      expect.objectContaining({ key: "phone_number", value: "+34 600 111 222", missing: false }),
    ]));
    expect(resolution.missingInformation).toEqual(["Policy or member number"]);
    expect(resolution.draftFollowUp).toBeNull();
  });

  it("prepares but does not confirm a follow-up after missing details are supplied", () => {
    const resolution = buildConciergeProviderReplyResolution({
      reply: "Which insurance plan do you use?",
      subject: "Appointment request",
      channel: "email",
    });
    const patch = buildConciergeProviderReplyDecisionPatch({
      payload: {
        provider_inbound_sender: "clinic@example.com",
        provider_follow_up_confirmed: true,
        execution_adapter: {
          version: 1,
          channel: "email",
          mode: "live",
          status: "sent",
        },
        email_outcome: "sent",
        execution_task: {
          version: 1,
          lifecycle_status: "confirmed",
          user_confirmed: true,
          external_action_allowed: true,
          execution_mode: "live",
          confirmed_at: "2026-07-18T11:00:00.000Z",
          approval_fingerprint: { version: 1, fingerprint: "old-approval" },
          adapter_result: { status: "sent" },
        },
      },
      resolution,
      answers: { insurance_plan: "Sanitas" },
      recordedAt: "2026-07-18T12:00:00.000Z",
    });

    expect(patch).toMatchObject({
      execution_channel: "email",
      provider_email: "clinic@example.com",
      recipient_email: "clinic@example.com",
      email_subject: "Re: Appointment request",
      provider_follow_up_status: "draft_ready",
      provider_follow_up_confirmed: false,
      no_external_action_without_confirmation: true,
      execution_adapter: null,
      email_outcome: null,
      execution_task: expect.objectContaining({
        lifecycle_status: "ready",
        user_confirmed: false,
        external_action_allowed: false,
        execution_mode: "blocked",
        confirmation_source: "provider_reply_received",
      }),
      provider_reply_resolution: expect.objectContaining({
        missingInformation: [],
        decision: {
          action: "answer_provider",
          status: "draft_ready",
          recordedAt: "2026-07-18T12:00:00.000Z",
        },
      }),
      provider_reply_decisions: [expect.objectContaining({
        action: "answer_provider",
        status: "draft_ready",
        channel: "email",
        requiresFreshConfirmation: true,
      })],
    });
    expect(patch.execution_task).not.toHaveProperty("confirmed_at");
    expect(patch.execution_task).not.toHaveProperty("approval_fingerprint");
    expect(patch.execution_task).not.toHaveProperty("adapter_result");
    expect(String(patch.email_body)).toContain("Insurance plan: Sanitas");
  });

  it("treats a completed booking as ready to close", () => {
    expect(buildConciergeProviderReplyResolution({
      reply: "Your booking is confirmed for Tuesday at 10:00. Reference: AP-77.",
    })).toMatchObject({
      primaryAction: "mark_complete",
      dateTime: "Tuesday at 10:00",
      referenceNumber: "AP-77",
      draftFollowUp: null,
    });
  });

  it("keeps the decision contract channel-neutral for WhatsApp", () => {
    const resolution = buildConciergeProviderReplyResolution({
      reply: "We are available Friday at 09:00.",
      subject: "Home visit",
      channel: "whatsapp",
    });
    const patch = buildConciergeProviderReplyDecisionPatch({
      payload: { provider_whatsapp: "+34 600 000 000" },
      resolution,
    });

    expect(patch).toMatchObject({
      execution_channel: "whatsapp",
      preferred_channel: "whatsapp",
      recipient_whatsapp: "+34 600 000 000",
      provider_follow_up_confirmed: false,
    });
    expect(patch.whatsapp_message).toContain("Friday at 09:00 works for me");
    expect(patch.email_body).toBeUndefined();
  });
});
