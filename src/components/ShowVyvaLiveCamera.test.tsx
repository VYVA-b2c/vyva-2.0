import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ShowVyvaLiveCamera, { supportsShowVyvaLiveCamera } from "./ShowVyvaLiveCamera";
import { SHOW_VYVA_USE_CASE_IDS } from "../../shared/showVyvaFlow";

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  return {
    ...original,
    useTranslation: () => ({
      t: (key: string, fallback?: string) => typeof fallback === "string" ? fallback : key,
    }),
  };
});

const createClearFrame = () => {
  const width = 180;
  const height = 135;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = ((y * width) + x) * 4;
      const value = (x + y) % 2 === 0 ? 92 : 176;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return data;
};

describe("ShowVyvaLiveCamera", () => {
  const stopTrack = vi.fn();
  const getUserMedia = vi.fn();
  const context = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: createClearFrame() })),
    translate: vi.fn(),
    rotate: vi.fn(),
  };

  beforeEach(() => {
    stopTrack.mockReset();
    getUserMedia.mockReset();
    getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
      configurable: true,
      get: () => 1280,
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
      configurable: true,
      get: () => 960,
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["photo"], { type: "image/jpeg" }));
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const renderCamera = (overrides: Partial<React.ComponentProps<typeof ShowVyvaLiveCamera>> = {}) => {
    const props: React.ComponentProps<typeof ShowVyvaLiveCamera> = {
      useCaseId: SHOW_VYVA_USE_CASE_IDS.documentHelp,
      onCapture: vi.fn(),
      onUseDeviceCamera: vi.fn(),
      onUpload: vi.fn(),
      onCancel: vi.fn(),
      ...overrides,
    };
    render(<ShowVyvaLiveCamera {...props} />);
    return props;
  };

  it("opens the rear-facing camera and keeps a manual shutter available", async () => {
    const props = renderCamera();
    const shutter = screen.getByTestId("button-show-vyva-live-shutter");
    await waitFor(() => expect(shutter).toBeEnabled());

    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({
      audio: false,
      video: expect.objectContaining({ facingMode: { ideal: "environment" } }),
    }));
    fireEvent.click(shutter);

    await waitFor(() => expect(props.onCapture).toHaveBeenCalledTimes(1));
    expect(props.onCapture).toHaveBeenCalledWith(expect.objectContaining({ type: "image/jpeg" }));
    expect(stopTrack).toHaveBeenCalled();
  });

  it("captures automatically after a stable frame and gentle countdown", async () => {
    vi.useFakeTimers();
    const props = renderCamera();
    await act(async () => Promise.resolve());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_200);
    });
    expect(screen.getByTestId("text-show-vyva-live-countdown")).toHaveTextContent("3");

    for (let second = 0; second < 3; second += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_050);
      });
    }
    expect(props.onCapture).toHaveBeenCalledTimes(1);
    expect(stopTrack).toHaveBeenCalled();
  });

  it("stops the camera when the user cancels", async () => {
    const props = renderCamera();
    await waitFor(() => expect(screen.getByTestId("button-show-vyva-live-shutter")).toBeEnabled());
    fireEvent.click(screen.getByTestId("button-show-vyva-live-cancel"));
    expect(stopTrack).toHaveBeenCalled();
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it("offers the existing device camera and upload paths when guided access fails", async () => {
    getUserMedia.mockRejectedValueOnce(new Error("permission_denied"));
    const props = renderCamera();
    expect(await screen.findByTestId("dialog-show-vyva-camera-fallback")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-show-vyva-device-camera"));
    fireEvent.click(screen.getByTestId("button-show-vyva-camera-upload-fallback"));
    expect(props.onUseDeviceCamera).toHaveBeenCalledTimes(1);
    expect(props.onUpload).toHaveBeenCalledTimes(1);
  });

  it("reports unsupported browsers so pages can keep the native capture flow", () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
    expect(supportsShowVyvaLiveCamera()).toBe(false);
  });
});
