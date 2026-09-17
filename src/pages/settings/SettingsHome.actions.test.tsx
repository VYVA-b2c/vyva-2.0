import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettingsHome from "./SettingsHome";

const toastMock = vi.fn();
const logoutMock = vi.fn();
const profileHeroMock = vi.hoisted(() => vi.fn());
const voiceMock = vi.hoisted(() => ({
  status: "disconnected",
  isConnecting: false,
  startVoice: vi.fn(),
  stopVoice: vi.fn(),
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useOptionalVyvaVoice: () => voiceMock,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: { status: "active", tier: "plus", plan: { name: "VYVA Plus" } },
    isLoading: false,
  }),
}));

vi.mock("@/components/onboarding/PhoneFrame", () => ({
  PhoneFrame: ({ children, rightAction, showCompanionMode }: {
    children: React.ReactNode;
    rightAction?: React.ReactNode;
    showCompanionMode?: boolean;
  }) => <div data-testid="phone-frame" data-companion-mode={String(showCompanionMode)}>{rightAction}{children}</div>,
}));

vi.mock("@/components/onboarding/ProfileSectionHero", () => ({
  ProfileSectionHero: (props: { title: string; badges?: unknown[] }) => {
    profileHeroMock(props);
    return <header data-testid="settings-hero">{props.title}</header>;
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ logout: logoutMock }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  toastMock.mockClear();
  logoutMock.mockClear();
  profileHeroMock.mockClear();
  voiceMock.startVoice.mockClear();
  voiceMock.stopVoice.mockClear();
  voiceMock.status = "disconnected";
});

describe("SettingsHome action rows", () => {
  it("removes the introduction and mode panel while keeping settings and the canonical microphone", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/settings"]}>
        <SettingsHome />
      </MemoryRouter>,
    );

    expect(profileHeroMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("settings-hero")).not.toBeInTheDocument();
    expect(screen.getByTestId("phone-frame")).toHaveAttribute("data-companion-mode", "false");
    expect(screen.getByTestId("button-settings-health-devices")).toBeInTheDocument();
    const microphone = screen.getByTestId("button-settings-canonical-voice");
    expect(microphone).toHaveClass("rounded-full", "bg-vyva-purple");
    fireEvent.click(microphone);
    expect(voiceMock.startVoice).toHaveBeenCalledWith(
      "Help me manage my VYVA settings.", undefined, { autoStartListening: true },
    );
  });

  it("returns to touch mode from the canonical voice control", () => {
    voiceMock.status = "connected";
    render(<MemoryRouter><SettingsHome /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Return to touch mode" }));
    expect(voiceMock.stopVoice).toHaveBeenCalledOnce();
  });

  it("turns delete account into a safe support request action", () => {
    vi.useFakeTimers();
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: clipboardWrite } });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/settings"]}>
        <SettingsHome />
      </MemoryRouter>,
    );

    const deleteAccount = screen.getByTestId("button-settings-delete-account");
    expect(deleteAccount.tagName.toLowerCase()).toBe("button");

    fireEvent.click(deleteAccount);

    expect(clipboardWrite).toHaveBeenCalledWith("support@vyva.life");
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "Opening email draft",
      description: "Support email copied: support@vyva.life",
    }));
  });

  it("opens Health devices from Settings", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<SettingsHome />} />
          <Route path="/settings/health-devices" element={<div data-testid="health-devices-route">Health devices</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId("button-settings-health-devices"));

    expect(screen.getByTestId("health-devices-route")).toBeInTheDocument();
  });

  it("opens Trusted Help setup from Settings", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<SettingsHome />} />
          <Route path="/settings/trusted-help" element={<div data-testid="trusted-help-route">Trusted Help</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId("button-settings-trusted-help"));

    expect(screen.getByTestId("trusted-help-route")).toBeInTheDocument();
  });
});
