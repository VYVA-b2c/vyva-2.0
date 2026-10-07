// Import Spain's national register of authorised health centres (REGCESS,
// Ministerio de Sanidad) into care_register_places, for Care Finder.
//
// Run monthly from the Replit Shell (Development database, DATABASE_URL):
//   npx tsx scripts/import-care-register.ts                       # dry run: downloads, parses, reports
//   npx tsx scripts/import-care-register.ts --apply               # writes, then geocodes up to 2,000 places
//   npx tsx scripts/import-care-register.ts --apply --geocode-limit 20000 --geocode-province 49,37
//
// Options:
//   --apply                    commit (default: everything runs in a transaction that is rolled back)
//   --file C2=/path/C2.xlsx    use a downloaded file instead of fetching it (repeatable)
//   --date 2026-10-01          the register date to record (default: the 1st of this month, the date the Ministry gives its monthly files)
//   --no-regional              skip the Castilla y León register (its coordinates save geocoding)
//   --geocode-limit N          geocode at most N places without coordinates (default 2000; 0 = none)
//   --geocode-province 49,37   only geocode these province codes (default: all)
//
// What it does:
//   1. Downloads the four monthly REGCESS files (C1, C2, C3, E) and parses
//      them. Pharmacies (E1) and first-aid kits (E2) are skipped.
//   2. Takes coordinates from the Castilla y León register (CC BY 4.0) where
//      its registration number matches the REGCESS regional code.
//   3. Upserts every place by its permanent REGCESS code. Places missing from
//      this month's files are marked withdrawn, never deleted.
//   4. Loads the Castilla y León health map (which centre serves each
//      municipality, CC BY 4.0) for naming a person's own public centre.
//   5. Geocodes places Care Finder can show that still have no coordinates,
//      with CartoCiudad (IGN). Re-geocodes only when an address changed.
//
// Sources and terms: REGCESS reuse is allowed with the source cited and the
// date of last update shown; Care Finder shows both. CartoCiudad: "CartoCiudad
// cedido por © Instituto Geográfico Nacional".
import "dotenv/config";
import pg from "pg";
import {
  REGISTER_DOWNLOAD_URL,
  REGISTER_LISTINGS,
  geocodeFitsPlace,
  parseRegionalPosition,
  positionForImport,
  registerColumnIndex,
  registerGeocodeAddress,
  registerPlaceFromRow,
  registerPlaceIsRelevant,
  splitDelimitedLine,
  type RegisterListing,
  type RegisterPlace,
  type StoredPosition,
} from "../shared/careFinder/register.js";
import { geocodeSpanishAddress } from "../server/services/cartoCiudad.js";
import { forEachXlsxRow } from "./xlsx-rows.js";
import {
  CASTILLA_LEON_HEALTH_MAP_SOURCE,
  CASTILLA_LEON_HEALTH_MAP_URL,
  castillaLeonHealthMapRows,
  normaliseMunicipalityName,
  type HealthMapRow,
} from "../shared/careFinder/publicCare.js";

const JCYL_REGISTER_URL = "https://datosabiertos.jcyl.es/web/jcyl/risp/es/salud/centros_sanitarios/1284289592598.csv";
// A file this much smaller than what is stored is more likely broken than real.
const MIN_SHRINK_RATIO = 0.8;
const BATCH_SIZE = 500;

function fail(message: string): never {
  console.error(`ABORT: ${message}`);
  process.exit(1);
}

function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

const APPLY = process.argv.includes("--apply");
const USE_REGIONAL = !process.argv.includes("--no-regional");
const GEOCODE_LIMIT = Number(option("--geocode-limit") ?? 2000);
const GEOCODE_PROVINCES = new Set((option("--geocode-province") ?? "").split(",").map((code) => code.trim()).filter(Boolean));
const LOCAL_FILES = new Map<string, string>();
process.argv.forEach((value, index) => {
  if (value !== "--file") return;
  const [listing, path] = (process.argv[index + 1] ?? "").split("=");
  if (!listing || !path) fail("--file takes LISTING=path, e.g. --file C2=/tmp/C2.xlsx");
  LOCAL_FILES.set(listing.toUpperCase(), path);
});
const DATE_OVERRIDE = option("--date");
if (DATE_OVERRIDE && !/^\d{4}-\d{2}-\d{2}$/.test(DATE_OVERRIDE)) fail("--date must be YYYY-MM-DD");
if (!Number.isInteger(GEOCODE_LIMIT) || GEOCODE_LIMIT < 0) fail("--geocode-limit must be a whole number");

