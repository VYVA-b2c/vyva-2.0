import { db } from "../db.js";
import { profileMemberships, profiles } from "../../shared/schema.js";
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

export async function upsertProfileToleratingMissingColumns(
  values: ProfileInsertValues,
  set: ProfileUpdateValues,
  logPrefix: string,
): Promise<void> {
  const omittedColumns = new Set<string>();

  for (;;) {
    try {
      await db
        .insert(profiles)
        .values(omitColumns(values, omittedColumns))
        .onConflictDoUpdate({
          target: profiles.id,
          set: omitColumns(set, omittedColumns),
        });
      return;
    } catch (err) {
      const column = missingColumnName(err);
      if (!column || omittedColumns.has(column)) throw err;
      omittedColumns.add(column);
      console.warn(`${logPrefix} profiles.${column} is missing; retrying profile write without it.`);
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
