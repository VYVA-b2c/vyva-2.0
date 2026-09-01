import {
  CONCIERGE_FLOW_REFERENCES,
  CONCIERGE_FLOW_REGISTRY,
  type ConciergeFlowReference,
} from "../../shared/conciergeFlowRegistry";
import { VYVA_PRESENTATION_REGISTRY } from "../../shared/orchestration/presentationRegistry";
import {
  getScreenContract,
  type ScreenContractId,
  type ScreenPrimarySurface,
  type ScreenTemplateKind,
} from "./screenContracts";

export type TrustedHelpServiceId =
  | "groceries"
  | "home-care"
  | "transport"
  | "wellness"
  | "other";

export type TrustedHelpStepId =
  | "dashboard"
  | "service"
  | "subservice"
  | "provider"
  | "controls"
  | "review"
  | "active-mission";

export type TrustedHelpPresentationMoment =
  | "overview"
  | "choice"
  | "refinement-choice"
  | "provider-choice"
  | "control-choice"
  | "confirmation-review"
  | "progress-status";

export type TrustedHelpProviderSource = "own" | "partner" | "vyva-find";

export type TrustedHelpVoicePolicy =
  | "spoken-summary-only"
  | "conversation-prompt"
  | "hidden-in-voice";

export type TrustedHelpCoverage = "Water" | "Food" | "Household" | "Meals";

export type TrustedHelpBackendSource =
  | "user_providers"
  | "trusted_help_partners"
  | "concierge_pending"
  | "concierge_sessions"
  | "local_user_preferences";

export type TrustedHelpUiInstruction =
  | "show_summary"
  | "show_choice_question"
  | "show_confirmation"
  | "show_progress";

export type TrustedHelpAllowedTemplate = Extract<
  ScreenTemplateKind,
  "setupDashboard" | "guidedFlow" | "outputReview"
>;

export interface TrustedHelpPresentationStep {
  stepId: TrustedHelpStepId;
  label: string;
  moment: TrustedHelpPresentationMoment;
  screenContractId: Extract<ScreenContractId, "concierge">;
  template: TrustedHelpAllowedTemplate;
  presentationFamilyId: string;
  uiInstruction: TrustedHelpUiInstruction;
  primarySurface: ScreenPrimarySurface;
  purpose: string;
  voicePolicy: TrustedHelpVoicePolicy;
  cards: "visible" | "hidden" | "contextual";
  chips: "hidden";
  confirmationBoundary: "none" | "finalConfirmationBeforeExternalAction";
  next: readonly TrustedHelpStepId[];
}

export interface TrustedHelpSubservicePresentation {
  id: string;
  label: string;
  userMeaning: string;
}

export interface TrustedHelpServicePresentation {
  serviceId: TrustedHelpServiceId;
  label: string;
  description: string;
  flowReference: ConciergeFlowReference;
  entryStep: Extract<TrustedHelpStepId, "subservice" | "provider">;
  requiresSubservice: boolean;
  subservices: readonly TrustedHelpSubservicePresentation[];
  providerSources: readonly TrustedHelpProviderSource[];
  backendSources: readonly TrustedHelpBackendSource[];
  coverageDriven: boolean;
  coverageValues: readonly TrustedHelpCoverage[];
  safetyModel: "prepareThenConfirm";
}

export type TrustedHelpMissionStatus =
  | "collecting_details"
  | "selecting_provider"
  | "awaiting_confirmation"
  | "awaiting_user_confirmation"
  | "contacting_provider"
  | "form_in_progress"
  | "awaiting_provider_reply"
  | "awaiting_user_save"
  | "booked"
  | "stopped"
  | "ready"
  | "needs_info"
  | "being_prepared"
  | "sent_or_called"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled"
  | "needs_human_help";

export type TrustedHelpMissionVisualState =
  | "collecting"
  | "review"
  | "preparing"
  | "live-contact"
  | "waiting"
  | "ready-to-save"
  | "done"
  | "blocked"
  | "stopped";

