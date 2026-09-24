import { useState } from "react";
import { Mic, SendHorizonal } from "lucide-react";
import { useSpeechRecognition } from "@/games/memory/useSpeechRecognition";
import { cn } from "@/lib/utils";

export default function DualInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  submitLabel,
  skipLabel,
  onSkip,
  dictateLabel,
  listeningLabel,
  voiceUnavailableLabel,
  language,
  disabled = false,
  compact = false,
}) {
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [editedAfterVoice, setEditedAfterVoice] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");

  const { isSupported, isListening, startListening, stopListening } = useSpeechRecognition({
    language,
    interimResults: true,
    onInterimTranscript: setInterimTranscript,
    onTranscript: (transcript) => {
      const trimmed = transcript.trim();
      if (!trimmed) return;
      onChange(trimmed);
      setVoiceTranscript(trimmed);
      setEditedAfterVoice(false);
      setInterimTranscript("");
    },
  });

  const resetVoiceState = () => {
    setVoiceTranscript("");
    setEditedAfterVoice(false);
    setInterimTranscript("");
  };

  const handleTextChange = (event) => {
    const nextValue = event.target.value;
    onChange(nextValue);
    setEditedAfterVoice(Boolean(voiceTranscript) && nextValue.trim() !== voiceTranscript.trim());
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = String(value ?? "").trim();
    if (!trimmed || disabled) return;

    onSubmit(trimmed, voiceTranscript && !editedAfterVoice ? "voice" : "typed");
    resetVoiceState();
  };

  const handleDictate = () => {
    if (disabled || !isSupported) return;
    if (isListening) {
      stopListening();
      return;
    }
    resetVoiceState();
    startListening();
  };

  return (
    <form className="w-full" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_72px]">
        <label className="min-w-0">
          <span className="sr-only">{placeholder}</span>
          <textarea
            value={value}
            onChange={handleTextChange}
            disabled={disabled}
            placeholder={placeholder}
            rows={2}
            className={cn(
              "w-full resize-y rounded-[22px] border-2 border-[#E7D8F3] bg-white px-5 py-4 font-body font-semibold leading-snug text-[#2B2233] outline-none placeholder:text-[#9B8AA3] focus:border-[#6B21A8] focus:ring-4 focus:ring-purple-100 disabled:bg-[#F5F0EA]",
              compact ? "min-h-[76px] text-[20px]" : "min-h-[96px] text-[22px] sm:min-h-[72px]",
            )}
          />
        </label>

        <button
          type="button"
          onClick={handleDictate}
          disabled={disabled || !isSupported}
          aria-label={isSupported ? dictateLabel : voiceUnavailableLabel}
          title={isSupported ? dictateLabel : voiceUnavailableLabel}
          className={cn(
            "flex items-center justify-center justify-self-center rounded-[22px] text-white shadow-vyva-card transition-transform active:scale-[0.98] disabled:opacity-50 sm:justify-self-auto",
            compact ? "h-16 w-16" : "h-[72px] w-[72px]",
          )}
          style={{ background: isListening ? "#0F766E" : "#F59E0B" }}
        >
          <Mic size={30} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      <div className={cn("mt-2 px-2 text-left font-body font-semibold italic text-[#776A82]", compact ? "min-h-6 text-[16px]" : "min-h-[32px] text-[20px]")}>
        {interimTranscript || (isListening ? listeningLabel : "")}
      </div>

      <button
        type="submit"
        disabled={disabled || !String(value ?? "").trim()}
        className={cn(
          "mt-2 flex w-full items-center justify-center gap-3 rounded-full bg-[#6B21A8] px-6 font-body font-black text-white shadow-vyva-card transition-transform active:scale-[0.99] disabled:opacity-50",
          compact ? "min-h-16 text-[21px]" : "min-h-[72px] text-[24px]",
        )}
      >
        <SendHorizonal size={26} aria-hidden="true" />
        {submitLabel}
      </button>

      {onSkip && skipLabel ? (
        <button
          type="button"
          onClick={() => {
            resetVoiceState();
            onSkip();
          }}
          disabled={disabled}
          className={cn(
            "mt-3 rounded-full px-5 font-body font-extrabold text-[#6B21A8] underline underline-offset-4 disabled:opacity-50",
            compact ? "min-h-12 text-[18px]" : "min-h-[64px] text-[22px]",
          )}
        >
          {skipLabel}
        </button>
      ) : null}
    </form>
  );
}
