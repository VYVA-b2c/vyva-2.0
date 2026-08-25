import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronDown, ChevronRight, Clipboard, Mic, Share2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOptionalProfile } from "@/contexts/ProfileContext";
import { apiFetch } from "@/lib/queryClient";

type Pillar = "heart" | "brain" | "strength" | "nourishment" | "calm";
type PillarStatus = "thriving" | "steady" | "needs_attention" | "priority_focus";
type Recommendation = { action: string; why: string };

type PreventionPlanData = {
  id: string | null;
  generated_at: string | null;
  pillar_heart: PillarStatus;
  pillar_brain: PillarStatus;
  pillar_strength: PillarStatus;
  pillar_nourishment: PillarStatus;
  pillar_calm: PillarStatus;
  priority_pillar: Pillar | null;
  priority_intervention: string | null;
  priority_why: string | null;
  plan_narrative_senior: string | null;
  plan_narrative_caregiver: string | null;
  recommendations: Partial<Record<Pillar, Recommendation[]>>;
  source_signals: Record<string, boolean>;
  trajectory: "improving" | "stable" | "declining" | "first";
};

const PILLARS: Array<{ id: Pillar; icon: string; iconBackground: string; iconColor: string; label: string }> = [
  { id: "heart", icon: "ti-activity", iconBackground: "#FCEBEB", iconColor: "#A32D2D", label: "Heart & circulation" },
  { id: "brain", icon: "ti-brain", iconBackground: "#EEEDFE", iconColor: "#534AB7", label: "Brain & memory" },
  { id: "strength", icon: "ti-walk", iconBackground: "#E6F1FB", iconColor: "#185FA5", label: "Strength & stability" },
  { id: "nourishment", icon: "ti-leaf", iconBackground: "#EAF3DE", iconColor: "#3B6D11", label: "Nourishment" },
  { id: "calm", icon: "ti-ripple", iconBackground: "#E1F5EE", iconColor: "#0F6E56", label: "Calm & recovery" },
];

const STATUS: Record<PillarStatus, { label: string; className: string }> = {
  thriving: { label: "Thriving", className: "bg-[#149A63] text-white" },
  steady: { label: "Steady", className: "bg-[#EEE9E6] text-[#665B56]" },
  needs_attention: { label: "Needs attention", className: "bg-[#F59E0B] text-[#261600]" },
  priority_focus: { label: "Needs attention", className: "bg-[#F59E0B] text-[#261600]" },
};

const PRIORITY_STATUS = { label: "This month", className: "bg-[#FAEEDA] text-[#854F0B]" };

function narrativeForProfile(narrative: string | null, firstName: string): string | null {
  if (!narrative || !firstName) return narrative;
  return narrative.replace(/^[^,]+(?=,\s*this month\b)/i, firstName);
}

