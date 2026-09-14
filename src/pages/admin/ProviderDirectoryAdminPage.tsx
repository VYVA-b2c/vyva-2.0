import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Save, Search, TriangleAlert } from "lucide-react";
import { apiFetch } from "@/lib/queryClient";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import type {
  AdminProviderDirectoryItem,
  AdminProviderDirectoryResponse,
  AdminProviderDirectoryUpdateInput,
} from "../../../shared/adminProviderDirectory";

const CATEGORIES = [
  { value: "doctor_clinic", label: "Doctor or clinic" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "transport", label: "Transport" },
  { value: "home_service", label: "Home service" },
  { value: "personal_care", label: "Personal care" },
  { value: "food", label: "Food" },
  { value: "other", label: "Other" },
];

type ProviderDraft = AdminProviderDirectoryUpdateInput & {
  name: string;
  category: string;
  phone: string;
  email: string;
  whatsapp: string;
  website: string;
  notes: string;
  trusted: boolean;
  defaultForCategory: boolean;
  canContactAfterConfirmation: boolean;
};

function draftFromProvider(provider: AdminProviderDirectoryItem): ProviderDraft {
  return {
    name: provider.name,
    category: provider.category,
    phone: provider.phone,
    email: provider.email,
    whatsapp: provider.whatsapp,
    website: provider.website,
    notes: provider.notes,
    trusted: provider.trusted,
    defaultForCategory: provider.defaultForCategory,
    canContactAfterConfirmation: provider.canContactAfterConfirmation,
  };
}

function categoryLabel(value: string): string {
  return CATEGORIES.find((category) => category.value === value)?.label ?? "Other";
}

function channelSummary(provider: AdminProviderDirectoryItem): string {
  if (provider.channels.length === 0) return "No contact added";
  return provider.channels.map((channel) => ({
    phone: "Phone",
    email: "Email",
    whatsapp: "WhatsApp",
    booking_url: "Booking link",
    website: "Website",
  }[channel])).join(", ");
}

function ProviderStatus({ provider }: { provider: AdminProviderDirectoryItem }) {
  if (provider.readyForConcierge) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
        <CheckCircle2 size={14} aria-hidden="true" /> Ready
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
      <TriangleAlert size={14} aria-hidden="true" /> Needs attention
    </span>
  );
}

