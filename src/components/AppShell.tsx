import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import StatusBar from "./StatusBar";
import BottomNav from "./BottomNav";
import VoiceCallOverlay from "./VoiceCallOverlay";
import VoiceActionCard from "./VoiceActionCard";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";
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

const FULL_SCREEN_ROUTES = ["/chat", "/spatial-navigator", "/face-name-match"];
const WIDE_ROUTES = ["/social-rooms", "/spatial-navigator", "/face-name-match"];

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
  const voiceActionRouteMatches = activeVoiceAction
    ? location.pathname === activeVoiceAction.route || location.pathname.startsWith(`${activeVoiceAction.route}/`)
    : false;
  const showInlineVoiceAction = Boolean(!isFullScreen && activeVoiceAction && voiceActionRouteMatches);
  const showVoiceOverlay = status === "connected" || isConnecting;
  const toastSurfaceRef = useToastSurface<HTMLDivElement>(isFullScreen ? 24 : 112);

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
  }, [startVoice, stopVoice]);

  useEffect(() => {
    if (!activeVoiceAction) return;
    if (!voiceActionRouteMatches) return;

    const timer = window.setTimeout(() => {
      completeActiveAction({
        clear: false,
        metadata: {
          source: "app_voice_action_route_landed",
          current_path: location.pathname,
        },
      });
    }, 1400);

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
      <div ref={toastSurfaceRef} className={`relative w-full ${isWideRoute ? "max-w-[768px]" : "max-w-[520px]"}`}>
        {!isFullScreen && <StatusBar />}
        <main className={`min-h-screen overflow-y-auto ${isFullScreen ? "" : "pt-[76px] pb-[104px]"}`}>
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
        {!isFullScreen && <BottomNav onSosClick={() => {
          if (canUseService("sos", "/sos")) setSosOpen(true);
        }} />}
        {!isFullScreen && <SosSheet open={sosOpen} onOpenChange={setSosOpen} />}
        {showVoiceOverlay && (
          <VoiceCallOverlay
            isSpeaking={isSpeaking}
            isConnecting={isConnecting}
            transcript={transcript}
            onEnd={stopVoice}
            activeAction={activeVoiceAction}
          />
        )}
      </div>
    </div>
  );
};

export default AppShell;
