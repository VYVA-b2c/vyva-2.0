import {
  conciergeProductionChannelForTool,
  type ConciergeProductionChannel,
} from "./conciergeChannelReadiness";
import type { ConciergeToolRequirement } from "./conciergeFlowRegistry";

export type ConciergeAdapterPayloadMissingField = {
  key: string;
  label: string;
  detail: string;
};

export type ConciergeAdapterOutboundPayload = {
  pending_id: string | null;
  user_id: string | null;
  channel: ConciergeProductionChannel;
  tool: ConciergeToolRequirement;
  provider_name: string | null;
  provider_contact: string | null;
  summary: string | null;
  action_payload: Record<string, unknown>;
};

export type ConciergeAdapterPayloadPreview = {
  version: 1;
  adapter: string | null;
  channel: ConciergeProductionChannel | null;
  tool: ConciergeToolRequirement;
  provider_name: string | null;
  provider_contact: string | null;
  summary: string | null;
  pending_id: string | null;
  user_id: string | null;
  valid: boolean;
  missing_fields: ConciergeAdapterPayloadMissingField[];
  blockers: string[];
  outbound_payload: ConciergeAdapterOutboundPayload | null;
};

export type ConciergeAdapterPayloadContractInput = {
  tool: ConciergeToolRequirement;
  payload?: Record<string, unknown> | null;
  providerName?: string | null;
  providerPhone?: string | null;
  pendingId?: string | null;
  userId?: string | null;
  summary?: string | null;
};

const CHANNEL_TARGET_LABELS: Record<ConciergeProductionChannel, string> = {
  phone_call: "Provider phone number",
  email: "Provider email address",
  whatsapp: "Provider WhatsApp number",
  form_application: "Form or application URL",
  document_upload: "Document upload target",
};

function clean(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function firstText(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = clean(payload[key]);
    if (value) return value;
  }
  return null;
}

function objectPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function conciergeAdapterId(channel: ConciergeProductionChannel): string {
  return `concierge_${channel}_adapter`;
}

export function conciergeProviderContactForChannel(
  channel: ConciergeProductionChannel,
  input: Pick<ConciergeAdapterPayloadContractInput, "payload" | "providerPhone">,
): string | null {
  const payload = input.payload ?? {};
  switch (channel) {
    case "phone_call":
      return clean(input.providerPhone)
        || firstText(payload, ["provider_phone", "phone", "contact_phone"]);
    case "email":
      return firstText(payload, ["recipient_email", "provider_email", "to_email", "email_to", "email"]);
    case "whatsapp":
      return firstText(payload, ["recipient_whatsapp", "provider_whatsapp", "to_whatsapp", "whatsapp_to", "whatsapp_number", "whatsapp"]);
    case "form_application":
      return firstText(payload, ["form_automation_prefilled_url", "booking_url", "provider_booking_url", "website", "url"]);
    case "document_upload":
      return firstText(payload, ["document_upload_url", "upload_url", "provider_upload_url", "document_url", "uploaded_document", "uploaded_file", "uploaded_image"]);
    default:
      return null;
  }
}

function missingField(key: string, label: string, detail: string): ConciergeAdapterPayloadMissingField {
  return { key, label, detail };
}

export function buildConciergeAdapterPayloadPreview(
  input: ConciergeAdapterPayloadContractInput,
): ConciergeAdapterPayloadPreview {
  const channel = conciergeProductionChannelForTool(input.tool);
  const actionPayload = objectPayload(input.payload);
  const providerName = clean(input.providerName);
  const providerContact = channel ? conciergeProviderContactForChannel(channel, input) : null;
  const summary = clean(input.summary);
  const pendingId = clean(input.pendingId);
  const userId = clean(input.userId);
  const missingFields: ConciergeAdapterPayloadMissingField[] = [];

  if (!channel) {
    missingFields.push(missingField(
      "channel",
      "Live channel",
      "This Concierge action does not map to a live adapter channel.",
    ));
  }
  if (!providerName) {
    missingFields.push(missingField(
      "provider_name",
      "Provider name",
      "Choose or enter the provider before sending a live adapter payload.",
    ));
  }
  if (channel && !providerContact) {
    missingFields.push(missingField(
      "provider_contact",
      CHANNEL_TARGET_LABELS[channel],
      `Add the ${CHANNEL_TARGET_LABELS[channel].toLowerCase()} before sending this action.`,
    ));
  }
  if (!summary) {
    missingFields.push(missingField(
      "summary",
      "User-approved summary",
      "Confirm the user-approved action summary before sending this payload.",
    ));
  }
  if (!pendingId) {
    missingFields.push(missingField(
      "pending_id",
      "Pending task ID",
      "The adapter payload must include the Concierge pending task ID.",
    ));
  }
  if (!userId) {
    missingFields.push(missingField(
      "user_id",
      "User ID",
      "The adapter payload must include the VYVA user ID.",
    ));
  }

  const outboundPayload = channel
    ? {
        pending_id: pendingId,
        user_id: userId,
        channel,
        tool: input.tool,
        provider_name: providerName,
        provider_contact: providerContact,
        summary,
        action_payload: actionPayload,
      }
    : null;

  return {
    version: 1,
    adapter: channel ? conciergeAdapterId(channel) : null,
    channel,
    tool: input.tool,
    provider_name: providerName,
    provider_contact: providerContact,
    summary,
    pending_id: pendingId,
    user_id: userId,
    valid: missingFields.length === 0,
    missing_fields: missingFields,
    blockers: missingFields.map((field) => `adapter_payload_missing_${field.key}`),
    outbound_payload: outboundPayload,
  };
}
