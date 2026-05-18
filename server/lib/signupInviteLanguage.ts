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
    subject: "Create your VYVA account",
    title: "Create your VYVA account",
    defaultIntro: "You are invited to create your VYVA account.",
    summary: "Your account helps keep health, support, reminders, and daily care in one private place.",
    cta: "Create account",
    startHere: "Start here",
    fallback: "If the button does not work, copy and paste this link into your browser:",
    ignore: "You received this invitation because someone asked VYVA to send you a secure signup link. If you were not expecting it, you can ignore this email.",
  },
  es: {
    subject: "Crea tu cuenta VYVA",
    title: "Crea tu cuenta VYVA",
    defaultIntro: "Te invitamos a crear tu cuenta VYVA.",
    summary: "Tu cuenta ayuda a mantener salud, apoyo, recordatorios y cuidados diarios en un lugar privado.",
    cta: "Crear cuenta",
    startHere: "Empieza aqui",
    fallback: "Si el boton no funciona, copia y pega este enlace en tu navegador:",
    ignore: "Has recibido esta invitacion porque alguien pidio a VYVA que te enviara un enlace seguro de registro. Si no la esperabas, puedes ignorar este email.",
  },
  fr: {
    subject: "Creez votre compte VYVA",
    title: "Creez votre compte VYVA",
    defaultIntro: "Vous etes invite a creer votre compte VYVA.",
    summary: "Votre compte garde la sante, le soutien, les rappels et l'aide quotidienne dans un espace prive.",
    cta: "Creer un compte",
    startHere: "Commencer ici",
    fallback: "Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :",
    ignore: "Vous recevez cette invitation parce que quelqu'un a demande a VYVA de vous envoyer un lien d'inscription securise. Si vous ne l'attendiez pas, vous pouvez ignorer cet email.",
  },
  de: {
    subject: "VYVA Konto erstellen",
    title: "VYVA Konto erstellen",
    defaultIntro: "Sie sind eingeladen, Ihr VYVA Konto zu erstellen.",
    summary: "Ihr Konto hilft, Gesundheit, Unterstuetzung, Erinnerungen und Alltagshilfe an einem privaten Ort zu buendeln.",
    cta: "Konto erstellen",
    startHere: "Hier starten",
    fallback: "Wenn der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:",
    ignore: "Sie erhalten diese Einladung, weil jemand VYVA gebeten hat, Ihnen einen sicheren Registrierungslink zu senden. Wenn Sie diese Einladung nicht erwartet haben, koennen Sie diese E-Mail ignorieren.",
  },
  it: {
    subject: "Crea il tuo account VYVA",
    title: "Crea il tuo account VYVA",
    defaultIntro: "Sei invitato a creare il tuo account VYVA.",
    summary: "Il tuo account aiuta a tenere salute, supporto, promemoria e assistenza quotidiana in uno spazio privato.",
    cta: "Crea account",
    startHere: "Inizia qui",
    fallback: "Se il pulsante non funziona, copia e incolla questo link nel browser:",
    ignore: "Hai ricevuto questo invito perche qualcuno ha chiesto a VYVA di inviarti un link sicuro per la registrazione. Se non lo aspettavi, puoi ignorare questa email.",
  },
  pt: {
    subject: "Crie a sua conta VYVA",
    title: "Crie a sua conta VYVA",
    defaultIntro: "Foi convidado a criar a sua conta VYVA.",
    summary: "A sua conta ajuda a manter saude, apoio, lembretes e cuidados diarios num espaco privado.",
    cta: "Criar conta",
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
