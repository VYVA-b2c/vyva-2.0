import { describe, expect, it } from "vitest";
import {
  FLOW_LIFECYCLE_STATES,
  FLOW_TRANSITIONS,
  ANSWER_KIND_MODALITY_COMPATIBILITY,
  canTransition,
  flowStateSchema,
  flowTransitionSchema,
  isAnswerModalityCompatible,
  normalizeAnswer,
  parseFlowState,
  parseFlowTransition,
  expectedFlowInputSchema,
} from "./flowState";
import type { AnswerSubmission, ExpectedFlowInput } from "./flowState";
import { OrchestrationContractError } from "./errors";
import {
  equivalentAnswerSubmissions,
  documentAnswerExpectedInput,
  headacheOnsetExpectedInput,
  imageAnswerExpectedInput,
  structuredToolExpectedInput,
  toolResultSubmission,
  validFlowTransitionFixture,
  waitingForUserFlowFixture,
} from "./fixtures";

describe("flow lifecycle contract", () => {
  it("accepts every declared valid transition", () => {
    for (const from of FLOW_LIFECYCLE_STATES) {
      for (const to of FLOW_TRANSITIONS[from]) {
        expect(canTransition(from, to)).toBe(true);
        expect(flowTransitionSchema.safeParse({
          ...validFlowTransitionFixture,
          from,
          to,
        }).success).toBe(true);
      }
    }
  });

  it("rejects undeclared transitions", () => {
    expect(canTransition("idle", "completed")).toBe(false);
    expect(flowTransitionSchema.safeParse({
      ...validFlowTransitionFixture,
      from: "idle",
      to: "completed",
    }).success).toBe(false);
    expect(flowTransitionSchema.safeParse({
      ...validFlowTransitionFixture,
      from: "waiting_for_user",
      to: "waiting_for_tool",
    }).success).toBe(false);
  });

  it("rejects illegal resume and completion transitions", () => {
    expect(flowTransitionSchema.safeParse({
      ...validFlowTransitionFixture,
      from: "idle",
      to: "resuming",
    }).success).toBe(false);
    expect(flowTransitionSchema.safeParse({
      ...validFlowTransitionFixture,
      from: "waiting_for_user",
      to: "completed",
    }).success).toBe(false);
  });

  it("returns a typed transition error", () => {
    expect.assertions(2);
    try {
      parseFlowTransition({ ...validFlowTransitionFixture, from: "completed", to: "idle" });
    } catch (error) {
      expect(error).toBeInstanceOf(OrchestrationContractError);
      expect((error as OrchestrationContractError).code).toBe("INVALID_STATE_TRANSITION");
    }
  });

  it("requires an expected input while waiting for the user", () => {
    expect(flowStateSchema.safeParse(waitingForUserFlowFixture).success).toBe(true);
    const { expectedInput: _missing, ...withoutExpectedInput } = waitingForUserFlowFixture;
    expect(flowStateSchema.safeParse(withoutExpectedInput).success).toBe(false);
  });

  it("enforces waiting, interrupted, idle, and terminal invariants with typed errors", () => {
    const cases = [
      [{ ...waitingForUserFlowFixture, expectedInput: undefined }, "MISSING_EXPECTED_INPUT"],
      [{
        ...waitingForUserFlowFixture,
        state: "waiting_for_tool",
        expectedInput: undefined,
      }, "MISSING_PENDING_TOOL"],
      [{
        ...waitingForUserFlowFixture,
        state: "interrupted",
        expectedInput: undefined,
      }, "MISSING_INTERRUPTED_STATE"],
      [{
        ...waitingForUserFlowFixture,
        state: "completed",
      }, "TERMINAL_STATE_HAS_EXPECTED_INPUT"],
      [{
        ...waitingForUserFlowFixture,
        state: "idle",
        expectedInput: undefined,
      }, "IDLE_STATE_HAS_ACTIVE_FLOW_DATA"],
    ] as const;

    for (const [value, code] of cases) {
      try {
        parseFlowState(value);
        throw new Error("Expected contract failure");
      } catch (error) {
        expect(error).toBeInstanceOf(OrchestrationContractError);
        expect((error as OrchestrationContractError).code).toBe(code);
      }
    }
  });
});

