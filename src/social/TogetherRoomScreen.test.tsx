import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TogetherRoomScreen from "./TogetherRoomScreen";
import type { SocialRoomResponse } from "./types";

const apiFetchMock = vi.fn();

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
        comfortNeeds: ["easy_access", "seating", "transport_help"],
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
      ],
      totalVotes: 0,
      myVote: null,
    },
    comfortCheck: {
      title: "What would make this comfortable?",
      body: "Tap what helps. The room can shape plans around it.",
      options: [
        { id: "quiet_pace", label: "Quiet pace", count: 0 },
        { id: "easy_access", label: "Easy access", count: 1 },
        { id: "seating", label: "Place to sit", count: 0 },
        { id: "transport_help", label: "Transport help", count: 0 },
      ],
      myComfortNeeds: [],
      totalResponses: 1,
    },
    discussionPrompt: {
      id: "gentle-start",
      title: "What would you like to say?",
      body: "You can start small.",
      starterButtons: ["Say hello", "Suggest a plan", "Ask VYVA"],
    },
    safety: {
      title: "Safe small circle",
      body: "VYVA keeps the tone kind.",
      consentLine: "Contact is shared only when both people agree.",
      helpLabel: "Help or safety",
    },
    notifications: [],
  },
};

describe("TogetherRoomScreen", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })));
  });

  it("renders the simple safe-haven hierarchy", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Together Room" })).toBeInTheDocument();
    expect(screen.getAllByText("Protected room").length).toBeGreaterThan(0);
    expect(screen.getByTestId("together-main-hero")).toBeInTheDocument();
    expect(screen.getByTestId("together-room-visual-summary")).toHaveTextContent("3 present");
    expect(screen.getByTestId("together-room-visual-summary")).toHaveTextContent("Share a plan");
    expect(screen.getByTestId("together-member-orbit")).toHaveTextContent("Carmen");
    expect(screen.getByText("Carmen")).toBeInTheDocument();
    expect(screen.getByText("Luis")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Our room promise")).toBeInTheDocument();
    expect(screen.getByText("Use kind words and no pressure.")).toBeInTheDocument();
    expect(screen.getByText("Share views without judging.")).toBeInTheDocument();
    expect(screen.getByText("Ask VYVA if something feels wrong.")).toBeInTheDocument();
    expect(screen.getByTestId("together-acknowledge-agreement")).toHaveTextContent("I understand");
    expect(screen.getByText("Tea and film chat")).toBeInTheDocument();
    expect(screen.getByTestId("together-plan-location-tea-film-chat")).toHaveTextContent("Online");
    expect(screen.getByTestId("together-plan-comfort-tea-film-chat")).toHaveTextContent("Quiet pace");
    expect(screen.getByTestId("together-plan-visual-stats-tea-film-chat")).toHaveTextContent("Movie date");
    expect(screen.getByTestId("together-plan-visual-stats-tea-film-chat")).toHaveTextContent("Evening");
    expect(screen.getByTestId("together-plan-location-quiet-lunch")).toHaveTextContent("Nearby");
    expect(screen.getByTestId("together-plan-comfort-quiet-lunch")).toHaveTextContent("Easy access");
    expect(screen.getByTestId("together-plan-comfort-quiet-lunch")).toHaveTextContent("Place to sit");
    expect(screen.getByTestId("together-plan-fit-quiet-lunch")).toHaveTextContent("Restaurant date");
    expect(screen.getByText("You can be first to choose.")).toBeInTheDocument();
    expect(screen.queryByTestId("together-plan-loop-tea-film-chat")).not.toBeInTheDocument();
    expect(screen.getByText("What would feel good to share today?")).toBeInTheDocument();
    expect(screen.getByText("Your vote helps choose the next step.")).toBeInTheDocument();
    expect(screen.getByTestId("together-comfort-check")).toHaveTextContent("What would make this comfortable?");
    expect(screen.getByTestId("together-comfort-check-easy_access")).toHaveTextContent("1 chose this");
    expect(screen.queryByTestId("together-room-direction")).not.toBeInTheDocument();
    expect(screen.queryByTestId("together-use-room-direction")).not.toBeInTheDocument();
    expect(screen.getByTestId("together-share-plan-entry")).toHaveTextContent("Share a plan");
    expect(screen.getByRole("heading", { name: "Share a plan" })).toBeInTheDocument();
    expect(screen.getByText("Suggest one simple idea so others can join or say maybe.")).toBeInTheDocument();
    expect(screen.getAllByTestId(/together-starter-/)).toHaveLength(1);
    expect(screen.getByTestId("together-starter-plan")).toHaveTextContent("Share a plan");
    expect(screen.queryByTestId("together-starter-hello")).not.toBeInTheDocument();
    expect(screen.queryByTestId("together-starter-view")).not.toBeInTheDocument();
    expect(screen.queryByTestId("together-starter-ask")).not.toBeInTheDocument();
    expect(screen.getAllByText("Contact is shared only when both people agree.").length).toBeGreaterThan(0);
  });

  it("uses extended language labels inside the Together Room", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="fr" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getAllByText("Salle protegee").length).toBeGreaterThan(0);
    expect(screen.getByText("Notre promesse de salle")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Partager un plan" })).toBeInTheDocument();
    expect(screen.getByTestId("together-starter-plan")).toHaveTextContent("Partager un plan");

    fireEvent.click(screen.getByTestId("together-starter-plan"));

    expect(screen.getByText("Commencer avec une idee")).toBeInTheDocument();
    expect(screen.getByTestId("together-plan-preset-quiet_lunch")).toHaveTextContent("Dejeuner calme a proximite");
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
    expect(screen.queryByText("Room promise saved")).not.toBeInTheDocument();
  });

  it("hides the room promise when the current user already acknowledged it", () => {
    const acknowledgedResponse: SocialRoomResponse = {
      ...roomResponse,
      pulse: {
        ...roomResponse.pulse!,
        safety: {
          ...roomResponse.pulse!.safety,
          myAcknowledgedAt: "2026-06-04T10:15:00.000Z",
        },
      },
    };

    render(<TogetherRoomScreen roomResponse={acknowledgedResponse} language="en" visitId="visit-2" onBack={vi.fn()} />);

    expect(screen.queryByTestId("together-room-promise")).not.toBeInTheDocument();
    expect(screen.queryByTestId("together-acknowledge-agreement")).not.toBeInTheDocument();
    expect(screen.queryByText("Our room promise")).not.toBeInTheDocument();
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
  });

  it("shows poll results without a second plan shortcut", () => {
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

    expect(screen.getByTestId("together-poll-next-step")).toHaveTextContent("The room is leaning toward: Film chat.");
    expect(screen.getByTestId("together-poll-next-step")).toHaveTextContent(
      "You can join the plan above or suggest a gentler version.",
    );
    expect(screen.queryByTestId("together-room-direction")).not.toBeInTheDocument();
    expect(screen.queryByTestId("together-use-room-direction")).not.toBeInTheDocument();
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
            comfortNeeds: ["easy_access", "seating", "quiet_pace", "transport_help"],
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
    expect(screen.getByTestId("together-plan-loop-tea-film-chat")).toHaveTextContent("Next step");
    expect(screen.getByTestId("together-plan-loop-step-tea-film-chat-1")).toHaveTextContent("Choosing time");
    expect(screen.getByTestId("together-plan-location-experience-1")).toHaveTextContent("Nearby");
    expect(screen.getByTestId("together-plan-comfort-experience-1")).toHaveTextContent("Quiet pace");
    expect(screen.getByTestId("together-plan-comfort-experience-1")).toHaveTextContent("Easy access");
    expect(screen.getByTestId("together-plan-fit-experience-1")).toHaveTextContent("Restaurant date");
    expect(screen.getByTestId("together-plan-fit-experience-1")).toHaveTextContent("Shared");
    expect(screen.getByTestId("together-plan-review-experience-1")).toHaveTextContent("VYVA reviews before the next step");
    expect(screen.getByTestId("together-plan-review-experience-1")).toHaveTextContent("money");
    expect(screen.getByTestId("together-shared-response-summary-experience-1")).toHaveTextContent("1 joining | 2 maybe");
    expect(screen.getByTestId("together-plan-loop-experience-1")).toHaveTextContent("Plan status");
    expect(screen.getByTestId("together-gentle-replies-experience-1")).toHaveTextContent("Gentle replies");
    expect(screen.getByTestId("together-reply-reply-1")).toHaveTextContent("I feel the same");
  });

  it("opens a next-step loop after joining and stores the step as a gentle reply", async () => {
    const joinedPulse = {
      ...roomResponse.pulse!,
      featuredPlan: {
        ...roomResponse.pulse!.featuredPlan,
        myResponse: "join" as const,
        responseCounts: { join: 1, maybe: 0 },
      },
    };
    apiFetchMock
      .mockResolvedValueOnce(jsonResponse({ ok: true, pulse: joinedPulse }))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        pulse: {
          ...joinedPulse,
          featuredPlan: {
            ...joinedPulse.featuredPlan,
            replies: [
              {
                id: "reply-loop-1",
                planKey: "tea-film-chat",
                authorName: "Member",
                body: "I would like to pick a simple time for this plan.",
                tone: "help",
                status: "active",
                createdAt: "2026-06-04T10:06:00.000Z",
              },
            ],
          },
        },
      }));

    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-join-plan"));

    await waitFor(() => {
      expect(screen.getByTestId("together-plan-loop-tea-film-chat")).toHaveTextContent("Next step");
    });
    expect(screen.getByTestId("together-plan-loop-step-tea-film-chat-1")).toHaveTextContent("Choosing time");

    fireEvent.click(screen.getByTestId("together-plan-loop-time-tea-film-chat"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/plans/tea-film-chat/replies",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"tone":"help"'),
        }),
      );
    });
    const replyBody = JSON.parse(String(apiFetchMock.mock.calls[1][1]?.body));
    expect(replyBody.body).toBe("I would like to pick a simple time for this plan.");
    expect(screen.getByTestId("together-plan-loop-step-tea-film-chat-2")).toHaveTextContent("Confirmed");
  });

  it("supports join, maybe, vote, starter, and safety actions", async () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-join-plan"));
    expect(screen.getAllByText("You joined").length).toBeGreaterThan(0);
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
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/safety-reports",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"reason":"help_requested"'),
        }),
      );
    });
  });

  it("lets members add concrete help to the featured plan", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      pulse: {
        ...roomResponse.pulse!,
        featuredPlan: {
          ...roomResponse.pulse!.featuredPlan,
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
    expect(screen.getByTestId("together-plan-collaboration-choose")).toHaveTextContent("Help choose");

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
            comfortNeeds: ["easy_access", "seating", "quiet_pace", "transport_help"],
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
    expect(screen.getByText("Start with one idea")).toBeInTheDocument();
    expect(screen.getByText("You can change anything before posting.")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("together-plan-preset-quiet_lunch"));
    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "I would like to suggest a quiet lunch nearby, somewhere accessible with time to talk.",
    );
    expect(screen.getByText("What kind of experience?")).toBeInTheDocument();
    expect(screen.getByTestId("together-proposal-category-restaurant_date")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("What would fit best?")).toBeInTheDocument();
    expect(screen.getByTestId("together-proposal-location-nearby")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-proposal-location-online")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("together-proposal-time-afternoon")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-proposal-cost-shared")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-proposal-group-small_group")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("What would help?")).toBeInTheDocument();
    expect(screen.getByTestId("together-comfort-quiet_pace")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-comfort-easy_access")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-comfort-seating")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("together-comfort-transport_help"));
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
      comfortNeeds: ["easy_access", "seating", "quiet_pace", "transport_help"],
      experienceCategory: "restaurant_date",
      preferredTime: "afternoon",
      costRange: "shared",
      groupSize: "small_group",
    });
    expect(screen.getByText("Shared. Others can join or say maybe.")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Write one small idea...")).not.toBeInTheDocument();
    expect(screen.getByTestId("together-shared-today")).toBeInTheDocument();
    expect(screen.getByText("Tea at a quiet cafe")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("together-plan-comfort-experience-1")).toHaveTextContent("Easy access");
      expect(screen.getByTestId("together-plan-comfort-experience-1")).toHaveTextContent("Place to sit");
      expect(screen.getByTestId("together-plan-comfort-experience-1")).toHaveTextContent("Transport help");
    });
    expect(screen.getByTestId("together-plan-fit-experience-1")).toHaveTextContent("Restaurant date");
  });

  it("warns gently before posting sensitive service or deal ideas", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("together-starter-plan"));
    fireEvent.click(screen.getByTestId("together-plan-preset-service_deal"));

    expect(screen.getByPlaceholderText("Write one small idea...")).toHaveValue(
      "I would like to compare a service or deal with someone before deciding.",
    );
    expect(screen.getByTestId("together-proposal-category-deal_help")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("together-proposal-review-note")).toHaveTextContent("VYVA will review this first");
    expect(screen.getByTestId("together-proposal-review-note")).toHaveTextContent("money");
  });

  it.each([
    {
      composerLanguage: "fr",
      shareAction: "Partager un plan",
      presetTitle: "Comparer un service ou une offre",
      placeholder: "Ecrivez une petite idee...",
      draft: "J'aimerais comparer un service ou une offre avec quelqu'un avant de decider.",
      reviewTitle: "VYVA verifiera d'abord",
      reviewReason: "argent",
    },
    {
      composerLanguage: "it",
      shareAction: "Condividi un piano",
      presetTitle: "Confrontare servizio o offerta",
      placeholder: "Scrivi una piccola idea...",
      draft: "Vorrei confrontare un servizio o un'offerta con qualcuno prima di decidere.",
      reviewTitle: "VYVA lo controllera prima",
      reviewReason: "denaro",
    },
    {
      composerLanguage: "pt",
      shareAction: "Partilhar um plano",
      presetTitle: "Comparar servico ou oferta",
      placeholder: "Escreva uma pequena ideia...",
      draft: "Gostaria de comparar um servico ou uma oferta com alguem antes de decidir.",
      reviewTitle: "VYVA vai rever primeiro",
      reviewReason: "dinheiro",
    },
  ] as const)("localizes the guided plan composer for $composerLanguage", ({
    composerLanguage,
    shareAction,
    presetTitle,
    placeholder,
    draft,
    reviewTitle,
    reviewReason,
  }) => {
    render(
      <TogetherRoomScreen
        roomResponse={roomResponse}
        language="en"
        composerLanguage={composerLanguage}
        visitId="visit-1"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByTestId("together-starter-plan")).toHaveTextContent(shareAction);

    fireEvent.click(screen.getByTestId("together-starter-plan"));
    expect(screen.getByText(presetTitle)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("together-plan-preset-service_deal"));

    expect(screen.getByPlaceholderText(placeholder)).toHaveValue(draft);
    expect(screen.getByTestId("together-proposal-review-note")).toHaveTextContent(reviewTitle);
    expect(screen.getByTestId("together-proposal-review-note")).toHaveTextContent(reviewReason);
  });

  it("keeps the starter card focused on sharing a plan", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getAllByTestId(/together-starter-/)).toHaveLength(1);
    expect(screen.getByTestId("together-starter-plan")).toHaveTextContent("Share a plan");
    expect(screen.queryByTestId("together-starter-hello")).not.toBeInTheDocument();
    expect(screen.queryByTestId("together-starter-view")).not.toBeInTheDocument();
    expect(screen.queryByTestId("together-starter-ask")).not.toBeInTheDocument();
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
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.queryByTestId("together-plan-location-experience-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("together-plan-comfort-experience-1")).not.toBeInTheDocument();
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
    expect(screen.getByTestId("together-reply-different-experience-1")).toHaveTextContent("Another view");

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

    expect(screen.getByTestId("together-review-reply-reply-1")).toHaveTextContent("Review reply");

    fireEvent.click(screen.getByTestId("together-review-reply-reply-1"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/safety-reports",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"targetType":"reply"'),
        }),
      );
    });
    const body = String(apiFetchMock.mock.calls[0][1]?.body);
    expect(body).toContain('"reason":"reply_review"');
    expect(body).toContain('"targetId":"reply-1"');
    expect(body).toContain("That sounds gentle.");
    expect(screen.getByText("VYVA will review this item gently.")).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Ask VYVA to review: Can VYVA help me choose?" }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/together-room/safety-reports",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"reason":"shared_item_review"'),
        }),
      );
    });
    const body = String(apiFetchMock.mock.calls[0][1]?.body);
    expect(body).toContain('"targetType":"question"');
    expect(body).toContain('"targetId":"experience-question-1"');
    expect(screen.getByText("VYVA will review this item gently.")).toBeInTheDocument();
  });

  it("does not expose Ask VYVA inside the plan-focused starter card", () => {
    render(<TogetherRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.queryByTestId("together-starter-ask")).not.toBeInTheDocument();
    expect(screen.getByTestId("together-starter-plan")).toHaveTextContent("Share a plan");
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

    fireEvent.click(screen.getByTestId("together-vote-film"));
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