export type TrustedHelpMissionControl =
  | "ask_status"
  | "edit_details"
  | "change_provider"
  | "change_contact_method"
  | "listen"
  | "mute"
  | "unmute"
  | "stop"
  | "confirm"
  | "save_result"
  | "retry";

export type TrustedHelpExternalActionBoundary =
  | "preparingOnly"
  | "waitingForUserConfirmation"
  | "externalContactInProgress"
  | "waitingForExternalReply"
  | "readyToSaveVerifiedResult"
  | "completedWithProof"
  | "stoppedOrCancelled"
  | "blockedNeedsHuman";

export interface TrustedHelpMissionPresentation {
  status: TrustedHelpMissionStatus;
  label: { en: string; es: string };
  helper: { en: string; es: string };
  stepId: Extract<TrustedHelpStepId, "active-mission">;
  visualState: TrustedHelpMissionVisualState;
  presentationFamilyId: string;
  uiInstruction: TrustedHelpUiInstruction;
  template: Extract<TrustedHelpAllowedTemplate, "outputReview">;
  cards: "contextual";
  chips: "hidden";
  confirmationBoundary: "finalConfirmationBeforeExternalAction";
  externalActionBoundary: TrustedHelpExternalActionBoundary;
  allowedControls: readonly TrustedHelpMissionControl[];
}

export const TRUSTED_HELP_SCREEN_CONTRACT_ID = "concierge" as const;

export const TRUSTED_HELP_PROVIDER_SCOPE_EXCLUSIONS = [
  "health.medical_provider",
  "medication.pharmacy_provider",
  "clinical_care_provider",
] as const;

export const TRUSTED_HELP_PRESENTATION_STEPS = [
  {
    stepId: "dashboard",
    label: "Overview",
    moment: "overview",
    screenContractId: TRUSTED_HELP_SCREEN_CONTRACT_ID,
    template: "setupDashboard",
    presentationFamilyId: "presentation.family.summary",
    uiInstruction: "show_summary",
    primarySurface: "dashboard",
    purpose: "Show provider, order, and readiness status before setup.",
    voicePolicy: "spoken-summary-only",
    cards: "visible",
    chips: "hidden",
    confirmationBoundary: "none",
    next: ["service", "provider", "controls", "review"],
  },
  {
    stepId: "service",
    label: "Service",
    moment: "choice",
    screenContractId: TRUSTED_HELP_SCREEN_CONTRACT_ID,
    template: "guidedFlow",
    presentationFamilyId: "presentation.family.choice.single",
    uiInstruction: "show_choice_question",
    primarySurface: "singleStep",
    purpose: "Choose one concierge-only service.",
    voicePolicy: "conversation-prompt",
    cards: "visible",
    chips: "hidden",
    confirmationBoundary: "none",
    next: ["subservice", "provider"],
  },
  {
    stepId: "subservice",
    label: "Type",
    moment: "refinement-choice",
    screenContractId: TRUSTED_HELP_SCREEN_CONTRACT_ID,
    template: "guidedFlow",
    presentationFamilyId: "presentation.family.choice.single",
    uiInstruction: "show_choice_question",
    primarySurface: "singleStep",
    purpose: "Ask for a type only when the service needs one.",
    voicePolicy: "conversation-prompt",
    cards: "visible",
    chips: "hidden",
    confirmationBoundary: "none",
    next: ["provider"],
  },
  {
    stepId: "provider",
    label: "Provider",
    moment: "provider-choice",
    screenContractId: TRUSTED_HELP_SCREEN_CONTRACT_ID,
    template: "guidedFlow",
    presentationFamilyId: "presentation.family.choice.single",
    uiInstruction: "show_choice_question",
    primarySurface: "singleStep",
    purpose: "Choose own provider, VYVA partner, or VYVA search.",
    voicePolicy: "conversation-prompt",
    cards: "visible",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    next: ["controls"],
  },
  {
    stepId: "controls",
    label: "Controls",
    moment: "control-choice",
    screenContractId: TRUSTED_HELP_SCREEN_CONTRACT_ID,
    template: "guidedFlow",
    presentationFamilyId: "presentation.family.choice.single",
    uiInstruction: "show_choice_question",
    primarySurface: "singleStep",
    purpose: "Set approval, payment, caregiver, and spending rules.",
    voicePolicy: "conversation-prompt",
    cards: "visible",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    next: ["review"],
  },
  {
    stepId: "review",
    label: "Review",
    moment: "confirmation-review",
    screenContractId: TRUSTED_HELP_SCREEN_CONTRACT_ID,
    template: "outputReview",
    presentationFamilyId: "presentation.family.confirmation",
    uiInstruction: "show_confirmation",
    primarySurface: "answer",
    purpose: "Show exactly what VYVA may do before anything external happens.",
    voicePolicy: "spoken-summary-only",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    next: ["active-mission"],
  },
  {
    stepId: "active-mission",
    label: "Right now",
    moment: "progress-status",
    screenContractId: TRUSTED_HELP_SCREEN_CONTRACT_ID,
    template: "outputReview",
    presentationFamilyId: "presentation.family.progress",
    uiInstruction: "show_progress",
    primarySurface: "answer",
    purpose: "Track live VYVA work with user controls visible.",
    voicePolicy: "spoken-summary-only",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    next: ["dashboard"],
  },
] as const satisfies readonly TrustedHelpPresentationStep[];

