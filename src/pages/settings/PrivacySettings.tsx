import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Brain,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ExternalLink,
  Eye,
  FileText,
  Heart,
  Lock,
  Share2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ToggleRow } from "@/components/onboarding/ToggleRow";
import { ProfileSectionHero } from "@/components/onboarding/ProfileSectionHero";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n";
import {
  BRAIN_COACH_CAREGIVER_PERMISSION_KEYS,
  buildBrainCoachCaregiverPermissionPatch,
  hasBrainCoachCaregiverControlPermission,
  normalizeBrainCoachCaregiverPermissions,
  type BrainCoachCaregiverPermissionKey,
  type BrainCoachCaregiverPermissions,
} from "@/lib/brainCoachCaregiverPermissions";
import { apiFetch } from "@/lib/queryClient";

const BRAIN_COACH_PERMISSIONS_QUERY_KEY = "/api/caregiver/brain-coach/permissions";
const CARE_TEAM_QUERY_KEY = "/api/onboarding/careteam";

interface BrainCoachPermissionMember {
  id: string;
  userId: string;
  role: "caregiver" | "family" | string;
  relationship?: string | null;
  displayName?: string | null;
  brainCoachPermissions?: Partial<BrainCoachCaregiverPermissions> | null;
}

interface BrainCoachPermissionsResponse {
  members: BrainCoachPermissionMember[];
  permissionKeys: BrainCoachCaregiverPermissionKey[];
}

interface BrainCoachPermissionUpdateResponse {
  member: BrainCoachPermissionMember;
}

interface CareTeamRosterMember {
  id: string;
  invitee_name: string;
  invitee_phone?: string | null;
  invitee_email?: string | null;
  role: string;
  relationship?: string | null;
  status: string;
  accepted_at?: string | null;
  can_receive_daily_digest?: boolean;
  can_receive_safety_alerts?: boolean;
  can_receive_health_alerts?: boolean;
  can_receive_mood_alerts?: boolean;
  can_receive_medication_alerts?: boolean;
  can_view_dashboard?: boolean;
  can_view_health_reports?: boolean;
  can_view_vital_signs?: boolean;
  can_view_journal_summaries?: boolean;
}

interface CareTeamRosterResponse {
  members: CareTeamRosterMember[];
}

interface BrainCoachPermissionCopy {
  key: BrainCoachCaregiverPermissionKey;
  icon: LucideIcon;
  translationKey: string;
  label: string;
  description: string;
}

interface SharingPermissionCopy {
  key: keyof Pick<
    CareTeamRosterMember,
    | "can_receive_daily_digest"
    | "can_receive_safety_alerts"
    | "can_receive_health_alerts"
    | "can_receive_mood_alerts"
    | "can_receive_medication_alerts"
    | "can_view_dashboard"
    | "can_view_health_reports"
    | "can_view_vital_signs"
    | "can_view_journal_summaries"
  >;
  icon: LucideIcon;
  translationKey: string;
  label: string;
  description: string;
}

const BRAIN_COACH_PERMISSION_COPY: BrainCoachPermissionCopy[] = [
  {
    key: "view_summary",
    icon: Eye,
    translationKey: "viewSummary",
    label: "View Brain Coach summary",
    description: "Current streak, plan completion, recent domains, and recent activities.",
  },
  {
    key: "manage_plan_preferences",
    icon: SlidersHorizontal,
    translationKey: "managePlanPreferences",
    label: "Manage plan preferences",
    description: "Focus domains, excluded activities, session length, and weekly goal.",
  },
  {
    key: "manage_schedule",
    icon: CalendarClock,
    translationKey: "manageSchedule",
    label: "Manage schedule",
    description: "Pause or resume Brain Coach rhythm and training times.",
  },
  {
    key: "send_nudges",
    icon: Bell,
    translationKey: "sendNudges",
    label: "Send in-app nudges",
    description: "Gentle Brain Coach reminders inside VYVA only.",
  },
  {
    key: "preview_plan",
    icon: Sparkles,
    translationKey: "previewPlan",
    label: "Preview plan",
    description: "See proposed Brain Coach activities without changing today's plan.",
  },
];

