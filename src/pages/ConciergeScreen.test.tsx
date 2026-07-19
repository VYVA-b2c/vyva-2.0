import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps, ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConciergeScreen, { type ConciergeScreenMode } from "./ConciergeScreen";
import { apiFetch } from "@/lib/queryClient";
import { CONCIERGE_FLOW_REFERENCES } from "../../shared/conciergeFlowRegistry";
import { CONCIERGE_DRY_RUN_FIXTURES } from "../../shared/conciergeDryRun";
import { buildConciergeProviderReplyResolution } from "../../shared/conciergeProviderReplyResolution";
import {
  emitVoiceCanvasResponse,
  VYVA_VOICE_CANVAS_CLEAR_EVENT,
  VYVA_VOICE_CANVAS_PRESENT_EVENT,
  type VoiceCanvasSceneEnvelope,
} from "@/lib/voiceCanvasBridge";

const voiceHeroMock = vi.hoisted(() => vi.fn());
const voiceActionMock = vi.hoisted(() => ({
  action: null as null | {
    id: string;
    actionType?: string;
    domain: string;
    route: string;
    title: string;
    summary: string;
    cue: string;
    sourceText: string;
    priority: "high" | "medium" | "low";
    extractedSubject?: string;
    feedbackReason: string;
    payload?: Record<string, string | number | boolean>;
  },
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/components/VoiceHero", () => ({
  default: (props: { autoStartVoice?: boolean | string; sourceText?: ReactNode; headline?: ReactNode; subtitle?: ReactNode; voiceAgentSlug?: string }) => {
    voiceHeroMock(props);
    return (
      <div data-testid="voice-hero">
        <span>{props.sourceText}</span>
        <span>{props.headline}</span>
        <span>{props.subtitle}</span>
      </div>
    );
  },
}));

vi.mock("@/components/VyvaSessionCta", () => ({
  default: ({ label, testId, className }: { label?: string; testId?: string; className?: string }) => (
    <button type="button" data-testid={testId} className={className}>
      {label}
    </button>
  ),
}));

vi.mock("@/components/VoiceActionFulfillmentPanel", () => ({
  default: () => <div data-testid="voice-action-fulfillment-panel" />,
}));

vi.mock("@/hooks/useRouteVoiceAutoStart", () => ({
  useRouteVoiceAutoStart: () => false,
}));

vi.mock("@/hooks/useVoiceActionFulfillment", () => ({
  useVoiceActionFulfillment: () => ({
    action: voiceActionMock.action,
    payloadValue: (key: string) => {
      const value = voiceActionMock.action?.payload?.[key];
      return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
    },
  }),
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    language: "en",
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({
    i18n: { language: "en" },
    t: (_key: string, fallback?: string | { defaultValue?: string }) => (
      typeof fallback === "string" ? fallback : fallback?.defaultValue ?? _key
    ),
  }),
}));

const apiFetchMock = vi.mocked(apiFetch);
const HOME_SERVICE_GUIDE_STORAGE_KEY = "vyva_concierge_home_service_guide_hidden_v1";

async function dismissHomeServiceGuide() {
  fireEvent.click(await screen.findByTestId("button-home-service-guide-understood"));
  await waitFor(() => {
    expect(screen.queryByTestId("modal-home-service-guide")).not.toBeInTheDocument();
  });
}

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <span data-testid="location-path">{location.pathname}</span>
      <span data-testid="location-search">{location.search}</span>
      <span data-testid="route-state">{JSON.stringify(location.state)}</span>
    </>
  );
}

function RoutedConciergeRoutes() {
  return (
    <Routes>
      <Route path="/concierge" element={<ConciergeScreen mode="home" />} />
      <Route path="/concierge/task/:taskId" element={<ConciergeScreen mode="task" />} />
    </Routes>
  );
}

function cloneJsonBody(body: unknown) {
  return JSON.parse(JSON.stringify(body)) as unknown;
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  const status = init.status ?? 200;
  const headers = new Headers(init.headers ?? { "Content-Type": "application/json" });
  const response = {
    ok: status >= 200 && status < 300,
    status,
    headers,
    bodyUsed: false,
    json: vi.fn(async () => cloneJsonBody(body)),
    text: vi.fn(async () => JSON.stringify(body)),
    clone: () => jsonResponse(body, init),
  };
  return response as unknown as Response;
}

function errorResponse(status: number, body: unknown) {
  return jsonResponse(body, { status });
}

function liveReadyExecutionTask(
  tool: "phone_call" | "email" | "whatsapp" | "booking_link",
  overrides: Record<string, unknown> = {},
) {
  const channel = tool === "booking_link" ? "form_application" : tool;
  const label = tool === "phone_call"
    ? "Phone calls"
    : tool === "booking_link"
      ? "Forms / applications"
      : tool === "email"
        ? "Email"
        : "WhatsApp";
  return {
    version: 1,
    flow_reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
    action_type: tool === "phone_call" ? "phone_call" : tool === "booking_link" ? "booking_link" : "message",
    requested_tool: tool,
    active_tool: tool,
    lifecycle_status: "confirmed",
    provider_ready: true,
    missing_requirements: [],
    confirmation_required: true,
    user_confirmed: true,
    external_action_allowed: true,
    execution_mode: "live",
    channel_readiness: {
      version: 1,
      tool,
      channel,
      label,
      status: "ready",
      ready: true,
      admin_enabled: true,
      configured: true,
      verified: true,
      dry_run: false,
      external_action_allowed: true,
      blockers: [],
    },
    created_at: "2026-07-14T10:00:00.000Z",
    updated_at: "2026-07-14T10:01:00.000Z",
    ...overrides,
  };
}

function renderScreen(
  initialEntries: ComponentProps<typeof MemoryRouter>["initialEntries"] = ["/concierge"],
  mode: ConciergeScreenMode | "route" = "legacy",
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const renderTree = () => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={initialEntries}>
        <LocationProbe />
        {mode === "route"
          ? <RoutedConciergeRoutes />
          : mode === "task"
            ? (
                <Routes>
                  <Route path="/concierge/task/:taskId" element={<ConciergeScreen mode="task" />} />
                </Routes>
              )
            : <ConciergeScreen mode={mode} />}
      </MemoryRouter>
    </QueryClientProvider>
  );
  const result = render(renderTree());
  return Object.assign(result, { rerenderScreen: () => result.rerender(renderTree()) });
}

function showBookRideFastHelp() {
  screen.getByTestId("button-concierge-fast-home-service");
  act(() => {
    vi.advanceTimersByTime(9000);
  });
  return screen.getByTestId("button-concierge-fast-book-ride");
}

function showOrderGroceriesFastHelp() {
  screen.getByTestId("button-concierge-fast-home-service");
  act(() => {
    vi.advanceTimersByTime(9000);
  });
  return screen.getByTestId("button-concierge-fast-order-groceries");
}

function showOtcPharmacyFastHelp() {
  screen.getByTestId("button-concierge-fast-home-service");
  act(() => {
    vi.advanceTimersByTime(18000);
  });
  return screen.getByTestId("button-concierge-fast-otc-pharmacy");
}

function showFindCareFastHelp() {
  screen.getByTestId("button-concierge-fast-home-service");
  act(() => {
    vi.advanceTimersByTime(18000);
  });
  return screen.getByTestId("button-concierge-fast-find-care");
}

function showScamCheckFastHelp() {
  screen.getByTestId("button-concierge-fast-home-service");
  act(() => {
    vi.advanceTimersByTime(9000);
  });
  return screen.getByTestId("button-concierge-fast-check-scam");
}

function showBookMedicalFastHelp() {
  screen.getByTestId("button-concierge-fast-home-service");
  act(() => {
    vi.advanceTimersByTime(27000);
  });
  return screen.getByTestId("button-concierge-fast-book-medical");
}

afterEach(() => {
  vi.useRealTimers();
  apiFetchMock.mockReset();
  voiceHeroMock.mockClear();
  voiceActionMock.action = null;
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("ConciergeScreen task navigation", () => {
  const savedTaskId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const pendingTask = {
    id: "task-1",
    use_case: "book_appointment",
    provider_name: "Harbour Clinic",
    provider_phone: "+34 600 111 222",
    requested_tool: "email",
    active_tool: "email",
    action_summary: "Email Harbour Clinic to ask for an appointment.",
    action_payload: {},
    status: "pending" as const,
    language: "en",
  };

  function mockConciergeLists(pending = [pendingTask], completed: unknown[] = [], tasks: Array<Record<string, unknown>> = []) {
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target === "/api/concierge/actions/pending") return jsonResponse({ items: pending });
      if (target === "/api/concierge/actions/sessions") return jsonResponse({ items: completed });
      if (target === "/api/profile") return jsonResponse({ savedProviders: [], serviceReadiness: {} });
      if (target === "/api/concierge/tasks" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { entry: Record<string, unknown>; language: string };
        return jsonResponse({ task: {
          id: savedTaskId,
          user_id: "user-1",
          kind: body.entry.kind,
          entry_payload: body.entry,
          progress_payload: {},
          stage: "details",
          status: "active",
          linked_pending_id: null,
          language: body.language,
          created_at: "2026-07-18T12:00:00.000Z",
          updated_at: "2026-07-18T12:00:00.000Z",
          completed_at: null,
          deleted_at: null,
        } });
      }
      if (target === "/api/concierge/tasks") return jsonResponse({ items: tasks });
      if (target.startsWith("/api/concierge/tasks/") && init?.method === "PATCH") {
        const current = tasks.find((task) => task.id === target.split("/").pop());
        const body = JSON.parse(String(init.body)) as { progress: Record<string, unknown>; stage: string };
        return jsonResponse({ task: {
          ...(current ?? tasks[0] ?? {}),
          id: target.split("/").pop(),
          progress_payload: body.progress,
          stage: body.stage,
        } });
      }
      if (target.startsWith("/api/concierge/tasks/")) {
        const current = tasks.find((task) => task.id === target.split("/").pop());
        return current ? jsonResponse({ task: current }) : errorResponse(404, { error: "not found" });
      }
      return jsonResponse({ items: [] });
    });
  }

  it("keeps the production home focused on starting and resuming tasks", async () => {
    mockConciergeLists();
    renderScreen(["/concierge"], "home");

    expect(await screen.findByTestId("concierge-home-task-overview")).toBeInTheDocument();
    expect(screen.queryByTestId("section-concierge-active-task")).not.toBeInTheDocument();
    expect(screen.getByTestId("concierge-master-hero")).toBeInTheDocument();

    fireEvent.click(await screen.findByTestId("button-concierge-continue-task"));
    expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge/tasks/pending%3Atask-1");
  });

  it("shows only the provider task that needs the user's next action", async () => {
    const waitingTaskId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const replyTaskId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    mockConciergeLists([
      {
        ...pendingTask,
        id: "pending-waiting",
        action_payload: {
          provider_task_status: "waiting",
          waiting_for_provider: true,
          provider_last_contact_summary: "Waiting for Harbour Clinic.",
        },
      },
      {
        ...pendingTask,
        id: "pending-reply",
        action_payload: {
          provider_task_status: "action_needed",
          provider_reply_status: "needs_more_info",
          provider_reply: "Please confirm your insurance plan.",
        },
      },
    ], [], [
      {
        id: waitingTaskId,
        kind: "appointment",
        entry_payload: { kind: "appointment", appointmentKind: "medical" },
        progress_payload: {},
        stage: "review",
        status: "active",
        linked_pending_id: "pending-waiting",
      },
      {
        id: replyTaskId,
        kind: "appointment",
        entry_payload: { kind: "appointment", appointmentKind: "medical" },
        progress_payload: {},
        stage: "review",
        status: "active",
        linked_pending_id: "pending-reply",
      },
    ]);
    renderScreen(["/concierge"], "home");

    expect(await screen.findByTestId("concierge-home-task-status")).toHaveTextContent("Action needed");
    expect(screen.getByTestId("concierge-home-active-task")).toHaveTextContent("Please confirm your insurance plan.");
    expect(screen.getAllByTestId("concierge-home-active-task")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Respond" }));
    expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge/tasks/pending%3Apending-reply");
  });

  it("opens a selected home workflow after the route changes without requiring a remount", async () => {
    mockConciergeLists([]);
    renderScreen(["/concierge"], "route");

    fireEvent.click(await screen.findByTestId("button-concierge-fast-fill-form"));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(`/concierge/task/${savedTaskId}`);
    });
    expect(await screen.findByTestId("concierge-task-workspace")).toHaveAttribute("data-task-stage", "details");
    expect(await screen.findByTestId("panel-insurance-admin")).toBeInTheDocument();
    expect(screen.queryByTestId("concierge-master-hero")).not.toBeInTheDocument();
  });

  it.each([
    ["document", { kind: "document" }, "panel-insurance-admin"],
    ["appointment", { kind: "appointment", appointmentKind: "medical" }, "panel-appointment-assistant"],
    ["home service", { kind: "home_service" }, "panel-appointment-assistant"],
    ["provider contact", { kind: "provider_contact", providerSearchMode: "specialist", query: "find a specialist" }, "panel-offers-search"],
  ])("opens the reusable %s task workspace", async (_label, conciergeTaskEntry, expectedPanel) => {
    mockConciergeLists([]);
    localStorage.setItem(HOME_SERVICE_GUIDE_STORAGE_KEY, "true");
    renderScreen([{
      pathname: "/concierge/task/new",
      state: { conciergeTaskEntry },
    }], "task");

    expect(await screen.findByTestId("concierge-task-workspace")).toHaveAttribute("data-task-stage", "details");
    expect(screen.queryByTestId("concierge-master-hero")).not.toBeInTheDocument();
    expect(await screen.findByTestId(expectedPanel)).toBeInTheDocument();
  });

  it("uses the confirmation stage for an unconfirmed active task", async () => {
    mockConciergeLists();
    renderScreen(["/concierge/task/task-1"], "task");

    await waitFor(() => {
      expect(screen.getByTestId("concierge-task-workspace")).toHaveAttribute("data-task-stage", "confirmation");
    });
    expect(screen.getByTestId("concierge-task-confirmation-screen")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Task progress" })).getByText("Confirm")).toHaveAttribute("aria-current", "step");
    expect(screen.queryByTestId("concierge-master-hero")).not.toBeInTheDocument();
  });

  it("opens the newest saved task in My Tasks before continuing", async () => {
    const savedTask = {
      id: savedTaskId,
      user_id: "user-1",
      kind: "document",
      entry_payload: { kind: "document", documentKind: "claim" },
      progress_payload: {
        documentKind: "claim",
        documentDetails: { subject: "Roof claim", recipient: "Insurer", deadline: "Friday", notes: "Photos ready" },
      },
      stage: "review",
      status: "active",
      linked_pending_id: null,
      language: "en",
      created_at: "2026-07-18T12:00:00.000Z",
      updated_at: "2026-07-18T12:05:00.000Z",
      completed_at: null,
      deleted_at: null,
    };
    mockConciergeLists([], [], [savedTask]);
    renderScreen(["/concierge"], "route");

    fireEvent.click(await screen.findByTestId("button-concierge-continue-task"));
    expect(screen.getByTestId("location-path")).toHaveTextContent(`/concierge/tasks/draft%3A${savedTaskId}`);
  });

  it.each([
    ["appointment", { appointmentType: "medical", note: "Annual check", requestedTime: "Tuesday morning" }, "input-appointment-note", "Annual check"],
    ["provider_contact", { providerSearchMode: "specialist", query: "dermatologist nearby", criteria: ["nearby"] }, "input-offers-query", "dermatologist nearby"],
  ])("restores saved %s progress after refresh", async (kind, progress, fieldTestId, expectedValue) => {
    const savedTask = {
      id: savedTaskId,
      user_id: "user-1",
      kind,
      entry_payload: { kind },
      progress_payload: progress,
      stage: "details",
      status: "active",
      linked_pending_id: null,
      language: "en",
      created_at: "2026-07-18T12:00:00.000Z",
      updated_at: "2026-07-18T12:05:00.000Z",
      completed_at: null,
      deleted_at: null,
    };
    mockConciergeLists([], [], [savedTask]);
    localStorage.setItem(HOME_SERVICE_GUIDE_STORAGE_KEY, "true");
    renderScreen([`/concierge/task/${savedTaskId}`], "task");

    expect(await screen.findByTestId(fieldTestId)).toHaveValue(expectedValue);
    expect(screen.getByTestId("concierge-task-workspace")).toHaveAttribute("data-task-stage", "details");
  });

  it("restores saved home-service answers after refresh", async () => {
    const savedTask = {
      id: savedTaskId,
      user_id: "user-1",
      kind: "home_service",
      entry_payload: { kind: "home_service" },
      progress_payload: {
        appointmentType: "home-service",
        note: "Leaking tap",
        serviceType: "plumber",
        answers: { problem_summary: "Leaking tap" },
        textDrafts: { problem_summary: "Leaking tap" },
      },
      stage: "details",
      status: "active",
      linked_pending_id: null,
      language: "en",
      created_at: "2026-07-18T12:00:00.000Z",
      updated_at: "2026-07-18T12:05:00.000Z",
      completed_at: null,
      deleted_at: null,
    };
    mockConciergeLists([], [], [savedTask]);
    localStorage.setItem(HOME_SERVICE_GUIDE_STORAGE_KEY, "true");
    renderScreen([`/concierge/task/${savedTaskId}`], "task");

    expect(await screen.findByTestId("panel-home-service-intake")).toHaveTextContent("Plumber");
    expect(screen.getByTestId("panel-home-service-question")).toBeInTheDocument();
  });

  it("restores a saved ride Canvas draft to the exact review scene", async () => {
    const savedTask = {
      id: savedTaskId,
      user_id: "user-1",
      kind: "transport",
      entry_payload: { kind: "transport" },
      progress_payload: {
        canvasStep: "review",
        requestedTime: "Friday at 10",
        textDrafts: {
          transportPickup: "Saved home",
          transportDestination: "City Clinic",
        },
        answers: {
          transportMobilityNeeds: "Wheelchair space\nHelp at the door",
        },
      },
      stage: "review",
      status: "active",
      linked_pending_id: null,
      language: "en",
      created_at: "2026-07-18T12:00:00.000Z",
      updated_at: "2026-07-18T12:05:00.000Z",
      completed_at: null,
      deleted_at: null,
    };
    mockConciergeLists([], [], [savedTask]);
    const scenes: VoiceCanvasSceneEnvelope[] = [];
    const handleScene = (event: Event) => {
      if (event instanceof CustomEvent) scenes.push(event.detail as VoiceCanvasSceneEnvelope);
    };
    window.addEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);

    renderScreen([`/concierge/task/${savedTaskId}`], "task");

    const pickupInput = await screen.findByTestId("input-transport-pickup");
    expect(pickupInput).toHaveValue("Saved home");
    expect(screen.getByTestId("input-transport-destination")).toHaveValue("City Clinic");
    expect(screen.getByTestId("input-transport-time")).toHaveValue("Friday at 10");
    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "ride-review")).toBe(true));
    const reviewScene = [...scenes].reverse().find((scene) => scene.viewModel.sceneId === "ride-review")!;
    expect(reviewScene.viewModel.summaryRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "pickup", value: "Saved home" }),
      expect.objectContaining({ id: "destination", value: "City Clinic" }),
      expect.objectContaining({ id: "when", value: "Friday at 10" }),
      expect.objectContaining({ id: "mobility", value: "Wheelchair access" }),
    ]));
    expect(reviewScene.pendingId).toBeUndefined();
    window.removeEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
  });

  it("autosaves edited progress without confirmation state", async () => {
    const savedTask = {
      id: savedTaskId,
      user_id: "user-1",
      kind: "document",
      entry_payload: { kind: "document", documentKind: "claim" },
      progress_payload: {
        documentKind: "claim",
        documentDetails: { subject: "", recipient: "", deadline: "", notes: "" },
      },
      stage: "details",
      status: "active",
      linked_pending_id: null,
      language: "en",
      created_at: "2026-07-18T12:00:00.000Z",
      updated_at: "2026-07-18T12:00:00.000Z",
      completed_at: null,
      deleted_at: null,
    };
    mockConciergeLists([], [], [savedTask]);
    renderScreen([`/concierge/task/${savedTaskId}`], "task");
    fireEvent.change(await screen.findByTestId("input-insurance-admin-subject"), {
      target: { value: "Updated claim" },
    });

    await waitFor(() => {
      const saveCall = [...apiFetchMock.mock.calls].reverse().find(([url, init]) => (
        String(url) === `/api/concierge/tasks/${savedTaskId}`
        && init?.method === "PATCH"
        && String(init?.body).includes("Updated claim")
      ));
      expect(saveCall).toBeDefined();
      const body = JSON.parse(String(saveCall?.[1]?.body));
      expect(body).toMatchObject({
        stage: "details",
        progress: { documentDetails: { subject: "Updated claim" } },
      });
      expect(JSON.stringify(body)).not.toContain("confirm");
    }, { timeout: 2_000 });
  });

  it("requires fresh confirmation for a resumed provider action", async () => {
    const linkedPending = { ...pendingTask, id: "pending-action-1" };
    const savedTask = {
      id: savedTaskId,
      user_id: "user-1",
      kind: "appointment",
      entry_payload: { kind: "appointment", appointmentKind: "medical" },
      progress_payload: { appointmentType: "medical", note: "Follow-up" },
      stage: "review",
      status: "active",
      linked_pending_id: linkedPending.id,
      language: "en",
      created_at: "2026-07-18T12:00:00.000Z",
      updated_at: "2026-07-18T12:05:00.000Z",
      completed_at: null,
      deleted_at: null,
    };
    mockConciergeLists([linkedPending], [], [savedTask]);
    renderScreen([`/concierge/task/${savedTaskId}`], "task");

    await waitFor(() => {
      expect(screen.getByTestId("concierge-task-workspace")).toHaveAttribute("data-task-stage", "confirmation");
    });
    expect(screen.getByTestId("concierge-task-confirmation-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("modal-concierge-final-confirmation")).not.toBeInTheDocument();
  });

  it("redirects instead of reopening a completed or deleted task", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target === `/api/concierge/tasks/${savedTaskId}`) {
        return errorResponse(410, { error: "Task is no longer active", status: "deleted" });
      }
      if (target === "/api/concierge/tasks") return jsonResponse({ items: [] });
      if (target === "/api/profile") return jsonResponse({ savedProviders: [], serviceReadiness: {} });
      return jsonResponse({ items: [] });
    });
    renderScreen([`/concierge/task/${savedTaskId}`], "route");

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge");
    });
    expect(screen.queryByTestId("button-concierge-task-delete")).not.toBeInTheDocument();
  });
});

