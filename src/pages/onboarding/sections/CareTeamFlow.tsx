import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Edit3,
  HeartHandshake,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  UserRoundPlus,
  Users,
  XCircle,
} from "lucide-react";
import { ApiError, apiFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ProfileSectionHero, seniorInputClassName } from "@/components/onboarding/ProfileSectionHero";
import { ToggleRow } from "@/components/onboarding/ToggleRow";
import VyvaSessionCta from "@/components/VyvaSessionCta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Role = "family" | "carer" | "doctor";
type InviteChannel = "sms";
type Step = 1 | 2 | 3 | 4 | 5;
type Mode = "roster" | "adding";
type RosterStep = "people" | "sharing" | "invite";

const CARE_TEAM_QUERY_KEY = "/api/onboarding/careteam";
const CARE_TEAM_REQUEST_TIMEOUT_MS = 6000;

interface PersonForm {
  name: string;
  relationship: string;
  phone: string;
  whatsapp: string;
  email: string;
}

interface ConsentState {
  daily_summary: boolean;
  mood_updates: boolean;
  appointments: boolean;
  medication_alerts: boolean;
  health_reports: boolean;
  vital_signs: boolean;
  cognitive_results: boolean;
  emergency_alerts: boolean;
  inactivity_alerts: boolean;
  dashboard_access: boolean;
}

interface TeamMember {
  id: string;
  invitee_name: string;
  invitee_phone: string | null;
  invitee_email: string | null;
  role: string;
  relationship: string | null;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  latest_delivery_status: string | null;
  latest_delivery_channel: string | null;
  latest_delivery_at: string | null;
  location_label?: string | null;
  address?: string | null;
  access_note?: string | null;
}

const LOCAL_PREVIEW_MEMBERS: TeamMember[] = [
  {
    id: "local-preview-hassan",
    invitee_name: "Hassan Assad",
    invitee_phone: "+34 664 338 991",
    invitee_email: "hassan@example.com",
    role: "family",
    relationship: "son",
    status: "pending",
    created_at: "2026-07-08T09:00:00.000Z",
    expires_at: "2026-07-15T09:00:00.000Z",
    accepted_at: null,
    latest_delivery_status: "sent",
    latest_delivery_channel: "email",
    latest_delivery_at: "2026-07-08T09:02:00.000Z",
    location_label: "15 min away",
    address: "Calle San Miguel 14, Tarifa",
    access_note: "Safety alerts and daily summaries",
  },
  {
    id: "local-preview-gp",
    invitee_name: "Dr. Martin Keller",
    invitee_phone: "+49 351 555 0188",
    invitee_email: "clinic@example.com",
    role: "doctor",
    relationship: "doctor",
    status: "accepted",
    created_at: "2026-07-02T10:30:00.000Z",
    expires_at: "2026-07-09T10:30:00.000Z",
    accepted_at: "2026-07-02T12:15:00.000Z",
    latest_delivery_status: "sent",
    latest_delivery_channel: "email",
    latest_delivery_at: "2026-07-02T10:31:00.000Z",
    location_label: "Primary clinic",
    address: "Dresden Family Clinic, Hauptstrasse 22",
    access_note: "Health reports and vital signs",
  },
];

function isLocalPreviewCareTeam(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  const isLocalhost = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
  if (!isLocalhost) return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("local_preview") === "1" || window.localStorage.getItem("vyva_local_preview_auth") === "1";
}

async function parseApiError(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return new ApiError(response.status, response.statusText, body);
}

async function fetchCareTeamRoster(signal?: AbortSignal): Promise<{ members: TeamMember[] }> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CARE_TEAM_REQUEST_TIMEOUT_MS);
  const abortFromQuery = () => controller.abort();
  signal?.addEventListener("abort", abortFromQuery, { once: true });

  try {
    const response = await apiFetch(CARE_TEAM_QUERY_KEY, { signal: controller.signal });
    if (!response.ok) {
      if (isLocalPreviewCareTeam()) return { members: LOCAL_PREVIEW_MEMBERS };
      throw await parseApiError(response);
    }
    return response.json();
  } catch (error) {
    if (isLocalPreviewCareTeam()) return { members: LOCAL_PREVIEW_MEMBERS };
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Care team request timed out");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromQuery);
  }
}

const defaultConsent = (role: Role): ConsentState => ({
  daily_summary: true,
  mood_updates: role !== "doctor",
  appointments: true,
  medication_alerts: role === "carer",
  health_reports: role === "doctor",
  vital_signs: role === "carer" || role === "doctor",
  cognitive_results: false,
  emergency_alerts: true,
  inactivity_alerts: role !== "doctor",
  dashboard_access: false,
});

const ROLE_LABEL_KEYS: Record<string, string> = {
  family_member: "onboarding.careTeam.roles.familyMember",
  caregiver: "onboarding.careTeam.roles.caregiver",
  doctor: "onboarding.careTeam.roles.doctor",
  family: "onboarding.careTeam.roles.familyMember",
  carer: "onboarding.careTeam.roles.caregiver",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-700",
  expired: "bg-gray-100 text-gray-600",
  revoked: "bg-red-100 text-red-700",
};

const STATUS_KEY_MAP: Record<string, string> = {
  pending: "onboarding.careTeam.status.pending",
  accepted: "onboarding.careTeam.status.accepted",
  declined: "onboarding.careTeam.status.declined",
  expired: "onboarding.careTeam.status.expired",
  revoked: "onboarding.careTeam.status.revoked",
};

function memberNeedsAttention(member: TeamMember) {
  return member.latest_delivery_status === "failed" || member.status === "expired" || member.status === "declined";
}

function contactSummary(member: TeamMember) {
  return member.invitee_phone || member.invitee_email || "";
}

function careTeamContextChips(member: TeamMember) {
  return [
    member.location_label || member.address
      ? {
          id: "location",
          icon: MapPin,
          label: member.location_label || member.address || "",
          tone: "border-cyan-100 bg-cyan-50 text-cyan-900",
        }
      : null,
    member.address && member.location_label
      ? {
          id: "address",
          icon: MapPin,
          label: member.address,
          tone: "border-slate-100 bg-slate-50 text-slate-700",
        }
      : null,
    member.invitee_email
      ? {
          id: "email",
          icon: Mail,
          label: member.invitee_email,
          tone: "border-emerald-100 bg-emerald-50 text-emerald-900",
        }
      : null,
    member.access_note
      ? {
          id: "access",
          icon: ShieldCheck,
          label: member.access_note,
          tone: "border-purple-100 bg-purple-50 text-purple-900",
        }
      : null,
  ].filter(Boolean) as Array<{ id: string; icon: LucideIcon; label: string; tone: string }>;
}

