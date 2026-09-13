import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import {
  CanonicalDetailFlowShell,
  CanonicalVoiceButton,
  type CanonicalDetailFlowShellContract,
} from "@/components/CanonicalDetailFlowShell";
import { EmptyState } from "@/components/vyva-ui";
import type { AdvisorHubResponse, AdvisorSlug, AdvisorSummary } from "../../shared/advisors";
import { AdvisorAvatar } from "./AdvisorIcons";
import {
  ADVISOR_PRESENTATION_ORDER,
  getAdvisorHubTitle,
  getAdvisorPresentation,
} from "./advisorPresentation";
import SocialStyles from "./SocialStyles";
import "./AdvisorHub.css";

const MOBILE_PAGE_SIZE = 4;
const PAGE_STORAGE_KEY = "vyva:community-expert-page";

const previewThemes: Record<AdvisorSlug, Pick<AdvisorSummary, "iconKey" | "chipBg" | "iconColor">> = {
  amara: { iconKey: "coach", chipBg: "#F1EAFB", iconColor: "#7024C4" },
  nora: { iconKey: "nutrition", chipBg: "#FFF4CF", iconColor: "#A16207" },
  tomas: { iconKey: "garden", chipBg: "#ECFDF5", iconColor: "#0F766E" },
  elena: { iconKey: "deals", chipBg: "#FFF4CF", iconColor: "#A16207" },
  diego: { iconKey: "tech", chipBg: "#F5F3FF", iconColor: "#7024C4" },
  ines: { iconKey: "benefits", chipBg: "#EAF3EE", iconColor: "#0A6B4A" },
  sabio: { iconKey: "research", chipBg: "#F6E7DE", iconColor: "#9A4F2B" },
  marta: { iconKey: "paperwork", chipBg: "#FDF0E7", iconColor: "#A4532A" },
};

const PREVIEW_ADVISORS: AdvisorSummary[] = ADVISOR_PRESENTATION_ORDER.map((slug, index) => ({
  slug,
  name: slug,
  role: "",
  shortRole: "",
  intro: "",
  starter: "",
  sortOrder: index,
  recencyLabel: "",
  sessionCount: 0,
  lastMessageAt: null,
  ...previewThemes[slug],
}));

function getInitialPage() {
  if (typeof window === "undefined") return 0;
  return window.sessionStorage.getItem(PAGE_STORAGE_KEY) === "1" ? 1 : 0;
}

function AdvisorCard({
  advisor,
  mobilePage,
  onSelect,
}: {
  advisor: AdvisorSummary;
  mobilePage: number;
  onSelect: () => void;
}) {
  const { language } = useLanguage();
  const presentation = getAdvisorPresentation(advisor.slug, language);
  const cardPage = Math.floor(presentation.order / MOBILE_PAGE_SIZE);
  const hiddenOnMobile = cardPage !== mobilePage;

  return (
    <button
      type="button"
      data-testid={`button-advisor-${advisor.slug}`}
      aria-label={`${presentation.title}. ${presentation.detail}`}
      onClick={onSelect}
      className={`advisor-team-card vyva-tap group min-h-[96px] w-full items-center gap-3 rounded-[24px] border border-[#E8E2F0] bg-white px-3 py-2.5 text-left shadow-[0_14px_34px_rgba(63,45,35,0.07)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(63,45,35,0.11)] active:scale-[0.985] ${hiddenOnMobile ? "advisor-team-card--other-page" : "flex"}`}
    >
      <AdvisorAvatar
        iconKey={advisor.iconKey}
        chipBg={advisor.chipBg}
        iconColor={advisor.iconColor}
        portraitSrc={presentation.portraitSrc}
        className="advisor-team-portrait h-16 w-16 rounded-full ring-1 ring-[#E8DFF0]"
        size={34}
      />
      <span className="min-w-0 flex-1">
        <span className="advisor-team-title block font-display text-[20px] font-semibold leading-[1.08] tracking-[-0.025em] text-vyva-text-1">
          {presentation.title}
        </span>
        <span className="advisor-team-detail mt-1.5 block font-body text-[13px] font-bold leading-snug text-vyva-text-2">
          {presentation.detail}
        </span>
      </span>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#6B21A8] text-white shadow-[0_8px_18px_rgba(107,33,168,0.2)] transition-transform group-hover:translate-x-0.5">
        <ChevronRight size={21} strokeWidth={2.7} aria-hidden="true" />
      </span>
    </button>
  );
}

