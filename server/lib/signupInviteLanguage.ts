export const SIGNUP_INVITE_LANGUAGE_CODES = ["en", "es", "fr", "de", "it", "pt"] as const;

export type SignupInviteLanguage = (typeof SIGNUP_INVITE_LANGUAGE_CODES)[number];

export type SignupInviteCopy = {
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  defaultIntro: string;
  summary: string;
  featureTitle: string;
  features: [string, string, string];
  reassurance: string;
  cta: string;
  startHere: string;
  fallback: string;
  ignore: string;
};

const SIGNUP_INVITE_COPY: Record<SignupInviteLanguage, SignupInviteCopy> = {
  en: {
    subject: "Welcome to VYVA",
    preheader: "A simple way to remember what matters, stay supported, and keep help close.",
    eyebrow: "Simple everyday support",
    title: "A helping hand, always close",
    defaultIntro: "VYVA is ready for you.",
    summary: "Remember what matters, keep family close, and get simple help when you need it.",
    featureTitle: "How VYVA helps",
    features: [
      "Helpful reminders for medicines, appointments, and daily tasks",
      "Trusted family support, only when you choose",
      "Quick everyday help when something feels unclear",
    ],
    reassurance: "You stay in control.",
    cta: "Start VYVA",
    startHere: "Start here",
    fallback: "If the button does not work, copy and paste this link into your browser:",
    ignore: "This invitation was sent using a secure VYVA signup link. If you were not expecting it, you can ignore this email.",
  },
  es: {
    subject: "Bienvenido a VYVA",
    preheader: "Una forma sencilla de recordar lo importante, sentir apoyo y tener ayuda cerca.",
    eyebrow: "Apoyo sencillo cada dia",
    title: "Una ayuda cercana, cuando la necesites",
    defaultIntro: "VYVA esta listo para ti.",
    summary: "Recuerda lo importante, mantente cerca de tu familia y recibe ayuda sencilla cuando la necesites.",
    featureTitle: "Como ayuda VYVA",
    features: [
      "Recordatorios para medicinas, citas y tareas diarias",
      "Apoyo de personas de confianza, solo cuando tu quieras",
      "Ayuda rapida cuando algo no este claro",
    ],
    reassurance: "Tu tienes el control.",
    cta: "Empezar con VYVA",
    startHere: "Empieza aqui",
    fallback: "Si el boton no funciona, copia y pega este enlace en tu navegador:",
    ignore: "Esta invitacion se envio mediante un enlace seguro de registro de VYVA. Si no la esperabas, puedes ignorar este email.",
  },
  fr: {
    subject: "Bienvenue sur VYVA",
    preheader: "Une facon simple de se souvenir de l'essentiel, de rester soutenu et de garder l'aide a portee.",
    eyebrow: "Soutien simple au quotidien",
    title: "Une aide simple, toujours proche",
    defaultIntro: "VYVA est pret pour vous.",
    summary: "Souvenez-vous de l'essentiel, gardez vos proches pres de vous et recevez une aide simple quand vous en avez besoin.",
    featureTitle: "Comment VYVA aide",
    features: [
      "Rappels utiles pour medicaments, rendez-vous et taches du jour",
      "Soutien de proches de confiance, seulement si vous le souhaitez",
      "Aide rapide quand quelque chose n'est pas clair",
    ],
    reassurance: "Vous gardez le controle.",
    cta: "Commencer avec VYVA",
    startHere: "Commencer ici",
    fallback: "Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :",
    ignore: "Cette invitation a ete envoyee avec un lien d'inscription securise VYVA. Si vous ne l'attendiez pas, vous pouvez ignorer cet email.",
  },
  de: {
    subject: "Willkommen bei VYVA",
    preheader: "Eine einfache Art, Wichtiges zu merken, Unterstuetzung zu behalten und Hilfe nah zu haben.",
    eyebrow: "Einfache Alltagshilfe",
    title: "Eine helfende Hand, immer nah",
    defaultIntro: "VYVA ist fuer Sie bereit.",
    summary: "Merken Sie sich Wichtiges, halten Sie Familie nah und bekommen Sie einfache Hilfe, wenn Sie sie brauchen.",
    featureTitle: "Wie VYVA hilft",
    features: [
      "Hilfreiche Erinnerungen fuer Medikamente, Termine und taegliche Aufgaben",
      "Unterstuetzung durch vertraute Personen, nur wenn Sie es moechten",
      "Schnelle Alltagshilfe, wenn etwas unklar ist",
    ],
    reassurance: "Sie behalten die Kontrolle.",
    cta: "Mit VYVA starten",
    startHere: "Hier starten",
    fallback: "Wenn der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:",
    ignore: "Diese Einladung wurde mit einem sicheren VYVA Registrierungslink gesendet. Wenn Sie diese Einladung nicht erwartet haben, koennen Sie diese E-Mail ignorieren.",
  },
  it: {
    subject: "Benvenuto in VYVA",
    preheader: "Un modo semplice per ricordare cio che conta, sentirti supportato e avere aiuto vicino.",
    eyebrow: "Supporto semplice ogni giorno",
    title: "Un aiuto semplice, sempre vicino",
    defaultIntro: "VYVA e pronto per te.",
    summary: "Ricorda cio che conta, tieni vicina la famiglia e ricevi aiuto semplice quando serve.",
    featureTitle: "Come aiuta VYVA",
    features: [
      "Promemoria utili per farmaci, appuntamenti e attivita quotidiane",
      "Supporto di persone fidate, solo quando lo scegli tu",
      "Aiuto rapido quando qualcosa non e chiaro",
    ],
    reassurance: "Il controllo resta a te.",
    cta: "Inizia con VYVA",
    startHere: "Inizia qui",
    fallback: "Se il pulsante non funziona, copia e incolla questo link nel browser:",
    ignore: "Questo invito e stato inviato con un link sicuro di registrazione VYVA. Se non lo aspettavi, puoi ignorare questa email.",
  },
  pt: {
    subject: "Bem-vindo a VYVA",
    preheader: "Uma forma simples de lembrar o que importa, sentir apoio e ter ajuda por perto.",
    eyebrow: "Apoio simples no dia a dia",
    title: "Uma ajuda simples, sempre por perto",
    defaultIntro: "A VYVA esta pronta para si.",
    summary: "Lembre-se do que importa, mantenha a familia por perto e receba ajuda simples quando precisar.",
    featureTitle: "Como a VYVA ajuda",
    features: [
      "Lembretes uteis para medicacao, consultas e tarefas diarias",
      "Apoio de pessoas de confianca, apenas quando escolher",
      "Ajuda rapida quando algo nao estiver claro",
    ],
    reassurance: "Mantem sempre o controlo.",
    cta: "Comecar com VYVA",
    startHere: "Comece aqui",
    fallback: "Se o botao nao funcionar, copie e cole este link no seu navegador:",
    ignore: "Este convite foi enviado atraves de um link seguro de registo VYVA. Se nao estava a espera, pode ignorar este email.",
  },
};

