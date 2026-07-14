import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calendar, Car, ChevronRight, HeartPulse, Mail, Mic, PhoneCall, Stethoscope, UserPlus, X, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useProfile } from "@/contexts/ProfileContext";
import { useDoctorVoice } from "@/hooks/useDoctorVoice";
import { useHeroMessage } from "@/hooks/useHeroMessage";
import { useServiceGate } from "@/hooks/useServiceGate";
import { useLanguage } from "@/i18n";
import { sanitizePhoneHref } from "@/lib/emergencyContacts";

type DoctorLocationState = {
  autoStartVoice?: boolean;
  latestSymptomReport?: string;
};

export type DoctorChoiceQuickActionKind = "call_gp" | "email_gp" | "book_appointment" | "book_ride" | "add_gp_contact";

type DoctorChoiceQuickActionLabels = Record<DoctorChoiceQuickActionKind | `${DoctorChoiceQuickActionKind}Sub`, string>;

export type DoctorChoiceQuickAction = {
  kind: DoctorChoiceQuickActionKind;
  label: string;
  sub: string;
  href?: string;
  to?: string;
  state?: Record<string, unknown>;
};

function buildDoctorChoiceContext(latestSymptomReport?: string) {
  return latestSymptomReport?.trim() || "Doctor support requested from VYVA.";
}

function buildDoctorChoiceConciergeMessage(kind: "appointment" | "ride", latestSymptomReport?: string) {
  const context = buildDoctorChoiceContext(latestSymptomReport);
  const request = kind === "appointment"
    ? "Please help me schedule a GP or doctor appointment."
    : "Please help me book transport for a medical appointment.";
  return `${request}\n\nContext:\n${context}`;
}

export function doctorChoiceQuickActionsFor({
  gpName,
  gpPhone,
  gpEmail,
  latestSymptomReport,
  labels,
}: {
  gpName?: string | null;
  gpPhone?: string | null;
  gpEmail?: string | null;
  latestSymptomReport?: string;
  labels: DoctorChoiceQuickActionLabels;
}): DoctorChoiceQuickAction[] {
  const actions: DoctorChoiceQuickAction[] = [];
  const phoneHref = sanitizePhoneHref(gpPhone);
  const email = gpEmail?.trim() ?? "";
  const doctorContext = buildDoctorChoiceContext(latestSymptomReport);
  const displayName = gpName?.trim();

  if (phoneHref) {
    actions.push({
      kind: "call_gp",
      label: displayName ? labels.call_gp.replace("{{name}}", displayName) : labels.call_gp.replace("{{name}}", "GP"),
      sub: labels.call_gpSub,
      href: phoneHref,
    });
  }

  if (email) {
    actions.push({
      kind: "email_gp",
      label: labels.email_gp,
      sub: labels.email_gpSub,
      href: `mailto:${email}?subject=${encodeURIComponent("VYVA doctor support")}&body=${encodeURIComponent(doctorContext)}`,
    });
  }

  if (!phoneHref && !email) {
    actions.push({
      kind: "add_gp_contact",
      label: labels.add_gp_contact,
      sub: labels.add_gp_contactSub,
      to: `/onboarding/profile/gp?returnTo=${encodeURIComponent("/health/doctor")}`,
    });
  }

  actions.push({
    kind: "book_appointment",
    label: labels.book_appointment,
    sub: labels.book_appointmentSub,
    to: "/concierge",
    state: {
      conciergePrefill: {
        kind: "appointment",
        message: buildDoctorChoiceConciergeMessage("appointment", latestSymptomReport),
        source: "doctor_choice",
      },
    },
  });

  actions.push({
    kind: "book_ride",
    label: labels.book_ride,
    sub: labels.book_rideSub,
    to: "/concierge",
    state: {
      conciergePrefill: {
        kind: "ride",
        message: buildDoctorChoiceConciergeMessage("ride", latestSymptomReport),
        source: "doctor_choice",
      },
    },
  });

  return actions;
}

const quickActionIcons: Record<DoctorChoiceQuickActionKind, LucideIcon> = {
  call_gp: PhoneCall,
  email_gp: Mail,
  book_appointment: Calendar,
  book_ride: Car,
  add_gp_contact: UserPlus,
};

const DoctorChoiceScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { profile } = useProfile();
  const { readiness } = useServiceGate();
  const {
    status,
    isSpeaking,
    isUserSpeaking,
    isConnecting,
    lastError,
    isVoiceLive,
    startDoctorVoice,
    stopDoctorVoice,
    startAttempted,
    userStopped,
  } = useDoctorVoice();
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const locationState = (location.state as DoctorLocationState | null) ?? null;
  const autoStartRequested = Boolean(locationState?.autoStartVoice);
  const latestSymptomReport = locationState?.latestSymptomReport?.trim() ?? "";
  const doctorRecommendations = readiness?.services.doctor.recommended ?? [];
  const quickActions = useMemo(() => doctorChoiceQuickActionsFor({
    gpName: profile?.gpName,
    gpPhone: profile?.gpPhone,
    gpEmail: profile?.gpEmail,
    latestSymptomReport,
    labels: {
      call_gp: t("health.doctorChoice.quickActions.callGp", "Call {{name}}"),
      call_gpSub: t("health.doctorChoice.quickActions.callGpSub", "Speak to the practice now."),
      email_gp: t("health.doctorChoice.quickActions.emailGp", "Email GP"),
      email_gpSub: t("health.doctorChoice.quickActions.emailGpSub", "Send the health context."),
      book_appointment: t("health.doctorChoice.quickActions.bookAppointment", "Book appointment"),
      book_appointmentSub: t("health.doctorChoice.quickActions.bookAppointmentSub", "VYVA prepares the request."),
      book_ride: t("health.doctorChoice.quickActions.bookRide", "Find transport"),
      book_rideSub: t("health.doctorChoice.quickActions.bookRideSub", "Compare safe ways to get there."),
      add_gp_contact: t("health.doctorChoice.quickActions.addGp", "Add GP contact"),
      add_gp_contactSub: t("health.doctorChoice.quickActions.addGpSub", "Save phone or email first."),
    },
  }), [latestSymptomReport, profile?.gpEmail, profile?.gpName, profile?.gpPhone, t]);

  const heroMessage = useHeroMessage("doctor", {
    fallbackHeadline: t("health.doctorChoice.title", "Elige una opcion"),
    fallbackSourceText: t("health.doctorChoice.kicker", "Ayuda medica"),
    fallbackCtaLabel: t("health.doctorChoice.talkNow", "Hablar ahora"),
    fallbackContextHint: "doctor choice",
    safetyLevel: "medical",
  });

  const stopCallFallback = useMemo(() => {
    switch (language) {
      case "en":
        return "Pause listening";
      case "de":
        return "Zuhören pausieren";
      case "fr":
        return "Mettre en pause";
      case "it":
        return "Metti in pausa";
      case "pt":
        return "Pausar escuta";
      case "es":
      default:
        return "Pausar escucha";
    }
  }, [language]);

  const stopDoctorVoiceAndClearError = useCallback(() => {
    stopDoctorVoice();
    setVoiceError(null);
  }, [stopDoctorVoice]);

  const handleHeroVoiceAction = useCallback(() => {
    if (isVoiceLive) {
      stopDoctorVoiceAndClearError();
      return;
    }
    setVoiceError(null);
    void startDoctorVoice(latestSymptomReport ? { latestSymptomReport } : undefined);
  }, [isVoiceLive, latestSymptomReport, startDoctorVoice, stopDoctorVoiceAndClearError]);

  useEffect(() => {
    if (!lastError) return;
    const normalizedError = lastError.toLowerCase();
    const friendlyMessage = normalizedError.includes("missing elevenlabs api key")
      ? t(
          "health.doctorChoice.voiceSetupError",
          "La voz del medico no esta configurada todavia en este entorno.",
        )
      : normalizedError.includes("no elevenlabs agent configured")
        ? t(
            "health.doctorChoice.voiceAgentMissing",
            "El agente del medico no esta configurado todavia.",
          )
        : normalizedError.includes("voice session closed")
          ? t(
              "health.doctorChoice.voiceClosedDebug",
              "La sesion de voz se cerro: {{reason}}",
              { reason: lastError },
            )
        : t(
            "health.doctorChoice.voiceError",
            "La voz no se ha podido iniciar. Puede tocar una opcion.",
          );
    setVoiceError(
      friendlyMessage,
    );
  }, [lastError, t]);

  useEffect(() => {
    if (!startAttempted || userStopped || lastError) return;
    if (status === "idle" && !isConnecting && !isSpeaking && !isUserSpeaking) {
      setVoiceError(
        t(
          "health.doctorChoice.voiceDropped",
          "La conversacion se ha cortado. Toca otra vez para seguir.",
        ),
      );
    }
  }, [isConnecting, isSpeaking, isUserSpeaking, lastError, startAttempted, status, t, userStopped]);

  useEffect(() => {
    if (!autoStartRequested || startAttempted || isVoiceLive) return;
    void startDoctorVoice(latestSymptomReport ? { latestSymptomReport } : undefined);
  }, [autoStartRequested, isVoiceLive, latestSymptomReport, startAttempted, startDoctorVoice]);

  const handleDirect = () => {
    if (isVoiceLive) return;
    setVoiceError(null);
    void startDoctorVoice(latestSymptomReport ? { latestSymptomReport } : undefined);
  };

  const handleTriage = () => {
    stopDoctorVoiceAndClearError();
    navigate("/health/symptom-check");
  };

  const heroVoiceLabel = isVoiceLive
    ? t("health.doctorChoice.stopCall", stopCallFallback)
    : heroMessage?.ctaLabel ?? t("health.doctorChoice.talkNow", "Hablar ahora");

  return (
    <div className="vyva-page pb-[120px]">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            stopDoctorVoiceAndClearError();
            navigate("/health");
          }}
          className="vyva-tap inline-flex items-center gap-2 rounded-full bg-[#FFFDF9] px-5 py-3 font-body text-[16px] font-bold text-vyva-text-1 shadow-sm"
        >
          <ArrowLeft size={20} />
          {t("common.back", "Atras")}
        </button>

        <button
          type="button"
          onClick={() => {
            stopDoctorVoiceAndClearError();
            navigate("/health");
          }}
          className="vyva-tap inline-flex h-[48px] w-[48px] items-center justify-center rounded-full bg-[#F5F3FF] text-vyva-purple shadow-sm"
          aria-label={t("common.close", "Cerrar")}
        >
          <X size={21} />
        </button>
      </div>

      <section className="relative overflow-hidden rounded-[30px] bg-[#3D0D82] p-5 text-white shadow-[0_16px_36px_rgba(91,18,160,0.24)]">
        <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-white/10" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-[24px] bg-white/15">
            <Stethoscope size={34} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="font-body text-[12px] font-bold uppercase tracking-[0.14em] text-white/65">
                {heroMessage?.sourceText ?? t("health.doctorChoice.kicker", "Ayuda medica")}
              </p>
              <span
                className="inline-flex h-4 w-4 flex-shrink-0 rounded-full border-2 border-white/80 shadow-[0_0_0_5px_rgba(255,255,255,0.16)]"
                style={{ background: isVoiceLive ? "#10B981" : "#DC2626" }}
                aria-label={isVoiceLive ? t("statusVitals.online", "Online") : t("statusVitals.offline", "Offline")}
                title={isVoiceLive ? t("statusVitals.online", "Online") : t("statusVitals.offline", "Offline")}
              />
            </div>
            <h1
              className="mt-1 min-w-0 break-words font-display text-[34px] italic leading-[1.08] text-white"
              style={{
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
                overflow: "hidden",
                overflowWrap: "anywhere",
              }}
            >
              {heroMessage?.headline ?? t("health.doctorChoice.title", "Elige una opcion")}
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={handleHeroVoiceAction}
          aria-label={heroVoiceLabel}
          className={`vyva-tap relative mt-6 inline-flex min-h-[60px] w-full items-center justify-center gap-3 rounded-full border px-5 font-body text-[18px] font-extrabold shadow-sm transition ${
            isVoiceLive
              ? "border-[#FDBA74] bg-[#FFF7ED] text-[#9A3412]"
              : "border-white bg-white text-vyva-purple"
          }`}
        >
          {isVoiceLive ? <X size={24} /> : <Mic size={24} />}
          {heroVoiceLabel}
        </button>
      </section>

      {voiceError ? (
        <div className="mt-4 rounded-[24px] border border-[#FDBA74] bg-[#FFF7ED] px-5 py-4 font-body text-[16px] font-semibold text-[#9A3412]">
          {voiceError}
        </div>
      ) : null}

      <section className="mt-4 rounded-[28px] border border-[#E8DED4] bg-white p-4 shadow-[0_10px_28px_rgba(63,45,35,0.08)]" data-testid="doctor-quick-service-actions">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#F5F3FF] text-vyva-purple">
            <Stethoscope size={24} />
          </span>
          <div className="min-w-0">
            <p className="font-body text-[13px] font-black uppercase tracking-[0.12em] text-vyva-purple">
              {t("health.doctorChoice.quickActions.title", "Fast service access")}
            </p>
            <p className="mt-1 font-body text-[15px] font-bold leading-snug text-vyva-text-2">
              {t("health.doctorChoice.quickActions.subtitle", "Call, email, book care, or arrange transport from here.")}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = quickActionIcons[action.kind];
            const className = "vyva-tap flex min-h-[94px] flex-col items-start justify-between rounded-[22px] border border-[#E8DED4] bg-[#FFFCF8] p-3 text-left shadow-[0_8px_18px_rgba(63,45,35,0.05)] transition active:scale-[0.98]";
            const content = (
              <>
                <span className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-white text-vyva-purple shadow-sm">
                  <Icon size={20} />
                </span>
                <span className="mt-2 block font-body text-[16px] font-black leading-tight text-vyva-text-1">
                  {action.label}
                </span>
                <span className="mt-1 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">
                  {action.sub}
                </span>
              </>
            );

            if (action.href) {
              return (
                <a
                  key={action.kind}
                  href={action.href}
                  onClick={stopDoctorVoiceAndClearError}
                  className={className}
                  data-testid={`button-doctor-quick-${action.kind}`}
                >
                  {content}
                </a>
              );
            }

            return (
              <button
                key={action.kind}
                type="button"
                onClick={() => {
                  stopDoctorVoiceAndClearError();
                  if (action.to) navigate(action.to, action.state ? { state: action.state } : undefined);
                }}
                className={className}
                data-testid={`button-doctor-quick-${action.kind}`}
              >
                {content}
              </button>
            );
          })}
        </div>
      </section>

      {latestSymptomReport ? (
        <section className="mt-4 rounded-[24px] border border-[#E8DED4] bg-white p-5 shadow-[0_8px_24px_rgba(63,45,35,0.06)]">
          <p className="font-body text-[13px] font-extrabold uppercase tracking-[0.12em] text-vyva-purple">
            {t("health.doctorChoice.recentSymptomTitle", "Recent symptom check")}
          </p>
          <p className="mt-2 line-clamp-4 whitespace-pre-line font-body text-[15px] font-semibold leading-relaxed text-vyva-text-1">
            {latestSymptomReport}
          </p>
        </section>
      ) : null}

      {doctorRecommendations.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            const firstRecommendation = doctorRecommendations[0];
            navigate(`${firstRecommendation.path}?returnTo=${encodeURIComponent("/health/doctor")}`);
          }}
          className="mt-4 w-full rounded-[24px] border border-[#E8DED4] bg-white px-5 py-4 text-left shadow-[0_8px_24px_rgba(63,45,35,0.06)]"
        >
          <p className="font-body text-[13px] font-extrabold uppercase tracking-[0.12em] text-vyva-purple">
            {t("health.doctorChoice.contextTipTitle", "Optional profile tip")}
          </p>
          <p className="mt-1 font-body text-[15px] font-semibold text-vyva-text-1">
            {doctorRecommendations[0].reason}
          </p>
        </button>
      ) : null}

      <div className="mt-5 flex flex-col gap-4">
        <button
          type="button"
          onClick={handleDirect}
          className="vyva-tap flex min-h-[120px] items-center gap-4 rounded-[28px] border border-[#BBF7D0] bg-[#F0FDF4] p-5 text-left shadow-[0_10px_26px_rgba(10,124,78,0.10)]"
        >
          <span className="flex h-[62px] w-[62px] flex-shrink-0 items-center justify-center rounded-[20px] bg-white">
            <Stethoscope size={30} className="text-[#0A7C4E]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-body text-[22px] font-extrabold leading-tight text-vyva-text-1">
              {t("health.doctorChoice.directTitle", "Hablar con un medico")}
            </span>
            <span className="mt-2 block font-body text-[17px] leading-snug text-vyva-text-2">
              {t("health.doctorChoice.directSubtitle", "Llamada o videollamada")}
            </span>
          </span>
          <ChevronRight size={26} className="flex-shrink-0 text-[#0A7C4E]" />
        </button>

        <button
          type="button"
          onClick={handleTriage}
          className="vyva-tap flex min-h-[120px] items-center gap-4 rounded-[28px] border border-[#E8DED4] bg-white p-5 text-left shadow-[0_8px_24px_rgba(63,45,35,0.06)]"
        >
          <span className="flex h-[62px] w-[62px] flex-shrink-0 items-center justify-center rounded-[20px] bg-[#F5F3FF]">
            <HeartPulse size={30} className="text-vyva-purple" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-body text-[22px] font-extrabold leading-tight text-vyva-text-1">
              {t("health.doctorChoice.triageTitle", "Hacer triaje primero")}
            </span>
            <span className="mt-2 block font-body text-[17px] leading-snug text-vyva-text-2">
              {t("health.doctorChoice.triageSubtitle", "Preguntas rapidas")}
            </span>
          </span>
          <ChevronRight size={26} className="flex-shrink-0 text-vyva-purple" />
        </button>
      </div>
    </div>
  );
};

export default DoctorChoiceScreen;
