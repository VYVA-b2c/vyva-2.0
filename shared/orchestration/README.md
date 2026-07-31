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
