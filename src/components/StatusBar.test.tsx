import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import StatusBar from "./StatusBar";
import { HOME_MASTER_THEME_STORAGE_KEY } from "@/hooks/useHomeMasterTheme";
import { READABLE_TEXT_SIZE_STORAGE_KEY } from "@/hooks/useReadableTextSize";

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

  it("keeps the header minimal and sends settings to the existing settings module", () => {
    render(<StatusBar variant="homeMaster" />);

    expect(screen.queryByLabelText("Health")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-my-profile"));
    expect(navigateMock).toHaveBeenCalledWith("/settings");
  });

  it("toggles and remembers the home master theme", () => {
    render(<StatusBar variant="homeMaster" />);

    fireEvent.click(screen.getByTestId("button-home-master-theme"));

    expect(window.localStorage.getItem(HOME_MASTER_THEME_STORAGE_KEY)).toBe("dark");
  });

  it("defaults to large text and remembers an explicit normal choice", () => {
    render(<StatusBar variant="homeMaster" />);

    const textSizeButton = screen.getByTestId("button-readable-text-size");
    expect(textSizeButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(textSizeButton);

    expect(window.localStorage.getItem(READABLE_TEXT_SIZE_STORAGE_KEY)).toBe("normal");
    expect(textSizeButton).toHaveAttribute("aria-pressed", "false");
  });
});
