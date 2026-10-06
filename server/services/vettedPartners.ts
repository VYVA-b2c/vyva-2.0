import { eq, sql } from "drizzle-orm";
import { db } from "../db.js";
import { profiles } from "../../shared/schema.js";
import {
  organisationVisibleTo,
  partnerCoversLocation,
  type SearchPoint,
  type VettedOrganisationInput,
  type VettedProviderInput,
} from "../../shared/vettedPartners.js";

export interface VettedOrganisation {
  id: string;
  name: string;
  deploymentKeys: string[];
  website: string | null;
  isActive: boolean;
}

export interface VettedProvider {
  id: string;
  organisationId: string;
  name: string;
  trades: string[];
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  languages: string[];
  notes: string | null;
  coverageCountry: string;
  coverageRegion: string | null;
  coverageLat: number | null;
  coverageLng: number | null;
  coverageRadiusKm: number | null;
  isActive: boolean;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface PartnerSearchMatch { provider: VettedProvider; organisation: VettedOrganisation }

type Row = Record<string, unknown>;
function rows<T = Row>(result: unknown): T[] {
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown }).rows)) return (result as { rows: T[] }).rows;
  return Array.isArray(result) ? result as T[] : [];
}
// Arrays travel as JSON so the driver never has to infer a Postgres array type.
const textArray = (values: string[]) => sql`array(select jsonb_array_elements_text(${JSON.stringify(values)}::jsonb))`;
const num = (v: unknown) => v === null || v === undefined ? null : Number(v);
const iso = (v: unknown) => v instanceof Date ? v.toISOString() : typeof v === "string" ? new Date(v).toISOString() : null;

function organisationFromRow(row: Row): VettedOrganisation {
  return { id: String(row.id), name: String(row.name), deploymentKeys: (row.deployment_keys as string[]) ?? [], website: (row.website as string) ?? null, isActive: row.is_active === true };
}

function providerFromRow(row: Row): VettedProvider {
  return {
    id: String(row.id), organisationId: String(row.organisation_id), name: String(row.name), trades: (row.trades as string[]) ?? [],
    phone: (row.phone as string) ?? null, email: (row.email as string) ?? null, website: (row.website as string) ?? null,
    address: (row.address as string) ?? null, languages: (row.languages as string[]) ?? [], notes: (row.notes as string) ?? null,
    coverageCountry: String(row.coverage_country), coverageRegion: (row.coverage_region as string) ?? null,
    coverageLat: num(row.coverage_lat), coverageLng: num(row.coverage_lng), coverageRadiusKm: num(row.coverage_radius_km),
    isActive: row.is_active === true, reviewedAt: iso(row.reviewed_at), reviewedBy: (row.reviewed_by as string) ?? null,
  };
}

export async function listVettedPartners(): Promise<{ organisations: VettedOrganisation[]; providers: VettedProvider[] }> {
  const [orgs, providers] = await Promise.all([
    db.execute(sql`SELECT * FROM vetted_partner_organisations ORDER BY name`),
    db.execute(sql`SELECT * FROM vetted_partner_providers ORDER BY is_active, name`),
  ]);
  return { organisations: rows(orgs).map(organisationFromRow), providers: rows(providers).map(providerFromRow) };
}

export async function createOrganisation(input: VettedOrganisationInput): Promise<VettedOrganisation> {
  const result = await db.execute(sql`
    INSERT INTO vetted_partner_organisations (name, deployment_keys, website, is_active)
    VALUES (${input.name}, ${textArray(input.deploymentKeys)}, ${input.website ?? null}, ${input.isActive}::boolean)
    RETURNING *`);
  return organisationFromRow(rows(result)[0]);
}