export const TRUSTED_HELP_SERVICE_PRESENTATION_MAP = [
  {
    serviceId: "groceries",
    label: "Groceries",
    description: "Food, water, household",
    flowReference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
    entryStep: "provider",
    requiresSubservice: false,
    subservices: [
      {
        id: "supermarket",
        label: "Supermarket",
        userMeaning: "Food and household items.",
      },
      {
        id: "fresh-food",
        label: "Fresh food",
        userMeaning: "Produce, bakery, meat, and daily food.",
      },
      {
        id: "household",
        label: "Household",
        userMeaning: "Cleaning, toiletries, and water delivery.",
      },
    ],
    providerSources: ["own", "partner", "vyva-find"],
    backendSources: [
      "user_providers",
      "trusted_help_partners",
      "concierge_pending",
      "local_user_preferences",
    ],
    coverageDriven: true,
    coverageValues: ["Water", "Food", "Household", "Meals"],
    safetyModel: "prepareThenConfirm",
  },
  {
    serviceId: "home-care",
    label: "Home Care",
    description: "Repairs and cleaning",
    flowReference: CONCIERGE_FLOW_REFERENCES.homeService,
    entryStep: "subservice",
    requiresSubservice: true,
    subservices: [
      {
        id: "plumbing",
        label: "Plumber",
        userMeaning: "Leaks, drains, taps, toilets, and water problems.",
      },
      {
        id: "electrical",
        label: "Electrician",
        userMeaning: "Lights, sockets, power, and small electrical jobs.",
      },
      {
        id: "cleaning",
        label: "Cleaning",
        userMeaning: "Home cleaning, deep cleaning, and recurring help.",
      },
      {
        id: "safety-fixes",
        label: "Safety fixes",
        userMeaning: "Handrails, trip hazards, locks, and small home safety work.",
      },
    ],
    providerSources: ["own", "partner", "vyva-find"],
    backendSources: [
      "user_providers",
      "trusted_help_partners",
      "concierge_pending",
      "local_user_preferences",
    ],
    coverageDriven: false,
    coverageValues: [],
    safetyModel: "prepareThenConfirm",
  },
  {
    serviceId: "transport",
    label: "Transport",
    description: "Taxi or accessible ride",
    flowReference: CONCIERGE_FLOW_REFERENCES.transportBooking,
    entryStep: "subservice",
    requiresSubservice: true,
    subservices: [
      {
        id: "taxi",
        label: "Taxi",
        userMeaning: "Standard local ride.",
      },
      {
        id: "accessible",
        label: "Accessible ride",
        userMeaning: "Wheelchair, walker, ramp, or extra boarding time.",
      },
      {
        id: "assisted",
        label: "Assisted ride",
        userMeaning: "Driver or caregiver help from door to door.",
      },
    ],
    providerSources: ["own", "partner", "vyva-find"],
    backendSources: [
      "user_providers",
      "trusted_help_partners",
      "concierge_pending",
      "local_user_preferences",
    ],
    coverageDriven: false,
    coverageValues: [],
    safetyModel: "prepareThenConfirm",
  },
  {
    serviceId: "wellness",
    label: "Wellness",
    description: "Salon and body care",
    flowReference: CONCIERGE_FLOW_REFERENCES.careNavigation,
    entryStep: "subservice",
    requiresSubservice: true,
    subservices: [
      {
        id: "hair-care",
        label: "Hair care",
        userMeaning: "Haircut, blow dry, color, or barber.",
      },
      {
        id: "nail-care",
        label: "Nail care",
        userMeaning: "Manicure, pedicure, and basic nail support.",
      },
      {
        id: "massage",
        label: "Massage",
        userMeaning: "Relaxation, mobility, or pain-relief massage.",
      },
      {
        id: "foot-care",
        label: "Foot care",
        userMeaning: "Non-medical foot care and comfort support.",
      },
    ],
    providerSources: ["own", "partner", "vyva-find"],
    backendSources: [
      "user_providers",
      "trusted_help_partners",
      "concierge_pending",
      "local_user_preferences",
    ],
    coverageDriven: false,
    coverageValues: [],
    safetyModel: "prepareThenConfirm",
  },
  {
    serviceId: "other",
    label: "Other",
    description: "Tell VYVA what you need",
    flowReference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
    entryStep: "provider",
    requiresSubservice: false,
    subservices: [
      {
        id: "errand",
        label: "Errand",
        userMeaning: "A practical local task that does not fit another service.",
      },
      {
        id: "local-help",
        label: "Local help",
        userMeaning: "Find trusted local support before acting.",
      },
      {
        id: "describe",
        label: "Describe it",
        userMeaning: "Let the user explain the need in their own words.",
      },
    ],
    providerSources: ["own", "partner", "vyva-find"],
    backendSources: [
      "user_providers",
      "trusted_help_partners",
      "concierge_pending",
      "concierge_sessions",
      "local_user_preferences",
    ],
    coverageDriven: false,
    coverageValues: [],
    safetyModel: "prepareThenConfirm",
  },
] as const satisfies readonly TrustedHelpServicePresentation[];

