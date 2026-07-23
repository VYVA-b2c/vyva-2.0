import { useCallback, useState } from "react";
import {
  ProviderReplyVoiceCanvas,
  type ProviderReplyCanvasCopy,
  type ProviderReplyCanvasState,
} from "../../components/voice-canvas";
import "./gallery.css";
import "./integration.css";

const en: ProviderReplyCanvasCopy = {
  agentPresence: {
    idleLabel: "VYVA is ready",
    idleDescription: "You can speak or use the screen.",
    listeningLabel: "Listening with you",
    listeningDescription: "You can say the reply intent or tap a card.",
    speakingLabel: "VYVA is speaking",
    speakingDescription: "The screen will stay on the same step.",
    thinkingLabel: "Checking provider reply details",
    thinkingDescription: "VYVA is keeping the draft-only boundary visible.",
    accessibleLabel: "VYVA provider reply voice status",
  },
  listening: {
    status: "Listening",
    title: "Review the provider reply",
    helper: "Use voice, touch, or keyboard.",
    start: "Start",
    cancel: "Not now",
  },
  context: {
    title: "Provider context",
    helper: "Check the task before saving anything.",
    provider: "Provider",
    providerType: "Provider type",
    action: "Task",
    waiting: "Waiting",
    continue: "Continue",
    back: "Back",
  },
  reply: {
    title: "What did they say?",
    helper: "Record only the provider reply.",
    label: "Provider reply",
    placeholder: "The provider confirmed...",
    continue: "Continue",
    back: "Back",
  },
  scheduledFor: {
    title: "When is it scheduled?",
    helper: "A date and time is needed for Scheduled Support.",
    label: "Confirmed date and time",
    continue: "Continue",
    back: "Back",
  },
  details: {
    title: "Any note for VYVA?",
    helper: "Optional.",
    label: "Notes",
    placeholder: "Optional note",
    continue: "Review",
    back: "Back",
  },
  review: {
    title: "Review before saving",
    helper: "This saves the reply, but does not complete the task.",
    provider: "Provider",
    intent: "Reply intent",
    action: "Task",
    reply: "Reply",
    scheduledFor: "Scheduled for",
    notes: "Notes",
    noNotes: "None",
    save: "Save reply",
    back: "Back",
  },
  saving: {
    status: "Saving",
    title: "Saving the reply",
    helper: "No external message is sent.",
    action: "Saving...",
  },
  saved: {
    status: "Saved",
    title: "Reply saved",
    helper: "Now you can mark the task complete.",
    reference: "Reference",
    markComplete: "Mark complete",
    edit: "Edit reply",
  },
  completing: {
    status: "Completing",
    title: "Completing the task",
    helper: "Please wait.",
    action: "Completing...",
  },
  completed: {
    status: "Completed",
    title: "Task complete",
    helper: "The saved reply is in history.",
    reference: "Reference",
    done: "Done",
  },
  blocked: {
    status: "Needs attention",
    title: "Needs attention",
    helper: "Review and try again.",
    missingContextHelper: "Provider context is missing.",
    incompleteReplyHelper: "Add the provider reply before continuing.",
    incompleteScheduledForHelper: "Add a valid date and time before continuing.",
    urgentBoundaryHelper: "This may need urgent help. No message was sent.",
    retry: "Retry",
    cancel: "Cancel",
  },
  cancelled: {
    status: "Cancelled",
    title: "Nothing saved",
    helper: "The reply was not saved.",
    restart: "Start again",
  },
  detailLabels: {
    messagePurpose: "Message purpose",
    providerType: "Provider type",
    confidence: "Confidence",
    reviewNeeded: "Review needed",
    draftOnly: "Draft only",
    noMessageSent: "No message sent yet",
    reviewBeforeSend: "Review before send",
    recommended: "Recommended",
    urgentBoundary: "Urgent safety boundary",
    outgoingDraft: "Outgoing draft",
    editBeforeSend: "You can edit before anything is saved.",
  },
  progress: (current, total) => `Step ${current} of ${total}`,
};

