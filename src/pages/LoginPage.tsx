import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  Link2,
  Loader2,
  PhoneCall,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  PurpleModal,
  PurpleModalOption,
  VYVA_MODAL_PRIMARY_ACTION_CLASS,
  VYVA_MODAL_SECONDARY_ACTION_CLASS,
} from "@/components/vyva-ui";
import VoiceCallOverlay from "@/components/VoiceCallOverlay";
import { VyvaWordmark } from "@/components/VyvaWordmark";
import { useAuth } from "@/contexts/AuthContext";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";
import { localizeAuthErrorMessage } from "@/lib/authErrorLocalization";
import {
  careTeamInviteTokenFromReturnPath,
  currentCareTeamInviteReturnPath,
  isCareTeamInviteReturnPath,
  rememberCareTeamInviteReturnPath,
} from "@/lib/careTeamInviteReturn";
import { apiFetch, queryClient } from "@/lib/queryClient";
import {
  defaultSignedInRoute,
  isCaregiverRoutingUser,
  routeAfterOnboardingStage,
  safeReturnPathForActiveProfile,
} from "@/lib/onboardingRoute";
import { currentSignupInviteId, trackSignupInviteEvent } from "@/lib/signupInviteAudit";
import { setBootstrapLanguage, useLanguage } from "@/i18n";
import { LANGUAGES, type LanguageCode } from "@/i18n/languages";

type View = "login" | "register" | "forgot" | "magic";
type GuideTopic = "why" | "privacy" | "family";
type SetupIntent = "self" | "caregiver";
type CallbackFor = "me" | "caregiver";
type CallbackPeriod = "AM" | "PM";
type AuthAudience = "member" | "caregiver" | "admin";

type AudienceCopy = {
  routeLabel: string;
  headerTagline: string;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  authTitle: string;
  authSubtitle: string;
  trustItems: string[];
  intentLabel: string;
  memberDoor: string;
  memberDoorSubtitle: string;
  caregiverDoor: string;
  caregiverDoorSubtitle: string;
  caregiverNoteTitle: string;
  caregiverNoteBody: string;
  switchMember: string;
  switchCaregiver: string;
  secureFooter: string;
};

type CountryDialOption = {
  country: string;
  dialCode: string;
  label: string;
  phonePlaceholder: string;
};

const COUNTRY_DIAL_OPTIONS: CountryDialOption[] = [
  { country: "ES", dialCode: "+34", label: "Spain", phonePlaceholder: "612 345 678" },
  { country: "IT", dialCode: "+39", label: "Italy", phonePlaceholder: "312 345 6789" },
  { country: "PT", dialCode: "+351", label: "Portugal", phonePlaceholder: "912 345 678" },
  { country: "FR", dialCode: "+33", label: "France", phonePlaceholder: "6 12 34 56 78" },
  { country: "GB", dialCode: "+44", label: "UK", phonePlaceholder: "7123 456789" },
  { country: "US", dialCode: "+1", label: "US", phonePlaceholder: "415 555 0198" },
  { country: "DE", dialCode: "+49", label: "Germany", phonePlaceholder: "151 23456789" },
  { country: "CH", dialCode: "+41", label: "Switzerland", phonePlaceholder: "79 123 45 67" },
  { country: "IE", dialCode: "+353", label: "Ireland", phonePlaceholder: "85 123 4567" },
];

const COUNTRY_TO_DIAL = COUNTRY_DIAL_OPTIONS.reduce<Record<string, string>>((map, option) => {
  map[option.country] = option.dialCode;
  return map;
}, {});

const COUNTRY_BY_CODE = COUNTRY_DIAL_OPTIONS.reduce<Record<string, CountryDialOption>>((map, option) => {
  map[option.country] = option;
  return map;
}, {});

const VYVA_CALL_NUMBERS: Record<string, { display: string; e164: string }> = {
  ES: { display: "+34 900 876 003", e164: "+34900876003" },
  IT: { display: "+39 800 984 401", e164: "+39800984401" },
  PT: { display: "+351 800 180 044", e164: "+351800180044" },
  FR: { display: "+33 805 980 422", e164: "+33805980422" },
  GB: { display: "+44 808 175 7642", e164: "+448081757642" },
  US: { display: "+1 833 982 0980", e164: "+18339820980" },
  DE: { display: "+49 800 182 4601", e164: "+498001824601" },
  CH: { display: "+41 800 002 443", e164: "+41800002443" },
  IE: { display: "+353 1800 832 021", e164: "+3531800832021" },
};

const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  "Europe/Madrid": "ES",
  "Europe/London": "GB",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Rome": "IT",
  "Europe/Lisbon": "PT",
  "Europe/Dublin": "IE",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Zurich": "CH",
};

function inferCountryFromBrowser() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneCountry = timezone ? TIMEZONE_TO_COUNTRY[timezone] : null;
  if (timezoneCountry && COUNTRY_BY_CODE[timezoneCountry]) return timezoneCountry;

  const localeCountry = navigator.language.split("-")[1]?.toUpperCase();
  if (localeCountry && COUNTRY_BY_CODE[localeCountry]) return localeCountry;

  return "ES";
}

function inferDialCodeFromBrowser() {
  return COUNTRY_TO_DIAL[inferCountryFromBrowser()] ?? "+34";
}

const LOGIN_GUIDE_AGENT_SLUG = "login-guide";

const LOGIN_GUIDE_PROMPT = [
  "You are VYVA's sign-in guide on the login and account creation page.",
  "Explain why an account is needed, how privacy works, and how family setup works.",
  "Keep answers warm, concise, practical, and non-technical.",
  "Do not ask for passwords, payment details, medical details, one-time codes, or sensitive private data.",
].join("\n");

const GUIDE_RESPONSES: Record<GuideTopic, { label: string; body: string }> = {
  why: {
    label: "Why account?",
    body: "So VYVA can remember care context safely.",
  },
  privacy: {
    label: "Is it private?",
    body: "Health and medication details stay account-protected.",
  },
  family: {
    label: "Family help",
    body: "Family can help, but sharing stays controlled.",
  },
};

const LOGIN_LANGUAGE_CODES = new Set<string>(LANGUAGES.map((entry) => entry.code));

function resetLinkForCurrentOrigin(resetLink: string) {
  try {
    const parsed = new URL(resetLink, window.location.href);
    return `${window.location.origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return resetLink;
  }
}

function normalizeReturnPath(value: string | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value === "/onboarding" || value.startsWith("/login")) return null;
  return value;
}

function obscureContact(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes("@")) {
    const [name, domain] = trimmed.split("@");
    const visibleName = name.slice(0, 2);
    return `${visibleName}${"â€¢".repeat(Math.max(3, Math.min(8, name.length - visibleName.length)))}@${domain}`;
  }
  const digits = trimmed.replace(/\s/g, "");
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 3)} ${"â€¢".repeat(Math.max(4, digits.length - 7))} ${digits.slice(-4)}`;
}

function setupInviteParamsFromPath(path: string | null): URLSearchParams | null {
  if (!path?.startsWith("/settings/account")) return null;
  const queryStart = path.indexOf("?");
  if (queryStart === -1) return new URLSearchParams();
  const hashStart = path.indexOf("#", queryStart);
  return new URLSearchParams(path.slice(queryStart, hashStart === -1 ? undefined : hashStart));
}

function setupInviteParamsFromSearch(search: string): URLSearchParams | null {
  const params = new URLSearchParams(search);
  const hasInviteSetup =
    params.get("invite") === "1" ||
    params.has("lang") ||
    params.has("language") ||
    params.has("email") ||
    params.has("phone") ||
    params.has("whatsapp") ||
    params.has("first_name") ||
    params.has("last_name") ||
    params.has("setup_for") ||
    params.has("setup") ||
    params.has("intent");
  return hasInviteSetup ? params : null;
}

function inviteReturnPathFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const returnTo = normalizeReturnPath(params.get("returnTo") ?? undefined);
  if (returnTo) return returnTo;
  return params.get("invite") === "1" ? "/" : null;
}

