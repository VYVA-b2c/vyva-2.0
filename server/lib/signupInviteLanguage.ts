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
    subject: "You're invited to set up VYVA",
    preheader: "Your private companion space is ready for health details, reminders, family support, and everyday help.",
    eyebrow: "Private companion support",
    title: "Your VYVA space is ready",
    defaultIntro: "A secure VYVA profile has been prepared for you.",
    summary: "Set up your account in a few minutes so VYVA can keep the essentials organised: health details, reminders, trusted family support, and everyday help when you need it.",
    featureTitle: "What you can set up",
    features: [
      "Health details and medication reminders in one calm place",
      "Trusted family or care partners connected around the same profile",
      "Everyday help, check-ins, and support preferences tailored to you",
    ],
    reassurance: "You can review details, adjust preferences, and choose who is involved during setup.",
    cta: "Set up my VYVA",
    startHere: "Start here",
    fallback: "If the button does not work, copy and paste this link into your browser:",
    ignore: "This invitation was sent using a secure VYVA signup link. If you were not expecting it, you can ignore this email.",
  },
  es: {
    subject: "Te invitamos a configurar VYVA",
    preheader: "Tu espacio privado de compania esta listo para salud, recordatorios, apoyo familiar y ayuda diaria.",
    eyebrow: "Apoyo privado de compania",
    title: "Tu espacio VYVA esta listo",
    defaultIntro: "Se ha preparado un perfil seguro de VYVA para ti.",
    summary: "Configura tu cuenta en pocos minutos para que VYVA mantenga lo esencial organizado: datos de salud, recordatorios, apoyo de personas de confianza y ayuda diaria cuando la necesites.",
    featureTitle: "Que puedes configurar",
    features: [
      "Datos de salud y recordatorios de medicacion en un lugar tranquilo",
      "Familiares o cuidadores de confianza conectados al mismo perfil",
      "Ayuda diaria, check-ins y preferencias de apoyo adaptadas a ti",
    ],
    reassurance: "Durante la configuracion podras revisar datos, ajustar preferencias y elegir quien participa.",
    cta: "Configurar mi VYVA",
    startHere: "Empieza aqui",
    fallback: "Si el boton no funciona, copia y pega este enlace en tu navegador:",
    ignore: "Esta invitacion se envio mediante un enlace seguro de registro de VYVA. Si no la esperabas, puedes ignorar este email.",
  },
  fr: {
    subject: "Vous etes invite a configurer VYVA",
    preheader: "Votre espace compagnon prive est pret pour la sante, les rappels, le soutien familial et l'aide quotidienne.",
    eyebrow: "Soutien compagnon prive",
    title: "Votre espace VYVA est pret",
    defaultIntro: "Un profil VYVA securise a ete prepare pour vous.",
    summary: "Configurez votre compte en quelques minutes afin que VYVA garde l'essentiel organise : informations de sante, rappels, soutien de proches de confiance et aide quotidienne quand vous en avez besoin.",
    featureTitle: "Ce que vous pouvez configurer",
    features: [
      "Informations de sante et rappels de medicaments dans un espace calme",
      "Proches ou aidants de confiance connectes au meme profil",
      "Aide quotidienne, check-ins et preferences de soutien adaptes a vous",
    ],
    reassurance: "Pendant la configuration, vous pourrez verifier les details, ajuster les preferences et choisir qui participe.",
    cta: "Configurer mon VYVA",
    startHere: "Commencer ici",
    fallback: "Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :",
    ignore: "Cette invitation a ete envoyee avec un lien d'inscription securise VYVA. Si vous ne l'attendiez pas, vous pouvez ignorer cet email.",
  },
  de: {
    subject: "Sie sind eingeladen, VYVA einzurichten",
    preheader: "Ihr privater Begleiterbereich ist bereit fuer Gesundheitsdaten, Erinnerungen, Familienhilfe und Alltagshilfe.",
    eyebrow: "Private Begleiterunterstuetzung",
    title: "Ihr VYVA Bereich ist bereit",
    defaultIntro: "Ein sicheres VYVA Profil wurde fuer Sie vorbereitet.",
    summary: "Richten Sie Ihr Konto in wenigen Minuten ein, damit VYVA das Wichtige organisiert: Gesundheitsdaten, Erinnerungen, Unterstuetzung durch vertraute Personen und Alltagshilfe, wenn Sie sie brauchen.",
    featureTitle: "Was Sie einrichten koennen",
    features: [
      "Gesundheitsdaten und Medikamentenerinnerungen an einem ruhigen Ort",
      "Vertraute Familienmitglieder oder Betreuungspersonen im selben Profil",
      "Alltagshilfe, Check-ins und Unterstuetzungswuensche passend zu Ihnen",
    ],
    reassurance: "Bei der Einrichtung koennen Sie Angaben pruefen, Einstellungen anpassen und entscheiden, wer beteiligt ist.",
    cta: "Mein VYVA einrichten",
    startHere: "Hier starten",
    fallback: "Wenn der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:",
    ignore: "Diese Einladung wurde mit einem sicheren VYVA Registrierungslink gesendet. Wenn Sie diese Einladung nicht erwartet haben, koennen Sie diese E-Mail ignorieren.",
  },
  it: {
    subject: "Sei invitato a configurare VYVA",
    preheader: "Il tuo spazio compagno privato e pronto per salute, promemoria, supporto familiare e aiuto quotidiano.",
    eyebrow: "Supporto compagno privato",
    title: "Il tuo spazio VYVA e pronto",
    defaultIntro: "E stato preparato per te un profilo VYVA sicuro.",
    summary: "Configura il tuo account in pochi minuti cosi VYVA puo tenere organizzato l'essenziale: dati sanitari, promemoria, supporto di persone fidate e aiuto quotidiano quando serve.",
    featureTitle: "Cosa puoi configurare",
    features: [
      "Dati sanitari e promemoria farmaci in un luogo tranquillo",
      "Familiari o caregiver fidati collegati allo stesso profilo",
      "Aiuto quotidiano, check-in e preferenze di supporto su misura per te",
    ],
    reassurance: "Durante la configurazione potrai rivedere i dettagli, modificare le preferenze e scegliere chi coinvolgere.",
    cta: "Configura il mio VYVA",
    startHere: "Inizia qui",
    fallback: "Se il pulsante non funziona, copia e incolla questo link nel browser:",
    ignore: "Questo invito e stato inviato con un link sicuro di registrazione VYVA. Se non lo aspettavi, puoi ignorare questa email.",
  },
  pt: {
    subject: "Tem um convite para configurar a VYVA",
    preheader: "O seu espaco privado de companhia esta pronto para saude, lembretes, apoio familiar e ajuda diaria.",
    eyebrow: "Apoio privado de companhia",
    title: "O seu espaco VYVA esta pronto",
    defaultIntro: "Foi preparado para si um perfil VYVA seguro.",
    summary: "Configure a sua conta em poucos minutos para que a VYVA mantenha o essencial organizado: dados de saude, lembretes, apoio de pessoas de confianca e ajuda diaria quando precisar.",
    featureTitle: "O que pode configurar",
    features: [
      "Dados de saude e lembretes de medicacao num local tranquilo",
      "Familiares ou cuidadores de confianca ligados ao mesmo perfil",
      "Ajuda diaria, check-ins e preferencias de apoio adaptadas a si",
    ],
    reassurance: "Durante a configuracao, pode rever detalhes, ajustar preferencias e escolher quem participa.",
    cta: "Configurar a minha VYVA",
    startHere: "Comece aqui",
    fallback: "Se o botao nao funcionar, copie e cole este link no seu navegador:",
    ignore: "Este convite foi enviado atraves de um link seguro de registo VYVA. Se nao estava a espera, pode ignorar este email.",
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
