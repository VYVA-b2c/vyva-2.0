const EMPTY_NAME_VALUES = new Set(["unknown", "null", "undefined"]);

export function displayFirstName(value: string | null | undefined) {
  const name = value?.trim() ?? "";
  if (!name) return "";
  if (name.includes("@")) return "";
  if (EMPTY_NAME_VALUES.has(name.toLowerCase())) return "";
  return name;
}
