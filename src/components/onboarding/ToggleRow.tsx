import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface ToggleRowProps {
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  label?: string;
  sub?: string;
  value?: boolean;
  onToggle?: () => void;
  title?: string;
  description?: string;
  checked?: boolean;
  onChange?: (value: boolean) => void;
  variant?: "default" | "amber";
  rightContent?: ReactNode;
  testId?: string;
}

export function ToggleRow({
  icon: Icon,
  iconBg = "#F5F3FF",
  iconColor = "#6B21A8",
  label,
  sub,
  value,
  onToggle,
  title,
  description,
  checked,
  onChange,
  variant = "default",
  rightContent,
  testId,
}: ToggleRowProps) {
  const displayLabel = title ?? label ?? "";
  const displaySub = description ?? sub;
  const isOn = checked ?? value ?? false;
  const handleToggle = onChange ? () => onChange(!isOn) : onToggle;
  const slugLabel = displayLabel.toLowerCase().replace(/\s+/g, "-");
  const rowTestId = testId ? `${testId}-row` : `row-toggle-${slugLabel}`;
  const btnTestId = testId ?? `toggle-${slugLabel}`;

  return (
    <div
      data-testid={rowTestId}
      className="flex items-center gap-4 px-4 py-4 border-t border-vyva-border"
    >
      {Icon && (
        <div
          className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0"
          style={{ background: iconBg }}
        >
          <Icon size={18} style={{ color: iconColor }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-body text-[17px] font-black leading-tight text-vyva-text-1">{displayLabel}</p>
        {displaySub && <p className="mt-1 font-body text-[14px] leading-snug text-vyva-text-2">{displaySub}</p>}
      </div>
      {rightContent ||
        (handleToggle ? (
          <button
            data-testid={btnTestId}
            onClick={handleToggle}
            aria-pressed={isOn}
            className={`relative h-8 w-14 flex-shrink-0 rounded-full transition-colors ${
              isOn ? (variant === "amber" ? "bg-[#C9890A]" : "bg-vyva-purple") : ""
            }`}
            style={!isOn ? { background: "#DDD5C8" } : {}}
          >
            <div
              className={`absolute top-0.5 h-7 w-7 rounded-full bg-white shadow transition-transform ${
                isOn ? "left-[26px]" : "left-0.5"
              }`}
            />
          </button>
        ) : null)}
    </div>
  );
}
