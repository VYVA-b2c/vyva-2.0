import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authMiddleware, requireAdminUser } from "../middleware/auth.js";
import socialRoomsRouter from "../routes/socialRooms.js";
import adminSocialRoomsRouter from "../routes/adminSocialRooms.js";

const openAiResponsesCreateMock = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: vi.fn(() => ({
    responses: {
      create: openAiResponsesCreateMock,
    },
  })),
}));

function buildSocialApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/social", authMiddleware, socialRoomsRouter);
  return app;
}

function buildProtectedAdminApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/social", authMiddleware, requireAdminUser, adminSocialRoomsRouter);
  return app;
}

function buildTrustedAdminApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/social", (req, _res, next) => {
    req.user = { id: "test-admin", role: "admin", email: "admin@example.com" };
    next();
  }, adminSocialRoomsRouter);
  return app;
}

const socialApp = buildSocialApp();
const adminApp = buildProtectedAdminApp();
const trustedAdminApp = buildTrustedAdminApp();

type PulseEventSummary = { id: string };

type PulseResponseBody = {
  pulse: {
    featuredEvent: PulseEventSummary;
    recommendations: PulseEventSummary[];
  };
};

function eventIdsFromPulse(body: PulseResponseBody): string[] {
  return [
    body.pulse.featuredEvent.id,
    ...body.pulse.recommendations.map((event: { id: string }) => event.id),
  ];
}

