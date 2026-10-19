import React from "react";
import ReactDOM from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ExpertCareScreen from "../../pages/ExpertCareScreen";
import { setLanguage } from "../../i18n";
import {
  acknowledgeExpertCareResearchBoundary,
  applyExpertCarePatch,
  attachExpertCareEvidence,
  attachExpertCareSpecialists,
  createExpertCareState,
} from "../../../shared/expertCareState";
import type { ExpertCareResearchResponse, SpecialistCandidate } from "../../../shared/expertCare";
import "../../index.css";

const params = new URLSearchParams(window.location.search);
const language = params.get("locale") === "es" ? "es" : "en";
const frame = Number(params.get("frame")) || null;
const readyMode = params.get("mode") === "ready";
const specialistRequestBodies: string[] = [];
(window as unknown as { __expertCareSpecialistRequests: string[] }).__expertCareSpecialistRequests = specialistRequestBodies;
setLanguage(language);
document.body.style.margin = "0";

const caseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const specialistRetrievedAt = new Date().toISOString();
let state = createExpertCareState(language);
const evidence: ExpertCareResearchResponse = {
  items: [{
    id: "evidence-1", evidenceType: "guideline_update", title: language === "es" ? "Actualización reciente de una guía clínica" : "Recent clinical guideline update",
    whatChanged: language === "es" ? "La guía oficial ha actualizado su resumen de evidencia." : "The official guideline updated its evidence summary.",
    whyItMayMatter: language === "es" ? "Puede orientar las preguntas para una segunda opinión." : "It can help frame questions for a second opinion.",
    askTheSpecialist: language === "es" ? "¿Cómo se aplica esta guía a mi situación?" : "How does this guideline relate to my situation?",
    jurisdiction: "European Union", publishedAt: "2026-09-12", limitations: language === "es" ? "No determina qué tratamiento es adecuado para una persona." : "It does not determine which treatment is right for an individual.",
    experimental: false, evidenceStatus: "guideline", freshnessStatus: "current", retrievedAt: new Date().toISOString(),
    citations: [{ id: "nice-1", label: "NICE guideline", url: "https://www.nice.org.uk/guidance/example", source: "NICE" }],
  }],
  retrievedAt: new Date().toISOString(), educationalOnly: true, unavailableSources: [],
  sourceStatuses: [{ source: "NICE", status: "available", retrievedAt: new Date().toISOString(), detail: null }],
};

const specialists: SpecialistCandidate[] = Array.from({ length: 5 }, (_, index) => ({
  id: `candidate-${index + 1}`, name: ["Dra. Elena Ruiz", "Dr. Mateo Santos", "Dra. Clara Vega", "Dr. Alex Morgan", "Dra. Sofia Costa"][index]!,
  specialty: "oncology", institution: ["Hospital Universitario La Paz", "Clínica Universidad de Navarra", "Vall d’Hebron Institute of Oncology", "Royal Marsden Hospital", "Champalimaud Clinical Centre"][index]!,
  country: ["ES", "ES", "ES", "GB", "PT"][index]!, address: index < 3 ? "Madrid, Spain" : index === 3 ? "London, United Kingdom" : "Lisbon, Portugal",
  distanceMeters: index === 0 ? 4200 : index === 1 ? 310000 : null, openingStatus: index === 0 ? (language === "es" ? "Abierto hoy" : "Open today") : null,
  todayOpeningHours: index === 1 ? "09:00–17:00" : null, languages: index === 3 ? ["English", "Spanish"] : ["Spanish", "English"],
  remoteCareRegions: index < 3 ? ["European Union"] : [], websiteUrl: null, mapsUrl: null,
  rating: index === 0 ? 4.8 : null, reviewCount: index === 0 ? 126 : null, ratingProvenance: index === 0 ? "Google Maps" : null,
  expertiseEvidence: [], directorySources: [{ label: "Open directory", url: null }], contactData: { website: null, phone: null, email: null },
  availability: null, timezone: index === 3 ? "Europe/London" : "Europe/Madrid", estimatedCost: null,
  verificationStatus: "unverified", verificationDetails: [], sourceLabel: "Open directory",
}));

const verifiedSpecialist: SpecialistCandidate = {
  ...specialists[0]!, institution: "Hospital Universitario La Paz", country: "Spain", languages: ["Spanish", "English"], remoteCareRegions: ["Spain", "European Union"],
  expertiseEvidence: ["Identity, active license, oncology subspecialty, and institution confirmed"],
  contactData: { website: "https://hospital.example.org/second-opinions", phone: null, email: "expert-care@example.org" },
  websiteUrl: "https://hospital.example.org/second-opinions", availability: language === "es" ? "Consultas remotas disponibles" : "Remote consultations available", timezone: "Europe/Madrid", estimatedCost: "€250",
  verificationStatus: "verified", verificationDetails: ["Verified by VYVA operations"], sourceLabel: "Medical register",
};

