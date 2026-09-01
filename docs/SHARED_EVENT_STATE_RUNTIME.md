# Shared Event and State Runtime

Task 7 adds the first shadow-only runtime membrane around the frozen Task 1 event and Flow-state contracts.

It observes established runtime facts, normalizes them into frozen `InteractionEvent` envelopes, optionally projects compatible `FlowState` records, and writes them through an injectable compatibility store. It does not route traffic, change responses, own domain state, invoke Specialists, execute Tools, call providers, read or write Mem0, or authorize candidate or authoritative delivery.

## Contract reuse

The runtime imports and calls the frozen public parsers:

- `parseInteractionEvent`
- `parseFlowState`
- `parseFlowTransition`

It does not duplicate or reinterpret the frozen schemas. If a normalized record is rejected by the frozen parser, Task 7 fails closed and emits only minimized telemetry.

## Initial supported channels

Task 7 supports strict runtime inputs for:

- voice: normalized to `USER_SPOKE`;
- tap/touch: normalized to `USER_TAPPED_OPTION`;
- text: normalized to `USER_ENTERED_TEXT`;
- shell delivery observation: normalized to a minimized system `FLOW_WAITING_FOR_USER` event after the legacy router has delivered JSON.

Image, document, measurement, caregiver, operator and telephone runtime integration remain deferred. Unsupported adapters are rejected rather than silently translated.

## Selected runtime seam

The only production seam is the Task 6 router shell after established legacy delivery. The legacy `routerHandler` remains the sole production response and side-effect authority.

Task 7 observation is attempted only when:

1. the legacy adapter completed;
2. the current request invoked `res.json()`;
3. no legacy error was thrown;
4. the Task 7 flag resolves to `shadow_emit`.

No-response, status-only and thrown legacy paths do not fabricate event completion.

## Feature flag and kill switch

The centralized flag is:

- ID: `flag.orchestrator.event_state_shadow`;
- version: `1.0.0`;
- default mode: `disabled`;
- supported modes: `disabled`, `shadow_emit`.

Environment variables:

- `VYVA_EVENT_STATE_SHADOW_MODE`
- `VYVA_EVENT_STATE_SHADOW_ROLLOUT_BPS`
- `VYVA_EVENT_STATE_SHADOW_ALLOW_PRODUCTION`
- `VYVA_EVENT_STATE_SHADOW_EXPIRY`
- `VYVA_EVENT_STATE_SHADOW_OWNER_REFERENCE`
- `VYVA_EVENT_STATE_SHADOW_AUDIT_REFERENCE`

The resolver is pure and accepts injected environment, current time and cohort key. It uses deterministic SHA-256 cohort bucketing. Missing, malformed, expired, ambiguous or incomplete configuration resolves to `disabled`. Production requires the exact `VYVA_EVENT_STATE_SHADOW_ALLOW_PRODUCTION=true` guard.

Operational disable procedure: unset `VYVA_EVENT_STATE_SHADOW_MODE` or set it to `disabled`. This stops all new Task 7 event persistence without changing legacy runtime behavior.

## Event normalization

Adapters accept strict, minimized runtime shapes. Every normalized event contains schema/version metadata, opaque event IDs, timestamps, correlation ID, session and user references, channel, modality, source, payload, safety context and strict metadata.

The live shell event ID requires an explicit `idempotency_reference`: an opaque value of 1–160 characters matching `[A-Za-z0-9][A-Za-z0-9._:-]*`. The current router request has no pre-existing durable interaction ID, so calls without this reference fail closed and schedule no Task 7 work. When supplied, Task 7 derives a lowercase RFC 4122-variant deterministic version-8 UUID from the versioned adapter domain, canonical event type and reference. It uses no shell correlation, observation ID, timestamp, random value, raw utterance, response content, or personal/medical text. Shell correlation remains attempt-scoped correlation metadata and is not event identity.

The runtime channel vocabulary is intentionally narrow:

