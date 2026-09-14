# Central Orchestrator Policy Contracts

## Purpose and boundary

Task 4 defines the inert, typed policy boundary through which a future Central
Orchestrator can evaluate events, Specialist proposals, Flow updates,
Presentations, consent, safety, Tools, memory, escalation and follow-up. It
defines what a legal evaluation request and a legal decision look like. It does
not choose a decision, execute an approved proposal, mutate state, persist an
audit record, render UI, speak, schedule work, or call any provider.

The contracts reuse the frozen sources of truth:

- Task 1 supplies `InteractionEvent`, `FlowState`, lifecycle transitions and
  expected input.
- Task 2 supplies Specialist requests, responses and proposal schemas.
- Task 3 supplies canonical Flow definitions and policy declarations.
- Task 3.5 supplies canonical Presentation definitions and synchronization
  policy.

`parseOrchestratorPolicyEvaluationRequest` and
`parseOrchestratorPolicyDecision` enforce strict structural boundaries.
`validateOrchestratorPolicyDecision(request, decision)` checks whether a
proposed decision is legal for that particular request. It does not calculate
the decision. Public parsers return fixed typed contract errors; exported
low-level Zod schemas remain composition primitives and may return `ZodError`.

## Responsibilities

| Layer | Responsibility |
|---|---|
| Specialist | Analyzes bounded domain context and returns structured proposals. It does not execute or independently speak. |
| Central Orchestrator policy layer | Approves, constrains, rejects, defers or escalates; preserves safety, consent and correlation precedence; selects an eligible Presentation; and authorizes future adapter work. It does not execute in Task 4. |
| Flow Catalogue | Defines which versioned Flows exist and their eligible triggers, Channels, safety, consent, Tool, memory, lifecycle, escalation and follow-up policy. |
| Presentation Registry | Defines eligible versioned Presentation, scene, input, accessibility, privacy, safety and voice/UI synchronization policy. |
| Future runtime adapters | May execute only a later runtime instruction that remains within an approved decision. They must never broaden policy authority. |

## Policy stages

The `stage` discriminant constrains the available context:

| Stage | Intended validation |
|---|---|
| `ingress` | Event, identity, Flow, safety, Channel and before-entry consent |
| `specialist_invocation` | Owner Specialist and bounded invocation context |
| `specialist_response` | Frozen Task 2 response and request correlation |
| `proposal_adjudication` | Specialist proposal approvals, constraints, rejection or deferral |
| `presentation_approval` | Task 3.5 candidate and synchronized Presentation plan |
| `delivery_approval` | Final structured response and voice/UI plan before future delivery |
| `safe_failure` | Safe, explicit, non-executing recovery or fallback |

Specialist invocation requires a Specialist request. Specialist response and
proposal adjudication require both request and response. Presentation and
delivery approval require at least one candidate. These are contract-stage
rules, not stage-specific services.

At `specialist_invocation`, the inert authorization result is one of
`approved`, `approved_with_reduced_context`,
`additional_consent_required`, `denied` or
`safety_specialist_required`. Owner, safety, memory, Tool, evidence asset,
scene and Channel context are checked. Reduced authorization names the opaque
memory/evidence/context references to exclude; it does not call a Specialist.

## Request, correlation and eligibility

The evaluation request carries opaque evaluation, user, profile, session,
event, Flow, safety, consent and audit identities plus policy contexts for the
active Channel, device, memory, Tools and escalation. `profileId` may be absent
only when the selected Flow does not require an active profile.

All supplied identities remain correlated. A stale Flow version, question,
scene, Specialist request, Presentation reference or previous decision is
rejected; the validator never repairs or invents a replacement. New sessions
may select only a current `approved`, `pilot` or `active` Flow version. Retired
Flows are ineligible. Trigger and Channel policy comes from the Flow Catalogue.

## Precedence and findings

`ORCHESTRATOR_POLICY_PRECEDENCE` is an ordered declarative registry. Its order
is:

1. deterministic safety;
2. consent and privacy;
3. correlation;
4. Flow eligibility;
5. Specialist validity;
6. escalation;
7. Tool;
8. memory;
9. Flow update;
10. follow-up;
11. Presentation;
12. response composition;
13. audit;
14. safe fallback.

