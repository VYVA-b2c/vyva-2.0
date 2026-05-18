import { useState, type ChangeEvent, type ReactNode } from "react";
import {
  type AccountSubscription,
  type Communication,
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
  combineDateTimeLocal,
  emptyScheduledEvent,
  formatDate,
  keywordsToText,
  languageOptions,
  stringValue,
  subscriptionStatusOptions,
  textToKeywords,
  toDateInputValue,
  toTimeInputValue,
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

export function IntakeTable({ users, onView, onTriggerConsent, onToggleEnabled, onDelete, busyAction = null, compact = false }: {
  users: Intake[];
  onView: (intake: Intake) => void;
  onTriggerConsent: (intake: Intake) => void;
  onToggleEnabled: (intake: Intake) => void;
  onDelete?: (intake: Intake) => void;
  busyAction?: string | null;
  compact?: boolean;
}) {
  const isBusy = (action: string, user: Intake) => busyAction === `${action}:${user.id}`;
  return (
    <div className="mt-5 overflow-auto">
      <table className="w-full min-w-[980px] border-separate border-spacing-y-2">
        <thead><tr className="text-left text-sm uppercase tracking-wide text-[#8b7a73]"><th>Name</th>{!compact && <th>Phone</th>}<th>Type</th><th>Entry</th><th>Tier</th><th>Status</th><th>Account</th><th>Consent</th><th>Org</th><th>Action</th></tr></thead>
        <tbody>
          {users.length === 0 && (
            <tr>
              <td colSpan={compact ? 9 : 10} className="rounded-2xl bg-[#fbf8f5] px-4 py-6 text-center font-bold text-[#7d6b65]">
                No users match the current filters yet.
              </td>
            </tr>
          )}
          {users.map((user) => (
            <tr key={user.id} className="rounded-2xl bg-[#fbf8f5]">
              <td className="rounded-l-2xl px-3 py-3 font-bold">{user.name}</td>
              {!compact && <td className="px-3 py-3">{user.phone}</td>}
              <td className="px-3 py-3">{user.user_type}</td>
              <td className="px-3 py-3">{user.entry_point}</td>
              <td className="px-3 py-3">
                <span>{user.tier}</span>
                {user.intake_tier && user.intake_tier !== user.tier && (
                  <span className="mt-1 block text-xs text-[#8b7a73]">Intake: {user.intake_tier}</span>
                )}
              </td>
              <td className="px-3 py-3">{user.status}</td>
              <td className="px-3 py-3">{user.account_status ?? "enabled"}</td>
              <td className="px-3 py-3">{user.consent_status}</td>
              <td className="px-3 py-3">{user.organization_name ?? "-"}</td>
              <td className="rounded-r-2xl px-3 py-3">
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="rounded-full bg-[#2f2135] px-3 py-2 text-sm font-bold text-white disabled:opacity-60" disabled={isBusy("view", user)} onClick={() => onView(user)}>{isBusy("view", user) ? "Opening..." : "View"}</button>
                  <span className="rounded-full bg-purple-50 px-3 py-2 text-sm font-black uppercase text-purple-700">Tier: {user.tier}</span>
                  <button type="button" className="rounded-full border px-3 py-2 text-sm font-bold disabled:opacity-60" disabled={isBusy("toggle", user)} onClick={() => onToggleEnabled(user)}>{isBusy("toggle", user) ? "Saving..." : user.account_status === "disabled" ? "Enable" : "Disable"}</button>
                  {user.user_type === "family" && <button type="button" className="rounded-full border px-3 py-2 text-sm font-bold disabled:opacity-60" disabled={isBusy("consent", user)} onClick={() => onTriggerConsent(user)}>{isBusy("consent", user) ? "Queueing..." : "Consent"}</button>}
                  {onDelete && <button type="button" className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-60" disabled={isBusy("delete", user)} onClick={() => onDelete(user)}>{isBusy("delete", user) ? "Deleting..." : "Delete"}</button>}
                </div>
              </td>
            </tr>
          ))}
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
          <h2 className="font-serif text-3xl">Account subscriptions</h2>
          <p className="mt-2 max-w-3xl text-sm text-[#7d6b65]">
            Search by the user login email, profile email, name or phone. Updates here change the real app profile plan.
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
          Search accounts
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
                    <p><span className="font-bold text-[#4d4351]">Effective app access:</span> {account.effective_subscription_tier ?? account.subscription_tier}{account.effective_subscription_status ? ` (${account.effective_subscription_status})` : ""}</p>
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
                      {subscriptionStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
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

export function UserDetailModal({ detail, draft, setDraft, organizations, planOptions, statusMessage, saving = false, deleting = false, onClose, onSave, onToggle, onDelete, newEvent, setNewEvent, onCreateEvent, onEventStatus, onEventTime }: {
  detail: UserDetail;
  draft: JsonRecord;
  setDraft: (next: JsonRecord) => void;
  organizations: Organization[];
  planOptions: Array<{ value: string; label: string }>;
  statusMessage?: string;
  saving?: boolean;
  deleting?: boolean;
  onClose: () => void;
  onSave: () => void;
  onToggle: () => void;
  onDelete: () => void;
  newEvent: typeof emptyScheduledEvent;
  setNewEvent: (next: typeof emptyScheduledEvent) => void;
  onCreateEvent: () => void;
  onEventStatus: (event: ScheduledEvent, action: "pause" | "resume" | "cancel") => void;
  onEventTime: (event: ScheduledEvent, scheduledFor: string) => void;
}) {
  const disabled = detail.profile?.account_status === "disabled" || detail.intake.account_status === "disabled";
  const primaryMapping = detail.account_mappings?.[0];
  const selectedTier = String(draft.tier ?? "free").toLowerCase();
  const appTier = primaryMapping?.effective_subscription_tier?.toLowerCase() ?? null;
  const hasTierMismatch = Boolean(appTier && selectedTier && appTier !== selectedTier);
  const hasSubscriptionMismatch = Boolean(primaryMapping?.subscription_mismatch);
  const accessMismatch = hasTierMismatch || hasSubscriptionMismatch;
  const appAccessText = primaryMapping
    ? `${primaryMapping.effective_subscription_tier ?? "Unknown"}${primaryMapping.effective_subscription_status ? ` (${primaryMapping.effective_subscription_status})` : ""}`
    : "No login match";
  const newEventDate = newEvent.scheduled_date || toDateInputValue(newEvent.scheduled_for);
  const newEventTime = newEvent.scheduled_time || toTimeInputValue(newEvent.scheduled_for);
  const [activeDetailTab, setActiveDetailTab] = useState<"profile" | "schedule" | "activity">("profile");
  const detailTabs = [
    { id: "profile" as const, label: "Profile" },
    { id: "schedule" as const, label: "Schedule" },
    { id: "activity" as const, label: "Activity" },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-2 sm:p-4">
      <div className="flex h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#eadfd5] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-700">User details</p>
            <h2 className="mt-1 truncate font-serif text-2xl leading-tight sm:text-3xl">{detail.intake.name}</h2>
            <p className="mt-1 text-sm text-[#7d6b65]">{detail.intake.user_type} - {detail.intake.status} - {disabled ? "Disabled" : "Enabled"}</p>
          </div>
          <button type="button" className="rounded-xl border border-[#eadfd5] px-4 py-2 text-sm font-bold" onClick={onClose}>Close</button>
        </div>
        <div className="shrink-0 border-b border-[#eadfd5] px-4 py-2 sm:px-5">
          <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="User detail sections">
            {detailTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeDetailTab === tab.id}
                className={`rounded-xl px-4 py-2 text-sm font-black ${activeDetailTab === tab.id ? "bg-purple-700 text-white" : "border border-[#eadfd5] text-purple-700"}`}
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
                <h3 className="text-xl font-black">Profile and access</h3>
                <p className="mt-1 text-sm text-[#7d6b65]">Account, contact, and plan controls.</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.08em] ${accessMismatch ? "bg-[#fff3e8] text-[#8a4a00]" : primaryMapping ? "bg-[#ecfdf3] text-[#087443]" : "bg-[#f4eafe] text-purple-700"}`}>
                App access: {appAccessText}
              </span>
            </div>
            {primaryMapping && (
              <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-bold ${accessMismatch ? "bg-[#fff3e8] text-[#8a4a00]" : "bg-[#ecfdf3] text-[#087443]"}`}>
                {primaryMapping.subscription_warning ?? (hasTierMismatch ? "Save changes to sync this user to the selected tier." : "Admin and app access are aligned.")}
              </p>
            )}
            {primaryMapping?.latest_entitlement_repair_at && (
              <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                Last access repair: {formatDate(primaryMapping.latest_entitlement_repair_at)}{primaryMapping.latest_entitlement_repair_summary ? ` - ${primaryMapping.latest_entitlement_repair_summary}` : ""}
              </p>
            )}
            {!primaryMapping && (
              <p className="mt-3 rounded-xl bg-[#f4eafe] px-3 py-2 text-sm font-bold text-purple-800">No login account matched yet. The tier will apply when the user signs in with this email or phone.</p>
            )}
            <div className="mt-4 grid gap-3">
              <Field label="Full name"><input className="w-full rounded-xl border px-3 py-2.5" value={draft.full_name ?? ""} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} /></Field>
              <Field label="Preferred name"><input className="w-full rounded-xl border px-3 py-2.5" value={draft.preferred_name ?? ""} onChange={(e) => setDraft({ ...draft, preferred_name: e.target.value })} /></Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Phone"><input className="w-full rounded-xl border px-3 py-2.5" value={draft.phone_number ?? ""} onChange={(e) => setDraft({ ...draft, phone_number: e.target.value })} /></Field>
                <Field label="WhatsApp"><input className="w-full rounded-xl border px-3 py-2.5" value={draft.whatsapp_number ?? ""} onChange={(e) => setDraft({ ...draft, whatsapp_number: e.target.value })} /></Field>
              </div>
              <Field label="Email"><input className="w-full rounded-xl border px-3 py-2.5" value={draft.email ?? ""} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Caregiver name"><input className="w-full rounded-xl border px-3 py-2.5" value={draft.caregiver_name ?? ""} onChange={(e) => setDraft({ ...draft, caregiver_name: e.target.value })} /></Field>
                <Field label="Caregiver contact"><input className="w-full rounded-xl border px-3 py-2.5" value={draft.caregiver_contact ?? ""} onChange={(e) => setDraft({ ...draft, caregiver_contact: e.target.value })} /></Field>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Admin tier"><select className="w-full rounded-xl border px-3 py-2.5" value={draft.tier ?? "free"} onChange={(e) => setDraft({ ...draft, tier: e.target.value })}>{planOptions.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}</select></Field>
                <Field label="Language"><select className="w-full rounded-xl border px-3 py-2.5" value={draft.language ?? "es"} onChange={(e) => setDraft({ ...draft, language: e.target.value })}>{languageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                <Field label="Organization"><select className="w-full rounded-xl border px-3 py-2.5" value={draft.organization_id ?? ""} onChange={(e) => setDraft({ ...draft, organization_id: e.target.value })}><option value="">None</option>{organizations.filter((org) => org.is_active).map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></Field>
              </div>
              <div className="flex flex-wrap gap-2"><button type="button" className="rounded-xl bg-purple-700 px-5 py-2.5 font-bold text-white disabled:opacity-60" disabled={saving || deleting} onClick={onSave}>{saving ? "Saving..." : "Save changes"}</button><button type="button" className="rounded-xl border px-5 py-2.5 font-bold disabled:opacity-60" disabled={deleting} onClick={onToggle}>{disabled ? "Enable user" : "Disable user"}</button><button type="button" className="rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 font-bold text-red-700 disabled:opacity-60" disabled={deleting} onClick={onDelete}>{deleting ? "Deleting..." : "Delete user"}</button></div>
              {statusMessage && (
                <p className={`rounded-xl px-3 py-2 text-sm font-bold ${statusMessage.toLowerCase().includes("could not") ? "bg-[#fff3e8] text-[#8a4a00]" : "bg-[#ecfdf3] text-[#087443]"}`}>
                  {statusMessage}
                </p>
              )}
            </div>
          </section>}

          {activeDetailTab === "schedule" && <section className="mx-auto w-full max-w-4xl rounded-2xl border border-[#eadfd5] p-4">
            <h3 className="text-xl font-black">Scheduled events</h3>
            <div className="mt-3 grid gap-2">
              {detail.scheduled_events.length === 0 && <p className="text-[#7d6b65]">No scheduled events yet.</p>}
              {detail.scheduled_events.map((event) => (
                <div key={event.id} className="rounded-2xl bg-[#fbf8f5] p-3">
                  <p className="font-bold">{event.title}</p>
                  <p className="text-sm text-[#7d6b65]">{event.event_type} - {event.status} - {event.display_time ?? formatDate(event.scheduled_for)}</p>
                  {event.description && <p className="text-sm">{event.description}</p>}
                  {!event.read_only && (
                    <>
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
                        <button className="rounded-full border px-3 py-1 text-sm font-bold" onClick={() => onEventStatus(event, event.status === "paused" ? "resume" : "pause")}>{event.status === "paused" ? "Resume" : "Pause"}</button>
                        <button className="rounded-full border px-3 py-1 text-sm font-bold" onClick={() => onEventStatus(event, "cancel")}>Cancel</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-[#eadfd5] bg-[#fbf8f5] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">Scheduled support</p>
                <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-black text-purple-700">
                  {detail.scheduled_support?.length ?? 0} services
                </span>
              </div>
              {(detail.scheduled_support ?? []).length === 0 ? (
                <p className="mt-2 text-sm text-[#7d6b65]">No support schedules yet.</p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {(detail.scheduled_support ?? []).map((schedule) => (
                    <div key={schedule.id} className="rounded-xl bg-white p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-black">{schedule.friendly_label || supportLabel(schedule.interaction_type)}</p>
                        <span className={`rounded-full px-2 py-1 text-xs font-black ${schedule.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-[#f4eafe] text-purple-700"}`}>
                          {schedule.status.toLowerCase()}
                        </span>
                      </div>
                      <p className="mt-1 text-[#7d6b65]">{supportFrequency(schedule)}</p>
                      <p className="text-[#7d6b65]">Next: {formatDate(schedule.next_run_at)}</p>
                      <p className="text-[#7d6b65]">Last result: {schedule.last_result ?? "No recent result"}</p>
                      <p className="text-[#7d6b65]">
                        Consent: {schedule.consent_status ?? "not_required"} - Caregiver/admin edits {schedule.admin_edit_allowed ? "allowed" : "not allowed"}
                      </p>
                    </div>
                  ))}
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

        {activeDetailTab === "activity" && <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <LogPanel title="Communications" rows={detail.communications} />
          <LogPanel title="Consent attempts" rows={detail.consent_attempts} />
          <LogPanel title="Support activity" rows={detail.interaction_logs ?? []} />
          <LogPanel title="Schedule changes" rows={detail.consent_audit_logs ?? []} />
          <LogPanel title="Lifecycle history" rows={detail.lifecycle_events} />
        </section>}
      </div>
    </div>
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
            <p className="font-bold">{row.purpose ?? row.event_type ?? row.interaction_type ?? row.outcome ?? row.status ?? row.action ?? row.changed_by_role ?? "Record"}</p>
            <p className="text-[#7d6b65]">{row.channel ? `${row.channel} - ` : ""}{row.created_at ? new Date(row.created_at).toLocaleString() : ""}</p>
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
          <p className="font-bold">Home cards are not active yet.</p>
          <p className="mt-1 text-sm text-[#7d6b65]">Run the migration: schema/home_plan_cards.sql.</p>
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

export function CommunicationsSection({ communications }: { communications: Communication[] }) {
  return (
    <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
      <h2 className="font-serif text-3xl">Communication log</h2>
      <div className="mt-4 grid gap-3">
        {communications.map((item) => {
          const error = item.metadata && typeof item.metadata === "object"
            ? stringValue(item.metadata.dispatch_error)
            : "";
          return (
            <div key={item.id} className="rounded-3xl border p-4">
              <p className="font-bold">{item.purpose} - {item.channel}</p>
              <p className="text-sm text-[#7d6b65]">{item.recipient} - {item.status} - {new Date(item.created_at).toLocaleString()}</p>
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
                    <td className="py-2 font-bold">{row.entry_point}</td>
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
              <p key={row.journey_step} className="flex justify-between gap-4"><span>{row.journey_step}</span><strong>{row.count} ({row.rate}%)</strong></p>
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
