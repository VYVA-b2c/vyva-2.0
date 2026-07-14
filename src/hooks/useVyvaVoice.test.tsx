import { useEffect } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useVyvaVoice, VyvaVoiceProvider } from "./useVyvaVoice";
import {
  VYVA_VOICE_SESSION_STORAGE_KEY,
  VYVA_VOICE_TRIAGE_TOUCH_ANSWER_EVENT,
} from "@/lib/voiceSessionBridge";

const voiceMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getToken: vi.fn(),
  getAgentAppContextVariables: vi.fn(),
  subscribeAgentAppContext: vi.fn(),
  startSession: vi.fn(),
  recordVoiceTimelineEvent: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getToken: voiceMocks.getToken,
}));

vi.mock("@/lib/agentAppContext", () => ({
  getAgentAppContextVariables: voiceMocks.getAgentAppContextVariables,
  subscribeAgentAppContext: voiceMocks.subscribeAgentAppContext,
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: voiceMocks.apiFetch,
}));

vi.mock("@/lib/voiceTimeline", () => ({
  recordVoiceTimelineEvent: voiceMocks.recordVoiceTimelineEvent,
}));

vi.mock("@elevenlabs/client", () => ({
  Conversation: {
    startSession: voiceMocks.startSession,
  },
}));

type VoiceController = ReturnType<typeof useVyvaVoice>;

type MockConversation = {
  endSession: ReturnType<typeof vi.fn>;
  setMicMuted: ReturnType<typeof vi.fn>;
  sendUserMessage: ReturnType<typeof vi.fn>;
  sendContextualUpdate: ReturnType<typeof vi.fn>;
};

type MockStartSessionOptions = {
  onConversationCreated?: (conversation: MockConversation) => void;
  onConnect?: () => void;
  onMessage?: (payload: unknown) => void;
  onAgentChatResponsePart?: (part: unknown) => void;
  onDebug?: (payload: unknown) => void;
};

const createdConversations: MockConversation[] = [];

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function createConversation() {
  const conversation = {
    endSession: vi.fn().mockResolvedValue(undefined),
    setMicMuted: vi.fn(),
    sendUserMessage: vi.fn(),
    sendContextualUpdate: vi.fn(),
  };
  createdConversations.push(conversation);
  return conversation;
}

function VoiceHarness({ onController }: { onController: (controller: VoiceController) => void }) {
  const controller = useVyvaVoice();

  useEffect(() => {
    onController(controller);
  }, [controller, onController]);

  return (
    <>
      <div data-testid="voice-status">{controller.status}</div>
      <div data-testid="voice-transcript">
        {controller.transcript.map((entry) => `${entry.from}:${entry.text}`).join("|")}
      </div>
    </>
  );
}

