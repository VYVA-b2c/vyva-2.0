import type { VoiceCanvasViewModel } from "@/components/voice-canvas";

export type ConciergeRideCanvasStep =
  | "destination"
  | "pickup"
  | "pickup_custom"
  | "time"
  | "time_custom"
  | "mobility"
  | "provider"
  | "review"
  | "options"
  | "option_review"
  | "pending_detail"
  | "pending_confirm"
  | "waiting"
  | "completed"
  | "error";

export type ConciergeRideCanvasOption = {
  id: string;
  label: string;
  description?: string;
  providerName?: string;
};

export type ConciergeRideCanvasCopy = {
  destinationTitle: string;
  destinationHelper: string;
  destinationLabel: string;
  destinationPlaceholder: string;
  continue: string;
  pickupTitle: string;
  pickupHelper: string;
  savedHome: string;
  savedHomeDescription: string;
  anotherPickup: string;
  anotherPickupDescription: string;
  pickupLabel: string;
  pickupPlaceholder: string;
  timeTitle: string;
  timeHelper: string;
  now: string;
  today: string;
  tomorrowMorning: string;
  appointmentTime: string;
  anotherTime: string;
  timeLabel: string;
  timePlaceholder: string;
  mobilityTitle: string;
  mobilityHelper: string;
  noMobilityNeeds: string;
  wheelchair: string;
  doorHelp: string;
  walkerOrCane: string;
  caregiverComing: string;
  providerTitle: string;
  providerHelper: string;
  addProvider: string;
  reviewTitle: string;
  reviewHelper: string;
  pickup: string;
  destination: string;
  when: string;
  mobility: string;
  provider: string;
  none: string;
  compareRides: string;
  change: string;
  optionsTitle: string;
  optionsHelper: string;
  optionReviewTitle: string;
  optionReviewHelper: string;
  prepareRide: string;
  back: string;
  detailTitle: string;
  detailHelper: string;
  confirmTitle: string;
  confirmHelper: string;
  confirmContact: string;
  waitingTitle: string;
  waitingHelper: string;
  completedTitle: string;
  completedHelper: string;
  errorTitle: string;
  tryAgain: string;
};

export type BuildConciergeRideCanvasInput = {
  step: ConciergeRideCanvasStep;
  copy: ConciergeRideCanvasCopy;
  destination: string;
  pickup: string;
  requestedTime: string;
  mobilityNeeds: string[];
  savedPickupLabel: string;
  savedProviderName?: string;
  options?: ConciergeRideCanvasOption[];
  selectedOption?: ConciergeRideCanvasOption | null;
  pendingProviderName?: string;
  pendingDetail?: { label: string; prompt: string; placeholder: string; value?: string } | null;
  error?: string | null;
};

function progress(current: number) {
  return { current, total: 5, label: `${current} / 5` };
}

