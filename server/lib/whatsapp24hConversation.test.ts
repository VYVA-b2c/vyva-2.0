import { describe, expect, it } from "vitest";
import {
  advanceHip24hConversation,
  HIP_24H_COMPLETION_MESSAGE,
  HIP_24H_INVALID_REPLY_MESSAGE,
  hip24hWhatsappFrom,
  initialHip24hConversationState,
} from "./whatsapp24hConversation.js";

describe("24-hour hip replacement WhatsApp conversation", () => {
  it("uses the dedicated pilot sender by default", () => {
    expect(hip24hWhatsappFrom()).toBe("+15558003512");
  });

  it("advances through all five Yes/No questions and completes", () => {
    let state = initialHip24hConversationState(new Date("2026-09-09T10:00:00Z"));
    for (let question = 1; question <= 4; question += 1) {
      const result = advanceHip24hConversation(state, { buttonPayload: `24h_q${question}_yes`, body: "Yes" });
      expect(result.reply).toEqual({ kind: "template", question: question + 1 });
      state = result.state;
    }
    const result = advanceHip24hConversation(state, { buttonPayload: "24h_q5_no", body: "No" });
    expect(result.completed).toBe(true);
    expect(result.reply).toEqual({ kind: "text", body: HIP_24H_COMPLETION_MESSAGE });
    expect(result.state.answers).toMatchObject({ q1: "yes", q2: "yes", q3: "yes", q4: "yes", q5: "no" });
  });

  it("requires an open response after a concerning Q1-Q4 No answer", () => {
    const noAnswer = advanceHip24hConversation(initialHip24hConversationState(), {
      buttonPayload: "24h_q2_no",
      body: "No",
    });
    expect(noAnswer.reply).toEqual({ kind: "text", body: HIP_24H_INVALID_REPLY_MESSAGE });

    const q1No = advanceHip24hConversation(initialHip24hConversationState(), {
      buttonPayload: "24h_q1_no",
      body: "No",
    });
    expect(q1No.state.awaiting_detail_for).toBe("q1");
    expect(q1No.reply).toEqual({ kind: "text", body: "Please tell us what is missing." });

    const detail = advanceHip24hConversation(q1No.state, { body: "The medicines list was not included." });
    expect(detail.state.answers.q1_detail).toBe("The medicines list was not included.");
    expect(detail.reply).toEqual({ kind: "template", question: 2 });

    const staleButton = advanceHip24hConversation(q1No.state, { buttonPayload: "24h_q1_no", body: "No" });
    expect(staleButton.state.answers.q1_detail).toBeUndefined();
    expect(staleButton.reply).toEqual({ kind: "text", body: "Please tell us what is missing." });
  });

  it("flags a reported warning sign for clinical review after the open response", () => {
    const state = { ...initialHip24hConversationState(), current_question: 5 as const };
    const yes = advanceHip24hConversation(state, { buttonPayload: "24h_q5_yes", body: "Yes" });
    expect(yes.state.awaiting_detail_for).toBe("q5");
    expect(yes.state.requires_clinical_review).toBe(true);
    expect(yes.reply).toEqual({ kind: "text", body: "Please tell us which warning sign you have." });

    const detail = advanceHip24hConversation(yes.state, { body: "A warning sign from my discharge plan." });
    expect(detail.completed).toBe(true);
    expect(detail.state.requires_clinical_review).toBe(true);
    expect(detail.state.escalation_reason).toBe("warning_sign_reported");
  });

  it("cancels the check-in on STOP without advancing", () => {
    const result = advanceHip24hConversation(initialHip24hConversationState(), { body: "STOP" });
    expect(result.cancelled).toBe(true);
    expect(result.completed).toBe(false);
    expect(result.state.current_question).toBe(1);
  });
});
