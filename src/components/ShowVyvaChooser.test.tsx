import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ShowVyvaChooser from "./ShowVyvaChooser";
import { SHOW_VYVA_USE_CASE_IDS } from "../../shared/showVyvaFlow";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe("ShowVyvaChooser", () => {
  it("starts camera review for the selected use case", () => {
    const onChooseFileSource = vi.fn();

    render(
      <ShowVyvaChooser
        defaultUseCaseId={SHOW_VYVA_USE_CASE_IDS.scamCheck}
        onChooseFileSource={onChooseFileSource}
      />,
    );

    fireEvent.change(screen.getByTestId("input-show-vyva-question"), {
      target: { value: "Does this look genuine?" },
    });
    fireEvent.click(screen.getByTestId("button-show-vyva-source-camera"));

    expect(onChooseFileSource).toHaveBeenCalledWith(
      "camera",
      expect.objectContaining({ id: SHOW_VYVA_USE_CASE_IDS.scamCheck }),
      "Does this look genuine?",
    );
  });

  it("lets users paste a link for a provider or deal review", () => {
    const onPaste = vi.fn();

    render(
      <ShowVyvaChooser
        defaultUseCaseId={SHOW_VYVA_USE_CASE_IDS.scamCheck}
        onChooseFileSource={vi.fn()}
        onPaste={onPaste}
      />,
    );

    fireEvent.click(screen.getByTestId(`button-show-vyva-use-case-${SHOW_VYVA_USE_CASE_IDS.providerOrDeal}`));
    fireEvent.change(screen.getByTestId("input-show-vyva-question"), {
      target: { value: "Is the price clearly explained?" },
    });
    fireEvent.click(screen.getByTestId("button-show-vyva-source-paste"));
    fireEvent.change(screen.getByTestId("textarea-show-vyva-paste"), {
      target: { value: "https://example.com/provider-quote" },
    });
    fireEvent.click(screen.getByTestId("button-show-vyva-submit-paste"));

    expect(onPaste).toHaveBeenCalledWith(
      {
        useCaseId: SHOW_VYVA_USE_CASE_IDS.providerOrDeal,
        source: "paste_link",
        value: "https://example.com/provider-quote",
        question: "Is the price clearly explained?",
      },
      expect.objectContaining({ id: SHOW_VYVA_USE_CASE_IDS.providerOrDeal }),
    );
  });

  it("shows the safety confirmation for each selected review type", () => {
    render(
      <ShowVyvaChooser
        defaultUseCaseId={SHOW_VYVA_USE_CASE_IDS.scamCheck}
        onChooseFileSource={vi.fn()}
        onPaste={vi.fn()}
      />,
    );

    expect(screen.getByTestId("text-show-vyva-confirmation")).toHaveTextContent("asks before forwarding");

    fireEvent.click(screen.getByTestId(`button-show-vyva-use-case-${SHOW_VYVA_USE_CASE_IDS.medicineOrOtc}`));

    expect(screen.getByTestId("text-show-vyva-confirmation")).toHaveTextContent("does not change doses");
  });
});
