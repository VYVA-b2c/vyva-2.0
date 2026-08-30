import { useNavigate } from "react-router-dom";
import { BrainCoachActivityCard } from "@/components/brain/BrainCoachFlowShell";
import { useLanguage } from "@/i18n";
import {
  getBrainCoachActivitiesForModule,
  getBrainCoachActivityDisplay,
  type BrainCoachModuleId,
} from "./brainCoachCatalog";

type BrainCoachActivityGridProps = {
  moduleId: BrainCoachModuleId;
};

export default function BrainCoachActivityGrid({ moduleId }: BrainCoachActivityGridProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const activities = getBrainCoachActivitiesForModule(moduleId);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-[700px]:grid-cols-3" data-scene-layout="activity_grid">
      {activities.map((activity) => {
        const copy = getBrainCoachActivityDisplay(activity, t);

        return (
          <BrainCoachActivityCard
            key={activity.id}
            type="button"
            onClick={() => navigate(activity.route)}
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
            aria-label={copy.ariaLabel}
            data-testid={activity.testId}
          />
        );
      })}
    </div>
  );
}

