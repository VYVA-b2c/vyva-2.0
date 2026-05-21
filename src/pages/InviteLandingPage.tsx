import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { VyvaWordmark } from "@/components/VyvaWordmark";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n";
import type { LanguageCode } from "@/i18n/languages";
import { queryClient } from "@/lib/queryClient";

const INVITE_LANGUAGE_CODES: LanguageCode[] = ["en", "es", "fr", "de", "it", "pt"];

const REDIRECT_COPY: Record<LanguageCode, { title: string }> = {
  en: { title: "Opening VYVA setup..." },
  es: { title: "Abriendo la configuracion de VYVA..." },
  fr: { title: "Ouverture de la configuration VYVA..." },
  de: { title: "VYVA Einrichtung wird geoeffnet..." },
  it: { title: "Apertura della configurazione VYVA..." },
  pt: { title: "A abrir a configuracao da VYVA..." },
  cy: { title: "Opening VYVA setup..." },
};

export function inviteSetupPath(search: string) {
  return `/settings/account${search}`;
}

function inviteLanguageFromSearch(search: string): LanguageCode | null {
  const requestedLanguage = new URLSearchParams(search).get("lang");
  return requestedLanguage && INVITE_LANGUAGE_CODES.includes(requestedLanguage as LanguageCode)
    ? requestedLanguage as LanguageCode
    : null;
}

export default function InviteLandingPage() {
  const { user, isLoading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const redirectStartedRef = useRef(false);
  const targetPath = useMemo(() => inviteSetupPath(location.search), [location.search]);
  const copy = REDIRECT_COPY[language] ?? REDIRECT_COPY.en;

  useEffect(() => {
    const requestedLanguage = inviteLanguageFromSearch(location.search);
    if (requestedLanguage && requestedLanguage !== language) {
      setLanguage(requestedLanguage);
    }
  }, [language, location.search, setLanguage]);

  useEffect(() => {
    if (isLoading || redirectStartedRef.current) return;
    redirectStartedRef.current = true;

    async function redirectToSetup() {
      if (user) {
        await logout();
        queryClient.clear();
      }
      navigate(targetPath, { replace: true });
    }

    redirectToSetup().catch(() => {
      navigate(targetPath, { replace: true });
    });
  }, [isLoading, logout, navigate, targetPath, user]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#FFF9F1] px-6 text-center text-vyva-text-1">
      <VyvaWordmark className="h-auto w-[138px]" />
      <div className="inline-flex items-center gap-3 rounded-full border border-[#E8DDF3] bg-white px-5 py-3 font-body text-[14px] font-extrabold text-vyva-purple shadow-[0_14px_34px_rgba(77,45,20,0.08)]">
        <Loader2 size={18} className="animate-spin" />
        {copy.title}
      </div>
    </div>
  );
}
