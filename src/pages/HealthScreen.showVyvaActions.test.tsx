import { fireEvent, render, screen } from "@testing-library/react";
import { Stethoscope } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { VisualScanResultPanel } from "./HealthScreen";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      i18n: { language: "en" },
      t: (_key: string, fallback?: string, options?: Record<string, string>) => {
        let value = fallback ?? _key;
        for (const [key, replacement] of Object.entries(options ?? {})) {
          value = value.replace(`{{${key}}}`, replacement);
        }
        return value;
      },
    }),
  };
});

const t = (_key: string, fallback?: string) => fallback ?? _key;

describe("Health visual Show VYVA follow-up actions", () => {
  it("routes prepare doctor question through the saved-task executor hook", () => {
    const onFollowUpSelect = vi.fn();

    render(
      <VisualScanResultPanel
        result={{
          severity: "Moderate",
          resultTitle: "Skin photo review",
          advice: "Ask a clinician if it changes.",
          imageType: "skin_lesion",
          visibleObservations: ["The area looks irritated."],
          potentialConcerns: ["A clinician should review changes."],
          uncertainty: ["A photo cannot confirm diagnosis."],
          recommendedNextStep: "Prepare a doctor question.",
        }}
        t={t}
        onClose={vi.fn()}
        actions={[{
          kind: "doctor_help",
          label: "Prepare doctor question",
          Icon: Stethoscope,
        }]}
        onFollowUpSelect={onFollowUpSelect}
      />,
    );

    fireEvent.click(screen.getByTestId("button-show-vyva-follow-up-doctor_help-health-current"));

    expect(onFollowUpSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "doctor_help",
        requiresConfirmation: true,
      }),
      expect.objectContaining({
        followUpContext: "health_visual",
        finalConfirmationRule: expect.stringContaining("confirm"),
      }),
    );
  });
});
