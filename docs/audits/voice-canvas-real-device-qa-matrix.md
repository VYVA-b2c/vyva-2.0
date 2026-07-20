# Voice Canvas real-device QA sign-off matrix

Status: **pending execution**  
Use this file to record the deployed, real-device launch-readiness pass for ride, appointment, medication refill, shopping or delivery, provider reply, and task hub resume.

Do not mark the Canvas launch-readiness goal complete until every required row below has a passing result, an evidence link or note, and a reviewer/date note with explicit reviewed, verified, validated, approved, or sign-off wording.

Execute the real-device pass with `docs/audits/voice-canvas-real-device-run-sheet.md`, prepare sanitized artifact references in `docs/audits/voice-canvas-real-device-evidence-packet.md`, then copy the matching reviewer/date review wording and evidence notes into this matrix.

Keep `Status` as **pending execution** until this matrix is fully filled. For final launch sign-off, change it to **ready for launch** only after every required environment, device, interaction mode, behavior, rollback, task hub destination fallback, copy/accessibility, analytics signal, privacy, evidence artifact inventory, and sign-off row remains present; every `Pending` cell is replaced with a passing result/evidence note; environment rows must name deployed URL, commit/build, test account, browsers, live voice session, analytics review, and rollout states and must not say those values were missing, unavailable, unreachable, not returned, not reviewed, not verified, or not working; environment flag rows explicitly state initial enabled true/rollout 100 and rollback disabled false/rollout 0 states; device rows name affirmative real physical phone, tablet, and desktop/laptop evidence plus screenshot, photo, or artifact evidence that does not include transcripts, entered text, addresses, or personal details and must not contain not-tested, not-real, unavailable, failed-to-load/render/open/work/display/run, unable-to-test/use/verify, broken, crashed, blank-screen, white-screen, unusable, viewport, emulator, simulator, responsive-mode, device-toolbar, or DevTools evidence; interaction rows and evidence notes name voice, touch, keyboard, affirmative completion or safe-exit outcome, and a concrete screenshot, recording, log, or artifact reference for each flow that does not include transcripts, entered text, addresses, or personal details, never not-completed or not-tested wording; behavior rows name the checked behavior affirmatively, explicitly prove entered information preservation where a user can leave, resume, go back, reconnect, be interrupted, or retry after a recoverable failure, explicitly prove open-session feature-flag rollback closed or hid Canvas and restored the existing fallback path, and must not say required outcomes were not restored, not preserved, not offered, not prevented, not ignored, unreadable, unavailable, or triggered; feature rows include disabled false/rollout 0, enabled true/rollout 100, malformed-config, missing-config, rollback, and existing fallback path evidence and must not say required payloads/responses/flags/rollouts were missing, unavailable, or not returned, fallback was missing, unavailable, not visible, or not shown, or rollback/disable/enable/fallback did not happen; task hub destination rows prove enabled resume, disabled fallback to the named existing destination path, and no writes or external actions before confirmation, and must not say resume did not happen, fallback was missing or unavailable, no-write/no-external-action checks failed, or a write/external action/endpoint/booking/call/message/navigation happened; evidence cells include affirmative dated QA or reviewer notes with a valid non-future `YYYY-MM-DD` calendar date and must not say evidence was missing, not reviewed, not captured, unverified, or contradict the row with any rejected negative outcome wording; copy/accessibility rows name the specific checked behavior and matching evidence, keyboard-only rows prove completion or safe exit for every flow, focus rows prove focus moved to the new scene heading or control, waiting-state rows explain what is pending or in progress and what has not happened, screen-reader evidence covers waiting, blocked, and completed announcements, and rows must not say required outcomes were not announced, not verified, not readable, not usable, not focused, did not move, does not move, failed to explain, unavailable, missing announcements, announcements missing, missing focus, had no retry, had no exit, overflowed, clipped, or truncated; the Spanish long-label row explicitly states readable or legible labels plus no overflow, clipping, or truncation; analytics signal rows name the canonical source event and positive numeric aggregate count reviewed, evidence must include a concrete analytics artifact/query/dashboard/log reference, and evidence must not say forbidden data was recorded, logged, sent, captured, included, stored, retained, or present; privacy rows must name the specific forbidden data class in result and evidence, explicitly state that class was absent, not recorded, logged, sent, captured, or included, point to a concrete analytics artifact/query/dashboard/log reference, not merely that there was no issue or concern, and neither result nor evidence may also state that forbidden data was recorded, logged, sent, captured, included, stored, retained, or present; artifact inventory rows must map sanitized concrete artifacts to environment, device, interaction, behavior, endpoint, task hub, copy/accessibility, analytics signal, analytics privacy, run-sheet validation, and launch preflight evidence without personal details; no row contains a failed/blocked/not-ready result; app exit/reopen restoration is recorded separately from refresh/reconnect; and all final sign-off roles have a name, a non-future `YYYY-MM-DD` date, an unconditional approved-for-launch decision, and notes with concrete reviewed, verified, confirmed, or completed launch evidence rather than vague approval-only notes like `OK`, `N/A`, `looks good`, or `no notes`, with no pending fixes, conditions, follow-up work, retests, open issues, or blockers. Then run:

