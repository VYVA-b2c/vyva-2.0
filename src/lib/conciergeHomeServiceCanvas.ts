import { Brush, KeyRound, Lightbulb, Wrench, House } from "lucide-react";
import type { VoiceCanvasViewModel } from "@/components/voice-canvas";
import type { HomeServiceType } from "../../shared/serviceIntake";

export type ConciergeHomeServiceCanvasStep =
  | "service"
  | "description"
  | "danger"
  | "emergency"
  | "safety"
  | "urgency"
  | "time"
  | "access"
  | "location"
  | "location_custom"
  | "provider"
  | "searching"
  | "options"
  | "review"
  | "waiting"
  | "completed"
  | "error";

export type ConciergeHomeServiceCanvasOption = {
  id: string;
  label: string;
  description: string;
};

export type ConciergeHomeServiceCanvasCopy = ReturnType<typeof homeServiceCanvasCopy>;

export type BuildConciergeHomeServiceCanvasInput = {
  step: ConciergeHomeServiceCanvasStep;
  copy: ConciergeHomeServiceCanvasCopy;
  serviceType: HomeServiceType | null;
  description: string;
  photoName?: string;
  photoAvailable?: boolean;
  safetyAnswer?: string;
  urgency: string;
  requestedTime: string;
  accessNotes: string;
  location: string;
  hasSavedLocation?: boolean;
  savedProviderName?: string;
  options?: ConciergeHomeServiceCanvasOption[];
  selectedOption?: ConciergeHomeServiceCanvasOption | null;
  contactChannelLabel?: string;
  photoWillBeSent?: boolean;
  error?: string | null;
};

