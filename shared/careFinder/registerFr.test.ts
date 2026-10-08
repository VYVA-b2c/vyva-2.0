import { describe, expect, it } from "vitest";
import {
  banResultFits,
  finessCareTypes,
  finessPlaceFromSite,
  frenchPhone,
  frenchTitleCase,
  mergeFrPlaces,
  rppsCareTypes,
  rppsColumnIndex,
  rppsPlaceFromRow,
} from "./registerFr";
import { registerCandidateFilter, registerDisplayAddress, registerDisplayName, registerPlaceOffers } from "./register";

// The header of PS_LibreAcces_Personne_activite.txt as published on 8 October 2026.
const HEADER: string[] = ["Type d'identifiant PP", "Identifiant PP", "Identification nationale PP", "Code civilité d'exercice", "Libellé civilité d'exercice", "Code civilité", "Libellé civilité", "Nom d'exercice", "Prénom d'exercice", "Code profession", "Libellé profession", "Code catégorie professionnelle", "Libellé catégorie professionnelle", "Code type savoir-faire", "Libellé type savoir-faire", "Code savoir-faire", "Libellé savoir-faire", "Code mode exercice", "Libellé mode exercice", "Numéro SIRET site", "Numéro SIREN site", "Numéro FINESS site", "Numéro FINESS établissement juridique", "Identifiant technique de la structure", "Raison sociale site", "Enseigne commerciale site", "Complément destinataire (coord. structure)", "Complément point géographique (coord. structure)", "Numéro Voie (coord. structure)", "Indice répétition voie (coord. structure)", "Code type de voie (coord. structure)", "Libellé type de voie (coord. structure)", "Libellé Voie (coord. structure)", "Mention distribution (coord. structure)", "Bureau cedex (coord. structure)", "Code postal (coord. structure)", "Code commune (coord. structure)", "Libellé commune (coord. structure)", "Code pays (coord. structure)", "Libellé pays (coord. structure)", "Téléphone (coord. structure)", "Téléphone 2 (coord. structure)", "Télécopie (coord. structure)", "Adresse e-mail (coord. structure)", "Code Département (structure)", "Libellé Département (structure)", "Ancien identifiant de la structure", "Autorité d'enregistrement", "Code secteur d'activité", "Libellé secteur d'activité", "Code section tableau pharmaciens", "Libellé section tableau pharmaciens", "Code rôle", "Libellé rôle", "Code genre activité", "Libellé genre activité"];
const index = rppsColumnIndex(HEADER);

function row(fields: Record<string, string>): string[] {
  const cells = HEADER.map(() => "");
  for (const [name, value] of Object.entries(fields)) {
    const position = HEADER.indexOf(name);
    if (position < 0) throw new Error(`no column ${name}`);
    cells[position] = value;
  }
  return cells;
}

// Real rows from the same file (8 October 2026).
const gp = {
  "Identifiant PP": "10000013994", "Code civilité d'exercice": "DR", "Nom d'exercice": "LAROCHAIX", "Prénom d'exercice": "Yves",
  "Code profession": "10", "Libellé profession": "Médecin", "Code savoir-faire": "SM53", "Libellé savoir-faire": "Spécialiste en Médecine Générale",
  "Code mode exercice": "L", "Raison sociale site": "CABINET DU DR YVES LAROCHAIX", "Numéro Voie (coord. structure)": "6",
  "Libellé Voie (coord. structure)": "RUE DU GENERAL DE GAULLE", "Code postal (coord. structure)": "97150",
  "Code commune (coord. structure)": "97801", "Libellé commune (coord. structure)": "Saint-Martin", "Téléphone (coord. structure)": "0590875749",
};
const optician = {
  "Identifiant PP": "10006122583", "Nom d'exercice": "MEDDAH-LAÏD", "Prénom d'exercice": "Leila", "Code profession": "28",
  "Libellé profession": "Opticien-Lunetier", "Code mode exercice": "S", "Numéro SIRET site": "81011772100029",
  "Raison sociale site": "ANNE & VALENTIN TOURNEURS", "Enseigne commerciale site": "ANNE ET VALENTIN", "Libellé type de voie (coord. structure)": "Rue",
  "Libellé Voie (coord. structure)": "DES TOURNEURS", "Code postal (coord. structure)": "31000", "Code commune (coord. structure)": "31555",
  "Libellé commune (coord. structure)": "Toulouse",
};

