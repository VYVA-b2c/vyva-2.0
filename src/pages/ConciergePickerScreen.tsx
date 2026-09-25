import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Wrench,
  MapPin,
  Stethoscope,
  FileText,
  HeartHandshake,
  Building2,
  UserRound,
  Calendar,
  Car,
  ShoppingBasket,
  PackageCheck,
  MoreHorizontal,
  ShieldCheck,
  AlertTriangle,
  Pill,
  ChevronRight,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  CanonicalDetailFlowShell,
  CanonicalFlowIcon,
  CanonicalVoiceButton,
  type CanonicalDetailFlowShellContract,
} from "@/components/CanonicalDetailFlowShell";
import { useLanguage } from "@/i18n";
import {
  conciergeTaskPath,
  type ConciergeTaskEntry,
} from "@/lib/conciergeTaskNavigation";
import {
  CONCIERGE_FLOW_REFERENCES,
  normalizeConciergeProviderCategory,
  providerSetupFocusForFlow,
  type ConciergeFlowReference,
} from "../../shared/conciergeFlowRegistry";
import { apiFetch } from "@/lib/queryClient";
import { listConciergeTaskDrafts } from "@/lib/conciergeTaskDrafts";
import { buildConciergeTaskInbox, fetchConciergeTaskPendingItems, fetchConciergeTaskCompletedSessions } from "@/lib/conciergeTaskInbox";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import {
  CANONICAL_MENU_ITEM_SUBTITLE_CLASS,
  CANONICAL_MENU_ITEM_TITLE_CLASS,
} from "@/design/canonicalMenuTypography";

export type ConciergePickerCategory = "get-help" | "order-in" | "book-appointments" | "discover";

type PickerNavigateAction = { kind: "navigate"; path: string; state?: unknown };
type PickerTaskAction = { kind: "task"; entry: ConciergeTaskEntry };

type PickerOptionConfig = {
  id: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  labelKey: string;
  labelFallback: string;
  detailKey: string;
  detailFallback: string;
  action: PickerNavigateAction | PickerTaskAction;
  flowReference?: ConciergeFlowReference;
  testId: string;
};

type ConciergeProfile = {
  street?: string | null;
  cityState?: string | null;
  savedProviders?: Array<{ name?: string | null; category?: string | null; role?: string | null; isTrusted?: boolean | null }>;
};

type SetupRequirement = "home_address" | "trusted_provider";

type ConciergeIconAccent = "pill" | "document" | "cart" | "link" | "plus" | "status" | "check" | "target" | "spark";

function canonicalAccentForIcon(icon: LucideIcon): ConciergeIconAccent {
  if (icon === Stethoscope) return "plus";
  if (icon === FileText || icon === Building2) return "document";
  if (icon === HeartHandshake) return "link";
  if (icon === Calendar || icon === PackageCheck || icon === ShieldCheck) return "check";
  if (icon === Car) return "target";
  if (icon === ShoppingBasket) return "cart";
  if (icon === AlertTriangle) return "status";
  if (icon === Pill) return "pill";
  return "spark";
}

function hasHomeAddress(profile: ConciergeProfile | null): boolean {
  return Boolean(profile?.street?.trim() || profile?.cityState?.trim());
}

function hasSavedProvider(profile: ConciergeProfile | null, flowReference: ConciergeFlowReference): boolean {
  const setupFocus = providerSetupFocusForFlow(flowReference);
  if (!setupFocus) return true;
  return (profile?.savedProviders ?? []).some((provider) => (
    Boolean(provider.name?.trim())
    && provider.isTrusted !== false
    && normalizeConciergeProviderCategory(provider.category ?? provider.role ?? "") === setupFocus
  ));
}

