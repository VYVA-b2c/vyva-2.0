import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import RememberLater, {
  computeRememberLaterScore,
  getDefaultRememberLaterUserState,
  getRememberLaterLevelRequirements,
  getNextRememberLaterStateAfterSession,
  isRememberLaterCountedRound,
  normalizeRememberLaterRound,
  pickRememberLaterRound,
} from "./RememberLater";
import { recordCognitiveSession } from "./shared/brainCoachSessions";

const gameDataMock = vi.hoisted(() => {
  const queue: Array<{ data: unknown; error: unknown }> = [];
  const calls: Array<{ table: string; type: string; payload?: unknown }> = [];
  const from = vi.fn((table: string) => {
    const query: Record<string, unknown> = { table };
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.gte = vi.fn(() => query);
    query.lt = vi.fn(() => query);
    query.not = vi.fn(() => query);
    query.order = vi.fn(() => query);
    query.limit = vi.fn(() => query);
    query.insert = vi.fn((payload) => {
      calls.push({ table, type: "insert", payload });
      query.payload = payload;
      return query;
    });
    query.upsert = vi.fn((payload) => {
      calls.push({ table, type: "upsert", payload });
      query.payload = payload;
      return query;
    });
    query.single = vi.fn(() => Promise.resolve(queue.shift() ?? { data: query.payload, error: null }));
    query.maybeSingle = vi.fn(() => Promise.resolve(queue.shift() ?? { data: null, error: null }));
    query.then = (onfulfilled: (value: unknown) => unknown, onrejected?: (reason: unknown) => unknown) =>
      Promise.resolve(queue.shift() ?? { data: [], error: null }).then(onfulfilled, onrejected);
    return query;
  });

  return { calls, from, queue };
});

vi.mock("./shared/gameDataApi", () => ({
  gameData: {
    table: gameDataMock.from,
  },
}));

vi.mock("./shared/brainCoachSessions", () => ({
  recordCognitiveSession: vi.fn().mockResolvedValue({ persisted: true }),
}));

const testRound = {
  id: "round-1",
  round_type: "event_based",
  difficulty_tier: 1,
  round_duration_seconds: 1,
  ongoing_task_rule: "shape_circle",
  filler_stream: [
    { type: "shape", value: "circle", matches_rule: true },
    { type: "icon", value: "cue", icon: "cue", matches_rule: false, cue: true },
    { type: "shape", value: "circle", matches_rule: true },
  ],
  filler_item_count: 3,
  filler_item_interval_ms: 10,
  intentions: [{ type: "event", cue_icon: "bell", cue_position_index: 1, response_window_items: 1 }],
  is_active: true,
};

const componentRound = {
  ...testRound,
  difficulty_tier: 4,
  round_duration_seconds: 1,
  filler_stream: [
    { type: "shape", value: "square", matches_rule: false },
    { type: "icon", value: "cue", icon: "cue", matches_rule: false, cue: true },
    { type: "shape", value: "circle", matches_rule: true },
  ],
  filler_item_interval_ms: 80,
};

