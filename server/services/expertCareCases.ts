import { pool } from "../db.js";
import type { ExpertCareResearchResponse, ExpertCareSpecialistResponse, ExpertCareVerifiedProfile } from "../../shared/expertCare.js";
import {
  acknowledgeExpertCareResearchBoundary,
  applyExpertCarePatch,
  attachExpertCareContactPreparation,
  attachExpertCareEvidence,
  attachExpertCareDocumentId,
  attachExpertCareSpecialists,
  attachExpertCareSpecialistResponse,
  createExpertCareState,
  isExpertCareCaseState,
  removeExpertCareDocumentId,
  updateExpertCareVerification,
  type ExpertCareCasePatch,
  type ExpertCareCaseState,
} from "../../shared/expertCareState.js";

type TaskRow = {
  id: string;
  user_id: string;
  kind: string;
  entry_payload: Record<string, unknown>;
  progress_payload: Record<string, unknown>;
  stage: string;
  status: string;
  language: string;
  created_at: Date | string;
  updated_at: Date | string;
};

export type ExpertCareCaseRecord = {
  id: string;
  state: ExpertCareCaseState;
  status: "active";
  createdAt: string;
  updatedAt: string;
};

export type ExpertCareVerificationQueueItem = {
  caseId: string;
  ownerUserId: string;
  candidate: ExpertCareSpecialistResponse["candidates"][number];
  requestedAt: string;
  caseContext: Pick<ExpertCareCaseState["context"], "specialty" | "location" | "languages">;
};

export type ExpertCareCoordinationQueueItem = {
  caseId: string;
  ownerUserId: string;
  candidate: ExpertCareSpecialistResponse["candidates"][number];
  preparation: NonNullable<ExpertCareCaseState["contactPreparation"]>;
};

export class ExpertCareCaseNotFoundError extends Error {}
export class ExpertCareCaseConflictError extends Error {
  constructor(public readonly current: ExpertCareCaseRecord) {
    super("Expert Care case changed in another session");
  }
}
export class LegacyCareFinderUnavailableError extends Error {}

const iso = (value: Date | string) => value instanceof Date ? value.toISOString() : value;

function recordFromRow(row: TaskRow): ExpertCareCaseRecord {
  const rawState = row.progress_payload?.expertCare;
  const state = isExpertCareCaseState(rawState)
    ? { ...rawState, contactPreparation: rawState.contactPreparation ?? null, specialistResponse: rawState.specialistResponse ?? null }
    : rawState;
  if (row.kind !== "expert_care" || row.status !== "active" || !isExpertCareCaseState(state)) {
    throw new ExpertCareCaseNotFoundError("Expert Care case not found");
  }
  return { id: row.id, state, status: "active", createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}

async function rowForUser(id: string, userId: string): Promise<TaskRow | null> {
  const result = await pool.query<TaskRow>(
    "select * from concierge_task_drafts where id = $1::uuid and user_id = $2 limit 1",
    [id, userId],
  );
  return result.rows[0] ?? null;
}

export async function createExpertCareCase(input: {
  userId: string;
  language: "en" | "es";
  initialState?: ExpertCareCaseState;
}): Promise<ExpertCareCaseRecord> {
  const state = input.initialState ?? createExpertCareState(input.language);
  const result = await pool.query<TaskRow>(
    `insert into concierge_task_drafts (user_id, kind, entry_payload, progress_payload, language)
     values ($1, 'expert_care', $2::jsonb, $3::jsonb, $4)
     returning *`,
    [
      input.userId,
      JSON.stringify({ kind: "expert_care", providerSearchMode: "specialist" }),
      JSON.stringify({ expertCare: state }),
      input.language,
    ],
  );
  return recordFromRow(result.rows[0]!);
}

export async function getExpertCareCase(id: string, userId: string): Promise<ExpertCareCaseRecord> {
  const row = await rowForUser(id, userId);
  if (!row) throw new ExpertCareCaseNotFoundError("Expert Care case not found");
  return recordFromRow(row);
}

async function writeState(id: string, userId: string, previousRevision: number, state: ExpertCareCaseState): Promise<ExpertCareCaseRecord | null> {
  const dbStage = state.evidence || state.specialists ? "review" : "details";
  const result = await pool.query<TaskRow>(
    `update concierge_task_drafts
       set progress_payload = jsonb_set(progress_payload, '{expertCare}', $4::jsonb, true),
           stage = $5,
           updated_at = now()
     where id = $1::uuid
       and user_id = $2
       and kind = 'expert_care'
       and status = 'active'
       and coalesce((progress_payload -> 'expertCare' ->> 'revision')::int, -1) = $3
     returning *`,
    [id, userId, previousRevision, JSON.stringify(state), dbStage],
  );
  return result.rows[0] ? recordFromRow(result.rows[0]) : null;
}

export async function updateExpertCareCase(input: {
  id: string;
  userId: string;
  expectedRevision: number;
  patch: ExpertCareCasePatch;
}): Promise<ExpertCareCaseRecord> {
  const current = await getExpertCareCase(input.id, input.userId);
  if (current.state.revision !== input.expectedRevision) throw new ExpertCareCaseConflictError(current);
  const next = applyExpertCarePatch(current.state, input.patch);
  const saved = await writeState(input.id, input.userId, input.expectedRevision, next);
  if (saved) return saved;
  throw new ExpertCareCaseConflictError(await getExpertCareCase(input.id, input.userId));
}

async function mutateExpertCareCase(
  id: string,
  userId: string,
  mutate: (state: ExpertCareCaseState) => ExpertCareCaseState,
): Promise<ExpertCareCaseRecord> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await getExpertCareCase(id, userId);
    const saved = await writeState(id, userId, current.state.revision, mutate(current.state));
    if (saved) return saved;
  }
  throw new ExpertCareCaseConflictError(await getExpertCareCase(id, userId));
}

