import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Check, Clock, AlertCircle, Link as LinkIcon, Mic, Leaf, ShoppingCart, Sparkles, Pencil, Trash2, Square, Loader2, ShieldCheck, ChevronRight, FileText, Download, Phone, Store, Footprints, Pill, Plus, type LucideIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import type { MedicationForForm } from "@/components/VoiceMedsModal";
import MedsAssistantSheet from "@/components/MedsAssistantSheet";
import {
  PurpleModal,
  ResponsiveGrid,
  SectionTitle,
  VYVA_MODAL_PRIMARY_ACTION_CLASS,
  VYVA_MODAL_SECONDARY_ACTION_CLASS,
} from "@/components/vyva-ui";
import { useToast } from "@/hooks/use-toast";
import { useVoiceActionFulfillment } from "@/hooks/useVoiceActionFulfillment";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import {
  medicationListSummary,
  medicationRefillShoppingState,
} from "@/lib/medicationServiceActions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MEDS_FAST_HELP_VISIBLE_COUNT = 3;
const MEDS_FAST_HELP_ROTATION_MS = 9000;

// ─── Unified medication shape ────────────────────────────────────────────────
// Normalises both DB rows and static mock entries into one type so the
// rest of the component never cares where the data came from.
type DisplayMed = {
  id: string;           // unique key (DB uuid or mock name key)
  displayName: string;  // localised / raw name to show in the UI
  displayNote: string;  // dosage + frequency or schedule note
  takenCountToday: number; // number of confirmed doses already recorded today
  scheduledCountToday: number; // number of doses expected today
  nameForApi: string;   // canonical English name sent to /confirm
  scheduledTimeForApi: string; // first scheduled time or "anytime"
  rawDosage: string;    // original dosage from DB, used to seed the edit form
  rawFrequency: string; // original frequency from DB, used to seed the edit form
};

type DbMed = {
  id: string;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  scheduled_times: string[];
  takenToday: boolean;
  takenCountToday: number;
  scheduledCountToday: number;
};

type TodayResponse = { medications: DbMed[] };

type PersonalisationResponse = {
  conditions?: string[];
  hobbies?: string[];
  hasMedications?: boolean;
};

type SavedProvider = {
  name?: string;
  role?: string;
  phone?: string;
  address?: string;
  contact_name?: string;
  contact_phone?: string;
  online_order_url?: string;
  website_uri?: string;
  opening_hours?: string[];
  notes?: string;
};

type SavedProfileCondition = {
  name?: string;
  category?: string;
};

type SavedProfileMedication = {
  name?: string;
  medication_name?: string;
  dosage?: string;
  frequency?: string;
  times?: string;
};

type OnboardingStateResponse = {
  profile?: {
    conditions?: SavedProfileCondition[];
    medications?: SavedProfileMedication[];
    mobility_level?: string | null;
    living_situation?: string | null;
    data_sharing_consent?: {
      conditions?: {
        health_conditions?: string[];
        mobility_level?: string | null;
        living_situation?: string | null;
      };
      diet?: {
        dietary_preferences?: string[];
        dietary_notes?: string;
      };
      hobbies?: {
        hobbies?: string[];
      };
      providers?: {
        providers?: SavedProvider[];
      };
    };
  } | null;
};

type MedicationSafetySeverity = "watch" | "attention" | "urgent";
type MedicationSafetySignalType = "missed_dose_pattern" | "possible_side_effect" | "interaction_question" | "vitals_overlap" | "symptom_followup";
type MedicationSafetyCaseStatus = "draft" | "needs_review" | "shared" | "closed" | "dismissed";

type MedicationSafetySignal = {
  id?: string;
  signal_type: MedicationSafetySignalType;
  severity: MedicationSafetySeverity;
  title: string;
  summary: string;
  medication_name?: string | null;
  source?: string | null;
  evidence?: Array<Record<string, unknown>>;
  status?: string | null;
  detected_at?: string | null;
};

type MedicationSafetyCase = {
  id: string;
  status: MedicationSafetyCaseStatus;
  severity: MedicationSafetySeverity;
  signal_type: MedicationSafetySignalType;
  suspected_medication?: string | null;
  reaction?: string | null;
  reaction_started_at?: string | null;
  seriousness_flags?: string[];
  outcome?: string | null;
  action_taken?: string | null;
  reporter_name?: string | null;
  reporter_contact?: string | null;
  reporter_role?: string | null;
  narrative?: string | null;
  evidence?: Array<Record<string, unknown>>;
  missing_fields?: string[];
  export_ready?: boolean;
  updated_at?: string | null;
};

type MedicationSafetyResponse = {
  summary: {
    status: "steady" | "watch" | "needs_review";
    severity: MedicationSafetySeverity;
    title: string;
    message: string;
    signalCount: number;
    openCaseCount: number;
    lastAnalysedAt?: string | null;
  };
  signalCandidates: MedicationSafetySignal[];
  signals: MedicationSafetySignal[];
  openCases: MedicationSafetyCase[];
  exportAvailability: {
    canExport: boolean;
    readyCount: number;
    needsReviewCount: number;
  };
};

type MedicationSafetyCaseForm = {
  status: MedicationSafetyCaseStatus;
  severity: MedicationSafetySeverity;
  signal_type: MedicationSafetySignalType;
  suspected_medication: string;
  reaction: string;
  reaction_started_at: string;
  seriousness_flags: string[];
  outcome: string;
  action_taken: string;
  reporter_name: string;
  reporter_contact: string;
  reporter_role: string;
  narrative: string;
};

type DashboardTip = {
  text: string;
  context: string;
};

type DashboardProfileSignals = {
  conditions: string[];
  medications: string[];
  mobilityLevel: string;
  livingSituation: string;
  hobbies: string[];
  dietaryPreferences: string[];
};

export {
  medicationDoctorActionKinds,
  medicationDoctorContext,
  medicationListSummary,
  medicationRefillShoppingState,
  medicationReviewAppointmentState,
  medicationReviewRideState,
} from "@/lib/medicationServiceActions";

function normalizeVoiceFocus(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

type MedicationVoiceCaptureState = "idle" | "recording" | "transcribing";
const MEDICATION_VOICE_CAPTURE_MAX_MS = 30_000;

const medicationVoiceMimeCandidates = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function preferredMedicationVoiceMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return medicationVoiceMimeCandidates.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  }) ?? "";
}

function stopMedicationVoiceStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

const SERIOUSNESS_OPTIONS = [
  { value: "hospitalization", label: "Hospitalization" },
  { value: "life_threatening", label: "Life threatening" },
  { value: "disability", label: "Disability" },
  { value: "birth_defect", label: "Birth defect" },
  { value: "death", label: "Death" },
  { value: "other_medically_important", label: "Other medically important" },
];

function emptySafetyCaseForm(prefillMedication = ""): MedicationSafetyCaseForm {
  return {
    status: "draft",
    severity: "attention",
    signal_type: "possible_side_effect",
    suspected_medication: prefillMedication,
    reaction: "",
    reaction_started_at: "",
    seriousness_flags: [],
    outcome: "",
    action_taken: "",
    reporter_name: "",
    reporter_contact: "",
    reporter_role: "patient_or_caregiver",
    narrative: "",
  };
}

function dateInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formFromSafetyCase(safetyCase: MedicationSafetyCase): MedicationSafetyCaseForm {
  return {
    status: safetyCase.status ?? "draft",
    severity: safetyCase.severity ?? "watch",
    signal_type: safetyCase.signal_type ?? "possible_side_effect",
    suspected_medication: safetyCase.suspected_medication ?? "",
    reaction: safetyCase.reaction ?? "",
    reaction_started_at: dateInputValue(safetyCase.reaction_started_at),
    seriousness_flags: safetyCase.seriousness_flags ?? [],
    outcome: safetyCase.outcome ?? "",
    action_taken: safetyCase.action_taken ?? "",
    reporter_name: safetyCase.reporter_name ?? "",
    reporter_contact: safetyCase.reporter_contact ?? "",
    reporter_role: safetyCase.reporter_role ?? "patient_or_caregiver",
    narrative: safetyCase.narrative ?? "",
  };
}

