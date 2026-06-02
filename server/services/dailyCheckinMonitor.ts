import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { db, pool } from "../db.js";
import {
  caregiverAlerts,
  scheduledInteractions,
  teamInvitations,
} from "../../shared/schema.js";
import { languageText, normalizeAppLanguage } from "../../shared/language.js";
import {
  DAILY_CHECKIN_ALERT_TYPE,
  DAILY_CHECKIN_GRACE_MINUTES,
  evaluateDailyCheckinSchedule,
  nextCheckinRunAt,
  normalizeCheckinTimes,
  type DailyCheckinScheduleStatus,
} from "../lib/dailyCheckinSchedule.js";

type ScheduleRow = typeof scheduledInteractions.$inferSelect;

type ProfileAlertContext = {
  caregiver_name: string | null;
  caregiver_contact: string | null;
  data_sharing_consent: unknown;
  language: string | null;
  language_preference: string | null;
  timezone: string | null;
};

type DailyCheckinAlert = {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  sent_to: string[] | null;
  resolved_at: Date | string | null;
  created_at: Date | string | null;
};

export type DailyCheckinTodayStatus = {
  status: DailyCheckinScheduleStatus["state"];
  date_key: string;
  timezone: string;
  schedule: {
    id: string | null;
    active: boolean;
    times_of_day: string[];
    next_run_at: string | null;
    last_completed_at: string | null;
    grace_minutes: number;
  };
  latest_checkin: {
    id: string;
    completed_at: string;
    feeling_label: string | null;
    overall_state: string | null;
    highlight: string | null;
  } | null;
  no_response: {
    overdue: boolean;
    minutes_overdue: number | null;
    alert_created: boolean;
    can_alert_caregiver: boolean;
    reason: string | null;
  };
  caregiver_alert: DailyCheckinAlert | null;
  message: string;
  action_label: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function nestedFlag(consent: Record<string, unknown>, section: string, key: string): unknown {
  const value = consent[section];
  return value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
}

function caregiverConsentAllows(consentValue: unknown): boolean {
  const consent = asRecord(consentValue);
  const candidates = [
    consent.caregiver_safety_alerts,
    consent.caregiver_health_alerts,
    consent.caregiver_full_access,
    nestedFlag(consent, "caregiver", "safety_alerts"),
    nestedFlag(consent, "caregiver", "health_alerts"),
    nestedFlag(consent, "caregiver", "full_access"),
    nestedFlag(consent, "careteam", "caregiver_safety_alerts"),
    nestedFlag(consent, "careteam", "caregiver_health_alerts"),
    nestedFlag(consent, "communication_preferences", "caregiver_alerts"),
  ];
  if (candidates.some((value) => value === true)) return true;
  if (candidates.some((value) => value === false)) return false;
  return true;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return values
    .map((value) => String(value ?? "").trim())
    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
}

function parseEscalationContacts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(value.map((item) => {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    return typeof record.contact === "string" && record.contact.trim()
      ? record.contact
      : typeof record.name === "string"
        ? record.name
        : null;
  }));
}