The evidence artifact inventory must also include the rollback owner handoff artifact row, mapping sanitized owner/backup, decision-window, rollback-trigger, endpoint/fallback/open-session, privacy-boundary, and fallback-readiness proof before launch.

Environment analytics sink review must point to dated concrete dashboard/query/log/artifact evidence, and initial plus rollback flag-state cells must include dated feature-flag artifact/log evidence proving the enabled and rollout values. This environment artifact/log/dashboard evidence must be concrete; prose-only reviewed or verified environment wording does not satisfy launch sign-off.

```bash
npm run test -- src/components/voice-canvas/canvasLaunchSignoff.test.ts src/components/voice-canvas/canvasLaunchReadiness.test.ts src/components/voice-canvas/validateVoiceCanvasQaMatrixCommand.test.ts src/components/voice-canvas/validateVoiceCanvasRunSheetCommand.test.ts src/components/voice-canvas/validateVoiceCanvasEvidencePacketCommand.test.ts src/components/voice-canvas/preflightVoiceCanvasLaunchReadinessCommand.test.ts
```

While this matrix is still being filled, run:

```bash
npm run canvas:qa:validate -- --allow-pending
```

The pending-mode validator prints incomplete cells by section, so use that output to confirm each evidence area is being filled before the final launch gate.

Use `npm run --silent canvas:qa:validate -- --allow-pending --json` when you need a machine-readable validator artifact for QA dashboards, CI logs, or launch evidence.

Use `npm run --silent canvas:qa:validate -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-qa-summary.json` to save that summary as a run-specific artifact, replacing `YYYY-MM-DD` with the QA run date. Existing output files are preserved by default; pass `--force` only when intentionally replacing an artifact.

Use `npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=enabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json` to capture a sanitized deployed endpoint artifact for the enabled flag state, replacing the date and base URL for the QA run. After rollback, capture a second artifact with `npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=rollback-disabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json`. The command performs GET requests only, rejects local/private/placeholder hosts by default, preserves existing artifacts unless `--force` is explicit, and records only endpoint/status/cache-control/timing plus expected state, `enabled`, `rolloutPercent`, recognized payload keys, and unexpected-key count. Launch evidence must show the matching expected-state label, `Cache-Control: no-store`, enabled true/rollout 100 for the enabled artifact, enabled false/rollout 0 for the rollback-disabled artifact, and an integer `rolloutPercent` from 0 through 100. It does not record raw response bodies, unexpected field names, transcripts, entered text, addresses, saved-place labels, medication details, provider details, shopping details, account identifiers, or personal data.

Use `npm run --silent canvas:qa:analytics -- --input=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json --json --output=artifacts/voice-canvas/YYYY-MM-DD-analytics-validation.json` to validate the sanitized analytics evidence artifact before filling analytics signal and privacy rows. The validator requires coveredFlows for ride, appointment, refill, shopping, provider_reply, and task_hub_resume plus positive observed sample counts for started, resumed, abandoned, blocked, confirmed, and completed; completed may be proven by `completed` or terminal `pending` samples; accepts only the closed telemetry envelope fields `name`, `step`, `input`, `attempt`, `restored`, and optional `revision`; preserves existing output unless `--force` is explicit; and never copies raw sample rows, unexpected field names, addresses, transcripts, entered text, dates, names, medication details, provider details, shopping details, or account identifiers into its output.

