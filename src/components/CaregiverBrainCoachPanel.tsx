import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Brain,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  PauseCircle,
  PlayCircle,
  Save,
  Target,
} from "lucide-react";
import { apiFetch } from "@/lib/queryClient";

type BrainCoachPermissions = {
  view_summary: boolean;
  manage_plan_preferences: boolean;
  manage_schedule: boolean;
  send_nudges: boolean;
  preview_plan: boolean;
};

type BrainCoachCaregiverSummary = {
  status: "no_history" | "active" | "lapsed";
  currentStreakDays: number;
  lastActivityAt: string | null;
  lapsedDays: number | null;
  todayPlan: {
    planId: string | null;
    planDate: string;
    status: string;
    completedItems: number;
    totalItems: number;
    completionPct: number;
    estimatedDurationMinutes: number;
    domains: string[];
  };
  adherence7d: {
    completedPlanDays: number;
    plannedDays: number;
    activeSessionDays: number;
    completionPct: number;
  };
  recentDomains: Array<{
    domain: string;
    completedSessions: number;
    totalSessions: number;
    lastPlayedAt: string | null;
  }>;
  recentActivities: Array<{
    id: string | null;
    activityType: string;
    domain: string;
    completed: boolean;
    score: number;
    durationSeconds: number;
    playedAt: string;
  }>;
};

type BrainCoachSettings = {
  preferredDomains: string[];
  excludedActivityTypes: string[];
  preferredTrainingTimes: string[];
  weeklyTargetDays: number;
  sessionLengthMinutes: number;
  paused: boolean;
};

type BrainCoachPlanPreview = {
  persisted: false;
  plan: {
    estimatedDurationMinutes: number;
    recommendedDomains: string[];
    activities: Array<{
      activityType: string;
      title: string;
      domain: string;
      estimatedDurationMinutes: number;
      rationale: string;
    }>;
    rationale: string[];
  };
  permissions: BrainCoachPermissions;
};

type SummaryResponse = {
  summary: BrainCoachCaregiverSummary;
  permissions: BrainCoachPermissions;
};

type SettingsResponse = {
  settings: BrainCoachSettings;
  permissions: BrainCoachPermissions;
};

const DEFAULT_PERMISSIONS: BrainCoachPermissions = {
  view_summary: false,
  manage_plan_preferences: false,
  manage_schedule: false,
  send_nudges: false,
  preview_plan: false,
};

const DEFAULT_SETTINGS: BrainCoachSettings = {
  preferredDomains: [],
  excludedActivityTypes: [],
  preferredTrainingTimes: [],
  weeklyTargetDays: 3,
  sessionLengthMinutes: 7,
  paused: false,
};

const DOMAIN_OPTIONS = [
  { value: "attention", label: "Attention" },
  { value: "visual_memory", label: "Visual memory" },
  { value: "episodic_memory", label: "Word recall" },
  { value: "executive_function", label: "Planning" },
  { value: "processing_speed", label: "Speed" },
  { value: "spatial_navigation", label: "Navigation" },
  { value: "language", label: "Language" },
  { value: "associative_memory", label: "Names" },
];