describe("RPPS", () => {
  it("reads the published header and refuses a file that changed shape", () => {
    expect(index.profession).toBe(9);
    expect(() => rppsColumnIndex(["Identifiant PP", "Nom d'exercice"])).toThrow(/missing columns/);
  });

  it("keeps a liberal family doctor as a named practitioner at their practice", () => {
    const place = rppsPlaceFromRow(row(gp), index)!;
    expect(place).toMatchObject({
      country: "FR", listing: "RPPS", regionalCode: "10000013994", centreClass: "10", name: "Dr Yves Larochaix",
      street: "6 Rue du General de Gaulle", postcode: "97150", municipalityCode: "97801", municipalityName: "Saint-Martin",
      provinceCode: "978", phone: "05 90 87 57 49", careCodes: ["fr:primary_care", "fr:same_day"],
    });
    expect(place.ccn).toMatch(/^FR-RPPS:10000013994:[0-9a-f]{12}$/);
    expect(registerDisplayName(place)).toBe("Dr Yves Larochaix");
    expect(registerDisplayAddress(place)).toBe("6 Rue du General de Gaulle, 97150 Saint-Martin");
  });

  it("keeps an optician's shop, not each employee, under its trade name", () => {
    const place = rppsPlaceFromRow(row(optician), index)!;
    expect(place).toMatchObject({ ccn: "FR-SITE:28:81011772100029", name: "Anne et Valentin", street: "Rue des Tourneurs", careCodes: ["fr:optician"] });
    const colleague = rppsPlaceFromRow(row({ ...optician, "Identifiant PP": "10000000001", "Nom d'exercice": "DUPONT" }), index)!;
    expect(mergeFrPlaces([place, colleague])).toHaveLength(1);
  });

  it("skips salaried doctors, professions Care Finder doesn't search, and rows without an address", () => {
    expect(rppsPlaceFromRow(row({ ...gp, "Code mode exercice": "S" }), index)).toBeNull();
    expect(rppsPlaceFromRow(row({ ...gp, "Code profession": "60" }), index)).toBeNull();
    expect(rppsPlaceFromRow(row({ ...gp, "Libellé savoir-faire": "Radio-diagnostic" }), index)).toBeNull();
    expect(rppsPlaceFromRow(row({ ...gp, "Code postal (coord. structure)": "" }), index)).toBeNull();
  });

  it("maps professions and specialties to care types by their published labels", () => {
    expect(rppsCareTypes("10", "Qualifié en Médecine Générale")).toEqual(["primary_care", "same_day"]);
    expect(rppsCareTypes("10", "Médecine Générale")).toEqual(["primary_care", "same_day"]);
    expect(rppsCareTypes("10", "Ophtalmologie")).toEqual(["ophthalmology"]);
    expect(rppsCareTypes("10", "O.R.L et chirurgie cervico faciale")).toEqual(["ent"]);
    expect(rppsCareTypes("10", "Oto-rhino-laryngologie")).toEqual(["ent"]);
    expect(rppsCareTypes("10", "Neurologie")).toEqual(["neurology"]);
    expect(rppsCareTypes("10", "Neuro-chirurgie")).toEqual([]);
    expect(rppsCareTypes("10", "Chirurgie orthopédique et traumatologie")).toEqual(["orthopaedics"]);
    expect(rppsCareTypes("40", null)).toEqual(["dentist", "urgent_dentist"]);
    expect(rppsCareTypes("70", null)).toEqual(["physiotherapy"]);
    expect(rppsCareTypes("26", null)).toEqual(["hearing_centre"]);
    expect(rppsCareTypes("93", null)).toEqual(["psychology"]);
  });

  it("merges one practitioner's specialties at the same site", () => {
    const one = rppsPlaceFromRow(row(gp), index)!;
    const two = rppsPlaceFromRow(row({ ...gp, "Libellé savoir-faire": "Neurologie", "Téléphone (coord. structure)": "" }), index)!;
    const [merged] = mergeFrPlaces([one, two]);
    expect(merged.careCodes).toEqual(["fr:primary_care", "fr:same_day", "fr:neurology"]);
    expect(merged.phone).toBe("05 90 87 57 49");
  });

  it("expands a street type written into the street name", () => {
    const place = rppsPlaceFromRow(row({ ...gp, "Numéro Voie (coord. structure)": "55", "Libellé Voie (coord. structure)": "R DENIS PAPIN" }), index)!;
    expect(place.street).toBe("55 Rue Denis Papin");
  });
});

