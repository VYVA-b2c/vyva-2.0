import { displayFirstName } from "@/lib/displayIdentity";
import {
  WELCOME_MODULE_TEMPLATES,
  isWelcomeProfileActionComplete,
  type WelcomeAudience,
  type WelcomeMomentType,
  type WelcomeProfileActionId,
  type WelcomeProfileCompletionSnapshot,
} from "../../shared/welcomeModule";

export type HeroLanguage = "es" | "en" | "de" | "fr" | "it" | "pt";

export type HeroSurface =
  | "home"
  | "home_voice"
  | "health"
  | "concierge"
  | "meds"
  | "brain"
  | "activity"
  | "vitals"
  | "doctor"
  | "companions"
  | "social";

export type HeroReason =
  | "safety"
  | "scheduled_event"
  | "continuation"
  | "time_of_day"
  | "evergreen";

export type HeroPeriod = "morning" | "afternoon" | "evening" | "night";

export type HeroSafetyLevel = "normal" | "medical" | "urgent";

export type HeroMessageSource = "managed" | "built_in" | "fallback";
export type HeroMessageEventType =
  | "impression"
  | "cta_click"
  | "dismiss"
  | "fallback"
  | "shown"
  | "opened"
  | "deferred"
  | "dismissed"
  | "completed"
  | "voice_engaged";
export type HeroFallbackReason = "no_eligible_message" | "invalid_selected_message";

export interface HeroMessageResult {
  headline: string;
  subtitle?: string;
  sourceText?: string;
  ctaLabel?: string;
  contextHint?: string;
  actionId?: HeroApprovedActionId;
  actionRoute?: string;
  messageId: string;
  reason: HeroReason;
  surface: HeroSurface;
  language: HeroLanguage;
  source: HeroMessageSource;
  priority?: number;
  fallbackReason?: HeroFallbackReason;
  messageType?: HeroMessageType;
  welcomeAudience?: WelcomeAudience;
  welcomeMomentType?: WelcomeMomentType;
  welcomeProfileAction?: WelcomeProfileActionId;
}

export interface HeroMessageContext {
  language?: string | null;
  firstName?: string | null;
  date?: Date;
  safetyLevel?: HeroSafetyLevel;
  fallbackHeadline?: string;
  fallbackSubtitle?: string;
  fallbackSourceText?: string;
  fallbackCtaLabel?: string;
  fallbackContextHint?: string;
  upcomingEventType?: "appointment" | "medication" | "social" | "concierge" | null;
  recentActivity?: "health_check" | "meds" | "social" | "concierge" | null;
  welcomeAudience?: WelcomeAudience;
  welcomeFirstLoginDue?: boolean;
  welcomeDailyProfileNudgeDue?: boolean;
  profileCompletionSnapshot?: WelcomeProfileCompletionSnapshot | null;
}

export type HeroCopy = {
  sourceText?: string;
  headline: string;
  headlineWithName?: string;
  subtitle?: string;
  ctaLabel?: string;
  contextHint?: string;
  actionId?: HeroApprovedActionId;
};

export type HeroMessageType = "standard" | "welcome_first_login" | "welcome_profile_nudge";

export type HeroApprovedActionId =
  | "none"
  | "health"
  | "medication"
  | "mind"
  | "community"
  | "concierge"
  | "prevention";

export type HeroMessageDefinition = {
  id: string;
  surface: HeroSurface;
  reason: HeroReason;
  messageType?: HeroMessageType;
  welcomeAudience?: WelcomeAudience;
  welcomeMomentType?: WelcomeMomentType;
  welcomeProfileAction?: WelcomeProfileActionId;
  actionRoute?: string;
  priority: number;
  cooldownHours: number;
  periods?: HeroPeriod[];
  safetyLevels?: HeroSafetyLevel[];
  eventTypes?: Array<NonNullable<HeroMessageContext["upcomingEventType"]>>;
  activityTypes?: Array<NonNullable<HeroMessageContext["recentActivity"]>>;
  copy: Record<HeroLanguage, HeroCopy>;
  source?: Exclude<HeroMessageSource, "fallback">;
};

export type HeroMessageEventInput = {
  messageId: string;
  surface: HeroSurface;
  language?: string | null;
  eventType: HeroMessageEventType;
  reason: HeroReason;
  source: HeroMessageSource;
  route?: string;
};

export const HERO_LIMITS = {
  headlineWords: 5,
  headlineChars: 30,
  sourceWords: 3,
  sourceChars: 18,
  ctaWords: 3,
  ctaChars: 20,
  subtitleWords: 8,
  subtitleChars: 48,
};

const STORAGE_KEY = "vyva.hero.impressions.v1";

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isWithinLimit(text: string | undefined, wordLimit: number, charLimit: number): boolean {
  if (!text) return true;
  const normalized = text.trim();
  return wordCount(normalized) <= wordLimit && normalized.length <= charLimit;
}

function applyName(template: string, name: string): string {
  return template.replace(/\{name\}/g, name.trim());
}

