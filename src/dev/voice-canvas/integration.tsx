import { useCallback, useState } from "react";
import {
  RideVoiceCanvas,
  type RideCanvasCopy,
  type RideCanvasState,
} from "../../components/voice-canvas";
import "./gallery.css";
import "./integration.css";

const englishCopy: RideCanvasCopy = {
  agentPresence: {
    idleLabel: "VYVA is ready",
    idleDescription: "You can speak or use the screen.",
    listeningLabel: "Listening with you",
    listeningDescription: "Say or tap a ride detail.",
    speakingLabel: "VYVA is speaking",
    speakingDescription: "The screen stays on the same step.",
    thinkingLabel: "Checking ride options",
    thinkingDescription: "VYVA is keeping the ride details visible.",
    accessibleLabel: "VYVA ride voice status",
  },
  listening: {
    status: "Listening",
    title: "Where can I help you go?",
    helper: "Use your voice or choose the button below.",
    start: "Arrange a ride",
    cancel: "Not now",
  },
  place: {
    title: "Where would you like to go?",
    helper: "Choose a saved place or enter somewhere new.",
    newAddress: "A new address",
    newAddressHelper: "Tell VYVA where you are going",
    continue: "Continue",
    back: "Go back",
  },
  provider: {
    title: "Which ride option looks best?",
    helper: "Compare estimate, reputation, and available help before choosing.",
    back: "Go back",
  },
  details: {
    savedPlace: "Saved place",
    newAddress: "New destination",
    provider: "Ride company",
    estimatedPickup: "Estimated pickup",
    estimatedArrival: "Estimated arrival",
    estimatedPrice: "Estimated price",
    reputation: "Reputation",
    accessibility: "Accessibility",
    recommended: "Recommended",
  },
  address: {
    title: "What address should we use?",
    helper: "Type the full address or just the postcode.",
    label: "Destination address",
    placeholder: "Start typing an address",
    continue: "Continue",
    back: "Go back",
  },
  dateTime: {
    title: "When should the ride arrive?",
    helper: "Choose the day first, then the time.",
    timeLabel: "Pickup time",
    continue: "Review the ride",
    back: "Go back",
  },
  review: {
    title: "Does everything look right?",
    helper: "Nothing will be requested until you confirm.",
    destination: "Destination",
    provider: "Ride option",
    date: "Date",
    time: "Time",
    confirm: "Confirm and prepare ride",
    change: "Make a change",
  },
  waiting: {
    status: "Please wait",
    title: "Preparing your ride request",
    helper: "This may take a moment. Please stay on this screen.",
    action: "Preparing...",
  },
  completed: {
    status: "Completed",
    title: "Your ride request is ready",
    helper: "The confirmed request has been prepared.",
    reference: "Reference",
    done: "Done",
  },
  blocked: {
    status: "Needs attention",
    title: "We could not prepare the ride",
    helper: "Please review the details and try again.",
    retry: "Review and retry",
    cancel: "Cancel",
  },
  cancelled: {
    status: "Cancelled",
    title: "No ride was requested",
    helper: "Your details have not been sent anywhere.",
    restart: "Start again",
  },
  progress: (current, total) => `Step ${current} of ${total}`,
};

