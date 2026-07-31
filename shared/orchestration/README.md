# Shared orchestration contracts

This directory contains version-independent contracts for the future VYVA
orchestrator. It is deliberately not imported by production runtime code.

- `events.ts` defines the common interaction-event envelope, the complete event
  taxonomy from the architecture plan, and its Zod validator.
- `flowState.ts` defines lifecycle states, permitted transitions, expected
  question context, lifecycle invariants, and modality-independent answers.
- `errors.ts` defines safe typed contract failures; error messages never embed
  submitted payload values.
- `assets.ts` defines bounded, opaque, provider-neutral asset references.
- `fixtures.ts` supplies representative event, state, transition, and
  spoken/tapped/typed, tool-result and future asset-answer fixtures.
- `specialist.ts` defines the canonical internal Specialist request, response,
  proposal, UI-instruction and validation boundary.
- `specialistFixtures.ts` supplies synthetic Health, Safety, completion,
  blocked, failure and proposed-action examples.
- `flowCatalogue.ts` defines the canonical versioned registry of supported
  Flows, subflows, capabilities and declarative policies.
- `flowCatalogueFixtures.ts` supplies representative catalogue entries and
  future-extension fixtures.

Later channel adapters may translate existing voice, canvas, touch, scheduler,
provider, caregiver, and operator signals into `InteractionEvent`. A future
flow-state service may validate transitions and use `normalizeAnswer` before
passing input to a flow or specialist. Those integrations are intentionally
outside Task 1: these files perform no persistence, routing, network calls, UI
updates, or other side effects.

## Expected inputs and answers

`ExpectedFlowInput` is a strict discriminated union on `answerKind`:

- `option` requires unique non-empty options;
- `free_text` allows only free-text constraints;
- `structured` declares its allowed structured modalities and an optional
  future domain-schema identifier;
- `measurement` requires a generic measurement descriptor and may constrain
  unit, minimum, maximum and precision;
- `tool_result` identifies an expected tool or result type;
- `image` and `document` declare accepted MIME types and optional size limits.

Cross-variant fields are rejected. Stale-answer protection requires
`questionId`, `sceneId`, and `flowVersion` to match the active expected input.

Answer kinds and submission modalities are not interchangeable:

| Answer kind | Allowed modalities |
|---|---|
| `option` | voice, touch, text |
| `free_text` | voice, text |
| `structured` | the explicit subset declared in `allowedModalities` |
| `measurement` | the explicit subset declared in `allowedModalities` |
| `tool_result` | tool |
| `image` | image |
| `document` | document |

`normalizeAnswer` rejects incompatible combinations before constructing the
normalized value. For example, a voice transcript cannot satisfy an image or
document question. Option answers always resolve to an allowed `answerId`;
non-option answers reject `answerId`.

## Typed failures

Public parsing and normalization functions throw `OrchestrationContractError`
with a stable `OrchestrationContractErrorCode`. Messages are fixed and contain
no submitted values. Zod remains the structural validator underneath this
typed boundary.

## Lifecycle invariants and transitions

`waiting_for_user` requires expected input, `waiting_for_tool` requires pending
tool metadata, and `interrupted` requires interrupted-state or resume metadata.
Only `waiting_for_user` may retain expected input. Idle state rejects active
Flow data, and terminal states reject expected input and pending tools.

Terminal Flow instances do not transition back to `idle`; a subsequent Flow is
a new instance. The approved recovery exception is `failed -> resuming`.
Approved useful extensions beyond the core happy-path diagram are:

- technical failure from `initializing`, `waiting_for_user`, `waiting_for_tool`
  or `resuming`;
- safety interruption while waiting for a tool;
- explicit expiry or cancellation while paused.

Every other transition is rejected with `INVALID_STATE_TRANSITION`.

## Event semantics and payloads