// Real sites from the FINESS structures file; events and engagements trimmed.
const multiPractice = {
  informationsGeneralesEGE: { egeId: "525", nomEgeCourt: "MAISON DE SANTE PONT-D'AIN", nomEgeLong: "MAISON DE SANTE PONT-D'AIN", numFinessEge: "010009496", siret: "79008281200013" },
  categorieentiteGeographiqueExercice: "603",
  adresse: [{
    usageAdresse: "03", numeroVoie: "16", typeVoie: "R", libelleVoie: "DU 1ER SEPTEMBRE 1944", cogCommune: "01304", ligneAcheminement: "PONT D AIN",
    codePostal: "01160",
    // ANS's sample layout: WGS84 in direction*, Lambert in coordonnee*.
    coordonneesGeographique: { coordonneeX: "6552608.95", coordonneeY: "880459.31", directionLatitude: "46.049236", directionLongitude: "5.334156" },
  }],
  contact: [{ typeContact: { roleContact: "01" }, telecom: { telephone: "0474397900" } }],
  etatObjet: "A",
};
const dentalCentre = {
  informationsGeneralesEGE: { egeId: "655", nomEgeCourt: "CENTRE DE SANTE FERNEY-VOLTAIRE", nomEgeLong: "CENTRE DE SANTE DENTAIRE FERNEY-VOLTAIRE", numFinessEge: "010011468" },
  categorieentiteGeographiqueExercice: "124",
  adresse: [{
    usageAdresse: "03", numeroVoie: "26", typeVoie: "AV", libelleVoie: "VOLTAIRE", cogCommune: "01160", ligneAcheminement: "FERNEY VOLTAIRE CEDEX",
    codePostal: "01210",
    // The September 2026 monthly file's layout: the other way round.
    coordonneesGeographique: { coordonneeX: "6.111815", coordonneeY: "46.257688", directionLatitude: "6577813.0", directionLongitude: "939642.76" },
  }],
  contact: [],
  etatObjet: "A",
};

describe("FINESS", () => {
  it("keeps a multi-professional practice as family doctors, with the register's own position", () => {
    expect(finessPlaceFromSite(multiPractice)).toMatchObject({
      country: "FR", ccn: "FR-FINESS:010009496", listing: "FINESS", centreClass: "603", name: "Maison de Sante Pont-d'Ain",
      street: "16 Rue du 1er Septembre 1944", postcode: "01160", municipalityCode: "01304", municipalityName: "Pont d Ain",
      provinceCode: "01", phone: "04 74 39 79 00", careCodes: ["fr:primary_care", "fr:same_day"],
      registerPosition: { lat: 46.049236, lng: 5.334156 },
    });
  });

  it("reads the position whichever way round the file stores it, and drops CEDEX from the town", () => {
    expect(finessPlaceFromSite(dentalCentre)).toMatchObject({
      name: "Centre de Sante Dentaire Ferney-Voltaire", municipalityName: "Ferney Voltaire", phone: null,
      careCodes: ["fr:dentist", "fr:urgent_dentist"], registerPosition: { lat: 46.257688, lng: 6.111815 },
    });
  });

  it("skips closed sites and categories Care Finder doesn't search", () => {
    expect(finessPlaceFromSite({ ...multiPractice, etatObjet: "I" })).toBeNull();
    expect(finessPlaceFromSite({ ...multiPractice, categorieentiteGeographiqueExercice: "620" })).toBeNull();
  });

  it("sorts health centres by what their registered name says they do", () => {
    expect(finessCareTypes("124", "CENTRE DE SANTE DU PAYS DE GEX")).toEqual(["primary_care", "same_day"]);
    expect(finessCareTypes("124", "CENTRE DE SANTE MEDICO-DENTAIRE VALSERHONE")).toEqual(["dentist", "urgent_dentist", "primary_care", "same_day"]);
    expect(finessCareTypes("124", "CENTRE RENNAIS D'OPHTALMOLOGIE")).toEqual(["ophthalmology"]);
    expect(finessCareTypes("124", "CENTRE DE SANTÉ INFIRMIER DE VIC SUR AISNE")).toEqual([]);
    expect(finessCareTypes("124", "CSI AMSAM SOISSONS")).toEqual([]);
  });
});

