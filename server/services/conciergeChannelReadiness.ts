import {
  CONCIERGE_PRODUCTION_CHANNELS,
  evaluateConciergeChannelReadiness,
  conciergeToolForProductionChannel,
  type ConciergeChannelProbeState,
  type ConciergeChannelProbeStatus,
  type ConciergeChannelReadinessFlags,
  type ConciergeChannelReadinessResult,
  type ConciergeProductionChannel,
} from "../../shared/conciergeChannelReadiness.js";
import type { ConciergeToolRequirement } from "../../shared/conciergeFlowRegistry.js";
import { pool } from "../db.js";
import { runConciergeActionAdapterProbe } from "./conciergeActionAdapters.js";
import {
  ownedConciergeEmailAdapterBlockers,
  ownedConciergeEmailAdapterConfigured,
  ownedConciergeEmailAdapterReference,
} from "./conciergeEmailAdapter.js";

const OUTBOUND_AGENT_ENV_KEYS = [
  "ELEVENLABS_CONCIERGE_CALLER_AGENT_ID",
  "ELEVENLABS_CONCIERGE_OUTBOUND_AGENT_ID",
  "ELEVENLABS_OUTBOUND_AGENT_ID",
];

const OUTBOUND_PHONE_ENV_KEYS = [
  "ELEVENLABS_CONCIERGE_PHONE_NUMBER_ID",
  "ELEVENLABS_AGENT_PHONE_NUMBER_ID",
];

const QA_TARGET_ENV_KEYS: Record<ConciergeProductionChannel, string[]> = {
  phone_call: [
    "CONCIERGE_PHONE_CALL_QA_ENDPOINT",
    "CONCIERGE_PHONE_CALL_QA_PHONE_NUMBER",
    "CONCIERGE_CHANNEL_PHONE_CALL_QA_ENDPOINT",
    "CONCIERGE_CHANNEL_PHONE_CALL_QA_PHONE_NUMBER",
  ],
  email: [
    "CONCIERGE_EMAIL_QA_ENDPOINT",
    "CONCIERGE_EMAIL_QA_RECIPIENT",
    "CONCIERGE_CHANNEL_EMAIL_QA_ENDPOINT",
    "CONCIERGE_CHANNEL_EMAIL_QA_RECIPIENT",
  ],
  whatsapp: [
    "CONCIERGE_WHATSAPP_QA_ENDPOINT",
    "CONCIERGE_WHATSAPP_QA_PHONE_NUMBER",
    "CONCIERGE_CHANNEL_WHATSAPP_QA_ENDPOINT",
    "CONCIERGE_CHANNEL_WHATSAPP_QA_PHONE_NUMBER",
  ],
  form_application: [
    "CONCIERGE_FORM_APPLICATION_QA_ENDPOINT",
    "CONCIERGE_FORM_APPLICATION_QA_URL",
    "CONCIERGE_CHANNEL_FORM_APPLICATION_QA_ENDPOINT",
    "CONCIERGE_CHANNEL_FORM_APPLICATION_QA_URL",
  ],
  document_upload: [
    "CONCIERGE_DOCUMENT_UPLOAD_QA_ENDPOINT",
    "CONCIERGE_DOCUMENT_UPLOAD_QA_URL",
    "CONCIERGE_CHANNEL_DOCUMENT_UPLOAD_QA_ENDPOINT",
    "CONCIERGE_CHANNEL_DOCUMENT_UPLOAD_QA_URL",
  ],
};

const LIVE_ENDPOINT_ENV_KEYS: Record<Exclude<ConciergeProductionChannel, "phone_call">, string[]> = {
  email: [
    "CONCIERGE_EMAIL_LIVE_ENDPOINT",
    "CONCIERGE_EMAIL_ADAPTER_ENDPOINT",
    "CONCIERGE_CHANNEL_EMAIL_LIVE_ENDPOINT",
  ],
  whatsapp: [
    "CONCIERGE_WHATSAPP_LIVE_ENDPOINT",
    "CONCIERGE_WHATSAPP_ADAPTER_ENDPOINT",
    "CONCIERGE_CHANNEL_WHATSAPP_LIVE_ENDPOINT",
  ],
  form_application: [
    "CONCIERGE_FORM_APPLICATION_LIVE_ENDPOINT",
    "CONCIERGE_FORM_APPLICATION_ADAPTER_ENDPOINT",
    "CONCIERGE_CHANNEL_FORM_APPLICATION_LIVE_ENDPOINT",
  ],
  document_upload: [
    "CONCIERGE_DOCUMENT_UPLOAD_LIVE_ENDPOINT",
    "CONCIERGE_DOCUMENT_UPLOAD_ADAPTER_ENDPOINT",
    "CONCIERGE_CHANNEL_DOCUMENT_UPLOAD_LIVE_ENDPOINT",
  ],
};

