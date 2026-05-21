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
  greeting: string;
  defaultIntro: string;
  summary: string;
  outcomeBadge?: string;
  featureTitle: string;
  benefits: [SignupInviteBenefit, ...SignupInviteBenefit[]];
  reassurance: string;
  cta: string;
  startHere: string;
  fallback: string;
  ignore: string;
};

const SIGNUP_INVITE_COPY: Record<SignupInviteLanguage, SignupInviteCopy> = {
  en: {
    subject: "Welcome to VYVA",
    preheader: "One simple companion for health, memory, daily help, engaging chats, and doctor access.",
    eyebrow: "Everyday care companion",
    title: "Feel supported every day",
    greeting: "Dear",
    defaultIntro: "VYVA is ready for you.",
    summary: "One simple companion for health, memory, daily help, engaging chats, and doctor access.",
    outcomeBadge: "More confidence at home",
    featureTitle: "What you can do with VYVA",
    benefits: [
      {
        label: "CARE",
        title: "Health checks",
        body: "Symptom and vital guidance.",
      },
      {
        label: "DR",
        title: "Doctor access",
        body: "A doctor, one click away.",
      },
      {
        label: "DOSE",
        title: "Medication reminders",
        body: "Gentle prompts to stay on track.",
      },
      {
        label: "BRAIN",
        title: "Brain Coach",
        body: "Memory games and mood check-ins.",
      },
      {
        label: "HELP",
        title: "Concierge",
        body: "Rides, errands, trusted help.",
      },
      {
        label: "CHAT",
        title: "Companionship",
        body: "Engaging chats and friendly check-ins.",
      },
    ],
    reassurance: "Set it up once. Use it anytime.",
    cta: "Set up VYVA",
    startHere: "VOICE ACTIVATED, NO DIGITAL SKILLS REQUIRED",
    fallback: "Setup link:",
    ignore: "This invitation was sent using a secure VYVA signup link. If you were not expecting it, you can ignore this email.",
  },
  es: {
    subject: "Bienvenido a VYVA",
    preheader: "Servicios de salud, apoyo con medicacion y acceso a un medico siempre cerca.",
    eyebrow: "Apoyo de salud por voz",
    title: "Conoce VYVA, tu companera de salud en casa",
    greeting: "Estimado/a",
    defaultIntro: "VYVA esta listo para ti.",
    summary: "Apoyo sencillo 24/7 para medicinas, chequeos de sintomas, constantes vitales, cuidado diario y un medico a un clic.",
    featureTitle: "Tu apoyo de salud",
    benefits: [
      {
        label: "SALUD",
        title: "Servicios de salud en casa",
        body: "Revisa sintomas, sigue tus constantes y recibe orientacion sencilla cuando algo no se siente bien.",
      },
      {
        label: "MEDICO",
        title: "Un medico a un clic",
        body: "Cuando necesites mas cuidado, VYVA te ayuda a llegar rapido a un medico.",
      },
      {
        label: "DOSIS",
        title: "No olvides una dosis",
        body: "Recordatorios amables, confirmaciones y seguimientos suaves para ayudarte a mantenerte al dia.",
      },
    ],
    reassurance: "Tu familia puede recibir avisos cuando algo necesita atencion, y tu tienes el control.",
    cta: "Empezar con VYVA",
    startHere: "Empieza aqui",
    fallback: "Enlace de configuracion:",
    ignore: "Esta invitacion se envio mediante un enlace seguro de registro de VYVA. Si no la esperabas, puedes ignorar este email.",
  },
  fr: {
    subject: "Bienvenue sur VYVA",
    preheader: "Services de sante, aide aux medicaments et acces a un medecin toujours a portee.",
    eyebrow: "Sante par la voix",
    title: "Decouvrez VYVA, votre compagnon de sante a domicile",
    greeting: "Cher/Chere",
    defaultIntro: "VYVA est pret pour vous.",
    summary: "Un soutien simple 24/7 pour les medicaments, les symptomes, les constantes, le quotidien et un medecin a portee de clic.",
    featureTitle: "Votre soutien sante",
    benefits: [
      {
        label: "SANTE",
        title: "Des services de sante a domicile",
        body: "Verifiez les symptomes, suivez les constantes et recevez une orientation simple quand quelque chose ne va pas.",
      },
      {
        label: "DR",
        title: "Un medecin a portee de clic",
        body: "Quand vous avez besoin de soins en plus, VYVA vous aide a joindre rapidement un medecin.",
      },
      {
        label: "DOSE",
        title: "Ne manquez jamais une dose",
        body: "Des rappels amicaux, des confirmations et des suivis doux vous aident a rester sur la bonne voie.",
      },
    ],
    reassurance: "Vos proches peuvent etre informes quand quelque chose demande de l'attention, et vous gardez le controle.",
    cta: "Commencer avec VYVA",
    startHere: "Commencer ici",
    fallback: "Lien de configuration :",
    ignore: "Cette invitation a ete envoyee avec un lien d'inscription securise VYVA. Si vous ne l'attendiez pas, vous pouvez ignorer cet email.",
  },
  de: {
    subject: "Willkommen bei VYVA",
    preheader: "Gesundheit, Medikamente und Arztzugang immer in Reichweite.",
    eyebrow: "Gesundheit per Stimme",
    title: "VYVA begleitet Ihre Gesundheit zuhause",
    greeting: "Guten Tag",
    defaultIntro: "VYVA ist fuer Sie bereit.",
    summary: "Einfache 24/7 Hilfe fuer Medikamente, Symptome, Werte, Alltag und einen Arzt mit nur einem Klick.",
    featureTitle: "Ihre Gesundheit",
    benefits: [
      {
        label: "CARE",
        title: "Gesundheit zuhause",
        body: "Symptome pruefen, Werte verfolgen und einfache Orientierung bekommen, wenn sich etwas nicht richtig anfuehlt.",
      },
      {
        label: "ARZT",
        title: "Ein Arzt per Klick",
        body: "Wenn Sie mehr Betreuung brauchen, hilft VYVA Ihnen, schnell einen Arzt zu erreichen.",
      },
      {
        label: "DOSIS",
        title: "Keine Dosis verpassen",
        body: "Freundliche Erinnerungen, Bestaetigungen und sanfte Nachfragen helfen Ihnen, dranzubleiben.",
      },
    ],
    reassurance: "Ihre Familie kann informiert werden, wenn etwas Aufmerksamkeit braucht, und Sie behalten die Kontrolle.",
    cta: "Mit VYVA starten",
    startHere: "Hier starten",
    fallback: "Einrichtungslink:",
    ignore: "Diese Einladung wurde mit einem sicheren VYVA Registrierungslink gesendet. Wenn Sie diese Einladung nicht erwartet haben, koennen Sie diese E-Mail ignorieren.",
  },
  it: {
    subject: "Benvenuto in VYVA",
    preheader: "Servizi sanitari, supporto per i farmaci e accesso a un medico sempre a portata di mano.",
    eyebrow: "Salute guidata dalla voce",
    title: "Conosci VYVA, la tua compagna di salute a casa",
    greeting: "Gentile",
    defaultIntro: "VYVA e pronto per te.",
    summary: "Supporto semplice 24/7 per farmaci, sintomi, parametri vitali, cura quotidiana e un medico a un clic.",
    featureTitle: "Il tuo supporto salute",
    benefits: [
      {
        label: "SALUTE",
        title: "Servizi sanitari a casa",
        body: "Controlla i sintomi, segui i parametri vitali e ricevi indicazioni semplici quando qualcosa non va.",
      },
      {
        label: "MEDICO",
        title: "Un medico a un clic",
        body: "Quando serve piu cura, VYVA ti aiuta a raggiungere rapidamente un medico.",
      },
      {
        label: "DOSE",
        title: "Non saltare una dose",
        body: "Promemoria amichevoli, conferme e controlli gentili ti aiutano a restare in carreggiata.",
      },
    ],
    reassurance: "La famiglia puo essere avvisata quando qualcosa richiede attenzione, e il controllo resta a te.",
    cta: "Inizia con VYVA",
    startHere: "Inizia qui",
    fallback: "Link di configurazione:",
    ignore: "Questo invito e stato inviato con un link sicuro di registrazione VYVA. Se non lo aspettavi, puoi ignorare questa email.",
  },
  pt: {
    subject: "Bem-vindo a VYVA",
    preheader: "Servicos de saude, apoio com medicacao e acesso a um medico sempre por perto.",
    eyebrow: "Saude por voz",
    title: "Conheca a VYVA, a sua companhia de saude em casa",
    greeting: "Caro/a",
    defaultIntro: "A VYVA esta pronta para si.",
    summary: "Apoio simples 24/7 para medicacao, sintomas, sinais vitais, cuidado diario e um medico a um clique.",
    featureTitle: "O seu apoio de saude",
    benefits: [
      {
        label: "SAUDE",
        title: "Servicos de saude em casa",
        body: "Verifique sintomas, acompanhe sinais vitais e receba orientacao simples quando algo nao parecer bem.",
      },
      {
        label: "MEDICO",
        title: "Um medico a um clique",
        body: "Quando precisar de mais cuidado, a VYVA ajuda-o a chegar rapidamente a um medico.",
      },
      {
        label: "DOSE",
        title: "Nunca falhe uma dose",
        body: "Lembretes amigaveis, confirmacoes e acompanhamentos suaves ajudam-no a manter-se no caminho certo.",
      },
    ],
    reassurance: "A familia pode ser informada quando algo precisar de atencao, e mantem sempre o controlo.",
    cta: "Comecar com VYVA",
    startHere: "Comece aqui",
    fallback: "Link de configuracao:",
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