function setupLanguageFromParams(params: URLSearchParams): LanguageCode | null {
  const normalized = (params.get("lang") ?? params.get("language") ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .split("-")[0];
  return LOGIN_LANGUAGE_CODES.has(normalized) ? normalized as LanguageCode : null;
}

function setupContactFromParams(params: URLSearchParams): string {
  return (params.get("email") ?? params.get("phone") ?? params.get("whatsapp") ?? "").trim();
}

function setupIntentFromParams(params: URLSearchParams): SetupIntent | null {
  const raw = (params.get("setup_for") ?? params.get("setup") ?? params.get("intent") ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (["someone_else", "caregiver", "family", "proxy"].includes(raw)) return "caregiver";
  if (["self", "elder"].includes(raw)) return "self";
  return null;
}

type LoginCopy = {
  privateDailySupport: string;
  heroTitle: string;
  heroSubtitle: string;
  signInHeroEyebrow: string;
  signInHeroTitle: string;
  signInHeroSubtitle: string;
  chips: string[];
  language: string;
  createTab: string;
  signInTab: string;
  titles: Record<View, string>;
  subtitles: Record<View, string>;
  email: string;
  mobile: string;
  mobileNumber: string;
  password: string;
  passwordHint: string;
  forgot: string;
  emailPlaceholder: string;
  phonePlaceholder: string;
  combinedContact?: string;
  combinedContactPlaceholder?: string;
  createPassword: string;
  yourPassword: string;
  creating: string;
  signingIn: string;
  sending: string;
  createAccount: string;
  signIn: string;
  or: string;
  sendResetLink: string;
  sendMagicLink: string;
  signInWithMagicLink: string;
  continueWithGoogle: string;
  usePasswordInstead: string;
  profilePrivate: string;
  privacyPolicy: string;
  signupOptions: {
    call: string;
    callActive: string;
    schedule: string;
    try: string;
  };
  setupIntentLabel: string;
  setupIntent: Record<SetupIntent, { title: string; subtitle: string }>;
  caregiverHint: string;
  checkInbox: string;
  resetSentBody: string;
  backToSignIn: string;
  linkSent: string;
  useWithin: string;
  backToPassword: string;
  alreadyHaveAccount: string;
  dontHaveAccount: string;
  guide: {
    notSure: string;
    title: string;
    helperSubtitle: string;
    quickAnswer: string;
    talk: string;
    end: string;
    connecting: string;
    typeQuestion: string;
    ask: string;
    topics: Record<GuideTopic, { label: string; body: string }>;
  };
  errors: {
    generic: string;
    requestFailed: string;
    magicFailed: string;
    signInLinkFailed: string;
    noAgent: string;
    noApiKey: string;
  };
};

const LOGIN_COPY: Record<LanguageCode, LoginCopy> = {
  en: {
    privateDailySupport: "Health and wellness support",
    heroTitle: "A companion that listens, reminds, and helps.",
    heroSubtitle: "Talk to VYVA for health check-ins, medication reminders, memory exercises, or help planning your day.",
    signInHeroEyebrow: "Your health and wellness companion",
    signInHeroTitle: "Welcome back to VYVA.",
    signInHeroSubtitle: "Sign in to continue your health check-ins, reminders, mind activities, and everyday support.",
    chips: ["My Health", "My Mind", "My Community", "My Concierge"],
    language: "Language",
    createTab: "Sign up",
    signInTab: "Sign in",
    titles: { register: "Sign up", login: "Login", forgot: "Reset access", magic: "Magic link" },
    subtitles: {
      register: "Just a few quick things to get started.",
      login: "Hello, welcome back.",
      forgot: "Enter your email and we will send a secure link.",
      magic: "No password needed.",
    },
    email: "Email",
    mobile: "Mobile",
    mobileNumber: "Mobile number",
    password: "Password",
    passwordHint: "8+ chars",
    forgot: "Forgot?",
    emailPlaceholder: "you@example.com",
    phonePlaceholder: "+34 600 000 000",
    combinedContact: "Mobile or email",
    combinedContactPlaceholder: "+34600111222 or you@example.com",
    createPassword: "Create password",
    yourPassword: "Your password",
    creating: "Creating...",
    signingIn: "Signing in...",
    sending: "Sending...",
    createAccount: "Create account",
    signIn: "Sign in",
    or: "or",
    sendResetLink: "Send reset link",
    sendMagicLink: "Send magic link",
    signInWithMagicLink: "Sign in with magic link",
    continueWithGoogle: "Continue with Google",
    usePasswordInstead: "Use password instead",
    profilePrivate: "Your profile stays private.",
    privacyPolicy: "Privacy policy",
    signupOptions: {
      call: "Call VYVA",
      callActive: "End call",
      schedule: "Schedule Callback",
      try: "Try VYVA",
    },
    setupIntentLabel: "I am using VYVA",
    setupIntent: {
      self: {
        title: "For myself",
        subtitle: "My account and my care profile.",
      },
      caregiver: {
        title: "As a caregiver",
        subtitle: "Set up or access care on someone else's behalf.",
      },
    },
    caregiverHint: "Caregiver accounts stay separate from the care profile. The person receiving support keeps consent and confirmation control.",
    checkInbox: "Check your inbox",
    resetSentBody: "If there is an account, the reset link is on its way.",
    backToSignIn: "Back to sign in",
    linkSent: "Link sent",
    useWithin: "Use it within 15 minutes.",
    backToPassword: "Back to password sign in",
    alreadyHaveAccount: "Already have an account?",
    dontHaveAccount: "Don't have an account?",
    guide: {
      notSure: "Not sure?",
      title: "Ask VYVA",
      helperSubtitle: "Talk to VYVA, choose a quick question, or type your own.",
      quickAnswer: "Quick answer",
      talk: "Talk",
      end: "End",
      connecting: "...",
      typeQuestion: "Type a question",
      ask: "Ask...",
      topics: GUIDE_RESPONSES,
    },
    errors: {
      generic: "Something went wrong - please try again.",
      requestFailed: "Request failed - please try again.",
      magicFailed: "Could not send sign-in link.",
      signInLinkFailed: "This sign-in link did not work.",
      noAgent: "Add ELEVENLABS_LOGIN_GUIDE_AGENT_ID to enable this guide.",
      noApiKey: "Voice guide needs the ElevenLabs API key here.",
    },
  },
  es: {
    privateDailySupport: "Apoyo de salud y bienestar",
    heroTitle: "Una compaÃ±era que escucha, recuerda y ayuda.",
    heroSubtitle: "Habla con VYVA para controles de salud, recordatorios de medicaciÃ³n, ejercicios de memoria o ayuda para planificar tu dÃ­a.",
    signInHeroEyebrow: "Tu compaÃ±era de salud y bienestar",
    signInHeroTitle: "Bienvenido de nuevo a VYVA.",
    signInHeroSubtitle: "Inicia sesiÃ³n para continuar con tus controles de salud, recordatorios, actividades mentales y apoyo diario.",
    chips: ["Primero voz", "Perfil privado", "Listo para familia"],
    language: "Idioma",
    createTab: "Registro",
    signInTab: "Entrar",
    titles: { register: "Crear cuenta", login: "Bienvenido de nuevo", forgot: "Recuperar acceso", magic: "Enlace mÃ¡gico" },
    subtitles: {
      register: "Usa email o mÃ³vil.",
      login: "ContinÃºa con email o mÃ³vil.",
      forgot: "Introduce tu email y enviaremos un enlace seguro.",
      magic: "Sin contraseÃ±a.",
    },
    email: "Email",
    mobile: "MÃ³vil",
    mobileNumber: "NÃºmero mÃ³vil",
    password: "ContraseÃ±a",
    passwordHint: "8+ caracteres",
    forgot: "Â¿Olvidaste?",
    emailPlaceholder: "tu@email.com",
    phonePlaceholder: "+34 600 000 000",
    combinedContact: "Movil o email",
    combinedContactPlaceholder: "+34600111222 o tu@email.com",
    createPassword: "Crear contraseÃ±a",
    yourPassword: "Tu contraseÃ±a",
    creating: "Creando...",
    signingIn: "Entrando...",
    sending: "Enviando...",
    createAccount: "Crear cuenta",
    signIn: "Entrar",
    or: "o",
    sendResetLink: "Enviar enlace",
    sendMagicLink: "Enviar enlace mÃ¡gico",
    signInWithMagicLink: "Entrar con enlace mÃ¡gico",
    continueWithGoogle: "Continuar con Google",
    usePasswordInstead: "Usar contraseÃ±a",
    profilePrivate: "Tu perfil sigue siendo privado.",
    privacyPolicy: "PolÃ­tica de privacidad",
    signupOptions: {
      call: "Llamar a VYVA",
      callActive: "Terminar llamada",
      schedule: "Programar llamada",
      try: "Probar VYVA",
    },
    setupIntentLabel: "Uso VYVA",
    setupIntent: {
      self: {
        title: "Para mÃ­",
        subtitle: "Mi cuenta y mi perfil de cuidado.",
      },
      caregiver: {
        title: "Como cuidador/a",
        subtitle: "Configurar o acceder al cuidado en nombre de otra persona.",
      },
    },
    caregiverHint: "Las cuentas de cuidadores se mantienen separadas del perfil de cuidado. La persona que recibe apoyo conserva el control del consentimiento y la confirmaciÃ³n.",
    checkInbox: "Revisa tu bandeja",
    resetSentBody: "Si existe una cuenta, el enlace ya va en camino.",
    backToSignIn: "Volver a entrar",
    linkSent: "Enlace enviado",
    useWithin: "Ãšsalo antes de 15 minutos.",
    alreadyHaveAccount: "Â¿Ya tienes cuenta?",
    dontHaveAccount: "Â¿No tienes cuenta?",
    backToPassword: "Volver a contraseÃ±a",
    guide: {
      notSure: "Â¿Dudas?",
      title: "Pregunta a VYVA",
      helperSubtitle: "Habla con VYVA, elige una pregunta rÃ¡pida o escribe la tuya.",
      quickAnswer: "Respuesta rÃ¡pida",
      talk: "Hablar",
      end: "Terminar",
      connecting: "...",
      typeQuestion: "Escribe una pregunta",
      ask: "Pregunta...",
      topics: {
        why: { label: "Â¿Por quÃ© cuenta?", body: "Para que VYVA recuerde tu contexto de cuidado con seguridad." },
        privacy: { label: "Â¿Es privado?", body: "Salud y medicaciÃ³n quedan protegidas en tu cuenta." },
        family: { label: "Ayuda familiar", body: "La familia puede ayudar, pero tÃº controlas lo que se comparte." },
      },
    },
    errors: {
      generic: "Algo saliÃ³ mal. IntÃ©ntalo de nuevo.",
      requestFailed: "No se pudo enviar. IntÃ©ntalo de nuevo.",
      magicFailed: "No se pudo enviar el enlace.",
      signInLinkFailed: "Este enlace de acceso no funcionÃ³.",
      noAgent: "AÃ±ade ELEVENLABS_LOGIN_GUIDE_AGENT_ID para activar esta guÃ­a.",
      noApiKey: "La guÃ­a de voz necesita la clave de ElevenLabs.",
    },
  },
  fr: {
    privateDailySupport: "Soutien santÃ© et bien-Ãªtre",
    heroTitle: "Un compagnon qui Ã©coute, rappelle et aide.",
    heroSubtitle: "Parlez Ã  VYVA pour les points santÃ©, les rappels de mÃ©dicaments, les exercices de mÃ©moire ou l'organisation de votre journÃ©e.",
    signInHeroEyebrow: "Votre compagne santÃ© et bien-Ãªtre",
    signInHeroTitle: "Bon retour sur VYVA.",
    signInHeroSubtitle: "Connectez-vous pour continuer vos points santÃ©, rappels, activitÃ©s pour l'esprit et soutien quotidien.",
    chips: ["Voix d'abord", "Profil privÃ©", "PrÃªt pour la famille"],
    language: "Langue",
    createTab: "CrÃ©er",
    signInTab: "Connexion",
    titles: { register: "CrÃ©er un compte", login: "Bon retour", forgot: "RÃ©cupÃ©rer l'accÃ¨s", magic: "Lien magique" },
    subtitles: {
      register: "Utilisez email ou mobile.",
      login: "Continuez avec email ou mobile.",
      forgot: "Saisissez votre email et nous enverrons un lien sÃ©curisÃ©.",
      magic: "Sans mot de passe.",
    },
    email: "Email",
    mobile: "Mobile",
    mobileNumber: "NumÃ©ro mobile",
    password: "Mot de passe",
    passwordHint: "8+ caractÃ¨res",
    forgot: "OubliÃ© ?",
    emailPlaceholder: "vous@example.com",
    phonePlaceholder: "+34 600 000 000",
    createPassword: "CrÃ©er un mot de passe",
    yourPassword: "Votre mot de passe",
    creating: "CrÃ©ation...",
    signingIn: "Connexion...",
    sending: "Envoi...",
    createAccount: "CrÃ©er un compte",
    signIn: "Connexion",
    or: "ou",
    sendResetLink: "Envoyer le lien",
    sendMagicLink: "Envoyer le lien magique",
    signInWithMagicLink: "Connexion avec lien magique",
    continueWithGoogle: "Continuer avec Google",
    usePasswordInstead: "Utiliser le mot de passe",
    profilePrivate: "Votre profil reste privÃ©.",
    privacyPolicy: "Politique de confidentialitÃ©",
    signupOptions: {
      call: "Appeler VYVA",
      callActive: "Terminer l'appel",
      schedule: "Planifier un rappel",
      try: "Essayer VYVA",
    },
    setupIntentLabel: "J'utilise VYVA",
    setupIntent: {
      self: {
        title: "Pour moi",
        subtitle: "Mon compte et mon profil de soin.",
      },
      caregiver: {
        title: "Comme aidant",
        subtitle: "Configurer ou accÃ©der aux soins au nom de quelqu'un.",
      },
    },
    caregiverHint: "Les comptes aidants restent sÃ©parÃ©s du profil de soin. La personne accompagnÃ©e garde le contrÃ´le du consentement et de la confirmation.",
    checkInbox: "VÃ©rifiez votre boÃ®te mail",
    resetSentBody: "Si le compte existe, le lien est en route.",
    backToSignIn: "Retour Ã  la connexion",
    linkSent: "Lien envoyÃ©",
    useWithin: "Ã€ utiliser dans les 15 minutes.",
    backToPassword: "Retour au mot de passe",
    alreadyHaveAccount: "Vous avez dÃ©jÃ  un compte ?",
    dontHaveAccount: "Vous n'avez pas encore de compte ?",
    guide: {
      notSure: "Un doute ?",
      title: "Demander Ã  VYVA",
      helperSubtitle: "Parlez Ã  VYVA, choisissez une question rapide ou Ã©crivez la vÃ´tre.",
      quickAnswer: "RÃ©ponse rapide",
      talk: "Parler",
      end: "Terminer",
      connecting: "...",
      typeQuestion: "Ã‰crivez une question",
      ask: "Demander...",
      topics: {
        why: { label: "Pourquoi un compte ?", body: "Pour que VYVA mÃ©morise votre contexte de soin en sÃ©curitÃ©." },
        privacy: { label: "Est-ce privÃ© ?", body: "SantÃ© et mÃ©dicaments restent protÃ©gÃ©s dans votre compte." },
        family: { label: "Aide familiale", body: "La famille peut aider, mais vous contrÃ´lez le partage." },
      },
    },
    errors: {
      generic: "Une erreur est survenue. RÃ©essayez.",
      requestFailed: "Demande impossible. RÃ©essayez.",
      magicFailed: "Impossible d'envoyer le lien.",
      signInLinkFailed: "Ce lien de connexion n'a pas fonctionnÃ©.",
      noAgent: "Ajoutez ELEVENLABS_LOGIN_GUIDE_AGENT_ID pour activer ce guide.",
      noApiKey: "Le guide vocal a besoin de la clÃ© ElevenLabs.",
    },
  },
  de: {
    privateDailySupport: "Gesundheit und Wohlbefinden",
    heroTitle: "Ein Begleiter, der zuhÃ¶rt, erinnert und hilft.",
    heroSubtitle: "Sprechen Sie mit VYVA Ã¼ber Gesundheits-Check-ins, Medikamentenerinnerungen, GedÃ¤chtnisÃ¼bungen oder Hilfe bei der Tagesplanung.",
    signInHeroEyebrow: "Ihr Begleiter fÃ¼r Gesundheit und Wohlbefinden",
    signInHeroTitle: "Willkommen zurÃ¼ck bei VYVA.",
    signInHeroSubtitle: "Melden Sie sich an, um Gesundheits-Check-ins, Erinnerungen, DenkÃ¼bungen und tÃ¤gliche UnterstÃ¼tzung fortzusetzen.",
    chips: ["Stimme zuerst", "Privates Profil", "Familienbereit"],
    language: "Sprache",
    createTab: "Erstellen",
    signInTab: "Anmelden",
    titles: { register: "Konto erstellen", login: "Willkommen zurÃ¼ck", forgot: "Zugang zurÃ¼cksetzen", magic: "Magischer Link" },
    subtitles: {
      register: "Mit E-Mail oder Mobilnummer.",
      login: "Mit E-Mail oder Mobilnummer fortfahren.",
      forgot: "E-Mail eingeben, wir senden einen sicheren Link.",
      magic: "Kein Passwort nÃ¶tig.",
    },
    email: "E-Mail",
    mobile: "Mobil",
    mobileNumber: "Mobilnummer",
    password: "Passwort",
    passwordHint: "8+ Zeichen",
    forgot: "Vergessen?",
    emailPlaceholder: "du@example.com",
    phonePlaceholder: "+34 600 000 000",
    createPassword: "Passwort erstellen",
    yourPassword: "Dein Passwort",
    creating: "Erstellen...",
    signingIn: "Anmelden...",
    sending: "Senden...",
    createAccount: "Konto erstellen",
    signIn: "Anmelden",
    or: "oder",
    sendResetLink: "Link senden",
    sendMagicLink: "Magischen Link senden",
    signInWithMagicLink: "Mit magischem Link anmelden",
    continueWithGoogle: "Mit Google fortfahren",
    usePasswordInstead: "Passwort verwenden",
    profilePrivate: "Dein Profil bleibt privat.",
    privacyPolicy: "DatenschutzerklÃ¤rung",
    signupOptions: {
      call: "VYVA anrufen",
      callActive: "Anruf beenden",
      schedule: "Ruckruf planen",
      try: "VYVA testen",
    },
    setupIntentLabel: "Ich nutze VYVA",
    setupIntent: {
      self: {
        title: "FÃ¼r mich",
        subtitle: "Mein Konto und mein Pflegeprofil.",
      },
      caregiver: {
        title: "Als Betreuungsperson",
        subtitle: "Pflege fÃ¼r eine andere Person einrichten oder aufrufen.",
      },
    },
    caregiverHint: "Konten fÃ¼r Betreuungspersonen bleiben vom Pflegeprofil getrennt. Die unterstÃ¼tzte Person behÃ¤lt Kontrolle Ã¼ber Zustimmung und BestÃ¤tigung.",
    checkInbox: "Posteingang prÃ¼fen",
    resetSentBody: "Falls ein Konto existiert, ist der Link unterwegs.",
    backToSignIn: "ZurÃ¼ck zur Anmeldung",
    linkSent: "Link gesendet",
    useWithin: "Innerhalb von 15 Minuten verwenden.",
    backToPassword: "ZurÃ¼ck zum Passwort",
    alreadyHaveAccount: "Sie haben bereits ein Konto?",
    dontHaveAccount: "Noch kein Konto?",
    guide: {
      notSure: "Unsicher?",
      title: "VYVA fragen",
      helperSubtitle: "Sprich mit VYVA, wÃ¤hle eine kurze Frage oder tippe deine eigene.",
      quickAnswer: "Kurze Antwort",
      talk: "Sprechen",
      end: "Beenden",
      connecting: "...",
      typeQuestion: "Frage eingeben",
      ask: "Fragen...",
      topics: {
        why: { label: "Warum ein Konto?", body: "Damit VYVA deinen Pflegekontext sicher behalten kann." },
        privacy: { label: "Ist es privat?", body: "Gesundheit und Medikamente bleiben im Konto geschÃ¼tzt." },
        family: { label: "Familienhilfe", body: "Familie kann helfen, aber du steuerst die Freigabe." },
      },
    },
    errors: {
      generic: "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
      requestFailed: "Anfrage fehlgeschlagen. Bitte erneut versuchen.",
      magicFailed: "Link konnte nicht gesendet werden.",
      signInLinkFailed: "Dieser Anmeldelink hat nicht funktioniert.",
      noAgent: "ELEVENLABS_LOGIN_GUIDE_AGENT_ID hinzufÃ¼gen, um diesen Guide zu aktivieren.",
      noApiKey: "Der Sprachguide braucht den ElevenLabs-API-SchlÃ¼ssel.",
    },
  },
  it: {
    privateDailySupport: "Supporto salute e benessere",
    heroTitle: "Un compagno che ascolta, ricorda e aiuta.",
    heroSubtitle: "Parla con VYVA per controlli di salute, promemoria farmaci, esercizi di memoria o aiuto per organizzare la giornata.",
    signInHeroEyebrow: "La tua compagna per salute e benessere",
    signInHeroTitle: "Bentornato su VYVA.",
    signInHeroSubtitle: "Accedi per continuare con controlli di salute, promemoria, attivitÃ  mentali e supporto quotidiano.",
    chips: ["Prima la voce", "Profilo privato", "Pronto per la famiglia"],
    language: "Lingua",
    createTab: "Crea",
    signInTab: "Accedi",
    titles: { register: "Crea account", login: "Bentornato", forgot: "Recupera accesso", magic: "Link magico" },
    subtitles: {
      register: "Usa email o cellulare.",
      login: "Continua con email o cellulare.",
      forgot: "Inserisci l'email e invieremo un link sicuro.",
      magic: "Nessuna password necessaria.",
    },
    email: "Email",
    mobile: "Cellulare",
    mobileNumber: "Numero cellulare",
    password: "Password",
    passwordHint: "8+ caratteri",
    forgot: "Dimenticata?",
    emailPlaceholder: "tu@example.com",
    phonePlaceholder: "+34 600 000 000",
    createPassword: "Crea password",
    yourPassword: "La tua password",
    creating: "Creazione...",
    signingIn: "Accesso...",
    sending: "Invio...",
    createAccount: "Crea account",
    signIn: "Accedi",
    or: "o",
    sendResetLink: "Invia link",
    sendMagicLink: "Invia link magico",
    signInWithMagicLink: "Accedi con link magico",
    continueWithGoogle: "Continua con Google",
    usePasswordInstead: "Usa password",
    profilePrivate: "Il tuo profilo resta privato.",
    privacyPolicy: "Informativa sulla privacy",
    signupOptions: {
      call: "Chiama VYVA",
      callActive: "Termina chiamata",
      schedule: "Prenota richiamata",
      try: "Prova VYVA",
    },
    setupIntentLabel: "Uso VYVA",
    setupIntent: {
      self: {
        title: "Per me",
        subtitle: "Il mio account e il mio profilo di cura.",
      },
      caregiver: {
        title: "Come caregiver",
        subtitle: "Configurare o accedere alla cura per conto di un'altra persona.",
      },
    },
    caregiverHint: "Gli account caregiver restano separati dal profilo di cura. La persona assistita mantiene il controllo di consenso e conferma.",
    checkInbox: "Controlla la posta",
    resetSentBody: "Se l'account esiste, il link Ã¨ in arrivo.",
    backToSignIn: "Torna all'accesso",
    linkSent: "Link inviato",
    useWithin: "Usalo entro 15 minuti.",
    backToPassword: "Torna alla password",
    alreadyHaveAccount: "Hai giÃ  un account?",
    dontHaveAccount: "Non hai ancora un account?",
    guide: {
      notSure: "Dubbi?",
      title: "Chiedi a VYVA",
      helperSubtitle: "Parla con VYVA, scegli una domanda rapida o scrivi la tua.",
      quickAnswer: "Risposta rapida",
      talk: "Parla",
      end: "Fine",
      connecting: "...",
      typeQuestion: "Scrivi una domanda",
      ask: "Chiedi...",
      topics: {
        why: { label: "PerchÃ© un account?", body: "CosÃ¬ VYVA puÃ² ricordare il contesto di cura in sicurezza." },
        privacy: { label: "Ãˆ privato?", body: "Salute e farmaci restano protetti nell'account." },
        family: { label: "Aiuto famiglia", body: "La famiglia puÃ² aiutare, ma controlli tu cosa condividere." },
      },
    },
    errors: {
      generic: "Qualcosa Ã¨ andato storto. Riprova.",
      requestFailed: "Richiesta non riuscita. Riprova.",
      magicFailed: "Impossibile inviare il link.",
      signInLinkFailed: "Questo link di accesso non ha funzionato.",
      noAgent: "Aggiungi ELEVENLABS_LOGIN_GUIDE_AGENT_ID per attivare questa guida.",
      noApiKey: "La guida vocale richiede la chiave ElevenLabs.",
    },
  },
  pt: {
    privateDailySupport: "Apoio Ã  saÃºde e bem-estar",
    heroTitle: "Uma companhia que ouve, lembra e ajuda.",
    heroSubtitle: "Fale com a VYVA para check-ins de saÃºde, lembretes de medicaÃ§Ã£o, exercÃ­cios de memÃ³ria ou ajuda a planear o dia.",
    signInHeroEyebrow: "A sua companhia de saÃºde e bem-estar",
    signInHeroTitle: "Bem-vindo de volta Ã  VYVA.",
    signInHeroSubtitle: "Entre para continuar os check-ins de saÃºde, lembretes, atividades mentais e apoio diÃ¡rio.",
    chips: ["Voz primeiro", "Perfil privado", "Pronto para famÃ­lia"],
    language: "Idioma",
    createTab: "Criar",
    signInTab: "Entrar",
    titles: { register: "Criar conta", login: "Bem-vindo de volta", forgot: "Recuperar acesso", magic: "Link mÃ¡gico" },
    subtitles: {
      register: "Use email ou telemÃ³vel.",
      login: "Continue com email ou telemÃ³vel.",
      forgot: "Introduza o email e enviaremos um link seguro.",
      magic: "Sem palavra-passe.",
    },
    email: "Email",
    mobile: "TelemÃ³vel",
    mobileNumber: "NÃºmero de telemÃ³vel",
    password: "Palavra-passe",
    passwordHint: "8+ caracteres",
    forgot: "Esqueceu?",
    emailPlaceholder: "voce@example.com",
    phonePlaceholder: "+34 600 000 000",
    createPassword: "Criar palavra-passe",
    yourPassword: "A sua palavra-passe",
    creating: "A criar...",
    signingIn: "A entrar...",
    sending: "A enviar...",
    createAccount: "Criar conta",
    signIn: "Entrar",
    or: "ou",
    sendResetLink: "Enviar link",
    sendMagicLink: "Enviar link mÃ¡gico",
    signInWithMagicLink: "Entrar com link mÃ¡gico",
    continueWithGoogle: "Continuar com Google",
    usePasswordInstead: "Usar palavra-passe",
    profilePrivate: "O seu perfil continua privado.",
    privacyPolicy: "PolÃ­tica de privacidade",
    signupOptions: {
      call: "Ligar a VYVA",
      callActive: "Terminar chamada",
      schedule: "Agendar chamada",
      try: "Experimentar VYVA",
    },
    setupIntentLabel: "Uso a VYVA",
    setupIntent: {
      self: {
        title: "Para mim",
        subtitle: "A minha conta e o meu perfil de cuidado.",
      },
      caregiver: {
        title: "Como cuidador(a)",
        subtitle: "Configurar ou aceder ao cuidado em nome de outra pessoa.",
      },
    },
    caregiverHint: "As contas de cuidadores ficam separadas do perfil de cuidado. A pessoa apoiada mantÃ©m o controlo do consentimento e da confirmaÃ§Ã£o.",
    checkInbox: "Verifique o email",
    resetSentBody: "Se existir uma conta, o link estÃ¡ a caminho.",
    backToSignIn: "Voltar ao inÃ­cio de sessÃ£o",
    linkSent: "Link enviado",
    useWithin: "Use-o nos prÃ³ximos 15 minutos.",
    backToPassword: "Voltar Ã  palavra-passe",
    alreadyHaveAccount: "JÃ¡ tem uma conta?",
    dontHaveAccount: "Ainda nÃ£o tem uma conta?",
    guide: {
      notSure: "DÃºvidas?",
      title: "Pergunte Ã  VYVA",
      helperSubtitle: "Fale com a VYVA, escolha uma pergunta rÃ¡pida ou escreva a sua.",
      quickAnswer: "Resposta rÃ¡pida",
      talk: "Falar",
      end: "Terminar",
      connecting: "...",
      typeQuestion: "Escreva uma pergunta",
      ask: "Perguntar...",
      topics: {
        why: { label: "PorquÃª uma conta?", body: "Para a VYVA se lembrar do contexto de cuidado em seguranÃ§a." },
        privacy: { label: "Ã‰ privado?", body: "SaÃºde e medicaÃ§Ã£o ficam protegidas na sua conta." },
        family: { label: "Ajuda da famÃ­lia", body: "A famÃ­lia pode ajudar, mas a partilha Ã© controlada por si." },
      },
    },
    errors: {
      generic: "Algo correu mal. Tente novamente.",
      requestFailed: "Pedido falhou. Tente novamente.",
      magicFailed: "NÃ£o foi possÃ­vel enviar o link.",
      signInLinkFailed: "Este link de acesso nÃ£o funcionou.",
      noAgent: "Adicione ELEVENLABS_LOGIN_GUIDE_AGENT_ID para ativar este guia.",
      noApiKey: "O guia de voz precisa da chave ElevenLabs.",
    },
  },
};

const CALLBACK_MODAL_COPY = {
  en: {
    eyebrow: "Callback request",
    title: "Schedule a call with VYVA",
    subtitle: "Tell us who the call is for and where to reach you.",
    firstName: "First name",
    firstNamePlaceholder: "e.g. Margaret",
    lastName: "Last name",
    lastNamePlaceholder: "e.g. Collins",
    phone: "Phone number",
    phonePlaceholder: "e.g. +44 7123 456789",
    callFor: "Who is this call for?",
    options: {
      elder: { title: "For the older adult directly", subtitle: "VYVA will speak with the person receiving support." },
      caregiver: { title: "For a caregiver or family member", subtitle: "VYVA will speak with someone helping arrange care." },
    },
    cancel: "Cancel",
    submit: "Request callback",
    error: "Please add a full name and phone number.",
  },
  es: {
    eyebrow: "Solicitud de llamada",
    title: "Programa una llamada con VYVA",
    subtitle: "Dinos para quiÃ©n es la llamada y dÃ³nde podemos contactar.",
    fullName: "Nombre completo",
    fullNamePlaceholder: "p. ej. Margaret Collins",
    phone: "NÃºmero de telÃ©fono",
    phonePlaceholder: "p. ej. +34 612 345 678",
    callFor: "Â¿Para quiÃ©n es esta llamada?",
    options: {
      elder: { title: "Para la persona mayor directamente", subtitle: "VYVA hablarÃ¡ con la persona que recibirÃ¡ apoyo." },
      caregiver: { title: "Para cuidador/a o familiar", subtitle: "VYVA hablarÃ¡ con alguien que ayuda a organizar el cuidado." },
    },
    cancel: "Cancelar",
    submit: "Solicitar llamada",
    error: "AÃ±ade nombre completo y telÃ©fono.",
  },
  fr: {
    eyebrow: "Demande de rappel",
    title: "Planifier un appel avec VYVA",
    subtitle: "Indiquez pour qui est l'appel et oÃ¹ vous joindre.",
    fullName: "Nom complet",
    fullNamePlaceholder: "ex. Margaret Collins",
    phone: "NumÃ©ro de tÃ©lÃ©phone",
    phonePlaceholder: "ex. +33 6 12 34 56 78",
    callFor: "Pour qui est cet appel ?",
    options: {
      elder: { title: "Pour la personne Ã¢gÃ©e directement", subtitle: "VYVA parlera avec la personne accompagnÃ©e." },
      caregiver: { title: "Pour un aidant ou un membre de la famille", subtitle: "VYVA parlera avec la personne qui organise l'aide." },
    },
    cancel: "Annuler",
    submit: "Demander un rappel",
    error: "Ajoutez un nom complet et un numÃ©ro de tÃ©lÃ©phone.",
  },
  de: {
    eyebrow: "Ruckrufanfrage",
    title: "Anruf mit VYVA planen",
    subtitle: "Sagen Sie uns, fur wen der Anruf ist und wie wir Sie erreichen.",
    fullName: "Vollstandiger Name",
    fullNamePlaceholder: "z. B. Margaret Collins",
    phone: "Telefonnummer",
    phonePlaceholder: "z. B. +49 151 23456789",
    callFor: "Fur wen ist dieser Anruf?",
    options: {
      elder: { title: "Direkt fur die altere Person", subtitle: "VYVA spricht mit der Person, die Unterstutzung erhalt." },
      caregiver: { title: "Fur Betreuungsperson oder Familie", subtitle: "VYVA spricht mit jemandem, der die Betreuung organisiert." },
    },
    cancel: "Abbrechen",
    submit: "Ruckruf anfragen",
    error: "Bitte vollstandigen Namen und Telefonnummer eingeben.",
  },
  it: {
    eyebrow: "Richiesta di richiamata",
    title: "Prenota una chiamata con VYVA",
    subtitle: "Dicci per chi e la chiamata e dove possiamo contattarti.",
    fullName: "Nome completo",
    fullNamePlaceholder: "es. Margaret Collins",
    phone: "Numero di telefono",
    phonePlaceholder: "es. +39 312 345 6789",
    callFor: "Per chi e questa chiamata?",
    options: {
      elder: { title: "Direttamente per la persona anziana", subtitle: "VYVA parlera con la persona che riceve supporto." },
      caregiver: { title: "Per caregiver o familiare", subtitle: "VYVA parlera con chi aiuta a organizzare la cura." },
    },
    cancel: "Annulla",
    submit: "Richiedi richiamata",
    error: "Aggiungi nome completo e numero di telefono.",
  },
  pt: {
    eyebrow: "Pedido de chamada",
    title: "Agendar uma chamada com a VYVA",
    subtitle: "Diga-nos para quem e a chamada e onde podemos contactar.",
    fullName: "Nome completo",
    fullNamePlaceholder: "ex. Margaret Collins",
    phone: "Numero de telefone",
    phonePlaceholder: "ex. +351 912 345 678",
    callFor: "Para quem e esta chamada?",
    options: {
      elder: { title: "Para a pessoa mais velha diretamente", subtitle: "A VYVA falara com a pessoa que recebe apoio." },
      caregiver: { title: "Para cuidador ou familiar", subtitle: "A VYVA falara com quem ajuda a organizar o cuidado." },
    },
    cancel: "Cancelar",
    submit: "Pedir chamada",
    error: "Adicione nome completo e numero de telefone.",
  },
} satisfies Record<
  LanguageCode,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
    firstName: string;
    firstNamePlaceholder: string;
    lastName: string;
    lastNamePlaceholder: string;
    phone: string;
    phonePlaceholder: string;
    callFor: string;
    options: Record<"elder" | "caregiver", { title: string; subtitle: string }>;
    cancel: string;
    submit: string;
    error: string;
  }
>;

const FRIENDLY_CALLBACK_MODAL_COPY = {
  en: {
    eyebrow: "Callback request",
    title: "Schedule a call with VYVA",
    subtitle: "Tell us who the call is for and when we should reach you.",
    requiredNote: "All fields are required.",
    firstName: "First name",
    firstNamePlaceholder: "e.g. Margaret",
    lastName: "Last name",
    lastNamePlaceholder: "e.g. Collins",
    countryCode: "Country code",
    phone: "Phone number",
    phonePlaceholder: "7123 456789",
    date: "Preferred date",
    time: "Preferred time",
    callFor: "Who is this call for?",
    options: {
      me: { title: "For me", subtitle: "I would like VYVA to call me directly." },
      caregiver: { title: "For someone I care for", subtitle: "I am a caregiver or family member helping arrange support." },
    },
    cancel: "Cancel",
    submit: "Request callback",
    submitting: "Scheduling...",
    successTitle: "Callback scheduled",
    successBody: "VYVA will call at your selected time. The voice agent will ask a few setup questions, then send your secure confirmation link by email or WhatsApp based on your preference.",
    closeSuccess: "Done",
    error: "Please add a first name, last name, phone number, date, and time.",
  },
  es: {
    eyebrow: "Solicitud de llamada",
    title: "Programa una llamada con VYVA",
    subtitle: "Dinos para quien es la llamada y cuando podemos contactar.",
    requiredNote: "Todos los campos son obligatorios.",
    firstName: "Nombre",
    firstNamePlaceholder: "p. ej. Margaret",
    lastName: "Apellido",
    lastNamePlaceholder: "p. ej. Collins",
    countryCode: "Codigo de pais",
    phone: "Numero de telefono",
    phonePlaceholder: "612 345 678",
    date: "Fecha preferida",
    time: "Hora preferida",
    callFor: "Para quien es esta llamada?",
    options: {
      me: { title: "Para mi", subtitle: "Quiero que VYVA me llame directamente." },
      caregiver: { title: "Para alguien a quien cuido", subtitle: "Soy cuidador/a o familiar y ayudo a organizar el apoyo." },
    },
    cancel: "Cancelar",
    submit: "Solicitar llamada",
    submitting: "Programando...",
    successTitle: "Llamada programada",
    successBody: "VYVA llamara a la hora elegida. El agente de voz hara unas preguntas de configuracion y despues enviara tu enlace seguro por email o WhatsApp, segun tu preferencia.",
    closeSuccess: "Listo",
    error: "Anade nombre, apellido, telefono, fecha y hora.",
  },
  fr: {
    eyebrow: "Demande de rappel",
    title: "Planifier un appel avec VYVA",
    subtitle: "Indiquez pour qui est l'appel et quand vous joindre.",
    requiredNote: "Tous les champs sont obligatoires.",
    firstName: "Prenom",
    firstNamePlaceholder: "ex. Margaret",
    lastName: "Nom",
    lastNamePlaceholder: "ex. Collins",
    countryCode: "Indicatif",
    phone: "Numero de telephone",
    phonePlaceholder: "6 12 34 56 78",
    date: "Date preferee",
    time: "Heure preferee",
    callFor: "Pour qui est cet appel ?",
    options: {
      me: { title: "Pour moi", subtitle: "Je souhaite que VYVA m'appelle directement." },
      caregiver: { title: "Pour une personne que j'aide", subtitle: "Je suis aidant ou membre de la famille et j'organise le soutien." },
    },
    cancel: "Annuler",
    submit: "Demander un rappel",
    submitting: "Planification...",
    successTitle: "Rappel planifie",
    successBody: "VYVA appellera a l'heure choisie. L'agent vocal posera quelques questions de configuration, puis enverra votre lien securise par e-mail ou WhatsApp selon votre preference.",
    closeSuccess: "Termine",
    error: "Ajoutez un prenom, un nom, un telephone, une date et une heure.",
  },
  de: {
    eyebrow: "Ruckrufanfrage",
    title: "Anruf mit VYVA planen",
    subtitle: "Sagen Sie uns, fur wen der Anruf ist und wann wir Sie erreichen.",
    requiredNote: "Alle Felder sind erforderlich.",
    firstName: "Vorname",
    firstNamePlaceholder: "z. B. Margaret",
    lastName: "Nachname",
    lastNamePlaceholder: "z. B. Collins",
    countryCode: "Landervorwahl",
    phone: "Telefonnummer",
    phonePlaceholder: "151 23456789",
    date: "Wunschdatum",
    time: "Wunschzeit",
    callFor: "Fur wen ist dieser Anruf?",
    options: {
      me: { title: "Fur mich", subtitle: "Ich mochte, dass VYVA mich direkt anruft." },
      caregiver: { title: "Fur jemanden, um den ich mich kummere", subtitle: "Ich helfe als Familie oder Betreuungsperson bei der Einrichtung." },
    },
    cancel: "Abbrechen",
    submit: "Ruckruf anfragen",
    submitting: "Wird geplant...",
    successTitle: "Ruckruf geplant",
    successBody: "VYVA ruft zur gewahlten Zeit an. Der Sprachagent stellt einige Einrichtungsfragen und sendet danach den sicheren Link per E-Mail oder WhatsApp, je nach Wunsch.",
    closeSuccess: "Fertig",
    error: "Bitte Vorname, Nachname, Telefonnummer, Datum und Uhrzeit eingeben.",
  },
  it: {
    eyebrow: "Richiesta di richiamata",
    title: "Prenota una chiamata con VYVA",
    subtitle: "Dicci per chi e la chiamata e quando possiamo contattarti.",
    requiredNote: "Tutti i campi sono obbligatori.",
    firstName: "Nome",
    firstNamePlaceholder: "es. Margaret",
    lastName: "Cognome",
    lastNamePlaceholder: "es. Collins",
    countryCode: "Prefisso",
    phone: "Numero di telefono",
    phonePlaceholder: "312 345 6789",
    date: "Data preferita",
    time: "Ora preferita",
    callFor: "Per chi e questa chiamata?",
    options: {
      me: { title: "Per me", subtitle: "Vorrei che VYVA mi chiamasse direttamente." },
      caregiver: { title: "Per qualcuno di cui mi prendo cura", subtitle: "Sono caregiver o familiare e aiuto a organizzare il supporto." },
    },
    cancel: "Annulla",
    submit: "Richiedi richiamata",
    submitting: "Programmazione...",
    successTitle: "Richiamata programmata",
    successBody: "VYVA chiamera all'orario scelto. L'agente vocale fara alcune domande di configurazione e poi inviera il link sicuro via email o WhatsApp, in base alla preferenza.",
    closeSuccess: "Fatto",
    error: "Aggiungi nome, cognome, telefono, data e ora.",
  },
  pt: {
    eyebrow: "Pedido de chamada",
    title: "Agendar uma chamada com a VYVA",
    subtitle: "Diga-nos para quem e a chamada e quando podemos contactar.",
    requiredNote: "Todos os campos sao obrigatorios.",
    firstName: "Nome",
    firstNamePlaceholder: "ex. Margaret",
    lastName: "Apelido",
    lastNamePlaceholder: "ex. Collins",
    countryCode: "Indicativo",
    phone: "Numero de telefone",
    phonePlaceholder: "912 345 678",
    date: "Data preferida",
    time: "Hora preferida",
    callFor: "Para quem e esta chamada?",
    options: {
      me: { title: "Para mim", subtitle: "Quero que a VYVA me ligue diretamente." },
      caregiver: { title: "Para alguem de quem cuido", subtitle: "Sou cuidador ou familiar e ajudo a organizar o apoio." },
    },
    cancel: "Cancelar",
    submit: "Pedir chamada",
    submitting: "A agendar...",
    successTitle: "Chamada agendada",
    successBody: "A VYVA ligara na hora escolhida. O agente de voz fara algumas perguntas de configuracao e depois enviara o link seguro por email ou WhatsApp, conforme a preferencia.",
    closeSuccess: "Concluido",
    error: "Adicione nome, apelido, telefone, data e hora.",
  },
} satisfies Record<
  LanguageCode,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
    requiredNote: string;
    firstName: string;
    firstNamePlaceholder: string;
    lastName: string;
    lastNamePlaceholder: string;
    countryCode: string;
    phone: string;
    phonePlaceholder: string;
    date: string;
    time: string;
    callFor: string;
    options: Record<CallbackFor, { title: string; subtitle: string }>;
    cancel: string;
    submit: string;
    submitting: string;
    successTitle: string;
    successBody: string;
    closeSuccess: string;
    error: string;
  }
