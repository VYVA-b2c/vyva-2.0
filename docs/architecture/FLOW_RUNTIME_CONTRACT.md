# Flow Runtime Contract

Task 20 defines the frozen architecture contract for future Flow runtime work.
It is documentation and contract code only. It does not activate a runtime
engine, route traffic, alter the Flow Catalogue, change the Presentation
Registry, or approve broader rollout.

## Canonical invariant

```text
User intent
→ Central Orchestrator
→ one authoritative Active Flow
→ optional Specialist proposal
→ Presentation Registry projection
→ Voice / Touch / Text Channel Adapter
```

The Central Orchestrator is the only global authority over route selection,
active Flow identity, lifecycle transitions, interruption/resume, safety
precedence, tool authorization, final user-facing response, and UI
synchronization.

Voice, touch and text are modalities of the same authoritative Flow state. They
must not create independent Flow IDs, independent lifecycle state, or
modality-specific answer semantics.

## Reused frozen contracts

This contract sits on top of the already-frozen building blocks:

- Task 1 interaction events and Flow state;
- Task 2 Specialist proposal contracts;
- Task 3 Flow Catalogue;
- Task 3.5 Presentation Registry;
- Task 4 Central Orchestrator policy contracts;
- Task 5 compatibility boundary;
- Task 6 Orchestrator shell;
- Task 7 shared event/state runtime;
- Task 8 proactive engagement policy;
- Task 9 through Task 19 migrated domain slices.

Task 20 adds alignment rules. It does not replace those contracts.

## Runtime lifecycle vocabulary

Task 20 uses a compact runtime vocabulary for planning and handoff. It maps
conservatively onto the Task 1 Flow lifecycle.

| Task 20 state | Meaning | Task 1 lifecycle states |
| --- | --- | --- |
| `idle` | No active user journey Flow. | `idle` |
| `collecting` | Waiting for user input for the current authoritative question/scene. | `waiting_for_user` |
| `confirming` | Waiting for confirmation before a sensitive/privileged step. | `active`, `waiting_for_user` |
| `active` | Flow logic, Specialist validation, or authorized tool work is in progress. | `initializing`, `active`, `waiting_for_tool` |
| `interrupted` | A higher-priority interruption has preempted ordinary progress. | `interrupted` |
| `resumable` | Flow is paused and may resume after revalidation. | `paused`, `resuming` |
| `complete` | Flow reached a successful terminal outcome. | `completed` |
| `error` | Flow reached an exception or exit classification. | `failed`, `cancelled`, `expired`, `escalated` |

Important nuance: Task 1 can allow recovery such as `failed -> resuming` when
the frozen Flow-state transition contract permits it. Task 20 `error` is a
planning/exit classification, not a universal claim that every failed state is
permanently unrecoverable.

## Authority boundaries

| Concern | Authority |
| --- | --- |
| Active Flow selection | Central Orchestrator |
| Lifecycle transition | Central Orchestrator |
| Safety precedence | Central Orchestrator deterministic safety policy |
| Specialist reasoning | Proposal-only Specialist |
| Tool execution | Tool Adapter after Orchestrator authorization |
| Presentation selection | Presentation Registry projection |
| Rendering | Channel Adapter / frontend |
| Durable structured truth | PostgreSQL |
| Semantic memory | Optional policy-controlled Mem0, never Flow authority |

Frontend screens, voice canvases, channel adapters and presentation components
may render or submit events. They must not become a second source of truth for
Flow progression.

## Persisted versus temporary state

Persist only structured Flow/domain state that must survive refresh, retry,
resume, idempotency checks, audit, or backend recovery.

Do not persist ephemeral UI details merely because a Flow screen exists. Examples
that normally remain temporary include animation state, local hover/focus,
client loading spinners, visual card expansion, voice orb pulsing, and transient
screen layout state.

## Per-flow presentation binding layer

PR #1043 added useful per-flow presentation binding vocabulary. Task 20 keeps
that concept, but makes it explicitly subordinate to the canonical runtime
contract above.

A per-flow runtime presentation contract may bind:

