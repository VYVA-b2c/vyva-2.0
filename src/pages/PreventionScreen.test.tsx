import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PreventionScreen from "./PreventionScreen";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  guardPath: vi.fn(),
  navigate: vi.fn(),
}));

const tMock = vi.hoisted(() => (key: string, fallback?: string, options?: Record<string, unknown>) =>
  Object.entries(options ?? {}).reduce(
    (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
    fallback ?? key,
  ));

const dailyFeedbackOptions = [
  { id: "done", label: "Done" },
  { id: "too_hard", label: "Too hard" },
  { id: "remind", label: "Remind me" },
  { id: "ask_vyva", label: "Ask VYVA" },
];

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: tMock }),
}));

vi.mock("@/hooks/useServiceGate", () => ({
  useServiceGate: () => ({
    guardPath: mocks.guardPath,
  }),
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: mocks.apiFetch,
}));

function renderPrevention() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PreventionScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PreventionScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.apiFetch.mockResolvedValue(new Response(JSON.stringify({
      focus: "Heart",
      headline: "Heart check today.",
      why: ["A recent blood pressure reading was high.", "Your profile includes blood pressure context."],
      todayAction: "Add a blood pressure reading, then ask VYVA what to watch.",
      helpSigns: ["Chest pain", "Shortness of breath", "New weakness or fainting"],
      primaryRoute: "/health/vitals",
      secondaryRoute: "/health/doctor",
      confidence: "strong",
      insights: [
        {
          id: "heart-reading",
          label: "Latest signal",
          value: "BP 168/96",
          detail: "This reading is the strongest reason for today's focus.",
          tone: "alert",
          route: "/health/vitals",
        },
        {
          id: "profile-context",
          label: "Profile",
          value: "High blood pressure",
          detail: "Used from your saved health profile.",
          tone: "caution",
        },
      ],
      guidance: [
        {
          id: "eat",
          label: "Eat",
          headline: "Choose a lower-salt plate",
          detail: "Go for vegetables, beans or lean protein, fruit, and water.",
          chips: ["Lower salt", "Fruit/veg", "Water"],
          tone: "food",
          actionSheet: {
            title: "Choose a lower-salt plate",
            summary: "Use lemon, herbs, vegetables, and fruit instead of salty packaged food.",
            primaryAction: {
              id: "show-groceries",
              label: "Show groceries",
              detail: "Open a fitted shopping list",
              route: "/concierge/shopping",
              priority: "primary",
              shoppingPrefill: {
                needText: "Low-salt groceries and prepared meal ideas for today.",
                category: "groceries",
                priorities: ["diet", "simplicity", "delivery"],
                constraints: ["low salt", "check ingredients for allergies", "confirm before ordering"],
                packageId: "easy_meals",
                sourceRecommendation: "VYVA suggested food support from today's Heart prevention focus.",
              },
            },
            secondaryActions: [
              {
                id: "prepared-meals",
                label: "Prepared meals",
                detail: "Find simple delivery options",
                route: "/concierge/shopping",
                priority: "secondary",
                shoppingPrefill: {
                  needText: "Find low-salt prepared meal options.",
                  category: "groceries",
                  priorities: ["diet", "simplicity", "delivery"],
                  constraints: ["low salt", "prepared meals"],
                },
              },
              {
                id: "ask-food",
                label: "Ask VYVA",
                detail: "Get more food ideas for me",
                route: "/health/doctor",
                priority: "secondary",
                mode: "voice",
              },
            ],
            recipes: [
              {
                id: "heart-lemon-chicken",
                title: "Lemon chicken with vegetables",
                prepTimeLabel: "25 min",
                whyItFits: "Fresh lemon and vegetables add flavour without leaning on salt.",
                ingredients: ["chicken", "vegetables", "lemon"],
                steps: ["Cook chicken.", "Add vegetables.", "Serve with fruit."],
                tags: ["Low salt", "Protein", "Easy dinner"],
                shoppingPrefill: {
                  needText: "Ingredients for Lemon chicken with vegetables.",
                  category: "groceries",
                  priorities: ["diet", "simplicity", "delivery"],
                  constraints: ["low salt"],
                },
              },
              {
                id: "heart-white-bean-soup",
                title: "White bean vegetable soup",
                prepTimeLabel: "20 min",
                whyItFits: "Beans and vegetables make a filling lower-salt meal.",
                ingredients: ["beans", "vegetables", "low-salt stock"],
                steps: ["Rinse beans.", "Simmer.", "Add herbs."],
                tags: ["Low salt", "Fibre", "Soft food"],
                shoppingPrefill: {
                  needText: "Ingredients for White bean vegetable soup.",
                  category: "groceries",
                  priorities: ["diet", "simplicity", "delivery"],
                  constraints: ["low salt"],
                },
              },
              {
                id: "heart-oat-berries",
                title: "Oat bowl with berries",
                prepTimeLabel: "10 min",
                whyItFits: "A simple breakfast without salty packaged foods.",
                ingredients: ["oats", "berries", "plain yogurt"],
                steps: ["Warm oats.", "Top with berries.", "Add cinnamon."],
                tags: ["Breakfast", "Low salt", "Fibre"],
                shoppingPrefill: {
                  needText: "Ingredients for Oat bowl with berries.",
                  category: "groceries",
                  priorities: ["diet", "simplicity", "delivery"],
                  constraints: ["low salt"],
                },
              },
            ],
            safetyNote: "Check ingredients fit your diet and allergies.",
          },
        },
        {
          id: "move",
          label: "Move",
          headline: "Gentle rhythm, not strain",
          detail: "Try an easy walk or seated marching if you feel steady.",
          chips: ["Easy pace", "Short sets"],
          tone: "movement",
          actionSheet: {
            title: "Gentle rhythm, not strain",
            summary: "Choose calm breathing or a very easy pace, not strain.",
            primaryAction: {
              id: "start-movement",
              label: "Start breathing",
              detail: "Open a gentle routine",
              route: "/activities/relax-breathe",
              priority: "primary",
            },
            secondaryActions: [
              {
                id: "ask-move",
                label: "Ask VYVA",
                detail: "Adapt movement for how I feel",
                route: "/health/doctor",
                priority: "secondary",
                mode: "voice",
              },
            ],
            safetyNote: "Stop and ask for help if you feel chest pain, faint, or very breathless.",
          },
        },
        {
          id: "do",
          label: "Do",
          headline: "Keep the day calm",
          detail: "Take medicines as scheduled and ask before changing anything.",
          chips: ["Medicines", "Rest"],
          tone: "action",
        },
        {
          id: "avoid",
          label: "Avoid",
          headline: "Skip pressure triggers",
          detail: "Avoid rushing, heavy lifting, too much caffeine, and salty snacks.",
          chips: ["No rushing", "Low salt"],
          tone: "avoid",
        },
      ],
      dailyActions: [
        {
          id: "heart-low-salt-meal",
          step: "Eat",
          title: "Low-salt meal",
          detail: "Recipe, groceries, or prepared meal help.",
          why: "BP 168/96 plus your heart profile makes food the best first move.",
          evidenceLabel: "DASH-style food",
          tone: "food",
          actionSheet: {
            title: "Low-salt meal",
            summary: "Use lemon, herbs, vegetables, and fruit instead of salty packaged food.",
            primaryAction: {
              id: "show-groceries",
              label: "Show groceries",
              detail: "Open a fitted shopping list",
              route: "/concierge/shopping",
              priority: "primary",
              shoppingPrefill: {
                needText: "Low-salt groceries and prepared meal ideas for today.",
                category: "groceries",
                priorities: ["diet", "simplicity", "delivery"],
                constraints: ["low salt", "check ingredients for allergies", "confirm before ordering"],
                packageId: "easy_meals",
                sourceRecommendation: "VYVA suggested food support from today's Heart prevention focus.",
              },
            },
            secondaryActions: [
              {
                id: "prepared-meals",
                label: "Prepared meals",
                detail: "Find simple delivery options",
                route: "/concierge/shopping",
                priority: "secondary",
                shoppingPrefill: {
                  needText: "Find low-salt prepared meal options.",
                  category: "groceries",
                  priorities: ["diet", "simplicity", "delivery"],
                  constraints: ["low salt", "prepared meals"],
                },
              },
              {
                id: "ask-food",
                label: "Ask VYVA",
                detail: "Get more food ideas for me",
                route: "/health/doctor",
                priority: "secondary",
                mode: "voice",
              },
            ],
            recipes: [
              {
                id: "heart-lemon-chicken",
                title: "Lemon chicken with vegetables",
                prepTimeLabel: "25 min",
                whyItFits: "Fresh lemon and vegetables add flavour without leaning on salt.",
                ingredients: ["chicken", "vegetables", "lemon"],
                steps: ["Cook chicken.", "Add vegetables.", "Serve with fruit."],
                tags: ["Low salt", "Protein", "Easy dinner"],
                shoppingPrefill: {
                  needText: "Ingredients for Lemon chicken with vegetables.",
                  category: "groceries",
                  priorities: ["diet", "simplicity", "delivery"],
                  constraints: ["low salt"],
                },
              },
              {
                id: "heart-white-bean-soup",
                title: "White bean vegetable soup",
                prepTimeLabel: "20 min",
                whyItFits: "Beans and vegetables make a filling lower-salt meal.",
                ingredients: ["beans", "vegetables", "low-salt stock"],
                steps: ["Rinse beans.", "Simmer.", "Add herbs."],
                tags: ["Low salt", "Fibre", "Soft food"],
                shoppingPrefill: {
                  needText: "Ingredients for White bean vegetable soup.",
                  category: "groceries",
                  priorities: ["diet", "simplicity", "delivery"],
                  constraints: ["low salt"],
                },
              },
            ],
            safetyNote: "Check ingredients fit your diet and allergies.",
          },
          feedbackOptions: dailyFeedbackOptions,
        },
        {
          id: "heart-calm-breathing",
          step: "Move",
          title: "3-minute breathing",
          detail: "Start calm breathing before the next check.",
          why: "A calm pause can make readings and symptoms easier to interpret.",
          evidenceLabel: "Calm routine",
          tone: "movement",
          actionSheet: {
            title: "3-minute breathing",
            summary: "Sit comfortably and use the guided breathing reset before the next task.",
            primaryAction: {
              id: "start-breathing",
              label: "Start breathing",
              detail: "Open the calm breathing guide",
              route: "/activities/relax-breathe",
              priority: "primary",
            },
            secondaryActions: [
              {
                id: "ask-heart-breathing",
                label: "Ask VYVA",
                detail: "Adapt this for how I feel",
                route: "/health/doctor",
                priority: "secondary",
                mode: "voice",
              },
            ],
            safetyNote: "Stop and get help for chest pain, fainting, or severe breathlessness.",
          },
          feedbackOptions: dailyFeedbackOptions,
        },
        {
          id: "heart-bp-check",
          step: "Check",
          title: "BP after rest",
          detail: "Sit quietly, then add or review a reading.",
          why: "A quiet repeat reading is more useful than a rushed one.",
          evidenceLabel: "BP technique",
          tone: "check",
          actionSheet: {
            title: "BP after rest",
            summary: "Rest quietly first, then use Vitals to add or review the reading.",
            primaryAction: {
              id: "open-vitals",
              label: "Open Vitals",
              detail: "Add or review blood pressure",
              route: "/health/vitals",
              priority: "primary",
            },
            secondaryActions: [
              {
                id: "doctor-question",
                label: "Doctor question",
                detail: "Prepare what to ask",
                route: "/health/doctor",
                priority: "secondary",
                mode: "voice",
              },
            ],
            safetyNote: "Seek urgent help for chest pain, shortness of breath, fainting, or sudden weakness.",
          },
          feedbackOptions: dailyFeedbackOptions,
        },
      ],
      learning: {
        title: "New options to ask about",
        detail: "Ask about DASH-style meals and home blood-pressure technique.",
        askPrompt: "Explain a simple heart-prevention plan for today.",
      },
      actions: [
        {
          id: "heart-food",
          label: "Food ideas",
          detail: "Low-salt meals for today",
          route: "/health/doctor",
          priority: "primary",
          mode: "voice",
        },
        {
          id: "heart-move",
          label: "Movement plan",
          detail: "Gentle exercise I can do",
          route: "/health/doctor",
          priority: "secondary",
          mode: "voice",
        },
      ],
      personalizationSummary: ["Blood pressure profile", "High blood pressure", "Medicine routine"],
      profileSignals: ["Heart focus", "High blood pressure", "BP 168/96"],
      weeklySummary: {
        headline: "VYVA is building on what worked.",
        detail: "Calm breathing worked recently.",
        bullets: ["1 move marked done", "Today: Low-salt meal, 3-minute breathing, BP after rest"],
        doctorSummary: "Prevention focus: Heart. Today's suggested moves: Eat: Low-salt meal; Calm: 3-minute breathing.",
        caregiverSummary: "Smallest useful step today: Low-salt meal.",
      },
      ranking: {
        timeOfDay: "morning",
        rankingReasons: ["Morning timing", "Building on Calm breathing"],
      },
      doctorNote: "BP 168/96 was the latest key signal. Profile includes blood pressure context.",
      generatedAt: "2026-07-02T10:00:00.000Z",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders focus, why, today action, help signs, and Talk to VYVA", async () => {
    renderPrevention();

    expect(await screen.findByTestId("prevention-page")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("prevention-hero")).toHaveTextContent("Heart check today."));
    expect(screen.getByTestId("prevention-personalization")).toHaveTextContent("Blood pressure profile");
    expect(screen.getByTestId("prevention-personalization")).not.toHaveTextContent("BP 168/96");
    expect(screen.getByTestId("prevention-guidance-panel")).toHaveTextContent("Today's 3 moves");
    expect(screen.getByTestId("prevention-loop-summary")).toHaveTextContent("Why today: A recent blood pressure reading was high.");
    expect(screen.getByTestId("prevention-daily-actions")).toHaveTextContent("Low-salt meal");
    expect(screen.getByTestId("prevention-daily-actions")).toHaveTextContent("3-minute breathing");
    expect(screen.getByTestId("prevention-daily-actions")).toHaveTextContent("BP after rest");
    expect(screen.getByTestId("prevention-feedback-row-heart-low-salt-meal")).toHaveTextContent("Too hard");
    expect(screen.getByTestId("prevention-feedback-row-heart-low-salt-meal")).not.toHaveTextContent("Remind me");
    expect(screen.getByTestId("prevention-feedback-row-heart-low-salt-meal")).not.toHaveTextContent("Ask VYVA");
    expect(screen.getByTestId("prevention-weekly-memory")).toHaveTextContent("VYVA is building on what worked.");
    expect(screen.getByTestId("prevention-learning")).toHaveTextContent("New options to ask about");
    expect(screen.getByTestId("prevention-learning")).toHaveTextContent("DASH-style meals");
    expect(screen.getByTestId("prevention-actions")).toHaveTextContent("Food ideas");
    expect(screen.getByTestId("prevention-actions")).toHaveTextContent("Movement plan");
    expect(screen.getByTestId("prevention-help-signs")).toHaveTextContent("Chest pain");
    expect(screen.getByTestId("button-prevention-talk")).toHaveTextContent("Talk to VYVA");

    fireEvent.click(screen.getByTestId("button-prevention-talk"));
    expect(mocks.guardPath).toHaveBeenCalledWith("/health/doctor", expect.objectContaining({
      state: expect.objectContaining({ autoStartVoice: true }),
    }));

    fireEvent.click(screen.getByTestId("button-prevention-secondary"));
    expect(mocks.guardPath).toHaveBeenCalledWith("/health/doctor", expect.objectContaining({
      state: expect.objectContaining({ autoStartVoice: true }),
    }));
  });

  it("turns a symptom follow-up into direct next steps", async () => {
    mocks.apiFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      focus: "Follow-up",
      headline: "Symptom follow-up today.",
      why: ["Latest symptom report: Pain when urinating with back or side pain.", "The report suggested follow-up."],
      todayAction: "Ask VYVA to connect pain when urinating with back or side pain with your health context.",
      helpSigns: ["Fever or chills", "Worsening back pain", "Blood in urine"],
      primaryRoute: "/health/doctor",
      secondaryRoute: "/health/doctor",
      confidence: "moderate",
      followUp: {
        reportId: "triage-uti",
        reportedAt: "2026-07-02T10:00:00.000Z",
        subject: "Pain when urinating with back or side pain",
        topic: "urinary pain",
      },
      insights: [
        {
          id: "follow-up-report",
          label: "Symptom",
          value: "Pain when urinating with back or side pain",
          detail: "VYVA can connect this with your saved context.",
          tone: "alert",
          route: "/informes/triage-uti",
        },
      ],
      actions: [
        {
          id: "follow-up-context",
          label: "Ask VYVA",
          detail: "Use symptoms, medicines, and profile",
          route: "/health/doctor",
          priority: "primary",
          mode: "voice",
        },
        {
          id: "follow-up-symptoms",
          label: "Check symptoms",
          detail: "Review signs to watch",
          route: "/health/symptom-check",
          priority: "secondary",
        },
        {
          id: "follow-up-summary",
          label: "Make summary",
          detail: "Prepare a clear note",
          route: "/health/doctor",
          priority: "secondary",
          mode: "voice",
        },
      ],
      dailyActions: [
        {
          id: "follow-up-context",
          step: "RIGHT NOW",
          title: "Check the pattern",
          detail: "Symptoms, medicine, and BP 168/96 together.",
          chips: ["Urinary pain", "Hypertension", "Lisinopril", "BP 168/96"],
          why: "VYVA can connect today's symptom with the health context already saved.",
          evidenceLabel: "",
          tone: "support",
          actionSheet: {
            title: "Check the pattern",
            summary: "Symptom follow-up: Pain when urinating with back or side pain. Use saved context: hypertension, medicine routine, and recent readings.",
            primaryAction: {
              id: "talk-context",
              label: "Ask VYVA",
              detail: "Explain what matters from my context",
              route: "/health/doctor",
              priority: "primary",
              mode: "voice",
            },
            secondaryActions: [],
          },
          feedbackOptions: dailyFeedbackOptions,
        },
        {
          id: "follow-up-watch-signs",
          step: "WATCH FOR",
          title: "Watch urinary changes",
          detail: "For this urinary pain follow-up.",
          chips: ["Fever", "Back pain worse", "Blood"],
          why: "These signs can help you decide whether to check again or get help sooner.",
          evidenceLabel: "Get help if",
          tone: "check",
          actionSheet: {
            title: "Watch urinary changes",
            summary: "Review what to watch.",
            primaryAction: {
              id: "check-symptoms",
              label: "Check symptoms",
              detail: "Open symptom check",
              route: "/health/symptom-check",
              priority: "primary",
            },
            secondaryActions: [],
          },
          feedbackOptions: dailyFeedbackOptions,
        },
        {
          id: "follow-up-summary",
          step: "IF NEEDED",
          title: "Save a summary",
          detail: "Keep symptoms, readings, and medicine together.",
          chips: ["Timing", "BP", "Lisinopril"],
          why: "A simple summary makes it easier to explain what changed.",
          evidenceLabel: "",
          tone: "support",
          actionSheet: {
            title: "Save a summary",
            summary: "Symptom follow-up: Pain when urinating with back or side pain.",
            primaryAction: {
              id: "prepare-summary",
              label: "Make summary",
              detail: "Create a short note from my context",
              route: "/health/doctor",
              priority: "primary",
              mode: "voice",
            },
            secondaryActions: [],
          },
          feedbackOptions: dailyFeedbackOptions,
        },
      ],
      personalizationSummary: ["Follow-up context", "Hypertension"],
      weeklySummary: {
        headline: "VYVA is rotating your plan.",
        detail: "Recently seen moves are rotated.",
        bullets: [],
        doctorSummary: "Follow-up focus.",
        caregiverSummary: "Follow-up focus.",
      },
      learning: {
        title: "New options to ask about",
        detail: "Generic prevention content",
        askPrompt: "Build a prevention plan.",
      },
      doctorNote: "Latest symptom report: Pain when urinating with back or side pain.",
      generatedAt: "2026-07-02T10:00:00.000Z",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    renderPrevention();

    await waitFor(() => expect(screen.getByTestId("prevention-hero")).toHaveTextContent("Urinary pain follow-up"));
    expect(screen.getByTestId("prevention-hero")).toHaveTextContent("Follow-up from 2 Jul");
    expect(screen.getByTestId("prevention-hero")).not.toHaveTextContent("Urinary pain today");
    expect(screen.getByTestId("prevention-hero")).not.toHaveTextContent("Age Well Today");
    expect(screen.getByTestId("prevention-hero")).not.toHaveTextContent("Let's make sense");
    expect(screen.queryByTestId("prevention-followup-context")).not.toBeInTheDocument();
    expect(screen.getByTestId("prevention-hero")).not.toHaveTextContent("Pain when urinating with back or side pain");
    expect(screen.getByTestId("prevention-guidance-panel")).toHaveTextContent("VYVA can help");
    expect(screen.getByTestId("prevention-daily-actions")).not.toHaveTextContent("RIGHT NOW");
    expect(screen.getByTestId("prevention-daily-actions")).toHaveTextContent("Check the pattern");
    expect(screen.getByTestId("prevention-daily-actions")).toHaveTextContent("Symptoms + medicine + BP 168/96");
    expect(screen.queryByTestId("prevention-daily-chips-follow-up-context")).not.toBeInTheDocument();
    expect(screen.getByTestId("prevention-daily-actions")).not.toHaveTextContent("WATCH FOR");
    expect(screen.getByTestId("prevention-daily-actions")).toHaveTextContent("Watch urinary changes");
    expect(screen.getByTestId("prevention-daily-actions")).toHaveTextContent("Fever, Back pain worse, Blood");
    expect(screen.queryByTestId("prevention-daily-chips-follow-up-watch-signs")).not.toBeInTheDocument();
    expect(screen.getByTestId("prevention-daily-actions")).not.toHaveTextContent("IF NEEDED");
    expect(screen.getByTestId("prevention-daily-actions")).toHaveTextContent("Save a summary");
    expect(screen.getByTestId("prevention-daily-actions")).toHaveTextContent("Timing + readings + medicine");
    expect(screen.queryByTestId("prevention-daily-chips-follow-up-summary")).not.toBeInTheDocument();
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("Put the picture together");
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("Signs to watch");
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("Prepare a clear summary");
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("PLAN");
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("REVIEW");
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("PROTECT");
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("NEXT STEP");
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("Mention this to your doctor");
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("Worth checking");
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("your doctor");
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("Get advice");
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("Open report");
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("captured");
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("serious");
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("urgent");
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("warning");
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("risk");
    expect(screen.queryByTestId("prevention-help-signs")).not.toBeInTheDocument();
    expect(screen.queryByTestId("prevention-loop-summary")).not.toBeInTheDocument();
    expect(screen.queryByTestId("prevention-weekly-memory")).not.toBeInTheDocument();
    expect(screen.queryByTestId("prevention-learning")).not.toBeInTheDocument();
    expect(screen.queryByTestId("prevention-actions")).not.toBeInTheDocument();
    expect(screen.queryByTestId("prevention-personalization")).not.toBeInTheDocument();
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("Easy food");
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("VYVA learned");
    expect(screen.getByTestId("prevention-page")).not.toHaveTextContent("Easier version");
    expect(screen.getByTestId("button-prevention-snooze-follow-up")).toHaveTextContent("Later");

    fireEvent.click(screen.getByTestId("button-prevention-daily-follow-up-context"));
    expect(mocks.guardPath).toHaveBeenCalledWith("/health/doctor", expect.objectContaining({
      state: expect.objectContaining({ autoStartVoice: true }),
    }));

    fireEvent.click(screen.getByTestId("button-prevention-daily-follow-up-watch-signs"));
    expect(mocks.navigate).toHaveBeenCalledWith("/health/symptom-check", expect.objectContaining({
      state: expect.objectContaining({
        initialClue: expect.stringContaining("Pain when urinating with back or side pain"),
      }),
    }));

    fireEvent.click(screen.getByTestId("button-prevention-daily-follow-up-summary"));
    expect(mocks.guardPath).toHaveBeenCalledWith("/health/doctor", expect.objectContaining({
      state: expect.objectContaining({ autoStartVoice: true }),
    }));

    fireEvent.click(screen.getByTestId("button-prevention-resolve-follow-up"));
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/api/health/prevention/follow-ups/triage-uti/lifecycle",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "handled" }),
      }),
    ));
    expect(JSON.parse(window.localStorage.getItem("vyva-prevention-loop:dismissed-followups") ?? "[]")).toContain("triage-uti");
  });

  it("sends local prevention learning context to the endpoint", async () => {
    window.localStorage.setItem("vyva-prevention-loop:history", JSON.stringify([
      {
        actionId: "heart-low-salt-meal",
        title: "Low-salt meal",
        step: "Eat",
        tone: "food",
        feedback: "shown",
        date: "2026-07-01",
      },
    ]));
    window.localStorage.setItem("vyva-prevention-loop:dismissed-followups", JSON.stringify(["triage-uti"]));

    renderPrevention();

    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalled());
    const url = String(mocks.apiFetch.mock.calls[0][0]);
    expect(url).toContain("/api/health/prevention?learning=");
    const encoded = url.split("learning=")[1];
    const decoded = JSON.parse(decodeURIComponent(encoded));
    expect(decoded.recentFeedback[0]).toMatchObject({ actionId: "heart-low-salt-meal", feedback: "shown" });
    expect(decoded.dismissedFollowUpIds).toEqual(["triage-uti"]);
  });

  it("opens VYVA with the weekly prevention summary", async () => {
    renderPrevention();

    await waitFor(() => expect(screen.getByTestId("prevention-weekly-memory")).toHaveTextContent("Calm breathing worked"));
    fireEvent.click(screen.getByTestId("button-prevention-weekly-summary"));

    expect(mocks.guardPath).toHaveBeenCalledWith("/health/doctor", expect.objectContaining({
      state: expect.objectContaining({
        latestSymptomReport: expect.stringContaining("Today's suggested moves"),
      }),
    }));
  });

  it("marks a daily prevention move as done", async () => {
    renderPrevention();

    await waitFor(() => expect(screen.getByTestId("prevention-daily-actions")).toHaveTextContent("Low-salt meal"));
    fireEvent.click(screen.getByTestId("button-prevention-feedback-heart-low-salt-meal-done"));

    expect(screen.getByTestId("prevention-feedback-heart-low-salt-meal")).toHaveTextContent("Done");
    expect(JSON.parse(window.localStorage.getItem("vyva-prevention-feedback:Heart:2026-07-02") ?? "{}")).toMatchObject({
      "heart-low-salt-meal": "done",
    });
    expect(screen.getByTestId("prevention-loop-summary")).toHaveTextContent("Nice. One move done.");
  });

  it("makes today's move easier when the user says it is too hard", async () => {
    renderPrevention();

    await waitFor(() => expect(screen.getByTestId("prevention-daily-actions")).toHaveTextContent("Low-salt meal"));
    fireEvent.click(screen.getByTestId("button-prevention-feedback-heart-low-salt-meal-too_hard"));

    expect(screen.getByTestId("prevention-loop-summary")).toHaveTextContent("Made easier now.");
    expect(screen.getByTestId("prevention-daily-actions")).toHaveTextContent("Easier version");
    expect(screen.getByTestId("prevention-barrier-row-heart-low-salt-meal")).toHaveTextContent("Cooking");
    fireEvent.click(screen.getByTestId("button-prevention-barrier-heart-low-salt-meal-cooking"));
    expect(JSON.parse(window.localStorage.getItem("vyva-prevention-barriers:Heart:2026-07-02") ?? "{}")).toMatchObject({
      "heart-low-salt-meal": "cooking",
    });
    expect(JSON.parse(window.localStorage.getItem("vyva-prevention-loop:history") ?? "[]")[0]).toMatchObject({
      actionId: "heart-low-salt-meal",
      feedback: "too_hard",
      barrier: "cooking",
    });
    expect(JSON.parse(window.localStorage.getItem("vyva-prevention-feedback:Heart:2026-07-02") ?? "{}")).toMatchObject({
      "heart-low-salt-meal": "too_hard",
    });
    expect(JSON.parse(window.localStorage.getItem("vyva-prevention-loop:last-feedback") ?? "{}")).toMatchObject({
      focus: "Heart",
      actionId: "heart-low-salt-meal",
      feedback: "too_hard",
    });

    fireEvent.click(screen.getByTestId("button-prevention-daily-heart-low-salt-meal"));
    expect(screen.getByTestId("prevention-action-sheet")).toHaveTextContent("Easier version");
  });

  it("remembers yesterday's too-hard feedback and starts easier", async () => {
    window.localStorage.setItem("vyva-prevention-loop:last-feedback", JSON.stringify({
      focus: "Heart",
      date: "2026-07-01",
      actionId: "heart-low-salt-meal",
      step: "Eat",
      tone: "food",
      feedback: "too_hard",
      title: "Low-salt meal",
      savedAt: "2026-07-01T10:00:00.000Z",
    }));

    renderPrevention();

    await waitFor(() => expect(screen.getByTestId("prevention-loop-summary")).toHaveTextContent("Yesterday felt hard. Starting easier."));
    expect(screen.getByTestId("prevention-daily-actions")).toHaveTextContent("Easier version");
  });

  it("saves reminders and routes ask-VYVA feedback to voice support", async () => {
    renderPrevention();

    await waitFor(() => expect(screen.getByTestId("prevention-daily-actions")).toHaveTextContent("Low-salt meal"));
    fireEvent.click(screen.getByTestId("button-prevention-daily-heart-low-salt-meal"));
    fireEvent.click(screen.getByTestId("button-prevention-sheet-feedback-remind"));
    expect(screen.getByTestId("prevention-loop-summary")).toHaveTextContent("Reminder saved.");

    fireEvent.click(screen.getByTestId("button-prevention-sheet-feedback-ask_vyva"));
    expect(mocks.guardPath).toHaveBeenCalledWith("/health/doctor", expect.objectContaining({
      state: expect.objectContaining({ autoStartVoice: true }),
    }));
  });

  it("opens actionable food guidance with recipes and concierge shopping prefill", async () => {
    renderPrevention();

    await waitFor(() => expect(screen.getByTestId("prevention-daily-actions")).toHaveTextContent("Low-salt meal"));
    fireEvent.click(await screen.findByTestId("button-prevention-daily-heart-low-salt-meal"));

    expect(screen.getByTestId("prevention-action-sheet")).toHaveTextContent("Low-salt meal");
    expect(screen.getByTestId("prevention-action-sheet-recipes")).toHaveTextContent("Lemon chicken with vegetables");
    expect(screen.getByTestId("prevention-action-sheet-recipes")).toHaveTextContent("White bean vegetable soup");

    fireEvent.click(screen.getByTestId("button-prevention-sheet-primary"));
    expect(mocks.navigate).toHaveBeenCalledWith("/concierge/shopping", {
      state: {
        shoppingPrefill: expect.objectContaining({
          category: "groceries",
          priorities: ["diet", "simplicity", "delivery"],
          constraints: expect.arrayContaining(["low salt"]),
        }),
      },
    });
  });

  it("opens actionable movement guidance and routes to breathing", async () => {
    renderPrevention();

    await waitFor(() => expect(screen.getByTestId("prevention-daily-actions")).toHaveTextContent("3-minute breathing"));
    fireEvent.click(await screen.findByTestId("button-prevention-daily-heart-calm-breathing"));
    expect(screen.getByTestId("prevention-action-sheet")).toHaveTextContent("3-minute breathing");

    fireEvent.click(screen.getByTestId("button-prevention-sheet-primary"));
    expect(mocks.navigate).toHaveBeenCalledWith("/activities/relax-breathe");
  });

  it("shows a clean fallback when the prevention endpoint is unavailable", async () => {
    mocks.apiFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: "failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }));

    renderPrevention();

    await waitFor(() => expect(screen.getByTestId("prevention-fallback-note")).toHaveTextContent("Using a simple plan"));
    expect(screen.getByTestId("prevention-hero")).toHaveTextContent("Prevention ready.");
    expect(screen.getByTestId("prevention-guidance-panel")).toHaveTextContent("Today's 3 moves");
    expect(screen.getByTestId("prevention-daily-actions")).toHaveTextContent("Steady meal");
    expect(screen.getByTestId("button-prevention-secondary")).toHaveTextContent("Build my day");
  });

  it("falls back if the prevention endpoint returns malformed data", async () => {
    mocks.apiFetch.mockResolvedValueOnce(new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    renderPrevention();

    await waitFor(() => expect(screen.getByTestId("prevention-hero")).toHaveTextContent("Prevention ready."));
    expect(screen.getByTestId("prevention-daily-actions")).toHaveTextContent("Steady meal");
  });
});
