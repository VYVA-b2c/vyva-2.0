import { BookOpen, ChevronRight, Type } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { ActionCard, PageHeader, ResponsiveGrid } from "@/components/vyva-ui";

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
      <PageHeader
        className="pt-2"
        title={title}
        subtitle={t("brainGames.language.subtitle")}
        icon={Type}
        iconColor="#B0355A"
        backLabel={t("common.back")}
        backTo="/activities"
      />

      <ResponsiveGrid className="mt-5" columns="two">
        {languageGames.map((game) => (
          <ActionCard
            key={game.route}
            onClick={() => navigate(game.route)}
            title={t("memoryGames.storyRecall.title")}
            description={t("memoryGames.storyRecall.description")}
            icon={BookOpen}
            iconBg={game.colors.bg}
            iconColor={game.colors.accent}
            surface="white"
            style={{ borderColor: game.colors.border }}
            aria-label={t("brainGames.language.storyRecall.ariaLabel")}
            badge={(
              <span
                className="rounded-full px-3 py-1 font-body text-[12px] font-bold"
                style={{ background: game.colors.bg, color: game.colors.accent }}
              >
                {t("brainGames.language.storyRecall.badge")}
              </span>
            )}
            trailing={(
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-white"
                style={{ background: game.colors.accent }}
              >
                <ChevronRight size={20} aria-hidden="true" />
              </span>
            )}
          >
          </ActionCard>
        ))}
      </ResponsiveGrid>
    </div>
  );
}
