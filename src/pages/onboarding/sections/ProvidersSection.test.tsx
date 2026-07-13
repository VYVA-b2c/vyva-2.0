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
    fireEvent.change(screen.getByTestId("input-manual-notes"), {
      target: { value: "Use for morning rides." },
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
      notes: "Use for morning rides.",
    });
  });

  it("opens a Concierge provider prefill in the manual form and returns after saving", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    renderProvidersSection({
      returnTo: "/concierge",
      setupFocus: "doctor_clinic",
      setupReason: "Save provider from Concierge",
      notice: "Save this as a trusted provider. VYVA will still ask before contacting them.",
      providerPrefill: {
        name: "Marbella Care Clinic",
        category: "personal_care",
        phone: "+34 600 111 222",
        email: "hello@care.example",
        whatsapp: "+34 600 333 444",
        booking_url: "https://care.example/book",
        preferred_channel: "whatsapp",
        notes: "Nearby, Good reputation, Easy access",
      },
    });

    expect(screen.getByTestId("filter-personal_care")).toHaveClass("bg-vyva-purple");
    expect(screen.getByTestId("notice-provider-focused-setup")).toHaveTextContent("Save this as a trusted provider");
    expect(await screen.findByTestId("form-provider-manual")).toBeInTheDocument();
    expect(screen.getByTestId("input-manual-name")).toHaveValue("Marbella Care Clinic");
    expect(screen.getByTestId("input-manual-phone")).toHaveValue("+34 600 111 222");
    expect(screen.getByTestId("input-manual-email")).toHaveValue("hello@care.example");
    expect(screen.getByTestId("input-manual-whatsapp")).toHaveValue("+34 600 333 444");
    expect(screen.getByTestId("input-manual-booking-url")).toHaveValue("https://care.example/book");
    expect(screen.getByTestId("input-manual-notes")).toHaveValue("Nearby, Good reputation, Easy access");
    expect(screen.getByTestId("button-manual-channel-whatsapp")).toHaveClass("bg-vyva-purple");

    fireEvent.click(screen.getByTestId("button-manual-add"));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    const [, init] = apiFetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));

    expect(body.providers[0]).toMatchObject({
      name: "Marbella Care Clinic",
      role: "personal_care",
      phone: "+34 600 111 222",
      email: "hello@care.example",
      whatsapp: "+34 600 333 444",
      booking_url: "https://care.example/book",
      preferred_channel: "whatsapp",
      notes: "Nearby, Good reputation, Easy access",
    });
    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith("/concierge", expect.objectContaining({
        state: {
          trustedProviderSaved: {
            name: "Marbella Care Clinic",
            category: "personal_care",
          },
        },
      }));
    });
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Provider saved",
    }));
  });
});
