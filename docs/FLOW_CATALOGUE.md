# VYVA Flow catalogue

## Purpose and authority

`shared/orchestration/flowCatalogue.ts` is the canonical, versioned source of
truth for which VYVA Flows and reusable capabilities exist and which declarative
policies constrain them. It is an architecture contract, not a runtime router
or implementation.

- Task 1 defines interaction events, answers and Flow lifecycle state.
- Task 2 defines the internal Specialist proposal boundary.
- Task 3 defines supported Flows, capabilities and declarative policy.
- A future Central Orchestrator may interpret approved definitions.
- Specialists propose; the Central Orchestrator decides.
- Capabilities support Flows but never own conversations.

The catalogue performs no routing, persistence, provider calls, consent
evaluation, Tool execution, memory access, scheduling or UI rendering.

## Flow, subflow and capability

A **Flow** is a versioned user journey with one owning Specialist, explicit
entry conditions, lifecycle policy, inputs, outcomes and safety boundaries.

A **subflow** is also a Flow definition. It has a stable ID, version and owner,
and participates in coherent `parentFlowId`/`subflowIds` references. Visual
Health assessments are assessment subflows of `health.symptom_assessment`.

A **capability** is a provider-neutral reusable building block. A capability
cannot start a Flow, speak, diagnose, choose an outcome, write memory, execute
escalation or otherwise control a conversation.

Catalogue hierarchy does not imply a runtime Domain Supervisor. Preventive
Health remains directly owned by `preventive_health`. A Health or Visual Health
Domain Supervisor may be considered later only after multiple substantial
implementations demonstrate real domain-local coordination needs.

## Stable IDs and versions

Flow and capability IDs use lowercase dotted namespaces and remain stable across
compatible revisions. Display wording may change without changing the ID.
Versions use semantic versioning:

- wording or non-semantic metadata corrections normally use a patch version;
- compatible optional policy or presentation additions normally use a minor
  version;
- changed required inputs, outcomes, safety rules or persisted state may require
  a major version;
- active sessions remain bound to the definition version on which they began;
- new sessions may use only an approved, pilot or active current definition;
- deprecated definitions may let existing sessions finish;
- retired definitions are never current and cannot accept new sessions;
- stale answers remain governed by Task 1 Flow-version validation;
- migrations use explicit `migrationPolicy` and replacement references and are
  never inferred or executed by the catalogue.

## Current Flow catalogue

All initial definitions are version `1.0.0`. `health.preventive_check` is
`pilot`, `safety.emergency_check` is `active`, and remaining definitions are
`draft` architecture entries.

| Domain | Canonical Flow IDs |
|---|---|
| Safety | `safety.emergency_check`, `safety.immediate_risk_assessment`, `safety.escalation_decision`, `safety.safety_followup` |
| Health | `health.preventive_check`, `health.symptom_assessment`, `health.vitals_capture`, `health.recovery_followup`, `health.healthy_ageing_coaching` |
| Visual Health | `health.visual.wound_assessment`, `health.visual.stool_assessment`, `health.visual.skin_assessment`, `health.visual.foot_assessment`, `health.visual.swelling_assessment`, `health.visual.medication_packaging_identification`, `health.visual.longitudinal_image_comparison` |
| Medication | `medication.reminder`, `medication.dose_confirmation`, `medication.dose_deferred`, `medication.missed_dose`, `medication.refill_check`, `medication.supply_check`, `medication.side_effect_report`, `medication.adherence_followup` |
| Mental wellbeing | `wellbeing.mood_check`, `wellbeing.loneliness_check`, `wellbeing.distress_check`, `wellbeing.cognitive_concern`, `wellbeing.support`, `wellbeing.followup` |
| Social | `social.daily_checkin`, `social.general_conversation`, `social.reminiscence`, `social.activity`, `social.community_connection`, `social.family_contact_suggestion`, `social.loneliness_followup` |
| Concierge | `concierge.appointment_support`, `concierge.transportation_support`, `concierge.local_service_request`, `concierge.shopping_support`, `concierge.meal_support`, `concierge.administrative_support`, `concierge.community_resource_discovery`, `concierge.operator_handoff` |
| Trust and Safety | `trust.scam_assessment`, `trust.suspicious_phone_call`, `trust.suspicious_message`, `trust.suspicious_email`, `trust.impersonation_scam`, `trust.payment_risk`, `trust.remote_access_request`, `trust.account_compromise`, `trust.fraud_exposure_followup` |
| Caregiver | `caregiver.request_checkin`, `caregiver.review_approved_summary`, `caregiver.respond_to_escalation`, `caregiver.update_preferences`, `caregiver.request_followup` |
| Operator | `operator.review_escalation`, `operator.review_failed_engagement`, `operator.contact_user`, `operator.contact_caregiver`, `operator.resolve_service_request`, `operator.record_outcome`, `operator.close_case`, `operator.reopen_case` |
| Engagement | `engagement.proactive_attempt`, `engagement.push_notification`, `engagement.notification_resume`, `engagement.outbound_call`, `engagement.retry`, `engagement.channel_fallback`, `engagement.no_response_followup` |
| Shared orchestration | `orchestration.start_flow`, `orchestration.resume_flow`, `orchestration.interrupt_flow`, `orchestration.defer_flow`, `orchestration.cancel_flow`, `orchestration.complete_flow`, `orchestration.fail_flow`, `orchestration.escalate_flow`, `orchestration.expire_flow`, `orchestration.wait_for_user`, `orchestration.wait_for_tool`, `orchestration.tool_confirmation`, `orchestration.consent_check`, `orchestration.memory_read_approval`, `orchestration.memory_write_approval`, `orchestration.followup_recommendation` |

