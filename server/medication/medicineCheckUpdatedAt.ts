type Timestamp = Date | string | null | undefined;

function timestampMillis(value: Timestamp) {
  if (!value) return null;
  const millis = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(millis) ? millis : null;
}

export function latestMedicineProfileUpdatedAt(
  profileUpdatedAt: Timestamp,
  medicines: Array<{ updated_at: Timestamp }>,
) {
  const timestamps = [profileUpdatedAt, ...medicines.map((medicine) => medicine.updated_at)]
    .map(timestampMillis)
    .filter((value): value is number => value !== null);

  return timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;
}
