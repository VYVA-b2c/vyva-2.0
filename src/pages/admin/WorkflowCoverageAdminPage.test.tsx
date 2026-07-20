import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  APP_WORKFLOW_REFERENCES,
  WORKFLOW_DEFINITIONS,
} from "../../../shared/workflowRegistry";
import { CONCIERGE_FLOW_REFERENCES } from "../../../shared/conciergeFlowRegistry";
import WorkflowCoverageAdminPage from "./WorkflowCoverageAdminPage";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "admin@example.com", role: "admin" },
    logout: vi.fn(),
  }),
}));

const fastHelpOutcomes = {
  generatedAt: "2026-07-17T12:00:00.000Z",
  windowDays: 30,
  totals: {
    shown: 42,
    attributedOpened: 8,
    attributedCompleted: 4,
    attributedBlocked: 1,
    opened: 8,
    completed: 4,
    dismissed: 1,
    abandoned: 1,
    blocked: 1,
    resumed: 2,
    recovered: 1,
  },
  actions: [
    {
      actionId: "feel-better",
      shown: 42,
      attributedOpened: 8,
      attributedCompleted: 4,
      attributedBlocked: 1,
      opened: 8,
      completed: 4,
      dismissed: 1,
      abandoned: 1,
      blocked: 1,
      resumed: 2,
      recovered: 1,
    },
  ],
  rankingVersions: [{
    rankingVersion: "personalized-v1",
    impressions: 14,
    shown: 42,
    opened: 8,
    completed: 4,
    blocked: 1,
    actions: [{
      actionId: "feel-better",
      shown: 42,
      opened: 8,
      completed: 4,
      blocked: 1,
    }],
  }],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        queryFn: async () => fastHelpOutcomes,
      },
    },
  });
  queryClient.setQueryData(["/api/admin/home/fast-help-outcomes?days=30"], fastHelpOutcomes);
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/workflows"]}>
        <WorkflowCoverageAdminPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("WorkflowCoverageAdminPage", () => {
  it("shows workflow coverage, next work, and mapped entry points", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Workflow coverage" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /workflows.*coverage and next steps/i })).toHaveAttribute("aria-current", "page");
    const workflowMetricLabel = screen.getAllByText("Workflows").find((element) => element.tagName === "P");
    expect(within(workflowMetricLabel!.parentElement!).getByText(String(WORKFLOW_DEFINITIONS.length))).toBeInTheDocument();
    expect(screen.getByText("Incomplete workflows first")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Shown to outcome, last 30 days" })).toBeInTheDocument();
    expect(screen.getByText("Aggregate action IDs only; no health or profile content")).toBeInTheDocument();
    expect(screen.getByText("personalized-v1")).toBeInTheDocument();
    expect(screen.getByText("Ready to compare")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Action level summary" })).toBeInTheDocument();
    expect(screen.getAllByText("External action").length).toBeGreaterThan(0);
    expect(screen.getByText(/Check provider or tool readiness/i)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Cross-pillar flow matrix" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by coverage"), { target: { value: "all" } });
    const rideMatrix = screen.getByTestId(`workflow-matrix-row-${CONCIERGE_FLOW_REFERENCES.transportBooking}`);
    expect(within(rideMatrix).getByText(/saved transport/i)).toBeInTheDocument();
    expect(within(rideMatrix).getByText(/add usual provider/i)).toBeInTheDocument();
    expect(within(rideMatrix).getByText(/pending task/i)).toBeInTheDocument();

    const visualScan = screen.getByTestId(`workflow-row-${APP_WORKFLOW_REFERENCES.visualScan}`);
    const visualScanWorkflow = WORKFLOW_DEFINITIONS.find((workflow) => workflow.reference === APP_WORKFLOW_REFERENCES.visualScan);
    expect(within(visualScan).getByText("Visual scan")).toBeInTheDocument();
    expect(within(visualScan).getByText(visualScanWorkflow?.nextStep ?? "")).toBeInTheDocument();
    expect(within(visualScan).getByText(/Ask before uploading/i)).toBeInTheDocument();
    expect(within(visualScan).getByText("Visual Scan")).toBeInTheDocument();
    expect(within(visualScan).getByText("Receipt moment")).toBeInTheDocument();
    expect(within(visualScan).getByText("Action prepared")).toBeInTheDocument();
  });

  it("filters workflows by area and search text", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Filter by coverage"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Filter by domain"), { target: { value: "medication" } });
    expect(screen.queryByTestId(`workflow-row-${APP_WORKFLOW_REFERENCES.visualScan}`)).not.toBeInTheDocument();
    const medicationResearch = screen.getByTestId(`workflow-row-${APP_WORKFLOW_REFERENCES.medicationResearch}`);
    const medicationWorkflow = WORKFLOW_DEFINITIONS.find((workflow) => workflow.reference === APP_WORKFLOW_REFERENCES.medicationResearch);
    expect(within(medicationResearch).getByText(medicationWorkflow?.title ?? "")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search workflows"), { target: { value: "pubmed" } });
    expect(within(screen.getByTestId(`workflow-row-${APP_WORKFLOW_REFERENCES.medicationResearch}`)).getByText(medicationWorkflow?.title ?? "")).toBeInTheDocument();
    expect(screen.queryByText("Home remedy questions")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by action level"), { target: { value: "setup" } });
    expect(screen.queryByTestId(`workflow-row-${APP_WORKFLOW_REFERENCES.medicationResearch}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`workflow-row-${APP_WORKFLOW_REFERENCES.trustedProviders}`)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search workflows"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Filter by domain"), { target: { value: "all" } });
    expect(screen.getByTestId(`workflow-row-${APP_WORKFLOW_REFERENCES.trustedProviders}`)).toBeInTheDocument();
  });
});
