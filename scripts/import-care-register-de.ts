// Import Germany's health providers from OpenStreetMap into
// care_register_places (country 'DE') for Care Finder: family doctors, eye,
// ENT, neurology and orthopaedic specialists, dentists, physiotherapists,
// psychotherapists, opticians and hearing-aid shops. ODbL 1.0.
//
// Run weekly or monthly from the Replit Shell (Development database, DATABASE_URL):
//   npx tsx scripts/import-care-register-de.ts            # dry run: downloads, parses, reports
//   npx tsx scripts/import-care-register-de.ts --apply    # writes
//
// Options:
//   --apply              commit (default: the write runs in a transaction that is rolled back)
//   --state DE-BE        only these Länder, comma-separated (their rows only are refreshed)
//   --overpass URL       another Overpass endpoint (default: overpass-api.de)
//   --file PATH          read one saved Overpass JSON answer instead (needs a single --state)
//
// What it does:
//   1. Asks the Overpass API for every health element in each Land, one Land
//      at a time with a pause between them (the public server is shared).
//   2. Keeps named elements with a care type Care Finder searches for. Doctors
//      count only with a specialty tag; nothing is guessed from names.
//   3. Upserts each place by its OSM id. Places no longer on the map are
//      marked withdrawn, never deleted. OSM gives every position, so nothing
//      is geocoded.
//
// Terms: ODbL. Care Finder shows "© OpenStreetMap contributors" linking to
// openstreetmap.org/copyright on every German result.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";
import {
  DE_STATES,
  dedupeOsmPlaces,
  osmPlaceFromElement,
  overpassQuery,
  type DeRegisterPlace,
  type OsmElement,
} from "../shared/careFinder/registerDe.js";
import { frGeocodeAddress as addressOf } from "../shared/careFinder/registerFr.js";

const MIN_SHRINK_RATIO = 0.8;
// Fewer than this across Germany means Overpass answered partially.
const MIN_PLACES_ALL_STATES = 20_000;
const BATCH_SIZE = 500;
const PAUSE_BETWEEN_STATES_MS = 20_000;

function fail(message: string): never {
  console.error(`ABORT: ${message}`);
  process.exit(1);
}

function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

const APPLY = process.argv.includes("--apply");
const OVERPASS = option("--overpass") ?? "https://overpass-api.de/api/interpreter";
const FILE = option("--file");
const STATES = (option("--state") ?? DE_STATES.join(",")).split(",").map((state) => state.trim().toUpperCase()).filter(Boolean);
for (const state of STATES) if (!(DE_STATES as readonly string[]).includes(state)) fail(`unknown Land ${state}. Use codes like DE-BE.`);
if (FILE && STATES.length !== 1) fail("--file needs exactly one --state.");
if (process.env.REPLIT_DEPLOYMENT) fail("running inside a deployment. Run from the workspace Shell.");
if (!process.env.DATABASE_URL) fail("DATABASE_URL (Development) is not set.");

async function overpass(state: string): Promise<OsmElement[]> {
  if (FILE) return ((JSON.parse(await readFile(FILE, "utf8")) as { elements?: OsmElement[] }).elements ?? []);
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(OVERPASS, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "VYVA-CareFinder-import/1.0" },
        body: new URLSearchParams({ data: overpassQuery(state) }),
        signal: AbortSignal.timeout(20 * 60_000),
      });
      // 429/504: the shared server is busy. Wait and retry.
      if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
      const data = await response.json() as { elements?: OsmElement[]; remark?: string };
      if (data.remark && /error|timed out|out of memory/i.test(data.remark)) throw new Error(`Overpass: ${data.remark}`);
      return data.elements ?? [];
    } catch (error) {
      if (attempt >= 3) throw error;
      console.warn(`  ${state}: ${error instanceof Error ? error.message : error}; retrying in ${attempt} min`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 60_000));
    }
  }
}

