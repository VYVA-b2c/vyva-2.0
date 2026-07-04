import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShell, { buildVoiceActionRouteState, emergencyProfileContactFromState, getAppShellLayout, SosSheet } from "./AppShell";
import type { VoiceSessionPhase } from "@/lib/voiceSessionState";
import type { VoiceAppAction } from "@/lib/voiceNavigation";

const voiceState = vi.hoisted(() => ({
  status: "idle" as "idle" | "connecting" | "connected",
  isConnecting: false,
  isSpeaking: false,
  transcript: [] as Array<{ from: "user" | "vyva"; text: string; timestamp: number }>,
  voiceSessionPhase: "idle" as VoiceSessionPhase,
  isMicMuted: false,
  lastError: null as string | null,
  lastErrorCode: null as string | null,
  voiceDiagnostics: [],
  stopVoice: vi.fn(),
  setMicrophoneMuted: vi.fn(),
  startVoice: vi.fn(),
  beginVoiceTransfer: vi.fn(),
  sendContextUpdate: vi.fn(),
  recordRecommendationFeedback: vi.fn(),
}));

const voiceActionState = vi.hoisted(() => ({
  activeAction: null as VoiceAppAction | null,
  completeActiveAction: vi.fn(),
  dismissActiveAction: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({ data: null, isLoading: false }),
  };
});

vi.mock("@/hooks/useVyvaVoice", () => ({
  useVyvaVoice: () => voiceState,
}));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: { country: "US" } }),
}));

vi.mock("@/hooks/useServiceGate", () => ({
  useServiceGate: () => ({
    canUseService: () => true,
    guardPath: vi.fn(() => true),
    readiness: { services: {} },
  }),
}));

vi.mock("@/hooks/useToastSurface", () => ({
  useToastSurface: () => ({ current: null }),
}));

vi.mock("@/contexts/VoiceActionContext", () => ({
  useVoiceActionContext: () => ({
    activeAction: voiceActionState.activeAction,
    completeActiveAction: voiceActionState.completeActiveAction,
    dismissActiveAction: voiceActionState.dismissActiveAction,
  }),
}));

vi.mock("./StatusBar", () => ({
  default: () => <div data-testid="status-bar" />,
}));

vi.mock("./BottomNav", () => ({
  default: () => <nav data-testid="bottom-nav" />,
}));

vi.mock("./VoiceActionSimulator", () => ({
  default: () => null,
}));

vi.mock("./MotivationMilestoneProvider", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("./VoiceCallOverlay", () => ({
  default: ({ onEnd, onMinimize }: { onEnd: () => void; onMinimize?: () => void }) => (
    <div data-testid="voice-call-overlay">
      {onMinimize && (
        <button type="button" data-testid="button-minimize-call" onClick={onMinimize}>
          Minimize
        </button>
      )}
      <button type="button" data-testid="button-end-call" onClick={onEnd}>
        End
      </button>
    </div>
  ),
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string, values?: Record<string, string>) => {
        if (!fallback) return _key;
        return fallback.replace(/{{(\w+)}}/g, (_, token) => values?.[token] ?? "");
      },
    }),
  };
});

