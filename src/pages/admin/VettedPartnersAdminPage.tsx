import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Check, Loader2, Plus, RefreshCw, Upload, X } from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { apiFetch } from "@/lib/queryClient";
import { HOME_SERVICE_TYPES } from "../../../shared/serviceIntake";
import { VETTED_PROVIDER_CSV_COLUMNS } from "../../../shared/vettedPartners";

type Organisation = { id: string; name: string; deploymentKeys: string[]; website: string | null; isActive: boolean };
type Provider = {
  id: string; organisationId: string; name: string; trades: string[]; phone: string | null; email: string | null; website: string | null;
  address: string | null; languages: string[]; coverageCountry: string; coverageRegion: string | null;
  coverageLat: number | null; coverageLng: number | null; coverageRadiusKm: number | null; isActive: boolean; reviewedAt: string | null; reviewedBy: string | null;
};

const API = "/api/admin/concierge/vetted-partners";
const input = "min-h-11 rounded-[12px] border border-[#eadfd5] bg-white px-3 text-sm font-semibold text-[#2f2135] outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-purple-700 px-5 text-sm font-bold text-white hover:bg-purple-800 disabled:opacity-50";
const secondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-[#eadfd5] bg-white px-4 text-sm font-bold text-[#2f2135] hover:bg-[#faf5ef] disabled:opacity-50";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1"><span className="text-sm font-black text-[#4f4352]">{label}</span>{children}</label>;
}

const list = (value: string) => value.split(/[,|]/).map(v => v.trim()).filter(Boolean);
const optionalNumber = (value: string) => value.trim() === "" ? undefined : Number(value.replace(",", "."));

