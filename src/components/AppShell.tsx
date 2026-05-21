import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, Mic, MicOff, PhoneOff } from "lucide-react";
import StatusBar from "./StatusBar";
import BottomNav from "./BottomNav";
import VoiceActionCard from "./VoiceActionCard";
import VoiceActionSimulator from "./VoiceActionSimulator";
import { type TranscriptEntry, useVyvaVoice } from "@/hooks/useVyvaVoice";
import {
  actionForSpecialistTransfer,
  actionForVoiceUtterance,
  emitVoiceAppAction,
  VYVA_VOICE_APP_ACTION_EVENT,
  VYVA_VOICE_SPECIALIST_TRANSFER_EVENT,
  VYVA_VOICE_USER_MESSAGE_EVENT,
  type VoiceAppAction,
  type VoiceSpecialistTransferRequest,
  type VoiceUserMessageDetail,
} from "@/lib/voiceNavigation";
import { useServiceGate } from "@/hooks/useServiceGate";
import { useToastSurface } from "@/hooks/useToastSurface";
import { useVoiceActionContext } from "@/contexts/VoiceActionContext";
import { recordVoiceTimelineEvent } from "@/lib/voiceTimeline";
import { voiceSessionPhaseLabel, type VoiceSessionPhase } from "@/lib/voiceSessionState";

const FULL_SCREEN_ROUTES = ["/chat", "/spatial-navigator", "/face-name-match"];
const WIDE_ROUTES = ["/social-rooms", "/spatial-navigator", "/face-name-match"];
const RESPONSIVE_APP_ROUTES = ["/settings"];

type VoiceSessionDockProps = {
  isSpeaking: boolean;
  isConnecting: boolean;
  transcript: TranscriptEntry[];
  onEnd: () => void;
  voiceSessionPhase: VoiceSessionPhase;
  isMicMuted: boolean;
  onMicToggle: (muted: boolean) => void;
};

