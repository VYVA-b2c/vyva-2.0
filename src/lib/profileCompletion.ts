export function deriveCompletedSections(
  profile: Record<string, unknown> | null,
  state: Record<string, unknown> | null
): Set<string> {
  const completed = new Set<string>();

  if (!profile && !state) return completed;

  if (profile?.full_name) {
    completed.add("basics");
  }

  if (profile?.address_line_1 || profile?.city) {
    completed.add("contact");
  }

  const consent = profile?.data_sharing_consent as Record<string, unknown> | null | undefined;
  const conditions = consent?.conditions as Record<string, unknown> | null | undefined;
  const conditionNames = Array.isArray(profile?.conditions)
    ? profile.conditions
    : Array.isArray(conditions?.health_conditions)
      ? conditions.health_conditions
      : [];
  const hasConditionNames = conditionNames.some((condition) => {
    if (typeof condition === "string") return condition.trim().length > 0;
    return Boolean(
      condition &&
      typeof condition === "object" &&
      "name" in condition &&
      typeof condition.name === "string" &&
      condition.name.trim().length > 0
    );
  });
  const hasMobility = typeof profile?.mobility_level === "string"
    ? profile.mobility_level.trim().length > 0
    : typeof conditions?.mobility_level === "string" && conditions.mobility_level.trim().length > 0;
  const hasLivingSituation = typeof profile?.living_situation === "string"
    ? profile.living_situation.trim().length > 0
    : typeof conditions?.living_situation === "string" && conditions.living_situation.trim().length > 0;
  if (
    state?.has_health_conditions ||
    hasConditionNames ||
    hasMobility ||
    hasLivingSituation ||
    conditions?.no_known_conditions === true ||
    profile?.no_known_conditions === true
  ) {
    completed.add("health");
  }

  const medicationConsent = consent?.medications as Record<string, unknown> | null | undefined;
  const profileMedications = Array.isArray(profile?.medications) ? profile.medications : [];
  const hasProfileMedication = profileMedications.some((medication) => {
    if (typeof medication === "string") return medication.trim().length > 0;
    return Boolean(
      medication &&
      typeof medication === "object" &&
      (
        ("name" in medication && typeof medication.name === "string" && medication.name.trim().length > 0) ||
        ("medication_name" in medication && typeof medication.medication_name === "string" && medication.medication_name.trim().length > 0)
      )
    );
  });
  if (
    state?.has_medications ||
    hasProfileMedication ||
    medicationConsent?.no_known_medications === true ||
    profile?.no_known_medications === true
  ) {
    completed.add("medications");
  }

  const allergies = profile?.known_allergies;
  const allergyConsent = consent?.allergies as Record<string, unknown> | null | undefined;
  if (
    (Array.isArray(allergies) && allergies.some((allergy) => typeof allergy === "string" && allergy.trim().length > 0)) ||
    allergyConsent?.no_known_allergies === true ||
    profile?.no_known_allergies === true
  ) {
    completed.add("allergies");
  }

  if (state?.has_gp_details) {
    completed.add("gp");
  }

  const providers = consent?.providers;
  if (Array.isArray(providers) && providers.length > 0) {
    completed.add("providers");
  }

  if (state?.has_caregiver || state?.has_family_member || state?.has_doctor) {
    completed.add("care-team");
  }

  const nestedHobbies = consent?.hobbies as Record<string, unknown> | unknown[] | null | undefined;
  const hobbies = Array.isArray(profile?.hobbies)
    ? profile.hobbies
    : Array.isArray(nestedHobbies)
      ? nestedHobbies
      : (nestedHobbies as Record<string, unknown> | null | undefined)?.hobbies;
  if (Array.isArray(hobbies) && hobbies.length > 0) {
    completed.add("hobbies");
  }

  const emergency = consent?.emergency as Record<string, unknown> | null | undefined;
  if (
    typeof emergency?.emergency_name === "string" &&
    emergency.emergency_name.trim().length > 0 &&
    typeof emergency?.emergency_phone === "string" &&
    emergency.emergency_phone.trim().length > 0
  ) {
    completed.add("emergency");
  }

  return completed;
}

const CORE_SECTIONS = [
  "basics",
  "contact",
  "health",
  "medications",
  "allergies",
  "gp",
  "providers",
  "care-team",
  "emergency",
];

export function isProfileComplete(
  profile: Record<string, unknown> | null,
  state: Record<string, unknown> | null
): boolean {
  const completed = deriveCompletedSections(profile, state);
  return CORE_SECTIONS.every((s) => completed.has(s));
}
