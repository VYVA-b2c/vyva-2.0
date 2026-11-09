import { useBrainCoachNavigate as useNavigate } from "@/hooks/useBrainCoachNavigate";
import { CanonicalBrainCoachActivityCard } from "@/components/brain/CanonicalBrainCoachActivityCard";
import { useLanguage } from "@/i18n";
import {
  getBrainCoachActivitiesForModule,
  getBrainCoachActivityDisplay,
  getBrainCoachActivityPath,
  type BrainCoachModuleId,
} from "./brainCoachCatalog";

type BrainCoachActivityGridProps = {
  moduleId: BrainCoachModuleId;
  featuredFirst?: boolean;
};

export default function BrainCoachActivityGrid({ moduleId, featuredFirst = false }: BrainCoachActivityGridProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const activities = getBrainCoachActivitiesForModule(moduleId);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5" data-scene-layout="activity_grid">
      {activities.map((activity, index) => {
        const copy = getBrainCoachActivityDisplay(activity, t);
        const isFeatured = featuredFirst && index === 0;

        return (
          <CanonicalBrainCoachActivityCard
            key={activity.id}
            type="button"
            onClick={() => navigate(getBrainCoachActivityPath(activity.id))}
            title={copy.title}
            description={copy.description}
            icon={activity.icon}
            iconAccent={activity.iconAccent}
            iconBg={activity.iconBg}
            iconColor={activity.iconColor}
            borderColor={activity.borderColor}
            badge={copy.badge}
            meta={copy.meta}
            actionLabel={copy.actionLabel}
            variant={isFeatured ? "featured" : "default"}
            className={isFeatured ? "lg:col-span-2" : undefined}
            aria-label={copy.ariaLabel}
            data-testid={activity.testId}
          />
        );
      })}
    </div>
  );
}

