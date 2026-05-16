import { Router } from "express";
import type { Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { requireUser } from "../middleware/auth.js";
import { getActiveProfileContext } from "../lib/profileAccess.js";
import {
  consentAuditLogs,
  interactionLogs,
  profileMemberships,
  profiles,
  scheduledInteractions,
  userMedications,
} from "../../shared/schema.js";

const router = Router();

const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL ?? "karim.assad@mokadigital.net").toLowerCase();
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

const interactionTypeSchema = z.enum(["CHECK_IN", "BRAIN_COACH", "MEDICATION", "SYMPTOM_FOLLOWUP", "CONCIERGE_FOLLOWUP"]);
const statusSchema = z.enum(["ACTIVE", "PAUSED", "CANCELLED"]);
const frequencyTypeSchema = z.enum(["DAILY", "WEEKLY", "CUSTOM", "ONE_OFF"]);

const escalationContactSchema = z.object({
  name: z.string().trim().max(120).optional().default(""),
  contact: z.string().trim().max(120).optional().default(""),
  relationship: z.string().trim().max(80).optional().default(""),
});

const scheduleBodySchema = z.object({
  interaction_type: interactionTypeSchema.optional(),
  friendly_label: z.string().trim().max(160).optional().nullable(),
  user_description: z.string().trim().max(1000).optional().nullable(),
  source_ref_id: z.string().trim().max(120).optional().nullable(),
  status: statusSchema.optional(),
  frequency_type: frequencyTypeSchema.optional(),
  frequency_value: z.record(z.unknown()).optional().default({}),
  days_of_week: z.array(z.string()).optional().default([]),
  times_of_day: z.array(z.string()).optional().default([]),
  timezone: z.string().trim().min(1).max(100).optional().default("Europe/Madrid"),
  preferred_language: z.string().trim().min(2).max(12).optional().default("es"),
  quiet_hours_start: z.string().trim().optional().nullable(),
  quiet_hours_end: z.string().trim().optional().nullable(),
  escalation_contacts: z.array(escalationContactSchema).optional().default([]),
  pause_until: z.string().optional().nullable(),
  pause_reason: z.string().trim().max(300).optional().nullable(),
  consent_required: z.boolean().optional(),
  consent_status: z.string().trim().max(80).optional(),
  admin_edit_allowed: z.boolean().optional(),
});

const pauseBodySchema = z.object({
  pause_until: z.string().optional().nullable(),
  pause_reason: z.string().trim().max(300).optional().nullable(),
});

type AccessContext = {
  targetUserId: string;
  actorUserId: string;
  actorRole: "elder" | "caregiver" | "family" | "admin" | "user";
  isOwnProfile: boolean;
  isAdmin: boolean;
  canView: boolean;
};

function isSuperAdminEmail(value: unknown): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

function normalizeTime(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeTimes(values: string[]): string[] {
  const result = values
    .map((value) => normalizeTime(value))
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set(result)).sort();
}

function normalizeDays(values: string[]): string[] {
  const result = values
    .map((value) => value.trim().slice(0, 3).toUpperCase())
    .filter((value): value is typeof DAYS[number] => DAYS.includes(value as typeof DAYS[number]));
  return Array.from(new Set(result));
}

function minutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

type ZoneDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zoneDateParts(date: Date, timeZone: string): ZoneDateParts {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    return {
      year: value("year"),
      month: value("month"),
      day: value("day"),
      hour: value("hour"),
      minute: value("minute"),
      second: value("second"),
    };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };
  }
}

function localDateAfterDays(base: Date, offsetDays: number, timeZone: string): ZoneDateParts {
  const local = zoneDateParts(base, timeZone);
  const noonUtc = new Date(Date.UTC(local.year, local.month - 1, local.day + offsetDays, 12, 0, 0));
  return zoneDateParts(noonUtc, timeZone);
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const local = zoneDateParts(date, timeZone);
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(local: ZoneDateParts, hour: number, minute: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(local.year, local.month - 1, local.day, hour, minute, 0));
  const offset = timeZoneOffsetMs(guess, timeZone);
  return new Date(guess.getTime() - offset);
}

