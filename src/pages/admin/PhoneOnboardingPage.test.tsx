import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import PhoneOnboardingPage from "./PhoneOnboardingPage";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "admin@example.com", role: "admin" },
    logout: vi.fn(),
  }),
}));

const apiFetchMock = vi.mocked(apiFetch);

const baseCaller = {
  id: "caller-1",
  name: "",
  profile_name: "",
  profile_phone: "",
  login_phone: "",
  phone: "",
  profile_email: "",
  login_email: "",
  email: "",
  user_type: "elder",
  tier: "free",
  consent_status: "not_required",
  account_status: "pending",
  status: "created",
  journey_step: "collecting_phone_profile",
  created_at: "2026-07-02T10:00:00.000Z",
  last_activity_at: "2026-07-02T10:00:00.000Z",
  link_sent_at: null,
  activated_at: null,
  elder_user_id: null,
  user_id: null,
  organization_name: "",
  metadata: {},
  source_payload: {},
};

const callers = [
  {
    ...baseCaller,
    id: "caller-missing",
    profile_name: "Missing Caller",
    phone: "+34 600 111 222",
    journey_step: "missing_profile_info",
  },
  {
    ...baseCaller,
    id: "caller-link",
    profile_name: "Link Caller",
    phone: "+34 600 333 444",
    status: "link_sent",
    journey_step: "signup_invite_sent",
    link_sent_at: "2026-07-02T11:00:00.000Z",
  },
  {
    ...baseCaller,
    id: "caller-done",
    profile_name: "Completed Caller",
    phone: "+34 600 555 666",
    status: "active",
    journey_step: "completed",
    activated_at: "2026-07-02T12:00:00.000Z",
  },
];

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function renderPage() {
  apiFetchMock.mockResolvedValue(jsonResponse({ users: callers }));

  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/phone-onboarding"]}>
      <PhoneOnboardingPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  apiFetchMock.mockReset();
});

describe("PhoneOnboardingPage", () => {
  it("shows follow-up queue and filters loaded callers locally", async () => {
    renderPage();

    expect(await screen.findByText("Needs follow-up")).toBeInTheDocument();
    expect(screen.getByText("Showing 3 of 3 loaded callers.")).toBeInTheDocument();
    expect(screen.getAllByText("Complete caller details").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Check signup progress").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("phone-summary-missing_info"));
    expect(screen.getByText("Showing 1 of 3 loaded callers.")).toBeInTheDocument();
    expect(screen.getAllByText("Missing Caller").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Showing 3 of 3 loaded callers.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search caller name, phone or email"), {
      target: { value: "Link Caller" },
    });

    await waitFor(() => {
      expect(screen.getByText("Showing 1 of 3 loaded callers.")).toBeInTheDocument();
    });
  });
});
