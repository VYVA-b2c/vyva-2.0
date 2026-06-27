import { type ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WhoForStep from "./WhoForStep";

vi.mock("@/components/onboarding/OnboardingStepLayout", () => ({
  OnboardingStepLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en" }),
}));

vi.mock("@/lib/apiError", () => ({
  friendlyError: vi.fn(),
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
  queryClient: {
    invalidateQueries: vi.fn(),
  },
}));

function LocationSpy() {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

function renderWhoFor() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/onboarding/who-for"]}>
      <Routes>
        <Route path="/onboarding/who-for" element={<WhoForStep />} />
        <Route path="/care-team/invite/:token" element={<LocationSpy />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  window.sessionStorage.clear();
});

describe("WhoForStep care-team invite recovery", () => {
  it("redirects back to a pending care-team invite instead of showing profile setup choices", async () => {
    window.sessionStorage.setItem("vyva_care_team_invite_return", "/care-team/invite/token-123");

    renderWhoFor();

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/care-team/invite/token-123");
    });
  });
});

