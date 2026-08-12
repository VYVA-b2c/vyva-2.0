# Flow Alignment Map

Task 20 audits the current Flow Catalogue, Presentation Registry and migrated
runtime slices against the Flow Runtime Contract. This is a map, not a runtime
implementation.

Classification meanings:

- `ALIGNED`: the current slice has a canonical Flow ID/version, known owner,
  compatible voice/touch/text semantics where applicable, and no known conflict
  with the Central-Orchestrator-owned Flow contract.
- `DOC GAP`: the current implementation appears compatible, but the documented
  runtime/presentation handoff is incomplete.
- `IMPLEMENTATION GAP`: the catalogue/presentation contract exists, but the
  runtime is not yet wired or remains materially legacy-only.
- `CONFLICT`: current behavior would conflict with the runtime invariant if treated
  as authoritative Flow state.
- `UNRESOLVED`: product/architecture authority is still ambiguous.

Common abbreviations:

- Voice `router` means the existing ElevenLabs/router path remains involved.
- Touch `legacy screen` means React route/UI exists but is not necessarily consuming
  canonical Flow state.
- Tool `proposal` means a Specialist or screen may propose an action, but Central
  Orchestrator/tool authorization must approve before execution.
- Terminal `complete/error` maps to the Task 20 lifecycle vocabulary. `error`
  includes failure, cancellation, expiry and escalation.

## Decision sequence before implementing a Flow screen

Use this order before building a Flow screen or parallel Flow slice:

1. Define the user journey and subflow boundary.
2. Confirm the canonical Flow Catalogue entry.
3. Confirm the Presentation Registry entries and fallback presentations.
4. Add or update the per-flow runtime presentation binding for state,
   presentation, tools and interruption policy.
5. Implement the UI through the shared presentation/channel contract.
6. Prove voice, touch and text parity, stale-scene rejection, interruption
   behavior and rollback.

## Parallel task handoff rule

A parallel Flow task is not ready for implementation until it can provide:

- Flow name, Flow ID/version and owner;
- entry trigger and semantic scenes;
- persisted state versus temporary UI state;
- Presentation IDs and fallback Presentation IDs;
- voice behavior and touch behavior;
- allowed tools and provider boundaries;
- approval gates;
- interruption categories;
- tests proving contract, screen and runtime behavior.

If a row cannot be filled without inventing product semantics, the task should
stop and ask for product-owner approval.

## High-confidence aligned slices

| Flow name | Flow ID | Owner | Voice behavior | Touch behavior | Presentation IDs | Persisted state | Temporary state | Tool permissions | Confirmation gates | Interruptions | Terminal states | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Preventive Health Check | `health.preventive_check` | `preventive_health` | Voice answers normalize through the Health answer contract; outbound call can restore entry when specifically configured. | Health canvas/touch answers use the canonical normalized answer path from Stage 7. | `presentation.health.preventive.*`, `presentation.error.safe_generic` | PostgreSQL check-in/result/claim state | Channel UI | none | health consent; push/outbound consent for engagement entries; current scene/question/version | safety preempts | complete/error | ALIGNED |
| Mental Wellbeing support slice | `wellbeing.support` | `mental_wellbeing` | Flag-gated Specialist metadata augments legacy companion route after safety clear. | Existing companion/social support surfaces remain legacy; presentation IDs exist. | `presentation.wellbeing.support.summary`, `presentation.wellbeing.support.checkin`, `presentation.wellbeing.support.safe_fallback` | none | channel UI | none | none beyond safety | safety preempts | complete/error | ALIGNED |
| Medication navigation/context slice | `medication.reminder` | `medication` | Flag-gated Specialist proposal for existing medication navigation only. | Existing medication screens remain domain authority for medication records. | `presentation.medication.reminder`, `presentation.medication.human_help_confirmation`, `presentation.medication.followup` | existing medication domain store | channel UI | proposal only for `tool.voice.open_app_action` | human-help/navigation confirmation only; no dose confirmation | safety preempts | complete/error | ALIGNED |
| Concierge request-intake/context slice | `concierge.administrative_support` | `concierge` | Flag-gated Specialist proposal for request intake, Trusted Help context and shopping context only. | Existing Concierge screens/tasks remain legacy domain authority. | `presentation.concierge.request_intake`, `presentation.concierge.trusted_help_setup`, `presentation.concierge.shopping_context`, `presentation.concierge.safe_fallback` | existing Concierge domain store | channel UI | proposal only for `tool.voice.open_app_action` | no booking/payment/contact confirmation in this slice | safety preempts | complete/error | ALIGNED |
| Social community-navigation slice | `social.community_connection` | `social` | Flag-gated Specialist proposal for community/social-room navigation only. | Existing social/community screens remain legacy domain authority. | `presentation.social.community_connection.summary`, `presentation.social.community_connection.rooms`, `presentation.social.community_connection.activities`, `presentation.social.community_connection.safe_fallback` | existing social domain store | channel UI | proposal only for `tool.voice.open_app_action` | none for human contact; contact remains out of scope | safety preempts | complete/error | ALIGNED |

