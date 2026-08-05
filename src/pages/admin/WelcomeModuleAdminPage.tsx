import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, RefreshCw, Save, Sparkles } from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { apiFetch } from "@/lib/queryClient";
import {
  WELCOME_AUDIENCES,
  WELCOME_LANGUAGES,
  WELCOME_MOMENT_TYPES,
  WELCOME_PERIODS,
  WELCOME_PROFILE_ACTIONS,
  WELCOME_PROFILE_ACTION_BY_ID,
  type WelcomeAudience,
  type WelcomeCopy,
  type WelcomeLanguage,
  type WelcomeMomentType,
  type WelcomePeriod,
  type WelcomeProfileActionId,
  type WelcomeTemplateDefinition,
} from "../../../shared/welcomeModule";

type AdminRequestError = Error & { status?: number };

type WelcomeTemplateAdmin = WelcomeTemplateDefinition & {
  source?: "built_in" | "managed";
};

const fieldClass = "w-full rounded-xl border border-[#eadfd5] bg-white px-3 py-2 text-sm font-semibold text-[#342a36] shadow-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100";
const labelClass = "mb-1 block text-sm font-bold text-[#4d4351]";

function cleanLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function emptyCopy(): WelcomeCopy {
  return { headline: "", subtitle: "", ctaLabel: "" };
}

function selectedCopy(template: WelcomeTemplateAdmin, language: WelcomeLanguage) {
  return template.copy[language] ?? template.copy.en ?? template.copy.es ?? emptyCopy();
}

function templatePayload(template: WelcomeTemplateAdmin) {
  return {
    templateId: template.id,
    audience: template.audience,
    momentType: template.momentType,
    profileAction: template.profileAction ?? null,
    priority: Number(template.priority),
    cooldownHours: Number(template.cooldownHours),
    periods: template.periods ?? [],
    copy: template.copy,
    actionRoute: template.actionRoute ?? null,
    isEnabled: template.isEnabled ?? true,
    adminNotes: template.adminNotes ?? "",
  };
}

