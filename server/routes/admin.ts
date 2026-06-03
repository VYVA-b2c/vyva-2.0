import { Router } from "express";
import type { Request, Response } from "express";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "../db.js";
import {
  caregiverAlerts,
  communicationsLog,
  profileMemberships,
  profiles,
  scheduledEvents,
  scheduledInteractions,
  teamInvitations,
  userChannelPreferences,
  users,
} from "../../shared/schema.js";
import { z } from "zod";

export const adminRouter = Router();

type ProxyAdminRow = {
  id: string;
  full_name: string | null;
  preferred_name: string | null;
  proxy_initiator_id: string | null;
  proxy_initiated_at: Date | null;
  elder_confirmed_at: Date | null;
  phone_number: string | null;
  email?: string | null;
  whatsapp_number?: string | null;
  caregiver_name?: string | null;
  caregiver_contact?: string | null;
  contact_method?: string | null;
  channel_reports?: string | null;
  channel_chats?: string | null;
  channel_notifications?: string | null;
  language?: string | null;
  timezone?: string | null;
  onboarding_channel?: string | null;
  current_stage?: string | null;
  onboarding_complete?: boolean | null;
  subscription_tier?: string | null;
  account_status?: string | null;
  created_at: Date;
};

// ============================================================
// Admin auth middleware
// Admin routes are mounted behind authMiddleware + requireAdminUser.
// This local guard keeps route handlers explicit and defensive.
// ============================================================

function requireAdmin(req: Request, res: Response): boolean {
  if (!req.user || req.user.role !== "admin") {
    res.status(req.user ? 403 : 401).json({ error: req.user ? "Admin access required" : "Not authenticated" });
    return false;
  }
  return true;
}

async function safeAdminRows<T>(label: string, query: Promise<T[]>): Promise<T[]> {
  try {
    return await query;
  } catch (error) {
    console.warn(`[admin] Optional caregivers data unavailable (${label}):`, error);
    return [];
  }
}

async function listProxyRows(): Promise<ProxyAdminRow[]> {
  try {
    return await db
      .select({
        id:                 profiles.id,
        full_name:          profiles.full_name,
        preferred_name:     profiles.preferred_name,
        proxy_initiator_id: profiles.proxy_initiator_id,
        proxy_initiated_at: profiles.proxy_initiated_at,
        elder_confirmed_at: profiles.elder_confirmed_at,
        phone_number:       profiles.phone_number,
        email:              profiles.email,
        whatsapp_number:    profiles.whatsapp_number,
        caregiver_name:     profiles.caregiver_name,
        caregiver_contact:  profiles.caregiver_contact,
        contact_method:     profiles.contact_method,
        channel_reports:    profiles.channel_reports,
        channel_chats:      profiles.channel_chats,
        channel_notifications: profiles.channel_notifications,
        language:           profiles.language,
        timezone:           profiles.timezone,
        onboarding_channel: profiles.onboarding_channel,
        current_stage:      profiles.current_stage,
        onboarding_complete: profiles.onboarding_complete,
        subscription_tier:  profiles.subscription_tier,
        account_status:     profiles.account_status,
        created_at:         profiles.created_at,
      })
      .from(profiles)
      .where(isNotNull(profiles.proxy_initiator_id))
      .orderBy(desc(profiles.proxy_initiated_at));
  } catch (error) {
    console.warn("[admin] Falling back to core caregivers profile fields:", error);
    return await db
      .select({
        id:                 profiles.id,
        full_name:          profiles.full_name,
        preferred_name:     profiles.preferred_name,
        proxy_initiator_id: profiles.proxy_initiator_id,
        proxy_initiated_at: profiles.proxy_initiated_at,
        elder_confirmed_at: profiles.elder_confirmed_at,
        phone_number:       profiles.phone_number,
        created_at:         profiles.created_at,
      })
      .from(profiles)
      .where(isNotNull(profiles.proxy_initiator_id))
      .orderBy(desc(profiles.proxy_initiated_at));
  }
}

// ============================================================
// GET /proxy-pending
// Returns profiles where proxy_initiator_id is set but
// elder_confirmed_at is null, newest first.
// ============================================================

