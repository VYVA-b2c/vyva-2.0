import { useState, type ChangeEvent, type ReactNode } from "react";
import {
  type AccountSubscription,
  type Communication,
  type CommunicationProviderStatus,
  type EntryPointMetric,
  type FunnelStage,
  type HomePlanCardAdmin,
  type Intake,
  type JourneyDropoff,
  type JsonRecord,
  type Organization,
  type PlanEntitlement,
  type ScheduledEvent,
  type ScheduledSupport,
  type SubscriptionPlanAdmin,
  type UserDetail,
  accountStatusLabel,
  callbackMetadata,
  callbackScheduledLabel,
  cleanLabel,
  combineDateTimeLocal,
  consentStatusLabel,
  contactNumberValue,
  emptyScheduledEvent,
  entryPointLabel,
  formatDate,
  isVisibleLifecycleUser,
  journeyStepLabel,
  keywordsToText,
  languageOptions,
  lifecycleStatusLabel,
  looksLikeContactEmail,
  stringValue,
  subscriptionStatusOptions,
  tierLabel,
  textToKeywords,
  toDateInputValue,
  toTimeInputValue,
  userTypeLabel,
} from "./shared";

export function Field({ label, required, optional, children }: { label: string; required?: boolean; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-sm font-bold text-[#4d4351]">
        <span>{label}{required ? " *" : ""}</span>
        {optional && <span className="font-normal text-purple-700">Optional</span>}
      </span>
      {children}
    </label>
  );
}

function cleanContact(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || null;
}

function looksLikeEmail(value?: string | null) {
  return looksLikeContactEmail(value);
}

function phoneContact(value?: string | null) {
  return contactNumberValue(value) || null;
}

function contactKey(value?: string | null) {
  const contact = cleanContact(value);
  if (!contact) return null;
  if (looksLikeEmail(contact)) return `email:${contact.toLowerCase()}`;
  const digits = contact.replace(/\D/g, "");
  if (digits.length >= 6) return `phone:${digits}`;
  return `text:${contact.toLowerCase()}`;
}

function lifecycleUserMobile(user: Intake) {
  return phoneContact(user.login_phone) ?? phoneContact(user.profile_phone) ?? phoneContact(user.phone);
}

function lifecycleIdentityRows(user: Intake) {
  const primaryKey = contactKey(user.name);
  const login = cleanContact(user.login_email) ?? phoneContact(user.login_phone);
  const profile = cleanContact(user.profile_email) ?? phoneContact(user.profile_phone);
  const profileName = !profile && contactKey(user.profile_name) !== primaryKey ? cleanContact(user.profile_name) : null;
  const loginKey = contactKey(login);
  const profileValue = profile ?? profileName;
  const profileKey = contactKey(profileValue);
  const rows: Array<{ label: string; value: string }> = [];

  if (login && loginKey && loginKey === profileKey && loginKey !== primaryKey) {
    rows.push({ label: looksLikeEmail(login) ? "Email" : "Contact", value: login });
    return rows;
  }

  if (login && loginKey !== primaryKey) rows.push({ label: "Login", value: login });
  if (profileValue && profileKey !== primaryKey && profileKey !== loginKey) {
    rows.push({ label: profile ? "Profile" : "Profile name", value: profileValue });
  }

  return rows;
}

function supportLabel(type: string) {
  if (type === "CHECK_IN") return "Check-in calls";
  if (type === "BRAIN_COACH") return "Brain Coach";
  if (type === "MEDICATION") return "Medication reminders";
  if (type === "SYMPTOM_FOLLOWUP") return "Symptom follow-up";
  if (type === "CONCIERGE_FOLLOWUP") return "Concierge follow-up";
  return type;
}

function supportFrequency(schedule: ScheduledSupport) {
  const times = schedule.times_of_day?.length ? schedule.times_of_day.join(", ") : "No time";
  if (schedule.frequency_type === "DAILY") return `Daily at ${times}`;
  if (schedule.frequency_type === "ONE_OFF") return `One-off at ${times}`;
  const days = schedule.days_of_week?.length ? schedule.days_of_week.join(", ") : "custom days";
  return `${days} at ${times}`;
}

type ActivityItem = {
  id: string;
  time: string;
  label: string;
  detail: string;
  source: string;
  actor?: string | null;
  tone?: "default" | "success" | "warning" | "danger";
};

function dateMs(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function jsonObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function activityActor(row: JsonRecord) {
  const metadata = jsonObject(row.metadata);
  return stringValue(row.created_by)
    ?? stringValue(row.updated_by)
    ?? stringValue(row.changed_by)
    ?? stringValue(row.changed_by_role)
    ?? stringValue(metadata.deleted_by)
    ?? stringValue(metadata.updated_by)
    ?? stringValue(metadata.created_by)
    ?? stringValue(row.channel)
    ?? null;
}

function activityTone(status?: string | null): ActivityItem["tone"] {
  const normalized = (status ?? "").toLowerCase();
  if (["active", "sent", "delivered", "approved", "confirmed", "completed", "enabled"].includes(normalized)) return "success";
  if (["failed", "rejected", "dropped", "cancelled", "disabled"].includes(normalized)) return "danger";
  if (["pending", "consent_pending", "queued", "paused", "no_answer"].includes(normalized)) return "warning";
  return "default";
}

function pushActivity(items: ActivityItem[], item: ActivityItem | null) {
  if (item?.time) items.push(item);
}

function lifecycleActivityCopy(eventType: string, row: JsonRecord) {
  const metadata = jsonObject(row.metadata);
  const fromStatus = stringValue(row.from_status);
  const toStatus = stringValue(row.to_status);
  const previousTier = stringValue(metadata.previous_subscription_tier);
  const nextTier = stringValue(metadata.subscription_tier);
  const previousStatus = stringValue(metadata.previous_subscription_status);
  const nextStatus = stringValue(metadata.subscription_status);

  if (eventType === "access_link_clicked") {
    return {
      label: "Link clicked",
      detail: `${cleanLabel(stringValue(metadata.link_type) ?? "access link")} opened${stringValue(metadata.destination) ? ` for ${stringValue(metadata.destination)}` : ""}`,
    };
  }
  if (eventType === "signup_invite_sent") {
    return { label: "Signup invite sent", detail: `${cleanLabel(stringValue(row.channel) ?? "Invite")} invite sent.` };
  }
  if (eventType === "signup_invite_clicked") {
    return {
      label: "Signup invite clicked",
      detail: stringValue(metadata.destination) ? `Opened and continued to ${stringValue(metadata.destination)}.` : "Recipient opened the invite link.",
    };
  }
  if (eventType === "signup_invite_profile_started") {
    return { label: "Signup started", detail: "Recipient started account creation from the invite." };
  }
  if (eventType === "signup_invite_profile_created") {
    return { label: "Account created", detail: "Recipient created a VYVA login from the invite." };
  }
  if (eventType === "signup_invite_profile_completed") {
    return { label: "Profile completed", detail: "Recipient saved their profile details from the invite flow." };
  }
  if (eventType === "admin_profile_updated") {
    const tierChanged = previousTier && nextTier && previousTier !== nextTier;
    return {
      label: tierChanged ? "Tier changed" : "Profile updated",
      detail: tierChanged
        ? `${tierLabel(previousTier)} to ${tierLabel(nextTier)}${nextStatus ? ` (${lifecycleStatusLabel(nextStatus)})` : ""}`
        : "Profile, contact, or organization details were updated.",
    };
  }
  if (eventType === "admin_subscription_updated") {
    return {
      label: "Tier changed",
      detail: `${previousTier ? `${tierLabel(previousTier)} to ` : ""}${tierLabel(nextTier ?? "Updated")}${nextStatus ? ` (${lifecycleStatusLabel(nextStatus)})` : ""}`,
    };
  }
  if (eventType === "user_disabled") return { label: "App access disabled", detail: stringValue(metadata.reason) || "Admin disabled app access." };
  if (eventType === "user_enabled") return { label: "App access enabled", detail: "Admin restored app access." };
  if (eventType === "user_deleted") return { label: "User removed from Users", detail: "Admin hid this user from the lifecycle Users table." };
  if (eventType === "user_restored") return { label: "User restored to Users", detail: "Admin made this user visible in the lifecycle Users table again." };
  if (eventType.includes("consent")) return { label: cleanLabel(eventType), detail: toStatus ? consentStatusLabel(toStatus) : "Consent event recorded." };

  return {
    label: cleanLabel(eventType),
    detail: toStatus ? `${fromStatus ? `${lifecycleStatusLabel(fromStatus)} to ` : ""}${lifecycleStatusLabel(toStatus)}` : stringValue(metadata.summary) ?? stringValue(row.channel) ?? "Lifecycle update",
  };
}

function buildActivityTimeline(detail: UserDetail): ActivityItem[] {
  const items: ActivityItem[] = [];
  const intake = detail.intake;

  pushActivity(items, {
    id: `intake-created-${intake.id}`,
    time: intake.created_at,
    label: "User intake created",
    detail: `${entryPointLabel(intake.entry_point)} - ${userTypeLabel(intake.user_type)}`,
    source: "Lifecycle",
    actor: "system",
  });
  pushActivity(items, intake.link_sent_at ? {
    id: `link-sent-${intake.id}`,
    time: intake.link_sent_at,
    label: "Invite link sent",
    detail: "The user was sent an onboarding or access link.",
    source: "Invite",
    actor: "system",
    tone: "success",
  } : null);
  pushActivity(items, intake.activated_at ? {
    id: `activated-${intake.id}`,
    time: intake.activated_at,
    label: "User became active",
    detail: "The user completed enough setup to become active.",
    source: "Lifecycle",
    actor: "system",
    tone: "success",
  } : null);
  pushActivity(items, intake.dropped_at ? {
    id: `dropped-${intake.id}`,
    time: intake.dropped_at,
    label: intake.journey_step === "admin_deleted" ? "User removed by admin" : "User dropped",
    detail: cleanLabel(intake.journey_step || intake.status),
    source: "Lifecycle",
    actor: stringValue(intake.metadata?.deleted_by) ?? "admin",
    tone: "danger",
  } : null);

  const profileCreatedAt = stringValue(detail.profile?.created_at);
  pushActivity(items, profileCreatedAt ? {
    id: `profile-created-${detail.profile?.id ?? intake.id}`,
    time: profileCreatedAt,
    label: "Profile created",
    detail: "The user now has an app profile.",
    source: "Profile",
    actor: stringValue(detail.profile?.created_by) ?? "system",
    tone: "success",
  } : null);

  for (const link of detail.access_links ?? []) {
    pushActivity(items, {
      id: `access-link-created-${link.id}`,
      time: link.created_at,
      label: "Invite created",
      detail: `${cleanLabel(link.link_type)} link for ${userTypeLabel(link.target_role)} - ${tierLabel(link.tier)} tier`,
      source: "Invite",
      actor: "system",
      tone: link.revoked_at ? "danger" : "default",
    });
    pushActivity(items, link.clicked_at ? {
      id: `access-link-clicked-${link.id}`,
      time: link.clicked_at,
      label: "Link clicked",
      detail: `${cleanLabel(link.link_type)} link opened${link.destination ? ` for ${link.destination}` : ""}`,
      source: "Invite",
      actor: "user",
      tone: "success",
    } : null);
    pushActivity(items, link.converted_at ? {
      id: `access-link-converted-${link.id}`,
      time: link.converted_at,
      label: "Link converted",
      detail: `Used ${link.use_count || 1} time${(link.use_count || 1) === 1 ? "" : "s"}.`,
      source: "Invite",
      actor: "user",
      tone: "success",
    } : null);
  }

  for (const row of detail.lifecycle_events ?? []) {
    const metadata = jsonObject(row.metadata);
    const eventType = stringValue(row.event_type) ?? "lifecycle_event";
    const toStatus = stringValue(row.to_status);
    const copy = lifecycleActivityCopy(eventType, row);
    pushActivity(items, {
      id: `lifecycle-${stringValue(row.id) ?? `${eventType}-${row.created_at}`}`,
      time: stringValue(row.created_at) ?? "",
      label: copy.label,
      detail: copy.detail,
      source: "Lifecycle",
      actor: activityActor(row),
      tone: activityTone(toStatus ?? eventType),
    });
  }

  for (const row of detail.communications ?? []) {
    const metadata = jsonObject(row.metadata);
    pushActivity(items, {
      id: `communication-${row.id}`,
      time: row.created_at,
      label: `${cleanLabel(row.purpose)} ${lifecycleStatusLabel(row.status)}`,
      detail: `${cleanLabel(row.channel)} to ${row.recipient}${stringValue(metadata.dispatch_error) ? ` - ${stringValue(metadata.dispatch_error)}` : ""}`,
      source: "Communication",
      actor: row.channel,
      tone: activityTone(row.status),
    });
  }

  for (const row of detail.consent_attempts ?? []) {
    pushActivity(items, {
      id: `consent-${row.id}`,
      time: row.created_at,
      label: `Consent ${consentStatusLabel(row.status)}`,
      detail: `Attempt ${row.attempt_number} by ${cleanLabel(row.channel)}`,
      source: "Consent",
      actor: row.channel,
      tone: activityTone(row.status),
    });
  }

  for (const event of detail.scheduled_events ?? []) {
    pushActivity(items, {
      id: `scheduled-event-${event.id}`,
      time: event.updated_at ?? event.created_at ?? event.scheduled_for ?? "",
      label: event.title || cleanLabel(event.event_type),
      detail: `${lifecycleStatusLabel(event.status)} - ${event.display_time ?? formatDate(event.scheduled_for)}`,
      source: "Schedule",
      actor: event.updated_by ?? event.created_by ?? event.source,
      tone: activityTone(event.status),
    });
  }

  for (const schedule of detail.scheduled_support ?? []) {
    pushActivity(items, {
      id: `support-${schedule.id}`,
      time: schedule.updated_at ?? schedule.next_run_at ?? "",
      label: supportLabel(schedule.interaction_type),
      detail: `${lifecycleStatusLabel(schedule.status)} - ${supportFrequency(schedule)}`,
      source: "Recurring support",
      actor: schedule.updated_by ?? schedule.created_by ?? "user",
      tone: activityTone(schedule.status),
    });
  }

  for (const row of detail.interaction_logs ?? []) {
    const status = stringValue(row.status) ?? stringValue(row.result);
    pushActivity(items, {
      id: `interaction-${stringValue(row.id) ?? `${status}-${row.created_at}`}`,
      time: stringValue(row.created_at) ?? stringValue(row.updated_at) ?? "",
      label: cleanLabel(stringValue(row.interaction_type) ?? stringValue(row.event_type) ?? "Support activity"),
      detail: cleanLabel(status ?? "Recorded"),
      source: "Support",
      actor: activityActor(row),
      tone: activityTone(status),
    });
  }

  for (const row of detail.consent_audit_logs ?? []) {
    const status = stringValue(row.new_value) ?? stringValue(row.action) ?? stringValue(row.status);
    pushActivity(items, {
      id: `audit-${stringValue(row.id) ?? `${status}-${row.created_at}`}`,
      time: stringValue(row.created_at) ?? stringValue(row.updated_at) ?? "",
      label: cleanLabel(stringValue(row.action) ?? stringValue(row.changed_by_role) ?? "Schedule permission changed"),
      detail: status ? cleanLabel(status) : "Audit record",
      source: "Audit",
      actor: activityActor(row),
      tone: activityTone(status),
    });
  }

  return items
    .filter((item) => dateMs(item.time) > 0)
    .sort((a, b) => dateMs(b.time) - dateMs(a.time))
    .slice(0, 50);
}

function latestTimestamp(values: Array<string | null | undefined>) {
  return values.filter(Boolean).sort((a, b) => dateMs(b) - dateMs(a))[0] ?? null;
}

function latestLifecycleEvent(detail: UserDetail, eventTypes: string[]) {
  return (detail.lifecycle_events ?? [])
    .filter((row) => eventTypes.includes(stringValue(row.event_type) ?? ""))
    .sort((a, b) => dateMs(stringValue(b.created_at)) - dateMs(stringValue(a.created_at)))[0] ?? null;
}

function latestTierEvent(detail: UserDetail) {
  return (detail.lifecycle_events ?? [])
    .filter((row) => {
      const eventType = stringValue(row.event_type);
      const metadata = jsonObject(row.metadata);
      return ["admin_profile_updated", "admin_subscription_updated"].includes(eventType ?? "")
        && Boolean(stringValue(metadata.subscription_tier));
    })
    .sort((a, b) => dateMs(stringValue(b.created_at)) - dateMs(stringValue(a.created_at)))[0] ?? null;
}

function AuditMilestones({ detail }: { detail: UserDetail }) {
  const inviteAt = latestTimestamp([
    detail.intake.link_sent_at,
    ...(detail.access_links ?? []).map((link) => link.created_at),
    ...(detail.communications ?? []).filter((row) => row.purpose?.includes("invite") || row.purpose?.includes("link")).map((row) => row.created_at),
  ]);
  const clickedAt = latestTimestamp([
    ...(detail.access_links ?? []).map((link) => link.clicked_at),
    stringValue(latestLifecycleEvent(detail, ["access_link_clicked"])?.created_at),
    stringValue(latestLifecycleEvent(detail, ["signup_invite_clicked"])?.created_at),
  ]);
  const profileCreatedAt = latestTimestamp([
    stringValue(detail.profile?.created_at),
    stringValue(latestLifecycleEvent(detail, ["signup_invite_profile_created"])?.created_at),
  ]);
  const tierEvent = latestTierEvent(detail);
  const tierMetadata = jsonObject(tierEvent?.metadata);
  const accessOrRemovalEvent = latestLifecycleEvent(detail, ["user_disabled", "user_enabled", "user_deleted", "user_restored"]);
  const accessOrRemovalType = stringValue(accessOrRemovalEvent?.event_type);
  const accessOrRemovalCopy = accessOrRemovalEvent
    ? lifecycleActivityCopy(accessOrRemovalType ?? "lifecycle_event", accessOrRemovalEvent)
    : null;
  const latestConsent = [...(detail.consent_attempts ?? [])].sort((a, b) => dateMs(b.created_at) - dateMs(a.created_at))[0] ?? null;
  const currentTier = stringValue(detail.profile?.subscription_tier) ?? detail.intake.tier;

  const milestones = [
    {
      label: "Invited",
      done: Boolean(inviteAt),
      detail: inviteAt ? formatDate(inviteAt) : "No invite or access link yet.",
      tone: inviteAt ? "success" : "default",
    },
    {
      label: "Link clicked",
      done: Boolean(clickedAt),
      detail: clickedAt ? formatDate(clickedAt) : "No click recorded yet.",
      tone: clickedAt ? "success" : "default",
    },
    {
      label: "Profile created",
      done: Boolean(profileCreatedAt),
      detail: profileCreatedAt ? formatDate(profileCreatedAt) : "No app profile linked yet.",
      tone: profileCreatedAt ? "success" : "default",
    },
    {
      label: "Tier",
      done: Boolean(tierEvent),
      detail: tierEvent
        ? `${stringValue(tierMetadata.previous_subscription_tier) ? `${tierLabel(stringValue(tierMetadata.previous_subscription_tier))} to ` : ""}${tierLabel(stringValue(tierMetadata.subscription_tier) ?? currentTier)}`
        : tierLabel(currentTier),
      tone: "default",
    },
    {
      label: "Access / removal",
      done: Boolean(accessOrRemovalEvent),
      detail: accessOrRemovalEvent ? `${accessOrRemovalCopy?.label ?? "Lifecycle update"} at ${formatDate(stringValue(accessOrRemovalEvent.created_at))}` : "No app-access disable or user removal event.",
      tone: accessOrRemovalEvent && ["user_disabled", "user_deleted"].includes(accessOrRemovalType ?? "") ? "danger" : "success",
    },
    {
      label: "Consent",
      done: Boolean(latestConsent),
      detail: latestConsent ? `${consentStatusLabel(latestConsent.status)} - attempt ${latestConsent.attempt_number}` : consentStatusLabel(detail.intake.consent_status || "not_required"),
      tone: latestConsent ? activityTone(latestConsent.status) : detail.intake.consent_status === "not_required" ? "success" : "default",
    },
  ] as const;
  const toneClass = {
    default: "bg-[#f4eafe] text-purple-700",
    success: "bg-emerald-50 text-emerald-800",
    warning: "bg-amber-50 text-amber-800",
    danger: "bg-red-50 text-red-700",
  };

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {milestones.map((item) => (
        <div key={item.label} className="rounded-3xl border border-[#eadfd5] bg-white p-4">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.08em] ${toneClass[item.tone ?? "default"]}`}>
            {item.done ? "Recorded" : "Pending"}
          </span>
          <h3 className="mt-3 font-black">{item.label}</h3>
          <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

function ActivityTimeline({ detail }: { detail: UserDetail }) {
  const items = buildActivityTimeline(detail);
  const toneClass = {
    default: "bg-[#f4eafe] text-purple-700",
    success: "bg-emerald-50 text-emerald-800",
    warning: "bg-amber-50 text-amber-800",
    danger: "bg-red-50 text-red-700",
  };

  return (
    <div className="rounded-3xl border border-[#eadfd5] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black">Activity timeline</h3>
          <p className="mt-1 text-sm text-[#7d6b65]">A chronological view of onboarding, access, consent, schedule, and communication changes.</p>
        </div>
        <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-black text-purple-700">{items.length} records</span>
      </div>
      <div className="mt-4 grid gap-3">
        {items.length === 0 ? (
          <p className="rounded-2xl bg-[#fbf8f5] p-4 text-[#7d6b65]">No activity has been recorded for this user yet.</p>
        ) : items.map((item) => (
          <div key={item.id} className="grid gap-3 rounded-2xl bg-[#fbf8f5] p-3 sm:grid-cols-[8.5rem_1fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[#7d6b65]">{formatDate(item.time)}</p>
              <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-black ${toneClass[item.tone ?? "default"]}`}>
                {item.source}
              </span>
            </div>
            <div>
              <p className="font-black">{item.label}</p>
              <p className="mt-1 text-sm text-[#5f514b]">{item.detail}</p>
              {item.actor && <p className="mt-1 text-xs font-bold text-[#8a7770]">By {item.actor}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function callbackStatusLabel(user: Intake) {
  const callback = callbackMetadata(user);
  if (!callback) return null;
  const status = stringValue(callback.status) || user.journey_step || "Callback";
  const scheduled = callbackScheduledLabel(user);
  const label = journeyStepLabel(status);
  return scheduled ? `${label} for ${scheduled}` : label;
}

const supportDayOptions = [
  { value: "MON", label: "Mon" },
  { value: "TUE", label: "Tue" },
  { value: "WED", label: "Wed" },
  { value: "THU", label: "Thu" },
  { value: "FRI", label: "Fri" },
  { value: "SAT", label: "Sat" },
  { value: "SUN", label: "Sun" },
];

type SupportScheduleDraft = {
  frequency_type: string;
  days_of_week: string[];
  times_of_day: string[];
  timezone: string;
  preferred_language: string;
  quiet_hours_start: string;
  quiet_hours_end: string;
};

function supportDraftFromSchedule(schedule: ScheduledSupport): SupportScheduleDraft {
  return {
    frequency_type: schedule.frequency_type || "DAILY",
    days_of_week: schedule.days_of_week ?? [],
    times_of_day: schedule.times_of_day?.length ? schedule.times_of_day : ["09:00"],
    timezone: schedule.timezone || "Europe/Madrid",
    preferred_language: schedule.preferred_language || "es",
    quiet_hours_start: schedule.quiet_hours_start || "21:00",
    quiet_hours_end: schedule.quiet_hours_end || "08:00",
  };
}

function removedUserDetails(user: Intake) {
  const metadata = jsonObject(user.metadata);
  const removedBy = stringValue(metadata.deleted_by);
  const removedAt = stringValue(metadata.deleted_at) ?? user.dropped_at;
  const reason = stringValue(metadata.deleted_reason) ?? stringValue(metadata.reason);
  return { removedBy, removedAt, reason };
}

export function IntakeTable({ users, emptyMessage = "No users match the current filters yet.", onView, onTriggerConsent, onToggleEnabled, onDelete, onRestore, busyAction = null, compact = false, selectedIds = [], canSelectUser = isVisibleLifecycleUser, onSelectionChange, onSelectAllVisible }: {
  users: Intake[];
  emptyMessage?: string;
  onView: (intake: Intake) => void;
  onTriggerConsent: (intake: Intake) => void;
  onToggleEnabled: (intake: Intake) => void;
  onDelete?: (intake: Intake) => void;
  onRestore?: (intake: Intake) => void;
  busyAction?: string | null;
  compact?: boolean;
  selectedIds?: string[];
  canSelectUser?: (intake: Intake) => boolean;
  onSelectionChange?: (intakeId: string, selected: boolean) => void;
  onSelectAllVisible?: (selected: boolean) => void;
}) {
  const isBusy = (action: string, user: Intake) => busyAction === `${action}:${user.id}`;
  const selectable = Boolean(onSelectionChange && onSelectAllVisible);
  const selectedSet = new Set(selectedIds);
  const selectableUsers = users.filter(canSelectUser);
  const allVisibleSelected = selectableUsers.length > 0 && selectableUsers.every((user) => selectedSet.has(user.id));
  const visibleSelectionCount = selectableUsers.filter((user) => selectedSet.has(user.id)).length;
  const columnCount = (compact ? 9 : 10) + (selectable ? 1 : 0);
  return (
    <div className="mt-5 overflow-auto">
      <table className="w-full min-w-[980px] border-separate border-spacing-y-2">
        <thead><tr className="text-left text-sm uppercase tracking-wide text-[#8b7a73]">
          {selectable && (
            <th className="w-10">
              <input
                type="checkbox"
                aria-label="Select all visible users"
                checked={allVisibleSelected}
                disabled={selectableUsers.length === 0}
                onChange={(event) => onSelectAllVisible?.(event.target.checked)}
              />
              {visibleSelectionCount > 0 && !allVisibleSelected && <span className="sr-only">{visibleSelectionCount} visible users selected</span>}
            </th>
          )}
          <th>Name</th>{!compact && <th>Contact number</th>}<th>Type</th><th>Entry</th><th>Tier</th><th>Status</th><th>Account</th><th>Consent</th><th>Org</th><th>Action</th>
        </tr></thead>
        <tbody>
          {users.length === 0 && (
            <tr>
              <td colSpan={columnCount} className="rounded-2xl bg-[#fbf8f5] px-4 py-6 text-center font-bold text-[#7d6b65]">
                {emptyMessage}
              </td>
            </tr>
          )}
          {users.map((user) => {
            const removed = !isVisibleLifecycleUser(user);
            const removedDetails = removed ? removedUserDetails(user) : null;
            const identityRows = lifecycleIdentityRows(user);
            return (
            <tr key={user.id} className={`rounded-2xl ${removed ? "bg-amber-50" : "bg-[#fbf8f5]"}`}>
              {selectable && (
                <td className="rounded-l-2xl px-3 py-3 align-middle">
                  <input
                    type="checkbox"
                    aria-label={`Select ${user.name}`}
                    disabled={!canSelectUser(user)}
                    checked={selectedSet.has(user.id)}
                    onChange={(event) => onSelectionChange?.(user.id, event.target.checked)}
                  />
                </td>
              )}
              <td className={`${selectable ? "" : "rounded-l-2xl"} px-3 py-3`}>
                <p className="font-bold">{user.name}</p>
                {callbackMetadata(user) && (
                  <p className="mt-1 inline-flex rounded-full bg-[#f3e8ff] px-2.5 py-1 text-xs font-black text-purple-800">
                    Callback onboarding
                  </p>
                )}
                {removed && (
                  <p className="mt-1 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black uppercase text-amber-800">
                    Removed
                  </p>
                )}
                {removedDetails && (
                  <div className="mt-1 grid gap-0.5 text-xs font-semibold text-amber-900">
                    {removedDetails.removedAt && <span>Removed: {formatDate(removedDetails.removedAt)}</span>}
                    {removedDetails.removedBy && <span>By: {removedDetails.removedBy}</span>}
                    {removedDetails.reason && <span>Reason: {removedDetails.reason}</span>}
                  </div>
                )}
                {identityRows.length > 0 && (
                  <div className="mt-1 grid gap-0.5 text-xs font-semibold text-[#7d6b65]">
                    {identityRows.map((row) => <span key={`${row.label}:${row.value}`}>{row.label}: {row.value}</span>)}
                  </div>
                )}
              </td>
              {!compact && <td className="px-3 py-3">{lifecycleUserMobile(user) ?? "-"}</td>}
              <td className="px-3 py-3">{userTypeLabel(user.user_type)}</td>
              <td className="px-3 py-3">
                <span>{entryPointLabel(user.entry_point)}</span>
                {callbackMetadata(user) && <span className="mt-1 block text-xs font-bold text-purple-700">Scheduled callback</span>}
              </td>
              <td className="px-3 py-3">
                <span>{tierLabel(user.tier)}</span>
                {user.intake_tier && user.intake_tier !== user.tier && (
                  <span className="mt-1 block text-xs text-[#8b7a73]">Intake: {tierLabel(user.intake_tier)}</span>
                )}
              </td>
              <td className="px-3 py-3">
                <span>{lifecycleStatusLabel(user.status)}</span>
                <span className="mt-1 block text-xs font-bold text-[#7d6b65]">
                  {callbackStatusLabel(user) ?? journeyStepLabel(user.journey_step)}
                </span>
              </td>
              <td className="px-3 py-3">{accountStatusLabel(user.account_status)}</td>
              <td className="px-3 py-3">{consentStatusLabel(user.consent_status)}</td>
              <td className="px-3 py-3">{user.organization_name ?? "-"}</td>
              <td className="rounded-r-2xl px-3 py-3">
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="rounded-full bg-[#2f2135] px-3 py-2 text-sm font-bold text-white disabled:opacity-60" disabled={isBusy("view", user)} onClick={() => onView(user)}>{isBusy("view", user) ? "Opening..." : "View"}</button>
                  <span className="rounded-full bg-purple-50 px-3 py-2 text-sm font-black uppercase text-purple-700">Tier: {tierLabel(user.tier)}</span>
                  {removed ? (
                    <>
                      {onRestore && (
                        <button type="button" className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 disabled:opacity-60" disabled={isBusy("restore", user)} onClick={() => onRestore(user)}>
                          {isBusy("restore", user) ? "Restoring..." : "Restore to Users"}
                        </button>
                      )}
                      <span className="rounded-full border border-amber-200 bg-white px-3 py-2 text-sm font-bold text-amber-800">Audit only</span>
                    </>
                  ) : (
                    <>
                      <button type="button" className="rounded-full border px-3 py-2 text-sm font-bold disabled:opacity-60" disabled={isBusy("toggle", user)} onClick={() => onToggleEnabled(user)}>{isBusy("toggle", user) ? "Saving..." : user.account_status === "disabled" ? "Enable app access" : "Disable app access"}</button>
                      {user.user_type === "family" && <button type="button" className="rounded-full border px-3 py-2 text-sm font-bold disabled:opacity-60" disabled={isBusy("consent", user)} onClick={() => onTriggerConsent(user)}>{isBusy("consent", user) ? "Queueing..." : "Consent"}</button>}
                      {onDelete && <button type="button" className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800 disabled:opacity-60" disabled={isBusy("delete", user)} onClick={() => onDelete(user)}>{isBusy("delete", user) ? "Removing..." : "Remove from Users"}</button>}
                    </>
                  )}
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AccountSubscriptionsSection({
  accounts,
  message,
  planOptions,
  search,
  savingProfileId,
  repairingProfileId,
  onSearchChange,
  onSearch,
  onChange,
  onSave,
  onRepair,
}: {
  accounts: AccountSubscription[];
  message: string;
  planOptions: Array<{ value: string; label: string }>;
  search: string;
  savingProfileId: string | null;
  repairingProfileId: string | null;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  onChange: (profileId: string, patch: Partial<AccountSubscription>) => void;
  onSave: (account: AccountSubscription) => Promise<void>;
  onRepair: (account: AccountSubscription) => Promise<void>;
}) {
  return (
    <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl">App Access</h2>
          <p className="mt-2 max-w-3xl text-sm text-[#7d6b65]">
            Real login, active profile, plan, and entitlement controls.
          </p>
        </div>
        <span className="rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
          {accounts.length} result{accounts.length === 1 ? "" : "s"}
        </span>
      </div>

      <form
        className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <input
          className="rounded-2xl border border-[#e4d8ce] px-4 py-3"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search 040270@gmail.com, name or phone"
        />
        <button className="rounded-2xl bg-[#2f2135] px-5 py-3 font-bold text-white" type="submit">
          Search access
        </button>
      </form>

      {message && (
        <p className="mt-4 rounded-2xl bg-purple-50 px-4 py-3 text-sm font-bold text-purple-800">
          {message}
        </p>
      )}

      <div className="mt-5 grid gap-3">
        {accounts.map((account) => {
          const displayName = account.preferred_name || account.full_name || account.profile_email || account.profile_id;
          const saving = savingProfileId === account.profile_id;
          const repairing = repairingProfileId === account.profile_id;
          const canRepair = Boolean(account.subscription_mismatch && account.source !== "supabase_auth_missing_profile");
          return (
            <article key={`${account.account_id ?? "profile"}:${account.profile_id}`} className="rounded-3xl border border-[#eadfd5] bg-[#fbf8f5] p-4">
              <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-black">{displayName}</h3>
                    {account.is_active_profile && (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{account.account_source === "supabase" ? "Supabase app profile" : "Active profile"}</span>
                    )}
                    {account.account_source === "supabase" && (
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">Supabase login</span>
                    )}
                    {account.account_id && !account.is_active_profile && (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Not active for login</span>
                    )}
                    {account.account_status === "disabled" && (
                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">Disabled</span>
                    )}
                    {account.subscription_mismatch && (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Premium mismatch</span>
                    )}
                  </div>
                  <div className="mt-2 grid gap-1 text-sm text-[#7d6b65]">
                    <p><span className="font-bold text-[#4d4351]">Login:</span> {account.account_email || account.account_phone || "No linked login shown"}{account.account_source ? ` (${account.account_source})` : ""}</p>
                    <p><span className="font-bold text-[#4d4351]">Profile:</span> {account.profile_email || account.phone_number || account.profile_id}</p>
                    <p><span className="font-bold text-[#4d4351]">Profile ID:</span> <span className="font-mono text-xs">{account.profile_id}</span></p>
                    <p><span className="font-bold text-[#4d4351]">Effective app access:</span> {tierLabel(account.effective_subscription_tier ?? account.subscription_tier)}{account.effective_subscription_status ? ` (${lifecycleStatusLabel(account.effective_subscription_status)})` : ""}</p>
                    {account.subscription_status === "trial" && account.trial_ends_at && (
                      <p><span className="font-bold text-[#4d4351]">Trial ends:</span> {formatDate(account.trial_ends_at)}</p>
                    )}
                    {account.membership_role && <p><span className="font-bold text-[#4d4351]">Relationship:</span> {account.membership_role}{account.membership_relationship ? ` - ${account.membership_relationship}` : ""}</p>}
                    {account.account_id && !account.is_active_profile && (
                      <p className="font-bold text-amber-800">Saving this row will make it the active profile for this login.</p>
                    )}
                    {account.subscription_warning && (
                      <p className="rounded-xl bg-[#fff3e8] px-3 py-2 font-bold text-[#8a4a00]">{account.subscription_warning}</p>
                    )}
                    {account.latest_entitlement_repair_at && (
                      <p className="rounded-xl bg-emerald-50 px-3 py-2 font-bold text-emerald-800">
                        Last repair: {formatDate(account.latest_entitlement_repair_at)}{account.latest_entitlement_repair_summary ? ` - ${account.latest_entitlement_repair_summary}` : ""}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] xl:grid-cols-1">
                  <Field label="Plan">
                    <select
                      className="w-full rounded-2xl border px-4 py-3 bg-white"
                      value={account.subscription_tier}
                      onChange={(event) => onChange(account.profile_id, { subscription_tier: event.target.value })}
                    >
                      {planOptions.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select
                      className="w-full rounded-2xl border px-4 py-3 bg-white"
                      value={account.subscription_status}
                      onChange={(event) => onChange(account.profile_id, { subscription_status: event.target.value })}
                    >
                      {subscriptionStatusOptions.map((status) => <option key={status} value={status}>{lifecycleStatusLabel(status)}</option>)}
                    </select>
                  </Field>
                  <button
                    className="rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={saving}
                    onClick={() => onSave(account)}
                  >
                    {saving ? "Saving..." : "Save account plan"}
                  </button>
                  {canRepair && (
                    <button
                      className="rounded-2xl border border-amber-300 bg-[#fff8ee] px-5 py-3 font-bold text-amber-900 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={repairing}
                      onClick={() => onRepair(account)}
                    >
                      {repairing ? "Repairing..." : "Repair access now"}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        {accounts.length === 0 && !message && (
          <div className="rounded-3xl bg-[#fbf8f5] p-6 text-center text-[#7d6b65]">
            Search for a user account to update its real app subscription.
          </div>
        )}
      </div>
    </section>
  );
}

export function UserDetailModal({ detail, draft, setDraft, organizations, planOptions, statusMessage, saving = false, deleting = false, restoring = false, scheduleBusyAction = null, onClose, onSave, onToggle, onDelete, onRestore, newEvent, setNewEvent, onCreateEvent, onEventStatus, onEventTime, onSupportSave, onSupportStatus }: {
  detail: UserDetail;
  draft: JsonRecord;
  setDraft: (next: JsonRecord) => void;
  organizations: Organization[];
  planOptions: Array<{ value: string; label: string }>;
  statusMessage?: string;
  saving?: boolean;
  scheduleBusyAction?: string | null;
  deleting?: boolean;
  restoring?: boolean;
  onClose: () => void;
  onSave: () => void;
  onToggle: (enable: boolean) => void;
  onDelete: () => void;
  onRestore?: () => void;
  newEvent: typeof emptyScheduledEvent;
  setNewEvent: (next: typeof emptyScheduledEvent) => void;
  onCreateEvent: () => void;
  onEventStatus: (event: ScheduledEvent, action: "pause" | "resume" | "cancel") => void;
  onEventTime: (event: ScheduledEvent, scheduledFor: string) => void;
  onSupportSave: (schedule: ScheduledSupport, draft: SupportScheduleDraft) => void;
  onSupportStatus: (schedule: ScheduledSupport, action: "pause" | "resume") => void;
}) {
  const removed = !isVisibleLifecycleUser(detail.intake);
  const primaryMapping = detail.account_mappings?.[0];
  const activeProfileDisabled = primaryMapping?.effective_account_status === "disabled";
  const disabled = detail.profile?.account_status === "disabled" || detail.intake.account_status === "disabled" || activeProfileDisabled;
  const selectedTier = String(draft.tier ?? "free").toLowerCase();
  const appTier = primaryMapping?.effective_subscription_tier?.toLowerCase() ?? null;
  const hasTierMismatch = Boolean(appTier && selectedTier && appTier !== selectedTier);
  const hasSubscriptionMismatch = Boolean(primaryMapping?.subscription_mismatch);
  const accessMismatch = hasTierMismatch || hasSubscriptionMismatch || activeProfileDisabled;
  const appAccessText = primaryMapping
    ? `${tierLabel(primaryMapping.effective_subscription_tier ?? "Unknown")}${primaryMapping.effective_subscription_status ? ` (${lifecycleStatusLabel(primaryMapping.effective_subscription_status)})` : ""}${activeProfileDisabled ? " - Disabled" : ""}`
    : "No login match";
  const newEventDate = newEvent.scheduled_date || toDateInputValue(newEvent.scheduled_for);
  const newEventTime = newEvent.scheduled_time || toTimeInputValue(newEvent.scheduled_for);
  const [activeDetailTab, setActiveDetailTab] = useState<"profile" | "access" | "activity" | "communications" | "schedule">("profile");
  const [editingSupportId, setEditingSupportId] = useState<string | null>(null);
  const [supportDraft, setSupportDraft] = useState<SupportScheduleDraft | null>(null);
  const detailTabs = [
    { id: "profile" as const, label: "Profile" },
    { id: "access" as const, label: "Access" },
    { id: "activity" as const, label: "Activity" },
    { id: "communications" as const, label: "Communications" },
    { id: "schedule" as const, label: "Schedule" },
  ];
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#2f2135]/45" role="dialog" aria-modal="true" aria-labelledby="user-detail-drawer-title">
      <button type="button" className="absolute inset-0 hidden cursor-default sm:block" aria-label="Close user details" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-[820px] flex-col overflow-hidden bg-[#fffdfb] shadow-[0_24px_80px_rgba(47,33,53,0.32)] sm:rounded-l-[1.5rem]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#eadfd5] bg-white px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-700">User details</p>
            <h2 id="user-detail-drawer-title" className="mt-1 truncate font-serif text-2xl leading-tight sm:text-3xl">{detail.intake.name}</h2>
            <p className="mt-1 text-sm text-[#7d6b65]">{userTypeLabel(detail.intake.user_type)} - {lifecycleStatusLabel(detail.intake.status)} - {disabled ? "Disabled" : "Enabled"}</p>
          </div>
          <button type="button" className="rounded-xl border border-[#eadfd5] px-4 py-2 text-sm font-bold" onClick={onClose}>Close</button>
        </div>
        <div className="shrink-0 border-b border-[#eadfd5] bg-white px-4 py-2 sm:px-5">
          <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="User detail sections">
            {detailTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeDetailTab === tab.id}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-black ${activeDetailTab === tab.id ? "bg-purple-700 text-white" : "border border-[#eadfd5] bg-white text-purple-700 hover:bg-purple-50"}`}
                onClick={() => setActiveDetailTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="grid items-start gap-4">
          {activeDetailTab === "profile" && <section className="mx-auto w-full max-w-4xl rounded-2xl border border-[#eadfd5] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black">Profile</h3>
                <p className="mt-1 text-sm text-[#7d6b65]">Identity, contact, language, and caregiver details.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <Field label="Full name"><input className="w-full rounded-xl border px-3 py-2.5" value={draft.full_name ?? ""} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} /></Field>
              <Field label="Preferred name"><input className="w-full rounded-xl border px-3 py-2.5" value={draft.preferred_name ?? ""} onChange={(e) => setDraft({ ...draft, preferred_name: e.target.value })} /></Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Contact number"><input className="w-full rounded-xl border px-3 py-2.5" value={draft.phone_number ?? ""} onChange={(e) => setDraft({ ...draft, phone_number: e.target.value })} /></Field>
                <Field label="WhatsApp"><input className="w-full rounded-xl border px-3 py-2.5" value={draft.whatsapp_number ?? ""} onChange={(e) => setDraft({ ...draft, whatsapp_number: e.target.value })} /></Field>
              </div>
              <Field label="Email"><input className="w-full rounded-xl border px-3 py-2.5" value={draft.email ?? ""} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Caregiver name"><input className="w-full rounded-xl border px-3 py-2.5" value={draft.caregiver_name ?? ""} onChange={(e) => setDraft({ ...draft, caregiver_name: e.target.value })} /></Field>
                <Field label="Caregiver contact"><input className="w-full rounded-xl border px-3 py-2.5" value={draft.caregiver_contact ?? ""} onChange={(e) => setDraft({ ...draft, caregiver_contact: e.target.value })} /></Field>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Language"><select className="w-full rounded-xl border px-3 py-2.5" value={draft.language ?? "es"} onChange={(e) => setDraft({ ...draft, language: e.target.value })}>{languageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                <Field label="Timezone"><input className="w-full rounded-xl border px-3 py-2.5" value={draft.timezone ?? "Europe/Madrid"} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })} /></Field>
              </div>
              <div className="flex flex-wrap gap-2"><button type="button" className="rounded-xl bg-purple-700 px-5 py-2.5 font-bold text-white disabled:opacity-60" disabled={saving || deleting} onClick={onSave}>{saving ? "Saving..." : "Save profile"}</button></div>
              {statusMessage && (
                <p className={`rounded-xl px-3 py-2 text-sm font-bold ${statusMessage.toLowerCase().includes("could not") ? "bg-[#fff3e8] text-[#8a4a00]" : "bg-[#ecfdf3] text-[#087443]"}`}>
                  {statusMessage}
                </p>
              )}
            </div>
          </section>}

          {activeDetailTab === "access" && <section className="mx-auto w-full max-w-4xl rounded-2xl border border-[#eadfd5] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black">Access</h3>
                <p className="mt-1 text-sm text-[#7d6b65]">Tier, organization, login mapping, and app access controls.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.08em] ${accessMismatch ? "bg-[#fff3e8] text-[#8a4a00]" : primaryMapping ? "bg-[#ecfdf3] text-[#087443]" : "bg-[#f4eafe] text-purple-700"}`}>
                App access: {appAccessText}
              </span>
            </div>
            {primaryMapping && (
              <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-bold ${accessMismatch ? "bg-[#fff3e8] text-[#8a4a00]" : "bg-[#ecfdf3] text-[#087443]"}`}>
                {(primaryMapping.warnings ?? [])[0] ?? primaryMapping.subscription_warning ?? (hasTierMismatch ? "Save access to sync this user to the selected tier." : "Admin and app access are aligned.")}
              </p>
            )}
            {!primaryMapping && (
              <p className="mt-3 rounded-xl bg-[#f4eafe] px-3 py-2 text-sm font-bold text-purple-800">No login account matched yet. The tier will apply when the user signs in with this email or phone.</p>
            )}
            {primaryMapping?.latest_entitlement_repair_at && (
              <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                Last access repair: {formatDate(primaryMapping.latest_entitlement_repair_at)}{primaryMapping.latest_entitlement_repair_summary ? ` - ${primaryMapping.latest_entitlement_repair_summary}` : ""}
              </p>
            )}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="Admin tier"><select className="w-full rounded-xl border px-3 py-2.5" value={draft.tier ?? "free"} onChange={(e) => setDraft({ ...draft, tier: e.target.value })}>{planOptions.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}</select></Field>
              <Field label="Organization"><select className="w-full rounded-xl border px-3 py-2.5" value={draft.organization_id ?? ""} onChange={(e) => setDraft({ ...draft, organization_id: e.target.value })}><option value="">None</option>{organizations.filter((org) => org.is_active).map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></Field>
            </div>
            <div className="mt-4 grid gap-3">
              {(detail.account_mappings ?? []).length === 0 && (
                <div className="rounded-2xl bg-[#fbf8f5] p-4 text-sm font-semibold text-[#7d6b65]">No login account matched yet.</div>
              )}
              {(detail.account_mappings ?? []).map((mapping) => (
                <article key={`${mapping.source}-${mapping.login_uid}-${mapping.effective_profile_id}`} className="rounded-2xl border border-[#eadfd5] bg-[#fbf8f5] p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-black">{cleanLabel(mapping.source)} account</p>
                      <p className="mt-1 break-words text-[#7d6b65]">Login: {mapping.login_email || mapping.login_phone || mapping.login_uid}</p>
                      <p className="break-words text-[#7d6b65]">Profile: {mapping.effective_profile_email || mapping.effective_profile_phone || mapping.effective_profile_id || "No active profile"}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-purple-700">
                      {tierLabel(mapping.effective_subscription_tier ?? "unknown")}{mapping.effective_subscription_status ? ` - ${lifecycleStatusLabel(mapping.effective_subscription_status)}` : ""}
                    </span>
                  </div>
                  {(mapping.warnings ?? []).length > 0 && (
                    <div className="mt-3 grid gap-2">
                      {(mapping.warnings ?? []).map((warning) => (
                        <p key={warning} className="rounded-xl bg-[#fff3e8] px-3 py-2 font-bold text-[#8a4a00]">{warning}</p>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="rounded-xl bg-purple-700 px-5 py-2.5 font-bold text-white disabled:opacity-60" disabled={saving || deleting || restoring} onClick={onSave}>{saving ? "Saving..." : "Save access"}</button>
              {!removed && <button type="button" className="rounded-xl border px-5 py-2.5 font-bold disabled:opacity-60" disabled={deleting || restoring} onClick={() => onToggle(disabled)}>{disabled ? "Enable app access" : "Disable app access"}</button>}
              {removed ? (
                <button type="button" className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 font-bold text-emerald-800 disabled:opacity-60" disabled={restoring || !onRestore} onClick={onRestore}>{restoring ? "Restoring..." : "Restore to Users"}</button>
              ) : (
                <button type="button" className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-2.5 font-bold text-amber-800 disabled:opacity-60" disabled={deleting || restoring} onClick={onDelete}>{deleting ? "Removing..." : "Remove from Users"}</button>
              )}
            </div>
            {statusMessage && (
              <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-bold ${statusMessage.toLowerCase().includes("could not") ? "bg-[#fff3e8] text-[#8a4a00]" : "bg-[#ecfdf3] text-[#087443]"}`}>
                {statusMessage}
              </p>
            )}
          </section>}

          {activeDetailTab === "schedule" && <section className="mx-auto w-full max-w-4xl rounded-2xl border border-[#eadfd5] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black">Schedule</h3>
                <p className="mt-1 text-sm text-[#7d6b65]">One-off events and recurring support for this user.</p>
              </div>
              <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-black text-purple-700">
                {(detail.scheduled_events ?? []).filter((event) => !event.read_only).length} events - {detail.scheduled_support?.length ?? 0} support services
              </span>
            </div>
            {statusMessage && (
              <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-bold ${statusMessage.toLowerCase().includes("could not") || statusMessage.toLowerCase().includes("not allowed") ? "bg-[#fff3e8] text-[#8a4a00]" : "bg-[#ecfdf3] text-[#087443]"}`}>
                {statusMessage}
              </p>
            )}

            <div className="mt-4 rounded-2xl border border-[#eadfd5] bg-[#fbf8f5] p-3">
              <h4 className="font-black">Upcoming events</h4>
              <p className="mt-1 text-sm text-[#7d6b65]">Specific appointments, reminders, or VYVA sessions created for this user.</p>
              <div className="mt-3 grid gap-2">
                {detail.scheduled_events.filter((event) => !event.read_only).length === 0 && <p className="text-[#7d6b65]">No scheduled events yet.</p>}
                {detail.scheduled_events.filter((event) => !event.read_only).map((event) => (
                  <div key={event.id} className="rounded-2xl bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-bold">{event.title}</p>
                        <p className="text-sm text-[#7d6b65]">{cleanLabel(event.event_type)} - {lifecycleStatusLabel(event.status)} - {event.display_time ?? formatDate(event.scheduled_for)}</p>
                      </div>
                      <span className="rounded-full bg-[#f4eafe] px-2 py-1 text-xs font-black text-purple-700">
                        {event.source || "app"}
                      </span>
                    </div>
                    {event.description && <p className="mt-2 text-sm">{event.description}</p>}
                    <form
                      className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = new FormData(e.currentTarget);
                        const scheduledFor = combineDateTimeLocal(
                          form.get("scheduled_date")?.toString() ?? "",
                          form.get("scheduled_time")?.toString() ?? "",
                        );
                        onEventTime(event, scheduledFor);
                      }}
                    >
                      <Field label="Date">
                        <input
                          className="w-full rounded-xl border px-3 py-2"
                          name="scheduled_date"
                          type="date"
                          defaultValue={toDateInputValue(event.scheduled_for)}
                        />
                      </Field>
                      <Field label="Time">
                        <input
                          className="w-full rounded-xl border px-3 py-2"
                          name="scheduled_time"
                          type="time"
                          defaultValue={toTimeInputValue(event.scheduled_for)}
                        />
                      </Field>
                      <button className="self-end rounded-xl bg-purple-700 px-4 py-2 text-sm font-bold text-white" type="submit">
                        Save time
                      </button>
                    </form>
                    <div className="mt-2 flex gap-2">
                      <button type="button" className="rounded-full border px-3 py-1 text-sm font-bold" onClick={() => onEventStatus(event, event.status === "paused" ? "resume" : "pause")}>{event.status === "paused" ? "Resume" : "Pause"}</button>
                      <button type="button" className="rounded-full border px-3 py-1 text-sm font-bold" onClick={() => onEventStatus(event, "cancel")}>Cancel</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#eadfd5] bg-[#fbf8f5] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-black">Recurring support</h4>
                  <p className="mt-1 text-sm text-[#7d6b65]">Ongoing check-ins, coaching, medication reminders, and follow-ups.</p>
                </div>
                <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-black text-purple-700">
                  {detail.scheduled_support?.length ?? 0} services
                </span>
              </div>
              {(detail.scheduled_support ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-[#7d6b65]">No support schedules yet.</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {(detail.scheduled_support ?? []).map((schedule) => {
                    const editing = editingSupportId === schedule.id && supportDraft;
                    const supportBusy = scheduleBusyAction === `support:${schedule.id}` || scheduleBusyAction === `support-status:${schedule.id}`;
                    const canEditSupport = schedule.admin_edit_allowed;
                    return (
                      <div key={schedule.id} className="rounded-xl bg-white p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-black">{schedule.friendly_label || supportLabel(schedule.interaction_type)}</p>
                          <span className={`rounded-full px-2 py-1 text-xs font-black ${schedule.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-[#f4eafe] text-purple-700"}`}>
                            {lifecycleStatusLabel(schedule.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-[#7d6b65]">{supportFrequency(schedule)}</p>
                        <p className="text-[#7d6b65]">Next: {formatDate(schedule.next_run_at)}</p>
                        <p className="text-[#7d6b65]">Last result: {schedule.last_result ?? "No recent result"}</p>
                        <p className="text-[#7d6b65]">
                          Consent: {consentStatusLabel(schedule.consent_status ?? "not_required")} - Admin edits {schedule.admin_edit_allowed ? "allowed" : "not allowed"}
                        </p>
                        {!canEditSupport && (
                          <p className="mt-2 rounded-xl bg-[#fff3e8] px-3 py-2 font-bold text-[#8a4a00]">
                            User has not allowed admin edits for support schedules.
                          </p>
                        )}
                        {editing && canEditSupport ? (
                          <div className="mt-3 grid gap-3 rounded-2xl border border-purple-100 bg-[#fbf8f5] p-3">
                            <div className="grid gap-2 md:grid-cols-2">
                              <Field label="Frequency">
                                <select className="w-full rounded-xl border px-3 py-2" value={supportDraft.frequency_type} onChange={(e) => setSupportDraft({ ...supportDraft, frequency_type: e.target.value })}>
                                  <option value="DAILY">Daily</option>
                                  <option value="WEEKLY">Weekly</option>
                                  <option value="CUSTOM">Custom</option>
                                  <option value="ONE_OFF">One-off</option>
                                </select>
                              </Field>
                              <Field label="Timezone">
                                <input className="w-full rounded-xl border px-3 py-2" value={supportDraft.timezone} onChange={(e) => setSupportDraft({ ...supportDraft, timezone: e.target.value })} />
                              </Field>
                            </div>
                            {(supportDraft.frequency_type === "WEEKLY" || supportDraft.frequency_type === "CUSTOM") && (
                              <div>
                                <p className="mb-2 font-bold text-[#4d4351]">Days</p>
                                <div className="flex flex-wrap gap-2">
                                  {supportDayOptions.map((day) => {
                                    const selected = supportDraft.days_of_week.includes(day.value);
                                    return (
                                      <button
                                        key={day.value}
                                        type="button"
                                        className={`rounded-xl px-3 py-2 text-xs font-black ${selected ? "bg-purple-700 text-white" : "border border-[#eadfd5] text-purple-700"}`}
                                        onClick={() => setSupportDraft({
                                          ...supportDraft,
                                          days_of_week: selected
                                            ? supportDraft.days_of_week.filter((value) => value !== day.value)
                                            : [...supportDraft.days_of_week, day.value],
                                        })}
                                      >
                                        {day.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            <div>
                              <p className="mb-2 font-bold text-[#4d4351]">Times</p>
                              <div className="grid gap-2">
                                {supportDraft.times_of_day.map((time, index) => (
                                  <div key={`${schedule.id}-${index}`} className="grid grid-cols-[1fr_auto] gap-2">
                                    <input
                                      className="rounded-xl border px-3 py-2"
                                      type="time"
                                      value={time}
                                      onChange={(e) => {
                                        const times = [...supportDraft.times_of_day];
                                        times[index] = e.target.value;
                                        setSupportDraft({ ...supportDraft, times_of_day: times });
                                      }}
                                    />
                                    <button
                                      type="button"
                                      className="rounded-xl border px-3 py-2 font-bold"
                                      onClick={() => setSupportDraft({ ...supportDraft, times_of_day: supportDraft.times_of_day.filter((_, itemIndex) => itemIndex !== index) })}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}
                                <button type="button" className="rounded-xl bg-purple-50 px-3 py-2 font-bold text-purple-700" onClick={() => setSupportDraft({ ...supportDraft, times_of_day: [...supportDraft.times_of_day, "12:00"] })}>
                                  Add another time
                                </button>
                              </div>
                            </div>
                            <div className="grid gap-2 md:grid-cols-2">
                              <Field label="Quiet hours start">
                                <input className="w-full rounded-xl border px-3 py-2" type="time" value={supportDraft.quiet_hours_start} onChange={(e) => setSupportDraft({ ...supportDraft, quiet_hours_start: e.target.value })} />
                              </Field>
                              <Field label="Quiet hours end">
                                <input className="w-full rounded-xl border px-3 py-2" type="time" value={supportDraft.quiet_hours_end} onChange={(e) => setSupportDraft({ ...supportDraft, quiet_hours_end: e.target.value })} />
                              </Field>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" className="rounded-xl bg-purple-700 px-4 py-2 font-bold text-white disabled:opacity-60" disabled={supportBusy} onClick={() => onSupportSave(schedule, supportDraft)}>
                                {supportBusy ? "Saving..." : "Save support schedule"}
                              </button>
                              <button type="button" className="rounded-xl border px-4 py-2 font-bold" onClick={() => { setEditingSupportId(null); setSupportDraft(null); }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          canEditSupport && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button type="button" className="rounded-full bg-purple-700 px-3 py-1.5 font-bold text-white disabled:opacity-60" disabled={supportBusy} onClick={() => { setEditingSupportId(schedule.id); setSupportDraft(supportDraftFromSchedule(schedule)); }}>
                                Edit support
                              </button>
                              <button type="button" className="rounded-full border px-3 py-1.5 font-bold disabled:opacity-60" disabled={supportBusy} onClick={() => onSupportStatus(schedule, schedule.status === "PAUSED" || schedule.is_paused ? "resume" : "pause")}>
                                {schedule.status === "PAUSED" || schedule.is_paused ? "Resume" : "Pause"}
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="mt-4 rounded-2xl bg-purple-50 p-3">
              <p className="font-bold">Add event</p>
              <div className="mt-2 grid gap-2">
                <input className="rounded-xl border px-3 py-2" placeholder="Title" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Date" required>
                    <input className="w-full rounded-xl border px-3 py-2" type="date" value={newEventDate} onChange={(e) => setNewEvent({ ...newEvent, scheduled_date: e.target.value, scheduled_for: combineDateTimeLocal(e.target.value, newEventTime) })} />
                  </Field>
                  <Field label="Time" required>
                    <input className="w-full rounded-xl border px-3 py-2" type="time" value={newEventTime} onChange={(e) => setNewEvent({ ...newEvent, scheduled_time: e.target.value, scheduled_for: combineDateTimeLocal(newEventDate, e.target.value) })} />
                  </Field>
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <select className="rounded-xl border px-3 py-2" value={newEvent.event_type} onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}><option value="check_in_call">Check-in call</option><option value="medication_reminder">Medication reminder</option><option value="brain_coach">Brain coach</option><option value="vyva_chat">VYVA chat</option><option value="social_room_session">Social room session</option><option value="concierge_call">Concierge call</option><option value="custom">Custom</option></select>
                  <select className="rounded-xl border px-3 py-2" value={newEvent.recurrence} onChange={(e) => setNewEvent({ ...newEvent, recurrence: e.target.value })}><option value="none">No repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>
                  <select className="rounded-xl border px-3 py-2" value={newEvent.channel} onChange={(e) => setNewEvent({ ...newEvent, channel: e.target.value })}><option value="app">App</option><option value="voice">Voice</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option></select>
                </div>
                <button className="rounded-xl bg-purple-700 px-4 py-2 font-bold text-white" onClick={onCreateEvent}>Add scheduled event</button>
              </div>
            </div>
          </section>}
          </div>

        {activeDetailTab === "activity" && <section className="grid gap-4">
          <AuditMilestones detail={detail} />
          <ActivityTimeline detail={detail} />
          <div className="grid gap-4">
            <LogPanel title="Consent attempts" rows={detail.consent_attempts} />
            <LogPanel title="Support activity" rows={detail.interaction_logs ?? []} />
            <LogPanel title="Schedule changes" rows={detail.consent_audit_logs ?? []} />
            <LogPanel title="Lifecycle history" rows={detail.lifecycle_events} />
          </div>
        </section>}
        {activeDetailTab === "communications" && <section className="grid gap-4">
          <div className="rounded-2xl border border-[#eadfd5] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black">Communications</h3>
                <p className="mt-1 text-sm text-[#7d6b65]">Invite sends, reminders, delivery status, and access link activity.</p>
              </div>
              <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-black text-purple-700">{detail.communications.length} messages</span>
            </div>
          </div>
          <LogPanel title="Message history" rows={detail.communications} />
          <LogPanel title="Access links" rows={detail.access_links ?? []} />
        </section>}
      </div>
    </aside>
    </div>
  );
}

export function LogPanel({ title, rows }: { title: string; rows: JsonRecord[] }) {
  return (
    <div className="rounded-3xl border p-4">
      <h3 className="font-black">{title}</h3>
      <div className="mt-3 max-h-72 overflow-auto text-sm">
        {rows.length === 0 ? <p className="text-[#7d6b65]">No records yet.</p> : rows.map((row) => (
          <div key={row.id} className="mb-2 rounded-2xl bg-[#fbf8f5] p-3">
            <p className="font-bold">{cleanLabel(stringValue(row.purpose) ?? stringValue(row.event_type) ?? stringValue(row.interaction_type) ?? stringValue(row.outcome) ?? stringValue(row.status) ?? stringValue(row.action) ?? stringValue(row.changed_by_role) ?? "Record")}</p>
            <p className="text-[#7d6b65]">{row.channel ? `${cleanLabel(stringValue(row.channel))} - ` : ""}{row.created_at ? new Date(String(row.created_at)).toLocaleString() : ""}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HomeCardsSection({ cards, onChange, onSave }: {
  cards: HomePlanCardAdmin[];
  onChange: (cardId: string, patch: Partial<HomePlanCardAdmin>) => void;
  onSave: (card: HomePlanCardAdmin) => void;
}) {
  return (
    <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl">Home suggestions</h2>
          <p className="mt-2 max-w-3xl text-sm text-[#7d6b65]">
            This is the curated card pool behind “Today for you”. VYVA still chooses which cards each user sees based on profile signals.
          </p>
        </div>
        <span className="rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">{cards.length} cards</span>
      </div>

      {cards.length === 0 ? (
        <div className="mt-5 rounded-3xl bg-[#fbf8f5] p-5">
          <p className="font-bold">No home cards loaded yet.</p>
          <p className="mt-1 text-sm text-[#7d6b65]">If this follows a fresh deploy, confirm migrations include migrations/0032_home_plan_cards.sql.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {cards.map((card) => (
            <article key={card.card_id} className="rounded-3xl border border-[#eadfd5] bg-[#fbf8f5] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-xl font-black">{card.card_id}</p>
                  <p className="text-sm text-[#7d6b65]">{card.route}</p>
                </div>
                <label className="flex items-center gap-2 rounded-full bg-white px-4 py-2 font-bold text-purple-700">
                  <input type="checkbox" checked={card.is_enabled} onChange={(e) => onChange(card.card_id, { is_enabled: e.target.checked })} />
                  Enabled
                </label>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Field label="Emoji"><input className="w-full rounded-2xl border px-4 py-3" value={card.emoji} onChange={(e) => onChange(card.card_id, { emoji: e.target.value })} /></Field>
                <Field label="Priority"><input className="w-full rounded-2xl border px-4 py-3" type="number" value={card.base_priority} onChange={(e) => onChange(card.card_id, { base_priority: Number(e.target.value) })} /></Field>
                <Field label="Route"><input className="w-full rounded-2xl border px-4 py-3" value={card.route} onChange={(e) => onChange(card.card_id, { route: e.target.value })} /></Field>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Background"><input className="w-full rounded-2xl border px-4 py-3" value={card.bg} onChange={(e) => onChange(card.card_id, { bg: e.target.value })} /></Field>
                <Field label="Badge background"><input className="w-full rounded-2xl border px-4 py-3" value={card.badge_bg} onChange={(e) => onChange(card.card_id, { badge_bg: e.target.value })} /></Field>
                <Field label="Badge text"><input className="w-full rounded-2xl border px-4 py-3" value={card.badge_text} onChange={(e) => onChange(card.card_id, { badge_text: e.target.value })} /></Field>
              </div>

              <div className="mt-3 grid gap-3">
                <Field label="Condition keywords">
                  <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={keywordsToText(card.condition_keywords)} onChange={(e) => onChange(card.card_id, { condition_keywords: textToKeywords(e.target.value) })} />
                </Field>
                <Field label="Hobby keywords">
                  <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={keywordsToText(card.hobby_keywords)} onChange={(e) => onChange(card.card_id, { hobby_keywords: textToKeywords(e.target.value) })} />
                </Field>
                <Field label="Avoid if user has">
                  <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={keywordsToText(card.avoid_condition_keywords)} onChange={(e) => onChange(card.card_id, { avoid_condition_keywords: textToKeywords(e.target.value) })} />
                </Field>
                <Field label="Admin notes" optional>
                  <textarea className="min-h-20 w-full rounded-2xl border px-4 py-3" value={card.admin_notes ?? ""} onChange={(e) => onChange(card.card_id, { admin_notes: e.target.value })} />
                </Field>
              </div>

              <button className="mt-4 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white" onClick={() => onSave(card)}>
                Save card
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function TierSection({
  plans,
  setPlans,
  onSave,
}: {
  plans: SubscriptionPlanAdmin[];
  setPlans: (plans: SubscriptionPlanAdmin[]) => void;
  onSave: (plan: SubscriptionPlanAdmin) => Promise<void>;
}) {
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<{ planId: string; type: "success" | "error"; text: string } | null>(null);
  const rows = plans.length
    ? plans
    : tiers.map((tier, index) => ({
      plan_id: tier,
      name: tier[0].toUpperCase() + tier.slice(1),
      description: tier === "free" ? "Core features forever free" : "Full VYVA experience",
      price_eur: tier === "free" ? 0 : 2900,
      price_gbp: tier === "free" ? 0 : 2499,
      billing_interval: "month",
      trial_days: tier === "free" ? 0 : 14,
      stripe_price_id_eur: "",
      stripe_price_id_gbp: "",
      features: tier === "free"
        ? ["companionship", "brain_training", "daily_checkin"]
        : ["companionship", "brain_training", "daily_checkin", "concierge", "caregiver_alerts"],
      is_active: true,
      is_public: true,
      sort_order: index,
      entitlement: {
        tier,
        display_name: tier[0].toUpperCase() + tier.slice(1),
        description: `${tier} entitlement bundle`,
        voice_assistant: true,
        medication_tracking: true,
        symptom_check: tier === "premium",
        concierge: tier === "premium",
        caregiver_dashboard: tier === "premium",
        custom_features: {},
        is_active: true,
      },
    }));

  function updatePlan(planId: string, patch: Partial<SubscriptionPlanAdmin>) {
    setPlans(rows.map((plan) => plan.plan_id === planId ? { ...plan, ...patch } : plan));
  }

  function updateEntitlement(planId: string, patch: Partial<PlanEntitlement>) {
    setPlans(rows.map((plan) => plan.plan_id === planId
      ? {
        ...plan,
        entitlement: {
          tier: plan.plan_id,
          display_name: plan.name,
          description: plan.description ?? "",
          voice_assistant: false,
          medication_tracking: false,
          symptom_check: false,
          concierge: false,
          caregiver_dashboard: false,
          is_active: plan.is_active,
          custom_features: {},
          ...(plan.entitlement ?? {}),
          ...patch,
        },
      }
      : plan));
  }

  function centsToCurrency(cents: number | null | undefined) {
    return ((cents ?? 0) / 100).toFixed(2);
  }

  function currencyToCents(value: string) {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
  }

  async function handleSave(plan: SubscriptionPlanAdmin) {
    setSavingPlanId(plan.plan_id);
    setSaveNotice(null);
    try {
      await onSave(plan);
      setSaveNotice({ planId: plan.plan_id, type: "success", text: `${plan.name} saved successfully.` });
    } catch (err) {
      setSaveNotice({
        planId: plan.plan_id,
        type: "error",
        text: err instanceof Error ? err.message : "Could not save this plan.",
      });
    } finally {
      setSavingPlanId(null);
    }
  }

  return (
    <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl">Plans & tiers</h2>
          <p className="mt-2 max-w-3xl text-sm text-[#7d6b65]">Plans control what users can choose and buy. Entitlements control which app capabilities each plan unlocks.</p>
        </div>
        <span className="rounded-full bg-[#f8f0ff] px-4 py-2 text-sm font-bold text-purple-700">{rows.filter((plan) => plan.is_public).length} public plans</span>
      </div>

      <div className="mt-5 grid gap-4">
        {rows.map((plan) => {
          const entitlement = plan.entitlement;
          const featuresText = (plan.features ?? []).join("\n");
          const missingEntitlement = plan.is_active && plan.is_public && !entitlement;
          return (
            <article key={plan.plan_id} className="rounded-3xl border border-[#eadfd5] bg-[#fbf8f5] p-4">
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <div className="grid gap-3 md:grid-cols-[160px_1fr]">
                    <Field label="Plan ID"><input className="w-full rounded-2xl border px-4 py-3 bg-white" value={plan.plan_id} disabled /></Field>
                    <Field label="Display name"><input className="w-full rounded-2xl border px-4 py-3 bg-white" value={plan.name} onChange={(e) => updatePlan(plan.plan_id, { name: e.target.value })} /></Field>
                  </div>
                  <Field label="Description" optional><textarea className="min-h-20 w-full rounded-2xl border px-4 py-3 bg-white" value={plan.description ?? ""} onChange={(e) => updatePlan(plan.plan_id, { description: e.target.value })} /></Field>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <Field label="EUR / month"><input className="w-full rounded-2xl border px-4 py-3 bg-white" type="number" inputMode="decimal" min={0} step="0.01" value={centsToCurrency(plan.price_eur)} onChange={(e) => updatePlan(plan.plan_id, { price_eur: currencyToCents(e.target.value) })} /></Field>
                    <Field label="GBP / month"><input className="w-full rounded-2xl border px-4 py-3 bg-white" type="number" inputMode="decimal" min={0} step="0.01" value={centsToCurrency(plan.price_gbp)} onChange={(e) => updatePlan(plan.plan_id, { price_gbp: currencyToCents(e.target.value) })} /></Field>
                    <Field label="Trial days"><input className="w-full rounded-2xl border px-4 py-3 bg-white" type="number" min={0} value={plan.trial_days ?? 0} onChange={(e) => updatePlan(plan.plan_id, { trial_days: Number(e.target.value) })} /></Field>
                    <Field label="Order"><input className="w-full rounded-2xl border px-4 py-3 bg-white" type="number" value={plan.sort_order ?? 0} onChange={(e) => updatePlan(plan.plan_id, { sort_order: Number(e.target.value) })} /></Field>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Field label="Stripe EUR price ID" optional><input className="w-full rounded-2xl border px-4 py-3 bg-white" value={plan.stripe_price_id_eur ?? ""} onChange={(e) => updatePlan(plan.plan_id, { stripe_price_id_eur: e.target.value })} /></Field>
                    <Field label="Stripe GBP price ID" optional><input className="w-full rounded-2xl border px-4 py-3 bg-white" value={plan.stripe_price_id_gbp ?? ""} onChange={(e) => updatePlan(plan.plan_id, { stripe_price_id_gbp: e.target.value })} /></Field>
                  </div>
                  <Field label="Feature bullets" optional><textarea className="min-h-24 w-full rounded-2xl border px-4 py-3 bg-white" value={featuresText} onChange={(e) => updatePlan(plan.plan_id, { features: e.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) })} /></Field>
                </div>

                <div className="rounded-3xl border border-[#eadfd5] bg-white p-4">
                  <p className="font-black">Entitlements</p>
                  {missingEntitlement && (
                    <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                      This public plan has no access rules yet. Choose the toggles below and save the plan.
                    </p>
                  )}
                  <div className="mt-3 grid gap-2">
                    {[
                      ["voice_assistant", "Voice assistant"],
                      ["medication_tracking", "Medication tracking"],
                      ["symptom_check", "Symptom check"],
                      ["concierge", "Concierge"],
                      ["caregiver_dashboard", "Caregiver dashboard"],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold">
                        {label}
                        <input
                          type="checkbox"
                          checked={Boolean(entitlement?.[key as keyof PlanEntitlement])}
                          onChange={(e) => updateEntitlement(plan.plan_id, { [key]: e.target.checked } as Partial<PlanEntitlement>)}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold"><input type="checkbox" checked={plan.is_public} onChange={(e) => updatePlan(plan.plan_id, { is_public: e.target.checked })} /> Public</label>
                    <label className="flex items-center gap-2 rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold"><input type="checkbox" checked={plan.is_active} onChange={(e) => updatePlan(plan.plan_id, { is_active: e.target.checked })} /> Active</label>
                  </div>
                  {saveNotice?.planId === plan.plan_id && (
                    <p className={`mt-4 rounded-2xl px-4 py-3 text-sm font-bold ${saveNotice.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
                      {saveNotice.text}
                    </p>
                  )}
                  <button className="mt-4 w-full rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={savingPlanId === plan.plan_id} onClick={() => handleSave(plan)}>
                    {savingPlanId === plan.plan_id ? "Saving..." : "Save plan"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function providerStatusLabel(status: CommunicationProviderStatus["status"]) {
  if (status === "failing") return "Failing";
  if (status === "not_configured") return "Not configured";
  return "Configured";
}

function providerStatusTone(status: CommunicationProviderStatus["status"]) {
  if (status === "failing") return "border-red-200 bg-red-50 text-red-800";
  if (status === "not_configured") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-emerald-100 bg-emerald-50 text-emerald-800";
}

export function CommunicationsSection({ communications, providerStatus = [] }: { communications: Communication[]; providerStatus?: CommunicationProviderStatus[] }) {
  return (
    <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl">Communication log</h2>
          <p className="mt-1 max-w-2xl text-sm text-[#7d6b65]">Delivery health for email, SMS, and WhatsApp, followed by the latest communication audit trail.</p>
        </div>
        <span className="rounded-full bg-purple-50 px-4 py-2 text-sm font-black text-purple-700">{communications.length} messages</span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {providerStatus.map((provider) => (
          <article key={provider.channel} className={`rounded-3xl border p-4 ${providerStatusTone(provider.status)}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.08em] opacity-75">{provider.label}</p>
                <h3 className="mt-1 text-2xl font-black">{providerStatusLabel(provider.status)}</h3>
              </div>
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black">{provider.provider}</span>
            </div>
            <div className="mt-4 grid gap-2 text-sm font-semibold">
              <p>Last sent: {provider.last_sent_at ? formatDate(provider.last_sent_at) : "No sent message yet"}</p>
              <p>Last error: {provider.last_error ?? "None recorded"}</p>
              {provider.last_error_at && <p>Error time: {formatDate(provider.last_error_at)}</p>}
            </div>
          </article>
        ))}
        {providerStatus.length === 0 && (
          <div className="rounded-3xl border border-[#eadfd5] bg-[#fbf8f5] p-4 text-sm font-bold text-[#7d6b65] md:col-span-3">
            Provider health could not be loaded yet.
          </div>
        )}
      </div>
      <div className="mt-4 grid gap-3">
        {communications.map((item) => {
          const error = item.metadata && typeof item.metadata === "object"
            ? stringValue(item.metadata.dispatch_error)
            : "";
          return (
            <div key={item.id} className="rounded-3xl border p-4">
              <p className="font-bold">{cleanLabel(item.purpose)} - {cleanLabel(item.channel)}</p>
              <p className="text-sm text-[#7d6b65]">{item.recipient} - {lifecycleStatusLabel(item.status)} - {new Date(item.created_at).toLocaleString()}</p>
              {item.status === "failed" && error && (
                <p className="mt-2 rounded-2xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">{error}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function AnalyticsSection({ summary }: { summary: JsonRecord | null }) {
  const funnel = (summary?.funnel && typeof summary.funnel === "object" && !Array.isArray(summary.funnel))
    ? summary.funnel as JsonRecord
    : null;
  const stages = Array.isArray(funnel?.stages) ? funnel.stages as FunnelStage[] : [];
  const dropoffs = Array.isArray(funnel?.dropoffs) ? funnel.dropoffs as FunnelStage[] : [];
  const entryMetrics = Array.isArray(funnel?.by_entry_point) ? funnel.by_entry_point as EntryPointMetric[] : [];
  const journeyDropoffs = Array.isArray(funnel?.dropped_by_journey_step) ? funnel.dropped_by_journey_step as JourneyDropoff[] : [];
  const consent = (funnel?.consent && typeof funnel.consent === "object" && !Array.isArray(funnel.consent))
    ? funnel.consent as Record<string, number | Record<string, number>>
    : {};
  const groups = [
    ["Entry points", summary?.byEntryPoint],
    ["User types", summary?.byUserType],
    ["Statuses", summary?.byStatus],
    ["Tiers", summary?.byTier],
    ["Consent", summary?.byConsent],
  ];
  return (
    <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl">Funnel analytics</h2>
          <p className="mt-2 max-w-3xl text-sm text-[#7d6b65]">Track each entry channel from intake through consent, link delivery, activation, and drop-off.</p>
        </div>
        <span className="rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
          {summary?.total ?? 0} total users
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        {stages.map((stage) => (
          <div key={stage.key} className="rounded-3xl bg-[#fbf8f5] p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-[#8b7a73]">{stage.label}</p>
            <p className="mt-3 text-3xl font-black text-[#2f2135]">{stage.count}</p>
            <p className="mt-1 text-sm font-bold text-purple-700">{stage.rate}%</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl bg-[#fbf8f5] p-4">
          <p className="font-black">Conversion by entry point</p>
          <div className="mt-3 overflow-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="text-left text-[#8b7a73]">
                  <th className="py-2">Channel</th>
                  <th>Total</th>
                  <th>Links</th>
                  <th>Active</th>
                  <th>Dropped</th>
                  <th>Link rate</th>
                  <th>Conversion</th>
                </tr>
              </thead>
              <tbody>
                {entryMetrics.map((row) => (
                  <tr key={row.entry_point} className="border-t border-[#eadfd5]">
                    <td className="py-2 font-bold">{entryPointLabel(row.entry_point)}</td>
                    <td>{row.total}</td>
                    <td>{row.link_sent}</td>
                    <td>{row.active}</td>
                    <td>{row.dropped}</td>
                    <td>{row.link_rate}%</td>
                    <td className="font-bold text-purple-700">{row.conversion_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl bg-[#fbf8f5] p-4">
          <p className="font-black">Consent performance</p>
          <div className="mt-3 grid gap-2 text-sm">
            {[
              ["Required", consent.required],
              ["Approved", consent.approved],
              ["Pending", consent.pending],
              ["Rejected", consent.rejected],
              ["No answer", consent.no_answer],
              ["Failed", consent.failed],
              ["Attempts", consent.attempts],
            ].map(([label, value]) => (
              <p key={label as string} className="flex justify-between"><span>{label as string}</span><strong>{Number(value ?? 0)}</strong></p>
            ))}
            <p className="mt-2 flex justify-between rounded-2xl bg-white px-3 py-2 font-bold"><span>Success rate</span><strong>{Number(consent.success_rate ?? 0)}%</strong></p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-[#fbf8f5] p-4">
          <p className="font-black">Drop-off points</p>
          <div className="mt-3 grid gap-2 text-sm">
            {dropoffs.map((dropoff) => (
              <p key={dropoff.key} className="flex justify-between gap-4"><span>{dropoff.label}</span><strong>{dropoff.count} ({dropoff.rate}%)</strong></p>
            ))}
          </div>
        </div>
        <div className="rounded-3xl bg-[#fbf8f5] p-4">
          <p className="font-black">Dropped journey steps</p>
          <div className="mt-3 grid gap-2 text-sm">
            {journeyDropoffs.length === 0 && <p className="text-[#7d6b65]">No dropped journey steps yet.</p>}
            {journeyDropoffs.map((row) => (
              <p key={row.journey_step} className="flex justify-between gap-4"><span>{journeyStepLabel(row.journey_step)}</span><strong>{row.count} ({row.rate}%)</strong></p>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {groups.map(([label, values]) => (
          <div key={label as string} className="rounded-3xl bg-[#fbf8f5] p-4">
            <p className="font-black">{label as string}</p>
            {Object.entries((values as Record<string, number>) ?? {}).map(([key, value]) => (
              <p key={key} className="mt-2 flex justify-between"><span>{key}</span><strong>{value}</strong></p>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