>;

const CALL_MODAL_COPY = {
  en: {
    eyebrow: "Call VYVA",
    title: "Call VYVA",
    subtitle: "Confirm your country and we will show the right VYVA number to call.",
    country: "Country calling from",
    numberLabel: "Your VYVA number",
    cancel: "Cancel",
    confirm: "Show number",
    callNow: "Call now",
    changeCountry: "Change country",
  },
  es: {
    eyebrow: "Llamar a VYVA",
    title: "Llama a VYVA",
    subtitle: "Confirma tu pais y te mostraremos el numero correcto de VYVA.",
    country: "Pais desde el que llamas",
    numberLabel: "Tu numero VYVA",
    cancel: "Cancelar",
    confirm: "Mostrar numero",
    callNow: "Llamar ahora",
    changeCountry: "Cambiar pais",
  },
  fr: {
    eyebrow: "Appeler VYVA",
    title: "Appeler VYVA",
    subtitle: "Confirmez votre pays et nous afficherons le bon numero VYVA.",
    country: "Pays d'appel",
    numberLabel: "Votre numero VYVA",
    cancel: "Annuler",
    confirm: "Afficher le numero",
    callNow: "Appeler maintenant",
    changeCountry: "Changer de pays",
  },
  de: {
    eyebrow: "VYVA anrufen",
    title: "VYVA anrufen",
    subtitle: "Bestatigen Sie Ihr Land und wir zeigen die passende VYVA Nummer.",
    country: "Land des Anrufs",
    numberLabel: "Ihre VYVA Nummer",
    cancel: "Abbrechen",
    confirm: "Nummer anzeigen",
    callNow: "Jetzt anrufen",
    changeCountry: "Land andern",
  },
  it: {
    eyebrow: "Chiama VYVA",
    title: "Chiama VYVA",
    subtitle: "Conferma il tuo paese e ti mostreremo il numero VYVA corretto.",
    country: "Paese da cui chiami",
    numberLabel: "Il tuo numero VYVA",
    cancel: "Annulla",
    confirm: "Mostra numero",
    callNow: "Chiama ora",
    changeCountry: "Cambia paese",
  },
  pt: {
    eyebrow: "Ligar a VYVA",
    title: "Ligar a VYVA",
    subtitle: "Confirme o seu pais e mostraremos o numero VYVA correto.",
    country: "Pais de onde liga",
    numberLabel: "O seu numero VYVA",
    cancel: "Cancelar",
    confirm: "Mostrar numero",
    callNow: "Ligar agora",
    changeCountry: "Alterar pais",
  },
} satisfies Record<
  LanguageCode,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
    country: string;
    numberLabel: string;
    cancel: string;
    confirm: string;
    callNow: string;
    changeCountry: string;
  }
