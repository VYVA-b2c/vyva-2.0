import { db } from "../db.js";
import { profiles } from "../../shared/schema.js";
import { missingColumnName, omitColumns } from "./dbCompatibility.js";

type ProfileInsertValues = typeof profiles.$inferInsert;
type ProfileUpdateValues = Partial<ProfileInsertValues>;

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
