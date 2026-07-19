# Voice Canvas launch readiness and rollback

This checklist is the final preflight before enabling Canvas-powered Concierge flows for real users. It covers ride, appointment, medication refill, shopping or delivery, provider reply, and task hub resume.

Current audit status is tracked in `docs/audits/voice-canvas-launch-readiness-audit.md`. Record deployed real-device results in `docs/audits/voice-canvas-real-device-qa-matrix.md`. Do not treat the feature as launch-signed-off until that audit shows the deployed/manual checklist is complete.

## Launch invariants

- No booking, call, message, navigation, order, refill request, provider reply, completion, or other external action occurs before an explicit final confirmation.
- A duplicate confirmation is ignored while the first request is in flight.
- A late or stale response is ignored if the user has retried, edited material details, cancelled, or left the scene.
- Restored drafts can return to editable or review scenes; restored `waiting`, `saving`, `completing`, or in-flight requests must not resubmit automatically.
- The visible state and voice state describe the same next step.
- The user always has a clear exit path.
- The feature must fail closed to the existing Concierge experience when its flag is off, malformed, or unreachable.

## Runtime controls

| Flow | Endpoint | Server key | Enable flag | Rollout flag | Fallback |
| --- | --- | --- | --- | --- | --- |
| Ride | `/api/config/features/ride-voice-canvas` | `ride` | `VYVA_ENABLE_RIDE_VOICE_CANVAS` | `VYVA_RIDE_VOICE_CANVAS_ROLLOUT_PERCENT` | Existing Concierge transport panel |
| Appointment | `/api/config/features/appointment-voice-canvas` | `appointment` | `VYVA_ENABLE_APPOINTMENT_VOICE_CANVAS` | `VYVA_APPOINTMENT_VOICE_CANVAS_ROLLOUT_PERCENT` | Existing appointment panel |
| Medication refill | `/api/config/features/medication-refill-voice-canvas` | `medicationRefill` | `VYVA_ENABLE_MEDICATION_REFILL_VOICE_CANVAS` | `VYVA_MEDICATION_REFILL_VOICE_CANVAS_ROLLOUT_PERCENT` | Existing medication refill shopping/support path |
| Shopping or delivery | `/api/config/features/shopping-delivery-voice-canvas` | `shoppingDelivery` | `VYVA_ENABLE_SHOPPING_DELIVERY_VOICE_CANVAS` | `VYVA_SHOPPING_DELIVERY_VOICE_CANVAS_ROLLOUT_PERCENT` | Existing shopping guide and recommendations |
| Provider reply | `/api/config/features/provider-reply-voice-canvas` | `providerReply` | `VYVA_ENABLE_PROVIDER_REPLY_VOICE_CANVAS` | `VYVA_PROVIDER_REPLY_VOICE_CANVAS_ROLLOUT_PERCENT` | Existing provider reply panel |
| Task hub resume | Inherits the destination flow controls | No separate key | No separate flag | No separate rollout | The task hub opens the safe existing destination when a destination Canvas is off |

Start at internal-only, then 5%, 25%, 50%, and 100% only after reviewing scene-only completion, abandonment, retry, blocked, and failure counts.

## Privacy-safe analytics

Allowed Canvas telemetry fields are only:

- `name`
- `step`
- `input`
- `attempt`
- `restored`
- `revision`

Never record addresses, saved-place labels, spoken transcripts, typed free text, medication names or strengths, symptoms, provider names or contact details, reply bodies, notes, references, dates, times, shopping item names, retailer names, prices, fees, phone numbers, email addresses, account IDs, profile IDs, patient IDs, or personal identifiers in Canvas telemetry.

Canonical launch signals are derived from the closed event shape:

| Launch signal | Source event |
| --- | --- |
| Started | `scene_viewed` with `restored: false` |
| Resumed | `draft_restored`, or `scene_viewed` with `restored: true` |
| Abandoned | `abandoned` |
| Blocked | `failed`, `urgent_help_shown`, or a blocked scene view |
| Confirmed | `confirmation_submitted` |
| Completed | `completed` |

`saved` is intentionally not treated as completed. Provider reply uses one confirmation to save the reply and a separate confirmation to mark the task complete.

Use the shared launch telemetry counter/listener only as an aggregate monitor. It may count `started`, `resumed`, `abandoned`, `blocked`, `confirmed`, and `completed`, and its samples must stay limited to the allowed envelope fields above.

## Real-device QA pass

Run this pass for each flow: ride, appointment, refill, shopping, provider reply, and task hub resume.