describe("French formatting", () => {
  it("title-cases addresses with lower-case joining words and ordinals", () => {
    expect(frenchTitleCase("RUE DE LA PAIX")).toBe("Rue de la Paix");
    expect(frenchTitleCase("SAINT-ETIENNE-DU-BOIS")).toBe("Saint-Etienne-du-Bois");
    expect(frenchTitleCase("PARIS 16E ARRONDISSEMENT")).toBe("Paris 16e Arrondissement");
    expect(frenchTitleCase("LE GALL", { particles: false })).toBe("Le Gall");
  });
  it("groups phone numbers the French way", () => {
    expect(frenchPhone("0145678901")).toBe("01 45 67 89 01");
    expect(frenchPhone("+33684120833")).toBe("06 84 12 08 33");
    expect(frenchPhone("0000")).toBeNull();
  });
});

describe("BAN matches", () => {
  const match = { score: 0.9, type: "housenumber", citycode: "31555", oldcitycode: null };
  it("accepts a precise match in the place's own commune", () => {
    expect(banResultFits(match, "31555")).toBe(true);
    expect(banResultFits({ ...match, type: "street" }, "31555")).toBe(true);
  });
  it("rejects another commune, a town centre, or a weak score", () => {
    // "1 Place Auguste Muret, 05007 Gap" matched a street near Toulouse.
    expect(banResultFits({ ...match, citycode: "31395", score: 0.42 }, "05061")).toBe(false);
    expect(banResultFits({ ...match, citycode: "31395" }, "05061")).toBe(false);
    expect(banResultFits({ ...match, type: "municipality" }, "31555")).toBe(false);
    expect(banResultFits({ ...match, score: 0.3 }, "31555")).toBe(false);
  });
  it("treats Paris, Lyon and Marseille districts as the city", () => {
    expect(banResultFits({ ...match, citycode: "75116" }, "75056")).toBe(true);
    expect(banResultFits({ ...match, citycode: "75056" }, "75116")).toBe(true);
    expect(banResultFits({ ...match, citycode: "69383" }, "69123")).toBe(true);
    expect(banResultFits({ ...match, citycode: "13201" }, "75056")).toBe(false);
  });
});

describe("French places in the search rules", () => {
  const place = { country: "FR", centreClass: "70", careCodes: ["fr:physiotherapy"], ownership: null, name: "Paul Roux" };
  it("offers a French place for its care types, by either route", () => {
    expect(registerPlaceOffers(place, "physiotherapy", "public")).toBe(true);
    expect(registerPlaceOffers(place, "physiotherapy", "private")).toBe(true);
    expect(registerPlaceOffers(place, "dentist", "private")).toBe(false);
  });
  it("pre-filters French rows on their country's care code", () => {
    expect(registerCandidateFilter("dentist", "public", "FR")).toEqual({ codes: ["fr:dentist"], classes: [] });
  });
});
