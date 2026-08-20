import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  SYMPTOM_ASSESSMENT_APPROVED_FRAME_BY_STAGE,
  SymptomAssessmentPresentation,
} from "./SymptomAssessmentPresentation";
import { SYMPTOM_ASSESSMENT_STAGE_IDS } from "@/design/screenPresentation";
import { resolveSymptomAssessmentPresentation } from "@/design/screenPresentation";

afterEach(cleanup);

describe("SymptomAssessmentPresentation", () => {
  it.each(SYMPTOM_ASSESSMENT_STAGE_IDS)("renders both approved %s presentation variants", (stageId) => {
    render(
      <>
        <SymptomAssessmentPresentation stageId={stageId} modality="voice" />
        <SymptomAssessmentPresentation stageId={stageId} modality="touch" />
      </>,
    );

    for (const modality of ["voice", "touch"] as const) {
      expect(screen.getByTestId(`symptom-presentation-${stageId}-${modality}`)).toHaveAttribute(
        "data-approved-frame",
        SYMPTOM_ASSESSMENT_APPROVED_FRAME_BY_STAGE[stageId],
      );
      expect(screen.getByTestId(`symptom-presentation-${stageId}-${modality}`)).toHaveAttribute(
        "data-presentation-modality",
        modality,
      );
      expect(screen.getByTestId(`symptom-presentation-${stageId}-${modality}`)).toHaveAttribute(
        "data-flow-id",
        "health.symptom_assessment",
      );
      expect(screen.getByTestId(`symptom-presentation-${stageId}-${modality}`)).toHaveAttribute(
        "data-presentation-id",
        modality === "voice"
          ? resolveSymptomAssessmentPresentation(stageId).voiceSceneId
          : resolveSymptomAssessmentPresentation(stageId).touchSceneId,
      );
    }
  });

  it("keeps the approved mobile Touch selected-control state child-owned and interactive", () => {
    function SelectedControlFixture() {
      const [selected, setSelected] = useState(false);
      return (
        <SymptomAssessmentPresentation stageId="symptom_selection" modality="touch">
          <button
            aria-pressed={selected}
            data-presentation-state={selected ? "selected" : "default"}
            data-testid="symptom-option-aches"
            type="button"
            onClick={() => setSelected((current) => !current)}
          >
            Aches or discomfort
          </button>
        </SymptomAssessmentPresentation>
      );
    }

    render(<SelectedControlFixture />);

    const option = screen.getByTestId("symptom-option-aches");
    expect(option).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(option);
    expect(option).toHaveAttribute("aria-pressed", "true");
    expect(option).toHaveAttribute("data-presentation-state", "selected");
  });

  it("renders the approved mobile Touch validation-error state without advancing", () => {
    render(
      <SymptomAssessmentPresentation stageId="severity" modality="touch">
        <div data-presentation-state="validation-error" role="alert">Choose a severity to continue.</div>
        <button disabled type="button">Continue</button>
      </SymptomAssessmentPresentation>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Choose a severity to continue.");
    expect(screen.getByRole("alert")).toHaveAttribute("data-presentation-state", "validation-error");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("renders the approved mobile Voice generic-error state with a retry child action", () => {
    let retried = false;
    render(
      <SymptomAssessmentPresentation stageId="checking" modality="voice">
        <div data-presentation-state="error" role="alert">
          <p>Something went wrong.</p>
          <button type="button" onClick={() => { retried = true; }}>Retry</button>
        </div>
      </SymptomAssessmentPresentation>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong.");
    expect(screen.getByRole("alert")).toHaveAttribute("data-presentation-state", "error");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retried).toBe(true);
    expect(screen.getByTestId("symptom-presentation-checking-voice")).toHaveAttribute(
      "data-presentation-state",
      "loading",
    );
  });

  it("renders the approved mobile Touch completed state without owning final actions", () => {
    let action = "";
    render(
      <SymptomAssessmentPresentation stageId="save_share_summary" modality="touch">
        <div data-presentation-state="completed" role="status">Saved</div>
        <button type="button" onClick={() => { action = "share"; }}>Share</button>
        <button type="button" onClick={() => { action = "done"; }}>Done</button>
      </SymptomAssessmentPresentation>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.getByRole("status")).toHaveAttribute("data-presentation-state", "completed");
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(action).toBe("share");
    expect(screen.getByTestId("symptom-presentation-save_share_summary-touch")).toHaveAttribute(
      "data-presentation-state",
      "default",
    );
  });
});
