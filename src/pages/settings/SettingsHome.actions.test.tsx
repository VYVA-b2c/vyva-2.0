import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettingsHome from "./SettingsHome";

const toastMock = vi.fn();
const logoutMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: { status: "active", tier: "plus", plan: { name: "VYVA Plus" } },
    isLoading: false,
  }),
}));

vi.mock("@/components/onboarding/PhoneFrame", () => ({
  PhoneFrame: ({ children }: { children: React.ReactNode }) => <div data-testid="phone-frame">{children}</div>,
}));

vi.mock("@/components/onboarding/ProfileSectionHero", () => ({
  ProfileSectionHero: ({ title }: { title: string }) => <header data-testid="settings-hero">{title}</header>,
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
});

describe("SettingsHome action rows", () => {
  it("turns delete account into a safe support request action", () => {
    vi.useFakeTimers();
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: clipboardWrite } });

    render(
      <MemoryRouter initialEntries={["/settings"]}>
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
});
