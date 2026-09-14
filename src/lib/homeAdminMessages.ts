import type { HeroApprovedActionId, HeroMessageResult } from "@/lib/heroMessages";
import type { HomeContextMessage } from "@/lib/homeContextMessages";
import type { WelcomeProfileActionId } from "../../shared/welcomeModule";

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

function categoryForWelcomeAction(action?: WelcomeProfileActionId): HomeContextMessage["category"] {
  if (action === "medications") return "medication";
  if (action === "gp_details" || action === "health_conditions" || action === "allergies" || action === "devices") return "health";
  if (action === "cognitive") return "mind";
  return "general";
}

export function adaptHeroMessageForHome(message: HeroMessageResult | null): HomeContextMessage | null {
  if (!message || message.surface !== "home_voice") return null;

  const isWelcome = message.messageType === "welcome_first_login" || message.messageType === "welcome_profile_nudge";
  if (!isWelcome && message.source !== "managed") return null;

  const actionRoute = message.actionRoute ?? resolveHomeAdminActionRoute(message.actionId);
  const normalizedPriority = Math.max(0, Math.min(999, Math.round(message.priority ?? 0)));
  const isFirstWelcome = message.messageType === "welcome_first_login";

  return {
    id: `${isWelcome ? "hero" : "admin"}:${message.messageId}`,
    kind: isFirstWelcome ? "tip" : message.reason === "scheduled_event" ? "event" : "feature",
    title: message.headline,
    supportingText: message.subtitle,
    spokenText: [message.headline, message.subtitle].filter(Boolean).join(" "),
    actionLabel: actionRoute ? message.ctaLabel : undefined,
    actionRoute,
    actionState: {
      source: isWelcome ? "home_welcome_hero_message" : "home_admin_message",
      heroMessageId: message.messageId,
      heroMessageType: message.messageType ?? "standard",
      heroReason: message.reason,
      ...(message.welcomeProfileAction ? { welcomeProfileAction: message.welcomeProfileAction } : {}),
    },
    dismissible: !isFirstWelcome,
    priority: normalizedPriority,
    repeatAfterMs: isFirstWelcome ? 3650 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
    category: isWelcome ? categoryForWelcomeAction(message.welcomeProfileAction) : undefined,
    nonUrgent: true,
    source: message.source,
  };
}
