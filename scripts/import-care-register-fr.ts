// Import France's official registers into care_register_places (country
// 'FR') for Care Finder: practitioners and shops from RPPS / Annuaire Santé,
// health centres from FINESS. Both Licence Ouverte 2.0.
//
// Run weekly from the Replit Shell (Development database, DATABASE_URL):
//   npx tsx scripts/import-care-register-fr.ts            # dry run: downloads, parses, reports
//   npx tsx scripts/import-care-register-fr.ts --apply    # writes, then geocodes places without coordinates
//
// Options:
//   --apply                  commit (default: the write runs in a transaction that is rolled back)
//   --rpps-file PATH         use a downloaded PS_LibreAcces_Personne_activite.txt
//   --finess-file PATH       use a downloaded FINESS structures file (.json or .json.gz)
//   --only rpps|finess       import one register; the other's rows are left as they are
//   --geocode-limit N        geocode at most N places (default 400000; 0 = none)
//   --geocode-only           skip the download; only fill in missing coordinates (needs --apply)
//
// What it does:
//   1. Downloads the current RPPS activity file and FINESS structures file
//      (found through the data.gouv.fr API, so renamed monthly files are
//      picked up) and keeps what Care Finder can show: liberal family
//      doctors, eye, ENT, neurology and orthopaedic specialists, dentists,
//      physiotherapists, psychologists, opticians and hearing-aid shops,
//      health centres and multi-professional practices.
//   2. Upserts each place by a stable key. Places missing from this week's
//      files are marked withdrawn, never deleted.
//   3. Uses the coordinates FINESS publishes; geocodes everything else with
//      the national address base (BAN, Géoplateforme) in bulk, accepting a
//      match only in the place's own commune. Re-geocodes only when an
//      address changed.
//
// Terms: Licence Ouverte 2.0 asks for the source and its last update date;
// Care Finder shows both on every French result.
import "dotenv/config";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import pg from "pg";
import {
  FR_FINESS_DATASET,
  FR_RPPS_DATASET,
  addFrPlace,
  banResultFits,
  finessPlaceFromSite,
  frGeocodeAddress,
  mergeFrPlaces,
  rppsColumnIndex,
  rppsPlaceFromRow,
  type FrRegisterPlace,
  type RppsColumnIndex,
} from "../shared/careFinder/registerFr.js";
import { positionForImport, type StoredPosition } from "../shared/careFinder/register.js";
import { geocodeFrenchAddresses } from "../server/services/banGeocoder.js";
import { jsonArrayItems } from "./json-array-items.js";

const MIN_SHRINK_RATIO = 0.8;
// Fewer than this means a partial or daily file, not the national register
// (October 2026: about 6,200 FINESS centres; RPPS has 1.9M professionals).
const MIN_PLACES: Record<"RPPS" | "FINESS", number> = { RPPS: 100_000, FINESS: 5_000 };
const BATCH_SIZE = 500;
const GEOCODE_BATCH = 5_000;
type Listing = "RPPS" | "FINESS";

function fail(message: string): never {
  console.error(`ABORT: ${message}`);
  process.exit(1);
}

function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

const APPLY = process.argv.includes("--apply");
const GEOCODE_ONLY = process.argv.includes("--geocode-only");
const GEOCODE_LIMIT = Number(option("--geocode-limit") ?? 400_000);
const ONLY = option("--only");
const RPPS_FILE = option("--rpps-file");
const FINESS_FILE = option("--finess-file");
if (ONLY && ONLY !== "rpps" && ONLY !== "finess") fail("--only takes rpps or finess");
if (!Number.isInteger(GEOCODE_LIMIT) || GEOCODE_LIMIT < 0) fail("--geocode-limit must be a whole number");
if (GEOCODE_ONLY && !APPLY) fail("--geocode-only writes coordinates; add --apply.");
if (process.env.REPLIT_DEPLOYMENT) fail("running inside a deployment. Run from the workspace Shell.");
if (!process.env.DATABASE_URL) fail("DATABASE_URL (Development) is not set.");
const LISTINGS: Listing[] = ONLY === "rpps" ? ["RPPS"] : ONLY === "finess" ? ["FINESS"] : ["RPPS", "FINESS"];

type Resource = { title?: string; url?: string; format?: string; last_modified?: string };

/**
 * The newest file in a data.gouv.fr dataset whose title or URL matches,
 * preferring a full monthly snapshot over a daily file.
 */
