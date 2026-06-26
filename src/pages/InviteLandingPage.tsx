import { Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { VyvaWordmark } from "@/components/VyvaWordmark";
import { useAuth } from "@/contexts/AuthContext";
import { setBootstrapLanguage, useLanguage } from "@/i18n";
import type { LanguageCode } from "@/i18n/languages";
import { rememberSignupInviteId, signupInviteIdFromSearch, trackSignupInviteEvent } from "@/lib/signupInviteAudit";

const INVITE_LANGUAGE_CODES: LanguageCode[] = ["en", "es", "fr", "de", "it", "pt"];

const REDIRECT_COPY: Record<LanguageCode, { eyebrow: string; title: string; body: string; secure: string }> = {
  en: {
    eyebrow: "VYVA setup",
    title: "Opening VYVA setup",
    body: "One moment while VYVA prepares your secure account details.",
    secure: "Your invite opens in a separate profile.",
  },
  es: {
    eyebrow: "Configuracion VYVA",
    title: "Abriendo VYVA",
    body: "Un momento mientras VYVA prepara los datos seguros de tu cuenta.",
    secure: "Tu invitacion se abre en un perfil separado.",
  },
  fr: {
    eyebrow: "Configuration VYVA",
    title: "Ouverture de VYVA",
    body: "Un instant pendant que VYVA prepare les details securises de votre compte.",
    secure: "Votre invitation s'ouvre dans un profil separe.",
  },
  de: {
    eyebrow: "VYVA Einrichtung",
    title: "VYVA wird geoeffnet",
    body: "Einen Moment, VYVA bereitet Ihre sicheren Kontodaten vor.",
    secure: "Ihre Einladung wird in einem separaten Profil geoeffnet.",
  },
  it: {
    eyebrow: "Configurazione VYVA",
    title: "Apertura di VYVA",
    body: "Un momento mentre VYVA prepara i dati sicuri del tuo account.",
    secure: "Il tuo invito si apre in un profilo separato.",
  },
  pt: {
    eyebrow: "Configuracao VYVA",
    title: "A abrir a VYVA",
    body: "Um momento enquanto a VYVA prepara os dados seguros da sua conta.",
    secure: "O seu convite abre num perfil separado.",
  },
};

export function inviteSetupPath(search: string) {
  const params = new URLSearchParams(search);
  const setupFor = (params.get("setup_for") ?? params.get("setup") ?? params.get("intent") ?? "").trim().toLowerCase();
  const caregiverInvite = ["someone_else", "caregiver", "family", "proxy"].includes(setupFor);
  params.set("mode", "register");
  params.set("invite", "1");
  params.set("returnTo", caregiverInvite ? "/onboarding/who-for" : "/");
  return `/login?${params.toString()}`;
}

export function inviteHomePath() {
  return "/";
}

function inviteLanguageFromSearch(search: string): LanguageCode | null {
  const requestedLanguage = new URLSearchParams(search).get("lang");
  return requestedLanguage && INVITE_LANGUAGE_CODES.includes(requestedLanguage as LanguageCode)
    ? requestedLanguage as LanguageCode
    : null;
}

export default function InviteLandingPage() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const redirectStartedRef = useRef(false);
  const setupPath = useMemo(() => inviteSetupPath(location.search), [location.search]);
  const copy = REDIRECT_COPY[language] ?? REDIRECT_COPY.en;

  useEffect(() => {
    const requestedLanguage = inviteLanguageFromSearch(location.search);
    if (requestedLanguage && requestedLanguage !== language) {
      setBootstrapLanguage(requestedLanguage);
    }
  }, [language, location.search]);

  useEffect(() => {
    if (isLoading || redirectStartedRef.current) return;
    redirectStartedRef.current = true;
    const destination = user ? inviteHomePath() : setupPath;
    const inviteId = signupInviteIdFromSearch(location.search);
    rememberSignupInviteId(inviteId);
    trackSignupInviteEvent(inviteId, "clicked", { destination, keepalive: true });
    navigate(destination, { replace: true });
  }, [isLoading, location.search, navigate, setupPath, user]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFF9F1] px-5 py-8 text-vyva-text-1">
      <div className="w-full max-w-[430px] overflow-hidden rounded-[28px] border border-[#EFE7DB] bg-white shadow-[0_24px_70px_rgba(72,44,18,0.12)]">
        <div className="bg-[#6B21A8] px-6 py-7 text-white">
          <div className="inline-flex rounded-[18px] bg-white px-4 py-3 shadow-[0_14px_32px_rgba(46,22,66,0.18)]">
            <VyvaWordmark className="h-auto w-[132px]" />
          </div>
          <p className="mt-7 font-body text-[11px] font-extrabold uppercase tracking-[0.24em] text-[#F7C948]">
            {copy.eyebrow}
          </p>
          <h1 className="mt-2 font-display text-[34px] leading-[1.02]">
            {copy.title}
          </h1>
        </div>

        <div className="px-6 py-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3E8FF] text-vyva-purple">
              <Loader2 size={20} className="animate-spin" />
            </span>
            <p className="font-body text-[15px] leading-[1.55] text-vyva-text-2">
              {copy.body}
            </p>
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-[18px] bg-[#FFF9E8] px-4 py-3">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#B98900]" />
            <p className="font-body text-[12px] font-bold leading-[1.5] text-[#8A6500]">
              {copy.secure}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
