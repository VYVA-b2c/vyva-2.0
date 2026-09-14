import { MapPin, UserRoundPlus, UsersRound } from "lucide-react";
import {
  type WorkflowReference,
  workflowSetupFallbackChoices,
} from "../../shared/workflowRegistry";

type ProviderSetupFallbackPanelProps = {
  title: string;
  description: string;
  workflowReference?: WorkflowReference;
  returnTo?: string;
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
  workflowReference,
  returnTo,
  addLabel,
  findLabel,
  helperLabel,
  confirmation = "VYVA still asks before calling, booking, or sharing details.",
  onAddProvider,
  onFindOptions,
  onAskHelper,
  testId = "panel-provider-setup-fallback",
}: ProviderSetupFallbackPanelProps) {
  const workflowChoices = workflowReference ? workflowSetupFallbackChoices(workflowReference, { returnTo }) : [];
  const addChoice = workflowChoices.find((choice) => choice.kind === "add_provider" || choice.kind === "add_trusted_contact");
  const findChoice = workflowChoices.find((choice) => choice.kind === "find_options");
  const helperChoice = workflowChoices.find((choice) => choice.kind === "ask_family");
  const actions = [
    { id: "add", label: addLabel ?? addChoice?.label ?? "Add my usual provider", detail: addChoice?.description, Icon: UserRoundPlus, onClick: onAddProvider, visible: !workflowReference || Boolean(addChoice) },
    { id: "find", label: findLabel ?? findChoice?.label ?? "Help me find nearby options", detail: findChoice?.description, Icon: MapPin, onClick: onFindOptions, visible: !workflowReference || Boolean(findChoice) },
    { id: "helper", label: helperLabel ?? helperChoice?.label ?? "Ask family/caregiver to help", detail: helperChoice?.description, Icon: UsersRound, onClick: onAskHelper, visible: !workflowReference || Boolean(helperChoice) },
  ].filter((action) => action.visible && action.label);

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
        {actions.map(({ id, label, detail, Icon, onClick }) => (
          <button
            key={id}
            type="button"
            onClick={onClick}
            title={detail}
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