Policy definitions contain stable IDs, deterministic unique priorities,
applicable stages, effects and audit requirements. They
contain no predicates, callbacks or executable conditions. Emergency safety is
highest precedence. Revoked consent, privacy restrictions and stale
correlation cannot be weakened by Specialist confidence or a lower-priority
approval. The current registry has no legitimate override case, so precedence
is absolute and the unused `overridable` vocabulary is intentionally absent.

Findings are bounded policy facts with stable reason codes and safe summaries.
They are not chain-of-thought and must not contain raw submitted values,
provider errors, credentials or stacks. A finding must reference a registered
policy and, when proposal-specific, a real subject.

## Verdicts, adjudications and constraints

The only verdicts are `approve`, `approve_with_constraints`,
`request_more_information`, `defer`, `reject`, `escalate` and `safe_fail`.
Exported verdict and stage/verdict compatibility tables are independent,
declarative review artefacts; they do not execute work.
Tests keep literal expectations separate from those production catalogues and
exercise complete requests and decisions through the public request-aware
validator. The suite directly exercises all 35 verdict/adjudication pairs and
all 49 stage/verdict pairs. It excludes unreachable combinations: ingress
cannot escalate without a Task 2 escalation proposal, and Specialist
invocation cannot defer, escalate or approve with proposal constraints before
a Specialist response exists. Each verdict has request-aware invariants. For example,
request-more-information needs
an approved question, `waiting_for_user` proposal and compatible Presentation;
escalate needs declarative escalation authorization; and safe-fail cannot carry
ordinary approved execution proposals.

The verdict matrix is closed. `approve` contains full approvals;
`approve_with_constraints` contains referenced narrowing constraints;
`request_more_information` contains its question, waiting state, Presentation
and any supplied UI/response guidance; `defer` identifies at least one deferred
adjudication or policy-owned `defer_routine_proposals` directive and has no
immediate safety action; `reject` contains no approved routine plan and exactly
one finding-backed `reject` adjudication for every actionable proposal across
all eleven subject types; `escalate` has no
conflicting routine approval; and `safe_fail` contains only safe
fallback/recovery data, plus explicit defer/reject adjudications where
applicable. Reject cannot retain an approved Flow update,
completion, follow-up, escalation, Presentation, response, Tool, memory
operation, question or UI instruction.
All eleven subject types are also constructed as concrete proposals in tests:
each complete rejection passes, omission of the target adjudication fails, and
changing it to approve, approve-with-constraints, confirmation or defer fails.

Adjudications resolve only real Task 2 subjects or candidate Presentations:
response guidance, questions, UI instructions, memory reads/writes, Tool calls,
escalations, Flow updates, completion and follow-up. A decision may approve,
approve with constraints, require confirmation, reject or defer a subject.

Validation is bidirectional: every supplied approved plan resolves to exactly
one compatible adjudication with findings, and every approving adjudication
resolves back to a supplied plan. Removing either invalidates the decision.

Constraints are strict data. They may require confirmation, consent, a fresh
safety check, current correlation, human review, accessibility/privacy
fallback, idempotency or a safe Presentation; restrict Channel, memory target
or retention; redact argument paths; prohibit claims; require disclaimers; or
block optional proposals. They narrow authority only. They cannot introduce a
Tool, expand Channel access, increase retention, reduce consent/confirmation,
or execute a transformation.

## Safety and consent

A deterministic emergency check is required for non-Safety Flows.
Deterministic emergency status cannot be downgraded by Specialist risk.
Routine Tool, memory, follow-up and ordinary Presentation approvals cannot
override emergency handling. Emergency authorization remains declarative and
does not contact emergency services.

Required before-entry Flow consent must have a current granted decision for the
same scope. Revocation wins over prior approval. Consent authorizations
reference scope, decision, basis, purpose, expiry and revalidation where
applicable. Push, outbound-call, evidence capture/retention, longitudinal
comparison, memory, Mem0, external Tool and caregiver/operator/clinician
disclosure each remain separate permissions. An emergency exception must be
explicit; it does
not silently grant unrelated disclosure. Before-action authorization resolves
the exact source decision, purpose, status, expiry, revocation and permitted
Channel. Emergency exceptions additionally require the actual deterministic
safety result value `emergency`, the exact current result ID, a critical
deterministic-safety finding and an audit reference; result-ID correlation or
risk level alone is insufficient. The finding must be present in the decision
and its audit record, and the reference must match the active audit session.

Critical emergency handling has exactly two compatible escalation forms:

