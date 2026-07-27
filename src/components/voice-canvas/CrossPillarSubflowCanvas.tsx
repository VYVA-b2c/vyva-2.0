import { CalendarDays, Car, Laptop, MapPin, Sparkles, Star, UserRound, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  VYVA_VOICE_USER_MESSAGE_EVENT,
  type VoiceHomeSubflowId,
  type VoiceUserMessageDetail,
} from "@/lib/voiceNavigation";
import VoiceCanvasScene from "./VoiceCanvasScene";
import type { VoiceCanvasChoice, VoiceCanvasViewModel } from "./types";

export const CROSS_PILLAR_COMPLETION_ACTIONS = [
  "health-doctor",
  "mind-memory",
  "community-activities",
  "concierge-book",
] as const;

export type CrossPillarCompletionActionId = (typeof CROSS_PILLAR_COMPLETION_ACTIONS)[number];

type CanvasStep = "choice" | "review" | "completed" | "blocked";

type PersistedCanvasState = {
  step: CanvasStep;
  selectedOptionId: string | null;
};

export type CrossPillarSubflowResult = {
  actionId: CrossPillarCompletionActionId;
  optionId: string;
  optionLabel: string;
};

type CrossPillarSubflowCanvasProps = {
  actionId: CrossPillarCompletionActionId;
  onContinue: (result: CrossPillarSubflowResult) => void | Promise<void>;
  onCancel: () => void;
};

type OptionDefinition = {
  id: string;
  labelKey: string;
  labelFallback: string;
  detailKey: string;
  detailFallback: string;
  icon: VoiceCanvasChoice["icon"];
};

type FlowDefinition = {
  titleKey: string;
  titleFallback: string;
  helperKey: string;
  helperFallback: string;
  optionLabelKey: string;
  optionLabelFallback: string;
  options: OptionDefinition[];
};

const FLOW_DEFINITIONS: Record<CrossPillarCompletionActionId, FlowDefinition> = {
  "health-doctor": {
    titleKey: "home.master.subflowCanvas.doctor.title",
    titleFallback: "How should we help with your doctor?",
    helperKey: "home.master.subflowCanvas.doctor.helper",
    helperFallback: "Choose one. You can keep speaking at any time.",
    optionLabelKey: "home.master.subflowCanvas.doctor.preference",
    optionLabelFallback: "Doctor help",
    options: [
      {
        id: "usual-provider",
        labelKey: "home.master.subflowCanvas.doctor.usual",
        labelFallback: "My usual doctor",
        detailKey: "home.master.subflowCanvas.doctor.usualDetail",
        detailFallback: "Prepare an appointment with a saved provider",
        icon: UserRound,
      },
      {
        id: "find-provider",
        labelKey: "home.master.subflowCanvas.doctor.find",
        labelFallback: "Find a doctor",
        detailKey: "home.master.subflowCanvas.doctor.findDetail",
        detailFallback: "Look at suitable nearby options first",
        icon: MapPin,
      },
      {
        id: "prepare-only",
        labelKey: "home.master.subflowCanvas.doctor.prepare",
        labelFallback: "Prepare what to say",
        detailKey: "home.master.subflowCanvas.doctor.prepareDetail",
        detailFallback: "Organize the reason before contacting anyone",
        icon: CalendarDays,
      },
    ],
  },
  "mind-memory": {
    titleKey: "home.master.subflowCanvas.mind.title",
    titleFallback: "What would feel good today?",
    helperKey: "home.master.subflowCanvas.mind.helper",
    helperFallback: "VYVA will take you to a suitable cognitive activity.",
    optionLabelKey: "home.master.subflowCanvas.mind.preference",
    optionLabelFallback: "Activity preference",
    options: [
      {
        id: "recommended",
        labelKey: "home.master.subflowCanvas.mind.recommended",
        labelFallback: "Recommend one",
        detailKey: "home.master.subflowCanvas.mind.recommendedDetail",
        detailFallback: "Use my recent activity to choose",
        icon: Sparkles,
      },
      {
        id: "short",
        labelKey: "home.master.subflowCanvas.mind.short",
        labelFallback: "Something short",
        detailKey: "home.master.subflowCanvas.mind.shortDetail",
        detailFallback: "A quick cognitive exercise",
        icon: Star,
      },
      {
        id: "gentle",
        labelKey: "home.master.subflowCanvas.mind.gentle",
        labelFallback: "Something gentle",
        detailKey: "home.master.subflowCanvas.mind.gentleDetail",
        detailFallback: "Calm pace and simple instructions",
        icon: UserRound,
      },
    ],
  },
  "community-activities": {
    titleKey: "home.master.subflowCanvas.community.title",
    titleFallback: "What kind of activity suits you?",
    helperKey: "home.master.subflowCanvas.community.helper",
    helperFallback: "Choose a starting point. You can change it later.",
    optionLabelKey: "home.master.subflowCanvas.community.preference",
    optionLabelFallback: "Activity type",
    options: [
      {
        id: "nearby",
        labelKey: "home.master.subflowCanvas.community.nearby",
        labelFallback: "Nearby",
        detailKey: "home.master.subflowCanvas.community.nearbyDetail",
        detailFallback: "Activities close to home",
        icon: MapPin,
      },
      {
        id: "online",
        labelKey: "home.master.subflowCanvas.community.online",
        labelFallback: "Online",
        detailKey: "home.master.subflowCanvas.community.onlineDetail",
        detailFallback: "Join from home",
        icon: Laptop,
      },
      {
        id: "either",
        labelKey: "home.master.subflowCanvas.community.either",
        labelFallback: "Show me both",
        detailKey: "home.master.subflowCanvas.community.eitherDetail",
        detailFallback: "Compare nearby and online choices",
        icon: UsersRound,
      },
    ],
  },
  "concierge-book": {
    titleKey: "home.master.subflowCanvas.ride.title",
    titleFallback: "Where should we start your ride?",
    helperKey: "home.master.subflowCanvas.ride.helper",
    helperFallback: "VYVA will ask for destination and timing next.",
    optionLabelKey: "home.master.subflowCanvas.ride.preference",
    optionLabelFallback: "Ride setup",
    options: [
      {
        id: "saved-destination",
        labelKey: "home.master.subflowCanvas.ride.saved",
        labelFallback: "A saved place",
        detailKey: "home.master.subflowCanvas.ride.savedDetail",
        detailFallback: "Use an address already in my profile",
        icon: Star,
      },
      {
        id: "new-destination",
        labelKey: "home.master.subflowCanvas.ride.new",
        labelFallback: "A new address",
        detailKey: "home.master.subflowCanvas.ride.newDetail",
        detailFallback: "Tell VYVA where you want to go",
        icon: MapPin,
      },
      {
        id: "need-help",
        labelKey: "home.master.subflowCanvas.ride.help",
        labelFallback: "Help me decide",
        detailKey: "home.master.subflowCanvas.ride.helpDetail",
        detailFallback: "Start with a few simple questions",
        icon: Car,
      },
    ],
  },
};

