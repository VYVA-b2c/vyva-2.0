import { describe, expect, it } from "vitest";
import {
  distanceKm,
  parseCareOffered,
  parseCentreClass,
  parseRegionalPosition,
  positionForImport,
  registerColumnIndex,
  registerDisplayAddress,
  registerDisplayName,
  registerGeocodeAddress,
  registerPlaceFromRow,
  registerPlaceIsRelevant,
  registerPlaceOffers,
  splitDelimitedLine,
  type RegisterPlace,
} from "./register";

// The C2 header exactly as the Ministry's file has it on 7 Oct 2026: embedded
// newlines, stray spaces before them, and a trailing empty column.
const C2_HEADER = [
  "Tipo centro", "Código de Centro Normalizado\nREGCESS (CCN)", "Código Autonómico\ndel Centro", "Nombre Centro",
  "Código Comunidad Autónoma", "Comunidad Autónoma", "Código Provincia", "Provincia", "Código Municipio", "Municipio",
  "Código\nTipo Vía", "Nombre de la vía", "Número\nVía", "Código\nPostal", "Correo \nElectrónico", "Fax", "Teléfono", "Url",
  "Código Dependencia\nFuncional", "Dependencia \nFuncional", "Área o Sector", "Grupo de dependencia \nFuncional",
  "Fecha Autorización \nde Funcionamiento", "Fecha de última \nAutorización", "Tipo de última\nAutorización",
  "Modificación Estructural", "Oferta Asistencial", null,
];
// E has no "Área o Sector" and no "Oferta Asistencial".
const E_HEADER = C2_HEADER.filter((cell) => cell !== "Área o Sector" && cell !== "Oferta Asistencial");

function c2Row(overrides: Partial<Record<string, string | null>> = {}): Array<string | null> {
  const values: Record<string, string | null> = {
    "Tipo centro": "C2590 - Otros Centros Especializados",
    "Código de Centro Normalizado\nREGCESS (CCN)": "0749001788",
    "Código Autonómico\ndel Centro": "49-C2590-0007",
    "Nombre Centro": "VEA CENTRO LASER DE OFTALMOLOGIA",
    "Código Comunidad Autónoma": "07",
    "Comunidad Autónoma": "Castilla y León",
    "Código Provincia": "49",
    "Provincia": "Zamora",
    "Código Municipio": "492755",
    "Municipio": "Zamora",
    "Código\nTipo Vía": "CALLE",
    "Nombre de la vía": "LUIS ULLOA PEREIRA",
    "Número\nVía": "4",
    "Código\nPostal": "49015",
    "Correo \nElectrónico": "",
    "Fax": "",
    "Teléfono": "980000000",
    "Url": "",
    "Código Dependencia\nFuncional": "20",
    "Dependencia \nFuncional": "Privados",
    "Área o Sector": null,
    "Grupo de dependencia \nFuncional": "Privados",
    "Oferta Asistencial": "U.35 Anestesia y Reanimación,U.50 Oftalmología,U.51 Cirugía refractiva,U.63 Cirugía mayor ambulatoria,",
    ...overrides,
  };
  return C2_HEADER.map((header) => (header === null ? null : values[header] ?? null));
}

const c2Index = registerColumnIndex(C2_HEADER);

function place(overrides: Partial<RegisterPlace>): RegisterPlace {
  return { ...registerPlaceFromRow(c2Row(), c2Index, "C2")!, ...overrides };
}

