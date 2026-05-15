import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "../db.js";
import {
  activityLogs,
  companionProfiles,
  users,
  profiles,
  medicationAdherence,
  scheduledEvents,
  socialRoomVisits,
  socialRooms,
  socialUserInterests,
  teamInvitations,
  triageReports,
  userChannelPreferences,
  userMedications,
  vitalsReadings,
  sessionExchanges,
} from "../../shared/schema.js";
import { formatMemoryBlock, searchMemories } from "./mem0.js";
import { socialRoomSeeds } from "./socialRoomsSeed.js";
import { buildAgentOperatingRules, buildConversationPlan } from "./voiceAgentPolicy.js";
import {
  conversationPlanToVariables,
  formatConversationPlanPrompt,
  selectVoiceConversationPlan,
} from "./voiceConversationPlans.js";

export type VoiceContextDomain =
  | "safety"
  | "meds"
  | "health"
  | "concierge"
  | "brain_coach"
  | "companion"
  | "doctor"
  | "social";

export type VoiceDynamicVariables = Record<string, string | number | boolean>;
export type ConversationTurn = { role: "user" | "assistant"; content: string };

type BuildVoiceContextOptions = {
  appEntrypoint?: string;
  priorVoiceExchangeCount?: number;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function section(consent: unknown, key: string): JsonRecord {
  return asRecord(asRecord(consent)[key]);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(asString).filter(Boolean)
    : [];
}

function valueList(values: Array<string | null | undefined>, fallback = "") {
  return values.map((value) => value?.trim() ?? "").filter(Boolean).join(", ") || fallback;
}

function joinList(values: string[], fallback = "") {
  return values.length > 0 ? values.slice(0, 12).join(", ") : fallback;
}

function compactLines(lines: Array<string | null | undefined>, maxLength = 1800) {
  return lines.map((line) => line?.trim() ?? "").filter(Boolean).join("\n").slice(0, maxLength);
}

function firstName(profile: typeof profiles.$inferSelect | null) {
  const preferred = profile?.preferred_name?.trim();
  if (preferred) return preferred;
  const full = profile?.full_name?.trim();
  return full ? full.split(/\s+/)[0] ?? "friend" : "friend";
}

function formatMedication(med: typeof userMedications.$inferSelect) {
  const details = [
    med.dosage,
    med.frequency,
    med.scheduled_times?.length ? med.scheduled_times.join("/") : null,
  ].filter(Boolean);
  return details.length > 0
    ? `${med.medication_name} (${details.join(", ")})`
    : med.medication_name;
}

function formatCareMember(member: typeof teamInvitations.$inferSelect) {
  return valueList([
    member.invitee_name,
    member.relationship,
    member.role,
    member.status ? `status ${member.status}` : null,
  ]);
}

function formatTriageReport(report: typeof triageReports.$inferSelect) {
  return valueList([
    report.chief_complaint,
    report.urgency ? `urgency ${report.urgency}` : null,
    report.symptoms?.length ? `symptoms ${report.symptoms.join(", ")}` : null,
  ], "");
}

function formatVital(vital: typeof vitalsReadings.$inferSelect) {
  const value = vital.value ??
    valueList([
      vital.bpm ? `${vital.bpm} bpm` : null,
      vital.respiratory_rate ? `${vital.respiratory_rate} breaths/min` : null,
    ]);
  return valueList([vital.metric_type ?? "vital", value], ": ");
}

function dateKeyFor(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function formatDateTime(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : "";
}

function formatRelativeTime(value: Date | string | null | undefined, now = new Date()) {
  if (!value) return "";
  const date = new Date(value);
  const diffMs = now.getTime() - date.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return `scheduled ${date.toISOString()}`;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 60) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function ageFromDate(value: string | null | undefined, now = new Date()) {
  if (!value) return "";
  const birth = new Date(value);
  if (!Number.isFinite(birth.getTime())) return "";
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? String(age) : "";
}

function birthdayContext(value: string | null | undefined, now = new Date()) {
  if (!value) return "";
  const birth = new Date(value);
  if (!Number.isFinite(birth.getTime())) return "";
  const next = new Date(Date.UTC(now.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate()));
  if (next.getTime() < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  }
  const days = Math.round((next.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86400000);
  if (days === 0) return "Birthday is today.";
  if (days <= 14) return `Birthday is in ${days} day${days === 1 ? "" : "s"}.`;
  return `Next birthday: ${next.toISOString().slice(0, 10)}.`;
}

function metricLabel(metric: string | null | undefined) {
  switch (metric) {
    case "hr":
      return "heart rate";
    case "rr":
      return "respiratory rate";
    case "bp":
      return "blood pressure";
    default:
      return metric || "vital";
  }
}

function vitalMetricEntries(row: typeof vitalsReadings.$inferSelect) {
  if (row.metric_type && row.value) {
    return [{ metric: row.metric_type, value: row.value, recordedAt: row.recorded_at }];
  }
  const entries: Array<{ metric: string; value: string; recordedAt: Date }> = [];
  if (row.bpm != null) entries.push({ metric: "hr", value: `${row.bpm} bpm`, recordedAt: row.recorded_at });
  if (row.respiratory_rate != null) {
    entries.push({ metric: "rr", value: `${row.respiratory_rate} breaths/min`, recordedAt: row.recorded_at });
  }
  return entries;
}

function latestVitalsScan(readings: Array<typeof vitalsReadings.$inferSelect>) {
  const entries = readings.flatMap(vitalMetricEntries);
  if (entries.length === 0) return "";
  const latestAt = entries[0]?.recordedAt;
  return valueList([
    latestAt ? `recorded ${formatDateTime(latestAt)}` : "",
    ...entries.slice(0, 4).map((entry) => `${metricLabel(entry.metric)} ${entry.value}`),
  ]);
}

function vitalsTrendSummary(readings: Array<typeof vitalsReadings.$inferSelect>) {
  const entriesByMetric = new Map<string, Array<{ value: string; recordedAt: Date }>>();
  for (const entry of readings.flatMap(vitalMetricEntries)) {
    const bucket = entriesByMetric.get(entry.metric) ?? [];
    bucket.push({ value: entry.value, recordedAt: entry.recordedAt });
    entriesByMetric.set(entry.metric, bucket);
  }

  const lines = Array.from(entriesByMetric.entries()).map(([metric, entries]) => {
    const sorted = [...entries].sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime()).slice(0, 7);
    const values = sorted.map((entry) => `${dateKeyFor(entry.recordedAt)} ${entry.value}`);
    return `${metricLabel(metric)} recent values: ${values.join(" | ")}`;
  });
  return compactLines(lines, 1200);
}

function formatTriageReportDetailed(report: typeof triageReports.$inferSelect) {
  return valueList([
    report.created_at ? `recorded ${formatDateTime(report.created_at)}` : null,
    report.chief_complaint,
    report.urgency ? `urgency ${report.urgency}` : null,
    report.symptoms?.length ? `symptoms ${report.symptoms.join(", ")}` : null,
    report.bpm ? `heart rate ${report.bpm} bpm` : null,
    report.respiratory_rate ? `respiratory rate ${report.respiratory_rate} breaths/min` : null,
  ], "");
}

function dosesPerDay(scheduledTimes: string[] | null | undefined) {
  return scheduledTimes && scheduledTimes.length > 0 ? scheduledTimes.length : 1;
}

function buildMedicationAdherenceSummary(
  medications: Array<typeof userMedications.$inferSelect>,
  adherenceRows: Array<typeof medicationAdherence.$inferSelect>,
) {
  if (medications.length === 0 && adherenceRows.length === 0) return "";
  const today = new Date().toISOString().slice(0, 10);
  const activeDoseCount = medications.reduce((sum, med) => sum + dosesPerDay(med.scheduled_times), 0);
  const todayTaken = adherenceRows.filter((row) => row.status === "taken" && dateKeyFor(row.created_at) === today).length;
  const taken30 = adherenceRows.filter((row) => row.status === "taken").length;
  const missed30 = adherenceRows.filter((row) => ["missed", "skipped", "late"].includes(row.status)).length;
  const latest = adherenceRows
    .slice()
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
    .slice(0, 5)
    .map((row) => `${row.medication_name} ${row.status} ${formatDateTime(row.created_at)}`);

  return compactLines([
    activeDoseCount ? `Today: ${todayTaken}/${activeDoseCount} scheduled dose confirmations recorded.` : "",
    `Last 30 days: ${taken30} taken confirmations, ${missed30} missed/skipped/late records.`,
    latest.length ? `Latest medication records: ${latest.join(" | ")}` : "",
  ], 1400);
}

function buildMedicationInteractionContext(activeMeds: string[], allergies: string[]) {
  if (activeMeds.length === 0 && allergies.length === 0) return "";
  return compactLines([
    activeMeds.length ? `Active medicines to consider together: ${joinList(activeMeds)}` : "",
    allergies.length ? `Known allergies to consider: ${joinList(allergies)}` : "",
    "For possible interactions, side effects, dose changes, or contraindications, advise pharmacist or GP review and route to the meds specialist when medication management is the main topic.",
  ], 1200);
}

function scheduledEventMetadata(event: typeof scheduledEvents.$inferSelect) {
  return asRecord(event.metadata);
}

function isMedicalScheduledEvent(event: typeof scheduledEvents.$inferSelect) {
  const haystack = [
    event.event_type,
    event.title,
    event.description,
    event.source,
    asString(scheduledEventMetadata(event).source_use_case),
  ].join(" ").toLowerCase();
  return /\b(appointment|doctor|gp|medical|health|clinic|pharmacy|medico|cita|salud)\b/.test(haystack);
}

function formatScheduledHealthEvent(event: typeof scheduledEvents.$inferSelect | undefined) {
  if (!event) return "";
  return valueList([
    event.title,
    event.event_type ? `type ${event.event_type}` : null,
    event.status ? `status ${event.status}` : null,
    event.scheduled_for ? `scheduled ${formatDateTime(event.scheduled_for)}` : null,
    event.description,
  ], "");
}

function splitMedicalEvents(events: Array<typeof scheduledEvents.$inferSelect>) {
  const now = Date.now();
  const medicalEvents = events.filter(isMedicalScheduledEvent);
  const past = medicalEvents
    .filter((event) => event.scheduled_for && event.scheduled_for.getTime() <= now)
    .sort((a, b) => b.scheduled_for.getTime() - a.scheduled_for.getTime())[0];
  const upcoming = medicalEvents
    .filter((event) => event.scheduled_for && event.scheduled_for.getTime() > now && event.status !== "cancelled")
    .sort((a, b) => a.scheduled_for.getTime() - b.scheduled_for.getTime())[0];
  return { latestVisit: past, upcomingAppointment: upcoming };
}

function formatScheduledEvent(event: typeof scheduledEvents.$inferSelect) {
  return valueList([
    event.title,
    event.event_type ? `type ${event.event_type}` : null,
    event.status ? `status ${event.status}` : null,
    event.scheduled_for ? `scheduled ${formatDateTime(event.scheduled_for)}` : null,
    event.description,
  ], "");
}

function formatUpcomingEvents(events: Array<typeof scheduledEvents.$inferSelect>, now = new Date()) {
  return events
    .filter((event) => event.scheduled_for && event.scheduled_for.getTime() >= now.getTime() && event.status !== "cancelled")
    .sort((a, b) => a.scheduled_for.getTime() - b.scheduled_for.getTime())
    .slice(0, 5)
    .map(formatScheduledEvent);
}

function formatRecentActivity(logs: Array<typeof activityLogs.$inferSelect>) {
  if (logs.length === 0) return "";
  const latest = logs[0];
  const totalMinutes = logs.reduce((sum, log) => sum + (log.duration_minutes ?? 0), 0);
  const counts = new Map<string, number>();
  logs.forEach((log) => counts.set(log.activity_type, (counts.get(log.activity_type) ?? 0) + 1));
  const common = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name} x${count}`);

  return compactLines([
    latest ? `Latest activity: ${latest.activity_type}, ${latest.duration_minutes} minutes, ${formatDateTime(latest.logged_at)}.` : "",
    `Last 14 days: ${totalMinutes} activity minutes recorded.`,
    common.length ? `Common activities: ${common.join(", ")}.` : "",
  ], 900);
}

function formatSocialActivity(
  visits: Array<typeof socialRoomVisits.$inferSelect>,
  roomsById: Map<string, typeof socialRooms.$inferSelect>,
) {
  if (visits.length === 0) return "";
  const latest = visits[0];
  const latestRoom = roomsById.get(String(latest?.room_id));
  const totalMessages = visits.reduce((sum, visit) => sum + (visit.messages_sent ?? 0), 0);
  const completed = visits.filter((visit) => visit.completed).length;
  const roomNames = visits
    .map((visit) => roomsById.get(String(visit.room_id))?.name_en)
    .filter((value): value is string => Boolean(value));

  return compactLines([
    latest ? `Last social room: ${latestRoom?.name_en ?? "social room"} (${latestRoom?.slug ?? "unknown"}), ${formatDateTime(latest.last_active_at)}.` : "",
    `Recent social room visits: ${visits.length}; completed sessions: ${completed}; messages sent: ${totalMessages}.`,
    roomNames.length ? `Recent rooms: ${joinList([...new Set(roomNames)])}` : "",
  ], 1000);
}

function matchingSocialRoomSuggestions(interests: string[], preferredTimes: string[]) {
  if (interests.length === 0) return "";
  const normalizedInterests = interests.map((interest) => interest.toLowerCase());
  const normalizedTimes = preferredTimes.map((time) => time.toLowerCase());
  const matches = socialRoomSeeds
    .map((room) => {
      const tagHit = room.topicTags.some((tag) =>
        normalizedInterests.some((interest) => interest.includes(tag) || tag.includes(interest)),
      );
      const timeHit = normalizedTimes.length === 0 || room.timeSlots.some((slot) => normalizedTimes.includes(slot));
      return { room, score: (tagHit ? 2 : 0) + (timeHit ? 1 : 0) };
    })
    .filter((item) => item.score > 1)
    .sort((a, b) => b.score - a.score || a.room.sortOrder - b.room.sortOrder)
    .slice(0, 3)
    .map((item) => `${item.room.names.en} (${item.room.slug}) for ${item.room.topicTags.slice(0, 3).join(", ")}`);

  return joinList(matches);
}

function buildLocalInterestOpportunities(input: {
  city: string;
  region: string;
  interests: string[];
  hobbies: string[];
  mobilityContext: string;
}) {
  const interests = [...new Set([...input.interests, ...input.hobbies])].filter(Boolean);
  if (interests.length === 0) return "";
  const location = valueList([input.city, input.region], "the user's area");
  const selected = interests.slice(0, 4);
  return compactLines([
    `Saved interests to convert into useful local plans: ${joinList(selected)}.`,
    `Location for live checks: ${location}.`,
    input.mobilityContext ? `Fit plans to mobility/living context: ${input.mobilityContext}.` : "",
    "Do not invent specific event names, times, prices, or venues. Offer to ask Concierge to check real nearby options when the user is interested.",
  ], 1200);
}

function profileLocation(profile: typeof profiles.$inferSelect | null) {
  if (!profile) return "";
  return valueList([
    profile.address_line_1,
    profile.city,
    profile.region,
    profile.postcode,
    profile.country_code,
  ]);
}

function formatProviders(providersSection: JsonRecord) {
  const providers = Array.isArray(providersSection.providers)
    ? providersSection.providers as JsonRecord[]
    : [];
  return providers.slice(0, 8).map((provider) =>
    valueList([
      asString(provider.name),
      asString(provider.role),
      asString(provider.phone),
      asString(provider.address),
      asString(provider.notes),
    ])
  ).filter(Boolean);
}

function formatHobbyDetails(hobbiesSection: JsonRecord) {
  const hobbies = asStringArray(hobbiesSection.hobbies);
  const followUps = asRecord(hobbiesSection.followUps);
  const personality = asRecord(hobbiesSection.personality);
  const detailLines = [
    hobbies.length ? `Hobbies: ${joinList(hobbies)}` : "",
    ...Object.entries(followUps)
      .map(([key, value]) => `${key}: ${asString(value)}`)
      .filter((line) => !line.endsWith(": ")),
    ...Object.entries(personality)
      .map(([key, value]) => `${key}: ${asString(value)}`)
      .filter((line) => !line.endsWith(": ")),
  ];
  return { hobbies, detail: compactLines(detailLines, 1200) };
}

function criticalSafetyContext(input: {
  profile: typeof profiles.$inferSelect | null;
  conditions: string[];
  allergies: string[];
  emergencyContact: string;
  careTeam: string[];
}) {
  return compactLines([
    input.emergencyContact ? `Emergency contact: ${input.emergencyContact}` : "",
    profileLocation(input.profile) ? `Address/location: ${profileLocation(input.profile)}` : "",
    input.careTeam.length ? `Care team: ${joinList(input.careTeam)}` : "",
    input.conditions.length ? `Known conditions: ${joinList(input.conditions)}` : "",
    input.allergies.length ? `Known allergies: ${joinList(input.allergies)}` : "",
  ]);
}

function domainAllows(domain: VoiceContextDomain, category: "medical" | "social" | "logistics" | "safety") {
  const allowed: Record<typeof category, VoiceContextDomain[]> = {
    medical: ["health", "doctor", "meds", "safety"],
    social: ["companion", "social", "brain_coach", "concierge", "health", "doctor"],
    logistics: ["concierge", "safety", "health", "doctor", "meds"],
    safety: ["safety", "health", "doctor", "meds", "concierge"],
  };
  return allowed[category].includes(domain);
}

export async function buildVoiceContext(
  userId: string,
  domain: VoiceContextDomain,
  memoryQuery = "",
  options: BuildVoiceContextOptions = {},
): Promise<VoiceDynamicVariables> {
  const [
    profileRows,
    medicationRows,
    careTeamRows,
    channelPreferenceRows,
    companionRows,
    socialInterestRows,
    latestReports,
    latestVitals,
    medicationAdherenceRows,
    scheduledEventRows,
    userRows,
    latestVoiceExchangeRows,
    recentActivityRows,
    recentSocialVisitRows,
    voiceExchangeCountRows,
  ] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.id, userId)).limit(1),
    db.select().from(userMedications).where(eq(userMedications.user_id, userId)).limit(20),
    db.select().from(teamInvitations).where(eq(teamInvitations.senior_id, userId)).orderBy(desc(teamInvitations.created_at)).limit(10),
    db.select().from(userChannelPreferences).where(eq(userChannelPreferences.user_id, userId)).limit(1),
    db.select().from(companionProfiles).where(eq(companionProfiles.user_id, userId)).limit(1),
    db.select().from(socialUserInterests).where(eq(socialUserInterests.user_id, userId)).limit(1),
    db.select().from(triageReports).where(eq(triageReports.user_id, userId)).orderBy(desc(triageReports.created_at)).limit(5),
    db.select().from(vitalsReadings).where(eq(vitalsReadings.user_id, userId)).orderBy(desc(vitalsReadings.recorded_at)).limit(12),
    db
      .select()
      .from(medicationAdherence)
      .where(and(eq(medicationAdherence.user_id, userId), gte(medicationAdherence.created_at, daysAgo(29))))
      .orderBy(desc(medicationAdherence.created_at))
      .limit(80),
    db.select().from(scheduledEvents).where(eq(scheduledEvents.user_id, userId)).orderBy(desc(scheduledEvents.scheduled_for)).limit(20),
    db.select({ last_seen_at: users.last_seen_at }).from(users).where(eq(users.id, userId)).limit(1),
    db.select().from(sessionExchanges).where(eq(sessionExchanges.user_id, userId)).orderBy(desc(sessionExchanges.created_at)).limit(1),
    db
      .select()
      .from(activityLogs)
      .where(and(eq(activityLogs.user_id, userId), gte(activityLogs.logged_at, daysAgo(13))))
      .orderBy(desc(activityLogs.logged_at))
      .limit(20),
    db.select().from(socialRoomVisits).where(eq(socialRoomVisits.user_id, userId)).orderBy(desc(socialRoomVisits.last_active_at)).limit(8),
    options.priorVoiceExchangeCount === undefined
      ? db.select({ value: count() }).from(sessionExchanges).where(eq(sessionExchanges.user_id, userId))
      : Promise.resolve([{ value: options.priorVoiceExchangeCount }]),
  ]);

  const profile = profileRows[0] ?? null;
  const socialRoomIds = [...new Set(recentSocialVisitRows.map((visit) => String(visit.room_id)).filter(Boolean))];
  const socialRoomRows = socialRoomIds.length
    ? await db.select().from(socialRooms).where(inArray(socialRooms.id, socialRoomIds)).catch(() => [])
    : [];
  const socialRoomsById = new Map(socialRoomRows.map((room) => [String(room.id), room]));
  const consent = profile?.data_sharing_consent ?? {};
  const conditionsSection = section(consent, "conditions");
  const dietSection = section(consent, "diet");
  const devicesSection = section(consent, "devices");
  const hobbiesSection = section(consent, "hobbies");
  const providersSection = section(consent, "providers");
  const emergencySection = section(consent, "emergency");
  const cognitiveSection = section(consent, "cognitive");

  const conditions = asStringArray(conditionsSection.health_conditions);
  const mobilityLevel = asString(conditionsSection.mobility_level);
  const livingSituation = asString(conditionsSection.living_situation);
  const allergies = profile?.known_allergies?.filter(Boolean) ?? [];
  const activeMeds = medicationRows.filter((med) => med.active).map(formatMedication);
  const careTeam = careTeamRows.map(formatCareMember).filter(Boolean);
  const providers = formatProviders(providersSection);
  const devices = asStringArray(devicesSection.devices);
  const dietaryPreferences = asStringArray(dietSection.dietary_preferences);
  const dietaryNotes = asString(dietSection.dietary_notes);
  const { hobbies, detail: hobbyDetails } = formatHobbyDetails(hobbiesSection);
  const companion = companionRows[0];
  const socialInterests = socialInterestRows[0];
  const channelPrefs = channelPreferenceRows[0];
  const mem0UserId = profile?.mem0_user_id?.trim() || userId;
  const memories = memoryQuery
    ? await searchMemories(memoryQuery, mem0UserId).catch(() => [])
    : [];
  const memoryBlock = formatMemoryBlock(memories);
  const recentHealthEvents = [
    ...latestReports.map(formatTriageReport),
    ...latestVitals.map(formatVital),
  ].filter(Boolean);
  const latestSymptomReport = latestReports[0] ? formatTriageReportDetailed(latestReports[0]) : "";
  const recentSymptomReports = latestReports.map(formatTriageReportDetailed).filter(Boolean);
  const latestVitalsScanSummary = latestVitalsScan(latestVitals);
  const vitalsTrend = vitalsTrendSummary(latestVitals);
  const medicationAdherenceSummary = buildMedicationAdherenceSummary(
    medicationRows.filter((med) => med.active),
    medicationAdherenceRows,
  );
  const medicationInteractionContext = buildMedicationInteractionContext(activeMeds, allergies);
  const { latestVisit, upcomingAppointment } = splitMedicalEvents(scheduledEventRows);
  const latestMedicalVisit = formatScheduledHealthEvent(latestVisit);
  const upcomingMedicalAppointment = formatScheduledHealthEvent(upcomingAppointment);
  const now = new Date();
  const userRow = userRows[0] ?? null;
  const latestVoiceExchange = latestVoiceExchangeRows[0] ?? null;
  const allHobbies = [...new Set([
    ...hobbies,
    ...(companion?.hobbies ?? []),
  ])];
  const allInterests = [...new Set([
    ...(companion?.interests ?? []),
    ...(socialInterests?.interest_tags ?? []),
  ])];
  const allPreferredActivities = [...new Set(companion?.preferred_activities ?? [])];
  const appLastSeenAt = userRow?.last_seen_at ?? null;
  const lastVoiceSessionAt = latestVoiceExchange?.created_at ?? null;
  const dateOfBirth = profile?.date_of_birth ?? "";
  const ageYears = ageFromDate(dateOfBirth, now);
  const birthday = birthdayContext(dateOfBirth, now);
  const upcomingEvents = formatUpcomingEvents(scheduledEventRows, now);
  const recentActivitySummary = formatRecentActivity(recentActivityRows);
  const socialActivitySummary = formatSocialActivity(recentSocialVisitRows, socialRoomsById);
  const matchingSocialRooms = matchingSocialRoomSuggestions(
    [...allInterests, ...allHobbies],
    socialInterests?.preferred_times ?? [],
  );
  const mobilityContext = valueList([mobilityLevel, livingSituation]);
  const localInterestOpportunities = buildLocalInterestOpportunities({
    city: profile?.city ?? "",
    region: profile?.region ?? "",
    interests: allInterests,
    hobbies: allHobbies,
    mobilityContext,
  });
  const relationshipContinuityContext = compactLines([
    appLastSeenAt ? `Last app visit: ${formatDateTime(appLastSeenAt)} (${formatRelativeTime(appLastSeenAt, now)}).` : "",
    lastVoiceSessionAt ? `Last VYVA voice session: ${formatDateTime(lastVoiceSessionAt)} (${formatRelativeTime(lastVoiceSessionAt, now)}).` : "",
    latestVoiceExchange?.agent_used
      ? `Last voice agent/topic: ${latestVoiceExchange.agent_used}${latestVoiceExchange.intent_classified ? ` / ${latestVoiceExchange.intent_classified}` : ""}.`
      : "",
    latestVoiceExchange?.message ? `Last user voice message: ${latestVoiceExchange.message.slice(0, 220)}.` : "",
  ], 1400);
  const preferenceContext = compactLines([
    allHobbies.length ? `Hobbies: ${joinList(allHobbies)}` : "",
    allInterests.length ? `Interests: ${joinList(allInterests)}` : "",
    companion?.values?.length ? `Values: ${joinList(companion.values)}` : "",
    allPreferredActivities.length ? `Preferred activities: ${joinList(allPreferredActivities)}` : "",
    socialInterests?.preferred_times?.length ? `Preferred social times: ${joinList(socialInterests.preferred_times)}` : "",
  ], 1600);
  const appInsightContext = compactLines([
    relationshipContinuityContext,
    preferenceContext,
    upcomingEvents.length ? `Upcoming events/reminders: ${joinList(upcomingEvents)}` : "",
    recentActivitySummary ? `Activity history: ${recentActivitySummary}` : "",
    socialActivitySummary ? `Social activity: ${socialActivitySummary}` : "",
    matchingSocialRooms ? `Suggested social rooms: ${matchingSocialRooms}` : "",
    localInterestOpportunities ? `Nearby interest opportunities: ${localInterestOpportunities}` : "",
    birthday ? `Birthday context: ${birthday}` : "",
  ], 4200);
  const personalisationOpportunities = compactLines([
    latestVitalsScanSummary ? "If health is relevant, latest vitals context is available." : "",
    medicationAdherenceSummary ? "If medication is relevant, medication adherence context is available." : "",
    upcomingEvents.length ? "Offer help preparing for the next scheduled event if useful." : "",
    matchingSocialRooms ? "Offer one social room or companion activity that matches the user's interests." : "",
    localInterestOpportunities ? "Offer Concierge to verify a nearby event or place before naming specifics." : "",
    recentActivitySummary ? "Use recent activity to suggest a balanced movement, rest, or routine step." : "",
    birthday ? "Use birthday context warmly only when it feels natural." : "",
  ], 1400);
  const orchestratorContext = compactLines([
    relationshipContinuityContext,
    appInsightContext,
    personalisationOpportunities,
  ], 6000);
  const emergencyContact = valueList([
    asString(emergencySection.emergency_name),
    asString(emergencySection.emergency_phone),
    asString(emergencySection.emergency_role),
  ]);
  const priorVoiceExchangeCount = Number(voiceExchangeCountRows[0]?.value ?? 0);
  const conversationPlan = selectVoiceConversationPlan({
    domain,
    appEntrypoint: options.appEntrypoint ?? memoryQuery,
    priorVoiceExchangeCount,
  });

  const variables: VoiceDynamicVariables = {
    user_id: userId,
    agent_domain: domain,
    agent_operating_rules: buildAgentOperatingRules(domain),
    conversation_plan: formatConversationPlanPrompt(conversationPlan) || buildConversationPlan(domain),
    ...conversationPlanToVariables(conversationPlan),
    is_first_voice_session: priorVoiceExchangeCount === 0,
    prior_voice_exchange_count: priorVoiceExchangeCount,
    app_entrypoint: options.appEntrypoint ?? "",
    first_name: firstName(profile),
    preferred_name: profile?.preferred_name ?? "",
    full_name: profile?.full_name ?? "",
    date_of_birth: dateOfBirth,
    age_years: ageYears,
    birthday_context: birthday,
    preferred_language: profile?.language ?? "en",
    timezone: profile?.timezone ?? "Europe/Madrid",
    city: profile?.city ?? "",
    country_code: profile?.country_code ?? "",
    onboarding_complete: Boolean(profile?.onboarding_complete),
    profile_summary: compactLines([
      `Name: ${profile?.preferred_name || profile?.full_name || "Not recorded"}`,
      `Language: ${profile?.language ?? "en"}`,
      ageYears ? `Age: ${ageYears}` : "",
      profile?.timezone ? `Timezone: ${profile.timezone}` : "",
      profile?.city || profile?.country_code ? `Location: ${valueList([profile.city, profile.country_code])}` : "",
    ], 900),
    memory_block: memoryBlock || "(no memory retrieved)",
    last_app_visit_at: formatDateTime(appLastSeenAt),
    time_since_last_app_visit: formatRelativeTime(appLastSeenAt, now),
    last_voice_session_at: formatDateTime(lastVoiceSessionAt),
    time_since_last_voice_session: formatRelativeTime(lastVoiceSessionAt, now),
    last_visit_activity: relationshipContinuityContext,
    preference_context: preferenceContext,
    app_insight_context: appInsightContext,
    orchestrator_context: orchestratorContext,
    personalisation_opportunities: personalisationOpportunities,
    upcoming_events: joinList(upcomingEvents),
    recent_activity_summary: recentActivitySummary,
    social_activity_summary: socialActivitySummary,
    nearby_events_of_interest: localInterestOpportunities,
    matching_social_rooms: matchingSocialRooms,
  };

  if (domainAllows(domain, "social")) {
    variables.hobbies = joinList(allHobbies);
    variables.interests = joinList(allInterests);
    variables.values = joinList(companion?.values ?? []);
    variables.preferred_activities = joinList(allPreferredActivities);
    variables.social_context = compactLines([
      hobbyDetails,
      allInterests.length ? `Interests: ${joinList(allInterests)}` : "",
      companion?.values?.length ? `Values: ${joinList(companion.values)}` : "",
      allPreferredActivities.length ? `Preferred activities: ${joinList(allPreferredActivities)}` : "",
      socialInterests?.interest_tags?.length ? `Social room interests: ${joinList(socialInterests.interest_tags)}` : "",
      socialInterests?.preferred_times?.length ? `Preferred social times: ${joinList(socialInterests.preferred_times)}` : "",
      socialInterests?.activity_level ? `Activity level: ${socialInterests.activity_level}` : "",
      socialActivitySummary ? `Recent social activity: ${socialActivitySummary}` : "",
      matchingSocialRooms ? `Good-fit social rooms: ${matchingSocialRooms}` : "",
      localInterestOpportunities ? `Local interest opportunities: ${localInterestOpportunities}` : "",
    ], 1800);
  }

  if (domainAllows(domain, "logistics")) {
    variables.location_context = profileLocation(profile);
    variables.communication_preferences = compactLines([
      channelPrefs?.preferred_conversation_channel ? `Conversation: ${channelPrefs.preferred_conversation_channel}` : "",
      channelPrefs?.preferred_reminder_channel ? `Reminders: ${channelPrefs.preferred_reminder_channel}` : "",
      channelPrefs?.voice_available_from || channelPrefs?.voice_available_until
        ? `Voice availability: ${channelPrefs?.voice_available_from ?? ""}-${channelPrefs?.voice_available_until ?? ""}`
        : "",
    ], 600);
    variables.providers = joinList(providers);
    variables.gp_details = valueList([profile?.gp_name, profile?.gp_phone, profile?.gp_address]);
    variables.diet_context = valueList([dietaryNotes, dietaryPreferences.length ? dietaryPreferences.join(", ") : ""]);
    variables.mobility_context = mobilityContext;
  }

  if (domainAllows(domain, "medical")) {
    const healthProfileSummary = compactLines([
      conditions.length ? `Conditions: ${joinList(conditions)}` : "",
      allergies.length ? `Allergies: ${joinList(allergies)}` : "",
      activeMeds.length ? `Active medications: ${joinList(activeMeds)}` : "",
      valueList([profile?.gp_name, profile?.gp_phone, profile?.gp_address]) ? `GP: ${valueList([profile?.gp_name, profile?.gp_phone, profile?.gp_address])}` : "",
      providers.length ? `Providers: ${joinList(providers)}` : "",
      careTeam.length ? `Care team: ${joinList(careTeam)}` : "",
      devices.length ? `Connected devices: ${joinList(devices)}` : "",
      profile?.updated_at ? `Profile updated: ${formatDateTime(profile.updated_at)}` : "",
    ], 2200);
    const healthSessionContext = compactLines([
      healthProfileSummary,
      latestVitalsScanSummary ? `Latest vitals scan: ${latestVitalsScanSummary}` : "",
      vitalsTrend ? `Vitals trend: ${vitalsTrend}` : "",
      latestSymptomReport ? `Latest symptom report: ${latestSymptomReport}` : "",
      medicationAdherenceSummary ? `Medication adherence: ${medicationAdherenceSummary}` : "",
      latestMedicalVisit ? `Latest medical visit: ${latestMedicalVisit}` : "",
      upcomingMedicalAppointment ? `Upcoming medical appointment: ${upcomingMedicalAppointment}` : "",
      medicationInteractionContext ? `Medication interaction context: ${medicationInteractionContext}` : "",
    ], 5000);

    variables.health_profile_summary = healthProfileSummary || "No structured health profile has been recorded yet.";
    variables.health_conditions = joinList(conditions);
    variables.allergies = joinList(allergies);
    variables.medications = joinList(activeMeds);
    variables.devices = joinList(devices);
    variables.recent_health_events = joinList(recentHealthEvents);
    variables.latest_vitals_scan = latestVitalsScanSummary;
    variables.latest_vitals_scan_at = latestVitals[0]?.recorded_at ? formatDateTime(latestVitals[0].recorded_at) : "";
    variables.vitals_trend = vitalsTrend;
    variables.latest_symptom_report = latestSymptomReport;
    variables.latest_symptom_report_at = latestReports[0]?.created_at ? formatDateTime(latestReports[0].created_at) : "";
    variables.recent_symptom_reports = joinList(recentSymptomReports);
    variables.medication_adherence_summary = medicationAdherenceSummary;
    variables.medication_interaction_context = medicationInteractionContext;
    variables.latest_medical_visit = latestMedicalVisit;
    variables.upcoming_medical_appointment = upcomingMedicalAppointment;
    variables.medical_profile_last_updated = profile?.updated_at ? formatDateTime(profile.updated_at) : "";
    variables.health_session_context = healthSessionContext;
    variables.health_context = compactLines([
      healthSessionContext,
      recentHealthEvents.length ? `Recent health events: ${joinList(recentHealthEvents)}` : "",
      dietaryNotes || dietaryPreferences.length ? `Diet: ${valueList([dietaryNotes, dietaryPreferences.join(", ")])}` : "",
    ], 6000) || "No health profile has been recorded for this user yet.";
  }

  if (domain === "brain_coach") {
    variables.cognitive_notes = asString(cognitiveSection.cognitive_notes);
  }

  if (domainAllows(domain, "safety")) {
    variables.emergency_contact = emergencyContact;
    variables.care_team = joinList(careTeam);
    variables.safety_context = criticalSafetyContext({
      profile,
      conditions,
      allergies,
      emergencyContact,
      careTeam,
    });
  }

  return variables;
}
