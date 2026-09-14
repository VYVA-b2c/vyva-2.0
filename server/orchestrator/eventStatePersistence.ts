import { parseInteractionEvent, type InteractionEvent } from "../../shared/orchestration/events.js";
import { parseFlowState, type FlowState } from "../../shared/orchestration/flowState.js";
import { descriptorSafeDeepInertClone } from "./eventStateCanonicalJson.js";
import {
  eventStateCanonicalDigest,
  interactionEventSemanticDigest,
  MAX_CLOCK_SKEW_MS,
  validateLocalEventBatch,
} from "./interactionEventRuntime.js";
import {
  countsAsActiveFlow,
  flowStateSemanticDigest,
  validateFlowStateTransition,
  validateOneActiveFlowBySession,
} from "./flowStateRuntime.js";

export type ShadowPersistenceRejectionReason =
  | "duplicate_conflict"
  | "active_flow_conflict"
  | "transition_invalid"
  | "causation_invalid"
  | "correlation_invalid"
  | "capacity_exceeded"
  | "persistence_unavailable";

export type ShadowPersistenceWriteResult =
  | { outcome: "stored" }
  | { outcome: "duplicate" }
  | {
      outcome: "rejected";
      reason: ShadowPersistenceRejectionReason;
    };

export interface EventStateCompatibilityStore {
  writeInteractionEvent(
    event: InteractionEvent,
    input?: { localParentEvents?: readonly InteractionEvent[] },
  ): Promise<ShadowPersistenceWriteResult>;
  writeFlowProjection(
    flowState: FlowState,
    input: { eventId: string; reason: string },
  ): Promise<ShadowPersistenceWriteResult>;
  eventsByCorrelation(correlationId: string): Promise<InteractionEvent[]>;
  activeFlowsBySession(sessionId: string): Promise<FlowState[]>;
}

type EventRecord = {
  event: InteractionEvent;
  semanticDigest: string;
};

type FlowRecord = {
  flowState: FlowState;
  semanticDigest: string;
  isActive: boolean;
};

type InsertResult = "inserted" | "duplicate" | "capacity_exceeded";

interface EventStateCompatibilityTransaction {
  findEventById(eventId: string): Promise<EventRecord | undefined>;
  insertEvent(record: EventRecord): Promise<InsertResult>;
  eventsByCorrelation(correlationId: string): Promise<EventRecord[]>;
  findFlowByIdentity(input: { sessionId: string; flowKey: string; flowVersionKey: string }): Promise<FlowRecord | undefined>;
  findLatestFlowForSessionFlow(input: { sessionId: string; flowKey: string }): Promise<FlowRecord | undefined>;
  insertFlow(record: FlowRecord): Promise<InsertResult>;
  activeFlowsBySession(sessionId: string): Promise<FlowRecord[]>;
}

interface EventStateCompatibilityRepository {
  withTransaction<T>(operation: (tx: EventStateCompatibilityTransaction) => Promise<T>): Promise<T>;
}

function eventReceivedAt(event: InteractionEvent): string | undefined {
  const metadata = event.metadata as { receivedAt?: unknown } | undefined;
  return typeof metadata?.receivedAt === "string" ? metadata.receivedAt : undefined;
}

function localeFor(event: InteractionEvent): string | undefined {
  const metadata = event.metadata as { locale?: unknown } | undefined;
  return typeof metadata?.locale === "string" ? metadata.locale : undefined;
}

function toPgDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function flowKey(flowState: FlowState): string {
  return flowState.flowId ?? "idle";
}

function flowVersionKey(flowState: FlowState): string {
  return flowState.flowVersion ?? "none";
}

function safeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPgUniqueError(error: unknown, constraintName: string): boolean {
  return Boolean(
    error
    && typeof error === "object"
    && (error as { code?: unknown }).code === "23505"
    && String((error as { constraint?: unknown }).constraint ?? "").includes(constraintName)
  );
}

