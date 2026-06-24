import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Mic, MicOff, PhoneCall, PhoneOff, UserRound } from "lucide-react";
import StatusBar from "./StatusBar";
import BottomNav from "./BottomNav";
import VoiceActionCard from "./VoiceActionCard";
import VoiceActionSimulator from "./VoiceActionSimulator";
import MotivationMilestoneProvider from "./MotivationMilestoneProvider";
import { useProfile } from "@/contexts/ProfileContext";
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
import { emergencyContactForCountry, sanitizePhoneHref } from "@/lib/emergencyContacts";
import { apiFetch } from "@/lib/queryClient";
import { recordVoiceTimelineEvent } from "@/lib/voiceTimeline";
import { voiceSessionPhaseLabel, type VoiceSessionPhase } from "@/lib/voiceSessionState";

type AppShellLayout = "compact" | "wide" | "vitals" | "fullscreen";

const FULLSCREEN_ROUTE_PREFIXES = ["/memory-games/", "/social-rooms/morning-movement/exercises/", "/activities/relax-breathe"];
const FULLSCREEN_ROUTES = [
  "/chat",
  "/spatial-navigator",
  "/face-name-match",
  "/attention-boosters/rhythm-tap",
];

const WIDE_ROUTE_PREFIXES = [
  "/settings",
  "/health",
  "/informes",
  "/social-rooms",
  "/meds",
  "/attention-boosters",
  "/executive-function",
  "/memory-games",
  "/concierge",
];

const WIDE_ROUTES = [
  "/",
  "/companions",
  "/activities",
  "/activity",
  "/learn",
  "/language",
  "/safe-home",
  "/scam-guard",
  "/history",
];

export function getAppShellLayout(pathname: string): AppShellLayout {
  if (pathname === "/health/vitals") {
    return "vitals";
  }

  if (
    FULLSCREEN_ROUTES.includes(pathname) ||
    FULLSCREEN_ROUTE_PREFIXES.some((route) => pathname.startsWith(route))
  ) {
    return "fullscreen";
  }

  if (
    WIDE_ROUTES.includes(pathname) ||
    WIDE_ROUTE_PREFIXES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  ) {
    return "wide";
  }

  return "compact";
}

type EmergencyProfileContact = {
  name?: string | null;
  relationship?: string | null;
  primaryPhone?: string | null;
  secondaryPhone?: string | null;
};

type OnboardingStateResponse = {
  profile?: {
    emergency_contact?: {
      name?: string | null;
      relationship?: string | null;
      primary_phone?: string | null;
      secondary_phone?: string | null;
    } | null;
  } | null;
} | null;

export function emergencyProfileContactFromState(data?: OnboardingStateResponse): EmergencyProfileContact | null {
  const contact = data?.profile?.emergency_contact;
  if (!contact) return null;
  const primaryPhone = contact.primary_phone?.trim() ?? "";
  const secondaryPhone = contact.secondary_phone?.trim() ?? "";
  if (!primaryPhone && !secondaryPhone) return null;
  return {
    name: contact.name?.trim() || null,
    relationship: contact.relationship?.trim() || null,
    primaryPhone,
    secondaryPhone,
  };
}

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

