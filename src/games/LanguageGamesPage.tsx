import { ArrowLeft, BookOpen, ChevronRight, Type } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";

const languageGames = [
  {
    key: "storyRecall",
    route: "/memory-games/story_recall",
    colors: { accent: "#92400E", bg: "#FEF3C7", border: "#F2DCA5" },
  },
] as const;

export default function LanguageGamesPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const title = t("brainGames.language.title");

  return (
    <div className="vyva-page">
      <button
        type="button"
        onClick={() => navigate("/activities")}
        className="mt-2 inline-flex min-h-[64px] items-center gap-3 rounded-full bg-white px-5 text-[22px] font-bold text-vyva-text-1 shadow-vyva-card"
      >
        <ArrowLeft size={24} />
        {t("common.back")}
      </button>

      <section className="mt-5 rounded-[8px] border border-[#EDE2D1] bg-[#FFF9F1] p-6 shadow-vyva-card">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <h1 className="font-display text-[42px] font-bold leading-[1.05] text-vyva-text-1">
              {title}
            </h1>
            <p className="mt-4 text-[24px] leading-[1.35] text-vyva-text-2">{t("brainGames.language.subtitle")}</p>
          </div>
          <div className="flex h-[88px] w-[88px] flex-shrink-0 items-center justify-center rounded-[8px] bg-white shadow-vyva-card">
            <Type size={44} className="text-vyva-rose" />
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {languageGames.map((game) => (
          <button
            key={game.route}
            type="button"
            onClick={() => navigate(game.route)}
            className="min-h-[220px] rounded-[8px] border-2 bg-white p-5 text-left shadow-vyva-card transition-transform active:scale-[0.99]"
            style={{ borderColor: game.colors.border }}
            aria-label={t("brainGames.language.storyRecall.ariaLabel")}
          >
            <div className="flex h-full flex-col justify-between gap-5">
              <div className="flex items-start justify-between gap-4">
                <div
                  className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-[8px]"
                  style={{ background: game.colors.bg, color: game.colors.accent }}
                >
                  <BookOpen size={36} />
                </div>
                <span
                  className="rounded-full px-4 py-2 text-[18px] font-bold"
                  style={{ background: game.colors.bg, color: game.colors.accent }}
                >
                  {t("brainGames.language.storyRecall.badge")}
                </span>
              </div>

              <div>
                <h2 className="text-[30px] font-extrabold leading-[1.1] text-vyva-text-1">{t("memoryGames.storyRecall.title")}</h2>
                <p className="mt-3 text-[22px] leading-[1.35] text-vyva-text-2">{t("memoryGames.storyRecall.description")}</p>
              </div>

              <div className="flex items-center justify-end">
                <div
                  className="flex h-[64px] w-[64px] items-center justify-center rounded-full text-white"
                  style={{ background: game.colors.accent }}
                >
                  <ChevronRight size={34} />
                </div>
              </div>
            </div>
          </button>
        ))}
      </section>
    </div>
  );
}
