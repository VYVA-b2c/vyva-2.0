import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  dbSelect: vi.fn(),
  dbInsert: vi.fn(),
  buildVoiceContext: vi.fn(),
  getMem0ApiKey: vi.fn(),
  searchMemories: vi.fn(),
  scheduleMem0Add: vi.fn(),
  formatMemoryBlock: vi.fn(),
  buildAgentOperatingRules: vi.fn(),
  buildConversationPlan: vi.fn(),
  selectVoiceConversationPlan: vi.fn(),
  formatConversationPlanPrompt: vi.fn(),
  signMedicalProfileToolToken: vi.fn(),
  signVoiceRecommendationFeedbackToolToken: vi.fn(),
  buildUserConversationContext: vi.fn(),
  formatConversationContextForPrompt: vi.fn(),
  getLatestShownVoiceRecommendation: vi.fn(),
  inferVoiceRecommendationResponseAction: vi.fn(),
  recordShownVoiceRecommendation: vi.fn(),
  recordVoiceRecommendationFeedback: vi.fn(),
  inferProfileGender: vi.fn(),
  genderInstruction: vi.fn(),
}));

vi.mock("../db.js", () => ({
  db: {
    select: dependencies.dbSelect,
    insert: dependencies.dbInsert,
  },
}));

vi.mock("../lib/voiceContext.js", () => ({
  buildVoiceContext: dependencies.buildVoiceContext,
}));

vi.mock("../lib/mem0.js", () => ({
  getMem0ApiKey: dependencies.getMem0ApiKey,
  searchMemories: dependencies.searchMemories,
  scheduleMem0Add: dependencies.scheduleMem0Add,
  formatMemoryBlock: dependencies.formatMemoryBlock,
}));

vi.mock("../lib/voiceAgentPolicy.js", () => ({
  buildAgentOperatingRules: dependencies.buildAgentOperatingRules,
  buildConversationPlan: dependencies.buildConversationPlan,
}));

vi.mock("../lib/voiceConversationPlans.js", () => ({
  selectVoiceConversationPlan: dependencies.selectVoiceConversationPlan,
  formatConversationPlanPrompt: dependencies.formatConversationPlanPrompt,
}));

vi.mock("../lib/jwt.js", () => ({
  signMedicalProfileToolToken: dependencies.signMedicalProfileToolToken,
  signVoiceRecommendationFeedbackToolToken:
    dependencies.signVoiceRecommendationFeedbackToolToken,
}));

vi.mock("../lib/conversationContext.js", () => ({
  buildUserConversationContext: dependencies.buildUserConversationContext,
  formatConversationContextForPrompt:
    dependencies.formatConversationContextForPrompt,
}));

vi.mock("../lib/voiceRecommendationFeedback.js", () => ({
  getLatestShownVoiceRecommendation:
    dependencies.getLatestShownVoiceRecommendation,
  inferVoiceRecommendationResponseAction:
    dependencies.inferVoiceRecommendationResponseAction,
  recordShownVoiceRecommendation:
    dependencies.recordShownVoiceRecommendation,
  recordVoiceRecommendationFeedback:
    dependencies.recordVoiceRecommendationFeedback,
}));

vi.mock("../lib/userPersonalization.js", () => ({
  inferProfileGender: dependencies.inferProfileGender,
  genderInstruction: dependencies.genderInstruction,
}));

import { routerHandler } from "../routes/router.js";
import { createOrchestratorRouterHandler } from "./orchestrator.js";
import type { OrchestratorShellModeResolution } from "./orchestratorTypes.js";

const FIXED_NOW = new Date("2026-08-02T12:00:00.000Z");
const TABLE_NAME = Symbol.for("drizzle:Name");
const legacyMode: OrchestratorShellModeResolution = {
  requestedMode: "legacy_only",
  effectiveMode: "legacy_only",
  defaultMode: "legacy_only",
  activationEligibility: "eligible",
  reasonCode: "orchestrator_shell_legacy_requested",
  nonExecutable: true,
};

type RouterFixture = {
  user_id: string;
  session_id: string;
  utterance: string;
  conversation_history: Array<{ role: "user" | "assistant"; content: string }>;
};

function tableName(table: unknown): string {
  return String((table as Record<symbol, unknown>)?.[TABLE_NAME] ?? "");
}

