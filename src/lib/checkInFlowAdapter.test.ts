import { describe, expect, it } from "vitest";
import {
  HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FLOW_ID,
  healthVoiceScreenSyncQuestion,
  type HealthVoiceScreenSyncAnswers,
} from "@/lib/healthVoiceScreenSync";
import {
  checkInFlowStateFromHealthQuestion,
  createCheckInFlowAdapter,
  staticCheckInFlowState,
  type CheckInFlowActions,
} from "@/lib/checkInFlowAdapter";

const emptyAnswers: HealthVoiceScreenSyncAnswers = {
  energy_level: null,
  mood: null,
  body_areas: [],
  sleep_quality: null,
  symptoms: [],
  symptom_details: [],
  safety_flags: [],
  social_contact: null,
};

describe("check-in flow adapter", () => {
  it("projects an active Health question into the local CheckInFlowState shape", () => {
    const question = healthVoiceScreenSyncQuestion({
      step: "energy",
      sceneInstanceId: "scene-instance-1",
      revision: 3,
      title: "How much energy do you have today?",
      helperText: "Choose the closest answer.",
      options: [
        { id: "normal", label: "Normal", value: 3, selected: true },
        { id: "high", label: "Lots of energy", value: 5 },
      ],
      progress: {
        current: 1,
        total: 6,
        label: "One step at a time",
      },
    });

    const state = checkInFlowStateFromHealthQuestion({
      question,
      answers: { ...emptyAnswers, energy_level: 3 },
    });

    expect(state).toMatchObject({
      flowId: HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FLOW_ID,
      step: "energy",
      status: "question",
      sceneId: "health.preventive_check.energy",
      sceneInstanceId: "scene-instance-1",
      questionId: "health.preventive_check.energy",
      revision: 3,
      source: "local_fixture_adapter",
    });
    expect(state.currentQuestion?.options.map((option) => ({
      id: option.id,
      label: option.label,
      value: option.value,
      selected: option.selected,
    }))).toEqual([
      { id: "normal", label: "Normal", value: 3, selected: true },
      { id: "high", label: "Lots of energy", value: 5, selected: undefined },
    ]);
    expect(state.answers.energy_level).toBe(3);
  });

  it("exposes a non-authoritative static state for legacy rollback states", () => {
    const state = staticCheckInFlowState({
      step: "welcome",
      status: "welcome",
      answers: emptyAnswers,
    });

    expect(state).toEqual({
      flowId: HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FLOW_ID,
      step: "welcome",
      status: "welcome",
      answers: emptyAnswers,
      source: "local_fixture_adapter",
    });
  });

  it("keeps actions as callbacks rather than state authority", () => {
    const actions: CheckInFlowActions = {
      start: () => undefined,
      goBack: () => undefined,
      answer: () => undefined,
      next: () => undefined,
      openSafety: () => undefined,
    };

    expect(Object.keys(actions).sort()).toEqual(["answer", "goBack", "next", "openSafety", "start"]);
  });

  it("creates one adapter boundary from caller-owned state and callbacks", () => {
    const question = healthVoiceScreenSyncQuestion({
      step: "mood",
      sceneInstanceId: "scene-instance-2",
      revision: 4,
      title: "How is your mood?",
      helperText: "Choose one.",
      options: [
        { id: "calm", label: "Calm", value: "calm" },
        { id: "low", label: "Low", value: "low" },
      ],
      progress: {
        current: 2,
        total: 6,
        label: "One step at a time",
      },
    });
    const actions: CheckInFlowActions = {
      start: () => undefined,
      goBack: () => undefined,
      answer: () => undefined,
      next: () => undefined,
      openSafety: () => undefined,
    };

    const adapter = createCheckInFlowAdapter({
      activeQuestion: question,
      answers: { ...emptyAnswers, mood: "calm" },
      step: "mood",
      actions,
    });

    expect(adapter.actions).toBe(actions);
    expect(adapter.flowState).toMatchObject({
      step: "mood",
      status: "question",
      sceneId: "health.preventive_check.mood",
      questionId: "health.preventive_check.mood",
      source: "local_fixture_adapter",
    });
    expect(adapter.flowState.currentQuestion?.options.map((option) => option.id)).toEqual(["calm", "low"]);
  });
});
