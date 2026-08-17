export const VYVA_HOME_MODE_CONTROL_EVENT = "vyva:home-mode-control";
export const VYVA_HOME_MODE_CONTROL_ACTION_EVENT = "vyva:home-mode-control-action";
export const VYVA_HOME_INTERACTION_MODE_STORAGE_KEY = "vyva:home-interaction-mode:v1";

export type HomeInteractionMode = "voice" | "touch";

export type HomeModeControlDetail = {
  label: string;
  mode: HomeInteractionMode;
  testId: "button-home-mode-touch" | "button-home-mode-voice";
  visible: boolean;
};

export type HomeModeControlActionDetail = {
  mode: HomeInteractionMode;
};

export const readHomeInteractionMode = (): HomeInteractionMode => {
  if (typeof window === "undefined") return "voice";

  try {
    return window.localStorage.getItem(VYVA_HOME_INTERACTION_MODE_STORAGE_KEY) === "touch" ? "touch" : "voice";
  } catch {
    return "voice";
  }
};

export const writeHomeInteractionMode = (mode: HomeInteractionMode) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(VYVA_HOME_INTERACTION_MODE_STORAGE_KEY, mode);
  } catch {
    // Storage can be unavailable in privacy-restricted previews; the active UI remains usable.
  }
};

let latestHomeModeControl: HomeModeControlDetail | null = null;

export const readLatestHomeModeControl = () => latestHomeModeControl;

export const publishHomeModeControl = (detail: HomeModeControlDetail) => {
  latestHomeModeControl = detail;
  window.dispatchEvent(new CustomEvent(VYVA_HOME_MODE_CONTROL_EVENT, { detail }));
};
