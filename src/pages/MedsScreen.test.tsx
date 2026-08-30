import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/queryClient";
import MedsScreen from "./MedsScreen";

const labels: Record<string, string> = {
  "common.back": "Back",
  "common.loading": "Loading...",
  "meds.primary.myMedicines": "My Medicines",
  "meds.primary.myMedicinesSub": "Saved list",
  "meds.primary.myMedicinesCount": "{{count}} saved",
  "meds.primary.adherence": "History & progress",
  "meds.primary.adherenceToday": "{{value}}% today",
  "meds.primary.adherenceMobileSub": "Daily progress",
  "meds.primary.refills": "Refills",
  "meds.primary.checkInteractions": "Drug combinations",
  "meds.primary.checkInteractionsSub": "Review medicines taken together",
  "meds.dashboard.priorityEmptyTitle": "No medicine plan yet",
  "meds.dashboard.priorityEmptySub": "Add medicines to start tracking today.",
  "meds.dashboard.priorityNextTitleOne": "1 dose left today",
  "meds.dashboard.priorityNextTitleMany": "{{count}} doses left today",
  "meds.dashboard.priorityNextSub": "Next: {{medicine}} at {{time}}.",
  "meds.dashboard.confirmNext": "Mark as taken",
  "meds.master.heroEyebrow": "Medication",
  "meds.master.todayTitle": "Your medicines today",
  "meds.master.heroAction": "Talk to VYVA",
  "meds.master.voiceSupport": "Speak anytime",
  "meds.myMedicines.kicker": "My Medicines",
  "meds.myMedicines.title": "My Medicines",
  "meds.myMedicines.addTitle": "Add medicine",
  "meds.myMedicines.add": "Add",
  "meds.myMedicines.addChoiceTitle": "Choose method",
  "meds.myMedicines.list": "List",
  "meds.myMedicines.voice": "Voice",
  "meds.myMedicines.manual": "Manual",
  "meds.myMedicines.reminders": "Go to My Reminders",
  "meds.myMedicines.refills": "Go to My Refills",
  "meds.myMedicines.routineMissing": "Routine to add",
  "meds.myMedicines.purposeMissing": "Purpose to add",
  "meds.checkInteractions.kicker": "Drug combinations",
  "meds.checkInteractions.title": "Check medicines together",
  "meds.checkInteractions.ruleShort": "Check before taking together.",
};

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  toast: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryClient")>("@/lib/queryClient");
  return {
    ...actual,
    apiFetch: mocks.apiFetch,
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | { returnObjects?: boolean; defaultValue?: string; count?: number }) => {
      const interpolate = (value: string, params?: Record<string, unknown>) =>
        value.replace(/\{\{(\w+)\}\}/g, (_match, token) => String(params?.[token] ?? ""));
      if (key === "meds.headlines" && typeof fallbackOrOptions === "object" && fallbackOrOptions?.returnObjects) {
        return [];
      }
      if (typeof fallbackOrOptions === "object" && typeof fallbackOrOptions.defaultValue === "string") {
        return interpolate(fallbackOrOptions.defaultValue, fallbackOrOptions as Record<string, unknown>);
      }
      const value = labels[key] ?? (typeof fallbackOrOptions === "string" ? fallbackOrOptions : key);
      return typeof fallbackOrOptions === "object"
        ? interpolate(value, fallbackOrOptions as Record<string, unknown>)
        : value;
    },
  }),
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en" }),
  getLanguageSnapshot: () => ({ language: "en", source: "test" }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/useVoiceActionFulfillment", () => ({
  useVoiceActionFulfillment: () => ({
    action: null,
    payloadValue: () => "",
  }),
}));

vi.mock("@/components/VyvaSessionCta", () => ({
  default: ({ label, testId, className }: { label?: string; testId?: string; className?: string }) => (
    <button type="button" data-testid={testId} className={className}>
      {label}
    </button>
  ),
}));

vi.mock("@/components/VoiceActionFulfillmentPanel", () => ({
  default: () => null,
}));

vi.mock("@/components/MedsAssistantSheet", () => ({
  default: () => null,
}));

const apiFetchMock = vi.mocked(apiFetch);

type TestMedication = {
  id: string;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  scheduled_times: string[];
  takenToday: boolean;
  takenCountToday: number;
  scheduledCountToday: number;
};

type TestMyMedicine = {
  id: string;
  display_name: string;
  dose_text?: string | null;
  purpose_text?: string | null;
  item_type: "prescription" | "otc" | "supplement";
  drug_class_tag?: string | null;
  status: "active" | "paused" | "discontinued";
};

