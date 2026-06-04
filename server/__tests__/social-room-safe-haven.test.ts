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
    expect(circleItem.body.musicCircle.items.map((item: { songText: string }) => item.songText)).toContain("Stand By Me");
    expect(circleItem.body.musicCircle.seedSong.nudge).toMatch(/Diego/i);

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
    expect(res.body.pulse.memberPresence).toHaveLength(3);
    expect(res.body.pulse.comfortCheck.title).toMatch(/comfortable/i);
    expect(res.body.pulse.comfortCheck.options.map((option: { id: string }) => option.id)).toEqual([
      "quiet_pace",
      "easy_access",
      "seating",
      "transport_help",
    ]);
    expect(res.body.pulse.safety.consentLine).toMatch(/both people agree/i);
    expect(res.body.pulse.safety.agreementLines).toContain("Use kind words and no pressure.");
    expect(res.body.pulse.safety.myAcknowledgedAt).toBeNull();
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

    const saved = await request(socialApp)
      .post("/api/social/rooms/together-room/comfort-check")
      .set("x-user-id", userId)
      .send({ lang: "en", comfortNeeds: ["quiet_pace", "seating", "transport_help"] })
      .expect(200);

    expect(saved.body.comfortNeeds).toEqual(["quiet_pace", "seating", "transport_help"]);
    expect(saved.body.pulse.comfortCheck.myComfortNeeds).toEqual(["quiet_pace", "seating", "transport_help"]);
    expect(
      saved.body.pulse.comfortCheck.options.find((option: { id: string }) => option.id === "quiet_pace").count,
    ).toBeGreaterThanOrEqual(1);

    const changed = await request(socialApp)
      .post("/api/social/rooms/together-room/comfort-check")
      .set("x-user-id", userId)
      .send({ lang: "en", comfortNeeds: ["easy_access"] })
      .expect(200);

    expect(changed.body.pulse.comfortCheck.myComfortNeeds).toEqual(["easy_access"]);
    expect(
      changed.body.pulse.comfortCheck.options.find((option: { id: string }) => option.id === "easy_access").count,
    ).toBeGreaterThanOrEqual(1);

    const refreshed = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", userId)
      .expect(200);

    expect(refreshed.body.pulse.comfortCheck.myComfortNeeds).toEqual(["easy_access"]);
    expect(refreshed.body.pulse.comfortCheck.totalResponses).toBeGreaterThanOrEqual(1);
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
      .send({ lang: "en", optionId: "lunch" })
      .expect(200);

    const lunch = res.body.vote.options.find((option: { id: string }) => option.id === "lunch");
    expect(res.body.pulse.activePoll.myVote).toBe("lunch");
    expect(lunch.votes).toBeGreaterThanOrEqual(1);
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

    const refreshed = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", userId)
      .expect(200);

    expect(
      refreshed.body.pulse.featuredPlan.replies.some((item: { body?: string }) => /simple option/i.test(item.body ?? "")),
    ).toBe(true);
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

    const ownerPulse = await request(socialApp)
      .get("/api/social/rooms/together-room/pulse?lang=en")
      .set("x-user-id", ownerId)
      .expect(200);

    expect(ownerPulse.body.pulse.postedExperiences[0].replies[0].body).toMatch(/can help/i);
    const replyNotification = ownerPulse.body.pulse.notifications.find((notification: { id: string; type: string; title: string; body: string }) => (
      notification.type === "reply_added" &&
      /Someone replied gently/i.test(notification.title) &&
      /A calm cafe idea/i.test(notification.body)
    ));
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

    const moderation = await request(bypassAdminApp)
      .get("/api/admin/social/rooms/together-room/moderation")
      .expect(200);

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
        comfortNeeds: ["quiet_pace", "easy_access", "transport_help"],
        experienceCategory: "restaurant_date",
        preferredTime: "afternoon",
        costRange: "shared",
        groupSize: "small_group",
      })
      .expect(200);

    expect(activityProposal.body.proposal.comfortNeeds).toEqual(["quiet_pace", "easy_access", "transport_help"]);
    expect(activityProposal.body.proposal.experienceCategory).toBe("restaurant_date");
    expect(activityProposal.body.proposal.preferredTime).toBe("afternoon");
    expect(activityProposal.body.proposal.costRange).toBe("shared");
    expect(activityProposal.body.proposal.groupSize).toBe("small_group");
    expect(activityProposal.body.proposal.needsReview).toBe(false);
    expect(activityProposal.body.pulse.postedExperiences[0].comfortNeeds).toEqual(["quiet_pace", "easy_access", "transport_help"]);
    expect(activityProposal.body.pulse.postedExperiences[0].fitReasons).toContain("Afternoon");

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
  });

  it("protects admin moderation routes with the existing admin guard", async () => {
    await request(adminApp)
      .get("/api/admin/social/rooms/together-room/moderation")
      .expect(401);
  });

  it("rejects unsupported moderation status values", async () => {
    await request(bypassAdminApp)
      .patch("/api/admin/social/polls/daily-room-choice")
      .send({ status: "surprising-state", roomSlug: "together-room" })
      .expect(400);
  });
});