describe("reading the REGCESS files", () => {
  it("finds columns despite embedded newlines and double spaces", () => {
    expect(c2Index.ccn).toBe(1);
    expect(c2Index.email).toBe(14);
    expect(c2Index.ownershipGroup).toBe(21);
    expect(registerColumnIndex(E_HEADER).careOffered).toBe(-1);
  });

  it("refuses a file whose shape changed", () => {
    expect(() => registerColumnIndex(["Tipo centro", "Nombre"])).toThrow(/missing columns/);
  });

  it("parses a row into a place", () => {
    expect(registerPlaceFromRow(c2Row(), c2Index, "C2")).toEqual({
      ccn: "0749001788",
      regionalCode: "49-C2590-0007",
      listing: "C2",
      centreClass: "C2590",
      centreClassName: "Otros Centros Especializados",
      name: "VEA CENTRO LASER DE OFTALMOLOGIA",
      regionCode: "07",
      regionName: "Castilla y León",
      provinceCode: "49",
      provinceName: "Zamora",
      municipalityCode: "492755",
      municipalityName: "Zamora",
      street: "CALLE LUIS ULLOA PEREIRA 4",
      postcode: "49015",
      phone: "980000000",
      email: null,
      website: null,
      ownership: "private",
      dependency: "Privados",
      careCodes: ["U.35", "U.50", "U.51", "U.63"],
    });
  });

  it("treats the register's placeholder phones as missing", () => {
    for (const phone of ["0", "000000000", ""]) {
      expect(registerPlaceFromRow(c2Row({ Teléfono: phone }), c2Index, "C2")?.phone).toBeNull();
    }
  });

  it("skips pharmacies and first-aid kits, keeps opticians", () => {
    const eIndex = registerColumnIndex(E_HEADER);
    const eRow = (type: string) => E_HEADER.map((header) => {
      if (header === "Tipo centro") return type;
      if (header === null) return null;
      return c2Row()[C2_HEADER.indexOf(header)];
    });
    expect(registerPlaceFromRow(eRow("E1 - Oficinas de farmacia"), eIndex, "E")).toBeNull();
    expect(registerPlaceFromRow(eRow("E2 - Botiquines"), eIndex, "E")).toBeNull();
    expect(registerPlaceFromRow(eRow("E5 - Establecimientos de  audioprotesis"), eIndex, "E")).toMatchObject({
      centreClass: "E5", centreClassName: "Establecimientos de audioprotesis", careCodes: [],
    });
  });

  it("reads care codes even when names contain commas", () => {
    expect(parseCareOffered("U.1 Medicina general/de familia,U.100 Transporte sanitario (carretera, aéreo, marítimo),U.102  Medicina Legal y Forense,"))
      .toEqual(["U.1", "U.100", "U.102"]);
    expect(parseCareOffered("U.900 Otras unidades asistenciales,")).toEqual(["U.900"]);
    expect(parseCareOffered(null)).toEqual([]);
  });

  it("splits the centre class code from its name", () => {
    expect(parseCentreClass("C251 - Clínicas Dentales")).toEqual(["C251", "Clínicas Dentales"]);
    expect(parseCentreClass("C3 - Servicios sanitarios integrados en una organizacion no sanitaria")[0]).toBe("C3");
  });

  it("builds a geocoder address and readable names", () => {
    const parsed = registerPlaceFromRow(c2Row(), c2Index, "C2")!;
    expect(registerGeocodeAddress(parsed)).toBe("CALLE LUIS ULLOA PEREIRA 4, 49015 Zamora, Zamora");
    expect(registerDisplayName(parsed)).toBe("Vea Centro Laser de Oftalmologia");
    expect(registerDisplayAddress(parsed)).toBe("Calle Luis Ulloa Pereira 4, 49015 Zamora");
  });
});

