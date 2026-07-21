import type { VoiceCanvasViewModel } from "@/components/voice-canvas";

export type ConciergeAppointmentCanvasStep =
  | "reason"
  | "time"
  | "time_custom"
  | "coverage"
  | "provider"
  | "searching"
  | "options"
  | "review"
  | "contacting"
  | "completed"
  | "error";

export type ConciergeAppointmentCanvasOption = {
  id: string;
  label: string;
  description?: string;
  availability?: string;
  providerSource?: "saved" | "external" | "manual";
};

export type ConciergeAppointmentCanvasCopy = {
  reasonTitle: string;
  reasonHelper: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  continue: string;
  timeTitle: string;
  timeHelper: string;
  today: string;
  tomorrow: string;
  thisWeek: string;
  nextWeek: string;
  anotherTime: string;
  timeLabel: string;
  timePlaceholder: string;
  coverageTitle: string;
  coverageHelper: string;
  useSavedCoverage: string;
  publicCoverage: string;
  privateCoverage: string;
  selfPay: string;
  coverageUnsure: string;
  providerTitle: string;
  providerHelper: string;
  useSavedProvider: string;
  useSavedProviderDescription: string;
  findProvider: string;
  findProviderDescription: string;
  addProvider: string;
  addProviderDescription: string;
  searchingTitle: string;
  searchingHelper: string;
  optionsTitle: string;
  optionsHelper: string;
  savedProvider: string;
  availabilityUnknown: string;
  reviewTitle: string;
  reviewHelper: string;
  reason: string;
  preferredTime: string;
  coverage: string;
  provider: string;
  availability: string;
  contactRoute: string;
  confirmContact: string;
  change: string;
  back: string;
  contactingTitle: string;
  contactingHelper: string;
  completedTitle: string;
  completedHelper: string;
  errorTitle: string;
  tryAgain: string;
};

export type BuildConciergeAppointmentCanvasInput = {
  step: ConciergeAppointmentCanvasStep;
  copy: ConciergeAppointmentCanvasCopy;
  reason: string;
  requestedTime: string;
  coverageLabel: string;
  hasSavedCoverage: boolean;
  savedProviderName?: string;
  options?: ConciergeAppointmentCanvasOption[];
  selectedOption?: ConciergeAppointmentCanvasOption | null;
  contactChannelLabel?: string;
  error?: string | null;
};

function progress(current: number) {
  return { current, total: 5, label: `${current} / 5` };
}

export function buildConciergeAppointmentCanvasViewModel(
  input: BuildConciergeAppointmentCanvasInput,
): VoiceCanvasViewModel {
  const { copy, step } = input;
  if (step === "reason") {
    return {
      sceneId: "appointment-reason",
      kind: "text-entry",
      title: copy.reasonTitle,
      helperText: copy.reasonHelper,
      progress: progress(1),
      textEntry: {
        label: copy.reasonLabel,
        value: input.reason,
        placeholder: copy.reasonPlaceholder,
        multiline: true,
      },
      primaryAction: { label: copy.continue, disabled: !input.reason.trim() },
    };
  }
  if (step === "time") {
    return {
      sceneId: "appointment-time",
      kind: "date-time",
      title: copy.timeTitle,
      helperText: copy.timeHelper,
      progress: progress(2),
      choices: [
        { id: "today", label: copy.today },
        { id: "tomorrow", label: copy.tomorrow },
        { id: "this_week", label: copy.thisWeek },
        { id: "next_week", label: copy.nextWeek },
        { id: "another_time", label: copy.anotherTime },
      ],
      secondaryAction: { label: copy.back },
    };
  }
  if (step === "time_custom") {
    return {
      sceneId: "appointment-time-custom",
      kind: "text-entry",
      title: copy.timeTitle,
      helperText: copy.timeHelper,
      progress: progress(2),
      textEntry: {
        label: copy.timeLabel,
        value: input.requestedTime,
        placeholder: copy.timePlaceholder,
      },
      primaryAction: { label: copy.continue, disabled: !input.requestedTime.trim() },
      secondaryAction: { label: copy.back },
    };
  }
  if (step === "coverage") {
    return {
      sceneId: "appointment-coverage",
      kind: "choice",
      title: copy.coverageTitle,
      helperText: copy.coverageHelper,
      progress: progress(3),
      choices: [
        ...(input.hasSavedCoverage ? [{ id: "saved", label: copy.useSavedCoverage }] : []),
        { id: "public", label: copy.publicCoverage },
        { id: "private", label: copy.privateCoverage },
        { id: "self_pay", label: copy.selfPay },
        { id: "unknown", label: copy.coverageUnsure },
      ],
      secondaryAction: { label: copy.back },
    };
  }
  if (step === "provider") {
    return {
      sceneId: "appointment-provider",
      kind: "choice",
      title: copy.providerTitle,
      helperText: copy.providerHelper,
      progress: progress(4),
      choices: [
        ...(input.savedProviderName ? [{
          id: "saved_provider",
          label: input.savedProviderName,
          description: copy.useSavedProviderDescription,
        }] : []),
        {
          id: "find_provider",
          label: copy.findProvider,
          description: copy.findProviderDescription,
        },
        {
          id: "add_provider",
          label: copy.addProvider,
          description: copy.addProviderDescription,
        },
      ],
      secondaryAction: { label: copy.back },
    };
  }
  if (step === "searching") {
    return {
      sceneId: "appointment-searching",
      kind: "waiting",
      title: copy.searchingTitle,
      helperText: copy.searchingHelper,
      status: "loading",
    };
  }
  if (step === "options") {
    return {
      sceneId: "appointment-options",
      kind: "choice",
      title: copy.optionsTitle,
      helperText: copy.optionsHelper,
      progress: progress(4),
      choices: (input.options ?? []).map((option) => ({
        id: option.id,
        label: option.label,
        description: [
          option.providerSource === "saved" ? copy.savedProvider : "",
          option.availability || copy.availabilityUnknown,
          option.description || "",
        ].filter(Boolean).join(" · "),
      })),
      secondaryAction: { label: copy.back },
    };
  }
  if (step === "review") {
    return {
      sceneId: "appointment-review",
      kind: "review",
      title: copy.reviewTitle,
      helperText: copy.reviewHelper,
      progress: progress(5),
      summaryRows: [
        { id: "provider", label: copy.provider, value: input.selectedOption?.label || input.savedProviderName || "" },
        { id: "availability", label: copy.availability, value: input.selectedOption?.availability || copy.availabilityUnknown },
        { id: "time", label: copy.preferredTime, value: input.requestedTime },
        { id: "reason", label: copy.reason, value: input.reason },
        { id: "coverage", label: copy.coverage, value: input.coverageLabel },
        { id: "channel", label: copy.contactRoute, value: input.contactChannelLabel || "" },
      ].filter((row) => Boolean(row.value)),
      primaryAction: { label: copy.confirmContact, disabled: !input.selectedOption },
      secondaryAction: { label: copy.change },
    };
  }
  if (step === "contacting") {
    return {
      sceneId: "appointment-contacting",
      kind: "waiting",
      title: copy.contactingTitle,
      helperText: copy.contactingHelper,
      status: "loading",
    };
  }
  if (step === "completed") {
    return {
      sceneId: "appointment-completed",
      kind: "completed",
      title: copy.completedTitle,
      helperText: copy.completedHelper,
      status: "success",
    };
  }
  return {
    sceneId: "appointment-error",
    kind: "blocked",
    title: copy.errorTitle,
    helperText: input.error || undefined,
    status: "blocked",
    primaryAction: { label: copy.tryAgain },
    secondaryAction: { label: copy.change },
  };
}