function setupRequirementsForOption(option: PickerOptionConfig, profile: ConciergeProfile | null): SetupRequirement[] {
  const flow = option.flowReference;
  if (!flow) return [];
  const requirements: SetupRequirement[] = [];
  if ([
    CONCIERGE_FLOW_REFERENCES.transportBooking,
    CONCIERGE_FLOW_REFERENCES.shoppingSupport,
    CONCIERGE_FLOW_REFERENCES.homeService,
  ].includes(flow) && !hasHomeAddress(profile)) requirements.push("home_address");
  if ([
    CONCIERGE_FLOW_REFERENCES.transportBooking,
    CONCIERGE_FLOW_REFERENCES.otcPharmacy,
    CONCIERGE_FLOW_REFERENCES.medicalAppointment,
    CONCIERGE_FLOW_REFERENCES.homeService,
  ].includes(flow) && !hasSavedProvider(profile, flow)) requirements.push("trusted_provider");
  return requirements;
}

type PickerCategoryConfig = {
  titleKey: string;
  titleFallback: string;
  voiceContextKey: string;
  voiceContextFallback: string;
  options: PickerOptionConfig[];
};

function shoppingNavigateAction(
  category: "groceries" | "household" | undefined,
  needText: string,
  sourceRecommendation: string,
): PickerNavigateAction {
  return {
    kind: "navigate",
    path: "/concierge/shopping",
    state: {
      shoppingPrefill: {
        needText,
        category,
        priorities: ["delivery", "simplicity", "safety"],
        constraints: ["confirm before contacting or ordering"],
        sourceRecommendation,
      },
    },
  };
}