export const SosSheet = ({
  open,
  onOpenChange,
  country,
  profileContact,
  contactLoading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  country?: string | null;
  profileContact?: EmergencyProfileContact | null;
  contactLoading?: boolean;
}) => {
  const { t } = useTranslation();
  const localEmergency = emergencyContactForCountry(country);
  const contactPhone = profileContact?.primaryPhone || profileContact?.secondaryPhone || "";
  const contactHref = sanitizePhoneHref(contactPhone);
  const contactName = profileContact?.name || t("sos.emergencyContact", "emergency contact");

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

        <h3 className="mb-1 text-center font-display text-[22px] text-vyva-text-1">{t("sos.title", "Need urgent help?")}</h3>
        <p className="mb-5 px-2 text-center font-body text-[15px] font-semibold leading-relaxed text-vyva-text-2">
          {t("sos.description", "Call emergency services now, or call the emergency contact saved in your profile.")}
        </p>

        <div className="grid gap-3">
          <a
            href={localEmergency.telHref}
            onClick={() => onOpenChange(false)}
            className="vyva-primary-action flex min-h-[58px] items-center justify-center gap-2 rounded-full text-[18px] font-black"
            style={{ background: "#B91C1C" }}
            data-testid="button-sos-confirm"
            aria-label={t("sos.callEmergencyAria", "Call emergency services now")}
          >
            <PhoneCall size={20} />
            <span>
              {localEmergency.telHref
                ? t("sos.callEmergencyNumber", "Call {{number}} now", { number: localEmergency.label })
                : t("sos.callEmergency", "Call emergency now")}
            </span>
          </a>
          {contactHref ? (
            <a
              href={contactHref}
              onClick={() => onOpenChange(false)}
              className="vyva-secondary-action flex min-h-[54px] items-center justify-center gap-2 rounded-full text-[16px] font-black"
              data-testid="button-sos-call-contact"
              aria-label={t("sos.callContactAria", "Call {{name}}", { name: contactName })}
            >
              <UserRound size={19} />
              <span>{t("sos.callContact", "Call {{name}}", { name: contactName })}</span>
            </a>
          ) : contactLoading ? (
            <div className="min-h-[54px] rounded-full border border-vyva-border bg-[#FFFCF8] px-4 py-4 text-center font-body text-[14px] font-bold text-vyva-text-2">
              {t("sos.loadingContact", "Checking emergency contact...")}
            </div>
          ) : null}
          <button
            onClick={() => onOpenChange(false)}
            className="vyva-secondary-action min-h-[50px]"
            data-testid="button-sos-cancel"
          >
            {t("sos.cancel", "Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
};

const AppShell = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const { profile } = useProfile();
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
  const appShellLayout = getAppShellLayout(location.pathname);
  const isFullScreen = appShellLayout === "fullscreen";
  const isVitalsRoute = appShellLayout === "vitals";
  const isWideRoute = appShellLayout === "wide";
  const isChatTypeMode =
    location.pathname === "/chat" && new URLSearchParams(location.search).get("mode") !== "voice";
  const shellMaxWidthClassName = isFullScreen
    ? "max-w-none"
    : isVitalsRoute
      ? "max-w-[1180px]"
      : isWideRoute
        ? "max-w-[920px]"
        : "max-w-[520px]";
  const voiceActionRouteMatches = activeVoiceAction
    ? location.pathname === activeVoiceAction.route || location.pathname.startsWith(`${activeVoiceAction.route}/`)
    : false;
  const showInlineVoiceAction = Boolean(!isFullScreen && activeVoiceAction && voiceActionRouteMatches);
  const showVoiceDock =
    !isChatTypeMode && (status === "connected" || isConnecting || voiceSessionPhase === "transferring");
  const suppressMilestonePopup = isFullScreen ||
    sosOpen ||
    showVoiceDock ||
    location.pathname === "/sos" ||
    location.pathname.startsWith("/health/symptom") ||
    location.pathname.startsWith("/triage");
  const toastSurfaceRef = useToastSurface<HTMLDivElement>(isFullScreen ? 24 : 128);
  const { data: onboardingState, isLoading: sosContactLoading } = useQuery<OnboardingStateResponse>({
    queryKey: ["/api/onboarding/state"],
    queryFn: async () => {
      const response = await apiFetch("/api/onboarding/state");
      if (!response.ok) throw new Error(`onboarding-state ${response.status}`);
      return response.json();
    },
    enabled: sosOpen,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
  const sosProfileContact = emergencyProfileContactFromState(onboardingState);

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
    <MotivationMilestoneProvider disabled={suppressMilestonePopup}>
      <div className="flex min-h-screen justify-center bg-[radial-gradient(circle_at_top,#fffaf2_0%,#f7f1e9_42%,#f4efe8_100%)]">
      <div
        ref={toastSurfaceRef}
        data-testid="app-shell"
        data-layout={appShellLayout}
        className={`relative w-full ${shellMaxWidthClassName}`}
      >
        {!isFullScreen && <StatusBar wide={isWideRoute || isVitalsRoute} />}
        <main className={`min-h-screen overflow-y-auto ${isFullScreen ? "" : isVitalsRoute ? "pt-[76px] pb-[128px] lg:pb-10" : "pt-[76px] pb-[128px]"}`}>
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
        {!isFullScreen && (
          <div className={isVitalsRoute ? "lg:hidden" : ""}>
            <BottomNav wide={isWideRoute || isVitalsRoute} onSosClick={() => {
              if (canUseService("sos", "/sos")) setSosOpen(true);
            }} />
          </div>
        )}
        {!isFullScreen && (
          <SosSheet
            open={sosOpen}
            onOpenChange={setSosOpen}
            country={profile?.country}
            profileContact={sosProfileContact}
            contactLoading={sosContactLoading}
          />
        )}
        {!isFullScreen && !isVitalsRoute && <VoiceActionSimulator />}
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
    </MotivationMilestoneProvider>
  );
};

export default AppShell;