export default function ProviderDirectoryAdminPage() {
  const [providers, setProviders] = useState<AdminProviderDirectoryItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ProviderDraft>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    setLoading(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/admin/providers");
      const data = await response.json().catch(() => ({})) as Partial<AdminProviderDirectoryResponse> & { error?: string };
      if (!response.ok) throw new Error(data.error || "Providers could not be loaded.");
      const nextProviders = data.providers ?? [];
      setProviders(nextProviders);
      setDrafts(Object.fromEntries(nextProviders.map((provider) => [provider.id, draftFromProvider(provider)])));
    } catch (error) {
      setProviders([]);
      setMessage(error instanceof Error ? error.message : "Providers could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const visibleProviders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return providers;
    return providers.filter((provider) => [
      provider.name,
      provider.userLabel,
      provider.userEmail,
      categoryLabel(provider.category),
      provider.readinessLabel,
      channelSummary(provider),
    ].join(" ").toLowerCase().includes(query));
  }, [providers, search]);

  const readyCount = providers.filter((provider) => provider.readyForConcierge).length;
  const needsAttention = providers.length - readyCount;

  function updateDraft(id: string, patch: Partial<ProviderDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  async function saveProvider(provider: AdminProviderDirectoryItem) {
    const draft = drafts[provider.id];
    if (!draft) return;

    setSavingId(provider.id);
    setMessage("");
    try {
      const response = await apiFetch(`/api/admin/providers/${provider.profileId}/providers/${provider.providerIndex}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      const data = await response.json().catch(() => ({})) as { provider?: AdminProviderDirectoryItem; error?: string };
      if (!response.ok || !data.provider) throw new Error(data.error || "Provider could not be saved.");
      setProviders((current) => current.map((item) => item.id === data.provider?.id ? data.provider : item));
      setDrafts((current) => ({ ...current, [data.provider!.id]: draftFromProvider(data.provider!) }));
      setMessage(`${data.provider.name} saved.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Provider could not be saved.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-4 py-6 text-[#2f2135] sm:px-6 sm:py-8">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Providers"
          subtitle="Review trusted contacts that Concierge can use after the user confirms."
        >
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-purple-700 px-4 text-sm font-black text-white disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" />
            Refresh
          </button>
        </AdminPageHeader>
        <AdminMenu />

        <section className="mt-5 rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <label className="max-w-xl flex-1">
              <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">Find provider</span>
              <span className="relative block">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b7a73]" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, user, service, or contact"
                  className="h-11 w-full rounded-[10px] border border-[#dfd3ca] bg-[#fffdfb] pl-10 pr-3 text-sm font-semibold outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
                />
              </span>
            </label>
            <div className="flex flex-wrap gap-2 text-xs font-black">
              <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">{readyCount} ready</span>
              <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-700">{needsAttention} need attention</span>
              <span className="rounded-full bg-[#f5efe8] px-3 py-2 text-[#6f625e]">{providers.length} total</span>
            </div>
          </div>
          {message ? <p className="mt-3 rounded-[10px] bg-purple-50 px-3 py-2 text-sm font-bold text-purple-800" role="status">{message}</p> : null}
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-2">
          {loading ? (
            <p className="rounded-[14px] border border-[#eadfd5] bg-white p-8 text-center font-bold text-[#7d6b65] xl:col-span-2">
              Loading providers...
            </p>
          ) : null}
          {!loading && visibleProviders.length === 0 ? (
            <p className="rounded-[14px] border border-[#eadfd5] bg-white p-8 text-center font-bold text-[#7d6b65] xl:col-span-2">
              No providers match this search.
            </p>
          ) : null}
          {visibleProviders.map((provider) => {
            const draft = drafts[provider.id] ?? draftFromProvider(provider);
            const saving = savingId === provider.id;

            return (
              <article key={provider.id} className="rounded-[14px] border border-[#eadfd5] bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eee5dd] pb-4">
                  <div>
                    <p className="text-lg font-black">{provider.name}</p>
                    <p className="mt-1 text-sm font-semibold text-[#7d6b65]">
                      {provider.userLabel} - {categoryLabel(provider.category)}
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#5b4a46]">{channelSummary(provider)}</p>
                  </div>
                  <ProviderStatus provider={provider} />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="mb-1 block text-xs font-black text-[#6f625e]">Name</span>
                    <input value={draft.name} onChange={(event) => updateDraft(provider.id, { name: event.target.value })} className="h-11 w-full rounded-[9px] border border-[#dfd3ca] bg-white px-3 text-sm font-semibold outline-none focus:border-purple-400" />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-black text-[#6f625e]">Service type</span>
                    <select value={draft.category} onChange={(event) => updateDraft(provider.id, { category: event.target.value })} className="h-11 w-full rounded-[9px] border border-[#dfd3ca] bg-white px-3 text-sm font-semibold outline-none focus:border-purple-400">
                      {CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-black text-[#6f625e]">Phone</span>
                    <input value={draft.phone} onChange={(event) => updateDraft(provider.id, { phone: event.target.value })} className="h-11 w-full rounded-[9px] border border-[#dfd3ca] bg-white px-3 text-sm font-semibold outline-none focus:border-purple-400" />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-black text-[#6f625e]">Email</span>
                    <input value={draft.email} onChange={(event) => updateDraft(provider.id, { email: event.target.value })} className="h-11 w-full rounded-[9px] border border-[#dfd3ca] bg-white px-3 text-sm font-semibold outline-none focus:border-purple-400" />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-black text-[#6f625e]">WhatsApp</span>
                    <input value={draft.whatsapp} onChange={(event) => updateDraft(provider.id, { whatsapp: event.target.value })} className="h-11 w-full rounded-[9px] border border-[#dfd3ca] bg-white px-3 text-sm font-semibold outline-none focus:border-purple-400" />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-black text-[#6f625e]">Website</span>
                    <input value={draft.website} onChange={(event) => updateDraft(provider.id, { website: event.target.value })} className="h-11 w-full rounded-[9px] border border-[#dfd3ca] bg-white px-3 text-sm font-semibold outline-none focus:border-purple-400" />
                  </label>
                </div>

                <label className="mt-3 block">
                  <span className="mb-1 block text-xs font-black text-[#6f625e]">Notes</span>
                  <textarea value={draft.notes} onChange={(event) => updateDraft(provider.id, { notes: event.target.value })} className="min-h-20 w-full rounded-[9px] border border-[#dfd3ca] bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-purple-400" />
                </label>

                <div className="mt-4 flex flex-wrap gap-2">
                  <label className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-[#eadfd5] bg-[#fffaf4] px-3 text-sm font-black">
                    <input type="checkbox" checked={draft.trusted} onChange={(event) => updateDraft(provider.id, { trusted: event.target.checked })} />
                    Trusted
                  </label>
                  <label className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-[#eadfd5] bg-[#fffaf4] px-3 text-sm font-black">
                    <input type="checkbox" checked={draft.defaultForCategory} onChange={(event) => updateDraft(provider.id, { defaultForCategory: event.target.checked })} />
                    Default
                  </label>
                  <label className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-[#eadfd5] bg-[#fffaf4] px-3 text-sm font-black">
                    <input type="checkbox" checked={draft.canContactAfterConfirmation} onChange={(event) => updateDraft(provider.id, { canContactAfterConfirmation: event.target.checked })} />
                    Can contact
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => void saveProvider(provider)}
                  disabled={saving}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-purple-700 px-4 text-sm font-black text-white disabled:opacity-60"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
                  Save provider
                </button>
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
}
