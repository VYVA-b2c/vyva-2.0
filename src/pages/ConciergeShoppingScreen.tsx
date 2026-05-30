import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Heart,
  Loader2,
  PackageCheck,
  Search,
  ShoppingBasket,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/queryClient";
import {
  SHOPPING_CATEGORY_LABELS,
  type ShoppingCategory,
  type ShoppingPriority,
  type ShoppingRecommendation,
  type ShoppingRecommendationResponse,
} from "../../shared/shopping";

type Copy = {
  title: string;
  subtitle: string;
  shortlist: string;
  needLabel: string;
  needPlaceholder: string;
  categoryTitle: string;
  prioritiesTitle: string;
  constraintsLabel: string;
  constraintsPlaceholder: string;
  find: string;
  loading: string;
  emptyTitle: string;
  emptyBody: string;
  resultsTitle: string;
  compareTitle: string;
  save: string;
  saved: string;
  shortlistTitle: string;
  noCheckout: string;
  caveat: string;
  error: string;
  back: string;
  tryIdeas: string;
};

type ShoppingRoutePrefill = {
  needText: string;
  category: ShoppingCategory;
  priorities: ShoppingPriority[];
};

type ShoppingLocationState = {
  shoppingPrefill?: ShoppingRoutePrefill;
} | null;

const COPY: Record<"en" | "es", Copy> = {
  en: {
    title: "Shopping helper",
    subtitle: "Compare a few simple choices. VYVA will not place an order or start checkout.",
    shortlist: "Shortlist",
    needLabel: "What do you need help choosing?",
    needPlaceholder: "Example: I need an easy breakfast with protein, low cost, and no heavy carrying.",
    categoryTitle: "Area",
    prioritiesTitle: "Most important",
    constraintsLabel: "Avoid",
    constraintsPlaceholder: "Example: no dairy, low salt, hard to bend",
    find: "Find best choices",
    loading: "Finding clear choices...",
    emptyTitle: "Start with one sentence",
    emptyBody: "VYVA keeps the list short and explains the reason for each choice.",
    resultsTitle: "Best choices",
    compareTitle: "Simple comparison",
    save: "Save choice",
    saved: "Saved",
    shortlistTitle: "Saved shortlist",
    noCheckout: "No checkout here.",
    caveat: "For pharmacy items, VYVA does not replace a pharmacist, doctor, or medication advice.",
    error: "VYVA could not compare choices right now. Please try again.",
    back: "Back",
    tryIdeas: "Try one",
  },
  es: {
    title: "Ayuda para comprar",
    subtitle: "Compare pocas opciones sencillas. VYVA no hara pedidos ni iniciara pagos.",
    shortlist: "Guardados",
    needLabel: "Que necesita elegir?",
    needPlaceholder: "Ejemplo: necesito un desayuno facil con proteina, economico y sin cargar peso.",
    categoryTitle: "Area",
    prioritiesTitle: "Mas importante",
    constraintsLabel: "Evitar",
    constraintsPlaceholder: "Ejemplo: sin lacteos, bajo en sal, cuesta agacharse",
    find: "Buscar mejores opciones",
    loading: "Buscando opciones claras...",
    emptyTitle: "Empiece con una frase",
    emptyBody: "VYVA muestra pocas opciones y explica por que encajan.",
    resultsTitle: "Mejores opciones",
    compareTitle: "Comparacion sencilla",
    save: "Guardar opcion",
    saved: "Guardado",
    shortlistTitle: "Opciones guardadas",
    noCheckout: "Sin compra aqui.",
    caveat: "Para articulos de farmacia, VYVA no sustituye a un farmaceutico, medico ni consejo sobre medicacion.",
    error: "VYVA no ha podido comparar opciones ahora. Intentelo otra vez.",
    back: "Volver",
    tryIdeas: "Probar",
  },
};

const CATEGORY_OPTIONS: Array<{ id: ShoppingCategory; icon: string }> = [
  { id: "groceries", icon: "G" },
  { id: "pharmacy_basics", icon: "P" },
  { id: "household", icon: "H" },
  { id: "mobility_aids", icon: "M" },
];

