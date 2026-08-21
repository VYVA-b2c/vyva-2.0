import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StatusBar from "./StatusBar";
import { HOME_MASTER_THEME_STORAGE_KEY } from "@/hooks/useHomeMasterTheme";
import { READABLE_TEXT_SIZE_STORAGE_KEY } from "@/hooks/useReadableTextSize";
import {
  VYVA_HOME_MODE_CONTROL_ACTION_EVENT,
  VYVA_HOME_MODE_CONTROL_EVENT,
} from "@/lib/homeModeControl";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    language: "en",
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("./ConciergeTaskNotificationBell", () => ({
  default: () => null,
}));

describe("StatusBar home master variant", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the header minimal and opens display controls from the gear", () => {
    render(<StatusBar variant="homeMaster" />);

    expect(screen.queryByLabelText("Health")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-readable-text-size")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-master-theme")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-my-profile"));
    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("home-master-utility-menu")).toBeInTheDocument();
    expect(screen.getByTestId("button-readable-text-size")).toBeInTheDocument();
    expect(screen.getByTestId("button-home-master-theme")).toBeInTheDocument();
  });

  it("toggles and remembers the home master theme", () => {
    render(<StatusBar variant="homeMaster" />);

    fireEvent.click(screen.getByTestId("button-my-profile"));
    fireEvent.click(screen.getByTestId("button-home-master-theme"));

    expect(window.localStorage.getItem(HOME_MASTER_THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.queryByTestId("home-master-utility-menu")).not.toBeInTheDocument();
  });

  it("defaults to large text and remembers an explicit normal choice", () => {
    render(<StatusBar variant="homeMaster" />);

    fireEvent.click(screen.getByTestId("button-my-profile"));
    const textSizeButton = screen.getByTestId("button-readable-text-size");
    expect(textSizeButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(textSizeButton);

    expect(window.localStorage.getItem(READABLE_TEXT_SIZE_STORAGE_KEY)).toBe("normal");
    expect(screen.queryByTestId("home-master-utility-menu")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-my-profile"));
    expect(screen.getByTestId("button-readable-text-size")).toHaveAttribute("aria-pressed", "false");
  });

  it("collapses the utility dock soon after a setting is chosen", () => {
    vi.useFakeTimers();

    render(<StatusBar variant="homeMaster" autoHideHomeControls />);

    fireEvent.click(screen.getByTestId("button-my-profile"));
    fireEvent.click(screen.getByTestId("button-home-master-theme"));

    expect(screen.queryByTestId("home-master-utility-menu")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-controls-reveal")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(screen.getByTestId("button-home-controls-reveal")).toHaveAccessibleName("Show controls");
  });

  it("keeps the home mode control inside the utility dock", () => {
    const actionHandler = vi.fn();
    window.addEventListener(VYVA_HOME_MODE_CONTROL_ACTION_EVENT, actionHandler);

    render(<StatusBar variant="homeMaster" />);
    act(() => {
      window.dispatchEvent(new CustomEvent(VYVA_HOME_MODE_CONTROL_EVENT, {
        detail: {
          mode: "voice",
          visible: true,
          label: "Switch to touch",
          testId: "button-home-mode-touch",
        },
      }));
    });

    const dock = screen.getByTestId("home-master-utility-dock");
    const modeButton = screen.getByTestId("button-home-mode-touch");

    expect(dock).toContainElement(screen.getByTestId("button-my-profile"));
    expect(screen.queryByTestId("button-readable-text-size")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-master-theme")).not.toBeInTheDocument();
    expect(dock).toContainElement(modeButton);
    expect(modeButton).toHaveAccessibleName("Switch to touch");

    fireEvent.click(screen.getByTestId("button-my-profile"));
    const menu = screen.getByTestId("home-master-utility-menu");
    expect(menu).toContainElement(screen.getByTestId("button-readable-text-size"));
    expect(menu).toContainElement(screen.getByTestId("button-home-master-theme"));
    expect(menu).toContainElement(screen.getByTestId("button-home-mode-menu"));

    fireEvent.click(screen.getByTestId("button-home-mode-menu"));
    expect(actionHandler).toHaveBeenCalledWith(expect.objectContaining({
      detail: { mode: "touch" },
    }));
    expect(screen.queryByTestId("home-master-utility-menu")).not.toBeInTheDocument();

    window.removeEventListener(VYVA_HOME_MODE_CONTROL_ACTION_EVENT, actionHandler);
  });

  it("leaves a compact reveal control after the home utility dock fades", () => {
    vi.useFakeTimers();

    render(<StatusBar variant="homeMaster" autoHideHomeControls />);

    act(() => {
      window.dispatchEvent(new CustomEvent(VYVA_HOME_MODE_CONTROL_EVENT, {
        detail: {
          mode: "voice",
          visible: true,
          label: "Switch to touch",
          testId: "button-home-mode-touch",
        },
      }));
    });

    act(() => {
      vi.advanceTimersByTime(4300);
    });

    const revealButton = screen.getByTestId("button-home-controls-reveal");
    expect(revealButton).toHaveAccessibleName("Show controls");

    fireEvent.click(revealButton);

    expect(screen.queryByTestId("button-home-controls-reveal")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-home-mode-touch")).toHaveAccessibleName("Switch to touch");
  });

  it("uses the canonical Y and V/T header for symptom assessment", () => {
    const actionHandler = vi.fn();
    window.addEventListener(VYVA_HOME_MODE_CONTROL_ACTION_EVENT, actionHandler);

    render(<StatusBar variant="symptomAssessment" />);
    act(() => {
      window.dispatchEvent(new CustomEvent(VYVA_HOME_MODE_CONTROL_EVENT, {
        detail: {
          mode: "touch",
          visible: true,
          label: "Switch to voice",
          testId: "button-home-mode-voice",
        },
      }));
    });

    expect(screen.getByRole("button", { name: "VYVA" })).toHaveTextContent("Y");
    expect(screen.getByRole("button", { name: "Use Touch mode" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Use Voice mode" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("button-my-profile")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Use Voice mode" }));
    expect(actionHandler).toHaveBeenCalledWith(expect.objectContaining({
      detail: { mode: "voice" },
    }));

    window.removeEventListener(VYVA_HOME_MODE_CONTROL_ACTION_EVENT, actionHandler);
  });
});
