import { describe, expect, it } from "vitest";
import {
  REGION_BOOKING,
  castillaLeonHealthMapRows,
  castillaLeonProvinceCode,
  chooseAssignedCentre,
  normaliseCentreName,
  normaliseMunicipalityName,
  regionBooking,
} from "./publicCare";
import { splitDelimitedLine } from "./register";

describe("normaliseCentreName", () => {
  it.each([
    ["C.S. PUERTA NUEVA", "puerta nueva"],
    ["CENTRO DE SALUD PUERTA NUEVA", "puerta nueva"],
    ["Centro de Salud de Puerta Nueva", "puerta nueva"],
    ["CONSULTORIO LOCAL DE FIGUERUELA DE ARRIBA", "figueruela de arriba"],
    ["CONSULTORIO DE ATENCION PRIMARIA DE LA TEJERA", "tejera"],
    ["C.S. Benavente Norte", "benavente norte"],
    ["Alcañices", "alcanices"],
  ])("%s → %s", (input, expected) => {
    expect(normaliseCentreName(input)).toBe(expected);
  });
});

describe("chooseAssignedCentre", () => {
  const candidates = [
    { id: "a", name: "CONSULTORIO LOCAL DE VILLARALBO", km: 0.8 },
    { id: "b", name: "CENTRO DE SALUD PUERTA NUEVA", km: 2.1 },
  ];

  it("uses the health map when its centre is a candidate", () => {
    expect(chooseAssignedCentre(candidates, ["C.S. Puerta Nueva"])).toEqual({ id: "b", basis: "health_map" });
  });

  it("falls back to the closest when the map names no candidate, or there is no map", () => {
    expect(chooseAssignedCentre(candidates, ["C.S. Somewhere Else"])).toEqual({ id: "a", basis: "nearest" });
    expect(chooseAssignedCentre(candidates, null)).toEqual({ id: "a", basis: "nearest" });
  });

  it("returns nothing without candidates", () => {
    expect(chooseAssignedCentre([], ["C.S. Puerta Nueva"])).toBeNull();
  });

  it("names a town-only centre from the health map, but never calls one the nearest", () => {
    const unplaced = [{ id: "c", name: "CENTRO DE SALUD PUERTA NUEVA", km: null }];
    expect(chooseAssignedCentre(unplaced, ["C.S. Puerta Nueva"])).toEqual({ id: "c", basis: "health_map" });
    expect(chooseAssignedCentre(unplaced, null)).toBeNull();
  });
});

describe("centre names as the health map and the register write them", () => {
  // Pairs checked against the live files on 7 Oct 2026: the register often
  // names a rural centre after its zone, the map after its town.
  it.each([
    ["CENTRO DE SALUD DE ALISTE", "ALISTE"],
    ["CENTRO DE SALUD CAMPOS-LAMPREANA", "CAMPOS LAMPREANA"],
    ["CENTRO DE SALUD LA GUAREÑA", "C.S. LA GUAREÑA"],
    ["CENTRO DE SALUD PUERTA NUEVA", "C.S. PUERTA NUEVA"],
    ["CENTRO DE SALUD DE ZAMORA NORTE", "C.S. ZAMORA NORTE"],
  ])("%s matches %s", (register, map) => {
    expect(normaliseCentreName(register)).toBe(normaliseCentreName(map));
  });

  it("never matches a longer name by substring", () => {
    expect(normaliseCentreName("CENTRO DE SALUD SANABRIA")).not.toBe(normaliseCentreName("C.S. ALTA SANABRIA"));
  });
});