function iso(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function profileLanguage(profile: ProfileAlertContext | null | undefined) {
  return normalizeAppLanguage(profile?.language_preference ?? profile?.language, "es");
}

function buildNoResponseMessage(profile: ProfileAlertContext | null, status: DailyCheckinScheduleStatus) {
  const language = profileLanguage(profile);
  const minutes = status.minutes_overdue ?? 0;
  const elapsed = minutes > 0 ? languageText(language, {
    es: `Han pasado aproximadamente ${minutes} minutos desde el margen de seguridad.`,
    en: `It is about ${minutes} minutes past the safety window.`,
    fr: `Il y a environ ${minutes} minutes depuis la marge de securite.`,
    de: `Das Sicherheitsfenster ist seit etwa ${minutes} Minuten ueberschritten.`,
    it: `Sono passati circa ${minutes} minuti dalla finestra di sicurezza.`,
    pt: `Passaram cerca de ${minutes} minutos desde a margem de seguranca.`,
  }) : null;

  return [
    languageText(language, {
      es: "VYVA no ha recibido el check-in diario esperado.",
      en: "VYVA has not received the expected daily check-in.",
      fr: "VYVA n'a pas recu le controle quotidien attendu.",
      de: "VYVA hat den erwarteten taeglichen Check-in nicht erhalten.",
      it: "VYVA non ha ricevuto il check-in quotidiano previsto.",
      pt: "A VYVA nao recebeu o check-in diario esperado.",
    }),
    elapsed,
    languageText(language, {
      es: "Siguiente paso recomendado: llamar o enviar un mensaje para confirmar que esta bien.",
      en: "Recommended next step: call or message to confirm everything is okay.",
      fr: "Prochaine etape recommandee : appeler ou envoyer un message pour confirmer que tout va bien.",
      de: "Empfohlener naechster Schritt: anrufen oder eine Nachricht senden, um zu bestaetigen, dass alles in Ordnung ist.",
      it: "Prossimo passo consigliato: chiamare o inviare un messaggio per confermare che vada tutto bene.",
      pt: "Proximo passo recomendado: ligar ou enviar mensagem para confirmar que esta tudo bem.",
    }),
  ].filter(Boolean).join("\n");
}

async function profileContext(userId: string): Promise<ProfileAlertContext | null> {
  const result = await pool.query(
    `select caregiver_name, caregiver_contact, data_sharing_consent, language, language_preference, timezone
     from profiles
     where id::text = $1
     limit 1`,
    [userId],
  );
  return result.rows[0] as ProfileAlertContext | undefined ?? null;
}

async function acceptedCareTeamRecipients(userId: string): Promise<string[]> {
  const rows = await db
    .select({
      name: teamInvitations.invitee_name,
      phone: teamInvitations.invitee_phone,
      email: teamInvitations.invitee_email,
      whatsapp: teamInvitations.invitee_whatsapp,
    })
    .from(teamInvitations)
    .where(and(
      eq(teamInvitations.senior_id, userId),
      eq(teamInvitations.status, "accepted"),
      eq(teamInvitations.can_receive_safety_alerts, true),
    ))
    .limit(5);

  return uniqueStrings(rows.map((row) => row.whatsapp || row.phone || row.email || row.name));
}

async function activeCheckinSchedule(userId: string, createDefaultSchedule: boolean, now: Date): Promise<ScheduleRow | null> {
  const rows = await db
    .select()
    .from(scheduledInteractions)
    .where(and(
      eq(scheduledInteractions.user_id, userId),
      eq(scheduledInteractions.interaction_type, "CHECK_IN"),
    ))
    .orderBy(desc(scheduledInteractions.updated_at))
    .limit(5);

  const active = rows.find((row) => row.status === "ACTIVE" && !row.is_paused);
  if (active || rows.length > 0 || !createDefaultSchedule) return active ?? null;

  const profile = await profileContext(userId);
  const times = ["10:00"];
  const timezone = profile?.timezone || "Europe/Madrid";
  const nextRun = nextCheckinRunAt({ now, timezone, scheduledTimes: times, status: "ACTIVE" });
  const recipients = uniqueStrings([profile?.caregiver_contact, profile?.caregiver_name]);

  const inserted = await db
    .insert(scheduledInteractions)
    .values({
      user_id: userId,
      interaction_type: "CHECK_IN",
      friendly_label: "Daily are-you-okay check-in",
      user_description: "A short daily check to confirm how you feel and whether you need support.",
      status: "ACTIVE",
      frequency_type: "DAILY",
      frequency_value: { no_response_grace_minutes: DAILY_CHECKIN_GRACE_MINUTES },
      days_of_week: [],
      times_of_day: times,
      timezone,
      preferred_language: profileLanguage(profile),
      quiet_hours_start: "21:00",
      quiet_hours_end: "08:00",
      escalation_contacts: recipients.map((contact) => ({ contact, relationship: "caregiver" })),
      next_run_at: nextRun,
      created_by: userId,
      updated_by: userId,
    })
    .returning();

  return inserted[0] ?? null;
}

async function latestCheckinForDay(userId: string, dayStart: Date, dayEnd: Date) {
  const result = await pool.query(
    `select id, completed_at, feeling_label, overall_state, highlight
     from checkin_sessions
     where user_id = $1
       and completed = true
       and completed_at >= $2
       and completed_at < $3
     order by completed_at desc
     limit 1`,
    [userId, dayStart, dayEnd],
  );
  return result.rows[0] as {
    id: string;
    completed_at: Date | string;
    feeling_label: string | null;
    overall_state: string | null;
    highlight: string | null;
  } | undefined;
}

async function recentNoResponseAlert(userId: string, dayStart: Date): Promise<DailyCheckinAlert | null> {
  const rows = await db
    .select({
      id: caregiverAlerts.id,
      alert_type: caregiverAlerts.alert_type,
      severity: caregiverAlerts.severity,
      message: caregiverAlerts.message,
      sent_to: caregiverAlerts.sent_to,
      resolved_at: caregiverAlerts.resolved_at,
      created_at: caregiverAlerts.created_at,
    })
    .from(caregiverAlerts)
    .where(and(
      eq(caregiverAlerts.user_id, userId),
      eq(caregiverAlerts.alert_type, DAILY_CHECKIN_ALERT_TYPE),
      gte(caregiverAlerts.created_at, dayStart),
    ))
    .orderBy(desc(caregiverAlerts.created_at))
    .limit(1);
  return rows[0] ?? null;
}

async function recordNoResponseLog(userId: string, schedule: ScheduleRow, status: DailyCheckinScheduleStatus, alertId: string | null) {
  const existing = await pool.query(
    `select id
     from interaction_logs
     where user_id = $1
       and scheduled_interaction_id = $2
       and interaction_type = 'CHECK_IN'
       and outcome in ('NO_RESPONSE', 'ESCALATED')
       and created_at >= $3
     limit 1`,
    [userId, schedule.id, status.day_start],
  );
  if (existing.rows[0]) return;

  await pool.query(
    `insert into interaction_logs (
       user_id, scheduled_interaction_id, interaction_type, scheduled_for,
       outcome, summary, risk_flags
     ) values ($1, $2, 'CHECK_IN', $3, $4, $5, $6::jsonb)`,
    [
      userId,
      schedule.id,
      status.scheduled_for,
      alertId ? "ESCALATED" : "NO_RESPONSE",
      "Daily check-in did not receive a response inside the safety window.",
      JSON.stringify([
        "daily_checkin_no_response",
        alertId ? "caregiver_alert_recorded" : "caregiver_alert_not_available",
      ]),
    ],
  );
}

async function recordCompletedLog(userId: string, schedule: ScheduleRow, completedAt: Date) {
  const day = evaluateDailyCheckinSchedule({
    now: completedAt,
    timezone: schedule.timezone,
    scheduledTimes: normalizeCheckinTimes(schedule.times_of_day),
    latestCompletedAt: completedAt,
  });
  const existing = await pool.query(
    `select id
     from interaction_logs
     where user_id = $1
       and scheduled_interaction_id = $2
       and interaction_type = 'CHECK_IN'
       and outcome = 'COMPLETED'
       and created_at >= $3
     limit 1`,
    [userId, schedule.id, day.day_start],
  );
  if (existing.rows[0]) return;

  await pool.query(
    `insert into interaction_logs (
       user_id, scheduled_interaction_id, interaction_type, completed_at,
       outcome, summary, sentiment, risk_flags
     ) values ($1, $2, 'CHECK_IN', $3, 'COMPLETED', $4, $5, $6::jsonb)`,
    [
      userId,
      schedule.id,
      completedAt,
      "Daily check-in completed.",
      "responded",
      JSON.stringify([]),
    ],
  );
}

async function createNoResponseAlert(userId: string, schedule: ScheduleRow, status: DailyCheckinScheduleStatus): Promise<{
  alert: DailyCheckinAlert | null;
  canAlert: boolean;
  reason: string | null;
}> {
  const profile = await profileContext(userId);
  if (!caregiverConsentAllows(profile?.data_sharing_consent)) {
    return { alert: null, canAlert: false, reason: "caregiver consent is not enabled" };
  }

  const recipients = uniqueStrings([
    ...parseEscalationContacts(schedule.escalation_contacts),
    profile?.caregiver_contact,
    profile?.caregiver_name,
    ...(await acceptedCareTeamRecipients(userId)),
  ]);
  if (recipients.length === 0) {
    return { alert: null, canAlert: false, reason: "no caregiver contact is available" };
  }

  const existing = await recentNoResponseAlert(userId, status.day_start);
  if (existing) return { alert: existing, canAlert: true, reason: null };

  const [alert] = await db.insert(caregiverAlerts).values({
    user_id: userId,
    alert_type: DAILY_CHECKIN_ALERT_TYPE,
    severity: "warning",
    message: buildNoResponseMessage(profile, status),
    sent_to: recipients,
  }).returning();

  return { alert: alert ?? null, canAlert: true, reason: null };
}

function messageFor(status: DailyCheckinScheduleStatus["state"], alertReason: string | null, locale?: string | null) {
  if (status === "completed") return languageText(locale, {
    es: "Has completado el control de hoy. VYVA tiene una nueva senal de bienestar.",
    en: "You checked in today. VYVA has a fresh wellbeing signal.",
    fr: "Vous avez fait le controle aujourd'hui. VYVA a un nouveau signal de bien-etre.",
    de: "Du hast heute eingecheckt. VYVA hat ein neues Wohlbefinden-Signal.",
    it: "Hai completato il controllo di oggi. VYVA ha un nuovo segnale di benessere.",
    pt: "Fez o check-in hoje. A VYVA tem um novo sinal de bem-estar.",
  });
  if (status === "due_now") return languageText(locale, {
    es: "Tu control diario esta listo. Una respuesta rapida ayuda a saber que estas bien.",
    en: "Your daily check-in is ready. A quick answer lets everyone know you are okay.",
    fr: "Votre controle quotidien est pret. Une reponse rapide rassure tout le monde.",
    de: "Dein taeglicher Check-in ist bereit. Eine kurze Antwort zeigt, dass alles in Ordnung ist.",
    it: "Il tuo check-in quotidiano e pronto. Una risposta rapida fa sapere che stai bene.",
    pt: "O seu check-in diario esta pronto. Uma resposta rapida mostra que esta tudo bem.",
  });
  if (status === "overdue") {
    return alertReason
      ? languageText(locale, {
        es: "El control diario esta pendiente. Anade o confirma un contacto de cuidador para que VYVA pueda avisar si hace falta.",
        en: "The daily check-in is overdue. Add or confirm a caregiver contact so VYVA can escalate when needed.",
        fr: "Le controle quotidien est en retard. Ajoutez ou confirmez un contact aidant pour que VYVA puisse alerter si besoin.",
        de: "Der taegliche Check-in ist ueberfaellig. Fuege einen Betreuungskontakt hinzu oder bestaetige ihn, damit VYVA bei Bedarf eskalieren kann.",
        it: "Il check-in quotidiano e in ritardo. Aggiungi o conferma un contatto caregiver cosi VYVA puo avvisare se necessario.",
        pt: "O check-in diario esta atrasado. Adicione ou confirme um contacto cuidador para a VYVA poder avisar se necessario.",
      })
      : languageText(locale, {
        es: "El control diario esta pendiente, asi que VYVA ha registrado una alerta de seguridad para tu cuidador.",
        en: "The daily check-in is overdue, so VYVA has recorded a caregiver safety alert.",
        fr: "Le controle quotidien est en retard, donc VYVA a enregistre une alerte de securite pour l'aidant.",
        de: "Der taegliche Check-in ist ueberfaellig, daher hat VYVA eine Sicherheitswarnung fuer die Betreuung erfasst.",
        it: "Il check-in quotidiano e in ritardo, quindi VYVA ha registrato un avviso di sicurezza per il caregiver.",
        pt: "O check-in diario esta atrasado, por isso a VYVA registou um alerta de seguranca para o cuidador.",
      });
  }
  if (status === "upcoming") return languageText(locale, {
    es: "Tu control diario esta programado para mas tarde hoy.",
    en: "Your daily check-in is scheduled for later today.",
    fr: "Votre controle quotidien est prevu plus tard aujourd'hui.",
    de: "Dein taeglicher Check-in ist fuer spaeter heute geplant.",
    it: "Il tuo check-in quotidiano e programmato per piu tardi oggi.",
    pt: "O seu check-in diario esta agendado para mais tarde hoje.",
  });
  return languageText(locale, {
    es: "Configura una hora diaria para que VYVA pueda notar si no respondes.",
    en: "Set a daily check-in time so VYVA can notice if you do not respond.",
    fr: "Definissez une heure de controle quotidienne pour que VYVA remarque si vous ne repondez pas.",
    de: "Lege eine taegliche Check-in-Zeit fest, damit VYVA merkt, wenn du nicht antwortest.",
    it: "Imposta un orario di check-in quotidiano cosi VYVA nota se non rispondi.",
    pt: "Defina uma hora diaria de check-in para a VYVA perceber se nao responder.",
  });
}

function actionLabelFor(status: DailyCheckinScheduleStatus["state"], locale?: string | null) {
  if (status === "completed") return languageText(locale, {
    es: "Ver historial",
    en: "View history",
    fr: "Voir l'historique",
    de: "Verlauf ansehen",
    it: "Vedi storico",
    pt: "Ver historico",
  });
  if (status === "upcoming") return languageText(locale, {
    es: "Hacerlo antes",
    en: "Check in early",
    fr: "Faire le controle plus tot",
    de: "Frueher einchecken",
    it: "Fai il check-in prima",
    pt: "Fazer check-in mais cedo",
  });
  if (status === "not_scheduled") return languageText(locale, {
    es: "Configurar control",
    en: "Set up check-in",
    fr: "Configurer le controle",
    de: "Check-in einrichten",
    it: "Configura check-in",
    pt: "Configurar check-in",
  });
  return languageText(locale, {
    es: "Hacer control ahora",
    en: "Check in now",
    fr: "Faire le controle",
    de: "Jetzt einchecken",
    it: "Fai check-in ora",
    pt: "Fazer check-in agora",
  });
}

export async function getDailyCheckinTodayStatus(
  userId: string,
  options: { now?: Date; createDefaultSchedule?: boolean } = {},
): Promise<DailyCheckinTodayStatus> {
  const now = options.now ?? new Date();
  const schedule = await activeCheckinSchedule(userId, options.createDefaultSchedule ?? true, now);
  const profile = await profileContext(userId);
  const locale = profileLanguage(profile);
  const timezone = schedule?.timezone || profile?.timezone || "Europe/Madrid";
  const scheduledTimes = schedule ? normalizeCheckinTimes(schedule.times_of_day) : [];
  const provisional = evaluateDailyCheckinSchedule({
    now,
    timezone,
    scheduledTimes,
    latestCompletedAt: null,
    graceMinutes: DAILY_CHECKIN_GRACE_MINUTES,
  });
  const latest = await latestCheckinForDay(userId, provisional.day_start, provisional.day_end).catch(() => undefined);
  const status = evaluateDailyCheckinSchedule({
    now,
    timezone,
    scheduledTimes,
    latestCompletedAt: latest?.completed_at ?? schedule?.last_completed_at ?? null,
    graceMinutes: DAILY_CHECKIN_GRACE_MINUTES,
  });

  let alert: DailyCheckinAlert | null = null;
  let alertCreated = false;
  let canAlert = false;
  let alertReason: string | null = null;

  if (schedule && status.state === "completed" && latest) {
    await markDailyCheckinCompleted(userId, latest.completed_at instanceof Date ? latest.completed_at : new Date(latest.completed_at), { resolveAlerts: true });
  }

  if (schedule && status.state === "overdue") {
    const created = await createNoResponseAlert(userId, schedule, status);
    alert = created.alert;
    alertCreated = Boolean(created.alert);
    canAlert = created.canAlert;
    alertReason = created.reason;
    await recordNoResponseLog(userId, schedule, status, alert?.id ?? null);
    const nextRun = nextCheckinRunAt({
      now: new Date(now.getTime() + 60_000),
      timezone,
      scheduledTimes,
      status: schedule.status,
      isPaused: schedule.is_paused,
    });
    await db.update(scheduledInteractions).set({
      last_result: alert ? "ESCALATED" : "NO_RESPONSE",
      next_run_at: nextRun,
      updated_at: new Date(),
    }).where(eq(scheduledInteractions.id, schedule.id));
  } else {
    alert = await recentNoResponseAlert(userId, status.day_start);
    canAlert = Boolean(alert);
  }

  return {
    status: status.state,
    date_key: status.date_key,
    timezone: status.timezone,
    schedule: {
      id: schedule?.id ?? null,
      active: Boolean(schedule && schedule.status === "ACTIVE" && !schedule.is_paused),
      times_of_day: scheduledTimes,
      next_run_at: iso(schedule?.next_run_at) ?? status.next_scheduled_for,
      last_completed_at: iso(schedule?.last_completed_at),
      grace_minutes: DAILY_CHECKIN_GRACE_MINUTES,
    },
    latest_checkin: latest ? {
      id: latest.id,
      completed_at: iso(latest.completed_at) ?? String(latest.completed_at),
      feeling_label: latest.feeling_label,
      overall_state: latest.overall_state,
      highlight: latest.highlight,
    } : null,
    no_response: {
      overdue: status.state === "overdue",
      minutes_overdue: status.minutes_overdue,
      alert_created: alertCreated,
      can_alert_caregiver: canAlert,
      reason: alertReason,
    },
    caregiver_alert: alert,
    message: messageFor(status.state, alertReason, locale),
    action_label: actionLabelFor(status.state, locale),
  };
}

export async function markDailyCheckinCompleted(
  userId: string,
  completedAt = new Date(),
  options: { resolveAlerts?: boolean } = {},
) {
  const schedules = await db
    .select()
    .from(scheduledInteractions)
    .where(and(
      eq(scheduledInteractions.user_id, userId),
      eq(scheduledInteractions.interaction_type, "CHECK_IN"),
      eq(scheduledInteractions.status, "ACTIVE"),
    ));

  for (const schedule of schedules) {
    const nextRun = nextCheckinRunAt({
      now: new Date(completedAt.getTime() + 60_000),
      timezone: schedule.timezone,
      scheduledTimes: normalizeCheckinTimes(schedule.times_of_day),
      status: schedule.status,
      isPaused: schedule.is_paused,
    });
    await db.update(scheduledInteractions).set({
      last_completed_at: completedAt,
      last_result: "COMPLETED",
      next_run_at: nextRun,
      updated_at: new Date(),
    }).where(eq(scheduledInteractions.id, schedule.id));
    await recordCompletedLog(userId, schedule, completedAt);
  }

  if (options.resolveAlerts ?? true) {
    await db.update(caregiverAlerts).set({
      resolved_at: completedAt,
      resolved_by: userId,
    }).where(and(
      eq(caregiverAlerts.user_id, userId),
      eq(caregiverAlerts.alert_type, DAILY_CHECKIN_ALERT_TYPE),
      isNull(caregiverAlerts.resolved_at),
    ));
  }
}

export async function runDailyCheckinNoResponseSweep(limit = 100) {
  const rows = await db
    .select({ user_id: scheduledInteractions.user_id })
    .from(scheduledInteractions)
    .where(and(
      eq(scheduledInteractions.interaction_type, "CHECK_IN"),
      eq(scheduledInteractions.status, "ACTIVE"),
      eq(scheduledInteractions.is_paused, false),
    ))
    .limit(limit);

  const seen = new Set<string>();
  let evaluated = 0;
  let overdue = 0;
  let alerts = 0;

  for (const row of rows) {
    if (seen.has(row.user_id)) continue;
    seen.add(row.user_id);
    evaluated += 1;
    const status = await getDailyCheckinTodayStatus(row.user_id, { createDefaultSchedule: false });
    if (status.status === "overdue") overdue += 1;
    if (status.no_response.alert_created) alerts += 1;
  }

  return { evaluated, overdue, alerts };
}

export function startDailyCheckinNoResponseMonitor() {
  if (process.env.NODE_ENV === "test" || process.env.DISABLE_DAILY_CHECKIN_MONITOR === "true") {
    return false;
  }

  const intervalMs = Math.max(5, Number(process.env.DAILY_CHECKIN_MONITOR_INTERVAL_MINUTES ?? 15)) * 60_000;
  const run = () => {
    runDailyCheckinNoResponseSweep().catch((err) => {
      console.error("[daily-checkin-monitor] sweep failed:", err);
    });
  };

  const first = setTimeout(run, 30_000);
  first.unref?.();
  const interval = setInterval(run, intervalMs);
  interval.unref?.();
  return true;
}
