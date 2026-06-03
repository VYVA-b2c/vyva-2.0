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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import {
  getStaticShoppingSupportPackages,
  SHOPPING_CATEGORY_CHOICE_LABELS,
  SHOPPING_SUPPORT_PACKAGES,
  type ShoppingCategoryChoice,
  type ShoppingPriority,
  type ShoppingRecommendation,
  type ShoppingRecommendationResponse,
  type ShoppingSupportPackageDefinition,
  type ShoppingSupportPackageId,
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
  errorSignIn: string;
  errorPlan: string;
  errorProfile: string;
  errorApiUnavailable: string;
  back: string;
  tryIdeas: string;
  checkBeforeBuying: string;
  confidence: string;
  packageTitle: string;
  packageBody: string;
  packageSource: string;
  packageNoCheckout: string;
  packageServiceNotice: string;
};

type ShoppingRoutePrefill = {
  needText: string;
  category: ShoppingCategoryChoice;
  priorities: ShoppingPriority[];
  constraints?: string[];
  packageId?: ShoppingSupportPackageId;
  sourceRecommendation?: string;
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
    needPlaceholder: "Example: Safer bathroom at night, with simple low-cost choices.",
    categoryTitle: "Area",
    prioritiesTitle: "Most important",
    constraintsLabel: "Avoid",
    constraintsPlaceholder: "Example: hard to bend, poor night vision, no heavy items",
    find: "Find best choices",
    loading: "Finding clear choices...",
    emptyTitle: "Start with a safer-home need",
    emptyBody: "VYVA keeps the list short and explains what each choice helps with.",
    resultsTitle: "Best choices",
    compareTitle: "Simple comparison",
    save: "Save choice",
    saved: "Saved",
    shortlistTitle: "Saved shortlist",
    noCheckout: "No checkout here.",
    caveat: "For pharmacy items, VYVA does not replace a pharmacist, doctor, or medication advice.",
    error: "VYVA could not compare choices right now. Please try again.",
    errorSignIn: "Please sign in again, then try Find best choices.",
    errorPlan: "Concierge is not included in this plan. Check subscription settings to enable it.",
    errorProfile: "Choose or finish a care profile first, then try again.",
    errorApiUnavailable: "The local VYVA API is not running. Start the backend on port 3001 and try again.",
    back: "Back",
    tryIdeas: "Try one",
    checkBeforeBuying: "Check before choosing",
    confidence: "Fit",
    packageTitle: "Choose a support package",
    packageBody: "Packages prepare a short request from VYVA-approved supplies or Concierge. VYVA will not place an order or start checkout.",
    packageSource: "From your health recommendation",
    packageNoCheckout: "No checkout starts here.",
    packageServiceNotice: "Service request only.",
  },
  es: {
    title: "Ayuda para comprar",
    subtitle: "Compare pocas opciones sencillas. VYVA no hara pedidos ni iniciara pagos.",
    shortlist: "Guardados",
    needLabel: "Que necesita elegir?",
    needPlaceholder: "Ejemplo: bano mas seguro por la noche, con opciones sencillas y economicas.",
    categoryTitle: "Area",
    prioritiesTitle: "Mas importante",
    constraintsLabel: "Evitar",
    constraintsPlaceholder: "Ejemplo: cuesta agacharse, poca vision de noche, sin objetos pesados",
    find: "Buscar mejores opciones",
    loading: "Buscando opciones claras...",
    emptyTitle: "Empiece con una necesidad de seguridad en casa",
    emptyBody: "VYVA muestra pocas opciones y explica para que sirve cada una.",
    resultsTitle: "Mejores opciones",
    compareTitle: "Comparacion sencilla",
    save: "Guardar opcion",
    saved: "Guardado",
    shortlistTitle: "Opciones guardadas",
    noCheckout: "Sin compra aqui.",
    caveat: "Para articulos de farmacia, VYVA no sustituye a un farmaceutico, medico ni consejo sobre medicacion.",
    error: "VYVA no ha podido comparar opciones ahora. Intentelo otra vez.",
    errorSignIn: "Inicie sesion otra vez y vuelva a buscar mejores opciones.",
    errorPlan: "Concierge no esta incluido en este plan. Revise la suscripcion para activarlo.",
    errorProfile: "Elija o termine un perfil de cuidado y vuelva a intentarlo.",
    errorApiUnavailable: "La API local de VYVA no esta funcionando. Inicie el backend en el puerto 3001 y vuelva a intentarlo.",
    back: "Volver",
    tryIdeas: "Probar",
    checkBeforeBuying: "Comprobar antes de elegir",
    confidence: "Encaje",
    packageTitle: "Elija un paquete de apoyo",
    packageBody: "Los paquetes preparan una solicitud corta con suministros aprobados por VYVA o Concierge. VYVA no hace pedidos ni inicia pagos.",
    packageSource: "Desde su recomendacion de salud",
    packageNoCheckout: "No se inicia compra aqui.",
    packageServiceNotice: "Solo solicitud de servicio.",
  },
};