const es: ProviderReplyCanvasCopy = {
  ...en,
  agentPresence: {
    idleLabel: "VYVA lista",
    idleDescription: "Puedes hablar o tocar la pantalla.",
    listeningLabel: "Escuchando contigo",
    listeningDescription: "Puedes decir la intención de respuesta o tocar una tarjeta.",
    speakingLabel: "VYVA está hablando",
    speakingDescription: "La pantalla seguirá en el mismo paso.",
    thinkingLabel: "Revisando la respuesta",
    thinkingDescription: "VYVA mantiene visible el límite de solo borrador.",
    accessibleLabel: "Estado de voz de VYVA para la respuesta del proveedor",
  },
  listening: {
    status: "Escuchando",
    title: "Revisemos la respuesta",
    helper: "Usa voz, pantalla o teclado.",
    start: "Empezar",
    cancel: "Ahora no",
  },
  context: {
    ...en.context,
    title: "Contexto del proveedor",
    helper: "Comprueba la tarea antes de guardar nada.",
    provider: "Proveedor",
    providerType: "Tipo de proveedor",
    action: "Tarea",
    waiting: "Espera",
    continue: "Continuar",
    back: "Volver",
  },
  reply: {
    ...en.reply,
    title: "Que dijeron?",
    helper: "Guarda solo la respuesta del proveedor.",
    label: "Respuesta del proveedor",
    placeholder: "El proveedor confirmo...",
    continue: "Continuar",
    back: "Volver",
  },
  scheduledFor: {
    ...en.scheduledFor,
    title: "Cuando esta programado?",
    helper: "Hace falta fecha y hora para guardar esto en Scheduled Support.",
    label: "Fecha y hora confirmadas",
    continue: "Continuar",
    back: "Volver",
  },
  details: {
    ...en.details,
    title: "Alguna nota para VYVA?",
    helper: "Opcional.",
    label: "Notas",
    placeholder: "Nota opcional",
    continue: "Revisar",
    back: "Volver",
  },
  review: {
    ...en.review,
    title: "Revisa antes de guardar",
    helper: "Esto guarda la respuesta, pero no completa la tarea.",
    provider: "Proveedor",
    intent: "Intencion de respuesta",
    action: "Tarea",
    reply: "Respuesta",
    scheduledFor: "Programado para",
    notes: "Notas",
    noNotes: "Ninguna",
    save: "Guardar respuesta",
    back: "Volver",
  },
  saved: {
    ...en.saved,
    status: "Guardada",
    title: "Respuesta guardada",
    helper: "Ahora puedes marcar la tarea como hecha.",
    reference: "Referencia",
    markComplete: "Marcar completado",
    edit: "Editar respuesta",
  },
  completed: {
    ...en.completed,
    status: "Completado",
    title: "Tarea completada",
    helper: "La respuesta guardada queda en el historial.",
    reference: "Referencia",
    done: "Terminar",
  },
  blocked: {
    ...en.blocked,
    status: "Necesita atencion",
    title: "Necesita atencion",
    helper: "Revisa e intentalo otra vez.",
    missingContextHelper: "Falta el contexto del proveedor.",
    incompleteReplyHelper: "Anade la respuesta del proveedor antes de continuar.",
    incompleteScheduledForHelper: "Anade una fecha y hora validas antes de continuar.",
    urgentBoundaryHelper: "Esto puede necesitar ayuda urgente. No se envio ningun mensaje.",
    retry: "Reintentar",
    cancel: "Cancelar",
  },
  detailLabels: {
    messagePurpose: "Proposito del mensaje",
    providerType: "Tipo de proveedor",
    confidence: "Confianza",
    reviewNeeded: "Revisar",
    draftOnly: "Solo borrador",
    noMessageSent: "No se envio ningun mensaje",
    reviewBeforeSend: "Revisar antes de enviar",
    recommended: "Recomendado",
    urgentBoundary: "Limite de seguridad urgente",
    outgoingDraft: "Borrador saliente",
    editBeforeSend: "Puedes editar antes de guardar nada.",
  },
  progress: (current, total) => `Paso ${current} de ${total}`,
};

const reviewState: ProviderReplyCanvasState = {
  step: "review",
  requestId: 0,
  revision: 0,
  draft: {
    replyIntentId: "confirm-appointment",
    replyIntentLabel: "Confirm appointment",
    providerReply: "Confirmed Friday at 10:30. Reference HC-908.",
    scheduledFor: "",
    notes: "Bring insurance card.",
  },
};

const sanitizedReviewState: ProviderReplyCanvasState = {
  step: "review",
  requestId: 0,
  revision: 0,
  draft: {
    replyIntentId: "confirm-appointment",
    replyIntentLabel: "Confirm appointment",
    providerReply: "Sanitized reply summary ready for review.",
    scheduledFor: "",
    notes: "Sanitized note placeholder.",
  },
};