describe("RememberLater helpers", () => {
  it("scores prospective memory higher than the matching task", () => {
    const result = computeRememberLaterScore({
      round: testRound,
      ongoingTappedIndices: [0],
      ongoingFalseAlarms: 1,
      intentionStates: [{ intention: testRound.intentions[0], hit: true, response_delay_items: 0 }],
      pmFalseAlarms: 0,
      seenItemCount: 3,
      durationSeconds: 1,
    });

    expect(result.ongoing_accuracy_pct).toBe(50);
    expect(result.pm_accuracy_pct).toBe(100);
    expect(result.score).toBe(800);
    expect(result.combined_accuracy_pct).toBe(80);
  });

  it("eases early tiers with slower pacing and fewer items", () => {
    const normalized = normalizeRememberLaterRound({
      ...testRound,
      difficulty_tier: 1,
      round_duration_seconds: 1,
      filler_item_interval_ms: 400,
      filler_stream: [
        { type: "shape", value: "circle", matches_rule: true },
        { type: "shape", value: "square", matches_rule: false },
        { type: "shape", value: "triangle", matches_rule: false },
        { type: "shape", value: "circle", matches_rule: true },
        { type: "icon", value: "cue", icon: "cue", matches_rule: false, cue: true },
        { type: "shape", value: "square", matches_rule: false },
        { type: "shape", value: "circle", matches_rule: true },
        { type: "shape", value: "triangle", matches_rule: false },
        { type: "shape", value: "circle", matches_rule: true },
      ],
    });

    expect(normalized.filler_stream).toHaveLength(6);
    expect(normalized.filler_item_interval_ms).toBe(2000);
    expect(normalized.round_duration_seconds).toBeGreaterThanOrEqual(14);
  });

  it("counts early rounds with gentler matching requirements, then tightens later", () => {
    expect(getRememberLaterLevelRequirements(1)).toEqual(expect.objectContaining({
      combinedAccuracyPct: 60,
      matchingAccuracyPct: 50,
    }));
    expect(isRememberLaterCountedRound({
      difficulty_tier: 1,
      combined_accuracy_pct: 80,
      ongoing_accuracy_pct: 50,
      pm_hits: 1,
      abandoned: false,
    })).toBe(true);
    expect(isRememberLaterCountedRound({
      difficulty_tier: 4,
      combined_accuracy_pct: 80,
      ongoing_accuracy_pct: 50,
      pm_hits: 1,
      abandoned: false,
    })).toBe(false);
  });

  it("promotes only after three PM-supported wins", () => {
    const previous = {
      ...getDefaultRememberLaterUserState("user-1"),
      current_tier: 2,
      consecutive_wins: 2,
      sessions_at_tier: 2,
    };
    const next = getNextRememberLaterStateAfterSession(previous, {
      difficulty_tier: 2,
      combined_accuracy_pct: 80,
      ongoing_accuracy_pct: 80,
      pm_hits: 1,
      score: 850,
      abandoned: false,
    }, new Date("2026-06-20T12:00:00Z"));

    expect(next.current_tier).toBe(3);
    expect(next.consecutive_wins).toBe(0);
    expect(next.sessions_at_tier).toBe(0);
  });

  it("does not promote when the future intention was not remembered", () => {
    const previous = {
      ...getDefaultRememberLaterUserState("user-1"),
      current_tier: 2,
      consecutive_wins: 2,
    };
    const next = getNextRememberLaterStateAfterSession(previous, {
      difficulty_tier: 2,
      combined_accuracy_pct: 90,
      ongoing_accuracy_pct: 90,
      pm_hits: 0,
      score: 760,
      abandoned: false,
    }, new Date("2026-06-20T12:00:00Z"));

    expect(next.current_tier).toBe(2);
    expect(next.consecutive_wins).toBe(0);
  });

  it("does not add level progress when recall succeeds but the matching task is too low", () => {
    const previous = {
      ...getDefaultRememberLaterUserState("user-1"),
      current_tier: 1,
      consecutive_wins: 0,
    };
    const next = getNextRememberLaterStateAfterSession(previous, {
      difficulty_tier: 1,
      combined_accuracy_pct: 60,
      ongoing_accuracy_pct: 0,
      pm_hits: 1,
      score: 600,
      abandoned: false,
    }, new Date("2026-06-20T12:00:00Z"));

    expect(next.current_tier).toBe(1);
    expect(next.consecutive_wins).toBe(0);
  });

  it("picks an unused round today, then falls back to least recently played", () => {
    const rounds = [
      { ...testRound, id: "old-round" },
      { ...testRound, id: "fresh-round" },
    ];

    expect(pickRememberLaterRound(rounds, [{ round_id: "old-round" }], [], () => 0)?.id).toBe("fresh-round");
    expect(pickRememberLaterRound(rounds, [{ round_id: "old-round" }, { round_id: "fresh-round" }], [
      { round_id: "old-round", played_at: "2026-06-20T10:00:00Z" },
      { round_id: "fresh-round", played_at: "2026-06-19T10:00:00Z" },
    ])?.id).toBe("fresh-round");
  });
});