function validateParentChain(
  event: InteractionEvent,
  parent: InteractionEvent | undefined,
): ShadowPersistenceRejectionReason | undefined {
  if (event.eventId === event.correlationId || (event.sessionId && event.sessionId === event.correlationId)) {
    return "correlation_invalid";
  }
  if (event.causationId === event.eventId) return "causation_invalid";
  if (!event.causationId) return undefined;
  if (!parent) return "causation_invalid";
  if (parent.correlationId !== event.correlationId) return "correlation_invalid";
  if (parent.sessionId && event.sessionId && parent.sessionId !== event.sessionId) return "causation_invalid";
  const parentOccurred = Date.parse(parent.occurredAt);
  const childOccurred = Date.parse(event.occurredAt);
  if (Number.isFinite(parentOccurred) && Number.isFinite(childOccurred) && parentOccurred > childOccurred + MAX_CLOCK_SKEW_MS) {
    return "causation_invalid";
  }
  return undefined;
}

class LazyPostgresEventStateCompatibilityRepository implements EventStateCompatibilityRepository {
  async withTransaction<T>(operation: (tx: EventStateCompatibilityTransaction) => Promise<T>): Promise<T> {
    const { pool } = await import("../db.js");
    const client = await pool.connect();
    try {
      await client.query("begin");
      const tx = new PostgresEventStateCompatibilityTransaction(client);
      const result = await operation(tx);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}

type PgClient = {
  query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
};

class PostgresEventStateCompatibilityTransaction implements EventStateCompatibilityTransaction {
  constructor(private readonly client: PgClient) {}

  async findEventById(eventId: string): Promise<EventRecord | undefined> {
    const result = await this.client.query<{
      normalized_event: InteractionEvent;
      semantic_digest: string;
    }>(
      "select normalized_event, semantic_digest from orchestration_event_state_events where event_id = $1",
      [eventId],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return { event: parseInteractionEvent(row.normalized_event), semanticDigest: row.semantic_digest };
  }

  async insertEvent(record: EventRecord): Promise<InsertResult> {
    const event = record.event;
    const result = await this.client.query(
      `insert into orchestration_event_state_events (
        event_id, schema_version, event_type, occurred_at, received_at,
        correlation_id, causation_id, user_id, profile_id, session_id,
        flow_id, flow_version, channel, locale, source, modality,
        trigger_source, payload, metadata, safety_context, normalized_event,
        semantic_digest
      ) values (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16,
        $17, $18::jsonb, $19::jsonb, $20::jsonb, $21::jsonb,
        $22
      ) on conflict (event_id) do nothing`,
      [
        event.eventId,
        String((event.metadata as { schemaVersion?: unknown } | undefined)?.schemaVersion ?? "1.0.0"),
        event.eventType,
        toPgDate(event.occurredAt),
        toPgDate(eventReceivedAt(event)),
        event.correlationId,
        event.causationId ?? null,
        event.userId,
        event.profileId ?? null,
        event.sessionId ?? null,
        event.flowId ?? null,
        event.flowVersion ?? null,
        event.channel,
        localeFor(event) ?? null,
        event.source,
        event.modality,
        event.triggerSource,
        JSON.stringify(event.payload ?? {}),
        JSON.stringify(event.metadata ?? {}),
        JSON.stringify(event.safetyContext ?? {}),
        JSON.stringify(event),
        record.semanticDigest,
      ],
    );
    return result.rowCount === 1 ? "inserted" : "duplicate";
  }

  async eventsByCorrelation(correlationId: string): Promise<EventRecord[]> {
    const result = await this.client.query<{
      normalized_event: InteractionEvent;
      semantic_digest: string;
    }>(
      "select normalized_event, semantic_digest from orchestration_event_state_events where correlation_id = $1 order by occurred_at asc, created_at asc",
      [correlationId],
    );
    return result.rows.map((row) => ({
      event: parseInteractionEvent(row.normalized_event),
      semanticDigest: row.semantic_digest,
    }));
  }

  async findFlowByIdentity(input: { sessionId: string; flowKey: string; flowVersionKey: string }): Promise<FlowRecord | undefined> {
    const result = await this.client.query<{
      normalized_flow_state: FlowState;
      semantic_digest: string;
      is_active: boolean;
    }>(
      `select normalized_flow_state, semantic_digest, is_active
       from orchestration_flow_state_projections
       where session_id = $1 and flow_key = $2 and flow_version_key = $3
       for update`,
      [input.sessionId, input.flowKey, input.flowVersionKey],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      flowState: parseFlowState(row.normalized_flow_state),
      semanticDigest: row.semantic_digest,
      isActive: row.is_active,
    };
  }

  async findLatestFlowForSessionFlow(input: { sessionId: string; flowKey: string }): Promise<FlowRecord | undefined> {
    const result = await this.client.query<{
      normalized_flow_state: FlowState;
      semantic_digest: string;
      is_active: boolean;
    }>(
      `select normalized_flow_state, semantic_digest, is_active
       from orchestration_flow_state_projections
       where session_id = $1 and flow_key = $2
       order by flow_version_key desc, updated_at desc
       limit 1
       for update`,
      [input.sessionId, input.flowKey],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      flowState: parseFlowState(row.normalized_flow_state),
      semanticDigest: row.semantic_digest,
      isActive: row.is_active,
    };
  }

  async insertFlow(record: FlowRecord): Promise<InsertResult> {
    const flowState = record.flowState;
    try {
      const result = await this.client.query(
        `insert into orchestration_flow_state_projections (
          flow_key, flow_version_key, flow_id, flow_version, session_id, user_id,
          state, is_active, expected_input, pending_tool, interrupted_state,
          resume_metadata, context, completion_outcome, correlation_id,
          causation_event_id, metadata, normalized_flow_state, semantic_digest,
          updated_at
        ) values (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9::jsonb, $10::jsonb, $11,
          $12::jsonb, $13::jsonb, $14::jsonb, $15,
          $16, $17::jsonb, $18::jsonb, $19,
          $20
        ) on conflict on constraint orchestration_flow_state_projections_identity_unique do nothing`,
        [
          flowKey(flowState),
          flowVersionKey(flowState),
          flowState.flowId ?? null,
          flowState.flowVersion ?? null,
          flowState.sessionId,
          flowState.userId,
          flowState.state,
          record.isActive,
          flowState.expectedInput ? JSON.stringify(flowState.expectedInput) : null,
          flowState.pendingTool ? JSON.stringify(flowState.pendingTool) : null,
          flowState.interruptedState ?? null,
          flowState.resumeMetadata ? JSON.stringify(flowState.resumeMetadata) : null,
          JSON.stringify(flowState.context ?? {}),
          JSON.stringify((flowState.context as { completionOutcome?: unknown }).completionOutcome ?? null),
          (flowState.context as { correlation?: { correlationId?: string } }).correlation?.correlationId ?? null,
          (flowState.context as { correlation?: { causationEventId?: string } }).correlation?.causationEventId ?? null,
          JSON.stringify((flowState.context as { metadata?: unknown }).metadata ?? {}),
          JSON.stringify(flowState),
          record.semanticDigest,
          toPgDate(flowState.updatedAt),
        ],
      );
      return result.rowCount === 1 ? "inserted" : "duplicate";
    } catch (error) {
      if (isPgUniqueError(error, "orchestration_flow_state_projections_one_active_session_idx")) {
        return "duplicate";
      }
      throw error;
    }
  }

  async activeFlowsBySession(sessionId: string): Promise<FlowRecord[]> {
    const result = await this.client.query<{
      normalized_flow_state: FlowState;
      semantic_digest: string;
      is_active: boolean;
    }>(
      "select normalized_flow_state, semantic_digest, is_active from orchestration_flow_state_projections where session_id = $1 and is_active = true order by updated_at desc",
      [sessionId],
    );
    return result.rows.map((row) => ({
      flowState: parseFlowState(row.normalized_flow_state),
      semanticDigest: row.semantic_digest,
      isActive: row.is_active,
    }));
  }
}

export class InMemoryEventStateCompatibilityRepository implements EventStateCompatibilityRepository {
  private events = new Map<string, EventRecord>();
  private flows = new Map<string, FlowRecord>();

  constructor(private readonly limits: { maxEvents: number; maxFlows: number } = { maxEvents: 1_000, maxFlows: 1_000 }) {}

  async withTransaction<T>(operation: (tx: EventStateCompatibilityTransaction) => Promise<T>): Promise<T> {
    const eventSnapshot = new Map(this.events);
    const flowSnapshot = new Map(this.flows);
    const tx = new InMemoryEventStateCompatibilityTransaction(this.events, this.flows, this.limits);
    try {
      return await operation(tx);
    } catch (error) {
      this.events = eventSnapshot;
      this.flows = flowSnapshot;
      throw error;
    }
  }
}

class InMemoryEventStateCompatibilityTransaction implements EventStateCompatibilityTransaction {
  constructor(
    private readonly events: Map<string, EventRecord>,
    private readonly flows: Map<string, FlowRecord>,
    private readonly limits: { maxEvents: number; maxFlows: number },
  ) {}

  async findEventById(eventId: string): Promise<EventRecord | undefined> {
    return this.events.get(eventId);
  }

  async insertEvent(record: EventRecord): Promise<InsertResult> {
    if (this.events.has(record.event.eventId)) return "duplicate";
    if (this.events.size >= this.limits.maxEvents) return "capacity_exceeded";
    this.events.set(record.event.eventId, safeJson(record));
    return "inserted";
  }

  async eventsByCorrelation(correlationId: string): Promise<EventRecord[]> {
    return Array.from(this.events.values())
      .filter((record) => record.event.correlationId === correlationId)
      .sort((left, right) => left.event.occurredAt.localeCompare(right.event.occurredAt));
  }

  async findFlowByIdentity(input: { sessionId: string; flowKey: string; flowVersionKey: string }): Promise<FlowRecord | undefined> {
    return this.flows.get(`${input.sessionId}:${input.flowKey}:${input.flowVersionKey}`);
  }

  async findLatestFlowForSessionFlow(input: { sessionId: string; flowKey: string }): Promise<FlowRecord | undefined> {
    return Array.from(this.flows.entries())
      .filter(([key]) => key.startsWith(`${input.sessionId}:${input.flowKey}:`))
      .map(([, record]) => record)
      .sort((left, right) => flowVersionKey(right.flowState).localeCompare(flowVersionKey(left.flowState)) || right.flowState.updatedAt.localeCompare(left.flowState.updatedAt))[0];
  }

  async insertFlow(record: FlowRecord): Promise<InsertResult> {
    const key = `${record.flowState.sessionId}:${flowKey(record.flowState)}:${flowVersionKey(record.flowState)}`;
    if (this.flows.has(key)) return "duplicate";
    if (this.flows.size >= this.limits.maxFlows) return "capacity_exceeded";
    if (record.isActive) {
      const activeConflict = Array.from(this.flows.values()).some((existing) =>
        existing.isActive && existing.flowState.sessionId === record.flowState.sessionId);
      if (activeConflict) return "duplicate";
    }
    this.flows.set(key, safeJson(record));
    return "inserted";
  }

  async activeFlowsBySession(sessionId: string): Promise<FlowRecord[]> {
    return Array.from(this.flows.values()).filter((record) => record.isActive && record.flowState.sessionId === sessionId);
  }
}

export class DurableEventStateCompatibilityStore implements EventStateCompatibilityStore {
  constructor(private readonly repository: EventStateCompatibilityRepository = new LazyPostgresEventStateCompatibilityRepository()) {}

  async writeInteractionEvent(
    inputEvent: InteractionEvent,
    input: { localParentEvents?: readonly InteractionEvent[] } = {},
  ): Promise<ShadowPersistenceWriteResult> {
    let event: InteractionEvent;
    let localParentEvents: readonly InteractionEvent[];
    try {
      const inertInput = descriptorSafeDeepInertClone({
        event: inputEvent,
        options: input,
      }) as { event: unknown; options: { localParentEvents?: unknown[] } };
      event = parseInteractionEvent(inertInput.event);
      localParentEvents = (inertInput.options.localParentEvents ?? []).map((parent) =>
        parseInteractionEvent(parent));
    } catch {
      return { outcome: "rejected", reason: "persistence_unavailable" };
    }

    const localValidation = validateLocalEventBatch([
      ...localParentEvents,
      event,
    ]);
    if (!localValidation.ok && localParentEvents.length) {
      return { outcome: "rejected", reason: localValidation.error === "duplicate_conflict" ? "duplicate_conflict" : localValidation.error };
    }

    const semanticDigest = interactionEventSemanticDigest(event);
    try {
      return await this.repository.withTransaction(async (tx) => {
        const existing = await tx.findEventById(event.eventId);
        if (existing) {
          return existing.semanticDigest === semanticDigest
            ? { outcome: "duplicate" }
            : { outcome: "rejected", reason: "duplicate_conflict" };
        }

        const localParent = localParentEvents.find((candidate) => candidate.eventId === event.causationId);
        const persistedParent = event.causationId && !localParent
          ? (await tx.findEventById(event.causationId))?.event
          : undefined;
        const parentError = validateParentChain(event, localParent ?? persistedParent);
        if (parentError) return { outcome: "rejected", reason: parentError };

        const insertResult = await tx.insertEvent({ event, semanticDigest });
        if (insertResult === "inserted") return { outcome: "stored" };
        if (insertResult === "capacity_exceeded") return { outcome: "rejected", reason: "capacity_exceeded" };
        const duplicate = await tx.findEventById(event.eventId);
        return duplicate?.semanticDigest === semanticDigest
          ? { outcome: "duplicate" }
          : { outcome: "rejected", reason: "duplicate_conflict" };
      });
    } catch {
      return { outcome: "rejected", reason: "persistence_unavailable" };
    }
  }

  async writeFlowProjection(
    inputFlowState: FlowState,
    input: { eventId: string; reason: string },
  ): Promise<ShadowPersistenceWriteResult> {
    let flowState: FlowState;
    let options: { eventId: string; reason: string };
    try {
      const inertInput = descriptorSafeDeepInertClone({
        flowState: inputFlowState,
        options: input,
      }) as { flowState: unknown; options: { eventId: string; reason: string } };
      flowState = parseFlowState(inertInput.flowState);
      options = inertInput.options;
    } catch {
      return { outcome: "rejected", reason: "persistence_unavailable" };
    }

    const semanticDigest = flowStateSemanticDigest(flowState);
    try {
      return await this.repository.withTransaction(async (tx) => {
        const existing = await tx.findFlowByIdentity({
          sessionId: flowState.sessionId,
          flowKey: flowKey(flowState),
          flowVersionKey: flowVersionKey(flowState),
        });
        if (existing) {
          return existing.semanticDigest === semanticDigest
            ? { outcome: "duplicate" }
            : { outcome: "rejected", reason: "duplicate_conflict" };
        }

        const latest = await tx.findLatestFlowForSessionFlow({
          sessionId: flowState.sessionId,
          flowKey: flowKey(flowState),
        });
        if (latest) {
          const transition = validateFlowStateTransition({
            previous: latest.flowState,
            next: flowState,
            eventId: options.eventId,
            reason: options.reason,
          });
          if (!transition.ok) return { outcome: "rejected", reason: "transition_invalid" };
        }

        const currentActive = await tx.activeFlowsBySession(flowState.sessionId);
        const activeInvariant = validateOneActiveFlowBySession([
          ...currentActive.map((record) => record.flowState),
          flowState,
        ]);
        if (!activeInvariant.ok) return { outcome: "rejected", reason: "active_flow_conflict" };

        const insertResult = await tx.insertFlow({
          flowState,
          semanticDigest,
          isActive: countsAsActiveFlow(flowState.state),
        });
        if (insertResult === "inserted") return { outcome: "stored" };
        if (insertResult === "capacity_exceeded") return { outcome: "rejected", reason: "capacity_exceeded" };
        const duplicate = await tx.findFlowByIdentity({
          sessionId: flowState.sessionId,
          flowKey: flowKey(flowState),
          flowVersionKey: flowVersionKey(flowState),
        });
        return duplicate?.semanticDigest === semanticDigest
          ? { outcome: "duplicate" }
          : { outcome: "rejected", reason: "active_flow_conflict" };
      });
    } catch {
      return { outcome: "rejected", reason: "persistence_unavailable" };
    }
  }

  async eventsByCorrelation(correlationId: string): Promise<InteractionEvent[]> {
    return this.repository.withTransaction(async (tx) =>
      (await tx.eventsByCorrelation(correlationId)).map((record) => record.event));
  }

  async activeFlowsBySession(sessionId: string): Promise<FlowState[]> {
    return this.repository.withTransaction(async (tx) =>
      (await tx.activeFlowsBySession(sessionId)).map((record) => record.flowState));
  }
}

export class InMemoryEventStateCompatibilityStore extends DurableEventStateCompatibilityStore {
  constructor(limits?: { maxEvents: number; maxFlows: number }) {
    super(new InMemoryEventStateCompatibilityRepository(limits));
  }
}

export const defaultEventStateCompatibilityStore = new DurableEventStateCompatibilityStore();
