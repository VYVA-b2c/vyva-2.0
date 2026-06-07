import { pool } from "../db.js";

export type CompatibleProfileRow = {
  id: string;
  full_name?: string | null;
  date_of_birth?: string | null;
  language?: string | null;
  language_preference?: string | null;
  deployment?: string | null;
  mem0_user_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  subscription_tier?: string | null;
  trial_ends_at?: Date | string | null;
  account_status?: string | null;
  role?: string | null;
  disabled_at?: Date | string | null;
  disabled_reason?: string | null;
  disabled_by?: string | null;
  preferred_name?: string | null;
  avatar_url?: string | null;
  phone_number?: string | null;
  email?: string | null;
  whatsapp_number?: string | null;
  contact_method?: string | null;
  channel_reports?: string | null;
  channel_chats?: string | null;
  channel_notifications?: string | null;
  hybrid_channel_mode?: boolean | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  country_code?: string | null;
  timezone?: string | null;
  current_stage?: string | null;
  onboarding_channel?: string | null;
  proxy_initiator_id?: string | null;
  proxy_initiated_at?: Date | string | null;
  elder_confirm_token?: string | null;
  elder_confirmed_at?: Date | string | null;
  onboarding_complete?: boolean | null;
  stage_1_completed_at?: Date | string | null;
  stage_2_completed_at?: Date | string | null;
  stage_3_completed_at?: Date | string | null;
  stage_4_completed_at?: Date | string | null;
  stage_5_completed_at?: Date | string | null;
  address_line_1?: string | null;
  city?: string | null;
  region?: string | null;
  postcode?: string | null;
  caregiver_name?: string | null;
  caregiver_contact?: string | null;
  gp_name?: string | null;
  gp_phone?: string | null;
  gp_email?: string | null;
  gp_address?: string | null;
  gp_maps_url?: string | null;
  gp_place_id?: string | null;
  known_allergies?: string[] | null;
  social_enabled?: boolean | null;
  discoverable?: boolean | null;
  match_opt_in?: boolean | null;
  group_opt_in?: boolean | null;
  data_sharing_consent?: unknown;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
};

export type ProfileReadColumn = keyof CompatibleProfileRow;

export const PROFILE_READ_COLUMNS: ProfileReadColumn[] = [
  "id",
  "full_name",
  "date_of_birth",
  "language",
  "language_preference",
  "deployment",
  "mem0_user_id",
  "stripe_customer_id",
  "stripe_subscription_id",
  "subscription_status",
  "subscription_tier",
  "trial_ends_at",
  "account_status",
  "role",
  "disabled_at",
  "disabled_reason",
  "disabled_by",
  "preferred_name",
  "avatar_url",
  "phone_number",
  "email",
  "whatsapp_number",
  "contact_method",
  "channel_reports",
  "channel_chats",
  "channel_notifications",
  "hybrid_channel_mode",
  "facebook_url",
  "instagram_url",
  "country_code",
  "timezone",
  "current_stage",
  "onboarding_channel",
  "proxy_initiator_id",
  "proxy_initiated_at",
  "elder_confirm_token",
  "elder_confirmed_at",
  "onboarding_complete",
  "stage_1_completed_at",
  "stage_2_completed_at",
  "stage_3_completed_at",
  "stage_4_completed_at",
  "stage_5_completed_at",
  "address_line_1",
  "city",
  "region",
  "postcode",
  "caregiver_name",
  "caregiver_contact",
  "gp_name",
  "gp_phone",
  "gp_email",
  "gp_address",
  "gp_maps_url",
  "gp_place_id",
  "known_allergies",
  "social_enabled",
  "discoverable",
  "match_opt_in",
  "group_opt_in",
  "data_sharing_consent",
  "created_at",
  "updated_at",
];

function quotedIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function loadProfileColumnNames(): Promise<Set<string>> {
  const result = await pool.query<{ column_name: string }>(`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
  `);
  return new Set(result.rows.map((column) => column.column_name));
}

export async function selectProfileByDatabaseColumns(
  profileId: string,
  requestedColumns: ProfileReadColumn[] = PROFILE_READ_COLUMNS,
): Promise<CompatibleProfileRow | null> {
  const databaseColumns = await loadProfileColumnNames();
  if (!databaseColumns.has("id")) {
    throw new Error("profiles.id column is unavailable.");
  }

  const selectedColumns = Array.from(new Set(["id", ...requestedColumns]))
    .filter((column) => databaseColumns.has(column));
  const sqlColumns = selectedColumns.map(quotedIdentifier).join(", ");
  const result = await pool.query<CompatibleProfileRow>(
    `select ${sqlColumns} from public.profiles where id = $1 limit 1`,
    [profileId],
  );
  const row = result.rows[0];
  if (!row) return null;

  const withStableKeys: CompatibleProfileRow = { id: row.id };
  for (const column of requestedColumns) {
    if (column === "id") continue;
    withStableKeys[column] = null;
  }
  return { ...withStableKeys, ...row };
}

export async function selectProfileRowsByDatabaseColumns(
  profileId: string,
  requestedColumns: ProfileReadColumn[] = PROFILE_READ_COLUMNS,
): Promise<CompatibleProfileRow[]> {
  const row = await selectProfileByDatabaseColumns(profileId, requestedColumns);
  return row ? [row] : [];
}

export async function selectProfileIdByEmailFromDatabaseColumns(
  email: string,
  excludedProfileId: string,
): Promise<{ id: string } | null> {
  const databaseColumns = await loadProfileColumnNames();
  if (!databaseColumns.has("id") || !databaseColumns.has("email")) return null;

  const result = await pool.query<{ id: string }>(
    `select "id" from public.profiles where lower("email") = $1 and "id" <> $2 limit 1`,
    [email.toLowerCase(), excludedProfileId],
  );
  return result.rows[0] ?? null;
}

export async function selectProfileIdByPhoneDigitsFromDatabaseColumns(
  digits: string,
  excludedProfileId: string,
): Promise<{ id: string } | null> {
  const databaseColumns = await loadProfileColumnNames();
  if (!databaseColumns.has("id")) return null;

  const phoneColumns = ["phone_number", "whatsapp_number"]
    .filter((column) => databaseColumns.has(column));
  if (phoneColumns.length === 0) return null;

  const phoneMatches = phoneColumns
    .map((column) => `regexp_replace(coalesce(${quotedIdentifier(column)}, ''), '[^0-9]', '', 'g') = $1`)
    .join(" or ");
  const result = await pool.query<{ id: string }>(
    `select "id" from public.profiles where (${phoneMatches}) and "id" <> $2 limit 1`,
    [digits, excludedProfileId],
  );
  return result.rows[0] ?? null;
}