function usePreventionPlan(userId: string) {
  return useQuery<PreventionPlanData>({
    queryKey: ["prevention-plan", userId],
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async () => {
      const response = await apiFetch(`/api/prevention/plan/${encodeURIComponent(userId)}`);
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

function PreventionPlanSkeleton() {
  return (
    <main className="min-h-screen bg-[hsl(36_33%_97%)] px-5 pb-32 pt-6" aria-label="Loading longevity plan">
      <div className="mx-auto max-w-3xl animate-pulse space-y-6">
        <div className="h-[90px] rounded-[28px] bg-[#EDE5EF]" />
        <div className="h-[320px] rounded-[32px] bg-white" />
        {PILLARS.map((pillar) => <div key={pillar.id} className="h-[220px] rounded-[28px] bg-white" />)}
      </div>
    </main>
  );
}

export default function PreventionPlan() {
  const { user } = useAuth();
  const firstName = useOptionalProfile()?.firstName ?? "";
  const navigate = useNavigate();
  const userId = user?.id ?? "";
  const { data: plan, isLoading, isError } = usePreventionPlan(userId);
  const [copied, setCopied] = useState(false);

  if (isLoading || !userId) return <PreventionPlanSkeleton />;
  if (isError || !plan) {
    return (
      <main className="min-h-screen bg-[hsl(36_33%_97%)] px-5 pt-10 text-[#24132E]">
        <div className="mx-auto max-w-3xl rounded-[30px] bg-white p-8 text-center shadow-sm">
          <h1 className="text-[32px] font-black">Your longevity plan</h1>
          <p className="mt-4 text-[20px] leading-8 text-[#725F69]">We could not load your plan just now. Please try again shortly.</p>
          <button type="button" onClick={() => navigate("/health")} className="mt-7 min-h-[70px] rounded-full bg-[#6B21A8] px-8 text-[20px] font-bold text-white">Return to My Health</button>
        </div>
      </main>
    );
  }

  const generatedLabel = plan.generated_at
    ? new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(plan.generated_at))
    : "Preparing your first plan";
  const seniorNarrative = narrativeForProfile(plan.plan_narrative_senior, firstName);

  const openAction = (action: string) => {
    const route = actionRoute(action);
    if (route) navigate(route);
    else navigate(`/chat?mode=voice&q=${encodeURIComponent(`Help me with this longevity plan action: ${action}`)}`);
  };

  const sourceSentences: Record<string, string> = {
    vitals: "Your recent heart and breathing patterns helped shape this plan.",
    medications: "Your medicine routine helped shape the practical steps.",
    cognitive: "Your Brain Coach activity helped shape the brain focus.",
    mood: "Your recent check-ins helped shape the calm and recovery focus.",
    symptoms: "The changes you recently shared helped shape the plan.",
  };

  const copyCareText = async () => {
    if (!plan.plan_narrative_caregiver) return;
    await navigator.clipboard.writeText(plan.plan_narrative_caregiver);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="min-h-screen bg-[hsl(36_33%_97%)] px-4 pb-32 pt-5 text-[#24132E] sm:px-7">
      <div className="mx-auto max-w-3xl">
        <header className="grid min-h-[84px] grid-cols-[70px_1fr_70px] items-center">
          <button type="button" onClick={() => navigate("/health")} aria-label="Return to My Health" className="flex min-h-[70px] min-w-[70px] items-center justify-center rounded-full border border-[#E4D9E8] bg-white text-[#6B21A8] shadow-sm">
            <ArrowLeft size={30} />
          </button>
          <h1 className="text-center text-[30px] font-black">Longevity Plan</h1>
          <span aria-hidden="true" />
        </header>

        <section className="mt-5 rounded-[34px] border border-[#E9DDED] bg-white p-6 shadow-[0_20px_55px_rgba(107,33,168,0.08)] sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 text-[20px] font-extrabold uppercase tracking-[0.08em] text-[#6B21A8]">
            <span>Your longevity plan</span>
            <time className="text-[#806F79]">{generatedLabel}</time>
          </div>
          <p className="mt-7 text-[22px] font-medium leading-9 text-[#3D2C37]">
            {seniorNarrative || "Your monthly plan brings five areas together into a few practical steps. Begin with the action that feels easiest today."}
          </p>
          {plan.priority_pillar && (
            <div className="mt-7 inline-flex min-h-[70px] items-center rounded-full bg-[#FFF1CB] px-6 text-[20px] font-black uppercase text-[#704300]">
              This month: {PILLARS.find((item) => item.id === plan.priority_pillar)?.label}
            </div>
          )}
          {plan.priority_intervention && <p className="mt-6 text-[22px] font-black leading-8">{plan.priority_intervention}</p>}
          <button type="button" onClick={() => navigate(`/chat?mode=voice&q=${encodeURIComponent("Tell me about my monthly longevity plan")}`)} className="mt-8 flex min-h-[70px] w-full items-center justify-center gap-3 rounded-full bg-[#6B21A8] px-6 text-[20px] font-black text-white shadow-lg shadow-purple-900/15">
            <Mic size={28} /> Ask VYVA about this plan
          </button>
        </section>

        <h2 className="mb-4 mt-10 text-[20px] font-black uppercase tracking-[0.08em] text-[#6B21A8]">Your five pillars</h2>
        <div className="space-y-5">
          {PILLARS.map((pillar) => {
            const status = plan[`pillar_${pillar.id}`];
            const isPriority = plan.priority_pillar === pillar.id;
            const statusDisplay = isPriority ? PRIORITY_STATUS : STATUS[status];
            const recommendations = plan.recommendations?.[pillar.id] ?? [];
            return (
              <section key={pillar.id} className={`rounded-[30px] border border-[#E9DDED] bg-white p-6 shadow-sm ${isPriority ? "border-l-4 border-l-[#F59E0B]" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h3 className="flex items-center gap-3 text-[22px] font-black uppercase">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: pillar.iconBackground, color: pillar.iconColor }} aria-hidden="true">
                      <i className={`ti ${pillar.icon} text-[20px]`} />
                    </span>
                    {pillar.label}
                  </h3>
                  <span className={`inline-flex min-h-[52px] items-center gap-2 rounded-full px-5 text-[20px] font-black ${statusDisplay.className}`}>
                    {isPriority && <span aria-hidden="true">←</span>}
                    {statusDisplay.label}
                  </span>
                </div>
                <div className="my-5 h-px bg-[#EEE5E9]" />
                <ul className="divide-y-[0.5px] divide-[#E3D8DE]">
                  {recommendations.map((item) => (
                    <li key={item.action}>
                      <button type="button" onClick={() => openAction(item.action)} className="grid min-h-[52px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-1 py-2 text-left text-[18px] font-bold leading-6 transition-colors hover:bg-[#FBF8FC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6B21A8]">
                        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#8B5CF6]" />
                        <span>{item.action}</span>
                        <ChevronRight aria-hidden="true" className="text-[#8C7297]" size={20} strokeWidth={2.5} />
                      </button>
                    </li>
                  ))}
                  {recommendations.length === 0 && <li className="text-[20px] leading-8 text-[#725F69]">Your next actions will appear after the plan has enough information.</li>}
                </ul>
                {isPriority && plan.priority_why && (
                  <div className="mt-5 rounded-[18px] bg-[#FAEEDA] px-4 py-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#854F0B]">Why this matters</p>
                    <p className="mt-1.5 text-[14px] font-semibold leading-5 text-[#633806]">{plan.priority_why}</p>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <details className="mt-6 rounded-[26px] border border-[#E9DDED] bg-white">
          <summary className="flex min-h-[70px] cursor-pointer list-none items-center justify-between gap-4 px-6 text-[20px] font-black">What’s informing this plan?<ChevronDown size={26} /></summary>
          <div className="space-y-3 border-t border-[#EEE5E9] px-6 py-5">
            {Object.entries(plan.source_signals ?? {}).filter(([, available]) => available).map(([domain]) => <p key={domain} className="text-[20px] leading-8 text-[#5F5058]">{sourceSentences[domain] ?? "Your recent VYVA activity helped shape this plan."}</p>)}
            {!Object.values(plan.source_signals ?? {}).some(Boolean) && <p className="text-[20px] leading-8 text-[#5F5058]">This first plan uses gentle general-wellness guidance while VYVA learns what matters to you.</p>}
          </div>
        </details>

        <details className="mt-5 rounded-[26px] border border-[#E9DDED] bg-white">
          <summary className="flex min-h-[70px] cursor-pointer list-none items-center justify-between gap-4 px-6 text-[20px] font-black">For your care team<ChevronDown size={26} /></summary>
          <div className="border-t border-[#EEE5E9] px-6 py-5">
            <p className="text-[20px] leading-8 text-[#5F5058]">{plan.plan_narrative_caregiver || "A care-team summary will appear when the monthly synthesis is complete."}</p>
            <p className="mt-4 text-[20px] font-semibold text-[#806F79]">Generated {plan.generated_at ? new Date(plan.generated_at).toLocaleDateString() : "today"}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => void copyCareText()} disabled={!plan.plan_narrative_caregiver} className="flex min-h-[70px] items-center justify-center gap-3 rounded-full border-2 border-[#6B21A8] px-5 text-[20px] font-black text-[#6B21A8] disabled:opacity-40">{copied ? <Check size={25} /> : <Clipboard size={25} />}{copied ? "Copied" : "Copy"}</button>
              <button type="button" onClick={() => navigate("/concierge", { state: { preventionPlanSummary: plan.plan_narrative_caregiver } })} disabled={!plan.plan_narrative_caregiver} className="flex min-h-[70px] items-center justify-center gap-3 rounded-full bg-[#6B21A8] px-5 text-[20px] font-black text-white disabled:opacity-40"><Share2 size={25} />Share via Concierge</button>
            </div>
            {/* TODO: Add GP-ready PDF export from plan_abstract_gp after pilot data exists. */}
          </div>
        </details>
      </div>
    </main>
  );
}

// TODO: Add ElevenLabs structured voice walkthroughs for each pillar.
// TODO: Show month-over-month trajectory after at least two plans exist.
// TODO: Learn from Done and Skip outcomes after at least three months.
