export type Intake = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  user_type: "elder" | "family" | "admin";
  entry_point: "form" | "phone" | "whatsapp" | "admin";
  status: "created" | "link_sent" | "consent_pending" | "active" | "dropped";
  journey_step: string;
  consent_status: string;
  tier: string;
  intake_tier?: string | null;
  profile_subscription_tier?: string | null;
  login_email?: string | null;
  login_phone?: string | null;
  profile_email?: string | null;
  profile_phone?: string | null;
  profile_name?: string | null;
  organization_id?: string | null;
  organization_name?: string | null;
  account_status?: "enabled" | "disabled";
  user_id?: string | null;
  elder_user_id?: string | null;
  family_user_id?: string | null;
  source_payload?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  link_sent_at?: string | null;
  activated_at?: string | null;
  dropped_at?: string | null;
  last_activity_at?: string | null;
};

export function isVisibleLifecycleUser(user: Pick<Intake, "journey_step" | "metadata">) {
  const metadata = user.metadata && typeof user.metadata === "object" ? user.metadata : {};
  return (
    user.journey_step !== "merged_duplicate"
    && user.journey_step !== "admin_deleted"
    && metadata.hidden_from_lifecycle !== true
    && metadata.deleted_from_lifecycle !== true
  );
}

export type Organization = {
  id: string;
  name: string;
  slug: string;
  default_tier: string;
  is_active: boolean;
};

export type BulkPreviewRow = {
  row_number: number;
  valid: boolean;
  errors: string[];
  values: Record<string, string>;
};

export type BulkPreviewResponse = {
  organization: Organization;
  rows: BulkPreviewRow[];
  summary: { total: number; valid: number; invalid: number };
};

export type ConsentAttempt = {
  id: string;
  status: string;
  attempt_number: number;
  channel: string;
  created_at: string;
  intake?: Intake | null;
};

export type Communication = {
  id: string;
  channel: string;
  recipient: string;
  purpose: string;
  status: string;
  metadata?: JsonRecord | null;
  created_at: string;
};

export type CommunicationProviderStatus = {
  channel: "email" | "sms" | "whatsapp";
  label: string;
  provider: string;
  configured: boolean;
  status: "configured" | "failing" | "not_configured";
  last_sent_at?: string | null;
  last_error_at?: string | null;
  last_error?: string | null;
  missing_config?: string | null;
};

export type AccessLink = {
  id: string;
  user_id?: string | null;
  intake_id?: string | null;
  organization_id?: string | null;
  link_type: string;
  tier: string;
  destination: string;
  target_role: string;
  max_uses: number;
  use_count: number;
  clicked_at?: string | null;
  converted_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  metadata?: JsonRecord | null;
  created_at: string;
};

export type ScheduledEvent = {
  id: string;
  user_id?: string;
  event_type: string;
  title: string;
  description?: string | null;
  channel: string;
  agent_slug?: string | null;
  room_slug?: string | null;
  scheduled_for?: string | null;
  display_time?: string | null;
  timezone: string;
  recurrence: string;
  status: string;
  source: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  read_only?: boolean;
};

export type ScheduledSupport = {
  id: string;
  user_id?: string;
  interaction_type: string;
  friendly_label?: string | null;
  user_description?: string | null;
  source_ref_id?: string | null;
  status: string;
  frequency_type: string;
  frequency_value?: JsonRecord | null;
  times_of_day?: string[] | null;
  days_of_week?: string[] | null;
  timezone?: string | null;
  preferred_language?: string | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  is_paused?: boolean;
  pause_until?: string | null;
  next_run_at?: string | null;
  last_result?: string | null;
  admin_edit_allowed: boolean;
  consent_status?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
};

export type JsonRecord = Record<string, unknown>;

export type FunnelStage = {
  key: string;
  label: string;
  count: number;
  rate: number;
};

export type EntryPointMetric = {
  entry_point: string;
  total: number;
  link_sent: number;
  active: number;
  dropped: number;
  link_rate: number;
  conversion_rate: number;
  drop_rate: number;
};

export type JourneyDropoff = {
  journey_step: string;
  count: number;
  rate: number;
};