const spanishCopy: RideCanvasCopy = {
  agentPresence: {
    idleLabel: "VYVA lista",
    idleDescription: "Puedes hablar o tocar la pantalla.",
    listeningLabel: "Escuchando contigo",
    listeningDescription: "Di o toca un detalle del viaje.",
    speakingLabel: "VYVA está hablando",
    speakingDescription: "La pantalla sigue en el mismo paso.",
    thinkingLabel: "Revisando opciones de viaje",
    thinkingDescription: "VYVA mantiene los detalles visibles.",
    accessibleLabel: "Estado de voz de VYVA para el viaje",
  },
  listening: {
    status: "Escuchando",
    title: "¿Adónde te ayudo a ir?",
    helper: "Habla o usa el botón para continuar.",
    start: "Preparar un viaje",
    cancel: "Ahora no",
  },
  place: {
    title: "¿Adónde quieres ir?",
    helper: "Elige un lugar guardado o escribe uno nuevo.",
    newAddress: "Una dirección nueva",
    newAddressHelper: "Dile a VYVA adónde vas",
    continue: "Continuar",
    back: "Volver",
  },
  provider: {
    title: "¿Que opcion de viaje prefieres?",
    helper: "Compara estimacion, reputacion y ayuda disponible antes de elegir.",
    back: "Volver",
  },
  details: {
    savedPlace: "Lugar guardado",
    newAddress: "Nuevo destino",
    provider: "Empresa de viaje",
    estimatedPickup: "Recogida estimada",
    estimatedArrival: "Llegada estimada",
    estimatedPrice: "Precio estimado",
    reputation: "Reputacion",
    accessibility: "Accesibilidad",
    recommended: "Recomendada",
  },
  address: {
    title: "¿Qué dirección usamos?",
    helper: "Escribe la dirección completa o el código postal.",
    label: "Dirección de destino",
    placeholder: "Empieza a escribir una dirección",
    continue: "Continuar",
    back: "Volver",
  },
  dateTime: {
    title: "¿Cuándo debe llegar?",
    helper: "Elige primero el día y luego la hora.",
    timeLabel: "Hora de recogida",
    continue: "Revisar el viaje",
    back: "Volver",
  },
  review: {
    title: "¿Está todo correcto?",
    helper: "No se solicita nada hasta que confirmes.",
    destination: "Destino",
    provider: "Opcion de viaje",
    date: "Día",
    time: "Hora",
    confirm: "Confirmar y preparar el viaje de forma segura",
    change: "Cambiar un dato",
  },
  waiting: {
    status: "Espera un momento",
    title: "Preparando tu solicitud",
    helper: "Puede tardar un momento.",
    action: "Preparando...",
  },
  completed: {
    status: "Completado",
    title: "La solicitud está preparada",
    helper: "Revisa el siguiente paso en Ahora mismo.",
    reference: "Referencia",
    done: "Terminar",
  },
  blocked: {
    status: "Necesita atención",
    title: "No pudimos preparar el viaje",
    helper: "Revisa los datos e inténtalo otra vez.",
    retry: "Revisar los detalles e intentarlo otra vez",
    cancel: "Cancelar",
  },
  cancelled: {
    status: "Cancelado",
    title: "No se solicitó ningún viaje",
    helper: "Tus datos no se enviaron a nadie.",
    restart: "Empezar otra vez",
  },
  progress: (current, total) => `Paso ${current} de ${total}`,
};

