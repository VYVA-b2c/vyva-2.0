import { describe, expect, it } from "vitest";
import {
  VYVA_WEEKLY_FORM_MAX_QUESTIONS,
  VYVA_WEEKLY_FORM_MIN_QUESTIONS,
  VYVA_WEEKLY_FORMS,
  VYVA_WEEKLY_QUESTION_BANK,
  findClinicalConditionWording,
  getVyvaWeeklyFormForWeek,
  selectVyvaWeeklyQuestions,
  validateVyvaWeeklyQuestionBank,
} from "./vyva-weekly-question-bank";

describe("VYVA weekly question bank", () => {
  it("keeps all weekly form question IDs valid and active", () => {
    const validation = validateVyvaWeeklyQuestionBank();
    expect(validation.errors).toEqual([]);
    expect(validation.ok).toBe(true);

    const questionById = new Map(VYVA_WEEKLY_QUESTION_BANK.map((question) => [question.id, question]));

    for (const form of VYVA_WEEKLY_FORMS) {
      expect(form.questionIds.length).toBeGreaterThanOrEqual(VYVA_WEEKLY_FORM_MIN_QUESTIONS);
      expect(form.questionIds.length).toBeLessThanOrEqual(VYVA_WEEKLY_FORM_MAX_QUESTIONS);

      for (const questionId of form.questionIds) {
        const question = questionById.get(questionId);
        expect(question, `${form.weekNumber} references ${questionId}`).toBeTruthy();
        expect(question?.active).toBe(true);
      }
    }
  });

  it("rotates weekly forms by week number", () => {
    expect(getVyvaWeeklyFormForWeek(1).weekNumber).toBe(1);
    expect(getVyvaWeeklyFormForWeek(12).weekNumber).toBe(12);
    expect(getVyvaWeeklyFormForWeek(13).weekNumber).toBe(1);
    expect(getVyvaWeeklyFormForWeek(24).weekNumber).toBe(12);

    const weekOneSelection = selectVyvaWeeklyQuestions({ weekNumber: 1 }).map((item) => item.question.id);
    const weekThirteenSelection = selectVyvaWeeklyQuestions({ weekNumber: 13 }).map((item) => item.question.id);
    expect(weekThirteenSelection).toEqual(weekOneSelection);
  });

  it("can select triggered follow-up questions when recent signals worsen", () => {
    const selected = selectVyvaWeeklyQuestions({
      weekNumber: 1,
      recentSignals: [{ domain: "mood", worsened: true }],
      maxQuestions: 9,
    });
    const triggered = selected.find((item) => item.source === "triggered_follow_up");

    expect(triggered).toBeTruthy();
    expect(triggered?.question.domain).toBe("mood");
    expect(triggered?.reason).toContain("signals worsened");

    const memorySelected = selectVyvaWeeklyQuestions({
      weekNumber: 1,
      recentSignals: [{ domain: "memory", worsened: true }],
      maxQuestions: 9,
    });

    expect(memorySelected.some((item) => item.source === "triggered_follow_up" && item.question.domain === "subjective_memory")).toBe(true);
  });

  it("does not use clinical-condition wording in question text", () => {
    const flaggedQuestions = VYVA_WEEKLY_QUESTION_BANK.filter((question) =>
      findClinicalConditionWording(question.questionText),
    );

    expect(flaggedQuestions).toEqual([]);
  });

  it("sets required metadata on every question", () => {
    for (const question of VYVA_WEEKLY_QUESTION_BANK) {
      expect(question.domain, `${question.id} domain`).toBeTruthy();
      expect(question.answerType, `${question.id} answerType`).toBeTruthy();
      expect(question.cadence, `${question.id} cadence`).toBe("WEEKLY");
      expect(question.burdenLevel, `${question.id} burdenLevel`).toBeTruthy();
      expect(typeof question.cooldownDays, `${question.id} cooldownDays`).toBe("number");
      expect(question.cooldownDays, `${question.id} cooldownDays`).toBeGreaterThanOrEqual(0);
    }
  });
});
