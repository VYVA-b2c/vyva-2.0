import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2, RefreshCw, ShieldAlert, Stethoscope, TriangleAlert } from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import type { ExpertCareVerifiedProfile, SpecialistCandidate } from "../../../shared/expertCare";

type Gate = { id: string; required: boolean; passed: boolean; detail: string };
type Readiness = { ready: boolean; mode: string; blockers: string[]; gates: Gate[]; clinicalReview: { reviewerName: string; policyVersion: string; verdict: string; createdAt: string; validUntil: string | null } | null };
type QueueItem = { caseId: string; ownerUserId: string; candidate: SpecialistCandidate; requestedAt: string; caseContext: { specialty: string | null; location: string | null; languages: string[] } };
type Metric = { metric: string; severity: string; count: number; averageValue: number | null; latestAt: string };
type CoordinationItem = { caseId: string; ownerUserId: string; candidate: SpecialistCandidate; preparation: { pendingActionId: string; confirmedAt: string; channel: string } };
type Checks = { identityConfirmed: boolean; licenseConfirmed: boolean; subspecialtyConfirmed: boolean; institutionConfirmed: boolean; languagesConfirmed: boolean; remoteRegionsConfirmed: boolean; contactRouteConfirmed: boolean };
type ProfileDraft = { institution: string; country: string; address: string; languages: string; remoteCareRegions: string; expertiseEvidence: string; email: string; phone: string; website: string; availability: string; timezone: string; estimatedCost: string };

const emptyChecks: Checks = { identityConfirmed: false, licenseConfirmed: false, subspecialtyConfirmed: false, institutionConfirmed: false, languagesConfirmed: false, remoteRegionsConfirmed: false, contactRouteConfirmed: false };
const checkLabels: Array<[keyof Checks, string]> = [
  ["identityConfirmed", "Identity"], ["licenseConfirmed", "Active license"], ["subspecialtyConfirmed", "Subspecialty"],
  ["institutionConfirmed", "Institution"], ["languagesConfirmed", "Languages"], ["remoteRegionsConfirmed", "Remote-care countries"],
  ["contactRouteConfirmed", "Contact route"],
];
const profileDraftFor = (candidate: SpecialistCandidate): ProfileDraft => ({
  institution: candidate.institution ?? "", country: candidate.country ?? "", address: candidate.address ?? "",
  languages: candidate.languages.join(", "), remoteCareRegions: candidate.remoteCareRegions.join(", "), expertiseEvidence: candidate.expertiseEvidence.join("\n"),
  email: candidate.contactData.email ?? "", phone: candidate.contactData.phone ?? "", website: candidate.contactData.website ?? "",
  availability: candidate.availability ?? "", timezone: candidate.timezone ?? "", estimatedCost: candidate.estimatedCost ?? "",
});
const list = (value: string) => value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
const nullable = (value: string) => value.trim() || null;

