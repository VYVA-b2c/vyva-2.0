import { Router } from "express";
import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, pool } from "../db.js";
import { requireUser } from "../middleware/auth.js";
import { getActiveProfileContext } from "../lib/profileAccess.js";
import { profileMemberships, profiles } from "../../shared/schema.js";

const router = Router();
router.use(requireUser);

const noteBodySchema = z.object({
  note: z.string().trim().min(1).max(1000),
  concernTag: z.string().trim().min(1).max(80).optional().nullable(),
});

type DashboardContext = {
  accountUserId: string;
  profileId: string;
  role: string | null;
  profileCount: number;
  needsProfileSelection: boolean;
  membership: {
    relationship: string | null;
    display_name: string | null;
  } | null;
};

type CaregiverNoteRow = {
  id: string;
  note: string;
  concern_tag: string | null;
  caregiver_name: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

let notesTablePromise: Promise<void> | null = null;

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function splitFullName(fullName?: string | null) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function isoDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function ensureCaregiverNotesTable() {
  if (!notesTablePromise) {
    notesTablePromise = pool.query(`
      create table if not exists caregiver_dashboard_notes (
        id uuid primary key default gen_random_uuid(),
        profile_id text not null references profiles(id) on delete cascade,
        caregiver_user_id text not null references users(id) on delete cascade,
        note text not null,
        concern_tag text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create index if not exists caregiver_dashboard_notes_profile_created_idx
        on caregiver_dashboard_notes (profile_id, created_at desc);

      create index if not exists caregiver_dashboard_notes_caregiver_created_idx
        on caregiver_dashboard_notes (caregiver_user_id, created_at desc);
    `).then(() => undefined);
  }
  return notesTablePromise;
}

async function resolveDashboardContext(req: Request, res: Response): Promise<DashboardContext | null> {
  const accountUserId = req.user!.id;
  const activeContext = await getActiveProfileContext(accountUserId);

  if (!activeContext.profileId) {
    res.status(409).json({
      error: "No care profile selected",
      nextRoute: "/profiles/select",
    });
    return null;
  }

  const [membership] = await db
    .select({
      relationship: profileMemberships.relationship,
      display_name: profileMemberships.display_name,
    })
    .from(profileMemberships)
    .where(and(
      eq(profileMemberships.user_id, accountUserId),
      eq(profileMemberships.profile_id, activeContext.profileId),
      eq(profileMemberships.status, "active"),
    ))
    .limit(1);

  if (!membership && activeContext.profileId !== accountUserId) {
    res.status(403).json({ error: "This care profile is not linked to your account." });
    return null;
  }

  return {
    accountUserId,
    profileId: activeContext.profileId,
    role: activeContext.role,
    profileCount: activeContext.profileCount,
    needsProfileSelection: activeContext.needsProfileSelection,
    membership: membership ?? null,
  };
}

async function loadRecentNotes(profileId: string) {
  await ensureCaregiverNotesTable();
  const result = await pool.query<CaregiverNoteRow>(
    `select
       notes.id,
       notes.note,
       notes.concern_tag,
       coalesce(nullif(members.display_name, ''), users.email, 'Caregiver') as caregiver_name,
       notes.created_at,
       notes.updated_at
     from caregiver_dashboard_notes notes
     left join profile_memberships members
       on members.profile_id = notes.profile_id
      and members.user_id = notes.caregiver_user_id
      and members.status = 'active'
     left join users
       on users.id = notes.caregiver_user_id
     where notes.profile_id = $1
     order by notes.created_at desc
     limit 8`,
    [profileId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    note: row.note,
    concernTag: row.concern_tag,
    caregiverName: row.caregiver_name ?? "Caregiver",
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
  }));
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const context = await resolveDashboardContext(req, res);
    if (!context) return;

    const [profile] = await db
      .select({
        id: profiles.id,
        full_name: profiles.full_name,
        preferred_name: profiles.preferred_name,
        avatar_url: profiles.avatar_url,
        phone_number: profiles.phone_number,
        whatsapp_number: profiles.whatsapp_number,
        email: profiles.email,
        timezone: profiles.timezone,
        language: profiles.language,
        language_preference: profiles.language_preference,
        caregiver_name: profiles.caregiver_name,
        caregiver_contact: profiles.caregiver_contact,
        gp_name: profiles.gp_name,
        gp_phone: profiles.gp_phone,
        gp_email: profiles.gp_email,
      })
      .from(profiles)
      .where(eq(profiles.id, context.profileId))
      .limit(1);

    if (!profile) {
      return res.status(404).json({ error: "Care profile not found." });
    }

    const nameParts = splitFullName(profile.full_name);
    const phone = textOrNull(profile.phone_number) ?? textOrNull(profile.whatsapp_number);
    const notes = await loadRecentNotes(context.profileId);

    return res.json({
      activeProfile: {
        profileId: context.profileId,
        role: context.role,
        profileCount: context.profileCount,
        needsProfileSelection: context.needsProfileSelection,
        relationship: context.membership?.relationship ?? null,
        displayName: context.membership?.display_name ?? null,
      },
      profile: {
        profileId: profile.id,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        preferredName: profile.preferred_name ?? "",
        fullName: profile.full_name ?? "",
        avatarUrl: profile.avatar_url ?? null,
        email: profile.email ?? "",
        phone: phone ?? "",
        whatsapp: profile.whatsapp_number ?? "",
        timezone: profile.timezone ?? "",
        language: profile.language_preference ?? profile.language ?? "",
        relationship: context.membership?.relationship ?? null,
        caregiverName: profile.caregiver_name ?? "",
        caregiverContact: profile.caregiver_contact ?? "",
        gpName: profile.gp_name ?? "",
        gpPhone: profile.gp_phone ?? "",
        gpEmail: profile.gp_email ?? "",
      },
      contacts: {
        primaryPhone: phone,
        whatsapp: textOrNull(profile.whatsapp_number),
        caregiver: {
          name: textOrNull(profile.caregiver_name),
          contact: textOrNull(profile.caregiver_contact),
        },
        gp: {
          name: textOrNull(profile.gp_name),
          phone: textOrNull(profile.gp_phone),
          email: textOrNull(profile.gp_email),
        },
      },
      notes,
      latestNote: notes[0] ?? null,
    });
  } catch (err) {
    console.error("[caregiver dashboard GET]", err);
    return res.status(500).json({ error: "Failed to load caregiver dashboard data" });
  }
});

router.post("/notes", async (req: Request, res: Response) => {
  const parsed = noteBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid note", details: parsed.error.flatten() });
  }

  try {
    const context = await resolveDashboardContext(req, res);
    if (!context) return;

    await ensureCaregiverNotesTable();
    const result = await pool.query<{ id: string }>(
      `insert into caregiver_dashboard_notes (profile_id, caregiver_user_id, note, concern_tag)
       values ($1, $2, $3, $4)
       returning id`,
      [
        context.profileId,
        context.accountUserId,
        parsed.data.note,
        parsed.data.concernTag ?? "caregiver_note",
      ],
    );

    const notes = await loadRecentNotes(context.profileId);
    const note = notes.find((entry) => entry.id === result.rows[0]?.id) ?? notes[0] ?? null;
    return res.status(201).json({ note, notes });
  } catch (err) {
    console.error("[caregiver dashboard notes POST]", err);
    return res.status(500).json({ error: "Failed to save caregiver note" });
  }
});

export default router;
