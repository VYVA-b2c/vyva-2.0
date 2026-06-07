import { db } from "../db.js";
import { profileMemberships, profiles } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import {
  isMissingOnConflictConstraintError,
  isMissingRelationError,
  missingColumnName,
  omitColumns,
} from "./dbCompatibility.js";

type ProfileInsertValues = typeof profiles.$inferInsert;
type ProfileUpdateValues = Partial<ProfileInsertValues>;
type ProfileMembershipInsertValues = typeof profileMemberships.$inferInsert;
type ProfileMembershipUpdateValues = Partial<ProfileMembershipInsertValues>;

async function upsertProfileWithoutConflict(
  values: ProfileInsertValues,
  set: ProfileUpdateValues,
  omittedColumns: Set<string>,
): Promise<void> {
  const updateValues = omitColumns(set, omittedColumns);

  if (Object.keys(updateValues).length > 0) {
    const updated = await db
      .update(profiles)
      .set(updateValues)
      .where(eq(profiles.id, values.id))
      .returning({ id: profiles.id });

    if (updated.length > 0) return;
  } else {
    const existing = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, values.id))
      .limit(1);

    if (existing[0]) return;
  }

  await db
    .insert(profiles)
    .values(omitColumns(values, omittedColumns));
}

export async function upsertProfileToleratingMissingColumns(
  values: ProfileInsertValues,
  set: ProfileUpdateValues,
  logPrefix: string,
): Promise<void> {
  const omittedColumns = new Set<string>();
  let useConflictUpdate = true;

  for (;;) {
    try {
      if (useConflictUpdate) {
        await db
          .insert(profiles)
          .values(omitColumns(values, omittedColumns))
          .onConflictDoUpdate({
            target: profiles.id,
            set: omitColumns(set, omittedColumns),
          });
      } else {
        await upsertProfileWithoutConflict(values, set, omittedColumns);
      }
      return;
    } catch (err) {
      const column = missingColumnName(err);
      if (column && !omittedColumns.has(column)) {
        omittedColumns.add(column);
        console.warn(`${logPrefix} profiles.${column} is missing; retrying profile write without it.`);
        continue;
      }

      if (useConflictUpdate && isMissingOnConflictConstraintError(err)) {
        useConflictUpdate = false;
        console.warn(`${logPrefix} profiles conflict constraint is missing; retrying profile write without conflict update.`);
        continue;
      }

      throw err;
    }
  }
}

export async function upsertOptionalProfileMetadata(
  values: ProfileInsertValues,
  set: ProfileUpdateValues,
  logPrefix: string,
): Promise<void> {
  try {
    await upsertProfileToleratingMissingColumns(values, set, logPrefix);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`${logPrefix} optional profile metadata skipped: ${message.slice(0, 240)}`);
  }
}

export async function upsertProfileMembershipToleratingMissingColumns(
  values: ProfileMembershipInsertValues,
  set: ProfileMembershipUpdateValues,
  logPrefix: string,
): Promise<boolean> {
  const omittedColumns = new Set<string>();
  let useConflictUpdate = true;

  for (;;) {
    try {
      if (useConflictUpdate) {
        await db
          .insert(profileMemberships)
          .values(omitColumns(values, omittedColumns))
          .onConflictDoUpdate({
            target: [profileMemberships.user_id, profileMemberships.profile_id],
            set: omitColumns(set, omittedColumns),
          });
      } else {
        await db
          .insert(profileMemberships)
          .values(omitColumns(values, omittedColumns))
          .onConflictDoNothing();
      }
      return true;
    } catch (err) {
      if (isMissingRelationError(err, "profile_memberships")) {
        console.warn(`${logPrefix} profile_memberships table is missing; continuing with direct profile fallback.`);
        return false;
      }

      const column = missingColumnName(err);
      if (column && !omittedColumns.has(column)) {
        omittedColumns.add(column);
        console.warn(`${logPrefix} profile_memberships.${column} is missing; retrying membership write without it.`);
        continue;
      }

      if (useConflictUpdate && isMissingOnConflictConstraintError(err)) {
        useConflictUpdate = false;
        console.warn(`${logPrefix} profile_memberships unique constraint is missing; retrying membership insert without conflict update.`);
        continue;
      }

      throw err;
    }
  }
}
