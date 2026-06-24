import { describe, expect, it } from "vitest";
import {
  VOICE_AGENT_CONTRACTS,
  validateVoiceAgentContext,
  voiceAgentContractFor,
} from "./voiceAgentContracts";

describe("voice agent contracts", () => {
  it("selects the main VYVA contract from app-open plan ids", () => {
    const contract = voiceAgentContractFor({
      conversationPlanId: "main_vyva_returning_app_open",
    });

    expect(contract.id).toBe("main_vyva");
  });

  it("selects the main VYVA contract from the Home agent slug", () => {
    const contract = voiceAgentContractFor({
      agentSlug: "main-vyva",
    });

    expect(contract.id).toBe("main_vyva");
  });

  it("reports missing required keys", () => {
    const contract = voiceAgentContractFor({ domain: "health" });
    const validation = validateVoiceAgentContext(contract, {
      agent_operating_rules: "rules",
      conversation_plan_id: "health_assistant_session",
      conversation_plan_goal: "goal",
      first_name: "Margaret",
    });

    expect(validation.status).toBe("missing_required");
    expect(validation.presentRequiredKeys).toContain("first_name");
    expect(validation.missingRequiredKeys).toContain("latest_vitals_scan");
    expect(validation.coveragePct).toBeLessThan(100);
  });

  it("marks a contract ready when all required keys are populated", () => {
    const contract = VOICE_AGENT_CONTRACTS.find((item) => item.id === "main_vyva");
    expect(contract).toBeTruthy();

    const variables = Object.fromEntries(
      contract!.requiredContextKeys.map((key) => [key, key === "is_first_voice_session" ? true : `${key} value`]),
    );
    const validation = validateVoiceAgentContext(contract!, variables);

    expect(validation.status).toBe("ready");
    expect(validation.missingRequiredKeys).toEqual([]);
    expect(validation.coveragePct).toBe(100);
  });
});