describe("Castilla y León health map", () => {
  it("normalises municipality spellings", () => {
    expect(normaliseMunicipalityName("BAÑEZA (LA)")).toBe("la baneza");
    expect(normaliseMunicipalityName("Bañeza, La")).toBe("la baneza");
    expect(normaliseMunicipalityName("Alcañices")).toBe("alcanices");
    expect(normaliseMunicipalityName("ALCAÑICES")).toBe("alcanices");
  });

  it("finds the province from the management area", () => {
    expect(castillaLeonProvinceCode("G.A.S. ZAMORA")).toBe("49");
    expect(castillaLeonProvinceCode("G.A.P. BURGOS")).toBe("09");
    expect(castillaLeonProvinceCode("G.A.S. EL BIERZO")).toBe("24");
    expect(castillaLeonProvinceCode("G.A.P. VALLADOLID ESTE")).toBe("47");
    expect(castillaLeonProvinceCode("ELSEWHERE")).toBeNull();
  });

  it("maps municipalities to codes from the register and reports names it can't place", () => {
    // Header and lines verbatim from the Junta's file (7 Oct 2026).
    const lines = [
      "NOMBRE GERENCIA;CÓDIGO ZONA;NOMBRE ZONA;NOMBRE CENTRO SALUD;MUNICIPIO;PAC",
      "G.A.S. ZAMORA;171117;TORO;C.S. TORO;ABEZAMES;P.A.C. Toro",
      "G.A.S. ZAMORA;171102;ALISTE;C.S. ALCAÑICES;ALCAÑICES;P.A.C. Alcañices",
      "G.A.S. ZAMORA;171111;DIEGO DE LOSADA;C.S. PUERTA NUEVA;ZAMORA;P.A.C. Zamora Integrado",
      "G.A.S. ZAMORA;171111;DIEGO DE LOSADA;C.S. PUERTA NUEVA;ZAMORA;P.A.C. Zamora Integrado",
      "G.A.P. BURGOS;170205;BRIVIESCA;C.S. BRIVIESCA;ABAJAS;P.A.C. Briviesca",
    ].map((line) => splitDelimitedLine(line));
    const municipalities = new Map([["49", new Map([["alcanices", "490034"], ["zamora", "492755"]])]]);
    const { rows, unmatched } = castillaLeonHealthMapRows(lines, municipalities);
    expect(rows).toEqual([
      { municipalityCode: "49003", municipalityName: "ALCAÑICES", regionCode: "07", zoneName: "ALISTE", centreName: "C.S. ALCAÑICES" },
      { municipalityCode: "49275", municipalityName: "ZAMORA", regionCode: "07", zoneName: "DIEGO DE LOSADA", centreName: "C.S. PUERTA NUEVA" },
    ]);
    expect(unmatched).toEqual(["G.A.S. ZAMORA: ABEZAMES", "G.A.P. BURGOS: ABAJAS"]);
  });

  it("refuses a file whose header changed", () => {
    expect(() => castillaLeonHealthMapRows([["A", "B"]], new Map())).toThrow(/unexpected header/);
  });
});

describe("regional booking pages", () => {
  it("lists only official https pages, with what each asks for in every language", () => {
    for (const [code, booking] of Object.entries(REGION_BOOKING)) {
      expect(code).toMatch(/^(0[1-9]|1[0-9])$/);
      expect(booking.url).toMatch(/^https:\/\/[^/]*(gob\.es|juntadeandalucia\.es|saludinforma\.es|ibsalut\.es|gobiernodecanarias\.org|scsalud\.es|saludcastillayleon\.es|castillalamancha\.es|gencat\.cat|ses\.es|sergas\.gal|comunidad\.madrid|carm\.es|riojasalud\.es|osakidetza\.eus)\//);
      for (const lang of ["en", "es", "fr", "de"] as const) {
        expect(booking.name[lang]).toBeTruthy();
        if (booking.needs) expect(booking.needs[lang]).toBeTruthy();
      }
    }
  });

  it("leaves out regions whose page couldn't be opened", () => {
    expect(regionBooking("07")?.app).toBe("Sacyl Conecta");
    for (const code of ["03", "10", "15"]) expect(regionBooking(code)).toBeNull();
    expect(regionBooking("16")?.url).toMatch(/^https:\/\/zitaberria\.osakidetza\.eus\//);
    expect(regionBooking(null)).toBeNull();
  });
});
