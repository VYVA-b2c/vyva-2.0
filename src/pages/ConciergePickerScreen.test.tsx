import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ConciergePickerScreen from "./ConciergePickerScreen";
import { HOME_MASTER_THEME_STORAGE_KEY } from "@/hooks/useHomeMasterTheme";

const apiFetchMock = vi.fn();
const nudgeInbox = vi.hoisted(() => ({ needs_you: [] as unknown[], waiting: [], completed: [] }));
vi.mock("@/lib/conciergeTaskDrafts", () => ({ listConciergeTaskDrafts: async () => [] }));
vi.mock("@/lib/conciergeTaskInbox", () => ({
  fetchConciergeTaskPendingItems: async () => [],
  fetchConciergeTaskCompletedSessions: async () => [],
  buildConciergeTaskInbox: () => nudgeInbox,
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en" }),
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useOptionalVyvaVoice: () => null,
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <span data-testid="location-path">{location.pathname}</span>
      <span data-testid="route-state">{JSON.stringify(location.state)}</span>
    </>
  );
}

function jsonResponse(data: unknown) {
  return { ok: true, json: async () => data } as Response;
}

const configuredProfile = {
  street: "42 Calle Mayor",
  cityState: "Zamora",
  savedProviders: [
    { name: "Radio Taxi", category: "transport", isTrusted: true },
    { name: "Trusted Pharmacy", category: "pharmacy", isTrusted: true },
    { name: "Trusted Clinic", category: "doctor_clinic", isTrusted: true },
    { name: "Trusted Plumber", category: "home_service", isTrusted: true },
  ],
};

function renderPicker(
  category: "get-help" | "order-in" | "book-appointments" | "discover",
  profile = configuredProfile,
  backPath = "/concierge",
) {
  apiFetchMock.mockResolvedValue(jsonResponse(profile));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[`/concierge/${category}`]}>
        <LocationProbe />
        <Routes>
          <Route path={`/concierge/${category}`} element={<ConciergePickerScreen category={category} backPath={backPath} />} />
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function waitForPickerReady(testId: string) {
  await waitFor(() => expect(screen.getByTestId(testId)).not.toBeDisabled());
}

describe("ConciergePickerScreen", () => {
  beforeEach(() => {
    sessionStorage.clear();
    nudgeInbox.needs_you = [];
    window.localStorage.setItem(HOME_MASTER_THEME_STORAGE_KEY, "light");
  });

  it("prioritises attention over a draft and dismisses the nudge for this session", async () => {
    nudgeInbox.needs_you = [
      { continuation: { flow: "home_service", state: "draft" }, resumePath: "/concierge/task/draft" },
      { continuation: { flow: "home_service", state: "needs_info" }, detailPath: "/concierge/tasks/pending/attention" },
    ];
    renderPicker("get-help");
    expect(await screen.findByRole("button", { name: "Your request needs attention" })).toBeInTheDocument();
    expect(screen.queryByText("Continue your request")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByTestId("get-help-nudge")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("concierge:get-help:nudge-dismissed")).toBe("true");
  });

  it("resumes a home-service draft through its existing route", async () => {
    nudgeInbox.needs_you = [{ continuation: { flow: "home_service", state: "draft" }, resumePath: "/concierge/task/draft" }];
    renderPicker("get-help");
    fireEvent.click(await screen.findByRole("button", { name: "Continue your request" }));
    expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge/task/draft");
  });

  it("inherits the persisted dark theme", () => {
    window.localStorage.setItem(HOME_MASTER_THEME_STORAGE_KEY, "dark");
    renderPicker("get-help");

    expect(screen.getByTestId("concierge-picker-screen")).toHaveAttribute("data-home-master-theme", "dark");
    expect(screen.getByTestId("button-concierge-picker-home-repair")).toHaveClass("bg-white/[0.075]");
    expect(screen.getByTestId("button-concierge-picker-home-repair")).not.toHaveClass("bg-white");
  });

  it("keeps light cards on the light theme", () => {
    renderPicker("get-help");

    expect(screen.getByTestId("concierge-picker-screen")).toHaveAttribute("data-home-master-theme", "light");
    expect(screen.getByTestId("button-concierge-picker-home-repair")).toHaveClass("bg-white");
  });

  it("shows the four Get Help options and routes to the home-service task", async () => {
    renderPicker("get-help");

    expect(screen.getByText("Get Help")).toBeInTheDocument();
    expect(screen.getByTestId("button-concierge-picker-home-repair")).toHaveTextContent("Home Repair");
    expect(screen.getByText("Home Repair")).toHaveClass("font-display", "text-[20px]", "font-semibold", "md:text-[24px]");
    expect(screen.getByText("Plumber, electrician, cleaning")).toHaveClass("font-body", "text-[14px]", "font-bold", "md:text-[15px]");
    expect(screen.getByTestId("button-concierge-picker-healthcare")).toHaveTextContent("Healthcare");
    expect(screen.getByTestId("button-concierge-picker-admin-service")).toHaveTextContent("Admin Service");
    expect(screen.getByTestId("button-concierge-picker-home-care")).toHaveTextContent("Home Care");

    await waitForPickerReady("button-concierge-picker-home-repair");
    fireEvent.click(screen.getByTestId("button-concierge-picker-home-repair"));

    expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge/task/new");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"home_service\"");
  });

  it("replaces choices with setup and restores them on back", async () => {
    renderPicker("get-help", { ...configuredProfile, savedProviders: [] });
    await waitForPickerReady("button-concierge-picker-home-repair");
    fireEvent.click(screen.getByTestId("button-concierge-picker-home-repair"));
    expect(screen.getByTestId("panel-concierge-service-setup")).toBeInTheDocument();
    expect(screen.queryByTestId("concierge-picker-options")).not.toBeInTheDocument();
    expect(screen.queryByText("VYVA only asks for the details this service needs.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-concierge-picker-back"));
    expect(screen.getByTestId("concierge-picker-options")).toBeInTheDocument();
    expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge/get-help");
  });

  it("offers provider setup without an unrelated discovery action", async () => {
    renderPicker("get-help", { ...configuredProfile, savedProviders: [] });
    await waitForPickerReady("button-concierge-picker-home-repair");
    fireEvent.click(screen.getByTestId("button-concierge-picker-home-repair"));
    expect(screen.queryByRole("button", { name: "Find me another one" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-concierge-setup-provider"));
    expect(screen.getByTestId("location-path")).toHaveTextContent("/onboarding/profile/providers");
  });

  it("shows the four Book Appointments options and routes each appointment kind", async () => {
    renderPicker("book-appointments");

    expect(screen.getByText("Book Appointments")).toBeInTheDocument();
    await waitForPickerReady("button-concierge-picker-appointment-admin");
    fireEvent.click(screen.getByTestId("button-concierge-picker-appointment-admin"));

    expect(screen.getByTestId("route-state")).toHaveTextContent("\"appointmentKind\":\"government\"");
  });

  it("routes Order In's Food option to the shopping helper with a groceries prefill", async () => {
    renderPicker("order-in");

    expect(screen.getByText("Order In")).toBeInTheDocument();
    await waitForPickerReady("button-concierge-picker-food");
    fireEvent.click(screen.getByTestId("button-concierge-picker-food"));

    expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge/shopping");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"category\":\"groceries\"");
  });

  it("routes Discover's Safe Home option to the safe-home flow", async () => {
    renderPicker("discover");

    expect(screen.getByText("Discover")).toBeInTheDocument();
    await waitForPickerReady("button-concierge-picker-safe-home");
    fireEvent.click(screen.getByTestId("button-concierge-picker-safe-home"));

    expect(screen.getByTestId("location-path")).toHaveTextContent("/safe-home");
  });

  it("navigates back to the concierge hub", () => {
    renderPicker("get-help");

    fireEvent.click(screen.getByTestId("button-concierge-picker-back"));

    expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge");
  });

  it("returns preview pickers to the unprotected preview hub", () => {
    renderPicker("get-help", configuredProfile, "/dev/concierge-canonical-preview");

    fireEvent.click(screen.getByTestId("button-concierge-picker-back"));

    expect(screen.getByTestId("location-path")).toHaveTextContent("/dev/concierge-canonical-preview");
  });

  it("shows only the missing ride setup and routes to address onboarding", async () => {
    renderPicker("order-in", { savedProviders: [{ name: "Radio Taxi", category: "transport", isTrusted: true }] });

    await waitForPickerReady("button-concierge-picker-ride");
    fireEvent.click(screen.getByTestId("button-concierge-picker-ride"));

    expect(await screen.findByTestId("panel-concierge-service-setup")).toHaveTextContent("Add home address");
    expect(screen.queryByTestId("button-concierge-setup-provider")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-concierge-setup-address"));
    expect(screen.getByTestId("location-path")).toHaveTextContent("/onboarding/profile/address");
  });

  it("shows only the missing pharmacy setup for OTC support", async () => {
    renderPicker("discover", { street: "42 Calle Mayor", cityState: "Zamora", savedProviders: [] });

    await waitForPickerReady("button-concierge-picker-otc-pharmacy");
    fireEvent.click(screen.getByTestId("button-concierge-picker-otc-pharmacy"));

    expect(await screen.findByTestId("panel-concierge-service-setup")).toHaveTextContent("Add trusted provider");
    expect(screen.queryByTestId("button-concierge-setup-address")).not.toBeInTheDocument();
  });
});
