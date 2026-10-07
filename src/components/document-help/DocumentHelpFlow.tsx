import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  CircleDashed,
  Clock,
  Ellipsis,
  Loader2,
  LogOut,
  MessageCircleQuestion,
  Square,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOptionalVyvaVoice, useTtsReadout } from "@/hooks/useVyvaVoice";
import { voicePlaybackLocale } from "@/lib/voicePlayback";
import {
  DocumentHelpReadError,
  documentHelpFileProblem,
  readDocumentForHelp,
} from "@/lib/documentHelpReader";
import { primaryDocumentDeadline, type DocumentHelpReading } from "../../../shared/documentHelpReading";
import { DocumentHelpChoiceCard } from "./DocumentHelpChoiceCard";
import { DocumentHelpConfirmation } from "./DocumentHelpConfirmation";
import { DocumentHelpField } from "./DocumentHelpField";
import { DocumentHelpNotice, type DocumentHelpNoticeTone } from "./DocumentHelpNotice";
import { DocumentHelpProgress } from "./DocumentHelpProgress";
import { DocumentHelpFactList, DocumentHelpReviewSection, type DocumentHelpFact } from "./DocumentHelpReviewSection";
import { DocumentHelpTrustNote } from "./DocumentHelpTrustNote";
import { DocumentHelpUpload, type DocumentHelpUploadState } from "./DocumentHelpUpload";
import {
  DOCUMENT_HELP_OPTIONS,
  DOCUMENT_HELP_STEPS,
  documentAmountKindLabel,
  documentHelpDateConflict,
  documentHelpDeadline,
  documentHelpHasDetails,
  documentHelpOption,
  documentHelpText,
  formatDocumentAmount,
  formatDocumentDate,
  type DocumentHelpDeadline,
  type DocumentHelpDetails,
  type DocumentHelpField as FieldName,
  type DocumentHelpKind,
  type DocumentHelpOption,
  type DocumentHelpStep,
} from "./documentHelpModel";
import "./documentHelp.css";

export type DocumentHelpSaveState = "saving" | "saved" | "error" | null;
export type DocumentHelpSubmitState = "idle" | "submitting" | "error" | "done";

export type DocumentHelpFlowProps = {
  isSpanish: boolean;
  language: string;
  isDark: boolean;
  /** True on the dedicated task page; false when opened in place inside Concierge. */
  standalone: boolean;
  kind: DocumentHelpKind | null;
  details: DocumentHelpDetails;
  step: DocumentHelpStep;
  reading: DocumentHelpReading | null;
  fileName: string | null;
  onKindChange: (kind: DocumentHelpKind) => void;
  onDetailsChange: (details: DocumentHelpDetails) => void;
  onStepChange: (step: DocumentHelpStep) => void;
  onReadingChange: (reading: DocumentHelpReading | null, fileName: string | null) => void;
  onSubmit: () => void;
  submitState: DocumentHelpSubmitState;
  saveState?: DocumentHelpSaveState;
  onExit: () => void;
  onRemove?: () => void;
  isRemoving?: boolean;
  similarTaskCount?: number;
  onOpenTasks?: () => void;
  onDone: () => void;
};

type Issue = { tone: DocumentHelpNoticeTone; title: string; body: string; action?: { label: string; onClick: () => void } };

function uploadStateFrom(reading: DocumentHelpReading | null, fileName: string | null): DocumentHelpUploadState {
  return reading ? { status: "done", reading, fileName } : { status: "idle" };
}