export function isCrossPillarCompletionAction(
  actionId: VoiceHomeSubflowId,
): actionId is CrossPillarCompletionActionId {
  return (CROSS_PILLAR_COMPLETION_ACTIONS as readonly string[]).includes(actionId);
}

function storageKey(actionId: CrossPillarCompletionActionId) {
  return `vyva.cross-pillar-subflow.${actionId}.v1`;
}

function readPersistedState(actionId: CrossPillarCompletionActionId): PersistedCanvasState {
  try {
    const value = window.sessionStorage.getItem(storageKey(actionId));
    if (!value) return { step: "choice", selectedOptionId: null };
    const parsed = JSON.parse(value) as Partial<PersistedCanvasState>;
    const validStep = parsed.step === "choice"
      || parsed.step === "review"
      || parsed.step === "completed"
      || parsed.step === "blocked";
    return {
      step: validStep ? parsed.step! : "choice",
      selectedOptionId: typeof parsed.selectedOptionId === "string" ? parsed.selectedOptionId : null,
    };
  } catch {
    return { step: "choice", selectedOptionId: null };
  }
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export default function CrossPillarSubflowCanvas({
  actionId,
  onContinue,
  onCancel,
}: CrossPillarSubflowCanvasProps) {
  const { t } = useTranslation();
  const definition = FLOW_DEFINITIONS[actionId];
  const [state, setState] = useState<PersistedCanvasState>(() => readPersistedState(actionId));
  const translatedOptions = useMemo(() => definition.options.map((option) => ({
    ...option,
    label: t(option.labelKey, option.labelFallback),
    description: t(option.detailKey, option.detailFallback),
  })), [definition.options, t]);
  const selectedOption = translatedOptions.find((option) => option.id === state.selectedOptionId) ?? null;

  useEffect(() => {
    setState(readPersistedState(actionId));
  }, [actionId]);

  useEffect(() => {
    window.sessionStorage.setItem(storageKey(actionId), JSON.stringify(state));
  }, [actionId, state]);

  const choose = useCallback((choiceId: string) => {
    setState({ step: "review", selectedOptionId: choiceId });
  }, []);

  useEffect(() => {
    const handleVoiceMessage = (event: Event) => {
      const detail = (event as CustomEvent<VoiceUserMessageDetail>).detail;
      if (!detail?.text) return;
      const message = normalized(detail.text);
      if (/(cancel|stop|back|cancelar|parar|volver|annuler|retour|abbrechen|zuruck|annulla|indietro|cancelar|voltar)/.test(message)) {
        onCancel();
        return;
      }
      if (state.step === "review" && /(confirm|yes|continue|confirmar|si|continuar|confirmer|oui|weiter|bestatigen|conferma|sim)/.test(message)) {
        setState((current) => ({ ...current, step: "completed" }));
        return;
      }
      if (state.step !== "choice") return;
      const match = translatedOptions.find((option) => {
        const candidates = [option.label, option.description, option.id.replaceAll("-", " ")];
        return candidates.some((candidate) => message.includes(normalized(candidate)));
      });
      if (match) choose(match.id);
    };
    window.addEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, handleVoiceMessage);
    return () => window.removeEventListener(VYVA_VOICE_USER_MESSAGE_EVENT, handleVoiceMessage);
  }, [choose, onCancel, state.step, translatedOptions]);

  const continueToDestination = async () => {
    if (!selectedOption) return;
    try {
      await onContinue({
        actionId,
        optionId: selectedOption.id,
        optionLabel: selectedOption.label,
      });
      window.sessionStorage.removeItem(storageKey(actionId));
    } catch {
      setState((current) => ({ ...current, step: "blocked" }));
    }
  };

  const viewModel: VoiceCanvasViewModel = state.step === "choice"
    ? {
        sceneId: `cross-pillar-${actionId}-choice`,
        kind: "choice",
        title: t(definition.titleKey, definition.titleFallback),
        helperText: t(definition.helperKey, definition.helperFallback),
        choices: translatedOptions.map((option) => ({
          id: option.id,
          label: option.label,
          description: option.description,
          icon: option.icon,
          selected: option.id === state.selectedOptionId,
        })),
        secondaryAction: { label: t("home.master.subflowCanvas.actions.cancel", "Not now") },
      }
    : state.step === "review"
      ? {
          sceneId: `cross-pillar-${actionId}-review`,
          kind: "review",
          statusLabel: t("home.master.subflowCanvas.review.label", "Review"),
          title: t("home.master.subflowCanvas.review.title", "Is this right?"),
          helperText: t(
            "home.master.subflowCanvas.review.helper",
            "Nothing will be booked, sent, or shared without your confirmation.",
          ),
          summaryRows: selectedOption ? [{
            id: "preference",
            label: t(definition.optionLabelKey, definition.optionLabelFallback),
            value: selectedOption.label,
          }] : [],
          primaryAction: { label: t("home.master.subflowCanvas.actions.confirm", "Yes, continue") },
          secondaryAction: { label: t("home.master.subflowCanvas.actions.change", "Change") },
        }
      : state.step === "completed"
        ? {
            sceneId: `cross-pillar-${actionId}-completed`,
            kind: "completed",
            status: "success",
            statusLabel: t("home.master.subflowCanvas.completed.label", "Ready"),
            title: t("home.master.subflowCanvas.completed.title", "Your next step is prepared."),
            helperText: t(
              "home.master.subflowCanvas.completed.helper",
              "Continue when you are ready. VYVA will carry your choice with you.",
            ),
            primaryAction: { label: t("home.master.subflowCanvas.actions.open", "Open next step") },
            secondaryAction: { label: t("home.master.subflowCanvas.actions.cancel", "Not now") },
          }
        : {
            sceneId: `cross-pillar-${actionId}-blocked`,
            kind: "blocked",
            status: "blocked",
            statusLabel: t("home.master.subflowCanvas.blocked.label", "Could not continue"),
            title: t("home.master.subflowCanvas.blocked.title", "Your choice is still saved."),
            helperText: t("home.master.subflowCanvas.blocked.helper", "Try again, or come back later."),
            primaryAction: { label: t("home.master.subflowCanvas.actions.retry", "Try again") },
            secondaryAction: { label: t("home.master.subflowCanvas.actions.cancel", "Not now") },
          };

  const handlePrimary = () => {
    if (state.step === "review") {
      setState((current) => ({ ...current, step: "completed" }));
      return;
    }
    if (state.step === "completed" || state.step === "blocked") void continueToDestination();
  };

  const handleSecondary = () => {
    if (state.step === "review") {
      setState({ step: "choice", selectedOptionId: state.selectedOptionId });
      return;
    }
    onCancel();
  };

  return (
    <div
      className="mx-auto w-full max-w-[760px] px-3 pb-6 sm:px-5"
      data-testid="cross-pillar-subflow-canvas"
      data-action-id={actionId}
      data-step={state.step}
    >
      <VoiceCanvasScene
        viewModel={viewModel}
        onChoice={choose}
        onPrimary={handlePrimary}
        onSecondary={handleSecondary}
      />
    </div>
  );
}
