import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BookOpenCheck, Brain, CheckCircle2, ChevronRight, FileText, FlaskConical, HeartPulse, Loader2, LockKeyhole, MapPin, Mic, Search, ShieldCheck, Sparkles, Stethoscope, Trash2, Upload, User, Users } from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import { useLanguage } from "@/i18n";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import type { EvidenceItem, ExpertCareConsultationPackage, ExpertCareGoal, ExpertCareResearchResponse, ExpertCareSpecialistResponse, ExpertCareSpecialty, SpecialistCandidate } from "../../shared/expertCare";
import type { ExpertCareCasePatch, ExpertCareCaseState } from "../../shared/expertCareState";
import type { ExpertCareVaultDocument } from "../../shared/expertCareVault";
import ActionConfirmationCheckpoint from "@/components/concierge/ActionConfirmationCheckpoint";
import "./expertCare.css";

type Step = "goal" | "who" | "permission" | "specialty" | "safety" | "context" | "records" | "concerns" | "location" | "results";
type Draft = { step: Step; goal: ExpertCareGoal | null; who: "self" | "other" | null; authorityConfirmedAt: string | null; specialty: ExpertCareSpecialty | null; question: string; currentTreatment: string; concerns: string; location: string; safetyCleared: boolean };
type CaseRecord = { id: string; state: ExpertCareCaseState; status: "active"; createdAt: string; updatedAt: string };
const STORAGE_KEY = "vyva:expert-care:draft:v1";
const fresh: Draft = { step: "goal", goal: null, who: null, authorityConfirmedAt: null, specialty: null, question: "", currentTreatment: "", concerns: "", location: "", safetyCleared: false };

function readDraft(): Draft {
  try { return { ...fresh, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") }; } catch { return fresh; }
}

function fileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("file_read_failed"));
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      const separator = value.indexOf(",");
      if (separator < 0) reject(new Error("file_read_failed"));
      else resolve(value.slice(separator + 1));
    };
    reader.readAsDataURL(file);
  });
}

const stageFromStep = (step: Step): ExpertCareCasePatch["stage"] => ({
  goal: "goal", who: "person", permission: "permission", specialty: "specialty", safety: "safety", context: "context", records: "records", concerns: "concerns", location: "research", results: "specialists",
})[step] as ExpertCareCasePatch["stage"];

function stepFromState(state: ExpertCareCaseState): Step {
  if (state.context.emergencyResult === "urgent_stop") return "safety";
  if (state.stage === "goal") return "goal";
  if (state.stage === "person") return "who";
  if (state.stage === "permission") return "permission";
  if (state.stage === "specialty") return "specialty";
  if (state.stage === "safety") return "safety";
  if (state.stage === "context") return "context";
  if (state.stage === "records") return "records";
  if (state.stage === "concerns") return "concerns";
  if (state.stage === "research") return "location";
  return state.evidence || state.specialists ? "results" : "location";
}

function draftFromState(state: ExpertCareCaseState): Draft {
  return {
    step: stepFromState(state),
    goal: state.context.goal,
    who: state.context.person === "trusted_helper" ? "other" : state.context.person,
    authorityConfirmedAt: state.context.authorityConfirmedAt,
    specialty: state.context.specialty,
    question: state.context.diagnosisOrRecommendation ?? "",
    currentTreatment: state.context.currentTreatment ?? "",
    concerns: state.context.concerns ?? "",
    location: state.context.location ?? "",
    safetyCleared: state.context.emergencyResult === "clear",
  };
}

function patchFromDraft(draft: Draft, language: "en" | "es", urgent: boolean): ExpertCareCasePatch {
  return {
    goal: draft.goal,
    specialty: draft.specialty,
    person: draft.who === "other" ? "trusted_helper" : draft.who,
    authorityConfirmedAt: draft.who === "other" ? draft.authorityConfirmedAt : null,
    diagnosisOrRecommendation: draft.question.trim() || null,
    currentTreatment: draft.currentTreatment.trim() || null,
    concerns: draft.concerns.trim() || null,
    location: draft.location.trim() || null,
    languages: [language],
    emergencyResult: urgent ? "urgent_stop" : draft.safetyCleared ? "clear" : "not_checked",
    stage: stageFromStep(draft.step),
  };
}

