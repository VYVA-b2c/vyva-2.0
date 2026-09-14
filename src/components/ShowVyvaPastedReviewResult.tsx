import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { showVyvaReviewContractFromPastePayload, type ShowVyvaReviewContract } from "../../shared/showVyvaReviewContract";
import type { ShowVyvaPastePayload } from "../../shared/showVyvaFlow";
import type { ShowVyvaFollowUpAction } from "../../shared/showVyvaFollowUp";
import ShowVyvaResultCard from "./ShowVyvaResultCard";

type ShowVyvaPastedReviewResultProps = {
  payload: ShowVyvaPastePayload;
  testIdSuffix?: string;
  onClose: () => void;
  onActionSelect: (action: ShowVyvaFollowUpAction, contract: ShowVyvaReviewContract) => void;
  actions?: ShowVyvaFollowUpAction[];
  actionTitle?: string;
  actionSubtitle?: string;
};

export default function ShowVyvaPastedReviewResult({
  payload,
  testIdSuffix = "pasted",
  onClose,
  onActionSelect,
  actions,
  actionTitle,
  actionSubtitle,
}: ShowVyvaPastedReviewResultProps) {
  const { t } = useTranslation();
  const contract = showVyvaReviewContractFromPastePayload(payload);

  return (
    <section data-testid={`show-vyva-pasted-review-${testIdSuffix}`} className="mt-[14px] mb-[14px]">
      <ShowVyvaResultCard
        contract={contract}
        testIdSuffix={testIdSuffix}
        actions={actions}
        actionTitle={actionTitle}
        actionSubtitle={actionSubtitle}
        onActionSelect={onActionSelect}
      />
      <button
        type="button"
        data-testid={`button-show-vyva-pasted-close-${testIdSuffix}`}
        onClick={onClose}
        className="mt-3 flex items-center gap-1 font-body text-[12px] font-bold text-[#6B7280]"
      >
        <X size={12} aria-hidden="true" />
        {t("showVyva.closeReview", "Close review")}
      </button>
    </section>
  );
}