export default function ProviderReplyGallery() {
  const [mode, setMode] = useState<"success" | "failure">("success");
  const [scheduled, setScheduled] = useState(false);
  const params = new URLSearchParams(location.search);
  const spanish = params.get("locale") === "es";
  const startsAtReview = params.get("scene") === "review";
  const evidenceSafe = params.get("evidence") === "sanitized";
  const save = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (mode === "failure") throw new Error(spanish ? "No se pudo guardar." : "Could not save.");
    return { summary: spanish ? "Respuesta guardada." : "Reply saved.", reference: "PR-2048" };
  }, [mode, spanish]);
  const complete = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (mode === "failure") throw new Error(spanish ? "No se pudo completar." : "Could not complete.");
    return { reference: "DONE-2048" };
  }, [mode, spanish]);

  return (
    <main className="vc-gallery vc-integration-gallery">
      <header>
        <p>VYVA - Provider Reply Canvas</p>
        <h1>{spanish ? "Respuesta del proveedor" : "Provider reply flow"}</h1>
        <span>{spanish ? "Guardar primero. Completar despues." : "Save first. Complete separately."}</span>
      </header>
      <div className="vc-demo-toolbar" role="group" aria-label="Provider reply simulation">
        <button type="button" aria-pressed={mode === "success"} onClick={() => setMode("success")}>Successful result</button>
        <button type="button" aria-pressed={mode === "failure"} onClick={() => setMode("failure")}>Blocked result</button>
        <button type="button" aria-pressed={scheduled} onClick={() => setScheduled((value) => !value)}>Needs date/time</button>
      </div>
      <div className="vc-gallery-stage">
        <ProviderReplyVoiceCanvas
          copy={spanish ? es : en}
          context={{
            providerName: evidenceSafe
              ? spanish
                ? "Opción guardada con una etiqueta traducida muy larga"
                : "Saved care option"
              : spanish
                ? "Clinica Riverside con un nombre traducido muy largo"
                : "Riverside Clinic",
            providerType: spanish ? "Clinica" : "Clinic",
            actionLabel: evidenceSafe
              ? spanish
                ? "Revisar tarea"
                : "Review task"
              : spanish
                ? "Preparar cita"
                : "Book appointment",
            waitingSinceLabel: evidenceSafe
              ? spanish
                ? "Estado de espera"
                : "Waiting status"
              : spanish
                ? "Esperando 2 horas"
                : "Waiting 2 hours",
            requiresScheduledFor: scheduled,
            replyIntents: [
              {
                id: "confirm-appointment",
                label: spanish ? "Confirmar cita" : "Confirm appointment",
                subtitle: spanish ? "Solo borrador" : "Draft only",
                description: spanish
                  ? "Guardar la confirmacion para revisarla."
                  : "Save the confirmation for review.",
                purposeLabel: spanish ? "Confirmar cita" : "Confirm appointment",
                confidenceLabel: spanish ? "Revisar" : "Review needed",
                draftOnlyLabel: spanish ? "No se envio ningun mensaje" : "No message sent yet",
                reviewReminder: spanish ? "Revisar antes de enviar" : "Review before send",
                recommended: true,
                voiceAliases: spanish ? ["confirmar"] : ["confirm"],
              },
              {
                id: "reschedule",
                label: spanish
                  ? "Reprogramar con una etiqueta traducida deliberadamente larga para probar tarjetas"
                  : "Reschedule with a deliberately long provider reply intent label",
                subtitle: spanish ? "Necesita revision" : "Needs review",
                description: spanish
                  ? "Preparar un borrador para revisar antes de guardar."
                  : "Prepare a draft for review before anything is saved.",
                purposeLabel: spanish ? "Reprogramar" : "Reschedule",
                confidenceLabel: spanish ? "Revisar" : "Review needed",
                draftOnlyLabel: spanish ? "No se envio ningun mensaje" : "No message sent yet",
              },
              {
                id: "urgent",
                label: spanish ? "Urgente o seguridad" : "Urgent or safety concern",
                subtitle: spanish ? "Detiene este flujo" : "Stops this flow",
                description: spanish
                  ? "Esta ruta queda bloqueada y segura."
                  : "This path is blocked and safe.",
                urgent: true,
                boundaryLabel: spanish
                  ? "No uses una respuesta normal para ayuda urgente."
                  : "Do not use a normal provider reply for urgent help.",
                voiceAliases: spanish ? ["urgente"] : ["urgent"],
              },
            ],
            rows: [{
              id: "summary",
              label: spanish ? "Resumen" : "Summary",
              value: spanish
                ? "El proveedor respondio y hay que guardar el resultado sin enviar nada externo."
                : "The provider replied; save the result without sending anything externally.",
            }],
          }}
          voiceCommands={{
            start: spanish ? ["empezar"] : ["start"],
            back: spanish ? ["volver"] : ["back"],
            cancel: spanish ? ["cancelar"] : ["cancel"],
            continue: spanish ? ["continuar"] : ["continue"],
            save: spanish ? ["guardar respuesta"] : ["save reply"],
            complete: spanish ? ["marcar completado"] : ["mark complete"],
            retry: spanish ? ["reintentar"] : ["retry"],
            skip: spanish ? ["sin notas"] : ["no notes"],
          }}
          initialState={
            startsAtReview
              ? evidenceSafe
                ? sanitizedReviewState
                : reviewState
              : undefined
          }
          storageKey={`provider-reply-gallery-${spanish}-${scheduled}-${startsAtReview}-${evidenceSafe}`}
          onSaveReply={save}
          onMarkComplete={complete}
        />
      </div>
    </main>
  );
}
