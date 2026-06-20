import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import HealthDevicesSettings from "./HealthDevicesSettings";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryClient")>("@/lib/queryClient");
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

vi.mock("@/components/onboarding/PhoneFrame", () => ({
  PhoneFrame: ({ children }: { children: React.ReactNode }) => <div data-testid="phone-frame">{children}</div>,
}));

vi.mock("@/components/onboarding/ProfileSectionHero", () => ({
  ProfileSectionHero: ({ title }: { title: string }) => <header data-testid="settings-hero">{title}</header>,
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    t: (_key: string, fallback?: string | Record<string, unknown>) => {
      if (typeof fallback === "string") return fallback;
      if (fallback && typeof fallback.defaultValue === "string") {
        let value = fallback.defaultValue;
        for (const [key, replacement] of Object.entries(fallback)) {
          if (key !== "defaultValue") value = value.replace(`{{${key}}}`, String(replacement));
        }
        return value;
      }
      return _key;
    },
  }),
}));

const apiFetchMock = vi.mocked(apiFetch);

function renderHealthDevices() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          if (queryKey[0] === "/api/settings/health-devices") return { devices: [] };
          return {};
        },
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/settings/health-devices"]}>
        <Routes>
          <Route path="/settings/health-devices" element={<HealthDevicesSettings />} />
          <Route path="/health/vitals" element={<div data-testid="vitals-route">Vitals</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  apiFetchMock.mockReset();
  Object.defineProperty(navigator, "bluetooth", { configurable: true, value: undefined });
});

describe("HealthDevicesSettings", () => {
  it("renders all supported home device setup cards", () => {
    renderHealthDevices();

    expect(screen.getByTestId("health-devices-settings")).toBeInTheDocument();
    expect(screen.getByTestId("device-settings-card-bp_cuff")).toHaveTextContent("Blood pressure cuff");
    expect(screen.getByTestId("device-settings-card-pulse_oximeter")).toHaveTextContent("Pulse oximeter");
    expect(screen.getByTestId("device-settings-card-thermometer")).toHaveTextContent("Thermometer");
    expect(screen.getByTestId("device-settings-card-glucose_meter")).toHaveTextContent("Glucose meter / CGM");
    expect(screen.getByTestId("device-settings-card-weight_scale")).toHaveTextContent("Weight scale");
    expect(screen.getByTestId("device-settings-card-heart_monitor")).toHaveTextContent("Heart-rate strap / BLE monitor");
  });

  it("routes unsupported Bluetooth users back to Vitals fallbacks", async () => {
    renderHealthDevices();

    fireEvent.click(screen.getByTestId("button-health-device-setup-bp_cuff"));

    expect(await screen.findByTestId("health-device-state-unsupported")).toHaveTextContent("Bluetooth setup is not available");
    fireEvent.click(screen.getByTestId("button-health-device-open-vitals-from-modal"));

    expect(await screen.findByTestId("vitals-route")).toBeInTheDocument();
  });

  it("marks a standard Bluetooth heart monitor as ready after a test reading", async () => {
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({
      devices: [{
        id: "heart_monitor",
        deviceName: "Test heart strap",
        connectedAt: "2026-06-20T10:00:00.000Z",
        method: "web_bluetooth",
        status: "ready",
      }],
    }), { status: 201, headers: { "Content-Type": "application/json" } }));
    const value = new DataView(Uint8Array.from([0x00, 72]).buffer);
    Object.defineProperty(navigator, "bluetooth", {
      configurable: true,
      value: {
        requestDevice: vi.fn(async () => ({
          id: "heart-monitor-1",
          name: "Test heart strap",
          gatt: {
            connect: vi.fn(async () => ({
              getPrimaryService: vi.fn(async () => ({
                getCharacteristic: vi.fn(async () => ({
                  readValue: vi.fn(async () => value),
                })),
              })),
            })),
          },
        })),
      },
    });

    renderHealthDevices();

    fireEvent.click(screen.getByTestId("button-health-device-setup-heart_monitor"));
    fireEvent.click(await screen.findByTestId("button-health-device-start-bluetooth"));

    expect(await screen.findByText(/Pulse: 72 bpm/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-health-device-mark-ready"));

    await waitFor(() => {
      expect(screen.getByTestId("health-device-status-heart_monitor")).toHaveTextContent("Ready");
      expect(apiFetchMock).toHaveBeenCalledWith("/api/settings/health-devices", expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"id":"heart_monitor"'),
      }));
    });
  });
});