export const saveExpertCareEvidence = (id: string, userId: string, result: ExpertCareResearchResponse) =>
  mutateExpertCareCase(id, userId, (state) => attachExpertCareEvidence(state, result));

export const saveExpertCareResearchAcknowledgement = (id: string, userId: string) =>
  mutateExpertCareCase(id, userId, (state) => acknowledgeExpertCareResearchBoundary(state));

export const saveExpertCareSpecialists = (id: string, userId: string, result: ExpertCareSpecialistResponse) =>
  mutateExpertCareCase(id, userId, (state) => attachExpertCareSpecialists(state, result));

export const addExpertCareDocumentToCase = (id: string, userId: string, documentId: string) =>
  mutateExpertCareCase(id, userId, (state) => attachExpertCareDocumentId(state, documentId));

export const removeExpertCareDocumentFromCase = (id: string, userId: string, documentId: string) =>
  mutateExpertCareCase(id, userId, (state) => removeExpertCareDocumentId(state, documentId));

export const saveExpertCareVerification = (
  id: string,
  userId: string,
  candidateId: string,
  status: "verification_pending" | "verified" | "failed",
  details: string[],
  verifiedProfile?: ExpertCareVerifiedProfile,
) => mutateExpertCareCase(id, userId, (state) => updateExpertCareVerification(state, candidateId, status, details, verifiedProfile));

export const saveExpertCareContactPreparation = (
  id: string,
  userId: string,
  preparation: Parameters<typeof attachExpertCareContactPreparation>[1],
) => mutateExpertCareCase(id, userId, (state) => attachExpertCareContactPreparation(state, preparation));

export const saveExpertCareSpecialistResponse = (
  id: string,
  userId: string,
  response: NonNullable<ExpertCareCaseState["specialistResponse"]>,
) => mutateExpertCareCase(id, userId, (state) => attachExpertCareSpecialistResponse(state, response));

export async function listExpertCareVerificationQueue(limit = 50): Promise<ExpertCareVerificationQueueItem[]> {
  const result = await pool.query<TaskRow>(
    `select * from concierge_task_drafts
      where kind = 'expert_care' and status = 'active'
        and jsonb_path_exists(progress_payload, '$.expertCare.verification[*] ? (@.status == "verification_pending")')
      order by updated_at asc limit $1`,
    [Math.max(1, Math.min(200, Math.round(limit)))],
  );
  return result.rows.flatMap((row) => {
    const record = recordFromRow(row);
    const candidates = record.state.specialists?.result.candidates ?? [];
    return record.state.verification.flatMap((verification) => {
      if (verification.status !== "verification_pending") return [];
      const candidate = candidates.find((item) => item.id === verification.candidateId);
      if (!candidate) return [];
      return [{
        caseId: row.id,
        ownerUserId: row.user_id,
        candidate,
        requestedAt: verification.updatedAt,
        caseContext: {
          specialty: record.state.context.specialty,
          location: record.state.context.location,
          languages: record.state.context.languages,
        },
      }];
    });
  });
}

export async function listExpertCareCoordinationQueue(limit = 50): Promise<ExpertCareCoordinationQueueItem[]> {
  const result = await pool.query<TaskRow>(
    `select * from concierge_task_drafts
      where kind = 'expert_care' and status = 'active'
        and (progress_payload #> '{expertCare,contactPreparation}') <> 'null'::jsonb
        and coalesce(progress_payload #> '{expertCare,specialistResponse}', 'null'::jsonb) = 'null'::jsonb
      order by updated_at asc limit $1`,
    [Math.max(1, Math.min(200, Math.round(limit)))],
  );
  return result.rows.flatMap((row) => {
    const record = recordFromRow(row);
    const preparation = record.state.contactPreparation;
    if (!preparation) return [];
    const candidate = record.state.specialists?.result.candidates.find((item) => item.id === preparation.candidateId);
    return candidate ? [{ caseId: row.id, ownerUserId: row.user_id, candidate, preparation }] : [];
  });
}

const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asString = (value: unknown): string => typeof value === "string" ? value.trim() : "";

export async function importLegacyCareFinderCase(legacyTaskId: string, userId: string, language: "en" | "es"): Promise<ExpertCareCaseRecord> {
  const existing = await pool.query<TaskRow>(
    `select * from concierge_task_drafts
      where user_id = $1 and kind = 'expert_care' and status = 'active'
        and progress_payload -> 'expertCare' ->> 'legacySourceTaskId' = $2
      order by updated_at desc limit 1`,
    [userId, legacyTaskId],
  );
  if (existing.rows[0]) return recordFromRow(existing.rows[0]);

  const legacy = await rowForUser(legacyTaskId, userId);
  const progress = asRecord(legacy?.progress_payload);
  const answers = asRecord(progress.answers);
  if (!legacy || legacy.status !== "active" || answers.version !== "care_finder_v1") {
    throw new LegacyCareFinderUnavailableError("Legacy Care Finder draft is unavailable");
  }

  const state = createExpertCareState(language);
  state.legacySourceTaskId = legacyTaskId;
  state.context.goal = "find_specialist";
  state.context.person = answers.who === "self" ? "self" : answers.who === "other" ? "trusted_helper" : null;
  state.context.diagnosisOrRecommendation = asString(asRecord(progress.textDrafts).description) || asString(progress.query) || null;
  state.context.location = asString(answers.location) || null;
  state.context.emergencyResult = "not_checked";
  state.stage = state.context.person ? "specialty" : "person";
  return createExpertCareCase({ userId, language, initialState: state });
}
