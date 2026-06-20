import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Car,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  FileText,
  HeartPulse,
  Mail,
  MessageSquare,
  PhoneCall,
  ShieldCheck,
  Stethoscope,
  TimerReset,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { CaregiverBrainCoachPanel } from "@/components/CaregiverBrainCoachPanel";
import { apiFetch } from "@/lib/queryClient";

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
  gpName?: string | null;
  gpPhone?: string | null;
  gpEmail?: string | null;
} | null;

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

export default function CaregiverDashboardPage() {
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<AlertWorkflowState>(() => loadWorkflowState());
  const [copiedAlertId, setCopiedAlertId] = useState<string | null>(null);
  const [digestCopied, setDigestCopied] = useState(false);

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
  const { data: profileContacts } = useQuery<ProfileContactsResponse>({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      const response = await apiFetch("/api/profile");
      if (!response.ok) throw new Error("Could not load GP contact");
      return response.json();
    },
    retry: false,
    staleTime: 2 * 60 * 1000,
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
  const highestSeverity = recentAlerts.reduce((max, alert) => Math.max(max, severityRank(alert.severity)), 0);
  const checkinMessage = dailyCheckin?.latest_checkin?.feeling_label ?? dailyCheckin?.message ?? "No check-in update";
  const digestText = buildDigest(alerts, meta.label, checkinMessage);
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
    <main className="min-h-screen bg-[#F3F4F1] px-4 py-6 sm:px-5">
      <section className="mx-auto max-w-6xl">
        <Link to="/" className="mb-5 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-white px-4 font-body text-[15px] font-bold text-[#26312B] shadow-sm">
          <ArrowLeft className="h-5 w-5" />
          Back
        </Link>

        <div className="rounded-[18px] border border-[#D8DED6] bg-white p-5 shadow-[0_16px_36px_rgba(38,49,43,0.08)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-body text-[12px] font-bold uppercase tracking-[0.18em] text-[#2F6F5E]">Caregiver action center</p>
              <h1 className="mt-2 font-display text-[32px] italic leading-tight text-[#26312B] sm:text-[38px]">Safety alerts you can act on</h1>
              <p className="mt-3 max-w-2xl font-body text-[16px] font-semibold leading-relaxed text-[#5F6B63]">
                Existing caregiver alerts are organized into a timeline, contact actions, status tracking, and a weekly digest.
              </p>
            </div>
            <div className="rounded-[16px] border border-[#D8DED6] bg-[#F8FAF8] p-4">
              <p className="font-body text-[12px] font-bold uppercase tracking-[0.13em] text-[#5F6B63]">Action needed</p>
              <p className="mt-1 font-body text-[30px] font-bold text-[#26312B]">{openAlerts.length}</p>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-7 flex min-h-[220px] items-center justify-center rounded-[16px] bg-[#F8FAF8]">
              <div className="text-center font-body text-[18px] font-bold text-[#5F6B63]">
                <Clock className="mx-auto mb-3 h-7 w-7 animate-pulse text-[#2F6F5E]" />
                Loading caregiver action center
              </div>
            </div>
          ) : isError ? (
            <div className="mt-7 rounded-[16px] bg-[#FEF2F2] p-5 font-body text-[18px] font-bold text-[#B91C1C]">
              Could not load the latest safety view.
            </div>
          ) : (
            <>
              <div className="mt-7 grid items-start gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <section className="rounded-[16px] border border-[#D8DED6] bg-[#F8FAF8] p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[16px]" style={{ background: meta.bg, color: meta.color }}>
                      <Icon className="h-7 w-7" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full px-3 py-1 font-body text-[12px] font-bold" style={{ background: meta.bg, color: meta.color }}>
                          {meta.label}
                        </span>
                        {analysis?.acknowledged_at && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-3 py-1 font-body text-[12px] font-bold text-[#047857]">
                            <CheckCircle2 className="h-4 w-4" />
                            Latest analysis acknowledged
                          </span>
                        )}
                      </div>
                      <p className="mt-3 font-body text-[20px] font-bold leading-relaxed text-[#26312B]">
                        {analysis?.caregiver_note ?? analysis?.senior_message ?? "No safety check has been recorded yet."}
                      </p>
                      <p className="mt-3 font-body text-[14px] font-semibold text-[#5F6B63]">
                        Latest check: {formatTime(analysis?.analysed_at)}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-[16px] border border-[#D8DED6] bg-white p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#E8F5F0] text-[#2F6F5E]">
                      <ClipboardCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-body text-[12px] font-bold uppercase tracking-[0.13em] text-[#5F6B63]">Unified safety summary</p>
                      <p className="font-body text-[18px] font-bold text-[#26312B]">One place for follow-up</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-[12px] bg-[#F8FAF8] p-3">
                      <p className="font-body text-[12px] font-bold text-[#5F6B63]">Open alerts</p>
                      <p className="mt-1 font-body text-[24px] font-bold text-[#26312B]">{openAlerts.length}</p>
                    </div>
                    <div className="rounded-[12px] bg-[#F8FAF8] p-3">
                      <p className="font-body text-[12px] font-bold text-[#5F6B63]">This week</p>
                      <p className="mt-1 font-body text-[24px] font-bold text-[#26312B]">{recentAlerts.length}</p>
                    </div>
                    <div className="rounded-[12px] bg-[#F8FAF8] p-3">
                      <p className="font-body text-[12px] font-bold text-[#5F6B63]">Highest level</p>
                      <p className="mt-1 font-body text-[20px] font-bold text-[#26312B]">{highestSeverity >= 3 ? "High" : highestSeverity > 0 ? "Routine" : "None"}</p>
                    </div>
                    <div className="rounded-[12px] bg-[#F8FAF8] p-3">
                      <p className="font-body text-[12px] font-bold text-[#5F6B63]">Check-in</p>
                      <p className="mt-1 truncate font-body text-[20px] font-bold text-[#26312B]">{dailyCheckin?.status ?? "Unknown"}</p>
                    </div>
                  </div>
                  <p className="mt-4 rounded-[12px] bg-[#FFF7ED] p-3 font-body text-[14px] font-bold leading-relaxed text-[#9A3412]">
                    {nextCaregiverAction(status, openAlerts.length)}
                  </p>
                </section>
              </div>

              <div className="mt-5 grid items-start gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                <section className="rounded-[16px] border border-[#D8DED6] bg-white p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-body text-[12px] font-bold uppercase tracking-[0.13em] text-[#5F6B63]">Alert timeline</p>
                      <h2 className="mt-1 font-body text-[22px] font-bold text-[#26312B]">Newest caregiver alerts</h2>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#E8F5F0] px-3 py-2 font-body text-[13px] font-bold text-[#2F6F5E]">
                      <Bell className="h-4 w-4" />
                      {openAlerts.length} open
                    </span>
                  </div>

                  {alerts.length === 0 ? (
                    <div className="mt-5 rounded-[14px] border border-[#D8DED6] bg-[#F8FAF8] p-5 font-body text-[17px] font-bold text-[#5F6B63]">
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
                          <article key={alert.id} className="rounded-[16px] border border-[#D8DED6] bg-[#FBFCFB] p-4 shadow-[0_8px_18px_rgba(38,49,43,0.05)]">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-[#F1F5F2] px-3 py-1 font-body text-[12px] font-bold text-[#26312B]">{sourceLabel(alert.alert_type)}</span>
                                  <span className="rounded-full bg-[#FFF7ED] px-3 py-1 font-body text-[12px] font-bold text-[#B45309]">{alert.severity}</span>
                                  <span className="rounded-full px-3 py-1 font-body text-[12px] font-bold" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                                    {statusStyle.label}
                                  </span>
                                </div>
                                <p className="mt-3 whitespace-pre-line font-body text-[17px] font-bold leading-relaxed text-[#26312B]">{alert.message}</p>
                              </div>
                              <span className="whitespace-nowrap font-body text-[12px] font-semibold text-[#5F6B63]">{formatTime(alert.created_at)}</span>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr]">
                              <div className="rounded-[14px] border border-[#D8DED6] bg-white p-3">
                                <p className="mb-2 flex items-center gap-2 font-body text-[13px] font-bold text-[#26312B]">
                                  <PhoneCall className="h-4 w-4 text-[#2F6F5E]" />
                                  Contact actions
                                </p>
                                {contacts.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {contacts.map((contact) => (
                                      contact.href ? (
                                        <a key={`${alert.id}-${contact.label}`} href={contact.href} className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-[#C9D6CF] bg-[#F8FAF8] px-3 font-body text-[13px] font-bold text-[#26312B]">
                                          {contact.kind === "email" ? <Mail className="h-4 w-4" /> : <PhoneCall className="h-4 w-4" />}
                                          {contact.kind === "email" ? "Email" : "Call"} {contact.label}
                                        </a>
                                      ) : (
                                        <span key={`${alert.id}-${contact.label}`} className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-[#C9D6CF] bg-[#F8FAF8] px-3 font-body text-[13px] font-bold text-[#26312B]">
                                          <UserCheck className="h-4 w-4" />
                                          {contact.label}
                                        </span>
                                      )
                                    ))}
                                    <button type="button" onClick={() => void copyAlert(alert)} className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-[#C9D6CF] bg-white px-3 font-body text-[13px] font-bold text-[#26312B]">
                                      <Copy className="h-4 w-4" />
                                      {copiedAlertId === alert.id ? "Copied" : "Copy note"}
                                    </button>
                                  </div>
                                ) : (
                                  <p className="font-body text-[14px] font-semibold leading-relaxed text-[#5F6B63]">
                                    No contact target is attached to this alert yet.
                                  </p>
                                )}
                                {serviceActions.length > 0 ? (
                                  <div className="mt-3 border-t border-[#E4EBE6] pt-3" data-testid={`caregiver-alert-services-${alert.id}`}>
                                    <p className="mb-2 font-body text-[12px] font-bold uppercase tracking-[0.12em] text-[#5F6B63]">
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
                                              className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-[#2F6F5E] px-3 font-body text-[13px] font-bold text-white shadow-[0_8px_18px_rgba(47,111,94,0.18)]"
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
                                            className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-[#2F6F5E] px-3 font-body text-[13px] font-bold text-white shadow-[0_8px_18px_rgba(47,111,94,0.18)]"
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

                              <div className="rounded-[14px] border border-[#D8DED6] bg-white p-3">
                                <p className="flex items-center gap-2 font-body text-[13px] font-bold text-[#26312B]">
                                  <TimerReset className="h-4 w-4 text-[#2F6F5E]" />
                                  Local caregiver workspace
                                </p>
                                <p className="mt-2 rounded-[10px] bg-[#F8FAF8] p-2 font-body text-[12px] font-semibold leading-relaxed text-[#5F6B63]">
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
                    <section className="rounded-[16px] border border-[#D8DED6] bg-white p-5">
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
                          <p className="font-body text-[12px] font-bold uppercase tracking-[0.13em] text-[#5F6B63]">Daily check-in</p>
                          <p className="mt-2 font-body text-[18px] font-bold leading-relaxed text-[#26312B]">
                            {dailyCheckin.latest_checkin?.feeling_label ?? dailyCheckin.message}
                          </p>
                          {dailyCheckin.latest_checkin?.completed_at ? (
                            <p className="mt-2 font-body text-[13px] font-semibold text-[#5F6B63]">
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

                  <CaregiverBrainCoachPanel />

                  <section className="rounded-[16px] border border-[#D8DED6] bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-body text-[12px] font-bold uppercase tracking-[0.13em] text-[#5F6B63]">Weekly caregiver digest</p>
                        <h2 className="mt-1 font-body text-[22px] font-bold text-[#26312B]">Last 7 days</h2>
                      </div>
                      <CalendarDays className="h-6 w-6 text-[#2F6F5E]" />
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between rounded-[12px] bg-[#F8FAF8] p-3">
                        <span className="font-body text-[14px] font-bold text-[#5F6B63]">Alerts</span>
                        <span className="font-body text-[18px] font-bold text-[#26312B]">{recentAlerts.length}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-[12px] bg-[#F8FAF8] p-3">
                        <span className="font-body text-[14px] font-bold text-[#5F6B63]">Higher priority</span>
                        <span className="font-body text-[18px] font-bold text-[#26312B]">{recentAlerts.filter((alert) => severityRank(alert.severity) >= 3).length}</span>
                      </div>
                      <div className="rounded-[12px] bg-[#F8FAF8] p-3">
                        <p className="mb-2 flex items-center gap-2 font-body text-[14px] font-bold text-[#26312B]">
                          <FileText className="h-4 w-4 text-[#2F6F5E]" />
                          Digest preview
                        </p>
                        <p className="whitespace-pre-line font-body text-[13px] font-semibold leading-relaxed text-[#5F6B63]">{digestText}</p>
                      </div>
                      <button type="button" onClick={() => void copyDigest()} className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[#2F6F5E] px-4 font-body text-[14px] font-bold text-white">
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