- voice input normalizes to channel `voice`;
- touch/tap input normalizes to channel `touch`;
- typed input normalizes to channel `text`;
- system-only shell delivery observations normalize to channel `pwa`.

Text is bounded in adapter fixtures and direct runtime-library tests. The production Task 6 shell observer does not forward the raw Express `Request`, `Response`, full body, utterance or prompt to the Task 7 observer. It forwards only plain minimized fields: route/status class, safe IDs when already available, locale, input channel/kind, response digest, content digest and content-length bucket. Raw audio, full request/response bodies, prompts, memory, provider payloads, credentials, cookies, authorization headers, tokens, raw documents, full profiles and hidden reasoning are not stored or emitted by the shell seam.

## Correlation and causation

Task 7 enforces local deterministic rules:

- one interaction chain has one correlation ID;
- child events reference the immediate parent through `causationId`;
- event ID cannot equal correlation ID;
- session ID cannot equal correlation ID;
- causation cannot self-reference;
- causation must reference a known local parent when supplied;
- parent and child correlation IDs must match;
- parent and child session IDs must match when both are present.
- local causation cycles are rejected;
- parent events cannot occur after child events beyond the bounded clock-skew allowance.

The runtime validates local emission batches before persistence and validates persisted causation parents when writing through the compatibility store. It does not perform arbitrary global graph analysis beyond the current batch and direct persisted parent lookup.

## Flow-state compatibility projection

`FlowState` records are compatibility projections only. They are not authoritative domain state and do not terminate or mutate domain Flows.

The projection maps only facts available from the runtime input. It can carry `activeScene`, `expectedInput`, `pendingTool`, `interruptedState`, `resumeMetadata`, `domainState`, `completionOutcome`, correlation metadata and causation event references when those facts are explicitly supplied and accepted by the frozen parser.

Compatibility invariants are enforced before persistence:

- `waiting_for_user` requires an expected input;
- `waiting_for_tool` requires a pending Tool;
- `interrupted` requires a non-interrupted interrupted-state snapshot;
- `resuming` requires resume metadata from a paused or interrupted state;
- terminal states require a matching completion outcome;
- non-terminal states cannot carry a completion outcome;
- scene identifiers cannot regress within the same Flow projection chain;
- stale Flow-version regressions are rejected.

## One-active-Flow invariant

The invariant scope is `sessionId`.

Evidence:

- frozen `FlowState` requires `sessionId`;
- legacy `session_state` is uniquely keyed by `session_id`;
- `session_exchanges` and voice timeline events are session-correlated.

Zero active Flows is valid. One active Flow is valid. Two active Flow projections in the same session are rejected by the compatibility store. Terminal states do not count as active. Different sessions remain independent.

## Transition rules

The reducer validates compatibility transitions against the frozen lifecycle graph. It rejects immutable terminal-state mutation, backward/impossible transitions, timestamp regression, session/user mismatch and stale version regressions.

`failed -> resuming` remains allowed because it is explicitly present in the frozen Task 1 lifecycle table.

These checks validate shadow projections only; they do not implement business domain transitions.

## Persistence model

Task 7 uses an injectable `EventStateCompatibilityStore` backed by two additive compatibility tables:

- `orchestration_event_state_events`
- `orchestration_flow_state_projections`

The tables are canonical shadow-runtime projections. They do not replace existing session, timeline, health, memory, voice or domain tables. The migration is additive only: it creates the two compatibility tables and supporting indexes, and does not alter existing production tables, add triggers, backfill data or change application responses.

The default store is durable and idempotent. It writes through a lazy PostgreSQL repository that imports the existing database pool only when a write is attempted. This keeps disabled/default runtime paths inert while preserving transaction boundaries when shadow emission is enabled. A bounded in-memory repository remains available only as a test/local double.

The store writes minimized canonical events and Flow projections idempotently:

- same event ID + same semantic digest: duplicate/no-op;
- same event ID + different semantic digest: rejected;
- same Flow projection version + same digest: duplicate/no-op;
- same Flow identity + different semantic digest: rejected;
- conflicting active Flow in the same session: rejected.

