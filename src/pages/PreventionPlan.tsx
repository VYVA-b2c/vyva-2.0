import { useQuery } from "@tanstack/react-query";
import {
  Apple,
  ArrowLeft,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Footprints,
  HeartPulse,
  Mic,
  Share2,
  Sparkles,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { VyvaIcon, type VyvaIconAccent } from "@/components/brand/VyvaIcon";
import { useAuth } from "@/contexts/AuthContext";
import { useOptionalProfile } from "@/contexts/ProfileContext";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { apiFetch } from "@/lib/queryClient";

export type PreventionPillar = "heart" | "brain" | "strength" | "nourishment" | "calm";
export type PreventionPillarStatus = "thriving" | "steady" | "needs_attention" | "priority_focus";
export type PreventionRecommendation = { action: string; why: string };

export type PreventionPlanData = {
  id: string | null;
  generated_at: string | null;
  pillar_heart: PreventionPillarStatus;
  pillar_brain: PreventionPillarStatus;
  pillar_strength: PreventionPillarStatus;
  pillar_nourishment: PreventionPillarStatus;
  pillar_calm: PreventionPillarStatus;
  priority_pillar: PreventionPillar | null;
  priority_intervention: string | null;
  priority_why: string | null;
  plan_narrative_senior: string | null;
  plan_narrative_caregiver: string | null;
  recommendations: Partial<Record<PreventionPillar, PreventionRecommendation[]>>;
  source_signals: Record<string, boolean>;
  trajectory: "improving" | "stable" | "declining" | "first";
};

type PreventionPlanProps = {
  previewPlan?: PreventionPlanData;
  firstNameOverride?: string;
  backPath?: string;
  themeOverride?: "light" | "dark";
};

type PillarDefinition = {
  id: PreventionPillar;
  icon: LucideIcon;
  accent: VyvaIconAccent;
  label: string;
  shortLabel: string;
};

const PILLARS: PillarDefinition[] = [
  { id: "heart", icon: HeartPulse, accent: "pulse", label: "Heart & circulation", shortLabel: "Heart" },
  { id: "brain", icon: Brain, accent: "bridge", label: "Brain & memory", shortLabel: "Brain" },
  { id: "strength", icon: Footprints, accent: "step", label: "Strength & stability", shortLabel: "Strength" },
  { id: "nourishment", icon: Apple, accent: "check", label: "Nourishment", shortLabel: "Nourishment" },
  { id: "calm", icon: Waves, accent: "spark", label: "Calm & recovery", shortLabel: "Calm" },
];

const STATUS: Record<PreventionPillarStatus, { label: string; tone: "success" | "steady" | "warning" }> = {
  thriving: { label: "Thriving", tone: "success" },
  steady: { label: "Steady", tone: "steady" },
  needs_attention: { label: "Needs attention", tone: "warning" },
  priority_focus: { label: "This month", tone: "warning" },
};

const PRIORITY_STATUS_RANK: Record<PreventionPillarStatus, number> = {
  priority_focus: 4,
  needs_attention: 3,
  steady: 2,
  thriving: 1,
};

const TRAJECTORY_LABELS: Record<PreventionPlanData["trajectory"], string> = {
  improving: "Building momentum",
  stable: "Holding steady",
  declining: "Needs a closer look",
  first: "Your first monthly plan",
};

function upperFirst(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

function lowerFirst(value: string): string {
  return value ? value[0].toLowerCase() + value.slice(1) : value;
}

function withoutMonthlySuffix(value: string): string {
  return value.trim().replace(/\s+this month[.!]?$/i, "").replace(/[.!?]+$/, "");
}

function personalisedHeadline(firstName: string, intervention: string | null, priorityLabel: string | null): string {
  const action = intervention
    ? withoutMonthlySuffix(intervention)
    : priorityLabel
      ? "Focus on " + priorityLabel.toLowerCase()
      : "Begin with one practical step";
  return firstName ? firstName + ", " + lowerFirst(action) : upperFirst(action);
}

function personalisedNarrative(narrative: string | null, firstName: string): string | null {
  if (!narrative || !firstName) return narrative;
  return narrative.replace(/^[^,]+(?=,\s*this month\b)/i, firstName);
}

function formatPlanDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function pillarStatus(plan: PreventionPlanData, pillarId: PreventionPillar): PreventionPillarStatus {
  const key = ("pillar_" + pillarId) as keyof PreventionPlanData;
  return plan[key] as PreventionPillarStatus;
}

function resolvePriorityDefinition(plan: PreventionPlanData): PillarDefinition | null {
  const apiPriority = plan.priority_pillar
    ? PILLARS.find((pillar) => pillar.id === plan.priority_pillar) ?? null
    : null;
  if (apiPriority) return apiPriority;
  return [...PILLARS].sort((a, b) => PRIORITY_STATUS_RANK[pillarStatus(plan, b.id)] - PRIORITY_STATUS_RANK[pillarStatus(plan, a.id)])[0] ?? null;
}

function usePreventionPlan(userId: string) {
  return useQuery<PreventionPlanData>({
    queryKey: ["prevention-plan", userId],
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      const response = await apiFetch("/api/prevention/plan/" + encodeURIComponent(userId));
      if (!response.ok) throw new Error("Could not load the monthly longevity plan");
      return response.json();
    },
  });
}

function actionRoute(action: string): string | null {
  const text = action.toLowerCase();
  if (text.includes("walk") || text.includes("exercise")) return "/health/exercises/gentle-walk";
  if (text.includes("brain coach")) return "/mind";
  if (text.includes("breath")) return "/games/breath-garden";
  if (text.includes("medicine") || text.includes("medication")) return "/health/medications";
  if (text.includes("concierge")) return "/concierge";
  return null;
}

function statusClass(tone: "success" | "steady" | "warning", isDark: boolean): string {
  if (tone === "success") return isDark ? "bg-[#123D31] text-[#72E1B3]" : "bg-[#E4F7EF] text-[#0A7653]";
  if (tone === "warning") return isDark ? "bg-[#4A3618] text-[#FFC65A]" : "bg-[#FFF0D2] text-[#9A5A00]";
  return isDark ? "bg-white/[0.08] text-[#D9CFE3]" : "bg-[#F2EDF4] text-[#6E6175]";
}

function PreventionPlanSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <main
      className={[
        "min-h-[100svh] px-6 pb-40 pt-8",
        isDark
          ? "bg-[radial-gradient(circle_at_50%_-10%,#21162A_0%,#160D1C_46%,#110914_100%)]"
          : "bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_72%)]",
      ].join(" ")}
      aria-label="Loading longevity plan"
    >
      <div className="mx-auto max-w-[900px] animate-pulse space-y-5">
        <div className={["h-12 rounded-2xl", isDark ? "bg-white/[0.08]" : "bg-white/80"].join(" ")} />
        <div className={["h-[290px] rounded-[32px]", isDark ? "bg-[#2B1E35]" : "bg-white"].join(" ")} />
        <div className="grid grid-cols-1 gap-4">
          {PILLARS.map((pillar) => (
            <div key={pillar.id} className={["h-[230px] rounded-[28px]", isDark ? "bg-[#2B1E35]" : "bg-white"].join(" ")} />
          ))}
        </div>
      </div>
    </main>
  );
}