async function latestResource(dataset: string, pattern: RegExp): Promise<{ url: string; date: string | null; title: string }> {
  const response = await fetch(`https://www.data.gouv.fr/api/1/datasets/${dataset}/`, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`data.gouv.fr dataset ${dataset} returned ${response.status}`);
  const resources = ((await response.json()) as { resources?: Resource[] }).resources ?? [];
  const matching = resources
    .filter((resource) => resource.url && pattern.test(`${resource.title ?? ""} ${resource.url}`))
    .sort((left, right) => {
      const monthly = (resource: Resource) => (/mensuel|monthly/i.test(`${resource.title ?? ""} ${resource.url}`) ? 0 : 1);
      return monthly(left) - monthly(right) || String(right.last_modified ?? "").localeCompare(String(left.last_modified ?? ""));
    });
  const found = matching[0];
  if (!found?.url) throw new Error(`no file matching ${pattern} in ${dataset}. Titles: ${resources.map((resource) => resource.title).join(" | ")}`);
  return { url: found.url, date: found.last_modified?.slice(0, 10) ?? null, title: found.title ?? found.url };
}

/** A local file or a download, as a byte stream, unzipped when gzip. */
async function openSource(localPath: string | null, url: string | null): Promise<AsyncIterable<Buffer>> {
  let stream: Readable;
  if (localPath) {
    stream = createReadStream(localPath, { highWaterMark: 1 << 20 });
  } else {
    let response: Response | null = null;
    // data.gouv.fr's file host sometimes drops a connection on the first try.
    for (let attempt = 1; attempt <= 3 && !response?.ok; attempt += 1) {
      response = await fetch(url!, { redirect: "follow", signal: AbortSignal.timeout(30 * 60_000) }).catch((error: unknown) => {
        if (attempt === 3) throw error;
        return null;
      });
      if (!response?.ok) await new Promise((resolve) => setTimeout(resolve, 5_000 * attempt));
    }
    if (!response?.ok || !response.body) throw new Error(`${url} returned ${response?.status ?? "no response"}`);
    stream = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream);
  }
  // Peek at the first bytes: gzip starts 1f 8b.
  const iterator = stream[Symbol.asyncIterator]();
  const first = await iterator.next();
  const head: Buffer = first.done ? Buffer.alloc(0) : first.value;
  const rest = Readable.from((async function* () {
    yield head;
    for (;;) {
      const next = await iterator.next();
      if (next.done) return;
      yield next.value as Buffer;
    }
  })());
  return head[0] === 0x1f && head[1] === 0x8b ? rest.pipe(createGunzip()) : rest;
}

/** Lines of a text file, decoded as UTF-8, or Latin-1 when it isn't valid UTF-8. */
async function* lines(bytes: AsyncIterable<Buffer>): AsyncGenerator<string> {
  let decoder: TextDecoder | null = null;
  let pending = "";
  for await (const chunk of bytes) {
    if (!decoder) {
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(chunk.subarray(0, Math.max(0, chunk.length - 4)));
        decoder = new TextDecoder("utf-8");
      } catch {
        decoder = new TextDecoder("latin1");
      }
    }
    pending += decoder.decode(chunk, { stream: true });
    const parts = pending.split(/\r?\n/);
    pending = parts.pop() ?? "";
    yield* parts;
  }
  if (pending) yield pending;
}

async function loadRpps(): Promise<{ places: FrRegisterPlace[]; date: string | null }> {
  const source = RPPS_FILE ? null : await latestResource(FR_RPPS_DATASET, /personne[-_ ]activite/i);
  if (source) console.log(`RPPS: ${source.title} (${source.date ?? "date unknown"})`);
  let index: RppsColumnIndex | null = null;
  let rows = 0;
  const merged = new Map<string, FrRegisterPlace>();
  for await (const line of lines(await openSource(RPPS_FILE, source?.url ?? null))) {
    const cells = line.split("|");
    if (!index) {
      index = rppsColumnIndex(cells);
      continue;
    }
    rows += 1;
    const place = rppsPlaceFromRow(cells, index);
    // A copy: the parsed strings are slices that would keep each 1 MB read
    // chunk alive, and the whole file with it.
    if (place) addFrPlace(merged, structuredClone(place));
    if (rows % 500_000 === 0) console.log(`  RPPS: ${rows} rows read`);
  }
  if (!index) throw new Error("RPPS: empty file");
  const places = Array.from(merged.values());
  console.log(`RPPS: ${rows} activity rows, ${places.length} places kept.`);
  return { places, date: source?.date ?? null };
}