- direct emergency authorization with type `emergency`; or
- clinician emergency-exception authorization with type `clinician`, a
  structured exception basis, an explicitly source-authorized emergency
  clinical target, an authorized Channel and complete finding/audit
  correlation.

Ordinary clinician escalation remains distinct and requires current
clinician-disclosure consent. The exception does not create or revive
persistent consent, authorize another target or Channel, or grant
caregiver/operator disclosure. Both authorization forms remain
`nonExecutable: true`; Task 4 does not deliver escalation.

Image capture never implies retention. Image analysis, image retention,
document capture, document retention and longitudinal comparison are separate
purposes. Retention classification is a required, bounded request registry.
Every approved or confirmation-gated Tool proposal and memory write, and every
approved or confirmation-gated evidence UI/Presentation action, must resolve
to exactly one strict descriptor. It binds subject type and ID and declares
evidence type, processing mode, target, purpose, consent scope, notice,
retention class, optional expiry, capability and Tool references, and bounded
metadata. Duplicate, unknown, mismatched and omitted required descriptors are
rejected. Tool classification binds explicit proposal and available-Tool
identity; it is not inferred from Tool names. Rejected proposals do not
require descriptors. Working-memory transient processing does not imply
persistent retention; PostgreSQL, Mem0 and external retention require consent
and notice. Longitudinal use requires its own authorization. Clinician disclosure resolves
to a request-side consent source whose purpose, Channel, status and specific
clinician, approved care-team member or emergency clinical service match.
Decision-side authorization cannot invent the target.

## Tool, memory, escalation and follow-up authorization

An approved Tool proposal must exist in the Specialist response, be available
in the request, be Flow-declared or allowed by the registered narrow
outside-Flow policy,
remain within risk and consent limits, preserve confirmation, and carry
idempotency when required. Input schema, result, pending request and Tool IDs
must match. Only one Tool may enter `waiting_for_tool`; an existing pending Tool
blocks a conflicting approval. Authorization has `nonExecutable: true`: an
approved Tool call is not a Tool result.

`restrict_channel` is subject-specific. It may constrain Presentations,
follow-ups and escalations only against their own declared Channel authority.
The current frozen Tool descriptor declares no Channel capability, so a Tool
adjudication carrying `restrict_channel` is rejected; the active user Channel
does not grant Tool Channel authority.

Memory authorization correlates each indexed read/write proposal, category,
sensitivity, target and retention against the request and Flow policy. Mem0
requires explicit request and consent authorization. Sensitive writes cannot
silently avoid confirmation. No persistence occurs.

All current canonical 90 Flows deny memory reads and writes, so default Task 4
validation denies them. An optional catalogue snapshot is accepted only after
Task 3 `parseFlowCatalogue` validation. This inert seam supports contract tests
and future version snapshots; it is not a mutable global, provider lookup or
service container. Production-positive memory authorization requires a later
additive Task 3 catalogue revision.

Escalation authorization intersects request context with the active Flow's
canonical `escalationRules`. It preserves type, represented reason/safety
check, urgency, target, disclosure consent, recommended Channel and
duplicate-active-escalation policy. An approved
escalation is not a sent notification, call or message.

Follow-up authorization preserves catalogue mode, purpose, one timing
mechanism, delay window, Channel and explicit consent authorization. Its
no-response decision preserves retry, fallback, escalation, bounded attempts
and required human review. An
approved follow-up is not a scheduled job.

## Flow-state authorization

The policy layer reuses Task 1 transitions and Task 2 Flow-update proposals.
It validates Flow/version binding, current state, waiting-for-user expected
input, waiting-for-Tool metadata, terminal invariants and canonical completion
outcomes. The decision contains a proposal approval; it does not mutate a
runtime Flow state.

Ordinary and safe-failure nested Flow updates use the same request-aware
validator. It checks Flow/version, transitions, current state, expected input,
pending Tool, interruption/resume metadata, protected domain patches, terminal
invariants and canonical completion outcomes. Safe failure cannot silently
reset or substitute a Flow.

Optional Flow-operation context represents interruption, resume, explicit
switch and emergency preemption without executing them. It consults
`mayInterrupt`, `mayBeInterrupted`, `mayResume`, expiry, revalidation, fresh
safety-check, Channel-switch and preemption policy while reusing Task 1's
lifecycle. When `revalidateOnResume` is true, a bounded proof must identify the
same Flow/version and current deterministic safety result and must be
timestamped after interruption and no later than the policy request. The
contract validates proof; it does not perform revalidation.
Direct tests cover a valid proof, missing proof, wrong Flow/version, timestamps
before interruption or after the request, stale or mismatched safety evidence,
missing fresh safety proof, prohibited and permitted Channel changes, and an
expired interruption.