describe("ConciergeScreen action hub", () => {
  it("opens the ride Canvas from voice and ignores a late answer from the previous scene", async () => {
    voiceActionMock.action = {
      id: "voice-ride-canvas-1",
      actionType: "concierge.ride_booking",
      domain: "concierge",
      route: "/concierge",
      title: "Book a ride",
      summary: "Opening a ride",
      cue: "Ask for ride details",
      sourceText: "I need a ride",
      priority: "high",
      feedbackReason: "User requested transport",
      payload: {},
    };
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url) === "/api/profile") {
        return jsonResponse({
          savedProviders: [{ name: "Radio Taxi", role: "taxi", phone: "+34 600 111 222" }],
          serviceReadiness: { hasSavedTransportProvider: true, hasMobilityInfo: true },
        });
      }
      return jsonResponse({ items: [] });
    });
    const scenes: VoiceCanvasSceneEnvelope[] = [];
    const handleScene = (event: Event) => {
      if (event instanceof CustomEvent) scenes.push(event.detail as VoiceCanvasSceneEnvelope);
    };
    window.addEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);

    renderScreen();
    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "ride-destination")).toBe(true));
    const destinationScene = [...scenes].reverse().find((scene) => scene.viewModel.sceneId === "ride-destination")!;

    act(() => emitVoiceCanvasResponse({
      sceneId: destinationScene.viewModel.sceneId,
      revision: destinationScene.revision,
      kind: "text",
      utterance: "City Clinic",
      value: "City Clinic",
      at: "2026-07-18T10:00:00.000Z",
    }));

    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "ride-pickup")).toBe(true));
    expect(await screen.findByTestId("input-transport-destination")).toHaveValue("City Clinic");
    const sceneCount = scenes.length;

    act(() => emitVoiceCanvasResponse({
      sceneId: destinationScene.viewModel.sceneId,
      revision: destinationScene.revision,
      kind: "text",
      utterance: "Wrong late destination",
      value: "Wrong late destination",
      at: "2026-07-18T10:00:02.000Z",
    }));

    expect(screen.getByTestId("input-transport-destination")).toHaveValue("City Clinic");
    expect(scenes.slice(sceneCount).every((scene) => scene.viewModel.sceneId !== "ride-time")).toBe(true);
    window.removeEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
  });

  it("clears the ride Canvas when voice moves to another Concierge request", async () => {
    voiceActionMock.action = {
      id: "voice-ride-before-interruption",
      actionType: "concierge.ride_booking",
      domain: "concierge",
      route: "/concierge",
      title: "Book a ride",
      summary: "Opening a ride",
      cue: "Ask for ride details",
      sourceText: "I need a ride",
      priority: "high",
      feedbackReason: "User requested transport",
      payload: {},
    };
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));
    const scenes: VoiceCanvasSceneEnvelope[] = [];
    const clears: Array<{ owner?: string }> = [];
    const handleScene = (event: Event) => {
      if (event instanceof CustomEvent) scenes.push(event.detail as VoiceCanvasSceneEnvelope);
    };
    const handleClear = (event: Event) => {
      if (event instanceof CustomEvent) clears.push(event.detail as { owner?: string });
    };
    window.addEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
    window.addEventListener(VYVA_VOICE_CANVAS_CLEAR_EVENT, handleClear);
    const view = renderScreen();
    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "ride-destination")).toBe(true));

    voiceActionMock.action = {
      ...voiceActionMock.action,
      id: "voice-reminder-interruption",
      actionType: "concierge.reminder",
      title: "Set a reminder",
      sourceText: "Remind me to call Maria",
      feedbackReason: "User requested a reminder",
    } as NonNullable<typeof voiceActionMock.action>;
    view.rerenderScreen();

    await waitFor(() => expect(clears.some((detail) => detail.owner === "concierge_ride")).toBe(true));
    window.removeEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
    window.removeEventListener(VYVA_VOICE_CANVAS_CLEAR_EVENT, handleClear);
  });

  it("guides a Home Service voice request to an exact-sharing confirmation", async () => {
    voiceActionMock.action = {
      id: "voice-home-canvas-1",
      actionType: "concierge.home_service",
      domain: "concierge",
      route: "/concierge",
      title: "Home service help",
      summary: "Opening home service help",
      cue: "Ask what kind of home service is needed",
      sourceText: "I need help at home",
      priority: "high",
      feedbackReason: "User requested home service",
      payload: {},
    };
    let confirmedBody: Record<string, unknown> | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target === "/api/config/features/home-service-voice-canvas") return jsonResponse({ enabled: true, rolloutPercent: 100 });
      if (target === "/api/profile") {
        return jsonResponse({
          street: "10 Garden Lane",
          cityState: "Marbella",
          postalCode: "29602",
          country: "ES",
          savedProviders: [{
            name: "Trusted Plumber",
            role: "plumber",
            category: "home_service",
            email: "plumber@example.com",
            preferredChannel: "email",
          }],
        });
      }
      if (target === "/api/appointments/requests/active-home-service") {
        return jsonResponse({ request: null, options: [] });
      }
      if (target === "/api/appointments/requests") {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({ appointment_type: "home-service", draft: false });
        return jsonResponse({
          request: {
            id: "home-canvas-request-1",
            appointment_type: "home-service",
            reason_detail: body.detail,
            preferences: body.preferences,
            status: "options_ready",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [{
            id: "home-canvas-option-1",
            provider_source: "saved",
            provider_snapshot: {
              name: "Trusted Plumber",
              email: "plumber@example.com",
              preferred_channel: "email",
              availability: "Tomorrow morning",
              call_out_fee: "EUR 45",
            },
            match_reason: "Saved trusted provider",
            available_channels: ["email"],
            rank: 1,
            status: "recommended",
          }],
        });
      }
      if (target.endsWith("/confirm-attempt")) {
        confirmedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return jsonResponse({ pending: { pendingId: "home-canvas-pending-1", status: "pending" } });
      }
      return jsonResponse({ items: [] });
    });

    const scenes: VoiceCanvasSceneEnvelope[] = [];
    const handleScene = (event: Event) => {
      if (event instanceof CustomEvent) scenes.push(event.detail as VoiceCanvasSceneEnvelope);
    };
    const respond = async (sceneId: string, response: Partial<Parameters<typeof emitVoiceCanvasResponse>[0]>) => {
      const scene = [...scenes].reverse().find((item) => item.viewModel.sceneId === sceneId);
      expect(scene).toBeTruthy();
      act(() => emitVoiceCanvasResponse({
        sceneId,
        revision: scene!.revision,
        kind: "choice",
        utterance: "",
        at: "2026-07-18T10:00:00.000Z",
        ...response,
      }));
    };
    window.addEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
    renderScreen();

    await waitFor(() => expect(scenes.map((scene) => scene.viewModel.sceneId)).toContain("home-service-type"));
    await respond("home-service-type", { choiceId: "plumber", value: "Plumber", utterance: "Plumber" });
    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "home-service-description")).toBe(true));
    await respond("home-service-description", { kind: "text", value: "Water is leaking under the sink", utterance: "Water is leaking under the sink" });
    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "home-service-danger")).toBe(true));
    await respond("home-service-danger", { choiceId: "no", value: "No", utterance: "No" });
    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "home-service-safety")).toBe(true));
    await respond("home-service-safety", { choiceId: "no", value: "No", utterance: "No" });
    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "home-service-urgency")).toBe(true));
    await respond("home-service-urgency", { choiceId: "today", value: "Today", utterance: "Today" });
    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "home-service-time")).toBe(true));
    await respond("home-service-time", { kind: "text", value: "Tomorrow morning", utterance: "Tomorrow morning" });
    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "home-service-access")).toBe(true));
    await respond("home-service-access", { kind: "text", value: "Use the side entrance", utterance: "Use the side entrance" });
    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "home-service-location")).toBe(true));
    await respond("home-service-location", { choiceId: "saved_home", value: "Use my saved home", utterance: "Use my saved home" });
    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "home-service-provider")).toBe(true));
    await respond("home-service-provider", { choiceId: "saved_provider", value: "Trusted Plumber", utterance: "Trusted Plumber" });
    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "home-service-review")).toBe(true));

    const review = [...scenes].reverse().find((scene) => scene.viewModel.sceneId === "home-service-review")!;
    expect(review.viewModel.summaryRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "location", value: "10 Garden Lane, 29602 Marbella, ES" }),
      expect.objectContaining({ id: "provider", value: "Trusted Plumber" }),
      expect.objectContaining({ id: "photo", value: "No photo" }),
    ]));
    await respond("home-service-review", { kind: "primary", utterance: "Confirm and prepare contact" });
    await waitFor(() => expect(confirmedBody).not.toBeNull());
    expect(confirmedBody).toMatchObject({
      option_id: "home-canvas-option-1",
      channel: "email",
      share_details: { share_home_address: true },
    });
    expect((confirmedBody?.share_details as Record<string, unknown>).photo).toBeUndefined();
    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "home-service-completed")).toBe(true));
    window.removeEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
  });

  it("stops the Home Service Canvas when immediate danger is uncertain", async () => {
    voiceActionMock.action = {
      id: "voice-home-canvas-danger",
      actionType: "concierge.home_service",
      domain: "concierge",
      route: "/concierge",
      title: "Home service help",
      summary: "Opening home service help",
      cue: "Check safety first",
      sourceText: "I need an electrician",
      priority: "high",
      feedbackReason: "User requested home service",
      payload: { service_type: "electrician" },
    };
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url) === "/api/config/features/home-service-voice-canvas") return jsonResponse({ enabled: true, rolloutPercent: 100 });
      if (String(url) === "/api/appointments/requests/active-home-service") {
        return jsonResponse({ request: null, options: [] });
      }
      return jsonResponse({ items: [] });
    });
    const scenes: VoiceCanvasSceneEnvelope[] = [];
    const handleScene = (event: Event) => {
      if (event instanceof CustomEvent) scenes.push(event.detail as VoiceCanvasSceneEnvelope);
    };
    const respond = async (sceneId: string, response: Partial<Parameters<typeof emitVoiceCanvasResponse>[0]>) => {
      const scene = [...scenes].reverse().find((item) => item.viewModel.sceneId === sceneId);
      expect(scene).toBeTruthy();
      act(() => emitVoiceCanvasResponse({
        sceneId,
        revision: scene!.revision,
        kind: "choice",
        utterance: "",
        at: "2026-07-18T10:00:00.000Z",
        ...response,
      }));
    };
    window.addEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
    renderScreen();

    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "home-service-description")).toBe(true));
    await respond("home-service-description", { kind: "text", value: "There is a burning smell", utterance: "There is a burning smell" });
    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "home-service-danger")).toBe(true));
    await respond("home-service-danger", { choiceId: "not_sure", value: "I am not sure", utterance: "I am not sure" });

    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "home-service-emergency")).toBe(true));
    expect(scenes.some((scene) => scene.viewModel.sceneId === "home-service-urgency")).toBe(false);
    window.removeEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
  });

  it("restores an unfinished Home Service Canvas draft after a new session", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target === "/api/config/features/home-service-voice-canvas") return jsonResponse({ enabled: true, rolloutPercent: 100 });
      if (target === "/api/profile") {
        return jsonResponse({ street: "10 Garden Lane", savedProviders: [] });
      }
      if (target === "/api/appointments/requests/active-home-service") {
        return jsonResponse({
          request: {
            id: "home-draft-1",
            appointment_type: "home-service",
            reason_detail: "Cleaning help this week",
            status: "needs_provider",
            selected_provider_option_id: null,
            selected_channel: null,
            preferences: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.homeService,
              requested_time: "Friday morning",
              home_access_or_safety_notes: "No pets",
              photo_name: "room.jpg",
              home_address: "10 Garden Lane",
              service_intake: {
                version: "home-service-intake-v1",
                origin: "voice",
                service_type: "cleaner",
                urgency: "this_week",
                criteria: ["trusted"],
                answers: {
                  problem_summary: "Cleaning help this week",
                  immediate_danger: "no",
                  safety_check: "no",
                  urgency: "this_week",
                  home_address: "10 Garden Lane",
                },
                safety_flags: [],
                research_brief: "Cleaning help this week",
              },
            },
          },
          options: [],
        });
      }
      return jsonResponse({ items: [] });
    });
    const scenes: VoiceCanvasSceneEnvelope[] = [];
    const handleScene = (event: Event) => {
      if (event instanceof CustomEvent) scenes.push(event.detail as VoiceCanvasSceneEnvelope);
    };
    window.addEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
    renderScreen();

    await waitFor(() => expect(scenes.map((scene) => scene.viewModel.sceneId)).toContain("home-service-provider"));
    const providerScene = [...scenes].reverse().find((scene) => scene.viewModel.sceneId === "home-service-provider")!;
    expect(providerScene.viewModel.title).toBe("Who should VYVA check?");
    expect(screen.getByTestId("panel-appointment-assistant")).toBeVisible();
    window.removeEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
  });

  it("runs a saved medical appointment through coverage, availability, and final confirmation", async () => {
    voiceActionMock.action = {
      id: "voice-appointment-canvas-1",
      actionType: "concierge.appointment_help",
      domain: "concierge",
      route: "/concierge",
      title: "Book an appointment",
      summary: "Opening appointment help",
      cue: "Ask for appointment details",
      sourceText: "Book my annual check-up tomorrow morning",
      priority: "high",
      feedbackReason: "User requested a medical appointment",
      payload: {
        appointment_reason: "Annual check-up",
        date_preference: "Tomorrow morning",
      },
    };
    let contactAttempts = 0;
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target === "/api/profile") {
        return jsonResponse({
          savedProviders: [{ name: "Riverside Clinic", role: "doctor", category: "doctor_clinic", phone: "+34 600 111 222" }],
          coverage: { coverageType: "private", provider: "Health Plan", plan: "Senior Plus" },
          serviceReadiness: { hasSavedMedicalProvider: true, hasCoverageInfo: true },
        });
      }
      if (target === "/api/appointments/requests") {
        return jsonResponse({
          request: {
            id: "appointment-request-1",
            appointment_type: "medical",
            reason_detail: "Annual check-up",
            preferences: { date_preference: "Tomorrow morning" },
            status: "selecting_provider",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [{
            id: "appointment-option-1",
            provider_id: "provider-1",
            provider_source: "saved",
            provider_snapshot: {
              name: "Riverside Clinic",
              availability: "Tuesday at 10:00",
              preferred_channel: "phone",
            },
            match_reason: "Saved trusted provider",
            available_channels: ["phone"],
            rank: 1,
            status: "ready",
          }],
        });
      }
      if (target.endsWith("/confirm-attempt")) {
        contactAttempts += 1;
        return jsonResponse({ pending: { pendingId: "appointment-pending-1", status: "pending" } });
      }
      return jsonResponse({ items: [] });
    });

    const scenes: VoiceCanvasSceneEnvelope[] = [];
    const handleScene = (event: Event) => {
      if (event instanceof CustomEvent) scenes.push(event.detail as VoiceCanvasSceneEnvelope);
    };
    window.addEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
    renderScreen();

    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "appointment-coverage")).toBe(true));
    const coverageScene = [...scenes].reverse().find((scene) => scene.viewModel.sceneId === "appointment-coverage")!;
    act(() => emitVoiceCanvasResponse({
      sceneId: coverageScene.viewModel.sceneId,
      revision: coverageScene.revision,
      kind: "choice",
      choiceId: "saved",
      utterance: "Use saved coverage",
      value: "Use saved coverage",
      at: "2026-07-18T11:00:00.000Z",
    }));

    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "appointment-provider")).toBe(true));
    const providerScene = [...scenes].reverse().find((scene) => scene.viewModel.sceneId === "appointment-provider")!;

    act(() => emitVoiceCanvasResponse({
      sceneId: coverageScene.viewModel.sceneId,
      revision: coverageScene.revision,
      kind: "choice",
      choiceId: "private",
      utterance: "Private insurance",
      value: "Private insurance",
      at: "2026-07-18T11:00:01.000Z",
    }));
    expect(apiFetchMock.mock.calls.filter(([url]) => String(url) === "/api/appointments/requests")).toHaveLength(0);

    act(() => emitVoiceCanvasResponse({
      sceneId: providerScene.viewModel.sceneId,
      revision: providerScene.revision,
      kind: "choice",
      choiceId: "saved_provider",
      utterance: "Riverside Clinic",
      value: "Riverside Clinic",
      at: "2026-07-18T11:00:02.000Z",
    }));
    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "appointment-options")).toBe(true));
    const optionsScene = [...scenes].reverse().find((scene) => scene.viewModel.sceneId === "appointment-options")!;
    expect(optionsScene.viewModel.choices?.[0].description).toContain("Tuesday at 10:00");

    act(() => emitVoiceCanvasResponse({
      sceneId: optionsScene.viewModel.sceneId,
      revision: optionsScene.revision,
      kind: "choice",
      choiceId: "appointment-option-1",
      utterance: "Riverside Clinic",
      value: "Riverside Clinic",
      at: "2026-07-18T11:00:03.000Z",
    }));
    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "appointment-review")).toBe(true));
    expect(contactAttempts).toBe(0);

    const reviewScene = [...scenes].reverse().find((scene) => scene.viewModel.sceneId === "appointment-review")!;
    expect(reviewScene.viewModel.primaryAction?.label).toBe("Confirm and contact provider");
    act(() => emitVoiceCanvasResponse({
      sceneId: reviewScene.viewModel.sceneId,
      revision: reviewScene.revision,
      kind: "primary",
      utterance: "Confirm and contact provider",
      at: "2026-07-18T11:00:04.000Z",
    }));

    await waitFor(() => expect(contactAttempts).toBe(1));
    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "appointment-completed")).toBe(true));
    window.removeEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
  });

  it("clears the appointment Canvas when voice moves to another request", async () => {
    voiceActionMock.action = {
      id: "voice-appointment-before-interruption",
      actionType: "concierge.appointment_help",
      domain: "concierge",
      route: "/concierge",
      title: "Book an appointment",
      summary: "Opening appointment help",
      cue: "Ask for appointment details",
      sourceText: "I need a medical appointment",
      priority: "high",
      feedbackReason: "User requested an appointment",
      payload: {},
    };
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));
    const clears: Array<{ owner?: string }> = [];
    const handleClear = (event: Event) => {
      if (event instanceof CustomEvent) clears.push(event.detail as { owner?: string });
    };
    window.addEventListener(VYVA_VOICE_CANVAS_CLEAR_EVENT, handleClear);
    const view = renderScreen();
    await waitFor(() => expect(screen.getByTestId("panel-appointment-assistant")).toBeInTheDocument());

    voiceActionMock.action = {
      ...voiceActionMock.action,
      id: "voice-reminder-after-appointment",
      actionType: "concierge.reminder",
      title: "Set a reminder",
      sourceText: "Remind me to call Maria",
      feedbackReason: "User requested a reminder",
    } as NonNullable<typeof voiceActionMock.action>;
    view.rerenderScreen();

    await waitFor(() => expect(clears.some((detail) => detail.owner === "concierge_appointment")).toBe(true));
    window.removeEventListener(VYVA_VOICE_CANVAS_CLEAR_EVENT, handleClear);
  });

  it("prepares a Canvas ride before requiring the separate final confirmation", async () => {
    voiceActionMock.action = {
      id: "voice-ride-canvas-confirm",
      actionType: "concierge.ride_booking",
      domain: "concierge",
      route: "/concierge",
      title: "Book a ride",
      summary: "Opening a ride",
      cue: "Ask for ride details",
      sourceText: "Book a ride to City Clinic",
      priority: "high",
      feedbackReason: "User requested transport",
      payload: { destination: "City Clinic" },
    };
    let prepared = false;
    let confirmed = false;
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target === "/api/profile") {
        return jsonResponse({
          savedProviders: [{ name: "Radio Taxi", role: "taxi", phone: "+34 600 111 222" }],
          serviceReadiness: { hasSavedTransportProvider: true, hasMobilityInfo: true },
        });
      }
      if (target === "/api/transport/options") {
        return jsonResponse({
          market: { countryCode: "ES", city: "Madrid" },
          options: [{
            id: "radio-taxi",
            kind: "saved_provider",
            label: "Radio Taxi",
            description: "Saved trusted provider",
            providerName: "Radio Taxi",
            phone: "+34 600 111 222",
            actions: ["call_phone", "start_concierge_action"],
          }],
          disclaimers: [],
        });
      }
      if (target === "/api/concierge/actions/trigger") {
        prepared = true;
        return jsonResponse({ pendingId: "canvas-ride-1", status: "pending" });
      }
      if (target === "/api/concierge/actions/canvas-ride-1/confirm") {
        confirmed = true;
        return jsonResponse({ ok: true });
      }
      if (target === "/api/concierge/actions/pending") {
        return jsonResponse({
          items: prepared ? [{
            id: "canvas-ride-1",
            use_case: "book_ride",
            provider_name: "Radio Taxi",
            provider_phone: "+34 600 111 222",
            action_summary: "Ride prepared",
            action_payload: {
              pickup_address: "Saved home",
              destination_address: "City Clinic",
              requested_time: "now",
              mobility_needs: "saved in profile",
            },
            status: confirmed ? "calling" : "pending",
            confirmed_at: confirmed ? "2026-07-18T10:05:00.000Z" : null,
            language: "en",
          }] : [],
        });
      }
      return jsonResponse({ items: [] });
    });
    const scenes: VoiceCanvasSceneEnvelope[] = [];
    const handleScene = (event: Event) => {
      if (event instanceof CustomEvent) scenes.push(event.detail as VoiceCanvasSceneEnvelope);
    };
    const latestScene = (sceneId: string) => [...scenes].reverse().find((scene) => scene.viewModel.sceneId === sceneId);
    const answerScene = (scene: VoiceCanvasSceneEnvelope, detail: Partial<Parameters<typeof emitVoiceCanvasResponse>[0]>) => {
      act(() => emitVoiceCanvasResponse({
        sceneId: scene.viewModel.sceneId,
        revision: scene.revision,
        kind: "primary",
        utterance: scene.viewModel.primaryAction?.label || "Continue",
        at: "2026-07-18T10:00:00.000Z",
        ...detail,
      }));
    };
    window.addEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);

    renderScreen();
    await waitFor(() => expect(screen.getByTestId("note-transport-provider-readiness")).toHaveTextContent("Radio Taxi"));
    await waitFor(() => expect(latestScene("ride-pickup")).toBeTruthy());
    answerScene(latestScene("ride-pickup")!, { kind: "choice", choiceId: "saved_home", value: "Saved home", utterance: "Saved home" });
    await waitFor(() => expect(latestScene("ride-time")).toBeTruthy());
    answerScene(latestScene("ride-time")!, { kind: "choice", choiceId: "now", value: "Now", utterance: "Now" });
    await waitFor(() => expect(latestScene("ride-review")).toBeTruthy());

    answerScene(latestScene("ride-review")!, {});
    await waitFor(() => expect(latestScene("ride-options")).toBeTruthy());
    answerScene(latestScene("ride-options")!, { kind: "choice", choiceId: "radio-taxi", value: "Radio Taxi", utterance: "Radio Taxi" });
    await waitFor(() => expect(latestScene("ride-option-review")).toBeTruthy());
    answerScene(latestScene("ride-option-review")!, {});

    await waitFor(() => expect(prepared).toBe(true));
    expect(confirmed).toBe(false);
    await waitFor(() => expect(latestScene("ride-pending-confirm")).toBeTruthy());
    answerScene(latestScene("ride-pending-confirm")!, {});
    await waitFor(() => expect(confirmed).toBe(true));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/canvas-ride-1/confirm", { method: "POST" });
    window.removeEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
  });

  it("preserves the ride Canvas when a missing provider opens focused setup", async () => {
    voiceActionMock.action = {
      id: "voice-ride-provider-setup",
      actionType: "concierge.ride_booking",
      domain: "concierge",
      route: "/concierge",
      title: "Book a ride",
      summary: "Opening a ride",
      cue: "Ask for ride details",
      sourceText: "Book a ride to City Clinic",
      priority: "high",
      feedbackReason: "User requested transport",
      payload: { destination: "City Clinic" },
    };
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url) === "/api/profile") {
        return jsonResponse({ serviceReadiness: { hasSavedTransportProvider: false, hasMobilityInfo: true } });
      }
      return jsonResponse({ items: [] });
    });
    const scenes: VoiceCanvasSceneEnvelope[] = [];
    const handleScene = (event: Event) => {
      if (event instanceof CustomEvent) scenes.push(event.detail as VoiceCanvasSceneEnvelope);
    };
    const latestScene = (sceneId: string) => [...scenes].reverse().find((scene) => scene.viewModel.sceneId === sceneId);
    window.addEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);

    renderScreen();
    await waitFor(() => expect(latestScene("ride-pickup")).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId("note-transport-mobility-readiness")).toHaveTextContent("Mobility preferences saved"));
    const pickup = latestScene("ride-pickup")!;
    act(() => emitVoiceCanvasResponse({ sceneId: pickup.viewModel.sceneId, revision: pickup.revision, kind: "choice", choiceId: "saved_home", utterance: "Saved home", value: "Saved home", at: "2026-07-18T10:00:00.000Z" }));
    await waitFor(() => expect(latestScene("ride-time")).toBeTruthy());
    const time = latestScene("ride-time")!;
    act(() => emitVoiceCanvasResponse({ sceneId: time.viewModel.sceneId, revision: time.revision, kind: "choice", choiceId: "now", utterance: "Now", value: "Now", at: "2026-07-18T10:00:01.000Z" }));
    await waitFor(() => expect(latestScene("ride-provider")).toBeTruthy());
    const provider = latestScene("ride-provider")!;
    act(() => emitVoiceCanvasResponse({ sceneId: provider.viewModel.sceneId, revision: provider.revision, kind: "primary", utterance: "Add provider", at: "2026-07-18T10:00:02.000Z" }));

    await waitFor(() => expect(screen.getByTestId("location-path")).toHaveTextContent("/onboarding/profile/providers"));
    const routeState = JSON.parse(screen.getByTestId("route-state").textContent || "{}");
    expect(routeState).toMatchObject({ setupFocus: "transport", setupFlow: CONCIERGE_FLOW_REFERENCES.transportBooking });
    expect(routeState.conciergeResume).toMatchObject({ kind: "transport", voiceCanvas: true, destination: "City Clinic" });
    window.removeEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
  });

  it("renders the requested primary cards and fast help actions", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();

    expect(await screen.findByTestId("concierge-master-layout")).toBeVisible();
    expect(await screen.findByTestId("concierge-guided-hub")).toBeVisible();
    expect(screen.getByTestId("concierge-fast-help")).toBeVisible();
    expect(screen.getByTestId("concierge-master-hero")).toHaveTextContent("Concierge ready");
    expect(screen.queryByTestId("voice-hero")).not.toBeInTheDocument();
    expect(voiceHeroMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("concierge-guided-hub")).not.toHaveTextContent("Shop");
    expect(screen.getByTestId("button-concierge-card-service")).toHaveTextContent("Home Care");
    expect(screen.getByTestId("button-concierge-card-service")).toHaveTextContent("Plumber");
    expect(screen.getByTestId("button-concierge-card-ride")).toHaveTextContent("Personal Care");
    expect(screen.getByTestId("button-concierge-card-ride")).toHaveTextContent("Find a Specialist");
    expect(screen.getByTestId("button-concierge-card-delivery")).toHaveTextContent("Order In");
    expect(screen.getByTestId("button-concierge-card-delivery")).toHaveTextContent("Groceries");
    expect(screen.getByTestId("button-concierge-card-appointment")).toHaveTextContent("Book Now");
    expect(screen.queryByRole("button", { name: "Plan a Trip" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Find Events" })).not.toBeInTheDocument();
    expect(screen.getByTestId("button-concierge-card-service")).not.toHaveTextContent("Home service, forms, legal/admin, care");
    expect(screen.getByTestId("button-concierge-card-service")).toHaveAccessibleName("Home Care. Plumber, electrician, cleaning");
    expect(screen.getByTestId("button-concierge-card-delivery")).not.toHaveTextContent("Groceries, essentials, prepared meals");
    expect(screen.getByTestId("button-concierge-card-delivery")).toHaveAccessibleName("Order In. Groceries, household");
    expect(screen.getByTestId("button-concierge-card-appointment")).toHaveTextContent("Medical");
    expect(screen.getByTestId("button-concierge-card-appointment")).toHaveTextContent("Government");
    expect(screen.getByTestId("button-concierge-card-appointment")).toHaveTextContent("Personal care");
    expect(screen.getByTestId("button-concierge-card-appointment")).not.toHaveTextContent("Ride");
    expect(screen.getByTestId("button-concierge-card-appointment")).toHaveAccessibleName("Book Now. Medical, government, personal care");
    expect(screen.getByTestId("concierge-fast-help")).toHaveTextContent("Fast help");
    expect(screen.getByTestId("button-concierge-fast-safe-home")).toHaveTextContent("Safe Home");
    expect(screen.getByTestId("button-concierge-fast-fill-form")).toHaveTextContent("Paperwork Help");
    expect(screen.getByTestId("button-concierge-fast-home-service")).toHaveTextContent("Find Plumber");
  });

  it("routes delivery through the shopping helper", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-delivery"));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge/shopping");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"category\":\"groceries\"");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"delivery\"");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"simplicity\"");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"safety\"");
    });
  });

  it("routes Safe Home fast help with the tracked safety flow reference", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-fast-safe-home"));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/safe-home");
      expect(screen.getByTestId("route-state")).toHaveTextContent(CONCIERGE_FLOW_REFERENCES.safeHomeSupport);
      expect(screen.getByTestId("route-state")).toHaveTextContent("concierge_fast_help");
    });
  });

  it("routes Order Groceries fast help through the shopping assistant", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await showOrderGroceriesFastHelp());
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge/shopping");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"category\":\"groceries\"");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"delivery\"");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"simplicity\"");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"safety\"");
    });
  });

  it("opens Find Specialist fast help as a provider comparison search", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await showFindCareFastHelp());
    vi.useRealTimers();

    expect(await screen.findByTestId("panel-offers-search")).toBeVisible();
    expect(screen.getByTestId("panel-provider-search-criteria")).toHaveTextContent("What matters most");
    expect(screen.getByTestId("panel-provider-search-criteria")).toHaveTextContent("Good reputation");
    expect((screen.getByTestId("input-offers-query") as HTMLInputElement).value).toBe("find a specialist");
  });

  it("opens Book Medical fast help directly in the medical appointment flow", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await showBookMedicalFastHelp());
    vi.useRealTimers();

    const panel = await screen.findByTestId("panel-appointment-assistant");
    expect(panel).toHaveTextContent("Appointment");
    expect(panel).toHaveTextContent("Schedule");
    expect(screen.getByRole("button", { name: "Medical" })).toBeVisible();
    expect(screen.getByPlaceholderText("E.g. dermatology, Tuesday morning, WhatsApp if possible")).toBeVisible();
    expect(screen.queryByTestId("modal-appointment-mission")).not.toBeInTheDocument();
  });

  it("turns Safe Home quote prefill into a tagged home-service concierge request", async () => {
    let requestBody: {
      appointment_type?: string;
      detail?: string;
      route_prefill_source?: string;
      preferences?: Record<string, unknown>;
    } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/appointments/requests")) {
        requestBody = JSON.parse(String(init?.body));
        return jsonResponse({
          request: {
            id: "request-safe-home",
            appointment_type: "home-service",
            reason_detail: requestBody?.detail,
            preferences: requestBody?.preferences,
            status: "options_ready",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [{
            id: "option-safe-home",
            provider_id: "provider-safe-home",
            provider_source: "saved",
            provider_snapshot: { name: "Trusted Handyman", phone: "+34 600 555 111" },
            match_reason: "Saved home support provider",
            available_channels: ["phone"],
            rank: 1,
            status: "recommended",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([{
      pathname: "/concierge",
      state: {
        conciergePrefill: {
          kind: "home_care_quote",
          source: "safe_home_scan",
          flowReference: CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
          actionLabel: "Request safety quote",
          summary: "Loose rug in hallway.",
          message: "Help me request a home safety quote for a loose rug in the hallway.",
        },
      },
    }]);

    expect(await screen.findByTestId("panel-concierge-route-prefill")).toHaveTextContent("Support quote ready");
    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(requestBody).toMatchObject({
        appointment_type: "home-service",
        route_prefill_source: "safe_home_scan",
        preferences: expect.objectContaining({
          flow_reference: CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
          safety_source: "safe_home_scan",
          action_label: "Request safety quote",
          summary: "Loose rug in hallway.",
        }),
      });
    });
    expect(requestBody?.detail).toContain("home safety quote");
    expect(await screen.findByTestId("panel-appointment-assistant")).toHaveTextContent("Home service");
  }, 60_000);

  it("opens Government from Book Now directly in the admin form flow", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.change(screen.getByPlaceholderText("E.g. dermatology, Tuesday morning, WhatsApp if possible"), {
      target: { value: "Passport renewal" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Government" }));

    expect(await screen.findByTestId("panel-insurance-admin")).toHaveTextContent("Paperwork help");
    const fields = await screen.findByTestId("panel-insurance-admin-guided-fields");
    expect(fields).toHaveTextContent("Government/admin form");
    expect(fields).toHaveTextContent("Fill only what you know");
    expect(screen.getByTestId("input-insurance-admin-subject")).toHaveValue("Passport renewal");
    expect(screen.queryByTestId("panel-appointment-assistant")).not.toBeInTheDocument();
  });

  it("opens appointment, service, savings, trip, and research flows in place", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent("Appointment");
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent("Schedule");
    expect(screen.queryByTestId("modal-appointment-mission")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-appointment-open-mission-guide")).not.toBeInTheDocument();
    for (const label of ["Medical", "Personal care", "Government"]) {
      expect(screen.getByRole("button", { name: label })).toBeVisible();
    }
    const appointmentPanel = screen.getByTestId("panel-appointment-assistant");
    for (const label of ["Home service", "Social or restaurant", "Other"]) {
      expect(within(appointmentPanel).queryByRole("button", { name: label })).not.toBeInTheDocument();
    }

    fireEvent.click(screen.getByTestId("button-concierge-card-service"));
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent("Home service");
    expect(screen.getByTestId("button-appointment-start-home-service")).toHaveTextContent("Find trusted options");
    await dismissHomeServiceGuide();

    fireEvent.click(screen.getByTestId("button-concierge-card-ride"));
    expect(screen.getByTestId("panel-offers-search")).toBeVisible();
  });

  it("opens appointment choices directly without the old mission popup", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));

    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent("Appointment");
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent("Schedule");
    expect(screen.getByRole("button", { name: "Medical" })).toBeVisible();
    expect(screen.getByPlaceholderText("E.g. dermatology, Tuesday morning, WhatsApp if possible")).toBeVisible();
    expect(screen.queryByTestId("modal-appointment-mission")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-appointment-open-mission-guide")).not.toBeInTheDocument();
  });

  it("routes personal care appointment choices through provider search", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.change(screen.getByPlaceholderText("E.g. dermatology, Tuesday morning, WhatsApp if possible"), {
      target: { value: "Haircut next Friday, close to home" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Personal care" }));

    expect(screen.queryByTestId("panel-appointment-assistant")).not.toBeInTheDocument();
    expect(await screen.findByTestId("panel-offers-search")).toBeVisible();
    expect(screen.getByTestId("panel-provider-search-criteria")).toHaveTextContent("What matters most");
    const query = (screen.getByTestId("input-offers-query") as HTMLInputElement).value;
    expect(query).toContain("personal care appointment");
    expect(query).toContain("Haircut next Friday, close to home");
    expect(apiFetchMock.mock.calls.some(([url]) => String(url).endsWith("/api/appointments/requests"))).toBe(false);
  });

  it("shows the home service guide as a one-time popup with a saved hide option", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-service"));

    expect(await screen.findByTestId("modal-home-service-guide")).toBeVisible();
    expect(screen.getByTestId("panel-home-service-guide")).toHaveTextContent("Saved list checked");
    expect(screen.getByTestId("panel-home-service-guide")).toHaveTextContent("Trusted search");
    expect(screen.getByTestId("panel-home-service-guide")).toHaveTextContent("You confirm");

    fireEvent.click(screen.getByTestId("checkbox-home-service-guide-never"));
    fireEvent.click(screen.getByTestId("button-home-service-guide-understood"));
    await waitFor(() => {
      expect(screen.queryByTestId("modal-home-service-guide")).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId("button-home-service-open-guide")).not.toBeInTheDocument();
    expect(localStorage.getItem(HOME_SERVICE_GUIDE_STORAGE_KEY)).toBe("true");
  });

  it("creates an appointment request and asks VYVA to handle the saved provider before booking", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes("/api/appointments/requests/request-1/confirm-attempt")) {
        expect(JSON.parse(String(init?.body))).toEqual({ option_id: "option-1", channel: "phone" });
        return jsonResponse({
          attempt: { id: "attempt-1", channel: "phone", status: "calling" },
          pending: { pendingId: "pending-1", status: "calling" },
          needs_booking_confirmation: true,
          handled_by_vyva: true,
        });
      }
      if (String(url).includes("/api/appointments/requests/request-1/mark-booked")) {
        const body = JSON.parse(String(init?.body));
        expect(body.provider_name).toBe("Clinica Lopez");
        expect(body.location).toBe("Calle Mayor 1");
        expect(body.notes).toContain("Provider reply: Confirmed Tuesday at 10");
        expect(body.notes).toContain("Reference: REF-22");
        return jsonResponse({
          scheduled_event: { id: "scheduled-1", scheduled_for: body.scheduled_for, title: "Appointment" },
          mission: { status: "booked", current_step: "booked", preferred_channel: "phone", activity_log: [] },
        });
      }
      if (String(url).includes("/api/concierge/actions/pending-1/complete")) {
        const body = JSON.parse(String(init?.body));
        expect(body.outcome_summary).toContain("Medical appointment confirmed with Clinica Lopez");
        expect(body.outcome_payload).toMatchObject({
          flow_reference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
          appointment_request_id: "request-1",
          appointment_type: "medical",
          provider_name: "Clinica Lopez",
          provider_reply: "Confirmed Tuesday at 10",
          reference: "REF-22",
          scheduled_event_id: "scheduled-1",
        });
        return jsonResponse({ ok: true, status: "completed", sessionId: "session-appointment-1" });
      }
      if (String(url).includes("/api/appointments/requests")) {
        return jsonResponse({
          request: {
            id: "request-1",
            appointment_type: "medical",
            reason_detail: "dermatology",
            status: "options_ready",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [{
            id: "option-1",
            provider_id: "provider-1",
            provider_source: "saved",
            provider_snapshot: {
              name: "Clinica Lopez",
              phone: "+34 600 111 222",
              address: "Calle Mayor 1",
            },
            match_reason: "Saved medical provider",
            available_channels: ["phone", "manual"],
            rank: 1,
            status: "recommended",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.change(screen.getByPlaceholderText("E.g. dermatology, Tuesday morning, WhatsApp if possible"), {
      target: { value: "dermatology" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(await screen.findByTestId("panel-appointment-provider-options")).toHaveTextContent("Clinica Lopez");
    expect(screen.getByTestId("panel-appointment-provider-options")).toHaveTextContent("Ask VYVA to handle this");
    expect(screen.getByTestId("panel-appointment-readiness")).toHaveTextContent("Tool ready");
    expect(screen.getByTestId("panel-appointment-readiness")).toHaveTextContent("Direct tool: phone call");
    expect(screen.getByTestId("panel-appointment-readiness")).toHaveTextContent("Recipient: Clinica Lopez");
    expect(screen.getByTestId("panel-appointment-confirmation-checkpoint")).toHaveTextContent("Tool ready: call");
    expect(screen.queryByTestId("button-appointment-channel-phone")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-appointment-handle-provider"));

    expect(await screen.findByTestId("panel-appointment-mark-booked")).toHaveTextContent("Review and confirm appointment");
    expect(screen.getByText("VYVA is calling now. Save the appointment once confirmed.")).toBeVisible();
    fireEvent.change(screen.getByTestId("input-appointment-provider-reply"), {
      target: { value: "Confirmed Tuesday at 10" },
    });
    fireEvent.change(screen.getByTestId("input-appointment-confirmed-time"), {
      target: { value: "2026-07-14T10:00" },
    });
    fireEvent.change(screen.getByTestId("input-appointment-confirmed-reference"), {
      target: { value: "REF-22" },
    });
    fireEvent.click(screen.getByTestId("button-appointment-save-confirmed"));

    expect(await screen.findByText("Appointment saved in Scheduled Support. The task is closed.")).toBeVisible();
    expect(screen.queryByTestId("panel-appointment-mark-booked")).not.toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/appointments/requests", expect.objectContaining({ method: "POST" }));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/appointments/requests/request-1/confirm-attempt", expect.objectContaining({ method: "POST" }));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/pending-1/complete", expect.objectContaining({ method: "POST" }));
  });

  it("sends appointment email through VYVA before booking is saved", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.includes("/api/appointments/requests/request-email/confirm-attempt")) {
        expect(JSON.parse(String(init?.body))).toEqual({ option_id: "option-email", channel: "email" });
        return jsonResponse({
          attempt: { id: "attempt-email", channel: "email", status: "email_sent" },
          communication: {
            id: "comm-1",
            channel: "email",
            recipient: "clinic@example.com",
            status: "sent",
          },
          needs_booking_confirmation: true,
          handled_by_vyva: true,
        });
      }
      if (target.endsWith("/api/appointments/requests")) {
        return jsonResponse({
          request: {
            id: "request-email",
            appointment_type: "medical",
            reason_detail: "dermatology",
            status: "options_ready",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [{
            id: "option-email",
            provider_id: "provider-email",
            provider_source: "saved",
            provider_snapshot: {
              name: "Clinica Email",
              email: "clinic@example.com",
              address: "Calle Mayor 2",
            },
            match_reason: "Saved medical provider",
            available_channels: ["email", "manual"],
            rank: 1,
            status: "recommended",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(await screen.findByTestId("panel-appointment-provider-options")).toHaveTextContent("Clinica Email");
    expect(screen.getByTestId("panel-appointment-readiness")).toHaveTextContent("Direct tool: email");
    expect(screen.getByTestId("panel-appointment-readiness")).toHaveTextContent("Current path: email");
    fireEvent.click(screen.getByTestId("button-appointment-handle-provider"));

    expect(await screen.findByTestId("panel-appointment-mark-booked")).toHaveTextContent("Review and confirm appointment");
    expect(screen.getByText("VYVA sent the message. Save the appointment when they reply.")).toBeVisible();
  });

  it("routes missing medical provider setup to trusted providers", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/appointments/requests")) {
        return jsonResponse({
          request: {
            id: "request-no-provider",
            appointment_type: "medical",
            reason_detail: "cardiology",
            status: "needs_provider",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.change(screen.getByPlaceholderText("E.g. dermatology, Tuesday morning, WhatsApp if possible"), {
      target: { value: "cardiology" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(await screen.findByTestId("panel-appointment-assistant")).toHaveTextContent("No trusted provider selected.");
    expect(screen.getByTestId("button-appointment-provider-setup")).toHaveTextContent("Add or choose doctor or clinic");
    fireEvent.click(screen.getByTestId("button-appointment-provider-setup"));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/onboarding/profile/providers");
    });
    expect(screen.getByTestId("route-state")).toHaveTextContent("doctor_clinic");
    expect(screen.getByTestId("route-state")).toHaveTextContent(CONCIERGE_FLOW_REFERENCES.medicalAppointment);
  });

  it("shows VYVA-handled booking form status before booking is saved", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.includes("/api/appointments/requests/request-form/confirm-attempt")) {
        expect(JSON.parse(String(init?.body))).toEqual({ option_id: "option-form", channel: "booking_url" });
        return jsonResponse({
          attempt: { id: "attempt-form", channel: "booking_url", status: "form_task_queued" },
          form_task: {
            status: "needs_operator",
            booking_url: "https://calendly.com/clinic/consult",
            pending_id: "pending-form",
          },
          pending: { pendingId: "pending-form", status: "queued" },
          needs_booking_confirmation: true,
          handled_by_vyva: true,
        });
      }
      if (target.endsWith("/api/appointments/requests")) {
        return jsonResponse({
          request: {
            id: "request-form",
            appointment_type: "medical",
            reason_detail: "dermatology",
            status: "options_ready",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [{
            id: "option-form",
            provider_id: "provider-form",
            provider_source: "saved",
            provider_snapshot: {
              name: "Clinica Form",
              booking_url: "https://calendly.com/clinic/consult",
              address: "Calle Mayor 3",
            },
            match_reason: "Saved medical provider",
            available_channels: ["booking_url", "manual"],
            rank: 1,
            status: "recommended",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(await screen.findByTestId("panel-appointment-provider-options")).toHaveTextContent("Clinica Form");
    expect(screen.getByTestId("panel-appointment-readiness")).toHaveTextContent("Direct tool: booking link");
    expect(screen.getByTestId("panel-appointment-readiness")).toHaveTextContent("Current path: booking link");
    fireEvent.click(screen.getByTestId("button-appointment-handle-provider"));

    expect(await screen.findByTestId("panel-appointment-mark-booked")).toHaveTextContent("Review and confirm appointment");
    expect(screen.getByText("VYVA has the booking form task. Save the appointment once confirmed.")).toBeVisible();
  });

  it("keeps appointment details editable before VYVA starts handling it", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.change(screen.getByPlaceholderText("E.g. dermatology, Tuesday morning, WhatsApp if possible"), {
      target: { value: "Prefer Tuesday morning and ask about wheelchair access" },
    });

    expect(screen.queryByTestId("button-appointment-open-mission-guide")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Prefer Tuesday morning and ask about wheelchair access")).toBeVisible();
  });

  it("saves medical coverage readiness and removes the setup card", async () => {
    let coverageSaved = false;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target === "/api/profile") {
        return jsonResponse(coverageSaved
          ? {
            coverage: {
              coverageType: "private",
              provider: "Sanitas",
              memberId: "AB-123",
              plan: "",
              notes: "",
            },
            serviceReadiness: { hasCoverageInfo: true },
          }
          : { serviceReadiness: { hasCoverageInfo: false } });
      }
      if (target === "/api/profile/coverage") {
        expect(init?.method).toBe("PATCH");
        const body = JSON.parse(String(init?.body));
        expect(body.coverageType).toBe("private");
        expect(body.provider).toBe("Sanitas");
        expect(body.memberId).toBe("AB-123");
        coverageSaved = true;
        return jsonResponse({
          ok: true,
          coverage: {
            coverageType: "private",
            provider: "Sanitas",
            memberId: "AB-123",
            plan: "",
            notes: "",
          },
          serviceReadiness: { hasCoverageInfo: true },
        });
      }
      if (target.endsWith("/api/appointments/requests")) {
        return jsonResponse({
          request: {
            id: "request-coverage",
            appointment_type: "medical",
            reason_detail: "dermatology",
            status: "needs_provider",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(await screen.findByTestId("panel-coverage-readiness")).toHaveTextContent("Coverage for medical bookings");
    fireEvent.click(screen.getByTestId("button-coverage-type-private"));
    fireEvent.change(screen.getByTestId("input-coverage-provider"), {
      target: { value: "Sanitas" },
    });
    fireEvent.change(screen.getByTestId("input-coverage-member-id"), {
      target: { value: "AB-123" },
    });
    fireEvent.click(screen.getByTestId("button-coverage-save"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/profile/coverage", expect.objectContaining({ method: "PATCH" }));
      expect(screen.queryByTestId("panel-coverage-readiness")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("Coverage saved. VYVA will ask before sharing it.")).toBeVisible();
  });

  it("skips the coverage setup card when medical coverage is already saved", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target === "/api/profile") {
        return jsonResponse({
          coverage: {
            coverageType: "private",
            provider: "Sanitas",
            memberId: "AB-123",
            plan: "",
            notes: "",
          },
          serviceReadiness: { hasCoverageInfo: true },
        });
      }
      if (target.endsWith("/api/appointments/requests")) {
        return jsonResponse({
          request: {
            id: "request-saved-coverage",
            appointment_type: "medical",
            reason_detail: "dermatology",
            status: "options_ready",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [{
            id: "option-saved-coverage",
            provider_id: "provider-saved-coverage",
            provider_source: "saved",
            provider_snapshot: {
              name: "Clinica Coverage",
              phone: "+34 600 111 444",
              address: "Calle Salud 4",
            },
            match_reason: "Saved medical provider",
            available_channels: ["phone", "manual"],
            rank: 1,
            status: "recommended",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(await screen.findByTestId("panel-appointment-provider-options")).toHaveTextContent("Clinica Coverage");
    expect(screen.queryByTestId("panel-coverage-readiness")).not.toBeInTheDocument();
    expect(screen.getByTestId("panel-appointment-confirmation-checkpoint")).toHaveTextContent("Insurance: saved in profile");
    expect(screen.getByTestId("panel-appointment-confirmation-checkpoint")).toHaveTextContent("VYVA will ask before sharing any details.");
  });

  it("discovers external appointment options inside the request flow", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target.includes("/api/appointments/requests/request-2/discover-options")) {
        return jsonResponse({
          request: {
            id: "request-2",
            appointment_type: "medical",
            reason_detail: "dermatology",
            status: "options_ready",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [{
            id: "option-google-1",
            provider_id: null,
            provider_source: "external",
            provider_snapshot: {
              source: "google_places",
              name: "Marbella Dermatology Centre",
              phone: "+34 600 222 333",
              address: "Avenida Principal 2",
              booking_url: "https://example.com/book",
              maps_url: "https://maps.google.com/?q=marbella",
            },
            match_reason: "Found with Google Maps",
            available_channels: ["booking_url", "phone", "manual"],
            rank: 1,
            status: "suggested",
          }],
          discovery: {
            source: "google_places",
            inserted_count: 1,
          },
        });
      }
      if (target.endsWith("/api/appointments/requests")) {
        return jsonResponse({
          request: {
            id: "request-2",
            appointment_type: "medical",
            reason_detail: "dermatology",
            status: "needs_provider",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.change(screen.getByPlaceholderText("E.g. dermatology, Tuesday morning, WhatsApp if possible"), {
      target: { value: "dermatology" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(await screen.findByText("No trusted provider selected.")).toBeVisible();
    fireEvent.click(screen.getByTestId("button-appointment-discover-options"));

    expect(await screen.findByTestId("panel-appointment-provider-options")).toHaveTextContent("Marbella Dermatology Centre");
    expect(screen.getByTestId("panel-appointment-confirmation-checkpoint")).toHaveTextContent("Confirm before VYVA acts");
    expect(screen.getByTestId("panel-appointment-confirmation-checkpoint")).toHaveTextContent("Contact route: VYVA fills form");
    expect(screen.getByTestId("button-appointment-handle-provider")).toHaveTextContent("Confirm: Ask VYVA to handle this");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/appointments/requests/request-2/discover-options", expect.objectContaining({ method: "POST" }));
  });

  it("gates reservation-system fallbacks through an appointment confirmation", async () => {
    let addedOptionBody: Record<string, unknown> | null = null;
    let confirmBody: Record<string, unknown> | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.includes("/api/appointments/requests/request-3/discover-options")) {
        return jsonResponse({
          request: {
            id: "request-3",
            appointment_type: "medical",
            reason_detail: "dermatology",
            status: "needs_provider",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [],
          discovery: {
            source: "google_places",
            fallback_reason: "no_google_results",
            inserted_count: 0,
            reservation_systems: [
              { name: "Doctoralia", category: "medical_marketplace", url: "https://www.google.com/search?q=doctoralia" },
              { name: "Top Doctors", category: "medical_marketplace", url: "https://www.google.com/search?q=topdoctors" },
            ],
          },
        });
      }
      if (target.includes("/api/appointments/requests/request-3/options")) {
        addedOptionBody = JSON.parse(String(init?.body));
        return jsonResponse({
          option: {
            id: "option-doctoralia",
            provider_id: null,
            provider_source: "external",
            provider_snapshot: {
              source: "reservation_system",
              name: "Doctoralia",
              category: "medical_marketplace",
              booking_url: "https://www.google.com/search?q=doctoralia",
              preferred_channel: "booking_url",
            },
            match_reason: "Booking-site fallback. VYVA will review before opening or submitting any form.",
            available_channels: ["booking_url", "manual"],
            rank: 40,
            status: "selected",
          },
        });
      }
      if (target.includes("/api/appointments/requests/request-3/confirm-attempt")) {
        confirmBody = JSON.parse(String(init?.body));
        return jsonResponse({
          attempt: { id: "attempt-doctoralia", channel: "booking_url", status: "form_task_queued" },
          form_task: {
            status: "needs_operator",
            booking_url: "https://www.google.com/search?q=doctoralia",
            pending_id: "pending-doctoralia",
          },
          pending: { pendingId: "pending-doctoralia", status: "queued" },
          needs_booking_confirmation: true,
          handled_by_vyva: true,
        });
      }
      if (target.endsWith("/api/appointments/requests")) {
        return jsonResponse({
          request: {
            id: "request-3",
            appointment_type: "medical",
            reason_detail: "dermatology",
            status: "needs_provider",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));
    fireEvent.click(await screen.findByTestId("button-appointment-discover-options"));

    const fallbackPanel = await screen.findByTestId("panel-appointment-booking-sites");
    expect(fallbackPanel).toHaveTextContent("Doctoralia");
    expect(fallbackPanel).toHaveTextContent("Top Doctors");
    expect(within(fallbackPanel).queryByRole("link", { name: /Doctoralia/i })).not.toBeInTheDocument();
    expect(confirmBody).toBeNull();

    fireEvent.click(screen.getByTestId("button-appointment-booking-site-doctoralia"));

    expect(await screen.findByTestId("panel-appointment-provider-options")).toHaveTextContent("Doctoralia");
    expect(screen.getByTestId("panel-appointment-confirmation-checkpoint")).toHaveTextContent("Confirm before VYVA acts");
    expect(screen.getByTestId("panel-appointment-confirmation-checkpoint")).toHaveTextContent("Contact route: VYVA fills form");
    expect(addedOptionBody).toMatchObject({
      provider_source: "external",
      provider_snapshot: expect.objectContaining({
        source: "reservation_system",
        name: "Doctoralia",
        booking_url: "https://www.google.com/search?q=doctoralia",
        preferred_channel: "booking_url",
      }),
      available_channels: ["booking_url", "manual"],
      select: true,
    });

    expect(confirmBody).toBeNull();
    fireEvent.click(screen.getByTestId("button-appointment-handle-provider"));

    await waitFor(() => {
      expect(confirmBody).toEqual({ option_id: "option-doctoralia", channel: "booking_url" });
    });
    expect(await screen.findByTestId("panel-appointment-mark-booked")).toHaveTextContent("Review and confirm appointment");
  });

  it("renders compact protected savings results with expandable proof and watch confirmation", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes("/api/offers/search")) {
        return jsonResponse({
          category: "Household costs",
          decision_explanation: "This option has the best mix of price, trust, ease, and fit.",
          neutrality_note: "No provider paid for placement.",
          source_guidance: [
            "official or regulated comparison sources",
            "verified local businesses",
            "community programmes",
          ],
          protection_summary: {
            title: "Objective check",
            checkpoints: [
              "No paid ranking.",
              "Validates price, trust, ease, and fit.",
              "Uses official, public, or verifiable sources.",
            ],
            notification_triggers: ["price change", "renewal date"],
            action_guardrail: "VYVA asks before contact, switching, or sharing details.",
          },
          options: [{
            label: "Opcion recomendada",
            name: "Senior Energy Saver",
            category: "Household costs",
            what_it_offers: "Lower-cost electric service.",
            price_or_advantage: "Estimated 18% monthly saving with no early switch.",
            why_good_option: "Strong fit for the current household profile.",
            distance_or_availability: "Available online.",
            contact_method: "Online",
            website: "https://example.com",
            trust_note: "Official source and verified tariff.",
            score: 91,
            score_breakdown: {
              distance: 70,
              price_value: 94,
              trust: 90,
              simplicity: 88,
              preference_match: 92,
            },
          }],
          next_step: "Confirm before contacting or switching.",
        });
      }
      if (String(url).includes("/api/concierge/actions/trigger")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.use_case).toBe("find_offers");
        expect(body.auto_start).toBe(false);
        expect(body.action_summary).toBe("Offer watch prepared: Senior Energy Saver.");
        expect(body.action_payload).toMatchObject({
          flow_reference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
          task_type: "deal_watch",
          offer_name: "Senior Energy Saver",
          shopping_context: "Household costs",
          requested_tool: "phone_call",
          active_tool: "operator_review",
          confirmation_required_before_action: true,
          no_external_action_without_confirmation: true,
          user_confirmed: false,
        });
        return jsonResponse({ pendingId: "deal-watch-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-ride"));

    expect(screen.getByTestId("panel-offers-search")).toBeVisible();
    expect(screen.getByTitle("No commissions")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /review available benefits/i }));

    const proofSummary = await screen.findByTestId("panel-offers-objective-summary");
    expect(proofSummary).toHaveTextContent("Independent");
    expect(proofSummary).toHaveTextContent("3 sources");
    expect(proofSummary).toHaveTextContent("You confirm");
    expect(screen.queryByTestId("panel-offers-objective-details")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-offers-objective-toggle"));

    const proofDetails = await screen.findByTestId("panel-offers-objective-details");
    expect(proofDetails).toHaveTextContent("No paid ranking.");
    expect(proofDetails).toHaveTextContent("official or regulated comparison sources");
    expect(proofDetails).toHaveTextContent("Validates price, trust, ease, and fit.");
    expect(proofDetails).toHaveTextContent("price change");
    const comparison = screen.getByTestId("provider-comparison-panel");
    expect(comparison).toHaveTextContent("Price");
    expect(comparison).toHaveTextContent("Not provided");
    expect(comparison).not.toHaveTextContent("/100");
    expect(screen.queryByRole("button", { name: /score details/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /watch changes/i }));

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Deal comparison ready");
    expect(prefill).toHaveTextContent("Watch important changes for Senior Energy Saver");
    expect(prefill).toHaveTextContent("Nothing is booked");

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.objectContaining({
        method: "POST",
      }));
    });
  });

  it("turns deal contact links into confirmed Concierge review tasks", async () => {
    let triggerBody: {
      action_summary?: string;
      action_payload?: Record<string, unknown>;
      auto_start?: boolean;
      use_case?: string;
    } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes("/api/offers/search")) {
        return jsonResponse({
          category: "Household costs",
          decision_explanation: "This option has the best mix of price, trust, ease, and fit.",
          neutrality_note: "No provider paid for placement.",
          source_guidance: ["official or regulated comparison sources"],
          protection_summary: {
            title: "Objective check",
            checkpoints: ["No paid ranking."],
            notification_triggers: ["price change"],
            action_guardrail: "VYVA asks before contact, switching, or sharing details.",
          },
          options: [{
            label: "Opcion recomendada",
            name: "Senior Energy Saver",
            category: "Household costs",
            what_it_offers: "Lower-cost electric service.",
            price_or_advantage: "Estimated 18% monthly saving with no early switch.",
            why_good_option: "Strong fit for the current household profile.",
            distance_or_availability: "Available online.",
            contact_method: "Online or phone",
            phone: "+34 600 333 444",
            website: "https://example.com",
            trust_note: "Official source and verified tariff.",
            score: 91,
          }],
          next_step: "Confirm before contacting or switching.",
        });
      }
      if (String(url).includes("/api/concierge/actions/trigger")) {
        triggerBody = JSON.parse(String(init?.body));
        return jsonResponse({ pendingId: "deal-review-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-ride"));
    fireEvent.click(screen.getByRole("button", { name: /review available benefits/i }));
    fireEvent.click(screen.getByTestId("button-offers-search"));

    const prepareButton = await screen.findByTestId("button-provider-comparison-contact-senior-energy-saver-1");
    expect(prepareButton).toHaveTextContent("Prepare contact");
    expect(screen.getByTestId("provider-comparison-panel")).not.toHaveTextContent("/100");
    expect(screen.queryByRole("link", { name: /open now|call now/i })).not.toBeInTheDocument();

    fireEvent.click(prepareButton);

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Deal comparison ready");
    expect(prefill).toHaveTextContent("Deal comparison prepared: Senior Energy Saver.");
    expect(prefill).toHaveTextContent("Review deal");
    expect(prefill).toHaveTextContent("Nothing is sent, called, or opened until you confirm");

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(triggerBody).toMatchObject({
        use_case: "find_offers",
        auto_start: false,
        action_summary: "Deal comparison prepared: Senior Energy Saver.",
        action_payload: expect.objectContaining({
          flow_reference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
          task_type: "provider_contact_preparation",
          offer_name: "Senior Energy Saver",
          provider_name: "Senior Energy Saver",
          phone: "+34 600 333 444",
          website: "https://example.com",
          requested_tool: "phone_call",
          active_tool: "operator_review",
          confirmation_required_before_action: true,
          no_external_action_without_confirmation: true,
          user_confirmed: false,
          comparison: expect.objectContaining({
            name: "Senior Energy Saver",
            source_status: "unknown",
          }),
        }),
      });
    });
    expect(String(triggerBody?.action_payload?.draft_message)).toContain("Nothing is sent, called, or booked until you confirm.");
  });

  it("gates utility comparison offer links behind a prepared Concierge switch review", async () => {
    let triggerBody: {
      action_summary?: string;
      action_payload?: Record<string, unknown>;
      auto_start?: boolean;
      use_case?: string;
    } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.includes("/api/utilities/normalize")) {
        return jsonResponse({
          normalized_input: {
            utility_type: "electricity",
            postcode: "28013",
            provider: "Current Co",
            monthly_cost: 92,
            power_kw: 4.6,
            consumption_kwh: 260,
            billing_period_days: 30,
            total_cost: 92,
            has_social_bonus: null,
            confidence: 0.9,
            missing_fields: [],
          },
          can_compare: true,
        });
      }
      if (target.includes("/api/utilities/compare")) {
        return jsonResponse({
          normalized_input: {
            utility_type: "electricity",
            postcode: "28013",
            provider: "Current Co",
            monthly_cost: 92,
            power_kw: 4.6,
            consumption_kwh: 260,
            billing_period_days: 30,
            total_cost: 92,
            has_social_bonus: null,
            confidence: 0.9,
            missing_fields: [],
          },
          source_used: "CNMC",
          source_status: "success",
          source_url: "https://comparador.cnmc.gob.es/comparador/listado/electricidad",
          summary: {
            headline: "One tariff looks cheaper, but confirm terms first.",
            current_monthly_cost: 92,
            best_estimated_monthly_cost: 71,
            estimated_monthly_savings: 21,
          },
          results: [{
            provider: "Tarifa Clara",
            tariff_name: "Luz Senior",
            estimated_monthly_cost: 71,
            estimated_annual_cost: 852,
            estimated_monthly_savings: 21,
            contract_type: "indexed",
            permanence: "none",
            price_stability: "variable",
            green_energy: true,
            source: "CNMC",
            source_url: "https://comparador.cnmc.gob.es/comparador/listado/electricidad",
            provider_url: "https://tarifaclara.example/luz-senior",
            action_label: "View offers",
            confidence: "high",
            notes: ["Confirm taxes and permanence."],
          }],
          calculation_note: "Compared current bill against estimated tariffs.",
          estimated_note: "Savings are estimates.",
          neutrality_note: "No provider paid for placement.",
          source_note: "CNMC comparison.",
        });
      }
      if (target.includes("/api/concierge/actions/trigger")) {
        triggerBody = JSON.parse(String(init?.body));
        return jsonResponse({ pendingId: "utility-switch-review-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-ride"));
    fireEvent.click(screen.getByRole("button", { name: /Household costs/i }));
    fireEvent.click(screen.getByRole("button", { name: /Fill manually/i }));
    fireEvent.change(screen.getByPlaceholderText("Postcode"), { target: { value: "28013" } });
    fireEvent.change(screen.getByPlaceholderText("Approx monthly cost"), { target: { value: "92" } });
    fireEvent.change(screen.getByPlaceholderText("Current provider optional"), { target: { value: "Current Co" } });
    fireEvent.click(screen.getByRole("button", { name: /Prepare comparison/i }));

    expect(await screen.findByTestId("button-utilities-compare")).toBeEnabled();
    fireEvent.click(screen.getByTestId("button-utilities-compare"));

    const reviewButton = await screen.findByTestId("button-utility-option-review-0");
    expect(reviewButton).toHaveTextContent("View offers");
    expect(screen.getByTestId("badge-utility-option-gated-0")).toHaveTextContent("Link after your OK");
    expect(screen.queryByRole("link", { name: /View offers/i })).not.toBeInTheDocument();

    fireEvent.click(reviewButton);

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Deal comparison ready");
    expect(prefill).toHaveTextContent("Deal comparison prepared: Tarifa Clara - Luz Senior.");
    expect(prefill).toHaveTextContent("Review switch");

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(triggerBody).toMatchObject({
        use_case: "find_offers",
        auto_start: false,
        action_summary: "Deal comparison prepared: Tarifa Clara - Luz Senior.",
        action_payload: expect.objectContaining({
          flow_reference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
          task_type: "utility_switch_review",
          review_target: "Tarifa Clara - Luz Senior",
          provider_name: "Tarifa Clara",
          tariff_name: "Luz Senior",
          estimated_monthly_cost: 71,
          estimated_monthly_savings: 21,
          website: "https://comparador.cnmc.gob.es/comparador/listado/electricidad",
          requested_tool: "operator_review",
          active_tool: "operator_review",
          confirmation_required_before_action: true,
          no_external_action_without_confirmation: true,
          user_confirmed: false,
        }),
      });
    });
    expect(String(triggerBody?.action_payload?.draft_message)).toContain("Do not open, switch, call, or share details without my confirmation.");
  });

  it("prepares utility WhatsApp summaries inside Concierge instead of opening WhatsApp directly", async () => {
    const openMock = vi.spyOn(window, "open").mockImplementation(() => null);
    let triggerBody: {
      action_summary?: string;
      action_payload?: Record<string, unknown>;
      auto_start?: boolean;
      use_case?: string;
    } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.includes("/api/utilities/normalize")) {
        return jsonResponse({
          normalized_input: {
            utility_type: "electricity",
            postcode: "28013",
            provider: "Current Co",
            monthly_cost: 92,
            power_kw: 4.6,
            consumption_kwh: 260,
            billing_period_days: 30,
            total_cost: 92,
            has_social_bonus: null,
            confidence: 0.9,
            missing_fields: [],
          },
          can_compare: true,
        });
      }
      if (target.includes("/api/utilities/compare")) {
        return jsonResponse({
          normalized_input: {
            utility_type: "electricity",
            postcode: "28013",
            provider: "Current Co",
            monthly_cost: 92,
            power_kw: 4.6,
            consumption_kwh: 260,
            billing_period_days: 30,
            total_cost: 92,
            has_social_bonus: null,
            confidence: 0.9,
            missing_fields: [],
          },
          source_used: "CNMC",
          source_status: "success",
          source_url: "https://comparador.cnmc.gob.es/comparador/listado/electricidad",
          summary: {
            headline: "One tariff looks cheaper, but confirm terms first.",
            current_monthly_cost: 92,
            best_estimated_monthly_cost: 71,
            estimated_monthly_savings: 21,
          },
          results: [{
            provider: "Tarifa Clara",
            tariff_name: "Luz Senior",
            estimated_monthly_cost: 71,
            estimated_annual_cost: 852,
            estimated_monthly_savings: 21,
            contract_type: "indexed",
            permanence: "none",
            price_stability: "variable",
            green_energy: true,
            source: "CNMC",
            source_url: "https://comparador.cnmc.gob.es/comparador/listado/electricidad",
            provider_url: "https://tarifaclara.example/luz-senior",
            action_label: "View offers",
            confidence: "high",
            notes: ["Confirm taxes and permanence."],
          }],
          calculation_note: "Compared current bill against estimated tariffs.",
          estimated_note: "Savings are estimates.",
          neutrality_note: "No provider paid for placement.",
          source_note: "CNMC comparison.",
        });
      }
      if (target.includes("/api/concierge/actions/trigger")) {
        triggerBody = JSON.parse(String(init?.body));
        return jsonResponse({ pendingId: "utility-whatsapp-summary-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-ride"));
    fireEvent.click(screen.getByRole("button", { name: /Household costs/i }));
    fireEvent.click(screen.getByRole("button", { name: /Fill manually/i }));
    fireEvent.change(screen.getByPlaceholderText("Postcode"), { target: { value: "28013" } });
    fireEvent.change(screen.getByPlaceholderText("Approx monthly cost"), { target: { value: "92" } });
    fireEvent.change(screen.getByPlaceholderText("Current provider optional"), { target: { value: "Current Co" } });
    fireEvent.click(screen.getByRole("button", { name: /Prepare comparison/i }));

    expect(await screen.findByTestId("button-utilities-compare")).toBeEnabled();
    fireEvent.click(screen.getByTestId("button-utilities-compare"));
    fireEvent.click(await screen.findByRole("button", { name: /Send summary by WhatsApp/i }));

    expect(openMock).not.toHaveBeenCalled();
    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Deal comparison ready");
    expect(prefill).toHaveTextContent("Comparison summary prepared for WhatsApp.");
    expect(prefill).toHaveTextContent("Prepare WhatsApp");

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(triggerBody).toMatchObject({
        use_case: "find_offers",
        auto_start: false,
        action_summary: "Comparison summary prepared for WhatsApp.",
        action_payload: expect.objectContaining({
          flow_reference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
          task_type: "utility_whatsapp_summary",
          requested_tool: "whatsapp",
          active_tool: "operator_review",
          execution_channel: "manual",
          confirmation_required_before_action: true,
          no_external_action_without_confirmation: true,
          user_confirmed: false,
        }),
      });
    });
    expect(String(triggerBody?.action_payload?.draft_message)).toContain("Do not open WhatsApp or send anything without my confirmation.");
  });

  it("turns provider results into clear prepared-contact tasks", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes("/api/offers/search")) {
        return jsonResponse({
          category: "Care options",
          decision_explanation: "Ranked by fit, trust, access, and cost clarity.",
          neutrality_note: "No provider paid for placement.",
          source_guidance: ["verified local directories", "public reviews"],
          protection_summary: {
            title: "Protected search",
            checkpoints: ["No contact without confirmation."],
            notification_triggers: [],
            action_guardrail: "VYVA asks before contacting anyone.",
          },
          options: [{
            label: "Opcion recomendada",
            name: "Marbella Care Clinic",
            category: "Care",
            what_it_offers: "Personal care assessment.",
            price_or_advantage: "Clear first-visit price.",
            why_good_option: "Close, trusted, and accessible.",
            distance_or_availability: "1.2 km away and available this week.",
            contact_method: "Phone",
            phone: "+34 600 111 222",
            trust_note: "Verified reviews and published contact.",
            source_label: "Verified local directory",
            source_status: "verified",
            comparison: {
              distance: { value: "1.2 km", status: "verified", source: "Verified local directory" },
              price: { value: "Clear first-visit price", status: "reported", source: "Clinic website" },
              reputation: { value: "Verified public reviews", status: "reported", source: "Public reviews" },
              availability: { value: "Available this week", status: "reported", source: "Clinic website" },
              accessibility: { value: "Step-free entrance", status: "reported", source: "Clinic website" },
              coverage: { value: null, status: "unknown", source: null },
            },
            score: 88,
            score_breakdown: {
              distance: 90,
              price_value: 78,
              trust: 86,
              simplicity: 82,
              preference_match: 84,
            },
          }],
          next_step: "Confirm before contacting any provider.",
        });
      }
      if (String(url).includes("/api/concierge/actions/trigger")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.use_case).toBe("find_provider");
        expect(body.auto_start).toBe(false);
        expect(body.action_summary).toBe("Provider search prepared: Marbella Care Clinic.");
        expect(body.action_payload).toMatchObject({
          flow_reference: CONCIERGE_FLOW_REFERENCES.careNavigation,
          requested_tool: "operator_review",
          action_label: "Prepare contact",
          provider_search_mode: "personal-care",
          selected_provider_name: "Marbella Care Clinic",
          provider_name: "Marbella Care Clinic",
          provider_phone: "+34 600 111 222",
          confirmation_required_before_action: true,
          no_external_action_without_confirmation: true,
        });
        expect(body.action_payload.draft_message).toContain("Help me prepare contact with Marbella Care Clinic");
        expect(body.action_payload.draft_message).toContain("Chosen criteria:");
        expect(body.action_payload.draft_message).toContain("Do not call, book, message, or share details without my confirmation.");
        return jsonResponse({ pendingId: "provider-contact-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-ride"));
    fireEvent.click(screen.getByTestId("button-provider-criterion-clear-price"));
    fireEvent.click(screen.getByTestId("button-offers-search"));

    const comparison = await screen.findByTestId("provider-comparison-panel");
    expect(comparison).toHaveTextContent("1.2 km");
    expect(comparison).toHaveTextContent("Clear first-visit price");
    expect(comparison).toHaveTextContent("Step-free entrance");
    expect(comparison).toHaveTextContent("Insurance / coverage");
    expect(comparison).toHaveTextContent("Not provided");
    expect(comparison).toHaveTextContent("Why this may suit you");
    expect(comparison).not.toHaveTextContent("/100");
    expect(screen.queryByRole("button", { name: /watch changes/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-provider-comparison-contact-marbella-care-clinic-1"));

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Care search ready");
    expect(prefill).toHaveTextContent("Provider search prepared: Marbella Care Clinic.");
    expect(prefill).toHaveTextContent("Prepare contact");
    expect(screen.getByTestId("button-concierge-prefill-send")).toHaveTextContent("Prepare contact");

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.objectContaining({
        method: "POST",
      }));
    });
  }, 60000);

  it("saves a provider shortlist without contact and preserves search context when saving a trusted provider", async () => {
    let shortlistTrigger: Record<string, unknown> | null = null;
    let shortlistCompletion: Record<string, unknown> | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.includes("/api/offers/search")) {
        return jsonResponse({
          category: "Care options",
          decision_explanation: "Compare known facts and keep gaps visible.",
          neutrality_note: "No provider paid for placement.",
          source_guidance: ["verified local directories"],
          options: [
            {
              label: "Option 1",
              name: "Harbour Clinic",
              category: "Care",
              what_it_offers: "Care assessment",
              price_or_advantage: "EUR 60 first visit",
              why_good_option: "Nearby",
              distance_or_availability: "1.2 km | Tuesday",
              contact_method: "Phone",
              phone: "+34 600 111 222",
              trust_note: "Public reviews",
              source_label: "Regional directory",
              source_status: "verified",
              score: 90,
            },
            {
              label: "Option 2",
              name: "Garden Care",
              category: "Care",
              what_it_offers: "Home assessment",
              price_or_advantage: "Price not provided",
              why_good_option: "Home visits",
              distance_or_availability: "3 km | This week",
              contact_method: "Website",
              website: "https://garden.example.test",
              trust_note: "Community listing",
              source_label: "Community directory",
              source_status: "reported",
              score: 76,
            },
          ],
          next_step: "Confirm before contacting anyone.",
        });
      }
      if (target.endsWith("/api/concierge/actions/trigger")) {
        shortlistTrigger = JSON.parse(String(init?.body));
        return jsonResponse({ pendingId: "shortlist-1", status: "pending" });
      }
      if (target.endsWith("/api/concierge/actions/shortlist-1/complete")) {
        shortlistCompletion = JSON.parse(String(init?.body));
        return jsonResponse({ success: true });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-ride"));
    fireEvent.click(screen.getByTestId("button-offers-search"));

    fireEvent.click(await screen.findByTestId("button-provider-shortlist-harbour-clinic-1"));
    fireEvent.click(screen.getByTestId("button-provider-shortlist-garden-care-2"));
    fireEvent.click(screen.getByTestId("button-provider-shortlist-save"));

    await waitFor(() => {
      expect(shortlistTrigger).toMatchObject({
        use_case: "find_provider",
        auto_start: false,
        action_payload: expect.objectContaining({
          task_type: "provider_shortlist",
          selected_provider_names: ["Harbour Clinic", "Garden Care"],
          shortlist_status: "open",
          shortlist_captured_at: expect.any(String),
          no_external_action_without_confirmation: true,
        }),
      });
    });
    expect(shortlistCompletion).toBeNull();
    expect(screen.getByTestId("notice-provider-shortlist")).toHaveTextContent("In progress");
    expect(screen.getByTestId("notice-provider-shortlist")).toHaveTextContent("Nobody was contacted");

    fireEvent.click(screen.getByTestId("button-provider-comparison-save-harbour-clinic-1"));
    expect(screen.getByTestId("location-path")).toHaveTextContent("/onboarding/profile/providers");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Harbour Clinic");
    expect(screen.getByTestId("route-state")).toHaveTextContent("provider_search");
    expect(screen.getByTestId("route-state")).toHaveTextContent("personal-care");
  });

  it("reopens an active provider shortlist and lets the user edit and finish a preferred choice", async () => {
    const shortlistOption = (id: string, name: string) => ({
      id,
      name,
      category: "Doctor",
      summary: "Appointments",
      why_may_suit_you: "Nearby",
      facts: {
        distance: { criterion: "distance", value: "2 km", status: "reported" },
        price: { criterion: "price", value: null, status: "unknown" },
        reputation: { criterion: "reputation", value: null, status: "unknown" },
        availability: { criterion: "availability", value: null, status: "unknown" },
        accessibility: { criterion: "accessibility", value: null, status: "unknown" },
        coverage: { criterion: "coverage", value: null, status: "unknown" },
      },
      contact: {},
      source_label: "Local directory",
      source_status: "reported",
    });
    let pendingItems = [{
      id: "shortlist-active-1",
      use_case: "find_provider",
      provider_name: "Harbour Clinic",
      provider_phone: null,
      action_summary: "Provider shortlist saved: Harbour Clinic, Garden Care.",
      action_payload: {
        task_type: "provider_shortlist",
        shortlist_version: 1,
        shortlist_only: true,
        shortlist_captured_at: "2020-01-01T10:00:00.000Z",
        shortlist_updated_at: "2020-01-01T10:00:00.000Z",
        shortlist_status: "open",
        preferred_provider_id: null,
        preferred_provider_name: null,
        provider_search_mode: "specialist",
        provider_search_query: "doctor nearby",
        criteria: ["nearby", "reputation"],
        flow_reference: "CF_MEDICAL_APPOINTMENT",
        selected_provider_names: ["Harbour Clinic", "Garden Care"],
        provider_shortlist: [
          shortlistOption("harbour", "Harbour Clinic"),
          shortlistOption("garden", "Garden Care"),
        ],
        no_external_action_without_confirmation: true,
      },
      status: "pending" as const,
      language: "en",
    }];
    const patches: Record<string, unknown>[] = [];
    let completion: Record<string, unknown> | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/pending")) return jsonResponse({ items: pendingItems });
      if (target.endsWith("/api/concierge/actions/sessions")) return jsonResponse({ items: [] });
      if (target.endsWith("/api/concierge/actions/shortlist-active-1/details")) {
        const body = JSON.parse(String(init?.body)) as { action_payload: Record<string, unknown> };
        patches.push(body.action_payload);
        pendingItems = [{ ...pendingItems[0], action_payload: body.action_payload }];
        return jsonResponse({ ok: true, item: pendingItems[0] });
      }
      if (target.endsWith("/api/concierge/actions/shortlist-active-1/complete")) {
        completion = JSON.parse(String(init?.body));
        pendingItems = [];
        return jsonResponse({ ok: true, status: "completed" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([{ pathname: "/concierge", state: { focusRightNow: true, conciergePendingId: "shortlist-active-1" } }]);

    expect(await screen.findByTestId("provider-shortlist-follow-up")).toHaveTextContent("2 saved options");
    expect(screen.getByTestId("provider-shortlist-stale-warning")).toHaveTextContent("Details may have changed");
    expect(screen.queryByTestId("panel-concierge-next-action")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-provider-shortlist-garden"));
    await waitFor(() => expect(patches.at(-1)).toMatchObject({ selected_provider_names: ["Harbour Clinic"] }));

    fireEvent.click(screen.getByTestId("button-provider-comparison-choose-harbour"));
    await waitFor(() => expect(patches.at(-1)).toMatchObject({
      preferred_provider_id: "harbour",
      preferred_provider_name: "Harbour Clinic",
    }));

    await waitFor(() => expect(screen.getByTestId("button-provider-shortlist-finish")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("button-provider-shortlist-finish"));
    await waitFor(() => expect(completion).toMatchObject({
      outcome_payload: expect.objectContaining({
        shortlist_status: "preferred_selected",
        preferred_provider_name: "Harbour Clinic",
        no_external_action_taken: true,
      }),
    }));
  });

  it("rechecks an active shortlist without replacing its saved snapshot", async () => {
    const shortlistOption = (id: string, name: string, price: string, availability: string) => ({
      id,
      name,
      category: "Doctor",
      summary: "Appointments",
      why_may_suit_you: "Nearby",
      facts: {
        distance: { criterion: "distance", value: "2 km", status: "reported" },
        price: { criterion: "price", value: price, status: "reported" },
        reputation: { criterion: "reputation", value: "4.4/5", status: "reported" },
        availability: { criterion: "availability", value: availability, status: "reported" },
        accessibility: { criterion: "accessibility", value: null, status: "unknown" },
        coverage: { criterion: "coverage", value: null, status: "unknown" },
      },
      contact: {},
      source_label: "Saved directory",
      source_status: "reported",
    });
    const originalOptions = [
      shortlistOption("harbour", "Harbour Clinic", "EUR 60", "Tuesday"),
      shortlistOption("garden", "Garden Care", "EUR 55", "Friday"),
    ];
    let pendingItems = [{
      id: "shortlist-recheck-1",
      use_case: "find_provider",
      provider_name: "Harbour Clinic",
      provider_phone: null,
      action_summary: "Provider shortlist saved: Harbour Clinic, Garden Care.",
      action_payload: {
        task_type: "provider_shortlist",
        shortlist_version: 1,
        shortlist_only: true,
        shortlist_captured_at: "2020-01-01T10:00:00.000Z",
        shortlist_updated_at: "2020-01-01T10:00:00.000Z",
        shortlist_status: "open",
        preferred_provider_id: null,
        preferred_provider_name: null,
        provider_search_mode: "specialist",
        provider_search_query: "doctor nearby",
        criteria: ["nearby", "reputation"],
        flow_reference: "CF_MEDICAL_APPOINTMENT",
        selected_provider_names: ["Harbour Clinic", "Garden Care"],
        provider_shortlist: originalOptions,
        no_external_action_without_confirmation: true,
      },
      status: "pending" as const,
      language: "en",
    }];
    let searchBody: {
      query?: string;
      provider_mode?: string;
      recheck_context?: {
        preferred_sources?: string[];
        criteria?: string[];
        providers?: Array<{ id?: string; name?: string; official_website?: string | null; directory_url?: string | null }>;
      };
    } | null = null;
    let patchedPayload: Record<string, unknown> | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/pending")) return jsonResponse({ items: pendingItems });
      if (target.endsWith("/api/concierge/actions/sessions")) return jsonResponse({ items: [] });
      if (target.endsWith("/api/offers/search")) {
        searchBody = JSON.parse(String(init?.body));
        return jsonResponse({
          category: "Doctor",
          options: [{
            name: "Harbour Clinic",
            category: "Doctor",
            what_it_offers: "Appointments",
            phone: "+34 600 999 888",
            source_label: "Current directory",
            source_status: "verified",
            source_type: "directory",
            source_url: "https://directory.example/harbour",
            checked_at: "2026-07-10T12:00:00.000Z",
            comparison: {
              price: { criterion: "price", value: "EUR 75", status: "verified", source: "Clinic website", source_type: "provider_owned", checked_at: "2026-07-10T11:50:00.000Z" },
              availability: { criterion: "availability", value: "Wednesday", status: "reported", source: "Current directory", source_type: "directory", checked_at: "2026-07-10T12:00:00.000Z" },
              reputation: { criterion: "reputation", value: "4.4/5", status: "reported", source: "Public reviews", source_type: "platform", checked_at: "2026-07-10T12:00:00.000Z" },
            },
          }],
          decision_explanation: "Current options",
          neutrality_note: "Neutral search",
          source_guidance: [],
          next_step: "Review changes",
        });
      }
      if (target.endsWith("/api/concierge/actions/shortlist-recheck-1/details")) {
        const body = JSON.parse(String(init?.body)) as { action_payload: Record<string, unknown> };
        patchedPayload = body.action_payload;
        pendingItems = [{ ...pendingItems[0], action_payload: body.action_payload }];
        return jsonResponse({ ok: true, item: pendingItems[0] });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([{ pathname: "/concierge", state: { focusRightNow: true, conciergePendingId: "shortlist-recheck-1" } }]);
    fireEvent.click(await screen.findByTestId("button-provider-shortlist-recheck"));

    await waitFor(() => expect(searchBody?.query).toContain("doctor nearby"));
    expect(searchBody?.provider_mode).toBe("specialist");
    expect(searchBody?.recheck_context).toMatchObject({
      preferred_sources: ["official", "provider_owned", "regulated", "directory"],
      criteria: ["price", "availability", "accessibility", "coverage", "reputation"],
      providers: [
        { id: "harbour", name: "Harbour Clinic", official_website: null, directory_url: null },
        { id: "garden", name: "Garden Care", official_website: null, directory_url: null },
      ],
    });
    await waitFor(() => expect(patchedPayload).toMatchObject({
      provider_shortlist: originalOptions,
      shortlist_recheck_status: "providers_unavailable",
      shortlist_recheck_changed_count: 3,
      shortlist_recheck_unavailable_count: 1,
      shortlist_latest_options: [expect.objectContaining({
        name: "Harbour Clinic",
        source_type: "directory",
        checked_at: "2026-07-10T12:00:00.000Z",
        facts: expect.objectContaining({
          price: expect.objectContaining({
            sourceType: "provider_owned",
            checkedAt: "2026-07-10T11:50:00.000Z",
          }),
        }),
      })],
      no_external_action_without_confirmation: true,
    }));
    expect(await screen.findByTestId("provider-shortlist-change-review")).toHaveTextContent("What changed");
    expect(screen.getByTestId("provider-shortlist-review-harbour")).toHaveTextContent("EUR 60");
    expect(screen.getByTestId("provider-shortlist-review-harbour")).toHaveTextContent("EUR 75");
    expect(screen.getByTestId("provider-shortlist-review-garden")).toHaveTextContent("Not found in the latest check");
    expect(screen.getByTestId("button-provider-comparison-contact-garden")).toBeDisabled();
  });

  it("keeps final confirmation when a shortlist choice becomes a contact task", async () => {
    const shortlistPayload = {
      task_type: "provider_shortlist",
      shortlist_version: 1,
      shortlist_only: true,
      shortlist_captured_at: "2026-07-15T10:00:00.000Z",
      shortlist_updated_at: "2026-07-15T10:00:00.000Z",
      shortlist_status: "open",
      preferred_provider_id: null,
      preferred_provider_name: null,
      provider_search_mode: "specialist",
      provider_search_query: "doctor nearby",
      criteria: ["nearby"],
      flow_reference: "CF_MEDICAL_APPOINTMENT",
      selected_provider_names: ["Harbour Clinic"],
      provider_shortlist: [{
        id: "harbour",
        name: "Harbour Clinic",
        category: "Doctor",
        summary: "Appointments",
        why_may_suit_you: "Nearby",
        facts: {},
        contact: { phone: "+34 600 111 222", preferredChannel: "phone" },
        source_label: "Local directory",
        source_status: "reported",
      }],
      no_external_action_without_confirmation: true,
    };
    let pendingItems = [{
      id: "shortlist-contact-1",
      use_case: "find_provider",
      provider_name: "Harbour Clinic",
      provider_phone: "+34 600 111 222",
      action_summary: "Provider shortlist saved: Harbour Clinic.",
      action_payload: shortlistPayload,
      status: "pending" as const,
      language: "en",
    }];
    let contactTrigger: Record<string, unknown> | null = null;
    const shortlistPatches: Record<string, unknown>[] = [];
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/pending")) return jsonResponse({ items: pendingItems });
      if (target.endsWith("/api/concierge/actions/sessions")) return jsonResponse({ items: [] });
      if (target.endsWith("/api/concierge/actions/shortlist-contact-1/details")) {
        const body = JSON.parse(String(init?.body)) as { action_payload: typeof shortlistPayload };
        shortlistPatches.push(body.action_payload);
        pendingItems = [{ ...pendingItems[0], action_payload: body.action_payload }];
        return jsonResponse({ ok: true, item: pendingItems[0] });
      }
      if (target.endsWith("/api/concierge/actions/trigger")) {
        contactTrigger = JSON.parse(String(init?.body));
        return jsonResponse({ pendingId: "contact-task-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([{ pathname: "/concierge", state: { focusRightNow: true, conciergePendingId: "shortlist-contact-1" } }]);
    fireEvent.click(await screen.findByTestId("button-provider-comparison-contact-harbour"));

    expect(await screen.findByTestId("button-concierge-prefill-send")).toHaveTextContent("Prepare contact");
    expect(screen.getByTestId("panel-concierge-route-prefill")).toHaveTextContent("Nothing is sent, called, or opened until you confirm");
    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => expect(contactTrigger).toMatchObject({
      auto_start: false,
      action_payload: expect.objectContaining({
        source_shortlist_pending_id: "shortlist-contact-1",
        selected_provider_name: "Harbour Clinic",
        confirmation_required_before_action: true,
        no_external_action_without_confirmation: true,
        user_confirmed: false,
      }),
    }));
    await waitFor(() => expect(shortlistPatches.at(-1)).toMatchObject({
      shortlist_status: "contact_prepared",
      preferred_provider_name: "Harbour Clinic",
      related_contact_task_pending_id: "contact-task-1",
      contact_handoff_status: "ready_for_confirmation",
      confirmation_still_required: true,
      no_external_action_taken: true,
    }));
  });

  it("shows the verified handoff and returns an unavailable provider to the saved shortlist", async () => {
    const option = {
      id: "harbour",
      name: "Harbour Clinic",
      category: "Doctor",
      summary: "Appointments",
      why_may_suit_you: "Nearby",
      facts: {
        distance: { criterion: "distance", value: "2 km", status: "reported" },
        price: { criterion: "price", value: null, status: "unknown" },
        reputation: { criterion: "reputation", value: null, status: "unknown" },
        availability: { criterion: "availability", value: null, status: "unknown" },
        accessibility: { criterion: "accessibility", value: null, status: "unknown" },
        coverage: { criterion: "coverage", value: null, status: "unknown" },
      },
      contact: { phone: "+34 600 111 222", preferredChannel: "phone" },
      source_label: "Regional directory",
      source_status: "verified",
      source_type: "directory",
      checked_at: "2026-07-15T10:00:00.000Z",
    };
    const shortlist = {
      id: "handoff-shortlist-1",
      use_case: "find_provider",
      provider_name: "Harbour Clinic",
      provider_phone: "+34 600 111 222",
      action_summary: "Provider shortlist saved: Harbour Clinic.",
      action_payload: {
        task_type: "provider_shortlist",
        shortlist_version: 1,
        shortlist_only: true,
        shortlist_captured_at: "2026-07-15T10:00:00.000Z",
        shortlist_updated_at: "2026-07-15T10:00:00.000Z",
        shortlist_status: "contact_prepared",
        preferred_provider_id: "harbour",
        preferred_provider_name: "Harbour Clinic",
        provider_search_mode: "specialist",
        provider_search_query: "doctor nearby",
        criteria: ["nearby"],
        flow_reference: "CF_MEDICAL_APPOINTMENT",
        selected_provider_names: ["Harbour Clinic"],
        provider_shortlist: [option],
        no_external_action_without_confirmation: true,
      },
      status: "pending" as const,
      language: "en",
    };
    const contact = {
      id: "handoff-contact-1",
      use_case: "find_provider",
      provider_name: "Harbour Clinic",
      provider_phone: "+34 600 111 222",
      action_summary: "Contact prepared with Harbour Clinic.",
      action_payload: {
        task_type: "provider_contact_preparation",
        live_handoff_flow: "verified_provider_contact_v1",
        live_handoff_status: "waiting",
        mission_status: "awaiting_provider_reply",
        selected_provider_name: "Harbour Clinic",
        source_shortlist_pending_id: "handoff-shortlist-1",
        comparison: { id: "harbour" },
        execution_channel: "phone",
        preferred_channel: "phone",
        call_script: "Hello Harbour Clinic. Please confirm availability and price.",
        provider_verification: {
          status: "verified",
          source: "Regional directory",
          checked_at: "2026-07-15T10:00:00.000Z",
        },
        no_external_action_without_confirmation: true,
      },
      status: "pending" as const,
      language: "en",
      confirmed_at: "2026-07-15T10:05:00.000Z",
    };
    let pendingItems = [contact, shortlist];
    let shortlistPatch: Record<string, unknown> | null = null;
    let contactCompletion: Record<string, unknown> | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/pending")) return jsonResponse({ items: pendingItems });
      if (target.endsWith("/api/concierge/actions/sessions")) return jsonResponse({ items: [] });
      if (target.endsWith("/api/concierge/actions/handoff-shortlist-1/details")) {
        const body = JSON.parse(String(init?.body)) as { action_payload: Record<string, unknown> };
        shortlistPatch = body.action_payload;
        pendingItems = pendingItems.map((item) => item.id === shortlist.id ? { ...shortlist, action_payload: body.action_payload } : item);
        return jsonResponse({ ok: true });
      }
      if (target.endsWith("/api/concierge/actions/handoff-contact-1/complete")) {
        contactCompletion = JSON.parse(String(init?.body));
        pendingItems = pendingItems.filter((item) => item.id !== contact.id);
        return jsonResponse({ ok: true, status: "completed" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([{ pathname: "/concierge", state: { focusRightNow: true, conciergePendingId: "handoff-contact-1" } }]);

    expect(await screen.findByTestId("panel-provider-contact-handoff")).toHaveTextContent("What VYVA will say or send");
    expect(screen.getByTestId("panel-provider-contact-handoff")).toHaveTextContent("Please confirm availability and price");
    fireEvent.click(screen.getByTestId("button-provider-reply-unavailable-handoff-contact-1"));

    await waitFor(() => expect(shortlistPatch).toMatchObject({
      shortlist_status: "open",
      preferred_provider_id: null,
      contact_handoff_status: "unavailable",
      contact_unavailable_provider_ids: ["harbour"],
    }));
    await waitFor(() => expect(contactCompletion).toMatchObject({
      outcome_payload: expect.objectContaining({
        provider_unavailable: true,
        returned_to_shortlist: true,
      }),
    }));
    expect(await screen.findByTestId("provider-shortlist-follow-up")).toHaveTextContent("Choose another saved option");
    expect(screen.getByTestId("button-provider-comparison-contact-harbour")).toBeDisabled();
  });

  it("records a verified provider reply and resumes the source shortlist", async () => {
    const option = {
      id: "harbour",
      name: "Harbour Clinic",
      category: "Doctor",
      summary: "Appointments",
      why_may_suit_you: "Nearby",
      facts: {
        distance: { criterion: "distance", value: "2 km", status: "reported" },
        price: { criterion: "price", value: null, status: "unknown" },
        reputation: { criterion: "reputation", value: null, status: "unknown" },
        availability: { criterion: "availability", value: null, status: "unknown" },
        accessibility: { criterion: "accessibility", value: null, status: "unknown" },
        coverage: { criterion: "coverage", value: null, status: "unknown" },
      },
      contact: { phone: "+34 600 111 222", preferredChannel: "phone" },
      source_label: "Regional directory",
      source_status: "verified",
      source_type: "directory",
      checked_at: "2026-07-15T10:00:00.000Z",
    };
    const shortlist = {
      id: "success-shortlist-1",
      use_case: "find_provider",
      provider_name: "Harbour Clinic",
      provider_phone: "+34 600 111 222",
      action_summary: "Provider shortlist saved: Harbour Clinic.",
      action_payload: {
        task_type: "provider_shortlist",
        shortlist_version: 1,
        shortlist_only: true,
        shortlist_captured_at: "2026-07-15T10:00:00.000Z",
        shortlist_updated_at: "2026-07-15T10:00:00.000Z",
        shortlist_status: "contact_prepared",
        preferred_provider_id: "harbour",
        preferred_provider_name: "Harbour Clinic",
        provider_search_mode: "specialist",
        provider_search_query: "doctor nearby",
        criteria: ["nearby"],
        flow_reference: "CF_MEDICAL_APPOINTMENT",
        selected_provider_names: ["Harbour Clinic"],
        provider_shortlist: [option],
        no_external_action_without_confirmation: true,
      },
      status: "pending" as const,
      language: "en",
    };
    const contact = {
      id: "success-contact-1",
      use_case: "find_provider",
      provider_name: "Harbour Clinic",
      provider_phone: "+34 600 111 222",
      action_summary: "Waiting for Harbour Clinic.",
      action_payload: {
        task_type: "provider_contact_preparation",
        live_handoff_flow: "verified_provider_contact_v1",
        live_handoff_status: "waiting",
        mission_status: "awaiting_provider_reply",
        selected_provider_name: "Harbour Clinic",
        source_shortlist_pending_id: "success-shortlist-1",
        comparison: { id: "harbour" },
        execution_channel: "phone",
        call_script: "Hello Harbour Clinic. Please confirm availability and price.",
        provider_verification: { status: "verified", source: "Regional directory" },
        no_external_action_without_confirmation: true,
      },
      status: "calling" as const,
      language: "en",
      confirmed_at: "2026-07-15T10:05:00.000Z",
    };
    let pendingItems = [contact, shortlist];
    let shortlistPatch: Record<string, unknown> | null = null;
    let contactPatch: Record<string, unknown> | null = null;
    let contactCompletion: { outcome_payload?: Record<string, unknown> } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/pending")) return jsonResponse({ items: pendingItems });
      if (target.endsWith("/api/concierge/actions/sessions")) return jsonResponse({ items: [] });
      if (target.endsWith("/api/concierge/actions/success-shortlist-1/details")) {
        const body = JSON.parse(String(init?.body)) as { action_payload: Record<string, unknown> };
        shortlistPatch = body.action_payload;
        pendingItems = pendingItems.map((item) => item.id === shortlist.id ? { ...shortlist, action_payload: body.action_payload } : item);
        return jsonResponse({ ok: true });
      }
      if (target.endsWith("/api/concierge/actions/success-contact-1/details")) {
        const body = JSON.parse(String(init?.body)) as { action_payload: Record<string, unknown> };
        contactPatch = body.action_payload;
        pendingItems = pendingItems.map((item) => item.id === contact.id ? { ...contact, action_payload: body.action_payload } : item);
        return jsonResponse({ ok: true, item: pendingItems[0] });
      }
      if (target.endsWith("/api/concierge/actions/success-contact-1/complete")) {
        contactCompletion = JSON.parse(String(init?.body));
        pendingItems = pendingItems.filter((item) => item.id !== contact.id);
        return jsonResponse({ ok: true, status: "completed" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([{ pathname: "/concierge", state: { focusRightNow: true, conciergePendingId: "success-contact-1" } }]);

    expect(await screen.findByTestId("panel-provider-contact-handoff")).toHaveTextContent("Harbour Clinic");
    fireEvent.click(screen.getByTestId("button-provider-reply-confirmed-success-contact-1"));
    fireEvent.change(screen.getByTestId("input-provider-reply-time-success-contact-1"), { target: { value: "Friday 10:30" } });
    fireEvent.change(screen.getByTestId("input-provider-reply-reference-success-contact-1"), { target: { value: "HC-908" } });
    fireEvent.change(screen.getByTestId("input-provider-reply-price-success-contact-1"), { target: { value: "EUR 65" } });
    fireEvent.change(screen.getByTestId("input-provider-reply-follow-up-success-contact-1"), { target: { value: "Bring insurance card" } });
    fireEvent.click(screen.getByTestId("button-provider-reply-save-success-contact-1"));

    await waitFor(() => expect(contactPatch).toMatchObject({
      provider_task_status: "reply_received",
      provider_reply_status: "confirmed",
      scheduled_for: "Friday 10:30",
      reference: "HC-908",
      price: "EUR 65",
      follow_up: "Bring insurance card",
      provider_follow_up_confirmed: false,
    }));
    expect(await screen.findByTestId("panel-concierge-provider-reply")).toHaveTextContent("Reply received");
    fireEvent.click(screen.getByTestId("button-provider-reply-mark-complete-success-contact-1"));
    await waitFor(() => expect(contactCompletion?.outcome_payload).toMatchObject({
      provider_task_status: "done",
      provider_reply_status: "confirmed",
      provider_reply_source: "live",
    }));
    await waitFor(() => expect(shortlistPatch).toMatchObject({
      shortlist_status: "preferred_selected",
      preferred_provider_id: "harbour",
      contact_handoff_status: "completed",
      contact_handoff_provider_name: "Harbour Clinic",
      related_contact_task_pending_id: null,
    }));
    expect(await screen.findByTestId("provider-shortlist-follow-up")).toHaveTextContent("Harbour Clinic");
  });

  it("adds provider search criteria to care option searches", async () => {
    let searchBody: { query?: string; locale?: string; provider_mode?: string } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes("/api/offers/search")) {
        searchBody = JSON.parse(String(init?.body));
        return jsonResponse({
          category: "Care options",
          decision_explanation: "Ranked by fit, trust, access, and cost clarity.",
          neutrality_note: "No provider paid for placement.",
          source_guidance: ["verified local directories", "public reviews"],
          protection_summary: {
            title: "Protected search",
            checkpoints: ["No contact without confirmation."],
            notification_triggers: [],
            action_guardrail: "VYVA asks before contacting anyone.",
          },
          options: [],
          next_step: "Confirm before contacting any provider.",
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-ride"));

    expect(screen.getByTestId("panel-provider-search-criteria")).toHaveTextContent("What matters most");
    expect(screen.getByTestId("button-provider-criterion-nearby")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("button-provider-criterion-reputation")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("button-provider-criterion-accessible")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByTestId("button-provider-criterion-clear-price"));
    fireEvent.click(screen.getByTestId("button-offers-search"));

    await waitFor(() => {
      expect(searchBody?.query).toContain("compare a specialist, personal care, or residence");
    });
    expect(searchBody?.locale).toBe("en");
    expect(searchBody?.provider_mode).toBe("personal-care");
    expect(searchBody?.query).toContain("nearby or easy to reach");
    expect(searchBody?.query).toContain("strong reputation with verifiable reviews");
    expect(searchBody?.query).toContain("accessible for older adults");
    expect(searchBody?.query).toContain("clear pricing and no hidden fees");
    expect(searchBody?.query).toContain("Do not contact or share details without confirmation");
  });

  it("offers manual search and setup fallbacks when provider results are empty", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).includes("/api/offers/search")) {
        return jsonResponse({
          category: "Care options",
          decision_explanation: "Ranked by fit, trust, access, and cost clarity.",
          neutrality_note: "No provider paid for placement.",
          source_guidance: ["verified local directories"],
          protection_summary: {
            title: "Protected search",
            checkpoints: ["No contact without confirmation."],
            notification_triggers: [],
            action_guardrail: "VYVA asks before contacting anyone.",
          },
          no_results_message: "No verified provider matched those needs.",
          options: [],
          next_step: "Save a trusted provider or ask VYVA to search manually.",
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-ride"));
    fireEvent.click(screen.getByTestId("button-offers-search"));

    expect(await screen.findByText("No verified provider matched those needs.")).toBeVisible();
    expect(screen.getByTestId("button-provider-search-manual")).toHaveTextContent("Ask VYVA to search");
    expect(screen.getByTestId("button-provider-search-setup")).toHaveTextContent("Add or choose provider");

    fireEvent.click(screen.getByTestId("button-provider-search-setup"));

    expect(screen.getByTestId("location-path")).toHaveTextContent("/onboarding/profile/providers");
    expect(screen.getByTestId("route-state")).toHaveTextContent("personal_care");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Add or choose a trusted provider");
    expect(screen.getByTestId("route-state")).toHaveTextContent(CONCIERGE_FLOW_REFERENCES.careNavigation);
  });

  it("shows provider search follow-through and routes saving to trusted providers", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "provider-search-active",
            use_case: "find_provider",
            provider_name: "VYVA review",
            provider_phone: "+34 600 111 222",
            action_summary: "Provider search prepared: Marbella Care Clinic.",
            action_payload: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.careNavigation,
              action_label: "Prepare contact",
              execution_channel: "manual",
              draft_message: [
                "Help me prepare contact with Marbella Care Clinic.",
                "Type: personal care.",
                "Chosen criteria: Nearby, Good reputation, Easy access.",
                "Available contact: +34 600 111 222.",
                "Do not call, book, message, or share details without my confirmation.",
              ].join("\n"),
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const panel = await screen.findByTestId("panel-provider-search-follow-through");
    expect(panel).toHaveTextContent("Provider shortlisted");
    expect(panel).toHaveTextContent("Marbella Care Clinic");
    expect(panel).toHaveTextContent("Personal care");
    expect(panel).toHaveTextContent("Nearby, Good reputation, Easy access");
    expect(panel).toHaveTextContent("Nothing is contacted without your OK");

    fireEvent.click(screen.getByTestId("button-provider-search-save-provider-provider-search-active"));

    expect(screen.getByTestId("location-path")).toHaveTextContent("/onboarding/profile/providers");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Save provider from Concierge");
    expect(screen.getByTestId("route-state")).toHaveTextContent("personal_care");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Marbella Care Clinic");
    expect(screen.getByTestId("route-state")).toHaveTextContent("+34 600 111 222");
  });

  it("lets provider search users record replies or prepare another search", async () => {
    let triggerBody: { action_payload?: { draft_message?: string }; action_summary?: string; use_case?: string } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "provider-search-active",
            use_case: "find_provider",
            provider_name: "VYVA review",
            provider_phone: null,
            action_summary: "Provider search prepared: Marbella Care Clinic.",
            action_payload: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.careNavigation,
              action_label: "Prepare contact",
              execution_channel: "manual",
              draft_message: [
                "Help me prepare contact with Marbella Care Clinic.",
                "Type: personal care.",
                "Chosen criteria: Nearby, Good reputation.",
                "Do not call, book, message, or share details without my confirmation.",
              ].join("\n"),
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      if (String(url).includes("/api/concierge/actions/trigger")) {
        triggerBody = JSON.parse(String(init?.body));
        return jsonResponse({ pendingId: "provider-search-alt", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    fireEvent.click(await screen.findByTestId("button-provider-search-reply-provider-search-active"));
    expect(screen.getByTestId("panel-provider-reply-confirmed-provider-search-active")).toBeInTheDocument();
    expect(screen.getByTestId("input-provider-reply-text-provider-search-active")).toHaveValue("");

    fireEvent.click(screen.getByTestId("button-provider-search-try-another-provider-search-active"));

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Care search ready");
    expect(prefill).toHaveTextContent("Alternative provider search prepared.");
    expect(prefill).toHaveTextContent("Find another provider");

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(triggerBody).toMatchObject({
        use_case: "find_provider",
        action_summary: "Alternative provider search prepared.",
        action_payload: expect.objectContaining({
          draft_message: expect.stringContaining("Find another option similar to Marbella Care Clinic"),
          no_external_action_without_confirmation: true,
        }),
      });
    });
    expect(triggerBody?.action_payload?.draft_message).toContain("Do not contact or share details without my confirmation");
  });

  it("collects plumber intake, stores app origin, and automatically searches when no saved provider exists", async () => {
    type HomeServiceRequestBody = {
      appointment_type?: string;
      detail?: string;
      preferences?: {
        service_intake?: Record<string, unknown>;
        [key: string]: unknown;
      };
    };
    let createdBody: HomeServiceRequestBody | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.includes("/api/appointments/requests/request-home-service/discover-options")) {
        expect(init?.method).toBe("POST");
        return jsonResponse({
          request: {
            id: "request-home-service",
            appointment_type: "home-service",
            reason_detail: createdBody?.detail,
            preferences: createdBody?.preferences,
            status: "options_ready",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [{
            id: "option-plumber",
            provider_id: null,
            provider_source: "external",
            provider_snapshot: {
              name: "Marbella Rapid Plumbing",
              address: "Avenida Ricardo Soriano 3",
              phone: "+34 600 111 222",
              preferred_channel: "phone",
            },
            match_reason: "Verified local plumbing option",
            available_channels: ["phone", "manual"],
            rank: 1,
            status: "recommended",
          }],
          discovery: { source: "google_places", inserted_count: 1 },
        });
      }
      if (target.endsWith("/api/appointments/requests")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body)) as HomeServiceRequestBody;
        createdBody = body;
        expect(body.appointment_type).toBe("home-service");
        expect(body.detail).toContain("Plumber needed");
        expect(body.detail).toContain("Leak");
        expect(body.detail).not.toContain("Water leaking under the kitchen sink");
        expect(body.preferences.service_intake).toMatchObject({
          version: "home-service-intake-v1",
          origin: "app",
          service_type: "plumber",
          urgency: "today",
          answers: expect.objectContaining({
            home_address: "Calle Home 10, 29602 Marbella",
            problem_type: "leak",
            active_flooding: "yes",
            affected_area: "kitchen",
            shutoff_status: "cannot_find",
          }),
        });
        expect(body.preferences).toMatchObject({
          home_address: "Calle Home 10, 29602 Marbella",
          home_address_source: "session",
        });
        expect(body.preferences.service_intake.safety_flags).toContain("active_water_damage");
        return jsonResponse({
          request: {
            id: "request-home-service",
            appointment_type: "home-service",
            reason_detail: body.detail,
            preferences: body.preferences,
            status: "needs_provider",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-service"));
    await dismissHomeServiceGuide();

    expect(await screen.findByTestId("panel-appointment-assistant")).toHaveTextContent("Home service");
    expect(screen.queryByTestId("panel-appointment-home-service-summary")).not.toBeInTheDocument();
    expect(screen.getByTestId("panel-home-service-intake")).toBeVisible();
    expect(screen.getByTestId("button-appointment-start-home-service")).toHaveTextContent("Find trusted options");
    expect(screen.getByTestId("button-appointment-start-home-service")).toBeDisabled();

    fireEvent.click(screen.getByTestId("button-home-service-type-plumber"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-today"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-leak"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-yes"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-kitchen"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-cannot_find"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-trusted"));

    expect(screen.getByTestId("panel-home-service-address")).toHaveTextContent("Where should the provider come?");
    expect(screen.getByTestId("button-appointment-start-home-service")).toBeDisabled();
    fireEvent.change(screen.getByTestId("input-home-service-address"), {
      target: { value: "Calle Home 10, 29602 Marbella" },
    });
    fireEvent.click(screen.getByTestId("button-home-service-address-save"));

    expect(screen.getByTestId("panel-home-service-ready")).toHaveTextContent("Ready");
    expect(screen.getByTestId("panel-home-service-readiness")).toHaveTextContent("Current path: VYVA review");
    expect(screen.getByTestId("panel-home-service-readiness")).toHaveTextContent("Recipient: Trusted search");
    expect(screen.getByTestId("button-appointment-start-home-service")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("button-appointment-start-home-service"));

    expect(await screen.findByText("Marbella Rapid Plumbing")).toBeVisible();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/appointments/requests/request-home-service/discover-options", expect.objectContaining({ method: "POST" }));
  });

  it("asks electrician-specific questions instead of plumbing questions", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-service"));
    await dismissHomeServiceGuide();
    fireEvent.click(screen.getByTestId("button-home-service-type-electrician"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-today"));

    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent("What kind of electrical issue?");
    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent("Breaker trips");
    expect(screen.getByTestId("panel-home-service-question")).not.toHaveTextContent("Blocked drain");
  });

  it("switches electrician danger answers into emergency actions before provider search", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target.endsWith("/api/onboarding/state")) {
        return jsonResponse({
          profile: {
            country: "ES",
            emergency_contact: {
              name: "Maria",
              primary_phone: "+34 612 345 678",
            },
          },
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-service"));
    await dismissHomeServiceGuide();
    fireEvent.click(screen.getByTestId("button-home-service-type-electrician"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-today"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-socket_light"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-one_fixture"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-danger_now"));

    const emergencyPanel = screen.getByTestId("panel-home-service-emergency");
    expect(emergencyPanel).toHaveTextContent("Safety first");
    expect(screen.getByTestId("button-home-service-call-emergency")).toHaveAttribute("href", "tel:112");
    expect(await screen.findByTestId("button-home-service-call-caregiver")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.queryByTestId("button-appointment-start-home-service")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-home-service-safe-for-now"));

    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent("What matters most?");
  });

  it("asks powered-medical-equipment only for outage-style electrician requests", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-service"));
    await dismissHomeServiceGuide();
    fireEvent.click(screen.getByTestId("button-home-service-type-electrician"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-today"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-power_outage"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-whole_home"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-safe_for_now"));

    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent("powered medical equipment");
  });

  it("asks other service users what service they need before urgency", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-service"));
    await dismissHomeServiceGuide();
    fireEvent.click(screen.getByTestId("button-home-service-type-other"));

    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent("What service do you need?");
    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent("Current question");
    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent("Step 1 of 3");
    expect(screen.getByTestId("panel-home-service-question")).not.toHaveTextContent("How urgent is it?");
    fireEvent.change(screen.getByPlaceholderText(/gardener/i), {
      target: { value: "Pest control" },
    });
    fireEvent.click(screen.getByTestId("button-home-service-answer-next"));

    expect(screen.getByTestId("panel-home-service-intake")).toHaveTextContent("Pest control");
    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent("How urgent is it?");
    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent("Step 2 of 3");
  });

  it("prepares a Concierge request instead of showing raw feature-access errors for home service", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/appointments/requests")) {
        return errorResponse(503, {
          error: "Could not verify feature access",
          code: "FEATURE_ACCESS_UNAVAILABLE",
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-service"));
    await dismissHomeServiceGuide();
    fireEvent.click(screen.getByTestId("button-home-service-type-other"));
    fireEvent.change(screen.getByPlaceholderText(/gardener/i), {
      target: { value: "Pest control" },
    });
    fireEvent.click(screen.getByTestId("button-home-service-answer-next"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-today"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-trusted"));
    fireEvent.change(screen.getByTestId("input-home-service-address"), {
      target: { value: "Calle Home 10, 29602 Marbella" },
    });
    fireEvent.click(screen.getByTestId("button-home-service-address-save"));

    expect(screen.getByTestId("panel-home-service-ready")).toHaveTextContent("Ready");
    const startButton = screen.getByTestId("button-appointment-start-home-service");
    expect(startButton).not.toBeDisabled();
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/appointments/requests",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const appointmentCall = apiFetchMock.mock.calls.find(([url]) => String(url).endsWith("/api/appointments/requests"));
    expect(appointmentCall?.[1]?.method).toBe("POST");
    const requestBody = JSON.parse(String(appointmentCall?.[1]?.body));
    expect(requestBody.appointment_type).toBe("home-service");
    expect(requestBody.detail).toContain("Pest control");
    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Review request");
    expect(prefill).toHaveTextContent("Key details");
    expect(prefill).toHaveTextContent("Pest control");
    expect(prefill).toHaveTextContent("Nothing is booked");
    expect(prefill).toHaveTextContent("without your confirmation");
    expect(prefill).not.toHaveTextContent("access error");
    expect(screen.queryByText("Could not verify feature access")).not.toBeInTheDocument();
  });

  it("keeps government tasks in the admin flow instead of creating appointment requests", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/appointments/requests")) {
        throw new Error("Government tasks should not create appointment requests");
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.change(screen.getByPlaceholderText("E.g. dermatology, Tuesday morning, WhatsApp if possible"), {
      target: { value: "Please help me schedule a passport renewal appointment" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Government" }));

    const fields = await screen.findByTestId("panel-insurance-admin-guided-fields");
    expect(fields).toHaveTextContent("Government/admin form");
    expect(screen.getByTestId("input-insurance-admin-subject")).toHaveValue("Please help me schedule a passport renewal appointment");
    expect(screen.queryByTestId("panel-concierge-route-prefill")).not.toBeInTheDocument();
    expect(screen.queryByText("I could not verify access right now. Please try again.")).not.toBeInTheDocument();
    expect(screen.queryByText("Could not verify feature access")).not.toBeInTheDocument();
  });

  it("turns a voice plumber payload into the same structured service intake", async () => {
    voiceActionMock.action = {
      id: "voice-home-service-1",
      actionType: "concierge.home_service",
      domain: "concierge",
      route: "/concierge",
      title: "Home service help",
      summary: "Opening Concierge",
      cue: "Prepare trusted options",
      sourceText: "I need a plumber today",
      priority: "high",
      feedbackReason: "User asked for a plumber",
      payload: {
        intake_origin: "voice",
        service_type: "plumber",
        urgency: "today",
        problem_summary: "Water leaking under the kitchen sink",
        problem_type: "leak",
        active_flooding: "yes",
        affected_area: "kitchen",
        shutoff_status: "cannot_find",
        criteria: "trusted",
        access_notes: "Caregiver can open the door",
      },
    };
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target === "/api/profile") {
        return jsonResponse({
          street: "Calle Home 10",
          cityState: "Marbella",
          postalCode: "29602",
          country: "ES",
          savedProviders: [{
            name: "Saved Plumber",
            role: "plumber",
            phone: "+34 600 222 333",
            email: "plumber@example.com",
            whatsapp: "+34 600 222 334",
            bookingUrl: "https://plumber.example/book",
            preferredChannel: "whatsapp",
          }],
        });
      }
      if (target.endsWith("/api/appointments/requests/request-voice-home-service/confirm-attempt")) {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({
          option_id: "option-saved-plumber",
          channel: "whatsapp",
        });
        return jsonResponse({
          attempt: { id: "attempt-home-service", channel: "whatsapp", status: "whatsapp_sent" },
          pending: { pendingId: "pending-home-service", status: "queued" },
          communication: {
            id: "communication-home-service",
            channel: "whatsapp",
            recipient: "+34 600 222 334",
            status: "sent",
          },
          handled_by_vyva: true,
          needs_booking_confirmation: true,
        });
      }
      if (target.endsWith("/api/concierge/actions/pending-home-service/complete")) {
        const body = JSON.parse(String(init?.body));
        expect(body.outcome_summary).toContain("Home service visit confirmed with Saved Plumber");
        expect(body.outcome_payload).toMatchObject({
          flow_reference: CONCIERGE_FLOW_REFERENCES.homeService,
          appointment_request_id: "request-voice-home-service",
          appointment_type: "home-service",
          provider_name: "Saved Plumber",
          service_type: "plumber",
          service_label: "Plumber",
          urgency: "today",
          criteria: "trusted",
          estimated_cost: "EUR80",
          scheduled_event_id: "scheduled-home-service",
        });
        expect(body.outcome_payload.safety_flags).toEqual(expect.arrayContaining(["active_water_damage"]));
        return jsonResponse({ ok: true, status: "completed", sessionId: "session-home-service" });
      }
      if (target.endsWith("/api/appointments/requests/request-voice-home-service/mark-booked")) {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({
          provider_name: "Saved Plumber",
          location: "Calle Home 10, 29602 Marbella, ES",
        });
        expect(body.notes).toContain("Provider reply: Can visit tomorrow at 10:00. Estimated cost EUR80.");
        expect(body.notes).toContain("Notes: Caregiver will open the door.");
        return jsonResponse({
          scheduled_event: {
            id: "scheduled-home-service",
            scheduled_for: body.scheduled_for,
            title: "Saved Plumber",
          },
          mission: {
            status: "booked",
            current_step: "Saved",
            preferred_channel: "whatsapp",
            user_control_state: {
              listening: false,
              muted: false,
              stopped: true,
              awaiting_confirmation: false,
            },
            activity_log: ["Saved"],
          },
        });
      }
      if (target.endsWith("/api/appointments/requests")) {
        const body = JSON.parse(String(init?.body));
        expect(body.preferences.service_intake).toMatchObject({
          origin: "voice",
          service_type: "plumber",
          answers: expect.objectContaining({
            home_address: "Calle Home 10, 29602 Marbella, ES",
          }),
        });
        expect(body.preferences).toMatchObject({
          home_address: "Calle Home 10, 29602 Marbella, ES",
          home_address_source: "profile",
        });
        expect(body.preferences.service_intake).toMatchObject({
          answers: expect.objectContaining({
            problem_type: "leak",
          }),
        });
        expect(body.preferences.service_intake.answers).not.toHaveProperty("problem_summary");
        expect(body.preferences.service_intake.answers).not.toHaveProperty("access_notes");
        return jsonResponse({
          request: {
            id: "request-voice-home-service",
            appointment_type: "home-service",
            reason_detail: body.detail,
            preferences: body.preferences,
            status: "options_ready",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [{
            id: "option-saved-plumber",
            provider_id: "provider-1",
            provider_source: "saved",
            provider_snapshot: {
              name: "Saved Plumber",
              phone: "+34 600 222 333",
              email: "plumber@example.com",
              whatsapp: "+34 600 222 334",
              booking_url: "https://plumber.example/book",
              preferred_channel: "whatsapp",
            },
            match_reason: "Saved plumber provider",
            available_channels: ["whatsapp", "booking_url", "phone", "email", "manual"],
            rank: 1,
            status: "recommended",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    expect(await screen.findByTestId("panel-home-service-ready")).toHaveTextContent("Ready");
    await waitFor(() => {
      expect(screen.getByTestId("panel-home-service-readiness")).toHaveTextContent("Tool ready");
      expect(screen.getByTestId("panel-home-service-readiness")).toHaveTextContent("Direct tool: WhatsApp");
      expect(screen.getByTestId("panel-home-service-readiness")).toHaveTextContent("Recipient: Saved Plumber");
    });
    await waitFor(() => {
      expect(screen.getByTestId("button-appointment-start-home-service")).not.toBeDisabled();
    });
    fireEvent.click(screen.getByTestId("button-appointment-start-home-service"));

    expect(await screen.findByText("Saved Plumber")).toBeVisible();
    expect(screen.getByTestId("panel-appointment-readiness")).toHaveTextContent("Direct tool: WhatsApp");
    expect(screen.getByTestId("panel-appointment-confirmation-checkpoint")).toHaveTextContent("Tool ready: WhatsApp");
    expect(screen.getByTestId("panel-appointment-confirmation-checkpoint")).toHaveTextContent("Address: saved");
    expect(screen.queryByTestId("panel-home-service-address")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-appointment-handle-provider"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/appointments/requests/request-voice-home-service/confirm-attempt",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("VYVA sent the message. Save the appointment when they reply.")).toBeVisible();
    expect(screen.getByTestId("panel-appointment-mark-booked")).toHaveTextContent("Review and confirm visit");

    fireEvent.change(screen.getByTestId("input-appointment-provider-reply"), {
      target: { value: "Can visit tomorrow at 10:00. Estimated cost EUR80." },
    });
    fireEvent.change(screen.getByTestId("input-appointment-confirmed-time"), {
      target: { value: "2026-08-04T10:00" },
    });
    fireEvent.change(screen.getByTestId("input-appointment-confirmed-note"), {
      target: { value: "Caregiver will open the door." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save confirmed visit" }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/appointments/requests/request-voice-home-service/mark-booked",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("Appointment saved in Scheduled Support. The task is closed.")).toBeVisible();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/pending-home-service/complete", expect.objectContaining({ method: "POST" }));
  });

  it("still prepares ride requests without booking", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await showBookRideFastHelp());
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByTestId("panel-concierge-route-prefill")).toHaveTextContent("Transport options");
      expect(screen.getByTestId("panel-concierge-route-prefill")).toHaveTextContent("Compare safe ways");
      expect(screen.getByTestId("panel-concierge-route-prefill")).toHaveTextContent("Save a provider first");
    });
  });

  it("opens an insurance admin router and prepares a claim review request", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes("/api/concierge/actions/trigger")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.use_case).toBe("admin_task");
        expect(body.auto_start).toBe(false);
        expect(body.provider_name).toBe("VYVA review");
        expect(body.action_summary).toBe("Paperwork task prepared: Claim or reimbursement.");
        expect(body.action_payload).toMatchObject({
          flow_reference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
          task_type: "claim",
          admin_task: "Claim or reimbursement",
          action_type: "email",
          detail: "Reimbursement for taxi receipt",
          recipient: "Seguro Salud",
          deadline: "Friday",
          requested_tool: "email",
          active_tool: "operator_review",
          readiness_status: "manual_review",
          execution_channel: "manual",
          action_label: "Claim or reimbursement",
          confirmation_required_before_action: true,
          review_fallback: true,
          no_external_action_without_confirmation: true,
        });
        expect(body.action_payload.draft_message).toContain("Help me prepare a claim or reimbursement");
        expect(body.action_payload.draft_message).toContain("Subject: Reimbursement for taxi receipt.");
        expect(body.action_payload.draft_message).toContain("Recipient: Seguro Salud.");
        expect(body.action_payload.draft_message).toContain("Deadline: Friday.");
        return jsonResponse({ pendingId: "admin-task-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-fast-fill-form"));

    const panel = await screen.findByTestId("panel-insurance-admin");
    expect(panel).toHaveTextContent("What do you need to prepare?");
    expect(panel).toHaveTextContent("Insurance letter or bill");
    expect(panel).toHaveTextContent("Claim or reimbursement");
    expect(panel).toHaveTextContent("Government/admin form");
    expect(panel).toHaveTextContent("Call or email someone");
    expect(screen.getByTestId("panel-insurance-admin-readiness-insurance-letter")).toHaveTextContent("Tool ready");
    expect(screen.getByTestId("panel-insurance-admin-readiness-insurance-letter")).toHaveTextContent("Direct tool: camera or upload");
    expect(screen.getByTestId("panel-insurance-admin-readiness-government-form")).toHaveTextContent("Current path: camera or upload");
    expect(screen.getByTestId("panel-insurance-admin-readiness-claim")).toHaveTextContent("Direct tool: email");
    expect(screen.getByTestId("panel-insurance-admin-readiness-claim")).toHaveTextContent("Current path: VYVA review");
    expect(screen.getByTestId("panel-insurance-admin-readiness-claim")).toHaveTextContent("Needs: email");
    expect(screen.getByTestId("panel-insurance-admin-readiness-call-email")).toHaveTextContent("Direct tool: phone call");
    expect(screen.getByTestId("panel-insurance-admin-readiness-call-email")).toHaveTextContent("Review path ready");
    expect(screen.getByTestId("panel-insurance-admin-readiness-call-email")).toHaveTextContent("Needs: phone number");

    fireEvent.click(screen.getByTestId("button-insurance-admin-claim"));
    expect(await screen.findByTestId("panel-insurance-admin-guided-fields")).toHaveTextContent("Claim or reimbursement");
    fireEvent.change(screen.getByTestId("input-insurance-admin-subject"), {
      target: { value: "Reimbursement for taxi receipt" },
    });
    fireEvent.change(screen.getByTestId("input-insurance-admin-recipient"), {
      target: { value: "Seguro Salud" },
    });
    fireEvent.change(screen.getByTestId("input-insurance-admin-deadline"), {
      target: { value: "Friday" },
    });
    fireEvent.change(screen.getByTestId("input-insurance-admin-notes"), {
      target: { value: "EUR35 receipt" },
    });
    fireEvent.click(screen.getByTestId("button-insurance-admin-prepare"));

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Paperwork task ready");
    expect(prefill).toHaveTextContent("Help me prepare a claim or reimbursement");
    expect(prefill).toHaveTextContent("Subject: Reimbursement for taxi receipt");
    expect(prefill).toHaveTextContent("Recipient: Seguro Salud");
    expect(prefill).toHaveTextContent("Add to Right now");
    expect(prefill).toHaveTextContent("Nothing is booked or requested without your confirmation");
    expect(screen.queryByTestId("panel-insurance-admin")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(screen.queryByTestId("panel-concierge-route-prefill")).not.toBeInTheDocument();
  }, 60000);

  it("turns Home Find Care prefills into structured provider-search tasks", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes("/api/concierge/actions/trigger")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.use_case).toBe("find_provider");
        expect(body.auto_start).toBe(false);
        expect(body.provider_name).toBe("VYVA review");
        expect(body.action_summary).toBe("VYVA prepares trusted options before contacting anyone.");
        expect(body.action_payload).toMatchObject({
          flow_reference: CONCIERGE_FLOW_REFERENCES.careNavigation,
          requested_tool: "operator_review",
          active_tool: "operator_review",
          readiness_status: "ready",
          execution_channel: "manual",
          action_label: "Prepare care search",
          confirmation_required_before_action: true,
          review_fallback: true,
          no_external_action_without_confirmation: true,
          source: "home_quick_action",
        });
        expect(body.action_payload.draft_message).toContain("Help me find care or support options");
        return jsonResponse({ pendingId: "provider-search-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([{
      pathname: "/concierge",
      state: {
        conciergePrefill: {
          kind: "task",
          message: "Help me find care or support options. Ask what kind of care I need and do not contact anyone without my confirmation.",
          flowReference: CONCIERGE_FLOW_REFERENCES.careNavigation,
          requestedTool: "operator_review",
          actionLabel: "Prepare care search",
          summary: "VYVA prepares trusted options before contacting anyone.",
          useCase: "find_provider",
          source: "home_quick_action",
        },
      },
    }]);

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Care search ready");
    expect(prefill).toHaveTextContent("VYVA prepares trusted options before contacting anyone.");
    expect(prefill).toHaveTextContent("Prepare care search");
    expect(prefill).toHaveTextContent("Add to Right now");

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(screen.queryByTestId("panel-concierge-route-prefill")).not.toBeInTheDocument();
  }, 60000);

  it("turns shopping prefills into confirmed concierge review tasks", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes("/api/concierge/actions/trigger")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.use_case).toBe("shopping_request");
        expect(body.auto_start).toBe(false);
        expect(body.provider_name).toBe("VYVA review");
        expect(body.action_summary).toBe("VYVA prepares a shopping request. Nothing is ordered, paid, or sent without confirmation.");
        expect(body.action_payload).toMatchObject({
          flow_reference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
          requested_tool: "operator_review",
          active_tool: "operator_review",
          readiness_status: "ready",
          execution_channel: "manual",
          action_label: "Prepare request",
          confirmation_required_before_action: true,
          review_fallback: true,
          no_external_action_without_confirmation: true,
          source: "shopping_helper",
        });
        expect(body.action_payload.draft_message).toContain("Help me prepare a safe shopping request");
        expect(body.action_payload.draft_message).toContain("Do not start checkout");
        return jsonResponse({ pendingId: "shopping-request-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([{
      pathname: "/concierge",
      state: {
        conciergePrefill: {
          kind: "task",
          message: "Help me prepare a safe shopping request.\nNeed: groceries for the week.\nDo not start checkout, payment, or contact anyone without my confirmation.",
          flowReference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
          requestedTool: "operator_review",
          actionLabel: "Prepare request",
          summary: "VYVA prepares a shopping request. Nothing is ordered, paid, or sent without confirmation.",
          useCase: "shopping_request",
          source: "shopping_helper",
        },
      },
    }]);

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Shopping request ready");
    expect(prefill).toHaveTextContent("Nothing is ordered, paid, or sent without confirmation.");
    expect(prefill).toHaveTextContent("Prepare request");
    expect(prefill).toHaveTextContent("Add to Right now");

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(screen.queryByTestId("panel-concierge-route-prefill")).not.toBeInTheDocument();
  }, 60000);

  it("opens a scam check router and prepares a safe review request", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes("/api/concierge/actions/trigger")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.use_case).toBe("scam_check");
        expect(body.auto_start).toBe(false);
        expect(body.provider_name).toBe("VYVA review");
        expect(body.action_summary).toBe("Safe check prepared: Company or offer.");
        expect(body.action_payload).toMatchObject({
          flow_reference: CONCIERGE_FLOW_REFERENCES.scamCheck,
          source_type: "company",
          review_kind: "scam_or_safety_check",
          review_source: "Acme Deals https://example.test/offer",
          company_name: "Acme Deals https://example.test/offer",
          concern: "Company or offer",
          requested_tool: "web_search",
          active_tool: "web_search",
          readiness_status: "ready",
          execution_channel: "manual",
          action_label: "Company or offer",
          confirmation_required_before_action: true,
          review_fallback: false,
          no_external_action_without_confirmation: true,
        });
        expect(body.action_payload.draft_message).toContain("Help me check a company, offer, seller, or service reputation online");
        expect(body.action_payload.draft_message).toContain("User detail: Acme Deals https://example.test/offer.");
        return jsonResponse({ pendingId: "scam-check-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await showScamCheckFastHelp());
    vi.useRealTimers();

    const panel = await screen.findByTestId("panel-scam-check");
    expect(panel).toHaveTextContent("Check a possible scam");
    expect(panel).toHaveTextContent("Email or message");
    expect(panel).toHaveTextContent("Document or photo");
    expect(panel).toHaveTextContent("Phone number");
    expect(panel).toHaveTextContent("Company or offer");
    expect(screen.getByTestId("panel-scam-check-readiness-email")).toHaveTextContent("Review path ready");
    expect(screen.getByTestId("panel-scam-check-readiness-email")).toHaveTextContent("Direct tool: email");
    expect(screen.getByTestId("panel-scam-check-readiness-email")).toHaveTextContent("Current path: VYVA review");
    expect(screen.getByTestId("panel-scam-check-readiness-email")).toHaveTextContent("Needs: email");
    expect(screen.getByTestId("panel-scam-check-readiness-document")).toHaveTextContent("Tool ready");
    expect(screen.getByTestId("panel-scam-check-readiness-document")).toHaveTextContent("Direct tool: camera or upload");
    expect(screen.getByTestId("panel-scam-check-readiness-phone")).toHaveTextContent("Direct tool: web search");
    expect(screen.getByTestId("panel-scam-check-readiness-company")).toHaveTextContent("Tool ready");
    expect(screen.getByTestId("panel-scam-check-readiness-company")).toHaveTextContent("Current path: web search");

    fireEvent.click(screen.getByTestId("button-scam-check-company"));
    expect(await screen.findByTestId("panel-scam-check-guided-fields")).toHaveTextContent("Company or offer");
    fireEvent.change(screen.getByTestId("input-scam-check-detail"), {
      target: { value: "Acme Deals https://example.test/offer" },
    });
    fireEvent.click(screen.getByTestId("button-scam-check-prepare"));

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Safe check ready");
    expect(prefill).toHaveTextContent("Help me check a company, offer, seller, or service reputation online");
    expect(prefill).toHaveTextContent("User detail: Acme Deals https://example.test/offer");
    expect(prefill).toHaveTextContent("Compare reliable signals");
    expect(prefill).toHaveTextContent("Add to Right now");
    expect(screen.queryByTestId("panel-scam-check")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(screen.queryByTestId("panel-concierge-route-prefill")).not.toBeInTheDocument();
  }, 60000);

  it("ignores malformed voice ride route state without blanking Concierge", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen([{
      pathname: "/concierge",
      state: {
        conciergePrefill: {
          kind: "ride",
        },
      },
    }]);

    expect(await screen.findByTestId("concierge-master-layout")).toBeVisible();
    expect(screen.queryByTestId("panel-concierge-route-prefill")).not.toBeInTheDocument();
    expect(screen.getByTestId("route-state")).toHaveTextContent("null");
  });

  it("replaces an open home service assistant when the ride card is tapped", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(screen.getByTestId("button-concierge-card-service"));
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent("Home service");
    expect(screen.getByTestId("panel-home-service-intake")).toBeVisible();

    fireEvent.click(await showBookRideFastHelp());
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByTestId("panel-concierge-transport")).toHaveTextContent("Transport options");
    });
    expect(screen.queryByTestId("panel-appointment-assistant")).not.toBeInTheDocument();
    expect(screen.queryByTestId("panel-home-service-intake")).not.toBeInTheDocument();
  });

  it("uses the trusted default transport provider and only asks for mobility when missing", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url) === "/api/profile") {
        return jsonResponse({
          savedProviders: [
            { name: "Unreviewed Taxi", role: "taxi", phone: "+34 600 000 000", isTrusted: false, isDefault: true },
            { name: "Trusted Taxi", role: "taxi", phone: "+34 600 111 222", preferredChannel: "phone", isTrusted: true, isDefault: true },
            { name: "Backup Taxi", role: "taxi", phone: "+34 600 222 222", isTrusted: true, isDefault: false },
          ],
          serviceReadiness: {
            hasSavedTransportProvider: true,
            hasMobilityInfo: true,
          },
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await showBookRideFastHelp());
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByTestId("note-transport-provider-readiness")).toHaveTextContent("Saved provider first: Trusted Taxi");
      expect(screen.getByTestId("note-transport-mobility-readiness")).toHaveTextContent("Mobility preferences saved");
      expect(screen.getByTestId("panel-transport-readiness")).toHaveTextContent("Tool ready");
      expect(screen.getByTestId("panel-transport-readiness")).toHaveTextContent("Direct tool: phone call");
      expect(screen.getByTestId("panel-transport-readiness")).toHaveTextContent("Recipient: Trusted Taxi");
    });
    expect(screen.queryByTestId("button-transport-need-wheelchair-access")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-transport-find-options")).toBeDisabled();

    fireEvent.change(screen.getByTestId("input-transport-destination"), {
      target: { value: "Heart Clinic Madrid" },
    });

    expect(screen.getByTestId("button-transport-find-options")).not.toBeDisabled();
  });

  it("routes missing transport provider setup to trusted providers", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await showBookRideFastHelp());
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByTestId("note-transport-provider-readiness")).toHaveTextContent("No trusted provider selected");
      expect(screen.getByTestId("panel-transport-readiness")).toHaveTextContent("Current path: VYVA review");
    });
    expect(screen.getByTestId("button-transport-find-options")).toHaveTextContent("Add or choose transport");
    fireEvent.click(screen.getByTestId("button-transport-find-options"));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/onboarding/profile/providers");
      expect(screen.getByTestId("route-state")).toHaveTextContent("Add or choose a saved transport provider");
      expect(screen.getByTestId("route-state")).toHaveTextContent(CONCIERGE_FLOW_REFERENCES.transportBooking);
    });
  });

  it("requires pharmacy setup before OTC pharmacy help can start", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await showOtcPharmacyFastHelp());
    vi.useRealTimers();

    expect(await screen.findByTestId("panel-otc-pharmacy")).toHaveTextContent("Save a pharmacy first");
    expect(screen.getByTestId("panel-otc-pharmacy")).toHaveTextContent("Service not active yet");
    fireEvent.click(screen.getByTestId("button-otc-pharmacy-setup"));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/onboarding/profile/providers");
      expect(screen.getByTestId("route-state")).toHaveTextContent("Add a saved pharmacy");
      expect(screen.getByTestId("route-state")).toHaveTextContent(CONCIERGE_FLOW_REFERENCES.otcPharmacy);
    });
  });

  it("prepares OTC pharmacy requests only through a saved pharmacy", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url) === "/api/profile") {
        return jsonResponse({
          savedProviders: [{
            name: "Neighborhood Pharmacy",
            role: "pharmacy",
            phone: "+34 600 333 444",
            email: "pharmacy@example.com",
            whatsapp: "+34 600 333 445",
            bookingUrl: "https://pharmacy.example/order",
            preferredChannel: "whatsapp",
          }],
          serviceReadiness: { hasSavedPharmacy: true },
        });
      }
      if (String(url).includes("/api/concierge/actions/trigger")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.use_case).toBe("order_medicine");
        expect(body.provider_name).toBe("Neighborhood Pharmacy");
        expect(body.provider_phone).toBe("+34 600 333 444");
        expect(body.auto_start).toBe(false);
        expect(body.action_payload.provider_email).toBe("pharmacy@example.com");
        expect(body.action_payload.provider_whatsapp).toBe("+34 600 333 445");
        expect(body.action_payload.booking_url).toBe("https://pharmacy.example/order");
        expect(body.action_payload.preferred_channel).toBe("whatsapp");
        expect(body.action_payload.execution_channel).toBe("whatsapp");
        expect(body.action_payload.whatsapp_message).toContain("over-the-counter pharmacy items: Vitamins");
        expect(body.action_payload.whatsapp_message).toContain("Priorities: Nearby, Good reputation, Clear price, Soon.");
        expect(body.action_payload.criteria).toEqual(["nearby", "available-soon", "clear-price", "reputation"]);
        expect(body.action_payload.criteria_labels).toEqual(["Nearby", "Good reputation", "Clear price", "Soon"]);
        expect(body.action_payload.item_scope).toBe("over_the_counter_only");
        expect(body.action_payload.prescription_items_allowed).toBe(false);
        expect(body.action_payload.item_text).toBe("Vitamins");
        expect(body.action_payload.fulfillment_preference).toBe("pickup");
        expect(body.action_payload.requested_time).toBe("tomorrow");
        return jsonResponse({ pendingId: "otc-1", status: "pending" });
      }
      if (String(url).includes("/api/concierge/actions/otc-1/complete")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.outcome_summary).toBe("OTC pharmacy request saved with Neighborhood Pharmacy.");
        expect(body.outcome_payload).toMatchObject({
          flow_reference: "FLOW_OTC_PHARMACY",
          pharmacy_name: "Neighborhood Pharmacy",
          item_text: "Vitamins",
          item_scope: "over_the_counter_only",
          prescription_items_allowed: false,
          criteria: ["nearby", "available-soon", "clear-price", "reputation"],
          criteria_labels: ["Nearby", "Good reputation", "Clear price", "Soon"],
          fulfillment_preference: "pickup",
          requested_time: "tomorrow",
          availability: "Available after 5pm",
          cost_estimate: "EUR12",
          fulfillment_note: "Pickup counter",
          pharmacy_reference: "PH-22",
          notes: "Bring ID",
        });
        return jsonResponse({ ok: true, status: "completed", sessionId: "otc-session-1" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await showOtcPharmacyFastHelp());
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByTestId("panel-otc-pharmacy")).toHaveTextContent("Saved pharmacy: Neighborhood Pharmacy");
    });
    expect(screen.getByTestId("panel-otc-pharmacy-readiness")).toHaveTextContent("Tool ready");
    expect(screen.getByTestId("panel-otc-pharmacy-readiness")).toHaveTextContent("Direct tool: WhatsApp");
    expect(screen.getByTestId("panel-otc-pharmacy-readiness")).toHaveTextContent("Recipient: Neighborhood Pharmacy");
    expect(screen.getByTestId("button-otc-pharmacy-prepare")).toBeDisabled();

    fireEvent.change(screen.getByTestId("input-otc-pharmacy-item"), {
      target: { value: "Vitamins" },
    });
    fireEvent.click(screen.getByTestId("button-otc-fulfillment-pickup"));
    fireEvent.change(screen.getByTestId("input-otc-pharmacy-time"), {
      target: { value: "tomorrow" },
    });
    fireEvent.change(screen.getByTestId("input-otc-pharmacy-notes"), {
      target: { value: "Small bottle if possible" },
    });

    expect(screen.getByTestId("panel-otc-pharmacy-confirmation")).toHaveTextContent("OTC item: Vitamins");
    expect(screen.getByTestId("panel-otc-pharmacy-confirmation")).toHaveTextContent("Criteria: Nearby, Good reputation, Clear price, Soon");
    expect(screen.getByTestId("panel-otc-pharmacy-confirmation")).toHaveTextContent("Tool ready: WhatsApp");
    expect(screen.getByTestId("button-otc-pharmacy-prepare")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("button-otc-pharmacy-prepare"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(await screen.findByText("OTC request prepared. Confirm before VYVA contacts the pharmacy.")).toBeVisible();
    expect(screen.getByTestId("panel-otc-pharmacy-outcome")).toHaveTextContent("Pharmacy reply");
    expect(screen.getByTestId("button-otc-outcome-save")).toBeDisabled();

    fireEvent.change(screen.getByTestId("input-otc-outcome-availability"), {
      target: { value: "Available after 5pm" },
    });
    fireEvent.change(screen.getByTestId("input-otc-outcome-cost"), {
      target: { value: "EUR12" },
    });
    fireEvent.change(screen.getByTestId("input-otc-outcome-fulfillment"), {
      target: { value: "Pickup counter" },
    });
    fireEvent.change(screen.getByTestId("input-otc-outcome-reference"), {
      target: { value: "PH-22" },
    });
    fireEvent.change(screen.getByTestId("input-otc-outcome-notes"), {
      target: { value: "Bring ID" },
    });
    expect(screen.getByTestId("button-otc-outcome-save")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("button-otc-outcome-save"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/otc-1/complete", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(await screen.findByText("Pharmacy reply saved. The OTC task is closed.")).toBeVisible();
    expect(screen.queryByTestId("panel-otc-pharmacy-outcome")).not.toBeInTheDocument();
  });

  it("finds transport options and prepares a provider without starting a booking", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url) === "/api/profile") {
        return jsonResponse({
          savedProviders: [{
            name: "Radio Taxi",
            role: "taxi",
            phone: "+34 612 345 678",
            whatsapp: "+34 612 345 679",
            preferredChannel: "whatsapp",
          }],
          serviceReadiness: {
            hasSavedTransportProvider: true,
            hasMobilityInfo: true,
          },
        });
      }
      if (String(url).includes("/api/transport/options")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.destination.address).toBe("Heart Clinic Madrid");
        return jsonResponse({
          market: { countryCode: "ES", city: "Madrid" },
          options: [{
            id: "local-taxi-radio-taxi",
            kind: "local_taxi",
            label: "Radio Taxi",
            description: "Trusted local taxi provider.",
            providerName: "Radio Taxi",
            phone: "+34 612 345 678",
            whatsapp: "+34 612 345 679",
            preferredChannel: "whatsapp",
            actions: ["call_phone", "start_concierge_action"],
          }],
          disclaimers: ["Neutral", "Confirm price", "No ride is booked or requested until you confirm the next step."],
        });
      }
      if (String(url).includes("/api/concierge/actions/trigger")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.use_case).toBe("book_ride");
        expect(body.auto_start).toBe(false);
        expect(body.provider_name).toBe("Radio Taxi");
        expect(body.provider_phone).toBe("+34 612 345 678");
        expect(body.action_payload.provider_whatsapp).toBe("+34 612 345 679");
        expect(body.action_payload.preferred_channel).toBe("whatsapp");
        expect(body.action_payload.execution_channel).toBe("whatsapp");
        expect(body.action_payload.live_handoff_flow).toBe("transport_booking_v1");
        expect(body.action_payload.live_handoff_status).toBe("ready");
        expect(body.action_payload.handoff_readiness).toMatchObject({
          provider_saved: true,
          provider_name: "Radio Taxi",
          contact_channel: "whatsapp",
          has_contact_channel: true,
          has_pickup: true,
          has_destination: true,
          has_time: true,
          has_mobility_needs: true,
          final_confirmation_required: true,
        });
        expect(body.action_payload.whatsapp_message).toContain("Destination: Heart Clinic Madrid");
        expect(body.action_payload.whatsapp_message).toContain("Priorities: Nearby, Good reputation, Easy access, Clear price, Soon.");
        expect(body.action_payload.criteria).toEqual(["nearby", "available-soon", "accessible", "clear-price", "reputation"]);
        expect(body.action_payload.criteria_labels).toEqual(["Nearby", "Good reputation", "Easy access", "Clear price", "Soon"]);
        return jsonResponse({ pendingId: "transport-1", status: "pending" });
      }
      if (String(url).includes("/api/profile/scheduled-events")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({
          event_type: "transport",
          title: "Ride with Radio Taxi",
          source: "concierge",
          status: "upcoming",
        });
        expect(body.description).toContain("Pickup: Saved home");
        expect(body.description).toContain("Destination: Heart Clinic Madrid");
        expect(body.description).toContain("Provider reply: Confirmed, arrives at 09:30.");
        expect(body.description).toContain("Price: EUR18");
        expect(body.description).toContain("Reference: RT-123");
        expect(body.metadata).toMatchObject({
          flow_reference: "FLOW_TRANSPORT_BOOKING",
          pending_id: "transport-1",
          provider_name: "Radio Taxi",
          provider_phone: "+34 612 345 678",
          provider_whatsapp: "+34 612 345 679",
          option_kind: "local_taxi",
          criteria: ["nearby", "available-soon", "accessible", "clear-price", "reputation"],
          criteria_labels: ["Nearby", "Good reputation", "Easy access", "Clear price", "Soon"],
          pickup_address: "Saved home",
          destination_address: "Heart Clinic Madrid",
          requested_time: "now",
          provider_reply: "Confirmed, arrives at 09:30.",
          price_estimate: "EUR18",
          booking_reference: "RT-123",
        });
        return jsonResponse({ event: { id: "ride-event-1", title: body.title } });
      }
      if (String(url).includes("/api/concierge/actions/transport-1/complete")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.outcome_summary).toBe("Ride saved with Radio Taxi.");
        expect(body.outcome_payload).toMatchObject({
          flow_reference: "FLOW_TRANSPORT_BOOKING",
          live_handoff_flow: "transport_booking_v1",
          live_handoff_status: "completed",
          live_handoff_outcome: "ride_confirmed",
          provider_name: "Radio Taxi",
          provider_reply: "Confirmed, arrives at 09:30.",
          price_estimate: "EUR18",
          booking_reference: "RT-123",
          criteria: ["nearby", "available-soon", "accessible", "clear-price", "reputation"],
          criteria_labels: ["Nearby", "Good reputation", "Easy access", "Clear price", "Soon"],
          pickup_address: "Saved home",
          destination_address: "Heart Clinic Madrid",
        });
        return jsonResponse({ ok: true, status: "completed", sessionId: "transport-session-1" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await showBookRideFastHelp());
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByTestId("note-transport-provider-readiness")).toHaveTextContent("Saved provider first: Radio Taxi");
    });
    fireEvent.change(screen.getByTestId("input-transport-destination"), {
      target: { value: "Heart Clinic Madrid" },
    });
    fireEvent.click(screen.getByTestId("button-transport-find-options"));

    expect(await screen.findByTestId("card-transport-option-local-taxi-radio-taxi")).toHaveTextContent("Radio Taxi");
    expect(screen.getByTestId("link-transport-call-local-taxi-radio-taxi")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("panel-transport-confirm-local-taxi-radio-taxi")).toHaveTextContent("Confirm first");
    expect(screen.getByTestId("panel-transport-confirm-local-taxi-radio-taxi")).toHaveTextContent("Destination: Heart Clinic Madrid");
    expect(screen.getByTestId("panel-transport-confirm-local-taxi-radio-taxi")).toHaveTextContent("Criteria: Nearby, Good reputation, Easy access, Clear price, Soon");
    expect(screen.getByTestId("panel-transport-confirm-local-taxi-radio-taxi")).toHaveTextContent("Tool ready: WhatsApp");

    const prepareButton = screen.getByTestId("button-transport-prepare-local-taxi-radio-taxi");
    await waitFor(() => expect(prepareButton).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(prepareButton);
    });

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(await screen.findByText("Ride request prepared. Confirm contact in Right now, then review and save the ride.")).toBeVisible();
    expect(screen.getByTestId("panel-transport-final-review")).toHaveTextContent("Review and confirm ride");

    fireEvent.change(screen.getByTestId("input-transport-provider-reply"), {
      target: { value: "Confirmed, arrives at 09:30." },
    });
    fireEvent.change(screen.getByTestId("input-transport-confirmed-time"), {
      target: { value: "2026-08-04T09:30" },
    });
    fireEvent.change(screen.getByTestId("input-transport-confirmed-price"), {
      target: { value: "EUR18" },
    });
    fireEvent.change(screen.getByTestId("input-transport-confirmed-reference"), {
      target: { value: "RT-123" },
    });

    fireEvent.click(screen.getByTestId("button-transport-save-confirmed-ride"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/profile/scheduled-events", expect.objectContaining({
        method: "POST",
      }));
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/transport-1/complete", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(await screen.findByText("Ride saved in Scheduled Support. The task is closed.")).toBeVisible();
  });
});

describe("ConciergeScreen route prefill", () => {
  it("resumes a ride flow after trusted provider setup returns", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url) === "/api/profile") {
        return jsonResponse({
          savedProviders: [{
            name: "Trusted Taxi",
            role: "taxi",
            phone: "+34 600 111 222",
            preferredChannel: "phone",
          }],
          serviceReadiness: {
            hasSavedTransportProvider: true,
            hasMobilityInfo: true,
          },
        });
      }
      return jsonResponse({ items: [] });
    });

    const scenes: VoiceCanvasSceneEnvelope[] = [];
    const handleScene = (event: Event) => {
      if (event instanceof CustomEvent) scenes.push(event.detail as VoiceCanvasSceneEnvelope);
    };
    window.addEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
    renderScreen([{
      pathname: "/concierge",
      state: {
        trustedProviderSaved: {
          name: "Trusted Taxi",
          category: "transport",
          conciergeResume: {
            kind: "transport",
            message: "Please help me book a ride to City Clinic tomorrow morning.",
            pickup: "Saved home",
            destination: "City Clinic",
            time: "tomorrow morning",
            mobilityNeeds: ["Help to the door"],
            voiceCanvas: true,
          },
        },
      },
    }]);

    const resume = await screen.findByTestId("panel-concierge-provider-resume");
    expect(resume).toHaveTextContent("Provider saved");
    expect(resume).toHaveTextContent("Trusted Taxi");
    expect(resume).toHaveTextContent("Continue ride");

    await waitFor(() => {
      expect(screen.getByTestId("route-state")).toHaveTextContent("null");
    });

    fireEvent.click(screen.getByTestId("button-provider-resume-continue"));

    expect(await screen.findByTestId("panel-concierge-route-prefill")).toHaveTextContent("Transport options");
    expect(screen.getByTestId("note-transport-provider-readiness")).toHaveTextContent("Saved provider first: Trusted Taxi");
    expect(screen.getByTestId("note-transport-mobility-readiness")).toHaveTextContent("Mobility preferences saved");
    expect(screen.getByTestId("input-transport-pickup")).toHaveValue("Saved home");
    expect(screen.getByTestId("input-transport-destination")).toHaveValue("City Clinic");
    expect(screen.getByTestId("input-transport-time")).toHaveValue("tomorrow morning");
    expect(screen.queryByTestId("panel-concierge-provider-resume")).not.toBeInTheDocument();
    await waitFor(() => expect(scenes.some((scene) => scene.viewModel.sceneId === "ride-review")).toBe(true));
    window.removeEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
  });

  it("resumes a medical appointment Canvas after trusted provider setup returns", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url) === "/api/profile") {
        return jsonResponse({
          savedProviders: [{
            name: "Harbour Clinic",
            role: "doctor_clinic",
            phone: "+34 600 222 333",
            preferredChannel: "phone",
          }],
          serviceReadiness: {
            hasSavedMedicalProvider: true,
          },
        });
      }
      return jsonResponse({ items: [] });
    });

    const scenes: VoiceCanvasSceneEnvelope[] = [];
    const handleScene = (event: Event) => {
      if (event instanceof CustomEvent) scenes.push(event.detail as VoiceCanvasSceneEnvelope);
    };
    window.addEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
    renderScreen([{
      pathname: "/concierge",
      state: {
        trustedProviderSaved: {
          name: "Harbour Clinic",
          category: "doctor_clinic",
          conciergeResume: {
            kind: "medical_appointment",
            appointmentType: "medical",
            note: "Annual check-up",
            requestedTime: "Next Tuesday morning",
            coverageLabel: "Health Plan",
            voiceCanvas: true,
          },
        },
      },
    }]);

    const resume = await screen.findByTestId("panel-concierge-provider-resume");
    expect(resume).toHaveTextContent("Provider saved");
    expect(resume).toHaveTextContent("Harbour Clinic");

    fireEvent.click(screen.getByTestId("button-provider-resume-continue"));

    await waitFor(() => {
      const providerScene = scenes.find((scene) => scene.viewModel.sceneId === "appointment-provider");
      expect(providerScene).toBeDefined();
      expect(providerScene?.viewModel.choices?.some((choice) => choice.label.includes("Harbour Clinic"))).toBe(true);
    });
    expect(screen.getByTestId("route-state")).toHaveTextContent("null");
    expect(screen.queryByTestId("panel-concierge-provider-resume")).not.toBeInTheDocument();
    window.removeEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
  });

  it("resumes the same Home Service Canvas after trusted provider setup returns", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url) === "/api/config/features/home-service-voice-canvas") return jsonResponse({ enabled: true, rolloutPercent: 100 });
      if (String(url) === "/api/profile") {
        return jsonResponse({
          street: "10 Garden Lane",
          savedProviders: [{
            name: "Trusted Electrician",
            role: "electrician",
            category: "home_service",
            phone: "+34 600 333 444",
            preferredChannel: "phone",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });
    const scenes: VoiceCanvasSceneEnvelope[] = [];
    const handleScene = (event: Event) => {
      if (event instanceof CustomEvent) scenes.push(event.detail as VoiceCanvasSceneEnvelope);
    };
    window.addEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
    renderScreen([{
      pathname: "/concierge",
      state: {
        trustedProviderSaved: {
          name: "Trusted Electrician",
          category: "home_service",
          conciergeResume: {
            kind: "home_service",
            serviceType: "electrician",
            origin: "voice",
            note: "Kitchen socket is not working",
            answers: {
              problem_summary: "Kitchen socket is not working",
              immediate_danger: "no",
              safety_check: "no",
              urgency: "today",
              requested_time: "Tomorrow morning",
              access_notes: "Ring twice",
              home_address: "10 Garden Lane",
            },
            textDrafts: { problem_summary: "Kitchen socket is not working" },
            voiceCanvas: true,
            photoName: "socket.jpg",
          },
        },
      },
    }]);

    fireEvent.click(await screen.findByTestId("button-provider-resume-continue"));
    await waitFor(() => {
      const providerScene = scenes.find((scene) => scene.viewModel.sceneId === "home-service-provider");
      expect(providerScene).toBeDefined();
      expect(providerScene?.viewModel.choices?.some((choice) => choice.label === "Trusted Electrician")).toBe(true);
    });
    expect(screen.getByTestId("route-state")).toHaveTextContent("null");
    window.removeEventListener(VYVA_VOICE_CANVAS_PRESENT_EVENT, handleScene);
  });

  it("returns from trusted provider setup to the original active shortlist", async () => {
    const pendingShortlist = {
      id: "shortlist-return-1",
      use_case: "find_provider",
      provider_name: "Harbour Clinic",
      provider_phone: "+34 600 111 222",
      action_summary: "Provider shortlist saved: Harbour Clinic.",
      action_payload: {
        task_type: "provider_shortlist",
        shortlist_version: 1,
        shortlist_only: true,
        shortlist_captured_at: "2026-07-15T10:00:00.000Z",
        shortlist_updated_at: "2026-07-15T10:00:00.000Z",
        shortlist_status: "open",
        preferred_provider_id: "harbour",
        preferred_provider_name: "Harbour Clinic",
        provider_search_mode: "specialist",
        provider_search_query: "doctor nearby",
        criteria: ["nearby"],
        flow_reference: "CF_MEDICAL_APPOINTMENT",
        selected_provider_names: ["Harbour Clinic"],
        provider_shortlist: [{
          id: "harbour",
          name: "Harbour Clinic",
          category: "Doctor",
          summary: "Appointments",
          why_may_suit_you: "Nearby",
          facts: {},
          contact: { phone: "+34 600 111 222", preferredChannel: "phone" },
          source_label: "Local directory",
          source_status: "reported",
        }],
        no_external_action_without_confirmation: true,
      },
      status: "pending",
      language: "en",
    };
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target === "/api/profile") return jsonResponse({ savedProviders: [] });
      if (target.endsWith("/api/concierge/actions/pending")) return jsonResponse({ items: [pendingShortlist] });
      if (target.endsWith("/api/concierge/actions/sessions")) return jsonResponse({ items: [] });
      return jsonResponse({ items: [] });
    });

    renderScreen([{
      pathname: "/concierge",
      state: {
        trustedProviderSaved: {
          name: "Harbour Clinic",
          category: "doctor_clinic",
          conciergeResume: {
            kind: "provider_shortlist",
            pendingId: "shortlist-return-1",
            preferredProviderId: "harbour",
          },
        },
      },
    }]);

    const resume = await screen.findByTestId("panel-concierge-provider-resume");
    expect(resume).toHaveTextContent("Harbour Clinic");
    fireEvent.click(screen.getByTestId("button-provider-resume-continue"));

    expect(await screen.findByTestId("provider-shortlist-follow-up")).toHaveTextContent("Harbour Clinic");
    expect(await screen.findByText("Harbour Clinic saved. Your shortlist is still in progress.")).toBeVisible();
    expect(screen.queryByTestId("panel-concierge-provider-resume")).not.toBeInTheDocument();
  });

  it("resumes an OTC pharmacy flow with the original item details after provider setup returns", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url) === "/api/profile") {
        return jsonResponse({
          savedProviders: [{
            name: "Neighborhood Pharmacy",
            role: "pharmacy",
            phone: "+34 600 333 444",
            preferredChannel: "phone",
          }],
          serviceReadiness: {
            hasSavedPharmacy: true,
          },
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([{
      pathname: "/concierge",
      state: {
        trustedProviderSaved: {
          name: "Neighborhood Pharmacy",
          category: "pharmacy",
          conciergeResume: {
            kind: "otc_pharmacy",
            itemText: "Vitamin D",
            fulfillmentPreference: "pickup",
            requestedTime: "tomorrow",
            notes: "Same brand",
          },
        },
      },
    }]);

    const resume = await screen.findByTestId("panel-concierge-provider-resume");
    expect(resume).toHaveTextContent("Provider saved");
    expect(resume).toHaveTextContent("Neighborhood Pharmacy");
    expect(resume).toHaveTextContent("Continue pharmacy");

    fireEvent.click(screen.getByTestId("button-provider-resume-continue"));

    expect(await screen.findByTestId("panel-otc-pharmacy")).toHaveTextContent("Saved pharmacy: Neighborhood Pharmacy");
    expect(screen.getByTestId("input-otc-pharmacy-item")).toHaveValue("Vitamin D");
    expect(screen.getByTestId("input-otc-pharmacy-time")).toHaveValue("tomorrow");
    expect(screen.getByTestId("input-otc-pharmacy-notes")).toHaveValue("Same brand");
    expect(screen.queryByTestId("panel-concierge-provider-resume")).not.toBeInTheDocument();
  });

  it("turns a symptom appointment handoff into a one-tap concierge request", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).includes("/api/appointments/requests")) {
        return jsonResponse({
          request: {
            id: "request-prefill",
            appointment_type: "medical",
            reason_detail: "Please help me schedule care for chest discomfort. Ask me to confirm before booking.",
            status: "needs_provider",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [],
        });
      }
      return jsonResponse({ items: [] });
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ response: "I can help with that." }));

    renderScreen([{
      pathname: "/concierge",
      state: {
        conciergePrefill: {
          kind: "appointment",
          message: "Please help me schedule care for chest discomfort. Ask me to confirm before booking.",
          source: "symptom_report",
        },
      },
    }]);

    expect(await screen.findByTestId("panel-concierge-route-prefill")).toHaveTextContent("Appointment request ready");
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent("Appointment");
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent("Schedule");
    expect(screen.getByDisplayValue("Please help me schedule care for chest discomfort. Ask me to confirm before booking.")).toBeVisible();

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/appointments/requests", expect.objectContaining({ method: "POST" }));
    });
    expect(fetchMock).not.toHaveBeenCalled();
    const [, init] = apiFetchMock.mock.calls.find(([url]) => String(url) === "/api/appointments/requests") ?? [];
    const body = JSON.parse(String(init?.body));
    expect(body.detail).toContain("Please help me schedule care");
    expect(body.language).toBe("en");
  });

  it("turns a daily check-in task handoff into a prepared concierge request", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes("/api/concierge/actions/trigger")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.use_case).toBe("paperwork");
        expect(body.auto_start).toBe(false);
        expect(body.provider_name).toBe("VYVA review");
        expect(body.action_payload).toMatchObject({
          flow_reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
          requested_tool: "operator_review",
          active_tool: "operator_review",
          readiness_status: "ready",
          execution_channel: "manual",
          action_label: "Prepare request",
          source: "daily_checkin",
          confirmation_required_before_action: true,
          no_external_action_without_confirmation: true,
        });
        expect(body.action_payload.draft_message).toContain("easy outing");
        return jsonResponse({ pendingId: "daily-checkin-task-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([{
      pathname: "/concierge",
      state: {
        conciergePrefill: {
          kind: "task",
          message: "Please prepare an easy outing with transport if needed.",
          source: "daily_checkin",
        },
      },
    }]);

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Review request");
    expect(prefill).toHaveTextContent("Please prepare an easy outing");
    expect(screen.getByTestId("panel-route-prefill-readiness")).toHaveTextContent("Tool ready");
    expect(screen.getByTestId("panel-route-prefill-readiness")).toHaveTextContent("Direct tool: VYVA review");
    expect(screen.getByTestId("panel-route-prefill-readiness")).toHaveTextContent("Current path: VYVA review");
    expect(prefill).toHaveTextContent("Add to Right now");

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(screen.queryByTestId("panel-concierge-route-prefill")).not.toBeInTheDocument();
  });

  it("turns a completed Home task handoff into a reusable Concierge template", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen([{
      pathname: "/concierge",
      state: {
        conciergeCompletedTemplate: {
          id: "session-ride",
          pending_id: "old-ride",
          use_case: "book_ride",
          provider_name: "Radio Taxi",
          outcome: "completed",
          outcome_summary: "Ride saved with Radio Taxi.",
          completed_at: "2026-08-04T09:30:00.000Z",
          outcome_payload: {
            pickup_address: "Saved home",
            destination_address: "City Clinic",
            requested_time: "tomorrow 09:00",
            mobility_needs: ["Help to the door"],
          },
        },
      },
    }]);

    expect(await screen.findByTestId("panel-concierge-route-prefill")).toHaveTextContent("Transport options");
    expect(screen.getByTestId("input-transport-pickup")).toHaveValue("Saved home");
    expect(screen.getByTestId("input-transport-destination")).toHaveValue("City Clinic");
    expect(screen.getByTestId("input-transport-time")).toHaveValue("tomorrow 09:00");
  });

  it("shows readiness fallback for email-style tool-gated task handoffs", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes("/api/concierge/actions/trigger")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.use_case).toBe("paperwork");
        expect(body.auto_start).toBe(false);
        expect(body.provider_name).toBe("VYVA review");
        expect(body.action_payload).toMatchObject({
          flow_reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
          requested_tool: "email",
          active_tool: "operator_review",
          readiness_status: "manual_review",
          execution_channel: "manual",
          action_label: "Prepare email",
          confirmation_required_before_action: true,
          review_fallback: true,
          no_external_action_without_confirmation: true,
          source: "voice_action",
        });
        expect(body.action_payload.draft_message).toContain("Please prepare an email");
        return jsonResponse({ pendingId: "paperwork-task-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([{
      pathname: "/concierge",
      state: {
        conciergePrefill: {
          kind: "task",
          message: "Please prepare an email to my insurance company about the reimbursement.",
          source: "voice_action",
        },
      },
    }]);

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Review request");
    expect(prefill).toHaveTextContent("Please prepare an email");
    expect(screen.getByTestId("panel-route-prefill-readiness")).toHaveTextContent("Review path ready");
    expect(screen.getByTestId("panel-route-prefill-readiness")).toHaveTextContent("Direct tool: email");
    expect(screen.getByTestId("panel-route-prefill-readiness")).toHaveTextContent("Current path: VYVA review");
    expect(screen.getByTestId("panel-route-prefill-readiness")).toHaveTextContent("Needs: email");
    expect(prefill).toHaveTextContent("Add to Right now");

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(screen.queryByTestId("panel-concierge-route-prefill")).not.toBeInTheDocument();
  });

  it("runs a safe web search from a pending Concierge task before closing it", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "scam-web-1",
            use_case: "scam_check",
            provider_name: "VYVA review",
            provider_phone: null,
            action_summary: "Safe check prepared: Company or offer.",
            action_payload: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.scamCheck,
              requested_tool: "web_search",
              active_tool: "web_search",
              readiness_status: "ready",
              execution_channel: "manual",
              draft_message: [
                "Help me check a company, offer, seller, or service reputation online.",
                "User detail: Acme Deals https://example.test/offer.",
                "Do not click, reply, pay, or share personal details.",
              ].join("\n"),
              no_external_action_without_confirmation: true,
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      if (target.endsWith("/api/offers/search")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.query).toContain("Acme Deals");
        expect(body.locale).toBe("en");
        return jsonResponse({
          category: "safety",
          options: [{
            label: "Opcion recomendada",
            name: "Acme Deals public warning signs",
            category: "reputation",
            what_it_offers: "Public safety signal review",
            price_or_advantage: "No payment needed",
            why_good_option: "Mentions mismatched domains and pressure tactics.",
            distance_or_availability: "Online",
            contact_method: "Do not contact yet",
            trust_note: "Several public signals need caution.",
            score: 82,
          }],
          decision_explanation: "Caution is advised before clicking or paying.",
          neutrality_note: "This is a neutral check, not a guarantee.",
          source_guidance: ["Prefer official company sites.", "Do not enter personal details."],
          protection_summary: {
            title: "Stay safe",
            checkpoints: ["Do not click payment links", "Verify the company independently"],
            notification_triggers: ["payment pressure"],
            action_guardrail: "Ask before contacting anyone.",
          },
          next_step: "Keep the message and avoid replying until reviewed.",
        });
      }
      if (target.endsWith("/api/concierge/actions/scam-web-1/complete")) {
        expect(init?.method).toBe("POST");
        return jsonResponse({ ok: true, status: "completed", sessionId: "session-safe-web-1" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const panel = await screen.findByTestId("panel-safe-web-search-scam-web-1");
    expect(panel).toHaveTextContent("Safe search");
    expect(panel).toHaveTextContent("Nothing is contacted, sent, or opened for you.");
    expect(screen.getByTestId("button-concierge-confirm-scam-web-1")).toBeDisabled();

    fireEvent.click(screen.getByTestId("button-safe-web-search-run-scam-web-1"));

    const result = await screen.findByTestId("safe-web-search-result-scam-web-1");
    expect(result).toHaveTextContent("Caution is advised");
    expect(result).toHaveTextContent("Acme Deals public warning signs");
    expect(screen.getByTestId("button-safe-web-search-save-scam-web-1")).not.toBeDisabled();

    fireEvent.click(screen.getByTestId("button-safe-web-search-save-scam-web-1"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/concierge/actions/scam-web-1/complete",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const completionCall = apiFetchMock.mock.calls.find(([url]) => String(url).endsWith("/api/concierge/actions/scam-web-1/complete"));
    const completionBody = JSON.parse(String(completionCall?.[1]?.body));
    expect(completionBody.outcome_summary).toContain("Safe search completed");
    expect(completionBody.outcome_payload).toMatchObject({
      flow_reference: CONCIERGE_FLOW_REFERENCES.scamCheck,
      execution_type: "safe_web_search",
      category: "safety",
      no_external_action_without_confirmation: true,
    });
    expect(completionBody.outcome_payload.query).toContain("Acme Deals");
    expect(completionBody.outcome_payload.options[0]).toMatchObject({
      name: "Acme Deals public warning signs",
      score: 82,
    });
  });

  it("blocks scam document review confirmation until the source detail is present", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "scam-missing-source",
            use_case: "scam_check",
            provider_name: "VYVA review",
            provider_phone: null,
            action_summary: "Safe check prepared: Document or photo.",
            action_payload: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.scamCheck,
              requested_tool: "camera_or_upload",
              active_tool: "camera_or_upload",
              execution_channel: "manual",
              concern: "Document or photo",
              risk_context: "Suspicious document, letter, invoice, or photo",
              confirmation_required_before_action: true,
              no_external_action_without_confirmation: true,
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const review = await screen.findByTestId("panel-concierge-next-action");
    expect(review).toHaveTextContent("Source");
    expect(review).toHaveTextContent("Needs confirmation");
    expect(review).toHaveTextContent("Complete before confirming: Source");
    expect(screen.getByTestId("button-concierge-confirm-scam-missing-source")).toBeDisabled();

    fireEvent.click(screen.getByTestId("button-concierge-confirm-scam-missing-source"));

    expect(apiFetchMock).not.toHaveBeenCalledWith(
      "/api/concierge/actions/scam-missing-source/confirm",
      { method: "POST" },
    );
  });

  it("records a review-pending scam document outcome through the completion endpoint", async () => {
    let completeBody: { outcome_summary?: string; outcome_payload?: Record<string, unknown> } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/scam-document-review/complete")) {
        completeBody = JSON.parse(String(init?.body));
        return jsonResponse({ ok: true, status: "completed", sessionId: "session-scam-document-review" });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "scam-document-review",
            use_case: "scam_check",
            provider_name: "VYVA review",
            provider_phone: null,
            action_summary: "Safe check prepared: Document or photo.",
            action_payload: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.scamCheck,
              requested_tool: "camera_or_upload",
              active_tool: "camera_or_upload",
              execution_channel: "manual",
              review_source: "Prize letter photo",
              scam_detail: "Prize letter photo",
              document_type: "Prize letter photo",
              concern: "Suspicious document, letter, invoice, or photo",
              confirmation_required_before_action: true,
              no_external_action_without_confirmation: true,
              user_confirmed: true,
            },
            status: "pending",
            confirmed_at: "2026-07-15T10:00:00.000Z",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const panel = await screen.findByTestId("panel-manual-review-outcome-scam-document-review");
    expect(panel).toHaveTextContent("Review outcome");
    expect(panel).toHaveTextContent("Prize letter photo");
    expect(screen.getByTestId("button-manual-review-save-scam-document-review")).toBeDisabled();

    fireEvent.click(screen.getByTestId("button-manual-review-status-review_pending-scam-document-review"));
    fireEvent.change(screen.getByTestId("input-manual-review-summary-scam-document-review"), {
      target: { value: "Looks suspicious because it asks for an upfront payment." },
    });
    fireEvent.change(screen.getByTestId("input-manual-review-next-step-scam-document-review"), {
      target: { value: "Ask a trusted contact before replying." },
    });
    fireEvent.change(screen.getByTestId("input-manual-review-reference-scam-document-review"), {
      target: { value: "SG-9" },
    });
    fireEvent.change(screen.getByTestId("input-manual-review-notes-scam-document-review"), {
      target: { value: "No upload or reply was sent." },
    });
    fireEvent.click(screen.getByTestId("button-manual-review-save-scam-document-review"));

    await waitFor(() => {
      expect(completeBody).toMatchObject({
        outcome_summary: "Review pending: Prize letter photo. Reference: SG-9.",
        outcome_payload: expect.objectContaining({
          flow_reference: CONCIERGE_FLOW_REFERENCES.scamCheck,
          execution_type: "manual_review_outcome_capture",
          execution_channel: "operator_review",
          review_outcome: "review_pending",
          review_summary: "Looks suspicious because it asks for an upfront payment.",
          next_step: "Ask a trusted contact before replying.",
          reference: "SG-9",
          notes: "No upload or reply was sent.",
          live_handoff_status: "needs_human_help",
          live_handoff_outcome: "review_pending",
          completed_from: "manual_review_outcome_panel",
          no_external_action_without_confirmation: true,
        }),
      });
    });
  });

  it("records a completed selected deal review through the completion endpoint", async () => {
    let completeBody: { outcome_summary?: string; outcome_payload?: Record<string, unknown> } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/deal-review-complete/complete")) {
        completeBody = JSON.parse(String(init?.body));
        return jsonResponse({ ok: true, status: "completed", sessionId: "session-deal-review-complete" });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "deal-review-complete",
            use_case: "find_offers",
            provider_name: "Senior Energy Saver",
            provider_phone: null,
            action_summary: "Deal comparison prepared: Senior Energy Saver.",
            action_payload: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
              task_type: "deal_comparison",
              requested_tool: "operator_review",
              active_tool: "operator_review",
              execution_channel: "manual",
              offer_name: "Senior Energy Saver",
              deal_name: "Senior Energy Saver",
              review_target: "Senior Energy Saver",
              shopping_context: "Household costs",
              comparison_summary: "Strong fit for the current household profile.",
              price_or_advantage: "Estimated 18% monthly saving with no early switch.",
              website: "https://example.com",
              phone: "+34 600 333 444",
              confirmation_required_before_action: true,
              no_external_action_without_confirmation: true,
              user_confirmed: true,
            },
            status: "pending",
            confirmed_at: "2026-07-15T10:00:00.000Z",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const panel = await screen.findByTestId("panel-manual-review-outcome-deal-review-complete");
    expect(panel).toHaveTextContent("Review outcome");
    expect(panel).toHaveTextContent("Senior Energy Saver");
    fireEvent.change(screen.getByTestId("input-manual-review-summary-deal-review-complete"), {
      target: { value: "Compared the price, commitment, trust notes, and contact route." },
    });
    fireEvent.change(screen.getByTestId("input-manual-review-next-step-deal-review-complete"), {
      target: { value: "Ask the user before opening the provider website." },
    });
    fireEvent.change(screen.getByTestId("input-manual-review-reference-deal-review-complete"), {
      target: { value: "DEAL-7" },
    });
    fireEvent.click(screen.getByTestId("button-manual-review-save-deal-review-complete"));

    await waitFor(() => {
      expect(completeBody).toMatchObject({
        outcome_summary: "Completed: Senior Energy Saver. Reference: DEAL-7.",
        outcome_payload: expect.objectContaining({
          flow_reference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
          execution_type: "manual_review_outcome_capture",
          execution_channel: "operator_review",
          review_outcome: "completed",
          offer_name: "Senior Energy Saver",
          deal_name: "Senior Energy Saver",
          review_target: "Senior Energy Saver",
          shopping_context: "Household costs",
          website: "https://example.com",
          phone: "+34 600 333 444",
          review_summary: "Compared the price, commitment, trust notes, and contact route.",
          next_step: "Ask the user before opening the provider website.",
          reference: "DEAL-7",
          live_handoff_status: "completed",
          live_handoff_outcome: "completed",
          completed_from: "manual_review_outcome_panel",
          no_external_action_without_confirmation: true,
        }),
      });
    });
  });

  it("reveals prepared provider phone actions only after user confirmation and final confirmation", async () => {
    const openMock = vi.spyOn(window, "open").mockImplementation(() => null);
    apiFetchMock.mockImplementation(async () => jsonResponse({
      items: [{
        id: "ride-1",
        use_case: "book_ride",
        provider_name: "Radio Taxi",
        provider_phone: "+34 612 345 678",
        action_summary: "Taxi option prepared for the health appointment.",
        action_payload: {
          pickup_address: "Saved home",
          destination_address: "City Clinic",
          requested_time: "tomorrow 09:00",
          execution_channel: "phone",
          execution_task: liveReadyExecutionTask("phone_call", {
            flow_reference: CONCIERGE_FLOW_REFERENCES.transportBooking,
            lifecycle_status: "ready",
            user_confirmed: false,
            external_action_allowed: false,
            execution_mode: "manual_review",
          }),
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    expect(await screen.findByTestId("panel-concierge-execution-status")).toHaveAttribute("data-phase", "needs_ok");
    expect(screen.queryByTestId("link-concierge-phone-call-ride-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("panel-concierge-phone-call")).not.toBeInTheDocument();
    expect(screen.getByTestId("panel-concierge-execution-status")).toHaveAttribute("data-phase", "needs_ok");
    expect(screen.getByTestId("panel-concierge-execution-status")).toHaveTextContent("Ready for your OK");
    expect(screen.getByTestId("panel-concierge-execution-status")).toHaveTextContent("VYVA has what it needs to prepare the call.");
    expect(screen.getByTestId("panel-concierge-execution-status")).toHaveTextContent("Nothing is sent, called, or booked without your permission.");
    const liveHandoff = screen.getByTestId("panel-concierge-live-handoff");
    expect(liveHandoff).toHaveAttribute("data-state", "ready");
    expect(liveHandoff).toHaveTextContent("Ready for your OK");
    expect(screen.getByTestId("item-live-handoff-provider")).toHaveTextContent("Radio Taxi");
    expect(screen.getByTestId("item-live-handoff-contact")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("item-live-handoff-pickup")).toHaveTextContent("Saved home");
    expect(screen.getByTestId("item-live-handoff-destination")).toHaveTextContent("City Clinic");
    expect(screen.getByTestId("item-live-handoff-time")).toHaveTextContent("tomorrow 09:00");
    expect(screen.getByTestId("item-live-handoff-confirmation")).toHaveAttribute("data-ready", "false");
    expect(screen.getByTestId("panel-concierge-action-timeline")).toHaveTextContent("Follow-through");
    expect(screen.getByTestId("panel-concierge-action-timeline")).toHaveTextContent("Ready for your OK");
    expect(screen.getByTestId("timeline-step-review")).toHaveAttribute("data-state", "active");
    expect(screen.getByTestId("timeline-step-requested")).toHaveAttribute("data-state", "upcoming");
    const checklist = screen.getByTestId("panel-concierge-flow-checklist");
    expect(checklist).toHaveTextContent("Ready check");
    expect(checklist).toHaveTextContent("Nothing is sent, called, or booked without your OK.");
    expect(checklist).toHaveTextContent("Details");
    expect(checklist).toHaveTextContent("Ready");
    expect(checklist).toHaveTextContent("Provider");
    expect(checklist).toHaveTextContent("Radio Taxi");
    expect(checklist).toHaveTextContent("Contact");
    expect(checklist).toHaveTextContent("Phone call");
    expect(checklist).toHaveTextContent("Confirm");
    expect(checklist).toHaveTextContent("Call and save result");
    expect(screen.getByTestId("button-concierge-checklist-details")).toHaveTextContent("Review");
    expect(screen.getByTestId("button-concierge-checklist-provider")).toHaveTextContent("Change");
    expect(screen.getByTestId("button-concierge-checklist-confirm")).toHaveTextContent("OK");
    expect(screen.getByTestId("panel-concierge-next-action")).toHaveTextContent("Next step");
    expect(screen.getByTestId("panel-concierge-next-action")).toHaveTextContent("Call and save result");
    expect(screen.getByTestId("panel-concierge-next-action")).toHaveTextContent("Call from here, then save what happened to close the task.");
    expect(screen.getByTestId("panel-concierge-next-action")).toHaveTextContent("You approve before anything is sent, called, or booked.");
    expect(screen.getByTestId("button-concierge-change-ride-1")).toHaveTextContent("Change");
    expect(screen.getByTestId("button-concierge-cancel-ride-1")).toHaveTextContent("Cancel");
    expect(screen.getByTestId("button-concierge-confirm-ride-1")).toHaveTextContent("Review call script");

    fireEvent.click(screen.getByTestId("button-concierge-checklist-confirm"));
    expect(await screen.findByTestId("panel-concierge-phone-call")).toBeVisible();
    expect(screen.getByTestId("panel-concierge-phone-call")).toHaveTextContent("Call step");
    expect(screen.getByTestId("panel-concierge-phone-call")).toHaveTextContent("Call now, then save what happened.");
    fireEvent.click(screen.getByTestId("link-concierge-phone-call-ride-1"));
    expect(openMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("modal-concierge-final-confirmation")).toHaveTextContent("Review first");
    fireEvent.click(screen.getByTestId("button-concierge-final-confirm"));
    expect(openMock).toHaveBeenCalledWith("tel:+34612345678", "_self", undefined);
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/ride-1/review-confirm", { method: "POST" });
    });
    expect(apiFetchMock).not.toHaveBeenCalledWith("/api/concierge/actions/ride-1/confirm", { method: "POST" });

    fireEvent.click(screen.getByTestId("button-concierge-checklist-details"));
    expect(await screen.findByTestId("input-transport-destination")).toBeVisible();
  });

  it("shows an operator-preparing update after the user has already confirmed", async () => {
    apiFetchMock.mockImplementation(async () => jsonResponse({
      items: [{
        id: "assigned-ride",
        use_case: "book_ride",
        provider_name: "Radio Taxi",
        provider_phone: "+34 612 345 678",
        action_summary: "Taxi option prepared for the health appointment.",
        action_payload: {
          pickup_address: "Saved home",
          destination_address: "City Clinic",
          requested_time: "tomorrow 09:00",
          operator_assigned_to: "operator-1",
          operator_assigned_email: "ops@vyva.life",
          operator_assigned_at: "2026-07-14T10:15:00.000Z",
          execution_task: {
            version: 1,
            flow_reference: "FLOW_TRANSPORT_BOOKING",
            action_type: "phone_call",
            requested_tool: "phone_call",
            active_tool: "phone_call",
            lifecycle_status: "ready",
            provider_ready: true,
            missing_requirements: [],
            confirmation_required: true,
            user_confirmed: true,
            confirmation_source: "operator_queue",
            confirmed_at: "2026-07-14T10:10:00.000Z",
            created_at: "2026-07-14T10:00:00.000Z",
            updated_at: "2026-07-14T10:15:00.000Z",
          },
        },
        status: "pending",
        language: "en",
        confirmed_at: "2026-07-14T10:10:00.000Z",
      }],
    }));

    renderScreen();

    const update = await screen.findByTestId("panel-concierge-user-update");
    expect(update).toHaveTextContent("A VYVA operator is preparing this");
    expect(update).toHaveTextContent("You already gave your OK.");
    const statusPanel = screen.getByTestId("panel-concierge-execution-status");
    expect(statusPanel).toHaveTextContent("Operator assigned");
    expect(statusPanel).toHaveAttribute("data-phase", "being_prepared");
    expect(screen.getByTestId("panel-concierge-action-timeline")).toHaveTextContent("A VYVA operator is preparing it");
    expect(screen.getByTestId("timeline-step-review")).toHaveAttribute("data-state", "done");
    expect(screen.getByTestId("timeline-step-requested")).toHaveAttribute("data-state", "active");
    expect(screen.getByTestId("panel-concierge-next-action")).toHaveTextContent("VYVA is preparing this");
    expect(screen.queryByTestId("button-concierge-confirm-assigned-ride")).not.toBeInTheDocument();
    expect(screen.queryByTestId("panel-concierge-phone-call")).not.toBeInTheDocument();
  });

  it("records a user phone call outcome through the existing completion endpoint", async () => {
    const openMock = vi.spyOn(window, "open").mockImplementation(() => null);
    let completeBody: { outcome_summary?: string; outcome_payload?: Record<string, unknown> } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/phone-task-1/complete")) {
        completeBody = JSON.parse(String(init?.body));
        return jsonResponse({ ok: true, status: "completed", sessionId: "session-phone-task-1" });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "phone-task-1",
            use_case: "insurance_admin",
            provider_name: "Seguro Vida",
            provider_phone: "+34 600 111 222",
            action_summary: "Call insurance about claim CL-9.",
            action_payload: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
              execution_channel: "phone_call",
              call_script: "Hello, I am calling about claim CL-9.",
              requested_time: "today",
              execution_task: liveReadyExecutionTask("phone_call", {
                flow_reference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
                user_confirmed: false,
                external_action_allowed: false,
                execution_mode: "manual_review",
              }),
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    expect(await screen.findByTestId("button-concierge-confirm-phone-task-1")).toHaveTextContent("Review call script");
    expect(screen.queryByTestId("panel-concierge-phone-call")).not.toBeInTheDocument();
    expect(screen.queryByTestId("link-concierge-phone-call-phone-task-1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-concierge-confirm-phone-task-1"));
    expect(await screen.findByTestId("panel-concierge-phone-call")).toHaveTextContent("Hello, I am calling about claim CL-9.");
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/phone-task-1/review-confirm", { method: "POST" });
    });
    fireEvent.click(screen.getByTestId("link-concierge-phone-call-phone-task-1"));
    expect(openMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("modal-concierge-final-confirmation")).toHaveTextContent("Review first");
    fireEvent.click(screen.getByTestId("button-concierge-final-confirm"));
    expect(openMock).toHaveBeenCalledWith("tel:+34600111222", "_self", undefined);
    expect(apiFetchMock).not.toHaveBeenCalledWith("/api/concierge/actions/phone-task-1/confirm", { method: "POST" });
    fireEvent.change(screen.getByTestId("input-phone-outcome-time-phone-task-1"), {
      target: { value: "tomorrow 10:30" },
    });
    fireEvent.change(screen.getByTestId("input-phone-outcome-reference-phone-task-1"), {
      target: { value: "CL-9" },
    });
    fireEvent.change(screen.getByTestId("input-phone-outcome-notes-phone-task-1"), {
      target: { value: "They asked for the invoice number." },
    });
    fireEvent.click(screen.getByTestId("button-phone-outcome-save-phone-task-1"));

    await waitFor(() => {
      expect(completeBody).toMatchObject({
        outcome_summary: "Call saved with Seguro Vida. Result: confirmed. Time: tomorrow 10:30. Reference: CL-9.",
        outcome_payload: expect.objectContaining({
          flow_reference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
          execution_type: "phone_call_outcome_capture",
          execution_channel: "phone_call",
          call_outcome: "confirmed",
          provider_name: "Seguro Vida",
          provider_phone: "+34 600 111 222",
          call_script: "Hello, I am calling about claim CL-9.",
          scheduled_for: "tomorrow 10:30",
          reference: "CL-9",
          notes: "They asked for the invoice number.",
          live_handoff_status: "completed",
          live_handoff_outcome: "confirmed",
          completed_from: "phone_call_outcome_panel",
          no_external_action_without_confirmation: true,
        }),
      });
    });
  });

  it("shows the exact missing ride detail before allowing checklist confirmation", async () => {
    apiFetchMock.mockImplementation(async () => jsonResponse({
      items: [{
        id: "ride-missing-destination",
        use_case: "book_ride",
        provider_name: "Radio Taxi",
        provider_phone: "+34 612 345 678",
        action_summary: "Taxi option prepared, but the destination still needs to be confirmed.",
        action_payload: {
          pickup_address: "Saved home",
          requested_time: "now",
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    const checklist = await screen.findByTestId("panel-concierge-flow-checklist");
    expect(checklist).toHaveTextContent("Destination needed");
    expect(checklist).toHaveTextContent("Complete details");
    expect(screen.getByTestId("button-concierge-checklist-confirm")).toHaveTextContent("Add");

    fireEvent.click(screen.getByTestId("button-concierge-checklist-confirm"));

    const destinationInput = await screen.findByTestId("input-transport-destination");
    expect(destinationInput).toBeVisible();
    await waitFor(() => {
      expect(document.activeElement).toBe(destinationInput);
    });
    expect(apiFetchMock).not.toHaveBeenCalledWith(
      "/api/concierge/actions/ride-missing-destination/confirm",
      { method: "POST" },
    );
  });

  it("saves a guided ride detail into the pending Concierge task", async () => {
    let detailsBody: Record<string, unknown> | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "ride-guided-detail",
            use_case: "book_ride",
            provider_name: "Radio Taxi",
            provider_phone: "+34 612 345 678",
            action_summary: "Taxi option prepared, but the destination still needs to be confirmed.",
            action_payload: {
              pickup_address: "Saved home",
              requested_time: "now",
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      if (target.endsWith("/api/concierge/actions/ride-guided-detail/details")) {
        detailsBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return jsonResponse({ ok: true, item: {} });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const panel = await screen.findByTestId("panel-concierge-guided-details");
    expect(panel).toHaveTextContent("Where should the ride go?");
    expect(screen.queryByTestId("button-concierge-confirm-ride-guided-detail")).not.toBeInTheDocument();

    const input = screen.getByTestId("input-transport-destination");
    fireEvent.change(input, { target: { value: "City Clinic" } });
    fireEvent.click(screen.getByTestId("button-concierge-guided-detail-save"));

    await waitFor(() => {
      expect(detailsBody).toMatchObject({
        action_payload: {
          destination_address: "City Clinic",
        },
        answer_key: "destination_address",
        answer_value: "City Clinic",
      });
    });
    expect(apiFetchMock).not.toHaveBeenCalledWith(
      "/api/concierge/actions/ride-guided-detail/confirm",
      { method: "POST" },
    );
  });

  it("asks for a missing email recipient before a prepared task can be confirmed", async () => {
    let detailsBody: Record<string, unknown> | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "email-missing-recipient",
            use_case: "scam_check",
            provider_name: "VYVA review",
            provider_phone: null,
            action_summary: "Forward a suspicious message for review.",
            action_payload: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.scamCheck,
              show_vyva_action_id: "forward_email",
              execution_channel: "email",
              email_subject: "Please review this message",
              email_body: "Can you check whether this message is safe?",
              execution_task: liveReadyExecutionTask("email", {
                flow_reference: CONCIERGE_FLOW_REFERENCES.scamCheck,
                lifecycle_status: "ready",
                user_confirmed: false,
                external_action_allowed: false,
                execution_mode: "manual_review",
              }),
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      if (target.endsWith("/api/concierge/actions/email-missing-recipient/details")) {
        detailsBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return jsonResponse({ ok: true, item: {} });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const panel = await screen.findByTestId("panel-concierge-guided-details");
    expect(panel).toHaveTextContent("Who should receive the draft");
    expect(screen.queryByTestId("button-concierge-confirm-email-missing-recipient")).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("input-concierge-guided-detail-recipient_email"), {
      target: { value: "concierge@vyva.life" },
    });
    fireEvent.click(screen.getByTestId("button-concierge-guided-detail-save"));

    await waitFor(() => {
      expect(detailsBody).toMatchObject({
        action_payload: { recipient_email: "concierge@vyva.life" },
        answer_key: "recipient_email",
        answer_value: "concierge@vyva.life",
      });
    });
    expect(apiFetchMock).not.toHaveBeenCalledWith(
      "/api/concierge/actions/email-missing-recipient/review-confirm",
      { method: "POST" },
    );
  });

  it("expands ride details and focuses pickup when pickup is missing", async () => {
    apiFetchMock.mockImplementation(async () => jsonResponse({
      items: [{
        id: "ride-missing-pickup",
        use_case: "book_ride",
        provider_name: "Radio Taxi",
        provider_phone: "+34 612 345 678",
        action_summary: "Taxi option prepared, but pickup still needs to be confirmed.",
        action_payload: {
          destination_address: "City Clinic",
          requested_time: "now",
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    const checklist = await screen.findByTestId("panel-concierge-flow-checklist");
    expect(checklist).toHaveTextContent("Pickup needed");

    fireEvent.click(screen.getByTestId("button-concierge-checklist-confirm"));

    const pickupInput = await screen.findByTestId("input-transport-pickup");
    expect(pickupInput).toBeVisible();
    await waitFor(() => {
      expect(document.activeElement).toBe(pickupInput);
    });
  });

  it("opens OTC pharmacy details and focuses the missing item field", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target === "/api/profile") {
        return jsonResponse({
          savedProviders: [{
            name: "Neighborhood Pharmacy",
            role: "pharmacy",
            phone: "+34 600 333 444",
            preferredChannel: "phone",
          }],
          serviceReadiness: { hasSavedPharmacy: true },
        });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "otc-missing-item",
            use_case: "order_medicine",
            provider_name: "Neighborhood Pharmacy",
            provider_phone: "+34 600 333 444",
            action_summary: "OTC pharmacy request prepared, but item is missing.",
            action_payload: {
              fulfillment_preference: "pickup",
              requested_time: "today",
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const checklist = await screen.findByTestId("panel-concierge-flow-checklist");
    expect(checklist).toHaveTextContent("Item needed");
    const liveHandoff = screen.getByTestId("panel-concierge-live-handoff");
    expect(liveHandoff).toHaveAttribute("data-state", "ready");
    expect(screen.getByTestId("item-live-handoff-provider")).toHaveTextContent("Neighborhood Pharmacy");
    expect(screen.getByTestId("item-live-handoff-contact")).toHaveTextContent("Phone call");
    expect(screen.getByTestId("item-live-handoff-details")).toHaveTextContent("Item needed");
    expect(screen.getByTestId("item-live-handoff-time")).toHaveTextContent("today");
    expect(screen.getByTestId("item-live-handoff-confirmation")).toHaveAttribute("data-ready", "false");

    fireEvent.click(screen.getByTestId("button-concierge-checklist-confirm"));

    expect(await screen.findByTestId("panel-otc-pharmacy")).toHaveTextContent("Saved pharmacy: Neighborhood Pharmacy");
    const itemInput = await screen.findByTestId("input-otc-pharmacy-item");
    await waitFor(() => {
      expect(document.activeElement).toBe(itemInput);
    });
  });

  it("routes a missing provider checklist item to focused trusted-provider setup", async () => {
    apiFetchMock.mockImplementation(async () => jsonResponse({
      items: [{
        id: "ride-provider-missing",
        use_case: "book_ride",
        provider_name: null,
        provider_phone: null,
        action_summary: "Ride details are ready, but no transport provider is saved yet.",
        action_payload: {
          pickup_address: "Saved home",
          destination_address: "City Clinic",
          requested_time: "tomorrow 09:00",
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    const checklist = await screen.findByTestId("panel-concierge-flow-checklist");
    expect(checklist).toHaveTextContent("Choose first");
    expect(checklist).toHaveTextContent("Choose provider");
    expect(screen.getByTestId("button-concierge-checklist-confirm")).toHaveTextContent("Add");
    fireEvent.click(screen.getByTestId("button-concierge-checklist-confirm"));

    expect(screen.getByTestId("location-path")).toHaveTextContent("/onboarding/profile/providers");
    const routeState = JSON.parse(screen.getByTestId("route-state").textContent || "{}");
    expect(routeState).toMatchObject({
      returnTo: "/concierge",
      setupFocus: "transport",
      setupFlow: CONCIERGE_FLOW_REFERENCES.transportBooking,
    });
    expect(routeState.conciergeResume).toMatchObject({
      kind: "transport",
      pickup: "Saved home",
      destination: "City Clinic",
      time: "tomorrow 09:00",
    });
  });

  it("labels home-service appointment tasks by their service flow", async () => {
    apiFetchMock.mockImplementation(async () => jsonResponse({
      items: [{
        id: "service-save-1",
        use_case: "book_appointment",
        provider_name: "Saved Plumber",
        provider_phone: null,
        action_summary: "Provider replied with a time for the plumber visit.",
        action_payload: {
          appointment_type: "home-service",
          mission_status: "awaiting_user_save",
          execution_channel: "manual",
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("section-concierge-active-task")).toHaveTextContent("Home service");
    });
    expect(screen.getByTestId("section-concierge-active-task")).toHaveTextContent("Saved Plumber");
    expect(screen.getByTestId("panel-concierge-next-action")).toHaveTextContent("Save confirmed service");
  });

  it("shows recent completed concierge sessions without replacing the active task", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target === "/api/profile") {
        return jsonResponse({
          savedProviders: [
            { name: "Radio Taxi", role: "taxi", phone: "+34 612 345 678", preferredChannel: "phone" },
            { name: "Neighborhood Pharmacy", role: "pharmacy", phone: "+34 600 333 444", preferredChannel: "phone" },
            { name: "Saved Plumber", role: "plumber", phone: "+34 600 222 333", preferredChannel: "phone" },
          ],
          serviceReadiness: {
            hasSavedTransportProvider: true,
            hasSavedPharmacy: true,
          },
        });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "ride-1",
            use_case: "book_ride",
            provider_name: "Radio Taxi",
            provider_phone: "+34 612 345 678",
            action_summary: "Taxi option prepared.",
            action_payload: null,
            status: "pending",
            language: "en",
          }],
        });
      }
      if (target.endsWith("/api/concierge/actions/sessions")) {
        return jsonResponse({
          items: [
            {
              id: "session-hidden",
              pending_id: "old-extra",
              use_case: "book_appointment",
              provider_name: "Extra Clinic",
              outcome: "completed",
              outcome_summary: "Should not show in the compact list.",
              completed_at: "2026-08-01T10:00:00.000Z",
              outcome_payload: {},
            },
            {
              id: "session-home",
              pending_id: "old-home",
              use_case: "book_appointment",
              provider_name: "Saved Plumber",
              outcome: "completed",
              outcome_summary: "Safe Home visit confirmed.",
              completed_at: "2026-08-02T10:00:00.000Z",
              outcome_payload: {
                flow_reference: CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
                appointment_type: "home-service",
                service_type: "plumber",
                problem_summary: "Leak under the kitchen sink",
                urgency: "tomorrow",
                estimated_cost: "EUR80",
                location: "Home kitchen",
              },
            },
            {
              id: "session-ride",
              pending_id: "old-ride",
              use_case: "book_ride",
              provider_name: "Radio Taxi",
              outcome: "completed",
              outcome_summary: "Ride saved with Radio Taxi.",
              completed_at: "2026-08-04T09:30:00.000Z",
              outcome_payload: {
                flow_reference: CONCIERGE_FLOW_REFERENCES.transportBooking,
                execution_mode: "live",
                provider_phone: "+34 612 345 678",
                pickup_address: "Saved home",
                destination_address: "City Clinic",
                requested_time: "tomorrow 09:00",
                mobility_needs: ["Help to the door"],
                price_estimate: "EUR18",
                booking_reference: "RT-123",
              },
            },
            {
              id: "session-otc",
              pending_id: "old-otc",
              use_case: "order_medicine",
              provider_name: "Neighborhood Pharmacy",
              outcome: "completed",
              outcome_summary: "OTC pharmacy request saved.",
              completed_at: "2026-08-03T17:00:00.000Z",
              outcome_payload: {
                flow_reference: CONCIERGE_FLOW_REFERENCES.otcPharmacy,
                item_text: "Vitamin D",
                fulfillment_preference: "pickup",
                requested_time: "tomorrow",
                notes: "Same brand",
                cost_estimate: "EUR12",
                pharmacy_reference: "PH-22",
              },
            },
          ],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("section-concierge-completed-history")).toHaveTextContent("Done recently");
    });
    expect(screen.getByTestId("section-concierge-active-task")).toHaveTextContent("Taxi option prepared.");
    expect(screen.getByTestId("card-concierge-completed-session-ride")).toHaveTextContent("Ride");
    expect(screen.getByTestId("card-concierge-completed-session-ride")).toHaveTextContent("Radio Taxi");
    expect(screen.getByTestId("card-concierge-completed-session-ride")).toHaveTextContent("Cost: EUR18");
    expect(screen.getByTestId("card-concierge-completed-session-otc")).toHaveTextContent("OTC pharmacy");
    expect(screen.getByTestId("card-concierge-completed-session-home")).toHaveTextContent("Safe home");
    expect(screen.queryByTestId("card-concierge-completed-session-hidden")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("card-concierge-completed-session-ride"));
    const receipt = await screen.findByTestId("panel-concierge-completed-receipt");
    expect(receipt).toHaveTextContent("Receipt");
    expect(receipt).toHaveTextContent("Ride saved with Radio Taxi.");
    expect(within(receipt).getByTestId("list-concierge-completed-receipt-details")).toHaveTextContent("Result");
    expect(within(receipt).getByTestId("list-concierge-completed-receipt-details")).toHaveTextContent("Completed");
    expect(within(receipt).getByTestId("list-concierge-completed-receipt-details")).toHaveTextContent("Reference");
    expect(within(receipt).getByTestId("list-concierge-completed-receipt-details")).toHaveTextContent("RT-123");
    expect(within(receipt).getByTestId("link-concierge-receipt-contact")).toHaveAttribute("href", "tel:+34612345678");

    fireEvent.click(within(receipt).getByTestId("button-concierge-receipt-template"));
    await waitFor(() => {
      expect(screen.queryByTestId("modal-concierge-completed-receipt")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("panel-concierge-route-prefill")).toHaveTextContent("Transport options");
    expect(screen.getByTestId("input-transport-pickup")).toHaveValue("Saved home");
    expect(screen.getByTestId("input-transport-destination")).toHaveValue("City Clinic");
    expect(screen.getByTestId("input-transport-time")).toHaveValue("tomorrow 09:00");

    fireEvent.click(screen.getByTestId("card-concierge-completed-session-otc"));
    const otcReceipt = await screen.findByTestId("panel-concierge-completed-receipt");
    fireEvent.click(within(otcReceipt).getByTestId("button-concierge-receipt-template"));

    expect(await screen.findByTestId("panel-otc-pharmacy")).toHaveTextContent("Saved pharmacy: Neighborhood Pharmacy");
    expect(screen.getByTestId("input-otc-pharmacy-item")).toHaveValue("Vitamin D");
    expect(screen.getByTestId("input-otc-pharmacy-time")).toHaveValue("tomorrow");
    expect(screen.getByTestId("input-otc-pharmacy-notes")).toHaveValue("Same brand");

    fireEvent.click(screen.getByTestId("card-concierge-completed-session-home"));
    const homeReceipt = await screen.findByTestId("panel-concierge-completed-receipt");
    fireEvent.click(within(homeReceipt).getByTestId("button-concierge-receipt-template"));

    expect(await screen.findByTestId("panel-appointment-assistant")).toHaveTextContent("Home service");
    expect(screen.getByTestId("panel-home-service-intake")).toBeVisible();
    expect(screen.getByTestId("button-home-service-type-plumber")).toBeInTheDocument();
  });

  it("marks completed dry-run sessions as test mode in history receipts", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target === "/api/profile") {
        return jsonResponse({
          savedProviders: [],
          serviceReadiness: {},
        });
      }
      if (target.endsWith("/api/concierge/actions/pending")) return jsonResponse({ items: [] });
      if (target.endsWith("/api/concierge/actions/sessions")) {
        return jsonResponse({
          items: [{
            id: "session-dry-run-admin",
            pending_id: "dry-admin-1",
            use_case: "insurance_admin",
            provider_name: null,
            outcome: "completed",
            outcome_payload: {
              dry_run: true,
              simulated_outcome: true,
              no_real_provider_contact: true,
              recipient_email: "concierge-dry-run+admin@example.test",
              execution_task: {
                dry_run: true,
                lifecycle_status: "done",
              },
            },
            outcome_summary: "Dry-run admin task completed without emailing real documents.",
            completed_at: "2026-08-06T12:00:00.000Z",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const history = await screen.findByTestId("section-concierge-completed-history");
    expect(history).toHaveTextContent("Done recently");
    expect(screen.getByTestId("badge-concierge-completed-dry-run-session-dry-run-admin")).toHaveTextContent("Test mode");

    fireEvent.click(screen.getByTestId("card-concierge-completed-session-dry-run-admin"));
    const receipt = await screen.findByTestId("panel-concierge-completed-receipt");
    expect(within(receipt).getByTestId("list-concierge-completed-receipt-details")).toHaveTextContent("Mode");
    expect(within(receipt).getByTestId("list-concierge-completed-receipt-details")).toHaveTextContent("Test mode, no real contact");
    expect(within(receipt).queryByTestId("link-concierge-receipt-contact")).not.toBeInTheDocument();
  });

  it("labels completed shopping support sessions in history", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target === "/api/profile") {
        return jsonResponse({
          savedProviders: [],
          serviceReadiness: {},
        });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({ items: [] });
      }
      if (target.endsWith("/api/concierge/actions/sessions")) {
        return jsonResponse({
          items: [{
            id: "session-shopping",
            pending_id: "old-shopping",
            use_case: "shopping_request",
            provider_name: "VYVA review",
            outcome: "completed",
            outcome_summary: "Shopping request prepared safely.",
            completed_at: "2026-08-05T12:00:00.000Z",
            outcome_payload: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
              item_text: "easy meals",
            },
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const history = await screen.findByTestId("section-concierge-completed-history");
    expect(history).toHaveTextContent("Done recently");
    expect(screen.getByTestId("card-concierge-completed-session-shopping")).toHaveTextContent("Shopping");
    expect(screen.getByTestId("card-concierge-completed-session-shopping")).toHaveTextContent("VYVA review");

    fireEvent.click(screen.getByTestId("card-concierge-completed-session-shopping"));
    const receipt = await screen.findByTestId("panel-concierge-completed-receipt");
    expect(receipt).toHaveTextContent("Receipt");
    expect(within(receipt).getByTestId("list-concierge-completed-receipt-details")).toHaveTextContent("Type");
    expect(within(receipt).getByTestId("list-concierge-completed-receipt-details")).toHaveTextContent("Shopping");
  });

  it("shows completed appointment history as a reusable appointment template", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({ items: [] });
      }
      if (target.endsWith("/api/concierge/actions/sessions")) {
        return jsonResponse({
          items: [{
            id: "session-appointment",
            pending_id: "old-appointment",
            use_case: "book_appointment",
            provider_name: "Clinica Lopez",
            outcome: "completed",
            outcome_summary: "Medical appointment confirmed with Clinica Lopez.",
            completed_at: "2026-08-05T11:30:00.000Z",
            outcome_payload: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
              execution_mode: "live",
              appointment_type: "medical",
              appointment_reason: "dermatology follow-up",
              scheduled_for: "2026-08-12T09:30",
              location: "Calle Mayor 1",
              provider_phone: "+34 600 111 222",
              reference: "CL-44",
            },
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("section-concierge-completed-history")).toHaveTextContent("Done recently");
    });
    expect(screen.getByTestId("card-concierge-completed-session-appointment")).toHaveTextContent("Appointment");
    expect(screen.getByTestId("card-concierge-completed-session-appointment")).toHaveTextContent("Clinica Lopez");

    fireEvent.click(screen.getByTestId("card-concierge-completed-session-appointment"));
    const receipt = await screen.findByTestId("panel-concierge-completed-receipt");
    expect(receipt).toHaveTextContent("Medical appointment confirmed with Clinica Lopez.");
    expect(within(receipt).getByTestId("list-concierge-completed-receipt-details")).toHaveTextContent("Reference");
    expect(within(receipt).getByTestId("list-concierge-completed-receipt-details")).toHaveTextContent("CL-44");
    expect(within(receipt).getByTestId("link-concierge-receipt-contact")).toHaveAttribute("href", "tel:+34600111222");

    fireEvent.click(within(receipt).getByTestId("button-concierge-receipt-template"));
    await waitFor(() => {
      expect(screen.queryByTestId("modal-concierge-completed-receipt")).not.toBeInTheDocument();
    });
    expect(await screen.findByTestId("panel-appointment-assistant")).toHaveTextContent("Appointment");
    expect(screen.getByDisplayValue("dermatology follow-up")).toBeVisible();
    expect(screen.getByRole("button", { name: "Medical" })).toBeVisible();
  });

  it("shows requested as the active follow-through step for started actions", async () => {
    apiFetchMock.mockImplementation(async () => jsonResponse({
      items: [{
        id: "ride-calling-1",
        use_case: "book_ride",
        provider_name: "Radio Taxi",
        provider_phone: "+34 612 345 678",
        action_summary: "VYVA is calling the taxi provider now.",
        action_payload: null,
        status: "calling",
        language: "en",
      }],
    }));

    renderScreen();

    expect(await screen.findByTestId("panel-concierge-action-timeline")).toHaveTextContent("Request started");
    expect(screen.getByTestId("panel-concierge-execution-status")).toHaveAttribute("data-phase", "waiting");
    expect(screen.getByTestId("panel-concierge-execution-status")).toHaveTextContent("VYVA is working on it");
    expect(screen.getByTestId("panel-concierge-execution-status")).toHaveTextContent("You can come back later; this task stays here.");
    expect(screen.getByTestId("timeline-step-review")).toHaveAttribute("data-state", "done");
    expect(screen.getByTestId("timeline-step-requested")).toHaveAttribute("data-state", "active");
    expect(screen.getByTestId("timeline-step-waiting")).toHaveAttribute("data-state", "upcoming");
    const checklist = screen.getByTestId("panel-concierge-flow-checklist");
    expect(checklist).toHaveTextContent("Provider reply");
    expect(checklist).toHaveTextContent("Waiting");
    expect(checklist).toHaveTextContent("After reply");
    expect(screen.getByTestId("button-concierge-checklist-reply")).toHaveTextContent("Record");
    fireEvent.click(screen.getByTestId("button-concierge-checklist-reply"));
    expect(screen.getByTestId("panel-concierge-provider-reply")).toHaveTextContent("Provider reply");
  });

  it("keeps a confirmed provider reply on the original task until the user marks it done", async () => {
    let pendingPayload: Record<string, unknown> = {
      pickup_address: "Saved home",
      destination_address: "City Clinic",
      requested_time: "tomorrow 09:00",
      mission_status: "awaiting_provider_reply",
    };
    let detailsBody: { action_payload?: Record<string, unknown> } | null = null;
    let completeBody: { outcome_summary?: string; outcome_payload?: Record<string, unknown> } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/reply-ride-1/complete")) {
        completeBody = JSON.parse(String(init?.body));
        return jsonResponse({ ok: true, status: "completed", sessionId: "session-reply-ride-1" });
      }
      if (target.endsWith("/api/concierge/actions/reply-ride-1/details")) {
        detailsBody = JSON.parse(String(init?.body));
        pendingPayload = detailsBody?.action_payload ?? pendingPayload;
        return jsonResponse({ ok: true, item: { id: "reply-ride-1", action_payload: pendingPayload } });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-ride-1",
            use_case: "book_ride",
            provider_name: "Radio Taxi",
            provider_phone: "+34 612 345 678",
            action_summary: "VYVA is waiting for the taxi provider reply.",
            action_payload: pendingPayload,
            status: "calling",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    expect(await screen.findByTestId("panel-concierge-provider-reply")).toHaveTextContent("Provider reply");
    fireEvent.click(screen.getByTestId("button-provider-reply-confirmed-reply-ride-1"));
    fireEvent.change(screen.getByTestId("input-provider-reply-time-reply-ride-1"), {
      target: { value: "tomorrow 09:30" },
    });
    fireEvent.change(screen.getByTestId("input-provider-reply-reference-reply-ride-1"), {
      target: { value: "RT-42" },
    });
    fireEvent.change(screen.getByTestId("input-provider-reply-price-reply-ride-1"), {
      target: { value: "EUR 24" },
    });
    fireEvent.change(screen.getByTestId("input-provider-reply-follow-up-reply-ride-1"), {
      target: { value: "Driver calls five minutes before arrival" },
    });
    fireEvent.change(screen.getByTestId("input-provider-reply-text-reply-ride-1"), {
      target: { value: "Driver will wait outside the main door." },
    });
    fireEvent.click(screen.getByTestId("button-provider-reply-save-reply-ride-1"));

    await waitFor(() => {
      expect(detailsBody).toMatchObject({
        action_payload: expect.objectContaining({
          provider_name: "Radio Taxi",
          provider_phone: "+34 612 345 678",
          provider_reply_status: "confirmed",
          provider_reply: "Driver will wait outside the main door.",
          scheduled_for: "tomorrow 09:30",
          reference: "RT-42",
          price: "EUR 24",
          follow_up: "Driver calls five minutes before arrival",
          pickup_address: "Saved home",
          destination_address: "City Clinic",
          provider_task_status: "reply_received",
          live_handoff_status: "ready",
          live_handoff_outcome: "provider_replied",
          provider_follow_up_confirmed: false,
        }),
      });
    });
    expect(await screen.findByTestId("panel-concierge-provider-reply")).toHaveTextContent("Reply received");
    fireEvent.click(screen.getByTestId("button-provider-reply-mark-complete-reply-ride-1"));

    await waitFor(() => expect(completeBody).toMatchObject({
      outcome_summary: "Provider confirmed: Radio Taxi. Time: tomorrow 09:30. Reference: RT-42.",
      outcome_payload: expect.objectContaining({
        provider_task_status: "done",
        provider_reply: "Driver will wait outside the main door.",
        provider_reply_source: "live",
        provider_reply_resolution: expect.objectContaining({
          decision: expect.objectContaining({
            action: "mark_complete",
            status: "completed",
          }),
        }),
      }),
    }));
  });

  it("runs provider reply save and completion through the Canvas when enabled", async () => {
    let pendingPayload: Record<string, unknown> = {
      pickup_address: "Saved home",
      destination_address: "City Clinic",
      requested_time: "tomorrow 09:00",
      mission_status: "awaiting_provider_reply",
    };
    let detailsBody: { action_payload?: Record<string, unknown> } | null = null;
    let completeBody: { outcome_summary?: string; outcome_payload?: Record<string, unknown> } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target === "/api/config/features/provider-reply-voice-canvas") {
        return jsonResponse({ enabled: true, rolloutPercent: 100 });
      }
      if (target.endsWith("/api/concierge/actions/reply-canvas-1/complete")) {
        completeBody = JSON.parse(String(init?.body));
        return jsonResponse({ ok: true, status: "completed", sessionId: "session-reply-canvas-1" });
      }
      if (target.endsWith("/api/concierge/actions/reply-canvas-1/details")) {
        detailsBody = JSON.parse(String(init?.body));
        pendingPayload = detailsBody?.action_payload ?? pendingPayload;
        return jsonResponse({ ok: true, item: { id: "reply-canvas-1", action_payload: pendingPayload } });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-canvas-1",
            use_case: "book_ride",
            provider_name: "Radio Taxi",
            provider_phone: "+34 612 345 678",
            action_summary: "VYVA is waiting for the taxi provider reply.",
            action_payload: pendingPayload,
            status: "calling",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const canvas = await screen.findByTestId("panel-concierge-provider-reply-canvas");
    expect(canvas).toHaveTextContent("Review the provider reply");
    fireEvent.click(within(canvas).getByRole("button", { name: "Start" }));
    fireEvent.click(within(canvas).getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Provider reply"), {
      target: { value: "Driver will wait outside the main door." },
    });
    fireEvent.click(within(canvas).getByRole("button", { name: "Continue" }));
    fireEvent.click(within(canvas).getByRole("button", { name: "Review" }));
    fireEvent.click(within(canvas).getByRole("button", { name: "Save reply" }));

    expect(await screen.findByRole("heading", { name: "Reply saved" })).toBeInTheDocument();
    expect(completeBody).toBeNull();
    expect(detailsBody).toMatchObject({
      action_payload: expect.objectContaining({
        provider_name: "Radio Taxi",
        provider_reply_status: "confirmed",
        provider_reply: "Driver will wait outside the main door.",
        provider_task_status: "reply_received",
        live_handoff_status: "ready",
        provider_follow_up_confirmed: false,
      }),
    });

    fireEvent.click(screen.getByRole("button", { name: "Mark complete" }));

    await waitFor(() => expect(completeBody).toMatchObject({
      outcome_payload: expect.objectContaining({
        provider_task_status: "done",
        provider_reply: "Driver will wait outside the main door.",
        completed_from: "provider_follow_up_panel",
      }),
    }));
  });

  it("saves a confirmed medical appointment reply into Scheduled Support and keeps it on the task", async () => {
    let scheduledBody: Record<string, unknown> | null = null;
    let detailsBody: { action_payload?: Record<string, unknown> } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/profile/scheduled-events")) {
        scheduledBody = JSON.parse(String(init?.body));
        return jsonResponse({ event: { id: "scheduled-appointment-reply", ...scheduledBody } }, { status: 201 });
      }
      if (target.endsWith("/api/concierge/actions/reply-appointment-1/details")) {
        detailsBody = JSON.parse(String(init?.body));
        return jsonResponse({ ok: true, item: { id: "reply-appointment-1", action_payload: detailsBody?.action_payload } });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-appointment-1",
            use_case: "book_appointment",
            provider_name: "Clinica Lopez",
            provider_phone: "+34 600 111 222",
            action_summary: "Clinic is checking the dermatology slot.",
            action_payload: {
              appointment_type: "medical",
              appointment_reason: "dermatology follow-up",
              requested_time: "next Tuesday morning",
              location: "Marbella",
              mission_status: "awaiting_provider_reply",
              preferred_channel: "phone",
            },
            status: "calling",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const liveHandoff = await screen.findByTestId("panel-concierge-live-handoff");
    expect(liveHandoff).toHaveAttribute("data-state", "waiting");
    expect(liveHandoff).toHaveTextContent("Waiting for provider");
    expect(screen.getByTestId("item-live-handoff-provider")).toHaveTextContent("Clinica Lopez");
    expect(screen.getByTestId("item-live-handoff-details")).toHaveTextContent("Reason needed");
    expect(await screen.findByTestId("panel-concierge-provider-reply")).toHaveTextContent("Provider reply");
    fireEvent.click(screen.getByTestId("button-provider-reply-confirmed-reply-appointment-1"));
    expect(screen.getByTestId("panel-provider-reply-confirmed-reply-appointment-1")).toHaveTextContent(
      "A date and time are needed to save the appointment in Scheduled Support.",
    );
    expect(screen.getByTestId("button-provider-reply-save-reply-appointment-1")).toBeDisabled();

    fireEvent.change(screen.getByTestId("input-provider-reply-time-reply-appointment-1"), {
      target: { value: "2026-07-22T10:30" },
    });
    fireEvent.change(screen.getByTestId("input-provider-reply-reference-reply-appointment-1"), {
      target: { value: "AP-77" },
    });
    fireEvent.change(screen.getByTestId("input-provider-reply-text-reply-appointment-1"), {
      target: { value: "Confirmed Wednesday at 10:30. Bring insurance card." },
    });
    fireEvent.click(screen.getByTestId("button-provider-reply-save-reply-appointment-1"));

    await waitFor(() => {
      expect(scheduledBody).toMatchObject({
        event_type: "appointment",
        title: "Appointment with Clinica Lopez",
        channel: "app",
        status: "upcoming",
        source: "concierge",
        metadata: expect.objectContaining({
          flow_reference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
          pending_id: "reply-appointment-1",
          appointment_type: "medical",
          provider_name: "Clinica Lopez",
          provider_phone: "+34 600 111 222",
          provider_reply: "Confirmed Wednesday at 10:30. Bring insurance card.",
          reference: "AP-77",
          location: "Marbella",
        }),
      });
      expect(new Date(String(scheduledBody?.scheduled_for)).toString()).not.toBe("Invalid Date");
      expect(detailsBody).toMatchObject({
        action_payload: expect.objectContaining({
          flow_reference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
          appointment_type: "medical",
          provider_name: "Clinica Lopez",
          provider_reply_status: "confirmed",
          provider_reply: "Confirmed Wednesday at 10:30. Bring insurance card.",
          reference: "AP-77",
          location: "Marbella",
          scheduled_event_id: "scheduled-appointment-reply",
          provider_task_status: "reply_received",
          live_handoff_status: "ready",
          live_handoff_outcome: "provider_replied",
          provider_follow_up_confirmed: false,
        }),
      });
    });
  });

  it("saves a confirmed Safe Home service reply and keeps it on the task", async () => {
    let scheduledBody: Record<string, unknown> | null = null;
    let detailsBody: { action_payload?: Record<string, unknown> } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/profile/scheduled-events")) {
        scheduledBody = JSON.parse(String(init?.body));
        return jsonResponse({ event: { id: "scheduled-home-reply", ...scheduledBody } }, { status: 201 });
      }
      if (target.endsWith("/api/concierge/actions/reply-home-service-1/details")) {
        detailsBody = JSON.parse(String(init?.body));
        return jsonResponse({ ok: true, item: { id: "reply-home-service-1", action_payload: detailsBody?.action_payload } });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-home-service-1",
            use_case: "book_appointment",
            provider_name: "Saved Plumber",
            provider_phone: "+34 600 222 333",
            action_summary: "Plumber is checking the leak repair slot.",
            action_payload: {
              appointment_type: "home-service",
              flow_reference: CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
              service_type: "plumber",
              problem_summary: "Leak under kitchen sink",
              urgency: "tomorrow",
              location: "Home kitchen",
              home_access_or_safety_notes: "Caregiver can open the door",
              mission_status: "awaiting_provider_reply",
              preferred_channel: "whatsapp",
            },
            status: "calling",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const liveHandoff = await screen.findByTestId("panel-concierge-live-handoff");
    expect(liveHandoff).toHaveAttribute("data-state", "waiting");
    expect(liveHandoff).toHaveTextContent("Waiting for provider");
    expect(screen.getByTestId("item-live-handoff-provider")).toHaveTextContent("Saved Plumber");
    expect(screen.getByTestId("item-live-handoff-details")).toHaveTextContent("Leak under kitchen sink");
    expect(await screen.findByTestId("panel-concierge-provider-reply")).toHaveTextContent("Provider reply");
    fireEvent.click(screen.getByTestId("button-provider-reply-confirmed-reply-home-service-1"));
    expect(screen.getByTestId("panel-provider-reply-confirmed-reply-home-service-1")).toHaveTextContent(
      "A date and time are needed to save the visit in Scheduled Support.",
    );
    expect(screen.getByTestId("button-provider-reply-save-reply-home-service-1")).toBeDisabled();

    fireEvent.change(screen.getByTestId("input-provider-reply-time-reply-home-service-1"), {
      target: { value: "2026-07-23T11:00" },
    });
    expect(screen.getByTestId("button-provider-reply-save-reply-home-service-1")).toBeDisabled();
    fireEvent.change(screen.getByTestId("input-provider-reply-reference-reply-home-service-1"), {
      target: { value: "PL-19" },
    });
    fireEvent.change(screen.getByTestId("input-provider-reply-text-reply-home-service-1"), {
      target: { value: "Can visit Thursday at 11:00. Estimated cost EUR95." },
    });
    fireEvent.change(screen.getByTestId("input-provider-reply-notes-reply-home-service-1"), {
      target: { value: "Caregiver will be home during the visit." },
    });
    fireEvent.click(screen.getByTestId("button-provider-reply-save-reply-home-service-1"));

    await waitFor(() => {
      expect(scheduledBody).toMatchObject({
        event_type: "home_service",
        title: "Plumber with Saved Plumber",
        channel: "app",
        status: "upcoming",
        source: "concierge",
        metadata: expect.objectContaining({
          flow_reference: CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
          pending_id: "reply-home-service-1",
          appointment_type: "home-service",
          provider_name: "Saved Plumber",
          provider_phone: "+34 600 222 333",
          service_type: "plumber",
          service_label: "Plumber",
          problem_summary: "Leak under kitchen sink",
          urgency: "tomorrow",
          estimated_cost: "EUR95",
          provider_reply: "Can visit Thursday at 11:00. Estimated cost EUR95.",
          reference: "PL-19",
          location: "Home kitchen",
          notes: "Caregiver will be home during the visit.",
          home_access_or_safety_notes: "Caregiver can open the door",
        }),
      });
      expect(String(scheduledBody?.description)).toContain("Notes: Caregiver will be home during the visit.");
      expect(new Date(String(scheduledBody?.scheduled_for)).toString()).not.toBe("Invalid Date");
      expect(detailsBody).toMatchObject({
        action_payload: expect.objectContaining({
          flow_reference: CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
          appointment_type: "home-service",
          provider_name: "Saved Plumber",
          service_type: "plumber",
          service_label: "Plumber",
          problem_summary: "Leak under kitchen sink",
          urgency: "tomorrow",
          estimated_cost: "EUR95",
          provider_reply_status: "confirmed",
          provider_reply: "Can visit Thursday at 11:00. Estimated cost EUR95.",
          reference: "PL-19",
          location: "Home kitchen",
          notes: "Caregiver will be home during the visit.",
          scheduled_event_id: "scheduled-home-reply",
          provider_task_status: "reply_received",
          live_handoff_status: "ready",
          live_handoff_outcome: "provider_replied",
          provider_follow_up_confirmed: false,
        }),
      });
    });
  });

  it("records no answer, keeps the task waiting, and prepares a confirmed follow-up", async () => {
    let detailsBody: { action_payload?: Record<string, unknown> } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).endsWith("/api/concierge/actions/reply-follow-up/details")) {
        detailsBody = JSON.parse(String(init?.body));
        return jsonResponse({ ok: true, item: { id: "reply-follow-up" } });
      }
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-follow-up",
            use_case: "book_ride",
            provider_name: "Radio Taxi",
            provider_phone: "+34 612 345 678",
            action_summary: "VYVA is waiting for the taxi provider reply.",
            action_payload: {
              pickup_address: "Saved home",
              destination_address: "City Clinic",
              requested_time: "tomorrow 09:00",
              mission_status: "awaiting_provider_reply",
            },
            status: "calling",
            language: "en",
            confirmed_at: new Date().toISOString(),
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const liveHandoff = await screen.findByTestId("panel-concierge-live-handoff");
    expect(liveHandoff).toHaveAttribute("data-state", "waiting");
    expect(liveHandoff).toHaveTextContent("Waiting for provider");
    const panel = await screen.findByTestId("panel-concierge-provider-reply");
    expect(panel).toHaveTextContent("Sent just now");
    expect(screen.getByTestId("button-provider-reply-confirmed-reply-follow-up")).toHaveTextContent("I got a reply");
    expect(screen.getByTestId("button-provider-reply-no-answer-reply-follow-up")).toHaveTextContent("No answer");
    expect(screen.getByTestId("button-provider-reply-unavailable-reply-follow-up")).toHaveTextContent("Try another provider");
    expect(screen.getByTestId("button-provider-reply-more-info-reply-follow-up")).toHaveTextContent("Provider needs info");
    expect(screen.getByTestId("button-provider-reply-mark-complete-reply-follow-up")).toHaveTextContent("Mark complete");

    fireEvent.click(screen.getByTestId("button-provider-reply-no-answer-reply-follow-up"));

    await waitFor(() => {
      expect(detailsBody).toMatchObject({
        action_payload: expect.objectContaining({
          live_handoff_status: "waiting",
          live_handoff_outcome: "no_answer",
          provider_follow_up_status: "waiting",
          provider_last_contact_channel: "phone",
          provider_last_contact_outcome: "no_answer",
          provider_contact_attempt_count: 1,
          waiting_for_provider: true,
          mission_status: "awaiting_provider_reply",
          provider_task_status: "waiting",
          provider_follow_up_requires_confirmation: true,
          provider_follow_up_confirmed: false,
          no_external_action_without_confirmation: true,
        }),
      });
    });
    expect(screen.getByTestId("provider-reply-notice")).toHaveTextContent("No answer saved. The task stays open");
  });

  it("keeps a provider question on the task as the next action", async () => {
    let detailsBody: { action_payload?: Record<string, unknown> } | null = null;
    let pendingPayload: Record<string, unknown> = {
      mission_status: "awaiting_provider_reply",
      waiting_for_provider: true,
    };
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/reply-more-info/details")) {
        detailsBody = JSON.parse(String(init?.body));
        pendingPayload = detailsBody?.action_payload ?? pendingPayload;
        return jsonResponse({ ok: true, item: { id: "reply-more-info", action_payload: pendingPayload } });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({ items: [{
          id: "reply-more-info",
          use_case: "book_appointment",
          provider_name: "Harbour Clinic",
          provider_phone: "+34 600 111 222",
          action_summary: "Waiting for Harbour Clinic.",
          action_payload: pendingPayload,
          status: "calling",
          language: "en",
        }] });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    await screen.findByTestId("panel-concierge-provider-reply");
    fireEvent.click(screen.getByTestId("button-provider-reply-more-info-reply-more-info"));
    fireEvent.change(screen.getByTestId("input-provider-reply-question-reply-more-info"), {
      target: { value: "Which insurance plan do you use?" },
    });
    fireEvent.click(screen.getByTestId("button-provider-reply-ask-reply-more-info"));

    await waitFor(() => expect(detailsBody?.action_payload).toMatchObject({
      provider_task_status: "action_needed",
      provider_reply_status: "needs_more_info",
      provider_reply: "Which insurance plan do you use?",
      provider_follow_up_requires_confirmation: true,
      provider_follow_up_confirmed: false,
    }));
    expect(await screen.findByTestId("panel-concierge-provider-reply")).toHaveTextContent("Action needed");
    expect(screen.getByTestId("panel-concierge-provider-reply")).toHaveTextContent("Which insurance plan do you use?");
  });

  it("asks only for missing provider information and requires a second confirmation before sending", async () => {
    let detailsBody: { action_payload?: Record<string, unknown> } | null = null;
    let reviewConfirmCalls = 0;
    let pendingPayload: Record<string, unknown> = {
      provider_task_status: "action_needed",
      provider_reply_status: "needs_more_info",
      provider_reply: "Please provide the insurance plan, policy number, and phone number.",
      provider_response_summary: "Provider needs insurance details.",
      provider_inbound_channel: "email",
      provider_inbound_sender: "frontdesk@clinic.example",
      provider_inbound_subject: "Appointment request",
      insurance_plan: "Sanitas",
      phone: "+34 600 111 222",
      provider_follow_up_confirmed: false,
      no_external_action_without_confirmation: true,
      execution_adapter: {
        version: 1,
        channel: "email",
        mode: "live",
        status: "sent",
      },
      email_outcome: "sent",
      execution_task: {
        version: 1,
        lifecycle_status: "confirmed",
        user_confirmed: true,
        external_action_allowed: true,
        execution_mode: "live",
        confirmed_at: "2026-07-18T10:00:00.000Z",
        approval_fingerprint: { version: 1, fingerprint: "old-approval" },
      },
    };
    pendingPayload.provider_reply_resolution = buildConciergeProviderReplyResolution({
      reply: String(pendingPayload.provider_reply),
      subject: String(pendingPayload.provider_inbound_subject),
      channel: "email",
      knownFacts: pendingPayload,
    });
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/reply-resolution/details")) {
        detailsBody = JSON.parse(String(init?.body));
        pendingPayload = detailsBody?.action_payload ?? pendingPayload;
        return jsonResponse({ ok: true, item: { id: "reply-resolution", action_payload: pendingPayload } });
      }
      if (target.endsWith("/api/concierge/actions/reply-resolution/review-confirm")) {
        reviewConfirmCalls += 1;
        pendingPayload = {
          ...pendingPayload,
          provider_follow_up_confirmed: true,
          execution_adapter: { status: "sent" },
        };
        return jsonResponse({
          pendingId: "reply-resolution",
          status: "pending",
          historySessionId: "reply-resolution-history",
          message: "Email sent.",
        });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({ items: [{
          id: "reply-resolution",
          use_case: "book_appointment",
          provider_name: "Harbour Clinic",
          provider_phone: null,
          action_summary: "Waiting for Harbour Clinic.",
          action_payload: pendingPayload,
          status: "calling",
          language: "en",
        }] });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const panel = await screen.findByTestId("panel-concierge-provider-reply");
    expect(panel).toHaveTextContent("Action needed");
    expect(panel).toHaveTextContent("Policy or member number");
    expect(screen.queryByTestId("input-provider-reply-resolution-phone_number")).not.toBeInTheDocument();
    expect(screen.queryByTestId("input-provider-reply-resolution-insurance_plan")).not.toBeInTheDocument();
    const answerButton = screen.getByTestId("button-provider-reply-answer-reply-resolution");
    expect(answerButton).toBeDisabled();

    fireEvent.change(screen.getByTestId("input-provider-reply-resolution-policy_number"), {
      target: { value: "POL-4455" },
    });
    fireEvent.click(answerButton);

    await waitFor(() => expect(detailsBody?.action_payload).toMatchObject({
      provider_email: "frontdesk@clinic.example",
      email_subject: "Re: Appointment request",
      provider_follow_up_status: "draft_ready",
      provider_follow_up_confirmed: false,
      no_external_action_without_confirmation: true,
      execution_adapter: null,
      email_outcome: null,
      execution_task: expect.objectContaining({
        lifecycle_status: "ready",
        user_confirmed: false,
        external_action_allowed: false,
        execution_mode: "blocked",
      }),
      provider_reply_resolution: expect.objectContaining({
        missingInformation: [],
        decision: expect.objectContaining({ status: "draft_ready" }),
      }),
      provider_reply_decisions: [expect.objectContaining({
        action: "answer_provider",
        status: "draft_ready",
      })],
    }));
    expect(reviewConfirmCalls).toBe(0);
    expect(await screen.findByTestId("panel-provider-reply-draft")).toHaveTextContent("Policy or member number: POL-4455");

    expect(screen.getByTestId("provider-reply-draft-recipient")).toHaveTextContent("frontdesk@clinic.example");
    expect(screen.queryByTestId("button-provider-reply-send-reply-resolution")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-provider-reply-review-reply-resolution"));
    expect(screen.getByTestId("panel-provider-reply-final-confirmation")).toHaveTextContent("Nothing is sent until you confirm here");
    expect(reviewConfirmCalls).toBe(0);
    fireEvent.click(screen.getByTestId("button-provider-reply-send-reply-resolution"));
    await waitFor(() => expect(reviewConfirmCalls).toBe(1));
    expect(await screen.findByTestId("status-provider-reply-sent")).toHaveTextContent("Waiting for the provider");
    expect(screen.queryByTestId("button-provider-reply-send-reply-resolution")).not.toBeInTheDocument();
  });

  it.each([
    {
      label: "ride phone call",
      id: "persisted-waiting-ride",
      useCase: "book_ride",
      providerName: "QA Transport",
      providerPhone: "+34 600 000 101",
      payload: {
        flow_reference: CONCIERGE_FLOW_REFERENCES.transportBooking,
        execution_channel: "phone",
        pickup_address: "Saved home",
        destination_address: "QA clinic",
      },
    },
    {
      label: "OTC pharmacy WhatsApp",
      id: "persisted-waiting-otc",
      useCase: "order_medicine",
      providerName: "QA Pharmacy",
      providerPhone: "+34 600 000 102",
      payload: {
        flow_reference: CONCIERGE_FLOW_REFERENCES.otcPharmacy,
        execution_channel: "whatsapp",
        provider_whatsapp: "+34 600 000 102",
        item_text: "OTC test item",
      },
    },
    {
      label: "appointment email",
      id: "persisted-waiting-appointment",
      useCase: "book_appointment",
      providerName: "QA Clinic",
      providerPhone: null,
      payload: {
        flow_reference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
        execution_channel: "email",
        provider_email: "qa-clinic@example.com",
        appointment_type: "medical",
        appointment_reason: "QA follow-up",
      },
    },
    {
      label: "home-service booking form",
      id: "persisted-waiting-home",
      useCase: "home_service",
      providerName: "QA Home Service",
      providerPhone: null,
      payload: {
        flow_reference: CONCIERGE_FLOW_REFERENCES.homeService,
        execution_channel: "booking_url",
        booking_url: "https://example.com/qa-home-service",
        appointment_type: "home-service",
        service_type: "plumber",
        problem_summary: "QA leak check",
      },
    },
  ])("restores the persisted Waiting for provider state after reload for $label", async ({
    id,
    useCase,
    providerName,
    providerPhone,
    payload,
  }) => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id,
            use_case: useCase,
            provider_name: providerName,
            provider_phone: providerPhone,
            action_summary: `Waiting for ${providerName}.`,
            action_payload: {
              ...payload,
              mission_status: "awaiting_provider_reply",
              live_handoff_status: "waiting",
              provider_follow_up_status: "waiting",
              provider_waiting_since: "2026-07-16T08:00:00.000Z",
              provider_contact_attempt_count: 1,
              waiting_for_provider: true,
              no_external_action_without_confirmation: true,
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const handoff = await screen.findByTestId("panel-concierge-live-handoff");
    expect(handoff).toHaveAttribute("data-state", "waiting");
    expect(handoff).toHaveTextContent("Waiting for provider");
    expect(screen.getByTestId("item-live-handoff-provider")).toHaveTextContent(providerName);
    expect(screen.getByTestId(`button-provider-reply-confirmed-${id}`)).toHaveTextContent("I got a reply");
    expect(screen.getByTestId(`button-provider-reply-no-answer-${id}`)).toHaveTextContent("No answer");
    expect(screen.getByTestId(`button-provider-reply-unavailable-${id}`)).toHaveTextContent("Try another provider");
  });

  it("closes a waiting provider task only when the user marks it complete", async () => {
    let completionBody: { outcome_summary?: string; outcome_payload?: Record<string, unknown> } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).endsWith("/api/concierge/actions/reply-complete/complete")) {
        completionBody = JSON.parse(String(init?.body));
        return jsonResponse({ ok: true, status: "completed", sessionId: "session-reply-complete" });
      }
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-complete",
            use_case: "book_ride",
            provider_name: "Radio Taxi",
            provider_phone: "+34 612 345 678",
            action_summary: "Waiting for Radio Taxi.",
            action_payload: {
              mission_status: "awaiting_provider_reply",
              live_handoff_status: "waiting",
              provider_waiting_since: "2026-07-16T08:00:00.000Z",
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    fireEvent.click(await screen.findByTestId("button-provider-reply-mark-complete-reply-complete"));

    await waitFor(() => {
      expect(completionBody).toMatchObject({
        outcome_summary: "Task marked complete.",
        outcome_payload: expect.objectContaining({
          live_handoff_status: "completed",
          live_handoff_outcome: "user_marked_complete",
          completed_from: "provider_follow_up_panel",
          no_external_action_without_confirmation: true,
          provider_reply_decisions: [expect.objectContaining({
            action: "mark_complete",
            status: "completed",
          })],
        }),
      });
    });
  });

  it("honors Home provider follow-up route intent inside the existing provider panel", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-route-follow-up",
            use_case: "book_ride",
            provider_name: "Radio Taxi",
            provider_phone: "+34 612 345 678",
            action_summary: "VYVA is waiting for the taxi provider reply.",
            action_payload: {
              mission_status: "awaiting_provider_reply",
            },
            status: "calling",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([{
      pathname: "/concierge",
      state: {
        focusRightNow: true,
        conciergeProviderAction: {
          pendingId: "reply-route-follow-up",
          mode: "follow_up",
        },
      },
    }]);

    expect(await screen.findByTestId("panel-concierge-provider-reply")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("provider-reply-notice")).toHaveTextContent("Follow-up prepared in chat.");
    });
  });

  it("honors Home provider reply route intent by opening the reply form", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-route-confirmed",
            use_case: "book_ride",
            provider_name: "Radio Taxi",
            provider_phone: "+34 612 345 678",
            action_summary: "VYVA is waiting for the taxi provider reply.",
            action_payload: {
              mission_status: "awaiting_provider_reply",
            },
            status: "calling",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([{
      pathname: "/concierge",
      state: {
        focusRightNow: true,
        conciergeProviderAction: {
          pendingId: "reply-route-confirmed",
          mode: "reply",
        },
      },
    }]);

    expect(await screen.findByTestId("panel-provider-reply-confirmed-reply-route-confirmed")).toBeInTheDocument();
  });

  it("shows structured execution details when a pending task needs more information", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "ride-needs-destination",
            use_case: "book_ride",
            provider_name: "Radio Taxi",
            provider_phone: "+34 612 345 678",
            action_summary: "Book a ride to the clinic.",
            action_payload: {
              pickup_address: "Saved home",
              requested_time: "tomorrow 09:00",
              execution_task: {
                version: 1,
                flow_reference: "FLOW_TRANSPORT_BOOKING",
                action_type: "phone_call",
                requested_tool: "phone_call",
                active_tool: "phone_call",
                lifecycle_status: "needs_info",
                provider_ready: true,
                missing_requirements: [{
                  key: "destination",
                  label_en: "Destination",
                  label_es: "Destino",
                }],
                confirmation_required: true,
                user_confirmed: false,
                created_at: "2026-07-14T10:00:00.000Z",
                updated_at: "2026-07-14T10:00:00.000Z",
              },
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const panel = await screen.findByTestId("panel-concierge-execution-status");
    expect(panel).toHaveAttribute("data-phase", "needs_info");
    expect(panel).toHaveTextContent("Needs details");
    expect(panel).toHaveTextContent("Add Destination to continue.");
    expect(screen.getByTestId("panel-concierge-user-update")).toHaveTextContent("VYVA needs: Destination.");
    expect(panel).toHaveTextContent("One detail needed");
  });

  it("opens a replacement transport search when a provider is unavailable", async () => {
    let triggerBody: { use_case?: string; action_payload?: Record<string, unknown> } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-unavailable-ride",
            use_case: "book_ride",
            provider_name: "Radio Taxi",
            provider_phone: "+34 612 345 678",
            action_summary: "Taxi provider could not take the booking.",
            action_payload: {
              pickup_address: "Saved home",
              destination_address: "City Clinic",
              requested_time: "tomorrow 09:00",
              mission_status: "awaiting_provider_reply",
            },
            status: "calling",
            language: "en",
          }],
        });
      }
      if (String(url).includes("/api/offers/search")) {
        return jsonResponse({
          category: "Transport",
          decision_explanation: "Ranked by proximity, reputation, and availability.",
          neutrality_note: "No provider paid for placement.",
          source_guidance: ["local directories"],
          protection_summary: {
            title: "Protected search",
            checkpoints: ["No contact without confirmation."],
            notification_triggers: [],
            action_guardrail: "VYVA asks before contacting anyone.",
          },
          options: [{
            label: "Opcion recomendada",
            name: "City Taxi",
            category: "Transport",
            what_it_offers: "Local taxi service",
            price_or_advantage: "Clear local taxi pricing",
            why_good_option: "Nearby and available soon",
            distance_or_availability: "10 minutes away",
            contact_method: "Phone",
            phone: "+34 600 999 111",
            trust_note: "Public listing with phone contact.",
            score: 84,
            score_breakdown: {
              distance: 90,
              price_value: 70,
              trust: 80,
              simplicity: 85,
              preference_match: 95,
            },
          }],
          next_step: "Confirm before contacting any provider.",
        });
      }
      if (String(url).includes("/api/concierge/actions/trigger")) {
        triggerBody = JSON.parse(String(init?.body));
        return jsonResponse({ pendingId: "replacement-transport-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    fireEvent.click(await screen.findByTestId("button-provider-reply-unavailable-reply-unavailable-ride"));

    expect(await screen.findByTestId("panel-provider-search-criteria")).toHaveTextContent("What matters most");
    const transportQuery = (screen.getByTestId("input-offers-query") as HTMLInputElement).value;
    expect(transportQuery).toContain("Find another transport option");
    expect(transportQuery).toContain("Destination: City Clinic");
    expect(transportQuery).toContain("Pickup: Saved home");
    expect(transportQuery).toContain("Time: tomorrow 09:00");
    expect(transportQuery).toContain("Avoid this provider: Radio Taxi");
    expect(screen.getByTestId("panel-provider-search-criteria")).toHaveTextContent("Soon");
    expect(screen.getByTestId("provider-reply-notice")).toHaveTextContent("Transport search prepared with the same details.");

    fireEvent.click(screen.getByTestId("button-offers-search"));
    const prepareButton = await screen.findByTestId("button-provider-comparison-contact-city-taxi-1");
    fireEvent.click(prepareButton);
    fireEvent.click(await screen.findByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(triggerBody).toMatchObject({
        use_case: "find_provider",
        action_payload: expect.objectContaining({
          flow_reference: CONCIERGE_FLOW_REFERENCES.transportBooking,
          provider_search_mode: "transport",
          no_external_action_without_confirmation: true,
        }),
      });
    });
  });

  it("opens a replacement pharmacy search when an OTC provider is unavailable", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-unavailable-otc",
            use_case: "order_medicine",
            provider_name: "Neighborhood Pharmacy",
            provider_phone: "+34 600 333 444",
            action_summary: "Pharmacy cannot supply the requested OTC item.",
            action_payload: {
              item_text: "Vitamin D",
              fulfillment_preference: "pickup",
              requested_time: "tomorrow",
              notes: "Same brand",
              mission_status: "awaiting_provider_reply",
            },
            status: "calling",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    fireEvent.click(await screen.findByTestId("button-provider-reply-unavailable-reply-unavailable-otc"));

    expect(await screen.findByTestId("panel-provider-search-criteria")).toHaveTextContent("What matters most");
    const pharmacyQuery = (screen.getByTestId("input-offers-query") as HTMLInputElement).value;
    expect(pharmacyQuery).toContain("Find another pharmacy");
    expect(pharmacyQuery).toContain("Item: Vitamin D");
    expect(pharmacyQuery).toContain("Preference: pickup");
    expect(pharmacyQuery).toContain("Avoid this provider: Neighborhood Pharmacy");
    expect(screen.getByTestId("provider-reply-notice")).toHaveTextContent("Pharmacy search prepared with the original item.");
  });

  it("opens a replacement home-service search when a provider is unavailable", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-unavailable-home-service",
            use_case: "book_appointment",
            provider_name: "Saved Plumber",
            provider_phone: "+34 600 222 333",
            action_summary: "Plumber is not available tomorrow.",
            action_payload: {
              appointment_type: "home-service",
              service_type: "plumber",
              problem_summary: "Leak under the kitchen sink",
              urgency: "tomorrow",
              location: "Home kitchen",
              mission_status: "awaiting_provider_reply",
            },
            status: "calling",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    fireEvent.click(await screen.findByTestId("button-provider-reply-unavailable-reply-unavailable-home-service"));

    expect(await screen.findByTestId("panel-provider-search-criteria")).toHaveTextContent("What matters most");
    const homeServiceQuery = (screen.getByTestId("input-offers-query") as HTMLInputElement).value;
    expect(homeServiceQuery).toContain("Find another home-service provider");
    expect(homeServiceQuery).toContain("Type: plumber");
    expect(homeServiceQuery).toContain("Problem: Leak under the kitchen sink");
    expect(homeServiceQuery).toContain("Avoid this provider: Saved Plumber");
    expect(screen.getByTestId("provider-reply-notice")).toHaveTextContent("Home-service search prepared with the original problem.");
  });

  it("opens a replacement appointment search when a provider is unavailable", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-unavailable-appointment",
            use_case: "book_appointment",
            provider_name: "Clinica Lopez",
            provider_phone: "+34 600 111 222",
            action_summary: "Clinic cannot offer the requested slot.",
            action_payload: {
              appointment_type: "medical",
              appointment_reason: "dermatology follow-up",
              requested_time: "next Tuesday morning",
              location: "Marbella",
              mission_status: "awaiting_provider_reply",
            },
            status: "calling",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    fireEvent.click(await screen.findByTestId("button-provider-reply-unavailable-reply-unavailable-appointment"));

    expect(await screen.findByTestId("panel-provider-search-criteria")).toHaveTextContent("What matters most");
    const appointmentQuery = (screen.getByTestId("input-offers-query") as HTMLInputElement).value;
    expect(appointmentQuery).toContain("Find another doctor or clinic");
    expect(appointmentQuery).toContain("Type: medical");
    expect(appointmentQuery).toContain("Reason: dermatology follow-up");
    expect(appointmentQuery).toContain("Preferred time: next Tuesday morning");
    expect(appointmentQuery).toContain("Area: Marbella");
    expect(appointmentQuery).toContain("Avoid this provider: Clinica Lopez");
    expect(screen.getByTestId("panel-provider-search-criteria")).toHaveTextContent("Coverage");
    expect(screen.getByTestId("provider-reply-notice")).toHaveTextContent("Alternative appointment search prepared.");
  });

  it("keeps provider questions inside VYVA when more information is needed", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-more-info",
            use_case: "book_appointment",
            provider_name: "Clinic desk",
            provider_phone: null,
            action_summary: "Clinic needs one more detail before confirming.",
            action_payload: {
              appointment_type: "medical",
              mission_status: "awaiting_provider_reply",
              execution_channel: "manual",
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    fireEvent.click(await screen.findByTestId("button-provider-reply-more-info-reply-more-info"));
    fireEvent.change(screen.getByTestId("input-provider-reply-question-reply-more-info"), {
      target: { value: "Do they need fasting before the blood test?" },
    });
    fireEvent.click(screen.getByTestId("button-provider-reply-ask-reply-more-info"));

    expect(await screen.findByTestId("provider-reply-notice")).toHaveTextContent("The question is ready to answer.");
  });

  it("reveals prepared email draft actions only after user confirmation and final confirmation", async () => {
    const openMock = vi.spyOn(window, "open").mockImplementation(() => null);
    apiFetchMock.mockImplementation(async () => jsonResponse({
      items: [{
        id: "email-1",
        use_case: "send_message",
        provider_name: "Clinic desk",
        provider_phone: null,
        action_summary: "Email draft prepared for the clinic.",
        action_payload: {
          execution_channel: "email",
          provider_email: "clinic@example.com",
          email_subject: "Question about my appointment",
          email_body: "Hello, I would like to confirm my appointment details.",
          execution_task: liveReadyExecutionTask("email", {
            user_confirmed: false,
            external_action_allowed: false,
            execution_mode: "manual_review",
          }),
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    expect(await screen.findByTestId("button-concierge-confirm-email-1")).toHaveTextContent("Open email draft");
    expect(screen.queryByTestId("link-concierge-email-email-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("panel-concierge-email-draft")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-concierge-confirm-email-1"));

    const emailLink = await screen.findByTestId("link-concierge-email-draft-open-email-1");
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/email-1/review-confirm", { method: "POST" });
    });
    fireEvent.click(emailLink);
    expect(openMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("modal-concierge-final-confirmation")).toHaveTextContent("Review first");
    fireEvent.click(screen.getByTestId("button-concierge-final-confirm"));
    expect(openMock).toHaveBeenCalledWith(
      "mailto:clinic@example.com?subject=Question%20about%20my%20appointment&body=Hello%2C%20I%20would%20like%20to%20confirm%20my%20appointment%20details.",
      "_self",
      undefined,
    );
    expect(screen.getByTestId("panel-concierge-email-draft")).toHaveTextContent("Email ready");
    expect(screen.getByTestId("button-email-draft-sent-email-1")).toHaveTextContent("I sent it");
  });

  it("shows an owned live email send in completed history while provider follow-up stays open", async () => {
    let confirmed = false;
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/live-email-history/review-confirm")) {
        confirmed = true;
        return jsonResponse({
          pendingId: "live-email-history",
          status: "pending",
          message: "sent",
          historySessionId: "session-live-email-history",
        });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "live-email-history",
            use_case: "send_message",
            provider_name: "Controlled Email Pilot Inbox",
            provider_phone: null,
            action_summary: "Send the controlled email pilot receipt.",
            action_payload: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
              execution_channel: "email",
              provider_email: "concierge@vyva.life",
              email_subject: "VYVA Concierge app-triggered smoke",
              email_body: "Controlled app-triggered live email smoke.",
              ...(confirmed ? {
                execution_adapter: {
                  version: 1,
                  adapter: "concierge_email_adapter",
                  mode: "live",
                  channel: "email",
                  tool: "email",
                  status: "sent",
                  attempted_at: "2026-07-18T10:00:00.000Z",
                  provider_name: "Controlled Email Pilot Inbox",
                  provider_contact: "concierge@vyva.life",
                  external_action_allowed: true,
                  result: "sent",
                  result_id: "resend-live-email-1",
                },
                execution_task: liveReadyExecutionTask("email", {
                  flow_reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
                  lifecycle_status: "confirmed",
                  user_confirmed: true,
                  external_action_allowed: true,
                  execution_mode: "live",
                  confirmation_source: "user_controlled_execution",
                }),
                waiting_for_provider: true,
                mission_status: "awaiting_provider_reply",
              } : {
                execution_task: liveReadyExecutionTask("email", {
                  flow_reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
                  user_confirmed: false,
                  external_action_allowed: false,
                  execution_mode: "manual_review",
                }),
              }),
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      if (target.endsWith("/api/concierge/actions/sessions")) {
        return jsonResponse({
          items: confirmed ? [{
            id: "session-live-email-history",
            pending_id: "live-email-history",
            use_case: "send_message",
            provider_name: "Controlled Email Pilot Inbox",
            outcome: "completed",
            outcome_summary: "Email sent to Controlled Email Pilot Inbox (concierge@vyva.life). Waiting for provider reply.",
            completed_at: "2026-07-18T10:00:00.000Z",
            outcome_payload: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
              receipt_kind: "provider_contact_sent",
              email_outcome: "sent",
              execution_channel: "email",
              execution_mode: "live",
              live_action: true,
              external_action_allowed: true,
              user_confirmed: true,
              provider_name: "Controlled Email Pilot Inbox",
              provider_email: "concierge@vyva.life",
              recipient_email: "concierge@vyva.life",
              provider_message_id: "resend-live-email-1",
              waiting_for_provider: true,
              execution_task: {
                user_confirmed: true,
                lifecycle_status: "confirmed",
              },
            },
          }] : [],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    fireEvent.click(await screen.findByTestId("button-concierge-confirm-live-email-history"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/concierge/actions/live-email-history/review-confirm",
        { method: "POST" },
      );
    });
    const history = await screen.findByTestId("section-concierge-completed-history");
    expect(history).toHaveTextContent("Done recently");
    expect(screen.getByTestId("section-concierge-active-task")).toHaveTextContent("Controlled Email Pilot Inbox");
    expect(screen.queryByTestId("panel-concierge-email-draft")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("card-concierge-completed-session-live-email-history"));
    const receipt = await screen.findByTestId("panel-concierge-completed-receipt");
    const receiptDetails = within(receipt).getByTestId("list-concierge-completed-receipt-details");
    expect(receiptDetails).toHaveTextContent("Sent");
    expect(receiptDetails).toHaveTextContent("Live action");
    expect(receiptDetails).toHaveTextContent("Confirmed");
    expect(receiptDetails).toHaveTextContent("Yes");
    expect(receiptDetails).toHaveTextContent("concierge@vyva.life");
    expect(receiptDetails).toHaveTextContent("resend-live-email-1");
  });

  it("blocks live email handoff when the admin channel gate is not ready", async () => {
    const openMock = vi.spyOn(window, "open").mockImplementation(() => null);
    apiFetchMock.mockImplementation(async () => jsonResponse({
      items: [{
        id: "email-blocked-1",
        use_case: "send_message",
        provider_name: "Clinic desk",
        provider_phone: null,
        action_summary: "Email draft prepared for the clinic.",
        action_payload: {
          execution_channel: "email",
          provider_email: "clinic@example.com",
          email_subject: "Question about my appointment",
          email_body: "Hello, I would like to confirm my appointment details.",
          execution_task: liveReadyExecutionTask("email", {
            external_action_allowed: false,
            execution_mode: "blocked",
            channel_readiness: {
              version: 1,
              tool: "email",
              channel: "email",
              label: "Email",
              status: "disabled",
              ready: false,
              admin_enabled: false,
              configured: true,
              verified: true,
              dry_run: false,
              external_action_allowed: false,
              blockers: ["email_admin_disabled"],
            },
          }),
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    const blockedPanel = await screen.findByTestId("panel-concierge-channel-readiness-blocked");
    expect(blockedPanel).toHaveTextContent("Channel not ready");
    expect(blockedPanel).toHaveTextContent("Email");
    expect(blockedPanel).toHaveTextContent("VYVA will not open or contact a provider until an admin enables, configures, and verifies this channel.");
    expect(screen.queryByTestId("link-concierge-email-email-blocked-1")).not.toBeInTheDocument();
    expect(openMock).not.toHaveBeenCalled();
  });

  it("shows updated reconfirmation details before approving a stale live action again", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "email-reconfirm-1",
            use_case: "send_message",
            provider_name: "Clinic desk",
            provider_phone: null,
            action_summary: "Email updated clinic paperwork.",
            action_payload: {
              execution_channel: "email",
              provider_email: "clinic@example.com",
              email_subject: "Updated paperwork",
              email_body: "Hello, please confirm the updated appointment paperwork.",
              reconfirmation_request: {
                version: 1,
                status: "needed",
                requested_at: "2026-07-01T10:30:00.000Z",
                requested_by: "admin-1",
                changed_fields: ["payload"],
                payload_preview: {
                  version: 1,
                  adapter: "concierge_email_adapter",
                  channel: "email",
                  tool: "email",
                  provider_name: "Clinic desk",
                  provider_contact: "clinic@example.com",
                  summary: "Email updated clinic paperwork.",
                  pending_id: "email-reconfirm-1",
                  user_id: "user-1",
                  valid: true,
                  missing_fields: [],
                  blockers: [],
                  outbound_payload: {
                    provider_name: "Clinic desk",
                    provider_contact: "clinic@example.com",
                    summary: "Email updated clinic paperwork.",
                    action_payload: {
                      email_body: "Hello, please confirm the updated appointment paperwork.",
                    },
                  },
                },
              },
              execution_task: liveReadyExecutionTask("email", {
                lifecycle_status: "ready",
                user_confirmed: false,
                external_action_allowed: false,
                execution_mode: "manual_review",
                confirmation_source: "operator_reconfirmation_request",
                confirmed_at: "2026-07-01T10:00:00.000Z",
                failure_reason: "user_reconfirmation_required",
              }),
            },
            status: "pending",
            language: "en",
            confirmed_at: "2026-07-01T10:00:00.000Z",
          }],
        });
      }
      if (target.endsWith("/api/concierge/actions/email-reconfirm-1/review-confirm")) {
        return jsonResponse({
          pendingId: "email-reconfirm-1",
          status: "pending",
          message: "Updated Concierge action approved and ready for VYVA retry.",
        });
      }
      if (target.endsWith("/api/concierge/actions/sessions")) {
        return jsonResponse({ items: [] });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const panel = await screen.findByTestId("panel-concierge-reconfirmation-request");
    expect(panel).toHaveTextContent("Updated approval");
    expect(panel).toHaveTextContent("Changed since your last OK: action details");
    expect(panel).toHaveTextContent("Clinic desk");
    expect(panel).toHaveTextContent("clinic@example.com");
    expect(panel).toHaveTextContent("Email updated clinic paperwork.");
    expect(screen.getByTestId("panel-concierge-next-action")).toHaveTextContent("Review the updated details");

    fireEvent.click(screen.getByTestId("button-concierge-confirm-email-reconfirm-1"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/email-reconfirm-1/review-confirm", { method: "POST" });
    });
  });

  it("labels dry-run tasks, blocks browser opens, and saves simulated completion history", async () => {
    const openMock = vi.spyOn(window, "open").mockImplementation(() => null);
    let completed = false;
    let completeBody: { outcome_payload?: Record<string, unknown>; outcome_summary?: string } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/dry-email-1/review-confirm")) {
        return jsonResponse({ pendingId: "dry-email-1", status: "pending" });
      }
      if (target.endsWith("/api/concierge/actions/dry-email-1/complete")) {
        completed = true;
        completeBody = JSON.parse(String(init?.body));
        return jsonResponse({ ok: true, status: "completed", sessionId: "session-dry-email-1" });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: completed ? [] : [{
            id: "dry-email-1",
            use_case: "send_message",
            provider_name: "VYVA Test Clinic",
            provider_phone: null,
            action_summary: "Dry-run email draft prepared for the clinic.",
            action_payload: {
              dry_run: true,
              test_mode: "concierge_dry_run",
              no_real_provider_contact: true,
              execution_channel: "email",
              provider_email: "concierge-dry-run+clinic@example.test",
              email_subject: "Dry-run appointment request",
              email_body: "Dry-run only: please ignore this appointment rehearsal email.",
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      if (target.endsWith("/api/concierge/actions/sessions")) {
        return jsonResponse({
          items: completed ? [{
            id: "session-dry-email-1",
            pending_id: "dry-email-1",
            use_case: "send_message",
            provider_name: "VYVA Test Clinic",
            outcome: "completed",
            outcome_summary: completeBody?.outcome_summary ?? "Simulated dry-run outcome: Dry-run email draft prepared for the clinic.",
            completed_at: "2026-07-16T11:00:00.000Z",
            outcome_payload: completeBody?.outcome_payload ?? null,
          }] : [],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    expect(await screen.findByTestId("badge-concierge-dry-run-dry-email-1")).toHaveTextContent("Test mode");
    const dryRunPanel = await screen.findByTestId("panel-concierge-dry-run-outcome-dry-email-1");
    expect(dryRunPanel).toHaveTextContent("Save simulated outcome");
    expect(screen.getByTestId("button-concierge-dry-run-complete-dry-email-1")).toBeDisabled();
    fireEvent.click(screen.getByTestId("button-concierge-confirm-dry-email-1"));

    const emailLink = await screen.findByTestId("link-concierge-email-draft-open-dry-email-1");
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/dry-email-1/review-confirm", { method: "POST" });
    });
    expect(emailLink).toBeDisabled();
    expect(emailLink).toHaveTextContent("Test mode");
    fireEvent.click(emailLink);
    expect(openMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("link-concierge-email-dry-email-1")).not.toBeInTheDocument();

    expect(screen.getByTestId("button-concierge-dry-run-complete-dry-email-1")).toBeEnabled();
    fireEvent.click(screen.getByTestId("button-concierge-dry-run-complete-dry-email-1"));

    await waitFor(() => {
      expect(completeBody?.outcome_payload).toMatchObject({
        dry_run: true,
        simulated_outcome: true,
        no_real_provider_contact: true,
        completed_from: "concierge_dry_run_outcome_panel",
      });
    });
    expect(await screen.findByTestId("badge-concierge-completed-dry-run-session-dry-email-1")).toHaveTextContent("Test mode");
  });

  it.each(CONCIERGE_DRY_RUN_FIXTURES.map((fixture) => [fixture.reference, fixture] as const))(
    "renders %s as a safe dry-run active task",
    async (_reference, fixture) => {
      const pendingId = `dry-${fixture.reference.toLowerCase().replace(/_/g, "-")}`;
      apiFetchMock.mockImplementation(async (url) => {
        const target = String(url);
        if (target.endsWith("/api/concierge/actions/pending")) {
          return jsonResponse({
            items: [{
              id: pendingId,
              use_case: fixture.useCase,
              provider_name: fixture.provider?.name ?? "VYVA Test Review Desk",
              provider_phone: fixture.provider?.phone ?? null,
              action_summary: fixture.actionSummary,
              action_payload: fixture.actionPayload,
              status: "pending",
              language: "en",
            }],
          });
        }
        return jsonResponse({ items: [] });
      });

      renderScreen();

      expect(await screen.findByTestId(`badge-concierge-dry-run-${pendingId}`)).toHaveTextContent("Test mode");
      expect(await screen.findByTestId(`panel-concierge-dry-run-outcome-${pendingId}`)).toHaveTextContent("No real call");
      expect(screen.getByTestId(`button-concierge-dry-run-complete-${pendingId}`)).toBeDisabled();
      expect(screen.queryByTestId(`link-concierge-email-${pendingId}`)).not.toBeInTheDocument();
      expect(screen.queryByTestId(`link-concierge-whatsapp-${pendingId}`)).not.toBeInTheDocument();
      expect(screen.queryByTestId(`link-concierge-form-${pendingId}`)).not.toBeInTheDocument();
    },
  );

  it.each(CONCIERGE_DRY_RUN_FIXTURES.map((fixture) => [fixture.reference, fixture] as const))(
    "rehearses confirmed %s through simulated completion history",
    async (_reference, fixture) => {
      const openMock = vi.spyOn(window, "open").mockImplementation(() => null);
      const pendingId = `dry-rehearsal-${fixture.reference.toLowerCase().replace(/_/g, "-")}`;
      let completed = false;
      let completeBody: {
        outcome_payload?: Record<string, unknown>;
        outcome_summary?: string;
      } | null = null;

      apiFetchMock.mockImplementation(async (url, init) => {
        const target = String(url);
        if (target.endsWith(`/api/concierge/actions/${pendingId}/review-confirm`)) {
          return jsonResponse({ pendingId, status: "pending" });
        }
        if (target.endsWith(`/api/concierge/actions/${pendingId}/complete`)) {
          completed = true;
          completeBody = JSON.parse(String(init?.body ?? "{}"));
          return jsonResponse({ ok: true, status: "completed", sessionId: `session-${pendingId}` });
        }
        if (target.endsWith("/api/concierge/actions/pending")) {
          return jsonResponse({
            items: completed ? [] : [{
              id: pendingId,
              use_case: fixture.useCase,
              provider_name: fixture.provider?.name ?? "VYVA Test Review Desk",
              provider_phone: fixture.provider?.phone ?? null,
              action_summary: fixture.actionSummary,
              action_payload: fixture.actionPayload,
              status: "calling",
              language: "en",
            }],
          });
        }
        if (target.endsWith("/api/concierge/actions/sessions")) {
          return jsonResponse({
            items: completed ? [{
              id: `session-${pendingId}`,
              pending_id: pendingId,
              use_case: fixture.useCase,
              provider_name: fixture.provider?.name ?? "VYVA Test Review Desk",
              outcome: "completed",
              outcome_summary: completeBody?.outcome_summary ?? fixture.expectedOutcomeSummary,
              completed_at: "2026-07-16T11:00:00.000Z",
              outcome_payload: completeBody?.outcome_payload ?? null,
            }] : [],
          });
        }
        return jsonResponse({ items: [] });
      });

      renderScreen();

      expect(await screen.findByTestId(`badge-concierge-dry-run-${pendingId}`)).toHaveTextContent("Test mode");
      expect(await screen.findByTestId(`panel-concierge-dry-run-outcome-${pendingId}`)).toHaveTextContent("No real call");
      expect(screen.getByTestId(`button-concierge-dry-run-complete-${pendingId}`)).toBeEnabled();
      expect(document.querySelectorAll("a[href^='mailto:'], a[href^='tel:'], a[href^='sms:'], a[href^='https://example.test']")).toHaveLength(0);
      fireEvent.click(screen.getByTestId(`button-concierge-dry-run-complete-${pendingId}`));

      await waitFor(() => {
        expect(completeBody?.outcome_payload).toMatchObject({
          dry_run: true,
          simulated_outcome: true,
          no_real_provider_contact: true,
          completed_from: "concierge_dry_run_outcome_panel",
        });
      });
      expect(completeBody?.outcome_summary).toMatch(/Simulated dry-run outcome/i);
      expect(openMock).not.toHaveBeenCalled();
      expect(await screen.findByTestId(`badge-concierge-completed-dry-run-session-${pendingId}`)).toHaveTextContent("Test mode");
    },
  );

  it("shows Show VYVA prepared tasks and blocks handoff until final confirmation", async () => {
    const openMock = vi.spyOn(window, "open").mockImplementation(() => null);
    apiFetchMock.mockImplementation(async () => jsonResponse({
      items: [{
        id: "show-vyva-email-1",
        use_case: "send_message",
        provider_name: "Trusted contact",
        provider_phone: null,
        action_summary: "Ask a trusted contact before replying.",
        action_payload: {
          show_vyva_action_id: "draft_reply",
          show_vyva_follow_up_context: "scam",
          show_vyva_source: "paste_text",
          source_route: "/scam-guard",
          review_summary: "Suspicious prize message",
          requested_tool: "email",
          execution_channel: "email",
          provider_email: "trusted@example.com",
          email_subject: "Can you check this message?",
          email_body: "I received a suspicious prize message. Can you help me review it?",
          show_vyva_execution_flow: "scam_email_forward_review",
          show_vyva_next_question: "Who should receive the draft, if anything needs to be sent?",
          show_vyva_required_details: ["Recipient or organization", "What needs to be said", "Final confirmation before sending or calling"],
          show_vyva_guided_steps: ["Summarize the important points.", "Prepare a draft or call notes.", "Wait for final user confirmation."],
          confirmation_required_before_action: true,
          no_external_action_without_confirmation: true,
          executor_version: 1,
          user_confirmed: false,
          execution_task: liveReadyExecutionTask("email", {
            user_confirmed: false,
            external_action_allowed: false,
            execution_mode: "manual_review",
          }),
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    await screen.findByText("VYVA prepared this");
    const rightNow = await screen.findByTestId("section-concierge-active-task");
    expect(rightNow).toHaveTextContent("VYVA prepared this");
    expect(rightNow).toHaveTextContent("Scam Guard");
    expect(rightNow).toHaveTextContent("Message");
    expect(rightNow).toHaveTextContent("Suspicious prize message");
    expect(screen.getByTestId("panel-show-vyva-execution-guide")).toHaveTextContent("Who should receive the draft");
    expect(screen.getByTestId("panel-show-vyva-execution-guide")).toHaveTextContent("Recipient or organization");
    expect(screen.getByTestId("panel-show-vyva-execution-guide")).toHaveTextContent("Nothing is sent, called, booked, bought, or shared until you confirm.");

    expect(screen.queryByTestId("link-concierge-email-show-vyva-email-1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-concierge-confirm-show-vyva-email-1"));
    expect(await screen.findByTestId("panel-concierge-email-draft")).toHaveTextContent("Email ready");
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/show-vyva-email-1/review-confirm", { method: "POST" });
    });
    fireEvent.click(screen.getByTestId("link-concierge-email-draft-open-show-vyva-email-1"));

    expect(openMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("modal-concierge-final-confirmation")).toHaveTextContent("Review first");
    expect(screen.getByTestId("modal-concierge-final-confirmation")).toHaveTextContent("Scam Guard");
    fireEvent.click(screen.getByTestId("button-concierge-final-confirm"));

    expect(openMock).toHaveBeenCalledWith(
      "mailto:trusted@example.com?subject=Can%20you%20check%20this%20message%3F&body=I%20received%20a%20suspicious%20prize%20message.%20Can%20you%20help%20me%20review%20it%3F",
      "_self",
      undefined,
    );
  });

  it("keeps a sent email draft waiting for the provider", async () => {
    const openMock = vi.spyOn(window, "open").mockImplementation(() => null);
    let detailsBody: { action_payload?: Record<string, unknown> } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/email-sent-1/details")) {
        detailsBody = JSON.parse(String(init?.body));
        return jsonResponse({ ok: true, item: { id: "email-sent-1" } });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "email-sent-1",
            use_case: "insurance_admin",
            provider_name: "Insurer Desk",
            provider_phone: null,
            action_summary: "Email ready for insurer.",
            action_payload: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
              execution_channel: "email",
              provider_email: "claims@example.com",
              email_subject: "Claim documents",
              email_body: "Hello, please review my claim documents.",
              execution_task: liveReadyExecutionTask("email", {
                flow_reference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
                user_confirmed: false,
                external_action_allowed: false,
                execution_mode: "manual_review",
              }),
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    expect(await screen.findByTestId("button-concierge-confirm-email-sent-1")).toHaveTextContent("Open email draft");
    expect(screen.queryByTestId("panel-concierge-email-draft")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-concierge-confirm-email-sent-1"));
    expect(await screen.findByTestId("panel-concierge-email-draft")).toHaveTextContent("Email ready");
    expect(screen.getByTestId("link-concierge-email-draft-open-email-sent-1")).toHaveTextContent("Open");
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/email-sent-1/review-confirm", { method: "POST" });
    });
    fireEvent.change(screen.getByTestId("input-email-draft-reference-email-sent-1"), {
      target: { value: "CL-11" },
    });
    fireEvent.change(screen.getByTestId("input-email-draft-notes-email-sent-1"), {
      target: { value: "Sent from Gmail." },
    });
    fireEvent.click(screen.getByTestId("button-email-draft-sent-email-sent-1"));

    await waitFor(() => {
      expect(detailsBody).toMatchObject({
        action_payload: expect.objectContaining({
          flow_reference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
          execution_type: "email_draft_outcome_capture",
          execution_channel: "email",
          email_outcome: "sent",
          provider_name: "Insurer Desk",
          provider_email: "claims@example.com",
          recipient_email: "claims@example.com",
          email_subject: "Claim documents",
          reference: "CL-11",
          notes: "Sent from Gmail.",
          live_handoff_status: "waiting",
          live_handoff_outcome: "email_sent",
          provider_follow_up_status: "waiting",
          provider_last_contact_channel: "email",
          provider_last_contact_outcome: "email_sent",
          provider_last_contact_summary: "Email sent to Insurer Desk. Reference: CL-11.",
          provider_contact_attempt_count: 1,
          waiting_for_provider: true,
          mission_status: "awaiting_provider_reply",
          completed_from: "email_draft_outcome_panel",
          no_external_action_without_confirmation: true,
        }),
      });
    });
    expect(screen.getByTestId("panel-concierge-email-draft")).toBeVisible();
    expect(screen.getByTestId("email-draft-notice")).toHaveTextContent("Email sent. Waiting for the provider.");

    fireEvent.click(screen.getByTestId("link-concierge-email-draft-open-email-sent-1"));
    expect(openMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("modal-concierge-final-confirmation")).toHaveTextContent("Review first");
    fireEvent.click(screen.getByTestId("button-concierge-final-confirm"));
    expect(openMock).toHaveBeenCalledWith(
      "mailto:claims@example.com?subject=Claim%20documents&body=Hello%2C%20please%20review%20my%20claim%20documents.",
      "_self",
      undefined,
    );
  });

  it("keeps a sent tool-gated email draft waiting for the provider", async () => {
    let detailsBody: { action_payload?: Record<string, unknown> } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/tool-email-1/details")) {
        detailsBody = JSON.parse(String(init?.body));
        return jsonResponse({ ok: true, item: { id: "tool-email-1" } });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "tool-email-1",
            use_case: "admin_task",
            provider_name: "Council Office",
            provider_phone: null,
            action_summary: "Email ready for the council office.",
            action_payload: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
              execution_channel: "email",
              provider_email: "office@example.com",
              email_subject: "Application question",
              email_body: "Hello, I need help with my application.",
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    expect(await screen.findByTestId("button-concierge-confirm-tool-email-1")).toHaveTextContent("Open email draft");
    fireEvent.click(screen.getByTestId("button-concierge-confirm-tool-email-1"));
    expect(await screen.findByTestId("panel-concierge-email-draft")).toHaveTextContent("Email ready");
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/tool-email-1/review-confirm", { method: "POST" });
    });
    fireEvent.change(screen.getByTestId("input-email-draft-reference-tool-email-1"), {
      target: { value: "APP-3" },
    });
    fireEvent.click(screen.getByTestId("button-email-draft-sent-tool-email-1"));

    await waitFor(() => {
      expect(detailsBody).toMatchObject({
        action_payload: expect.objectContaining({
          flow_reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
          execution_type: "email_draft_outcome_capture",
          execution_channel: "email",
          email_outcome: "sent",
          provider_name: "Council Office",
          provider_email: "office@example.com",
          live_handoff_status: "waiting",
          live_handoff_outcome: "email_sent",
          provider_follow_up_status: "waiting",
          provider_last_contact_channel: "email",
          provider_last_contact_outcome: "email_sent",
          provider_last_contact_summary: "Email sent to Council Office. Reference: APP-3.",
          provider_contact_attempt_count: 1,
          waiting_for_provider: true,
          mission_status: "awaiting_provider_reply",
          completed_from: "email_draft_outcome_panel",
          no_external_action_without_confirmation: true,
        }),
      });
    });
  });

  it("reveals prepared WhatsApp draft actions only after user confirmation and final confirmation", async () => {
    const openMock = vi.spyOn(window, "open").mockImplementation(() => null);
    apiFetchMock.mockImplementation(async () => jsonResponse({
      items: [{
        id: "whatsapp-1",
        use_case: "send_message",
        provider_name: "Care coordinator",
        provider_phone: "+34 611 222 333",
        action_summary: "WhatsApp draft prepared for the care coordinator.",
        action_payload: {
          preferred_channel: "whatsapp",
          execution_channel: "whatsapp",
          whatsapp_message: "Hello, can we confirm the visit time?",
          execution_task: liveReadyExecutionTask("whatsapp", {
            user_confirmed: false,
            external_action_allowed: false,
            execution_mode: "manual_review",
          }),
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    expect(await screen.findByTestId("button-concierge-confirm-whatsapp-1")).toHaveTextContent("Open WhatsApp draft");
    expect(screen.queryByTestId("link-concierge-whatsapp-whatsapp-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("panel-concierge-whatsapp-draft")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-concierge-confirm-whatsapp-1"));

    const whatsAppLink = await screen.findByTestId("link-concierge-whatsapp-draft-open-whatsapp-1");
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/whatsapp-1/review-confirm", { method: "POST" });
    });
    fireEvent.click(whatsAppLink);
    expect(openMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("modal-concierge-final-confirmation")).toHaveTextContent("Review first");
    fireEvent.click(screen.getByTestId("button-concierge-final-confirm"));
    expect(openMock).toHaveBeenCalledWith(
      "https://wa.me/34611222333?text=Hello%2C%20can%20we%20confirm%20the%20visit%20time%3F",
      "_blank",
      "noopener,noreferrer",
    );
    expect(screen.getByTestId("panel-concierge-whatsapp-draft")).toHaveTextContent("WhatsApp ready");
    expect(screen.getByTestId("button-whatsapp-draft-sent-whatsapp-1")).toHaveTextContent("I sent it");
  });

  it("keeps a sent WhatsApp draft waiting for the provider", async () => {
    let detailsBody: { action_payload?: Record<string, unknown> } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/whatsapp-sent-1/details")) {
        detailsBody = JSON.parse(String(init?.body));
        return jsonResponse({ ok: true, item: { id: "whatsapp-sent-1" } });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "whatsapp-sent-1",
            use_case: "order_medicine",
            provider_name: "Farmacia Luz",
            provider_phone: "+34 600 111 222",
            action_summary: "OTC request ready for Farmacia Luz.",
            action_payload: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.otcPharmacy,
              preferred_channel: "whatsapp",
              execution_channel: "whatsapp",
              item_text: "Paracetamol for pickup today",
              whatsapp_message: "Hello, do you have paracetamol available for pickup today?",
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    expect(await screen.findByTestId("button-concierge-confirm-whatsapp-sent-1")).toHaveTextContent("Open WhatsApp draft");
    fireEvent.click(screen.getByTestId("button-concierge-confirm-whatsapp-sent-1"));
    expect(await screen.findByTestId("panel-concierge-whatsapp-draft")).toHaveTextContent("WhatsApp ready");
    expect(screen.getByTestId("link-concierge-whatsapp-draft-open-whatsapp-sent-1")).toHaveTextContent("Open");
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/whatsapp-sent-1/review-confirm", { method: "POST" });
    });
    fireEvent.change(screen.getByTestId("input-whatsapp-draft-reference-whatsapp-sent-1"), {
      target: { value: "OTC-77" },
    });
    fireEvent.change(screen.getByTestId("input-whatsapp-draft-notes-whatsapp-sent-1"), {
      target: { value: "Sent in WhatsApp." },
    });
    fireEvent.click(screen.getByTestId("button-whatsapp-draft-sent-whatsapp-sent-1"));

    await waitFor(() => {
      expect(detailsBody).toMatchObject({
        action_payload: expect.objectContaining({
          flow_reference: CONCIERGE_FLOW_REFERENCES.otcPharmacy,
          execution_type: "whatsapp_draft_outcome_capture",
          execution_channel: "whatsapp",
          whatsapp_outcome: "sent",
          provider_name: "Farmacia Luz",
          provider_phone: "+34 600 111 222",
          provider_whatsapp: "34600111222",
          recipient_whatsapp: "34600111222",
          reference: "OTC-77",
          notes: "Sent in WhatsApp.",
          live_handoff_status: "waiting",
          live_handoff_outcome: "whatsapp_sent",
          provider_follow_up_status: "waiting",
          provider_last_contact_channel: "whatsapp",
          provider_last_contact_outcome: "whatsapp_sent",
          provider_last_contact_summary: "WhatsApp sent to Farmacia Luz. Reference: OTC-77.",
          provider_contact_attempt_count: 1,
          waiting_for_provider: true,
          mission_status: "awaiting_provider_reply",
          completed_from: "whatsapp_draft_outcome_panel",
          no_external_action_without_confirmation: true,
        }),
      });
    });
  });

  it("shows compact form plan details for VYVA-handled booking tasks", async () => {
    apiFetchMock.mockImplementation(async () => jsonResponse({
      items: [{
        id: "form-task-1",
        use_case: "book_appointment",
        provider_name: "The Good Table",
        provider_phone: null,
        action_summary: "VYVA will handle the booking form for The Good Table.",
        action_payload: {
          mission_status: "form_in_progress",
          preferred_channel: "booking_url",
          execution_channel: "booking_url",
          booking_url: "https://www.thefork.es/restaurante/example",
          form_automation_plan: {
            adapter_label: "TheFork",
            missing_fields: ["number of guests"],
            next_step: "Collect number of guests inside VYVA before using the external form.",
          },
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    expect(await screen.findByTestId("panel-concierge-appointment-mission")).toHaveTextContent("Form in progress");
    expect(screen.getByTestId("panel-concierge-appointment-mission")).toHaveTextContent("VYVA is handling this");
    expect(screen.getByTestId("panel-concierge-action-timeline")).toHaveTextContent("Request started");
    expect(screen.getByTestId("panel-concierge-next-action")).toHaveTextContent("Add missing details");
    expect(screen.getByTestId("timeline-step-requested")).toHaveAttribute("data-state", "active");
    expect(screen.getByTestId("timeline-step-waiting")).toHaveAttribute("data-state", "upcoming");
    expect(await screen.findByTestId("panel-concierge-form-plan")).toHaveTextContent("System: TheFork");
    expect(screen.getByTestId("panel-concierge-form-plan")).toHaveTextContent("Needs first: number of guests");
    expect(screen.getByTestId("button-booking-form-add-details-form-task-1")).toHaveTextContent("Add details");
    fireEvent.click(screen.getByTestId("button-booking-form-add-details-form-task-1"));
    expect(screen.getByTestId("booking-form-notice")).toHaveTextContent("VYVA can help collect those details.");
    expect(screen.getAllByText("Add missing details").length).toBeGreaterThan(0);
  });

  it("shows booking forms as ready to open when no details are missing", async () => {
    const openMock = vi.spyOn(window, "open").mockImplementation(() => null);
    apiFetchMock.mockImplementation(async () => jsonResponse({
      items: [{
        id: "form-ready-1",
        use_case: "book_appointment",
        provider_name: "The Good Table",
        provider_phone: null,
        action_summary: "Booking form ready for The Good Table.",
        action_payload: {
          mission_status: "form_in_progress",
          preferred_channel: "booking_url",
          execution_channel: "booking_url",
          reason: "Dinner reservation for tomorrow",
          booking_url: "https://www.thefork.es/restaurante/example",
          form_automation_plan: {
            adapter_label: "TheFork",
            missing_fields: [],
            next_step: "Use the supported booking page with the gathered details.",
            prefilled_url: "https://www.thefork.es/restaurante/example?date=tomorrow",
          },
          execution_task: liveReadyExecutionTask("booking_link", {
            flow_reference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
            lifecycle_status: "ready",
            user_confirmed: false,
          }),
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    expect(await screen.findByTestId("panel-concierge-appointment-mission")).toHaveTextContent("Form ready");
    expect(screen.getByTestId("panel-concierge-form-plan")).toHaveTextContent("Ready to open with the gathered details.");
    expect(screen.queryByText("VYVA is handling it")).not.toBeInTheDocument();
    expect(screen.queryByTestId("link-concierge-form-form-ready-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("link-booking-form-open-form-ready-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("text-booking-form-confirm-first-form-ready-1")).toHaveTextContent("Confirm above before opening the form.");
    expect(screen.getByTestId("panel-concierge-next-action")).toHaveTextContent("Open appointment form");
    expect(screen.getByTestId("button-concierge-confirm-form-ready-1")).toHaveTextContent("Open appointment form");

    fireEvent.click(screen.getByTestId("button-concierge-confirm-form-ready-1"));
    expect(openMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("modal-concierge-final-confirmation")).toHaveTextContent("Review first");
    fireEvent.click(screen.getByTestId("button-concierge-final-confirm"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/form-ready-1/confirm", { method: "POST" });
    });
    expect(openMock).toHaveBeenCalledWith(
      "https://www.thefork.es/restaurante/example?date=tomorrow",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("keeps a submitted booking form waiting for the provider", async () => {
    let detailsBody: { action_payload?: Record<string, unknown> } | null = null;
    let formConfirmed = false;
    vi.spyOn(window, "open").mockImplementation(() => null);
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/form-submit-1/confirm")) {
        expect(init?.method).toBe("POST");
        formConfirmed = true;
        return jsonResponse({ pendingId: "form-submit-1", status: "pending", conversationId: null, callSid: null });
      }
      if (target.endsWith("/api/concierge/actions/form-submit-1/details")) {
        detailsBody = JSON.parse(String(init?.body));
        return jsonResponse({ ok: true, item: { id: "form-submit-1" } });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "form-submit-1",
            use_case: "book_appointment",
            provider_name: "The Good Table",
            provider_phone: null,
            action_summary: "Booking form ready for The Good Table.",
            action_payload: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
              mission_status: "form_in_progress",
              preferred_channel: "booking_url",
              execution_channel: "booking_url",
              reason: "Dinner reservation for tomorrow",
              booking_url: "https://www.thefork.es/restaurante/example",
              form_automation_plan: {
                adapter_label: "TheFork",
                missing_fields: [],
                next_step: "Use the supported booking page with the gathered details.",
                prefilled_url: "https://www.thefork.es/restaurante/example?date=tomorrow",
              },
              ...(formConfirmed ? {
                execution_task: liveReadyExecutionTask("booking_link", {
                  flow_reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
                  confirmation_source: "confirm_endpoint",
                  confirmed_at: "2026-07-14T10:10:00.000Z",
                  updated_at: "2026-07-14T10:10:00.000Z",
                }),
              } : {}),
            },
            status: "pending",
            language: "en",
            confirmed_at: formConfirmed ? "2026-07-14T10:10:00.000Z" : null,
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    expect(await screen.findByTestId("text-booking-form-confirm-first-form-submit-1")).toHaveTextContent("Confirm above before opening the form.");
    expect(screen.queryByTestId("link-booking-form-open-form-submit-1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-concierge-confirm-form-submit-1"));
    expect(screen.getByTestId("modal-concierge-final-confirmation")).toHaveTextContent("Review first");
    fireEvent.click(screen.getByTestId("button-concierge-final-confirm"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/form-submit-1/confirm", { method: "POST" });
    });
    expect(await screen.findByTestId("panel-booking-form-ready-form-submit-1")).toHaveTextContent("Open form");
    fireEvent.change(screen.getByTestId("input-booking-form-reference-form-submit-1"), {
      target: { value: "TF-88" },
    });
    fireEvent.change(screen.getByTestId("input-booking-form-notes-form-submit-1"), {
      target: { value: "Submitted for tomorrow evening." },
    });
    fireEvent.click(screen.getByTestId("button-booking-form-submitted-form-submit-1"));

    await waitFor(() => {
      expect(detailsBody).toMatchObject({
        action_payload: expect.objectContaining({
          flow_reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
          execution_type: "form_booking_link_outcome_capture",
          execution_channel: "booking_url",
          form_outcome: "submitted",
          provider_name: "The Good Table",
          booking_url: "https://www.thefork.es/restaurante/example",
          prefilled_url: "https://www.thefork.es/restaurante/example?date=tomorrow",
          adapter_label: "TheFork",
          missing_fields: [],
          reference: "TF-88",
          notes: "Submitted for tomorrow evening.",
          live_handoff_status: "waiting",
          live_handoff_outcome: "form_submitted",
          provider_follow_up_status: "waiting",
          provider_last_contact_channel: "booking_url",
          provider_last_contact_outcome: "form_submitted",
          provider_last_contact_summary: "Form submitted: The Good Table. Reference: TF-88.",
          provider_contact_attempt_count: 1,
          waiting_for_provider: true,
          mission_status: "awaiting_provider_reply",
          completed_from: "booking_form_support_panel",
          no_external_action_without_confirmation: true,
        }),
      });
    });
  });
});