export function VoiceCanvasIntegrationGallery() {
  const [mode, setMode] = useState<"success" | "failure">("success");
  const params = new URLSearchParams(window.location.search);
  const startsAtReview = params.has("review");
  const isSpanish = params.get("locale") === "es";
  const evidenceSafe = params.get("evidence") === "sanitized";
  const copy = isSpanish ? spanishCopy : englishCopy;
  const reviewState: RideCanvasState = {
    step: "review",
    requestId: 0,
    draft: {
      placeId: "home",
      destination: evidenceSafe ? "Saved destination option" : "12 Garden Lane",
      providerId: "carecab",
      providerName: evidenceSafe ? "Selected ride option" : "CareCab",
      dateChoice: evidenceSafe ? "Selected day" : "Saturday, 18 July",
      time: evidenceSafe ? "Selected time" : "10:30",
    },
  };
  const confirm = useCallback(
    async (_: unknown, { signal }: { signal: AbortSignal }) =>
      new Promise<{ reference?: string }>((resolve, reject) => {
        const timer = window.setTimeout(
          () =>
            mode === "success"
              ? resolve({ reference: "VYVA-RIDE-2486" })
              : reject(new Error("The ride service is unavailable right now.")),
          700,
        );
        signal.addEventListener("abort", () => {
          window.clearTimeout(timer);
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
    [mode],
  );
  const places = evidenceSafe
    ? isSpanish
      ? [
          { id: "home", label: "Destino guardado", address: "Opción guardada" },
          {
            id: "clinic",
            label: "Destino guardado con una etiqueta traducida especialmente larga",
            address: "Opción guardada",
          },
        ]
      : [
          { id: "home", label: "Saved destination", address: "Saved option" },
          {
            id: "clinic",
            label: "Saved destination with an intentionally long label",
            address: "Saved option",
          },
        ]
    : isSpanish
      ? [
          { id: "home", label: "Casa", address: "12 Calle del Jardín" },
          {
            id: "clinic",
            label: "Centro médico y de bienestar Riverside",
            address: "24 Avenida Riverside",
          },
        ]
      : [
          { id: "home", label: "Home", address: "12 Garden Lane" },
          { id: "clinic", label: "Riverside Medical Centre", address: "24 Riverside Road" },
        ];
  const providers = evidenceSafe
    ? isSpanish
      ? [
          {
            id: "carecab",
            label: "Opción de viaje seleccionada",
            subtitle: "Reputación visible",
            description: "Sin acción externa antes de confirmar",
            pickupEstimate: { value: "8-12 min", tone: "good" as const },
            priceEstimate: { value: "Rango visible antes de confirmar" },
            reputation: { value: "Señal de reputación", tone: "good" as const },
            accessibilityNote: { value: "Nota de accesibilidad visible", tone: "good" as const },
            recommended: true,
          },
          {
            id: "cityride",
            label: "Empresa de viaje con una etiqueta traducida especialmente larga",
            subtitle: "Precio estimado menor",
            pickupEstimate: { value: "13 min" },
            priceEstimate: { value: "Otra estimación" },
            reputation: { value: "Señal alternativa" },
          },
        ]
      : [
          {
            id: "carecab",
            label: "Selected ride option",
            subtitle: "Visible reputation",
            description: "No external action before confirmation",
            pickupEstimate: { value: "8-12 min", tone: "good" as const },
            priceEstimate: { value: "Visible range before confirmation" },
            reputation: { value: "Reputation signal", tone: "good" as const },
            accessibilityNote: { value: "Accessibility note visible", tone: "good" as const },
            recommended: true,
          },
          {
            id: "cityride",
            label: "Ride company with an intentionally long translated label",
            subtitle: "Lower estimated price",
            pickupEstimate: { value: "13 min" },
            priceEstimate: { value: "Another estimate" },
            reputation: { value: "Alternative signal" },
          },
        ]
    : isSpanish
      ? [
          {
            id: "carecab",
            label: "CareCab",
            subtitle: "Mejor reputación",
            description: "Buena opción para citas",
            pickupEstimate: { value: "8 min", tone: "good" as const },
            arrivalEstimate: { value: "10:48" },
            priceEstimate: { value: "12-16 €" },
            reputation: { value: "4.9 / 5", tone: "good" as const },
            accessibilityNote: { value: "Ayuda de movilidad bajo petición", tone: "good" as const },
            recommended: true,
          },
          {
            id: "cityride",
            label: "CityRide",
            subtitle: "Precio estimado menor",
            description: "Coche estándar",
            pickupEstimate: { value: "13 min" },
            arrivalEstimate: { value: "10:55" },
            priceEstimate: { value: "10-14 €", tone: "good" as const },
            reputation: { value: "4.4 / 5" },
          },
        ]
      : [
          {
            id: "carecab",
            label: "CareCab",
            subtitle: "Best reputation",
            description: "Good for appointments",
            pickupEstimate: { value: "8 min", tone: "good" as const },
            arrivalEstimate: { value: "10:48 AM" },
            priceEstimate: { value: "$12-$16" },
            reputation: { value: "4.9 / 5", tone: "good" as const },
            accessibilityNote: { value: "Wheelchair-friendly on request", tone: "good" as const },
            recommended: true,
          },
          {
            id: "cityride",
            label: "CityRide",
            subtitle: "Lower estimated price",
            description: "Standard car",
            pickupEstimate: { value: "13 min" },
            arrivalEstimate: { value: "10:55 AM" },
            priceEstimate: { value: "$10-$14", tone: "good" as const },
            reputation: { value: "4.4 / 5" },
          },
        ];
  const dates = evidenceSafe
    ? isSpanish
      ? [
          { id: "today", label: "Día seleccionado", value: "día seleccionado" },
          { id: "tomorrow", label: "Otra opción de día", value: "otra opción de día" },
        ]
      : [
          { id: "today", label: "Selected day", value: "selected day" },
          { id: "tomorrow", label: "Another day option", value: "another day option" },
        ]
    : isSpanish
      ? [
          { id: "today", label: "Hoy", value: "sábado, 18 de julio" },
          { id: "tomorrow", label: "Mañana", value: "domingo, 19 de julio" },
        ]
      : [
          { id: "today", label: "Today", value: "Saturday, 18 July" },
          { id: "tomorrow", label: "Tomorrow", value: "Sunday, 19 July" },
        ];
  const commands = isSpanish
    ? {
        start: ["preparar un viaje"],
        back: ["volver"],
        cancel: ["cancelar"],
        confirm: ["confirmar"],
        retry: ["intentar otra vez"],
      }
    : {
        start: ["arrange a ride"],
        back: ["go back"],
        cancel: ["cancel"],
        confirm: ["confirm"],
        retry: ["retry"],
      };

  return (
    <main className="vc-gallery vc-integration-gallery">
      <header>
        <p>VYVA · Integration v1</p>
        <h1>Live Companion Canvas</h1>
        <span>Safe ride workflow · voice, touch, and keyboard</span>
      </header>
      <div className="vc-demo-toolbar" role="group" aria-label="Result simulation">
        <button
          type="button"
          aria-pressed={mode === "success"}
          onClick={() => setMode("success")}
        >
          Successful result
        </button>
        <button
          type="button"
          aria-pressed={mode === "failure"}
          onClick={() => setMode("failure")}
        >
          Blocked result
        </button>
      </div>
      <div className="vc-gallery-stage">
        <RideVoiceCanvas
          copy={copy}
          places={places}
          providers={providers}
          dateChoices={dates}
          voiceCommands={commands}
          onConfirmRide={confirm}
          initialState={startsAtReview ? reviewState : undefined}
          storageKey={`${
            startsAtReview ? "vyva.rideCanvas.reviewDemo" : "vyva.rideCanvas.gallery"
          }${window.location.search}`}
        />
      </div>
    </main>
  );
}

export default VoiceCanvasIntegrationGallery;
