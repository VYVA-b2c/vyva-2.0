import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Wrench,
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
  type LucideIcon,
} from "lucide-react";
import {
  CanonicalDetailFlowShell,
  CanonicalVoiceButton,
  type CanonicalDetailFlowShellContract,
} from "@/components/CanonicalDetailFlowShell";
import { useLanguage } from "@/i18n";
import {
  conciergeTaskPath,
  type ConciergeTaskEntry,
} from "@/lib/conciergeTaskNavigation";
import { CONCIERGE_FLOW_REFERENCES } from "../../shared/conciergeFlowRegistry";

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
  testId: string;
};

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
};

export default function ConciergePickerScreen({ category }: ConciergePickerScreenProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isSpanish = language.split("-")[0].toLowerCase() === "es";
  const config = buildCategoryConfigs(isSpanish)[category];

  const shellContract: CanonicalDetailFlowShellContract = {
    shellId: "home.production",
    headerId: "detail.voice-touch",
    headerTitle: t(config.titleKey, config.titleFallback),
    containerId: "flow.rounded-card",
    bottomNavId: "home-sos-reports",
    composer: "hidden",
  };

  function handleOptionSelect(option: PickerOptionConfig) {
    if (option.action.kind === "navigate") {
      navigate(option.action.path, { state: option.action.state });
      return;
    }
    navigate(conciergeTaskPath(), { state: { conciergeTaskEntry: option.action.entry } });
  }

  return (
    <CanonicalDetailFlowShell
      shellContract={shellContract}
      onBack={() => navigate("/concierge")}
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
      <div className="flex flex-col gap-2.5" data-testid="concierge-picker-options">
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
              aria-label={`${label}. ${detail}`}
              className="vyva-tap flex min-h-[72px] w-full items-center gap-3 rounded-[20px] border border-[#EFE7F7] bg-white px-4 py-3 text-left shadow-[0_10px_24px_rgba(63,45,35,0.05)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B21A8]"
            >
              <span
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px]"
                style={{ background: option.iconBg, color: option.iconColor }}
              >
                <Icon size={22} strokeWidth={2.5} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-body text-[16px] font-black leading-tight text-vyva-text-1">
                  {label}
                </span>
                <span className="mt-0.5 block truncate font-body text-[13px] font-bold leading-snug text-vyva-text-3">
                  {detail}
                </span>
              </span>
              <ChevronRight size={18} strokeWidth={2.6} className="flex-shrink-0 text-vyva-purple" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </CanonicalDetailFlowShell>
  );
}
