# Stage 1 Orchestrator Shell

## Purpose

Task 6 implements the Stage 1 compatibility shell around the existing
`POST /api/router` handler. The shell creates a fail-closed mode boundary,
observes the legacy response in a minimized form and can run a bounded,
non-delivering shadow observation after delivery.

This milestone does not implement the future Central Orchestrator. The existing
`server/routes/router.ts` handler remains the sole routing, safety, prompt,
session, memory, Tool-token and response authority.

## Production seam and authority

`server/index.ts` keeps the same method, path, global JSON middleware position
and route-level middleware:

```text
POST /api/router
  -> orchestratorRouterHandler
  -> legacyRouterAdapter
  -> routerHandler exactly once
  -> original Express response
  -> optional post-delivery shadow observation
```

The delivery authority is always `legacy_handler`. There is no second route,
candidate handler or authoritative Orchestrator handler.

The legacy adapter forwards the original Express request and response objects.
It temporarily intercepts only `res.status()` and `res.json()`, immediately
delegates to their original bound implementations and restores both methods in
a `finally` block. It does not add headers or response fields.

## Exact-once legacy delivery

Each request has one closure-scoped legacy invocation guard. The shell never
retries or replays the legacy handler and shadow work cannot invoke it. A
legacy throw is rethrown as the same object for Express 5 to handle. A throw
after partial delivery is not converted into another response.

The wrapper does not change:

- status or JSON body;
- response delivery authority;
- session or exchange writes;
- Mem0 reads, writes or scheduling;
- prompts, agent IDs or dynamic variables;
- Tool tokens or client Tools;
- safety precedence.

## Closed live modes

Task 6 recognizes the frozen Task 5 mode vocabulary but permits only two
effective modes:

| Requested configuration | Effective mode | Result |
|---|---|---|
| missing | `legacy_only` | safe default |
| `legacy_only` | `legacy_only` | direct legacy path |
| valid, selected `shadow_compare` | `shadow_compare` | legacy delivery plus post-delivery observation |
| invalid or unselected `shadow_compare` | `legacy_only` | fail closed |
| `candidate_delivery` | `legacy_only` | `future_contract_required` |
| `authoritative` | `legacy_only` | `future_contract_required` |
| unknown or malformed | `legacy_only` | fixed safe invalid-mode reason |

No environment configuration can select candidate or authoritative delivery.

## Feature-flag configuration

The fixed flag identity is:

- flag ID: `flag.orchestrator.shell`;
- version: `1.0.0`;
- default: `legacy_only`;
- delivery authority: `legacy_handler`.

The centralized environment variables are:

| Variable | Purpose |
|---|---|
| `VYVA_ORCHESTRATOR_MODE` | requested frozen Task 5 mode |
| `VYVA_ORCHESTRATOR_SHADOW_ROLLOUT_BPS` | integer rollout from 1 to 10,000 |
| `VYVA_ORCHESTRATOR_SHADOW_EVIDENCE_IDS` | comma-separated prerequisite evidence references |
| `VYVA_ORCHESTRATOR_SHADOW_ROLLBACK_PLAN_ID` | rollback-plan reference |
| `VYVA_ORCHESTRATOR_SHADOW_EXPIRY` | future canonical UTC ISO-8601 expiry (`YYYY-MM-DDTHH:mm:ss.sssZ`) |
| `VYVA_ORCHESTRATOR_SHADOW_OWNER_REFERENCE` | accountable owner reference |
| `VYVA_ORCHESTRATOR_SHADOW_AUDIT_REFERENCE` | audit approval reference |
| `VYVA_ORCHESTRATOR_SHADOW_ALLOW_PRODUCTION` | exact `true` production authorization |
| `VYVA_ORCHESTRATOR_SHADOW_DENY_BUCKETS` | optional comma-separated 0–9,999 deny buckets |
| `VYVA_ORCHESTRATOR_SHADOW_DENY_REFERENCE` | required reference when deny buckets are configured |
| `NODE_ENV` | established environment classification source |

