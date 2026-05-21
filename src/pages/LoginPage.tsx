import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  Link2,
  Loader2,
  Mic,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import VoiceCallOverlay from "@/components/VoiceCallOverlay";
import { VyvaWordmark } from "@/components/VyvaWordmark";
import { useAuth } from "@/contexts/AuthContext";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";
import { queryClient } from "@/lib/queryClient";
import { stageToRoute } from "@/lib/onboardingRoute";
import { isSupabaseAuthAvailable, sendSupabasePasswordReset } from "@/lib/supabaseAuth";
import { useLanguage } from "@/i18n";
import type { LanguageCode } from "@/i18n/languages";

type View = "login" | "register" | "forgot" | "magic";
type GuideTopic = "why" | "privacy" | "family";
type SetupIntent = "self" | "caregiver";

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

type LoginCopy = {
  privateDailySupport: string;
  heroTitle: string;
  heroSubtitle: string;
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
    privateDailySupport: "Private daily support",
    heroTitle: "Private support for daily care.",
    heroSubtitle: "Create one secure profile for health, medication, family support, and daily check-ins.",
    chips: ["Voice-first", "Private profile", "Family-ready"],
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
    combinedContactPlaceholder: "+34 600 000 000 or you@example.com",
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
    privateDailySupport: "Apoyo diario privado",
    heroTitle: "Apoyo privado para el cuidado diario.",
    heroSubtitle: "Crea un perfil seguro para salud, medicación, apoyo familiar y controles diarios.",
    chips: ["Primero voz", "Perfil privado", "Listo para familia"],
    language: "Idioma",
    createTab: "Registro",
    signInTab: "Entrar",
    titles: { register: "Crear cuenta", login: "Bienvenido de nuevo", forgot: "Recuperar acceso", magic: "Enlace mágico" },
    subtitles: {
      register: "Usa email o móvil.",
      login: "Continúa con email o móvil.",
      forgot: "Introduce tu email y enviaremos un enlace seguro.",
      magic: "Sin contraseña.",
    },
    email: "Email",
    mobile: "Móvil",
    mobileNumber: "Número móvil",
    password: "Contraseña",
    passwordHint: "8+ caracteres",
    forgot: "¿Olvidaste?",
    emailPlaceholder: "tu@email.com",
    phonePlaceholder: "+34 600 000 000",
    combinedContact: "Movil o email",
    combinedContactPlaceholder: "+34 600 000 000 o tu@email.com",
    createPassword: "Crear contraseña",
    yourPassword: "Tu contraseña",
    creating: "Creando...",
    signingIn: "Entrando...",
    sending: "Enviando...",
    createAccount: "Crear cuenta",
    signIn: "Entrar",
    or: "o",
    sendResetLink: "Enviar enlace",
    sendMagicLink: "Enviar enlace mágico",
    signInWithMagicLink: "Entrar con enlace mágico",
    continueWithGoogle: "Continuar con Google",
    usePasswordInstead: "Usar contraseña",
    profilePrivate: "Tu perfil sigue siendo privado.",
    privacyPolicy: "Política de privacidad",
    setupIntentLabel: "Uso VYVA",
    setupIntent: {
      self: {
        title: "Para mí",
        subtitle: "Mi cuenta y mi perfil de cuidado.",
      },
      caregiver: {
        title: "Como cuidador/a",
        subtitle: "Configurar o acceder al cuidado en nombre de otra persona.",
      },
    },
    caregiverHint: "Las cuentas de cuidadores se mantienen separadas del perfil de cuidado. La persona que recibe apoyo conserva el control del consentimiento y la confirmación.",
    checkInbox: "Revisa tu bandeja",
    resetSentBody: "Si existe una cuenta, el enlace ya va en camino.",
    backToSignIn: "Volver a entrar",
    linkSent: "Enlace enviado",
    useWithin: "Úsalo antes de 15 minutos.",
    alreadyHaveAccount: "¿Ya tienes cuenta?",
    dontHaveAccount: "¿No tienes cuenta?",
    backToPassword: "Volver a contraseña",
    guide: {
      notSure: "¿Dudas?",
      title: "Pregunta a VYVA",
      helperSubtitle: "Habla con VYVA, elige una pregunta rápida o escribe la tuya.",
      quickAnswer: "Respuesta rápida",
      talk: "Hablar",
      end: "Terminar",
      connecting: "...",
      typeQuestion: "Escribe una pregunta",
      ask: "Pregunta...",
      topics: {
        why: { label: "¿Por qué cuenta?", body: "Para que VYVA recuerde tu contexto de cuidado con seguridad." },
        privacy: { label: "¿Es privado?", body: "Salud y medicación quedan protegidas en tu cuenta." },
        family: { label: "Ayuda familiar", body: "La familia puede ayudar, pero tú controlas lo que se comparte." },
      },
    },
    errors: {
      generic: "Algo salió mal. Inténtalo de nuevo.",
      requestFailed: "No se pudo enviar. Inténtalo de nuevo.",
      magicFailed: "No se pudo enviar el enlace.",
      signInLinkFailed: "Este enlace de acceso no funcionó.",
      noAgent: "Añade ELEVENLABS_LOGIN_GUIDE_AGENT_ID para activar esta guía.",
      noApiKey: "La guía de voz necesita la clave de ElevenLabs.",
    },
  },
  fr: {
    privateDailySupport: "Soutien quotidien privé",
    heroTitle: "Soutien privé pour les soins quotidiens.",
    heroSubtitle: "Créez un profil sécurisé pour la santé, les médicaments, le soutien familial et le suivi quotidien.",
    chips: ["Voix d'abord", "Profil privé", "Prêt pour la famille"],
    language: "Langue",
    createTab: "Créer",
    signInTab: "Connexion",
    titles: { register: "Créer un compte", login: "Bon retour", forgot: "Récupérer l'accès", magic: "Lien magique" },
    subtitles: {
      register: "Utilisez email ou mobile.",
      login: "Continuez avec email ou mobile.",
      forgot: "Saisissez votre email et nous enverrons un lien sécurisé.",
      magic: "Sans mot de passe.",
    },
    email: "Email",
    mobile: "Mobile",
    mobileNumber: "Numéro mobile",
    password: "Mot de passe",
    passwordHint: "8+ caractères",
    forgot: "Oublié ?",
    emailPlaceholder: "vous@example.com",
    phonePlaceholder: "+34 600 000 000",
    createPassword: "Créer un mot de passe",
    yourPassword: "Votre mot de passe",
    creating: "Création...",
    signingIn: "Connexion...",
    sending: "Envoi...",
    createAccount: "Créer un compte",
    signIn: "Connexion",
    or: "ou",
    sendResetLink: "Envoyer le lien",
    sendMagicLink: "Envoyer le lien magique",
    signInWithMagicLink: "Connexion avec lien magique",
    continueWithGoogle: "Continuer avec Google",
    usePasswordInstead: "Utiliser le mot de passe",
    profilePrivate: "Votre profil reste privé.",
    privacyPolicy: "Politique de confidentialité",
    setupIntentLabel: "J'utilise VYVA",
    setupIntent: {
      self: {
        title: "Pour moi",
        subtitle: "Mon compte et mon profil de soin.",
      },
      caregiver: {
        title: "Comme aidant",
        subtitle: "Configurer ou accéder aux soins au nom de quelqu'un.",
      },
    },
    caregiverHint: "Les comptes aidants restent séparés du profil de soin. La personne accompagnée garde le contrôle du consentement et de la confirmation.",
    checkInbox: "Vérifiez votre boîte mail",
    resetSentBody: "Si le compte existe, le lien est en route.",
    backToSignIn: "Retour à la connexion",
    linkSent: "Lien envoyé",
    useWithin: "À utiliser dans les 15 minutes.",
    backToPassword: "Retour au mot de passe",
    alreadyHaveAccount: "Vous avez déjà un compte ?",
    dontHaveAccount: "Vous n'avez pas encore de compte ?",
    guide: {
      notSure: "Un doute ?",
      title: "Demander à VYVA",
      helperSubtitle: "Parlez à VYVA, choisissez une question rapide ou écrivez la vôtre.",
      quickAnswer: "Réponse rapide",
      talk: "Parler",
      end: "Terminer",
      connecting: "...",
      typeQuestion: "Écrivez une question",
      ask: "Demander...",
      topics: {
        why: { label: "Pourquoi un compte ?", body: "Pour que VYVA mémorise votre contexte de soin en sécurité." },
        privacy: { label: "Est-ce privé ?", body: "Santé et médicaments restent protégés dans votre compte." },
        family: { label: "Aide familiale", body: "La famille peut aider, mais vous contrôlez le partage." },
      },
    },
    errors: {
      generic: "Une erreur est survenue. Réessayez.",
      requestFailed: "Demande impossible. Réessayez.",
      magicFailed: "Impossible d'envoyer le lien.",
      signInLinkFailed: "Ce lien de connexion n'a pas fonctionné.",
      noAgent: "Ajoutez ELEVENLABS_LOGIN_GUIDE_AGENT_ID pour activer ce guide.",
      noApiKey: "Le guide vocal a besoin de la clé ElevenLabs.",
    },
  },
  de: {
    privateDailySupport: "Private tägliche Unterstützung",
    heroTitle: "Private Unterstützung für den Pflegealltag.",
    heroSubtitle: "Erstellen Sie ein sicheres Profil für Gesundheit, Medikamente, familiäre Unterstützung und tägliche Check-ins.",
    chips: ["Stimme zuerst", "Privates Profil", "Familienbereit"],
    language: "Sprache",
    createTab: "Erstellen",
    signInTab: "Anmelden",
    titles: { register: "Konto erstellen", login: "Willkommen zurück", forgot: "Zugang zurücksetzen", magic: "Magischer Link" },
    subtitles: {
      register: "Mit E-Mail oder Mobilnummer.",
      login: "Mit E-Mail oder Mobilnummer fortfahren.",
      forgot: "E-Mail eingeben, wir senden einen sicheren Link.",
      magic: "Kein Passwort nötig.",
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
    privacyPolicy: "Datenschutzerklärung",
    setupIntentLabel: "Ich nutze VYVA",
    setupIntent: {
      self: {
        title: "Für mich",
        subtitle: "Mein Konto und mein Pflegeprofil.",
      },
      caregiver: {
        title: "Als Betreuungsperson",
        subtitle: "Pflege für eine andere Person einrichten oder aufrufen.",
      },
    },
    caregiverHint: "Konten für Betreuungspersonen bleiben vom Pflegeprofil getrennt. Die unterstützte Person behält Kontrolle über Zustimmung und Bestätigung.",
    checkInbox: "Posteingang prüfen",
    resetSentBody: "Falls ein Konto existiert, ist der Link unterwegs.",
    backToSignIn: "Zurück zur Anmeldung",
    linkSent: "Link gesendet",
    useWithin: "Innerhalb von 15 Minuten verwenden.",
    backToPassword: "Zurück zum Passwort",
    alreadyHaveAccount: "Sie haben bereits ein Konto?",
    dontHaveAccount: "Noch kein Konto?",
    guide: {
      notSure: "Unsicher?",
      title: "VYVA fragen",
      helperSubtitle: "Sprich mit VYVA, wähle eine kurze Frage oder tippe deine eigene.",
      quickAnswer: "Kurze Antwort",
      talk: "Sprechen",
      end: "Beenden",
      connecting: "...",
      typeQuestion: "Frage eingeben",
      ask: "Fragen...",
      topics: {
        why: { label: "Warum ein Konto?", body: "Damit VYVA deinen Pflegekontext sicher behalten kann." },
        privacy: { label: "Ist es privat?", body: "Gesundheit und Medikamente bleiben im Konto geschützt." },
        family: { label: "Familienhilfe", body: "Familie kann helfen, aber du steuerst die Freigabe." },
      },
    },
    errors: {
      generic: "Etwas ist schiefgelaufen. Bitte erneut versuchen.",
      requestFailed: "Anfrage fehlgeschlagen. Bitte erneut versuchen.",
      magicFailed: "Link konnte nicht gesendet werden.",
      signInLinkFailed: "Dieser Anmeldelink hat nicht funktioniert.",
      noAgent: "ELEVENLABS_LOGIN_GUIDE_AGENT_ID hinzufügen, um diesen Guide zu aktivieren.",
      noApiKey: "Der Sprachguide braucht den ElevenLabs-API-Schlüssel.",
    },
  },
  it: {
    privateDailySupport: "Supporto quotidiano privato",
    heroTitle: "Supporto privato per la cura quotidiana.",
    heroSubtitle: "Crea un profilo sicuro per salute, farmaci, supporto familiare e controlli quotidiani.",
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
    resetSentBody: "Se l'account esiste, il link è in arrivo.",
    backToSignIn: "Torna all'accesso",
    linkSent: "Link inviato",
    useWithin: "Usalo entro 15 minuti.",
    backToPassword: "Torna alla password",
    alreadyHaveAccount: "Hai già un account?",
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
        why: { label: "Perché un account?", body: "Così VYVA può ricordare il contesto di cura in sicurezza." },
        privacy: { label: "È privato?", body: "Salute e farmaci restano protetti nell'account." },
        family: { label: "Aiuto famiglia", body: "La famiglia può aiutare, ma controlli tu cosa condividere." },
      },
    },
    errors: {
      generic: "Qualcosa è andato storto. Riprova.",
      requestFailed: "Richiesta non riuscita. Riprova.",
      magicFailed: "Impossibile inviare il link.",
      signInLinkFailed: "Questo link di accesso non ha funzionato.",
      noAgent: "Aggiungi ELEVENLABS_LOGIN_GUIDE_AGENT_ID per attivare questa guida.",
      noApiKey: "La guida vocale richiede la chiave ElevenLabs.",
    },
  },
  pt: {
    privateDailySupport: "Apoio diário privado",
    heroTitle: "Apoio privado para o cuidado diário.",
    heroSubtitle: "Crie um perfil seguro para saúde, medicação, apoio familiar e check-ins diários.",
    chips: ["Voz primeiro", "Perfil privado", "Pronto para família"],
    language: "Idioma",
    createTab: "Criar",
    signInTab: "Entrar",
    titles: { register: "Criar conta", login: "Bem-vindo de volta", forgot: "Recuperar acesso", magic: "Link mágico" },
    subtitles: {
      register: "Use email ou telemóvel.",
      login: "Continue com email ou telemóvel.",
      forgot: "Introduza o email e enviaremos um link seguro.",
      magic: "Sem palavra-passe.",
    },
    email: "Email",
    mobile: "Telemóvel",
    mobileNumber: "Número de telemóvel",
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
    sendMagicLink: "Enviar link mágico",
    signInWithMagicLink: "Entrar com link mágico",
    continueWithGoogle: "Continuar com Google",
    usePasswordInstead: "Usar palavra-passe",
    profilePrivate: "O seu perfil continua privado.",
    privacyPolicy: "Política de privacidade",
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
    caregiverHint: "As contas de cuidadores ficam separadas do perfil de cuidado. A pessoa apoiada mantém o controlo do consentimento e da confirmação.",
    checkInbox: "Verifique o email",
    resetSentBody: "Se existir uma conta, o link está a caminho.",
    backToSignIn: "Voltar ao início de sessão",
    linkSent: "Link enviado",
    useWithin: "Use-o nos próximos 15 minutos.",
    backToPassword: "Voltar à palavra-passe",
    alreadyHaveAccount: "Já tem uma conta?",
    dontHaveAccount: "Ainda não tem uma conta?",
    guide: {
      notSure: "Dúvidas?",
      title: "Pergunte à VYVA",
      helperSubtitle: "Fale com a VYVA, escolha uma pergunta rápida ou escreva a sua.",
      quickAnswer: "Resposta rápida",
      talk: "Falar",
      end: "Terminar",
      connecting: "...",
      typeQuestion: "Escreva uma pergunta",
      ask: "Perguntar...",
      topics: {
        why: { label: "Porquê uma conta?", body: "Para a VYVA se lembrar do contexto de cuidado em segurança." },
        privacy: { label: "É privado?", body: "Saúde e medicação ficam protegidas na sua conta." },
        family: { label: "Ajuda da família", body: "A família pode ajudar, mas a partilha é controlada por si." },
      },
    },
    errors: {
      generic: "Algo correu mal. Tente novamente.",
      requestFailed: "Pedido falhou. Tente novamente.",
      magicFailed: "Não foi possível enviar o link.",
      signInLinkFailed: "Este link de acesso não funcionou.",
      noAgent: "Adicione ELEVENLABS_LOGIN_GUIDE_AGENT_ID para ativar este guia.",
      noApiKey: "O guia de voz precisa da chave ElevenLabs.",
    },
  },
  cy: {
    privateDailySupport: "Cymorth dyddiol preifat",
    heroTitle: "Cymorth preifat ar gyfer gofal dyddiol.",
    heroSubtitle: "Crëwch un proffil diogel ar gyfer iechyd, meddyginiaeth, cymorth teuluol a gwiriadau dyddiol.",
    chips: ["Llais yn gyntaf", "Proffil preifat", "Yn barod i'r teulu"],
    language: "Iaith",
    createTab: "Creu",
    signInTab: "Mewngofnodi",
    titles: { register: "Creu cyfrif", login: "Croeso'n ôl", forgot: "Adfer mynediad", magic: "Dolen hud" },
    subtitles: {
      register: "Defnyddiwch e-bost neu ffôn symudol.",
      login: "Parhewch gydag e-bost neu ffôn symudol.",
      forgot: "Rhowch eich e-bost ac anfonwn ddolen ddiogel.",
      magic: "Dim cyfrinair angenrheidiol.",
    },
    email: "E-bost",
    mobile: "Symudol",
    mobileNumber: "Rhif symudol",
    password: "Cyfrinair",
    passwordHint: "8+ nod",
    forgot: "Wedi anghofio?",
    emailPlaceholder: "chi@example.com",
    phonePlaceholder: "+34 600 000 000",
    createPassword: "Creu cyfrinair",
    yourPassword: "Eich cyfrinair",
    creating: "Yn creu...",
    signingIn: "Yn mewngofnodi...",
    sending: "Yn anfon...",
    createAccount: "Creu cyfrif",
    signIn: "Mewngofnodi",
    or: "neu",
    sendResetLink: "Anfon dolen",
    sendMagicLink: "Anfon dolen hud",
    signInWithMagicLink: "Mewngofnodi gyda dolen hud",
    continueWithGoogle: "Parhau gyda Google",
    usePasswordInstead: "Defnyddio cyfrinair",
    profilePrivate: "Mae eich proffil yn aros yn breifat.",
    privacyPolicy: "Polisi preifatrwydd",
    setupIntentLabel: "Rwy'n defnyddio VYVA",
    setupIntent: {
      self: {
        title: "I mi",
        subtitle: "Fy nghyfrif a fy mhroffil gofal.",
      },
      caregiver: {
        title: "Fel gofalwr",
        subtitle: "Sefydlu neu gael mynediad at ofal ar ran rhywun arall.",
      },
    },
    caregiverHint: "Mae cyfrifon gofalwyr yn aros ar wahân i'r proffil gofal. Mae'r person sy'n cael cymorth yn cadw rheolaeth dros gydsyniad a chadarnhad.",
    checkInbox: "Gwiriwch eich mewnflwch",
    resetSentBody: "Os oes cyfrif, mae'r ddolen ar ei ffordd.",
    backToSignIn: "Yn ôl i fewngofnodi",
    linkSent: "Dolen wedi'i hanfon",
    useWithin: "Defnyddiwch o fewn 15 munud.",
    backToPassword: "Yn ôl i gyfrinair",
    alreadyHaveAccount: "Oes gennych gyfrif yn barod?",
    dontHaveAccount: "Dim cyfrif eto?",
    guide: {
      notSure: "Ddim yn siŵr?",
      title: "Gofynnwch i VYVA",
      helperSubtitle: "Siaradwch â VYVA, dewiswch gwestiwn cyflym, neu teipiwch eich un chi.",
      quickAnswer: "Ateb cyflym",
      talk: "Siarad",
      end: "Gorffen",
      connecting: "...",
      typeQuestion: "Teipiwch gwestiwn",
      ask: "Gofyn...",
      topics: {
        why: { label: "Pam cyfrif?", body: "Fel bod VYVA yn cofio cyd-destun gofal yn ddiogel." },
        privacy: { label: "A yw'n breifat?", body: "Mae iechyd a meddyginiaeth yn cael eu diogelu yn eich cyfrif." },
        family: { label: "Cymorth teulu", body: "Gall teulu helpu, ond chi sy'n rheoli'r rhannu." },
      },
    },
    errors: {
      generic: "Aeth rhywbeth o'i le. Rhowch gynnig arall.",
      requestFailed: "Methodd y cais. Rhowch gynnig arall.",
      magicFailed: "Methu anfon y ddolen.",
      signInLinkFailed: "Ni weithiodd y ddolen mewngofnodi hon.",
      noAgent: "Ychwanegwch ELEVENLABS_LOGIN_GUIDE_AGENT_ID i alluogi'r canllaw hwn.",
      noApiKey: "Mae angen allwedd ElevenLabs ar y canllaw llais.",
    },
  },
};

function createLoginGuideConversationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `login-guide-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function LoginPage({ adminOnly = false }: { adminOnly?: boolean }) {
  const { login, register, requestMagicLink, loginWithMagicToken, user, isLoading } = useAuth();
  const { language, setLanguage, languages } = useLanguage();
  const copy = LOGIN_COPY[language] ?? LOGIN_COPY.es;
  const {
    startVoice,
    stopVoice,
    status: guideVoiceStatus,
    isSpeaking: isGuideSpeaking,
    isConnecting: isGuideConnecting,
    lastError: guideVoiceError,
    transcript: guideTranscript,
  } = useVyvaVoice();
  const navigate = useNavigate();
  const location = useLocation();
  const rawFrom = (location.state as { from?: string })?.from;
  const from = adminOnly ? "/admin/lifecycle" : rawFrom && rawFrom !== "/onboarding" ? rawFrom : null;

  const [mode, setMode] = useState<"login" | "register">(adminOnly ? "login" : "register");
  const [view, setView] = useState<View>(adminOnly ? "login" : "register");
  const [setupIntent, setSetupIntent] = useState<SetupIntent>("self");
  const [contact, setContact] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPasswordSignIn, setShowPasswordSignIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guideTopic: GuideTopic = "why";
  const [guideSessionMode, setGuideSessionMode] = useState<"voice" | "text" | null>(null);
  const magicTokenHandledRef = useRef(false);

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicError, setMagicError] = useState<string | null>(null);

  const switchTab = (tab: "login" | "register") => {
    if (adminOnly && tab === "register") return;
    setMode(tab);
    setView(tab);
    setError(null);
    setMagicError(null);
    setShowPasswordSignIn(false);
  };

  const showForgot = () => {
    setForgotEmail(contact.trim().includes("@") ? contact : "");
    setForgotSent(false);
    setForgotError(null);
    setView("forgot");
  };

  const showMagic = () => {
    setMode("login");
    setView("magic");
    setMagicSent(false);
    setMagicError(null);
    setShowPasswordSignIn(false);
  };

  const authContactPayload = (includeLanguage = false) => {
    const trimmedContact = contact.trim();
    return {
      ...(trimmedContact.includes("@") ? { email: trimmedContact } : { phone: trimmedContact }),
      ...(includeLanguage ? { language } : {}),
    };
  };

  const rememberSetupIntent = () => {
    const setupFor = setupIntent === "caregiver" ? "someone_else" : "self";
    window.sessionStorage.setItem("vyva_setup_for", setupFor);
    return setupFor;
  };

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (adminOnly) {
      navigate("/admin/lifecycle", { replace: true });
      return;
    }
    queryClient
      .fetchQuery({ queryKey: ["/api/onboarding/state"] })
      .then((data: { onboardingState?: { current_stage?: string }; profile?: { current_stage?: string } }) => {
        const stage = data?.onboardingState?.current_stage ?? data?.profile?.current_stage;
        navigate(stageToRoute(stage), { replace: true });
      })
      .catch(() => navigate("/onboarding/basics", { replace: true }));
  }, [adminOnly, isLoading, user, navigate]);

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
        setMagicError(err instanceof Error ? err.message : copy.errors.signInLinkFailed);
      })
      .finally(() => setMagicLoading(false));
  }, [copy.errors.signInLinkFailed, location.search, loginWithMagicToken, user]);

  useEffect(() => () => stopVoice(), [stopVoice]);

  useEffect(() => {
    if (!adminOnly) return;
    setMode("login");
    setView("login");
    setShowPasswordSignIn(true);
  }, [adminOnly]);

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
    if (guideVoiceStatus === "idle" && !isGuideConnecting) {
      setGuideSessionMode(null);
    }
  }, [guideVoiceStatus, isGuideConnecting]);

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
        await register(authContactPayload(true), password);
        navigate("/onboarding/who-for", { replace: true, state: { setupFor } });
      } else {
        const setupFor = rememberSetupIntent();
        await login(authContactPayload(), password);
        if (from) {
          navigate(from, { replace: true });
        } else {
          const data = await queryClient.fetchQuery({ queryKey: ["/api/onboarding/state"] }).catch(() => null);
          const stage =
            (data as { onboardingState?: { current_stage?: string }; profile?: { current_stage?: string } } | null)
              ?.onboardingState?.current_stage ??
            (data as { onboardingState?: { current_stage?: string }; profile?: { current_stage?: string } } | null)
              ?.profile?.current_stage;
          navigate(stageToRoute(stage), { replace: true, state: { setupFor } });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errors.generic);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (forgotLoading) return;
    setForgotError(null);
    setForgotLoading(true);
    try {
      const email = forgotEmail.trim();
      if (await isSupabaseAuthAvailable()) {
        await sendSupabasePasswordReset(email);
      } else {
        const res = await fetch("/api/auth/reset-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || copy.errors.requestFailed);
        }
      }
      setForgotSent(true);
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : copy.errors.generic);
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
      setMagicError(err instanceof Error ? err.message : copy.errors.magicFailed);
    } finally {
      setMagicLoading(false);
    }
  };

  const handleGuideVoiceToggle = () => {
    if (guideVoiceStatus === "connected" || guideVoiceStatus === "connecting" || isGuideConnecting) {
      stopVoice();
      return;
    }
    void startLoginGuide({ textOnly: false });
  };

  const trimmedContact = contact.trim();
  const contactIsEmail = trimmedContact.includes("@");
  const contactIsReady = trimmedContact.length >= (contactIsEmail ? 4 : 7);
  const canSubmit = contactIsReady && password.length >= (mode === "register" ? 8 : 1) && !loading;
  const canSendReset = forgotEmail.trim().length > 3 && !forgotLoading;
  const canSendMagic = contactIsReady && !magicLoading;
  const isGuideLive = guideVoiceStatus === "connected" || guideVoiceStatus === "connecting" || isGuideConnecting;
  const isGuideVoiceOverlayVisible = isGuideLive && guideSessionMode === "voice";
  const guideVoiceErrorText = guideVoiceError
    ? guideVoiceError.toLowerCase().includes("no elevenlabs agent configured")
      ? copy.errors.noAgent
      : guideVoiceError.toLowerCase().includes("missing elevenlabs api key")
        ? copy.errors.noApiKey
        : guideVoiceError
    : null;
  const contactLabel = copy.combinedContact ?? `${copy.mobileNumber} / ${copy.email}`;
  const contactPlaceholder = contactLabel;
  const contactAutocomplete = "username";
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
  const switchPrompt = mode === "register" ? copy.alreadyHaveAccount : copy.dontHaveAccount;
  const googleButton = (
    <button
      type="button"
      aria-disabled="true"
      title="Google OAuth is not connected yet"
      className="inline-flex min-h-[52px] w-full items-center justify-center gap-3 rounded-full border border-[#E8DDF3] bg-white px-4 py-3 font-body text-[14px] font-extrabold text-vyva-text-1 shadow-vyva-input transition hover:border-[#D8C2EF]"
      data-testid="button-google-auth"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F8F3EA] font-body text-[17px] font-black text-[#4285F4]">
        G
      </span>
      {copy.continueWithGoogle}
    </button>
  );
  const authDivider = (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-[#EEE4D8]" />
      <span className="font-body text-[12px] font-bold text-vyva-text-3">{copy.or}</span>
      <span className="h-px flex-1 bg-[#EEE4D8]" />
    </div>
  );

  return (
    <>
      {isGuideVoiceOverlayVisible && (
        <VoiceCallOverlay
          isSpeaking={isGuideSpeaking}
          isConnecting={isGuideConnecting}
          transcript={guideTranscript}
          onEnd={stopVoice}
        />
      )}

      <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,#FFF8EA_0%,#FFF9F1_38%,#F7F1EA_100%)] text-vyva-text-1">
        <header className="relative z-10 mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4 px-5 pb-3 pt-4 sm:px-8 sm:py-5 lg:py-7">
          <VyvaWordmark className="h-auto w-[132px] sm:w-[158px]" />
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
        </header>

        <main className="relative z-10 mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-[1120px] items-start justify-center px-5 pb-8 pt-2 sm:px-8 md:min-h-[calc(100vh-108px)] md:items-center md:pt-0 lg:pb-12">
          <section
            data-testid="auth-layout"
            className="grid w-full max-w-[540px] gap-5 md:max-w-[1000px] md:grid-cols-[minmax(0,0.9fr)_minmax(420px,500px)] md:items-center lg:max-w-[1080px] lg:gap-10"
          >
            {adminOnly ? (
              <div className="text-center md:text-left">
                <p className="mb-3 font-body text-[11px] font-extrabold uppercase tracking-[0.26em] text-vyva-purple/70">
                  VYVA Admin
                </p>
                <h1 className="font-display text-[38px] leading-[0.98] text-[#2E1642] sm:text-[58px] md:max-w-[430px] md:text-[48px] lg:text-[58px]">
                  Operations access
                </h1>
                <p className="mx-auto mt-4 max-w-[380px] font-body text-[15px] leading-[1.55] text-vyva-text-2 md:mx-0">
                  Sign in with an approved admin account to manage lifecycle, content, and access.
                </p>
                <div className="mt-6 hidden flex-wrap justify-center gap-2 sm:flex md:justify-start" aria-label="VYVA account highlights">
                  {copy.chips.map((chip) => (
                    <span key={chip} className="rounded-full border border-[#E8DDF3] bg-white/72 px-3 py-2 font-body text-[12px] font-extrabold text-vyva-purple shadow-sm">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center md:text-left">
                <p className="mb-3 font-body text-[11px] font-extrabold uppercase tracking-[0.26em] text-vyva-purple/70">
                  {copy.privateDailySupport}
                </p>
                <h1 className="font-display text-[38px] leading-[0.94] text-[#2E1642] sm:text-[66px] md:max-w-[470px] md:text-[52px] lg:text-[66px]">
                  {copy.heroTitle}
                </h1>
                <p className="mx-auto mt-4 max-w-[430px] font-body text-[15px] leading-[1.55] text-vyva-text-2 md:mx-0">
                  {copy.heroSubtitle}
                </p>
                <div className="mt-6 hidden flex-wrap justify-center gap-2 sm:flex md:justify-start" aria-label="VYVA account highlights">
                  {copy.chips.map((chip) => (
                    <span key={chip} className="rounded-full border border-[#E8DDF3] bg-white/72 px-3 py-2 font-body text-[12px] font-extrabold text-vyva-purple shadow-sm">
                      {chip}
                    </span>
                  ))}
                </div>

                <div className="mt-5 hidden flex-col items-center gap-2 md:flex md:items-start">
                  <button
                    type="button"
                    onClick={handleGuideVoiceToggle}
                    className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2 font-body text-[13px] font-extrabold shadow-[0_12px_30px_rgba(107,33,168,0.12)] backdrop-blur ${
                      isGuideLive
                        ? "border-[#E8DDF3] bg-white text-vyva-purple"
                        : "border-transparent bg-vyva-purple text-white"
                    }`}
                    data-testid="button-login-guide-voice"
                  >
                    {isGuideConnecting ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : isGuideLive ? (
                      <X size={15} />
                    ) : (
                      <Mic size={15} />
                    )}
                    {isGuideConnecting ? copy.guide.connecting : isGuideLive ? copy.guide.end : copy.guide.title}
                  </button>

                  {guideVoiceErrorText && (
                    <p className="max-w-[420px] rounded-[16px] bg-[#FFF9E8] px-4 py-3 text-center font-body text-[12px] leading-[1.5] text-[#855F00]">
                      {guideVoiceErrorText}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div
              data-testid="auth-card"
              className="w-full rounded-[28px] border border-[#EFE7DB] bg-white/96 p-5 shadow-[0_24px_70px_rgba(72,44,18,0.14)] backdrop-blur sm:rounded-[30px] sm:p-7 md:justify-self-end"
            >
              <div className="mb-5">
                <h2 className="font-display text-[36px] leading-tight text-vyva-text-1">{authTitle}</h2>
                <p className="mt-1 font-body text-[14px] text-vyva-text-2">{authSubtitle}</p>
              </div>

              {view === "forgot" ? (
                <div className="flex flex-col gap-4">
                  {forgotSent ? (
                    <div data-testid="text-forgot-success" className="rounded-[24px] bg-[#ECFDF5] px-5 py-6 text-center">
                      <CheckCircle2 size={34} className="mx-auto mb-3 text-vyva-green" />
                      <p className="font-body text-[16px] font-bold">{copy.checkInbox}</p>
                      <p className="mt-1 font-body text-[13px] leading-[1.55] text-vyva-text-2">{copy.resetSentBody}</p>
                    </div>
                  ) : (
                    <>
                      <label className="font-body text-[13px] font-bold text-vyva-text-2">
                        {copy.email}
                        <Input
                          data-testid="input-forgot-email"
                          type="email"
                          value={forgotEmail}
                          onChange={(event) => setForgotEmail(event.target.value)}
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
                  {!adminOnly && (
                    <div className="space-y-2" data-testid="auth-setup-intent">
                      <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.08em] text-vyva-text-3">
                        {copy.setupIntentLabel}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {(["self", "caregiver"] as const).map((intent) => {
                          const active = setupIntent === intent;
                          const Icon = intent === "self" ? UserRound : UsersRound;
                          return (
                            <button
                              key={intent}
                              type="button"
                              onClick={() => setSetupIntent(intent)}
                              data-testid={`button-auth-intent-${intent}`}
                              className={`flex min-h-[58px] items-center gap-2 rounded-[18px] border px-2.5 py-2 text-left transition sm:min-h-[74px] sm:gap-3 sm:px-3 sm:py-2.5 ${
                                active
                                  ? "border-vyva-purple bg-[#F5F0FF] text-vyva-text-1 shadow-[0_10px_24px_rgba(107,33,168,0.10)]"
                                  : "border-[#EFE7DB] bg-white text-vyva-text-2 hover:border-[#E1D6C8]"
                              }`}
                            >
                              <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[13px] ${active ? "bg-vyva-purple text-white" : "bg-[#F8F3EA] text-vyva-purple"}`}>
                                <Icon size={18} />
                              </span>
                              <span className="min-w-0">
                                <span className="block font-body text-[12px] font-extrabold leading-tight sm:text-[13px]">{copy.setupIntent[intent].title}</span>
                                <span className="mt-0.5 hidden font-body text-[11px] leading-[1.3] text-vyva-text-2 sm:block">{copy.setupIntent[intent].subtitle}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {setupIntent === "caregiver" && (
                        <p data-testid="text-auth-caregiver-hint" className="rounded-[16px] border border-[#E8DDF3] bg-[#FBF8FF] px-3 py-2 font-body text-[12px] leading-[1.45] text-vyva-purple">
                          {copy.caregiverHint}
                        </p>
                      )}
                    </div>
                  )}

                  <label className="font-body text-[13px] font-bold text-vyva-text-2">
                    {contactLabel}
                    <Input
                      data-testid="input-auth-contact"
                      type="text"
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
                      className="mt-2 h-[58px] rounded-[20px] border-vyva-border bg-white px-4 text-[16px] shadow-vyva-input"
                      autoComplete={contactAutocomplete}
                    />
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
                            className="h-[58px] rounded-[20px] border-vyva-border bg-white px-4 pr-12 shadow-vyva-input"
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
                        className="vyva-primary-action w-full bg-[linear-gradient(135deg,#6B21A8_0%,#8B3FC8_100%)] py-4 shadow-vyva-fab disabled:opacity-40"
                      >
                        {loading ? copy.creating : copy.createAccount}
                        {!loading && <ArrowRight size={17} />}
                      </button>

                      {authDivider}
                      {googleButton}
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
                            className="h-[58px] rounded-[20px] border-vyva-border bg-white px-4 pr-12 shadow-vyva-input"
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
                        className="vyva-primary-action w-full bg-[linear-gradient(135deg,#6B21A8_0%,#8B3FC8_100%)] py-4 shadow-vyva-fab disabled:opacity-40"
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

                          {authDivider}
                          {googleButton}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {magicSent ? (
                        <div data-testid="text-magic-success" className="rounded-[24px] bg-[#ECFDF5] px-5 py-6 text-center">
                          <CheckCircle2 size={34} className="mx-auto mb-3 text-vyva-green" />
                          <p className="font-body text-[16px] font-bold">{copy.linkSent}</p>
                          <p className="mt-1 font-body text-[13px] leading-[1.55] text-vyva-text-2">{copy.useWithin}</p>
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
                            className="vyva-primary-action w-full bg-[linear-gradient(135deg,#6B21A8_0%,#8B3FC8_100%)] py-4 shadow-vyva-fab disabled:opacity-40"
                          >
                            {magicLoading ? copy.sending : copy.sendMagicLink}
                            {!magicLoading && <Link2 size={17} />}
                          </button>
                        </>
                      )}

                      {authDivider}
                      {googleButton}

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

                  {!adminOnly && (
                    <p className="text-center font-body text-[13px] text-vyva-text-2">
                      {switchPrompt}{" "}
                      <button
                        type="button"
                        onClick={() => switchTab(mode === "register" ? "login" : "register")}
                        className="font-extrabold text-vyva-purple"
                        data-testid="button-auth-switch-mode"
                      >
                        {mode === "register" ? copy.signInTab : copy.createTab}
                      </button>
                    </p>
                  )}

                  <div className="flex flex-col items-center justify-center gap-1 rounded-[22px] bg-[#FFF9E8] px-4 py-3 text-center sm:flex-row sm:gap-2 sm:rounded-full">
                    <span className="inline-flex items-center justify-center gap-2">
                      <ShieldCheck size={16} className="text-[#B98900]" />
                      <span className="font-body text-[12px] font-bold text-[#8A6500]">{copy.profilePrivate}</span>
                    </span>
                    <a
                      href="https://vyva.life/privacypolicy"
                      target="_blank"
                      rel="noreferrer"
                      data-testid="link-privacy-policy"
                      className="font-body text-[12px] font-extrabold text-vyva-purple underline-offset-4 hover:underline"
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