const COPY = {
  en: {
    serviceTitle: "What kind of help do you need?", serviceHelper: "Choose one. You can change it later.",
    plumber: "Plumber", electrician: "Electrician", locksmith: "Locksmith", cleaner: "Cleaning", other: "Something else",
    descriptionTitle: "What is happening?", descriptionHelper: "Tell VYVA in your own words. A photo is optional.", descriptionLabel: "Problem", descriptionPlaceholder: "For example: water is leaking under the sink", addPhoto: "Add a photo", replacePhoto: "Replace photo", removePhoto: "Remove photo", photoReady: "Photo ready for review", photoNeedsReattach: "Add the photo again before it can be shared", continue: "Continue", back: "Back",
    dangerTitle: "Is anyone in immediate danger?", dangerHelper: "For example: fire, smoke, gas, serious flooding, injury, or being locked outside in unsafe conditions.", dangerYes: "Yes, danger now", dangerNo: "No, everyone is safe", dangerUnsure: "I am not sure", emergencyTitle: "Get urgent help now", emergencyHelper: "Do not wait for a home service provider. Contact emergency services and move away from danger if you can do so safely.", callEmergency: "Call emergency services", safeNow: "I am safe now",
    safetyTitle: "One quick safety check", safetyHelpers: { plumber: "Is water actively flooding or near electricity?", electrician: "Are there sparks, smoke, heat, or a burning smell?", locksmith: "Is anyone vulnerable locked in or outside?", cleaner: "Is there broken glass, a chemical spill, or another hazard?", other: "Is there anything unsafe that VYVA should know?" }, safetyYes: "Yes", safetyNo: "No", safetyUnsure: "Not sure",
    urgencyTitle: "How soon do you need help?", urgencyHelper: "This helps VYVA check realistic availability.", now: "Now", today: "Today", thisWeek: "This week", flexible: "I am flexible",
    timeTitle: "What time works best?", timeHelper: "Say a time or a simple window.", timeLabel: "Preferred time", timePlaceholder: "For example: tomorrow morning",
    accessTitle: "Anything the provider should know?", accessHelper: "Optional. Add access, parking, pets, stairs, or mobility notes.", accessLabel: "Access notes", accessPlaceholder: "For example: ring the side entrance bell", skip: "Skip",
    locationTitle: "Where is the visit?", locationHelper: "Use your saved home or enter another address.", savedHome: "Use my saved home", anotherAddress: "Another address", locationLabel: "Visit address", locationPlaceholder: "Enter the address",
    providerTitle: "Who should VYVA check?", providerHelper: "Use someone you trust or compare new options.", compareProviders: "Compare new providers", compareDescription: "Check availability, price, distance, and reputation", addProvider: "Add a trusted provider", savedProviderDescription: "Saved in your profile",
    searchingTitle: "Checking suitable providers", searchingHelper: "VYVA is looking for clear, reviewable information.",
    optionsTitle: "Choose an option to review", optionsHelper: "Unknown or unverified details stay clearly labelled.",
    reviewTitle: "Check what will be shared", reviewHelper: "Nothing is called, messaged, booked, or shared until you confirm.", service: "Service", problem: "Problem", urgency: "Urgency", preferredTime: "Preferred time", visitAddress: "Visit address", accessNotes: "Access notes", provider: "Provider", contactRoute: "Contact route", photo: "Photo", photoSent: "Attached to the provider email", photoNotSent: "Kept private; not sent on this route", noPhoto: "No photo", unknown: "Not provided", confirm: "Confirm and prepare contact", change: "Change details",
    waitingTitle: "Preparing the next step", waitingHelper: "VYVA is using only the details you approved.", completedTitle: "Request prepared", completedHelper: "You can follow the provider response in Right now.", errorTitle: "This step needs attention", tryAgain: "Try again",
  },
  es: {
    serviceTitle: "¿Qué tipo de ayuda necesitas?", serviceHelper: "Elige una. Puedes cambiarla después.",
    plumber: "Fontanero", electrician: "Electricista", locksmith: "Cerrajero", cleaner: "Limpieza", other: "Otro servicio",
    descriptionTitle: "¿Qué está pasando?", descriptionHelper: "Cuéntaselo a VYVA con tus palabras. La foto es opcional.", descriptionLabel: "Problema", descriptionPlaceholder: "Por ejemplo: sale agua debajo del fregadero", addPhoto: "Añadir foto", replacePhoto: "Cambiar foto", removePhoto: "Quitar foto", photoReady: "Foto lista para revisar", photoNeedsReattach: "Añade la foto de nuevo antes de poder compartirla", continue: "Continuar", back: "Volver",
    dangerTitle: "¿Hay alguien en peligro inmediato?", dangerHelper: "Por ejemplo: fuego, humo, gas, inundación grave, lesión o estar fuera de casa en condiciones inseguras.", dangerYes: "Sí, hay peligro", dangerNo: "No, todos están seguros", dangerUnsure: "No estoy seguro", emergencyTitle: "Busca ayuda urgente ahora", emergencyHelper: "No esperes a un proveedor. Contacta con emergencias y aléjate del peligro si puedes hacerlo con seguridad.", callEmergency: "Llamar a emergencias", safeNow: "Ahora estoy a salvo",
    safetyTitle: "Una comprobación de seguridad", safetyHelpers: { plumber: "¿Sale mucha agua o está cerca de electricidad?", electrician: "¿Hay chispas, humo, calor u olor a quemado?", locksmith: "¿Hay una persona vulnerable encerrada o fuera?", cleaner: "¿Hay cristales, productos químicos u otro peligro?", other: "¿Hay algo inseguro que VYVA deba saber?" }, safetyYes: "Sí", safetyNo: "No", safetyUnsure: "No estoy seguro",
    urgencyTitle: "¿Cuándo necesitas ayuda?", urgencyHelper: "Así VYVA puede comprobar disponibilidad real.", now: "Ahora", today: "Hoy", thisWeek: "Esta semana", flexible: "Soy flexible",
    timeTitle: "¿Qué hora te viene bien?", timeHelper: "Di una hora o una franja sencilla.", timeLabel: "Hora preferida", timePlaceholder: "Por ejemplo: mañana por la mañana",
    accessTitle: "¿Debe saber algo el proveedor?", accessHelper: "Opcional. Añade acceso, aparcamiento, mascotas, escaleras o movilidad.", accessLabel: "Notas de acceso", accessPlaceholder: "Por ejemplo: llamar al timbre lateral", skip: "Omitir",
    locationTitle: "¿Dónde es la visita?", locationHelper: "Usa tu casa guardada o añade otra dirección.", savedHome: "Usar mi casa guardada", anotherAddress: "Otra dirección", locationLabel: "Dirección de la visita", locationPlaceholder: "Escribe la dirección",
    providerTitle: "¿A quién debe consultar VYVA?", providerHelper: "Usa alguien de confianza o compara opciones nuevas.", compareProviders: "Comparar proveedores nuevos", compareDescription: "Comprobar disponibilidad, precio, distancia y reputación", addProvider: "Añadir proveedor de confianza", savedProviderDescription: "Guardado en tu perfil",
    searchingTitle: "Buscando proveedores adecuados", searchingHelper: "VYVA busca información clara y revisable.",
    optionsTitle: "Elige una opción para revisar", optionsHelper: "Los datos desconocidos o no verificados se muestran claramente.",
    reviewTitle: "Revisa lo que se compartirá", reviewHelper: "Nada se llama, envía, reserva ni comparte hasta que confirmes.", service: "Servicio", problem: "Problema", urgency: "Urgencia", preferredTime: "Hora preferida", visitAddress: "Dirección", accessNotes: "Acceso", provider: "Proveedor", contactRoute: "Vía de contacto", photo: "Foto", photoSent: "Adjunta al correo del proveedor", photoNotSent: "Se mantiene privada; no se envía por esta vía", noPhoto: "Sin foto", unknown: "No indicado", confirm: "Confirmar y preparar contacto", change: "Cambiar datos",
    waitingTitle: "Preparando el siguiente paso", waitingHelper: "VYVA usa solo los datos que has aprobado.", completedTitle: "Solicitud preparada", completedHelper: "Puedes seguir la respuesta en Ahora mismo.", errorTitle: "Este paso necesita atención", tryAgain: "Intentar de nuevo",
  },
} as const;

