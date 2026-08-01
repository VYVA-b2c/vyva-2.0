import {
  buildConciergeConfirmationReceipt,
  type ConciergeConfirmationReceipt,
  type ConciergeConfirmationReceiptDetail,
  type ConciergeConfirmationReceiptInput,
} from "./conciergeConfirmationReceipt";
import {
  getWorkflowDefinition,
  workflowActionLevelForReference,
  WORKFLOW_ACTION_LEVEL_LABELS,
  WORKFLOW_ACTION_LEVEL_RULES,
  type WorkflowActionLevel,
  type WorkflowReference,
} from "./workflowRegistry";

export type WorkflowReceiptStatus =
  | "done"
  | "saved"
  | "prepared"
  | "waiting"
  | "needs_review"
  | "failed"
  | "cancelled";

export type WorkflowReceiptLocale = "en" | "es";

export type WorkflowReceiptDetail = {
  key: string;
  label: string;
  value: string;
};

export type WorkflowReceiptMomentInput = {
  workflowReference: WorkflowReference;
  status?: WorkflowReceiptStatus;
  actionLabel?: string | null;
  subject?: string | null;
  capturedSummary?: string | null;
  nextStep?: string | null;
  details?: WorkflowReceiptDetail[];
  conciergeReceiptInput?: ConciergeConfirmationReceiptInput | null;
  locale?: WorkflowReceiptLocale;
};

export type WorkflowReceiptMoment = {
  workflowReference: WorkflowReference;
  workflowTitle: string;
  actionLevel: WorkflowActionLevel;
  actionLevelLabel: string;
  actionLevelRule: string;
  status: WorkflowReceiptStatus;
  statusLabel: string;
  title: string;
  message: string;
  nextStep: string;
  primaryActionLabel: string;
  secondaryActionLabel?: string;
  requiresFinalConfirmation: boolean;
  details: WorkflowReceiptDetail[];
  conciergeReceipt?: ConciergeConfirmationReceipt;
};

