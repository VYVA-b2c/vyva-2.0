export type ProfileVoiceSection =
  | "basics"
  | "address"
  | "health"
  | "medications"
  | "allergies"
  | "emergency"
  | "providers"
  | "devices"
  | "diet"
  | "hobbies"
  | "cognitive";

export type ProfileVoiceDraftKind =
  | "basics"
  | "address"
  | "health-conditions"
  | "medications"
  | "allergies"
  | "emergency-contact"
  | "provider"
  | "devices"
  | "diet"
  | "hobbies"
  | "cognitive";

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
  metadata?: Record<string, string>;
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

function cleanDisplayValue(value: string | undefined | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function titleCaseName(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function firstRegexMatch(transcript: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    const value = cleanDisplayValue(match?.[1]);
    if (value) return value;
  }
  return "";
}

function findEmail(transcript: string) {
  return cleanDisplayValue(transcript.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]);
}

function findPhone(transcript: string) {
  return cleanDisplayValue(
    transcript.match(/(?:\+?\d[\d\s().-]{6,}\d)/)?.[0],
  );
}

function rowFromMetadata(
  id: string,
  label: string,
  metadata: Record<string, string>,
  helper?: string,
): ProfileVoiceDraftRow | null {
  const value = cleanDisplayValue(metadata[id]);
  return value ? { id, label, value, helper } : null;
}

function rowsFromMetadata(
  metadata: Record<string, string>,
  rowDefinitions: Array<{ id: string; label: string; helper?: string }>,
) {
  return rowDefinitions
    .map((row) => rowFromMetadata(row.id, row.label, metadata, row.helper))
    .filter(Boolean) as ProfileVoiceDraftRow[];
}