const SIGNUP_INVITE_LANGUAGE_ALIASES: Record<string, SignupInviteLanguage> = {
  english: "en",
  ingles: "en",
  spanish: "es",
  espanol: "es",
  castellano: "es",
  french: "fr",
  francais: "fr",
  german: "de",
  deutsch: "de",
  italian: "it",
  italiano: "it",
  portuguese: "pt",
  portugues: "pt",
};

export function normalizeSignupInviteLanguage(value: unknown): SignupInviteLanguage {
  if (typeof value !== "string") return "en";
  const normalized = value.trim().toLowerCase().replace(/_/g, "-");
  if (SIGNUP_INVITE_LANGUAGE_CODES.includes(normalized as SignupInviteLanguage)) {
    return normalized as SignupInviteLanguage;
  }
  const baseLanguage = normalized.split("-")[0];
  if (SIGNUP_INVITE_LANGUAGE_CODES.includes(baseLanguage as SignupInviteLanguage)) {
    return baseLanguage as SignupInviteLanguage;
  }
  return SIGNUP_INVITE_LANGUAGE_ALIASES[normalized] ?? "en";
}

export function signupInviteCopyFor(value: unknown): SignupInviteCopy {
  return SIGNUP_INVITE_COPY[normalizeSignupInviteLanguage(value)];
}

export function buildSignupInviteUrl(baseUrl: string, value: unknown): string {
  const language = normalizeSignupInviteLanguage(value);
  return `${baseUrl.replace(/\/$/, "")}/invite?lang=${encodeURIComponent(language)}`;
}
