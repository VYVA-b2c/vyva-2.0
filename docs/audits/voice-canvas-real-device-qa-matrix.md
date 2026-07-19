# Voice Canvas real-device QA sign-off matrix

Status: **pending execution**  
Use this file to record the deployed, real-device launch-readiness pass for ride, appointment, medication refill, shopping or delivery, provider reply, and task hub resume.

Do not mark the Canvas launch-readiness goal complete until every required row below has a passing result, an evidence link or note, and a reviewer/date.

Keep `Status` as **pending execution** until this matrix is fully filled. For final launch sign-off, change it to **ready for launch** only after every required environment, device, interaction mode, behavior, rollback, task hub destination fallback, copy/accessibility, analytics signal, privacy, and sign-off row remains present; every `Pending` cell is replaced with a passing result/evidence note; environment flag rows explicitly state initial enabled true/rollout 100 and rollback disabled false/rollout 0 states; device rows name real physical phone, tablet, and desktop/laptop evidence, not viewport, emulator, simulator, responsive-mode, device-toolbar, or DevTools evidence; interaction rows name voice, touch, and keyboard evidence plus affirmative completion or safe-exit outcome for each flow, never not-completed or not-tested wording; behavior rows name the checked behavior instead of only saying that QA passed; feature rows include disabled false/rollout 0, enabled true/rollout 100, malformed-config, missing-config, rollback, and existing fallback path evidence; task hub destination rows prove enabled resume, disabled fallback to the named existing destination path, and no writes or external actions before confirmation; evidence cells include affirmative dated QA or reviewer notes with a valid `YYYY-MM-DD` calendar date and must not say evidence was missing, not reviewed, not captured, or unverified; copy/accessibility rows name the specific checked behavior and matching evidence; the Spanish long-label row explicitly states readable or legible labels plus no overflow, clipping, or truncation; analytics signal rows name the canonical source event and positive numeric aggregate count reviewed; privacy rows explicitly state forbidden data was absent, not recorded, logged, sent, captured, or included, not merely that there was no issue or concern; no row contains a failed/blocked/not-ready result; app exit/reopen restoration is recorded separately from refresh/reconnect; and all final sign-off roles have a name, a `YYYY-MM-DD` date, and an unconditional approved-for-launch decision with no pending fixes, conditions, or follow-up blockers. Then run:

```bash
npm run test -- src/components/voice-canvas/canvasLaunchSignoff.test.ts src/components/voice-canvas/canvasLaunchReadiness.test.ts
```

## Environment record

For final sign-off, use launch-specific values here: a deployed non-local `http` or `https` environment URL, a build or commit SHA, named browser versions, the live non-mock voice session mode, an affirmative analytics review note with a valid `YYYY-MM-DD` date, and concrete enabled/disabled rollout states. Initial flag state must explicitly state enabled true and rollout 100; rollback flag state must explicitly state disabled false and rollout 0. The environment URL must not be localhost, loopback, private-network, `.local`, `.test`, `.example`, mock, or other non-deployed evidence.

| Field | Value |
| --- | --- |
| Environment URL | Pending |
| Build or commit SHA | Pending |
| Test account | Pending |
| Browser versions | Pending |
| Voice provider/session mode | Pending |
| Analytics sink reviewed | Pending |
| Initial flag state | Pending |
| Rollback flag state | Pending |

## Device coverage

Each flow must pass on a real phone, tablet, and desktop/laptop. Browser emulation is useful preflight evidence, but it does not replace this table.

For final sign-off, phone/tablet/desktop cells must name the real physical device class or browser used. Evidence must include a dated QA or reviewer note and must not rely on viewport, emulator, simulator, responsive-mode, device-toolbar, or DevTools evidence.

| Flow | Phone | Tablet | Desktop/laptop | Evidence |
| --- | --- | --- | --- | --- |
| Ride Voice Canvas | Pending | Pending | Pending | Pending |
| Appointment Voice Canvas | Pending | Pending | Pending | Pending |
| Medication Refill Voice Canvas | Pending | Pending | Pending | Pending |
| Shopping Delivery Voice Canvas | Pending | Pending | Pending | Pending |
| Provider Reply Voice Canvas | Pending | Pending | Pending | Pending |
| Concierge Task Hub Resume | Pending | Pending | Pending | Pending |

## Interaction mode coverage

