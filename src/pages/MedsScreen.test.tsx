import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  "meds.primary.adherence": "My Adherence",
  "meds.primary.adherenceToday": "{{value}}% today",
  "meds.primary.adherenceMobileSub": "Daily progress",
  "meds.primary.refills": "My Refills",
  "meds.primary.checkInteractions": "Safety Check",
  "meds.primary.checkInteractionsSub": "Medicine mix",
  "meds.dashboard.priorityEmptyTitle": "No medicine plan yet",
  "meds.dashboard.priorityEmptySub": "Add medicines to start tracking today.",
  "meds.dashboard.priorityNextTitleOne": "1 dose left today",
  "meds.dashboard.priorityNextTitleMany": "{{count}} doses left today",
  "meds.dashboard.priorityNextSub": "Next: {{medicine}} at {{time}}.",
  "meds.dashboard.confirmNext": "Confirm taken",
  "meds.master.heroEyebrow": "Medication",
  "meds.master.heroTitle": "Medicine on track",
  "meds.master.heroAction": "Talk to VYVA",
  "meds.master.voiceSupport": "Speak anytime",
  "meds.myMedicines.kicker": "My Medicines",
  "meds.myMedicines.title": "My Medicines",
  "meds.myMedicines.addTitle": "Add medicine",
  "meds.myMedicines.add": "Add",
  "meds.myMedicines.addChoiceTitle": "Choose method",
  "meds.myMedicines.list": "List",
  "meds.myMedicines.voice": "Voice",
  "meds.myMedicines.photo": "Photo",
  "meds.myMedicines.manual": "Manual",
  "meds.myMedicines.reminders": "Go to My Reminders",
  "meds.myMedicines.refills": "Go to My Refills",
  "meds.myMedicines.routineMissing": "Routine to add",
  "meds.myMedicines.purposeMissing": "Purpose to add",
  "meds.checkInteractions.kicker": "Medicine Safety",
  "meds.checkInteractions.title": "Safety Check",
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

  it("keeps the medication home compact with hero, four cards, and dose bar only", async () => {
    renderMedsScreen();

    expect(await screen.findByTestId("meds-master-hero")).toHaveTextContent("Medicine on track");
    expect(screen.getByTestId("section-meds-primary-actions")).toBeInTheDocument();
    expect(screen.getByTestId("section-meds-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("text-meds-priority-title")).toHaveTextContent("No medicine plan yet");
    expect(screen.getByTestId("text-meds-priority-sub")).toHaveTextContent("Add medicines to start tracking today.");

    expect(screen.getByTestId("button-meds-primary-my-medicines")).toHaveTextContent("My Medicines");
    expect(screen.getByTestId("button-meds-primary-adherence")).toHaveTextContent("My Adherence");
    expect(screen.getByTestId("button-meds-primary-refills")).toHaveTextContent("My Refills");
    expect(screen.getByTestId("button-meds-primary-interactions")).toHaveTextContent("Safety Check");

    expect(screen.queryByTestId("section-my-medicines")).not.toBeInTheDocument();
    expect(screen.queryByTestId("section-check-interactions")).not.toBeInTheDocument();
    expect(screen.queryByTestId("section-meds-can-help")).not.toBeInTheDocument();
    expect(screen.queryByTestId("panel-meds-pharmacy")).not.toBeInTheDocument();
    expect(screen.queryByTestId("section-meds-dashboard-tips")).not.toBeInTheDocument();
  });

  it("routes primary cards to their dedicated screens and existing refill flow", async () => {
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
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/concierge/shopping",
      expect.objectContaining({
        state: expect.objectContaining({
          shoppingPrefill: expect.objectContaining({
            category: "pharmacy_basics",
          }),
        }),
      }),
    );
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
    expect(screen.getByTestId("list-my-medicines-active")).toHaveTextContent("Metformin");
    expect(screen.queryByTestId("meds-master-hero")).not.toBeInTheDocument();
    expect(screen.queryByTestId("panel-my-medicines-add-choice")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-my-medicines-add"));

    expect(screen.getByTestId("section-my-medicines")).toHaveTextContent("Add medicine");
    expect(screen.getByTestId("panel-my-medicines-add-choice")).toHaveTextContent("Voice");
    expect(screen.queryByTestId("list-my-medicines-active")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Manual"));

    expect(screen.getByTestId("panel-my-medicines-add")).toBeInTheDocument();
    expect(screen.queryByTestId("list-my-medicines-active")).not.toBeInTheDocument();
  });

  it("shows Safety Check as its own screen without review-dismiss buttons", async () => {
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
    expect(screen.getByTestId("section-check-interactions")).toHaveTextContent("Safety Check");
    expect(screen.getByTestId("card-med-interaction-0")).toHaveTextContent("Amlodipine + Ibuprofen");
    expect(screen.getByTestId("card-med-interaction-0")).toHaveTextContent("Check before taking together.");
    expect(screen.queryByTestId("meds-master-hero")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-med-interaction-asked-0")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-med-interaction-later-0")).not.toBeInTheDocument();
  });

  it("confirms the next pending medicine from the pinned dose bar", async () => {
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

    expect(await screen.findByTestId("section-meds-dashboard")).toHaveTextContent("1 dose left today");
    expect(screen.getByTestId("text-meds-priority-sub")).toHaveTextContent("Next: Metformin at 08:00.");

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