export const TRUSTED_HELP_ACTIVE_MISSION_PRESENTATIONS = [
  {
    status: "collecting_details",
    label: { en: "Details needed", es: "Faltan detalles" },
    helper: {
      en: "VYVA collects one missing detail before moving on.",
      es: "VYVA recoge un dato pendiente antes de seguir.",
    },
    stepId: "active-mission",
    visualState: "collecting",
    presentationFamilyId: "presentation.family.choice.single",
    uiInstruction: "show_choice_question",
    template: "outputReview",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    externalActionBoundary: "preparingOnly",
    allowedControls: ["ask_status", "edit_details", "change_provider"],
  },
  {
    status: "selecting_provider",
    label: { en: "Choosing provider", es: "Eligiendo proveedor" },
    helper: {
      en: "VYVA compares saved providers, partners, and trusted search.",
      es: "VYVA compara proveedores guardados, partners y busqueda fiable.",
    },
    stepId: "active-mission",
    visualState: "preparing",
    presentationFamilyId: "presentation.family.progress",
    uiInstruction: "show_progress",
    template: "outputReview",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    externalActionBoundary: "preparingOnly",
    allowedControls: ["ask_status", "edit_details", "change_provider"],
  },
  {
    status: "awaiting_confirmation",
    label: { en: "Ready for your OK", es: "Listo para tu OK" },
    helper: {
      en: "Nothing is sent, called, booked, or paid until the user confirms.",
      es: "Nada se envia, llama, reserva ni paga hasta que la persona confirme.",
    },
    stepId: "active-mission",
    visualState: "review",
    presentationFamilyId: "presentation.family.confirmation",
    uiInstruction: "show_confirmation",
    template: "outputReview",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    externalActionBoundary: "waitingForUserConfirmation",
    allowedControls: ["ask_status", "edit_details", "change_provider", "change_contact_method", "confirm"],
  },
  {
    status: "awaiting_user_confirmation",
    label: { en: "Ready for your OK", es: "Listo para tu OK" },
    helper: {
      en: "Nothing is sent, called, booked, or paid until the user confirms.",
      es: "Nada se envia, llama, reserva ni paga hasta que la persona confirme.",
    },
    stepId: "active-mission",
    visualState: "review",
    presentationFamilyId: "presentation.family.confirmation",
    uiInstruction: "show_confirmation",
    template: "outputReview",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    externalActionBoundary: "waitingForUserConfirmation",
    allowedControls: ["ask_status", "edit_details", "change_provider", "change_contact_method", "confirm"],
  },
  {
    status: "contacting_provider",
    label: { en: "Contacting provider", es: "Contactando proveedor" },
    helper: {
      en: "The user can listen, mute, edit, or stop the contact step.",
      es: "La persona puede escuchar, silenciar, editar o detener el contacto.",
    },
    stepId: "active-mission",
    visualState: "live-contact",
    presentationFamilyId: "presentation.family.progress",
    uiInstruction: "show_progress",
    template: "outputReview",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    externalActionBoundary: "externalContactInProgress",
    allowedControls: ["ask_status", "edit_details", "listen", "mute", "unmute", "stop"],
  },
  {
    status: "form_in_progress",
    label: { en: "Form in progress", es: "Formulario en curso" },
    helper: {
      en: "VYVA prepares the form and stops before final submission.",
      es: "VYVA prepara el formulario y se detiene antes del envio final.",
    },
    stepId: "active-mission",
    visualState: "preparing",
    presentationFamilyId: "presentation.family.progress",
    uiInstruction: "show_progress",
    template: "outputReview",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    externalActionBoundary: "waitingForUserConfirmation",
    allowedControls: ["ask_status", "edit_details", "confirm", "stop"],
  },
  {
    status: "awaiting_provider_reply",
    label: { en: "Waiting for reply", es: "Esperando respuesta" },
    helper: {
      en: "VYVA waits for a provider reply or final detail.",
      es: "VYVA espera respuesta del proveedor o el ultimo dato.",
    },
    stepId: "active-mission",
    visualState: "waiting",
    presentationFamilyId: "presentation.family.progress",
    uiInstruction: "show_progress",
    template: "outputReview",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    externalActionBoundary: "waitingForExternalReply",
    allowedControls: ["ask_status", "edit_details", "change_provider", "stop"],
  },
  {
    status: "awaiting_user_save",
    label: { en: "Waiting to save", es: "Pendiente de guardar" },
    helper: {
      en: "Save the confirmed date, reference, price, or provider reply.",
      es: "Guarda fecha, referencia, precio o respuesta confirmada.",
    },
    stepId: "active-mission",
    visualState: "ready-to-save",
    presentationFamilyId: "presentation.family.confirmation",
    uiInstruction: "show_confirmation",
    template: "outputReview",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    externalActionBoundary: "readyToSaveVerifiedResult",
    allowedControls: ["ask_status", "edit_details", "save_result"],
  },
  {
    status: "booked",
    label: { en: "Booked", es: "Reservada" },
    helper: {
      en: "A real confirmation is available and can be saved.",
      es: "Hay una confirmacion real disponible para guardar.",
    },
    stepId: "active-mission",
    visualState: "done",
    presentationFamilyId: "presentation.family.summary",
    uiInstruction: "show_summary",
    template: "outputReview",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    externalActionBoundary: "completedWithProof",
    allowedControls: ["ask_status", "save_result"],
  },
  {
    status: "stopped",
    label: { en: "Stopped", es: "Detenida" },
    helper: {
      en: "The mission will not continue unless the user starts it again.",
      es: "La mision no seguira salvo que la persona la reinicie.",
    },
    stepId: "active-mission",
    visualState: "stopped",
    presentationFamilyId: "presentation.family.summary",
    uiInstruction: "show_summary",
    template: "outputReview",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    externalActionBoundary: "stoppedOrCancelled",
    allowedControls: ["ask_status", "retry"],
  },
  {
    status: "ready",
    label: { en: "Ready for your OK", es: "Listo para tu OK" },
    helper: {
      en: "Everything stays paused until the user confirms.",
      es: "Todo queda pausado hasta que la persona confirme.",
    },
    stepId: "active-mission",
    visualState: "review",
    presentationFamilyId: "presentation.family.confirmation",
    uiInstruction: "show_confirmation",
    template: "outputReview",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    externalActionBoundary: "waitingForUserConfirmation",
    allowedControls: ["ask_status", "edit_details", "confirm"],
  },
  {
    status: "needs_info",
    label: { en: "Needs details", es: "Faltan datos" },
    helper: {
      en: "One detail is needed before VYVA can continue.",
      es: "Hace falta un dato antes de que VYVA pueda seguir.",
    },
    stepId: "active-mission",
    visualState: "collecting",
    presentationFamilyId: "presentation.family.choice.single",
    uiInstruction: "show_choice_question",
    template: "outputReview",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    externalActionBoundary: "preparingOnly",
    allowedControls: ["ask_status", "edit_details"],
  },
  {
    status: "being_prepared",
    label: { en: "VYVA is preparing it", es: "VYVA lo prepara" },
    helper: {
      en: "VYVA gathers what is needed before asking for an OK.",
      es: "VYVA reune lo necesario antes de pedir el OK.",
    },
    stepId: "active-mission",
    visualState: "preparing",
    presentationFamilyId: "presentation.family.progress",
    uiInstruction: "show_progress",
    template: "outputReview",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    externalActionBoundary: "preparingOnly",
    allowedControls: ["ask_status", "edit_details", "stop"],
  },
  {
    status: "sent_or_called",
    label: { en: "Sent or called", es: "Enviado o llamado" },
    helper: {
      en: "The contact step happened. Save the result next.",
      es: "El contacto ya se hizo. Guarda el resultado despues.",
    },
    stepId: "active-mission",
    visualState: "live-contact",
    presentationFamilyId: "presentation.family.progress",
    uiInstruction: "show_progress",
    template: "outputReview",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    externalActionBoundary: "externalContactInProgress",
    allowedControls: ["ask_status", "edit_details", "stop", "save_result"],
  },
  {
    status: "waiting",
    label: { en: "Waiting for reply", es: "Esperando respuesta" },
    helper: {
      en: "When a reply arrives, save it here to close the task.",
      es: "Cuando llegue respuesta, guardala aqui para cerrar la gestion.",
    },
    stepId: "active-mission",
    visualState: "waiting",
    presentationFamilyId: "presentation.family.progress",
    uiInstruction: "show_progress",
    template: "outputReview",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    externalActionBoundary: "waitingForExternalReply",
    allowedControls: ["ask_status", "edit_details", "stop"],
  },
  {
    status: "completed",
    label: { en: "Saved", es: "Guardado" },
    helper: {
      en: "The result is saved in Concierge history.",
      es: "El resultado esta guardado en el historial.",
    },
    stepId: "active-mission",
    visualState: "done",
    presentationFamilyId: "presentation.family.summary",
    uiInstruction: "show_summary",
    template: "outputReview",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    externalActionBoundary: "completedWithProof",
    allowedControls: ["ask_status"],
  },
  {
    status: "failed",
    label: { en: "Needs review", es: "Necesita revision" },
    helper: {
      en: "Review the issue before trying again.",
      es: "Revisa el problema antes de intentarlo otra vez.",
    },
    stepId: "active-mission",
    visualState: "blocked",
    presentationFamilyId: "presentation.family.error.safe_fallback",
    uiInstruction: "show_summary",
    template: "outputReview",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    externalActionBoundary: "blockedNeedsHuman",
    allowedControls: ["ask_status", "edit_details", "retry"],
  },
  {
    status: "cancelled",
    label: { en: "Cancelled", es: "Cancelado" },
    helper: {
      en: "This task will not continue.",
      es: "Esta gestion no seguira adelante.",
    },
    stepId: "active-mission",
    visualState: "stopped",
    presentationFamilyId: "presentation.family.summary",
    uiInstruction: "show_summary",
    template: "outputReview",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    externalActionBoundary: "stoppedOrCancelled",
    allowedControls: ["ask_status", "retry"],
  },
  {
    status: "needs_human_help",
    label: { en: "Needs human help", es: "Necesita ayuda humana" },
    helper: {
      en: "A person should review the task before it moves on.",
      es: "Una persona debe revisar antes de seguir.",
    },
    stepId: "active-mission",
    visualState: "blocked",
    presentationFamilyId: "presentation.family.error.safe_fallback",
    uiInstruction: "show_summary",
    template: "outputReview",
    cards: "contextual",
    chips: "hidden",
    confirmationBoundary: "finalConfirmationBeforeExternalAction",
    externalActionBoundary: "blockedNeedsHuman",
    allowedControls: ["ask_status", "edit_details", "retry"],
  },
] as const satisfies readonly TrustedHelpMissionPresentation[];

