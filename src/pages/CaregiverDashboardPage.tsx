import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Brain,
  Car,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Copy,
  FileText,
  HeartPulse,
  Mail,
  MessageSquare,
  PhoneCall,
  Pill,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  StickyNote,
  TimerReset,
  UserCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CaregiverBrainCoachPanel } from "@/components/CaregiverBrainCoachPanel";
import { VyvaWordmark } from "@/components/VyvaWordmark";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import {
  recordWelcomeModuleSelectionEvent,
  type WelcomeModuleHomeResponse,
} from "@/lib/welcomeModuleHome";

type SafetyStatus = "steady" | "recheck" | "share_with_caregiver" | "contact_doctor" | "urgent_help";
type WorkflowStatus = "new" | "acknowledged" | "contacted" | "watching" | "resolved";

type CaregiverAlert = {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  sent_to?: string[] | null;
  resolved_at?: string | null;
  created_at?: string | null;
};

type CaregiverSafetyResponse = {
  alerts: CaregiverAlert[];
  latest_analysis: {
    safety_status?: SafetyStatus | string | null;
    recommended_action?: SafetyStatus | string | null;
    senior_message?: string | null;
    caregiver_note?: string | null;
    risk_score?: number | null;
    risk_tier?: string | null;
    acknowledged_action?: string | null;
    acknowledged_at?: string | null;
    analysed_at?: string | null;
  } | null;
};

type DailyCheckinToday = {
  status: "completed" | "upcoming" | "due_now" | "overdue" | "not_scheduled";
  latest_checkin: {
    completed_at: string;
    feeling_label: string | null;
    highlight: string | null;
  } | null;
  no_response: {
    overdue: boolean;
    alert_created: boolean;
    can_alert_caregiver: boolean;
    reason: string | null;
  };
  caregiver_alert?: CaregiverAlert | null;
  message: string;
};

type TodayMedication = {
  id: string;
  medication_name: string;
  dosage?: string | null;
  frequency?: string | null;
  scheduled_times: string[];
  takenCountToday: number;
  scheduledCountToday: number;
  takenToday: boolean;
};

type MissedDose = {
  medication_name: string;
  scheduled_time: string;
  date: string;
};

type CaregiverMedsResponse = {
  today?: {
    medications: TodayMedication[];
  } | null;
  sevenDayAdherence?: {
    totalScheduled?: number | null;
    totalTaken?: number | null;
    missedDoses?: MissedDose[];
  };
};

type VitalsMetricSummary = {
  latest_value: string | null;
  latest_recorded_at: string | null;
  trend: (string | null)[];
  has_data: boolean;
};

type CaregiverVitalsResponse = {
  summary: Record<string, VitalsMetricSummary>;
  compliance_days: boolean[];
};

type AlertWorkflowEntry = {
  status: WorkflowStatus;
  acknowledgedAt?: string;
  contactedAt?: string;
  watchingAt?: string;
  resolvedAt?: string;
};

type AlertWorkflowState = Record<string, AlertWorkflowEntry>;

type ContactTarget = {
  label: string;
  href?: string;
  kind: "call" | "email" | "record";
};

type ProfileContactsResponse = {
  profileId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  phone?: string | null;
  relationship?: string | null;
  caregiverName?: string | null;
  caregiverContact?: string | null;
  gpName?: string | null;
  gpPhone?: string | null;
  gpEmail?: string | null;
} | null;

type CaregiverDashboardNote = {
  id: string;
  note: string;
  concernTag?: string | null;
  caregiverName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type CaregiverDashboardResponse = {
  activeProfile: {
    profileId: string;
    role?: string | null;
    profileCount?: number | null;
    needsProfileSelection?: boolean;
    relationship?: string | null;
    displayName?: string | null;
  };
  profile: NonNullable<ProfileContactsResponse>;
  contacts?: {
    primaryPhone?: string | null;
    whatsapp?: string | null;
    caregiver?: {
      name?: string | null;
      contact?: string | null;
    };
    gp?: {
      name?: string | null;
      phone?: string | null;
      email?: string | null;
    };
  };
  notes: CaregiverDashboardNote[];
  latestNote?: CaregiverDashboardNote | null;
};

type CaregiverAlertNavigationActionKind = "doctor_help" | "schedule_appointment" | "book_ride";
type CaregiverAlertServiceActionKind = "call_gp" | "email_gp" | CaregiverAlertNavigationActionKind;

type CaregiverAlertDirectAction = {
  kind: "call_gp" | "email_gp";
  label: string;
  Icon: LucideIcon;
  href: string;
};

type CaregiverAlertNavigationAction = {
  kind: CaregiverAlertNavigationActionKind;
  label: string;
  Icon: LucideIcon;
  href?: undefined;
};

type CaregiverAlertServiceAction = CaregiverAlertDirectAction | CaregiverAlertNavigationAction;

const WORKFLOW_STORAGE_KEY = "vyva_caregiver_alert_workflow_v1";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeStatus(value: unknown): SafetyStatus {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "urgent_help" || raw === "urgent") return "urgent_help";
  if (raw === "contact_doctor" || raw === "doctor_today") return "contact_doctor";
  if (raw === "share_with_caregiver" || raw === "notify") return "share_with_caregiver";
  if (raw === "recheck" || raw === "watch") return "recheck";
  return "steady";
}

function statusMeta(status: SafetyStatus) {
  if (status === "urgent_help") return { label: "Urgent help", color: "#DC2626", bg: "#FEF2F2", Icon: AlertTriangle };
  if (status === "contact_doctor") return { label: "Contact doctor", color: "#B45309", bg: "#FFF7ED", Icon: HeartPulse };
  if (status === "share_with_caregiver") return { label: "Caregiver aware", color: "#6B21A8", bg: "#F5F3FF", Icon: Bell };
  if (status === "recheck") return { label: "Recheck", color: "#0369A1", bg: "#EFF6FF", Icon: Clock };
  return { label: "Steady", color: "#047857", bg: "#ECFDF5", Icon: ShieldCheck };
}

function medicationStatusMeta(missedCount: number, hasFullSchedule: boolean) {
  if (missedCount > 0) return { label: "Follow-up", color: "#B45309", bg: "#FFF7ED", Icon: Pill };
  if (!hasFullSchedule) return { label: "Alert-only view", color: "#6B21A8", bg: "#F5F3FF", Icon: Pill };
  return { label: "On track", color: "#047857", bg: "#ECFDF5", Icon: CheckCircle2 };
}

function vitalsStatusMeta(hasTrendData: boolean) {
  return hasTrendData
    ? { label: "Trend data", color: "#6B21A8", bg: "#F5F3FF", Icon: HeartPulse }
    : { label: "No recent data", color: "#7A6D65", bg: "#F8F3EC", Icon: HeartPulse };
}

function workflowMeta(status: WorkflowStatus) {
  if (status === "resolved") return { label: "Locally resolved", color: "#047857", bg: "#ECFDF5" };
  if (status === "contacted") return { label: "Contacted", color: "#6B21A8", bg: "#F5F3FF" };
  if (status === "watching") return { label: "Watching", color: "#0369A1", bg: "#EFF6FF" };
  if (status === "acknowledged") return { label: "Acknowledged", color: "#B45309", bg: "#FFF7ED" };
  return { label: "New", color: "#B91C1C", bg: "#FEF2F2" };
}

function resolvedAlertMeta() {
  return { label: "Resolved", color: "#047857", bg: "#ECFDF5" };
}

