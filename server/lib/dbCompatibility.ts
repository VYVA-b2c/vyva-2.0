export function missingColumnName(err: unknown): string | null {
  const message = err instanceof Error ? err.message : String(err);
  const relationMatch = message.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[a-z0-9_]+"\s+does\s+not\s+exist/i);
  if (relationMatch?.[1]) return relationMatch[1];
  const quotedMatch = message.match(/column\s+(?:"[a-z0-9_]+"\.)?"([^"]+)"\s+does not exist/i);
  if (quotedMatch?.[1]) return quotedMatch[1];
  const bareMatch = message.match(/column\s+[a-z0-9_]+\.([a-z0-9_]+)\s+does not exist/i);
  return bareMatch?.[1] ?? null;
}

export function notNullColumnName(err: unknown): string | null {
  const error = err as { code?: unknown; column?: unknown; message?: unknown };
  if (error.code === "23502" && typeof error.column === "string") return error.column;

  const message = typeof error.message === "string" ? error.message : String(err);
  const match = message.match(/null\s+value\s+in\s+column\s+"([^"]+)"\s+of\s+relation\s+"[a-z0-9_]+"\s+violates\s+not-null\s+constraint/i);
  return match?.[1] ?? null;
}

export function isMissingRelationError(err: unknown, relationName: string): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return new RegExp(`relation\\s+"${relationName}"\\s+does\\s+not\\s+exist`, "i").test(message);
}

export function isRelationSchemaUnavailableError(err: unknown, relationName: string): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return isMissingRelationError(err, relationName) || (
    message.includes("does not exist") &&
    message.includes(relationName)
  );
}

export function isMissingOnConflictConstraintError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /no unique or exclusion constraint matching the ON CONFLICT specification/i.test(message);
}

export function omitColumns<T extends Record<string, unknown>>(values: T, columns: Set<string>): T {
  if (columns.size === 0) return values;
  const next = { ...values };
  for (const column of columns) {
    delete next[column as keyof T];
  }
  return next as T;
}
