import { useId, useState } from "react";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";

type DocumentHelpChoiceCardProps = {
  name: string;
  value: string;
  title: string;
  description: string;
  canDoTitle: string;
  canDo: string[];
  Icon: LucideIcon;
  checked: boolean;
  onSelect: () => void;
  testId?: string;
};

// A native radio wrapped in a large label: arrow keys, screen readers and forced
// colours all work without custom key handling. "What VYVA can do" lives outside
// the label so opening it never changes the selection.
export function DocumentHelpChoiceCard({
  name,
  value,
  title,
  description,
  canDoTitle,
  canDo,
  Icon,
  checked,
  onSelect,
  testId,
}: DocumentHelpChoiceCardProps) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  const panelId = useId();

  return (
    <div className="dh-card dh-choice flex flex-col" data-selected={checked ? "true" : "false"} data-testid={testId}>
      <label className="flex cursor-pointer items-start gap-4 p-5">
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={onSelect}
          aria-describedby={descriptionId}
          className="sr-only"
        />
        <span
          className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[16px]"
          style={{ background: "var(--dh-accent-soft)", color: "var(--dh-accent)" }}
          aria-hidden="true"
        >
          <Icon size={30} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[21px] font-bold leading-snug">{title}</span>
          <span id={descriptionId} className="dh-muted mt-1 block font-body text-[18px] leading-relaxed">
            {description}
          </span>
        </span>
        <span className="dh-radio-mark mt-1" aria-hidden="true">
          {checked ? <Check size={20} strokeWidth={3} /> : null}
        </span>
      </label>
      {canDo.length > 0 ? (
        <div className="border-t px-5 pb-3 pt-1" style={{ borderColor: "var(--dh-border)" }}>
          <button
            type="button"
            className="dh-btn dh-btn-quiet -ml-3 !justify-start !px-3 font-body !text-[17px]"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((current) => !current)}
          >
            {canDoTitle}
            <ChevronDown size={20} aria-hidden="true" className={open ? "rotate-180" : ""} />
          </button>
          <ul id={panelId} hidden={!open} className="mb-2 mt-1 space-y-2 pl-1">
            {canDo.map((line) => (
              <li key={line} className="flex items-start gap-2.5 font-body text-[18px] leading-snug">
                <Check size={20} strokeWidth={2.75} className="mt-0.5 flex-shrink-0" style={{ color: "var(--dh-safe)" }} aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