## Presentation and voice/UI approval

Presentation candidates are opaque references resolved against Task 3.5.
Ordinary delivery must use the current active scene. Direct repository tests
use the canonical multi-scene Trust Flow to prove that two scenes can each be
valid while an unapproved A-to-B transition still fails with the specific
scene-transition error. A different scene in the
same Flow requires matching, approvingly adjudicated next-question and Flow
update proposals. A cross-Flow destination requires an explicit non-executable
Flow-switch authorization matching the request-side switch operation, target
Flow/version/scene, eligible Presentation and approvals. No silent switch is
accepted. Approval otherwise preserves Flow, version, scene, expected input, semantic UI
instructions, action/event mapping IDs, content slots, Channel, device, locale,
accessibility, privacy, safety and fallback policy.

Approval is bound by default to the request's active Channel, device class and
locale. A difference is legal only through one inert
`deliveryContextSwitchAuthorization` that names exact from/to values, the
Flow/version, scene, registered source policy, findings and, for a Channel
change, destination-specific consent. Presentation support alone is not switch
authority.

Approved privacy and safety snapshots are compared field by field with the
canonical Presentation. Sensitivity, screen/app-switcher protection,
screenshot, recording, evidence preview, clearing, notices, visibility and
every safety treatment may be preserved or strengthened, never weakened.

Voice and screen refer to the same canonical Presentation and option set.
Spoken, touched and typed answers therefore remain capable of producing the
same Task 1 normalized answer. Screen speech preserves captions, canonical
content slots, acknowledgement, repetition, timeout, timing, fallback,
barge-in and submit-interruption limits. `interruptSpeechOnSubmit` is exact
canonical equality. Spoken slots are exact; every required visual slot remains
visible, while omission is allowed only for slots whose canonical
`visualPolicy` is not `required`. Provider voice IDs and
speech execution are not part of the contract. An approved Presentation is not
rendered UI.

## Response composition

The approved response plan contains traceable facts, acknowledgements, tone,
urgency, brevity, prohibited claims, required disclaimers, localization keys,
content-slot assignments, uncertainty language, evidence limits and escalation
language. It preserves Specialist and Presentation restrictions. It is neither
final prose nor hidden reasoning. Every fact resolves to a Specialist fact,
deterministic safety result, canonical Flow description/outcome or approved
safe-failure code. Acknowledgements, slots, facts and localization keys resolve;
untraceable diagnosis, medication advice and guaranteed-safe wording do not.
Visual-health and Trust responses with canonical evidence requirements must
state an evidence limitation. Evidence limitations and escalation-language
requirements carry response-policy finding and source references; supplied
text and references must match one-for-one. An approved escalation paired with
a response plan cannot omit its traced escalation language.

Medication facts use explicit classifications. Reminders, identity and
adherence facts remain informational. A medication or approved-care-plan
instruction resolves to a bounded request-side approved instruction and active
issuer/source record. User/profile, medication, validity, consent, exact
authorized wording, structured dose/unit, finding reference and
`disclaimer.medication.care_plan` must agree. Findings may permit use but
cannot create provenance. Bounded phrase
guards reject clear dose, start/stop/skip/double/combine/substitute and
suitability directives without that provenance. These patterns are
defense-in-depth, not general medical-language moderation.

## System directives, safe failure and audit

System-owned directives are restricted to safety escalation/checking, current
state refresh, consent confirmation, safe Presentation, routine-proposal
deferral, stale-submission invalidation, human review and safe failure. Every
directive is policy-referenced and `nonExecutable: true`.

Safe failure uses fixed codes, an explicit retry policy and a compatible
Presentation or voice fallback. It cannot contain a provider stack, raw
submitted content, credentials, silent Flow reset or stale-correlation rewrite.
Emergency failure preserves safety escalation.

