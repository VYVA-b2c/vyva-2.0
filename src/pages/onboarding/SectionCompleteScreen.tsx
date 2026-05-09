import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, BarChart2, CheckCircle2, Home, Pill, PlusCircle } from "lucide-react";

const SECTION_LABELS: Record<string, { title: string; message: string }> = {
  gp: { title: "GP details saved", message: "VYVA now knows who to contact about your health." },
  providers: { title: "Providers saved", message: "Your pharmacy and specialist details are on file." },
  basics: { title: "Basics saved", message: "Your personal details are looking good." },
  contact: { title: "Contact details saved", message: "We know where to reach you." },
  health: { title: "Health conditions saved", message: "VYVA will keep this in mind during conversations." },
  medications: { title: "Medications saved", message: "Reminders and adherence tracking are ready." },
  allergies: { title: "Allergies saved", message: "Important — VYVA will remember these." },
  "care-team": { title: "Care team added", message: "Your loved ones can now receive updates." },
  careteam:    { title: "Care team added", message: "Your loved ones can now receive updates." },
  emergency: { title: "Emergency plan saved", message: "You're better prepared for any situation." },
};

const DEFAULT = { title: "Section complete!", message: "Thanks for filling in this section." };

const SectionCompleteScreen = () => {
  const navigate = useNavigate();
  const { section = "" } = useParams<{ section: string }>();
  const [searchParams] = useSearchParams();
  const info = SECTION_LABELS[section] ?? DEFAULT;
  const returnTo = searchParams.get("returnTo");

  if (section === "medications") {
    const medicationFormPath = returnTo
      ? `/onboarding/profile/medications?returnTo=${encodeURIComponent(returnTo)}`
      : "/onboarding/profile/medications";

    return (
      <div className="flex min-h-screen items-center justify-center bg-vyva-cream px-5 py-8">
        <main className="w-full max-w-[430px]">
          <section className="px-1 py-2">
            <div className="flex items-start gap-4">
              <div
                className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-[24px] shadow-[0_14px_30px_rgba(15,118,74,0.15)]"
                style={{ background: "#ECFDF5" }}
                data-testid="icon-section-complete"
              >
                <CheckCircle2 size={38} className="text-vyva-green" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[13px] font-extrabold uppercase tracking-[0.14em] text-vyva-purple">
                  Medication profile
                </p>
                <h1
                  className="mt-1 font-display text-[34px] leading-[1.02] text-vyva-text-1"
                  data-testid="text-section-complete-title"
                >
                  Medications saved
                </h1>
                <p
                  className="mt-3 font-body text-[17px] leading-relaxed text-vyva-text-2"
                  data-testid="text-section-complete-message"
                >
                  Your medication list is ready for reminders, daily check-ins, and report summaries.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2">
              {[
                { label: "Saved", value: "List" },
                { label: "Ready", value: "Reminders" },
                { label: "Tracked", value: "Reports" },
              ].map((item) => (
                <div key={item.label} className="rounded-[18px] border border-[#E8DCCB] bg-[#FFFCF8] px-3 py-3 text-center shadow-[0_10px_24px_rgba(67,46,35,0.06)]">
                  <p className="font-body text-[16px] font-extrabold text-vyva-text-1">{item.value}</p>
                  <p className="mt-1 font-body text-[11px] font-bold uppercase tracking-[0.08em] text-vyva-text-3">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                data-testid="button-complete-view-reports"
                onClick={() => navigate("/informes")}
                className="flex min-h-[92px] w-full items-center gap-4 rounded-[24px] border border-[#DDD6FE] bg-[#F5F3FF] p-4 text-left shadow-[0_14px_30px_rgba(109,40,217,0.10)] transition-transform active:scale-[0.99]"
              >
                <span className="flex h-[54px] w-[54px] flex-shrink-0 items-center justify-center rounded-[18px] bg-white text-vyva-purple">
                  <BarChart2 size={28} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-body text-[19px] font-extrabold leading-tight text-vyva-text-1">
                    View reports
                  </span>
                  <span className="mt-1 block font-body text-[14px] leading-snug text-vyva-text-2">
                    See medication progress alongside your health updates.
                  </span>
                </span>
                <ArrowRight size={22} className="flex-shrink-0 text-vyva-purple" />
              </button>

              <button
                type="button"
                data-testid="button-complete-add-medication"
                onClick={() => navigate(medicationFormPath)}
                className="flex min-h-[92px] w-full items-center gap-4 rounded-[24px] border border-[#FDE68A] bg-[#FFFBEB] p-4 text-left shadow-[0_14px_30px_rgba(180,83,9,0.10)] transition-transform active:scale-[0.99]"
              >
                <span className="flex h-[54px] w-[54px] flex-shrink-0 items-center justify-center rounded-[18px] bg-white text-[#B45309]">
                  <PlusCircle size={28} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-body text-[19px] font-extrabold leading-tight text-vyva-text-1">
                    Add another medication
                  </span>
                  <span className="mt-1 block font-body text-[14px] leading-snug text-vyva-text-2">
                    Keep the list complete if anything is missing.
                  </span>
                </span>
                <ArrowRight size={22} className="flex-shrink-0 text-[#B45309]" />
              </button>
            </div>

            <div className="mt-6 rounded-[24px] border border-[#E8DCCB] bg-[#FFFCF8] px-4 py-4 shadow-[0_10px_24px_rgba(67,46,35,0.06)]">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#ECFDF5] text-vyva-green">
                  <Pill size={22} />
                </span>
                <p className="font-body text-[14px] leading-snug text-vyva-text-2">
                  VYVA can now use this list when checking daily medication progress.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                data-testid="button-complete-back-to-profile"
                onClick={() => navigate(returnTo || "/onboarding/profile")}
                className="w-full rounded-full py-4 font-body text-[17px] font-semibold text-white"
                style={{ background: "#6B21A8" }}
              >
                {returnTo ? "Continue" : "Back to my profile"}
              </button>
              <button
                data-testid="button-complete-go-home"
                onClick={() => navigate("/")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full py-3 font-body text-[15px] font-medium text-vyva-text-2"
              >
                <Home size={17} />
                Go to VYVA
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vyva-cream flex flex-col items-center justify-center px-6 gap-8">
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center shadow-xl"
        style={{ background: "#ECFDF5" }}
        data-testid="icon-section-complete"
      >
        <CheckCircle2 size={48} className="text-vyva-green" />
      </div>

      <div className="text-center space-y-2">
        <h1
          className="font-display text-[26px] font-semibold text-vyva-text-1"
          data-testid="text-section-complete-title"
        >
          {info.title}
        </h1>
        <p
          className="font-body text-[15px] text-vyva-text-2 max-w-[280px] leading-relaxed"
          data-testid="text-section-complete-message"
        >
          {info.message}
        </p>
      </div>

      <div className="w-full max-w-[380px] space-y-3">
        <button
          data-testid="button-complete-back-to-profile"
          onClick={() => navigate(returnTo || "/onboarding/profile")}
          className="w-full py-4 rounded-full font-body text-[17px] font-semibold text-white"
          style={{ background: "#6B21A8" }}
        >
          {returnTo ? "Continue" : "Back to my profile"}
        </button>
        <button
          data-testid="button-complete-go-home"
          onClick={() => navigate("/")}
          className="w-full py-3 rounded-full font-body text-[15px] font-medium text-vyva-text-2"
        >
          Go to VYVA
        </button>
      </div>
    </div>
  );
};

export default SectionCompleteScreen;
