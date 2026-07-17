import {
  CONCIERGE_PRODUCTION_CHANNELS,
  evaluateConciergeChannelReadiness,
  conciergeToolForProductionChannel,
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

type StoredChannelReadinessRow = {
  channel: string;
  admin_enabled: boolean;
  verified: boolean;
  notes: string | null;
  updated_by: string | null;
  updated_at: Date | string | null;
};

type StoredChannelReadinessSetting = {
  adminEnabled: boolean;
  verified: boolean;
  notes: string | null;
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

function normalizeSettingsRows(rows: StoredChannelReadinessRow[]): Partial<Record<ConciergeProductionChannel, StoredChannelReadinessSetting>> {
  const settings: Partial<Record<ConciergeProductionChannel, StoredChannelReadinessSetting>> = {};
  rows.forEach((row) => {
    if (!isConciergeProductionChannel(row.channel)) return;
    settings[row.channel] = {
      adminEnabled: row.admin_enabled === true,
      verified: row.verified === true,
      notes: row.notes ?? null,
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
      select channel, admin_enabled, verified, notes, updated_by, updated_at
      from concierge_channel_readiness_settings
    `);
    return normalizeSettingsRows(result.rows);
  } catch (error) {
    if (isMissingReadinessTableError(error)) return {};
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
      adminEnabled: setting ? setting.adminEnabled : envFlag.adminEnabled === true,
      configured: envFlag.configured === true,
      verified: setting ? setting.verified : envFlag.verified === true,
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

function readyBlocker(configured: boolean, verified: boolean): string | null {
  if (!configured) return "Required setup has not been configured on the server.";
  if (!verified) return "Required setup has not been verified by an admin.";
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
    ready_blocker: readyBlocker(configured, verified),
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
  const configured = currentFlag.configured === true;
  const nextVerified = input.verified ?? currentFlag.verified === true;
  const nextAdminEnabled = input.adminEnabled ?? currentFlag.adminEnabled === true;
  const effectiveAdminEnabled = input.verified === false ? false : nextAdminEnabled;

  if (input.verified === true && !configured) {
    throw new Error("Cannot verify this channel until its required setup is configured.");
  }
  if (effectiveAdminEnabled && (!configured || !nextVerified)) {
    throw new Error(readyBlocker(configured, nextVerified) ?? "Channel is not ready for live Concierge actions.");
  }

  const row = {
    channel: input.channel,
    adminEnabled: effectiveAdminEnabled,
    verified: nextVerified,
    notes: input.notes === undefined ? settings[input.channel]?.notes ?? null : input.notes,
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
          updated_by,
          updated_at
        )
        values ($1, $2, $3, $4, $5, now())
        on conflict (channel) do update set
          admin_enabled = excluded.admin_enabled,
          verified = excluded.verified,
          notes = excluded.notes,
          updated_by = excluded.updated_by,
          updated_at = now()
      `,
      [row.channel, row.adminEnabled, row.verified, row.notes, row.updatedBy],
    );
  } catch (error) {
    if (isMissingReadinessTableError(error)) {
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