- Flow ID/version and owner Specialist;
- Task 1 lifecycle start/terminal/resumable states;
- persisted and transient state fields;
- Presentation Registry IDs and scene IDs;
- presentation pattern;
- supported runtime modes;
- mobile and larger-screen copy density;
- allowed tool IDs;
- approval gate;
- interruption categories.

This binding helps future screen tasks avoid guessing how a Flow should appear.
It does not authorize runtime routing by itself.

### Presentation patterns

| Pattern | Intended use |
| --- | --- |
| `voice_orb_idle`, `voice_orb_connecting`, `voice_orb_listening`, `voice_orb_speaking` | Voice-channel status, always tied to voice mode. |
| `touch_card_menu` | Touch card choice entry. |
| `guided_choice`, `guided_form`, `progress_status`, `review_confirm`, `result_summary` | Cross-channel Flow scenes. |
| `safe_fallback`, `handoff_status` | Safety, fallback, escalation, or handoff scenes. |

Voice-orb patterns must include voice mode. Touch-card menu patterns must include
touch mode. Duplicate runtime state fields are rejected.

### Approval gates

Allowed gate labels are:

- `none`;
- `user_confirmation`;
- `caregiver_approval`;
- `operator_handoff`;
- `clinical_escalation`.

Any external action must require confirmation before execution and must have a
non-`none` approval gate. A Specialist may propose an action; it may not execute
the action directly.

### Interruption kinds

Allowed interruption labels are:

- `sos`;
- `caregiver`;
- `safety`;
- `stop`;
- `timeout`;
- `mode_switch`.

These are classification labels for presentation/runtime contracts. They do not
create an arbitrary global interruption stack or new resume engine.

## Voice, touch and text handoff

All answer channels must normalize into the same authoritative input shape before
Flow progression:

```text
spoken answer / tapped answer / typed answer
→ normalized answer event
→ stale scene and question validation
→ Central Orchestrator
→ same Flow transition path
```

Stale scene/question submissions fail closed. A delayed voice answer or old touch
callback must never be rebound to the newest question.

## Tool and action policy

Flow contracts may document proposed tools/actions, but tool execution remains
outside the Specialist and presentation layers. The Orchestrator must authorize
tool calls before any Tool Adapter executes external work.

This contract does not approve SMS, email, WhatsApp, phone calls, bookings,
payments, orders, contact outreach, clinical advice, medication dosing,
caregiver permission mutation, proactive delivery, or provider execution unless
the relevant frozen task already created and approved that narrow boundary.

## Future and parallel Flow task contract

Any future Flow task should return a row with these fields before implementation:

| Field | Required answer |
| --- | --- |
| Flow name | User-facing or architecture name |
| Flow ID/version | Existing canonical ID/version or proposed new ID/version |
| Owner | Specialist/domain owner |
| Voice behavior | Voice semantics, not raw copy |
| Touch behavior | Touch semantics, not raw copy |
| Presentation IDs | Existing/proposed registry IDs |
| Persisted state | What survives retry/resume/audit |
| Temporary state | UI/session-only state |
| Tool permissions | None, proposal-only, authorized, or unresolved |
| Confirmation gates | User/caregiver/operator/clinical gates |
| Interruptions | SOS, caregiver, safety, stop, timeout, mode switch |
| Terminal states | Complete/error/defer/fallback semantics |
| Runtime activation | Must be `not_approved` until separately reviewed |

If this row cannot be filled without inventing product behavior, the Flow is not
ready for implementation.

## Explicit deferrals

Task 20 deliberately does not introduce:

- a new global Flow engine;
- a new Specialist registry;
- runtime activation;
- frontend-owned routing;
- voice-specific or touch-specific Flow state machines;
- multiple active primary Flows;
- persisted ephemeral UI state;
- Mem0 authority over Flow state;
- caregiver-support authority changes;
- external contact execution;
- booking, payment, order or checkout execution;
- clinical medication or mental-health authority;
- proactive delivery execution;
- Home-specific orb behavior outside Home;
- broad dependency, schema, API or UI refactors.

## Freeze status

Task 20 is safe to freeze only as an architectural runtime contract and alignment
map. It is not safe for runtime activation, rollout, routing changes, or
production behavior changes without a later approved implementation task.
