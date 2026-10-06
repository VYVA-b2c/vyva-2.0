import { forwardRef, useId, useState } from "react";
import { CircleHelp, FileSearch } from "lucide-react";

type DocumentHelpFieldProps = {
  label: string;
  hint: string;
  why: string;
  value: string;
  multiline?: boolean;
  /** Shown when VYVA filled the field from the document, so the member knows to check it. */
  fromDocument?: boolean;
  isSpanish: boolean;
  onChange: (value: string) => void;
  testId?: string;
};

export const DocumentHelpField = forwardRef<HTMLInputElement & HTMLTextAreaElement, DocumentHelpFieldProps>(
  function DocumentHelpField({ label, hint, why, value, multiline, fromDocument, isSpanish, onChange, testId }, ref) {
    const inputId = useId();
    const hintId = useId();
    const whyId = useId();
    const [whyOpen, setWhyOpen] = useState(false);
    const describedBy = [hintId, fromDocument ? `${hintId}-doc` : "", whyOpen ? whyId : ""].filter(Boolean).join(" ");

    const shared = {
      id: inputId,
      value,
      "aria-describedby": describedBy,
      "data-testid": testId,
      className: "dh-input font-body",
      onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    };

    return (
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <label htmlFor={inputId} className="font-body text-[19px] font-bold leading-snug">
            {label}
            <span className="dh-muted ml-2 text-[16px] font-semibold">{isSpanish ? "(opcional)" : "(optional)"}</span>
          </label>
        </div>
        <p id={hintId} className="dh-muted mb-2 mt-0.5 font-body text-[17px] leading-snug">{hint}</p>
        {multiline ? (
          <textarea ref={ref} rows={3} {...shared} className={`${shared.className} min-h-[112px] resize-y`} />
        ) : (
          <input ref={ref} type="text" autoComplete="off" {...shared} />
        )}
        {fromDocument ? (
          <p id={`${hintId}-doc`} className="mt-2 flex items-start gap-2 font-body text-[17px] font-semibold" style={{ color: "var(--dh-info)" }}>
            <FileSearch size={20} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            {isSpanish ? "Lo ha rellenado VYVA desde su documento. Compruébelo, por favor." : "VYVA filled this in from your document. Please check it."}
          </p>
        ) : null}
        <button
          type="button"
          className="dh-btn dh-btn-quiet -ml-3 mt-1 !justify-start !px-3 font-body !text-[17px]"
          aria-expanded={whyOpen}
          aria-controls={whyId}
          onClick={() => setWhyOpen((current) => !current)}
        >
          <CircleHelp size={20} aria-hidden="true" />
          {isSpanish ? "¿Por qué se pregunta esto?" : "Why am I being asked this?"}
        </button>
        <p id={whyId} hidden={!whyOpen} className="mt-1 rounded-[14px] px-4 py-3 font-body text-[18px] leading-relaxed" style={{ background: "var(--dh-surface-muted)" }}>
          {why}
        </p>
      </div>
    );
  },
);