function timeInQuietHours(time: string, quietStart: string, quietEnd: string): boolean {
  const t = minutes(time);
  const start = minutes(quietStart);
  const end = minutes(quietEnd);
  if (start === end) return false;
  if (start < end) return t >= start && t < end;
  return t >= start || t < end;
}

function isUrgent(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as Record<string, unknown>).urgent === true);
}

function dayKeyFromLocalParts(local: ZoneDateParts): typeof DAYS[number] {
  return DAYS[(new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay() + 6) % 7];
}

function computeNextRunAt(input: {
  status: string;
  is_paused?: boolean;
  pause_until?: Date | null;
  frequency_type: string;
  days_of_week: string[];
  times_of_day: string[];
  timezone?: string;
}): Date | null {
  if (input.status !== "ACTIVE") return null;
  if (input.is_paused) return null;
  if (input.pause_until && input.pause_until.getTime() > Date.now()) return null;
  const times = input.times_of_day.length ? input.times_of_day : ["10:00"];
  const allowedDays = input.frequency_type === "WEEKLY" || input.frequency_type === "CUSTOM"
    ? new Set(normalizeDays(input.days_of_week))
    : null;
  const now = new Date();
  const timezone = input.timezone || "Europe/Madrid";

  for (let offset = 0; offset <= 30; offset += 1) {
    const localDay = localDateAfterDays(now, offset, timezone);
    if (allowedDays && !allowedDays.has(dayKeyFromLocalParts(localDay))) continue;

    for (const time of times) {
      const [hour, minute] = time.split(":").map(Number);
      const candidate = zonedDateTimeToUtc(localDay, hour, minute, timezone);
      if (input.frequency_type === "ONE_OFF" && offset > 0) return null;
      if (candidate.getTime() > now.getTime()) return candidate;
    }
  }

  return null;
}

function defaultLabel(type: string, medicationName?: string | null) {
  if (type === "CHECK_IN") return "Llamadas de seguimiento";
  if (type === "BRAIN_COACH") return "Entrenador de memoria";
  if (type === "MEDICATION") return medicationName ? `Recordatorio: ${medicationName}` : "Recordatorios de medicacion";
  if (type === "SYMPTOM_FOLLOWUP") return "Seguimiento de sintomas";
  return "Seguimiento de concierge";
}

function defaultDescription(type: string) {
  if (type === "CHECK_IN") return "Una llamada amable para saber como estas y si necesitas ayuda.";
  if (type === "BRAIN_COACH") return "Sesiones suaves para memoria, atencion y compania.";
  if (type === "MEDICATION") return "Recordatorios sencillos para ayudarte con tus tomas.";
  if (type === "SYMPTOM_FOLLOWUP") return "Un seguimiento breve despues de contar como te encuentras.";
  return "Ayuda programada para tareas y recados.";
}

async function resolveTargetUserId(req: Request, rawUserId: string): Promise<string | null> {
  if (!req.user) return null;
  if (rawUserId === "me" || rawUserId === req.user.id) {
    const context = await getActiveProfileContext(req.user.id);
    return context.profileId ?? req.user.id;
  }
  return rawUserId;
}

async function resolveAccess(req: Request, targetUserId: string): Promise<AccessContext> {
  const accountUserId = req.user!.id;
  const activeContext = await getActiveProfileContext(accountUserId);
  const isOwnProfile = targetUserId === accountUserId || activeContext.profileId === targetUserId;

  const [[actorProfile], [membership]] = await Promise.all([
    db.select({ role: profiles.role, email: profiles.email })
      .from(profiles)
      .where(eq(profiles.id, accountUserId))
      .limit(1),
    db.select({ role: profileMemberships.role })
      .from(profileMemberships)
      .where(and(
        eq(profileMemberships.user_id, accountUserId),
        eq(profileMemberships.profile_id, targetUserId),
        eq(profileMemberships.status, "active"),
      ))
      .limit(1),
  ]);

  const isAdmin = req.user?.role === "admin" || actorProfile?.role === "admin" || isSuperAdminEmail(req.user?.email) || isSuperAdminEmail(actorProfile?.email);
  const actorRole = isOwnProfile
    ? "elder"
    : isAdmin
      ? "admin"
      : membership?.role === "caregiver" || membership?.role === "family"
        ? membership.role
        : "user";

  return {
    targetUserId,
    actorUserId: accountUserId,
    actorRole,
    isOwnProfile,
    isAdmin,
    canView: isOwnProfile || isAdmin || Boolean(membership),
  };
}

