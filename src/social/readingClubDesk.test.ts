import { describe, expect, it } from "vitest";
import {
  addReadingClubJournalEntry,
  addReadingClubShelfItem,
  buildReadingClubBridgePrompt,
  getReadingClubMilestones,
  getReadingClubNextStepId,
  getReadingClubPreferenceTags,
  incrementReadingClubProgress,
  joinReadingClubCircle,
  leaveReadingClubCircle,
  markReadingClubLetterSent,
  markReadingClubConversationCardUsed,
  markReadingClubPassport,
  normalizeReadingClubDeskState,
  readingClubDayKey,
  recordReadingClubVisit,
  removeReadingClubExchangeRequest,
  removeReadingClubHostedTable,
  removeReadingClubJournalEntry,
  removeReadingClubLetter,
  removeReadingClubProgramSession,
  removeReadingClubRecommendationCard,
  removeReadingClubShelfItem,
  saveReadingClubExchangeRequest,
  saveReadingClubHostedTable,
  saveReadingClubLetterDraft,
  saveReadingClubProgramSession,
  saveReadingClubRecommendationCard,
  updateReadingClubDeskState,
} from "./readingClubDesk";

describe("reading club desk progress", () => {
  it("normalizes missing or malformed desk state", () => {
    const state = normalizeReadingClubDeskState({
      visitCount: -4,
      streakDays: "bad",
      selectedIntentId: "unknown",
      selectedModeId: "",
      completedPassportIds: ["share", "share", 7],
      lastReflection: "A".repeat(220),
      plannedProgramSessionIds: ["salon", "salon", "", 42, "exchange"],
      usedConversationCardIds: ["memory", "memory", "", 11, "greeting"],
      joinedReaderCircleIds: ["poetry-corner", "poetry-corner", "", 11, "memory-keepers"],
      journalEntries: [
        {
          id: "page",
          title: "  Kitchen   table page  ",
          body: "  A story   stayed  ",
          dayKey: "2026-06-04",
          createdAt: "bad-date",
          circleId: " memory-keepers ",
        },
        { id: "page", title: "Duplicate", body: "Duplicate", dayKey: "2026-06-04", createdAt: "bad-date", circleId: null },
        { id: "empty-body", title: "No body", body: "", dayKey: "bad", createdAt: "bad-date", circleId: null },
      ],
      letters: [
        {
          id: "letter",
          recipientName: "  Maria   ",
          subject: "  Blue   bowl  ",
          body: "  I remembered   the kitchen  ",
          status: "unknown",
          createdAt: "bad-date",
          sentAt: "also-bad",
        },
        { id: "letter", recipientName: "Duplicate", subject: "Duplicate", body: "Duplicate", status: "sent", createdAt: "bad-date", sentAt: "bad" },
        { id: "empty-letter", recipientName: "No body", subject: "No body", body: "", status: "sent", createdAt: "bad-date", sentAt: "bad" },
      ],
      exchangeRequests: [
        {
          id: "exchange-1",
          kindId: "unknown",
          shelfId: "unknown",
          topic: "  Stories   about gardens  ",
          note: "  Something   short and kind.  ",
          createdAt: "bad-date",
        },
        {
          id: "exchange-1",
          kindId: "recommendation",
          shelfId: "poetry",
          topic: "Duplicate",
          note: "Duplicate",
          createdAt: "bad-date",
        },
        { id: "empty-topic", kindId: "memory", shelfId: "memoir", topic: "", note: "", createdAt: "bad-date" },
      ],
      hostedTables: [
        {
          id: "table-1",
          topic: "  Kitchen   table stories  ",
          circleId: " memory-keepers ",
          timeSlotId: "unknown",
          comfortId: "unknown",
          note: "  Bring one   gentle memory.  ",
          createdAt: "bad-date",
        },
        {
          id: "table-1",
          topic: "Duplicate",
          circleId: "poetry-corner",
          timeSlotId: "tomorrow",
          comfortId: "sharing",
          note: "Duplicate",
          createdAt: "bad-date",
        },
        { id: "empty-table", topic: "", circleId: "", timeSlotId: "today", comfortId: "small", note: "", createdAt: "bad-date" },
      ],
      savedShelfItems: [
        { id: "keep", kind: "unknown", title: "  A saved scene  ", body: "  Body   text  ", createdAt: "bad-date" },
        { id: "keep", kind: "reflection", title: "Duplicate", body: "Duplicate", createdAt: "bad-date" },
        { id: "", kind: "reflection", title: "No id", body: "No id", createdAt: "bad-date" },
      ],
      recommendationCards: [
        {
          id: "rec-1",
          shelfId: "unknown",
          moodId: "unknown",
          title: "  A quiet   garden book  ",
          note: "  Good for   gentle afternoons.  ",
          createdAt: "bad-date",
        },
        {
          id: "rec-1",
          shelfId: "poetry",
          moodId: "memory",
          title: "Duplicate",
          note: "Duplicate",
          createdAt: "bad-date",
        },
        { id: "empty-rec", shelfId: "memoir", moodId: "comfort", title: "", note: "", createdAt: "bad-date" },
      ],
    });

    expect(state.visitCount).toBe(0);
    expect(state.streakDays).toBe(0);
    expect(state.selectedIntentId).toBe("share-memory");
    expect(state.selectedModeId).toBe("one-to-one");
    expect(state.favoriteShelfId).toBe("memoir");
    expect(state.preferredPaceId).toBe("quiet");
    expect(state.completedPassportIds).toEqual(["share"]);
    expect(state.lastReflection).toHaveLength(180);
    expect(state.reflectionsShared).toBe(0);
    expect(state.greetingsSent).toBe(0);
    expect(state.tablesJoined).toBe(0);
    expect(state.plannedProgramSessionIds).toEqual(["salon", "exchange"]);
    expect(state.usedConversationCardIds).toEqual(["memory", "greeting"]);
    expect(state.joinedReaderCircleIds).toEqual(["poetry-corner", "memory-keepers"]);
    expect(state.savedShelfItems).toEqual([
      {
        id: "keep",
        kind: "reflection",
        title: "A saved scene",
        body: "Body text",
        createdAt: "bad-date",
      },
    ]);
    expect(state.recommendationCards).toEqual([
      {
        id: "rec-1",
        shelfId: "memoir",
        moodId: "comfort",
        title: "A quiet garden book",
        note: "Good for gentle afternoons.",
        createdAt: "1970-01-01T00:00:00.000Z",
      },
    ]);
    expect(state.journalEntries).toEqual([
      {
        id: "page",
        title: "Kitchen table page",
        body: "A story stayed",
        dayKey: "2026-06-04",
        createdAt: "1970-01-01T00:00:00.000Z",
        circleId: "memory-keepers",
      },
    ]);
    expect(state.letters).toEqual([
      {
        id: "letter",
        recipientName: "Maria",
        subject: "Blue bowl",
        body: "I remembered the kitchen",
        status: "draft",
        createdAt: "1970-01-01T00:00:00.000Z",
        sentAt: null,
      },
    ]);
    expect(state.exchangeRequests).toEqual([
      {
        id: "exchange-1",
        kindId: "discussion",
        shelfId: "memoir",
        topic: "Stories about gardens",
        note: "Something short and kind.",
        createdAt: "1970-01-01T00:00:00.000Z",
      },
    ]);
    expect(state.hostedTables).toEqual([
      {
        id: "table-1",
        topic: "Kitchen table stories",
        circleId: "memory-keepers",
        timeSlotId: "today",
        comfortId: "listening",
        note: "Bring one gentle memory.",
        createdAt: "1970-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("records visits once per day and preserves same-day passport progress", () => {
    const first = recordReadingClubVisit(null, new Date(2026, 5, 4, 10));
    const withPassport = markReadingClubPassport(first, "share", true, new Date(2026, 5, 4, 11));
    const sameDay = recordReadingClubVisit(withPassport, new Date(2026, 5, 4, 18));

    expect(readingClubDayKey(new Date(2026, 5, 4))).toBe("2026-06-04");
    expect(sameDay.visitCount).toBe(1);
    expect(sameDay.streakDays).toBe(1);
    expect(sameDay.completedPassportIds).toEqual(["share"]);
  });

  it("continues a streak on the next day and resets daily passport items", () => {
    const first = recordReadingClubVisit(null, new Date(2026, 5, 4, 10));
    const withPassport = markReadingClubPassport(first, "share", true, new Date(2026, 5, 4, 11));
    const nextDay = recordReadingClubVisit(withPassport, new Date(2026, 5, 5, 9));

    expect(nextDay.visitCount).toBe(2);
    expect(nextDay.streakDays).toBe(2);
    expect(nextDay.completedPassportIds).toEqual([]);
  });

  it("stores the visitor's intention, mode, reader profile, and last reflection", () => {
    const first = recordReadingClubVisit(null, new Date(2026, 5, 4, 10));
    const updated = updateReadingClubDeskState(first, {
      selectedIntentId: "meet-reader",
      selectedModeId: "pen-note",
      favoriteShelfId: "poetry",
      preferredPaceId: "letters",
      lastReflection: "A neighbor in a story reminded me to check on people.",
    }, new Date(2026, 5, 4, 12));

    expect(updated.selectedIntentId).toBe("meet-reader");
    expect(updated.selectedModeId).toBe("pen-note");
    expect(updated.favoriteShelfId).toBe("poetry");
    expect(updated.preferredPaceId).toBe("letters");
    expect(updated.lastReflection).toMatch(/neighbor/i);
  });

  it("turns the saved reader profile into matching tags and a protected greeting prompt", () => {
    const state = updateReadingClubDeskState(null, {
      selectedIntentId: "recommend-book",
      favoriteShelfId: "short-stories",
      preferredPaceId: "chatty",
    }, new Date(2026, 5, 4, 12));

    expect(getReadingClubPreferenceTags(state)).toEqual([
      "short_stories",
      "stories",
      "book_recommendations",
      "reading_companion",
    ]);
    expect(buildReadingClubBridgePrompt(state, "en")).toContain("short stories");
    expect(buildReadingClubBridgePrompt(state, "en")).toContain("offering a recommendation");
    expect(buildReadingClubBridgePrompt(state, "de")).toContain("Kurzgeschichten");
    expect(buildReadingClubBridgePrompt(state, "es")).toContain("cuentos");
  });

  it("tracks lifetime club progress without disturbing daily passport progress", () => {
    const first = markReadingClubPassport(recordReadingClubVisit(null, new Date(2026, 5, 4, 10)), "share");
    const reflected = incrementReadingClubProgress(first, "reflectionsShared", new Date(2026, 5, 4, 11));
    const greeted = incrementReadingClubProgress(reflected, "greetingsSent", new Date(2026, 5, 4, 12));
    const voted = incrementReadingClubProgress(greeted, "shelfVotes", new Date(2026, 5, 4, 13));
    const nextDay = recordReadingClubVisit(voted, new Date(2026, 5, 5, 9));

    expect(nextDay.completedPassportIds).toEqual([]);
    expect(nextDay.reflectionsShared).toBe(1);
    expect(nextDay.greetingsSent).toBe(1);
    expect(nextDay.shelfVotes).toBe(1);
  });

  it("builds milestone snapshots and a next club step from progress", () => {
    let state = recordReadingClubVisit(null, new Date(2026, 5, 4, 10));

    expect(getReadingClubNextStepId(state)).toBe("share");

    state = markReadingClubPassport(state, "share", true, new Date(2026, 5, 4, 11));
    state = incrementReadingClubProgress(state, "reflectionsShared", new Date(2026, 5, 4, 11));
    expect(getReadingClubNextStepId(state)).toBe("greet");

    state = incrementReadingClubProgress(state, "greetingsSent", new Date(2026, 5, 4, 12));
    state = incrementReadingClubProgress(state, "shelfVotes", new Date(2026, 5, 4, 13));
    state = incrementReadingClubProgress(state, "shelfVotes", new Date(2026, 5, 4, 14));
    state = incrementReadingClubProgress(state, "tablesJoined", new Date(2026, 5, 4, 15));
    state = incrementReadingClubProgress(state, "tablesJoined", new Date(2026, 5, 4, 16));
    state = incrementReadingClubProgress(state, "tablesJoined", new Date(2026, 5, 4, 17));

    const milestones = getReadingClubMilestones(state);
    expect(milestones.find((item) => item.id === "first-reflection")).toMatchObject({ completed: true, progress: 1, target: 1 });
    expect(milestones.find((item) => item.id === "shelf-voice")).toMatchObject({ completed: true, progress: 2, target: 2 });
    expect(milestones.find((item) => item.id === "table-regular")).toMatchObject({ completed: true, progress: 3, target: 3 });
    expect(milestones.find((item) => item.id === "three-visits")).toMatchObject({ completed: false, progress: 1, target: 3 });
  });

  it("saves, de-duplicates, caps, and removes personal shelf items", () => {
    let state = recordReadingClubVisit(null, new Date(2026, 5, 4, 10));
    state = addReadingClubShelfItem(state, {
      kind: "reflection",
      title: "Kitchen window poem",
      body: "A poem reminded me of quiet mornings.",
    }, new Date(2026, 5, 4, 11));
    state = addReadingClubShelfItem(state, {
      kind: "reflection",
      title: "Kitchen window poem",
      body: "Updated body",
    }, new Date(2026, 5, 4, 12));

    expect(state.savedShelfItems).toHaveLength(1);
    expect(state.savedShelfItems[0]).toMatchObject({
      kind: "reflection",
      title: "Kitchen window poem",
      body: "Updated body",
    });

    for (let index = 0; index < 10; index += 1) {
      state = addReadingClubShelfItem(state, {
        kind: "prompt",
        title: `Prompt ${index}`,
      }, new Date(2026, 5, 4, 13, index));
    }

    expect(state.savedShelfItems).toHaveLength(8);
    expect(state.savedShelfItems[0].title).toBe("Prompt 9");
    expect(state.savedShelfItems.some((item) => item.title === "Prompt 0")).toBe(false);

    const removed = removeReadingClubShelfItem(state, state.savedShelfItems[0].id, new Date(2026, 5, 4, 14));
    expect(removed.savedShelfItems).toHaveLength(7);
    expect(removed.savedShelfItems.some((item) => item.title === "Prompt 9")).toBe(false);
  });

  it("saves, updates, caps, and removes recommendation cards", () => {
    let state = updateReadingClubDeskState(null, {
      favoriteShelfId: "short-stories",
    }, new Date(2026, 5, 4, 10));

    state = saveReadingClubRecommendationCard(state, {
      moodId: "comfort",
      title: "A gentle garden story",
      note: "Good when someone wants a calm afternoon read.",
    }, new Date(2026, 5, 4, 11));

    expect(state.recommendationCards[0]).toMatchObject({
      shelfId: "short-stories",
      moodId: "comfort",
      title: "A gentle garden story",
      note: "Good when someone wants a calm afternoon read.",
    });

    const cardId = state.recommendationCards[0].id;
    state = saveReadingClubRecommendationCard(state, {
      id: cardId,
      shelfId: "memoir",
      moodId: "memory",
      title: "Kitchen table memoir",
      note: "A warm pick for family memories.",
    }, new Date(2026, 5, 4, 12));

    expect(state.recommendationCards).toHaveLength(1);
    expect(state.recommendationCards[0]).toMatchObject({
      id: cardId,
      shelfId: "memoir",
      moodId: "memory",
      title: "Kitchen table memoir",
      note: "A warm pick for family memories.",
    });

    for (let index = 0; index < 10; index += 1) {
      state = saveReadingClubRecommendationCard(state, {
        shelfId: "poetry",
        moodId: "conversation",
        title: `Recommendation ${index}`,
      }, new Date(2026, 5, 4, 13, index));
    }

    expect(state.recommendationCards).toHaveLength(8);
    expect(state.recommendationCards[0].title).toBe("Recommendation 9");
    expect(state.recommendationCards.some((card) => card.title === "Recommendation 0")).toBe(false);

    const removed = removeReadingClubRecommendationCard(state, state.recommendationCards[0].id, new Date(2026, 5, 4, 14));
    expect(removed.recommendationCards).toHaveLength(7);
    expect(removed.recommendationCards.some((card) => card.title === "Recommendation 9")).toBe(false);
  });

  it("saves, de-duplicates, caps, and removes private journal entries", () => {
    let state = recordReadingClubVisit(null, new Date(2026, 5, 4, 10));
    state = addReadingClubJournalEntry(state, {
      title: "Kitchen table page",
      body: "A story reminded me of a blue bowl.",
      circleId: "memory-keepers",
    }, new Date(2026, 5, 4, 11));
    state = addReadingClubJournalEntry(state, {
      title: "Kitchen table page",
      body: "Updated memory",
      circleId: "memory-keepers",
    }, new Date(2026, 5, 4, 12));

    expect(state.journalEntries).toHaveLength(1);
    expect(state.journalEntries[0]).toMatchObject({
      title: "Kitchen table page",
      body: "Updated memory",
      dayKey: "2026-06-04",
      circleId: "memory-keepers",
    });

    for (let index = 0; index < 13; index += 1) {
      state = addReadingClubJournalEntry(state, {
        title: `Page ${index}`,
        body: `Body ${index}`,
      }, new Date(2026, 5, 4, 13, index));
    }

    expect(state.journalEntries).toHaveLength(10);
    expect(state.journalEntries[0].title).toBe("Page 12");
    expect(state.journalEntries.some((entry) => entry.title === "Page 0")).toBe(false);

    const removed = removeReadingClubJournalEntry(state, state.journalEntries[0].id, new Date(2026, 5, 4, 14));
    expect(removed.journalEntries).toHaveLength(9);
    expect(removed.journalEntries.some((entry) => entry.title === "Page 12")).toBe(false);
  });

  it("saves, de-duplicates, caps, sends, and removes club letters", () => {
    let state = recordReadingClubVisit(null, new Date(2026, 5, 4, 10));
    state = saveReadingClubLetterDraft(state, {
      recipientName: "Maria",
      subject: "A blue bowl",
      body: "Your story made me remember my kitchen table.",
    }, new Date(2026, 5, 4, 11));
    state = saveReadingClubLetterDraft(state, {
      recipientName: "Maria",
      subject: "A blue bowl",
      body: "Updated letter",
    }, new Date(2026, 5, 4, 12));

    expect(state.letters).toHaveLength(1);
    expect(state.letters[0]).toMatchObject({
      recipientName: "Maria",
      subject: "A blue bowl",
      body: "Updated letter",
      status: "draft",
      sentAt: null,
    });

    state = markReadingClubLetterSent(state, state.letters[0].id, new Date(2026, 5, 4, 13));
    expect(state.letters[0]).toMatchObject({
      status: "sent",
      sentAt: new Date(2026, 5, 4, 13).toISOString(),
    });

    for (let index = 0; index < 11; index += 1) {
      state = saveReadingClubLetterDraft(state, {
        recipientName: `Reader ${index}`,
        subject: `Letter ${index}`,
        body: `Body ${index}`,
      }, new Date(2026, 5, 4, 14, index));
    }

    expect(state.letters).toHaveLength(8);
    expect(state.letters[0].subject).toBe("Letter 10");
    expect(state.letters.some((letter) => letter.subject === "Letter 0")).toBe(false);

    const removed = removeReadingClubLetter(state, state.letters[0].id, new Date(2026, 5, 4, 15));
    expect(removed.letters).toHaveLength(7);
    expect(removed.letters.some((letter) => letter.subject === "Letter 10")).toBe(false);
  });

  it("saves, updates, caps, and removes exchange requests", () => {
    let state = updateReadingClubDeskState(null, {
      favoriteShelfId: "poetry",
    }, new Date(2026, 5, 4, 10));

    state = saveReadingClubExchangeRequest(state, {
      kindId: "recommendation",
      topic: "Gentle garden stories",
      note: "Something kind and short.",
    }, new Date(2026, 5, 4, 11));

    expect(state.exchangeRequests[0]).toMatchObject({
      kindId: "recommendation",
      shelfId: "poetry",
      topic: "Gentle garden stories",
      note: "Something kind and short.",
    });

    const requestId = state.exchangeRequests[0].id;
    state = saveReadingClubExchangeRequest(state, {
      id: requestId,
      kindId: "memory",
      shelfId: "memoir",
      topic: "Garden memories",
      note: "Ask about remembered plants.",
    }, new Date(2026, 5, 4, 12));

    expect(state.exchangeRequests).toHaveLength(1);
    expect(state.exchangeRequests[0]).toMatchObject({
      id: requestId,
      kindId: "memory",
      shelfId: "memoir",
      topic: "Garden memories",
      note: "Ask about remembered plants.",
    });

    for (let index = 0; index < 10; index += 1) {
      state = saveReadingClubExchangeRequest(state, {
        kindId: "discussion",
        shelfId: "short-stories",
        topic: `Exchange request ${index}`,
      }, new Date(2026, 5, 4, 13, index));
    }

    expect(state.exchangeRequests).toHaveLength(8);
    expect(state.exchangeRequests[0].topic).toBe("Exchange request 9");
    expect(state.exchangeRequests.some((request) => request.topic === "Exchange request 0")).toBe(false);

    const removed = removeReadingClubExchangeRequest(state, state.exchangeRequests[0].id, new Date(2026, 5, 4, 14));
    expect(removed.exchangeRequests).toHaveLength(7);
    expect(removed.exchangeRequests.some((request) => request.topic === "Exchange request 9")).toBe(false);
  });

  it("saves, updates, caps, and removes hosted reading tables", () => {
    let state = recordReadingClubVisit(null, new Date(2026, 5, 4, 10));
    state = saveReadingClubHostedTable(state, {
      topic: "Kitchen table stories",
      circleId: "memory-keepers",
      timeSlotId: "today",
      comfortId: "listening",
      note: "Bring one gentle memory.",
    }, new Date(2026, 5, 4, 11));

    expect(state.hostedTables[0]).toMatchObject({
      topic: "Kitchen table stories",
      circleId: "memory-keepers",
      timeSlotId: "today",
      comfortId: "listening",
      note: "Bring one gentle memory.",
    });

    const tableId = state.hostedTables[0].id;
    state = saveReadingClubHostedTable(state, {
      id: tableId,
      topic: "Poetry at the window",
      circleId: "poetry-corner",
      timeSlotId: "tomorrow",
      comfortId: "sharing",
      note: "One image is enough.",
    }, new Date(2026, 5, 4, 12));

    expect(state.hostedTables).toHaveLength(1);
    expect(state.hostedTables[0]).toMatchObject({
      id: tableId,
      topic: "Poetry at the window",
      circleId: "poetry-corner",
      timeSlotId: "tomorrow",
      comfortId: "sharing",
      note: "One image is enough.",
    });

    for (let index = 0; index < 8; index += 1) {
      state = saveReadingClubHostedTable(state, {
        topic: `Hosted table ${index}`,
        circleId: "open-club",
        timeSlotId: "weekend",
        comfortId: "small",
      }, new Date(2026, 5, 4, 13, index));
    }

    expect(state.hostedTables).toHaveLength(6);
    expect(state.hostedTables[0].topic).toBe("Hosted table 7");
    expect(state.hostedTables.some((table) => table.topic === "Hosted table 0")).toBe(false);

    const removed = removeReadingClubHostedTable(state, state.hostedTables[0].id, new Date(2026, 5, 4, 14));
    expect(removed.hostedTables).toHaveLength(5);
    expect(removed.hostedTables.some((table) => table.topic === "Hosted table 7")).toBe(false);
  });

  it("saves, de-duplicates, caps, and removes planned program sessions", () => {
    let state = recordReadingClubVisit(null, new Date(2026, 5, 4, 10));
    state = saveReadingClubProgramSession(state, "salon", new Date(2026, 5, 4, 11));
    state = saveReadingClubProgramSession(state, "exchange", new Date(2026, 5, 4, 12));
    state = saveReadingClubProgramSession(state, "salon", new Date(2026, 5, 4, 13));

    expect(state.plannedProgramSessionIds).toEqual(["salon", "exchange"]);

    for (let index = 0; index < 8; index += 1) {
      state = saveReadingClubProgramSession(state, `session-${index}`, new Date(2026, 5, 4, 14, index));
    }

    expect(state.plannedProgramSessionIds).toHaveLength(6);
    expect(state.plannedProgramSessionIds[0]).toBe("session-7");
    expect(state.plannedProgramSessionIds.includes("exchange")).toBe(false);

    const removed = removeReadingClubProgramSession(state, "session-7", new Date(2026, 5, 4, 15));
    expect(removed.plannedProgramSessionIds).toHaveLength(5);
    expect(removed.plannedProgramSessionIds.includes("session-7")).toBe(false);
  });

  it("marks conversation cards as used without growing indefinitely", () => {
    let state = recordReadingClubVisit(null, new Date(2026, 5, 4, 10));
    state = markReadingClubConversationCardUsed(state, "memory", new Date(2026, 5, 4, 11));
    state = markReadingClubConversationCardUsed(state, "greeting", new Date(2026, 5, 4, 12));
    state = markReadingClubConversationCardUsed(state, "memory", new Date(2026, 5, 4, 13));

    expect(state.usedConversationCardIds).toEqual(["memory", "greeting"]);

    for (let index = 0; index < 14; index += 1) {
      state = markReadingClubConversationCardUsed(state, `card-${index}`, new Date(2026, 5, 4, 14, index));
    }

    expect(state.usedConversationCardIds).toHaveLength(12);
    expect(state.usedConversationCardIds[0]).toBe("card-13");
    expect(state.usedConversationCardIds.includes("greeting")).toBe(false);
  });

  it("joins, de-duplicates, caps, and leaves reader circles", () => {
    let state = recordReadingClubVisit(null, new Date(2026, 5, 4, 10));
    state = joinReadingClubCircle(state, "memory-keepers", new Date(2026, 5, 4, 11));
    state = joinReadingClubCircle(state, "poetry-corner", new Date(2026, 5, 4, 12));
    state = joinReadingClubCircle(state, "memory-keepers", new Date(2026, 5, 4, 13));

    expect(state.joinedReaderCircleIds).toEqual(["memory-keepers", "poetry-corner"]);

    for (let index = 0; index < 6; index += 1) {
      state = joinReadingClubCircle(state, `circle-${index}`, new Date(2026, 5, 4, 14, index));
    }

    expect(state.joinedReaderCircleIds).toHaveLength(4);
    expect(state.joinedReaderCircleIds[0]).toBe("circle-5");
    expect(state.joinedReaderCircleIds.includes("poetry-corner")).toBe(false);

    const left = leaveReadingClubCircle(state, "circle-5", new Date(2026, 5, 4, 15));
    expect(left.joinedReaderCircleIds).toHaveLength(3);
    expect(left.joinedReaderCircleIds.includes("circle-5")).toBe(false);
  });
});
