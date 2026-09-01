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
import {
  task17ClinicalDosingExclusionFixtures,
  task17CrossDomainFixtures,
  task17InteractionExclusionFixtures,
  task17SafetyPrecedenceFixtures,
  task17ValidNavigationFixtures,
} from "../medication/medicationFixtures.js";
import {
  task18CrossDomainFixtures,
  task18ExternalExecutionFixtures,
  task18SafetyPrecedenceFixtures,
} from "../concierge/conciergeFixtures.js";
import {
  task19CaregiverBoundaryFixtures,
  task19ConciergeOverlapFixtures,
  task19MentalWellbeingOverlapFixtures,
  task19SafetyPrecedenceFixtures,
  task19SocialParityFixtures,
} from "../socialSupport/socialSupportFixtures.js";

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

const task18RealRouterNavigationCases = [
  {
    utterance: "Open Concierge.",
    expectedActionType: "concierge.task",
    expectedRoute: "/concierge",
    expectedCapability: "concierge_request_intake",
    expectedRequestCategory: "request_intake",
    expectedPresentationId: "presentation.concierge.request_intake",
  },
  {
    utterance: "Show my Concierge page.",
    expectedActionType: "concierge.task",
    expectedRoute: "/concierge",
    expectedCapability: "concierge_request_intake",
    expectedRequestCategory: "request_intake",
    expectedPresentationId: "presentation.concierge.request_intake",
  },
  {
    utterance: "I need Concierge help.",
    expectedActionType: "concierge.task",
    expectedRoute: "/concierge",
    expectedCapability: "concierge_request_intake",
    expectedRequestCategory: "request_intake",
    expectedPresentationId: "presentation.concierge.request_intake",
  },
  {
    utterance: "Open Trusted Help.",
    expectedActionType: "concierge.task",
    expectedRoute: "/concierge",
    expectedCapability: "concierge_trusted_help_context",
    expectedRequestCategory: "trusted_help_setup",
    expectedPresentationId: "presentation.concierge.trusted_help_setup",
  },
  {
    utterance: "Set up Trusted Help.",
    expectedActionType: "concierge.task",
    expectedRoute: "/concierge",
    expectedCapability: "concierge_trusted_help_context",
    expectedRequestCategory: "trusted_help_setup",
    expectedPresentationId: "presentation.concierge.trusted_help_setup",
  },
  {
    utterance: "Open shopping helper.",
    expectedActionType: "concierge.shopping",
    expectedRoute: "/concierge/shopping",
    expectedCapability: "concierge_shopping_context",
    expectedRequestCategory: "shopping_context",
    expectedPresentationId: "presentation.concierge.shopping_context",
  },
  {
    utterance: "Show shopping helper.",
    expectedActionType: "concierge.shopping",
    expectedRoute: "/concierge/shopping",
    expectedCapability: "concierge_shopping_context",
    expectedRequestCategory: "shopping_context",
    expectedPresentationId: "presentation.concierge.shopping_context",
  },
] as const;

const task18TrustedHelpFlagOffCases = [
  "Open Trusted Help.",
  "Set up Trusted Help.",
] as const;

const task18TrustedHelpContactRejectionCases = [
  "Call my trusted person.",
  "Message my trusted person.",
  "Tell my trusted person my address.",
  "Ask my trusted person to book a ride.",
  "Contact my trusted helper.",
] as const;

const task18ShoppingExecutionRejectionCases = [
  "Order groceries for me.",
  "Buy milk.",
  "Place the order.",
  "Checkout.",
  "Pay for it.",
  "Use my card.",
] as const;