function canEditSchedule(access: AccessContext, schedule: typeof scheduledInteractions.$inferSelect): boolean {
  if (access.isOwnProfile) return true;
  return Boolean(schedule.admin_edit_allowed && (access.actorRole === "admin" || access.actorRole === "caregiver" || access.actorRole === "family"));
}

async function canCreateForTarget(access: AccessContext): Promise<boolean> {
  if (access.isOwnProfile) return true;
  if (!(access.actorRole === "admin" || access.actorRole === "caregiver" || access.actorRole === "family")) return false;

  const [allowedSchedule] = await db.select({ id: scheduledInteractions.id })
    .from(scheduledInteractions)
    .where(and(
      eq(scheduledInteractions.user_id, access.targetUserId),
      eq(scheduledInteractions.admin_edit_allowed, true),
    ))
    .limit(1);

  return Boolean(allowedSchedule);
}

async function auditChange(access: AccessContext, scheduleId: string | null, previousValue: unknown, newValue: unknown, source = "app") {
  await db.insert(consentAuditLogs).values({
    user_id: access.targetUserId,
    schedule_id: scheduleId,
    changed_by: access.actorUserId,
    changed_by_role: access.actorRole,
    previous_value: previousValue ?? {},
    new_value: newValue ?? {},
    consent_source: source,
  });
}

async function createDefaultSchedules(userId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  const [existing, meds] = await Promise.all([
    db.select().from(scheduledInteractions).where(eq(scheduledInteractions.user_id, userId)),
    db.select().from(userMedications).where(and(eq(userMedications.user_id, userId), eq(userMedications.active, true))),
  ]);
  const existingKeys = new Set(existing.filter((row) => row.status !== "CANCELLED").map((row) => `${row.interaction_type}:${row.source_ref_id ?? ""}`));
  const language = profile?.language || "es";
  const timezone = profile?.timezone || "Europe/Madrid";
  const quietStart = "21:00";
  const quietEnd = "08:00";
  const toCreate: Array<typeof scheduledInteractions.$inferInsert> = [];

  if (!existingKeys.has("CHECK_IN:")) {
    const times = ["10:00"];
    toCreate.push({
      user_id: userId,
      interaction_type: "CHECK_IN",
      friendly_label: defaultLabel("CHECK_IN"),
      user_description: defaultDescription("CHECK_IN"),
      frequency_type: "DAILY",
      days_of_week: [],
      times_of_day: times,
      timezone,
      preferred_language: language,
      quiet_hours_start: quietStart,
      quiet_hours_end: quietEnd,
      next_run_at: computeNextRunAt({ status: "ACTIVE", frequency_type: "DAILY", days_of_week: [], times_of_day: times, timezone }),
      created_by: userId,
      updated_by: userId,
    });
  }

  if (!existingKeys.has("BRAIN_COACH:")) {
    const times = ["11:00"];
    const days = ["MON", "WED", "FRI"];
    toCreate.push({
      user_id: userId,
      interaction_type: "BRAIN_COACH",
      friendly_label: defaultLabel("BRAIN_COACH"),
      user_description: defaultDescription("BRAIN_COACH"),
      frequency_type: "WEEKLY",
      days_of_week: days,
      times_of_day: times,
      timezone,
      preferred_language: language,
      quiet_hours_start: quietStart,
      quiet_hours_end: quietEnd,
      frequency_value: { session_type: "memory" },
      next_run_at: computeNextRunAt({ status: "ACTIVE", frequency_type: "WEEKLY", days_of_week: days, times_of_day: times, timezone }),
      created_by: userId,
      updated_by: userId,
    });
  }

  for (const med of meds) {
    const key = `MEDICATION:${med.id}`;
    if (existingKeys.has(key)) continue;
    const times = normalizeTimes(med.scheduled_times ?? []);
    const safeTimes = times.length ? times : ["09:00"];
    toCreate.push({
      user_id: userId,
      interaction_type: "MEDICATION",
      friendly_label: defaultLabel("MEDICATION", med.medication_name),
      user_description: med.dosage ? `${med.medication_name} - ${med.dosage}` : defaultDescription("MEDICATION"),
      source_ref_id: med.id,
      frequency_type: "DAILY",
      frequency_value: { medication_name: med.medication_name, dosage: med.dosage, frequency: med.frequency },
      days_of_week: [],
      times_of_day: safeTimes,
      timezone,
      preferred_language: language,
      quiet_hours_start: quietStart,
      quiet_hours_end: quietEnd,
      next_run_at: computeNextRunAt({ status: "ACTIVE", frequency_type: "DAILY", days_of_week: [], times_of_day: safeTimes, timezone }),
      created_by: userId,
      updated_by: userId,
    });
  }

  if (toCreate.length) {
    await db.insert(scheduledInteractions).values(toCreate);
  }
  return toCreate.length;
}