adminRouter.get("/proxy-pending", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const rows = await listProxyRows();

    const profileIds = rows.map((row) => row.id);
    const [
      invitationRows,
      membershipRows,
      preferenceRows,
      scheduledEventRows,
      supportRows,
      alertRows,
      communicationRows,
    ] = profileIds.length
      ? await Promise.all([
        safeAdminRows("team invitations", db.select({
          id: teamInvitations.id,
          senior_id: teamInvitations.senior_id,
          invitee_name: teamInvitations.invitee_name,
          invitee_phone: teamInvitations.invitee_phone,
          invitee_email: teamInvitations.invitee_email,
          invitee_whatsapp: teamInvitations.invitee_whatsapp,
          role: teamInvitations.role,
          relationship: teamInvitations.relationship,
          status: teamInvitations.status,
          can_receive_daily_digest: teamInvitations.can_receive_daily_digest,
          can_receive_safety_alerts: teamInvitations.can_receive_safety_alerts,
          can_receive_health_alerts: teamInvitations.can_receive_health_alerts,
          can_receive_mood_alerts: teamInvitations.can_receive_mood_alerts,
          can_receive_medication_alerts: teamInvitations.can_receive_medication_alerts,
          can_view_dashboard: teamInvitations.can_view_dashboard,
          created_at: teamInvitations.created_at,
          accepted_at: teamInvitations.accepted_at,
        })
          .from(teamInvitations)
          .where(inArray(teamInvitations.senior_id, profileIds))
          .orderBy(desc(teamInvitations.created_at))),
        safeAdminRows("profile memberships", db.select({
          id: profileMemberships.id,
          profile_id: profileMemberships.profile_id,
          user_id: profileMemberships.user_id,
          role: profileMemberships.role,
          status: profileMemberships.status,
          relationship: profileMemberships.relationship,
          display_name: profileMemberships.display_name,
          is_primary: profileMemberships.is_primary,
          accepted_at: profileMemberships.accepted_at,
          user_email: users.email,
          user_phone: users.phone_number,
        })
          .from(profileMemberships)
          .leftJoin(users, eq(profileMemberships.user_id, users.id))
          .where(and(
            inArray(profileMemberships.profile_id, profileIds),
            inArray(profileMemberships.role, ["caregiver", "family"]),
          ))
          .orderBy(desc(profileMemberships.updated_at))),
        safeAdminRows("channel preferences", db.select()
          .from(userChannelPreferences)
          .where(inArray(userChannelPreferences.user_id, profileIds))),
        safeAdminRows("scheduled events", db.select({
          id: scheduledEvents.id,
          user_id: scheduledEvents.user_id,
          title: scheduledEvents.title,
          event_type: scheduledEvents.event_type,
          channel: scheduledEvents.channel,
          status: scheduledEvents.status,
          scheduled_for: scheduledEvents.scheduled_for,
          source: scheduledEvents.source,
          created_by: scheduledEvents.created_by,
        })
          .from(scheduledEvents)
          .where(inArray(scheduledEvents.user_id, profileIds))
          .orderBy(desc(scheduledEvents.scheduled_for))
          .limit(300)),
        safeAdminRows("scheduled support", db.select({
          id: scheduledInteractions.id,
          user_id: scheduledInteractions.user_id,
          interaction_type: scheduledInteractions.interaction_type,
          friendly_label: scheduledInteractions.friendly_label,
          status: scheduledInteractions.status,
          frequency_type: scheduledInteractions.frequency_type,
          days_of_week: scheduledInteractions.days_of_week,
          times_of_day: scheduledInteractions.times_of_day,
          timezone: scheduledInteractions.timezone,
          admin_edit_allowed: scheduledInteractions.admin_edit_allowed,
          is_paused: scheduledInteractions.is_paused,
          next_run_at: scheduledInteractions.next_run_at,
          last_completed_at: scheduledInteractions.last_completed_at,
        })
          .from(scheduledInteractions)
          .where(inArray(scheduledInteractions.user_id, profileIds))
          .orderBy(desc(scheduledInteractions.updated_at))
          .limit(300)),
        safeAdminRows("caregiver alerts", db.select({
          id: caregiverAlerts.id,
          user_id: caregiverAlerts.user_id,
          alert_type: caregiverAlerts.alert_type,
          severity: caregiverAlerts.severity,
          message: caregiverAlerts.message,
          resolved_at: caregiverAlerts.resolved_at,
          created_at: caregiverAlerts.created_at,
        })
          .from(caregiverAlerts)
          .where(inArray(caregiverAlerts.user_id, profileIds))
          .orderBy(desc(caregiverAlerts.created_at))
          .limit(300)),
        safeAdminRows("communications", db.select({
          id: communicationsLog.id,
          user_id: communicationsLog.user_id,
          channel: communicationsLog.channel,
          purpose: communicationsLog.purpose,
          status: communicationsLog.status,
          recipient: communicationsLog.recipient,
          sent_at: communicationsLog.sent_at,
          created_at: communicationsLog.created_at,
        })
          .from(communicationsLog)
          .where(inArray(communicationsLog.user_id, profileIds))
          .orderBy(desc(communicationsLog.created_at))
          .limit(300)),
      ])
      : [[], [], [], [], [], [], []];

    const byProfileId = <T extends Record<string, unknown>>(items: T[], key: keyof T) => {
      const map = new Map<string, T[]>();
      items.forEach((item) => {
        const id = item[key];
        if (typeof id !== "string") return;
        map.set(id, [...(map.get(id) ?? []), item]);
      });
      return map;
    };

    const invitationsByProfile = byProfileId(invitationRows, "senior_id");
    const membershipsByProfile = byProfileId(membershipRows, "profile_id");
    const preferencesByProfile = new Map(preferenceRows.map((row) => [row.user_id, row]));
    const eventsByProfile = byProfileId(scheduledEventRows, "user_id");
    const supportByProfile = byProfileId(supportRows, "user_id");
    const alertsByProfile = byProfileId(alertRows, "user_id");
    const communicationsByProfile = byProfileId(communicationRows, "user_id");

    // proxy_initiator_id stores the carer's display string "Name (Relationship)"
    // set during proxy setup — it is not a foreign key to another profile.
    // We expose it as proxy_name to make the intent explicit for consumers.
    const normalize = (r: typeof rows[number]) => {
      const profileEvents = eventsByProfile.get(r.id) ?? [];
      const upcomingEvents = profileEvents.filter((event) => ["upcoming", "scheduled"].includes(String(event.status)));
      const profileSupport = supportByProfile.get(r.id) ?? [];
      const activeSupport = profileSupport.filter((item) => String(item.status).toLowerCase() === "active" && !item.is_paused);
      const profileAlerts = alertsByProfile.get(r.id) ?? [];
      const unresolvedAlerts = profileAlerts.filter((alert) => !alert.resolved_at);

      return {
        ...r,
        proxy_name: r.proxy_initiator_id ?? "Unknown",
        elder: {
          id: r.id,
          name: r.preferred_name || r.full_name || null,
          full_name: r.full_name,
          preferred_name: r.preferred_name,
          phone_number: r.phone_number,
          email: r.email,
          whatsapp_number: r.whatsapp_number,
          account_status: r.account_status,
          subscription_tier: r.subscription_tier,
          onboarding_stage: r.current_stage,
          onboarding_channel: r.onboarding_channel,
          onboarding_complete: r.onboarding_complete,
        },
        caregiver: {
          name: r.proxy_initiator_id ?? r.caregiver_name ?? "Unknown caregiver",
          saved_name: r.caregiver_name,
          saved_contact: r.caregiver_contact,
          team: [
            ...(membershipsByProfile.get(r.id) ?? []).map((member) => ({
              source: "membership",
              id: member.id,
              name: member.display_name || member.user_email || "Caregiver account",
              relationship: member.relationship,
              role: member.role,
              status: member.status,
              email: member.user_email,
              phone: member.user_phone,
              accepted_at: member.accepted_at,
              is_primary: member.is_primary,
            })),
            ...(invitationsByProfile.get(r.id) ?? []).map((invite) => ({
              source: "invitation",
              id: invite.id,
              name: invite.invitee_name,
              relationship: invite.relationship,
              role: invite.role,
              status: invite.status,
              email: invite.invitee_email,
              phone: invite.invitee_phone,
              whatsapp: invite.invitee_whatsapp,
              accepted_at: invite.accepted_at,
              permissions: {
                daily_digest: invite.can_receive_daily_digest,
                safety_alerts: invite.can_receive_safety_alerts,
                health_alerts: invite.can_receive_health_alerts,
                mood_alerts: invite.can_receive_mood_alerts,
                medication_alerts: invite.can_receive_medication_alerts,
                dashboard: invite.can_view_dashboard,
              },
            })),
          ],
        },
        preferences: {
          language: r.language,
          timezone: r.timezone,
          contact_method: r.contact_method,
          reports: r.channel_reports,
          chats: r.channel_chats,
          notifications: r.channel_notifications,
          channel: preferencesByProfile.get(r.id) ?? null,
        },
        automations: {
          upcoming_events_count: upcomingEvents.length,
          next_event: upcomingEvents.sort((a, b) => (
            new Date(a.scheduled_for ?? 0).getTime() - new Date(b.scheduled_for ?? 0).getTime()
          ))[0] ?? null,
          active_support_count: activeSupport.length,
          support_schedules: profileSupport.slice(0, 4),
          communications_count: communicationsByProfile.get(r.id)?.length ?? 0,
          recent_communications: (communicationsByProfile.get(r.id) ?? []).slice(0, 3),
          unresolved_alerts_count: unresolvedAlerts.length,
          recent_alerts: profileAlerts.slice(0, 3),
        },
      };
    };

    const pending   = rows.filter((r) => !r.elder_confirmed_at).map(normalize);
    const confirmed = rows.filter((r) => !!r.elder_confirmed_at).map(normalize);

    return res.json({ pending, confirmed });
  } catch (e) {
    console.error("[admin] GET /proxy-pending error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /proxy-confirm/:userId
// Manually sets elder_confirmed_at for the given profile.
// ============================================================

adminRouter.post("/proxy-confirm/:userId", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const { userId } = req.params;

  try {
    const [existing] = await db
      .select({ id: profiles.id, proxy_initiator_id: profiles.proxy_initiator_id })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Profile not found" });
    }
    if (!existing.proxy_initiator_id) {
      return res.status(400).json({ error: "This account was not set up by a proxy" });
    }

    await db
      .update(profiles)
      .set({ elder_confirmed_at: new Date(), updated_at: new Date() })
      .where(eq(profiles.id, userId));

    return res.json({ ok: true, userId, action: "confirmed" });
  } catch (e) {
    console.error("[admin] POST /proxy-confirm error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// DELETE /proxy-caregiver/:userId
// Revokes caregiver access for a proxy-managed profile and
// clears the legacy proxy marker that keeps it in the admin list.
// ============================================================

adminRouter.delete("/proxy-caregiver/:userId", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const { userId } = req.params;
  const now = new Date();

  try {
    const [existing] = await db
      .select({
        id: profiles.id,
        proxy_initiator_id: profiles.proxy_initiator_id,
        caregiver_name: profiles.caregiver_name,
        caregiver_contact: profiles.caregiver_contact,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const hasProxyAssignment = Boolean(existing.proxy_initiator_id || existing.caregiver_name || existing.caregiver_contact);
    if (!hasProxyAssignment) {
      return res.status(400).json({ error: "No caregiver assignment found for this profile" });
    }

    const revokedMemberships = await db
      .update(profileMemberships)
      .set({ status: "revoked", updated_at: now })
      .where(and(
        eq(profileMemberships.profile_id, userId),
        inArray(profileMemberships.role, ["caregiver", "family"]),
      ))
      .returning({ id: profileMemberships.id, user_id: profileMemberships.user_id });

    const revokedInvitations = await db
      .update(teamInvitations)
      .set({
        status: "revoked",
        revoked_at: now,
        revoked_reason: "removed_by_admin",
        updated_at: now,
      })
      .where(and(
        eq(teamInvitations.senior_id, userId),
        inArray(teamInvitations.status, ["pending", "accepted"]),
      ))
      .returning({ id: teamInvitations.id });

    const revokedUserIds = [...new Set(revokedMemberships.map((member) => member.user_id))];
    if (revokedUserIds.length) {
      await db
        .update(users)
        .set({ active_profile_id: null })
        .where(and(
          inArray(users.id, revokedUserIds),
          eq(users.active_profile_id, userId),
        ));
    }

    await db
      .update(profiles)
      .set({
        proxy_initiator_id: null,
        proxy_initiated_at: null,
        elder_confirmed_at: null,
        caregiver_name: null,
        caregiver_contact: null,
        updated_at: now,
      })
      .where(eq(profiles.id, userId));

    return res.json({
      ok: true,
      userId,
      action: "caregiver_removed",
      revoked_memberships: revokedMemberships.length,
      revoked_invitations: revokedInvitations.length,
    });
  } catch (e) {
    console.error("[admin] DELETE /proxy-caregiver error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// POST /proxy-flag/:userId
// Creates a caregiver_alert entry flagging the account for
// manual review (e.g. proxy seems fraudulent or unresponsive).
// ============================================================

const flagSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

adminRouter.post("/proxy-flag/:userId", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const { userId } = req.params;
  const parsed = flagSchema.safeParse(req.body);
  const reason = parsed.success ? (parsed.data.reason ?? "Flagged by admin for review") : "Flagged by admin for review";

  try {
    const [existing] = await db
      .select({ id: profiles.id, proxy_initiator_id: profiles.proxy_initiator_id })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Profile not found" });
    }
    if (!existing.proxy_initiator_id) {
      return res.status(400).json({ error: "This account was not set up by a proxy" });
    }

    await db.insert(caregiverAlerts).values({
      user_id:    userId,
      alert_type: "proxy_unconfirmed_flag",
      severity:   "warning",
      message:    reason,
      sent_to:    ["admin"],
    });

    return res.json({ ok: true, userId, action: "flagged", reason });
  } catch (e) {
    console.error("[admin] POST /proxy-flag error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});
