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

const OUTBOUND_AGENT_ENV_KEYS = [
  "ELEVENLABS_CONCIERGE_CALLER_AGENT_ID",
  "ELEVENLABS_CONCIERGE_OUTBOUND_AGENT_ID",
  "ELEVENLABS_OUTBOUND_AGENT_ID",
];

const OUTBOUND_PHONE_ENV_KEYS = [
  "ELEVENLABS_CONCIERGE_PHONE_NUMBER_ID",
  "ELEVENLABS_AGENT_PHONE_NUMBER_ID",
];

const QA_ENDPOINT_ENV_KEYS: Record<ConciergeProductionChannel, string[]> = {
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

type StoredProbeStatus = Exclude<ConciergeChannelProbeStatus, "not_run">;

type StoredChannelReadinessRow = {
  channel: string;
  admin_enabled: boolean;
  verified: boolean;
  notes: string | null;
  last_probe_status?: string | null;
  last_probe_at?: Date | string | null;
  last_probe_blocker?: string | null;
  last_probe_by?: string | null;
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
  updatedBy: string | null;
  updatedAt: string | null;
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

function firstEnv(keys: string[]): string {
  for (const key of keys) {
    const value = envValue(key);
    if (value) return value;
  }
  return "";
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

function hasQaSchemeTarget(value: string): boolean {
  return /^(qa|test|dry-run):/i.test(value.trim());
}

function isSafeReservedPhoneTarget(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return /^1?20255501\d{2}$/.test(digits) || /^1?55501\d{2}$/.test(digits);
}

function isSafeReservedEmailTarget(value: string): boolean {
  const email = value.trim().toLowerCase().replace(/^mailto:/, "");
  const domain = email.includes("@") ? email.split("@").pop() ?? "" : "";
  return Boolean(domain)
    && (
      domain.endsWith(".test")
      || domain.endsWith(".invalid")
      || domain.endsWith(".localhost")
      || domain === "example.com"
      || domain === "example.org"
      || domain === "example.net"
    );
}

function isSafeReservedUrlTarget(value: string): boolean {
  if (hasQaSchemeTarget(value)) return true;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return host === "localhost"
      || host === "127.0.0.1"
      || host === "::1"
      || host.endsWith(".test")
      || host.endsWith(".invalid")
      || host.endsWith(".localhost")
      || host === "example.com"
      || host === "example.org"
      || host === "example.net";
  } catch {
    return false;
  }
}

function isSafeQaTarget(channel: ConciergeProductionChannel, value: string): boolean {
  switch (channel) {
    case "phone_call":
      return isSafeReservedPhoneTarget(value);
    case "email":
      return isSafeReservedEmailTarget(value);
    case "whatsapp":
      return isSafeReservedPhoneTarget(value);
    case "form_application":
    case "document_upload":
      return isSafeReservedUrlTarget(value);
    default:
      return false;
  }
}

function qaTargetLabel(channel: ConciergeProductionChannel): string {
  switch (channel) {
    case "phone_call":
      return "reserved QA phone number";
    case "email":
      return "reserved QA email inbox";
    case "whatsapp":
      return "reserved QA WhatsApp number";
    case "form_application":
      return "QA form/application URL";
    case "document_upload":
      return "QA document-upload URL";
    default:
      return "QA endpoint";
  }
}

function runSafeConciergeChannelProbe(input: {
  channel: ConciergeProductionChannel;
  configured: boolean;
}): { status: StoredProbeStatus; blocker: string | null } {
  if (!input.configured) {
    return {
      status: "fail",
      blocker: "Required setup has not been configured on the server.",
    };
  }

  const qaTarget = firstEnv(QA_ENDPOINT_ENV_KEYS[input.channel]);
  if (!qaTarget) {
    return {
      status: "fail",
      blocker: `Add a ${qaTargetLabel(input.channel)} before running a live-readiness probe.`,
    };
  }

  if (!isSafeQaTarget(input.channel, qaTarget)) {
    return {
      status: "fail",
      blocker: `The configured ${qaTargetLabel(input.channel)} is not a reserved test endpoint, so no probe was run.`,
    };
  }

  return {
    status: "pass",
    blocker: null,
  };
}

export function loadConciergeChannelReadinessFlags(): ConciergeChannelReadinessFlags {
  const phoneConfigured = Boolean(envValue("ELEVENLABS_API_KEY"))
    && anyEnv(OUTBOUND_AGENT_ENV_KEYS)
    && anyEnv(OUTBOUND_PHONE_ENV_KEYS);

  return {
    phone_call: {
      adminEnabled: envFlag(["CONCIERGE_PHONE_CALL_CHANNEL_READY", "CONCIERGE_CHANNEL_PHONE_CALL_READY"]),
      configured: phoneConfigured || envFlag(["CONCIERGE_PHONE_CALL_CHANNEL_CONFIGURED", "CONCIERGE_CHANNEL_PHONE_CALL_CONFIGURED"]),
      verified: envFlag(["CONCIERGE_PHONE_CALL_CHANNEL_VERIFIED", "CONCIERGE_CHANNEL_PHONE_CALL_VERIFIED"]),
      notes: phoneConfigured ? "ElevenLabs outbound caller configuration detected." : "ElevenLabs outbound caller is not fully configured.",
    },
    email: {
      adminEnabled: envFlag(["CONCIERGE_EMAIL_CHANNEL_READY", "CONCIERGE_CHANNEL_EMAIL_READY"]),
      configured: envFlag(["CONCIERGE_EMAIL_CHANNEL_CONFIGURED", "CONCIERGE_CHANNEL_EMAIL_CONFIGURED"]),
      verified: envFlag(["CONCIERGE_EMAIL_CHANNEL_VERIFIED", "CONCIERGE_CHANNEL_EMAIL_VERIFIED"]),
    },
    whatsapp: {
      adminEnabled: envFlag(["CONCIERGE_WHATSAPP_CHANNEL_READY", "CONCIERGE_CHANNEL_WHATSAPP_READY"]),
      configured: envFlag(["CONCIERGE_WHATSAPP_CHANNEL_CONFIGURED", "CONCIERGE_CHANNEL_WHATSAPP_CONFIGURED"]),
      verified: envFlag(["CONCIERGE_WHATSAPP_CHANNEL_VERIFIED", "CONCIERGE_CHANNEL_WHATSAPP_VERIFIED"]),
    },
    form_application: {
      adminEnabled: envFlag(["CONCIERGE_FORM_APPLICATION_CHANNEL_READY", "CONCIERGE_CHANNEL_FORM_APPLICATION_READY"]),
      configured: envFlag(["CONCIERGE_FORM_APPLICATION_CHANNEL_CONFIGURED", "CONCIERGE_CHANNEL_FORM_APPLICATION_CONFIGURED"]),
      verified: envFlag(["CONCIERGE_FORM_APPLICATION_CHANNEL_VERIFIED", "CONCIERGE_CHANNEL_FORM_APPLICATION_VERIFIED"]),
    },
    document_upload: {
      adminEnabled: envFlag(["CONCIERGE_DOCUMENT_UPLOAD_CHANNEL_READY", "CONCIERGE_CHANNEL_DOCUMENT_UPLOAD_READY"]),
      configured: envFlag(["CONCIERGE_DOCUMENT_UPLOAD_CHANNEL_CONFIGURED", "CONCIERGE_CHANNEL_DOCUMENT_UPLOAD_CONFIGURED"]),
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
    return [id, {
      adminEnabled: setting ? setting.adminEnabled : false,
      configured: envFlag.configured === true,
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
  updatedBy?: string | null;
}): Promise<AdminConciergeChannelReadinessRow> {
  const envFlags = loadConciergeChannelReadinessFlags();
  const settings = await readStoredConciergeChannelReadinessSettings();
  const currentFlags = mergeAdminSettingsIntoFlags(envFlags, settings);
  const currentFlag = currentFlags[input.channel] ?? {};
  const currentSetting = settings[input.channel];
  const configured = currentFlag.configured === true;
  const resetProbe = input.verified === false;
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
    lastProbeBlocker: resetProbe ? "Verification reset by admin." : currentSetting?.lastProbeBlocker ?? null,
    lastProbeBy: resetProbe ? input.updatedBy ?? null : currentSetting?.lastProbeBy ?? null,
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
        row.channel,
        row.adminEnabled,
        row.verified,
        row.notes,
        row.lastProbeStatus,
        row.lastProbeAt,
        row.lastProbeBlocker,
        row.lastProbeBy,
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
  const checkedAt = new Date().toISOString();
  const probe = runSafeConciergeChannelProbe({
    channel: input.channel,
    configured: currentFlag.configured === true,
  });
  const currentSetting = settings[input.channel];
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