type StoredProbeStatus = Exclude<ConciergeChannelProbeStatus, "not_run">;

type AdapterSetupSource = "environment" | "admin_console" | "missing";

type StoredChannelReadinessRow = {
  channel: string;
  admin_enabled: boolean;
  verified: boolean;
  notes: string | null;
  last_probe_status?: string | null;
  last_probe_at?: Date | string | null;
  last_probe_blocker?: string | null;
  last_probe_by?: string | null;
  adapter_live_endpoint_url?: string | null;
  adapter_credential_reference?: string | null;
  adapter_qa_target?: string | null;
  adapter_configured_by?: string | null;
  adapter_configured_at?: Date | string | null;
  updated_by: string | null;
  updated_at: Date | string | null;
};

type StoredChannelReadinessSetting = {
  adminEnabled: boolean;
  verified: boolean;
  notes: string | null;
  lastProbeStatus: StoredProbeStatus | null;
  lastProbeAt: string | null;
  lastProbeBlocker: string | null;
  lastProbeBy: string | null;
  adapterLiveEndpointUrl: string | null;
  adapterCredentialReference: string | null;
  adapterQaTarget: string | null;
  adapterConfiguredBy: string | null;
  adapterConfiguredAt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type AdminConciergeChannelAdapterSetup = {
  version: 1;
  configured: boolean;
  source: AdapterSetupSource;
  live_endpoint_configured: boolean;
  live_endpoint_url: string | null;
  live_endpoint_reference: string | null;
  credential_reference: string | null;
  qa_target_configured: boolean;
  qa_target: string | null;
  qa_target_reference: string | null;
  blockers: string[];
  updated_by: string | null;
  updated_at: string | null;
};

export type AdminConciergeChannelReadinessRow = {
  channel: ConciergeProductionChannel;
  label: string;
  tool: ConciergeToolRequirement;
  test_mode: ConciergeChannelReadinessResult;
  live: ConciergeChannelReadinessResult;
  configured: boolean;
  verified: boolean;
  admin_enabled: boolean;
  ready: boolean;
  external_action_allowed: boolean;
  blockers: string[];
  adapter_setup: AdminConciergeChannelAdapterSetup;
  can_mark_ready: boolean;
  ready_blocker: string | null;
  probe: ConciergeChannelProbeState;
  notes: string | null;
  updated_by: string | null;
  updated_at: string | null;
};

export type AdminConciergeChannelReadinessSnapshot = {
  channels: AdminConciergeChannelReadinessRow[];
  generated_at: string;
};

function envValue(key: string): string {
  return process.env[key]?.trim() ?? "";
}

function anyEnv(keys: string[]): boolean {
  return keys.some((key) => Boolean(envValue(key)));
}

function firstEnvValue(keys: string[]): string {
  for (const key of keys) {
    const value = envValue(key);
    if (value) return value;
  }
  return "";
}

function firstEnvKey(keys: string[]): string | null {
  for (const key of keys) {
    if (envValue(key)) return key;
  }
  return null;
}

function envFlag(keys: string[]): boolean {
  return keys.some((key) => {
    const value = envValue(key).toLowerCase();
    return value === "1" || value === "true" || value === "yes" || value === "ready" || value === "enabled";
  });
}

function isConciergeProductionChannel(value: string): value is ConciergeProductionChannel {
  return CONCIERGE_PRODUCTION_CHANNELS.some((channel) => channel.id === value);
}

function dateToIso(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function isPhoneChannelFullyConfigured(): boolean {
  return Boolean(envValue("ELEVENLABS_API_KEY"))
    && anyEnv(OUTBOUND_AGENT_ENV_KEYS)
    && anyEnv(OUTBOUND_PHONE_ENV_KEYS);
}

function liveEndpointEnvKey(channel: ConciergeProductionChannel): string | null {
  if (channel === "phone_call") return null;
  return firstEnvKey(LIVE_ENDPOINT_ENV_KEYS[channel]);
}

function qaTargetEnvKey(channel: ConciergeProductionChannel): string | null {
  return firstEnvKey(QA_TARGET_ENV_KEYS[channel]);
}

function adapterLiveEndpointUrl(channel: ConciergeProductionChannel, setting?: StoredChannelReadinessSetting): string | null {
  if (channel === "phone_call") return null;
  return cleanText(setting?.adapterLiveEndpointUrl) ?? cleanText(firstEnvValue(LIVE_ENDPOINT_ENV_KEYS[channel]));
}

function isAdminLiveEndpointUrlAllowed(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.username || url.password) return false;
    for (const key of url.searchParams.keys()) {
      if (/(token|secret|password|passwd|api[-_]?key|signature|auth|credential)/i.test(key)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isCredentialReferenceAllowed(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) return false;
  if (/(bearer\s+|sk-|xox[baprs]-|-----BEGIN|password=|secret=|api[_-]?key=)/i.test(trimmed)) return false;
  return /^[A-Za-z0-9_:/@.-]+$/.test(trimmed);
}

function normalizeAdapterLiveEndpointUrl(channel: ConciergeProductionChannel, value: string | null | undefined): string | null {
  const endpoint = cleanText(value);
  if (!endpoint) return null;
  if (channel === "phone_call") {
    throw new Error("Phone calls use the ElevenLabs credential reference instead of a live adapter endpoint URL.");
  }
  if (!isAdminLiveEndpointUrlAllowed(endpoint)) {
    throw new Error("Use an http(s) adapter endpoint URL without embedded credentials or secret query parameters.");
  }
  return endpoint;
}

function normalizeCredentialReference(value: string | null | undefined): string | null {
  const reference = cleanText(value);
  if (!reference) return null;
  if (!isCredentialReferenceAllowed(reference)) {
    throw new Error("Credential setup must be a reference name only, not a secret value.");
  }
  return reference;
}

function normalizeQaTarget(value: string | null | undefined): string | null {
  return cleanText(value);
}

function adapterSetupForChannel(
  channel: ConciergeProductionChannel,
  setting?: StoredChannelReadinessSetting,
): AdminConciergeChannelAdapterSetup {
  const endpointEnvKey = liveEndpointEnvKey(channel);
  const qaEnvKey = qaTargetEnvKey(channel);
  const storedEndpoint = cleanText(setting?.adapterLiveEndpointUrl);
  const storedCredentialReference = cleanText(setting?.adapterCredentialReference);
  const storedQaTarget = cleanText(setting?.adapterQaTarget);
  const phoneConfigured = isPhoneChannelFullyConfigured();
  const ownedEmailConfigured = channel === "email" && ownedConciergeEmailAdapterConfigured();
  const ownedEmailReference = channel === "email" ? ownedConciergeEmailAdapterReference() : null;
  const endpointConfigured = channel === "phone_call" ? false : Boolean(storedEndpoint || endpointEnvKey);
  const configured = channel === "phone_call" ? phoneConfigured : endpointConfigured || ownedEmailConfigured;
  const source: AdapterSetupSource = configured
    ? (storedEndpoint ? "admin_console" : "environment")
    : "missing";
  const blockers: string[] = [];

  if (!configured) {
    blockers.push(channel === "phone_call"
      ? "ElevenLabs API key, caller agent, and phone number references are not fully configured."
      : channel === "email" && ownedEmailReference
        ? ownedConciergeEmailAdapterBlockers().join(" ")
        : "Live adapter endpoint is not configured.");
  }

  return {
    version: 1,
    configured,
    source,
    live_endpoint_configured: endpointConfigured || ownedEmailConfigured,
    live_endpoint_url: storedEndpoint,
    live_endpoint_reference: storedEndpoint ?? endpointEnvKey ?? ownedEmailReference,
    credential_reference: storedCredentialReference ?? (phoneConfigured ? "ELEVENLABS_API_KEY" : ownedEmailConfigured ? "RESEND_API_KEY" : null),
    qa_target_configured: Boolean(storedQaTarget || qaEnvKey),
    qa_target: storedQaTarget,
    qa_target_reference: storedQaTarget ?? qaEnvKey,
    blockers,
    updated_by: setting?.adapterConfiguredBy ?? null,
    updated_at: setting?.adapterConfiguredAt ?? null,
  };
}

function normalizeProbeStatus(value: string | null | undefined): StoredProbeStatus | null {
  return value === "pass" || value === "fail" ? value : null;
}

function normalizeSettingsRows(rows: StoredChannelReadinessRow[]): Partial<Record<ConciergeProductionChannel, StoredChannelReadinessSetting>> {
  const settings: Partial<Record<ConciergeProductionChannel, StoredChannelReadinessSetting>> = {};
  rows.forEach((row) => {
    if (!isConciergeProductionChannel(row.channel)) return;
    const lastProbeStatus = normalizeProbeStatus(row.last_probe_status);
    settings[row.channel] = {
      adminEnabled: row.admin_enabled === true,
      verified: lastProbeStatus === "pass",
      notes: row.notes ?? null,
      lastProbeStatus,
      lastProbeAt: dateToIso(row.last_probe_at ?? null),
      lastProbeBlocker: row.last_probe_blocker ?? null,
      lastProbeBy: row.last_probe_by ?? null,
      adapterLiveEndpointUrl: row.adapter_live_endpoint_url ?? null,
      adapterCredentialReference: row.adapter_credential_reference ?? null,
      adapterQaTarget: row.adapter_qa_target ?? null,
      adapterConfiguredBy: row.adapter_configured_by ?? null,
      adapterConfiguredAt: dateToIso(row.adapter_configured_at ?? null),
      updatedBy: row.updated_by ?? null,
      updatedAt: dateToIso(row.updated_at),
    };
  });
  return settings;
}

function isMissingReadinessTableError(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
  return code === "42P01";
}

function isMissingReadinessColumnError(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
  return code === "42703";
}

export function loadConciergeChannelReadinessFlags(): ConciergeChannelReadinessFlags {
  const phoneConfigured = isPhoneChannelFullyConfigured();
  const emailConfigured = Boolean(liveEndpointEnvKey("email")) || ownedConciergeEmailAdapterConfigured();

  return {
    phone_call: {
      adminEnabled: envFlag(["CONCIERGE_PHONE_CALL_CHANNEL_READY", "CONCIERGE_CHANNEL_PHONE_CALL_READY"]),
      configured: phoneConfigured,
      verified: envFlag(["CONCIERGE_PHONE_CALL_CHANNEL_VERIFIED", "CONCIERGE_CHANNEL_PHONE_CALL_VERIFIED"]),
      notes: phoneConfigured ? "ElevenLabs outbound caller configuration detected." : "ElevenLabs outbound caller is not fully configured.",
    },
    email: {
      adminEnabled: envFlag(["CONCIERGE_EMAIL_CHANNEL_READY", "CONCIERGE_CHANNEL_EMAIL_READY"]),
      configured: emailConfigured,
      verified: envFlag(["CONCIERGE_EMAIL_CHANNEL_VERIFIED", "CONCIERGE_CHANNEL_EMAIL_VERIFIED"]),
      notes: emailConfigured ? "Email adapter configuration detected." : "Email adapter is not configured.",
    },
    whatsapp: {
      adminEnabled: envFlag(["CONCIERGE_WHATSAPP_CHANNEL_READY", "CONCIERGE_CHANNEL_WHATSAPP_READY"]),
      configured: Boolean(liveEndpointEnvKey("whatsapp")),
      verified: envFlag(["CONCIERGE_WHATSAPP_CHANNEL_VERIFIED", "CONCIERGE_CHANNEL_WHATSAPP_VERIFIED"]),
    },
    form_application: {
      adminEnabled: envFlag(["CONCIERGE_FORM_APPLICATION_CHANNEL_READY", "CONCIERGE_CHANNEL_FORM_APPLICATION_READY"]),
      configured: Boolean(liveEndpointEnvKey("form_application")),
      verified: envFlag(["CONCIERGE_FORM_APPLICATION_CHANNEL_VERIFIED", "CONCIERGE_CHANNEL_FORM_APPLICATION_VERIFIED"]),
    },
    document_upload: {
      adminEnabled: envFlag(["CONCIERGE_DOCUMENT_UPLOAD_CHANNEL_READY", "CONCIERGE_CHANNEL_DOCUMENT_UPLOAD_READY"]),
      configured: Boolean(liveEndpointEnvKey("document_upload")),
      verified: envFlag(["CONCIERGE_DOCUMENT_UPLOAD_CHANNEL_VERIFIED", "CONCIERGE_CHANNEL_DOCUMENT_UPLOAD_VERIFIED"]),
    },
  };
}

async function readStoredConciergeChannelReadinessSettings(): Promise<Partial<Record<ConciergeProductionChannel, StoredChannelReadinessSetting>>> {
  try {
    const result = await pool.query<StoredChannelReadinessRow>(`
      select
        channel,
        admin_enabled,
        verified,
        notes,
        last_probe_status,
        last_probe_at,
        last_probe_blocker,
        last_probe_by,
        adapter_live_endpoint_url,
        adapter_credential_reference,
        adapter_qa_target,
        adapter_configured_by,
        adapter_configured_at,
        updated_by,
        updated_at
      from concierge_channel_readiness_settings
    `);
    return normalizeSettingsRows(result.rows);
  } catch (error) {
    if (isMissingReadinessTableError(error)) return {};
    if (isMissingReadinessColumnError(error)) {
      const result = await pool.query<StoredChannelReadinessRow>(`
        select
          channel,
          admin_enabled,
          verified,
          notes,
          null::text as last_probe_status,
          null::timestamptz as last_probe_at,
          null::text as last_probe_blocker,
          null::text as last_probe_by,
          null::text as adapter_live_endpoint_url,
          null::text as adapter_credential_reference,
          null::text as adapter_qa_target,
          null::text as adapter_configured_by,
          null::timestamptz as adapter_configured_at,
          updated_by,
          updated_at
        from concierge_channel_readiness_settings
      `);
      return normalizeSettingsRows(result.rows);
    }
    console.warn("[concierge-channel-readiness] Could not load admin readiness settings:", error);
    return {};
  }
}

function mergeAdminSettingsIntoFlags(
  envFlags: ConciergeChannelReadinessFlags,
  settings: Partial<Record<ConciergeProductionChannel, StoredChannelReadinessSetting>>,
): ConciergeChannelReadinessFlags {
  return Object.fromEntries(CONCIERGE_PRODUCTION_CHANNELS.map(({ id }) => {
    const envFlag = envFlags[id] ?? {};
    const setting = settings[id];
    const adapterSetup = adapterSetupForChannel(id, setting);
    return [id, {
      adminEnabled: setting ? setting.adminEnabled : false,
      configured: adapterSetup.configured || envFlag.configured === true,
      verified: setting ? setting.verified : false,
      notes: setting?.notes ?? envFlag.notes ?? null,
    }];
  })) as ConciergeChannelReadinessFlags;
}

export async function loadConciergeChannelReadinessFlagsWithAdminSettings(): Promise<ConciergeChannelReadinessFlags> {
  const envFlags = loadConciergeChannelReadinessFlags();
  const settings = await readStoredConciergeChannelReadinessSettings();
  return mergeAdminSettingsIntoFlags(envFlags, settings);
}

export function conciergeChannelReadinessForTool(input: {
  tool: ConciergeToolRequirement;
  dryRun?: boolean;
}): ConciergeChannelReadinessResult {
  return evaluateConciergeChannelReadiness({
    tool: input.tool,
    dryRun: input.dryRun,
    flags: loadConciergeChannelReadinessFlags(),
  });
}

export async function conciergeChannelReadinessForToolWithAdminSettings(input: {
  tool: ConciergeToolRequirement;
  dryRun?: boolean;
}): Promise<ConciergeChannelReadinessResult> {
  return evaluateConciergeChannelReadiness({
    tool: input.tool,
    dryRun: input.dryRun,
    flags: await loadConciergeChannelReadinessFlagsWithAdminSettings(),
  });
}

export async function loadConciergeActionAdapterRuntimeConfig(channel: ConciergeProductionChannel): Promise<{
  liveEndpointUrl: string | null;
  qaTarget: string | null;
}> {
  const settings = await readStoredConciergeChannelReadinessSettings();
  const setting = settings[channel];
  return {
    liveEndpointUrl: adapterLiveEndpointUrl(channel, setting),
    qaTarget: cleanText(setting?.adapterQaTarget),
  };
}

function probeStateForSetting(setting?: StoredChannelReadinessSetting): ConciergeChannelProbeState {
  if (!setting?.lastProbeStatus) {
    return {
      status: "not_run",
      checked_at: null,
      blocker: "Run a safe QA verification probe before enabling live actions.",
      checked_by: null,
    };
  }

  return {
    status: setting.lastProbeStatus,
    checked_at: setting.lastProbeAt,
    blocker: setting.lastProbeBlocker,
    checked_by: setting.lastProbeBy,
  };
}

function readyBlocker(
  configured: boolean,
  verified: boolean,
  probe: ConciergeChannelProbeState,
): string | null {
  if (!configured) return "Required setup has not been configured on the server.";
  if (!verified) {
    if (probe.status === "fail") return probe.blocker ? `Latest verification failed: ${probe.blocker}` : "Latest verification probe failed.";
    return "Run and pass a safe QA verification probe before enabling live actions.";
  }
  return null;
}

function buildAdminChannelRow(input: {
  channel: ConciergeProductionChannel;
  flags: ConciergeChannelReadinessFlags;
  setting?: StoredChannelReadinessSetting;
}): AdminConciergeChannelReadinessRow {
  const tool = conciergeToolForProductionChannel(input.channel);
  const live = evaluateConciergeChannelReadiness({ tool, dryRun: false, flags: input.flags });
  const testMode = evaluateConciergeChannelReadiness({ tool, dryRun: true, flags: input.flags });
  const configured = live.configured;
  const verified = live.verified;
  const probe = probeStateForSetting(input.setting);
  const adapterSetup = adapterSetupForChannel(input.channel, input.setting);
  const canMarkReady = configured && verified;

  return {
    channel: input.channel,
    label: live.label,
    tool,
    test_mode: testMode,
    live,
    configured,
    verified,
    admin_enabled: live.admin_enabled,
    ready: live.ready,
    external_action_allowed: live.external_action_allowed,
    blockers: live.blockers,
    adapter_setup: adapterSetup,
    can_mark_ready: canMarkReady,
    ready_blocker: readyBlocker(configured, verified, probe),
    probe,
    notes: input.setting?.notes ?? live.notes ?? null,
    updated_by: input.setting?.updatedBy ?? null,
    updated_at: input.setting?.updatedAt ?? null,
  };
}

export async function buildAdminConciergeChannelReadinessSnapshot(): Promise<AdminConciergeChannelReadinessSnapshot> {
  const envFlags = loadConciergeChannelReadinessFlags();
  const settings = await readStoredConciergeChannelReadinessSettings();
  const flags = mergeAdminSettingsIntoFlags(envFlags, settings);
  return {
    generated_at: new Date().toISOString(),
    channels: CONCIERGE_PRODUCTION_CHANNELS.map(({ id }) => buildAdminChannelRow({
      channel: id,
      flags,
      setting: settings[id],
    })),
  };
}

export async function updateAdminConciergeChannelReadiness(input: {
  channel: ConciergeProductionChannel;
  adminEnabled?: boolean;
  verified?: boolean;
  notes?: string | null;
  adapterLiveEndpointUrl?: string | null;
  adapterCredentialReference?: string | null;
  adapterQaTarget?: string | null;
  updatedBy?: string | null;
}): Promise<AdminConciergeChannelReadinessRow> {
  const envFlags = loadConciergeChannelReadinessFlags();
  const settings = await readStoredConciergeChannelReadinessSettings();
  const currentFlags = mergeAdminSettingsIntoFlags(envFlags, settings);
  const currentFlag = currentFlags[input.channel] ?? {};
  const currentSetting = settings[input.channel];
  const nextAdapterLiveEndpointUrl = input.adapterLiveEndpointUrl === undefined
    ? currentSetting?.adapterLiveEndpointUrl ?? null
    : normalizeAdapterLiveEndpointUrl(input.channel, input.adapterLiveEndpointUrl);
  const nextAdapterCredentialReference = input.adapterCredentialReference === undefined
    ? currentSetting?.adapterCredentialReference ?? null
    : normalizeCredentialReference(input.adapterCredentialReference);
  const nextAdapterQaTarget = input.adapterQaTarget === undefined
    ? currentSetting?.adapterQaTarget ?? null
    : normalizeQaTarget(input.adapterQaTarget);
  const configChanged = (input.adapterLiveEndpointUrl !== undefined && nextAdapterLiveEndpointUrl !== (currentSetting?.adapterLiveEndpointUrl ?? null))
    || (input.adapterCredentialReference !== undefined && nextAdapterCredentialReference !== (currentSetting?.adapterCredentialReference ?? null))
    || (input.adapterQaTarget !== undefined && nextAdapterQaTarget !== (currentSetting?.adapterQaTarget ?? null));
  const virtualSettingForConfig: StoredChannelReadinessSetting = {
    adminEnabled: currentSetting?.adminEnabled ?? false,
    verified: currentSetting?.verified ?? false,
    notes: currentSetting?.notes ?? null,
    lastProbeStatus: currentSetting?.lastProbeStatus ?? null,
    lastProbeAt: currentSetting?.lastProbeAt ?? null,
    lastProbeBlocker: currentSetting?.lastProbeBlocker ?? null,
    lastProbeBy: currentSetting?.lastProbeBy ?? null,
    adapterLiveEndpointUrl: nextAdapterLiveEndpointUrl,
    adapterCredentialReference: nextAdapterCredentialReference,
    adapterQaTarget: nextAdapterQaTarget,
    adapterConfiguredBy: configChanged ? input.updatedBy ?? null : currentSetting?.adapterConfiguredBy ?? null,
    adapterConfiguredAt: configChanged ? new Date().toISOString() : currentSetting?.adapterConfiguredAt ?? null,
    updatedBy: currentSetting?.updatedBy ?? null,
    updatedAt: currentSetting?.updatedAt ?? null,
  };
  const configured = adapterSetupForChannel(input.channel, virtualSettingForConfig).configured || currentFlag.configured === true;
  const resetProbe = input.verified === false || configChanged;
  const currentProbe = probeStateForSetting(currentSetting);
  const nextProbeStatus = resetProbe ? null : currentSetting?.lastProbeStatus ?? null;
  const nextVerified = nextProbeStatus === "pass";
  const nextAdminEnabled = input.adminEnabled ?? currentFlag.adminEnabled === true;
  const effectiveAdminEnabled = resetProbe ? false : nextAdminEnabled;

  if (input.verified === true) {
    throw new Error("Run the safe channel verification probe before marking this channel verified.");
  }
  if (effectiveAdminEnabled && (!configured || !nextVerified)) {
    throw new Error(readyBlocker(configured, nextVerified, currentProbe) ?? "Channel is not ready for live Concierge actions.");
  }

  const row = {
    channel: input.channel,
    adminEnabled: effectiveAdminEnabled,
    verified: nextVerified,
    notes: input.notes === undefined ? settings[input.channel]?.notes ?? null : input.notes,
    lastProbeStatus: nextProbeStatus,
    lastProbeAt: resetProbe ? null : currentSetting?.lastProbeAt ?? null,
    lastProbeBlocker: resetProbe ? (configChanged ? "Verification reset after adapter setup changed." : "Verification reset by admin.") : currentSetting?.lastProbeBlocker ?? null,
    lastProbeBy: resetProbe ? input.updatedBy ?? null : currentSetting?.lastProbeBy ?? null,
    adapterLiveEndpointUrl: nextAdapterLiveEndpointUrl,
    adapterCredentialReference: nextAdapterCredentialReference,
    adapterQaTarget: nextAdapterQaTarget,
    adapterConfiguredBy: virtualSettingForConfig.adapterConfiguredBy,
    adapterConfiguredAt: virtualSettingForConfig.adapterConfiguredAt,
    updatedBy: input.updatedBy ?? null,
  };

  try {
    await pool.query(
      `
        insert into concierge_channel_readiness_settings (
          channel,
          admin_enabled,
          verified,
          notes,
          last_probe_status,
          last_probe_at,
          last_probe_blocker,
          last_probe_by,
          adapter_live_endpoint_url,
          adapter_credential_reference,
          adapter_qa_target,
          adapter_configured_by,
          adapter_configured_at,
          updated_by,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
        on conflict (channel) do update set
          admin_enabled = excluded.admin_enabled,
          verified = excluded.verified,
          notes = excluded.notes,
          last_probe_status = excluded.last_probe_status,
          last_probe_at = excluded.last_probe_at,
          last_probe_blocker = excluded.last_probe_blocker,
          last_probe_by = excluded.last_probe_by,
          adapter_live_endpoint_url = excluded.adapter_live_endpoint_url,
          adapter_credential_reference = excluded.adapter_credential_reference,
          adapter_qa_target = excluded.adapter_qa_target,
          adapter_configured_by = excluded.adapter_configured_by,
          adapter_configured_at = excluded.adapter_configured_at,
          updated_by = excluded.updated_by,
          updated_at = now()
      `,
      [
        row.channel,
        row.adminEnabled,
        row.verified,
        row.notes,
        row.lastProbeStatus,
        row.lastProbeAt,
        row.lastProbeBlocker,
        row.lastProbeBy,
        row.adapterLiveEndpointUrl,
        row.adapterCredentialReference,
        row.adapterQaTarget,
        row.adapterConfiguredBy,
        row.adapterConfiguredAt,
        row.updatedBy,
      ],
    );
  } catch (error) {
    if (isMissingReadinessTableError(error) || isMissingReadinessColumnError(error)) {
      throw new Error("Concierge channel readiness settings table is not available. Run the latest migrations first.");
    }
    throw error;
  }

  const refreshedSettings = await readStoredConciergeChannelReadinessSettings();
  const refreshedFlags = mergeAdminSettingsIntoFlags(envFlags, refreshedSettings);
  return buildAdminChannelRow({
    channel: input.channel,
    flags: refreshedFlags,
    setting: refreshedSettings[input.channel],
  });
}

export async function runAdminConciergeChannelVerificationProbe(input: {
  channel: ConciergeProductionChannel;
  updatedBy?: string | null;
}): Promise<AdminConciergeChannelReadinessRow> {
  const envFlags = loadConciergeChannelReadinessFlags();
  const settings = await readStoredConciergeChannelReadinessSettings();
  const currentFlags = mergeAdminSettingsIntoFlags(envFlags, settings);
  const currentFlag = currentFlags[input.channel] ?? {};
  const currentSetting = settings[input.channel];
  const checkedAt = new Date().toISOString();
  const probe = runConciergeActionAdapterProbe({
    channel: input.channel,
    configured: currentFlag.configured === true,
    qaTarget: currentSetting?.adapterQaTarget,
  });
  const adminEnabled = probe.status === "pass" ? currentSetting?.adminEnabled === true : false;

  try {
    await pool.query(
      `
        insert into concierge_channel_readiness_settings (
          channel,
          admin_enabled,
          verified,
          notes,
          last_probe_status,
          last_probe_at,
          last_probe_blocker,
          last_probe_by,
          updated_by,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
        on conflict (channel) do update set
          admin_enabled = excluded.admin_enabled,
          verified = excluded.verified,
          notes = excluded.notes,
          last_probe_status = excluded.last_probe_status,
          last_probe_at = excluded.last_probe_at,
          last_probe_blocker = excluded.last_probe_blocker,
          last_probe_by = excluded.last_probe_by,
          updated_by = excluded.updated_by,
          updated_at = now()
      `,
      [
        input.channel,
        adminEnabled,
        probe.status === "pass",
        currentSetting?.notes ?? null,
        probe.status,
        checkedAt,
        probe.blocker,
        input.updatedBy ?? null,
        input.updatedBy ?? null,
      ],
    );
  } catch (error) {
    if (isMissingReadinessTableError(error) || isMissingReadinessColumnError(error)) {
      throw new Error("Concierge channel readiness settings table is not available. Run the latest migrations first.");
    }
    throw error;
  }

  const refreshedSettings = await readStoredConciergeChannelReadinessSettings();
  const refreshedFlags = mergeAdminSettingsIntoFlags(envFlags, refreshedSettings);
  return buildAdminChannelRow({
    channel: input.channel,
    flags: refreshedFlags,
    setting: refreshedSettings[input.channel],
  });
}
