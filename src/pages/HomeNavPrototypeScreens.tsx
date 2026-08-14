import type { ReactNode } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { VYVA_OPEN_SOS_EVENT } from "@/lib/sosEvents";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  FileText,
  Heart,
  Home,
  Menu,
  MessageCircle,
  Mic,
  Phone,
  Pill,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  User,
  Users,
  X,
} from "lucide-react";

type RowTone = "health" | "brain" | "community" | "concierge" | "reports" | "profile";

type RowItem = {
  icon: typeof Heart;
  title: string;
  subtitle: string;
  meta?: string;
  action?: string;
  tone?: RowTone;
  path?: string;
  onClick?: () => void;
  testId?: string;
};

const toneStyles: Record<RowTone, string> = {
  health: "bg-rose-50 text-rose-500 ring-rose-100",
  brain: "bg-violet-50 text-violet-500 ring-violet-100",
  community: "bg-blue-50 text-blue-500 ring-blue-100",
  concierge: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  reports: "bg-slate-50 text-slate-500 ring-slate-100",
  profile: "bg-amber-50 text-amber-500 ring-amber-100",
};

function usePrototypeNavigate() {
  const navigate = useNavigate();
  return (path: string) => navigate(path);
}

function openExistingSos(source: string) {
  window.dispatchEvent(new CustomEvent(VYVA_OPEN_SOS_EVENT, { detail: { source } }));
}

function PrototypeShell({
  children,
  testId,
  quiet = false,
}: {
  children: ReactNode;
  testId: string;
  quiet?: boolean;
}) {
  return (
    <main
      data-testid={testId}
      className={`min-h-[100svh] overflow-x-hidden pb-28 text-[#21152f] ${
        quiet
          ? "bg-gradient-to-b from-[#fbf4ff] via-[#fffaff] to-white"
          : "bg-gradient-to-b from-[#fbf5ff] via-[#fffaff] to-white"
      }`}
    >
      <div className="mx-auto flex min-h-[100svh] w-full max-w-[430px] flex-col px-6 pt-9">
        {children}
      </div>
    </main>
  );
}

function RoundButton({
  children,
  label,
  onClick,
  testId,
  className = "",
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  testId?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      data-testid={testId}
      onClick={onClick}
      className={`grid h-14 w-14 place-items-center rounded-[1.45rem] bg-white text-[#8b8294] shadow-[0_18px_44px_rgba(84,52,109,0.13)] ring-1 ring-black/5 transition active:scale-95 ${className}`}
    >
      {children}
    </button>
  );
}

function PrototypeTopbar({ title }: { title?: string }) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="grid h-11 w-11 place-items-center rounded-[1.1rem] bg-white text-violet-700 shadow-[0_14px_35px_rgba(80,38,133,0.13)]">
          <Sparkles className="h-6 w-6" strokeWidth={3} />
        </div>
        <div className="leading-none">
          <p className="font-display text-[2rem] leading-none text-[#221529]">{title ?? "16:06"}</p>
          <p className="mt-1 text-[0.95rem] font-semibold text-[#8d8492]">Thursday, August 13</p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[#766b75]">
        <Bell className="h-6 w-6" />
        <User className="h-6 w-6" />
      </div>
    </div>
  );
}

function BackButton({ label = "Back" }: { label?: string }) {
  const navigate = usePrototypeNavigate();
  return (
    <RoundButton label={label} onClick={() => navigate("/")}>
      <ArrowLeft className="h-7 w-7 text-[#231728]" strokeWidth={3} />
    </RoundButton>
  );
}

function CompanionOrb({
  compact = false,
  testId = "prototype-orb",
}: {
  compact?: boolean;
  testId?: string;
}) {
  const size = compact ? "h-28 w-28" : "h-44 w-44";
  const inner = compact ? "h-20 w-20" : "h-32 w-32";
  return (
    <div data-testid={testId} data-orb-state="idle" className={`relative mx-auto grid ${size} place-items-center`}>
      <span className="absolute inset-0 rounded-full border border-violet-200/60" />
      <span className="absolute inset-[10%] rounded-full border border-violet-200/70" />
      <span className="absolute inset-[20%] rounded-full border border-violet-200/75" />
      <span
        className={`${inner} rounded-full bg-[radial-gradient(circle_at_35%_30%,#dec1ff_0%,#b87df5_42%,#8b4fe1_100%)] shadow-[inset_-12px_-16px_30px_rgba(66,31,116,0.25),0_18px_36px_rgba(133,82,208,0.24)]`}
      />
    </div>
  );
}

