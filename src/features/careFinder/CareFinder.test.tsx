import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import { CareFinder, type CareFinderProfile, type CareFinderServices } from "./CareFinder";
import { careFinderStateFromProgress, type CareFinderState } from "../../../shared/careFinder/flow";
import type { CareFinderResultOption, CareFinderSearchResponse } from "../../../shared/careFinder/search";

vi.mock("@/games/memory/useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({ isSupported: true, isListening: false, startListening: vi.fn(), stopListening: vi.fn() }),
}));

const profile: CareFinderProfile = {
  coverage: "public",
  location: "11380 Tarifa",
  usualDoctorName: null,
  usualDoctor: null,
};

function option(id: string, name: string, minutes: number, extra: Partial<CareFinderResultOption> = {}): CareFinderResultOption {
  const checkedAt = "2026-10-05T10:00:00.000Z";
  return {
    id,
    name,
    category: "Physiotherapist",
    care_type: "physiotherapy",
    address: `${name} street, Tarifa`,
    phone: "+34 956 000 000",
    maps_url: `https://maps.example/${id}`,
    source_label: "Google Maps",
    source_status: "reported",
    source_type: "directory",
    checked_at: checkedAt,
    travel_text: `${minutes} min by car`,
    travel_minutes: minutes,
    wheelchair_entrance: true,
    matched: ["Shows up on Google Maps for “Physiotherapist”"],
    assumptions: [],
    comparison: {
      distance: { value: `${minutes} min by car`, status: "reported", source: "Google Maps", sourceType: "directory", sourceUrl: null, checkedAt },
      accessibility: { value: "Step-free entrance listed", status: "reported", source: "Google Maps", sourceType: "directory", sourceUrl: null, checkedAt },
    },
    ...extra,
  };
}

const okResults: CareFinderSearchResponse = {
  status: "ok",
  careType: "physiotherapy",
  access: "private",
  location: "11380 Tarifa",
  orderedBy: "travel_time",
  checkedAt: "2026-10-05T10:00:00.000Z",
  mapsSearchUrl: "https://www.google.com/maps/search/?api=1&query=fisioterapia",
  options: [option("a", "Fisio Cerca", 4), option("b", "Fisio Centro", 9), option("c", "Fisio Lejos", 25)],
};

function renderFinder(overrides: {
  services?: CareFinderServices;
  initialState?: CareFinderState;
  profile?: CareFinderProfile | null;
  lang?: "en" | "es";
  onStateChange?: (state: CareFinderState) => void;
} = {}) {
  const services = overrides.services ?? { search: vi.fn(async () => okResults) };
  const utils = render(
    <CareFinder
      lang={overrides.lang ?? "en"}
      theme="light"
      profile={overrides.profile === undefined ? profile : overrides.profile}
      services={services}
      initialState={overrides.initialState}
      onStateChange={overrides.onStateChange}
      onExit={vi.fn()}
    />,
  );
  return { ...utils, services };
}

async function walkKneeJourneyToResults() {
  fireEvent.click(screen.getByTestId("choice-who-self"));
  fireEvent.change(screen.getByLabelText("Describe it in your own words"), { target: { value: "My knee has been hurting and stairs are difficult." } });
  fireEvent.click(screen.getByRole("button", { name: "Use my description" }));
  fireEvent.click(await screen.findByTestId("button-safety-none"));
  fireEvent.click(await screen.findByTestId("choice-urgency-this_week"));
  fireEvent.click(await screen.findByTestId("button-profile-accept"));
  fireEvent.click(await screen.findByTestId("button-route-physiotherapy"));
}

beforeEach(() => {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
});

