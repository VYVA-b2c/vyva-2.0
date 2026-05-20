export const SIGNUP_INVITE_LANGUAGE_CODES = ["en", "es", "fr", "de", "it", "pt"] as const;

export type SignupInviteLanguage = (typeof SIGNUP_INVITE_LANGUAGE_CODES)[number];

export type SignupInviteBenefit = {
  label: string;
  title: string;
  body: string;
};

export type SignupInviteCopy = {
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  defaultIntro: string;
  summary: string;
  featureTitle: string;
  benefits: [SignupInviteBenefit, SignupInviteBenefit, SignupInviteBenefit];
  reassurance: string;
  cta: string;
  startHere: string;
  fallback: string;
  ignore: string;
};

const SIGNUP_INVITE_COPY: Record<SignupInviteLanguage, SignupInviteCopy> = {
  en: {
    subject: "Welcome to VYVA",
    preheader: "Simple 24/7 support for medicines, daily check-ins, everyday help, and peace of mind.",
    eyebrow: "Voice-first care",
    title: "Meet VYVA, your voice-first care companion",
    defaultIntro: "VYVA is ready for you.",
    summary: "Simple 24/7 support for medicines, daily check-ins, everyday help, and peace of mind for the people who care about you.",
    featureTitle: "How VYVA helps",
    benefits: [
      {
        label: "DOSE",
        title: "Never miss a dose",
        body: "Friendly reminders, confirmations, and gentle follow-ups help you stay on track.",
      },
      {
        label: "HELP",
        title: "Help with life's little things",
        body: "Ask for support with appointments, rides, trusted services, or everyday questions.",
      },
      {
        label: "FAMILY",
        title: "Keep family close",
        body: "Loved ones can receive helpful updates when something needs attention.",
      },
    ],
    reassurance: "Start when you are ready. You stay in control.",
    cta: "Start with VYVA",
    startHere: "Start here",
    fallback: "If the button does not work, copy and paste this link into your browser:",
    ignore: "This invitation was sent using a secure VYVA signup link. If you were not expecting it, you can ignore this email.",
  },
  es: {
    subject: "Bienvenido a VYVA",
    preheader: "Apoyo sencillo 24/7 para medicinas, chequeos diarios, ayuda cotidiana y tranquilidad.",
    eyebrow: "Cuidado por voz",
    title: "Conoce VYVA, tu companera de cuidado por voz",
    defaultIntro: "VYVA esta listo para ti.",
    summary: "Apoyo sencillo 24/7 para medicinas, chequeos diarios, ayuda cotidiana y tranquilidad para quienes te cuidan.",
    featureTitle: "Como te ayuda VYVA",
    benefits: [
      {
        label: "DOSIS",
        title: "No olvides una dosis",
        body: "Recordatorios amables, confirmaciones y seguimientos suaves para ayudarte a mantenerte al dia.",
      },
      {
        label: "AYUDA",
        title: "Ayuda con las pequenas cosas",
        body: "Pide apoyo con citas, transporte, servicios de confianza o preguntas del dia a dia.",
      },
      {
        label: "FAMILIA",
        title: "Manten cerca a tu familia",
        body: "Tus seres queridos pueden recibir avisos utiles cuando algo necesita atencion.",
      },
    ],
    reassurance: "Empieza cuando quieras. Tu tienes el control.",
    cta: "Empezar con VYVA",
    startHere: "Empieza aqui",
    fallback: "Si el boton no funciona, copia y pega este enlace en tu navegador:",
    ignore: "Esta invitacion se envio mediante un enlace seguro de registro de VYVA. Si no la esperabas, puedes ignorar este email.",
  },
  fr: {
    subject: "Bienvenue sur VYVA",
    preheader: "Un soutien simple 24/7 pour les medicaments, les nouvelles du jour, l'aide pratique et la tranquillite.",
    eyebrow: "Soin par la voix",
    title: "Decouvrez VYVA, votre compagnon de soin par la voix",
    defaultIntro: "VYVA est pret pour vous.",
    summary: "Un soutien simple 24/7 pour les medicaments, les nouvelles du jour, l'aide pratique et la tranquillite de vos proches.",
    featureTitle: "Comment VYVA vous aide",
    benefits: [
      {
        label: "DOSE",
        title: "Ne manquez jamais une dose",
        body: "Des rappels amicaux, des confirmations et des suivis doux vous aident a rester sur la bonne voie.",
      },
      {
        label: "AIDE",
        title: "De l'aide pour les petites choses",
        body: "Demandez de l'aide pour les rendez-vous, les trajets, les services de confiance ou les questions du quotidien.",
      },
      {
        label: "PROCHES",
        title: "Gardez vos proches pres de vous",
        body: "Vos proches peuvent recevoir des nouvelles utiles quand quelque chose demande de l'attention.",
      },
    ],
    reassurance: "Commencez quand vous etes pret. Vous gardez le controle.",
    cta: "Commencer avec VYVA",
    startHere: "Commencer ici",
    fallback: "Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :",
    ignore: "Cette invitation a ete envoyee avec un lien d'inscription securise VYVA. Si vous ne l'attendiez pas, vous pouvez ignorer cet email.",
  },
  de: {
    subject: "Willkommen bei VYVA",
    preheader: "Einfache 24/7 Unterstuetzung fuer Medikamente, taegliche Check-ins, Alltagshilfe und Sicherheit.",
    eyebrow: "Sprachgesteuerte Betreuung",
    title: "Lernen Sie VYVA kennen, Ihre sprachgesteuerte Begleitung im Alltag",
    defaultIntro: "VYVA ist fuer Sie bereit.",
    summary: "Einfache 24/7 Unterstuetzung fuer Medikamente, taegliche Check-ins, Alltagshilfe und Sicherheit fuer Menschen, die sich um Sie kuemmern.",
    featureTitle: "Wie VYVA hilft",
    benefits: [
      {
        label: "DOSIS",
        title: "Keine Dosis verpassen",
        body: "Freundliche Erinnerungen, Bestaetigungen und sanfte Nachfragen helfen Ihnen, dranzubleiben.",
      },
      {
        label: "HILFE",
        title: "Hilfe bei kleinen Dingen",
        body: "Fragen Sie nach Unterstuetzung bei Terminen, Fahrten, vertrauten Diensten oder Alltagsfragen.",
      },
      {
        label: "FAMILIE",
        title: "Familie nah halten",
        body: "Nahestehende Menschen koennen hilfreiche Updates erhalten, wenn etwas Aufmerksamkeit braucht.",
      },
    ],
    reassurance: "Starten Sie, wenn Sie bereit sind. Sie behalten die Kontrolle.",
    cta: "Mit VYVA starten",
    startHere: "Hier starten",
    fallback: "Wenn der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:",
    ignore: "Diese Einladung wurde mit einem sicheren VYVA Registrierungslink gesendet. Wenn Sie diese Einladung nicht erwartet haben, koennen Sie diese E-Mail ignorieren.",
  },
  it: {
    subject: "Benvenuto in VYVA",
    preheader: "Supporto semplice 24/7 per medicine, controlli quotidiani, aiuto pratico e serenita.",
    eyebrow: "Cura guidata dalla voce",
    title: "Conosci VYVA, la tua compagna di supporto vocale",
    defaultIntro: "VYVA e pronto per te.",
    summary: "Supporto semplice 24/7 per medicine, controlli quotidiani, aiuto pratico e serenita per le persone che si prendono cura di te.",
    featureTitle: "Come ti aiuta VYVA",
    benefits: [
      {
        label: "DOSE",
        title: "Non saltare una dose",
        body: "Promemoria amichevoli, conferme e controlli gentili ti aiutano a restare in carreggiata.",
      },
      {
        label: "AIUTO",
        title: "Aiuto con le piccole cose",
        body: "Chiedi supporto per appuntamenti, trasporti, servizi fidati o domande di ogni giorno.",
      },
      {
        label: "FAMIGLIA",
        title: "Tieni vicina la famiglia",
        body: "I tuoi cari possono ricevere aggiornamenti utili quando qualcosa richiede attenzione.",
      },
    ],
    reassurance: "Inizia quando sei pronto. Il controllo resta a te.",
    cta: "Inizia con VYVA",
    startHere: "Inizia qui",
    fallback: "Se il pulsante non funziona, copia e incolla questo link nel browser:",
    ignore: "Questo invito e stato inviato con un link sicuro di registrazione VYVA. Se non lo aspettavi, puoi ignorare questa email.",
  },
  pt: {
    subject: "Bem-vindo a VYVA",
    preheader: "Apoio simples 24/7 para medicacao, check-ins diarios, ajuda no dia a dia e tranquilidade.",
    eyebrow: "Cuidado por voz",
    title: "Conheca a VYVA, a sua companhia de cuidado por voz",
    defaultIntro: "A VYVA esta pronta para si.",
    summary: "Apoio simples 24/7 para medicacao, check-ins diarios, ajuda no dia a dia e tranquilidade para quem se preocupa consigo.",
    featureTitle: "Como a VYVA ajuda",
    benefits: [
      {
        label: "DOSE",
        title: "Nunca falhe uma dose",
        body: "Lembretes amigaveis, confirmacoes e acompanhamentos suaves ajudam-no a manter-se no caminho certo.",
      },
      {
        label: "AJUDA",
        title: "Ajuda com as pequenas coisas",
        body: "Peca apoio para consultas, transportes, servicos de confianca ou perguntas do dia a dia.",
      },
      {
        label: "FAMILIA",
        title: "Mantenha a familia por perto",
        body: "Os seus familiares podem receber atualizacoes uteis quando algo precisar de atencao.",
      },
    ],
    reassurance: "Comece quando estiver pronto. Mantem sempre o controlo.",
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