Each flow must be completed or safely exited using voice, touch, and keyboard. For final sign-off, each cell must name the interaction mode tested and affirmatively state that the flow was completed or safely exited rather than only saying that QA passed. Negative wording such as not completed, not safely exited, or not tested is rejected. Evidence must include a dated QA or reviewer note.

| Flow | Voice | Touch | Keyboard | Evidence |
| --- | --- | --- | --- | --- |
| Ride Voice Canvas | Pending | Pending | Pending | Pending |
| Appointment Voice Canvas | Pending | Pending | Pending | Pending |
| Medication Refill Voice Canvas | Pending | Pending | Pending | Pending |
| Shopping Delivery Voice Canvas | Pending | Pending | Pending | Pending |
| Provider Reply Voice Canvas | Pending | Pending | Pending | Pending |
| Concierge Task Hub Resume | Pending | Pending | Pending | Pending |

## Required behavior checklist

Record one pass/fail line for each flow and behavior. If a behavior is not applicable, explain why and identify the substitute evidence.

For final sign-off, each behavior cell must name the behavior checked, such as start/resume, app exit/reopen restoration, refresh/reconnect, voice interruption and recovery, browser back, cancel/exit, flag rollback/fallback, confirmation safety, duplicate/stale guard, recoverable failure retry/exit, senior-friendly copy, or privacy-safe analytics. The start/resume cell must state that resumed work or the current scene restored without a write, resubmission, or external action. The app-exit/reopen cell must state that reopening restored the draft without a write, resubmission, or external action. The refresh/reconnect cell must state that refreshed or reconnected work was restored without a write, resubmission, or external action. The voice-interruption cell must state that interrupted work was recovered and preserved without a write, resubmission, or external action. The browser-back cell must state that back navigation safely returned or preserved work without a write or external action. The cancel/exit cell must state that cancelling and exiting leaves safely without a write or external action. The flag rollback/fallback cell must state that rollback restored the existing or previous safe fallback path without a write or external action. The confirmation-safety cell must explicitly state that no external action, no write, no booking, no call, no message, and no navigation happens before explicit confirmation. The duplicate/stale cell must state that duplicate confirmation or action attempts were prevented and stale responses were ignored, rejected, or discarded. The recoverable-failure retry cell must state that retry and exit were offered without an extra write, resubmission, or external action. The senior-friendly copy cell must state that copy uses one clear decision, readable or legible labels or touch targets, and explains what happens next. Merely mentioning long labels is not enough. The privacy-safe analytics cell must state that only aggregate analytics signals or counts were reviewed with no sensitive or forbidden data recorded. Evidence must include a dated QA or reviewer note.

| Flow | Start/resume | App exit/reopen | Refresh/reconnect | Voice interruption | Browser back | Cancel/exit | Flag rollback/fallback | No external action before explicit confirmation | Duplicate/stale guard | Recoverable failure retry | Senior-friendly copy and what happens next | Privacy-safe analytics | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ride Voice Canvas | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Appointment Voice Canvas | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Medication Refill Voice Canvas | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Shopping Delivery Voice Canvas | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Provider Reply Voice Canvas | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Concierge Task Hub Resume | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

## Feature endpoint and rollback checks

For each endpoint, verify disabled, enabled, malformed or missing config behavior, and an in-session rollback from Canvas to the existing path.

For final sign-off, the endpoint and server key must match the launch manifest exactly. The disabled payload cell must state `enabled: false` or equivalent and rollout `0`; the enabled payload cell must state `enabled: true` or equivalent and rollout `100`. Malformed-config and missing-config cells must describe the observed state, not just say that the row passed: they must state fail-closed behavior, disabled/false/rollout-0 behavior, and fallback behavior. Rollback cells must state that the flow was disabled or set to rollout 0 and that the existing or previous fallback path became visible in-session. Fallback cells must name the existing, previous, or specific fallback path; `fallback shown` alone is not enough. Evidence must include a dated QA or reviewer note.

| Flow | Endpoint | Server key | Disabled payload checked | Enabled payload checked | Malformed config checked | Missing config checked | In-session rollback checked | Existing fallback shown | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ride Voice Canvas | `/api/config/features/ride-voice-canvas` | `ride` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Appointment Voice Canvas | `/api/config/features/appointment-voice-canvas` | `appointment` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Medication Refill Voice Canvas | `/api/config/features/medication-refill-voice-canvas` | `medicationRefill` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Shopping Delivery Voice Canvas | `/api/config/features/shopping-delivery-voice-canvas` | `shoppingDelivery` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Provider Reply Voice Canvas | `/api/config/features/provider-reply-voice-canvas` | `providerReply` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

