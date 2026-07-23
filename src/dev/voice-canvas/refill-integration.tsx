import { useCallback, useState } from "react";
import {
  RefillVoiceCanvas,
  type RefillCanvasCopy,
} from "../../components/voice-canvas";
import "./gallery.css";
import "./integration.css";

const en: RefillCanvasCopy = {
  agentPresence: {
    idleLabel: "VYVA is ready",
    idleDescription: "You can speak or use the screen.",
    listeningLabel: "Listening with you",
    listeningDescription: "You can say the medication or tap a card.",
    speakingLabel: "VYVA is speaking",
    speakingDescription: "The screen will stay on the same step.",
    thinkingLabel: "Checking refill details",
    thinkingDescription: "VYVA is keeping the safe refill boundary visible.",
    accessibleLabel: "VYVA refill voice status",
  },
  listening: {
    status: "Listening",
    title: "Let's prepare your medication refill",
    helper: "Use voice, touch, or keyboard.",
    start: "Start",
    cancel: "Not now",
  },
  medication: {
    title: "Which medication?",
    helper: "Choose a saved medication or enter it exactly as shown on the label.",
    manual: "A different medication",
    manualHelper: "Enter the medication name",
    cannotIdentify: "I cannot identify it",
    cannotIdentifyHelper: "Pause and check the package or ask a pharmacist",
    back: "Go back",
  },
  medicationEntry: {
    title: "What is the medication name?",
    helper: "Copy the exact name from the label.",
    label: "Medication name",
    placeholder: "Medication name",
    continue: "Continue",
    cannotIdentify: "I cannot identify it",
    back: "Go back",
  },
  strength: {
    title: "What strength is shown?",
    helper: "Copy the strength exactly. VYVA will not infer it.",
    label: "Strength",
    placeholder: "For example, 500 mg",
    continue: "Continue",
    back: "Go back",
  },
  safety: {
    title: "Is this a routine refill?",
    helper: "Choose urgent help for a severe reaction, overdose, or time-critical need.",
    routine: "Routine refill",
    routineHelper: "Continue preparing the request",
    urgent: "I need urgent help",
    urgentHelper: "See safe options; VYVA will not call anyone automatically",
    back: "Go back",
  },
  provider: {
    title: "Which prescriber or pharmacy?",
    helper: "Choose a saved option or enter another.",
    manual: "A different prescriber or pharmacy",
    manualHelper: "Enter the name",
    back: "Go back",
  },
  providerEntry: {
    title: "Who should handle this refill?",
    helper: "Enter a prescriber or pharmacy.",
    label: "Prescriber or pharmacy",
    placeholder: "Name",
    continue: "Continue",
    back: "Go back",
  },
  quantity: {
    title: "How much do you need?",
    helper: "Enter the refill quantity or supply shown in your records.",
    label: "Quantity or supply",
    placeholder: "For example, 30 days",
    continue: "Continue",
    back: "Go back",
  },
  notes: {
    title: "Any notes to include?",
    helper: "Optional. Do not include urgent symptoms here.",
    label: "Notes",
    placeholder: "Optional notes",
    continue: "Continue",
    back: "Go back",
  },
  contact: {
    title: "How would you prefer to be contacted?",
    helper: "This preference is prepared only; no message or call is made.",
    back: "Go back",
  },
  details: {
    savedProfile: "Saved profile",
    strength: "Strength",
    providerType: "Provider type",
    quantity: "Quantity or supply",
    routineBoundary: "Routine refill only",
    urgentBoundary: "Urgent issue stops this flow",
    noDosingChanges: "No dosing changes",
    reviewBeforeAction: "Review before action",
    manualEntry: "Manual entry",
    recommended: "Recommended",
  },
  review: {
    title: "Review refill preparation",
    helper: "Nothing is ordered, approved, sent, or written until you confirm.",
    medication: "Medication",
    strength: "Strength",
    provider: "Prescriber or pharmacy",
    quantity: "Quantity or supply",
    notes: "Notes",
    contact: "Preferred contact",
    noNotes: "None",
    confirm: "Confirm and prepare",
    change: "Make a change",
  },
  waiting: {
    status: "Please wait",
    title: "Preparing the refill record",
    helper: "No refill has been ordered or approved.",
    action: "Preparing...",
  },
  completed: {
    status: "Completed",
    title: "Refill preparation is ready",
    helper: "This is a preparation record, not an order or approval.",
    reference: "Reference",
    done: "Done",
  },
  blocked: {
    status: "Needs information",
    title: "We could not prepare the refill",
    helper: "Review the details and try again.",
    identificationTitle: "Medication must be identified",
    identificationHelper: "Check the package or ask a pharmacist before continuing.",
    retry: "Review and retry",
    cancel: "Cancel",
  },
  urgent: {
    status: "Urgent help",
    title: "Get urgent medication help",
    helper:
      "For a severe reaction or overdose, contact local emergency services now. VYVA will not call automatically.",
    primary: "Open urgent-help options",
    secondary: "Go back",
  },
  cancelled: {
    status: "Cancelled",
    title: "Nothing was prepared",
    helper: "No details were sent or saved.",
    restart: "Start again",
  },
  progress: (a, b) => `Step ${a} of ${b}`,
};

