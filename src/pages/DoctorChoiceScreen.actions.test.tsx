import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DoctorChoiceScreen, { doctorChoiceQuickActionsFor } from "./DoctorChoiceScreen";

const profileMock = vi.fn();
const startDoctorVoice = vi.fn();
const stopDoctorVoice = vi.fn();

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => profileMock(),
}));

vi.mock("@/hooks/useDoctorVoice", () => ({
  useDoctorVoice: () => ({
    status: "idle",
    isSpeaking: false,
    isUserSpeaking: false,
    isConnecting: false,
    lastError: null,
    isVoiceLive: false,
    startDoctorVoice,
    stopDoctorVoice,
    startAttempted: false,
    userStopped: false,
  }),
}));

vi.mock("@/hooks/useHeroMessage", () => ({
  useHeroMessage: () => ({
    sourceText: "Medical help",
    headline: "Get doctor support",
    ctaLabel: "Talk now",
  }),
}));

vi.mock("@/hooks/useServiceGate", () => ({
  useServiceGate: () => ({
    readiness: { services: { doctor: { recommended: [] } } },
  }),
}));

vi.mock("@/components/VoiceActionFulfillmentPanel", () => ({
  default: () => <div data-testid="voice-action-panel" />,
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      i18n: { language: "en" },
      t: (_key: string, fallback?: string, values?: Record<string, string>) => {
        if (!fallback) return _key;
        return fallback.replace(/{{(\w+)}}/g, (_, token) => values?.[token] ?? token);
      },
    }),
  };
});

const labels = {
  call_gp: "Call {{name}}",
  call_gpSub: "Speak to the practice now.",
  email_gp: "Email GP",
  email_gpSub: "Send the health context.",
  book_appointment: "Book appointment",
  book_appointmentSub: "VYVA prepares the request.",
  book_ride: "Arrange ride",
  book_rideSub: "VYVA can arrange the ride.",
  add_gp_contact: "Add GP contact",
  add_gp_contactSub: "Save phone or email first.",
};

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="current-route">{location.pathname}</div>
      <div data-testid="route-state">{JSON.stringify(location.state ?? {})}</div>
    </>
  );
}

function renderDoctorScreen() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/health/doctor", state: { latestSymptomReport: "Chest pressure report" } }]}>
      <Routes>
        <Route path="/health/doctor" element={<DoctorChoiceScreen />} />
        <Route path="/concierge" element={<LocationProbe />} />
        <Route path="/onboarding/profile/gp" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Doctor choice quick service actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileMock.mockReturnValue({
      profile: {
        gpName: "Dr Garcia",
        gpPhone: "+34 612 345 678",
        gpEmail: "gp@example.com",
      },
    });
  });

  it("builds direct GP contact plus appointment and ride actions", () => {
    const actions = doctorChoiceQuickActionsFor({
      gpName: "Dr Garcia",
      gpPhone: "+34 612 345 678",
      gpEmail: "gp@example.com",
      latestSymptomReport: "Chest pressure report",
      labels,
    });

    expect(actions).toEqual([
      expect.objectContaining({ kind: "call_gp", href: "tel:+34612345678", label: "Call Dr Garcia" }),
      expect.objectContaining({ kind: "email_gp", href: expect.stringContaining("mailto:gp@example.com") }),
      expect.objectContaining({
        kind: "book_appointment",
        to: "/concierge",
        state: { conciergePrefill: expect.objectContaining({ kind: "appointment", source: "doctor_choice" }) },
      }),
      expect.objectContaining({
        kind: "book_ride",
        to: "/concierge",
        state: { conciergePrefill: expect.objectContaining({ kind: "ride", source: "doctor_choice" }) },
      }),
    ]);
  });

  it("offers GP setup when no direct GP contact exists", () => {
    const actions = doctorChoiceQuickActionsFor({ labels });

    expect(actions[0]).toMatchObject({
      kind: "add_gp_contact",
      to: expect.stringContaining("/onboarding/profile/gp"),
    });
  });

  it("renders call, email, appointment, and transport buttons on the doctor screen", async () => {
    renderDoctorScreen();

    expect(await screen.findByTestId("button-doctor-quick-call_gp")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-doctor-quick-email_gp")).toHaveAttribute("href", expect.stringContaining("mailto:gp@example.com"));

    fireEvent.click(screen.getByTestId("button-doctor-quick-book_appointment"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"source\":\"doctor_choice\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"appointment\"");
    expect(stopDoctorVoice).toHaveBeenCalled();
  });
});
