import { useCallback, useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Settings, ArrowUp } from "lucide-react";
import { useVyvaVoice, type TranscriptEntry } from "@/hooks/useVyvaVoice";
import { SECTION_VOICE_AUTO_START_KEY } from "@/hooks/useRouteVoiceAutoStart";
import VoiceCallOverlay from "@/components/VoiceCallOverlay";
import { apiFetch } from "@/lib/queryClient";
import { useAppLanguage } from "@/i18n";

type LiveChatHistoryTurn = { role: "user" | "assistant"; content: string };

const ChatScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, t } = useAppLanguage();
  const [searchParams] = useSearchParams();
  const {
    startVoice,
    stopVoice,
    sendText,
    transcript,
    status,
    isConnecting,
    isSpeaking,
    voiceSessionPhase,
    isMicMuted,
    setMicrophoneMuted,
    lastError,
    lastErrorCode,
  } = useVyvaVoice();
  const [text, setText] = useState("");
  const [typedTranscript, setTypedTranscript] = useState<TranscriptEntry[]>([]);
  const [isTextSending, setIsTextSending] = useState(false);
  const pendingRef = useRef<string | null>(searchParams.get("q"));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const routeState = location.state as Record<string, unknown> | null;
  const hasRouteVoiceAutoStart = routeState?.[SECTION_VOICE_AUTO_START_KEY] === true;
  const isVoiceMode = searchParams.get("mode") === "voice" || hasRouteVoiceAutoStart;
  const visibleTranscript = isVoiceMode ? transcript : typedTranscript;

  useEffect(() => {
    if (!isVoiceMode) {
      stopVoice();
      return;
    }

    void startVoice("companion", undefined, {
      skipMicrophone: false,
      autoStartListening: true,
      dynamicVariables: {
        app_entrypoint: "chat_voice_mode",
      },
    });
  }, [isVoiceMode, startVoice, stopVoice]);

  useEffect(() => {
    if (!hasRouteVoiceAutoStart) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("mode", "voice");
    navigate(`${location.pathname}?${nextParams.toString()}`, { replace: true, state: null });
  }, [hasRouteVoiceAutoStart, location.pathname, navigate, searchParams]);

  const localFallbackReply = useCallback((message: string) => {
    const lower = message.toLowerCase();
    if (language.startsWith("es")) {
      if (lower.includes("medico") || lower.includes("doctor")) {
        return "Puedo ayudarte a preparar el siguiente paso. Dime que necesitas y VYVA lo dejara listo para que confirmes antes de contactar a nadie.";
      }
      return "Estoy aqui contigo. Dime un poco mas y te ayudare a elegir el siguiente paso de forma sencilla.";
    }
    if (lower.includes("doctor") || lower.includes("appointment")) {
      return "I can help prepare the next step. Tell me what you need, and VYVA will keep it ready for you to confirm before anyone is contacted.";
    }
    return "I am here with you. Tell me a little more, and I will help you choose the next simple step.";
  }, [language]);

  const sendTypedMessage = useCallback(async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || isTextSending) return;

    const history: LiveChatHistoryTurn[] = typedTranscript.slice(-12).map((entry) => ({
      role: entry.from === "user" ? "user" : "assistant",
      content: entry.text,
    }));

    setTypedTranscript((previous) => [
      ...previous,
      { from: "user", text: message, timestamp: Date.now() },
    ]);
    setIsTextSending(true);

    try {
      const response = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          history,
          locale: language,
        }),
      });

      if (!response.ok) throw new Error(`Chat request failed: ${response.status}`);
      const data = await response.json() as { reply?: unknown };
      const reply = typeof data.reply === "string" && data.reply.trim()
        ? data.reply.trim()
        : localFallbackReply(message);

      setTypedTranscript((previous) => [
        ...previous,
        { from: "vyva", text: reply, timestamp: Date.now() },
      ]);
    } catch {
      setTypedTranscript((previous) => [
        ...previous,
        { from: "vyva", text: localFallbackReply(message), timestamp: Date.now() },
      ]);
    } finally {
      setIsTextSending(false);
    }
  }, [isTextSending, language, localFallbackReply, typedTranscript]);

  useEffect(() => {
    if (!pendingRef.current) return;

    if (!isVoiceMode) {
      const pending = pendingRef.current;
      pendingRef.current = null;
      void sendTypedMessage(pending);
      return;
    }

    if (status === "connected") {
      sendText(pendingRef.current);
      pendingRef.current = null;
    }
  }, [isVoiceMode, sendText, sendTypedMessage, status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleTranscript, isTextSending]);

  const handleSend = () => {
    if (!text.trim()) return;
    void sendTypedMessage(text.trim());
    setText("");
  };

  const connectionLabel = isTextSending
    ? t("chat.mode.thinking", "VYVA is replying")
    : t("chat.mode.typeStatus", "Text mode");

  const handleEndVoiceMode = () => {
    stopVoice();
    navigate("/", { replace: true });
  };

  const handleRetryVoiceMode = () => {
    stopVoice();
    void startVoice("companion", undefined, {
      autoStartListening: true,
      dynamicVariables: {
        app_entrypoint: "chat_voice_mode",
      },
    });
  };

  if (isVoiceMode) {
    return (
      <VoiceCallOverlay
        isSpeaking={isSpeaking}
        isConnecting={isConnecting || (status === "idle" && !lastError)}
        transcript={transcript}
        onEnd={handleEndVoiceMode}
        voiceSessionPhase={voiceSessionPhase}
        isMicMuted={isMicMuted}
        onMicToggle={setMicrophoneMuted}
        connectionError={lastError}
        connectionErrorCode={lastErrorCode}
        onRetry={handleRetryVoiceMode}
      />
    );
  }

  return (
    <div
      className="flex flex-col"
      style={{ height: "100vh", background: "#2D0A5E" }}
    >
      {/* Minimal top bar */}
      <div className="flex items-center px-4 pt-[52px] pb-2 flex-shrink-0">
        <button
          onClick={() => { stopVoice(); navigate("/"); }}
          data-testid="button-chat-back"
          className="w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.12)" }}
        >
          <ChevronLeft size={18} className="text-white" />
        </button>
        <div className="flex-1 text-center">
          <span className="font-body text-[15px] font-medium" style={{ color: "rgba(255,255,255,0.80)" }}>
            VYVA
          </span>
          <div className="font-body text-[11px]" style={{ color: "rgba(255,255,255,0.38)" }}>
            {connectionLabel}
          </div>
        </div>
        <div className="w-9 h-9" />
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-3"
        style={{ scrollbarWidth: "none" }}
      >
        {visibleTranscript.length === 0 ? (
          <div
            data-testid="chat-empty-state"
            className="mx-auto flex min-h-[44vh] w-full max-w-[360px] flex-col items-center justify-center text-center"
          >
            <div
              className="mb-5 flex h-16 w-16 items-center justify-center rounded-full font-display text-[30px] font-black text-white"
              style={{
                background: "linear-gradient(135deg, #5B12A0 0%, #7C3AED 100%)",
                boxShadow: "0 18px 42px rgba(124,58,237,0.24)",
              }}
              aria-hidden="true"
            >
              V
            </div>
            <h1 className="font-body text-[30px] font-black leading-tight text-white">
              {t("chat.emptyTitle", "Ask VYVA")}
            </h1>
            <p className="mt-3 max-w-[280px] font-body text-[16px] font-semibold leading-relaxed" style={{ color: "rgba(255,255,255,0.66)" }}>
              {t("chat.emptyBody", "Health, rides, reminders, or a quiet chat.")}
            </p>
          </div>
        ) : (
          <div className="text-center py-3">
            <span className="font-body text-[13px]" style={{ color: "rgba(255,255,255,0.38)" }}>
              {t("chat.started")}
            </span>
          </div>
        )}

        {visibleTranscript.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.from === "user" ? "justify-end" : "justify-start"}`}
            data-testid={`bubble-chat-${msg.from}-${i}`}
          >
            {msg.from === "vyva" && (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 self-end"
                style={{ background: "linear-gradient(135deg, #5B12A0 0%, #7C3AED 100%)" }}
              >
                <span className="font-display text-[13px] font-bold text-white">V</span>
              </div>
            )}
            <div
              className="max-w-[78%] px-4 py-3"
              style={
                msg.from === "user"
                  ? { background: "#3D1070", borderRadius: "20px 20px 6px 20px" }
                  : { background: "rgba(255,255,255,0.10)", borderRadius: "20px 20px 20px 6px" }
              }
            >
              <p className="font-body text-[16px] leading-[1.6] text-white">{msg.text}</p>
            </div>
          </div>
        ))}

        {isTextSending && (
          <div className="flex justify-start gap-3" data-testid="bubble-chat-vyva-thinking">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 self-end"
              style={{ background: "linear-gradient(135deg, #5B12A0 0%, #7C3AED 100%)" }}
            >
              <span className="font-display text-[13px] font-bold text-white">V</span>
            </div>
            <div
              className="max-w-[78%] px-4 py-3"
              style={{ background: "rgba(255,255,255,0.10)", borderRadius: "20px 20px 20px 6px" }}
            >
              <p className="font-body text-[16px] leading-[1.6] text-white">
                {t("chat.mode.thinkingBody", "Thinking with you...")}
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div className="px-4 pb-8 pt-2 flex-shrink-0">
        <div
          className="flex flex-col rounded-[22px] px-4 pt-3 pb-2"
          style={{
            background: "rgba(255,255,255,0.09)",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t("chat.sendMessage")}
            data-testid="input-chat-type"
            rows={1}
            className="w-full bg-transparent font-body text-[16px] text-white resize-none focus:outline-none leading-[1.5]"
            style={{ minHeight: "28px", maxHeight: "120px", color: "white" }}
          />
          <style>{`
            textarea[data-testid="input-chat-type"]::placeholder { color: rgba(255,255,255,0.38); }
          `}</style>

          <div className="flex items-center justify-between mt-2">
            <button
              onClick={() => navigate("/settings")}
              data-testid="button-chat-settings"
              className="w-9 h-9 flex items-center justify-center rounded-full"
              style={{ color: "rgba(255,255,255,0.50)" }}
            >
              <Settings size={18} />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSend}
                disabled={!text.trim() || isTextSending}
                data-testid="button-chat-send"
                className="w-9 h-9 flex items-center justify-center rounded-full disabled:opacity-30 transition-opacity"
                style={{ background: "#7C3AED" }}
              >
                <ArrowUp size={16} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ChatScreen;