const SHARING_PERMISSION_COPY: SharingPermissionCopy[] = [
  {
    key: "can_receive_daily_digest",
    icon: FileText,
    translationKey: "dailyDigest",
    label: "Daily wellbeing summary",
    description: "Daily wellbeing and care highlights.",
  },
  {
    key: "can_receive_safety_alerts",
    icon: Shield,
    translationKey: "safetyAlerts",
    label: "Safety alerts",
    description: "Important safety events and urgent check-ins.",
  },
  {
    key: "can_receive_health_alerts",
    icon: Heart,
    translationKey: "healthUpdates",
    label: "Health updates",
    description: "Health changes and wellbeing alerts.",
  },
  {
    key: "can_receive_mood_alerts",
    icon: Sparkles,
    translationKey: "moodUpdates",
    label: "Mood updates",
    description: "Mood and daily wellbeing changes.",
  },
  {
    key: "can_receive_medication_alerts",
    icon: Bell,
    translationKey: "medicationAlerts",
    label: "Medication alerts",
    description: "Medication reminders and missed-dose alerts.",
  },
  {
    key: "can_view_dashboard",
    icon: Eye,
    translationKey: "caregiverDashboard",
    label: "Caregiver dashboard",
    description: "Read-only access to the caregiver dashboard.",
  },
  {
    key: "can_view_health_reports",
    icon: FileText,
    translationKey: "healthReports",
    label: "Health reports",
    description: "Reports shared from the senior profile.",
  },
  {
    key: "can_view_vital_signs",
    icon: Heart,
    translationKey: "vitalSigns",
    label: "Vital signs",
    description: "Vitals shared from health tracking.",
  },
  {
    key: "can_view_journal_summaries",
    icon: Share2,
    translationKey: "conversationSummaries",
    label: "Conversation summaries",
    description: "Daily highlights from conversations.",
  },
];

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : fallbackMessage;
    throw new Error(message);
  }
  return body as T;
}

const CARE_TEAM_ROLE_KEYS: Record<string, string> = {
  family: "familyMember",
  family_member: "familyMember",
  caregiver: "caregiver",
  carer: "caregiver",
  doctor: "doctor",
};

const CARE_TEAM_RELATIONSHIP_KEYS: Record<string, string> = {
  son: "son",
  daughter: "daughter",
  spouse_partner: "spousePartner",
  sibling: "sibling",
  friend: "friend",
  neighbour: "neighbour",
  professional_carer: "professionalCarer",
  gp: "gp",
  specialist_doctor: "specialistDoctor",
  other: "other",
};

