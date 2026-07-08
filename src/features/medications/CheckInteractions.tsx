import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, MessageCircle, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

type InteractionFlag = {
  id: string;
  kind: "rule" | "duplicate_class";
  ruleId?: string;
  medicineIds: string[];
  medicines: string[];
  message: string;
  severityTier: "worth_asking";
  canDismiss: boolean;
};

type InteractionResponse = {
  flags: InteractionFlag[];
  hasMore: boolean;
  reviewedRuleCount: number;
  activeMedicineCount: number;
  message: string;
};

export default function CheckInteractions() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery<InteractionResponse>({
    queryKey: ["/api/meds/interactions"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const flags = data?.flags ?? [];
  const activeCount = data?.activeMedicineCount ?? 0;
  const flagSummary = (flag: InteractionFlag) => flag.kind === "duplicate_class"
    ? t("meds.checkInteractions.duplicateShort", "Similar medicines. Check if both are needed.")
    : t("meds.checkInteractions.ruleShort", "Check before taking together.");

  return (
    <section
      className="mt-5 rounded-[26px] border border-[#F0DEC3] bg-white p-5 shadow-[0_14px_32px_rgba(63,45,35,0.07)]"
      data-testid="section-check-interactions"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-[56px] w-[56px] flex-shrink-0 items-center justify-center rounded-[18px] bg-[#FFF7ED] text-[#B45309]">
          <ShieldCheck size={28} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-body text-[14px] font-black uppercase tracking-[0.08em] text-vyva-purple">
            {t("meds.checkInteractions.kicker", "Medicine Safety")}
          </p>
          <h2 className="mt-1 font-body text-[30px] font-black leading-tight text-vyva-text-1">
            {t("meds.checkInteractions.title", "Safety Check")}
          </h2>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-5 rounded-[24px] border border-[#F0DEC3] bg-[#FFFBF5] p-5" data-testid="status-med-interactions-loading">
          <p className="font-body text-[22px] font-black text-vyva-text-1">
            {t("meds.checkInteractions.loading", "Checking your list...")}
          </p>
        </div>
      ) : isError ? (
        <div className="mt-5 flex items-start gap-3 rounded-[24px] border border-[#FBCACA] bg-[#FEF2F2] p-5" role="alert">
          <AlertCircle className="mt-1 flex-shrink-0 text-[#B91C1C]" size={26} aria-hidden="true" />
          <p className="font-body text-[20px] font-black leading-snug text-[#991B1B]">
            {t("meds.checkInteractions.error", "I could not check this right now. Please try again.")}
          </p>
        </div>
      ) : flags.length === 0 ? (
        <div
          className="mt-5 flex items-start gap-4 rounded-[24px] border border-[#BDEBD8] bg-[#F0FDFA] p-5"
          data-testid="status-med-interactions-clear"
        >
          <CheckCircle2 className="mt-1 flex-shrink-0 text-[#0F766E]" size={30} aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-body text-[24px] font-black leading-tight text-[#0F4C45]">
              {t("meds.checkInteractions.clearTitle", "Looks safe today")}
            </p>
            <p className="mt-2 font-body text-[20px] font-bold leading-snug text-[#0F4C45]">
              {t(
                "meds.checkInteractions.clearSub",
                "No safety questions from the rules VYVA checked.",
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {flags.map((flag, index) => (
            <article
              key={flag.id}
              className="rounded-[24px] border border-[#F0DEC3] bg-[#FFFBF5] p-5"
              data-testid={`card-med-interaction-${index}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-[54px] w-[54px] flex-shrink-0 items-center justify-center rounded-[18px] bg-[#FEF3C7] text-[#B45309]">
                  <MessageCircle size={26} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-body text-[24px] font-black leading-tight text-vyva-text-1">
                    {flag.medicines.join(" + ")}
                  </h3>
                  <p className="mt-2 font-body text-[20px] font-bold leading-snug text-vyva-text-2">
                    {flagSummary(flag)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="mt-4 font-body text-[16px] font-bold leading-snug text-vyva-text-2">
        {t("meds.checkInteractions.footer", {
          count: activeCount,
          defaultValue: "{{count}} medicines checked. VYVA never changes doses.",
        })}
      </p>
    </section>
  );
}