## Catalogue-wide alignment inventory

| Flow name | Flow ID | Owner | Voice behavior | Touch behavior | Presentation IDs | Persisted state | Temporary state | Tool permissions | Confirmation gates | Interruptions | Terminal states | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Emergency check | `safety.emergency_check` | `safety` | Existing router safety preemption is active. | Safety UI exists through legacy surfaces. | `presentation.safety.emergency_*` | existing safety/session records | channel UI | unresolved emergency/human-help execution | emergency or human-help confirmation | preempts ordinary Flows | complete/error | DOC GAP |
| Immediate risk assessment | `safety.immediate_risk_assessment` | `safety` | Safety routing exists; specific Flow runtime not separated. | legacy screen/none | none | unknown | unknown | unresolved | emergency confirmation | preempts ordinary Flows | complete/error | IMPLEMENTATION GAP |
| Escalation decision | `safety.escalation_decision` | `safety` | Safety routing exists; specific Flow runtime not separated. | legacy screen/none | none | unknown | unknown | unresolved | escalation confirmation | preempts ordinary Flows | complete/error | IMPLEMENTATION GAP |
| Safety follow-up | `safety.safety_followup` | `safety` | legacy safety follow-up behavior only. | legacy screen/none | none | unknown | unknown | unresolved | follow-up confirmation | safety preempts | complete/error | IMPLEMENTATION GAP |
| Preventive check | `health.preventive_check` | `preventive_health` | canonical Health answer path | canonical Health canvas path | `presentation.health.preventive.*`, `presentation.error.safe_generic` | postgres | channel UI | none | health/proactive/outbound consent | safety preempts | complete/error | ALIGNED |
| Symptom assessment | `health.symptom_assessment` | `symptom_assessment` | legacy health/symptom routing | Health symptom UI legacy | none | existing health store | react state | unresolved | clinical/safety confirmation | safety preempts | complete/error | IMPLEMENTATION GAP |
| Vitals capture | `health.vitals_capture` | `preventive_health` | legacy Health/vitals voice intent | Health vitals UI legacy | none | existing health store | react state | unresolved | measurement confirmation | safety preempts | complete/error | IMPLEMENTATION GAP |
| Recovery follow-up | `health.recovery_followup` | `preventive_health` | legacy/none | legacy/none | none | unknown | unknown | unresolved | unresolved | safety preempts | complete/error | IMPLEMENTATION GAP |
| Healthy ageing coaching | `health.healthy_ageing_coaching` | `preventive_health` | legacy advisor behavior | legacy Health content | none | none | react state | none | none | safety preempts | complete/error | IMPLEMENTATION GAP |
| Wound assessment | `health.visual.wound_assessment` | `visual_health` | voice can describe intent; capture remains UI-driven. | visual Health screen has upload/capture surfaces. | `presentation.health.wound.*` | existing/unknown visual health records | react state | central authorization required for image handling | image consent; evidence capture | safety preempts | complete/error | DOC GAP |
| Stool assessment | `health.visual.stool_assessment` | `visual_health` | not separately migrated | not separately migrated | none | unknown | unknown | central authorization required | image/evidence consent | safety preempts | complete/error | IMPLEMENTATION GAP |
| Skin assessment | `health.visual.skin_assessment` | `visual_health` | not separately migrated | not separately migrated | none | unknown | unknown | central authorization required | image/evidence consent | safety preempts | complete/error | IMPLEMENTATION GAP |
| Foot assessment | `health.visual.foot_assessment` | `visual_health` | not separately migrated | not separately migrated | none | unknown | unknown | central authorization required | image/evidence consent | safety preempts | complete/error | IMPLEMENTATION GAP |
| Swelling assessment | `health.visual.swelling_assessment` | `visual_health` | not separately migrated | not separately migrated | none | unknown | unknown | central authorization required | image/evidence consent | safety preempts | complete/error | IMPLEMENTATION GAP |
| Medication packaging identification | `health.visual.medication_packaging_identification` | `visual_health` | not separately migrated | not separately migrated | none | unknown | unknown | central authorization required | image/evidence consent | safety preempts | complete/error | IMPLEMENTATION GAP |
| Longitudinal image comparison | `health.visual.longitudinal_image_comparison` | `visual_health` | not separately migrated | not separately migrated | none | unknown | unknown | central authorization required | image retention/comparison consent | safety preempts | complete/error | IMPLEMENTATION GAP |
| Medication reminder | `medication.reminder` | `medication` | flag-gated Stage 10C navigation/context | legacy medication screen authority | medication reminder/human-help/followup | existing domain store | channel UI | proposal only | navigation/human-help only | safety preempts | complete/error | ALIGNED |
| Dose confirmation | `medication.dose_confirmation` | `medication` | legacy medication agent/route | medication UI legacy | `presentation.medication.confirmation` | existing medication store | react state | legacy direct/unresolved | dose confirmation | safety preempts | complete/error | IMPLEMENTATION GAP |
| Dose deferred | `medication.dose_deferred` | `medication` | legacy medication behavior | medication UI legacy | `presentation.medication.defer` | existing medication store | react state | legacy direct/unresolved | defer confirmation | safety preempts | complete/error | IMPLEMENTATION GAP |
| Missed dose | `medication.missed_dose` | `medication` | legacy medication/safety behavior | medication UI legacy | `presentation.medication.missed_dose` | existing medication store | react state | unresolved | safety warning acknowledgement | safety preempts | complete/error | IMPLEMENTATION GAP |
| Refill check | `medication.refill_check` | `medication` | legacy navigation/context only in Stage 10C | medication UI legacy | none | existing medication store | react state | unresolved | refill request confirmation | safety preempts | complete/error | IMPLEMENTATION GAP |
| Supply check | `medication.supply_check` | `medication` | legacy medication behavior | medication UI legacy | none | existing medication store | react state | unresolved | unresolved | safety preempts | complete/error | IMPLEMENTATION GAP |
| Side effect report | `medication.side_effect_report` | `medication` | kept out of Stage 10C | medication UI legacy | none | existing medication store | react state | unresolved | safety/clinical confirmation | safety preempts | complete/error | IMPLEMENTATION GAP |
| Adherence follow-up | `medication.adherence_followup` | `medication` | legacy medication behavior | medication UI legacy | none | existing medication store | react state | unresolved | follow-up confirmation | safety preempts | complete/error | IMPLEMENTATION GAP |
| Mood check | `wellbeing.mood_check` | `mental_wellbeing` | legacy companion/wellbeing behavior | legacy/none | none | unknown | unknown | none | safety-sensitive gating | safety preempts | complete/error | IMPLEMENTATION GAP |
| Loneliness check | `wellbeing.loneliness_check` | `mental_wellbeing` | legacy companion behavior | legacy/none | none | unknown | unknown | none | safety-sensitive gating | safety preempts | complete/error | IMPLEMENTATION GAP |
| Distress check | `wellbeing.distress_check` | `mental_wellbeing` | safety-sensitive legacy routing | legacy/none | none | unknown | unknown | none | safety-sensitive gating | safety preempts | complete/error | IMPLEMENTATION GAP |
| Cognitive concern | `wellbeing.cognitive_concern` | `mental_wellbeing` | legacy/none | legacy/none | none | unknown | unknown | none | clinical/safety gating | safety preempts | complete/error | IMPLEMENTATION GAP |
| Support | `wellbeing.support` | `mental_wellbeing` | flag-gated Stage 10B ordinary support | legacy companion/social surface | wellbeing support presentations | none | channel UI | none | none | safety preempts | complete/error | ALIGNED |
| Wellbeing follow-up | `wellbeing.followup` | `mental_wellbeing` | legacy/none | legacy/none | none | unknown | unknown | none | unresolved | safety preempts | complete/error | IMPLEMENTATION GAP |
| Daily check-in | `social.daily_checkin` | `social` | legacy companion/social behavior | legacy/none | none | unknown | unknown | none | unresolved | safety preempts | complete/error | IMPLEMENTATION GAP |
| General conversation | `social.general_conversation` | `social` | legacy companion route may answer directly. | legacy/none | none | none | unknown | legacy direct | none | safety preempts | complete/error | CONFLICT |
| Reminiscence | `social.reminiscence` | `social` | legacy companion behavior | legacy/none | none | none | unknown | none | none | safety preempts | complete/error | IMPLEMENTATION GAP |
| Social activity | `social.activity` | `social` | legacy companion/social behavior | legacy/none | none | unknown | unknown | none | unresolved | safety preempts | complete/error | IMPLEMENTATION GAP |
| Community connection | `social.community_connection` | `social` | flag-gated Stage 10E navigation/context | legacy social/community surfaces | social community presentations | existing domain store | channel UI | proposal only | no human contact | safety preempts | complete/error | ALIGNED |
| Family contact suggestion | `social.family_contact_suggestion` | `social` | legacy/none | legacy/none | none | unknown | unknown | unresolved | human contact consent | safety preempts | complete/error | UNRESOLVED |
| Loneliness follow-up | `social.loneliness_followup` | `social` | overlaps Mental Wellbeing | legacy/none | none | unknown | unknown | unresolved | safety/emotional support gating | safety preempts | complete/error | UNRESOLVED |
| Brain Coach activity session | `brain_coach.activity_session` | `brain_coach` | flag-gated Stage 10A navigation/context | `/activities` and games remain legacy/client-specific | none | mixed localStorage/Supabase/existing domain stores | localStorage/react state | proposal only | no game execution confirmation | safety preempts | complete/error | DOC GAP |
| Appointment support | `concierge.appointment_support` | `concierge` | legacy Concierge behavior | Concierge screens legacy | none | existing Concierge store | react state | legacy direct/unresolved | booking/provider confirmation | safety preempts | complete/error | IMPLEMENTATION GAP |
| Transportation support | `concierge.transportation_support` | `concierge` | legacy Concierge behavior | Concierge screens legacy | none | existing Concierge store | react state | legacy direct/unresolved | transport confirmation | safety preempts | complete/error | IMPLEMENTATION GAP |
| Local service request | `concierge.local_service_request` | `concierge` | legacy Concierge behavior | Concierge screens legacy | none | existing Concierge store | react state | legacy direct/unresolved | provider contact confirmation | safety preempts | complete/error | IMPLEMENTATION GAP |
| Shopping support | `concierge.shopping_support` | `concierge` | legacy Concierge shopping context | Concierge shopping screens legacy | none | existing Concierge store | react state | legacy direct/unresolved | order/payment/contact confirmation | safety preempts | complete/error | IMPLEMENTATION GAP |
| Meal support | `concierge.meal_support` | `concierge` | legacy Concierge behavior | Concierge screens legacy | none | existing Concierge store | react state | legacy direct/unresolved | order/contact confirmation | safety preempts | complete/error | IMPLEMENTATION GAP |
| Administrative support | `concierge.administrative_support` | `concierge` | flag-gated Stage 10D intake/context | legacy Concierge surfaces | Concierge intake/context presentations | existing Concierge store | channel UI | proposal only | no execution gate in slice | safety preempts | complete/error | ALIGNED |
| Community resource discovery | `concierge.community_resource_discovery` | `concierge` | legacy Concierge behavior | Concierge screens legacy | none | existing Concierge store | react state | unresolved | provider/contact confirmation | safety preempts | complete/error | IMPLEMENTATION GAP |
| Operator handoff | `concierge.operator_handoff` | `concierge` | legacy/operator boundary | admin/operator queue legacy | none | existing operator/Concierge store | react state | central authorization required | operator disclosure | safety preempts | complete/error | UNRESOLVED |
| Scam assessment | `trust.scam_assessment` | `scam_fraud` | legacy safety/scam routing exists. | evidence UI partially represented by registry | `presentation.trust.scam.*` | unknown | channel UI | central authorization required for evidence/human help | image/document consent; human help | safety preempts | complete/error | DOC GAP |
| Suspicious phone call | `trust.suspicious_phone_call` | `scam_fraud` | legacy safety/scam behavior | legacy/none | none | unknown | unknown | unresolved | evidence/human help | safety preempts | complete/error | IMPLEMENTATION GAP |
| Suspicious message | `trust.suspicious_message` | `scam_fraud` | legacy safety/scam behavior | legacy/none | none | unknown | unknown | unresolved | evidence/human help | safety preempts | complete/error | IMPLEMENTATION GAP |
| Suspicious email | `trust.suspicious_email` | `scam_fraud` | legacy safety/scam behavior | legacy/none | none | unknown | unknown | unresolved | evidence/human help | safety preempts | complete/error | IMPLEMENTATION GAP |
| Impersonation scam | `trust.impersonation_scam` | `scam_fraud` | legacy safety/scam behavior | legacy/none | none | unknown | unknown | unresolved | evidence/human help | safety preempts | complete/error | IMPLEMENTATION GAP |
| Payment risk | `trust.payment_risk` | `scam_fraud` | legacy safety/scam behavior | legacy/none | none | unknown | unknown | unresolved | payment-risk warning | safety preempts | complete/error | IMPLEMENTATION GAP |
| Remote access request | `trust.remote_access_request` | `scam_fraud` | legacy safety/scam behavior | legacy/none | none | unknown | unknown | unresolved | remote-access warning | safety preempts | complete/error | IMPLEMENTATION GAP |
| Account compromise | `trust.account_compromise` | `scam_fraud` | legacy safety/scam behavior | legacy/none | none | unknown | unknown | unresolved | account-protection warning | safety preempts | complete/error | IMPLEMENTATION GAP |
| Fraud exposure follow-up | `trust.fraud_exposure_followup` | `scam_fraud` | legacy safety/scam behavior | legacy/none | none | unknown | unknown | unresolved | follow-up/human help | safety preempts | complete/error | IMPLEMENTATION GAP |
| Caregiver request check-in | `caregiver.request_checkin` | `caregiver` | caregiver channel only; not a user voice Flow. | caregiver dashboard legacy | none | existing caregiver store | react state | central authorization required | caregiver permission/disclosure | ordinary only | complete/error | UNRESOLVED |
| Caregiver review approved summary | `caregiver.review_approved_summary` | `caregiver` | caregiver channel only | caregiver dashboard legacy | none | existing caregiver/operator projections | react state | central authorization required | disclosure authorization | ordinary only | complete/error | UNRESOLVED |
| Caregiver respond to escalation | `caregiver.respond_to_escalation` | `caregiver` | caregiver channel only | caregiver dashboard legacy | none | caregiver/operator projection tables | react state | central authorization required | escalation authorization | ordinary only | complete/error | UNRESOLVED |
| Caregiver update preferences | `caregiver.update_preferences` | `caregiver` | caregiver channel only | caregiver/admin UI legacy | none | existing caregiver preference store | react state | legacy direct/unresolved | caregiver permission confirmation | ordinary only | complete/error | UNRESOLVED |
| Caregiver request follow-up | `caregiver.request_followup` | `caregiver` | caregiver channel only | caregiver dashboard legacy | none | existing caregiver store | react state | unresolved | disclosure/follow-up consent | ordinary only | complete/error | UNRESOLVED |
| Operator review escalation | `operator.review_escalation` | `operator` | operator channel only | operator/admin UI legacy | none | operator projection/queue store | react state | central authorization required | operator role authorization | ordinary only | complete/error | UNRESOLVED |
| Operator review failed engagement | `operator.review_failed_engagement` | `operator` | operator channel only | operator/admin UI legacy | none | operator queue/audit store | react state | central authorization required | operator role authorization | ordinary only | complete/error | UNRESOLVED |
| Operator contact user | `operator.contact_user` | `operator` | operator channel only | operator/admin UI legacy | none | operator/communication store | react state | central authorization required | user contact consent | ordinary only | complete/error | UNRESOLVED |
| Operator contact caregiver | `operator.contact_caregiver` | `operator` | operator channel only | operator/admin UI legacy | none | operator/caregiver store | react state | central authorization required | caregiver disclosure | ordinary only | complete/error | UNRESOLVED |
| Operator resolve service request | `operator.resolve_service_request` | `operator` | operator channel only | operator/admin UI legacy | none | Concierge/operator store | react state | central authorization required | operator role authorization | ordinary only | complete/error | UNRESOLVED |
| Operator record outcome | `operator.record_outcome` | `operator` | operator channel only | operator/admin UI legacy | none | operator store | react state | central authorization required | operator role authorization | ordinary only | complete/error | UNRESOLVED |
| Operator close case | `operator.close_case` | `operator` | operator channel only | operator/admin UI legacy | none | operator store | react state | central authorization required | operator role authorization | ordinary only | complete/error | UNRESOLVED |
| Operator reopen case | `operator.reopen_case` | `operator` | operator channel only | operator/admin UI legacy | none | operator store | react state | central authorization required | operator role authorization | ordinary only | complete/error | UNRESOLVED |
| Proactive attempt | `engagement.proactive_attempt` | `engagement` | not live voice dispatch; Task 8 is audit-only. | none | none | proactive audit store | none | none | policy consent only | none | complete/error | DOC GAP |
| Push notification | `engagement.push_notification` | `engagement` | no auto-voice | PWA push entry adapter | none | preventive web-push store | service worker/browser state | central authorization required | proactive push consent | none | complete/error | DOC GAP |
| Notification resume | `engagement.notification_resume` | `engagement` | no voice path | PWA resume surfaces | `presentation.engagement.*` | web-push/deep-link store | browser state | central authorization required | deep-link expiry/stale confirmation | safety preempts after resume | complete/error | DOC GAP |
| Outbound call | `engagement.outbound_call` | `engagement` | outbound voice-call entry adapter | none | `presentation.engagement.outbound_call.voice` | outbound-call store | provider call state | central authorization required | outbound-call consent; secret token; provider correlation | safety preempts after entry | complete/error | DOC GAP |
| Engagement retry | `engagement.retry` | `engagement` | not implemented as durable scheduler | none | none | audit/unknown | none | unresolved | retry policy | none | complete/error | IMPLEMENTATION GAP |
| Channel fallback | `engagement.channel_fallback` | `engagement` | not implemented as durable scheduler | none | none | audit/unknown | none | unresolved | channel fallback policy | none | complete/error | IMPLEMENTATION GAP |
| No-response follow-up | `engagement.no_response_followup` | `engagement` | not implemented as durable scheduler | none | none | audit/unknown | none | unresolved | follow-up policy | none | complete/error | IMPLEMENTATION GAP |
| Start Flow | `orchestration.start_flow` | `orchestration` | central runtime primitive; no separate user surface | none | none | event/Flow projection | none | central authorization required | active-flow selection | safety preempts | complete/error | DOC GAP |
| Resume Flow | `orchestration.resume_flow` | `orchestration` | central runtime primitive | none | none | event/Flow projection | none | central authorization required | resume revalidation | safety preempts | complete/error | DOC GAP |
| Interrupt Flow | `orchestration.interrupt_flow` | `orchestration` | central runtime primitive | none | none | event/Flow projection | none | central authorization required | interruption reason | safety preempts | complete/error | DOC GAP |
| Defer Flow | `orchestration.defer_flow` | `orchestration` | central runtime primitive | none | none | event/Flow projection | none | central authorization required | defer confirmation | safety preempts | complete/error | DOC GAP |
| Cancel Flow | `orchestration.cancel_flow` | `orchestration` | central runtime primitive | none | none | event/Flow projection | none | central authorization required | cancel confirmation | safety preempts | complete/error | DOC GAP |
| Complete Flow | `orchestration.complete_flow` | `orchestration` | central runtime primitive | none | none | event/Flow projection | none | central authorization required | completion validation | safety preempts | complete/error | DOC GAP |
| Fail Flow | `orchestration.fail_flow` | `orchestration` | central runtime primitive | none | none | event/Flow projection | none | central authorization required | error classification | safety preempts | complete/error | DOC GAP |
| Escalate Flow | `orchestration.escalate_flow` | `orchestration` | central runtime primitive | none | none | event/Flow projection | none | central authorization required | escalation authorization | safety preempts | complete/error | DOC GAP |
| Expire Flow | `orchestration.expire_flow` | `orchestration` | central runtime primitive | none | none | event/Flow projection | none | central authorization required | expiry policy | safety preempts | complete/error | DOC GAP |
| Wait for user | `orchestration.wait_for_user` | `orchestration` | central runtime primitive | none | none | event/Flow projection | none | none | current question/scene/version | safety preempts | collecting/error | DOC GAP |
| Wait for tool | `orchestration.wait_for_tool` | `orchestration` | central runtime primitive | none | none | event/Flow projection | none | central authorization required | tool confirmation | safety preempts | active/error | DOC GAP |
| Tool confirmation | `orchestration.tool_confirmation` | `orchestration` | central runtime primitive | Presentation required before execution | none | event/Flow projection | channel UI | central authorization required | tool confirmation | safety preempts | complete/error | DOC GAP |
| Consent check | `orchestration.consent_check` | `orchestration` | central runtime primitive | Presentation required for consent collection | none | consent/domain stores | channel UI | central authorization required | consent confirmation | safety preempts | complete/error | DOC GAP |
| Memory read approval | `orchestration.memory_read_approval` | `orchestration` | central runtime primitive | none | none | memory/audit stores | none | central authorization required | memory policy | safety preempts | complete/error | DOC GAP |
| Memory write approval | `orchestration.memory_write_approval` | `orchestration` | central runtime primitive | none | none | memory/audit stores | none | central authorization required | memory consent | safety preempts | complete/error | DOC GAP |
| Follow-up recommendation | `orchestration.followup_recommendation` | `orchestration` | central runtime primitive | none | none | audit/domain stores | none | central authorization required | proactive/follow-up consent | safety preempts | complete/error | DOC GAP |

