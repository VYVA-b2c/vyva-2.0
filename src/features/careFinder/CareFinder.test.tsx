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
    origin: "google_places",
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
  lang?: "en" | "es" | "fr" | "de";
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
    await screen.findByRole("heading", { name: "Fisio Cerca" });
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

  it("offers the register email, and includes it in what is shared", async () => {
    const withEmail = { ...okResults, options: [{ ...okResults.options[0], email: "cita@fisiocerca.es" }, ...okResults.options.slice(1)] };
    renderFinder({ services: { search: vi.fn(async () => withEmail) } });
    await walkKneeJourneyToResults();
    fireEvent.click(screen.getByTestId("button-show-options"));
    fireEvent.click(await screen.findByTestId("button-prepare-a"));
    expect(await screen.findByTestId("link-care-email")).toHaveAttribute("href", "mailto:cita@fisiocerca.es");
    expect(screen.getByTestId("link-care-email")).toHaveTextContent("Email");
    fireEvent.click(screen.getByTestId("button-care-share-preview"));
    expect(screen.getByTestId("care-share-preview").textContent).toContain("Email: cita@fisiocerca.es");
  });

  it("shows no email link when the place has none", async () => {
    await openContact();
    expect(screen.queryByTestId("link-care-email")).not.toBeInTheDocument();
  });

  it("shows the place's details and ways to reach it, with no call script", async () => {
    await openContact();
    expect(screen.getByText("Fisio Cerca street, Tarifa")).toBeInTheDocument();
    expect(screen.queryByText("What you could say")).not.toBeInTheDocument();
    expect(screen.queryByText(/Stairs are hard for me/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-care-share-preview"));
    expect(screen.getByTestId("care-share-preview").textContent).not.toContain("knee");
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

describe("French and German", () => {
  it("runs the knee journey in French", async () => {
    renderFinder({ lang: "fr" });
    expect(screen.getByRole("heading", { name: "Pour qui sont les soins ?" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("choice-who-self"));
    fireEvent.change(screen.getByLabelText("Décrivez-le avec vos mots"), { target: { value: "J'ai mal au genou et les escaliers sont difficiles" } });
    fireEvent.click(screen.getByRole("button", { name: "Utiliser ma description" }));
    fireEvent.click(await screen.findByTestId("button-safety-none"));
    fireEvent.click(await screen.findByTestId("choice-urgency-this_week"));
    fireEvent.click(await screen.findByTestId("button-profile-accept"));
    expect(screen.getByRole("heading", { name: "Médecin de famille (généraliste)" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-route-physiotherapy"));
    expect(screen.getByTestId("toggle-access-step_free")).toHaveAttribute("aria-pressed", "true");
    // Offered because the person isn't using Spanish.
    expect(screen.getByTestId("toggle-access-english")).toHaveTextContent("Personnel parlant français");
    fireEvent.click(screen.getByTestId("toggle-access-english"));
    fireEvent.click(screen.getByTestId("button-show-options"));
    fireEvent.click(await screen.findByTestId("button-prepare-a"));
    expect(await screen.findByRole("heading", { name: "Fisio Cerca" })).toBeInTheDocument();
    expect(screen.getByTestId("button-care-call")).toHaveTextContent("Appeler Fisio Cerca");
  });

  it("shows the emergency screen for French and German warning signs", async () => {
    const { unmount } = renderFinder({ lang: "fr" });
    fireEvent.click(screen.getByTestId("choice-who-other"));
    fireEvent.change(screen.getByLabelText("Décrivez-le avec vos mots"), { target: { value: "Elle a une douleur dans la poitrine" } });
    fireEvent.click(screen.getByRole("button", { name: "Utiliser ma description" }));
    expect(await screen.findByRole("heading", { name: "Cela peut nécessiter de l'aide tout de suite" })).toBeInTheDocument();
    expect(screen.getByTestId("link-call-112")).toHaveTextContent("Appeler le 112");
    unmount();

    renderFinder({ lang: "de" });
    fireEvent.click(screen.getByTestId("choice-who-self"));
    fireEvent.change(screen.getByLabelText("Beschreiben Sie es mit eigenen Worten"), { target: { value: "Ich bekomme keine Luft" } });
    fireEvent.click(screen.getByRole("button", { name: "Meine Beschreibung verwenden" }));
    expect(await screen.findByRole("heading", { name: "Das braucht vielleicht sofort Hilfe" })).toBeInTheDocument();
    expect(screen.getByTestId("link-call-112")).toHaveTextContent("112 anrufen");
  });

  it("keeps German nouns capitalised", async () => {
    renderFinder({ lang: "de" });
    fireEvent.click(screen.getByTestId("choice-who-self"));
    fireEvent.click(screen.getByTestId("choice-need-pain"));
    fireEvent.click(screen.getByTestId("button-safety-none"));
    fireEvent.click(screen.getByTestId("choice-urgency-this_week"));
    fireEvent.click(screen.getByTestId("button-profile-accept"));
    expect(screen.getByRole("button", { name: "Suchen: Physiotherapeut" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-route-physiotherapy"));
    expect(screen.getByRole("button", { name: "Physiotherapeut in der Nähe von 11380 Tarifa anzeigen" })).toBeInTheDocument();
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

describe("public cover: your own health centre", () => {
  const publicState = () => careFinderStateFromProgress({
    canvasStep: "results",
    serviceType: "primary_care",
    answers: {
      version: "care_finder_v1", who: "self", need: "unwell", safetyAnswered: "yes", urgency: "this_week",
      coverage: "public", location: "Calle Santa Clara 10, Zamora", careAccess: "public", accessAnswered: "yes",
    },
  });
  const centre = (id: string, name: string) => ({
    ...option(id, name, 0),
    origin: "official_register" as const,
    category: "Family doctor (GP)",
    care_type: "primary_care" as const,
    source_label: "REGCESS, Ministerio de Sanidad",
    source_status: "verified" as const,
    source_type: "official" as const,
    travel_minutes: null,
  });
  const publicResults = (basis: "health_map" | "nearest" | null, regionCode: string | null): CareFinderSearchResponse => ({
    ...okResults,
    careType: "primary_care",
    access: "public",
    location: "Calle Santa Clara 10, Zamora",
    orderedBy: basis ? "assigned_first" : "distance",
    options: [centre("regcess:1", "Centro de Salud Puerta Nueva"), centre("regcess:2", "Centro de Salud Santa Elena")],
    publicCare: {
      regionCode,
      assignedOptionId: basis ? "regcess:1" : null,
      basis,
      mapSource: basis === "health_map" ? "Junta de Castilla y León" : null,
      mapUpdatedOn: null,
    },
  });

  it("names their centre from the health map and links to the region's official booking", async () => {
    renderFinder({ initialState: publicState(), services: { search: vi.fn(async () => publicResults("health_map", "07")) } });
    const panel = await screen.findByTestId("care-public-care");
    expect(within(panel).getByRole("heading", { name: "Your health centre" })).toBeInTheDocument();
    expect(within(panel).getByText("Centro de Salud Puerta Nueva is the centre for your area on the health map published by Junta de Castilla y León.")).toBeInTheDocument();
    const booking = within(panel).getByTestId("link-public-booking");
    expect(booking).toHaveAttribute("href", "https://citaweb.saludcastillayleon.es/CitaPreviaWeb/#/start");
    expect(booking).toHaveAccessibleName("Book online: Sacyl Conecta (Castile and León Health Service) (opens the official website)");
    expect(within(panel).getByText(/first surname and your health card number/)).toBeInTheDocument();
    expect(within(screen.getByTestId("care-option-regcess:1")).getByTestId("care-assigned-badge")).toHaveTextContent("Your health centre");
    expect(within(screen.getByTestId("care-option-regcess:2")).queryByTestId("care-assigned-badge")).toBeNull();
    expect(screen.getByText("Your own health centre first, then the closest others. This order is not a quality ranking.")).toBeInTheDocument();
    const result = await axe.run(screen.getByTestId("care-finder"), { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((violation) => violation.id)).toEqual([]);
  });

  it("is honest when the centre is only the closest one", async () => {
    renderFinder({ initialState: publicState(), services: { search: vi.fn(async () => publicResults("nearest", "07")) } });
    const panel = await screen.findByTestId("care-public-care");
    expect(within(panel).getByText(/is the closest public health centre to you\. Your own centre is printed on your health card/)).toBeInTheDocument();
    expect(within(screen.getByTestId("care-option-regcess:1")).getByTestId("care-assigned-badge")).toHaveTextContent("Closest public health centre");
  });

  it("suggests calling when the region's booking page isn't listed", async () => {
    renderFinder({ initialState: publicState(), services: { search: vi.fn(async () => publicResults(null, "10")) } });
    const panel = await screen.findByTestId("care-public-care");
    expect(within(panel).getByText("Your own health centre is printed on your health card.")).toBeInTheDocument();
    expect(within(panel).getByText(/call your health centre to book/)).toBeInTheDocument();
    expect(within(panel).queryByTestId("link-public-booking")).toBeNull();
  });

  it("speaks Spanish", async () => {
    renderFinder({ lang: "es", initialState: publicState(), services: { search: vi.fn(async () => publicResults("health_map", "07")) } });
    const panel = await screen.findByTestId("care-public-care");
    expect(within(panel).getByRole("heading", { name: "Su centro de salud" })).toBeInTheDocument();
    expect(within(panel).getByTestId("link-public-booking")).toHaveTextContent("Pedir cita por internet: Sacyl Conecta (Sacyl, Junta de Castilla y León)");
  });
});

