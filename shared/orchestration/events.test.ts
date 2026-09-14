import { describe, expect, it } from "vitest";
import {
  ENGAGEMENT_EVENT_TYPES,
  EVENT_PAYLOAD_SCHEMAS,
  EVENT_SEMANTIC_RULES,
  EVENT_TYPE_GROUPS,
  FLOW_EVENT_TYPES,
  INTERACTION_EVENT_TYPES,
  PROACTIVE_USER_EVENT_TYPES,
  PROVIDER_OUTCOME_EVENT_TYPES,
  SAFETY_EVENT_TYPES,
  SCHEDULER_EVENT_TYPES,
  TOOL_EVENT_TYPES,
  USER_INPUT_EVENT_TYPES,
  interactionEventSchema,
  parseInteractionEvent,
} from "./events";
import { OrchestrationContractError } from "./errors";
import { interactionEventFixture } from "./fixtures";

function expectCode(operation: () => unknown, code: string): void {
  try {
    operation();
    throw new Error("Expected contract failure");
  } catch (error) {
    expect(error).toBeInstanceOf(OrchestrationContractError);
    expect((error as OrchestrationContractError).code).toBe(code);
  }
}

describe("interaction event contract", () => {
  it("exports accurate, intentionally overlapping event views", () => {
    expect(new Set(INTERACTION_EVENT_TYPES).size).toBe(INTERACTION_EVENT_TYPES.length);
    expect(USER_INPUT_EVENT_TYPES).toContain("USER_SPOKE");
    expect(FLOW_EVENT_TYPES).toContain("FLOW_FAILED");
    expect(SAFETY_EVENT_TYPES).toContain("SAFETY_OVERRIDE_TRIGGERED");
    expect(TOOL_EVENT_TYPES).toContain("TOOL_COMPLETED");
    expect(SCHEDULER_EVENT_TYPES).toContain("SCHEDULE_TRIGGERED");
    expect(PROVIDER_OUTCOME_EVENT_TYPES).toContain("OUTBOUND_CALL_ANSWERED");
    expect(PROACTIVE_USER_EVENT_TYPES).toContain("USER_OPENED_NOTIFICATION");
    expect(ENGAGEMENT_EVENT_TYPES).toContain("USER_OPENED_NOTIFICATION");
  });

  it("has exactly one semantic rule per event and only known events in every grouping", () => {
    expect(Object.keys(EVENT_SEMANTIC_RULES).sort()).toEqual([...INTERACTION_EVENT_TYPES].sort());
    const known = new Set<string>(INTERACTION_EVENT_TYPES);
    for (const events of Object.values(EVENT_TYPE_GROUPS)) {
      expect(events.length).toBeGreaterThan(0);
      for (const eventType of events) expect(known.has(eventType)).toBe(true);
    }
    for (const eventType of Object.keys(EVENT_PAYLOAD_SCHEMAS)) {
      expect(known.has(eventType)).toBe(true);
      expect(EVENT_SEMANTIC_RULES[eventType as keyof typeof EVENT_SEMANTIC_RULES]).toBeDefined();
    }
  });

  it("accepts a valid event and rejects malformed envelopes", () => {
    expect(parseInteractionEvent(interactionEventFixture)).toEqual(interactionEventFixture);
    expect(interactionEventSchema.safeParse({
      ...interactionEventFixture,
      eventType: "UNKNOWN_EVENT",
    }).success).toBe(false);
    expectCode(
      () => parseInteractionEvent({ ...interactionEventFixture, occurredAt: "tomorrow" }),
      "INVALID_EVENT_PAYLOAD",
    );
  });

  it("rejects source, modality, and trigger mismatches with typed errors", () => {
    expectCode(
      () => parseInteractionEvent({ ...interactionEventFixture, source: "scheduler" }),
      "INVALID_EVENT_SOURCE",
    );
    expectCode(
      () => parseInteractionEvent({ ...interactionEventFixture, modality: "touch" }),
      "INVALID_EVENT_MODALITY",
    );
    expectCode(
      () => parseInteractionEvent({ ...interactionEventFixture, triggerSource: "schedule" }),
      "INVALID_EVENT_TRIGGER",
    );
  });

  it("accepts valid provider, scheduler, and proactive-user events", () => {
    expect(parseInteractionEvent({
      ...interactionEventFixture,
      eventType: "OUTBOUND_CALL_ANSWERED",
      source: "provider",
      modality: "voice",
      triggerSource: "outbound_call",
      channel: "telephone",
      payload: { engagementId: "eng-1", callId: "call-1" },
    }).eventType).toBe("OUTBOUND_CALL_ANSWERED");

    expect(parseInteractionEvent({
      ...interactionEventFixture,
      eventType: "SCHEDULE_TRIGGERED",
      source: "scheduler",
      modality: "system",
      triggerSource: "schedule",
      channel: "scheduler",
      payload: { scheduleId: "schedule-1", purpose: "preventive_check" },
    }).eventType).toBe("SCHEDULE_TRIGGERED");

    expect(parseInteractionEvent({
      ...interactionEventFixture,
      eventType: "USER_OPENED_NOTIFICATION",
      source: "ui",
      modality: "touch",
      triggerSource: "push",
      channel: "pwa_push",
      payload: { engagementId: "eng-1" },
    }).eventType).toBe("USER_OPENED_NOTIFICATION");
  });

  it.each([
    ["provider", "PUSH_NOTIFICATION_SENT", "system", "schedule", "web_push", true],
    ["system", "PUSH_NOTIFICATION_FAILED", "system", "caregiver", "pwa_push", true],
    ["user", "PUSH_NOTIFICATION_DELIVERED", "system", "schedule", "push", false],
    ["provider", "PUSH_NOTIFICATION_SENT", "system", "schedule", "email", false],
  ] as const)(
    "validates push outcome semantics for %s/%s",
    (source, eventType, modality, triggerSource, channel, valid) => {
      const operation = () => parseInteractionEvent({
        ...interactionEventFixture,
        source,
        eventType,
        modality,
        triggerSource,
        channel,
        payload: {},
      });
      if (valid) expect(operation).not.toThrow();
      else expect(operation).toThrow(OrchestrationContractError);
    },
  );

  it("validates proactive interaction, deferral, and cancellation meanings", () => {
    expect(() => parseInteractionEvent({
      ...interactionEventFixture,
      eventType: "USER_OPENED_NOTIFICATION",
      source: "user",
      modality: "touch",
      triggerSource: "push",
      channel: "push",
      payload: { engagementId: "eng-1" },
    })).not.toThrow();
    expectCode(
      () => parseInteractionEvent({
        ...interactionEventFixture,
        eventType: "USER_OPENED_NOTIFICATION",
        source: "provider",
        modality: "touch",
        triggerSource: "push",
        channel: "push",
        payload: { engagementId: "eng-1" },
      }),
      "INVALID_EVENT_SOURCE",
    );
    expect(() => parseInteractionEvent({
      ...interactionEventFixture,
      eventType: "PROACTIVE_FLOW_DEFERRED",
      source: "user",
      modality: "touch",
      triggerSource: "push",
      channel: "pwa",
      payload: { engagementId: "eng-1", reasonCode: "LATER" },
    })).not.toThrow();
    expect(() => parseInteractionEvent({
      ...interactionEventFixture,
      eventType: "PROACTIVE_FLOW_CANCELLED",
      source: "user",
      modality: "voice",
      triggerSource: "outbound_call",
      channel: "telephone",
      payload: { engagementId: "eng-1", reasonCode: "ENDED_THIS_ATTEMPT" },
    })).not.toThrow();
    expectCode(
      () => parseInteractionEvent({
        ...interactionEventFixture,
        eventType: "PROACTIVE_FLOW_CANCELLED",
        source: "user",
        modality: "touch",
        triggerSource: "push",
        channel: "push",
        payload: { engagementId: "eng-1", revokesConsent: true },
      }),
      "INVALID_EVENT_PAYLOAD",
    );
  });

  it.each([
    ["provider", "OUTBOUND_CALL_ANSWERED", "telephone", true],
    ["provider", "OUTBOUND_CALL_NO_ANSWER", "twilio_voice", true],
    ["ui", "OUTBOUND_CALL_FAILED", "telephone", false],
    ["provider", "OUTBOUND_CALL_ANSWERED", "pwa", false],
  ] as const)(
    "validates outbound-call outcome semantics for %s/%s",
    (source, eventType, channel, valid) => {
      const payload = eventType === "OUTBOUND_CALL_ANSWERED"
        ? { engagementId: "eng-1", callId: "call-1" }
        : {};
      const operation = () => parseInteractionEvent({
        ...interactionEventFixture,
        source,
        eventType,
        modality: "system",
        triggerSource: "outbound_call",
        channel,
        payload,
      });
      if (valid) expect(operation).not.toThrow();
      else expect(operation).toThrow(OrchestrationContractError);
    },
  );

  it.each([
    ["scheduler", "PREVENTIVE_CHECKIN_DUE", "schedule", true],
    ["caregiver", "CAREGIVER_REQUESTED_CHECKIN", "caregiver", true],
    ["operator", "OPERATOR_REQUESTED_CHECKIN", "operator", true],
    ["user", "SCHEDULE_TRIGGERED", "schedule", false],
  ] as const)(
    "validates scheduler and requester semantics for %s/%s",
    (source, eventType, triggerSource, valid) => {
      const payload = eventType === "SCHEDULE_TRIGGERED"
        ? { scheduleId: "schedule-1", purpose: "checkin" }
        : {};
      const operation = () => parseInteractionEvent({
        ...interactionEventFixture,
        source,
        eventType,
        modality: "system",
        triggerSource,
        channel: "system",
        payload,
      });
      if (valid) expect(operation).not.toThrow();
      else expect(operation).toThrow(OrchestrationContractError);
    },
  );

  it.each([
    ["system", "push"],
    ["scheduler", "schedule"],
    ["provider", "outbound_call"],
  ] as const)("accepts NO_RESPONSE_DETECTED from %s after %s", (source, triggerSource) => {
    expect(() => parseInteractionEvent({
      ...interactionEventFixture,
      eventType: "NO_RESPONSE_DETECTED",
      source,
      modality: "system",
      triggerSource,
      channel: "system",
      payload: {},
    })).not.toThrow();
  });

  it("validates registered event-specific payloads", () => {
    expect(Object.keys(EVENT_PAYLOAD_SCHEMAS)).toEqual(expect.arrayContaining([
      "USER_SPOKE",
      "USER_TAPPED_OPTION",
      "USER_ENTERED_TEXT",
      "USER_UPLOADED_IMAGE",
      "USER_UPLOADED_DOCUMENT",
      "TOOL_COMPLETED",
      "SCHEDULE_TRIGGERED",
      "USER_OPENED_NOTIFICATION",
      "OUTBOUND_CALL_ANSWERED",
      "FLOW_FAILED",
    ]));
    expectCode(
      () => parseInteractionEvent({ ...interactionEventFixture, payload: {} }),
      "INVALID_EVENT_PAYLOAD",
    );
    expectCode(
      () => parseInteractionEvent({
        ...interactionEventFixture,
        eventType: "USER_UPLOADED_IMAGE",
        source: "ui",
        modality: "image",
        payload: { asset: { assetId: "asset-1", contentType: "application/pdf" } },
      }),
      "INVALID_EVENT_PAYLOAD",
    );
  });

  it("validates the FLOW_FAILED payload and lifecycle-aligned semantics", () => {
    const failed = parseInteractionEvent({
      ...interactionEventFixture,
      eventType: "FLOW_FAILED",
      source: "system",
      modality: "system",
      triggerSource: "system",
      channel: "orchestration",
      payload: { reasonCode: "VALIDATION_FAILURE", recoverable: true },
    });
    expect(failed.payload).toEqual({
      reasonCode: "VALIDATION_FAILURE",
      recoverable: true,
    });
    expectCode(
      () => parseInteractionEvent({
        ...failed,
        payload: { reasonCode: "VALIDATION_FAILURE" },
      }),
      "INVALID_EVENT_PAYLOAD",
    );
  });
});