describe("useVyvaVoice", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    createdConversations.length = 0;
    voiceMocks.apiFetch.mockReset();
    voiceMocks.getToken.mockReset();
    voiceMocks.getAgentAppContextVariables.mockReset();
    voiceMocks.subscribeAgentAppContext.mockReset();
    voiceMocks.startSession.mockReset();
    voiceMocks.recordVoiceTimelineEvent.mockReset();

    voiceMocks.getToken.mockReturnValue(null);
    voiceMocks.getAgentAppContextVariables.mockReturnValue({});
    voiceMocks.subscribeAgentAppContext.mockReturnValue(() => {});
    voiceMocks.apiFetch.mockImplementation(async (url: string) => {
      if (url === "/api/voice-readiness") {
        return jsonResponse({ ready: true, agent_id_present: true });
      }

      if (url === "/api/voice-context") {
        return jsonResponse({ dynamic_variables: {} });
      }

      if (url === "/api/router") {
        return jsonResponse({
          agent_id: "agent_router",
          system_prompt_override: "Use the health voice context without overriding the ElevenLabs prompt.",
          dynamic_variables: { routing_domain: "health" },
          session_data: {
            domain: "health",
            intent_confidence: 0.91,
            session_id: "voice-session-test",
            turn_count: 1,
            last_agent: null,
          },
        });
      }

      if (url === "/api/elevenlabs-conversation-token") {
        return jsonResponse({ signed_url: "wss://example.test/voice-session" });
      }

      throw new Error(`Unexpected voice API request: ${url}`);
    });
    voiceMocks.startSession.mockImplementation(async (options: MockStartSessionOptions) => {
      const conversation = createConversation();
      options.onConversationCreated?.(conversation);
      options.onConnect?.();
      return conversation;
    });
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("starts a new ElevenLabs session after the user stops the previous one", async () => {
    let controller: VoiceController | null = null;

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice("app_open", undefined, {
        agentId: "agent_test",
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    expect(voiceMocks.startSession).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("voice-status")).toHaveTextContent("connected");

    act(() => {
      controller?.stopVoice();
    });

    expect(createdConversations[0].endSession).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("voice-status")).toHaveTextContent("idle");

    await act(async () => {
      await controller?.startVoice("app_open", undefined, {
        agentId: "agent_test",
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    expect(voiceMocks.startSession).toHaveBeenCalledTimes(2);
    expect(createdConversations).toHaveLength(2);
  });

  it("does not send prompt overrides when router returns voice context", async () => {
    let controller: VoiceController | null = null;

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice("health questions", undefined, {
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    const sessionOptions = voiceMocks.startSession.mock.calls[0]?.[0] as { overrides?: unknown } | undefined;
    expect(sessionOptions).toBeDefined();
    expect(sessionOptions).not.toHaveProperty("overrides");

    const tokenCall = voiceMocks.apiFetch.mock.calls.find(([url]) => url === "/api/elevenlabs-conversation-token");
    expect(tokenCall).toBeDefined();
    const tokenBody = JSON.parse(((tokenCall?.[1] as RequestInit | undefined)?.body as string | undefined) ?? "{}");
    expect(tokenBody).not.toHaveProperty("prompt_override");
    expect(createdConversations[0].sendContextualUpdate).toHaveBeenCalledWith(
      "Use the health voice context without overriding the ElevenLabs prompt.",
    );
  });

  it("shares the ElevenLabs conversation id with the symptom check page", async () => {
    let controller: VoiceController | null = null;

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice("health questions", undefined, {
        agentSlug: "health",
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    const sessionId = sessionStorage.getItem(VYVA_VOICE_SESSION_STORAGE_KEY);
    expect(sessionId).toBeTruthy();
    expect(localStorage.getItem(VYVA_VOICE_SESSION_STORAGE_KEY)).toBe(sessionId);
  });

  it("syncs tapped symptom-check answers into the active ElevenLabs session", async () => {
    let controller: VoiceController | null = null;

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice("health questions", undefined, {
        agentSlug: "health",
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    const sessionId = sessionStorage.getItem(VYVA_VOICE_SESSION_STORAGE_KEY);
    expect(sessionId).toBeTruthy();
    createdConversations[0].sendContextualUpdate.mockClear();

    act(() => {
      window.dispatchEvent(new CustomEvent(VYVA_VOICE_TRIAGE_TOUCH_ANSWER_EVENT, {
        detail: {
          conversationId: sessionId,
          utterance: "No, I can stand safely.",
          choiceId: "no_red_flags",
          nextQuestion: "How long has this been happening?",
          status: "active",
        },
      }));
    });

    expect(createdConversations[0].sendContextualUpdate).toHaveBeenCalledWith(expect.stringContaining("No, I can stand safely."));
    expect(createdConversations[0].sendContextualUpdate).toHaveBeenCalledWith(expect.stringContaining("How long has this been happening?"));
  });

  it("adds final ElevenLabs agent messages to the visible VYVA transcript", async () => {
    let controller: VoiceController | null = null;

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice("app_open", undefined, {
        agentId: "agent_test",
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    const sessionOptions = voiceMocks.startSession.mock.calls[0]?.[0] as MockStartSessionOptions | undefined;
    act(() => {
      sessionOptions?.onMessage?.({ role: "agent", source: "ai", message: "Hola Karim" });
    });

    expect(screen.getByTestId("voice-transcript")).toHaveTextContent("vyva:Hola Karim");
  });

  it("adds raw ElevenLabs agent response events to the visible VYVA transcript", async () => {
    let controller: VoiceController | null = null;

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice("app_open", undefined, {
        agentId: "agent_test",
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    const sessionOptions = voiceMocks.startSession.mock.calls[0]?.[0] as MockStartSessionOptions | undefined;
    act(() => {
      sessionOptions?.onDebug?.({
        type: "agent_response",
        agent_response_event: {
          agent_response: "Soy su asistente personal.",
          event_id: 7,
        },
      });
    });

    expect(screen.getByTestId("voice-transcript")).toHaveTextContent("vyva:Soy su asistente personal.");
  });

  it("streams ElevenLabs agent response parts into one visible VYVA transcript", async () => {
    let controller: VoiceController | null = null;

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice("app_open", undefined, {
        agentId: "agent_test",
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    const sessionOptions = voiceMocks.startSession.mock.calls[0]?.[0] as MockStartSessionOptions | undefined;
    act(() => {
      sessionOptions?.onAgentChatResponsePart?.({ type: "start", text: "" });
      sessionOptions?.onAgentChatResponsePart?.({ type: "delta", text: "Hola" });
      sessionOptions?.onAgentChatResponsePart?.({ type: "delta", text: " Karim" });
    });

    expect(screen.getByTestId("voice-transcript")).toHaveTextContent("vyva:Hola Karim");

    act(() => {
      sessionOptions?.onMessage?.({ role: "agent", source: "ai", message: "Hola Karim" });
    });

    expect(screen.getByTestId("voice-transcript").textContent?.split("vyva:").length).toBe(2);
    expect(screen.getByTestId("voice-transcript")).toHaveTextContent("vyva:Hola Karim");
  });

  it("streams raw ElevenLabs text response parts into one visible VYVA transcript", async () => {
    let controller: VoiceController | null = null;

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice("app_open", undefined, {
        agentId: "agent_test",
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    const sessionOptions = voiceMocks.startSession.mock.calls[0]?.[0] as MockStartSessionOptions | undefined;
    act(() => {
      sessionOptions?.onDebug?.({
        type: "agent_chat_response_part",
        text_response_part: { type: "start", text: "", event_id: 12 },
      });
      sessionOptions?.onDebug?.({
        type: "agent_chat_response_part",
        text_response_part: { type: "delta", text: "Puedo ayudar", event_id: 12 },
      });
      sessionOptions?.onDebug?.({
        type: "agent_chat_response_part",
        text_response_part: { type: "delta", text: " con salud.", event_id: 12 },
      });
    });

    expect(screen.getByTestId("voice-transcript")).toHaveTextContent("vyva:Puedo ayudar con salud.");
  });

  it("keeps user messages separate from VYVA transcript events", async () => {
    let controller: VoiceController | null = null;

    render(
      <VyvaVoiceProvider>
        <VoiceHarness onController={(nextController) => {
          controller = nextController;
        }} />
      </VyvaVoiceProvider>,
    );

    await waitFor(() => expect(controller).not.toBeNull());

    await act(async () => {
      await controller?.startVoice("app_open", undefined, {
        agentId: "agent_test",
        autoStartListening: true,
        skipMicrophone: true,
      });
    });

    const sessionOptions = voiceMocks.startSession.mock.calls[0]?.[0] as MockStartSessionOptions | undefined;
    act(() => {
      sessionOptions?.onMessage?.({ role: "user", source: "user", message: "I need help" });
      sessionOptions?.onAgentChatResponsePart?.({ type: "delta", text: "I can help with that." });
    });

    expect(screen.getByTestId("voice-transcript")).toHaveTextContent("user:I need help");
    expect(screen.getByTestId("voice-transcript")).toHaveTextContent("vyva:I can help with that.");
  });
});
