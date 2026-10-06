import { Check } from "lucide-react";
import { DOCUMENT_HELP_STEPS, documentHelpStepLabel, type DocumentHelpStep } from "./documentHelpModel";

type DocumentHelpProgressProps = {
  step: DocumentHelpStep;
  isSpanish: boolean;
};

// Narrow screens get "Step 2 of 4 · Add details"; wider ones get the full row.
// Both read the same to screen readers, so only one is exposed to them.
export function DocumentHelpProgress({ step, isSpanish }: DocumentHelpProgressProps) {
  const activeIndex = DOCUMENT_HELP_STEPS.indexOf(step);
  const position = isSpanish
    ? `Paso ${activeIndex + 1} de ${DOCUMENT_HELP_STEPS.length}`
    : `Step ${activeIndex + 1} of ${DOCUMENT_HELP_STEPS.length}`;

  return (
    <nav aria-label={isSpanish ? "Progreso" : "Progress"} data-testid="document-help-progress" data-step={step}>
      <p className="font-body text-[18px] font-bold sm:hidden">
        {position}
        <span className="dh-muted font-semibold"> · {documentHelpStepLabel(step, isSpanish)}</span>
      </p>
      <ol className="hidden gap-2 sm:grid sm:grid-cols-4" aria-label={position}>
        {DOCUMENT_HELP_STEPS.map((item, index) => {
          const isCurrent = index === activeIndex;
          const isDone = index < activeIndex;
          return (
            <li
              key={item}
              aria-current={isCurrent ? "step" : undefined}
              className="flex min-w-0 flex-col gap-2"
            >
              <span
                aria-hidden="true"
                className="block h-[6px] rounded-full"
                style={{ background: isCurrent || isDone ? "var(--dh-accent)" : "var(--dh-border)" }}
              />
              <span className={`flex items-center gap-1.5 font-body text-[17px] leading-tight ${isCurrent ? "font-bold" : "dh-muted font-semibold"}`}>
                {isDone ? <Check size={18} strokeWidth={3} aria-hidden="true" style={{ color: "var(--dh-accent)" }} /> : null}
                <span className="sr-only">
                  {isDone ? (isSpanish ? "Hecho: " : "Done: ") : isCurrent ? (isSpanish ? "Ahora: " : "Current: ") : ""}
                </span>
                <span className="min-w-0 break-words">{index + 1}. {documentHelpStepLabel(item, isSpanish)}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
