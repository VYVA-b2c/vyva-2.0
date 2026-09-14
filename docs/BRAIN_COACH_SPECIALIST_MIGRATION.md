# Task 15 / Stage 10A — Brain Coach Specialist Migration

Task 15 migrates only the first Brain Coach orchestration slice: user-initiated Brain Coach activity selection and session entry. It does not migrate the whole Brain Coach product surface.

## Current legacy behavior

Brain Coach currently enters through the voice router using the `brain_coach` domain, the existing ElevenLabs Brain Coach agent mapping, Brain Coach voice context, and client voice actions such as `brain.activity`, `brain.memory_game`, `brain.focus`, `brain.relax_breathe`, `brain.learn`, and `brain.senses`.

The existing activity catalogue in `server/lib/brainCoachPlan.ts` remains the domain source for concrete supported activities. Existing caregiver modules, schedule-sync helpers, game navigation, localStorage game history, and Supabase-backed game state remain outside this migration.

## Migration boundary

The new Brain Coach Specialist is an adapter over existing Brain Coach behavior. It may propose an existing open-app-action navigation instruction, but it does not execute it directly.

The migrated slice supports:

- opening the Brain Coach / Mind & Memory hub;
- opening memory games;
- opening attention/focus surfaces;
- opening existing catalogue activities such as Story Recall and Number Trails;
- preserving unsupported or coming-soon requests as legacy fallback.

The migrated slice does not:

- create a second Brain Coach agent;
- introduce a Brain Coach Domain Supervisor;
- introduce a new global Specialist registry;
- execute games;
- mutate schedules;
- write caregiver permissions;
- write memory;
- create PostgreSQL durability.

## Flow and Specialist identity

- Specialist ID: `brain_coach`
- Specialist version: `1.0.0`
- Flow ID: `brain_coach.activity_session`
- Flow version: `1.0.0`
- Scene ID: `brain_coach.activity_session.main`
- Optional proposed tool: `tool.voice.open_app_action`

The Flow is catalogued as pilot-only and activity-navigation-only. It is intentionally registered through the existing frozen Specialist and Flow catalogue contracts. A broader global registry remains a later extraction candidate after multiple Stage 10 domains prove the repeated shape.

## Flag and rollback

Task 15 uses a Brain-Coach-specific server-side flag:

- `VYVA_BRAIN_COACH_SPECIALIST_MODE=legacy_only | disabled | specialist_preview`
- `VYVA_BRAIN_COACH_SPECIALIST_ALLOW_USERS`
- `VYVA_BRAIN_COACH_SPECIALIST_DENY_USERS`
- `VYVA_BRAIN_COACH_SPECIALIST_ROLLOUT_BPS`
- `VYVA_BRAIN_COACH_SPECIALIST_ALLOW_PRODUCTION`

Absent, empty, disabled, malformed, whitespace-polluted, production-unapproved, or denylisted configuration resolves to legacy-only. Denylist takes precedence over allowlist and rollout.

When the flag is off, the legacy Brain Coach router path remains exact. When the flag is on for an eligible user, the router adds structured Brain Coach Specialist metadata and prompt guidance while preserving the existing router, ElevenLabs agent selection, voice context, and client action bridge.

## Safety, authority, and privacy

The legacy deterministic safety check still runs before Brain Coach classification and before Specialist augmentation. The Specialist response validator rejects ordinary Brain Coach output for emergency input.

The Specialist cannot directly execute tools, mutate caregiver permissions, alter recurring tasks, write memory, or change game persistence. It only proposes an existing open-app action for later Orchestrator/tool authorization.

The Specialist request uses event references and stable action IDs. Raw user speech is not copied into Specialist request payloads, dynamic variables, session data, or the Task 15 prompt block.

## PostgreSQL

No migration is required for Task 15. This slice does not create new durable Brain Coach truth. Existing router/session persistence remains legacy authority, and game/session storage remains unchanged.

## Freeze status

Task 15 is safe to freeze only as a Brain Coach specialist migration slice after review. It is not approval to roll out all Stage 10 specialists, consolidate hosted voice agents, or introduce a global registry.