describe("SOS service actions", () => {
  it("turns the primary SOS action into a direct emergency call", () => {
    render(<SosSheet open onOpenChange={vi.fn()} country="US" />);

    expect(screen.getByTestId("button-sos-confirm")).toHaveAttribute("href", "tel:911");
    expect(screen.getByTestId("button-sos-confirm")).toHaveTextContent("Call 911 now");
  });

  it("adds a direct call to the saved emergency contact when available", () => {
    render(
      <SosSheet
        open
        onOpenChange={vi.fn()}
        country="ES"
        profileContact={{ name: "Maria", primaryPhone: "+34 612 345 678" }}
      />,
    );

    expect(screen.getByTestId("button-sos-confirm")).toHaveAttribute("href", "tel:112");
    expect(screen.getByTestId("button-sos-call-contact")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-sos-call-contact")).toHaveTextContent("Call Maria");
  });

  it("keeps the cancel action as a close-only action", () => {
    const onOpenChange = vi.fn();
    render(<SosSheet open onOpenChange={onOpenChange} country="ES" />);

    fireEvent.click(screen.getByTestId("button-sos-cancel"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("extracts the profile emergency contact from onboarding state", () => {
    expect(emergencyProfileContactFromState({
      profile: {
        emergency_contact: {
          name: "Maria",
          relationship: "Daughter",
          primary_phone: "+34 612 345 678",
          secondary_phone: "",
        },
      },
    })).toEqual({
      name: "Maria",
      relationship: "Daughter",
      primaryPhone: "+34 612 345 678",
      secondaryPhone: "",
    });
  });
});

describe("app shell route layout", () => {
  it.each([
    ["/", "wide"],
    ["/settings/account", "wide"],
    ["/health/symptom-check", "wide"],
    ["/health/vitals", "vitals"],
    ["/social-rooms/music-room", "wide"],
    ["/companions", "wide"],
    ["/concierge/shopping", "wide"],
    ["/senses", "wide"],
    ["/chat", "fullscreen"],
    ["/activities/relax-breathe", "fullscreen"],
    ["/memory-games/word_recall", "fullscreen"],
    ["/attention-boosters/rhythm-tap", "fullscreen"],
    ["/profiles/select", "compact"],
    ["/onboarding/profile/health", "compact"],
  ] as const)("classifies %s as %s", (pathname, layout) => {
    expect(getAppShellLayout(pathname)).toBe(layout);
  });
});

describe("app shell voice dock", () => {
  function makeVoiceAction(overrides: Partial<VoiceAppAction> = {}): VoiceAppAction {
    return {
      id: "voice_concierge_task",
      actionType: "concierge.task",
      domain: "concierge",
      route: "/concierge",
      title: "Concierge help",
      summary: "Opening Concierge.",
      cue: "Help with the request.",
      sourceText: "help me book something",
      priority: "medium",
      feedbackReason: "Agent requested concierge support.",
      requiredPayloadKeys: [],
      optionalPayloadKeys: [],
      safetyLevel: "sensitive",
      requiresConfirmation: true,
      completion: {
        mode: "manual",
        doneLabel: "Done",
        expiresAfterMs: 90000,
      },
      ...overrides,
    };
  }

  function renderShell(path = "/") {
    return render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[path]}>
        <AppShell>
          <div>Page content</div>
        </AppShell>
      </MemoryRouter>,
    );
  }

  beforeEach(() => {
    voiceState.status = "connected";
    voiceState.isConnecting = false;
    voiceState.isSpeaking = false;
    voiceState.transcript = [{ from: "vyva", text: "Hello Karim", timestamp: 1 }];
    voiceState.voiceSessionPhase = "listening";
    voiceState.isMicMuted = false;
    voiceState.lastError = null;
    voiceState.lastErrorCode = null;
    voiceState.stopVoice.mockClear();
    voiceState.setMicrophoneMuted.mockClear();
    voiceActionState.activeAction = null;
    voiceActionState.completeActiveAction.mockClear();
    voiceActionState.dismissActiveAction.mockClear();
  });

  it("opens the focused voice screen from the dock and restores the dock when minimized", () => {
    renderShell();

    expect(screen.getByTestId("voice-session-dock")).toBeInTheDocument();
    expect(screen.getByTestId("voice-session-dock")).toHaveTextContent("Listening");
    expect(screen.getByTestId("voice-session-dock")).toHaveTextContent("Hello Karim");
    expect(screen.getByTestId("button-dock-toggle-mic")).toHaveAttribute("title", "Mic off");
    expect(screen.queryByTestId("voice-call-overlay")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-open-voice-overlay"));

    expect(screen.getByTestId("voice-call-overlay")).toBeInTheDocument();
    expect(screen.queryByTestId("voice-session-dock")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-minimize-call"));

    expect(screen.queryByTestId("voice-call-overlay")).not.toBeInTheDocument();
    expect(screen.getByTestId("voice-session-dock")).toBeInTheDocument();
    expect(voiceState.stopVoice).not.toHaveBeenCalled();
  });

  it("uses compact copy when VYVA is speaking from the dock", () => {
    voiceState.isSpeaking = true;
    voiceState.voiceSessionPhase = "speaking";
    voiceState.transcript = [{ from: "vyva", text: "Try naming three things", timestamp: 2 }];

    renderShell();

    const dock = screen.getByTestId("voice-session-dock");
    expect(dock).toHaveTextContent("Speaking");
    expect(dock).not.toHaveTextContent("VYVA speaking");
    expect(dock).toHaveTextContent("Try naming three things");
  });

  it("keeps non-health voice actions visible on their route", () => {
    voiceActionState.activeAction = makeVoiceAction();

    renderShell("/concierge");

    expect(screen.getByTestId("voice-action-card")).toHaveTextContent("Concierge help");
    expect(screen.getByTestId("voice-action-card")).toHaveTextContent("VYVA opened Concierge");
  });

  it("builds route prefill state for ride voice actions", () => {
    const state = buildVoiceActionRouteState(makeVoiceAction({
      id: "voice_concierge_ride_booking",
      actionType: "concierge.ride_booking",
      title: "Ride help",
      route: "/concierge",
      payload: {
        pickup: "Home",
        destination: "Doctor",
        time: "tomorrow morning",
        mobility_needs: "walker",
      },
    }));

    expect(state.voiceActionType).toBe("concierge.ride_booking");
    expect(state.voiceActionPayload).toMatchObject({
      pickup: "Home",
      destination: "Doctor",
      time: "tomorrow morning",
    });
    expect(state.conciergePrefill).toMatchObject({
      kind: "ride",
      source: "voice_action",
    });
    expect(JSON.stringify(state.conciergePrefill)).toContain("destination: Doctor");
  });

  it("builds shopping prefill state for order voice actions", () => {
    const state = buildVoiceActionRouteState(makeVoiceAction({
      id: "voice_concierge_order_request",
      actionType: "concierge.order_request",
      title: "Order help",
      route: "/concierge/shopping",
      sourceText: "Order groceries for tomorrow",
      payload: {
        items: "groceries",
        category: "groceries",
        delivery_time: "tomorrow",
      },
    }));

    expect(state.voiceActionType).toBe("concierge.order_request");
    expect(state.shoppingPrefill).toMatchObject({
      needText: "groceries",
      category: "groceries",
      priorities: ["delivery", "simplicity"],
      constraints: ["tomorrow"],
    });
  });

  it("does not show Health voice action cards after landing on a Health route", async () => {
    voiceActionState.activeAction = makeVoiceAction({
      id: "voice_symptom_support",
      actionType: "health.symptom_support",
      domain: "health",
      route: "/health/symptom-check",
      title: "Symptom support",
      summary: "Opening symptom support.",
      cue: "Ask one focused question at a time.",
      sourceText: "I want a symptom check",
      feedbackReason: "Agent requested symptom-support context.",
      safetyLevel: "medical",
      requiresConfirmation: false,
    });

    renderShell("/health/symptom-check");

    expect(screen.queryByTestId("voice-action-card")).not.toBeInTheDocument();
    expect(screen.queryByText("VYVA opened Health")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(voiceActionState.completeActiveAction).toHaveBeenCalledWith({
        metadata: {
          source: "app_voice_health_route_landed",
          current_path: "/health/symptom-check",
        },
      });
    });
  });
});
