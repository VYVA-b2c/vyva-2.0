import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import CheckHowIFeelScreen from "./CheckHowIFeelScreen";
import { VoiceCanvasProvider } from "@/contexts/VoiceCanvasContext";
import {
  VYVA_VOICE_CANVAS_PRESENT_EVENT,
  type VoiceCanvasSceneEnvelope,
  readActiveVoiceCanvasSceneProvenance,
} from "@/lib/voiceCanvasBridge";
import {
  emitVoiceUserMessage,
  VYVA_VOICE_USER_MESSAGE_EVENT,
  type VoiceUserMessageDetail,
} from "@/lib/voiceNavigation";
import {
  HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FEATURE_ENDPOINT,
  VYVA_HEALTH_VOICE_SCREEN_SYNC_OBSERVATION_EVENT,
  type HealthVoiceScreenSyncObservation,
} from "@/lib/healthVoiceScreenSync";
import { VYVA_OPEN_SOS_EVENT } from "@/lib/sosEvents";

const apiFetchMock = vi.hoisted(() => vi.fn());
const invalidateQueriesMock = vi.hoisted(() => vi.fn());
const sendTextMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/queryClient", () => ({
  apiFetch: apiFetchMock,
  queryClient: {
    invalidateQueries: invalidateQueriesMock,
  },
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useVyvaVoice: () => ({
    sendText: sendTextMock,
  }),
}));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({
    firstName: "",
    profile: {
      profileId: "profile-stage7",
      country: "ES",
      gpName: null,
      gpPhone: null,
      gpEmail: null,
    },
  }),
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en" }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/voiceSessionBridge", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/voiceSessionBridge")>();
  return {
    ...actual,
    ensureVoiceSessionId: () => "test-voice-session",
    emitVoiceTriageTouchAnswer: vi.fn(),
  };
});

function renderCheckin() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        queryFn: async ({ queryKey }) => {
          if (queryKey[0] === "/api/onboarding/careteam") return { members: [] };
          if (queryKey[0] === "/api/onboarding/state") return { profile: null };
          return null;
        },
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/health/check-in"]}>
        <VoiceCanvasProvider>
          <CheckHowIFeelScreen />
        </VoiceCanvasProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function collectHealthSyncEvents() {
  const scenes: VoiceCanvasSceneEnvelope[] = [];
  const observations: HealthVoiceScreenSyncObservation[] = [];
  const handleScene = (event: Event) => {
    scenes.push((event as CustomEvent<VoiceCanvasSceneEnvelope>).detail);
  };
  const handleObservation = (event: Event) => {
    observations.push((event as CustomEvent<HealthVoiceScreenSyncObservation>).detail);
  };
  window.addEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
  window.addEventListener(VYVA_HEALTH_VOICE_SCREEN_SYNC_OBSERVATION_EVENT, handleObservation);
  return {
    scenes,
    observations,
    stop: () => {
      window.removeEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
      window.removeEventListener(VYVA_HEALTH_VOICE_SCREEN_SYNC_OBSERVATION_EVENT, handleObservation);
    },
  };
}

async function startCheckinAndWaitForEnergyScene(scenes: VoiceCanvasSceneEnvelope[]) {
  fireEvent.click(screen.getByTestId("button-checkin-start"));
  await screen.findByText("How much energy do you have today?");
  await waitFor(() => {
    expect(scenes.at(-1)?.viewModel.sceneId).toBe("health.preventive_check.energy");
  });
  return scenes.at(-1)!;
}

async function waitForEnabledNext() {
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });
}

function semanticObservation(observation: HealthVoiceScreenSyncObservation) {
  return {
    flowId: observation.flowId,
    sceneId: observation.sceneId,
    questionId: observation.questionId,
    revision: observation.revision,
    answerId: observation.answerId,
    answerValue: observation.answerValue,
    status: observation.status,
  };
}