const ROLE_OPTIONS: Array<{
  id: Role;
  icon: LucideIcon;
  titleKey: string;
  subKey: string;
  bg: string;
  iconColor: string;
}> = [
  {
    id: "family",
    icon: Users,
    titleKey: "onboarding.careTeam.roleOptions.family.title",
    subKey: "onboarding.careTeam.roleOptions.family.sub",
    bg: "#F3E8FF",
    iconColor: "#6B21A8",
  },
  {
    id: "carer",
    icon: HeartHandshake,
    titleKey: "onboarding.careTeam.roleOptions.carer.title",
    subKey: "onboarding.careTeam.roleOptions.carer.sub",
    bg: "#ECFDF5",
    iconColor: "#0A7C4E",
  },
  {
    id: "doctor",
    icon: Stethoscope,
    titleKey: "onboarding.careTeam.roleOptions.doctor.title",
    subKey: "onboarding.careTeam.roleOptions.doctor.sub",
    bg: "#EFF6FF",
    iconColor: "#1D4ED8",
  },
];

const CARE_TEAM_RELATIONSHIP_KEYS = [
  { value: "son", labelKey: "onboarding.careTeam.relationships.son" },
  { value: "daughter", labelKey: "onboarding.careTeam.relationships.daughter" },
  { value: "spouse_partner", labelKey: "onboarding.careTeam.relationships.spousePartner" },
  { value: "sibling", labelKey: "onboarding.careTeam.relationships.sibling" },
  { value: "friend", labelKey: "onboarding.careTeam.relationships.friend" },
  { value: "neighbour", labelKey: "onboarding.careTeam.relationships.neighbour" },
  { value: "professional_carer", labelKey: "onboarding.careTeam.relationships.professionalCarer" },
  { value: "gp", labelKey: "onboarding.careTeam.relationships.gp" },
  { value: "specialist_doctor", labelKey: "onboarding.careTeam.relationships.specialistDoctor" },
  { value: "other", labelKey: "onboarding.careTeam.relationships.other" },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

function plainLabel(value: string) {
  return value.replace(/^[^\p{L}\p{N}]+/u, "");
}

const StepDots = ({ current }: { current: number }) => {
  const { t } = useTranslation();
  return (
    <div className="mb-5 flex items-center gap-2">
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          className={cn(
            "h-2.5 rounded-full transition-all",
            n < current ? "w-3 bg-[#C9890A]" : n === current ? "w-9 bg-[#6B21A8]" : "w-3 bg-purple-100",
          )}
        />
      ))}
      <span className="ml-1 font-body text-[12px] font-bold text-vyva-text-3">
        {t("onboarding.careTeam.stepDots", { current })}
      </span>
    </div>
  );
};

const sectionShellClassName =
  "overflow-hidden rounded-[24px] border border-[#EFE4D5] bg-white shadow-[0_12px_30px_rgba(53,28,87,0.06)]";

const sectionHeaderClassName =
  "bg-vyva-warm px-5 py-3 font-body text-[12px] font-black uppercase tracking-[0.08em] text-vyva-text-2";