export default function PreventionPlan({
  previewPlan,
  firstNameOverride,
  backPath = "/health",
  themeOverride,
}: PreventionPlanProps = {}) {
  const { user } = useAuth();
  const profileFirstName = useOptionalProfile()?.firstName ?? "";
  const { isDark: preferredIsDark } = useHomeMasterTheme();
  const isDark = themeOverride ? themeOverride === "dark" : preferredIsDark;
  const navigate = useNavigate();
  const userId = previewPlan ? "" : user?.id ?? "";
  const query = usePreventionPlan(userId);
  const plan = previewPlan ?? query.data;
  const firstName = firstNameOverride ?? profileFirstName;
  const [copied, setCopied] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<"shared" | "copied" | null>(null);

  if (!previewPlan && (query.isLoading || !userId)) return <PreventionPlanSkeleton isDark={isDark} />;

  if (query.isError || !plan) {
    return (
      <main className={[
        "min-h-[100svh] px-6 pb-40 pt-10 text-center",
        isDark
          ? "bg-[radial-gradient(circle_at_50%_-10%,#21162A_0%,#160D1C_46%,#110914_100%)] text-[#F8F2FF]"
          : "bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_72%)] text-[#241C30]",
      ].join(" ")}>
        <section className={["mx-auto max-w-[680px] rounded-[30px] border p-8", isDark ? "border-white/[0.12] bg-white/[0.07]" : "border-[#EEE8F1] bg-white shadow-[0_18px_42px_rgba(80,52,109,0.08)]"].join(" ")}>
          <h1 className="font-display text-[32px] font-semibold">Your longevity plan</h1>
          <p className={["mt-4 font-body text-[18px] font-semibold leading-8", isDark ? "text-[#DDD3EA]" : "text-[#766C80]"].join(" ")}>We could not load your plan just now. Please try again shortly.</p>
          <button type="button" onClick={() => navigate(backPath)} className="mt-7 min-h-[58px] rounded-[20px] bg-vyva-purple px-8 font-body text-[17px] font-black text-white">Return to My Health</button>
        </section>
      </main>
    );
  }

  const openAction = (action: string) => {
    const route = actionRoute(action);
    if (route) navigate(route);
    else navigate("/chat?mode=voice&q=" + encodeURIComponent("Help me with this longevity plan action: " + action));
  };

  const sourceLabels: Record<string, string> = {
    vitals: "Recent heart and breathing readings",
    medications: "Your current medicine routine",
    cognitive: "Recent Brain Coach activity",
    mood: "Recent check-ins and recovery patterns",
    symptoms: "Symptoms you recently shared",
  };

  const priorityDefinition = resolvePriorityDefinition(plan);
  const priorityPillarId = priorityDefinition?.id ?? null;
  const priorityLabel = priorityDefinition?.label ?? plan.priority_pillar;
  const priorityActions = priorityPillarId ? plan.recommendations?.[priorityPillarId] ?? [] : [];
  const orderedPillars = priorityDefinition
    ? [priorityDefinition, ...PILLARS.filter((pillar) => pillar.id !== priorityDefinition.id)]
    : PILLARS;
  const heroHeadline = personalisedHeadline(firstName, plan.priority_intervention, priorityLabel);
  const seniorNarrative = personalisedNarrative(plan.plan_narrative_senior, firstName);
  const planDate = formatPlanDate(plan.generated_at);
  const vyvaPrompt = plan.priority_intervention
    ? "Explain why this is my priority and help me start: " + plan.priority_intervention
    : "Explain my longevity plan and help me choose where to start";
  const careTeamSummary = [
    plan.plan_narrative_caregiver,
    priorityLabel ? "Priority this month: " + priorityLabel : null,
    plan.priority_intervention ? "Focus: " + plan.priority_intervention : null,
    plan.priority_why ? "Why it matters: " + plan.priority_why : null,
    priorityActions.length > 0 ? "Key actions:\n" + priorityActions.map((item) => "• " + item.action).join("\n") : null,
  ].filter((value): value is string => Boolean(value)).join("\n\n");

  const copyCareText = async () => {
    if (!careTeamSummary) return;
    await navigator.clipboard.writeText(careTeamSummary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const shareCareText = async () => {
    if (!careTeamSummary) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "VYVA Longevity Plan", text: careTeamSummary });
        setShareFeedback("shared");
        window.setTimeout(() => setShareFeedback(null), 1800);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(careTeamSummary);
    setShareFeedback("copied");
    window.setTimeout(() => setShareFeedback(null), 1800);
  };

  const surfaceClass = isDark
    ? "bg-[radial-gradient(circle_at_50%_-10%,#21162A_0%,#160D1C_46%,#110914_100%)] text-[#F8F2FF]"
    : "bg-[radial-gradient(circle_at_50%_0%,#F4EAFB_0%,#FFF9F3_72%)] text-[#241C30]";
  const cardClass = isDark
    ? "border-white/[0.12] bg-white/[0.07] shadow-[0_18px_48px_rgba(0,0,0,0.18)]"
    : "border-[#EEE8F1] bg-white shadow-[0_18px_42px_rgba(80,52,109,0.08)]";
  const mutedTextClass = isDark ? "text-[#D9CFE3]" : "text-[#766C80]";
  const dividerClass = isDark ? "border-white/[0.1]" : "border-[#EEE8F1]";

  return (
    <main data-testid="prevention-plan-screen" data-home-master-theme={isDark ? "dark" : "light"} className={["min-h-[100svh] w-full overflow-x-hidden px-5 pb-40 pt-6 sm:px-7 sm:pt-8", surfaceClass].join(" ")}>
      <div className="vyva-home-master-fixed-type mx-auto w-full max-w-[900px]">
        <header className="grid grid-cols-[44px_1fr_44px] items-center gap-3" data-testid="prevention-plan-topbar">
          <button type="button" onClick={() => navigate(backPath)} aria-label="Return to My Health" className={["vyva-tap grid h-11 min-h-11 w-11 place-items-center rounded-full border", isDark ? "border-white/[0.18] bg-white/[0.07]" : "border-black/[0.05] bg-white shadow-[0_12px_28px_rgba(80,52,109,0.12)]"].join(" ")}>
            <VyvaIcon icon={ArrowLeft} size={20} strokeWidth={2.45} tone={isDark ? "inverse" : "brand"} />
          </button>
          <h1 className="truncate text-center font-display text-[24px] font-semibold tracking-[-0.03em]">Longevity</h1>
          <button type="button" aria-label="Ask VYVA about this plan" onClick={() => navigate("/chat?mode=voice&q=" + encodeURIComponent(vyvaPrompt))} className="vyva-tap grid h-11 min-h-11 w-11 place-items-center rounded-full border border-white/70 bg-vyva-purple text-white shadow-[0_14px_30px_rgba(124,58,237,0.24)]">
            <VyvaIcon icon={Mic} size={19} strokeWidth={2.45} tone="inverse" />
          </button>
        </header>

        <section className="relative mt-7 overflow-hidden rounded-[16px] border-[0.5px] border-[#E8E0D0] border-l-4 border-l-[#F59E0B] bg-[#FFFFFF] px-5 py-6 shadow-[0_18px_42px_rgba(80,52,109,0.08)] sm:px-7 sm:py-7">
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-[18px] bg-[#FFF7E8] ring-1 ring-inset ring-[#F6D7A4]"><VyvaIcon glyph="longevity" size={44} /></span>
                <div>
                  <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-[#854F0B]">Your monthly plan</p>
                  <p className="mt-1 font-body text-[14px] font-bold" style={{ color: "var(--text-secondary, #766C80)" }}>{[planDate, TRAJECTORY_LABELS[plan.trajectory]].filter(Boolean).join(" · ")}</p>
                </div>
              </div>
              {priorityDefinition ? <span className="rounded-full bg-[#FAEEDA] px-4 py-2 font-body text-[12px] font-black text-[#854F0B]">{priorityDefinition.shortLabel} focus</span> : null}
            </div>
            <h2 className="mt-6 max-w-[700px] font-display text-[22px] font-medium leading-[1.16]" style={{ color: "var(--text-primary, #241C30)" }}>{heroHeadline}</h2>
            {seniorNarrative ? <p className="mt-3 max-w-[720px] font-body text-[16px] font-semibold leading-6" style={{ color: "var(--text-secondary, #766C80)" }}>{seniorNarrative}</p> : null}
            <button type="button" onClick={() => navigate("/chat?mode=voice&q=" + encodeURIComponent(vyvaPrompt))} className="mt-6 inline-flex h-14 min-h-14 w-full items-center justify-center gap-3 rounded-[18px] bg-[#6B21A8] px-6 font-body text-[16px] font-black text-white shadow-[0_12px_28px_rgba(107,33,168,0.18)]">
              <VyvaIcon icon={Mic} accent="dot" size={22} strokeWidth={2.5} tone="inverse" />Ask VYVA about my plan
            </button>
          </div>
        </section>

        <section className="mt-9" aria-labelledby="five-pillars-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-[#9D4FE0]">The full picture</p>
              <h2 id="five-pillars-heading" className="mt-1 font-display text-[28px] font-semibold tracking-[-0.03em]">Your five pillars</h2>
            </div>
            <p className={["max-w-[350px] font-body text-[14px] font-semibold leading-6", mutedTextClass].join(" ")}>Your real plan, organised around the five areas VYVA already reviews.</p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4">
            {orderedPillars.map((pillar) => {
              const status = pillarStatus(plan, pillar.id);
              const isPriority = priorityPillarId === pillar.id;
              const statusDisplay = isPriority ? { label: "← This month", tone: "warning" as const } : STATUS[status];
              const recommendations = plan.recommendations?.[pillar.id] ?? [];
              const Icon = pillar.icon;
              return (
                <article
                  key={pillar.id}
                  className={["relative rounded-[28px] border p-5 sm:p-6", cardClass, isPriority && isDark ? "border-[#D89225]/70" : "", isPriority && !isDark ? "border-[#E7B553]" : ""].join(" ")}
                  style={isPriority ? { borderLeft: "4px solid #F59E0B" } : undefined}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4">
                      <span className={["grid h-14 w-14 shrink-0 place-items-center rounded-[19px]", isDark ? "bg-[#3C2956]" : "bg-[#F1E8FF]"].join(" ")}><VyvaIcon icon={Icon} accent={pillar.accent} size={29} strokeWidth={2.45} tone="brand" /></span>
                      <div className="min-w-0">
                        {isPriority ? <p className="font-body text-[11px] font-black uppercase tracking-[0.11em] text-[#D89225]">Priority focus</p> : null}
                        <h3 className="mt-0.5 font-display text-[22px] font-semibold tracking-[-0.025em]">{pillar.label}</h3>
                      </div>
                    </div>
                    <span className={["rounded-full px-3.5 py-2 font-body text-[12px] font-black", isPriority ? "bg-[#FAEEDA] text-[#854F0B]" : statusClass(statusDisplay.tone, isDark)].join(" ")}>{statusDisplay.label}</span>
                  </div>
                  <div className={["mt-5 border-t pt-3", dividerClass].join(" ")}>
                    {recommendations.length > 0 ? (
                      <ul className={["divide-y", dividerClass].join(" ")}>
                        {recommendations.map((item) => (
                          <li key={item.action}>
                            <button type="button" onClick={() => openAction(item.action)} className={["group grid min-h-[66px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-[16px] py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6]", isDark ? "hover:bg-white/[0.05]" : "hover:bg-[#FAF7FC]"].join(" ")}>
                              <span className="min-w-0">
                                <span className="block font-body text-[16px] font-black leading-6">{item.action}</span>
                                {item.why ? <span className={["mt-0.5 block font-body text-[13px] font-semibold leading-5", mutedTextClass].join(" ")}>{item.why}</span> : null}
                              </span>
                              <VyvaIcon icon={ChevronRight} size={20} strokeWidth={2.5} tone={isDark ? "inverse" : "muted"} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : <p className={["py-3 font-body text-[15px] font-semibold leading-6", mutedTextClass].join(" ")}>Your next actions will appear after the plan has enough information.</p>}
                  </div>
                  {isPriority && plan.priority_why ? (
                    <div className="mt-4 rounded-[18px] bg-[#FAEEDA] px-4 py-4">
                      <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#854F0B]">Why this matters</p>
                      <p className="mt-1.5 font-body text-[14px] font-bold leading-6 text-[#633806]">{plan.priority_why}</p>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-6 space-y-4">
          <details className={["group rounded-[26px] border", cardClass].join(" ")}>
            <summary className="flex min-h-[72px] cursor-pointer list-none items-center justify-between gap-4 px-5 font-body text-[17px] font-black sm:px-6">
              <span className="flex items-center gap-3"><span className={["grid h-10 w-10 place-items-center rounded-[14px]", isDark ? "bg-[#3C2956]" : "bg-[#F1E8FF]"].join(" ")}><VyvaIcon icon={Sparkles} accent="spark" size={22} strokeWidth={2.4} tone="brand" /></span>Why these steps?</span>
              <ChevronDown className="transition-transform group-open:rotate-180" size={22} />
            </summary>
            <div className={["border-t px-5 py-5 sm:px-6", dividerClass].join(" ")}>
              {seniorNarrative ? <p className={["font-body text-[16px] font-semibold leading-7", mutedTextClass].join(" ")}>{seniorNarrative}</p> : null}
              {Object.values(plan.source_signals ?? {}).some(Boolean) ? (
                <div className={seniorNarrative ? "mt-5" : ""}>
                  <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#9D4FE0]">Signals considered</p>
                  <ul className={["mt-2 divide-y", dividerClass].join(" ")}>
                    {Object.entries(plan.source_signals ?? {}).filter(([, available]) => available).map(([domain]) => (
                      <li key={domain} className={["flex min-h-[48px] items-center gap-3 py-2 font-body text-[14px] font-bold leading-6", mutedTextClass].join(" ")}><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[#F8AE1B]" /><span>{sourceLabels[domain] ?? "Recent VYVA activity"}</span></li>
                    ))}
                  </ul>
                </div>
              ) : <p className={[(seniorNarrative ? "mt-4 " : "") + "font-body text-[16px] font-semibold leading-7", mutedTextClass].join(" ")}>This first plan uses general-wellness guidance while VYVA learns what matters to you.</p>}
            </div>
          </details>

          <details className={["group rounded-[26px] border", cardClass].join(" ")}>
            <summary className="flex min-h-[72px] cursor-pointer list-none items-center justify-between gap-4 px-5 font-body text-[17px] font-black sm:px-6">
              <span className="flex items-center gap-3"><span className={["grid h-10 w-10 place-items-center rounded-[14px]", isDark ? "bg-[#3C2956]" : "bg-[#F1E8FF]"].join(" ")}><VyvaIcon icon={Clipboard} accent="bookmark" size={22} strokeWidth={2.4} tone="brand" /></span>Care-team summary</span>
              <ChevronDown className="transition-transform group-open:rotate-180" size={22} />
            </summary>
            <div className={["border-t px-5 py-5 sm:px-6", dividerClass].join(" ")}>
              <p className={["font-body text-[16px] font-semibold leading-7", mutedTextClass].join(" ")}>{plan.plan_narrative_caregiver || "A care-team summary will appear when the monthly synthesis is complete."}</p>
              {priorityLabel ? <div className={["mt-5 rounded-[18px] border px-4 py-4", isDark ? "border-[#6D4A1A] bg-[#3D2C16]" : "border-[#F2D08E] bg-[#FFF5E1]"].join(" ")}><p className={["font-body text-[16px] font-black", isDark ? "text-[#FFE0A3]" : "text-[#6D4105]"].join(" ")}>Priority: {priorityLabel}</p>{plan.priority_intervention ? <p className={["mt-2 font-body text-[14px] font-bold leading-6", isDark ? "text-[#E8C88D]" : "text-[#76521E]"].join(" ")}>{plan.priority_intervention}</p> : null}</div> : null}
              {priorityActions.length > 0 ? <div className="mt-5"><p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-[#9D4FE0]">Key actions</p><ul className={["mt-2 divide-y", dividerClass].join(" ")}>{priorityActions.map((item) => <li key={item.action} className="flex min-h-[48px] items-center gap-3 py-2 font-body text-[14px] font-black leading-6"><span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[#F8AE1B]" /><span>{item.action}</span></li>)}</ul></div> : null}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => void copyCareText()} disabled={!careTeamSummary} className={["flex min-h-[56px] items-center justify-center gap-3 rounded-[18px] border-2 px-5 font-body text-[15px] font-black disabled:opacity-40", isDark ? "border-[#9D4FE0] text-[#DAB6FF]" : "border-[#7C3AED] text-[#6B21A8]"].join(" ")}>
                  {copied ? <VyvaIcon icon={Check} size={21} tone={isDark ? "inverse" : "brand"} /> : <VyvaIcon icon={Clipboard} accent="bookmark" size={21} tone={isDark ? "inverse" : "brand"} />}{copied ? "Copied" : "Copy summary"}
                </button>
                <button type="button" onClick={() => void shareCareText()} disabled={!careTeamSummary} className="flex min-h-[56px] items-center justify-center gap-3 rounded-[18px] bg-vyva-purple px-5 font-body text-[15px] font-black text-white disabled:opacity-40">
                  <VyvaIcon icon={shareFeedback ? Check : Share2} size={21} tone="inverse" />{shareFeedback === "shared" ? "Shared" : shareFeedback === "copied" ? "Copied" : "Share summary"}
                </button>
              </div>
              {/* TODO: Add GP-ready PDF export from plan_abstract_gp after pilot data exists. */}
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}

// TODO: Add ElevenLabs structured voice walkthroughs for each pillar.
// TODO: Show month-over-month trajectory after at least two plans exist.
// TODO: Learn from Done and Skip outcomes after at least three months.