There are no aliases. Missing or malformed prerequisites disable shadow as a
whole. Configuration lists are length- and count-bounded, and reject duplicate
entries. The resolver accepts an injected environment map, current time and
cohort key for deterministic tests.

## Deterministic rollout and deny precedence

The cohort key preference is session ID, then user ID. If neither is usable,
shadow is disabled. The key is never logged, included in telemetry or persisted.

The bucket input is:

```text
flag.orchestrator.shell:1.0.0:<cohort-key>
```

The resolver computes SHA-256 using Node's built-in `crypto`, reads the first
unsigned 32-bit big-endian word and takes modulo 10,000. A cohort is selected
when its bucket is less than the configured basis points.

A configured matching deny bucket takes precedence over rollout. A deny list
without its reference, an invalid bucket or an orphan reference fails closed.

## Shadow prerequisites and production guard

Shadow requires all of:

- valid `shadow_compare` mode;
- integer rollout in 1–10,000;
- usable cohort key and selected cohort;
- recognized `local`, `test`, `staging` or `production` environment
  (`development` maps to `local`);
- at least one valid evidence reference;
- rollback-plan, owner and audit references;
- valid future canonical UTC ISO-8601 expiry that round-trips through
  `Date.toISOString()`, with no leading or trailing whitespace;
- no matching deny bucket;
- exact production authorization when in production.

For a selected configuration the resolver constructs the corresponding frozen
Task 5 `CompatibilityFeatureFlagState` and calls its public parser. Parser
failure disables shadow. Ordinary legacy-only operation does not fabricate
evidence or rollback records.

Evidence, rollback, owner and audit references are configured identifiers only.
Task 6 validates their bounded shape and required correlation fields; it does
not retrieve, substantively verify, persist or cryptographically attest the
referenced evidence. Those operational evidence controls remain prerequisites
for any later production-shadow approval.

The production authorization can enable only shadow comparison. It cannot
enable candidate or authoritative delivery.

## Response observation and digest

The adapter captures:

- one invocation;
- completion through `res.json()`;
- HTTP status;
- coarse JSON value kind;
- coarse latency bucket;
- optional SHA-256 digest.

The digest is SHA-256 over the serialized string or Buffer that Express
`res.json()` passes to `res.send()`. The adapter does not call
`JSON.stringify()` on the original response value before Express, so stateful
`toJSON()` methods, getters and serialization exceptions remain owned by the
legacy Express response path. The digest proves only equality of the observed
Express JSON payload, not semantic equivalence under a different serializer.

The production observation and telemetry never contain the JSON body.

## Shadow isolation

Shadow starts only when the current request's legacy adapter invocation returns
without throwing and its observation reports `completed: true`, which is set
only when that request invoked the intercepted `res.json()` path. The default
Express status `200` is not delivery evidence. If the legacy handler returns
without invoking `res.json()`, the shell does not schedule or evaluate shadow,
does not synthesize a response and leaves the handler's no-response behavior
unchanged.

After established delivery, shadow receives one frozen object containing only:

- random shell correlation ID;
- fixed route ID;
- legacy status;
- optional response digest;
- completion indicator;
- latency bucket;
- `nonExecutable: true`.

It does not receive Express objects, raw request/response bodies, user or session
IDs, utterances, conversation history, prompts, memory, provider clients,
database clients, Tool adapters or credentials.

Stage 1 shadow can classify only whether the shell observed preserved legacy
delivery. It does not claim a routing candidate, Task 4 authorization or a full
Task 5 compatibility decision.

Shadow cannot:

- invoke a handler, Specialist, provider or Tool;
- read or write memory or a database;
- mutate Flow or session state;
- create tokens or browser events;
- render, speak, persist, enqueue, retry, roll back or escalate.

## Timeout and resource limits

