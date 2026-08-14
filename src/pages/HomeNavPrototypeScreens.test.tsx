import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  PrototypeBrainScreen,
  PrototypeCheckInScreen,
  PrototypeCommunityScreen,
  PrototypeConciergeScreen,
  PrototypeHealthScreen,
  PrototypeHomeScreen,
  PrototypeProfileScreen,
  PrototypeReportsScreen,
} from "./HomeNavPrototypeScreens";
import { VYVA_OPEN_SOS_EVENT } from "@/lib/sosEvents";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({
    firstName: "Karim",
    profile: {
      firstName: "Karim",
      lastName: "",
      cityState: "Tarifa",
      country: "Spain",
    },
  }),
}));

function renderScreen(ui: React.ReactElement) {
  navigateMock.mockClear();
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {ui}
    </MemoryRouter>,
  );
}

describe("Home/Nav prototype screens", () => {
  it("renders the Home companion presence with profile, date, menu, orb, and moment feed", () => {
    renderScreen(<PrototypeHomeScreen />);

    expect(screen.getByTestId("home-master-layout")).toBeInTheDocument();
    expect(screen.getByTestId("button-home-profile")).toBeInTheDocument();
    expect(screen.getByTestId("button-home-menu")).toBeInTheDocument();
    expect(screen.getByTestId("home-dormant-zamora-orb-visual")).toHaveAttribute("data-orb-state", "idle");
    expect(screen.getByText(/Good morning|Good afternoon|Good evening/)).toHaveTextContent("Karim");
    expect(screen.getByText("Tap the circle to talk")).toBeInTheDocument();
  });

  it("renders all five destination surfaces with the compact orb detail pattern", () => {
    const cases = [
      [<PrototypeHealthScreen key="health" />, "Health", "Right where it usually is"],
      [<PrototypeBrainScreen key="brain" />, "My Brain", "Five days strong"],
      [<PrototypeCommunityScreen key="community" />, "Community", "Elena replied"],
      [<PrototypeConciergeScreen key="concierge" />, "Concierge", "Your ride to Dr. Reyes"],
      [<PrototypeReportsScreen key="reports" />, "My Reports", "A good week"],
    ] as const;

    for (const [ui, title, copy] of cases) {
      const { unmount } = renderScreen(ui);
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
      expect(screen.getByText(new RegExp(copy))).toBeInTheDocument();
      expect(screen.getByText("Tap to ask VYVA")).toBeInTheDocument();
      unmount();
    }
  });

  it("routes the Health quick check-in row to the preventive check-in UI", () => {
    renderScreen(<PrototypeHealthScreen />);

    expect(screen.getByText("Heart rate")).toBeInTheDocument();
    expect(screen.getByText("72 bpm")).toBeInTheDocument();
    expect(screen.getByText("Oxygen")).toBeInTheDocument();
    expect(screen.getByText("97%")).toBeInTheDocument();
    expect(screen.getByText("Health signals — this week")).toBeInTheDocument();
    expect(screen.queryByText("Blood pressure")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show 2 more metrics/i }));
    expect(screen.getByText("Blood pressure")).toBeInTheDocument();
    expect(screen.getByText("Rest pattern")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-health-quick-checkin"));

    expect(navigateMock).toHaveBeenCalledWith("/health/check-in");
  });

  it("renders the Brain and Reports trend/detail rows from the reference brief", () => {
    const brain = renderScreen(<PrototypeBrainScreen />);
    expect(screen.getByText("Rhythm Tap accuracy")).toBeInTheDocument();
    brain.unmount();

    renderScreen(<PrototypeReportsScreen />);
    expect(screen.getByText("Appointments kept")).toBeInTheDocument();
    expect(screen.getByText("2/2")).toBeInTheDocument();
  });

  it("renders Profile as a peer surface with caregiver visibility and accessibility rows", () => {
    renderScreen(<PrototypeProfileScreen />);

    expect(screen.getByRole("heading", { name: "My Profile" })).toBeInTheDocument();
    expect(screen.getByText("Who’s looking out for you")).toBeInTheDocument();
    expect(screen.getByText("Sofía — daughter")).toBeInTheDocument();
    expect(screen.getByText("Reminder gentleness")).toBeInTheDocument();
    expect(screen.getByText("Make VYVA easier to use")).toBeInTheDocument();
  });

  it("skips the follow-up question when the first answer is Great or Okay", () => {
    renderScreen(<PrototypeCheckInScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Okay" }));

    expect(screen.getByTestId("prototype-checkin-summary")).toBeInTheDocument();
    expect(screen.getByText("Feeling today")).toBeInTheDocument();
    expect(screen.getByText("Okay")).toBeInTheDocument();
    expect(screen.queryByText("A little more")).not.toBeInTheDocument();
  });

  it("renders the storyboard follow-up path, summary and safety interruption", () => {
    const sosEvents: Event[] = [];
    const handler = (event: Event) => sosEvents.push(event);
    window.addEventListener(VYVA_OPEN_SOS_EVENT, handler);
    renderScreen(<PrototypeCheckInScreen />);

    expect(screen.getByTestId("prototype-checkin-question")).toHaveAttribute("data-question-id", "feeling");
    expect(screen.getByTestId("button-checkin-urgent-escape")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Great" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Okay" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not my best" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Something's bothering me" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Good" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Low energy" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Something's bothering me" }));
    expect(screen.getByTestId("prototype-checkin-question")).toHaveAttribute("data-question-id", "detail");
    expect(screen.getByRole("button", { name: "Tired or low energy" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Breathing feels harder" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aches or discomfort" }));
    expect(screen.getByTestId("prototype-checkin-summary")).toBeInTheDocument();
    expect(screen.getByText("Here’s what you told VYVA.")).toBeInTheDocument();
    expect(screen.getByText("Feeling today")).toBeInTheDocument();
    expect(screen.getByText("A little more")).toBeInTheDocument();

    window.removeEventListener(VYVA_OPEN_SOS_EVENT, handler);
  });

  it("opens the existing SOS pathway from the check-in safety state and can resume", () => {
    const sosEvents: Event[] = [];
    const handler = (event: Event) => sosEvents.push(event);
    window.addEventListener(VYVA_OPEN_SOS_EVENT, handler);
    renderScreen(<PrototypeCheckInScreen />);

    fireEvent.click(screen.getByTestId("button-checkin-urgent-escape"));
    expect(screen.getByTestId("prototype-checkin-safety")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-checkin-safety-sos"));
    expect(sosEvents).toHaveLength(1);
    fireEvent.click(screen.getByTestId("button-checkin-safety-resume"));
    expect(screen.getByTestId("prototype-checkin-question")).toHaveAttribute("data-question-id", "feeling");

    window.removeEventListener(VYVA_OPEN_SOS_EVENT, handler);
  });
});