## Reusable capabilities

| Area | Capability IDs |
|---|---|
| Multimodal | `capability.multimodal.image_capture`, `capability.multimodal.document_capture`, `capability.multimodal.screenshot_capture`, `capability.multimodal.quality_check`, `capability.multimodal.retake_request`, `capability.multimodal.evidence_consent`, `capability.multimodal.asset_authorization`, `capability.multimodal.vision_analysis`, `capability.multimodal.structured_observation_validation`, `capability.multimodal.retention_decision`, `capability.multimodal.longitudinal_comparison` |
| Communication | `capability.communication.push`, `capability.communication.outbound_call`, `capability.communication.caregiver_handoff`, `capability.communication.operator_handoff` |

## Visual-assessment architecture

Visual assessments are separate bounded assessment subflows, not one
unrestricted camera-diagnosis Flow. Each definition requires purpose-limited
image evidence, entry-time image consent, quality checking, contextual
questions, deterministic red-flag references, observation-only interpretation,
possible escalation and a declared retention policy. An image alone is always
insufficient.

The enforced processing boundary is:

```text
Deterministic safety check
→ visual observations
→ domain Specialist interpretation
→ Central Orchestrator decision
```

The catalogue implements no vision model and makes no diagnostic guarantee.

## Scam-assessment architecture

Trust Flows support spoken descriptions, copied text, screenshots, images,
documents, phone numbers and website references. Their policies declare
sensitive-data minimization; payment, credential, remote-access and
account-compromise checks; caregiver/operator escalation options; and follow-up
when the user has already acted.

Allowed assessment concepts include `likely_scam`, `suspicious`,
`insufficient_evidence` and `no_obvious_indicators`.
`no_obvious_indicators` never means guaranteed safe. Guaranteed-safe outcome
IDs and Trust definitions without the prohibition flag are rejected.

## Safety, consent, memory and evidence

Safety checks are stable references such as
`safety_check.emergency_general`, not executable rules. Consent declarations
state scope, timing, revocability, reusability and whether consent is
purpose-specific. Memory policies declare allowed reads, proposed writes,
prohibited categories, targets, confirmation and retention, but perform no
memory operation. Evidence requirements declare purpose, accepted evidence and
MIME families, quality/context requirements, observational limits and
retention.

Emergency and immediate-risk Flows may preempt ordinary Flows. Ordinary Flows
cannot claim unrestricted preemption.

## Catalogue integrity rules

Validation follows declared semantics, not a list of special-cased Flow IDs.
Every Flow that supports `push` must declare the PWA Channel, push capability
and proactive-push consent. Every Flow that supports `outbound_call` must
declare the telephone Channel, outbound-call capability and outbound-call
consent. Caregiver and operator domain Flows must respectively declare
`caregiver` and `operator` as supported initiator triggers.

Within each Flow, scene IDs and outcome IDs are unique. Required and optional
Tool lists are individually unique and cannot overlap. A terminal outcome
cannot also identify a next scene or next Flow; non-terminal outcomes may do so
when the reference is valid.

The three extension-metadata fields accept bounded plain JSON only. They reject
cycles, non-finite numbers, excessive depth/size, executable values,
credential-like keys, provider clients, React implementations, and built-in or
custom class instances. This metadata is descriptive data, never a transport
for runtime behavior or secrets.

## Adding or revising a Flow

1. Choose a stable lowercase namespaced Flow ID.
2. Assign one owning Specialist.
3. Define structured entry conditions.
4. Reuse Task 1 triggers, modalities and provider-neutral Channels.
5. Reference existing capabilities where possible.
6. Declare safety, consent, evidence and memory policies.
7. Define semantic UI scenes, outcomes, escalation and follow-up.
8. Add fixtures and positive/negative tests.
9. Add explicit compatibility and migration metadata.
10. Obtain architecture approval before marking it runtime-selectable.

A new Flow is registered as data and validated by the catalogue; it does not
require a giant switch statement. New schema vocabulary should be added only
when existing declarative fields cannot express the requirement.

## Runtime isolation

The catalogue is not imported by production runtime code. No definition may
contain a function, callback, provider instance, React component or executable
handler. Future runtime selection, migration, consent evaluation, policy
authorization, orchestration and execution are separate milestones.