export default function CareTeamFlow() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  const getRoleLabel = (role: string) => {
    const key = ROLE_LABEL_KEYS[role];
    return key ? t(key) : role;
  };

  const getRelationshipLabel = (relationship: string) => {
    const entry = CARE_TEAM_RELATIONSHIP_KEYS.find((r) => r.value === relationship);
    return entry ? t(entry.labelKey) : relationship;
  };

  const getStatusLabel = (status: string) => {
    const key = STATUS_KEY_MAP[status];
    return key ? t(key) : status;
  };

  const getDeliveryLabel = (member: TeamMember) => {
    if (!member.latest_delivery_status) return null;
    const channel = member.latest_delivery_channel;
    if (member.latest_delivery_status === "sent") {
      return channel
        ? t("onboarding.careTeam.roster.member.inviteSentBy", { channel })
        : t("onboarding.careTeam.roster.member.inviteSent");
    }
    if (member.latest_delivery_status === "failed") {
      return channel
        ? t("onboarding.careTeam.roster.member.deliveryNeedsAttentionBy", { channel })
        : t("onboarding.careTeam.roster.member.deliveryNeedsAttention");
    }
    if (member.latest_delivery_status === "queued" || member.latest_delivery_status === "sending") {
      return t("onboarding.careTeam.roster.member.deliveryInProgress");
    }
    return t("onboarding.careTeam.roster.member.deliveryStatus", { status: member.latest_delivery_status });
  };

  const getStatusClass = (status: string) => STATUS_BADGE_CLASSES[status] ?? STATUS_BADGE_CLASSES.pending;
  const careTeamTitle = t("profile.overview.sections.careTeam.title");
  const careTeamStepLabel = (current: number) => `${careTeamTitle} - ${t("onboarding.careTeam.stepDots", { current })}`;
  const allSectionsLabel = t("onboarding.allSections", "All");

  const [mode, setMode] = useState<Mode>("roster");
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<Role>("family");
  const [person, setPerson] = useState<PersonForm>({ name: "", relationship: "", phone: "", whatsapp: "", email: "" });
  const [consent, setConsent] = useState<ConsentState>(defaultConsent("family"));
  const [inviteChannel, setInviteChannel] = useState<InviteChannel>("sms");
  const [saving, setSaving] = useState(false);
  const [confirmingRevokeId, setConfirmingRevokeId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [rosterStep, setRosterStep] = useState<RosterStep>("people");
  const [showRosterLoadingFallback, setShowRosterLoadingFallback] = useState(false);

  const setP = (field: keyof PersonForm, value: string) => setPerson((prev) => ({ ...prev, [field]: value }));
  const setC = (field: keyof ConsentState, value: boolean) => setConsent((prev) => ({ ...prev, [field]: value }));

  const selectRole = (nextRole: Role) => {
    setRole(nextRole);
    setConsent(defaultConsent(nextRole));
  };

  const { data: rosterData, isLoading: rosterLoading, isError: rosterError } = useQuery<{ members: TeamMember[] }>({
    queryKey: [CARE_TEAM_QUERY_KEY],
    queryFn: ({ signal }) => fetchCareTeamRoster(signal),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const members = rosterData?.members ?? [];

  useEffect(() => {
    if (!rosterLoading) {
      setShowRosterLoadingFallback(false);
      return;
    }

    const timer = window.setTimeout(() => setShowRosterLoadingFallback(true), 900);
    return () => window.clearTimeout(timer);
  }, [rosterLoading]);

  const startAddFlow = () => {
    setPerson({ name: "", relationship: "", phone: "", whatsapp: "", email: "" });
    setRole("family");
    setConsent(defaultConsent("family"));
    setStep(1);
    setMode("adding");
  };

  const backToRoster = () => {
    setStep(1);
    setMode("roster");
  };

  const revokeInvitation = async (id: string) => {
    setConfirmingRevokeId(null);
    setActionLoadingId(id);
    let res: Response | undefined;
    try {
      res = await apiFetch(`/api/onboarding/careteam/${id}`, { method: "PATCH" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: [CARE_TEAM_QUERY_KEY] });
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: t("onboarding.careTeam.toastRemoveError"), description: msg, variant: "destructive" });
    } finally {
      setActionLoadingId(null);
    }
  };

  const resendInvitation = async (id: string) => {
    setActionLoadingId(id);
    let res: Response | undefined;
    try {
      res = await apiFetch(`/api/onboarding/careteam/${id}/resend`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: [CARE_TEAM_QUERY_KEY] });
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: t("onboarding.careTeam.toastResendError"), description: msg, variant: "destructive" });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSendInvite = async () => {
    if (saving) return;
    setSaving(true);
    let res: Response | undefined;
    try {
      res = await apiFetch("/api/onboarding/section/careteam", {
        method: "POST",
        body: JSON.stringify({ role, person, consent, invite_channel: inviteChannel }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await queryClient.invalidateQueries({ queryKey: [CARE_TEAM_QUERY_KEY] });
      setStep(5);
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: t("onboarding.careTeam.toastInviteError"), description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const effectiveMode: Mode = mode === "roster" && !rosterLoading && !rosterError && members.length === 0 ? "adding" : mode;
  const activeMemberCount = members.filter((member) => member.status === "accepted").length;
  const pendingMemberCount = members.filter((member) => member.status === "pending" || member.status === "expired").length;
  const attentionMemberCount = members.filter(memberNeedsAttention).length;
  const rosterMetrics: Array<{
    id: string;
    label: string;
    value: number;
    className: string;
  }> = [
    {
      id: "active",
      label: t("onboarding.careTeam.roster.metrics.active", "Connected"),
      value: activeMemberCount,
      className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    },
    {
      id: "pending",
      label: t("onboarding.careTeam.roster.metrics.pending", "Waiting"),
      value: pendingMemberCount,
      className: "border-amber-200 bg-amber-50 text-amber-900",
    },
    {
      id: "attention",
      label: t("onboarding.careTeam.roster.metrics.attention", "Check"),
      value: attentionMemberCount,
      className: attentionMemberCount > 0
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-cyan-200 bg-cyan-50 text-cyan-900",
    },
  ];
  const sharingHighlights: Array<{
    id: string;
    label: string;
    Icon: LucideIcon;
    className: string;
  }> = [
    {
      id: "updates",
      label: plainLabel(t("onboarding.careTeam.step3.sectionUpdates")),
      Icon: MessageCircle,
      className: "border-purple-100 bg-purple-50 text-purple-900",
    },
    {
      id: "safety",
      label: plainLabel(t("onboarding.careTeam.step3.sectionSafety")),
      Icon: BellRing,
      className: "border-amber-100 bg-amber-50 text-amber-900",
    },
    {
      id: "health",
      label: plainLabel(t("onboarding.careTeam.step3.sectionHealth")),
      Icon: ShieldCheck,
      className: "border-emerald-100 bg-emerald-50 text-emerald-900",
    },
  ];
  const rosterWizardSteps: Array<{
    id: RosterStep;
    label: string;
  }> = [
    {
      id: "people",
      label: t("onboarding.careTeam.roster.wizard.people", "People"),
    },
    {
      id: "sharing",
      label: t("onboarding.careTeam.roster.wizard.sharing", "Sharing"),
    },
    {
      id: "invite",
      label: t("onboarding.careTeam.roster.wizard.invite", "Invite"),
    },
  ];
  const rosterStepIndex = rosterWizardSteps.findIndex((item) => item.id === rosterStep);
  const goToNextRosterStep = () => {
    const next = rosterWizardSteps[Math.min(rosterStepIndex + 1, rosterWizardSteps.length - 1)];
    if (next) setRosterStep(next.id);
  };
  const goToPreviousRosterStep = () => {
    const previous = rosterWizardSteps[Math.max(rosterStepIndex - 1, 0)];
    if (previous) setRosterStep(previous.id);
  };

  if (effectiveMode === "roster") {
    if (rosterLoading) {
      return (
        <PhoneFrame subtitle={careTeamTitle} showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")} allSectionsLabel={allSectionsLabel} compact>
          <div className="flex flex-col gap-3 px-1 pb-4 pt-2 sm:px-2 md:px-3" aria-busy="true">
            <section className="rounded-[22px] border border-[#D9F3F7] bg-white px-4 py-4 shadow-[0_10px_22px_rgba(53,28,87,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#0F766E]">
                    {t("onboarding.careTeam.roster.stepLabel", {
                      current: 1,
                      total: 3,
                      defaultValue: "Step {{current}} of {{total}}",
                    })}
                  </p>
                  <h1 className="mt-0.5 font-body text-[23px] font-black leading-tight text-vyva-text-1">
                    {t("onboarding.careTeam.roster.wizard.people", "People")}
                  </h1>
                </div>
                <div className="h-11 w-11 animate-pulse rounded-full bg-purple-100" aria-hidden="true" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-[54px] animate-pulse rounded-xl border border-cyan-100 bg-cyan-50/60" />
                ))}
              </div>
            </section>

            <section className="rounded-[22px] border border-[#D9F3F7] bg-white p-4 shadow-[0_10px_22px_rgba(53,28,87,0.05)]">
              <div className="flex items-center gap-3">
                <span className="h-11 w-11 animate-pulse rounded-xl bg-cyan-100" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="h-5 w-36 animate-pulse rounded-full bg-slate-100" />
                  <div className="mt-2 h-4 w-24 animate-pulse rounded-full bg-slate-100" />
                </div>
              </div>
              <p className="mt-4 font-body text-[14px] font-black text-vyva-text-2">
                {t("onboarding.careTeam.loading")}
              </p>
            </section>

            {showRosterLoadingFallback ? (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  variant="outline"
                  data-testid="button-careteam-loading-retry"
                  onClick={() => queryClient.refetchQueries({ queryKey: [CARE_TEAM_QUERY_KEY] })}
                  className="h-12 min-h-12 rounded-full border-cyan-200 bg-white text-[15px] font-black text-[#0F766E] hover:bg-cyan-50"
                >
                  {t("onboarding.careTeam.retry")}
                </Button>
                <Button
                  data-testid="button-careteam-loading-add"
                  onClick={startAddFlow}
                  className="h-12 min-h-12 rounded-full bg-[#6B21A8] text-[15px] font-black shadow-[0_12px_24px_rgba(107,33,168,0.18)] hover:bg-[#5B1A8F]"
                >
                  {t("onboarding.careTeam.roster.addShort", "Add")}
                </Button>
              </div>
            ) : null}
          </div>
        </PhoneFrame>
      );
    }

    if (rosterError) {
      return (
        <PhoneFrame subtitle={careTeamTitle} showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")} allSectionsLabel={allSectionsLabel} compact>
          <div className="flex flex-col gap-3 px-1 pb-4 pt-2 sm:px-2 md:px-3" data-testid="careteam-roster-error">
            <section className="rounded-[22px] border border-[#FECACA] bg-white px-4 py-4 shadow-[0_10px_22px_rgba(53,28,87,0.05)]">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                  <AlertTriangle size={24} />
                </div>
                <div className="min-w-0">
                  <p className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-red-700">
                    {t("onboarding.careTeam.roster.stepLabel", {
                      current: 1,
                      total: 3,
                      defaultValue: "Step {{current}} of {{total}}",
                    })}
                  </p>
                  <h1 className="mt-0.5 font-body text-[23px] font-black leading-tight text-vyva-text-1">
                    {t("onboarding.careTeam.errorTitle")}
                  </h1>
                  <p className="mt-2 font-body text-[14px] leading-relaxed text-vyva-text-2">
                    {t("onboarding.careTeam.errorMessage")}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-2">
              <Button
                data-testid="button-careteam-retry"
                variant="outline"
                onClick={() => queryClient.refetchQueries({ queryKey: [CARE_TEAM_QUERY_KEY] })}
                className="h-12 min-h-12 rounded-full border-cyan-200 bg-white px-5 text-[15px] font-black text-[#0F766E] hover:bg-cyan-50"
              >
                {t("onboarding.careTeam.retry")}
              </Button>
              <Button
                data-testid="button-careteam-error-add"
                onClick={startAddFlow}
                className="h-12 min-h-12 rounded-full bg-[#6B21A8] px-5 text-[15px] font-black text-white shadow-[0_12px_24px_rgba(107,33,168,0.18)] hover:bg-[#5B1A8F]"
              >
                {t("onboarding.careTeam.roster.addShort", "Add")}
              </Button>
            </div>
          </div>
        </PhoneFrame>
      );
    }

    return (
      <PhoneFrame subtitle={careTeamTitle} showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")} allSectionsLabel={allSectionsLabel} compact>
        <div className="flex flex-col gap-3 px-1 pb-4 pt-2 sm:px-2 md:px-3">
          <section
            data-testid="careteam-roster-hero"
            aria-label={t("onboarding.careTeam.roster.heroAria", "Care team overview")}
            className="rounded-[22px] border border-[#D9F3F7] bg-white px-4 py-3 shadow-[0_10px_22px_rgba(53,28,87,0.05)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#0F766E]">
                  {t("onboarding.careTeam.roster.stepLabel", {
                    current: rosterStepIndex + 1,
                    total: rosterWizardSteps.length,
                    defaultValue: "Step {{current}} of {{total}}",
                  })}
                </p>
                <h1 className="mt-0.5 truncate font-body text-[23px] font-black leading-tight text-vyva-text-1">
                  {rosterWizardSteps[rosterStepIndex]?.label ?? t("onboarding.careTeam.roster.peopleHeading", "Your people")}
                </h1>
              </div>

              <VyvaSessionCta
                label={t("onboarding.careTeam.roster.voice.label", "Talk to VYVA")}
                activeLabel={t("onboarding.careTeam.roster.voice.activeLabel", "Voice is open")}
                connectingLabel={t("onboarding.careTeam.roster.voice.connectingLabel", "Opening voice")}
                preparingLabel={t("onboarding.careTeam.roster.voice.preparingLabel", "Checking voice")}
                errorLabel={t("onboarding.careTeam.roster.voice.errorLabel", "Voice needs help")}
                contextHint={t(
                  "onboarding.careTeam.roster.voice.context",
                  "Help the user review their care team, decide who to add, explain sharing permissions clearly, and guide them to add or resend an invite. Do not give medical advice.",
                )}
                voiceAgentSlug="main-vyva"
                voiceDynamicVariables={{
                  app_entrypoint: "care_team_roster",
                  care_team_members: members.length,
                  care_team_connected: activeMemberCount,
                  care_team_waiting: pendingMemberCount,
                  care_team_attention: attentionMemberCount,
                }}
                autoStartListening
                hideWhenSessionActive
                supportingLabel={t("onboarding.careTeam.roster.voice.supportingLabel", "Ask who to add")}
                visual="voiceRail"
                testId="button-careteam-talk-to-vyva"
                className="vyva-tap relative flex !h-11 !min-h-11 !w-11 flex-shrink-0 items-center justify-center rounded-full border border-[#A5F3FC] bg-[#ECFEFF] text-vyva-purple transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-75"
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1.5" data-testid="careteam-roster-metrics">
              {rosterMetrics.map((metric) => (
                <div
                  key={metric.id}
                  data-testid={`careteam-roster-metric-${metric.id}`}
                  className={cn("rounded-xl border px-2 py-1.5 text-center", metric.className)}
                >
                  <div className="font-body text-[18px] font-black leading-none tabular-nums">{metric.value}</div>
                  <div className="truncate font-body text-[9px] font-black uppercase tracking-[0.04em]">{metric.label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-3 gap-1.5" aria-label={t("onboarding.careTeam.roster.wizardAria", "Care team steps")}>
            {rosterWizardSteps.map((item, index) => {
              const selected = rosterStep === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`button-careteam-roster-step-${item.id}`}
                  onClick={() => setRosterStep(item.id)}
                  className={cn(
                    "vyva-tap min-h-11 rounded-xl border px-2 py-1.5 text-center transition-transform hover:-translate-y-0.5",
                    selected
                      ? "border-[#6B21A8] bg-white text-vyva-text-1 shadow-[0_8px_16px_rgba(107,33,168,0.10)]"
                      : "border-[#E7DFF3] bg-white/70 text-vyva-text-3",
                  )}
                >
                  <span className="block font-body text-[10px] font-black leading-none opacity-70">{index + 1}</span>
                  <span className="mt-0.5 block truncate font-body text-[13px] font-black leading-none">{item.label}</span>
                </button>
              );
            })}
          </section>

          {rosterStep === "sharing" ? (
            <section
              data-testid="careteam-sharing-highlights"
              className="rounded-[22px] border border-[#D9F3F7] bg-white p-4 shadow-[0_10px_22px_rgba(53,28,87,0.05)]"
              aria-label={t("onboarding.careTeam.roster.highlightsAria", "Sharing options")}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-[#0891B2]">
                  <ShieldCheck size={20} strokeWidth={2.6} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-body text-[19px] font-black leading-tight text-vyva-text-1">
                    {t("onboarding.careTeam.roster.privacyTitle", "Control sharing")}
                  </h2>
                  <p className="font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                    {t("onboarding.careTeam.roster.privacyShort", "Adjust any time.")}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {sharingHighlights.map((highlight) => {
                  const Icon = highlight.Icon;
                  return (
                    <div
                      key={highlight.id}
                      className={cn("flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 text-center", highlight.className)}
                    >
                      <Icon size={20} strokeWidth={2.5} aria-hidden="true" />
                      <p className="line-clamp-2 font-body text-[11px] font-black leading-tight">{highlight.label}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {rosterStep === "people" ? (
          <section className="flex flex-col gap-2" aria-label={t("onboarding.careTeam.roster.peopleAria", "People in your care team")}>
            {members.map((member) => {
              const badgeClass = getStatusClass(member.status);
              const badgeLabel = getStatusLabel(member.status);
              const isLoading = actionLoadingId === member.id;
              const isConfirming = confirmingRevokeId === member.id;
              const canRevoke = member.status === "pending" || member.status === "accepted";
              const canResend = member.status === "pending" || member.status === "expired";
              const canEditAccess = member.status === "accepted";
              const hasAttention = memberNeedsAttention(member);
              const contact = contactSummary(member);
              const ContactIcon = member.invitee_phone ? Phone : Mail;
              const detailLine = [
                getRoleLabel(member.role),
                member.relationship ? getRelationshipLabel(member.relationship) : null,
              ].filter(Boolean).join(" / ");
              const delivery = getDeliveryLabel(member);
              const contextChips = careTeamContextChips(member);

              return (
                <div
                  key={member.id}
                  data-testid={`card-careteam-member-${member.id}`}
                  className={cn(
                    "overflow-hidden rounded-[22px] border bg-white shadow-[0_10px_22px_rgba(53,28,87,0.05)]",
                    hasAttention ? "border-red-200" : "border-[#D9F3F7]",
                  )}
                >
                  <div className="p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 min-h-11 w-11 min-w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#0891B2] text-[15px] font-black text-white shadow-[0_8px_16px_rgba(8,145,178,0.14)]">
                        {initials(member.invitee_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="min-w-0 truncate font-body text-[19px] font-black leading-tight text-vyva-text-1">{member.invitee_name}</p>
                          <span className={cn("flex-shrink-0 rounded-full px-3 py-1 font-body text-[12px] font-black", badgeClass)}>
                            {badgeLabel}
                          </span>
                        </div>
                        <p className="truncate font-body text-[14px] font-black leading-snug text-[#0F766E]">{detailLine}</p>
                        <p className="flex items-center gap-2 truncate font-body text-[13px] font-bold text-vyva-text-3">
                          {contact ? (
                            <>
                            <ContactIcon size={15} strokeWidth={2.4} aria-hidden="true" />
                            {contact}
                            </>
                          ) : (
                            delivery || t("onboarding.careTeam.roster.member.privateInvite", "Private invite sent")
                          )}
                        </p>
                      </div>
                    </div>

                    {contextChips.length > 0 ? (
                      <div className="mt-3 grid grid-cols-2 gap-1.5" data-testid={`careteam-member-context-${member.id}`}>
                        {contextChips.slice(0, 4).map((chip) => {
                          const ChipIcon = chip.icon;
                          return (
                            <div
                              key={chip.id}
                              className={cn(
                                "flex min-h-[42px] items-center gap-2 rounded-xl border px-2.5 py-1.5",
                                chip.tone,
                              )}
                            >
                              <ChipIcon size={15} strokeWidth={2.5} className="flex-shrink-0" aria-hidden="true" />
                              <span className="line-clamp-2 font-body text-[11px] font-black leading-tight">
                                {chip.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {hasAttention ? (
                      <div className="mt-3 rounded-[18px] border border-red-200 bg-red-50 px-3 py-2.5 text-red-800">
                        <div className="flex items-start gap-3">
                          <AlertTriangle size={20} className="mt-0.5 flex-shrink-0" strokeWidth={2.5} aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="font-body text-[13px] font-black uppercase tracking-[0.06em]">
                              {t("onboarding.careTeam.roster.member.attention", "Needs attention")}
                            </p>
                            <p className="mt-1 font-body text-[13px] font-bold leading-snug opacity-85">
                              {delivery || t("onboarding.careTeam.roster.member.privateInvite", "Private invite sent")}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {(canEditAccess || canRevoke || canResend) && !isConfirming ? (
                    <div className="grid grid-cols-2 gap-2 border-t border-vyva-border bg-[#FBFEFF] px-3.5 py-2.5">
                      {canEditAccess ? (
                        <button
                          type="button"
                          data-testid={`button-careteam-edit-${member.id}`}
                          onClick={() => navigate("/settings/privacy")}
                          className="vyva-tap flex min-h-10 items-center justify-center gap-2 rounded-full border border-cyan-100 bg-white px-3 font-body text-[12px] font-black text-[#0F766E] shadow-[0_8px_18px_rgba(53,28,87,0.04)] hover:bg-cyan-50"
                        >
                          <Edit3 size={14} strokeWidth={2.5} aria-hidden="true" />
                          {t("onboarding.careTeam.editAccess", "Edit access")}
                        </button>
                      ) : null}
                      {canResend ? (
                        <button
                          type="button"
                          data-testid={`button-careteam-resend-${member.id}`}
                          disabled={isLoading}
                          onClick={() => resendInvitation(member.id)}
                          className={cn(
                            "vyva-tap flex min-h-10 items-center justify-center gap-2 rounded-full border border-purple-100 bg-white px-3 font-body text-[12px] font-black text-purple-700 shadow-[0_8px_18px_rgba(53,28,87,0.04)] hover:bg-purple-50 disabled:opacity-40",
                            !(canEditAccess || (canResend && canRevoke)) ? "col-span-2" : "",
                          )}
                        >
                          <RefreshCw size={14} strokeWidth={2.5} aria-hidden="true" />
                          {isLoading ? t("onboarding.careTeam.resending") : t("onboarding.careTeam.resendShort", "Resend")}
                        </button>
                      ) : null}
                      {canRevoke ? (
                        <button
                          type="button"
                          data-testid={`button-careteam-revoke-${member.id}`}
                          disabled={isLoading}
                          onClick={() => setConfirmingRevokeId(member.id)}
                          className={cn(
                            "vyva-tap flex min-h-10 items-center justify-center gap-2 rounded-full border border-red-100 bg-white px-3 font-body text-[12px] font-black text-red-600 shadow-[0_8px_18px_rgba(53,28,87,0.04)] hover:bg-red-50 disabled:opacity-40",
                            !(canEditAccess || (canResend && canRevoke)) ? "col-span-2" : "",
                          )}
                        >
                          <XCircle size={14} strokeWidth={2.5} aria-hidden="true" />
                          {member.status === "accepted"
                            ? t("onboarding.careTeam.removeShort", "Remove")
                            : t("onboarding.careTeam.cancelShort", "Cancel")}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {isConfirming ? (
                    <div className="border-t border-red-100 bg-red-50 px-4 py-4">
                      <p className="mb-3 font-body text-[14px] font-bold leading-relaxed text-red-700">
                        {member.status === "accepted"
                          ? t("onboarding.careTeam.confirmRemoveAccess", { name: member.invitee_name })
                          : t("onboarding.careTeam.confirmCancelInvite", { name: member.invitee_name })}
                      </p>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          data-testid={`button-careteam-revoke-cancel-${member.id}`}
                          onClick={() => setConfirmingRevokeId(null)}
                          className="min-h-11 rounded-full px-4 font-body text-[13px] font-black text-vyva-text-2 hover:bg-white"
                        >
                          {t("onboarding.careTeam.keep")}
                        </button>
                        <button
                          type="button"
                          data-testid={`button-careteam-revoke-confirm-${member.id}`}
                          disabled={isLoading}
                          onClick={() => revokeInvitation(member.id)}
                          className="min-h-11 rounded-full px-4 font-body text-[13px] font-black text-red-700 hover:bg-white disabled:opacity-40"
                        >
                          {isLoading ? t("onboarding.careTeam.removing") : member.status === "accepted" ? t("onboarding.careTeam.yesRemove") : t("onboarding.careTeam.yesCancel")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
          ) : null}

          {rosterStep === "invite" ? (
            <section
              data-testid="careteam-invite-panel"
              className="rounded-[22px] border border-purple-100 bg-white p-4 text-center shadow-[0_10px_22px_rgba(53,28,87,0.05)]"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-[#6B21A8]">
                <UserRoundPlus size={24} strokeWidth={2.5} aria-hidden="true" />
              </div>
              <h2 className="mt-2 font-body text-[21px] font-black leading-tight text-vyva-text-1">
                {t("onboarding.careTeam.roster.inviteTitle", "Invite someone")}
              </h2>
              <Button
                data-testid="button-careteam-add-another"
                onClick={startAddFlow}
                className="mt-3 h-12 w-full rounded-full bg-[#6B21A8] text-[16px] font-black shadow-[0_12px_24px_rgba(107,33,168,0.18)] hover:bg-[#5B1A8F]"
              >
                <Plus size={19} strokeWidth={2.7} aria-hidden="true" />
                {plainLabel(t("onboarding.careTeam.addAnother"))}
              </Button>
            </section>
          ) : null}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="outline"
              onClick={rosterStep === "people" ? () => navigate("/onboarding/profile") : goToPreviousRosterStep}
              className="h-12 min-h-12 rounded-full border-cyan-200 bg-white text-[15px] font-black text-[#0F766E] hover:bg-cyan-50"
            >
              {rosterStep === "people"
                ? t("onboarding.careTeam.roster.profileBack", "Profile")
                : t("onboarding.careTeam.roster.back", "Back")}
            </Button>
            <Button
              onClick={rosterStep === "invite" ? () => navigate("/onboarding/profile") : goToNextRosterStep}
              className="h-12 min-h-12 rounded-full bg-[#6B21A8] text-[15px] font-black shadow-[0_12px_24px_rgba(107,33,168,0.18)] hover:bg-[#5B1A8F]"
            >
              {rosterStep === "invite"
                ? t("onboarding.careTeam.roster.finish", "Done")
                : t("onboarding.careTeam.roster.nextAction", "Next")}
            </Button>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  if (step === 1) {
    return (
      <PhoneFrame
        subtitle={careTeamStepLabel(1)}
        showBack
        onBack={() => (members.length > 0 ? backToRoster() : navigate("/onboarding/profile"))}
        showAllSections
        onAllSections={() => navigate("/onboarding/profile")}
        allSectionsLabel={allSectionsLabel}
      >
        <div className="flex flex-col gap-6 px-1 pb-6 pt-5 sm:px-2 md:px-3">
          <ProfileSectionHero
            icon={UserRoundPlus}
            title={plainLabel(t("onboarding.careTeam.step1.heading"))}
            kicker={careTeamTitle}
            description={t("onboarding.careTeam.step1.subtitle")}
            badges={ROLE_OPTIONS.map((opt, index) => ({
              label: t(opt.titleKey),
              color: index === 0 ? "purple" : index === 1 ? "green" : "blue",
            }))}
          />

          <div className="flex items-start gap-3 rounded-[22px] border border-purple-100 bg-purple-50 px-4 py-4 text-purple-800">
            <ShieldCheck size={20} className="mt-0.5 flex-shrink-0" />
            <p className="font-body text-[14px] font-bold leading-relaxed">{t("onboarding.careTeam.step1.infoBanner")}</p>
          </div>

          <div className="grid gap-4">
            {ROLE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = role === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => selectRole(opt.id)}
                  data-testid={`button-careteam-role-${opt.id}`}
                  className={cn(
                    "flex min-h-[118px] items-start gap-4 rounded-[24px] border-2 bg-white p-5 text-left shadow-[0_10px_28px_rgba(53,28,87,0.06)] transition-all",
                    selected ? "border-[#6B21A8] bg-purple-50" : "border-[#EFE4D5] hover:border-purple-200",
                  )}
                >
                  <div
                    className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl"
                    style={{ background: opt.bg }}
                  >
                    <Icon size={26} style={{ color: opt.iconColor }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[18px] font-black leading-tight text-vyva-text-1">{t(opt.titleKey)}</p>
                    <p className="mt-2 font-body text-[15px] leading-relaxed text-vyva-text-2">{t(opt.subKey)}</p>
                  </div>
                  {selected ? <CheckCircle2 size={22} className="flex-shrink-0 text-vyva-green" /> : null}
                </button>
              );
            })}
          </div>

          <Button
            data-testid="button-careteam-step1-continue"
            onClick={() => setStep(2)}
            className="h-14 w-full rounded-full bg-[#6B21A8] text-[18px] font-black shadow-[0_14px_28px_rgba(107,33,168,0.22)] hover:bg-[#5B1A8F]"
          >
            {t("onboarding.careTeam.step1.continue")}
          </Button>
        </div>
      </PhoneFrame>
    );
  }

  if (step === 2) {
    return (
      <PhoneFrame subtitle={careTeamStepLabel(2)} showBack onBack={() => setStep(1)}>
        <div className="flex flex-col gap-6 px-1 pb-6 pt-5 sm:px-2 md:px-3">
          <StepDots current={2} />
          <div>
            <h2 className="font-display text-[34px] leading-tight text-vyva-text-1">{t("onboarding.careTeam.step2.heading")}</h2>
            <p className="mt-2 font-body text-[16px] leading-relaxed text-vyva-text-2">{t("onboarding.careTeam.step2.subtitle")}</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label className="font-body text-[14px] font-black text-vyva-text-2">{t("onboarding.careTeam.step2.labelName")}</Label>
              <Input
                data-testid="input-careteam-name"
                placeholder={t("onboarding.careTeam.step2.placeholderName")}
                value={person.name}
                onChange={(e) => setP("name", e.target.value)}
                className={seniorInputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-[14px] font-black text-vyva-text-2">{t("onboarding.careTeam.step2.labelRelationship")}</Label>
              <Select value={person.relationship} onValueChange={(value) => setP("relationship", value)}>
                <SelectTrigger className={seniorInputClassName}>
                  <SelectValue placeholder={t("onboarding.careTeam.step2.labelRelationship")} />
                </SelectTrigger>
                <SelectContent>
                  {CARE_TEAM_RELATIONSHIP_KEYS.map((relationship) => (
                    <SelectItem key={relationship.value} value={relationship.value}>
                      {t(relationship.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-body text-[14px] font-black text-vyva-text-2">{t("onboarding.careTeam.step2.labelPhone")}</Label>
              <Input
                data-testid="input-careteam-phone"
                type="tel"
                placeholder={t("onboarding.careTeam.step2.placeholderPhone")}
                value={person.phone}
                onChange={(e) => setP("phone", e.target.value)}
                className={seniorInputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-[14px] font-black text-vyva-text-2">{t("onboarding.careTeam.step2.labelWhatsapp")}</Label>
              <Input
                type="tel"
                placeholder={t("onboarding.careTeam.step2.placeholderWhatsapp")}
                value={person.whatsapp}
                onChange={(e) => setP("whatsapp", e.target.value)}
                className={seniorInputClassName}
              />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-[14px] font-black text-vyva-text-2">{t("onboarding.careTeam.step2.labelEmail")}</Label>
              <Input
                type="email"
                placeholder={t("onboarding.careTeam.step2.placeholderEmail")}
                value={person.email}
                onChange={(e) => setP("email", e.target.value)}
                className={seniorInputClassName}
              />
            </div>
          </div>

          <Button
            data-testid="button-careteam-step2-continue"
            onClick={() => setStep(3)}
            disabled={!person.name.trim() || !person.phone.trim()}
            className="h-14 w-full rounded-full bg-[#6B21A8] text-[18px] font-black shadow-[0_14px_28px_rgba(107,33,168,0.22)] hover:bg-[#5B1A8F] disabled:opacity-40"
          >
            {t("onboarding.careTeam.step2.continue")}
          </Button>
        </div>
      </PhoneFrame>
    );
  }

  if (step === 3) {
    const personDetail = [
      person.relationship ? getRelationshipLabel(person.relationship) : null,
      person.phone,
    ].filter(Boolean).join(" - ");

    return (
      <PhoneFrame subtitle={careTeamStepLabel(3)} showBack onBack={() => setStep(2)}>
        <div className="flex flex-col gap-6 px-1 pb-6 pt-5 sm:px-2 md:px-3">
          <StepDots current={3} />
          <div>
            <h2 className="font-display text-[34px] leading-tight text-vyva-text-1">
              {t("onboarding.careTeam.step3.heading", { name: person.name || t("onboarding.careTeam.nameFallbackSubject") })}
            </h2>
            <p className="mt-2 font-body text-[16px] leading-relaxed text-vyva-text-2">{t("onboarding.careTeam.step3.subtitle")}</p>
          </div>

          <div className="flex items-center gap-4 rounded-[24px] border-2 border-[#6B21A8] bg-purple-50 p-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-[#6B21A8] text-[15px] font-black text-white shadow-[0_12px_24px_rgba(107,33,168,0.2)]">
              {initials(person.name)}
            </div>
            <div className="min-w-0">
              <p className="font-body text-[18px] font-black text-vyva-text-1">{person.name || "-"}</p>
              <p className="font-body text-[13px] font-black text-purple-700">{getRoleLabel(role)}</p>
              {personDetail ? <p className="font-body text-[13px] text-vyva-text-2">{personDetail}</p> : null}
            </div>
          </div>

          <div className={sectionShellClassName}>
            <div className={sectionHeaderClassName}>{plainLabel(t("onboarding.careTeam.step3.sectionUpdates"))}</div>
            <div>
              <ToggleRow title={t("onboarding.careTeam.step3.toggleDailySummaryTitle")} description={t("onboarding.careTeam.step3.toggleDailySummaryDesc")} checked={consent.daily_summary} onChange={(value) => setC("daily_summary", value)} />
              <ToggleRow title={t("onboarding.careTeam.step3.toggleMoodTitle")} description={t("onboarding.careTeam.step3.toggleMoodDesc")} checked={consent.mood_updates} onChange={(value) => setC("mood_updates", value)} />
              <ToggleRow title={t("onboarding.careTeam.step3.toggleAppointmentsTitle")} description={t("onboarding.careTeam.step3.toggleAppointmentsDesc")} checked={consent.appointments} onChange={(value) => setC("appointments", value)} />
            </div>
          </div>

          <div className={sectionShellClassName}>
            <div className={sectionHeaderClassName}>{plainLabel(t("onboarding.careTeam.step3.sectionHealth"))}</div>
            <div>
              <ToggleRow title={t("onboarding.careTeam.step3.toggleMedicationTitle")} description={t("onboarding.careTeam.step3.toggleMedicationDesc")} checked={consent.medication_alerts} onChange={(value) => setC("medication_alerts", value)} />
              <ToggleRow title={t("onboarding.careTeam.step3.toggleHealthReportsTitle")} description={t("onboarding.careTeam.step3.toggleHealthReportsDesc")} checked={consent.health_reports} onChange={(value) => setC("health_reports", value)} />
              <ToggleRow title={t("onboarding.careTeam.step3.toggleVitalSignsTitle")} description={t("onboarding.careTeam.step3.toggleVitalSignsDesc")} checked={consent.vital_signs} onChange={(value) => setC("vital_signs", value)} />
              <ToggleRow title={t("onboarding.careTeam.step3.toggleCognitiveTitle")} description={t("onboarding.careTeam.step3.toggleCognitiveDesc")} checked={consent.cognitive_results} onChange={(value) => setC("cognitive_results", value)} />
            </div>
          </div>

          <div className={sectionShellClassName}>
            <div className={sectionHeaderClassName}>{plainLabel(t("onboarding.careTeam.step3.sectionSafety"))}</div>
            <div>
              <ToggleRow title={t("onboarding.careTeam.step3.toggleEmergencyTitle")} description={t("onboarding.careTeam.step3.toggleEmergencyDesc")} checked={consent.emergency_alerts} onChange={(value) => setC("emergency_alerts", value)} variant="amber" />
              <ToggleRow title={t("onboarding.careTeam.step3.toggleInactivityTitle")} description={t("onboarding.careTeam.step3.toggleInactivityDesc")} checked={consent.inactivity_alerts} onChange={(value) => setC("inactivity_alerts", value)} />
            </div>
          </div>

          <div className={sectionShellClassName}>
            <div className={sectionHeaderClassName}>{plainLabel(t("onboarding.careTeam.step3.sectionDashboard"))}</div>
            <ToggleRow
              title={t("onboarding.careTeam.step3.toggleDashboardTitle")}
              description={t("onboarding.careTeam.step3.toggleDashboardDesc", { name: person.name || t("onboarding.careTeam.nameFallbackSubject") })}
              checked={consent.dashboard_access}
              onChange={(value) => setC("dashboard_access", value)}
            />
          </div>

          <p className="text-center font-body text-[13px] font-semibold leading-relaxed text-vyva-text-3">
            {t("onboarding.careTeam.step3.footerNote")}
          </p>

          <Button
            onClick={() => setStep(4)}
            className="h-14 w-full rounded-full bg-[#6B21A8] text-[18px] font-black shadow-[0_14px_28px_rgba(107,33,168,0.22)] hover:bg-[#5B1A8F]"
          >
            {t("onboarding.careTeam.step3.confirm")}
          </Button>
        </div>
      </PhoneFrame>
    );
  }

  if (step === 4) {
    const channelOptions: Array<{
      id: InviteChannel;
      icon: LucideIcon;
      title: string;
      contact: string;
      bg: string;
      iconColor: string;
    }> = [
      {
        id: "sms",
        icon: Smartphone,
        title: t("onboarding.careTeam.step4.channelSms"),
        contact: [person.phone, person.email].map((value) => value.trim()).filter(Boolean).join(" + "),
        bg: "#EFF6FF",
        iconColor: "#1D4ED8",
      },
    ];

    return (
      <PhoneFrame subtitle={careTeamStepLabel(4)} showBack onBack={() => setStep(3)}>
        <div className="flex flex-col gap-6 px-1 pb-6 pt-5 sm:px-2 md:px-3">
          <StepDots current={4} />
          <div>
            <h2 className="font-display text-[34px] leading-tight text-vyva-text-1">
              {t("onboarding.careTeam.step4.heading", { name: person.name || t("onboarding.careTeam.nameFallbackObject") })}
            </h2>
            <p className="mt-2 font-body text-[16px] leading-relaxed text-vyva-text-2">
              {t("onboarding.careTeam.step4.subtitle", { name: person.name || t("onboarding.careTeam.nameFallbackObject") })}
            </p>
          </div>

          <div className="grid gap-4">
            {channelOptions.map((opt) => {
              const Icon = opt.icon;
              const selected = inviteChannel === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setInviteChannel(opt.id)}
                  className={cn(
                    "flex min-h-[96px] items-center gap-4 rounded-[24px] border-2 bg-white p-5 text-left shadow-[0_10px_28px_rgba(53,28,87,0.06)] transition-all",
                    selected ? "border-[#6B21A8] bg-purple-50" : "border-[#EFE4D5] hover:border-purple-200",
                  )}
                >
                  <div
                    className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl"
                    style={{ background: opt.bg }}
                  >
                    <Icon size={26} style={{ color: opt.iconColor }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[18px] font-black text-vyva-text-1">{opt.title}</p>
                    <p className="mt-1 truncate font-body text-[14px] font-semibold text-vyva-text-2">
                      {t("onboarding.careTeam.step4.channelTo", { contact: opt.contact })}
                    </p>
                  </div>
                  {selected ? <CheckCircle2 size={22} className="flex-shrink-0 text-vyva-green" /> : null}
                </button>
              );
            })}
          </div>

          <div className="rounded-[24px] border border-green-200 bg-green-50 px-5 py-4">
            <p className="mb-2 font-body text-[12px] font-black uppercase tracking-[0.08em] text-green-700">
              {t("onboarding.careTeam.step4.messagePreviewLabel")}
            </p>
            <p className="font-body text-[15px] font-semibold leading-relaxed text-green-900">
              {t("onboarding.careTeam.step4.messagePreview", { name: person.name || t("onboarding.careTeam.nameFallbackGreeting") })}
              <br />
              <br />
              <span className="font-black text-teal-700">vyva.ai/join/abc123 -&gt;</span>
            </p>
          </div>

          <Button
            onClick={handleSendInvite}
            disabled={saving}
            className="h-14 w-full rounded-full bg-[#6B21A8] text-[18px] font-black shadow-[0_14px_28px_rgba(107,33,168,0.22)] hover:bg-[#5B1A8F]"
          >
            {saving ? t("onboarding.careTeam.step4.sending") : t("onboarding.careTeam.step4.sendInvitation")}
          </Button>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame subtitle={careTeamTitle}>
      <div className="flex flex-col items-center gap-6 px-1 py-10 text-center sm:px-2 md:px-3">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-green-200 bg-green-50 text-green-700 shadow-[0_12px_26px_rgba(10,124,78,0.12)]">
          <CheckCircle2 size={38} />
        </div>
        <div>
          <h2 className="font-display text-[34px] leading-tight text-vyva-text-1">
            {t("onboarding.careTeam.step5.heading", { name: person.name })}
          </h2>
          <p className="mt-3 font-body text-[16px] leading-relaxed text-vyva-text-2">
            {t("onboarding.careTeam.step5.subtitle", { name: person.name })}
          </p>
        </div>

        <div className="flex w-full items-center gap-4 rounded-[24px] border-2 border-[#6B21A8] bg-purple-50 p-4 text-left">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-[#6B21A8] text-[15px] font-black text-white">
            {initials(person.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-body text-[17px] font-black text-vyva-text-1">{person.name}</p>
            <p className="font-body text-[13px] font-black text-purple-700">{getRelationshipLabel(person.relationship)}</p>
            <p className="font-body text-[13px] font-semibold text-vyva-text-2">{t("onboarding.careTeam.step5.invitationSent")}</p>
          </div>
          <span className="flex-shrink-0 rounded-full bg-amber-100 px-3 py-1 font-body text-[12px] font-black text-amber-800">
            {t("onboarding.careTeam.status.pending")}
          </span>
        </div>

        <div className="flex w-full items-start gap-3 rounded-[22px] border border-purple-100 bg-purple-50 px-4 py-4 text-left text-purple-800">
          <ShieldCheck size={20} className="mt-0.5 flex-shrink-0" />
          <p className="font-body text-[14px] font-bold leading-relaxed">
            {t("onboarding.careTeam.step5.infoBanner", { name: person.name })}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <Button
            data-testid="button-careteam-add-another-done"
            onClick={startAddFlow}
            className="h-14 w-full rounded-full bg-[#6B21A8] text-[18px] font-black hover:bg-[#5B1A8F]"
          >
            {t("onboarding.careTeam.step5.addAnother")}
          </Button>
          <Button
            variant="outline"
            onClick={backToRoster}
            className="h-14 w-full rounded-full border-[#6B21A8] text-[17px] font-black text-[#6B21A8]"
          >
            {t("onboarding.careTeam.step5.done")}
          </Button>
        </div>
      </div>
    </PhoneFrame>
  );
}
