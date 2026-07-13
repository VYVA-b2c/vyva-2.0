import { AlertTriangle, CircleCheck, ShieldCheck } from "lucide-react";
import type {
  ConciergeToolReadinessResult,
} from "../../../shared/conciergeToolReadiness";

type ActionReadinessPanelProps = {
  readiness: ConciergeToolReadinessResult;
  desiredAction: string;
  recipient?: string;
  isSpanish: boolean;
  compact?: boolean;
  testId?: string;
};

function toolLabel(tool: ConciergeToolReadinessResult["activeTool"], isSpanish: boolean): string {
  switch (tool) {
    case "phone_call":
      return isSpanish ? "llamada" : "phone call";
    case "email":
      return isSpanish ? "email" : "email";
    case "whatsapp":
      return "WhatsApp";
    case "booking_link":
      return isSpanish ? "enlace de reserva" : "booking link";
    case "camera_or_upload":
      return isSpanish ? "camara o subida" : "camera or upload";
    case "web_search":
      return isSpanish ? "busqueda web" : "web search";
    case "operator_review":
      return isSpanish ? "revision VYVA" : "VYVA review";
    default:
      return tool;
  }
}

function missingDetailLabel(detail: string, isSpanish: boolean): string {
  switch (detail) {
    case "phone":
    case "phone_call":
      return isSpanish ? "telefono" : "phone number";
    case "email":
      return isSpanish ? "email" : "email";
    case "whatsapp":
      return "WhatsApp";
    case "booking_url":
    case "booking_link":
      return isSpanish ? "enlace de reserva" : "booking link";
    case "operator_review":
      return isSpanish ? "revision VYVA" : "VYVA review";
    case "tool_setup":
      return isSpanish ? "configuracion de herramienta" : "tool setup";
    default:
      return detail.replace(/_/g, " ");
  }
}

function readinessCopy(readiness: ConciergeToolReadinessResult, isSpanish: boolean) {
  if (readiness.status === "ready") {
    return {
      Icon: CircleCheck,
      tone: "ready",
      title: isSpanish ? "Herramienta lista" : "Tool ready",
      summary: isSpanish
        ? "VYVA puede preparar esta via y se detiene antes de actuar."
        : "VYVA can prepare this route and stops before acting.",
    };
  }

  if (readiness.status === "manual_review") {
    return {
      Icon: ShieldCheck,
      tone: "review",
      title: isSpanish ? "Revision disponible" : "Review path ready",
      summary: isSpanish
        ? "La via directa no esta lista. VYVA prepara un resumen revisable."
        : "The direct route is not ready. VYVA prepares a reviewable summary.",
    };
  }

  return {
    Icon: AlertTriangle,
    tone: "blocked",
    title: isSpanish ? "Falta configuracion" : "Setup needed",
    summary: isSpanish
      ? "Guarda los datos o pide a VYVA que prepare solo un borrador."
      : "Save the details or ask VYVA to prepare a draft only.",
  };
}

export default function ActionReadinessPanel({
  readiness,
  desiredAction,
  recipient,
  isSpanish,
  compact = false,
  testId = "panel-action-readiness",
}: ActionReadinessPanelProps) {
  const copy = readinessCopy(readiness, isSpanish);
  const Icon = copy.Icon;
  const missingText = readiness.missing
    .map((item) => missingDetailLabel(item, isSpanish))
    .join(", ");
  const tone = copy.tone === "ready"
    ? { border: "#99F6E4", bg: "#F0FDFA", icon: "#0F766E", chip: "#CCFBF1" }
    : copy.tone === "review"
      ? { border: "#DDD6FE", bg: "#FBF8FF", icon: "#6B21A8", chip: "#F3E8FF" }
      : { border: "#FECACA", bg: "#FFFBFB", icon: "#B91C1C", chip: "#FEE2E2" };

  return (
    <span
      className={`${compact ? "mt-3 p-3" : "p-4"} block rounded-[18px] border`}
      style={{ borderColor: tone.border, background: tone.bg }}
      data-testid={testId}
    >
      <span className="flex items-start gap-2.5">
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[13px] bg-white shadow-sm"
          style={{ color: tone.icon }}
        >
          <Icon size={17} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block font-body text-[12px] font-black uppercase tracking-[0.08em]" style={{ color: tone.icon }}>
            {copy.title}
          </span>
          <span className="mt-0.5 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">
            {copy.summary}
          </span>
        </span>
      </span>

      <span className="mt-3 grid gap-1.5">
        <span className="rounded-[13px] bg-white px-3 py-2 font-body text-[11px] font-black leading-snug text-vyva-text-1">
          {isSpanish ? "Accion" : "Action"}: {desiredAction}
        </span>
        {recipient ? (
          <span className="rounded-[13px] bg-white px-3 py-2 font-body text-[11px] font-black leading-snug text-vyva-text-1">
            {isSpanish ? "Destino" : "Recipient"}: {recipient}
          </span>
        ) : null}
        <span className="rounded-[13px] bg-white px-3 py-2 font-body text-[11px] font-black leading-snug text-vyva-text-1">
          {isSpanish ? "Herramienta directa" : "Direct tool"}: {toolLabel(readiness.requestedTool, isSpanish)}
        </span>
        <span
          className="rounded-full px-3 py-1.5 font-body text-[11px] font-black leading-snug"
          style={{ background: tone.chip, color: tone.icon }}
        >
          {isSpanish ? "Ruta actual" : "Current path"}: {toolLabel(readiness.activeTool, isSpanish)}
        </span>
        {missingText ? (
          <span className="rounded-[13px] bg-white px-3 py-2 font-body text-[11px] font-black leading-snug text-vyva-text-1">
            {isSpanish ? "Falta" : "Needs"}: {missingText}
          </span>
        ) : null}
      </span>
    </span>
  );
}