function formatTime(value?: string | null) {
  if (!value) return "No recent update";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const VITAL_METRICS = [
  { key: "hr", label: "Heart rate", unit: "bpm" },
  { key: "bp", label: "Blood pressure", unit: "mmHg" },
  { key: "rr", label: "Breathing rate", unit: "breaths/min" },
] as const;

function sourceLabel(alertType: string) {
  const raw = alertType.replace(/_/g, " ").trim();
  if (!raw) return "Caregiver alert";
  if (alertType === "vitals_safety_check") return "Vitals safety";
  if (alertType === "triage_report") return "Symptom report";
  if (alertType === "daily_checkin_no_response") return "Daily check-in";
  return raw.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function severityRank(severity: string) {
  const raw = severity.toLowerCase();
  if (raw.includes("urgent") || raw.includes("critical")) return 4;
  if (raw.includes("doctor") || raw.includes("warning")) return 3;
  if (raw.includes("caregiver") || raw.includes("info")) return 2;
  return 1;
}

function createdTime(alert: CaregiverAlert) {
  return alert.created_at ? new Date(alert.created_at).getTime() : 0;
}

function isRecent(alert: CaregiverAlert) {
  if (!alert.created_at) return false;
  return Date.now() - new Date(alert.created_at).getTime() <= ONE_WEEK_MS;
}

function loadWorkflowState(): AlertWorkflowState {
  if (typeof window === "undefined") return {};
  try {
    const saved = window.localStorage.getItem(WORKFLOW_STORAGE_KEY);
    return saved ? JSON.parse(saved) as AlertWorkflowState : {};
  } catch {
    return {};
  }
}

function contactTargetFor(rawValue: string): ContactTarget | null {
  const value = rawValue.trim();
  if (!value) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { label: value, href: `mailto:${value}`, kind: "email" };

  const dialable = value.replace(/[^\d+]/g, "");
  if (dialable.length >= 7) return { label: value, href: `tel:${dialable}`, kind: "call" };

  return { label: value, kind: "record" };
}

function contactsFor(alert: CaregiverAlert): ContactTarget[] {
  return Array.from(new Set(alert.sent_to ?? []))
    .map(contactTargetFor)
    .filter((target): target is ContactTarget => Boolean(target));
}

function alertTextForMatching(alert: CaregiverAlert) {
  return `${alert.alert_type} ${alert.severity} ${alert.message}`.toLowerCase();
}

function missedDoseAlertFor(dose: MissedDose): CaregiverAlert {
  return {
    id: `missed-dose-${dose.medication_name}-${dose.date}-${dose.scheduled_time}`,
    alert_type: "medication_adherence",
    severity: "warning",
    message: `Missed dose: ${dose.medication_name} at ${dose.scheduled_time} on ${formatDate(dose.date)}.`,
    sent_to: [],
    created_at: `${dose.date}T00:00:00.000Z`,
    resolved_at: null,
  };
}

export function caregiverAlertServiceActionKindsFor(alert: CaregiverAlert, status?: SafetyStatus): CaregiverAlertServiceActionKind[] {
  if (alert.resolved_at) return [];
  const text = alertTextForMatching(alert);
  const needsClinicalFollowUp =
    status === "urgent_help"
    || status === "contact_doctor"
    || severityRank(alert.severity) >= 3
    || /\b(urgent|emergency|doctor|medic|clinician|clinic|hospital|triage|symptom|vitals|chest|pain|breath|fall|help now)\b/.test(text);

  return needsClinicalFollowUp ? ["doctor_help", "schedule_appointment", "book_ride"] : [];
}

export function caregiverAlertContext(alert: CaregiverAlert, statusLabel = "Caregiver alert") {
  return [
    "VYVA caregiver alert",
    `Status: ${statusLabel}`,
    `Source: ${sourceLabel(alert.alert_type)}`,
    `Severity: ${alert.severity}`,
    alert.created_at ? `Created: ${formatTime(alert.created_at)}` : "",
    `Alert: ${alert.message}`,
  ].filter(Boolean).join("\n");
}

const CAREGIVER_ALERT_SERVICE_ACTIONS: Record<CaregiverAlertNavigationActionKind, CaregiverAlertNavigationAction> = {
  doctor_help: { kind: "doctor_help", label: "Doctor help", Icon: Stethoscope },
  schedule_appointment: { kind: "schedule_appointment", label: "Appointment", Icon: CalendarDays },
  book_ride: { kind: "book_ride", label: "Find transport", Icon: Car },
};

export function caregiverAlertServiceActionsFor(
  alert: CaregiverAlert,
  status?: SafetyStatus,
  profileContacts: ProfileContactsResponse = null,
): CaregiverAlertServiceAction[] {
  const navigationKinds = caregiverAlertServiceActionKindsFor(alert, status);
  if (navigationKinds.length === 0) return [];

  const statusLabel = status ? statusMeta(status).label : "Caregiver alert";
  const context = caregiverAlertContext(alert, statusLabel);
  const actions: CaregiverAlertServiceAction[] = [];
  const gpPhoneTarget = profileContacts?.gpPhone ? contactTargetFor(profileContacts.gpPhone) : null;
  const gpName = profileContacts?.gpName?.trim();
  const gpEmail = profileContacts?.gpEmail?.trim();

  if (gpPhoneTarget?.href && gpPhoneTarget.kind === "call") {
    actions.push({
      kind: "call_gp",
      label: gpName ? `Call ${gpName}` : "Call GP",
      Icon: PhoneCall,
      href: gpPhoneTarget.href,
    });
  }

  if (gpEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gpEmail)) {
    actions.push({
      kind: "email_gp",
      label: "Email GP",
      Icon: Mail,
      href: `mailto:${gpEmail}?subject=${encodeURIComponent("VYVA caregiver alert")}&body=${encodeURIComponent(context)}`,
    });
  }

  navigationKinds.forEach((kind) => actions.push(CAREGIVER_ALERT_SERVICE_ACTIONS[kind]));
  return actions;
}

function buildDigest(alerts: CaregiverAlert[], statusLabel: string, checkinMessage: string) {
  const recentAlerts = alerts.filter(isRecent);
  const openCount = alerts.filter((alert) => !alert.resolved_at).length;
  const severeCount = recentAlerts.filter((alert) => severityRank(alert.severity) >= 3).length;
  const alertLines = recentAlerts
    .slice(0, 3)
    .map((alert) => `- ${sourceLabel(alert.alert_type)}: ${alert.message.split("\n")[0]}`)
    .join("\n");

  return [
    "Weekly caregiver digest",
    `Current safety status: ${statusLabel}`,
    `Open alerts: ${openCount}`,
    `Higher-priority alerts this week: ${severeCount}`,
    `Daily check-in: ${checkinMessage}`,
    alertLines ? `Recent alerts:\n${alertLines}` : "Recent alerts: none",
  ].join("\n");
}

function nextCaregiverAction(status: SafetyStatus, openCount: number) {
  if (status === "urgent_help") return "Review the urgent alert, use the listed contact options, and mark the follow-up step when completed.";
  if (status === "contact_doctor") return "Use the contact actions for the alert and track whether the doctor or care contact was reached.";
  if (openCount > 0) return "Acknowledge each open alert, then mark the next caregiver step so everyone can see progress.";
  return "No open alert needs action right now.";
}

function profileLabel(profile: ProfileContactsResponse) {
  const firstName = profile?.preferredName?.trim() || profile?.firstName?.trim();
  const fullName = [profile?.firstName, profile?.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return firstName || fullName || "Mom";
}

function statusHeadline(status: SafetyStatus, name: string) {
  if (status === "urgent_help") return "Urgent help may be needed";
  if (status === "contact_doctor") return "Doctor follow-up is recommended";
  if (status === "recheck") return `${name} needs a recheck`;
  if (status === "share_with_caregiver") return `${name} has an update`;
  return `${name} is steady today`;
}

function statusSupport(status: SafetyStatus) {
  if (status === "urgent_help") return "Focus on the urgent alert first, then mark what was done.";
  if (status === "contact_doctor") return "Use the care-team actions and keep the follow-up status current.";
  if (status === "recheck") return "A quick follow-up can confirm whether anything has changed.";
  if (status === "share_with_caregiver") return "VYVA found something useful for the caregiver to review.";
  return "Everything looks calm. Keep an eye on the daily care signals.";
}

export default function CaregiverDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const [workflow, setWorkflow] = useState<AlertWorkflowState>(() => loadWorkflowState());
  const [copiedAlertId, setCopiedAlertId] = useState<string | null>(null);
  const [digestCopied, setDigestCopied] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [showMedsDetails, setShowMedsDetails] = useState(false);
  const [showVitalsDetails, setShowVitalsDetails] = useState(false);
  const [dismissedWelcomeIds, setDismissedWelcomeIds] = useState<string[]>([]);

  const welcomeModuleUrl = `/api/welcome-module/home?surface=caregiver_dashboard&language=${encodeURIComponent(language)}`;
  const { data: caregiverWelcome } = useQuery<WelcomeModuleHomeResponse>({
    queryKey: [welcomeModuleUrl],
    queryFn: async () => {
      const response = await apiFetch(welcomeModuleUrl);
      if (!response.ok) throw new Error("Could not load caregiver Welcome message");
      return response.json();
    },
    retry: false,
    staleTime: 60 * 1000,
  });
  const { data, isLoading, isError } = useQuery<CaregiverSafetyResponse>({
    queryKey: ["/api/vitals-engine/caregiver/latest-alerts"],
    queryFn: async () => {
      const response = await apiFetch("/api/vitals-engine/caregiver/latest-alerts");
      if (!response.ok) throw new Error("Could not load caregiver safety alerts");
      return response.json();
    },
    retry: false,
  });
  const { data: dailyCheckin } = useQuery<DailyCheckinToday>({
    queryKey: ["/api/checkins/today"],
    queryFn: async () => {
      const response = await apiFetch("/api/checkins/today");
      if (!response.ok) throw new Error("Could not load check-in status");
      return response.json();
    },
    retry: false,
  });
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    isError: isDashboardError,
  } = useQuery<CaregiverDashboardResponse>({
    queryKey: ["/api/caregiver/dashboard"],
    queryFn: async () => {
      const response = await apiFetch("/api/caregiver/dashboard");
      if (!response.ok) throw new Error("Could not load caregiver dashboard data");
      return response.json();
    },
    retry: false,
    staleTime: 2 * 60 * 1000,
  });
  const saveNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const response = await apiFetch("/api/caregiver/dashboard/notes", {
        method: "POST",
        body: JSON.stringify({ note, concernTag: "caregiver_note" }),
      });
      if (!response.ok) throw new Error("Could not save caregiver note");
      return response.json();
    },
    onSuccess: () => {
      setNoteDraft("");
      void queryClient.invalidateQueries({ queryKey: ["/api/caregiver/dashboard"] });
    },
  });
  const profileContacts = dashboardData?.profile ?? null;
  const caregiverNotes = dashboardData?.notes ?? [];
  const latestCareNote = dashboardData?.latestNote ?? caregiverNotes[0] ?? null;
  const caregiverProfileId = profileContacts?.profileId || "me";
  const caregiverProfileReady = !isDashboardLoading && !isDashboardError;
  const { data: medsData, isError: medsIsError } = useQuery<CaregiverMedsResponse>({
    queryKey: ["/api/meds/caregiver", caregiverProfileId, "summary"],
    queryFn: async () => {
      const response = await apiFetch(`/api/meds/caregiver/${encodeURIComponent(caregiverProfileId)}/summary`);
      if (!response.ok) throw new Error("Could not load caregiver medication summary");
      return response.json();
    },
    enabled: caregiverProfileReady,
    retry: false,
  });
  const { data: vitalsData, isError: vitalsIsError } = useQuery<CaregiverVitalsResponse>({
    queryKey: ["/api/vitals/caregiver", caregiverProfileId],
    queryFn: async () => {
      const response = await apiFetch(`/api/vitals/caregiver/${encodeURIComponent(caregiverProfileId)}`);
      if (!response.ok) throw new Error("Could not load caregiver vitals summary");
      return response.json();
    },
    enabled: caregiverProfileReady,
    retry: false,
  });

  const analysis = data?.latest_analysis ?? null;
  const status = normalizeStatus(analysis?.recommended_action ?? analysis?.safety_status);
  const meta = statusMeta(status);
  const Icon = meta.Icon;
  const alerts = useMemo(
    () => [...(data?.alerts ?? [])].sort((left, right) => createdTime(right) - createdTime(left)),
    [data?.alerts],
  );
  const openAlerts = alerts.filter((alert) => !alert.resolved_at);
  const recentAlerts = alerts.filter(isRecent);
  const checkinMessage = dailyCheckin?.latest_checkin?.feeling_label ?? dailyCheckin?.message ?? "No check-in update";
  const digestText = buildDigest(alerts, meta.label, checkinMessage);
  const medicationsToday = medsData?.today?.medications ?? [];
  const totalDosesToday = medicationsToday.reduce((sum, medication) => sum + medication.scheduledCountToday, 0);
  const takenDosesToday = medicationsToday.reduce((sum, medication) => sum + medication.takenCountToday, 0);
  const missedDoses = medsData?.sevenDayAdherence?.missedDoses ?? [];
  const missedDoseCount = missedDoses.length;
  const hasFullMedicationSchedule = Boolean(medsData?.today);
  const medicationMeta = medicationStatusMeta(missedDoseCount, hasFullMedicationSchedule);
  const MedicationIcon = medicationMeta.Icon;
  const vitalsMetrics = VITAL_METRICS.map((metric) => ({
    ...metric,
    entry: vitalsData?.summary?.[metric.key],
  }));
  const hasVitalsTrendData = vitalsMetrics.some((metric) => metric.entry?.has_data);
  const vitalsMeta = vitalsStatusMeta(hasVitalsTrendData);
  const VitalsIcon = vitalsMeta.Icon;
  const caredForName = profileLabel(profileContacts);
  const caredForInitial = caredForName.trim().charAt(0).toUpperCase() || "M";
  const caredForCallTarget = profileContacts?.phone ? contactTargetFor(profileContacts.phone) : null;
  const pageHeadline = statusHeadline(status, caredForName);
  const pageSupport = analysis?.caregiver_note ?? analysis?.senior_message ?? statusSupport(status);
  const careNotePreview = latestCareNote?.note ?? "No saved caregiver note yet.";
  const medicationSignalLabel = hasFullMedicationSchedule
    ? missedDoseCount > 0 ? "Needs follow-up" : "All taken"
    : "Missed-dose alerts";
  const vitalsSignalLabel = hasVitalsTrendData ? "In range" : "No recent data";
  const checkinSignalLabel = dailyCheckin?.latest_checkin
    ? "Completed"
    : dailyCheckin?.status === "overdue"
      ? "Overdue"
      : dailyCheckin?.status === "due_now"
        ? "Due now"
        : "Waiting";
  const attentionAlerts = openAlerts.slice(0, 2);
  const caregiverWelcomeMessage = caregiverWelcome?.message ?? null;
  const visibleCaregiverWelcome = caregiverWelcomeMessage && !dismissedWelcomeIds.includes(caregiverWelcomeMessage.templateId)
    ? caregiverWelcomeMessage
    : null;

  useEffect(() => {
    if (!visibleCaregiverWelcome) return;
    recordWelcomeModuleSelectionEvent(visibleCaregiverWelcome, "shown", language, "/caregiver");
  }, [language, visibleCaregiverWelcome?.templateId]);

  function persistWorkflow(next: AlertWorkflowState) {
    setWorkflow(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(next));
    }
  }

  function updateWorkflow(alertId: string, statusValue: WorkflowStatus) {
    const now = new Date().toISOString();
    const current = workflow[alertId] ?? { status: "new" as WorkflowStatus };
    const nextEntry: AlertWorkflowEntry = { ...current, status: statusValue };

    if (statusValue === "acknowledged" && !nextEntry.acknowledgedAt) nextEntry.acknowledgedAt = now;
    if (statusValue === "contacted") nextEntry.contactedAt = now;
    if (statusValue === "watching") nextEntry.watchingAt = now;
    if (statusValue === "resolved") nextEntry.resolvedAt = now;

    persistWorkflow({ ...workflow, [alertId]: nextEntry });
  }

  async function copyAlert(alert: CaregiverAlert) {
    const text = `${sourceLabel(alert.alert_type)}\n${alert.message}`;
    await navigator.clipboard?.writeText(text);
    setCopiedAlertId(alert.id);
    window.setTimeout(() => setCopiedAlertId(null), 1800);
  }

  async function copyDigest() {
    await navigator.clipboard?.writeText(digestText);
    setDigestCopied(true);
    window.setTimeout(() => setDigestCopied(false), 1800);
  }

  function saveCaregiverNote() {
    const note = noteDraft.trim();
    if (!note || saveNoteMutation.isPending) return;
    saveNoteMutation.mutate(note);
  }

  function dismissCaregiverWelcome() {
    if (!visibleCaregiverWelcome) return;
    recordWelcomeModuleSelectionEvent(visibleCaregiverWelcome, "dismissed", language, "/caregiver");
    setDismissedWelcomeIds((ids) => (
      ids.includes(visibleCaregiverWelcome.templateId)
        ? ids
        : [...ids, visibleCaregiverWelcome.templateId]
    ));
  }

  function openCaregiverWelcome() {
    if (!visibleCaregiverWelcome) return;
    const route = visibleCaregiverWelcome.actionRoute ?? "/caregiver";
    recordWelcomeModuleSelectionEvent(visibleCaregiverWelcome, "opened", language, route);
    if (!visibleCaregiverWelcome.actionRoute) return;
    navigate(visibleCaregiverWelcome.actionRoute, {
      state: {
        source: "caregiver_welcome",
        welcomeTemplateId: visibleCaregiverWelcome.templateId,
        welcomeAudience: visibleCaregiverWelcome.audience,
        welcomeMomentType: visibleCaregiverWelcome.momentType,
        welcomeProfileAction: visibleCaregiverWelcome.profileAction ?? null,
      },
    });
  }

  function openCaregiverAlertServiceAction(alert: CaregiverAlert, action: CaregiverAlertNavigationActionKind) {
    const context = caregiverAlertContext(alert, meta.label);
    if (action === "doctor_help") {
      navigate("/health/doctor", {
        state: {
          autoStartVoice: true,
          latestSymptomReport: context,
          source: "caregiver_alert",
        },
      });
      return;
    }

    navigate("/concierge", {
      state: {
        conciergePrefill: {
          kind: action === "schedule_appointment" ? "appointment" : "ride",
          message: action === "schedule_appointment"
            ? `Please help prepare a care appointment based on this caregiver alert. Ask me to confirm before booking.\n\n${context}`
            : `Please help prepare safe transport for follow-up on this caregiver alert. Ask me to confirm before booking.\n\n${context}`,
          source: "caregiver_alert",
        },
      },
    });
  }

  return (
    <main className="min-h-screen bg-vyva-cream px-4 py-5 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-[1400px]">
        <div className="rounded-[24px] border border-vyva-border bg-[#FFFCF8] p-4 shadow-[0_24px_70px_rgba(47,33,53,0.08)] sm:p-6 lg:p-8">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
              <div>
                <VyvaWordmark className="h-auto w-[180px] sm:w-[220px]" />
                <p className="sr-only">Caregiver action center</p>
              </div>
              <button
                type="button"
                className="inline-flex min-h-[58px] w-full items-center gap-3 rounded-[18px] border border-vyva-border bg-white px-4 text-left font-body shadow-sm transition hover:border-vyva-purple/35 sm:w-auto sm:min-w-[220px]"
                aria-label={`Selected profile ${caredForName}`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vyva-purple-light font-body text-[17px] font-black text-vyva-purple">
                  {caredForInitial}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-black text-vyva-text-1">{caredForName}</span>
                  <span className="block text-[12px] font-bold text-vyva-text-3">Family care view</span>
                </span>
                <ChevronDown className="h-5 w-5 shrink-0 text-vyva-text-3" />
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <div className="flex items-center gap-3 rounded-[16px] bg-vyva-warm px-4 py-3 font-body text-vyva-text-1">
                <RefreshCw className="h-5 w-5 text-vyva-gold" />
                <span>
                  <span className="block text-[12px] font-bold text-vyva-text-2">Last updated</span>
                  <span className="block text-[14px] font-black">{formatTime(analysis?.analysed_at)}</span>
                </span>
              </div>
              {caredForCallTarget?.href ? (
                <a
                  href={caredForCallTarget.href}
                  className="inline-flex min-h-[58px] items-center justify-center gap-3 rounded-[18px] bg-vyva-purple px-6 font-body text-[16px] font-black text-white shadow-vyva-fab transition hover:brightness-105"
                >
                  <PhoneCall className="h-5 w-5" />
                  Call {caredForName}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const firstContact = contactsFor(openAlerts[0] ?? { id: "", alert_type: "", severity: "", message: "" })[0];
                    if (firstContact?.href) window.location.href = firstContact.href;
                  }}
                  className="inline-flex min-h-[58px] items-center justify-center gap-3 rounded-[18px] bg-vyva-purple px-6 font-body text-[16px] font-black text-white shadow-vyva-fab transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={openAlerts.length === 0}
                >
                  <PhoneCall className="h-5 w-5" />
                  Call {caredForName}
                </button>
              )}
            </div>
          </header>

          {visibleCaregiverWelcome ? (
            <section
              className="mt-6 rounded-[22px] border border-vyva-purple/20 bg-[linear-gradient(135deg,#5B0FA3_0%,#7C2CCB_52%,#8B5CF6_100%)] p-5 text-white shadow-[0_18px_44px_rgba(107,33,168,0.20)] sm:p-6"
              data-testid="caregiver-welcome-card"
              aria-label="Caregiver Welcome message"
            >
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-white/16 text-white ring-1 ring-white/20">
                    <Sparkles className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-body text-[12px] font-black uppercase tracking-[0.13em] text-white/72">
                      Welcome
                    </p>
                    <h2 className="mt-2 max-w-3xl font-display text-[28px] font-bold leading-[1.08] text-white sm:text-[36px]">
                      {visibleCaregiverWelcome.headline}
                    </h2>
                    <p className="mt-3 max-w-3xl font-body text-[16px] font-semibold leading-relaxed text-white/86 sm:text-[17px]">
                      {visibleCaregiverWelcome.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 self-start md:self-center">
                  {visibleCaregiverWelcome.ctaLabel && visibleCaregiverWelcome.actionRoute ? (
                    <button
                      type="button"
                      onClick={openCaregiverWelcome}
                      className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[15px] bg-white px-4 font-body text-[14px] font-black text-vyva-purple shadow-[0_10px_24px_rgba(47,33,53,0.13)] transition hover:bg-vyva-purple-pale"
                      data-testid="button-caregiver-welcome-open"
                    >
                      {visibleCaregiverWelcome.ctaLabel}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={dismissCaregiverWelcome}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-[15px] bg-white/14 text-white ring-1 ring-white/20 transition hover:bg-white/22"
                    aria-label="Dismiss Welcome message"
                    data-testid="button-caregiver-welcome-dismiss"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {isLoading || isDashboardLoading ? (
            <div className="mt-7 flex min-h-[220px] items-center justify-center rounded-[16px] bg-[#F8FAF8]">
              <div className="text-center font-body text-[18px] font-bold text-[#5F6B63]">
                <Clock className="mx-auto mb-3 h-7 w-7 animate-pulse text-[#2F6F5E]" />
                Loading caregiver action center
              </div>
            </div>
          ) : isError || isDashboardError ? (
            <div className="mt-7 rounded-[16px] bg-[#FEF2F2] p-5 font-body text-[18px] font-bold text-[#B91C1C]">
              Could not load the latest caregiver view.
            </div>
          ) : (
            <>
              <div className="mt-8 grid items-stretch gap-5 lg:grid-cols-[1.55fr_1fr]">
                <section className="rounded-[22px] border border-vyva-border bg-[linear-gradient(135deg,#FFFCF8_0%,#F7F2FF_100%)] p-5 sm:p-7">
                  <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-start">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-vyva-purple-light text-vyva-purple shadow-[0_10px_28px_rgba(107,33,168,0.10)]">
                      <Icon className="h-10 w-10" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full px-3 py-1 font-body text-[12px] font-black" style={{ background: meta.bg, color: meta.color }}>
                          {meta.label}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 font-body text-[12px] font-black text-vyva-purple shadow-sm">
                          Unified safety summary
                        </span>
                        {analysis?.acknowledged_at && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-vyva-green-light px-3 py-1 font-body text-[12px] font-black text-vyva-green">
                            <CheckCircle2 className="h-4 w-4" />
                            Latest analysis acknowledged
                          </span>
                        )}
                      </div>
                      <h1 className="mt-5 font-display text-[34px] font-bold leading-[1.08] text-vyva-text-1 sm:text-[44px]">
                        {pageHeadline}
                      </h1>
                      <p className="mt-3 max-w-2xl font-body text-[17px] font-semibold leading-relaxed text-vyva-text-2">
                        {pageSupport}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 grid gap-3 md:grid-cols-3">
                    <div className="flex min-h-[92px] items-center gap-3 rounded-[18px] border border-vyva-border bg-white/78 px-4 py-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-vyva-purple-light text-vyva-purple">
                        <Pill className="h-6 w-6" />
                      </span>
                      <span>
                        <span className="block font-body text-[15px] font-black text-vyva-text-1">Medications</span>
                        <span className="block font-body text-[13px] font-bold text-vyva-text-2">{medicationSignalLabel}</span>
                      </span>
                    </div>
                    <div className="flex min-h-[92px] items-center gap-3 rounded-[18px] border border-vyva-border bg-white/78 px-4 py-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-vyva-purple-light text-vyva-purple">
                        <HeartPulse className="h-6 w-6" />
                      </span>
                      <span>
                        <span className="block font-body text-[15px] font-black text-vyva-text-1">Vitals</span>
                        <span className="block font-body text-[13px] font-bold text-vyva-text-2">{vitalsSignalLabel}</span>
                      </span>
                    </div>
                    <div className="flex min-h-[92px] items-center gap-3 rounded-[18px] border border-vyva-border bg-white/78 px-4 py-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-vyva-purple-light text-vyva-purple">
                        <MessageSquare className="h-6 w-6" />
                      </span>
                      <span>
                        <span className="block font-body text-[15px] font-black text-vyva-text-1">Check-in</span>
                        <span className="block font-body text-[13px] font-bold text-vyva-text-2">{checkinSignalLabel}</span>
                      </span>
                    </div>
                  </div>
                </section>

                <section className="rounded-[22px] border border-vyva-border bg-white p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vyva-gold-light text-vyva-gold">
                      <Bell className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-body text-[12px] font-black uppercase tracking-[0.13em] text-vyva-text-3">Needs attention</p>
                      <h2 className="font-body text-[22px] font-black text-vyva-text-1">{openAlerts.length + missedDoseCount} open</h2>
                    </div>
                  </div>

                  {attentionAlerts.length === 0 && missedDoseCount === 0 ? (
                    <div className="mt-5 rounded-[18px] bg-vyva-green-light p-4 font-body text-[15px] font-bold leading-relaxed text-vyva-green">
                      No action needed right now. The care view is quiet.
                    </div>
                  ) : (
                    <div className="mt-5 divide-y divide-vyva-border">
                      {attentionAlerts.map((alert) => (
                        <div key={alert.id} className="py-4 first:pt-0">
                          <div className="flex items-start gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-vyva-gold-light text-vyva-gold">
                              <AlertTriangle className="h-5 w-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-body text-[16px] font-black text-vyva-text-1">{sourceLabel(alert.alert_type)}</p>
                              <p className="mt-1 line-clamp-2 font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">
                                {alert.message.split("\n")[0]}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => document.getElementById("caregiver-alerts")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                              className="rounded-[14px] border border-vyva-purple/30 bg-white px-3 py-2 font-body text-[13px] font-black text-vyva-purple"
                            >
                              Review
                            </button>
                          </div>
                        </div>
                      ))}
                      {missedDoses.slice(0, Math.max(0, 2 - attentionAlerts.length)).map((dose) => (
                        <div key={`${dose.medication_name}-${dose.date}-${dose.scheduled_time}`} className="py-4 first:pt-0">
                          <div className="flex items-start gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-vyva-gold-light text-vyva-gold">
                              <Pill className="h-5 w-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-body text-[16px] font-black text-vyva-text-1">Medication follow-up</p>
                              <p className="mt-1 font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">
                                {dose.medication_name} at {dose.scheduled_time}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowMedsDetails(true)}
                              className="rounded-[14px] border border-vyva-purple/30 bg-white px-3 py-2 font-body text-[13px] font-black text-vyva-purple"
                            >
                              Remind
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <div className="mt-5 grid min-w-0 items-start gap-5 lg:grid-cols-2">
                <section className="min-w-0 rounded-[22px] border border-vyva-border bg-white p-5 shadow-[0_14px_34px_rgba(47,33,53,0.05)]" data-testid="caregiver-meds-card">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[16px]" style={{ background: medicationMeta.bg, color: medicationMeta.color }}>
                      <MedicationIcon className="h-7 w-7" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-body text-[12px] font-black uppercase tracking-[0.13em] text-vyva-text-3">Medications</p>
                        <span className="rounded-full px-3 py-1 font-body text-[12px] font-bold" style={{ background: medicationMeta.bg, color: medicationMeta.color }}>
                          {medicationMeta.label}
                        </span>
                      </div>
                      {medsIsError ? (
                        <p className="mt-3 font-body text-[16px] font-bold leading-relaxed text-[#B91C1C]">
                          Medication access is not available for this caregiver view.
                        </p>
                      ) : (
                        <>
                          <p className="mt-3 font-body text-[20px] font-black leading-relaxed text-vyva-text-1">
                            {hasFullMedicationSchedule
                              ? `Today's adherence: ${takenDosesToday} of ${totalDosesToday} doses today`
                              : "Missed-dose alerts only"}
                          </p>
                          <p className="mt-2 font-body text-[14px] font-semibold text-vyva-text-2">
                            {missedDoseCount === 1 ? "1 missed dose this week" : `${missedDoseCount} missed doses this week`}
                            {typeof medsData?.sevenDayAdherence?.totalScheduled === "number" && typeof medsData?.sevenDayAdherence?.totalTaken === "number"
                              ? ` - ${medsData.sevenDayAdherence.totalTaken} of ${medsData.sevenDayAdherence.totalScheduled} scheduled doses over 7 days`
                              : ""}
                          </p>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMedsDetails((value) => !value)}
                      className="col-span-2 inline-flex min-h-[42px] w-fit items-center gap-2 rounded-[14px] border border-vyva-purple/25 bg-vyva-purple-pale px-3 font-body text-[13px] font-black text-vyva-purple sm:col-span-1"
                      aria-expanded={showMedsDetails}
                    >
                      {showMedsDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      Details
                    </button>
                  </div>

                  {showMedsDetails ? (
                    <div className="mt-4 space-y-3 border-t border-vyva-border pt-4">
                      {hasFullMedicationSchedule ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {medicationsToday.length > 0 ? medicationsToday.map((medication) => (
                            <div key={medication.id} className="rounded-[16px] bg-vyva-cream p-3">
                              <p className="font-body text-[15px] font-black text-vyva-text-1">{medication.medication_name}</p>
                              <p className="mt-1 font-body text-[13px] font-semibold text-vyva-text-2">
                                {medication.takenCountToday} of {medication.scheduledCountToday} today
                                {medication.scheduled_times.length ? ` - ${medication.scheduled_times.join(", ")}` : ""}
                              </p>
                            </div>
                          )) : (
                            <p className="rounded-[16px] bg-vyva-cream p-3 font-body text-[14px] font-bold text-vyva-text-2">
                              No active medication schedule is visible today.
                            </p>
                          )}
                        </div>
                      ) : null}

                      <div className="rounded-[16px] border border-vyva-border bg-[#FFFCF8] p-3">
                        <p className="mb-3 font-body text-[13px] font-black uppercase tracking-[0.12em] text-vyva-text-3">Missed-dose follow-up</p>
                        {missedDoses.length > 0 ? (
                          <div className="space-y-3">
                            {missedDoses.slice(0, 4).map((dose) => {
                              const alert = missedDoseAlertFor(dose);
                              const serviceActions = caregiverAlertServiceActionsFor(alert, "contact_doctor", profileContacts ?? null);
                              return (
                                <div key={alert.id} className="rounded-[12px] bg-white p-3">
                                  <p className="font-body text-[14px] font-black text-vyva-text-1">
                                    {dose.medication_name} - {dose.scheduled_time} on {formatDate(dose.date)}
                                  </p>
                                  {serviceActions.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {serviceActions.map((action) => {
                                        const ActionIcon = action.Icon;
                                        if (action.href) {
                                          return (
                                            <a
                                              key={`${alert.id}-${action.kind}`}
                                              href={action.href}
                                              className="inline-flex min-h-[40px] items-center gap-2 rounded-[14px] bg-vyva-purple px-3 font-body text-[13px] font-black text-white"
                                            >
                                              <ActionIcon className="h-4 w-4" />
                                              {action.label}
                                            </a>
                                          );
                                        }
                                        return (
                                          <button
                                            key={`${alert.id}-${action.kind}`}
                                            type="button"
                                            onClick={() => openCaregiverAlertServiceAction(alert, action.kind)}
                                            className="inline-flex min-h-[40px] items-center gap-2 rounded-[14px] bg-vyva-purple px-3 font-body text-[13px] font-black text-white"
                                          >
                                            <ActionIcon className="h-4 w-4" />
                                            {action.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="font-body text-[14px] font-semibold text-vyva-text-2">No missed-dose entries in this view.</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </section>

                <section className="min-w-0 rounded-[22px] border border-vyva-border bg-white p-5 shadow-[0_14px_34px_rgba(47,33,53,0.05)]" data-testid="caregiver-vitals-card">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[16px]" style={{ background: vitalsMeta.bg, color: vitalsMeta.color }}>
                      <VitalsIcon className="h-7 w-7" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-body text-[12px] font-black uppercase tracking-[0.13em] text-vyva-text-3">Vitals trend</p>
                        <span className="rounded-full px-3 py-1 font-body text-[12px] font-bold" style={{ background: vitalsMeta.bg, color: vitalsMeta.color }}>
                          {vitalsMeta.label}
                        </span>
                      </div>
                      {vitalsIsError ? (
                        <p className="mt-3 font-body text-[16px] font-bold leading-relaxed text-[#B91C1C]">
                          Vitals access is not available for this caregiver view.
                        </p>
                      ) : (
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          {vitalsMetrics.map((metric) => (
                            <div key={metric.key} className="rounded-[16px] bg-vyva-cream p-3">
                              <p className="font-body text-[12px] font-bold text-vyva-text-2">{metric.label}</p>
                              <p className="mt-1 font-body text-[18px] font-black text-vyva-text-1">
                                {metric.entry?.latest_value ? `${metric.entry.latest_value} ${metric.unit}` : "No reading"}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowVitalsDetails((value) => !value)}
                      className="col-span-2 inline-flex min-h-[42px] w-fit items-center gap-2 rounded-[14px] border border-vyva-purple/25 bg-vyva-purple-pale px-3 font-body text-[13px] font-black text-vyva-purple sm:col-span-1"
                      aria-expanded={showVitalsDetails}
                    >
                      {showVitalsDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      Details
                    </button>
                  </div>

                  {showVitalsDetails ? (
                    <div className="mt-4 space-y-3 border-t border-vyva-border pt-4">
                      {vitalsMetrics.map((metric) => {
                        const values = metric.entry?.trend?.filter((value): value is string => Boolean(value)) ?? [];
                        return (
                          <div key={metric.key} className="rounded-[16px] bg-vyva-cream p-3">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <p className="font-body text-[14px] font-black text-vyva-text-1">{metric.label}</p>
                              <p className="font-body text-[12px] font-semibold text-vyva-text-2">
                                Latest: {formatTime(metric.entry?.latest_recorded_at)}
                              </p>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {values.length > 0 ? values.map((value, index) => (
                                <span key={`${metric.key}-${value}-${index}`} className="rounded-full bg-white px-3 py-1 font-body text-[13px] font-bold text-vyva-text-1">
                                  {value} {metric.unit}
                                </span>
                              )) : (
                                <span className="font-body text-[13px] font-semibold text-vyva-text-2">No raw trend values for the last 7 days.</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <section className="rounded-[22px] border border-vyva-border bg-white p-5 shadow-[0_14px_34px_rgba(47,33,53,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-vyva-purple-light text-vyva-purple">
                      <ClipboardCheck className="h-6 w-6" />
                    </span>
                    <button
                      type="button"
                      onClick={() => document.getElementById("daily-checkin-card")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      className="font-body text-[13px] font-black text-vyva-purple"
                    >
                      View
                    </button>
                  </div>
                  <p className="mt-4 font-body text-[18px] font-black text-vyva-text-1">Check-ins</p>
                  <p className="mt-2 font-body text-[28px] font-black text-vyva-purple">{dailyCheckin?.status === "completed" ? "Done" : "Open"}</p>
                  <p className="mt-1 line-clamp-2 font-body text-[14px] font-semibold leading-relaxed text-vyva-text-2">
                    {dailyCheckin?.latest_checkin?.feeling_label ?? dailyCheckin?.message ?? "No check-in update yet."}
                  </p>
                </section>

                <section className="rounded-[22px] border border-vyva-border bg-white p-5 shadow-[0_14px_34px_rgba(47,33,53,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-vyva-gold-light text-vyva-gold">
                      <Bell className="h-6 w-6" />
                    </span>
                    <button
                      type="button"
                      onClick={() => document.getElementById("caregiver-alerts")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      className="font-body text-[13px] font-black text-vyva-purple"
                    >
                      Review
                    </button>
                  </div>
                  <p className="mt-4 font-body text-[18px] font-black text-vyva-text-1">Alerts</p>
                  <p className="mt-2 font-body text-[30px] font-black text-vyva-gold">{openAlerts.length}</p>
                  <p className="mt-1 font-body text-[14px] font-semibold text-vyva-text-2">
                    {openAlerts.length === 1 ? "Needs attention" : "Open caregiver alerts"}
                  </p>
                </section>

                <section className="rounded-[22px] border border-vyva-border bg-white p-5 shadow-[0_14px_34px_rgba(47,33,53,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-vyva-gold-light text-vyva-gold">
                      <Brain className="h-6 w-6" />
                    </span>
                    <button
                      type="button"
                      onClick={() => document.getElementById("brain-coach-controls")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      className="font-body text-[13px] font-black text-vyva-purple"
                    >
                      View plan
                    </button>
                  </div>
                  <p className="mt-4 font-body text-[18px] font-black text-vyva-text-1">Brain Coach</p>
                  <p className="mt-2 font-body text-[20px] font-black text-vyva-purple">Plan controls</p>
                  <p className="mt-1 font-body text-[14px] font-semibold leading-relaxed text-vyva-text-2">
                    Keep training light, consent-aware, and easy to nudge.
                  </p>
                </section>

                <section className="rounded-[22px] border border-vyva-border bg-[linear-gradient(135deg,#FFFCF8_0%,#F7F2FF_100%)] p-5 shadow-[0_14px_34px_rgba(47,33,53,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-vyva-purple-light text-vyva-purple">
                      <StickyNote className="h-6 w-6" />
                    </span>
                    <button
                      type="button"
                      onClick={() => document.getElementById("caregiver-notes-card")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      className="font-body text-[13px] font-black text-vyva-purple"
                    >
                      Add
                    </button>
                  </div>
                  <p className="mt-4 font-body text-[18px] font-black text-vyva-text-1">Care notes</p>
                  <p className="mt-2 font-body text-[30px] font-black text-vyva-purple">{caregiverNotes.length}</p>
                  <p className="mt-2 line-clamp-3 font-body text-[14px] font-semibold leading-relaxed text-vyva-text-2">
                    {careNotePreview}
                  </p>
                </section>
              </div>

              <div className="mt-5 grid items-start gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                <section id="caregiver-alerts" className="rounded-[22px] border border-vyva-border bg-white p-5 shadow-[0_14px_34px_rgba(47,33,53,0.05)]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-body text-[12px] font-black uppercase tracking-[0.13em] text-vyva-text-3">Alert timeline</p>
                      <h2 className="mt-1 font-body text-[22px] font-black text-vyva-text-1">Newest caregiver alerts</h2>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-vyva-purple-pale px-3 py-2 font-body text-[13px] font-black text-vyva-purple">
                      <Bell className="h-4 w-4" />
                      {openAlerts.length} open
                    </span>
                  </div>

                  {alerts.length === 0 ? (
                    <div className="mt-5 rounded-[16px] border border-vyva-border bg-vyva-cream p-5 font-body text-[17px] font-bold text-vyva-text-2">
                      No caregiver alerts yet.
                    </div>
                  ) : (
                    <div className="mt-5 space-y-4">
                      {alerts.map((alert) => {
                        const serverResolved = Boolean(alert.resolved_at);
                        const localStatus = serverResolved ? "resolved" : workflow[alert.id]?.status ?? "new";
                        const statusStyle = serverResolved ? resolvedAlertMeta() : workflowMeta(localStatus);
                        const contacts = contactsFor(alert);
                        const serviceActions = caregiverAlertServiceActionsFor(alert, status, profileContacts ?? null);
                        return (
                          <article key={alert.id} className="rounded-[20px] border border-vyva-border bg-[#FFFCF8] p-4 shadow-[0_10px_24px_rgba(47,33,53,0.05)]">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-vyva-cream px-3 py-1 font-body text-[12px] font-bold text-vyva-text-1">{sourceLabel(alert.alert_type)}</span>
                                  <span className="rounded-full bg-[#FFF7ED] px-3 py-1 font-body text-[12px] font-bold text-[#B45309]">{alert.severity}</span>
                                  <span className="rounded-full px-3 py-1 font-body text-[12px] font-bold" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                                    {statusStyle.label}
                                  </span>
                                </div>
                                <p className="mt-3 whitespace-pre-line font-body text-[17px] font-bold leading-relaxed text-vyva-text-1">{alert.message}</p>
                              </div>
                              <span className="whitespace-nowrap font-body text-[12px] font-semibold text-vyva-text-2">{formatTime(alert.created_at)}</span>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr]">
                              <div className="rounded-[16px] border border-vyva-border bg-white p-3">
                                <p className="mb-2 flex items-center gap-2 font-body text-[13px] font-black text-vyva-text-1">
                                  <PhoneCall className="h-4 w-4 text-vyva-purple" />
                                  Contact actions
                                </p>
                                {contacts.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {contacts.map((contact) => (
                                      contact.href ? (
                                        <a key={`${alert.id}-${contact.label}`} href={contact.href} className="inline-flex min-h-[42px] items-center gap-2 rounded-[14px] border border-vyva-border bg-vyva-cream px-3 font-body text-[13px] font-bold text-vyva-text-1">
                                          {contact.kind === "email" ? <Mail className="h-4 w-4" /> : <PhoneCall className="h-4 w-4" />}
                                          {contact.kind === "email" ? "Email" : "Call"} {contact.label}
                                        </a>
                                      ) : (
                                        <span key={`${alert.id}-${contact.label}`} className="inline-flex min-h-[42px] items-center gap-2 rounded-[14px] border border-vyva-border bg-vyva-cream px-3 font-body text-[13px] font-bold text-vyva-text-1">
                                          <UserCheck className="h-4 w-4" />
                                          {contact.label}
                                        </span>
                                      )
                                    ))}
                                    <button type="button" onClick={() => void copyAlert(alert)} className="inline-flex min-h-[42px] items-center gap-2 rounded-[14px] border border-vyva-border bg-white px-3 font-body text-[13px] font-bold text-vyva-text-1">
                                      <Copy className="h-4 w-4" />
                                      {copiedAlertId === alert.id ? "Copied" : "Copy note"}
                                    </button>
                                  </div>
                                ) : (
                                  <p className="font-body text-[14px] font-semibold leading-relaxed text-vyva-text-2">
                                    No contact target is attached to this alert yet.
                                  </p>
                                )}
                                {serviceActions.length > 0 ? (
                                  <div className="mt-3 border-t border-vyva-border pt-3" data-testid={`caregiver-alert-services-${alert.id}`}>
                                    <p className="mb-2 font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-text-3">
                                      Fast service access
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {serviceActions.map((action) => {
                                        const ActionIcon = action.Icon;
                                        if (action.href) {
                                          return (
                                            <a
                                              key={`${alert.id}-${action.kind}`}
                                              href={action.href}
                                              className="inline-flex min-h-[42px] items-center gap-2 rounded-[14px] bg-vyva-purple px-3 font-body text-[13px] font-black text-white shadow-vyva-fab"
                                              data-testid={`button-caregiver-alert-service-${alert.id}-${action.kind}`}
                                            >
                                              <ActionIcon className="h-4 w-4" />
                                              {action.label}
                                            </a>
                                          );
                                        }

                                        return (
                                          <button
                                            key={`${alert.id}-${action.kind}`}
                                            type="button"
                                            onClick={() => openCaregiverAlertServiceAction(alert, action.kind)}
                                            className="inline-flex min-h-[42px] items-center gap-2 rounded-[14px] bg-vyva-purple px-3 font-body text-[13px] font-black text-white shadow-vyva-fab"
                                            data-testid={`button-caregiver-alert-service-${alert.id}-${action.kind}`}
                                          >
                                            <ActionIcon className="h-4 w-4" />
                                            {action.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : null}
                              </div>

                              <div className="rounded-[16px] border border-vyva-border bg-white p-3">
                                <p className="flex items-center gap-2 font-body text-[13px] font-black text-vyva-text-1">
                                  <TimerReset className="h-4 w-4 text-vyva-purple" />
                                  Local caregiver workspace
                                </p>
                                <p className="mt-2 rounded-[12px] bg-vyva-cream p-2 font-body text-[12px] font-semibold leading-relaxed text-vyva-text-2">
                                  These status updates are stored on this device only.
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button type="button" onClick={() => updateWorkflow(alert.id, "acknowledged")} className="min-h-[42px] rounded-full bg-[#FFF7ED] px-3 font-body text-[13px] font-bold text-[#9A3412]">
                                    Acknowledge
                                  </button>
                                  <button type="button" onClick={() => updateWorkflow(alert.id, "contacted")} className="min-h-[42px] rounded-full bg-[#F5F3FF] px-3 font-body text-[13px] font-bold text-[#6B21A8]">
                                    Mark contacted
                                  </button>
                                  <button type="button" onClick={() => updateWorkflow(alert.id, "watching")} className="min-h-[42px] rounded-full bg-[#EFF6FF] px-3 font-body text-[13px] font-bold text-[#0369A1]">
                                    Keep watching
                                  </button>
                                  <button type="button" onClick={() => updateWorkflow(alert.id, "resolved")} className="min-h-[42px] rounded-full bg-[#ECFDF5] px-3 font-body text-[13px] font-bold text-[#047857]">
                                    Mark locally resolved
                                  </button>
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>

                <aside className="space-y-4">
                  {dailyCheckin && (
                    <section id="daily-checkin-card" className="rounded-[22px] border border-vyva-border bg-white p-5 shadow-[0_14px_34px_rgba(47,33,53,0.05)]">
                      <div className="flex items-start gap-4">
                        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px] ${
                          dailyCheckin.status === "overdue" ? "bg-[#FEF2F2] text-[#B91C1C]" :
                          dailyCheckin.status === "completed" ? "bg-[#ECFDF5] text-[#047857]" :
                          "bg-[#F5F3FF] text-[#6B21A8]"
                        }`}>
                          {dailyCheckin.status === "overdue" ? <AlertTriangle className="h-6 w-6" /> :
                            dailyCheckin.status === "completed" ? <CheckCircle2 className="h-6 w-6" /> :
                            <Clock className="h-6 w-6" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-body text-[12px] font-black uppercase tracking-[0.13em] text-vyva-text-3">Daily check-in</p>
                          <p className="mt-2 font-body text-[18px] font-black leading-relaxed text-vyva-text-1">
                            {dailyCheckin.latest_checkin?.feeling_label ?? dailyCheckin.message}
                          </p>
                          {dailyCheckin.latest_checkin?.completed_at ? (
                            <p className="mt-2 font-body text-[13px] font-semibold text-vyva-text-2">
                              Completed: {formatTime(dailyCheckin.latest_checkin.completed_at)}
                            </p>
                          ) : null}
                          {dailyCheckin.no_response.reason ? (
                            <p className="mt-2 rounded-[12px] bg-[#FFF7ED] px-3 py-2 font-body text-[13px] font-bold text-[#9A3412]">
                              Caregiver alert needs contact or consent.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </section>
                  )}

                  <section id="caregiver-notes-card" className="rounded-[22px] border border-vyva-border bg-white p-5 shadow-[0_14px_34px_rgba(47,33,53,0.05)]" data-testid="caregiver-notes-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-body text-[12px] font-black uppercase tracking-[0.13em] text-vyva-text-3">Care notes</p>
                        <h2 className="mt-1 font-body text-[22px] font-black text-vyva-text-1">Recent notes</h2>
                      </div>
                      <StickyNote className="h-6 w-6 text-vyva-purple" />
                    </div>

                    <div className="mt-4">
                      <textarea
                        aria-label="Add caregiver note"
                        value={noteDraft}
                        onChange={(event) => setNoteDraft(event.target.value)}
                        rows={3}
                        maxLength={1000}
                        className="min-h-[108px] w-full resize-none rounded-[16px] border border-vyva-border bg-[#FFFCF8] px-4 py-3 font-body text-[14px] font-semibold leading-relaxed text-vyva-text-1 outline-none transition placeholder:text-vyva-text-3 focus:border-vyva-purple"
                        placeholder={`Add a note about ${caredForName}`}
                      />
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="font-body text-[12px] font-bold text-vyva-text-3">
                          {noteDraft.trim().length}/1000
                        </p>
                        <button
                          type="button"
                          onClick={saveCaregiverNote}
                          disabled={!noteDraft.trim() || saveNoteMutation.isPending}
                          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] bg-vyva-purple px-4 font-body text-[14px] font-black text-white shadow-vyva-fab transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <StickyNote className="h-4 w-4" />
                          {saveNoteMutation.isPending ? "Saving" : "Save note"}
                        </button>
                      </div>
                      {saveNoteMutation.isError ? (
                        <p className="mt-3 rounded-[12px] bg-[#FEF2F2] px-3 py-2 font-body text-[13px] font-bold text-[#B91C1C]">
                          Could not save this note.
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-5 space-y-3">
                      {caregiverNotes.length > 0 ? caregiverNotes.slice(0, 4).map((note) => (
                        <article key={note.id} className="rounded-[16px] bg-vyva-cream p-3">
                          <p className="font-body text-[14px] font-bold leading-relaxed text-vyva-text-1">{note.note}</p>
                          <p className="mt-2 font-body text-[12px] font-semibold text-vyva-text-3">
                            {note.caregiverName ?? "Caregiver"} - {formatTime(note.createdAt)}
                          </p>
                        </article>
                      )) : (
                        <p className="rounded-[16px] bg-vyva-cream p-4 font-body text-[14px] font-semibold leading-relaxed text-vyva-text-2">
                          No saved caregiver notes yet.
                        </p>
                      )}
                    </div>
                  </section>

                  <div id="brain-coach-controls">
                    <CaregiverBrainCoachPanel />
                  </div>

                  <section className="rounded-[22px] border border-vyva-border bg-white p-5 shadow-[0_14px_34px_rgba(47,33,53,0.05)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-body text-[12px] font-black uppercase tracking-[0.13em] text-vyva-text-3">Weekly caregiver digest</p>
                        <h2 className="mt-1 font-body text-[22px] font-black text-vyva-text-1">Last 7 days</h2>
                      </div>
                      <CalendarDays className="h-6 w-6 text-vyva-purple" />
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between rounded-[16px] bg-vyva-cream p-3">
                        <span className="font-body text-[14px] font-bold text-vyva-text-2">Alerts</span>
                        <span className="font-body text-[18px] font-black text-vyva-text-1">{recentAlerts.length}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-[16px] bg-vyva-cream p-3">
                        <span className="font-body text-[14px] font-bold text-vyva-text-2">Higher priority</span>
                        <span className="font-body text-[18px] font-black text-vyva-text-1">{recentAlerts.filter((alert) => severityRank(alert.severity) >= 3).length}</span>
                      </div>
                      <div className="rounded-[16px] bg-vyva-cream p-3">
                        <p className="mb-2 flex items-center gap-2 font-body text-[14px] font-black text-vyva-text-1">
                          <FileText className="h-4 w-4 text-vyva-purple" />
                          Digest preview
                        </p>
                        <p className="whitespace-pre-line font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">{digestText}</p>
                      </div>
                      <button type="button" onClick={() => void copyDigest()} className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[14px] bg-vyva-purple px-4 font-body text-[14px] font-black text-white">
                        <MessageSquare className="h-4 w-4" />
                        {digestCopied ? "Digest copied" : "Copy weekly digest"}
                      </button>
                    </div>
                  </section>
                </aside>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
