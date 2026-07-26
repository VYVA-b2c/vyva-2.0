import type { HeroApprovedActionId, HeroMessageResult } from "@/lib/heroMessages";
import type { HomeContextMessage } from "@/lib/homeContextMessages";

export const HOME_ADMIN_ACTION_ROUTES: Record<Exclude<HeroApprovedActionId, "none">, string> = {
  health: "/health",
  medication: "/meds",
  mind: "/mind-memory",
  community: "/social-rooms",
  concierge: "/concierge",
  prevention: "/health/prevention",
};

export function resolveHomeAdminActionRoute(actionId?: HeroApprovedActionId) {
  if (!actionId || actionId === "none") return undefined;
  return HOME_ADMIN_ACTION_ROUTES[actionId];
}

export function adaptHeroMessageForHome(message: HeroMessageResult | null): HomeContextMessage | null {
  if (!message || message.surface !== "home_voice" || message.source !== "managed") return null;

  const actionRoute = resolveHomeAdminActionRoute(message.actionId);
  const normalizedPriority = Math.max(0, Math.min(999, Math.round(message.priority ?? 0)));

  return {
    id: `admin:${message.messageId}`,
    kind: message.reason === "scheduled_event" ? "event" : "feature",
    title: message.headline,
    supportingText: message.subtitle,
    spokenText: [message.headline, message.subtitle].filter(Boolean).join(" "),
    actionLabel: actionRoute ? message.ctaLabel : undefined,
    actionRoute,
    actionState: actionRoute
      ? { source: "home_admin_message", heroMessageId: message.messageId }
      : undefined,
    dismissible: true,
    priority: normalizedPriority,
    repeatAfterMs: 24 * 60 * 60 * 1000,
  };
}
