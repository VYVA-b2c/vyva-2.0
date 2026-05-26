import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "../db.js";
import {
  accessLinks,
  communicationsLog,
  onboardingState,
  profiles,
  userChannelPreferences,
  userIntakes,
  userMedications,
} from "../../shared/schema.js";
import {
  ensurePasswordlessUser,
  normalizePhone,
  recordLifecycleEvent,
} from "./lifecycle.js";
import { signCallbackOnboardingToolToken } from "../lib/jwt.js";

type Database = typeof db;
type Intake = typeof userIntakes.$inferSelect;
type JsonRecord = Record<string, unknown>;
type CallbackFor = "me" | "caregiver";
type CallbackPeriod = "AM" | "PM";
type ConfirmationChannel = "email" | "whatsapp";

type OutboundResponse = {
  success?: boolean;
  message?: string;
  conversation_id?: string | null;
  callSid?: string | null;
};

export type CallbackOnboardingRequestInput = {
  first_name: string;
  last_name: string;
  country_code: string;
  phone: string;
  preferred_date: string;
  preferred_time: string;
  preferred_period: CallbackPeriod;
  callback_for: CallbackFor;
  language?: string | null;
  timezone?: string | null;
};

export type CallbackOnboardingCompletionInput = {
  intakeId: string;
  conversationId?: string | null;
  confirmationChannel: ConfirmationChannel;
  email?: string | null;
  whatsappNumber?: string | null;
  profile?: JsonRecord;
  caregiver?: JsonRecord;
  sections?: Record<string, JsonRecord>;
};

const SUPPORTED_LANGUAGES = new Set(["en", "es", "fr", "de", "it", "pt"]);
const DEFAULT_TIMEZONE = "Europe/Madrid";

function readEnv(keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function normalizeLanguage(value?: string | null) {
  const base = value?.split("-")[0]?.trim().toLowerCase();
  return base && SUPPORTED_LANGUAGES.has(base) ? base : "en";
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function textOrNull(value: unknown): string | null {
  const trimmed = text(value);
  return trimmed ? trimmed : null;
}

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

function callbackMetadata(intake: Pick<Intake, "metadata">): JsonRecord {
  return asRecord(asRecord(intake.metadata).callback);
}

function mergeCallbackMetadata(intake: Pick<Intake, "metadata">, patch: JsonRecord): JsonRecord {
  const metadata = asRecord(intake.metadata);
  return {
    ...metadata,
    callback: {
      ...asRecord(metadata.callback),
      ...patch,
    },
  };
}

function normalizePhoneWithCountry(countryCode: string, phone: string) {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return normalizePhone(trimmed);
  return normalizePhone(`${countryCode} ${trimmed}`);
}

function timeWithPeriod(timeValue: string, period: CallbackPeriod) {
  const [hourRaw, minuteRaw = "0"] = timeValue.split(":");
  const rawHour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(rawHour) || !Number.isFinite(minute)) {
    throw new Error("Invalid preferred time");
  }

  let hour = rawHour;
  if (rawHour <= 12) {
    if (period === "PM" && rawHour < 12) hour = rawHour + 12;
    if (period === "AM" && rawHour === 12) hour = 0;
  }

  return { hour, minute };
}

function partsInTimezone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function zonedDateTimeToUtc(dateValue: string, timeValue: string, period: CallbackPeriod, timezone: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const { hour, minute } = timeWithPeriod(timeValue, period);
  if (![year, month, day, hour, minute].every(Number.isFinite)) {
    throw new Error("Invalid preferred date or time");
  }

  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const parts = partsInTimezone(new Date(guess), timezone);
  const timezoneAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const offset = timezoneAsUtc - guess;
  return new Date(guess - offset);
}

function callbackSections(intake: Pick<Intake, "metadata">): Record<string, JsonRecord> {
  const sections = asRecord(callbackMetadata(intake).sections);
  return Object.fromEntries(
    Object.entries(sections).filter(([, value]) => value && typeof value === "object" && !Array.isArray(value)),
  ) as Record<string, JsonRecord>;
}

function mergedSections(intake: Intake, provided?: Record<string, JsonRecord>) {
  return {
    ...callbackSections(intake),
    ...(provided ?? {}),
  };
}

function pickProfileData(inputProfile: JsonRecord | undefined, sections: Record<string, JsonRecord>) {
  return {
    ...asRecord(sections.identity),
    ...asRecord(sections.basics),
    ...asRecord(sections.profile),
    ...asRecord(inputProfile),
  };
}

function splitTimes(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const items = value.map(text).filter(Boolean);
    return items.length ? items : null;
  }
  const raw = text(value);
  if (!raw) return null;
  const items = raw.split(/[,\n;]/).map((item) => item.trim()).filter(Boolean);
  return items.length ? items : null;
}

