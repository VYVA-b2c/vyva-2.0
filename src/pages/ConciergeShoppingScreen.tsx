import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  stepLabels: string[];
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

const COPY: Record<"en" | "es", Copy> = {
  en: {
    title: "Shopping helper",
    subtitle: "Tell VYVA what you need. We will compare simple choices, not place an order.",
    shortlist: "Shortlist",
    stepLabels: ["Need", "Choices", "Compare", "Shortlist"],
    needLabel: "What do you need help choosing?",
    needPlaceholder: "Example: I need an easy breakfast with protein, low cost, and no heavy carrying.",
    categoryTitle: "Choose an area",
    prioritiesTitle: "What matters most?",
    constraintsLabel: "Anything VYVA should avoid?",
    constraintsPlaceholder: "Example: no dairy, low salt, hard to bend, prefer delivery",
    find: "Find best choices",
    loading: "Finding clear choices...",
    emptyTitle: "Tell VYVA what you need",
    emptyBody: "Start with a short sentence. VYVA will keep the list small and explain why each choice fits.",
    resultsTitle: "Best choices",
    compareTitle: "Simple comparison",
    save: "Save choice",
    saved: "Saved",
    shortlistTitle: "Saved shortlist",
    noCheckout: "No checkout here. This page only helps compare choices.",
    caveat: "For pharmacy items, VYVA does not replace a pharmacist, doctor, or medication advice.",
    error: "VYVA could not compare choices right now. Please try again.",
    back: "Back to Concierge",
    tryIdeas: "Try one",
  },
  es: {
    title: "Ayuda para comprar",
    subtitle: "Diga a VYVA que necesita. Compararemos opciones sencillas, sin hacer pedidos.",
    shortlist: "Guardados",
    stepLabels: ["Necesidad", "Opciones", "Comparar", "Guardados"],
    needLabel: "Que necesita elegir?",
    needPlaceholder: "Ejemplo: necesito un desayuno facil con proteina, economico y sin cargar peso.",
    categoryTitle: "Elija un area",
    prioritiesTitle: "Que importa mas?",
    constraintsLabel: "Algo que VYVA deba evitar?",
    constraintsPlaceholder: "Ejemplo: sin lacteos, bajo en sal, cuesta agacharse, prefiero entrega",
    find: "Buscar mejores opciones",
    loading: "Buscando opciones claras...",
    emptyTitle: "Diga a VYVA que necesita",
    emptyBody: "Empiece con una frase corta. VYVA mostrara pocas opciones y explicara por que encajan.",
    resultsTitle: "Mejores opciones",
    compareTitle: "Comparacion sencilla",
    save: "Guardar opcion",
    saved: "Guardado",
    shortlistTitle: "Opciones guardadas",
    noCheckout: "Sin compra aqui. Esta pagina solo ayuda a comparar opciones.",
    caveat: "Para articulos de farmacia, VYVA no sustituye a un farmaceutico, medico ni consejo sobre medicacion.",
    error: "VYVA no ha podido comparar opciones ahora. Intentelo otra vez.",
    back: "Volver a Concierge",
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

const IDEA_CHIPS = [
  {
    en: "An easy low-salt meal for days when cooking feels tiring",
    es: "Una comida baja en sal para dias en que cocinar cansa",
    category: "groceries" as ShoppingCategory,
    priorities: ["simplicity", "diet"] as ShoppingPriority[],
  },
  {
    en: "Something to make the bathroom safer at night",
    es: "Algo para que el bano sea mas seguro por la noche",
    category: "mobility_aids" as ShoppingCategory,
    priorities: ["safety", "accessibility"] as ShoppingPriority[],
  },
  {
    en: "A simple way to avoid mixing up medicines",
    es: "Una forma sencilla de no confundir medicinas",
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

const Stepper = ({ labels, activeIndex }: { labels: string[]; activeIndex: number }) => (
  <ol aria-label="Shopping recommendation steps" className="grid grid-cols-4 gap-2">
    {labels.map((label, index) => {
      const active = index === activeIndex;
      const complete = index < activeIndex;
      return (
        <li key={label} className="min-w-0">
          <div className={`h-2 rounded-full ${active || complete ? "bg-vyva-purple" : "bg-vyva-warm2"}`} />
          <p className={`mt-2 truncate text-center font-body text-[11px] font-bold ${active ? "text-vyva-purple" : "text-vyva-text-2"}`}>
            {label}
          </p>
        </li>
      );
    })}
  </ol>
);

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
  <article className="rounded-[24px] border border-vyva-border bg-white p-4 shadow-[0_12px_30px_rgba(60,38,20,0.08)]">
    <div className="flex items-start gap-3">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#F5F3FF] font-body text-[20px] font-black text-vyva-purple">
        {item.product.name.slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#ECFDF5] px-3 py-1 font-body text-[12px] font-extrabold text-[#0A7C4E]">
            {rankLabel(item.rankLabel, locale)}
          </span>
          <span className="rounded-full bg-[#FBF8F4] px-3 py-1 font-body text-[12px] font-bold text-vyva-text-2">
            {item.product.priceLabel}
          </span>
        </div>
        <h2 className="mt-2 font-body text-[21px] font-extrabold leading-[1.12] text-vyva-text-1">
          {item.product.name}
        </h2>
        <p className="mt-2 font-body text-[15px] leading-relaxed text-vyva-text-2">
          {item.product.description}
        </p>
      </div>
    </div>

    <div className="mt-4 grid gap-2">
      {item.reasons.slice(0, 2).map((reason) => (
        <p key={reason} className="flex gap-2 rounded-[16px] bg-[#F0FDFA] px-3 py-2 font-body text-[14px] font-semibold leading-snug text-vyva-text-1">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#0F766E]" />
          <span>{reason}</span>
        </p>
      ))}
      {item.tradeoffs.slice(0, 1).map((tradeoff) => (
        <p key={tradeoff} className="flex gap-2 rounded-[16px] bg-[#FFFCF7] px-3 py-2 font-body text-[13px] leading-relaxed text-vyva-text-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#C9890A]" />
          <span>{tradeoff}</span>
        </p>
      ))}
    </div>

    <div className="mt-4 rounded-[18px] bg-[#F8F4EF] p-3">
      <p className="font-body text-[12px] font-black uppercase text-vyva-text-2">
        {locale === "es" ? "Antes de elegir" : "Before choosing"}
      </p>
      <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
        {item.cautionNotes[0] || item.product.accessibilityNotes[0]}
      </p>
    </div>

    <button
      type="button"
      onClick={onToggleSave}
      className={`vyva-tap mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-body text-[16px] font-extrabold ${
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

  const savedRecommendations = useMemo(
    () => result?.recommendations.filter((item) => savedIds.includes(item.product.id)) ?? [],
    [result, savedIds],
  );

  const activeStep = result?.recommendations.length
    ? (savedIds.length ? 3 : 2)
    : loading
      ? 1
      : 0;

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
    <main className="vyva-page" data-testid="concierge-shopping-screen">
      <div className="sticky top-0 z-10 -mx-[22px] border-b border-vyva-border bg-vyva-cream/95 px-[22px] py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate("/concierge")}
            className="vyva-tap inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-body text-[14px] font-extrabold text-vyva-text-1 shadow-sm"
          >
            <ArrowLeft size={18} />
            {copy.back}
          </button>
          <div className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 py-2 font-body text-[13px] font-extrabold text-vyva-purple shadow-sm" aria-live="polite">
            <ShoppingBasket size={18} />
            {copy.shortlist}: {savedIds.length}
          </div>
        </div>
      </div>

      <section className="mt-5 rounded-[28px] border border-vyva-border bg-white p-5 shadow-[0_14px_34px_rgba(60,38,20,0.08)]">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[#F5F3FF] text-vyva-purple">
            <PackageCheck size={27} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[31px] leading-[1.08] text-vyva-text-1">
              {copy.title}
            </h1>
            <p className="mt-2 font-body text-[16px] font-semibold leading-relaxed text-vyva-text-2">
              {copy.subtitle}
            </p>
          </div>
        </div>
        <div className="mt-5">
          <Stepper labels={copy.stepLabels} activeIndex={activeStep} />
        </div>
        <p className="mt-5 rounded-[18px] bg-[#F0FDFA] p-3 font-body text-[14px] font-bold leading-relaxed text-[#0F766E]">
          {copy.noCheckout}
        </p>
      </section>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <section className="rounded-[26px] border border-vyva-border bg-white p-4 shadow-[0_12px_30px_rgba(60,38,20,0.07)]">
          <label htmlFor="shopping-need" className="font-body text-[17px] font-extrabold text-vyva-text-1">
            {copy.needLabel}
          </label>
          <Textarea
            id="shopping-need"
            value={needText}
            onChange={(event) => setNeedText(event.target.value)}
            placeholder={copy.needPlaceholder}
            className="mt-3 min-h-[118px] rounded-[22px] border-vyva-border bg-[#FFFCF8] p-4 font-body text-[17px] leading-relaxed text-vyva-text-1 placeholder:text-vyva-text-3"
          />
          <div className="mt-3">
            <p className="font-body text-[12px] font-black uppercase text-vyva-text-2">
              {copy.tryIdeas}
            </p>
            <div className="mt-2 grid gap-2">
              {IDEA_CHIPS.map((idea) => (
                <button
                  key={idea.en}
                  type="button"
                  onClick={() => applyIdea(idea)}
                  className="vyva-tap flex w-full items-center justify-between gap-3 rounded-[18px] border border-vyva-border bg-[#FFFCF8] px-4 py-3 text-left font-body text-[14px] font-bold leading-snug text-vyva-text-1"
                >
                  <span>{locale === "es" ? idea.es : idea.en}</span>
                  <ChevronRight size={18} className="shrink-0 text-vyva-purple" />
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[26px] border border-vyva-border bg-white p-4 shadow-[0_12px_30px_rgba(60,38,20,0.07)]">
          <h2 className="font-body text-[17px] font-extrabold text-vyva-text-1">
            {copy.categoryTitle}
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {CATEGORY_OPTIONS.map((option) => {
              const selected = option.id === category;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setCategory(option.id)}
                  aria-pressed={selected}
                  className={`vyva-tap min-h-[104px] rounded-[22px] border px-4 py-4 text-left ${
                    selected ? "border-vyva-purple bg-[#F5F3FF]" : "border-vyva-border bg-[#FFFCF8]"
                  }`}
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-[15px] font-body text-[18px] font-black ${
                    selected ? "bg-vyva-purple text-white" : "bg-white text-vyva-purple"
                  }`}>
                    {option.icon}
                  </span>
                  <span className="mt-3 block font-body text-[16px] font-extrabold leading-tight text-vyva-text-1">
                    {categoryLabel(option.id, locale)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[26px] border border-vyva-border bg-white p-4 shadow-[0_12px_30px_rgba(60,38,20,0.07)]">
          <h2 className="font-body text-[17px] font-extrabold text-vyva-text-1">
            {copy.prioritiesTitle}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRIORITY_OPTIONS.map((option) => {
              const selected = priorities.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => togglePriority(option.id)}
                  aria-pressed={selected}
                  className={`vyva-tap rounded-full border px-4 py-2.5 font-body text-[14px] font-extrabold ${
                    selected ? "border-vyva-purple bg-vyva-purple text-white" : "border-vyva-border bg-[#FFFCF8] text-vyva-text-1"
                  }`}
                >
                  {locale === "es" ? option.es : option.en}
                </button>
              );
            })}
          </div>

          <label htmlFor="shopping-constraints" className="mt-5 block font-body text-[15px] font-extrabold text-vyva-text-1">
            {copy.constraintsLabel}
          </label>
          <Textarea
            id="shopping-constraints"
            value={constraintsText}
            onChange={(event) => setConstraintsText(event.target.value)}
            placeholder={copy.constraintsPlaceholder}
            className="mt-2 min-h-[82px] rounded-[20px] border-vyva-border bg-[#FFFCF8] p-4 font-body text-[15px] leading-relaxed text-vyva-text-1 placeholder:text-vyva-text-3"
          />
        </section>

        {error && (
          <p role="alert" className="rounded-[18px] bg-[#FFF7ED] px-4 py-3 font-body text-[14px] font-semibold leading-relaxed text-[#9A3412]">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="vyva-primary-action sticky bottom-[112px] z-10 h-auto w-full rounded-[24px] py-4 text-[18px] shadow-[0_16px_34px_rgba(107,33,168,0.26)] hover:bg-vyva-purple/90"
          data-testid="button-shopping-find"
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
          {loading ? copy.loading : copy.find}
        </Button>
      </form>

      <section className="mt-6" aria-live="polite">
        {!result && !loading && (
          <div className="rounded-[26px] border border-vyva-border bg-white p-5 text-center shadow-[0_12px_30px_rgba(60,38,20,0.07)]">
            <Sparkles size={30} className="mx-auto text-vyva-purple" />
            <h2 className="mt-3 font-body text-[19px] font-extrabold text-vyva-text-1">{copy.emptyTitle}</h2>
            <p className="mt-2 font-body text-[15px] leading-relaxed text-vyva-text-2">{copy.emptyBody}</p>
          </div>
        )}

        {result && result.recommendations.length === 0 && (
          <div className="rounded-[26px] border border-[#FDBA74] bg-[#FFF7ED] p-5">
            <h2 className="font-body text-[19px] font-extrabold text-vyva-text-1">{result.querySummary}</h2>
            <p className="mt-2 font-body text-[15px] leading-relaxed text-[#9A3412]">{result.uncertaintyNote}</p>
            <div className="mt-4 grid gap-2">
              {result.nextQuestions.map((question) => (
                <p key={question} className="rounded-[16px] bg-white px-3 py-2 font-body text-[14px] font-semibold text-vyva-text-1">
                  {question}
                </p>
              ))}
            </div>
          </div>
        )}

        {result && result.recommendations.length > 0 && (
          <>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="vyva-section-title">{copy.resultsTitle}</h2>
                <p className="mt-1 font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">
                  {result.querySummary}
                </p>
              </div>
            </div>
            <div className="grid gap-4" data-testid="shopping-recommendation-results">
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

            <section className="mt-5 rounded-[26px] border border-[#99F6E4] bg-[#F0FDFA] p-4 shadow-[0_12px_30px_rgba(15,118,110,0.10)]">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-white text-[#0F766E]">
                  <Sparkles size={21} />
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
                <div className="mt-4 grid gap-2">
                  {result.comparison.differences.map((line) => (
                    <p key={line} className="rounded-[16px] bg-white px-3 py-2 font-body text-[14px] font-semibold text-vyva-text-1">
                      {line}
                    </p>
                  ))}
                </div>
              )}
              <p className="mt-4 rounded-[16px] bg-white/80 px-3 py-2 font-body text-[13px] font-semibold leading-relaxed text-[#0F766E]">
                {result.uncertaintyNote}
              </p>
            </section>
          </>
        )}
      </section>

      {savedRecommendations.length > 0 && (
        <section className="mt-5 rounded-[26px] border border-vyva-border bg-white p-4 shadow-[0_12px_30px_rgba(60,38,20,0.07)]" data-testid="shopping-shortlist">
          <h2 className="font-body text-[18px] font-extrabold text-vyva-text-1">
            {copy.shortlistTitle}
          </h2>
          <div className="mt-3 grid gap-2">
            {savedRecommendations.map((item) => (
              <div key={item.product.id} className="flex items-center gap-3 rounded-[18px] bg-[#FFFCF8] p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] font-body font-black text-vyva-purple">
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

      <p className="mt-5 rounded-[20px] border border-vyva-border bg-[#FFFCF8] p-4 font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">
        {copy.caveat}
      </p>
    </main>
  );
};

export default ConciergeShoppingScreen;

