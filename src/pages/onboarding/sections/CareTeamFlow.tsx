import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  HeartHandshake,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/apiError";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ProfileSectionHero, seniorInputClassName } from "@/components/onboarding/ProfileSectionHero";
import { ToggleRow } from "@/components/onboarding/ToggleRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Role = "family" | "carer" | "doctor";
type InviteChannel = "sms";
type Step = 1 | 2 | 3 | 4 | 5;
type Mode = "roster" | "adding";

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

function deliveryLabel(member: TeamMember) {
  if (!member.latest_delivery_status) return null;
  const channel = member.latest_delivery_channel ? ` by ${member.latest_delivery_channel}` : "";
  if (member.latest_delivery_status === "sent") return `Invite sent${channel}`;
  if (member.latest_delivery_status === "failed") return `Invite delivery needs attention${channel}`;
  if (member.latest_delivery_status === "queued" || member.latest_delivery_status === "sending") return `Invite delivery in progress${channel}`;
  return `Invite delivery: ${member.latest_delivery_status}${channel}`;
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
  const location = useLocation();
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

  const getStatusClass = (status: string) => STATUS_BADGE_CLASSES[status] ?? STATUS_BADGE_CLASSES.pending;
  const careTeamTitle = t("profile.overview.sections.careTeam.title");
  const careTeamStepLabel = (current: number) => `${careTeamTitle} - ${t("onboarding.careTeam.stepDots", { current })}`;

  const [mode, setMode] = useState<Mode>("roster");
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<Role>("family");
  const [person, setPerson] = useState<PersonForm>({ name: "", relationship: "", phone: "", whatsapp: "", email: "" });
  const [consent, setConsent] = useState<ConsentState>(defaultConsent("family"));
  const [inviteChannel, setInviteChannel] = useState<InviteChannel>("sms");
  const [saving, setSaving] = useState(false);
  const [confirmingRevokeId, setConfirmingRevokeId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const returnState = location.state && typeof location.state === "object"
    ? location.state as Record<string, unknown>
    : null;
  const conciergeReturnTo = returnState?.returnTo === "/concierge" ? "/concierge" : null;

  const setP = (field: keyof PersonForm, value: string) => setPerson((prev) => ({ ...prev, [field]: value }));
  const setC = (field: keyof ConsentState, value: boolean) => setConsent((prev) => ({ ...prev, [field]: value }));

  const selectRole = (nextRole: Role) => {
    setRole(nextRole);
    setConsent(defaultConsent(nextRole));
  };

  const { data: rosterData, isLoading: rosterLoading, isError: rosterError } = useQuery<{ members: TeamMember[] }>({
    queryKey: ["/api/onboarding/careteam"],
  });

  const members = rosterData?.members ?? [];

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
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/careteam"] });
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
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/careteam"] });
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
      await queryClient.invalidateQueries({ queryKey: ["/api/onboarding/careteam"] });
      if (conciergeReturnTo) {
        navigate(conciergeReturnTo, {
          state: {
            providerSetupHelpRequested: {
              setupReason: typeof returnState?.setupReason === "string" ? returnState.setupReason : "",
              conciergeResume: returnState?.conciergeResume ?? null,
              helperName: person.name.trim(),
            },
          },
        });
        return;
      }
      setStep(5);
    } catch (err) {
      const msg = await friendlyError(err, res && !res.ok ? res : undefined);
      toast({ title: t("onboarding.careTeam.toastInviteError"), description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const effectiveMode: Mode = mode === "roster" && !rosterLoading && !rosterError && members.length === 0 ? "adding" : mode;

  if (effectiveMode === "roster") {
    if (rosterLoading) {
      return (
        <PhoneFrame subtitle={careTeamTitle} showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")}>
          <div className="flex items-center justify-center py-20">
            <div className="font-body text-[15px] font-semibold text-vyva-text-3">{t("onboarding.careTeam.loading")}</div>
          </div>
        </PhoneFrame>
      );
    }

    if (rosterError) {
      return (
        <PhoneFrame subtitle={careTeamTitle} showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")}>
          <div className="flex flex-col items-center gap-4 px-5 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <AlertTriangle size={28} />
            </div>
            <div>
              <p className="font-body text-[18px] font-black text-vyva-text-1">{t("onboarding.careTeam.errorTitle")}</p>
              <p className="mt-1 font-body text-[14px] leading-relaxed text-vyva-text-2">{t("onboarding.careTeam.errorMessage")}</p>
            </div>
            <Button
              data-testid="button-careteam-retry"
              variant="outline"
              onClick={() => queryClient.refetchQueries({ queryKey: ["/api/onboarding/careteam"] })}
              className="h-12 rounded-full border-purple-200 px-6 text-[15px] font-black text-purple-700"
            >
              {t("onboarding.careTeam.retry")}
            </Button>
          </div>
        </PhoneFrame>
      );
    }

    return (
      <PhoneFrame subtitle={careTeamTitle} showBack onBack={() => navigate("/onboarding/profile")} showAllSections onAllSections={() => navigate("/onboarding/profile")}>
        <div className="flex flex-col gap-6 px-1 pb-6 pt-5 sm:px-2 md:px-3">
          <ProfileSectionHero
            icon={Users}
            title={careTeamTitle}
            kicker={careTeamTitle}
            description={t("onboarding.careTeam.rosterSubtitle")}
            badges={[
              { label: plainLabel(t("onboarding.careTeam.step3.sectionUpdates")), color: "purple" },
              { label: plainLabel(t("onboarding.careTeam.step3.sectionSafety")), color: "amber" },
              { label: plainLabel(t("onboarding.careTeam.step3.sectionHealth")), color: "green" },
            ]}
          />

          <div className="flex flex-col gap-4">
            {members.map((member) => {
              const badgeClass = getStatusClass(member.status);
              const badgeLabel = getStatusLabel(member.status);
              const isLoading = actionLoadingId === member.id;
              const isConfirming = confirmingRevokeId === member.id;
              const canRevoke = member.status === "pending" || member.status === "accepted";
              const canResend = member.status === "pending" || member.status === "expired";
              const detailLine = [
                getRoleLabel(member.role),
                member.relationship ? getRelationshipLabel(member.relationship) : null,
              ].filter(Boolean).join(" - ");
              const delivery = deliveryLabel(member);

              return (
                <div
                  key={member.id}
                  data-testid={`card-careteam-member-${member.id}`}
                  className="overflow-hidden rounded-[24px] border border-[#EFE4D5] bg-white shadow-[0_12px_30px_rgba(53,28,87,0.06)]"
                >
                  <div className="flex items-center gap-4 p-4">
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-[#6B21A8] text-[15px] font-black text-white shadow-[0_12px_24px_rgba(107,33,168,0.2)]">
                      {initials(member.invitee_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-body text-[17px] font-black text-vyva-text-1">{member.invitee_name}</p>
                      <p className="font-body text-[13px] font-bold text-purple-700">{detailLine}</p>
                      {member.invitee_phone ? (
                        <p className="truncate font-body text-[13px] text-vyva-text-3">{member.invitee_phone}</p>
                      ) : null}
                      {delivery ? (
                        <p className={cn(
                          "mt-1 font-body text-[12px] font-black",
                          member.latest_delivery_status === "failed" ? "text-red-600" : "text-vyva-text-3",
                        )}>
                          {delivery}
                        </p>
                      ) : null}
                    </div>
                    <span className={cn("flex-shrink-0 rounded-full px-3 py-1 font-body text-[12px] font-black", badgeClass)}>
                      {badgeLabel}
                    </span>
                  </div>

                  {(canRevoke || canResend) && !isConfirming ? (
                    <div className="flex justify-end gap-2 border-t border-vyva-border px-4 py-3">
                      {canResend ? (
                        <button
                          type="button"
                          data-testid={`button-careteam-resend-${member.id}`}
                          disabled={isLoading}
                          onClick={() => resendInvitation(member.id)}
                          className="min-h-10 rounded-full px-4 font-body text-[13px] font-black text-purple-700 hover:bg-purple-50 disabled:opacity-40"
                        >
                          {isLoading ? t("onboarding.careTeam.resending") : t("onboarding.careTeam.resendInvite")}
                        </button>
                      ) : null}
                      {canRevoke ? (
                        <button
                          type="button"
                          data-testid={`button-careteam-revoke-${member.id}`}
                          disabled={isLoading}
                          onClick={() => setConfirmingRevokeId(member.id)}
                          className="min-h-10 rounded-full px-4 font-body text-[13px] font-black text-red-600 hover:bg-red-50 disabled:opacity-40"
                        >
                          {member.status === "accepted" ? t("onboarding.careTeam.removeAccess") : t("onboarding.careTeam.cancelInvite")}
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
                          className="min-h-10 rounded-full px-4 font-body text-[13px] font-black text-vyva-text-2 hover:bg-white"
                        >
                          {t("onboarding.careTeam.keep")}
                        </button>
                        <button
                          type="button"
                          data-testid={`button-careteam-revoke-confirm-${member.id}`}
                          disabled={isLoading}
                          onClick={() => revokeInvitation(member.id)}
                          className="min-h-10 rounded-full px-4 font-body text-[13px] font-black text-red-700 hover:bg-white disabled:opacity-40"
                        >
                          {isLoading ? t("onboarding.careTeam.removing") : member.status === "accepted" ? t("onboarding.careTeam.yesRemove") : t("onboarding.careTeam.yesCancel")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="flex items-start gap-3 rounded-[22px] border border-purple-100 bg-purple-50 px-4 py-4 text-purple-800">
            <ShieldCheck size={20} className="mt-0.5 flex-shrink-0" />
            <p className="font-body text-[14px] font-bold leading-relaxed">{t("onboarding.careTeam.rosterInfoBanner")}</p>
          </div>

          <Button
            data-testid="button-careteam-add-another"
            onClick={startAddFlow}
            className="h-14 w-full rounded-full bg-[#6B21A8] text-[17px] font-black hover:bg-[#5B1A8F]"
          >
            {t("onboarding.careTeam.addAnother")}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/onboarding/profile")}
            className="h-14 w-full rounded-full border-purple-200 text-[16px] font-black text-purple-700"
          >
            {t("onboarding.careTeam.doneBack")}
          </Button>
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
