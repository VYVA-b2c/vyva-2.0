import { z } from "zod";
import { HOME_SERVICE_TYPES, type HomeServiceType } from "./serviceIntake.js";

const TRADES = HOME_SERVICE_TYPES.map(t => t.key) as [HomeServiceType, ...HomeServiceType[]];
const optionalText = (max: number) => z.preprocess(v => typeof v === "string" && v.trim() === "" ? undefined : v, z.string().trim().max(max).optional());

export const vettedOrganisationInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  deploymentKeys: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  website: optionalText(300),
  isActive: z.boolean().default(true),
});
export type VettedOrganisationInput = z.infer<typeof vettedOrganisationInputSchema>;

export const vettedProviderInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  trades: z.array(z.enum(TRADES)).min(1).max(6),
  phone: optionalText(40),
  email: z.preprocess(v => typeof v === "string" && v.trim() === "" ? undefined : v, z.string().trim().email().max(200).optional()),
  website: z.preprocess(v => typeof v === "string" && v.trim() === "" ? undefined : v, z.string().trim().url().max(300).optional()),
  address: optionalText(300),
  languages: z.array(z.string().trim().toLowerCase().regex(/^[a-z]{2}$/)).max(10).default([]),
  notes: optionalText(600),
  coverageCountry: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  coverageRegion: optionalText(120),
  coverageLat: z.number().min(-90).max(90).optional(),
  coverageLng: z.number().min(-180).max(180).optional(),
  coverageRadiusKm: z.number().positive().max(500).optional(),
}).superRefine((value, ctx) => {
  const radius = [value.coverageLat, value.coverageLng, value.coverageRadiusKm].filter(v => v !== undefined).length;
  if (radius !== 0 && radius !== 3) ctx.addIssue({ code: "custom", message: "Radius coverage needs latitude, longitude and radius together", path: ["coverageRadiusKm"] });
  if (!value.phone && !value.email && !value.website) ctx.addIssue({ code: "custom", message: "Add at least a phone, email or website", path: ["phone"] });
});
export type VettedProviderInput = z.infer<typeof vettedProviderInputSchema>;

export interface VettedProviderCoverage {
  coverageCountry: string;
  coverageRegion?: string | null;
  coverageLat?: number | null;
  coverageLng?: number | null;
  coverageRadiusKm?: number | null;
}

export interface SearchPoint {
  countryCode: string;
  lat?: number | null;
  lng?: number | null;
  addressText?: string | null;
}

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// A radius needs the search coordinates; a region must appear in the member's
// address (as whole words); otherwise the country decides. Unknown search
// coordinates never satisfy a radius.
export function partnerCoversLocation(provider: VettedProviderCoverage, point: SearchPoint): boolean {
  if (provider.coverageCountry.toUpperCase() !== point.countryCode.toUpperCase()) return false;
  if (provider.coverageLat != null && provider.coverageLng != null && provider.coverageRadiusKm != null) {
    if (point.lat == null || point.lng == null) return false;
    return distanceKm({ lat: provider.coverageLat, lng: provider.coverageLng }, { lat: point.lat, lng: point.lng }) <= Number(provider.coverageRadiusKm);
  }
  if (provider.coverageRegion) {
    const region = normalize(provider.coverageRegion);
    return Boolean(region) && ` ${normalize(point.addressText ?? "")} `.includes(` ${region} `);
  }
  return true;
}

export function organisationVisibleTo(deploymentKeys: string[], memberDeployment: string | null | undefined): boolean {
  return deploymentKeys.length === 0 || (Boolean(memberDeployment) && deploymentKeys.includes(memberDeployment!));
}

// Bulk import: header row, comma or semicolon separated, quotes allowed.
// Columns: name, trades (separated by | or /), phone, email, website, address,
// languages (|), country, region, lat, lng, radius_km, notes.
export const VETTED_PROVIDER_CSV_COLUMNS = ["name", "trades", "phone", "email", "website", "address", "languages", "country", "region", "lat", "lng", "radius_km", "notes"] as const;

function splitCsvLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === "\"" && line[i + 1] === "\"") { cell += "\""; i += 1; } else if (ch === "\"") quoted = false; else cell += ch;
    } else if (ch === "\"") quoted = true;
    else if (ch === separator) { cells.push(cell); cell = ""; } else cell += ch;
  }
  cells.push(cell);
  return cells.map(c => c.trim());
}

export function parseVettedProviderCsv(text: string): Array<{ row: number; input?: VettedProviderInput; errors?: string[] }> {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  const separator = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const header = splitCsvLine(lines[0], separator).map(h => h.toLowerCase());
  return lines.slice(1).map((line, index) => {
    const cells = splitCsvLine(line, separator);
    const get = (key: string) => cells[header.indexOf(key)] ?? "";
    const list = (key: string) => get(key).split(/[|/]/).map(v => v.trim().toLowerCase()).filter(Boolean);
    const num = (key: string) => get(key) === "" ? undefined : Number(get(key).replace(",", "."));
    const parsed = vettedProviderInputSchema.safeParse({
      name: get("name"), trades: list("trades"), phone: get("phone"), email: get("email"), website: get("website"),
      address: get("address"), languages: list("languages"), notes: get("notes"),
      coverageCountry: get("country"), coverageRegion: get("region"),
      coverageLat: num("lat"), coverageLng: num("lng"), coverageRadiusKm: num("radius_km"),
    });
    return parsed.success
      ? { row: index + 2, input: parsed.data }
      : { row: index + 2, errors: parsed.error.issues.map(issue => `${issue.path.join(".") || "row"}: ${issue.message}`) };
  });
}