const TRUSTED_HELP_MISSION_STATUS_ALIASES: Record<string, TrustedHelpMissionStatus> = {
  awaiting_user_confirmation: "awaiting_confirmation",
  calling: "contacting_provider",
  contacted: "sent_or_called",
  done: "completed",
  in_progress: "being_prepared",
  pending: "ready",
  ready_to_save: "awaiting_user_save",
};

export function normalizeTrustedHelpMissionStatus(value: unknown): TrustedHelpMissionStatus {
  const status = typeof value === "string"
    ? value.trim().toLowerCase().replace(/[\s-]+/g, "_")
    : "";
  const knownStatuses = new Set<TrustedHelpMissionStatus>(
    TRUSTED_HELP_ACTIVE_MISSION_PRESENTATIONS.map((item) => item.status),
  );
  const aliasedStatus = TRUSTED_HELP_MISSION_STATUS_ALIASES[status] ?? status;
  return knownStatuses.has(aliasedStatus as TrustedHelpMissionStatus)
    ? aliasedStatus as TrustedHelpMissionStatus
    : "ready";
}

export function getTrustedHelpMissionPresentation(status: unknown) {
  const normalizedStatus = normalizeTrustedHelpMissionStatus(status);
  return TRUSTED_HELP_ACTIVE_MISSION_PRESENTATIONS.find(
    (presentation) => presentation.status === normalizedStatus,
  ) ?? TRUSTED_HELP_ACTIVE_MISSION_PRESENTATIONS.find(
    (presentation) => presentation.status === "ready",
  );
}

