# Task 19 / Stage 10E - Social Support Specialist Migration

Task 19 migrates one narrow Social Support orchestration slice: user-initiated community and social-room navigation/context currently reached through the legacy `companion` route.

This is not a Safety Specialist, caregiver-support migration, caregiver-permission migration, operator-escalation migration, Trusted Help migration, Mental Wellbeing migration, human-contact workflow, memory migration, proactive engagement migration, scheduling migration, or new global registry.

## Current legacy boundary

Social/community language currently enters the voice router as the `companion` domain. The router maps that domain to the configured Companion/Review agent and existing client action behavior.

Existing social/community surfaces include:

- `/social-rooms`
- `/social-rooms/join-in`
- `/social-rooms/activities`

The broader repository also contains caregiver routes, caregiver/operator escalation, Trusted Help, Concierge execution, Mental Wellbeing support, proactive engagement, scheduling, health/medication safety behavior, and social context in voice prompts. Those authorities remain outside Task 19.

## Migration boundary

The new Social Support Specialist is an adapter over existing safe community/social navigation context. It may propose the existing `tool.voice.open_app_action` bridge, but it does not execute it directly.

The migrated slice supports:

- opening the existing community/social hub;
- opening existing social-room context;
- opening existing community-activities context.

The migrated slice explicitly does not:

- contact, call, text, email, WhatsApp, notify, invite, or share with another person;
- grant, remove, inspect, or change caregiver permissions;
- create caregiver/operator escalation or operator tasks;
- use Trusted Help metadata as authorization;
- provide Mental Wellbeing emotional-support guidance;
- book transport, shopping, providers, vendors, appointments, orders or payments;
- write memory;
- create PostgreSQL durability;
- mutate schedules, proactive outreach, queues, games, health state, medication state, caregiver projections, or operator state;
- introduce a Social/Caregiver Domain Supervisor;
- introduce a new global Specialist registry;
- introduce a Safety Specialist.

Safety-sensitive, emotional-support, caregiver-authority, Trusted Help, Concierge, practical human-help, and cross-domain requests preserve the existing legacy or neighboring-domain behavior and receive no Social Support Specialist metadata.

## Flow, Presentation and Specialist identity

- Specialist ID: `social`
- Specialist version: `1.0.0`
- Flow ID: `social.community_connection`
- Flow version: `1.0.0`
- Scene ID: `social.community_connection.main`
- Optional proposed tool: `tool.voice.open_app_action`

Task 19 upgrades the existing generated `social.community_connection` catalogue entry into a pilot-only community-navigation/context flow. It does not expand other social, caregiver, safety, emotional support, proactive, scheduling, room-presence, caregiver-operator, or human-contact flows.

The additive canonical presentation IDs are:

- `presentation.social.community_connection.summary`
- `presentation.social.community_connection.rooms`
- `presentation.social.community_connection.activities`
- `presentation.social.community_connection.safe_fallback`

These are semantic orchestration presentation contracts. They do not name React components, CSS, provider commands, caregiver commands, contact commands, escalation commands, or scheduling commands.

## Feature flag and rollback

The server-side flag is:

- `VYVA_SOCIAL_SUPPORT_SPECIALIST_MODE=legacy_only | disabled | specialist_preview`
- `VYVA_SOCIAL_SUPPORT_SPECIALIST_ALLOW_USERS`
- `VYVA_SOCIAL_SUPPORT_SPECIALIST_DENY_USERS`
- `VYVA_SOCIAL_SUPPORT_SPECIALIST_ROLLOUT_BPS`
- `VYVA_SOCIAL_SUPPORT_SPECIALIST_ALLOW_PRODUCTION`

Default, disabled, malformed, whitespace-polluted, production-unapproved or denylisted configuration resolves to legacy-only. Denylist takes precedence over allowlist and rollout.

When the flag is off, the existing Companion route remains exact. When the flag is on for an eligible server-side user identity, the router adds structured Social Support Specialist metadata and prompt guidance while preserving the existing ElevenLabs Companion agent, existing router response shape, existing route authority and current client action bridge.

## Safety, Mental Wellbeing, Concierge and caregiver boundaries

Deterministic safety still runs before Social Support Specialist augmentation. Emergency, self-harm, overdose, breathing distress, falls, danger and abuse-style wording must remain on the existing Safety route or legacy safety handling.

Loneliness, low mood, anxiety, stress, "someone to talk to" and emotional-support wording remain Mental Wellbeing/legacy companion support.

Trusted Help, transport, shopping, provider/vendor, booking, ordering, payment and practical human-help wording remain Concierge/legacy behavior.

Caregiver permissions, caregiver access, caregiver summaries, caregiver/operator escalation, alert delivery and operator tasks remain the Stage 9 caregiver/operator architecture or legacy caregiver routes. Task 19 does not treat caregiver consent, Trusted Help metadata or social context as authorization to contact or disclose to another person.

## Privacy and observability

Task 19 exposes stable non-sensitive orchestration metadata:

- selected Specialist and Flow IDs;
- validation outcome;
- action type;
- capability;
- request category;
- presentation ID;
- tool-proposal decision;
- fallback reason.

Tool observability describes whether the Specialist proposal was allowed by local contract validation, rejected by local contract validation, or not requested. It is not evidence that the Central Orchestrator authorized a tool or that any tool executed.

Raw social/support utterances, caregiver-private content, mental-health text, contact details, health details and medication details are not copied into the new Specialist request, prompt block, dynamic variables or session data.

## PostgreSQL

No migration is required for Task 19. This slice introduces no new durable Social Support truth. Existing social-room, caregiver, operator, Concierge, proactive, memory, Health and Medication persistence remains with the existing domain owners.

## Safe-to-freeze meaning

Task 19 is safe to freeze only as a flag-gated Social Support Specialist migration slice after review. It is not approval to roll out all Stage 10 specialists, create a Safety Specialist, migrate caregiver support, contact humans, create escalations, authorize caregiver permissions, redesign social-room persistence, or activate broader runtime rollout.