async function send(path: string, method: string, body: unknown) {
  const res = await apiFetch(`${API}${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Request was not accepted. Check the fields.");
  return data;
}

function coverageLabel(p: Provider) {
  if (p.coverageRadiusKm != null) return `${p.coverageRadiusKm} km around ${p.coverageLat?.toFixed(3)}, ${p.coverageLng?.toFixed(3)} (${p.coverageCountry})`;
  return p.coverageRegion ? `${p.coverageRegion}, ${p.coverageCountry}` : `All of ${p.coverageCountry}`;
}

export default function VettedPartnersAdminPage() {
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [orgForm, setOrgForm] = useState({ name: "", deploymentKeys: "", website: "" });
  const [providerForm, setProviderForm] = useState({ name: "", trades: [] as string[], phone: "", email: "", website: "", address: "", languages: "", country: "", region: "", lat: "", lng: "", radius: "", notes: "" });
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<{ valid: number; errors: Array<{ row: number; errors: string[] }> } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(API);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load the partner directory");
      setOrganisations(data.organisations);
      setProviders(data.providers);
      setSelectedOrg(current => current || data.organisations[0]?.id || "");
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load the partner directory");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const orgProviders = useMemo(() => providers.filter(p => p.organisationId === selectedOrg), [providers, selectedOrg]);
  const pending = orgProviders.filter(p => !p.isActive && !p.reviewedAt).length;

  async function run(action: () => Promise<unknown>, done: string) {
    try { await action(); setMessage(done); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed"); }
  }

  function addOrganisation(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const data = await send("/organisations", "POST", { name: orgForm.name, deploymentKeys: list(orgForm.deploymentKeys), website: orgForm.website, isActive: true });
      setSelectedOrg(data.organisation.id);
      setOrgForm({ name: "", deploymentKeys: "", website: "" });
    }, "Organisation added.");
  }

  function addProvider(event: FormEvent) {
    event.preventDefault();
    const f = providerForm;
    void run(async () => {
      await send(`/organisations/${selectedOrg}/providers`, "POST", {
        name: f.name, trades: f.trades, phone: f.phone, email: f.email, website: f.website, address: f.address,
        languages: list(f.languages).map(l => l.toLowerCase()), notes: f.notes, coverageCountry: f.country, coverageRegion: f.region,
        coverageLat: optionalNumber(f.lat), coverageLng: optionalNumber(f.lng), coverageRadiusKm: optionalNumber(f.radius),
      });
      setProviderForm({ name: "", trades: [], phone: "", email: "", website: "", address: "", languages: "", country: f.country, region: "", lat: "", lng: "", radius: "", notes: "" });
    }, "Provider added. It stays hidden until approved.");
  }

  async function previewCsv() {
    try { setPreview(await send(`/organisations/${selectedOrg}/providers/import`, "POST", { csv, dryRun: true })); setMessage(null); } catch (error) { setMessage(error instanceof Error ? error.message : "Preview failed"); }
  }

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader title="Partner providers" subtitle="Local providers vetted by partner organisations, in any country. Members see them first inside each provider's coverage area. Nothing is shown to members until approved here.">
          <button type="button" className={primary} onClick={() => void refresh()}>
            {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}Refresh
          </button>
          {message && <span className="rounded-2xl bg-purple-50 px-4 py-3 text-sm font-bold text-purple-900" role="status">{message}</span>}
        </AdminPageHeader>
        <AdminMenu />

        <section className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
          <div className="rounded-[24px] border border-[#eadfd5] bg-white p-5 shadow-sm">
            <h2 className="font-serif text-2xl">Organisations</h2>
            <ul className="mt-3 grid gap-2">
              {organisations.map(org => (
                <li key={org.id}>
                  <button type="button" onClick={() => { setSelectedOrg(org.id); setPreview(null); }} className={`w-full rounded-[14px] border px-3 py-2 text-left text-sm font-bold ${org.id === selectedOrg ? "border-purple-500 bg-purple-50" : "border-[#eadfd5]"}`}>
                    {org.name}
                    <span className="block text-xs font-semibold text-[#6f6170]">{org.deploymentKeys.length ? `Members of: ${org.deploymentKeys.join(", ")}` : "All members in coverage"}{org.isActive ? "" : " · paused"}</span>
                  </button>
                </li>
              ))}
            </ul>
            <form className="mt-5 grid gap-3" onSubmit={addOrganisation} data-testid="form-vetted-organisation">
              <Field label="Name"><input className={input} value={orgForm.name} onChange={e => setOrgForm({ ...orgForm, name: e.target.value })} required /></Field>
              <Field label="Only for deployments (optional, comma separated)"><input className={input} value={orgForm.deploymentKeys} onChange={e => setOrgForm({ ...orgForm, deploymentKeys: e.target.value })} placeholder="e.g. drk" /></Field>
              <Field label="Website (optional)"><input className={input} value={orgForm.website} onChange={e => setOrgForm({ ...orgForm, website: e.target.value })} /></Field>
              <button type="submit" className={primary}><Plus size={16} aria-hidden="true" />Add organisation</button>
            </form>
          </div>

          {selectedOrg ? (
            <div className="grid gap-5">
              <section className="rounded-[24px] border border-[#eadfd5] bg-white p-5 shadow-sm">
                <h2 className="font-serif text-2xl">Providers</h2>
                <p className="mt-1 text-sm text-[#6f6170]">{orgProviders.length} listed · {pending} waiting for approval. Edits send a provider back for approval.</p>
                <ul className="mt-4 grid gap-2" data-testid="list-vetted-providers">
                  {orgProviders.map(p => (
                    <li key={p.id} className="flex flex-col gap-2 rounded-[14px] border border-[#eadfd5] p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-bold">{p.name} <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${p.isActive ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{p.isActive ? "Live" : p.reviewedAt ? "Paused" : "Waiting for approval"}</span></p>
                        <p className="text-sm text-[#6f6170]">{p.trades.join(", ")} · {coverageLabel(p)} · {[p.phone, p.email, p.website].filter(Boolean).join(" · ")}</p>
                      </div>
                      {p.isActive
                        ? <button type="button" className={secondary} onClick={() => void run(() => send(`/providers/${p.id}/review`, "POST", { active: false }), "Provider paused.")}><X size={14} aria-hidden="true" />Pause</button>
                        : <button type="button" className={secondary} data-testid={`button-approve-${p.id}`} onClick={() => void run(() => send(`/providers/${p.id}/review`, "POST", { active: true }), "Provider approved and live.")}><Check size={14} aria-hidden="true" />Approve</button>}
                    </li>
                  ))}
                </ul>
              </section>

              <form className="grid gap-3 rounded-[24px] border border-[#eadfd5] bg-white p-5 shadow-sm sm:grid-cols-2" onSubmit={addProvider} data-testid="form-vetted-provider">
                <h2 className="font-serif text-2xl sm:col-span-2">Add a provider</h2>
                <Field label="Name"><input className={input} value={providerForm.name} onChange={e => setProviderForm({ ...providerForm, name: e.target.value })} required /></Field>
                <fieldset className="grid gap-1"><legend className="text-sm font-black text-[#4f4352]">Trades</legend>
                  <div className="flex flex-wrap gap-2">{HOME_SERVICE_TYPES.map(t => (
                    <label key={t.key} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={providerForm.trades.includes(t.key)} onChange={e => setProviderForm({ ...providerForm, trades: e.target.checked ? [...providerForm.trades, t.key] : providerForm.trades.filter(k => k !== t.key) })} />{t.en}</label>
                  ))}</div>
                </fieldset>
                <Field label="Phone"><input className={input} value={providerForm.phone} onChange={e => setProviderForm({ ...providerForm, phone: e.target.value })} /></Field>
                <Field label="Email"><input className={input} value={providerForm.email} onChange={e => setProviderForm({ ...providerForm, email: e.target.value })} /></Field>
                <Field label="Website"><input className={input} value={providerForm.website} onChange={e => setProviderForm({ ...providerForm, website: e.target.value })} placeholder="https://" /></Field>
                <Field label="Address"><input className={input} value={providerForm.address} onChange={e => setProviderForm({ ...providerForm, address: e.target.value })} /></Field>
                <Field label="Languages spoken (ISO codes, comma separated)"><input className={input} value={providerForm.languages} onChange={e => setProviderForm({ ...providerForm, languages: e.target.value })} placeholder="es, en, de" /></Field>
                <Field label="Country (ISO code)"><input className={input} value={providerForm.country} onChange={e => setProviderForm({ ...providerForm, country: e.target.value })} placeholder="ES" required /></Field>
                <Field label="Region in member addresses (optional)"><input className={input} value={providerForm.region} onChange={e => setProviderForm({ ...providerForm, region: e.target.value })} placeholder="Zamora" /></Field>
                <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                  <Field label="Latitude"><input className={input} value={providerForm.lat} onChange={e => setProviderForm({ ...providerForm, lat: e.target.value })} /></Field>
                  <Field label="Longitude"><input className={input} value={providerForm.lng} onChange={e => setProviderForm({ ...providerForm, lng: e.target.value })} /></Field>
                  <Field label="Radius km"><input className={input} value={providerForm.radius} onChange={e => setProviderForm({ ...providerForm, radius: e.target.value })} /></Field>
                </div>
                <Field label="Notes (optional)"><input className={input} value={providerForm.notes} onChange={e => setProviderForm({ ...providerForm, notes: e.target.value })} /></Field>
                <div className="sm:col-span-2"><button type="submit" className={primary} disabled={providerForm.trades.length === 0}><Plus size={16} aria-hidden="true" />Add for approval</button></div>
              </form>

              <section className="grid gap-3 rounded-[24px] border border-[#eadfd5] bg-white p-5 shadow-sm">
                <h2 className="font-serif text-2xl">Import a spreadsheet</h2>
                <p className="text-sm text-[#6f6170]">Paste CSV with a header row: <code>{VETTED_PROVIDER_CSV_COLUMNS.join(", ")}</code>. Separate several trades or languages with <code>|</code>. Imported providers wait for approval.</p>
                <textarea className={`${input} min-h-40 py-2 font-mono text-xs`} value={csv} onChange={e => { setCsv(e.target.value); setPreview(null); }} aria-label="CSV to import" />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={secondary} disabled={!csv.trim()} onClick={() => void previewCsv()}>Check rows</button>
                  <button type="button" className={primary} disabled={!preview || preview.valid === 0} onClick={() => void run(async () => { await send(`/organisations/${selectedOrg}/providers/import`, "POST", { csv }); setCsv(""); setPreview(null); }, "Rows imported. They wait for approval.")}><Upload size={16} aria-hidden="true" />Import {preview?.valid ?? 0} rows</button>
                </div>
                {preview && <div className="text-sm" data-testid="csv-preview">
                  <p className="font-bold">{preview.valid} rows ready{preview.errors.length ? `, ${preview.errors.length} with problems (skipped)` : ""}.</p>
                  <ul className="mt-1 list-disc pl-5 text-red-700">{preview.errors.slice(0, 20).map(e => <li key={e.row}>Row {e.row}: {e.errors.join("; ")}</li>)}</ul>
                </div>}
              </section>
            </div>
          ) : (
            <p className="rounded-[24px] border border-[#eadfd5] bg-white p-5 text-sm">Add an organisation to start listing its vetted providers.</p>
          )}
        </section>
      </section>
    </main>
  );
}
