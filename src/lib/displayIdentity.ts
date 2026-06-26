const EMPTY_NAME_VALUES = new Set(["unknown", "null", "undefined"]);

export function displayFirstName(value: string | null | undefined) {
  const name = value?.trim() ?? "";
  if (!name) return "";
  if (name.includes("@")) return "";
  if (EMPTY_NAME_VALUES.has(name.toLowerCase())) return "";
  return name;
}

export type DisplayNameProfile = {
  firstName?: string | null;
  first_name?: string | null;
  preferredName?: string | null;
  preferred_name?: string | null;
  fullName?: string | null;
  full_name?: string | null;
};

function firstToken(value: string | null | undefined) {
  return value?.trim().split(/\s+/).filter(Boolean)[0] ?? "";
}

export function displayProfileFirstName(profile: DisplayNameProfile | null | undefined) {
  const candidates = [
    profile?.first_name,
    profile?.firstName,
    firstToken(profile?.full_name),
    firstToken(profile?.fullName),
  ];

  for (const candidate of candidates) {
    const name = displayFirstName(candidate);
    if (name) return name;
  }

  return "";
}
