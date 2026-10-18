import { useId, type ReactNode } from "react";
import { AlertTriangle, BookOpen, FileSearch, Lightbulb, Pencil, UserRound } from "lucide-react";

export type DocumentHelpSource = "document" | "member" | "suggestion" | "explanation";

type DocumentHelpReviewSectionProps = {
  title: string;
  source?: DocumentHelpSource;
  isSpanish: boolean;
  onEdit?: () => void;
  editLabel?: string;
  children: ReactNode;
  testId?: string;
};

const SOURCE_ICON = {
  document: FileSearch,
  member: UserRound,
  suggestion: Lightbulb,
  explanation: BookOpen,
} as const;

export function documentHelpSourceLabel(source: DocumentHelpSource, isSpanish: boolean): string {
  switch (source) {
    case "document":
      return isSpanish ? "Leído en su documento" : "Found in your document";
    case "member":
      return isSpanish ? "Lo que usted ha contado" : "What you told VYVA";
    case "explanation":
      return isSpanish ? "Explicado por VYVA" : "Explained by VYVA";
    default:
      return isSpanish ? "Sugerencia de VYVA" : "VYVA's suggestion";
  }
}

// One flat card per topic. Facts and suggestions are labelled at the section level,
// so the member always knows whether something came from the paper or from VYVA.
export function DocumentHelpReviewSection({
  title,
  source,
  isSpanish,
  onEdit,
  editLabel,
  children,
  testId,
}: DocumentHelpReviewSectionProps) {
  const headingId = useId();
  const SourceIcon = source ? SOURCE_ICON[source] : null;

  return (
    <section aria-labelledby={headingId} className="dh-card p-5 sm:p-6" data-testid={testId}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 id={headingId} className="font-body text-[22px] font-bold leading-snug">{title}</h3>
          {source && SourceIcon ? (
            <p className={`dh-tag mt-2 ${source === "suggestion" || source === "explanation" ? "dh-tone-accent" : source === "document" ? "dh-tone-info" : "dh-tone-neutral"}`}>
              <SourceIcon size={18} aria-hidden="true" />
              {documentHelpSourceLabel(source, isSpanish)}
            </p>
          ) : null}
        </div>
        {onEdit ? (
          <button
            type="button"
            className="dh-btn dh-btn-secondary !min-h-[48px] !px-4 font-body !text-[17px]"
            onClick={onEdit}
            aria-label={editLabel ?? `${isSpanish ? "Cambiar" : "Edit"}: ${title}`}
          >
            <Pencil size={20} aria-hidden="true" />
            {isSpanish ? "Cambiar" : "Edit"}
          </button>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export type DocumentHelpFact = {
  label: string;
  value: string;
  note?: string | null;
  /** Low-confidence reads are flagged in words as well as colour. */
  needsCheck?: boolean;
  empty?: boolean;
};

export function DocumentHelpFactList({ facts, isSpanish }: { facts: DocumentHelpFact[]; isSpanish: boolean }) {
  return (
    <dl className="divide-y" style={{ borderColor: "var(--dh-border)" }}>
      {facts.map((fact, index) => (
        <div
          key={`${fact.label}-${index}`}
          className={`grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(9rem,14rem)_1fr] sm:gap-4 ${fact.needsCheck ? "-mx-3 rounded-[12px] px-3 dh-tone-warn" : ""}`}
          style={{ borderColor: "var(--dh-border)" }}
        >
          <dt className="dh-muted font-body text-[17px] font-semibold leading-snug">{fact.label}</dt>
          <dd className="min-w-0 break-words font-body text-[19px] font-semibold leading-snug" style={{ color: fact.empty ? "var(--dh-text-muted)" : "var(--dh-text)" }}>
            {fact.value}
            {fact.note ? <span className="dh-muted mt-0.5 block text-[17px] font-normal">{fact.note}</span> : null}
            {fact.needsCheck ? (
              <span className="mt-1 flex items-center gap-1.5 text-[17px] font-bold" style={{ color: "var(--dh-warn)" }}>
                <AlertTriangle size={18} aria-hidden="true" />
                {isSpanish ? "Compruébelo con el papel" : "Please check this against the paper"}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
