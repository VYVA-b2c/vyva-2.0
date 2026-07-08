import { ArrowLeft, ChevronRight, MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { EmptyState } from "@/components/vyva-ui";
import type { AdvisorHubResponse, AdvisorSummary } from "../../shared/advisors";
import { AdvisorAvatar } from "./AdvisorIcons";
import SocialStyles from "./SocialStyles";

function AdvisorCard({ advisor, onSelect }: { advisor: AdvisorSummary; onSelect: () => void }) {
  const displayName = `${advisor.name} ${advisor.role}`;
  const ariaLabel = `${displayName}. ${advisor.intro}`;

  return (
    <button
      type="button"
      data-testid={`button-advisor-${advisor.slug}`}
      aria-label={ariaLabel}
      onClick={onSelect}
      className="vyva-tap group relative flex min-h-[178px] w-full flex-col items-start overflow-hidden rounded-[26px] border px-3.5 py-4 text-left shadow-[0_12px_28px_rgba(63,45,35,0.06)] transition-transform hover:-translate-y-0.5 active:scale-[0.985] min-[390px]:min-h-[190px] min-[390px]:px-4"
      style={{
        borderColor: `${advisor.iconColor}2E`,
        background: `linear-gradient(145deg, #FFFFFF 0%, #FFFFFF 52%, ${advisor.chipBg}94 100%)`,
      }}
    >
      <AdvisorAvatar
        iconKey={advisor.iconKey}
        chipBg={advisor.chipBg}
        iconColor={advisor.iconColor}
        className="h-[70px] w-[70px] rounded-[24px] min-[390px]:h-[76px] min-[390px]:w-[76px]"
        size={34}
      />
      <span className="mt-4 min-w-0">
        <span className="block font-body text-[22px] font-black leading-[1.02] text-vyva-text-1 min-[390px]:text-[24px]">
          {advisor.name}
        </span>
        <span className="block font-body text-[22px] font-black leading-[1.02] text-vyva-text-1 min-[390px]:text-[24px]">
          {advisor.role}
        </span>
        <span
          className="mt-3 inline-flex max-w-full rounded-full bg-white/88 px-3 py-1 font-body text-[12px] font-black leading-tight shadow-[inset_0_0_0_1px_rgba(232,226,240,0.9)]"
          style={{ color: advisor.iconColor }}
        >
          {advisor.shortRole}
        </span>
      </span>
      <span className="absolute right-3 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/92 text-vyva-text-3 shadow-sm transition-transform group-hover:translate-x-0.5 group-hover:text-vyva-text-1">
        <ChevronRight size={22} strokeWidth={2.6} aria-hidden="true" />
      </span>
    </button>
  );
}

export default function AdvisorHub() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { data, isLoading } = useQuery<AdvisorHubResponse>({
    queryKey: [`/api/advisors?lang=${encodeURIComponent(language)}`],
    staleTime: 30 * 1000,
  });
  const ui = data?.ui;
  const advisors = data?.advisors ?? [];

  return (
    <>
      <SocialStyles />
      <main className="vyva-page pb-[120px]" data-testid="advisor-hub-screen">
        <button
          type="button"
          onClick={() => navigate("/social-rooms")}
          className="vyva-tap mb-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 font-body text-[15px] font-black text-vyva-text-1 shadow-sm"
          data-testid="button-advisor-hub-back"
        >
          <ArrowLeft size={18} strokeWidth={2.5} aria-hidden="true" />
          {ui?.backToCommunity ?? "Back to Community"}
        </button>

        <section
          className="relative overflow-hidden rounded-[28px] border border-[#E8E2F0] bg-white p-4 shadow-[0_18px_42px_rgba(63,45,35,0.075)] min-[390px]:p-5"
          aria-label={ui?.eyebrow ?? "MY EXPERTS"}
        >
          <div className="relative flex items-center gap-3 min-[390px]:gap-4">
            <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[20px] bg-[#F3EEFA] text-[#6B21A8] shadow-[inset_0_0_0_1px_rgba(107,33,168,0.08)] min-[390px]:h-14 min-[390px]:w-14 min-[390px]:rounded-[22px]">
              <MessageCircle size={28} strokeWidth={2.45} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-body text-[13px] font-black uppercase tracking-[0.12em] text-[#6B21A8]">
                {ui?.eyebrow ?? "MY EXPERTS"}
              </p>
              <h1 className="mt-0.5 font-body text-[28px] font-black leading-tight text-vyva-text-1 min-[390px]:text-[31px]">
                {ui?.title ?? "Choose an expert"}
              </h1>
              <p className="mt-1 max-w-[30rem] font-body text-[15px] font-bold leading-snug text-vyva-text-2">
                {ui?.instruction ?? "Tap an expert to talk."}
              </p>
            </div>
          </div>

          <div className="relative mt-5 grid grid-cols-2 gap-3 min-[760px]:grid-cols-3" data-testid="advisor-list">
            {isLoading ? (
              <div className="rounded-[20px] border border-[#E8DDCF] bg-[#FFFCF8] px-4 py-5 font-body text-[16px] font-bold text-vyva-text-2">
                {ui?.loading ?? "Preparing your experts..."}
              </div>
            ) : !advisors.length ? (
              <EmptyState title={ui?.empty ?? "Your experts are not available right now."} />
            ) : (
              advisors.map((advisor) => (
                <AdvisorCard
                  key={advisor.slug}
                  advisor={advisor}
                  onSelect={() => navigate(`/social-rooms/experts/${advisor.slug}`)}
                />
              ))
            )}
          </div>
        </section>
      </main>
    </>
  );
}
