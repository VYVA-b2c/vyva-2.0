import { Link } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  CalendarCheck2,
  CheckCircle2,
  HeartPulse,
  LockKeyhole,
  MessageCircleHeart,
  Pill,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { VyvaWordmark } from "@/components/VyvaWordmark";

const heroRows = [
  {
    icon: HeartPulse,
    title: "Daily check-in",
    body: "A gentle prompt to notice how today feels.",
    tone: "bg-[#FCE7F3] text-[#BE185D]",
  },
  {
    icon: Pill,
    title: "Medication routine",
    body: "Reminders stay simple, visible, and calm.",
    tone: "bg-[#EEF2FF] text-[#6D28D9]",
  },
  {
    icon: UsersRound,
    title: "Family support",
    body: "Share only what you choose, with consent.",
    tone: "bg-[#ECFDF5] text-[#047857]",
  },
];

const proposition = [
  {
    icon: LockKeyhole,
    title: "One private profile",
    body: "Health, medication, contacts, routines, and preferences live in one secure place.",
  },
  {
    icon: BellRing,
    title: "Support that shows up",
    body: "VYVA helps with check-ins, reminders, and quiet nudges before daily care gets missed.",
  },
  {
    icon: UsersRound,
    title: "Family-ready by consent",
    body: "Caregivers can help without taking over. The person receiving support stays in control.",
  },
];

const values = [
  "Private by default",
  "Consent-led sharing",
  "Calm daily guidance",
  "Practical help before complexity",
];

function ProductPreview() {
  return (
    <section
      aria-label="VYVA product preview"
      className="relative mx-auto w-full max-w-[430px] rounded-[34px] border border-[#E8DDD2] bg-[#FFFDF9] p-4 shadow-[0_28px_70px_rgba(76,46,22,0.16)] sm:p-5 lg:max-w-[460px]"
    >
      <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-[#E1D4C8]" />
      <div className="rounded-[26px] border border-[#EFE5DC] bg-[#FFFBF6] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-body text-xs font-bold uppercase text-vyva-purple">Today with VYVA</p>
            <h2 className="mt-2 font-display text-3xl leading-tight text-[#2F183F]">Your daily support is ready.</h2>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-vyva-purple text-white shadow-[0_12px_28px_rgba(107,33,168,0.25)]">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {heroRows.map((row) => {
            const Icon = row.icon;
            return (
              <article key={row.title} className="flex min-h-[82px] items-center gap-3 rounded-2xl border border-[#EFE5DC] bg-white px-4 py-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${row.tone}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-body text-base font-bold text-[#2F183F]">{row.title}</h3>
                  <p className="mt-0.5 font-body text-sm leading-snug text-[#7C6B63]">{row.body}</p>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl border border-[#D8F3E6] bg-[#F0FDF7] px-4 py-3">
          <div className="flex items-center gap-2 font-body text-sm font-bold text-[#047857]">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            You choose who sees what
          </div>
          <p className="mt-1 font-body text-sm leading-relaxed text-[#5E7169]">
            Family, health details, and care preferences stay permission-based.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F8F4EF] text-[#2F183F]" data-testid="landing-page">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10">
        <Link to="/" aria-label="VYVA home" className="inline-flex items-center">
          <VyvaWordmark className="h-auto w-[118px] sm:w-[142px]" />
        </Link>
        <nav className="hidden items-center gap-7 font-body text-sm font-bold text-[#6F5E58] md:flex" aria-label="Primary">
          <a className="transition hover:text-vyva-purple" href="#support">Support</a>
          <a className="transition hover:text-vyva-purple" href="#values">Values</a>
          <a className="transition hover:text-vyva-purple" href="#caregivers">Caregivers</a>
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

      <section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 pb-14 pt-5 sm:px-8 md:min-h-[calc(100svh-92px)] lg:grid-cols-[minmax(0,0.98fr)_minmax(360px,0.72fr)] lg:px-10 lg:pb-20 lg:pt-8">
        <div className="max-w-3xl">
          <h1 className="max-w-[760px] font-display text-[3.2rem] leading-[0.98] text-[#2F183F] sm:text-[4.8rem] lg:text-[5.9rem]">
            Private daily support for later life.
          </h1>
          <p className="mt-6 max-w-2xl font-body text-lg leading-8 text-[#7C6B63] sm:text-xl sm:leading-9">
            VYVA gives people and their families one secure place for health routines, medication, daily check-ins,
            emergency context, and practical support.
          </p>
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
          <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
            {["Health profile", "Medication support", "Family access"].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-2xl bg-white/78 px-4 py-3 font-body text-sm font-bold text-[#5E514B] shadow-[0_10px_30px_rgba(76,46,22,0.05)]">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#07865C]" aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
        </div>
        <ProductPreview />
      </section>

      <section id="support" className="bg-white py-16 sm:py-20">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[0.78fr_1fr] lg:px-10">
          <div>
            <h2 className="font-display text-4xl leading-tight text-[#2F183F] sm:text-5xl">
              Built for the ordinary moments that keep care steady.
            </h2>
            <p className="mt-5 max-w-xl font-body text-lg leading-8 text-[#7C6B63]">
              VYVA is not another place to store clutter. It turns the important pieces of daily support into a calm
              routine people can actually keep using.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {proposition.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-[26px] border border-[#EDE2D8] bg-[#FFF9F1] p-5 shadow-[0_12px_32px_rgba(76,46,22,0.07)]">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-vyva-purple shadow-[0_8px_18px_rgba(76,46,22,0.08)]">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-body text-lg font-bold text-[#2F183F]">{item.title}</h3>
                  <p className="mt-2 font-body text-sm leading-6 text-[#7C6B63]">{item.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="values" className="bg-[#2F183F] py-16 text-white sm:py-20">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.92fr_1fr] lg:px-10">
          <div>
            <h2 className="font-display text-4xl leading-tight sm:text-5xl">A companion with boundaries.</h2>
            <p className="mt-5 max-w-xl font-body text-lg leading-8 text-[#EBDFF3]">
              VYVA should feel useful, not intrusive. The product is shaped around privacy, consent, clarity, and care
              that respects the person first.
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
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#ECFDF5] text-[#047857]">
                <CalendarCheck2 className="h-7 w-7" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-4xl leading-tight text-[#2F183F]">For people and the people helping them.</h2>
                <p className="mt-4 font-body text-lg leading-8 text-[#7C6B63]">
                  Start for yourself, or support someone else with clear permission. VYVA keeps the care profile separate
                  from the caregiver account, so help can be useful without becoming confusing.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {[
              ["For me", "Build my care profile and daily support routine."],
              ["For a loved one", "Help set up care while keeping consent visible."],
              ["For everyday follow-through", "Make reminders, check-ins, and context easier to maintain."],
            ].map(([title, body]) => (
              <article key={title} className="rounded-[24px] border border-[#E7DDD4] bg-white px-5 py-4 shadow-[0_10px_28px_rgba(76,46,22,0.06)]">
                <h3 className="font-body text-lg font-bold text-[#2F183F]">{title}</h3>
                <p className="mt-1 font-body text-base leading-7 text-[#7C6B63]">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-14 sm:px-8 sm:py-18">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
          <MessageCircleHeart className="h-10 w-10 text-vyva-purple" aria-hidden="true" />
          <h2 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-[#2F183F] sm:text-5xl">
            Start with one secure profile. Let support grow from there.
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
