import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TogetherRoomScreen from "./TogetherRoomScreen";
import type { SocialRoomPlan, SocialRoomPulse, SocialRoomResponse } from "./types";

const apiFetchMock = vi.fn();
const readingComfortPreferenceKey = "vyva:together-room:reading-comfort:v1";
const privateRoomNoteKey = "vyva:together-room:private-note:v1";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const roomResponse: SocialRoomResponse = {
  room: {
    slug: "together-room",
    name: "Together Room",
    category: "connection",
    agentSlug: "marco-reyes",
    agentFullName: "Marco Reyes",
    agentColour: "#6D28D9",
    agentCredential: "Gentle guide",
    ctaLabel: "Enter",
    topicTags: ["together"],
    timeSlots: ["afternoon"],
    featured: true,
    participantCount: 4,
    sessionDate: "2026-06-04",
    topic: "A small safe circle.",
    opener: "Welcome.",
    quote: "",
    activityType: "discussion",
    contentTag: "",
    contentTitle: "",
    contentBody: "",
    options: [],
    liveBadge: "4 in the room",
  },
  transcript: [],
  promptChips: [],
  members: [
    { id: "member-carmen", name: "Carmen", statusLabel: "Looking for a quiet plan" },
    { id: "member-luis", name: "Luis", statusLabel: "Comparing services" },
    { id: "member-ana", name: "Ana", statusLabel: "Reviewing an offer" },
  ],
  memberChat: [],
  pulse: {
    featuredPlan: {
      id: "tea-film-chat",
      key: "tea-film-chat",
      title: "Tea and film chat",
      body: "Choose a gentle film and talk about it without rushing.",
      locationLabel: "online",
      comfortNeeds: ["quiet_pace"],
      experienceCategory: "movie_date",
      preferredTime: "evening",
      costRange: "free",
      groupSize: "small_group",
      safetyFlags: [],
      needsReview: false,
      fitReasons: ["Online", "Evening", "Free", "Small group"],
      startsAt: null,
      status: "active",
      responseCounts: { join: 0, maybe: 0 },
      myResponse: null,
    },
    secondaryPlans: [
      {
        id: "quiet-lunch",
        key: "quiet-lunch",
        title: "Quiet lunch nearby",
        body: "Choose somewhere nearby, accessible and calm.",
        locationLabel: "nearby",
        comfortNeeds: ["easy_access", "seating", "transport_help", "arrival_buddy", "clear_cost"],
        experienceCategory: "restaurant_date",
        preferredTime: "afternoon",
        costRange: "shared",
        groupSize: "small_group",
        safetyFlags: [],
        needsReview: false,
        fitReasons: ["Nearby", "Afternoon", "Shared cost", "Small group"],
        startsAt: null,
        status: "active",
        responseCounts: { join: 0, maybe: 0 },
        myResponse: null,
      },
    ],
    postedExperiences: [],
    memberPresence: [
      { id: "member-carmen", name: "Carmen", statusLabel: "Looking for a quiet plan" },
      { id: "member-luis", name: "Luis", statusLabel: "Comparing services" },
      { id: "member-ana", name: "Ana", statusLabel: "Reviewing an offer" },
    ],
    activePoll: {
      id: "daily-room-choice",
      key: "daily-room-choice",
      question: "What would feel good to share today?",
      status: "active",
      options: [
        { id: "film", label: "Film chat", votes: 0 },
        { id: "lunch", label: "Quiet lunch", votes: 0 },
        { id: "views", label: "Share views", votes: 0 },
      ],
      totalVotes: 0,
      myVote: null,
    },
    comfortCheck: {
      title: "What would make this comfortable?",
      body: "Tap what helps. The room can shape plans around it.",
      options: [
        { id: "listen_first", label: "Listen first", count: 0 },
        { id: "quiet_pace", label: "Quiet pace", count: 0 },
        { id: "easy_access", label: "Easy access", count: 1 },
        { id: "seating", label: "Place to sit", count: 0 },
        { id: "transport_help", label: "Transport help", count: 0 },
        { id: "arrival_buddy", label: "Meet together", count: 0 },
        { id: "clear_cost", label: "Know cost first", count: 0 },
      ],
      myComfortNeeds: [],
      totalResponses: 1,
    },
    decisionGuide: {
      id: "shape-one-plan",
      title: "Next safe step",
      body: "The room is still choosing. VYVA can shape one simple plan with Easy access.",
      steps: ["Confirm one simple plan", "Keep Easy access in mind", "Share contact only after both agree"],
      primaryActionLabel: "Make this a plan",
      actionKind: "plan",
    },
    discussionPrompt: {
      id: "gentle-start",
      title: "What would you like to say?",
      body: "You can start small.",
      starterButtons: ["Say hello", "Suggest a plan", "Ask VYVA"],
      dailyQuestion: {
        id: "today-gentle-question",
        title: "Today's gentle question",
        body: "What would make it easier for you to join in today?",
        draft: "What would make it easier for me to join today is...",
        actionLabel: "Answer gently",
        privacyLine: "Your answer is shared only when you choose to post it. VYVA checks private details first.",
      },
    },
    safety: {
      title: "Safe small circle",
      body: "VYVA keeps the tone kind.",
      consentLine: "Contact is shared only when both people agree.",
      helpLabel: "Help or safety",
    },
    visibility: {
      title: "Who sees what",
      body: "A calm reminder before you tap.",
      items: [
        {
          id: "private",
          title: "Private to you",
          body: "Your vote, comfort choices and maybe choice do not show your name.",
        },
        {
          id: "totals",
          title: "Room sees totals",
          body: "The room sees counts like votes, interest and comfort needs.",
        },
        {
          id: "shared",
          title: "Shared with the room",
          body: "Plans, views and replies appear in the room, with VYVA review nearby.",
        },
      ],
    },
    activityDigest: {
      title: "What is moving in the room",
      body: "A short no-name summary so you can decide calmly.",
      privacyLine: "VYVA shows safe signals only, never private choices with names.",
      updatedAt: "2026-06-04T10:00:00.000Z",
      items: [
        {
          id: "presence",
          kind: "presence",
          label: "Quietly present",
          body: "3 people can read or join without pressure.",
          count: 3,
          private: true,
        },
        {
          id: "comfort",
          kind: "comfort",
          label: "Comfort signals",
          body: "The room can shape plans around Easy access.",
          count: 1,
          private: true,
        },
      ],
    },
    joiningSupportCue: {
      id: "access-support",
      title: "Access and seating help",
      body: "Access or a place to sit may matter. VYVA can check place and pace before anyone commits.",
      actionLabel: "Ask for access help",
      draft: "VYVA, please check access, seating, and a quiet pace for the next plan. Use totals, not names, and keep contact private.",
      privacyLine: "This asks VYVA only. The room still sees totals, not names.",
      needIds: ["easy_access"],
    },
    notifications: [],
  },
};