if (process.env.REPLIT_DEPLOYMENT) fail("running inside a deployment. Run from the workspace Shell.");
if (!process.env.DATABASE_URL) fail("DATABASE_URL (Development) is not set.");

async function download(url: string): Promise<{ body: Buffer; lastModified: string | null }> {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(300_000) });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  const lastModified = response.headers.get("last-modified");
  return {
    body: Buffer.from(await response.arrayBuffer()),
    lastModified: lastModified && !Number.isNaN(Date.parse(lastModified)) ? new Date(lastModified).toISOString().slice(0, 10) : null,
  };
}

async function loadListing(listing: RegisterListing): Promise<{ places: RegisterPlace[]; lastModified: string | null; rows: number }> {
  const localPath = LOCAL_FILES.get(listing);
  const { body, lastModified } = localPath
    ? { body: await import("node:fs/promises").then((fs) => fs.readFile(localPath)), lastModified: null }
    : await download(`${REGISTER_DOWNLOAD_URL}${listing}`);
  // Row by row: reading the 119,000-row C2 file whole needs over 1 GB.
  let index: ReturnType<typeof registerColumnIndex> | null = null;
  const places: RegisterPlace[] = [];
  const total = forEachXlsxRow(body, (row) => {
    if (!index) {
      index = registerColumnIndex(row);
      return;
    }
    const place = registerPlaceFromRow(row, index, listing);
    if (place) places.push(place);
  });
  if (!index) throw new Error(`${listing}: empty file`);
  return { places, lastModified, rows: Math.max(0, total - 1) };
}

async function loadRegionalPositions(): Promise<Map<string, { lat: number; lng: number }>> {
  const positions = new Map<string, { lat: number; lng: number }>();
  if (!USE_REGIONAL) return positions;
  try {
    const { body } = await download(JCYL_REGISTER_URL);
    const lines = body.toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    const header = splitDelimitedLine(lines[0] ?? "");
    const codeAt = header.indexOf("Nº de Registro");
    const positionAt = header.indexOf("Posición");
    if (codeAt < 0 || positionAt < 0) throw new Error(`unexpected header: ${header.join(" | ")}`);
    for (const line of lines.slice(1)) {
      const cells = splitDelimitedLine(line);
      const position = parseRegionalPosition(cells[positionAt]);
      if (cells[codeAt] && position) positions.set(cells[codeAt], position);
    }
  } catch (error) {
    console.warn(`Castilla y León register skipped: ${error instanceof Error ? error.message : error}`);
  }
  return positions;
}

function firstOfThisMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

