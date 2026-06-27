import { describe, expect, it } from "vitest";
import {
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
});