export default function AdvisorHub({ preview = false }: { preview?: boolean }) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [mobilePage, setMobilePage] = useState(getInitialPage);
  const query = useQuery<AdvisorHubResponse>({
    queryKey: [`/api/advisors?lang=${encodeURIComponent(language)}`],
    staleTime: 30 * 1000,
    enabled: !preview,
  });
  const orderedAdvisors = useMemo(() => {
    const advisors = preview ? PREVIEW_ADVISORS : (query.data?.advisors ?? []);
    const bySlug = new Map(advisors.map((advisor) => [advisor.slug, advisor]));
    return ADVISOR_PRESENTATION_ORDER.flatMap((slug) => {
      const advisor = bySlug.get(slug);
      return advisor ? [advisor] : [];
    });
  }, [preview, query.data?.advisors]);
  const pageCount = Math.max(1, Math.ceil(orderedAdvisors.length / MOBILE_PAGE_SIZE));
  const activePage = Math.min(mobilePage, pageCount - 1);
  const shellContract: CanonicalDetailFlowShellContract = {
    shellId: "home.production",
    headerId: "detail.voice-touch",
    headerTitle: getAdvisorHubTitle(language),
    containerId: "flow.rounded-card",
    bottomNavId: "home-sos-reports",
    composer: "hidden",
  };

  useEffect(() => {
    window.sessionStorage.setItem(PAGE_STORAGE_KEY, String(activePage));
  }, [activePage]);

  const changePage = (nextPage: number) => {
    const safePage = Math.max(0, Math.min(pageCount - 1, nextPage));
    setMobilePage(safePage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <SocialStyles />
      <CanonicalDetailFlowShell
        shellContract={shellContract}
        appearance="light"
        onBack={() => navigate("/social-rooms")}
        shellTestId="advisor-hub-screen"
        contentTestId="advisor-hub-content"
        backTestId="button-advisor-hub-back"
        headerAction={(
          <CanonicalVoiceButton
            agentSlug="community"
            contextHint="Help the user choose the right VYVA expert for what they need today."
            label="Talk to VYVA about your team"
            testId="button-advisor-hub-voice"
          />
        )}
      >
        <section className="advisor-team-container" aria-label={shellContract.headerTitle}>
          <div className="advisor-team-grid" data-testid="advisor-list">
            {!preview && query.isLoading ? (
              <div className="rounded-[24px] border border-[#E8E2F0] bg-white px-5 py-6 font-body text-[16px] font-bold text-vyva-text-2">
                {query.data?.ui.loading ?? "Preparing your experts..."}
              </div>
            ) : !orderedAdvisors.length ? (
              <EmptyState title={query.data?.ui.empty ?? "Your experts are not available right now."} />
            ) : (
              orderedAdvisors.map((advisor) => (
                <AdvisorCard
                  key={advisor.slug}
                  advisor={advisor}
                  mobilePage={activePage}
                  onSelect={() => navigate(`/social-rooms/experts/${advisor.slug}`)}
                />
              ))
            )}
          </div>

          {pageCount > 1 ? (
            <nav className="advisor-team-pagination mt-5 items-center justify-between gap-3" aria-label="Expert pages">
              <button
                type="button"
                data-testid="button-advisor-page-previous"
                disabled={activePage === 0}
                onClick={() => changePage(activePage - 1)}
                className="vyva-tap inline-flex min-h-11 items-center gap-1 rounded-full border border-[#E3D8EC] bg-white px-4 font-body text-[14px] font-black text-vyva-text-1 shadow-sm disabled:opacity-40"
              >
                <ChevronLeft size={18} strokeWidth={2.6} aria-hidden="true" />
                Previous
              </button>
              <span className="font-body text-[14px] font-black text-vyva-text-2" aria-live="polite">
                {activePage + 1} of {pageCount}
              </span>
              <button
                type="button"
                data-testid="button-advisor-page-next"
                disabled={activePage >= pageCount - 1}
                onClick={() => changePage(activePage + 1)}
                className="vyva-tap inline-flex min-h-11 items-center gap-1 rounded-full bg-[#6B21A8] px-4 font-body text-[14px] font-black text-white shadow-[0_10px_22px_rgba(107,33,168,0.2)] disabled:opacity-40"
              >
                Next
                <ChevronRight size={18} strokeWidth={2.6} aria-hidden="true" />
              </button>
            </nav>
          ) : null}
        </section>
      </CanonicalDetailFlowShell>
    </>
  );
}
