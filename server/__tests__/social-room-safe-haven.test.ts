import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { authMiddleware, requireAdminUser } from "../middleware/auth.js";
import socialRoomsRouter from "../routes/socialRooms.js";
import adminSocialRoomsRouter from "../routes/adminSocialRooms.js";
import { summarizePollVoteState } from "../lib/socialRoomPulse.js";

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

function buildBypassAdminApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/social", (req, _res, next) => {
    req.user = { id: "admin-test-user", role: "admin" };
    next();
  }, adminSocialRoomsRouter);
  return app;
}

const socialApp = buildSocialApp();
const adminApp = buildProtectedAdminApp();
const bypassAdminApp = buildBypassAdminApp();

describe("Together Room safe haven API", () => {
  it("keeps issue poll votes scoped to the exact room question", () => {
    const firstQuestion = summarizePollVoteState(
      "issue-cost",
      "member-a",
      ["yes", "more_info", "not_now"],
      [
        { poll_id: "issue-cost", user_id: "member-a", option_id: "yes" },
        { poll_id: "issue-safety", user_id: "member-b", option_id: "yes" },
        { poll_id: "daily-room-choice", user_id: "member-a", option_id: "views" },
      ],
    );
    const secondQuestion = summarizePollVoteState(
      "issue-safety",
      "member-a",
      ["yes", "more_info", "not_now"],
      [
        { poll_id: "issue-cost", user_id: "member-a", option_id: "yes" },
        { poll_id: "issue-safety", user_id: "member-b", option_id: "yes" },
        { poll_id: "daily-room-choice", user_id: "member-a", option_id: "views" },
      ],
    );

    expect(firstQuestion).toMatchObject({
      optionCounts: { yes: 1, more_info: 0, not_now: 0 },
      totalVotes: 1,
      myVote: "yes",
    });
    expect(secondQuestion).toMatchObject({
      optionCounts: { yes: 1, more_info: 0, not_now: 0 },
      totalVotes: 1,
      myVote: null,
    });
  });

  it("returns country-aware Music Room seeds and regional fallbacks", async () => {
    const countryCodes = ["ES", "MX", "US", "GB", "DE", "FR", "IT", "PT", "BR"];
    const responses = await Promise.all(countryCodes.map((country) => (
      request(socialApp)
        .get(`/api/social/rooms/music-room?lang=en&country=${country}`)
        .set("x-user-id", `music-country-${country.toLowerCase()}-user`)
        .expect(200)
    )));

    const seedTitles = responses.map((response) => response.body.musicCircle.seedSong.songText);
    expect(new Set(seedTitles).size).toBe(countryCodes.length);
    responses.forEach((response, index) => {
      expect(response.body.musicCircle.culture.countryCode).toBe(countryCodes[index]);
      expect(response.body.musicCircle.culture.fallback).toBe(false);
      expect(response.body.musicCircle.starterSongs).toHaveLength(3);
      expect(response.body.musicCircle.starterSongs[0].songText).toBe(response.body.musicCircle.seedSong.songText);
      expect(response.body.musicCircle.seedSong.originCountryCode).toBe(countryCodes[index]);
      expect(response.body.musicCircle.seedSong.matchTags.length).toBeGreaterThan(0);
    });

    const regionalFallback = await request(socialApp)
      .get("/api/social/rooms/music-room?lang=fr&country=ZZ")
      .set("x-user-id", "music-country-fallback-user")
      .expect(200);

    expect(regionalFallback.body.musicCircle.culture.countryCode).toBe("FR");
    expect(regionalFallback.body.musicCircle.culture.fallback).toBe(true);
    expect(regionalFallback.body.musicCircle.seedSong.originCountryCode).toBe("FR");
  });

  it("returns a destination Reading Club payload and preserves the Book Club alias", async () => {
    const readingRoom = await request(socialApp)
      .get("/api/social/rooms/reading-room?lang=en")
      .set("x-user-id", "reading-club-destination-user")
      .expect(200);

    expect(readingRoom.body.room.slug).toBe("reading-room");
    expect(readingRoom.body.room.category).toBe("social");
    expect(readingRoom.body.readingClub.title).toMatch(/Literary Club/i);
    expect(readingRoom.body.readingClub.agenda).toHaveLength(3);
    expect(readingRoom.body.readingClub.shelves.length).toBeGreaterThanOrEqual(2);
    expect(readingRoom.body.readingClub.companionModes.map((mode: { id: string }) => mode.id)).toEqual([
      "one-to-one",
      "small-circle",
      "pen-note",
    ]);
    expect(readingRoom.body.readingClub.passportItems.map((item: { id: string }) => item.id)).toEqual([
      "share",
      "recommend",
      "greet",
    ]);

    const alias = await request(socialApp)
      .get("/api/social/rooms/book-club?lang=de")
      .set("x-user-id", "reading-club-alias-user")
      .expect(200);

    expect(alias.body.room.slug).toBe("reading-room");
    expect(alias.body.readingClub.title).toMatch(/Literaturclub/i);
  });

  it("supports Reading Room club tables, shelf voting, shared reflections and moderation", async () => {
    const userId = "reading-club-pulse-user";

    const pulse = await request(socialApp)
      .get("/api/social/rooms/book-club/pulse?lang=en")
      .set("x-user-id", userId)
      .expect(200);

    expect(pulse.body.pulse.featuredPlan.key).toBe("morning-welcome-table");
    expect(pulse.body.pulse.activePoll.key).toBe("reading-club-next-shelf");
    expect(pulse.body.pulse.safety.consentLine).toMatch(/both people agree/i);

    const joined = await request(socialApp)
      .post("/api/social/rooms/reading-room/plans/morning-welcome-table/respond")
      .set("x-user-id", userId)
      .send({ lang: "en", response: "join" })
      .expect(200);

    expect(joined.body.planResponse.response).toBe("join");
    expect(joined.body.pulse.featuredPlan.myResponse).toBe("join");

    const vote = await request(socialApp)
      .post("/api/social/rooms/reading-room/polls/reading-club-next-shelf/vote")
      .set("x-user-id", userId)
      .send({ lang: "en", optionId: "memoir" })
      .expect(200);

    expect(vote.body.pulse.activePoll.myVote).toBe("memoir");

    const reflection = await request(socialApp)
      .post("/api/social/rooms/book-club/proposals")
      .set("x-user-id", userId)
      .send({
        lang: "en",
        title: "A character who stayed with me",
        details: "I would like to hear what characters other members still remember.",
        kind: "message",
      })
      .expect(200);

    expect(reflection.body.proposal.kind).toBe("message");
    expect(reflection.body.pulse.postedExperiences[0].title).toMatch(/character/i);

    const report = await request(socialApp)
      .post("/api/social/rooms/reading-room/safety-reports")
      .set("x-user-id", "reading-club-report-user")
      .send({
        lang: "en",
        reason: "club_help",
        targetType: "message",
        targetId: reflection.body.proposal.planKey,
        details: "Please check this club-table reflection.",
      })
      .expect(200);

    expect(report.body.report.targetType).toBe("message");
    expect(report.body.report.targetId).toBe(reflection.body.proposal.planKey);

    const moderation = await request(bypassAdminApp)
      .get("/api/admin/social/rooms/reading-room/moderation")
      .expect(200);
    expect(
      moderation.body.reports.some((item: { targetType?: string; targetId?: string }) => (
        item.targetType === "message" && item.targetId === reflection.body.proposal.planKey
      )),
    ).toBe(true);
  });

  it("creates reusable Music Room threads and blocks unsafe memories", async () => {
    const userId = "music-thread-safe-haven-user";

    const emptyCircle = await request(socialApp)
      .get("/api/social/rooms/music-room?lang=en")
      .set("x-user-id", "music-circle-seed-user")
      .expect(200);

    expect(emptyCircle.body.musicCircle.seedSong.songText).toEqual(expect.any(String));
    expect(emptyCircle.body.musicCircle.seedSong.nudge).toMatch(/Diego/i);
    expect(emptyCircle.body.musicCircle.featuredItemId).toBeNull();
    expect(emptyCircle.body.musicCircle.items).toEqual([]);

    const circleItem = await request(socialApp)
      .post("/api/social/rooms/music-room/music-circle/items")
      .set("x-user-id", userId)
      .send({
        lang: "en",
        songText: "Stand By Me",
        causeId: "bridge",
        memoryText: "",
      })
      .expect(200);

    expect(circleItem.body.item.id).toEqual(expect.any(String));
    expect(circleItem.body.item.songText).toBe("Stand By Me");
    expect(circleItem.body.item.reactionCount).toBe(0);
    expect(circleItem.body.musicCircle.seedSong.nudge).toMatch(/Diego/i);
    expect(circleItem.body.musicCircle.items.map((item: { songText: string }) => item.songText)).toContain("Stand By Me");

    const reaction = await request(socialApp)
      .post(`/api/social/rooms/music-room/music-circle/items/${circleItem.body.item.id}/reactions`)
      .set("x-user-id", userId)
      .send({ lang: "en", kind: "heart" })
      .expect(200);

    expect(reaction.body.item.reactionCount).toBe(1);
    expect(reaction.body.item.myReaction).toBe(true);

    const reactionOff = await request(socialApp)
      .post(`/api/social/rooms/music-room/music-circle/items/${circleItem.body.item.id}/reactions`)
      .set("x-user-id", userId)
      .send({ lang: "en", kind: "heart" })
      .expect(200);

    expect(reactionOff.body.item.reactionCount).toBe(0);
    expect(reactionOff.body.item.myReaction).toBe(false);

    const firstHello = await request(socialApp)
      .post("/api/social/rooms/music-room/connect")
      .set("x-user-id", userId)
      .send({
        lang: "en",
        memberId: "member-arthur",
        circleItemId: circleItem.body.item.id,
        matchedTopic: "Soul",
        bridgePrompt: "Arthur, I added Stand By Me.",
      })
      .expect(200);

    expect(firstHello.body.thread.id).toEqual(expect.any(String));
    expect(firstHello.body.thread.songText).toBe("Stand By Me");
    expect(firstHello.body.thread.matchedMemberId).toBe("member-arthur");
    expect(firstHello.body.thread.entries.map((entry: { body: string }) => entry.body)).toContain("Soul: old friends.");

    const secondHello = await request(socialApp)
      .post("/api/social/rooms/music-room/connect")
      .set("x-user-id", userId)
      .send({
        lang: "en",
        memberId: "member-arthur",
        songText: "Stand By Me",
        matchedTopic: "Soul",
      })
      .expect(200);

    expect(secondHello.body.thread.id).toBe(firstHello.body.thread.id);

    const memory = await request(socialApp)
      .post(`/api/social/rooms/music-room/music-threads/${firstHello.body.thread.id}/entries`)
      .set("x-user-id", userId)
      .send({
        lang: "en",
        kind: "memory",
        body: "It played on my old radio.",
      })
      .expect(200);

    expect(memory.body.entry.body).toBe("It played on my old radio.");
    expect(memory.body.thread.entries.map((entry: { body: string }) => entry.body)).toContain("It played on my old radio.");

    const room = await request(socialApp)
      .get("/api/social/rooms/music-room?lang=en")
      .set("x-user-id", userId)
      .expect(200);

    expect(room.body.musicCircle.items.map((item: { songText: string }) => item.songText)).toContain("Stand By Me");
    const savedThread = room.body.musicThreads.find((thread: { id: string }) => thread.id === firstHello.body.thread.id);
    expect(savedThread.entries.map((entry: { body: string }) => entry.body)).toContain("It played on my old radio.");

    const unsafeCircle = await request(socialApp)
      .post("/api/social/rooms/music-room/music-circle/items")
      .set("x-user-id", userId)
      .send({
        lang: "en",
        songText: "Text me your phone number and I can pay outside the app.",
        causeId: "bridge",
      })
      .expect(400);

    expect(unsafeCircle.body.error).toMatch(/VYVA review/i);
    expect(unsafeCircle.body.safetyFlags).toContain("private_contact");
    expect(unsafeCircle.body.safetyFlags).toContain("money");

    const unsafe = await request(socialApp)
      .post(`/api/social/rooms/music-room/music-threads/${firstHello.body.thread.id}/entries`)
      .set("x-user-id", userId)
      .send({
        lang: "en",
        kind: "memory",
        body: "Text me your phone number and I can pay outside the app.",
      })
      .expect(400);

    expect(unsafe.body.error).toMatch(/VYVA review/i);
    expect(unsafe.body.safetyFlags).toContain("private_contact");
    expect(unsafe.body.safetyFlags).toContain("money");
  });

  it("excludes hidden Reading Room users from fallback matching", async () => {
    await request(socialApp)
      .post("/api/social/rooms/reading-room/enter")
      .set("x-user-id", "reading-hidden-poetry-candidate")
      .set("x-social-discoverable", "false")
      .send({ lang: "en" })
      .expect(200);

    const match = await request(socialApp)
      .post("/api/social/rooms/reading-room/match")
      .set("x-user-id", "reading-hidden-filter-seeker")
      .send({
        lang: "en",
        readingMode: "one-to-one",
        readingIntent: "meet-reader",
        favoriteShelf: "poetry",
        preferredPace: "letters",
        readingPreferenceTags: ["poetry", "literature", "reading_companion"],
      })
      .expect(200);

    expect(match.body.noMatch).toBe(true);
    expect(match.body.matchedUser).toBeUndefined();
    expect(match.body.agentMessage).toMatch(/nobody suitable/i);
  });

  it("matches Reading Room companions from reader profile preferences and sends a protected greeting", async () => {
    await request(socialApp)
      .post("/api/social/rooms/reading-room/enter")
      .set("x-user-id", "reading-profile-candidate")
      .send({ lang: "en" })
      .expect(200);

    const match = await request(socialApp)
      .post("/api/social/rooms/book-club/match")
      .set("x-user-id", "reading-profile-seeker")
      .send({
        lang: "en",
        readingMode: "pen-note",
        readingIntent: "meet-reader",
        favoriteShelf: "poetry",
        preferredPace: "letters",
        readingPreferenceTags: ["poetry", "literature", "reading_companion"],
        bridgePrompt: "a written note about poetry and remembered lines.",
      })
      .expect(200);

    expect(match.body.noMatch).toBe(false);
    expect(match.body.matchedUser.userId).toBe("reading-profile-candidate");
    expect(match.body.sharedTopics).toContain("poetry");
    expect(match.body.agentMessage).toMatch(/club desk preferences/i);

    const greeting = await request(socialApp)
      .post("/api/social/rooms/reading-room/connect")
      .set("x-user-id", "reading-profile-seeker")
      .send({
        lang: "en",
        memberId: match.body.matchedUser.userId,
        bridgePrompt: "a written note about poetry and remembered lines.",
      })
      .expect(200);

    expect(greeting.body.reply).toMatch(/literary greeting/i);
    expect(greeting.body.reply).toMatch(/poetry and remembered lines/i);
  });

  it("returns a Together Room pulse with a featured plan and active poll", async () => {
    const res = await request(socialApp)
      .get("/api/social/rooms/together-room?lang=en")
      .set("x-user-id", "safe-haven-pulse-user")
      .expect(200);

    expect(res.body.pulse.featuredPlan.key).toBe("tea-film-chat");
    expect(res.body.pulse.activePoll.key).toBe("daily-room-choice");
    expect(res.body.pulse.activePoll.options.map((option: { id: string }) => option.id)).toEqual(["film", "lunch", "views"]);
    expect(res.body.pulse.activePoll.options.map((option: { label: string }) => option.label)).toContain("Share views");
    expect(res.body.pulse.decisionGuide.title).toBe("Next safe step");
    expect(res.body.pulse.decisionGuide.actionKind).toBe("vote");
    expect(res.body.pulse.decisionGuide.body).toMatch(/turn the room's signals/i);
    expect(res.body.pulse.decisionGuide.steps).toContain("Keep contact inside VYVA");
    expect(res.body.pulse.discussionPrompt.dailyQuestion.title).toBe("Today's gentle question");
    expect(res.body.pulse.discussionPrompt.dailyQuestion.draft).toMatch(/easier for me to join/i);
    expect(res.body.pulse.joiningSupportCue.title).toBe("Make joining easier");
    expect(res.body.pulse.joiningSupportCue.draft).toMatch(/easiest safe way to join/i);
    expect(res.body.pulse.joiningSupportCue.privacyLine).toMatch(/totals, not names/i);
    expect(res.body.pulse.memberPresence).toHaveLength(3);
    expect(res.body.pulse.comfortCheck.title).toMatch(/comfortable/i);
    expect(res.body.pulse.comfortCheck.options.map((option: { id: string }) => option.id)).toEqual([
      "listen_first",
      "quiet_pace",
      "easy_access",
      "seating",
      "transport_help",
      "arrival_buddy",
      "clear_cost",
    ]);
    expect(res.body.pulse.safety.consentLine).toMatch(/both people agree/i);
    expect(res.body.pulse.safety.agreementLines).toContain("Use kind words and no pressure.");
    expect(res.body.pulse.safety.myAcknowledgedAt).toBeNull();
    expect(res.body.pulse.visibility.title).toBe("Who sees what");
    expect(res.body.pulse.visibility.items.map((item: { id: string }) => item.id)).toEqual(["private", "totals", "shared"]);
    expect(res.body.pulse.visibility.items[0].body).toMatch(/do not show your name/i);
    expect(res.body.pulse.activityDigest.title).toBe("What is moving in the room");
    expect(res.body.pulse.activityDigest.items.map((item: { id: string }) => item.id)).toContain("presence");
    expect(res.body.pulse.activityDigest.privacyLine).toMatch(/private choices/i);
  });

  it("counts a quiet Together Room arrival in privacy-safe presence", async () => {
    const userId = "safe-haven-quiet-arrival-user";

    const entered = await request(socialApp)
      .post("/api/social/rooms/together-room/enter")
      .set("x-user-id", userId)
      .send({ lang: "en" })
      .expect(200);

    const myPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", userId)
      .expect(200);

    expect(myPulse.body.pulse.memberPresence[0]).toMatchObject({
      id: "member-self",
      name: "You",
    });
    expect(JSON.stringify(myPulse.body.pulse.memberPresence)).not.toContain(userId);

    const observerPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", "safe-haven-quiet-arrival-observer")
      .expect(200);

    expect(JSON.stringify(observerPulse.body.pulse.memberPresence)).not.toContain(userId);
    expect(observerPulse.body.pulse.memberPresence.some((member: { name?: string }) => (
      /^Member \d+$/.test(member.name ?? "")
    ))).toBe(true);

    await request(socialApp)
      .post("/api/social/rooms/together-room/leave")
      .set("x-user-id", userId)
      .send({ lang: "en", visitId: entered.body.visitId })
      .expect(200);
  });

  it("keeps tied Together Room votes as still choosing in the pulse guide", async () => {
    await request(socialApp)
      .post("/api/social/rooms/together-room/polls/daily-room-choice/vote")
      .set("x-user-id", "safe-haven-tie-film-user")
      .send({ lang: "en", optionId: "film" })
      .expect(200);

    const lunchVote = await request(socialApp)
      .post("/api/social/rooms/together-room/polls/daily-room-choice/vote")
      .set("x-user-id", "safe-haven-tie-lunch-user")
      .send({ lang: "en", optionId: "lunch" })
      .expect(200);

    expect(lunchVote.body.pulse.activePoll.totalVotes).toBeGreaterThanOrEqual(2);
    expect(lunchVote.body.pulse.decisionGuide.id).toBe("waiting-for-clear-choice");
    expect(lunchVote.body.pulse.decisionGuide.actionKind).toBe("vote");
    expect(lunchVote.body.pulse.decisionGuide.body).toMatch(/still choosing between Film chat \| Quiet lunch/i);
    expect(lunchVote.body.pulse.decisionGuide.steps).toContain("Tied: Film chat | Quiet lunch");
  });

  it("persists the Together Room promise acknowledgement through pulse refresh", async () => {
    const userId = "safe-haven-promise-user";

    const acknowledged = await request(socialApp)
      .post("/api/social/rooms/together-room/safety-acknowledgement")
      .set("x-user-id", userId)
      .send({ lang: "en" })
      .expect(200);

    expect(acknowledged.body.acknowledgedAt).toEqual(expect.any(String));
    expect(acknowledged.body.pulse.safety.myAcknowledgedAt).toEqual(expect.any(String));
    expect(acknowledged.body.pulse.safety.acknowledgedLabel).toBe("Room promise saved");

    const refreshed = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", userId)
      .expect(200);

    expect(refreshed.body.pulse.safety.myAcknowledgedAt).toEqual(expect.any(String));
    expect(refreshed.body.pulse.safety.agreementLines).toContain("Share views without judging.");
  });

  it("persists comfort check-ins and returns room comfort counts", async () => {
    const userId = "safe-haven-comfort-user";

    await request(socialApp)
      .post("/api/social/rooms/together-room/quiet-pause")
      .set("x-user-id", userId)
      .send({ lang: "en", paused: true })
      .expect(200);

    const saved = await request(socialApp)
      .post("/api/social/rooms/together-room/comfort-check")
      .set("x-user-id", userId)
      .send({ lang: "en", comfortNeeds: ["listen_first", "quiet_pace", "seating", "transport_help", "arrival_buddy", "clear_cost"] })
      .expect(200);

    expect(saved.body.comfortNeeds).toEqual(["listen_first", "quiet_pace", "seating", "transport_help", "arrival_buddy", "clear_cost"]);
    expect(saved.body.pulse.comfortCheck.myComfortNeeds).toEqual(["listen_first", "quiet_pace", "seating", "transport_help", "arrival_buddy", "clear_cost"]);
    expect(saved.body.pulse.safety.myQuietPausedAt).toEqual(expect.any(String));
    expect(saved.body.pulse.joiningSupportCue.id).toBe("arrival-support");
    expect(saved.body.pulse.joiningSupportCue.needIds).toContain("transport_help");
    expect(saved.body.pulse.joiningSupportCue.needIds).toContain("arrival_buddy");
    expect(saved.body.pulse.joiningSupportCue.draft).toMatch(/arrival buddy/i);
    expect(
      saved.body.pulse.comfortCheck.options.find((option: { id: string }) => option.id === "listen_first").count,
    ).toBeGreaterThanOrEqual(1);
    expect(
      saved.body.pulse.comfortCheck.options.find((option: { id: string }) => option.id === "quiet_pace").count,
    ).toBeGreaterThanOrEqual(1);

    const changed = await request(socialApp)
      .post("/api/social/rooms/together-room/comfort-check")
      .set("x-user-id", userId)
      .send({ lang: "en", comfortNeeds: ["easy_access"] })
      .expect(200);

    expect(changed.body.pulse.comfortCheck.myComfortNeeds).toEqual(["easy_access"]);
    expect(changed.body.pulse.safety.myQuietPausedAt).toEqual(expect.any(String));
    expect(changed.body.pulse.joiningSupportCue.id).toBe("access-support");
    expect(changed.body.pulse.joiningSupportCue.draft).toMatch(/access, seating/i);
    expect(
      changed.body.pulse.comfortCheck.options.find((option: { id: string }) => option.id === "easy_access").count,
    ).toBeGreaterThanOrEqual(1);

    const refreshed = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", userId)
      .expect(200);

    expect(refreshed.body.pulse.comfortCheck.myComfortNeeds).toEqual(["easy_access"]);
    expect(refreshed.body.pulse.safety.myQuietPausedAt).toEqual(expect.any(String));
    expect(refreshed.body.pulse.comfortCheck.totalResponses).toBeGreaterThanOrEqual(1);
  });

  it("persists a private Together Room quiet pause through pulse refresh", async () => {
    const userId = "safe-haven-quiet-pause-user";

    const paused = await request(socialApp)
      .post("/api/social/rooms/together-room/quiet-pause")
      .set("x-user-id", userId)
      .send({ lang: "en", paused: true })
      .expect(200);

    expect(paused.body.quietPausedAt).toEqual(expect.any(String));
    expect(paused.body.pulse.safety.myQuietPausedAt).toEqual(expect.any(String));

    const refreshed = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", userId)
      .expect(200);

    expect(refreshed.body.pulse.safety.myQuietPausedAt).toEqual(expect.any(String));

    const observerPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", "safe-haven-quiet-pause-observer")
      .expect(200);

    expect(observerPulse.body.pulse.safety.myQuietPausedAt ?? null).toBeNull();

    const resumed = await request(socialApp)
      .post("/api/social/rooms/together-room/quiet-pause")
      .set("x-user-id", userId)
      .send({ lang: "en", paused: false })
      .expect(200);

    expect(resumed.body.quietPausedAt).toBeNull();
    expect(resumed.body.pulse.safety.myQuietPausedAt ?? null).toBeNull();
  });

  it("clears quiet pause when a member sends a Together Room action", async () => {
    const planUserId = "safe-haven-quiet-pause-plan-action-user";

    await request(socialApp)
      .post("/api/social/rooms/together-room/quiet-pause")
      .set("x-user-id", planUserId)
      .send({ lang: "en", paused: true })
      .expect(200);

    const joined = await request(socialApp)
      .post("/api/social/rooms/together-room/plans/tea-film-chat/respond")
      .set("x-user-id", planUserId)
      .send({ lang: "en", response: "join" })
      .expect(200);

    expect(joined.body.planResponse.response).toBe("join");
    expect(joined.body.pulse.safety.myQuietPausedAt ?? null).toBeNull();

    const refreshedPlanUser = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", planUserId)
      .expect(200);

    expect(refreshedPlanUser.body.pulse.safety.myQuietPausedAt ?? null).toBeNull();

    const voteUserId = "safe-haven-quiet-pause-vote-action-user";

    await request(socialApp)
      .post("/api/social/rooms/together-room/quiet-pause")
      .set("x-user-id", voteUserId)
      .send({ lang: "en", paused: true })
      .expect(200);

    const voted = await request(socialApp)
      .post("/api/social/rooms/together-room/polls/daily-room-choice/vote")
      .set("x-user-id", voteUserId)
      .send({ lang: "en", optionId: "views" })
      .expect(200);

    expect(voted.body.vote.optionId).toBe("views");
    expect(voted.body.pulse.safety.myQuietPausedAt ?? null).toBeNull();
  });

  it("keeps a not-for-me plan response private without clearing quiet pause", async () => {
    const userId = "safe-haven-plan-private-pass-user";

    await request(socialApp)
      .post("/api/social/rooms/together-room/quiet-pause")
      .set("x-user-id", userId)
      .send({ lang: "en", paused: true })
      .expect(200);

    const passed = await request(socialApp)
      .post("/api/social/rooms/together-room/plans/tea-film-chat/respond")
      .set("x-user-id", userId)
      .send({ lang: "en", response: "not_for_me" })
      .expect(200);

    expect(passed.body.planResponse.response).toBe("not_for_me");
    expect(passed.body.planResponse.responseCounts.not_for_me).toBeGreaterThanOrEqual(1);
    expect(passed.body.pulse.featuredPlan.myResponse).toBe("not_for_me");
    expect(passed.body.pulse.featuredPlan.responseCounts.not_for_me).toBeGreaterThanOrEqual(1);
    expect(passed.body.pulse.safety.myQuietPausedAt).toEqual(expect.any(String));

    const refreshed = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", userId)
      .expect(200);

    expect(refreshed.body.pulse.featuredPlan.myResponse).toBe("not_for_me");
    expect(refreshed.body.pulse.safety.myQuietPausedAt).toEqual(expect.any(String));
  });

  it("does not notify a plan owner when someone privately passes", async () => {
    const ownerId = "safe-haven-private-pass-owner";
    const passerId = "safe-haven-private-pass-member";

    const proposal = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", ownerId)
      .send({
        lang: "en",
        title: "Small garden walk",
        details: "A short walk with quiet pauses and seating nearby.",
        kind: "plan",
        locationLabel: "nearby",
        comfortNeeds: ["quiet_pace", "seating"],
      })
      .expect(200);
    const planKey = proposal.body.proposal.planKey as string;

    const passed = await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${planKey}/respond`)
      .set("x-user-id", passerId)
      .send({ lang: "en", response: "not_for_me" })
      .expect(200);

    expect(passed.body.planResponse.response).toBe("not_for_me");

    const ownerPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", ownerId)
      .expect(200);

    expect(ownerPulse.body.pulse.notifications.some((notification: { type?: string; metadata?: Record<string, unknown> }) => (
      (notification.type === "plan_joined" || notification.type === "plan_saved") &&
      notification.metadata?.planKey === planKey
    ))).toBe(false);
    expect(ownerPulse.body.pulse.notifications.some((notification: { metadata?: Record<string, unknown> }) => (
      notification.metadata?.planKey === planKey &&
      notification.metadata?.response === "not_for_me"
    ))).toBe(false);
  });

  it("persists plan responses with duplicate replacement semantics", async () => {
    const userId = "safe-haven-plan-user";

    const joined = await request(socialApp)
      .post("/api/social/rooms/together-room/plans/tea-film-chat/respond")
      .set("x-user-id", userId)
      .send({ lang: "en", response: "join" })
      .expect(200);

    expect(joined.body.planResponse.response).toBe("join");

    const maybe = await request(socialApp)
      .post("/api/social/rooms/together-room/plans/tea-film-chat/respond")
      .set("x-user-id", userId)
      .send({ lang: "en", response: "maybe" })
      .expect(200);

    expect(maybe.body.planResponse.response).toBe("maybe");
    expect(maybe.body.pulse.featuredPlan.myResponse).toBe("maybe");
    expect(maybe.body.planResponse.responseCounts.maybe).toBeGreaterThanOrEqual(1);
    expect(maybe.body.pulse.memberPresence[0]).toMatchObject({
      id: "member-self",
      name: "You",
    });
    expect(maybe.body.pulse.memberPresence).toHaveLength(3);
    expect(JSON.stringify(maybe.body.pulse.memberPresence)).not.toContain(userId);

    const cleared = await request(socialApp)
      .post("/api/social/rooms/together-room/plans/tea-film-chat/respond")
      .set("x-user-id", userId)
      .send({ lang: "en", response: "clear" })
      .expect(200);

    expect(cleared.body.planResponse.response).toBeNull();
    expect(cleared.body.pulse.featuredPlan.myResponse).toBeNull();
    expect(cleared.body.planResponse.responseCounts.maybe).toBeLessThan(maybe.body.planResponse.responseCounts.maybe);
  });

  it("replaces an earlier poll vote from the same user", async () => {
    const userId = "safe-haven-vote-user";

    await request(socialApp)
      .post("/api/social/rooms/together-room/polls/daily-room-choice/vote")
      .set("x-user-id", userId)
      .send({ lang: "en", optionId: "film" })
      .expect(200);

    const res = await request(socialApp)
      .post("/api/social/rooms/together-room/polls/daily-room-choice/vote")
      .set("x-user-id", userId)
      .send({ lang: "en", optionId: "views" })
      .expect(200);

    const views = res.body.vote.options.find((option: { id: string }) => option.id === "views");
    expect(res.body.pulse.activePoll.myVote).toBe("views");
    expect(views.votes).toBeGreaterThanOrEqual(1);

    await request(socialApp)
      .post("/api/social/rooms/together-room/quiet-pause")
      .set("x-user-id", userId)
      .send({ lang: "en", paused: true })
      .expect(200);

    const cleared = await request(socialApp)
      .post("/api/social/rooms/together-room/polls/daily-room-choice/vote")
      .set("x-user-id", userId)
      .send({ lang: "en", action: "clear" })
      .expect(200);

    const clearedViews = cleared.body.vote.options.find((option: { id: string }) => option.id === "views");
    expect(cleared.body.vote.optionId).toBeNull();
    expect(cleared.body.pulse.activePoll.myVote).toBeNull();
    expect(clearedViews.votes).toBeLessThan(views.votes);
    expect(cleared.body.pulse.safety.myQuietPausedAt).toEqual(expect.any(String));
  });

  it("shares Together Room vote and comfort totals without exposing another member's private choices", async () => {
    const privateUserId = "safe-haven-private-signals-user";
    const observerUserId = "safe-haven-private-signals-observer";

    await request(socialApp)
      .post("/api/social/rooms/together-room/comfort-check")
      .set("x-user-id", privateUserId)
      .send({ lang: "en", comfortNeeds: ["listen_first", "quiet_pace"] })
      .expect(200);

    await request(socialApp)
      .post("/api/social/rooms/together-room/polls/daily-room-choice/vote")
      .set("x-user-id", privateUserId)
      .send({ lang: "en", optionId: "lunch" })
      .expect(200);

    const observerPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", observerUserId)
      .expect(200);

    expect(observerPulse.body.pulse.comfortCheck.myComfortNeeds).toEqual([]);
    expect(
      observerPulse.body.pulse.comfortCheck.options.find((option: { id: string }) => option.id === "listen_first").count,
    ).toBeGreaterThanOrEqual(1);
    expect(
      observerPulse.body.pulse.comfortCheck.options.find((option: { id: string }) => option.id === "quiet_pace").count,
    ).toBeGreaterThanOrEqual(1);

    const lunch = observerPulse.body.pulse.activePoll.options.find((option: { id: string }) => option.id === "lunch");
    expect(observerPulse.body.pulse.activePoll.myVote).toBeNull();
    expect(lunch.votes).toBeGreaterThanOrEqual(1);
    expect(observerPulse.body.pulse.activePoll.totalVotes).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(observerPulse.body.pulse.memberPresence)).not.toContain(privateUserId);
    expect(observerPulse.body.pulse.memberPresence.some((member: { name?: string }) => (
      /^Member \d+$/.test(member.name ?? "")
    ))).toBe(true);
  });

  it("persists collaboration replies on the featured Together Room plan", async () => {
    const userId = "safe-haven-featured-plan-helper";

    const reply = await request(socialApp)
      .post("/api/social/rooms/together-room/plans/tea-film-chat/replies")
      .set("x-user-id", userId)
      .send({
        lang: "en",
        tone: "help",
        body: "I can help choose one simple option for the group.",
      })
      .expect(200);

    expect(reply.body.reply.tone).toBe("help");
    expect(reply.body.pulse.featuredPlan.replies[0].body).toMatch(/simple option/i);
    expect(reply.body.pulse.featuredPlan.myHelperActions).toContain("choose");

    const refreshed = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", userId)
      .expect(200);

    expect(
      refreshed.body.pulse.featuredPlan.replies.some((item: { body?: string }) => /simple option/i.test(item.body ?? "")),
    ).toBe(true);
    expect(refreshed.body.pulse.featuredPlan.myHelperActions).toContain("choose");

    await request(socialApp)
      .post("/api/social/rooms/together-room/quiet-pause")
      .set("x-user-id", userId)
      .send({ paused: true })
      .expect(200);

    const removed = await request(socialApp)
      .post("/api/social/rooms/together-room/plans/tea-film-chat/helpers/choose/clear")
      .set("x-user-id", userId)
      .send({ lang: "en" })
      .expect(200);

    expect(removed.body.helperAction).toMatchObject({
      planId: "tea-film-chat",
      action: "choose",
      removed: true,
    });
    expect(removed.body.pulse.featuredPlan.myHelperActions ?? []).not.toContain("choose");
    expect(removed.body.pulse.safety.myQuietPausedAt).toEqual(expect.any(String));

    const refreshedAfterRemove = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", userId)
      .expect(200);

    expect(refreshedAfterRemove.body.pulse.featuredPlan.myHelperActions ?? []).not.toContain("choose");
    expect(refreshedAfterRemove.body.pulse.safety.myQuietPausedAt).toEqual(expect.any(String));

    const observerPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", "safe-haven-featured-plan-helper-observer")
      .expect(200);

    expect(observerPulse.body.pulse.featuredPlan.myHelperActions ?? []).not.toContain("choose");
  });

  it("keeps repeated helper offers from creating duplicate activity replies", async () => {
    const userId = "safe-haven-duplicate-helper";
    const proposal = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", "safe-haven-duplicate-helper-owner")
      .send({
        lang: "en",
        kind: "plan",
        title: "Small garden visit duplicate helper",
        details: "A calm local garden visit with time to sit.",
        locationLabel: "nearby",
        comfortNeeds: ["quiet_pace", "seating"],
        experienceCategory: "outing",
        preferredTime: "afternoon",
        costRange: "low",
        groupSize: "small_group",
      })
      .expect(200);
    const planKey = proposal.body.proposal.planKey;

    const first = await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${planKey}/replies`)
      .set("x-user-id", userId)
      .send({
        lang: "en",
        tone: "support",
        body: "Please keep me posted when there is a next step.",
      })
      .expect(200);

    const second = await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${planKey}/replies`)
      .set("x-user-id", userId)
      .send({
        lang: "en",
        tone: "support",
        body: "Please keep me posted when there is a next step.",
      })
      .expect(200);

    expect(second.body.reply.id).toBe(first.body.reply.id);
    const activity = second.body.pulse.postedExperiences.find((item: { key?: string }) => item.key === planKey);
    expect(activity.myHelperActions).toContain("notify");
    expect(
      activity.replies.filter((reply: { body?: string }) => (
        reply.body === "Please keep me posted when there is a next step."
      )),
    ).toHaveLength(1);
  });

  it("keeps repeated proposal submissions from duplicating shared room ideas", async () => {
    const userId = "safe-haven-duplicate-proposal-user";
    const payload = {
      lang: "en",
      kind: "plan",
      title: "Duplicate-proof calm cafe walk",
      details: "A short cafe walk with time to sit and leave early.",
      locationLabel: "nearby",
      comfortNeeds: ["quiet_pace", "seating"],
      experienceCategory: "outing",
      preferredTime: "morning",
      costRange: "low",
      groupSize: "small_group",
    };

    const first = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", userId)
      .send(payload)
      .expect(200);
    const second = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", userId)
      .send(payload)
      .expect(200);

    expect(second.body.proposal.planKey).toBe(first.body.proposal.planKey);
    expect(second.body.pulse.postedExperiences.filter(
      (plan: { title?: string }) => plan.title === payload.title,
    )).toHaveLength(1);
    expect(second.body.pulse.notifications.filter(
      (notification: { type?: string; metadata?: Record<string, unknown> }) => (
        notification.type === "proposal_created" &&
        notification.metadata?.planKey === first.body.proposal.planKey
      ),
    )).toHaveLength(1);

    const moderation = await request(bypassAdminApp)
      .get("/api/admin/social/rooms/together-room/moderation")
      .expect(200);
    expect(moderation.body.proposals.filter(
      (plan: { userId?: string; title?: string }) => (
        plan.userId === userId &&
        plan.title === payload.title
      ),
    )).toHaveLength(1);
  });

  it("lets a member withdraw only their own shared Together Room item", async () => {
    const ownerId = "safe-haven-withdraw-owner";
    const observerId = "safe-haven-withdraw-observer";
    const proposal = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", ownerId)
      .send({
        lang: "en",
        kind: "message",
        title: "A calm view I may remove",
        details: "I would like a short quiet check-in before choosing.",
      })
      .expect(200);
    const planKey = proposal.body.proposal.planKey;

    const ownItem = proposal.body.pulse.postedExperiences.find((item: { key?: string }) => item.key === planKey);
    expect(ownItem.ownedByMe).toBe(true);

    const observerPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", observerId)
      .expect(200);
    const observerItem = observerPulse.body.pulse.postedExperiences.find((item: { key?: string }) => item.key === planKey);
    expect(observerItem.ownedByMe).toBe(false);

    const blocked = await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${planKey}/withdraw`)
      .set("x-user-id", observerId)
      .send({ lang: "en" })
      .expect(200);
    expect(blocked.body.withdrawnItem.withdrawn).toBe(false);
    expect(blocked.body.pulse.postedExperiences.some((item: { key?: string }) => item.key === planKey)).toBe(true);

    await request(socialApp)
      .post("/api/social/rooms/together-room/quiet-pause")
      .set("x-user-id", ownerId)
      .send({ paused: true })
      .expect(200);

    const withdrawn = await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${planKey}/withdraw`)
      .set("x-user-id", ownerId)
      .send({ lang: "en" })
      .expect(200);
    expect(withdrawn.body.withdrawnItem).toMatchObject({ planId: planKey, withdrawn: true });
    expect(withdrawn.body.pulse.postedExperiences.some((item: { key?: string }) => item.key === planKey)).toBe(false);
    expect(withdrawn.body.pulse.safety.myQuietPausedAt).toEqual(expect.any(String));

    const refreshed = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", ownerId)
      .expect(200);
    expect(refreshed.body.pulse.postedExperiences.some((item: { key?: string }) => item.key === planKey)).toBe(false);
    expect(refreshed.body.pulse.safety.myQuietPausedAt).toEqual(expect.any(String));
  });

  it("creates one calm activity-ready notification when interest and helpers line up", async () => {
    const userId = "safe-haven-activity-ready-member";
    const planKey = "gentle-walk";

    const interest = await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${planKey}/respond`)
      .set("x-user-id", userId)
      .send({ lang: "en", response: "maybe" })
      .expect(200);

    expect(
      interest.body.pulse.notifications.some((notification: { type?: string }) => (
        notification.type === "activity_ready"
      )),
    ).toBe(false);

    const helper = await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${planKey}/replies`)
      .set("x-user-id", userId)
      .send({
        lang: "en",
        tone: "help",
        body: "I can help choose one simple option for the group.",
      })
      .expect(200);

    const readyNotifications = helper.body.pulse.notifications.filter((notification: { type?: string }) => (
      notification.type === "activity_ready"
    ));
    expect(readyNotifications).toHaveLength(1);
    expect(readyNotifications[0].title).toMatch(/activity is ready for VYVA/i);
    expect(readyNotifications[0].body).toMatch(/Gentle walk/i);
    expect(readyNotifications[0].body).toMatch(/before anyone commits/i);
    expect(readyNotifications[0].metadata).toMatchObject({
      planKey,
      interestCount: 1,
      helperCount: 1,
    });

    const secondHelper = await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${planKey}/replies`)
      .set("x-user-id", userId)
      .send({
        lang: "en",
        tone: "support",
        body: "Please keep me posted when there is a next step.",
      })
      .expect(200);

    expect(
      secondHelper.body.pulse.notifications.filter((notification: { type?: string }) => (
        notification.type === "activity_ready"
      )),
    ).toHaveLength(1);
  });

  it("shares activity-ready updates with the activity owner and interested members", async () => {
    const ownerId = "safe-haven-owned-ready-activity-owner";
    const interestedId = "safe-haven-owned-ready-activity-interested";
    const helperId = "safe-haven-owned-ready-activity-helper";

    const proposal = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", ownerId)
      .send({
        lang: "en",
        title: "Tuesday tea walk",
        details: "A short gentle walk with tea afterwards.",
        locationLabel: "nearby",
        comfortNeeds: ["quiet_pace", "seating"],
        kind: "plan",
        experienceCategory: "outing",
        preferredTime: "morning",
        costRange: "low",
        groupSize: "small_group",
      })
      .expect(200);

    const planKey = proposal.body.proposal.planKey;

    const interest = await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${planKey}/respond`)
      .set("x-user-id", interestedId)
      .send({ lang: "en", response: "maybe" })
      .expect(200);

    expect(
      interest.body.pulse.notifications.some((notification: { type?: string; metadata?: Record<string, unknown> }) => (
        notification.type === "activity_ready" &&
        notification.metadata?.planKey === planKey
      )),
    ).toBe(false);

    const helper = await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${planKey}/replies`)
      .set("x-user-id", helperId)
      .send({
        lang: "en",
        tone: "help",
        body: "I can help choose one simple option for the group.",
      })
      .expect(200);

    expect(
      helper.body.pulse.notifications.some((notification: { type?: string; metadata?: Record<string, unknown> }) => (
        notification.type === "activity_ready" &&
        notification.metadata?.planKey === planKey
      )),
    ).toBe(true);

    const ownerPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", ownerId)
      .expect(200);
    const interestedPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", interestedId)
      .expect(200);

    for (const pulse of [ownerPulse.body.pulse, interestedPulse.body.pulse]) {
      const readyNotifications = pulse.notifications.filter((notification: { type?: string; metadata?: Record<string, unknown> }) => (
        notification.type === "activity_ready" &&
        notification.metadata?.planKey === planKey
      ));
      expect(readyNotifications).toHaveLength(1);
      expect(readyNotifications[0].title).toMatch(/activity is ready for VYVA/i);
      expect(readyNotifications[0].body).toMatch(/Tuesday tea walk/i);
      expect(readyNotifications[0].metadata).toMatchObject({
        planKey,
        interestCount: 1,
        helperCount: 1,
      });
    }
  });

  it("creates one calm vote-ready notification when a question gets support", async () => {
    const ownerId = "safe-haven-vote-ready-owner";
    const supporterId = "safe-haven-vote-ready-supporter";

    const proposal = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", ownerId)
      .send({
        lang: "en",
        title: "Can we vote on cost first?",
        details: "I want to understand the cost before anyone commits.",
        kind: "question",
      })
      .expect(200);

    const planKey = proposal.body.proposal.planKey;
    const support = await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${planKey}/respond`)
      .set("x-user-id", supporterId)
      .send({ lang: "en", response: "join" })
      .expect(200);

    const readyNotifications = support.body.pulse.notifications.filter((notification: { type?: string }) => (
      notification.type === "vote_ready"
    ));
    expect(readyNotifications).toHaveLength(1);
    expect(readyNotifications[0].title).toMatch(/question is ready for a vote/i);
    expect(readyNotifications[0].body).toMatch(/Can we vote on cost first\?/i);
    expect(readyNotifications[0].body).toMatch(/without names/i);
    expect(readyNotifications[0].metadata).toMatchObject({
      planKey,
      supportCount: 1,
    });
    expect(support.body.pulse.issuePolls).toHaveLength(1);
    expect(support.body.pulse.issuePolls[0]).toMatchObject({
      key: `issue-${planKey}`,
      sourcePlanKey: planKey,
      question: "Vote: Can we vote on cost first?",
      totalVotes: 0,
    });
    expect(support.body.pulse.issuePolls[0].options.map((option: { id: string }) => option.id)).toEqual([
      "yes",
      "more_info",
      "not_now",
    ]);

    const firstIssueVote = await request(socialApp)
      .post(`/api/social/rooms/together-room/polls/issue-${planKey}/vote`)
      .set("x-user-id", supporterId)
      .send({ lang: "en", optionId: "yes" })
      .expect(200);

    expect(firstIssueVote.body.vote.pollId).toBe(`issue-${planKey}`);
    expect(firstIssueVote.body.vote.totalVotes).toBe(1);
    expect(firstIssueVote.body.pulse.issuePolls[0].myVote).toBe("yes");

    const replacedIssueVote = await request(socialApp)
      .post(`/api/social/rooms/together-room/polls/issue-${planKey}/vote`)
      .set("x-user-id", supporterId)
      .send({ lang: "en", optionId: "more_info" })
      .expect(200);

    const replacementPoll = replacedIssueVote.body.pulse.issuePolls[0];
    expect(replacementPoll.totalVotes).toBe(1);
    expect(replacementPoll.myVote).toBe("more_info");
    expect(replacementPoll.options.find((option: { id: string }) => option.id === "yes").votes).toBe(0);
    expect(replacementPoll.options.find((option: { id: string }) => option.id === "more_info").votes).toBe(1);

    await request(socialApp)
      .post("/api/social/rooms/together-room/quiet-pause")
      .set("x-user-id", supporterId)
      .send({ lang: "en", paused: true })
      .expect(200);

    const clearedIssueVote = await request(socialApp)
      .post(`/api/social/rooms/together-room/polls/issue-${planKey}/vote`)
      .set("x-user-id", supporterId)
      .send({ lang: "en", action: "clear" })
      .expect(200);

    const clearedPoll = clearedIssueVote.body.pulse.issuePolls[0];
    expect(clearedIssueVote.body.vote.optionId).toBeNull();
    expect(clearedPoll.totalVotes).toBe(0);
    expect(clearedPoll.myVote).toBeNull();
    expect(clearedPoll.options.find((option: { id: string }) => option.id === "more_info").votes).toBe(0);
    expect(clearedIssueVote.body.pulse.safety.myQuietPausedAt).toEqual(expect.any(String));

    const follow = await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${planKey}/respond`)
      .set("x-user-id", supporterId)
      .send({ lang: "en", response: "maybe" })
      .expect(200);

    expect(
      follow.body.pulse.notifications.filter((notification: { type?: string }) => (
        notification.type === "vote_ready"
      )),
    ).toHaveLength(1);

    const ownerPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", ownerId)
      .expect(200);
    const ownerVoteReady = ownerPulse.body.pulse.notifications.filter((notification: { type?: string; metadata?: Record<string, unknown> }) => (
      notification.type === "vote_ready" &&
      notification.metadata?.planKey === planKey
    ));
    expect(ownerVoteReady).toHaveLength(1);
    expect(ownerVoteReady[0].title).toMatch(/question is ready for a vote/i);
    expect(ownerVoteReady[0].body).toMatch(/Can we vote on cost first\?/i);
  });

  it("honors issue poll moderation in the local Together Room pulse", async () => {
    const ownerId = "safe-haven-moderated-issue-owner";
    const supporterId = "safe-haven-moderated-issue-supporter";
    const voterId = "safe-haven-moderated-issue-voter";

    const proposal = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", ownerId)
      .send({
        lang: "en",
        title: "Should we choose the quietest cafe?",
        details: "I want the room to decide before anyone makes a plan.",
        kind: "question",
      })
      .expect(200);

    const planKey = proposal.body.proposal.planKey;
    const pollKey = `issue-${planKey}`;
    await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${planKey}/respond`)
      .set("x-user-id", supporterId)
      .send({ lang: "en", response: "join" })
      .expect(200);

    await request(bypassAdminApp)
      .patch(`/api/admin/social/polls/${pollKey}`)
      .send({ status: "closed", roomSlug: "together-room", notes: "Pause while VYVA reviews the question." })
      .expect(200);

    const closedPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", voterId)
      .expect(200);
    const closedIssue = closedPulse.body.pulse.issuePolls.find((poll: { key?: string }) => poll.key === pollKey);
    expect(closedIssue).toMatchObject({
      key: pollKey,
      sourcePlanKey: planKey,
      status: "closed",
    });

    const blockedVote = await request(socialApp)
      .post(`/api/social/rooms/together-room/polls/${pollKey}/vote`)
      .set("x-user-id", voterId)
      .send({ lang: "en", optionId: "yes" })
      .expect(400);
    expect(blockedVote.body.error).toMatch(/closed/i);

    await request(bypassAdminApp)
      .patch(`/api/admin/social/polls/${pollKey}`)
      .send({ status: "hidden", roomSlug: "together-room", notes: "Hide from the senior room while reviewing." })
      .expect(200);

    const hiddenPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", voterId)
      .expect(200);
    expect(
      hiddenPulse.body.pulse.issuePolls.some((poll: { key?: string }) => poll.key === pollKey),
    ).toBe(false);
  });

  it("supports gentle replies on shared Together Room ideas with reporting and moderation", async () => {
    const ownerId = "safe-haven-reply-owner";
    const replierId = "safe-haven-reply-member";

    const proposal = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", ownerId)
      .send({
        lang: "en",
        title: "A calm cafe idea",
        details: "I would like a quiet place for a short conversation.",
        kind: "message",
      })
      .expect(200);

    const reply = await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${proposal.body.proposal.planKey}/replies`)
      .set("x-user-id", replierId)
      .send({
        lang: "en",
        tone: "help",
        body: "I can help with one small step inside the room.",
      })
      .expect(200);

    expect(reply.body.reply.body).toBe("I can help with one small step inside the room.");
    expect(reply.body.reply.tone).toBe("help");
    expect(reply.body.pulse.postedExperiences[0].replies[0].body).toMatch(/can help/i);

    const repeatedReply = await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${proposal.body.proposal.planKey}/replies`)
      .set("x-user-id", replierId)
      .send({
        lang: "en",
        tone: "help",
        body: "I can help with one small step inside the room.",
      })
      .expect(200);

    expect(repeatedReply.body.reply.id).toBe(reply.body.reply.id);
    expect(repeatedReply.body.pulse.postedExperiences[0].replies.filter(
      (item: { body?: string }) => /can help with one small step/i.test(item.body ?? ""),
    )).toHaveLength(1);

    const ownerPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", ownerId)
      .expect(200);

    expect(ownerPulse.body.pulse.postedExperiences[0].replies.filter(
      (item: { body?: string }) => /can help with one small step/i.test(item.body ?? ""),
    )).toHaveLength(1);
    const replyNotifications = ownerPulse.body.pulse.notifications.filter((notification: { id: string; type: string; title: string; body: string }) => (
      notification.type === "reply_added" &&
      /Someone replied gently/i.test(notification.title) &&
      /A calm cafe idea/i.test(notification.body)
    ));
    expect(replyNotifications).toHaveLength(1);
    const replyNotification = replyNotifications[0];
    expect(replyNotification).toBeTruthy();
    const replyNotificationId = replyNotification?.id ?? "";
    expect(replyNotificationId).toEqual(expect.any(String));

    const readNotification = await request(socialApp)
      .post(`/api/social/rooms/together-room/notifications/${replyNotificationId}/read`)
      .set("x-user-id", ownerId)
      .send({ lang: "en" })
      .expect(200);
    expect(readNotification.body.readAt).toEqual(expect.any(String));
    expect(
      readNotification.body.pulse.notifications.some((notification: { id: string }) => (
        notification.id === replyNotificationId
      )),
    ).toBe(false);

    const report = await request(socialApp)
      .post("/api/social/rooms/together-room/safety-reports")
      .set("x-user-id", ownerId)
      .send({
        lang: "en",
        reason: "reply_review",
        targetType: "reply",
        targetId: reply.body.reply.id,
        details: "Please review this reply.",
      })
      .expect(200);

    expect(report.body.report.targetType).toBe("reply");
    expect(report.body.report.targetId).toBe(reply.body.reply.id);

    const moderation = await request(bypassAdminApp)
      .get("/api/admin/social/rooms/together-room/moderation")
      .expect(200);
    expect(
      moderation.body.replies.some((item: { id?: string; body?: string }) => (
        item.id === reply.body.reply.id && /can help/i.test(item.body ?? "")
      )),
    ).toBe(true);

    await request(bypassAdminApp)
      .patch(`/api/admin/social/replies/${reply.body.reply.id}`)
      .send({ status: "hidden", roomSlug: "together-room" })
      .expect(200);

    const moderated = await request(bypassAdminApp)
      .get("/api/admin/social/rooms/together-room/moderation")
      .expect(200);
    expect(
      moderated.body.replies.some((item: { id?: string; status?: string }) => (
        item.id === reply.body.reply.id && item.status === "hidden"
      )),
    ).toBe(true);
  });

  it("lets a member withdraw only their own gentle Together Room reply", async () => {
    const ownerId = "safe-haven-reply-withdraw-owner";
    const replierId = "safe-haven-reply-withdraw-member";
    const observerId = "safe-haven-reply-withdraw-observer";

    const proposal = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", ownerId)
      .send({
        lang: "en",
        title: "A quiet morning idea",
        details: "I would enjoy a gentle check-in before choosing.",
        kind: "message",
      })
      .expect(200);
    const planKey = proposal.body.proposal.planKey as string;

    const reply = await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${planKey}/replies`)
      .set("x-user-id", replierId)
      .send({
        lang: "en",
        tone: "support",
        body: "That sounds gentle to me too.",
      })
      .expect(200);
    const replyId = reply.body.reply.id as string;
    expect(reply.body.reply).toMatchObject({ id: replyId, ownedByMe: true });
    expect(reply.body.pulse.postedExperiences[0].replies[0]).toMatchObject({ id: replyId, ownedByMe: true });

    const ownerPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", ownerId)
      .expect(200);
    const ownerReply = ownerPulse.body.pulse.postedExperiences
      .find((item: { key?: string }) => item.key === planKey)
      ?.replies.find((item: { id?: string }) => item.id === replyId);
    expect(ownerReply).toMatchObject({ id: replyId, ownedByMe: false });

    const blocked = await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${planKey}/replies/${replyId}/withdraw`)
      .set("x-user-id", observerId)
      .send({ lang: "en" })
      .expect(200);
    expect(blocked.body.withdrawnReply).toMatchObject({ planId: planKey, replyId, withdrawn: false });
    expect(
      blocked.body.pulse.postedExperiences
        .find((item: { key?: string }) => item.key === planKey)
        ?.replies.some((item: { id?: string }) => item.id === replyId),
    ).toBe(true);

    await request(socialApp)
      .post("/api/social/rooms/together-room/quiet-pause")
      .set("x-user-id", replierId)
      .send({ lang: "en", paused: true })
      .expect(200);

    const withdrawn = await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${planKey}/replies/${replyId}/withdraw`)
      .set("x-user-id", replierId)
      .send({ lang: "en" })
      .expect(200);
    expect(withdrawn.body.withdrawnReply).toMatchObject({ planId: planKey, replyId, withdrawn: true });
    expect(
      withdrawn.body.pulse.postedExperiences
        .find((item: { key?: string }) => item.key === planKey)
        ?.replies.some((item: { id?: string }) => item.id === replyId),
    ).toBe(false);
    expect(withdrawn.body.pulse.safety.myQuietPausedAt).toEqual(expect.any(String));

    const refreshedOwner = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", ownerId)
      .expect(200);
    expect(
      refreshedOwner.body.pulse.postedExperiences
        .find((item: { key?: string }) => item.key === planKey)
        ?.replies.some((item: { id?: string }) => item.id === replyId),
    ).toBe(false);
  });

  it("marks all Together Room updates seen in one calm action", async () => {
    const ownerId = "safe-haven-read-all-owner";
    const replierId = "safe-haven-read-all-replier";
    const joinerId = "safe-haven-read-all-joiner";

    const proposal = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", ownerId)
      .send({
        lang: "en",
        title: "Quiet garden chat",
        details: "A short calm chat with time to listen first.",
        kind: "plan",
        locationLabel: "nearby",
        comfortNeeds: ["listen_first", "quiet_pace", "seating"],
      })
      .expect(200);

    await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${proposal.body.proposal.planKey}/replies`)
      .set("x-user-id", replierId)
      .send({
        lang: "en",
        tone: "support",
        body: "I feel the same and can listen first.",
      })
      .expect(200);

    await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${proposal.body.proposal.planKey}/respond`)
      .set("x-user-id", joinerId)
      .send({ lang: "en", response: "join" })
      .expect(200);

    const ownerPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", ownerId)
      .expect(200);

    const unreadIds = ownerPulse.body.pulse.notifications.map((notification: { id: string }) => notification.id);
    expect(unreadIds.length).toBeGreaterThanOrEqual(2);
    expect(ownerPulse.body.pulse.unreadNotificationCount).toBeGreaterThanOrEqual(2);

    const readAll = await request(socialApp)
      .post("/api/social/rooms/together-room/notifications/read-all")
      .set("x-user-id", ownerId)
      .send({ lang: "en" })
      .expect(200);

    expect(readAll.body.readAt).toEqual(expect.any(String));
    expect(readAll.body.notificationIds).toEqual(expect.arrayContaining(unreadIds));
    expect(readAll.body.pulse.notifications).toHaveLength(0);
    expect(readAll.body.pulse.unreadNotificationCount).toBe(0);
  });

  it("blocks unsafe reply text before it can share protected contact or payment details", async () => {
    const ownerId = "safe-haven-blocked-reply-owner";
    const replierId = "safe-haven-blocked-reply-member";

    const proposal = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", ownerId)
      .send({
        lang: "en",
        title: "Quiet afternoon plan",
        details: "A simple online hello first.",
        kind: "message",
      })
      .expect(200);

    const blocked = await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${proposal.body.proposal.planKey}/replies`)
      .set("x-user-id", replierId)
      .send({
        lang: "en",
        tone: "curious",
        body: "Email me at private@example.com and I can send a payment link.",
      })
      .expect(400);

    expect(blocked.body.error).toMatch(/VYVA review/i);

    await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${proposal.body.proposal.planKey}/replies`)
      .set("x-user-id", replierId)
      .send({
        lang: "en",
        tone: "curious",
        body: "Email me at private@example.com and I can send a payment link.",
      })
      .expect(400);

    const moderation = await request(bypassAdminApp)
      .get("/api/admin/social/rooms/together-room/moderation")
      .expect(200);

    expect(
      moderation.body.reports.filter((item: { reason?: string; targetType?: string; targetId?: string; details?: string }) => (
        item.reason === "blocked_reply_safety" &&
        item.targetType === "plan" &&
        item.targetId === proposal.body.proposal.planKey &&
        /protected contact/i.test(item.details ?? "")
      )),
    ).toHaveLength(1);
    expect(
      moderation.body.reports.some((item: { reason?: string; targetType?: string; targetId?: string; details?: string }) => (
        item.reason === "blocked_reply_safety" &&
        item.targetType === "plan" &&
        item.targetId === proposal.body.proposal.planKey &&
        /protected contact/i.test(item.details ?? "") &&
        !/private@example\.com/i.test(item.details ?? "")
      )),
    ).toBe(true);
    expect(
      moderation.body.replies.some((item: { body?: string }) => /private@example\.com/i.test(item.body ?? "")),
    ).toBe(false);

    const unkind = await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${proposal.body.proposal.planKey}/replies`)
      .set("x-user-id", "safe-haven-unkind-reply-member")
      .send({
        lang: "en",
        tone: "different",
        body: "That idea is stupid and you are an idiot.",
      })
      .expect(400);

    expect(unkind.body.error).toMatch(/VYVA review/i);
    expect(unkind.body.safetyFlags).toContain("unkind_tone");

    const toneModeration = await request(bypassAdminApp)
      .get("/api/admin/social/rooms/together-room/moderation")
      .expect(200);
    expect(
      toneModeration.body.reports.some((item: { reason?: string; targetId?: string; details?: string }) => (
        item.reason === "blocked_reply_safety" &&
        item.targetId === proposal.body.proposal.planKey &&
        /unkind_tone/i.test(item.details ?? "")
      )),
    ).toBe(true);
    expect(
      toneModeration.body.replies.some((item: { body?: string }) => /stupid|idiot/i.test(item.body ?? "")),
    ).toBe(false);
  });

  it("holds Spanish and German housing service transport and payment proposals for VYVA review", async () => {
    const housingProposal = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", "safe-haven-es-housing-user")
      .send({
        lang: "es",
        title: "Compartir piso tranquilo",
        details: "Busco habitacion en alquiler con contrato y fianza.",
        kind: "plan",
        locationLabel: "nearby",
        experienceCategory: "other",
      })
      .expect(200);

    expect(housingProposal.body.proposal.safetyFlags).toContain("housing");
    expect(housingProposal.body.proposal.safetyFlags).toContain("money");
    expect(housingProposal.body.proposal.status).toBe("pending_review");
    expect(
      housingProposal.body.pulse.postedExperiences.some((item: { key?: string }) => (
        item.key === housingProposal.body.proposal.planKey
      )),
    ).toBe(false);

    const serviceProposal = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", "safe-haven-de-service-user")
      .send({
        lang: "de",
        title: "Handwerker fuer Reparatur",
        details: "Kann jemand eine Dienstleistung oder Reparatur buchen?",
        kind: "question",
        locationLabel: "online",
      })
      .expect(200);

    expect(serviceProposal.body.proposal.safetyFlags).toContain("service");
    expect(serviceProposal.body.proposal.status).toBe("pending_review");
    expect(
      serviceProposal.body.pulse.postedExperiences.some((item: { key?: string }) => (
        item.key === serviceProposal.body.proposal.planKey
      )),
    ).toBe(false);

    const transportProposal = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", "safe-haven-es-transport-user")
      .send({
        lang: "es",
        title: "Taxi para ir juntos",
        details: "Podemos pagar el viaje con tarjeta y que un conductor nos recoja.",
        kind: "plan",
        locationLabel: "nearby",
        experienceCategory: "outing",
      })
      .expect(200);

    expect(transportProposal.body.proposal.safetyFlags).toContain("transport");
    expect(transportProposal.body.proposal.safetyFlags).toContain("money");
    expect(transportProposal.body.proposal.status).toBe("pending_review");
    expect(
      transportProposal.body.pulse.postedExperiences.some((item: { key?: string }) => (
        item.key === transportProposal.body.proposal.planKey
      )),
    ).toBe(false);
  });

  it("validates proposals and accepts safety reports", async () => {
    await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", "safe-haven-proposal-user")
      .send({ lang: "en", title: "" })
      .expect(400);

    const proposal = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", "safe-haven-proposal-user")
      .send({
        lang: "en",
        title: "Can VYVA help me choose?",
        details: "I would like a gentle suggestion.",
        kind: "question",
      })
      .expect(200);

    expect(proposal.body.proposal.kind).toBe("question");
    expect(proposal.body.pulse.postedExperiences[0].kind).toBe("question");

    const activityProposal = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", "safe-haven-activity-proposal-user")
      .send({
        lang: "en",
        title: "Tea at a quiet cafe",
        details: "Friday afternoon, nearby if possible.",
        kind: "plan",
        locationLabel: "nearby",
        comfortNeeds: ["listen_first", "quiet_pace", "easy_access", "transport_help", "arrival_buddy", "clear_cost"],
        experienceCategory: "restaurant_date",
        preferredTime: "afternoon",
        costRange: "shared",
        groupSize: "small_group",
      })
      .expect(200);

    expect(activityProposal.body.proposal.comfortNeeds).toEqual(["listen_first", "quiet_pace", "easy_access", "transport_help", "arrival_buddy", "clear_cost"]);
    expect(activityProposal.body.proposal.experienceCategory).toBe("restaurant_date");
    expect(activityProposal.body.proposal.preferredTime).toBe("afternoon");
    expect(activityProposal.body.proposal.costRange).toBe("shared");
    expect(activityProposal.body.proposal.groupSize).toBe("small_group");
    expect(activityProposal.body.proposal.needsReview).toBe(false);
    expect(activityProposal.body.pulse.postedExperiences[0].comfortNeeds).toEqual(["listen_first", "quiet_pace", "easy_access", "transport_help", "arrival_buddy", "clear_cost"]);
    expect(activityProposal.body.pulse.postedExperiences[0].fitReasons).toContain("Afternoon");
    expect(
      activityProposal.body.pulse.notifications.some((notification: { type?: string; title?: string; body?: string }) => (
        notification.type === "proposal_created" &&
        /Tea at a quiet cafe/i.test(notification.title ?? "") &&
        /Friday afternoon/i.test(notification.body ?? "")
      )),
    ).toBe(true);

    const dealProposal = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", "safe-haven-deal-proposal-user")
      .send({
        lang: "en",
        title: "Help me negotiate a deposit",
        details: "I want to compare the price before I pay.",
        kind: "plan",
        locationLabel: "online",
        experienceCategory: "deal_help",
        preferredTime: "morning",
        costRange: "discuss",
        groupSize: "one_to_one",
      })
      .expect(200);

    expect(dealProposal.body.proposal.safetyFlags).toContain("money");
    expect(dealProposal.body.proposal.needsReview).toBe(true);
    expect(dealProposal.body.proposal.status).toBe("pending_review");
    expect(
      dealProposal.body.pulse.postedExperiences.some((item: { key?: string }) => (
        item.key === dealProposal.body.proposal.planKey
      )),
    ).toBe(false);

    const contactMessage = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", "safe-haven-contact-message-user")
      .send({
        lang: "en",
        title: "Can we talk outside the app?",
        details: "My phone number is 555-0100 and I can send payment details.",
        kind: "message",
        locationLabel: "online",
      })
      .expect(200);

    expect(contactMessage.body.proposal.kind).toBe("message");
    expect(contactMessage.body.proposal.safetyFlags).toContain("private_contact");
    expect(contactMessage.body.proposal.safetyFlags).toContain("money");
    expect(contactMessage.body.proposal.needsReview).toBe(true);
    expect(contactMessage.body.proposal.status).toBe("pending_review");
    expect(
      contactMessage.body.pulse.postedExperiences.some((item: { key?: string }) => (
        item.key === contactMessage.body.proposal.planKey
      )),
    ).toBe(false);
    const contactNotifications = contactMessage.body.pulse.notifications as Array<{ type?: string; title?: string; body?: string }>;
    expect(
      contactNotifications.some((notification) => (
        notification.type === "proposal_review_pending" &&
        /VYVA will review this before it appears/i.test(notification.title ?? "") &&
        /room will not see/i.test(notification.body ?? "")
      )),
    ).toBe(true);
    expect(
      contactNotifications.some((notification) => (
        /555-0100|payment details|Can we talk outside/i.test(`${notification.title ?? ""} ${notification.body ?? ""}`)
      )),
    ).toBe(false);

    const rawNumberMessage = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", "safe-haven-raw-number-message-user")
      .send({
        lang: "en",
        title: "Quiet cafe follow-up",
        details: "Reach me at 555-0100 and use 4111 1111 1111 1111.",
        kind: "message",
        locationLabel: "online",
      })
      .expect(200);

    expect(rawNumberMessage.body.proposal.kind).toBe("message");
    expect(rawNumberMessage.body.proposal.safetyFlags).toContain("private_contact");
    expect(rawNumberMessage.body.proposal.safetyFlags).toContain("money");
    expect(rawNumberMessage.body.proposal.needsReview).toBe(true);
    expect(rawNumberMessage.body.proposal.status).toBe("pending_review");
    expect(
      rawNumberMessage.body.pulse.postedExperiences.some((item: { key?: string }) => (
        item.key === rawNumberMessage.body.proposal.planKey
      )),
    ).toBe(false);
    const rawNumberNotifications = rawNumberMessage.body.pulse.notifications as Array<{ type?: string; title?: string; body?: string }>;
    expect(
      rawNumberNotifications.some((notification) => notification.type === "proposal_review_pending"),
    ).toBe(true);
    expect(
      rawNumberNotifications.some((notification) => (
        /555-0100|4111 1111/i.test(`${notification.title ?? ""} ${notification.body ?? ""}`)
      )),
    ).toBe(false);

    const unkindMessage = await request(socialApp)
      .post("/api/social/rooms/together-room/proposals")
      .set("x-user-id", "safe-haven-unkind-message-user")
      .send({
        lang: "en",
        title: "Another view",
        details: "That idea is stupid and you are an idiot.",
        kind: "message",
        locationLabel: "online",
      })
      .expect(200);

    expect(unkindMessage.body.proposal.kind).toBe("message");
    expect(unkindMessage.body.proposal.safetyFlags).toContain("unkind_tone");
    expect(unkindMessage.body.proposal.needsReview).toBe(true);
    expect(unkindMessage.body.proposal.status).toBe("pending_review");
    expect(
      unkindMessage.body.pulse.postedExperiences.some((item: { key?: string }) => (
        item.key === unkindMessage.body.proposal.planKey
      )),
    ).toBe(false);
    const unkindNotifications = unkindMessage.body.pulse.notifications as Array<{ type?: string; title?: string; body?: string }>;
    expect(
      unkindNotifications.some((notification) => (
        /stupid|idiot/i.test(`${notification.title ?? ""} ${notification.body ?? ""}`)
      )),
    ).toBe(false);

    await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${dealProposal.body.proposal.planKey}/respond`)
      .set("x-user-id", "safe-haven-held-plan-response-user")
      .send({ lang: "en", response: "join" })
      .expect(400);

    await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${dealProposal.body.proposal.planKey}/replies`)
      .set("x-user-id", "safe-haven-held-plan-reply-user")
      .send({
        lang: "en",
        tone: "support",
        body: "I feel the same. Thank you for sharing it.",
      })
      .expect(400);

    await request(socialApp)
      .post(`/api/social/rooms/together-room/plans/${proposal.body.proposal.planKey}/respond`)
      .set("x-user-id", "safe-haven-response-user")
      .send({ lang: "en", response: "join" })
      .expect(200);

    const ownerPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", "safe-haven-proposal-user")
      .expect(200);
    expect(
      ownerPulse.body.pulse.notifications.some((notification: { type: string; title: string; body: string }) => (
        notification.type === "plan_joined" &&
        /Someone joined your idea/i.test(notification.title) &&
        /Can VYVA help me choose/i.test(notification.body)
      )),
    ).toBe(true);

    await request(socialApp)
      .post("/api/social/rooms/together-room/safety-reports")
      .set("x-user-id", "safe-haven-report-user")
      .send({ lang: "en", reason: "shared_item_review", targetType: "question" })
      .expect(400);

    const report = await request(socialApp)
      .post("/api/social/rooms/together-room/safety-reports")
      .set("x-user-id", "safe-haven-report-user")
      .send({
        lang: "en",
        reason: "shared_item_review",
        targetType: "question",
        targetId: "experience-question-1",
        details: "I want VYVA to check this shared question.",
      })
      .expect(200);

    expect(report.body.reportId).toEqual(expect.any(String));
    expect(report.body.report.targetType).toBe("question");
    expect(report.body.report.targetId).toBe("experience-question-1");
    expect(report.body.pulse.safety.reportedItemKeys).toContain("plan:experience-question-1");
    expect(report.body.pulse.safety.reportedItemStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemKey: "plan:experience-question-1", status: "open" }),
      ]),
    );
    expect(
      report.body.pulse.notifications.some((notification: { type?: string; title?: string; body?: string }) => (
        notification.type === "safety_report_sent" &&
        /VYVA will review your request/i.test(notification.title ?? "") &&
        /room will not see/i.test(notification.body ?? "")
      )),
    ).toBe(true);
    expect(
      report.body.pulse.notifications.some((notification: { body?: string }) => (
        /I want VYVA to check this shared question/i.test(notification.body ?? "")
      )),
    ).toBe(false);

    const reportUserPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", "safe-haven-report-user")
      .expect(200);
    expect(reportUserPulse.body.pulse.safety.reportedItemKeys).toContain("plan:experience-question-1");
    expect(reportUserPulse.body.pulse.safety.reportedItemStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemKey: "plan:experience-question-1", status: "open" }),
      ]),
    );

    const otherUserPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", "safe-haven-report-other-user")
      .expect(200);
    expect(otherUserPulse.body.pulse.safety.reportedItemKeys ?? []).not.toContain("plan:experience-question-1");

    await request(bypassAdminApp)
      .patch(`/api/admin/social/reports/${report.body.reportId}`)
      .send({
        status: "reviewing",
        roomSlug: "together-room",
        lang: "en",
        notes: "Checking this shared question before it stays visible.",
      })
      .expect(200);

    const reviewedReportPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", "safe-haven-report-user")
      .expect(200);
    expect(reviewedReportPulse.body.pulse.safety.reportedItemStatuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemKey: "plan:experience-question-1", status: "reviewing" }),
      ]),
    );
    expect(
      reviewedReportPulse.body.pulse.notifications.some((notification: { type?: string; title?: string; body?: string; metadata?: Record<string, unknown> }) => (
        notification.type === "safety_report_reviewed" &&
        /checking your report/i.test(notification.title ?? "") &&
        /reviewed privately/i.test(notification.body ?? "") &&
        notification.metadata?.reportId === report.body.reportId
      )),
    ).toBe(true);
    expect(
      reviewedReportPulse.body.pulse.notifications.some((notification: { body?: string }) => (
        /Checking this shared question before it stays visible/i.test(notification.body ?? "")
      )),
    ).toBe(false);

    const moderation = await request(bypassAdminApp)
      .get("/api/admin/social/rooms/together-room/moderation")
      .expect(200);
    expect(
      moderation.body.proposals.some((item: { planKey?: string; status?: string; needsReview?: boolean }) => (
        item.planKey === dealProposal.body.proposal.planKey &&
        item.status === "pending_review" &&
        item.needsReview === true
      )),
    ).toBe(true);
    expect(
      moderation.body.reports.some((item: { reason?: string; targetType?: string; targetId?: string; details?: string }) => (
        item.reason === "proposal_needs_review" &&
        item.targetType === "plan" &&
        item.targetId === dealProposal.body.proposal.planKey &&
        /VYVA review/i.test(item.details ?? "")
      )),
    ).toBe(true);
    expect(
      moderation.body.reports.some((item: { reason?: string; targetType?: string; targetId?: string; details?: string }) => (
        item.reason === "proposal_needs_review" &&
        item.targetType === "message" &&
        item.targetId === contactMessage.body.proposal.planKey &&
        /shared message/i.test(item.details ?? "")
      )),
    ).toBe(true);

    await request(bypassAdminApp)
      .patch(`/api/admin/social/plans/${dealProposal.body.proposal.planKey}`)
      .send({ status: "active", roomSlug: "together-room", notes: "Reviewed for room sharing." })
      .expect(200);

    const restoredPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", "safe-haven-deal-proposal-user")
      .expect(200);
    expect(
      restoredPulse.body.pulse.postedExperiences.some((item: { key?: string; status?: string }) => (
        item.key === dealProposal.body.proposal.planKey && item.status === "active"
      )),
    ).toBe(true);

    expect(
      moderation.body.reports.some((item: { targetType?: string; targetId?: string }) => (
        item.targetType === "question" && item.targetId === "experience-question-1"
      )),
    ).toBe(true);
    expect(
      moderation.body.reports.some((item: { id?: string; status?: string; reviewedBy?: string; reviewedAt?: string | null }) => (
        item.id === report.body.reportId &&
        item.status === "reviewing" &&
        item.reviewedBy === "admin-test-user" &&
        typeof item.reviewedAt === "string"
      )),
    ).toBe(true);
    expect(
      moderation.body.actions.some((item: { action_type?: string; target_type?: string; target_id?: string; notes?: string }) => (
        item.action_type === "report_reviewing" &&
        item.target_type === "report" &&
        item.target_id === report.body.reportId &&
        /shared question/i.test(item.notes ?? "")
      )),
    ).toBe(true);
  });

  it("protects admin moderation routes with the existing admin guard", async () => {
    await request(adminApp)
      .get("/api/admin/social/rooms/together-room/moderation")
      .expect(401);
  });

  it("rejects unsupported social moderation rooms", async () => {
    await request(bypassAdminApp)
      .get("/api/admin/social/rooms/music-room/moderation")
      .expect(400);

    await request(bypassAdminApp)
      .get("/api/admin/social/rooms/book-club/moderation")
      .expect(200);

    await request(bypassAdminApp)
      .patch("/api/admin/social/reports/unsupported-room-report")
      .send({ status: "reviewing", roomSlug: "music-room" })
      .expect(400);

    await request(bypassAdminApp)
      .patch("/api/admin/social/plans/tea-film-chat")
      .send({ status: "hidden", roomSlug: "reading-room" })
      .expect(400);

    await request(bypassAdminApp)
      .patch("/api/admin/social/polls/daily-room-choice")
      .send({ status: "closed", roomSlug: "music-room" })
      .expect(400);

    await request(bypassAdminApp)
      .patch("/api/admin/social/replies/unsupported-room-reply")
      .send({ status: "hidden", roomSlug: "book-club" })
      .expect(400);
  });

  it("keeps repeated private safety help requests from creating duplicate reports", async () => {
    const userId = "safe-haven-duplicate-report-user";
    const payload = {
      lang: "en",
      reason: "shared_item_review",
      targetType: "question",
      targetId: "experience-question-duplicate-report",
      details: "I want VYVA to check this question before I answer.",
    };

    const first = await request(socialApp)
      .post("/api/social/rooms/together-room/safety-reports")
      .set("x-user-id", userId)
      .send(payload)
      .expect(200);
    const second = await request(socialApp)
      .post("/api/social/rooms/together-room/safety-reports")
      .set("x-user-id", userId)
      .send(payload)
      .expect(200);

    expect(second.body.reportId).toBe(first.body.reportId);
    expect(second.body.report.status).toBe("open");
    expect(second.body.pulse.safety.reportedItemStatuses.filter(
      (item: { itemKey?: string; status?: string }) => (
        item.itemKey === "plan:experience-question-duplicate-report" &&
        item.status === "open"
      ),
    )).toHaveLength(1);
    expect(second.body.pulse.notifications.filter(
      (notification: { type?: string; metadata?: Record<string, unknown> }) => (
        notification.type === "safety_report_sent" &&
        notification.metadata?.reportId === first.body.reportId
      ),
    )).toHaveLength(1);

    const moderation = await request(bypassAdminApp)
      .get("/api/admin/social/rooms/together-room/moderation")
      .expect(200);
    expect(moderation.body.reports.filter(
      (report: { reporterId?: string; targetId?: string; reason?: string }) => (
        report.reporterId === userId &&
        report.targetId === payload.targetId &&
        report.reason === payload.reason
      ),
    )).toHaveLength(1);
  });

  it("keeps the full unread update count behind the calm short update list", async () => {
    const userId = "safe-haven-update-count-user";

    for (const index of [1, 2, 3, 4]) {
      await request(socialApp)
        .post("/api/social/rooms/together-room/safety-reports")
        .set("x-user-id", userId)
        .send({
          lang: "en",
          reason: "shared_item_review",
          targetType: "question",
          targetId: `experience-question-update-count-${index}`,
          details: `Please check private room update ${index}.`,
        })
        .expect(200);
    }

    const pulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", userId)
      .expect(200);

    expect(pulse.body.pulse.notifications).toHaveLength(3);
    expect(pulse.body.pulse.unreadNotificationCount).toBe(4);
  });

  it("rejects unsupported moderation status values", async () => {
    await request(bypassAdminApp)
      .patch("/api/admin/social/polls/daily-room-choice")
      .send({ status: "surprising-state", roomSlug: "together-room" })
      .expect(400);
  });
});