describe("CheckHowIFeelScreen voice and screen synchronization", () => {
  afterEach(() => {
    cleanup();
    apiFetchMock.mockReset();
    invalidateQueriesMock.mockReset();
    sendTextMock.mockReset();
  });

  it("exposes the current preventive-check stage and both presentation scenes", async () => {
    apiFetchMock.mockImplementation(async (url: string) => {
      if (url === HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FEATURE_ENDPOINT) {
        return { enabled: true, rolloutPercentage: 100 };
      }
      return {};
    });
    renderCheckin();

    const flow = screen.getByTestId("checkin-flow-screen");
    expect(flow).toHaveAttribute("data-preventive-check-stage", "welcome");
    expect(flow).toHaveAttribute("data-voice-presentation-scene", "health.preventive_check.welcome");
    expect(flow).toHaveAttribute("data-touch-presentation-scene", "check-how-i-feel.welcome");

    fireEvent.click(screen.getByTestId("button-checkin-start"));
    await screen.findByText("How much energy do you have today?");
    expect(flow).toHaveAttribute("data-preventive-check-stage", "energy");
    expect(flow).toHaveAttribute("data-voice-presentation-scene", "health.preventive_check.energy");
    expect(flow).toHaveAttribute("data-touch-presentation-scene", "check-how-i-feel.energy");
  });

  it("sends equivalent voice and touch answers through the same canonical Health transition path", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, rolloutPercent: 100 }),
    });
    const touchEvents = collectHealthSyncEvents();
    renderCheckin();
    await startCheckinAndWaitForEnergyScene(touchEvents.scenes);

    fireEvent.click(screen.getByRole("button", { name: /Normal/i }));
    await waitForEnabledNext();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("How is your mood?");
    const touchObservation = touchEvents.observations.find((event) => event.status === "accepted")!;
    touchEvents.stop();

    cleanup();
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, rolloutPercent: 100 }),
    });
    const voiceEvents = collectHealthSyncEvents();
    renderCheckin();
    const energyScene = await startCheckinAndWaitForEnergyScene(voiceEvents.scenes);
    const energyProvenance = readActiveVoiceCanvasSceneProvenance();
    expect(energyProvenance?.sceneId).toBe(energyScene.viewModel.sceneId);

    act(() => emitVoiceUserMessage({
      text: "Normal",
      transcriptEntry: { from: "user", text: "Normal", timestamp: Date.parse("2026-08-07T10:00:00.000Z") },
      at: "2026-08-07T10:00:00.000Z",
      voiceUtteranceId: "voice-energy-parity-1",
      canvasProvenance: energyProvenance,
    }));
    await waitForEnabledNext();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("How is your mood?");
    const voiceObservation = voiceEvents.observations.find((event) => event.status === "accepted")!;

    expect(touchObservation.modality).toBe("touch");
    expect(voiceObservation.modality).toBe("voice");
    expect(semanticObservation(touchObservation)).toEqual(semanticObservation(voiceObservation));
    voiceEvents.stop();
  });

  it("exposes the local CheckInFlowState adapter boundary for fixture-backed projection", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, rolloutPercent: 100 }),
    });
    const events = collectHealthSyncEvents();
    renderCheckin();

    expect(screen.getByTestId("checkin-flow-adapter-boundary")).toHaveAttribute("data-status", "welcome");

    await startCheckinAndWaitForEnergyScene(events.scenes);

    const boundary = screen.getByTestId("checkin-flow-adapter-boundary");
    expect(boundary).toHaveAttribute("data-flow-id", "health.preventive_check");
    expect(boundary).toHaveAttribute("data-step", "energy");
    expect(boundary).toHaveAttribute("data-status", "question");
    expect(boundary).toHaveAttribute("data-scene-id", "health.preventive_check.energy");
    expect(boundary).toHaveAttribute("data-question-id", "health.preventive_check.energy");
    expect(boundary).toHaveAttribute("data-source", "local_fixture_adapter");
    expect(boundary).toHaveAttribute("data-has-answer-action", "true");
    events.stop();
  });

  it("keeps a persistent urgent escape on questions and resumes to the same active scene", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, rolloutPercent: 100 }),
    });
    const sosEvents: Array<CustomEvent<{ source?: string }>> = [];
    const handleSos = (event: Event) => sosEvents.push(event as CustomEvent<{ source?: string }>);
    window.addEventListener(VYVA_OPEN_SOS_EVENT, handleSos);
    const events = collectHealthSyncEvents();
    renderCheckin();
    await startCheckinAndWaitForEnergyScene(events.scenes);

    expect(screen.getByTestId("button-checkin-urgent-escape")).toHaveTextContent("If this feels urgent");
    fireEvent.click(screen.getByRole("button", { name: /Normal/i }));
    await waitForEnabledNext();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("How is your mood?");

    const moodBoundary = screen.getByTestId("checkin-flow-adapter-boundary");
    expect(moodBoundary).toHaveAttribute("data-step", "mood");
    fireEvent.click(screen.getByTestId("button-checkin-urgent-escape"));

    expect(await screen.findByText("I've paused the check-in.")).toBeInTheDocument();
    expect(screen.getByTestId("checkin-flow-adapter-boundary")).toHaveAttribute("data-status", "safety");
    expect(screen.queryByText("One step at a time")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-checkin-safety-sos"));
    expect(sosEvents).toHaveLength(1);
    expect(sosEvents[0].detail).toEqual({ source: "health_checkin_safety" });

    fireEvent.click(screen.getByTestId("button-checkin-safety-resume"));
    await screen.findByText("How is your mood?");
    const resumedBoundary = screen.getByTestId("checkin-flow-adapter-boundary");
    expect(resumedBoundary).toHaveAttribute("data-step", "mood");
    expect(resumedBoundary).toHaveAttribute("data-scene-id", "health.preventive_check.mood");

    events.stop();
    window.removeEventListener(VYVA_OPEN_SOS_EVENT, handleSos);
  });

  it("rejects delayed stale raw voice answers without rebinding them to the new scene", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, rolloutPercent: 100 }),
    });
    const events = collectHealthSyncEvents();
    renderCheckin();
    const energyScene = await startCheckinAndWaitForEnergyScene(events.scenes);
    const energyProvenance = readActiveVoiceCanvasSceneProvenance();
    expect(energyProvenance).toMatchObject({
      owner: "health_preventive_check",
      sceneId: energyScene.viewModel.sceneId,
      revision: energyScene.revision,
    });

    act(() => emitVoiceUserMessage({
      text: "Normal",
      transcriptEntry: { from: "user", text: "Normal", timestamp: Date.parse("2026-08-07T10:00:00.000Z") },
      at: "2026-08-07T10:00:00.000Z",
      voiceUtteranceId: "voice-stale-accepted-1",
      canvasProvenance: energyProvenance,
    }));
    await waitForEnabledNext();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("How is your mood?");

    act(() => {
      window.dispatchEvent(new CustomEvent<VoiceUserMessageDetail>(VYVA_VOICE_USER_MESSAGE_EVENT, {
        detail: {
          text: "Normal",
          transcriptEntry: { from: "user", text: "Normal", timestamp: Date.parse("2026-08-07T10:00:01.000Z") },
          at: "2026-08-07T10:00:01.000Z",
          canvasProvenance: energyProvenance,
        },
      }));
    });

    await waitFor(() => {
      expect(events.observations.at(-1)).toMatchObject({
        status: "rejected",
        reason: "stale_scene",
        sceneId: energyScene.viewModel.sceneId,
      });
    });
    expect(screen.getByText("How is your mood?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    events.stop();
  });

  it("fails closed for Health raw voice answers without canvas provenance", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, rolloutPercent: 100 }),
    });
    const events = collectHealthSyncEvents();
    renderCheckin();
    await startCheckinAndWaitForEnergyScene(events.scenes);

    act(() => {
      window.dispatchEvent(new CustomEvent<VoiceUserMessageDetail>(VYVA_VOICE_USER_MESSAGE_EVENT, {
        detail: {
          text: "Normal",
          transcriptEntry: { from: "user", text: "Normal", timestamp: Date.parse("2026-08-07T10:00:00.000Z") },
          at: "2026-08-07T10:00:00.000Z",
        },
      }));
    });

    expect(events.observations).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    events.stop();
  });

  it("deduplicates repeated voice events without duplicate Health progression", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, rolloutPercent: 100 }),
    });
    const events = collectHealthSyncEvents();
    renderCheckin();
    await startCheckinAndWaitForEnergyScene(events.scenes);
    const detail: VoiceUserMessageDetail = {
      text: "Normal",
      transcriptEntry: { from: "user", text: "Normal", timestamp: Date.parse("2026-08-07T10:00:00.000Z") },
      at: "2026-08-07T10:00:00.000Z",
      voiceUtteranceId: "voice-duplicate-energy-1",
      canvasProvenance: readActiveVoiceCanvasSceneProvenance(),
    };

    act(() => {
      window.dispatchEvent(new CustomEvent<VoiceUserMessageDetail>(VYVA_VOICE_USER_MESSAGE_EVENT, { detail }));
      window.dispatchEvent(new CustomEvent<VoiceUserMessageDetail>(VYVA_VOICE_USER_MESSAGE_EVENT, { detail }));
    });

    await waitFor(() => {
      expect(events.observations.filter((event) => event.status === "accepted")).toHaveLength(1);
      expect(events.observations.filter((event) => event.reason === "duplicate_event")).toHaveLength(1);
      expect(events.observations.find((event) => event.reason === "duplicate_event")?.sceneInstanceId).toBeTruthy();
    });
    await waitForEnabledNext();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("How is your mood?");
    events.stop();
  });

  it("does not toggle a multi-select answer twice for duplicate voice delivery but allows a later utterance", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, rolloutPercent: 100 }),
    });
    const events = collectHealthSyncEvents();
    renderCheckin();
    await startCheckinAndWaitForEnergyScene(events.scenes);

    fireEvent.click(screen.getByRole("button", { name: /Normal/i }));
    await waitForEnabledNext();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("How is your mood?");
    fireEvent.click(screen.getByRole("button", { name: /Calm/i }));
    await waitForEnabledNext();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Do you notice anything in your body?");
    const bodyProvenance = readActiveVoiceCanvasSceneProvenance();

    const duplicateDetail: VoiceUserMessageDetail = {
      text: "Head",
      transcriptEntry: { from: "user", text: "Head", timestamp: Date.parse("2026-08-07T10:02:00.000Z") },
      at: "2026-08-07T10:02:00.000Z",
      voiceUtteranceId: "voice-body-head-1",
      canvasProvenance: bodyProvenance,
    };

    act(() => {
      window.dispatchEvent(new CustomEvent<VoiceUserMessageDetail>(VYVA_VOICE_USER_MESSAGE_EVENT, {
        detail: duplicateDetail,
      }));
      window.dispatchEvent(new CustomEvent<VoiceUserMessageDetail>(VYVA_VOICE_USER_MESSAGE_EVENT, {
        detail: {
          ...duplicateDetail,
          transcriptEntry: {
            from: "user",
            text: "Head",
            timestamp: Date.parse("2026-08-07T10:02:05.000Z"),
          },
          at: "2026-08-07T10:02:05.000Z",
        },
      }));
    });

    await waitFor(() => {
      const bodyEvents = events.observations.filter((event) => event.sceneId === "health.preventive_check.body");
      expect(bodyEvents.filter((event) => event.status === "accepted")).toHaveLength(1);
      expect(bodyEvents.filter((event) => event.reason === "duplicate_event")).toHaveLength(1);
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    });

    act(() => {
      window.dispatchEvent(new CustomEvent<VoiceUserMessageDetail>(VYVA_VOICE_USER_MESSAGE_EVENT, {
        detail: {
          ...duplicateDetail,
          voiceUtteranceId: "voice-body-head-2",
          transcriptEntry: {
            from: "user",
            text: "Head",
            timestamp: Date.parse("2026-08-07T10:03:00.000Z"),
          },
          at: "2026-08-07T10:03:00.000Z",
        },
      }));
    });

    await waitFor(() => {
      const bodyEvents = events.observations.filter((event) => event.sceneId === "health.preventive_check.body");
      expect(bodyEvents.filter((event) => event.status === "accepted")).toHaveLength(2);
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    });
    events.stop();
  });

  it("rejects a prior remounted Health session event with the same logical scene and revision", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, rolloutPercent: 100 }),
    });
    const firstEvents = collectHealthSyncEvents();
    renderCheckin();
    const firstEnergyScene = await startCheckinAndWaitForEnergyScene(firstEvents.scenes);
    const firstProvenance = readActiveVoiceCanvasSceneProvenance();
    expect(firstProvenance?.sceneInstanceId).toBeTruthy();
    firstEvents.stop();
    cleanup();

    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, rolloutPercent: 100 }),
    });
    const secondEvents = collectHealthSyncEvents();
    renderCheckin();
    const secondEnergyScene = await startCheckinAndWaitForEnergyScene(secondEvents.scenes);
    expect(secondEnergyScene.viewModel.sceneId).toBe(firstEnergyScene.viewModel.sceneId);
    expect(secondEnergyScene.revision).toBe(firstEnergyScene.revision);
    expect(readActiveVoiceCanvasSceneProvenance()?.sceneInstanceId).not.toBe(firstProvenance?.sceneInstanceId);

    act(() => {
      window.dispatchEvent(new CustomEvent<VoiceUserMessageDetail>(VYVA_VOICE_USER_MESSAGE_EVENT, {
        detail: {
          text: "Normal",
          transcriptEntry: { from: "user", text: "Normal", timestamp: Date.parse("2026-08-07T10:06:00.000Z") },
          at: "2026-08-07T10:06:00.000Z",
          canvasProvenance: firstProvenance,
        },
      }));
    });

    await waitFor(() => {
      expect(secondEvents.observations.at(-1)).toMatchObject({
        status: "rejected",
        reason: "stale_scene_instance",
        sceneId: firstEnergyScene.viewModel.sceneId,
      });
    });
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    secondEvents.stop();
  });

  it("deduplicates duplicate delivery of the same touch event without blocking a later distinct tap", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, rolloutPercent: 100 }),
    });
    const events = collectHealthSyncEvents();
    renderCheckin();
    await startCheckinAndWaitForEnergyScene(events.scenes);
    const normalButton = screen.getByRole("button", { name: /Normal/i });
    const duplicateNativeEvent = new MouseEvent("click", { bubbles: true, cancelable: true });

    act(() => {
      normalButton.dispatchEvent(duplicateNativeEvent);
      normalButton.dispatchEvent(duplicateNativeEvent);
    });

    await waitFor(() => {
      expect(events.observations.filter((event) => event.status === "accepted")).toHaveLength(1);
      expect(events.observations.filter((event) => event.reason === "duplicate_event")).toHaveLength(1);
    });
    await waitForEnabledNext();

    fireEvent.click(screen.getByRole("button", { name: /Quite well/i }));
    await waitFor(() => {
      expect(events.observations.filter((event) => event.status === "accepted")).toHaveLength(2);
    });
    events.stop();
  });

  it("keeps stale touch delivery from mutating the current Health question or falling back to legacy", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, rolloutPercent: 100 }),
    });
    const events = collectHealthSyncEvents();
    renderCheckin();
    await startCheckinAndWaitForEnergyScene(events.scenes);
    const staleNormalButton = screen.getByRole("button", { name: /Normal/i });

    fireEvent.click(staleNormalButton);
    await waitForEnabledNext();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("How is your mood?");
    const observationCount = events.observations.length;

    fireEvent.click(staleNormalButton);

    expect(events.observations).toHaveLength(observationCount);
    expect(screen.getByText("How is your mood?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    events.stop();
  });

  it("keeps legacy Health touch handlers reachable when the Stage 7 flag is disabled", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: false, rolloutPercent: 100 }),
    });
    const events = collectHealthSyncEvents();
    renderCheckin();

    fireEvent.click(screen.getByTestId("button-checkin-start"));
    await screen.findByText("How much energy do you have today?");
    fireEvent.click(screen.getByRole("button", { name: /Normal/i }));
    await waitForEnabledNext();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("How is your mood?");

    expect(events.scenes).toHaveLength(0);
    expect(events.observations).toHaveLength(0);
    expect(apiFetchMock).toHaveBeenCalledWith(HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_FEATURE_ENDPOINT);
    events.stop();
  });

  it("opens the existing SOS sheet event from the check-in safety state", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, rolloutPercent: 100 }),
    });
    const sosEvents: Array<CustomEvent<{ source?: string }>> = [];
    const handleSos = (event: Event) => sosEvents.push(event as CustomEvent<{ source?: string }>);
    window.addEventListener(VYVA_OPEN_SOS_EVENT, handleSos);
    const events = collectHealthSyncEvents();
    renderCheckin();
    await startCheckinAndWaitForEnergyScene(events.scenes);

    fireEvent.click(screen.getByRole("button", { name: /Normal/i }));
    await waitForEnabledNext();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("How is your mood?");
    fireEvent.click(screen.getByRole("button", { name: /Calm/i }));
    await waitForEnabledNext();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Do you notice anything in your body?");
    fireEvent.click(screen.getByRole("button", { name: /Nothing special/i }));
    await waitForEnabledNext();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("How did you sleep?");
    fireEvent.click(screen.getByRole("button", { name: /WellI slept enough/i }));
    await waitForEnabledNext();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Anything else you want to mention?");
    fireEvent.click(screen.getByRole("button", { name: /Short of breath/i }));
    await waitForEnabledNext();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Let's narrow it down");
    fireEvent.click(screen.getByRole("button", { name: /Only when moving/i }));
    await waitForEnabledNext();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByTestId("button-checkin-safety-sos");

    fireEvent.click(screen.getByTestId("button-checkin-safety-sos"));

    expect(sosEvents).toHaveLength(1);
    expect(sosEvents[0].detail).toEqual({ source: "health_checkin_safety" });
    expect(screen.getByTestId("checkin-flow-adapter-boundary")).toHaveAttribute("data-status", "safety");
    events.stop();
    window.removeEventListener(VYVA_OPEN_SOS_EVENT, handleSos);
  });
});
