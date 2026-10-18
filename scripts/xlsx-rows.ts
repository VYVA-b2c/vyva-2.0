// Reads the first worksheet of an .xlsx file one row at a time.
//
// The REGCESS C2 file has 119,000 rows; reading it whole takes over 1 GB of
// memory, enough to get the Replit workspace shell killed. This streams the
// sheet XML out of the zip and hands over each row as it is parsed, so only
// the shared-string table and one chunk of XML are held at once.
//
// Covers what spreadsheet exports use: shared strings, inline strings,
// formula strings, numbers and booleans. Cells come back as strings (or null
// when empty), positioned by their column letter.
import { Unzip, UnzipInflate, unzipSync } from "fflate";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };

export function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
    if (entity[0] !== "#") return ENTITIES[entity.toLowerCase()] ?? "";
    const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : "";
  });
}

/** All text in an element, joining rich-text runs (<r><t>…</t></r>). */
function innerText(xml: string): string {
  let text = "";
  for (const match of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)) text += match[1] ?? "";
  return decodeXml(text);
}

export function parseSharedStrings(xml: string): string[] {
  return Array.from(xml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g), (match) => innerText(match[1] ?? ""));
}

/** "A" → 0, "Z" → 25, "AA" → 26. */
export function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/.exec(reference)?.[0] ?? "";
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

const CELL = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;

export function parseRow(rowXml: string, sharedStrings: readonly string[]): Array<string | null> {
  const cells: Array<string | null> = [];
  let next = 0;
  for (const match of rowXml.matchAll(CELL)) {
    const attributes = match[1];
    const body = match[2] ?? "";
    const reference = /\br="([A-Z]+)\d*"/.exec(attributes)?.[1];
    const position = reference ? columnIndex(reference) : next;
    next = position + 1;
    const type = /\bt="([^"]+)"/.exec(attributes)?.[1];
    const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
    let value: string | null;
    if (type === "s") value = raw === undefined ? null : sharedStrings[Number(raw)] ?? null;
    else if (type === "inlineStr") value = innerText(body);
    else if (type === "b") value = raw === undefined ? null : raw === "1" ? "TRUE" : "FALSE";
    else value = raw === undefined ? null : decodeXml(raw);
    while (cells.length < position) cells.push(null);
    cells[position] = value === "" ? null : value;
  }
  return cells;
}

function firstSheetName(names: Iterable<string>): string | null {
  const sheets = Array.from(names).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  sheets.sort((left, right) => Number(/\d+/.exec(left.slice(14))?.[0]) - Number(/\d+/.exec(right.slice(14))?.[0]));
  return sheets[0] ?? null;
}

/** Calls onRow for every row of the first worksheet, in order. */
export function forEachXlsxRow(file: Uint8Array, onRow: (cells: Array<string | null>) => void): number {
  // Pass 1: list entries and read only the shared strings (small next to the sheet).
  const names: string[] = [];
  const shared = unzipSync(file, {
    filter: (entry) => {
      names.push(entry.name);
      return entry.name === "xl/sharedStrings.xml";
    },
  })["xl/sharedStrings.xml"];
  const sharedStrings = shared ? parseSharedStrings(new TextDecoder().decode(shared)) : [];
  const sheetName = firstSheetName(names);
  if (!sheetName) throw new Error("No worksheet found in the .xlsx file");

  // Pass 2: inflate the sheet chunk by chunk and parse complete rows as they arrive.
  const decoder = new TextDecoder();
  let pending = "";
  let rows = 0;
  let failure: unknown = null;
  const drain = (final: boolean) => {
    let end = pending.indexOf("</row>");
    let consumed = 0;
    while (end >= 0) {
      const start = pending.lastIndexOf("<row", end);
      onRow(parseRow(pending.slice(start, end), sharedStrings));
      rows += 1;
      consumed = end + 6;
      end = pending.indexOf("</row>", consumed);
    }
    pending = pending.slice(consumed);
    if (final) pending = "";
  };
  const unzip = new Unzip((entry) => {
    if (entry.name !== sheetName) return;
    entry.ondata = (error, chunk, final) => {
      if (error) {
        failure = error;
        return;
      }
      try {
        pending += decoder.decode(chunk, { stream: !final });
        drain(final);
      } catch (thrown) {
        failure = thrown;
      }
    };
    entry.start();
  });
  unzip.register(UnzipInflate);
  // Feed the zip in slices so inflated data is handed over as it is produced.
  const SLICE = 1 << 20;
  for (let offset = 0; offset < file.length; offset += SLICE) {
    unzip.push(file.subarray(offset, offset + SLICE), offset + SLICE >= file.length);
    if (failure) throw failure;
  }
  if (failure) throw failure;
  return rows;
}