const ACTIVITY_OPTIONS = [
  { value: "sequence_memory", label: "Rhythm Tap" },
  { value: "dual_task_walk", label: "Dual Task Walk" },
  { value: "memory_match", label: "Memory Match" },
  { value: "word_recall", label: "Word Recall" },
  { value: "story_recall", label: "Story Recall" },
  { value: "spatial_navigator", label: "Spatial Navigator" },
  { value: "category_sort", label: "Category Sort" },
  { value: "number_trails", label: "Number Trails" },
  { value: "face_name_match", label: "Face-Name Match" },
];

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTime(value?: string | null) {
  if (!value) return "No recent update";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function settingsEqual(left: BrainCoachSettings, right: BrainCoachSettings) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

function statusLabel(summary: BrainCoachCaregiverSummary | undefined) {
  if (!summary) return "Loading";
  if (summary.status === "lapsed") return `Lapsed ${summary.lapsedDays ?? 0} days`;
  if (summary.status === "no_history") return "No history yet";
  return "Active";
}

function planText(summary: BrainCoachCaregiverSummary | undefined) {
  if (!summary?.todayPlan.totalItems) return "No plan yet";
  return `${summary.todayPlan.completedItems}/${summary.todayPlan.totalItems} complete`;
}

export function CaregiverBrainCoachPanel() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<BrainCoachSettings>(DEFAULT_SETTINGS);

  const summaryQuery = useQuery<SummaryResponse>({
    queryKey: ["/api/caregiver/brain-coach/me/summary"],
    queryFn: async () => {
      const response = await apiFetch("/api/caregiver/brain-coach/me/summary");
      if (!response.ok) throw new Error("Could not load Brain Coach summary");
      return response.json();
    },
    retry: false,
  });

  const settingsQuery = useQuery<SettingsResponse>({
    queryKey: ["/api/caregiver/brain-coach/me/settings"],
    queryFn: async () => {
      const response = await apiFetch("/api/caregiver/brain-coach/me/settings");
      if (!response.ok) throw new Error("Could not load Brain Coach settings");
      return response.json();
    },
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: async (nextSettings: BrainCoachSettings) => {
      const response = await apiFetch("/api/caregiver/brain-coach/me/settings", {
        method: "PATCH",
        body: JSON.stringify(nextSettings),
      });
      if (!response.ok) throw new Error("Could not save Brain Coach settings");
      return response.json() as Promise<SettingsResponse>;
    },
    onSuccess: (data) => {
      setDraft(data.settings);
      queryClient.setQueryData(["/api/caregiver/brain-coach/me/settings"], data);
      void queryClient.invalidateQueries({ queryKey: ["/api/caregiver/brain-coach/me/summary"] });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch("/api/caregiver/brain-coach/me/plan-preview", { method: "POST" });
      if (!response.ok) throw new Error("Could not preview Brain Coach plan");
      return response.json() as Promise<BrainCoachPlanPreview>;
    },
  });

  const savedSettings = settingsQuery.data?.settings ?? DEFAULT_SETTINGS;
  const permissions = settingsQuery.data?.permissions ?? summaryQuery.data?.permissions ?? DEFAULT_PERMISSIONS;
  const summary = summaryQuery.data?.summary;
  const canManage = permissions.manage_plan_preferences;
  const canPreview = permissions.preview_plan;
  const isDirty = !settingsEqual(draft, savedSettings);
  const preferredTime = draft.preferredTrainingTimes[0] ?? "";
  const controlDisabled = !canManage || settingsQuery.isLoading || saveMutation.isPending;

  useEffect(() => {
    if (settingsQuery.data?.settings) setDraft(settingsQuery.data.settings);
  }, [settingsQuery.data?.settings]);

  const preview = previewMutation.data?.plan;
  const selectedDomainLabels = useMemo(
    () => draft.preferredDomains.map((domain) => DOMAIN_OPTIONS.find((option) => option.value === domain)?.label ?? labelize(domain)),
    [draft.preferredDomains],
  );

  if (summaryQuery.isLoading) {
    return (
      <section className="rounded-[16px] border border-[#D8DED6] bg-white p-5">
        <div className="flex items-center gap-3 font-body text-[15px] font-bold text-[#5F6B63]">
          <Clock className="h-5 w-5 animate-pulse text-[#2F6F5E]" />
          Loading Brain Coach view
        </div>
      </section>
    );
  }

  if (summaryQuery.isError) {
    return (
      <section className="rounded-[16px] border border-[#FCA5A5] bg-[#FEF2F2] p-5 font-body text-[15px] font-bold text-[#B91C1C]">
        Brain Coach caregiver data could not be loaded.
      </section>
    );
  }

  return (
    <section className="rounded-[16px] border border-[#D8DED6] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-body text-[12px] font-bold uppercase tracking-[0.13em] text-[#5F6B63]">Brain Coach</p>
          <h2 className="mt-1 font-body text-[22px] font-bold text-[#26312B]">
            {canManage ? "Training plan controls" : "Read-only training view"}
          </h2>
        </div>
        <Brain className="h-6 w-6 text-[#2F6F5E]" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-[12px] bg-[#F8FAF8] p-3">
          <p className="font-body text-[12px] font-bold text-[#5F6B63]">Streak</p>
          <p className="mt-1 font-body text-[20px] font-bold text-[#26312B]">{summary?.currentStreakDays ?? 0} days</p>
        </div>
        <div className="rounded-[12px] bg-[#F8FAF8] p-3">
          <p className="font-body text-[12px] font-bold text-[#5F6B63]">Status</p>
          <p className="mt-1 font-body text-[18px] font-bold text-[#26312B]">{statusLabel(summary)}</p>
        </div>
        <div className="rounded-[12px] bg-[#F8FAF8] p-3">
          <p className="font-body text-[12px] font-bold text-[#5F6B63]">Today's plan</p>
          <p className="mt-1 font-body text-[18px] font-bold text-[#26312B]">{planText(summary)}</p>
        </div>
        <div className="rounded-[12px] bg-[#F8FAF8] p-3">
          <p className="font-body text-[12px] font-bold text-[#5F6B63]">7-day adherence</p>
          <p className="mt-1 font-body text-[18px] font-bold text-[#26312B]">{summary?.adherence7d.completionPct ?? 0}%</p>
        </div>
      </div>

      <div className="mt-4 rounded-[12px] bg-[#F8FAF8] p-3">
        <p className="mb-2 flex items-center gap-2 font-body text-[14px] font-bold text-[#26312B]">
          <Target className="h-4 w-4 text-[#2F6F5E]" />
          Recent domains
        </p>
        {summary?.recentDomains.length ? (
          <div className="flex flex-wrap gap-2">
            {summary.recentDomains.slice(0, 4).map((domain) => (
              <span key={domain.domain} className="rounded-full bg-white px-3 py-1 font-body text-[12px] font-bold text-[#26312B]">
                {labelize(domain.domain)} - {domain.completedSessions}
              </span>
            ))}
          </div>
        ) : (
          <p className="font-body text-[13px] font-semibold text-[#5F6B63]">No Brain Coach activity recorded yet.</p>
        )}
      </div>

      {summary?.recentActivities.length ? (
        <div className="mt-3 space-y-2">
          {summary.recentActivities.slice(0, 3).map((activity) => (
            <div key={activity.id ?? `${activity.activityType}-${activity.playedAt}`} className="flex items-center justify-between gap-3 rounded-[12px] border border-[#D8DED6] bg-white p-3">
              <div>
                <p className="font-body text-[14px] font-bold text-[#26312B]">{labelize(activity.activityType)}</p>
                <p className="font-body text-[12px] font-semibold text-[#5F6B63]">{labelize(activity.domain)}</p>
              </div>
              <span className="font-body text-[12px] font-bold text-[#5F6B63]">{formatTime(activity.playedAt)}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 rounded-[14px] border border-[#D8DED6] bg-[#FBFCFB] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-body text-[15px] font-bold text-[#26312B]">Plan preferences</p>
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-body text-[12px] font-bold ${canManage ? "bg-[#ECFDF5] text-[#047857]" : "bg-[#FFF7ED] text-[#9A3412]"}`}>
            {canManage ? <CheckCircle2 className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {canManage ? "Control enabled" : "Needs senior consent"}
          </span>
        </div>

        <fieldset disabled={controlDisabled} className={`mt-4 space-y-4 ${controlDisabled ? "opacity-70" : ""}`}>
          <div>
            <p className="mb-2 font-body text-[13px] font-bold text-[#5F6B63]">Focus domains</p>
            <div className="flex flex-wrap gap-2">
              {DOMAIN_OPTIONS.map((option) => {
                const selected = draft.preferredDomains.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setDraft((current) => ({ ...current, preferredDomains: toggleValue(current.preferredDomains, option.value) }))}
                    className={`min-h-[38px] rounded-full border px-3 font-body text-[12px] font-bold ${
                      selected ? "border-[#2F6F5E] bg-[#E8F5F0] text-[#1F5A4A]" : "border-[#D8DED6] bg-white text-[#26312B]"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block font-body text-[13px] font-bold text-[#5F6B63]">Training time</span>
              <input
                type="time"
                value={preferredTime}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  preferredTrainingTimes: event.target.value ? [event.target.value] : [],
                }))}
                className="h-11 w-full rounded-[12px] border border-[#D8DED6] bg-white px-3 font-body text-[15px] font-bold text-[#26312B]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block font-body text-[13px] font-bold text-[#5F6B63]">Weekly goal</span>
              <select
                value={draft.weeklyTargetDays}
                onChange={(event) => setDraft((current) => ({ ...current, weeklyTargetDays: Number(event.target.value) }))}
                className="h-11 w-full rounded-[12px] border border-[#D8DED6] bg-white px-3 font-body text-[15px] font-bold text-[#26312B]"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <option key={day} value={day}>{day} days</option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="mb-2 font-body text-[13px] font-bold text-[#5F6B63]">Session length</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDraft((current) => ({ ...current, sessionLengthMinutes: Math.max(5, current.sessionLengthMinutes - 1) }))}
                className="h-10 w-10 rounded-full border border-[#D8DED6] bg-white font-body text-[18px] font-bold text-[#26312B]"
                aria-label="Decrease session length"
              >
                -
              </button>
              <span className="min-w-[88px] rounded-[12px] bg-white px-3 py-2 text-center font-body text-[15px] font-bold text-[#26312B]">
                {draft.sessionLengthMinutes} min
              </span>
              <button
                type="button"
                onClick={() => setDraft((current) => ({ ...current, sessionLengthMinutes: Math.min(10, current.sessionLengthMinutes + 1) }))}
                className="h-10 w-10 rounded-full border border-[#D8DED6] bg-white font-body text-[18px] font-bold text-[#26312B]"
                aria-label="Increase session length"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 font-body text-[13px] font-bold text-[#5F6B63]">Excluded activities</p>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_OPTIONS.map((option) => {
                const selected = draft.excludedActivityTypes.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setDraft((current) => ({ ...current, excludedActivityTypes: toggleValue(current.excludedActivityTypes, option.value) }))}
                    className={`min-h-[38px] rounded-full border px-3 font-body text-[12px] font-bold ${
                      selected ? "border-[#B45309] bg-[#FFF7ED] text-[#9A3412]" : "border-[#D8DED6] bg-white text-[#26312B]"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            aria-pressed={draft.paused}
            onClick={() => setDraft((current) => ({ ...current, paused: !current.paused }))}
            className={`inline-flex min-h-[42px] items-center gap-2 rounded-full px-3 font-body text-[13px] font-bold ${
              draft.paused ? "bg-[#FFF7ED] text-[#9A3412]" : "bg-[#ECFDF5] text-[#047857]"
            }`}
          >
            {draft.paused ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
            {draft.paused ? "Brain Coach paused" : "Brain Coach active"}
          </button>
        </fieldset>

        {!canManage && (
          <p className="mt-3 rounded-[12px] bg-[#FFF7ED] p-3 font-body text-[13px] font-bold leading-relaxed text-[#9A3412]">
            Needs senior consent before caregiver edits are available.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canManage || !isDirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate(draft)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#2F6F5E] px-4 font-body text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:bg-[#A8B6AF]"
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Saving" : "Save preferences"}
          </button>
          {saveMutation.isSuccess && !isDirty && (
            <span className="font-body text-[13px] font-bold text-[#047857]">Saved</span>
          )}
          {saveMutation.isError && (
            <span className="font-body text-[13px] font-bold text-[#B91C1C]">Could not save settings</span>
          )}
        </div>

        {selectedDomainLabels.length > 0 && (
          <p className="mt-3 font-body text-[12px] font-semibold leading-relaxed text-[#5F6B63]">
            Focus: {selectedDomainLabels.join(", ")}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-[14px] border border-[#D8DED6] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-body text-[15px] font-bold text-[#26312B]">Plan preview</p>
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-body text-[12px] font-bold ${canPreview ? "bg-[#EFF6FF] text-[#0369A1]" : "bg-[#FFF7ED] text-[#9A3412]"}`}>
            {canPreview ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {canPreview ? "Preview enabled" : "Needs senior consent"}
          </span>
        </div>
        <p className="mt-2 font-body text-[13px] font-semibold leading-relaxed text-[#5F6B63]">
          Shows tomorrow's deterministic plan without saving it.
        </p>
        <button
          type="button"
          disabled={!canPreview || previewMutation.isPending}
          onClick={() => previewMutation.mutate()}
          className="mt-3 inline-flex min-h-[42px] items-center gap-2 rounded-full border border-[#C9D6CF] bg-[#F8FAF8] px-3 font-body text-[13px] font-bold text-[#26312B] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Eye className="h-4 w-4" />
          {previewMutation.isPending ? "Building preview" : "Preview next plan"}
        </button>

        {!canPreview && (
          <p className="mt-3 rounded-[12px] bg-[#FFF7ED] p-3 font-body text-[13px] font-bold text-[#9A3412]">
            Needs senior consent before caregiver plan previews are available.
          </p>
        )}

        {previewMutation.isError && (
          <p className="mt-3 rounded-[12px] bg-[#FEF2F2] p-3 font-body text-[13px] font-bold text-[#B91C1C]">
            Plan preview could not be built.
          </p>
        )}

        {preview && (
          <div className="mt-3 space-y-2">
            <p className="font-body text-[13px] font-bold text-[#5F6B63]">{preview.estimatedDurationMinutes} minutes total</p>
            {preview.activities.length === 0 ? (
              <p className="rounded-[12px] bg-[#FFF7ED] p-3 font-body text-[13px] font-bold text-[#9A3412]">Planning is paused.</p>
            ) : (
              preview.activities.map((activity) => (
                <div key={activity.activityType} className="rounded-[12px] border border-[#D8DED6] bg-[#FBFCFB] p-3">
                  <p className="font-body text-[14px] font-bold text-[#26312B]">{activity.title}</p>
                  <p className="font-body text-[12px] font-semibold text-[#5F6B63]">{labelize(activity.domain)} - {activity.estimatedDurationMinutes} min</p>
                  <p className="mt-1 font-body text-[12px] font-semibold leading-relaxed text-[#5F6B63]">{activity.rationale}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}
