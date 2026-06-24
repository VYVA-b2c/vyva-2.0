import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { authMiddleware, requireAdminUser } from "../middleware/auth.js";
import socialRoomsRouter from "../routes/socialRooms.js";
import adminSocialRoomsRouter from "../routes/adminSocialRooms.js";

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

const socialApp = buildSocialApp();
const adminApp = buildProtectedAdminApp();

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
  });
});