type TestInteractionResponse = {
  flags: Array<{
    id: string;
    kind: "rule" | "duplicate_class";
    ruleId?: string;
    medicineIds: string[];
    medicines: string[];
    message: string;
    severityTier: "worth_asking";
    canDismiss: boolean;
  }>;
  hasMore: boolean;
  reviewedRuleCount: number;
  activeMedicineCount: number;
  message: string;
};

type RenderOptions = {
  route?: string;
  myMedicines?: TestMyMedicine[];
  interactions?: TestInteractionResponse;
  refills?: {
    permissions: { manage_inventory: boolean; receive_refill_alerts: boolean };
    alerts: Array<{
      id: string;
      medicineId: string;
      status: "refill_soon" | "refill_now" | "uncertain";
      title: string;
      message: string;
      daysRemaining: number | null;
      projectedRunOutDate: string | null;
      createdAt: string;
    }>;
  };
};

function safetyResponse(overrides: Record<string, unknown> = {}) {
  return {
    summary: {
      status: "steady",
      severity: "watch",
      title: "No medication safety signals found",
      message: "Today looks steady from the medication data VYVA can see.",
      signalCount: 0,
      openCaseCount: 0,
      lastAnalysedAt: null,
    },
    signalCandidates: [],
    signals: [],
    openCases: [],
    exportAvailability: {
      canExport: false,
      readyCount: 0,
      needsReviewCount: 0,
    },
    ...overrides,
  };
}

function interactionsResponse(overrides: Partial<TestInteractionResponse> = {}): TestInteractionResponse {
  return {
    flags: [],
    hasMore: false,
    reviewedRuleCount: 0,
    activeMedicineCount: 0,
    message: "Everything looks okay from the reviewed rules available today. Keep adding medicines so VYVA can keep checking.",
    ...overrides,
  };
}

