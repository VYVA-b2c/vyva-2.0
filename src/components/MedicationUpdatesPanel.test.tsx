import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MedicationUpdatesResponse } from "../../shared/medicationUpdates";
import MedicationUpdatesPanel, { buildMedicationUpdateHandoffContext } from "./MedicationUpdatesPanel";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => queryMock(),
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

const response: MedicationUpdatesResponse = {
  generatedAt: "2026-07-17T10:00:00.000Z",
  language: "en",
  countryCode: "US",
  medications: [{ medicationName: "Metformin", activeIngredient: "Metformin", countryCode: "US" }],
  notice: "Official-source information only. Review anything relevant with your doctor or pharmacist.",
  sources: [
    {
      authority: "FDA",
      authorityLabel: "U.S. Food and Drug Administration",
      status: "available",
      checkedAt: "2026-07-17T10:00:00.000Z",
      message: "Official records found.",
    },
    {
      authority: "AEMPS",
      authorityLabel: "AEMPS (Spain)",
      status: "no_match",
      checkedAt: "2026-07-17T10:00:00.000Z",
      message: "No matching official record was found.",
    },
    {
      authority: "PubMed",
      authorityLabel: "PubMed / U.S. National Library of Medicine",
      status: "unavailable",
      checkedAt: "2026-07-17T10:00:00.000Z",
      message: "This official source could not be checked right now.",
    },
  ],
  updates: [{
    id: "update-1",
    medicationName: "Metformin",
    kind: "general_information",
    summary: "FDA has an official product-information record for Metformin.",
    sourceExcerpt: "Original FDA label wording.",
    discussionQuestions: [
      "What changed in the official product information?",
      "Does any part of this update apply to my health history?",
    ],
    freshness: "current",
    verification: "verified",
    verificationReasons: [],
    match: {
      requestedName: "Metformin",
      requestedIngredient: "Metformin",
      requestedFormulation: null,
      matchedName: "Metformin hydrochloride",
      matchedIngredient: "Metformin hydrochloride",
      matchedFormulation: null,
      confidence: "ingredient",
    },
    source: {
      authority: "FDA",
      authorityLabel: "U.S. Food and Drug Administration",
      title: "Metformin hydrochloride - FDA product label",
      publisher: "U.S. Food and Drug Administration",
      url: "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=set-123",
      publishedAt: "2026-03-15T00:00:00.000Z",
      retrievedAt: "2026-07-17T10:00:00.000Z",
      originalLanguage: "en",
      jurisdiction: "United States",
      recordId: "fda-label-1",
    },
  }],
};

describe("MedicationUpdatesPanel", () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockReturnValue({
      data: response,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  afterEach(() => cleanup());

  it("shows source, date, original wording, and honest source status", () => {
    render(
      <MedicationUpdatesPanel
        open
        onOpenChange={vi.fn()}
        language="en"
        onPrepareAppointment={vi.fn()}
      />,
    );

    expect(screen.getByTestId("modal-medication-updates")).toHaveTextContent("Official evidence, not an AI answer");
    expect(screen.getByTestId("medication-update-update-1")).toHaveTextContent("Metformin hydrochloride - FDA product label");
    expect(screen.getByTestId("medication-update-update-1")).toHaveTextContent("U.S. Food and Drug Administration");
    expect(screen.getByTestId("medication-update-update-1")).toHaveTextContent("United States");
    expect(screen.getByTestId("medication-update-update-1")).toHaveTextContent("Verified");
    expect(screen.getByTestId("medication-update-update-1")).toHaveTextContent("What changed in the official product information?");
    expect(screen.getByTestId("modal-medication-updates")).toHaveTextContent("AEMPS");
    expect(screen.getByTestId("modal-medication-updates")).toHaveTextContent("no_match");
    expect(screen.getByTestId("modal-medication-updates")).toHaveTextContent("PubMed");
    expect(screen.getByTestId("modal-medication-updates")).toHaveTextContent("unavailable");

    const sourceLink = screen.getByTestId("medication-update-source-update-1");
    expect(sourceLink).toHaveAttribute(
      "href",
      "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=set-123",
    );
    expect(sourceLink).toHaveAttribute("target", "_blank");
  });

  it("shows why uncertain evidence is not verified", () => {
    queryMock.mockReturnValue({
      data: {
        ...response,
        updates: [{
          ...response.updates[0],
          verification: "not_verified",
          verificationReasons: ["possible_match", "formulation_unconfirmed"],
          match: { ...response.updates[0].match, confidence: "possible" },
        }],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(
      <MedicationUpdatesPanel
        open
        onOpenChange={vi.fn()}
        language="en"
        onPrepareAppointment={vi.fn()}
      />,
    );

    expect(screen.getByTestId("medication-update-unverified-update-1")).toHaveTextContent("possible match");
    expect(screen.getByTestId("medication-update-unverified-update-1")).toHaveTextContent("formulation unconfirmed");
  });

  it("requires a second explicit confirmation before preparing an appointment handoff", () => {
    const onPrepareAppointment = vi.fn();
    render(
      <MedicationUpdatesPanel
        open
        onOpenChange={vi.fn()}
        language="en"
        onPrepareAppointment={onPrepareAppointment}
      />,
    );

    fireEvent.click(screen.getByTestId("button-prepare-medication-update-handoff"));

    expect(onPrepareAppointment).not.toHaveBeenCalled();
    expect(screen.getByTestId("medication-updates-handoff-confirmation")).toHaveTextContent(
      "Nothing will be booked or sent until you confirm again in Concierge.",
    );

    fireEvent.click(screen.getByTestId("button-confirm-medication-update-handoff"));

    expect(onPrepareAppointment).toHaveBeenCalledTimes(1);
    const context = onPrepareAppointment.mock.calls[0][0] as string;
    expect(context).toContain("Metformin");
    expect(context).toContain("U.S. Food and Drug Administration");
    expect(context).toContain("2026-03-15T00:00:00.000Z");
    expect(context).toContain("https://dailymed.nlm.nih.gov/");
    expect(context).toContain("What changed in the official product information?");
  });

  it("does not offer an appointment handoff when no verified update exists", () => {
    queryMock.mockReturnValue({
      data: { ...response, updates: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(
      <MedicationUpdatesPanel
        open
        onOpenChange={vi.fn()}
        language="en"
        onPrepareAppointment={vi.fn()}
      />,
    );

    expect(screen.getByTestId("medication-updates-empty")).toHaveTextContent("No matching official updates found");
    expect(screen.queryByTestId("button-prepare-medication-update-handoff")).not.toBeInTheDocument();
  });

  it("asks the user to add a medicine without claiming official sources were checked", () => {
    queryMock.mockReturnValue({
      data: { ...response, medications: [], updates: [], sources: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(
      <MedicationUpdatesPanel
        open
        onOpenChange={vi.fn()}
        language="en"
        onPrepareAppointment={vi.fn()}
      />,
    );

    expect(screen.getByTestId("medication-updates-empty")).toHaveTextContent("Add a medicine first");
    expect(screen.queryByLabelText("Sources checked")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-prepare-medication-update-handoff")).not.toBeInTheDocument();
  });

  it("builds a bounded handoff with source evidence and clinician questions", () => {
    const context = buildMedicationUpdateHandoffContext(response.updates, {
      heading: "Official medication update review",
      source: "Source",
      questions: "Questions",
    });

    expect(context).toContain("Official medication update review");
    expect(context).toContain("Source: U.S. Food and Drug Administration");
    expect(context).toContain("Questions: What changed");
  });
});
