import type { ReactNode } from "react";
import { ArrowLeft, Hand, Mic, type LucideIcon } from "lucide-react";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { useReadableTextSize } from "@/hooks/useReadableTextSize";
import { useOptionalVyvaVoice } from "@/hooks/useVyvaVoice";

export type CanonicalDetailFlowShellContract = Readonly<{
  shellId: "home.production";
  headerId: "detail.voice-touch";
  headerTitle: string;
  containerId: "flow.rounded-card";
  bottomNavId: "home-sos-reports";
  composer: "hidden" | "visible";
}>;

type CanonicalFlowIconTone = "gold" | "purple" | "amber" | "green" | "red" | "blue";
type CanonicalFlowIconAccent =
  | "pill"
  | "document"
  | "cart"
  | "link"
  | "plus"
  | "mic"
  | "pencil"
  | "chat"
  | "status"
  | "check"
  | "target"
  | "spark";

const flowIconTone: Record<CanonicalFlowIconTone, string> = {
  gold: "bg-[#FFF4CF] text-[#A16207]",
  purple: "bg-[#F5F3FF] text-[#7024C4]",
  amber: "bg-[#FEF3C7] text-[#B45309]",
  green: "bg-[#ECFDF5] text-[#0F766E]",
  red: "bg-[#FEE2E2] text-[#B91C1C]",
  blue: "bg-[#EFF6FF] text-[#2563EB]",
};

