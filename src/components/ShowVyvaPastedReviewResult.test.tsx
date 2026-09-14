import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ShowVyvaPastedReviewResult from "./ShowVyvaPastedReviewResult";
import { SHOW_VYVA_USE_CASE_IDS } from "../../shared/showVyvaFlow";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe("ShowVyvaPastedReviewResult", () => {
  it("shows a phone-number review before any safe follow-up action", () => {
    const onActionSelect = vi.fn();

    render(
      <ShowVyvaPastedReviewResult
        payload={{
          useCaseId: SHOW_VYVA_USE_CASE_IDS.scamCheck,
          source: "paste_text",
          value: "+34 600 111 222",
        }}
        testIdSuffix="phone"
        onClose={vi.fn()}
        onActionSelect={onActionSelect}
      />,
    );

    expect(screen.getByTestId("show-vyva-pasted-review-phone")).toBeInTheDocument();
    expect(screen.getByTestId("show-vyva-result-input-phone")).toHaveTextContent("Phone number");
    expect(screen.queryByText("What VYVA reviewed")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-show-vyva-explain-phone"));
    expect(screen.getByText("What VYVA reviewed")).toBeInTheDocument();
    expect(screen.getByTestId("show-vyva-result-reviewed-phone")).toHaveTextContent("+34 600 111 222");
    expect(screen.getByText("Choose a safe action")).toBeInTheDocument();
    expect(screen.getByText(/must confirm before anything/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-show-vyva-follow-up-block_or_report-phone"));

    expect(onActionSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "block_or_report" }),
      expect.objectContaining({
        inputType: "phone_number",
        reviewedValue: "+34 600 111 222",
        finalConfirmationRequired: true,
      }),
    );
  });

  it("uses the same result shell for links, document text, and company checks", () => {
    const cases = [
      {
        suffix: "link",
        payload: {
          useCaseId: SHOW_VYVA_USE_CASE_IDS.providerOrDeal,
          source: "paste_link" as const,
          value: "https://example.com/offer",
        },
        input: "Pasted link",
        action: "button-show-vyva-follow-up-find_alternatives-link",
      },
      {
        suffix: "document",
        payload: {
          useCaseId: SHOW_VYVA_USE_CASE_IDS.documentHelp,
          source: "paste_text" as const,
          value: "Insurance claim deadline: Friday",
        },
        input: "Document text",
        action: "button-show-vyva-follow-up-save_note-document",
      },
      {
        suffix: "company",
        payload: {
          useCaseId: SHOW_VYVA_USE_CASE_IDS.scamCheck,
          source: "paste_text" as const,
          value: "Example Energy SL",
        },
        input: "Company name",
        action: "button-show-vyva-follow-up-block_or_report-company",
      },
    ];

    for (const item of cases) {
      const { unmount } = render(
        <ShowVyvaPastedReviewResult
          payload={item.payload}
          testIdSuffix={item.suffix}
          onClose={vi.fn()}
          onActionSelect={vi.fn()}
        />,
      );

      expect(screen.getByTestId(`show-vyva-result-${item.suffix}`)).toBeInTheDocument();
      fireEvent.click(screen.getByTestId(`button-show-vyva-explain-${item.suffix}`));
      expect(screen.getByText("What VYVA reviewed")).toBeInTheDocument();
      expect(screen.getByText("What is visible")).toBeInTheDocument();
      expect(screen.getByText("Risk or urgency")).toBeInTheDocument();
      expect(screen.getByText("Recommended next step")).toBeInTheDocument();
      expect(screen.getByTestId(`show-vyva-result-input-${item.suffix}`)).toHaveTextContent(item.input);
      expect(screen.getByTestId(item.action)).toBeInTheDocument();
      unmount();
    }
  });
});