Use `npm run --silent canvas:qa:rollback-owner -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md` to prepare the sanitized rollback owner handoff artifact, then validate the filled handoff with `npm run --silent canvas:qa:rollback-owner -- --input=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-validation.json` before filling the rollback owner handoff artifact inventory row and Operations/rollback owner final sign-off.

Final preflight must include `--rollback-owner=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md` with the enabled endpoint, rollback endpoint, and analytics artifacts so launch sign-off fails if the rollback owner handoff is missing or invalid. Those external evidence artifacts must share one QA run date.

Use `npm run --silent canvas:qa:packet -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-evidence-packet-summary.json` after filling `docs/audits/voice-canvas-real-device-evidence-packet.md` and before copying evidence into this matrix. The packet validator confirms required inventory, flow, and evidence-note rows remain present; reports pending packet cells by section; preserves existing output unless `--force` is explicit; and rejects unsafe artifact references without copying raw artifact-reference values into output.

For final launch sign-off, run without `--allow-pending` and do not enable Canvas unless it passes:

```bash
npm run canvas:qa:validate
```

## Environment record

For final sign-off, use launch-specific values here: a deployed non-local `http` or `https` environment URL, a build or commit SHA, named browser versions, the live non-mock voice session mode, an affirmative analytics review note with a valid non-future `YYYY-MM-DD` date, and concrete enabled/disabled rollout states. Analytics sink reviewed must point to dated concrete dashboard/query/log/artifact evidence. Initial flag state must explicitly state enabled true and rollout 100 with dated feature-flag artifact/log evidence; rollback flag state must explicitly state disabled false and rollout 0 with dated feature-flag artifact/log evidence. The environment URL must not be localhost, loopback, private-network, `.local`, `.test`, `.example`, mock, or other non-deployed evidence. Environment values must be affirmative and must not say the test account, browser, voice session, provider, environment, URL, commit/build, analytics sink, flag, rollout, or payload was missing, unavailable, unreachable, not returned, not reviewed, not verified, or not working.

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

For final sign-off, phone/tablet/desktop cells must affirmatively name the real physical device class or browser used. Device cells and evidence notes must not use negative wording such as not tested, not real, unavailable, missing, failed to load/render/open/work/display/run, unable to test/use/verify, broken, crashed, blank screen, white screen, or unusable. Evidence must include a dated QA or reviewer note with a valid non-future `YYYY-MM-DD` date that names real phone, tablet, and desktop/laptop coverage plus screenshot, photo, or artifact evidence, must not rely on viewport, emulator, simulator, responsive-mode, device-toolbar, or DevTools evidence, and must not include transcripts, entered text, addresses, or personal details.

| Flow | Phone | Tablet | Desktop/laptop | Evidence |
| --- | --- | --- | --- | --- |
| Ride Voice Canvas | Pending | Pending | Pending | Pending |
| Appointment Voice Canvas | Pending | Pending | Pending | Pending |
| Medication Refill Voice Canvas | Pending | Pending | Pending | Pending |
| Shopping Delivery Voice Canvas | Pending | Pending | Pending | Pending |
| Provider Reply Voice Canvas | Pending | Pending | Pending | Pending |
| Concierge Task Hub Resume | Pending | Pending | Pending | Pending |

## Interaction mode coverage

Each flow must be completed or safely exited using voice, touch, and keyboard. For final sign-off, each cell must name the interaction mode tested and affirmatively state that the flow was completed or safely exited rather than only saying that QA passed. Negative wording such as not completed, not safely exited, or not tested is rejected in both result and evidence notes. Evidence must include a dated QA or reviewer note with a valid non-future `YYYY-MM-DD` date that names voice, touch, keyboard, completion or safe exit, and a concrete screenshot, recording, log, or artifact reference. Do not include spoken transcripts, entered text, addresses, or other personal details in the artifact.

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