function buildCategoryConfigs(isSpanish: boolean): Record<ConciergePickerCategory, PickerCategoryConfig> {
  return {
    "get-help": {
      titleKey: "concierge.master.picker.getHelp.title",
      titleFallback: "Get Help",
      voiceContextKey: "concierge.master.picker.getHelp.voiceContext",
      voiceContextFallback: "Concierge help. Ask what kind of help the user needs and do not contact or book anyone without confirmation.",
      options: [
        {
          id: "home-repair",
          icon: Wrench,
          iconBg: "#FFF7ED",
          iconColor: "#B45309",
          labelKey: "concierge.master.picker.getHelp.options.homeRepair",
          labelFallback: "Home Repair",
          detailKey: "concierge.master.picker.getHelp.options.homeRepairDetail",
          detailFallback: "Plumber, electrician, cleaning",
          action: { kind: "task", entry: { kind: "home_service" } },
          flowReference: CONCIERGE_FLOW_REFERENCES.homeService,
          testId: "button-concierge-picker-home-repair",
        },
        {
          id: "healthcare",
          icon: Stethoscope,
          iconBg: "#F0FDFA",
          iconColor: "#0F766E",
          labelKey: "concierge.master.picker.getHelp.options.healthcare",
          labelFallback: "Healthcare",
          detailKey: "concierge.master.picker.getHelp.options.healthcareDetail",
          detailFallback: "Find a specialist or health support",
          action: {
            kind: "task",
            entry: {
              kind: "provider_contact",
              providerSearchMode: "specialist",
              query: isSpanish ? "buscar especialista" : "find a specialist",
            },
          },
          testId: "button-concierge-picker-healthcare",
        },
        {
          id: "admin-service",
          icon: FileText,
          iconBg: "#F5F3FF",
          iconColor: "#6B21A8",
          labelKey: "concierge.master.picker.getHelp.options.adminService",
          labelFallback: "Admin Service",
          detailKey: "concierge.master.picker.getHelp.options.adminServiceDetail",
          detailFallback: "Forms, letters, government paperwork",
          action: { kind: "task", entry: { kind: "document", documentKind: "government-form" } },
          testId: "button-concierge-picker-admin-service",
        },
        {
          id: "home-care",
          icon: HeartHandshake,
          iconBg: "#FFF1F2",
          iconColor: "#E74C43",
          labelKey: "concierge.master.picker.getHelp.options.homeCare",
          labelFallback: "Home Care",
          detailKey: "concierge.master.picker.getHelp.options.homeCareDetail",
          detailFallback: "Compare caregivers or care homes",
          action: {
            kind: "task",
            entry: {
              kind: "provider_contact",
              providerSearchMode: "care",
              query: isSpanish ? "buscar cuidado en casa o cuidador" : "find home care or a caregiver",
            },
          },
          testId: "button-concierge-picker-home-care",
        },
      ],
    },
    "book-appointments": {
      titleKey: "concierge.master.picker.bookAppointments.title",
      titleFallback: "Book Appointments",
      voiceContextKey: "concierge.master.picker.bookAppointments.voiceContext",
      voiceContextFallback: "Concierge appointments. Ask what kind of appointment the user needs and do not book anything without confirmation.",
      options: [
        {
          id: "medical",
          icon: Stethoscope,
          iconBg: "#F0FDFA",
          iconColor: "#0F766E",
          labelKey: "concierge.master.picker.bookAppointments.options.medical",
          labelFallback: "Medical",
          detailKey: "concierge.master.picker.bookAppointments.options.medicalDetail",
          detailFallback: "Doctor or clinic",
          action: { kind: "task", entry: { kind: "appointment", appointmentKind: "medical" } },
          flowReference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
          testId: "button-concierge-picker-medical",
        },
        {
          id: "admin",
          icon: Building2,
          iconBg: "#EFF6FF",
          iconColor: "#2563EB",
          labelKey: "concierge.master.picker.bookAppointments.options.admin",
          labelFallback: "Admin",
          detailKey: "concierge.master.picker.bookAppointments.options.adminDetail",
          detailFallback: "Government or official offices",
          action: { kind: "task", entry: { kind: "appointment", appointmentKind: "government" } },
          testId: "button-concierge-picker-appointment-admin",
        },
        {
          id: "personal-care",
          icon: UserRound,
          iconBg: "#FFF1F2",
          iconColor: "#E74C43",
          labelKey: "concierge.master.picker.bookAppointments.options.personalCare",
          labelFallback: "Personal Care",
          detailKey: "concierge.master.picker.bookAppointments.options.personalCareDetail",
          detailFallback: "Hair, grooming, wellbeing",
          action: { kind: "task", entry: { kind: "appointment", appointmentKind: "personal-care" } },
          testId: "button-concierge-picker-appointment-personal-care",
        },
        {
          id: "other",
          icon: Calendar,
          iconBg: "#FFF7ED",
          iconColor: "#B45309",
          labelKey: "concierge.master.picker.bookAppointments.options.other",
          labelFallback: "Other",
          detailKey: "concierge.master.picker.bookAppointments.options.otherDetail",
          detailFallback: "Anything else to schedule",
          action: { kind: "task", entry: { kind: "appointment" } },
          testId: "button-concierge-picker-appointment-other",
        },
      ],
    },
    "order-in": {
      titleKey: "concierge.master.picker.orderIn.title",
      titleFallback: "Order In",
      voiceContextKey: "concierge.master.picker.orderIn.voiceContext",
      voiceContextFallback: "Concierge orders. Ask what the user needs and do not buy or contact anyone without confirmation.",
      options: [
        {
          id: "ride",
          icon: Car,
          iconBg: "#EFF6FF",
          iconColor: "#2563EB",
          labelKey: "concierge.master.picker.orderIn.options.ride",
          labelFallback: "A Ride",
          detailKey: "concierge.master.picker.orderIn.options.rideDetail",
          detailFallback: "Transport help",
          action: { kind: "task", entry: { kind: "transport" } },
          flowReference: CONCIERGE_FLOW_REFERENCES.transportBooking,
          testId: "button-concierge-picker-ride",
        },
        {
          id: "food",
          icon: ShoppingBasket,
          iconBg: "#ECFDF5",
          iconColor: "#047857",
          labelKey: "concierge.master.picker.orderIn.options.food",
          labelFallback: "Food",
          detailKey: "concierge.master.picker.orderIn.options.foodDetail",
          detailFallback: "Groceries or a meal",
          action: shoppingNavigateAction(
            "groceries",
            isSpanish
              ? "Ayudame con la compra de alimentos. No compres ni contactes sin mi confirmacion."
              : "Help me with groceries or food. Do not buy or contact anyone without my confirmation.",
            isSpanish
              ? "VYVA prepara opciones de compra y pide confirmacion antes de cualquier pedido."
              : "VYVA prepares grocery options and asks for confirmation before any order.",
          ),
          flowReference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
          testId: "button-concierge-picker-food",
        },
        {
          id: "shopping",
          icon: PackageCheck,
          iconBg: "#FFF7ED",
          iconColor: "#B45309",
          labelKey: "concierge.master.picker.orderIn.options.shopping",
          labelFallback: "Shopping",
          detailKey: "concierge.master.picker.orderIn.options.shoppingDetail",
          detailFallback: "Household and everyday items",
          action: shoppingNavigateAction(
            "household",
            isSpanish
              ? "Ayudame a pedir productos para casa. No compres ni contactes sin mi confirmacion."
              : "Help me order household items. Do not buy or contact anyone without my confirmation.",
            isSpanish
              ? "VYVA prepara productos para el hogar y pide confirmacion antes de cualquier pedido."
              : "VYVA prepares household-item options and asks for confirmation before any order.",
          ),
          flowReference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
          testId: "button-concierge-picker-shopping",
        },
        {
          id: "other",
          icon: MoreHorizontal,
          iconBg: "#F5F3FF",
          iconColor: "#6B21A8",
          labelKey: "concierge.master.picker.orderIn.options.other",
          labelFallback: "Other",
          detailKey: "concierge.master.picker.orderIn.options.otherDetail",
          detailFallback: "Something else to order",
          action: shoppingNavigateAction(
            undefined,
            isSpanish
              ? "Ayudame a pedir otra cosa. No compres ni contactes sin mi confirmacion."
              : "Help me order something else. Do not buy or contact anyone without my confirmation.",
            isSpanish
              ? "VYVA compara opciones y pide confirmacion antes de cualquier pedido."
              : "VYVA compares options and asks for confirmation before any order.",
          ),
          flowReference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
          testId: "button-concierge-picker-order-other",
        },
      ],
    },
    discover: {
      titleKey: "concierge.master.picker.discover.title",
      titleFallback: "Discover",
      voiceContextKey: "concierge.master.picker.discover.voiceContext",
      voiceContextFallback: "Concierge discovery. Help the user browse local services and offers without contacting or booking anyone without confirmation.",
      options: [
        {
          id: "safe-home",
          icon: ShieldCheck,
          iconBg: "#F0FDFA",
          iconColor: "#0F766E",
          labelKey: "concierge.master.picker.discover.options.safeHome",
          labelFallback: "Safe Home",
          detailKey: "concierge.master.picker.discover.options.safeHomeDetail",
          detailFallback: "Safety check",
          action: {
            kind: "navigate",
            path: "/safe-home",
            state: { source: "concierge_discover", flowReference: CONCIERGE_FLOW_REFERENCES.safeHomeSupport },
          },
          testId: "button-concierge-picker-safe-home",
        },
        {
          id: "check-scam",
          icon: AlertTriangle,
          iconBg: "#FFF1F2",
          iconColor: "#E11D48",
          labelKey: "concierge.master.picker.discover.options.checkScam",
          labelFallback: "Check Scam",
          detailKey: "concierge.master.picker.discover.options.checkScamDetail",
          detailFallback: "Message or offer",
          action: { kind: "task", entry: { kind: "scam_review" } },
          testId: "button-concierge-picker-check-scam",
        },
        {
          id: "otc-pharmacy",
          icon: Pill,
          iconBg: "#FFF7ED",
          iconColor: "#B45309",
          labelKey: "concierge.master.picker.discover.options.otcPharmacy",
          labelFallback: "OTC Pharmacy",
          detailKey: "concierge.master.picker.discover.options.otcPharmacyDetail",
          detailFallback: "Non-prescription items",
          action: { kind: "task", entry: { kind: "otc_pharmacy" } },
          flowReference: CONCIERGE_FLOW_REFERENCES.otcPharmacy,
          testId: "button-concierge-picker-otc-pharmacy",
        },
        {
          id: "find-residence",
          icon: HeartHandshake,
          iconBg: "#F5F3FF",
          iconColor: "#6B21A8",
          labelKey: "concierge.master.picker.discover.options.findResidence",
          labelFallback: "Find Residence",
          detailKey: "concierge.master.picker.discover.options.findResidenceDetail",
          detailFallback: "Compare support",
          action: {
            kind: "task",
            entry: {
              kind: "provider_contact",
              providerSearchMode: "residence",
              query: isSpanish ? "comparar residencias o centros de cuidado" : "compare residences or care homes",
            },
          },
          testId: "button-concierge-picker-find-residence",
        },
      ],
    },
  };
}

