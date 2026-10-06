import React from "react";
import ReactDOM from "react-dom/client";
import { CareFinder, type CareFinderProfile, type CareFinderServices } from "../../features/careFinder/CareFinder";
import type { CareFinderResultOption, CareFinderSearchResponse } from "../../../shared/careFinder/search";
import "../../index.css";

// Browser harness for the Care Finder: real component, fake network.
// ?theme=light|dark  ?locale=en|es  ?scenario=ok|no_results|error
const params = new URLSearchParams(window.location.search);
const theme = params.get("theme") === "dark" ? "dark" : "light";
const lang = params.get("locale") === "es" ? "es" : "en";
const scenario = params.get("scenario") ?? "ok";
const checkedAt = new Date().toISOString();

function fact(value: string | null, status: "reported" | "verified" | "unknown", source = "Google Maps") {
  return { value, status, source, sourceType: status === "verified" ? "provider_owned" as const : "directory" as const, sourceUrl: null, checkedAt };
}

function option(id: string, name: string, minutes: number, km: string, extra: Partial<CareFinderResultOption> = {}): CareFinderResultOption {
  return {
    id,
    name,
    category: lang === "es" ? "Fisioterapeuta" : "Physiotherapist",
    care_type: "physiotherapy",
    address: `Calle ${name.split(" ").pop()} 12, 11380 Tarifa, Cádiz`,
    phone: "+34 956 68 00 00",
    website: "https://example.org",
    maps_url: "https://maps.google.com",
    source_label: "Google Maps",
    source_status: "reported",
    source_type: "directory",
    checked_at: checkedAt,
    travel_text: `${km} · ${minutes} min ${lang === "es" ? "en coche" : "by car"}`,
    travel_minutes: minutes,
    wheelchair_entrance: true,
    matched: [lang === "es" ? "Aparece en Google Maps como “Fisioterapeuta”" : "Shows up on Google Maps for “Physiotherapist”"],
    assumptions: [],
    comparison: {
      distance: fact(`${km} · ${minutes} min ${lang === "es" ? "en coche" : "by car"}`, "reported"),
      availability: fact(lang === "es" ? "lunes: 9:00–14:00, 16:00–20:00" : "Monday: 9:00 AM – 2:00 PM, 4:00 – 8:00 PM", "reported"),
      accessibility: fact(lang === "es" ? "Entrada accesible indicada" : "Step-free entrance listed", "reported"),
      reputation: fact("4.8/5 (63)", "reported"),
    },
    ...extra,
  };
}

const okResults: CareFinderSearchResponse = {
  status: "ok",
  careType: "physiotherapy",
  access: "private",
  location: "11380 Tarifa",
  orderedBy: "travel_time",
  checkedAt,
  mapsSearchUrl: "https://www.google.com/maps/search/?api=1&query=fisioterapia%2011380%20Tarifa",
  options: [
    option("a", "Fisioterapia Estrecho", 4, "1,2 km", {
      comparison: {
        distance: fact("1,2 km · 4 min", "reported"),
        price: fact(lang === "es" ? "Sesión desde 35 €" : "Session from €35", "verified", "Official provider website: fisioestrecho.es"),
        accessibility: fact(lang === "es" ? "Entrada accesible indicada" : "Step-free entrance listed", "reported"),
        availability: fact(lang === "es" ? "lunes: 9:00–14:00" : "Monday: 9:00 AM – 2:00 PM", "reported"),
      },
    }),
    option("b", "Clínica Fisio Levante", 9, "3,4 km"),
    option("c", "Centro de Fisioterapia Poniente", 22, "18 km", { wheelchair_entrance: null, comparison: { distance: fact("18 km · 22 min", "reported") } }),
  ],
};

const services: CareFinderServices = {
  search: async () => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (scenario === "error") throw new Error("network");
    if (scenario === "no_results") return { ...okResults, status: "no_results", options: [] };
    return okResults;
  },
};

const profile: CareFinderProfile = {
  coverage: "public",
  location: "11380 Tarifa",
  usualDoctorName: null,
  usualDoctor: null,
};

document.body.style.margin = "0";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CareFinder lang={lang} theme={theme} profile={profile} services={services} onExit={() => undefined} />
  </React.StrictMode>,
);
