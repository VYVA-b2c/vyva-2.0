import { useId, useState } from "react";
import { ChevronDown, Lock } from "lucide-react";

type DocumentHelpTrustNoteProps = {
  isSpanish: boolean;
  message?: string;
};

// Sits directly above the primary action: one line of reassurance, details on request.
export function DocumentHelpTrustNote({ isSpanish, message }: DocumentHelpTrustNoteProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div data-testid="document-help-trust-note">
      <p className="flex items-start gap-2.5 font-body text-[18px] font-semibold leading-snug" style={{ color: "var(--dh-safe)" }}>
        <Lock size={22} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
        <span>
          {message ?? (isSpanish
            ? "No se envía ni se comparte nada hasta que usted lo revise y lo apruebe."
            : "Nothing is sent or shared until you review and approve it.")}
        </span>
      </p>
      <button
        type="button"
        className="dh-btn dh-btn-quiet -ml-3 mt-1 !justify-start !px-3 font-body !text-[17px]"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {isSpanish ? "Cómo protege VYVA su información" : "How VYVA protects your information"}
        <ChevronDown size={20} aria-hidden="true" className={open ? "rotate-180" : ""} />
      </button>
      <div id={panelId} hidden={!open} className="mt-2 rounded-[16px] px-4 py-3" style={{ background: "var(--dh-surface-muted)" }}>
        <ul className="list-disc space-y-2 pl-5 font-body text-[18px] leading-relaxed">
          {(isSpanish
            ? [
                "Su foto o archivo solo se usa para leer los datos clave. VYVA no guarda una copia.",
                "VYVA no copia números de cuenta, de póliza ni de documento de identidad.",
                "Solo el equipo de VYVA que le ayuda ve lo que usted aprueba.",
                "VYVA nunca envía, llama, paga ni firma nada sin preguntarle antes.",
              ]
            : [
                "Your photo or file is only used to read the key details. VYVA doesn't keep a copy.",
                "VYVA doesn't copy account, policy or ID numbers.",
                "Only the VYVA team helping you sees what you approve.",
                "VYVA never sends, calls, pays or signs anything without asking you first.",
              ]).map((line) => <li key={line}>{line}</li>)}
        </ul>
      </div>
    </div>
  );
}
