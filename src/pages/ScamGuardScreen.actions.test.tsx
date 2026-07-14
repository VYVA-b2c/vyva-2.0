import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ScamGuardActionButtons,
  scamGuardConciergeState,
  scamGuardContextSummary,
  type ScamGuardActionContext,
} from "./ScamGuardScreen";

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

const suspiciousContext: ScamGuardActionContext = {
  riskLevel: "suspicious",
  resultTitle: "Possible bank impersonation",
  explanation: "The message asks for account access through an unfamiliar link.",
  steps: ["Do not click the link.", "Call a trusted person.", "Use the bank website directly."],
};

describe("Scam Guard service actions", () => {
  it("builds a confirmation-led concierge task with scam context", () => {
    const state = scamGuardConciergeState(suspiciousContext, "en");

    expect(state.conciergePrefill).toEqual({
      kind: "task",
      source: "scam_guard",
      message: expect.stringContaining("Do not send anything or contact anyone without confirming with me first."),
    });
    expect(state.conciergePrefill.message).toContain("Risk: suspicious");
    expect(state.conciergePrefill.message).toContain("Possible bank impersonation");
    expect(scamGuardContextSummary(suspiciousContext)).toContain("Recommended steps");
  });

  it("renders direct trusted-contact plus scam-safe follow-up actions", () => {
    const onOpenConcierge = vi.fn();
    const onStartGuidance = vi.fn();
    const onAddTrustedContact = vi.fn();

    render(
      <ScamGuardActionButtons
        context={suspiciousContext}
        trustedContactName="Maria"
        trustedContactHref="tel:+34612345678"
        onOpenConcierge={onOpenConcierge}
        onStartGuidance={onStartGuidance}
        onAddTrustedContact={onAddTrustedContact}
        testIdSuffix="current"
      />,
    );

    expect(screen.getByTestId("show-vyva-follow-up-current")).toBeInTheDocument();
    expect(screen.getByText("Next scam-safe step")).toBeInTheDocument();
    expect(screen.getByText("Check company")).toBeInTheDocument();
    expect(screen.getByText("Call Maria")).toBeInTheDocument();
    expect(screen.getByText("Save or report")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-show-vyva-follow-up-check_company-current"));
    fireEvent.click(screen.getByTestId("button-show-vyva-follow-up-scam_concierge-current"));
    expect(onOpenConcierge).toHaveBeenCalledTimes(2);
    expect(onOpenConcierge).toHaveBeenLastCalledWith(suspiciousContext);
    expect(onStartGuidance).not.toHaveBeenCalled();
    expect(onAddTrustedContact).not.toHaveBeenCalled();
  });

  it("offers trusted-contact setup when no phone is saved", () => {
    const onAddTrustedContact = vi.fn();

    render(
      <ScamGuardActionButtons
        context={suspiciousContext}
        onOpenConcierge={vi.fn()}
        onStartGuidance={vi.fn()}
        onAddTrustedContact={onAddTrustedContact}
        testIdSuffix="saved"
      />,
    );

    fireEvent.click(screen.getByTestId("button-show-vyva-follow-up-call_trusted_contact-saved"));
    expect(onAddTrustedContact).toHaveBeenCalled();
  });
});