function medicationRows(userId: string, sections: Record<string, JsonRecord>) {
  const medications = Array.isArray(sections.medications?.medications)
    ? sections.medications.medications as JsonRecord[]
    : [];
  return medications
    .map((medication) => ({
      user_id: userId,
      medication_name: text(medication.medication_name) || text(medication.name),
      dosage: textOrNull(medication.dosage),
      frequency: textOrNull(medication.frequency),
      scheduled_times: splitTimes(medication.scheduled_times ?? medication.times),
      active: true,
      added_by: "callback_onboarding",
    }))
    .filter((medication) => medication.medication_name);
}

function knownAllergies(sections: Record<string, JsonRecord>) {
  const medicationsAllergies = sections.medications?.known_allergies;
  const conditionsAllergies = sections.conditions?.allergies;
  const value = Array.isArray(medicationsAllergies) ? medicationsAllergies : conditionsAllergies;
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function mergeConsentData(
  existing: unknown,
  sections: Record<string, JsonRecord>,
  confirmationChannel: ConfirmationChannel,
) {
  return {
    ...asRecord(existing),
    ...sections,
    communication_preferences: {
      ...asRecord(asRecord(existing).communication_preferences),
      confirmation_channel: confirmationChannel,
      captured_via: "callback_onboarding",
    },
  };
}

function confirmationCopy(language: string, name: string, url: string) {
  const displayName = firstName(name);
  if (language === "es") {
    return {
      subject: "Tu cuenta VYVA esta lista",
      body: `Hola ${displayName}, tu configuracion de VYVA esta lista. Puedes entrar aqui: ${url}`,
    };
  }
  if (language === "fr") {
    return {
      subject: "Votre compte VYVA est pret",
      body: `Bonjour ${displayName}, votre configuration VYVA est prete. Ouvrez votre acces ici : ${url}`,
    };
  }
  if (language === "de") {
    return {
      subject: "Ihr VYVA-Konto ist bereit",
      body: `Hallo ${displayName}, Ihre VYVA-Einrichtung ist bereit. Hier offnen: ${url}`,
    };
  }
  if (language === "it") {
    return {
      subject: "Il tuo account VYVA e pronto",
      body: `Ciao ${displayName}, la configurazione VYVA e pronta. Apri qui: ${url}`,
    };
  }
  if (language === "pt") {
    return {
      subject: "A sua conta VYVA esta pronta",
      body: `Ola ${displayName}, a configuracao da VYVA esta pronta. Abra aqui: ${url}`,
    };
  }
  return {
    subject: "Your VYVA account is ready",
    body: `Hi ${displayName}, your VYVA setup is ready. Open your secure access here: ${url}`,
  };
}

export function publicBaseUrl(req?: { protocol: string; get(name: string): string | undefined }) {
  return process.env.APP_URL ?? (req ? `${req.protocol}://${req.get("host")}` : `http://localhost:${process.env.PORT ?? "5000"}`);
}

export async function createCallbackOnboardingRequest(input: CallbackOnboardingRequestInput, database: Database = db) {
  const first = input.first_name.trim();
  const last = input.last_name.trim();
  const fullName = `${first} ${last}`.trim();
  const timezone = input.timezone?.trim() || DEFAULT_TIMEZONE;
  const language = normalizeLanguage(input.language);
  const phone = normalizePhoneWithCountry(input.country_code, input.phone);
  const scheduledFor = zonedDateTimeToUtc(input.preferred_date, input.preferred_time, input.preferred_period, timezone);
  const now = new Date();

  const [intake] = await database.insert(userIntakes).values({
    user_id: null,
    elder_user_id: null,
    family_user_id: null,
    name: fullName,
    phone,
    email: null,
    user_type: input.callback_for === "caregiver" ? "family" : "elder",
    entry_point: "phone",
    tier: "premium",
    status: "created",
    journey_step: "callback_scheduled",
    consent_status: "not_required",
    source_payload: {
      first_name: first,
      last_name: last,
      country_code: input.country_code,
      phone: input.phone,
      preferred_date: input.preferred_date,
      preferred_time: input.preferred_time,
      preferred_period: input.preferred_period,
      callback_for: input.callback_for,
      language,
      timezone,
    },
    metadata: {
      callback: {
        status: "scheduled",
        scheduled_for: scheduledFor.toISOString(),
        callback_for: input.callback_for,
        language,
        timezone,
        requested_at: now.toISOString(),
        first_name: first,
        last_name: last,
      },
    },
    last_activity_at: now,
  }).returning();

  await recordLifecycleEvent({
    intakeId: intake.id,
    eventType: "callback_scheduled",
    toStatus: "created",
    channel: "phone",
    metadata: {
      scheduled_for: scheduledFor.toISOString(),
      callback_for: input.callback_for,
      language,
    },
  }, database);

  return { intake, scheduledFor };
}

export async function triggerCallbackOnboardingCall(intake: Intake, database: Database = db) {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const agentId = readEnv(["ELEVENLABS_CALLBACK_ONBOARDING_AGENT_ID"]);
  const agentPhoneNumberId = readEnv([
    "ELEVENLABS_CALLBACK_ONBOARDING_PHONE_NUMBER_ID",
    "ELEVENLABS_CONCIERGE_PHONE_NUMBER_ID",
    "ELEVENLABS_AGENT_PHONE_NUMBER_ID",
  ]);
  const callback = callbackMetadata(intake);

  async function fail(message: string) {
    await database.update(userIntakes).set({
      journey_step: "callback_call_failed",
      metadata: mergeCallbackMetadata(intake, {
        status: "call_failed",
        error: message,
        failed_at: new Date().toISOString(),
      }),
      last_activity_at: new Date(),
      updated_at: new Date(),
    }).where(eq(userIntakes.id, intake.id));
    await recordLifecycleEvent({
      intakeId: intake.id,
      eventType: "callback_call_failed",
      channel: "phone",
      metadata: { error: message },
    }, database);
    return { intakeId: intake.id, status: "failed" as const, message };
  }

  if (!apiKey) return fail("Missing ElevenLabs API key.");
  if (!agentId) return fail("Missing ElevenLabs callback onboarding agent ID.");
  if (!agentPhoneNumberId) return fail("Missing ElevenLabs callback onboarding phone number ID or shared outbound phone number ID.");

  const toolToken = await signCallbackOnboardingToolToken(intake.id);
  const dynamicVariables: Record<string, string> = {
    intake_id: intake.id,
    first_name: text(callback.first_name) || firstName(intake.name),
    full_name: intake.name,
    callback_for: text(callback.callback_for) || intake.user_type,
    language: text(callback.language) || "en",
    scheduled_for: text(callback.scheduled_for),
    onboarding_tool_token: toolToken,
  };

  const response = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      agent_id: agentId,
      agent_phone_number_id: agentPhoneNumberId,
      to_number: intake.phone,
      conversation_initiation_client_data: {
        dynamic_variables: dynamicVariables,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    return fail(`ElevenLabs outbound call failed: ${detail}`);
  }

  const data = await response.json().catch(() => ({})) as OutboundResponse;
  await database.update(userIntakes).set({
    journey_step: "callback_calling",
    metadata: mergeCallbackMetadata(intake, {
      status: "calling",
      conversation_id: data.conversation_id ?? null,
      call_sid: data.callSid ?? null,
      call_started_at: new Date().toISOString(),
    }),
    last_activity_at: new Date(),
    updated_at: new Date(),
  }).where(eq(userIntakes.id, intake.id));

  await recordLifecycleEvent({
    intakeId: intake.id,
    eventType: "callback_call_started",
    channel: "phone",
    metadata: {
      conversation_id: data.conversation_id ?? null,
      call_sid: data.callSid ?? null,
    },
  }, database);

  return {
    intakeId: intake.id,
    status: "calling" as const,
    conversationId: data.conversation_id ?? null,
    callSid: data.callSid ?? null,
    message: data.message ?? "Callback onboarding call started.",
  };
}

export async function queueDueCallbackOnboardingCalls(limit = 25, database: Database = db) {
  const rows = await database.select()
    .from(userIntakes)
    .where(and(
      eq(userIntakes.entry_point, "phone"),
      eq(userIntakes.status, "created"),
      eq(userIntakes.journey_step, "callback_scheduled"),
    ))
    .orderBy(asc(userIntakes.created_at))
    .limit(limit);

  const now = Date.now();
  const due = rows.filter((intake) => {
    const scheduledFor = text(callbackMetadata(intake).scheduled_for);
    return scheduledFor && new Date(scheduledFor).getTime() <= now;
  });

  const results = [];
  for (const intake of due) {
    results.push(await triggerCallbackOnboardingCall(intake, database));
  }
  return results;
}

export async function saveCallbackOnboardingSection(input: {
  intakeId: string;
  conversationId?: string | null;
  sectionId: string;
  data: JsonRecord;
}, database: Database = db) {
  const [intake] = await database.select().from(userIntakes).where(eq(userIntakes.id, input.intakeId)).limit(1);
  if (!intake) return null;

  const sections = callbackSections(intake);
  const metadata = mergeCallbackMetadata(intake, {
    sections: {
      ...sections,
      [input.sectionId]: input.data,
    },
    last_saved_section: input.sectionId,
    last_saved_at: new Date().toISOString(),
    last_tool_conversation_id: input.conversationId ?? null,
  });

  const [updated] = await database.update(userIntakes).set({
    metadata,
    journey_step: "callback_collecting_profile",
    consent_status: "captured",
    last_activity_at: new Date(),
    updated_at: new Date(),
  }).where(eq(userIntakes.id, intake.id)).returning();

  await recordLifecycleEvent({
    intakeId: intake.id,
    eventType: "callback_section_saved",
    channel: "elevenlabs_tool",
    metadata: { section_id: input.sectionId, conversation_id: input.conversationId ?? null },
  }, database);

  return updated;
}

async function applyProfileSections(
  userId: string,
  profileData: JsonRecord,
  sections: Record<string, JsonRecord>,
  confirmationChannel: ConfirmationChannel,
  database: Database,
) {
  const allergies = knownAllergies(sections);
  const address = asRecord(sections.address);
  const gp = asRecord(sections.gp);
  const [existingProfile] = await database.select({ data_sharing_consent: profiles.data_sharing_consent })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  const now = new Date();

  await database.update(profiles).set({
    full_name: text(profileData.full_name) || text(profileData.name) || undefined,
    preferred_name: textOrNull(profileData.preferred_name),
    date_of_birth: textOrNull(profileData.date_of_birth),
    language: normalizeLanguage(text(profileData.language)),
    phone_number: textOrNull(profileData.phone_number),
    email: textOrNull(profileData.email),
    whatsapp_number: textOrNull(profileData.whatsapp_number),
    country_code: textOrNull(profileData.country_code),
    timezone: text(profileData.timezone) || DEFAULT_TIMEZONE,
    onboarding_channel: "voice",
    current_stage: "complete",
    onboarding_complete: true,
    stage_1_completed_at: now,
    stage_2_completed_at: now,
    stage_3_completed_at: now,
    stage_4_completed_at: now,
    stage_5_completed_at: now,
    address_line_1: textOrNull(address.address_line_1),
    city: textOrNull(address.city),
    region: textOrNull(address.region),
    postcode: textOrNull(address.postcode),
    gp_name: textOrNull(gp.gp_name),
    gp_phone: textOrNull(gp.gp_phone),
    gp_address: textOrNull(gp.gp_address),
    gp_maps_url: textOrNull(gp.gp_maps_url),
    gp_place_id: textOrNull(gp.gp_place_id),
    known_allergies: allergies.length ? allergies : null,
    data_sharing_consent: mergeConsentData(existingProfile?.data_sharing_consent, sections, confirmationChannel),
    channel_reports: confirmationChannel,
    channel_notifications: confirmationChannel,
    updated_at: now,
  }).where(eq(profiles.id, userId));

  const meds = medicationRows(userId, sections);
  await database.delete(userMedications).where(and(
    eq(userMedications.user_id, userId),
    eq(userMedications.added_by, "callback_onboarding"),
  ));
  if (meds.length) await database.insert(userMedications).values(meds);

  await database.insert(onboardingState).values({
    user_id: userId,
    has_preferred_name: Boolean(text(profileData.preferred_name)),
    has_phone_number: Boolean(text(profileData.phone_number)),
    has_language: true,
    has_date_of_birth: Boolean(text(profileData.date_of_birth)),
    has_emergency_address: Boolean(sections.emergency),
    has_checkin_preference: true,
    has_location: Boolean(sections.address),
    has_health_conditions: Boolean(sections.conditions),
    has_medications: meds.length > 0,
    has_allergies: allergies.length > 0,
    has_gp_details: Boolean(sections.gp),
    has_caregiver: Boolean(sections.careteam),
    feature_medication_mgmt: meds.length > 0,
    feature_vital_scan: Boolean(sections.conditions),
    feature_health_research: Boolean(sections.conditions || sections.gp || allergies.length),
    feature_concierge: Boolean(sections.address),
    feature_caregiver_alerts: Boolean(sections.careteam),
    updated_at: now,
  }).onConflictDoUpdate({
    target: onboardingState.user_id,
    set: {
      has_preferred_name: Boolean(text(profileData.preferred_name)),
      has_phone_number: Boolean(text(profileData.phone_number)),
      has_language: true,
      has_date_of_birth: Boolean(text(profileData.date_of_birth)),
      has_emergency_address: Boolean(sections.emergency),
      has_checkin_preference: true,
      has_location: Boolean(sections.address),
      has_health_conditions: Boolean(sections.conditions),
      has_medications: meds.length > 0,
      has_allergies: allergies.length > 0,
      has_gp_details: Boolean(sections.gp),
      has_caregiver: Boolean(sections.careteam),
      feature_medication_mgmt: meds.length > 0,
      feature_vital_scan: Boolean(sections.conditions),
      feature_health_research: Boolean(sections.conditions || sections.gp || allergies.length),
      feature_concierge: Boolean(sections.address),
      feature_caregiver_alerts: Boolean(sections.careteam),
      updated_at: now,
    },
  });
}

async function saveConfirmationPreference(
  userId: string,
  channel: ConfirmationChannel,
  recipient: string,
  database: Database,
) {
  const [existingProfile] = await database.select({ data_sharing_consent: profiles.data_sharing_consent })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  const existingConsent = asRecord(existingProfile?.data_sharing_consent);
  const communicationPreferences = {
    ...asRecord(existingConsent.communication_preferences),
    confirmation_channel: channel,
    captured_via: "callback_onboarding",
  };

  await database.update(profiles).set({
    ...(channel === "email"
      ? { email: recipient, channel_reports: "email", channel_notifications: "email" }
      : { whatsapp_number: recipient, channel_reports: "whatsapp", channel_notifications: "whatsapp" }),
    data_sharing_consent: {
      ...existingConsent,
      communication_preferences: communicationPreferences,
    },
    updated_at: new Date(),
  }).where(eq(profiles.id, userId));

  if (channel === "whatsapp") {
    await database.insert(userChannelPreferences).values({
      user_id: userId,
      preferred_checkin_channel: "whatsapp_outbound",
      preferred_reminder_channel: "whatsapp_outbound",
      preferred_alert_channel: "whatsapp_outbound",
      fallback_chain: ["whatsapp_outbound", "voice_outbound"],
    }).onConflictDoUpdate({
      target: userChannelPreferences.user_id,
      set: {
        preferred_checkin_channel: "whatsapp_outbound",
        preferred_reminder_channel: "whatsapp_outbound",
        preferred_alert_channel: "whatsapp_outbound",
        fallback_chain: ["whatsapp_outbound", "voice_outbound"],
        updated_at: new Date(),
      },
    });
  }
}

async function createAccessLinkForCompletion(input: {
  intake: Intake;
  userId: string;
  targetRole: string;
  destination: string;
  baseUrl: string;
}, database: Database) {
  const token = randomUUID();
  const [link] = await database.insert(accessLinks).values({
    token,
    user_id: input.userId,
    intake_id: input.intake.id,
    organization_id: input.intake.organization_id,
    link_type: input.targetRole === "family" ? "caregiver" : "unlimited",
    tier: "premium",
    destination: input.destination,
    target_role: input.targetRole,
    max_uses: 1,
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    metadata: { source: "callback_onboarding" },
  }).returning();
  return { link, url: `${input.baseUrl}/access/${token}` };
}

export async function completeCallbackOnboarding(input: CallbackOnboardingCompletionInput, baseUrl = publicBaseUrl(), database: Database = db) {
  const [intake] = await database.select().from(userIntakes).where(eq(userIntakes.id, input.intakeId)).limit(1);
  if (!intake) return { error: "Callback onboarding intake not found" as const };

  const sections = mergedSections(intake, input.sections);
  const callback = callbackMetadata(intake);
  const rawProfile = pickProfileData(input.profile, sections);
  const callbackFor = (text(callback.callback_for) || (intake.user_type === "family" ? "caregiver" : "me")) as CallbackFor;
  const confirmationChannel = input.confirmationChannel;
  const confirmationRecipient = confirmationChannel === "email"
    ? text(input.email) || text(rawProfile.email)
    : normalizePhone(text(input.whatsappNumber) || text(rawProfile.whatsapp_number) || intake.phone);

  if (!confirmationRecipient) {
    return { error: `Missing ${confirmationChannel} for confirmation` as const };
  }

  const profileName = text(rawProfile.full_name) || text(rawProfile.name) || intake.name;
  const profilePhone = normalizePhone(text(rawProfile.phone_number) || intake.phone);
  const profileData = {
    ...rawProfile,
    full_name: profileName,
    phone_number: profilePhone,
    email: text(input.email) || text(rawProfile.email),
    whatsapp_number: text(input.whatsappNumber) || text(rawProfile.whatsapp_number) || intake.phone,
    language: normalizeLanguage(text(rawProfile.language) || text(callback.language)),
    timezone: text(rawProfile.timezone) || text(callback.timezone) || DEFAULT_TIMEZONE,
  };

  const elderUser = await ensurePasswordlessUser({
    name: profileName,
    phone: profilePhone,
    email: text(profileData.email) || null,
    tier: "premium",
    profile: profileData,
  }, database);
  await applyProfileSections(elderUser.id, profileData, sections, confirmationChannel, database);

  let confirmationUserId = elderUser.id;
  let familyUserId: string | null = null;
  if (callbackFor === "caregiver") {
    const caregiverData = {
      ...asRecord(input.caregiver),
      full_name: text(asRecord(input.caregiver).full_name) || intake.name,
      phone_number: normalizePhone(text(asRecord(input.caregiver).phone_number) || intake.phone),
      email: text(asRecord(input.caregiver).email) || (confirmationChannel === "email" ? confirmationRecipient : ""),
      whatsapp_number: text(asRecord(input.caregiver).whatsapp_number) || (confirmationChannel === "whatsapp" ? confirmationRecipient : intake.phone),
      language: normalizeLanguage(text(asRecord(input.caregiver).language) || text(callback.language)),
    };
    const caregiverUser = await ensurePasswordlessUser({
      name: text(caregiverData.full_name),
      phone: text(caregiverData.phone_number),
      email: text(caregiverData.email) || null,
      tier: "premium",
      profile: caregiverData,
    }, database);
    familyUserId = caregiverUser.id;
    confirmationUserId = caregiverUser.id;
    await saveConfirmationPreference(caregiverUser.id, confirmationChannel, confirmationRecipient, database);
  } else {
    await saveConfirmationPreference(elderUser.id, confirmationChannel, confirmationRecipient, database);
  }

  const access = await createAccessLinkForCompletion({
    intake,
    userId: confirmationUserId,
    targetRole: callbackFor === "caregiver" ? "family" : "elder",
    destination: callbackFor === "caregiver" ? "/caregiver" : "/",
    baseUrl,
  }, database);
  const copy = confirmationCopy(normalizeLanguage(text(profileData.language)), profileName, access.url);

  const [communication] = await database.insert(communicationsLog).values({
    intake_id: intake.id,
    user_id: confirmationUserId,
    channel: confirmationChannel,
    recipient: confirmationRecipient,
    purpose: "callback_onboarding_confirmation",
    status: "queued",
    body: copy.body,
    metadata: {
      subject: copy.subject,
      url: access.url,
      confirmation_channel: confirmationChannel,
      conversation_id: input.conversationId ?? null,
    },
  }).returning();

  const metadata = mergeCallbackMetadata(intake, {
    status: "completed",
    completed_at: new Date().toISOString(),
    confirmation_channel: confirmationChannel,
    confirmation_communication_id: communication.id,
    access_link_id: access.link.id,
    conversation_id: input.conversationId ?? text(callback.conversation_id) ?? null,
  });
  const [updatedIntake] = await database.update(userIntakes).set({
    user_id: confirmationUserId,
    elder_user_id: elderUser.id,
    family_user_id: familyUserId,
    status: "link_sent",
    journey_step: "callback_complete_confirmation_queued",
    consent_status: "captured",
    link_sent_at: new Date(),
    last_activity_at: new Date(),
    updated_at: new Date(),
    metadata,
  }).where(eq(userIntakes.id, intake.id)).returning();

  await recordLifecycleEvent({
    intakeId: intake.id,
    userId: confirmationUserId,
    eventType: "callback_onboarding_completed",
    fromStatus: intake.status,
    toStatus: "link_sent",
    channel: "elevenlabs_tool",
    metadata: {
      profile_id: elderUser.id,
      confirmation_channel: confirmationChannel,
      communication_id: communication.id,
      conversation_id: input.conversationId ?? null,
    },
  }, database);

  return {
    intake: updatedIntake,
    profileId: elderUser.id,
    confirmationUserId,
    accessLink: access.link,
    communication,
  };
}

export async function failCallbackOnboarding(input: {
  intakeId: string;
  conversationId?: string | null;
  reason?: string | null;
}, database: Database = db) {
  const [intake] = await database.select().from(userIntakes).where(eq(userIntakes.id, input.intakeId)).limit(1);
  if (!intake) return null;

  const [updated] = await database.update(userIntakes).set({
    status: "dropped",
    journey_step: "callback_onboarding_failed",
    dropped_at: new Date(),
    last_activity_at: new Date(),
    updated_at: new Date(),
    metadata: mergeCallbackMetadata(intake, {
      status: "failed",
      failed_at: new Date().toISOString(),
      failure_reason: input.reason ?? "Agent marked onboarding as failed",
      conversation_id: input.conversationId ?? text(callbackMetadata(intake).conversation_id) ?? null,
    }),
  }).where(eq(userIntakes.id, intake.id)).returning();

  await recordLifecycleEvent({
    intakeId: intake.id,
    eventType: "callback_onboarding_failed",
    fromStatus: intake.status,
    toStatus: "dropped",
    channel: "elevenlabs_tool",
    metadata: {
      reason: input.reason ?? null,
      conversation_id: input.conversationId ?? null,
    },
  }, database);

  return updated;
}