function humanizeValue(value: string | null | undefined) {
  if (!value) return null;
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function careTeamStatusClassName(status: string) {
  if (status === "accepted") return "bg-green-100 text-green-800";
  if (status === "pending") return "bg-amber-100 text-amber-800";
  if (status === "expired") return "bg-gray-100 text-gray-600";
  return "bg-red-100 text-red-700";
}

function careTeamMembersForPrivacy(members: CareTeamRosterMember[]) {
  return members.filter((member) => member.status !== "revoked" && member.status !== "declined");
}

const PrivacySettings = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [globalToggles, setGlobalToggles] = useState({
    analytics: false,
    dataImprovement: false,
  });
  const [expandedPerson, setExpandedPerson] = useState<string | null | undefined>(undefined);
  const [savingPermissionId, setSavingPermissionId] = useState<string | null>(null);

  const permissionStatusLabel = (permissions: Partial<BrainCoachCaregiverPermissions> | null | undefined) => {
    const normalized = normalizeBrainCoachCaregiverPermissions(permissions);
    if (!normalized.view_summary) {
      return t("settings.privacy.brainCoach.status.noAccess", "No Brain Coach access");
    }
    return hasBrainCoachCaregiverControlPermission(normalized)
      ? t("settings.privacy.brainCoach.status.controlsEnabled", "Controls enabled")
      : t("settings.privacy.brainCoach.status.summaryOnly", "Summary only");
  };

  const memberRoleLabel = (member: BrainCoachPermissionMember) => {
    if (member.relationship) {
      const relationshipKey = CARE_TEAM_RELATIONSHIP_KEYS[member.relationship];
      return relationshipKey
        ? t(
            `onboarding.careTeam.relationships.${relationshipKey}`,
            humanizeValue(member.relationship) ?? member.relationship,
          )
        : humanizeValue(member.relationship) ?? member.relationship;
    }
    return member.role === "family"
      ? t("onboarding.careTeam.roles.familyMember", "Family member")
      : t("onboarding.careTeam.roles.caregiver", "Caregiver");
  };

  const memberDisplayName = (member: BrainCoachPermissionMember) =>
    member.displayName?.trim() || memberRoleLabel(member);

  const careTeamDisplayName = (member: CareTeamRosterMember) =>
    member.invitee_name?.trim() || t("settings.privacy.careTeam.memberFallback", "Care team member");

  const careTeamRoleLabel = (member: CareTeamRosterMember) => {
    const relationship = member.relationship?.trim();
    if (relationship) {
      const relationshipKey = CARE_TEAM_RELATIONSHIP_KEYS[relationship];
      return relationshipKey
        ? t(`onboarding.careTeam.relationships.${relationshipKey}`, humanizeValue(relationship) ?? relationship)
        : humanizeValue(relationship) ?? relationship;
    }
    const roleKey = CARE_TEAM_ROLE_KEYS[member.role];
    return roleKey
      ? t(`onboarding.careTeam.roles.${roleKey}`, humanizeValue(member.role) ?? member.role)
      : humanizeValue(member.role) ?? t("settings.privacy.careTeam.memberFallback", "Care team member");
  };

  const careTeamStatusLabel = (status: string) =>
    t(`onboarding.careTeam.status.${status}`, humanizeValue(status) ?? t("onboarding.careTeam.status.pending", "Pending"));

  const careTeamQuery = useQuery<CareTeamRosterResponse>({
    queryKey: [CARE_TEAM_QUERY_KEY],
    queryFn: async () => {
      const response = await apiFetch(CARE_TEAM_QUERY_KEY);
      return readJsonResponse<CareTeamRosterResponse>(
        response,
        t("settings.privacy.careTeam.loadErrorTitle", "Care team could not be loaded."),
      );
    },
    retry: false,
  });

  const brainCoachPermissionsQuery = useQuery<BrainCoachPermissionsResponse>({
    queryKey: [BRAIN_COACH_PERMISSIONS_QUERY_KEY],
    queryFn: async () => {
      const response = await apiFetch(BRAIN_COACH_PERMISSIONS_QUERY_KEY);
      return readJsonResponse<BrainCoachPermissionsResponse>(
        response,
        t("settings.privacy.brainCoach.loadErrorTitle", "Brain Coach caregiver access could not be loaded."),
      );
    },
    retry: false,
  });

  const updateBrainCoachPermission = useMutation({
    mutationFn: async (input: {
      member: BrainCoachPermissionMember;
      key: BrainCoachCaregiverPermissionKey;
      nextValue: boolean;
    }) => {
      const patch = buildBrainCoachCaregiverPermissionPatch(
        input.member.brainCoachPermissions,
        input.key,
        input.nextValue,
      );
      const response = await apiFetch(`${BRAIN_COACH_PERMISSIONS_QUERY_KEY}/${input.member.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      return readJsonResponse<BrainCoachPermissionUpdateResponse>(
        response,
        t("settings.privacy.brainCoach.saveError", "Brain Coach caregiver access could not be saved."),
      );
    },
    onSuccess: (data) => {
      queryClient.setQueryData<BrainCoachPermissionsResponse>([BRAIN_COACH_PERMISSIONS_QUERY_KEY], (current) => {
        if (!current) return current;
        return {
          ...current,
          members: current.members.map((member) => member.id === data.member.id ? data.member : member),
        };
      });
      toast({
        title: t("settings.privacy.brainCoachAccessUpdated", "Brain Coach access updated"),
        description: t("settings.privacy.brainCoachAccessUpdatedDesc", "This care team member's Brain Coach permissions were saved."),
      });
    },
    onError: (error) => {
      toast({
        title: t("settings.privacy.brainCoach.updateError", "Could not update Brain Coach access"),
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
    onSettled: () => setSavingPermissionId(null),
  });

  const toggleGlobal = (key: keyof typeof globalToggles) =>
    setGlobalToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleBrainCoachPermissionToggle = (
    member: BrainCoachPermissionMember,
    key: BrainCoachCaregiverPermissionKey,
  ) => {
    const permissions = normalizeBrainCoachCaregiverPermissions(member.brainCoachPermissions);
    const nextValue = !permissions[key];
    const savingId = `${member.id}:${key}`;
    setSavingPermissionId(savingId);
    updateBrainCoachPermission.mutate({ member, key, nextValue });
  };

  const renderReadOnlySwitch = (enabled: boolean, label: string, memberName: string) => (
    <div
      role="status"
      aria-label={t("settings.privacy.careTeam.sharingAria", "{{label}} for {{member}}: {{status}}", {
        label,
        member: memberName,
        status: enabled
          ? t("settings.privacy.careTeam.shared", "shared")
          : t("settings.privacy.careTeam.notShared", "not shared"),
      })}
      className={`relative h-8 w-14 flex-shrink-0 rounded-full ${enabled ? "bg-vyva-purple" : "bg-[#DDD5C8]"}`}
    >
      <div
        className={`absolute top-0.5 h-7 w-7 rounded-full bg-white shadow ${
          enabled ? "left-[26px]" : "left-0.5"
        }`}
      />
    </div>
  );

  const renderCareTeamPrivacy = () => {
    if (careTeamQuery.isLoading) {
      return (
        <div className="px-5 py-5 font-body text-[14px] font-semibold text-vyva-text-2">
          {t("settings.privacy.careTeam.loading", "Loading care-team sharing")}
        </div>
      );
    }

    if (careTeamQuery.isError) {
      return (
        <div className="px-5 py-5">
          <p className="font-body text-[15px] font-black text-vyva-text-1">
            {t("settings.privacy.careTeam.loadErrorTitle", "Care-team sharing could not be loaded.")}
          </p>
          <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">
            {t("settings.privacy.careTeam.loadErrorDescription", "Open Care Team to review invitations and sharing access.")}
          </p>
        </div>
      );
    }

    const members = careTeamMembersForPrivacy(careTeamQuery.data?.members ?? []);
    if (members.length === 0) {
      return (
        <div className="px-5 py-6" data-testid="privacy-careteam-empty">
          <p className="font-body text-[16px] font-black text-vyva-text-1">
            {t("settings.privacy.careTeam.emptyTitle", "No care-team members yet.")}
          </p>
          <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">
            {t("settings.privacy.careTeam.emptyDescription", "Add a caregiver, family member, or doctor before sharing profile updates.")}
          </p>
          <button
            type="button"
            onClick={() => navigate("/onboarding/profile/care-team")}
            className="mt-4 rounded-full bg-vyva-purple px-5 py-3 font-body text-[14px] font-black text-white shadow-[0_10px_22px_rgba(107,33,168,0.16)]"
            data-testid="button-privacy-add-careteam"
          >
            {t("settings.privacy.careTeam.addMember", "Add care team member")}
          </button>
        </div>
      );
    }

    const activeExpandedPerson = expandedPerson === undefined ? members[0]?.id ?? null : expandedPerson;
    return members.map((member) => {
      const memberName = careTeamDisplayName(member);
      const isOpen = activeExpandedPerson === member.id;
      return (
        <div
          key={member.id}
          className="border-t border-vyva-border first:border-t-0"
          data-testid={`item-privacy-person-${member.id}`}
        >
          <button
            data-testid={`button-privacy-expand-${member.id}`}
            onClick={() => setExpandedPerson(isOpen ? null : member.id)}
            className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-vyva-warm/40"
          >
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl font-body text-[16px] font-black text-white shadow-[0_10px_22px_rgba(107,33,168,0.16)]"
              style={{ background: "#6B21A8" }}
              data-testid={`avatar-privacy-${member.id}`}
            >
              {memberName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-body text-[17px] font-black text-vyva-text-1">{memberName}</p>
                <span className={`rounded-full px-2.5 py-1 font-body text-[11px] font-black ${careTeamStatusClassName(member.status)}`}>
                  {careTeamStatusLabel(member.status)}
                </span>
              </div>
              <p className="font-body text-[14px] text-vyva-text-2">{careTeamRoleLabel(member)}</p>
            </div>
            <ChevronDown
              size={18}
              className={`text-vyva-text-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isOpen && (
            <div
              className="border-t border-vyva-border bg-vyva-cream/60"
              data-testid={`section-privacy-detail-${member.id}`}
            >
              {SHARING_PERMISSION_COPY.map((permission) => {
                const label = t(`settings.privacy.sharingPermissions.${permission.translationKey}.label`, permission.label);
                return (
                  <ToggleRow
                  key={permission.key}
                  icon={permission.icon}
                  iconBg="#F5F3FF"
                  iconColor="#6B21A8"
                  label={label}
                  sub={t(`settings.privacy.sharingPermissions.${permission.translationKey}.description`, permission.description)}
                  rightContent={renderReadOnlySwitch(Boolean(member[permission.key]), label, memberName)}
                  testId={`sharing-status-${member.id}-${permission.key}`}
                />
                );
              })}
              <p className="border-t border-vyva-border px-5 py-3 font-body text-[12px] font-bold text-vyva-text-3">
                {t("settings.privacy.careTeam.sharingSource", "Sharing access is based on the latest care-team invitation settings.")}
              </p>
            </div>
          )}
        </div>
      );
    });
  };

  const renderBrainCoachPermissions = () => {
    if (brainCoachPermissionsQuery.isLoading) {
      return (
        <div className="px-5 py-5 font-body text-[14px] font-semibold text-vyva-text-2">
          {t("settings.privacy.brainCoach.loading", "Loading Brain Coach caregiver access")}
        </div>
      );
    }

    if (brainCoachPermissionsQuery.isError) {
      return (
        <div className="px-5 py-5">
          <p className="font-body text-[15px] font-black text-vyva-text-1">
            {t("settings.privacy.brainCoach.loadErrorTitle", "Brain Coach access could not be loaded.")}
          </p>
          <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">
            {t("settings.privacy.brainCoach.seniorOnly", "Only the senior account can change caregiver Brain Coach permissions.")}
          </p>
        </div>
      );
    }

    const members = brainCoachPermissionsQuery.data?.members ?? [];
    if (members.length === 0) {
      return (
        <div className="px-5 py-5">
          <p className="font-body text-[15px] font-black text-vyva-text-1">
            {t("settings.privacy.brainCoach.emptyTitle", "No active caregivers yet.")}
          </p>
          <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">
            {t("settings.privacy.brainCoach.emptyDescription", "Invite a caregiver or family member before granting Brain Coach access.")}
          </p>
        </div>
      );
    }

    return members.map((member) => {
      const permissions = normalizeBrainCoachCaregiverPermissions(member.brainCoachPermissions);
      const statusLabel = permissionStatusLabel(permissions);
      return (
        <div key={member.id} className="border-t border-vyva-border first:border-t-0" data-testid={`brain-coach-permissions-member-${member.id}`}>
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#6B21A8] font-body text-[16px] font-black text-white shadow-[0_10px_22px_rgba(107,33,168,0.16)]">
              {memberDisplayName(member).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-body text-[17px] font-black text-vyva-text-1">{memberDisplayName(member)}</p>
              <p className="font-body text-[14px] text-vyva-text-2">{memberRoleLabel(member)}</p>
            </div>
            <span className="rounded-full bg-[#F5F0FF] px-3 py-1 text-[12px] font-black text-vyva-purple">
              {statusLabel}
            </span>
          </div>

          <div className="border-t border-vyva-border bg-vyva-cream/60">
            {BRAIN_COACH_PERMISSION_COPY
              .filter((permission) => BRAIN_COACH_CAREGIVER_PERMISSION_KEYS.includes(permission.key))
              .map((permission) => {
                const isOn = permissions[permission.key];
                const savingId = `${member.id}:${permission.key}`;
                const isSaving = savingPermissionId === savingId;
                const isBusy = Boolean(savingPermissionId);
                const Icon = permission.icon;
                return (
                  <div
                    key={permission.key}
                    className="flex items-center gap-4 border-t border-vyva-border px-4 py-4 first:border-t-0"
                    data-testid={`row-brain-coach-${member.id}-${permission.key}`}
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px] bg-[#F5F3FF]">
                      <Icon size={18} className="text-vyva-purple" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-[16px] font-black leading-tight text-vyva-text-1">
                        {t(`settings.privacy.brainCoach.permissions.${permission.translationKey}.label`, permission.label)}
                      </p>
                      <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">
                        {t(`settings.privacy.brainCoach.permissions.${permission.translationKey}.description`, permission.description)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleBrainCoachPermissionToggle(member, permission.key)}
                      disabled={isBusy}
                      aria-pressed={isOn}
                      aria-label={`${isOn
                        ? t("settings.privacy.brainCoach.revoke", "Revoke")
                        : t("settings.privacy.brainCoach.grant", "Grant")} ${t(
                          `settings.privacy.brainCoach.permissions.${permission.translationKey}.label`,
                          permission.label,
                        )} ${t("settings.privacy.brainCoach.for", "for")} ${memberDisplayName(member)}`}
                      data-testid={`toggle-brain-coach-${member.id}-${permission.key}`}
                      className={`relative h-8 w-14 flex-shrink-0 rounded-full transition-colors disabled:cursor-wait disabled:opacity-70 ${
                        isOn ? "bg-vyva-purple" : "bg-[#DDD5C8]"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-7 w-7 rounded-full bg-white shadow transition-transform ${
                          isOn ? "left-[26px]" : "left-0.5"
                        }`}
                      />
                      {isSaving ? <span className="sr-only">{t("settings.privacy.brainCoach.saving", "Saving")}</span> : null}
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-vyva-cream">
      <div className="mx-auto flex w-full max-w-[920px] items-center gap-3 px-5 pb-4 pt-10">
        <button
          data-testid="button-privacy-back"
          onClick={() => navigate(-1)}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-vyva-border bg-white shadow-sm"
        >
          <ChevronLeft size={22} className="text-vyva-text-1" />
        </button>
        <h1 className="font-display text-[24px] font-semibold text-vyva-text-1">{t("settings.privacy.title")}</h1>
      </div>

      <div className="mx-auto w-full max-w-[920px] space-y-7 px-5 pb-10">
        <ProfileSectionHero
          icon={Lock}
          title={t("settings.privacy.title")}
          kicker={t("settings.privacy.hero.kicker", "Your choice")}
          description={t("settings.privacy.hero.description", "Keep VYVA useful while staying in control of what is shared, who sees it, and when access can change.")}
          badges={[
            { label: t("settings.privacy.hero.youDecide", "You decide"), color: "purple" },
            { label: t("settings.privacy.hero.careTeamAccess", "Care team access"), color: "blue" },
            { label: t("settings.privacy.hero.gdprProtected", "GDPR protected"), color: "green" },
          ]}
        />

        <div
          className="overflow-hidden rounded-[26px] border border-[#EFE4D5] bg-white shadow-[0_14px_34px_rgba(53,28,87,0.06)]"
          data-testid="section-privacy-global"
        >
          <div className="border-b border-vyva-border bg-vyva-warm px-5 py-4">
            <span className="font-body text-[13px] font-black uppercase tracking-[0.08em] text-vyva-text-2">
              {t("settings.privacy.vyvaDataUse")}
            </span>
          </div>
          <ToggleRow
            icon={FileText}
            iconBg="#EDE9FE"
            iconColor="#6B21A8"
            label={t("settings.privacy.analyticsLabel")}
            sub={t("settings.privacy.analyticsSub")}
            value={globalToggles.analytics}
            onToggle={() => toggleGlobal("analytics")}
            testId="toggle-privacy-analytics"
          />
          <ToggleRow
            icon={Eye}
            iconBg="#EDE9FE"
            iconColor="#6B21A8"
            label={t("settings.privacy.aiImprovementLabel")}
            sub={t("settings.privacy.aiImprovementSub")}
            value={globalToggles.dataImprovement}
            onToggle={() => toggleGlobal("dataImprovement")}
            testId="toggle-privacy-ai-improvement"
          />
          <a
            href="https://vyva.life/privacypolicy"
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[60px] items-center justify-between gap-3 border-t border-vyva-border bg-vyva-cream/40 px-5 py-4 text-left hover:bg-vyva-warm/60"
            data-testid="link-privacy-policy"
          >
            <span className="font-body text-[15px] font-black text-vyva-text-2">
              {t("settings.home.rows.privacyPolicy")}
            </span>
            <ExternalLink size={18} className="text-vyva-purple" />
          </a>
        </div>

        <div
          className="overflow-hidden rounded-[26px] border border-[#EFE4D5] bg-white shadow-[0_14px_34px_rgba(53,28,87,0.06)]"
          data-testid="section-privacy-brain-coach"
        >
          <div className="flex items-start gap-3 border-b border-vyva-border bg-vyva-warm px-5 py-4">
            <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F5F0FF] text-vyva-purple">
              <Brain size={20} />
            </div>
            <div className="min-w-0">
              <span className="font-body text-[13px] font-black uppercase tracking-[0.08em] text-vyva-text-2">
                {t("settings.privacy.brainCoach.title", "Brain Coach caregiver access")}
              </span>
              <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">
                {t("settings.privacy.brainCoach.description", "Decide what each approved caregiver can see or control in Brain Coach.")}
              </p>
            </div>
          </div>
          {renderBrainCoachPermissions()}
        </div>

        <div
          className="overflow-hidden rounded-[26px] border border-[#EFE4D5] bg-white shadow-[0_14px_34px_rgba(53,28,87,0.06)]"
          data-testid="section-privacy-per-person"
        >
          <div className="flex items-center gap-3 border-b border-vyva-border bg-vyva-warm px-5 py-4">
            <Users size={18} className="text-vyva-purple" />
            <span className="font-body text-[13px] font-black uppercase tracking-[0.08em] text-vyva-text-2">
              {t("settings.privacy.whatIShare")}
            </span>
          </div>

          {renderCareTeamPrivacy()}
        </div>

        <p className="font-body text-center text-[13px] font-semibold text-vyva-text-3">
          {t("settings.privacy.gdprFooter")}
        </p>
      </div>
    </div>
  );
};

export default PrivacySettings;
