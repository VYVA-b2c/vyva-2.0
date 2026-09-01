export const VYVA_HOME_MODE_CONTROL_EVENT = "vyva:home-mode-control";
export const VYVA_HOME_MODE_CONTROL_ACTION_EVENT = "vyva:home-mode-control-action";

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

let latestHomeModeControl: HomeModeControlDetail | null = null;

export const readLatestHomeModeControl = () => latestHomeModeControl;

export const publishHomeModeControl = (detail: HomeModeControlDetail) => {
  latestHomeModeControl = detail;
  window.dispatchEvent(new CustomEvent(VYVA_HOME_MODE_CONTROL_EVENT, { detail }));
};
