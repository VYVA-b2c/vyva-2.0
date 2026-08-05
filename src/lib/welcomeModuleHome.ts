import type { HomeContextMessage, HomeContextMessageOutcome } from "@/lib/homeContextMessages";
import { apiFetch } from "@/lib/queryClient";
import { normalizeWelcomeLanguage, type WelcomeHomeSelection } from "../../shared/welcomeModule";

export type WelcomeModuleHomeResponse = {
  message: WelcomeHomeSelection | null;
  state?: {
    audience?: string;
    surface?: string;
    firstWelcomeShown?: boolean;
    dailyNudgeShownToday?: boolean;
    date?: string;
  };
};

export function adaptWelcomeModuleForHome(message: WelcomeHomeSelection | null | undefined): HomeContextMessage | null {
  if (!message) return null;

  const isFirstWelcome = message.momentType === "first_login_welcome";

  return {
    id: `welcome:${message.templateId}`,
    kind: isFirstWelcome ? "tip" : "feature",
    title: message.headline,
    supportingText: message.subtitle,
    spokenText: [message.headline, message.subtitle].filter(Boolean).join(" "),
    actionLabel: message.actionRoute ? message.ctaLabel : undefined,
    actionRoute: message.actionRoute,
    actionState: {
      source: "welcome_module",
      welcomeTemplateId: message.templateId,
      welcomeAudience: message.audience,
      welcomeMomentType: message.momentType,
      welcomeProfileAction: message.profileAction ?? null,
    },
    dismissible: !isFirstWelcome,
    priority: Math.max(0, Math.min(999, message.priority)),
    repeatAfterMs: isFirstWelcome ? 0 : 24 * 60 * 60 * 1000,
    category: message.profileAction === "medications"
      ? "medication"
      : message.profileAction === "gp_details" || message.profileAction === "health_conditions" || message.profileAction === "allergies"
        ? "health"
        : message.profileAction === "cognitive"
          ? "mind"
          : "general",
    nonUrgent: true,
    source: message.source === "managed" ? "managed" : "built_in",
  };
}

function welcomeSelectionTrackingPayload(
  message: WelcomeHomeSelection,
  eventType: HomeContextMessageOutcome,
  language?: string | null,
  route?: string,
) {
  return {
    templateId: message.templateId,
    audience: message.audience,
    momentType: message.momentType,
    profileAction: message.profileAction ?? null,
    eventType,
    language: normalizeWelcomeLanguage(language),
    route: route ?? message.actionRoute ?? "",
    source: message.source === "managed" ? "managed" : "built_in",
  };
}

function welcomeTrackingPayload(message: HomeContextMessage, eventType: HomeContextMessageOutcome, language?: string | null) {
  if (!message.id.startsWith("welcome:")) return null;
  const state = message.actionState ?? {};
  const templateId = typeof state.welcomeTemplateId === "string"
    ? state.welcomeTemplateId
    : message.id.replace(/^welcome:/, "");
  const momentType = state.welcomeMomentType === "daily_profile_nudge"
    ? "daily_profile_nudge"
    : "first_login_welcome";
  const audience = state.welcomeAudience === "caregiver" ? "caregiver" : "elder";
  const profileAction = typeof state.welcomeProfileAction === "string"
    ? state.welcomeProfileAction
    : null;

  return {
    templateId,
    audience,
    momentType,
    profileAction,
    eventType,
    language: normalizeWelcomeLanguage(language),
    route: message.actionRoute ?? "",
    source: message.source === "managed" ? "managed" : "built_in",
  };
}

export function recordWelcomeModuleEvent(
  message: HomeContextMessage,
  eventType: HomeContextMessageOutcome,
  language?: string | null,
) {
  if (typeof window === "undefined") return false;
  const payload = welcomeTrackingPayload(message, eventType, language);
  if (!payload) return false;

  try {
    void apiFetch("/api/welcome-module/events", {
      method: "POST",
      keepalive: true,
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    return true;
  }

  return true;
}

export function recordWelcomeModuleSelectionEvent(
  message: WelcomeHomeSelection | null | undefined,
  eventType: HomeContextMessageOutcome,
  language?: string | null,
  route?: string,
) {
  if (!message || typeof window === "undefined") return false;
  const payload = welcomeSelectionTrackingPayload(message, eventType, language, route);

  try {
    void apiFetch("/api/welcome-module/events", {
      method: "POST",
      keepalive: true,
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    return true;
  }

  return true;
}