async function upsert(client: pg.Client, places: Array<RegisterPlace & StoredPosition>, sourceDate: string) {
  const columns = [
    "ccn", "regional_code", "listing", "centre_class", "centre_class_name", "name", "region_code", "region_name",
    "province_code", "province_name", "municipality_code", "municipality_name", "street", "postcode", "phone", "email",
    "website", "ownership", "dependency", "care_codes", "lat", "lng", "geocode_source", "geocoded_address", "geocoded_at",
    "source_updated_on",
  ];
  for (let start = 0; start < places.length; start += BATCH_SIZE) {
    const batch = places.slice(start, start + BATCH_SIZE);
    const values: unknown[] = [];
    const tuples = batch.map((place) => {
      const row = [
        place.ccn, place.regionalCode, place.listing, place.centreClass, place.centreClassName, place.name, place.regionCode,
        place.regionName, place.provinceCode, place.provinceName, place.municipalityCode, place.municipalityName, place.street,
        place.postcode, place.phone, place.email, place.website, place.ownership, place.dependency, place.careCodes,
        place.lat, place.lng, place.geocodeSource, place.geocodedAddress, place.lat === null ? null : new Date(), sourceDate,
      ];
      const placeholders = row.map((value) => {
        values.push(value);
        return `$${values.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    const updates = columns.filter((column) => column !== "ccn" && column !== "geocoded_at")
      .map((column) => `${column} = excluded.${column}`);
    await client.query(
      `insert into care_register_places (${columns.join(", ")}) values ${tuples.join(", ")}
       on conflict (ccn) do update set ${updates.join(", ")},
         geocoded_at = case when care_register_places.lat is not distinct from excluded.lat
           and care_register_places.lng is not distinct from excluded.lng
           then care_register_places.geocoded_at else excluded.geocoded_at end,
         last_seen_at = now(), withdrawn_at = null`,
      values,
    );
  }
}

/**
 * Regional health maps (which centre serves each municipality). Castilla y
 * León only for now. Its file names municipalities without codes, so names
 * are matched to the register's own municipality codes in each province.
 */
async function replaceHealthMaps(client: pg.Client, places: RegisterPlace[]) {
  if (!USE_REGIONAL) return;
  const municipalities = new Map<string, Map<string, string>>();
  for (const place of places) {
    if (!place.provinceCode || !place.municipalityCode || !place.municipalityName) continue;
    const byName = municipalities.get(place.provinceCode) ?? new Map<string, string>();
    byName.set(normaliseMunicipalityName(place.municipalityName), place.municipalityCode);
    municipalities.set(place.provinceCode, byName);
  }
  let parsed: { rows: HealthMapRow[]; unmatched: string[] };
  try {
    const { body } = await download(CASTILLA_LEON_HEALTH_MAP_URL);
    const lines = body.toString("utf8").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean).map((line) => splitDelimitedLine(line));
    parsed = castillaLeonHealthMapRows(lines, municipalities);
  } catch (error) {
    console.warn(`Castilla y León health map skipped: ${error instanceof Error ? error.message : error}`);
    return;
  }
  // Names the register doesn't hold (municipalities with no listed place)
  // are left out; Care Finder then uses the nearest centre there.
  console.log(`Castilla y León health map: ${parsed.rows.length} municipality rows, ${parsed.unmatched.length} names not matched.`);
  if (parsed.unmatched.length) console.log(`  e.g. ${parsed.unmatched.slice(0, 10).join("; ")}`);
  if (parsed.rows.length === 0) return;
  await client.query(`delete from care_health_zone_municipalities where region_code = '07'`);
  for (let start = 0; start < parsed.rows.length; start += BATCH_SIZE) {
    const batch = parsed.rows.slice(start, start + BATCH_SIZE);
    const values: unknown[] = [];
    const tuples = batch.map((row) => {
      values.push(row.municipalityCode, row.municipalityName, row.regionCode, row.zoneName, row.centreName, CASTILLA_LEON_HEALTH_MAP_SOURCE);
      const base = values.length - 6;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
    });
    await client.query(
      `insert into care_health_zone_municipalities (municipality_code, municipality_name, region_code, zone_name, centre_name, source)
       values ${tuples.join(", ")} on conflict do nothing`,
      values,
    );
  }
}

async function geocodeMissing(client: pg.Client) {
  if (GEOCODE_LIMIT === 0) return;
  const { rows } = await client.query<{ ccn: string; geocoded_address: string; province_code: string | null; municipality_code: string | null }>(
    `select ccn, geocoded_address, province_code, municipality_code from care_register_places
     where withdrawn_at is null and lat is null and geocoded_address is not null
       and ($1::text[] is null or province_code = any($1::text[]))
     order by province_code, ccn`,
    [GEOCODE_PROVINCES.size ? Array.from(GEOCODE_PROVINCES) : null],
  );
  // Only places Care Finder can show are worth a geocoder call.
  const relevant = new Set((await client.query<{ ccn: string; centre_class: string | null; care_codes: string[]; ownership: "public" | "private" | null; name: string }>(
    `select ccn, centre_class, care_codes, ownership, name from care_register_places where withdrawn_at is null and lat is null`,
  )).rows.filter((row) => registerPlaceIsRelevant({ centreClass: row.centre_class, careCodes: row.care_codes, ownership: row.ownership, name: row.name }))
    .map((row) => row.ccn));
  const queue = rows.filter((row) => relevant.has(row.ccn)).slice(0, GEOCODE_LIMIT);
  console.log(`Geocoding ${queue.length} places with CartoCiudad (${relevant.size} relevant places still without coordinates).`);
  let found = 0;
  for (const [position, row] of queue.entries()) {
    const point = await geocodeSpanishAddress(row.geocoded_address, { timeoutMs: 10_000 });
    // Never trust a point in another province or town: the geocoder snaps to the nearest match.
    if (point && geocodeFitsPlace(point, row)) {
      await client.query(
        `update care_register_places set lat = $2, lng = $3, geocode_source = 'cartociudad', geocoded_at = now()
         where ccn = $1 and geocoded_address = $4`,
        [row.ccn, point.lat, point.lng, row.geocoded_address],
      );
      found += 1;
    }
    if ((position + 1) % 250 === 0) console.log(`  ${position + 1}/${queue.length} (${found} placed)`);
    // Be polite to a free public service.
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  console.log(`Geocoded ${found} of ${queue.length}.`);
}

async function main() {
  console.log(APPLY ? "APPLY: changes will be committed." : "DRY RUN: nothing will be committed. Pass --apply to write.");
  const regional = await loadRegionalPositions();
  console.log(`Castilla y León register: ${regional.size} positions.`);

  const loaded = new Map<RegisterListing, RegisterPlace[]>();
  let fileDate: string | null = null;
  for (const listing of REGISTER_LISTINGS) {
    const { places, lastModified, rows } = await loadListing(listing);
    loaded.set(listing, places);
    fileDate = fileDate ?? lastModified;
    console.log(`${listing}: ${rows} rows, ${places.length} places kept.`);
  }
  const sourceDate = DATE_OVERRIDE ?? fileDate ?? firstOfThisMonth();
  console.log(`Register date recorded: ${sourceDate}`);

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const exists = await client.query(`select to_regclass('public.care_register_places') as name`);
    if (!exists.rows[0]?.name) fail("table care_register_places is missing. Apply migrations/0109_care_register_places.sql first.");
    const mapTable = await client.query(`select to_regclass('public.care_health_zone_municipalities') as name`);
    if (!mapTable.rows[0]?.name) fail("table care_health_zone_municipalities is missing. Apply migrations/0110_care_health_zone_municipalities.sql first.");

    const stored = await client.query<{ ccn: string; listing: string; lat: number | null; lng: number | null; geocode_source: StoredPosition["geocodeSource"]; geocoded_address: string | null }>(
      `select ccn, listing, lat, lng, geocode_source, geocoded_address from care_register_places where withdrawn_at is null`,
    );
    const previous = new Map(stored.rows.map((row) => [row.ccn, {
      lat: row.lat, lng: row.lng, geocodeSource: row.geocode_source, geocodedAddress: row.geocoded_address,
    } satisfies StoredPosition]));
    for (const listing of REGISTER_LISTINGS) {
      const before = stored.rows.filter((row) => row.listing === listing).length;
      const now = loaded.get(listing)?.length ?? 0;
      if (before > 0 && now < before * MIN_SHRINK_RATIO) {
        fail(`${listing} has ${now} places but ${before} are stored. The download is probably incomplete; nothing was changed.`);
      }
    }

    const seen = new Set<string>();
    const rows: Array<RegisterPlace & StoredPosition> = [];
    for (const places of loaded.values()) {
      for (const place of places) {
        // A code listed twice keeps its first row.
        if (seen.has(place.ccn)) continue;
        seen.add(place.ccn);
        const address = registerGeocodeAddress(place);
        const regionalPosition = place.regionalCode ? regional.get(place.regionalCode) : undefined;
        rows.push({ ...place, ...positionForImport(previous.get(place.ccn), address, regionalPosition) });
      }
    }
    const placed = rows.filter((row) => row.lat !== null).length;
    const relevantMissing = rows.filter((row) => row.lat === null && row.geocodedAddress && registerPlaceIsRelevant(row)).length;
    console.log(`Places: ${rows.length}. With coordinates: ${placed}. Care Finder places still to geocode: ${relevantMissing}.`);

    await client.query("begin");
    const startedAt = (await client.query<{ now: Date }>("select now()")).rows[0].now;
    await upsert(client, rows, sourceDate);
    const withdrawn = await client.query(
      `update care_register_places set withdrawn_at = now() where withdrawn_at is null and last_seen_at < $1`,
      [startedAt],
    );
    console.log(`Upserted ${rows.length}. Newly withdrawn (no longer in the register): ${withdrawn.rowCount}.`);
    await replaceHealthMaps(client, rows);
    if (!APPLY) {
      await client.query("rollback");
      console.log("Rolled back (dry run). Geocoding skipped.");
      return;
    }
    await client.query("commit");
    await geocodeMissing(client);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