function safetyTone(severity?: MedicationSafetySeverity | string | null) {
  if (severity === "urgent") return { bg: "#FEF2F2", color: "#B91C1C", border: "#FCA5A5" };
  if (severity === "attention") return { bg: "#FEF3C7", color: "#92400E", border: "#FCD34D" };
  return { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" };
}

function signalTypeLabel(type: MedicationSafetySignalType | string) {
  return type.replace(/_/g, " ");
}

function normalizeDashboardText(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasAnyDashboardTerm(haystack: string, terms: string[]) {
  return terms.some((term) => haystack.includes(term));
}

function cleanDashboardList(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = normalizeDashboardText([trimmed]);
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(trimmed);
  }

  return cleaned;
}

function profileContextLabel(t: (key: string, options?: Record<string, unknown>) => string, conditions: string[], fallbackKey = "meds.dashboard.tipContextProfile") {
  const visibleConditions = conditions.slice(0, 2);
  if (visibleConditions.length > 0) {
    return t("meds.dashboard.tipContextConditions", {
      conditions: visibleConditions.join(" + "),
      defaultValue: "Based on {{conditions}}",
    });
  }

  return t(fallbackKey, { defaultValue: "Based on your saved profile" });
}

function buildDashboardHealthTip(
  signals: DashboardProfileSignals,
  t: (key: string, options?: Record<string, unknown>) => string,
): DashboardTip {
  const conditionText = normalizeDashboardText(signals.conditions);
  const medicationText = normalizeDashboardText(signals.medications);
  const hasDiabetes = hasAnyDashboardTerm(conditionText, ["diabetes"]) || hasAnyDashboardTerm(medicationText, ["metformin", "insulin"]);
  const hasBloodPressure = hasAnyDashboardTerm(conditionText, ["hypertension", "blood pressure", "high blood pressure"]) ||
    hasAnyDashboardTerm(medicationText, ["atenolol", "amlodipine", "lisinopril", "losartan", "ramipril", "bisoprolol"]);
  const hasBloodThinner = hasAnyDashboardTerm(medicationText, ["warfarin", "apixaban", "rivaroxaban", "edoxaban", "dabigatran", "clopidogrel", "aspirin"]);
  const hasRespiratory = hasAnyDashboardTerm(conditionText, ["asthma", "copd", "bronchitis", "breathless"]) ||
    hasAnyDashboardTerm(medicationText, ["salbutamol", "ventolin", "inhaler", "tiotropium", "fostair", "symbicort"]);
  const hasStatin = hasAnyDashboardTerm(medicationText, ["atorvastatin", "simvastatin", "rosuvastatin", "pravastatin"]);
  const context = profileContextLabel(t, signals.conditions);

  if (hasDiabetes && hasBloodPressure) {
    return {
      context,
      text: t("meds.dashboard.healthTipDiabetesBloodPressure", {
        conditions: signals.conditions.slice(0, 2).join(" + ") || "diabetes + blood pressure",
        defaultValue: "Diabetes + blood pressure: meals, stand slowly.",
      }),
    };
  }

  if (hasDiabetes) {
    return {
      context,
      text: t("meds.dashboard.healthTipDiabetes", {
        defaultValue: "Diabetes: pair checks with meals.",
      }),
    };
  }

  if (hasBloodPressure) {
    return {
      context,
      text: t("meds.dashboard.healthTipBloodPressure", {
        defaultValue: "Blood pressure: stand up slowly.",
      }),
    };
  }

  if (hasBloodThinner) {
    return {
      context: t("meds.dashboard.tipContextMedicines", { defaultValue: "Based on current medicines" }),
      text: t("meds.dashboard.healthTipBloodThinner", {
        defaultValue: "Blood thinner: watch unusual bruising.",
      }),
    };
  }

  if (hasRespiratory) {
    return {
      context,
      text: t("meds.dashboard.healthTipRespiratory", {
        defaultValue: "Breathing: keep inhaler close.",
      }),
    };
  }

  if (hasStatin) {
    return {
      context: t("meds.dashboard.tipContextMedicines", { defaultValue: "Based on current medicines" }),
      text: t("meds.dashboard.healthTipStatin", {
        defaultValue: "Cholesterol med: note muscle pain.",
      }),
    };
  }

  if (signals.conditions.length > 0) {
    return {
      context,
      text: t("meds.dashboard.healthTipConditionFallback", {
        conditions: signals.conditions.slice(0, 2).join(" + "),
        defaultValue: "{{conditions}}: note how you feel.",
      }),
    };
  }

  return {
    context: t("meds.dashboard.tipContextRoutine", { defaultValue: "Based on today's medicine routine" }),
    text: t("meds.dashboard.healthTipGeneric", {
      defaultValue: "Keep your usual medicine routine.",
    }),
  };
}

function buildDashboardExerciseTip(
  signals: DashboardProfileSignals,
  t: (key: string, options?: Record<string, unknown>) => string,
): DashboardTip {
  const conditionText = normalizeDashboardText(signals.conditions);
  const medicationText = normalizeDashboardText(signals.medications);
  const mobilityText = normalizeDashboardText([signals.mobilityLevel, signals.livingSituation]);
  const hobbyText = normalizeDashboardText(signals.hobbies);
  const hasDiabetes = hasAnyDashboardTerm(conditionText, ["diabetes"]) || hasAnyDashboardTerm(medicationText, ["metformin", "insulin"]);
  const hasBloodPressure = hasAnyDashboardTerm(conditionText, ["hypertension", "blood pressure", "high blood pressure"]) ||
    hasAnyDashboardTerm(medicationText, ["atenolol", "amlodipine", "lisinopril", "losartan", "ramipril", "bisoprolol"]);
  const hasMobilityNeed = hasAnyDashboardTerm(conditionText, ["arthritis", "osteoporosis", "fall", "mobility", "frailty", "parkinson"]) ||
    hasAnyDashboardTerm(mobilityText, ["limited", "reduced", "wheelchair", "walker", "stick", "cane", "fall", "unsteady", "slow"]);
  const hasRespiratory = hasAnyDashboardTerm(conditionText, ["asthma", "copd", "bronchitis", "breathless"]) ||
    hasAnyDashboardTerm(medicationText, ["salbutamol", "ventolin", "inhaler", "tiotropium", "fostair", "symbicort"]);

  if (hasMobilityNeed) {
    return {
      context: t("meds.dashboard.tipContextMobility", { defaultValue: "Based on mobility level" }),
      text: t("meds.dashboard.exerciseTipMobility", {
        defaultValue: "Move: seated ankle circles.",
      }),
    };
  }

  if (hasDiabetes && hasBloodPressure) {
    return {
      context: profileContextLabel(t, signals.conditions),
      text: t("meds.dashboard.exerciseTipDiabetesBloodPressure", {
        defaultValue: "Move: 5 easy minutes after a meal.",
      }),
    };
  }

  if (hasDiabetes) {
    return {
      context: profileContextLabel(t, signals.conditions),
      text: t("meds.dashboard.exerciseTipDiabetes", {
        defaultValue: "Move: gentle walk after a meal.",
      }),
    };
  }

  if (hasBloodPressure) {
    return {
      context: profileContextLabel(t, signals.conditions),
      text: t("meds.dashboard.exerciseTipBloodPressure", {
        defaultValue: "Move: steady walk or chair march.",
      }),
    };
  }

  if (hasRespiratory) {
    return {
      context: profileContextLabel(t, signals.conditions),
      text: t("meds.dashboard.exerciseTipRespiratory", {
        defaultValue: "Move: slow walk with breathing pauses.",
      }),
    };
  }

  if (hasAnyDashboardTerm(hobbyText, ["garden", "gardening", "plants"])) {
    return {
      context: t("meds.dashboard.tipContextHobby", { defaultValue: "Based on saved hobbies" }),
      text: t("meds.dashboard.exerciseTipGardening", {
        defaultValue: "Move: water plants or garden walk.",
      }),
    };
  }

  return {
    context: t("meds.dashboard.tipContextProfile", { defaultValue: "Based on your saved profile" }),
    text: t("meds.dashboard.exerciseTipGeneric", {
      defaultValue: "Move: gentle walk or seated movement.",
    }),
  };
}

function isPharmacyProvider(provider: SavedProvider) {
  return hasAnyDashboardTerm(
    normalizeDashboardText([provider.role, provider.name, provider.notes]),
    ["pharmacy", "farmacia", "drugstore", "chemist"],
  );
}

function providerPhone(provider?: SavedProvider | null) {
  return provider?.contact_phone?.trim() || provider?.phone?.trim() || "";
}

function formatProviderPhoneHref(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}

const MedsScreen = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ─── Load today's medications from the DB ──────────────────────────────────
  const { data: todayData, isLoading: todayLoading } = useQuery<TodayResponse>({
    queryKey: ["/api/meds/adherence-report/today"],
  });
  const { data: personalisationData } = useQuery<PersonalisationResponse>({
    queryKey: ["/api/profile/personalisation"],
    retry: false,
    staleTime: 10 * 60 * 1000,
  });
  const { data: onboardingState } = useQuery<OnboardingStateResponse>({
    queryKey: ["/api/onboarding/state"],
    retry: false,
    staleTime: 10 * 60 * 1000,
  });

  const displayMeds: DisplayMed[] = (() => {
    if (todayData && todayData.medications.length > 0) {
      return todayData.medications.map((m) => ({
        id: m.id,
        displayName: m.medication_name,
        displayNote: [m.dosage, m.frequency?.replace("_", " ")].filter(Boolean).join(" - "),
        takenCountToday: m.takenCountToday,
        scheduledCountToday: m.scheduledCountToday,
        nameForApi: m.medication_name,
        scheduledTimeForApi: m.scheduled_times?.[0] ?? "anytime",
        rawDosage: m.dosage ?? "",
        rawFrequency: m.frequency ?? "",
      }));
    }
    // No medications from DB yet: return empty list so the UI shows an empty state.
    return [];
  })();
  const { action: voiceAction, payloadValue: voicePayloadValue } = useVoiceActionFulfillment({
    domain: "meds",
    actionTypes: ["meds.management", "meds.refill_request"],
  });
  const focusedMedicationName = voicePayloadValue("medication_name") || voiceAction?.extractedSubject || "";
  const focusedMedicationKey = normalizeVoiceFocus(focusedMedicationName);
  const focusedMedication = focusedMedicationKey
    ? displayMeds.find((med) => normalizeVoiceFocus(med.displayName).includes(focusedMedicationKey))
    : null;

  const medNames = (() => {
    const names = displayMeds.map((m) => m.displayName);
    try {
      return new Intl.ListFormat(language, { style: "long", type: "conjunction" }).format(names);
    } catch {
      return names.join(", ");
    }
  })();
  const medicationSummary = medicationListSummary(
    displayMeds.map((m) => m.displayName),
    t("meds.medicationSummaryFallback", "my medications"),
  );

  const [confirmedDoseCounts, setConfirmedDoseCounts] = useState<Map<string, number>>(new Map());
  const [voiceAddedMeds, setVoiceAddedMeds] = useState<MedicationForForm[]>([]);
  const [medicationVoiceState, setMedicationVoiceState] = useState<MedicationVoiceCaptureState>("idle");
  const [medicationVoiceError, setMedicationVoiceError] = useState<string | null>(null);
  const medicationRecorderRef = useRef<MediaRecorder | null>(null);
  const medicationVoiceStreamRef = useRef<MediaStream | null>(null);
  const medicationVoiceChunksRef = useRef<Blob[]>([]);
  const medicationVoiceStopTimerRef = useRef<number | null>(null);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [caseSheetOpen, setCaseSheetOpen] = useState(false);
  const [reviewCase, setReviewCase] = useState<MedicationSafetyCase | null>(null);
  const [caseForm, setCaseForm] = useState<MedicationSafetyCaseForm>(() => emptySafetyCaseForm());
  const [caseExportText, setCaseExportText] = useState("");

  const { data: safetyData, isLoading: safetyLoading, isError: safetyError } = useQuery<MedicationSafetyResponse>({
    queryKey: ["/api/meds/safety"],
    enabled: safetyOpen,
  });

  // ─── Edit / Delete state ───────────────────────────────────────────────────
  const [editMed, setEditMed] = useState<DisplayMed | null>(null);
  const [editName, setEditName] = useState("");
  const [editDosage, setEditDosage] = useState("");
  const [editFrequency, setEditFrequency] = useState("");
  const [deleteMed, setDeleteMed] = useState<DisplayMed | null>(null);

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, dosage, frequency }: { id: string; name: string; dosage: string; frequency: string }) => {
      const res = await apiFetch(`/api/meds/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ medication_name: name, dosage, frequency }),
      });
      if (!res.ok) throw new Error("Failed to update medication");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report"] });
      setEditMed(null);
      toast({ title: t("meds.editSuccess", "Medication updated") });
    },
    onError: () => {
      toast({ title: t("meds.editError", "Could not update medication"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`/api/meds/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove medication");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report"] });
      setDeleteMed(null);
      toast({ title: t("meds.deleteSuccess", "Medication removed") });
    },
    onError: () => {
      toast({ title: t("meds.deleteError", "Could not remove medication"), variant: "destructive" });
    },
  });

  const analyseSafetyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/meds/safety/analyse", { method: "POST" });
      if (!res.ok) throw new Error("Failed to analyse medication safety");
      return res.json() as Promise<MedicationSafetyResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meds/safety"] });
      toast({ title: t("meds.safety.analyseSuccess", "Medication safety signals updated") });
    },
    onError: () => {
      toast({ title: t("meds.safety.analyseError", "Could not analyse medication safety"), variant: "destructive" });
    },
  });

  const saveSafetyCaseMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...caseForm,
        suspected_medication: caseForm.suspected_medication.trim() || null,
        reaction: caseForm.reaction.trim() || null,
        reaction_started_at: caseForm.reaction_started_at || null,
        outcome: caseForm.outcome.trim() || null,
        action_taken: caseForm.action_taken.trim() || null,
        reporter_name: caseForm.reporter_name.trim() || null,
        reporter_contact: caseForm.reporter_contact.trim() || null,
        reporter_role: caseForm.reporter_role.trim() || "patient_or_caregiver",
        narrative: caseForm.narrative.trim() || null,
      };
      const endpoint = reviewCase?.id
        ? `/api/meds/safety/cases/${reviewCase.id}`
        : "/api/meds/safety/cases";
      const res = await apiFetch(endpoint, {
        method: reviewCase?.id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save medication safety case");
      return res.json() as Promise<{ case: MedicationSafetyCase; sent_to?: string[] }>;
    },
    onSuccess: (data) => {
      setReviewCase(data.case);
      setCaseForm(formFromSafetyCase(data.case));
      setCaseExportText("");
      queryClient.invalidateQueries({ queryKey: ["/api/meds/safety"] });
      toast({
        title: data.sent_to?.length
          ? t("meds.safety.sharedSuccess", "Case shared with caregiver")
          : t("meds.safety.saveSuccess", "Safety case saved"),
      });
    },
    onError: () => {
      toast({ title: t("meds.safety.saveError", "Could not save safety case"), variant: "destructive" });
    },
  });

  const exportSafetyCaseMutation = useMutation({
    mutationFn: async (caseId: string) => {
      const res = await apiFetch(`/api/meds/safety/cases/${caseId}/export`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to export medication safety case");
      return res.json() as Promise<{
        case: MedicationSafetyCase;
        export: { human_readable_text: string; export_ready: boolean; missing_fields: string[] };
      }>;
    },
    onSuccess: (data) => {
      setReviewCase(data.case);
      setCaseForm(formFromSafetyCase(data.case));
      setCaseExportText(data.export.human_readable_text);
      queryClient.invalidateQueries({ queryKey: ["/api/meds/safety"] });
      toast({ title: t("meds.safety.exportSuccess", "Audit-ready packet created") });
    },
    onError: () => {
      toast({ title: t("meds.safety.exportError", "Could not export safety case"), variant: "destructive" });
    },
  });

  function openEditMed(med: DisplayMed) {
    setEditMed(med);
    setEditName(med.displayName);
    setEditDosage(med.rawDosage);
    setEditFrequency(med.rawFrequency);
  }

  const confirmMutation = useMutation({
    mutationFn: async (med: DisplayMed) => {
      const res = await apiFetch("/api/meds/adherence-report/confirm", {
        method: "POST",
        body: JSON.stringify({
          medication_name: med.nameForApi,
          scheduled_time: med.scheduledTimeForApi,
        }),
      });
      if (!res.ok) {
        const error = new Error("Failed to confirm dose") as Error & { status?: number };
        error.status = res.status;
        throw error;
      }
      return res.json();
    },
    onSuccess: (_data, med) => {
      setConfirmedDoseCounts((prev) => {
        const next = new Map(prev);
        next.set(med.id, (next.get(med.id) ?? 0) + 1);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report/today"] });
      toast({ title: t("meds.taken"), description: med.displayName });
    },
    onError: (error) => {
      const err = error as Error & { status?: number };
      if (err.status === 409) {
        queryClient.invalidateQueries({ queryKey: ["/api/meds/adherence-report/today"] });
        toast({ title: t("meds.taken"), description: t("meds.allTaken") });
        return;
      }
      toast({ title: "Could not confirm dose", variant: "destructive" });
    },
  });

  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantTitle, setAssistantTitle] = useState("");
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [medsFastHelpIndex, setMedsFastHelpIndex] = useState(0);

  useEffect(() => {
    setConfirmedDoseCounts(new Map());
  }, [todayData]);

  const effectiveTakenCount = (med: DisplayMed) =>
    Math.min(
      med.scheduledCountToday,
      med.takenCountToday + (confirmedDoseCounts.get(med.id) ?? 0)
    );

  const remainingDoseCount = (med: DisplayMed) =>
    Math.max(0, med.scheduledCountToday - effectiveTakenCount(med));

  const isMedTaken = (med: DisplayMed) =>
    remainingDoseCount(med) === 0;

  const voiceActionHighlights = [
    ...(focusedMedicationName
      ? [{ label: t("meds.focusLabels.medication", "Medication"), value: focusedMedicationName, tone: focusedMedication ? "good" as const : "warning" as const }]
      : []),
    ...(focusedMedication
      ? [{ label: t("meds.focusLabels.today", "Today"), value: isMedTaken(focusedMedication) ? t("meds.focusAlreadyTaken", "Already taken") : t("meds.focusLeft", { count: remainingDoseCount(focusedMedication) }), tone: isMedTaken(focusedMedication) ? "good" as const : "warning" as const }]
      : []),
  ];
  const voiceRoutineFocus = voicePayloadValue("routine_focus");
  const voiceDoseTime = voicePayloadValue("dose_time");
  const focusedMedicationStatus = focusedMedication
    ? isMedTaken(focusedMedication)
      ? t("meds.focusStatusAll", "All scheduled doses taken today")
      : t("meds.focusStatusDue", { count: remainingDoseCount(focusedMedication) })
    : displayMeds.length > 0
      ? t("meds.focusStatusLoaded", { count: displayMeds.length })
      : t("meds.focusStatusEmpty", "No medication schedule loaded yet");

  const totalScheduledDoseCount = displayMeds.reduce(
    (sum, med) => sum + med.scheduledCountToday,
    0
  );
  const totalTakenDoseCount = displayMeds.reduce(
    (sum, med) => sum + effectiveTakenCount(med),
    0
  );
  const pendingMeds = displayMeds.filter((med) => !isMedTaken(med));
  const totalRemainingDoseCount = pendingMeds.reduce(
    (sum, med) => sum + remainingDoseCount(med),
    0
  );
  const progressPercent = totalScheduledDoseCount > 0 ? (totalTakenDoseCount / totalScheduledDoseCount) * 100 : 0;
  const progressPercentRounded = Math.round(progressPercent);
  const nextMedication = pendingMeds[0] ?? null;
  const savedProviders = onboardingState?.profile?.data_sharing_consent?.providers?.providers ?? [];
  const pharmacyProvider = useMemo(
    () => savedProviders.find(isPharmacyProvider) ?? null,
    [savedProviders],
  );
  const pharmacyPhone = providerPhone(pharmacyProvider);
  const pharmacyPhoneHref = formatProviderPhoneHref(pharmacyPhone);
  const profileConditions = cleanDashboardList([
    ...(personalisationData?.conditions ?? []),
    ...(onboardingState?.profile?.conditions?.map((condition) => condition.name) ?? []),
    ...(onboardingState?.profile?.data_sharing_consent?.conditions?.health_conditions ?? []),
  ]);
  const profileMedications = cleanDashboardList([
    ...displayMeds.map((med) => med.displayName),
    ...(onboardingState?.profile?.medications?.map((med) => med.name ?? med.medication_name) ?? []),
  ]);
  const profileHobbies = cleanDashboardList([
    ...(personalisationData?.hobbies ?? []),
    ...(onboardingState?.profile?.data_sharing_consent?.hobbies?.hobbies ?? []),
  ]);
  const profileDietaryPreferences = cleanDashboardList([
    ...(onboardingState?.profile?.data_sharing_consent?.diet?.dietary_preferences ?? []),
    onboardingState?.profile?.data_sharing_consent?.diet?.dietary_notes,
  ]);
  const dashboardProfileSignals: DashboardProfileSignals = {
    conditions: profileConditions,
    medications: profileMedications,
    mobilityLevel: onboardingState?.profile?.mobility_level ??
      onboardingState?.profile?.data_sharing_consent?.conditions?.mobility_level ??
      "",
    livingSituation: onboardingState?.profile?.living_situation ??
      onboardingState?.profile?.data_sharing_consent?.conditions?.living_situation ??
      "",
    hobbies: profileHobbies,
    dietaryPreferences: profileDietaryPreferences,
  };
  const healthTip = buildDashboardHealthTip(dashboardProfileSignals, t);
  const exerciseTip = buildDashboardExerciseTip(dashboardProfileSignals, t);

  const ASSISTANT_ACTIONS = [
    {
      id: "interactions",
      icon: LinkIcon,
      label: t("meds.assistant.interactions.label", "Check Interactions"),
      sub: t("meds.assistant.interactions.sub", "Medicine and supplement questions"),
      color: "#0F766E",
      bg: "#F0FDFA",
      border: "#99F6E4",
      shadow: "rgba(15,118,110,0.12)",
      prompt: t("meds.assistant.interactions.prompt", {
        medNames,
        defaultValue: "Check my medicines and supplements for possible interaction questions: {{medNames}}. Do not suggest dose changes; tell me what to ask my pharmacist or doctor.",
      }),
      sheetTitle: t("meds.assistant.interactions.sheetTitle", "Check Interactions"),
    },
    {
      id: "sideEffects",
      icon: ShieldCheck,
      label: t("meds.assistant.sideEffects.label", "Side Effects"),
      sub: t("meds.assistant.sideEffects.sub", "Symptoms to watch"),
      color: "#1D4ED8",
      bg: "#EFF6FF",
      border: "#BFDBFE",
      shadow: "rgba(37,99,235,0.11)",
      prompt: t("meds.assistant.sideEffects.prompt", {
        medNames,
        defaultValue: "Help me understand side effects to watch for with my current medicines: {{medNames}}. Keep it practical and tell me when to contact a pharmacist or doctor.",
      }),
      sheetTitle: t("meds.assistant.sideEffects.sheetTitle", "Side Effects"),
    },
    {
      id: "refillHelp",
      icon: ShoppingCart,
      label: t("meds.assistant.refillHelp.label", "Refill Help"),
      sub: t("meds.assistant.refillHelp.sub", "Prepare pharmacy order"),
      color: "#B45309",
      bg: "#FFF7ED",
      border: "#FED7AA",
      shadow: "rgba(180,83,9,0.10)",
      prompt: "",
      sheetTitle: "",
    },
    {
      id: "addMedicine",
      icon: Mic,
      label: t("meds.assistant.addMedicine.label", "Add Medicine"),
      sub: t("meds.assistant.addMedicine.sub", "Use voice"),
      color: "#6B21A8",
      bg: "#F5F3FF",
      border: "#DDD6FE",
      shadow: "rgba(109,40,217,0.13)",
      prompt: "",
      sheetTitle: "",
    },
    {
      id: "homeRemedies",
      icon: Leaf,
      label: t("meds.assistant.homeRemedies.label", "Home Remedies"),
      sub: t("meds.assistant.homeRemedies.sub", "Safe options to ask about"),
      color: "#166534",
      bg: "#DCFCE7",
      border: "#BDEBD8",
      shadow: "rgba(16,185,129,0.12)",
      prompt: t("meds.assistant.homeRemedies.prompt", {
        medNames,
        defaultValue: "Suggest safe home-remedy questions I can ask about alongside my medicines: {{medNames}}. Do not recommend replacing medicine or changing doses.",
      }),
      sheetTitle: t("meds.assistant.homeRemedies.sheetTitle", "Home Remedies"),
    },
    {
      id: "advances",
      icon: Sparkles,
      label: t("meds.assistant.advances.label", "Medication Research"),
      sub: t("meds.assistant.advances.sub", "See recent updates in plain language"),
      color: "#7C3AED",
      bg: "#EDE9FE",
      border: "#D9C7F8",
      shadow: "rgba(109,40,217,0.13)",
      prompt: t("meds.assistant.advances.prompt", {
        medNames,
        defaultValue: "Summarize recent medication research or practical updates relevant to these medicines in plain language: {{medNames}}. Do not give dosing advice.",
      }),
      sheetTitle: t("meds.assistant.advances.sheetTitle", "Medication Research"),
    },
  ];

  const visibleAssistantActions = ASSISTANT_ACTIONS.length <= MEDS_FAST_HELP_VISIBLE_COUNT
    ? ASSISTANT_ACTIONS
    : Array.from({ length: MEDS_FAST_HELP_VISIBLE_COUNT }, (_item, index) => (
      ASSISTANT_ACTIONS[(medsFastHelpIndex + index) % ASSISTANT_ACTIONS.length]!
    ));

  useEffect(() => {
    if (ASSISTANT_ACTIONS.length <= MEDS_FAST_HELP_VISIBLE_COUNT) return undefined;
    const timer = window.setInterval(() => {
      setMedsFastHelpIndex((current) => (current + MEDS_FAST_HELP_VISIBLE_COUNT) % ASSISTANT_ACTIONS.length);
    }, MEDS_FAST_HELP_ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [ASSISTANT_ACTIONS.length]);

  const handleAddMedication = useCallback((med: MedicationForForm) => {
    setVoiceAddedMeds(prev => [...prev, med]);
    toast({
      title: t("meds.toastAdded"),
      description: med.name
        ? t("meds.toastAddedDesc", { name: med.name })
        : t("meds.toastAddedDefault"),
    });
  }, [t, toast]);

  const clearMedicationVoiceStopTimer = useCallback(() => {
    if (medicationVoiceStopTimerRef.current !== null) {
      window.clearTimeout(medicationVoiceStopTimerRef.current);
      medicationVoiceStopTimerRef.current = null;
    }
  }, []);

  const transcribeMedicationVoiceBlob = useCallback(async (blob: Blob) => {
    if (blob.size < 32) {
      setMedicationVoiceState("idle");
      setMedicationVoiceError(t("meds.voiceEmpty", "I couldn't hear anything clearly. Please try again."));
      return;
    }

    setMedicationVoiceState("transcribing");
    try {
      const transcriptionResponse = await apiFetch(`/api/meds-voice-transcribe?language=${encodeURIComponent(language)}`, {
        method: "POST",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob,
      });

      const transcriptionPayload = await transcriptionResponse.json().catch(() => null) as { transcript?: unknown; error?: unknown } | null;
      if (!transcriptionResponse.ok) {
        const message = typeof transcriptionPayload?.error === "string"
          ? transcriptionPayload.error
          : t("meds.voiceFailed", "I couldn't turn that voice note into medication details. Please try again.");
        throw new Error(message);
      }

      const transcript = typeof transcriptionPayload?.transcript === "string" ? transcriptionPayload.transcript.trim() : "";
      if (!transcript) {
        throw new Error(t("meds.voiceEmpty", "I couldn't hear anything clearly. Please try again."));
      }

      const parseResponse = await apiFetch("/api/meds-voice-parse", {
        method: "POST",
        body: JSON.stringify({ transcript }),
      });
      const parsed = await parseResponse.json().catch(() => ({})) as {
        name?: unknown;
        dosage?: unknown;
        frequency?: unknown;
        times?: unknown;
        withFood?: unknown;
        prescribedBy?: unknown;
        error?: unknown;
      };

      if (!parseResponse.ok) {
        throw new Error(typeof parsed.error === "string" ? parsed.error : t("meds.voiceFailed", "I couldn't turn that voice note into medication details. Please try again."));
      }

      const med: MedicationForForm = {
        name: typeof parsed.name === "string" ? parsed.name : "",
        dosage: typeof parsed.dosage === "string" ? parsed.dosage : "",
        frequency: typeof parsed.frequency === "string" ? parsed.frequency : "",
        times: typeof parsed.times === "string" ? parsed.times : "",
        with_food: typeof parsed.withFood === "string" ? parsed.withFood : "",
        prescribed_by: typeof parsed.prescribedBy === "string" ? parsed.prescribedBy : "",
      };
      const hasMedicationDetail = Object.values(med).some((value) => value.trim().length > 0);
      if (!hasMedicationDetail) {
        throw new Error(t("meds.voiceNoMedication", "I couldn't find a medication in that voice note. Please try again."));
      }

      handleAddMedication(med);
      setMedicationVoiceError(null);
    } catch (err) {
      setMedicationVoiceError(err instanceof Error ? err.message : t("meds.voiceFailed", "I couldn't turn that voice note into medication details. Please try again."));
    } finally {
      setMedicationVoiceState("idle");
    }
  }, [handleAddMedication, language, t]);

  const stopMedicationVoiceCapture = useCallback(() => {
    const recorder = medicationRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const startMedicationVoiceCapture = useCallback(async () => {
    setMedicationVoiceError(null);
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMedicationVoiceError(t("meds.voiceUnsupported", "Voice input is not available in this browser."));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      medicationVoiceStreamRef.current = stream;
      medicationVoiceChunksRef.current = [];

      const mimeType = preferredMedicationVoiceMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      medicationRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) medicationVoiceChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        clearMedicationVoiceStopTimer();
        stopMedicationVoiceStream(stream);
        medicationVoiceStreamRef.current = null;
        medicationRecorderRef.current = null;
        medicationVoiceChunksRef.current = [];
        setMedicationVoiceState("idle");
        setMedicationVoiceError(t("meds.voiceMicError", "I couldn't use the microphone. Please try again."));
      };
      recorder.onstop = () => {
        clearMedicationVoiceStopTimer();
        const chunks = medicationVoiceChunksRef.current;
        const recordedType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: recordedType });
        stopMedicationVoiceStream(stream);
        medicationVoiceStreamRef.current = null;
        medicationRecorderRef.current = null;
        medicationVoiceChunksRef.current = [];
        void transcribeMedicationVoiceBlob(blob);
      };

      recorder.start();
      medicationVoiceStopTimerRef.current = window.setTimeout(() => {
        const activeRecorder = medicationRecorderRef.current;
        if (activeRecorder && activeRecorder.state !== "inactive") {
          activeRecorder.stop();
        }
      }, MEDICATION_VOICE_CAPTURE_MAX_MS);
      setMedicationVoiceState("recording");
    } catch {
      clearMedicationVoiceStopTimer();
      stopMedicationVoiceStream(medicationVoiceStreamRef.current);
      medicationVoiceStreamRef.current = null;
      medicationRecorderRef.current = null;
      setMedicationVoiceState("idle");
      setMedicationVoiceError(t("meds.voiceMicError", "I couldn't use the microphone. Please try again."));
    }
  }, [clearMedicationVoiceStopTimer, t, transcribeMedicationVoiceBlob]);

  const isRecordingMedicationVoice = medicationVoiceState === "recording";
  const isTranscribingMedicationVoice = medicationVoiceState === "transcribing";
  const toggleMedicationVoiceCapture = useCallback(() => {
    if (isTranscribingMedicationVoice) return;
    if (isRecordingMedicationVoice) {
      stopMedicationVoiceCapture();
      return;
    }
    void startMedicationVoiceCapture();
  }, [isRecordingMedicationVoice, isTranscribingMedicationVoice, startMedicationVoiceCapture, stopMedicationVoiceCapture]);

  useEffect(() => () => {
    clearMedicationVoiceStopTimer();
    const recorder = medicationRecorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
    }
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    stopMedicationVoiceStream(medicationVoiceStreamRef.current);
  }, [clearMedicationVoiceStopTimer]);

  const medicationVoiceButtonLabel = isRecordingMedicationVoice
    ? t("meds.voiceStop", "Stop voice input")
    : isTranscribingMedicationVoice
      ? t("meds.voiceTranscribing", "Turning voice into text")
      : t("meds.addByVoice");
  const medicationVoiceStatus = isRecordingMedicationVoice
    ? t("meds.voiceRecording", "Listening... tap again to stop.")
    : isTranscribingMedicationVoice
      ? t("meds.voiceTranscribingStatus", "Turning voice into medication details...")
      : medicationVoiceError;

  function openAssistant(prompt: string, title: string) {
    setAssistantPrompt(prompt);
    setAssistantTitle(title);
    setAssistantOpen(true);
  }

  function openRefillSupport() {
    navigate("/concierge/shopping", {
      state: medicationRefillShoppingState(medicationSummary, language),
    });
  }

  function handleMedicationAssistantAction(action: (typeof ASSISTANT_ACTIONS)[number]) {
    if (action.id === "refillHelp") {
      openRefillSupport();
      return;
    }
    if (action.id === "addMedicine") {
      toggleMedicationVoiceCapture();
      return;
    }
    openAssistant(action.prompt, action.sheetTitle);
  }

  function openSafetyCaseSheet(safetyCase: MedicationSafetyCase) {
    setReviewCase(safetyCase);
    setCaseForm(formFromSafetyCase(safetyCase));
    setCaseExportText("");
    setCaseSheetOpen(true);
  }

  function openNewSafetyCaseSheet() {
    const prefill = focusedMedication?.displayName ?? displayMeds[0]?.displayName ?? "";
    setReviewCase(null);
    setCaseForm(emptySafetyCaseForm(prefill));
    setCaseExportText("");
    setCaseSheetOpen(true);
  }

  function updateCaseForm<K extends keyof MedicationSafetyCaseForm>(key: K, value: MedicationSafetyCaseForm[K]) {
    setCaseForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSeriousnessFlag(flag: string) {
    setCaseForm((prev) => {
      const hasFlag = prev.seriousness_flags.includes(flag);
      return {
        ...prev,
        seriousness_flags: hasFlag
          ? prev.seriousness_flags.filter((item) => item !== flag)
          : [...prev.seriousness_flags, flag],
      };
    });
  }

  const safetySummary = safetyData?.summary;
  const safetySummaryTone = safetyTone(safetySummary?.severity);
  const visibleSafetySignals = [
    ...(safetyData?.openCases?.map((safetyCase) => ({
      id: safetyCase.id,
      signal_type: safetyCase.signal_type,
      severity: safetyCase.severity,
      title: safetyCase.suspected_medication || signalTypeLabel(safetyCase.signal_type),
      summary: safetyCase.reaction || safetyCase.missing_fields?.join(", ") || "Case needs review",
      medication_name: safetyCase.suspected_medication,
      source: "case",
    })) ?? []),
    ...(safetyData?.signals ?? []),
    ...(safetyData?.signalCandidates ?? []),
  ].slice(0, 5);
  const safetyBadgeText = safetySummary
    ? safetySummary.openCaseCount > 0
      ? t("meds.safety.caseBadge", { count: safetySummary.openCaseCount, defaultValue: "{{count}} case" })
      : safetySummary.signalCount > 0
        ? t("meds.safety.signalBadge", { count: safetySummary.signalCount, defaultValue: "{{count}} signal" })
        : t("meds.safety.steadyBadge", "Steady")
    : t("meds.safety.steadyBadge", "Steady");

  const medicationShortcutCards = [
    {
      id: "reminders",
      icon: Clock,
      label: t("meds.primary.reminders", "My Reminders"),
      sub: totalRemainingDoseCount > 0
        ? t("meds.remainingBadge", { count: totalRemainingDoseCount, defaultValue: "{{count}} due" })
        : t("meds.allTakenShort", "Done"),
      color: "#6B21A8",
      bg: "#F5F3FF",
      border: "#DDD6FE",
      onClick: () => setRemindersOpen((open) => !open),
      testId: "button-meds-primary-reminders",
    },
    {
      id: "refills",
      icon: ShoppingCart,
      label: t("meds.primary.refills", "My Refills"),
      sub: t("meds.primary.refillsMobileSub", "Pharmacy refills"),
      color: "#B45309",
      bg: "#FFF7ED",
      border: "#FED7AA",
      onClick: openRefillSupport,
      testId: "button-meds-primary-refills",
    },
    {
      id: "safety",
      icon: ShieldCheck,
      label: t("meds.primary.safety", "Stay Safe"),
      sub: safetyBadgeText,
      color: safetySummaryTone.color,
      bg: safetySummaryTone.bg,
      border: safetySummaryTone.border,
      onClick: () => setSafetyOpen((open) => !open),
      testId: "button-meds-primary-safety",
    },
    {
      id: "home-remedies",
      icon: Leaf,
      label: t("meds.primary.homeRemedies", "Home Remedies"),
      sub: t("meds.primary.homeRemediesSub", "Ask what is safe"),
      color: "#0F766E",
      bg: "#F0FDFA",
      border: "#99F6E4",
      onClick: () => {
        const action = ASSISTANT_ACTIONS.find((item) => item.id === "homeRemedies");
        if (action) handleMedicationAssistantAction(action);
      },
      testId: "button-meds-primary-home-remedies",
    },
  ];

  async function confirmAllRemainingDoses(meds: DisplayMed[]) {
    for (const med of meds) {
      const remaining = remainingDoseCount(med);
      for (let doseIndex = 0; doseIndex < remaining; doseIndex += 1) {
        await confirmMutation.mutateAsync(med);
      }
    }
  }

  const adherenceValue = totalScheduledDoseCount > 0 ? `${progressPercentRounded}%` : "--";
  const takenValue = totalScheduledDoseCount > 0 ? `${totalTakenDoseCount}/${totalScheduledDoseCount}` : "--";
  const dashboardFocusNumber = todayLoading ? "..." : String(totalRemainingDoseCount);
  const dashboardFocusLabel = displayMeds.length === 0
    ? t("meds.dashboard.noPlanLabel", "No plan yet")
    : totalRemainingDoseCount === 0
      ? t("meds.dashboard.allClearLabel", "All clear today")
      : t("meds.dashboard.dosesLeftLabel", "doses left today");
  const dashboardPriorityTitle = todayLoading
    ? t("meds.dashboard.priorityLoadingTitle", "Checking medicines")
    : displayMeds.length === 0
      ? t("meds.dashboard.priorityEmptyTitle", "No medicine plan yet")
      : totalRemainingDoseCount === 0
        ? t("meds.dashboard.priorityDoneTitle", "All done today")
        : totalRemainingDoseCount === 1
          ? t("meds.dashboard.priorityNextTitleOne", "1 dose left today")
          : t("meds.dashboard.priorityNextTitleMany", {
            count: totalRemainingDoseCount,
            defaultValue: "{{count}} doses left today",
          });
  const dashboardPrioritySub = todayLoading
    ? t("meds.dashboard.priorityLoadingSub", "Loading today's schedule.")
    : displayMeds.length === 0
      ? t("meds.dashboard.priorityEmptySub", "Add medicines to start tracking today.")
      : totalRemainingDoseCount === 0
        ? t("meds.dashboard.priorityDoneSub", {
          taken: totalTakenDoseCount,
          defaultValue: "{{taken}} doses confirmed. Nothing else is due.",
        })
        : nextMedication
          ? t("meds.dashboard.priorityNextSub", {
            medicine: nextMedication.displayName,
            time: nextMedication.scheduledTimeForApi,
            defaultValue: "Next: {{medicine}} at {{time}}.",
          })
          : t("meds.dashboard.priorityAttentionSub", {
            count: totalRemainingDoseCount,
            defaultValue: "{{count}} doses still need attention.",
          });
  return (
    <div className="px-[18px] pb-28 sm:px-[22px]">
      <section className="mt-4" data-testid="section-meds-dashboard">
        <article className="overflow-hidden rounded-[26px] border border-[#D9ECE4] bg-white shadow-[0_14px_32px_rgba(15,76,69,0.08)] sm:rounded-[30px]">
          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-vyva-purple">
                <Pill size={24} strokeWidth={2.4} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[12px] font-black uppercase leading-none text-vyva-text-3">
                  {t("meds.dashboard.title", "Medication dashboard")}
                </p>
                <h1 className="mt-1 font-body text-[27px] font-black leading-tight text-vyva-text-1 sm:text-[34px]" data-testid="text-meds-priority-title">
                  {dashboardPriorityTitle}
                </h1>
                <p className="mt-1 font-body text-[16px] font-black leading-snug text-[#0F4C45]" data-testid="text-meds-priority-sub">
                  {dashboardPrioritySub}
                </p>
              </div>
            </div>

            <div
              className="mt-4 rounded-[24px] bg-[#123F3A] p-4 text-white sm:p-5"
              data-testid="section-meds-priority"
            >
              <div className="grid gap-4 lg:grid-cols-[160px_minmax(0,1fr)_auto] lg:items-center">
                <div className="flex items-end gap-3" data-testid="metric-meds-due">
                  <p className="font-body text-[72px] font-black leading-none [letter-spacing:0] sm:text-[82px]">
                    {dashboardFocusNumber}
                  </p>
                  <p className="mb-2 max-w-[110px] font-body text-[17px] font-black leading-tight text-white/90">
                    {dashboardFocusLabel}
                  </p>
                </div>

                <div className="min-w-0" data-testid="section-meds-next">
                  <p className="font-body text-[12px] font-black uppercase text-white/60">
                    {t("meds.dashboard.nextMedicine", "Next medicine")}
                  </p>
                  {todayLoading ? (
                    <p className="mt-1 font-body text-[22px] font-black text-white">
                      {t("meds.dashboard.checkingSchedule", "Checking schedule...")}
                    </p>
                  ) : nextMedication ? (
                    <>
                      <h2 className="mt-1 font-body text-[30px] font-black leading-tight text-white sm:text-[34px]">
                        {nextMedication.displayName}
                      </h2>
                      <p className="mt-1 font-body text-[15px] font-bold leading-snug text-white/78 sm:text-[16px]">
                        {nextMedication.displayNote || t("meds.dashboard.dailyRoutine", "Daily routine")}
                        {" "}
                        <span className="text-[#FDE68A]">
                          {t("meds.dashboard.scheduledTime", { time: nextMedication.scheduledTimeForApi, defaultValue: "at {{time}}" })}
                        </span>
                      </p>
                    </>
                  ) : displayMeds.length > 0 ? (
                    <div className="mt-1 text-white" data-testid="status-meds-dashboard-done">
                      <p className="font-body text-[22px] font-black leading-tight">
                        {t("meds.dashboard.allDoneTitle", "All scheduled doses are done")}
                      </p>
                      <p className="mt-1 font-body text-[14px] font-bold leading-snug text-white/78">
                        {t("meds.dashboard.allDoneSub", "Your medicine routine is complete for today.")}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-1">
                      <p className="font-body text-[22px] font-black leading-tight text-white">
                        {t("meds.noMedsTitle", "No medications added yet")}
                      </p>
                      <p className="mt-1 font-body text-[14px] font-bold leading-snug text-white/78">
                        {t("meds.noMedsSub", "Use the button below to add your medications by voice")}
                      </p>
                    </div>
                  )}
                </div>

                <div className="lg:justify-self-end">
                  {nextMedication ? (
                    <button
                      data-testid="button-confirm-next-med"
                      type="button"
                      onClick={() => confirmMutation.mutate(nextMedication)}
                      disabled={confirmMutation.isPending}
                      className="vyva-tap inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-white px-6 font-body text-[17px] font-black text-[#123F3A] shadow-[0_10px_22px_rgba(0,0,0,0.12)] disabled:opacity-60 lg:w-auto"
                    >
                      <Check size={19} aria-hidden="true" />
                      {t("meds.dashboard.confirmNext", "Confirm taken")}
                    </button>
                  ) : displayMeds.length === 0 && !todayLoading ? (
                    <div className="flex flex-col items-stretch gap-2 lg:items-end">
                      <button
                        data-testid="button-meds-dashboard-add-by-voice-empty"
                        type="button"
                        onClick={toggleMedicationVoiceCapture}
                        disabled={isTranscribingMedicationVoice}
                        className={`vyva-tap mt-1 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full px-5 font-body text-[16px] font-black text-white disabled:cursor-wait disabled:opacity-70 lg:w-auto ${
                          isRecordingMedicationVoice ? "bg-[#BE123C]" : "bg-vyva-purple"
                        }`}
                        aria-label={medicationVoiceButtonLabel}
                      >
                        {isTranscribingMedicationVoice ? <Loader2 size={17} className="animate-spin" /> : <Mic size={17} />}
                        {medicationVoiceButtonLabel}
                      </button>
                      {medicationVoiceStatus ? (
                        <p
                          role={medicationVoiceError ? "alert" : "status"}
                          data-testid="meds-voice-status"
                          className={`max-w-[17rem] px-2 text-center font-body text-[12px] font-bold leading-snug lg:text-right ${medicationVoiceError ? "text-[#FECACA]" : "text-white/78"}`}
                        >
                          {medicationVoiceStatus}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-[18px] border border-[#E1E8E4] bg-[#F8FEFC] px-4 py-3">
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-body text-[13px] font-black text-vyva-text-2">
                <span data-testid="metric-meds-taken">
                  {t("meds.dashboard.takenToday", "Taken today")}: <span className="text-vyva-text-1">{takenValue}</span>
                </span>
                <span data-testid="metric-meds-adherence">
                  {t("meds.dashboard.adherence", "Adherence")}: <span className="text-vyva-text-1">{adherenceValue}</span>
                </span>
                <span data-testid="metric-meds-count">
                  {t("meds.dashboard.medicines", "Medicines")}: <span className="text-vyva-text-1">{displayMeds.length}</span>
                </span>
              </div>
            </div>

            <section
              className="mt-3 grid grid-cols-2 gap-2"
              data-testid="section-meds-primary-actions"
            >
              {medicationShortcutCards.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.id}
                    type="button"
                    data-testid={card.testId}
                    onClick={card.onClick}
                    aria-label={`${card.label}. ${card.sub}`}
                    className="vyva-tap flex min-h-[78px] flex-col items-start justify-between rounded-[18px] border bg-white p-3 text-left shadow-[0_8px_18px_rgba(31,41,55,0.045)] transition-transform hover:-translate-y-0.5"
                    style={{ borderColor: card.border }}
                  >
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-[14px]"
                      style={{ background: card.bg, color: card.color }}
                    >
                      <Icon size={18} strokeWidth={2.45} aria-hidden="true" />
                    </span>
                    <span className="mt-2 min-w-0">
                      <span className="block font-body text-[14px] font-black leading-tight text-vyva-text-1 sm:text-[15px]">
                        {card.label}
                      </span>
                      <span className="mt-0.5 block truncate font-body text-[11px] font-black leading-tight" style={{ color: card.color }}>
                        {card.sub}
                      </span>
                    </span>
                  </button>
                );
              })}
            </section>

            <div
              className="mt-3 rounded-[18px] border border-[#F0DEC3] bg-[#FFF9F0] p-3 sm:p-4"
              data-testid="section-meds-dashboard-tips"
            >
              <div className="flex min-w-0 items-start gap-2.5" data-testid="card-meds-health-tip">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[14px] bg-white text-vyva-purple shadow-[0_8px_18px_rgba(109,40,217,0.08)]">
                  <Sparkles size={18} strokeWidth={2.4} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-body text-[18px] font-black leading-tight text-vyva-text-1 sm:text-[19px]">
                    {t("meds.dashboard.personalGuidance", "Guidance")}
                  </h2>
                  <p className="mt-1 font-body text-[15px] font-black leading-snug text-vyva-text-1 sm:text-[16px]">
                    {healthTip.text}
                  </p>

                  <div
                    className="mt-2 flex min-w-0 items-start gap-2 border-t border-[#ECD9BC] pt-2"
                    data-testid="card-meds-exercise-tip"
                  >
                    <Footprints size={16} strokeWidth={2.4} className="mt-0.5 flex-shrink-0 text-[#047857]" aria-hidden="true" />
                    <p className="font-body text-[13px] font-bold leading-snug text-vyva-text-2 sm:text-[14px]">
                      {exerciseTip.text}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <section
              className="mt-3 rounded-[18px] border border-[#E6E0F4] bg-white p-3"
              data-testid="section-meds-can-help"
            >
              <h2 className="font-body text-[16px] font-black leading-tight text-vyva-text-1">
                {t("meds.fastHelpKicker", "Fast help")}
              </h2>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {visibleAssistantActions.map((action) => {
                  const Icon = action.icon;

                  return (
                    <button
                      key={action.id}
                      data-testid={`button-assistant-${action.id}`}
                      onClick={() => handleMedicationAssistantAction(action)}
                      aria-label={`${action.label}. ${action.sub}`}
                      className="vyva-tap flex min-h-[54px] w-full items-center gap-2 rounded-[16px] border bg-white px-3 py-2 text-left transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
                      style={{
                        borderColor: action.border,
                        boxShadow: `0 8px 18px ${action.shadow}`,
                      }}
                    >
                      <span
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[14px]"
                        style={{ background: action.bg, color: action.color }}
                      >
                        <Icon size={18} strokeWidth={2.4} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-body text-[13px] font-black leading-tight text-vyva-text-1">
                          {action.label}
                        </span>
                        <span className="sr-only">
                          {action.sub}
                        </span>
                      </span>
                      <ChevronRight size={17} strokeWidth={2.5} className="shrink-0 text-vyva-text-3" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </section>

            <div
              className="mt-3 flex min-w-0 flex-col justify-between rounded-[20px] border border-[#D9ECE4] bg-[#FBFFFD] p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4"
              data-testid="panel-meds-pharmacy"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#ECFEFF] text-[#0F766E]">
                  <Store size={20} strokeWidth={2.4} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[12px] font-black uppercase text-vyva-text-3">
                    {t("meds.dashboard.pharmacy", "Pharmacy")}
                  </p>
                  <h2 className="mt-1 font-body text-[19px] font-black leading-tight text-vyva-text-1" data-testid="text-meds-pharmacy-name">
                    {pharmacyProvider?.name || t("meds.dashboard.noPharmacyTitle", "No pharmacy saved yet")}
                  </h2>
                  <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                    {pharmacyPhone || pharmacyProvider?.address || t("meds.dashboard.noPharmacySub", "Add a pharmacy so contact details are ready.")}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-0 sm:min-w-[300px]">
                {pharmacyPhoneHref ? (
                  <a
                    data-testid="link-meds-pharmacy-phone"
                    href={pharmacyPhoneHref}
                    className="vyva-tap inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full border border-[#BDEBD8] bg-white px-3 font-body text-[14px] font-black text-[#047857]"
                  >
                    <Phone size={17} aria-hidden="true" />
                    {t("meds.dashboard.callPharmacy", "Call pharmacy")}
                  </a>
                ) : (
                  <button
                    data-testid="button-meds-pharmacy-add"
                    type="button"
                    onClick={() => navigate("/onboarding/profile/providers")}
                    className="vyva-tap inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full border border-[#BDEBD8] bg-white px-3 font-body text-[14px] font-black text-[#047857]"
                  >
                    <Plus size={17} aria-hidden="true" />
                    {t("meds.dashboard.addPharmacy", "Add pharmacy")}
                  </button>
                )}
                <button
                  data-testid="button-meds-pharmacy-order"
                  type="button"
                  onClick={openRefillSupport}
                  className="vyva-tap inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-vyva-purple px-3 font-body text-[14px] font-black text-white"
                >
                  <ShoppingCart size={17} aria-hidden="true" />
                  {t("meds.dashboard.orderRefill", "Order refill")}
                </button>
              </div>
            </div>
          </div>
        </article>
      </section>

      <VoiceActionFulfillmentPanel
        domain="meds"
        actionTypes={["meds.management", "meds.refill_request"]}
        title={voiceAction?.actionType === "meds.refill_request" ? t("meds.contextPanel.refillTitle", "Refill context ready") : t("meds.contextPanel.title", "Medication context ready")}
        description={voiceAction?.actionType === "meds.refill_request"
          ? t("meds.contextPanel.refillDescription", "VYVA can check medication stock and prepare refill help, then ask you to confirm before anyone is contacted.")
          : t("meds.contextPanel.description", "VYVA can use today's schedule and your medication profile on this page.")}
        highlights={voiceActionHighlights}
        className="mt-4"
      />

      {voiceAction && (
        <section
          className="vyva-card mt-4 border-emerald-200 bg-gradient-to-br from-white to-emerald-50 p-4"
          data-testid="panel-voice-medication-focus"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-emerald-50 text-emerald-700">
              <Pencil size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.08em] text-emerald-700">
                {t("meds.focusPanel.label", "Voice focus")}
              </p>
              <h2 className="mt-1 font-body text-[17px] font-extrabold leading-tight text-vyva-text-1">
                {(focusedMedication?.displayName ?? focusedMedicationName) || t("meds.focusPanel.routine", "Medication routine")}
              </h2>
              <p className="mt-1 font-body text-[14px] leading-[1.45] text-vyva-text-2">
                {focusedMedicationStatus}
              </p>
            </div>
          </div>
          <ResponsiveGrid columns="three" gap="sm" className="mt-4">
            <div className="rounded-[16px] bg-[#F7FBF8] p-3">
              <p className="font-body text-[11px] font-bold uppercase tracking-[0.06em] text-vyva-text-3">{t("meds.focusLabels.schedule", "Schedule")}</p>
              <p className="mt-1 font-body text-[14px] font-bold text-vyva-text-1">
                {focusedMedication?.displayNote || voiceRoutineFocus || t("meds.focusPanel.dailyRoutine", "Daily routine")}
              </p>
            </div>
            <div className="rounded-[16px] bg-[#F7FBF8] p-3">
              <p className="font-body text-[11px] font-bold uppercase tracking-[0.06em] text-vyva-text-3">{t("meds.focusLabels.doseTime", "Dose time")}</p>
              <p className="mt-1 font-body text-[14px] font-bold text-vyva-text-1">
                {voiceDoseTime || focusedMedication?.scheduledTimeForApi || t("meds.focusPanel.askVyva", "Ask VYVA")}
              </p>
            </div>
            <div className="rounded-[16px] bg-[#F7FBF8] p-3">
              <p className="font-body text-[11px] font-bold uppercase tracking-[0.06em] text-vyva-text-3">{t("meds.focusLabels.next", "Next")}</p>
              <p className="mt-1 font-body text-[14px] font-bold text-vyva-text-1">
                {focusedMedication ? t("meds.focusPanel.reviewNext", "Review dose, refill, or interaction") : t("meds.focusPanel.pickMedication", "Pick a medication")}
              </p>
            </div>
          </ResponsiveGrid>
        </section>
      )}

      {safetyOpen ? (
        <section className="mt-5" data-testid="section-meds-safety">
          <SectionTitle
            className="mb-3"
            title={t("meds.safety.title", "Medication safety signals")}
            subtitle={t("meds.safety.subtitle", "Early signal review and audit-ready case packets.")}
            titleClassName="font-body text-[22px] font-extrabold not-italic"
            action={(
              <span
                className="inline-flex min-h-[32px] items-center rounded-full border px-3 font-body text-[12px] font-bold"
                style={{
                  background: safetySummaryTone.bg,
                  color: safetySummaryTone.color,
                  borderColor: safetySummaryTone.border,
                }}
              >
                {safetyBadgeText}
              </span>
            )}
          />

          <div className="vyva-card overflow-hidden">
            {safetyLoading ? (
              <div className="space-y-3 p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
                <div className="h-20 animate-pulse rounded-[18px] bg-gray-100" />
              </div>
            ) : safetyError ? (
              <div className="flex items-start gap-3 p-4">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-red-50 text-red-600">
                  <AlertCircle size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[16px] font-extrabold text-vyva-text-1">
                    {t("meds.safety.loadErrorTitle", "Safety signals unavailable")}
                  </p>
                  <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">
                    {t("meds.safety.loadErrorSub", "Try again in a moment. Reminders and adherence are still available.")}
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div className="border-b border-vyva-border bg-[#FFFCF8] p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px]"
                      style={{ background: safetySummaryTone.bg, color: safetySummaryTone.color }}
                    >
                      <ShieldCheck size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-[17px] font-extrabold leading-tight text-vyva-text-1">
                        {safetySummary?.title ?? t("meds.safety.steadyTitle", "No medication safety signals found")}
                      </p>
                      <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">
                        {safetySummary?.message ?? t("meds.safety.steadySub", "Today looks steady from the medication data VYVA can see.")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-[16px] bg-white p-3">
                      <p className="font-body text-[11px] font-bold uppercase tracking-[0.06em] text-vyva-text-3">
                        {t("meds.safety.statSignals", "Signals")}
                      </p>
                      <p className="mt-1 font-body text-[22px] font-black text-vyva-text-1">
                        {safetySummary?.signalCount ?? 0}
                      </p>
                    </div>
                    <div className="rounded-[16px] bg-white p-3">
                      <p className="font-body text-[11px] font-bold uppercase tracking-[0.06em] text-vyva-text-3">
                        {t("meds.safety.statCases", "Cases")}
                      </p>
                      <p className="mt-1 font-body text-[22px] font-black text-vyva-text-1">
                        {safetySummary?.openCaseCount ?? 0}
                      </p>
                    </div>
                    <div className="rounded-[16px] bg-white p-3">
                      <p className="font-body text-[11px] font-bold uppercase tracking-[0.06em] text-vyva-text-3">
                        {t("meds.safety.statReady", "Ready")}
                      </p>
                      <p className="mt-1 font-body text-[22px] font-black text-vyva-text-1">
                        {safetyData?.exportAvailability?.readyCount ?? 0}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 p-4">
                  {visibleSafetySignals.length > 0 ? (
                    visibleSafetySignals.map((signal, index) => {
                      const tone = safetyTone(signal.severity);
                      return (
                        <div
                          key={`${signal.id ?? signal.signal_type}-${index}`}
                          className="rounded-[18px] border bg-white p-4"
                          style={{ borderColor: tone.border }}
                          data-testid={`card-meds-safety-signal-${index}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-body text-[15px] font-extrabold leading-tight text-vyva-text-1">
                                {signal.title}
                              </p>
                              <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">
                                {signal.summary}
                              </p>
                              {signal.medication_name ? (
                                <p className="mt-2 font-body text-[12px] font-bold text-vyva-purple">
                                  {signal.medication_name}
                                </p>
                              ) : null}
                            </div>
                            <span
                              className="inline-flex min-h-[28px] flex-shrink-0 items-center rounded-full px-2.5 font-body text-[11px] font-bold"
                              style={{ background: tone.bg, color: tone.color }}
                            >
                              {signalTypeLabel(signal.signal_type)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-[18px] border border-vyva-border bg-white p-4 text-center">
                      <p className="font-body text-[15px] font-extrabold text-vyva-text-1">
                        {t("meds.safety.emptyTitle", "No case needed right now")}
                      </p>
                      <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">
                        {t("meds.safety.emptySub", "A single missed confirmation stays in reminders. Draft cases appear only for explicit or repeated signals.")}
                      </p>
                    </div>
                  )}

                  {safetyData?.openCases?.length ? (
                    <div className="flex flex-col gap-2">
                      {safetyData.openCases.map((safetyCase, index) => {
                        const tone = safetyTone(safetyCase.severity);
                        return (
                          <button
                            key={safetyCase.id}
                            type="button"
                            data-testid={`button-review-safety-case-${index}`}
                            onClick={() => openSafetyCaseSheet(safetyCase)}
                            className="vyva-tap flex min-h-[76px] w-full items-center gap-3 rounded-[18px] border bg-[#FCFBF8] px-4 py-3 text-left"
                            style={{ borderColor: tone.border }}
                          >
                            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px]" style={{ background: tone.bg, color: tone.color }}>
                              <FileText size={20} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block font-body text-[15px] font-extrabold leading-tight text-vyva-text-1">
                                {safetyCase.suspected_medication || t("meds.safety.caseFallback", "Medication safety case")}
                              </span>
                              <span className="mt-1 block font-body text-[12px] font-semibold leading-snug text-vyva-text-2">
                                {safetyCase.export_ready
                                  ? t("meds.safety.readyToExport", "Ready to export")
                                  : t("meds.safety.missingFields", { count: safetyCase.missing_fields?.length ?? 0, defaultValue: "{{count}} fields missing" })}
                              </span>
                            </span>
                            <ChevronRight size={19} className="flex-shrink-0 text-vyva-text-3" />
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      data-testid="button-meds-safety-analyse"
                      type="button"
                      onClick={() => analyseSafetyMutation.mutate()}
                      disabled={analyseSafetyMutation.isPending}
                      className="vyva-tap flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-vyva-purple px-5 font-body text-[15px] font-bold text-white disabled:opacity-60"
                    >
                      {analyseSafetyMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                      {t("meds.safety.analyse", "Analyse signals")}
                    </button>
                    <button
                      data-testid="button-meds-safety-new-case"
                      type="button"
                      onClick={openNewSafetyCaseSheet}
                      className="vyva-tap flex min-h-[50px] items-center justify-center gap-2 rounded-full border border-vyva-purple bg-white px-5 font-body text-[15px] font-bold text-vyva-purple"
                    >
                      <FileText size={16} />
                      {t("meds.safety.newCase", "New side-effect note")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {remindersOpen ? (
      <section className="mt-5" data-testid="section-meds-reminders">
        <SectionTitle
          className="mb-3"
          title={t("meds.todaySchedule")}
          subtitle={t("meds.scheduleSubtitle", "Review what is due today and mark doses as taken.")}
          titleClassName="font-body text-[22px] font-extrabold not-italic"
          action={displayMeds.length > 0 ? (
            <span
              className="inline-flex min-h-[32px] items-center rounded-full px-3 font-body text-[12px] font-bold"
              style={{
                background: totalRemainingDoseCount > 0 ? "#FEF3C7" : "#ECFDF5",
                color: totalRemainingDoseCount > 0 ? "#92400E" : "#065F46",
              }}
            >
              {totalRemainingDoseCount > 0
                ? t("meds.remainingBadge", { count: totalRemainingDoseCount })
                : t("meds.allTakenShort", "Done")}
            </span>
          ) : null}
        />

        <div className="vyva-card overflow-hidden">
          {todayLoading ? (
            <div className="flex flex-col gap-0">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex min-h-[82px] items-center gap-4 border-b border-vyva-border px-4 py-4 last:border-b-0">
                  <div className="h-12 w-12 flex-shrink-0 animate-pulse rounded-[18px] bg-gray-100" />
                  <div className="flex-1">
                    <div className="mb-2 h-4 w-1/2 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayMeds.length === 0 ? (
            <div
              data-testid="status-no-medications"
              className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#F5F3FF] text-vyva-purple">
                <Mic size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[16px] font-extrabold leading-tight text-vyva-text-1">
                  {t("meds.noMedsTitle", "No medications added yet")}
                </p>
                <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">
                  {t("meds.noMedsSub", "Use the button below to add your medications by voice")}
                </p>
                {medicationVoiceStatus ? (
                  <p
                    role={medicationVoiceError ? "alert" : "status"}
                    data-testid="meds-voice-status"
                    className={`mt-2 font-body text-[12px] font-bold leading-snug ${medicationVoiceError ? "text-[#B91C1C]" : "text-vyva-text-2"}`}
                  >
                    {medicationVoiceStatus}
                  </p>
                ) : null}
              </div>
              <button
                data-testid="button-meds-add-by-voice-empty"
                onClick={toggleMedicationVoiceCapture}
                disabled={isTranscribingMedicationVoice}
                aria-label={medicationVoiceButtonLabel}
                title={medicationVoiceButtonLabel}
                className={`vyva-tap inline-flex min-h-[46px] flex-shrink-0 items-center justify-center gap-2 rounded-full px-5 font-body text-[15px] font-bold text-white shadow-vyva-card transition disabled:cursor-wait disabled:opacity-70 ${
                  isRecordingMedicationVoice ? "bg-[#BE123C]" : "bg-vyva-purple"
                }`}
              >
                {isTranscribingMedicationVoice ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : isRecordingMedicationVoice ? (
                  <Square size={14} fill="currentColor" />
                ) : (
                  <Mic size={16} />
                )}
                {medicationVoiceButtonLabel}
              </button>
            </div>
          ) : (
            displayMeds.map((med, i) => {
              const taken = isMedTaken(med);
              const takenDoseCount = effectiveTakenCount(med);
              const showDoseProgress = med.scheduledCountToday > 1;
              return (
                <div
                  key={med.id}
                  className={`border-b border-vyva-border px-4 py-4 last:border-b-0 ${focusedMedication?.id === med.id ? "bg-emerald-50 ring-2 ring-inset ring-emerald-200" : ""}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px]" style={{ background: taken ? "#ECFDF5" : "#FEF3C7" }}>
                      {taken ? <Check size={21} style={{ color: "#0A7C4E" }} /> : <Clock size={21} style={{ color: "#C9890A" }} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-body text-[17px] font-extrabold leading-tight text-vyva-text-1">{med.displayName}</p>
                          {med.displayNote ? <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">{med.displayNote}</p> : null}
                        </div>
                        <span
                          className="inline-flex min-h-[28px] items-center rounded-full px-2.5 font-body text-[12px] font-bold"
                          style={{
                            background: taken ? "#ECFDF5" : "#FEF3C7",
                            color: taken ? "#065F46" : "#92400E",
                          }}
                          data-testid={taken ? `status-med-taken-${i}` : undefined}
                        >
                          {taken ? t("meds.taken") : showDoseProgress ? `${takenDoseCount}/${med.scheduledCountToday}` : t("meds.tonight")}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {!taken ? (
                          <button
                            data-testid={`button-confirm-med-${i}`}
                            onClick={() => confirmMutation.mutate(med)}
                            disabled={confirmMutation.isPending}
                            className="vyva-tap inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-full bg-vyva-purple px-4 font-body text-[13px] font-bold text-white transition-opacity disabled:opacity-50"
                          >
                            <Check size={14} />
                            {t("meds.confirm")}
                          </button>
                        ) : null}
                        <button
                          data-testid={`button-edit-med-${i}`}
                          onClick={() => openEditMed(med)}
                          className="vyva-tap inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-full border border-vyva-border bg-white px-3 font-body text-[13px] font-bold text-vyva-text-2"
                        >
                          <Pencil size={14} />
                          {t("meds.editMed", "Edit")}
                        </button>
                        <button
                          data-testid={`button-delete-med-${i}`}
                          onClick={() => setDeleteMed(med)}
                          className="vyva-tap inline-flex h-[38px] w-[38px] items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-500"
                          aria-label={t("meds.deleteMed", "Remove medication")}
                          title={t("meds.deleteMed", "Remove medication")}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {voiceAddedMeds.map((med, i) => (
            <div key={`voice-${i}`} className="flex min-h-[78px] items-center gap-4 border-b border-vyva-border bg-purple-50 px-4 py-4 last:border-b-0">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px]" style={{ background: "#F3E8FF" }}>
                <Mic size={20} style={{ color: "#6B21A8" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[16px] font-extrabold leading-tight text-vyva-text-1">{med.name || t("meds.newMedication")}</p>
                <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">
                  {[med.dosage, med.frequency?.replace("_", " ")].filter(Boolean).join(" - ")}
                </p>
              </div>
              <span className="rounded-full bg-[#F3E8FF] px-2.5 py-1 font-body text-[12px] font-bold text-vyva-purple">
                {t("meds.added")}
              </span>
            </div>
          ))}

          {displayMeds.length > 0 ? (
            <div className="flex flex-col gap-3 border-t border-vyva-border bg-[#FFFCF8] px-4 py-4">
              {!todayLoading && totalRemainingDoseCount === 0 ? (
                <div
                  className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-emerald-50 px-5 py-4 font-body text-[16px] font-bold text-emerald-700"
                  data-testid="status-all-meds-taken"
                >
                  <Check size={18} />
                  {t("meds.allTaken")}
                </div>
              ) : (
                <button
                  data-testid="button-confirm-all-meds"
                  onClick={() => {
                    void confirmAllRemainingDoses(pendingMeds);
                  }}
                  disabled={confirmMutation.isPending || todayLoading || totalRemainingDoseCount === 0}
                  className="vyva-tap flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-vyva-purple px-5 py-4 font-body text-[16px] font-bold text-white transition-opacity disabled:opacity-60"
                >
                  <LinkIcon size={18} />
                  {t("meds.confirmRemaining", "Confirm remaining doses")}
                </button>
              )}
              <button
                data-testid="button-meds-add-by-voice"
                onClick={toggleMedicationVoiceCapture}
                disabled={isTranscribingMedicationVoice}
                aria-label={medicationVoiceButtonLabel}
                title={medicationVoiceButtonLabel}
                className={`vyva-tap flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full border px-5 py-3 font-body text-[15px] font-bold transition disabled:cursor-wait disabled:opacity-70 ${
                  isRecordingMedicationVoice
                    ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]"
                    : "border-vyva-purple bg-white text-vyva-purple"
                }`}
              >
                {isTranscribingMedicationVoice ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : isRecordingMedicationVoice ? (
                  <Square size={14} fill="currentColor" />
                ) : (
                  <Mic size={16} />
                )}
                {medicationVoiceButtonLabel}
              </button>
              {medicationVoiceStatus ? (
                <p
                  role={medicationVoiceError ? "alert" : "status"}
                  data-testid="meds-voice-status"
                  className={`px-2 text-center font-body text-[12px] font-bold leading-snug ${medicationVoiceError ? "text-[#B91C1C]" : "text-vyva-text-2"}`}
                >
                  {medicationVoiceStatus}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
      ) : null}

      <MedsAssistantSheet
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        title={assistantTitle}
        initialPrompt={assistantPrompt}
      />

      {caseSheetOpen ? (
        <PurpleModal
          Icon={ShieldCheck}
          kicker={t("meds.safety.kicker", "Medication safety")}
          title={reviewCase ? t("meds.safety.reviewCase", "Review safety case") : t("meds.safety.newCaseTitle", "New safety case")}
          subtitle={t("meds.safety.caseDrawerSub", "Prepare a review packet. This does not submit anything to a regulator.")}
          titleId="medication-safety-case-title"
          onClose={() => setCaseSheetOpen(false)}
          closeLabel={t("common.close", "Close")}
          panelTestId="sheet-meds-safety-case"
          size="wide"
          bodyClassName="flex max-h-[calc(88vh-150px)] flex-col p-0"
        >
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {reviewCase?.missing_fields?.length ? (
              <div className="mb-4 rounded-[16px] border border-amber-200 bg-amber-50 px-3 py-3">
                <p className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-amber-800">
                  {t("meds.safety.missingTitle", "Missing for audit-ready export")}
                </p>
                <p className="mt-1 font-body text-[13px] leading-snug text-amber-800">
                  {reviewCase.missing_fields.join(", ")}
                </p>
              </div>
            ) : reviewCase ? (
              <div className="mb-4 rounded-[16px] border border-emerald-200 bg-emerald-50 px-3 py-3">
                <p className="font-body text-[13px] font-bold text-emerald-800">
                  {t("meds.safety.readyTitle", "All export fields are filled")}
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="safety-case-status">{t("meds.safety.status", "Status")}</Label>
                  <select
                    id="safety-case-status"
                    data-testid="select-safety-case-status"
                    value={caseForm.status}
                    onChange={(event) => updateCaseForm("status", event.target.value as MedicationSafetyCaseStatus)}
                    className="h-10 rounded-md border border-vyva-border bg-white px-3 font-body text-[14px]"
                  >
                    <option value="draft">Draft</option>
                    <option value="needs_review">Needs review</option>
                    <option value="shared">Shared</option>
                    <option value="closed">Closed</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="safety-case-severity">{t("meds.safety.severity", "Severity")}</Label>
                  <select
                    id="safety-case-severity"
                    data-testid="select-safety-case-severity"
                    value={caseForm.severity}
                    onChange={(event) => updateCaseForm("severity", event.target.value as MedicationSafetySeverity)}
                    className="h-10 rounded-md border border-vyva-border bg-white px-3 font-body text-[14px]"
                  >
                    <option value="watch">Watch</option>
                    <option value="attention">Attention</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="safety-case-med">{t("meds.safety.suspectedMedication", "Suspected medication")}</Label>
                <Input
                  id="safety-case-med"
                  data-testid="input-safety-case-medication"
                  value={caseForm.suspected_medication}
                  onChange={(event) => updateCaseForm("suspected_medication", event.target.value)}
                  placeholder={t("meds.safety.medicationPlaceholder", "e.g. Metformin")}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="safety-case-reaction">{t("meds.safety.reaction", "Symptom or reaction")}</Label>
                <Input
                  id="safety-case-reaction"
                  data-testid="input-safety-case-reaction"
                  value={caseForm.reaction}
                  onChange={(event) => updateCaseForm("reaction", event.target.value)}
                  placeholder={t("meds.safety.reactionPlaceholder", "e.g. dizziness after taking dose")}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="safety-case-started">{t("meds.safety.reactionStarted", "Reaction start date")}</Label>
                <Input
                  id="safety-case-started"
                  data-testid="input-safety-case-started"
                  type="date"
                  value={caseForm.reaction_started_at}
                  onChange={(event) => updateCaseForm("reaction_started_at", event.target.value)}
                />
              </div>

              <div>
                <p className="mb-2 font-body text-[13px] font-bold text-vyva-text-1">
                  {t("meds.safety.seriousness", "Seriousness assessment")}
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {SERIOUSNESS_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex min-h-[40px] items-center gap-3 rounded-[14px] border border-vyva-border bg-white px-3 py-2 font-body text-[13px] font-semibold text-vyva-text-1"
                    >
                      <input
                        type="checkbox"
                        checked={caseForm.seriousness_flags.includes(option.value)}
                        onChange={() => toggleSeriousnessFlag(option.value)}
                        className="h-4 w-4 accent-vyva-purple"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="safety-case-outcome">{t("meds.safety.outcome", "Outcome")}</Label>
                  <Input
                    id="safety-case-outcome"
                    data-testid="input-safety-case-outcome"
                    value={caseForm.outcome}
                    onChange={(event) => updateCaseForm("outcome", event.target.value)}
                    placeholder={t("meds.safety.outcomePlaceholder", "e.g. improving")}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="safety-case-action">{t("meds.safety.actionTaken", "Action taken")}</Label>
                  <Input
                    id="safety-case-action"
                    data-testid="input-safety-case-action"
                    value={caseForm.action_taken}
                    onChange={(event) => updateCaseForm("action_taken", event.target.value)}
                    placeholder={t("meds.safety.actionPlaceholder", "e.g. called pharmacist")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="safety-case-reporter">{t("meds.safety.reporterName", "Reporter name")}</Label>
                  <Input
                    id="safety-case-reporter"
                    data-testid="input-safety-case-reporter"
                    value={caseForm.reporter_name}
                    onChange={(event) => updateCaseForm("reporter_name", event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="safety-case-contact">{t("meds.safety.reporterContact", "Reporter contact")}</Label>
                  <Input
                    id="safety-case-contact"
                    data-testid="input-safety-case-contact"
                    value={caseForm.reporter_contact}
                    onChange={(event) => updateCaseForm("reporter_contact", event.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="safety-case-narrative">{t("meds.safety.narrative", "Narrative")}</Label>
                <Textarea
                  id="safety-case-narrative"
                  data-testid="textarea-safety-case-narrative"
                  value={caseForm.narrative}
                  onChange={(event) => updateCaseForm("narrative", event.target.value)}
                  placeholder={t("meds.safety.narrativePlaceholder", "Add context without guessing or diagnosing.")}
                  className="min-h-[96px] rounded-[16px] font-body text-[14px]"
                />
              </div>

              {reviewCase?.evidence?.length ? (
                <div className="rounded-[16px] border border-vyva-border bg-[#FCFBF8] px-3 py-3">
                  <p className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                    {t("meds.safety.evidence", "Evidence timeline")}
                  </p>
                  <div className="mt-2 flex flex-col gap-2">
                    {reviewCase.evidence.slice(0, 4).map((item, index) => (
                      <p key={index} className="font-body text-[12px] leading-snug text-vyva-text-2">
                        {JSON.stringify(item)}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {caseExportText ? (
                <div className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-3 py-3">
                  <p className="mb-2 font-body text-[12px] font-black uppercase tracking-[0.08em] text-emerald-800">
                    {t("meds.safety.exportPacket", "Export packet")}
                  </p>
                  <Textarea
                    readOnly
                    value={caseExportText}
                    className="min-h-[180px] rounded-[14px] bg-white font-mono text-[11px]"
                    data-testid="textarea-safety-case-export"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex-shrink-0 border-t border-vyva-border bg-white px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                data-testid="button-safety-case-save"
                type="button"
                onClick={() => saveSafetyCaseMutation.mutate()}
                disabled={saveSafetyCaseMutation.isPending}
                className={VYVA_MODAL_PRIMARY_ACTION_CLASS}
              >
                {saveSafetyCaseMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {t("common.save", "Save")}
              </button>
              <button
                data-testid="button-safety-case-export"
                type="button"
                onClick={() => {
                  if (reviewCase?.id) exportSafetyCaseMutation.mutate(reviewCase.id);
                }}
                disabled={!reviewCase?.id || exportSafetyCaseMutation.isPending}
                className={VYVA_MODAL_SECONDARY_ACTION_CLASS}
              >
                {exportSafetyCaseMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {t("meds.safety.export", "Export packet")}
              </button>
            </div>
          </div>
        </PurpleModal>
      ) : null}

      {editMed ? (
        <PurpleModal
          Icon={Pencil}
          kicker={t("meds.modalKicker", "Medication")}
          title={t("meds.editMedTitle", "Edit medication")}
          titleId="edit-medication-title"
          onClose={() => setEditMed(null)}
          closeLabel={t("common.close", "Close")}
          panelTestId="modal-edit-medication"
          size="narrow"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-med-name">{t("meds.editName", "Medication name")}</Label>
              <Input
                id="edit-med-name"
                data-testid="input-edit-med-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t("meds.editNamePlaceholder", "e.g. Metformin")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-med-dosage">{t("meds.editDosage", "Dosage")}</Label>
              <Input
                id="edit-med-dosage"
                data-testid="input-edit-med-dosage"
                value={editDosage}
                onChange={(e) => setEditDosage(e.target.value)}
                placeholder={t("meds.editDosagePlaceholder", "e.g. 500mg")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-med-frequency">{t("meds.editFrequency", "Frequency")}</Label>
              <Input
                id="edit-med-frequency"
                data-testid="input-edit-med-frequency"
                value={editFrequency}
                onChange={(e) => setEditFrequency(e.target.value)}
                placeholder={t("meds.editFrequencyPlaceholder", "e.g. twice daily")}
              />
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              data-testid="button-edit-med-cancel"
              onClick={() => setEditMed(null)}
              className={VYVA_MODAL_SECONDARY_ACTION_CLASS}
            >
              {t("common.cancel", "Cancel")}
            </button>
            <button
              data-testid="button-edit-med-save"
              onClick={() => {
                if (!editMed || !editName.trim()) return;
                updateMutation.mutate({
                  id: editMed.id,
                  name: editName.trim(),
                  dosage: editDosage.trim(),
                  frequency: editFrequency.trim(),
                });
              }}
              disabled={updateMutation.isPending || !editName.trim()}
              className={VYVA_MODAL_PRIMARY_ACTION_CLASS}
            >
              {updateMutation.isPending ? t("common.saving", "Saving...") : t("common.save", "Save")}
            </button>
          </div>
        </PurpleModal>
      ) : null}

      {deleteMed ? (
        <PurpleModal
          Icon={Trash2}
          kicker={t("meds.modalKicker", "Medication")}
          title={t("meds.deleteConfirmTitle", "Remove medication?")}
          subtitle={t("meds.deleteConfirmDesc", "{{name}} will be removed from your medication list. You can add it again at any time.", { name: deleteMed.displayName })}
          titleId="delete-medication-title"
          onClose={() => setDeleteMed(null)}
          closeLabel={t("common.close", "Close")}
          panelTestId="modal-delete-medication"
          size="narrow"
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              data-testid="button-delete-med-cancel"
              onClick={() => setDeleteMed(null)}
              className={VYVA_MODAL_SECONDARY_ACTION_CLASS}
            >
              {t("common.cancel", "Cancel")}
            </button>
            <button
              type="button"
              data-testid="button-delete-med-confirm"
              onClick={() => { if (deleteMed) deleteMutation.mutate(deleteMed.id); }}
              disabled={deleteMutation.isPending}
              className={`${VYVA_MODAL_PRIMARY_ACTION_CLASS} bg-[#B91C1C] shadow-[0_14px_28px_rgba(185,28,28,0.18)]`}
            >
              {deleteMutation.isPending ? t("common.removing", "Removing...") : t("meds.deleteConfirmAction", "Remove")}
            </button>
          </div>
        </PurpleModal>
      ) : null}
    </div>
  );
};

export default MedsScreen;