For final sign-off, each behavior cell must name the behavior checked, such as start/resume, app exit/reopen restoration, refresh/reconnect, voice interruption and recovery, browser back, cancel/exit, flag rollback/fallback, confirmation safety, duplicate/stale guard, recoverable failure retry/exit, senior-friendly copy, or privacy-safe analytics. The start/resume cell must state that resumed work or the current scene restored with entered information preserved and without a write, resubmission, or external action. The app-exit/reopen cell must state that reopening restored the draft with entered information preserved and without a write, resubmission, or external action. The refresh/reconnect cell must state that refreshed or reconnected work was restored with entered information preserved and without a write, resubmission, or external action. The voice-interruption cell must state that interrupted work was recovered and preserved with entered information preserved and without a write, resubmission, or external action. The browser-back cell must state that back navigation safely returned or preserved entered information without a write or external action. The cancel/exit cell must state that cancelling and exiting leaves safely without a write or external action. The flag rollback/fallback cell must state that flag rollback happened during an open session, Canvas closed or disappeared, and the existing or previous safe fallback path was restored without a write or external action. The confirmation-safety cell must explicitly state that no external action, no write, no booking, no call, no message, and no navigation happens before explicit confirmation. Behavior cells that require no-write evidence must explicitly say no write or without write; softer submission-only or no-external-action wording is not enough to prove the write boundary. Behavior cells that require no-external-action evidence must explicitly say no external action or without external action; softer sent/submitted wording is not enough to prove the external-action boundary. The duplicate/stale cell must state that duplicate confirmation or action attempts were prevented, blocked, ignored, rejected, or discarded, and stale responses were ignored, rejected, or discarded; softer submission-only wording such as not submitted or not resubmitted is not enough. The recoverable-failure retry cell must state that retry and exit or cancel were offered with entered information preserved and without an extra write, resubmission, or external action; generic recovery wording without an exit or cancel path is not enough. The senior-friendly copy cell must state that copy uses one clear decision, readable or legible labels or touch targets, and explains what happens next. Merely mentioning long labels is not enough. The privacy-safe analytics cell must state that only aggregate analytics signals or counts were reviewed with no sensitive or forbidden data recorded. Behavior evidence notes must include dated artifact/log/screenshot coverage for resume, recovery, rollback, confirmation safety, senior copy, privacy, and no side effects, and those artifacts must not include transcripts, entered text, addresses, or personal details; generic screenshot/log evidence is not enough. Behavior cells and evidence notes must be affirmative; negative wording such as not restored, not preserved, not offered, not prevented, not ignored, unreadable, unavailable, or triggered action is rejected. Evidence must include a dated QA or reviewer note with a valid non-future `YYYY-MM-DD` date.

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

For final sign-off, the endpoint and server key must match the launch manifest exactly. The disabled payload cell must state `enabled: false` or equivalent and rollout `0`; the enabled payload cell must state `enabled: true` or equivalent and rollout `100`. Malformed-config and missing-config cells must describe the observed state, not just say that the row passed: they must state fail-closed behavior, disabled/false/rollout-0 behavior, and fallback behavior. Rollback cells must state that the flow was disabled or set to rollout 0 and that the existing or previous fallback path became visible in-session. Fallback cells must name the existing, previous, or specific fallback path; `fallback shown` or `existing fallback shown` alone is not enough. Feature rows and evidence notes must not say required payloads, responses, flags, or rollouts were missing, unavailable, or not returned; must not say fallback was missing, unavailable, not visible, or not shown; and must not say rollback, disable, enable, or fallback did not happen. Evidence must include a dated QA or reviewer note with a valid non-future `YYYY-MM-DD` date that names the exact endpoint, server key, named fallback path, endpoint artifact/log/trace evidence, and endpoint payload evidence for malformed config, missing config, disabled false/rollout 0, enabled true/rollout 100, rollback, and fallback.

Endpoint artifacts must be sanitized network logs, traces, captures, links, `canvas:qa:features` JSON artifacts, or equivalent artifacts and must not include transcripts, entered text, addresses, or personal details. The endpoint collector artifact can prove deployed endpoint reachability and current enabled/rollout payload shape; malformed-config and missing-config fail-closed behavior still need the matching deployment log, trace, or environment artifact.

| Flow | Endpoint | Server key | Disabled payload checked | Enabled payload checked | Malformed config checked | Missing config checked | In-session rollback checked | Existing fallback shown | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ride Voice Canvas | `/api/config/features/ride-voice-canvas` | `ride` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Appointment Voice Canvas | `/api/config/features/appointment-voice-canvas` | `appointment` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Medication Refill Voice Canvas | `/api/config/features/medication-refill-voice-canvas` | `medicationRefill` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Shopping Delivery Voice Canvas | `/api/config/features/shopping-delivery-voice-canvas` | `shoppingDelivery` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Provider Reply Voice Canvas | `/api/config/features/provider-reply-voice-canvas` | `providerReply` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

