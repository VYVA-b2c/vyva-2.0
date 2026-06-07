export function missingColumnName(err: unknown): string | null {
  const message = err instanceof Error ? err.message : String(err);
  const quotedMatch = message.match(/column\s+(?:"[a-z0-9_]+"\.)?"([^"]+)"\s+does not exist/i);
  if (quotedMatch?.[1]) return quotedMatch[1];
  const bareMatch = message.match(/column\s+[a-z0-9_]+\.([a-z0-9_]+)\s+does not exist/i);
  return bareMatch?.[1] ?? null;
}

export function omitColumns<T extends Record<string, unknown>>(values: T, columns: Set<string>): T {
  if (columns.size === 0) return values;
  const next = { ...values };
  for (const column of columns) {
    delete next[column as keyof T];
  }
  return next as T;
}