async function loadFiness(): Promise<{ places: FrRegisterPlace[]; date: string | null }> {
  const source = FINESS_FILE ? null : await latestResource(FR_FINESS_DATASET, /structure.*\.json|json.*structure/i);
  if (source) console.log(`FINESS: ${source.title} (${source.date ?? "date unknown"})`);
  let entities = 0;
  const kept: FrRegisterPlace[] = [];
  for await (const entity of jsonArrayItems(await openSource(FINESS_FILE, source?.url ?? null), "pmej")) {
    entities += 1;
    const sites = (entity as { ege?: unknown[] }).ege ?? [];
    for (const site of sites) {
      const place = finessPlaceFromSite(site);
      if (place) kept.push(place);
    }
  }
  if (entities === 0) throw new Error("FINESS: no legal entities in the file");
  const places = mergeFrPlaces(kept);
  console.log(`FINESS: ${entities} legal entities, ${places.length} centres kept.`);
  return { places, date: source?.date ?? null };
}

type Row = FrRegisterPlace & StoredPosition & { sourceDate: string };

async function upsert(client: pg.Client, rows: Row[]) {
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
        "FR", place.ccn, place.regionalCode, place.listing, place.centreClass, place.centreClassName, place.name, place.regionCode,
        place.regionName, place.provinceCode, place.provinceName, place.municipalityCode, place.municipalityName, place.street,
        place.postcode, place.phone, place.email, place.website, place.ownership, place.dependency, place.careCodes,
        place.lat, place.lng, place.geocodeSource, place.geocodedAddress, place.lat === null ? null : new Date(), place.sourceDate,
      ];
      return `(${row.map((value) => {
        values.push(value);
        return `$${values.length}`;
      }).join(", ")})`;
    });
    const updates = columns.filter((column) => column !== "ccn" && column !== "geocoded_at").map((column) => `${column} = excluded.${column}`);
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

async function geocodeMissing(client: pg.Client) {
  if (GEOCODE_LIMIT === 0) return;
  const { rows } = await client.query<{ ccn: string; geocoded_address: string; municipality_code: string | null }>(
    `select ccn, geocoded_address, municipality_code from care_register_places
     where country = 'FR' and withdrawn_at is null and lat is null and geocoded_address is not null
     order by province_code, ccn limit $1`,
    [GEOCODE_LIMIT],
  );
  // Practitioners sharing a practice share an address: look each up once.
  const byAddress = new Map<string, { address: string; municipalityCode: string | null; ccns: string[] }>();
  for (const row of rows) {
    const key = `${row.geocoded_address}|${row.municipality_code ?? ""}`;
    const entry = byAddress.get(key) ?? { address: row.geocoded_address, municipalityCode: row.municipality_code, ccns: [] };
    entry.ccns.push(row.ccn);
    byAddress.set(key, entry);
  }
  const addresses = Array.from(byAddress.values());
  console.log(`Geocoding ${rows.length} French places (${addresses.length} addresses) with BAN, ${GEOCODE_BATCH} per request.`);
  let found = 0;
  const startedAt = Date.now();
  for (let start = 0; start < addresses.length; start += GEOCODE_BATCH) {
    const batch = addresses.slice(start, start + GEOCODE_BATCH);
    const request = batch.map((entry, offset) => ({ id: String(start + offset), address: entry.address }));
    let results;
    try {
      results = await geocodeFrenchAddresses(request);
    } catch (error) {
      // One retry, then move on: a later run picks the batch up again.
      console.warn(`  batch at ${start} failed (${error instanceof Error ? error.message : error}); retrying once`);
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      results = await geocodeFrenchAddresses(request).catch(() => []);
    }
    const byId = new Map(results.map((result) => [result.id, result]));
    const placed: Array<[string, number, number, string]> = [];
    batch.forEach((entry, offset) => {
      const result = byId.get(String(start + offset));
      if (!result || result.lat === null || result.lng === null || !banResultFits(result, entry.municipalityCode)) return;
      for (const ccn of entry.ccns) placed.push([ccn, result.lat, result.lng, entry.address]);
    });
    if (placed.length) {
      await client.query(
        `update care_register_places p set lat = v.lat, lng = v.lng, geocode_source = 'ban', geocoded_at = now()
         from (select * from unnest($1::text[], $2::float8[], $3::float8[], $4::text[]) as t(ccn, lat, lng, address)) v
         where p.ccn = v.ccn and p.geocoded_address = v.address and p.lat is null`,
        [placed.map((item) => item[0]), placed.map((item) => item[1]), placed.map((item) => item[2]), placed.map((item) => item[3])],
      );
    }
    found += placed.length;
    const done = Math.min(addresses.length, start + GEOCODE_BATCH);
    const minutesLeft = Math.round(((Date.now() - startedAt) / done) * (addresses.length - done) / 60_000);
    console.log(`  ${done}/${addresses.length} addresses (${found} places placed, about ${minutesLeft} min left)`);
  }
  console.log(`Geocoded ${found} of ${rows.length}. Places not found keep no coordinates and still show in their own town.`);
}