describe("TogetherRoomScreen", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })));
    Object.defineProperty(window, "speechSynthesis", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    window.localStorage.clear();
  });

  it("renders the simple safe-haven hierarchy", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Together Room" })).toBeInTheDocument();
    expect(screen.getByText("Protected room")).toBeInTheDocument();
    expect(screen.getByTestId("together-safety-quick-help")).toHaveTextContent("Help or safety");
    expect(screen.getByTestId("together-safety-quick-help")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("together-refresh-room")).toHaveTextContent("Check room");
    expect(screen.getByTestId("together-refresh-room")).toHaveAttribute("aria-busy", "false");
    expect(screen.getByTestId("together-reading-comfort")).toHaveTextContent("Large text");
    expect(screen.getByTestId("together-reading-comfort")).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("together-reading-comfort-note")).not.toBeInTheDocument();
    expect(screen.getByTestId("together-read-aloud")).toHaveTextContent("Read aloud");
    expect(screen.getByTestId("together-read-aloud")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("together-at-glance")).toHaveTextContent("Today in the room");
    expect(screen.getByTestId("together-at-glance-updates")).toHaveTextContent("No new updates");
    expect(screen.getByTestId("together-at-glance-votes")).toHaveTextContent("0 votes");
    expect(screen.getByTestId("together-at-glance-interest")).toHaveTextContent("0 people interested");
    expect(screen.getByTestId("together-at-glance-comfort")).toHaveTextContent("1 comfort signal");
    expect(screen.getByTestId("together-activity-digest")).toHaveTextContent("What is moving in the room");
    expect(screen.getByTestId("together-activity-digest")).toHaveTextContent(
      "A short no-name summary so you can decide calmly.",
    );
    expect(screen.getByTestId("together-activity-digest-item-presence")).toHaveTextContent("Quietly present");
    expect(screen.getByTestId("together-activity-digest-item-presence")).toHaveTextContent(
      "3 people can read or join without pressure.",
    );
    expect(screen.getByTestId("together-activity-digest-item-comfort")).toHaveTextContent("Comfort signals");
    expect(screen.getByTestId("together-activity-digest-item-comfort")).toHaveTextContent(
      "The room can shape plans around Easy access.",
    );
    expect(screen.getByTestId("together-activity-digest-privacy")).toHaveTextContent(
      "VYVA shows safe signals only, never private choices with names.",
    );
    expect(screen.getByTestId("together-room-notes")).toHaveTextContent("Today's room notes");
    expect(screen.getByTestId("together-room-notes")).toHaveTextContent(
      "A simple record of what the room knows now, so no one has to keep it all in mind.",
    );
    expect(screen.getByTestId("together-room-notes-known")).toHaveTextContent("Vote: still open.");
    expect(screen.getByTestId("together-room-notes-known")).toHaveTextContent("Comfort: Easy access.");
    expect(screen.getByTestId("together-room-notes-known")).toHaveTextContent("Views: none yet.");
    expect(screen.getByTestId("together-room-notes-open")).toHaveTextContent(
      "A few private choices are still needed.",
    );
    expect(screen.getByTestId("together-room-notes-open")).toHaveTextContent("One calm view is still welcome.");
    expect(screen.getByTestId("together-room-notes-next")).toHaveTextContent(
      "Start with hello, a comfort choice, or one private vote.",
    );
    expect(screen.getByTestId("together-room-notes-next-action")).toHaveTextContent("Choose a gentle start");
    expect(screen.getByTestId("together-room-notes-copy")).toHaveTextContent("Copy no-name notes");
    expect(screen.getByTestId("together-room-notes")).toHaveTextContent(
      "These notes use totals and signals, not names.",
    );
    expect(screen.getByTestId("together-vote-impact")).toHaveTextContent("What your vote does");
    expect(screen.getByTestId("together-vote-impact")).toHaveTextContent(
      "Each private vote helps the room choose one calm next step.",
    );
    expect(screen.getByTestId("together-vote-impact-choice")).toHaveTextContent(
      "You have not voted yet. You can look first.",
    );
    expect(screen.getByTestId("together-vote-impact-safety")).toHaveTextContent("Only totals are shown. Names do not appear.");
    expect(screen.getByTestId("together-my-safe-choices")).toHaveTextContent("My safe choices");
    expect(screen.getByTestId("together-my-safe-choices")).toHaveTextContent(
      "A private snapshot of what you have chosen so far.",
    );
    expect(screen.getByTestId("together-my-safe-choices")).toHaveTextContent("The room sees totals, not your name.");
    expect(screen.getByTestId("together-my-safe-choice-plan")).toHaveTextContent("No activity choice yet");
    expect(screen.getByTestId("together-my-safe-choice-vote")).toHaveTextContent("No vote yet");
    expect(screen.getByTestId("together-my-safe-choice-comfort")).toHaveTextContent("No comfort choice yet");
    expect(screen.getByTestId("together-my-safe-choice-help")).toHaveTextContent("No helper choice yet");
    expect(screen.getByTestId("together-my-safe-next-action")).toHaveTextContent("Add comfort choice");
    expect(screen.queryByTestId("together-my-review-updates")).not.toBeInTheDocument();
    expect(screen.getByTestId("together-private-note")).toHaveTextContent("Private note");
    expect(screen.getByTestId("together-private-note")).toHaveTextContent("Saved only on this device.");
    expect(screen.getByTestId("together-private-note-input")).toHaveAttribute(
      "placeholder",
      "What I want to remember...",
    );
    expect(screen.getByTestId("together-private-note-clear")).toBeDisabled();
    expect(screen.getByTestId("together-visibility-promise")).toHaveTextContent("Who sees what");
    expect(screen.getByTestId("together-visibility-private")).toHaveTextContent("do not show your name");
    expect(screen.getByTestId("together-visibility-totals")).toHaveTextContent("Room sees totals");
    expect(screen.getByTestId("together-visibility-shared")).toHaveTextContent("VYVA review nearby");
    expect(screen.getByTestId("together-quiet-pause")).toHaveTextContent("Pause quietly");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("together-leave-quietly")).toHaveTextContent("Leave quietly");
    expect(screen.getByTestId("together-leave-quietly")).toHaveTextContent("No one is notified.");
    expect(screen.getByTestId("together-room-trust")).toHaveTextContent("Safe to join");
    expect(screen.getByTestId("together-room-trust")).toHaveTextContent(
      "Three reminders before you take part.",
    );
    expect(screen.getByTestId("together-room-trust-privacy")).toHaveTextContent(
      "Votes, comfort choices and Maybe stay unnamed.",
    );
    expect(screen.getByTestId("together-room-trust-kindness")).toHaveTextContent(
      "Views should stay kind; VYVA can review anything uncomfortable.",
    );
    expect(screen.getByTestId("together-room-trust-contact")).toHaveTextContent(
      "Private contact stays inside VYVA until both people agree.",
    );
    expect(screen.getByTestId("together-room-trust-action")).toHaveTextContent("Ask VYVA to check");
    expect(screen.getByTestId("together-room-trust-intro")).toHaveTextContent("Explain this room");
    expect(screen.getByTestId("together-participation-path")).toHaveTextContent("Choose your way in");
    expect(screen.getByTestId("together-participation-path")).toHaveTextContent(
      "Three simple ways to join without reading the whole room first.",
    );
    expect(screen.getByTestId("together-path-vote")).toHaveTextContent("Vote privately");
    expect(screen.getByTestId("together-path-vote")).toHaveTextContent("The room only sees totals.");
    expect(screen.getByTestId("together-path-view")).toHaveTextContent("Share a view");
    expect(screen.getByTestId("together-path-view")).toHaveTextContent("VYVA review stays nearby.");
    expect(screen.getByTestId("together-path-activity")).toHaveTextContent("Activities for you");
    expect(screen.getByTestId("together-path-activity")).toHaveTextContent("recommended activities");
    expect(screen.getByTestId("together-participation-path")).toHaveTextContent(
      "Looking first is welcome. No path shares private contact.",
    );
    expect(screen.getByTestId("together-next-step-cue")).toHaveTextContent("Best next tap");
    expect(screen.getByTestId("together-next-step-cue")).toHaveTextContent("First, keep the room safe");
    expect(screen.getByTestId("together-next-step-promise")).toHaveTextContent("I understand");
    expect(screen.getByTestId("together-next-step-explain")).toHaveTextContent("Why this tap?");
    expect(screen.getByText("Carmen")).toBeInTheDocument();
    expect(screen.getByText("Luis")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByTestId("together-member-status-member-carmen")).toHaveTextContent("Looking for a quiet plan");
    expect(screen.getByTestId("together-member-status-member-luis")).toHaveTextContent("Comparing services");
    expect(screen.getByTestId("together-member-status-member-ana")).toHaveTextContent("Reviewing an offer");
    expect(screen.getByTestId("together-listen-first-cue")).toHaveTextContent("Start gently");
    expect(screen.getByTestId("together-listen-first-cue")).toHaveTextContent("Choose what helps today.");
    expect(screen.getByTestId("together-listen-first-cue")).toHaveTextContent("The room sees totals, not names.");
    expect(screen.getByTestId("together-listen-first")).toHaveTextContent("I'll listen first");
    expect(screen.getByTestId("together-listen-first")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("together-arrival-comfort-quiet_pace")).toHaveTextContent("Quiet pace");
    expect(screen.getByTestId("together-arrival-comfort-arrival_buddy")).toHaveTextContent("Meet together");
    expect(screen.getByText("Our room promise")).toBeInTheDocument();
    expect(screen.getByText("Use kind words and no pressure.")).toBeInTheDocument();
    expect(screen.getByText("Share views without judging.")).toBeInTheDocument();
    expect(screen.getByText("Ask VYVA if something feels wrong.")).toBeInTheDocument();
    expect(screen.getByTestId("together-acknowledge-agreement")).toHaveTextContent("I understand");
    expect(screen.getByText("Tea and film chat")).toBeInTheDocument();
    expect(screen.getByTestId("together-plan-location-tea-film-chat")).toHaveTextContent("Online");
    expect(screen.getByTestId("together-plan-comfort-tea-film-chat")).toHaveTextContent("Quiet pace");
    expect(screen.getByTestId("together-plan-fit-tea-film-chat")).toHaveTextContent("Movie date");
    expect(screen.getByTestId("together-plan-fit-tea-film-chat")).toHaveTextContent("Evening");
    expect(screen.getByTestId("together-plan-comfort-confidence-tea-film-chat")).toHaveTextContent("Comfort before joining");
    expect(screen.getByTestId("together-plan-comfort-confidence-tea-film-chat")).toHaveTextContent(
      "Already noted: Quiet pace.",
    );
    expect(screen.getByTestId("together-plan-comfort-confidence-tea-film-chat")).toHaveTextContent(
      "Ask VYVA to confirm: Easy access, Place to sit, Transport help, 2 more checks.",
    );
    expect(screen.getByTestId("together-plan-comfort-confidence-tea-film-chat")).toHaveTextContent(
      "Join or Maybe still does not share private contact.",
    );
    expect(screen.getByTestId("together-plan-detail-check-tea-film-chat")).toHaveTextContent("Before anyone meets");
    expect(screen.getByTestId("together-plan-detail-check-tea-film-chat")).toHaveTextContent(
      "VYVA can check the practical details before anyone feels committed.",
    );
    expect(screen.getByTestId("together-plan-detail-check-tea-film-chat-item-1")).toHaveTextContent("Clear place and time");
    expect(screen.getByTestId("together-plan-detail-check-tea-film-chat-item-2")).toHaveTextContent("Comfort and cost");
    expect(screen.getByTestId("together-plan-detail-check-tea-film-chat-item-3")).toHaveTextContent(
      "Contact only by consent",
    );
    expect(screen.getByTestId("together-plan-detail-check-tea-film-chat-action")).toHaveTextContent("Check details");
    expect(screen.getByTestId("together-plan-choice-note")).toHaveTextContent("No pressure");
    expect(screen.getByTestId("together-plan-choice-note")).toHaveTextContent(
      "Join only shows interest, not a commitment.",
    );
    expect(screen.getByTestId("together-plan-next-step")).toHaveTextContent("What happens next");
    expect(screen.getByTestId("together-plan-next-step")).toHaveTextContent(
      "When someone shows interest, VYVA helps confirm the details calmly.",
    );
    expect(screen.getByTestId("together-plan-next-step")).toHaveTextContent("Time");
    expect(screen.getByTestId("together-plan-next-step")).toHaveTextContent("Comfort");
    expect(screen.getByTestId("together-plan-next-step")).toHaveTextContent("Contact only by consent");
    expect(screen.getByTestId("together-plan-helper-cue")).toHaveTextContent("Best small help");
    expect(screen.getByTestId("together-plan-helper-cue")).toHaveTextContent(
      "The most useful help now is Help choose.",
    );
    expect(screen.getByTestId("together-plan-helper-cue-action")).toHaveTextContent("Choose Help choose");
    expect(screen.getByTestId("together-plan-helper-cue-privacy")).toHaveTextContent(
      "This posts only a helper signal, not private contact.",
    );
    expect(screen.getByTestId("together-plan-location-quiet-lunch")).toHaveTextContent("Nearby");
    expect(screen.getByTestId("together-plan-comfort-quiet-lunch")).toHaveTextContent("Easy access");
    expect(screen.getByTestId("together-plan-comfort-quiet-lunch")).toHaveTextContent("Place to sit");
    expect(screen.getByTestId("together-plan-comfort-quiet-lunch")).toHaveTextContent("Transport help");
    expect(screen.getByTestId("together-plan-comfort-quiet-lunch")).toHaveTextContent("Meet together");
    expect(screen.getByTestId("together-plan-comfort-quiet-lunch")).toHaveTextContent("1 more comfort note");
    expect(screen.getByTestId("together-plan-comfort-quiet-lunch")).not.toHaveTextContent("Know cost first");
    expect(screen.getByTestId("together-plan-fit-quiet-lunch")).toHaveTextContent("Restaurant date");
    expect(screen.getByTestId("together-secondary-response-summary-quiet-lunch")).toHaveTextContent(
      "You can be first to choose.",
    );
    expect(screen.getByTestId("together-secondary-join-quiet-lunch")).toHaveTextContent("Join this");
    expect(screen.getByTestId("together-secondary-maybe-quiet-lunch")).toHaveTextContent("Maybe");
    expect(screen.getByTestId("together-featured-response-summary")).toHaveTextContent(
      "You can be first to choose.",
    );
    expect(screen.getByText("What would feel good to share today?")).toBeInTheDocument();
    expect(screen.getByTestId("together-vote-film")).toHaveTextContent("0 votes");
    expect(screen.getByTestId("together-vote-lunch")).toHaveTextContent("0 votes");
    expect(screen.getByTestId("together-vote-views")).toHaveTextContent("Share views");
    expect(screen.getByTestId("together-vote-views")).toHaveTextContent("0 votes");
    expect(screen.getByTestId("together-pass-vote")).toHaveTextContent("I'll decide later");
    expect(screen.getByTestId("together-pass-vote")).toHaveTextContent("No vote is sent.");
    expect(screen.getByTestId("together-pass-vote")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("together-vote-signal")).toHaveTextContent("Room signal");
    expect(screen.getByTestId("together-vote-signal")).toHaveTextContent(
      "No direction yet. Looking first is welcome too.",
    );
    expect(screen.getByTestId("together-vote-signal-privacy")).toHaveTextContent("VYVA uses totals only, not names.");
    expect(screen.getByTestId("together-vote-privacy-note")).toHaveTextContent("Private, changeable vote");
    expect(screen.getByTestId("together-vote-privacy-note")).toHaveTextContent(
      "The room only sees totals, not your name.",
    );
    expect(screen.getByTestId("together-vote-privacy-note")).toHaveTextContent(
      "You can change or remove your vote while voting is open.",
    );
    expect(screen.getByText("Your vote helps choose the next step.")).toBeInTheDocument();
    expect(screen.getByTestId("together-suggest-vote")).toHaveTextContent("Suggest a vote");
    expect(screen.getByTestId("together-issue-shortcuts")).toHaveTextContent("Turn a concern into a vote");
    expect(screen.getByTestId("together-issue-shortcuts")).toHaveTextContent(
      "Choose a common issue if you want VYVA to suggest a simple room vote.",
    );
    expect(screen.getByTestId("together-issue-shortcut-place")).toHaveTextContent("Place");
    expect(screen.getByTestId("together-issue-shortcut-time")).toHaveTextContent("Time");
    expect(screen.getByTestId("together-issue-shortcut-cost")).toHaveTextContent("Cost");
    expect(screen.getByTestId("together-issue-shortcut-safety")).toHaveTextContent("Safety");
    expect(screen.getByTestId("together-comfort-check")).toHaveTextContent("What would make this comfortable?");
    expect(screen.getByTestId("together-comfort-check-listen_first")).toHaveTextContent("Listen first");
    expect(screen.getByTestId("together-comfort-check-easy_access")).toHaveTextContent("1 chose this");
    expect(screen.getByTestId("together-comfort-privacy-note")).toHaveTextContent("Private comfort check");
    expect(screen.getByTestId("together-comfort-privacy-note")).toHaveTextContent(
      "The room sees totals, not your name.",
    );
    expect(screen.getByTestId("together-comfort-privacy-note")).toHaveTextContent(
      "You can change what helps anytime.",
    );
    expect(screen.getByTestId("together-joining-support")).toHaveTextContent("Access and seating help");
    expect(screen.getByTestId("together-joining-support")).toHaveTextContent(
      "Access or a place to sit may matter. VYVA can check place and pace before anyone commits.",
    );
    expect(screen.getByTestId("together-joining-support-action")).toHaveTextContent("Ask for access help");
    expect(screen.getByTestId("together-joining-support-privacy")).toHaveTextContent(
      "This asks VYVA only. The room still sees totals, not names.",
    );
    expect(screen.getByTestId("together-room-direction")).toHaveTextContent("Gentle room direction");
    expect(screen.getByTestId("together-room-direction")).toHaveTextContent("The room is still choosing.");
    expect(screen.getByTestId("together-room-direction")).toHaveTextContent("Shape it around Easy access.");
    expect(screen.getByTestId("together-room-outcome-bridge")).toHaveTextContent("What VYVA will do next");
    expect(screen.getByTestId("together-room-outcome-bridge")).toHaveTextContent(
      "VYVA will use Easy access to make the next plan easier.",
    );
    expect(screen.getByTestId("together-room-outcome-private")).toHaveTextContent("Use private totals, not names");
    expect(screen.getByTestId("together-room-outcome-shape")).toHaveTextContent(
      "Turn choices into one clear next step",
    );
    expect(screen.getByTestId("together-room-outcome-safety")).toHaveTextContent(
      "Keep contact and safety inside VYVA",
    );
    expect(screen.getByTestId("together-room-summary")).toHaveTextContent("Room summary");
    expect(screen.getByTestId("together-room-summary-vote")).toHaveTextContent("Still open");
    expect(screen.getByTestId("together-room-summary-comfort")).toHaveTextContent("Easy access");
    expect(screen.getByTestId("together-room-summary-interest")).toHaveTextContent("0 people interested");
    expect(screen.getByTestId("together-room-summary-views")).toHaveTextContent("0 shared views");
    expect(screen.getByTestId("together-room-summary-next")).toHaveTextContent("Make one calm plan around Easy access.");
    expect(screen.getByTestId("together-common-ground")).toHaveTextContent("Common ground");
    expect(screen.getByTestId("together-common-ground-vote")).toHaveTextContent("Votes stay private");
    expect(screen.getByTestId("together-common-ground-comfort")).toHaveTextContent("Prepare around Easy access.");
    expect(screen.getByTestId("together-common-ground-interest")).toHaveTextContent("Interest can start with Maybe later.");
    expect(screen.getByTestId("together-common-ground-views")).toHaveTextContent("Views can stay short and kind.");
    expect(screen.getByTestId("together-decision-guide")).toHaveTextContent("Next safe step");
    expect(screen.getByTestId("together-decision-guide")).toHaveTextContent("The room is still choosing.");
    expect(screen.getByTestId("together-decision-guide-steps")).toHaveTextContent("Waiting for a few votes.");
    expect(screen.getByTestId("together-decision-guide-steps")).toHaveTextContent("Comfort needs are visible.");
    expect(screen.getByTestId("together-ask-recap")).toHaveTextContent("Ask VYVA for a recap");
    expect(screen.getByTestId("together-room-readiness")).toHaveTextContent("Before we move ahead");
    expect(screen.getByTestId("together-room-readiness-vote")).toHaveTextContent("Waiting for a few votes.");
    expect(screen.getByTestId("together-room-readiness-comfort")).toHaveTextContent("Comfort needs are visible.");
    expect(screen.getByTestId("together-room-readiness-consent")).toHaveTextContent(
      "Contact stays inside VYVA until both people agree.",
    );
    expect(screen.getByTestId("together-useful-next-steps")).toHaveTextContent("Useful next steps");
    expect(screen.getByTestId("together-useful-next-steps")).toHaveTextContent(
      "VYVA shows what it can help with now, without names or pressure.",
    );
    expect(screen.getByTestId("together-useful-next-activity")).toHaveTextContent(
      "Still needs interest, comfort, or one small helper.",
    );
    expect(screen.getByTestId("together-useful-next-vote")).toHaveTextContent(
      "Waiting for a question to get support.",
    );
    expect(screen.getByTestId("together-useful-next-views")).toHaveTextContent(
      "No shared views to recap yet.",
    );
    expect(screen.getByTestId("together-useful-next-activity-action")).toHaveTextContent("Help activity");
    expect(screen.getByTestId("together-useful-next-vote-action")).toHaveTextContent("Suggest vote");
    expect(screen.getByTestId("together-useful-next-views-action")).toHaveTextContent("Share view");
    expect(screen.getByTestId("together-useful-next-steps")).toHaveTextContent(
      "VYVA uses signals and totals, not names.",
    );
    expect(screen.getByRole("heading", { name: "What would you like to say?" })).toBeInTheDocument();
    expect(screen.getByText("You can start small.")).toBeInTheDocument();
    expect(screen.getByTestId("together-daily-question")).toHaveTextContent("Today's gentle question");
    expect(screen.getByTestId("together-daily-question")).toHaveTextContent(
      "What would make it easier for you to join in today?",
    );
    expect(screen.getByTestId("together-daily-question-action")).toHaveTextContent("Answer gently");
    expect(screen.getByTestId("together-daily-question-privacy")).toHaveTextContent(
      "Your answer is shared only when you choose to post it. VYVA checks private details first.",
    );
    expect(screen.getAllByTestId(/together-starter-/)).toHaveLength(3);
    expect(screen.getByTestId("together-starter-hello")).toHaveTextContent("Say hello");
    expect(screen.getByTestId("together-starter-plan")).toHaveTextContent("Suggest a plan");
    expect(screen.getByTestId("together-starter-ask")).toHaveTextContent("Ask VYVA");
    expect(screen.queryByTestId("together-starter-view")).not.toBeInTheDocument();
    const simpleOrder = [
      screen.getByTestId("together-member-strip"),
      screen.getByTestId("together-featured-plan"),
      screen.getByTestId("together-room-choice"),
      screen.getByTestId("together-starter-hello"),
      screen.getByTestId("together-support-panels"),
    ];
    simpleOrder.slice(0, -1).forEach((item, index) => {
      expect(
        item.compareDocumentPosition(simpleOrder[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
    expect(screen.getByTestId("together-view-sharing-note")).toHaveTextContent(
      "You can share a short view with kind words and no personal contact details.",
    );
    expect(screen.queryByTestId("together-view-circle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("together-view-starters")).not.toBeInTheDocument();
    expect(screen.getAllByText("Contact is shared only when both people agree.").length).toBeGreaterThan(0);
  });

  it("turns today's room notes into a gentle next action", () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

      fireEvent.click(screen.getByTestId("together-room-notes-next-action"));

      expect(screen.getByTestId("together-room-notes-next-action")).toHaveTextContent("Choose a gentle start");
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
      expect(screen.getByTestId("together-participation-path")).toHaveFocus();
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("turns waiting useful next steps into gentle contribution actions", () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

      fireEvent.click(screen.getByTestId("together-useful-next-activity-action"));
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
      expect(screen.getByTestId("together-featured-plan")).toHaveFocus();

      fireEvent.click(screen.getByTestId("together-useful-next-vote-action"));
      expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Easy questions for VYVA");
      expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
        "VYVA, can you turn this into a simple room vote?",
      );

      fireEvent.click(screen.getByTestId("together-cancel-proposal"));
      fireEvent.click(screen.getByTestId("together-useful-next-views-action"));
      expect(screen.getByTestId("together-view-starters")).toHaveTextContent("Kind view starters");
      expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
        "I would like to hear gentle views about what matters to us today.",
      );
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("renders privacy-safe live member presence from the pulse", () => {
    const responseWithLivePresence: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        memberPresence: [
          { id: "member-self", name: "You", statusLabel: "You are here quietly." },
          { id: "member-present-1", name: "Member 1", statusLabel: "Joining at a quiet pace." },
          { id: "member-present-2", name: "Member 2", statusLabel: "Listening and joining without pressure." },
        ],
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithLivePresence} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Member 1")).toBeInTheDocument();
    expect(screen.getByTestId("together-member-status-member-self")).toHaveTextContent("You are here quietly.");
    expect(screen.getByTestId("together-member-status-member-present-1")).toHaveTextContent("Joining at a quiet pace.");
    expect(screen.queryByText("safe-haven-private-signals-user")).not.toBeInTheDocument();
  });

  it("opens a no-pressure activity detail check with VYVA", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-plan-detail-check-tea-film-chat-action"));

    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Easy questions for VYVA");
    expect(screen.getByTestId("together-composer-preview")).toHaveTextContent(
      "This question will be shared so VYVA can help or turn it into a vote.",
    );
    expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
      'VYVA, please check "Tea and film chat" before anyone commits. Confirm place, time, comfort, cost, and contact only by consent, without names.',
    );
    expect(screen.getByTestId("together-proposal-draft")).toHaveAttribute("rows", "6");
  }, 10000);

  it("lets seniors turn on larger room text for reading comfort", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    const room = screen.getByTestId("together-room-screen");
    const comfortToggle = screen.getByTestId("together-reading-comfort");

    expect(room).not.toHaveClass("together-readable");

    fireEvent.click(comfortToggle);

    expect(room).toHaveClass("together-readable");
    expect(comfortToggle).toHaveTextContent("Large text on");
    expect(comfortToggle).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem(readingComfortPreferenceKey)).toBe("on");
    expect(screen.getByTestId("together-reading-comfort-note")).toHaveTextContent(
      "Large text is on for you in this room only.",
    );

    fireEvent.click(comfortToggle);

    expect(room).not.toHaveClass("together-readable");
    expect(comfortToggle).toHaveTextContent("Large text");
    expect(comfortToggle).toHaveAttribute("aria-pressed", "false");
    expect(window.localStorage.getItem(readingComfortPreferenceKey)).toBeNull();
    expect(screen.queryByTestId("together-reading-comfort-note")).not.toBeInTheDocument();
  });

  it("reads the room aloud privately when speech support is available", () => {
    class FakeSpeechSynthesisUtterance {
      text: string;
      lang = "";
      rate = 1;
      pitch = 1;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(text: string) {
        this.text = text;
      }
    }
    const speak = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal("SpeechSynthesisUtterance", FakeSpeechSynthesisUtterance);
    Object.defineProperty(window, "speechSynthesis", {
      value: { speak, cancel },
      configurable: true,
    });

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-read-aloud"));

    expect(screen.getByTestId("together-read-aloud")).toHaveTextContent("Stop reading");
    expect(screen.getByTestId("together-read-aloud")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-status-message")).toHaveTextContent("Reading the room aloud privately");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0][0] as FakeSpeechSynthesisUtterance;
    expect(utterance.lang).toBe("en-US");
    expect(utterance.rate).toBeCloseTo(0.88);
    expect(utterance.text).toContain("Together Room");
    expect(utterance.text).toContain("Protected room");
    expect(utterance.text).toContain("Tea and film chat");
    expect(utterance.text).toContain("Best next tap");
    expect(apiFetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("together-read-aloud"));

    expect(cancel).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("together-read-aloud")).toHaveTextContent("Read aloud");
    expect(screen.getByTestId("together-read-aloud")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("together-status-message")).toHaveTextContent("Reading stopped");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("explains when private read aloud is not available", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-read-aloud"));

    expect(screen.getByTestId("together-read-aloud")).toHaveTextContent("Read aloud");
    expect(screen.getByTestId("together-read-aloud")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("together-status-message")).toHaveTextContent(
      "Read aloud is not available in this browser.",
    );
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("remembers large text for returning seniors on this device", () => {
    window.localStorage.setItem(readingComfortPreferenceKey, "on");

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-room-screen")).toHaveClass("together-readable");
    expect(screen.getByTestId("together-reading-comfort")).toHaveTextContent("Large text on");
    expect(screen.getByTestId("together-reading-comfort")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-reading-comfort-note")).toHaveTextContent(
      "Large text is on for you in this room only.",
    );

    fireEvent.click(screen.getByTestId("together-reading-comfort"));

    expect(screen.getByTestId("together-room-screen")).not.toHaveClass("together-readable");
    expect(window.localStorage.getItem(readingComfortPreferenceKey)).toBeNull();
  });

  it("saves and clears a private room note on this device only", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.change(screen.getByTestId("together-private-note-input"), {
      target: { value: "Ask about transport before I vote." },
    });

    expect(screen.getByTestId("together-private-note-count")).toHaveTextContent("186 characters left");

    fireEvent.click(screen.getByTestId("together-private-note-save"));

    expect(window.localStorage.getItem(privateRoomNoteKey)).toBe("Ask about transport before I vote.");
    expect(screen.getByTestId("together-status-message")).toHaveTextContent("Private note saved");
    expect(apiFetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("together-private-note-clear"));

    expect(screen.getByTestId("together-private-note-input")).toHaveValue("");
    expect(window.localStorage.getItem(privateRoomNoteKey)).toBeNull();
    expect(screen.getByTestId("together-status-message")).toHaveTextContent("Private note cleared");
    expect(screen.getByTestId("together-private-note-clear")).toBeDisabled();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("restores a private room note for returning seniors on this device", () => {
    window.localStorage.setItem(privateRoomNoteKey, "Remember to ask VYVA for a recap first.");

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-private-note-input")).toHaveValue(
      "Remember to ask VYVA for a recap first.",
    );
    expect(screen.getByTestId("together-private-note-clear")).not.toBeDisabled();
  });

  it("copies today's room notes as a no-name memory aid", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-room-notes-copy"));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const copiedText = writeText.mock.calls[0]?.[0] as string;

    expect(copiedText).toContain("Today's room notes");
    expect(copiedText).toContain("Known now: Vote: still open. Comfort: Easy access. Views: none yet.");
    expect(copiedText).toContain(
      "Still open: A few private choices are still needed. One calm view is still welcome. The activity is still being shaped.",
    );
    expect(copiedText).toContain("Next help: Start with hello, a comfort choice, or one private vote.");
    expect(copiedText).toContain("These notes use totals and signals, not names.");
    expect(copiedText).not.toContain("Carmen");
    expect(copiedText).not.toContain("Luis");
    expect(copiedText).not.toContain("Marco");
    expect(apiFetchMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByTestId("together-status-message")).toHaveTextContent("No-name notes copied");
    });
  });

  it("gives a gentle message when no-name notes cannot be copied", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-room-notes-copy"));

    expect(screen.getByTestId("together-status-message")).toHaveTextContent("Could not copy notes");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("offers quick safe paths into voting, views, and activity help", () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

      fireEvent.click(screen.getByTestId("together-path-vote"));
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });

      fireEvent.click(screen.getByTestId("together-path-activity"));
      expect(scrollIntoView).toHaveBeenCalledTimes(2);

      fireEvent.click(screen.getByTestId("together-path-view"));
      expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
        "I would like to hear gentle views about what matters to us today.",
      );
      expect(screen.getByTestId("together-proposal-draft")).toHaveFocus();
      expect(screen.getByTestId("together-view-tone-preview")).toHaveTextContent("Ready to share gently");
      expect(screen.getByTestId("together-composer-preview")).toHaveTextContent("Before you send");
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("opens the main Activities area from the activity path when provided", () => {
    const onOpenActivities = vi.fn();

    render(
      <TogetherRoomScreen
        roomResponse={roomResponse}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
        onOpenActivities={onOpenActivities}
      />,
    );

    fireEvent.click(screen.getByTestId("together-path-activity"));

    expect(onOpenActivities).toHaveBeenCalledTimes(1);
  });

  it("opens a safe room trust check with VYVA", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-room-trust-action"));

    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Easy questions for VYVA");
    expect(screen.getByTestId("together-composer-preview")).toHaveTextContent(
      "This question will be shared so VYVA can help or turn it into a vote.",
    );
    expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
      "VYVA, can you check whether this room feels safe to join today? Please summarize privacy, kindness, and contact safety in simple words, without names.",
    );
    expect(screen.getByTestId("together-proposal-draft")).toHaveFocus();
    expect(screen.getByTestId("together-proposal-draft")).toHaveAttribute("rows", "6");
  });

  it("opens a one-minute room intro with VYVA", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-room-trust-intro"));

    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Easy questions for VYVA");
    expect(screen.getByTestId("together-composer-preview")).toHaveTextContent(
      "This question will be shared so VYVA can help or turn it into a vote.",
    );
    expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
      "VYVA, please explain this room in one minute: how to vote, share a view, choose an activity, and stay safe, without names or pressure.",
    );
    expect(screen.getByTestId("together-proposal-draft")).toHaveFocus();
    expect(screen.getByTestId("together-proposal-draft")).toHaveAttribute("rows", "6");
  });

  it("explains the best next tap with a safe VYVA question", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-next-step-explain"));

    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Easy questions for VYVA");
    expect(screen.getByTestId("together-composer-preview")).toHaveTextContent(
      "This question will be shared so VYVA can help or turn it into a vote.",
    );
    expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
      'VYVA, I am not sure where to start. Please explain why "First, keep the room safe" is the safest next tap and give me one simple option, without names or pressure.',
    );
    expect(screen.getByTestId("together-proposal-draft")).toHaveFocus();
    expect(screen.getByTestId("together-proposal-draft")).toHaveAttribute("rows", "6");
  });

  it("saves the room promise acknowledgement", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      acknowledgedAt: "2026-06-04T10:15:00.000Z",
      pulse: {
        ...roomResponse.pulse!,
        safety: {
          ...roomResponse.pulse!.safety,
          myAcknowledgedAt: "2026-06-04T10:15:00.000Z",
        },
      },
    }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    const button = screen.getByTestId("together-acknowledge-agreement");
    expect(button).toHaveTextContent("I understand");

    fireEvent.click(button);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/safety-acknowledgement",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"visitId":"visit-1"'),
        }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByTestId("together-room-promise")).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId("together-acknowledge-agreement")).not.toBeInTheDocument();
    expect(screen.getAllByText("Room promise saved").length).toBeGreaterThan(0);
  });

  it("summarizes returning room activity at a glance", () => {
    const responseWithSignals: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        featuredPlan: {
          ...roomResponse.pulse!.featuredPlan,
          responseCounts: { join: 2, maybe: 1 },
        },
        activePoll: {
          ...roomResponse.pulse!.activePoll,
          options: roomResponse.pulse!.activePoll.options.map((option) => (
            option.id === "film" ? { ...option, votes: 3 } : option
          )),
          totalVotes: 3,
        },
        comfortCheck: {
          ...roomResponse.pulse!.comfortCheck,
          totalResponses: 4,
        },
        notifications: [
          {
            id: "update-return-1",
            type: "reply_added",
            title: "Someone replied gently",
            body: "\"Tea and film chat\": I can help choose.",
            createdAt: "2026-06-04T10:12:00.000Z",
            readAt: null,
          },
          {
            id: "update-return-2",
            type: "plan_joined",
            title: "Someone joined",
            body: "\"Quiet lunch\" has new company.",
            createdAt: "2026-06-04T09:12:00.000Z",
            readAt: "2026-06-04T09:30:00.000Z",
          },
        ],
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithSignals} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-at-glance-updates")).toHaveTextContent("1 update");
    expect(screen.getByTestId("together-at-glance-votes")).toHaveTextContent("3 votes");
    expect(screen.getByTestId("together-at-glance-interest")).toHaveTextContent("3 people interested");
    expect(screen.getByTestId("together-at-glance-comfort")).toHaveTextContent("4 comfort signals");
    expect(screen.getByTestId("together-vote-signal")).toHaveTextContent("Room signal");
    expect(screen.getByTestId("together-vote-signal")).toHaveTextContent(
      "A clear direction is forming, but the vote stays open and private. Film chat is ahead, but you can still choose calmly.",
    );
    expect(screen.getByTestId("together-room-summary-interest")).toHaveTextContent("3 people interested");
    expect(screen.getByTestId("together-room-summary-views")).toHaveTextContent("0 shared views");
    expect(screen.getByTestId("together-common-ground-interest")).toHaveTextContent(
      "3 people show interest, still no commitment.",
    );
    expect(screen.getByTestId("together-common-ground-views")).toHaveTextContent("Views can stay short and kind.");
  });

  it("reassures seniors when the main room vote is still close", () => {
    const responseWithCloseVote: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        activePoll: {
          ...roomResponse.pulse!.activePoll,
          options: roomResponse.pulse!.activePoll.options.map((option) => (
            option.id === "film"
              ? { ...option, votes: 2 }
              : option.id === "lunch"
              ? { ...option, votes: 1 }
              : option
          )),
          totalVotes: 3,
        },
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithCloseVote} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-vote-signal")).toHaveTextContent("Room signal");
    expect(screen.getByTestId("together-vote-signal")).toHaveTextContent(
      "The vote is still close. Choose what feels right without pressure.",
    );
    expect(screen.getByTestId("together-vote-signal-privacy")).toHaveTextContent("VYVA uses totals only, not names.");
  });

  it("shows when a featured activity already names the main comfort checks", () => {
    const responseWithComfortReadyPlan: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        featuredPlan: {
          ...roomResponse.pulse!.featuredPlan,
          comfortNeeds: ["easy_access", "seating", "transport_help", "arrival_buddy", "clear_cost"],
        },
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithComfortReadyPlan} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-plan-comfort-confidence-tea-film-chat")).toHaveTextContent(
      "Already noted: Easy access, Place to sit, Transport help.",
    );
    expect(screen.getByTestId("together-plan-comfort-confidence-tea-film-chat")).toHaveTextContent(
      "This plan already names the main comfort checks.",
    );
    expect(screen.getByTestId("together-plan-comfort-confidence-tea-film-chat")).toHaveTextContent(
      "Join or Maybe still does not share private contact.",
    );
  });

  it("summarizes my private room choices for returning members", () => {
    const responseWithMyChoices: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        featuredPlan: {
          ...roomResponse.pulse!.featuredPlan,
          myResponse: "maybe",
        },
        activePoll: {
          ...roomResponse.pulse!.activePoll,
          myVote: "views",
          options: roomResponse.pulse!.activePoll.options.map((option) => (
            option.id === "views" ? { ...option, votes: 1 } : option
          )),
          totalVotes: 1,
        },
        comfortCheck: {
          ...roomResponse.pulse!.comfortCheck,
          myComfortNeeds: ["quiet_pace", "arrival_buddy"],
          options: roomResponse.pulse!.comfortCheck.options.map((option) => (
            option.id === "quiet_pace" || option.id === "arrival_buddy"
              ? { ...option, count: option.count + 1 }
              : option
          )),
          totalResponses: 2,
        },
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithMyChoices} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-my-safe-choice-plan")).toHaveTextContent("Saved for later");
    expect(screen.getByTestId("together-my-safe-choice-vote")).toHaveTextContent("Share views");
    expect(screen.getByTestId("together-my-safe-choice-comfort")).toHaveTextContent("Quiet pace");
    expect(screen.getByTestId("together-my-safe-choice-comfort")).toHaveTextContent("Meet together");
    expect(screen.getByTestId("together-my-safe-choices")).toHaveTextContent("The room sees totals, not your name.");
  });

  it("lets a member pause quietly without telling the room", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      quietPausedAt: "2026-06-04T10:20:00.000Z",
      pulse: {
        ...roomResponse.pulse!,
        safety: {
          ...roomResponse.pulse!.safety,
          myQuietPausedAt: "2026-06-04T10:20:00.000Z",
        },
      },
    }));
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-quiet-pause"));

    expect(screen.getByTestId("together-quiet-pause")).toHaveTextContent("Quiet pause on");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-quiet-pause-note")).toHaveTextContent(
      "You can keep reading without telling the room.",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Quiet pause is on. Nothing is posted.");
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/quiet-pause",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"paused":true'),
        }),
      );
    });
  });

  it("lets a member leave quietly without notifying the room", () => {
    const onBack = vi.fn();

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={onBack} />);

    fireEvent.click(screen.getByTestId("together-leave-quietly"));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("keeps quiet pause state when local demo API returns simple success", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      quietPausedAt: "2026-06-04T10:20:00.000Z",
    }));
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-quiet-pause"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/quiet-pause",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"paused":true'),
        }),
      );
    });
    expect(screen.getByTestId("together-quiet-pause")).toHaveTextContent("Quiet pause on");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-quiet-pause-note")).toHaveTextContent(
      "You can keep reading without telling the room.",
    );

    apiFetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, quietPausedAt: null }));
    fireEvent.click(screen.getByTestId("together-quiet-pause"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenLastCalledWith(
        "/api/social/rooms/together-room/quiet-pause",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"paused":false'),
        }),
      );
    });
    expect(screen.getByTestId("together-quiet-pause")).toHaveTextContent("Pause quietly");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("together-quiet-pause-note")).not.toBeInTheDocument();
  });

  it("explains when quiet pause cannot be saved", async () => {
    apiFetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    }));
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-quiet-pause"));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Quiet pause could not be updated. Please try again.");
    });
    expect(screen.getByTestId("together-quiet-pause")).toHaveTextContent("Pause quietly");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("together-quiet-pause-note")).not.toBeInTheDocument();
  });

  it("restores a private quiet pause from the room pulse", () => {
    render(
      <TogetherRoomScreen
        roomResponse={{
          ...roomResponse,
          pulse: {
            ...roomResponse.pulse!,
            safety: {
              ...roomResponse.pulse!.safety,
              myQuietPausedAt: "2026-06-04T10:20:00.000Z",
            },
          },
        }}
        language="en"
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByTestId("together-quiet-pause")).toHaveTextContent("Quiet pause on");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-quiet-pause-note")).toHaveTextContent(
      "You can keep reading without telling the room.",
    );
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("keeps quiet pause on when saving private comfort choices", async () => {
    const responseWithQuietPause: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        safety: {
          ...roomResponse.pulse!.safety,
          myQuietPausedAt: "2026-06-04T10:20:00.000Z",
        },
      },
    };
    const quietPulse = responseWithQuietPause.pulse!;
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      pulse: {
        ...quietPulse,
        comfortCheck: {
          ...quietPulse.comfortCheck,
          myComfortNeeds: ["quiet_pace"],
          options: quietPulse.comfortCheck.options.map((option) => (
            option.id === "quiet_pace" ? { ...option, count: option.count + 1 } : option
          )),
          totalResponses: quietPulse.comfortCheck.totalResponses + 1,
        },
      },
    }));

    render(<TogetherRoomScreen roomResponse={responseWithQuietPause} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-arrival-comfort-quiet_pace"));

    await waitFor(() => {
      expect(screen.getByTestId("together-my-safe-choice-comfort")).toHaveTextContent("Quiet pace");
    });

    expect(screen.getByTestId("together-quiet-pause")).toHaveTextContent("Quiet pause on");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-quiet-pause-note")).toHaveTextContent(
      "You can keep reading without telling the room.",
    );
    expect(screen.getByTestId("together-status-message")).toHaveTextContent("Quiet pace saved");
    expect(screen.getByTestId("together-status-message")).not.toHaveTextContent(
      "Quiet pause turned off so this could be sent.",
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/social/rooms/together-room/comfort-check",
      expect.objectContaining({
        body: expect.stringContaining('"comfortNeeds":["quiet_pace"]'),
      }),
    );
    expect(apiFetchMock).not.toHaveBeenCalledWith(
      "/api/social/rooms/together-room/quiet-pause",
      expect.objectContaining({
        body: expect.stringContaining('"paused":false'),
      }),
    );
  });

  it("keeps my private choice snapshot current as I choose", async () => {
    let serverPulse = roomResponse.pulse!;
    apiFetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));

      if (url.includes("/plans/tea-film-chat/respond")) {
        const response = body.response as "join" | "maybe";
        serverPulse = {
          ...serverPulse,
          featuredPlan: {
            ...serverPulse.featuredPlan,
            responseCounts: { join: response === "join" ? 1 : 0, maybe: response === "maybe" ? 1 : 0 },
            myResponse: response,
          },
        };
        return Promise.resolve(jsonResponse({ ok: true, pulse: serverPulse }));
      }

      if (url.includes("/polls/daily-room-choice/vote")) {
        const optionId = body.optionId as string;
        const previousVote = serverPulse.activePoll.myVote;
        const options = serverPulse.activePoll.options.map((option) => {
          let votes = option.votes;
          if (option.id === previousVote) votes = Math.max(0, votes - 1);
          if (option.id === optionId) votes += 1;
          return { ...option, votes };
        });
        serverPulse = {
          ...serverPulse,
          activePoll: {
            ...serverPulse.activePoll,
            myVote: optionId,
            options,
            totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
          },
        };
        return Promise.resolve(jsonResponse({ ok: true, pulse: serverPulse }));
      }

      if (url.includes("/comfort-check")) {
        const comfortNeeds = body.comfortNeeds as string[];
        serverPulse = {
          ...serverPulse,
          comfortCheck: {
            ...serverPulse.comfortCheck,
            myComfortNeeds: comfortNeeds,
            options: serverPulse.comfortCheck.options.map((option) => ({
              ...option,
              count: option.id === "quiet_pace" && comfortNeeds.includes("quiet_pace") ? 1 : option.count,
            })),
            totalResponses: comfortNeeds.length ? 2 : 1,
          },
        };
        return Promise.resolve(jsonResponse({ ok: true, pulse: serverPulse }));
      }

      return Promise.resolve(jsonResponse({ ok: true, pulse: serverPulse }));
    });

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-quiet-pause"));
    expect(screen.getByTestId("together-quiet-pause")).toHaveTextContent("Quiet pause on");

    fireEvent.click(screen.getByTestId("together-maybe-plan"));
    await waitFor(() => {
      expect(screen.getByTestId("together-my-safe-choice-plan")).toHaveTextContent("Saved for later");
    });
    expect(screen.getByTestId("together-quiet-pause")).toHaveTextContent("Pause quietly");
    expect(screen.queryByTestId("together-quiet-pause-note")).not.toBeInTheDocument();
    expect(screen.getByTestId("together-status-message")).toHaveTextContent("Saved for later");
    expect(screen.getByTestId("together-status-message")).toHaveTextContent(
      "Quiet pause turned off so this could be sent.",
    );

    fireEvent.click(screen.getByTestId("together-vote-views"));
    await waitFor(() => {
      expect(screen.getByTestId("together-my-safe-choice-vote")).toHaveTextContent("Share views");
    });

    fireEvent.click(screen.getByTestId("together-comfort-check-quiet_pace"));
    await waitFor(() => {
      expect(screen.getByTestId("together-my-safe-choice-comfort")).toHaveTextContent("Quiet pace");
    });
    expect(screen.getByTestId("together-my-safe-choices")).toHaveTextContent("The room sees totals, not your name.");
  });

  it("lets a member privately remove plan interest without leaving quiet pause", async () => {
    const responseWithSavedPlan: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        safety: {
          ...roomResponse.pulse!.safety,
          myQuietPausedAt: "2026-06-04T10:20:00.000Z",
        },
        featuredPlan: {
          ...roomResponse.pulse!.featuredPlan,
          responseCounts: { join: 0, maybe: 1 },
          myResponse: "maybe",
        },
      },
    };
    render(<TogetherRoomScreen roomResponse={responseWithSavedPlan} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-maybe-plan")).toHaveTextContent("Saved for later");
    expect(screen.getByTestId("together-clear-plan-choice")).toHaveTextContent("Remove my choice");

    fireEvent.click(screen.getByTestId("together-clear-plan-choice"));

    expect(screen.getByRole("status")).toHaveTextContent("Your choice was removed");
    expect(screen.getByTestId("together-featured-response-summary")).toHaveTextContent("You can be first to choose.");
    expect(screen.queryByTestId("together-clear-plan-choice")).not.toBeInTheDocument();
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-quiet-pause-note")).toHaveTextContent(
      "You can keep reading without telling the room.",
    );
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/plans/tea-film-chat/respond",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"response":"clear"'),
        }),
      );
    });
  });

  it("lets a member privately pass on a plan without leaving quiet pause", async () => {
    const responseWithQuietPause: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        safety: {
          ...roomResponse.pulse!.safety,
          myQuietPausedAt: "2026-06-04T10:20:00.000Z",
        },
      },
    };
    const privatePassPulse: SocialRoomPulse = {
      ...responseWithQuietPause.pulse!,
      featuredPlan: {
        ...responseWithQuietPause.pulse!.featuredPlan,
        responseCounts: { join: 0, maybe: 0, not_for_me: 1 },
        myResponse: "not_for_me",
      },
    };
    apiFetchMock.mockImplementation((url: string) => {
      if (url.includes("/plans/tea-film-chat/respond")) {
        return Promise.resolve(jsonResponse({
          ok: true,
          planResponse: {
            planId: "tea-film-chat",
            response: "not_for_me",
            responseCounts: { join: 0, maybe: 0, not_for_me: 1 },
          },
          pulse: privatePassPulse,
        }));
      }

      return Promise.resolve(jsonResponse({ ok: true, pulse: responseWithQuietPause.pulse }));
    });

    render(<TogetherRoomScreen roomResponse={responseWithQuietPause} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-plan-choice-note")).toHaveTextContent("Not for me is private");

    fireEvent.click(screen.getByTestId("together-not-for-me-plan"));

    expect(screen.getByRole("status")).toHaveTextContent("Kept private: not for me");

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/plans/tea-film-chat/respond",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"response":"not_for_me"'),
        }),
      );
    });
    expect(screen.getByTestId("together-not-for-me-plan")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-featured-response-summary")).toHaveTextContent("1 passing");
    expect(screen.getByTestId("together-plan-next-step")).toHaveTextContent(
      "Not for me was kept private. You can change your mind later.",
    );
    expect(screen.getByTestId("together-my-safe-choice-plan")).toHaveTextContent("Private pass");
    expect(screen.getByTestId("together-clear-plan-choice")).toHaveTextContent("Remove my choice");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-quiet-pause-note")).toHaveTextContent(
      "You can keep reading without telling the room.",
    );
    expect(apiFetchMock.mock.calls.some(([url, init]) => (
      String(url).includes("/quiet-pause") &&
      String((init as RequestInit | undefined)?.body ?? "").includes('"paused":false')
    ))).toBe(false);
  });

  it("lets a member privately remove a room vote without leaving quiet pause", async () => {
    const responseWithSavedVote: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        safety: {
          ...roomResponse.pulse!.safety,
          myQuietPausedAt: "2026-06-04T10:20:00.000Z",
        },
        activePoll: {
          ...roomResponse.pulse!.activePoll,
          myVote: "views",
          options: roomResponse.pulse!.activePoll.options.map((option) => (
            option.id === "views" ? { ...option, votes: 1 } : option
          )),
          totalVotes: 1,
        },
      },
    };
    render(<TogetherRoomScreen roomResponse={responseWithSavedVote} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-clear-vote")).toHaveTextContent("Remove my vote");
    expect(screen.getByTestId("together-vote-views")).toHaveTextContent("Your choice");

    fireEvent.click(screen.getByTestId("together-clear-vote"));

    expect(screen.getByRole("status")).toHaveTextContent("Your vote was removed");
    expect(screen.queryByTestId("together-clear-vote")).not.toBeInTheDocument();
    expect(screen.getByTestId("together-vote-views")).not.toHaveTextContent("Your choice");
    expect(screen.getByTestId("together-vote-views")).toHaveTextContent("0 votes");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-quiet-pause-note")).toHaveTextContent(
      "You can keep reading without telling the room.",
    );
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/polls/daily-room-choice/vote",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"action":"clear"'),
        }),
      );
    });
  });

  it("lets a member pass the room vote for now without sending a vote", async () => {
    const quietPulse: SocialRoomPulse = {
      ...roomResponse.pulse!,
      safety: {
        ...roomResponse.pulse!.safety,
        myQuietPausedAt: "2026-06-04T10:22:00.000Z",
      },
    };
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, pulse: quietPulse }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-pass-vote")).toHaveTextContent("I'll decide later");
    expect(screen.getByTestId("together-pass-vote")).toHaveTextContent("No vote is sent.");
    expect(screen.getByTestId("together-pass-vote")).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByTestId("together-pass-vote"));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("You can decide later. No vote was sent.");
    });
    expect(screen.getByTestId("together-pass-vote")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-quiet-pause-note")).toHaveTextContent(
      "You can keep reading without telling the room.",
    );
    expect(screen.getByTestId("together-my-safe-choice-vote")).toHaveTextContent("No vote yet");
    expect(screen.getByTestId("together-at-glance-votes")).toHaveTextContent("0 votes");
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/social/rooms/together-room/quiet-pause",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"paused":true'),
      }),
    );
    expect(apiFetchMock.mock.calls.some(([url]) => String(url).includes("/polls/daily-room-choice/vote"))).toBe(false);
  });

  it("points my safe choices to the next missing private choice", () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      const initialRender = render(
        <TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />,
      );

      expect(screen.getByTestId("together-my-safe-next-action")).toHaveTextContent("Add comfort choice");
      fireEvent.click(screen.getByTestId("together-my-safe-next-action"));
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
      expect(screen.getByTestId("together-comfort-check")).toHaveFocus();
      initialRender.unmount();

      const withComfortChoice: SocialRoomResponse = {
        ...roomResponse,
        pulse: {
          ...roomResponse.pulse!,
          comfortCheck: {
            ...roomResponse.pulse!.comfortCheck,
            myComfortNeeds: ["quiet_pace"],
          },
        },
      };
      const comfortRender = render(
        <TogetherRoomScreen roomResponse={withComfortChoice} language="en" visitId="visit-1" onBack={vi.fn()} />,
      );

      expect(screen.getByTestId("together-my-safe-next-action")).toHaveTextContent("Vote privately");
      fireEvent.click(screen.getByTestId("together-my-safe-next-action"));
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
      expect(screen.getByTestId("together-room-choice")).toHaveFocus();
      comfortRender.unmount();

      const withComfortAndVote: SocialRoomResponse = {
        ...withComfortChoice,
        pulse: {
          ...withComfortChoice.pulse!,
          activePoll: {
            ...withComfortChoice.pulse!.activePoll,
            myVote: "views",
          },
        },
      };
      const voteRender = render(
        <TogetherRoomScreen roomResponse={withComfortAndVote} language="en" visitId="visit-1" onBack={vi.fn()} />,
      );

      expect(screen.getByTestId("together-my-safe-next-action")).toHaveTextContent("Choose activity");
      fireEvent.click(screen.getByTestId("together-my-safe-next-action"));
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
      expect(screen.getByTestId("together-featured-plan")).toHaveFocus();
      voteRender.unmount();

      const withAllPrivateChoices: SocialRoomResponse = {
        ...withComfortAndVote,
        pulse: {
          ...withComfortAndVote.pulse!,
          featuredPlan: {
            ...withComfortAndVote.pulse!.featuredPlan,
            myResponse: "maybe",
          },
        },
      };
      render(<TogetherRoomScreen roomResponse={withAllPrivateChoices} language="en" visitId="visit-1" onBack={vi.fn()} />);

      expect(screen.queryByTestId("together-my-safe-next-action")).not.toBeInTheDocument();
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("keeps optimistic safe choices when local demo actions return simple success", async () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-acknowledge-agreement"));
    await waitFor(() => {
      expect(screen.queryByTestId("together-room-promise")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("together-status-message")).toHaveTextContent("Room promise saved");

    fireEvent.click(screen.getByTestId("together-maybe-plan"));
    await waitFor(() => {
      expect(screen.getByTestId("together-my-safe-choice-plan")).toHaveTextContent("Saved for later");
    });
    expect(screen.getByTestId("together-status-message")).toHaveTextContent("Saved for later");

    fireEvent.click(screen.getByTestId("together-vote-views"));
    await waitFor(() => {
      expect(screen.getByTestId("together-my-safe-choice-vote")).toHaveTextContent("Share views");
    });
    expect(screen.getByTestId("together-status-message")).toHaveTextContent("Your vote is saved");

    fireEvent.click(screen.getByTestId("together-comfort-check-quiet_pace"));
    await waitFor(() => {
      expect(screen.getByTestId("together-my-safe-choice-comfort")).toHaveTextContent("Quiet pace");
    });
    expect(screen.getByTestId("together-comfort-check-quiet_pace")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-status-message")).toHaveTextContent("Comfort choice saved");
    expect(screen.queryByText("Could not post it. Please try again.")).not.toBeInTheDocument();
  });

  it("opens a gentle vote suggestion from the room vote card", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-suggest-vote"));

    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Easy questions for VYVA");
    expect(screen.getByTestId("together-ask-prompt-vote")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "VYVA, can you turn this into a simple room vote?",
    );
    expect(screen.queryByText("What kind of experience?")).not.toBeInTheDocument();
  });

  it("opens common issue shortcuts as safe future vote drafts", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-issue-shortcut-cost")).toHaveAccessibleName(
      "Cost: VYVA, can you suggest a simple vote to clarify cost before anyone commits?",
    );

    fireEvent.click(screen.getByTestId("together-issue-shortcut-cost"));

    expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
      "VYVA, can you suggest a simple vote to clarify cost before anyone commits?",
    );
    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Easy questions for VYVA");
    expect(screen.getByTestId("together-composer-preview")).toHaveTextContent(
      "This question will be shared so VYVA can help or turn it into a vote.",
    );

    fireEvent.click(screen.getByTestId("together-issue-shortcut-safety"));

    expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
      "VYVA, can you suggest a simple vote about what would make this safer and no-pressure?",
    );
  });

  it("counts real shared views in the room summary without mixing in hellos", () => {
    const responseWithViewAndHello: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        featuredPlan: {
          ...roomResponse.pulse!.featuredPlan,
          responseCounts: { join: 1, maybe: 1 },
        },
        postedExperiences: [
          {
            id: "view-1",
            key: "view-1",
            kind: "message",
            title: "I would like a calm start",
            body: "Let us choose slowly and keep it simple.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 0, maybe: 0 },
            myResponse: null,
          },
          {
            id: "hello-1",
            key: "hello-1",
            kind: "message",
            title: "Say hello",
            body: "Hello, I am listening first.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:01:00.000Z",
            responseCounts: { join: 0, maybe: 0 },
            myResponse: null,
          },
        ],
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithViewAndHello} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-room-summary-interest")).toHaveTextContent("2 people interested");
    expect(screen.getByTestId("together-room-summary-views")).toHaveTextContent("1 shared view");
    expect(screen.getByTestId("together-common-ground-interest")).toHaveTextContent(
      "2 people show interest, still no commitment.",
    );
    expect(screen.getByTestId("together-common-ground-views")).toHaveTextContent(
      "1 shared view, with review nearby.",
    );
    expect(screen.getByTestId("together-view-circle-count")).toHaveTextContent("1 shared view");
    expect(screen.getByTestId("together-shared-today")).toHaveTextContent("Hello");
  });

  it("uses the best next tap to privately listen first after the room promise", async () => {
    const responseAfterPromise: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        safety: {
          ...roomResponse.pulse!.safety,
          myAcknowledgedAt: "2026-06-04T10:15:00.000Z",
        },
      },
    };
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      comfortNeeds: ["listen_first"],
      pulse: {
        ...responseAfterPromise.pulse!,
        comfortCheck: {
          ...responseAfterPromise.pulse!.comfortCheck,
          options: responseAfterPromise.pulse!.comfortCheck.options.map((option) => (
            option.id === "listen_first" ? { ...option, count: 1 } : option
          )),
          myComfortNeeds: ["listen_first"],
          totalResponses: 2,
        },
      },
    }));

    render(<TogetherRoomScreen roomResponse={responseAfterPromise} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-next-step-cue")).toHaveTextContent("Start in the way that fits");
    fireEvent.click(screen.getByTestId("together-next-step-comfort"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/comfort-check",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"comfortNeeds":["listen_first"]'),
        }),
      );
    });
    expect(screen.getAllByText("Listening first saved").length).toBeGreaterThan(0);
  });

  it("uses the best next tap to point returning members to unread updates", () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    const responseWithUpdates: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        safety: {
          ...roomResponse.pulse!.safety,
          myAcknowledgedAt: "2026-06-04T10:15:00.000Z",
        },
        comfortCheck: {
          ...roomResponse.pulse!.comfortCheck,
          myComfortNeeds: ["quiet_pace"],
        },
        notifications: [
          {
            id: "update-return-1",
            type: "reply_added",
            title: "Someone replied gently",
            body: "\"Tea and film chat\": I can help choose.",
            createdAt: "2026-06-04T10:12:00.000Z",
            readAt: null,
          },
        ],
      },
    };

    try {
      render(<TogetherRoomScreen roomResponse={responseWithUpdates} language="en" visitId="visit-1" onBack={vi.fn()} />);

      expect(screen.getByTestId("together-next-step-cue")).toHaveTextContent("Something new is waiting");
      fireEvent.click(screen.getByTestId("together-next-step-updates"));

      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("saves comfort check-in choices for activity planning", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      comfortNeeds: ["quiet_pace"],
      pulse: {
        ...roomResponse.pulse!,
        comfortCheck: {
          ...roomResponse.pulse!.comfortCheck,
          options: [
            { id: "quiet_pace", label: "Quiet pace", count: 1 },
            { id: "easy_access", label: "Easy access", count: 1 },
            { id: "seating", label: "Place to sit", count: 0 },
          ],
          myComfortNeeds: ["quiet_pace"],
          totalResponses: 2,
        },
      },
    }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-comfort-check-quiet_pace"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/comfort-check",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"comfortNeeds":["quiet_pace"]'),
        }),
      );
    });
    expect(screen.getByTestId("together-comfort-check-quiet_pace")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-comfort-check-quiet_pace")).toHaveTextContent("1 chose this");
    expect(screen.getByRole("status")).toHaveTextContent("Comfort choice saved");
  });

  it("lets a member listen first without posting to the room", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      comfortNeeds: ["listen_first"],
      pulse: {
        ...roomResponse.pulse!,
        comfortCheck: {
          ...roomResponse.pulse!.comfortCheck,
          options: roomResponse.pulse!.comfortCheck.options.map((option) => (
            option.id === "listen_first" ? { ...option, count: 1 } : option
          )),
          myComfortNeeds: ["listen_first"],
          totalResponses: 2,
        },
      },
    }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-comfort-check-listen_first"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/comfort-check",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"comfortNeeds":["listen_first"]'),
        }),
      );
    });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("together-comfort-check-listen_first")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-comfort-check-listen_first")).toHaveTextContent("1 chose this");
    expect(screen.getByRole("status")).toHaveTextContent("Comfort choice saved");
  });

  it("lets a member privately listen first from the arrival cue", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      comfortNeeds: ["listen_first"],
      pulse: {
        ...roomResponse.pulse!,
        comfortCheck: {
          ...roomResponse.pulse!.comfortCheck,
          options: roomResponse.pulse!.comfortCheck.options.map((option) => (
            option.id === "listen_first" ? { ...option, count: 1 } : option
          )),
          myComfortNeeds: ["listen_first"],
          totalResponses: 2,
        },
      },
    }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-listen-first"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/comfort-check",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"comfortNeeds":["listen_first"]'),
        }),
      );
    });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(String(apiFetchMock.mock.calls[0][0])).not.toContain("/proposals");
    expect(screen.getByTestId("together-listen-first")).toHaveTextContent("Listening first saved");
    expect(screen.getByTestId("together-listen-first")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-comfort-check-listen_first")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Listening first saved");
  });

  it("lets a member privately request an arrival buddy from the arrival cue", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      comfortNeeds: ["arrival_buddy"],
      pulse: {
        ...roomResponse.pulse!,
        comfortCheck: {
          ...roomResponse.pulse!.comfortCheck,
          options: roomResponse.pulse!.comfortCheck.options.map((option) => (
            option.id === "arrival_buddy" ? { ...option, count: 1 } : option
          )),
          myComfortNeeds: ["arrival_buddy"],
          totalResponses: 2,
        },
      },
    }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-arrival-comfort-arrival_buddy"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/comfort-check",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"comfortNeeds":["arrival_buddy"]'),
        }),
      );
    });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(String(apiFetchMock.mock.calls[0][0])).not.toContain("/proposals");
    expect(screen.getByTestId("together-arrival-comfort-arrival_buddy")).toHaveTextContent("Meet together saved");
    expect(screen.getByTestId("together-arrival-comfort-arrival_buddy")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-comfort-check-arrival_buddy")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Meet together saved");
  });

  it("lets a member change a private arrival comfort choice", async () => {
    const responseWithBuddy: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        comfortCheck: {
          ...roomResponse.pulse!.comfortCheck,
          options: roomResponse.pulse!.comfortCheck.options.map((option) => (
            option.id === "arrival_buddy" ? { ...option, count: 1 } : option
          )),
          myComfortNeeds: ["arrival_buddy"],
          totalResponses: 1,
        },
      },
    };
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      comfortNeeds: [],
      pulse: {
        ...responseWithBuddy.pulse!,
        comfortCheck: {
          ...responseWithBuddy.pulse!.comfortCheck,
          options: responseWithBuddy.pulse!.comfortCheck.options.map((option) => (
            option.id === "arrival_buddy" ? { ...option, count: 0 } : option
          )),
          myComfortNeeds: [],
          totalResponses: 0,
        },
      },
    }));

    render(<TogetherRoomScreen roomResponse={responseWithBuddy} language="en" visitId="visit-1" onBack={vi.fn()} />);

    const buddyButton = screen.getByTestId("together-arrival-comfort-arrival_buddy");
    expect(buddyButton).toHaveAttribute("aria-pressed", "true");
    expect(buddyButton).toHaveTextContent("Meet together saved");
    expect(buddyButton).not.toBeDisabled();

    fireEvent.click(buddyButton);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/comfort-check",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"comfortNeeds":[]'),
        }),
      );
    });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(buddyButton).toHaveAttribute("aria-pressed", "false");
    expect(buddyButton).toHaveTextContent("Meet together");
    expect(screen.getByTestId("together-comfort-check-arrival_buddy")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("status")).toHaveTextContent("Meet together removed");
  });

  it("prevents repeated comfort check-ins while saving", async () => {
    let resolveComfortCheck: (value: Response) => void = () => undefined;
    apiFetchMock.mockImplementation((url: string) => {
      if (url.includes("/comfort-check")) {
        return new Promise<Response>((resolve) => {
          resolveComfortCheck = resolve;
        });
      }
      return Promise.resolve(jsonResponse({ ok: true, pulse: roomResponse.pulse }));
    });

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    const quietChoice = screen.getByTestId("together-comfort-check-quiet_pace");
    const easyAccessChoice = screen.getByTestId("together-comfort-check-easy_access");
    fireEvent.click(quietChoice);

    await waitFor(() => {
      expect(quietChoice).toBeDisabled();
      expect(easyAccessChoice).toBeDisabled();
    });
    fireEvent.click(easyAccessChoice);

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/social/rooms/together-room/comfort-check",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"comfortNeeds":["quiet_pace"]'),
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Comfort choice saved");

    resolveComfortCheck(jsonResponse({ ok: true, pulse: roomResponse.pulse }));

    await waitFor(() => {
      expect(quietChoice).not.toBeDisabled();
      expect(easyAccessChoice).not.toBeDisabled();
    });
  });

  it("turns poll results into a gentle next step", () => {
    const responseWithVotes: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        activePoll: {
          ...roomResponse.pulse!.activePoll,
          options: [
            { id: "film", label: "Film chat", votes: 2 },
            { id: "lunch", label: "Quiet lunch", votes: 1 },
          ],
          totalVotes: 3,
        },
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithVotes} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-vote-film")).toHaveTextContent("67%");
    expect(screen.getByTestId("together-vote-film")).toHaveTextContent("2 votes");
    expect(screen.getByTestId("together-vote-lunch")).toHaveTextContent("33%");
    expect(screen.getByTestId("together-vote-lunch")).toHaveTextContent("1 vote");
    expect(screen.getByTestId("together-poll-next-step")).toHaveTextContent("The room is leaning toward: Film chat.");
    expect(screen.getByTestId("together-poll-next-step")).toHaveTextContent(
      "You can join the plan above or suggest a gentler version.",
    );
    expect(screen.getByTestId("together-vote-impact")).toHaveTextContent(
      "The room is leaning toward Film chat. VYVA will shape it around Easy access.",
    );
    expect(screen.getByTestId("together-vote-impact-choice")).toHaveTextContent(
      "You have not voted yet. You can look first.",
    );
    expect(screen.getByTestId("together-room-direction")).toHaveTextContent("The room is leaning toward Film chat.");
    expect(screen.getByTestId("together-room-direction")).toHaveTextContent("Shape it around Easy access.");
    expect(screen.getByTestId("together-room-summary-vote")).toHaveTextContent("Film chat");
    expect(screen.getByTestId("together-room-summary-comfort")).toHaveTextContent("Easy access");
    expect(screen.getByTestId("together-room-summary-next")).toHaveTextContent(
      "Make one calm plan around Film chat | Easy access.",
    );
    expect(screen.getByTestId("together-room-outcome-bridge")).toHaveTextContent(
      "VYVA will shape Film chat around Easy access before anyone commits.",
    );
    expect(screen.getByTestId("together-decision-guide")).toHaveTextContent("The room is leaning toward Film chat.");
    expect(screen.getByTestId("together-decision-guide-steps")).toHaveTextContent("The room has a leading choice.");
    expect(screen.getByTestId("together-room-readiness-vote")).toHaveTextContent("The room has a leading choice.");
    expect(screen.getByTestId("together-room-readiness-comfort")).toHaveTextContent("Comfort needs are visible.");
    expect(screen.getByTestId("together-use-room-direction")).toHaveTextContent("Make this a plan");

    fireEvent.click(screen.getByTestId("together-use-room-direction"));

    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "A gentle version of Film chat with Easy access.",
    );
    expect(screen.getByTestId("together-proposal-category-movie_date")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-proposal-group-small_group")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("together-view-starters")).not.toBeInTheDocument();
  });

  it("keeps tied room votes open instead of claiming a winner", () => {
    const responseWithTiedVotes: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        activePoll: {
          ...roomResponse.pulse!.activePoll,
          options: [
            { id: "film", label: "Film chat", votes: 2 },
            { id: "lunch", label: "Quiet lunch", votes: 2 },
            { id: "views", label: "Share views", votes: 0 },
          ],
          totalVotes: 4,
        },
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithTiedVotes} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-poll-next-step")).toHaveTextContent(
      "The room is still choosing between: Film chat | Quiet lunch.",
    );
    expect(screen.getByTestId("together-room-direction")).toHaveTextContent(
      "The room is still choosing between Film chat | Quiet lunch.",
    );
    expect(screen.getByTestId("together-room-summary-vote")).toHaveTextContent("Tied: Film chat | Quiet lunch");
    expect(screen.getByTestId("together-room-summary-next")).toHaveTextContent(
      "Keep voting or ask VYVA for a simple recap.",
    );
    expect(screen.getByTestId("together-vote-impact")).toHaveTextContent(
      "The room is split between Film chat | Quiet lunch. VYVA can summarize both without rushing anyone.",
    );
    expect(screen.getByTestId("together-room-outcome-bridge")).toHaveTextContent(
      "VYVA will keep Film chat | Quiet lunch open and summarize them before anyone feels rushed.",
    );
    expect(screen.getByTestId("together-decision-guide")).toHaveTextContent("Tied: Film chat | Quiet lunch");
    expect(screen.queryByTestId("together-use-room-direction")).not.toBeInTheDocument();
    expect(screen.getByTestId("together-ask-recap")).toHaveTextContent("Ask VYVA for a recap");

    fireEvent.click(screen.getByTestId("together-ask-recap"));

    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "VYVA, please summarize the room choice about Film chat | Quiet lunch and the comfort needs: Easy access.",
    );
  });

  it("opens a safe VYVA recap draft from the room decision guide", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, pulse: roomResponse.pulse }));

    const responseWithVotes: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        activePoll: {
          ...roomResponse.pulse!.activePoll,
          options: [
            { id: "film", label: "Film chat", votes: 2 },
            { id: "lunch", label: "Quiet lunch", votes: 1 },
            { id: "views", label: "Share views", votes: 0 },
          ],
          totalVotes: 3,
        },
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithVotes} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-ask-recap"));

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Easy questions for VYVA");
    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "VYVA, please summarize the room choice about Film chat and the comfort needs: Easy access.",
    );
    expect(screen.queryByText("What kind of experience?")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/proposals",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"kind":"question"'),
        }),
      );
    });
    const body = JSON.parse(String(apiFetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      title: "VYVA, please summarize the room choice about Film chat and the comfort needs: Easy access.",
      details: "VYVA, please summarize the room choice about Film chat and the comfort needs: Easy access.",
      locationLabel: "online",
      comfortNeeds: [],
      kind: "question",
      experienceCategory: "other",
      preferredTime: "flexible",
      costRange: "discuss",
      groupSize: "open_room",
    });
  });

  it("summarizes useful next steps and opens safe VYVA drafts", () => {
    const supportedQuestion: SocialRoomPlan = {
      id: "question-cost",
      key: "question-cost",
      kind: "question",
      title: "Could cost be clear first?",
      body: "VYVA, can you help us clarify cost before anyone commits?",
      locationLabel: "online",
      comfortNeeds: [],
      experienceCategory: "other",
      preferredTime: "flexible",
      costRange: "discuss",
      groupSize: "open_room",
      safetyFlags: [],
      needsReview: false,
      startsAt: null,
      status: "active",
      responseCounts: { join: 1, maybe: 0 },
      myResponse: null,
    };
    const sharedView: SocialRoomPlan = {
      id: "view-quiet",
      key: "view-quiet",
      kind: "message",
      title: "I prefer quiet places",
      body: "A smaller room helps me listen.",
      locationLabel: "online",
      comfortNeeds: [],
      experienceCategory: "other",
      preferredTime: "flexible",
      costRange: "discuss",
      groupSize: "open_room",
      safetyFlags: [],
      needsReview: false,
      startsAt: null,
      status: "active",
      responseCounts: { join: 0, maybe: 0 },
      myResponse: null,
    };
    const responseWithReadySteps: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        featuredPlan: {
          ...roomResponse.pulse!.featuredPlan,
          comfortNeeds: ["quiet_pace"],
          responseCounts: { join: 1, maybe: 1 },
          replies: [
            {
              id: "reply-helper",
              planKey: "tea-film-chat",
              authorName: "Luis",
              body: "I can help choose one simple option for the group.",
              tone: "help",
              status: "active",
              createdAt: "2026-06-04T10:00:00.000Z",
            },
          ],
        },
        postedExperiences: [supportedQuestion, sharedView],
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithReadySteps} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-room-notes")).toHaveTextContent("Today's room notes");
    expect(screen.getByTestId("together-room-notes-known")).toHaveTextContent("1 shared view.");
    expect(screen.getByTestId("together-room-notes-open")).toHaveTextContent(
      "A few private choices are still needed.",
    );
    expect(screen.getByTestId("together-room-notes-open")).not.toHaveTextContent(
      "The activity is still being shaped.",
    );
    expect(screen.getByTestId("together-room-notes-next")).toHaveTextContent(
      'VYVA can prepare "Tea and film chat" as one safe step.',
    );
    expect(screen.getByTestId("together-room-notes-next-action")).toHaveTextContent("Prepare this step");

    fireEvent.click(screen.getByTestId("together-room-notes-next-action"));
    expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
      'VYVA, "Tea and film chat" looks ready. Room signals: Interest: 1 joining | 1 maybe; Comfort: Quiet pace; Activity helpers: Help choose. Can you prepare the next simple and safe step?',
    );
    fireEvent.click(screen.getByTestId("together-cancel-proposal"));

    expect(screen.getByTestId("together-useful-next-steps")).toHaveTextContent("Useful next steps");
    expect(screen.getByTestId("together-useful-next-activity")).toHaveTextContent(
      "Ready for VYVA to prepare one safe next step.",
    );
    expect(screen.getByTestId("together-useful-next-vote")).toHaveTextContent(
      "A question has support and can become a private vote.",
    );
    expect(screen.getByTestId("together-useful-next-views")).toHaveTextContent("There are views to recap gently.");

    fireEvent.click(screen.getByTestId("together-useful-next-activity-action"));
    expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
      'VYVA, "Tea and film chat" looks ready. Room signals: Interest: 1 joining | 1 maybe; Comfort: Quiet pace; Activity helpers: Help choose. Can you prepare the next simple and safe step?',
    );

    fireEvent.click(screen.getByTestId("together-cancel-proposal"));
    fireEvent.click(screen.getByTestId("together-useful-next-vote-action"));
    expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
      'VYVA, please turn "Could cost be clear first?" into one simple room vote with safe choices and no names.',
    );

    fireEvent.click(screen.getByTestId("together-cancel-proposal"));
    fireEvent.click(screen.getByTestId("together-useful-next-views-action"));
    expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
      "VYVA, please recap this shared view in simple, kind words without showing names.",
    );
  });

  it("lets the room vote for sharing views as a gentle issue lane", async () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-vote-views"));

    expect(screen.getByText("Your vote is saved")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveAttribute("aria-atomic", "true");
    expect(screen.getByTestId("together-status-message")).toHaveTextContent("Room update");
    expect(screen.getByTestId("together-status-message")).toHaveTextContent("Your vote is saved");
    expect(screen.getByTestId("together-vote-views")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-vote-views")).toHaveTextContent("100%");
    expect(screen.getByTestId("together-vote-views")).toHaveTextContent("Your choice");
    expect(screen.getByTestId("together-vote-impact")).toHaveTextContent(
      "The room is choosing to share views. VYVA helps replies stay kind.",
    );
    expect(screen.getByTestId("together-vote-impact-choice")).toHaveTextContent(
      "Your vote: Share views. You can change or remove it while voting stays open.",
    );
    expect(screen.getByTestId("together-room-summary-next")).toHaveTextContent("Share one kind view, with no pressure.");
    expect(screen.getByTestId("together-decision-guide")).toHaveTextContent("Share one kind view, with no pressure.");
    expect(screen.getByTestId("together-decision-guide-steps")).toHaveTextContent(
      "Contact stays inside VYVA until both people agree.",
    );
    expect(screen.getByTestId("together-use-room-direction")).toHaveTextContent("Share a view");

    fireEvent.click(screen.getByTestId("together-use-room-direction"));

    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "I would like to hear gentle views about what matters to us today.",
    );
    expect(screen.getByTestId("together-view-starters")).toHaveTextContent("Kind view starters");
    expect(screen.getByTestId("together-view-starters")).toHaveTextContent(
      "Choose one phrase if words feel hard today.",
    );
    expect(screen.getByTestId("together-view-tone-preview")).toHaveTextContent("Safe view preview");
    expect(screen.getByTestId("together-view-tone-preview")).toHaveTextContent("Ready to share gently");
    expect(screen.getByTestId("together-view-tone-kind")).toHaveTextContent("Kind words");
    expect(screen.getByTestId("together-view-tone-privacy")).toHaveTextContent("No private contact");
    expect(screen.getByTestId("together-view-tone-small")).toHaveTextContent("One small view");
    expect(screen.getByTestId("together-view-prompt-different")).toHaveAccessibleName(
      "Another view: I see it another way because...",
    );
    expect(screen.getByTestId("together-view-prompt-more_info")).toHaveAccessibleName(
      "Need more info: I need a little more information before choosing.",
    );
    fireEvent.click(screen.getByTestId("together-view-prompt-more_info"));
    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "I need a little more information before choosing.",
    );
    expect(screen.getByTestId("together-view-prompt-more_info")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByTestId("together-view-prompt-different"));
    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "I see it another way because...",
    );
    expect(screen.getByTestId("together-view-prompt-different")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("together-proposal-category-other")).not.toBeInTheDocument();
    expect(screen.queryByTestId("together-proposal-location-online")).not.toBeInTheDocument();
    expect(screen.queryByTestId("together-comfort-quiet_pace")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/polls/daily-room-choice/vote",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"optionId":"views"'),
        }),
      );
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/proposals",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"kind":"message"'),
        }),
      );
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/proposals",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"comfortNeeds":[]'),
        }),
      );
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/proposals",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("I see it another way because"),
        }),
      );
    });
  });

  it("shows a calm view circle, asks for a recap, reviews a visible view, and opens a safe view draft", async () => {
    const responseWithViews: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        activePoll: {
          ...roomResponse.pulse!.activePoll,
          options: roomResponse.pulse!.activePoll.options.map((option) => (
            option.id === "views" ? { ...option, votes: 2 } : option
          )),
          totalVotes: 2,
          myVote: "views",
        },
        postedExperiences: [
          {
            id: "view-1",
            key: "view-1",
            kind: "message",
            title: "I would like a calm start",
            body: "It helps me when we choose one small topic first.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "member-1",
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 1, maybe: 0 },
            myResponse: null,
          },
          {
            id: "view-2",
            key: "view-2",
            kind: "message",
            title: "I need more information",
            body: "I would like to understand the choices before voting again.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "member-2",
            createdAt: "2026-06-04T10:05:00.000Z",
            responseCounts: { join: 0, maybe: 1 },
            myResponse: null,
          },
        ],
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithViews} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-view-circle")).toHaveTextContent("View circle");
    expect(screen.getByTestId("together-view-circle-votes")).toHaveTextContent("Share views: 2 votes");
    expect(screen.getByTestId("together-view-circle-count")).toHaveTextContent("2 shared views");
    expect(screen.getByTestId("together-view-circle-item-view-1")).toHaveTextContent("I would like a calm start");
    expect(screen.getByTestId("together-view-circle-item-view-2")).toHaveTextContent("I need more information");
    expect(screen.getByTestId("together-view-circle-starters")).toHaveTextContent("Kind view starters");
    expect(screen.getByTestId("together-view-circle-starter-more_info")).toHaveAccessibleName(
      "Need more info: I need a little more information before choosing.",
    );
    expect(screen.getByTestId("together-view-recap-bridge")).toHaveTextContent("VYVA can recap the views");
    expect(screen.getByTestId("together-view-recap-bridge")).toHaveTextContent(
      "There are 2 shared views. VYVA can group the main points without showing names.",
    );
    expect(screen.getByTestId("together-view-vote-bridge")).toHaveTextContent("Turn views into a vote");
    expect(screen.getByTestId("together-view-vote-bridge")).toHaveTextContent(
      "If these 2 views show different choices, VYVA can turn them into one simple private vote.",
    );
    expect(screen.getByTestId("together-view-vote-action")).toHaveAccessibleName("Prepare private vote");
    expect(screen.getByTestId("together-view-common-ground")).toHaveTextContent("Common ground");
    expect(screen.getByTestId("together-view-common-ground")).toHaveTextContent(
      "The conversation is starting. One kind reply can help the room find what is shared.",
    );
    expect(screen.getByTestId("together-view-common-ground")).toHaveTextContent(
      "Replies are summarized by tone, not by name.",
    );
    expect(screen.getByTestId("together-view-safety")).toHaveTextContent("Safe disagreement");
    expect(screen.getByTestId("together-view-safety")).toHaveTextContent(
      "Different views are welcome when they stay short, kind, and without private details.",
    );
    expect(screen.getByTestId("together-view-safety-kind")).toHaveTextContent(
      "Name the idea, not the person.",
    );
    expect(screen.getByTestId("together-view-safety-private")).toHaveTextContent(
      "Leave phone, address, money and contact details out.",
    );
    expect(screen.getByTestId("together-view-safety-review")).toHaveTextContent(
      "Ask VYVA to review anything that feels uncomfortable.",
    );
    expect(screen.getByTestId("together-view-next-reply")).toHaveTextContent("Next kind reply");
    expect(screen.getByTestId("together-view-next-reply")).toHaveTextContent(
      "A small question or agreement can help people feel heard.",
    );
    expect(screen.getByTestId("together-view-next-reply-action")).toHaveAccessibleName(
      "Invite a kind reply: I would like to hear what feels most important to others.",
    );

    fireEvent.click(screen.getByTestId("together-view-next-reply-action"));

    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "I would like to hear what feels most important to others.",
    );
    expect(screen.getByTestId("together-view-tone-preview")).toHaveTextContent("Ready to share gently");

    fireEvent.click(screen.getByTestId("together-view-safety-action"));

    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "I see it another way. Can we compare calmly, without names?",
    );
    expect(screen.getByTestId("together-proposal-draft")).toHaveAttribute("rows", "3");
    expect(screen.getByTestId("together-view-tone-preview")).toHaveTextContent("Ready to share gently");

    fireEvent.click(screen.getByTestId("together-view-recap-action"));

    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "VYVA, please recap these 2 shared views in simple, kind words without showing names.",
    );
    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Easy questions for VYVA");

    fireEvent.click(screen.getByTestId("together-view-vote-action"));

    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "VYVA, please turn these 2 shared views into one simple private vote with safe choices and no names.",
    );
    expect(screen.getByTestId("together-proposal-draft")).toHaveAttribute("rows", "6");
    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Easy questions for VYVA");

    fireEvent.click(screen.getByTestId("together-view-circle-starter-more_info"));

    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "I need a little more information before choosing.",
    );
    expect(screen.getByTestId("together-view-tone-preview")).toHaveTextContent("Ready to share gently");
    expect(screen.getByTestId("together-view-prompt-more_info")).toHaveAttribute("aria-pressed", "true");

    apiFetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, pulse: responseWithViews.pulse }));
    fireEvent.click(screen.getByTestId("together-view-circle-review-view-1"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/safety-reports",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"targetId":"view-1"'),
        }),
      );
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/safety-reports",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"targetType":"message"'),
        }),
      );
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/safety-reports",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("View: I would like a calm start"),
        }),
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("together-view-circle-review-view-1")).toHaveTextContent("Sent to VYVA");
    });

    fireEvent.click(screen.getByTestId("together-view-circle-add"));

    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "I would like to hear gentle views about what matters to us today.",
    );
    expect(screen.getByTestId("together-view-starters")).toHaveTextContent("Kind view starters");
    expect(screen.queryByTestId("together-proposal-location-online")).not.toBeInTheDocument();
    expect(screen.queryByTestId("together-comfort-quiet_pace")).not.toBeInTheDocument();
  });

  it("lets seniors reply gently inside the view circle", async () => {
    const sharedView: SocialRoomPlan = {
      id: "view-1",
      key: "view-1",
      kind: "message",
      title: "I would like a calm start",
      body: "It helps me when we choose one small topic first.",
      locationLabel: "online",
      startsAt: null,
      status: "active",
      source: "user",
      createdBy: "member-1",
      createdAt: "2026-06-04T10:00:00.000Z",
      responseCounts: { join: 1, maybe: 0 },
      myResponse: null,
      replies: [],
    };
    const responseWithView: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        postedExperiences: [sharedView],
      },
    };
    const responseAfterReply: SocialRoomResponse["pulse"] = {
      ...responseWithView.pulse!,
      postedExperiences: [
        {
          ...sharedView,
          replies: [
            {
              id: "reply-view-different",
              planKey: "view-1",
              authorName: "Member",
              body: "I see it a little differently, and I appreciate you sharing it.",
              tone: "different",
              status: "active",
              createdAt: "2026-06-04T10:10:00.000Z",
            },
          ],
        },
      ],
    };
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, pulse: responseAfterReply }));

    render(<TogetherRoomScreen roomResponse={responseWithView} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-view-circle-replies-view-1")).toHaveTextContent("Gentle replies");
    expect(screen.getByTestId("together-view-circle-reply-different-view-1")).toHaveAccessibleName(
      "Another view: I see it a little differently, and I appreciate you sharing it.",
    );

    fireEvent.click(screen.getByTestId("together-view-circle-reply-different-view-1"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/plans/view-1/replies",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"tone":"different"'),
        }),
      );
    });
    const replyCall = apiFetchMock.mock.calls.find(([url]) => String(url).includes("/plans/view-1/replies"));
    expect(replyCall).toBeTruthy();
    const body = JSON.parse(String(replyCall?.[1]?.body));
    expect(body.body).toBe("I see it a little differently, and I appreciate you sharing it.");

    await waitFor(() => {
      expect(screen.getByTestId("together-view-balance-different")).toHaveTextContent("1");
    });
    expect(screen.getByTestId("together-view-common-ground")).toHaveTextContent(
      "Different views are present and staying kind. VYVA can recap them without names.",
    );
  });

  it("refreshes the room pulse from the calm header action", async () => {
    let resolveRefresh: (value: Response) => void = () => undefined;
    const refreshedPulse = {
      ...roomResponse.pulse!,
      activePoll: {
        ...roomResponse.pulse!.activePoll,
        options: roomResponse.pulse!.activePoll.options.map((option) => (
          option.id === "views" ? { ...option, votes: 1 } : option
        )),
        totalVotes: 1,
      },
      notifications: [
        {
          id: "update-refresh-1",
          type: "reply_added",
          title: "Someone replied gently",
          body: "\"Quiet lunch\": I can help with one small step.",
          createdAt: "2026-06-04T10:12:00.000Z",
          readAt: null,
        },
      ],
    };
    apiFetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    const refreshButton = screen.getByTestId("together-refresh-room");
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(refreshButton).toHaveTextContent("Checking...");
      expect(refreshButton).toBeDisabled();
    });
    fireEvent.click(refreshButton);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith("/api/social/rooms/together-room/pulse?lang=en");

    resolveRefresh(jsonResponse({ pulse: refreshedPulse }));

    await waitFor(() => {
      expect(refreshButton).toHaveTextContent("Check room");
      expect(refreshButton).not.toBeDisabled();
    });
    expect(screen.getByRole("status")).toHaveTextContent("1 new room update is ready");
    expect(screen.getByTestId("together-vote-views")).toHaveTextContent("1 vote");
    expect(screen.getByTestId("together-room-updates")).toHaveTextContent("Someone replied gently");
  });

  it("syncs a restored quiet pause from the refreshed room pulse", async () => {
    const responseWithQuietPause: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        safety: {
          ...roomResponse.pulse!.safety,
          myQuietPausedAt: "2026-06-04T10:20:00.000Z",
        },
      },
    };
    const refreshedPulse = {
      ...responseWithQuietPause.pulse!,
      safety: {
        ...responseWithQuietPause.pulse!.safety,
        myQuietPausedAt: null,
      },
    };
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ pulse: refreshedPulse }));

    render(<TogetherRoomScreen roomResponse={responseWithQuietPause} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-quiet-pause")).toHaveTextContent("Quiet pause on");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByTestId("together-refresh-room"));

    await waitFor(() => {
      expect(screen.getByTestId("together-quiet-pause")).toHaveTextContent("Pause quietly");
    });
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByTestId("together-quiet-pause-note")).not.toBeInTheDocument();
  });

  it("names new room votes when checking the room finds no new update cards", async () => {
    const refreshedPulse = {
      ...roomResponse.pulse!,
      activePoll: {
        ...roomResponse.pulse!.activePoll,
        options: roomResponse.pulse!.activePoll.options.map((option) => (
          option.id === "lunch" ? { ...option, votes: 2 } : option
        )),
        totalVotes: 2,
      },
      notifications: [],
    };
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ pulse: refreshedPulse }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-refresh-room"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/social/rooms/together-room/pulse?lang=en");
    });
    expect(screen.getByRole("status")).toHaveTextContent("2 new votes are in the room");
    expect(screen.getByTestId("together-vote-lunch")).toHaveTextContent("2 votes");
    expect(screen.queryByTestId("together-room-updates")).not.toBeInTheDocument();
  });

  it("shows calm room updates and lets a member mark them seen", async () => {
    const responseWithUpdates: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        notifications: [
          {
            id: "update-1",
            type: "plan_joined",
            title: "Someone joined your idea",
            body: "\"Tea at a quiet cafe\" has new company.",
            createdAt: "2026-06-04T10:00:00.000Z",
            readAt: null,
          },
        ],
      },
    };
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      pulse: {
        ...responseWithUpdates.pulse!,
        notifications: [
          {
            ...responseWithUpdates.pulse!.notifications[0],
            readAt: "2026-06-04T10:05:00.000Z",
          },
        ],
      },
    }));

    render(<TogetherRoomScreen roomResponse={responseWithUpdates} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-room-updates")).toHaveTextContent("Room updates");
    expect(screen.getByTestId("together-room-updates")).toHaveTextContent("Someone joined your idea");
    expect(screen.getByTestId("together-room-updates")).toHaveTextContent("Tea at a quiet cafe");
    expect(screen.getByTestId("together-room-updates-recap")).toHaveTextContent("Simple update recap");
    expect(screen.getByTestId("together-room-updates-recap")).toHaveTextContent(
      "VYVA can summarize this update and name the safest next step without names.",
    );

    fireEvent.click(screen.getByTestId("together-update-seen-update-1"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/notifications/update-1/read",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"visitId":"visit-1"'),
        }),
      );
    });
    expect(screen.getByText("Update marked as seen")).toBeInTheDocument();
    expect(screen.queryByTestId("together-room-updates")).not.toBeInTheDocument();
  });

  it("lets a returning member ask VYVA to summarize room updates", () => {
    const responseWithUpdates: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        notifications: [
          {
            id: "update-1",
            type: "plan_joined",
            title: "Someone joined your idea",
            body: "\"Tea at a quiet cafe\" has new company.",
            createdAt: "2026-06-04T10:00:00.000Z",
            readAt: null,
          },
          {
            id: "update-2",
            type: "reply_added",
            title: "Someone replied gently",
            body: "\"Quiet walk\": I can help with one small step.",
            createdAt: "2026-06-04T10:02:00.000Z",
            readAt: null,
          },
        ],
        unreadNotificationCount: 5,
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithUpdates} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-room-updates-recap")).toHaveTextContent(
      "VYVA can summarize these 5 updates and name the safest next step without names.",
    );

    fireEvent.click(screen.getByTestId("together-room-updates-recap-action"));

    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Easy questions for VYVA");
    expect(screen.getByTestId("together-composer-preview")).toHaveTextContent(
      "This question will be shared so VYVA can help or turn it into a vote.",
    );
    expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
      "VYVA, please summarize these 5 room updates in simple words and tell me the safest next step, without names.",
    );
  });

  it("lets a member mark all room updates seen at once", async () => {
    const responseWithUpdates: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        notifications: [
          {
            id: "update-1",
            type: "plan_joined",
            title: "Someone joined your idea",
            body: "\"Tea at a quiet cafe\" has new company.",
            createdAt: "2026-06-04T10:00:00.000Z",
            readAt: null,
          },
          {
            id: "update-2",
            type: "reply_added",
            title: "Someone replied gently",
            body: "\"Quiet walk\": I can help with one small step.",
            createdAt: "2026-06-04T10:02:00.000Z",
            readAt: null,
          },
        ],
        unreadNotificationCount: 5,
      },
    };
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      pulse: {
        ...responseWithUpdates.pulse!,
        notifications: responseWithUpdates.pulse!.notifications.map((notification) => ({
          ...notification,
          readAt: "2026-06-04T10:05:00.000Z",
        })),
        unreadNotificationCount: 0,
      },
    }));

    render(<TogetherRoomScreen roomResponse={responseWithUpdates} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-room-updates")).toHaveTextContent("Someone joined your idea");
    expect(screen.getByTestId("together-room-updates")).toHaveTextContent("Someone replied gently");
    expect(screen.getByTestId("together-at-glance-updates")).toHaveTextContent("5 updates");
    expect(screen.getByTestId("together-room-updates-showing")).toHaveTextContent("Showing latest 2 of 5 updates");
    expect(screen.getByTestId("together-room-updates-recap-action")).toHaveTextContent("Ask for recap");

    fireEvent.click(screen.getByTestId("together-updates-seen-all"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/notifications/read-all",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"visitId":"visit-1"'),
        }),
      );
    });
    expect(screen.getByText("All updates marked as seen")).toBeInTheDocument();
    expect(screen.queryByTestId("together-room-updates")).not.toBeInTheDocument();
  });

  it("shows gentle participation momentum on plans and shared ideas", () => {
    const responseWithMomentum: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        featuredPlan: {
          ...roomResponse.pulse!.featuredPlan,
          responseCounts: { join: 2, maybe: 1 },
        },
        postedExperiences: [
          {
            id: "experience-1",
            key: "experience-1",
            kind: "plan",
            title: "Tea at a quiet cafe",
            body: "Friday afternoon, nearby if possible.",
            locationLabel: "nearby",
            comfortNeeds: ["quiet_pace", "easy_access", "transport_help", "arrival_buddy", "clear_cost"],
            experienceCategory: "restaurant_date",
            preferredTime: "afternoon",
            costRange: "shared",
            groupSize: "one_to_one",
            safetyFlags: ["money"],
            needsReview: true,
            fitReasons: ["Nearby", "Afternoon", "Shared cost", "1:1"],
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 1, maybe: 2 },
            myResponse: null,
            replies: [
              {
                id: "reply-1",
                planKey: "experience-1",
                authorName: "Member",
                body: "I feel the same. Thank you for sharing it.",
                tone: "support",
                status: "active",
                createdAt: "2026-06-04T10:05:00.000Z",
              },
            ],
          },
        ],
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithMomentum} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-featured-response-summary")).toHaveTextContent("2 joining | 1 maybe");
    expect(screen.getByTestId("together-plan-next-step")).toHaveTextContent(
      "VYVA can help confirm details before anyone shares contact.",
    );
    expect(screen.getByTestId("together-plan-location-experience-1")).toHaveTextContent("Nearby");
    expect(screen.getByTestId("together-plan-comfort-experience-1")).toHaveTextContent("Quiet pace");
    expect(screen.getByTestId("together-plan-comfort-experience-1")).toHaveTextContent("Easy access");
    expect(screen.getByTestId("together-plan-comfort-experience-1")).toHaveTextContent("1 more comfort note");
    expect(screen.getByTestId("together-plan-fit-experience-1")).toHaveTextContent("Restaurant date");
    expect(screen.getByTestId("together-plan-fit-experience-1")).toHaveTextContent("Shared");
    expect(screen.getByTestId("together-plan-review-experience-1")).toHaveTextContent("VYVA reviews before the next step");
    expect(screen.getByTestId("together-plan-review-experience-1")).toHaveTextContent("money");
    expect(screen.getByTestId("together-shared-response-summary-experience-1")).toHaveTextContent("1 joining | 2 maybe");
    expect(screen.getByTestId("together-gentle-replies-experience-1")).toHaveTextContent("Gentle replies");
    expect(screen.getByTestId("together-reply-reply-1")).toHaveTextContent("I feel the same");
  });

  it("supports join, maybe, vote, starter, and safety actions", async () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-join-plan"));
    expect(screen.getAllByText("You joined").length).toBeGreaterThan(0);
    expect(screen.getByTestId("together-plan-choice-note")).toHaveTextContent(
      "Not for me is private and helps VYVA avoid pressure.",
    );
    expect(screen.getByTestId("together-plan-next-step")).toHaveTextContent(
      "You showed interest. VYVA helps confirm details before contact is shared.",
    );
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/plans/tea-film-chat/respond",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"response":"join"'),
        }),
      );
    });

    fireEvent.click(screen.getByTestId("together-maybe-plan"));
    expect(screen.getAllByText("Saved for later").length).toBeGreaterThan(0);
    expect(screen.getByTestId("together-plan-next-step")).toHaveTextContent(
      "Saved for later. You can come back when the details feel clear.",
    );

    fireEvent.click(screen.getByTestId("together-vote-film"));
    expect(screen.getByText("Your vote is saved")).toBeInTheDocument();
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/polls/daily-room-choice/vote",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"optionId":"film"'),
        }),
      );
    });

    fireEvent.click(screen.getByTestId("together-starter-plan"));
    expect(screen.getByText("What kind of experience?")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue("I would like to share a gentle plan.");

    fireEvent.click(screen.getByTestId("together-safety-help"));
    expect(screen.getByTestId("together-safety-help")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("together-safety-help-panel")).toHaveTextContent("What should VYVA check?");
    expect(screen.getByTestId("together-safety-help-panel")).toHaveTextContent(
      "The room will not see this help request.",
    );
    expect(screen.getByTestId("together-safety-choice-pressure_contact")).toHaveAccessibleName(
      "Pressure or contact: Someone is asking for private contact or pushing.",
    );
    fireEvent.click(screen.getByTestId("together-safety-choice-pressure_contact"));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/safety-reports",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"reason":"pressure_or_contact"'),
        }),
      );
    });
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/social/rooms/together-room/safety-reports",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("possible pressure or private contact"),
      }),
    );
    await waitFor(() => {
      expect(screen.getByTestId("together-safety-help-receipt")).toHaveTextContent("Help request sent");
    });
    expect(screen.getByTestId("together-safety-help-receipt")).toHaveTextContent(
      "VYVA will review: Pressure or contact. The room will not see this request.",
    );
    expect(screen.getByTestId("together-safety-help-receipt")).toHaveTextContent(
      "You can pause the room and come back later.",
    );
  });

  it("lets members answer a secondary plan with one tap", async () => {
    apiFetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/plans/quiet-lunch/respond")) {
        const response = String(init?.body ?? "").includes('"response":"maybe"') ? "maybe" : "join";
        const responseCounts =
          response === "maybe" ? { join: 0, maybe: 1 } : { join: 1, maybe: 0 };
        const pulse = {
          ...roomResponse.pulse,
          secondaryPlans: roomResponse.pulse!.secondaryPlans.map((plan) =>
            plan.key === "quiet-lunch" ? { ...plan, myResponse: response, responseCounts } : plan,
          ),
        };
        return Promise.resolve(jsonResponse({ ok: true, pulse }));
      }

      return Promise.resolve(jsonResponse({ ok: true, pulse: roomResponse.pulse }));
    });

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    const joinButton = screen.getByTestId("together-secondary-join-quiet-lunch");
    fireEvent.click(joinButton);
    expect(screen.getByText("Your response is saved")).toBeInTheDocument();

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/plans/quiet-lunch/respond",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"response":"join"'),
        }),
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("together-secondary-response-summary-quiet-lunch")).toHaveTextContent("1 joining");
      expect(joinButton).toHaveAttribute("aria-pressed", "true");
    });

    const maybeButton = screen.getByTestId("together-secondary-maybe-quiet-lunch");
    fireEvent.click(maybeButton);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/plans/quiet-lunch/respond",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"response":"maybe"'),
        }),
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("together-secondary-response-summary-quiet-lunch")).toHaveTextContent("1 maybe");
      expect(maybeButton).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("opens private safety help from the guide header", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, pulse: roomResponse.pulse }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    const quickHelp = screen.getByTestId("together-safety-quick-help");
    const footerHelp = screen.getByTestId("together-safety-help");

    fireEvent.click(quickHelp);

    expect(quickHelp).toHaveAttribute("aria-expanded", "true");
    expect(footerHelp).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => {
      expect(screen.getByTestId("together-safety-help-panel")).toHaveFocus();
    });
    expect(screen.getByTestId("together-safety-help-panel")).toHaveTextContent("What should VYVA check?");
    expect(screen.getByTestId("together-safety-help-panel")).toHaveTextContent(
      "The room will not see this help request.",
    );
    expect(screen.getByTestId("together-safety-urgent-note")).toHaveTextContent(
      "If something urgent is happening now, use local emergency help. VYVA is not a substitute for immediate help.",
    );
    expect(screen.getByTestId("together-safety-choice-uncomfortable")).toHaveAccessibleName(
      "I feel uneasy: Something in the room does not feel right.",
    );

    fireEvent.click(screen.getByTestId("together-safety-choice-uncomfortable"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/safety-reports",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"reason":"feels_uncomfortable"'),
        }),
      );
    });
    const body = JSON.parse(String(apiFetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      lang: "en",
      visitId: "visit-1",
      reason: "feels_uncomfortable",
      details: "The user says something in the Together Room feels uncomfortable.",
    });
    await waitFor(() => {
      expect(screen.queryByTestId("together-safety-help-panel")).not.toBeInTheDocument();
    });
    expect(quickHelp).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => {
      expect(screen.getByTestId("together-safety-help-receipt")).toHaveFocus();
    });
    expect(screen.getByTestId("together-safety-help-receipt")).toHaveTextContent("Help request sent");
    expect(screen.getByTestId("together-safety-help-receipt")).toHaveTextContent(
      "VYVA will review: I feel uneasy. The room will not see this request.",
    );
    expect(screen.getByTestId("together-safety-help-receipt")).toHaveTextContent(
      "VYVA reviews it without showing your name.",
    );
    expect(screen.getByTestId("together-safety-help-receipt")).toHaveTextContent(
      "If something urgent is happening now, use local emergency help.",
    );
  });

  it("prevents repeated safety requests while VYVA is being contacted", async () => {
    let resolveSafetyReport: (value: Response) => void = () => undefined;
    apiFetchMock.mockImplementation((url: string) => {
      if (url.includes("/safety-reports")) {
        return new Promise<Response>((resolve) => {
          resolveSafetyReport = resolve;
        });
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    const button = screen.getByTestId("together-safety-help");
    fireEvent.click(button);
    const choice = screen.getByTestId("together-safety-choice-money_service");
    fireEvent.click(choice);

    await waitFor(() => {
      expect(button).toHaveTextContent("Contacting VYVA...");
    });
    expect(button).toBeDisabled();
    expect(choice).toBeDisabled();

    fireEvent.click(choice);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/social/rooms/together-room/safety-reports",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"reason":"money_or_service"'),
      }),
    );

    resolveSafetyReport(jsonResponse({ ok: true, pulse: roomResponse.pulse }));

    await waitFor(() => {
      expect(button).toHaveTextContent("Help or safety");
    });
    expect(button).not.toBeDisabled();
    expect(screen.queryByTestId("together-safety-help-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("together-safety-help-receipt")).toHaveTextContent("Help request sent");
  });

  it("prevents repeated plan choices and poll votes while saving", async () => {
    let resolvePlanChoice: (value: Response) => void = () => undefined;
    let resolveVote: (value: Response) => void = () => undefined;
    apiFetchMock.mockImplementation((url: string) => {
      if (url.includes("/plans/tea-film-chat/respond")) {
        return new Promise<Response>((resolve) => {
          resolvePlanChoice = resolve;
        });
      }
      if (url.includes("/polls/daily-room-choice/vote")) {
        return new Promise<Response>((resolve) => {
          resolveVote = resolve;
        });
      }
      return Promise.resolve(jsonResponse({ ok: true, pulse: roomResponse.pulse }));
    });

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    const joinButton = screen.getByTestId("together-join-plan");
    fireEvent.click(joinButton);

    await waitFor(() => {
      expect(joinButton).toBeDisabled();
    });
    fireEvent.click(joinButton);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/social/rooms/together-room/plans/tea-film-chat/respond",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"response":"join"'),
      }),
    );

    resolvePlanChoice(jsonResponse({ ok: true, pulse: roomResponse.pulse }));

    await waitFor(() => {
      expect(joinButton).not.toBeDisabled();
    });

    const filmVote = screen.getByTestId("together-vote-film");
    const lunchVote = screen.getByTestId("together-vote-lunch");
    fireEvent.click(filmVote);

    await waitFor(() => {
      expect(filmVote).toBeDisabled();
      expect(lunchVote).toBeDisabled();
    });
    fireEvent.click(lunchVote);
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/social/rooms/together-room/polls/daily-room-choice/vote",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"optionId":"film"'),
      }),
    );

    resolveVote(jsonResponse({ ok: true, pulse: roomResponse.pulse }));

    await waitFor(() => {
      expect(filmVote).not.toBeDisabled();
      expect(lunchVote).not.toBeDisabled();
    });
  });

  it("lets members add concrete help to the featured plan", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      pulse: {
        ...roomResponse.pulse!,
        featuredPlan: {
          ...roomResponse.pulse!.featuredPlan,
          myHelperActions: ["choose"],
          replies: [
            {
              id: "reply-plan-1",
              planKey: "tea-film-chat",
              authorName: "Member",
              body: "I can help choose one simple option for the group.",
              tone: "help",
              status: "active",
              createdAt: "2026-06-04T10:06:00.000Z",
            },
          ],
        },
      },
    }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-plan-collaboration")).toHaveTextContent("Make this easy");
    expect(screen.getByTestId("together-plan-readiness")).toHaveTextContent("Ready for the next step");
    expect(screen.getByTestId("together-plan-readiness")).toHaveTextContent(
      "2 of 4 signals are ready. VYVA waits for what is missing without pressure.",
    );
    expect(screen.getByTestId("together-plan-readiness-interest")).toHaveTextContent(
      "Waiting for interest: Join or Maybe later.",
    );
    expect(screen.getByTestId("together-plan-readiness-helper")).toHaveTextContent(
      "One small helper would make this easier.",
    );
    expect(screen.getByTestId("together-plan-readiness-comfort")).toHaveTextContent("Comfort is already named.");
    expect(screen.getByTestId("together-plan-readiness-vyva")).toHaveTextContent(
      "VYVA confirms details before any contact.",
    );
    expect(screen.getByTestId("together-plan-collaboration-choose")).toHaveTextContent("Help choose");
    expect(screen.getByTestId("together-plan-collaboration-choose")).toHaveTextContent(
      "I can help choose one simple option for the group.",
    );
    expect(screen.getByTestId("together-plan-collaboration-choose")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("together-plan-collaboration-buddy")).toHaveTextContent("Meet together");
    expect(screen.getByTestId("together-plan-collaboration-buddy")).toHaveTextContent(
      "It would help to meet with someone before joining.",
    );
    expect(screen.getByLabelText("Help choose: I can help choose one simple option for the group.")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("together-plan-collaboration-choose"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/plans/tea-film-chat/replies",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"tone":"help"'),
        }),
      );
    });
    const body = JSON.parse(String(apiFetchMock.mock.calls[0][1]?.body));
    expect(body.body).toBe("I can help choose one simple option for the group.");
    expect(screen.getByTestId("together-featured-reply-reply-plan-1")).toHaveTextContent("simple option");
    expect(screen.getByTestId("together-my-safe-choice-help")).toHaveTextContent("Tea and film chat: Help choose");
    expect(screen.getByTestId("together-plan-collaboration-choose")).toHaveAttribute("aria-pressed", "true");
  });

  it("lets a member privately remove an activity helper without leaving quiet pause", async () => {
    const responseWithHelperAndQuietPause: SocialRoomResponse = {
      ...roomResponse,
      quietPausedAt: "2026-06-04T10:20:00.000Z",
      pulse: {
        ...roomResponse.pulse!,
        safety: {
          ...roomResponse.pulse!.safety,
          myQuietPausedAt: "2026-06-04T10:20:00.000Z",
        },
        featuredPlan: {
          ...roomResponse.pulse!.featuredPlan,
          myHelperActions: ["choose"],
          replies: [
            {
              id: "reply-plan-choose",
              planKey: "tea-film-chat",
              authorName: "Member",
              body: "I can help choose one simple option for the group.",
              tone: "help",
              status: "active",
              createdAt: "2026-06-04T10:06:00.000Z",
            },
          ],
        },
      },
    };
    const clearedPulse: SocialRoomPulse = {
      ...responseWithHelperAndQuietPause.pulse!,
      featuredPlan: {
        ...responseWithHelperAndQuietPause.pulse!.featuredPlan,
        myHelperActions: [],
        replies: [],
      },
    };
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, pulse: clearedPulse }));

    render(<TogetherRoomScreen roomResponse={responseWithHelperAndQuietPause} language="en" visitId="visit-1" onBack={vi.fn()} />);

    const chooseButton = screen.getByTestId("together-plan-collaboration-choose");
    expect(chooseButton).toHaveAttribute("aria-pressed", "true");
    expect(chooseButton).toHaveAccessibleName(
      "Remove Help choose: This removes only your helper signal.",
    );
    expect(screen.getByTestId("together-my-safe-choice-help")).toHaveTextContent("Tea and film chat: Help choose");
    expect(screen.getByTestId("together-plan-helper-choose")).toHaveAttribute("aria-label", "Help choose: 1");
    expect(screen.getByTestId("together-plan-readiness-helper")).toHaveTextContent("1 small helper is offered.");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByTestId("together-plan-collaboration-choose"));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/plans/tea-film-chat/helpers/choose/clear",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(screen.getByTestId("together-plan-collaboration-choose")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("together-my-safe-choice-help")).toHaveTextContent("No helper choice yet");
    expect(screen.getByTestId("together-status-message")).toHaveTextContent("Helper choice removed");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-quiet-pause-note")).toHaveTextContent(
      "without telling the room",
    );
    expect(apiFetchMock).not.toHaveBeenCalledWith(
      "/api/social/rooms/together-room/quiet-pause",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"paused":false'),
      }),
    );
  });

  it("guides seniors to one low-pressure activity helper", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      pulse: {
        ...roomResponse.pulse!,
        featuredPlan: {
          ...roomResponse.pulse!.featuredPlan,
          myHelperActions: ["choose"],
          replies: [
            {
              id: "reply-plan-cue",
              planKey: "tea-film-chat",
              authorName: "Member",
              body: "I can help choose one simple option for the group.",
              tone: "help",
              status: "active",
              createdAt: "2026-06-04T10:06:00.000Z",
            },
          ],
        },
      },
    }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-plan-helper-cue")).toHaveTextContent("Best small help");
    expect(screen.getByTestId("together-plan-helper-cue")).toHaveTextContent(
      "It gives VYVA a practical signal without committing anyone.",
    );
    expect(screen.getByTestId("together-plan-helper-cue-action")).toHaveAccessibleName(
      "Choose Help choose: I can help choose one simple option for the group.",
    );

    fireEvent.click(screen.getByTestId("together-plan-helper-cue-action"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/plans/tea-film-chat/replies",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"tone":"help"'),
        }),
      );
    });
    const body = JSON.parse(String(apiFetchMock.mock.calls[0][1]?.body));
    expect(body.body).toBe("I can help choose one simple option for the group.");
    expect(screen.getByTestId("together-featured-reply-reply-plan-cue")).toHaveTextContent("simple option");
    expect(screen.getByTestId("together-my-safe-choice-help")).toHaveTextContent("Tea and film chat: Help choose");
  });

  it("lets members ask for an arrival buddy on the featured plan", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      pulse: {
        ...roomResponse.pulse!,
        featuredPlan: {
          ...roomResponse.pulse!.featuredPlan,
          replies: [
            {
              id: "reply-plan-buddy",
              planKey: "tea-film-chat",
              authorName: "Member",
              body: "It would help to meet with someone before joining.",
              tone: "help",
              status: "active",
              createdAt: "2026-06-04T10:08:00.000Z",
            },
          ],
        },
      },
    }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByLabelText("Meet together: It would help to meet with someone before joining.")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("together-plan-collaboration-buddy"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/plans/tea-film-chat/replies",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"tone":"help"'),
        }),
      );
    });
    const body = JSON.parse(String(apiFetchMock.mock.calls[0][1]?.body));
    expect(body.body).toBe("It would help to meet with someone before joining.");
    expect(screen.getByTestId("together-featured-reply-reply-plan-buddy")).toHaveTextContent("before joining");
  });

  it("summarizes activity helpers on the featured plan", () => {
    const responseWithHelpers: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        featuredPlan: {
          ...roomResponse.pulse!.featuredPlan,
          responseCounts: { join: 2, maybe: 1 },
          replies: [
            {
              id: "reply-plan-choose",
              planKey: "tea-film-chat",
              authorName: "Member",
              body: "I can help choose one simple option for the group.",
              tone: "help",
              status: "active",
              createdAt: "2026-06-04T10:06:00.000Z",
            },
            {
              id: "reply-plan-pace",
              planKey: "tea-film-chat",
              authorName: "Member",
              body: "A quiet pace with room to pause would help me.",
              tone: "curious",
              status: "active",
              createdAt: "2026-06-04T10:07:00.000Z",
            },
            {
              id: "reply-plan-buddy",
              planKey: "tea-film-chat",
              authorName: "Member",
              body: "It would help to meet with someone before joining.",
              tone: "help",
              status: "active",
              createdAt: "2026-06-04T10:08:00.000Z",
            },
            {
              id: "reply-plan-hidden-notify",
              planKey: "tea-film-chat",
              authorName: "Member",
              body: "Please keep me posted when there is a next step.",
              tone: "support",
              status: "hidden",
              createdAt: "2026-06-04T10:09:00.000Z",
            },
            {
              id: "reply-plan-custom",
              planKey: "tea-film-chat",
              authorName: "Member",
              body: "I can bring a notebook.",
              tone: "help",
              status: "active",
              createdAt: "2026-06-04T10:10:00.000Z",
            },
          ],
        },
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithHelpers} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-plan-helper-summary")).toHaveTextContent("Activity helpers");
    expect(screen.getByTestId("together-plan-helper-summary")).toHaveTextContent(
      "These are the small ways people are helping the plan happen.",
    );
    expect(screen.getByTestId("together-plan-readiness")).toHaveTextContent(
      "4 of 4 signals are ready. VYVA waits for what is missing without pressure.",
    );
    expect(screen.getByTestId("together-plan-readiness-interest")).toHaveTextContent("3 people show interest.");
    expect(screen.getByTestId("together-plan-readiness-helper")).toHaveTextContent("3 small helpers are offered.");
    expect(screen.getByTestId("together-plan-readiness-comfort")).toHaveTextContent("Comfort is already named.");
    expect(screen.getByTestId("together-plan-readiness-vyva")).toHaveTextContent(
      "VYVA confirms details before any contact.",
    );
    expect(screen.getByTestId("together-plan-helper-choose")).toHaveAttribute("aria-label", "Help choose: 1");
    expect(screen.getByTestId("together-plan-helper-choose")).toHaveTextContent("Help choose");
    expect(screen.getByTestId("together-plan-helper-pace")).toHaveAttribute("aria-label", "Quiet pace: 1");
    expect(screen.getByTestId("together-plan-helper-buddy")).toHaveAttribute("aria-label", "Meet together: 1");
    expect(screen.getByTestId("together-plan-helper-notify")).toHaveAttribute("aria-label", "Keep me posted: 0");
    expect(screen.getByTestId("together-plan-helper-cue")).toHaveTextContent("Best small help");
    expect(screen.getByTestId("together-plan-helper-cue")).toHaveTextContent(
      "The most useful help now is Keep me posted.",
    );
    expect(screen.getByTestId("together-plan-helper-cue-action")).toHaveTextContent("Choose Keep me posted");
    expect(screen.getByTestId("together-featured-reply-reply-plan-custom")).toHaveTextContent("notebook");
    expect(screen.queryByTestId("together-featured-reply-reply-plan-hidden-notify")).not.toBeInTheDocument();
  });

  it("lets members add concrete help to a shared activity", async () => {
    const sharedPlan: SocialRoomPlan = {
      id: "experience-1",
      key: "experience-1",
      kind: "plan",
      title: "Tea at a quiet cafe",
      body: "Friday afternoon, nearby if possible.",
      locationLabel: "nearby",
      comfortNeeds: ["quiet_pace", "easy_access"],
      experienceCategory: "restaurant_date",
      preferredTime: "afternoon",
      costRange: "shared",
      groupSize: "small_group",
      safetyFlags: [],
      needsReview: false,
      fitReasons: ["Nearby", "Afternoon", "Shared cost", "Small group"],
      startsAt: null,
      status: "active",
      source: "user",
      createdBy: "demo-user",
      createdAt: "2026-06-04T10:00:00.000Z",
      responseCounts: { join: 1, maybe: 0 },
      myResponse: null,
      replies: [],
    };
    const responseWithSharedActivity: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        postedExperiences: [sharedPlan],
      },
    };
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      pulse: {
        ...responseWithSharedActivity.pulse!,
        postedExperiences: [
          {
            ...sharedPlan,
            replies: [
              {
                id: "reply-shared-helper",
                planKey: "experience-1",
                authorName: "Member",
                body: "I can help choose one simple option for the group.",
                tone: "help",
                status: "active",
                createdAt: "2026-06-04T10:10:00.000Z",
              },
            ],
          },
        ],
      },
    }));

    render(<TogetherRoomScreen roomResponse={responseWithSharedActivity} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-shared-plan-collaboration-experience-1")).toHaveTextContent("Make this easy");
    expect(screen.getByTestId("together-shared-plan-helper-summary-experience-1")).toHaveTextContent("No helpers yet");
    expect(screen.getByTestId("together-shared-plan-helper-cue-experience-1")).toHaveTextContent("Best small help");
    expect(screen.getByTestId("together-shared-plan-helper-cue-experience-1-action")).toHaveAccessibleName(
      "Choose Help choose: I can help choose one simple option for the group.",
    );
    expect(screen.getByTestId("together-shared-plan-readiness-experience-1")).toHaveTextContent(
      "3 of 4 signals are ready. VYVA waits for what is missing without pressure.",
    );
    expect(screen.getByTestId("together-shared-plan-readiness-experience-1-interest")).toHaveTextContent(
      "1 person shows interest.",
    );
    expect(screen.getByTestId("together-shared-plan-readiness-experience-1-helper")).toHaveTextContent(
      "One small helper would make this easier.",
    );
    expect(screen.queryByTestId("together-shared-plan-readiness-experience-1-action")).not.toBeInTheDocument();
    expect(screen.getByTestId("together-shared-plan-collaboration-choose-experience-1")).toHaveAccessibleName(
      "Help choose: I can help choose one simple option for the group.",
    );

    fireEvent.click(screen.getByTestId("together-shared-plan-collaboration-choose-experience-1"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/plans/experience-1/replies",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"tone":"help"'),
        }),
      );
    });
    const replyCall = apiFetchMock.mock.calls.find(([url]) => String(url).includes("/plans/experience-1/replies"));
    expect(replyCall).toBeTruthy();
    const body = JSON.parse(String(replyCall?.[1]?.body));
    expect(body.body).toBe("I can help choose one simple option for the group.");

    await waitFor(() => {
      expect(screen.getByTestId("together-reply-reply-shared-helper")).toHaveTextContent("simple option");
    });
    expect(screen.getByTestId("together-shared-plan-helper-summary-experience-1")).toHaveTextContent(
      "These are the small ways people are helping the plan happen.",
    );
    expect(screen.getByTestId("together-shared-plan-helper-experience-1-choose")).toHaveAttribute("aria-label", "Help choose: 1");
    expect(screen.getByTestId("together-shared-plan-readiness-experience-1")).toHaveTextContent(
      "4 of 4 signals are ready. VYVA waits for what is missing without pressure.",
    );
    expect(screen.getByTestId("together-shared-plan-readiness-experience-1-helper")).toHaveTextContent(
      "1 small helper is offered.",
    );
    expect(screen.getByTestId("together-shared-plan-collaboration-choose-experience-1")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("together-shared-plan-readiness-experience-1-action")).toHaveTextContent(
      "Ask VYVA for the next step",
    );

    fireEvent.click(screen.getByTestId("together-shared-plan-readiness-experience-1-action"));

    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Easy questions for VYVA");
    expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
      'VYVA, "Tea at a quiet cafe" looks ready. Room signals: Interest: 1 joining; Comfort: Quiet pace, Easy access; Activity helpers: Help choose. Can you prepare the next simple and safe step?',
    );
  });

  it("opens a safe VYVA next-step request when an activity is ready", () => {
    const responseWithReadyActivity: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        featuredPlan: {
          ...roomResponse.pulse!.featuredPlan,
          responseCounts: { join: 1, maybe: 1 },
          replies: [
            {
              id: "reply-plan-ready",
              planKey: "tea-film-chat",
              authorName: "Member",
              body: "I can help choose one simple option for the group.",
              tone: "help",
              status: "active",
              createdAt: "2026-06-04T10:11:00.000Z",
            },
          ],
        },
        notifications: [
          {
            id: "activity-ready-1",
            type: "activity_ready",
            title: "This activity is ready for VYVA",
            body: "\"Tea and film chat\" has interest, comfort notes, and a helper. VYVA can confirm details before anyone commits.",
            createdAt: "2026-06-04T10:12:00.000Z",
            readAt: null,
          },
        ],
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithReadyActivity} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-activity-ready")).toHaveTextContent("VYVA can prepare this");
    expect(screen.getByTestId("together-activity-ready")).toHaveTextContent("Private and no pressure");
    expect(screen.getByTestId("together-activity-ready")).toHaveTextContent("before anyone commits");
    expect(screen.getByTestId("together-activity-ready-signals")).toHaveTextContent("Signals without names");
    expect(screen.getByTestId("together-activity-ready-signals")).toHaveTextContent("Interest: 1 joining | 1 maybe");
    expect(screen.getByTestId("together-activity-ready-signals")).toHaveTextContent("Comfort: Quiet pace");
    expect(screen.getByTestId("together-activity-ready-signals")).toHaveTextContent("Activity helpers: Help choose");
    expect(screen.getByTestId("together-activity-ready-prep")).toHaveTextContent("Before VYVA prepares it");
    expect(screen.getByTestId("together-activity-ready-prep")).toHaveTextContent(
      "Confirm place, time, cost and access.",
    );
    expect(screen.getByTestId("together-activity-ready-prep")).toHaveTextContent(
      "Keep contact inside VYVA until both people agree.",
    );
    expect(screen.getByTestId("together-activity-ready-prep")).toHaveTextContent(
      "Bring back one simple next step, not a commitment.",
    );

    fireEvent.click(screen.getByTestId("together-activity-ready-action"));

    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Easy questions for VYVA");
    expect(screen.queryByTestId("together-proposal-location-nearby")).not.toBeInTheDocument();
    const draft = screen.getByTestId("together-proposal-draft") as HTMLTextAreaElement;
    expect(draft.value).toBe(
      "VYVA, \"Tea and film chat\" looks ready. Room signals: Interest: 1 joining | 1 maybe; Comfort: Quiet pace; Activity helpers: Help choose. Can you prepare the next simple and safe step?",
    );
  });

  it("uses activity-ready metadata to prepare the exact ready plan", () => {
    const responseWithReadySecondaryActivity: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        notifications: [
          {
            id: "activity-ready-secondary",
            type: "activity_ready",
            title: "This activity is ready for VYVA",
            body: "A supported activity is ready for VYVA to prepare safely.",
            metadata: { planKey: "quiet-lunch" },
            createdAt: "2026-06-04T10:12:00.000Z",
            readAt: null,
          },
        ],
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithReadySecondaryActivity} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-activity-ready")).toHaveTextContent("A supported activity is ready");
    expect(screen.getByTestId("together-activity-ready-signals")).toHaveTextContent(
      "Comfort: Easy access, Place to sit, Transport help, 2 more comfort notes",
    );
    expect(screen.getByTestId("together-activity-ready-prep")).toHaveTextContent("Before VYVA prepares it");
    expect(screen.getByTestId("together-activity-ready-prep")).toHaveTextContent("Confirm place, time, cost and access.");
    expect(screen.getByTestId("together-update-action-activity-ready-secondary")).toHaveTextContent(
      "Ask VYVA for the next step",
    );
    expect(screen.getByTestId("together-update-action-safety-activity-ready-secondary")).toHaveTextContent(
      "Private and no pressure",
    );

    fireEvent.click(screen.getByTestId("together-update-action-activity-ready-secondary"));

    expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
      'VYVA, "Quiet lunch nearby" looks ready. Room signals: Comfort: Easy access, Place to sit, Transport help, 2 more comfort notes. Can you prepare the next simple and safe step?',
    );
  });

  it("opens the suggest-plan starter before posting a proposal", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      pulse: {
        ...roomResponse.pulse!,
        postedExperiences: [
          {
            id: "experience-1",
            key: "experience-1",
            kind: "plan",
            title: "Tea at a quiet cafe",
            body: "Friday afternoon, nearby if possible.",
            locationLabel: "nearby",
            comfortNeeds: ["quiet_pace", "easy_access", "transport_help", "arrival_buddy", "clear_cost"],
            experienceCategory: "restaurant_date",
            preferredTime: "afternoon",
            costRange: "shared",
            groupSize: "small_group",
            safetyFlags: [],
            needsReview: false,
            fitReasons: ["Nearby", "Afternoon", "Shared cost", "Small group"],
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 0, maybe: 0 },
            myResponse: null,
          },
        ],
      },
    }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.queryByPlaceholderText("Write one small idea...")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("together-starter-plan"));
    expect(screen.getByText("What kind of experience?")).toBeInTheDocument();
    expect(screen.getByTestId("together-composer-preview")).toHaveTextContent("Before you send");
    expect(screen.getByTestId("together-composer-preview")).toHaveTextContent(
      "This idea will be shared as a plan so others can join or choose Maybe.",
    );
    expect(screen.getByTestId("together-composer-preview-plan-shared")).toHaveTextContent(
      "The room sees the plan, not your private choices.",
    );
    expect(screen.getByTestId("together-composer-preview-plan-private")).toHaveTextContent(
      "Votes, comfort choices and Maybe stay unnamed.",
    );
    expect(screen.getByTestId("together-composer-preview-plan-next")).toHaveTextContent(
      "VYVA reviews cost, contact, transport or service details before moving ahead.",
    );
    expect(screen.getByTestId("together-safe-share-cue")).toHaveTextContent("Share safely");
    expect(screen.getByTestId("together-safe-share-cue")).toHaveTextContent(
      "Keep phone, email, exact address and payment details out of this note.",
    );
    expect(screen.getByTestId("together-safe-share-cue")).toHaveTextContent(
      "If cost, transport, housing or service details matter, VYVA reviews before the next step.",
    );
    fireEvent.click(screen.getByTestId("together-proposal-category-restaurant_date"));
    expect(screen.getByText("What would fit best?")).toBeInTheDocument();
    expect(screen.getByTestId("together-proposal-location-nearby")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-proposal-location-online")).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByTestId("together-proposal-time-afternoon"));
    fireEvent.click(screen.getByTestId("together-proposal-cost-shared"));
    fireEvent.click(screen.getByTestId("together-proposal-group-small_group"));
    expect(screen.getByText("What would help?")).toBeInTheDocument();
    expect(screen.getByTestId("together-comfort-quiet_pace")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("together-comfort-easy_access"));
    fireEvent.click(screen.getByTestId("together-comfort-transport_help"));
    fireEvent.click(screen.getByTestId("together-comfort-arrival_buddy"));
    fireEvent.click(screen.getByTestId("together-comfort-clear_cost"));
    fireEvent.change(screen.getByPlaceholderText("Write one small idea..."), {
      target: { value: "Tea at a quiet cafe" },
    });
    fireEvent.click(screen.getByLabelText("Send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/proposals",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"title":"Tea at a quiet cafe"'),
        }),
      );
    });
    const body = String(apiFetchMock.mock.calls[0][1]?.body);
    expect(body).toContain('"kind":"plan"');
    expect(body).toContain('"locationLabel":"nearby"');
    expect(JSON.parse(body)).toMatchObject({
      comfortNeeds: ["quiet_pace", "easy_access", "transport_help", "arrival_buddy", "clear_cost"],
      experienceCategory: "restaurant_date",
      preferredTime: "afternoon",
      costRange: "shared",
      groupSize: "small_group",
    });
    expect(screen.getByText("Sent")).toBeInTheDocument();
    expect(screen.getByTestId("together-shared-today")).toBeInTheDocument();
    expect(screen.getByText("Tea at a quiet cafe")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("together-plan-comfort-experience-1")).toHaveTextContent("Easy access");
      expect(screen.getByTestId("together-plan-comfort-experience-1")).toHaveTextContent("Transport help");
      expect(screen.getByTestId("together-plan-comfort-experience-1")).toHaveTextContent("Meet together");
      expect(screen.getByTestId("together-plan-comfort-experience-1")).toHaveTextContent("1 more comfort note");
      expect(screen.getByTestId("together-plan-comfort-experience-1")).not.toHaveTextContent("Know cost first");
    });
    expect(screen.getByTestId("together-plan-fit-experience-1")).toHaveTextContent("Restaurant date");
  });

  it("keeps quiet pause and the draft in place when a proposal cannot be sent", async () => {
    const responseWithQuietPause: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        safety: {
          ...roomResponse.pulse!.safety,
          myQuietPausedAt: "2026-06-04T10:20:00.000Z",
        },
      },
    };
    apiFetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    }));

    render(<TogetherRoomScreen roomResponse={responseWithQuietPause} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-starter-plan"));
    fireEvent.change(screen.getByTestId("together-proposal-draft"), {
      target: { value: "Tea at a quiet cafe" },
    });
    fireEvent.click(screen.getByLabelText("Send"));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Could not post it. Please try again.");
    });

    expect(screen.getByTestId("together-quiet-pause")).toHaveTextContent("Quiet pause on");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-quiet-pause-note")).toHaveTextContent(
      "You can keep reading without telling the room.",
    );
    expect(screen.getByTestId("together-proposal-draft")).toHaveValue("Tea at a quiet cafe");
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock.mock.calls[0][0]).toBe("/api/social/rooms/together-room/proposals");
    expect(apiFetchMock.mock.calls.some(([url]) => String(url).includes("/quiet-pause"))).toBe(false);
  });

  it("keeps proposal notes inside the room limits before posting", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, pulse: roomResponse.pulse }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-starter-plan"));
    const draft = screen.getByTestId("together-proposal-draft") as HTMLTextAreaElement;
    const longDraft = Array.from({ length: 400 }, (_, index) => String.fromCharCode(65 + (index % 26))).join("");

    fireEvent.change(draft, { target: { value: longDraft } });

    expect(draft.value).toBe(longDraft.slice(0, 320));
    expect(screen.getByTestId("together-proposal-length")).toHaveTextContent("0 characters left");

    fireEvent.click(screen.getByLabelText("Send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/proposals",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(`"details":"${longDraft.slice(0, 320)}"`),
        }),
      );
    });
    const body = JSON.parse(String(apiFetchMock.mock.calls[0][1]?.body));
    expect(body.title).toBe(longDraft.slice(0, 96));
    expect(body.details).toBe(longDraft.slice(0, 320));
  });

  it("stops private contact or payment details before a note is shared", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, pulse: roomResponse.pulse }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-starter-plan"));
    const draft = screen.getByTestId("together-proposal-draft") as HTMLTextAreaElement;
    const sendButton = screen.getByLabelText("Send");

    fireEvent.change(draft, {
      target: { value: "Email me at maria@example.com and I can send my card number." },
    });

    expect(screen.getByTestId("together-proposal-safety-warning")).toHaveTextContent(
      "Please remove phone, email, address or payment details before sending.",
    );
    expect(sendButton).toBeDisabled();

    fireEvent.click(sendButton);
    expect(apiFetchMock).not.toHaveBeenCalled();

    fireEvent.change(draft, {
      target: { value: "Please call 555-0100 and use 4111 1111 1111 1111." },
    });

    expect(screen.getByTestId("together-proposal-safety-warning")).toHaveTextContent(
      "Please remove phone, email, address or payment details before sending.",
    );
    expect(sendButton).toBeDisabled();

    fireEvent.change(draft, {
      target: { value: "Tea at a quiet cafe, with VYVA helping later." },
    });

    expect(screen.queryByTestId("together-proposal-safety-warning")).not.toBeInTheDocument();
    expect(sendButton).not.toBeDisabled();

    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/proposals",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"title":"Tea at a quiet cafe, with VYVA helping later."'),
        }),
      );
    });
  });

  it("offers one tap kind wording for sharp plan drafts", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-starter-plan"));
    const draft = screen.getByTestId("together-proposal-draft") as HTMLTextAreaElement;
    const sendButton = screen.getByLabelText("Send");

    fireEvent.change(draft, {
      target: { value: "This plan is stupid and dumb." },
    });

    expect(screen.getByTestId("together-proposal-tone-warning")).toHaveTextContent(
      "Please use kind words before sending. VYVA can help rewrite it.",
    );
    expect(screen.getByTestId("together-proposal-soften-tone")).toHaveTextContent("Soften wording");
    expect(sendButton).toBeDisabled();

    fireEvent.click(screen.getByTestId("together-proposal-soften-tone"));

    expect(draft).toHaveValue("Could we make this gentle and easy for everyone?");
    expect(screen.queryByTestId("together-proposal-tone-warning")).not.toBeInTheDocument();
    expect(sendButton).not.toBeDisabled();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("nudges sharp view drafts back to kind wording before sharing", () => {
    const responseWithViews: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        activePoll: {
          ...roomResponse.pulse!.activePoll,
          options: [
            { id: "film", label: "Film chat", votes: 0 },
            { id: "lunch", label: "Quiet lunch", votes: 0 },
            { id: "views", label: "Share views", votes: 2 },
          ],
          totalVotes: 2,
          myVote: "views",
        },
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithViews} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-use-room-direction"));
    const draft = screen.getByTestId("together-proposal-draft") as HTMLTextAreaElement;
    const sendButton = screen.getByLabelText("Send");

    expect(screen.getByTestId("together-view-tone-preview")).toHaveTextContent("Ready to share gently");

    fireEvent.change(draft, {
      target: { value: "That idea is stupid and you are an idiot." },
    });

    expect(screen.getByTestId("together-view-tone-preview")).toHaveTextContent("Needs a small edit");
    expect(screen.getByTestId("together-view-tone-kind")).toHaveTextContent("Kind words");
    expect(screen.getByTestId("together-proposal-tone-warning")).toHaveTextContent(
      "Please use kind words before sending. VYVA can help rewrite it.",
    );
    expect(draft).toHaveAccessibleDescription(/Please use kind words before sending/);
    expect(sendButton).toBeDisabled();

    fireEvent.click(sendButton);
    expect(apiFetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("together-view-prompt-different"));

    expect(draft).toHaveValue("I see it another way because...");
    expect(screen.getByTestId("together-view-tone-preview")).toHaveTextContent("Ready to share gently");
    expect(screen.queryByTestId("together-proposal-tone-warning")).not.toBeInTheDocument();
    expect(sendButton).not.toBeDisabled();
  });

  it("explains what view and question drafts will share before sending", () => {
    const responseWithViews: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        activePoll: {
          ...roomResponse.pulse!.activePoll,
          options: [
            { id: "film", label: "Film chat", votes: 0 },
            { id: "lunch", label: "Quiet lunch", votes: 0 },
            { id: "views", label: "Share views", votes: 2 },
          ],
          totalVotes: 2,
          myVote: "views",
        },
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithViews} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-use-room-direction"));

    expect(screen.getByTestId("together-composer-preview")).toHaveTextContent("Before you send");
    expect(screen.getByTestId("together-composer-preview")).toHaveTextContent(
      "This note will be shared as a short view, with gentle replies nearby.",
    );
    expect(screen.getByTestId("together-composer-preview-message-shared")).toHaveTextContent(
      "The room sees the sentence and can reply with gentle buttons.",
    );
    expect(screen.getByTestId("together-composer-preview-message-private")).toHaveTextContent(
      "Keep phone, email and exact address out.",
    );
    expect(screen.getByTestId("together-composer-preview-message-next")).toHaveTextContent(
      "If wording feels sharp, VYVA can soften it first.",
    );

    fireEvent.click(screen.getByTestId("together-cancel-proposal"));
    fireEvent.click(screen.getByTestId("together-starter-ask"));

    expect(screen.getByTestId("together-composer-preview")).toHaveTextContent(
      "This question will be shared so VYVA can help or turn it into a vote.",
    );
    expect(screen.getByTestId("together-composer-preview-question-shared")).toHaveTextContent(
      "The room sees the question, not who needs help.",
    );
    expect(screen.getByTestId("together-composer-preview-question-private")).toHaveTextContent(
      "Your votes and comfort needs stay private.",
    );
    expect(screen.getByTestId("together-composer-preview-question-next")).toHaveTextContent(
      "VYVA can turn this into one simple vote with totals.",
    );
  });

  it("explains when a shared item is held for VYVA review", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      proposal: {
        planKey: "experience-held",
        kind: "plan",
        safetyFlags: ["money"],
        needsReview: true,
        status: "pending_review",
      },
      pulse: {
        ...roomResponse.pulse!,
        postedExperiences: [],
      },
    }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-starter-plan"));
    fireEvent.click(screen.getByTestId("together-proposal-category-deal_help"));
    fireEvent.change(screen.getByPlaceholderText("Write one small idea..."), {
      target: { value: "Compare the price before anyone pays" },
    });
    fireEvent.click(screen.getByLabelText("Send"));

    await waitFor(() => {
      expect(screen.getByText("VYVA will review this before it appears.")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("together-shared-today")).not.toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/social/rooms/together-room/proposals",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"experienceCategory":"deal_help"'),
      }),
    );
  });

  it("keeps starter actions simple while inviting safe view sharing", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getAllByTestId(/together-starter-/)).toHaveLength(3);
    expect(screen.getByTestId("together-starter-hello")).toHaveTextContent("Say hello");
    expect(screen.getByTestId("together-starter-plan")).toHaveTextContent("Suggest a plan");
    expect(screen.getByTestId("together-starter-ask")).toHaveTextContent("Ask VYVA");
    expect(screen.queryByTestId("together-starter-view")).not.toBeInTheDocument();
    expect(screen.getByTestId("together-view-sharing-note")).toHaveTextContent(
      "You can share a short view with kind words and no personal contact details.",
    );
  });

  it("opens the daily gentle question as a safe shared view draft", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-daily-question-action"));

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("together-view-starters")).toHaveTextContent("Kind view starters");
    expect(screen.getByTestId("together-composer-preview")).toHaveTextContent(
      "This note will be shared as a short view, with gentle replies nearby.",
    );
    expect(screen.getByTestId("together-composer-preview-message-shared")).toHaveTextContent(
      "The room sees the sentence and can reply with gentle buttons.",
    );
    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "What would make it easier for me to join today is...",
    );
    expect(screen.queryByText("What kind of experience?")).not.toBeInTheDocument();
  });

  it("opens safe joining support as a VYVA question draft", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-joining-support-action"));

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Easy questions for VYVA");
    expect(screen.getByTestId("together-composer-preview")).toHaveTextContent(
      "This question will be shared so VYVA can help or turn it into a vote.",
    );
    expect(screen.getByTestId("together-composer-preview-question-private")).toHaveTextContent(
      "Your votes and comfort needs stay private.",
    );
    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "VYVA, please check access, seating, and a quiet pace for the next plan. Use totals, not names, and keep contact private.",
    );
    expect(screen.queryByText("What kind of experience?")).not.toBeInTheDocument();
  });

  it("submits the Say hello starter as an open-room message", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, pulse: roomResponse.pulse }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-starter-hello"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/proposals",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"kind":"message"'),
        }),
      );
    });
    const body = JSON.parse(String(apiFetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      title: "Say hello",
      details: "I would like to say hello and hear what others think.",
      locationLabel: "online",
      comfortNeeds: [],
      kind: "message",
      experienceCategory: "other",
      preferredTime: "flexible",
      costRange: "discuss",
      groupSize: "open_room",
    });
    expect(screen.getByText("Sent")).toBeInTheDocument();
  });

  it("prevents repeated Say hello posts while the first one is sending", async () => {
    let resolveProposal: (value: Response) => void = () => undefined;
    apiFetchMock.mockImplementation((url: string) => {
      if (url.includes("/proposals")) {
        return new Promise<Response>((resolve) => {
          resolveProposal = resolve;
        });
      }
      return Promise.resolve(jsonResponse({ ok: true, pulse: roomResponse.pulse }));
    });

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    const helloButton = screen.getByTestId("together-starter-hello");
    fireEvent.click(helloButton);

    await waitFor(() => {
      expect(helloButton).toBeDisabled();
    });
    fireEvent.click(helloButton);

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/social/rooms/together-room/proposals",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"title":"Say hello"'),
      }),
    );

    resolveProposal(jsonResponse({ ok: true, pulse: roomResponse.pulse }));

    await waitFor(() => {
      expect(helloButton).not.toBeDisabled();
    });
    expect(screen.getByText("Sent")).toBeInTheDocument();
  });

  it("opens Ask VYVA as an open-room question with safe defaults", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, pulse: roomResponse.pulse }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-starter-ask"));

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "VYVA, help me choose an easy way to join in.",
    );
    expect(screen.queryByText("What kind of experience?")).not.toBeInTheDocument();
    expect(screen.queryByTestId("together-proposal-location-nearby")).not.toBeInTheDocument();
    expect(screen.getByTestId("together-safe-share-cue")).toHaveTextContent("Share safely");
    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Easy questions for VYVA");
    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Summarize");
    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Make it easier");
    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Suggest a vote");
    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Safety check");
    expect(screen.getByTestId("together-issue-prompts")).toHaveTextContent("Turn a concern into a vote");
    expect(screen.getByTestId("together-issue-prompts")).toHaveTextContent(
      "Choose a common issue if you want VYVA to suggest a simple room vote.",
    );
    expect(screen.getByTestId("together-issue-prompt-cost")).toHaveAccessibleName(
      "Cost: VYVA, can you suggest a simple vote to clarify cost before anyone commits?",
    );
    expect(screen.getByTestId("together-issue-prompt-safety")).toHaveTextContent("Safety");

    fireEvent.click(screen.getByTestId("together-ask-prompt-vote"));

    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "VYVA, can you turn this into a simple room vote?",
    );

    fireEvent.click(screen.getByTestId("together-ask-prompt-safe"));

    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "VYVA, can you check if this feels safe and no-pressure?",
    );

    fireEvent.click(screen.getByLabelText("Send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/proposals",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"kind":"question"'),
        }),
      );
    });
    const body = JSON.parse(String(apiFetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      title: "VYVA, can you check if this feels safe and no-pressure?",
      details: "VYVA, can you check if this feels safe and no-pressure?",
      locationLabel: "online",
      comfortNeeds: [],
      kind: "question",
      experienceCategory: "other",
      preferredTime: "flexible",
      costRange: "discuss",
      groupSize: "open_room",
    });
    expect(screen.getByText("Sent")).toBeInTheDocument();
  });

  it("lets seniors ask VYVA to turn a concern into a future room vote", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, pulse: roomResponse.pulse }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-starter-ask"));
    fireEvent.click(screen.getByTestId("together-issue-prompt-cost"));

    expect(screen.getByTestId("together-issue-prompt-cost")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "VYVA, can you suggest a simple vote to clarify cost before anyone commits?",
    );

    fireEvent.click(screen.getByLabelText("Send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/proposals",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"kind":"question"'),
        }),
      );
    });

    const body = JSON.parse(String(apiFetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      title: "VYVA, can you suggest a simple vote to clarify cost before anyone commits?",
      details: "VYVA, can you suggest a simple vote to clarify cost before anyone commits?",
      locationLabel: "online",
      comfortNeeds: [],
      kind: "question",
      experienceCategory: "other",
      preferredTime: "flexible",
      costRange: "discuss",
      groupSize: "open_room",
    });
    expect(screen.getByText("Sent")).toBeInTheDocument();
  });

  it("lets members cancel a starter draft without sending it", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-starter-ask"));
    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "VYVA, help me choose an easy way to join in.",
    );

    fireEvent.click(screen.getByTestId("together-cancel-proposal"));

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText("Write one small idea...")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("together-starter-plan"));
    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue("I would like to share a gentle plan.");
    expect(screen.getByText("What kind of experience?")).toBeInTheDocument();
  });

  it("lets suggested plans be marked online before posting", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, pulse: roomResponse.pulse }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-starter-plan"));
    fireEvent.click(screen.getByTestId("together-proposal-location-online"));
    expect(screen.getByTestId("together-proposal-location-nearby")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("together-proposal-location-online")).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getByPlaceholderText("Write one small idea..."), {
      target: { value: "A quiet video chat" },
    });
    fireEvent.click(screen.getByLabelText("Send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/proposals",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"title":"A quiet video chat"'),
        }),
      );
    });
    const body = String(apiFetchMock.mock.calls[0][1]?.body);
    expect(body).toContain('"kind":"plan"');
    expect(body).toContain('"locationLabel":"online"');
    expect(JSON.parse(body)).toMatchObject({
      comfortNeeds: ["quiet_pace"],
      experienceCategory: "outing",
      preferredTime: "flexible",
      costRange: "discuss",
      groupSize: "one_to_one",
    });
  });

  it("shows shared ideas and lets members support them", async () => {
    const responseWithSharedIdea: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        postedExperiences: [
          {
            id: "experience-1",
            key: "experience-1",
            kind: "message",
            title: "Tea at a quiet cafe",
            body: "Friday afternoon, nearby if possible.",
            locationLabel: "nearby",
            comfortNeeds: ["quiet_pace"],
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 0, maybe: 0 },
            myResponse: null,
          },
        ],
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithSharedIdea} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-shared-today")).toBeInTheDocument();
    expect(screen.getByText("View")).toBeInTheDocument();
    expect(screen.queryByTestId("together-plan-location-experience-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("together-plan-comfort-experience-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("together-withdraw-item-experience-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("together-reply-guide-experience-1")).toHaveTextContent("Kind reply space");
    expect(screen.getByTestId("together-reply-guide-experience-1")).toHaveTextContent(
      "If a reply feels wrong, VYVA can review it.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Me too" }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/plans/experience-1/respond",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"response":"join"'),
        }),
      );
    });
  });

  it("lets a member hide their own shared view without leaving quiet pause", async () => {
    const responseWithOwnSharedView: SocialRoomResponse = {
      ...roomResponse,
      quietPausedAt: "2026-06-04T10:20:00.000Z",
      pulse: {
        ...roomResponse.pulse!,
        safety: {
          ...roomResponse.pulse!.safety,
          myQuietPausedAt: "2026-06-04T10:20:00.000Z",
        },
        postedExperiences: [
          {
            id: "experience-own-view",
            key: "experience-own-view",
            kind: "message",
            title: "I prefer a quiet start",
            body: "A short check-in would help me join.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            ownedByMe: true,
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 0, maybe: 0 },
            myResponse: null,
          },
        ],
      },
    };
    const withdrawnPulse: SocialRoomPulse = {
      ...responseWithOwnSharedView.pulse!,
      postedExperiences: [],
    };
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, pulse: withdrawnPulse }));

    render(<TogetherRoomScreen roomResponse={responseWithOwnSharedView} language="en" visitId="visit-1" onBack={vi.fn()} />);

    const withdrawButton = screen.getByTestId("together-withdraw-item-experience-own-view");
    expect(withdrawButton).toHaveAccessibleName("Hide my share: I prefer a quiet start");
    expect(withdrawButton.closest("article")).toHaveTextContent("I prefer a quiet start");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(withdrawButton);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/plans/experience-own-view/withdraw",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(screen.queryByTestId("together-withdraw-item-experience-own-view")).not.toBeInTheDocument();
    expect(screen.getByTestId("together-status-message")).toHaveTextContent("Your share was removed from the room");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "true");
    expect(apiFetchMock).not.toHaveBeenCalledWith(
      "/api/social/rooms/together-room/quiet-pause",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"paused":false'),
      }),
    );
  });

  it("keeps hidden replies out of shared idea conversations", () => {
    const responseWithSharedReplies: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        postedExperiences: [
          {
            id: "experience-1",
            key: "experience-1",
            kind: "message",
            title: "Tea at a quiet cafe",
            body: "Friday afternoon, nearby if possible.",
            locationLabel: "nearby",
            comfortNeeds: ["quiet_pace"],
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 0, maybe: 0 },
            myResponse: null,
            replies: [
              {
                id: "reply-shared-active",
                planKey: "experience-1",
                authorName: "Member",
                body: "This active reply should stay visible.",
                tone: "support",
                status: "active",
                createdAt: "2026-06-04T10:01:00.000Z",
              },
              {
                id: "reply-shared-hidden",
                planKey: "experience-1",
                authorName: "Member",
                body: "This hidden reply should stay gone.",
                tone: "different",
                status: "hidden",
                createdAt: "2026-06-04T10:02:00.000Z",
              },
            ],
          },
        ],
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithSharedReplies} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-reply-reply-shared-active")).toHaveTextContent(
      "This active reply should stay visible.",
    );
    expect(screen.queryByTestId("together-reply-reply-shared-hidden")).not.toBeInTheDocument();
    expect(screen.queryByText("This hidden reply should stay gone.")).not.toBeInTheDocument();
  });

  it("keeps true hello posts separate from the view circle", () => {
    const responseWithHello: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        postedExperiences: [
          {
            id: "hello-1",
            key: "hello-1",
            kind: "message",
            title: "Say hello",
            body: "I would like to say hello and hear what others think.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 0, maybe: 0 },
            myResponse: null,
          },
        ],
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithHello} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-shared-today")).toHaveTextContent("Hello");
    expect(screen.getByTestId("together-shared-today")).toHaveTextContent("Say hello");
    expect(screen.queryByTestId("together-view-circle")).not.toBeInTheDocument();
  });

  it("summarizes view replies by tone so disagreement stays safe", () => {
    const responseWithBalancedViews: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        postedExperiences: [
          {
            id: "view-1",
            key: "view-1",
            kind: "message",
            title: "I prefer a quiet start",
            body: "It helps me when the room moves slowly.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 0, maybe: 0 },
            myResponse: null,
            replies: [
              {
                id: "reply-support",
                planKey: "view-1",
                authorName: "Member",
                body: "I feel the same.",
                tone: "support",
                status: "active",
                createdAt: "2026-06-04T10:01:00.000Z",
              },
              {
                id: "reply-curious",
                planKey: "view-1",
                authorName: "Member",
                body: "Tell me more.",
                tone: "curious",
                status: "active",
                createdAt: "2026-06-04T10:02:00.000Z",
              },
              {
                id: "reply-different",
                planKey: "view-1",
                authorName: "Member",
                body: "I see it differently.",
                tone: "different",
                status: "active",
                createdAt: "2026-06-04T10:03:00.000Z",
              },
              {
                id: "reply-help",
                planKey: "view-1",
                authorName: "Member",
                body: "I can help.",
                tone: "help",
                status: "active",
                createdAt: "2026-06-04T10:04:00.000Z",
              },
              {
                id: "reply-hidden",
                planKey: "view-1",
                authorName: "Member",
                body: "Hidden support.",
                tone: "support",
                status: "hidden",
                createdAt: "2026-06-04T10:05:00.000Z",
              },
            ],
          },
        ],
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithBalancedViews} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-view-balance")).toHaveTextContent("Conversation balance");
    expect(screen.getByTestId("together-view-balance")).toHaveTextContent(
      "Shows how the room is responding, so a different view can still feel safe.",
    );
    expect(screen.getByTestId("together-view-balance-support")).toHaveTextContent("Same feeling");
    expect(screen.getByTestId("together-view-balance-support")).toHaveTextContent("1");
    expect(screen.getByTestId("together-view-balance-curious")).toHaveTextContent("More context");
    expect(screen.getByTestId("together-view-balance-curious")).toHaveTextContent("1");
    expect(screen.getByTestId("together-view-balance-different")).toHaveTextContent("Another view");
    expect(screen.getByTestId("together-view-balance-different")).toHaveTextContent("1");
    expect(screen.getByTestId("together-view-balance-help")).toHaveTextContent("Help offered");
    expect(screen.getByTestId("together-view-balance-help")).toHaveTextContent("1");
    expect(screen.getByLabelText("Same feeling: 1")).toBeInTheDocument();
    expect(screen.getByTestId("together-view-common-ground")).toHaveTextContent("Common ground");
    expect(screen.getByTestId("together-view-common-ground")).toHaveTextContent(
      "Several signals are present at once. A VYVA recap can turn them into a clear next step.",
    );
    expect(screen.getByTestId("together-view-common-ground")).toHaveTextContent(
      "Replies are summarized by tone, not by name.",
    );
    expect(screen.getByTestId("together-view-next-reply")).toHaveTextContent("Next kind reply");
    expect(screen.getByTestId("together-view-next-reply")).toHaveTextContent(
      "When signals are mixed, ask what matters most before deciding.",
    );
    expect(screen.getByTestId("together-view-next-reply-action")).toHaveAccessibleName(
      "Ask what matters most: Could we pause and say what matters most to each person before choosing?",
    );

    fireEvent.click(screen.getByTestId("together-view-next-reply-action"));

    expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
      "Could we pause and say what matters most to each person before choosing?",
    );

    fireEvent.click(screen.getByTestId("together-view-recap-action"));

    expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
      "VYVA, please recap this shared view in simple, kind words without showing names.",
    );
  });

  it("lets members send a gentle reply to a shared idea", async () => {
    const responseWithSharedIdea: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        postedExperiences: [
          {
            id: "experience-1",
            key: "experience-1",
            kind: "message",
            title: "A calm cafe idea",
            body: "I would like a quiet place for a short conversation.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 0, maybe: 0 },
            myResponse: null,
            replies: [
              {
                id: "reply-1",
                planKey: "experience-1",
                authorName: "Member",
                body: "That sounds gentle.",
                tone: "support",
                status: "active",
                createdAt: "2026-06-04T10:05:00.000Z",
              },
            ],
          },
        ],
      },
    };
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      pulse: {
        ...responseWithSharedIdea.pulse!,
        postedExperiences: [
          {
            ...responseWithSharedIdea.pulse!.postedExperiences[0],
            replies: [
              {
                id: "reply-2",
                planKey: "experience-1",
                authorName: "Member",
                body: "I see it a little differently, and I appreciate you sharing it.",
                tone: "different",
                status: "active",
                createdAt: "2026-06-04T10:06:00.000Z",
              },
              ...responseWithSharedIdea.pulse!.postedExperiences[0].replies!,
            ],
          },
        ],
      },
    }));

    render(<TogetherRoomScreen roomResponse={responseWithSharedIdea} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-gentle-replies-experience-1")).toHaveTextContent("That sounds gentle.");
    expect(screen.getByTestId("together-reply-guide-experience-1")).toHaveTextContent("Use one gentle button.");
    expect(screen.getByTestId("together-reply-different-experience-1")).toHaveTextContent("Another view");
    expect(screen.getByTestId("together-reply-different-experience-1")).toHaveTextContent(
      "I see it a little differently, and I appreciate you sharing it.",
    );
    expect(screen.getByTestId("together-reply-different-experience-1")).toHaveAccessibleName(
      "Another view: I see it a little differently, and I appreciate you sharing it.",
    );

    fireEvent.click(screen.getByTestId("together-reply-different-experience-1"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/plans/experience-1/replies",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"tone":"different"'),
        }),
      );
    });
    const body = JSON.parse(String(apiFetchMock.mock.calls[0][1]?.body));
    expect(body.body).toBe("I see it a little differently, and I appreciate you sharing it.");
    expect(screen.getByTestId("together-reply-reply-2")).toHaveTextContent("differently");
    expect(screen.getByRole("status")).toHaveTextContent("Reply shared");
  });

  it("lets a member hide their own gentle reply without leaving quiet pause", async () => {
    const ownReply = {
      id: "reply-own",
      planKey: "experience-1",
      authorName: "Member",
      body: "That sounds gentle.",
      tone: "support" as const,
      status: "active",
      ownedByMe: true,
      createdAt: "2026-06-04T10:05:00.000Z",
    };
    const otherReply = {
      id: "reply-other",
      planKey: "experience-1",
      authorName: "Member",
      body: "I would like to know more.",
      tone: "curious" as const,
      status: "active",
      ownedByMe: false,
      createdAt: "2026-06-04T10:06:00.000Z",
    };
    const sharedIdea: SocialRoomPlan = {
      id: "experience-1",
      key: "experience-1",
      kind: "message",
      title: "A calm cafe idea",
      body: "I would like a quiet place for a short conversation.",
      locationLabel: "online",
      startsAt: null,
      status: "active",
      source: "user",
      createdBy: "demo-user",
      createdAt: "2026-06-04T10:00:00.000Z",
      responseCounts: { join: 0, maybe: 0 },
      myResponse: null,
      replies: [ownReply, otherReply],
    };
    const responseWithOwnReply: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        safety: {
          ...roomResponse.pulse!.safety,
          myQuietPausedAt: "2026-06-04T10:20:00.000Z",
        },
        postedExperiences: [sharedIdea],
      },
    };
    const withdrawnPulse: SocialRoomPulse = {
      ...responseWithOwnReply.pulse!,
      postedExperiences: [
        {
          ...sharedIdea,
          replies: [otherReply],
        },
      ],
    };
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      withdrawnReply: { planId: "experience-1", replyId: "reply-own", withdrawn: true },
      pulse: withdrawnPulse,
    }));

    render(<TogetherRoomScreen roomResponse={responseWithOwnReply} language="en" visitId="visit-1" onBack={vi.fn()} />);

    const withdrawButton = screen.getByTestId("together-withdraw-reply-reply-own");
    expect(withdrawButton).toHaveAccessibleName("Hide my reply: That sounds gentle.");
    expect(withdrawButton).toHaveClass("min-h-[44px]");
    expect(screen.queryByTestId("together-withdraw-reply-reply-other")).not.toBeInTheDocument();
    expect(screen.getByTestId("together-reply-reply-own")).toHaveTextContent("That sounds gentle.");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(withdrawButton);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/plans/experience-1/replies/reply-own/withdraw",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(screen.queryByTestId("together-reply-reply-own")).not.toBeInTheDocument();
    expect(screen.getByTestId("together-reply-reply-other")).toHaveTextContent("I would like to know more.");
    expect(screen.getByTestId("together-status-message")).toHaveTextContent("Your reply was removed from the room");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "true");
    expect(apiFetchMock).not.toHaveBeenCalledWith(
      "/api/social/rooms/together-room/quiet-pause",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"paused":false'),
      }),
    );
  });

  it("prevents repeated gentle replies while the first one is sending", async () => {
    const responseWithSharedIdea: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        postedExperiences: [
          {
            id: "experience-1",
            key: "experience-1",
            kind: "message",
            title: "A calm cafe idea",
            body: "I would like a quiet place for a short conversation.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 0, maybe: 0 },
            myResponse: null,
          },
        ],
      },
    };
    let resolveReply: (value: Response) => void = () => undefined;
    apiFetchMock.mockImplementation((url: string) => {
      if (url.includes("/plans/experience-1/replies")) {
        return new Promise<Response>((resolve) => {
          resolveReply = resolve;
        });
      }
      return Promise.resolve(jsonResponse({ ok: true, pulse: responseWithSharedIdea.pulse }));
    });

    render(<TogetherRoomScreen roomResponse={responseWithSharedIdea} language="en" visitId="visit-1" onBack={vi.fn()} />);

    const supportButton = screen.getByTestId("together-reply-support-experience-1");
    const differentButton = screen.getByTestId("together-reply-different-experience-1");
    fireEvent.click(supportButton);

    await waitFor(() => {
      expect(supportButton).toBeDisabled();
      expect(differentButton).toBeDisabled();
    });
    fireEvent.click(differentButton);

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/social/rooms/together-room/plans/experience-1/replies",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"tone":"support"'),
      }),
    );

    resolveReply(jsonResponse({ ok: true, pulse: responseWithSharedIdea.pulse }));

    await waitFor(() => {
      expect(supportButton).not.toBeDisabled();
      expect(differentButton).not.toBeDisabled();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Reply shared");
  });

  it("can ask VYVA to review a specific gentle reply", async () => {
    const responseWithSharedIdea: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        postedExperiences: [
          {
            id: "experience-1",
            key: "experience-1",
            kind: "message",
            title: "A calm cafe idea",
            body: "I would like a quiet place for a short conversation.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 0, maybe: 0 },
            myResponse: null,
            replies: [
              {
                id: "reply-1",
                planKey: "experience-1",
                authorName: "Member",
                body: "That sounds gentle.",
                tone: "support",
                status: "active",
                createdAt: "2026-06-04T10:05:00.000Z",
              },
            ],
          },
        ],
      },
    };
    apiFetchMock.mockResolvedValue(jsonResponse({ ok: true, pulse: responseWithSharedIdea.pulse }));

    render(<TogetherRoomScreen roomResponse={responseWithSharedIdea} language="en" visitId="visit-1" onBack={vi.fn()} />);

    const reviewButton = screen.getByTestId("together-review-reply-reply-1");
    expect(reviewButton).toHaveTextContent("Review reply");
    expect(reviewButton).toHaveClass("min-h-[44px]");

    fireEvent.click(reviewButton);
    fireEvent.click(reviewButton);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/safety-reports",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"targetType":"reply"'),
        }),
      );
    });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const body = String(apiFetchMock.mock.calls[0][1]?.body);
    expect(body).toContain('"reason":"reply_review"');
    expect(body).toContain('"targetId":"reply-1"');
    expect(body).toContain("That sounds gentle.");
    await waitFor(() => {
      expect(reviewButton).toHaveTextContent("Sent to VYVA");
    });
    expect(reviewButton).toBeDisabled();
  });

  it("can ask VYVA to review a specific shared item", async () => {
    const responseWithSharedQuestion: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        postedExperiences: [
          {
            id: "experience-question-1",
            key: "experience-question-1",
            kind: "question",
            title: "Can VYVA help me choose?",
            body: "I want an easy way to join in.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 0, maybe: 0 },
            myResponse: null,
          },
        ],
      },
    };
    apiFetchMock.mockResolvedValue(jsonResponse({ ok: true, pulse: responseWithSharedQuestion.pulse }));

    render(<TogetherRoomScreen roomResponse={responseWithSharedQuestion} language="en" visitId="visit-1" onBack={vi.fn()} />);

    const reviewButton = screen.getByTestId("together-review-item-experience-question-1");
    fireEvent.click(reviewButton);
    fireEvent.click(reviewButton);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/safety-reports",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"reason":"shared_item_review"'),
        }),
      );
    });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const body = String(apiFetchMock.mock.calls[0][1]?.body);
    expect(body).toContain('"targetType":"question"');
    expect(body).toContain('"targetId":"experience-question-1"');
    await waitFor(() => {
      expect(reviewButton).toHaveTextContent("Sent to VYVA");
    });
    expect(reviewButton).toBeDisabled();
  });

  it("keeps already reviewed shared items disabled from the room pulse", () => {
    const responseWithReceipts: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        safety: {
          ...roomResponse.pulse!.safety,
          reportedItemKeys: ["reply:reply-1", "plan:experience-1", "plan:experience-question-1"],
          reportedItemStatuses: [
            {
              itemKey: "reply:reply-1",
              status: "resolved",
              updatedAt: "2026-06-04T10:15:00.000Z",
            },
            {
              itemKey: "plan:experience-1",
              status: "dismissed",
              updatedAt: "2026-06-04T10:14:00.000Z",
            },
            {
              itemKey: "plan:experience-question-1",
              status: "reviewing",
              updatedAt: "2026-06-04T10:13:00.000Z",
            },
          ],
        },
        postedExperiences: [
          {
            id: "experience-1",
            key: "experience-1",
            kind: "message",
            title: "A calm cafe idea",
            body: "I would like a quiet place for a short conversation.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 0, maybe: 0 },
            myResponse: null,
            replies: [
              {
                id: "reply-1",
                planKey: "experience-1",
                authorName: "Member",
                body: "That sounds gentle.",
                tone: "support",
                status: "active",
                createdAt: "2026-06-04T10:05:00.000Z",
              },
            ],
          },
          {
            id: "experience-question-1",
            key: "experience-question-1",
            kind: "question",
            title: "Can VYVA help me choose?",
            body: "I want an easy way to join in.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:10:00.000Z",
            responseCounts: { join: 0, maybe: 0 },
            myResponse: null,
          },
        ],
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithReceipts} language="en" visitId="visit-1" onBack={vi.fn()} />);

    const replyReviewButton = screen.getByTestId("together-review-reply-reply-1");
    const viewReviewButton = screen.getByTestId("together-view-circle-review-experience-1");
    const questionReviewButton = screen.getByTestId("together-review-item-experience-question-1");
    const issueReviewButton = screen.getByTestId("together-issue-review-experience-question-1");
    const reviewUpdates = screen.getByTestId("together-my-review-updates");

    expect(replyReviewButton).toHaveTextContent("VYVA checked this");
    expect(replyReviewButton).toBeDisabled();
    expect(viewReviewButton).toHaveTextContent("VYVA looked at this");
    expect(viewReviewButton).toBeDisabled();
    expect(questionReviewButton).toHaveTextContent("VYVA is checking this");
    expect(questionReviewButton).toBeDisabled();
    expect(issueReviewButton).toHaveTextContent("VYVA is checking this");
    expect(issueReviewButton).toBeDisabled();
    expect(reviewUpdates).toHaveTextContent("VYVA review updates");
    expect(reviewUpdates).toHaveTextContent("Only you see these review states.");
    expect(reviewUpdates).toHaveTextContent("Reply: That sounds gentle.");
    expect(reviewUpdates).toHaveTextContent("VYVA checked this");
    expect(reviewUpdates).toHaveTextContent("A calm cafe idea");
    expect(reviewUpdates).toHaveTextContent("VYVA looked at this");
    expect(reviewUpdates).toHaveTextContent("Can VYVA help me choose?");
    expect(reviewUpdates).toHaveTextContent("VYVA is checking this");

    fireEvent.click(replyReviewButton);
    fireEvent.click(viewReviewButton);
    fireEvent.click(questionReviewButton);
    fireEvent.click(issueReviewButton);

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("shows question proposals as possible future votes", async () => {
    const responseWithIssueQuestion: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        postedExperiences: [
          {
            id: "experience-question-1",
            key: "experience-question-1",
            kind: "question",
            title: "Can we vote on cost first?",
            body: "I want to know the cost before anyone commits.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 1, maybe: 0 },
            myResponse: null,
          },
        ],
        issuePolls: [
          {
            id: "issue-experience-question-1",
            key: "issue-experience-question-1",
            sourcePlanKey: "experience-question-1",
            question: "Vote: Can we vote on cost first?",
            status: "active",
            options: [
              { id: "yes", label: "Yes, this matters", votes: 0 },
              { id: "more_info", label: "I need more detail", votes: 0 },
              { id: "not_now", label: "Not now", votes: 0 },
            ],
            totalVotes: 0,
            myVote: null,
          },
        ],
      },
    };
    const responseAfterIssueVote: SocialRoomResponse["pulse"] = {
      ...responseWithIssueQuestion.pulse!,
      issuePolls: [
        {
          ...responseWithIssueQuestion.pulse!.issuePolls![0],
          options: responseWithIssueQuestion.pulse!.issuePolls![0].options.map((option) => (
            option.id === "yes" ? { ...option, votes: 1 } : option
          )),
          totalVotes: 1,
          myVote: "yes",
        },
      ],
    };
    apiFetchMock
      .mockResolvedValueOnce(jsonResponse({ ok: true, pulse: responseWithIssueQuestion.pulse }))
      .mockResolvedValueOnce(jsonResponse({ ok: true, pulse: responseAfterIssueVote }));

    render(<TogetherRoomScreen roomResponse={responseWithIssueQuestion} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-issue-vote-queue")).toHaveTextContent("Questions for a future vote");
    expect(screen.getByTestId("together-issue-vote-experience-question-1")).toHaveTextContent("Possible vote");
    expect(screen.getByTestId("together-issue-vote-experience-question-1")).toHaveTextContent("Can we vote on cost first?");
    expect(screen.getByTestId("together-issue-response-summary-experience-question-1")).toHaveTextContent("1 joining");
    expect(screen.getByTestId("together-issue-vote-experience-question-1")).toHaveTextContent(
      "Supporting a question only shows interest. The room does not see your name.",
    );
    expect(screen.getByTestId("together-issue-readiness-experience-question-1")).toHaveTextContent("Ready for a vote");
    expect(screen.getByTestId("together-issue-readiness-experience-question-1")).toHaveTextContent(
      "There is interest now. VYVA can turn this into a private vote with no names.",
    );
    expect(screen.getByTestId("together-issue-mini-poll-experience-question-1")).toHaveTextContent("Simple vote");
    expect(screen.getByTestId("together-issue-mini-poll-experience-question-1")).toHaveTextContent("This vote is private too.");
    expect(screen.getByTestId("together-issue-poll-experience-question-1-yes")).toHaveTextContent("Yes, this matters");
    expect(screen.getByTestId("together-issue-poll-pass-experience-question-1")).toHaveTextContent("I'll decide later");
    expect(screen.getByTestId("together-issue-poll-pass-experience-question-1")).toHaveTextContent("No vote is sent.");
    expect(screen.getByTestId("together-issue-poll-pass-experience-question-1")).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByTestId("together-issue-support-experience-question-1"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/plans/experience-question-1/respond",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"response":"join"'),
        }),
      );
    });

    fireEvent.click(screen.getByTestId("together-issue-poll-experience-question-1-yes"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/polls/issue-experience-question-1/vote",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"optionId":"yes"'),
        }),
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("together-issue-poll-experience-question-1-yes")).toHaveTextContent("Your choice");
    });
    expect(screen.queryByTestId("together-issue-poll-pass-experience-question-1")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("together-issue-readiness-state-experience-question-1")).toHaveTextContent(
        "Ready to summarize",
      );
    });
    expect(screen.getByTestId("together-issue-readiness-experience-question-1")).toHaveTextContent(
      "The signal is: Yes, this matters. VYVA can summarize it and suggest one safe next step.",
    );
    expect(screen.getByTestId("together-at-glance-votes")).toHaveTextContent("1 vote");
    expect(screen.getByTestId("together-my-safe-choice-vote")).toHaveTextContent("Can we vote on cost first?");
    expect(screen.getByTestId("together-my-safe-choice-vote")).toHaveTextContent("Yes, this matters");
    expect(screen.getByTestId("together-issue-poll-outcome-experience-question-1")).toHaveTextContent("Room signal");
    expect(screen.getByTestId("together-issue-poll-outcome-experience-question-1")).toHaveTextContent(
      "Right now the room is leaning toward: Yes, this matters.",
    );
    expect(screen.getByTestId("together-issue-poll-outcome-reassurance-experience-question-1")).toHaveTextContent(
      "People can still choose another option while voting stays open.",
    );

    expect(screen.getByTestId("together-issue-shape-vote-experience-question-1")).toHaveTextContent("Summarize this vote");
    fireEvent.click(screen.getByTestId("together-issue-shape-vote-experience-question-1"));

    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Easy questions for VYVA");
    expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
      'VYVA, please summarize the private vote about "Can we vote on cost first?". The current signal is: Yes, this matters. Help the room choose a safe next step, without names.',
    );
  });

  it("lets a member pass an issue vote for now without sending a vote", async () => {
    const responseWithIssueQuestion: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        postedExperiences: [
          {
            id: "experience-question-1",
            key: "experience-question-1",
            kind: "question",
            title: "Can we vote on cost first?",
            body: "I want to know the cost before anyone commits.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 1, maybe: 0 },
            myResponse: null,
          },
        ],
        issuePolls: [
          {
            id: "issue-experience-question-1",
            key: "issue-experience-question-1",
            sourcePlanKey: "experience-question-1",
            question: "Vote: Can we vote on cost first?",
            status: "active",
            options: [
              { id: "yes", label: "Yes, this matters", votes: 0 },
              { id: "more_info", label: "I need more detail", votes: 0 },
              { id: "not_now", label: "Not now", votes: 0 },
            ],
            totalVotes: 0,
            myVote: null,
          },
        ],
      },
    };
    const quietPulse: SocialRoomPulse = {
      ...responseWithIssueQuestion.pulse!,
      safety: {
        ...responseWithIssueQuestion.pulse!.safety,
        myQuietPausedAt: "2026-06-04T10:22:00.000Z",
      },
    };
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, pulse: quietPulse }));

    render(<TogetherRoomScreen roomResponse={responseWithIssueQuestion} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-issue-poll-pass-experience-question-1")).toHaveTextContent("I'll decide later");
    expect(screen.getByTestId("together-issue-poll-pass-experience-question-1")).toHaveTextContent("No vote is sent.");
    expect(screen.getByTestId("together-issue-poll-pass-experience-question-1")).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByTestId("together-issue-poll-pass-experience-question-1"));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("You can decide later. No vote was sent.");
    });
    expect(screen.getByTestId("together-issue-poll-pass-experience-question-1")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-quiet-pause-note")).toHaveTextContent(
      "You can keep reading without telling the room.",
    );
    expect(screen.getByTestId("together-my-safe-choice-vote")).toHaveTextContent("No vote yet");
    expect(screen.getByTestId("together-at-glance-votes")).toHaveTextContent("0 votes");
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/social/rooms/together-room/quiet-pause",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"paused":true'),
      }),
    );
    expect(apiFetchMock.mock.calls.some(([url]) => String(url).includes("/polls/issue-experience-question-1/vote"))).toBe(false);
  });

  it("lets a member privately remove an issue vote without leaving quiet pause", async () => {
    const responseWithIssueVote: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        safety: {
          ...roomResponse.pulse!.safety,
          myQuietPausedAt: "2026-06-04T10:20:00.000Z",
        },
        postedExperiences: [
          {
            id: "experience-question-1",
            key: "experience-question-1",
            kind: "question",
            title: "Can we vote on cost first?",
            body: "I want to know the cost before anyone commits.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 1, maybe: 0 },
            myResponse: null,
          },
        ],
        issuePolls: [
          {
            id: "issue-experience-question-1",
            key: "issue-experience-question-1",
            sourcePlanKey: "experience-question-1",
            question: "Vote: Can we vote on cost first?",
            status: "active",
            options: [
              { id: "yes", label: "Yes, this matters", votes: 1 },
              { id: "more_info", label: "I need more detail", votes: 0 },
              { id: "not_now", label: "Not now", votes: 0 },
            ],
            totalVotes: 1,
            myVote: "yes",
          },
        ],
      },
    };
    const clearedPulse: SocialRoomPulse = {
      ...responseWithIssueVote.pulse!,
      issuePolls: [
        {
          ...responseWithIssueVote.pulse!.issuePolls![0],
          options: responseWithIssueVote.pulse!.issuePolls![0].options.map((option) => (
            option.id === "yes" ? { ...option, votes: 0 } : option
          )),
          totalVotes: 0,
          myVote: null,
        },
      ],
    };
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, pulse: clearedPulse }));

    render(<TogetherRoomScreen roomResponse={responseWithIssueVote} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-issue-mini-poll-experience-question-1")).toHaveTextContent(
      "Choose one option. You can change or remove it while voting is open.",
    );
    expect(screen.getByTestId("together-issue-poll-experience-question-1-yes")).toHaveTextContent("Your choice");
    expect(screen.getByTestId("together-issue-poll-clear-experience-question-1")).toHaveTextContent("Remove my vote");

    fireEvent.click(screen.getByTestId("together-issue-poll-clear-experience-question-1"));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Your vote was removed");
    });
    expect(screen.queryByTestId("together-issue-poll-clear-experience-question-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("together-issue-poll-experience-question-1-yes")).not.toHaveTextContent("Your choice");
    expect(screen.getByTestId("together-issue-poll-experience-question-1-yes")).toHaveTextContent("0 votes");
    expect(screen.getByTestId("together-my-safe-choice-vote")).toHaveTextContent("No vote yet");
    expect(screen.getByTestId("together-quiet-pause")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-quiet-pause-note")).toHaveTextContent(
      "You can keep reading without telling the room.",
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/social/rooms/together-room/polls/issue-experience-question-1/vote",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"action":"clear"'),
      }),
    );
    expect(apiFetchMock).not.toHaveBeenCalledWith(
      "/api/social/rooms/together-room/quiet-pause",
      expect.objectContaining({
        body: expect.stringContaining('"paused":false'),
      }),
    );
  });

  it("reassures seniors that different issue votes still count without names", () => {
    const responseWithDifferentIssueVotes: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        postedExperiences: [
          {
            id: "experience-question-1",
            key: "experience-question-1",
            kind: "question",
            title: "Can we vote on cost first?",
            body: "I want to know the cost before anyone commits.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 2, maybe: 1 },
            myResponse: null,
          },
        ],
        issuePolls: [
          {
            id: "issue-experience-question-1",
            key: "issue-experience-question-1",
            sourcePlanKey: "experience-question-1",
            question: "Vote: Can we vote on cost first?",
            status: "active",
            options: [
              { id: "yes", label: "Yes, this matters", votes: 2 },
              { id: "more_info", label: "I need more detail", votes: 1 },
              { id: "not_now", label: "Not now", votes: 0 },
            ],
            totalVotes: 3,
            myVote: null,
          },
        ],
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithDifferentIssueVotes} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-issue-poll-outcome-experience-question-1")).toHaveTextContent(
      "Right now the room is leaning toward: Yes, this matters.",
    );
    expect(screen.getByTestId("together-issue-poll-outcome-reassurance-experience-question-1")).toHaveTextContent(
      "Other choices still count. VYVA can include them without names.",
    );
  });

  it("shows paused issue poll results without accepting another vote", () => {
    const responseWithClosedIssuePoll: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        postedExperiences: [
          {
            id: "experience-question-1",
            key: "experience-question-1",
            kind: "question",
            title: "Can we vote on cost first?",
            body: "I want to know the cost before anyone commits.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 2, maybe: 1 },
            myResponse: null,
          },
        ],
        issuePolls: [
          {
            id: "issue-experience-question-1",
            key: "issue-experience-question-1",
            sourcePlanKey: "experience-question-1",
            question: "Vote: Can we vote on cost first?",
            status: "closed",
            options: [
              { id: "yes", label: "Yes, this matters", votes: 2 },
              { id: "more_info", label: "I need more detail", votes: 1 },
              { id: "not_now", label: "Not now", votes: 0 },
            ],
            totalVotes: 3,
            myVote: null,
          },
        ],
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithClosedIssuePoll} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-issue-mini-poll-experience-question-1")).toHaveTextContent(
      "VYVA paused this vote for review. Totals stay visible, but no new votes are accepted.",
    );
    expect(screen.getByTestId("together-issue-poll-experience-question-1-yes")).toBeDisabled();
    expect(screen.queryByTestId("together-issue-poll-pass-experience-question-1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("together-issue-poll-experience-question-1-yes"));
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("turns a vote-ready room update into a clear private-vote action", () => {
    const responseWithVoteReadyQuestion: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        postedExperiences: [
          {
            id: "experience-question-1",
            key: "experience-question-1",
            kind: "question",
            title: "Can we vote on cost first?",
            body: "I want to know the cost before anyone commits.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:00:00.000Z",
            responseCounts: { join: 1, maybe: 1 },
            myResponse: null,
          },
          {
            id: "experience-question-2",
            key: "experience-question-2",
            kind: "question",
            title: "Can we vote on transport help?",
            body: "I want to know whether someone can arrive with me.",
            locationLabel: "online",
            startsAt: null,
            status: "active",
            source: "user",
            createdBy: "demo-user",
            createdAt: "2026-06-04T10:01:00.000Z",
            responseCounts: { join: 1, maybe: 0 },
            myResponse: null,
          },
        ],
        notifications: [
          {
            id: "vote-ready-1",
            type: "vote_ready",
            title: "This question is ready for a vote",
            body: "A supported question is ready. VYVA can turn it into one simple, safe room vote without names.",
            metadata: { planKey: "experience-question-2", supportCount: 1 },
            createdAt: "2026-06-04T10:12:00.000Z",
            readAt: null,
          },
        ],
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithVoteReadyQuestion} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-vote-ready")).toHaveTextContent("This question is ready");
    expect(screen.getByTestId("together-vote-ready")).toHaveTextContent("Names stay hidden");
    expect(screen.getByTestId("together-vote-ready")).toHaveTextContent("without names");
    expect(screen.getByTestId("together-update-action-vote-ready-1")).toHaveTextContent("Ask VYVA to make the vote");
    expect(screen.getByTestId("together-update-action-safety-vote-ready-1")).toHaveTextContent("Names stay hidden");

    fireEvent.click(screen.getByTestId("together-update-action-vote-ready-1"));

    expect(screen.getByTestId("together-ask-starters")).toHaveTextContent("Easy questions for VYVA");
    expect(screen.getByTestId("together-proposal-draft")).toHaveValue(
      'VYVA, please turn "Can we vote on transport help?" into one simple room vote with safe choices and no names.',
    );
  });

  it("keeps Ask VYVA as a visible low-pressure starter", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByTestId("together-starter-ask")).toHaveTextContent("Ask VYVA");
    expect(screen.getByTestId("together-starter-plan")).toHaveTextContent("Suggest a plan");
  });

  it("shows closed poll results without accepting another vote", () => {
    const responseWithClosedPoll: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        activePoll: {
          ...roomResponse.pulse!.activePoll,
          status: "closed",
          totalVotes: 2,
          options: [
            { id: "film", label: "Film chat", votes: 1 },
            { id: "lunch", label: "Quiet lunch", votes: 1 },
          ],
        },
      },
    };

    render(<TogetherRoomScreen roomResponse={responseWithClosedPoll} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByText("Voting is closed")).toBeInTheDocument();
    expect(screen.getByTestId("together-vote-film")).toBeDisabled();
    expect(screen.queryByTestId("together-pass-vote")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("together-vote-film"));
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
