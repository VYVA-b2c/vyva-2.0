import { AlertTriangle, MessageCircle, PackageOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CanonicalFlowIcon } from "@/components/CanonicalDetailFlowShell";

export type MedicationRefillAlert = {
  id: string;
  medicineId: string;
  status: "refill_soon" | "refill_now" | "uncertain";
  title: string;
  message: string;
  daysRemaining: number | null;
  projectedRunOutDate: string | null;
  createdAt: string;
};

export type MedicationRefillAlertResponse = {
  permissions: {
    manage_inventory?: boolean;
    receive_refill_alerts?: boolean;
  };
  alerts: MedicationRefillAlert[];
};

export default function MedicationRefillAlertCard({
  alert,
  canManage,
  onOpen,
  onAsk,
  testId = "medication-refill-alert",
}: {
  alert: MedicationRefillAlert;
  canManage: boolean;
  onOpen: () => void;
  onAsk?: () => void;
  testId?: string;
}) {
  const { t } = useTranslation();
  const urgent = alert.status === "refill_now";
  return (
    <article
      className="overflow-hidden rounded-[24px] border border-[#E8D9B4] bg-white shadow-[0_14px_34px_rgba(91,61,18,0.08)]"
      data-testid={testId}
      role="status"
    >
      <div className="bg-[linear-gradient(135deg,#FBF6FF_0%,#FFF4D5_100%)] p-5">
        <div className="flex items-start gap-3">
          <CanonicalFlowIcon icon={urgent ? AlertTriangle : PackageOpen} goldAccent={urgent ? "warning" : "package"} />
          <div className="min-w-0 flex-1">
            <p className="font-body text-[11px] font-black uppercase tracking-[0.1em] text-[#854F0B]">
              {urgent
                ? t("meds.refillAlert.now", "REFILL NOW")
                : alert.status === "uncertain"
                  ? t("meds.refillAlert.check", "SUPPLY CHECK")
                  : t("meds.refillAlert.soon", "REFILL SOON")}
            </p>
            <h2 className="mt-1 font-body text-[21px] font-black leading-tight text-[#241238]">{alert.title}</h2>
            <p className="mt-2 font-body text-[14px] font-semibold leading-relaxed text-[#66586E]">{alert.message}</p>
          </div>
        </div>
      </div>
      <div className={`grid gap-2 p-3 ${onAsk ? "sm:grid-cols-2" : ""}`}>
        <button
          type="button"
          onClick={onOpen}
          className="vyva-tap inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[17px] bg-vyva-purple px-4 font-body text-[15px] font-black text-white"
        >
          <PackageOpen size={18} aria-hidden="true" />
          {canManage ? t("meds.refillAlert.update", "Update supply") : t("meds.refillAlert.view", "View refill status")}
        </button>
        {onAsk ? (
          <button
            type="button"
            onClick={onAsk}
            className="vyva-tap inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[17px] border border-[#D8C7E8] bg-white px-4 font-body text-[15px] font-black text-vyva-purple"
          >
            <MessageCircle size={18} aria-hidden="true" />
            {t("meds.refillAlert.ask", "Ask any question")}
          </button>
        ) : null}
      </div>
      <p className="px-4 pb-4 text-center font-body text-[11px] font-bold text-[#746A72]">
        {t("meds.refillAlert.boundary", "Reminder only · VYVA never orders or contacts anyone")}
      </p>
    </article>
  );
}
