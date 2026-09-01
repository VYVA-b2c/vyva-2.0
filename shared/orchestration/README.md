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
- `presentationRegistry.ts` defines inert, versioned Presentation Families and
  Flow-scene-bound Presentation Definitions.
- `presentationRegistryFixtures.ts` supplies representative presentation,
  interruption, resume, evidence, emergency and telephone-only fixtures.
- `orchestratorPolicy.ts` defines the inert Central Orchestrator policy request,
  precedence, findings, adjudication, authorization, decision and audit
  contracts.
- `orchestratorPolicyFixtures.ts` supplies synthetic Preventive Health,
  Presentation, request-more-information, Tool and rejection scenarios.

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

## Canonical Presentation Registry

Task 3.5 adds the inert `VYVA_PRESENTATION_REGISTRY`. It defines versioned,
provider-neutral presentation families and Flow-scene-bound definitions. Task 1
remains the source of interaction events and expected inputs; Task 2 remains
the source of semantic UI instructions; Task 3 remains the source of Flow,
scene, Channel and capability truth.

Definitions describe localized content slots, semantic actions, Task 1 event
mappings, voice/screen synchronization, visual intent, accessibility,
localization, privacy, safety, device compatibility, fallbacks and design
references. Spoken, tapped and typed choices resolve to the same canonical
option set. Every expected input requires actions, an answer-producing mapping,
explicit passive-vs-action ownership and current question/scene/Flow-version
correlation. Payload mappings and normalized-answer intents are strict,
answer-kind-discriminated, declarative and bounded.

Task 3.5 directly reuses Task 1 expected-input and event semantics, Task 2 UI
instruction types (including `clear_scene`), and Task 3 Flow/scene/Channel
truth. It does not directly parse Task 1 asset-reference objects: it declares
image/document expected input and asset-field mapping policy, while Task 1 and
future runtime handling govern actual uploaded references.

Presentation metadata is recursively checked after keys are normalized by
lowercasing and removing non-alphanumeric separators. Exact reserved keys reject
hidden reasoning, clinical or Trust decisions, execution directives,
credentials and generic tokens, authorization headers, live adapters and
provider clients. This is not a substring ban: declarative fields such as
`adapterPolicy`, `tokenPolicy`, `migrationAdapterId`, `providerNeutral` and
`runtimeResponsibility` remain valid.

Fallbacks must share a Flow, bind their scene within that shared Flow, preserve
answer-kind compatibility unless explicitly noninteractive, share a
Channel/device path, preserve every compared privacy and safety policy, and
remain acyclic. Deprecated and retired Families and Definitions cannot be
current. Voice aliases are locale-neutral; voice-enabled options require
complete bounded aliases or an explicit canonical-localized-label fallback.

Telephone-only definitions reject touch, capture, upload, keyboard, visual UI
instructions, screen-required slots and captions, and require spoken,
repeatable, voice-compatible interaction. Preventive Health interruption,
resume, restored progress and scene cleanup are represented. Medication
outbound call, Emergency telephone-only delivery and Notification Resume
push-to-voice remain explicitly deferred until their frozen Task 3 Flows add
the required Channel/trigger/scene semantics.

`parsePresentationRegistry` and `validatePresentationEventMapping` expose typed
fixed-message failures. Direct low-level Zod schemas may return Zod errors when
used for schema composition.

The registry contains no React components, callbacks, Tool execution, memory
writes, provider payloads or voice-provider IDs. It is not imported by
production runtime code. A later approved integration may allow the Central
Orchestrator and Channel Adapters to interpret it. The model, initial families,
reference experiences and extension procedure are documented in
`docs/PRESENTATION_REGISTRY.md`.

## Central Orchestrator policy boundary

Task 4 defines the canonical inert, request-aware Central Orchestrator policy
validation contracts above Tasks 1–3.5.
`parseOrchestratorPolicyEvaluationRequest` validates the event, active Flow,
canonical references and current safety, consent, Channel, device, memory,
Tool, escalation and audit contexts. `parseOrchestratorPolicyDecision`
validates the declarative result. `validateOrchestratorPolicyDecision` verifies
that the proposed result is legal for that exact request; it never determines
the result itself.

Policy stages cover ingress, Specialist invocation/response, proposal
adjudication, Presentation and delivery approval, and safe failure.
Deterministic safety has highest precedence, followed by consent/privacy,
correlation and catalogue eligibility. Findings are safe policy facts, not
hidden reasoning. Constraints may only narrow authority.

