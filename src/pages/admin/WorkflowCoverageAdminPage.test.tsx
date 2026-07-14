import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  APP_WORKFLOW_REFERENCES,
  WORKFLOW_DEFINITIONS,
} from "../../../shared/workflowRegistry";
import WorkflowCoverageAdminPage from "./WorkflowCoverageAdminPage";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "admin@example.com", role: "admin" },
    logout: vi.fn(),
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/workflows"]}>
      <WorkflowCoverageAdminPage />
    </MemoryRouter>,
  );
}

describe("WorkflowCoverageAdminPage", () => {
  it("shows workflow coverage, next work, and mapped entry points", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Workflow coverage" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /workflows.*coverage and next steps/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText(String(WORKFLOW_DEFINITIONS.length))).toBeInTheDocument();
    expect(screen.getByText("Incomplete workflows first")).toBeInTheDocument();

    const visualScan = screen.getByTestId(`workflow-row-${APP_WORKFLOW_REFERENCES.visualScan}`);
    expect(within(visualScan).getByText("Visual scan")).toBeInTheDocument();
    expect(within(visualScan).getByText(/Unify image review paths/i)).toBeInTheDocument();
    expect(within(visualScan).getByText(/Ask before uploading/i)).toBeInTheDocument();
    expect(within(visualScan).getByText("Visual Scan")).toBeInTheDocument();
  });

  it("filters workflows by area and search text", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Filter by domain"), { target: { value: "medication" } });
    expect(screen.queryByTestId(`workflow-row-${APP_WORKFLOW_REFERENCES.visualScan}`)).not.toBeInTheDocument();
    const medicationResearch = screen.getByTestId(`workflow-row-${APP_WORKFLOW_REFERENCES.medicationResearch}`);
    expect(within(medicationResearch).getByText("Medication research")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search workflows"), { target: { value: "citations" } });
    expect(within(medicationResearch).getByText("Medication research")).toBeInTheDocument();
    expect(screen.queryByText("Home remedy questions")).not.toBeInTheDocument();
  });
});
