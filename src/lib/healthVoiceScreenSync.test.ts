import { describe, expect, it, vi } from "vitest";
import {
  applyCanonicalHealthVoiceScreenSyncAnswer,
  healthVoiceScreenSyncInputFromCanvasResponse,
  healthVoiceScreenSyncQuestion,
  normalizeHealthVoiceScreenSyncAnswer,
  observationForHealthVoiceScreenSyncResult,
  VYVA_HEALTH_VOICE_SCREEN_SYNC_OBSERVATION_EVENT,
  dispatchHealthVoiceScreenSyncObservation,
  type HealthVoiceScreenSyncAnswers,
} from "./healthVoiceScreenSync";

const initialAnswers: HealthVoiceScreenSyncAnswers = {
  energy_level: null,
  mood: null,
  body_areas: [],
  sleep_quality: null,
  symptoms: [],
  symptom_details: [],
  safety_flags: [],
  social_contact: null,
};

const energyQuestion = healthVoiceScreenSyncQuestion({
  step: "energy",
  sceneInstanceId: "health-session-a",
  revision: 7,
  title: "How much energy do you have today?",
  helperText: "Choose the phrase that feels closest.",
  options: [
    { id: "1", label: "No energy", value: 1 },
    { id: "2", label: "A bit tired", value: 2 },
    { id: "3", label: "Normal", value: 3 },
  ],
});

const moodQuestion = healthVoiceScreenSyncQuestion({
  step: "mood",
  sceneInstanceId: "health-session-a",
  revision: 8,
  title: "How is your mood?",
  options: [
    { id: "happy", label: "Happy" },
    { id: "calm", label: "Calm" },
  ],
});

