import { db } from "../db.js";
import { profileMemberships, profiles } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import {
  isMissingOnConflictConstraintError,
  isMissingRelationError,
  missingColumnName,
  notNullColumnName,
  omitColumns,
} from "./dbCompatibility.js";

type ProfileInsertValues = typeof profiles.$inferInsert;
type ProfileUpdateValues = Partial<ProfileInsertValues>;
type ProfileMembershipInsertValues = typeof profileMemberships.$inferInsert;
type ProfileMembershipUpdateValues = Partial<ProfileMembershipInsertValues>;

const PROFILE_CONSTRAINT_COLUMNS = [
  "full_name",
  "date_of_birth",
  "language",
  "language_preference",
  "deployment",
  "subscription_status",
  "subscription_tier",
  "account_status",
  "role",
  "country_code",
  "timezone",
  "onboarding_complete",
  "data_sharing_consent",
  "created_at",
  "updated_at",
];

function requiredProfileDefault(column: string): unknown {
  if (column === "full_name") return "Profile setup";
  if (column === "date_of_birth") return "";
  if (column === "language" || column === "language_preference") return "es";
  if (column === "deployment") return "standard";
  if (column === "subscription_status") return "trial";
  if (column === "subscription_tier") return "free";
  if (column === "account_status") return "enabled";
  if (column === "role") return "user";
  if (column === "country_code") return "ES";
  if (column === "timezone") return "Europe/Madrid";
  if (column === "onboarding_complete") return false;
  if (column === "data_sharing_consent") return {};
  if (column === "created_at" || column === "updated_at") return new Date();
  return undefined;
}

function constrainedProfileColumnName(err: unknown): string | null {
  const error = err as { code?: unknown; constraint?: unknown; detail?: unknown; message?: unknown };
  const message = `${error.constraint ?? ""} ${error.detail ?? ""} ${error.message ?? String(err)}`.toLowerCase();
  const isConstraintError = error.code === "23514" || /violates check constraint|invalid input value for enum/i.test(message);
  if (!isConstraintError) return null;
  return PROFILE_CONSTRAINT_COLUMNS.find((column) => message.includes(column)) ?? null;
}

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
  let retryValues = values;
  let retrySet = set;
  const omittedColumns = new Set<string>();
  let useConflictUpdate = true;

  for (;;) {
    try {
      if (useConflictUpdate) {
        await db
          .insert(profiles)
          .values(omitColumns(retryValues, omittedColumns))
          .onConflictDoUpdate({
            target: profiles.id,
            set: omitColumns(retrySet, omittedColumns),
          });
      } else {
        await upsertProfileWithoutConflict(retryValues, retrySet, omittedColumns);
      }
      return;
    } catch (err) {
      const column = missingColumnName(err);
      if (column && !omittedColumns.has(column)) {
        omittedColumns.add(column);
        console.warn(`${logPrefix} profiles.${column} is missing; retrying profile write without it.`);
        continue;
      }

      const requiredColumn = notNullColumnName(err);
      if (requiredColumn && !omittedColumns.has(requiredColumn)) {
        const fallback = requiredProfileDefault(requiredColumn);
        if (fallback !== undefined) {
          retryValues = { ...retryValues, [requiredColumn]: fallback };
          if (requiredColumn in retrySet) {
            retrySet = { ...retrySet, [requiredColumn]: fallback };
          }
          console.warn(`${logPrefix} profiles.${requiredColumn} is required in this schema; retrying profile write with a safe default.`);
          continue;
        }
      }

      const constrainedColumn = constrainedProfileColumnName(err);
      if (constrainedColumn && !omittedColumns.has(constrainedColumn)) {
        omittedColumns.add(constrainedColumn);
        console.warn(`${logPrefix} profiles.${constrainedColumn} rejected the provided value; retrying profile write with the database default.`);
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
