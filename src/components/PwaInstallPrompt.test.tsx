import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { setLanguage } from "@/i18n";
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
    vi.restoreAllMocks();
    clearPromptStorage();
    setLanguage("en");
  });

  it("shows the browser install action after the install prompt event", async () => {
    render(<PwaInstallPrompt />);
    const event = dispatchInstallPrompt();

    expect(await screen.findByText("Keep VYVA easy to find")).toBeInTheDocument();
    expect(screen.getByText("Add VYVA to your desktop, dock, or app launcher.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add VYVA" }));

    await waitFor(() => expect(event.prompt).toHaveBeenCalledTimes(1));
  });

  it("shows iOS Home Screen guidance when browser install prompting is unavailable", async () => {
    setLanguage("es");
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    render(<PwaInstallPrompt />);

    expect(await screen.findByText("Ten VYVA siempre a mano")).toBeInTheDocument();
    expect(screen.getByText("En Safari, toca Compartir y luego Añadir a pantalla de inicio.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Entendido" }));

    expect(window.localStorage.getItem("vyva-pwa-install-dismissed")).toBe("1");
  });
});
