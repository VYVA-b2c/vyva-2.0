import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProvidersSection from "./ProvidersSection";
import { apiFetch } from "@/lib/queryClient";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  invalidateQueries: vi.fn(),
  navigate: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryClient")>("@/lib/queryClient");
  return {
    ...actual,
    apiFetch: mocks.apiFetch,
    queryClient: { invalidateQueries: mocks.invalidateQueries },
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

const apiFetchMock = vi.mocked(apiFetch);

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function renderProvidersSection(state: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async () => ({
          profile: {
            data_sharing_consent: {
              providers: { providers: [] },
            },
          },
        }),
      },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: "/onboarding/profile/providers", state }]}>
        <ProvidersSection />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("ProvidersSection trusted provider setup", () => {
  it("opens focused on the requested provider category", () => {
    renderProvidersSection({ setupFocus: "transport", setupReason: "Add a saved transport provider" });

    expect(screen.getAllByText("Trusted providers").length).toBeGreaterThan(0);
    expect(screen.getByTestId("filter-transport")).toHaveClass("bg-vyva-purple");
    expect(screen.getByPlaceholderText("Search Transport / Taxi...")).toBeInTheDocument();
  });

  it("saves manual provider readiness fields", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    renderProvidersSection({ setupFocus: "transport" });

    fireEvent.click(screen.getByTestId("button-add-manually"));
    fireEvent.change(await screen.findByTestId("input-manual-name"), {
      target: { value: "Trusted Taxi" },
    });
    fireEvent.change(screen.getByTestId("input-manual-phone"), {
      target: { value: "+34 600 111 222" },
    });
    fireEvent.change(screen.getByTestId("input-manual-email"), {
      target: { value: "bookings@trustedtaxi.example" },
    });
    fireEvent.change(screen.getByTestId("input-manual-whatsapp"), {
      target: { value: "+34 600 333 444" },
    });
    fireEvent.change(screen.getByTestId("input-manual-booking-url"), {
      target: { value: "https://trustedtaxi.example/book" },
    });
    fireEvent.click(screen.getByTestId("button-manual-channel-whatsapp"));
    fireEvent.click(screen.getByTestId("button-manual-add"));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    const [, init] = apiFetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));

    expect(body.providers[0]).toMatchObject({
      name: "Trusted Taxi",
      role: "transport",
      phone: "+34 600 111 222",
      email: "bookings@trustedtaxi.example",
      whatsapp: "+34 600 333 444",
      booking_url: "https://trustedtaxi.example/book",
      preferred_channel: "whatsapp",
      can_contact_after_confirmation: true,
    });
  });
});
