import { forwardRef, useId } from "react";
import { Check, Eye, ListChecks, RotateCcw, ShieldOff, Sparkles } from "lucide-react";

type DocumentHelpConfirmationProps = {
  isSpanish: boolean;
  whatHappens: string;
  shared: string[];
  notHappening: string[];
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  showCheckError: boolean;
};

// The human-readable contract shown before VYVA's team starts work.
// One card, divided by rules rather than nested boxes.
export const DocumentHelpConfirmation = forwardRef<HTMLInputElement, DocumentHelpConfirmationProps>(
  function DocumentHelpConfirmation({ isSpanish, whatHappens, shared, notHappening, checked, onCheckedChange, showCheckError }, checkboxRef) {
    const checkboxId = useId();
    const errorId = useId();
    const rows = [
      {
        Icon: Sparkles,
        title: isSpanish ? "Qué va a pasar" : "What will happen",
        body: <p>{whatHappens}</p>,
      },
      {
        Icon: Eye,
        title: isSpanish ? "Quién lo verá" : "Who will see it",
        body: <p>{isSpanish ? "Solo el equipo de VYVA que le ayuda. Nadie más." : "Only the VYVA team helping you. Nobody else."}</p>,
      },
      {
        Icon: ListChecks,
        title: isSpanish ? "Qué se comparte con ellos" : "What will be shared with them",
        body: (
          <>
            <ul className="list-disc space-y-1.5 pl-5">
              {shared.map((line) => <li key={line} className="break-words">{line}</li>)}
            </ul>
            <p className="dh-muted mt-2">
              {isSpanish
                ? "Su foto o archivo no se comparte, solo los datos de arriba."
                : "Your photo or file isn't shared — only the details above."}
            </p>
          </>
        ),
      },
      {
        Icon: ShieldOff,
        title: isSpanish ? "Qué no va a pasar" : "What won't happen",
        body: (
          <ul className="space-y-1.5">
            {notHappening.map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <Check size={20} strokeWidth={2.75} className="mt-1 flex-shrink-0" style={{ color: "var(--dh-safe)" }} aria-hidden="true" />
                <span className="break-words">{line}</span>
              </li>
            ))}
          </ul>
        ),
      },
      {
        Icon: RotateCcw,
        title: isSpanish ? "¿Puedo cambiar de opinión?" : "Can I change my mind?",
        body: (
          <p>
            {isSpanish
              ? "Sí. Puede cancelarlo desde sus tareas en cualquier momento. Antes de enviar nada a nadie, VYVA le volverá a preguntar."
              : "Yes. You can cancel this from your tasks at any time. Before anything is sent to anyone, VYVA will ask you again."}
          </p>
        ),
      },
    ];

    return (
      <div className="space-y-5" data-testid="document-help-confirmation">
        <div className="dh-card divide-y" style={{ borderColor: "var(--dh-border)" }}>
          {rows.map(({ Icon, title, body }) => (
            <section key={title} className="flex gap-4 p-5 sm:p-6" style={{ borderColor: "var(--dh-border)" }}>
              <Icon size={26} className="mt-0.5 flex-shrink-0" style={{ color: "var(--dh-accent)" }} aria-hidden="true" />
              <div className="min-w-0 flex-1 font-body text-[18px] leading-relaxed">
                <h3 className="mb-1 text-[20px] font-bold leading-snug">{title}</h3>
                {body}
              </div>
            </section>
          ))}
        </div>

        <div
          className="flex items-start gap-4 rounded-[16px] border-2 p-4"
          style={{
            borderColor: showCheckError ? "var(--dh-danger)" : checked ? "var(--dh-accent)" : "var(--dh-border-strong)",
            background: checked ? "var(--dh-accent-soft)" : "var(--dh-surface)",
          }}
        >
          <input
            ref={checkboxRef}
            id={checkboxId}
            type="checkbox"
            checked={checked}
            onChange={(event) => onCheckedChange(event.target.checked)}
            aria-describedby={showCheckError ? errorId : undefined}
            aria-invalid={showCheckError || undefined}
            className="mt-0.5 h-8 w-8 flex-shrink-0 cursor-pointer"
            style={{ accentColor: "var(--dh-accent)" }}
            data-testid="checkbox-document-help-confirm"
          />
          <label htmlFor={checkboxId} className="cursor-pointer font-body text-[19px] font-semibold leading-snug">
            {isSpanish
              ? "He revisado los datos y quiero que el equipo de VYVA prepare esto."
              : "I've checked the details and I'd like VYVA's team to prepare this."}
          </label>
        </div>
        {showCheckError ? (
          <p id={errorId} role="alert" className="font-body text-[18px] font-bold" style={{ color: "var(--dh-danger)" }}>
            {isSpanish ? "Marque la casilla para confirmar, por favor." : "Please tick the box to confirm first."}
          </p>
        ) : null}
      </div>
    );
  },
);
