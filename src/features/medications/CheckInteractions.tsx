import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, CircleHelp, ClipboardList, HeartPulse, Mic, Phone, Pill, PlusCircle, Printer, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/queryClient";

type Flag = { flagKey: string; medicines: string[]; why: string; canSnooze: boolean; snoozeCount: number };
type Medicine = { id: string; display_name: string; dose_text?: string | null; purpose_text?: string | null; prescriber_name?: string | null; photo_url?: string | null };
type CheckPayload = { state: "not_ready" | "has_questions" | "needs_info" | "needs_more" | "nothing_found"; savedCount: number; comparedCount: number; untagged: Medicine[]; flags: Flag[]; totalFlagCount: number; lastSweepAt: string | null; sweepDue: boolean; safetyNetEnabled: boolean; pharmacy: { name: string; phone: string; address: string } | null; medicines: Medicine[]; profile: { firstName: string; updatedAt: string | null } };
type Sheet = "extras" | "preview" | "prep" | "outcome" | "unwell" | "list" | null;
const checkStates = new Set<CheckPayload["state"]>(["not_ready", "has_questions", "needs_info", "needs_more", "nothing_found"]);

function isCheckPayload(value: unknown): value is CheckPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CheckPayload>;
  return checkStates.has(candidate.state as CheckPayload["state"])
    && typeof candidate.savedCount === "number"
    && typeof candidate.comparedCount === "number"
    && Array.isArray(candidate.untagged)
    && Array.isArray(candidate.flags)
    && typeof candidate.totalFlagCount === "number"
    && (candidate.lastSweepAt === null || typeof candidate.lastSweepAt === "string")
    && typeof candidate.sweepDue === "boolean"
    && typeof candidate.safetyNetEnabled === "boolean"
    && (candidate.pharmacy === null || typeof candidate.pharmacy === "object")
    && Array.isArray(candidate.medicines)
    && Boolean(candidate.profile && typeof candidate.profile.firstName === "string"
      && (candidate.profile.updatedAt === null || typeof candidate.profile.updatedAt === "string"));
}
const classes = [
  ["nsaid_pain_reliever", "Pain tablets (ibuprofen, aspirin…)", "otc"],
  ["sedative_sleep_aid", "Sleep aids", "otc"],
  ["antihistamine_allergy", "Allergy tablets", "otc"],
  ["cold_flu_combination", "Cold and flu remedies", "otc"],
  ["antacid_stomach", "Stomach / heartburn", "otc"],
  ["supplement_herbal", "Vitamins, herbal, supplements", "supplement"],
] as const;