## Findings by classification

### ALIGNED

- `health.preventive_check` has the strongest end-to-end evidence: canonical Flow
  identity, presentation references, stale answer rejection, PostgreSQL completion
  identity and voice/touch answer parity for the Health canvas.
- `wellbeing.support`, `medication.reminder`, `concierge.administrative_support`
  and `social.community_connection` are aligned only for their narrow Stage 10
  migration slices. They remain flag-gated and do not authorize wider domain
  behavior.

### DOC GAP

- Safety emergency handling is globally preemptive today, but the canonical
  runtime handoff from safety routing to `safety.emergency_check` still needs a
  runtime contract document before broader wiring.
- Engagement push/notification/outbound-call entries have task-specific proofs,
  but they are entry adapters rather than a general Flow runtime.
- Orchestration meta-Flows are catalogue entries. Their exact runtime surface is
  now described by the Task 20 contract, but no engine executes them as Flows.
- Brain Coach has a Stage 10A specialist slice, but no canonical Presentation
  Registry entry for `brain_coach.activity_session`.

### IMPLEMENTATION GAP

- Most draft catalogue entries remain architecture inventory only.
- Visual Health has Wound presentations, but the full visual Flow runtime remains
  incomplete and must preserve observation-only, consent and evidence-quality
  boundaries.