export function homeServiceCanvasCopy(locale: string) {
  return locale.toLowerCase().startsWith("es") ? COPY.es : COPY.en;
}

function progress(current: number) {
  return { current, total: 8, label: `${current} / 8` };
}

function serviceLabel(type: HomeServiceType | null, copy: ConciergeHomeServiceCanvasCopy) {
  if (type === "plumber") return copy.plumber;
  if (type === "electrician") return copy.electrician;
  if (type === "locksmith") return copy.locksmith;
  if (type === "cleaner") return copy.cleaner;
  return copy.other;
}

export function buildConciergeHomeServiceCanvasViewModel(input: BuildConciergeHomeServiceCanvasInput): VoiceCanvasViewModel {
  const { step, copy } = input;
  if (step === "service") return {
    sceneId: "home-service-type", kind: "choice", title: copy.serviceTitle, helperText: copy.serviceHelper, progress: progress(1),
    choices: [
      { id: "plumber", label: copy.plumber, icon: Wrench },
      { id: "electrician", label: copy.electrician, icon: Lightbulb },
      { id: "locksmith", label: copy.locksmith, icon: KeyRound },
      { id: "cleaner", label: copy.cleaner, icon: Brush },
      { id: "other", label: copy.other, icon: House },
    ],
  };
  if (step === "description") return {
    sceneId: "home-service-description", kind: "text-entry", title: copy.descriptionTitle, helperText: copy.descriptionHelper, progress: progress(2),
    textEntry: { label: copy.descriptionLabel, value: input.description, placeholder: copy.descriptionPlaceholder, multiline: true, maxLength: 700 },
    fileEntry: {
      label: input.photoAvailable ? copy.replacePhoto : copy.addPhoto,
      accept: "image/*",
      capture: "environment",
      fileName: input.photoAvailable ? input.photoName : undefined,
      statusLabel: input.photoAvailable ? copy.photoReady : input.photoName ? copy.photoNeedsReattach : undefined,
      removeLabel: copy.removePhoto,
    },
    primaryAction: { label: copy.continue, disabled: !input.description.trim() }, secondaryAction: { label: copy.back },
  };
  if (step === "danger") return {
    sceneId: "home-service-danger", kind: "choice", title: copy.dangerTitle, helperText: copy.dangerHelper, progress: progress(3),
    choices: [{ id: "yes", label: copy.dangerYes }, { id: "no", label: copy.dangerNo }, { id: "not_sure", label: copy.dangerUnsure }], secondaryAction: { label: copy.back },
  };
  if (step === "emergency") return {
    sceneId: "home-service-emergency", kind: "blocked", title: copy.emergencyTitle, helperText: copy.emergencyHelper, status: "blocked",
    primaryAction: { label: copy.callEmergency }, secondaryAction: { label: copy.safeNow },
  };
  if (step === "safety") return {
    sceneId: "home-service-safety", kind: "choice", title: copy.safetyTitle,
    helperText: copy.safetyHelpers[input.serviceType === "plumber" || input.serviceType === "electrician" || input.serviceType === "locksmith" || input.serviceType === "cleaner" ? input.serviceType : "other"], progress: progress(3),
    choices: [{ id: "yes", label: copy.safetyYes }, { id: "no", label: copy.safetyNo }, { id: "not_sure", label: copy.safetyUnsure }], secondaryAction: { label: copy.back },
  };
  if (step === "urgency") return {
    sceneId: "home-service-urgency", kind: "choice", title: copy.urgencyTitle, helperText: copy.urgencyHelper, progress: progress(4),
    choices: [{ id: "now", label: copy.now }, { id: "today", label: copy.today }, { id: "this_week", label: copy.thisWeek }, { id: "flexible", label: copy.flexible }], secondaryAction: { label: copy.back },
  };
  if (step === "time") return {
    sceneId: "home-service-time", kind: "text-entry", title: copy.timeTitle, helperText: copy.timeHelper, progress: progress(5),
    textEntry: { label: copy.timeLabel, value: input.requestedTime, placeholder: copy.timePlaceholder, maxLength: 160 }, primaryAction: { label: copy.continue, disabled: !input.requestedTime.trim() }, secondaryAction: { label: copy.back },
  };
  if (step === "access") return {
    sceneId: "home-service-access", kind: "text-entry", title: copy.accessTitle, helperText: copy.accessHelper, progress: progress(6),
    textEntry: { label: copy.accessLabel, value: input.accessNotes, placeholder: copy.accessPlaceholder, multiline: true, maxLength: 500 }, primaryAction: { label: copy.continue }, secondaryAction: { label: copy.skip },
  };
  if (step === "location") return {
    sceneId: "home-service-location", kind: "place", title: copy.locationTitle, helperText: copy.locationHelper, progress: progress(7),
    choices: [
      ...(input.hasSavedLocation ? [{ id: "saved_home", label: copy.savedHome }] : []),
      { id: "another_address", label: copy.anotherAddress },
    ], secondaryAction: { label: copy.back },
  };
  if (step === "location_custom") return {
    sceneId: "home-service-location-custom", kind: "text-entry", title: copy.locationTitle, helperText: copy.locationHelper, progress: progress(7),
    textEntry: { label: copy.locationLabel, value: input.location, placeholder: copy.locationPlaceholder, maxLength: 500 }, primaryAction: { label: copy.continue, disabled: !input.location.trim() }, secondaryAction: { label: copy.back },
  };
  if (step === "provider") return {
    sceneId: "home-service-provider", kind: "choice", title: copy.providerTitle, helperText: copy.providerHelper, progress: progress(8),
    choices: [
      ...(input.savedProviderName ? [{ id: "saved_provider", label: input.savedProviderName, description: copy.savedProviderDescription }] : []),
      { id: "compare_providers", label: copy.compareProviders, description: copy.compareDescription },
      ...(!input.savedProviderName ? [{ id: "add_provider", label: copy.addProvider }] : []),
    ], secondaryAction: { label: copy.back },
  };
  if (step === "searching") return { sceneId: "home-service-searching", kind: "waiting", title: copy.searchingTitle, helperText: copy.searchingHelper, status: "loading" };
  if (step === "options") return {
    sceneId: "home-service-options", kind: "choice", title: copy.optionsTitle, helperText: copy.optionsHelper,
    choices: (input.options ?? []).map((option) => ({ id: option.id, label: option.label, description: option.description })), secondaryAction: { label: copy.back },
  };
  if (step === "review") return {
    sceneId: "home-service-review", kind: "review", title: copy.reviewTitle, helperText: copy.reviewHelper,
    summaryRows: [
      { id: "service", label: copy.service, value: serviceLabel(input.serviceType, copy) },
      { id: "problem", label: copy.problem, value: input.description },
      { id: "urgency", label: copy.urgency, value: input.urgency || copy.unknown },
      { id: "time", label: copy.preferredTime, value: input.requestedTime || copy.unknown },
      { id: "location", label: copy.visitAddress, value: input.location || copy.unknown },
      { id: "access", label: copy.accessNotes, value: input.accessNotes || copy.unknown },
      { id: "provider", label: copy.provider, value: input.selectedOption?.label || input.savedProviderName || copy.unknown },
      { id: "channel", label: copy.contactRoute, value: input.contactChannelLabel || copy.unknown },
      {
        id: "photo",
        label: copy.photo,
        value: input.photoName
          ? !input.photoAvailable
            ? copy.photoNeedsReattach
            : input.photoWillBeSent
              ? copy.photoSent
              : copy.photoNotSent
          : copy.noPhoto,
      },
    ], primaryAction: { label: copy.confirm, disabled: !input.selectedOption }, secondaryAction: { label: copy.change },
  };
  if (step === "waiting") return { sceneId: "home-service-waiting", kind: "waiting", title: copy.waitingTitle, helperText: copy.waitingHelper, status: "loading" };
  if (step === "completed") return { sceneId: "home-service-completed", kind: "completed", title: copy.completedTitle, helperText: copy.completedHelper, status: "success" };
  return { sceneId: "home-service-error", kind: "blocked", title: copy.errorTitle, helperText: input.error || undefined, status: "blocked", primaryAction: { label: copy.tryAgain }, secondaryAction: { label: copy.change } };
}