export function buildConciergeRideCanvasViewModel(input: BuildConciergeRideCanvasInput): VoiceCanvasViewModel {
  const { step, copy } = input;
  if (step === "destination") {
    return {
      sceneId: "ride-destination",
      kind: "text-entry",
      title: copy.destinationTitle,
      helperText: copy.destinationHelper,
      progress: progress(1),
      textEntry: { label: copy.destinationLabel, value: input.destination, placeholder: copy.destinationPlaceholder },
      primaryAction: { label: copy.continue },
    };
  }
  if (step === "pickup") {
    return {
      sceneId: "ride-pickup",
      kind: "place",
      title: copy.pickupTitle,
      helperText: copy.pickupHelper,
      progress: progress(2),
      choices: [
        { id: "saved_home", label: input.savedPickupLabel || copy.savedHome, description: copy.savedHomeDescription },
        { id: "another_pickup", label: copy.anotherPickup, description: copy.anotherPickupDescription },
      ],
    };
  }
  if (step === "pickup_custom") {
    return {
      sceneId: "ride-pickup-custom",
      kind: "text-entry",
      title: copy.pickupTitle,
      progress: progress(2),
      textEntry: { label: copy.pickupLabel, value: input.pickup, placeholder: copy.pickupPlaceholder },
      primaryAction: { label: copy.continue },
      secondaryAction: { label: copy.back },
    };
  }
  if (step === "time") {
    return {
      sceneId: "ride-time",
      kind: "date-time",
      title: copy.timeTitle,
      helperText: copy.timeHelper,
      progress: progress(3),
      choices: [
        { id: "now", label: copy.now },
        { id: "today", label: copy.today },
        { id: "tomorrow_morning", label: copy.tomorrowMorning },
        { id: "appointment_time", label: copy.appointmentTime },
        { id: "another_time", label: copy.anotherTime },
      ],
    };
  }
  if (step === "time_custom") {
    return {
      sceneId: "ride-time-custom",
      kind: "text-entry",
      title: copy.timeTitle,
      progress: progress(3),
      textEntry: { label: copy.timeLabel, value: input.requestedTime, placeholder: copy.timePlaceholder },
      primaryAction: { label: copy.continue },
      secondaryAction: { label: copy.back },
    };
  }
  if (step === "mobility") {
    return {
      sceneId: "ride-mobility",
      kind: "choice",
      title: copy.mobilityTitle,
      helperText: copy.mobilityHelper,
      progress: progress(4),
      choices: [
        { id: "none", label: copy.noMobilityNeeds },
        { id: "wheelchair", label: copy.wheelchair },
        { id: "door_help", label: copy.doorHelp },
        { id: "walker", label: copy.walkerOrCane },
        { id: "caregiver", label: copy.caregiverComing },
      ],
    };
  }
  if (step === "provider") {
    return {
      sceneId: "ride-provider",
      kind: "blocked",
      title: copy.providerTitle,
      helperText: copy.providerHelper,
      progress: progress(4),
      status: "blocked",
      primaryAction: { label: copy.addProvider },
      secondaryAction: { label: copy.back },
    };
  }
  if (step === "review") {
    return {
      sceneId: "ride-review",
      kind: "review",
      title: copy.reviewTitle,
      helperText: copy.reviewHelper,
      progress: progress(5),
      summaryRows: [
        { id: "pickup", label: copy.pickup, value: input.pickup || input.savedPickupLabel },
        { id: "destination", label: copy.destination, value: input.destination },
        { id: "when", label: copy.when, value: input.requestedTime },
        { id: "mobility", label: copy.mobility, value: input.mobilityNeeds.join(", ") || copy.none },
        { id: "provider", label: copy.provider, value: input.savedProviderName || copy.none },
      ],
      primaryAction: { label: copy.compareRides },
      secondaryAction: { label: copy.change },
    };
  }
  if (step === "options") {
    return {
      sceneId: "ride-options",
      kind: "choice",
      title: copy.optionsTitle,
      helperText: copy.optionsHelper,
      choices: (input.options ?? []).map((option) => ({
        id: option.id,
        label: option.label,
        description: option.description,
      })),
      secondaryAction: { label: copy.change },
    };
  }
  if (step === "option_review") {
    return {
      sceneId: "ride-option-review",
      kind: "review",
      title: copy.optionReviewTitle,
      helperText: copy.optionReviewHelper,
      summaryRows: [
        { id: "provider", label: copy.provider, value: input.selectedOption?.providerName || input.selectedOption?.label || copy.none },
        { id: "pickup", label: copy.pickup, value: input.pickup || input.savedPickupLabel },
        { id: "destination", label: copy.destination, value: input.destination },
        { id: "when", label: copy.when, value: input.requestedTime },
      ],
      primaryAction: { label: copy.prepareRide, disabled: !input.selectedOption },
      secondaryAction: { label: copy.back },
    };
  }
  if (step === "pending_detail") {
    return {
      sceneId: "ride-pending-detail",
      kind: "text-entry",
      title: input.pendingDetail?.prompt || copy.detailTitle,
      helperText: copy.detailHelper,
      textEntry: {
        label: input.pendingDetail?.label || copy.detailTitle,
        value: input.pendingDetail?.value || "",
        placeholder: input.pendingDetail?.placeholder,
      },
      primaryAction: { label: copy.continue },
      secondaryAction: { label: copy.change },
    };
  }
  if (step === "pending_confirm") {
    return {
      sceneId: "ride-pending-confirm",
      kind: "review",
      title: copy.confirmTitle,
      helperText: copy.confirmHelper,
      summaryRows: [
        { id: "provider", label: copy.provider, value: input.pendingProviderName || input.selectedOption?.providerName || input.selectedOption?.label || copy.none },
        { id: "pickup", label: copy.pickup, value: input.pickup || input.savedPickupLabel },
        { id: "destination", label: copy.destination, value: input.destination },
        { id: "when", label: copy.when, value: input.requestedTime },
      ],
      primaryAction: { label: copy.confirmContact },
      secondaryAction: { label: copy.change },
    };
  }
  if (step === "waiting") {
    return {
      sceneId: "ride-waiting",
      kind: "waiting",
      title: copy.waitingTitle,
      helperText: copy.waitingHelper,
      status: "loading",
    };
  }
  if (step === "completed") {
    return {
      sceneId: "ride-completed",
      kind: "completed",
      title: copy.completedTitle,
      helperText: copy.completedHelper,
      status: "success",
    };
  }
  return {
    sceneId: "ride-error",
    kind: "blocked",
    title: copy.errorTitle,
    helperText: input.error || undefined,
    status: "blocked",
    primaryAction: { label: copy.tryAgain },
    secondaryAction: { label: copy.change },
  };
}
