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
2. Start with touch, complete with keyboard where possible, and repeat with voice commands.
3. Use Spanish or intentionally long labels and confirm no horizontal overflow or clipped touch target.
4. Enter partial details, go back, edit, and confirm the entered information is preserved.
5. Refresh or simulate reconnect while in an editable scene and confirm the draft restores.
6. Leave or close the app/browser while in an editable scene, reopen it, and confirm the same draft restores without losing entered information.
7. Refresh or simulate reconnect while waiting/saving/completing and confirm the request is not resubmitted.
8. Cancel or exit from each non-terminal scene and confirm no write or external action occurs.
9. Reach review and confirm no result/reference appears before explicit final confirmation.
10. Click or speak confirmation twice and confirm only one action attempt is accepted.
11. Force a recoverable service failure and confirm the blocked state explains what happened and offers retry or exit.
12. Confirm waiting, blocked, and completed states are announced to assistive technology.
13. Turn the flow flag off or rollout to zero, focus/refresh the page, and confirm Canvas closes or disappears in favor of the existing experience.

For task hub resume, verify:

- local shopping and refill drafts resume into the destination only while that destination Canvas flag is enabled;
- local shopping and refill drafts fall back to the existing destination experience when the destination Canvas flag is disabled or rolled back;
- pending provider replies and stale pending tasks resume through the safe Concierge task path;
- completed tasks can be reused as templates without rewriting history;
- leaving a task detail returns to the task list without calling details, completion, or confirmation endpoints.

## Sign-off gate

Keep `docs/audits/voice-canvas-real-device-qa-matrix.md` marked **pending execution** while any deployed real-device row still needs evidence. Before enabling Canvas for real users, every required environment, device, interaction mode, behavior, rollback, task hub destination fallback, copy/accessibility, analytics signal, privacy, and sign-off row must remain present; environment rows must include a real URL, commit SHA, browser/version evidence, voice session mode, dated analytics review, and concrete flag states; device rows must name the real phone, tablet, and desktop/laptop evidence; interaction rows must name voice, touch, and keyboard evidence for each flow; behavior rows must name the checked behavior instead of only saying that QA passed, including app exit/reopen restoration, voice interruption/recovery, browser-back preservation/no-write behavior, cancel/exit no-write behavior, recoverable failure retry/exit, and an explicit no-external-action-before-confirmation result; feature endpoint rows must match the launch manifest endpoint/server key and include concrete disabled, enabled, malformed-config, missing-config, rollback, and fallback evidence; malformed or missing feature config must fail closed to disabled/fallback behavior; task hub destination rows must prove enabled resume, disabled destination fallback, and no writes before confirmation; evidence cells must include dated QA or reviewer notes; copy/accessibility rows must name the specific checked behavior and matching screenshots, keyboard/focus notes, screen-reader announcement notes, reduced-motion notes, or copy read-through evidence; analytics signal rows must name the canonical source event and aggregate count reviewed for started, resumed, abandoned, blocked, confirmed, and completed; privacy rows must state that forbidden data was absent and point to analytics/telemetry review evidence; every `Pending` cell must be replaced with a passing result/evidence note; no row may contain a failed/blocked/not-ready result; all final sign-off roles must include a name, a `YYYY-MM-DD` date, and an approved-for-launch decision; and the matrix `Status` must be changed to **ready for launch**.

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