const PRIORITY_OPTIONS: Array<{ id: ShoppingPriority; en: string; es: string }> = [
  { id: "budget", en: "Low cost", es: "Precio bajo" },
  { id: "simplicity", en: "Easy to use", es: "Facil de usar" },
  { id: "accessibility", en: "Accessibility", es: "Accesibilidad" },
  { id: "safety", en: "Safety", es: "Seguridad" },
  { id: "delivery", en: "Easy to carry", es: "Facil de llevar" },
  { id: "diet", en: "Diet needs", es: "Dieta" },
];

const VALID_SHOPPING_CATEGORIES = new Set(CATEGORY_OPTIONS.map((option) => option.id));
const VALID_SHOPPING_PRIORITIES = new Set(PRIORITY_OPTIONS.map((option) => option.id));

const IDEA_CHIPS = [
  {
    en: "Easy low-salt meal",
    es: "Comida baja en sal",
    category: "groceries" as ShoppingCategory,
    priorities: ["simplicity", "diet"] as ShoppingPriority[],
  },
  {
    en: "Safer bathroom at night",
    es: "Bano mas seguro",
    category: "mobility_aids" as ShoppingCategory,
    priorities: ["safety", "accessibility"] as ShoppingPriority[],
  },
  {
    en: "Avoid mixing medicines",
    es: "No confundir medicinas",
    category: "pharmacy_basics" as ShoppingCategory,
    priorities: ["simplicity", "safety"] as ShoppingPriority[],
  },
];

function localeKey(language: string): "en" | "es" {
  return language.toLowerCase().startsWith("es") ? "es" : "en";
}

function categoryLabel(category: ShoppingCategory, locale: "en" | "es") {
  return SHOPPING_CATEGORY_LABELS[category][locale];
}

function rankLabel(label: ShoppingRecommendation["rankLabel"], locale: "en" | "es") {
  if (locale === "en") return label;
  if (label === "Best fit") return "Mejor opcion";
  if (label === "Lowest cost") return "Menor coste";
  return "Mas facil";
}

