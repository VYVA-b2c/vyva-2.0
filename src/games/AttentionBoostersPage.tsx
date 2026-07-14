import { Brain, ChevronRight, Footprints, Lightbulb, Route } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { ActionCard, PageHeader, ResponsiveGrid } from "@/components/vyva-ui";

const attentionGames = [
  {
    titleKey: "brainGames.attentionBoosters.dualTask.title",
    descriptionKey: "brainGames.attentionBoosters.dualTask.description",
    badgeKey: "brainGames.attentionBoosters.dualTask.badge",
    route: "/dual-task-walk",
    icon: Footprints,
    colors: { accent: "#6B21A8", bg: "#F5EEFF", border: "#D8C7F3" },
  },
  {
    titleKey: "brainGames.attentionBoosters.rhythmTap.title",
    descriptionKey: "brainGames.attentionBoosters.rhythmTap.description",
    badgeKey: "brainGames.attentionBoosters.rhythmTap.badge",
    route: "/attention-boosters/rhythm-tap",
    icon: Route,
    colors: { accent: "#149A63", bg: "#ECFDF5", border: "#BDEFD3" },
  },
  {
    titleKey: "games.curiousMinds.title",
    descriptionKey: "games.curiousMinds.cardDescription",
    badgeKey: "games.curiousMinds.cardBadge",
    route: "/memory-games/curious-minds",
    icon: Lightbulb,
    colors: { accent: "#6B21A8", bg: "#F3E8FF", border: "#D8C7F3" },
  },
] as const;

export default function AttentionBoostersPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const title = t("brainGames.attentionBoosters.title");

  return (
    <div className="vyva-page">
      <PageHeader
        className="pt-2"
        title={title}
        subtitle={t("brainGames.attentionBoosters.subtitle")}
        icon={Brain}
        iconColor="#7C3AED"
        backLabel={t("common.back")}
        backTo="/mind-memory"
      />

      <ResponsiveGrid className="mt-5" columns="two">
        {attentionGames.map((game) => {
          return (
            <ActionCard
              key={game.route}
              onClick={() => navigate(game.route)}
              title={t(game.titleKey)}
              description={t(game.descriptionKey)}
              icon={game.icon}
              iconBg={game.colors.bg}
              iconColor={game.colors.accent}
              surface="white"
              style={{ borderColor: game.colors.border }}
              badge={(
                <span
                  className="rounded-full px-3 py-1 font-body text-[12px] font-bold"
                  style={{ background: game.colors.bg, color: game.colors.accent }}
                >
                  {t(game.badgeKey)}
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
          );
        })}
      </ResponsiveGrid>
    </div>
  );
}