Hardening makes approval bidirectional: every supplied plan has exactly one
compatible adjudication and every approving adjudication has a real plan,
source and finding. A closed verdict matrix prevents reject, defer, escalate
and safe-fail from retaining incompatible routine approvals. Reject requires
exactly one finding-backed `reject` adjudication for every actionable proposal
across all eleven subject types; defer plans reference deferred adjudications or
the system-owned routine-deferral directive. Nested
safe-failure Flow updates use the normal request-aware Flow validator.

Before-action consent covers Tools, evidence capture/retention, longitudinal
comparison, memory/Mem0, disclosure, proactive delivery and outbound calls.
Capture does not grant image retention, longitudinal comparison is separate,
and clinician disclosure is request-source-target- and Channel-specific.
Medication instructions resolve only from bounded request-authoritative
instruction and issuer/source records; findings cannot manufacture provenance.
Retention classification is a mandatory, strict, bounded request registry.
Every relevant approved or confirmation-gated Tool, memory-write and evidence
UI/Presentation subject resolves to exactly one source-bound descriptor;
duplicates, unknown subjects and omissions fail. Descriptors declare evidence
type, transient/retained/longitudinal processing, target, purpose, consent
scope, notice, retention class and optional source references. Rejected
proposals require no descriptor, and working-memory transient processing does
not imply persistent retention.
Escalation, follow-up no-response behavior, interruption, resume, explicit Flow
switch and emergency preemption are checked against Task 3. Presentation
approval is fixed to the active Channel/device/locale unless an inert,
finding-backed switch authorization proves exact from/to values and applicable
consent. Privacy/safety and voice/UI decisions cannot weaken Task 3.5;
`interruptSpeechOnSubmit` is exact and required visual slots cannot disappear.
Response facts,
slots and localization keys must resolve; Tool schema/correlation and the
one-pending-Tool limit are enforced; audit metadata excludes raw sensitive
content, sensitive neutral-key values and exact normalized token keys.
Medication instructions require care-plan provenance, an allowing policy
finding and a disclaimer, with bounded directive-pattern defense in depth.
Visual-health and Trust evidence limitations, and escalation language when a
response accompanies escalation, require one-for-one policy finding/source
traces.
Tool Channel constraints are rejected because frozen Tool descriptors declare
no Channel authority. Resume proof binds Flow/version, time and safety result.
Active audit correlations include the current event, event correlation,
evaluation and session references. Policy precedence is absolute; unused
override declarations were removed.

The validator optionally accepts a Flow catalogue snapshot only after Task 3
validation. All current canonical 90 Flows deny memory. The seam supports
contract tests and immutable future snapshots; production-positive memory
authorization requires an additive Task 3 revision. Public parsers return typed
fixed-message errors, while low-level schemas remain composition primitives.

Tool, memory, escalation, Flow update, follow-up, Presentation and system
directive approvals are explicitly non-executable. An approval is not a Tool
result, memory write, sent notification, scheduled job, mutated Flow, rendered
screen or spoken response. Audit records are declarative and are not persisted.

The full contract, responsibility table, precedence, authorization rules,
security boundary and extension procedure are documented in
`docs/ORCHESTRATOR_POLICY_CONTRACTS.md`. Task 4 remains unimported by production
runtime code.

Ordinary Presentation delivery remains on the active scene. Direct tests use a
canonical Flow with multiple individually valid scenes to distinguish an
invalid ordinary A-to-B delivery, an approved A-to-B destination and a
different-valid-scene mismatch. A next scene
requires matching approved next-question and Flow-update proposals; a
cross-Flow destination requires an explicit non-executable Flow-switch
authorization. Direct self-reference is rejected for every reference form the
Task 4 schema directly represents, without claiming general graph traversal.
Audit minimization rejects deterministic labeled financial values before
opaque-ID allowance. Financial and medication checks are bounded safeguards,
not comprehensive moderation.

Compatibility catalogues remain descriptive production data. Literal
test-owned expectations and complete request/decision scenarios exercise all
35 verdict/adjudication and all 49 stage/verdict pairs through the public
request-aware validator. Unreachable ingress and pre-response verdicts are
excluded rather than advertised as valid. Concrete rejection coverage spans all eleven
subject types and tests omission plus every non-reject adjudication. Resume,
finite-bound and representable direct-self-reference cases are tested
directly; Task 4 does not claim general graph-cycle traversal.