1. Open on desktop, tablet, and mobile widths.
2. Start with touch, complete or safely exit with keyboard where possible, and repeat with voice commands.
3. Use Spanish or intentionally long labels and confirm labels stay readable or legible with no horizontal overflow, clipping, truncation, or clipped touch target.
4. Enter partial details, go back, edit, and confirm the entered information is preserved.
5. Refresh or simulate reconnect while in an editable scene and confirm the draft restores with entered information preserved.
6. Leave or close the app/browser while in an editable scene, reopen it, and confirm the same draft restores without losing entered information and without a write, resubmission, or external action.
7. Refresh or simulate reconnect while waiting/saving/completing and confirm the request is not resubmitted and the user can still recover without losing entered information.
8. Cancel or exit from each non-terminal scene and confirm no write or external action occurs.
9. Reach review and confirm no result/reference appears before explicit final confirmation.
10. Click or speak confirmation twice and confirm only one action attempt is accepted.
11. Force a recoverable service failure and confirm the blocked state explains what happened, offers retry or exit, and does not create an extra write, resubmission, or external action.
12. Confirm waiting states explain what is pending or in progress and what has not happened yet, and confirm waiting, blocked, and completed states are announced to assistive technology.
13. Turn the flow flag off or rollout to zero, focus/refresh the page, and confirm Canvas closes or disappears in favor of the existing experience.

For task hub resume, verify:

- local shopping and refill drafts resume into the destination only while that destination Canvas flag is enabled;
- local shopping and refill drafts fall back to the existing destination experience when the destination Canvas flag is disabled or rolled back;
- pending provider replies and stale pending tasks resume through the safe Concierge task path;
- completed tasks can be reused as templates without rewriting history;
- leaving a task detail returns to the task list without calling details, completion, or confirmation endpoints.

## Sign-off gate

Keep `docs/audits/voice-canvas-real-device-qa-matrix.md` marked **pending execution** while any deployed real-device row still needs evidence. Before enabling Canvas for real users, every required environment, device, interaction mode, behavior, rollback, task hub destination fallback, copy/accessibility, analytics signal, privacy, and sign-off row must remain present; environment rows must include a deployed non-local URL, commit SHA, browser/version evidence, live non-mock voice session mode, affirmative valid non-future `YYYY-MM-DD` analytics review, initial enabled true/rollout-100 flag state, and rollback disabled false/rollout-0 flag state, and must not say the test account, browser, voice session, provider, environment, URL, commit/build, analytics sink, flag, rollout, or payload was missing, unavailable, unreachable, not returned, not reviewed, not verified, or not working; device rows and evidence notes must name affirmative real physical phone, tablet, and desktop/laptop evidence and must not contain not-tested, not-real, unavailable, failed-to-load/render/open/work/display/run, unable-to-test/use/verify, broken, crashed, blank-screen, white-screen, unusable, viewport, emulator, simulator, responsive-mode, device-toolbar, or DevTools evidence; interaction rows and evidence notes must name voice, touch, and keyboard evidence plus affirmative completion or safe-exit outcome for each flow and must not contain not-completed, not-safely-exited, or not-tested wording; behavior rows and evidence notes must name the checked behavior affirmatively instead of only saying that QA passed, including start/resume restored-work/entered-information-preserved/no-write/no-resubmission behavior, app-exit/reopen restored-draft/entered-information-preserved/no-write/no-resubmission behavior, refresh/reconnect restored-work/entered-information-preserved/no-write/no-resubmission behavior, voice-interruption preserved-work/entered-information-preserved/no-write/no-resubmission recovery, browser-back entered-information-preservation/no-write behavior, cancel/exit no-write behavior, open-session flag-rollback Canvas-closed existing-fallback/no-write behavior, duplicate-prevention/stale-response ignoring, recoverable-failure retry/exit entered-information-preserved/no-write/no-resubmission behavior, senior-friendly one-clear-decision/readable-or-legible-label copy behavior, privacy-safe aggregate/no-sensitive analytics behavior, and explicit no-external-action/no-write/no-booking/no-call/no-message/no-navigation-before-confirmation evidence, and must not say required outcomes were not restored, not preserved, not offered, not prevented, not ignored, unreadable, unavailable, or triggered; feature endpoint rows and evidence notes must match the launch manifest endpoint/server key and include concrete disabled false/rollout-0 payload evidence, enabled true/rollout-100 payload evidence, malformed-config and missing-config evidence that explicitly states fail-closed disabled fallback behavior, rollback disabled/rollout-0 with existing-fallback-visible evidence, and fallback evidence that names the actual existing, previous, or specific fallback path rather than generic existing-fallback wording, and must not say required payloads/responses/flags/rollouts were missing, unavailable, or not returned, fallback was missing, unavailable, not visible, or not shown, or rollback/disable/enable/fallback did not happen; task hub destination rows and evidence notes must prove enabled resume, disabled destination fallback to the named actual existing/safe destination path, and no writes or external actions before confirmation, and must not say resume did not happen, fallback was missing or unavailable, no-write/no-external-action checks failed, or a write/external action/endpoint/booking/call/message/navigation happened; evidence cells must include affirmative QA or reviewer notes with a valid non-future `YYYY-MM-DD` calendar date and must not say evidence was missing, not reviewed, not captured, unverified, or contradict the row with rejected negative outcome wording; copy/accessibility rows and evidence notes must name the specific checked behavior and matching screenshots, keyboard-only rows must prove completion or safe exit for every flow, focus rows must prove focus moved to the new scene heading or control, waiting-state rows must explain what is pending or in progress and what has not happened, screen-reader announcement notes must cover waiting, blocked, and completed states, reduced-motion notes, or copy read-through evidence and must not say required outcomes were not announced, not verified, not readable, not usable, not focused, did not move, does not move, failed to explain, unavailable, missing announcements, announcements missing, missing focus, had no retry, had no exit, overflowed, clipped, or truncated; Spanish long-label rows must explicitly state readable or legible labels plus no overflow, clipping, or truncation; analytics signal rows must name the canonical source event and positive numeric aggregate count reviewed for started, resumed, abandoned, blocked, confirmed, and completed, and analytics signal evidence must not say forbidden data was recorded, logged, sent, captured, included, stored, retained, or present; zero-count analytics rows do not prove observation; privacy rows must state that forbidden data was absent, not recorded, logged, sent, captured, or included, not merely that there was no issue or concern, neither result nor evidence may also state that forbidden data was recorded, logged, sent, captured, included, stored, retained, or present, and must point to dated analytics/telemetry evidence with only allowed envelope fields and a valid non-future `YYYY-MM-DD` date; every `Pending` cell must be replaced with a passing result/evidence note; no row may contain a failed/blocked/not-ready result; all final sign-off roles must include a name, a non-future `YYYY-MM-DD` date, an unconditional approved-for-launch decision, and notes with concrete reviewed, verified, confirmed, or completed launch evidence rather than vague approval-only notes like `OK`, `N/A`, `looks good`, or `no notes`, with no pending fixes, conditions, follow-up work, retests, open issues, or blockers; and the matrix `Status` must be changed to **ready for launch**.