Event views use accurate intent-based names: `USER_INPUT_EVENT_TYPES`,
`FLOW_EVENT_TYPES`, `SAFETY_EVENT_TYPES`, `TOOL_EVENT_TYPES`,
`SCHEDULER_EVENT_TYPES`, `PROVIDER_OUTCOME_EVENT_TYPES`,
`PROACTIVE_USER_EVENT_TYPES`, `CAREGIVER_OPERATOR_EVENT_TYPES`, and
`ENGAGEMENT_EVENT_TYPES`.

These groupings are overlapping semantic views, not event ownership or exclusive
source partitions. Event `source` identifies who emitted the event,
`triggerSource` identifies what initiated the interaction or engagement, and
`channel` identifies where it occurred. Provider outcomes may be emitted by a
provider adapter or re-emitted by the VYVA system after provider normalization.

`EVENT_SEMANTIC_RULES` is the single registry for allowed source, modality,
trigger and any channel constraint per event type. `EVENT_PAYLOAD_SCHEMAS`
provides event-specific runtime payload validation for the initial high-value
events. Future events add a schema to that registry and a corresponding entry
to `InteractionEventPayloadMap`; unspecialized events retain the generic record
payload until hardened.

Push delivery outcomes accept provider or system sources, approved proactive
triggers, and push-compatible channels. Notification open/dismiss events require
a user/UI source and push trigger/channel. Outbound-call outcomes require
provider/system source, outbound-call trigger, and a telephone-compatible
channel. Scheduler due events require a scheduler/system source and schedule
trigger. Caregiver/operator check-in requests retain their matching requester
source and trigger. `NO_RESPONSE_DETECTED` represents observed absence, never a
user action.

`PROACTIVE_FLOW_DEFERRED` means the current proactive Flow was postponed and may
continue later. `PROACTIVE_FLOW_CANCELLED` ends only the current engagement or
Flow attempt. Cancellation does not revoke consent, delete a recurring schedule,
or prohibit a later separately authorized engagement; its strict payload has no
consent-revocation field.

Every event type has exactly one entry in `EVENT_SEMANTIC_RULES`; automated
completeness tests also ensure group and payload-registry entries reference only
known event types.

`FLOW_FAILED` is the event representation of entry into the `failed` lifecycle
state. Its payload records a non-sensitive reason code and whether recovery may
be considered.

## Asset references

Image and document answers contain opaque references (`assetId`, optional
`uploadId`, `contentType`, bounded file metadata, optional checksum and expiry).
They contain no binary data, local path or required URL. MIME family and
expected-input size limits are validated. Authorization, ownership, malware
scanning, storage lookup and expiry enforcement remain future runtime
responsibilities.

These contracts define architectural vocabulary only. They are not connected to
the Central Orchestrator or any production runtime, API, route, screen,
integration, workflow executor, database schema or migration.

## Specialist boundary

`SpecialistRequest` is the only approved input shape for a future Specialist.
It contains correlation and Flow identity, normalized input, only the memory
and domain context selected by the Central Orchestrator, deterministic safety
status, consent decisions, available Tool descriptors, current UI context and
channel metadata. Non-Safety Specialists require a completed deterministic
emergency check.

Specialist requests reuse the Task 1 trigger-source schema exactly:
`user`, `push`, `outbound_call`, `caregiver`, `operator`, `schedule`, or
`system`. No second Specialist trigger vocabulary exists. Event source identifies
who emitted an event, modality identifies how input was expressed, and trigger
source identifies what initiated the interaction; these concepts are distinct.

`userId` and `sessionId` are always required. `profileId` is optional only for
user-level Flows that have no selected household profile; profile-scoped Flows
must provide it when a future Central Orchestrator constructs the request.

`SpecialistResponse` is advisory. It can return an interpretation and response
guidance, a discriminated provider-neutral UI instruction, and proposals for
memory access, tools, Flow state, escalation or follow-up. It cannot speak,
persist, notify, call a provider or execute an action. Hidden reasoning,
credential-like fields, direct-execution fields and raw provider stacks are
rejected at the boundary.