describe("healthVoiceScreenSync", () => {
  it("normalizes equivalent spoken and tapped answers to the same canonical answer semantics", () => {
    const touchResult = normalizeHealthVoiceScreenSyncAnswer(energyQuestion, {
      sceneId: energyQuestion.sceneId,
      sceneInstanceId: energyQuestion.sceneInstanceId,
      questionId: energyQuestion.questionId,
      revision: energyQuestion.revision,
      modality: "touch",
      choiceId: "3",
      value: 3,
      eventId: "touch-event",
      at: "2026-08-07T10:00:00.000Z",
    });
    const voiceResult = normalizeHealthVoiceScreenSyncAnswer(energyQuestion, {
      sceneId: energyQuestion.sceneId,
      sceneInstanceId: energyQuestion.sceneInstanceId,
      questionId: energyQuestion.questionId,
      revision: energyQuestion.revision,
      modality: "voice",
      utterance: "normal",
      eventId: "voice-event",
      at: "2026-08-07T10:00:01.000Z",
    });

    expect(touchResult.status).toBe("accepted");
    expect(voiceResult.status).toBe("accepted");
    if (touchResult.status !== "accepted" || voiceResult.status !== "accepted") return;

    expect({
      flowId: touchResult.answer.flowId,
      sceneId: touchResult.answer.sceneId,
      questionId: touchResult.answer.questionId,
      answerKey: touchResult.answer.answerKey,
      answerMode: touchResult.answer.answerMode,
      answerId: touchResult.answer.answerId,
      answerValue: touchResult.answer.answerValue,
    }).toEqual({
      flowId: voiceResult.answer.flowId,
      sceneId: voiceResult.answer.sceneId,
      questionId: voiceResult.answer.questionId,
      answerKey: voiceResult.answer.answerKey,
      answerMode: voiceResult.answer.answerMode,
      answerId: voiceResult.answer.answerId,
      answerValue: voiceResult.answer.answerValue,
    });
    expect(applyCanonicalHealthVoiceScreenSyncAnswer(initialAnswers, touchResult.answer)).toEqual(
      applyCanonicalHealthVoiceScreenSyncAnswer(initialAnswers, voiceResult.answer),
    );
  });

  it("rejects stale touch answers without rebinding them to the current question", () => {
    const result = normalizeHealthVoiceScreenSyncAnswer(moodQuestion, {
      sceneId: energyQuestion.sceneId,
      sceneInstanceId: energyQuestion.sceneInstanceId,
      questionId: energyQuestion.questionId,
      revision: energyQuestion.revision,
      modality: "touch",
      choiceId: "3",
      value: 3,
      eventId: "stale-touch",
      at: "2026-08-07T10:01:00.000Z",
    });

    expect(result).toMatchObject({
      status: "rejected",
      reason: "stale_scene",
      activeSceneId: moodQuestion.sceneId,
      activeQuestionId: moodQuestion.questionId,
    });
    expect(initialAnswers).toEqual({
      energy_level: null,
      mood: null,
      body_areas: [],
      sleep_quality: null,
      symptoms: [],
      symptom_details: [],
      safety_flags: [],
      social_contact: null,
    });
  });

  it("rejects delayed stale voice canvas responses by scene and revision", () => {
    const result = normalizeHealthVoiceScreenSyncAnswer(
      moodQuestion,
      healthVoiceScreenSyncInputFromCanvasResponse({
        sceneId: energyQuestion.sceneId,
        sceneInstanceId: energyQuestion.sceneInstanceId,
        questionId: energyQuestion.questionId,
        revision: energyQuestion.revision,
        kind: "choice",
        choiceId: "3",
        utterance: "Normal",
        value: "Normal",
        at: "2026-08-07T10:01:30.000Z",
      }),
    );

    expect(result).toMatchObject({
      status: "rejected",
      reason: "stale_scene",
      activeSceneId: moodQuestion.sceneId,
      activeRevision: moodQuestion.revision,
    });
  });

  it("rejects same-scene stale revisions without advancing the flow", () => {
    const result = normalizeHealthVoiceScreenSyncAnswer(energyQuestion, {
      sceneId: energyQuestion.sceneId,
      sceneInstanceId: energyQuestion.sceneInstanceId,
      questionId: energyQuestion.questionId,
      revision: energyQuestion.revision - 1,
      modality: "voice",
      choiceId: "3",
      value: "Normal",
      eventId: "old-revision",
      at: "2026-08-07T10:02:00.000Z",
    });

    expect(result).toMatchObject({
      status: "rejected",
      reason: "stale_revision",
      activeRevision: energyQuestion.revision,
    });
  });

  it("rejects same-scene and same-revision answers from another Health session instance", () => {
    const result = normalizeHealthVoiceScreenSyncAnswer(energyQuestion, {
      sceneId: energyQuestion.sceneId,
      sceneInstanceId: "prior-health-session",
      questionId: energyQuestion.questionId,
      revision: energyQuestion.revision,
      modality: "voice",
      choiceId: "3",
      value: "Normal",
      eventId: "prior-session-answer",
      at: "2026-08-07T10:02:30.000Z",
    });

    expect(result).toMatchObject({
      status: "rejected",
      reason: "stale_scene_instance",
      activeSceneInstanceId: energyQuestion.sceneInstanceId,
    });
  });

  it("keeps duplicate event identity stable for idempotency at the Health handler boundary", () => {
    const input = {
      sceneId: energyQuestion.sceneId,
      sceneInstanceId: energyQuestion.sceneInstanceId,
      questionId: energyQuestion.questionId,
      revision: energyQuestion.revision,
      modality: "voice" as const,
      choiceId: "3",
      value: "Normal",
      eventId: "voice-event-duplicate",
      at: "2026-08-07T10:03:00.000Z",
    };

    const first = normalizeHealthVoiceScreenSyncAnswer(energyQuestion, input);
    const second = normalizeHealthVoiceScreenSyncAnswer(energyQuestion, input);

    expect(first.status).toBe("accepted");
    expect(second.status).toBe("accepted");
    if (first.status !== "accepted" || second.status !== "accepted") return;
    expect(first.answer.eventId).toBe(second.answer.eventId);
    expect(applyCanonicalHealthVoiceScreenSyncAnswer(initialAnswers, first.answer)).toEqual(
      applyCanonicalHealthVoiceScreenSyncAnswer(initialAnswers, second.answer),
    );
  });

  it("uses provider voice utterance identity instead of callback timestamp for voice canvas idempotency", () => {
    const first = normalizeHealthVoiceScreenSyncAnswer(
      energyQuestion,
      healthVoiceScreenSyncInputFromCanvasResponse({
        sceneId: energyQuestion.sceneId,
        sceneInstanceId: energyQuestion.sceneInstanceId,
        questionId: energyQuestion.questionId,
        revision: energyQuestion.revision,
        kind: "choice",
        choiceId: "3",
        utterance: "Normal",
        value: "Normal",
        at: "2026-08-07T10:03:00.000Z",
        voiceUtteranceId: "elevenlabs-user:test-session:provider-201",
      }),
    );
    const second = normalizeHealthVoiceScreenSyncAnswer(
      energyQuestion,
      healthVoiceScreenSyncInputFromCanvasResponse({
        sceneId: energyQuestion.sceneId,
        sceneInstanceId: energyQuestion.sceneInstanceId,
        questionId: energyQuestion.questionId,
        revision: energyQuestion.revision,
        kind: "choice",
        choiceId: "3",
        utterance: "Normal",
        value: "Normal",
        at: "2026-08-07T10:03:05.000Z",
        voiceUtteranceId: "elevenlabs-user:test-session:provider-201",
      }),
    );

    expect(first.status).toBe("accepted");
    expect(second.status).toBe("accepted");
    if (first.status !== "accepted" || second.status !== "accepted") return;
    expect(first.answer.acceptedAt).not.toBe(second.answer.acceptedAt);
    expect(first.answer.eventId).toBe(second.answer.eventId);
    expect(first.answer.eventId).toContain("provider-201");
    expect(first.answer.eventId).not.toContain("10:03:00");
    expect(second.answer.eventId).not.toContain("10:03:05");
  });

  it("dispatches privacy-safe observations with IDs and no raw spoken health text", () => {
    const listener = vi.fn();
    window.addEventListener(VYVA_HEALTH_VOICE_SCREEN_SYNC_OBSERVATION_EVENT, listener);

    const result = normalizeHealthVoiceScreenSyncAnswer(energyQuestion, {
      sceneId: energyQuestion.sceneId,
      sceneInstanceId: energyQuestion.sceneInstanceId,
      questionId: energyQuestion.questionId,
      revision: energyQuestion.revision,
      modality: "voice",
      choiceId: "3",
      utterance: "Normal and also a private extra detail",
      eventId: "privacy-event",
      at: "2026-08-07T10:04:00.000Z",
    });
    dispatchHealthVoiceScreenSyncObservation(result);

    const detail = (listener.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toMatchObject({
      flowId: energyQuestion.flowId,
      sceneId: energyQuestion.sceneId,
      sceneInstanceId: energyQuestion.sceneInstanceId,
      questionId: energyQuestion.questionId,
      modality: "voice",
      status: "accepted",
      answerId: "3",
      answerValue: 3,
    });
    expect(JSON.stringify(detail)).not.toContain("private extra detail");
    expect(observationForHealthVoiceScreenSyncResult(result)).toEqual(detail);

    window.removeEventListener(VYVA_HEALTH_VOICE_SCREEN_SYNC_OBSERVATION_EVENT, listener);
  });

  it("does not include unrecognized raw answer values in rejection observations", () => {
    const result = normalizeHealthVoiceScreenSyncAnswer(energyQuestion, {
      sceneId: energyQuestion.sceneId,
      sceneInstanceId: energyQuestion.sceneInstanceId,
      questionId: energyQuestion.questionId,
      revision: energyQuestion.revision,
      modality: "voice",
      value: "private unrecognized answer",
      utterance: "private unrecognized answer",
      at: "2026-08-07T10:05:00.000Z",
    });

    const observation = observationForHealthVoiceScreenSyncResult(result);
    expect(observation).toMatchObject({
      status: "rejected",
      reason: "answer_not_recognized",
    });
    expect(JSON.stringify(observation)).not.toContain("private unrecognized answer");
  });
});
