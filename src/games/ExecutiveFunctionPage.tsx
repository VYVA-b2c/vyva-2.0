import { ChevronRight, GitBranch, Layers, Route as RouteIcon, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { ActionCard, PageHeader, ResponsiveGrid } from "@/components/vyva-ui";

const executiveGames = [
  {
    key: "numberTrails",
    route: "/executive-function/number-trails",
    Icon: RouteIcon,
    titleKey: "brainGames.executiveFunction.numberTrails.title",
    descriptionKey: "brainGames.executiveFunction.numberTrails.description",
    badgeKey: "brainGames.executiveFunction.numberTrails.badge",
    colors: { accent: "#B45309", bg: "#FEF3C7", border: "#F8D37A" },
  },
  {
    key: "categorySort",
    route: "/executive-function/category-sort",
    Icon: GitBranch,
    titleKey: "brainGames.executiveFunction.categorySort.title",
    descriptionKey: "brainGames.executiveFunction.categorySort.description",
    badgeKey: "brainGames.executiveFunction.categorySort.badge",
    colors: { accent: "#6B21A8", bg: "#F5EEFF", border: "#D8C7F3" },
  },
  {
    key: "faceName",
    route: "/face-name-match",
    Icon: Users,
    titleKey: "brainGames.faceName.title",
    descriptionKey: "brainGames.faceName.subtitle",
    badgeKey: "brainGames.faceName.badge",
    colors: { accent: "#6B21A8", bg: "#E8D5F5", border: "#D8C7F3" },
  },
] as const;

export default function ExecutiveFunctionPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const title = t("brainGames.executiveFunction.title");

  return (
    <div className="vyva-page">
      <PageHeader
        className="pt-2"
        title={title}
        subtitle={t("brainGames.executiveFunction.subtitle")}
        icon={Layers}
        iconColor="#7C3AED"
        backLabel={t("common.back")}
        backTo="/activities"
      />

      <ResponsiveGrid className="mt-5" columns="two">
        {executiveGames.map((game) => {
          const Icon = game.Icon;

          return (
            <ActionCard
              key={game.route}
              onClick={() => navigate(game.route)}
              title={t(game.titleKey)}
              description={t(game.descriptionKey)}
              icon={Icon}
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
