import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShowVyvaCaptureCoach from "./ShowVyvaCaptureCoach";
import type { ShowVyvaPreparedEvidence } from "@/lib/showVyvaEvidence";
import { SHOW_VYVA_USE_CASE_IDS } from "../../shared/showVyvaFlow";

const { rotateEvidenceMock } = vi.hoisted(() => ({
  rotateEvidenceMock: vi.fn(),
}));

vi.mock("@/lib/showVyvaEvidence", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/showVyvaEvidence")>();
  return { ...original, rotateShowVyvaPreparedEvidence: rotateEvidenceMock };
});

vi.mock("react-i18next", async (importOriginal) => {
  const original = await importOriginal<typeof import("react-i18next")>();
  return {
    ...original,
    useTranslation: () => ({
      t: (key: string, fallback?: string) => typeof fallback === "string" ? fallback : key,
    }),
  };
});

const imageEvidence: ShowVyvaPreparedEvidence = {
  dataUrl: "data:image/jpeg;base64,preview",
  fileName: "medicine-label.jpg",
  mimeType: "image/jpeg",
  kind: "image",
  reviewedPage: null,
  qualityIssues: ["dark", "blur"],
  metrics: null,
};

describe("ShowVyvaCaptureCoach", () => {
  beforeEach(() => {
    rotateEvidenceMock.mockReset();
  });

  it("shows use-case guidance, quality warnings, and the evidence privacy review", () => {
    render(
      <ShowVyvaCaptureCoach
        evidence={imageEvidence}
        useCaseId={SHOW_VYVA_USE_CASE_IDS.medicineOrOtc}
        onUse={vi.fn()}
        onRetake={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId("text-show-vyva-capture-instruction")).toHaveTextContent("full front label");
    expect(screen.getByTestId("text-show-vyva-quality-dark")).toHaveTextContent("too dark");
    expect(screen.getByTestId("text-show-vyva-quality-blur")).toHaveTextContent("blurry");
    expect(screen.getByTestId("section-show-vyva-capture-privacy")).toHaveTextContent("image itself is not saved");
    expect(screen.getByTestId("image-show-vyva-capture-preview")).toHaveAttribute("src", imageEvidence.dataUrl);
  });

  it("keeps retake separate from the explicit use confirmation", () => {
    const onUse = vi.fn();
    const onRetake = vi.fn();
    render(
      <ShowVyvaCaptureCoach
        evidence={imageEvidence}
        useCaseId={SHOW_VYVA_USE_CASE_IDS.scamCheck}
        onUse={onUse}
        onRetake={onRetake}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("button-show-vyva-capture-retake"));
    expect(onRetake).toHaveBeenCalledTimes(1);
    expect(onUse).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("button-show-vyva-capture-use"));
    expect(onUse).toHaveBeenCalledWith(imageEvidence);
  });

  it("clearly identifies first-page PDF review", () => {
    render(
      <ShowVyvaCaptureCoach
        evidence={{
          ...imageEvidence,
          fileName: "letter.pdf",
          mimeType: "application/pdf",
          kind: "pdf",
          reviewedPage: 1,
          qualityIssues: [],
        }}
        useCaseId={SHOW_VYVA_USE_CASE_IDS.documentHelp}
        onUse={vi.fn()}
        onRetake={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("PDF - first page")).toBeInTheDocument();
    expect(screen.getByTestId("section-show-vyva-capture-quality")).toHaveTextContent("clear enough");
    expect(screen.queryByTestId("button-show-vyva-capture-rotate")).not.toBeInTheDocument();
  });

  it("lets the user rotate an image before confirming it", async () => {
    const rotatedEvidence = { ...imageEvidence, dataUrl: "data:image/jpeg;base64,rotated" };
    rotateEvidenceMock.mockResolvedValue(rotatedEvidence);
    const onUse = vi.fn();
    render(
      <ShowVyvaCaptureCoach
        evidence={imageEvidence}
        useCaseId={SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto}
        onUse={onUse}
        onRetake={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("button-show-vyva-capture-rotate"));
    await waitFor(() => expect(screen.getByTestId("image-show-vyva-capture-preview")).toHaveAttribute("src", rotatedEvidence.dataUrl));
    fireEvent.click(screen.getByTestId("button-show-vyva-capture-use"));
    expect(onUse).toHaveBeenCalledWith(rotatedEvidence);
  });
});
