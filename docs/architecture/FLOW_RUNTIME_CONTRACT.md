# VYVA Flow Runtime Contract

## Purpose

The Flow runtime contract is the handoff layer between the Flow Catalogue,
Presentation Registry, and live UI screens. It does not replace any of them.
It tells implementers what must be joined before a Flow becomes a real user
journey:

- the canonical Flow ID and version;
- the owning Specialist;
- persisted and transient state;
- presentation IDs and mode behavior;
- interruption and resume behavior;
- confirmation gates before tools, payments, bookings, calls, or handoffs.

This is the alignment baseline for parallel Flow work. A Flow is not ready for
runtime just because it has a catalogue row or a screen mockup.

## Authority

| Layer | Decides |
| --- | --- |
| Flow Catalogue | Journey identity, owner, scenes, expected input, safety, consent, outcomes |
| Presentation Registry | Approved visual and voice patterns for each semantic moment |
| Runtime Contract | How a specific Flow binds state, presentations, tools, and interruptions |
| Live screen | Viewport adaptation, current mode, temporary UI state, event emission |

The runtime contract must reference existing catalogue and presentation IDs. It
must not invent a new Flow, new action boundary, or new visual pattern without
updating the source registry first.

## Required Runtime States

Use existing lifecycle states from `shared/orchestration/flowState.ts`.

| State | Meaning |
| --- | --- |
| `idle` | Flow is available but not started |
| `initializing` | Runtime is preparing state, permissions, or provider context |
| `active` | VYVA is guiding the Flow |
| `waiting_for_user` | User input, approval, or correction is required |
| `waiting_for_tool` | A tool or external provider step is pending |
| `interrupted` | SOS, caregiver, safety, mode switch, or stop interrupted the Flow |
| `paused` | Flow can resume later |
| `resuming` | Runtime is restoring the last valid state |
| `completed` | Flow ended with a valid outcome |
| `escalated` | Human, caregiver, clinical, or operator path takes over |
| `cancelled` | User or policy stopped the Flow |
| `expired` | Stored runtime state is no longer valid |
| `failed` | Runtime hit a recoverable or terminal error |

Voice-specific UI states such as connecting, listening, speaking, ending, and
error are transient state fields inside the runtime contract, not separate Flow
lifecycle states.

## Presentation Binding

Every runtime Flow needs explicit bindings from semantic moments to presentation
IDs. The binding chooses a pattern only from the approved runtime pattern list:

| Pattern | Use |
| --- | --- |
| `voice_orb_idle` | Voice-first idle entry |
| `voice_orb_connecting` | Voice session opening |
| `voice_orb_listening` | User is speaking or VYVA is listening |
| `voice_orb_speaking` | VYVA response is being delivered |
| `touch_card_menu` | Touch mode card surface |
| `guided_choice` | One decision at a time |
| `guided_form` | Structured input |
| `progress_status` | Provider/tool/status progress |
| `review_confirm` | User confirms before action |
| `result_summary` | Output or recommendation |
| `safe_fallback` | Recoverable error or safe fallback |
| `handoff_status` | Caregiver, operator, or external provider handoff |

Mobile copy density should default to `heading_only` when there are cards,
results, stats, or actions on screen. Tablet and desktop may use a brief helper
line where it improves comprehension.

## Tool And Approval Boundary

External actions always need an approval gate. Examples include booking,
ordering, payment, provider contact, outbound calls, and any sensitive data
handoff.

The contract must state:

- whether the Flow can execute external actions;
- which tool IDs are allowed;
- whether confirmation is required before the external action;
- whether caregiver approval, operator handoff, or clinical escalation can be
  required.

If a Flow can contact a provider, book, order, pay, call, or submit a form, it
cannot use approval gate `none`.

## Interruption Policy

Each Flow must declare which interruptions it supports:

- `sos`;
- `caregiver`;
- `safety`;
- `stop`;
- `timeout`;
- `mode_switch`.

The contract must state whether the Flow resumes after interruption and which
interruptions are terminal. Mode switch is normally resumable. SOS and stop are
normally terminal for the active voice session, even if the Flow can later be
resumed from stored state.

## Implementation Checklist

Before implementing or modifying a Flow screen:

1. Confirm the Flow exists in `shared/orchestration/flowCatalogue.ts`.
2. Confirm the semantic moment has a registered presentation in
   `shared/orchestration/presentationRegistry.ts`.
3. Add or update a runtime contract row for state, mode behavior, approval, and
   interruption handling.
4. Wire the screen to the presentation contract instead of hardcoding a new
   layout rule.
5. Add tests for mobile copy density, voice/touch mode behavior, confirmation
   gates, and interruption/reset behavior.
