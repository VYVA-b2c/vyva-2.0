import { beforeEach, describe, expect, it, vi } from "vitest";

const buildVoiceContext = vi.fn();
const resolveHealthMemoryPolicyFlag = vi.fn();

vi.mock("./voiceContext.js", () => ({ buildVoiceContext }));
vi.mock("../memory/healthMemoryPolicy.js", () => ({ resolveHealthMemoryPolicyFlag }));

const { getDoctorMedicalProfileVariables } = await import("./doctorMedicalProfile.js");

describe("doctor medical profile memory policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildVoiceContext.mockResolvedValue({
      health_context: "Structured VYVA health context",
      memory_block: "",
    });
  });

  it("does not perform a legacy Mem0 query when policy memory is disabled", async () => {
    resolveHealthMemoryPolicyFlag.mockReturnValue({ effectiveMode: "disabled" });

    await getDoctorMedicalProfileVariables("user-1", {
      flowInstanceId: "conversation-1",
      env: {},
    });

    expect(buildVoiceContext).toHaveBeenCalledWith("user-1", "health", "", {});
  });

  it("uses the policy-filtered memory path when the existing consent pilot allows it", async () => {
    resolveHealthMemoryPolicyFlag.mockReturnValue({ effectiveMode: "pilot" });

    await getDoctorMedicalProfileVariables("user-1", {
      flowInstanceId: "conversation-1",
      env: {},
    });

    expect(buildVoiceContext).toHaveBeenCalledWith(
      "user-1",
      "health",
      "doctor medical profile",
      {
        healthMemoryPolicy: {
          enabled: true,
          flowInstanceId: "conversation-1",
          env: {},
        },
      },
    );
  });
});