async function main() {
  console.log(APPLY ? "APPLY: changes will be committed." : "DRY RUN: nothing will be committed. Pass --apply to write.");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  if (GEOCODE_ONLY) {
    await client.connect();
    try {
      await geocodeMissing(client);
    } finally {
      await client.end();
    }
    return;
  }

  const loaded = new Map<Listing, { places: FrRegisterPlace[]; date: string | null }>();
  if (LISTINGS.includes("RPPS")) loaded.set("RPPS", await loadRpps());
  if (LISTINGS.includes("FINESS")) loaded.set("FINESS", await loadFiness());
  const today = new Date().toISOString().slice(0, 10);

  await client.connect();
  try {
    const country = await client.query(
      `select 1 from information_schema.columns where table_schema = 'public' and table_name = 'care_register_places' and column_name = 'country'`,
    );
    if (country.rowCount === 0) fail("care_register_places has no country column. Apply migrations/0111_care_register_country.sql first.");
    const listingCheck = await client.query(
      `select pg_get_constraintdef(oid) as definition from pg_constraint where conname = 'care_register_places_listing_check'`,
    );
    if (!String(listingCheck.rows[0]?.definition ?? "").includes("RPPS")) fail("apply migrations/0112_care_register_france.sql first.");

    const stored = await client.query<{ ccn: string; listing: string; lat: number | null; lng: number | null; geocode_source: StoredPosition["geocodeSource"]; geocoded_address: string | null }>(
      `select ccn, listing, lat, lng, geocode_source, geocoded_address from care_register_places where country = 'FR' and withdrawn_at is null`,
    );
    const previous = new Map(stored.rows.map((row) => [row.ccn, {
      lat: row.lat, lng: row.lng, geocodeSource: row.geocode_source, geocodedAddress: row.geocoded_address,
    } satisfies StoredPosition]));
    for (const [listing, { places }] of loaded) {
      if (places.length < MIN_PLACES[listing]) fail(`${listing} has only ${places.length} places (expected at least ${MIN_PLACES[listing]}). Wrong or partial file; nothing was changed.`);
      const before = stored.rows.filter((row) => row.listing === listing).length;
      if (before > 0 && places.length < before * MIN_SHRINK_RATIO) {
        fail(`${listing} has ${places.length} places but ${before} are stored. The download is probably incomplete; nothing was changed.`);
      }
    }

    const rows: Row[] = [];
    for (const { places, date } of loaded.values()) {
      for (const place of places) {
        const address = frGeocodeAddress(place);
        const position: StoredPosition = place.registerPosition
          ? { lat: place.registerPosition.lat, lng: place.registerPosition.lng, geocodeSource: "register", geocodedAddress: address }
          : positionForImport(previous.get(place.ccn), address, undefined);
        rows.push({ ...place, ...position, sourceDate: date ?? today });
      }
    }
    const missing = rows.filter((row) => row.lat === null && row.geocodedAddress).length;
    console.log(`Places: ${rows.length}. With coordinates: ${rows.length - missing}. Still to geocode: ${missing}.`);

    await client.query("begin");
    const startedAt = (await client.query<{ now: Date }>("select now()")).rows[0].now;
    await upsert(client, rows);
    const withdrawn = await client.query(
      `update care_register_places set withdrawn_at = now()
       where country = 'FR' and listing = any($2::text[]) and withdrawn_at is null and last_seen_at < $1`,
      [startedAt, Array.from(loaded.keys())],
    );
    console.log(`Upserted ${rows.length}. Newly withdrawn (no longer in the register): ${withdrawn.rowCount}.`);
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