The default shadow timeout is 50 ms and the hard cap is 250 ms. Tests may inject
a smaller value. Shadow receives an `AbortSignal`, runs once, has no retry loop
and uses no queue, worker or persistence. Its timer is unreferenced.

A JavaScript `AbortSignal` is cooperative: it cannot forcibly terminate an
evaluator that ignores cancellation, and such an evaluator's unresolved work
may continue after the shell records a timeout. The production Stage 1
evaluator is immediate and inherently bounded. Any later non-trivial evaluator
must honor cancellation and add reviewed concurrency/resource bounds before
staging or production shadow can be approved.

A timeout or shadow failure produces only a minimized classification and the
fixed recommendation `remain_legacy_only`. It cannot delay or alter the already
delivered legacy response.

## Runtime decision record and telemetry

`OrchestratorShellDecisionRecord` is a strict versioned Task 6 runtime
observation. It is intentionally not a Task 5
`CompatibilityDecisionRecord`.

It contains only:

- schema version and random shell IDs;
- fixed route and legacy delivery authority;
- frozen Task 5 mode vocabulary and, for active shadow, its parsed flag state;
- exact-once indicator;
- status, digest and latency bucket;
- fixed shadow outcome, comparison, fallback and error classifications;
- `nonExecutable: true`.

It excludes raw errors and all request, response, identity, prompt, memory,
header, cookie, token and provider data.

Telemetry uses a replaceable sink with set/reset functions. The production
default is a no-op. Records are schema-validated before emission. Synchronous
and asynchronous sink failures are swallowed.

Task 6 does not persist shell decisions or digests.

## Failure fallback and rollback

| Failure | Delivery behavior |
|---|---|
| missing/invalid flag | legacy once |
| clock, ID or flag resolver failure | fail closed; legacy once |
| legacy handler throws | same error object propagates |
| shadow throws | legacy response unchanged |
| shadow times out | legacy response unchanged |
| task scheduling throws | legacy response unchanged |
| telemetry rejects or throws | legacy response unchanged |

Operational disable procedure:

1. unset `VYVA_ORCHESTRATOR_MODE`, or set it to `legacy_only`;
2. optionally set rollout basis points to `0` as an additional fail-closed
   control;
3. verify telemetry reports `legacy_only`;
4. if the shell itself must be removed, revert the single route mount to
   `routerHandler` in a separately reviewed rollback.

The normal flag rollback disables all shadow work and leaves only the
exact-once legacy path.

## Test strategy and limitations

Tests cover:

- all closed mode and prerequisite cases;
- deterministic cohorts, deny precedence and production authorization;
- Task 5 feature-flag parser correlation;
- response/status/header/body parity and method restoration;
- actual legacy missing-field HTTP parity;
- real legacy safety and normal branches with deterministic mocks for database,
  Mem0, context, policy, recommendation feedback and Tool-token dependencies;
- exact-once invocation, safety precedence and side-effect count;
- original thrown-error identity and partial-response behavior;
- post-delivery ordering, immutable minimized shadow input and timeout;
- telemetry minimization and failure isolation;
- candidate/authoritative inactivity and prohibited import searches.

The missing-field, safety and normal parity branches exercise the unchanged real
`routerHandler` directly and through the shell. Safety and normal dependencies
are mocked at their imported boundaries rather than copied, and the tests assert
identical response payloads plus exact database, memory, context,
recommendation-feedback and Tool-token call counts. Separate synthetic handlers
remain shell-mechanics fixtures only.

## Deferred work

Task 6 does not fabricate Task 1 events or Flow state, Task 4 requests or
decisions, or full Task 5 evaluation/decision records. It does not implement
the Central Orchestrator runtime loop, specialist routing, response composition,
Tool authorization, memory policy, event persistence, proactive engagement,
Preventive Health flows or durable scheduling. Those remain Stage 2 and later
responsibilities and require separate review.
