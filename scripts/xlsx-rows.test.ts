import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { columnIndex, decodeXml, forEachXlsxRow, parseRow } from "./xlsx-rows";

function xlsx(sheetRows: string, sharedStrings?: string[], sheetName = "sheet1"): Uint8Array {
  const files: Record<string, Uint8Array> = {
    [`xl/worksheets/${sheetName}.xml`]: strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><worksheet><cols><col min="1" max="3"/></cols><sheetData>${sheetRows}</sheetData></worksheet>`,
    ),
  };
  if (sharedStrings) {
    files["xl/sharedStrings.xml"] = strToU8(`<sst>${sharedStrings.map((value) => `<si><t>${value}</t></si>`).join("")}</sst>`);
  }
  return zipSync(files);
}

function read(file: Uint8Array) {
  const rows: Array<Array<string | null>> = [];
  const count = forEachXlsxRow(file, (cells) => rows.push(cells));
  return { rows, count };
}

describe("forEachXlsxRow", () => {
  it("reads shared strings, inline strings, numbers and gaps in column order", () => {
    const file = xlsx(
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="inlineStr"><is><t>Oferta Asistencial</t></is></c></row>'
      + '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" s="3"/><c r="C2"><v>0749000897</v></c><c r="D2" t="str"><v>U.1 Medicina general/de familia,U.100 Transporte (carretera, aéreo),</v></c></row>',
      ["Tipo centro", "Código de Centro Normalizado\nREGCESS (CCN)", "C11 - Hospitales Generales"],
    );
    expect(read(file)).toEqual({
      count: 2,
      rows: [
        ["Tipo centro", "Código de Centro Normalizado\nREGCESS (CCN)", null, "Oferta Asistencial"],
        ["C11 - Hospitales Generales", null, "0749000897", "U.1 Medicina general/de familia,U.100 Transporte (carretera, aéreo),"],
      ],
    });
  });

  it("joins rich-text runs and decodes entities", () => {
    const file = zipSync({
      "xl/sharedStrings.xml": strToU8('<sst><si><r><t>CLÍNICA </t></r><r><rPr/><t xml:space="preserve">A &amp; B</t></r></si><si/></sst>'),
      "xl/worksheets/sheet1.xml": strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="b"><v>1</v></c></row></sheetData></worksheet>'),
    });
    expect(read(file).rows).toEqual([["CLÍNICA A & B", null, "TRUE"]]);
  });

  it("streams a sheet far larger than one chunk without losing rows", () => {
    const rows = Array.from({ length: 20_000 }, (_, index) => (
      `<row r="${index + 1}"><c r="A${index + 1}" t="inlineStr"><is><t>CENTRO ${index} &lt;ZAMORA&gt;</t></is></c><c r="B${index + 1}"><v>${index}</v></c></row>`
    )).join("");
    const { rows: read20k, count } = read(xlsx(rows));
    expect(count).toBe(20_000);
    expect(read20k[0]).toEqual(["CENTRO 0 <ZAMORA>", "0"]);
    expect(read20k[19_999]).toEqual(["CENTRO 19999 <ZAMORA>", "19999"]);
  });

  it("reads the lowest-numbered sheet when the file has several", () => {
    const file = zipSync({
      "xl/worksheets/sheet2.xml": strToU8('<worksheet><sheetData><row><c t="inlineStr"><is><t>second</t></is></c></row></sheetData></worksheet>'),
      "xl/worksheets/sheet1.xml": strToU8('<worksheet><sheetData><row><c t="inlineStr"><is><t>first</t></is></c></row></sheetData></worksheet>'),
    });
    expect(read(file).rows).toEqual([["first"]]);
  });

  it("refuses a file with no worksheet", () => {
    expect(() => forEachXlsxRow(zipSync({ "docProps/app.xml": strToU8("<x/>") }), () => undefined)).toThrow(/No worksheet/);
  });
});

describe("helpers", () => {
  it("maps column letters to positions", () => {
    expect([columnIndex("A1"), columnIndex("Z9"), columnIndex("AA10"), columnIndex("AB2")]).toEqual([0, 25, 26, 27]);
  });

  it("decodes numeric entities", () => {
    expect(decodeXml("&#209;&#xF1;")).toBe("Ññ");
  });

  it("places cells without references one after another", () => {
    expect(parseRow('<row><c t="inlineStr"><is><t>a</t></is></c><c><v>2</v></c></row>', [])).toEqual(["a", "2"]);
  });
});