async function syncMedicationTimes(schedule: typeof scheduledInteractions.$inferSelect) {
  if (schedule.interaction_type !== "MEDICATION" || !schedule.source_ref_id) return;
  await db.update(userMedications)
    .set({ scheduled_times: schedule.times_of_day })
    .where(and(eq(userMedications.id, schedule.source_ref_id), eq(userMedications.user_id, schedule.user_id)));
}

function buildSchedulePatch(data: z.infer<typeof scheduleBodySchema>, existing?: typeof scheduledInteractions.$inferSelect) {
  const times = data.times_of_day !== undefined ? normalizeTimes(data.times_of_day) : existing?.times_of_day ?? [];
  if (data.times_of_day !== undefined && data.times_of_day.length > 0 && times.length === 0) {
    throw new Error("Usa horarios como 09:00 o 18:30.");
  }
  const quietStart = normalizeTime(data.quiet_hours_start ?? existing?.quiet_hours_start ?? "21:00") ?? "21:00";
  const quietEnd = normalizeTime(data.quiet_hours_end ?? existing?.quiet_hours_end ?? "08:00") ?? "08:00";
  const urgent = isUrgent(data.frequency_value ?? existing?.frequency_value);
  const quietConflict = !urgent && times.some((time) => timeInQuietHours(time, quietStart, quietEnd));
  if (quietConflict) {
    throw new Error("Ese horario cae dentro de las horas de descanso. Elige otra hora o cambia las horas tranquilas.");
  }

  const hasPauseUntilChange = Object.prototype.hasOwnProperty.call(data, "pause_until");
  const pauseUntil = data.pause_until ? new Date(data.pause_until) : hasPauseUntilChange ? null : existing?.pause_until ?? null;
  const status = data.status ?? (pauseUntil && pauseUntil.getTime() > Date.now() ? "PAUSED" : existing?.status ?? "ACTIVE");
  const isPaused = status === "PAUSED" || Boolean(pauseUntil && pauseUntil.getTime() > Date.now()) || (data.status === undefined && existing?.is_paused === true);
  const frequencyType = data.frequency_type ?? existing?.frequency_type ?? "DAILY";
  const days = data.days_of_week !== undefined ? normalizeDays(data.days_of_week) : existing?.days_of_week ?? [];
  const nextRunAt = computeNextRunAt({
    status,
    is_paused: isPaused,
    pause_until: pauseUntil,
    frequency_type: frequencyType,
    days_of_week: days,
    times_of_day: times,
    timezone: data.timezone ?? existing?.timezone ?? "Europe/Madrid",
  });

  return {
    ...data,
    quiet_hours_start: quietStart,
    quiet_hours_end: quietEnd,
    days_of_week: days,
    times_of_day: times,
    status,
    is_paused: isPaused,
    pause_until: pauseUntil,
    next_run_at: nextRunAt,
    updated_at: new Date(),
  };
}

