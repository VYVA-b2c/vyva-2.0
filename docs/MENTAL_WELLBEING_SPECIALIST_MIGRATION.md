# Task 16 / Stage 10B — Mental Wellbeing Specialist Migration

Task 16 migrates one narrow Mental Wellbeing orchestration slice: ordinary, user-initiated wellbeing support that is currently handled by the legacy `companion` route and existing companion/social semantics.

This is not a therapy, diagnosis, crisis, memory, caregiver, proactive or scheduling migration.

## Current legacy boundary

The current router has no standalone `mental_wellbeing` runtime domain. Ordinary stress, low mood, loneliness, grounding and wellbeing-support requests fall through to the legacy `companion` route unless deterministic safety preemption wins first.

The migrated Specialist therefore adapts the existing companion/social support boundary instead of creating a new voice agent, router, global registry or presentation system.

## Flow and Specialist identity

- Specialist ID: `mental_wellbeing`
- Specialist version: `1.0.0`
- Flow ID: `wellbeing.support`
- Flow version: `1.0.0`
- Scene ID: `wellbeing.support.main`
- Tool proposals: none in Task 16

The Flow is catalogued as pilot-only and non-clinical. It has no required or optional tools, no memory writes, no proactive follow-up and no database migration.

## Presentation Registry integration

Task 16 reuses the existing shared Presentation Registry families:

- `presentation.family.summary`
- `presentation.family.input.free_text`
- `presentation.family.error.safe_fallback`

The additive canonical presentation IDs are:

- `presentation.wellbeing.support.summary`
- `presentation.wellbeing.support.checkin`
- `presentation.wellbeing.support.safe_fallback`

These IDs are semantic orchestration contracts. They do not name React components, CSS, layouts or Home voice-mode visual behavior.

## Feature flag and rollback

The server-side flag is:

- `VYVA_MENTAL_WELLBEING_SPECIALIST_MODE=legacy_only | disabled | specialist_preview`
- `VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_USERS`
- `VYVA_MENTAL_WELLBEING_SPECIALIST_DENY_USERS`
- `VYVA_MENTAL_WELLBEING_SPECIALIST_ROLLOUT_BPS`
- `VYVA_MENTAL_WELLBEING_SPECIALIST_ALLOW_PRODUCTION`

Default, disabled, malformed, whitespace-polluted, production-unapproved or denylisted configuration resolves to legacy-only. When the flag is off, the existing companion route remains exact. When the flag is on for an eligible server-side user identity, the router adds structured Mental Wellbeing Specialist metadata and prompt guidance while preserving the existing final response path.

## Safety and clinical boundary

Safety remains above Mental Wellbeing. Explicit self-harm, direct death-intent wording and emergency-style breathing distress are routed through the existing deterministic safety preemption seam before normal companion/Mental Wellbeing augmentation. Voluntary calming or breathing-exercise requests remain ordinary Mental Wellbeing support when the legacy companion semantics support them.

The Specialist is not clinical. It must not diagnose, infer a condition, prescribe treatment, adjust medication, replace safety escalation with calming content, write mental-health memory, disclose content to caregivers or start proactive engagement.

## Persistence

Task 16 requires no database migration. It introduces no new durable Mental Wellbeing state and no PostgreSQL source of truth.

## Safe-to-freeze meaning

Task 16 is safe to freeze only as a flag-gated Mental Wellbeing Specialist migration slice after review. It is not approval to roll out all Stage 10 specialists, build a global registry, redesign crisis policy, or activate proactive Mental Wellbeing outreach.
