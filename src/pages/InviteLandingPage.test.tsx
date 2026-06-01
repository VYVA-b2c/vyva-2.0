import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InviteLandingPage, { inviteSetupPath } from "./InviteLandingPage";

const mocks = vi.hoisted(() => ({
  auth: {
    user: null as null | { id: string; email?: string | null; phone?: string | null },
    isLoading: false,
    logout: vi.fn(),
  },
  language: {
    language: "en",
    setLanguage: vi.fn(),
    setBootstrapLanguage: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/i18n", () => ({
  setBootstrapLanguage: (language: string) => mocks.language.setBootstrapLanguage(language),
  useLanguage: () => ({
    language: mocks.language.language,
    setLanguage: mocks.language.setLanguage,
  }),
}));

vi.mock("@/components/VyvaWordmark", () => ({
  VyvaWordmark: () => <div data-testid="vyva-wordmark" />,
}));

function LocationSpy() {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

function renderInvite(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/invite" element={<InviteLandingPage />} />
        <Route path="/login" element={<LocationSpy />} />
        <Route path="/" element={<LocationSpy />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.auth.user = null;
  mocks.auth.isLoading = false;
  mocks.auth.logout = vi.fn().mockResolvedValue(undefined);
  mocks.language.language = "en";
  mocks.language.setLanguage = vi.fn();
  mocks.language.setBootstrapLanguage = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("invite landing compatibility redirect", () => {
  it("builds the login setup path with the original query string", () => {
    expect(inviteSetupPath("?lang=es&email=maria%40example.com&phone=%2B34%20612")).toBe(
      "/login?lang=es&email=maria%40example.com&phone=%2B34+612&mode=register&invite=1&returnTo=%2F",
    );
  });

  it("redirects signed-out invite links to account creation", async () => {
    renderInvite("/invite?lang=fr&email=maria%40example.com");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/login?lang=fr&email=maria%40example.com&mode=register&invite=1&returnTo=%2F",
      );
    });
    expect(mocks.language.setBootstrapLanguage).toHaveBeenCalledWith("fr");
    expect(mocks.auth.logout).not.toHaveBeenCalled();
  });

  it("sends signed-in invite links to the home page", async () => {
    mocks.auth.user = { id: "user-1", email: "karim@example.com" };
    renderInvite("/invite?lang=en&first_name=Maria&last_name=Gomez");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/");
    });
    expect(mocks.auth.logout).not.toHaveBeenCalled();
  });
});