Consent and escalation authorization have separate independent behavioral
proof. A literal 144-entry consent table covers 18 areas by 8 dimensions; 127
applicable cases execute through both public parsers and the request-aware
validator (18 pass and 109 fail), while 17 non-applicable pairs state why the dimension has no
contract meaning. A literal 70-entry escalation table covers all five types by
14 dimensions; 55 applicable cases execute through the same boundary (7 pass
and 48 fail) and 15
non-applicable pairs are explicit. Request-side scope, purpose, status, expiry,
Channel, disclosure target and emergency-exception records are authoritative.
Emergency exceptions identify an exact critical deterministic-safety finding,
require the current deterministic result value to be `emergency`, use the
active audit-session ID, and require that finding in the supplied decision
audit record; matching only the current result ID is insufficient. Critical
safety handling accepts either a direct `emergency` authorization or a
fully correlated `clinician` authorization with a structured emergency basis.
Ordinary clinician escalation remains separately consent-, purpose-, target-
and Channel-bound. A clinician exception cannot create persistent consent or
future disclosure authority, remains `nonExecutable: true`, and does not
deliver escalation.
Follow-up primary and fallback Channels require consent coverage. Escalation
must correlate its Specialist proposal, Flow rule, target, Channel, consent,
active escalation and safety basis where applicable. Catalogue cardinality
alone is not authorization evidence.

## Orchestrator compatibility boundary

Task 5 defines inert contracts between six current legacy seams and a future
Central Orchestrator integration. It reuses frozen Task 1 event/Flow-state,
Task 3/3.5 catalogue and Task 4 policy contracts without importing legacy
implementations.

Registry V1 requires exactly the six canonical seams at their supported
versions. The boundary models minimized input/output snapshots, facade
requests and decisions, non-executable adapter plans, authority
non-broadening, observed legacy effects, shadow comparison, parity, synthetic
golden cases, evidence, supplied feature-flag state, rollback recommendations,
safe failure and observability.

`legacy_only` is the default. `shadow_compare` fixes delivery authority to the
legacy handler and rejects adapter delivery. Observed legacy session writes and
browser events can be recorded without authorizing Task 5 to repeat them.
`candidate_delivery` and `authoritative` are forward-compatible vocabulary and
cannot become effective through any public parser in this contract version.

The duplicated Task 1 event and Flow state must be fully identical after
canonical parsing. A strict comparator registry, comparison-policy registry,
closed seven-dimension parity matrix, closed versioned policy-difference
authority matrix and present structured `sha256` digests govern comparison.
The current `LEGACY_FORMAT_ONLY` exception applies only to a response and
requires the exact allowed Task 4 response-guidance finding, adjudication,
subject and approved response plan. Its response evidence must bind the
observed legacy-output digest and its required `sha256`/canonicalization
`1.0.0` provenance to the response comparison, bind the canonical
digest/reference to the same request and Task 4 decision, and preserve
required disclaimers, prohibited claims, medication references and explicit
safety/consent/privacy/emergency invariants. Task 5 validates supplied digest
correlation and does not compute digests. Evidence resolves exact frozen
versions and contains every registered golden invariant exactly once.
Snapshot age is bounded by the resolved policy.

Adapter source authority must narrow the exact Task 4 subject and
adjudication; every effect must narrow that plan, resolve its source plan and
preserve Flow version, Presentation safety/privacy, Tool details, escalation
Channel and seam-specific browser-event capability. Tool details include the
exact risk level of the Task 4 request's authorized Tool proposal. That exact
risk is mandatory for every Tool adapter plan, including plans with no
effects; omitted, transformed, cross-Tool or cross-request risk fails. Provider
and execution authority remain false. Feature flags bind to current parity;
deterministic safe-failure classifications have one fixed public error each.
Low-level schemas are structural only; request-bound decisions require
`validateCompatibilityDecisionForRequest`. Audit metadata excludes raw
sensitive content, credentials, provider payloads, clients, executable
endpoints/URLs, connection destinations and hidden reasoning while permitting
inert declarative policy/reference fields. Bounded high-confidence
JWT/API/access/private-key/authorization patterns are rejected under neutral
keys as deterministic defense in depth, not comprehensive secret scanning.
JWT-like values are detected structurally as exactly three bounded non-empty
base64url segments; short dotted semantic IDs and reason/version values remain
valid. Safe opaque references and ordinary token-policy prose remain valid,
and errors never echo detected values.
`sourcePathReference` is valid only in the dedicated legacy-seam descriptor as
a repository-relative inert path and is prohibited in generic metadata.

Task 5 does not route traffic, turn on flags, execute adapters, change session
behavior, replace a legacy handler, persist, render, schedule or deliver.
Production integration requires a separate reviewed milestone. See
`docs/ORCHESTRATOR_COMPATIBILITY_BOUNDARY.md`.