function text(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function isSpanish(locale: WorkflowReceiptLocale | undefined): boolean {
  return locale === "es";
}

function statusLabel(status: WorkflowReceiptStatus, spanish: boolean): string {
  const labels: Record<WorkflowReceiptStatus, [string, string]> = {
    done: ["Done", "Listo"],
    saved: ["Saved", "Guardado"],
    prepared: ["Prepared", "Preparado"],
    waiting: ["Waiting", "Esperando"],
    needs_review: ["Needs review", "Necesita revision"],
    failed: ["Needs attention", "Necesita atencion"],
    cancelled: ["Cancelled", "Cancelado"],
  };
  return labels[status][spanish ? 1 : 0];
}

function defaultStatusForLevel(level: WorkflowActionLevel): WorkflowReceiptStatus {
  if (level === "external_action") return "prepared";
  if (level === "setup") return "saved";
  return "done";
}

function primaryActionForLevel(level: WorkflowActionLevel, spanish: boolean): string {
  if (level === "external_action") return spanish ? "Revisar recibo" : "Review receipt";
  if (level === "setup") return spanish ? "Continuar" : "Continue";
  return spanish ? "Continuar" : "Continue";
}

function titleForLevel(level: WorkflowActionLevel, status: WorkflowReceiptStatus, workflowTitle: string, spanish: boolean): string {
  if (status === "failed") return spanish ? "Revisemos esto" : "Let us review this";
  if (status === "cancelled") return spanish ? "Nada se envio" : "Nothing was sent";
  if (level === "setup") return spanish ? "Listo para futuras ayudas" : "Ready for future help";
  if (level === "external_action") return spanish ? "Accion preparada" : "Action prepared";
  if (level === "guided") return spanish ? "Guardado con contexto" : "Saved with context";
  if (level === "admin") return spanish ? "Guardado para el equipo" : "Saved for the team";
  return spanish ? `${workflowTitle} listo` : `${workflowTitle} done`;
}

function messageForLevel(input: WorkflowReceiptMomentInput, level: WorkflowActionLevel, workflowTitle: string, spanish: boolean): string {
  const summary = text(input.capturedSummary);
  const subject = text(input.subject);
  if (summary) return summary;
  if (level === "setup") {
    return spanish
      ? "VYVA puede usar esto la proxima vez que pidas ayuda."
      : "VYVA can use this next time you ask for help.";
  }
  if (level === "external_action") {
    return spanish
      ? "VYVA preparo la accion. Nada externo ocurre sin tu confirmacion final."
      : "VYVA prepared the action. Nothing external happens without your final confirmation.";
  }
  if (level === "guided") {
    return subject
      ? (spanish ? `VYVA guardo ${subject} y mantiene el siguiente paso claro.` : `VYVA saved ${subject} and kept the next step clear.`)
      : (spanish ? "VYVA guardo los detalles importantes." : "VYVA saved the important details.");
  }
  if (level === "admin") {
    return spanish ? "El equipo puede revisar esto cuando sea necesario." : "The team can review this when needed.";
  }
  return spanish ? "Puedes seguir cuando quieras." : "You can continue when you are ready.";
}

function nextStepForLevel(input: WorkflowReceiptMomentInput, level: WorkflowActionLevel, workflowNextStep: string | undefined, spanish: boolean): string {
  const explicit = text(input.nextStep);
  if (explicit) return explicit;
  if (level === "external_action") {
    return spanish
      ? "Revisa los detalles y confirma antes de llamar, enviar, reservar o compartir."
      : "Review the details and confirm before calling, sending, booking, or sharing.";
  }
  if (level === "setup") {
    return spanish
      ? "La proxima vez, VYVA puede saltar preguntas repetidas."
      : "Next time, VYVA can skip repeated questions.";
  }
  return workflowNextStep ?? (spanish ? "Continua cuando estes listo." : "Continue when you are ready.");
}

function fromConciergeDetails(details: ConciergeConfirmationReceiptDetail[]): WorkflowReceiptDetail[] {
  return details.map((detail) => ({
    key: detail.key,
    label: detail.label,
    value: detail.value,
  }));
}

export function buildWorkflowReceiptMoment(input: WorkflowReceiptMomentInput): WorkflowReceiptMoment {
  const workflow = getWorkflowDefinition(input.workflowReference);
  const actionLevel = workflowActionLevelForReference(input.workflowReference);
  const spanish = isSpanish(input.locale);
  const status = input.status ?? defaultStatusForLevel(actionLevel);
  const conciergeReceipt = input.conciergeReceiptInput && actionLevel === "external_action"
    ? buildConciergeConfirmationReceipt(input.conciergeReceiptInput, spanish)
    : undefined;
  const details = [
    ...(input.details ?? []),
    ...(conciergeReceipt ? fromConciergeDetails(conciergeReceipt.details) : []),
  ];

  return {
    workflowReference: workflow.reference,
    workflowTitle: workflow.title,
    actionLevel,
    actionLevelLabel: WORKFLOW_ACTION_LEVEL_LABELS[actionLevel],
    actionLevelRule: WORKFLOW_ACTION_LEVEL_RULES[actionLevel],
    status,
    statusLabel: conciergeReceipt?.statusLabel ?? statusLabel(status, spanish),
    title: conciergeReceipt
      ? `${conciergeReceipt.flowLabel}: ${conciergeReceipt.statusLabel}`
      : titleForLevel(actionLevel, status, text(input.actionLabel) || workflow.title, spanish),
    message: conciergeReceipt?.whatVyvaDid ?? messageForLevel(input, actionLevel, workflow.title, spanish),
    nextStep: conciergeReceipt?.nextStep ?? nextStepForLevel(input, actionLevel, workflow.nextStep, spanish),
    primaryActionLabel: primaryActionForLevel(actionLevel, spanish),
    secondaryActionLabel: actionLevel === "external_action" ? (spanish ? "Cambiar detalles" : "Change details") : undefined,
    requiresFinalConfirmation: actionLevel === "external_action",
    details,
    conciergeReceipt,
  };
}
