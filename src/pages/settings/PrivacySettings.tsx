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

const PEOPLE = [
  { id: "sarah", name: "Sarah Collins", role: "profile.roles.daughter" },
  { id: "james", name: "James Collins", role: "profile.roles.son" },
  { id: "linda", name: "Linda Hughes", role: "profile.roles.carer" },
  { id: "dr_patel", name: "Dr. Anita Patel", role: "profile.roles.gp" },
];

interface PersonConsent {
  health: boolean;
  location: boolean;
  conversations: boolean;
}

const DEFAULT_CONSENT: PersonConsent = {
  health: false,
  location: false,
  conversations: false,
};

const BRAIN_COACH_PERMISSIONS_QUERY_KEY = "/api/caregiver/brain-coach/permissions";

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

interface BrainCoachPermissionCopy {
  key: BrainCoachCaregiverPermissionKey;
  icon: LucideIcon;
  label: string;
  description: string;
}

const BRAIN_COACH_PERMISSION_COPY: BrainCoachPermissionCopy[] = [
  {
    key: "view_summary",
    icon: Eye,
    label: "View Brain Coach summary",
    description: "Current streak, plan completion, recent domains, and recent activities.",
  },
  {
    key: "manage_plan_preferences",
    icon: SlidersHorizontal,
    label: "Manage plan preferences",
    description: "Focus domains, excluded activities, session length, and weekly goal.",
  },
  {
    key: "manage_schedule",
    icon: CalendarClock,
    label: "Manage schedule",
    description: "Pause or resume Brain Coach rhythm and training times.",
  },
  {
    key: "send_nudges",
    icon: Bell,
    label: "Send in-app nudges",
    description: "Gentle Brain Coach reminders inside VYVA only.",
  },
  {
    key: "preview_plan",
    icon: Sparkles,
    label: "Preview plan",
    description: "See proposed Brain Coach activities without changing today's plan.",
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

function permissionStatusLabel(permissions: Partial<BrainCoachCaregiverPermissions> | null | undefined) {
  const normalized = normalizeBrainCoachCaregiverPermissions(permissions);
  if (!normalized.view_summary) return "No Brain Coach access";
  return hasBrainCoachCaregiverControlPermission(normalized) ? "Controls enabled" : "Summary only";
}

function memberRoleLabel(member: BrainCoachPermissionMember) {
  if (member.relationship) return member.relationship;
  return member.role === "family" ? "Family member" : "Caregiver";
}

function memberDisplayName(member: BrainCoachPermissionMember) {
  return member.displayName?.trim() || memberRoleLabel(member);
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
  const [personConsents, setPersonConsents] = useState<Record<string, PersonConsent>>(
    Object.fromEntries(PEOPLE.map((p) => [p.id, { ...DEFAULT_CONSENT, health: p.id !== "dr_patel" }]))
  );
  const [expandedPerson, setExpandedPerson] = useState<string | null>("sarah");
  const [savingPermissionId, setSavingPermissionId] = useState<string | null>(null);

  const brainCoachPermissionsQuery = useQuery<BrainCoachPermissionsResponse>({
    queryKey: [BRAIN_COACH_PERMISSIONS_QUERY_KEY],
    queryFn: async () => {
      const response = await apiFetch(BRAIN_COACH_PERMISSIONS_QUERY_KEY);
      return readJsonResponse<BrainCoachPermissionsResponse>(response, "Brain Coach caregiver access could not be loaded.");
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
      return readJsonResponse<BrainCoachPermissionUpdateResponse>(response, "Brain Coach caregiver access could not be saved.");
    },
    onSuccess: (data) => {
      queryClient.setQueryData<BrainCoachPermissionsResponse>([BRAIN_COACH_PERMISSIONS_QUERY_KEY], (current) => {
        if (!current) return current;
        return {
          ...current,
          members: current.members.map((member) => member.id === data.member.id ? data.member : member),
        };
      });
      toast({ title: "Brain Coach access updated" });
    },
    onError: (error) => {
      toast({
        title: "Could not update Brain Coach access",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      });
    },
    onSettled: () => setSavingPermissionId(null),
  });

  const toggleGlobal = (key: keyof typeof globalToggles) =>
    setGlobalToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  const togglePersonConsent = (personId: string, key: keyof PersonConsent) =>
    setPersonConsents((prev) => ({
      ...prev,
      [personId]: { ...prev[personId], [key]: !prev[personId][key] },
    }));

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

  const renderBrainCoachPermissions = () => {
    if (brainCoachPermissionsQuery.isLoading) {
      return (
        <div className="px-5 py-5 font-body text-[14px] font-semibold text-vyva-text-2">
          Loading Brain Coach caregiver access
        </div>
      );
    }

    if (brainCoachPermissionsQuery.isError) {
      return (
        <div className="px-5 py-5">
          <p className="font-body text-[15px] font-black text-vyva-text-1">Brain Coach access could not be loaded.</p>
          <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">
            Only the senior account can change caregiver Brain Coach permissions.
          </p>
        </div>
      );
    }

    const members = brainCoachPermissionsQuery.data?.members ?? [];
    if (members.length === 0) {
      return (
        <div className="px-5 py-5">
          <p className="font-body text-[15px] font-black text-vyva-text-1">No active caregivers yet.</p>
          <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">
            Invite a caregiver or family member before granting Brain Coach access.
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
                      <p className="font-body text-[16px] font-black leading-tight text-vyva-text-1">{permission.label}</p>
                      <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">{permission.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleBrainCoachPermissionToggle(member, permission.key)}
                      disabled={isBusy}
                      aria-pressed={isOn}
                      aria-label={`${isOn ? "Revoke" : "Grant"} ${permission.label} for ${memberDisplayName(member)}`}
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
                      {isSaving ? <span className="sr-only">Saving</span> : null}
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
          kicker="Your choice"
          description="Keep VYVA useful while staying in control of what is shared, who sees it, and when access can change."
          badges={[
            { label: "You decide", color: "purple" },
            { label: "Care team access", color: "blue" },
            { label: "GDPR protected", color: "green" },
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
                Brain Coach caregiver access
              </span>
              <p className="mt-1 font-body text-[13px] leading-snug text-vyva-text-2">
                Decide what each approved caregiver can see or control in Brain Coach.
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

          {PEOPLE.map((person) => {
            const consents = personConsents[person.id];
            const isOpen = expandedPerson === person.id;
            return (
              <div
                key={person.id}
                className="border-t border-vyva-border first:border-t-0"
                data-testid={`item-privacy-person-${person.id}`}
              >
                <button
                  data-testid={`button-privacy-expand-${person.id}`}
                  onClick={() => setExpandedPerson(isOpen ? null : person.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-vyva-warm/40"
                >
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl font-body text-[16px] font-black text-white shadow-[0_10px_22px_rgba(107,33,168,0.16)]"
                    style={{ background: "#6B21A8" }}
                    data-testid={`avatar-privacy-${person.id}`}
                  >
                    {person.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-[17px] font-black text-vyva-text-1">{person.name}</p>
                    <p className="font-body text-[14px] text-vyva-text-2">{t(person.role)}</p>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`text-vyva-text-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isOpen && (
                  <div
                    className="border-t border-vyva-border bg-vyva-cream/60"
                    data-testid={`section-privacy-detail-${person.id}`}
                  >
                    <ToggleRow
                      icon={Heart}
                      iconBg="#FDF2F8"
                      iconColor="#B0355A"
                      label={t("settings.privacy.healthLabel")}
                      sub={t("settings.privacy.healthSub")}
                      value={consents.health}
                      onToggle={() => togglePersonConsent(person.id, "health")}
                      testId={`toggle-privacy-${person.id}-health`}
                    />
                    <ToggleRow
                      icon={Shield}
                      iconBg="#FEF2F2"
                      iconColor="#B91C1C"
                      label={t("settings.privacy.locationLabel")}
                      sub={t("settings.privacy.locationSub")}
                      value={consents.location}
                      onToggle={() => togglePersonConsent(person.id, "location")}
                      testId={`toggle-privacy-${person.id}-location`}
                    />
                    <ToggleRow
                      icon={Share2}
                      iconBg="#F5F3FF"
                      iconColor="#6B21A8"
                      label={t("settings.privacy.conversationsLabel")}
                      sub={t("settings.privacy.conversationsSub")}
                      value={consents.conversations}
                      onToggle={() => togglePersonConsent(person.id, "conversations")}
                      testId={`toggle-privacy-${person.id}-conversations`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="font-body text-center text-[13px] font-semibold text-vyva-text-3">
          {t("settings.privacy.gdprFooter")}
        </p>
      </div>
    </div>
  );
};

export default PrivacySettings;