if (readyMode) {
  state = applyExpertCarePatch(state, { goal: "second_opinion", person: "self", specialty: "oncology", emergencyResult: "clear", diagnosisOrRecommendation: "Review a treatment recommendation", concerns: "Understand the options and their limits", location: "Madrid, Spain", stage: "ready" });
  state = attachExpertCareEvidence(state, evidence);
  state = acknowledgeExpertCareResearchBoundary(state);
  state = attachExpertCareSpecialists(state, { candidates: [verifiedSpecialist, ...specialists.slice(1)], contactBlockedUntilVerified: true, retrievedAt: specialistRetrievedAt });
  state = {
    ...state, stage: "ready", coordinationStatus: "complete", consent: { ...state.consent, sharing: true },
    contactPreparation: { pendingActionId: "task-ready-1", candidateId: verifiedSpecialist.id, recipient: verifiedSpecialist.contactData.email!, documentIds: [], healthFields: ["diagnosis_or_recommendation", "concerns", "location", "languages"], channel: "email", message: "Please review this second-opinion consultation request.", confirmedAt: new Date().toISOString() },
    specialistResponse: { candidateId: verifiedSpecialist.id, outcome: "accepted", notes: language === "es" ? "Consulta remota ofrecida para la próxima semana." : "Remote consultation offered for next week.", receivedAt: new Date().toISOString() },
  };
}

const record = () => ({ id: caseId, state, status: "active", createdAt: state.createdAt, updatedAt: state.updatedAt });
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const path = new URL(String(input), window.location.origin).pathname;
  if (path === "/api/expert-care/availability") return json({ enabled: true, mode: "internal", launchReady: true });
  if (path === "/api/expert-care/cases" && init?.method === "POST") return json({ case: record() }, 201);
  if (path.endsWith("/documents") && !init?.method) return json({ documents: [] });
  if (path === `/api/expert-care/cases/${caseId}` && init?.method === "PATCH") {
    const body = JSON.parse(String(init.body)) as { patch: Parameters<typeof applyExpertCarePatch>[1] };
    state = applyExpertCarePatch(state, body.patch);
    return json({ case: record() });
  }
  if (path === "/api/expert-care/research") { state = attachExpertCareEvidence(state, evidence); return json(evidence); }
  if (path === "/api/expert-care/specialists") {
    specialistRequestBodies.push(String(init?.body ?? ""));
    const body = JSON.parse(String(init?.body ?? "{}")) as { cursor?: string };
    if (body.cursor) return json({ candidates: specialists.slice(3), contactBlockedUntilVerified: true, retrievedAt: specialistRetrievedAt, nextCursor: null });
    state = attachExpertCareSpecialists(state, { candidates: specialists, contactBlockedUntilVerified: true, retrievedAt: specialistRetrievedAt });
    return json({ candidates: specialists.slice(0, 3), contactBlockedUntilVerified: true, retrievedAt: specialistRetrievedAt, nextCursor: "harness-page-2" });
  }
  if (path.endsWith("/research-acknowledgement") && init?.method === "POST") { state = acknowledgeExpertCareResearchBoundary(state); return json({ case: record() }); }
  if (path.endsWith("/consultation-package")) return json({ caseId, generatedAt: new Date().toISOString(), consultationReady: true, blockers: [], context: state.context, evidence, verifiedSpecialists: [verifiedSpecialist], preparedQuestions: evidence.items.map((item) => item.askTheSpecialist), records: [], contactPreparation: state.contactPreparation, specialistResponse: state.specialistResponse, boundaries: ["Educational information only", "No external action without confirmation"] });
  if (path.includes("/specialists/verification") && init?.method === "POST") return json({ case: record(), verificationTaskId: "task-1" }, 202);
  if (path.startsWith(`/api/expert-care/cases/${caseId}`)) return json({ case: record() });
  return json({ error: "not_found" }, 404);
}) as typeof window.fetch;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><div data-testid="expert-care-harness-frame" style={frame ? { maxWidth: frame, margin: "0 auto" } : undefined}><MemoryRouter initialEntries={[readyMode ? `/expert-care/${caseId}` : "/"]}><Routes><Route path="*" element={<ExpertCareScreen />} /><Route path="/expert-care/:caseId" element={<ExpertCareScreen />} /></Routes></MemoryRouter></div></React.StrictMode>,
);