describe("Participate curated events API", () => {
  beforeEach(() => {
    openAiResponsesCreateMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ranks recommendations by hobbies and interests", async () => {
    const response = await request(socialApp)
      .get("/api/social/participate/pulse?lang=en&interests=music")
      .set("x-user-id", "participate-music-user")
      .expect(200);

    expect(response.body.pulse.headline).toBe("Events chosen for you");
    expect(response.body.pulse.featuredEvent.title).toBe("Familiar songs table");
    expect(response.body.pulse.featuredEvent.fitReasons.map((reason: { label: string }) => reason.label)).toContain("Matches music");
    expect(response.body.pulse.safetyCopy).toMatch(/No booking, payment, or outside contact/i);
  });

  it("returns safe fallback recommendations and a profile nudge for empty profiles", async () => {
    const response = await request(socialApp)
      .get("/api/social/participate/pulse?lang=en")
      .set("x-user-id", "participate-empty-profile-user")
      .expect(200);

    expect(response.body.pulse.featuredEvent.title).toEqual(expect.any(String));
    expect(response.body.pulse.featuredEvent.needsLiveCheck).toBe(true);
    expect(response.body.pulse.emptyProfileNudge).toMatchObject({
      title: "Tell us your interests",
      path: "/onboarding/profile/hobbies",
    });
  });

  it("covers the starter catalog for senior-friendly event families", async () => {
    const categories = [
      ["movement", "Gentle movement circle"],
      ["cooking", "Recipe memory table"],
      ["art", "Quiet art and craft studio"],
      ["language", "Language and culture cafe"],
      ["history", "Local history stories"],
    ] as const;

    for (const [interest, expectedTitle] of categories) {
      const response = await request(socialApp)
        .get(`/api/social/participate/pulse?lang=en&interests=${interest}`)
        .set("x-user-id", `participate-${interest}-catalog-user`)
        .expect(200);
      const titles = [
        response.body.pulse.featuredEvent.title,
        ...response.body.pulse.recommendations.map((event: { title: string }) => event.title),
      ];

      expect(titles).toContain(expectedTitle);
    }
  });

  it("persists and replaces interested and maybe responses", async () => {
    const userId = "participate-response-user";
    const pulse = await request(socialApp)
      .get("/api/social/participate/pulse?lang=en&interests=reading")
      .set("x-user-id", userId)
      .expect(200);
    const eventId = pulse.body.pulse.featuredEvent.id;

    const interested = await request(socialApp)
      .post(`/api/social/participate/events/${eventId}/respond`)
      .set("x-user-id", userId)
      .send({ lang: "en", response: "interested" })
      .expect(200);

    expect(interested.body.response).toBe("interested");

    const maybe = await request(socialApp)
      .post(`/api/social/participate/events/${eventId}/respond`)
      .set("x-user-id", userId)
      .send({ lang: "en", response: "maybe" })
      .expect(200);

    expect(maybe.body.response).toBe("maybe");

    const refreshed = await request(socialApp)
      .get("/api/social/participate/pulse?lang=en&interests=reading")
      .set("x-user-id", userId)
      .expect(200);

    const savedEvent = refreshed.body.pulse.savedEvents.find((event: { id: string }) => event.id === eventId);
    expect(savedEvent.myResponse).toBe("maybe");
  });

  it("keeps not-for-me events out of the first recommendation set", async () => {
    const userId = "participate-not-for-me-user";
    const before = await request(socialApp)
      .get("/api/social/participate/pulse?lang=en&interests=music")
      .set("x-user-id", userId)
      .expect(200);
    const hiddenEventId = before.body.pulse.featuredEvent.id;

    await request(socialApp)
      .post(`/api/social/participate/events/${hiddenEventId}/respond`)
      .set("x-user-id", userId)
      .send({ lang: "en", response: "not_for_me" })
      .expect(200);

    const after = await request(socialApp)
      .get("/api/social/participate/pulse?lang=en&interests=music")
      .set("x-user-id", userId)
      .expect(200);

    expect(eventIdsFromPulse(after.body)).not.toContain(hiddenEventId);
  });

  it("creates an ask-VYVA check request without booking anything", async () => {
    const userId = "participate-check-user";
    const pulse = await request(socialApp)
      .get("/api/social/participate/pulse?lang=en&interests=gardening")
      .set("x-user-id", userId)
      .expect(200);
    const eventId = pulse.body.pulse.featuredEvent.id;

    const check = await request(socialApp)
      .post(`/api/social/participate/events/${eventId}/ask-vyva`)
      .set("x-user-id", userId)
      .send({ lang: "en", helperActions: ["check_details", "transport"] })
      .expect(200);

    expect(check.body).toMatchObject({
      ok: true,
      eventId,
      checkStatus: "requested",
    });
    expect(check.body.conciergePrefill.message).toMatch(/Do not book or contact anyone without my confirmation/i);
    expect(check.body.conciergePrefill.event.helperActions).toEqual(["check_details", "transport"]);
  });

  it("requires admin access for participation admin endpoints", async () => {
    await request(adminApp)
      .get("/api/admin/social/participate/events")
      .expect(401);

    await request(adminApp)
      .post("/api/admin/social/participate/discover")
      .send({ city: "Madrid" })
      .expect(401);
  });

  it("returns a safe admin error when AI discovery has no API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const response = await request(trustedAdminApp)
      .post("/api/admin/social/participate/discover")
      .send({ city: "Madrid", countryCode: "ES", maxResults: 3 })
      .expect(503);

    expect(response.body).toMatchObject({
      code: "OPENAI_API_KEY_MISSING",
      error: "AI discovery needs OPENAI_API_KEY before it can search for activities. Nothing was created.",
    });
    expect(openAiResponsesCreateMock).not.toHaveBeenCalled();
  });

  it("returns sourced AI discovery candidates as preview only", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    openAiResponsesCreateMock.mockResolvedValue({
      output_text: JSON.stringify({
        candidates: [
          {
            eventKey: "madrid-ai-preview-only",
            titleEn: "Library music morning",
            titleEs: "Musica matinal en la biblioteca",
            titleDe: "Musikvormittag in der Bibliothek",
            summaryEn: "A calm public music session.",
            locality: "Centro",
            sourceUrl: "https://example.org/library-music",
            evidence: "The source lists a public music event at the library.",
          },
        ],
      }),
    });

    const response = await request(trustedAdminApp)
      .post("/api/admin/social/participate/discover")
      .send({
        city: "Madrid",
        countryCode: "ES",
        locality: "Chamberi, Salamanca",
        postalCode: "28010",
        radiusKm: 4,
        venueHints: ["libraries", "cultural centres"],
        languageCodes: ["en", "es", "de"],
        interests: ["music"],
        format: "nearby",
        maxResults: 2,
      })
      .expect(200);

    expect(response.body.candidates).toHaveLength(1);
    expect(response.body.candidates[0]).toMatchObject({
      eventKey: "madrid-ai-preview-only",
      source: "ai-discovery",
      status: "draft",
      safetyStatus: "needs_review",
      isCurated: true,
      needsLiveCheck: true,
      sourceUrl: "https://example.org/library-music",
    });
    expect(response.body.candidates[0].metadata).toMatchObject({
      locality: "Centro",
    });
    expect(response.body.candidates[0].metadata.discovery).toMatchObject({
      query: {
        city: "Madrid",
        countryCode: "ES",
        locality: "Chamberi, Salamanca",
        postalCode: "28010",
        radiusKm: 4,
        venueHints: ["libraries", "cultural centres"],
      },
      sourceUrls: ["https://example.org/library-music"],
      evidence: "The source lists a public music event at the library.",
      model: "gpt-4.1-mini",
    });
    const openAiRequest = openAiResponsesCreateMock.mock.calls[0]?.[0] as { input?: string } | undefined;
    expect(openAiRequest?.input).toContain("Chamberi, Salamanca");
    expect(openAiRequest?.input).toContain("28010");
    expect(openAiRequest?.input).toContain("within about 4 km");
    expect(openAiRequest?.input).toContain("libraries, cultural centres");

    const events = await request(trustedAdminApp)
      .get("/api/admin/social/participate/events")
      .expect(200);
    expect(events.body.events.map((event: { eventKey: string }) => event.eventKey)).not.toContain("madrid-ai-preview-only");
  });

  it("rejects unsourced AI discovery candidates", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    openAiResponsesCreateMock.mockResolvedValue({
      output_text: JSON.stringify({
        candidates: [
          {
            eventKey: "madrid-unsourced-ai",
            titleEn: "Unsourced activity",
            summaryEn: "No source should make this invalid.",
            sourceUrl: "",
          },
        ],
      }),
    });

    const response = await request(trustedAdminApp)
      .post("/api/admin/social/participate/discover")
      .send({ city: "Madrid", countryCode: "ES" })
      .expect(200);

    expect(response.body.candidates).toEqual([]);
    expect(response.body.rejected).toEqual([
      { title: "Unsourced activity", reason: "Missing source URL" },
    ]);
  });

  it("forces AI-discovery saves to draft review items", async () => {
    const eventKey = `madrid-forced-ai-save-${Date.now()}`;

    const response = await request(trustedAdminApp)
      .post("/api/admin/social/participate/events")
      .send({
        eventKey,
        titleEn: "Forced draft candidate",
        titleEs: "Candidata en borrador",
        titleDe: "Entwurfskandidat",
        summaryEn: "Saved from AI discovery.",
        summaryEs: "Guardada desde descubrimiento IA.",
        summaryDe: "Aus KI-Suche gespeichert.",
        city: "Madrid",
        countryCode: "ES",
        format: "nearby",
        locationLabel: "Library",
        timeLabelEn: "Time to be checked",
        costLabelEn: "Free",
        languageCodes: ["en", "es"],
        tags: ["music"],
        interestTags: ["music"],
        helperActions: ["check_details"],
        source: "ai-discovery",
        sourceUrl: "https://example.org/forced-draft",
        status: "active",
        safetyStatus: "approved",
        isCurated: false,
        needsLiveCheck: false,
        metadata: {
          discovery: {
            sourceUrls: ["https://example.org/forced-draft"],
          },
        },
      })
      .expect(201);

    expect(response.body.event).toMatchObject({
      eventKey,
      source: "ai-discovery",
      status: "draft",
      safetyStatus: "needs_review",
      isCurated: true,
      needsLiveCheck: true,
    });
  });

  it("rejects AI-discovery saves without a public source URL", async () => {
    const response = await request(trustedAdminApp)
      .post("/api/admin/social/participate/events")
      .send({
        eventKey: `madrid-unsourced-save-${Date.now()}`,
        titleEn: "Unsourced save",
        titleEs: "Guardado sin fuente",
        titleDe: "Speicherung ohne Quelle",
        source: "ai-discovery",
        sourceUrl: null,
      })
      .expect(400);

    expect(response.body).toMatchObject({
      code: "AI_DISCOVERY_SOURCE_REQUIRED",
      error: "AI discovery saves require a public source URL.",
    });
  });

  it("rejects duplicate AI-discovery saves before creating draft rows", async () => {
    const baseEventKey = `madrid-duplicate-base-${Date.now()}`;
    const duplicateSourceUrl = `https://example.org/duplicate-source-${Date.now()}`;

    await request(trustedAdminApp)
      .post("/api/admin/social/participate/events")
      .send({
        eventKey: baseEventKey,
        titleEn: "Duplicate library morning",
        titleEs: "Manana duplicada en biblioteca",
        titleDe: "Doppelter Bibliotheksmorgen",
        city: "Madrid",
        countryCode: "ES",
        source: "admin",
        sourceUrl: duplicateSourceUrl,
        status: "draft",
        safetyStatus: "needs_review",
      })
      .expect(201);

    const response = await request(trustedAdminApp)
      .post("/api/admin/social/participate/events")
      .send({
        eventKey: `madrid-duplicate-ai-${Date.now()}`,
        titleEn: "Duplicate library morning",
        titleEs: "Manana duplicada en biblioteca",
        titleDe: "Doppelter Bibliotheksmorgen",
        city: "Madrid",
        countryCode: "ES",
        source: "ai-discovery",
        sourceUrl: duplicateSourceUrl,
        status: "active",
        safetyStatus: "approved",
      })
      .expect(409);

    expect(response.body).toMatchObject({
      code: "AI_DISCOVERY_DUPLICATE",
      duplicateEventKey: baseEventKey,
    });
    expect(response.body.error).toMatch(new RegExp(`Possible duplicate of ${baseEventKey}`));
    expect(response.body.error).toMatch(/same source URL/);
    expect(response.body.error).toMatch(/same title and city/);
  });
});
