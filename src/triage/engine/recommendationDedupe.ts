function normalizeRecommendation(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

function recommendationIntent(value: string): string | null {
  const normalized = normalizeRecommendation(value);
  const hasDoctor = hasAny(normalized, [
    "doctor",
    "clinic",
    "clinician",
    "medical advice",
    "medico",
    "medica",
    "clinica",
    "clinico",
  ]);
  const hasEmergency = hasAny(normalized, ["emergency", "urgent help", "urgencias", "emergencias", "ayuda urgente"]);
  const hasToday = hasAny(normalized, ["today", "same day", "hoy", "mismo dia"]);
  const hasWindow = /24\s*48/.test(normalized) || hasAny(normalized, ["24 hours", "48 hours", "24 horas", "48 horas"]);

  if (hasDoctor && hasWindow) return "doctor_24_48";
  if (hasDoctor && hasToday) return "doctor_today";
  if (hasEmergency && hasAny(normalized, ["now", "ahora"])) return "emergency_now";
  if (hasAny(normalized, ["this report", "the report", "informe"]) && hasAny(normalized, ["share", "show", "explain", "compart", "muestra", "explica"])) {
    return "report_use";
  }
  if (hasAny(normalized, ["watching", "warning signs", "keep track", "changes in your symptoms", "senales de alerta", "vigila", "vigilando"])) {
    return "monitor_changes";
  }

  return null;
}

export function mergeTriageRecommendations(primary: string[], secondary: string[] = [], maxItems = 4) {
  const exactSeen = new Set<string>();
  const intentSeen = new Set<string>();
  const merged: string[] = [];

  for (const item of [...primary, ...secondary]) {
    const trimmed = item.trim();
    if (!trimmed) continue;

    const exactKey = normalizeRecommendation(trimmed);
    if (!exactKey || exactSeen.has(exactKey)) continue;

    const intent = recommendationIntent(trimmed);
    if (intent && intentSeen.has(intent)) continue;

    exactSeen.add(exactKey);
    if (intent) intentSeen.add(intent);
    merged.push(trimmed);

    if (merged.length >= maxItems) break;
  }

  return merged;
}
