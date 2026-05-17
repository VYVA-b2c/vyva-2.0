import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { OnboardingChrome } from "@/components/onboarding/OnboardingChrome";
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
    <OnboardingChrome mainClassName="-mt-4 flex min-h-[calc(100vh-76px)] max-w-[540px] flex-col justify-center pb-8 pt-2 sm:-mt-8 sm:min-h-[calc(100vh-92px)] sm:pb-10">
      <section className="flex flex-col items-center text-center">
        <div
          className="relative flex h-[86px] w-[86px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#6B21A8_0%,#8B3FC8_100%)] text-white shadow-[0_18px_40px_rgba(107,33,168,0.26)]"
          data-testid="icon-activation-success"
        >
          <span className="absolute -right-1 top-3 h-4 w-4 rounded-full border-[3px] border-[#FFF9F1] bg-vyva-gold" aria-hidden="true" />
          <Sparkles size={40} strokeWidth={2.3} />
        </div>
        <h1 className="mt-5 font-display text-[34px] leading-[1.02] text-[#2E1642] sm:text-[42px]">
          {t("onboarding.activation.title", "You're all set!")}
        </h1>
        <p className="mt-3 max-w-[410px] font-body text-[15px] leading-[1.65] text-vyva-text-2 sm:text-[16px]">
          {t(
            "onboarding.activation.subtitle",
            "VYVA is ready. You can complete your health profile whenever you like - it makes care better.",
          )}
        </p>
      </section>

      <div
        className="mt-8 w-full rounded-[28px] border border-[#EFE7DB] bg-white/95 p-2.5 shadow-[0_24px_70px_rgba(72,44,18,0.12)] backdrop-blur sm:mt-9"
        data-testid="list-activation-setup"
      >
        {SETUP_ITEMS.map((item) => (
          <div key={item} className="flex min-h-[54px] items-center gap-3 rounded-[20px] px-3 py-2.5 sm:px-4">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-vyva-green-light text-vyva-green">
              <CheckCircle2 size={19} strokeWidth={2.2} />
            </span>
            <p className="font-body text-[14px] font-semibold leading-snug text-vyva-text-1 sm:text-[15px]">
              {t(item)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 w-full space-y-3 sm:mt-9">
        <button
          data-testid="button-activation-complete-profile"
          onClick={() => navigate("/onboarding/profile")}
          className="vyva-primary-action min-h-[58px] w-full bg-[linear-gradient(135deg,#6B21A8_0%,#8B3FC8_100%)] px-5 py-4 text-[16px] shadow-[0_12px_30px_rgba(107,33,168,0.28)] sm:text-[17px]"
        >
          {t("onboarding.activation.completeProfile", "Complete my health profile")}
          <ArrowRight size={18} />
        </button>
        <button
          data-testid="button-activation-skip-home"
          onClick={() => navigate("/")}
          className="vyva-secondary-action min-h-[50px] w-full border-transparent bg-transparent py-3 text-[15px] text-vyva-text-2 shadow-none hover:border-vyva-border hover:bg-white/70"
        >
          {t("onboarding.activation.later", "I'll do this later")}
        </button>
      </div>
    </OnboardingChrome>
  );
};

export default ActivationStep;
