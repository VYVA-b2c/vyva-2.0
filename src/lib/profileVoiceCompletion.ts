export type ProfileVoiceSection = "health" | "medications" | "allergies";

export type ProfileVoiceDraftKind = "health-conditions" | "medications" | "allergies";

export type ProfileVoiceCommandKind = "remove" | "try-again" | "skip";

export interface ProfileVoiceDraftRow {
  id: string;
  label: string;
  value: string;
  helper?: string;
}

export interface ProfileVoiceDraft {
  id: string;
  section: ProfileVoiceSection;
  kind: ProfileVoiceDraftKind;
  title: string;
  helper: string;
  rows: ProfileVoiceDraftRow[];
  values: string[];
}

export interface ProfileVoiceCommand {
  section: ProfileVoiceSection;
  kind: ProfileVoiceCommandKind;
  target?: string;
}

export type ProfileVoiceAdapterResult =
  | { type: "draft"; draft: ProfileVoiceDraft }
  | { type: "command"; command: ProfileVoiceCommand }
  | { type: "empty"; section: ProfileVoiceSection; reason: string };

export interface MedicationVoiceDraftValue {
  name: string;
  dosage?: string;
  routine?: string;
}

const HEALTH_SYNONYMS: Record<string, string> = {
  "high blood pressure": "Hypertension",
  "blood pressure": "Hypertension",
  hypertension: "Hypertension",
  diabetes: "Diabetes Type 2",
  "type 2 diabetes": "Diabetes Type 2",
  "type two diabetes": "Diabetes Type 2",
  asthma: "Asthma",
  copd: "COPD",
  "heart failure": "Heart failure",
  anxiety: "Anxiety",
  depression: "Depression",
};

const COMMON_ALLERGENS: Record<string, string> = {
  penicillin: "Penicillin",
  aspirin: "Aspirin",
  ibuprofen: "Ibuprofen",
  latex: "Latex",
  peanuts: "Peanuts",
  peanut: "Peanuts",
  "tree nuts": "Tree nuts",
  shellfish: "Shellfish",
  eggs: "Eggs",
  egg: "Eggs",
  milk: "Milk / Dairy",
  dairy: "Milk / Dairy",
  gluten: "Wheat / Gluten",
  wheat: "Wheat / Gluten",
  soy: "Soy",
  "bee stings": "Bee stings",
};

const REMOVE_PATTERNS = [
  /\bremove\s+(.+)$/i,
  /\btake\s+off\s+(.+)$/i,
  /\bdelete\s+(.+)$/i,
];

function cleanTranscript(transcript: string) {
  return transcript.toLowerCase().replace(/[.,!?;:]/g, " ").replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseProfileVoiceCommand(
  section: ProfileVoiceSection,
  transcript: string,
): ProfileVoiceCommand | null {
  const cleaned = cleanTranscript(transcript);
  if (!cleaned) return null;

  if (/\b(try again|start over|redo that)\b/i.test(cleaned)) {
    return { section, kind: "try-again" };
  }
  if (/\b(skip this|skip section|skip for now)\b/i.test(cleaned)) {
    return { section, kind: "skip" };
  }

  for (const pattern of REMOVE_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match?.[1]) {
      return { section, kind: "remove", target: match[1].trim() };
    }
  }

  return null;
}

export function createHealthVoiceDraft(transcript: string): ProfileVoiceDraft | null {
  const cleaned = cleanTranscript(transcript);
  const matches = unique(
    Object.entries(HEALTH_SYNONYMS)
      .filter(([phrase]) => cleaned.includes(phrase))
      .map(([, canonical]) => canonical),
  );

  if (matches.length === 0) return null;

  return {
    id: `health:${matches.join("|").toLowerCase()}`,
    section: "health",
    kind: "health-conditions",
    title: "Review health conditions",
    helper: "VYVA found these from what you said. Add them only if they look right.",
    values: matches,
    rows: matches.map((value) => ({
      id: value.toLowerCase().replace(/\s+/g, "-"),
      label: "Condition",
      value,
    })),
  };
}

export function createAllergiesVoiceDraft(valuesOrTranscript: string[] | string): ProfileVoiceDraft | null {
  const values = Array.isArray(valuesOrTranscript)
    ? valuesOrTranscript.map((value) => value.trim()).filter(Boolean)
    : unique(
        Object.entries(COMMON_ALLERGENS)
          .filter(([phrase]) => cleanTranscript(valuesOrTranscript).includes(phrase))
          .map(([, canonical]) => canonical),
      );

  const uniqueValues = unique(values);
  if (uniqueValues.length === 0) return null;

  return {
    id: `allergies:${uniqueValues.join("|").toLowerCase()}`,
    section: "allergies",
    kind: "allergies",
    title: "Review allergies",
    helper: "VYVA found these possible allergies. Add them only if they look right.",
    values: uniqueValues,
    rows: uniqueValues.map((value) => ({
      id: value.toLowerCase().replace(/\s+/g, "-"),
      label: "Allergy",
      value,
    })),
  };
}

export function createMedicationVoiceDraft(transcript: string): MedicationVoiceDraftValue | null {
  const cleaned = cleanTranscript(transcript);
  const nameMatch = cleaned.match(/\b(?:take|taking|medicine is|medication is|add)\s+([a-z][a-z0-9-]*)/i);
  const dosageMatch = transcript.match(/\b(\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|units?))\b/i);
  const routineMatch = cleaned.match(/\b(morning and evening|morning|evening|bedtime|night|once daily|twice daily)\b/i);
  const name = nameMatch?.[1] ?? cleaned.split(" ").find((word) => word.length > 3);

  if (!name) return null;

  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    dosage: dosageMatch?.[1],
    routine: routineMatch?.[1],
  };
}

export function parseProfileVoiceTranscript(
  section: ProfileVoiceSection,
  transcript: string,
): ProfileVoiceAdapterResult {
  const command = parseProfileVoiceCommand(section, transcript);
  if (command) return { type: "command", command };

  if (section === "health") {
    const draft = createHealthVoiceDraft(transcript);
    return draft ? { type: "draft", draft } : { type: "empty", section, reason: "No health conditions recognised" };
  }

  if (section === "allergies") {
    const draft = createAllergiesVoiceDraft(transcript);
    return draft ? { type: "draft", draft } : { type: "empty", section, reason: "No allergies recognised" };
  }

  const med = createMedicationVoiceDraft(transcript);
  if (!med) return { type: "empty", section, reason: "No medication recognised" };

  const values = [med.name, med.dosage, med.routine].filter(Boolean) as string[];
  return {
    type: "draft",
    draft: {
      id: `medications:${values.join("|").toLowerCase()}`,
      section: "medications",
      kind: "medications",
      title: "Review medication",
      helper: "VYVA found these medication details. Add them only if they look right.",
      values,
      rows: [
        { id: "name", label: "Medication", value: med.name },
        ...(med.dosage ? [{ id: "dosage", label: "Strength", value: med.dosage }] : []),
        ...(med.routine ? [{ id: "routine", label: "Routine", value: med.routine }] : []),
      ],
    },
  };
}

export function applyProfileVoiceCorrection(
  draft: ProfileVoiceDraft,
  command: ProfileVoiceCommand,
): ProfileVoiceDraft | null {
  if (command.kind === "try-again" || command.kind === "skip") return null;
  if (command.kind !== "remove" || !command.target) return draft;

  const target = command.target.toLowerCase();
  const rows = draft.rows.filter((row) => !row.value.toLowerCase().includes(target));
  if (rows.length === 0) return null;

  return {
    ...draft,
    rows,
    values: rows.map((row) => row.value),
  };
}