describe("RememberLater component", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLanguage("en");
    gameDataMock.calls.length = 0;
    gameDataMock.queue.length = 0;
    gameDataMock.from.mockClear();
    vi.mocked(recordCognitiveSession).mockClear();
  });

  it("shows the tutorial once, plays a round, saves the session, and records Brain Coach history", async () => {
    const userState = {
      ...getDefaultRememberLaterUserState("user-1"),
      has_seen_tutorial: false,
    };
    gameDataMock.queue.push(
      { data: userState, error: null },
      { data: [], error: null },
      { data: [componentRound], error: null },
      { data: { ...userState, has_seen_tutorial: true }, error: null },
      { data: { id: "session-1" }, error: null },
      { data: { ...userState, has_seen_tutorial: true }, error: null },
    );

    render(<RememberLater userId="user-1" onExit={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Remember Later" })).toBeInTheDocument();
    expect(screen.getByText(/Tap when you see a circle/i)).toBeInTheDocument();
    expect(screen.getByText(/Bell\? Tap gold star/i)).toBeInTheDocument();
    expect(screen.getByText(/3 good rounds/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    expect(screen.getByText(/only example/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(await screen.findByRole("button", { name: "Tap when you see a circle" })).toBeInTheDocument();
    expect(screen.getByText(/No circle\? Wait/i)).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    });
    fireEvent.click(screen.getByRole("button", { name: "Gold star" }));
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    });
    fireEvent.click(screen.getByRole("button", { name: "Tap when you see a circle" }));
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1050));
    });

    expect(await screen.findByText(/You remembered without anyone reminding you/i)).toBeInTheDocument();
    expect(screen.getByText("Good round")).toBeInTheDocument();
    expect(screen.getByText(/used both buttons at the right time/i)).toBeInTheDocument();
    expect(screen.getByText(/Good round\. 2 more to move up/i)).toBeInTheDocument();

    const savedSession = gameDataMock.calls.find((call) => call.table === "remember_later_sessions" && call.type === "insert");
    expect(savedSession?.payload).toEqual(expect.objectContaining({
      round_id: "round-1",
      pm_hits: 1,
      pm_total: 1,
      completed: true,
      abandoned: false,
    }));

    expect(recordCognitiveSession).toHaveBeenCalledWith(expect.objectContaining({
      activityType: "remember_later",
      domain: "prospective_memory",
      secondaryDomain: "attention",
      accuracyPct: 100,
      sourceTable: "remember_later_sessions",
    }));
  }, 10_000);

  it("explains when recall alone does not move the level bar", async () => {
    const userState = {
      ...getDefaultRememberLaterUserState("user-1"),
      has_seen_tutorial: true,
    };
    gameDataMock.queue.push(
      { data: userState, error: null },
      { data: [], error: null },
      { data: [componentRound], error: null },
      { data: { id: "session-1" }, error: null },
      { data: userState, error: null },
    );

    render(<RememberLater userId="user-1" onExit={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Remember Later" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start round" }));
    expect(await screen.findByRole("button", { name: "Tap when you see a circle" })).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 90));
    });
    fireEvent.click(screen.getByRole("button", { name: "Gold star" }));
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1050));
    });

    expect(await screen.findByText(/You remembered without anyone reminding you/i)).toBeInTheDocument();
    expect(screen.getByText(/Gold star remembered/i)).toBeInTheDocument();
    expect(screen.getByText("Matching task")).toBeInTheDocument();
    expect(screen.getByText(/0%/i)).toBeInTheDocument();
    expect(screen.getByText(/To count the round, also tap purple for the target/i)).toBeInTheDocument();
  }, 10_000);
});
