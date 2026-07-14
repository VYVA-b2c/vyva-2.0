import { describe, expect, it } from "vitest";
import {
  inferLearningProgramRhythm,
  learningProgramSessionOffsets,
  normalizeLearningInterests,
  normalizeLearningPreferences,
  selectLessonsForLearningProgram,
  type LearningLessonCandidate,
} from "./learningProgram.js";

function lesson(id: string, categorySlug: string, language = "en", status = "published", isActive = true): LearningLessonCandidate {
  return {
    id,
    categorySlug,
    language,
    status,
    isActive,
    title: id,
  };
}

describe("learning program preferences", () => {
  it("falls back to General Knowledge when interests are empty or invalid", () => {
    expect(normalizeLearningInterests([])).toEqual(["general_knowledge"]);
    expect(normalizeLearningInterests(["unknown"])).toEqual(["general_knowledge"]);
  });

  it("deduplicates interests and clamps lesson length", () => {
    expect(normalizeLearningPreferences({
      interests: ["science", "science", "music"],
      pace: "curious",
      dailyTime: "25:00",
      lessonLengthMinutes: 20,
      language: "en-US",
    })).toEqual({
      interests: ["science", "music"],
      pace: "curious",
      frequency: "three_times_week",
      durationWeeks: 4,
      dailyTime: "09:00",
      lessonLengthMinutes: 8,
      language: "en",
    });
  });

  it("allows uploaded categories when active category slugs are provided", () => {
    expect(normalizeLearningInterests(["world_cultures", "science"], ["world_cultures", "science", "general_knowledge"]))
      .toEqual(["world_cultures", "science"]);
    expect(normalizeLearningPreferences({
      interests: ["world_cultures"],
      pace: "gentle",
      dailyTime: "09:30",
      lessonLengthMinutes: 4,
      language: "en",
    }, ["world_cultures", "general_knowledge"]).interests).toEqual(["world_cultures"]);
  });

  it("normalizes program frequency and duration", () => {
    expect(normalizeLearningPreferences({
      interests: ["science"],
      pace: "curious",
      dailyTime: "09:30",
      lessonLengthMinutes: 3,
      language: "en",
    })).toMatchObject({
      frequency: "daily",
      durationWeeks: 4,
    });

    expect(normalizeLearningPreferences({
      interests: ["science"],
      pace: "gentle",
      frequency: "three_times_week",
      durationWeeks: 4,
      dailyTime: "09:30",
      lessonLengthMinutes: 4,
      language: "en",
    })).toMatchObject({
      frequency: "three_times_week",
      durationWeeks: 4,
    });

    expect(normalizeLearningPreferences({
      interests: ["science"],
      pace: "gentle",
      frequency: "sometimes",
      durationWeeks: 2,
      dailyTime: "09:30",
      lessonLengthMinutes: 4,
      language: "en",
    })).toMatchObject({
      frequency: "three_times_week",
      durationWeeks: 4,
    });
  });
});

describe("learning program rhythm", () => {
  it("creates session offsets for each supported rhythm", () => {
    expect(learningProgramSessionOffsets("daily", 1)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(learningProgramSessionOffsets("three_times_week", 1)).toEqual([0, 2, 4]);
    expect(learningProgramSessionOffsets("weekly", 4)).toEqual([0, 7, 14, 21]);
  });

  it("infers rhythm from scheduled lesson dates", () => {
    expect(inferLearningProgramRhythm(["2026-07-05"])).toEqual({ frequency: "weekly", durationWeeks: 1 });
    expect(inferLearningProgramRhythm([
      "2026-07-05",
      "2026-07-07",
      "2026-07-09",
      "2026-07-12",
      "2026-07-14",
      "2026-07-16",
      "2026-07-19",
      "2026-07-21",
      "2026-07-23",
      "2026-07-26",
      "2026-07-28",
      "2026-07-30",
    ])).toEqual({ frequency: "three_times_week", durationWeeks: 4 });
  });
});

describe("selectLessonsForLearningProgram", () => {
  it("rotates through selected interests before using fallback content", () => {
    const selected = selectLessonsForLearningProgram({
      lessons: [
        lesson("science-1", "science"),
        lesson("music-1", "music"),
        lesson("science-2", "science"),
        lesson("music-2", "music"),
        lesson("general-1", "general_knowledge"),
        lesson("general-2", "general_knowledge"),
        lesson("history-1", "history"),
      ],
      interests: ["science", "music"],
      language: "en",
      days: 4,
    });

    expect(selected.map((item) => item.id)).toEqual(["science-1", "music-1", "science-2", "music-2"]);
  });

  it("prefers exact language, then English, then General Knowledge", () => {
    const selected = selectLessonsForLearningProgram({
      lessons: [
        lesson("science-en", "science", "en"),
        lesson("general-es", "general_knowledge", "es"),
        lesson("general-en", "general_knowledge", "en"),
      ],
      interests: ["science"],
      language: "es",
      days: 3,
    });

    expect(selected.map((item) => item.id)).toEqual(["science-en", "general-es", "general-en"]);
  });

  it("avoids recently completed lessons until it needs them to fill the week", () => {
    const selected = selectLessonsForLearningProgram({
      lessons: [
        lesson("science-recent", "science"),
        lesson("science-fresh", "science"),
        lesson("general-fresh", "general_knowledge"),
      ],
      interests: ["science"],
      language: "en",
      recentlyCompletedLessonIds: ["science-recent"],
      days: 3,
    });

    expect(selected.map((item) => item.id)).toEqual(["science-fresh", "general-fresh", "science-recent"]);
  });

  it("does not select draft or inactive lessons", () => {
    const selected = selectLessonsForLearningProgram({
      lessons: [
        lesson("draft", "science", "en", "draft"),
        lesson("inactive", "science", "en", "published", false),
        lesson("published", "science"),
      ],
      interests: ["science"],
      language: "en",
      days: 3,
    });

    expect(selected.map((item) => item.id)).toEqual(["published"]);
  });

  it("selects lessons from uploaded categories when they are allowed", () => {
    const selected = selectLessonsForLearningProgram({
      lessons: [
        lesson("culture-1", "world_cultures"),
        lesson("general-1", "general_knowledge"),
      ],
      interests: ["world_cultures"],
      allowedInterests: ["world_cultures", "general_knowledge"],
      language: "en",
      days: 2,
    });

    expect(selected.map((item) => item.id)).toEqual(["culture-1", "general-1"]);
  });

  it("can repeat published lessons when a longer program exhausts the library", () => {
    const selected = selectLessonsForLearningProgram({
      lessons: [
        lesson("science-1", "science"),
        lesson("general-1", "general_knowledge"),
      ],
      interests: ["science"],
      language: "en",
      days: 5,
      repeatWhenExhausted: true,
    });

    expect(selected).toHaveLength(5);
    expect(selected.map((item) => item.id)).toEqual(["science-1", "general-1", "science-1", "general-1", "science-1"]);
  });
});