describe("Care Finder journey", () => {
  it("turns an everyday description into up to three explainable options", async () => {
    const { services } = renderFinder();
    await walkKneeJourneyToResults();

    // Stairs were mentioned, so step-free access is pre-selected and explained.
    expect(screen.getByTestId("toggle-access-step_free")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/because you mentioned difficulty with stairs/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show physiotherapist near 11380 Tarifa" }));

    await screen.findByRole("heading", { name: "3 options for physiotherapist near 11380 Tarifa" });
    expect(services.search).toHaveBeenCalledWith({
      careType: "physiotherapy",
      access: "private",
      coverage: "public",
      location: "11380 Tarifa",
      accessNeeds: ["step_free"],
      language: "en",
    });
    expect(screen.getByText("Closest first. This order is not a quality ranking.")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    // Unknowns stay visible, never filled in.
    const first = screen.getByTestId("care-option-a");
    expect(within(first).getByText("Accepts your cover")).toBeInTheDocument();
    expect(within(first).getAllByText("Not known").length).toBeGreaterThan(0);
    expect(within(first).getAllByText("From Google Maps").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/\b(best|recommended|top rated)\b/i);
  });

  it("explains the starting point in plain language for public cover", async () => {
    renderFinder();
    fireEvent.click(screen.getByTestId("choice-who-self"));
    fireEvent.click(screen.getByTestId("choice-need-pain"));
    fireEvent.click(screen.getByTestId("button-safety-none"));
    fireEvent.click(screen.getByTestId("choice-urgency-this_week"));
    fireEvent.click(screen.getByTestId("button-profile-accept"));
    expect(screen.getByRole("heading", { name: "Where to start" })).toBeInTheDocument();
    expect(screen.getByText("A good place to start")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Family doctor (GP)" })).toBeInTheDocument();
    expect(screen.getByText(/It isn't a diagnosis/)).toBeInTheDocument();
  });

  it("keeps a running, editable summary of what VYVA understood", async () => {
    renderFinder();
    await walkKneeJourneyToResults();
    const summary = screen.getByTestId("care-finder-summary");
    expect(within(summary).getByText("“My knee has been hurting and stairs are difficult.”")).toBeInTheDocument();
    expect(within(summary).getByText("Public health system")).toBeInTheDocument();
    fireEvent.click(within(summary).getByRole("button", { name: "Change: Looking near" }));
    expect(await screen.findByRole("heading", { name: "Where should we look?" })).toBeInTheDocument();
    expect(screen.getByLabelText("Town or postcode")).toHaveValue("11380 Tarifa");
  });

  it("moves focus to each new question", async () => {
    renderFinder();
    fireEvent.click(screen.getByTestId("choice-who-self"));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "What's bothering you?" })));
  });
});

describe("urgent warning signs", () => {
  it("interrupts with emergency help before any search", async () => {
    const { services } = renderFinder();
    fireEvent.click(screen.getByTestId("choice-who-other"));
    fireEvent.change(screen.getByLabelText("Describe it in your own words"), { target: { value: "She has chest pain and her face is drooping" } });
    fireEvent.click(screen.getByRole("button", { name: "Use my description" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("heading", { name: "This may need help right now" })).toBeInTheDocument();
    expect(screen.getByTestId("link-call-112")).toHaveAttribute("href", "tel:112");
    // The summary cannot be used to skip past the warning.
    within(screen.getByTestId("care-finder-summary")).getAllByRole("button", { name: /^Change/ }).forEach((button) => expect(button).toBeDisabled());
    expect(services.search).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("button-urgent-not-now"));
    expect(await screen.findByRole("heading", { name: "Is any of this happening to them right now?" })).toBeInTheDocument();
  });

  it("offers the suicide prevention line first for thoughts of self-harm", async () => {
    renderFinder();
    fireEvent.click(screen.getByTestId("choice-who-self"));
    fireEvent.click(screen.getByTestId("choice-need-mood"));
    fireEvent.click(screen.getByTestId("choice-flag-self_harm"));
    const links = await screen.findAllByRole("link", { name: /Call 0?\d+/ });
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["tel:024", "tel:112"]);
  });
});

describe("contact safeguards", () => {
  async function openContact(onStateChange?: (state: CareFinderState) => void) {
    renderFinder({ onStateChange });
    await walkKneeJourneyToResults();
    fireEvent.click(screen.getByTestId("toggle-access-companion"));
    fireEvent.click(screen.getByTestId("button-show-options"));
    fireEvent.click(await screen.findByTestId("button-prepare-a"));
    await screen.findByRole("heading", { name: "Before you contact Fisio Cerca" });
  }

  it("never dials without an explicit second confirmation", async () => {
    await openContact();
    expect(document.querySelector('a[href^="tel:+34"]')).toBeNull();
    fireEvent.click(screen.getByTestId("button-care-call"));
    const dialog = screen.getByRole("dialog", { name: "Call Fisio Cerca?" });
    expect(within(dialog).getByText(/VYVA doesn't listen to or record the call/)).toBeInTheDocument();
    expect(within(dialog).getByTestId("link-confirm-call")).toHaveAttribute("href", "tel:+34956000000");
    fireEvent.click(within(dialog).getByRole("button", { name: "Not yet" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows exactly what will be shared and respects unticked items", async () => {
    await openContact();
    // The reason is private by default.
    expect(screen.getByTestId("toggle-share-reason")).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText(/The reason is/)).not.toBeInTheDocument();
    expect(screen.getByText("Stairs are hard for me. Is the entrance step-free, or is there a lift?")).toBeInTheDocument();
    expect(screen.getByText("Someone will come with me.")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-care-share-preview"));
    expect(screen.getByTestId("care-share-preview").textContent).not.toContain("knee");
    fireEvent.click(screen.getByTestId("toggle-share-reason"));
    expect(screen.getByTestId("care-share-preview").textContent).toContain("My knee has been hurting");
    expect(screen.getByText(/The reason is: "My knee has been hurting/)).toBeInTheDocument();
  });

  it("lists every unknown as a question to ask", async () => {
    await openContact();
    expect(screen.getByText("Can I be seen with my public health card, or is it paid?")).toBeInTheDocument();
    expect(screen.getByText("How much is the first visit?")).toBeInTheDocument();
  });
});

describe("search failures and empty results", () => {
  it("keeps answers and offers a retry when the search fails", async () => {
    const search = vi.fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(okResults);
    renderFinder({ services: { search } });
    await walkKneeJourneyToResults();
    fireEvent.click(screen.getByTestId("button-show-options"));
    expect(await screen.findByRole("heading", { name: "We couldn't search just now. Your answers are saved." })).toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    fireEvent.click(screen.getByTestId("button-care-retry"));
    await screen.findByRole("heading", { name: /3 options/ });
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("never invents options when nothing is found", async () => {
    const search = vi.fn(async () => ({ ...okResults, status: "no_results" as const, options: [] }));
    renderFinder({ services: { search } });
    await walkKneeJourneyToResults();
    fireEvent.click(screen.getByTestId("button-show-options"));
    expect(await screen.findByRole("heading", { name: "We didn't find any physiotherapist near 11380 Tarifa that we could check." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search Google Maps yourself (not checked by VYVA)" })).toHaveAttribute("href", okResults.mapsSearchUrl);
    expect(screen.getByRole("button", { name: "Try a different place" })).toBeInTheDocument();
  });
});

describe("profile reuse and resume", () => {
  it("asks for cover and place directly when nothing is saved", async () => {
    renderFinder({ profile: null });
    fireEvent.click(screen.getByTestId("choice-who-self"));
    fireEvent.click(screen.getByTestId("choice-need-checkup"));
    fireEvent.click(screen.getByTestId("choice-urgency-few_weeks"));
    expect(await screen.findByRole("heading", { name: "How is your health care paid for?" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("choice-coverage-private"));
    expect(await screen.findByRole("heading", { name: "Where should we look?" })).toBeInTheDocument();
  });

  it("resumes a legacy specialist task with its description and an honest notice", () => {
    const legacy = careFinderStateFromProgress({
      providerSearchMode: "specialist",
      query: "dolor de rodilla",
      providerResult: { options: [{ name: "Residencia Las Flores" }] },
    }, { updatedAt: "2026-09-30T09:00:00.000Z" });
    renderFinder({ initialState: legacy });
    expect(screen.getByText(/We've improved how VYVA searches for health care/)).toBeInTheDocument();
    expect(screen.queryByText("Residencia Las Flores")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("choice-who-self"));
    expect(screen.getByLabelText("Describe it in your own words")).toHaveValue("dolor de rodilla");
  });

  it("reports every state change for saving", async () => {
    const onStateChange = vi.fn();
    renderFinder({ onStateChange });
    fireEvent.click(screen.getByTestId("choice-who-self"));
    await waitFor(() => expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ who: "self", step: "need" })));
  });

  it("speaks Spanish throughout when the app is in Spanish", () => {
    renderFinder({ lang: "es" });
    expect(screen.getByRole("heading", { name: "¿Para quién es la atención?" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("choice-who-self"));
    expect(screen.getByRole("heading", { name: "¿Qué le pasa?" })).toBeInTheDocument();
  });
});

describe("accessibility", () => {
  async function expectNoViolations(container: HTMLElement) {
    const result = await axe.run(container, {
      // jsdom cannot compute colours; contrast is checked in the browser suite.
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
  }

  it("has no axe violations on the first question and the results", async () => {
    const { container } = renderFinder();
    await expectNoViolations(container);

    await walkKneeJourneyToResults();
    fireEvent.click(screen.getByTestId("button-show-options"));
    await screen.findByRole("heading", { name: /3 options/ });
    await act(async () => {
      await expectNoViolations(container);
    });
  });

  it("has no axe violations on the urgent screen", async () => {
    const { container } = renderFinder();
    fireEvent.click(screen.getByTestId("choice-who-self"));
    fireEvent.click(screen.getByTestId("choice-need-unwell"));
    fireEvent.click(screen.getByTestId("choice-flag-stroke"));
    await screen.findByTestId("care-urgent");
    await expectNoViolations(container);
  });

  it("uses large, named controls with state exposed to assistive tech", async () => {
    renderFinder();
    await walkKneeJourneyToResults();
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAccessibleName();
    }
    expect(screen.getByTestId("toggle-access-home_visit")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("toggle-access-step_free").className).toContain("min-h-[72px]");
  });
});
