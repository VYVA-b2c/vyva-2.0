import { Hand, Mic2, Sparkles } from "lucide-react";
import {
  type OnboardingCompanionMode,
  type OnboardingCompanionVoiceStatus,
  useOnboardingCompanionGuidance,
} from "./useOnboardingCompanionGuidance";

interface OnboardingCompanionModeChipProps {
  compactLabel: string;
  voiceLabel: string;
  voiceDescription: string;
  tactileLabel: string;
  tactileDescription: string;
  accessibleLabel: string;
  statusLabels?: Partial<Record<OnboardingCompanionVoiceStatus, string>>;
}

const DEFAULT_STATUS_LABELS: Record<OnboardingCompanionVoiceStatus, string> = {
  idle: "Ready",
  listening: "Listening",
  speaking: "Speaking",
  thinking: "Thinking",
  error: "Needs attention",
};

export function OnboardingCompanionModeChip({
  compactLabel,
  voiceLabel,
  voiceDescription,
  tactileLabel,
  tactileDescription,
  accessibleLabel,
  statusLabels,
}: OnboardingCompanionModeChipProps) {
  const {
    mode,
    voiceStatus,
    currentPrompt,
    lastHeardText,
    error,
    setMode,
  } = useOnboardingCompanionGuidance();

  const options: Array<{
    id: OnboardingCompanionMode;
    label: string;
    description: string;
    Icon: typeof Mic2;
  }> = [
    {
      id: "voice",
      label: voiceLabel,
      description: voiceDescription,
      Icon: Mic2,
    },
    {
      id: "tactile",
      label: tactileLabel,
      description: tactileDescription,
      Icon: Hand,
    },
  ];
  const resolvedStatusLabels = { ...DEFAULT_STATUS_LABELS, ...statusLabels };
  const voiceActive = mode === "voice" && voiceStatus !== "idle";
  const statusLabel = resolvedStatusLabels[voiceStatus];
  const description = voiceActive
    ? error ?? lastHeardText ?? currentPrompt ?? statusLabel
    : mode === "voice"
      ? voiceDescription
      : tactileDescription;

  return (
    <div
      data-testid="onboarding-companion-mode-chip"
      data-voice-status={voiceStatus}
      className={`mt-4 flex flex-col gap-2 rounded-[22px] border bg-white/82 p-2.5 shadow-[0_12px_26px_rgba(91,33,182,0.08)] backdrop-blur transition-colors motion-reduce:transition-none sm:flex-row sm:items-center sm:justify-between ${
        voiceActive
          ? "border-vyva-purple/35 ring-2 ring-vyva-purple/10"
          : "border-[#E7DCF8]"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5 px-1">
        <span
          className={`relative inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-vyva-purple text-white shadow-[0_8px_18px_rgba(107,33,168,0.22)] ${
            voiceActive ? "motion-safe:animate-pulse" : ""
          }`}
        >
          <span
            className={`absolute inset-[-4px] rounded-[18px] border ${
              voiceActive ? "border-vyva-purple/45" : "border-vyva-purple/20"
            }`}
          />
          <Sparkles size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black uppercase tracking-[0.08em] text-vyva-purple">
            {voiceActive ? statusLabel : compactLabel}
          </p>
          <p
            className="max-w-[360px] truncate text-[12px] font-bold text-vyva-text-2"
            aria-live={voiceActive ? "polite" : undefined}
          >
            {description}
          </p>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label={accessibleLabel}
        className="grid min-h-[46px] grid-cols-2 rounded-full border border-vyva-purple/15 bg-[#FFFCF8] p-1"
      >
        {options.map(({ id, label, description, Icon }) => {
          const selected = mode === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${label}. ${description}`}
              data-testid={`button-section-companion-mode-${id}`}
              onClick={() => setMode(id)}
              className={`flex min-h-[38px] min-w-0 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-black transition-all focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FACC15] motion-reduce:transition-none ${
                selected
                  ? "bg-vyva-purple text-white shadow-[0_8px_16px_rgba(107,33,168,0.20)]"
                  : "text-vyva-text-2 hover:bg-[#F8F1FF] hover:text-vyva-purple"
              }`}
            >
              <Icon size={15} aria-hidden="true" />
              <span className="min-w-0 truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
