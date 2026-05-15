import { ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import StatusBar from "./StatusBar";
import BottomNav from "./BottomNav";
import VoiceCallOverlay from "./VoiceCallOverlay";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";
import {
  actionForVoiceUtterance,
  emitVoiceAppAction,
  VYVA_VOICE_USER_MESSAGE_EVENT,
  type VoiceAppAction,
  type VoiceUserMessageDetail,
} from "@/lib/voiceNavigation";
import { useServiceGate } from "@/hooks/useServiceGate";
import { useToastSurface } from "@/hooks/useToastSurface";

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
  const [activeVoiceAction, setActiveVoiceAction] = useState<VoiceAppAction | null>(null);
  const lastVoiceActionRef = useRef<{ key: string; at: number } | null>(null);
  const { status, isConnecting, isSpeaking, transcript, stopVoice, sendContextUpdate, recordRecommendationFeedback } = useVyvaVoice();
  const isFullScreen = FULL_SCREEN_ROUTES.includes(location.pathname);
  const isWideRoute = WIDE_ROUTES.some((route) => location.pathname.startsWith(route));
  const showVoiceOverlay = status === "connected" || isConnecting;
  const toastSurfaceRef = useToastSurface<HTMLDivElement>(isFullScreen ? 24 : 112);

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
      setActiveVoiceAction(action);
      emitVoiceAppAction(action);
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
    };

    window.addEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, handleVoiceUserMessage);
    return () => window.removeEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, handleVoiceUserMessage);
  }, [guardPath, location.pathname, recordRecommendationFeedback, sendContextUpdate]);

  useEffect(() => {
    if (!activeVoiceAction) return;
    if (location.pathname !== activeVoiceAction.route) return;

    const timer = window.setTimeout(() => {
      void recordRecommendationFeedback("completed", {
        source: "app_voice_action_route_landed",
        voice_action_id: activeVoiceAction.id,
        voice_action_domain: activeVoiceAction.domain,
        voice_action_route: activeVoiceAction.route,
        voice_action_title: activeVoiceAction.title,
        voice_action_reason: activeVoiceAction.feedbackReason,
      }, {
        id: activeVoiceAction.id,
        domain: activeVoiceAction.domain,
        title: activeVoiceAction.title,
        reason: activeVoiceAction.feedbackReason,
      });
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [activeVoiceAction, location.pathname, recordRecommendationFeedback]);

  useEffect(() => {
    if (!activeVoiceAction) return;
    const timer = window.setTimeout(() => setActiveVoiceAction(null), 18000);
    return () => window.clearTimeout(timer);
  }, [activeVoiceAction]);

  return (
    <div className="flex min-h-screen justify-center bg-[radial-gradient(circle_at_top,#fffaf2_0%,#f7f1e9_42%,#f4efe8_100%)]">
      <div ref={toastSurfaceRef} className={`relative w-full ${isWideRoute ? "max-w-[768px]" : "max-w-[520px]"}`}>
        {!isFullScreen && <StatusBar />}
        <main className={`min-h-screen overflow-y-auto ${isFullScreen ? "" : "pt-[76px] pb-[104px]"}`}>
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
