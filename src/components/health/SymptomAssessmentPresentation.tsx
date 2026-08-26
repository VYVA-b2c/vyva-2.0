import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  HeartPulse,
  Search,
  ShieldCheck,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { VyvaIcon, type VyvaIconAccent } from "@/components/brand/VyvaIcon";
import {
  resolveSymptomAssessmentPresentation,
  type SymptomAssessmentStageId,
} from "@/design/screenPresentation";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";

export type SymptomAssessmentModality = "voice" | "touch";

export const SYMPTOM_ASSESSMENT_APPROVED_FRAME_BY_STAGE = {
  describe: "capture.voice_or_text",
  safety_check: "choice.yes_no",
  urgent_escalation: "safety.urgent_escalation",
  symptom_selection: "multi_choice.symptom_picker",
  severity: "scale.severity_0_10",
  onset: "capture.onset_timing",
  related_details: "prompt.clarification",
  review: "confirmation.review",
  checking: "progress.checking",
  safest_next_step: "summary.guidance_next_step",
  save_share_summary: "summary.share_or_save",
} as const satisfies Record<SymptomAssessmentStageId, string>;

type SceneLayout =
  | "capture"
  | "binary"
  | "alert"
  | "choices"
  | "scale"
  | "review"
  | "progress"
  | "guidance"
  | "handoff";

type StagePresentation = {
  eyebrow: string;
  title: string;
  helper: string;
  layout: SceneLayout;
};

const stagePresentation: Record<SymptomAssessmentStageId, StagePresentation> = {
  describe: {
    eyebrow: "Describe how you feel",
    title: "How are you feeling?",
    helper: "Tell VYVA in your own words.",
    layout: "capture",
  },
  safety_check: {
    eyebrow: "Safety check",
    title: "Any urgent warning signs?",
    helper: "For example severe chest pain, fainting, or struggling to breathe.",
    layout: "binary",
  },
  urgent_escalation: {
    eyebrow: "Urgent guidance",
    title: "Get urgent help now",
    helper: "Call emergency services now. Do not wait for an online assessment.",
    layout: "alert",
  },
  symptom_selection: {
    eyebrow: "Symptom details",
    title: "What do you notice?",
    helper: "",
    layout: "choices",
  },
  severity: {
    eyebrow: "Severity",
    title: "How strong is it?",
    helper: "0 is none. 10 is the worst imaginable.",
    layout: "scale",
  },
  onset: {
    eyebrow: "Timing",
    title: "When did it start?",
    helper: "",
    layout: "choices",
  },
  related_details: {
    eyebrow: "Related details",
    title: "One more detail",
    helper: "Choose the pattern that fits best.",
    layout: "capture",
  },
  review: {
    eyebrow: "Review",
    title: "Is this right?",
    helper: "",
    layout: "review",
  },
  checking: {
    eyebrow: "Bringing it together",
    title: "Reviewing your symptoms",
    helper: "",
    layout: "progress",
  },
  safest_next_step: {
    eyebrow: "Guidance",
    title: "Your safest next step",
    helper: "Follow this guidance and watch for any change in how you feel.",
    layout: "guidance",
  },
  save_share_summary: {
    eyebrow: "Summary",
    title: "Your summary",
    helper: "",
    layout: "handoff",
  },
};

type CheckingInsight = {
  title: string;
  Icon: LucideIcon;
  accent: VyvaIconAccent;
};

const CHECKING_INSIGHTS: readonly CheckingInsight[] = [
  {
    title: "Reviewing your symptoms",
    Icon: Stethoscope,
    accent: "scope",
  },
  {
    title: "Reviewing your health profile",
    Icon: HeartPulse,
    accent: "pulse",
  },
  {
    title: "Searching 40M+ peer-reviewed sources",
    Icon: Search,
    accent: "spark",
  },
  {
    title: "Checking safety signals",
    Icon: ShieldCheck,
    accent: "check",
  },
] as const;