function OrbPrompt({
  compact = false,
  label = "Tap to ask VYVA",
}: {
  compact?: boolean;
  label?: string;
}) {
  return (
    <div className={compact ? "mt-1 text-center" : "mt-2 text-center"}>
      <p className="text-[0.58rem] font-black uppercase tracking-[0.08em] text-[#aaa1b2]">
        {label}
      </p>
    </div>
  );
}

function Hero({
  title,
  subtitle,
  compactOrb = true,
}: {
  title: string;
  subtitle: ReactNode;
  compactOrb?: boolean;
}) {
  return (
    <section className="text-center">
      <h1 className="font-display text-[2.55rem] font-black leading-[0.94] tracking-[-0.03em] text-[#24152f]">
        {title}
      </h1>
      <div className="mt-7">
        <CompanionOrb compact={compactOrb} />
        <OrbPrompt compact={compactOrb} />
      </div>
      <div className="mx-auto mt-4 max-w-[17rem] text-[0.98rem] font-extrabold leading-snug text-[#83798d]">
        {subtitle}
      </div>
    </section>
  );
}

function RowCard({ item }: { item: RowItem }) {
  const Icon = item.icon;
  const tone = item.tone ?? "profile";
  const navigate = usePrototypeNavigate();
  return (
    <button
      type="button"
      data-testid={item.testId}
      onClick={() => {
        if (item.onClick) {
          item.onClick();
          return;
        }
        if (item.path) {
          navigate(item.path);
        }
      }}
      className="group flex w-full items-center gap-3 rounded-[1.35rem] bg-white/95 px-3 py-3 text-left shadow-[0_14px_36px_rgba(60,39,80,0.08)] ring-1 ring-[#efe7f3]"
    >
      <span
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-[1rem] ring-1 ${toneStyles[tone]}`}
      >
        <Icon className="h-6 w-6" strokeWidth={2.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.95rem] font-black leading-tight text-[#2a1a35]">{item.title}</span>
        <span className="mt-0.5 block text-[0.72rem] font-bold leading-snug text-[#9a91a2]">
          {item.subtitle}
        </span>
      </span>
      {item.meta ? (
        <span className="text-[0.88rem] font-black text-[#392946]">{item.meta}</span>
      ) : item.action ? (
        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[0.64rem] font-black text-violet-600">
          {item.action}
        </span>
      ) : (
        <ChevronRight className="h-4 w-4 text-[#c4bcc9]" strokeWidth={3} />
      )}
    </button>
  );
}

function TrendCard({
  title,
  copy,
  tone = "brain",
}: {
  title: string;
  copy: ReactNode;
  tone?: RowTone;
}) {
  const bars = [24, 36, 31, 46, 42, 58, 66];
  const barColor = tone === "health" ? "bg-rose-400/65" : "bg-violet-400/65";

  return (
    <section className="mt-4 rounded-[1.6rem] bg-white/90 px-4 py-4 shadow-[0_14px_34px_rgba(60,39,80,0.07)] ring-1 ring-[#efe7f3]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-[0.1em] text-[#a098aa]">
            {title}
          </p>
          <p className="mt-1 text-[0.82rem] font-extrabold leading-snug text-[#756a7d]">
            {copy}
          </p>
        </div>
        <div className="flex h-12 w-24 items-end gap-1.5" aria-hidden="true">
          {bars.map((height, index) => (
            <span
              key={`${title}-${height}-${index}`}
              className={`w-2 rounded-full ${barColor}`}
              style={{ height }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function RowList({ items }: { items: RowItem[] }) {
  return (
    <div className="mt-6 space-y-2.5">
      {items.map((item) => (
        <RowCard key={`${item.title}-${item.subtitle}`} item={item} />
      ))}
    </div>
  );
}

export function PrototypeHomeScreen() {
  const navigate = usePrototypeNavigate();
  return (
    <PrototypeShell testId="home-master-layout">
      <div className="grid grid-cols-3 items-start">
        <RoundButton label="Profile" testId="button-home-profile" onClick={() => navigate("/settings/account")}>
          <User className="h-6 w-6" />
        </RoundButton>
        <p className="pt-7 text-center text-[0.72rem] font-black text-[#aaa1b2]">Thursday, August 13</p>
        <RoundButton
          label="Menu"
          testId="button-home-menu"
          onClick={() => navigate("/menu")}
          className="justify-self-end"
        >
          <Menu className="h-6 w-6" strokeWidth={3} />
        </RoundButton>
      </div>

      <section className="mt-20 text-center">
        <h1 className="font-display text-[2.45rem] font-black leading-none tracking-[-0.035em]">
          Good evening, Karim
        </h1>
        <div className="mt-8">
          <CompanionOrb testId="home-dormant-zamora-orb-visual" />
          <OrbPrompt label="Tap the circle to talk" />
        </div>
        <div
          data-testid="home-moment-card"
          className="mx-auto mt-5 flex max-w-[18rem] items-center justify-center gap-3 rounded-[1.5rem] bg-white/75 px-4 py-3 shadow-[0_12px_32px_rgba(82,52,112,0.08)] ring-1 ring-[#efe7f3]"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-50 text-violet-600">
            <ShieldCheck className="h-4 w-4" strokeWidth={3} />
          </span>
          <p className="text-left text-[0.86rem] font-extrabold leading-snug text-[#807686]">
            Right where it usually is — <span className="text-violet-600">steady all day.</span>
          </p>
          <div className="h-1.5 w-7 shrink-0 rounded-full bg-violet-500" />
        </div>
      </section>
    </PrototypeShell>
  );
}

export function PrototypeHealthScreen() {
  const [showMoreMetrics, setShowMoreMetrics] = useState(false);
  const rows: RowItem[] = [
    {
      icon: Activity,
      title: "Quick check-in",
      subtitle: "A gentle preventive check with VYVA",
      tone: "brain",
      path: "/health/check-in",
      testId: "button-health-quick-checkin",
    },
    {
      icon: Heart,
      title: "Heart rate",
      subtitle: "Resting range looks usual",
      meta: "72 bpm",
      tone: "health",
    },
    {
      icon: Activity,
      title: "Oxygen",
      subtitle: "Holding steady this morning",
      meta: "97%",
      tone: "health",
    },
    {
      icon: Pill,
      title: "Medicine reminder",
      subtitle: "Your next tablet is later today",
      meta: "2:00 PM",
      tone: "profile",
    },
    {
      icon: ChevronRight,
      title: showMoreMetrics ? "Hide extra metrics" : "Show 2 more metrics",
      subtitle: "Blood pressure and rest pattern",
      action: showMoreMetrics ? "Hide" : "Show",
      tone: "community",
      onClick: () => setShowMoreMetrics((current) => !current),
    },
  ];

  const extraRows: RowItem[] = showMoreMetrics
    ? [
        {
          icon: Activity,
          title: "Blood pressure",
          subtitle: "In your usual range",
          meta: "120/78",
          tone: "reports",
        },
        {
          icon: ShieldCheck,
          title: "Rest pattern",
          subtitle: "About the same as last week",
          action: "Steady",
          tone: "brain",
        },
      ]
    : [];

  return (
    <PrototypeShell testId="prototype-health-screen" quiet>
      <BackButton />
      <div className="mt-2">
        <Hero
          title="Health"
          subtitle={
            <>
              Right where it usually is — <span className="text-violet-600">steady all day.</span>
            </>
          }
        />
      </div>
      <RowList items={[...rows, ...extraRows]} />
      <TrendCard
        title="Health signals — this week"
        tone="health"
        copy={
          <>
            A small rise after lunch, then <span className="text-violet-600">back to usual.</span>
          </>
        }
      />
    </PrototypeShell>
  );
}

export function PrototypeBrainScreen() {
  const rows: RowItem[] = [
    {
      icon: Sparkles,
      title: "Rhythm Tap",
      subtitle: "84% accuracy yesterday — your best this month",
      action: "Play",
      tone: "brain",
    },
    {
      icon: Brain,
      title: "Face-Name Match",
      subtitle: "Not played yet today",
      action: "Play",
      tone: "community",
    },
    {
      icon: MessageCircle,
      title: "Mood check-in",
      subtitle: "How are you feeling today?",
      action: "Check in",
      tone: "profile",
    },
  ];

  return (
    <PrototypeShell testId="prototype-brain-screen" quiet>
      <BackButton />
      <Hero
        title="My Brain"
        subtitle={
          <>
            Five days strong — <span className="text-violet-600">keep it going.</span>
          </>
        }
      />
      <RowList items={rows} />
      <TrendCard
        title="Rhythm Tap accuracy"
        tone="brain"
        copy={
          <>
            Your rhythm score has been <span className="text-violet-600">gently climbing.</span>
          </>
        }
      />
    </PrototypeShell>
  );
}

export function PrototypeCommunityScreen() {
  const rows: RowItem[] = [
    {
      icon: BookOpen,
      title: "Book Club",
      subtitle: "Elena loved that ending — 9 min ago",
      action: "Open",
      tone: "community",
    },
    {
      icon: Users,
      title: "Family Chat",
      subtitle: "Sofia: Call me when you’re free",
      action: "Open",
      tone: "health",
    },
    {
      icon: MessageCircle,
      title: "Neighbors Group",
      subtitle: "3 new messages this week",
      action: "Open",
      tone: "concierge",
    },
  ];

  return (
    <PrototypeShell testId="prototype-community-screen" quiet>
      <BackButton />
      <Hero
        title="Community"
        subtitle={
          <>
            Elena replied in your <span className="text-violet-600">Book Club room.</span>
          </>
        }
      />
      <RowList items={rows} />
    </PrototypeShell>
  );
}

export function PrototypeConciergeScreen() {
  const rows: RowItem[] = [
    {
      icon: Activity,
      title: "Ride to Dr. Reyes",
      subtitle: "Confirmed — Friday, 10:00 AM",
      action: "Details",
      tone: "concierge",
    },
    {
      icon: Pill,
      title: "Pharmacy refill",
      subtitle: "Ready for pickup Thursday",
      action: "Details",
      tone: "profile",
    },
    {
      icon: ShoppingBag,
      title: "Grocery delivery",
      subtitle: "Scheduled Saturday, 2:00 PM",
      action: "Details",
      tone: "community",
    },
  ];

  return (
    <PrototypeShell testId="prototype-concierge-screen" quiet>
      <BackButton />
      <Hero
        title="Concierge"
        subtitle={
          <>
            Your ride to Dr. Reyes is <span className="text-emerald-600">confirmed.</span>
          </>
        }
      />
      <RowList items={rows} />
    </PrototypeShell>
  );
}

export function PrototypeReportsScreen() {
  const rows: RowItem[] = [
    {
      icon: Activity,
      title: "Steps",
      subtitle: "Most active week this month",
      meta: "12,460",
      tone: "reports",
    },
    {
      icon: Sparkles,
      title: "Rhythm Tap",
      subtitle: "Played 6 of 7 days",
      meta: "79%",
      tone: "brain",
    },
    {
      icon: Users,
      title: "Conversations",
      subtitle: "Elena, Sofia, and the Book Club room",
      meta: "9",
      tone: "health",
    },
    {
      icon: CheckCircle2,
      title: "Appointments kept",
      subtitle: "Both planned visits were completed",
      meta: "2/2",
      tone: "concierge",
    },
  ];

  return (
    <PrototypeShell testId="prototype-reports-screen" quiet>
      <BackButton />
      <Hero title="My Reports" subtitle="A good week, Karim." />
      <RowList items={rows} />
    </PrototypeShell>
  );
}

export function PrototypeProfileScreen() {
  const rows: RowItem[] = [
    {
      icon: User,
      title: "Sofía — daughter",
      subtitle: "Can see your health and activity",
      action: "Manage",
      tone: "community",
    },
    {
      icon: Heart,
      title: "Dr. Pablo Rossi — care team",
      subtitle: "Reviews your health reports monthly",
      action: "Manage",
      tone: "health",
    },
    {
      icon: Settings,
      title: "Text size",
      subtitle: "Large",
      action: "Change",
      tone: "brain",
    },
    {
      icon: MessageCircle,
      title: "Voice & language",
      subtitle: "English (US), calm, unhurried pace",
      action: "Change",
      tone: "concierge",
    },
    {
      icon: ShieldCheck,
      title: "Reminder gentleness",
      subtitle: "Gentle nudges, never repeated too quickly",
      action: "Change",
      tone: "reports",
    },
  ];

  return (
    <PrototypeShell testId="prototype-profile-screen" quiet>
      <BackButton />
      <section className="text-center">
        <h1 className="font-display text-[2.45rem] font-black leading-none tracking-[-0.035em]">
          My Profile
        </h1>
        <div className="mx-auto mt-7 grid h-20 w-20 place-items-center rounded-full bg-violet-500 text-3xl font-black text-white shadow-[0_18px_36px_rgba(126,64,216,0.25)]">
          K
        </div>
        <p className="mt-3 text-xl font-black">Karim</p>
        <p className="text-sm font-bold text-[#9b92a3]">Tarifa</p>
      </section>
      <p className="mt-7 text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#9f96a6]">
        Who’s looking out for you
      </p>
      <RowList items={rows} />
      <p className="mt-6 text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#9f96a6]">
        Make VYVA easier to use
      </p>
      <button
        type="button"
        className="mt-5 h-12 rounded-2xl bg-[#7b8390] text-sm font-black text-white shadow-[0_12px_28px_rgba(42,49,62,0.18)]"
      >
        <Phone className="mr-2 inline h-4 w-4" />
        Call support
      </button>
    </PrototypeShell>
  );
}

type CheckInStep = "q1" | "q2" | "summary" | "safety";

function CheckInCard({
  children,
  testId,
  questionId,
}: {
  children: ReactNode;
  testId?: string;
  questionId?: string;
}) {
  return (
    <section
      data-testid={testId}
      data-question-id={questionId}
      className="mx-auto mt-8 w-full max-w-[21rem] rounded-[2rem] bg-white px-5 py-7 text-center shadow-[0_22px_56px_rgba(58,34,86,0.12)] ring-1 ring-[#efe7f3]"
    >
      {children}
    </section>
  );
}

function CheckInOption({
  children,
  onClick,
  danger = false,
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`h-11 w-full rounded-2xl border text-[0.78rem] font-black transition active:scale-[0.99] ${
        danger
          ? "border-transparent bg-transparent text-red-500"
          : "border-[#eee7f0] bg-white text-[#372943] shadow-sm"
      }`}
    >
      {children}
    </button>
  );
}

export function PrototypeCheckInScreen() {
  const navigate = usePrototypeNavigate();
  const [step, setStep] = useState<CheckInStep>("q1");
  const [answers, setAnswers] = useState<string[]>([]);

  const answer = (value: string, next: CheckInStep) => {
    setAnswers((current) => [...current, value]);
    setStep(next);
  };

  if (step === "safety") {
    return (
      <PrototypeShell testId="prototype-checkin-safety" quiet>
        <div className="flex flex-1 items-center justify-center">
          <section className="w-full max-w-[21rem] rounded-[2rem] bg-white px-6 py-9 text-center shadow-[0_22px_56px_rgba(58,34,86,0.12)] ring-1 ring-[#efe7f3]">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-red-50 text-red-500">
              <AlertTriangle className="h-5 w-5" strokeWidth={3} />
            </span>
            <h1 className="mt-7 font-display text-[1.65rem] font-black leading-tight">
              Let’s get you help right now, Karim.
            </h1>
            <p className="mx-auto mt-3 max-w-[15rem] text-[0.8rem] font-bold leading-relaxed text-[#8d8492]">
              I’ve paused the check-in. Tap below and I’ll connect you right away.
            </p>
            <button
              type="button"
              data-testid="button-checkin-safety-sos"
              onClick={() => openExistingSos("health_checkin_safety")}
              className="mt-7 h-12 w-full rounded-2xl bg-[#ef6157] text-sm font-black text-white shadow-[0_16px_32px_rgba(239,97,87,0.22)]"
            >
              Get help now
            </button>
            <button
              type="button"
              data-testid="button-checkin-safety-resume"
              onClick={() => setStep("q1")}
              className="mt-3 h-12 w-full rounded-2xl bg-[#f4f0f7] text-sm font-black text-[#5f5369]"
            >
              I’m okay — go back
            </button>
          </section>
        </div>
      </PrototypeShell>
    );
  }

  if (step === "summary") {
    return (
      <PrototypeShell testId="prototype-checkin-summary-screen" quiet>
        <BackButton />
        <h1 className="mt-4 text-center font-display text-[2.15rem] font-black">Check-in</h1>
        <div className="mt-5 h-1.5 rounded-full bg-violet-500" />
        <CheckInCard testId="prototype-checkin-summary">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" strokeWidth={3} />
          </span>
          <h2 className="mt-7 font-display text-[1.75rem] font-black">Here’s what you told VYVA.</h2>
          <p className="mt-1 text-[0.82rem] font-bold text-[#948b9d]">Thanks for checking in, Karim.</p>
          <div className="mt-6 space-y-2 text-left">
            {answers.map((value) => {
              const [label, detail] = value.split(": ");
              return (
              <div
                key={value}
                className="flex items-center gap-3 rounded-2xl bg-[#fbf8fd] px-3 py-3 text-sm font-bold"
              >
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span>
                  <span className="block text-[#2a1a35]">{label}</span>
                  {detail ? <span className="block text-xs text-[#8d8492]">{detail}</span> : null}
                </span>
              </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => navigate("/health")}
            className="mt-7 h-12 w-full rounded-2xl bg-violet-600 text-sm font-black text-white shadow-[0_18px_34px_rgba(124,58,237,0.24)]"
          >
            Done
          </button>
        </CheckInCard>
      </PrototypeShell>
    );
  }

  return (
    <PrototypeShell testId="prototype-checkin-screen" quiet>
      <BackButton />
      <h1 className="mt-4 text-center font-display text-[2.15rem] font-black">Check-in</h1>
      <div className="mt-5 grid grid-cols-2 gap-1">
        <div className="h-1.5 rounded-full bg-violet-500" />
        <div className={`h-1.5 rounded-full ${step === "q2" ? "bg-violet-500" : "bg-[#ece5f2]"}`} />
      </div>

      <div
        data-testid="checkin-desktop-shell"
        className="lg:mx-auto lg:grid lg:w-full lg:max-w-4xl lg:grid-cols-[1fr_22rem_1fr] lg:items-start lg:gap-8"
      >
        <div className="hidden lg:block" />
        <CheckInCard
          testId="prototype-checkin-question"
          questionId={step === "q1" ? "feeling" : "detail"}
        >
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-violet-500 text-white">
            <Mic className="h-5 w-5" strokeWidth={3} />
          </span>
          {step === "q1" ? (
            <>
              <h2 className="mt-7 font-display text-[1.55rem] font-black leading-tight">
                How are you feeling today?
              </h2>
              <div className="mt-6 space-y-3">
                <CheckInOption onClick={() => answer("Feeling today: Great", "summary")}>Great</CheckInOption>
                <CheckInOption onClick={() => answer("Feeling today: Okay", "summary")}>Okay</CheckInOption>
                <CheckInOption onClick={() => answer("Feeling today: Not my best", "q2")}>
                  Not my best
                </CheckInOption>
                <CheckInOption onClick={() => answer("Feeling today: Something's bothering me", "q2")}>
                  Something&apos;s bothering me
                </CheckInOption>
                <CheckInOption
                  onClick={() => setStep("safety")}
                  danger
                  testId="button-checkin-urgent-escape"
                >
                  If this feels urgent, tap here
                </CheckInOption>
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-7 font-display text-[1.55rem] font-black leading-tight">
                Want to tell me a bit more?
              </h2>
              <div className="mt-6 space-y-3">
                <CheckInOption onClick={() => answer("A little more: Tired or low energy", "summary")}>
                  Tired or low energy
                </CheckInOption>
                <CheckInOption onClick={() => answer("A little more: Aches or discomfort", "summary")}>
                  Aches or discomfort
                </CheckInOption>
                <CheckInOption onClick={() => answer("A little more: Trouble sleeping", "summary")}>
                  Trouble sleeping
                </CheckInOption>
                <CheckInOption onClick={() => answer("A little more: Just an off day", "summary")}>
                  Just an off day
                </CheckInOption>
                <CheckInOption onClick={() => answer("A little more: Something else", "summary")}>
                  Something else
                </CheckInOption>
                <CheckInOption
                  onClick={() => setStep("safety")}
                  danger
                  testId="button-checkin-urgent-escape"
                >
                  If this feels urgent, tap here
                </CheckInOption>
              </div>
            </>
          )}
        </CheckInCard>
        <div className="hidden rounded-[2rem] bg-white/70 p-6 text-sm font-bold text-[#8d8492] ring-1 ring-[#efe7f3] lg:block">
          This is a UI fixture only. The real Flow state remains backend-owned.
        </div>
      </div>
    </PrototypeShell>
  );
}