function readImpressions(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function isCoolingDown(message: HeroMessageDefinition, now: number, impressions: Record<string, number>): boolean {
  const lastSeen = impressions[message.id];
  if (!lastSeen || message.cooldownHours <= 0) return false;
  return now - lastSeen < message.cooldownHours * 60 * 60 * 1000;
}

function matchesContext(message: HeroMessageDefinition, context: HeroMessageContext, period: HeroPeriod): boolean {
  if (message.periods?.length && !message.periods.includes(period)) return false;
  if (message.safetyLevels?.length && !message.safetyLevels.includes(context.safetyLevel ?? "normal")) return false;
  if (message.eventTypes?.length && (!context.upcomingEventType || !message.eventTypes.includes(context.upcomingEventType))) return false;
  if (message.activityTypes?.length && (!context.recentActivity || !message.activityTypes.includes(context.recentActivity))) return false;
  if (message.welcomeAudience && context.welcomeAudience !== message.welcomeAudience) return false;
  if (message.messageType === "welcome_first_login") return context.welcomeFirstLoginDue === true;
  if (message.messageType === "welcome_profile_nudge") {
    if (context.welcomeDailyProfileNudgeDue !== true || !message.welcomeProfileAction) return false;
    return !isWelcomeProfileActionComplete(
      message.welcomeProfileAction,
      context.profileCompletionSnapshot ?? {},
    );
  }
  return true;
}

export function normalizeHeroLanguage(language?: string | null): HeroLanguage {
  const base = (language || "es").trim().toLowerCase().split("-")[0];
  if (["es", "en", "de", "fr", "it", "pt"].includes(base)) return base as HeroLanguage;
  return "es";
}

export function getHeroPeriod(date = new Date()): HeroPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour <= 11) return "morning";
  if (hour >= 12 && hour <= 16) return "afternoon";
  if (hour >= 17 && hour <= 20) return "evening";
  return "night";
}