const es: RefillCanvasCopy = {
  ...en,
  agentPresence: {
    idleLabel: "VYVA lista",
    idleDescription: "Puedes hablar o tocar la pantalla.",
    listeningLabel: "Escuchando contigo",
    listeningDescription: "Puedes decir el medicamento o tocar una tarjeta.",
    speakingLabel: "VYVA está hablando",
    speakingDescription: "La pantalla seguirá en el mismo paso.",
    thinkingLabel: "Revisando la renovación",
    thinkingDescription: "VYVA mantiene visible el límite seguro de la renovación.",
    accessibleLabel: "Estado de voz de VYVA para la renovación",
  },
  listening: {
    status: "Escuchando",
    title: "Preparemos la renovación de tu medicamento",
    helper: "Usa voz, pantalla táctil o teclado.",
    start: "Empezar",
    cancel: "Ahora no",
  },
  medication: {
    title: "¿Qué medicamento?",
    helper: "Elige uno guardado o escribe exactamente lo que aparece en la etiqueta.",
    manual: "Un medicamento diferente",
    manualHelper: "Escribe el nombre del medicamento",
    cannotIdentify: "No puedo identificarlo",
    cannotIdentifyHelper: "Pausa y revisa el envase o consulta a una farmacia",
    back: "Volver",
  },
  review: {
    ...en.review,
    title: "Revisa la preparación de renovación del medicamento",
    helper: "Nada se solicita, aprueba, envía ni registra hasta que confirmes.",
    confirm: "Confirmar y preparar la solicitud de renovación",
    change: "Cambiar un dato",
  },
  details: {
    savedProfile: "Guardado en el perfil",
    strength: "Concentración",
    providerType: "Tipo de proveedor",
    quantity: "Cantidad o suministro",
    routineBoundary: "Solo renovación rutinaria",
    urgentBoundary: "Si es urgente, este flujo se detiene",
    noDosingChanges: "Sin cambios de dosis",
    reviewBeforeAction: "Revisar antes de actuar",
    manualEntry: "Entrada manual",
    recommended: "Recomendado",
  },
  progress: (a, b) => `Paso ${a} de ${b}`,
};