Every decision contains an exact audit record correlating the evaluation,
decision, policy version/stage, user/session, Flow/version, optional Specialist
and Presentation references, findings, adjudications, constraints, directives,
consent and safety result. Active audit correlation must include the current
event ID, event correlation ID, evaluation ID, session ID and supplied previous
decision ID. It is bounded declarative data. An audit record is
not persisted in Task 4. The deterministic reference graph covers findings,
adjudications, constraints, consent, directives, plans, recovery and previous
decisions. Enforced cycle guarantees are deliberately narrow: directives,
constraints and adjudications reject representable direct self-reference;
global decision-owned IDs are unique; the current decision cannot be its own previous
or recovery decision, and referenced previous/recovery decisions must already
exist in the active audit context. The contract does not claim arbitrary graph
traversal.
Collection tests exercise both the exact limit and one-over-limit for every
represented bounded request/decision collection. Escalation authorization is
singular; strict decision parsing rejects an attempted second field.

## Independent consent and escalation verification

Production compatibility catalogues describe contract vocabulary; their size
is not treated as behavioral proof. Test-owned literal expectations separately
declare all 144 consent area/dimension pairs (18 areas by 8 dimensions) and all
70 escalation type/dimension pairs (5 types by 14 dimensions). Each entry is
explicitly `pass`, `fail` or `not_applicable`; every non-applicable entry has a
bounded architectural reason. The 127 applicable consent cases (18 pass and
109 fail) and 55 applicable escalation cases (7 pass and 48 fail) pass through
the public request parser, public decision parser and request-aware validator.

Request consent records are authoritative for scope, purpose, active/revoked
status, expiry, permitted Channel, permitted disclosure target and emergency
exception basis. An emergency exception requires the actual deterministic
result value `emergency` and must identify the exact audited
deterministic-safety finding for the current result ID. Its audit reference
must equal the request's active audit-session ID, and the finding must also be
included in the supplied decision audit record. Result-ID correlation alone
is insufficient, and a decision cannot invent or revive that authority. Follow-up
consent covers the primary and every required fallback Channel. Escalation
correlates the Task 2 proposal, Task 3 Flow rule, target, Channel, consent,
active-escalation identity and deterministic safety finding where applicable.
The frozen Task 3 catalogue represents non-disclosing technical handling with
its `operator` rule; Task 4 maps the `technical` proposal type to that rule
without granting operator disclosure authority. All authorizations remain
`nonExecutable: true`.

## Security

Metadata is bounded plain JSON. Recursive case-insensitive normalized-key
checks reject credentials, tokens, authorization headers, provider clients,
adapters, callbacks, endpoints, free-form URLs, hidden reasoning, diagnosis or
fraud decisions, raw provider errors, stacks, execution, memory writes,
scheduling, event emission, escalation execution and runtime components.
Audit metadata additionally rejects raw messages, transcripts, images, binary
or base64 content, Tool arguments, provider payloads/responses, document
contents and financial/card/account details, including nested arrays. Neutral
keys do not bypass value inspection: case-insensitive labeled account, card,
routing, sort-code and wallet-account values are rejected before generic
opaque-ID allowance, including in nested objects and arrays; architecture
identifiers such as `accountPolicy` remain valid. Luhn-valid card values, IBAN-like values,
data URIs, long base64-like values, binary controls and generic
natural-language metadata strings are rejected. Generic audit strings are
restricted to timestamps, semantic IDs, reason codes, versions and opaque
references; human text belongs in dedicated bounded summary fields. Exact
normalized token keys are denied, while `tokenPolicy`, `tokenRequired` and
`tokenReferenceType` remain legal declarations.
Invalid values are rejected, never stripped. Public failures use
`OrchestrationContractError` with fixed messages.

## Extension procedure

To add a future policy:

1. Choose a stable policy ID.
2. Assign its category and unique precedence.
3. Define applicable stages.
4. Define its allowed effect.
5. Define safe findings and reason codes.
6. Define which proposal subjects it may constrain.
8. Define audit requirements.
9. Add synthetic fixtures and positive/negative tests.
10. Obtain architecture approval.

Adding policy data must not add runtime behavior, provider code or an execution
path.

Medication phrase and audit-value checks are restrained deterministic
safeguards, not comprehensive medical or financial moderation. The contract
does not claim general multi-hop graph-cycle traversal.

## Runtime isolation

Task 4 is disconnected from production runtime code. No route, API, database
schema, migration, React screen, voice provider, AI provider, memory provider,
service worker, scheduler, escalation adapter or Tool adapter imports these
contracts. Runtime integration requires a separately approved task.
