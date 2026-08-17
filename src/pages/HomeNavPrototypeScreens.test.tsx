import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  initialPrototypeCheckInFlowState,
  normalizePrototypeCheckInAnswer,
  PrototypeBrainScreen,
  PrototypeCheckInScreen,
  PrototypeCommunityScreen,
  PrototypeConciergeScreen,
  PrototypeHealthActionPreviewScreen,
  PrototypeHealthScreen,
  PrototypeHomeScreen,
  PrototypeMenuScreen,
  PrototypeProfileActionPreviewScreen,
  PrototypeProfileScreen,
  PrototypeReportsScreen,
  PrototypeSymptomReportPreviewScreen,
  submitPrototypeCheckInAnswer,
} from "./HomeNavPrototypeScreens";
import { VYVA_OPEN_SOS_EVENT } from "@/lib/sosEvents";
import { HOME_MASTER_THEME_STORAGE_KEY } from "@/hooks/useHomeMasterTheme";
import { READABLE_TEXT_SIZE_STORAGE_KEY } from "@/hooks/useReadableTextSize";
import { VYVA_HOME_INTERACTION_MODE_STORAGE_KEY } from "@/lib/homeModeControl";

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
  afterEach(() => {
    window.localStorage.removeItem(HOME_MASTER_THEME_STORAGE_KEY);
    window.localStorage.removeItem(READABLE_TEXT_SIZE_STORAGE_KEY);
    window.localStorage.removeItem(VYVA_HOME_INTERACTION_MODE_STORAGE_KEY);
  });

  it("renders the Home companion presence with profile/settings, manual menu, orb, and moment feed", () => {
    renderScreen(<PrototypeHomeScreen />);

    expect(screen.getByTestId("home-master-layout")).toBeInTheDocument();
    expect(screen.getByTestId("button-home-profile")).toBeInTheDocument();
    expect(screen.getByTestId("home-topbar-action-pill")).toBeInTheDocument();
    expect(screen.getByTestId("button-home-mode-touch")).toBeInTheDocument();
    expect(screen.getByTestId("home-dormant-zamora-orb-visual")).toHaveAttribute("data-orb-state", "idle");
    expect(screen.getByText(/Good morning|Good afternoon|Good evening/)).toHaveTextContent("Karim");
    expect(screen.getByText("Tap the circle to talk")).toBeInTheDocument();
  });

  it("hides the Home rotating moment while VYVA is actively listening or responding", async () => {
    renderScreen(<PrototypeHomeScreen />);

    expect(screen.getByTestId("home-rotating-moment")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("home-dormant-zamora-orb-visual"));

    await waitFor(() => {
      expect(screen.queryByTestId("home-rotating-moment")).not.toBeInTheDocument();
    });
  });

  it("renders Menu as the approved four-tile manual hub", () => {
    renderScreen(<PrototypeMenuScreen />);

    expect(screen.getByTestId("prototype-menu-screen")).toBeInTheDocument();
    expect(within(screen.getByTestId("menu-tile-grid")).getAllByRole("button")).toHaveLength(4);
    expect(screen.getByTestId("button-home-profile")).toBeInTheDocument();
    expect(screen.getByTestId("button-compact-voice")).toBeInTheDocument();
    expect(screen.getAllByTestId(/card-home-agent-/)).toHaveLength(4);
    expect(screen.getByText("My Health")).toBeInTheDocument();
    expect(screen.getByText("Check-ins, vitals, medicines")).toBeInTheDocument();
    expect(screen.getByText("My Brain")).toBeInTheDocument();
    expect(screen.getByText("Community")).toBeInTheDocument();
    expect(screen.getByText("Concierge")).toBeInTheDocument();
    expect(screen.queryByText("Reports")).not.toBeInTheDocument();
  });

  it("switches from manual Menu back to the voice Home surface when compact mic is tapped", () => {
    window.localStorage.setItem(VYVA_HOME_INTERACTION_MODE_STORAGE_KEY, "touch");
    renderScreen(<PrototypeMenuScreen />);

    fireEvent.click(screen.getByTestId("button-compact-voice"));

    expect(window.localStorage.getItem(VYVA_HOME_INTERACTION_MODE_STORAGE_KEY)).toBe("voice");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master");
  });

  it("marks the manual Menu as Touch so the shared Home dock preserves it", async () => {
    renderScreen(<PrototypeMenuScreen />);

    await waitFor(() => {
      expect(window.localStorage.getItem(VYVA_HOME_INTERACTION_MODE_STORAGE_KEY)).toBe("touch");
    });
  });

  it("persists Touch before the Home hand opens the manual Menu", () => {
    renderScreen(<PrototypeHomeScreen />);

    fireEvent.click(screen.getByTestId("button-home-mode-touch"));

    expect(window.localStorage.getItem(VYVA_HOME_INTERACTION_MODE_STORAGE_KEY)).toBe("touch");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/menu");
  });

  it("renders the non-Health destination surfaces with the shared peer-screen controls and row grammar", () => {
    const cases = [
      [<PrototypeBrainScreen key="brain" />, "My Brain", "Rhythm Tap", "Rhythm Tap — this week"],
      [<PrototypeCommunityScreen key="community" />, "Community", "Book Club", "Elena: I loved"],
      [<PrototypeConciergeScreen key="concierge" />, "Concierge", "Ride to Dr. Reyes", "Confirmed for tomorrow"],
      [<PrototypeReportsScreen key="reports" />, "My Reports", "Steps", "Appointments kept"],
    ] as const;

    for (const [ui, title, row, note] of cases) {
      const { unmount } = renderScreen(ui);
      expect(screen.getAllByRole("heading", { name: title }).length).toBeGreaterThan(0);
      expect(screen.getByTestId("button-prototype-back")).toBeInTheDocument();
      expect(screen.getByTestId("button-compact-voice")).toBeInTheDocument();
      expect(screen.queryByText("Ask VYVA")).not.toBeInTheDocument();
      expect(screen.getByText(row)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(note))).toBeInTheDocument();
      unmount();
    }
  });

  it("switches destination screens back to the voice Home surface when compact mic is tapped", () => {
    renderScreen(<PrototypeBrainScreen />);

    fireEvent.click(screen.getByTestId("button-compact-voice"));

    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master");
  });

  it("renders Health as a calm row-based detail surface with check-in and symptom report separated", () => {
    renderScreen(<PrototypeHealthScreen />);

    expect(screen.getByTestId("button-home-profile")).toBeInTheDocument();
    expect(screen.getByTestId("button-compact-voice")).toBeInTheDocument();
    expect(screen.getByTestId("button-health-plan")).toHaveClass("bg-white");
    expect(screen.queryByTestId("prototype-health-orb")).not.toBeInTheDocument();
    expect(screen.queryByText("Ask VYVA")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Health" })).not.toBeInTheDocument();
    expect(screen.getByText("Health Plan")).toBeInTheDocument();
    expect(screen.getByText("Preventive steps and guidance")).toBeInTheDocument();
    expect(screen.getByText("Symptom Check")).toBeInTheDocument();
    expect(screen.getByText("Aches, discomfort, or changes")).toBeInTheDocument();
    expect(screen.getByText("Vitals Scan")).toBeInTheDocument();
    expect(screen.getByText("Latest readings and trends")).toBeInTheDocument();
    expect(screen.getByText("Medicines")).toBeInTheDocument();
    expect(screen.getByText("Dose times and reminders")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("72 bpm")).toBeInTheDocument();
    expect(screen.getByText("2:00 PM")).toBeInTheDocument();
    expect(screen.queryByText("Heart rate — this week")).not.toBeInTheDocument();
    expect(screen.queryByText("Heart rate")).not.toBeInTheDocument();
    expect(screen.queryByText("Blood pressure")).not.toBeInTheDocument();
  });

  it("switches from Health back to the voice Home surface when compact mic is tapped", () => {
    renderScreen(<PrototypeHealthScreen />);

    fireEvent.click(screen.getByTestId("button-compact-voice"));

    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master");
  });

  it("lets the dev Health preview route entry rows to the intended destinations", () => {
    renderScreen(<PrototypeHealthScreen />);

    fireEvent.click(screen.getByTestId("button-health-plan"));
    fireEvent.click(screen.getByTestId("button-health-symptom-report"));
    fireEvent.click(screen.getByTestId("button-health-vitals"));
    fireEvent.click(screen.getByTestId("button-health-medicines"));

    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/health-plan");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/symptom-report");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/vitals");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/medicines");
  });

  it("supports production Health hub destinations and expands its frame on larger screens", () => {
    renderScreen(
      <PrototypeHealthScreen
        healthPlanPath="/health/prevention"
        symptomReportPath="/health/symptom-check"
        vitalsPath="/health/vitals"
        medicinesPath="/meds/my-medicines"
        voicePath="/"
        profilePath="/settings/account"
      />,
    );

    const frame = screen.getByTestId("prototype-health-screen-frame");
    expect(frame).toHaveClass("max-w-[430px]");
    expect(frame).toHaveClass("sm:max-w-[620px]");
    expect(frame).toHaveClass("lg:max-w-[760px]");

    fireEvent.click(screen.getByTestId("button-health-plan"));
    fireEvent.click(screen.getByTestId("button-health-symptom-report"));
    fireEvent.click(screen.getByTestId("button-health-vitals"));
    fireEvent.click(screen.getByTestId("button-health-medicines"));
    fireEvent.click(screen.getByTestId("button-compact-voice"));
    fireEvent.click(screen.getByTestId("button-home-profile"));

    expect(navigateMock).toHaveBeenCalledWith("/health/prevention");
    expect(navigateMock).toHaveBeenCalledWith("/health/symptom-check");
    expect(navigateMock).toHaveBeenCalledWith("/health/vitals");
    expect(navigateMock).toHaveBeenCalledWith("/meds/my-medicines");
    expect(navigateMock).toHaveBeenCalledWith("/");
    expect(navigateMock).toHaveBeenCalledWith("/settings/account");
  });

  it("routes Profile rows to dev-safe preview destinations instead of protected login handoffs", () => {
    renderScreen(<PrototypeProfileScreen />);

    fireEvent.click(screen.getByTestId("button-profile-account"));
    fireEvent.click(screen.getByTestId("button-profile-health"));
    fireEvent.click(screen.getByTestId("button-profile-medicines"));
    fireEvent.click(screen.getByTestId("button-profile-emergency"));
    fireEvent.click(screen.getByTestId("button-profile-care-team"));
    fireEvent.click(screen.getByTestId("button-profile-providers"));
    fireEvent.click(screen.getByTestId("button-profile-accessibility"));

    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/profile/account");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/profile/health");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/profile/medicines");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/profile/emergency");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/profile/care-team");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/profile/providers");
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/profile/preferences");
  });

  it("keeps the large-text profile surface scrollable within the viewport", () => {
    window.localStorage.setItem(READABLE_TEXT_SIZE_STORAGE_KEY, "large");

    renderScreen(<PrototypeProfileScreen />);

    const shell = screen.getByTestId("prototype-profile-screen");
    expect(shell).toHaveAttribute("data-vyva-text-size", "large");
    expect(shell).toHaveClass("h-[100svh]");
    expect(shell).toHaveClass("max-h-[100svh]");
    expect(shell).toHaveClass("overflow-y-auto");
    expect(screen.getByTestId("button-profile-call-support")).toBeInTheDocument();
  });

  it("renders Preferences as a local profile sub-screen with changeable preference rows", () => {
    renderScreen(<PrototypeProfileActionPreviewScreen kind="accessibility" />);

    expect(screen.getByTestId("prototype-profile-action-preview-accessibility")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Preferences" })).toBeInTheDocument();
    expect(screen.getByText("Text size")).toBeInTheDocument();
    expect(screen.getByText("Currently Large")).toBeInTheDocument();
    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByText("Currently Light")).toBeInTheDocument();
    expect(screen.getAllByText("Change")).toHaveLength(2);
  });

  it("lets the Preferences Theme row toggle the local preview theme", async () => {
    window.localStorage.setItem(HOME_MASTER_THEME_STORAGE_KEY, "dark");
    renderScreen(<PrototypeProfileActionPreviewScreen kind="accessibility" />);

    expect(screen.getByTestId("prototype-profile-action-preview-accessibility")).toHaveAttribute("data-home-master-theme", "dark");
    expect(screen.getByText("Currently Dark")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("profile-accessibility-theme"));

    await waitFor(() => {
      expect(screen.getByTestId("prototype-profile-action-preview-accessibility")).toHaveAttribute("data-home-master-theme", "light");
    });
    expect(screen.getByText("Currently Light")).toBeInTheDocument();

    window.localStorage.removeItem(HOME_MASTER_THEME_STORAGE_KEY);
  });

  it("lets the Preferences Text size row toggle the local preview text size", async () => {
    window.localStorage.setItem(READABLE_TEXT_SIZE_STORAGE_KEY, "large");
    renderScreen(<PrototypeProfileActionPreviewScreen kind="accessibility" />);

    expect(screen.getByTestId("prototype-profile-action-preview-accessibility")).toHaveAttribute("data-vyva-text-size", "large");
    expect(screen.getByText("Currently Large")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("profile-accessibility-text-size"));

    await waitFor(() => {
      expect(screen.getByTestId("prototype-profile-action-preview-accessibility")).toHaveAttribute("data-vyva-text-size", "normal");
    });
    expect(screen.getByText("Currently Normal")).toBeInTheDocument();
  });

  it("renders the Brain and Reports trend/detail rows from the reference brief", () => {
    const brain = renderScreen(<PrototypeBrainScreen />);
    expect(screen.getByText("Rhythm Tap — this week")).toBeInTheDocument();
    brain.unmount();

    renderScreen(<PrototypeReportsScreen />);
    expect(screen.getByText("Appointments kept")).toBeInTheDocument();
    expect(screen.getByText("2/2")).toBeInTheDocument();
  });

  it("renders Profile as a peer surface with caregiver visibility and preference rows", () => {
    renderScreen(<PrototypeProfileScreen />);

    expect(screen.getByRole("heading", { name: "Karim" })).toBeInTheDocument();
    expect(screen.getByTestId("button-prototype-back")).toBeInTheDocument();
    expect(screen.getByTestId("button-compact-voice")).toBeInTheDocument();
    expect(screen.getByText("Profile & settings")).toBeInTheDocument();
    expect(screen.getByText("Tarifa, Spain")).toBeInTheDocument();
    expect(screen.getByText("Your details")).toBeInTheDocument();
    expect(screen.getByText("Account details")).toBeInTheDocument();
    expect(screen.getByText("Health profile")).toBeInTheDocument();
    expect(screen.getByText("Emergency contact")).toBeInTheDocument();
    expect(screen.getByText("Who can help")).toBeInTheDocument();
    expect(screen.getByText("Care team")).toBeInTheDocument();
    expect(screen.getByText("Doctors & providers")).toBeInTheDocument();
    expect(screen.getByText("Preferences")).toBeInTheDocument();
    expect(screen.getByText("Text and theme")).toBeInTheDocument();
    expect(screen.getByText("Call support")).toBeInTheDocument();
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
    expect(screen.getByTestId("checkin-question-source-icon")).toHaveAttribute("data-icon-type", "vyva-mark");
    expect(screen.getByTestId("button-checkin-urgent-escape")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Great" })).toBeInTheDocument();
    expect(screen.getByTestId("button-checkin-option-great")).toHaveTextContent("Great");
    expect(screen.getByRole("button", { name: "Okay" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not my best" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Something's bothering me" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Good" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Low energy" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Something's bothering me" }));
    expect(screen.getByTestId("prototype-checkin-question")).toHaveAttribute("data-question-id", "detail");
    expect(screen.getByRole("button", { name: "Tired or low energy" })).toBeInTheDocument();
    expect(screen.getByTestId("button-checkin-option-aches_discomfort")).toHaveTextContent("Aches or discomfort");
    expect(screen.queryByRole("button", { name: "Breathing feels harder" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aches or discomfort" }));
    expect(screen.getByTestId("prototype-checkin-summary")).toBeInTheDocument();
    expect(screen.getByText("Here’s what you told VYVA.")).toBeInTheDocument();
    expect(screen.getByText("Thanks for checking in.")).toBeInTheDocument();
    expect(screen.getByText("Feeling today")).toBeInTheDocument();
    expect(screen.getByText("A little more")).toBeInTheDocument();
    expect(screen.getByText("Something's bothering me")).toBeInTheDocument();
    expect(screen.getByText("Aches or discomfort")).toBeInTheDocument();
    expect(screen.queryByText("Suggested next step")).not.toBeInTheDocument();
    expect(screen.queryByText(/symptom support can help/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start Symptom Report" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Get Urgent Help" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/health");
    expect(sosEvents).toHaveLength(0);

    window.removeEventListener(VYVA_OPEN_SOS_EVENT, handler);
  });

  it("keeps symptom reporting as a separate Health entry instead of a check-in summary branch", () => {
    renderScreen(<PrototypeHealthScreen checkInPath="/dev/home-master/check-in" symptomReportPath="/dev/home-master/symptom-report" />);

    fireEvent.click(screen.getByTestId("button-health-symptom-report"));

    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/symptom-report");
  });

  it("renders the local symptom-report handoff preview without requiring auth", () => {
    renderScreen(<PrototypeSymptomReportPreviewScreen />);

    expect(screen.getByTestId("prototype-health-action-preview-symptom")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Symptom Check" })).toBeInTheDocument();
    expect(screen.getByText("A focused symptom report starts here.")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-health-action-preview-back"));
    expect(navigateMock).toHaveBeenCalledWith("/dev/home-master/health");
  });

  it("renders local preview handoffs for protected Health destinations", () => {
    const cases = [
      ["plan", "Health Plan", "Your preventive plan will open here."],
      ["vitals", "Vitals Scan", "Latest readings and new measurements live here."],
      ["medicines", "Medicines", "Dose times and reminders open here."],
    ] as const;

    for (const [kind, title, subtitle] of cases) {
      const { unmount } = renderScreen(<PrototypeHealthActionPreviewScreen kind={kind} />);
      expect(screen.getByTestId(`prototype-health-action-preview-${kind}`)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
      expect(screen.getByText(subtitle)).toBeInTheDocument();
      unmount();
    }
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

  it("exposes the check-in adapter boundary without making the UI authoritative", () => {
    renderScreen(<PrototypeCheckInScreen />);

    const boundary = screen.getByTestId("checkin-flow-adapter-boundary");
    expect(boundary).toHaveAttribute("data-flow-id", "health.preventive_check");
    expect(boundary).toHaveAttribute("data-flow-version", "1.0.0");
    expect(boundary).toHaveAttribute("data-source", "local_fixture_adapter");
    expect(boundary).toHaveAttribute("data-status", "collecting");
    expect(boundary).toHaveAttribute("data-scene-id", "health.preventive_check.feeling");
    expect(boundary).toHaveAttribute("data-question-id", "feeling");
    expect(boundary).toHaveAttribute("data-answer-count", "0");
  });

  it("normalizes equivalent spoken and tapped check-in answers to the same semantic answer", () => {
    const touched = normalizePrototypeCheckInAnswer("feeling", "okay", "touch");
    const spoken = normalizePrototypeCheckInAnswer("feeling", "okay", "voice");

    expect(touched).not.toBeNull();
    expect(spoken).not.toBeNull();
    expect({ ...touched, modality: undefined }).toEqual({ ...spoken, modality: undefined });
    expect(touched?.modality).toBe("touch");
    expect(spoken?.modality).toBe("voice");
  });

  it("rejects stale scene answers without advancing or rebinding them to the current question", () => {
    const onDetailQuestion = submitPrototypeCheckInAnswer(initialPrototypeCheckInFlowState, {
      questionId: "feeling",
      optionId: "something_bothering_me",
      modality: "touch",
    });

    const staleTouch = submitPrototypeCheckInAnswer(onDetailQuestion, {
      questionId: "feeling",
      optionId: "okay",
      modality: "touch",
    });
    const staleVoice = submitPrototypeCheckInAnswer(onDetailQuestion, {
      questionId: "feeling",
      optionId: "great",
      modality: "voice",
    });

    for (const result of [staleTouch, staleVoice]) {
      expect(result.status).toBe("collecting");
      expect(result.currentQuestionId).toBe("detail");
      expect(result.answers).toHaveLength(1);
      expect(result.answers[0]?.optionId).toBe("something_bothering_me");
      expect(result.lastRejection?.reason).toBe("stale_scene");
      expect(result.lastRejection?.activeQuestionId).toBe("detail");
    }
  });

  it("rejects duplicate answers after summary without progressing again", () => {
    const summary = submitPrototypeCheckInAnswer(initialPrototypeCheckInFlowState, {
      questionId: "feeling",
      optionId: "okay",
      modality: "touch",
    });
    const duplicate = submitPrototypeCheckInAnswer(summary, {
      questionId: "feeling",
      optionId: "okay",
      modality: "voice",
    });

    expect(summary.status).toBe("summary");
    expect(duplicate.status).toBe("summary");
    expect(duplicate.answers).toHaveLength(1);
    expect(duplicate.lastRejection?.reason).toBe("inactive_flow");
  });

  it("resumes the same follow-up question after the safety interruption", () => {
    renderScreen(<PrototypeCheckInScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Something's bothering me" }));
    expect(screen.getByTestId("prototype-checkin-question")).toHaveAttribute("data-question-id", "detail");
    fireEvent.click(screen.getByTestId("button-checkin-urgent-escape"));
    fireEvent.click(screen.getByTestId("button-checkin-safety-resume"));

    expect(screen.getByTestId("prototype-checkin-question")).toHaveAttribute("data-question-id", "detail");
    expect(screen.getByRole("button", { name: "Trouble sleeping" })).toBeInTheDocument();
  });

  it("keeps the desktop check-in layout as one centered projection column", () => {
    renderScreen(<PrototypeCheckInScreen />);

    expect(screen.getByTestId("checkin-desktop-shell")).toHaveClass("max-w-[32.5rem]");
    expect(screen.queryByText(/fixture only/i)).not.toBeInTheDocument();
  });
});
