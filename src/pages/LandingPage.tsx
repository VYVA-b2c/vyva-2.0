import { Link } from "react-router-dom";
import {
  ArrowRight,
  Activity,
  Brain,
  CheckCircle2,
  Clock3,
  FileText,
  HeartHandshake,
  HeartPulse,
  MapPin,
  MessageCircleHeart,
  Mic2,
  Pill,
  PhoneCall,
  ShieldCheck,
  Siren,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import { VyvaWordmark } from "@/components/VyvaWordmark";

const proofPoints = ["Daily reassurance", "Meds confirmed", "Family updated", "Safety signals"];

const careLoop = [
  { icon: Mic2, label: "Checks in", detail: "A familiar voice starts the daily touchpoint." },
  { icon: CheckCircle2, label: "Confirms", detail: "Medication, mood, symptoms, and routines." },
  { icon: Activity, label: "Spots change", detail: "Missed routines and concerns become visible." },
  { icon: UsersRound, label: "Updates family", detail: "The right people know what matters." },
];

const supportMoments = [
  {
    icon: Pill,
    title: "Medication confirmation",
    body: "Not just a reminder. A clear yes, no, or needs help.",
    tone: "bg-[#EEF2FF] text-[#4F46E5]",
  },
  {
    icon: Mic2,
    title: "Daily voice check-ins",
    body: "A simple call that can surface mood, symptoms, and risk.",
    tone: "bg-[#F3E8FF] text-[#7E22CE]",
  },
  {
    icon: Siren,
    title: "Safety signals",
    body: "When something feels off, the care circle gets context sooner.",
    tone: "bg-[#FEE2E2] text-[#B91C1C]",
  },
  {
    icon: Brain,
    title: "Engagement",
    body: "Stories, music, memory games, and reasons to stay connected.",
    tone: "bg-[#FEF3C7] text-[#B7791F]",
  },
];

const values = [
  "Extends care capacity",
  "Catches missed routines",
  "Reassures families sooner",
  "Protects privacy and consent",
];

const fullFeatureSet = [
  {
    icon: HeartPulse,
    title: "Health profile",
    body: "Conditions, allergies, providers, emergency context, and preferences.",
    tone: "bg-[#FCE7F3] text-[#BE185D]",
  },
  {
    icon: Pill,
    title: "Medication support",
    body: "Reminders, confirmations, routines, and adherence context.",
    tone: "bg-[#EEF2FF] text-[#4F46E5]",
  },
  {
    icon: Mic2,
    title: "Voice companion",
    body: "Natural check-ins by phone, app, or familiar channels.",
    tone: "bg-[#F3E8FF] text-[#7E22CE]",
  },
  {
    icon: Stethoscope,
    title: "Symptom guidance",
    body: "Structured questions when someone does not feel well.",
    tone: "bg-[#ECFDF5] text-[#047857]",
  },
  {
    icon: FileText,
    title: "Care summaries",
    body: "Clear reports families and care teams can understand quickly.",
    tone: "bg-[#FEF3C7] text-[#B7791F]",
  },
  {
    icon: ShieldCheck,
    title: "Safety layer",
    body: "Fall context, urgent signals, privacy, consent, and scam awareness.",
    tone: "bg-[#FEE2E2] text-[#B91C1C]",
  },
  {
    icon: Brain,
    title: "Brain coach",
    body: "Memory games, stories, music, quizzes, and gentle engagement.",
    tone: "bg-[#E0F2FE] text-[#0369A1]",
  },
  {
    icon: MapPin,
    title: "Concierge help",
    body: "Local support, useful places, services, and everyday assistance.",
    tone: "bg-[#DCFCE7] text-[#15803D]",
  },
  {
    icon: UsersRound,
    title: "Family dashboard",
    body: "Trusted people stay informed without taking over.",
    tone: "bg-[#FAE8FF] text-[#A21CAF]",
  },
];

const outcomeCards = [
  {
    icon: HeartHandshake,
    title: "For seniors",
    body: "A friendly voice, practical reminders, and support that feels human.",
  },
  {
    icon: UsersRound,
    title: "For families",
    body: "More confidence between calls, visits, and busy days.",
  },
  {
    icon: ShieldCheck,
    title: "For care teams",
    body: "Better context before small issues turn into emergencies.",
  },
];

function ProductPreview() {
  return (
    <section
      aria-label="VYVA product preview"
      className="relative mx-auto w-full max-w-[470px] overflow-hidden rounded-[34px] border border-[#E8DDD2] bg-white shadow-[0_28px_70px_rgba(79,43,116,0.18)] lg:max-w-[500px]"
    >
      <div className="bg-[#8253AB] px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-body text-xs font-bold uppercase text-[#FFDF61]">Voice active</p>
            <h2 className="mt-1 font-body text-xl font-extrabold">Maria is okay today</h2>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white">
            <PhoneCall className="h-6 w-6" aria-hidden="true" />
          </span>
        </div>
      </div>

      <div className="grid gap-0 sm:grid-cols-[0.88fr_1fr]">
        <div className="relative min-h-[280px] bg-[#F4EDF9] sm:min-h-[310px]">
          <img
            src="/vyva-avatar.png"
            alt="VYVA companion"
            className="absolute inset-0 h-full w-full object-cover object-[center_18%]"
          />
          <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white/94 px-3 py-2.5 text-[#2F183F] shadow-[0_12px_28px_rgba(47,24,63,0.16)] backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#10B981]" />
              <p className="font-body text-sm font-black">Good morning, Maria.</p>
            </div>
            <p className="mt-1 font-body text-xs font-semibold text-[#6F6475]">Did you sleep well?</p>
          </div>
        </div>

        <div className="space-y-3 bg-[#FFFBF6] p-4">
          {supportMoments.slice(0, 3).map((row) => {
            const Icon = row.icon;
            return (
              <article key={row.title} className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-[#EFE5DC] bg-white px-3 py-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${row.tone}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-body text-sm font-extrabold text-[#2F183F]">{row.title}</h3>
                  <p className="mt-0.5 font-body text-xs leading-snug text-[#7C6B63]">{row.body}</p>
                </div>
              </article>
            );
          })}
          <div className="rounded-2xl bg-[#FFDF61] px-4 py-3 text-[#3B2600]">
            <p className="font-body text-sm font-extrabold">Care signal ready</p>
            <p className="mt-0.5 font-body text-xs font-semibold">Family summary sent</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#FAF7F2] text-[#2F183F]" data-testid="landing-page">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10">
        <Link to="/" aria-label="VYVA home" className="inline-flex items-center">
          <VyvaWordmark className="h-auto w-[118px] sm:w-[142px]" />
        </Link>
        <nav className="hidden items-center gap-7 font-body text-sm font-bold text-[#6F5E58] md:flex" aria-label="Primary">
          <a className="transition hover:text-vyva-purple" href="#loop">How it works</a>
          <a className="transition hover:text-vyva-purple" href="#support">Support</a>
          <a className="transition hover:text-vyva-purple" href="#values">Values</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/login?mode=login"
            className="hidden min-h-11 items-center justify-center rounded-full px-4 font-body text-sm font-bold text-[#4B3C36] transition hover:bg-white sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-vyva-purple px-4 font-body text-sm font-bold text-white shadow-[0_14px_34px_rgba(107,33,168,0.28)] transition hover:bg-[#5F1E97] sm:px-5"
          >
            Get started
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 pb-14 pt-5 sm:px-8 md:min-h-[calc(100svh-92px)] lg:grid-cols-[minmax(0,0.94fr)_minmax(390px,0.76fr)] lg:px-10 lg:pb-20 lg:pt-8">
        <div className="max-w-3xl">
          <div className="mb-5 h-1.5 w-24 rounded-full bg-[#FFDF61]" />
          <h1 className="max-w-[760px] font-body text-[3.35rem] font-black leading-[0.94] text-[#8253AB] sm:text-[5rem] lg:text-[6rem]">
            Know they’re okay today.
          </h1>
          <p className="mt-6 max-w-2xl font-body text-lg leading-8 text-[#5F5768] sm:text-xl sm:leading-9">
            VYVA checks in by voice, confirms routines, and alerts trusted people when something needs attention.
          </p>
          <div className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full bg-[#FFDF61] px-4 py-2 font-body text-sm font-black text-[#3B2600] shadow-[0_12px_28px_rgba(255,223,97,0.22)]">
            <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Daily reassurance between visits
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/login"
              className="inline-flex min-h-[56px] items-center justify-center gap-3 rounded-full bg-vyva-purple px-7 font-body text-base font-bold text-white shadow-[0_18px_42px_rgba(107,33,168,0.28)] transition hover:bg-[#5F1E97]"
            >
              Create your VYVA account
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              to="/login?mode=login"
              className="inline-flex min-h-[56px] items-center justify-center rounded-full border border-[#E6DAD0] bg-white px-7 font-body text-base font-bold text-[#2F183F] shadow-[0_10px_24px_rgba(76,46,22,0.06)] transition hover:border-vyva-purple hover:text-vyva-purple"
            >
              I already have an account
            </Link>
          </div>
          <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {proofPoints.map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-2xl bg-white/78 px-4 py-3 font-body text-sm font-bold text-[#5E514B] shadow-[0_10px_30px_rgba(76,46,22,0.05)]">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#07865C]" aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <ProductPreview />
      </section>

      <section id="loop" className="bg-[#8253AB] py-14 text-white sm:py-16">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-[0.72fr_1fr] lg:items-end">
            <div>
              <div className="mb-5 h-1.5 w-20 rounded-full bg-[#FFDF61]" />
            <h2 className="font-body text-4xl font-black leading-tight sm:text-5xl">A care loop that never goes quiet.</h2>
            </div>
            <p className="max-w-2xl font-body text-lg leading-8 text-[#F1E9F8]">
              Every call turns ordinary moments into useful care context, so small changes are easier to notice.
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {careLoop.map((item, index) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="rounded-[24px] border border-white/14 bg-white/10 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#8253AB]">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <span className="font-body text-sm font-black text-[#FFDF61]">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 font-body text-xl font-black">{item.label}</h3>
                  <p className="mt-2 font-body text-sm leading-6 text-[#F1E9F8]">{item.detail}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="support" className="bg-white py-16 sm:py-20">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[0.72fr_1fr] lg:px-10">
          <div>
            <div className="mb-5 h-1.5 w-20 rounded-full bg-[#FFDF61]" />
            <h2 className="font-body text-4xl font-black leading-tight text-[#8253AB] sm:text-5xl">
              From wondering to knowing.
            </h2>
            <p className="mt-5 max-w-xl font-body text-lg leading-8 text-[#5F5768]">
              VYVA turns everyday check-ins into signals families and care teams can act on.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {supportMoments.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-[26px] border border-[#EDE2D8] bg-[#FFF9F1] p-5 shadow-[0_12px_32px_rgba(76,46,22,0.07)]">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.tone}`}>
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-body text-lg font-extrabold text-[#2F183F]">{item.title}</h3>
                  <p className="mt-2 font-body text-sm leading-6 text-[#6F6475]">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#FAF7F2] py-16 sm:py-20">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-[0.72fr_1fr] lg:items-end">
            <div>
              <div className="mb-5 h-1.5 w-20 rounded-full bg-[#FFDF61]" />
              <h2 className="font-body text-4xl font-black leading-tight text-[#8253AB] sm:text-5xl">
                More than a check-in.
              </h2>
            </div>
            <p className="max-w-2xl font-body text-lg leading-8 text-[#5F5768]">
              VYVA connects the daily pieces of care: health, medication, safety, engagement, family updates, and practical help.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fullFeatureSet.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-[24px] border border-[#E7DDD4] bg-white p-5 shadow-[0_12px_32px_rgba(76,46,22,0.06)]">
                  <div className="flex items-start gap-4">
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${item.tone}`}>
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-body text-lg font-black text-[#2F183F]">{item.title}</h3>
                      <p className="mt-1 font-body text-sm leading-6 text-[#6F6475]">{item.body}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="values" className="bg-[#2F183F] py-16 text-white sm:py-20">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.92fr_1fr] lg:px-10">
          <div>
            <div className="mb-5 h-1.5 w-20 rounded-full bg-[#FFDF61]" />
            <h2 className="font-body text-4xl font-black leading-tight sm:text-5xl">More presence. Less worry.</h2>
            <p className="mt-5 max-w-xl font-body text-lg leading-8 text-[#EBDFF3]">
              VYVA strengthens the human circle around care with daily touchpoints, clear signals, and respectful privacy.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {values.map((value) => (
              <div key={value} className="flex min-h-[92px] items-center gap-4 rounded-[24px] border border-white/14 bg-white/8 px-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F8D37A] text-[#3B2600]">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="font-body text-lg font-bold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="caregivers" className="bg-[#F8F4EF] py-16 sm:py-20">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-8 px-5 sm:px-8 lg:grid-cols-[1fr_0.82fr] lg:px-10">
          <div className="rounded-[30px] border border-[#E7DDD4] bg-white p-6 shadow-[0_16px_46px_rgba(76,46,22,0.08)] sm:p-8">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F3E8FF] text-[#8253AB]">
                <HeartHandshake className="h-7 w-7" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-body text-4xl font-black leading-tight text-[#8253AB]">The daily check-in families wish they could always make.</h2>
                <p className="mt-4 font-body text-lg leading-8 text-[#5F5768]">
                  Warm enough to feel personal. Structured enough to spot when support may be needed.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {outcomeCards.map((item) => {
              const Icon = item.icon;
              return (
              <article key={item.title} className="rounded-[24px] border border-[#E7DDD4] bg-white px-5 py-4 shadow-[0_10px_28px_rgba(76,46,22,0.06)]">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF2B8] text-[#8253AB]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-body text-lg font-bold text-[#2F183F]">{item.title}</h3>
                    <p className="mt-1 font-body text-base leading-7 text-[#7C6B63]">{item.body}</p>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-14 sm:px-8 sm:py-18">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
          <MessageCircleHeart className="h-10 w-10 text-vyva-purple" aria-hidden="true" />
          <h2 className="mt-4 max-w-3xl font-body text-4xl font-black leading-tight text-[#8253AB] sm:text-5xl">
            Start with one daily check-in.
          </h2>
          <Link
            to="/login"
            className="mt-8 inline-flex min-h-[56px] items-center justify-center gap-3 rounded-full bg-vyva-purple px-7 font-body text-base font-bold text-white shadow-[0_18px_42px_rgba(107,33,168,0.28)] transition hover:bg-[#5F1E97]"
          >
            Create your account
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
