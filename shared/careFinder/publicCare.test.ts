import { describe, expect, it } from "vitest";
import { chooseAssignedCentre, normaliseCentreName } from "./publicCare";

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
});