describe("normalized answers", () => {
  it("accepts one strict expected-input fixture for every answer kind", () => {
    const base = { questionId: "q", sceneId: "s", flowVersion: "1" };
    const fixtures = [
      { ...base, answerKind: "option", options: [{ id: "yes", label: "Yes", voiceAliases: [] }] },
      { ...base, answerKind: "free_text", maxLength: 500 },
      { ...base, answerKind: "structured", allowedModalities: ["touch", "text"] },
      {
        ...base,
        answerKind: "measurement",
        allowedModalities: ["measurement"],
        measurement: { valueType: "number", unit: "unit", min: 0, max: 10, precision: 1 },
      },
      { ...base, answerKind: "tool_result", expectedToolId: "tool-1" },
      { ...base, answerKind: "image", acceptedContentTypes: ["image/jpeg"] },
      { ...base, answerKind: "document", acceptedContentTypes: ["application/pdf"] },
    ];
    for (const fixture of fixtures) {
      expect(expectedFlowInputSchema.safeParse(fixture).success).toBe(true);
    }
  });

  it("rejects cross-variant fields and missing required variant fields", () => {
    const base = { questionId: "q", sceneId: "s", flowVersion: "1" };
    expect(expectedFlowInputSchema.safeParse({
      ...base, answerKind: "free_text", options: [],
    }).success).toBe(false);
    expect(expectedFlowInputSchema.safeParse({
      ...base, answerKind: "image", acceptedContentTypes: ["image/jpeg"], options: [],
    }).success).toBe(false);
    expect(expectedFlowInputSchema.safeParse({
      ...base, answerKind: "measurement", allowedModalities: ["measurement"],
    }).success).toBe(false);
    expect(expectedFlowInputSchema.safeParse({
      ...base, answerKind: "tool_result",
    }).success).toBe(false);
  });
  it("normalizes spoken, tapped, and typed answers to identical flow input", () => {
    const spoken = normalizeAnswer(headacheOnsetExpectedInput, equivalentAnswerSubmissions.spoken);
    const tapped = normalizeAnswer(headacheOnsetExpectedInput, equivalentAnswerSubmissions.tapped);
    const typed = normalizeAnswer(headacheOnsetExpectedInput, equivalentAnswerSubmissions.typed);

    expect(spoken).toEqual({
      questionId: "headache_onset",
      answerId: "yesterday",
      answerKind: "option",
      value: "yesterday",
    });
    expect(tapped).toEqual(spoken);
    expect(typed).toEqual(spoken);
  });

  it("rejects stale question, scene, and flow-version submissions", () => {
    expect(() => normalizeAnswer(headacheOnsetExpectedInput, {
      ...equivalentAnswerSubmissions.tapped,
      questionId: "previous_question",
    })).toThrow(OrchestrationContractError);
    expect(() => normalizeAnswer(headacheOnsetExpectedInput, {
      ...equivalentAnswerSubmissions.tapped,
      sceneId: "previous-scene",
    })).toThrow(OrchestrationContractError);
    expect(() => normalizeAnswer(headacheOnsetExpectedInput, {
      ...equivalentAnswerSubmissions.tapped,
      flowVersion: "0",
    })).toThrow(OrchestrationContractError);
  });

  it("rejects option IDs or text that are not currently allowed", () => {
    expect(() => normalizeAnswer(headacheOnsetExpectedInput, {
      ...equivalentAnswerSubmissions.tapped,
      answerId: "last_week",
    })).toThrow(OrchestrationContractError);
    expect(() => normalizeAnswer(headacheOnsetExpectedInput, {
      ...equivalentAnswerSubmissions.typed,
      text: "last week",
    })).toThrow(OrchestrationContractError);
  });

  it("normalizes a tool result into the shared structured answer representation", () => {
    expect(normalizeAnswer(structuredToolExpectedInput, toolResultSubmission)).toEqual({
      questionId: "latest_reading",
      answerKind: "tool_result",
      value: { systolic: 118, diastolic: 74, unit: "mmHg" },
    });
  });

  it("normalizes allowed touch, text, and measurement values into the shared contract shape", () => {
    const structuredExpected: ExpectedFlowInput = {
      questionId: "daily_measurement",
      sceneId: "latest-reading-scene",
      flowVersion: "1",
      answerKind: "structured" as const,
      allowedModalities: ["touch", "text", "measurement"],
    };
    const context = {
      questionId: "daily_measurement",
      sceneId: "latest-reading-scene",
      flowVersion: "1",
    };

    expect(normalizeAnswer(structuredExpected, {
      modality: "touch",
      ...context,
      value: { systolic: 118, diastolic: 74 },
    })).toEqual({
      questionId: "daily_measurement",
      answerKind: "structured",
      value: { systolic: 118, diastolic: 74 },
    });

    expect(normalizeAnswer(structuredExpected, {
      modality: "text",
      ...context,
      text: "118 over 74",
    })).toEqual({
      questionId: "daily_measurement",
      answerKind: "structured",
      value: "118 over 74",
    });

    expect(normalizeAnswer(structuredExpected, {
      modality: "measurement",
      ...context,
      value: { systolic: 118, diastolic: 74 },
    })).toEqual({
      questionId: "daily_measurement",
      answerKind: "structured",
      value: { systolic: 118, diastolic: 74 },
    });
  });

  it("enforces generic measurement type, range, and precision descriptors", () => {
    const expected: ExpectedFlowInput = {
      questionId: "measurement",
      sceneId: "measurement-scene",
      flowVersion: "1",
      answerKind: "measurement",
      allowedModalities: ["text", "measurement"],
      measurement: { valueType: "number", min: 0, max: 10, precision: 1 },
    };
    expect(normalizeAnswer(expected, {
      modality: "text",
      questionId: "measurement",
      sceneId: "measurement-scene",
      flowVersion: "1",
      text: "7.5",
    }).value).toBe(7.5);
    for (const value of [-1, 11, 7.55, "not-a-number"]) {
      expect(() => normalizeAnswer(expected, {
        modality: "measurement",
        questionId: "measurement",
        sceneId: "measurement-scene",
        flowVersion: "1",
        value,
      })).toThrow(OrchestrationContractError);
    }
  });

  it("enforces the answer-kind and modality compatibility matrix", () => {
    expect(ANSWER_KIND_MODALITY_COMPATIBILITY).toEqual({
      option: ["voice", "touch", "text"],
      free_text: ["voice", "text"],
      structured: ["touch", "text", "measurement", "tool"],
      measurement: ["touch", "text", "measurement", "tool"],
      image: ["image"],
      document: ["document"],
      tool_result: ["tool"],
    });

    expect(isAnswerModalityCompatible(headacheOnsetExpectedInput, "voice")).toBe(true);
    expect(isAnswerModalityCompatible(imageAnswerExpectedInput, "voice")).toBe(false);
    expect(isAnswerModalityCompatible(documentAnswerExpectedInput, "text")).toBe(false);
    expect(isAnswerModalityCompatible(structuredToolExpectedInput, "tool")).toBe(true);
  });

  it("exhaustively evaluates every expected-input kind against every modality", () => {
    const base = { questionId: "q", sceneId: "s", flowVersion: "1" };
    const cases: Array<[ExpectedFlowInput, string[]]> = [
      [{
        ...base,
        answerKind: "option",
        options: [{ id: "yes", label: "Yes", voiceAliases: [] }],
      }, ["voice", "touch", "text"]],
      [{ ...base, answerKind: "free_text" }, ["voice", "text"]],
      [{
        ...base,
        answerKind: "structured",
        allowedModalities: ["touch", "text", "measurement", "tool"],
      }, ["touch", "text", "measurement", "tool"]],
      [{
        ...base,
        answerKind: "measurement",
        allowedModalities: ["touch", "measurement"],
        measurement: { valueType: "number" },
      }, ["touch", "measurement"]],
      [{ ...base, answerKind: "tool_result", expectedToolId: "tool-1" }, ["tool"]],
      [{ ...base, answerKind: "image", acceptedContentTypes: ["image/jpeg"] }, ["image"]],
      [{ ...base, answerKind: "document", acceptedContentTypes: ["application/pdf"] }, ["document"]],
    ];
    const modalities = ["voice", "touch", "text", "measurement", "tool", "image", "document"] as const;
    for (const [expected, allowed] of cases) {
      for (const modality of modalities) {
        expect(isAnswerModalityCompatible(expected, modality)).toBe(allowed.includes(modality));
      }
    }
  });

  it("rejects semantically incompatible answer modalities", () => {
    expect(() => normalizeAnswer(imageAnswerExpectedInput, {
      modality: "voice",
      questionId: "wound_image",
      sceneId: "wound-image-scene",
      flowVersion: "1",
      transcript: "spoken transcript",
    })).toThrow(OrchestrationContractError);

    expect(() => normalizeAnswer(documentAnswerExpectedInput, {
      modality: "text",
      questionId: "care_document",
      sceneId: "care-document-scene",
      flowVersion: "1",
      text: "not a document",
    })).toThrow(OrchestrationContractError);

    expect(() => normalizeAnswer(structuredToolExpectedInput, {
      modality: "measurement",
      questionId: "latest_reading",
      sceneId: "latest-reading-scene",
      flowVersion: "1",
      value: { systolic: 118 },
    })).toThrow(OrchestrationContractError);

    expect(() => normalizeAnswer(headacheOnsetExpectedInput, {
      modality: "tool",
      questionId: "headache_onset",
      sceneId: "headache-onset-scene",
      flowVersion: "1",
      value: "yesterday",
      answerId: "yesterday",
    } as unknown as AnswerSubmission)).toThrow(OrchestrationContractError);
  });

  it("allows tool input for structured answers only when explicitly enabled", () => {
    const structuredExpected: ExpectedFlowInput = {
      questionId: "latest_reading",
      sceneId: "latest-reading-scene",
      flowVersion: "1",
      answerKind: "structured",
      allowedModalities: ["touch", "text", "measurement"],
    };
    const submission = {
      modality: "tool" as const,
      questionId: "latest_reading",
      sceneId: "latest-reading-scene",
      flowVersion: "1",
      toolId: "latest_reading_tool",
      value: { systolic: 118, diastolic: 74 },
    };

    expect(() => normalizeAnswer(structuredExpected, submission))
      .toThrow();

    expect(normalizeAnswer(
      { ...structuredExpected, allowedModalities: ["touch", "text", "measurement", "tool"] },
      submission,
    )).toEqual({
      questionId: "latest_reading",
      answerKind: "structured",
      value: { systolic: 118, diastolic: 74 },
    });
  });

  it("supports future image and document answer references", () => {
    expect(normalizeAnswer(imageAnswerExpectedInput, {
      modality: "image",
      questionId: "wound_image",
      sceneId: "wound-image-scene",
      flowVersion: "1",
      image: {
        assetId: "asset-image-1",
        contentType: "image/jpeg",
        fileName: "wound.jpg",
      },
    })).toEqual({
      questionId: "wound_image",
      answerKind: "image",
      value: {
        assetId: "asset-image-1",
        contentType: "image/jpeg",
        fileName: "wound.jpg",
      },
    });

    expect(normalizeAnswer(documentAnswerExpectedInput, {
      modality: "document",
      questionId: "care_document",
      sceneId: "care-document-scene",
      flowVersion: "1",
      document: {
        assetId: "asset-document-1",
        contentType: "application/pdf",
      },
    })).toEqual({
      questionId: "care_document",
      answerKind: "document",
      value: {
        assetId: "asset-document-1",
        contentType: "application/pdf",
      },
    });
  });

  it("rejects malformed structured and asset answers", () => {
    expect(() => normalizeAnswer(structuredToolExpectedInput, {
      modality: "tool",
      questionId: "latest_reading",
      sceneId: "latest-reading-scene",
      flowVersion: "1",
      toolId: "latest_reading_tool",
    } as AnswerSubmission)).toThrow();

    expect(() => normalizeAnswer(imageAnswerExpectedInput, {
      modality: "image",
      questionId: "wound_image",
      sceneId: "wound-image-scene",
      flowVersion: "1",
      image: {
        assetId: "",
        contentType: "image/jpeg",
      },
    })).toThrow();
  });

  it("requires option answer IDs and rejects answer IDs on non-option submissions", () => {
    try {
      normalizeAnswer(headacheOnsetExpectedInput, {
        modality: "touch",
        questionId: "headache_onset",
        sceneId: "headache-onset-scene",
        flowVersion: "1",
        value: "yesterday",
      });
      throw new Error("Expected contract failure");
    } catch (error) {
      expect((error as OrchestrationContractError).code).toBe("ANSWER_ID_REQUIRED");
    }

    try {
      normalizeAnswer(structuredToolExpectedInput, {
        ...toolResultSubmission,
        answerId: "not-allowed",
      } as unknown as AnswerSubmission);
      throw new Error("Expected contract failure");
    } catch (error) {
      expect((error as OrchestrationContractError).code).toBe("ANSWER_ID_NOT_ALLOWED");
    }
  });

  it("rejects wrong MIME families, paths, oversized metadata, and malformed checksums", () => {
    const base = {
      modality: "image" as const,
      questionId: "wound_image",
      sceneId: "wound-image-scene",
      flowVersion: "1",
    };
    const invalidAssets = [
      { assetId: "asset-1", contentType: "application/pdf" },
      { assetId: "asset-1", contentType: "image/jpeg", fileName: "C:\\secret\\x.jpg" },
      {
        assetId: "asset-1",
        contentType: "image/jpeg",
        metadata: Object.fromEntries(Array.from({ length: 21 }, (_, index) => [`k${index}`, "v"])),
      },
      { assetId: "asset-1", contentType: "image/jpeg", checksum: "bad" },
    ];
    for (const image of invalidAssets) {
      expect(() => normalizeAnswer(imageAnswerExpectedInput, { ...base, image })).toThrow();
    }
    expect(() => normalizeAnswer(documentAnswerExpectedInput, {
      modality: "document",
      questionId: "care_document",
      sceneId: "care-document-scene",
      flowVersion: "1",
      document: { assetId: "document-1", contentType: "image/jpeg" },
    })).toThrow(OrchestrationContractError);
  });

  it("returns typed stale, option, answer-ID, modality, and MIME errors", () => {
    const checks: Array<[() => unknown, string]> = [
      [() => normalizeAnswer(headacheOnsetExpectedInput, {
        ...equivalentAnswerSubmissions.tapped, questionId: "old",
      }), "STALE_QUESTION"],
      [() => normalizeAnswer(headacheOnsetExpectedInput, {
        ...equivalentAnswerSubmissions.tapped, sceneId: "old",
      }), "STALE_SCENE"],
      [() => normalizeAnswer(headacheOnsetExpectedInput, {
        ...equivalentAnswerSubmissions.tapped, flowVersion: "0",
      }), "STALE_FLOW_VERSION"],
      [() => normalizeAnswer(headacheOnsetExpectedInput, {
        ...equivalentAnswerSubmissions.tapped, answerId: "bad",
      }), "OPTION_NOT_ALLOWED"],
      [() => normalizeAnswer(imageAnswerExpectedInput, {
        modality: "voice", questionId: "wound_image", sceneId: "wound-image-scene",
        flowVersion: "1", transcript: "not an image",
      }), "INVALID_MODALITY"],
      [() => normalizeAnswer(imageAnswerExpectedInput, {
        modality: "image", questionId: "wound_image", sceneId: "wound-image-scene",
        flowVersion: "1", image: { assetId: "a", contentType: "application/pdf" },
      }), "INVALID_MIME_TYPE"],
    ];
    for (const [operation, code] of checks) {
      try {
        operation();
        throw new Error("Expected contract failure");
      } catch (error) {
        expect(error).toBeInstanceOf(OrchestrationContractError);
        expect((error as OrchestrationContractError).code).toBe(code);
      }
    }
  });
});