export function CanonicalFlowIcon({
  icon: Icon,
  tone = "purple",
  size = "standard",
  goldAccent,
  className = "",
}: {
  icon: LucideIcon;
  tone?: CanonicalFlowIconTone;
  size?: "standard" | "compact";
  goldAccent?: CanonicalFlowIconAccent;
  className?: string;
}) {
  const compact = size === "compact";
  const accentStrokeWidth = compact ? 2.7 : 2.9;
  return (
    <span
      aria-hidden="true"
      className={`relative flex flex-shrink-0 items-center justify-center rounded-[12px] ${compact ? "h-9 w-9" : "h-10 w-10"} ${flowIconTone[tone]} ${className}`}
    >
      <Icon size={compact ? 18 : 21} strokeWidth={compact ? 2.5 : 2.6} aria-hidden="true" />
      {goldAccent ? (
        <svg
          viewBox="0 0 24 24"
          className={`pointer-events-none absolute ${compact ? "h-[18px] w-[18px]" : "h-[21px] w-[21px]"} text-[#E0A51B]`}
          fill="none"
          stroke="currentColor"
          strokeWidth={accentStrokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {goldAccent === "pill" ? <path d="m8.5 8.5 7 7" /> : null}
          {goldAccent === "document" ? <path d="M9 13h6" /> : null}
          {goldAccent === "cart" ? <path d="M7.2 10h9.7" /> : null}
          {goldAccent === "link" ? <path d="m9.5 14.5 5-5" /> : null}
          {goldAccent === "plus" ? <path d="M12 7.5v9" /> : null}
          {goldAccent === "mic" ? <path d="M9.5 16.5c1.5 1 3.5 1 5 0" /> : null}
          {goldAccent === "pencil" ? <path d="m14.5 5.5 4 4" /> : null}
          {goldAccent === "chat" ? <path d="m8.5 16.5-1 2.5 3-1" /> : null}
          {goldAccent === "status" ? <><path d="M12 7.5v5" /><path d="M12 16.5h.01" /></> : null}
          {goldAccent === "check" ? <path d="m8.5 12 2.5 2.5 4.5-5" /> : null}
          {goldAccent === "target" ? <circle cx="12" cy="12" r="2" /> : null}
          {goldAccent === "spark" ? <><path d="M12 8v8" /><path d="M8 12h8" /></> : null}
        </svg>
      ) : null}
    </span>
  );
}

type CanonicalVoiceButtonProps = {
  contextHint: string;
  agentSlug?: string;
  dynamicVariables?: Record<string, string | number | boolean>;
  label?: string;
  testId?: string;
};

export function CanonicalVoiceButton({
  contextHint,
  agentSlug,
  dynamicVariables,
  label = "Talk to VYVA",
  testId = "button-canonical-voice",
}: CanonicalVoiceButtonProps) {
  const voice = useOptionalVyvaVoice();
  const active = voice?.status === "connected" || voice?.isConnecting;

  return (
    <button
      type="button"
      aria-label={active ? "Return to touch mode" : label}
      data-testid={testId}
      onClick={() => {
        if (!voice) return;
        if (active) {
          voice.stopVoice();
          return;
        }
        void Promise.resolve(voice.startVoice(contextHint, undefined, {
          ...(agentSlug ? { agentSlug } : {}),
          ...(dynamicVariables ? { dynamicVariables } : {}),
          autoStartListening: true,
        })).catch(() => undefined);
      }}
      className="vyva-tap grid h-10 !min-h-10 w-10 shrink-0 place-items-center rounded-full bg-vyva-purple text-white ring-2 ring-white/80 shadow-[0_14px_30px_rgba(124,58,237,0.22)] transition-colors duration-150"
    >
      {active ? <Hand size={18} strokeWidth={2.35} aria-hidden="true" /> : <Mic size={18} strokeWidth={2.35} aria-hidden="true" />}
    </button>
  );
}

type CanonicalDetailFlowShellProps = {
  children: ReactNode;
  shellContract: CanonicalDetailFlowShellContract;
  onBack: () => void;
  interactionMode?: "voice" | "touch";
  onInteractionModeChange?: (mode: "voice" | "touch") => void;
  inlineVoiceControl?: boolean;
  headerAction?: ReactNode;
  shellTestId?: string;
  contentTestId?: string;
  backTestId?: string;
};

const shellSurface = {
  light: "bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_72%)] text-[#241C30]",
  dark: "bg-[radial-gradient(circle_at_50%_0%,#2C1E58_0%,#160F24_52%,#080611_100%)] text-[#F7F0FF]",
};

const quietControl = {
  light: "bg-white text-[#6B5173] ring-1 ring-black/[0.05] shadow-[0_14px_32px_rgba(80,52,109,0.12)]",
  dark: "bg-white/[0.07] text-[#F7F0FF] ring-1 ring-inset ring-white/[0.18]",
};

export function CanonicalDetailFlowShell({
  children,
  shellContract,
  onBack,
  interactionMode = "touch",
  onInteractionModeChange,
  inlineVoiceControl = false,
  headerAction,
  shellTestId = "canonical-detail-flow-screen",
  contentTestId = "canonical-detail-flow-content",
  backTestId = "button-prototype-back",
}: CanonicalDetailFlowShellProps) {
  const { isDark } = useHomeMasterTheme();
  const { size: readableTextSize } = useReadableTextSize();

  return (
    <main
      data-testid={shellTestId}
      data-home-master-theme={isDark ? "dark" : "light"}
      data-vyva-text-size={readableTextSize}
      data-shell-contract={shellContract.shellId}
      data-header-contract={shellContract.headerId}
      data-container-contract={shellContract.containerId}
      data-bottom-nav-contract={shellContract.bottomNavId}
      data-composer-contract={shellContract.composer}
      className={`prototype-shell relative min-h-[calc(100svh-136px)] w-full overflow-x-clip ${isDark ? shellSurface.dark : shellSurface.light}`}
    >
      <div
        className="vyva-home-master-fixed-type mx-auto flex min-h-[calc(100svh-136px)] w-full max-w-[430px] flex-col px-6 pb-[calc(11rem+env(safe-area-inset-bottom))] pt-8 sm:max-w-[680px] sm:px-7 lg:max-w-[900px] [@media(max-height:800px)]:pt-4"
        data-testid={`${shellTestId}-frame`}
      >
        <div
          className={`sticky top-0 z-40 -mx-3 px-3 backdrop-blur-xl ${isDark ? "bg-[#1A1122]" : "bg-[#F8EEFF]/95"}`}
        >
          <header className="grid grid-cols-[40px_1fr_40px] items-center gap-3" data-testid="prototype-home-master-topbar">
            <button
              type="button"
              aria-label="Back"
              data-testid={backTestId}
              onClick={onBack}
              className={`vyva-tap grid h-10 !min-h-10 w-10 shrink-0 place-items-center rounded-full transition-colors duration-150 ${isDark ? quietControl.dark : quietControl.light}`}
            >
              <ArrowLeft size={18} strokeWidth={2.35} aria-hidden="true" />
              <span className="sr-only">Back</span>
            </button>
            <div className="min-w-0 text-center">
              <h1 className="truncate font-display text-[24px] font-semibold leading-tight tracking-[-0.03em] text-inherit">
                {shellContract.headerTitle}
              </h1>
            </div>
            {onInteractionModeChange && !inlineVoiceControl ? (
              <button
                type="button"
                aria-label={interactionMode === "voice" ? "Switch to touch mode" : "Switch to voice mode"}
                data-testid={interactionMode === "voice" ? "button-symptom-mode-touch" : "button-symptom-mode-voice"}
                onClick={() => onInteractionModeChange(interactionMode === "voice" ? "touch" : "voice")}
                className="vyva-tap grid h-10 !min-h-10 w-10 shrink-0 place-items-center rounded-full bg-vyva-purple text-white ring-2 ring-white/80 shadow-[0_14px_30px_rgba(124,58,237,0.22)] transition-colors duration-150"
              >
                {interactionMode === "voice" ? <Hand size={18} strokeWidth={2.35} aria-hidden="true" /> : <Mic size={18} strokeWidth={2.35} aria-hidden="true" />}
              </button>
            ) : headerAction ? (
              <div className="flex h-10 w-10 items-center justify-end">{headerAction}</div>
            ) : (
              <div aria-hidden="true" />
            )}
          </header>
        </div>
        <div className="mt-5 flex min-h-0 flex-1 flex-col sm:mt-7 [@media(max-height:800px)]:mt-3" data-testid={contentTestId}>
          {children}
        </div>
      </div>
    </main>
  );
}
