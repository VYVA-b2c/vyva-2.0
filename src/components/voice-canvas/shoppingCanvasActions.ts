import type { ShoppingCanvasDraft } from "./shoppingCanvasMachine";
import type { ShoppingConfirmationResult } from "./ShoppingVoiceCanvas";
export type ShoppingCanvasFetch = (
  url: string,
  init?: RequestInit,
) => Promise<Pick<Response, "ok" | "json">>;
export interface ShoppingActionMessages {
  prepareFailed: string;
}
export async function executeShoppingPreparation(
  fetcher: ShoppingCanvasFetch,
  draft: Readonly<ShoppingCanvasDraft>,
  context: {
    signal: AbortSignal;
    language: string;
    messages: ShoppingActionMessages;
  },
): Promise<ShoppingConfirmationResult> {
  const response = await fetcher("/api/concierge/actions/trigger", {
    method: "POST",
    signal: context.signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      use_case: "shopping_request",
      provider_name: draft.retailerName,
      found_externally: false,
      action_summary: "Shopping and delivery request prepared for review.",
      action_payload: {
        preparation_only: true,
        shopping_delivery: true,
        retailer_name: draft.retailerName,
        items: draft.items.map(({ name, quantity }) => ({ name, quantity })),
        fulfillment_method: draft.fulfillment,
        location: draft.location,
        preferred_time: draft.preferredTime,
        substitution_policy: draft.substitutions,
        estimate_status: draft.estimateStatus,
        estimated_cost:
          draft.estimateStatus === "provided" ? draft.estimatedCost : undefined,
        fees: draft.estimateStatus === "provided" ? draft.fees : undefined,
        availability_verified: false,
        confirmation_required_before_external_action: true,
        external_action_started: false,
        address_shared: false,
        order_placed: false,
        reserved: false,
        payment_started: false,
      },
      language: context.language,
      trigger_source: "manual",
      auto_start: false,
    }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? context.messages.prepareFailed);
  }
  const body = (await response.json()) as { pendingId?: string };
  return { outcome: "pending", reference: body.pendingId };
}