export default function Gallery() {
  const [failure, setFailure] = useState(false);
  const params = new URLSearchParams(location.search);
  const spanish = params.get("locale") === "es";
  const evidenceSafe = params.get("evidence") === "sanitized";
  const confirm = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (failure) throw new Error("The preparation service is temporarily unavailable.");
    return { reference: "VYVA-REFILL-2486" };
  }, [failure]);

  const medications = evidenceSafe
    ? [
        {
          id: "saved",
          label: spanish ? "Opción guardada A" : "Saved option A",
          description: spanish
            ? "Etiqueta de demostración"
            : "Demonstration label",
          savedLabel: spanish ? "Medicamento guardado" : "Saved medication",
          profileLabel: spanish ? "Perfil de demostración" : "Demonstration profile",
          reviewReminder: spanish ? "Revisar antes de actuar" : "Review before action",
          recommended: true,
        },
        {
          id: "long",
          label: spanish
            ? "Opción guardada con una etiqueta traducida especialmente extensa"
            : "Saved option with an intentionally long label",
          description: spanish
            ? "Etiqueta de demostración"
            : "Demonstration label",
          savedLabel: spanish ? "Medicamento guardado" : "Saved medication",
          profileLabel: spanish ? "Perfil de demostración" : "Demonstration profile",
          reviewReminder: spanish ? "Revisar antes de actuar" : "Review before action",
        },
      ]
    : [
        {
          id: "metformin",
          label: "Metformin",
          strength: "500 mg",
          description: "Saved medication",
          savedLabel: "Saved medication",
          profileLabel: "Medication profile",
          reviewReminder: "Review before action",
          recommended: true,
        },
        {
          id: "long",
          label: spanish
            ? "Hidroclorotiazida con una descripción traducida especialmente extensa"
            : "Atorvastatin",
          strength: "20 mg",
          description: spanish
            ? "Medicamento guardado en tu perfil"
            : "Saved medication",
          savedLabel: spanish ? "Medicamento guardado" : "Saved medication",
          profileLabel: spanish ? "Perfil de medicación" : "Medication profile",
          reviewReminder: spanish ? "Revisar antes de actuar" : "Review before action",
        },
      ];
  const providers = evidenceSafe
    ? [
        {
          id: "saved-care",
          label: spanish
            ? "Opción de atención guardada con nombre especialmente largo"
            : "Saved care option",
          kind: "prescriber" as const,
          description: spanish ? "Etiqueta de demostración" : "Demonstration label",
          typeLabel: spanish ? "Prescriptor" : "Prescriber",
          reviewReminder: spanish ? "Revisar antes de actuar" : "Review before action",
          recommended: true,
        },
      ]
    : [
        {
          id: "gp",
          label: spanish
            ? "Centro de salud y bienestar comunitario con nombre especialmente largo"
            : "Dr Garcia",
          kind: "prescriber" as const,
          description: "Saved prescriber",
          typeLabel: spanish ? "Prescriptor" : "Prescriber",
          reviewReminder: spanish ? "Revisar antes de actuar" : "Review before action",
          recommended: true,
        },
        {
          id: "pharmacy",
          label: "Riverside Pharmacy",
          kind: "pharmacy" as const,
          description: "Saved pharmacy",
          typeLabel: spanish ? "Farmacia" : "Pharmacy",
          reviewReminder: spanish ? "Revisar antes de actuar" : "Review before action",
        },
      ];

  return (
    <main className="vc-gallery vc-integration-gallery">
      <header>
        <p>VYVA · Medication Refill Canvas</p>
        <h1>Medication refill preparation</h1>
        <span>Preparation only · no order, approval, contact, or data write before confirmation</span>
      </header>
      <div className="vc-demo-toolbar">
        <button onClick={() => setFailure(false)}>Successful result</button>
        <button onClick={() => setFailure(true)}>Blocked result</button>
      </div>
      <div className="vc-gallery-stage">
        <RefillVoiceCanvas
          copy={spanish ? es : en}
          medications={medications}
          providers={providers}
          contactChoices={[
            { id: "phone", label: spanish ? "Llamada telefónica" : "Phone call", reviewReminder: spanish ? "Revisar antes de actuar" : "Review before action" },
            { id: "message", label: spanish ? "Mensaje de texto" : "Text message", reviewReminder: spanish ? "Revisar antes de actuar" : "Review before action" },
          ]}
          voiceCommands={{
            start: ["start", "empezar"],
            back: ["back", "volver"],
            cancel: ["cancel", "cancelar"],
            confirm: ["confirm", "confirmar"],
            retry: ["retry", "reintentar"],
            routine: ["routine refill", "renovación habitual"],
            urgent: ["urgent help", "ayuda urgente"],
          }}
          urgentTerms={["overdose", "severe reaction", "sobredosis", "reacción grave"]}
          onConfirmPrepare={confirm}
          onUrgentHelp={() => {}}
          storageKey={`refill-gallery-${spanish}-${evidenceSafe}`}
        />
      </div>
    </main>
  );
}
