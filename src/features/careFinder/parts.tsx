import { forwardRef, useCallback, useEffect, useState, type ReactNode } from "react";
import { Check, Mic, Square, Volume2 } from "lucide-react";
import { useSpeechRecognition } from "@/games/memory/useSpeechRecognition";
import type { CareFinderLang } from "../../../shared/careFinder/careRoutes";
import type { CareFinderCopy } from "./copy";

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

export const StepHeading = forwardRef<HTMLHeadingElement, { children: ReactNode; help?: ReactNode; id?: string }>(
  function StepHeading({ children, help, id }, ref) {
    return (
      <div className="mb-5">
        <h2
          ref={ref}
          id={id}
          tabIndex={-1}
          data-step-heading
          className="font-display font-semibold leading-tight tracking-[-0.01em] text-[var(--cf-text)] cf-h2"
        >
          {children}
        </h2>
        {help ? <p className="mt-2 text-[19px] leading-relaxed text-[var(--cf-text-2)]">{help}</p> : null}
      </div>
    );
  },
);

type ChoiceProps = {
  label: string;
  detail?: string;
  icon?: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  testId?: string;
  tone?: "default" | "urgent";
};

/** A large, whole-card tap target. Selection is shown by tick + border, never colour alone. */
export function ChoiceButton({ label, detail, icon, onClick, pressed, testId, tone = "default" }: ChoiceProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      data-testid={testId}
      className={cx(
        "cf-choice flex min-h-[72px] w-full items-center gap-4 rounded-[20px] border-2 bg-[var(--cf-surface)] px-5 py-4 text-left transition-colors",
        tone === "urgent" ? "border-[var(--cf-urgent)]" : "border-[var(--cf-border-soft)] hover:border-[var(--cf-border)]",
      )}
    >
      {icon ? <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--cf-surface-2)] text-[var(--cf-accent)]">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[21px] font-semibold leading-snug text-[var(--cf-text)]">{label}</span>
        {detail ? <span className="mt-0.5 block text-[17px] leading-snug text-[var(--cf-text-2)]">{detail}</span> : null}
      </span>
      {pressed !== undefined ? (
        <span
          aria-hidden="true"
          className={cx(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
            pressed ? "border-[var(--cf-selected)] bg-[var(--cf-selected)] text-[var(--cf-on-accent)]" : "border-[var(--cf-border)]",
          )}
        >
          {pressed ? <Check size={20} strokeWidth={3} /> : null}
        </span>
      ) : null}
    </button>
  );
}

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "quiet" | "urgent";
  type?: "button" | "submit";
  disabled?: boolean;
  testId?: string;
  icon?: ReactNode;
  className?: string;
};

export function ActionButton({ children, onClick, variant = "primary", type = "button", disabled, testId, icon, className }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={actionClass(variant, className)}
    >
      {icon ? <span aria-hidden="true" className="shrink-0">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}

export function actionClass(variant: ButtonProps["variant"] = "primary", className?: string) {
  return cx(
    "inline-flex min-h-[60px] items-center justify-center gap-3 rounded-full px-6 py-3 text-center text-[20px] font-semibold leading-snug transition-opacity disabled:cursor-not-allowed disabled:opacity-50 cf-btn",
    variant === "primary" && "bg-[var(--cf-accent)] text-[var(--cf-on-accent)]",
    variant === "urgent" && "bg-[var(--cf-urgent)] text-[var(--cf-on-urgent)]",
    variant === "secondary" && "border-2 border-[var(--cf-border)] bg-[var(--cf-surface)] text-[var(--cf-text)]",
    variant === "quiet" && "text-[var(--cf-accent)] underline underline-offset-4",
    className,
  );
}

export function Notice({ children, tone = "info", role }: { children: ReactNode; tone?: "info" | "warn" | "urgent" | "ok"; role?: "status" | "alert" }) {
  return (
    <div
      role={role}
      className={cx(
        "rounded-[18px] border-l-[6px] px-5 py-4 text-[18px] leading-relaxed",
        tone === "info" && "border-[var(--cf-info)] bg-[var(--cf-info-soft)]",
        tone === "warn" && "border-[var(--cf-warn)] bg-[var(--cf-warn-soft)]",
        tone === "urgent" && "border-[var(--cf-urgent)] bg-[var(--cf-urgent-soft)]",
        tone === "ok" && "border-[var(--cf-ok)] bg-[var(--cf-ok-soft)]",
      )}
    >
      {children}
    </div>
  );
}

/** Text box with optional dictation, reusing the app's existing speech hook. */
export function VoiceTextInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  onSubmit,
  submitLabel,
  lang,
  copy,
  multiline = true,
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  submitLabel: string;
  lang: CareFinderLang;
  copy: CareFinderCopy;
  multiline?: boolean;
}) {
  const [interim, setInterim] = useState("");
  const { isSupported, isListening, startListening, stopListening } = useSpeechRecognition({
    language: lang,
    interimResults: true,
    onInterimTranscript: setInterim,
    onTranscript: (transcript) => {
      const trimmed = transcript.trim();
      if (trimmed) onChange(value.trim() ? `${value.trim()} ${trimmed}` : trimmed);
      setInterim("");
    },
  });

  const inputClass = "w-full rounded-[18px] border-2 border-[var(--cf-border)] bg-[var(--cf-surface)] px-5 py-4 text-[21px] leading-snug text-[var(--cf-text)] placeholder:text-[var(--cf-text-2)]";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
      className="space-y-3"
    >
      <label htmlFor={id} className="block text-[19px] font-semibold text-[var(--cf-text)]">{label}</label>
      {multiline ? (
        <textarea id={id} value={value} rows={3} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={inputClass} />
      ) : (
        <input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={inputClass} autoComplete="postal-code" />
      )}
      <p aria-live="polite" className="min-h-[1.5em] text-[18px] italic text-[var(--cf-text-2)]">
        {interim || (isListening ? copy.voice.listening : "")}
      </p>
      <div className="cf-row flex flex-col gap-3">
        <ActionButton type="submit" disabled={!value.trim()}>{submitLabel}</ActionButton>
        {isSupported ? (
          <ActionButton
            variant="secondary"
            onClick={() => (isListening ? stopListening() : startListening())}
            icon={isListening ? <Square size={22} /> : <Mic size={24} />}
          >
            {isListening ? copy.voice.stop : copy.voice.speak}
          </ActionButton>
        ) : null}
      </div>
    </form>
  );
}

/** Reads the current question aloud with the browser's speech synthesis. */
export function ReadAloudButton({ getText, lang, copy, resetKey }: { getText: () => string; lang: CareFinderLang; copy: CareFinderCopy; resetKey: string }) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  useEffect(() => stop, [resetKey, stop]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (speaking) return stop();
        const utterance = new SpeechSynthesisUtterance(getText());
        utterance.lang = lang === "es" ? "es-ES" : "en-GB";
        utterance.rate = 0.9;
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
        setSpeaking(true);
      }}
      className="inline-flex min-h-[52px] items-center gap-2 rounded-full border-2 border-[var(--cf-border-soft)] bg-[var(--cf-surface)] px-4 text-[18px] font-semibold text-[var(--cf-text)]"
    >
      <Volume2 size={22} aria-hidden="true" />
      {speaking ? copy.stopReading : copy.readAloud}
    </button>
  );
}