function queryResult(
  selectedFields: unknown,
): Record<string, unknown> {
  let selectedTable = "";
  const rows = () => {
    if (selectedTable === "profiles") {
      return [{
        full_name: "Review User",
        date_of_birth: null,
        preferred_language: "en",
        mem0_user_id: "memory-review-user",
        gender_identity: null,
        gender_self_describe: null,
        grammatical_gender: "neutral",
      }];
    }
    if (selectedTable === "session_state") {
      return [{
        current_agent: "companion",
        last_agent: null,
        last_intent: "companion",
        last_activity_at: FIXED_NOW,
        turn_count: 4,
        next_agent_override: null,
      }];
    }
    if (selectedTable === "session_exchanges" &&
      selectedFields &&
      typeof selectedFields === "object" &&
      "value" in selectedFields) {
      return [{ value: 3 }];
    }
    return [];
  };
  const proxy: Record<string, unknown> = new Proxy({}, {
    get(_target, property) {
      if (property === "from") {
        return (table: unknown) => {
          selectedTable = tableName(table);
          return proxy;
        };
      }
      if (property === "then") {
        return (
          resolve: (value: unknown[]) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve(rows()).then(resolve, reject);
      }
      return () => proxy;
    },
  });
  return proxy;
}

function insertResult(): Record<string, unknown> {
  const proxy: Record<string, unknown> = new Proxy({}, {
    get(_target, property) {
      if (property === "then") {
        return (
          resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve(undefined).then(resolve, reject);
      }
      return () => proxy;
    },
  });
  return proxy;
}

function directApp() {
  const app = express();
  app.use(express.json());
  app.post("/api/router", routerHandler);
  return app;
}

function shellApp(legacyHandler = routerHandler) {
  const app = express();
  app.use(express.json());
  app.post("/api/router", createOrchestratorRouterHandler({
    legacyHandler,
    flagResolver: () => legacyMode,
    currentTime: () => FIXED_NOW,
    idFactory: () => "real-router-parity",
    telemetryEmitter: () => undefined,
  }));
  return app;
}

function sideEffectSnapshot() {
  return {
    databaseReads: dependencies.dbSelect.mock.calls.length,
    sessionStateWrites: dependencies.dbInsert.mock.calls.filter(
      ([table]) => tableName(table) === "session_state",
    ).length,
    exchangeWrites: dependencies.dbInsert.mock.calls.filter(
      ([table]) => tableName(table) === "session_exchanges",
    ).length,
    voiceContext: dependencies.buildVoiceContext.mock.calls.length,
    conversationContext:
      dependencies.buildUserConversationContext.mock.calls.length,
    recommendationLookup:
      dependencies.getLatestShownVoiceRecommendation.mock.calls.length,
    recommendationShown:
      dependencies.recordShownVoiceRecommendation.mock.calls.length,
    recommendationWrite:
      dependencies.recordVoiceRecommendationFeedback.mock.calls.length,
    memorySearch: dependencies.searchMemories.mock.calls.length,
    memorySchedule: dependencies.scheduleMem0Add.mock.calls.length,
    medicalToken: dependencies.signMedicalProfileToolToken.mock.calls.length,
    feedbackToken:
      dependencies.signVoiceRecommendationFeedbackToolToken.mock.calls.length,
  };
}

async function execute(
  app: ReturnType<typeof directApp>,
  fixture: RouterFixture,
) {
  const response = await request(app).post("/api/router").send(fixture).expect(200);
  await Promise.resolve();
  return {
    status: response.status,
    body: response.body,
    sideEffects: sideEffectSnapshot(),
  };
}

function resetSpies() {
  for (const dependency of Object.values(dependencies)) {
    dependency.mockClear();
  }
}

describe("Task 6 real router parity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    process.env.ELEVENLABS_SAFETY_AGENT_ID = "agent-safety-review";
    process.env.ELEVENLABS_HEALTH_AGENT_ID = "agent-health-review";
    process.env.ELEVENLABS_MEDS_AGENT_ID = "agent-meds-review";
    process.env.ELEVENLABS_CONCIERGE_AGENT_ID = "agent-concierge-review";
    process.env.ELEVENLABS_BRAIN_COACH_AGENT_ID = "agent-brain-coach-review";
    process.env.ELEVENLABS_COMPANION_AGENT_ID = "agent-companion-review";

    dependencies.dbSelect.mockImplementation(
      (selectedFields: unknown) => queryResult(selectedFields),
    );
    dependencies.dbInsert.mockImplementation(() => insertResult());
    dependencies.buildVoiceContext.mockResolvedValue({
      profile_summary: "Fixed profile",
      next_best_conversation_id: "recommendation-review",
      next_best_conversation_domain: "health",
      next_best_conversation_title: "Fixed recommendation",
      next_best_conversation_reason: "Fixed reason",
      next_best_conversation_priority: "normal",
      next_best_conversation_score: 10,
      app_entrypoint: "",
    });
    dependencies.getMem0ApiKey.mockReturnValue("review-mem0-key");
    dependencies.searchMemories.mockResolvedValue([{ memory: "Fixed memory" }]);
    dependencies.scheduleMem0Add.mockReturnValue(undefined);
    dependencies.formatMemoryBlock.mockReturnValue("Fixed memory block");
    dependencies.buildAgentOperatingRules.mockImplementation(
      (domain: string) => `Fixed operating rules: ${domain}`,
    );
    dependencies.buildConversationPlan.mockImplementation(
      (domain: string) => `Fixed fallback plan: ${domain}`,
    );
    dependencies.selectVoiceConversationPlan.mockImplementation(
      ({ domain }: { domain: string }) => ({ plan_id: `plan-${domain}` }),
    );
    dependencies.formatConversationPlanPrompt.mockImplementation(
      (plan: { plan_id: string }) => `Fixed plan: ${plan.plan_id}`,
    );
    dependencies.signMedicalProfileToolToken.mockResolvedValue(
      "fixed-medical-token",
    );
    dependencies.signVoiceRecommendationFeedbackToolToken.mockResolvedValue(
      "fixed-feedback-token",
    );
    dependencies.buildUserConversationContext.mockResolvedValue({
      summary: "Fixed conversation context",
    });
    dependencies.formatConversationContextForPrompt.mockReturnValue(
      "Fixed conversation context",
    );
    dependencies.getLatestShownVoiceRecommendation.mockResolvedValue(null);
    dependencies.inferVoiceRecommendationResponseAction.mockReturnValue(null);
    dependencies.recordShownVoiceRecommendation.mockResolvedValue(undefined);
    dependencies.recordVoiceRecommendationFeedback.mockResolvedValue(undefined);
    dependencies.inferProfileGender.mockReturnValue("neutral");
    dependencies.genderInstruction.mockReturnValue(
      "Fixed neutral gender instruction.",
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.ELEVENLABS_SAFETY_AGENT_ID;
    delete process.env.ELEVENLABS_HEALTH_AGENT_ID;
    delete process.env.ELEVENLABS_MEDS_AGENT_ID;
    delete process.env.ELEVENLABS_CONCIERGE_AGENT_ID;
    delete process.env.ELEVENLABS_BRAIN_COACH_AGENT_ID;
    delete process.env.ELEVENLABS_COMPANION_AGENT_ID;
    delete process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_MODE;
    delete process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS;
    vi.clearAllMocks();
  });

  it("preserves the real safety response and exact side effects", async () => {
    const fixture: RouterFixture = {
      user_id: "user-safety-review",
      session_id: "session-safety-review",
      utterance: "help, I can't breathe",
      conversation_history: [{ role: "user", content: "Earlier context" }],
    };

    const direct = await execute(directApp(), fixture);
    resetSpies();
    const shellLegacyHandler = vi.fn(routerHandler);
    const throughShell = await execute(shellApp(shellLegacyHandler), fixture);

    expect(throughShell).toEqual(direct);
    expect(shellLegacyHandler).toHaveBeenCalledTimes(1);
    expect(throughShell.body.agent_id).toBe("agent-safety-review");
    expect(throughShell.body.session_data.domain).toBe("safety");
    expect(throughShell.sideEffects).toEqual({
      databaseReads: 3,
      sessionStateWrites: 1,
      exchangeWrites: 1,
      voiceContext: 1,
      conversationContext: 1,
      recommendationLookup: 1,
      recommendationShown: 1,
      recommendationWrite: 0,
      memorySearch: 1,
      memorySchedule: 1,
      medicalToken: 0,
      feedbackToken: 1,
    });
  });

  it("preempts Mental Wellbeing for explicit self-harm or suicide language", async () => {
    const fixture: RouterFixture = {
      user_id: "user-mental-wellbeing-safety-review",
      session_id: "session-mental-wellbeing-safety-review",
      utterance: "I want to die and I might kill myself",
      conversation_history: [{ role: "user", content: "I feel very low" }],
    };

    const direct = await execute(directApp(), fixture);
    resetSpies();
    const shellLegacyHandler = vi.fn(routerHandler);
    const throughShell = await execute(shellApp(shellLegacyHandler), fixture);

    expect(throughShell).toEqual(direct);
    expect(shellLegacyHandler).toHaveBeenCalledTimes(1);
    expect(throughShell.body.agent_id).toBe("agent-safety-review");
    expect(throughShell.body.session_data.domain).toBe("safety");
    expect(throughShell.body.session_data.mental_wellbeing_specialist)
      .toBeUndefined();
    expect(throughShell.body.system_prompt_override).toContain(
      "potential safety or crisis situation",
    );
  });

  it.each([
    "help",
    "help me",
    "please help",
    "help please",
    "I need help",
    "I need help now",
    "I really need help",
    "Vyva help",
  ])("routes bounded distress-help through safety before Mental Wellbeing: %s", async (utterance) => {
    const fixture: RouterFixture = {
      user_id: "user-mental-wellbeing-help-safety-review",
      session_id: "session-mental-wellbeing-help-safety-review",
      utterance,
      conversation_history: [{ role: "assistant", content: "I'm here with you." }],
    };
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_MODE = "specialist_preview";
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS = fixture.user_id;

    const direct = await execute(directApp(), fixture);

    expect(direct.body.agent_id).toBe("agent-safety-review");
    expect(direct.body.session_data.domain).toBe("safety");
    expect(direct.body.session_data.mental_wellbeing_specialist).toBeUndefined();
    expect(JSON.stringify(direct.body.dynamic_variables)).not.toContain("mental_wellbeing");
  });

  it.each([
    ["help me book a ride", "companion", "agent-companion-review", null],
    ["can you help me with my medication schedule", "meds", "agent-meds-review", null],
    ["help me find a Brain Coach activity", "brain_coach", "agent-brain-coach-review", null],
    ["can you help me relax", "companion", "agent-companion-review", "grounding_or_breathing"],
    ["can you help me with a breathing exercise", "companion", "agent-companion-review", "grounding_or_breathing"],
  ] as const)("does not treat ordinary help requests as generic safety: %s", async (
    utterance,
    expectedDomain,
    expectedAgent,
    expectedMentalWellbeingIntent,
  ) => {
    const fixture: RouterFixture = {
      user_id: "user-mental-wellbeing-help-ordinary-review",
      session_id: "session-mental-wellbeing-help-ordinary-review",
      utterance,
      conversation_history: [{ role: "assistant", content: "What would you like to do?" }],
    };
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_MODE = "specialist_preview";
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS = fixture.user_id;

    const direct = await execute(directApp(), fixture);

    expect(direct.body.agent_id).toBe(expectedAgent);
    expect(direct.body.session_data.domain).toBe(expectedDomain);
    if (expectedMentalWellbeingIntent) {
      expect(direct.body.session_data.mental_wellbeing_specialist).toMatchObject({
        outcome: "support_ready",
        support_intent: expectedMentalWellbeingIntent,
      });
    } else {
      expect(direct.body.session_data.mental_wellbeing_specialist).toBeUndefined();
    }
  });

  it.each([
    "I overdosed.",
    "I've overdosed.",
    "I have overdosed.",
    "I think I overdosed.",
    "I took an overdose.",
    "I think I took an overdose.",
    "I may have overdosed.",
  ])("routes first-person current overdose language through safety: %s", async (utterance) => {
    const fixture: RouterFixture = {
      user_id: "user-mental-wellbeing-overdose-safety-review",
      session_id: "session-mental-wellbeing-overdose-safety-review",
      utterance,
      conversation_history: [{ role: "assistant", content: "Tell me what happened." }],
    };
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_MODE = "specialist_preview";
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS = fixture.user_id;

    const direct = await execute(directApp(), fixture);

    expect(direct.body.agent_id).toBe("agent-safety-review");
    expect(direct.body.session_data.domain).toBe("safety");
    expect(direct.body.session_data.mental_wellbeing_specialist).toBeUndefined();
  });

  it.each([
    "I'm in danger.",
    "I am in immediate danger.",
  ])("routes first-person current danger language through safety: %s", async (utterance) => {
    const fixture: RouterFixture = {
      user_id: "user-mental-wellbeing-danger-safety-review",
      session_id: "session-mental-wellbeing-danger-safety-review",
      utterance,
      conversation_history: [{ role: "assistant", content: "I'm listening." }],
    };
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_MODE = "specialist_preview";
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS = fixture.user_id;

    const direct = await execute(directApp(), fixture);

    expect(direct.body.agent_id).toBe("agent-safety-review");
    expect(direct.body.session_data.domain).toBe("safety");
    expect(direct.body.session_data.mental_wellbeing_specialist).toBeUndefined();
  });

  it.each([
    "Tell me about danger signs.",
    "I watched a movie called Danger.",
  ])("does not route benign danger references to safety: %s", async (utterance) => {
    const fixture: RouterFixture = {
      user_id: "user-mental-wellbeing-danger-reference-review",
      session_id: "session-mental-wellbeing-danger-reference-review",
      utterance,
      conversation_history: [{ role: "assistant", content: "What are you curious about?" }],
    };
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_MODE = "specialist_preview";
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS = fixture.user_id;

    const direct = await execute(directApp(), fixture);

    expect(direct.body.agent_id).toBe("agent-companion-review");
    expect(direct.body.session_data.domain).toBe("companion");
    expect(direct.body.session_data.mental_wellbeing_specialist).toBeUndefined();
  });

  it.each([
    "I cannot breathe.",
    "I can barely breathe.",
    "I can't breathe.",
    "I cant breathe.",
    "I am unable to breathe.",
    "I'm unable to breathe.",
    "I can hardly breathe.",
    "I am struggling to breathe.",
    "I'm struggling to breathe.",
  ])("routes emergency-style breathing through safety before Mental Wellbeing: %s", async (utterance) => {
    const fixture: RouterFixture = {
      user_id: "user-mental-wellbeing-breathing-review",
      session_id: "session-mental-wellbeing-breathing-review",
      utterance,
      conversation_history: [{ role: "user", content: "I feel anxious" }],
    };
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_MODE = "specialist_preview";
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS = fixture.user_id;

    const direct = await execute(directApp(), fixture);

    expect(direct.body.agent_id).toBe("agent-safety-review");
    expect(direct.body.session_data.domain).toBe("safety");
    expect(direct.body.session_data.mental_wellbeing_specialist).toBeUndefined();
    expect(JSON.stringify(direct.body.dynamic_variables)).not.toContain("mental_wellbeing");
  });

  it.each([
    "I'm depressed and thinking about dying.",
    "I've been thinking about dying.",
    "I keep thinking of dying.",
  ])("keeps direct death-intent wording on the existing safety route: %s", async (utterance) => {
    const fixture: RouterFixture = {
      user_id: "user-mental-wellbeing-dying-review",
      session_id: "session-mental-wellbeing-dying-review",
      utterance,
      conversation_history: [{ role: "user", content: "I feel very low" }],
    };
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_MODE = "specialist_preview";
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS = fixture.user_id;

    const direct = await execute(directApp(), fixture);

    expect(direct.body.agent_id).toBe("agent-safety-review");
    expect(direct.body.session_data.domain).toBe("safety");
    expect(direct.body.session_data.mental_wellbeing_specialist).toBeUndefined();
  });

  it.each([
    "I'm reading a book about a character thinking about dying.",
    "We were discussing a movie about dying.",
  ])("does not route third-person or reference death wording to safety: %s", async (utterance) => {
    const fixture: RouterFixture = {
      user_id: "user-mental-wellbeing-dying-reference-review",
      session_id: "session-mental-wellbeing-dying-reference-review",
      utterance,
      conversation_history: [{ role: "assistant", content: "Tell me more." }],
    };
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_MODE = "specialist_preview";
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS = fixture.user_id;

    const direct = await execute(directApp(), fixture);

    expect(direct.body.agent_id).toBe("agent-companion-review");
    expect(direct.body.session_data.domain).toBe("companion");
    expect(direct.body.session_data.mental_wellbeing_specialist).toBeUndefined();
  });

  it.each([
    "Can you help me with a breathing exercise?",
    "Teach me a breathing exercise.",
    "I want to calm down and breathe.",
    "Can we do a grounding exercise?",
    "I feel stressed and want to practice breathing.",
  ])("does not route voluntary calming and breathing requests to safety: %s", async (utterance) => {
    const fixture: RouterFixture = {
      user_id: "user-mental-wellbeing-ordinary-breathing-review",
      session_id: "session-mental-wellbeing-ordinary-breathing-review",
      utterance,
      conversation_history: [{ role: "assistant", content: "I'm here with you." }],
    };
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_MODE = "specialist_preview";
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS = fixture.user_id;

    const direct = await execute(directApp(), fixture);

    expect(direct.body.agent_id).toBe("agent-companion-review");
    expect(direct.body.session_data.domain).toBe("companion");
    expect(direct.body.session_data.mental_wellbeing_specialist).toMatchObject({
      outcome: "support_ready",
      support_intent: "grounding_or_breathing",
    });
  });

  it.each([
    ["I'm anxious about my medication.", "meds", "agent-meds-review"],
    ["I feel low after taking my medicine.", "meds", "agent-meds-review"],
    ["I'm stressed because I need a ride to my doctor.", "health", "agent-health-review"],
    ["Can you help me book transportation?", "companion", "agent-companion-review"],
    ["Can you help me find a Brain Coach activity?", "brain_coach", "agent-brain-coach-review"],
    ["Help me breathe, I have crushing chest pain.", "safety", "agent-safety-review"],
  ] as const)("preserves existing cross-domain routing for %s", async (utterance, expectedDomain, expectedAgent) => {
    const fixture: RouterFixture = {
      user_id: "user-mental-wellbeing-cross-domain-review",
      session_id: "session-mental-wellbeing-cross-domain-review",
      utterance,
      conversation_history: [{ role: "assistant", content: "How can I help?" }],
    };
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_MODE = "specialist_preview";
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS = fixture.user_id;

    const direct = await execute(directApp(), fixture);

    expect(direct.body.agent_id).toBe(expectedAgent);
    expect(direct.body.session_data.domain).toBe(expectedDomain);
    expect(direct.body.session_data.mental_wellbeing_specialist).toBeUndefined();
  });

  it("preserves ordinary Mental Wellbeing support for companion/social support requests", async () => {
    const fixture: RouterFixture = {
      user_id: "user-mental-wellbeing-social-support-review",
      session_id: "session-mental-wellbeing-social-support-review",
      utterance: "I feel stressed and want someone to talk to.",
      conversation_history: [{ role: "assistant", content: "I'm here with you." }],
    };
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_MODE = "specialist_preview";
    process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS = fixture.user_id;

    const direct = await execute(directApp(), fixture);

    expect(direct.body.agent_id).toBe("agent-companion-review");
    expect(direct.body.session_data.domain).toBe("companion");
    expect(direct.body.session_data.mental_wellbeing_specialist).toMatchObject({
      outcome: "support_ready",
      support_intent: "loneliness_support",
    });
  });

  it("preserves the real normal response and exact side effects", async () => {
    const fixture: RouterFixture = {
      user_id: "user-health-review",
      session_id: "session-health-review",
      utterance: "What does my health blood pressure mean?",
      conversation_history: [{ role: "assistant", content: "How can I help?" }],
    };

    const direct = await execute(directApp(), fixture);
    resetSpies();
    const shellLegacyHandler = vi.fn(routerHandler);
    const throughShell = await execute(shellApp(shellLegacyHandler), fixture);

    expect(throughShell).toEqual(direct);
    expect(shellLegacyHandler).toHaveBeenCalledTimes(1);
    expect(throughShell.body.agent_id).toBe("agent-health-review");
    expect(throughShell.body.session_data.domain).toBe("health");
    expect(throughShell.sideEffects).toEqual({
      databaseReads: 4,
      sessionStateWrites: 1,
      exchangeWrites: 1,
      voiceContext: 1,
      conversationContext: 1,
      recommendationLookup: 1,
      recommendationShown: 1,
      recommendationWrite: 0,
      memorySearch: 1,
      memorySchedule: 1,
      medicalToken: 1,
      feedbackToken: 1,
    });
  });
});
