import { beforeEach, describe, expect, it } from "vitest";
import {
  recordHeroImpression,
  selectHeroMessage,
  setRuntimeHeroMessages,
  type HeroMessageDefinition,
} from "./heroMessages";

function managed(message: HeroMessageDefinition): HeroMessageDefinition {
  return message;
}

describe("hero message selection", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setRuntimeHeroMessages(null);
  });

  it("uses the built-in Health default when no managed row exists", () => {
    const result = selectHeroMessage("health", { language: "en" });

    expect(result.messageId).toBe("health-safe-default");
    expect(result.headline).toBe("All good");
    expect(result.source).toBe("built_in");
  });

  it("does not fall back to generic VYVA when a managed Health row is invalid", () => {
    setRuntimeHeroMessages([
      managed({
        id: "health-invalid-managed",
        surface: "health",
        reason: "evergreen",
        priority: 200,
        cooldownHours: 0,
        copy: {
          en: {
            headline: "This managed headline is far too long",
            ctaLabel: "Talk",
          },
          es: {
            headline: "Este titular gestionado es demasiado largo",
            ctaLabel: "Hablar",
          },
        } as HeroMessageDefinition["copy"],
      }),
    ]);

    const result = selectHeroMessage("health", { language: "en", fallbackHeadline: "All good today" });

    expect(result.source).toBe("built_in");
    expect(result.messageId).toBe("health-safe-default");
    expect(result.headline).toBe("All good");
    expect(result.headline).not.toBe("VYVA");
  });

  it("keeps priority and cooldown behavior for managed messages", () => {
    setRuntimeHeroMessages([
      managed({
        id: "health-high-priority",
        surface: "health",
        reason: "evergreen",
        priority: 150,
        cooldownHours: 24,
        copy: {
          en: { headline: "High pick", ctaLabel: "Talk" },
          es: { headline: "Alta prioridad", ctaLabel: "Hablar" },
        } as HeroMessageDefinition["copy"],
      }),
      managed({
        id: "health-lower-priority",
        surface: "health",
        reason: "evergreen",
        priority: 90,
        cooldownHours: 0,
        copy: {
          en: { headline: "Low pick", ctaLabel: "Talk" },
          es: { headline: "Baja prioridad", ctaLabel: "Hablar" },
        } as HeroMessageDefinition["copy"],
      }),
    ]);

    expect(selectHeroMessage("health", { language: "en" })).toMatchObject({
      messageId: "health-high-priority",
      headline: "High pick",
      source: "managed",
    });

    recordHeroImpression("health-high-priority");

    expect(selectHeroMessage("health", { language: "en" })).toMatchObject({
      messageId: "health-lower-priority",
      headline: "Low pick",
      source: "managed",
    });
  });
});
