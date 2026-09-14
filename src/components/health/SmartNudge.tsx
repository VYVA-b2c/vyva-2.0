import { ArrowRight, Sparkles } from "lucide-react";

export type SmartNudgeData = {
  type: string | null;
  color: string | null;
  message: string | null;
  action_route: string | null;
};

type SmartNudgeProps = SmartNudgeData & {
  onSelect?: (route: string) => void;
};

export function SmartNudge({ type, color, message, action_route, onSelect }: SmartNudgeProps) {
  const cleanMessage = message?.trim();
  if (!type || !cleanMessage) return null;

  const content = (
    <>
      <span
        className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white"
        style={{ color: color ?? "#6B21A8" }}
      >
        <Sparkles size={20} strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 font-body text-[16px] font-semibold leading-[1.4] text-[#241C30]">
        {cleanMessage}
      </span>
      {action_route ? <ArrowRight size={20} className="flex-none text-[#927DA4]" aria-hidden="true" /> : null}
    </>
  );

  if (!action_route || !onSelect) {
    return (
      <aside
        className="mb-4 flex min-h-[68px] items-center gap-3 rounded-[18px] border bg-white p-3"
        style={{ borderColor: color ?? "#E7DFE9" }}
        data-testid="smart-nudge"
      >
        {content}
      </aside>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(action_route)}
      className="mb-4 flex min-h-[68px] w-full items-center gap-3 rounded-[18px] border bg-white p-3 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E9D5FF]"
      style={{ borderColor: color ?? "#E7DFE9" }}
      data-testid="smart-nudge"
    >
      {content}
    </button>
  );
}
