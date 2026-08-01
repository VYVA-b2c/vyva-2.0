import type { ConciergeAdapterPayloadPreview } from "./conciergeAdapterPayloadContract";

export type ConciergeReconfirmationStatus = "needed" | "resolved";

export type ConciergeReconfirmationRequest = {
  version: 1;
  status: ConciergeReconfirmationStatus;
  requested_at: string;
  requested_by: string | null;
  requested_by_email?: string | null;
  changed_fields: string[];
  payload_preview: ConciergeAdapterPayloadPreview | null;
  reason?: string | null;
  resolved_at?: string | null;
  resolved_source?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim()).map((entry) => entry.trim())
    : [];
}

function payloadPreview(value: unknown): ConciergeAdapterPayloadPreview | null {
  return isRecord(value) && value.version === 1
    ? value as unknown as ConciergeAdapterPayloadPreview
    : null;
}

export function conciergeReconfirmationRequestFromPayload(
  payload: Record<string, unknown> | null | undefined,
): ConciergeReconfirmationRequest | null {
  const raw = payload?.reconfirmation_request;
  if (!isRecord(raw) || raw.version !== 1) return null;
  const status = raw.status === "needed" || raw.status === "resolved" ? raw.status : null;
  const requestedAt = stringOrNull(raw.requested_at);
  if (!status || !requestedAt) return null;

  return {
    version: 1,
    status,
    requested_at: requestedAt,
    requested_by: stringOrNull(raw.requested_by),
    requested_by_email: stringOrNull(raw.requested_by_email),
    changed_fields: stringArray(raw.changed_fields),
    payload_preview: payloadPreview(raw.payload_preview),
    reason: stringOrNull(raw.reason),
    resolved_at: stringOrNull(raw.resolved_at),
    resolved_source: stringOrNull(raw.resolved_source),
  };
}

export function activeConciergeReconfirmationRequestFromPayload(
  payload: Record<string, unknown> | null | undefined,
): ConciergeReconfirmationRequest | null {
  const request = conciergeReconfirmationRequestFromPayload(payload);
  return request?.status === "needed" ? request : null;
}

export function resolveConciergeReconfirmationRequestInPayload(
  payload: Record<string, unknown>,
  input: { resolvedAt: string; resolvedSource?: string | null },
): { payload: Record<string, unknown>; request: ConciergeReconfirmationRequest | null } {
  const request = activeConciergeReconfirmationRequestFromPayload(payload);
  if (!request) return { payload, request: null };

  const resolvedRequest: ConciergeReconfirmationRequest = {
    ...request,
    status: "resolved",
    resolved_at: input.resolvedAt,
    resolved_source: input.resolvedSource ?? "user_confirmed",
  };

  return {
    payload: {
      ...payload,
      reconfirmation_request: resolvedRequest,
    },
    request: resolvedRequest,
  };
}