type ConciergePickerScreenProps = {
  category: ConciergePickerCategory;
  backPath?: string;
};

export default function ConciergePickerScreen({ category, backPath = "/concierge" }: ConciergePickerScreenProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { isDark } = useHomeMasterTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSpanish = language.split("-")[0].toLowerCase() === "es";
  const config = buildCategoryConfigs(isSpanish)[category];
  const [blockedOption, setBlockedOption] = useState<PickerOptionConfig | null>(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    try { return sessionStorage.getItem("concierge:get-help:nudge-dismissed") === "true"; } catch { return false; }
  });
  const taskNudgeQuery = useQuery({
    queryKey: ["concierge-get-help-nudge", language],
    enabled: category === "get-help" && !backPath.startsWith("/dev/") && !nudgeDismissed,
    queryFn: async () => {
      const [drafts, pending, completed] = await Promise.all([
        listConciergeTaskDrafts(), fetchConciergeTaskPendingItems(), fetchConciergeTaskCompletedSessions(),
      ]);
      return buildConciergeTaskInbox({ drafts, pending, completed, isSpanish });
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const { data: conciergeProfile = null, isLoading: profileLoading } = useQuery<ConciergeProfile | null>({
    queryKey: ["/api/profile"],
    queryFn: async () => {
      const response = await apiFetch("/api/profile");
      return response.ok ? await response.json() as ConciergeProfile : null;
    },
    retry: false,
  });

  const shellContract: CanonicalDetailFlowShellContract = {
    shellId: "home.production",
    headerId: "detail.voice-touch",
    headerTitle: t(config.titleKey, config.titleFallback),
    containerId: "flow.rounded-card",
    bottomNavId: "home-sos-reports",
    composer: "hidden",
  };

  const continueToOption = useCallback((option: PickerOptionConfig) => {
    if (option.action.kind === "navigate") {
      navigate(option.action.path, { state: option.action.state });
      return;
    }
    navigate(conciergeTaskPath(), { state: { conciergeTaskEntry: option.action.entry } });
  }, [navigate]);

  function handleOptionSelect(option: PickerOptionConfig) {
    const missing = setupRequirementsForOption(option, conciergeProfile);
    if (missing.length > 0) {
      setBlockedOption(option);
      return;
    }
    continueToOption(option);
  }

  const blockedRequirements = useMemo(
    () => blockedOption ? setupRequirementsForOption(blockedOption, conciergeProfile) : [],
    [blockedOption, conciergeProfile],
  );

  useEffect(() => {
    const resumeOptionId = searchParams.get("resume");
    if (!resumeOptionId || profileLoading) return;
    const option = config.options.find((candidate) => candidate.id === resumeOptionId);
    setSearchParams({}, { replace: true });
    if (!option) return;
    const missing = setupRequirementsForOption(option, conciergeProfile);
    if (missing.length === 0) continueToOption(option);
    else setBlockedOption(option);
  }, [conciergeProfile, config.options, continueToOption, profileLoading, searchParams, setSearchParams]);

  function openAddressSetup() {
    if (!blockedOption) return;
    navigate(`/onboarding/profile/address?returnTo=${encodeURIComponent(`${location.pathname}?resume=${blockedOption.id}`)}`);
  }

  function openProviderSetup() {
    if (!blockedOption?.flowReference) return;
    navigate("/onboarding/profile/providers", {
      state: {
        returnTo: `${location.pathname}?resume=${blockedOption.id}`,
        setupFocus: providerSetupFocusForFlow(blockedOption.flowReference),
        setupFlow: blockedOption.flowReference,
        setupReason: `Set up ${blockedOption.labelFallback} for Concierge`,
      },
    });
  }

  const homeTasks = taskNudgeQuery.data?.needs_you.filter((item) => item.continuation.flow === "home_service") ?? [];
  const attentionTask = homeTasks.find((item) => ["needs_info", "ready_to_confirm", "blocked"].includes(item.continuation.state));
  const draftTask = homeTasks.find((item) => item.continuation.state === "draft");
  const providerOption = config.options.find((option) => setupRequirementsForOption(option, conciergeProfile).includes("trusted_provider"));
  const nudgeKind = attentionTask ? 0 : draftTask ? 1 : conciergeProfile && providerOption ? 2 : null;
  const nudgeCopy: Record<string, string[]> = {
    en: ["Your request needs attention", "Continue your request", "Add a trusted provider", "Dismiss"],
    es: ["Tu solicitud necesita atención", "Continúa tu solicitud", "Añade un proveedor de confianza", "Cerrar"],
    de: ["Deine Anfrage braucht Aufmerksamkeit", "Anfrage fortsetzen", "Vertrauenswürdigen Anbieter hinzufügen", "Schließen"],
    fr: ["Votre demande nécessite votre attention", "Continuer votre demande", "Ajouter un prestataire de confiance", "Fermer"],
    it: ["La tua richiesta richiede attenzione", "Continua la tua richiesta", "Aggiungi un fornitore di fiducia", "Chiudi"],
    pt: ["O seu pedido precisa de atenção", "Continuar o seu pedido", "Adicionar um prestador de confiança", "Fechar"],
  };
  const nudgeLabels = nudgeCopy[language.split("-")[0]] ?? nudgeCopy.en;
  const showNudge = category === "get-help" && !nudgeDismissed && !blockedOption && !profileLoading && taskNudgeQuery.isSuccess && nudgeKind !== null;

  return (
    <CanonicalDetailFlowShell
      shellContract={shellContract}
      onBack={() => blockedOption ? setBlockedOption(null) : navigate(backPath)}
      frameClassName="concierge-picker-frame !px-4 sm:!px-5"
      shellTestId="concierge-picker-screen"
      backTestId="button-concierge-picker-back"
      headerAction={
        <CanonicalVoiceButton
          contextHint={t(config.voiceContextKey, config.voiceContextFallback)}
          agentSlug="concierge"
          dynamicVariables={{ app_entrypoint: `concierge_picker_${category}` }}
          testId="button-concierge-picker-voice"
        />
      }
    >
      {showNudge && (
        <aside className={`mb-4 flex items-center gap-2 rounded-lg border p-3 ${isDark ? "border-[#4B8F85] bg-[#102B29] text-white" : "border-[#99F6E4] bg-[#F0FDFA] text-[#134E4A]"}`} data-testid="get-help-nudge">
          <button type="button" className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left font-semibold" onClick={() => {
            const task = attentionTask ?? draftTask;
            if (task) navigate(attentionTask ? task.detailPath : task.resumePath);
            else if (providerOption) setBlockedOption(providerOption);
          }}>
            <HeartHandshake size={24} className="shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{nudgeLabels[nudgeKind!]}</span>
            <ChevronRight size={20} className="shrink-0" aria-hidden="true" />
          </button>
          <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center" aria-label={nudgeLabels[3]} title={nudgeLabels[3]} onClick={() => {
            setNudgeDismissed(true);
            try { sessionStorage.setItem("concierge:get-help:nudge-dismissed", "true"); } catch { /* Dismiss still works for this visit. */ }
          }}><X size={20} aria-hidden="true" /></button>
        </aside>
      )}
      {!blockedOption && <div className="flex flex-col gap-3" data-testid="concierge-picker-options">
        {config.options.map((option) => {
          const Icon = option.icon;
          const label = t(option.labelKey, option.labelFallback);
          const detail = t(option.detailKey, option.detailFallback);
          return (
            <button
              key={option.id}
              type="button"
              data-testid={option.testId}
              onClick={() => handleOptionSelect(option)}
              disabled={profileLoading}
              aria-label={`${label}. ${detail}`}
              style={{ "--picker-accent-tint": `${option.iconColor}18`, ...(!isDark ? { background: `linear-gradient(145deg, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.9) 58%, ${option.iconBg} 100%)` } : {}) } as CSSProperties}
              className={`vyva-tap flex min-h-[84px] w-full items-center gap-4 rounded-[22px] border px-4 py-3.5 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9B5DE5] min-[390px]:min-h-[88px] min-[390px]:rounded-[24px] sm:min-h-[96px] sm:px-5 ${isDark ? "border-white/[0.14] bg-white/[0.075] shadow-[0_14px_30px_rgba(0,0,0,0.24)]" : "border-[#EFE7F7] bg-white shadow-[0_12px_28px_rgba(63,45,35,0.065)]"}`}
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px]" style={{ background: option.iconBg, color: option.iconColor }}>
                <Icon size={24} strokeWidth={2.6} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block ${CANONICAL_MENU_ITEM_TITLE_CLASS} ${isDark ? "text-[#FFF8FF]" : "text-vyva-text-1"}`}>
                  {label}
                </span>
                <span className={`mt-1 block truncate ${CANONICAL_MENU_ITEM_SUBTITLE_CLASS} ${isDark ? "text-[#CFC4D8]" : "text-vyva-text-3"}`}>
                  {detail}
                </span>
              </span>
              <ChevronRight size={20} strokeWidth={2.6} className={`flex-shrink-0 ${isDark ? "text-[#B98CFF]" : "text-vyva-purple"}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>}
      {blockedOption ? (
        <section className="py-5" data-testid="panel-concierge-service-setup">
          <p className={`font-body text-[12px] font-black uppercase ${isDark ? "text-[#B98CFF]" : "text-vyva-purple"}`}>
            {isSpanish ? "Configuracion necesaria" : "Setup needed"}
          </p>
          <h2 className={`mt-2 font-display text-[24px] font-semibold ${isDark ? "text-[#FFF8FF]" : "text-vyva-text-1"}`}>
            {isSpanish ? `Prepara ${blockedOption.labelFallback} primero` : `Set up ${blockedOption.labelFallback} first`}
          </h2>
          <div className={`mt-6 divide-y border-y ${isDark ? "divide-white/15 border-white/15" : "divide-[#E9DDF5] border-[#E9DDF5]"}`}>
            {blockedRequirements.includes("home_address") ? (
              <button type="button" onClick={openAddressSetup} className={`vyva-tap flex min-h-[80px] w-full items-center gap-4 px-2 py-4 text-left font-body text-[16px] font-bold ${isDark ? "text-[#FFF8FF] hover:bg-white/5" : "text-vyva-text-1 hover:bg-[#F8F2FF]"}`} data-testid="button-concierge-setup-address">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${isDark ? "bg-[#B98CFF]/15 text-[#B98CFF]" : "bg-[#F3E8FF] text-vyva-purple"}`}><MapPin size={24} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">{isSpanish ? "Anadir direccion" : "Add home address"}</span>
                <ChevronRight size={20} className="shrink-0 text-[#B98CFF]" aria-hidden="true" />
              </button>
            ) : null}
            {blockedRequirements.includes("trusted_provider") ? (
              <button type="button" onClick={openProviderSetup} className={`vyva-tap flex min-h-[80px] w-full items-center gap-4 px-2 py-4 text-left font-body text-[16px] font-bold ${isDark ? "text-[#FFF8FF] hover:bg-white/5" : "text-vyva-text-1 hover:bg-[#F8F2FF]"}`} data-testid="button-concierge-setup-provider">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${isDark ? "bg-[#B98CFF]/15 text-[#B98CFF]" : "bg-[#F3E8FF] text-vyva-purple"}`}><ShieldCheck size={24} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">{isSpanish ? "Anadir proveedor" : "Add trusted provider"}</span>
                <ChevronRight size={20} className="shrink-0 text-[#B98CFF]" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </CanonicalDetailFlowShell>
  );
}