export default function ExpertCareScreen() {
  const navigate = useNavigate();
  const { caseId: routeCaseId } = useParams<{ caseId: string }>();
  const [searchParams] = useSearchParams();
  const { language } = useLanguage();
  const { isDark } = useHomeMasterTheme();
  const es = language.toLowerCase().startsWith("es");
  const [draft, setDraft] = useState<Draft>(readDraft);
  const [urgent, setUrgent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [evidence, setEvidence] = useState<ExpertCareResearchResponse | null>(null);
  const [specialists, setSpecialists] = useState<SpecialistCandidate[]>([]);
  const [documents, setDocuments] = useState<ExpertCareVaultDocument[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const [retentionConsent, setRetentionConsent] = useState(false);
  const [vaultBusy, setVaultBusy] = useState(false);
  const [vaultError, setVaultError] = useState("");
  const [verificationBusy, setVerificationBusy] = useState<string | null>(null);
  const [contactCandidate, setContactCandidate] = useState<SpecialistCandidate | null>(null);
  const [contactMessage, setContactMessage] = useState("");
  const [contactChannel, setContactChannel] = useState<"email" | "phone" | "website" | "manual">("manual");
  const [contactBusy, setContactBusy] = useState(false);
  const [contactPrepared, setContactPrepared] = useState(false);
  const [consultationPackage, setConsultationPackage] = useState<ExpertCareConsultationPackage | null>(null);
  const [packageLoading, setPackageLoading] = useState(false);
  const [researchAcknowledged, setResearchAcknowledged] = useState(false);
  const [acknowledgementBusy, setAcknowledgementBusy] = useState(false);
  const [visible, setVisible] = useState(3);
  const [specialistCursor, setSpecialistCursor] = useState<string | null>(null);
  const [specialistLoadingMore, setSpecialistLoadingMore] = useState(false);
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [caseLoading, setCaseLoading] = useState(Boolean(routeCaseId || searchParams.get("legacyTaskId")));
  const [saveState, setSaveState] = useState<"local" | "saving" | "saved" | "error">("local");
  const [featureUnavailable, setFeatureUnavailable] = useState(false);
  const recordRef = useRef<CaseRecord | null>(null);
  const lastSavedFingerprint = useRef("");
  const creatingCase = useRef<Promise<CaseRecord | null> | null>(null);
  const steps: Step[] = ["goal", "who", "permission", "specialty", "safety", "context", "records", "concerns", "location", "results"];
  const progress = Math.max(1, steps.indexOf(draft.step) + 1);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); }, [draft]);
  useEffect(() => { recordRef.current = caseRecord; }, [caseRecord]);
  useEffect(() => {
    let cancelled = false;
    void apiFetch("/api/expert-care/availability").then(async (response) => {
      if (!response.ok || cancelled) return;
      const availability = await response.json() as { enabled?: boolean };
      if (!cancelled && availability.enabled === false) setFeatureUnavailable(true);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const loadDocuments = useCallback(async (id: string) => {
    const response = await apiFetch(`/api/expert-care/cases/${encodeURIComponent(id)}/documents`);
    if (response.ok) setDocuments(((await response.json()) as { documents: ExpertCareVaultDocument[] }).documents);
  }, []);

  const hydrate = useCallback((record: CaseRecord) => {
    const restored = draftFromState(record.state);
    setCaseRecord(record);
    recordRef.current = record;
    setDraft(restored);
    setUrgent(record.state.context.emergencyResult === "urgent_stop");
    setEvidence(record.state.evidence?.result ?? null);
    setSpecialists(record.state.specialists?.result.candidates ?? []);
    setSpecialistCursor(null);
    setResearchAcknowledged(record.state.consent.research);
    setContactPrepared(Boolean(record.state.contactPreparation));
    lastSavedFingerprint.current = JSON.stringify(patchFromDraft(restored, es ? "es" : "en", record.state.context.emergencyResult === "urgent_stop"));
    setSaveState("saved");
  }, [es]);

  useEffect(() => {
    let cancelled = false;
    const legacyTaskId = searchParams.get("legacyTaskId");
    if (!routeCaseId && !legacyTaskId) { setCaseLoading(false); return; }
    if (routeCaseId && recordRef.current?.id === routeCaseId && !legacyTaskId) { setCaseLoading(false); return; }
    const load = async () => {
      setCaseLoading(true);
      try {
        const response = legacyTaskId
          ? await apiFetch(`/api/expert-care/cases/import/${encodeURIComponent(legacyTaskId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language: es ? "es" : "en" }) })
          : await apiFetch(`/api/expert-care/cases/${encodeURIComponent(routeCaseId!)}`);
        if (!response.ok) throw new Error("case_load_failed");
        const body = await response.json() as { case: CaseRecord };
        if (cancelled) return;
        hydrate(body.case);
        void loadDocuments(body.case.id);
        if (legacyTaskId) navigate(`/expert-care/${body.case.id}`, { replace: true });
      } catch {
        if (!cancelled) { setError(es ? "No pudimos recuperar este caso. Puedes empezar uno nuevo." : "We could not resume this case. You can start a new one."); setSaveState("error"); }
      } finally {
        if (!cancelled) setCaseLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [routeCaseId, searchParams, es, navigate, hydrate, loadDocuments]);

  useEffect(() => {
    const caseId = caseRecord?.id;
    const preparationId = caseRecord?.state.contactPreparation?.pendingActionId;
    if (!caseId || !preparationId) { setConsultationPackage(null); return; }
    let cancelled = false;
    setPackageLoading(true);
    void apiFetch(`/api/expert-care/cases/${encodeURIComponent(caseId)}/consultation-package`)
      .then(async (response) => {
        if (!response.ok) throw new Error("consultation_package_unavailable");
        const result = await response.json() as ExpertCareConsultationPackage;
        if (!cancelled) setConsultationPackage(result);
      })
      .catch(() => { if (!cancelled) setConsultationPackage(null); })
      .finally(() => { if (!cancelled) setPackageLoading(false); });
    return () => { cancelled = true; };
  }, [caseRecord?.id, caseRecord?.state.contactPreparation?.pendingActionId, caseRecord?.state.specialistResponse?.receivedAt]);

  const ensureCase = useCallback(async (): Promise<CaseRecord | null> => {
    if (recordRef.current) return recordRef.current;
    if (creatingCase.current) return creatingCase.current;
    creatingCase.current = (async () => {
      try {
        const response = await apiFetch("/api/expert-care/cases", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language: es ? "es" : "en" }) });
        if (!response.ok) throw new Error("case_create_failed");
        const body = await response.json() as { case: CaseRecord };
        setCaseRecord(body.case);
        recordRef.current = body.case;
        navigate(`/expert-care/${body.case.id}`, { replace: true });
        return body.case;
      } catch {
        setSaveState("error");
        return null;
      } finally {
        creatingCase.current = null;
      }
    })();
    return creatingCase.current;
  }, [es, navigate]);

  const persistDraft = useCallback(async (value: Draft, urgentValue = urgent): Promise<CaseRecord | null> => {
    const base = await ensureCase();
    if (!base) return null;
    const patch = patchFromDraft(value, es ? "es" : "en", urgentValue);
    const fingerprint = JSON.stringify(patch);
    if (lastSavedFingerprint.current === fingerprint) return recordRef.current;
    setSaveState("saving");
    const save = async (record: CaseRecord): Promise<Response> => apiFetch(`/api/expert-care/cases/${record.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: record.state.revision, patch }),
    });
    try {
      let response = await save(recordRef.current ?? base);
      if (response.status === 409) {
        const conflict = await response.json() as { case?: CaseRecord };
        if (!conflict.case) throw new Error("case_conflict");
        setCaseRecord(conflict.case); recordRef.current = conflict.case;
        response = await save(conflict.case);
      }
      if (!response.ok) throw new Error("case_save_failed");
      const body = await response.json() as { case: CaseRecord };
      setCaseRecord(body.case); recordRef.current = body.case;
      lastSavedFingerprint.current = fingerprint;
      setSaveState("saved");
      return body.case;
    } catch {
      setSaveState("error");
      return null;
    }
  }, [ensureCase, es, urgent]);

  useEffect(() => {
    if (caseLoading || !draft.goal) return;
    const timer = window.setTimeout(() => { void persistDraft(draft); }, 450);
    return () => window.clearTimeout(timer);
  }, [draft, urgent, caseLoading, persistDraft]);

  const update = (value: Partial<Draft>) => setDraft((current) => {
    const next = { ...current, ...value };
    if ((value.specialty !== undefined && value.specialty !== current.specialty) || (value.question !== undefined && value.question !== current.question)) {
      setEvidence(null); setSpecialists([]); setVisible(3); setSpecialistCursor(null);
    } else if (value.location !== undefined && value.location !== current.location) {
      setSpecialists([]); setVisible(3); setSpecialistCursor(null);
    }
    return next;
  });
  const back = () => {
    const index = steps.indexOf(draft.step);
    if (index <= 0) navigate("/health");
    else {
      if (draft.step === "safety" && urgent) setUrgent(false);
      if (draft.step === "specialty" && draft.who === "self") update({ step: "who" });
      else update({ step: steps[index - 1] });
    }
  };

  const copy = useMemo(() => ({
    title: "Expert Care",
    step: es ? `Paso ${progress} de 10` : `Step ${progress} of 10`,
    educational: es ? "Información educativa, no un diagnóstico ni una recomendación de tratamiento." : "Educational information, not a diagnosis or treatment recommendation.",
  }), [es, progress]);

  const uploadSelectedDocument = async () => {
    if (!selectedFile || !ownershipConfirmed || !retentionConsent) return;
    if (!["application/pdf", "image/jpeg", "image/png"].includes(selectedFile.type) || selectedFile.size > 10 * 1024 * 1024) {
      setVaultError(es ? "Usa un PDF, JPG o PNG de hasta 10 MB." : "Use a PDF, JPG, or PNG up to 10 MB.");
      return;
    }
    setVaultBusy(true); setVaultError("");
    try {
      const persisted = await persistDraft({ ...draft, step: "records" });
      if (!persisted) throw new Error("case_unavailable");
      const dataBase64 = await fileAsBase64(selectedFile);
      const response = await apiFetch(`/api/expert-care/cases/${persisted.id}/documents`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: selectedFile.name, mediaType: selectedFile.type, dataBase64, ownershipConfirmed: true, retentionConsent: true }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "upload_failed");
      }
      const body = await response.json() as { document: ExpertCareVaultDocument };
      setDocuments((current) => [body.document, ...current]);
      setSelectedFile(null); setOwnershipConfirmed(false); setRetentionConsent(false);
    } catch (uploadFailure) {
      const unavailable = uploadFailure instanceof Error && uploadFailure.message === "expert_care_malware_scan_unavailable";
      setVaultError(unavailable
        ? (es ? "La carga está pausada hasta que el escáner de seguridad esté disponible." : "Upload is paused until the security scanner is available.")
        : (es ? "No pudimos guardar este archivo de forma segura." : "We could not store this file safely."));
    } finally {
      setVaultBusy(false);
    }
  };

  const updateDocumentSharing = async (document: ExpertCareVaultDocument, approved: boolean) => {
    if (!caseRecord) return;
    setVaultBusy(true); setVaultError("");
    try {
      const response = await apiFetch(`/api/expert-care/cases/${caseRecord.id}/documents/${document.id}/sharing`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approved }) });
      if (!response.ok) throw new Error("sharing_failed");
      const body = await response.json() as { document: ExpertCareVaultDocument };
      setDocuments((current) => current.map((item) => item.id === document.id ? body.document : item));
    } catch {
      setVaultError(es ? "No pudimos cambiar el permiso para compartir." : "We could not change the sharing permission.");
    } finally { setVaultBusy(false); }
  };

  const removeDocument = async (document: ExpertCareVaultDocument) => {
    if (!caseRecord || !window.confirm(es ? `¿Eliminar permanentemente ${document.fileName}?` : `Permanently delete ${document.fileName}?`)) return;
    setVaultBusy(true); setVaultError("");
    try {
      const response = await apiFetch(`/api/expert-care/cases/${caseRecord.id}/documents/${document.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("delete_failed");
      setDocuments((current) => current.filter((item) => item.id !== document.id));
    } catch {
      setVaultError(es ? "No pudimos eliminar el archivo." : "We could not delete the file.");
    } finally { setVaultBusy(false); }
  };

  const requestVerification = async (candidate: SpecialistCandidate) => {
    if (!caseRecord) return;
    setVerificationBusy(candidate.id); setError("");
    try {
      const response = await apiFetch(`/api/expert-care/cases/${caseRecord.id}/specialists/verification`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: candidate.id }) });
      if (response.status === 403) { setError(es ? "La verificación y coordinación requieren el servicio Expert Care." : "Verification and coordination require the Expert Care service."); return; }
      if (!response.ok) throw new Error("verification_failed");
      const body = await response.json() as { case: CaseRecord };
      setCaseRecord(body.case); recordRef.current = body.case;
      setSpecialists(body.case.state.specialists?.result.candidates ?? specialists);
    } catch {
      setError(es ? "No pudimos solicitar la verificación ahora." : "We could not request verification right now.");
    } finally { setVerificationBusy(null); }
  };

  const acknowledgeResearch = async () => {
    if (!caseRecord || researchAcknowledged) return;
    setAcknowledgementBusy(true); setError("");
    try {
      const response = await apiFetch(`/api/expert-care/cases/${caseRecord.id}/research-acknowledgement`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ educationalOnlyAcknowledged: true, uncertaintyAcknowledged: true }),
      });
      if (!response.ok) throw new Error("research_acknowledgement_failed");
      const body = await response.json() as { case: CaseRecord };
      setCaseRecord(body.case); recordRef.current = body.case; setResearchAcknowledged(true);
    } catch {
      setError(es ? "No pudimos guardar tu confirmación. Inténtalo de nuevo." : "We could not save your acknowledgement. Please try again.");
    } finally { setAcknowledgementBusy(false); }
  };

  const openContactPreparation = (candidate: SpecialistCandidate) => {
    setContactCandidate(candidate); setContactPrepared(false);
    const channel = candidate.contactData.email ? "email" : candidate.contactData.phone ? "phone" : candidate.contactData.website ? "website" : "manual";
    setContactChannel(channel);
    setContactMessage(es ? `Solicito una consulta de segunda opinión sobre: ${draft.question}` : `I am requesting a second-opinion consultation about: ${draft.question}`);
  };

  const prepareContact = async () => {
    if (!caseRecord || !contactCandidate) return;
    setContactBusy(true); setError("");
    try {
      const approvedDocumentIds = documents.filter((document) => document.sharingApproved).map((document) => document.id);
      const healthFields = ["diagnosis_or_recommendation", ...(draft.currentTreatment.trim() ? ["current_treatment"] : []), ...(draft.concerns.trim() ? ["concerns"] : []), "location", "languages"];
      const response = await apiFetch(`/api/expert-care/cases/${caseRecord.id}/contact-preparations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: contactCandidate.id, documentIds: approvedDocumentIds, healthFields, channel: contactChannel, message: contactMessage, confirmExactSharing: true }) });
      if (response.status === 403) { setError(es ? "La coordinación requiere el servicio Expert Care." : "Coordination requires the Expert Care service."); return; }
      if (!response.ok) throw new Error("contact_preparation_failed");
      const body = await response.json() as { case: CaseRecord };
      setCaseRecord(body.case); recordRef.current = body.case; setContactPrepared(true);
    } catch {
      setError(es ? "No pudimos preparar el contacto. Revisa la verificación y los permisos." : "We could not prepare contact. Check verification and sharing permissions.");
    } finally { setContactBusy(false); }
  };

  const runResearch = async () => {
    if (!draft.specialty || !draft.question.trim() || !draft.location.trim()) return;
    setLoading(true); setError(""); setVisible(3); setSpecialistCursor(null); setResearchAcknowledged(false);
    const persisted = await persistDraft(draft);
    const language = es ? "es" : "en";
    const [research, provider] = await Promise.allSettled([
      apiFetch("/api/expert-care/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId: persisted?.id, specialty: draft.specialty, question: draft.question, language }) }),
      apiFetch("/api/expert-care/specialists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId: persisted?.id, specialty: draft.specialty, question: draft.question, location: draft.location, language, limit: 3 }) }),
    ]);
    if (research.status === "fulfilled" && research.value.ok) setEvidence(await research.value.json() as ExpertCareResearchResponse);
    if (provider.status === "fulfilled" && provider.value.ok) {
      const page = await provider.value.json() as ExpertCareSpecialistResponse;
      setSpecialists(page.candidates); setSpecialistCursor(page.nextCursor ?? null);
    }
    if (research.status === "rejected" && provider.status === "rejected") setError(es ? "No pudimos preparar la investigación ahora." : "We could not prepare the research right now.");
    setLoading(false); update({ step: "results" });
  };

  const showMoreSpecialists = async () => {
    if (!specialistCursor) { setVisible((current) => current + 3); return; }
    if (!caseRecord || !draft.specialty) return;
    setSpecialistLoadingMore(true); setError("");
    try {
      const response = await apiFetch("/api/expert-care/specialists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId: caseRecord.id, specialty: draft.specialty, question: draft.question, location: draft.location, language: es ? "es" : "en", cursor: specialistCursor, limit: 3 }) });
      if (!response.ok) throw new Error("specialist_page_failed");
      const page = await response.json() as ExpertCareSpecialistResponse;
      setSpecialists((current) => [...current, ...page.candidates.filter((candidate) => !current.some((existing) => existing.id === candidate.id))]);
      setVisible((current) => current + page.candidates.length);
      setSpecialistCursor(page.nextCursor ?? null);
    } catch {
      setError(es ? "No pudimos cargar más especialistas ahora." : "We could not load more specialists right now.");
    } finally { setSpecialistLoadingMore(false); }
  };

  const goals: Array<{ id: ExpertCareGoal; title: string; detail: string; icon: typeof Search }> = [
    { id: "find_specialist", title: es ? "Encontrar un especialista" : "Find a specialist", detail: es ? "Buscar experiencia relevante en todo el mundo" : "Search for relevant expertise worldwide", icon: Search },
    { id: "second_opinion", title: es ? "Obtener una segunda opinión" : "Get a second opinion", detail: es ? "Preparar el caso y las preguntas" : "Prepare the case and the right questions", icon: Stethoscope },
    { id: "recent_treatments", title: es ? "Revisar tratamientos recientes" : "Review recent treatments", detail: es ? "Comprender evidencia reciente y sus límites" : "Understand recent evidence and its limits", icon: BookOpenCheck },
    { id: "trials_advances", title: es ? "Explorar ensayos y avances" : "Explore trials and advances", detail: es ? "Ver investigación registrada, sin promesas" : "See registered research without promises", icon: FlaskConical },
  ];
  const specialties: Array<{ id: ExpertCareSpecialty; title: string; detail: string; icon: typeof HeartPulse }> = [
    { id: "oncology", title: es ? "Oncología" : "Oncology", detail: es ? "Cáncer, diagnóstico o plan de tratamiento" : "Cancer diagnosis or treatment plan", icon: Sparkles },
    { id: "cardiology", title: es ? "Cardiología" : "Cardiology", detail: es ? "Corazón, circulación o procedimiento" : "Heart, circulation or procedure", icon: HeartPulse },
    { id: "neurology", title: es ? "Neurología" : "Neurology", detail: es ? "Cerebro, nervios o enfermedad neurológica" : "Brain, nerves or neurological condition", icon: Brain },
  ];

  if (caseLoading) return <div className={`expert-care ${isDark ? "expert-care--dark" : ""}`}><div className="ec-case-loading"><Loader2 className="animate-spin" />{es ? "Recuperando tu caso…" : "Resuming your case…"}</div></div>;
  if (featureUnavailable) return <div className={`expert-care ${isDark ? "expert-care--dark" : ""}`}><header className="ec-header"><button onClick={() => navigate("/health")} aria-label={es ? "Atrás" : "Back"}><ArrowLeft /></button><div className="ec-title"><strong>Expert Care</strong></div></header><main className="ec-main"><section className="ec-urgent ec-unavailable"><ShieldCheck /><h2>{es ? "Expert Care aún no está disponible para tu cuenta" : "Expert Care is not available for your account yet"}</h2><p>{es ? "Estamos desplegando este servicio de forma gradual con revisión de seguridad clínica." : "We are releasing this service gradually with clinical-safety review."}</p><button onClick={() => navigate("/health")}>{es ? "Volver a Salud" : "Back to Health"}</button></section></main></div>;

  return (
    <div className={`expert-care ${isDark ? "expert-care--dark" : ""}`} data-testid="expert-care">
      <header className="ec-header"><button type="button" onClick={back} aria-label={es ? "Atrás" : "Back"}><ArrowLeft /></button><div className="ec-title"><strong>{copy.title}</strong>{caseRecord && <small>{saveState === "saving" ? (es ? "Guardando…" : "Saving…") : saveState === "error" ? (es ? "Guardado local" : "Saved locally") : (es ? "Guardado" : "Saved")}</small>}</div><span className="ec-mic" aria-hidden="true"><Mic size={19} /></span></header>
      <main className="ec-main">
        <div className="ec-progress"><span>{copy.step}</span><div role="progressbar" aria-label={es ? "Progreso del caso" : "Case progress"} aria-valuemin={1} aria-valuemax={10} aria-valuenow={progress}><i style={{ width: `${(progress / 10) * 100}%` }} /></div></div>
        {error && draft.step !== "results" && <p className="ec-error">{error}</p>}
        {draft.step === "goal" && <Step title={es ? "¿Cómo podemos ayudarte?" : "How can we help?"} helper={es ? "Empieza por lo que necesitas hoy." : "Start with what you need today."}>{goals.map((item) => <Choice key={item.id} {...item} onClick={() => update({ goal: item.id, step: "who" })} />)}</Step>}
        {draft.step === "who" && <Step title={es ? "¿Para quién es?" : "Who is this for?"} helper={es ? "El titular controla lo que se comparte." : "The member controls what is shared."}><Choice title={es ? "Para mí" : "For me"} detail={es ? "Estoy revisando mi propia atención" : "I am reviewing my own care"} icon={User} onClick={() => update({ who: "self", authorityConfirmedAt: null, step: "specialty" })} /><Choice title={es ? "Para alguien a quien ayudo" : "For someone I help"} detail={es ? "Necesitaremos su permiso antes de acceder a documentos" : "We require their permission before accessing records"} icon={Users} onClick={() => update({ who: "other", authorityConfirmedAt: null, step: "permission" })} /></Step>}
        {draft.step === "permission" && <Step title={es ? "¿Tienes permiso para ayudar?" : "Do you have permission to help?"} helper={es ? "No podrás añadir ni ver documentos sin el permiso explícito de la persona." : "You cannot add or view records without the person’s explicit permission."}><Choice title={es ? "Sí, tengo su permiso" : "Yes, I have their permission"} detail={es ? "Puedo ayudar con este caso y sus documentos" : "I may help with this case and its records"} icon={ShieldCheck} onClick={() => update({ authorityConfirmedAt: new Date().toISOString(), step: "specialty" })} /><Choice title={es ? "Todavía no" : "Not yet"} detail={es ? "Continuaré cuando tenga su permiso" : "I will continue after I have permission"} icon={LockKeyhole} onClick={() => update({ authorityConfirmedAt: null })} /></Step>}
        {draft.step === "specialty" && <Step title={es ? "¿Qué área médica?" : "Which medical area?"} helper={es ? "La primera versión cubre tres especialidades." : "The first release supports three specialties."}>{specialties.map((item) => <Choice key={item.id} {...item} onClick={() => update({ specialty: item.id, step: "safety" })} />)}</Step>}
        {draft.step === "safety" && !urgent && <Step title={es ? "Primero, una comprobación de seguridad" : "First, a safety check"} helper={es ? "¿Hay síntomas graves o que empeoran rápidamente ahora?" : "Are there severe or rapidly worsening symptoms right now?"}><Choice title={es ? "Sí, necesito ayuda urgente" : "Yes, I may need urgent help"} detail={es ? "Dolor torácico intenso, debilidad repentina, convulsión, dificultad respiratoria o confusión nueva" : "Severe chest pain, sudden weakness, seizure, breathing difficulty, or new confusion"} icon={HeartPulse} onClick={() => setUrgent(true)} /><Choice title={es ? "No, puedo continuar" : "No, I can continue"} detail={es ? "Estoy buscando información y una consulta" : "I am looking for information and a consultation"} icon={CheckCircle2} onClick={() => update({ safetyCleared: true, step: "context" })} /></Step>}
        {draft.step === "safety" && urgent && <section className="ec-urgent" role="alert"><ShieldCheck /><h2>{es ? "Busca ayuda urgente ahora" : "Get urgent help now"}</h2><p>{es ? "No continúes con una búsqueda de segunda opinión. Llama al número local de emergencias o acude al servicio de urgencias más cercano." : "Do not continue with second-opinion research. Call your local emergency number or go to the nearest emergency department."}</p><button onClick={() => { void persistDraft(draft, true); navigate("/health"); }}>{es ? "Salir a Salud" : "Exit to Health"}</button></section>}
        {draft.step === "context" && <Step title={es ? "¿Qué quieres revisar?" : "What would you like reviewed?"} helper={es ? "Describe el diagnóstico, tratamiento, procedimiento o pregunta. No cambies ningún medicamento basándote en esta búsqueda." : "Describe the diagnosis, treatment, procedure, or question. Do not change medication based on this research."}><textarea value={draft.question} onChange={(e) => update({ question: e.target.value })} rows={7} placeholder={es ? "Por ejemplo: me han recomendado…" : "For example: I have been advised…"} /><button className="ec-primary" disabled={draft.question.trim().length < 3} onClick={() => update({ step: "records" })}>{es ? "Continuar" : "Continue"}<ChevronRight size={18} /></button></Step>}
        {draft.step === "records" && <RecordsStep es={es} documents={documents} selectedFile={selectedFile} setSelectedFile={setSelectedFile} ownershipConfirmed={ownershipConfirmed} setOwnershipConfirmed={setOwnershipConfirmed} retentionConsent={retentionConsent} setRetentionConsent={setRetentionConsent} busy={vaultBusy} error={vaultError} onUpload={uploadSelectedDocument} onSharing={updateDocumentSharing} onDelete={removeDocument} onContinue={() => update({ step: "concerns" })} />}
        {draft.step === "concerns" && <Step title={es ? "¿Qué tratamiento sigues y qué quieres aclarar?" : "What treatment are you receiving, and what matters most?"} helper={es ? "Añade el tratamiento actual si lo conoces y el objetivo principal de la consulta. No cambies la medicación basándote en este servicio." : "Add the current treatment if known and the main goal for the consultation. Do not change medication based on this service."}><label className="ec-field-label">{es ? "Tratamiento actual (opcional)" : "Current treatment (optional)"}<textarea value={draft.currentTreatment} onChange={(event) => update({ currentTreatment: event.target.value })} rows={4} placeholder={es ? "Medicamentos, cirugía, radioterapia u otro plan actual" : "Medicines, surgery, radiotherapy, or another current plan"} /></label><label className="ec-field-label">{es ? "Preocupación u objetivo principal" : "Main concern or goal"}<textarea value={draft.concerns} onChange={(event) => update({ concerns: event.target.value })} rows={5} placeholder={es ? "Por ejemplo: entender alternativas, efectos secundarios o el momento del tratamiento" : "For example: understand alternatives, side effects, or treatment timing"} /></label><button className="ec-primary" disabled={draft.concerns.trim().length < 3} onClick={() => update({ step: "location" })}>{es ? "Continuar" : "Continue"}<ChevronRight size={18} /></button></Step>}
        {draft.step === "location" && <Step title={es ? "¿Dónde debe estar disponible la atención?" : "Where must care be available?"} helper={es ? "Incluye país o ciudad. Buscaremos opciones remotas cuando estén disponibles." : "Include a country or city. We will look for remote options where available."}><div className="ec-input"><MapPin /><input value={draft.location} onChange={(e) => update({ location: e.target.value })} placeholder={es ? "Ciudad, país" : "City, country"} /></div><button className="ec-primary" disabled={draft.location.trim().length < 2 || loading} onClick={runResearch}>{loading ? <Loader2 className="animate-spin" /> : <Search size={18} />}{es ? "Preparar mi caso" : "Prepare my case"}</button></Step>}
        {draft.step === "results" && (packageLoading || consultationPackage?.consultationReady) && <ConsultationReadyPanel packageLoading={packageLoading} packageResult={consultationPackage} es={es} onOpenConcierge={() => navigate("/concierge/tasks")} />}
        {draft.step === "results" && <Results evidence={evidence} specialists={specialists} visible={visible} setVisible={setVisible} hasMoreSpecialists={Boolean(specialistCursor) || specialists.length > visible} specialistLoadingMore={specialistLoadingMore} onShowMoreSpecialists={() => void showMoreSpecialists()} es={es} error={error} educational={copy.educational} verificationBusy={verificationBusy} researchAcknowledged={researchAcknowledged} acknowledgementBusy={acknowledgementBusy} onAcknowledgeResearch={() => void acknowledgeResearch()} onRequestVerification={requestVerification} onPrepareContact={openContactPreparation} />}
        {draft.step === "results" && contactCandidate && <section className="ec-contact-preparation"><h2>{es ? "Preparar contacto" : "Prepare contact"}</h2><p>{es ? "Revisa exactamente qué se incluirá. Esto prepara una solicitud; todavía no contacta al especialista." : "Review exactly what will be included. This prepares a request; it does not contact the specialist yet."}</p><label>{es ? "Canal" : "Channel"}<select value={contactChannel} onChange={(event) => setContactChannel(event.target.value as typeof contactChannel)}><option value="email">Email</option><option value="phone">{es ? "Teléfono" : "Phone"}</option><option value="website">Website</option><option value="manual">VYVA operations</option></select></label><label>{es ? "Mensaje" : "Message"}<textarea rows={5} value={contactMessage} onChange={(event) => setContactMessage(event.target.value)} /></label>{contactPrepared ? <div className="ec-prepared"><CheckCircle2 /><div><strong>{es ? "Solicitud preparada" : "Request prepared"}</strong><p>{es ? "La acción está en Concierge y aún necesita la confirmación final antes de enviarse." : "The action is in Concierge and still needs final confirmation before sending."}</p><button onClick={() => navigate("/concierge/tasks")}>{es ? "Revisar en Concierge" : "Review in Concierge"}</button></div></div> : <ActionConfirmationCheckpoint isDark={isDark} title={es ? "CONFIRMACIÓN DE DATOS" : "SHARING CONFIRMATION"} summary={es ? `Preparar para ${contactCandidate.name}` : `Prepare for ${contactCandidate.name}`} items={[{ label: `${es ? "Destinatario" : "Recipient"}: ${contactCandidate.name}`, helper: contactChannel }, { label: es ? "Datos de salud" : "Health fields", helper: es ? `Motivo${draft.currentTreatment ? ", tratamiento" : ""}${draft.concerns ? ", objetivos" : ""}, ubicación e idiomas` : `Reason${draft.currentTreatment ? ", treatment" : ""}${draft.concerns ? ", goals" : ""}, location, and languages` }, { label: es ? "Documentos" : "Documents", helper: documents.some((document) => document.sharingApproved) ? documents.filter((document) => document.sharingApproved).map((document) => document.fileName).join(", ") : (es ? "Ninguno" : "None") }, { label: es ? "Mensaje" : "Message", helper: contactMessage }]} primaryLabel={es ? "Confirmar y preparar" : "Confirm and prepare"} onConfirm={() => void prepareContact()} isPending={contactBusy} disabled={contactMessage.trim().length < 20} />}</section>}
      </main>
    </div>
  );
}

function Step({ title, helper, children }: { title: string; helper: string; children: React.ReactNode }) { return <section className="ec-step"><h1>{title}</h1><p className="ec-helper">{helper}</p><div className="ec-stack">{children}</div></section>; }
function Choice({ title, detail, icon: Icon, onClick }: { title: string; detail: string; icon: typeof Search; onClick: () => void }) { return <button className="ec-choice" onClick={onClick}><span><Icon size={22} /></span><div><strong>{title}</strong><small>{detail}</small></div><ChevronRight size={20} /></button>; }

function ConsultationReadyPanel({ packageLoading, packageResult, es, onOpenConcierge }: { packageLoading: boolean; packageResult: ExpertCareConsultationPackage | null; es: boolean; onOpenConcierge: () => void }) {
  if (packageLoading && !packageResult) return <section className="ec-ready ec-ready--loading" aria-live="polite"><Loader2 className="animate-spin" /><span>{es ? "Preparando el resumen de la consulta…" : "Preparing your consultation summary…"}</span></section>;
  if (!packageResult?.consultationReady) return null;
  const specialist = packageResult.verifiedSpecialists.find((item) => item.id === packageResult.contactPreparation?.candidateId) ?? packageResult.verifiedSpecialists[0];
  const response = packageResult.specialistResponse;
  const responseLabel = response?.outcome === "accepted"
    ? (es ? "El especialista ha respondido y puede continuar la coordinación." : "The specialist has responded and coordination can continue.")
    : response?.outcome === "declined"
      ? (es ? "El especialista no puede aceptar la solicitud. VYVA puede ayudarte con otra opción verificada." : "The specialist cannot accept the request. VYVA can help with another verified option.")
      : response?.outcome === "no_response"
        ? (es ? "Aún no se ha recibido respuesta. VYVA puede hacer seguimiento o preparar otra opción." : "No response has been received yet. VYVA can follow up or prepare another option.")
        : (es ? "La solicitud está preparada y espera tu confirmación final en Concierge." : "The request is prepared and awaits your final confirmation in Concierge.");
  return <section className="ec-ready" aria-labelledby="ec-ready-heading">
    <div className="ec-ready-heading"><span><CheckCircle2 /></span><div><p>{es ? "CASO LISTO PARA CONSULTA" : "CONSULTATION-READY CASE"}</p><h1 id="ec-ready-heading">{es ? "Tu paquete está organizado" : "Your consultation package is organized"}</h1></div></div>
    <p className="ec-ready-status">{responseLabel}</p>
    <dl>
      <div><dt>{es ? "Especialista" : "Specialist"}</dt><dd>{specialist?.name ?? (es ? "Especialista verificado" : "Verified specialist")}{specialist?.institution ? ` · ${specialist.institution}` : ""}</dd></div>
      <div><dt>{es ? "Preguntas preparadas" : "Prepared questions"}</dt><dd>{packageResult.preparedQuestions.length}</dd></div>
      <div><dt>{es ? "Documentos aprobados" : "Approved records"}</dt><dd>{packageResult.records.filter((record) => record.sharingApproved).length}</dd></div>
      <div><dt>{es ? "Canal" : "Channel"}</dt><dd>{packageResult.contactPreparation?.channel ?? (es ? "No indicado" : "Not specified")}</dd></div>
    </dl>
    {response?.notes && <p className="ec-ready-note"><strong>{es ? "Actualización de VYVA:" : "VYVA update:"}</strong> {response.notes}</p>}
    <button type="button" onClick={onOpenConcierge}>{es ? "Revisar la solicitud en Concierge" : "Review request in Concierge"}<ChevronRight size={18} /></button>
  </section>;
}

function RecordsStep({
  es,
  documents,
  selectedFile,
  setSelectedFile,
  ownershipConfirmed,
  setOwnershipConfirmed,
  retentionConsent,
  setRetentionConsent,
  busy,
  error,
  onUpload,
  onSharing,
  onDelete,
  onContinue,
}: {
  es: boolean;
  documents: ExpertCareVaultDocument[];
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  ownershipConfirmed: boolean;
  setOwnershipConfirmed: (confirmed: boolean) => void;
  retentionConsent: boolean;
  setRetentionConsent: (confirmed: boolean) => void;
  busy: boolean;
  error: string;
  onUpload: () => Promise<void>;
  onSharing: (document: ExpertCareVaultDocument, approved: boolean) => Promise<void>;
  onDelete: (document: ExpertCareVaultDocument) => Promise<void>;
  onContinue: () => void;
}) {
  return <Step title={es ? "¿Quieres añadir informes médicos?" : "Would you like to add medical records?"} helper={es ? "Es opcional. Los informes pueden ayudar a preparar una consulta más precisa." : "This is optional. Records can help prepare a more focused consultation."}>
    <div className="ec-vault-note"><LockKeyhole size={22} /><div><strong>{es ? "Tu archivo de salud privado" : "Your private health vault"}</strong><p>{es ? "Cada archivo se analiza por seguridad, se cifra y permanece hasta que lo elimines. Nada se comparte automáticamente." : "Every file is safety-scanned, encrypted, and kept until you delete it. Nothing is shared automatically."}</p></div></div>
    <label className="ec-file-picker">
      <Upload size={22} />
      <span><strong>{selectedFile ? selectedFile.name : (es ? "Elegir PDF o imagen" : "Choose a PDF or image")}</strong><small>{es ? "PDF, JPG o PNG · máximo 10 MB" : "PDF, JPG, or PNG · 10 MB maximum"}</small></span>
      <input aria-label={es ? "Elegir informe médico" : "Choose medical record"} type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
    </label>
    {selectedFile && <div className="ec-upload-consents">
      <label className="ec-consent"><input type="checkbox" checked={ownershipConfirmed} onChange={(event) => setOwnershipConfirmed(event.target.checked)} /><span>{es ? "Confirmo que este documento es mío o que tengo permiso para guardarlo." : "I confirm this record is mine or I have permission to store it."}</span></label>
      <label className="ec-consent"><input type="checkbox" checked={retentionConsent} onChange={(event) => setRetentionConsent(event.target.checked)} /><span>{es ? "Acepto guardarlo cifrado hasta que yo lo elimine." : "I agree to keep it encrypted until I delete it."}</span></label>
      <button className="ec-primary" disabled={busy || !ownershipConfirmed || !retentionConsent} onClick={() => void onUpload()}>{busy ? <Loader2 className="animate-spin" /> : <Upload size={18} />}{es ? "Guardar de forma segura" : "Store securely"}</button>
    </div>}
    {error && <p className="ec-error" role="alert">{error}</p>}
    {documents.length > 0 && <section className="ec-document-list" aria-labelledby="ec-record-list-heading"><h2 id="ec-record-list-heading">{es ? "Documentos guardados" : "Stored records"}</h2>{documents.map((document) => <article className="ec-document" key={document.id}>
      <div className="ec-document-icon"><FileText size={21} /></div>
      <div className="ec-document-body"><strong>{document.fileName}</strong><div className="ec-document-meta"><span className="ec-clean"><ShieldCheck size={13} />{es ? "Archivo seguro" : "Safety checked"}</span><span>{Math.max(1, Math.round(document.byteSize / 1024))} KB</span>{document.ocrConfidence !== null && <span>{es ? "Lectura" : "OCR"} {Math.round(document.ocrConfidence * 100)}%</span>}</div>{document.ocrStatus === "needs_review" && <p className="ec-ocr-warning">{es ? "Parte del texto puede necesitar revisión." : "Some extracted text may need review."}</p>}{document.ocrStatus === "failed" && <p className="ec-ocr-warning">{es ? "No pudimos extraer texto; el original sigue guardado." : "Text extraction failed; the original remains stored."}</p>}
        <label className="ec-share-toggle"><input type="checkbox" checked={document.sharingApproved} disabled={busy} onChange={(event) => void onSharing(document, event.target.checked)} /><span>{es ? "Permitir incluir este archivo en la solicitud aprobada" : "Allow this file in an approved consultation request"}</span></label>
      </div>
      <button className="ec-delete-document" disabled={busy} onClick={() => void onDelete(document)} aria-label={es ? `Eliminar ${document.fileName}` : `Delete ${document.fileName}`}><Trash2 size={18} /></button>
    </article>)}</section>}
    <button className="ec-continue-records" onClick={onContinue}>{documents.length ? (es ? "Continuar" : "Continue") : (es ? "Continuar sin documentos" : "Continue without records")}<ChevronRight size={18} /></button>
  </Step>;
}

function Results({ evidence, specialists, visible, setVisible, hasMoreSpecialists, specialistLoadingMore, onShowMoreSpecialists, es, error, educational, verificationBusy, researchAcknowledged, acknowledgementBusy, onAcknowledgeResearch, onRequestVerification, onPrepareContact }: { evidence: ExpertCareResearchResponse | null; specialists: SpecialistCandidate[]; visible: number; setVisible: (n: number) => void; hasMoreSpecialists: boolean; specialistLoadingMore: boolean; onShowMoreSpecialists: () => void; es: boolean; error: string; educational: string; verificationBusy: string | null; researchAcknowledged: boolean; acknowledgementBusy: boolean; onAcknowledgeResearch: () => void; onRequestVerification: (candidate: SpecialistCandidate) => Promise<void>; onPrepareContact: (candidate: SpecialistCandidate) => void }) {
  const standard = evidence?.items.filter((item) => !item.experimental) ?? [];
  const experimental = evidence?.items.filter((item) => item.experimental) ?? [];
  const chooseAlternative = (failedId: string) => {
    const alternativeIndex = specialists.findIndex((candidate) => candidate.id !== failedId && candidate.verificationStatus !== "failed");
    if (alternativeIndex < 0) return;
    setVisible(Math.max(visible, alternativeIndex + 1));
    window.requestAnimationFrame(() => document.getElementById(`ec-specialist-${specialists[alternativeIndex]!.id}`)?.focus());
  };
  return <section className="ec-results"><div className="ec-brief-head"><span><ShieldCheck size={19} /></span><div><p>EXPERT CARE BRIEF</p><h1>{es ? "Tu informe de investigación está listo" : "Your research brief is ready"}</h1></div></div><p className="ec-boundary">{educational}</p>{evidence?.safetyNotices?.map((notice) => <p className="ec-safety-notice" key={notice}><ShieldCheck size={16} />{notice}</p>)}{evidence?.sourceStatuses && <details className="ec-source-coverage"><summary>{es ? "Cobertura y estado de las fuentes" : "Source coverage and status"}</summary><div>{evidence.sourceStatuses.map((source) => <p key={source.source}><strong>{source.source}</strong><span data-status={source.status}>{source.status === "available" ? (es ? "Disponible" : "Available") : source.status === "configuration_required" ? (es ? "Conector necesario" : "Connector required") : (es ? "No disponible" : "Unavailable")}</span>{source.detail && <small>{source.detail}</small>}</p>)}</div></details>}{error && <p className="ec-error">{error}</p>}
    <h2>{es ? "Evidencia reciente" : "Recent evidence"}</h2>{standard.length ? standard.map((item) => <EvidenceCard key={item.id} item={item} es={es} />) : <p className="ec-empty">{es ? "No encontramos evidencia reciente verificable en las fuentes disponibles." : "No recent verifiable evidence was found in the available sources."}</p>}
    {experimental.length > 0 && <div className="ec-experimental"><h2>{es ? "Investigación experimental" : "Experimental research"}</h2><p>{es ? "Estos estudios no son atención establecida ni indican elegibilidad." : "These studies are not established care and do not indicate eligibility."}</p>{experimental.map((item) => <EvidenceCard key={item.id} item={item} es={es} />)}</div>}
    <section className={`ec-comprehension${researchAcknowledged ? " ec-comprehension--confirmed" : ""}`} aria-label={es ? "Confirmación del alcance" : "Scope acknowledgement"}><ShieldCheck size={20} /><div><strong>{es ? "Antes de verificar un especialista" : "Before specialist verification"}</strong><p>{es ? "Entiendo que este informe es educativo, puede contener incertidumbre y no sustituye el consejo de mi equipo médico." : "I understand this brief is educational, may contain uncertainty, and does not replace advice from my clinical team."}</p></div>{researchAcknowledged ? <span><CheckCircle2 size={16} />{es ? "Entendido" : "Understood"}</span> : <button disabled={acknowledgementBusy || !evidence} onClick={onAcknowledgeResearch}>{acknowledgementBusy ? <Loader2 className="animate-spin" size={16} /> : null}{es ? "Lo entiendo" : "I understand"}</button>}</section>
    <h2>{es ? "Especialistas para verificar" : "Specialists to verify"}</h2><p className="ec-section-help">{es ? "Los resultados de directorios abiertos deben verificarse antes de cualquier contacto." : "Open-directory results must be verified before any contact."}</p><div className="ec-specialists">{specialists.slice(0, visible).map((candidate) => <SpecialistCard key={candidate.id} candidate={candidate} es={es} busy={verificationBusy === candidate.id} actionEnabled={researchAcknowledged} hasAlternative={specialists.some((item) => item.id !== candidate.id && item.verificationStatus !== "failed")} onChooseAlternative={() => chooseAlternative(candidate.id)} onRequestVerification={() => void onRequestVerification(candidate)} onPrepareContact={() => onPrepareContact(candidate)} />)}</div>{hasMoreSpecialists && <button className="ec-more" disabled={specialistLoadingMore} onClick={onShowMoreSpecialists}>{specialistLoadingMore ? <Loader2 className="animate-spin" size={16} /> : null}{es ? "Mostrar más" : "Show more"}</button>}
  </section>;
}
function EvidenceCard({ item, es }: { item: EvidenceItem; es: boolean }) { return <article className="ec-evidence"><div className="ec-evidence-meta"><span>{item.evidenceType.replaceAll("_", " ")}</span>{item.publishedAt && <time>{item.publishedAt}</time>}</div><div className="ec-evidence-context"><span>{item.jurisdiction}</span><span data-freshness={item.freshnessStatus}>{item.freshnessStatus === "current" ? (es ? "Actual" : "Current") : item.freshnessStatus === "stale" ? (es ? "Puede estar desactualizado" : "May be stale") : (es ? "Actualidad desconocida" : "Freshness unknown")}</span><span>{item.evidenceStatus}</span></div><h3>{item.title}</h3><dl><div><dt>{es ? "Qué cambió" : "What changed"}</dt><dd>{item.whatChanged}</dd></div><div><dt>{es ? "Por qué puede importar" : "Why it may matter"}</dt><dd>{item.whyItMayMatter}</dd></div><div><dt>{es ? "Pregunta al especialista" : "Ask the specialist"}</dt><dd>{item.askTheSpecialist}</dd></div></dl><p className="ec-limit">{item.limitations}</p><div className="ec-citations">{item.citations.map((citation) => <a key={citation.id} href={citation.url} target="_blank" rel="noreferrer">{citation.label}</a>)}</div></article>; }
function SpecialistCard({ candidate, es, busy, actionEnabled, hasAlternative, onChooseAlternative, onRequestVerification, onPrepareContact }: { candidate: SpecialistCandidate; es: boolean; busy: boolean; actionEnabled: boolean; hasAlternative: boolean; onChooseAlternative: () => void; onRequestVerification: () => void; onPrepareContact: () => void }) {
  const verified = candidate.verificationStatus === "verified";
  const pending = candidate.verificationStatus === "verification_pending";
  const failed = candidate.verificationStatus === "failed";
  const distance = candidate.distanceMeters == null ? null : candidate.distanceMeters < 1000 ? `${Math.round(candidate.distanceMeters)} m` : `${(candidate.distanceMeters / 1000).toFixed(1)} km`;
  return <article id={`ec-specialist-${candidate.id}`} tabIndex={-1} className={`ec-specialist${failed ? " ec-specialist--failed" : ""}`}>
    <div className={verified ? "ec-verified" : "ec-unverified"}>{verified ? (es ? "Verificado por VYVA" : "VYVA verified") : pending ? (es ? "Verificación solicitada" : "Verification requested") : failed ? (es ? "No se pudo completar la verificación" : "Verification could not be completed") : (es ? "Pendiente de verificación" : "Verification required")}</div>
    <h3>{candidate.name}</h3>{candidate.institution && <p>{candidate.institution}</p>}{candidate.address && <p className="ec-address"><MapPin size={15} />{candidate.address}</p>}
    <div className="ec-specialist-facts"><span>{distance ?? (es ? "Distancia desconocida" : "Distance unknown")}</span><span>{candidate.openingStatus ?? candidate.todayOpeningHours ?? (es ? "Horario desconocido" : "Hours unknown")}</span></div>
    <div className="ec-rating">{candidate.rating ? `★ ${candidate.rating}${candidate.reviewCount ? ` (${candidate.reviewCount})` : ""}${candidate.ratingProvenance ? ` · ${candidate.ratingProvenance}` : ""}` : (es ? "Valoración no disponible" : "Rating unavailable")}</div>
    {candidate.languages.length > 0 && <p>{es ? "Idiomas" : "Languages"}: {candidate.languages.join(", ")}</p>}{candidate.remoteCareRegions.length > 0 && <p>{es ? "Atención remota" : "Remote care"}: {candidate.remoteCareRegions.join(", ")}</p>}
    {failed && <p className="ec-verification-failure">{es ? "No iniciaremos ningún contacto. Conservamos la fuente para auditoría y puedes revisar otra opción segura." : "No contact will be started. We keep the source for audit and you can review another safe option."}</p>}
    <button disabled={busy || pending || (!failed && !actionEnabled) || (failed && !hasAlternative)} onClick={failed ? onChooseAlternative : verified ? onPrepareContact : onRequestVerification}>
      {busy ? <Loader2 className="animate-spin" size={16} /> : failed ? <ChevronRight size={16} /> : <ShieldCheck size={16} />}
      {verified ? (es ? "Preparar contacto" : "Prepare contact") : pending ? (es ? "Verificación en curso" : "Verification in progress") : failed ? hasAlternative ? (es ? "Revisar otra opción" : "Review another option") : (es ? "No hay otra opción disponible" : "No alternative available") : (es ? "Pedir verificación" : "Request verification")}
    </button>
  </article>;
}
