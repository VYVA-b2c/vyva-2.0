import { db, pool } from "../db.js";
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

const CORE_PROFILE_WRITE_COLUMNS = new Set([
  "id",
  "full_name",
  "preferred_name",
  "date_of_birth",
  "email",
  "phone_number",
  "whatsapp_number",
  "country_code",
  "timezone",
  "language",
  "language_preference",
  "address_line_1",
  "city",
  "postcode",
  "caregiver_name",
  "caregiver_contact",
  "gp_name",
  "gp_phone",
  "gp_email",
  "data_sharing_consent",
  "created_at",
  "updated_at",
]);

type DatabaseProfileColumn = {
  column_name: string;
  is_nullable: string;
  column_default: string | null;
};

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

function quotedIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function ownValue(values: Record<string, unknown>, column: string): unknown {
  return Object.prototype.hasOwnProperty.call(values, column) ? values[column] : undefined;
}

async function loadDatabaseProfileColumns(): Promise<Map<string, DatabaseProfileColumn>> {
  const result = await pool.query<DatabaseProfileColumn>(`
    select column_name, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
    order by ordinal_position
  `);
  return new Map(result.rows.map((column) => [column.column_name, column]));
}

function rawProfileInsertValues(
  values: ProfileInsertValues,
  columns: Map<string, DatabaseProfileColumn>,
): Record<string, unknown> {
  const source = values as Record<string, unknown>;
  const row: Record<string, unknown> = {};

  for (const column of CORE_PROFILE_WRITE_COLUMNS) {
    if (!columns.has(column)) continue;
    const value = ownValue(source, column);
    if (value !== undefined && value !== null) row[column] = value;
  }

  for (const [columnName, column] of columns) {
    if (row[columnName] !== undefined) continue;
    if (column.is_nullable === "YES" || column.column_default) continue;
    const fallback = requiredProfileDefault(columnName);
    if (fallback !== undefined) row[columnName] = fallback;
  }

  return row;
}

function rawProfileUpdateValues(
  set: ProfileUpdateValues,
  columns: Map<string, DatabaseProfileColumn>,
): Record<string, unknown> {
  const source = set as Record<string, unknown>;
  const row: Record<string, unknown> = {};

  for (const column of CORE_PROFILE_WRITE_COLUMNS) {
    if (column === "id" || !columns.has(column)) continue;
    const value = ownValue(source, column);
    if (value !== undefined) row[column] = value;
  }

  return row;
}

async function writeProfileFromDatabaseColumns(
  values: ProfileInsertValues,
  set: ProfileUpdateValues,
  logPrefix: string,
): Promise<void> {
  const id = values.id;
  if (!id) throw new Error("Profile id is required for raw profile write fallback.");

  const columns = await loadDatabaseProfileColumns();
  if (!columns.has("id")) throw new Error("profiles.id column is unavailable.");

  const existing = await pool.query(
    "select 1 from public.profiles where id = $1 limit 1",
    [id],
  );

  if (existing.rowCount && existing.rowCount > 0) {
    const updateValues = rawProfileUpdateValues(set, columns);
    const updateColumns = Object.keys(updateValues).filter((column) => column !== "id");
    if (updateColumns.length === 0) return;

    const assignments = updateColumns
      .map((column, index) => `${quotedIdentifier(column)} = $${index + 1}`)
      .join(", ");
    await pool.query(
      `update public.profiles set ${assignments} where id = $${updateColumns.length + 1}`,
      [...updateColumns.map((column) => updateValues[column]), id],
    );
    console.warn(`${logPrefix} profile write recovered with database-column update fallback.`);
    return;
  }

  const insertValues = rawProfileInsertValues(values, columns);
  insertValues.id = id;
  const insertColumns = Object.keys(insertValues).filter((column) => columns.has(column));
  if (!insertColumns.includes("id")) insertColumns.unshift("id");
  const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(", ");
  const quotedColumns = insertColumns.map(quotedIdentifier).join(", ");

  await pool.query(
    `insert into public.profiles (${quotedColumns}) values (${placeholders})`,
    insertColumns.map((column) => insertValues[column]),
  );
  console.warn(`${logPrefix} profile write recovered with database-column insert fallback.`);
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

      try {
        await writeProfileFromDatabaseColumns(retryValues, retrySet, logPrefix);
        return;
      } catch (fallbackErr) {
        console.error(`${logPrefix} database-column profile write fallback failed:`, fallbackErr);
        throw err;
      }
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
