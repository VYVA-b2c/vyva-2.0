import { Router, type Request, type Response } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db.js";
import { requireUser } from "../middleware/auth.js";
import { getActiveProfileContext, requireActiveProfileId } from "../lib/profileAccess.js";
import {
  auditBrainCoachCaregiverChange,
  BRAIN_COACH_CAREGIVER_PERMISSION_KEYS,
  effectiveBrainCoachPermissions,
  withBrainCoachPermissions,
  type BrainCoachCaregiverPermissions,
} from "../lib/brainCoachCaregiverAccess.js";
import {
  profileMemberships,
  teamInvitations,
  users,
} from "../../shared/schema.js";

const router = Router();

const permissionsSchema = z.object({
  view_summary: z.boolean().optional(),
  manage_plan_preferences: z.boolean().optional(),
  manage_schedule: z.boolean().optional(),
  send_nudges: z.boolean().optional(),
  preview_plan: z.boolean().optional(),
}).strict();

function permissionsPatch(body: unknown): Partial<BrainCoachCaregiverPermissions> | null {
  const parsed = permissionsSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

async function acceptedInvitationFor(userId: string, profileId: string) {
  const [invitation] = await db
    .select({
      can_view_dashboard: teamInvitations.can_view_dashboard,
      can_view_journal_summaries: teamInvitations.can_view_journal_summaries,
    })
    .from(teamInvitations)
    .where(and(
      eq(teamInvitations.accepted_user_id, userId),
      eq(teamInvitations.senior_id, profileId),
      eq(teamInvitations.status, "accepted"),
    ))
    .limit(1);
  return invitation ?? null;
}

router.get("/permissions", requireUser, async (req: Request, res: Response) => {
  const profileId = await requireActiveProfileId(req.user!.id, res);
  if (!profileId) return;

  try {
    const rows = await db
      .select({
        id: profileMemberships.id,
        userId: profileMemberships.user_id,
        profileId: profileMemberships.profile_id,
        role: profileMemberships.role,
        status: profileMemberships.status,
        relationship: profileMemberships.relationship,
        displayName: profileMemberships.display_name,
        permissions: profileMemberships.permissions,
      })
      .from(profileMemberships)
      .where(and(
        eq(profileMemberships.profile_id, profileId),
        inArray(profileMemberships.role, ["caregiver", "family"]),
      ));

    const members = await Promise.all(rows.map(async (member) => {
      const invitation = await acceptedInvitationFor(member.userId, profileId);
      return {
        ...member,
        brainCoachPermissions: effectiveBrainCoachPermissions({
          membershipPermissions: member.permissions,
          careTeamConsent: invitation,
        }),
      };
    }));

    return res.json({ members, permissionKeys: BRAIN_COACH_CAREGIVER_PERMISSION_KEYS });
  } catch (error) {
    console.error("[caregiver-brain-coach] permissions list failed:", error);
    return res.status(500).json({ error: "Brain Coach permissions could not be loaded." });
  }
});

router.patch("/permissions/:membershipId", requireUser, async (req: Request, res: Response) => {
  const profileId = await requireActiveProfileId(req.user!.id, res);
  if (!profileId) return;
  const patch = permissionsPatch(req.body);
  if (!patch) return res.status(400).json({ error: "Invalid Brain Coach permissions." });

  try {
    const [membership] = await db
      .select()
      .from(profileMemberships)
      .where(and(
        eq(profileMemberships.id, req.params.membershipId),
        eq(profileMemberships.profile_id, profileId),
        inArray(profileMemberships.role, ["caregiver", "family"]),
      ))
      .limit(1);

    if (!membership) return res.status(404).json({ error: "Care team member not found." });

    const previousPermissions = membership.permissions;
    const nextPermissions = withBrainCoachPermissions(previousPermissions, patch);
    const [updated] = await db
      .update(profileMemberships)
      .set({ permissions: nextPermissions, updated_at: new Date() })
      .where(eq(profileMemberships.id, membership.id))
      .returning();

    const [account] = await db
      .select({ active_profile_id: users.active_profile_id })
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);
    const context = await getActiveProfileContext(req.user!.id);
    await auditBrainCoachCaregiverChange({
      access: {
        targetUserId: profileId,
        actorUserId: req.user!.id,
        actorRole: "elder",
        isOwnProfile: context.profileId === profileId || account?.active_profile_id === profileId,
        isAdmin: false,
        permissions: {
          view_summary: true,
          manage_plan_preferences: true,
          manage_schedule: true,
          send_nudges: true,
          preview_plan: true,
        },
      },
      previousValue: { membership_id: membership.id, permissions: previousPermissions },
      newValue: { membership_id: membership.id, permissions: nextPermissions },
      source: "brain_coach_permission_update",
    });

    return res.json({
      member: {
        id: updated.id,
        userId: updated.user_id,
        profileId: updated.profile_id,
        role: updated.role,
        status: updated.status,
        relationship: updated.relationship,
        displayName: updated.display_name,
        brainCoachPermissions: effectiveBrainCoachPermissions({ membershipPermissions: updated.permissions }),
      },
    });
  } catch (error) {
    console.error("[caregiver-brain-coach] permissions update failed:", error);
    return res.status(500).json({ error: "Brain Coach permissions could not be saved." });
  }
});

export default router;
