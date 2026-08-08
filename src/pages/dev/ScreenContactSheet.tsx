import {
  CardHubTemplate,
  GuidedFlowTemplate,
  OutputReviewTemplate,
  SetupDashboardTemplate,
  VoiceLandingTemplate,
  templateCards,
} from "@/components/templates/VyvaScreenTemplates";
import { SCREEN_CONTRACT_RULES, SCREEN_CONTRACTS, getModeContract, getScreenContract } from "@/design/screenContracts";

const previewCards = templateCards();

const previewSections = [
  {
    id: "voice-idle",
    eyebrow: "Voice idle",
    badge: "Orb first",
    node: <VoiceLandingTemplate title="Good evening, Karim" subtitle="Touch the orb to begin." state="idle" />,
    locked: "No cards, chips, or menus. The orb is the main entry point.",
  },
  {
    id: "listening",
    eyebrow: "Listening",
    badge: "Mic active",
    node: <VoiceLandingTemplate title="Good evening, Karim" subtitle="VYVA is listening." state="listening" />,
    locked: "Listening is shown through orb motion only.",
  },
  {
    id: "speaking",
    eyebrow: "Speaking",
    badge: "Audio reactive",
    node: <VoiceLandingTemplate title="Good evening, Karim" subtitle="VYVA answers clearly." state="speaking" />,
    locked: "Speech energy lives inside the orb, not as separate waveform UI.",
  },
  {
    id: "touch-mode",
    eyebrow: "Touch mode",
    badge: "Cards visible",
    node: <CardHubTemplate title="Good evening, Karim" subtitle="Do not forget your medicine." cards={previewCards} />,
    locked: "Cards appear only after touch mode is selected.",
  },
  {
    id: "settings-expanded",
    eyebrow: "Settings expanded",
    badge: "Temporary",
    node: <VoiceLandingTemplate title="Good evening, Karim" subtitle="Touch the orb to begin." state="idle" settingsExpanded />,
    locked: "Aa and theme appear only after gear opens, then collapse after a few seconds.",
  },
  {
    id: "guided-flow",
    eyebrow: "Guided flow",
    badge: "One step",
    node: <GuidedFlowTemplate />,
    locked: "One decision at a time. Move to the next step immediately after selection.",
  },
  {
    id: "output-review",
    eyebrow: "Output review",
    badge: "Ask first",
    node: <OutputReviewTemplate />,
    locked: "Show the answer and confirmation controls before any real-world action.",
  },
  {
    id: "setup-dashboard",
    eyebrow: "Setup dashboard",
    badge: "Visual stats",
    node: <SetupDashboardTemplate />,
    locked: "Use stats, readiness, and direct actions for configuration screens.",
  },
];

export default function ScreenContactSheet() {
  const homeContract = getScreenContract("home");
  const voiceContract = getModeContract(homeContract, "voice");

  return (
    <main
      className="min-h-screen bg-[linear-gradient(135deg,#F9F0FF_0%,#FFFDF8_44%,#EEF8F3_100%)] px-5 py-8 font-body text-[#24113D] sm:px-8 lg:px-10"
      data-testid="screen-contact-sheet"
    >
      <header className="mx-auto grid max-w-[1360px] gap-6 lg:grid-cols-[1fr_420px] lg:items-start">
        <div>
          <p className="font-body text-[13px] font-black uppercase tracking-[0.16em] text-vyva-purple">
            Locked screen contracts
          </p>
          <h1 className="mt-2 max-w-[760px] font-serif text-[48px] leading-[0.95] tracking-normal text-[#24113D] sm:text-[64px]">
            VYVA screen templates
          </h1>
        </div>
        <aside className="rounded-[22px] border border-[#E8DDF3] bg-white/80 p-5 shadow-[0_18px_38px_rgba(57,35,67,0.08)]">
          <p className="font-body text-[15px] font-black text-[#24113D]">
            Current push scope
          </p>
          <p className="mt-2 font-body text-[14px] font-bold leading-snug text-[#725E70]">
            Home stays voice-first. Cards appear only after touch mode. The same rules become reusable templates for other screens.
          </p>
        </aside>
      </header>

      <section className="mx-auto mt-8 grid max-w-[1360px] gap-6 md:grid-cols-2 xl:grid-cols-4">
        {previewSections.map((section) => (
          <article
            key={section.id}
            className="rounded-[28px] border border-[#E8DDF3] bg-white/78 p-4 shadow-[0_18px_38px_rgba(57,35,67,0.09)]"
            data-testid={`contact-sheet-${section.id}`}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-body text-[13px] font-black uppercase tracking-[0.12em] text-[#24113D]">
                {section.eyebrow}
              </h2>
              <span className="rounded-full bg-[#F5EFFF] px-3 py-1.5 font-body text-[10px] font-black uppercase tracking-[0.08em] text-vyva-purple">
                {section.badge}
              </span>
            </div>
            {section.node}
            <p className="mt-4 font-body text-[12px] font-black leading-snug text-[#24113D]">
              Locked: <span className="font-bold text-[#725E70]">{section.locked}</span>
            </p>
          </article>
        ))}
      </section>

      <section className="mx-auto mt-8 max-w-[1360px] rounded-[28px] border border-[#E8DDF3] bg-white/82 p-5 shadow-[0_18px_38px_rgba(57,35,67,0.08)]">
        <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
          <div>
            <p className="font-body text-[13px] font-black uppercase tracking-[0.16em] text-vyva-purple">
              Contract proof
            </p>
            <h2 className="mt-2 font-body text-[24px] font-black leading-tight text-[#24113D]">
              Home voice mode is locked.
            </h2>
            <p className="mt-2 font-body text-[13px] font-bold leading-snug text-[#725E70]">
              The contract says {voiceContract.primarySurface} is primary, cards are {voiceContract.cards}, and chips are {voiceContract.chips}.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {SCREEN_CONTRACT_RULES.map((rule, index) => (
              <div key={rule} className="rounded-[18px] border border-[#E8DDF3] bg-white px-4 py-3">
                <p className="font-body text-[11px] font-black uppercase tracking-[0.12em] text-vyva-purple">
                  Rule {index + 1}
                </p>
                <p className="mt-2 font-body text-[13px] font-black leading-snug text-[#24113D]">
                  {rule}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-[1360px] rounded-[28px] border border-[#E8DDF3] bg-white/82 p-5 shadow-[0_18px_38px_rgba(57,35,67,0.08)]">
        <p className="font-body text-[13px] font-black uppercase tracking-[0.16em] text-vyva-purple">
          Registered screens
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {SCREEN_CONTRACTS.map((contract) => (
            <div key={contract.id} className="rounded-[18px] border border-[#E8DDF3] bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-body text-[16px] font-black text-[#24113D]">{contract.title}</p>
                <span className="rounded-full bg-[#F5EFFF] px-2 py-1 font-body text-[10px] font-black uppercase tracking-[0.08em] text-vyva-purple">
                  {contract.template}
                </span>
              </div>
              <p className="mt-2 font-body text-[12px] font-bold leading-snug text-[#725E70]">
                {contract.purpose}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