## Task hub destination fallback checks

Task hub resume inherits the destination flow flags. For final sign-off, each row must prove the destination opens only when the destination Canvas flag is enabled, falls back to the safe existing path when the destination flag is disabled or rolled back, and performs no writes or external actions before explicit confirmation. The destination flag/fallback cell must name the existing, previous, safe Concierge, or no-Canvas destination path; `fallback` or `existing fallback` alone is not enough. The no-side-effects cell must explicitly mention both no writes and no external actions before confirmation; softer submission-only wording such as `not submitted` or `without submitting` is not enough. Evidence must include dated artifact resume, disabled fallback, no-write, and no-external-action coverage for the specific task hub path, and artifacts must not include transcripts, entered text, addresses, or personal details; generic screenshot/log evidence is not enough. Task hub rows and evidence notes must be affirmative and must not say resume did not happen, fallback was missing or unavailable, no-write/no-external-action checks failed, or a write, external action, endpoint, booking, call, message, or navigation happened.

| Task hub resume path | Resume route behavior | Destination flag/fallback behavior | No pre-confirmation side effects | Evidence |
| --- | --- | --- | --- | --- |
| Local shopping draft | Pending | Pending | Pending | Pending |
| Local medication refill draft | Pending | Pending | Pending | Pending |
| Pending provider reply task | Pending | Pending | Pending | Pending |
| Stale or blocked task | Pending | Pending | Pending | Pending |

## Copy and accessibility read-through

For final sign-off, each result cell must name the specific behavior checked, not just say that QA passed. Keyboard-only rows must prove completion or safe exit for every flow. Focus rows must prove focus moved to the new scene heading or control when scenes changed. Waiting-state copy must explain what is pending or in progress and what has not happened yet. Screen-reader evidence must cover waiting, blocked, and completed announcements. Result and evidence cells must be affirmative and must not say required outcomes were not announced, not verified, not readable, not usable, not focused, did not move, does not move, failed to explain, unavailable, missing announcements, announcements missing, missing focus, had no retry, had no exit, overflowed, clipped, or truncated. The Spanish long-label result must explicitly say labels remain readable or legible and have no horizontal overflow, clipping, or truncation. The evidence note must explicitly name the checked outcome, not just say a screenshot was reviewed. Evidence cells must point to matching screenshots, keyboard/focus notes, screen-reader announcement notes for waiting, blocked, and completed states, reduced-motion notes, or copy read-through evidence, and must explicitly name checked outcomes such as one clear decision for each flow, Spanish long-label readability without overflow, waiting pending/no-action copy, blocked retry/exit copy, completed outcome/no-extra-action copy, keyboard completion or safe exit for each flow, focus movement, or calm usable reduced-motion behavior.

Use the Copy/accessibility evidence template from `docs/audits/voice-canvas-real-device-run-sheet.md` or `docs/audits/voice-canvas-real-device-evidence-packet.md` before filling this matrix. Matrix evidence should preserve the exact observations for One clear decision, Spanish long labels, Waiting state, Blocked state, Completed state, Keyboard, Focus movement, Screen-reader announcements, Reduced-motion behavior, and the privacy check that the artifact contains no transcripts, entered text, addresses, medication details, provider details, shopping details, account identifiers, or personal data.

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

Confirm production or staging analytics receives the required aggregate launch signals. For final sign-off, source-event cells must match the canonical mapping, result cells must mention the aggregate signal/count reviewed with a positive numeric count, and evidence must include dated source-event, positive aggregate count, and allowed-envelope evidence, plus a concrete analytics artifact/query/dashboard/log reference with a valid non-future `YYYY-MM-DD` date. Evidence must name the launch signal and its canonical source event so generic analytics-review notes are not enough. Completed can use `completed` or terminal `pending` source-event evidence; generic `pending` wording without the terminal-result qualifier is not enough. Evidence must not say forbidden data was recorded, logged, sent, captured, included, stored, retained, or present. A zero count does not prove the signal was observed.

Attach or reference the matching `canvas:qa:analytics` validation artifact when available; it proves the exported samples were closed-envelope only and that all six launch signals had positive observed sample counts.

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