async function requireSchedule(req: Request, res: Response) {
  const [schedule] = await db.select()
    .from(scheduledInteractions)
    .where(eq(scheduledInteractions.id, req.params.scheduleId))
    .limit(1);
  if (!schedule) {
    res.status(404).json({ error: "No encontramos ese horario." });
    return null;
  }
  const access = await resolveAccess(req, schedule.user_id);
  if (!access.canView) {
    res.status(403).json({ error: "No tienes permiso para ver este horario." });
    return null;
  }
  return { schedule, access };
}

router.get("/users/:userId/schedules", requireUser, async (req: Request, res: Response) => {
  const targetUserId = await resolveTargetUserId(req, req.params.userId);
  if (!targetUserId) return res.status(401).json({ error: "Inicia sesion para ver tus horarios." });
  const access = await resolveAccess(req, targetUserId);
  if (!access.canView) return res.status(403).json({ error: "No tienes permiso para ver estos horarios." });

  const defaultSchedulesCreated = await createDefaultSchedules(targetUserId);
  const schedules = await db.select()
    .from(scheduledInteractions)
    .where(eq(scheduledInteractions.user_id, targetUserId))
    .orderBy(desc(scheduledInteractions.updated_at));
  return res.json({ schedules, default_schedules_created: defaultSchedulesCreated });
});

router.post("/users/:userId/schedules", requireUser, async (req: Request, res: Response) => {
  const targetUserId = await resolveTargetUserId(req, req.params.userId);
  if (!targetUserId) return res.status(401).json({ error: "Inicia sesion para crear horarios." });
  const access = await resolveAccess(req, targetUserId);
  if (!access.canView || !(await canCreateForTarget(access))) {
    return res.status(403).json({ error: "Necesitas permiso de la persona para cambiar sus horarios." });
  }

  const parsed = scheduleBodySchema.safeParse(req.body);
  if (!parsed.success || !parsed.data.interaction_type) {
    return res.status(400).json({ error: "Revisa el tipo de apoyo y los horarios." });
  }

  try {
    const patch = buildSchedulePatch(parsed.data);
    const [schedule] = await db.insert(scheduledInteractions)
      .values({
        ...patch,
        user_id: targetUserId,
        interaction_type: parsed.data.interaction_type,
        friendly_label: parsed.data.friendly_label ?? defaultLabel(parsed.data.interaction_type),
        user_description: parsed.data.user_description ?? defaultDescription(parsed.data.interaction_type),
        created_by: req.user!.id,
        updated_by: req.user!.id,
      })
      .returning();
    if (!access.isOwnProfile) await auditChange(access, schedule.id, {}, schedule, "caregiver_or_admin");
    return res.status(201).json({ schedule });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "No pudimos guardar ese horario." });
  }
});

router.patch("/schedules/:scheduleId", requireUser, async (req: Request, res: Response) => {
  const loaded = await requireSchedule(req, res);
  if (!loaded) return;
  const { schedule, access } = loaded;
  if (!canEditSchedule(access, schedule)) {
    return res.status(403).json({ error: "Necesitas permiso de la persona para cambiar este horario." });
  }

  const parsed = scheduleBodySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Revisa los datos del horario." });

  try {
    const patch = buildSchedulePatch(parsed.data, schedule);
    const [updated] = await db.update(scheduledInteractions)
      .set({ ...patch, updated_by: req.user!.id })
      .where(eq(scheduledInteractions.id, schedule.id))
      .returning();
    await syncMedicationTimes(updated);
    await auditChange(access, updated.id, schedule, updated, access.isOwnProfile ? "user" : "caregiver_or_admin");
    return res.json({ schedule: updated });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "No pudimos guardar ese horario." });
  }
});