For recoverable failures, the behavior row must explicitly prove both retry and an exit or cancel path. Generic recovery wording without a clear exit/cancel path does not satisfy launch sign-off.

For behavior rows that require no-write evidence, explicitly state no write or without write. Submission-only wording such as `not submitted`, `nothing submitted`, or `without submitting`, and no-external-action wording by itself, does not prove the write boundary for launch sign-off.

For behavior rows that require no-external-action evidence, explicitly state no external action or without external action. Sent/submitted shorthand such as `nothing sent`, `nothing submitted`, or `not submitted` does not prove the external-action boundary for launch sign-off.

For duplicate/stale guard behavior, explicitly state that duplicate confirmation or action attempts were prevented, blocked, ignored, rejected, or discarded, and that stale responses were ignored, rejected, or discarded. Submission-only wording such as `not submitted` or `not resubmitted` is not enough for launch sign-off.

For task hub destination rows, the no-side-effects cell must explicitly prove both no writes and no external actions before confirmation. Submission-only wording such as `not submitted` or `without submitting` is not enough for launch sign-off.

Run the sign-off gate after filling the matrix:

```bash
npm run test -- src/components/voice-canvas/canvasLaunchSignoff.test.ts src/components/voice-canvas/canvasLaunchReadiness.test.ts
```

If this gate fails, do not enable the feature.

## Focused verification commands

Run the focused component/readiness suite:

```bash
npm run test -- server/lib/canvasFeatureFlags.test.ts src/components/voice-canvas/canvasPlatform.test.tsx src/components/voice-canvas/canvasPlatformCompliance.test.ts src/components/voice-canvas/canvasLaunchTelemetry.test.ts src/components/voice-canvas/canvasLaunchReadiness.test.ts src/components/voice-canvas/canvasLaunchSignoff.test.ts src/components/voice-canvas/providerReplyCanvasRollout.test.ts src/components/voice-canvas/ShoppingVoiceCanvas.test.tsx src/components/voice-canvas/ProviderReplyVoiceCanvas.test.tsx src/pages/ConciergeShoppingScreen.test.tsx src/pages/ConciergeTaskInboxPage.test.tsx src/pages/AdherenceReportScreen.actions.test.tsx
```

Run the browser readiness specs:

```bash
npm run test:e2e -- e2e/voice-canvas-production-readiness.spec.ts e2e/appointment-canvas-production-readiness.spec.ts e2e/medication-refill-canvas-production-readiness.spec.ts e2e/canvas-launch-readiness.spec.ts e2e/task-hub-resume-launch-readiness.spec.ts
```

Run typecheck before PR:

```bash
npm run typecheck
```

## Immediate rollback

1. Set the affected flow enable flag to `false` and its rollout percentage to `0`.
2. Restart the app process if runtime environment variables are read at process start.
3. Verify the feature endpoint returns `{ "enabled": false, "rolloutPercent": 0 }`.
4. Open the affected Concierge entry point and confirm the old interface appears.
5. Focus or refresh any open session and confirm Canvas closes without submitting in-flight work.
6. Monitor only privacy-safe aggregate counts: started, resumed, abandoned, blocked, confirmed, completed, retried, and failed. Do not attach addresses, transcripts, entered text, dates, names, references, or task details to launch telemetry.

Rollback immediately for any pre-confirmation external action, duplicate submission, sensitive telemetry field, stale response acceptance, unsafe restore, inaccessible blocked state, or broken fallback.
