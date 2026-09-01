import { describe, expect, it } from "vitest";
import type { HeroMessageResult } from "./heroMessages";
import {
  adaptHeroMessageForHome,
  resolveHomeAdminActionRoute,
} from "./homeAdminMessages";

function managedHomeMessage(patch: Partial<HeroMessageResult> = {}): HeroMessageResult {
  return {
    headline: "A nearby activity is ready",
    subtitle: "See what is happening today.",
    ctaLabel: "See activity",
    actionId: "community",
    messageId: "home-activity",
    reason: "evergreen",
    surface: "home_voice",
    source: "managed",
    priority: 30,
    ...patch,
  };
}

describe("Home admin message adapter", () => {
  it("adapts managed Home voice copy into the existing Home message slot", () => {
    expect(adaptHeroMessageForHome(managedHomeMessage())).toMatchObject({
      id: "admin:home-activity",
      kind: "feature",
      title: "A nearby activity is ready",
      supportingText: "See what is happening today.",
      spokenText: "A nearby activity is ready See what is happening today.",
      actionLabel: "See activity",
      actionRoute: "/social-rooms",
      dismissible: true,
    });
  });

  it("preserves managed priority as an admin-tier tie-breaker", () => {
    const result = adaptHeroMessageForHome(managedHomeMessage());

    expect(result?.priority).toBe(30);
  });

  it("ignores built-in, fallback, and non-Home voice messages", () => {
    expect(adaptHeroMessageForHome(managedHomeMessage({ source: "built_in" }))).toBeNull();
    expect(adaptHeroMessageForHome(managedHomeMessage({ source: "fallback" }))).toBeNull();
    expect(adaptHeroMessageForHome(managedHomeMessage({ surface: "health" }))).toBeNull();
  });

  it("adapts elder Welcome Hero messages into the Home message slot", () => {
    expect(adaptHeroMessageForHome(managedHomeMessage({
      headline: "Add your doctor",
      subtitle: "Prepare safer health conversations.",
      ctaLabel: "Add doctor",
      actionId: undefined,
      actionRoute: "/onboarding/profile/gp",
      messageId: "elder-nudge-gp_details",
      source: "built_in",
      messageType: "welcome_profile_nudge",
      welcomeAudience: "elder",
      welcomeMomentType: "daily_profile_nudge",
      welcomeProfileAction: "gp_details",
      priority: 90,
    }))).toMatchObject({
      id: "hero:elder-nudge-gp_details",
      kind: "feature",
      actionRoute: "/onboarding/profile/gp",
      category: "health",
      source: "built_in",
      actionState: {
        source: "home_welcome_hero_message",
        heroMessageId: "elder-nudge-gp_details",
        welcomeProfileAction: "gp_details",
      },
    });
  });

  it("resolves only approved Home destinations", () => {
    expect(resolveHomeAdminActionRoute("health")).toBe("/health");
    expect(resolveHomeAdminActionRoute("medication")).toBe("/meds");
    expect(resolveHomeAdminActionRoute("none")).toBeUndefined();
    expect(resolveHomeAdminActionRoute(undefined)).toBeUndefined();
    expect(resolveHomeAdminActionRoute("unsafe-route" as never)).toBeUndefined();
  });

  it("shows copy without a button when no approved action is selected", () => {
    expect(adaptHeroMessageForHome(managedHomeMessage({ actionId: "none" }))).toMatchObject({
      actionLabel: undefined,
      actionRoute: undefined,
      actionState: {
        source: "home_admin_message",
        heroMessageId: "home-activity",
      },
    });
  });
});