function UrgencyBadge({ deadline, isSpanish }: { deadline: DocumentHelpDeadline; isSpanish: boolean }) {
  const { urgency, display, source } = deadline;
  const fromWhere = source === "document"
    ? (isSpanish ? "según su documento" : "from your document")
    : source === "member"
      ? (isSpanish ? "la fecha que usted indicó" : "the date you gave")
      : null;
  let tone = "dh-tone-neutral";
  let text: string;
  if (urgency.level === "passed") {
    tone = "dh-tone-danger";
    text = isSpanish ? `Esta fecha ya ha pasado: ${display}` : `This date has passed: ${display}`;
  } else if (urgency.level === "due") {
    tone = "dh-tone-warn";
    const days = urgency.days === 0
      ? (isSpanish ? "hoy" : "today")
      : isSpanish ? `en ${urgency.days} ${urgency.days === 1 ? "día" : "días"}` : `in ${urgency.days} ${urgency.days === 1 ? "day" : "days"}`;
    text = isSpanish ? `Vence el ${display}, ${days}` : `Due by ${display}, ${days}`;
  } else if (urgency.level === "soon") {
    tone = "dh-tone-info";
    text = isSpanish ? `Conviene hacerlo pronto · Vence el ${display}` : `Consider doing this soon · Due by ${display}`;
  } else if (urgency.level === "later") {
    tone = "dh-tone-safe";
    text = isSpanish ? `Sin prisa · Vence el ${display}` : `No rush · Due by ${display}`;
  } else if (display) {
    text = isSpanish ? `Fecha indicada: ${display}` : `Date given: ${display}`;
  } else {
    text = isSpanish ? "No se ha encontrado una fecha límite" : "No deadline found";
  }
  return (
    <div className={`${tone} flex items-start gap-3 rounded-[16px] px-4 py-3`} data-testid="document-help-urgency" data-urgency={urgency.level}>
      <Clock size={24} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
      <p className="font-body text-[19px] font-bold leading-snug">
        {text}
        {fromWhere && urgency.level !== "unknown" ? <span className="block text-[17px] font-semibold" style={{ color: "var(--dh-text-muted)" }}>({fromWhere})</span> : null}
        {!display ? (
          <span className="block text-[17px] font-semibold" style={{ color: "var(--dh-text-muted)" }}>
            {isSpanish ? "Mire si el papel tiene alguna fecha, por si a VYVA se le ha pasado." : "Check the paper for a date, in case VYVA missed one."}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function ReadAloudButton({ text, language, isSpanish }: { text: string; language: string; isSpanish: boolean }) {
  const { speakText, stopTts, isTtsSpeaking, isTtsSupported } = useTtsReadout();
  useEffect(() => () => stopTts(), [stopTts]);
  if (!isTtsSupported || !text.trim()) return null;
  return (
    <button
      type="button"
      className="dh-btn dh-btn-secondary !min-h-[52px] font-body"
      aria-pressed={isTtsSpeaking}
      onClick={() => (isTtsSpeaking ? stopTts() : speakText(text, voicePlaybackLocale(language)))}
      data-testid="button-document-help-read-aloud"
    >
      {isTtsSpeaking ? <Square size={20} aria-hidden="true" /> : <Volume2 size={22} aria-hidden="true" />}
      {isTtsSpeaking ? (isSpanish ? "Parar la lectura" : "Stop reading") : (isSpanish ? "Leérmelo en voz alta" : "Read this aloud")}
    </button>
  );
}

function AskVyva({ isSpanish, step }: { isSpanish: boolean; step: DocumentHelpStep }) {
  const voice = useOptionalVyvaVoice();
  if (!voice) return null;
  const active = voice.status === "connected" || voice.isConnecting;
  return (
    <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--dh-border)" }}>
      <p className="font-body text-[18px] font-semibold">
        {isSpanish ? "¿Tiene alguna duda?" : "Not sure about something?"}
        <span className="dh-muted block font-normal">
          {isSpanish ? "Pregúntele a VYVA en voz alta. Su progreso se queda aquí." : "Ask VYVA out loud. Your progress stays here."}
        </span>
      </p>
      <button
        type="button"
        className="dh-btn dh-btn-secondary font-body"
        data-testid="button-document-help-ask-vyva"
        onClick={() => {
          if (active) {
            voice.stopVoice();
            return;
          }
          void Promise.resolve(voice.startVoice(
            `Document help, step "${step}". The member is preparing paperwork with VYVA and has a question. Explain plainly. Do not send, call, submit or share anything.`,
            undefined,
            { agentSlug: "concierge", autoStartListening: true },
          )).catch(() => undefined);
        }}
      >
        <MessageCircleQuestion size={22} aria-hidden="true" />
        {active ? (isSpanish ? "Terminar la conversación" : "End the conversation") : (isSpanish ? "Hablar con VYVA" : "Talk to VYVA")}
      </button>
    </div>
  );
}

function SaveStatus({ state, isSpanish }: { state: DocumentHelpSaveState; isSpanish: boolean }) {
  if (!state) return null;
  const content = state === "saving"
    ? { Icon: Loader2, text: isSpanish ? "Guardando…" : "Saving…", color: "var(--dh-text-muted)", spin: true }
    : state === "saved"
      ? { Icon: CircleCheck, text: isSpanish ? "Guardado" : "Saved", color: "var(--dh-safe)", spin: false }
      : { Icon: CircleDashed, text: isSpanish ? "Sin guardar" : "Not saved", color: "var(--dh-warn)", spin: false };
  const { Icon } = content;
  return (
    <p role="status" className="flex items-center gap-1.5 font-body text-[17px] font-bold" style={{ color: content.color }} data-testid="document-help-save-status" data-save-state={state}>
      <Icon size={20} aria-hidden="true" className={content.spin ? "dh-spin animate-spin" : ""} />
      {content.text}
    </p>
  );
}

export function DocumentHelpFlow(props: DocumentHelpFlowProps) {
  const {
    isSpanish,
    language,
    isDark,
    standalone,
    kind,
    details,
    step,
    reading,
    fileName,
    onKindChange,
    onDetailsChange,
    onStepChange,
    onReadingChange,
    onSubmit,
    submitState,
    saveState = null,
    onExit,
    onRemove,
    isRemoving = false,
    similarTaskCount = 0,
    onOpenTasks,
    onDone,
  } = props;
  const option = documentHelpOption(kind);
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fieldRefs = useRef<Partial<Record<FieldName, HTMLInputElement & HTMLTextAreaElement>>>({});
  const confirmRef = useRef<HTMLInputElement>(null);
  const continueErrorRef = useRef<HTMLParagraphElement>(null);
  const pendingFocusRef = useRef<FieldName | "upload" | null>(null);
  const isFirstRenderRef = useRef(true);
  const readRequestRef = useRef(0);
  const [uploadState, setUploadState] = useState<DocumentHelpUploadState>(() => uploadStateFrom(reading, fileName));
  const [prefilled, setPrefilled] = useState<Set<FieldName>>(() => new Set());
  const [chooseError, setChooseError] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const isDone = submitState === "done";

  // A resumed task hydrates its reading after first render.
  useEffect(() => {
    setUploadState((current) => (current.status === "reading" ? current : uploadStateFrom(reading, fileName)));
  }, [reading, fileName]);

  // Consent never carries over: leaving the confirm step clears the tick.
  useEffect(() => {
    if (step !== "confirm") {
      setConfirmed(false);
      setConfirmError(false);
    }
  }, [step]);

  // Move focus to the new step's heading (or a requested field) so screen readers
  // and keyboard users start at the top of the new content.
  useLayoutEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    rootRef.current?.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    const target = pendingFocusRef.current;
    pendingFocusRef.current = null;
    if (target && target !== "upload") {
      fieldRefs.current[target]?.focus({ preventScroll: true });
      return;
    }
    if (target === "upload") {
      rootRef.current?.querySelector<HTMLElement>("[data-testid='document-help-upload'] button")?.focus({ preventScroll: true });
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [step, isDone]);

  const goTo = (next: DocumentHelpStep, focus: FieldName | "upload" | null = null) => {
    pendingFocusRef.current = focus;
    onStepChange(next);
  };

  const updateField = (field: FieldName, value: string) => {
    if (prefilled.has(field)) {
      setPrefilled((current) => {
        const next = new Set(current);
        next.delete(field);
        return next;
      });
    }
    onDetailsChange({ ...details, [field]: value });
  };

  const handleFile = async (file: File) => {
    const problem = documentHelpFileProblem(file);
    if (problem) {
      setUploadState({ status: "error", problem });
      return;
    }
    const requestId = readRequestRef.current + 1;
    readRequestRef.current = requestId;
    setUploadState({ status: "reading", fileName: file.name });
    try {
      const result = await readDocumentForHelp(file, language, kind);
      if (readRequestRef.current !== requestId) return;
      setUploadState({ status: "done", reading: result, fileName: file.name });
      onReadingChange(result, file.name);
      if (result.status !== "read") return;
      const filled = new Set<FieldName>();
      const next = { ...details };
      if (!next.recipient.trim() && result.organization && option?.fields.some((field) => field.field === "recipient")) {
        next.recipient = result.organization;
        filled.add("recipient");
      }
      const deadline = primaryDocumentDeadline(result);
      if (!next.deadline.trim() && deadline && option?.fields.some((field) => field.field === "deadline")) {
        next.deadline = deadline.date ? formatDocumentDate(deadline.date, language) : deadline.text;
        filled.add("deadline");
      }
      if (filled.size) {
        setPrefilled(filled);
        onDetailsChange(next);
      }
    } catch (error) {
      if (readRequestRef.current !== requestId) return;
      const reason = error instanceof DocumentHelpReadError ? error.reason : "server";
      setUploadState({ status: "error", problem: reason });
    }
  };

  const clearDocument = () => {
    readRequestRef.current += 1;
    setUploadState({ status: "idle" });
    setPrefilled(new Set());
    onReadingChange(null, null);
  };

  const stepIndex = DOCUMENT_HELP_STEPS.indexOf(step);
  const goBack = () => {
    if (stepIndex <= 0) {
      onExit();
      return;
    }
    goTo(DOCUMENT_HELP_STEPS[stepIndex - 1]);
  };

  const docRead = reading?.status === "read" ? reading : null;
  const deadline = useMemo(() => documentHelpDeadline(reading, details, language), [details, language, reading]);
  const outcome = option ? documentHelpText(option.outcome, isSpanish) : "";

  const memberFacts: DocumentHelpFact[] = option ? [
    ...option.fields.map((field) => ({
      label: documentHelpText(field.label, isSpanish),
      value: details[field.field].trim() || (isSpanish ? "No añadido" : "Not added"),
      empty: !details[field.field].trim(),
    })),
    {
      label: isSpanish ? "Documento" : "Document",
      value: fileName ?? (reading ? (isSpanish ? "Añadido" : "Added") : (isSpanish ? "No añadido" : "Not added")),
      empty: !reading,
    },
  ] : [];

  const documentFacts: DocumentHelpFact[] = docRead ? [
    ...(docRead.organization ? [{ label: isSpanish ? "De" : "From", value: docRead.organization }] : []),
    ...(docRead.document_type_label ? [{ label: isSpanish ? "Qué es" : "What it is", value: docRead.document_type_label }] : []),
    ...docRead.dates.map((entry) => ({
      label: entry.label,
      value: entry.date ? formatDocumentDate(entry.date, language) : entry.text,
      note: entry.is_deadline ? (isSpanish ? "Fecha límite" : "Deadline") : null,
      needsCheck: entry.confidence === "low",
    })),
    ...docRead.amounts.map((amount) => ({
      label: amount.label,
      value: formatDocumentAmount(amount, language),
      note: documentAmountKindLabel(amount.kind, isSpanish),
      needsCheck: amount.confidence === "low",
    })),
  ] : [];

  const issues: Issue[] = [];
  if (docRead && (docRead.confidence === "low" || docRead.unclear.length > 0 || documentFacts.some((fact) => fact.needsCheck))) {
    issues.push({
      tone: "warn",
      title: isSpanish ? "Puede que no lo haya leído bien" : "I may not have read this correctly",
      body: [
        isSpanish ? "Compare los datos marcados con el papel, por favor." : "Please check the highlighted details against the paper.",
        ...docRead.unclear,
      ].join(" "),
      action: { label: isSpanish ? "Usar una foto más clara" : "Use a clearer photo", onClick: () => goTo("details", "upload") },
    });
  }
  if (reading && reading.status !== "read") {
    issues.push({
      tone: "info",
      title: isSpanish ? "Este resumen se basa solo en lo que ha escrito" : "This summary is based only on what you typed",
      body: isSpanish ? "VYVA no ha podido leer el documento automáticamente." : "VYVA couldn't read the document automatically.",
    });
  }
  if (!reading && option?.documentRecommended) {
    issues.push({
      tone: "info",
      title: isSpanish ? "No ha añadido el documento" : "No document added",
      body: isSpanish ? "VYVA puede ayudar igualmente. Con una foto, el resumen será más preciso." : "VYVA can still help. A photo makes the summary more accurate.",
      action: { label: documentHelpText(option.documentLabel, isSpanish), onClick: () => goTo("details", "upload") },
    });
  }
  const conflict = documentHelpDateConflict(reading, details);
  if (conflict) {
    issues.push({
      tone: "warn",
      title: isSpanish ? "Hay dos fechas distintas" : "There are two different dates",
      body: isSpanish
        ? `Usted escribió ${formatDocumentDate(conflict.typed, language)}, pero el documento dice ${formatDocumentDate(conflict.document, language)}. Compruebe cuál es la correcta.`
        : `You wrote ${formatDocumentDate(conflict.typed, language)}, but the document says ${formatDocumentDate(conflict.document, language)}. Please check which one is right.`,
      action: { label: isSpanish ? "Cambiar la fecha" : "Change the date", onClick: () => goTo("details", "deadline") },
    });
  }
  if (deadline.urgency.level === "passed") {
    issues.push({
      tone: "warn",
      title: isSpanish ? "La fecha ya ha pasado" : "The date has passed",
      body: isSpanish ? "Aun así, merece la pena preguntar qué hacer ahora. El equipo de VYVA puede ayudarle." : "It's still worth asking what to do now. VYVA's team can help with that.",
    });
  }
  if (similarTaskCount > 0 && onOpenTasks) {
    issues.push({
      tone: "info",
      title: isSpanish ? "Ya tiene una tarea parecida" : "You already have a similar task",
      body: isSpanish
        ? "Puede seguir con esta o abrir sus tareas para compararlas."
        : "You can carry on with this one, or open your tasks to compare.",
      action: { label: isSpanish ? "Ver mis tareas" : "See my tasks", onClick: onOpenTasks },
    });
  }
  if (!reading && !documentHelpHasDetails(details)) {
    issues.push({
      tone: "info",
      title: isSpanish ? "VYVA todavía tiene poca información" : "VYVA doesn't have much to go on yet",
      body: isSpanish
        ? "No pasa nada: el equipo de VYVA le preguntará lo que necesite. Una foto o una frase les ayuda a empezar."
        : "That's fine — VYVA's team will ask you what they need. A photo or a sentence helps them get started.",
      action: { label: isSpanish ? "Añadir datos" : "Add details", onClick: () => goTo("details") },
    });
  }

  const suggestions: string[] = [];
  if (deadline.urgency.level === "due") suggestions.push(isSpanish ? "Haga esto primero: la fecha está cerca." : "Deal with this first — the date is close.");
  if (deadline.urgency.level === "passed") suggestions.push(isSpanish ? "Pregunte pronto qué hacer con la fecha pasada." : "Ask soon about what to do now the date has passed.");
  if (deadline.urgency.level === "soon") suggestions.push(isSpanish ? "Planee ocuparse de esto en las próximas semanas." : "Plan to deal with this in the next few weeks.");
  const reimbursable = docRead?.amounts.find((amount) => amount.kind === "reimbursable");
  switch (kind) {
    case "insurance-letter":
      suggestions.push(isSpanish ? "Deje que el equipo de VYVA prepare un resumen sencillo que pueda guardar y compartir." : "Let VYVA's team prepare a plain summary you can keep and share.");
      break;
    case "claim":
      if (reimbursable) {
        suggestions.push(isSpanish
          ? `El documento muestra ${formatDocumentAmount(reimbursable, language)} que se podría devolver. VYVA lo incluirá en el borrador.`
          : `The document shows ${formatDocumentAmount(reimbursable, language)} that could be paid back. VYVA will include it in the draft.`);
      }
      suggestions.push(isSpanish ? "Guarde juntos sus recibos: el reclamo los necesitará." : "Keep your receipts together — the claim will need them.");
      break;
    case "government-form":
      suggestions.push(isSpanish ? "Tenga su documento de identidad a mano cuando rellene el formulario." : "Have your ID nearby when you fill in the form.");
      break;
    case "call-email":
      suggestions.push(isSpanish ? "VYVA preparará qué decir, para que lo lea antes de contactar con nadie." : "VYVA will prepare what to say, so you can read it before anyone is contacted.");
      break;
    case "not-sure":
      suggestions.push(isSpanish ? "El equipo de VYVA le dirá qué es y si tiene que hacer algo." : "VYVA's team will tell you what this is and whether you need to do anything.");
      break;
    default:
      break;
  }
  suggestions.push(isSpanish ? "Si algo no le queda claro, háblelo con VYVA o con alguien de confianza." : "If anything feels unclear, talk it through with VYVA or someone you trust.");

  const summaryText = docRead?.summary
    ?? (option
      ? [
          isSpanish ? `Quiere ayuda para: ${documentHelpText(option.title, isSpanish).toLowerCase()}.` : `You'd like help to: ${documentHelpText(option.title, isSpanish).toLowerCase()}.`,
          details.subject.trim() ? `${isSpanish ? "En sus palabras" : "In your words"}: “${details.subject.trim()}”` : "",
        ].filter(Boolean).join(" ")
      : "");

  const readAloudText = [
    summaryText,
    deadline.display ? `${isSpanish ? "Fecha" : "Date"}: ${deadline.display}.` : "",
    ...documentFacts.map((fact) => `${fact.label}: ${fact.value}.`),
    ...(docRead?.requested_actions ?? []),
    isSpanish ? "Sugerencias de VYVA:" : "VYVA's suggestions:",
    ...suggestions,
  ].filter(Boolean).join(" ");

  const sharedLines = option ? [
    documentHelpText(option.title, isSpanish),
    ...option.fields
      .filter((field) => details[field.field].trim())
      .map((field) => `${documentHelpText(field.label, isSpanish).replace(/[¿?]/g, "").trim()}: ${details[field.field].trim()}`),
    ...(docRead ? [isSpanish ? "Los datos que VYVA leyó en su documento (fechas, importes y de quién es)" : "The details VYVA read from your document (dates, amounts and who sent it)"] : []),
  ] : [];
  const recipientName = details.recipient.trim();
  const notHappening = [
    recipientName
      ? (isSpanish ? `No se envía nada a ${recipientName}.` : `Nothing is sent to ${recipientName}.`)
      : (isSpanish ? "No se envía nada a nadie más." : "Nothing is sent to anyone else."),
    isSpanish ? "No se hace ninguna llamada." : "No calls are made.",
    isSpanish ? "No se entrega ningún formulario ni se paga nada." : "No forms are submitted and nothing is paid.",
  ];

  const handleContinue = () => {
    if (step === "choose") {
      if (!option) {
        setChooseError(true);
        window.setTimeout(() => continueErrorRef.current?.focus(), 0);
        return;
      }
      goTo("details");
      return;
    }
    if (step === "details") {
      goTo("review");
      return;
    }
    if (step === "review") {
      goTo("confirm");
      return;
    }
    if (!confirmed) {
      setConfirmError(true);
      confirmRef.current?.focus();
      return;
    }
    onSubmit();
  };

  const header = (
    <header className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {submitState === "done" ? <span /> : (
          <button type="button" className="dh-btn dh-btn-quiet -ml-3 !no-underline font-body" onClick={goBack} data-testid="button-document-help-back">
            {stepIndex <= 0 && !standalone ? <X size={24} aria-hidden="true" /> : <ArrowLeft size={24} aria-hidden="true" />}
            {stepIndex <= 0
              ? (standalone ? (isSpanish ? "Mis tareas" : "My tasks") : (isSpanish ? "Cerrar" : "Close"))
              : (isSpanish ? "Atrás" : "Back")}
          </button>
        )}
        <div className="flex items-center gap-2">
          <SaveStatus state={standalone && !isDone ? saveState : null} isSpanish={isSpanish} />
          {standalone && submitState !== "done" ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="dh-btn dh-btn-secondary !h-[52px] !min-h-[52px] !w-[52px] !p-0"
                  aria-label={isSpanish ? "Más opciones" : "More options"}
                  data-testid="button-document-help-more"
                >
                  <Ellipsis size={26} aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[16rem] rounded-[16px] p-2">
                <DropdownMenuItem className="min-h-[52px] gap-3 rounded-[12px] px-3 font-body text-[18px] font-semibold" onSelect={onExit}>
                  <LogOut size={22} aria-hidden="true" />
                  {isSpanish ? "Guardar y salir" : "Save and leave"}
                </DropdownMenuItem>
                {onRemove ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="min-h-[52px] gap-3 rounded-[12px] px-3 font-body text-[18px] font-semibold text-[#A01818] focus:text-[#A01818]"
                      onSelect={() => setRemoveOpen(true)}
                      data-testid="button-document-help-remove"
                    >
                      <Trash2 size={22} aria-hidden="true" />
                      {isSpanish ? "Eliminar esta tarea" : "Remove this task"}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
      {submitState !== "done" ? (
        <>
          <p className="font-body text-[18px] font-bold uppercase tracking-[0.06em]" style={{ color: "var(--dh-accent)" }}>
            {isSpanish ? "Ayuda con papeles" : "Paperwork help"}
          </p>
          <DocumentHelpProgress step={step} isSpanish={isSpanish} />
          {standalone && saveState === "saved" && step !== "choose" ? (
            <p className="dh-muted font-body text-[17px] leading-snug">
              {isSpanish
                ? "Su progreso se guarda solo. Puede salir y volver desde sus tareas."
                : "Your progress is saved automatically. You can leave and come back from your tasks."}
            </p>
          ) : null}
        </>
      ) : null}
    </header>
  );

  const HeadingTag = standalone ? "h1" : "h2";
  const stepHeading = (title: string, intro: ReactNode) => (
    <div className="space-y-2">
      <HeadingTag
        ref={headingRef}
        tabIndex={-1}
        className="font-body text-[30px] font-bold leading-tight tracking-[-0.01em] sm:text-[34px]"
        data-testid="document-help-step-title"
      >
        {title}
      </HeadingTag>
      <p className="dh-muted max-w-[38rem] font-body text-[20px] leading-relaxed">{intro}</p>
    </div>
  );

  const primaryLabel = step === "choose"
    ? (isSpanish ? "Continuar" : "Continue")
    : step === "details"
      ? (isSpanish ? "Continuar para revisar" : "Continue to review")
      : step === "review"
        ? (isSpanish ? "Está bien, continuar" : "Looks right — continue")
        : (isSpanish ? "Pedir a VYVA que lo prepare" : "Ask VYVA to prepare this");

  const actions = (
    <div className="space-y-5">
      {step !== "choose" ? <DocumentHelpTrustNote isSpanish={isSpanish} /> : null}
      <button
        type="button"
        className="dh-btn dh-btn-primary w-full font-body sm:w-auto sm:min-w-[18rem]"
        onClick={handleContinue}
        disabled={submitState === "submitting"}
        aria-describedby={step === "choose" && chooseError ? "document-help-choose-error" : undefined}
        data-testid={step === "confirm" ? "button-document-help-submit" : "button-document-help-continue"}
      >
        {submitState === "submitting" && step === "confirm" ? <Loader2 size={22} className="dh-spin animate-spin" aria-hidden="true" /> : null}
        {submitState === "submitting" && step === "confirm" ? (isSpanish ? "Enviando a VYVA…" : "Sending to VYVA…") : primaryLabel}
        {step !== "confirm" ? <ArrowRight size={22} aria-hidden="true" /> : null}
      </button>
    </div>
  );

  let body: ReactNode;
  if (submitState === "done" && option) {
    body = (
      <div className="space-y-6" data-testid="document-help-success">
        <CircleCheck size={56} style={{ color: "var(--dh-safe)" }} aria-hidden="true" />
        {stepHeading(
          isSpanish ? "VYVA lo está preparando" : "VYVA is preparing this for you",
          isSpanish
            ? `Ha pedido ${outcome}. Lo encontrará en sus tareas y VYVA le avisará cuando esté listo.`
            : `You asked for ${outcome}. You'll find it in your tasks, and VYVA will let you know when it's ready.`,
        )}
        <DocumentHelpNotice tone="safe" title={isSpanish ? "No se enviará nada sin su aprobación." : "Nothing will be sent to anyone without your approval."} />
        <div className="flex flex-col gap-3 sm:flex-row">
          {onOpenTasks ? (
            <button type="button" className="dh-btn dh-btn-primary font-body" onClick={onOpenTasks} data-testid="button-document-help-open-tasks">
              {isSpanish ? "Ver mis tareas" : "See my tasks"}
              <ArrowRight size={22} aria-hidden="true" />
            </button>
          ) : null}
          <button type="button" className="dh-btn dh-btn-secondary font-body" onClick={onDone} data-testid="button-document-help-done">
            {isSpanish ? "Hecho" : "Done"}
          </button>
        </div>
      </div>
    );
  } else if (step === "choose" || !option) {
    body = (
      <div className="space-y-6">
        {stepHeading(
          isSpanish ? "¿Con qué le gustaría que le ayudemos?" : "What would you like help with?",
          isSpanish ? "Elija la opción que más se parezca. Puede cambiarla después." : "Choose the option that feels closest. You can change it later.",
        )}
        <fieldset>
          <legend className="sr-only">{isSpanish ? "Tipo de ayuda" : "Kind of help"}</legend>
          <div className="grid gap-4">
            {DOCUMENT_HELP_OPTIONS.map((item) => (
              <DocumentHelpChoiceCard
                key={item.key}
                name="document-help-kind"
                value={item.key}
                title={documentHelpText(item.title, isSpanish)}
                description={documentHelpText(item.description, isSpanish)}
                canDoTitle={isSpanish ? "Qué puede hacer VYVA" : "What VYVA can do"}
                canDo={item.canDo.map((line) => documentHelpText(line, isSpanish))}
                Icon={item.Icon}
                checked={kind === item.key}
                onSelect={() => {
                  setChooseError(false);
                  if (kind !== item.key) onKindChange(item.key);
                }}
                testId={`button-document-help-kind-${item.key}`}
              />
            ))}
          </div>
        </fieldset>
        {chooseError ? (
          <p id="document-help-choose-error" ref={continueErrorRef} tabIndex={-1} role="alert" className="font-body text-[18px] font-bold" style={{ color: "var(--dh-danger)" }}>
            {isSpanish ? "Elija una de las opciones para continuar." : "Choose one of the options above to continue."}
          </p>
        ) : null}
        {actions}
      </div>
    );
  } else if (step === "details") {
    body = (
      <div className="space-y-8">
        {stepHeading(
          documentHelpText(option.title, isSpanish),
          isSpanish
            ? "Añada solo lo que tenga a mano. Todo es opcional y VYVA le preguntará lo que falte."
            : "Add only what you have to hand. Everything is optional, and VYVA will ask about anything missing.",
        )}
        <DocumentHelpUpload
          title={documentHelpText(option.documentLabel, isSpanish)}
          recommended={option.documentRecommended}
          state={uploadState}
          isSpanish={isSpanish}
          onFile={(file) => void handleFile(file)}
          onClear={clearDocument}
        />
        <section aria-labelledby="document-help-questions" className="space-y-7">
          <h3 id="document-help-questions" className="font-body text-[22px] font-bold">
            {option.fields.length > 1
              ? (isSpanish ? "Unas preguntas rápidas" : "A few quick questions")
              : (isSpanish ? "En sus palabras" : "In your own words")}
          </h3>
          {option.fields.map((field) => (
            <DocumentHelpField
              key={field.field}
              ref={(element) => {
                fieldRefs.current[field.field] = element ?? undefined;
              }}
              label={documentHelpText(field.label, isSpanish)}
              hint={documentHelpText(field.hint, isSpanish)}
              why={documentHelpText(field.why, isSpanish)}
              value={details[field.field]}
              multiline={field.multiline}
              fromDocument={prefilled.has(field.field)}
              isSpanish={isSpanish}
              onChange={(value) => updateField(field.field, value)}
              testId={`input-insurance-admin-${field.field}`}
            />
          ))}
        </section>
        {option.nearby.length ? (
          <section aria-labelledby="document-help-nearby">
            <h3 id="document-help-nearby" className="font-body text-[20px] font-bold">{isSpanish ? "Conviene tener a mano" : "Good to have nearby"}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-6 font-body text-[18px] leading-relaxed">
              {option.nearby.map((line) => <li key={line.en}>{documentHelpText(line, isSpanish)}</li>)}
            </ul>
          </section>
        ) : null}
        {uploadState.status === "reading" ? (
          <p className="dh-muted font-body text-[17px]">
            {isSpanish ? "Puede continuar mientras VYVA lee; los datos aparecerán en la revisión." : "You can continue while VYVA reads; the details will appear in the review."}
          </p>
        ) : null}
        {actions}
      </div>
    );
  } else if (step === "review") {
    body = (
      <div className="space-y-6" data-testid="document-help-review">
        {stepHeading(
          isSpanish ? "Vamos a revisarlo juntos" : "Let's check this together",
          isSpanish ? "Esto es lo que VYVA ha entendido. Cambie lo que no esté bien." : "Here's what VYVA understood. Change anything that isn't right.",
        )}
        <ReadAloudButton text={readAloudText} language={language} isSpanish={isSpanish} />

        <DocumentHelpReviewSection
          title={isSpanish ? "En resumen" : "In short"}
          source={docRead?.summary ? "document" : "member"}
          isSpanish={isSpanish}
          testId="document-help-review-summary"
        >
          <p className="font-body text-[20px] leading-relaxed">{summaryText}</p>
          <div className="mt-4"><UrgencyBadge deadline={deadline} isSpanish={isSpanish} /></div>
        </DocumentHelpReviewSection>

        {issues.length ? (
          <section aria-labelledby="document-help-issues" className="space-y-3" data-testid="document-help-review-issues">
            <h3 id="document-help-issues" className="font-body text-[22px] font-bold">{isSpanish ? "Conviene revisar" : "Worth checking"}</h3>
            {issues.map((issue) => (
              <DocumentHelpNotice
                key={issue.title}
                tone={issue.tone}
                title={issue.title}
                action={issue.action ? (
                  <button type="button" className="dh-btn dh-btn-quiet -ml-3 font-body" onClick={issue.action.onClick}>
                    {issue.action.label}
                  </button>
                ) : undefined}
              >
                {issue.body}
              </DocumentHelpNotice>
            ))}
          </section>
        ) : null}

        {docRead && (documentFacts.length || docRead.requested_actions.length) ? (
          <DocumentHelpReviewSection
            title={isSpanish ? "Lo importante del documento" : "Key details from the document"}
            source="document"
            isSpanish={isSpanish}
            onEdit={() => goTo("details", "upload")}
            editLabel={isSpanish ? "Cambiar el documento" : "Change the document"}
            testId="document-help-review-document"
          >
            {documentFacts.length ? <DocumentHelpFactList facts={documentFacts} isSpanish={isSpanish} /> : null}
            {docRead.requested_actions.length ? (
              <div className={documentFacts.length ? "mt-5" : ""}>
                <h4 className="font-body text-[19px] font-bold">{isSpanish ? "Lo que le pide hacer" : "What it asks you to do"}</h4>
                <ul className="mt-2 list-disc space-y-1 pl-6 font-body text-[19px] leading-relaxed">
                  {docRead.requested_actions.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </div>
            ) : null}
            {docRead.has_reference_number ? (
              <p className="dh-muted mt-4 font-body text-[17px] leading-snug">
                {isSpanish
                  ? "El documento tiene un número de referencia. VYVA no lo ha copiado: tenga el papel a mano."
                  : "There's a reference number on the document. VYVA didn't copy it — keep the paper nearby."}
              </p>
            ) : null}
          </DocumentHelpReviewSection>
        ) : null}

        <DocumentHelpReviewSection
          title={isSpanish ? "Lo que nos ha contado" : "What you told us"}
          source="member"
          isSpanish={isSpanish}
          onEdit={() => goTo("details", option.fields[0]?.field ?? null)}
          editLabel={isSpanish ? "Cambiar lo que ha contado" : "Edit what you told us"}
          testId="document-help-review-member"
        >
          <DocumentHelpFactList facts={memberFacts} isSpanish={isSpanish} />
        </DocumentHelpReviewSection>

        {docRead?.terms.length ? (
          <DocumentHelpReviewSection title={isSpanish ? "Palabras difíciles, explicadas" : "Difficult words, explained"} source="explanation" isSpanish={isSpanish}>
            <dl className="space-y-3">
              {docRead.terms.map((term) => (
                <div key={term.term}>
                  <dt className="font-body text-[19px] font-bold">{term.term}</dt>
                  <dd className="font-body text-[18px] leading-relaxed">{term.explanation}</dd>
                </div>
              ))}
            </dl>
          </DocumentHelpReviewSection>
        ) : null}

        <DocumentHelpReviewSection title={isSpanish ? "Lo que VYVA sugiere" : "What VYVA suggests"} source="suggestion" isSpanish={isSpanish} testId="document-help-review-suggestions">
          <ol className="list-decimal space-y-2 pl-6 font-body text-[19px] leading-relaxed">
            {suggestions.map((line) => <li key={line}>{line}</li>)}
          </ol>
        </DocumentHelpReviewSection>

        {actions}
      </div>
    );
  } else {
    body = (
      <div className="space-y-6">
        {stepHeading(
          isSpanish ? "Antes de que VYVA empiece" : "Before VYVA starts",
          isSpanish ? "Léalo con calma y luego confirme." : "Please read this, then confirm.",
        )}
        <DocumentHelpConfirmation
          ref={confirmRef}
          isSpanish={isSpanish}
          whatHappens={isSpanish
            ? `El equipo de VYVA preparará ${outcome}, y se lo devolverá aquí.`
            : `VYVA's team will prepare ${outcome}, and send it back to you here.`}
          shared={sharedLines}
          notHappening={notHappening}
          checked={confirmed}
          onCheckedChange={(next) => {
            setConfirmed(next);
            if (next) setConfirmError(false);
          }}
          showCheckError={confirmError}
        />
        {submitState === "error" ? (
          <DocumentHelpNotice tone="danger" title={isSpanish ? "No se ha podido enviar" : "That didn't go through"} live="alert" testId="document-help-submit-error">
            {isSpanish ? "Sus datos siguen aquí. Inténtelo de nuevo, por favor." : "Your details are still here. Please try again."}
          </DocumentHelpNotice>
        ) : null}
        {actions}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="dh-root order-[14] mt-4 scroll-mt-[88px] rounded-[28px] px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-5 min-[390px]:px-5 sm:px-8 sm:pt-7"
      data-theme={isDark ? "dark" : "light"}
      data-testid="panel-insurance-admin"
      data-document-help-step={submitState === "done" ? "done" : step}
    >
      <div className="mx-auto max-w-[44rem] space-y-8">
        {header}
        <div key={submitState === "done" ? "done" : step} className="dh-step-enter space-y-10">
          {body}
          {submitState !== "done" ? <AskVyva isSpanish={isSpanish} step={step} /> : null}
        </div>
      </div>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent className="max-w-[min(32rem,calc(100vw-2rem))] rounded-[24px] p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-body text-[24px] font-bold">
              {isSpanish ? "¿Eliminar esta tarea?" : "Remove this task?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="font-body text-[18px] leading-relaxed text-[#4A4150]">
              {isSpanish
                ? "Se borrarán los datos que ha añadido. VYVA no ha enviado nada, así que nada más se ve afectado. No se puede deshacer."
                : "This deletes the details you've added. VYVA hasn't sent anything, so nothing else is affected. This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-3">
            <AlertDialogCancel className="min-h-[56px] rounded-full px-6 font-body text-[18px] font-bold">
              {isSpanish ? "Mantenerla" : "Keep it"}
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-[56px] rounded-full bg-[#A01818] px-6 font-body text-[18px] font-bold text-white hover:bg-[#861313]"
              onClick={() => onRemove?.()}
              disabled={isRemoving}
              data-testid="button-document-help-remove-confirm"
            >
              {isSpanish ? "Eliminar la tarea" : "Remove task"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export type { DocumentHelpOption };