export default function WelcomeModuleAdminPage() {
  const [templates, setTemplates] = useState<WelcomeTemplateAdmin[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [draft, setDraft] = useState<WelcomeTemplateAdmin | null>(null);
  const [language, setLanguage] = useState<WelcomeLanguage>("en");
  const [message, setMessage] = useState("");
  const [setupMissing, setSetupMissing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function api(path: string, options: RequestInit = {}) {
    const res = await apiFetch(`/api/admin/welcome-module${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.error ?? "Admin request failed") as AdminRequestError;
      error.status = res.status;
      throw error;
    }
    return data;
  }

  async function refresh() {
    setMessage("");
    setSetupMissing(false);
    try {
      const data = await api("/templates");
      const nextTemplates = (data.templates ?? []) as WelcomeTemplateAdmin[];
      setTemplates(nextTemplates);
      const nextSelected = selectedId && nextTemplates.some((template) => template.id === selectedId)
        ? selectedId
        : nextTemplates[0]?.id ?? "";
      setSelectedId(nextSelected);
      setDraft(nextTemplates.find((template) => template.id === nextSelected) ?? null);
    } catch (err) {
      const error = err as AdminRequestError;
      if (error.status === 503) {
        setSetupMissing(true);
        setTemplates([]);
        setDraft(null);
        return;
      }
      throw err;
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const selected = templates.find((template) => template.id === selectedId) ?? null;
    setDraft(selected ? { ...selected, copy: { ...selected.copy } } : null);
  }, [selectedId, templates]);

  const groupedTemplates = useMemo(() => ({
    first: templates.filter((template) => template.momentType === "first_login_welcome"),
    nudges: templates.filter((template) => template.momentType === "daily_profile_nudge"),
  }), [templates]);

  const previewCopy = draft ? selectedCopy(draft, language) : emptyCopy();

  function patchDraft(patch: Partial<WelcomeTemplateAdmin>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
  }

  function patchCopy(patch: Partial<WelcomeCopy>) {
    setDraft((current) => {
      if (!current) return current;
      const currentCopy = selectedCopy(current, language);
      return {
        ...current,
        copy: {
          ...current.copy,
          [language]: { ...currentCopy, ...patch },
        },
      };
    });
  }

  function setProfileAction(action: string) {
    const profileAction = action === "none" ? undefined : action as WelcomeProfileActionId;
    patchDraft({
      profileAction,
      actionRoute: profileAction ? WELCOME_PROFILE_ACTION_BY_ID[profileAction].route : undefined,
    });
  }

  function togglePeriod(period: WelcomePeriod) {
    setDraft((current) => {
      if (!current) return current;
      const periods = new Set(current.periods ?? []);
      if (periods.has(period)) periods.delete(period);
      else periods.add(period);
      return { ...current, periods: Array.from(periods) };
    });
  }

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    setMessage("");
    try {
      const data = await api("/templates", {
        method: "POST",
        body: JSON.stringify(templatePayload(draft)),
      });
      setMessage(`${data.template.id} saved.`);
      await refresh();
      setSelectedId(data.template.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save Welcome template.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f4ef] px-4 py-6 text-[#2f2532] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <AdminPageHeader
          eyebrow="Messaging"
          title="Welcome module"
          description="First-session home hero welcomes and one daily profile-benefit nudge."
        />
        <AdminMenu />

        {setupMissing ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900">
            Welcome module tables are not migrated yet. Run <span className="font-black">migrations/0079_welcome_module.sql</span>.
          </div>
        ) : null}

        <div className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.08em] text-purple-700">Templates</p>
                <h2 className="mt-1 text-xl font-black">Structured queue</h2>
              </div>
              <button
                type="button"
                onClick={() => void refresh()}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#eadfd5] text-purple-700 hover:bg-purple-50"
                aria-label="Refresh templates"
              >
                <RefreshCw size={18} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm font-black">
              <div className="rounded-xl bg-purple-50 px-3 py-2 text-purple-800">{groupedTemplates.first.length} welcomes</div>
              <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-800">{groupedTemplates.nudges.length} nudges</div>
            </div>

            <div className="mt-4 max-h-[720px] space-y-2 overflow-y-auto pr-1">
              {templates.map((template) => {
                const active = template.id === selectedId;
                const action = template.profileAction ? WELCOME_PROFILE_ACTION_BY_ID[template.profileAction] : null;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedId(template.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-purple-300 bg-purple-50 shadow-sm"
                        : "border-[#efe4d9] bg-white hover:border-purple-200 hover:bg-[#fbf8f5]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#2f2532]">{template.id}</p>
                        <p className="mt-1 text-xs font-semibold text-[#7d6b65]">
                          {cleanLabel(template.audience)} - {cleanLabel(template.momentType)}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${
                        template.source === "managed" ? "bg-emerald-50 text-emerald-700" : "bg-purple-50 text-purple-700"
                      }`}>
                        {template.source === "managed" ? "Managed" : "Built-in"}
                      </span>
                    </div>
                    {action ? <p className="mt-2 text-xs font-bold text-purple-700">{action.label}</p> : null}
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="rounded-2xl border border-[#eadfd5] bg-white p-5 shadow-sm">
            {draft ? (
              <>
                <div className="flex flex-col gap-4 border-b border-[#efe4d9] pb-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-purple-700">
                      <Sparkles size={14} /> Welcome template
                    </p>
                    <h2 className="mt-3 text-3xl font-black">{draft.id}</h2>
                    <p className="mt-1 text-sm font-semibold text-[#7d6b65]">
                      {draft.momentType === "first_login_welcome"
                        ? "Shown once on first login session."
                        : "Shown once per day when this profile area is incomplete."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveDraft()}
                    disabled={saving}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-purple-800 disabled:opacity-60"
                  >
                    {saving ? <RefreshCw size={17} className="animate-spin" /> : <Save size={17} />}
                    Save template
                  </button>
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_380px]">
                  <section className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label>
                        <span className={labelClass}>Audience</span>
                        <select className={fieldClass} value={draft.audience} onChange={(event) => patchDraft({ audience: event.target.value as WelcomeAudience })}>
                          {WELCOME_AUDIENCES.map((audience) => <option key={audience} value={audience}>{cleanLabel(audience)}</option>)}
                        </select>
                      </label>
                      <label>
                        <span className={labelClass}>Moment type</span>
                        <select className={fieldClass} value={draft.momentType} onChange={(event) => patchDraft({ momentType: event.target.value as WelcomeMomentType })}>
                          {WELCOME_MOMENT_TYPES.map((momentType) => <option key={momentType} value={momentType}>{cleanLabel(momentType)}</option>)}
                        </select>
                      </label>
                      <label>
                        <span className={labelClass}>Profile action</span>
                        <select className={fieldClass} value={draft.profileAction ?? "none"} onChange={(event) => setProfileAction(event.target.value)}>
                          <option value="none">No profile action</option>
                          {WELCOME_PROFILE_ACTIONS.map((action) => <option key={action.id} value={action.id}>{action.label}</option>)}
                        </select>
                      </label>
                      <label>
                        <span className={labelClass}>Action route</span>
                        <input className={fieldClass} value={draft.actionRoute ?? ""} onChange={(event) => patchDraft({ actionRoute: event.target.value })} placeholder="/onboarding/profile/emergency" />
                      </label>
                      <label>
                        <span className={labelClass}>Priority</span>
                        <input className={fieldClass} type="number" value={draft.priority} min={0} max={999} onChange={(event) => patchDraft({ priority: Number(event.target.value) })} />
                      </label>
                      <label>
                        <span className={labelClass}>Cooldown hours</span>
                        <input className={fieldClass} type="number" value={draft.cooldownHours} min={0} max={8760} onChange={(event) => patchDraft({ cooldownHours: Number(event.target.value) })} />
                      </label>
                    </div>

                    <div>
                      <span className={labelClass}>Time periods</span>
                      <div className="flex flex-wrap gap-2">
                        {WELCOME_PERIODS.map((period) => {
                          const active = draft.periods?.includes(period);
                          return (
                            <button
                              key={period}
                              type="button"
                              onClick={() => togglePeriod(period)}
                              className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-black ${
                                active
                                  ? "border-purple-700 bg-purple-700 text-white"
                                  : "border-[#eadfd5] bg-white text-purple-700"
                              }`}
                            >
                              {active ? <CheckCircle2 size={15} /> : null}
                              {cleanLabel(period)}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-xs font-semibold text-[#8b7a73]">Leave empty for all day. First welcomes usually target one period.</p>
                    </div>

                    <div className="rounded-2xl border border-[#efe4d9] bg-[#fbf8f5] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-black">Language copy</p>
                          <p className="text-xs font-semibold text-[#7d6b65]">Big hero copy and smaller supporting line.</p>
                        </div>
                        <select className={`${fieldClass} md:w-36`} value={language} onChange={(event) => setLanguage(event.target.value as WelcomeLanguage)}>
                          {WELCOME_LANGUAGES.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
                        </select>
                      </div>
                      <div className="mt-4 grid gap-4">
                        <label>
                          <span className={labelClass}>Big copy</span>
                          <input className={fieldClass} value={previewCopy.headline} onChange={(event) => patchCopy({ headline: event.target.value })} placeholder="Bonsoir, {name}" />
                        </label>
                        <label>
                          <span className={labelClass}>Small copy</span>
                          <input className={fieldClass} value={previewCopy.subtitle} onChange={(event) => patchCopy({ subtitle: event.target.value })} placeholder="Comment vous sentez-vous ?" />
                        </label>
                        <label>
                          <span className={labelClass}>CTA label</span>
                          <input className={fieldClass} value={previewCopy.ctaLabel ?? ""} onChange={(event) => patchCopy({ ctaLabel: event.target.value })} placeholder="Add contact" />
                        </label>
                      </div>
                    </div>

                    <label className="flex items-center gap-3 rounded-2xl border border-[#efe4d9] bg-white p-4">
                      <input
                        type="checkbox"
                        checked={draft.isEnabled ?? true}
                        onChange={(event) => patchDraft({ isEnabled: event.target.checked })}
                        className="h-5 w-5 rounded border-[#d8c8bc] text-purple-700"
                      />
                      <span>
                        <span className="block text-sm font-black">Enabled</span>
                        <span className="block text-xs font-semibold text-[#7d6b65]">Disabled templates stay in admin but are skipped by Home.</span>
                      </span>
                    </label>

                    <label>
                      <span className={labelClass}>Admin notes</span>
                      <textarea className={`${fieldClass} min-h-24`} value={draft.adminNotes ?? ""} onChange={(event) => patchDraft({ adminNotes: event.target.value })} />
                    </label>
                  </section>

                  <aside className="space-y-4">
                    <div className="rounded-2xl border border-[#eadfd5] bg-[#2B1748] p-5 text-white shadow-sm">
                      <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-white/70">
                        <Eye size={14} /> Home hero preview
                      </p>
                      <div className="mt-8 text-center">
                        <p className="text-[42px] font-black leading-tight">{previewCopy.headline || "Bonsoir, Karim"}</p>
                        <p className="mt-4 text-lg font-bold text-white/82">{previewCopy.subtitle || "Comment vous sentez-vous ?"}</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#eadfd5] bg-white p-4 text-sm font-semibold text-[#5f535d]">
                      <p className="font-black text-[#2f2532]">Selection rules</p>
                      <p className="mt-2">First welcomes show once for the first login session. Daily nudges show once per day only when their profile action is incomplete.</p>
                    </div>
                    {message ? (
                      <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4 text-sm font-black text-purple-800">
                        {message}
                      </div>
                    ) : null}
                  </aside>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#d9c9bc] p-10 text-center">
                <p className="text-lg font-black">No Welcome templates loaded.</p>
                <button type="button" onClick={() => void refresh()} className="mt-4 rounded-xl bg-purple-700 px-4 py-2 text-sm font-black text-white">Retry</button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