export async function updateOrganisation(id: string, input: VettedOrganisationInput): Promise<VettedOrganisation | null> {
  const result = await db.execute(sql`
    UPDATE vetted_partner_organisations
    SET name = ${input.name}, deployment_keys = ${textArray(input.deploymentKeys)}, website = ${input.website ?? null},
        is_active = ${input.isActive}::boolean, updated_at = now()
    WHERE id = ${id}::uuid RETURNING *`);
  const row = rows(result)[0];
  return row ? organisationFromRow(row) : null;
}

// New and edited providers always wait for review: an edit can change who a
// member is sent to, so it is never live until someone approves it again.
export async function upsertProvider(organisationId: string, input: VettedProviderInput, id?: string): Promise<VettedProvider | null> {
  const values = sql`
    ${input.name}, ${textArray(input.trades)}, ${input.phone ?? null}, ${input.email ?? null}, ${input.website ?? null},
    ${input.address ?? null}, ${textArray(input.languages)}, ${input.notes ?? null}, ${input.coverageCountry}, ${input.coverageRegion ?? null},
    ${input.coverageLat ?? null}::double precision, ${input.coverageLng ?? null}::double precision, ${input.coverageRadiusKm ?? null}::numeric`;
  const result = id
    ? await db.execute(sql`
      UPDATE vetted_partner_providers SET
        (name, trades, phone, email, website, address, languages, notes, coverage_country, coverage_region, coverage_lat, coverage_lng, coverage_radius_km)
        = (${values}),
        is_active = false, reviewed_at = null, reviewed_by = null, updated_at = now()
      WHERE id = ${id}::uuid AND organisation_id = ${organisationId}::uuid RETURNING *`)
    : await db.execute(sql`
      INSERT INTO vetted_partner_providers
        (organisation_id, name, trades, phone, email, website, address, languages, notes, coverage_country, coverage_region, coverage_lat, coverage_lng, coverage_radius_km)
      VALUES (${organisationId}::uuid, ${values}) RETURNING *`);
  const row = rows(result)[0];
  return row ? providerFromRow(row) : null;
}

export async function reviewProvider(id: string, active: boolean, reviewer: string): Promise<VettedProvider | null> {
  const result = await db.execute(active
    ? sql`UPDATE vetted_partner_providers SET is_active = true, reviewed_at = now(), reviewed_by = ${reviewer}, updated_at = now() WHERE id = ${id}::uuid RETURNING *`
    : sql`UPDATE vetted_partner_providers SET is_active = false, updated_at = now() WHERE id = ${id}::uuid RETURNING *`);
  const row = rows(result)[0];
  return row ? providerFromRow(row) : null;
}

// Search never fails because of partners: any error returns no matches.
export async function findPartnersForSearch(input: { userId: string; serviceType: string; point: SearchPoint }): Promise<PartnerSearchMatch[]> {
  try {
    const [member] = await db.select({ deployment: profiles.deployment }).from(profiles).where(eq(profiles.id, input.userId)).limit(1);
    const result = await db.execute(sql`
      SELECT p.*, o.id AS org_id, o.name AS org_name, o.deployment_keys AS org_deployment_keys, o.website AS org_website, o.is_active AS org_is_active
      FROM vetted_partner_providers p
      JOIN vetted_partner_organisations o ON o.id = p.organisation_id
      WHERE p.is_active AND o.is_active
        AND p.coverage_country = ${input.point.countryCode.toUpperCase()}
        AND ${input.serviceType} = ANY(p.trades)
      LIMIT 200`);
    return rows(result)
      .map(row => ({
        provider: providerFromRow(row),
        organisation: organisationFromRow({ id: row.org_id, name: row.org_name, deployment_keys: row.org_deployment_keys, website: row.org_website, is_active: row.org_is_active }),
      }))
      .filter(match => organisationVisibleTo(match.organisation.deploymentKeys, member?.deployment) && partnerCoversLocation(match.provider, input.point))
      .slice(0, 5);
  } catch (error) {
    console.warn("[vetted-partners] lookup unavailable", { code: (error as { code?: string })?.code });
    return [];
  }
}
