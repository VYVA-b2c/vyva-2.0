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
  it("lets testers mark cross-pillar manual QA checks and copy failed notes", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    window.localStorage.clear();
    renderPage();

    expect(screen.getByRole("region", { name: "Cross-pillar manual QA runner" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Prove the real flow, not just the map" })).toBeInTheDocument();
    expect(screen.getByText("High-risk passed")).toBeInTheDocument();

    const transportQa = screen.getByTestId(`cross-pillar-qa-flow-${CONCIERGE_FLOW_REFERENCES.transportBooking}`);
    expect(within(transportQa).getByText("Book ride / transport")).toBeInTheDocument();
    expect(within(transportQa).getByText("High risk")).toBeInTheDocument();

    const missingSetupCheck = within(transportQa).getByTestId(`cross-pillar-qa-check-${CONCIERGE_FLOW_REFERENCES.transportBooking}:missing_setup`);
    fireEvent.click(within(missingSetupCheck).getByRole("button", { name: "Fail" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy QA notes" }));

    expect(await screen.findByDisplayValue(/Cross-pillar manual QA notes/)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Book ride \/ transport/)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Fail: Missing setup path/)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Failed checkpoints: 1/)).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Book ride / transport"));
  });

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
    expect(screen.getByRole("region", { name: "Cross-pillar parity audit" })).toBeInTheDocument();
    expect(screen.getByText("Same safety standard everywhere")).toBeInTheDocument();
    expect(screen.getAllByText("Needs tool/service").length).toBeGreaterThan(0);
    expect(screen.getByTestId("workflow-parity-backlog")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Cross-pillar flow matrix" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Workflow readiness checklist" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Cross-pillar manual QA runner" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by coverage"), { target: { value: "all" } });
    const rideMatrix = screen.getByTestId(`workflow-matrix-row-${CONCIERGE_FLOW_REFERENCES.transportBooking}`);
    expect(within(rideMatrix).getByText(/saved transport/i)).toBeInTheDocument();
    expect(within(rideMatrix).getByText(/trusted providers, mobility preferences, home address, basic profile/i)).toBeInTheDocument();
    expect(within(rideMatrix).getByText(/add usual provider/i)).toBeInTheDocument();
    expect(within(rideMatrix).getByText(/pending task/i)).toBeInTheDocument();
    const rideReadiness = screen.getByTestId(`workflow-readiness-row-${CONCIERGE_FLOW_REFERENCES.transportBooking}`);
    expect(within(rideReadiness).getByText("Tool readiness")).toBeInTheDocument();
    expect(within(rideReadiness).getByText("Profile data")).toBeInTheDocument();
    expect(within(rideReadiness).getByText("Final confirmation")).toBeInTheDocument();
    expect(within(rideReadiness).getByText("Receipt moment")).toBeInTheDocument();
    expect(within(rideReadiness).getByText("Resume behavior")).toBeInTheDocument();
    expect(within(rideReadiness).getByText("All required gates mapped")).toBeInTheDocument();

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
    const workflowList = screen.getByRole("region", { name: "Workflow list" });
    expect(within(screen.getByTestId(`workflow-row-${APP_WORKFLOW_REFERENCES.medicationResearch}`)).getByText(medicationWorkflow?.title ?? "")).toBeInTheDocument();
    expect(within(workflowList).queryByText("Home remedy questions")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by action level"), { target: { value: "setup" } });
    expect(screen.queryByTestId(`workflow-row-${APP_WORKFLOW_REFERENCES.medicationResearch}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`workflow-row-${APP_WORKFLOW_REFERENCES.trustedProviders}`)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search workflows"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Filter by domain"), { target: { value: "all" } });
    expect(screen.getByTestId(`workflow-row-${APP_WORKFLOW_REFERENCES.trustedProviders}`)).toBeInTheDocument();
  });
});
