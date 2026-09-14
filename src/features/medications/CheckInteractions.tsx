import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, MessageCircle, Pill, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CanonicalFlowIcon } from "@/components/CanonicalDetailFlowShell";

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

export default function CheckInteractions({
  onAskAboutCombination,
}: {
  onAskAboutCombination?: () => void;
}) {
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
      className="mt-3 rounded-[28px] border border-[#E6DCEB] bg-white p-[22px] shadow-[0_16px_40px_rgba(63,45,75,0.08)]"
      data-testid="section-check-interactions"
      data-accent-contract="ask-dr-ai-surface"
    >
      <div className="flex items-start gap-3">
        <CanonicalFlowIcon icon={MessageCircle} goldAccent="chat" />
        <div className="min-w-0 flex-1">
          <p className="font-body text-[14px] font-black uppercase tracking-[0.08em] text-[#854F0B]">
            {t("meds.checkInteractions.kicker", "Drug combinations")}
          </p>
          <h2 className="mt-1 font-body text-[28px] font-extrabold leading-[1.08] tracking-[-0.025em] text-[#241238] sm:text-[31px]">
            {t("meds.checkInteractions.title", "Check medicines together")}
          </h2>
          <p className="mt-2 font-body text-[14px] font-semibold leading-[1.42] text-vyva-text-2">
            {t("meds.checkInteractions.intro", "Review saved medicines and supplements, then get plain-language guidance on questions to raise with a pharmacist or doctor.")}
          </p>
        </div>
      </div>

      {onAskAboutCombination ? (
        <button
          type="button"
          data-testid="button-med-combination-advice"
          onClick={onAskAboutCombination}
          className="vyva-tap mt-5 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] bg-vyva-purple px-5 font-body text-[17px] font-black text-white shadow-[0_10px_22px_rgba(112,36,196,0.18)] transition hover:bg-[#5F1D9E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#D9C2F3]"
        >
          <Sparkles size={20} strokeWidth={2.5} aria-hidden="true" />
          {t("meds.checkInteractions.adviceCta", "Get combination advice")}
        </button>
      ) : null}

      {isLoading ? (
        <div className="mt-5 rounded-[18px] border border-[#F0DEC3] bg-[#FFFBF5] p-4" data-testid="status-med-interactions-loading">
          <p className="font-body text-[18px] font-black text-vyva-text-1">
            {t("meds.checkInteractions.loading", "Checking your list...")}
          </p>
        </div>
      ) : isError ? (
        <div className="mt-5 flex items-start gap-3 rounded-[18px] border border-[#FBCACA] bg-[#FEF2F2] p-4" role="alert">
          <CanonicalFlowIcon icon={AlertCircle} tone="red" goldAccent="status" />
          <p className="font-body text-[16px] font-black leading-snug text-[#991B1B]">
            {t("meds.checkInteractions.error", "I could not check this right now. Please try again.")}
          </p>
        </div>
      ) : activeCount === 0 ? (
        <div
          className="mt-5 flex items-start gap-3 rounded-[18px] border border-[#DDD6FE] bg-[#FAF5FF] p-4"
          data-testid="status-med-interactions-empty"
        >
          <CanonicalFlowIcon icon={Pill} goldAccent="pill" />
          <div className="min-w-0">
            <p className="font-body text-[18px] font-black leading-tight text-vyva-text-1">
              {t("meds.checkInteractions.emptyTitle", "Add a medicine to start")}
            </p>
            <p className="mt-1 font-body text-[14px] font-semibold leading-[1.42] text-vyva-text-2">
              {t("meds.checkInteractions.emptySub", "VYVA needs your current medicine list before it can look for questions worth asking.")}
            </p>
          </div>
        </div>
      ) : flags.length === 0 ? (
        <div
          className="mt-5 flex items-start gap-3 rounded-[18px] border border-[#BDEBD8] bg-[#F0FDFA] p-4"
          data-testid="status-med-interactions-clear"
        >
          <CanonicalFlowIcon icon={CheckCircle2} tone="green" goldAccent="check" />
          <div className="min-w-0">
            <p className="font-body text-[18px] font-black leading-tight text-[#0F4C45]">
              {t("meds.checkInteractions.clearTitle", "No questions found in VYVA's current checks")}
            </p>
            <p className="mt-1 font-body text-[14px] font-semibold leading-[1.42] text-[#0F4C45]">
              {t(
                "meds.checkInteractions.clearSub",
                "The available rules did not flag this saved combination.",
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {flags.map((flag, index) => (
            <article
              key={flag.id}
              className="rounded-[18px] border border-[#F0DEC3] bg-[#FFFBF5] p-4"
              data-testid={`card-med-interaction-${index}`}
            >
              <div className="flex items-start gap-3">
                <CanonicalFlowIcon icon={MessageCircle} tone="amber" goldAccent="chat" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-body text-[17px] font-black leading-tight text-vyva-text-1">
                    {flag.medicines.join(" + ")}
                  </h3>
                  <p className="mt-1 font-body text-[14px] font-bold leading-snug text-vyva-text-2">
                    {flagSummary(flag)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {activeCount > 0 ? (
        <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <p className="font-body text-[15px] font-black leading-snug">
            {t("meds.checkInteractions.footer", {
              count: activeCount,
              defaultValue: "{{count}} medicines checked against VYVA's available rules.",
            })}
          </p>
          <p className="mt-1 font-body text-[14px] font-bold leading-snug">
            {t("meds.checkInteractions.boundary", "This is not a complete interaction review. Ask a pharmacist or doctor about new, changed, or uncertain medicines. VYVA never changes doses.")}
          </p>
        </div>
      ) : null}
    </section>
  );
}
