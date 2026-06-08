import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import PwaInstallPrompt from "./PwaInstallPrompt";

type TestBeforeInstallPromptEvent = Event & {
  prompt: ReturnType<typeof vi.fn>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function clearPromptStorage() {
  window.localStorage.removeItem("vyva-pwa-install-dismissed");
}

function dispatchInstallPrompt() {
  const event = new Event("beforeinstallprompt") as TestBeforeInstallPromptEvent;
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe("PwaInstallPrompt", () => {
  beforeEach(() => {
    clearPromptStorage();
    vi.restoreAllMocks();
  });

  it("shows the browser install action after the install prompt event", async () => {
    render(<PwaInstallPrompt />);
    const event = dispatchInstallPrompt();

    expect(await screen.findByText("Add VYVA to this device")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Install" }));

    await waitFor(() => expect(event.prompt).toHaveBeenCalledTimes(1));
  });

  it("shows iOS Home Screen guidance when browser install prompting is unavailable", async () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    render(<PwaInstallPrompt />);

    expect(await screen.findByText("In Safari, use Share, then Add to Home Screen.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));

    expect(window.localStorage.getItem("vyva-pwa-install-dismissed")).toBe("1");
  });
});