## Task hub destination fallback checks

Task hub resume inherits the destination flow flags. For final sign-off, each row must prove the destination opens only when the destination Canvas flag is enabled, falls back to the safe existing path when the destination flag is disabled or rolled back, and performs no writes or external actions before explicit confirmation. The destination flag/fallback cell must name the existing, previous, safe Concierge, or no-Canvas destination path; `fallback` alone is not enough. The no-side-effects cell must explicitly mention both no writes and no external actions before confirmation.

| Task hub resume path | Resume route behavior | Destination flag/fallback behavior | No pre-confirmation side effects | Evidence |
| --- | --- | --- | --- | --- |
| Local shopping draft | Pending | Pending | Pending | Pending |
| Local medication refill draft | Pending | Pending | Pending | Pending |
| Pending provider reply task | Pending | Pending | Pending | Pending |
| Stale or blocked task | Pending | Pending | Pending | Pending |

## Copy and accessibility read-through

For final sign-off, each result cell must name the specific behavior checked, not just say that QA passed. The Spanish long-label result must explicitly say labels remain readable or legible and have no horizontal overflow, clipping, or truncation. Evidence cells must point to matching screenshots, keyboard/focus notes, screen-reader announcement notes, reduced-motion notes, or copy read-through evidence.

| Check | Result | Evidence |
| --- | --- | --- |
| English copy uses one clear decision at a time | Pending | Pending |
| Spanish copy and long labels remain readable without horizontal overflow | Pending | Pending |
| Waiting states explain what is happening and what is not happening | Pending | Pending |
| Blocked states explain what is needed and provide retry or exit | Pending | Pending |
| Completed states explain the outcome without implying extra action | Pending | Pending |
| Keyboard-only completion works for each flow | Pending | Pending |
| Focus moves meaningfully when scenes change | Pending | Pending |
| Screen-reader announcements fire for waiting, blocked, and completed states | Pending | Pending |
| Reduced-motion mode remains calm and usable | Pending | Pending |

## Analytics signal review

Confirm production or staging analytics receives the required aggregate launch signals. For final sign-off, source-event cells must match the canonical mapping, result cells must mention the aggregate signal/count reviewed with a positive numeric count, and evidence must include a dated analytics or telemetry note with only allowed envelope fields. A zero count does not prove the signal was observed.

| Launch signal | Source event verified | Aggregate result | Evidence |
| --- | --- | --- | --- |
| Started | Pending | Pending | Pending |
| Resumed | Pending | Pending | Pending |
| Abandoned | Pending | Pending | Pending |
| Blocked | Pending | Pending | Pending |
| Confirmed | Pending | Pending | Pending |
| Completed | Pending | Pending | Pending |

## Analytics privacy review

Confirm production or staging analytics receives only the allowed Canvas telemetry envelope fields: `name`, `step`, `input`, `attempt`, `restored`, and `revision`.

For final sign-off, each result must state that the forbidden data class was absent or was not recorded, logged, sent, captured, or included. A vague result such as "no issue found" or "no concern" is not enough. Each evidence cell must point to dated analytics or telemetry review evidence and state that the sample contained only allowed envelope fields.

| Forbidden data class | Result | Evidence |
| --- | --- | --- |
| Spoken transcripts | Pending | Pending |
| Typed free text | Pending | Pending |
| Addresses or saved-place labels | Pending | Pending |
| Medication names, strengths, quantities, or symptoms | Pending | Pending |
| Provider names, reply text, notes, references, phone numbers, or emails | Pending | Pending |
| Shopping item names, prices, fees, or retailer names | Pending | Pending |
| Dates, times, identities, or contact details | Pending | Pending |

## Final sign-off

| Role | Name | Date | Decision | Notes |
| --- | --- | --- | --- | --- |
| Product | Pending | Pending | Pending | Pending |
| Engineering | Pending | Pending | Pending | Pending |
| QA | Pending | Pending | Pending | Pending |
| Operations/rollback owner | Pending | Pending | Pending | Pending |
