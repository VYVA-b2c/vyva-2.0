import { Copy, Send, Upload } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { apiFetch } from "@/lib/queryClient";
import {
  AccountSubscriptionsSection,
  AnalyticsSection,
  CommunicationsSection,
  Field,
  HomeCardsSection,
  IntakeTable,
  TierSection,
  UserDetailModal,
} from "./lifecycle/components";
import {
  type AccountSubscription,
  type BulkPreviewResponse,
  type Communication,
  type ConsentAttempt,
  type HomePlanCardAdmin,
  type Intake,
  type JsonRecord,
  type LoginMapping,
  type Organization,
  type ScheduledEvent,
  type ScheduledSupport,
  type SubscriptionPlanAdmin,
  type UserDetail,
  countryCodeOptions,
  csvToRows,
  emptyIntakeForm,
  emptyScheduledEvent,
  entryPoints,
  languageOptions,
  statuses,
  stringValue,
  tiers,
  timezoneOptions,
  userTypes,
} from "./lifecycle/shared";

type SignupShareResult = {
  id: string;
  channel: string;
  recipient: string;
  status: string;
  error?: string;
};

type SignupShareNotice = {
  tone: "success" | "warning" | "error";
  title: string;
  details: string[];
};

type SignupShareRecipient = {
  name?: string;
  recipient: string;
};

type SupportScheduleDraft = {
  frequency_type: string;
  days_of_week: string[];
  times_of_day: string[];
  timezone: string;
  preferred_language: string;
  quiet_hours_start: string;
  quiet_hours_end: string;
};

const adminTabs = [
  { id: "users", label: "People" },
  { id: "accounts", label: "App Access" },
  { id: "invites", label: "Forms" },
  { id: "consent", label: "Consent" },
  { id: "organizations", label: "Organizations" },
  { id: "tiers", label: "Tiers" },
  { id: "communications", label: "Communications" },
  { id: "analytics", label: "Analytics" },
];

function normalizeOrganizationLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function slugifyOrganizationLabel(value: string) {
  return normalizeOrganizationLabel(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

export default function LifecycleAdminPage() {
  const [activeTab, setActiveTab] = useState("users");
  const [filters, setFilters] = useState({ entry_point: "", user_type: "", status: "", tier: "" });
  const [peopleSearchInput, setPeopleSearchInput] = useState("");
  const [peopleSearch, setPeopleSearch] = useState("");
  const [summary, setSummary] = useState<JsonRecord | null>(null);
  const [users, setUsers] = useState<Intake[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlanAdmin[]>([]);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountSubscriptions, setAccountSubscriptions] = useState<AccountSubscription[]>([]);
  const [accountSearchMessage, setAccountSearchMessage] = useState("");
  const [savingAccountProfileId, setSavingAccountProfileId] = useState<string | null>(null);
  const [repairingAccountProfileId, setRepairingAccountProfileId] = useState<string | null>(null);
  const [orgFilter, setOrgFilter] = useState<"active" | "archived" | "all">("active");
  const [consentAttempts, setConsentAttempts] = useState<ConsentAttempt[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [message, setMessage] = useState("");
  const [newIntake, setNewIntake] = useState(emptyIntakeForm);
  const [signupShare, setSignupShare] = useState({
    emails: "",
    whatsapp: "",
    message: "",
    language: "en",
  });
  const [sharingSignup, setSharingSignup] = useState(false);
  const [signupShareNotice, setSignupShareNotice] = useState<SignupShareNotice | null>(null);
  const [copiedSignupLink, setCopiedSignupLink] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: "", default_tier: "free" });
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [orgDraft, setOrgDraft] = useState({ name: "", default_tier: "free" });
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<JsonRecord>({});
  const [userDetailMessage, setUserDetailMessage] = useState("");
  const [savingUserDetail, setSavingUserDetail] = useState(false);
  const [newEvent, setNewEvent] = useState(emptyScheduledEvent);
  const [bulkOrg, setBulkOrg] = useState<Organization | null>(null);
  const [bulkRows, setBulkRows] = useState<Record<string, string>[]>([]);
  const [bulkPreview, setBulkPreview] = useState<BulkPreviewResponse | null>(null);
  const [sendBulkLinks, setSendBulkLinks] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  async function api(path: string, options: RequestInit = {}) {
    const res = await apiFetch(`/api/admin/lifecycle${path}`, options);
    const text = await res.text();
    let data: JsonRecord = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text.trim() };
      }
    }
    const errorMessage = typeof data.error === "string" && data.error
      ? data.error
      : text.trim() || `Admin request failed (${res.status})`;
    if (!res.ok) throw new Error(errorMessage);
    return data;
  }

  async function rootApi(path: string, options: RequestInit = {}) {
    const res = await apiFetch(path, options);
    const text = await res.text();
    let data: JsonRecord = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text.trim() };
      }
    }
    const errorMessage = typeof data.error === "string" && data.error
      ? data.error
      : text.trim() || `Request failed (${res.status})`;
    if (!res.ok) throw new Error(errorMessage);
    return data;
  }

  async function refresh() {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
    if (peopleSearch.trim()) params.set("query", peopleSearch.trim());
    const [summaryData, userData, orgData, consentData, commsData, planData] = await Promise.all([
      api("/summary"),
      api(`/users?${params.toString()}`),
      api("/organizations"),
      api("/consent"),
      api("/communications"),
      api("/plans"),
    ]);
    setSummary(summaryData);
    setUsers(userData.users ?? []);
    setOrganizations(orgData.organizations ?? []);
    setConsentAttempts(consentData.attempts ?? []);
    setCommunications(commsData.communications ?? []);
    setPlans(planData.plans ?? []);
  }

  useEffect(() => {
    refresh().catch((err) => setMessage(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, peopleSearch]);

  async function createIntake() {
    setMessage("");
    const fullName = `${newIntake.first_name.trim()} ${newIntake.last_name.trim()}`.trim();
    const [callingCode, countryCode = "ES"] = newIntake.country_code.split(" ");
    const phone = `${callingCode} ${newIntake.phone.trim()}`.trim();
    const elderName = `${newIntake.elder_first_name.trim()} ${newIntake.elder_last_name.trim()}`.trim();
    const data = await api("/intakes", {
      method: "POST",
      body: JSON.stringify({
        name: fullName,
        phone,
        organization_id: newIntake.organization_id || null,
        email: newIntake.email || undefined,
        user_type: newIntake.user_type,
        entry_point: newIntake.entry_point,
        tier: newIntake.tier,
        elder: newIntake.user_type === "family"
          ? {
            name: elderName,
            phone: newIntake.elder_phone.trim(),
            email: newIntake.elder_email.trim(),
          }
          : undefined,
        metadata: {
          first_name: newIntake.first_name.trim(),
          last_name: newIntake.last_name.trim(),
          preferred_name: newIntake.preferred_name.trim(),
          date_of_birth: newIntake.date_of_birth,
          gender: newIntake.gender,
          calling_code: callingCode,
          country_code: countryCode,
          phone_number: phone,
          whatsapp_number: newIntake.whatsapp.trim() || phone,
          email: newIntake.email.trim(),
          language: newIntake.language,
          timezone: newIntake.timezone,
        },
      }),
    });
    setMessage(`Intake created for ${data.intake.name}.`);
    setNewIntake(emptyIntakeForm);
    await refresh();
  }

  function compactRecipientName(value: string) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (looksLikeEmailRecipient(normalized) || looksLikePhoneRecipient(normalized)) return undefined;
    return normalized || undefined;
  }

  function looksLikeEmailRecipient(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  function looksLikePhoneRecipient(value: string) {
    return value.replace(/\D/g, "").length >= 3;
  }

  function parseInviteRecipients(value: string, looksLikeRecipient: (value: string) => boolean): SignupShareRecipient[] {
    const recipients: SignupShareRecipient[] = [];
    let pendingName: string | undefined;

    function addRecipient(recipient: string, name = pendingName) {
      const trimmedRecipient = recipient.trim();
      if (!trimmedRecipient) return;
      recipients.push({ ...(name ? { name } : {}), recipient: trimmedRecipient });
    }

    value.split(/\n+/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const angleMatch = trimmed.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
      if (angleMatch) {
        const name = compactRecipientName(angleMatch[1]) ?? pendingName;
        addRecipient(angleMatch[2], name);
        return;
      }

      const parts = trimmed.split(/[;,]+/).map((item) => item.trim()).filter(Boolean);
      if (parts.length > 1) {
        if (!looksLikeRecipient(parts[0])) {
          const name = compactRecipientName(parts[0]) ?? pendingName;
          parts.slice(1).forEach((recipient) => addRecipient(recipient, name));
          pendingName = name;
          return;
        }
        parts.forEach((recipient) => addRecipient(recipient, undefined));
        return;
      }

      if (looksLikeRecipient(trimmed)) {
        addRecipient(trimmed);
        return;
      }

      pendingName = compactRecipientName(trimmed.replace(/[;,]+$/g, ""));
    });

    return recipients;
  }

  function emailFromText(value: string) {
    return value.match(/[^\s<,;"]+@[^\s>,;"]+\.[^\s>,;"]+/)?.[0] ?? "";
  }

  function phoneFromText(value: string) {
    return value.match(/(?:\+\d[\d\s().-]{4,}\d|\d[\d\s().-]{4,}\d)/)?.[0].replace(/\s+/g, " ").trim() ?? "";
  }

  function uploadRowsWithHeaders(text: string, headers: string[]) {
    const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/).find((line) => line.trim()) ?? "";
    const firstHeaders = firstLine.split(",").map((header) => header.trim().toLowerCase().replace(/\s+/g, "_"));
    if (!firstHeaders.some((header) => headers.includes(header))) return [];
    return csvToRows(text);
  }

  function emailUploadLines(text: string) {
    const rows = uploadRowsWithHeaders(text, ["email", "email_address", "email_recipient", "recipient", "contact_email"]);
    const fromRows = rows
      .map((row) => {
        const email = [
          row.email,
          row.email_address,
          row.email_recipient,
          row.recipient,
          row.contact_email,
          ...Object.values(row),
        ].map((value) => emailFromText(value)).find(looksLikeEmailRecipient);
        if (!email) return "";

        const name = compactRecipientName(
          row.name
            || row.full_name
            || row.recipient_name
            || [row.first_name, row.last_name].filter(Boolean).join(" ")
        );
        return name ? `${name}, ${email}` : email;
      })
      .filter(Boolean);

    if (fromRows.length) return fromRows;

    return text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .flatMap((line) => parseInviteRecipients(line, looksLikeEmailRecipient))
      .filter((item) => looksLikeEmailRecipient(item.recipient))
      .map((item) => item.name ? `${item.name}, ${item.recipient}` : item.recipient);
  }

  function whatsappUploadLines(text: string) {
    const rows = uploadRowsWithHeaders(text, [
      "whatsapp",
      "whatsapp_number",
      "whats_app",
      "phone",
      "phone_number",
      "mobile",
      "mobile_phone",
      "recipient",
      "contact_phone",
    ]);
    const fromRows = rows
      .map((row) => [
        row.whatsapp,
        row.whatsapp_number,
        row.whats_app,
        row.phone,
        row.phone_number,
        row.mobile,
        row.mobile_phone,
        row.recipient,
        row.contact_phone,
        ...Object.values(row),
      ].map((value) => phoneFromText(value)).find(looksLikePhoneRecipient) ?? "")
      .filter(Boolean);

    if (fromRows.length) return fromRows;

    return text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .flatMap((line) => parseInviteRecipients(line, looksLikePhoneRecipient))
      .map((item) => phoneFromText(item.recipient) || item.recipient)
      .filter(looksLikePhoneRecipient);
  }

  function normalizeWhatsappRecipientText(value: string) {
    return parseInviteRecipients(value, looksLikePhoneRecipient)
      .map((item) => phoneFromText(item.recipient) || item.recipient)
      .filter(looksLikePhoneRecipient)
      .join("\n");
  }

  async function uploadEmailRecipients(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const lines = emailUploadLines(await file.text());
      const existing = parseInviteRecipients(signupShare.emails, looksLikeEmailRecipient);
      const seen = new Set(existing.map((item) => item.recipient.toLowerCase()));
      const uniqueLines = lines.filter((line) => {
        const email = parseInviteRecipients(line, looksLikeEmailRecipient)[0]?.recipient ?? emailFromText(line);
        const normalized = email.toLowerCase();
        if (!looksLikeEmailRecipient(email) || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });

      if (!uniqueLines.length) {
        setMessage("No new email recipients found in that file.");
        return;
      }

      setSignupShare((current) => ({
        ...current,
        emails: [current.emails.trim(), ...uniqueLines].filter(Boolean).join("\n"),
      }));
      setMessage(`${uniqueLines.length} email recipient${uniqueLines.length === 1 ? "" : "s"} added from ${file.name}.`);
    } catch {
      setMessage("Could not read that email upload. Use a CSV or TXT file.");
    } finally {
      event.target.value = "";
    }
  }

  async function uploadWhatsappRecipients(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const lines = whatsappUploadLines(await file.text());
      const existing = parseInviteRecipients(signupShare.whatsapp, looksLikePhoneRecipient);
      const seen = new Set(existing.map((item) => item.recipient.replace(/\D/g, "")));
      const uniqueLines = lines.filter((line) => {
        const phone = phoneFromText(line) || line;
        const normalized = phone.replace(/\D/g, "");
        if (!looksLikePhoneRecipient(phone) || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });

      if (!uniqueLines.length) {
        setMessage("No new WhatsApp numbers found in that file.");
        return;
      }

      setSignupShare((current) => ({
        ...current,
        whatsapp: [current.whatsapp.trim(), ...uniqueLines].filter(Boolean).join("\n"),
      }));
      setMessage(`${uniqueLines.length} WhatsApp number${uniqueLines.length === 1 ? "" : "s"} added from ${file.name}.`);
    } catch {
      setMessage("Could not read that WhatsApp upload. Use a CSV or TXT file.");
    } finally {
      event.target.value = "";
    }
  }

  function signupShareResults(value: unknown): SignupShareResult[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is JsonRecord => Boolean(item && typeof item === "object" && !Array.isArray(item)))
      .map((item) => ({
        id: stringValue(item.id),
        channel: stringValue(item.channel),
        recipient: stringValue(item.recipient),
        status: stringValue(item.status),
        error: stringValue(item.error) || undefined,
      }));
  }

  async function shareSignupForm() {
    if (sharingSignup) return;
    setSharingSignup(true);
    setSignupShareNotice(null);
    setMessage("");
    try {
      const emailRecipients = parseInviteRecipients(signupShare.emails, looksLikeEmailRecipient);
      const whatsappRecipients = parseInviteRecipients(signupShare.whatsapp, looksLikePhoneRecipient);
      const data = await api("/signup-share", {
        method: "POST",
        body: JSON.stringify({
          email_recipients: emailRecipients,
          whatsapp_recipients: whatsappRecipients,
          message: signupShare.message.trim() || undefined,
          language: signupShare.language,
        }),
      });
      const queued = Number(data.queued ?? 0);
      const sent = Number(data.sent ?? 0);
      const failed = Number(data.failed ?? 0);
      const results = signupShareResults(data.results);
      const failedDetails = results
        .filter((item) => item.status === "failed")
        .map((item) => `${item.channel} to ${item.recipient}: ${item.error ?? "Delivery failed."}`);
      const sentDetails = results
        .filter((item) => item.status === "sent")
        .map((item) => `${item.channel} to ${item.recipient}: sent`);
      const tone = failed === 0 ? "success" : sent > 0 ? "warning" : "error";
      const title = failed === 0
        ? `Signup link sent to ${sent} recipient${sent === 1 ? "" : "s"}.`
        : sent > 0
          ? `Signup link partially sent: ${sent} sent, ${failed} failed.`
          : `Signup link failed for ${failed || queued} recipient${(failed || queued) === 1 ? "" : "s"}.`;
      setSignupShareNotice({
        tone,
        title,
        details: [...failedDetails, ...(failedDetails.length ? sentDetails : sentDetails.slice(0, 3))],
      });
      if (sent > 0) setSignupShare({ emails: "", whatsapp: "", message: signupShare.message, language: signupShare.language });
      await refresh();
    } catch (err) {
      setSignupShareNotice({
        tone: "error",
        title: "Signup link was not sent.",
        details: [err instanceof Error ? err.message : "Could not share the signup link."],
      });
    } finally {
      setSharingSignup(false);
    }
  }

  async function copySignupLink() {
    try {
      await navigator.clipboard.writeText("https://v2.vyva.life/invite");
      setCopiedSignupLink(true);
      window.setTimeout(() => setCopiedSignupLink(false), 1800);
    } catch {
      setMessage("Could not copy the signup link.");
    }
  }

  async function triggerConsent(intake: Intake) {
    setBusyAction(`consent:${intake.id}`);
    setMessage("");
    try {
      await api(`/consent/${intake.id}/trigger`, { method: "POST" });
      setMessage("Consent call queued.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not queue consent call.");
    } finally {
      setBusyAction(null);
    }
  }

  async function markConsent(attempt: ConsentAttempt, status: string) {
    await api(`/consent/${attempt.id}/result`, {
      method: "POST",
      body: JSON.stringify({ status, result_payload: { source: "admin_panel" } }),
    });
    setMessage(`Consent marked as ${status}.`);
    await refresh();
  }

  function findDuplicateOrg(name: string, excludeId?: string) {
    const normalizedName = normalizeOrganizationLabel(name);
    const slug = slugifyOrganizationLabel(name);
    if (!normalizedName) return null;
    return organizations.find((org) => (
      org.id !== excludeId
        && (normalizeOrganizationLabel(org.name) === normalizedName || org.slug === slug)
    )) ?? null;
  }

  async function createOrg() {
    const duplicate = findDuplicateOrg(newOrg.name);
    if (duplicate) {
      setMessage(`${duplicate.name} already exists and is ${duplicate.is_active ? "active" : "archived"}. Use that organization or restore it instead.`);
      return;
    }

    try {
      const data = await api("/organizations", {
        method: "POST",
        body: JSON.stringify(newOrg),
      });
      setMessage(`Organization created: ${data.organization.name}.`);
      setNewOrg({ name: "", default_tier: "free" });
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not create organization.");
    }
  }

  function startEditOrg(org: Organization) {
    setEditingOrgId(org.id);
    setOrgDraft({ name: org.name, default_tier: org.default_tier });
  }

  function cancelEditOrg() {
    setEditingOrgId(null);
    setOrgDraft({ name: "", default_tier: "free" });
  }

  async function saveOrg(org: Organization) {
    const duplicate = findDuplicateOrg(orgDraft.name, org.id);
    if (duplicate) {
      setMessage(`${duplicate.name} already exists and is ${duplicate.is_active ? "active" : "archived"}. Choose a different organization name.`);
      return;
    }

    try {
      const data = await api(`/organizations/${org.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: orgDraft.name,
          default_tier: orgDraft.default_tier,
        }),
      });
      setMessage(`${data.organization.name} updated. Default tier applies to new org users going forward.`);
      cancelEditOrg();
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update organization.");
    }
  }

  async function archiveOrg(org: Organization) {
    await api(`/organizations/${org.id}`, { method: "DELETE" });
    setMessage(`${org.name} archived.`);
    await refresh();
  }

  async function restoreOrg(org: Organization) {
    try {
      await api(`/organizations/${org.id}/restore`, { method: "POST" });
      setMessage(`${org.name} restored.`);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not restore organization.");
    }
  }

  async function savePlan(plan: SubscriptionPlanAdmin) {
    const entitlement = plan.entitlement ?? {
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
    };

    await api("/plans", {
      method: "POST",
      body: JSON.stringify({
        ...plan,
        features: plan.features ?? [],
        entitlement: {
          display_name: entitlement.display_name ?? plan.name,
          description: entitlement.description ?? plan.description ?? "",
          voice_assistant: Boolean(entitlement.voice_assistant),
          medication_tracking: Boolean(entitlement.medication_tracking),
          symptom_check: Boolean(entitlement.symptom_check),
          concierge: Boolean(entitlement.concierge),
          caregiver_dashboard: Boolean(entitlement.caregiver_dashboard),
          custom_features: entitlement.custom_features ?? {},
          is_active: plan.is_active,
        },
      }),
    });
    setMessage(`${plan.name} saved.`);
    await refresh();
  }

  async function searchAccountSubscriptions(search = accountSearch) {
    const query = search.trim();
    setAccountSearchMessage("");
    if (query.length < 3) {
      setAccountSubscriptions([]);
      setAccountSearchMessage("Enter at least 3 characters to search app access.");
      return;
    }

    const data = await api(`/account-subscriptions?query=${encodeURIComponent(query)}`);
    const accounts = (data.accounts ?? []) as AccountSubscription[];
    setAccountSubscriptions(accounts);
    setAccountSearchMessage(accounts.length ? `${accounts.length} matching app access profile${accounts.length === 1 ? "" : "s"} found.` : "No matching app access profiles found.");
  }

  function updateAccountSubscription(profileId: string, patch: Partial<AccountSubscription>) {
    setAccountSubscriptions((current) => current.map((account) => (
      account.profile_id === profileId ? { ...account, ...patch } : account
    )));
  }

  async function saveAccountSubscription(account: AccountSubscription) {
    setSavingAccountProfileId(account.profile_id);
    setAccountSearchMessage("");
    try {
      const data = await api(`/account-subscriptions/${account.profile_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          account_id: account.account_id,
          account_source: account.account_source,
          account_email: account.account_email,
          subscription_tier: account.subscription_tier,
          subscription_status: account.subscription_status || "active",
        }),
      });
      const updated = data.account as AccountSubscription;
      setAccountSubscriptions((current) => current.map((item) => (
        item.profile_id === account.profile_id
          ? {
              ...item,
              ...updated,
              account_id: updated.account_id ?? item.account_id,
              account_source: updated.account_source ?? item.account_source,
              account_email: item.account_email,
              account_phone: item.account_phone,
              active_profile_id: updated.active_profile_id ?? item.active_profile_id,
              is_active_profile: updated.is_active_profile ?? item.is_active_profile,
            }
          : item
      )));
      const syncedCount = updated.synced_profile_ids?.length ?? 1;
      setAccountSearchMessage(`${account.profile_email ?? account.account_email ?? account.profile_id} updated to ${updated.subscription_tier}${account.account_id ? " and made active for that login" : ""}${syncedCount > 1 ? ` across ${syncedCount} linked profiles` : ""}.`);
      await refresh();
    } catch (err) {
      setAccountSearchMessage(err instanceof Error ? err.message : "Could not update subscription.");
    } finally {
      setSavingAccountProfileId(null);
    }
  }

  async function repairAccountSubscription(account: AccountSubscription) {
    setRepairingAccountProfileId(account.profile_id);
    setAccountSearchMessage("");
    try {
      const data = await api(`/account-subscriptions/${account.profile_id}/repair-entitlement`, {
        method: "POST",
        body: JSON.stringify({
          account_id: account.account_id,
          account_source: account.account_source,
          account_email: account.account_email ?? account.profile_email,
          account_phone: account.account_phone ?? account.phone_number,
        }),
      });
      const updated = data.account as AccountSubscription;
      setAccountSubscriptions((current) => current.map((item) => (
        item.profile_id === account.profile_id
          ? {
              ...item,
              ...updated,
              account_id: updated.account_id ?? item.account_id,
              account_source: updated.account_source ?? item.account_source,
              account_email: item.account_email,
              account_phone: item.account_phone,
              active_profile_id: updated.active_profile_id ?? item.active_profile_id,
              is_active_profile: updated.is_active_profile ?? item.is_active_profile,
            }
          : item
      )));
      setAccountSearchMessage(data.repaired
        ? `${account.profile_email ?? account.account_email ?? account.profile_id} repaired to ${updated.subscription_tier}.`
        : `${account.profile_email ?? account.account_email ?? account.profile_id} did not need a repair.`);
      await refresh();
    } catch (err) {
      setAccountSearchMessage(err instanceof Error ? err.message : "Could not repair subscription.");
    } finally {
      setRepairingAccountProfileId(null);
    }
  }

  async function openUserDetail(intake: Intake, action: "view" | "tier" = "view") {
    setBusyAction(`${action}:${intake.id}`);
    setMessage("");
    setUserDetailMessage("");
    try {
      const data = await api(`/users/${intake.id}/details`);
      const profileTier = stringValue(data.profile?.subscription_tier);
      const primaryMapping = Array.isArray(data.account_mappings) ? data.account_mappings[0] as LoginMapping | undefined : undefined;
      setSelectedUser(data);
      setSelectedDraft({
        full_name: data.profile?.full_name ?? intake.name,
        preferred_name: data.profile?.preferred_name ?? "",
        date_of_birth: data.profile?.date_of_birth ?? "",
        email: data.profile?.email ?? intake.email ?? primaryMapping?.login_email ?? "",
        phone_number: data.profile?.phone_number ?? intake.phone ?? primaryMapping?.login_phone ?? "",
        whatsapp_number: data.profile?.whatsapp_number ?? "",
        language: data.profile?.language ?? "es",
        timezone: data.profile?.timezone ?? "Europe/Madrid",
        caregiver_name: data.profile?.caregiver_name ?? "",
        caregiver_contact: data.profile?.caregiver_contact ?? "",
        tier: profileTier ?? intake.tier,
        organization_id: intake.organization_id ?? "",
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not open this user.");
    } finally {
      setBusyAction(null);
    }
  }

  async function saveUserDetail() {
    if (!selectedUser) return;
    setSavingUserDetail(true);
    setUserDetailMessage("");
    try {
      const data = await api(`/users/${selectedUser.intake.id}/profile`, {
        method: "PATCH",
        body: JSON.stringify({
          ...selectedDraft,
          sync_profile_ids: (selectedUser.account_mappings ?? [])
            .map((mapping) => mapping.effective_profile_id)
            .filter(Boolean),
          organization_id: selectedDraft.organization_id || null,
        }),
      });
      const syncedCount = Array.isArray(data.synced_profile_ids) ? data.synced_profile_ids.length : 1;
      const confirmation = `Changes saved${syncedCount > 1 ? ` across ${syncedCount} linked profiles` : ""}.`;
      setMessage(confirmation);
      setUserDetailMessage(confirmation);
      setSelectedUser({
        ...selectedUser,
        intake: data.intake,
        profile: data.profile,
        account_mappings: data.account_mappings ?? selectedUser.account_mappings,
        account_mapping_warnings: data.account_mapping_warnings ?? selectedUser.account_mapping_warnings,
        account_match_field: data.account_match_field ?? selectedUser.account_match_field,
        synced_profile_ids: data.synced_profile_ids ?? selectedUser.synced_profile_ids,
      });
      await refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not save user details.";
      setMessage(errorMessage);
      setUserDetailMessage(errorMessage);
    } finally {
      setSavingUserDetail(false);
    }
  }

  async function toggleUser(intake: Intake) {
    setBusyAction(`toggle:${intake.id}`);
    const disabled = intake.account_status === "disabled";
    try {
      await api(`/users/${intake.id}/${disabled ? "enable" : "disable"}`, {
        method: "POST",
        body: JSON.stringify({ reason: disabled ? "" : "Disabled by admin" }),
      });
      setMessage(disabled ? "User enabled." : "User disabled.");
      if (selectedUser?.intake.id === intake.id) await openUserDetail(intake);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update this user.");
    } finally {
      setBusyAction(null);
    }
  }

  async function deleteUser(intake: Intake) {
    const confirmed = window.confirm(`Permanently delete ${intake.name}? This removes the user from the admin panel and deletes linked VYVA profile records. This cannot be undone.`);
    if (!confirmed) return;
    setBusyAction(`delete:${intake.id}`);
    setUserDetailMessage("");
    try {
      await api(`/users/${intake.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (selectedUser?.intake.id === intake.id) setSelectedUser(null);
      setMessage("User deleted.");
      await refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not delete this user.";
      setMessage(errorMessage);
      setUserDetailMessage(errorMessage);
    } finally {
      setBusyAction(null);
    }
  }

  async function createScheduledEventForUser() {
    if (!selectedUser) return;
    if (!newEvent.title.trim()) {
      setUserDetailMessage("Add a title before creating the event.");
      return;
    }
    if (!newEvent.scheduled_for) {
      setUserDetailMessage("Select both date and time before creating the event.");
      return;
    }
    const { scheduled_date, scheduled_time, ...eventPayload } = newEvent;
    setUserDetailMessage("");
    try {
      await api(`/users/${selectedUser.intake.id}/scheduled-events`, {
        method: "POST",
        body: JSON.stringify(eventPayload),
      });
      setNewEvent(emptyScheduledEvent);
      await openUserDetail(selectedUser.intake);
      setUserDetailMessage("Scheduled event added.");
      setMessage("Scheduled event added.");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not add the scheduled event.";
      setUserDetailMessage(errorMessage);
      setMessage(errorMessage);
    }
  }

  async function setEventStatus(event: ScheduledEvent, action: "pause" | "resume" | "cancel") {
    if (event.read_only) return;
    setUserDetailMessage("");
    try {
      await api(`/scheduled-events/${event.id}/${action}`, { method: "POST" });
      if (selectedUser) await openUserDetail(selectedUser.intake);
      const confirmation = `Scheduled event ${action === "cancel" ? "cancelled" : action === "pause" ? "paused" : "resumed"}.`;
      setUserDetailMessage(confirmation);
      setMessage(confirmation);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not update the scheduled event.";
      setUserDetailMessage(errorMessage);
      setMessage(errorMessage);
    }
  }

  async function updateEventTime(event: ScheduledEvent, scheduledFor: string) {
    if (!selectedUser || event.read_only || !scheduledFor) return;
    setUserDetailMessage("");
    try {
      await api(`/scheduled-events/${event.id}`, {
        method: "PATCH",
        body: JSON.stringify({ scheduled_for: new Date(scheduledFor).toISOString() }),
      });
      await openUserDetail(selectedUser.intake);
      setUserDetailMessage("Scheduled event time updated.");
      setMessage("Scheduled event time updated.");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not update the scheduled event time.";
      setUserDetailMessage(errorMessage);
      setMessage(errorMessage);
    }
  }

  async function saveSupportSchedule(schedule: ScheduledSupport, draft: SupportScheduleDraft) {
    if (!selectedUser) return;
    if (!schedule.admin_edit_allowed) {
      setUserDetailMessage("User has not allowed admin edits for support schedules.");
      return;
    }
    setBusyAction(`support:${schedule.id}`);
    setUserDetailMessage("");
    try {
      await rootApi(`/api/schedules/${schedule.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          frequency_type: draft.frequency_type,
          days_of_week: draft.days_of_week,
          times_of_day: draft.times_of_day,
          timezone: draft.timezone,
          preferred_language: draft.preferred_language,
          quiet_hours_start: draft.quiet_hours_start,
          quiet_hours_end: draft.quiet_hours_end,
        }),
      });
      await openUserDetail(selectedUser.intake);
      setUserDetailMessage("Recurring support schedule updated.");
      setMessage("Recurring support schedule updated.");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not update the support schedule.";
      setUserDetailMessage(errorMessage);
      setMessage(errorMessage);
    } finally {
      setBusyAction(null);
    }
  }

  async function setSupportStatus(schedule: ScheduledSupport, action: "pause" | "resume") {
    if (!selectedUser) return;
    if (!schedule.admin_edit_allowed) {
      setUserDetailMessage("User has not allowed admin edits for support schedules.");
      return;
    }
    setBusyAction(`support-status:${schedule.id}`);
    setUserDetailMessage("");
    try {
      await rootApi(`/api/schedules/${schedule.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await openUserDetail(selectedUser.intake);
      const confirmation = `Recurring support schedule ${action === "pause" ? "paused" : "resumed"}.`;
      setUserDetailMessage(confirmation);
      setMessage(confirmation);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Could not update the support schedule.";
      setUserDetailMessage(errorMessage);
      setMessage(errorMessage);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleBulkFile(e: ChangeEvent<HTMLInputElement>, org: Organization) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessage("CSV is supported in v1. Excel support can be added next.");
      return;
    }
    const rows = csvToRows(await file.text());
    setBulkOrg(org);
    setBulkRows(rows);
    setBulkPreview(null);
    setMessage(`${rows.length} rows loaded. Preview before importing.`);
  }

  async function previewBulk() {
    if (!bulkOrg) return;
    const data = await api(`/organizations/${bulkOrg.id}/bulk-intakes/preview`, {
      method: "POST",
      body: JSON.stringify({ rows: bulkRows }),
    });
    setBulkPreview(data);
  }

  async function importBulk() {
    if (!bulkOrg) return;
    const data = await api(`/organizations/${bulkOrg.id}/bulk-intakes/import`, {
      method: "POST",
      body: JSON.stringify({ rows: bulkRows, send_links: sendBulkLinks }),
    });
    setMessage(`Imported ${data.summary.imported} users. Skipped ${data.summary.skipped}.`);
    setBulkOrg(null);
    setBulkRows([]);
    setBulkPreview(null);
    setSendBulkLinks(false);
    await refresh();
  }

  const visibleOrganizations = organizations.filter((org) => (
    orgFilter === "all" ? true : orgFilter === "active" ? org.is_active : !org.is_active
  ));
  const duplicateOrg = findDuplicateOrg(newOrg.name);
  const emailShareCount = parseInviteRecipients(signupShare.emails, looksLikeEmailRecipient).length;
  const whatsappShareCount = parseInviteRecipients(signupShare.whatsapp, looksLikePhoneRecipient).length;
  const totalShareRecipients = emailShareCount + whatsappShareCount;
  const planOptions = plans.length
    ? plans.map((plan) => ({ value: plan.plan_id, label: plan.name }))
    : tiers.map((tier) => ({ value: tier, label: tier[0].toUpperCase() + tier.slice(1) }));
  const creatingFamilyIntake = newIntake.user_type === "family";
  const canCreateIntake = Boolean(
    newIntake.first_name.trim()
      && newIntake.last_name.trim()
      && newIntake.phone.trim()
      && (!creatingFamilyIntake || (
        newIntake.elder_first_name.trim()
        && newIntake.elder_last_name.trim()
        && newIntake.elder_phone.trim()
      ))
  );

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-4 py-4 text-[#2f2135] sm:px-6">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Lifecycle"
          subtitle="People, forms, access."
        >
          <button className="rounded-xl bg-purple-700 px-4 py-2 text-sm font-bold text-white" onClick={() => refresh().catch((err) => setMessage(err.message))}>Refresh</button>
          {message && <span className="rounded-xl bg-purple-50 px-3 py-2 text-sm font-bold text-purple-800">{message}</span>}
        </AdminPageHeader>

        <AdminMenu />

        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          {[
            ["Total", summary?.total ?? 0],
            ["Active", summary?.active ?? 0],
            ["Consent", summary?.pendingConsent ?? 0],
            ["Dropped", summary?.dropped ?? 0],
            ["Links sent", summary?.byStatus?.link_sent ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[#eadfd5] bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#8b7a73]">{label}</p>
              <p className="mt-1 text-2xl font-black leading-none">{String(value)}</p>
            </div>
          ))}
        </div>

        <nav className="mt-3 flex flex-wrap gap-2">
          {adminTabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`rounded-xl px-4 py-2 text-sm font-bold shadow-sm ${activeTab === tab.id ? "bg-purple-700 text-white" : "border border-purple-100 bg-white text-purple-700 hover:bg-purple-50"}`}>
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "users" && (
          <div className="mt-3 grid gap-4">
            <section className="rounded-2xl border border-[#eadfd5] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-3xl leading-tight">Share signup invite</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#7d6b65]">Send the public VYVA invite by email or WhatsApp. Add one recipient per line, with an optional name before the contact.</p>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-purple-50 p-1 pl-4 text-sm font-bold text-purple-700">
                  <span>v2.vyva.life/invite</span>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-1 rounded-full bg-white px-3 text-xs font-black text-purple-700 shadow-sm"
                    onClick={copySignupLink}
                  >
                    <Copy size={14} />
                    {copiedSignupLink ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-[#eadfd5] bg-[#fffaf5] p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-black text-[#4d4351]">Email recipients</p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-purple-700">{emailShareCount}</span>
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-purple-100 bg-white px-3 py-1 text-xs font-black text-purple-700 shadow-sm hover:bg-purple-50">
                          <Upload size={13} />
                          Upload
                          <input
                            type="file"
                            accept=".csv,.txt,text/csv,text/plain"
                            className="hidden"
                            onChange={uploadEmailRecipients}
                          />
                        </label>
                      </div>
                    </div>
                    <textarea
                      className="min-h-36 w-full resize-y rounded-2xl border border-[#e7dbd0] bg-white px-4 py-3 text-sm leading-relaxed outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                      placeholder="Maria Gomez, maria@example.com&#10;maria@example.com"
                      value={signupShare.emails}
                      onChange={(e) => setSignupShare({ ...signupShare, emails: e.target.value })}
                    />
                  </div>

                  <div className="rounded-[24px] border border-[#eadfd5] bg-[#fffaf5] p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-black text-[#4d4351]">WhatsApp numbers</p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-purple-700">{whatsappShareCount}</span>
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-purple-100 bg-white px-3 py-1 text-xs font-black text-purple-700 shadow-sm hover:bg-purple-50">
                          <Upload size={13} />
                          Upload
                          <input
                            type="file"
                            accept=".csv,.txt,text/csv,text/plain"
                            className="hidden"
                            onChange={uploadWhatsappRecipients}
                          />
                        </label>
                      </div>
                    </div>
                    <textarea
                      className="min-h-36 w-full resize-y rounded-2xl border border-[#e7dbd0] bg-white px-4 py-3 text-sm leading-relaxed outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                      placeholder="+34 612 345 678&#10;+44 7700 900123"
                      value={signupShare.whatsapp}
                      onChange={(e) => setSignupShare({ ...signupShare, whatsapp: e.target.value })}
                      onBlur={(e) => {
                        const normalized = normalizeWhatsappRecipientText(e.target.value);
                        if (normalized !== e.target.value.trim()) {
                          setSignupShare((current) => ({ ...current, whatsapp: normalized }));
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_220px] xl:grid-cols-1">
                  <div className="rounded-[24px] border border-[#eadfd5] bg-white p-4">
                    <Field label="Message override">
                      <textarea
                        className="min-h-28 w-full rounded-2xl border border-[#e7dbd0] px-4 py-3 text-sm leading-relaxed outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                        placeholder="Leave blank to use the selected language's default invite text."
                        value={signupShare.message}
                        onChange={(e) => setSignupShare({ ...signupShare, message: e.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="rounded-[24px] bg-[#f7efff] p-4">
                    <Field label="Invite language">
                      <select className="w-full rounded-2xl border border-[#e4d8ce] bg-white px-4 py-3 text-sm font-black text-[#2f2135]" value={signupShare.language} onChange={(e) => setSignupShare({ ...signupShare, language: e.target.value })}>
                        {languageOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </Field>
                    <button
                      type="button"
                      className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-purple-700 px-5 py-3 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={sharingSignup || totalShareRecipients === 0}
                      onClick={shareSignupForm}
                    >
                      <Send size={16} />
                      {sharingSignup ? "Sending..." : totalShareRecipients > 0 ? `Send to ${totalShareRecipients}` : "Add recipients"}
                    </button>
                    <p className="mt-3 text-xs leading-relaxed text-[#7d6b65]">Delivery is attempted immediately and logged in Communications.</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-serif text-2xl">People</h2>
                  <p className="mt-1 text-sm text-[#7d6b65]">Signup, onboarding, consent, status, and organization visibility.</p>
                </div>
                {peopleSearch && (
                  <span className="rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
                    Search: {peopleSearch}
                  </span>
                )}
              </div>

              <form
                className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  setPeopleSearch(peopleSearchInput.trim());
                }}
              >
                <input
                  className="rounded-xl border border-[#e4d8ce] px-3 py-2.5 text-sm font-semibold"
                  value={peopleSearchInput}
                  onChange={(event) => setPeopleSearchInput(event.target.value)}
                  placeholder="Search by name, phone, profile email, or login email"
                />
                <button type="submit" className="rounded-xl bg-[#2f2135] px-4 py-2.5 text-sm font-bold text-white">
                  Search people
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-purple-100 bg-white px-4 py-2.5 text-sm font-bold text-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!peopleSearch && !peopleSearchInput}
                  onClick={() => {
                    setPeopleSearchInput("");
                    setPeopleSearch("");
                  }}
                >
                  Clear
                </button>
              </form>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                {[
                  ["entry_point", entryPoints],
                  ["user_type", userTypes],
                  ["status", statuses],
                  ["tier", ["", ...planOptions.map((plan) => plan.value)]],
                ].map(([key, values]) => (
                  <select key={key as keyof typeof filters} className="rounded-xl border border-[#e4d8ce] px-3 py-2.5 text-sm font-semibold" value={filters[key as keyof typeof filters]} onChange={(e) => setFilters((prev) => ({ ...prev, [key as keyof typeof filters]: e.target.value }))}>
                    {(values as string[]).map((value) => <option key={value} value={value}>{value || String(key).replace("_", " ")}</option>)}
                  </select>
                ))}
              </div>
              <IntakeTable users={users} onView={(intake) => openUserDetail(intake, "view")} onTriggerConsent={triggerConsent} onToggleEnabled={toggleUser} onDelete={deleteUser} busyAction={busyAction} />
            </section>
          </div>
        )}

        {activeTab === "accounts" && (
          <AccountSubscriptionsSection
            accounts={accountSubscriptions}
            message={accountSearchMessage}
            planOptions={planOptions}
            search={accountSearch}
            savingProfileId={savingAccountProfileId}
            repairingProfileId={repairingAccountProfileId}
            onSearchChange={setAccountSearch}
            onSearch={() => searchAccountSubscriptions().catch((err) => setAccountSearchMessage(err.message))}
            onChange={updateAccountSubscription}
            onSave={saveAccountSubscription}
            onRepair={repairAccountSubscription}
          />
        )}

        {activeTab === "invites" && (
          <section className="mt-5 grid gap-5 lg:grid-cols-[420px_1fr]">
            <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-5">
              <h2 className="font-serif text-3xl">Create intake</h2>
              <p className="mt-2 text-sm text-[#7d6b65]">{creatingFamilyIntake ? "Family contact first, then the elder who needs consent." : "Basic profile details, matching the user settings form."}</p>
              <div className="mt-4 grid gap-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="First name" required><input className="w-full rounded-2xl border px-4 py-3" value={newIntake.first_name} onChange={(e) => setNewIntake({ ...newIntake, first_name: e.target.value })} /></Field>
                  <Field label="Last name" required><input className="w-full rounded-2xl border px-4 py-3" value={newIntake.last_name} onChange={(e) => setNewIntake({ ...newIntake, last_name: e.target.value })} /></Field>
                </div>
                <Field label="Preferred name" optional><input className="w-full rounded-2xl border px-4 py-3" value={newIntake.preferred_name} onChange={(e) => setNewIntake({ ...newIntake, preferred_name: e.target.value })} /></Field>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Date of birth" optional><input className="w-full rounded-2xl border px-4 py-3" type="date" value={newIntake.date_of_birth} onChange={(e) => setNewIntake({ ...newIntake, date_of_birth: e.target.value })} /></Field>
                  <Field label="Gender" optional>
                    <select className="w-full rounded-2xl border px-4 py-3" value={newIntake.gender} onChange={(e) => setNewIntake({ ...newIntake, gender: e.target.value })}>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="non_binary">Non-binary</option>
                    </select>
                  </Field>
                </div>
                <Field label="Phone number" required>
                  <div className="grid grid-cols-[120px_1fr] gap-2">
                    <select className="rounded-2xl border px-3 py-3" value={newIntake.country_code} onChange={(e) => setNewIntake({ ...newIntake, country_code: e.target.value })}>{countryCodeOptions.map((value) => <option key={value}>{value}</option>)}</select>
                    <input className="rounded-2xl border px-4 py-3" placeholder="612 345 678" value={newIntake.phone} onChange={(e) => setNewIntake({ ...newIntake, phone: e.target.value })} />
                  </div>
                </Field>
                <Field label="WhatsApp, if different" optional><input className="w-full rounded-2xl border px-4 py-3" placeholder="Leave blank if same as phone" value={newIntake.whatsapp} onChange={(e) => setNewIntake({ ...newIntake, whatsapp: e.target.value })} /></Field>
                <Field label="Email" optional><input className="w-full rounded-2xl border px-4 py-3" placeholder="name@example.com" value={newIntake.email} onChange={(e) => setNewIntake({ ...newIntake, email: e.target.value })} /></Field>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Language" optional><select className="w-full rounded-2xl border px-4 py-3" value={newIntake.language} onChange={(e) => setNewIntake({ ...newIntake, language: e.target.value })}>{languageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
                  <Field label="Timezone" optional><select className="w-full rounded-2xl border px-4 py-3" value={newIntake.timezone} onChange={(e) => setNewIntake({ ...newIntake, timezone: e.target.value })}>{timezoneOptions.map((value) => <option key={value}>{value}</option>)}</select></Field>
                </div>
                <select className="rounded-2xl border px-4 py-3" value={newIntake.user_type} onChange={(e) => setNewIntake({ ...newIntake, user_type: e.target.value })}>{userTypes.filter(Boolean).map((v) => <option key={v}>{v}</option>)}</select>
                {creatingFamilyIntake && (
                  <div className="rounded-3xl border border-purple-100 bg-purple-50 p-4">
                    <p className="font-bold text-purple-900">Elder details for consent</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <Field label="Elder first name" required><input className="w-full rounded-2xl border px-4 py-3" value={newIntake.elder_first_name} onChange={(e) => setNewIntake({ ...newIntake, elder_first_name: e.target.value })} /></Field>
                      <Field label="Elder last name" required><input className="w-full rounded-2xl border px-4 py-3" value={newIntake.elder_last_name} onChange={(e) => setNewIntake({ ...newIntake, elder_last_name: e.target.value })} /></Field>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <Field label="Elder phone" required><input className="w-full rounded-2xl border px-4 py-3" placeholder="+34 612 345 678" value={newIntake.elder_phone} onChange={(e) => setNewIntake({ ...newIntake, elder_phone: e.target.value })} /></Field>
                      <Field label="Elder email" optional><input className="w-full rounded-2xl border px-4 py-3" placeholder="elder@example.com" value={newIntake.elder_email} onChange={(e) => setNewIntake({ ...newIntake, elder_email: e.target.value })} /></Field>
                    </div>
                  </div>
                )}
                <select className="rounded-2xl border px-4 py-3" value={newIntake.entry_point} onChange={(e) => setNewIntake({ ...newIntake, entry_point: e.target.value })}>{entryPoints.filter(Boolean).map((v) => <option key={v}>{v}</option>)}</select>
                <select className="rounded-2xl border px-4 py-3" value={newIntake.tier} onChange={(e) => setNewIntake({ ...newIntake, tier: e.target.value })}>{planOptions.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}</select>
                <select className="rounded-2xl border px-4 py-3" value={newIntake.organization_id} onChange={(e) => setNewIntake({ ...newIntake, organization_id: e.target.value })}>
                  <option value="">No organization</option>
                  {organizations.filter((org) => org.is_active).map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
                <button className="rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={!canCreateIntake} onClick={createIntake}>Create intake</button>
              </div>
            </div>
            <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-5">
              <h2 className="font-serif text-3xl">Recent lifecycle users</h2>
              <IntakeTable users={users.slice(0, 8)} onView={(intake) => openUserDetail(intake, "view")} onTriggerConsent={triggerConsent} onToggleEnabled={toggleUser} onDelete={deleteUser} busyAction={busyAction} compact />
            </div>
          </section>
        )}

        {activeTab === "consent" && (
          <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
            <h2 className="font-serif text-3xl">Consent queue</h2>
            <div className="mt-4 grid gap-3">
              {consentAttempts.map((attempt) => (
                <div key={attempt.id} className="rounded-3xl border border-[#eadfd5] p-4">
                  <p className="font-bold">{attempt.intake?.name ?? "Unknown intake"} - attempt {attempt.attempt_number}</p>
                  <p className="text-sm text-[#7d6b65]">{attempt.status} - {attempt.channel} - {new Date(attempt.created_at).toLocaleString()}</p>
                  <div className="mt-3 flex flex-wrap gap-2">{["approved", "rejected", "no_answer"].map((status) => <button key={status} className="rounded-full border px-4 py-2 font-bold" onClick={() => markConsent(attempt, status)}>Mark {status}</button>)}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "organizations" && (
          <section className="mt-5 grid gap-5 lg:grid-cols-[420px_1fr]">
            <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-5">
              <h2 className="font-serif text-3xl">New organization</h2>
              <input className="mt-4 w-full rounded-2xl border px-4 py-3" placeholder="Organization name" value={newOrg.name} onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })} />
              <Field label="Default tier for new org users">
                <select className="w-full rounded-2xl border px-4 py-3" value={newOrg.default_tier} onChange={(e) => setNewOrg({ ...newOrg, default_tier: e.target.value })}>{planOptions.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}</select>
              </Field>
              {duplicateOrg && (
                <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
                  {duplicateOrg.name} already exists and is {duplicateOrg.is_active ? "active" : "archived"}. Use that organization or restore it instead of creating another copy.
                </p>
              )}
              <button
                className="mt-3 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!newOrg.name.trim() || Boolean(duplicateOrg)}
                onClick={createOrg}
              >
                Create organization
              </button>
              <p className="mt-4 text-sm text-[#7d6b65]">Bulk upload requires CSV. Columns: first_name, last_name, phone. Optional: preferred_name, date_of_birth, gender, whatsapp, email, language, timezone, user_type, tier.</p>
            </div>
            <div className="rounded-[2rem] border border-[#eadfd5] bg-white p-5">
              <div className="mb-4 flex gap-2">
                {(["active", "archived", "all"] as const).map((value) => <button key={value} onClick={() => setOrgFilter(value)} className={`rounded-full px-4 py-2 font-bold ${orgFilter === value ? "bg-purple-700 text-white" : "border text-purple-700"}`}>{value}</button>)}
              </div>
              {visibleOrganizations.map((org) => {
                const isEditing = editingOrgId === org.id;
                const duplicateEditOrg = isEditing ? findDuplicateOrg(orgDraft.name, org.id) : null;
                const canSaveOrg = Boolean(orgDraft.name.trim()) && !duplicateEditOrg;

                return (
                  <div key={org.id} className="mb-3 rounded-3xl border p-4">
                    {isEditing ? (
                      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                        <Field label="Organization name">
                          <input className="w-full rounded-2xl border px-4 py-3" value={orgDraft.name} onChange={(e) => setOrgDraft({ ...orgDraft, name: e.target.value })} />
                        </Field>
                        <Field label="Default tier for new users">
                          <select className="w-full rounded-2xl border px-4 py-3" value={orgDraft.default_tier} onChange={(e) => setOrgDraft({ ...orgDraft, default_tier: e.target.value })}>{planOptions.map((plan) => <option key={plan.value} value={plan.value}>{plan.label}</option>)}</select>
                        </Field>
                        {duplicateEditOrg && (
                          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 md:col-span-2">
                            {duplicateEditOrg.name} already exists and is {duplicateEditOrg.is_active ? "active" : "archived"}. Choose a different name.
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="font-bold">{org.name}</p>
                        <p className="text-sm text-[#7d6b65]">{org.slug} - default tier: {org.default_tier} - {org.is_active ? "Active" : "Archived"}</p>
                      </>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {isEditing ? (
                        <>
                          <button className="rounded-full bg-purple-700 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!canSaveOrg} onClick={() => saveOrg(org)}>Save changes</button>
                          <button className="rounded-full border px-4 py-2 font-bold" onClick={cancelEditOrg}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="rounded-full border px-4 py-2 font-bold" onClick={() => startEditOrg(org)}>Edit organization</button>
                          {org.is_active ? (
                            <>
                              <label className="cursor-pointer rounded-full bg-purple-50 px-4 py-2 font-bold text-purple-700">
                                Upload users
                                <input type="file" accept=".csv" className="hidden" onChange={(e) => handleBulkFile(e, org)} />
                              </label>
                              <button className="rounded-full border px-4 py-2 font-bold" onClick={() => archiveOrg(org)}>Archive organization</button>
                            </>
                          ) : (
                            <button className="rounded-full border px-4 py-2 font-bold" onClick={() => restoreOrg(org)}>Restore organization</button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {bulkOrg && (
          <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5">
            <h2 className="font-serif text-3xl">Bulk onboarding for {bulkOrg.name}</h2>
            <p className="mt-1 text-sm text-[#7d6b65]">{bulkRows.length} CSV rows loaded. Preview before importing.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 rounded-full border px-4 py-2 font-bold"><input type="checkbox" checked={sendBulkLinks} onChange={(e) => setSendBulkLinks(e.target.checked)} /> Send app links after import</label>
              <button className="rounded-full bg-purple-700 px-4 py-2 font-bold text-white" onClick={previewBulk}>Preview rows</button>
              <button className="rounded-full border px-4 py-2 font-bold" onClick={() => setBulkOrg(null)}>Close</button>
            </div>
            {bulkPreview && (
              <>
                <p className="mt-4 font-bold">{bulkPreview.summary.valid} valid, {bulkPreview.summary.invalid} need attention.</p>
                <div className="mt-3 max-h-[360px] overflow-auto">
                  <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
                    <thead><tr className="text-left uppercase text-[#8b7a73]"><th>Row</th><th>Name</th><th>Phone</th><th>Status</th><th>Errors</th></tr></thead>
                    <tbody>{bulkPreview.rows.map((row) => <tr key={row.row_number} className="bg-[#fbf8f5]"><td className="rounded-l-2xl p-3">{row.row_number}</td><td>{row.values.name}</td><td>{row.values.phone}</td><td>{row.valid ? "Valid" : "Fix needed"}</td><td className="rounded-r-2xl p-3 text-red-700">{row.errors.join(", ")}</td></tr>)}</tbody>
                  </table>
                </div>
                <button className="mt-4 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={bulkPreview.summary.valid === 0} onClick={importBulk}>Import valid rows</button>
              </>
            )}
          </section>
        )}

        {activeTab === "tiers" && <TierSection plans={plans} setPlans={setPlans} onSave={savePlan} />}
        {activeTab === "communications" && <CommunicationsSection communications={communications} />}
        {activeTab === "analytics" && <AnalyticsSection summary={summary} />}
      </section>

      {selectedUser && (
        <UserDetailModal
          detail={selectedUser}
          draft={selectedDraft}
          setDraft={setSelectedDraft}
          organizations={organizations}
          planOptions={planOptions}
          statusMessage={userDetailMessage}
          saving={savingUserDetail}
          scheduleBusyAction={busyAction}
          deleting={busyAction === `delete:${selectedUser.intake.id}`}
          onClose={() => setSelectedUser(null)}
          onSave={saveUserDetail}
          onToggle={() => toggleUser(selectedUser.intake)}
          onDelete={() => deleteUser(selectedUser.intake)}
          newEvent={newEvent}
          setNewEvent={setNewEvent}
          onCreateEvent={createScheduledEventForUser}
          onEventStatus={setEventStatus}
          onEventTime={updateEventTime}
          onSupportSave={saveSupportSchedule}
          onSupportStatus={setSupportStatus}
        />
      )}
      {signupShareNotice && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#2f2135]/45 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="signup-share-result-title">
          <div className="w-full max-w-lg rounded-[2rem] border border-[#eadfd5] bg-white p-6 text-[#2f2135] shadow-[0_24px_80px_rgba(47,33,53,0.28)]">
            <p className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.08em] ${
              signupShareNotice.tone === "success"
                ? "bg-emerald-50 text-emerald-800"
                : signupShareNotice.tone === "warning"
                  ? "bg-amber-50 text-amber-800"
                  : "bg-red-50 text-red-700"
            }`}>
              {signupShareNotice.tone === "success" ? "Sent" : signupShareNotice.tone === "warning" ? "Partially sent" : "Failed"}
            </p>
            <h2 id="signup-share-result-title" className="mt-3 font-serif text-3xl leading-tight">{signupShareNotice.title}</h2>
            {signupShareNotice.details.length > 0 && (
              <ul className="mt-4 max-h-56 space-y-2 overflow-auto rounded-2xl bg-[#fbf8f5] p-3 text-sm font-semibold text-[#5f514b]">
                {signupShareNotice.details.map((detail, index) => (
                  <li key={`${detail}-${index}`}>{detail}</li>
                ))}
              </ul>
            )}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-2xl border border-[#eadfd5] bg-white px-5 py-3 text-sm font-bold text-[#2f2135] hover:border-purple-200 hover:text-purple-700"
                onClick={() => {
                  setSignupShareNotice(null);
                  setActiveTab("communications");
                }}
              >
                View communications
              </button>
              <button
                type="button"
                className="rounded-2xl bg-purple-700 px-5 py-3 text-sm font-bold text-white hover:bg-purple-800"
                onClick={() => setSignupShareNotice(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
