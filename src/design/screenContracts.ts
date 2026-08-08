export type ScreenContractId =
  | "home"
  | "health"
  | "mind"
  | "community"
  | "medication"
  | "concierge";

export type ScreenTemplateKind =
  | "voiceLanding"
  | "cardHub"
  | "guidedFlow"
  | "outputReview"
  | "setupDashboard";

export type ScreenInteractionMode = "voice" | "touch" | "default";

export type ScreenPrimarySurface =
  | "orb"
  | "cards"
  | "singleStep"
  | "answer"
  | "dashboard";

export type ScreenControl =
  | "settings"
  | "mode"
  | "textSize"
  | "theme"
  | "voice"
  | "touch"
  | "back"
  | "close";

export type ScreenVisibility = "hidden" | "visible" | "settingsOnly";

export interface ScreenModeContract {
  mode: ScreenInteractionMode;
  primarySurface: ScreenPrimarySurface;
  cards: ScreenVisibility;
  chips: ScreenVisibility;
  bottomNav: "fixedClearance" | "notRequired";
  controls: {
    alwaysVisible: readonly ScreenControl[];
    settingsOnly?: readonly ScreenControl[];
    autoCollapseMs?: number;
  };
  rules: readonly string[];
}

export interface ScreenCopyContract {
  primaryLabelMaxWords: number;
  detailMaxLines: number;
  exceptions?: readonly string[];
}

export interface ScreenContract {
  id: ScreenContractId;
  routePattern: string;
  title: string;
  template: ScreenTemplateKind;
  purpose: string;
  modes: readonly ScreenModeContract[];
  maxPrimaryCards?: number;
  minTapTargetPx: number;
  minBottomNavClearancePx: number;
  copy: ScreenCopyContract;
}

const commonControls = {
  compactVoice: ["settings", "mode"] as const,
  settingsMenu: ["textSize", "theme", "mode"] as const,
};

export const HOME_VOICE_LAYOUT_RULES = [
  "Voice mode is a conversation surface.",
  "No cards, chips, or action menus in voice mode.",
  "The orb is the primary interaction point.",
  "Settings stay compact until opened by the user.",
] as const;

export const SCREEN_CONTRACTS = [
  {
    id: "home",
    routePattern: "/",
    title: "Home",
    template: "voiceLanding",
    purpose: "Let VYVA greet the user and start from voice, then reveal cards only when touch mode is selected.",
    modes: [
      {
        mode: "voice",
        primarySurface: "orb",
        cards: "hidden",
        chips: "hidden",
        bottomNav: "fixedClearance",
        controls: {
          alwaysVisible: commonControls.compactVoice,
          settingsOnly: commonControls.settingsMenu,
          autoCollapseMs: 3500,
        },
        rules: HOME_VOICE_LAYOUT_RULES,
      },
      {
        mode: "touch",
        primarySurface: "cards",
        cards: "visible",
        chips: "hidden",
        bottomNav: "fixedClearance",
        controls: {
          alwaysVisible: commonControls.compactVoice,
          settingsOnly: commonControls.settingsMenu,
          autoCollapseMs: 3500,
        },
        rules: [
          "Touch mode is the card surface.",
          "Use one main message and one supporting message.",
          "Keep primary cards visible without hiding the bottom navigation.",
        ],
      },
    ],
    maxPrimaryCards: 4,
    minTapTargetPx: 44,
    minBottomNavClearancePx: 112,
    copy: {
      primaryLabelMaxWords: 2,
      detailMaxLines: 2,
      exceptions: ["Good evening, Karim", "Good morning, Karim", "Good afternoon, Karim"],
    },
  },
  {
    id: "health",
    routePattern: "/health",
    title: "My Health",
    template: "cardHub",
    purpose: "Show the safest health actions with short labels and clear confirmation-first paths.",
    modes: [
      {
        mode: "default",
        primarySurface: "cards",
        cards: "visible",
        chips: "hidden",
        bottomNav: "fixedClearance",
        controls: { alwaysVisible: ["back"] },
        rules: ["Show up to four primary cards.", "Use larger tap targets and short health labels."],
      },
    ],
    maxPrimaryCards: 4,
    minTapTargetPx: 44,
    minBottomNavClearancePx: 112,
    copy: { primaryLabelMaxWords: 2, detailMaxLines: 2 },
  },
  {
    id: "mind",
    routePattern: "/mind-memory",
    title: "My Mind",
    template: "cardHub",
    purpose: "Offer cognitive, focus, reflex, and senses activities in a calm card hub.",
    modes: [
      {
        mode: "default",
        primarySurface: "cards",
        cards: "visible",
        chips: "hidden",
        bottomNav: "fixedClearance",
        controls: { alwaysVisible: ["back"] },
        rules: ["Show progress gently.", "Avoid deficit-framed copy."],
      },
    ],
    maxPrimaryCards: 4,
    minTapTargetPx: 44,
    minBottomNavClearancePx: 112,
    copy: { primaryLabelMaxWords: 2, detailMaxLines: 2 },
  },
  {
    id: "community",
    routePattern: "/social-rooms",
    title: "My Community",
    template: "cardHub",
    purpose: "Help the user join, share, and discover social activity without clutter.",
    modes: [
      {
        mode: "default",
        primarySurface: "cards",
        cards: "visible",
        chips: "hidden",
        bottomNav: "fixedClearance",
        controls: { alwaysVisible: ["back"] },
        rules: ["Keep social labels warm and action-led.", "Avoid dense discovery controls on the first screen."],
      },
    ],
    maxPrimaryCards: 4,
    minTapTargetPx: 44,
    minBottomNavClearancePx: 112,
    copy: { primaryLabelMaxWords: 2, detailMaxLines: 2, exceptions: ["What's On"] },
  },
  {
    id: "medication",
    routePattern: "/meds",
    title: "My Medication",
    template: "setupDashboard",
    purpose: "Prioritize today, then medicine list, adherence, refills, safety, and remedies.",
    modes: [
      {
        mode: "default",
        primarySurface: "dashboard",
        cards: "visible",
        chips: "hidden",
        bottomNav: "fixedClearance",
        controls: { alwaysVisible: ["back"] },
        rules: ["Start with the next useful medicine action.", "Keep safety review copy concise."],
      },
    ],
    maxPrimaryCards: 4,
    minTapTargetPx: 44,
    minBottomNavClearancePx: 112,
    copy: { primaryLabelMaxWords: 2, detailMaxLines: 2, exceptions: ["Home Remedies"] },
  },
  {
    id: "concierge",
    routePattern: "/concierge",
    title: "My Concierge",
    template: "guidedFlow",
    purpose: "Guide services, orders, bookings, and trusted help with confirmation-first flows.",
    modes: [
      {
        mode: "default",
        primarySurface: "singleStep",
        cards: "visible",
        chips: "hidden",
        bottomNav: "fixedClearance",
        controls: { alwaysVisible: ["back", "voice"] },
        rules: ["One decision at a time.", "Never start checkout, payment, booking, or contact without confirmation."],
      },
    ],
    maxPrimaryCards: 4,
    minTapTargetPx: 44,
    minBottomNavClearancePx: 112,
    copy: { primaryLabelMaxWords: 2, detailMaxLines: 2, exceptions: ["Form Help", "Paperwork Help"] },
  },
] as const satisfies readonly ScreenContract[];

