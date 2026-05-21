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
    fallback: "Need the link?",
    ignore: "This secure invitation can be ignored if you were not expecting it.",
  },
  es: {
    subject: "Bienvenido a VYVA",
    preheader: "Un companero sencillo para salud, memoria, ayuda diaria, conversaciones amenas y acceso a un medico.",
    eyebrow: "Companero de cuidado diario",
    title: "Sientete acompanado cada dia",
    greeting: "Estimado/a",
    defaultIntro: "VYVA esta listo para ti.",
    summary: "Un companero sencillo para salud, memoria, ayuda diaria, conversaciones amenas y acceso a un medico.",
    outcomeBadge: "Mas confianza en casa",
    featureTitle: "Lo que puedes hacer con VYVA",
    benefits: [
      {
        label: "SALUD",
        title: "Chequeos de salud",
        body: "Orientacion sobre sintomas y constantes.",
      },
      {
        label: "MEDICO",
        title: "Acceso al medico",
        body: "Un medico, a un clic.",
      },
      {
        label: "DOSIS",
        title: "Recordatorios de medicacion",
        body: "Avisos amables para seguir el plan.",
      },
      {
        label: "BRAIN",
        title: "Brain Coach",
        body: "Juegos de memoria y chequeos de animo.",
      },
      {
        label: "AYUDA",
        title: "Concierge",
        body: "Viajes, recados y ayuda de confianza.",
      },
      {
        label: "CHAT",
        title: "Compania",
        body: "Conversaciones amenas y chequeos cercanos.",
      },
    ],
    reassurance: "Configuralo una vez. Usalo cuando quieras.",
    cta: "Configurar VYVA",
    startHere: "ACTIVADO POR VOZ, SIN HABILIDADES DIGITALES",
    fallback: "Necesita el enlace?",
    ignore: "Esta invitacion segura puede ignorarse si no la esperaba.",
  },
  fr: {
    subject: "Bienvenue sur VYVA",
    preheader: "Un compagnon simple pour la sante, la memoire, l'aide quotidienne, les echanges agreables et l'acces a un medecin.",
    eyebrow: "Compagnon de soin quotidien",
    title: "Sentez-vous accompagne chaque jour",
    greeting: "Cher/Chere",
    defaultIntro: "VYVA est pret pour vous.",
    summary: "Un compagnon simple pour la sante, la memoire, l'aide quotidienne, les echanges agreables et l'acces a un medecin.",
    outcomeBadge: "Plus de confiance a domicile",
    featureTitle: "Ce que VYVA peut faire",
    benefits: [
      {
        label: "SANTE",
        title: "Suivi sante",
        body: "Conseils sur les symptomes et les constantes.",
      },
      {
        label: "DR",
        title: "Acces medecin",
        body: "Un medecin, en un clic.",
      },
      {
        label: "DOSE",
        title: "Rappels medicaments",
        body: "Des rappels doux pour rester sur la bonne voie.",
      },
      {
        label: "BRAIN",
        title: "Brain Coach",
        body: "Jeux de memoire et suivi de l'humeur.",
      },
      {
        label: "AIDE",
        title: "Conciergerie",
        body: "Trajets, courses et aide de confiance.",
      },
      {
        label: "CHAT",
        title: "Compagnie",
        body: "Echanges agreables et attentions regulieres.",
      },
    ],
    reassurance: "Configurez-le une fois. Utilisez-le a tout moment.",
    cta: "Configurer VYVA",
    startHere: "ACTIVE PAR LA VOIX, AUCUNE COMPETENCE NUMERIQUE REQUISE",
    fallback: "Besoin du lien?",
    ignore: "Cette invitation securisee peut etre ignoree si vous ne l'attendiez pas.",
  },
  de: {
    subject: "Willkommen bei VYVA",
    preheader: "Ein einfacher Begleiter fuer Gesundheit, Gedaechtnis, Alltagshilfe, gute Gespraeche und Arztzugang.",
    eyebrow: "Taegliche Hilfe",
    title: "Jeden Tag gut unterstuetzt",
    greeting: "Guten Tag",
    defaultIntro: "VYVA ist fuer Sie bereit.",
    summary: "Ein einfacher Begleiter fuer Gesundheit, Gedaechtnis, Alltagshilfe, gute Gespraeche und Arztzugang.",
    outcomeBadge: "Sicher zuhause",
    featureTitle: "VYVA Funktionen",
    benefits: [
      {
        label: "CARE",
        title: "Gesundheit",
        body: "Orientierung zu Symptomen und Werten.",
      },
      {
        label: "ARZT",
        title: "Arzt",
        body: "Ein Arzt, nur einen Klick entfernt.",
      },
      {
        label: "DOSIS",
        title: "Medikamente",
        body: "Sanfte Hinweise, damit Sie dranbleiben.",
      },
      {
        label: "BRAIN",
        title: "Brain Coach",
        body: "Gedaechtnisspiele und Stimmungschecks.",
      },
      {
        label: "HILFE",
        title: "Concierge",
        body: "Fahrten, Besorgungen und vertraute Hilfe.",
      },
      {
        label: "CHAT",
        title: "Kontakt",
        body: "Interessante Gespraeche und freundliche Check-ins.",
      },
    ],
    reassurance: "Einmal einrichten. Jederzeit nutzen.",
    cta: "VYVA starten",
    startHere: "PER SPRACHE, OHNE APP-WISSEN",
    fallback: "Link benoetigt?",
    ignore: "Diese sichere Einladung kann ignoriert werden, wenn Sie sie nicht erwartet haben.",
  },
  it: {
    subject: "Benvenuto in VYVA",
    preheader: "Un compagno semplice per salute, memoria, aiuto quotidiano, conversazioni piacevoli e accesso a un medico.",
    eyebrow: "Compagno di cura quotidiana",
    title: "Sentiti supportato ogni giorno",
    greeting: "Gentile",
    defaultIntro: "VYVA e pronto per te.",
    summary: "Un compagno semplice per salute, memoria, aiuto quotidiano, conversazioni piacevoli e accesso a un medico.",
    outcomeBadge: "Piu sicurezza a casa",
    featureTitle: "Cosa puoi fare con VYVA",
    benefits: [
      {
        label: "SALUTE",
        title: "Controlli salute",
        body: "Indicazioni su sintomi e parametri.",
      },
      {
        label: "MEDICO",
        title: "Accesso medico",
        body: "Un medico, a un clic.",
      },
      {
        label: "DOSE",
        title: "Promemoria farmaci",
        body: "Avvisi gentili per restare in carreggiata.",
      },
      {
        label: "BRAIN",
        title: "Brain Coach",
        body: "Giochi di memoria e controlli dell'umore.",
      },
      {
        label: "AIUTO",
        title: "Concierge",
        body: "Trasporti, commissioni e aiuto fidato.",
      },
      {
        label: "CHAT",
        title: "Compagnia",
        body: "Conversazioni piacevoli e check-in amichevoli.",
      },
    ],
    reassurance: "Configuralo una volta. Usalo quando vuoi.",
    cta: "Configura VYVA",
    startHere: "ATTIVATO CON LA VOCE, NESSUNA COMPETENZA DIGITALE",
    fallback: "Serve il link?",
    ignore: "Questo invito sicuro puo essere ignorato se non lo aspettavi.",
  },
  pt: {
    subject: "Bem-vindo a VYVA",
    preheader: "Uma companhia simples para saude, memoria, ajuda diaria, conversas agradaveis e acesso a um medico.",
    eyebrow: "Companhia de cuidado diario",
    title: "Sinta-se apoiado todos os dias",
    greeting: "Caro/a",
    defaultIntro: "A VYVA esta pronta para si.",
    summary: "Uma companhia simples para saude, memoria, ajuda diaria, conversas agradaveis e acesso a um medico.",
    outcomeBadge: "Mais confianca em casa",
    featureTitle: "O que pode fazer com a VYVA",
    benefits: [
      {
        label: "SAUDE",
        title: "Check-ups de saude",
        body: "Orientacao sobre sintomas e sinais vitais.",
      },
      {
        label: "MEDICO",
        title: "Acesso a medico",
        body: "Um medico, a um clique.",
      },
      {
        label: "DOSE",
        title: "Lembretes de medicacao",
        body: "Alertas gentis para se manter no caminho.",
      },
      {
        label: "BRAIN",
        title: "Brain Coach",
        body: "Jogos de memoria e check-ins de humor.",
      },
      {
        label: "AJUDA",
        title: "Concierge",
        body: "Transportes, recados e ajuda de confianca.",
      },
      {
        label: "CHAT",
        title: "Companhia",
        body: "Conversas agradaveis e check-ins amigaveis.",
      },
    ],
    reassurance: "Configure uma vez. Use quando precisar.",
    cta: "Configurar VYVA",
    startHere: "ATIVADO POR VOZ, SEM COMPETENCIAS DIGITAIS",
    fallback: "Precisa do link?",
    ignore: "Este convite seguro pode ser ignorado se nao estava a espera.",
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

export type SignupInvitePrefill = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
};

function splitSignupInviteName(name: string | null | undefined) {
  const parts = (name ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function setInviteParam(params: URLSearchParams, key: string, value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (trimmed) params.set(key, trimmed);
}

export function buildSignupInviteUrl(baseUrl: string, value: unknown, prefill: SignupInvitePrefill = {}): string {
  const language = normalizeSignupInviteLanguage(value);
  const url = new URL("/settings/account", `${baseUrl.replace(/\/$/, "")}/`);
  const nameParts = splitSignupInviteName(prefill.name);
  url.searchParams.set("lang", language);
  setInviteParam(url.searchParams, "first_name", prefill.firstName ?? nameParts.firstName);
  setInviteParam(url.searchParams, "last_name", prefill.lastName ?? nameParts.lastName);
  setInviteParam(url.searchParams, "email", prefill.email);
  setInviteParam(url.searchParams, "phone", prefill.phone);
  setInviteParam(url.searchParams, "whatsapp", prefill.whatsapp);
  return url.toString();
}