function renderMedsScreen(medications: TestMedication[] = [], safety = safetyResponse(), options: RenderOptions = {}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          if (queryKey[0] === "/api/meds/adherence-report/today") {
            return { medications };
          }
          if (queryKey[0] === "/api/meds/safety") {
            return safety;
          }
          if (queryKey[0] === "/api/meds/my-medicines") {
            return {
              medicines: options.myMedicines ?? medications.map((med) => ({
                id: med.id,
                display_name: med.medication_name,
                dose_text: [med.dosage, med.frequency?.replace("_", " ")].filter(Boolean).join(" "),
                purpose_text: null,
                item_type: "prescription",
                drug_class_tag: "other_uncategorized",
                status: "active",
              })),
              classTags: ["blood_pressure_lowering", "nsaid_pain_reliever", "other_uncategorized"],
            };
          }
          if (queryKey[0] === "/api/meds/interactions") {
            return options.interactions ?? interactionsResponse({
              activeMedicineCount: medications.length,
            });
          }
          if (queryKey[0] === "/api/meds/refills/me") {
            return options.refills ?? { permissions: { manage_inventory: true, receive_refill_alerts: true }, alerts: [] };
          }
          if (queryKey[0] === "/api/profile/personalisation") {
            return { conditions: [], hobbies: [], hasMedications: medications.length > 0 };
          }
          if (queryKey[0] === "/api/onboarding/state") {
            return { profile: { data_sharing_consent: { providers: { providers: [] } } } };
          }
          return {};
        },
      },
    },
  });

  if (options.refills) {
    client.setQueryData(["/api/meds/refills/me"], options.refills);
  }

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[options.route ?? "/meds"]}>
        <MedsScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MedsScreen medication home and detail screens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("puts today's medicine status and a clear empty-state action first", async () => {
    renderMedsScreen();

    expect(await screen.findByTestId("meds-master-hero")).toHaveTextContent("Your medicines today");
    expect(screen.getByTestId("section-meds-primary-actions")).toBeInTheDocument();
    expect(screen.getByTestId("section-meds-dashboard")).toBeInTheDocument();
    expect(await screen.findByText("No medicine plan yet")).toBeInTheDocument();
    expect(screen.getByTestId("text-meds-priority-sub")).toHaveTextContent("Add medicines to start tracking today.");
    expect(screen.getByTestId("button-meds-dashboard-add-empty")).toHaveTextContent("Add your first medicine");

    expect(screen.getByTestId("button-meds-primary-my-medicines")).toHaveTextContent("My Medicines");
    expect(screen.getByTestId("button-meds-primary-adherence")).toHaveTextContent("History & progress");
    expect(screen.getByTestId("button-meds-primary-refills")).toHaveTextContent("Refills");
    expect(screen.getByTestId("button-meds-primary-interactions")).toHaveTextContent("Drug combinations");
    expect(
      within(screen.getByTestId("section-meds-primary-actions"))
        .getAllByRole("button")
        .map((button) => button.getAttribute("data-testid")),
    ).toEqual([
      "button-meds-primary-my-medicines",
      "button-meds-primary-interactions",
      "button-meds-primary-refills",
      "button-meds-primary-adherence",
    ]);

    expect(screen.queryByTestId("section-my-medicines")).not.toBeInTheDocument();
    expect(screen.queryByTestId("section-check-interactions")).not.toBeInTheDocument();
    expect(screen.queryByTestId("section-meds-can-help")).not.toBeInTheDocument();
    expect(screen.queryByTestId("panel-meds-pharmacy")).not.toBeInTheDocument();
    expect(screen.queryByTestId("section-meds-dashboard-tips")).not.toBeInTheDocument();
  });

  it("routes primary cards to dedicated screens including the refill inventory tracker", async () => {
    renderMedsScreen([
      {
        id: "med-1",
        medication_name: "Metformin",
        dosage: "500mg",
        frequency: "twice_daily",
        scheduled_times: ["08:00", "20:00"],
        takenToday: false,
        takenCountToday: 1,
        scheduledCountToday: 2,
      },
    ]);

    fireEvent.click(await screen.findByTestId("button-meds-primary-my-medicines"));
    expect(mocks.navigate).toHaveBeenCalledWith("/meds/my-medicines");

    fireEvent.click(screen.getByTestId("button-meds-primary-adherence"));
    expect(mocks.navigate).toHaveBeenCalledWith("/meds/adherence-report");

    fireEvent.click(screen.getByTestId("button-meds-primary-interactions"));
    expect(mocks.navigate).toHaveBeenCalledWith("/meds/interactions");

    fireEvent.click(screen.getByTestId("button-meds-primary-refills"));
    expect(mocks.navigate).toHaveBeenCalledWith("/meds/refills");
  });

  it("shows My Medicines as its own screen and keeps add choices separate from the list", async () => {
    renderMedsScreen([], safetyResponse(), {
      route: "/meds/my-medicines",
      myMedicines: [{
        id: "med-1",
        display_name: "Metformin",
        dose_text: "500mg in the morning and evening with food after breakfast and dinner",
        purpose_text: "For blood sugar support",
        item_type: "prescription",
        drug_class_tag: "diabetes_blood_sugar",
        status: "active",
      }],
    });

    expect(await screen.findByTestId("meds-my-medicines-screen")).toBeInTheDocument();
    expect(screen.getByTestId("button-meds-screen-back")).toHaveTextContent("Back");
    expect(screen.getByTestId("section-my-medicines")).toHaveTextContent("My Medicines");
    expect(await screen.findByTestId("list-my-medicines-active")).toHaveTextContent("Metformin");
    expect(screen.queryByTestId("meds-master-hero")).not.toBeInTheDocument();
    expect(screen.queryByTestId("panel-my-medicines-add-choice")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Metformin/i }));
    fireEvent.click(screen.getByTestId("button-my-medicine-edit"));
    expect(screen.getByTestId("panel-my-medicine-edit")).toHaveTextContent("Copy the label wording");
    expect(screen.getByTestId("panel-my-medicine-edit")).toHaveTextContent("does not change or recommend a dose");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Back" })[1]);

    fireEvent.click(screen.getByTestId("button-my-medicines-add"));

    expect(screen.getByTestId("section-my-medicines")).toHaveTextContent("Add medicine");
    expect(screen.getByTestId("panel-my-medicines-add-choice")).toHaveTextContent("Voice");
    expect(screen.getByTestId("panel-my-medicines-add-choice")).toHaveTextContent("Take or upload a photo");
    expect(screen.getByTestId("panel-my-medicines-add-choice")).toHaveTextContent("review everything before it is saved");
    expect(screen.queryByTestId("list-my-medicines-active")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Manual"));

    expect(screen.getByTestId("panel-my-medicines-add")).toBeInTheDocument();
    expect(screen.queryByTestId("list-my-medicines-active")).not.toBeInTheDocument();
  });

  it("shows one safe refill alert with update and question actions", async () => {
    renderMedsScreen([], safetyResponse(), {
      refills: {
        permissions: { manage_inventory: true, receive_refill_alerts: true },
        alerts: [{
          id: "alert-1",
          medicineId: "med-1",
          status: "refill_soon",
          title: "Metformin needs a refill this week",
          message: "5 days of supply are estimated to remain.",
          daysRemaining: 5,
          projectedRunOutDate: "2026-09-04",
          createdAt: "2026-08-30T10:00:00.000Z",
        }],
      },
    });

    const alert = await screen.findByTestId("meds-refill-alert");
    expect(alert).toHaveTextContent("Metformin needs a refill this week");
    expect(alert).toHaveTextContent("VYVA never orders or contacts anyone");
    expect(within(alert).getByRole("button", { name: "Update supply" })).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Ask any question" })).toBeInTheDocument();

    fireEvent.click(within(alert).getByRole("button", { name: "Update supply" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/meds/refills");
  });

  it("creates refill tracking with the medicine instead of leaving setup incomplete", async () => {
    renderMedsScreen([], safetyResponse(), { route: "/meds/my-medicines" });

    fireEvent.click(await screen.findByTestId("button-my-medicines-add"));
    fireEvent.click(await screen.findByText("Manual"));
    fireEvent.change(screen.getByPlaceholderText("e.g. little white heart pill"), { target: { value: "Amlodipine" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.change(screen.getByPlaceholderText("e.g. for blood pressure"), { target: { value: "Blood pressure" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.change(screen.getByLabelText("Dose and routine"), { target: { value: "5mg once each morning" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByTestId("panel-add-medicine-supply")).toHaveTextContent("Estimated coverage");
    fireEvent.change(screen.getByLabelText("Package quantity"), { target: { value: "28" } });
    expect(screen.getByTestId("panel-add-medicine-supply")).toHaveTextContent("About 28 days of supply");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByTestId("add-medicine-supply-review")).toHaveTextContent("Refill tracking ready");
    fireEvent.click(screen.getByTestId("button-my-medicines-save"));

    await waitFor(() => {
      const createCall = apiFetchMock.mock.calls.find(([path, init]) => path === "/api/meds/my-medicines" && init?.method === "POST");
      expect(createCall).toBeTruthy();
      const payload = JSON.parse(String(createCall?.[1]?.body));
      expect(payload).toMatchObject({
        display_name: "Amlodipine",
        dose_unit: "tablet",
        units_per_dose: 1,
        daily_frequency: 1,
        inventory_tracking_enabled: true,
        refill_alert_days: 7,
        initial_quantity: 28,
      });
      expect(payload.purchased_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(payload.photo_url).toBeNull();
    });
  });

  it("shows drug-combination advice with clear safety boundaries and no review-dismiss buttons", async () => {
    renderMedsScreen([], safetyResponse(), {
      route: "/meds/interactions",
      interactions: interactionsResponse({
        activeMedicineCount: 2,
        flags: [{
          id: "rule-rule-1",
          kind: "rule",
          ruleId: "rule-1",
          medicineIds: ["med-1", "med-2"],
          medicines: ["Amlodipine", "Ibuprofen"],
          message: "Worth asking your pharmacist if they go well together.",
          severityTier: "worth_asking",
          canDismiss: true,
        }],
        message: "Worth asking your pharmacist about these combinations.",
      }),
    });

    expect(await screen.findByTestId("meds-interactions-screen")).toBeInTheDocument();
    expect(screen.getByTestId("section-check-interactions")).toHaveTextContent("Check medicines together");
    expect(screen.getByTestId("button-med-combination-advice")).toHaveTextContent("Get combination advice");
    expect(await screen.findByTestId("card-med-interaction-0")).toHaveTextContent("Amlodipine + Ibuprofen");
    expect(screen.getByTestId("card-med-interaction-0")).toHaveTextContent("Check before taking together.");
    expect(screen.getByTestId("section-check-interactions")).toHaveTextContent("This is not a complete interaction review");
    expect(screen.getByTestId("section-check-interactions")).toHaveTextContent("VYVA never changes doses");
    expect(screen.queryByTestId("meds-master-hero")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-med-interaction-asked-0")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-med-interaction-later-0")).not.toBeInTheDocument();
  });

  it("keeps the primary taken action visible and leaves Not now unrecorded", async () => {
    renderMedsScreen([
      {
        id: "med-1",
        medication_name: "Metformin",
        dosage: "500mg",
        frequency: "once_daily",
        scheduled_times: ["08:00"],
        takenToday: false,
        takenCountToday: 0,
        scheduledCountToday: 1,
      },
    ]);

    expect(await screen.findByText("1 dose left today")).toBeInTheDocument();
    expect(screen.getByTestId("text-meds-priority-sub")).toHaveTextContent("Next: Metformin at 08:00.");
    expect(screen.getByTestId("button-confirm-next-med")).toHaveTextContent("Mark as taken");

    fireEvent.click(screen.getByTestId("button-meds-dashboard-not-now"));
    expect(screen.getByTestId("status-dose-deferred")).toHaveTextContent("No dose was recorded or changed");
    expect(apiFetchMock).not.toHaveBeenCalledWith("/api/meds/adherence-report/confirm", expect.anything());

    fireEvent.click(screen.getByTestId("button-confirm-next-med"));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/meds/adherence-report/confirm",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          medication_name: "Metformin",
          scheduled_time: "08:00",
        }),
      }),
    ));
  });

});
