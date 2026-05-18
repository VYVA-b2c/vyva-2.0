import { ArrowRight, CheckCircle2, Globe2, LogIn, ShieldCheck, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { VyvaWordmark } from "@/components/VyvaWordmark";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n";
import type { LanguageCode } from "@/i18n/languages";
import { queryClient } from "@/lib/queryClient";
import { stageToRoute } from "@/lib/onboardingRoute";

type ProfileResponse = {
  firstName?: string;
  lastName?: string;
  preferredName?: string;
  email?: string;
};

type InviteCopy = {
  language: string;
  eyebrow: string;
  title: string;
  body: string;
  signedInBody: string;
  checking: string;
  signedInPrefix: string;
  signedInSuffix: string;
  signedInHint: string;
  startNew: string;
  continueAs: string;
  startSignup: string;
  alreadyHaveAccount: string;
  privacy: string;
};

const INVITE_COPY: Record<LanguageCode, InviteCopy> = {
  en: {
    language: "Language",
    eyebrow: "VYVA invitation",
    title: "Create your VYVA account",
    body: "Set up your private VYVA profile for health, medication, family support, and everyday help.",
    signedInBody: "This browser is already signed in. Choose whether to continue with that account or start a new signup.",
    checking: "Checking this browser...",
    signedInPrefix: "You are signed in as",
    signedInSuffix: ".",
    signedInHint: "Starting a new signup will first sign out of this account so the invite cannot use the wrong profile.",
    startNew: "Start new signup",
    continueAs: "Continue as",
    startSignup: "Start signup",
    alreadyHaveAccount: "I already have an account",
    privacy: "VYVA keeps each profile separate. This page helps prevent an invite from opening inside the wrong signed-in account.",
  },
  es: {
    language: "Idioma",
    eyebrow: "Invitacion VYVA",
    title: "Crea tu cuenta VYVA",
    body: "Configura tu perfil privado de VYVA para salud, medicacion, apoyo familiar y ayuda diaria.",
    signedInBody: "Este navegador ya tiene una sesion iniciada. Elige si quieres continuar con esa cuenta o empezar un registro nuevo.",
    checking: "Comprobando este navegador...",
    signedInPrefix: "Has iniciado sesion como",
    signedInSuffix: ".",
    signedInHint: "Para empezar un registro nuevo, primero cerraremos esta sesion para que la invitacion no use el perfil equivocado.",
    startNew: "Empezar registro nuevo",
    continueAs: "Continuar como",
    startSignup: "Empezar registro",
    alreadyHaveAccount: "Ya tengo una cuenta",
    privacy: "VYVA mantiene cada perfil separado. Esta pagina evita que una invitacion se abra dentro de la cuenta equivocada.",
  },
  fr: {
    language: "Langue",
    eyebrow: "Invitation VYVA",
    title: "Creez votre compte VYVA",
    body: "Configurez votre profil VYVA prive pour la sante, les medicaments, le soutien familial et l'aide quotidienne.",
    signedInBody: "Ce navigateur est deja connecte. Choisissez de continuer avec ce compte ou de commencer une nouvelle inscription.",
    checking: "Verification de ce navigateur...",
    signedInPrefix: "Vous etes connecte en tant que",
    signedInSuffix: ".",
    signedInHint: "Pour commencer une nouvelle inscription, VYVA vous deconnectera d'abord afin que l'invitation n'utilise pas le mauvais profil.",
    startNew: "Nouvelle inscription",
    continueAs: "Continuer avec",
    startSignup: "Commencer",
    alreadyHaveAccount: "J'ai deja un compte",
    privacy: "VYVA garde chaque profil separe. Cette page evite qu'une invitation s'ouvre dans le mauvais compte connecte.",
  },
  de: {
    language: "Sprache",
    eyebrow: "VYVA Einladung",
    title: "VYVA Konto erstellen",
    body: "Richten Sie Ihr privates VYVA Profil fur Gesundheit, Medikamente, Familienunterstutzung und Alltagshilfe ein.",
    signedInBody: "Dieser Browser ist bereits angemeldet. Wahlen Sie, ob Sie mit diesem Konto fortfahren oder eine neue Anmeldung starten mochten.",
    checking: "Browser wird gepruft...",
    signedInPrefix: "Sie sind angemeldet als",
    signedInSuffix: ".",
    signedInHint: "Fur eine neue Anmeldung meldet VYVA dieses Konto zuerst ab, damit die Einladung nicht das falsche Profil verwendet.",
    startNew: "Neue Anmeldung starten",
    continueAs: "Fortfahren als",
    startSignup: "Anmeldung starten",
    alreadyHaveAccount: "Ich habe bereits ein Konto",
    privacy: "VYVA halt Profile getrennt. Diese Seite verhindert, dass eine Einladung im falschen angemeldeten Konto geoffnet wird.",
  },
  it: {
    language: "Lingua",
    eyebrow: "Invito VYVA",
    title: "Crea il tuo account VYVA",
    body: "Configura il tuo profilo VYVA privato per salute, farmaci, supporto familiare e aiuto quotidiano.",
    signedInBody: "Questo browser e gia connesso. Scegli se continuare con quell'account o iniziare una nuova registrazione.",
    checking: "Controllo del browser...",
    signedInPrefix: "Hai effettuato l'accesso come",
    signedInSuffix: ".",
    signedInHint: "Per iniziare una nuova registrazione, VYVA uscira prima da questo account cosi l'invito non usera il profilo sbagliato.",
    startNew: "Nuova registrazione",
    continueAs: "Continua come",
    startSignup: "Inizia registrazione",
    alreadyHaveAccount: "Ho gia un account",
    privacy: "VYVA mantiene separato ogni profilo. Questa pagina evita che un invito si apra nell'account sbagliato.",
  },
  pt: {
    language: "Idioma",
    eyebrow: "Convite VYVA",
    title: "Crie a sua conta VYVA",
    body: "Configure o seu perfil VYVA privado para saude, medicacao, apoio familiar e ajuda diaria.",
    signedInBody: "Este navegador ja tem sessao iniciada. Escolha se quer continuar com essa conta ou iniciar um novo registo.",
    checking: "A verificar este navegador...",
    signedInPrefix: "Tem sessao iniciada como",
    signedInSuffix: ".",
    signedInHint: "Para iniciar um novo registo, a VYVA termina primeiro esta sessao para que o convite nao use o perfil errado.",
    startNew: "Iniciar novo registo",
    continueAs: "Continuar como",
    startSignup: "Iniciar registo",
    alreadyHaveAccount: "Ja tenho uma conta",
    privacy: "A VYVA mantem cada perfil separado. Esta pagina evita que um convite abra na conta errada.",
  },
  cy: {
    language: "Language",
    eyebrow: "VYVA invitation",
    title: "Create your VYVA account",
    body: "Set up your private VYVA profile for health, medication, family support, and everyday help.",
    signedInBody: "This browser is already signed in. Choose whether to continue with that account or start a new signup.",
    checking: "Checking this browser...",
    signedInPrefix: "You are signed in as",
    signedInSuffix: ".",
    signedInHint: "Starting a new signup will first sign out of this account so the invite cannot use the wrong profile.",
    startNew: "Start new signup",
    continueAs: "Continue as",
    startSignup: "Start signup",
    alreadyHaveAccount: "I already have an account",
    privacy: "VYVA keeps each profile separate. This page helps prevent an invite from opening inside the wrong signed-in account.",
  },
};

function displayName(profile?: ProfileResponse | null, fallback?: string | null) {
  const full = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();
  return profile?.preferredName?.trim() || full || fallback || "this account";
}

export default function InviteLandingPage() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const { language, setLanguage, languages } = useLanguage();
  const copy = INVITE_COPY[language] ?? INVITE_COPY.en;
  const profileQuery = useQuery<ProfileResponse | null>({
    queryKey: ["/api/profile"],
    enabled: Boolean(user),
  });

  const name = displayName(profileQuery.data, user?.email ?? user?.phone ?? null);

  const startSignup = async () => {
    if (user) {
      await logout();
      queryClient.clear();
    }
    navigate("/login", { replace: true, state: { from: "/onboarding/who-for", invite: true } });
  };

  const continueCurrentAccount = async () => {
    const data = await queryClient.fetchQuery({ queryKey: ["/api/onboarding/state"] }).catch(() => null);
    const stage =
      (data as { onboardingState?: { current_stage?: string }; profile?: { current_stage?: string } } | null)
        ?.onboardingState?.current_stage ??
      (data as { onboardingState?: { current_stage?: string }; profile?: { current_stage?: string } } | null)
        ?.profile?.current_stage;
    navigate(stageToRoute(stage), { replace: true });
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#FFF9F1] text-vyva-text-1">
      <div className="pointer-events-none fixed -left-28 top-10 h-80 w-80 rounded-full bg-[#F7C948]/25 blur-3xl" />
      <div className="pointer-events-none fixed -right-28 top-20 h-[28rem] w-[28rem] rounded-full bg-[#6B21A8]/14 blur-3xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-[1040px] items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <VyvaWordmark className="h-auto w-[132px] sm:w-[158px]" />
        <label className="flex items-center gap-2 rounded-full border border-[#E8DDF3] bg-white/86 px-3 py-2 shadow-[0_12px_32px_rgba(77,45,20,0.08)] backdrop-blur">
          <Globe2 size={15} className="text-vyva-purple" />
          <span className="sr-only">{copy.language}</span>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            aria-label={copy.language}
            className="bg-transparent font-body text-[13px] font-extrabold text-vyva-purple outline-none"
          >
            {languages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-92px)] w-full max-w-[1040px] items-center justify-center px-5 pb-8 sm:px-8">
        <section className="w-full max-w-[560px] rounded-[34px] border border-[#EFE7DB] bg-white/94 p-6 shadow-[0_24px_70px_rgba(72,44,18,0.14)] backdrop-blur sm:p-8">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-[22px] bg-[#F3E8FF] text-vyva-purple">
            <UserRound size={28} />
          </div>
          <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.26em] text-vyva-purple/70">
            {copy.eyebrow}
          </p>
          <h1 className="mt-3 font-display text-[44px] leading-[0.98] text-[#2E1642] sm:text-[58px]">
            {copy.title}
          </h1>
          <p className="mt-4 font-body text-[16px] leading-[1.65] text-vyva-text-2">
            {user ? copy.signedInBody : copy.body}
          </p>

          {isLoading ? (
            <div className="mt-7 rounded-[24px] border border-[#EFE7DB] bg-[#FFF9F1] px-5 py-5 font-body text-[14px] font-bold text-vyva-text-2">
              {copy.checking}
            </div>
          ) : user ? (
            <div className="mt-7 space-y-4">
              <div className="rounded-[24px] border border-[#EFE7DB] bg-[#FFF9F1] px-5 py-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-vyva-green" />
                  <div>
                    <p className="font-body text-[15px] font-extrabold text-vyva-text-1">
                      {copy.signedInPrefix} {name}{copy.signedInSuffix}
                    </p>
                    <p className="mt-1 font-body text-[13px] leading-[1.55] text-vyva-text-2">
                      {copy.signedInHint}
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={startSignup}
                className="vyva-primary-action w-full bg-[linear-gradient(135deg,#6B21A8_0%,#8B3FC8_100%)] py-4 shadow-vyva-fab"
              >
                {copy.startNew}
                <ArrowRight size={17} />
              </button>

              <button
                type="button"
                onClick={continueCurrentAccount}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#E8DDF3] bg-white px-5 py-4 font-body text-[14px] font-extrabold text-vyva-purple"
              >
                {copy.continueAs} {name}
              </button>
            </div>
          ) : (
            <div className="mt-7 space-y-4">
              <button
                type="button"
                onClick={startSignup}
                className="vyva-primary-action w-full bg-[linear-gradient(135deg,#6B21A8_0%,#8B3FC8_100%)] py-4 shadow-vyva-fab"
              >
                {copy.startSignup}
                <ArrowRight size={17} />
              </button>
              <button
                type="button"
                onClick={() => navigate("/login", { state: { from: "/" } })}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#E8DDF3] bg-white px-5 py-4 font-body text-[14px] font-extrabold text-vyva-purple"
              >
                {copy.alreadyHaveAccount}
                <LogIn size={16} />
              </button>
            </div>
          )}

          <div className="mt-6 flex items-start gap-3 rounded-[22px] bg-[#FFF9E8] px-4 py-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#B98900]" />
            <p className="font-body text-[12px] leading-[1.55] text-[#8A6500]">
              {copy.privacy}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