function welcomeHeadline(raw: string) {
  return raw
    .replace(/\s*,?\s*\{name\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function welcomeHeroCopy(raw: { headline: string; subtitle: string; ctaLabel?: string }): HeroCopy {
  const hasNameToken = raw.headline.includes("{name}");
  return {
    sourceText: "VYVA",
    headline: hasNameToken ? welcomeHeadline(raw.headline) : raw.headline,
    ...(hasNameToken ? { headlineWithName: raw.headline } : {}),
    subtitle: raw.subtitle,
    ctaLabel: raw.ctaLabel,
  };
}

const ELDER_WELCOME_PROFILE_HERO_COPY: Record<WelcomeProfileActionId, Record<HeroLanguage, HeroCopy>> = {
  emergency_contact: {
    en: { sourceText: "VYVA", headline: "Make VYVA safer", subtitle: "Add who to contact in urgent moments.", ctaLabel: "Add contact" },
    es: { sourceText: "VYVA", headline: "Haga VYVA seguro", subtitle: "Anada a quien llamar en urgencias.", ctaLabel: "Anadir" },
    de: { sourceText: "VYVA", headline: "VYVA sicherer machen", subtitle: "Kontakt fuer Notfaelle hinzufuegen.", ctaLabel: "Hinzufuegen" },
    fr: { sourceText: "VYVA", headline: "Rendre VYVA sur", subtitle: "Ajoutez le contact a appeler vite.", ctaLabel: "Ajouter" },
    it: { sourceText: "VYVA", headline: "Rendi VYVA sicuro", subtitle: "Aggiunga chi chiamare in urgenza.", ctaLabel: "Aggiungi" },
    pt: { sourceText: "VYVA", headline: "Torne VYVA seguro", subtitle: "Adicione quem chamar numa urgencia.", ctaLabel: "Adicionar" },
  },
  medications: {
    en: { sourceText: "VYVA", headline: "Add medicines", subtitle: "Help VYVA remember doses and routines.", ctaLabel: "Add medicines" },
    es: { sourceText: "VYVA", headline: "Anada medicinas", subtitle: "VYVA recuerda dosis y rutinas.", ctaLabel: "Anadir" },
    de: { sourceText: "VYVA", headline: "Medikamente hinzufuegen", subtitle: "VYVA merkt Dosen und Routinen.", ctaLabel: "Hinzufuegen" },
    fr: { sourceText: "VYVA", headline: "Ajouter medicaments", subtitle: "VYVA aide avec doses et routines.", ctaLabel: "Ajouter" },
    it: { sourceText: "VYVA", headline: "Aggiunga medicinali", subtitle: "VYVA ricorda dosi e routine.", ctaLabel: "Aggiungi" },
    pt: { sourceText: "VYVA", headline: "Adicione medicamentos", subtitle: "VYVA lembra doses e rotinas.", ctaLabel: "Adicionar" },
  },
  gp_details: {
    en: { sourceText: "VYVA", headline: "Add your doctor", subtitle: "Prepare safer health conversations.", ctaLabel: "Add doctor" },
    es: { sourceText: "VYVA", headline: "Anada su medico", subtitle: "Prepare conversaciones de salud mejores.", ctaLabel: "Anadir medico" },
    de: { sourceText: "VYVA", headline: "Arzt hinzufuegen", subtitle: "Gesundheitsgespraeche besser vorbereiten.", ctaLabel: "Hinzufuegen" },
    fr: { sourceText: "VYVA", headline: "Ajouter medecin", subtitle: "Preparez mieux les echanges sante.", ctaLabel: "Ajouter" },
    it: { sourceText: "VYVA", headline: "Aggiunga medico", subtitle: "Prepari meglio le conversazioni salute.", ctaLabel: "Aggiungi" },
    pt: { sourceText: "VYVA", headline: "Adicione medico", subtitle: "Prepare melhor conversas de saude.", ctaLabel: "Adicionar" },
  },
  address: {
    en: { sourceText: "VYVA", headline: "Add home address", subtitle: "Help urgent support find you.", ctaLabel: "Add address" },
    es: { sourceText: "VYVA", headline: "Anada direccion", subtitle: "Ayude a localizar apoyo urgente.", ctaLabel: "Anadir" },
    de: { sourceText: "VYVA", headline: "Adresse hinzufuegen", subtitle: "Hilfe findet Sie im Notfall.", ctaLabel: "Hinzufuegen" },
    fr: { sourceText: "VYVA", headline: "Ajouter adresse", subtitle: "Aidez les secours a vous trouver.", ctaLabel: "Ajouter" },
    it: { sourceText: "VYVA", headline: "Aggiunga indirizzo", subtitle: "Aiuti il supporto a trovarla.", ctaLabel: "Aggiungi" },
    pt: { sourceText: "VYVA", headline: "Adicione morada", subtitle: "Ajude apoio urgente a encontra-lo.", ctaLabel: "Adicionar" },
  },
  care_team: {
    en: { sourceText: "VYVA", headline: "Add care team", subtitle: "Keep trusted people ready to help.", ctaLabel: "Add team" },
    es: { sourceText: "VYVA", headline: "Anada equipo", subtitle: "Tenga gente de confianza lista.", ctaLabel: "Anadir" },
    de: { sourceText: "VYVA", headline: "Betreuung hinzufuegen", subtitle: "Vertraute Personen bleiben bereit.", ctaLabel: "Hinzufuegen" },
    fr: { sourceText: "VYVA", headline: "Ajouter equipe", subtitle: "Gardez les proches prets a aider.", ctaLabel: "Ajouter" },
    it: { sourceText: "VYVA", headline: "Aggiunga team", subtitle: "Tenga persone fidate pronte.", ctaLabel: "Aggiungi" },
    pt: { sourceText: "VYVA", headline: "Adicione equipa", subtitle: "Mantenha pessoas prontas a ajudar.", ctaLabel: "Adicionar" },
  },
  preferences: {
    en: { sourceText: "VYVA", headline: "Set preferences", subtitle: "Tell VYVA how to support you.", ctaLabel: "Set up" },
    es: { sourceText: "VYVA", headline: "Defina preferencias", subtitle: "Diga como debe apoyarle VYVA.", ctaLabel: "Configurar" },
    de: { sourceText: "VYVA", headline: "Vorlieben festlegen", subtitle: "Sagen Sie VYVA, wie Hilfe passt.", ctaLabel: "Einrichten" },
    fr: { sourceText: "VYVA", headline: "Regler preferences", subtitle: "Dites a VYVA comment aider.", ctaLabel: "Regler" },
    it: { sourceText: "VYVA", headline: "Imposti preferenze", subtitle: "Dica a VYVA come aiutare.", ctaLabel: "Imposta" },
    pt: { sourceText: "VYVA", headline: "Defina preferencias", subtitle: "Diga como a VYVA deve ajudar.", ctaLabel: "Configurar" },
  },
  notifications: {
    en: { sourceText: "VYVA", headline: "Set notifications", subtitle: "Choose how reminders should arrive.", ctaLabel: "Set alerts" },
    es: { sourceText: "VYVA", headline: "Defina avisos", subtitle: "Elija como llegan recordatorios.", ctaLabel: "Configurar" },
    de: { sourceText: "VYVA", headline: "Hinweise festlegen", subtitle: "Waehlen Sie Erinnerungswege.", ctaLabel: "Einrichten" },
    fr: { sourceText: "VYVA", headline: "Regler alertes", subtitle: "Choisissez comment rappeler.", ctaLabel: "Regler" },
    it: { sourceText: "VYVA", headline: "Imposti avvisi", subtitle: "Scelga come arrivano promemoria.", ctaLabel: "Imposta" },
    pt: { sourceText: "VYVA", headline: "Defina avisos", subtitle: "Escolha como chegam lembretes.", ctaLabel: "Configurar" },
  },
  cognitive: {
    en: { sourceText: "VYVA", headline: "Set mind support", subtitle: "Tune pace and memory support.", ctaLabel: "Set up" },
    es: { sourceText: "VYVA", headline: "Configure mente", subtitle: "Ajuste ritmo y memoria.", ctaLabel: "Configurar" },
    de: { sourceText: "VYVA", headline: "Geist Hilfe setzen", subtitle: "Tempo und Gedaechtnis anpassen.", ctaLabel: "Einrichten" },
    fr: { sourceText: "VYVA", headline: "Regler memoire", subtitle: "Ajustez rythme et soutien.", ctaLabel: "Regler" },
    it: { sourceText: "VYVA", headline: "Imposti mente", subtitle: "Regoli ritmo e memoria.", ctaLabel: "Imposta" },
    pt: { sourceText: "VYVA", headline: "Configure mente", subtitle: "Ajuste ritmo e memoria.", ctaLabel: "Configurar" },
  },
  health_conditions: {
    en: { sourceText: "VYVA", headline: "Add health context", subtitle: "Help VYVA understand your risks.", ctaLabel: "Add context" },
    es: { sourceText: "VYVA", headline: "Anada salud", subtitle: "Ayude a VYVA a entender riesgos.", ctaLabel: "Anadir" },
    de: { sourceText: "VYVA", headline: "Gesundheit ergaenzen", subtitle: "VYVA versteht Risiken besser.", ctaLabel: "Hinzufuegen" },
    fr: { sourceText: "VYVA", headline: "Ajouter sante", subtitle: "Aidez VYVA a comprendre risques.", ctaLabel: "Ajouter" },
    it: { sourceText: "VYVA", headline: "Aggiunga salute", subtitle: "Aiuti VYVA a capire rischi.", ctaLabel: "Aggiungi" },
    pt: { sourceText: "VYVA", headline: "Adicione saude", subtitle: "Ajude a VYVA a entender riscos.", ctaLabel: "Adicionar" },
  },
  allergies: {
    en: { sourceText: "VYVA", headline: "Add allergies", subtitle: "Help avoid unsafe suggestions.", ctaLabel: "Add allergies" },
    es: { sourceText: "VYVA", headline: "Anada alergias", subtitle: "Ayude a evitar sugerencias inseguras.", ctaLabel: "Anadir" },
    de: { sourceText: "VYVA", headline: "Allergien hinzufuegen", subtitle: "Unsichere Vorschlaege vermeiden.", ctaLabel: "Hinzufuegen" },
    fr: { sourceText: "VYVA", headline: "Ajouter allergies", subtitle: "Evitez les conseils non surs.", ctaLabel: "Ajouter" },
    it: { sourceText: "VYVA", headline: "Aggiunga allergie", subtitle: "Eviti suggerimenti non sicuri.", ctaLabel: "Aggiungi" },
    pt: { sourceText: "VYVA", headline: "Adicione alergias", subtitle: "Evite sugestoes pouco seguras.", ctaLabel: "Adicionar" },
  },
  providers: {
    en: { sourceText: "VYVA", headline: "Add providers", subtitle: "Save trusted places and contacts.", ctaLabel: "Add providers" },
    es: { sourceText: "VYVA", headline: "Anada proveedores", subtitle: "Guarde lugares y contactos fiables.", ctaLabel: "Anadir" },
    de: { sourceText: "VYVA", headline: "Anbieter hinzufuegen", subtitle: "Vertraute Orte und Kontakte speichern.", ctaLabel: "Hinzufuegen" },
    fr: { sourceText: "VYVA", headline: "Ajouter contacts", subtitle: "Gardez lieux et contacts fiables.", ctaLabel: "Ajouter" },
    it: { sourceText: "VYVA", headline: "Aggiunga fornitori", subtitle: "Salvi luoghi e contatti fidati.", ctaLabel: "Aggiungi" },
    pt: { sourceText: "VYVA", headline: "Adicione contactos", subtitle: "Guarde locais e contactos fiaveis.", ctaLabel: "Adicionar" },
  },
  devices: {
    en: { sourceText: "VYVA", headline: "Add devices", subtitle: "Connect tools for health readings.", ctaLabel: "Add devices" },
    es: { sourceText: "VYVA", headline: "Anada dispositivos", subtitle: "Conecte lecturas de salud.", ctaLabel: "Anadir" },
    de: { sourceText: "VYVA", headline: "Geraete hinzufuegen", subtitle: "Geraete fuer Werte verbinden.", ctaLabel: "Hinzufuegen" },
    fr: { sourceText: "VYVA", headline: "Ajouter appareils", subtitle: "Connectez les mesures de sante.", ctaLabel: "Ajouter" },
    it: { sourceText: "VYVA", headline: "Aggiunga dispositivi", subtitle: "Colleghi letture di salute.", ctaLabel: "Aggiungi" },
    pt: { sourceText: "VYVA", headline: "Adicione dispositivos", subtitle: "Ligue leituras de saude.", ctaLabel: "Adicionar" },
  },
  diet: {
    en: { sourceText: "VYVA", headline: "Add diet notes", subtitle: "Help VYVA respect food needs.", ctaLabel: "Add notes" },
    es: { sourceText: "VYVA", headline: "Anada dieta", subtitle: "Ayude a respetar necesidades.", ctaLabel: "Anadir" },
    de: { sourceText: "VYVA", headline: "Ernaehrung ergaenzen", subtitle: "Beduerfnisse beim Essen beachten.", ctaLabel: "Hinzufuegen" },
    fr: { sourceText: "VYVA", headline: "Ajouter regime", subtitle: "Respectez les besoins alimentaires.", ctaLabel: "Ajouter" },
    it: { sourceText: "VYVA", headline: "Aggiunga dieta", subtitle: "Rispetti esigenze alimentari.", ctaLabel: "Aggiungi" },
    pt: { sourceText: "VYVA", headline: "Adicione dieta", subtitle: "Respeite necessidades alimentares.", ctaLabel: "Adicionar" },
  },
  hobbies: {
    en: { sourceText: "VYVA", headline: "Add interests", subtitle: "Help VYVA suggest better activities.", ctaLabel: "Add interests" },
    es: { sourceText: "VYVA", headline: "Anada intereses", subtitle: "Mejore sugerencias de actividades.", ctaLabel: "Anadir" },
    de: { sourceText: "VYVA", headline: "Interessen hinzufuegen", subtitle: "Passendere Aktivitaeten vorschlagen.", ctaLabel: "Hinzufuegen" },
    fr: { sourceText: "VYVA", headline: "Ajouter interets", subtitle: "Proposez de meilleures activites.", ctaLabel: "Ajouter" },
    it: { sourceText: "VYVA", headline: "Aggiunga interessi", subtitle: "Suggerisca attivita migliori.", ctaLabel: "Aggiungi" },
    pt: { sourceText: "VYVA", headline: "Adicione interesses", subtitle: "Sugira atividades melhores.", ctaLabel: "Adicionar" },
  },
};

function elderWelcomeHeroCopy(
  action: WelcomeProfileActionId | undefined,
  language: HeroLanguage,
  raw: { headline: string; subtitle: string; ctaLabel?: string },
): HeroCopy {
  return action ? ELDER_WELCOME_PROFILE_HERO_COPY[action][language] : welcomeHeroCopy(raw);
}

function elderWelcomeHeroMessages(): HeroMessageDefinition[] {
  return WELCOME_MODULE_TEMPLATES
    .filter((template) => template.audience === "elder")
    .map((template) => {
      const messageType: HeroMessageType = template.momentType === "first_login_welcome"
        ? "welcome_first_login"
        : "welcome_profile_nudge";
      const copy = Object.fromEntries(
        (Object.keys(template.copy) as HeroLanguage[])
          .map((language) => {
            const raw = template.copy[language];
            return raw ? [language, elderWelcomeHeroCopy(template.profileAction, language, raw)] : null;
          })
          .filter((entry): entry is [HeroLanguage, HeroCopy] => Boolean(entry)),
      ) as Record<HeroLanguage, HeroCopy>;

      return {
        id: template.id,
        surface: "home_voice",
        reason: template.momentType === "first_login_welcome" ? "time_of_day" : "evergreen",
        messageType,
        welcomeAudience: "elder",
        welcomeMomentType: template.momentType,
        welcomeProfileAction: template.profileAction,
        actionRoute: template.actionRoute,
        priority: template.priority,
        cooldownHours: template.cooldownHours,
        periods: template.periods,
        copy,
        source: "built_in",
      };
    });
}

export const HERO_MESSAGES: HeroMessageDefinition[] = [
  ...elderWelcomeHeroMessages(),
  {
    id: "home-morning",
    surface: "home",
    reason: "time_of_day",
    priority: 20,
    cooldownHours: 6,
    periods: ["morning"],
    copy: {
      es: { headline: "Buenos dias", headlineWithName: "Buenos dias, {name}", ctaLabel: "Hablemos" },
      en: { headline: "Good morning", headlineWithName: "Good morning, {name}", ctaLabel: "Let's Talk" },
      de: { headline: "Guten Morgen", headlineWithName: "Guten Morgen, {name}", ctaLabel: "Reden" },
      fr: { headline: "Bonjour", headlineWithName: "Bonjour, {name}", ctaLabel: "Discuter" },
      it: { headline: "Buongiorno", headlineWithName: "Buongiorno, {name}", ctaLabel: "Parliamo" },
      pt: { headline: "Bom dia", headlineWithName: "Bom dia, {name}", ctaLabel: "Falar" },
    },
  },
  {
    id: "home-afternoon",
    surface: "home",
    reason: "time_of_day",
    priority: 20,
    cooldownHours: 6,
    periods: ["afternoon"],
    copy: {
      es: { headline: "Buenas tardes", headlineWithName: "Buenas tardes, {name}", ctaLabel: "Hablemos" },
      en: { headline: "Good afternoon", headlineWithName: "Good afternoon, {name}", ctaLabel: "Let's Talk" },
      de: { headline: "Guten Tag", headlineWithName: "Guten Tag, {name}", ctaLabel: "Reden" },
      fr: { headline: "Bon apres-midi", ctaLabel: "Discuter" },
      it: { headline: "Buon pomeriggio", ctaLabel: "Parliamo" },
      pt: { headline: "Boa tarde", headlineWithName: "Boa tarde, {name}", ctaLabel: "Falar" },
    },
  },
  {
    id: "home-evening",
    surface: "home",
    reason: "time_of_day",
    priority: 20,
    cooldownHours: 6,
    periods: ["evening", "night"],
    copy: {
      es: { headline: "Buenas noches", headlineWithName: "Buenas noches, {name}", ctaLabel: "Hablemos" },
      en: { headline: "Good evening", headlineWithName: "Good evening, {name}", ctaLabel: "Let's Talk" },
      de: { headline: "Guten Abend", headlineWithName: "Guten Abend, {name}", ctaLabel: "Reden" },
      fr: { headline: "Bonsoir", headlineWithName: "Bonsoir, {name}", ctaLabel: "Discuter" },
      it: { headline: "Buona sera", headlineWithName: "Buona sera, {name}", ctaLabel: "Parliamo" },
      pt: { headline: "Boa noite", headlineWithName: "Boa noite, {name}", ctaLabel: "Falar" },
    },
  },
  {
    id: "health-safe-default",
    surface: "health",
    reason: "evergreen",
    priority: 10,
    cooldownHours: 8,
    copy: {
      es: { sourceText: "Salud", headline: "Todo en orden", subtitle: "Revisa tu salud hoy", contextHint: "health doctor" },
      en: { sourceText: "Health", headline: "All good", subtitle: "Check your health today", contextHint: "health doctor" },
      de: { sourceText: "Gesundheit", headline: "Alles ruhig", subtitle: "Gesundheit heute pruefen", contextHint: "health doctor" },
      fr: { sourceText: "Sante", headline: "Tout va bien", subtitle: "Verifier votre sante", contextHint: "health doctor" },
      it: { sourceText: "Salute", headline: "Tutto bene", subtitle: "Controlla la salute", contextHint: "health doctor" },
      pt: { sourceText: "Saude", headline: "Tudo bem", subtitle: "Verificar saude hoje", contextHint: "health doctor" },
    },
  },
  {
    id: "health-urgent",
    surface: "health",
    reason: "safety",
    priority: 100,
    cooldownHours: 0,
    safetyLevels: ["urgent"],
    copy: {
      es: { sourceText: "Cuidado", headline: "Busca ayuda", subtitle: "Si es urgente, llama emergencias", ctaLabel: "Pedir ayuda", contextHint: "urgent health" },
      en: { sourceText: "Care", headline: "Get help", subtitle: "If urgent, call emergency services", ctaLabel: "Get help", contextHint: "urgent health" },
      de: { sourceText: "Achtung", headline: "Hilfe holen", subtitle: "Bei Notfall Notruf waehlen", ctaLabel: "Hilfe holen", contextHint: "urgent health" },
      fr: { sourceText: "Attention", headline: "Cherchez aide", subtitle: "Si urgent, appelez secours", ctaLabel: "Aide", contextHint: "urgent health" },
      it: { sourceText: "Attenzione", headline: "Chiedi aiuto", subtitle: "Se urgente chiama emergenza", ctaLabel: "Aiuto", contextHint: "urgent health" },
      pt: { sourceText: "Cuidado", headline: "Peça ajuda", subtitle: "Se urgente, ligue emergencia", ctaLabel: "Ajuda", contextHint: "urgent health" },
    },
  },
  {
    id: "concierge-default",
    surface: "concierge",
    reason: "evergreen",
    priority: 10,
    cooldownHours: 8,
    copy: {
      es: { sourceText: "Tu ayudante", headline: "Que necesitas", subtitle: "Pido y organizo", ctaLabel: "Hablar", contextHint: "concierge" },
      en: { sourceText: "Your helper", headline: "Need help", subtitle: "Book and arrange", ctaLabel: "Talk", contextHint: "concierge" },
      de: { sourceText: "Hilfe", headline: "Was brauchst du", subtitle: "Buchen und regeln", ctaLabel: "Sprechen", contextHint: "concierge" },
      fr: { sourceText: "Aide", headline: "Besoin aide", subtitle: "Reserver et organiser", ctaLabel: "Parler", contextHint: "concierge" },
      it: { sourceText: "Aiuto", headline: "Serve aiuto", subtitle: "Prenoto e organizzo", ctaLabel: "Parla", contextHint: "concierge" },
      pt: { sourceText: "Ajuda", headline: "Precisa ajuda", subtitle: "Reservo e organizo", ctaLabel: "Falar", contextHint: "concierge" },
    },
  },
  {
    id: "meds-default",
    surface: "meds",
    reason: "evergreen",
    priority: 10,
    cooldownHours: 8,
    copy: {
      es: { sourceText: "Medicacion", headline: "Tus medicinas", subtitle: "Seguimos el plan", ctaLabel: "Hablar", contextHint: "medication reminder" },
      en: { sourceText: "Medication", headline: "Your medicine", subtitle: "Follow the plan", ctaLabel: "Talk", contextHint: "medication reminder" },
      de: { sourceText: "Medizin", headline: "Deine Medizin", subtitle: "Plan einhalten", ctaLabel: "Sprechen", contextHint: "medication reminder" },
      fr: { sourceText: "Medicaments", headline: "Vos medicaments", subtitle: "Suivre le plan", ctaLabel: "Parler", contextHint: "medication reminder" },
      it: { sourceText: "Farmaci", headline: "I tuoi farmaci", subtitle: "Seguiamo il piano", ctaLabel: "Parla", contextHint: "medication reminder" },
      pt: { sourceText: "Medicacao", headline: "Seus remedios", subtitle: "Seguir o plano", ctaLabel: "Falar", contextHint: "medication reminder" },
    },
  },
  {
    id: "vitals-default",
    surface: "vitals",
    reason: "evergreen",
    priority: 10,
    cooldownHours: 8,
    copy: {
      es: { sourceText: "Signos", headline: "Signos activos", subtitle: "Escanea tus signos", ctaLabel: "Escanear signos", contextHint: "vitals scan" },
      en: { sourceText: "Vitals", headline: "Vitals active", subtitle: "Scan your vitals", ctaLabel: "Scan vitals", contextHint: "vitals scan" },
      de: { sourceText: "Werte", headline: "Werte aktiv", subtitle: "Vitalwerte scannen", ctaLabel: "Werte scannen", contextHint: "vitals scan" },
      fr: { sourceText: "Signes", headline: "Signes actifs", subtitle: "Scanner vos signes", ctaLabel: "Scanner", contextHint: "vitals scan" },
      it: { sourceText: "Parametri", headline: "Parametri attivi", subtitle: "Scansiona i segni", ctaLabel: "Scansiona", contextHint: "vitals scan" },
      pt: { sourceText: "Sinais", headline: "Sinais ativos", subtitle: "Escanear sinais", ctaLabel: "Escanear", contextHint: "vitals scan" },
    },
  },
  {
    id: "doctor-default",
    surface: "doctor",
    reason: "evergreen",
    priority: 10,
    cooldownHours: 8,
    copy: {
      es: { sourceText: "Ayuda medica", headline: "Elige opcion", subtitle: "Toca una opcion", ctaLabel: "Hablar ahora", contextHint: "doctor choice" },
      en: { sourceText: "Medical help", headline: "Choose option", subtitle: "Tap one option", ctaLabel: "Talk now", contextHint: "doctor choice" },
      de: { sourceText: "Medizin", headline: "Option waehlen", subtitle: "Eine Option tippen", ctaLabel: "Jetzt sprechen", contextHint: "doctor choice" },
      fr: { sourceText: "Aide medicale", headline: "Choisir option", subtitle: "Touchez une option", ctaLabel: "Parler", contextHint: "doctor choice" },
      it: { sourceText: "Aiuto medico", headline: "Scegli opzione", subtitle: "Tocca una opzione", ctaLabel: "Parla ora", contextHint: "doctor choice" },
      pt: { sourceText: "Ajuda medica", headline: "Escolha opcao", subtitle: "Toque uma opcao", ctaLabel: "Falar agora", contextHint: "doctor choice" },
    },
  },
  {
    id: "brain-default",
    surface: "brain",
    reason: "evergreen",
    priority: 10,
    cooldownHours: 8,
    copy: {
      es: { sourceText: "Mente", headline: "Mente activa", subtitle: "Manten tu mente agil", ctaLabel: "Empezar", contextHint: "brain training" },
      en: { sourceText: "Mind", headline: "Mind active", subtitle: "Keep your mind sharp", ctaLabel: "Start", contextHint: "brain training" },
      de: { sourceText: "Geist", headline: "Geist aktiv", subtitle: "Geist fit halten", ctaLabel: "Starten", contextHint: "brain training" },
      fr: { sourceText: "Cerveau", headline: "Cerveau en forme", subtitle: "Gardez votre cerveau actif", ctaLabel: "Demarrer", contextHint: "brain training" },
      it: { sourceText: "Mente", headline: "Mente attiva", subtitle: "Mantieni mente agile", ctaLabel: "Inizia", contextHint: "brain training" },
      pt: { sourceText: "Mente", headline: "Mente ativa", subtitle: "Mantenha mente ativa", ctaLabel: "Comecar", contextHint: "brain training" },
    },
  },
  {
    id: "activity-default",
    surface: "activity",
    reason: "evergreen",
    priority: 10,
    cooldownHours: 8,
    copy: {
      es: { sourceText: "Movimiento", headline: "Moverse suave", subtitle: "Actividad segura", ctaLabel: "Empezar", contextHint: "daily movement" },
      en: { sourceText: "Movement", headline: "Move gently", subtitle: "Safe activity", ctaLabel: "Start", contextHint: "daily movement" },
      de: { sourceText: "Bewegung", headline: "Sanft bewegen", subtitle: "Sichere Aktivitaet", ctaLabel: "Starten", contextHint: "daily movement" },
      fr: { sourceText: "Mouvement", headline: "Bouger doucement", subtitle: "Activite sure", ctaLabel: "Demarrer", contextHint: "daily movement" },
      it: { sourceText: "Movimento", headline: "Muoversi piano", subtitle: "Attivita sicura", ctaLabel: "Inizia", contextHint: "daily movement" },
      pt: { sourceText: "Movimento", headline: "Mover suave", subtitle: "Atividade segura", ctaLabel: "Comecar", contextHint: "daily movement" },
    },
  },
  {
    id: "companions-default",
    surface: "companions",
    reason: "evergreen",
    priority: 10,
    cooldownHours: 8,
    copy: {
      es: { sourceText: "Comunidad", headline: "Conecta hoy", subtitle: "Salas y charla", ctaLabel: "Explorar", contextHint: "community" },
      en: { sourceText: "Community", headline: "Connect today", subtitle: "Rooms and chats", ctaLabel: "Explore", contextHint: "community" },
      de: { sourceText: "Gemeinschaft", headline: "Heute verbinden", subtitle: "Raeume und Gesprache", ctaLabel: "Entdecken", contextHint: "community" },
      fr: { sourceText: "Communaute", headline: "Connecter aujourd'hui", subtitle: "Salons et discussions", ctaLabel: "Explorer", contextHint: "community" },
      it: { sourceText: "Comunita", headline: "Connetti oggi", subtitle: "Stanze e chat", ctaLabel: "Esplora", contextHint: "community" },
      pt: { sourceText: "Comunidade", headline: "Conectar hoje", subtitle: "Salas e conversas", ctaLabel: "Explorar", contextHint: "community" },
    },
  },
  {
    id: "social-default",
    surface: "social",
    reason: "evergreen",
    priority: 10,
    cooldownHours: 8,
    copy: {
      es: { sourceText: "Social", headline: "Elige sala", subtitle: "Entra cuando quieras", ctaLabel: "Entrar", contextHint: "social rooms" },
      en: { sourceText: "Social", headline: "Choose room", subtitle: "Join when ready", ctaLabel: "Enter", contextHint: "social rooms" },
      de: { sourceText: "Sozial", headline: "Raum waehlen", subtitle: "Eintreten wenn bereit", ctaLabel: "Eintreten", contextHint: "social rooms" },
      fr: { sourceText: "Social", headline: "Choisir salon", subtitle: "Entrer quand pret", ctaLabel: "Entrer", contextHint: "social rooms" },
      it: { sourceText: "Sociale", headline: "Scegli stanza", subtitle: "Entra quando vuoi", ctaLabel: "Entra", contextHint: "social rooms" },
      pt: { sourceText: "Social", headline: "Escolha sala", subtitle: "Entre quando quiser", ctaLabel: "Entrar", contextHint: "social rooms" },
    },
  },
];

let runtimeHeroMessages: HeroMessageDefinition[] | null = null;

export function setRuntimeHeroMessages(messages: HeroMessageDefinition[] | null): void {
  runtimeHeroMessages = messages?.length ? mergeHeroMessages(messages) : null;
}

export function getRuntimeHeroMessages(): HeroMessageDefinition[] {
  return runtimeHeroMessages ?? HERO_MESSAGES;
}

export function mergeHeroMessages(messages: HeroMessageDefinition[]): HeroMessageDefinition[] {
  const merged = new Map<string, HeroMessageDefinition>();
  for (const message of HERO_MESSAGES) merged.set(message.id, message);
  for (const message of messages) {
    const existing = merged.get(message.id);
    const managedMessage = { ...message, source: "managed" as const };
    merged.set(
      message.id,
      existing ? { ...existing, ...managedMessage, copy: managedMessage.copy } : managedMessage,
    );
  }
  return Array.from(merged.values());
}

function validCopy(copy: HeroCopy): boolean {
  return (
    isWithinLimit(copy.sourceText, HERO_LIMITS.sourceWords, HERO_LIMITS.sourceChars) &&
    isWithinLimit(copy.headline, HERO_LIMITS.headlineWords, HERO_LIMITS.headlineChars) &&
    isWithinLimit(copy.subtitle, HERO_LIMITS.subtitleWords, HERO_LIMITS.subtitleChars) &&
    isWithinLimit(copy.ctaLabel, HERO_LIMITS.ctaWords, HERO_LIMITS.ctaChars)
  );
}

function buildResult(message: HeroMessageDefinition, language: HeroLanguage, context: HeroMessageContext): HeroMessageResult {
  const copy = message.copy[language] ?? message.copy.en ?? message.copy.es ?? { headline: "" };
  const name = displayFirstName(context.firstName);
  let headline = copy.headline;
  if (name && copy.headlineWithName) {
    const personalized = applyName(copy.headlineWithName, name);
    if (isWithinLimit(personalized, HERO_LIMITS.headlineWords, HERO_LIMITS.headlineChars)) {
      headline = personalized;
    }
  }

  return {
    headline,
    subtitle: copy.subtitle ?? context.fallbackSubtitle,
    sourceText: copy.sourceText ?? context.fallbackSourceText,
    ctaLabel: copy.ctaLabel ?? context.fallbackCtaLabel,
    contextHint: copy.contextHint ?? context.fallbackContextHint,
    actionId: copy.actionId,
    actionRoute: message.actionRoute,
    messageId: message.id,
    reason: message.reason,
    surface: message.surface,
    language,
    source: message.source ?? "built_in",
    priority: message.priority,
    messageType: message.messageType ?? "standard",
    welcomeAudience: message.welcomeAudience,
    welcomeMomentType: message.welcomeMomentType,
    welcomeProfileAction: message.welcomeProfileAction,
  };
}

function fallbackResult(
  surface: HeroSurface,
  context: HeroMessageContext,
  language: HeroLanguage,
  fallbackReason: HeroFallbackReason,
): HeroMessageResult {
  return {
    headline: context.fallbackHeadline || "VYVA",
    subtitle: context.fallbackSubtitle,
    sourceText: context.fallbackSourceText,
    ctaLabel: context.fallbackCtaLabel,
    contextHint: context.fallbackContextHint,
    messageId: `${surface}-fallback`,
    reason: "evergreen",
    surface,
    language,
    source: "fallback",
    fallbackReason,
  };
}

function orderedByCooldown(
  eligible: HeroMessageDefinition[],
  now: number,
  impressions: Record<string, number>,
): HeroMessageDefinition[] {
  const notCoolingDown = eligible.find((message) => !isCoolingDown(message, now, impressions));
  if (!notCoolingDown) return eligible;
  return [notCoolingDown, ...eligible.filter((message) => message.id !== notCoolingDown.id)];
}

export function selectHeroMessageFromCatalog(
  surface: HeroSurface,
  context: HeroMessageContext = {},
  messages: HeroMessageDefinition[] = getRuntimeHeroMessages(),
): HeroMessageResult {
  const language = normalizeHeroLanguage(context.language);
  const period = getHeroPeriod(context.date);
  const now = (context.date ?? new Date()).getTime();
  const impressions = readImpressions();
  const eligible = messages
    .filter((message) => message.surface === surface)
    .filter((message) => matchesContext(message, context, period))
    .sort((a, b) => b.priority - a.priority);

  if (!eligible.length) return fallbackResult(surface, context, language, "no_eligible_message");

  let invalidSelected = false;
  for (const selected of orderedByCooldown(eligible, now, impressions)) {
    const result = buildResult(selected, language, context);
    if (validateHeroMessageResult(result)) return result;
    invalidSelected = true;
  }

  const builtInEligible = HERO_MESSAGES
    .filter((message) => message.surface === surface)
    .filter((message) => matchesContext(message, context, period))
    .sort((a, b) => b.priority - a.priority);

  for (const selected of orderedByCooldown(builtInEligible, now, impressions)) {
    const result = buildResult(selected, language, context);
    if (validateHeroMessageResult(result)) return result;
  }

  return fallbackResult(
    surface,
    context,
    language,
    invalidSelected ? "invalid_selected_message" : "no_eligible_message",
  );
}

export function selectHeroMessage(surface: HeroSurface, context: HeroMessageContext = {}): HeroMessageResult {
  return selectHeroMessageFromCatalog(surface, context, getRuntimeHeroMessages());
}

export function recordHeroImpression(messageId: string): void {
  if (typeof window === "undefined" || messageId.endsWith("-fallback")) return;
  try {
    const impressions = readImpressions();
    impressions[messageId] = Date.now();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(impressions));
  } catch {
    // Non-critical: repetition control should never break the UI.
  }
}

export function recordHeroEvent(event: HeroMessageEventInput): void {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    message_id: event.messageId,
    surface: event.surface,
    language: normalizeHeroLanguage(event.language),
    event_type: event.eventType,
    reason: event.reason,
    source: event.source,
    route: event.route ?? window.location.pathname,
  });

  try {
    if (navigator.sendBeacon) {
      const body = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon("/api/hero-messages/events", body)) return;
    }
  } catch {
    // Fall through to fetch.
  }

  try {
    void fetch("/api/hero-messages/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      credentials: "include",
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Aggregate monitoring should never block the user flow.
  }
}

export function validateHeroMessageResult(message: Pick<HeroMessageResult, "headline" | "subtitle" | "sourceText" | "ctaLabel">): boolean {
  return (
    isWithinLimit(message.sourceText, HERO_LIMITS.sourceWords, HERO_LIMITS.sourceChars) &&
    isWithinLimit(message.headline, HERO_LIMITS.headlineWords, HERO_LIMITS.headlineChars) &&
    isWithinLimit(message.subtitle, HERO_LIMITS.subtitleWords, HERO_LIMITS.subtitleChars) &&
    isWithinLimit(message.ctaLabel, HERO_LIMITS.ctaWords, HERO_LIMITS.ctaChars)
  );
}

export function validateHeroMessageCatalog(messages: HeroMessageDefinition[] = getRuntimeHeroMessages()): string[] {
  const errors: string[] = [];
  for (const message of messages) {
    for (const language of Object.keys(message.copy) as HeroLanguage[]) {
      const copy = message.copy[language];
      if (!validCopy(copy)) errors.push(`${message.id}:${language}`);
    }
  }
  return errors;
}