async function upsert(client: pg.Client, rows: DeRegisterPlace[], sourceDate: string) {
  const columns = [
    "country", "ccn", "regional_code", "listing", "centre_class", "centre_class_name", "name", "region_code", "region_name",
    "province_code", "province_name", "municipality_code", "municipality_name", "street", "postcode", "phone", "email",
    "website", "ownership", "dependency", "care_codes", "lat", "lng", "geocode_source", "geocoded_address", "geocoded_at",
    "source_updated_on",
  ];
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const values: unknown[] = [];
    const tuples = rows.slice(start, start + BATCH_SIZE).map((place) => {
      const row = [
        "DE", place.ccn, place.regionalCode, place.listing, place.centreClass, place.centreClassName, place.name, place.regionCode,
        place.regionName, place.provinceCode, place.provinceName, place.municipalityCode, place.municipalityName, place.street,
        place.postcode, place.phone, place.email, place.website, place.ownership, place.dependency, place.careCodes,
        place.registerPosition.lat, place.registerPosition.lng, "osm", addressOf(place), new Date(), sourceDate,
      ];
      return `(${row.map((value) => {
        values.push(value);
        return `$${values.length}`;
      }).join(", ")})`;
    });
    const updates = columns.filter((column) => column !== "ccn").map((column) => `${column} = excluded.${column}`);
    await client.query(
      `insert into care_register_places (${columns.join(", ")}) values ${tuples.join(", ")}
       on conflict (ccn) do update set ${updates.join(", ")}, last_seen_at = now(), withdrawn_at = null`,
      values,
    );
  }
}

async function main() {
  console.log(APPLY ? "APPLY: changes will be committed." : "DRY RUN: nothing will be committed. Pass --apply to write.");
  const sourceDate = new Date().toISOString().slice(0, 10);
  const loaded: DeRegisterPlace[] = [];
  for (const [index, state] of STATES.entries()) {
    if (index > 0 && !FILE) await new Promise((resolve) => setTimeout(resolve, PAUSE_BETWEEN_STATES_MS));
    const elements = await overpass(state);
    const places = elements.map((element) => osmPlaceFromElement(element, state)).filter((place): place is DeRegisterPlace => place !== null);
    console.log(`${state}: ${elements.length} OSM elements, ${places.length} places kept.`);
    if (elements.length === 0) fail(`${state}: Overpass returned nothing. Nothing was changed; try again later.`);
    loaded.push(...places);
  }
  // A ccn seen in two Länder (a border building) keeps its first.
  const unique = dedupeOsmPlaces(new Map(loaded.map((place) => [place.ccn, place])).values());
  const counts: Record<string, number> = {};
  for (const place of unique) for (const code of place.careCodes) counts[code] = (counts[code] ?? 0) + 1;
  console.log(`Places: ${unique.length}. By care type:`, counts);
  if (STATES.length === DE_STATES.length && unique.length < MIN_PLACES_ALL_STATES) {
    fail(`only ${unique.length} places for all of Germany (expected at least ${MIN_PLACES_ALL_STATES}). Partial answer; nothing was changed.`);
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const listingCheck = await client.query(
      `select pg_get_constraintdef(oid) as definition from pg_constraint where conname = 'care_register_places_listing_check'`,
    );
    if (!String(listingCheck.rows[0]?.definition ?? "").includes("OSM")) fail("apply migrations/0113_care_register_osm.sql first.");
    const stored = await client.query<{ region_code: string; n: number }>(
      `select region_code, count(*)::int as n from care_register_places
       where country = 'DE' and withdrawn_at is null and region_code = any($1::text[]) group by region_code`,
      [STATES],
    );
    for (const row of stored.rows) {
      const now = unique.filter((place) => place.regionCode === row.region_code).length;
      if (now < row.n * MIN_SHRINK_RATIO) fail(`${row.region_code} has ${now} places but ${row.n} are stored. Partial answer; nothing was changed.`);
    }

    await client.query("begin");
    const startedAt = (await client.query<{ now: Date }>("select now()")).rows[0].now;
    await upsert(client, unique, sourceDate);
    const withdrawn = await client.query(
      `update care_register_places set withdrawn_at = now()
       where country = 'DE' and region_code = any($2::text[]) and withdrawn_at is null and last_seen_at < $1`,
      [startedAt, STATES],
    );
    console.log(`Upserted ${unique.length}. Newly withdrawn (no longer on the map): ${withdrawn.rowCount}.`);
    if (!APPLY) {
      await client.query("rollback");
      console.log("Rolled back (dry run).");
      return;
    }
    await client.query("commit");
    console.log("Committed.");
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
