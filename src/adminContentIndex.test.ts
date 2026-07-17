import { describe, expect, it } from "vitest";
import {
  buildActivityContentItems,
  buildHomeCardContentItems,
  buildLessonContentItems,
  buildRoomPromptContentItems,
  summarizeAdminContentIndex,
} from "../shared/adminContentIndex";

describe("admin content index", () => {
  it("marks universal home-card rules and missing destinations accurately", () => {
    const [item] = buildHomeCardContentItems([{
      card_id: "music_hour",
      is_enabled: true,
      route: "/",
      updated_at: "2026-07-17T08:00:00.000Z",
    }]);

    expect(item.title).toBe("Music Hour");
    expect(item.languageCoverage.mode).toBe("universal");
    expect(item.languageCoverage.missing).toEqual([]);
    expect(item.routeStatus).toBe("missing");
    expect(item.missingContent).toEqual(["Destination route"]);
  });

  it("groups lesson translations into one family and exposes missing languages", () => {
    const items = buildLessonContentItems([
      {
        id: "lesson-en",
        externalId: "rainbows-en",
        categorySlug: "science",
        language: "en",
        title: "Rainbows",
        hook: "Light spreads out.",
        body: "A short explanation.",
        reflectionPrompt: "What have you noticed?",
        imageUrl: "https://example.com/rainbow.jpg",
        status: "published",
        isActive: true,
      },
      {
        id: "lesson-es",
        externalId: "rainbows-es",
        categorySlug: "science",
        language: "es",
        title: "Arcoiris",
        hook: "La luz se abre.",
        body: "Una explicacion breve.",
        reflectionPrompt: "Que has visto?",
        imageUrl: null,
        status: "draft",
        isActive: false,
      },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].sourceId).toBe("rainbows");
    expect(items[0].status).toBe("mixed");
    expect(items[0].languageCoverage.available).toEqual(["en", "es"]);
    expect(items[0].languageCoverage.missing).toEqual(["fr", "de", "it", "pt"]);
    expect(items[0].editorUrl).toContain("lesson-en");
  });

  it("surfaces incomplete localized activity and room copy in the roll-up", () => {
    const activities = buildActivityContentItems([{
      event_key: "garden-walk",
      title_en: "Garden walk",
      title_es: "Paseo por el jardin",
      title_de: "Gartenspaziergang",
      summary_en: "A gentle walk.",
      summary_es: "Un paseo tranquilo.",
      summary_de: "",
      description_en: "Meet near the gate.",
      description_es: "Nos vemos junto a la puerta.",
      description_de: "",
      format: "nearby",
      location_label: "Retiro",
      starts_at: null,
      time_label_en: "Morning",
      time_label_es: "Manana",
      time_label_de: "Morgen",
      status: "active",
      safety_status: "approved",
    }]);
    const prompts = buildRoomPromptContentItems([{
      id: "prompt-1",
      slug: "music-salon",
      roomName: "Music Salon",
      sessionDate: "2026-07-17",
      topicEn: "Songs we remember",
      topicEs: "Canciones que recordamos",
      topicDe: "Lieder, an die wir uns erinnern",
      openerEn: "Which song takes you back?",
      openerEs: "Que cancion te lleva al pasado?",
      openerDe: "Welches Lied erinnert dich?",
      isLive: true,
    }]);
    const sources = [
      { type: "curated_activity" as const, available: true, message: null },
      { type: "room_prompt" as const, available: true, message: null },
    ];
    const summary = summarizeAdminContentIndex([...activities, ...prompts], sources);

    expect(activities[0].missingContent).toEqual(expect.arrayContaining(["German summary", "German description"]));
    expect(activities[0].languageCoverage.available).toEqual(["en", "es"]);
    expect(prompts[0].languageCoverage.available).toEqual(["en", "es", "de"]);
    expect(summary.needsAttention).toBe(2);
    expect(summary.languageGaps).toBe(2);
  });
});
