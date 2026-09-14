export const BRAIN_COACH_ACTIVITY_FLOW_ID = "brain_coach.activity_session";
export const BRAIN_COACH_MAIN_SCENE_ID = "brain_coach.activity_session.main";

export const BRAIN_COACH_MAIN_SHELL_CONTRACT = {
  shellId: "home.production",
  headerId: "home.voice-touch",
  containerId: "flow.rounded-card",
  bottomNavId: "home-sos-reports",
  composer: "hidden",
} as const;

export const BRAIN_COACH_ACTIVITY_SHELL_CONTRACT = {
  shellId: "home.production",
  headerId: "detail.activity",
  containerId: "flow.rounded-card",
  bottomNavId: "hidden",
  composer: "hidden",
} as const;

export const BRAIN_COACH_COMPLETION_SHELL_CONTRACT = {
  shellId: "home.production",
  headerId: "detail.activity",
  containerId: "flow.completion-dialog",
  bottomNavId: "hidden",
  composer: "hidden",
} as const;

export const BRAIN_COACH_SHELL_CONTRACT = BRAIN_COACH_ACTIVITY_SHELL_CONTRACT;

type BrainCoachShellContract =
  | typeof BRAIN_COACH_MAIN_SHELL_CONTRACT
  | typeof BRAIN_COACH_ACTIVITY_SHELL_CONTRACT
  | typeof BRAIN_COACH_COMPLETION_SHELL_CONTRACT;

type BrainCoachPresentationAttributesInput = {
  approvedFrame?: string;
  presentationId: string;
  sceneId: string;
  modality?: "touch" | "voice";
  state?: "default" | "loading" | "complete";
  sceneKind: string;
  sceneLayout: string;
  shellContract?: BrainCoachShellContract;
};

export function getBrainCoachPresentationAttributes({
  approvedFrame = "brain_coach.activity_session",
  presentationId,
  sceneId,
  modality = "touch",
  state = "default",
  sceneKind,
  sceneLayout,
  shellContract = BRAIN_COACH_ACTIVITY_SHELL_CONTRACT,
}: BrainCoachPresentationAttributesInput): Record<`data-${string}`, string> {
  return {
    "data-approved-frame": approvedFrame,
    "data-flow-id": BRAIN_COACH_ACTIVITY_FLOW_ID,
    "data-presentation-id": presentationId,
    "data-presentation-modality": modality,
    "data-presentation-state": state,
    "data-registry-scene": sceneId,
    "data-shell-contract": shellContract.shellId,
    "data-header-contract": shellContract.headerId,
    "data-container-contract": shellContract.containerId,
    "data-bottom-nav-contract": shellContract.bottomNavId,
    "data-composer-contract": shellContract.composer,
    "data-scene-kind": sceneKind,
    "data-scene-layout": sceneLayout,
  };
}