export function createBasicsVoiceDraft(transcript: string): ProfileVoiceDraft | null {
  const email = findEmail(transcript);
  const phone = findPhone(transcript);
  const name = firstRegexMatch(transcript, [
    /\b(?:my name is|i am|i'm)\s+([a-z][a-z\s'-]{1,60}?)(?=\s+(?:and|email|phone|number|born|dob)\b|$)/i,
    /\b(?:full name is|legal name is)\s+([a-z][a-z\s'-]{1,60}?)(?=\s+(?:and|email|phone|number|born|dob)\b|$)/i,
  ]);
  const preferredName = firstRegexMatch(transcript, [
    /\b(?:call me|preferred name is|i go by)\s+([a-z][a-z\s'-]{1,40}?)(?=\s+(?:and|email|phone|number)\b|$)/i,
  ]);

  const metadata: Record<string, string> = {
    ...(name ? { fullName: titleCaseName(name) } : {}),
    ...(preferredName ? { preferredName: titleCaseName(preferredName) } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phoneLocal: phone } : {}),
  };
  const rows = rowsFromMetadata(metadata, [
    { id: "fullName", label: "Full name" },
    { id: "preferredName", label: "Preferred name" },
    { id: "email", label: "Email" },
    { id: "phoneLocal", label: "Phone" },
  ]);
  if (rows.length === 0) return null;

  return {
    id: `basics:${rows.map((row) => row.value).join("|").toLowerCase()}`,
    section: "basics",
    kind: "basics",
    title: "Review your basics",
    helper: "VYVA found these details from what you said. Add them only if they look right.",
    values: rows.map((row) => row.value),
    rows,
    metadata,
  };
}

export interface AddressVoiceDraftValue {
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  region?: string;
  postcode?: string;
  country?: string;
}

export function createAddressVoiceDraft(valuesOrTranscript: AddressVoiceDraftValue | string): ProfileVoiceDraft | null {
  const metadata: Record<string, string> =
    typeof valuesOrTranscript === "string"
      ? {
          address_line_1: cleanDisplayValue(valuesOrTranscript),
        }
      : {
          address_line_1: cleanDisplayValue(valuesOrTranscript.address_line_1),
          address_line_2: cleanDisplayValue(valuesOrTranscript.address_line_2),
          city: cleanDisplayValue(valuesOrTranscript.city),
          region: cleanDisplayValue(valuesOrTranscript.region),
          postcode: cleanDisplayValue(valuesOrTranscript.postcode),
          country: cleanDisplayValue(valuesOrTranscript.country),
        };
  Object.keys(metadata).forEach((key) => {
    if (!metadata[key]) delete metadata[key];
  });

  const rows = rowsFromMetadata(metadata, [
    { id: "address_line_1", label: "Street address" },
    { id: "address_line_2", label: "Floor / apartment" },
    { id: "city", label: "City / Town" },
    { id: "postcode", label: "Postcode" },
    { id: "region", label: "Region / Province" },
    { id: "country", label: "Country" },
  ]);
  if (rows.length === 0) return null;

  return {
    id: `address:${rows.map((row) => row.value).join("|").toLowerCase()}`,
    section: "address",
    kind: "address",
    title: "Review home address",
    helper: "VYVA found this address. Add it only if it looks right.",
    values: rows.map((row) => row.value),
    rows,
    metadata,
  };
}

export function createEmergencyVoiceDraft(transcript: string): ProfileVoiceDraft | null {
  const phone = findPhone(transcript);
  const name = firstRegexMatch(transcript, [
    /\b(?:emergency contact is|contact is|person is|call)\s+([a-z][a-z\s'-]{1,60}?)(?=\s+(?:and|phone|number|who|relationship|my)\b|$)/i,
  ]);
  const relationship = firstRegexMatch(transcript, [
    /\b(?:my|they are my|relationship is)\s+(daughter|son|wife|husband|partner|neighbour|neighbor|carer|caregiver|friend|sister|brother|mother|father)\b/i,
  ]);
  const address = firstRegexMatch(transcript, [
    /\b(?:address is|lives at|they live at)\s+(.{4,90})$/i,
  ]);

  const metadata: Record<string, string> = {
    ...(name ? { name: titleCaseName(name) } : {}),
    ...(relationship ? { relationship: titleCaseName(relationship) } : {}),
    ...(phone ? { primary_phone: phone } : {}),
    ...(address ? { address: cleanDisplayValue(address) } : {}),
  };
  const rows = rowsFromMetadata(metadata, [
    { id: "name", label: "Full name" },
    { id: "relationship", label: "Relationship" },
    { id: "primary_phone", label: "Primary phone" },
    { id: "address", label: "Address" },
  ]);
  if (rows.length === 0) return null;

  return {
    id: `emergency:${rows.map((row) => row.value).join("|").toLowerCase()}`,
    section: "emergency",
    kind: "emergency-contact",
    title: "Review emergency contact",
    helper: "VYVA found these contact details. Add them only if they look right.",
    values: rows.map((row) => row.value),
    rows,
    metadata,
  };
}

export function createProviderVoiceDraft(transcript: string): ProfileVoiceDraft | null {
  const email = findEmail(transcript);
  const phone = findPhone(transcript);
  const name = firstRegexMatch(transcript, [
    /\b(?:provider is|provider name is|add provider|doctor is|pharmacy is|clinic is|contact is)\s+([a-z0-9][a-z0-9\s'&.-]{1,80}?)(?=\s+(?:and|phone|email|address|at|in)\b|$)/i,
  ]);
  const address = firstRegexMatch(transcript, [
    /\b(?:address is|located at|at)\s+(.{4,100}?)(?=\s+(?:and|phone|email)\b|$)/i,
  ]);

  const metadata: Record<string, string> = {
    ...(name ? { name: titleCaseName(name) } : {}),
    ...(address ? { address } : {}),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
  };
  const rows = rowsFromMetadata(metadata, [
    { id: "name", label: "Provider" },
    { id: "address", label: "Address" },
    { id: "phone", label: "Phone" },
    { id: "email", label: "Email" },
  ]);
  if (rows.length === 0) return null;

  return {
    id: `providers:${rows.map((row) => row.value).join("|").toLowerCase()}`,
    section: "providers",
    kind: "provider",
    title: "Review provider",
    helper: "VYVA found these provider details. Add them only if they look right.",
    values: rows.map((row) => row.value),
    rows,
    metadata,
  };
}

export function createSimpleChoiceVoiceDraft({
  section,
  kind,
  title,
  helper,
  label,
  values,
  metadata,
}: {
  section: ProfileVoiceSection;
  kind: ProfileVoiceDraftKind;
  title: string;
  helper: string;
  label: string;
  values: string[];
  metadata?: Record<string, string>;
}): ProfileVoiceDraft | null {
  const uniqueValues = unique(values.map(cleanDisplayValue).filter(Boolean));
  if (uniqueValues.length === 0 && !metadata) return null;
  return {
    id: `${section}:${uniqueValues.join("|").toLowerCase() || JSON.stringify(metadata)}`,
    section,
    kind,
    title,
    helper,
    values: uniqueValues,
    rows: uniqueValues.map((value) => ({
      id: value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      label,
      value,
    })),
    metadata,
  };
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

  if (section === "basics") {
    const draft = createBasicsVoiceDraft(transcript);
    return draft ? { type: "draft", draft } : { type: "empty", section, reason: "No basic details recognised" };
  }

  if (section === "address") {
    const draft = createAddressVoiceDraft(transcript);
    return draft ? { type: "draft", draft } : { type: "empty", section, reason: "No address recognised" };
  }

  if (section === "emergency") {
    const draft = createEmergencyVoiceDraft(transcript);
    return draft ? { type: "draft", draft } : { type: "empty", section, reason: "No emergency contact recognised" };
  }

  if (section === "providers") {
    const draft = createProviderVoiceDraft(transcript);
    return draft ? { type: "draft", draft } : { type: "empty", section, reason: "No provider recognised" };
  }

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
    metadata: draft.metadata
      ? Object.fromEntries(
          Object.entries(draft.metadata).filter(([key]) =>
            rows.some((row) => row.id === key),
          ),
        )
      : undefined,
  };
}