function SymptomCheckingProgress() {
  const { isDark } = useHomeMasterTheme();
  const [activeInsight, setActiveInsight] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveInsight((current) => (current + 1) % CHECKING_INSIGHTS.length);
    }, 1600);

    return () => window.clearInterval(timer);
  }, []);

  const activeCopy = CHECKING_INSIGHTS[activeInsight];
  return (
    <div
      className="flex min-h-[250px] flex-col items-center justify-center px-3 text-center"
      data-testid="symptom-scene-progress"
      role="status"
      aria-live="polite"
    >
      <span className={`grid h-[72px] w-[72px] place-items-center rounded-[24px] border shadow-[0_14px_32px_rgba(32,12,68,0.22)] backdrop-blur-sm motion-safe:animate-pulse ${isDark ? "border-white/15 bg-[#342548]" : "border-white/50 bg-white/90"}`}>
        <VyvaIcon icon={activeCopy.Icon} accent={activeCopy.accent} size={34} strokeWidth={2.35} />
      </span>
      <h2 className="mt-7 max-w-[300px] font-body text-[28px] font-extrabold leading-[1.08] tracking-[-0.025em] text-white">
        {activeCopy.title}
      </h2>
      <div className="mt-7 flex items-center justify-center gap-2" aria-label={`Step ${activeInsight + 1} of ${CHECKING_INSIGHTS.length}`}>
        {CHECKING_INSIGHTS.map(({ title }, index) => (
          <span
            key={title}
            className={`h-2 rounded-full transition-all duration-300 ${index === activeInsight ? "w-7 bg-white" : "w-2 bg-white/30"}`}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}

export type SymptomAssessmentReviewItem = {
  label: string;
  value: string;
};

type SymptomAssessmentPresentationProps = {
  stageId: SymptomAssessmentStageId;
  modality: SymptomAssessmentModality;
  title?: string;
  helper?: string;
  children?: ReactNode;
  reviewItems?: SymptomAssessmentReviewItem[];
  onModalityChange?: (modality: SymptomAssessmentModality) => void;
  showHeader?: boolean;
  fullBleedChildren?: boolean;
  allowProgressChildren?: boolean;
  className?: string;
};

export function SymptomAssessmentPresentation({
  stageId,
  modality,
  title,
  helper,
  children,
  reviewItems = [],
  onModalityChange,
  showHeader = true,
  fullBleedChildren = false,
  allowProgressChildren = false,
  className = "",
}: SymptomAssessmentPresentationProps) {
  const { isDark } = useHomeMasterTheme();
  const scene = stagePresentation[stageId];
  const presentation = resolveSymptomAssessmentPresentation(stageId);
  const urgent = scene.layout === "alert";
  const loading = scene.layout === "progress";
  const displayHelper = helper ?? scene.helper;
  const presentationId =
    modality === "voice" ? presentation.voiceSceneId : presentation.touchSceneId;
  const showsVoiceOrb =
    modality === "voice" &&
    (scene.layout === "capture" ||
      scene.layout === "choices" ||
      scene.layout === "binary");
  const usesCompactProductionDescribeFrame =
    stageId === "describe" && modality === "touch" && !showHeader;
  const usesCheckingFrame = stageId === "checking";
  const usesResultFrame = stageId === "safest_next_step" || stageId === "save_share_summary";
  const responsiveFrameWidth = "max-w-[330px] sm:max-w-[760px]";
  const responsiveFrameHeight = stageId === "checking"
      ? "min-h-[360px] md:min-h-[350px]"
      : "min-h-0";
  const responsiveContentSpacing = usesCompactProductionDescribeFrame
    ? "pb-5 pt-6 sm:pb-6 sm:pt-7"
    : stageId === "checking"
      ? "pb-8 pt-[30px] md:pb-10 md:pt-8"
      : `pb-8 ${showHeader ? "pt-[38px]" : "pt-8"} md:pb-9 md:pt-8`;
  const defaultFrameClass = isDark
    ? "border-white/[0.14] bg-[#2B2035] text-[#FFF8FF] shadow-[0_22px_48px_rgba(0,0,0,0.22)]"
    : usesCompactProductionDescribeFrame
      ? "border-[#E6DCEB] bg-white text-[#241238] shadow-[0_16px_40px_rgba(63,45,75,0.08)]"
      : "border-[#DFD3E7] bg-[#FBF6FF] text-[#241238] shadow-[0_18px_36px_rgba(47,24,64,0.11)]";

  return (
    <section
      aria-busy={loading || undefined}
      className={`symptom-canonical-panel mx-auto ${responsiveFrameHeight} ${showHeader ? "w-[calc(100%_-_28px)]" : "w-full"} ${responsiveFrameWidth} overflow-hidden border ${usesCheckingFrame ? "rounded-[32px] border-[#7C3AED] bg-[linear-gradient(145deg,#4C1D95_0%,#6D28D9_52%,#7C3AED_100%)] text-white shadow-[0_22px_48px_rgba(76,29,149,0.28)]" : `rounded-[30px] ${defaultFrameClass}`} ${className}`}
      data-testid={`symptom-presentation-${stageId}-${modality}`}
      data-approved-frame={SYMPTOM_ASSESSMENT_APPROVED_FRAME_BY_STAGE[stageId]}
      data-flow-id="health.symptom_assessment"
      data-presentation-id={presentationId}
      data-presentation-modality={modality}
      data-presentation-state={urgent ? "urgent" : loading ? "loading" : "default"}
      data-registry-scene={presentation.registrySceneId}
      data-shell-contract={presentation.shell.shellId}
      data-header-contract={presentation.shell.headerId}
      data-container-contract={presentation.shell.containerId}
      data-bottom-nav-contract={presentation.shell.bottomNavId}
      data-composer-contract={presentation.shell.composer}
      data-scene-kind={SYMPTOM_ASSESSMENT_APPROVED_FRAME_BY_STAGE[stageId]}
      data-scene-layout={scene.layout}
    >
      {showHeader ? <div className="flex items-center justify-between px-5 pt-5">
        <span
          aria-label="VYVA"
          className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#7024C4] font-display text-[22px] font-black leading-none text-white"
        >
          Y
        </span>
        <div
          aria-label={`${modality === "voice" ? "Voice" : "Touch"} mode`}
          className="flex gap-[5px] rounded-full border border-[#E6DCEC] bg-white p-1 text-[12px] font-black"
        >
          <button
            type="button"
            aria-pressed={modality === "voice"}
            aria-label="Use Voice mode"
            disabled={!onModalityChange || modality === "voice"}
            onClick={() => onModalityChange?.("voice")}
            className={`grid h-[30px] min-w-[30px] place-items-center rounded-full ${
              modality === "voice"
                ? "bg-[#7024C4] text-white"
                : "text-[#746A72]"
            }`}
          >
            V
          </button>
          <button
            type="button"
            aria-pressed={modality === "touch"}
            aria-label="Use Touch mode"
            disabled={!onModalityChange || modality === "touch"}
            onClick={() => onModalityChange?.("touch")}
            className={`grid h-[30px] min-w-[30px] place-items-center rounded-full ${
              modality === "touch"
                ? "bg-[#7024C4] text-white"
                : "text-[#746A72]"
            }`}
          >
            T
          </button>
        </div>
      </div> : null}

      {fullBleedChildren ? (
        <>
          <div className={`px-[22px] text-center ${showHeader ? "pt-[38px]" : usesResultFrame ? "pt-6 md:pt-8" : "pt-[34px]"}`}>
          {scene.layout !== "progress" ? (
            <h2 className={`font-body font-extrabold leading-[1.08] tracking-[-0.025em] ${isDark ? "text-[#FFF8FF]" : "text-[#241238]"} ${usesResultFrame ? "text-[28px] md:text-[31px]" : "text-[31px]"}`}>
              {title || scene.title}
            </h2>
          ) : null}
            {displayHelper ? (
              <p className={`mx-auto mt-3 font-semibold leading-[1.42] ${isDark ? "text-[#D8CDE4]" : "text-[#746A72]"} ${usesResultFrame ? "max-w-[290px] text-[14px] md:text-[15px]" : "max-w-[250px] text-[15px]"}`}>
                {usesResultFrame ? (
                  <>
                    <span className="md:hidden">
                      {stageId === "safest_next_step" ? "Follow this guidance." : displayHelper}
                    </span>
                    <span className="hidden md:inline">{displayHelper}</span>
                  </>
                ) : displayHelper}
              </p>
            ) : null}
          </div>
          {children && (scene.layout !== "progress" || allowProgressChildren) ? (
            <div
              className={`${usesResultFrame ? "mt-5 md:mt-7" : "mt-7"} text-left`}
              data-testid={`symptom-scene-controls-${stageId}-${modality}`}
            >
              {children}
            </div>
          ) : null}
        </>
      ) : (
        <div className={`px-[22px] text-center ${responsiveContentSpacing}`}>
          {scene.layout !== "progress" ? (
            <h2 className={`font-body font-extrabold leading-[1.08] tracking-[-0.025em] ${isDark ? "text-[#FFF8FF]" : "text-[#241238]"} ${usesCompactProductionDescribeFrame || stageId === "safety_check" ? "text-[28px] sm:text-[31px]" : "text-[31px]"}`}>
              {title || scene.title}
            </h2>
          ) : null}

        {scene.layout === "alert" ? (
          <div
            className="mt-7 rounded-[8px] border border-[#EFAAA7] bg-[#FFF0EF] p-[18px] text-left"
            data-testid="symptom-scene-alert"
          >
            <p className="text-[15px] font-black leading-snug text-[#8C2724]">
              VYVA will stay with you.
            </p>
            <p className="mt-1 text-[14px] font-semibold leading-snug text-[#8C2724]">
              {displayHelper}
            </p>
          </div>
        ) : scene.layout === "progress" ? (
          <SymptomCheckingProgress />
        ) : scene.layout === "guidance" ? (
          <div
            className="mt-7 rounded-[8px] border border-[#9ED9C4] bg-[#E9F8F0] p-5 text-left"
            data-testid="symptom-scene-guidance"
          >
            <p className="text-[15px] font-bold leading-snug text-[#0D694B]">
              {displayHelper}
            </p>
          </div>
        ) : displayHelper ? (
          <p className={`mx-auto mt-3 max-w-[250px] text-[15px] font-semibold leading-[1.42] ${isDark ? "text-[#D8CDE4]" : "text-[#746A72]"}`}>
            {displayHelper}
          </p>
        ) : null}

        {showsVoiceOrb ? (
          <div
            aria-label="Voice capture ready"
            className="mx-auto my-[34px] h-[118px] w-[118px] rounded-full border-[18px] border-[#EEE4FF] bg-[radial-gradient(circle_at_35%_28%,#E9C9FF_0_8%,#A66CE3_40%,#7024C4_100%)] shadow-[0_0_0_1px_#D9C8ED,0_0_0_13px_rgba(112,36,196,0.05)]"
            data-testid="symptom-scene-orb"
          />
        ) : null}

        {scene.layout === "review" && reviewItems.length > 0 ? (
          <dl
            className={`mt-7 divide-y text-left ${isDark ? "divide-white/[0.12]" : "divide-[#E7DDE6]"}`}
            data-testid="symptom-scene-review"
          >
            {reviewItems.map((item) => (
              <div
                className="py-3"
                key={`${item.label}-${item.value}`}
              >
                <dt className={`text-[12px] font-black uppercase tracking-[0.08em] ${isDark ? "text-[#C9BDD6]" : "text-[#746A72]"}`}>
                  {item.label}
                </dt>
                <dd className={`mt-1 text-[14px] font-bold ${isDark ? "text-[#FFF8FF]" : "text-[#241238]"}`}>
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {children && (scene.layout !== "progress" || allowProgressChildren) ? (
          <div
            className="mt-7 text-left"
            data-testid={`symptom-scene-controls-${stageId}-${modality}`}
          >
            {children}
          </div>
        ) : null}
        </div>
      )}
    </section>
  );
}