const VoiceSessionDock = ({
  isSpeaking,
  isConnecting,
  transcript,
  onEnd,
  voiceSessionPhase,
  isMicMuted,
  onMicToggle,
}: VoiceSessionDockProps) => {
  const latestEntry = transcript[transcript.length - 1];
  const canToggleMic = voiceSessionPhase !== "connecting" && voiceSessionPhase !== "transferring";
  const label = isConnecting
    ? "Connecting"
    : voiceSessionPhase
      ? voiceSessionPhaseLabel(voiceSessionPhase)
      : isSpeaking
        ? "VYVA speaking"
        : "Listening";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[92px] z-[64] flex justify-center px-4">
      <section
        data-testid="voice-session-dock"
        className="pointer-events-auto flex w-full max-w-[480px] items-center gap-3 rounded-[24px] border border-vyva-border bg-white/95 px-3 py-3 shadow-[0_18px_48px_rgba(47,33,53,0.2)] backdrop-blur"
      >
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isMicMuted ? "bg-emerald-50 text-emerald-700" : "bg-vyva-purple text-white"}`}>
          {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-body text-[13px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
            {label}
          </p>
          <p className="truncate font-body text-[14px] font-semibold text-vyva-text-1">
            {latestEntry?.text || "Voice is active. You can keep using the page."}
          </p>
        </div>
        {canToggleMic && (
          <button
            type="button"
            onClick={() => onMicToggle(!isMicMuted)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vyva-warm text-vyva-text-1 transition active:scale-95"
            aria-label={isMicMuted ? "Turn microphone on" : "Mute microphone"}
            title={isMicMuted ? "Talk" : "Mute"}
          >
            {isMicMuted ? <Mic size={19} /> : <MicOff size={19} />}
          </button>
        )}
        <button
          type="button"
          onClick={onEnd}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FEE2E2] text-[#B91C1C] transition active:scale-95"
          aria-label="End voice chat"
          title="End chat"
        >
          <PhoneOff size={19} />
        </button>
      </section>
    </div>
  );
};

const SosSheet = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" onClick={() => onOpenChange(false)}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-[520px] rounded-t-[28px] bg-white p-6"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: "0 -4px 32px rgba(0,0,0,0.18)" }}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-vyva-warm2" />

        <div
          className="sos-btn mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "#FEE2E2" }}
        >
          <AlertCircle size={28} style={{ color: "#B91C1C" }} />
        </div>

        <h3 className="mb-1 text-center font-display text-[22px] text-vyva-text-1">{t("sos.title")}</h3>
        <p className="mb-6 px-2 text-center font-body text-[14px] text-vyva-text-2">
          {t("sos.description")}
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => onOpenChange(false)}
            className="vyva-secondary-action flex-1"
            data-testid="button-sos-cancel"
          >
            {t("sos.cancel")}
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="vyva-primary-action flex-1"
            style={{ background: "#B91C1C" }}
            data-testid="button-sos-confirm"
          >
            {t("sos.sendNow")}
          </button>
        </div>
      </div>
    </div>
  );
};

const AppShell = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { canUseService, guardPath } = useServiceGate();
  const [sosOpen, setSosOpen] = useState(false);
  const lastVoiceActionRef = useRef<{ key: string; at: number } | null>(null);
  const lastOpenedVoiceActionRef = useRef<{ key: string; at: number } | null>(null);
  const {
    status,
    isConnecting,
    isSpeaking,
    transcript,
    startVoice,
    stopVoice,
    beginVoiceTransfer,
    voiceSessionPhase,
    isMicMuted,
    setMicrophoneMuted,
    sendContextUpdate,
    recordRecommendationFeedback,
  } = useVyvaVoice();
  const {
    activeAction: activeVoiceAction,
    completeActiveAction,
    dismissActiveAction,
  } = useVoiceActionContext();
  const isFullScreen = FULL_SCREEN_ROUTES.includes(location.pathname);
  const isWideRoute = WIDE_ROUTES.some((route) => location.pathname.startsWith(route));
  const isResponsiveAppRoute = RESPONSIVE_APP_ROUTES.some((route) => location.pathname.startsWith(route));
  const shellMaxWidthClassName = isWideRoute || isResponsiveAppRoute ? "max-w-[920px]" : "max-w-[520px]";
  const voiceActionRouteMatches = activeVoiceAction
    ? location.pathname === activeVoiceAction.route || location.pathname.startsWith(`${activeVoiceAction.route}/`)
    : false;
  const showInlineVoiceAction = Boolean(!isFullScreen && activeVoiceAction && voiceActionRouteMatches);
  const showVoiceDock = status === "connected" || isConnecting || voiceSessionPhase === "transferring";
  const toastSurfaceRef = useToastSurface<HTMLDivElement>(isFullScreen ? 24 : 128);

  const openVoiceAppAction = useCallback((action: VoiceAppAction) => {
    const actionKey = `${action.id}:${action.route}`;
    const previous = lastOpenedVoiceActionRef.current;
    const now = Date.now();
    if (previous?.key === actionKey && now - previous.at < 1200) return true;

    lastOpenedVoiceActionRef.current = { key: actionKey, at: now };
    sendContextUpdate(
      `App action opened: ${action.title}. Route: ${action.route}. Context: ${action.cue}`,
    );

    const alreadyOnRoute = location.pathname === action.route;
    const navigated = alreadyOnRoute || guardPath(action.route, {
      state: {
        voiceActionId: action.id,
        voiceActionTitle: action.title,
        voiceActionDomain: action.domain,
      },
    });

    if (navigated) {
      void recordRecommendationFeedback("accepted", {
        source: "app_voice_action",
        voice_action_id: action.id,
        voice_action_domain: action.domain,
        voice_action_route: action.route,
        voice_action_title: action.title,
        voice_action_reason: action.feedbackReason,
        source_text: action.sourceText.slice(0, 180),
        already_on_route: alreadyOnRoute,
      }, {
        id: action.id,
        domain: action.domain,
        title: action.title,
        reason: action.feedbackReason,
      });
    }

    return navigated;
  }, [guardPath, location.pathname, recordRecommendationFeedback, sendContextUpdate]);

  useEffect(() => {
    const handleVoiceUserMessage = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? (event.detail as VoiceUserMessageDetail | undefined)
        : undefined;
      if (!detail?.text) return;

      const action = actionForVoiceUtterance(detail.text);
      if (!action) return;

      const actionKey = `${action.id}:${action.route}`;
      const previous = lastVoiceActionRef.current;
      const now = Date.now();
      if (previous?.key === actionKey && now - previous.at < 3500) return;

      lastVoiceActionRef.current = { key: actionKey, at: now };
      emitVoiceAppAction(action);
    };

    window.addEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, handleVoiceUserMessage);
    return () => window.removeEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, handleVoiceUserMessage);
  }, []);

  useEffect(() => {
    const handleVoiceAppAction = (event: Event) => {
      const action = event instanceof CustomEvent ? (event.detail as VoiceAppAction | undefined) : undefined;
      if (!action?.id || !action.route) return;
      openVoiceAppAction(action);
    };

    window.addEventListener(VYVA_VOICE_APP_ACTION_EVENT, handleVoiceAppAction);
    return () => window.removeEventListener(VYVA_VOICE_APP_ACTION_EVENT, handleVoiceAppAction);
  }, [openVoiceAppAction]);

  useEffect(() => {
    const handleSpecialistTransfer = (event: Event) => {
      const request = event instanceof CustomEvent
        ? (event.detail as VoiceSpecialistTransferRequest | undefined)
        : undefined;
      if (!request?.domain) return;

      const action = actionForSpecialistTransfer(request);
      emitVoiceAppAction(action);

      if (request.autoStart === false || !request.agentSlug) return;

      const transferContext = request.contextHint || request.reason || `Transfer to ${request.domain}`;
      recordVoiceTimelineEvent({
        kind: "transfer_requested",
        title: `Transfer to ${request.domain}`,
        detail: request.reason,
        domain: request.domain,
        ...(request.route ? { route: request.route } : {}),
        ...(request.agentSlug ? { agentSlug: request.agentSlug } : {}),
      });
      beginVoiceTransfer();
      window.setTimeout(() => {
        stopVoice();
        window.setTimeout(() => {
          void startVoice(transferContext, undefined, {
            agentSlug: request.agentSlug,
            autoStartListening: true,
            dynamicVariables: {
              app_entrypoint: "voice_specialist_transfer",
              transfer_domain: request.domain,
              transfer_reason: request.reason,
            },
          });
        }, 650);
      }, 80);
    };

    window.addEventListener(VYVA_VOICE_SPECIALIST_TRANSFER_EVENT, handleSpecialistTransfer);
    return () => window.removeEventListener(VYVA_VOICE_SPECIALIST_TRANSFER_EVENT, handleSpecialistTransfer);
  }, [beginVoiceTransfer, startVoice, stopVoice]);

  useEffect(() => {
    if (!activeVoiceAction) return;
    if (!voiceActionRouteMatches) return;
    if (activeVoiceAction.completion?.mode !== "route_landed") return;

    const timer = window.setTimeout(() => {
      completeActiveAction({
        clear: false,
        metadata: {
          source: "app_voice_action_route_landed",
          current_path: location.pathname,
        },
      });
    }, activeVoiceAction.completion.routeLandedDelayMs ?? 1400);

    return () => window.clearTimeout(timer);
  }, [activeVoiceAction, completeActiveAction, location.pathname, voiceActionRouteMatches]);

  const handleCompleteVoiceAction = useCallback(() => {
    completeActiveAction({
      metadata: {
        source: "voice_action_card_done",
        current_path: location.pathname,
      },
    });
  }, [completeActiveAction, location.pathname]);

  const handleDismissVoiceAction = useCallback(() => {
    dismissActiveAction({
      source: "voice_action_card_hide",
      current_path: location.pathname,
    });
  }, [dismissActiveAction, location.pathname]);

  return (
    <div className="flex min-h-screen justify-center bg-[radial-gradient(circle_at_top,#fffaf2_0%,#f7f1e9_42%,#f4efe8_100%)]">
      <div ref={toastSurfaceRef} className={`relative w-full ${shellMaxWidthClassName}`}>
        {!isFullScreen && <StatusBar wide={isWideRoute || isResponsiveAppRoute} />}
        <main className={`min-h-screen overflow-y-auto ${isFullScreen ? "" : "pt-[76px] pb-[128px]"}`}>
          {showInlineVoiceAction && activeVoiceAction && (
            <div className="px-[22px] pb-3 pt-2">
              <VoiceActionCard
                action={activeVoiceAction}
                onComplete={handleCompleteVoiceAction}
                onDismiss={handleDismissVoiceAction}
              />
            </div>
          )}
          {children}
        </main>
        {!isFullScreen && <BottomNav wide={isWideRoute || isResponsiveAppRoute} onSosClick={() => {
          if (canUseService("sos", "/sos")) setSosOpen(true);
        }} />}
        {!isFullScreen && <SosSheet open={sosOpen} onOpenChange={setSosOpen} />}
        {!isFullScreen && <VoiceActionSimulator />}
        {showVoiceDock && (
          <VoiceSessionDock
            isSpeaking={isSpeaking}
            isConnecting={isConnecting}
            transcript={transcript}
            onEnd={stopVoice}
            voiceSessionPhase={voiceSessionPhase}
            isMicMuted={isMicMuted}
            onMicToggle={setMicrophoneMuted}
          />
        )}
      </div>
    </div>
  );
};

export default AppShell;
