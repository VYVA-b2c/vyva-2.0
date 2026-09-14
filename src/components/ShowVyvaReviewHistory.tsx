import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, CheckCircle2, Clock3, History, ShieldCheck } from "lucide-react";
import {
  readShowVyvaReviewHistory,
  SHOW_VYVA_REVIEW_HISTORY_EVENT,
  type ShowVyvaReviewHistoryItem,
} from "@/lib/showVyvaReviewHistory";

type ShowVyvaReviewHistoryProps = {
  onResume: (item: ShowVyvaReviewHistoryItem) => void;
  maxItems?: number;
  className?: string;
};

function fallbackContextLabel(context: ShowVyvaReviewHistoryItem["followUpContext"]): string {
  if (context === "scam") return "Scam check";
  if (context === "document") return "Document";
  if (context === "medicine") return "Medicine label";
  if (context === "provider_deal") return "Provider or deal";
  if (context === "home_safety") return "Home photo";
  return "Health photo";
}

export default function ShowVyvaReviewHistory({
  onResume,
  maxItems = 5,
  className = "",
}: ShowVyvaReviewHistoryProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ShowVyvaReviewHistoryItem[]>(() => readShowVyvaReviewHistory());

  useEffect(() => {
    const refresh = () => setItems(readShowVyvaReviewHistory());
    window.addEventListener(SHOW_VYVA_REVIEW_HISTORY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SHOW_VYVA_REVIEW_HISTORY_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const visibleItems = items.slice(0, maxItems);
  if (!visibleItems.length) return null;

  return (
    <section
      data-testid="show-vyva-review-history"
      className={`rounded-[20px] border border-[#EDE5DB] bg-white p-4 shadow-[0_12px_30px_rgba(63,45,35,0.07)] ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[15px] bg-[#F0FDFA] text-[#0F766E]">
          <History size={21} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-body text-[11px] font-black uppercase tracking-[0.1em] text-[#0F766E]">
            {t("showVyva.history.kicker", "Recent Show VYVA")}
          </p>
          <h3 className="mt-0.5 font-body text-[19px] font-black leading-tight text-vyva-text-1">
            {t("showVyva.history.title", "Come back to a review")}
          </h3>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid={`button-show-vyva-history-resume-${item.id}`}
            onClick={() => onResume(item)}
            className="vyva-tap flex min-h-[78px] items-center gap-3 rounded-[16px] border border-[#EDE5DB] bg-[#FFFCF8] px-3 py-2 text-left transition active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-white text-vyva-purple">
              <ShieldCheck size={19} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-body text-[11px] font-black uppercase tracking-[0.08em] text-[#7C3AED]">
                {t(`showVyva.history.context.${item.followUpContext}`, fallbackContextLabel(item.followUpContext))}
              </span>
              <span className="mt-0.5 block font-body text-[15px] font-black leading-tight text-vyva-text-1">
                {item.decision}
              </span>
              <span className="mt-1 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-[#F5F3FF] px-2.5 py-1 font-body text-[11px] font-black text-vyva-purple">
                  {item.confidenceLabel}
                </span>
                <span
                  data-testid={`show-vyva-history-action-status-${item.id}`}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-body text-[11px] font-black text-[#6F5F59]"
                >
                  {item.actionSaved ? <CheckCircle2 size={12} aria-hidden="true" /> : <Clock3 size={12} aria-hidden="true" />}
                  {item.actionSaved
                    ? t("showVyva.history.actionSaved", "Action saved")
                    : t("showVyva.history.noActionSaved", "No action saved")}
                </span>
              </span>
            </span>
            <ArrowRight size={18} className="flex-shrink-0 text-[#8A7A73]" aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}

export type { ShowVyvaReviewHistoryItem };
