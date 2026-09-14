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

function renderProvidersSection(
  state: Record<string, unknown> = {},
  savedProviders: Array<Record<string, unknown>> = [],
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async () => ({
          profile: {
            data_sharing_consent: {
              providers: { providers: savedProviders },
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
    fireEvent.change(screen.getByTestId("input-manual-website"), {
      target: { value: "https://trustedtaxi.example" },
    });
    fireEvent.change(screen.getByTestId("input-manual-notes"), {
      target: { value: "Use for morning rides." },
    });
    fireEvent.click(screen.getByTestId("button-manual-channel-whatsapp"));
    fireEvent.click(screen.getByTestId("button-manual-add"));

    expect(apiFetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("button-providers-save"));

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
      website_uri: "https://trustedtaxi.example",
      preferred_channel: "whatsapp",
      can_contact_after_confirmation: true,
      notes: "Use for morning rides.",
      is_trusted: true,
      is_default: true,
    });
  });

  it("sets one trusted provider as the category default", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    renderProvidersSection({ setupFocus: "transport" }, [
      { name: "First Taxi", role: "transport", phone: "+34 600 111 111", is_trusted: true, is_default: true },
      { name: "Second Taxi", role: "transport", phone: "+34 600 222 222", is_trusted: true, is_default: false },
    ]);

    fireEvent.click(await screen.findByTestId("button-provider-default-provider-2"));

    expect(apiFetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("button-providers-save"));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    const [, init] = apiFetchMock.mock.calls.at(-1)!;
    const body = JSON.parse(String(init?.body));
    expect(body.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "First Taxi", is_default: false }),
      expect.objectContaining({ name: "Second Taxi", is_default: true }),
    ]));
    expect(screen.getByTestId("item-provider-provider-2")).toHaveTextContent("Default");
  });

  it("shows the default provider Concierge will use for the selected category", async () => {
    renderProvidersSection({ setupFocus: "transport" }, [
      { name: "Trusted Taxi", role: "transport", phone: "+34 600 111 111", is_trusted: true, is_default: true },
    ]);

    const summary = await screen.findByTestId("provider-concierge-default-summary");
    await waitFor(() => expect(summary).toHaveTextContent("Concierge will use Trusted Taxi"));
    expect(summary).toHaveTextContent("Phone");
    expect(summary).toHaveTextContent("VYVA still asks before calling, sending, or booking.");
  });

  it("keeps the default summary actionable when a saved provider needs contact details", async () => {
    renderProvidersSection({ setupFocus: "doctor_clinic" }, [
      { name: "Trusted Clinic", role: "doctor_clinic", is_trusted: true, is_default: true },
    ]);

    const summary = await screen.findByTestId("provider-concierge-default-summary");
    await waitFor(() => expect(summary).toHaveTextContent("Add a phone, email, WhatsApp, website, or booking link"));
    expect(summary).toHaveTextContent("No ready default doctor / clinic yet");
  });

  it("explains the missing-provider setup path before any provider is saved", async () => {
    renderProvidersSection({ setupFocus: "home_service" });

    const summary = await screen.findByTestId("provider-concierge-default-summary");
    expect(summary).toHaveTextContent("No ready default home service yet");
    expect(summary).toHaveTextContent("Choose a saved home service as default, or add one below.");
  });

  it("lets Concierge continue with an existing trusted provider", async () => {
    renderProvidersSection({
      setupFocus: "doctor_clinic",
      returnTo: "/concierge",
      conciergeResume: { kind: "medical_appointment" },
    }, [
      { name: "Trusted Clinic", role: "doctor_clinic", email: "frontdesk@example.com", is_trusted: true, is_default: true },
    ]);

    fireEvent.click(await screen.findByTestId("button-provider-use-provider-1"));

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/concierge", expect.objectContaining({
      state: expect.objectContaining({
        trustedProviderSaved: expect.objectContaining({
          name: "Trusted Clinic",
          category: "doctor_clinic",
        }),
      }),
    })));
  });

  it("asks for contact details before Concierge can use a saved provider", async () => {
    renderProvidersSection({
      setupFocus: "doctor_clinic",
      returnTo: "/concierge",
      conciergeResume: { kind: "medical_appointment" },
    }, [
      { name: "Clinic without contact", role: "doctor_clinic", is_trusted: true, is_default: true },
    ]);

    await screen.findByTestId("button-provider-edit-contact-provider-1");
    expect(screen.getAllByText("Add contact").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("button-provider-use-provider-1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-provider-edit-contact-provider-1"));
    expect(screen.getByTestId("sheet-merchant-detail")).toBeInTheDocument();
  });

  it("edits provider identity, service type, website, and notes", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    renderProvidersSection({ setupFocus: "transport" }, [
      { name: "Old Provider", role: "transport", is_trusted: true, is_default: true },
    ]);

    fireEvent.click(await screen.findByTestId("button-providers-edit-provider-1"));
    fireEvent.change(screen.getByTestId("input-merchant-name"), { target: { value: "Neighbourhood Pharmacy" } });
    fireEvent.change(screen.getByTestId("select-merchant-category"), { target: { value: "pharmacy" } });
    fireEvent.change(screen.getByTestId("input-merchant-website"), { target: { value: "https://pharmacy.example" } });
    fireEvent.mouseDown(screen.getByTestId("tab-merchant-preferences"), { button: 0, ctrlKey: false });
    fireEvent.change(await screen.findByTestId("input-merchant-notes"), { target: { value: "Ask for the pharmacist." } });
    fireEvent.click(screen.getByTestId("button-merchant-save"));

    expect(apiFetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("button-providers-save"));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    const [, init] = apiFetchMock.mock.calls.at(-1)!;
    const body = JSON.parse(String(init?.body));
    expect(body.providers[0]).toMatchObject({
      name: "Neighbourhood Pharmacy",
      role: "pharmacy",
      website_uri: "https://pharmacy.example",
      notes: "Ask for the pharmacist.",
      is_trusted: true,
      is_default: true,
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
      conciergeResume: {
        kind: "provider_search",
        mode: "personal-care",
        query: "nearby care",
        criteria: ["nearby", "reputation"],
      },
      returnState: {
        homeFastHelpContext: { journeyId: "journey-1", actionId: "find-care" },
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

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("button-providers-save"));

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
        state: expect.objectContaining({
          homeFastHelpContext: { journeyId: "journey-1", actionId: "find-care" },
          trustedProviderSaved: expect.objectContaining({
            name: "Marbella Care Clinic",
            category: "personal_care",
            conciergeResume: {
              kind: "provider_search",
              mode: "personal-care",
              query: "nearby care",
              criteria: ["nearby", "reputation"],
            },
          }),
        }),
      }));
    });
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Provider saved",
    }));
  });
});
