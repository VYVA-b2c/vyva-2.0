import { describe, expect, it } from "vitest";
import {
  getDefaultCuriousMindsUserState,
  getNextCuriousMindsStateAfterSession,
  pickCuriousMindsContent,
} from "./CuriousMinds";

describe("Curious Minds helpers", () => {
  it("picks unused content for today before falling back to least recently used", () => {
    const rows = [
      { id: "old-hook" },
      { id: "fresh-hook" },
    ];

    expect(pickCuriousMindsContent(rows, [{ hook_id: "old-hook" }], [], "hook_id", () => 0)?.id).toBe("fresh-hook");

    expect(pickCuriousMindsContent(
      rows,
      [{ hook_id: "old-hook" }, { hook_id: "fresh-hook" }],
      [
        { hook_id: "old-hook", played_at: "2026-06-20T10:00:00.000Z" },
        { hook_id: "fresh-hook", played_at: "2026-06-19T10:00:00.000Z" },
      ],
      "hook_id",
    )?.id).toBe("fresh-hook");
  });

  it("uses the same no-repeat rule for prompts and hooks independently", () => {
    const rows = [
      { id: "prompt-1" },
      { id: "prompt-2" },
      { id: "prompt-3" },
    ];

    const selected = pickCuriousMindsContent(
      rows,
      [{ prompt_id: "prompt-1" }, { prompt_id: "prompt-2" }],
      [],
      "prompt_id",
      () => 0,
    );

    expect(selected?.id).toBe("prompt-3");
  });

  it("increments, holds, or resets the participation streak by calendar day", () => {
    const now = new Date(2026, 5, 21, 12, 0, 0);
    const base = {
      ...getDefaultCuriousMindsUserState("user-1"),
      total_sessions: 3,
      streak_days: 4,
    };

    expect(getNextCuriousMindsStateAfterSession({
      ...base,
      last_streak_date: "2026-06-20",
    }, now)).toEqual(expect.objectContaining({
      total_sessions: 4,
      streak_days: 5,
      last_streak_date: "2026-06-21",
    }));

    expect(getNextCuriousMindsStateAfterSession({
      ...base,
      last_streak_date: "2026-06-21",
    }, now)).toEqual(expect.objectContaining({
      total_sessions: 4,
      streak_days: 4,
      last_streak_date: "2026-06-21",
    }));

    expect(getNextCuriousMindsStateAfterSession({
      ...base,
      last_streak_date: "2026-06-15",
    }, now)).toEqual(expect.objectContaining({
      total_sessions: 4,
      streak_days: 1,
      last_streak_date: "2026-06-21",
    }));
  });
});