- Medication dose confirmation/defer/missed-dose flows have presentations but
  remain legacy/domain-specific, not fully orchestrator-owned.
- Trust/scam has presentation coverage for `trust.scam_assessment`, but adjacent
  trust flows remain unwired.

### CONFLICT

- `social.general_conversation` and other broad legacy companion/voice-navigation
  behavior can directly answer or navigate without a canonical active Flow. This
  is acceptable as legacy behavior, but it must not be treated as migrated Flow
  runtime authority.
- Brain Coach game progress remains split across localStorage and Supabase-backed
  game state. This is acceptable outside the Task 15 slice, but it would conflict
  with the Flow runtime contract if promoted to authoritative Flow progression
  without a separate data migration.

### UNRESOLVED

- Caregiver and operator catalogue flows need a product/architecture decision:
  are they user journey Flows, operator work queue states, projections, or a mix?
- Social family-contact and loneliness follow-up overlap with Mental Wellbeing,
  Trusted Help, Concierge and caregiver/operator boundaries.
- Durable scheduling and recovery semantics are deferred to Stage 11.

## Safety, caregiver, consent and tool boundaries

- Safety/emergency remains global and preemptive.
- Caregiver/operator disclosures remain Stage 9 projection authority or legacy
  caregiver/operator routes; Task 20 does not create a Caregiver Support Specialist.
- Proactive push and outbound call require their existing Task 8/10/11 policy,
  consent and correlation gates.
- Specialists remain proposal-only. The common Stage 10 navigation tool
  `tool.voice.open_app_action` remains proposal-only and client-owned until
  explicitly authorized by the Orchestrator/tool boundary.
- Mem0 remains optional and policy-controlled. Task 20 adds no memory authority.

## Future parallel Flow task checklist

Every future Flow task should declare:

1. Flow ID/version and owner Specialist.
2. Whether it uses an existing catalogue Flow or adds a new one.
3. Runtime lifecycle states it can enter.
4. Voice/touch/text parity proof.
5. Current scene/question/version stale-rejection proof.
6. Presentation IDs and fallback presentation IDs.
7. Persisted state and temporary UI state.
8. Tool proposals and authorization requirements.
9. Confirmation gates.
10. Safety interruption/preemption behavior.
11. Terminal semantics.
12. Feature flag and rollback behavior.
13. Explicitly prohibited expansions.

If a task cannot fill these fields without inventing product semantics, it should
stop and request product-owner approval before implementation.