const task19RealRouterNavigationCases = task19SocialParityFixtures;

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
    delete process.env.VYVA_MEDICATION_SPECIALIST_MODE;
    delete process.env.VYVA_MEDICATION_SPECIALIST_ALLOW_USERS;
    delete process.env.VYVA_BRAIN_COACH_SPECIALIST_MODE;
    delete process.env.VYVA_BRAIN_COACH_SPECIALIST_ALLOW_USERS;
    delete process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_MODE;
    delete process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS;
    delete process.env.VYVA_CONCIERGE_SPECIALIST_MODE;
    delete process.env.VYVA_CONCIERGE_SPECIALIST_ALLOW_USERS;
    delete process.env.VYVA_SOCIAL_SUPPORT_SPECIALIST_MODE;
    delete process.env.VYVA_SOCIAL_SUPPORT_SPECIALIST_ALLOW_USERS;
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
    ...task17SafetyPrecedenceFixtures,
    "I think I took too much medication.",
    "I took a double dose of my pill.",
    "I accidentally mixed my medication with alcohol.",
    "I have severe dizziness after my medicine.",
    "I am suicidal and may overdose on pills.",
  ])("routes medication risk language through safety before Medication Specialist: %s", async (utterance) => {
    const fixture: RouterFixture = {
      user_id: "user-medication-risk-safety-review",
      session_id: "session-medication-risk-safety-review",
      utterance,
      conversation_history: [{ role: "assistant", content: "Tell me what happened." }],
    };
    process.env.VYVA_MEDICATION_SPECIALIST_MODE = "specialist_preview";
    process.env.VYVA_MEDICATION_SPECIALIST_ALLOW_USERS = fixture.user_id;

    const direct = await execute(directApp(), fixture);

    expect(direct.body.agent_id).toBe("agent-safety-review");
    expect(direct.body.session_data.domain).toBe("safety");
    expect(direct.body.session_data.medication_specialist).toBeUndefined();
    expect(JSON.stringify(direct.body.dynamic_variables)).not.toContain("medication_specialist");
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

  it("preserves legacy Medication routing when the Medication Specialist flag is off", async () => {
    const fixture: RouterFixture = {
      user_id: "user-medication-flag-off-review",
      session_id: "session-medication-flag-off-review",
      utterance: "Can you help me with my medication schedule?",
      conversation_history: [{ role: "assistant", content: "How can I help?" }],
    };

    const direct = await execute(directApp(), fixture);

    expect(direct.body.agent_id).toBe("agent-meds-review");
    expect(direct.body.session_data.domain).toBe("meds");
    expect(direct.body.session_data.medication_specialist).toBeUndefined();
    expect(JSON.stringify(direct.body.dynamic_variables)).not.toContain("medication_specialist");
  });

  it("adds Medication Specialist metadata only for flag-enabled supported medication requests", async () => {
    const fixture: RouterFixture = {
      user_id: "user-medication-specialist-review",
      session_id: "session-medication-specialist-review",
      utterance: "Can you help me with my metformin medication schedule?",
      conversation_history: [{ role: "assistant", content: "How can I help?" }],
    };
    process.env.VYVA_MEDICATION_SPECIALIST_MODE = "specialist_preview";
    process.env.VYVA_MEDICATION_SPECIALIST_ALLOW_USERS = fixture.user_id;

    const direct = await execute(directApp(), fixture);

    expect(direct.body.agent_id).toBe("agent-meds-review");
    expect(direct.body.session_data.domain).toBe("meds");
    expect(direct.body.session_data.medication_specialist).toMatchObject({
      selected_specialist_id: "medication",
      selected_flow_id: "medication.reminder",
      outcome: "tool_proposed",
      action_type: "meds.management",
      tool_proposal_decision: "proposal_allowed",
    });
    expect(direct.body.system_prompt_override).toContain("MEDICATION SPECIALIST MIGRATION BLOCK");
    expect(JSON.stringify(direct.body.session_data.medication_specialist)).not.toContain("metformin");
    expect(JSON.stringify(direct.body.dynamic_variables)).not.toContain("metformin");
  });

  it.each(task17ValidNavigationFixtures)(
    "adds Medication Specialist metadata for valid medication navigation/context: %s",
    async (utterance) => {
      const fixture: RouterFixture = {
        user_id: "user-medication-valid-navigation-review",
        session_id: "session-medication-valid-navigation-review",
        utterance,
        conversation_history: [{ role: "assistant", content: "How can I help?" }],
      };
      process.env.VYVA_MEDICATION_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_MEDICATION_SPECIALIST_ALLOW_USERS = fixture.user_id;

      const direct = await execute(directApp(), fixture);

      expect(direct.body.agent_id).toBe("agent-meds-review");
      expect(direct.body.session_data.domain).toBe("meds");
      expect(direct.body.session_data.medication_specialist).toMatchObject({
        selected_specialist_id: "medication",
        selected_flow_id: "medication.reminder",
        outcome: "tool_proposed",
        tool_proposal_decision: "proposal_allowed",
      });
    },
  );

  it("keeps dose-confirmation mutation on exact legacy path when the flag is enabled", async () => {
    const fixture: RouterFixture = {
      user_id: "user-medication-dose-mutation-review",
      session_id: "session-medication-dose-mutation-review",
      utterance: "I took my medication",
      conversation_history: [{ role: "assistant", content: "How can I help?" }],
    };
    process.env.VYVA_MEDICATION_SPECIALIST_MODE = "specialist_preview";
    process.env.VYVA_MEDICATION_SPECIALIST_ALLOW_USERS = fixture.user_id;

    const direct = await execute(directApp(), fixture);

    expect(direct.body.agent_id).toBe("agent-meds-review");
    expect(direct.body.session_data.domain).toBe("meds");
    expect(direct.body.session_data.medication_specialist).toBeUndefined();
    expect(JSON.stringify(direct.body.dynamic_variables)).not.toContain("medication_specialist");
  });

  it.each([...task17ClinicalDosingExclusionFixtures, ...task17InteractionExclusionFixtures])(
    "does not attach Medication Specialist metadata for migration-ineligible clinical/interaction request: $utterance",
    async (caseFixture) => {
      const fixture: RouterFixture = {
        user_id: "user-medication-ineligible-review",
        session_id: "session-medication-ineligible-review",
        utterance: caseFixture.utterance,
        conversation_history: [{ role: "assistant", content: "How can I help?" }],
      };
      process.env.VYVA_MEDICATION_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_MEDICATION_SPECIALIST_ALLOW_USERS = fixture.user_id;

      const direct = await execute(directApp(), fixture);

      expect(direct.body.session_data.medication_specialist).toBeUndefined();
      expect(JSON.stringify(direct.body.dynamic_variables)).not.toContain("medication_specialist");
      expect(JSON.stringify(direct.body.session_data)).not.toContain("tool_proposed");
    },
  );

  it.each(task17CrossDomainFixtures)(
    "does not let Task 17 steal cross-domain request: $utterance",
    async (caseFixture) => {
      const fixture: RouterFixture = {
        user_id: "user-medication-cross-domain-review",
        session_id: "session-medication-cross-domain-review",
        utterance: caseFixture.utterance,
        conversation_history: [{ role: "assistant", content: "How can I help?" }],
      };
      process.env.VYVA_MEDICATION_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_MEDICATION_SPECIALIST_ALLOW_USERS = fixture.user_id;
      process.env.VYVA_BRAIN_COACH_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_BRAIN_COACH_SPECIALIST_ALLOW_USERS = fixture.user_id;
      process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS = fixture.user_id;

      const direct = await execute(directApp(), fixture);

      expect(direct.body.agent_id).toBe(caseFixture.expectedAgent);
      expect(direct.body.session_data.domain).toBe(caseFixture.expectedDomain);
      expect(direct.body.session_data.medication_specialist).toBeUndefined();
    },
  );

  it("preserves legacy Concierge routing when the Concierge Specialist flag is off", async () => {
    const fixture: RouterFixture = {
      user_id: "user-concierge-flag-off-review",
      session_id: "session-concierge-flag-off-review",
      utterance: "Open Concierge.",
      conversation_history: [{ role: "assistant", content: "How can I help?" }],
    };

    const direct = await execute(directApp(), fixture);

    expect(direct.body.agent_id).toBe("agent-concierge-review");
    expect(direct.body.session_data.domain).toBe("concierge");
    expect(direct.body.session_data.concierge_specialist).toBeUndefined();
    expect(JSON.stringify(direct.body.dynamic_variables)).not.toContain("concierge_specialist");
  });

  it.each(task18TrustedHelpFlagOffCases)(
    "preserves legacy Trusted Help routing when the Concierge Specialist flag is off: %s",
    async (utterance) => {
      const fixture: RouterFixture = {
        user_id: "user-concierge-trusted-help-flag-off-review",
        session_id: "session-concierge-trusted-help-flag-off-review",
        utterance,
        conversation_history: [{ role: "assistant", content: "How can I help?" }],
      };

      const direct = await execute(directApp(), fixture);

      expect(direct.body.agent_id).toBe("agent-concierge-review");
      expect(direct.body.session_data.domain).toBe("concierge");
      expect(direct.body.session_data.concierge_specialist).toBeUndefined();
      expect(JSON.stringify(direct.body.dynamic_variables)).not.toContain("concierge_specialist");
    },
  );

  it("adds Concierge Specialist metadata only for flag-enabled supported Concierge request-intake", async () => {
    const fixture: RouterFixture = {
      user_id: "user-concierge-specialist-review",
      session_id: "session-concierge-specialist-review",
      utterance: "Open Concierge.",
      conversation_history: [{ role: "assistant", content: "How can I help?" }],
    };
    process.env.VYVA_CONCIERGE_SPECIALIST_MODE = "specialist_preview";
    process.env.VYVA_CONCIERGE_SPECIALIST_ALLOW_USERS = fixture.user_id;

    const direct = await execute(directApp(), fixture);

    expect(direct.body.agent_id).toBe("agent-concierge-review");
    expect(direct.body.session_data.domain).toBe("concierge");
    expect(direct.body.session_data.concierge_specialist).toMatchObject({
      selected_specialist_id: "concierge",
      selected_flow_id: "concierge.administrative_support",
      outcome: "tool_proposed",
      action_type: "concierge.task",
      route: "/concierge",
      tool_proposal_decision: "proposal_allowed",
      external_action: "false",
    });
    expect(direct.body.system_prompt_override).toContain("CONCIERGE SPECIALIST MIGRATION BLOCK");
    expect(direct.body.system_prompt_override).toContain("Do not book, reserve, cancel, order");
  });

  it.each(task18RealRouterNavigationCases)(
    "adds Concierge Specialist metadata for valid routed Concierge navigation/context: $utterance",
    async (caseFixture) => {
      const fixture: RouterFixture = {
        user_id: "user-concierge-valid-navigation-review",
        session_id: "session-concierge-valid-navigation-review",
        utterance: caseFixture.utterance,
        conversation_history: [{ role: "assistant", content: "How can I help?" }],
      };
      process.env.VYVA_CONCIERGE_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_CONCIERGE_SPECIALIST_ALLOW_USERS = fixture.user_id;

      const direct = await execute(directApp(), fixture);

      expect(direct.body.agent_id).toBe("agent-concierge-review");
      expect(direct.body.session_data.domain).toBe("concierge");
      expect(direct.body.session_data.concierge_specialist).toMatchObject({
        selected_specialist_id: "concierge",
        selected_flow_id: "concierge.administrative_support",
        outcome: "tool_proposed",
        tool_proposal_decision: "proposal_allowed",
        action_type: caseFixture.expectedActionType,
        route: caseFixture.expectedRoute,
        capability: caseFixture.expectedCapability,
        request_category: caseFixture.expectedRequestCategory,
        presentation_id: caseFixture.expectedPresentationId,
        external_action: "false",
      });
    },
  );

  it.each(task18TrustedHelpContactRejectionCases)(
    "does not migrate Trusted Help contact/disclosure wording through Concierge Specialist: %s",
    async (utterance) => {
      const fixture: RouterFixture = {
        user_id: "user-concierge-trusted-help-contact-review",
        session_id: "session-concierge-trusted-help-contact-review",
        utterance,
        conversation_history: [{ role: "assistant", content: "How can I help?" }],
      };
      process.env.VYVA_CONCIERGE_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_CONCIERGE_SPECIALIST_ALLOW_USERS = fixture.user_id;

      const direct = await execute(directApp(), fixture);

      expect(direct.body.session_data.concierge_specialist).toBeUndefined();
      expect(JSON.stringify(direct.body.dynamic_variables)).not.toContain("concierge_specialist");
      expect(JSON.stringify(direct.body.session_data)).not.toContain("concierge_trusted_help_context");
    },
  );

  it.each(task18ShoppingExecutionRejectionCases)(
    "does not migrate shopping execution wording through Concierge Specialist: %s",
    async (utterance) => {
      const fixture: RouterFixture = {
        user_id: "user-concierge-shopping-execution-review",
        session_id: "session-concierge-shopping-execution-review",
        utterance,
        conversation_history: [{ role: "assistant", content: "How can I help?" }],
      };
      process.env.VYVA_CONCIERGE_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_CONCIERGE_SPECIALIST_ALLOW_USERS = fixture.user_id;

      const direct = await execute(directApp(), fixture);

      expect(direct.body.session_data.concierge_specialist).toBeUndefined();
      expect(JSON.stringify(direct.body.dynamic_variables)).not.toContain("concierge_specialist");
      expect(JSON.stringify(direct.body.session_data)).not.toContain("concierge_shopping_context");
    },
  );

  it.each(task18ExternalExecutionFixtures)(
    "keeps Concierge real-world execution on exact legacy route when flag is enabled: $utterance",
    async (caseFixture) => {
      const fixture: RouterFixture = {
        user_id: "user-concierge-execution-review",
        session_id: "session-concierge-execution-review",
        utterance: caseFixture.utterance,
        conversation_history: [{ role: "assistant", content: "How can I help?" }],
      };
      process.env.VYVA_CONCIERGE_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_CONCIERGE_SPECIALIST_ALLOW_USERS = fixture.user_id;

      const direct = await execute(directApp(), fixture);

      expect(direct.body.session_data.concierge_specialist).toBeUndefined();
      expect(JSON.stringify(direct.body.dynamic_variables)).not.toContain("concierge_specialist");
      expect(JSON.stringify(direct.body.session_data)).not.toContain("tool_proposed");
    },
  );

  it.each(task18SafetyPrecedenceFixtures)(
    "routes safety-sensitive Concierge language through Safety before Concierge Specialist: %s",
    async (utterance) => {
      const fixture: RouterFixture = {
        user_id: "user-concierge-safety-review",
        session_id: "session-concierge-safety-review",
        utterance,
        conversation_history: [{ role: "assistant", content: "How can I help?" }],
      };
      process.env.VYVA_CONCIERGE_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_CONCIERGE_SPECIALIST_ALLOW_USERS = fixture.user_id;

      const direct = await execute(directApp(), fixture);

      expect(direct.body.agent_id).toBe("agent-safety-review");
      expect(direct.body.session_data.domain).toBe("safety");
      expect(direct.body.session_data.concierge_specialist).toBeUndefined();
      expect(JSON.stringify(direct.body.dynamic_variables)).not.toContain("concierge_specialist");
    },
  );

  it("does not attach ordinary Concierge Specialist metadata for the ER abbreviation caveat", async () => {
    const fixture: RouterFixture = {
      user_id: "user-concierge-er-caveat-review",
      session_id: "session-concierge-er-caveat-review",
      utterance: "I need a ride to the ER.",
      conversation_history: [{ role: "assistant", content: "How can I help?" }],
    };
    process.env.VYVA_CONCIERGE_SPECIALIST_MODE = "specialist_preview";
    process.env.VYVA_CONCIERGE_SPECIALIST_ALLOW_USERS = fixture.user_id;

    const direct = await execute(directApp(), fixture);

    expect(direct.body.session_data.concierge_specialist).toBeUndefined();
    expect(JSON.stringify(direct.body.dynamic_variables)).not.toContain("concierge_specialist");
  });

  it.each(task18CrossDomainFixtures)(
    "does not let Task 18 steal cross-domain request: $utterance",
    async (caseFixture) => {
      const fixture: RouterFixture = {
        user_id: "user-concierge-cross-domain-review",
        session_id: "session-concierge-cross-domain-review",
        utterance: caseFixture.utterance,
        conversation_history: [{ role: "assistant", content: "How can I help?" }],
      };
      process.env.VYVA_CONCIERGE_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_CONCIERGE_SPECIALIST_ALLOW_USERS = fixture.user_id;
      process.env.VYVA_MEDICATION_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_MEDICATION_SPECIALIST_ALLOW_USERS = fixture.user_id;
      process.env.VYVA_BRAIN_COACH_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_BRAIN_COACH_SPECIALIST_ALLOW_USERS = fixture.user_id;
      process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS = fixture.user_id;

      const direct = await execute(directApp(), fixture);

      expect(direct.body.agent_id).toBe(caseFixture.expectedAgent);
      expect(direct.body.session_data.domain).toBe(caseFixture.expectedDomain);
      expect(direct.body.session_data.concierge_specialist).toBeUndefined();
    },
  );

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

  it("preserves legacy Social/companion routing when the Social Support Specialist flag is off", async () => {
    const fixture: RouterFixture = {
      user_id: "user-social-support-flag-off-review",
      session_id: "session-social-support-flag-off-review",
      utterance: "Open social rooms.",
      conversation_history: [{ role: "assistant", content: "How can I help?" }],
    };

    const direct = await execute(directApp(), fixture);

    expect(direct.body.agent_id).toBe("agent-companion-review");
    expect(direct.body.session_data.domain).toBe("companion");
    expect(direct.body.session_data.social_support_specialist).toBeUndefined();
    expect(JSON.stringify(direct.body.dynamic_variables)).not.toContain("social_support_specialist");
  });

  it.each(task19RealRouterNavigationCases)(
    "adds Social Support Specialist metadata for valid routed community navigation/context: $utterance",
    async (caseFixture) => {
      const fixture: RouterFixture = {
        user_id: "user-social-support-valid-navigation-review",
        session_id: "session-social-support-valid-navigation-review",
        utterance: caseFixture.utterance,
        conversation_history: [{ role: "assistant", content: "How can I help?" }],
      };
      process.env.VYVA_SOCIAL_SUPPORT_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_SOCIAL_SUPPORT_SPECIALIST_ALLOW_USERS = fixture.user_id;

      const direct = await execute(directApp(), fixture);

      expect(direct.body.agent_id).toBe("agent-companion-review");
      expect(direct.body.session_data.domain).toBe("companion");
      expect(direct.body.session_data.social_support_specialist).toMatchObject({
        selected_specialist_id: "social",
        selected_flow_id: "social.community_connection",
        outcome: "tool_proposed",
        tool_proposal_decision: "proposal_allowed",
        action_type: caseFixture.expectedActionType,
        route: caseFixture.expectedRoute,
        capability: caseFixture.expectedCapability,
        request_category: caseFixture.expectedRequestCategory,
        presentation_id: caseFixture.expectedPresentationId,
        external_action: "false",
        human_contact: "false",
        caregiver_authority: "false",
      });
      expect(direct.body.system_prompt_override).toContain("SOCIAL SUPPORT SPECIALIST MIGRATION BLOCK");
      expect(direct.body.system_prompt_override).toContain("Do not contact, call, text");
    },
  );

  it.each(task19MentalWellbeingOverlapFixtures)(
    "does not let Task 19 steal Mental Wellbeing overlap: %s",
    async (utterance) => {
      const fixture: RouterFixture = {
        user_id: "user-social-support-mental-overlap-review",
        session_id: "session-social-support-mental-overlap-review",
        utterance,
        conversation_history: [{ role: "assistant", content: "How can I help?" }],
      };
      process.env.VYVA_SOCIAL_SUPPORT_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_SOCIAL_SUPPORT_SPECIALIST_ALLOW_USERS = fixture.user_id;
      process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS = fixture.user_id;

      const direct = await execute(directApp(), fixture);

      expect(direct.body.session_data.social_support_specialist).toBeUndefined();
      expect(JSON.stringify(direct.body.dynamic_variables)).not.toContain("social_support_specialist");
    },
  );

  it.each(task19ConciergeOverlapFixtures)(
    "does not let Task 19 steal Concierge or Trusted Help overlap: %s",
    async (utterance) => {
      const fixture: RouterFixture = {
        user_id: "user-social-support-concierge-overlap-review",
        session_id: "session-social-support-concierge-overlap-review",
        utterance,
        conversation_history: [{ role: "assistant", content: "How can I help?" }],
      };
      process.env.VYVA_SOCIAL_SUPPORT_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_SOCIAL_SUPPORT_SPECIALIST_ALLOW_USERS = fixture.user_id;
      process.env.VYVA_CONCIERGE_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_CONCIERGE_SPECIALIST_ALLOW_USERS = fixture.user_id;

      const direct = await execute(directApp(), fixture);

      expect(direct.body.session_data.social_support_specialist).toBeUndefined();
      expect(JSON.stringify(direct.body.dynamic_variables)).not.toContain("social_support_specialist");
    },
  );

  it.each(task19CaregiverBoundaryFixtures)(
    "does not let Task 19 create caregiver permission or contact authority: %s",
    async (utterance) => {
      const fixture: RouterFixture = {
        user_id: "user-social-support-caregiver-boundary-review",
        session_id: "session-social-support-caregiver-boundary-review",
        utterance,
        conversation_history: [{ role: "assistant", content: "How can I help?" }],
      };
      process.env.VYVA_SOCIAL_SUPPORT_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_SOCIAL_SUPPORT_SPECIALIST_ALLOW_USERS = fixture.user_id;

      const direct = await execute(directApp(), fixture);

      expect(direct.body.session_data.social_support_specialist).toBeUndefined();
      expect(JSON.stringify(direct.body.dynamic_variables)).not.toContain("social_support_specialist");
      expect(JSON.stringify(direct.body.session_data)).not.toContain("caregiver_authority");
    },
  );

  it.each(task19SafetyPrecedenceFixtures)(
    "does not attach Social Support metadata to safety-sensitive support language: %s",
    async (utterance) => {
      const fixture: RouterFixture = {
        user_id: "user-social-support-safety-review",
        session_id: "session-social-support-safety-review",
        utterance,
        conversation_history: [{ role: "assistant", content: "How can I help?" }],
      };
      process.env.VYVA_SOCIAL_SUPPORT_SPECIALIST_MODE = "specialist_preview";
      process.env.VYVA_SOCIAL_SUPPORT_SPECIALIST_ALLOW_USERS = fixture.user_id;

      const direct = await execute(directApp(), fixture);

      expect(direct.body.session_data.social_support_specialist).toBeUndefined();
      expect(JSON.stringify(direct.body.dynamic_variables)).not.toContain("social_support_specialist");
      if ([
        "I'm in danger, call my caregiver.",
        "I can't breathe, call my daughter.",
        "I want to die, tell my family.",
        "I overdosed, call my caregiver.",
      ].includes(utterance)) {
        expect(direct.body.agent_id).toBe("agent-safety-review");
        expect(direct.body.session_data.domain).toBe("safety");
      }
    },
  );

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
