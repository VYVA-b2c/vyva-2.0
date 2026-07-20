import { MapPin, UserRoundPlus, UsersRound } from "lucide-react";

type ProviderSetupFallbackPanelProps = {
  title: string;
  description: string;
  addLabel?: string;
  findLabel?: string;
  helperLabel?: string;
  confirmation?: string;
  onAddProvider: () => void;
  onFindOptions: () => void;
  onAskHelper: () => void;
  testId?: string;
};

export default function ProviderSetupFallbackPanel({
  title,
  description,
  addLabel = "Add my usual provider",
  findLabel = "Help me find nearby options",
  helperLabel = "Ask family/caregiver to help",
  confirmation = "VYVA still asks before calling, booking, or sharing details.",
  onAddProvider,
  onFindOptions,
  onAskHelper,
  testId = "panel-provider-setup-fallback",
}: ProviderSetupFallbackPanelProps) {
  const actions = [
    { id: "add", label: addLabel, Icon: UserRoundPlus, onClick: onAddProvider },
    { id: "find", label: findLabel, Icon: MapPin, onClick: onFindOptions },
    { id: "helper", label: helperLabel, Icon: UsersRound, onClick: onAskHelper },
  ];

  return (
    <section
      className="rounded-[20px] border border-[#DDD6FE] bg-[#FBF8FF] p-3 shadow-[0_12px_28px_rgba(109,40,217,0.08)] sm:p-4"
      data-testid={testId}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[16px] bg-white text-vyva-purple shadow-sm">
          <UserRoundPlus size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="font-body text-[17px] font-black leading-tight text-vyva-text-1">{title}</h3>
          <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2">{description}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-3">
        {actions.map(({ id, label, Icon, onClick }) => (
          <button
            key={id}
            type="button"
            onClick={onClick}
            className="vyva-tap inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-[#DDD6FE] bg-white px-3 font-body text-[13px] font-black text-vyva-purple transition active:scale-[0.98]"
            data-testid={`${testId}-${id}`}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 font-body text-[12px] font-bold leading-snug text-[#6F5F59]">{confirmation}</p>
    </section>
  );
}
