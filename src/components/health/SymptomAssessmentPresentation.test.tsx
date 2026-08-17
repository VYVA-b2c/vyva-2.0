import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  SYMPTOM_ASSESSMENT_APPROVED_FRAME_BY_STAGE,
  SymptomAssessmentPresentation,
} from "./SymptomAssessmentPresentation";
import { SYMPTOM_ASSESSMENT_STAGE_IDS } from "@/design/screenPresentation";

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
    }
  });
});