>;

function createLoginGuideConversationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `login-guide-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function audienceCopyFor({
  audience,
  activeView,
  isCareTeamInviteAuth,
  isPasswordFreeSignIn,
  language,
  copy,
}: {
  audience: AuthAudience;
  activeView: View;
  isCareTeamInviteAuth: boolean;
  isPasswordFreeSignIn: boolean;
  language: LanguageCode;
  copy: LoginCopy;
}): AudienceCopy {
  const isSpanish = language === "es";
  const viewIsRegister = activeView === "register";
  const viewIsLogin = activeView === "login";

  if (audience === "admin") {
    return {
      routeLabel: "Admin",
      headerTagline: "Administration",
      heroEyebrow: "VYVA Admin",
      heroTitle: isSpanish ? "Acceso seguro al panel operativo." : "Secure access for operations.",
      heroSubtitle: isSpanish
        ? "Usa una cuenta aprobada para gestionar usuarios, contenidos y revisiones."
        : "Use an approved admin account to manage users, content, and review workflows.",
      authTitle: "Admin sign in",
      authSubtitle: "Restricted workspace for the VYVA team.",
      trustItems: [
        "Role checks are enforced after sign-in.",
        "Admin activity stays logged for review.",
      ],
      intentLabel: "",
      memberDoor: "",
      memberDoorSubtitle: "",
      caregiverDoor: "",
      caregiverDoorSubtitle: "",
      caregiverNoteTitle: "Secure zone",
      caregiverNoteBody: "Administrative actions are protected by account role and audit history.",
      switchMember: "",
      switchCaregiver: "",
      secureFooter: "Restricted admin workspace.",
    };
  }

  if (audience === "caregiver") {
    return {
      routeLabel: isSpanish ? "Cuidador/a" : "Caregiver",
      headerTagline: isSpanish ? "Cuidamos juntos" : "Care together",
      heroEyebrow: isCareTeamInviteAuth
        ? isSpanish ? "Invitacion de equipo de cuidado" : "Care team invitation"
        : isSpanish ? "VYVA para cuidadores" : "VYVA for caregivers",
      heroTitle: isSpanish ? "Ayuda a quien mas quieres, juntos." : "Help someone you care for, together.",
      heroSubtitle: isSpanish
        ? "Coordina recordatorios, bienestar y apoyo diario sin entrar en la cuenta de la persona cuidada."
        : "Coordinate reminders, wellbeing, and daily support without taking over the cared person's account.",
      authTitle: viewIsLogin
        ? isSpanish ? "Entrar como cuidador/a" : "Caregiver sign in"
        : viewIsRegister
          ? isSpanish ? "Crear cuenta de cuidador/a" : "Create caregiver account"
          : copy.titles[activeView],
      authSubtitle: isPasswordFreeSignIn
        ? isSpanish ? "Te enviaremos un enlace seguro al email." : "We will send a secure link to your email."
        : isCareTeamInviteAuth
          ? isSpanish
            ? "Usa el mismo email o movil de la invitacion."
            : "Use the same email or mobile number from the invitation."
          : isSpanish
            ? "Tu cuenta queda separada del perfil de la persona cuidada."
            : "Your account stays separate from the cared person's profile.",
      trustItems: [
        isSpanish ? "La persona cuidada conserva el control." : "The cared person keeps consent and control.",
        isSpanish ? "Puedes aceptar invitaciones y ver solo lo compartido." : "Accept invites and see only what is shared.",
      ],
      intentLabel: isSpanish ? "Elige el tipo de cuenta" : "Choose account type",
      memberDoor: isSpanish ? "Para mi" : "For me",
      memberDoorSubtitle: isSpanish ? "Mi cuenta personal" : "My personal account",
      caregiverDoor: isSpanish ? "Para alguien a quien cuido" : "For someone I care for",
      caregiverDoorSubtitle: isSpanish ? "Soy cuidador/a" : "I am a caregiver",
      caregiverNoteTitle: isCareTeamInviteAuth
        ? isSpanish ? "Estas aceptando una invitacion" : "You are accepting an invitation"
        : isSpanish ? "Cuenta de cuidador/a" : "Caregiver account",
      caregiverNoteBody: isCareTeamInviteAuth
        ? isSpanish
          ? "Despues de entrar o crear la cuenta, volveras a la invitacion para aceptar el acceso."
          : "After you sign in or create the account, you will return to the invitation to accept access."
        : isSpanish
          ? "Despues podras aceptar invitaciones y acompanar a otra persona desde tu propio acceso."
          : "You can accept invitations and support another person from your own login.",
      switchMember: isSpanish ? "Ir a cuenta personal" : "Use member login",
      switchCaregiver: isSpanish ? "Ir a cuidador/a" : "Use caregiver login",
      secureFooter: isSpanish ? "Tu acceso de cuidador/a queda separado." : "Your caregiver access stays separate.",
    };
  }

  return {
    routeLabel: isSpanish ? "Usuario" : "Member",
    headerTagline: isSpanish ? "Tu companera de salud y bienestar" : "Your health and wellbeing companion",
    heroEyebrow: viewIsRegister ? copy.privateDailySupport : copy.signInHeroEyebrow,
    heroTitle: viewIsRegister ? copy.heroTitle : copy.signInHeroTitle,
    heroSubtitle: viewIsRegister ? copy.heroSubtitle : copy.signInHeroSubtitle,
    authTitle: viewIsRegister ? copy.createTab : viewIsLogin ? copy.signInTab : copy.titles[activeView],
    authSubtitle: isPasswordFreeSignIn ? copy.subtitles.forgot : copy.subtitles[activeView],
    trustItems: [
      copy.guide.topics.privacy.body,
      copy.guide.topics.family.body,
    ],
    intentLabel: isSpanish ? "Elige el tipo de cuenta" : "Choose account type",
    memberDoor: isSpanish ? "Para mi" : "For me",
    memberDoorSubtitle: isSpanish ? "Mi cuenta personal" : "My personal account",
    caregiverDoor: isSpanish ? "Para alguien a quien cuido" : "For someone I care for",
    caregiverDoorSubtitle: isSpanish ? "Soy cuidador/a" : "I am a caregiver",
    caregiverNoteTitle: isSpanish ? "Cuenta de cuidador/a" : "Caregiver account",
    caregiverNoteBody: copy.caregiverHint,
    switchMember: isSpanish ? "Ir a cuenta personal" : "Use member login",
    switchCaregiver: isSpanish ? "Ir a cuidador/a" : "Use caregiver login",
    secureFooter: copy.profilePrivate,
  };
}

export default function LoginPage({ adminOnly = false }: { adminOnly?: boolean }) {
  const { login, register, requestMagicLink, loginWithMagicToken, user, isLoading } = useAuth();
  const { language, setLanguage, languages } = useLanguage();
  const copy = LOGIN_COPY[language] ?? LOGIN_COPY.es;
  const callbackCopy = FRIENDLY_CALLBACK_MODAL_COPY[language] ?? FRIENDLY_CALLBACK_MODAL_COPY.en;
  const callCopy = CALL_MODAL_COPY[language] ?? CALL_MODAL_COPY.en;
  const {
    startVoice,
    stopVoice,
    status: guideVoiceStatus,
    isSpeaking: isGuideSpeaking,
    isConnecting: isGuideConnecting,
    lastError: guideVoiceError,
    lastErrorCode: guideVoiceErrorCode,
    transcript: guideTranscript,
    voiceSessionPhase: guideVoiceSessionPhase,
    isMicMuted: isGuideMicMuted,
    setMicrophoneMuted: setGuideMicrophoneMuted,
  } = useVyvaVoice();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isCaregiverEntryRoute =
    !adminOnly && (location.pathname === "/caregiver/login" || location.pathname === "/caregiver/register");
  const routeAuthMode = location.pathname === "/caregiver/login"
    ? "login"
    : location.pathname === "/caregiver/register"
      ? "register"
      : null;
  const rawFrom = (location.state as { from?: string })?.from;
  const from = adminOnly ? "/admin/lifecycle" : normalizeReturnPath(rawFrom);
  const requestedAuthMode = searchParams.get("mode") === "login" ? "login" : "register";
  const initialAuthMode = adminOnly ? "login" : routeAuthMode ?? requestedAuthMode;
  const explicitInviteReturnPath = adminOnly ? null : inviteReturnPathFromSearch(location.search);
  const storedCareTeamInviteReturnPath = adminOnly ? null : currentCareTeamInviteReturnPath();
  const inviteReturnPath = explicitInviteReturnPath ?? storedCareTeamInviteReturnPath;
  const isCareTeamInviteAuth = isCareTeamInviteReturnPath(inviteReturnPath);
  const initialSetupIntent =
    isCareTeamInviteAuth || isCaregiverEntryRoute || setupIntentFromParams(searchParams) === "caregiver"
      ? "caregiver"
      : "self";

  const [mode, setMode] = useState<"login" | "register">(initialAuthMode);
  const [view, setView] = useState<View>(initialAuthMode);
  const [setupIntent, setSetupIntent] = useState<SetupIntent>(initialSetupIntent);
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPasswordSignIn, setShowPasswordSignIn] = useState(initialAuthMode === "login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guideTopic: GuideTopic = "why";
  const [guideSessionMode, setGuideSessionMode] = useState<"voice" | "text" | null>(null);
  const magicTokenHandledRef = useRef(false);
  const contactInputRef = useRef<HTMLInputElement>(null);
  const callbackNameInputRef = useRef<HTMLInputElement>(null);

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotDevResetLink, setForgotDevResetLink] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicError, setMagicError] = useState<string | null>(null);
  const [isCallbackModalOpen, setIsCallbackModalOpen] = useState(false);
  const [callbackFirstName, setCallbackFirstName] = useState("");
  const [callbackLastName, setCallbackLastName] = useState("");
  const [callbackCountryCode, setCallbackCountryCode] = useState("+34");
  const [callbackPhone, setCallbackPhone] = useState("");
  const [callbackFor, setCallbackFor] = useState<CallbackFor>("me");
  const [callbackDate, setCallbackDate] = useState("");
  const [callbackTime, setCallbackTime] = useState("");
  const [callbackPeriod, setCallbackPeriod] = useState<CallbackPeriod>("AM");
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const [callbackLoading, setCallbackLoading] = useState(false);
  const [callbackScheduledFor, setCallbackScheduledFor] = useState<string | null>(null);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [callCountry, setCallCountry] = useState("ES");
  const [callConfirmed, setCallConfirmed] = useState(false);

  const switchTab = (tab: "login" | "register") => {
    if (adminOnly && tab === "register") return;
    setMode(tab);
    setView(tab);
    setError(null);
    setMagicError(null);
    setShowPasswordSignIn(false);
    if (isCaregiverEntryRoute) {
      const nextPath = tab === "login" ? "/caregiver/login" : "/caregiver/register";
      navigate(`${nextPath}${location.search}`, { replace: true });
    }
  };

  const showForgot = () => {
    setForgotEmail(contact.trim().includes("@") ? contact : "");
    setForgotSent(false);
    setForgotError(null);
    setForgotDevResetLink(null);
    setView("forgot");
  };

  const authContactPayload = (includeLanguage = false) => {
    const trimmedContact = contact.trim();
    const inviteId = includeLanguage ? currentSignupInviteId(location.search) : null;
    const careTeamInviteToken = includeLanguage ? careTeamInviteTokenFromReturnPath(inviteReturnPath) : null;
    return {
      ...(trimmedContact.includes("@") ? { email: trimmedContact } : { phone: trimmedContact }),
      ...(includeLanguage ? { language } : {}),
      ...(inviteId ? { invite_id: inviteId } : {}),
      ...(careTeamInviteToken ? { care_team_invite_token: careTeamInviteToken } : {}),
    };
  };

  const rememberSetupIntent = () => {
    const setupFor = isCareTeamInviteAuth || setupIntent === "caregiver" ? "someone_else" : "self";
    window.sessionStorage.setItem("vyva_setup_for", setupFor);
    return setupFor;
  };

  useEffect(() => {
    if (isCareTeamInviteAuth || isCaregiverEntryRoute) setSetupIntent("caregiver");
  }, [isCareTeamInviteAuth, isCaregiverEntryRoute]);

  useEffect(() => {
    if (adminOnly || isCareTeamInviteAuth || isCaregiverEntryRoute) return;
    const setupIntentParam = setupIntentFromParams(new URLSearchParams(location.search));
    if (!setupIntentParam && location.pathname === "/login") setSetupIntent("self");
  }, [adminOnly, isCareTeamInviteAuth, isCaregiverEntryRoute, location.pathname, location.search]);

  useEffect(() => {
    if (isCareTeamInviteAuth) rememberCareTeamInviteReturnPath(inviteReturnPath);
  }, [inviteReturnPath, isCareTeamInviteAuth]);

  useEffect(() => {
    const setupParams = setupInviteParamsFromPath(from) ?? setupInviteParamsFromSearch(location.search);
    if (!setupParams) return;
    const setupLanguage = setupLanguageFromParams(setupParams);
    if (setupLanguage && setupLanguage !== language) setBootstrapLanguage(setupLanguage);
    const setupIntentParam = setupIntentFromParams(setupParams);
    if (setupIntentParam && setupIntentParam !== setupIntent) setSetupIntent(setupIntentParam);
    if (!contact.trim()) {
      const setupContact = setupContactFromParams(setupParams);
      if (setupContact) setContact(setupContact);
    }
  }, [contact, from, language, location.search, setupIntent]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (adminOnly) {
      navigate("/admin/lifecycle", { replace: true });
      return;
    }
    const inviteDestination = safeReturnPathForActiveProfile(inviteReturnPath, user);
    if (inviteDestination) {
      navigate(inviteDestination, { replace: true });
      return;
    }
    if (user.needsProfileSelection) {
      navigate("/profiles/select", { replace: true });
      return;
    }
    if (user.needsProfileSetup) {
      navigate("/onboarding/who-for", { replace: true });
      return;
    }
    const returnDestination = safeReturnPathForActiveProfile(from, user);
    if (returnDestination) {
      navigate(returnDestination, { replace: true });
      return;
    }
    if (isCaregiverRoutingUser(user)) {
      navigate(defaultSignedInRoute(user), { replace: true });
      return;
    }
    queryClient
      .fetchQuery({ queryKey: ["/api/onboarding/state"] })
      .then((data: { onboardingState?: { current_stage?: string }; profile?: { current_stage?: string } }) => {
        const stage = data?.onboardingState?.current_stage ?? data?.profile?.current_stage;
        navigate(routeAfterOnboardingStage(stage, user), { replace: true });
      })
      .catch(() => navigate("/onboarding/basics", { replace: true }));
  }, [adminOnly, from, inviteReturnPath, isLoading, user, navigate]);

  useEffect(() => {
    if (magicTokenHandledRef.current || user) return;
    const magicToken = new URLSearchParams(location.search).get("magic_token");
    if (!magicToken) return;

    magicTokenHandledRef.current = true;
    setView("magic");
    setMode("login");
    setMagicLoading(true);
    setMagicError(null);
    loginWithMagicToken(magicToken)
      .catch((err) => {
        setMagicError(localizeAuthErrorMessage(err, language, copy.errors.signInLinkFailed));
      })
      .finally(() => setMagicLoading(false));
  }, [copy.errors.signInLinkFailed, language, location.search, loginWithMagicToken, user]);

  useEffect(() => () => stopVoice(), [stopVoice]);

  useEffect(() => {
    if (!adminOnly) return;
    setMode("login");
    setView("login");
    setShowPasswordSignIn(true);
  }, [adminOnly]);

  useEffect(() => {
    if (!routeAuthMode) return;
    setMode(routeAuthMode);
    setView(routeAuthMode);
    setShowPasswordSignIn(routeAuthMode === "login");
  }, [routeAuthMode]);

  const startLoginGuide = useCallback(async (options?: { textOnly?: boolean }) => {
    const textOnly = options?.textOnly ?? false;
    const conversationId = createLoginGuideConversationId();
    setGuideSessionMode(textOnly ? "text" : "voice");
    await startVoice("login guide", LOGIN_GUIDE_PROMPT, {
      agentSlug: LOGIN_GUIDE_AGENT_SLUG,
      skipMicrophone: textOnly,
      autoStartListening: !textOnly,
      dynamicVariables: {
        first_name: "there",
        user_id: "anonymous-login-visitor",
        conversation_id: conversationId,
        language,
        page_context: "The visitor is on VYVA's login, sign-in, and account creation page.",
        current_view: view,
        auth_mode: mode,
        selected_topic: copy.guide.topics[guideTopic].label,
      },
    });
  }, [copy.guide.topics, guideTopic, language, mode, startVoice, view]);

  useEffect(() => {
    if (guideVoiceStatus === "idle" && !isGuideConnecting && !guideVoiceError) {
      setGuideSessionMode(null);
    }
  }, [guideVoiceError, guideVoiceStatus, isGuideConnecting]);

  useEffect(() => {
    if (!isCallbackModalOpen) return;
    window.requestAnimationFrame(() => callbackNameInputRef.current?.focus());
  }, [isCallbackModalOpen]);

  useEffect(() => {
    const browserCountry = inferCountryFromBrowser();
    setCallCountry(browserCountry);
    setCallbackCountryCode(COUNTRY_TO_DIAL[browserCountry] ?? "+34");
  }, []);

  if (isLoading || user) return null;

  const handleSubmit = async () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        if (adminOnly) {
          throw new Error("Admin accounts can only be created by the super admin after sign in.");
        }
        const setupFor = rememberSetupIntent();
        const inviteId = currentSignupInviteId(location.search);
        trackSignupInviteEvent(inviteId, "profile_started", { destination: "/", keepalive: true });
        const registeredUser = await register({ ...authContactPayload(true), setup_for: setupFor }, password);
        const inviteDestination = safeReturnPathForActiveProfile(inviteReturnPath, registeredUser);
        const returnDestination = safeReturnPathForActiveProfile(from, registeredUser);
        if (inviteDestination) {
          navigate(inviteDestination, { replace: true });
        } else if (returnDestination) {
          navigate(returnDestination, { replace: true });
        } else {
          navigate(setupFor === "someone_else" ? "/onboarding/proxy-setup" : "/onboarding/basics", {
            replace: true,
            state: { setupFor },
          });
        }
      } else {
        const signedInUser = await login(authContactPayload(), password);
        const inviteDestination = safeReturnPathForActiveProfile(inviteReturnPath, signedInUser);
        const returnDestination = safeReturnPathForActiveProfile(from, signedInUser);
        if (inviteDestination) {
          navigate(inviteDestination, { replace: true });
        } else if (returnDestination) {
          navigate(returnDestination, { replace: true });
        } else if (isCaregiverRoutingUser(signedInUser)) {
          navigate(defaultSignedInRoute(signedInUser), { replace: true });
        } else {
          const data = await queryClient.fetchQuery({ queryKey: ["/api/onboarding/state"] }).catch(() => null);
          const stage =
            (data as { onboardingState?: { current_stage?: string }; profile?: { current_stage?: string } } | null)
              ?.onboardingState?.current_stage ??
            (data as { onboardingState?: { current_stage?: string }; profile?: { current_stage?: string } } | null)
              ?.profile?.current_stage;
          navigate(routeAfterOnboardingStage(stage, signedInUser), { replace: true });
        }
      }
    } catch (err) {
      setError(localizeAuthErrorMessage(err, language, copy.errors.generic));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (forgotLoading) return;
    setForgotError(null);
    setForgotDevResetLink(null);
    setForgotLoading(true);
    try {
      const email = forgotEmail.trim();
      const res = await fetch("/api/auth/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => null) as {
        error?: string;
        message?: string;
        _devResetLink?: unknown;
      } | null;
      if (!res.ok) {
        throw new Error(body?.message || body?.error || copy.errors.requestFailed);
      }
      setForgotDevResetLink(typeof body?._devResetLink === "string" ? resetLinkForCurrentOrigin(body._devResetLink) : null);
      setForgotSent(true);
    } catch (err) {
      setForgotError(localizeAuthErrorMessage(err, language, copy.errors.generic));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (magicLoading) return;
    setMagicError(null);
    setMagicLoading(true);
    try {
      await requestMagicLink(authContactPayload());
      setMagicSent(true);
    } catch (err) {
      setMagicError(localizeAuthErrorMessage(err, language, copy.errors.magicFailed));
    } finally {
      setMagicLoading(false);
    }
  };

  const openCallModal = () => {
    setCallConfirmed(false);
    setIsCallModalOpen(true);
  };

  const closeCallModal = () => {
    setCallConfirmed(false);
    setIsCallModalOpen(false);
  };

  const handleCallSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCallConfirmed(true);
  };

  const openCallbackModal = () => {
    setCallbackError(null);
    setCallbackScheduledFor(null);
    setIsCallbackModalOpen(true);
  };

  const closeCallbackModal = () => {
    setCallbackError(null);
    setCallbackLoading(false);
    setCallbackScheduledFor(null);
    setIsCallbackModalOpen(false);
  };

  const handleCallbackSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (callbackLoading) return;
    const firstName = callbackFirstName.trim();
    const lastName = callbackLastName.trim();
    const phone = callbackPhone.trim();
    const preferredDate = callbackDate.trim();
    const preferredTime = callbackTime.trim();
    if (firstName.length < 2 || lastName.length < 2 || phone.length < 5 || !preferredDate || !preferredTime) {
      setCallbackError(callbackCopy.error);
      return;
    }

    setCallbackError(null);
    setCallbackLoading(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const response = await apiFetch("/api/public/callback-onboarding/request", {
        method: "POST",
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          country_code: callbackCountryCode,
          phone,
          preferred_date: preferredDate,
          preferred_time: preferredTime,
          preferred_period: callbackPeriod,
          callback_for: callbackFor,
          language,
          timezone,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? callbackCopy.error);
      }
      const result = await response.json().catch(() => null) as { scheduled_for?: string } | null;
      setCallbackScheduledFor(result?.scheduled_for ?? `${preferredDate} ${preferredTime} ${callbackPeriod}`);
    } catch (err) {
      setCallbackError(err instanceof Error ? err.message : callbackCopy.error);
    } finally {
      setCallbackLoading(false);
    }
  };

  const trimmedContact = contact.trim();
  const contactIsEmail = trimmedContact.includes("@");
  const isPasswordFreeSignIn = view !== "forgot" && (mode === "login" || view === "magic") && !showPasswordSignIn;
  const contactIsReady = adminOnly || isPasswordFreeSignIn
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedContact)
    : trimmedContact.length >= (contactIsEmail ? 4 : 7);
  const canSubmit = contactIsReady && password.length >= (mode === "register" ? 8 : 1) && !loading;
  const canSendReset = forgotEmail.trim().length > 3 && !forgotLoading;
  const canSendMagic = contactIsReady && !magicLoading;
  const isGuideLive = guideVoiceStatus === "connected" || guideVoiceStatus === "connecting" || isGuideConnecting;
  const isGuideVoiceOverlayVisible = (isGuideLive || Boolean(guideVoiceError)) && guideSessionMode === "voice";
  const guideVoiceErrorText = guideVoiceError
    ? guideVoiceError.toLowerCase().includes("no elevenlabs agent configured")
      ? copy.errors.noAgent
      : guideVoiceError.toLowerCase().includes("missing elevenlabs api key")
        ? copy.errors.noApiKey
        : guideVoiceError
    : null;
  const isSignupWithPassword = mode === "register" && view !== "magic";
  const contactLabel = adminOnly
    ? copy.email
    : isPasswordFreeSignIn
      ? copy.email
      : copy.combinedContact ?? `${copy.mobileNumber} / ${copy.email}`;
  const compactPhoneExample = copy.phonePlaceholder.replace(/\s+/g, "");
  const contactPlaceholder = adminOnly
    ? "admin@vyva.life"
    : isPasswordFreeSignIn
    ? copy.emailPlaceholder
    : language === "en"
      ? "Mobile or email"
      : copy.combinedContactPlaceholder ?? `${compactPhoneExample} ${copy.or} ${copy.emailPlaceholder}`;
  const contactFormatHint =
    adminOnly
      ? "Use your approved VYVA admin email."
      : isPasswordFreeSignIn
      ? language === "en"
        ? "We send a secure link to your email. No password to remember."
        : `${copy.email}: ${copy.emailPlaceholder}`
      : language === "en" && isSignupWithPassword
        ? "Use email for sign-in links. Use mobile with your password."
      : language === "en" && mode === "login" && showPasswordSignIn && !adminOnly
        ? "Use the mobile number or email you signed up with."
      : `${copy.mobileNumber}: ${contactPlaceholder}`;
  const contactAutocomplete = adminOnly || isPasswordFreeSignIn ? "email" : "username";
  const todayForDateInput = new Date().toISOString().slice(0, 10);
  const selectedDialOption = COUNTRY_DIAL_OPTIONS.find((option) => option.dialCode === callbackCountryCode) ?? COUNTRY_DIAL_OPTIONS[0];
  const selectedCallNumber = VYVA_CALL_NUMBERS[callCountry] ?? VYVA_CALL_NUMBERS.ES;
  const activeView: View = view === "forgot" || view === "magic" ? view : mode;
  const authTitle = adminOnly && activeView === "login"
    ? "Admin sign in"
    : activeView === "register"
      ? copy.createTab
      : activeView === "login"
        ? copy.signInTab
        : copy.titles[activeView];
  const authSubtitle = adminOnly && activeView === "login"
    ? "Access the VYVA operations panel."
    : copy.subtitles[activeView];
  const isSignupHero = mode === "register" && view !== "magic";
  const heroEyebrow = isSignupHero ? copy.privateDailySupport : copy.signInHeroEyebrow;
  const heroTitle = isSignupHero ? copy.heroTitle : copy.signInHeroTitle;
  const heroSubtitle = isSignupHero ? copy.heroSubtitle : copy.signInHeroSubtitle;

  const mainMaxClass = "max-w-[1180px]";

  return (
    <>
      {isGuideVoiceOverlayVisible && (
        <VoiceCallOverlay
          isSpeaking={isGuideSpeaking}
          isConnecting={isGuideConnecting}
          transcript={guideTranscript}
          onEnd={stopVoice}
          voiceSessionPhase={guideVoiceSessionPhase}
          isMicMuted={isGuideMicMuted}
          onMicToggle={setGuideMicrophoneMuted}
          connectionError={guideVoiceErrorText ?? guideVoiceError}
          connectionErrorCode={guideVoiceErrorCode}
          onRetry={() => {
            void startLoginGuide({ textOnly: false });
          }}
        />
      )}

      {isCallModalOpen && (
        <PurpleModal
          Icon={PhoneCall}
          kicker={callCopy.eyebrow}
          title={callCopy.title}
          subtitle={callCopy.subtitle}
          titleId="call-modal-title"
          onClose={closeCallModal}
          closeLabel={callCopy.cancel}
          modalTestId="modal-login-call-vyva"
          size="wide"
        >
          <form
            className="grid gap-5"
            onSubmit={handleCallSubmit}
          >
            {callConfirmed ? (
              <div className="rounded-[24px] border border-[#D8B4FE] bg-[#F5F3FF] p-5 text-center sm:p-6">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-vyva-purple text-white">
                  <PhoneCall size={28} />
                </div>
                <p className="mt-5 font-body text-[13px] font-extrabold uppercase tracking-[0.18em] text-vyva-purple">
                  {callCopy.numberLabel}
                </p>
                <a
                  href={`tel:${selectedCallNumber.e164}`}
                  className="mt-2 block break-words font-body text-[34px] font-black leading-tight text-[#2F183F] underline-offset-4 hover:underline sm:text-[40px]"
                  data-testid="link-call-vyva-number"
                >
                  {selectedCallNumber.display}
                </a>
                <a
                  href={`tel:${selectedCallNumber.e164}`}
                  className={`${VYVA_MODAL_PRIMARY_ACTION_CLASS} mt-6`}
                  data-testid="button-call-now"
                >
                  {callCopy.callNow}
                  <PhoneCall size={20} />
                </a>
                <button
                  type="button"
                  onClick={() => setCallConfirmed(false)}
                  className={`${VYVA_MODAL_SECONDARY_ACTION_CLASS} mt-4`}
                  data-testid="button-call-change-country"
                >
                  {callCopy.changeCountry}
                </button>
              </div>
            ) : (
              <>
                <div className="mt-6 grid gap-4">
                  <label className="font-body text-[16px] font-black text-vyva-text-1">
                    {callCopy.country}
                    <select
                      value={callCountry}
                      onChange={(event) => {
                        const nextCountry = event.target.value;
                        setCallCountry(nextCountry);
                      }}
                      className="mt-2 h-[64px] w-full rounded-[22px] border-2 border-vyva-border bg-white px-5 text-[18px] font-bold text-[#2F183F] shadow-vyva-input outline-none"
                      data-testid="select-call-country"
                      aria-label={callCopy.country}
                    >
                      {COUNTRY_DIAL_OPTIONS.map((option) => (
                        <option key={option.country} value={option.country}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
                  <button
                    type="button"
                    onClick={closeCallModal}
                    className={VYVA_MODAL_SECONDARY_ACTION_CLASS}
                    data-testid="button-call-cancel"
                  >
                    {callCopy.cancel}
                  </button>
                  <button
                    type="submit"
                    className={VYVA_MODAL_PRIMARY_ACTION_CLASS}
                    data-testid="button-call-submit"
                  >
                    {callCopy.confirm}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </>
            )}
          </form>
        </PurpleModal>
      )}

      {isCallbackModalOpen && (
        <PurpleModal
          Icon={CalendarClock}
          kicker={callbackCopy.eyebrow}
          title={callbackCopy.title}
          subtitle={callbackCopy.subtitle}
          statusPill={callbackCopy.requiredNote}
          titleId="callback-modal-title"
          onClose={closeCallbackModal}
          closeLabel={callbackCopy.cancel}
          modalTestId="modal-login-callback"
          size="wide"
        >
          <form
            className="grid gap-5"
            onSubmit={handleCallbackSubmit}
            noValidate
          >
            {callbackScheduledFor ? (
              <div className="rounded-[24px] border border-[#BEEBD0] bg-[#F3FFF8] p-5 text-center shadow-[0_16px_36px_rgba(25,135,84,0.12)] sm:p-6">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E2F8EB] text-emerald-700">
                  <CheckCircle2 size={30} />
                </span>
                <h3 className="mt-4 font-body text-[28px] font-black text-[#2F183F]">
                  {callbackCopy.successTitle}
                </h3>
                <p className="mt-2 font-body text-[17px] leading-7 text-vyva-text-2">
                  {callbackCopy.successBody}
                </p>
                <p className="mt-4 rounded-full bg-white px-4 py-3 font-body text-[16px] font-extrabold text-emerald-800">
                  {new Date(callbackScheduledFor).toString() === "Invalid Date"
                    ? callbackScheduledFor
                    : new Intl.DateTimeFormat(language, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(callbackScheduledFor))}
                </p>
                <button
                  type="button"
                  onClick={closeCallbackModal}
                  className={`${VYVA_MODAL_PRIMARY_ACTION_CLASS} mt-6`}
                  data-testid="button-callback-success-close"
                >
                  {callbackCopy.closeSuccess}
                </button>
              </div>
            ) : (
              <>
            <div className="mt-6 grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="font-body text-[16px] font-black text-vyva-text-1">
                  {callbackCopy.firstName} <span className="text-red-500" aria-hidden="true">*</span>
                  <Input
                    ref={callbackNameInputRef}
                    type="text"
                    value={callbackFirstName}
                    onChange={(event) => {
                      setCallbackFirstName(event.target.value);
                      setCallbackError(null);
                    }}
                    placeholder={callbackCopy.firstNamePlaceholder}
                    className="mt-2 h-[64px] rounded-[22px] border-2 border-vyva-border bg-white px-5 text-[18px] font-bold text-[#2F183F] shadow-vyva-input"
                    autoComplete="given-name"
                    data-testid="input-callback-first-name"
                    required
                  />
                </label>

                <label className="font-body text-[16px] font-black text-vyva-text-1">
                  {callbackCopy.lastName} <span className="text-red-500" aria-hidden="true">*</span>
                  <Input
                    type="text"
                    value={callbackLastName}
                    onChange={(event) => {
                      setCallbackLastName(event.target.value);
                      setCallbackError(null);
                    }}
                    placeholder={callbackCopy.lastNamePlaceholder}
                    className="mt-2 h-[64px] rounded-[22px] border-2 border-vyva-border bg-white px-5 text-[18px] font-bold text-[#2F183F] shadow-vyva-input"
                    autoComplete="family-name"
                    data-testid="input-callback-last-name"
                    required
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
                <label className="font-body text-[16px] font-black text-vyva-text-1">
                  {callbackCopy.countryCode} <span className="text-red-500" aria-hidden="true">*</span>
                  <select
                    value={callbackCountryCode}
                    onChange={(event) => setCallbackCountryCode(event.target.value)}
                    className="mt-2 h-[64px] w-full rounded-[22px] border-2 border-vyva-border bg-white px-5 text-[18px] font-bold text-[#2F183F] shadow-vyva-input outline-none"
                    data-testid="select-callback-country-code"
                    aria-label={callbackCopy.countryCode}
                    required
                  >
                    {COUNTRY_DIAL_OPTIONS.map((option) => (
                      <option key={option.country} value={option.dialCode}>
                        {option.label} {option.dialCode}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="font-body text-[16px] font-black text-vyva-text-1">
                  {callbackCopy.phone} <span className="text-red-500" aria-hidden="true">*</span>
                  <Input
                    type="tel"
                    value={callbackPhone}
                    onChange={(event) => {
                      setCallbackPhone(event.target.value);
                      setCallbackError(null);
                    }}
                    placeholder={selectedDialOption.phonePlaceholder}
                    className="mt-2 h-[64px] rounded-[22px] border-2 border-vyva-border bg-white px-5 text-[18px] font-bold text-[#2F183F] shadow-vyva-input"
                    autoComplete="tel-national"
                    data-testid="input-callback-phone"
                    required
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="font-body text-[16px] font-black text-vyva-text-1">
                  {callbackCopy.date} <span className="text-red-500" aria-hidden="true">*</span>
                  <Input
                    type="date"
                    value={callbackDate}
                    onChange={(event) => {
                      setCallbackDate(event.target.value);
                      setCallbackError(null);
                    }}
                    min={todayForDateInput}
                    className="mt-2 h-[64px] rounded-[22px] border-2 border-vyva-border bg-white px-5 text-[18px] font-bold text-[#2F183F] shadow-vyva-input"
                    data-testid="input-callback-date"
                    required
                  />
                </label>

                <label className="font-body text-[16px] font-black text-vyva-text-1">
                  {callbackCopy.time} <span className="text-red-500" aria-hidden="true">*</span>
                  <div className="mt-2 grid grid-cols-[1fr_104px] gap-2">
                    <Input
                      type="time"
                      value={callbackTime}
                      onChange={(event) => {
                        setCallbackTime(event.target.value);
                        setCallbackError(null);
                      }}
                      className="h-[64px] rounded-[22px] border-2 border-vyva-border bg-white px-5 text-[18px] font-bold text-[#2F183F] shadow-vyva-input"
                      data-testid="input-callback-time"
                      required
                    />
                    <select
                      value={callbackPeriod}
                      onChange={(event) => setCallbackPeriod(event.target.value as CallbackPeriod)}
                      className="h-[64px] rounded-[22px] border-2 border-vyva-border bg-white px-4 text-[18px] font-black text-[#2F183F] shadow-vyva-input outline-none"
                      aria-label="AM or PM"
                      data-testid="select-callback-period"
                      required
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </label>
              </div>

              <fieldset className="grid gap-2">
                <legend className="mb-1 font-body text-[16px] font-black text-vyva-text-1">
                  {callbackCopy.callFor} <span className="text-red-500" aria-hidden="true">*</span>
                </legend>
                {(["me", "caregiver"] as const).map((option) => {
                  const isSelected = callbackFor === option;
                  const Icon = option === "me" ? UserRound : UsersRound;
                  return (
                    <PurpleModalOption
                      key={option}
                      onClick={() => setCallbackFor(option)}
                      selected={isSelected}
                      className="min-h-[76px] gap-3 p-4"
                      aria-pressed={isSelected}
                      data-testid={`button-callback-for-${option}`}
                    >
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${isSelected ? "bg-vyva-purple text-white" : "bg-[#F8F3EA] text-vyva-purple"}`}>
                        <Icon size={22} />
                      </span>
                      <span>
                        <span className="block font-body text-[17px] font-black text-[#2F183F]">
                          {callbackCopy.options[option].title}
                        </span>
                        <span className="mt-1 block font-body text-[15px] leading-6 text-vyva-text-2">
                          {callbackCopy.options[option].subtitle}
                        </span>
                      </span>
                    </PurpleModalOption>
                  );
                })}
              </fieldset>
            </div>

            {callbackError && (
              <p className="mt-4 rounded-[18px] border-2 border-red-100 bg-red-50 px-4 py-3 font-body text-[16px] font-bold text-red-700" data-testid="text-callback-error">
                {callbackError}
              </p>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
              <button
                type="button"
                onClick={closeCallbackModal}
                className={VYVA_MODAL_SECONDARY_ACTION_CLASS}
                data-testid="button-callback-cancel"
              >
                {callbackCopy.cancel}
              </button>
              <button
                type="submit"
                disabled={callbackLoading}
                className={VYVA_MODAL_PRIMARY_ACTION_CLASS}
                data-testid="button-callback-submit"
              >
                {callbackLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    {callbackCopy.submitting}
                  </>
                ) : (
                  <>
                    {callbackCopy.submit}
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </div>
              </>
            )}
          </form>
        </PurpleModal>
      )}

      <div className="relative min-h-screen overflow-x-hidden bg-[#E8DDF7] text-vyva-text-1">
        {!adminOnly && (
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden bg-[#E8DDF7]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0)_34%),linear-gradient(125deg,#E5D8F6_0%,#EEE7F8_48%,#DFEAF1_100%)]" />
            <div className="absolute -right-24 top-24 h-80 w-80 rounded-full bg-[#CBB5ED]/45 blur-3xl" />
            <div className="absolute -bottom-32 left-[18%] h-96 w-96 rounded-full bg-[#BFDCD8]/35 blur-3xl" />
          </div>
        )}
        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 pb-3 pt-4 sm:px-8 sm:py-5 lg:px-10 lg:py-7">
          <VyvaWordmark className="h-auto w-[108px] sm:w-[136px]" />
          <div className="flex items-center gap-2">
            {!adminOnly && (
              <button
                type="button"
                onClick={() => {
                  switchTab("register");
                  setSetupIntent("caregiver");
                  contactInputRef.current?.focus();
                }}
                className="hidden min-h-[44px] items-center rounded-full px-3 font-body text-[13px] font-extrabold text-vyva-purple transition hover:bg-white/70 sm:inline-flex"
                data-testid="button-caregiver-access"
              >
                {copy.setupIntent.caregiver.title}
              </button>
            )}
            <label className="flex min-h-[44px] items-center gap-2 rounded-full border border-[#E8DDF3] bg-white/90 px-3 py-2 shadow-[0_12px_32px_rgba(77,45,20,0.08)] backdrop-blur">
              <Globe2 size={15} className="text-vyva-purple" />
              <span className="sr-only">{copy.language}</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                aria-label={copy.language}
                className="bg-transparent font-body text-[13px] font-extrabold text-vyva-purple outline-none"
                data-testid="select-login-language"
              >
                {languages.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        <main className={`relative z-10 mx-auto flex min-h-[calc(100vh-104px)] w-full ${mainMaxClass} items-start justify-center px-5 pb-8 pt-3 sm:px-8 md:min-h-[calc(100vh-116px)] md:pt-0 lg:px-8 lg:pb-12`}>
          <section
            data-testid="auth-layout"
            className="grid w-full max-w-[560px] gap-6 lg:max-w-[980px] lg:grid-cols-[minmax(300px,0.72fr)_minmax(420px,500px)] lg:items-center lg:gap-10"
          >
            {adminOnly ? (
              <div className="rounded-[28px] border border-[#E7DCD2] bg-[#FFFCF8] p-6 text-center shadow-[0_18px_50px_rgba(47,24,63,0.08)] md:text-left lg:p-8">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#F2E8FF] text-vyva-purple md:mx-0">
                  <ShieldCheck size={30} />
                </div>
                <p className="mt-6 font-body text-[11px] font-extrabold uppercase tracking-[0.26em] text-vyva-purple/70">
                  {heroEyebrow}
                </p>
                <h1 className="mt-3 font-display text-[38px] leading-[1.02] text-[#2E1642] sm:text-[48px]">
                  {heroTitle}
                </h1>
                <p className="mx-auto mt-4 max-w-[410px] font-body text-[15px] font-semibold leading-[1.65] text-vyva-text-2 md:mx-0">
                  {heroSubtitle}
                </p>
                <div className="mt-7 grid gap-3" aria-label="Admin security notes">
                  {trustItems.map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-[18px] border border-[#E8DDF3] bg-white px-4 py-3 text-left">
                      <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-vyva-purple" />
                      <span className="font-body text-[13px] font-bold leading-5 text-[#6E6275]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div
                data-testid="auth-hero-panel"
                className="relative hidden min-h-[390px] overflow-hidden rounded-[32px] border border-[#E9DDCF] bg-[#FFFCF7] p-8 shadow-[0_24px_64px_rgba(79,43,116,0.12)] lg:flex lg:flex-col lg:justify-between"
              >
                <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,#6B21A8_0%,#10B981_52%,#F2C94C_100%)]" />
                <div className="relative flex items-center justify-between gap-4">
                  <span className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[#D9C7F8] bg-white px-4 font-body text-[12px] font-black text-vyva-purple shadow-[0_10px_28px_rgba(107,33,168,0.10)]">
                    <ShieldCheck size={16} />
                    {copy.profilePrivate}
                  </span>
                </div>

                <div className="relative my-auto py-8">
                  <p className="font-body text-[12px] font-black uppercase tracking-[0.22em] text-[#9B7100]">
                    {heroEyebrow}
                  </p>
                  <h1 className="mt-3 max-w-[390px] font-body text-[2.4rem] font-black leading-[1.02] text-[#2F183F]">
                    {heroTitle}
                  </h1>
                  <p className="mt-4 max-w-[420px] font-body text-[14px] font-bold leading-6 text-vyva-text-2">
                    {heroSubtitle}
                  </p>
                </div>

                <div className="relative flex items-center gap-3 border-t border-[#EEE4D8] pt-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#047857]">
                    <ShieldCheck size={18} />
                  </span>
                  <p className="font-body text-[13px] font-bold leading-5 text-vyva-text-2">{copy.profilePrivate}</p>
                </div>
              </div>
            )}

            <div
              data-testid="auth-card"
              className={authCardClass}
            >
              {!adminOnly && view !== "forgot" && view !== "magic" && (
                <div className="mb-6 grid grid-cols-2 rounded-[18px] bg-[#F5F0F8] p-1" role="tablist" aria-label="Authentication mode">
                  {(["login", "register"] as const).map((tab) => {
                    const active = mode === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => switchTab(tab)}
                        data-testid={`button-auth-mode-${tab}`}
                        className={`min-h-[46px] rounded-[14px] px-4 font-body text-[14px] font-black transition ${
                          active ? "bg-white text-vyva-purple shadow-sm" : "text-vyva-text-2 hover:text-vyva-purple"
                        }`}
                      >
                        {tab === "login" ? copy.signInTab : copy.createTab}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mb-5">
                <h2 className="font-body text-[36px] font-black leading-tight text-[#2F183F]">{authTitle}</h2>
                <p className="mt-1.5 font-body text-[16px] font-semibold leading-6 text-vyva-text-2">{authSubtitle}</p>
              </div>

              {!adminOnly && (
                <div className="mb-5 grid gap-2 sm:grid-cols-2" data-testid="auth-audience-switcher">
                  {([
                    {
                      id: "member" as const,
                      href: memberAuthHref,
                      icon: UserRound,
                      title: audienceCopy.memberDoor,
                      subtitle: audienceCopy.memberDoorSubtitle,
                    },
                    {
                      id: "caregiver" as const,
                      href: caregiverAuthHref,
                      icon: UsersRound,
                      title: audienceCopy.caregiverDoor,
                      subtitle: audienceCopy.caregiverDoorSubtitle,
                    },
                  ]).map((door) => {
                    const active = audience === door.id;
                    const Icon = door.icon;
                    return (
                      <Link
                        key={door.id}
                        to={door.href}
                        data-testid={`link-auth-door-${door.id}`}
                        className={`flex min-h-[78px] items-center gap-3 rounded-[18px] border px-3 py-3 text-left transition ${
                          active
                            ? isCaregiverAudience
                              ? "border-[#0E8F89] bg-[#EFFBFA] text-[#173E3E] shadow-[0_10px_24px_rgba(0,132,127,0.10)]"
                              : "border-vyva-purple bg-[#F5F0FF] text-vyva-text-1 shadow-[0_10px_24px_rgba(107,33,168,0.10)]"
                            : "border-[#EFE7DB] bg-white text-vyva-text-2 hover:border-[#E1D6C8]"
                        }`}
                      >
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${
                          active
                            ? isCaregiverAudience ? "bg-[#00847F] text-white" : "bg-vyva-purple text-white"
                            : isCaregiverAudience ? "bg-[#EAF7F6] text-[#00847F]" : "bg-[#F8F3EA] text-vyva-purple"
                        }`}>
                          <Icon size={19} />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-body text-[14px] font-black leading-tight">{door.title}</span>
                          <span className="mt-1 block font-body text-[12px] font-semibold leading-4 text-vyva-text-3">{door.subtitle}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}

              {view === "forgot" ? (
                <div className="flex flex-col gap-4">
                  {forgotSent ? (
                    <div data-testid="text-forgot-success" className="rounded-[24px] bg-[#ECFDF5] px-5 py-6 text-center">
                      <CheckCircle2 size={34} className="mx-auto mb-3 text-vyva-green" />
                      <p className="font-body text-[16px] font-bold">{copy.checkInbox}</p>
                      <p className="mt-1 font-body text-[13px] leading-[1.55] text-vyva-text-2">{copy.resetSentBody}</p>
                      {forgotDevResetLink ? (
                        <a
                          href={forgotDevResetLink}
                          className="mt-4 inline-flex rounded-full bg-white px-4 py-2 font-body text-[13px] font-bold text-vyva-purple shadow-sm"
                        >
                          Open local reset link
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <label className="font-body text-[13px] font-bold text-vyva-text-2">
                        {copy.email}
                        <Input
                          data-testid="input-forgot-email"
                          type="email"
                          value={forgotEmail}
                          onChange={(event) => {
                            setForgotEmail(event.target.value);
                            setForgotDevResetLink(null);
                          }}
                          onKeyDown={(event) => event.key === "Enter" && canSendReset && handleForgot()}
                          placeholder={copy.emailPlaceholder}
                          className="mt-2 h-[56px] rounded-[20px] border-vyva-border bg-white px-4 shadow-vyva-input"
                          autoComplete="email"
                        />
                      </label>
                      {forgotError && (
                        <p data-testid="text-forgot-error" className="font-body text-[13px] text-red-600">
                          {forgotError}
                        </p>
                      )}
                      <button
                        data-testid="button-forgot-submit"
                        type="button"
                        onClick={handleForgot}
                        disabled={!canSendReset}
                        className="vyva-primary-action w-full bg-[linear-gradient(135deg,#6B21A8_0%,#8B3FC8_100%)] py-4 shadow-vyva-fab disabled:opacity-40"
                      >
                        {forgotLoading ? copy.sending : copy.sendResetLink}
                        {!forgotLoading && <ArrowRight size={17} />}
                      </button>
                    </>
                  )}
                  <button
                    data-testid="link-forgot-back"
                    type="button"
                    onClick={() => {
                      setView("login");
                      setMode("login");
                      setShowPasswordSignIn(true);
                    }}
                    className="font-body text-[13px] font-bold text-vyva-purple"
                  >
                    {copy.backToSignIn}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {!adminOnly && mode === "register" && view !== "magic" && audience === "caregiver" && (
                    <div
                      className="rounded-[18px] border border-[#BEE7E4] bg-[#F2FCFB] px-4 py-3"
                      data-testid={isCareTeamInviteAuth ? "auth-careteam-invite" : "auth-caregiver-note"}
                    >
                      <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#007C78]">
                        {audienceCopy.caregiverNoteTitle}
                      </p>
                      <p className="mt-1 font-body text-[13px] font-bold leading-relaxed text-[#426768]">
                        {audienceCopy.caregiverNoteBody}
                      </p>
                    </div>
                  )}

                  {signInMethodChooser}

                  <label className="font-body text-[15px] font-black text-vyva-text-2">
                    {contactLabel}
                    <Input
                      ref={contactInputRef}
                      data-testid="input-auth-contact"
                      type={adminOnly || isPasswordFreeSignIn ? "email" : "text"}
                      inputMode={adminOnly || isPasswordFreeSignIn ? "email" : "text"}
                      value={contact}
                      onChange={(event) => {
                        setContact(event.target.value);
                        setMagicSent(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        if (mode === "register" && canSubmit) handleSubmit();
                        if ((mode === "login" || view === "magic") && !showPasswordSignIn && canSendMagic) handleMagicLink();
                        if (mode === "login" && showPasswordSignIn && canSubmit) handleSubmit();
                      }}
                      placeholder={contactPlaceholder}
                      className="mt-2 h-[62px] rounded-[18px] border-2 border-vyva-border bg-[#F8FBFF] px-5 text-[17px] font-bold text-[#2F183F] shadow-vyva-input"
                      autoComplete={contactAutocomplete}
                    />
                    <span className="mt-2 block font-body text-[13px] font-semibold leading-5 text-vyva-text-3">
                      {contactFormatHint}
                    </span>
                  </label>

                  {mode === "register" && view !== "magic" ? (
                    <>
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label className="font-body text-[13px] font-bold text-vyva-text-2">{copy.password}</label>
                          <span className="font-body text-[12px] text-vyva-text-3">{copy.passwordHint}</span>
                        </div>
                        <div className="relative">
                          <Input
                            data-testid="input-auth-password"
                            type={showPw ? "text" : "password"}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && canSubmit && handleSubmit()}
                            placeholder={copy.createPassword}
                            className="h-[64px] rounded-[18px] border-2 border-vyva-border bg-white px-5 pr-12 text-[17px] font-bold shadow-vyva-input"
                            autoComplete="new-password"
                          />
                          <button
                            data-testid="button-auth-toggle-password"
                            type="button"
                            onClick={() => setShowPw((value) => !value)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-vyva-text-3"
                            aria-label={showPw ? "Hide password" : "Show password"}
                          >
                            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      {error && (
                        <p data-testid="text-auth-error" className="rounded-[16px] bg-red-50 px-4 py-3 font-body text-[13px] text-red-700">
                          {error}
                        </p>
                      )}

                      <button
                        data-testid="button-auth-submit"
                        type="button"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className={`vyva-primary-action w-full rounded-[18px] py-4 text-[17px] font-black disabled:opacity-40 ${publicPrimaryClass}`}
                      >
                        {loading ? copy.creating : copy.createAccount}
                        {!loading && <ArrowRight size={17} />}
                      </button>

                    </>
                  ) : showPasswordSignIn && view !== "magic" ? (
                    <>
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label className="font-body text-[13px] font-bold text-vyva-text-2">{copy.password}</label>
                          <button
                            data-testid="link-forgot-password"
                            type="button"
                            onClick={showForgot}
                            className="font-body text-[12px] font-bold text-vyva-purple"
                          >
                            {copy.forgot}
                          </button>
                        </div>
                        <div className="relative">
                          <Input
                            data-testid="input-auth-password"
                            type={showPw ? "text" : "password"}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            onKeyDown={(event) => event.key === "Enter" && canSubmit && handleSubmit()}
                            placeholder={copy.yourPassword}
                            className="h-[64px] rounded-[18px] border-2 border-vyva-border bg-white px-5 pr-12 text-[17px] font-bold shadow-vyva-input"
                            autoComplete="current-password"
                          />
                          <button
                            data-testid="button-auth-toggle-password"
                            type="button"
                            onClick={() => setShowPw((value) => !value)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-vyva-text-3"
                            aria-label={showPw ? "Hide password" : "Show password"}
                          >
                            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      {error && (
                        <p data-testid="text-auth-error" className="rounded-[16px] bg-red-50 px-4 py-3 font-body text-[13px] text-red-700">
                          {error}
                        </p>
                      )}

                      <button
                        data-testid="button-auth-submit"
                        type="button"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className={`vyva-primary-action w-full rounded-[18px] py-4 text-[17px] font-black disabled:opacity-40 ${publicPrimaryClass}`}
                      >
                        {loading ? copy.signingIn : copy.signIn}
                        {!loading && <ArrowRight size={17} />}
                      </button>

                      {!adminOnly && (
                        <>
                          <button
                            type="button"
                            onClick={showMagic}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#E8DDF3] bg-white px-4 py-3 font-body text-[13px] font-extrabold text-vyva-purple"
                            data-testid="button-show-magic-link"
                          >
                            <KeyRound size={15} />
                            {copy.signInWithMagicLink}
                          </button>

                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {magicSent ? (
                        <div data-testid="text-magic-success" className="rounded-[24px] bg-[#ECFDF5] px-5 py-6 text-center">
                          <CheckCircle2 size={34} className="mx-auto mb-3 text-vyva-green" />
                          <p className="font-body text-[16px] font-bold">{copy.linkSent}</p>
                          <p className="mt-1 font-body text-[13px] leading-[1.55] text-vyva-text-2">
                            {obscureContact(contact)} Â· {copy.useWithin}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setMagicSent(false);
                              setMagicError(null);
                            }}
                            className="mt-4 min-h-[44px] rounded-full border border-[#CDEADB] bg-white px-5 font-body text-[13px] font-extrabold text-[#047857]"
                            data-testid="button-magic-resend"
                          >
                            {copy.sendMagicLink}
                          </button>
                        </div>
                      ) : (
                        <>
                          {magicError && (
                            <p data-testid="text-magic-error" className="rounded-[16px] bg-red-50 px-4 py-3 font-body text-[13px] text-red-700">
                              {magicError}
                            </p>
                          )}
                          <button
                            data-testid="button-magic-submit"
                            type="button"
                            onClick={handleMagicLink}
                            disabled={!canSendMagic}
                            className={`vyva-primary-action w-full rounded-[18px] py-4 text-[17px] font-black disabled:opacity-40 ${publicPrimaryClass}`}
                          >
                            {magicLoading ? copy.sending : magicSubmitLabel}
                            {!magicLoading && <Link2 size={17} />}
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setView("login");
                          setMode("login");
                          setShowPasswordSignIn(true);
                          setMagicError(null);
                        }}
                        className="inline-flex items-center justify-center rounded-full px-4 py-2 font-body text-[13px] font-extrabold text-vyva-purple"
                      >
                        {copy.usePasswordInstead}
                      </button>
                    </>
                  )}

                  <div className="flex flex-col items-center justify-center gap-1 border-t border-[#EEE4D8] px-2 pt-4 text-center sm:flex-row sm:gap-2">
                    <span className="inline-flex items-center justify-center gap-2">
                      <ShieldCheck size={15} className="text-vyva-purple" />
                      <span className="font-body text-[12px] font-bold text-vyva-text-2">{copy.profilePrivate}</span>
                    </span>
                    <a
                      href="https://vyva.life/privacypolicy"
                      target="_blank"
                      rel="noreferrer"
                      data-testid="link-privacy-policy"
                      className={`font-body text-[12px] font-extrabold underline-offset-4 hover:underline ${isCaregiverAudience ? "text-[#007C78]" : "text-vyva-purple"}`}
                    >
                      {copy.privacyPolicy}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
