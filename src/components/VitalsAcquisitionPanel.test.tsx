import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/queryClient";
import { VitalsAcquisitionPanel } from "./VitalsAcquisitionPanel";

vi.mock("@/lib/queryClient", () => ({ apiFetch: vi.fn() }));

const apiFetchMock = vi.mocked(apiFetch);

afterEach(() => {
  cleanup();
  apiFetchMock.mockReset();
});

describe("VitalsAcquisitionPanel", () => {
  it("automatically discloses and applies a matching current device reading", async () => {
    const onApply = vi.fn();
    const recordedAt = new Date(Date.now() - 8 * 60 * 1000).toISOString();
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({
      readings: [{
        signalType: "oxygen_saturation",
        value: 97,
        unit: "%",
        recordedAt,
        source: "connected_device",
        captureMethod: "web_bluetooth",
        confidence: "high",
        qualityFlag: "clean",
        sourceRef: { device_name: "Oximeter" },
        freshness: "current",
      }],
      signals: [{
        signal_type: "oxygen_saturation",
        current_reading: null,
        compatible_methods: ["web_bluetooth", "device_photo", "voice", "manual"],
      }],
      devices: [],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<VitalsAcquisitionPanel actions={[{ id: "oxygen", label: "Oxygen" }]} onApply={onApply} />);

    expect(await screen.findByText(/Using Oxygen 97%/)).toBeInTheDocument();
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ oxygenSaturation: 97 }),
      expect.stringMatching(/Oximeter.*8 min ago/),
      true,
      "connected_device",
    ));
  });

  it("shows only acquisition methods compatible with the requested signal", async () => {
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({
      readings: [],
      signals: [{
        signal_type: "temperature_c",
        current_reading: null,
        compatible_methods: ["web_bluetooth", "device_photo", "voice", "manual"],
      }],
      devices: [],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    render(<VitalsAcquisitionPanel actions={[{ id: "temperature", label: "Temperature" }]} onApply={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Temperature" }));

    expect(await screen.findByRole("button", { name: "Bluetooth device" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Scan device screen" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Speak reading" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Type reading" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Camera scan" })).not.toBeInTheDocument();
  });
});
