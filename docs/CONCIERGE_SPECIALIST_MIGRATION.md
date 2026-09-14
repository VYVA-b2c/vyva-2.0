# Task 18 / Stage 10D — Concierge Specialist Migration

Task 18 migrates one narrow Concierge orchestration slice: user-initiated Concierge request-intake, Trusted Help setup context, and shopping-context navigation.

This is not a booking, provider-contact, payment, cancellation, task-creation, caregiver/operator, memory, proactive, scheduling, queue, or external-service migration.

## Current legacy boundary

Concierge currently enters through the voice router as the `concierge` domain. The router maps that domain to the configured ElevenLabs Concierge agent and existing client voice-action behavior.

Existing Concierge surfaces include:

- `/concierge`
- `/concierge/tasks`
- `/concierge/task/:taskId`
- `/concierge/shopping`
- Trusted Help settings/presentation surfaces
- admin Concierge queues and provider/readiness pages

The existing app also has Concierge action infrastructure for appointments, home services, rides, orders, reminders, tasks, email/phone/WhatsApp/provider actions, operator handoff, queues and Trusted Help. Those execution paths remain legacy/domain-specific and are not migrated into the Specialist in Task 18.

## Migration boundary

The new Concierge Specialist is an adapter over existing safe Concierge navigation/context behavior. It may propose the existing `tool.voice.open_app_action` bridge, but it does not execute it directly.

The migrated slice supports:

- opening the existing Concierge surface for request intake;
- opening existing Concierge context for Trusted Help setup;
- opening the existing Concierge shopping helper context.

The migrated slice explicitly does not:

- book or reserve transport, appointments, services or vendors;
- cancel or reschedule bookings;
- call, email, SMS, WhatsApp, notify or otherwise contact providers, vendors, caregivers, operators or trusted helpers;
- submit orders, buy items, authorize checkout, use cards, accept quotes, spend money or expose payment data;
- create or mutate Concierge task records;
- mutate caregiver permissions or Trusted Help authorization;
- write memory;
- create PostgreSQL durability;
- redesign scheduling, queues or operator workflows;
- introduce a Concierge Domain Supervisor;
- introduce a new global Specialist registry.

Execution-heavy requests remain on the exact legacy Concierge route with no migrated Specialist metadata.

## Flow, Presentation and Specialist identity

- Specialist ID: `concierge`
- Specialist version: `1.0.0`
- Flow ID: `concierge.administrative_support`
- Flow version: `1.0.0`
- Scene ID: `concierge.administrative_support.main`
- Optional proposed tool: `tool.voice.open_app_action`

Task 18 upgrades the existing generated `concierge.administrative_support` catalogue entry to a pilot-only request-intake/navigation/context flow. It does not expand the other Concierge catalogue entries (`appointment_support`, `transportation_support`, `local_service_request`, `shopping_support`, `meal_support`, `community_resource_discovery`, or `operator_handoff`) into migrated execution flows.

The additive canonical presentation IDs are:

- `presentation.concierge.request_intake`
- `presentation.concierge.trusted_help_setup`
- `presentation.concierge.shopping_context`
- `presentation.concierge.safe_fallback`

These are semantic orchestration presentation contracts. They do not name React components, CSS, provider commands, booking commands or payment commands.

## Feature flag and rollback

The server-side flag is:

- `VYVA_CONCIERGE_SPECIALIST_MODE=legacy_only | disabled | specialist_preview`
- `VYVA_CONCIERGE_SPECIALIST_ALLOW_USERS`
- `VYVA_CONCIERGE_SPECIALIST_DENY_USERS`
- `VYVA_CONCIERGE_SPECIALIST_ROLLOUT_BPS`
- `VYVA_CONCIERGE_SPECIALIST_ALLOW_PRODUCTION`

Default, disabled, malformed, whitespace-polluted, production-unapproved or denylisted configuration resolves to legacy-only. Denylist takes precedence over allowlist and rollout.

When the flag is off, the existing Concierge router path remains exact. When the flag is on for an eligible server-side user identity, the router adds structured Concierge Specialist metadata and prompt guidance while preserving the existing ElevenLabs Concierge agent, existing router response shape, existing Concierge route authority and current client action bridge.

## Safety, cross-domain and Trusted Help boundaries

Deterministic safety still runs before Concierge Specialist augmentation. Safety-sensitive wording such as emergency-room transport, inability to breathe, overdose, falls, danger or suicidal intent must remain on the existing Safety route.

Cross-domain requests must not be stolen just because they contain helper words. Medication, Health, Brain Coach, Mental Wellbeing, caregiver/operator and Safety routing remain governed by the existing router precedence.

Trusted Help presentation/setup context remains presentation-only. It is not authorization to contact trusted people, providers, caregivers or operators, and it is not generic consent for Concierge execution.

## Privacy and observability

Task 18 exposes stable non-sensitive orchestration metadata:

- selected Specialist and Flow IDs;
- validation outcome;
- action type;
- capability;
- request category;
- presentation ID;
- tool-proposal decision;
- fallback reason.

Tool observability describes whether the Specialist proposal was allowed by local contract validation, rejected by local contract validation, or not requested. It is not evidence that the Central Orchestrator authorized a tool or that any tool executed.

Raw Concierge utterances, addresses, phone numbers, provider details, caregiver-private content and payment details are not copied into the new Specialist request, prompt block, dynamic variables or session data.

## PostgreSQL

No migration is required for Task 18. This slice introduces no new durable Concierge truth. Existing Concierge task, queue, provider, Trusted Help, operator and admin persistence remains legacy/domain authority.

## Safe-to-freeze meaning

Task 18 is safe to freeze only as a flag-gated Concierge Specialist migration slice after review. It is not approval to roll out all Stage 10 specialists, execute Concierge tools directly, create a provider registry, perform booking/payment/contact actions, redesign Trusted Help, or activate broader Concierge runtime rollout.
