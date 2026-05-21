import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/lib/queryClient";
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
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/i18n", () => ({
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
        <Route path="/settings/account" element={<LocationSpy />} />
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
  vi.spyOn(queryClient, "clear").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("invite landing compatibility redirect", () => {
  it("builds the account setup path with the original query string", () => {
    expect(inviteSetupPath("?lang=es&email=maria%40example.com&phone=%2B34%20612")).toBe(
      "/settings/account?lang=es&email=maria%40example.com&phone=%2B34%20612",
    );
  });

  it("redirects signed-out legacy invite links to account setup", async () => {
    renderInvite("/invite?lang=fr&email=maria%40example.com");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/settings/account?lang=fr&email=maria%40example.com");
    });
    expect(mocks.language.setLanguage).toHaveBeenCalledWith("fr");
    expect(mocks.auth.logout).not.toHaveBeenCalled();
    expect(queryClient.clear).not.toHaveBeenCalled();
  });

  it("signs out before redirecting signed-in legacy invite links", async () => {
    mocks.auth.user = { id: "user-1", email: "karim@example.com" };
    renderInvite("/invite?lang=en&first_name=Maria&last_name=Gomez");

    await waitFor(() => {
      expect(mocks.auth.logout).toHaveBeenCalledTimes(1);
    });
    expect(queryClient.clear).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/settings/account?lang=en&first_name=Maria&last_name=Gomez",
      );
    });
  });
});
