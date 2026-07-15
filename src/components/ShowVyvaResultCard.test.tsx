import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ShowVyvaResultCard from "./ShowVyvaResultCard";
import {
  SHOW_VYVA_REVIEW_INPUT_TYPES,
  buildShowVyvaReviewContract,
} from "../../shared/showVyvaReviewContract";
import { SHOW_VYVA_USE_CASE_IDS } from "../../shared/showVyvaFlow";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe("ShowVyvaResultCard", () => {
  it("renders the required shared result sections and safe action controls", () => {
    const contract = buildShowVyvaReviewContract({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.scamCheck,
      source: "paste_text",
      value: "Call +34 600 111 222 now",
      concernSummary: "Suspicious phone number",
      riskLevel: "high",
      confidenceLevel: "medium",
      noticed: ["The number asks for fast action.", "The request could expose private details."],
      safeNextSteps: ["Do not call back yet.", "Ask VYVA to verify the source first."],
    });
    const onActionSelect = vi.fn();

    render(
      <ShowVyvaResultCard
        contract={contract}
        testIdSuffix="phone"
        reviewedLabel="Phone number: +34 600 111 222"
        onActionSelect={onActionSelect}
      />,
    );

    expect(screen.getByText("What VYVA reviewed")).toBeInTheDocument();
    expect(screen.getByText("What VYVA thinks")).toBeInTheDocument();
    expect(screen.getByText("Risk or urgency")).toBeInTheDocument();
    expect(screen.getByText("Recommended next step")).toBeInTheDocument();
    expect(screen.getByText("Ask VYVA to help or save for later")).toBeInTheDocument();
    expect(screen.getByTestId("show-vyva-result-reviewed-phone")).toHaveTextContent("+34 600 111 222");
    expect(screen.getByTestId("show-vyva-result-input-phone")).toHaveTextContent("Phone number");
    expect(screen.getByTestId("show-vyva-result-risk-phone")).toHaveTextContent("High risk");
    expect(screen.getByText(/must confirm before anything/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-show-vyva-follow-up-scam_concierge-phone"));

    expect(onActionSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "scam_concierge", requiresConfirmation: true }),
      expect.objectContaining({ finalConfirmationRequired: true }),
    );
  });

  it("uses one display shape for links, documents, medicine, shopping checks, and safety photos", () => {
    const contracts = [
      buildShowVyvaReviewContract({
        useCaseId: SHOW_VYVA_USE_CASE_IDS.providerOrDeal,
        source: "paste_link",
        value: "https://example.com/offer",
        concernSummary: "Compare this offer",
      }),
      buildShowVyvaReviewContract({
        useCaseId: SHOW_VYVA_USE_CASE_IDS.documentHelp,
        source: "upload",
        fileName: "insurance-form.pdf",
        mimeType: "application/pdf",
        concernSummary: "Insurance form",
      }),
      buildShowVyvaReviewContract({
        useCaseId: SHOW_VYVA_USE_CASE_IDS.medicineOrOtc,
        source: "camera",
        hint: SHOW_VYVA_REVIEW_INPUT_TYPES.cameraPhoto,
        concernSummary: "Medicine label",
      }),
      buildShowVyvaReviewContract({
        useCaseId: SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto,
        source: "camera",
        concernSummary: "Loose rug",
      }),
    ];

    for (const [index, contract] of contracts.entries()) {
      const { unmount } = render(
        <ShowVyvaResultCard
          contract={contract}
          testIdSuffix={`case-${index}`}
          onActionSelect={vi.fn()}
        />,
      );

      expect(screen.getByTestId(`show-vyva-result-case-${index}`)).toBeInTheDocument();
      expect(screen.getByText("What VYVA reviewed")).toBeInTheDocument();
      expect(screen.getByText("What VYVA thinks")).toBeInTheDocument();
      expect(screen.getByText("Risk or urgency")).toBeInTheDocument();
      expect(screen.getByText("Recommended next step")).toBeInTheDocument();
      expect(screen.getByText("Ask VYVA to help or save for later")).toBeInTheDocument();
      expect(screen.getByText(/must confirm before anything/i)).toBeInTheDocument();
      unmount();
    }
  });
});
