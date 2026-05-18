export const SIGNUP_INVITE_LANGUAGE_CODES = ["en", "es", "fr", "de", "it", "pt"] as const;

export type SignupInviteLanguage = (typeof SIGNUP_INVITE_LANGUAGE_CODES)[number];

export type SignupInviteCopy = {
  subject: string;
  title: string;
  defaultIntro: string;
  summary: string;
  cta: string;
  startHere: string;
  fallback: string;
  ignore: string;
};

const SIGNUP_INVITE_COPY: Record<SignupInviteLanguage, SignupInviteCopy> = {
  en: {
    subject: "Your VYVA invitation",
    title: "Welcome to VYVA",
    defaultIntro: "A private companion space is ready for you.",
    summary: "Keep health details, reminders, family support, and everyday help close at hand.",
    cta: "Start setup",
    startHere: "Start here",
    fallback: "If the button does not work, copy and paste this link into your browser:",
    ignore: "You received this invitation because someone asked VYVA to send you a secure signup link. If you were not expecting it, you can ignore this email.",
  },
  es: {
    subject: "Tu invitacion a VYVA",
    title: "Bienvenido a VYVA",
    defaultIntro: "Tu espacio privado de compania ya esta listo.",
    summary: "Ten cerca tus datos de salud, recordatorios, apoyo familiar y ayuda diaria.",
    cta: "Empezar",
    startHere: "Empieza aqui",
    fallback: "Si el boton no funciona, copia y pega este enlace en tu navegador:",
    ignore: "Has recibido esta invitacion porque alguien pidio a VYVA que te enviara un enlace seguro de registro. Si no la esperabas, puedes ignorar este email.",
  },
  fr: {
    subject: "Votre invitation VYVA",
    title: "Bienvenue chez VYVA",
    defaultIntro: "Votre espace compagnon prive est pret.",
    summary: "Gardez sante, rappels, soutien familial et aide quotidienne a portee de main.",
    cta: "Commencer",
    startHere: "Commencer ici",
    fallback: "Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :",
    ignore: "Vous recevez cette invitation parce que quelqu'un a demande a VYVA de vous envoyer un lien d'inscription securise. Si vous ne l'attendiez pas, vous pouvez ignorer cet email.",
  },
  de: {
    subject: "Ihre VYVA Einladung",
    title: "Willkommen bei VYVA",
    defaultIntro: "Ihr privater Begleiterbereich ist bereit.",
    summary: "Halten Sie Gesundheit, Erinnerungen, Familienhilfe und Alltagshilfe griffbereit.",
    cta: "Einrichtung starten",
    startHere: "Hier starten",
    fallback: "Wenn der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:",
    ignore: "Sie erhalten diese Einladung, weil jemand VYVA gebeten hat, Ihnen einen sicheren Registrierungslink zu senden. Wenn Sie diese Einladung nicht erwartet haben, koennen Sie diese E-Mail ignorieren.",
  },
  it: {
    subject: "Il tuo invito VYVA",
    title: "Benvenuto in VYVA",
    defaultIntro: "Il tuo spazio compagno privato e pronto.",
    summary: "Tieni salute, promemoria, supporto familiare e aiuto quotidiano sempre a portata di mano.",
    cta: "Inizia",
    startHere: "Inizia qui",
    fallback: "Se il pulsante non funziona, copia e incolla questo link nel browser:",
    ignore: "Hai ricevuto questo invito perche qualcuno ha chiesto a VYVA di inviarti un link sicuro per la registrazione. Se non lo aspettavi, puoi ignorare questa email.",
  },
  pt: {
    subject: "O seu convite VYVA",
    title: "Bem-vindo a VYVA",
    defaultIntro: "O seu espaco privado de companhia esta pronto.",
    summary: "Mantenha saude, lembretes, apoio familiar e ajuda diaria sempre por perto.",
    cta: "Comecar",
    startHere: "Comece aqui",
    fallback: "Se o botao nao funcionar, copie e cole este link no seu navegador:",
    ignore: "Recebeu este convite porque alguem pediu a VYVA para lhe enviar um link seguro de registo. Se nao estava a espera, pode ignorar este email.",
  },
};

export function normalizeSignupInviteLanguage(value: unknown): SignupInviteLanguage {
  return typeof value === "string" && SIGNUP_INVITE_LANGUAGE_CODES.includes(value as SignupInviteLanguage)
    ? value as SignupInviteLanguage
    : "en";
}

export function signupInviteCopyFor(value: unknown): SignupInviteCopy {
  return SIGNUP_INVITE_COPY[normalizeSignupInviteLanguage(value)];
}

export function buildSignupInviteUrl(baseUrl: string, value: unknown): string {
  const language = normalizeSignupInviteLanguage(value);
  return `${baseUrl.replace(/\/$/, "")}/invite?lang=${encodeURIComponent(language)}`;
}