describe("which places Care Finder may show", () => {
  it("matches care by its authorised code", () => {
    expect(registerPlaceOffers(place({ careCodes: ["U.59"] }), "physiotherapy", "private")).toBe(true);
    expect(registerPlaceOffers(place({ careCodes: ["U.48"] }), "physiotherapy", "private")).toBe(false);
    expect(registerPlaceOffers(place({ careCodes: ["U.50"] }), "ophthalmology", "private")).toBe(true);
  });

  it("matches opticians and hearing centres by establishment class", () => {
    expect(registerPlaceOffers(place({ centreClass: "E3", careCodes: [] }), "optician", "private")).toBe(true);
    expect(registerPlaceOffers(place({ centreClass: "E5", careCodes: [] }), "hearing_centre", "private")).toBe(true);
    expect(registerPlaceOffers(place({ centreClass: "E4", careCodes: [] }), "hearing_centre", "private")).toBe(false);
  });

  it("never offers care-home, mobile or driving-licence units", () => {
    for (const centreClass of ["C3", "C257", "C2510"]) {
      expect(registerPlaceOffers(place({ centreClass, careCodes: ["U.59"] }), "physiotherapy", "private")).toBe(false);
    }
  });

  it("uses public health centres for the public route to a family doctor", () => {
    const centre = place({ centreClass: "C231", ownership: "public", careCodes: ["U.1", "U.2"] });
    expect(registerPlaceOffers(centre, "primary_care", "public")).toBe(true);
    expect(registerPlaceOffers(place({ centreClass: "C21", ownership: "private", careCodes: ["U.1"] }), "primary_care", "public")).toBe(false);
    expect(registerPlaceOffers(centre, "primary_care", "private")).toBe(false);
  });

  it("only offers private places for care the public system reaches by referral", () => {
    expect(registerPlaceOffers(place({ ownership: "public", careCodes: ["U.59"] }), "physiotherapy", "public")).toBe(false);
    expect(registerPlaceOffers(place({ ownership: "private", careCodes: ["U.59"] }), "physiotherapy", "public")).toBe(true);
  });

  it("finds general health psychologists filed under other units only by name", () => {
    expect(registerPlaceOffers(place({ name: "ALBA FAUNDEZ PSICOLOGIA", careCodes: ["U.900"] }), "psychology", "private")).toBe(true);
    expect(registerPlaceOffers(place({ name: "CENTRO DE ESTETICA", careCodes: ["U.900"] }), "psychology", "private")).toBe(false);
    expect(registerPlaceOffers(place({ name: "CLINICA SALUD MENTAL", careCodes: ["U.70"] }), "psychology", "private")).toBe(true);
  });

  it("keeps only places some search could show", () => {
    expect(registerPlaceIsRelevant(place({ careCodes: ["U.72"] }))).toBe(false);
    expect(registerPlaceIsRelevant(place({ careCodes: ["U.44"] }))).toBe(true);
  });
});

describe("coordinates", () => {
  const address = "CALLE LUIS ULLOA PEREIRA 4, 49015 Zamora, Zamora";

  it("prefers the regional register's position", () => {
    expect(positionForImport(undefined, address, { lat: 41.5, lng: -5.7 })).toEqual({
      lat: 41.5, lng: -5.7, geocodeSource: "regional_register", geocodedAddress: address,
    });
  });

  it("keeps a geocoded point until the address changes", () => {
    const stored = { lat: 41.5, lng: -5.7, geocodeSource: "cartociudad" as const, geocodedAddress: address };
    expect(positionForImport(stored, address, undefined)).toBe(stored);
    expect(positionForImport(stored, "CALLE NUEVA 1, 49015 Zamora, Zamora", undefined)).toMatchObject({ lat: null, geocodeSource: null });
  });

  it("reads Castilla y León positions and rejects points outside Spain", () => {
    expect(parseRegionalPosition("41.510876, -5.734168")).toEqual({ lat: 41.510876, lng: -5.734168 });
    expect(parseRegionalPosition("28.1, -15.4")).toEqual({ lat: 28.1, lng: -15.4 });
    expect(parseRegionalPosition("0, 0")).toBeNull();
    expect(parseRegionalPosition("")).toBeNull();
  });

  it("splits semicolon lines with quotes", () => {
    expect(splitDelimitedLine('ALBA;49-C22-0218;"CL. A; B";41.5, -5.7')).toEqual(["ALBA", "49-C22-0218", "CL. A; B", "41.5, -5.7"]);
  });

  it("measures straight-line distance", () => {
    // Zamora to Benavente: about 56 km in a straight line.
    expect(distanceKm({ lat: 41.5035, lng: -5.7446 }, { lat: 42.0031, lng: -5.6783 })).toBeCloseTo(55.8, 0);
  });
});
