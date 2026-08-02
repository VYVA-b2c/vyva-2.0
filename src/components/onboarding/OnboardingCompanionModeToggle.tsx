import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { Hand, Mic2, Sparkles } from "lucide-react";
import {
  type OnboardingCompanionMode,
  useOnboardingCompanionGuidance,
} from "./useOnboardingCompanionGuidance";

interface OnboardingCompanionModeToggleProps {
  title: string;
  helperText: string;
  compactLabel: string;
  voiceLabel: string;
  voiceDescription: string;
  tactileLabel: string;
  tactileDescription: string;
  accessibleLabel: string;
  initialMode?: OnboardingCompanionMode;
  collapseDelayMs?: number;
  onModeChange?: (mode: OnboardingCompanionMode) => void;
}

const MODE_OPTIONS = [
  {
    id: "voice" as const,
    Icon: Mic2,
  },
  {
    id: "tactile" as const,
    Icon: Hand,
  },
];

export function OnboardingCompanionModeToggle({
  title,
  helperText,
  compactLabel,
  voiceLabel,
  voiceDescription,
  tactileLabel,
  tactileDescription,
  accessibleLabel,
  initialMode = "voice",
  collapseDelayMs = 5200,
  onModeChange,
}: OnboardingCompanionModeToggleProps) {
  const { mode, setMode } = useOnboardingCompanionGuidance({
    mode: initialMode,
  });
  const [featured, setFeatured] = useState(true);
  const voiceButtonRef = useRef<HTMLButtonElement>(null);
  const tactileButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setFeatured(false), collapseDelayMs);
    return () => window.clearTimeout(timer);
  }, [collapseDelayMs]);

  const selectMode = (nextMode: OnboardingCompanionMode) => {
    setMode(nextMode);
    onModeChange?.(nextMode);
  };

  const focusMode = (nextMode: OnboardingCompanionMode) => {
    window.requestAnimationFrame(() => {
      if (nextMode === "voice") {
        voiceButtonRef.current?.focus();
      } else {
        tactileButtonRef.current?.focus();
      }
    });
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    nextMode: OnboardingCompanionMode
  ) => {
    if (
      event.key === "ArrowRight" ||
      event.key === "ArrowDown" ||
      event.key === "ArrowLeft" ||
      event.key === "ArrowUp"
    ) {
      event.preventDefault();
      selectMode(nextMode);
      focusMode(nextMode);
    }
  };

  const activeLabel = mode === "voice" ? voiceLabel : tactileLabel;

  return (
    <section
      data-testid="onboarding-companion-mode-toggle"
      aria-label={accessibleLabel}
      className={`relative mb-5 overflow-hidden rounded-[30px] border border-[#E6D8FF] bg-[linear-gradient(135deg,#FFF9EF_0%,#FFFFFF_50%,#F0E6FF_100%)] shadow-[0_18px_45px_rgba(53,28,87,0.08)] transition-all duration-700 motion-reduce:transition-none ${
        featured ? "p-5 md:p-6" : "p-3 md:p-4"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[30px] border border-vyva-purple/15" />
      <div className="pointer-events-none absolute -left-14 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full border border-vyva-purple/15 bg-vyva-purple/5 blur-[1px] motion-safe:animate-pulse" />
      <div className="relative flex flex-col gap-4 min-[720px]:flex-row min-[720px]:items-center min-[720px]:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[22px] bg-vyva-purple text-white shadow-[0_16px_32px_rgba(107,33,168,0.24)]">
            <span className="absolute inset-[-7px] rounded-[26px] border border-vyva-purple/25 motion-safe:animate-pulse" />
            <Sparkles size={22} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-body text-[12px] font-black uppercase tracking-[0.09em] text-vyva-purple">
              {compactLabel}
            </p>
            <h2
              className={`font-display font-semibold leading-tight text-vyva-text-1 transition-all duration-700 motion-reduce:transition-none ${
                featured ? "mt-1 text-[24px]" : "text-[18px]"
              }`}
            >
              {featured ? title : activeLabel}
            </h2>
            <p className="sr-only">{helperText}</p>
            {!featured && (
              <p
                className="mt-1 text-[13px] font-semibold leading-snug text-vyva-text-2"
                aria-live="polite"
              >
                {mode === "voice" ? voiceDescription : tactileDescription}
              </p>
            )}
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label={accessibleLabel}
          className="grid min-h-[64px] grid-cols-2 rounded-full border border-vyva-purple/20 bg-white/85 p-1.5 shadow-inner min-[720px]:min-w-[340px]"
        >
          {MODE_OPTIONS.map(({ id, Icon }) => {
            const selected = mode === id;
            const label = id === "voice" ? voiceLabel : tactileLabel;
            const description =
              id === "voice" ? voiceDescription : tactileDescription;
            const oppositeMode: OnboardingCompanionMode =
              id === "voice" ? "tactile" : "voice";

            return (
              <button
                key={id}
                ref={id === "voice" ? voiceButtonRef : tactileButtonRef}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${label}. ${description}`}
                tabIndex={selected ? 0 : -1}
                data-testid={`button-companion-mode-${id}`}
                onClick={() => selectMode(id)}
                onKeyDown={(event) => handleKeyDown(event, oppositeMode)}
                className={`flex min-h-[52px] min-w-0 items-center justify-center gap-2 rounded-full px-4 text-[16px] font-black transition-all duration-300 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FACC15] motion-reduce:transition-none ${
                  selected
                    ? "bg-vyva-purple text-white shadow-[0_10px_20px_rgba(107,33,168,0.22)]"
                    : "bg-transparent text-vyva-text-2 hover:bg-[#F8F1FF] hover:text-vyva-purple"
                }`}
              >
                <Icon size={19} aria-hidden="true" />
                <span className="min-w-0 truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