Flow projections use a stable identity of `sessionId`, `flowId` and `flowVersion`. The durable table also has a partial unique index for one active Flow per session.

### Canonical semantic digests

Event and Flow digests share one strict canonical JSON implementation. It sorts object keys lexicographically at every level, preserves dense-array order and exact strings, emits deterministic finite-number JSON, preserves `null`, uses UTF-8, and never mutates input. Before runtime event normalization, shell-observation handling, Flow projection parsing or event/Flow persistence parsing, one descriptor-safe deep inert clone validates the complete caller-owned graph and creates detached ordinary objects and dense arrays; only that clone can reach frozen Zod parsers, digest generation, duplicate lookup, telemetry or repository writes. Sparse arrays are rejected rather than collapsed into dense arrays. Own property descriptors are inspected before values are read, and accessor properties are rejected without invoking getters or setters. Unsupported values—including undefined object values, undefined array entries, functions, symbols, bigint, non-finite numbers, cycles, non-enumerable or symbol-keyed properties, and class/prototype-bearing instances—are rejected. Optional fields are represented by property absence only; explicit `undefined` is invalid, while explicit `null` remains present and therefore differs from absence.

Digest input is domain-separated as `vyva.task7.interaction-event.semantic.v1` or `vyva.task7.flow-state.semantic.v1`. The event projection includes every validated frozen event fact except, for the shell-delivery adapter only, attempt-scoped `occurredAt`, `correlationId`, and `metadata.receivedAt`. The Flow projection includes the complete validated frozen `FlowState`, including its contract `updatedAt`; database-generated persistence timestamps, connections, Promises, telemetry and observer state are never included.

The first shell observation stores its correlation and timestamps. A retry with the same stable reference and unchanged authoritative semantics derives the same event UUID and digest, so database uniqueness makes it a no-op even across repository instances or processes. A semantic change under that UUID is rejected as a conflict; retries never overwrite the first stored observation. Database uniqueness remains the final enforcement layer.

## Ordering and resource limits

The shell schedules one post-delivery attempt. There are no retries, workers or queues in Task 7. Runtime work is bounded by a fixed timeout with a 250 ms hard cap. Failures are swallowed after minimized telemetry and never reinvoke the legacy handler.

Task 7 does not include durable retry, lease, queue, outbox or worker semantics. Those remain later-stage work if the shadow store needs multi-instance delivery guarantees beyond direct idempotent writes.

## Telemetry

Task 7 follows the Task 6 replaceable sink pattern:

- `setEventStateTelemetrySink`
- `resetEventStateTelemetrySink`
- `emitEventStateTelemetry`

Telemetry is strict, versioned, minimized, non-persistent by default, nonblocking and failure-isolated. It records safe classifications only, such as normalization/parser/persistence outcome, duplicate outcome, correlation and causation completeness, Flow-state invariant result, latency bucket and `nonExecutable: true`.

Telemetry does not include raw text, payload bodies, user/profile/session IDs, prompts, memory, tokens, raw errors, database values or credentials.

## Failure behavior and rollback

All Task 7 failures are contained:

- disabled flag: no event write;
- invalid input: reject shadow event only;
- frozen parser rejection: reject shadow event only;
- causation/correlation error: reject shadow event only;
- duplicate conflict: reject shadow write only;
- active Flow conflict: reject Flow projection only;
- bounded in-memory capacity exceeded: reject local/test write only;
- persistence failure or timeout: emit minimized telemetry only.

Rollback is disabling the flag. Existing legacy runtime behavior is unchanged. The additive compatibility tables can be left in place unused; dropping them requires a reviewed data-retention decision.

## Deferred work

Deferred to later approved stages:

- broader voice/touch/text/canvas wiring;
- Specialist invocation;
- Central Orchestrator policy execution;
- Tool authorization/execution;
- Mem0 or memory access;
- candidate or authoritative delivery;
- durable retries/workers/schedulers;
- proactive engagement dispatch.