const CATEGORY_OPTIONS: Array<{ id: ShoppingCategoryChoice; icon: string }> = [
  { id: "safe_home", icon: "S" },
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
const FALLBACK_SUPPORT_PACKAGE_OPTIONS = getStaticShoppingSupportPackages();

const IDEA_CHIPS = [
  {
    en: "Safer bathroom at night",
    es: "Bano mas seguro",
    category: "safe_home" as ShoppingCategoryChoice,
    priorities: ["safety", "accessibility"] as ShoppingPriority[],
  },
  {
    en: "Less bending at home",
    es: "Menos agacharse en casa",
    category: "safe_home" as ShoppingCategoryChoice,
    priorities: ["accessibility", "delivery"] as ShoppingPriority[],
  },
  {
    en: "Avoid mixing medicines",
    es: "No confundir medicinas",
    category: "pharmacy_basics" as ShoppingCategoryChoice,
    priorities: ["simplicity", "safety"] as ShoppingPriority[],
  },
];

function localeKey(language: string): "en" | "es" {
  return language.toLowerCase().startsWith("es") ? "es" : "en";
}

function categoryLabel(category: ShoppingCategoryChoice, locale: "en" | "es") {
  return SHOPPING_CATEGORY_CHOICE_LABELS[category][locale];
}

function rankLabel(label: ShoppingRecommendation["rankLabel"], locale: "en" | "es") {
  if (locale === "en") return label;
  if (label === "Best fit") return "Mejor opcion";
  if (label === "Lowest cost") return "Menor coste";
  if (label === "Best first step") return "Primer paso";
  if (label === "Best for night trips") return "Para ir de noche";
  if (label === "Best if standing is hard") return "Si cuesta levantarse";
  if (label === "Best for less bending") return "Para agacharse menos";
  return "Mas facil";
}

function confidenceLabel(confidence: ShoppingRecommendation["confidence"], locale: "en" | "es") {
  if (locale === "es") {
    if (confidence === "high") return "alto";
    if (confidence === "medium") return "medio";
    return "bajo";
  }
  return confidence;
}

class ShoppingRequestError extends Error {
  status?: number;
  code?: string;
  nextRoute?: string;

  constructor(message: string, status?: number, code?: string, nextRoute?: string) {
    super(message);
    this.name = "ShoppingRequestError";
    this.status = status;
    this.code = code;
    this.nextRoute = nextRoute;
  }
}

async function readErrorBody(response: Response): Promise<{ error?: string; code?: string; nextRoute?: string }> {
  try {
    const parsed = await response.json();
    return typeof parsed === "object" && parsed !== null ? parsed as { error?: string; code?: string; nextRoute?: string } : {};
  } catch {
    return {};
  }
}

function shoppingErrorMessage(error: unknown, copy: Copy): string {
  if (error instanceof ShoppingRequestError) {
    if (error.status === 401) return copy.errorSignIn;
    if (error.status === 403 || error.code === "ENTITLEMENT_REQUIRED") return copy.errorPlan;
    if (error.status === 409) return copy.errorProfile;
    if (error.status === 502 || error.code === "LOCAL_API_UNAVAILABLE") return copy.errorApiUnavailable;
    return error.message || copy.error;
  }
  return copy.error;
}

async function requestRecommendations(input: {
  needText: string;
  category: ShoppingCategoryChoice;
  priorities: ShoppingPriority[];
  constraints: string[];
  locale: string;
  packageId?: string | null;
}): Promise<ShoppingRecommendationResponse> {
  const response = await apiFetch("/api/concierge/shopping/recommendations", {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new ShoppingRequestError(body.error || `Request failed: ${response.status}`, response.status, body.code, body.nextRoute);
  }
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

    <div className="mt-3 flex flex-wrap gap-2">
      <span className="rounded-full bg-[#F8F4EF] px-2.5 py-1 font-body text-[12px] font-bold text-vyva-text-2">
        {item.product.availabilityLabel}
      </span>
      <span className="rounded-full bg-[#F5F3FF] px-2.5 py-1 font-body text-[12px] font-bold text-vyva-purple">
        {copy.confidence}: {confidenceLabel(item.confidence, locale)}
      </span>
    </div>

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
      {item.product.accessibilityNotes[0] && (
        <p className="rounded-[12px] border border-vyva-border bg-white px-3 py-2 font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">
          <span className="font-extrabold text-vyva-text-1">{copy.checkBeforeBuying}: </span>
          {item.product.accessibilityNotes[0]}
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
  const { language } = useLanguage();
  const locale = localeKey(language);
  const copy = COPY[locale];
  const [category, setCategory] = useState<ShoppingCategoryChoice>("safe_home");
  const [needText, setNeedText] = useState("");
  const [constraintsText, setConstraintsText] = useState("");
  const [priorities, setPriorities] = useState<ShoppingPriority[]>(["safety", "accessibility"]);
  const [result, setResult] = useState<ShoppingRecommendationResponse | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [routePackageId, setRoutePackageId] = useState<ShoppingSupportPackageId | null>(null);
  const [sourceRecommendation, setSourceRecommendation] = useState("");
  const [supportPackages, setSupportPackages] = useState<ShoppingSupportPackageDefinition[]>(FALLBACK_SUPPORT_PACKAGE_OPTIONS);
  const resultsRef = useRef<HTMLElement | null>(null);
  const lastRoutePrefillKeyRef = useRef<string | null>(null);
  const supportPackageMap = useMemo(() => new Map(supportPackages.map((item) => [item.id, item])), [supportPackages]);
  const activeRoutePackage = routePackageId ? supportPackageMap.get(routePackageId) ?? SHOPPING_SUPPORT_PACKAGES[routePackageId] : null;

  const savedRecommendations = useMemo(
    () => result?.recommendations.filter((item) => savedIds.includes(item.product.id)) ?? [],
    [result, savedIds],
  );

  useEffect(() => {
    let active = true;
    async function loadSupportPackages() {
      try {
        const response = await apiFetch("/api/concierge/shopping/support-packages");
        if (!response?.ok) throw new Error("Support packages unavailable");
        const data = await response.json().catch(() => ({}));
        const packages = Array.isArray(data.packages)
          ? data.packages.filter((item): item is ShoppingSupportPackageDefinition => (
            item && typeof item.id === "string" && item.label && item.description && item.needText
          ))
          : [];
        if (active && packages.length > 0) setSupportPackages(packages);
      } catch {
        if (active) setSupportPackages(FALLBACK_SUPPORT_PACKAGE_OPTIONS);
      }
    }
    loadSupportPackages();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const prefill = (location.state as ShoppingLocationState)?.shoppingPrefill;
    if (!prefill) return;
    const prefillKey = `${prefill.packageId ?? ""}:${prefill.category}:${prefill.needText}:${prefill.priorities.join(",")}:${prefill.constraints?.join(",") ?? ""}`;
    if (lastRoutePrefillKeyRef.current === prefillKey) return;
    lastRoutePrefillKeyRef.current = prefillKey;
    const packageId = typeof prefill.packageId === "string" && prefill.packageId.trim() ? prefill.packageId.trim() : null;
    const packageDefinition = packageId ? supportPackageMap.get(packageId) ?? SHOPPING_SUPPORT_PACKAGES[packageId] : null;

    if (prefill.needText.trim()) {
      setNeedText(prefill.needText.trim());
    } else if (packageDefinition) {
      setNeedText(packageDefinition.needText[locale]);
    }
    if (VALID_SHOPPING_CATEGORIES.has(prefill.category)) {
      setCategory(prefill.category);
    } else if (packageDefinition) {
      setCategory(packageDefinition.category);
    }
    const safePriorities = prefill.priorities.filter((priority) => VALID_SHOPPING_PRIORITIES.has(priority));
    if (safePriorities.length) {
      setPriorities(safePriorities);
      setPreferencesOpen(true);
    } else if (packageDefinition) {
      setPriorities(packageDefinition.priorities);
      setPreferencesOpen(true);
    }
    const packageConstraints = packageDefinition?.constraints[locale] ?? [];
    const safeConstraints = prefill.constraints?.filter(Boolean) ?? packageConstraints;
    if (safeConstraints.length) {
      setConstraintsText(safeConstraints.join(", "));
      setPreferencesOpen(true);
    }
    setRoutePackageId(packageId);
    setSourceRecommendation(prefill.sourceRecommendation?.trim() ?? "");
    setResult(null);
    setError(null);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [locale, location.pathname, location.search, location.state, navigate, supportPackageMap]);

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

  function applyFollowUpQuestion(question: string) {
    const normalized = question.toLowerCase();
    setNeedText(question.replace(/\?$/, ""));
    if (normalized.includes("medicine") || normalized.includes("medicin") || normalized.includes("pastilla")) {
      setCategory("pharmacy_basics");
      setPriorities(["simplicity", "safety"]);
    } else if (normalized.includes("bend") || normalized.includes("agachar")) {
      setCategory("safe_home");
      setPriorities(["accessibility", "delivery"]);
    } else {
      setCategory("safe_home");
      setPriorities(["safety", "accessibility"]);
    }
    setResult(null);
    setError(null);
  }

  function applySupportPackage(packageDefinition: ShoppingSupportPackageDefinition) {
    if (packageDefinition.serviceRequest) {
      const requestText = [
        packageDefinition.needText[locale],
        sourceRecommendation ? `${copy.packageSource}: ${sourceRecommendation}` : "",
      ].filter(Boolean).join("\n\n");
      navigate("/concierge", {
        state: {
          conciergePrefill: {
            kind: "home_care_quote",
            message: requestText,
            source: "symptom_report",
          },
        },
      });
      return;
    }

    setRoutePackageId(packageDefinition.id);
    setNeedText(packageDefinition.needText[locale]);
    setCategory(packageDefinition.category);
    setPriorities(packageDefinition.priorities);
    setConstraintsText(packageDefinition.constraints[locale].join(", "));
    setPreferencesOpen(true);
    setResult(null);
    setError(null);
  }

  async function runShoppingSearch() {
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
        locale: language,
        packageId: routePackageId,
      });
      setResult(next);
      setSavedIds((current) => current.filter((id) => next.recommendations.some((item) => item.product.id === id)));
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (err) {
      setError(shoppingErrorMessage(err, copy));
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void runShoppingSearch();
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

      {activeRoutePackage && (
        <section
          className="mt-4 rounded-[20px] border border-[#D8B4FE] bg-white p-4 shadow-[0_14px_34px_rgba(107,33,168,0.12)]"
          data-testid="shopping-support-packages"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] text-vyva-purple">
              <PackageCheck size={23} />
            </div>
            <div className="min-w-0">
              <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-purple">
                {copy.packageTitle}
              </p>
              <p className="mt-1 font-body text-[15px] font-semibold leading-relaxed text-vyva-text-2">
                {copy.packageBody}
              </p>
              {sourceRecommendation && (
                <p className="mt-2 rounded-[14px] bg-[#FFFCF8] px-3 py-2 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                  {copy.packageSource}: {sourceRecommendation}
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2" role="list">
            {supportPackages.map((packageDefinition) => {
              const selected = packageDefinition.id === routePackageId;
              return (
                <button
                  key={packageDefinition.id}
                  type="button"
                  onClick={() => applySupportPackage(packageDefinition)}
                  aria-pressed={selected}
                  data-testid={`button-shopping-package-${packageDefinition.id}`}
                  className={`vyva-tap flex min-h-[136px] flex-col items-start rounded-[16px] border px-3 py-3 text-left transition ${
                    selected ? "border-vyva-purple bg-[#F5F3FF]" : "border-vyva-border bg-[#FFFCF8]"
                  }`}
                >
                  <span className="font-body text-[16px] font-black leading-tight text-vyva-text-1">
                    {packageDefinition.label[locale]}
                  </span>
                  <span className="mt-1 font-body text-[13px] font-semibold leading-snug text-vyva-text-2">
                    {packageDefinition.description[locale]}
                  </span>
                  <span className={`mt-2 rounded-full px-2 py-1 font-body text-[11px] font-black ${
                    packageDefinition.serviceRequest ? "bg-[#EEF2FF] text-[#4338CA]" : "bg-[#F0FDFA] text-[#0F766E]"
                  }`}>
                    {packageDefinition.serviceRequest ? copy.packageServiceNotice : copy.packageNoCheckout}
                  </span>
                  <span className="mt-auto inline-flex items-center gap-1 pt-3 font-body text-[13px] font-black text-vyva-purple">
                    {packageDefinition.ctaLabel[locale]}
                    <ChevronRight size={15} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

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

        <Button
          type="submit"
          disabled={loading}
          className="vyva-primary-action mt-4 h-auto w-full rounded-[16px] py-4 text-[18px] shadow-[0_12px_26px_rgba(107,33,168,0.22)] hover:bg-vyva-purple/90 max-[480px]:w-[calc(100%-128px)]"
          data-testid="button-shopping-find"
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
          {loading ? copy.loading : copy.find}
        </Button>

        {error && (
          <p role="alert" className="mt-3 rounded-[14px] border border-[#FED7AA] bg-[#FFFCF7] px-3 py-2 font-body text-[14px] font-semibold leading-relaxed text-[#9A3412]">
            {error}
          </p>
        )}

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
                <button
                  key={question}
                  type="button"
                  onClick={() => applyFollowUpQuestion(question)}
                  className="vyva-tap flex items-center justify-between gap-3 rounded-[12px] bg-white px-3 py-2 text-left font-body text-[14px] font-semibold text-vyva-text-1"
                >
                  <span>{question}</span>
                  <ChevronRight size={16} className="shrink-0 text-vyva-purple" />
                </button>
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
