import {
  CircleHelp,
  ClipboardPen,
  FileText,
  HandCoins,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import type { ConciergeToolRequirement } from "../../../shared/conciergeFlowRegistry";
import {
  documentHelpUrgency,
  parseTypedDocumentDate,
  primaryDocumentDeadline,
  type DocumentHelpAmount,
  type DocumentHelpReading,
  type DocumentHelpUrgency,
} from "../../../shared/documentHelpReading";

export type DocumentHelpKind = "insurance-letter" | "claim" | "government-form" | "call-email" | "not-sure";
export type DocumentHelpStep = "choose" | "details" | "review" | "confirm";
export type DocumentHelpField = "subject" | "recipient" | "deadline" | "notes";
export type DocumentHelpDetails = Record<DocumentHelpField, string>;

export const EMPTY_DOCUMENT_HELP_DETAILS: DocumentHelpDetails = { subject: "", recipient: "", deadline: "", notes: "" };
export const DOCUMENT_HELP_STEPS: DocumentHelpStep[] = ["choose", "details", "review", "confirm"];

type Copy = { en: string; es: string };
const pick = (copy: Copy, isSpanish: boolean) => (isSpanish ? copy.es : copy.en);

type FieldDefinition = {
  field: DocumentHelpField;
  label: Copy;
  hint: Copy;
  why: Copy;
  multiline?: boolean;
};

export type DocumentHelpOption = {
  key: DocumentHelpKind;
  Icon: LucideIcon;
  title: Copy;
  description: Copy;
  canDo: Copy[];
  /** The channel the finished work would eventually use. Today VYVA's team prepares it for review. */
  requestedTool: ConciergeToolRequirement;
  /** Whether a photo or file is the most useful first thing to add. */
  documentRecommended: boolean;
  documentLabel: Copy;
  fields: FieldDefinition[];
  outcome: Copy;
  nearby: Copy[];
};

const DEADLINE_FIELD = (label: Copy): FieldDefinition => ({
  field: "deadline",
  label,
  hint: { en: "For example, 30 October", es: "Por ejemplo, 30 de octubre" },
  why: {
    en: "With a date, VYVA can tell you how much time you have and suggest what to do first.",
    es: "Con una fecha, VYVA puede decirle cuánto tiempo tiene y qué hacer primero.",
  },
});

export const DOCUMENT_HELP_OPTIONS: DocumentHelpOption[] = [
  {
    key: "insurance-letter",
    Icon: FileText,
    title: { en: "Understand a letter or bill", es: "Entender una carta o factura" },
    description: {
      en: "VYVA explains what it says, what it costs and whether you need to do anything.",
      es: "VYVA le explica qué dice, cuánto cuesta y si tiene que hacer algo.",
    },
    canDo: [
      { en: "Pick out the important dates and amounts", es: "Señalar las fechas e importes importantes" },
      { en: "Explain difficult words in plain language", es: "Explicar las palabras difíciles con claridad" },
      { en: "Suggest a sensible next step", es: "Sugerir un siguiente paso sensato" },
    ],
    requestedTool: "camera_or_upload",
    documentRecommended: true,
    documentLabel: { en: "Add a photo of the letter", es: "Añada una foto de la carta" },
    fields: [
      {
        field: "recipient",
        label: { en: "Who is it from?", es: "¿Quién la envía?" },
        hint: { en: "For example, your health insurer", es: "Por ejemplo, su seguro médico" },
        why: {
          en: "Knowing who sent it helps VYVA explain it in the right context.",
          es: "Saber quién la envía ayuda a VYVA a explicarla en su contexto.",
        },
      },
      {
        field: "subject",
        label: { en: "What would you like to know?", es: "¿Qué le gustaría saber?" },
        hint: { en: "For example, why the amount has gone up", es: "Por ejemplo, por qué ha subido el importe" },
        why: {
          en: "VYVA will answer your question first, before anything else.",
          es: "VYVA responderá primero a su pregunta.",
        },
        multiline: true,
      },
      DEADLINE_FIELD({ en: "Is there a date you need to act by?", es: "¿Hay una fecha límite para actuar?" }),
      {
        field: "notes",
        label: { en: "Anything that worries you?", es: "¿Algo que le preocupe?" },
        hint: { en: "Anything at all — there are no wrong answers", es: "Lo que sea, no hay respuestas equivocadas" },
        why: {
          en: "If something is on your mind, VYVA can make sure the summary covers it.",
          es: "Si algo le preocupa, VYVA se asegura de que el resumen lo trate.",
        },
        multiline: true,
      },
    ],
    outcome: {
      en: "a clear summary of your letter and what to do next",
      es: "un resumen claro de su carta y de qué hacer después",
    },
    nearby: [
      { en: "The letter or bill, all pages", es: "La carta o factura, todas las páginas" },
      { en: "Any earlier letter about the same thing", es: "Cualquier carta anterior sobre lo mismo" },
    ],
  },
  {
    key: "claim",
    Icon: HandCoins,
    title: { en: "Claim money back", es: "Pedir un reembolso" },
    description: {
      en: "For an insurance claim or a reimbursement. VYVA prepares it for you to check.",
      es: "Para un reclamo al seguro o un reembolso. VYVA lo prepara para que lo revise.",
    },
    canDo: [
      { en: "Work out what to include", es: "Ver qué hay que incluir" },
      { en: "Prepare a draft claim for you to read", es: "Preparar un borrador para que lo lea" },
      { en: "Point out anything that is missing", es: "Señalar lo que falte" },
    ],
    requestedTool: "email",
    documentRecommended: true,
    documentLabel: { en: "Add a photo of the receipt or invoice", es: "Añada una foto del recibo o factura" },
    fields: [
      {
        field: "subject",
        label: { en: "What are you claiming for?", es: "¿Qué quiere reclamar?" },
        hint: { en: "For example, a taxi to the hospital", es: "Por ejemplo, un taxi al hospital" },
        why: {
          en: "This tells VYVA which kind of claim to prepare.",
          es: "Así VYVA sabe qué tipo de reclamo preparar.",
        },
        multiline: true,
      },
      {
        field: "recipient",
        label: { en: "Who should pay it back?", es: "¿Quién debería devolverlo?" },
        hint: { en: "For example, your insurer", es: "Por ejemplo, su aseguradora" },
        why: {
          en: "Each organisation asks for slightly different things. VYVA checks what they need.",
          es: "Cada entidad pide cosas algo distintas. VYVA revisa qué necesitan.",
        },
      },
      {
        field: "notes",
        label: { en: "Amounts and receipts you have", es: "Importes y recibos que tiene" },
        hint: { en: "For example, a €35 taxi receipt", es: "Por ejemplo, un recibo de taxi de 35 €" },
        why: {
          en: "Claims usually need proof of what you paid. VYVA lists what you already have.",
          es: "Los reclamos suelen pedir prueba del pago. VYVA anota lo que ya tiene.",
        },
        multiline: true,
      },
      DEADLINE_FIELD({ en: "Claim deadline, if you know it", es: "Fecha límite, si la sabe" }),
    ],
    outcome: { en: "a draft claim for you to read", es: "un borrador del reclamo para que lo lea" },
    nearby: [
      { en: "Receipts or invoices for what you paid", es: "Recibos o facturas de lo que pagó" },
      { en: "Your insurance card or policy details", es: "Su tarjeta o datos del seguro" },
      { en: "Any prescription or referral, if it was medical", es: "La receta o volante, si fue algo médico" },
    ],
  },
  {
    key: "government-form",
    Icon: ClipboardPen,
    title: { en: "Fill in a form", es: "Rellenar un formulario" },
    description: {
      en: "VYVA guides you through it, one part at a time.",
      es: "VYVA le guía paso a paso, una parte cada vez.",
    },
    canDo: [
      { en: "Explain what each part is asking", es: "Explicar qué pide cada parte" },
      { en: "List the papers you will need", es: "Listar los papeles que necesitará" },
      { en: "Check nothing is left out before you send it", es: "Comprobar que no falte nada antes de enviarlo" },
    ],
    requestedTool: "camera_or_upload",
    documentRecommended: true,
    documentLabel: { en: "Add a photo of the form", es: "Añada una foto del formulario" },
    fields: [
      {
        field: "subject",
        label: { en: "Which form is it?", es: "¿Qué formulario es?" },
        hint: { en: "For example, passport renewal", es: "Por ejemplo, renovación del pasaporte" },
        why: {
          en: "Knowing the form lets VYVA explain each part properly.",
          es: "Conocer el formulario permite a VYVA explicar cada parte.",
        },
      },
      {
        field: "recipient",
        label: { en: "Which office is it for?", es: "¿Para qué oficina es?" },
        hint: { en: "For example, the town hall", es: "Por ejemplo, el ayuntamiento" },
        why: {
          en: "Offices have their own rules. This helps VYVA follow the right ones.",
          es: "Cada oficina tiene sus normas. Así VYVA sigue las correctas.",
        },
      },
      DEADLINE_FIELD({ en: "When does it need to be in?", es: "¿Cuándo hay que entregarlo?" }),
      {
        field: "notes",
        label: { en: "Details you already have", es: "Datos que ya tiene" },
        hint: { en: "For example, I have my ID card ready", es: "Por ejemplo, tengo el DNI a mano" },
        why: {
          en: "VYVA won't ask you again for things you have already sorted.",
          es: "VYVA no le volverá a pedir lo que ya tiene.",
        },
        multiline: true,
      },
    ],
    outcome: { en: "step-by-step help with your form", es: "ayuda paso a paso con su formulario" },
    nearby: [
      { en: "The form itself", es: "El propio formulario" },
      { en: "Your ID card or passport", es: "Su DNI o pasaporte" },
    ],
  },
  {
    key: "call-email",
    Icon: MessagesSquare,
    title: { en: "Get ready to contact an office", es: "Preparar una llamada o un email" },
    description: {
      en: "VYVA writes what to say, so you can read it before anything is sent.",
      es: "VYVA escribe qué decir, para que lo lea antes de enviar nada.",
    },
    canDo: [
      { en: "Write a short message or call script", es: "Escribir un mensaje o guion breve" },
      { en: "Include the details they will ask for", es: "Incluir los datos que le pedirán" },
    ],
    requestedTool: "phone_call",
    documentRecommended: false,
    documentLabel: { en: "Add the letter it's about, if there is one", es: "Añada la carta, si la hay" },
    fields: [
      {
        field: "recipient",
        label: { en: "Who do you need to contact?", es: "¿A quién necesita contactar?" },
        hint: { en: "For example, the pension office", es: "Por ejemplo, la oficina de pensiones" },
        why: {
          en: "VYVA adjusts the message to suit who will read it.",
          es: "VYVA adapta el mensaje a quien lo va a leer.",
        },
      },
      {
        field: "subject",
        label: { en: "What is it about?", es: "¿De qué se trata?" },
        hint: { en: "For example, a payment I don't recognise", es: "Por ejemplo, un cobro que no reconozco" },
        why: {
          en: "A clear reason helps the office help you quickly.",
          es: "Un motivo claro ayuda a que le atiendan antes.",
        },
        multiline: true,
      },
      {
        field: "notes",
        label: { en: "What would you like to happen?", es: "¿Qué le gustaría conseguir?" },
        hint: { en: "For example, a refund or an explanation", es: "Por ejemplo, un reembolso o una explicación" },
        why: {
          en: "VYVA makes sure the message asks for what you actually want.",
          es: "VYVA se asegura de que el mensaje pida lo que usted quiere.",
        },
        multiline: true,
      },
      DEADLINE_FIELD({ en: "By when?", es: "¿Para cuándo?" }),
    ],
    outcome: { en: "what to say or write, for you to read first", es: "qué decir o escribir, para que lo lea primero" },
    nearby: [
      { en: "Any letter or reference about the matter", es: "Cualquier carta o referencia del asunto" },
    ],
  },
  {
    key: "not-sure",
    Icon: CircleHelp,
    title: { en: "Something else, or I'm not sure", es: "Otra cosa, o no estoy seguro" },
    description: {
      en: "Show VYVA the paper or describe it. VYVA will work out what it is with you.",
      es: "Enseñe el papel a VYVA o descríbalo. VYVA le ayudará a saber qué es.",
    },
    canDo: [
      { en: "Tell you what the document is", es: "Decirle qué es el documento" },
      { en: "Say whether you need to do anything", es: "Decirle si tiene que hacer algo" },
    ],
    requestedTool: "operator_review",
    documentRecommended: true,
    documentLabel: { en: "Add a photo of the paper", es: "Añada una foto del papel" },
    fields: [
      {
        field: "subject",
        label: { en: "Tell VYVA in your own words", es: "Cuénteselo a VYVA con sus palabras" },
        hint: {
          en: "For example, I got a letter from the bank and I don't understand it",
          es: "Por ejemplo, me ha llegado una carta del banco y no la entiendo",
        },
        why: {
          en: "A sentence or two is enough. VYVA will ask if anything else is needed.",
          es: "Con una o dos frases basta. VYVA le preguntará si hace falta algo más.",
        },
        multiline: true,
      },
    ],
    outcome: {
      en: "an explanation of what this is and what, if anything, to do",
      es: "una explicación de qué es y qué hacer, si hace falta",
    },
    nearby: [],
  },
];

export function documentHelpOption(kind: DocumentHelpKind | null | undefined): DocumentHelpOption | null {
  return DOCUMENT_HELP_OPTIONS.find((option) => option.key === kind) ?? null;
}

export function documentHelpText(copy: Copy, isSpanish: boolean): string {
  return pick(copy, isSpanish);
}

export function documentHelpStepLabel(step: DocumentHelpStep, isSpanish: boolean): string {
  const labels: Record<DocumentHelpStep, Copy> = {
    choose: { en: "Choose", es: "Elegir" },
    details: { en: "Add details", es: "Añadir datos" },
    review: { en: "Review", es: "Revisar" },
    confirm: { en: "Confirm", es: "Confirmar" },
  };
  return pick(labels[step], isSpanish);
}

export function formatDocumentDate(iso: string, language: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(language, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export function formatDocumentAmount(amount: DocumentHelpAmount, language: string): string {
  if (amount.currency && /^[A-Z]{3}$/.test(amount.currency)) {
    try {
      return new Intl.NumberFormat(language, { style: "currency", currency: amount.currency }).format(amount.amount);
    } catch {
      // Fall through to a plain number when the currency code is unknown.
    }
  }
  const number = new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount.amount);
  return amount.currency ? `${number} ${amount.currency}` : number;
}

export function documentAmountKindLabel(kind: DocumentHelpAmount["kind"], isSpanish: boolean): string | null {
  switch (kind) {
    case "due":
      return isSpanish ? "A pagar" : "To pay";
    case "reimbursable":
      return isSpanish ? "Se podría devolver" : "Could be paid back";
    case "paid":
      return isSpanish ? "Ya pagado" : "Already paid";
    default:
      return null;
  }
}

export type DocumentHelpDeadline = {
  urgency: DocumentHelpUrgency;
  /** Where the date came from, so the UI can say so. */
  source: "document" | "member" | null;
  display: string | null;
};

export function documentHelpDeadline(
  reading: DocumentHelpReading | null,
  details: DocumentHelpDetails,
  language: string,
  today: Date = new Date(),
): DocumentHelpDeadline {
  const documentDeadline = reading?.status === "read" ? primaryDocumentDeadline(reading) : null;
  if (documentDeadline?.date) {
    return {
      urgency: documentHelpUrgency(documentDeadline.date, today),
      source: "document",
      display: formatDocumentDate(documentDeadline.date, language),
    };
  }
  const typed = parseTypedDocumentDate(details.deadline);
  if (typed) {
    return { urgency: documentHelpUrgency(typed, today), source: "member", display: formatDocumentDate(typed, language) };
  }
  const freeText = details.deadline.trim() || documentDeadline?.text || null;
  return { urgency: { level: "unknown" }, source: freeText ? (details.deadline.trim() ? "member" : "document") : null, display: freeText };
}

/** Present only when the member typed a full date that disagrees with the document. */
export function documentHelpDateConflict(reading: DocumentHelpReading | null, details: DocumentHelpDetails): { typed: string; document: string } | null {
  const documentDeadline = reading?.status === "read" ? primaryDocumentDeadline(reading) : null;
  const typed = parseTypedDocumentDate(details.deadline);
  if (!documentDeadline?.date || !typed || typed === documentDeadline.date) return null;
  return { typed, document: documentDeadline.date };
}

export function documentHelpHasDetails(details: DocumentHelpDetails): boolean {
  return Object.values(details).some((value) => value.trim().length > 0);
}