async function requestRecommendations(input: {
  needText: string;
  category: ShoppingCategory;
  priorities: ShoppingPriority[];
  constraints: string[];
  locale: string;
}): Promise<ShoppingRecommendationResponse> {
  const response = await apiFetch("/api/concierge/shopping/recommendations", {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return await response.json() as ShoppingRecommendationResponse;
}

const RecommendationCard = ({
  item,
  locale,
  saved,
  onToggleSave,
  copy,
}: {
  item: ShoppingRecommendation;
  locale: "en" | "es";
  saved: boolean;
  onToggleSave: () => void;
  copy: Copy;
}) => (
  <article className="rounded-[18px] border border-vyva-border bg-white p-4 shadow-[0_8px_20px_rgba(60,38,20,0.07)]">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[#ECFDF5] px-2.5 py-1 font-body text-[12px] font-black text-[#0A7C4E]">
            {rankLabel(item.rankLabel, locale)}
          </span>
          <span className="rounded-full bg-[#F8F4EF] px-2.5 py-1 font-body text-[12px] font-bold text-vyva-text-2">
            {item.product.priceLabel}
          </span>
        </div>
        <h2 className="mt-2 font-body text-[20px] font-extrabold leading-tight text-vyva-text-1">
          {item.product.name}
        </h2>
      </div>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] font-body text-[18px] font-black text-vyva-purple">
        {item.product.name.slice(0, 1)}
      </div>
    </div>

    <p className="mt-2 font-body text-[15px] leading-relaxed text-vyva-text-2">
      {item.product.description}
    </p>

    <div className="mt-3 grid gap-2">
      {item.reasons.slice(0, 2).map((reason) => (
        <p key={reason} className="flex gap-2 rounded-[12px] bg-[#F0FDFA] px-3 py-2 font-body text-[14px] font-bold leading-snug text-vyva-text-1">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#0F766E]" />
          <span>{reason}</span>
        </p>
      ))}
      {(item.tradeoffs[0] || item.cautionNotes[0]) && (
        <p className="flex gap-2 rounded-[12px] bg-[#FFFCF7] px-3 py-2 font-body text-[13px] leading-relaxed text-vyva-text-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#C9890A]" />
          <span>{item.tradeoffs[0] || item.cautionNotes[0]}</span>
        </p>
      )}
    </div>

    <button
      type="button"
      onClick={onToggleSave}
      className={`vyva-tap mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[16px] px-4 py-3 font-body text-[16px] font-extrabold ${
        saved ? "border border-[#BBF7D0] bg-[#ECFDF5] text-[#0A7C4E]" : "bg-vyva-purple text-white"
      }`}
      aria-pressed={saved}
    >
      <Heart size={18} fill={saved ? "currentColor" : "none"} />
      {saved ? copy.saved : copy.save}
    </button>
  </article>
);

const ConciergeShoppingScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();
  const locale = localeKey(i18n.language);
  const copy = COPY[locale];
  const [category, setCategory] = useState<ShoppingCategory>("groceries");
  const [needText, setNeedText] = useState("");
  const [constraintsText, setConstraintsText] = useState("");
  const [priorities, setPriorities] = useState<ShoppingPriority[]>(["simplicity"]);
  const [result, setResult] = useState<ShoppingRecommendationResponse | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const resultsRef = useRef<HTMLElement | null>(null);
  const lastRoutePrefillKeyRef = useRef<string | null>(null);

  const savedRecommendations = useMemo(
    () => result?.recommendations.filter((item) => savedIds.includes(item.product.id)) ?? [],
    [result, savedIds],
  );

  useEffect(() => {
    const prefill = (location.state as ShoppingLocationState)?.shoppingPrefill;
    if (!prefill) return;
    const prefillKey = `${prefill.category}:${prefill.needText}:${prefill.priorities.join(",")}`;
    if (lastRoutePrefillKeyRef.current === prefillKey) return;
    lastRoutePrefillKeyRef.current = prefillKey;

    if (prefill.needText.trim()) {
      setNeedText(prefill.needText.trim());
    }
    if (VALID_SHOPPING_CATEGORIES.has(prefill.category)) {
      setCategory(prefill.category);
    }
    const safePriorities = prefill.priorities.filter((priority) => VALID_SHOPPING_PRIORITIES.has(priority));
    if (safePriorities.length) {
      setPriorities(safePriorities);
      setPreferencesOpen(true);
    }
    setResult(null);
    setError(null);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);

  function togglePriority(priority: ShoppingPriority) {
    setPriorities((current) => (
      current.includes(priority)
        ? current.filter((item) => item !== priority)
        : [...current, priority]
    ));
  }

  function applyIdea(idea: (typeof IDEA_CHIPS)[number]) {
    setNeedText(locale === "es" ? idea.es : idea.en);
    setCategory(idea.category);
    setPriorities(idea.priorities);
    setResult(null);
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedNeed = needText.trim();
    if (!trimmedNeed) {
      setError(locale === "es" ? "Escriba una frase corta para empezar." : "Write a short sentence to start.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const constraints = constraintsText
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean);
      const next = await requestRecommendations({
        needText: trimmedNeed,
        category,
        priorities,
        constraints,
        locale: i18n.language,
      });
      setResult(next);
      setSavedIds((current) => current.filter((id) => next.recommendations.some((item) => item.product.id === id)));
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      }, 80);
    } catch {
      setError(copy.error);
    } finally {
      setLoading(false);
    }
  }

  function toggleSaved(id: string) {
    setSavedIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ));
  }

  return (
    <main className="vyva-page pb-[150px]" data-testid="concierge-shopping-screen">
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => navigate("/concierge")}
          className="vyva-tap inline-flex items-center gap-2 rounded-[16px] border border-vyva-border bg-white px-3 py-2 font-body text-[14px] font-extrabold text-vyva-text-1 shadow-sm"
        >
          <ArrowLeft size={18} />
          {copy.back}
        </button>
        <div className="inline-flex min-h-[48px] items-center gap-2 rounded-[16px] border border-vyva-border bg-white px-3 py-2 font-body text-[14px] font-extrabold text-vyva-purple shadow-sm" aria-live="polite">
          <ShoppingBasket size={18} />
          {copy.shortlist}: {savedIds.length}
        </div>
      </div>

      <header className="mt-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] text-vyva-purple">
            <PackageCheck size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-[29px] leading-[1.05] text-vyva-text-1">
              {copy.title}
            </h1>
            <p className="mt-1 font-body text-[15px] font-semibold leading-snug text-vyva-text-2">
              {copy.subtitle}
            </p>
          </div>
        </div>
        <p className="mt-2 inline-flex rounded-[12px] bg-[#F0FDFA] px-3 py-2 font-body text-[14px] font-black text-[#0F766E]">
          {copy.noCheckout}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mt-4 rounded-[18px] border border-vyva-border bg-white p-4 shadow-[0_10px_24px_rgba(60,38,20,0.08)]">
        <label htmlFor="shopping-need" className="font-body text-[17px] font-extrabold text-vyva-text-1">
          {copy.needLabel}
        </label>
        <Textarea
          id="shopping-need"
          value={needText}
          onChange={(event) => setNeedText(event.target.value)}
          placeholder={copy.needPlaceholder}
          className="mt-3 min-h-[92px] rounded-[14px] border-vyva-border bg-[#FFFCF8] p-4 font-body text-[17px] leading-relaxed text-vyva-text-1 placeholder:text-vyva-text-3"
        />

        <div className="mt-4">
          <h2 className="font-body text-[15px] font-extrabold text-vyva-text-1">
            {copy.categoryTitle}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((option) => {
              const selected = option.id === category;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setCategory(option.id)}
                  aria-pressed={selected}
                  className={`vyva-tap flex min-h-[46px] min-w-[132px] flex-1 items-center gap-2 rounded-[14px] border px-3 py-2 text-left ${
                    selected ? "border-vyva-purple bg-[#F5F3FF]" : "border-vyva-border bg-[#FFFCF8]"
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] font-body text-[14px] font-black ${
                    selected ? "bg-vyva-purple text-white" : "bg-white text-vyva-purple"
                  }`}>
                    {option.icon}
                  </span>
                  <span className="min-w-0 font-body text-[14px] font-extrabold leading-tight text-vyva-text-1">
                    {categoryLabel(option.id, locale)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-[14px] bg-[#FFF7ED] px-3 py-2 font-body text-[14px] font-semibold leading-relaxed text-[#9A3412]">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="vyva-primary-action mt-4 h-auto w-full rounded-[16px] py-4 text-[18px] shadow-[0_12px_26px_rgba(107,33,168,0.22)] hover:bg-vyva-purple/90"
          data-testid="button-shopping-find"
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
          {loading ? copy.loading : copy.find}
        </Button>

        <div className="mt-4">
          <p className="font-body text-[12px] font-black uppercase text-vyva-text-2">
            {copy.tryIdeas}
          </p>
          <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
            {IDEA_CHIPS.map((idea) => (
              <button
                key={idea.en}
                type="button"
                onClick={() => applyIdea(idea)}
                className="vyva-tap flex min-w-[168px] items-center justify-between gap-2 rounded-[14px] border border-vyva-border bg-[#FFFCF8] px-3 py-2 text-left font-body text-[13px] font-bold leading-snug text-vyva-text-1"
              >
                <span>{locale === "es" ? idea.es : idea.en}</span>
                <ChevronRight size={16} className="shrink-0 text-vyva-purple" />
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPreferencesOpen((open) => !open)}
          aria-expanded={preferencesOpen}
          className="vyva-tap mt-4 flex w-full items-center justify-between gap-3 rounded-[14px] border border-vyva-border bg-[#FFFCF8] px-3 py-2.5 text-left font-body text-[14px] font-extrabold text-vyva-text-1"
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-vyva-purple" />
            {locale === "es" ? "Mas preferencias" : "More preferences"}
          </span>
          <ChevronRight size={18} className={`shrink-0 text-vyva-purple transition-transform ${preferencesOpen ? "rotate-90" : ""}`} />
        </button>

        {preferencesOpen && (
          <div className="mt-3 rounded-[14px] border border-vyva-border bg-[#FFFCF8] p-3">
            <h2 className="font-body text-[15px] font-extrabold text-vyva-text-1">
              {copy.prioritiesTitle}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((option) => {
                const selected = priorities.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => togglePriority(option.id)}
                    aria-pressed={selected}
                    className={`vyva-tap min-h-[44px] rounded-[12px] border px-3 py-2 font-body text-[14px] font-extrabold ${
                      selected ? "border-vyva-purple bg-vyva-purple text-white" : "border-vyva-border bg-white text-vyva-text-1"
                    }`}
                  >
                    {locale === "es" ? option.es : option.en}
                  </button>
                );
              })}
            </div>

            <label htmlFor="shopping-constraints" className="mt-4 block font-body text-[15px] font-extrabold text-vyva-text-1">
              {copy.constraintsLabel}
            </label>
            <Textarea
              id="shopping-constraints"
              value={constraintsText}
              onChange={(event) => setConstraintsText(event.target.value)}
              placeholder={copy.constraintsPlaceholder}
              className="mt-2 min-h-[70px] rounded-[12px] border-vyva-border bg-white p-3 font-body text-[15px] leading-relaxed text-vyva-text-1 placeholder:text-vyva-text-3"
            />
          </div>
        )}
      </form>

      <section ref={resultsRef} className="mt-5 scroll-mt-[88px]" aria-live="polite">
        {!result && !loading && (
          <div className="rounded-[18px] border border-vyva-border bg-white p-4 text-center shadow-[0_8px_20px_rgba(60,38,20,0.06)]">
            <Sparkles size={28} className="mx-auto text-vyva-purple" />
            <h2 className="mt-2 font-body text-[18px] font-extrabold text-vyva-text-1">{copy.emptyTitle}</h2>
            <p className="mt-1 font-body text-[15px] leading-relaxed text-vyva-text-2">{copy.emptyBody}</p>
          </div>
        )}

        {result && result.recommendations.length === 0 && (
          <div className="rounded-[18px] border border-[#FDBA74] bg-[#FFF7ED] p-4">
            <h2 className="font-body text-[18px] font-extrabold text-vyva-text-1">{result.querySummary}</h2>
            <p className="mt-2 font-body text-[15px] leading-relaxed text-[#9A3412]">{result.uncertaintyNote}</p>
            <div className="mt-3 grid gap-2">
              {result.nextQuestions.map((question) => (
                <p key={question} className="rounded-[12px] bg-white px-3 py-2 font-body text-[14px] font-semibold text-vyva-text-1">
                  {question}
                </p>
              ))}
            </div>
          </div>
        )}

        {result && result.recommendations.length > 0 && (
          <>
            <div className="mb-3">
              <h2 className="font-display text-[24px] italic leading-tight text-vyva-text-1">{copy.resultsTitle}</h2>
              <p className="mt-1 font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">
                {result.querySummary}
              </p>
            </div>
            <div className="grid gap-3" data-testid="shopping-recommendation-results">
              {result.recommendations.map((item) => (
                <RecommendationCard
                  key={item.product.id}
                  item={item}
                  locale={locale}
                  copy={copy}
                  saved={savedIds.includes(item.product.id)}
                  onToggleSave={() => toggleSaved(item.product.id)}
                />
              ))}
            </div>

            <section className="mt-4 rounded-[18px] border border-[#99F6E4] bg-[#F0FDFA] p-4 shadow-[0_8px_20px_rgba(15,118,110,0.08)]">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#0F766E]">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="font-body text-[18px] font-extrabold text-vyva-text-1">
                    {copy.compareTitle}
                  </h2>
                  <p className="mt-1 font-body text-[15px] font-semibold leading-relaxed text-vyva-text-1">
                    {result.comparison.summary}
                  </p>
                </div>
              </div>
              {result.comparison.differences.length > 0 && (
                <div className="mt-3 grid gap-2">
                  {result.comparison.differences.map((line) => (
                    <p key={line} className="rounded-[12px] bg-white px-3 py-2 font-body text-[14px] font-semibold text-vyva-text-1">
                      {line}
                    </p>
                  ))}
                </div>
              )}
              <p className="mt-3 rounded-[12px] bg-white/80 px-3 py-2 font-body text-[13px] font-semibold leading-relaxed text-[#0F766E]">
                {result.uncertaintyNote}
              </p>
            </section>
          </>
        )}
      </section>

      {savedRecommendations.length > 0 && (
        <section className="mt-4 rounded-[18px] border border-vyva-border bg-white p-4 shadow-[0_8px_20px_rgba(60,38,20,0.06)]" data-testid="shopping-shortlist">
          <h2 className="font-body text-[18px] font-extrabold text-vyva-text-1">
            {copy.shortlistTitle}
          </h2>
          <div className="mt-3 grid gap-2">
            {savedRecommendations.map((item) => (
              <div key={item.product.id} className="flex items-center gap-3 rounded-[14px] bg-[#FFFCF8] p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#F5F3FF] font-body font-black text-vyva-purple">
                  {item.product.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-[15px] font-extrabold text-vyva-text-1">{item.product.name}</p>
                  <p className="font-body text-[12px] font-semibold text-vyva-text-2">{item.product.priceLabel}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mt-4 rounded-[16px] border border-vyva-border bg-[#FFFCF8] p-4 font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">
        {copy.caveat}
      </p>
    </main>
  );
};

export default ConciergeShoppingScreen;
