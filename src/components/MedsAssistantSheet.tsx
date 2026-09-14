import { useCallback, useState, useEffect, useRef } from "react";
import { Send, Loader2, AlertTriangle, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PurpleModal } from "@/components/vyva-ui";
import { useLanguage } from "@/i18n";

const EN_DISCLAIMER =
  "This is information only, not medical advice - always check with your doctor or pharmacist.";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface MedsAssistantSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  initialPrompt: string;
}

async function callAssistant(prompt: string, history: ChatMessage[], locale: string, emptyResponseFallback: string): Promise<string> {
  const res = await fetch("/api/meds-assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, history, locale }),
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const data = await res.json() as { response?: string };
  return data.response?.trim() || emptyResponseFallback;
}

const MedsAssistantSheet = ({
  open,
  onOpenChange,
  title,
  subtitle,
  initialPrompt,
}: MedsAssistantSheetProps) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentInitial = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reqIdRef = useRef(0);

  const sendMessage = useCallback(async (text: string, history: ChatMessage[]) => {
    const myReqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const response = await callAssistant(
        text,
        history,
        language,
        t(
          "meds.assistantEmptyFallback",
          "VYVA could not complete a personalised answer just now. Review the current checks and ask a pharmacist or doctor before taking new, changed, or uncertain medicines together. Do not start, stop, skip, or change a dose based on this screen.",
        ),
      );
      if (reqIdRef.current !== myReqId) return;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response },
      ]);
    } catch {
      if (reqIdRef.current !== myReqId) return;
      setError(t("meds.assistantError", "Something went wrong. Please try again."));
    } finally {
      if (reqIdRef.current === myReqId) setLoading(false);
    }
  }, [language, t]);

  useEffect(() => {
    if (open && !sentInitial.current) {
      sentInitial.current = true;
      void sendMessage(initialPrompt, []);
    }
    if (!open) {
      reqIdRef.current += 1;
      setMessages([]);
      setInput("");
      setError(null);
      setLoading(false);
      sentInitial.current = false;
    }
  }, [initialPrompt, open, sendMessage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput("");
    void sendMessage(text, nextHistory);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function renderMessageContent(content: string) {
    const localizedDisclaimer = t("meds.disclaimer", EN_DISCLAIMER);
    const parts = content.split(EN_DISCLAIMER);
    return (
      <>
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <span className="block mt-2 font-body text-[11px] italic text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
                {localizedDisclaimer}
              </span>
            )}
          </span>
        ))}
      </>
    );
  }

  const localizedDisclaimer = t("meds.disclaimer", EN_DISCLAIMER);

  if (!open) return null;

  return (
    <PurpleModal
      Icon={MessageCircle}
      kicker={t("meds.assistantKicker", "Medication")}
      title={title}
      subtitle={subtitle ?? t("meds.assistantSubtitle", "Ask a follow-up question or read the answer here.")}
      titleId="meds-assistant-title"
      onClose={() => onOpenChange(false)}
      closeLabel={t("common.close", "Close")}
      panelTestId="modal-meds-assistant"
      size="narrow"
      bodyClassName="flex max-h-[calc(88vh-132px)] flex-col p-0"
    >
        <div className="flex min-h-[420px] flex-1 flex-col overflow-hidden">

        {/* Disclaimer banner */}
        <div className="mx-5 mt-4 flex flex-shrink-0 items-start gap-2 rounded-[16px] border border-amber-200 bg-amber-50 px-3 py-3">
          <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="font-body text-[11px] text-amber-700 leading-relaxed">
            {localizedDisclaimer}
          </p>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
        >
          {messages.length === 0 && loading && (
            <div className="flex items-start gap-2 mt-2">
              <div className="w-8 h-8 rounded-full bg-vyva-purple flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[10px] font-bold">V</span>
              </div>
              <div className="bg-vyva-bg-soft rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                <Loader2 size={16} className="animate-spin text-vyva-purple" />
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              data-testid={`meds-assistant-message-${msg.role}-${i}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-vyva-purple flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[10px] font-bold">V</span>
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-3 max-w-[88%] font-body text-[14px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-vyva-purple text-white rounded-tr-sm"
                    : "bg-vyva-bg-soft text-vyva-text-1 rounded-tl-sm"
                }`}
              >
                {msg.role === "assistant"
                  ? renderMessageContent(msg.content)
                  : msg.content}
              </div>
            </div>
          ))}

          {messages.length > 0 && loading && (
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-full bg-vyva-purple flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[10px] font-bold">V</span>
              </div>
              <div className="bg-vyva-bg-soft rounded-2xl rounded-tl-sm px-4 py-3">
                <Loader2 size={16} className="animate-spin text-vyva-purple" />
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <p className="font-body text-[12px] text-red-500 bg-red-50 rounded-xl px-3 py-2">
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-vyva-border bg-white flex items-center gap-2 pb-[max(16px,env(safe-area-inset-bottom))]">
          <Input
            data-testid="input-meds-assistant"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("meds.assistantPlaceholder", "Ask a follow-up question…")}
            disabled={loading}
            className="flex-1 rounded-full border-vyva-border font-body text-[14px] h-[44px] px-4 focus-visible:ring-1 focus-visible:ring-vyva-purple"
          />
          <Button
            data-testid="button-meds-assistant-send"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            size="icon"
            className="rounded-full w-11 h-11 flex-shrink-0 bg-vyva-purple hover:bg-vyva-purple/90 disabled:opacity-40"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin text-white" />
            ) : (
              <Send size={16} className="text-white" />
            )}
          </Button>
        </div>
      </div>
    </PurpleModal>
  );
};

export default MedsAssistantSheet;
