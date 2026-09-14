import { describe, expect, it } from "vitest";
import {
  buildConciergeAdapterApprovalFingerprint,
  buildConciergeAdapterPayloadPreview,
  conciergeAdapterId,
  compareConciergeAdapterApprovalFingerprint,
} from "../shared/conciergeAdapterPayloadContract";
import type { ConciergeProductionChannel } from "../shared/conciergeChannelReadiness";
import { conciergeToolForProductionChannel } from "../shared/conciergeChannelReadiness";

const validPayloads: Array<{
  channel: ConciergeProductionChannel;
  payload: Record<string, unknown>;
  providerPhone?: string | null;
  expectedContact: string;
}> = [
  {
    channel: "phone_call",
    payload: { execution_channel: "phone_call" },
    providerPhone: "+12025550100",
    expectedContact: "+12025550100",
  },
  {
    channel: "email",
    payload: { execution_channel: "email", provider_email: "frontdesk@example.com" },
    expectedContact: "frontdesk@example.com",
  },
  {
    channel: "whatsapp",
    payload: { execution_channel: "whatsapp", provider_whatsapp: "+12025550101" },
    expectedContact: "+12025550101",
  },
  {
    channel: "form_application",
    payload: { execution_channel: "booking_url", booking_url: "https://clinic.example.com/form" },
    expectedContact: "https://clinic.example.com/form",
  },
  {
    channel: "document_upload",
    payload: { execution_channel: "camera_or_upload", document_upload_url: "https://clinic.example.com/upload" },
    expectedContact: "https://clinic.example.com/upload",
  },
];

describe("Concierge adapter payload contract", () => {
  it("builds valid outbound payload previews for every live channel", () => {
    for (const spec of validPayloads) {
      const preview = buildConciergeAdapterPayloadPreview({
        tool: conciergeToolForProductionChannel(spec.channel),
        payload: spec.payload,
        providerName: "City Clinic",
        providerPhone: spec.providerPhone,
        pendingId: "pending-1",
        userId: "user-1",
        summary: "User approved this Concierge action.",
      });

      expect(preview, spec.channel).toMatchObject({
        version: 1,
        adapter: conciergeAdapterId(spec.channel),
        channel: spec.channel,
        provider_name: "City Clinic",
        provider_contact: spec.expectedContact,
        summary: "User approved this Concierge action.",
        valid: true,
        missing_fields: [],
      });
      expect(preview.outbound_payload, spec.channel).toMatchObject({
        pending_id: "pending-1",
        user_id: "user-1",
        channel: spec.channel,
        provider_contact: spec.expectedContact,
        action_payload: spec.payload,
      });
    }
  });

  it("flags missing provider, contact, summary, trace fields, and channel mapping", () => {
    const preview = buildConciergeAdapterPayloadPreview({
      tool: "email",
      payload: { execution_channel: "email" },
      providerName: null,
      pendingId: null,
      userId: "",
      summary: "",
    });

    expect(preview.valid).toBe(false);
    expect(preview.missing_fields.map((field) => field.key)).toEqual([
      "provider_name",
      "provider_contact",
      "summary",
      "pending_id",
      "user_id",
    ]);
    expect(preview.blockers).toContain("adapter_payload_missing_provider_contact");

    const unmapped = buildConciergeAdapterPayloadPreview({
      tool: "operator_review",
      payload: {},
      providerName: "Clinic",
      pendingId: "pending-1",
      userId: "user-1",
      summary: "Review this manually.",
    });
    expect(unmapped.valid).toBe(false);
    expect(unmapped.missing_fields.map((field) => field.key)).toContain("channel");
    expect(unmapped.outbound_payload).toBeNull();
  });

  it("matches unchanged approvals and ignores runtime-only payload history", () => {
    const approved = buildConciergeAdapterApprovalFingerprint({
      tool: "email",
      payload: {
        provider_email: "frontdesk@example.com",
        document_type: "insurance form",
      },
      providerName: "City Clinic",
      pendingId: "pending-1",
      userId: "user-1",
      summary: "Email clinic paperwork",
      approvedAt: "2026-07-01T10:00:00.000Z",
    });

    const comparison = compareConciergeAdapterApprovalFingerprint({
      tool: "email",
      payload: {
        provider_email: "frontdesk@example.com",
        document_type: "insurance form",
        execution_audit: [{ event: "adapter_retry_requested" }],
        execution_adapter: { status: "failed" },
        operator_note: "Retrying",
      },
      providerName: "City Clinic",
      pendingId: "pending-1",
      userId: "user-1",
      summary: "Email clinic paperwork",
    }, approved);

    expect(comparison).toMatchObject({
      requires_reconfirmation: false,
      changed_fields: [],
      approved_at: "2026-07-01T10:00:00.000Z",
    });
  });

  it("requires reconfirmation when provider, contact, summary, or material payload changes", () => {
    const approved = buildConciergeAdapterApprovalFingerprint({
      tool: "email",
      payload: {
        provider_email: "frontdesk@example.com",
        document_type: "insurance form",
      },
      providerName: "City Clinic",
      summary: "Email clinic paperwork",
    });

    const comparison = compareConciergeAdapterApprovalFingerprint({
      tool: "email",
      payload: {
        provider_email: "newdesk@example.com",
        document_type: "appointment form",
      },
      providerName: "New Clinic",
      summary: "Email new paperwork",
    }, approved);

    expect(comparison).toMatchObject({
      requires_reconfirmation: true,
      reason: "approved_payload_changed",
      changed_fields: ["provider_name", "provider_contact", "summary", "payload"],
    });
  });
});
