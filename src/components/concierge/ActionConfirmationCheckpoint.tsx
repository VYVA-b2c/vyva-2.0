import { CircleCheck, Loader2, ShieldCheck } from "lucide-react";

type ConfirmationCheckpointItem = {
  label: string;
  helper?: string;
};

type ActionConfirmationCheckpointProps = {
  title: string;
  summary: string;
  items: ConfirmationCheckpointItem[];
  primaryLabel: string;
  onConfirm: () => void;
  isPending?: boolean;
  disabled?: boolean;
  testId?: string;
  buttonTestId?: string;
  isDark?: boolean;
};

export default function ActionConfirmationCheckpoint({
  title,
  summary,
  items,
  primaryLabel,
  onConfirm,
  isPending = false,
  disabled = false,
  testId = "panel-action-confirmation-checkpoint",
  buttonTestId = "button-action-confirmation-checkpoint",
  isDark = false,
}: ActionConfirmationCheckpointProps) {
  return (
    <div
      className={`rounded-[18px] border p-3 sm:p-4 ${isDark ? "border-white/[0.14] bg-white/[0.045]" : "border-[#99F6E4] bg-[#F8FFFC]"}`}
      data-testid={testId}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] ${isDark ? "bg-white/[0.07] text-[#5EEAD4] shadow-none" : "bg-white text-[#0F766E] shadow-sm"}`}>
          <ShieldCheck size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`font-body text-[12px] font-black uppercase tracking-[0.1em] ${isDark ? "text-[#5EEAD4]" : "text-[#0F766E]"}`}>
            {title}
          </p>
          <p className={`mt-1 font-body text-[13px] font-black leading-snug ${isDark ? "text-[#FFF8FF]" : "text-vyva-text-1"}`}>
            {summary}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div
            key={item.label}
            className={`flex items-start gap-2 rounded-[14px] border px-3 py-2 ${isDark ? "border-white/[0.1] bg-white/[0.055]" : "border-transparent bg-white"}`}
          >
            <CircleCheck
              size={15}
              className={`mt-0.5 flex-shrink-0 ${isDark ? "text-[#5EEAD4]" : "text-[#0F766E]"}`}
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className={`block font-body text-[12px] font-black leading-snug ${isDark ? "text-[#FFF8FF]" : "text-vyva-text-1"}`}>
                {item.label}
              </span>
              {item.helper ? (
                <span className={`mt-0.5 block font-body text-[11px] font-semibold leading-snug ${isDark ? "text-[#CFC4D8]" : "text-vyva-text-2"}`}>
                  {item.helper}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled || isPending}
        data-testid={buttonTestId}
        className={`vyva-tap mt-3 inline-flex min-h-[46px] w-full items-center justify-center rounded-full px-5 font-body text-[14px] font-black text-white disabled:opacity-60 ${isDark ? "bg-[#0D9488] shadow-[0_10px_28px_rgba(13,148,136,0.22)]" : "bg-[#0F766E]"}`}
      >
        {isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
        {primaryLabel}
      </button>
    </div>
  );
}