For final sign-off, each result and evidence cell must name the specific forbidden data class for that row. Each result must state that the forbidden data class was absent or was not recorded, logged, sent, captured, or included. A vague result such as "no sensitive data," "no issue found," or "no concern" is not enough, and neither the result nor evidence may also say forbidden data was recorded, logged, sent, captured, included, stored, retained, or present. Each evidence cell must point to dated analytics or telemetry review evidence with a concrete analytics artifact/query/dashboard/log reference, a valid non-future `YYYY-MM-DD` date, and a statement that the sample contained only allowed envelope fields.

The `canvas:qa:analytics` validation artifact can support these rows by proving the sample schema, but the matrix result and evidence still must name each forbidden data class and state it was absent, not recorded, logged, sent, captured, or included.

| Forbidden data class | Result | Evidence |
| --- | --- | --- |
| Spoken transcripts | Pending | Pending |
| Typed free text | Pending | Pending |
| Addresses or saved-place labels | Pending | Pending |
| Ride pickup, dropoff, destination, or route details | Pending | Pending |
| Medication names, strengths, quantities, or symptoms | Pending | Pending |
| Provider names, reply text, notes, references, phone numbers, or emails | Pending | Pending |
| Shopping item names, prices, fees, or retailer names | Pending | Pending |
| Dates, times, identities, or contact details | Pending | Pending |

## Evidence artifact inventory

Use this inventory to map sanitized artifact references back to the matrix rows they prove. Do not attach or link artifacts that include spoken transcripts, entered text, addresses, saved-place labels, medication details, provider names, reply text, notes, references, dates, times, shopping item details, account identifiers, or other personal details.

For final sign-off, every row must name the covered launch evidence, point to sanitized concrete artifacts such as screenshots, photos, recordings, logs, traces, captures, dashboards, queries, JSON validation artifacts, or artifact links, and include a reviewer/date note with a valid non-future `YYYY-MM-DD` date plus explicit reviewed, verified, validated, approved, or sign-off wording. Generic artifact-bucket notes, prose-only reviewed wording, or generic closeout notes such as `pass`, `done`, or `OK` do not satisfy launch sign-off. This inventory must include rollback owner handoff, run-sheet validation, and launch preflight artifacts before the matrix is marked ready.

| Artifact set | Coverage | Sanitized artifact reference | Reviewer/date |
| --- | --- | --- | --- |
| Environment and flag artifacts | Pending | Pending | Pending |
| Real-device screenshots or photos | Pending | Pending | Pending |
| Interaction recordings or logs | Pending | Pending | Pending |
| Behavior recovery artifacts | Pending | Pending | Pending |
| Feature endpoint artifacts | Pending | Pending | Pending |
| Task hub resume artifacts | Pending | Pending | Pending |
| Rollback owner handoff artifacts | Pending | Pending | Pending |
| Copy and accessibility artifacts | Pending | Pending | Pending |
| Analytics signal artifacts | Pending | Pending | Pending |
| Analytics privacy artifacts | Pending | Pending | Pending |
| Run sheet validation artifacts | Pending | Pending | Pending |
| Launch preflight artifacts | Pending | Pending | Pending |

## Final sign-off

Final sign-off notes must name concrete and role-specific launch evidence that was reviewed, verified, confirmed, or completed. Product notes must cover real-use evidence, senior copy, what happens next, and privacy or analytics readiness. Engineering notes must cover rollback, stale or duplicate guards, and feature-flag fallback safety. QA notes must cover the real-device matrix plus voice, touch, and keyboard coverage. Operations/rollback owner notes must cover rollback ownership, backup owner, decision window, rollback trigger, enable-false or disabled rollout-0 action, sanitized endpoint/fallback/open-session evidence, Canvas closed or hidden behavior, privacy boundary, and fallback readiness. Vague approval-only notes such as `OK`, `N/A`, `looks good`, or `no notes` are rejected by the sign-off gate.

| Role | Name | Date | Decision | Notes |
| --- | --- | --- | --- | --- |
| Product | Pending | Pending | Pending | Pending |
| Engineering | Pending | Pending | Pending | Pending |
| QA | Pending | Pending | Pending | Pending |
| Operations/rollback owner | Pending | Pending | Pending | Pending |