export function getTrustedHelpMissionStatusLabel(status: unknown, isSpanish: boolean) {
  const presentation = getTrustedHelpMissionPresentation(status);
  if (!presentation) return isSpanish ? "Listo para tu OK" : "Ready for your OK";
  return isSpanish ? presentation.label.es : presentation.label.en;
}

export function getTrustedHelpPresentationStep(stepId: TrustedHelpStepId) {
  return TRUSTED_HELP_PRESENTATION_STEPS.find((step) => step.stepId === stepId);
}

export function getTrustedHelpServicePresentation(serviceId: TrustedHelpServiceId) {
  return TRUSTED_HELP_SERVICE_PRESENTATION_MAP.find(
    (service) => service.serviceId === serviceId,
  );
}

export function getTrustedHelpEntryStep(serviceId: TrustedHelpServiceId) {
  return getTrustedHelpServicePresentation(serviceId)?.entryStep;
}

export function validateTrustedHelpPresentationMap(): string[] {
  const errors: string[] = [];
  const conciergeContract = getScreenContract(TRUSTED_HELP_SCREEN_CONTRACT_ID);
  const presentationFamilyIds = new Set(
    VYVA_PRESENTATION_REGISTRY.families.map((family) => family.familyId),
  );
  const flowReferences = new Set(
    CONCIERGE_FLOW_REGISTRY.map((flow) => flow.reference),
  );
  const stepIds = new Set(TRUSTED_HELP_PRESENTATION_STEPS.map((step) => step.stepId));
  const missionStatuses = TRUSTED_HELP_ACTIVE_MISSION_PRESENTATIONS.map(
    (presentation) => presentation.status,
  );
  const missionStatusSet = new Set(missionStatuses);
  const serviceIds = TRUSTED_HELP_SERVICE_PRESENTATION_MAP.map(
    (service) => service.serviceId,
  );
  const serviceIdSet = new Set(serviceIds);

  if (!conciergeContract) {
    errors.push("Missing Concierge screen contract.");
  }

  for (const step of TRUSTED_HELP_PRESENTATION_STEPS) {
    if (step.screenContractId !== TRUSTED_HELP_SCREEN_CONTRACT_ID) {
      errors.push(`${step.stepId} must use the Concierge screen contract.`);
    }

    if (!presentationFamilyIds.has(step.presentationFamilyId)) {
      errors.push(`${step.stepId} uses an unknown presentation family.`);
    }

    if (step.chips !== "hidden") {
      errors.push(`${step.stepId} must hide chips.`);
    }
  }

  for (const service of TRUSTED_HELP_SERVICE_PRESENTATION_MAP) {
    if (!flowReferences.has(service.flowReference)) {
      errors.push(`${service.serviceId} uses an unknown Concierge flow.`);
    }

    if (service.requiresSubservice && service.entryStep !== "subservice") {
      errors.push(`${service.serviceId} must route through the type step.`);
    }

    if (!service.requiresSubservice && service.entryStep !== "provider") {
      errors.push(`${service.serviceId} must go directly to provider.`);
    }

    if (service.safetyModel !== "prepareThenConfirm") {
      errors.push(`${service.serviceId} must be confirmation-first.`);
    }
  }

  if (missionStatusSet.size !== missionStatuses.length) {
    errors.push("Trusted Help mission statuses must be unique.");
  }

  for (const presentation of TRUSTED_HELP_ACTIVE_MISSION_PRESENTATIONS) {
    if (!stepIds.has(presentation.stepId)) {
      errors.push(`${presentation.status} uses an unknown Trusted Help step.`);
    }

    if (!presentationFamilyIds.has(presentation.presentationFamilyId)) {
      errors.push(`${presentation.status} uses an unknown presentation family.`);
    }

    if (presentation.cards !== "contextual" || presentation.chips !== "hidden") {
      errors.push(`${presentation.status} must keep mission UI contextual and chip-free.`);
    }

    if (presentation.confirmationBoundary !== "finalConfirmationBeforeExternalAction") {
      errors.push(`${presentation.status} must preserve the final confirmation boundary.`);
    }

    if (
      presentation.externalActionBoundary === "externalContactInProgress" &&
      !presentation.allowedControls.includes("stop")
    ) {
      errors.push(`${presentation.status} must let the user stop live contact.`);
    }

    if (
      ["booked", "completed"].includes(presentation.status) &&
      presentation.externalActionBoundary !== "completedWithProof"
    ) {
      errors.push(`${presentation.status} must only complete with proof.`);
    }
  }

  if (serviceIdSet.has("water" as TrustedHelpServiceId)) {
    errors.push("Water must not be a top-level Trusted Help service.");
  }

  const groceries = getTrustedHelpServicePresentation("groceries");
  if (!groceries?.coverageDriven || !groceries.coverageValues.includes("Water")) {
    errors.push("Groceries must carry Water as provider coverage, not a service.");
  }

  const forbiddenTrustedHelpFlows: ConciergeFlowReference[] = [
    CONCIERGE_FLOW_REFERENCES.medicalAppointment,
    CONCIERGE_FLOW_REFERENCES.otcPharmacy,
  ];
  for (const service of TRUSTED_HELP_SERVICE_PRESENTATION_MAP) {
    if (forbiddenTrustedHelpFlows.includes(service.flowReference)) {
      errors.push(
        `${service.serviceId} must not use medical or pharmacy provider flows.`,
      );
    }
  }

  return errors;
}