`parseSpecialistRequest` and `parseSpecialistResponse` provide typed, safe
structural failures. `validateSpecialistResponse(request, response)` additionally
checks correlation, Specialist identity, status invariants, Tool availability,
confirmation, consent, idempotency, allowed risk, memory policy constraints,
escalation consent and Task 1 lifecycle transitions. The Central Orchestrator
will remain the authority that accepts or rejects every proposal.

A Flow update uses dedicated proposal fields. `nextLifecycleState` proposes the
lifecycle transition; `expectedInput` is reserved for `waiting_for_user`;
`pendingTool` is required for `waiting_for_tool` and reuses Task 1 metadata;
`resumeMetadata` and `completionReference` carry their corresponding lifecycle
data. Pending Tool metadata must correlate to an advertised Tool proposal. It
records pending work only and never means that a Tool was executed.

`domainStatePatch` contains only bounded Specialist-owned domain context. It
cannot replace a complete Flow state or contain canonical lifecycle, identity,
expected-input, pending-Tool, resume, completion, safety, consent, escalation or
audit fields, including when nested. Invalid patches are rejected, never
silently stripped. The Central Orchestrator alone may accept and apply these
proposals.

Specialists are internal bounded modules and are not necessarily ElevenLabs
agents, hosted model personas or provider integrations. They never independently
speak to the user. The Specialist proposes; the Central Orchestrator decides.

Memory reads include purpose, necessity, sensitivity ceiling and an optional
time range. Memory writes name a PostgreSQL, Mem0 or working-memory target and
remain proposals; sensitive/restricted proposals require confirmation at this
contract boundary, with fuller policy approval reserved for runtime. Tool
proposals must use an advertised Tool, cannot weaken confirmation or consent,
and must provide an idempotency key when required. Escalations and follow-ups
are likewise proposals and never notifications or schedules.

The UI instruction union intentionally starts with a small semantic vocabulary:
choice, scale, text, measurement, image/document upload, summary, confirmation,
progress and scene clearing. Channel Adapters will later translate these
instructions into voice, PWA, telephone, touch, caregiver or operator behavior;
no provider-specific command belongs in this contract.

Task 2 remains disconnected from runtime. Patch acceptance, Tool execution,
state persistence and delivery remain future Central Orchestrator
responsibilities.

## Canonical Flow catalogue

Task 3 adds the inert `VYVA_FLOW_CATALOGUE`. Task 1 defines interaction and
Flow-state contracts; Task 2 defines Specialist proposals; Task 3 defines which
Flows exist and the declarative policies that constrain them. The full registry,
versioning policy, current Flow/capability tables, visual and scam boundaries,
and extension procedure are documented in `docs/FLOW_CATALOGUE.md`.

Catalogue definitions directly reuse Task 1 triggers, modalities, lifecycle
states and expected-input kinds. They contain stable IDs and semantic versions,
one owning Specialist, structured references, safety/consent/evidence/memory
policies, semantic UI scenes, outcomes, follow-up, interruption, resumption and
compatibility metadata.

Capabilities are provider-neutral support contracts. They cannot start a Flow,
speak, diagnose, execute escalation, write memory or choose an outcome. The
catalogue contains no runtime functions, callbacks, provider instances or React
components and is not imported by production runtime code. A future Central
Orchestrator may interpret approved definitions; Specialists propose and the
Central Orchestrator decides.

Catalogue validation is policy-driven rather than keyed to particular Flow IDs.
Any definition declaring a `push` or `outbound_call` trigger must also declare
the matching Channel, capability and consent requirement. Caregiver- and
operator-owned definitions must declare their corresponding initiator trigger.
Scene IDs and outcome IDs are unique within a Flow; required and optional Tool
sets are individually unique and disjoint; and terminal outcomes cannot point
directly to another scene or Flow.

Extension metadata is bounded, plain JSON data only. Credential-like keys,
provider clients, class instances, executable values and React implementations
are rejected at any nesting level. Trust outcomes use the explicit
`likely_scam`, `suspicious`, `insufficient_evidence` or
`no_obvious_indicators` classification vocabulary. The last classification is
not a guarantee of safety, and guaranteed-safe Trust outcomes are invalid.