router.delete("/schedules/:scheduleId", requireUser, async (req: Request, res: Response) => {
  const loaded = await requireSchedule(req, res);
  if (!loaded) return;
  const { schedule, access } = loaded;
  if (!canEditSchedule(access, schedule)) {
    return res.status(403).json({ error: "Necesitas permiso de la persona para cancelar este horario." });
  }

  const [updated] = await db.update(scheduledInteractions)
    .set({ status: "CANCELLED", is_paused: true, next_run_at: null, updated_by: req.user!.id, updated_at: new Date() })
    .where(eq(scheduledInteractions.id, schedule.id))
    .returning();
  await auditChange(access, updated.id, schedule, updated, access.isOwnProfile ? "user" : "caregiver_or_admin");
  return res.json({ schedule: updated });
});

router.post("/schedules/:scheduleId/pause", requireUser, async (req: Request, res: Response) => {
  const loaded = await requireSchedule(req, res);
  if (!loaded) return;
  const { schedule, access } = loaded;
  if (!canEditSchedule(access, schedule)) {
    return res.status(403).json({ error: "Necesitas permiso de la persona para pausar este horario." });
  }
  const parsed = pauseBodySchema.safeParse(req.body ?? {});
  const pauseUntil = parsed.success && parsed.data.pause_until ? new Date(parsed.data.pause_until) : null;
  const [updated] = await db.update(scheduledInteractions)
    .set({
      status: "PAUSED",
      is_paused: true,
      pause_until: pauseUntil,
      pause_reason: parsed.success ? parsed.data.pause_reason ?? null : null,
      next_run_at: null,
      updated_by: req.user!.id,
      updated_at: new Date(),
    })
    .where(eq(scheduledInteractions.id, schedule.id))
    .returning();
  await auditChange(access, updated.id, schedule, updated, access.isOwnProfile ? "user" : "caregiver_or_admin");
  return res.json({ schedule: updated });
});

router.post("/schedules/:scheduleId/resume", requireUser, async (req: Request, res: Response) => {
  const loaded = await requireSchedule(req, res);
  if (!loaded) return;
  const { schedule, access } = loaded;
  if (!canEditSchedule(access, schedule)) {
    return res.status(403).json({ error: "Necesitas permiso de la persona para reactivar este horario." });
  }
  const nextRunAt = computeNextRunAt({
    status: "ACTIVE",
    is_paused: false,
    pause_until: null,
    frequency_type: schedule.frequency_type,
    days_of_week: schedule.days_of_week,
    times_of_day: schedule.times_of_day,
    timezone: schedule.timezone,
  });
  const [updated] = await db.update(scheduledInteractions)
    .set({
      status: "ACTIVE",
      is_paused: false,
      pause_until: null,
      pause_reason: null,
      next_run_at: nextRunAt,
      updated_by: req.user!.id,
      updated_at: new Date(),
    })
    .where(eq(scheduledInteractions.id, schedule.id))
    .returning();
  await auditChange(access, updated.id, schedule, updated, access.isOwnProfile ? "user" : "caregiver_or_admin");
  return res.json({ schedule: updated });
});

router.get("/users/:userId/interaction-logs", requireUser, async (req: Request, res: Response) => {
  const targetUserId = await resolveTargetUserId(req, req.params.userId);
  if (!targetUserId) return res.status(401).json({ error: "Inicia sesion para ver el historial." });
  const access = await resolveAccess(req, targetUserId);
  if (!access.canView) return res.status(403).json({ error: "No tienes permiso para ver este historial." });
  const logs = await db.select()
    .from(interactionLogs)
    .where(eq(interactionLogs.user_id, targetUserId))
    .orderBy(desc(interactionLogs.created_at))
    .limit(100);
  return res.json({ logs });
});

router.get("/users/:userId/consent-audit-logs", requireUser, async (req: Request, res: Response) => {
  const targetUserId = await resolveTargetUserId(req, req.params.userId);
  if (!targetUserId) return res.status(401).json({ error: "Inicia sesion para ver cambios de permisos." });
  const access = await resolveAccess(req, targetUserId);
  if (!access.canView) return res.status(403).json({ error: "No tienes permiso para ver estos cambios." });
  const logs = await db.select()
    .from(consentAuditLogs)
    .where(eq(consentAuditLogs.user_id, targetUserId))
    .orderBy(desc(consentAuditLogs.created_at))
    .limit(100);
  return res.json({ logs });
});

export default router;