export default function CheckInteractions({ onAddMedicine }: { onAddMedicine?: () => void }) {
  const { t } = useTranslation(); const navigate = useNavigate(); const queryClient = useQueryClient();
  const [sheet, setSheet] = useState<Sheet>(null); const [selectedFlag, setSelectedFlag] = useState<Flag | null>(null); const [preview, setPreview] = useState<CheckPayload | null>(null); const [name, setName] = useState(""); const [selectedClass, setSelectedClass] = useState<(typeof classes)[number] | null>(null);
  const query = useQuery<unknown>({ queryKey: ["/api/meds/safety-check"], staleTime: 0 });
  const data = isCheckPayload(query.data) ? query.data : undefined;
  const flags = Array.isArray(data?.flags) ? data.flags : [];
  const medicines = Array.isArray(data?.medicines) ? data.medicines : [];
  const untagged = Array.isArray(data?.untagged) ? data.untagged : [];
  const totalFlagCount = typeof data?.totalFlagCount === "number" ? data.totalFlagCount : flags.length;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/meds/safety-check"] });
  const post = useMutation({ mutationFn: ({ url, body }: { url: string; body?: unknown }) => apiFetch(url, { method: "POST", body: body ? JSON.stringify(body) : undefined }), onSuccess: refresh });
  const status = (() => {
    if (!data) return { title: t("meds.check.notReady.title"), body: "", tone: "bg-vyva-purple/5 border-vyva-border" };
    if (data.state === "has_questions") return { title: t("meds.check.hasQuestions.title", { count: totalFlagCount }), body: "", tone: "bg-vyva-gold-light border-vyva-gold" };
    if (data.state === "needs_info") return { title: t("meds.check.needsInfo.title", { name: untagged[0]?.display_name }), body: "", tone: "bg-vyva-purple/5 border-vyva-border" };
    if (data.state === "needs_more") return { title: t("meds.check.needsMore.title"), body: t("meds.check.needsMore.body", { count: data.savedCount }), tone: "bg-vyva-purple/5 border-vyva-border" };
    if (data.state === "nothing_found") return { title: t("meds.check.nothingFound.title"), body: `${t("meds.check.nothingFound.body", { count: data.comparedCount })} ${t("meds.check.row.extras")}`, tone: "bg-white border-vyva-border" };
    return { title: t("meds.check.notReady.title"), body: t("meds.check.notReady.body"), tone: "bg-vyva-purple/5 border-vyva-border" };
  })();
  const openFlag = (flag: Flag, next: Sheet) => { setSelectedFlag(flag); setSheet(next); };
  const addExtra = async (classTag: string, previewOnly: boolean) => {
    const displayName = name || classes.find(([tag]) => tag === classTag)?.[1];
    if (previewOnly) { const response = await apiFetch("/api/meds/safety-check/preview", { method: "POST", body: JSON.stringify({ classTag, displayName }) }); setPreview(await response.json()); return; }
    await post.mutateAsync({ url: "/api/meds/extras", body: { classTag, displayName: name || undefined } }); setName(""); setSheet(null);
  };
  const showList = () => setSheet("list");
  const shareList = async () => { const text = `${data?.profile?.firstName || ""}\n${medicines.map((medicine) => `${medicine.display_name}${medicine.dose_text ? ` — ${medicine.dose_text}` : ""}`).join("\n")}`; if (navigator.share) await navigator.share({ title: t("meds.check.row.pharmacist"), text }); else await navigator.clipboard.writeText(text); };

  if (query.isLoading) return <div className="min-h-[140px] rounded-[24px] border border-vyva-border bg-white p-6 text-[20px] font-bold">{t("common.loading", "Loading…")}</div>;
  if (query.isError) return <div className="rounded-[24px] border border-vyva-border bg-white p-6 text-[20px]"><p className="font-bold">{t("common.error", "Something went wrong.")}</p><button className="mt-4 min-h-[70px] rounded-full bg-vyva-purple px-6 font-bold text-white" onClick={() => query.refetch()}>{t("common.retry", "Try again")}</button></div>;
  return <section className="mx-auto w-full max-w-[760px] space-y-5 overflow-x-hidden pb-8 text-vyva-text-1" data-testid="medicine-check">
    <div data-testid="section-check-interactions">
    <h2 className="font-display text-[34px] font-semibold leading-[1.1]">{t("meds.checkInteractions.title", "Check medicines together")}</h2>
    <article className={`rounded-[26px] border p-5 ${status.tone}`} data-testid={`medicine-check-status-${data?.state || "not_ready"}`}>
      <div className="flex gap-4"><HeartPulse className="mt-1 shrink-0 text-vyva-purple" size={32} aria-hidden="true"/><div><h3 className="font-display text-[28px] font-semibold leading-tight">{status.title}</h3>{status.body ? <p className="mt-2 text-[20px] leading-snug">{status.body}</p> : null}</div></div>
      {data?.state === "needs_more" ? <button className="mt-4 min-h-[70px] w-full rounded-full bg-vyva-purple px-6 text-[20px] font-bold text-white" onClick={onAddMedicine}>{t("meds.check.needsMore.cta")}</button> : null}
      {data?.state === "needs_info" ? <button className="mt-4 min-h-[70px] w-full rounded-full bg-vyva-purple px-6 text-[20px] font-bold text-white" onClick={onAddMedicine}>{t("meds.check.needsInfo.cta", "Add what it is for")}</button> : null}
      {data?.state === "not_ready" ? <button className="mt-4 min-h-[70px] w-full rounded-full bg-vyva-purple px-6 text-[20px] font-bold text-white" onClick={showList}>{t("meds.check.row.pharmacist")}</button> : null}
    </article>
    {flags.map((flag, index) => <article key={flag.flagKey} className="rounded-[26px] border border-vyva-gold bg-vyva-gold-light p-5" data-testid={`card-med-interaction-${index}`}>
      <h3 className="font-display text-[28px] font-semibold">{flag.medicines.join(" + ")}</h3><p className="mt-2 text-[20px] leading-snug">{flag.why}</p><p className="mt-2 text-[18px] font-bold">{t("meds.checkInteractions.ruleShort", "Check before taking together.")}</p>
      <div className="mt-5 grid gap-4"><button className="min-h-[70px] rounded-full bg-vyva-purple px-5 text-[20px] font-bold text-white" onClick={() => { post.mutate({ url: `/api/meds/safety-check/flags/${encodeURIComponent(flag.flagKey)}/ask` }); openFlag(flag, "prep"); }}>{t("meds.check.flag.ask")}</button><button className="min-h-[70px] rounded-full border-2 border-vyva-purple bg-white px-5 text-[20px] font-bold text-vyva-purple" onClick={() => openFlag(flag, "outcome")}>{t("meds.check.flag.asked")}</button><button className="min-h-[70px] rounded-full px-5 text-[20px] font-bold text-vyva-purple" onClick={() => flag.canSnooze ? post.mutate({ url: `/api/meds/safety-check/flags/${encodeURIComponent(flag.flagKey)}/snooze` }) : post.mutate({ url: `/api/meds/safety-check/flags/${encodeURIComponent(flag.flagKey)}/share-family` })}>{flag.canSnooze ? t("meds.check.flag.later") : t("meds.check.flag.family")}</button></div>
    </article>)}
    {data && totalFlagCount > flags.length ? <p className="text-[20px] font-bold text-vyva-text-2">{t("meds.check.moreQuestions", { count: totalFlagCount - flags.length, defaultValue: "Ask your pharmacist about the rest ({{count}} more)." })}</p> : null}
    <p className="text-[18px] leading-snug text-vyva-text-2">{t("meds.checkInteractions.boundary", "This is not a complete interaction review. VYVA never changes doses.")}</p>
    <div className="overflow-hidden rounded-[26px] border border-vyva-border bg-white">{[
      [Pill, "extras", t("meds.check.row.extras"), t("meds.check.row.extrasSub")], [PlusCircle, "preview", t("meds.check.row.preview"), t("meds.check.row.previewSub")], [ClipboardList, "list", t("meds.check.row.pharmacist"), ""],
    ].map(([Icon, id, label, sub]) => <button key={String(id)} data-testid={id === "list" ? "button-med-combination-advice" : undefined} className="flex min-h-[92px] w-full items-center gap-4 border-b border-vyva-border px-5 text-left last:border-0" onClick={() => setSheet(id as Sheet)}><Icon size={30} className="shrink-0 text-vyva-purple" aria-hidden="true"/><span className="min-w-0 flex-1"><strong className="block text-[21px]">{id === "list" ? t("meds.checkInteractions.advice", "Get combination advice") : label as string}</strong>{sub ? <span className="block text-[20px] text-vyva-text-2">{sub as string}</span> : null}</span><ChevronRight size={26} aria-hidden="true"/></button>)}</div>
    <button className="flex min-h-[70px] w-full items-center gap-4 rounded-[22px] px-4 text-left text-[20px] font-bold" onClick={() => setSheet("unwell")}><HeartPulse size={28} className="text-vyva-purple"/><span className="flex-1">{t("meds.check.row.unwell")}</span><ChevronRight size={26}/></button>
    <p className="text-[20px] leading-snug text-vyva-text-2">{t("meds.check.disclaimer")}</p>
    </div>

    <Dialog open={sheet !== null} onOpenChange={(open) => { if (!open) { setSheet(null); setPreview(null); setSelectedClass(null); setName(""); } }}><DialogContent className={`${sheet === "list" ? "h-[100svh] max-w-none rounded-none" : "bottom-0 top-auto max-h-[88svh] translate-y-0 rounded-t-[30px]"} overflow-y-auto bg-white p-6 text-vyva-text-1 sm:max-w-2xl`}>
      {sheet === "extras" || sheet === "preview" ? <><DialogHeader><DialogTitle className="font-display text-[30px]">{sheet === "extras" ? t("meds.check.row.extras") : t("meds.check.row.preview")}</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-4">{classes.map((item) => <button key={item[0]} className={`min-h-[80px] rounded-[20px] border-2 p-3 text-left text-[20px] font-bold ${selectedClass?.[0] === item[0] ? "border-vyva-purple bg-vyva-purple/5" : "border-vyva-border"}`} onClick={() => { setSelectedClass(item); if (sheet === "preview") void addExtra(item[0], true); }}>{item[1]}</button>)}</div>{selectedClass ? <><label className="block text-[20px] font-bold">{t("meds.check.extraName", "Name (optional)")}<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 min-h-[70px] w-full rounded-[18px] border-2 border-vyva-border px-4 text-[20px]"/></label>{sheet === "extras" ? <button className="min-h-[70px] w-full rounded-full bg-vyva-purple px-5 text-[20px] font-bold text-white" onClick={() => addExtra(selectedClass[0], false)}>{t("meds.check.addToList", "Add to my list")}</button> : null}</> : null}{sheet === "extras" ? <button className="min-h-[70px] w-full rounded-full border-2 border-vyva-purple text-[20px] font-bold text-vyva-purple" onClick={() => { post.mutate({ url: "/api/meds/safety-check/sweep-complete" }); setSheet(null); }}>{t("meds.check.nothingElse", "Nothing else")}</button> : null}{preview ? <div className="rounded-[20px] bg-vyva-purple/5 p-5 text-[20px]">{preview.flags.length ? preview.flags.map((flag) => <p key={flag.flagKey} className="font-bold">{flag.medicines.join(" + ")}</p>) : <p>{t("meds.check.previewNone", "Nothing on my list to ask about. Your pharmacist can always double-check.")}</p>}{selectedClass ? <button className="mt-4 min-h-[70px] w-full rounded-full bg-vyva-purple px-5 text-[20px] font-bold text-white" onClick={() => addExtra(selectedClass[0], false)}>{t("meds.check.addToList", "Add to my list")}</button> : null}</div> : null}</> : null}
      {sheet === "prep" && selectedFlag ? <><DialogHeader><DialogTitle className="font-display text-[30px]">{t("meds.check.flag.ask")}</DialogTitle></DialogHeader><p className="rounded-[22px] bg-vyva-purple/5 p-5 text-[24px] leading-snug">{t("meds.check.prepQuestion", { a: selectedFlag.medicines[0], b: selectedFlag.medicines[1], defaultValue: "I take {{a}} and {{b}}. Is it OK to take them together?" })}</p>{data?.pharmacy?.phone ? <a className="flex min-h-[70px] items-center justify-center gap-3 rounded-full bg-vyva-purple text-[20px] font-bold text-white" href={`tel:${data.pharmacy.phone}`}><Phone/>{t("meds.check.callPharmacy", "Call my pharmacist")}</a> : <button className="min-h-[70px] rounded-full bg-vyva-purple text-[20px] font-bold text-white" onClick={() => navigate("/profile/providers")}>{t("meds.check.addPharmacy", "Add my pharmacy")}</button>}<button className="min-h-[70px] rounded-full border-2 border-vyva-purple text-[20px] font-bold text-vyva-purple" onClick={showList}>{t("meds.check.row.pharmacist")}</button><button className="min-h-[70px] rounded-full text-[20px] font-bold text-vyva-purple" onClick={() => post.mutate({ url: `/api/meds/safety-check/flags/${encodeURIComponent(selectedFlag.flagKey)}/share-family` })}>{t("meds.check.flag.family")}</button></> : null}
      {sheet === "outcome" && selectedFlag ? <><DialogHeader><DialogTitle className="font-display text-[30px]">{t("meds.check.outcome.prompt")}</DialogTitle></DialogHeader><div className="grid gap-4">{[["fine", t("meds.check.outcome.fine")], ["changed", t("meds.check.outcome.changed")], ["unsure", t("meds.check.outcome.unsure")]].map(([outcome, label]) => <button key={outcome} className="min-h-[70px] rounded-[20px] border-2 border-vyva-border px-4 text-left text-[20px] font-bold" onClick={async () => { await post.mutateAsync({ url: `/api/meds/safety-check/flags/${encodeURIComponent(selectedFlag.flagKey)}/outcome`, body: { outcome } }); setSheet(null); if (outcome === "changed") onAddMedicine?.(); }}>{label}</button>)}</div></> : null}
      {sheet === "unwell" ? <><DialogHeader><DialogTitle className="font-display text-[30px]">{t("meds.check.row.unwell")}</DialogTitle></DialogHeader><p className="text-[22px] font-bold">{t("meds.check.emergency")}</p><a href="tel:112" className="flex min-h-[70px] items-center justify-center gap-3 rounded-full bg-vyva-purple text-[22px] font-bold text-white"><Phone/>112</a><button className="min-h-[70px] rounded-full border-2 border-vyva-purple text-[20px] font-bold text-vyva-purple" onClick={() => navigate("/emergency")}>SOS</button><button className="min-h-[70px] rounded-full text-[20px] font-bold text-vyva-purple"><Mic className="mr-2 inline"/>Talk to VYVA</button></> : null}
      {sheet === "list" ? <><DialogHeader><DialogTitle className="font-display text-[34px]">{t("meds.check.row.pharmacist")}</DialogTitle></DialogHeader><p className="text-[24px]">{data?.profile?.firstName} · Updated {data?.profile?.updatedAt ? new Date(data.profile.updatedAt).toLocaleDateString() : ""}</p><div className="space-y-4">{medicines.map((medicine) => <article key={medicine.id} className="border-b-2 border-vyva-border py-4 text-[24px]"><strong>{medicine.display_name}</strong>{medicine.dose_text ? <p>{medicine.dose_text}</p> : null}{medicine.purpose_text ? <p>{medicine.purpose_text}</p> : null}{medicine.prescriber_name ? <p>{medicine.prescriber_name}</p> : null}</article>)}</div><h3 className="font-display text-[28px]">My questions</h3>{flags.map((flag) => <p key={flag.flagKey} className="text-[24px]">I take {flag.medicines[0]} and {flag.medicines[1]}. Is it OK to take them together?</p>)}<div className="grid gap-4 sm:grid-cols-2"><button className="min-h-[70px] rounded-full bg-vyva-purple text-[20px] font-bold text-white" onClick={shareList}><Share2 className="mr-2 inline"/>Share</button><button className="min-h-[70px] rounded-full border-2 border-vyva-purple text-[20px] font-bold text-vyva-purple" onClick={() => window.print()}><Printer className="mr-2 inline"/>Print</button></div></> : null}
    </DialogContent></Dialog>
  </section>;
}