export function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function cleanLabel(value: string | null | undefined) {
  return (value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function callbackMetadata(intake: Pick<Intake, "metadata" | "journey_step">): JsonRecord | null {
  const callback = intake.metadata?.callback;
  if (callback && typeof callback === "object" && !Array.isArray(callback)) return callback as JsonRecord;
  return intake.journey_step?.startsWith("callback_") ? {} : null;
}

export function callbackScheduledLabel(intake: Pick<Intake, "metadata" | "journey_step">) {
  const callback = callbackMetadata(intake);
  const scheduledFor = stringValue(callback?.scheduled_for);
  if (!scheduledFor) return null;
  return new Date(scheduledFor).toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type LoginMapping = {
  source: "legacy" | "supabase";
  login_uid: string;
  login_email?: string | null;
  login_phone?: string | null;
  match_field?: "email" | "phone" | null;
  active_profile_id?: string | null;
  effective_profile_id?: string | null;
  effective_profile_email?: string | null;
  effective_profile_phone?: string | null;
  effective_account_status?: string | null;
  effective_subscription_tier?: string | null;
  effective_subscription_status?: string | null;
  subscription_mismatch?: boolean;
  subscription_warning?: string | null;
  lifecycle_profile_id?: string | null;
  lifecycle_profile_email?: string | null;
  lifecycle_subscription_tier?: string | null;
  lifecycle_subscription_status?: string | null;
  latest_entitlement_repair_at?: string | null;
  latest_entitlement_repair_channel?: string | null;
  latest_entitlement_repair_trigger?: string | null;
  latest_entitlement_repair_summary?: string | null;
  warnings?: string[];
};

export type UserDetail = {
  intake: Intake;
  profile: JsonRecord | null;
  account_mappings?: LoginMapping[];
  account_mapping_warnings?: string[];
  account_match_field?: "email" | "phone" | null;
  synced_profile_ids?: string[];
  communications: Communication[];
  access_links?: AccessLink[];
  lifecycle_events: JsonRecord[];
  consent_attempts: ConsentAttempt[];
  scheduled_events: ScheduledEvent[];
  scheduled_support?: ScheduledSupport[];
  interaction_logs?: JsonRecord[];
  consent_audit_logs?: JsonRecord[];
};

export type HomePlanCardAdmin = {
  id: string;
  card_id: string;
  is_enabled: boolean;
  emoji: string;
  bg: string;
  badge_bg: string;
  badge_text: string;
  route: string;
  base_priority: number;
  condition_keywords: string[];
  hobby_keywords: string[];
  avoid_condition_keywords: string[];
  admin_notes?: string | null;
  updated_at?: string;
};

export type PlanEntitlement = {
  tier: string;
  display_name: string;
  description?: string | null;
  voice_assistant: boolean;
  medication_tracking: boolean;
  symptom_check: boolean;
  concierge: boolean;
  caregiver_dashboard: boolean;
  custom_features?: Record<string, unknown>;
  is_active: boolean;
};

export type SubscriptionPlanAdmin = {
  plan_id: string;
  name: string;
  description?: string | null;
  price_eur: number;
  price_gbp: number;
  billing_interval?: string | null;
  trial_days?: number | null;
  stripe_price_id_eur?: string | null;
  stripe_price_id_gbp?: string | null;
  features?: string[] | null;
  is_active: boolean;
  is_public: boolean;
  sort_order?: number | null;
  entitlement?: PlanEntitlement | null;
};

export type AccountSubscription = {
  account_id?: string | null;
  account_source?: "legacy" | "supabase" | null;
  account_email?: string | null;
  account_phone?: string | null;
  active_profile_id?: string | null;
  profile_id: string;
  profile_email?: string | null;
  full_name?: string | null;
  preferred_name?: string | null;
  phone_number?: string | null;
  subscription_status: string;
  subscription_tier: string;
  stored_subscription_tier?: string | null;
  trial_ends_at?: string | null;
  effective_subscription_tier?: string | null;
  effective_subscription_status?: string | null;
  lifecycle_subscription_tier?: string | null;
  lifecycle_subscription_status?: string | null;
  billing_subscription_tier?: string | null;
  billing_subscription_status?: string | null;
  subscription_mismatch?: boolean;
  subscription_warning?: string | null;
  entitlement_repaired?: boolean;
  entitlement_repair_audit_id?: string | null;
  latest_entitlement_repair_at?: string | null;
  latest_entitlement_repair_channel?: string | null;
  latest_entitlement_repair_trigger?: string | null;
  latest_entitlement_repair_summary?: string | null;
  account_status?: string | null;
  profile_role?: string | null;
  membership_role?: string | null;
  membership_relationship?: string | null;
  is_active_profile?: boolean;
  synced_profile_ids?: string[];
  source?: string;
  updated_at?: string;
};

export const entryPoints = ["", "form", "phone", "whatsapp", "admin"];
export const entryPointLabels: Record<string, string> = {
  form: "Online form",
  phone: "Phone call",
  whatsapp: "WhatsApp",
  admin: "Admin-created",
};
export function entryPointLabel(value: string | null | undefined) {
  const key = value ?? "";
  return entryPointLabels[key] ?? key;
}
export const userTypes = ["", "elder", "family", "admin"];
export const statuses = ["", "created", "link_sent", "consent_pending", "active", "dropped"];
export const tiers = ["free", "premium"];
export const subscriptionStatusOptions = ["active", "trial", "past_due", "cancelled"];

export const userTypeLabels: Record<string, string> = {
  elder: "Elder",
  family: "Family",
  admin: "Admin",
};

export const lifecycleStatusLabels: Record<string, string> = {
  created: "Created",
  link_sent: "Link sent",
  consent_pending: "Consent pending",
  active: "Active",
  dropped: "Dropped",
};

export const journeyStepLabels: Record<string, string> = {
  created: "Created",
  link_sent: "Link sent",
  access_link_created: "Access link created",
  consent_pending: "Consent pending",
  consent_approved: "Consent approved",
  consent_rejected: "Consent rejected",
  admin_created: "Admin-created",
  admin_enabled: "Enabled by admin",
  admin_disabled: "Disabled by admin",
  admin_deleted: "Removed by admin",
  merged_duplicate: "Merged duplicate",
  callback_scheduled: "Callback scheduled",
  inbound_phone_onboarding: "Phone onboarding",
  app_onboarding_complete: "App onboarding complete",
};

export const consentStatusLabels: Record<string, string> = {
  not_required: "Not required",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  no_answer: "No answer",
  failed: "Failed",
};

export const accountStatusLabels: Record<string, string> = {
  enabled: "Enabled",
  disabled: "Disabled",
};

export function userTypeLabel(value: string | null | undefined) {
  const key = value ?? "";
  return userTypeLabels[key] ?? cleanLabel(key);
}

export function lifecycleStatusLabel(value: string | null | undefined) {
  const key = value ?? "";
  return lifecycleStatusLabels[key] ?? cleanLabel(key);
}

export function journeyStepLabel(value: string | null | undefined) {
  const key = value ?? "";
  return journeyStepLabels[key] ?? cleanLabel(key);
}

export function consentStatusLabel(value: string | null | undefined) {
  const key = value ?? "";
  return consentStatusLabels[key] ?? cleanLabel(key);
}

export function accountStatusLabel(value: string | null | undefined) {
  const key = value ?? "";
  return accountStatusLabels[key] ?? cleanLabel(key || "enabled");
}

export function tierLabel(value: string | null | undefined) {
  return cleanLabel(value || "");
}

export const languageOptions = [
  { value: "es", label: "Spanish" },
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
];
export const timezoneOptions = ["Europe/Madrid", "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Rome", "Europe/Lisbon"];
export const countryCodeOptions = ["+34 ES", "+44 UK", "+33 FR", "+49 DE", "+39 IT", "+351 PT", "+1 US"];

export const emptyIntakeForm = {
  first_name: "",
  last_name: "",
  preferred_name: "",
  date_of_birth: "",
  gender: "prefer_not_to_say",
  country_code: "+34 ES",
  phone: "",
  whatsapp: "",
  email: "",
  language: "es",
  timezone: "Europe/Madrid",
  user_type: "elder",
  entry_point: "form",
  tier: "premium",
  organization_id: "",
  elder_first_name: "",
  elder_last_name: "",
  elder_phone: "",
  elder_email: "",
};

export const emptyScheduledEvent = {
  event_type: "vyva_chat",
  title: "",
  description: "",
  channel: "app",
  agent_slug: "",
  room_slug: "",
  scheduled_for: "",
  scheduled_date: "",
  scheduled_time: "",
  timezone: "Europe/Madrid",
  recurrence: "none",
  status: "upcoming",
};

export function csvToRows(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const parseLine = (line: string) => {
    const values: string[] = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };
  const headers = parseLine(lines[0]).map((header) => header.trim().toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

export function formatDate(value?: string | null) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString();
}

export function toDatetimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function toDateInputValue(value?: string | null) {
  return toDatetimeLocal(value).slice(0, 10);
}

export function toTimeInputValue(value?: string | null) {
  return toDatetimeLocal(value).slice(11, 16);
}

export function combineDateTimeLocal(date: string, time: string) {
  return date && time ? `${date}T${time}` : "";
}

export function keywordsToText(values?: string[]) {
  return (values ?? []).join(", ");
}

export function textToKeywords(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
