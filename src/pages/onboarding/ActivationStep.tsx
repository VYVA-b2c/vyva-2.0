import { useNavigate } from "react-router-dom";
import { CheckCircle2, Sparkles } from "lucide-react";
import { useLanguage } from "@/i18n";

const SETUP_ITEMS = [
  "onboarding.activation.items.profile",
  "onboarding.activation.items.preferences",
  "onboarding.activation.items.privacy",
  "onboarding.activation.items.checkin",
];

const ActivationStep = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-vyva-cream flex flex-col items-center justify-between px-6 py-12">
      <div className="flex flex-col items-center gap-4 mt-8">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center shadow-xl"
          style={{ background: "#6B21A8" }}
          data-testid="icon-activation-success"
        >
          <Sparkles size={40} className="text-white" />
        </div>
        <h1 className="font-display text-[28px] font-semibold text-vyva-text-1 text-center">
          {t("onboarding.activation.title", "You're all set!")}
        </h1>
        <p className="font-body text-[15px] text-vyva-text-2 text-center max-w-[280px] leading-relaxed">
          {t(
            "onboarding.activation.subtitle",
            "VYVA is ready. You can complete your health profile whenever you like - it makes care better.",
          )}
        </p>
      </div>

      <div
        className="w-full max-w-[360px] bg-white rounded-[22px] border border-vyva-border p-5 space-y-3"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
        data-testid="list-activation-setup"
      >
        {SETUP_ITEMS.map((item) => (
          <div key={item} className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-vyva-green flex-shrink-0" />
            <p className="font-body text-[14px] text-vyva-text-1">{t(item)}</p>
          </div>
        ))}
      </div>

      <div className="w-full max-w-[380px] space-y-3">
        <button
          data-testid="button-activation-complete-profile"
          onClick={() => navigate("/onboarding/profile")}
          className="w-full py-4 rounded-full font-body text-[17px] font-semibold text-white"
          style={{ background: "#6B21A8" }}
        >
          {t("onboarding.activation.completeProfile", "Complete my health profile")}
        </button>
        <button
          data-testid="button-activation-skip-home"
          onClick={() => navigate("/")}
          className="w-full py-3 rounded-full font-body text-[15px] font-medium text-vyva-text-2"
        >
          {t("onboarding.activation.later", "I'll do this later")}
        </button>
      </div>
    </div>
  );
};

export default ActivationStep;
