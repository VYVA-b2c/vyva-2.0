# Task 17 / Stage 10C — Medication Specialist Migration

Task 17 migrates one narrow Medication orchestration slice: user-initiated medication management, adherence-report and refill-context navigation that already exists in the legacy medication voice/action surface.

This is not a dose-confirmation, prescribing, interaction-checking, refill-execution, caregiver, memory, proactive or scheduling migration.

## Current legacy boundary

Medication currently enters through the voice router as the `meds` domain and through existing medication routes such as `/api/meds`, `/api/meds/adherence-report`, `/api/meds-assistant`, `/api/meds-voice-transcribe` and `/api/meds-voice-parse`.

The client voice action registry already defines medication actions for:

- `meds.management`
- `meds.inventory_report`
- `meds.refill_request`

Those actions open existing medication surfaces. Actual medication records, adherence confirmation, safety cases, medication updates, caregiver summaries and refill/pharmacy-related follow-through remain under existing legacy route and UI authority.

## Migration boundary

The new Medication Specialist is an adapter over existing medication navigation/context behavior. It may propose the existing `tool.voice.open_app_action` bridge, but it does not execute it directly.

The migrated slice supports:

- opening medication management;
- opening the medication adherence/report surface;
- proposing refill-context navigation with confirmation required.

Migration eligibility is intentionally narrower than generic medication intent. A request must express explicit existing navigation/context intent, such as opening or showing medications, the medication schedule, the adherence report, medication inventory or refill context. General medication mentions do not become migrated actions merely because the router domain is `meds`.

The migrated slice does not:

- confirm, defer, skip or complete doses;
- create, edit, delete or discontinue medications;
- prescribe, dose-adjust or provide individualized medication instructions;
- check interactions or side effects as a clinical authority;
- contact pharmacies, providers, caregivers or operators;
- mutate caregiver permissions;
- write memory;
- create PostgreSQL durability;
- introduce a Medication Domain Supervisor;
- introduce a new global Specialist registry.

## Flow, Presentation and Specialist identity

- Specialist ID: `medication`
- Specialist version: `1.0.0`
- Flow ID: `medication.reminder`
- Flow version: `1.0.0`
- Scene ID: `medication.reminder.main`
- Optional proposed tool: `tool.voice.open_app_action`

Task 17 reuses existing canonical Presentation Registry IDs:

- `presentation.medication.reminder`
- `presentation.medication.followup`
- `presentation.medication.human_help_confirmation`

The `medication.reminder` Flow ID already exists in the frozen generated catalogue and is kept for compatibility with the existing medication presentation references. Task 17 narrows its migrated runtime usage to pilot-only medication navigation/context. Existing medication confirmation, defer, missed-dose, refill-check, supply-check, side-effect and adherence-follow-up catalogue entries remain reserved for later slices.

## Feature flag and rollback

The server-side flag is:

- `VYVA_MEDICATION_SPECIALIST_MODE=legacy_only | disabled | specialist_preview`
- `VYVA_MEDICATION_SPECIALIST_ALLOW_USERS`
- `VYVA_MEDICATION_SPECIALIST_DENY_USERS`
- `VYVA_MEDICATION_SPECIALIST_ROLLOUT_BPS`
- `VYVA_MEDICATION_SPECIALIST_ALLOW_PRODUCTION`

Default, disabled, malformed, whitespace-polluted, production-unapproved or denylisted configuration resolves to legacy-only. Denylist takes precedence over allowlist and rollout.

When the flag is off, the existing medication router path remains exact. When the flag is on for an eligible server-side user identity, the router adds structured Medication Specialist metadata and prompt guidance while preserving the existing ElevenLabs medication agent, existing router response shape, current medication API authority and current client action bridge.

## Safety and medication authority

Deterministic safety still runs before Medication Specialist augmentation. Emergency or acute-harm medication wording such as overdose, taking too much, allergic/adverse reaction, severe dizziness/fainting tied to medication, dangerous medication-plus-alcohol risk and suicidal overdose is preempted before Medication Specialist selection.

Non-emergency clinical medication advice remains migration-ineligible and receives no Medication Specialist metadata or tool proposal in Task 17. This includes dosing questions, starting/stopping/reducing medication, skip/missed-dose decisions, interactions, contraindications and side effects. Dose-confirmation and medication-record mutation language also remains legacy fallback. The Specialist cannot mark a dose as taken, alter a schedule, update a medication, or claim any external action happened.

## Privacy and observability

Task 17 exposes stable non-sensitive orchestration metadata:

- selected Specialist and Flow IDs;
- validation outcome;
- action type;
- capability;
- presentation ID;
- tool-proposal decision;
- fallback reason.

Tool observability describes whether the Specialist proposal was allowed by local contract validation, rejected by local contract validation, or not requested. It is not evidence that the Central Orchestrator authorized a tool or that any tool executed.

Raw medication utterances and medication names are not copied into the new Specialist request, prompt block, dynamic variables or session data. Existing legacy medication routes and UI remain responsible for any user-visible medication details they already handle.

## PostgreSQL

No migration is required for Task 17. This slice introduces no new durable Medication truth. Existing medication tables and routes remain the source of truth for records, adherence logs, safety cases, updates and caregiver summaries.

## Safe-to-freeze meaning

Task 17 is safe to freeze only as a flag-gated Medication Specialist migration slice after review. It is not approval to roll out all Stage 10 specialists, execute medication tools directly, redesign medication safety/adherence/scheduling, or activate broader Medication runtime rollout.
