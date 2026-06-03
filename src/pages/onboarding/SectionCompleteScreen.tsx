import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, BarChart2, CheckCircle2, Home, PlusCircle } from "lucide-react";

const SECTION_LABELS: Record<string, { title: string; message: string }> = {
  gp: { title: "GP details saved", message: "VYVA now knows who to contact about your health." },
  providers: { title: "Providers saved", message: "Your pharmacy and specialist details are on file." },
  basics: { title: "Basics saved", message: "Your personal details are looking good." },
  contact: { title: "Contact details saved", message: "We know where to reach you." },
  health: { title: "Health conditions saved", message: "VYVA will keep this in mind during conversations." },
  conditions: { title: "Health conditions saved", message: "VYVA will keep this in mind during conversations." },
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
      <div className="flex min-h-screen items-center justify-center bg-vyva-cream px-5 py-10">
        <main className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center gap-3">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-[0_10px_24px_rgba(15,118,74,0.15)]"
              style={{ background: "#ECFDF5" }}
              data-testid="icon-section-complete"
            >
              <CheckCircle2 size={34} className="text-vyva-green" />
            </div>
            <h1
              className="font-display text-[30px] leading-tight text-vyva-text-1"
              data-testid="text-section-complete-title"
            >
              Medications saved
            </h1>
            <p
              className="font-body text-[15px] text-vyva-text-2"
              data-testid="text-section-complete-message"
            >
              Reminders and tracking are ready.
            </p>
          </div>

          <div className="mt-7 space-y-3">
            <button
              type="button"
              data-testid="button-complete-view-reports"
              onClick={() => navigate("/informes")}
              className="flex h-[64px] w-full items-center gap-3 rounded-2xl border border-[#DDD6FE] bg-[#F5F3FF] px-4 text-left transition-transform active:scale-[0.99]"
            >
              <BarChart2 size={22} className="flex-shrink-0 text-vyva-purple" />
              <span className="font-body text-[17px] font-semibold text-vyva-text-1">View reports</span>
              <ArrowRight size={18} className="ml-auto flex-shrink-0 text-vyva-purple" />
            </button>

            <button
              type="button"
              data-testid="button-complete-add-medication"
              onClick={() => navigate(medicationFormPath)}
              className="flex h-[64px] w-full items-center gap-3 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] px-4 text-left transition-transform active:scale-[0.99]"
            >
              <PlusCircle size={22} className="flex-shrink-0 text-[#B45309]" />
              <span className="font-body text-[17px] font-semibold text-vyva-text-1">Add another</span>
              <ArrowRight size={18} className="ml-auto flex-shrink-0 text-[#B45309]" />
            </button>
          </div>

          <div className="mt-5 space-y-3">
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