export type KnownScreenContract = (typeof SCREEN_CONTRACTS)[number];

export const SCREEN_CONTRACT_RULES = [
  "Voice mode is orb-first and must not show cards or chips.",
  "Touch mode is the card surface.",
  "Primary card hubs show four cards or fewer.",
  "Bottom navigation must have reserved clearance.",
  "Settings start compact and expand only when the user opens them.",
  "Screens with cards, results, stats, or actions do not show explanatory copy under the main heading.",
] as const;

export function getScreenContract(id: ScreenContractId): KnownScreenContract {
  const contract = SCREEN_CONTRACTS.find((item) => item.id === id);
  if (!contract) {
    throw new Error(`Unknown screen contract: ${id}`);
  }
  return contract;
}

export function getModeContract(contract: ScreenContract, mode: ScreenInteractionMode): ScreenModeContract {
  const exact = contract.modes.find((item) => item.mode === mode);
  const fallback = contract.modes.find((item) => item.mode === "default");
  if (!exact && !fallback) {
    throw new Error(`Screen contract ${contract.id} does not define mode ${mode}`);
  }
  return exact ?? fallback;
}

export function validateScreenContracts(contracts: readonly ScreenContract[] = SCREEN_CONTRACTS): string[] {
  const errors: string[] = [];

  for (const contract of contracts) {
    if (contract.minTapTargetPx < 44) {
      errors.push(`${contract.id}: tap target must be at least 44px`);
    }

    if (contract.minBottomNavClearancePx < 96) {
      errors.push(`${contract.id}: bottom navigation clearance is too small`);
    }

    if (contract.template === "cardHub" && (contract.maxPrimaryCards ?? 0) > 4) {
      errors.push(`${contract.id}: card hubs must not exceed four primary cards`);
    }

    for (const mode of contract.modes) {
      if (mode.primarySurface === "orb" && mode.cards !== "hidden") {
        errors.push(`${contract.id}/${mode.mode}: orb-first mode cannot show cards`);
      }

      if (mode.primarySurface === "orb" && mode.chips !== "hidden") {
        errors.push(`${contract.id}/${mode.mode}: orb-first mode cannot show chips`);
      }

      if (mode.bottomNav === "fixedClearance" && contract.minBottomNavClearancePx < 112) {
        errors.push(`${contract.id}/${mode.mode}: fixed bottom navigation needs 112px clearance`);
      }
    }
  }

  return errors;
}