function VerifiedProfileFields({ candidate, value, onChange }: { candidate: SpecialistCandidate; value: ProfileDraft | undefined; onChange: (next: ProfileDraft) => void }) {
  const profile = value ?? profileDraftFor(candidate);
  const update = (key: keyof ProfileDraft, next: string) => onChange({ ...profile, [key]: next });
  const field = (key: keyof ProfileDraft, label: string, placeholder = "") => <label className="text-xs font-black uppercase tracking-[.1em] text-[#7d6b65]">{label}<input value={profile[key]} placeholder={placeholder} onChange={(event) => update(key, event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[#ddcfc5] px-3 text-sm font-medium normal-case tracking-normal" /></label>;
  return <fieldset className="mt-4 rounded-xl border border-[#eadfd5] bg-[#fcfaf8] p-3">
    <legend className="px-1 text-xs font-black uppercase tracking-[.12em] text-purple-700">Verified profile facts</legend>
    <p className="mb-3 text-xs leading-relaxed text-[#7d6b65]">Enter only facts confirmed from authoritative sources. Leave optional facts blank rather than inferring them.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {field("institution", "Institution", "Verified institution")}{field("country", "Country", "Country")}
      {field("languages", "Languages", "English, Spanish")}{field("remoteCareRegions", "Remote-care countries", "Spain, United Kingdom")}
      {field("email", "Verified email", "clinic@example.org")}{field("phone", "Verified phone", "+34 …")}
      {field("website", "Verified website", "https://…")}{field("timezone", "Timezone", "Europe/Madrid")}
      {field("availability", "Availability", "Remote appointments available")}{field("estimatedCost", "Estimated cost", "€250, if confirmed")}
      {field("address", "Address", "Verified clinic address")}
    </div>
    <label className="mt-3 block text-xs font-black uppercase tracking-[.1em] text-[#7d6b65]">Expertise evidence<textarea value={profile.expertiseEvidence} placeholder="One verified credential or subspecialty fact per line" onChange={(event) => update("expertiseEvidence", event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-[#ddcfc5] p-3 text-sm font-medium normal-case tracking-normal" /></label>
  </fieldset>;
}

export default function ExpertCareAdminPage() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [coordination, setCoordination] = useState<CoordinationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, Checks>>({});
  const [details, setDetails] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileDraft>>({});
  const [responseNotes, setResponseNotes] = useState<Record<string, string>>({});
  const [reviewerName, setReviewerName] = useState("");
  const [policyVersion, setPolicyVersion] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewScope, setReviewScope] = useState({ sourcePolicyReviewed: false, emergencyBoundariesReviewed: false, promptsReviewed: false, sampledOutputsReviewed: false });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [readinessResponse, queueResponse, coordinationResponse, metricsResponse] = await Promise.all([
        apiFetch("/api/expert-care/launch-readiness"), apiFetch("/api/expert-care/verification-queue"), apiFetch("/api/expert-care/coordination-queue"), apiFetch("/api/expert-care/safety-metrics?hours=168"),
      ]);
      if (!readinessResponse.ok || !queueResponse.ok || !coordinationResponse.ok || !metricsResponse.ok) throw new Error("Expert Care operations data could not be loaded.");
      const [nextReadiness, nextQueue, nextCoordination, nextMetrics] = await Promise.all([readinessResponse.json(), queueResponse.json(), coordinationResponse.json(), metricsResponse.json()]) as [Readiness, { items: QueueItem[] }, { items: CoordinationItem[] }, { metrics: Metric[] }];
      setReadiness(nextReadiness); setQueue(nextQueue.items); setCoordination(nextCoordination.items); setMetrics(nextMetrics.metrics);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Expert Care operations data could not be loaded."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  const metricMap = useMemo(() => new Map(metrics.map((metric) => [metric.metric, metric])), [metrics]);

  async function resolve(item: QueueItem, status: "verified" | "failed") {
    const itemChecks = checks[item.candidate.id] ?? emptyChecks;
    const note = details[item.candidate.id]?.trim() ?? "";
    if (note.length < 3) { setMessage("Add a verification note before resolving the candidate."); return; }
    if (status === "verified" && Object.values(itemChecks).some((value) => !value)) { setMessage("Every verification check must pass before marking a specialist verified."); return; }
    const profile = profiles[item.candidate.id] ?? profileDraftFor(item.candidate);
    const verifiedProfile: ExpertCareVerifiedProfile = {
      institution: profile.institution.trim(), country: profile.country.trim(), address: nullable(profile.address),
      languages: list(profile.languages), remoteCareRegions: list(profile.remoteCareRegions), expertiseEvidence: list(profile.expertiseEvidence),
      contactData: { email: nullable(profile.email), phone: nullable(profile.phone), website: nullable(profile.website) },
      availability: nullable(profile.availability), timezone: nullable(profile.timezone), estimatedCost: nullable(profile.estimatedCost),
    };
    if (status === "verified" && (!verifiedProfile.institution || !verifiedProfile.country || verifiedProfile.languages.length === 0 || verifiedProfile.expertiseEvidence.length === 0)) {
      setMessage("Add the verified institution, country, language, and expertise evidence before approval."); return;
    }
    if (status === "verified" && !verifiedProfile.contactData.email && !verifiedProfile.contactData.phone && !verifiedProfile.contactData.website) {
      setMessage("Add at least one verified contact route before approval."); return;
    }
    setBusyId(item.candidate.id); setMessage("");
    try {
      const response = await apiFetch(`/api/expert-care/cases/${item.caseId}/specialists/${encodeURIComponent(item.candidate.id)}/verification`, { method: "PATCH", body: JSON.stringify({ ownerUserId: item.ownerUserId, status, details: [note], ...itemChecks, ...(status === "verified" ? { verifiedProfile } : {}) }) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Verification could not be saved.");
      await refresh();
      setMessage(status === "verified" ? `${item.candidate.name} verified. Contact remains member-confirmed.` : `${item.candidate.name} blocked; safe alternatives remain available.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Verification could not be saved."); }
    finally { setBusyId(null); }
  }

  async function recordReview(verdict: "approved" | "rejected") {
    setBusyId("clinical-review"); setMessage("");
    try {
      const response = await apiFetch("/api/expert-care/clinical-safety-reviews", { method: "POST", body: JSON.stringify({ reviewerName, policyVersion, verdict, notes: reviewNotes, ...reviewScope }) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Clinical safety review could not be recorded.");
      await refresh();
      setMessage(`Clinical safety review recorded as ${verdict}.`); setReviewNotes("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Clinical safety review could not be recorded."); }
    finally { setBusyId(null); }
  }

  async function recordResponse(item: CoordinationItem, outcome: "accepted" | "declined" | "no_response") {
    setBusyId(`response:${item.candidate.id}`); setMessage("");
    try {
      const response = await apiFetch(`/api/expert-care/cases/${item.caseId}/specialist-response`, { method: "POST", body: JSON.stringify({ ownerUserId: item.ownerUserId, candidateId: item.candidate.id, outcome, notes: responseNotes[item.candidate.id]?.trim() || null, receivedAt: new Date().toISOString() }) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Specialist response could not be recorded.");
      await refresh(); setMessage(`${item.candidate.name}: ${outcome.replace("_", " ")} recorded.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Specialist response could not be recorded."); }
    finally { setBusyId(null); }
  }

  return <main className="min-h-screen bg-[#f7f2eb] px-4 py-6 text-[#2f2135] sm:px-6 sm:py-8"><section className="mx-auto max-w-7xl">
    <AdminPageHeader title="Expert Care operations" subtitle="Clinical launch gates, specialist verification, and safety signals for second-opinion coordination."><button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-purple-700 px-4 text-sm font-black text-white disabled:opacity-60"><RefreshCw size={16} className={loading ? "animate-spin" : ""} />Refresh</button></AdminPageHeader>
    <AdminMenu />
    {message && <p role="status" className="mt-4 rounded-xl border border-purple-100 bg-white px-4 py-3 text-sm font-bold text-purple-800">{message}</p>}
    <section className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
      <article className="rounded-[16px] border border-[#eadfd5] bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.14em] text-purple-700">Launch readiness</p><h2 className="mt-1 font-serif text-2xl">{readiness?.ready ? "Ready for configured stage" : "Release blocked safely"}</h2><p className="mt-1 text-sm text-[#7d6b65]">Mode: {readiness?.mode ?? "loading"}</p></div>{readiness?.ready ? <CheckCircle2 className="text-emerald-600" /> : <ShieldAlert className="text-rose-600" />}</div><div className="mt-4 grid gap-2">{readiness?.gates.map((gate) => <div key={gate.id} className="flex gap-3 rounded-xl border border-[#eee4dc] p-3">{gate.passed ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" /> : <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />}<div><strong className="text-sm">{gate.id.replaceAll("_", " ")}</strong><p className="mt-1 text-xs leading-relaxed text-[#7d6b65]">{gate.detail}{!gate.required ? " Not required at this stage." : ""}</p></div></div>)}</div></article>
      <article className="rounded-[16px] border border-[#eadfd5] bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[.14em] text-purple-700">Seven-day signals</p><div className="mt-4 grid grid-cols-2 gap-3">{["research_generated", "user_comprehension", "verification_failed", "consultation_ready"].map((name) => <div key={name} className="rounded-xl bg-[#faf7f3] p-3"><strong className="text-xl">{metricMap.get(name)?.count ?? 0}</strong><p className="mt-1 text-xs text-[#7d6b65]">{name.replaceAll("_", " ")}</p></div>)}</div></article>
    </section>

    {queue.length > 0 && <section className="mt-5 rounded-[16px] border border-[#eadfd5] bg-white p-5 shadow-sm">
      <h2 className="font-serif text-2xl">Verified specialist facts</h2>
      <p className="mt-1 text-sm text-[#7d6b65]">These values replace unverified directory data on the member’s card. At least one confirmed contact route is required.</p>
      <div className="mt-4 grid gap-4">{queue.map((item) => <article key={`profile:${item.caseId}:${item.candidate.id}`} className="rounded-xl border border-[#eadfd5] p-4"><h3 className="font-black">{item.candidate.name}</h3><VerifiedProfileFields candidate={item.candidate} value={profiles[item.candidate.id]} onChange={(next) => setProfiles((current) => ({ ...current, [item.candidate.id]: next }))} /></article>)}</div>
    </section>}

    <section className="mt-5 rounded-[16px] border border-[#eadfd5] bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><Stethoscope className="text-purple-700" /><div><h2 className="font-serif text-2xl">Specialist verification queue</h2><p className="text-sm text-[#7d6b65]">No member contact is possible from this queue. All seven facts must pass first.</p></div></div>{loading ? <p className="mt-5 flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={16} />Loading queue…</p> : queue.length === 0 ? <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">No verification requests are waiting.</p> : <div className="mt-5 grid gap-4">{queue.map((item) => { const itemChecks = checks[item.candidate.id] ?? emptyChecks; return <article key={`${item.caseId}:${item.candidate.id}`} className="rounded-[14px] border border-[#eadfd5] p-4"><div className="grid gap-4 xl:grid-cols-[.7fr_1.3fr]"><div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black uppercase text-amber-700">Verification pending</span><h3 className="mt-3 text-lg font-black">{item.candidate.name}</h3><p className="text-sm text-[#7d6b65]">{item.candidate.institution ?? "Institution unknown"}</p><p className="mt-2 text-xs text-[#7d6b65]">{item.caseContext.specialty ?? "Specialty unknown"} · {item.caseContext.location ?? "Location unknown"}</p><div className="mt-3 flex flex-wrap gap-2">{item.candidate.directorySources.map((source) => source.url ? <a key={source.label} href={source.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-purple-700 underline">{source.label}</a> : <span key={source.label} className="text-xs text-[#7d6b65]">{source.label}</span>)}</div></div><div><fieldset><legend className="text-xs font-black uppercase tracking-[.12em] text-[#7d6b65]">Required checks</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{checkLabels.map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-2 rounded-lg bg-[#faf7f3] px-3 text-sm font-bold"><input type="checkbox" checked={itemChecks[key]} onChange={(event) => setChecks((current) => ({ ...current, [item.candidate.id]: { ...itemChecks, [key]: event.target.checked } }))} />{label}</label>)}</div></fieldset><label className="mt-3 block text-xs font-black uppercase tracking-[.12em] text-[#7d6b65]">Audit note<textarea value={details[item.candidate.id] ?? ""} onChange={(event) => setDetails((current) => ({ ...current, [item.candidate.id]: event.target.value }))} rows={3} className="mt-2 w-full rounded-xl border border-[#ddcfc5] p-3 text-sm font-medium normal-case tracking-normal" /></label><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => void resolve(item, "verified")} disabled={busyId === item.candidate.id} className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-50">Verify specialist</button><button onClick={() => void resolve(item, "failed")} disabled={busyId === item.candidate.id} className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-black text-rose-800 disabled:opacity-50">Block and use alternatives</button></div></div></div></article>; })}</div>}</section>

    <section className="mt-5 rounded-[16px] border border-[#eadfd5] bg-white p-5 shadow-sm"><h2 className="font-serif text-2xl">Awaiting specialist response</h2><p className="mt-1 text-sm text-[#7d6b65]">Record only an attributable response to the member-approved request.</p>{coordination.length === 0 ? <p className="mt-4 rounded-xl bg-[#faf7f3] p-4 text-sm font-bold text-[#6f625d]">No prepared requests are awaiting a response.</p> : <div className="mt-4 grid gap-3">{coordination.map((item) => <article key={`${item.caseId}:${item.candidate.id}`} className="rounded-xl border border-[#eadfd5] p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h3 className="font-black">{item.candidate.name}</h3><p className="text-sm text-[#7d6b65]">{item.candidate.institution ?? "Institution unknown"} · {item.preparation.channel}</p><label className="mt-3 block text-xs font-black uppercase tracking-[.12em] text-[#7d6b65]">Response note<input value={responseNotes[item.candidate.id] ?? ""} onChange={(event) => setResponseNotes((current) => ({ ...current, [item.candidate.id]: event.target.value }))} className="mt-2 min-h-11 w-full rounded-xl border border-[#ddcfc5] px-3 text-sm font-medium normal-case tracking-normal" /></label></div><div className="flex flex-wrap gap-2"><button onClick={() => void recordResponse(item, "accepted")} className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white">Accepted</button><button onClick={() => void recordResponse(item, "declined")} className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-black text-rose-800">Declined</button><button onClick={() => void recordResponse(item, "no_response")} className="min-h-11 rounded-xl border border-[#ddcfc5] px-4 text-sm font-black">No response</button></div></div></article>)}</div>}</section>

    <section className="mt-5 rounded-[16px] border border-[#eadfd5] bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><ClipboardCheck className="text-purple-700" /><div><h2 className="font-serif text-2xl">Independent clinical safety review</h2><p className="text-sm text-[#7d6b65]">Append-only approval evidence. An approval is invalid unless every review area is confirmed.</p></div></div>{readiness?.clinicalReview && <p className="mt-4 rounded-xl bg-[#faf7f3] p-3 text-sm"><strong>Latest:</strong> {readiness.clinicalReview.verdict} by {readiness.clinicalReview.reviewerName} · {readiness.clinicalReview.policyVersion}</p>}<div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-xs font-black uppercase tracking-[.12em] text-[#7d6b65]">Independent reviewer<input value={reviewerName} onChange={(event) => setReviewerName(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#ddcfc5] px-3 text-sm font-medium normal-case tracking-normal" /></label><label className="text-xs font-black uppercase tracking-[.12em] text-[#7d6b65]">Policy version<input value={policyVersion} onChange={(event) => setPolicyVersion(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[#ddcfc5] px-3 text-sm font-medium normal-case tracking-normal" /></label></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(reviewScope).map(([key, value]) => <label key={key} className="flex min-h-11 items-center gap-2 rounded-lg bg-[#faf7f3] px-3 text-sm font-bold"><input type="checkbox" checked={value} onChange={(event) => setReviewScope((current) => ({ ...current, [key]: event.target.checked }))} />{key.replace(/([A-Z])/g, " $1").replace("Reviewed", " reviewed")}</label>)}</div><label className="mt-3 block text-xs font-black uppercase tracking-[.12em] text-[#7d6b65]">Review notes<textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-[#ddcfc5] p-3 text-sm font-medium normal-case tracking-normal" /></label><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => void recordReview("approved")} disabled={busyId === "clinical-review"} className="min-h-11 rounded-xl bg-purple-700 px-4 text-sm font-black text-white disabled:opacity-50">Record approval</button><button onClick={() => void recordReview("rejected")} disabled={busyId === "clinical-review"} className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-black text-rose-800 disabled:opacity-50">Record rejection</button></div></section>
  </section></main>;
}
