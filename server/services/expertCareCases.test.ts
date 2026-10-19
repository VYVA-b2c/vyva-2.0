import { beforeEach, describe, expect, it, vi } from "vitest";
import { attachExpertCareContactPreparation, attachExpertCareEvidence, attachExpertCareSpecialists, createExpertCareState, updateExpertCareVerification } from "../../shared/expertCareState.js";

const db = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../db.js", () => ({ pool: db }));

import {
  ExpertCareCaseConflictError,
  importLegacyCareFinderCase,
  listExpertCareVerificationQueue,
  listExpertCareCoordinationQueue,
  updateExpertCareCase,
} from "./expertCareCases.js";

const caseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const legacyId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const evidence = { items: [], retrievedAt: "2026-10-19T10:00:00.000Z", educationalOnly: true as const, unavailableSources: [] };

function row(state: ReturnType<typeof createExpertCareState>) {
  return {
    id: caseId,
    user_id: "user-1",
    kind: "expert_care",
    entry_payload: { kind: "expert_care" },
    progress_payload: { expertCare: state },
    stage: "details",
    status: "active",
    language: "en",
    created_at: state.createdAt,
    updated_at: state.updatedAt,
  };
}

describe("Expert Care case persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses optimistic revisions and persists dependency invalidation", async () => {
    const current = attachExpertCareEvidence(createExpertCareState("en"), evidence);
    const saved = { ...current, revision: current.revision + 1, evidence: null, context: { ...current.context, specialty: "neurology" } };
    db.query.mockResolvedValueOnce({ rows: [row(current)] }).mockResolvedValueOnce({ rows: [row(saved)] });

    const result = await updateExpertCareCase({ id: caseId, userId: "user-1", expectedRevision: current.revision, patch: { specialty: "neurology" } });

    expect(result.state.evidence).toBeNull();
    expect(db.query.mock.calls[1][1]).toEqual([caseId, "user-1", current.revision, expect.any(String), "details"]);
  });

  it("returns the authoritative record on a stale client revision", async () => {
    const current = { ...createExpertCareState("en"), revision: 4 };
    db.query.mockResolvedValueOnce({ rows: [row(current)] });
    await expect(updateExpertCareCase({ id: caseId, userId: "user-1", expectedRevision: 3, patch: { goal: "second_opinion" } }))
      .rejects.toBeInstanceOf(ExpertCareCaseConflictError);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it("migrates only readable care_finder_v1 fields and forces a new safety check", async () => {
    const legacyRow = {
      id: legacyId,
      user_id: "user-1",
      kind: "provider_contact",
      entry_payload: { kind: "provider_contact" },
      progress_payload: {
        answers: { version: "care_finder_v1", who: "other", location: "Madrid, Spain", safetyAnswered: "yes" },
        textDrafts: { description: "Review a neurology recommendation" },
        providerResult: { options: [{ name: "Do not migrate me" }] },
      },
      stage: "review",
      status: "active",
      language: "en",
      created_at: "2026-10-18T10:00:00.000Z",
      updated_at: "2026-10-18T10:00:00.000Z",
    };
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [legacyRow] })
      .mockImplementationOnce(async (_sql: string, values: unknown[]) => {
        const state = JSON.parse(String(values[2])).expertCare;
        return { rows: [row(state)] };
      });

    const result = await importLegacyCareFinderCase(legacyId, "user-1", "en");

    expect(result.state).toMatchObject({
      legacySourceTaskId: legacyId,
      stage: "specialty",
      context: {
        goal: "find_specialist",
        person: "trusted_helper",
        diagnosisOrRecommendation: "Review a neurology recommendation",
        location: "Madrid, Spain",
        emergencyResult: "not_checked",
      },
    });
    expect(JSON.stringify(result.state)).not.toContain("Do not migrate me");
  });

  it("returns only requested specialist verification work with member context", async () => {
    let state = attachExpertCareSpecialists(createExpertCareState("es"), { candidates: [{ id: "candidate-1", name: "Dra. Ejemplo", verificationStatus: "unverified", verificationDetails: [] }] as never, contactBlockedUntilVerified: true, retrievedAt: "2026-10-19T10:00:00.000Z" });
    state.context.specialty = "oncology";
    state.context.location = "Madrid";
    state = updateExpertCareVerification(state, "candidate-1", "verification_pending", ["Requested"]);
    db.query.mockResolvedValueOnce({ rows: [row(state)] });
    const queue = await listExpertCareVerificationQueue(25);
    expect(queue).toEqual([expect.objectContaining({ caseId, ownerUserId: "user-1", requestedAt: expect.any(String), caseContext: { specialty: "oncology", location: "Madrid", languages: ["es"] }, candidate: expect.objectContaining({ id: "candidate-1" }) })]);
    expect(db.query.mock.calls[0][0]).toContain("jsonb_path_exists");
    expect(db.query.mock.calls[0][1]).toEqual([25]);
  });

  it("returns prepared consultations that are still awaiting a specialist response", async () => {
    let state = attachExpertCareSpecialists(createExpertCareState("en"), { candidates: [{ id: "candidate-1", name: "Dr Example", verificationStatus: "verified", verificationDetails: [] }] as never, contactBlockedUntilVerified: true, retrievedAt: "2026-10-19T10:00:00.000Z" });
    state = attachExpertCareContactPreparation(state, { pendingActionId: "pending-1", candidateId: "candidate-1", recipient: "clinic@example.test", documentIds: [], healthFields: ["diagnosis_or_recommendation"], channel: "email", message: "Please review the consultation request.", confirmedAt: "2026-10-19T10:00:00.000Z" });
    db.query.mockResolvedValueOnce({ rows: [row(state)] });
    const queue = await listExpertCareCoordinationQueue(10);
    expect(queue).toEqual([expect.objectContaining({ caseId, ownerUserId: "user-1", candidate: expect.objectContaining({ id: "candidate-1" }), preparation: expect.objectContaining({ pendingActionId: "pending-1" }) })]);
    expect(db.query.mock.calls[0][0]).toContain("specialistResponse");
  });
});
