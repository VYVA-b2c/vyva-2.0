# Voice Canvas launch readiness and rollback

This checklist is the final preflight before enabling Canvas-powered Concierge flows for real users. It covers ride, appointment, medication refill, shopping or delivery, provider reply, and task hub resume.

Current audit status is tracked in `docs/audits/voice-canvas-launch-readiness-audit.md`. Execute the staging pass with `docs/audits/voice-canvas-real-device-run-sheet.md`, prepare sanitized evidence references in `docs/audits/voice-canvas-real-device-evidence-packet.md`, then record deployed real-device results in `docs/audits/voice-canvas-real-device-qa-matrix.md`. Do not treat the feature as launch-signed-off until that audit shows the deployed/manual checklist is complete.

Before collecting same-day launch artifacts, generate a dated run plan so every endpoint, analytics, copy-clarity, real-use, entry-surface, rollback-owner, run-sheet, QA-matrix, packet, and preflight artifact uses the same `YYYY-MM-DD` prefix:

```bash
npm run --silent canvas:qa:run -- --date=YYYY-MM-DD --base-url=https://staging.vyva.app --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-evidence-run.json
```

The run-plan helper performs no network calls and writes only the optional JSON run plan. It rejects stale, future, local, or non-HTTPS launch-run settings by default, preserves existing output files unless `--force` is provided, and prints the copy-ready commands for the evidence bundle. The run plan also records the canonical per-flow entry surfaces, real-use QA gates, fallback paths, feature endpoints/server keys, and telemetry events so QA can prove every Canvas-powered flow was exercised from the intended surface with the required behavior checks. If the deployed QA URL is behind a private preview or access gateway, store the gateway credential in an environment variable and add `--request-header-env=Header-Name:ENV_NAME` to the run-plan command. The generated commands pass the header reference to endpoint collection while saving only the header name and environment-variable name, never the credential value.

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

Dedicated per-flow rollout and rollback notes:

- Ride: `docs/runbooks/ride-voice-canvas-rollout.md`
- Appointment: `docs/runbooks/appointment-voice-canvas-rollout.md`
- Medication refill: `docs/runbooks/medication-refill-voice-canvas-rollout.md`
- Shopping or delivery: `docs/runbooks/shopping-delivery-voice-canvas-rollout.md`
- Provider reply: `docs/runbooks/provider-reply-voice-canvas-rollout.md`

## Feature endpoint evidence collection

Before the real-device pass, capture a sanitized deployed endpoint artifact for the enabled rollout state:

```bash
npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=enabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json
```

Then apply rollback flags and capture a second disabled/rollout-0 artifact with a distinct path:

```bash
npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=rollback-disabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json
```

Replace `YYYY-MM-DD` with the QA run date and replace `https://staging.vyva.app` with the deployed staging or production-like origin being tested. The command performs GET requests only. It rejects localhost, private-network, `.local`, `.test`, `.example`, and placeholder hosts unless `--allow-local` is explicitly passed for developer smoke checks, so real launch evidence cannot be accidentally captured from a local app. If the deployed URL is protected by preview-gateway authentication, append `--request-header-env=Header-Name:ENV_NAME`; the collector reads the header value from that environment variable and records only that a header was supplied. Failed endpoint evidence is printed for diagnosis but is not saved to the launch-named artifact path unless `--save-failed` is explicitly passed for a diagnostic artifact. Existing output files are preserved by default; pass `--force` only when intentionally replacing a run-specific artifact.

The artifact stores only the launch-scoped endpoint, server key, expected state, HTTP status, `cache-control`, elapsed time, `enabled`, `rolloutPercent`, recognized payload keys, and an unexpected-key count. `--expected-state=enabled` requires enabled true and rollout 100. `--expected-state=rollback-disabled` requires enabled false and rollout 0. It does not store raw endpoint response bodies, unexpected field names, transcripts, entered text, addresses, saved-place labels, medication details, provider details, shopping details, account identifiers, or other personal data.

The final `canvas:qa:preflight -- --final` gate revalidates endpoint artifacts before launch sign-off. It rejects hand-made, developer-smoke, stale, or reused artifacts that do not include the launch-readiness scope, the matching expected-state label, a non-future ISO `generatedAt` timestamp generated within the last 7 days, a deployed HTTPS non-local `baseUrl`, and per-flow endpoint URLs that match the tested deployed origin. It also rejects endpoint artifacts that include header names, cookies, authorization values, credential references, or authentication metadata that does not match the same-date launch run plan.

Use the enabled and rollback-disabled artifacts in the environment flag rows and feature endpoint rows of the QA matrix. Malformed-config and missing-config fail-closed behavior still require the matching deployment log, trace, or environment artifact.

For the required malformed-config and missing-config trace, print a manifest-filled copy-safe manual evidence template:

```bash
npm run --silent canvas:qa:features -- --trace-template
```

Use this evidence shape from the command output. Replace bracketed placeholders with artifact references and affirmative observations only; do not paste raw response bodies, environment variable values, screenshots with personal data, or unexpected payload field names:

```text
Feature endpoint manual trace evidence, reviewed on [YYYY-MM-DD] by [reviewer]:
- Flow: [flow label]
- Endpoint: [exact /api/config/features/... endpoint]
- Server key: [server feature key]
- Malformed config artifact: [sanitized deployment log/trace/artifact reference]
- Missing config artifact: [sanitized deployment log/trace/artifact reference]
- Observed malformed-config behavior: fail-closed disabled false/rollout 0 and [named fallback path] visible
- Observed missing-config behavior: fail-closed disabled false/rollout 0 and [named fallback path] visible
- Privacy check: artifact contains no raw response body, unexpected field names, transcripts, entered text, addresses, medication details, provider details, shopping details, account identifiers, or personal data
```

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
| Completed | `completed`, or terminal Shopping `pending` result |

`saved` is intentionally not treated as completed. Provider reply uses one confirmation to save the reply and a separate confirmation to mark the task complete. Shopping may end in a terminal `pending` success state when a prepared request is waiting in the task system; that terminal `pending` event counts as a completed Canvas launch signal because the user-visible Canvas flow reached its result.

Use the shared launch telemetry counter/listener only as an aggregate monitor. It may count `started`, `resumed`, `abandoned`, `blocked`, `confirmed`, and `completed`, and its samples must stay limited to the allowed envelope fields above with non-identifying values only.

For analytics signal rows, the evidence note must include dated source-event, positive aggregate count, allowed-envelope evidence, and a concrete analytics artifact/query/dashboard/log reference for the specific launch signal. Generic analytics-review notes do not satisfy launch sign-off.

After exporting a sanitized staging analytics sample, validate it before copying evidence into the matrix:

```bash
npm run --silent canvas:qa:analytics -- --input=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json --json --output=artifacts/voice-canvas/YYYY-MM-DD-analytics-validation.json
```

If QA needs a safe starting shape for the analytics input, print the intentionally incomplete template first:

```bash
npm run --silent canvas:qa:analytics -- --template
```

The template is copy-safe but not launch evidence. Replace the placeholder timestamp, source, zero counts, and empty sample array with real staging or production-like aggregate evidence before validation.

The input JSON must be an object with `generatedAt`, `source`, `coveredFlows`, `samples` or `events`, and optional `counts`. `generatedAt` must be a non-future ISO timestamp generated within the last 7 days, `source` must identify staging, production, or a concrete analytics dashboard/query/export/log artifact so launch sign-off cannot rely on anonymous event arrays, local smoke fixtures, or stale exports, and `coveredFlows` must list every launch flow ID: `ride`, `appointment`, `refill`, `shopping`, `provider_reply`, and `task_hub_resume`. Every sample must contain only `name`, `step`, `input`, `attempt`, `restored`, and optional `revision`, and the allowed values must remain non-identifying. The validator requires a positive observed sample count for started, resumed, abandoned, blocked, confirmed, and completed; `completed` may be proven by `completed` or terminal `pending` samples. Optional declared aggregate counts must also be positive. It writes only aggregate validation results and never copies raw sample rows, unexpected field names, unsafe allowed values, addresses, transcripts, entered text, dates, names, medication details, provider details, shopping details, or account identifiers into its output. Existing validation artifacts are preserved by default; pass `--force` only when intentionally replacing a run-specific artifact.

## Copy clarity evidence

Prepare the senior-friendly copy and what-happens-next evidence artifact from the manifest-filled copy-safe template:

```bash
npm run --silent canvas:qa:copy -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-copy-clarity.md
```

Validate the filled copy artifact before copying copy/accessibility proof into the evidence packet and matrix:

```bash
npm run --silent canvas:qa:copy -- --input=artifacts/voice-canvas/YYYY-MM-DD-copy-clarity.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-copy-clarity-validation.json
```

The filled artifact must prove every launch flow uses warm plain senior-friendly restrained copy, presents one clear decision at a time, explains what happens next for primary, secondary/back/cancel/exit, waiting, blocked, and completed states, handles long translated Spanish labels without overflow on mobile, tablet, and desktop, moves focus meaningfully, announces waiting/blocked/completed states to screen readers, and respects reduced motion. Use sanitized dated copy review, screenshot, capture, accessibility, or a11y artifact references only.

## Real-use device and interaction evidence

Prepare the real-use device and interaction evidence artifact from the manifest-filled copy-safe template:

```bash
npm run --silent canvas:qa:real-use -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-real-use-coverage.md
```

Fill it only with deployed QA proof that every launch flow completed or safely exited on real physical phone/mobile, tablet, and desktop/laptop sessions plus voice, touch, and keyboard paths. Each row must include dated sanitized screenshot, photo, recording, log, capture, or artifact references plus no-write/no-external-action proof before explicit confirmation.

Validate the filled real-use artifact before copying device and interaction proof into the evidence packet and matrix:

```bash
npm run --silent canvas:qa:real-use -- --input=artifacts/voice-canvas/YYYY-MM-DD-real-use-coverage.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-real-use-validation.json
```

Prepare the entry surface evidence artifact from the manifest-filled copy-safe template:

```bash
npm run --silent canvas:qa:entry-surfaces -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces.md
```

Fill it only with deployed QA proof that every canonical launch surface for every flow was exercised, including dated sanitized screenshot, log, recording, capture, photo, or artifact references. Each surface row must prove no write and no external action happened before explicit confirmation.

Validate the filled entry surface artifact before copying its proof into the evidence packet and matrix:

```bash
npm run --silent canvas:qa:entry-surfaces -- --input=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces-validation.json
```

Prepare the rollback owner handoff artifact from the manifest-filled copy-safe template:

```bash
npm run --silent canvas:qa:rollback-owner -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md
```

Fill it only with the real launch owner/backup, decision window, rollback trigger, rollback action, endpoint/fallback/open-session evidence, privacy boundary, and fallback readiness. Do not add personal data.

Validate the filled handoff before final preflight:

```bash
npm run --silent canvas:qa:rollback-owner -- --input=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-validation.json
```

The final `canvas:qa:preflight -- --final` command must include `--run-plan=artifacts/voice-canvas/YYYY-MM-DD-launch-evidence-run.json`, `--copy=artifacts/voice-canvas/YYYY-MM-DD-copy-clarity.md`, `--real-use=artifacts/voice-canvas/YYYY-MM-DD-real-use-coverage.md`, `--entry-surfaces=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces.md`, and `--rollback-owner=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md` so launch sign-off fails if the run plan is missing, drifted from the canonical same-date evidence bundle, omits a canonical flow entry surface, real-use QA gate, fallback path, feature endpoint/server key, or telemetry event, if the copy artifact is missing, invalid, stale, generic, omits senior-friendly/next-step/long-label/focus/screen-reader/reduced-motion proof, or unsafe, if the real-use artifact is missing, invalid, stale, generic, uses emulator/responsive-mode evidence, or unsafe, if the entry-surface artifact is missing, invalid, stale, generic, or unsafe, or if the rollback-owner handoff is missing, still has placeholders, omits a feature endpoint/server key/fallback path, is older than 7 days, or appears to include personal details. The preflight summary includes sanitized `canonicalFlowCoverage` so reviewers can inspect the exact flow/surface/gate map without opening raw QA artifacts. The launch run plan, enabled endpoint, rollback endpoint, analytics, copy-clarity, real-use, entry-surface, and rollback-owner handoff artifacts must share one QA run date.

## Evidence packet validation

After filling `docs/audits/voice-canvas-real-device-evidence-packet.md` and before copying evidence into the final QA matrix, validate the packet:

```bash
npm run --silent canvas:qa:packet -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-evidence-packet-summary.json
```

Use `--allow-pending` while the packet is still being filled, and omit it for the final packet gate. The validator checks that required artifact inventory, flow packet, and copy-ready evidence pattern rows remain present; requires flow packet rows to keep canonical launch entry surfaces, canonical path states, fallback paths, and sanitized artifact categories aligned with the launch manifest; reports pending packet cells by section; preserves existing output unless `--force` is explicit; and rejects unsafe artifact references without copying raw artifact-reference values into output.

## Real-device QA pass

Run this pass for each flow: ride, appointment, refill, shopping, provider reply, and task hub resume.

Before filling the matrix, use `docs/audits/voice-canvas-real-device-run-sheet.md` to execute each flow/device/interaction pass, then use `docs/audits/voice-canvas-real-device-evidence-packet.md` to name sanitized screenshots, photos, recordings, logs, traces, captures, dashboards, queries, or artifact links and map them back to the matrix rows they prove.

While the run sheet is being filled, validate its structure with:

```bash
npm run --silent canvas:qa:runsheet -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-run-sheet-summary.json
```

Use `--allow-pending` while staging execution is in progress, and omit it after every run-sheet row has a passing result, sanitized artifact reference, and a reviewer/date note with explicit reviewed, verified, validated, approved, or sign-off wording dated within the last 7 days. The validator checks privacy guardrails, environment preflight, canonical flow entry surfaces, fallback paths, sanitized artifact categories, flow/device rows, behavior recovery, rollback, copy/accessibility, analytics, closeout coverage, and stale/future evidence dates before the run sheet is used to fill the packet and matrix.

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

Keep `docs/audits/voice-canvas-real-device-qa-matrix.md` marked **pending execution** while any deployed real-device row still needs evidence. Before enabling Canvas for real users, every required environment, entry surface, device, interaction mode, behavior, rollback, task hub destination fallback, copy/accessibility, analytics signal, privacy, evidence artifact inventory, and sign-off row must remain present; environment rows must include a deployed non-local URL, commit SHA, browser/version evidence, live non-mock voice session mode, affirmative valid `YYYY-MM-DD` analytics review generated within the last 7 days, initial enabled true/rollout-100 flag state, and rollback disabled false/rollout-0 flag state, and must not say the test account, browser, voice session, provider, environment, URL, commit/build, analytics sink, flag, rollout, or payload was missing, unavailable, unreachable, not returned, not reviewed, not verified, or not working; device rows and evidence notes must name affirmative real physical phone, tablet, and desktop/laptop evidence and must not contain not-tested, not-real, unavailable, failed-to-load/render/open/work/display/run, unable-to-test/use/verify, broken, crashed, blank-screen, white-screen, unusable, viewport, emulator, simulator, responsive-mode, or DevTools evidence; interaction rows and evidence notes must name voice, touch, and keyboard evidence plus affirmative completion or safe-exit outcome for each flow and must not contain not-completed, not-safely-exited, or not-tested wording; behavior rows and evidence notes must name the checked behavior affirmatively instead of only saying that QA passed, including start/resume restored-work/entered-information-preserved/no-write/no-resubmission behavior, app-exit/reopen restored-draft/entered-information-preserved/no-write/no-resubmission behavior, refresh/reconnect restored-work/entered-information-preserved/no-write/no-resubmission behavior, voice-interruption preserved-work/entered-information-preserved/no-write/no-resubmission recovery, browser-back entered-information-preservation/no-write behavior, cancel/exit no-write behavior, open-session flag-rollback Canvas-closed existing-fallback/no-write behavior, duplicate-prevention/stale-response ignoring, recoverable-failure retry/exit entered-information-preserved/no-write/no-resubmission behavior, senior-friendly one-clear-decision/readable-or-legible-label copy behavior, privacy-safe aggregate/no-sensitive analytics behavior, and explicit no-external-action/no-write/no-booking/no-call/no-message/no-navigation-before-confirmation evidence, and must not say required outcomes were not restored, not preserved, not offered, not prevented, not ignored, unreadable, unavailable, or triggered; feature endpoint rows and evidence notes must match the launch manifest endpoint/server key and include concrete disabled false/rollout-0 payload evidence, enabled true/rollout-100 payload evidence, malformed-config and missing-config evidence that explicitly states fail-closed disabled fallback behavior, rollback disabled/rollout-0 with existing-fallback-visible evidence, and fallback evidence that names the actual existing, previous, or specific fallback path rather than generic existing-fallback wording, and must not say required payloads/responses/flags/rollouts were missing, unavailable, or not returned, fallback was missing, unavailable, not visible, or not shown, or rollback/disable/enable/fallback did not happen; task hub destination rows and evidence notes must prove enabled resume, disabled destination fallback to the named actual existing/safe destination path, and no writes or external actions before confirmation, and must not say resume did not happen, fallback was missing or unavailable, no-write/no-external-action checks failed, or a write/external action/endpoint/booking/call/message/navigation happened; evidence cells must include affirmative QA or reviewer notes with a valid non-future `YYYY-MM-DD` calendar date no older than 7 days and must not say evidence was missing, not reviewed, not captured, unverified, or contradict the row with rejected negative outcome wording; copy/accessibility rows and evidence notes must name the specific checked behavior and matching screenshots, keyboard-only rows must prove completion or safe exit for every flow, focus rows must prove focus moved to the new scene heading or control, waiting-state rows must explain what is pending or in progress and what has not happened, screen-reader announcement notes must cover waiting, blocked, and completed states, reduced-motion notes, or copy read-through evidence and must not say required outcomes were not announced, not verified, not readable, not usable, not focused, did not move, does not move, failed to explain, unavailable, missing announcements, announcements missing, missing focus, had no retry, had no exit, overflowed, clipped, or truncated; Spanish long-label rows must explicitly state readable or legible labels plus no overflow, clipping, or truncation; analytics signal rows must name the canonical source event and positive numeric aggregate count reviewed for started, resumed, abandoned, blocked, confirmed, and completed, and analytics signal evidence must not say forbidden data was recorded, logged, sent, captured, included, stored, retained, or present; zero-count analytics rows do not prove observation; privacy rows must state that forbidden data was absent, not recorded, logged, sent, captured, or included, not merely that there was no issue or concern, neither result nor evidence may also state that forbidden data was recorded, logged, sent, captured, included, stored, retained, or present, and must point to dated analytics/telemetry evidence with only allowed envelope fields and non-identifying allowed values and a valid non-future `YYYY-MM-DD` date no older than 7 days; artifact inventory rows must map sanitized concrete artifacts to environment, device, interaction, behavior, endpoint, task hub, copy/accessibility, analytics signal, analytics privacy, run-sheet validation, and launch preflight evidence without personal details; every `Pending` cell must be replaced with a passing result/evidence note; no row may contain a failed/blocked/not-ready result; all final sign-off roles must include a name, a non-future `YYYY-MM-DD` date no older than 7 days, an unconditional approved-for-launch decision, and notes with concrete reviewed, verified, confirmed, or completed launch evidence rather than vague approval-only notes like `OK`, `N/A`, `looks good`, or `no notes`, with no pending fixes, conditions, follow-up work, retests, open issues, or blockers; and the matrix `Status` must be changed to **ready for launch**.

For environment rows, analytics sink review and initial/rollback flag state cells must include dated concrete environment artifact/log/dashboard evidence, including dashboard/query/log proof for analytics and feature-flag artifact/log proof for rollout states. Prose-only reviewed/verified wording does not satisfy launch sign-off.

For entry surface rows, keep the manifest-aligned surface list for every flow and provide dated screenshot, log, recording, or artifact evidence that each surface was exercised. Generic main-entry or single-surface evidence does not satisfy launch sign-off.

The evidence artifact inventory must also include rollback owner handoff artifacts before launch, with sanitized owner/backup, decision-window, rollback-trigger, endpoint/fallback/open-session, privacy-boundary, and fallback-readiness proof.

For privacy rows, the result and evidence must name the specific forbidden data class being reviewed, and the evidence must point to a concrete analytics artifact/query/dashboard/log reference. Generic no-sensitive-data wording or prose-only analytics-review wording does not satisfy launch sign-off.

For device coverage rows, the evidence note must name real phone, tablet, and desktop/laptop coverage plus a real-device screenshot, photo, or artifact reference that does not include transcripts, entered text, addresses, or personal details. Generic device-evidence prose or generic screenshot evidence does not satisfy launch sign-off.

For interaction-mode rows, the evidence note must name voice, touch, keyboard, completion or safe exit, and a concrete screenshot, recording, log, or artifact reference that does not include spoken transcripts, entered text, addresses, or other personal details. Generic interaction-evidence prose or generic screenshot/log evidence does not satisfy launch sign-off.

For feature endpoint rows, the evidence note must name the exact endpoint, server key, named fallback path, endpoint artifact/log/trace evidence, and endpoint payload evidence for malformed config, missing config, disabled false/rollout 0, enabled true/rollout 100, rollback, and fallback. The endpoint artifact must not include transcripts, entered text, addresses, or personal details. Generic prose-only payload evidence or generic screenshot/log evidence does not satisfy launch sign-off.

For recoverable failures, the behavior row must explicitly prove both retry and an exit or cancel path. Generic recovery wording without a clear exit/cancel path does not satisfy launch sign-off.

For behavior rows that require no-write evidence, explicitly state no write or without write. Submission-only wording such as `not submitted`, `nothing submitted`, or `without submitting`, and no-external-action wording by itself, does not prove the write boundary for launch sign-off.

For behavior rows that require no-external-action evidence, explicitly state no external action or without external action. Sent/submitted shorthand such as `nothing sent`, `nothing submitted`, or `not submitted` does not prove the external-action boundary for launch sign-off.

For required behavior rows, the evidence note must include dated artifact/log/screenshot coverage for resume, recovery, rollback, confirmation safety, senior copy, privacy, and no side effects. The artifact evidence must not include transcripts, entered text, addresses, or personal details. Generic behavior-evidence prose or generic screenshot/log evidence does not satisfy launch sign-off.

Use the behavior recovery template in `docs/audits/voice-canvas-real-device-run-sheet.md` and `docs/audits/voice-canvas-real-device-evidence-packet.md` before copying behavior evidence into the QA matrix. It requires separate affirmative notes for start/resume, app exit/reopen, refresh/reconnect, voice interruption, browser back, cancel/exit, duplicate/stale guard, recoverable failure retry/exit, entered-information preservation, no write, no resubmission, no external action, and artifact privacy.

For copy/accessibility rows, the evidence note must explicitly name the checked outcome, not just say a screenshot was reviewed. For example, include one clear decision for each flow, Spanish long-label readability without overflow, waiting pending/no-action copy, blocked retry/exit copy, completed outcome/no-extra-action copy, keyboard completion or safe exit for each flow, focus movement, screen-reader state announcements, or calm usable reduced-motion behavior.

Use the copy/accessibility evidence template in `docs/audits/voice-canvas-real-device-run-sheet.md` and `docs/audits/voice-canvas-real-device-evidence-packet.md` before copying copy/accessibility evidence into the QA matrix. It requires affirmative notes for one clear decision, Spanish long labels, waiting/blocked/completed copy, keyboard completion or safe exit, focus movement, screen-reader announcements, reduced-motion behavior, and artifact privacy.

For duplicate/stale guard behavior, explicitly state that duplicate confirmation or action attempts were prevented, blocked, ignored, rejected, or discarded, and that stale responses were ignored, rejected, or discarded. Submission-only wording such as `not submitted` or `not resubmitted` is not enough for launch sign-off.

For task hub destination rows, the no-side-effects cell must explicitly prove both no writes and no external actions before confirmation. Submission-only wording such as `not submitted` or `without submitting` is not enough for launch sign-off. The evidence note must include dated artifact resume, disabled fallback, no-write, and no-external-action coverage for that task hub path, and artifacts must not include transcripts, entered text, addresses, or personal details. Generic task-hub prose or generic screenshot/log evidence does not satisfy launch sign-off.

For evidence artifact inventory rows, map the sanitized artifact bucket to the exact evidence it proves, including environment/flag, entry surface, real-device, interaction, behavior recovery, feature endpoint, task hub, rollback owner handoff, copy/accessibility, analytics signal, analytics privacy, run-sheet validation, and launch preflight artifacts. Each reference must point to concrete sanitized screenshots, photos, recordings, logs, traces, captures, dashboards, queries, JSON validation artifacts, or links with no personal details, and each row must include a QA/reviewer note with a non-future `YYYY-MM-DD` date.

For final sign-off rows, notes must be concrete and role-specific: Product covers real-use evidence, senior copy, what happens next, and privacy/analytics readiness; Engineering covers rollback, stale/duplicate guards, and feature-flag fallback safety; QA covers the real-device matrix plus voice/touch/keyboard coverage; Operations covers rollback ownership, backup owner, decision window, rollback trigger, enable-false or disabled rollout-0 action, sanitized endpoint/fallback/open-session evidence, Canvas closed or hidden behavior, privacy boundary, and fallback readiness.

Per-flow rollback runbooks include a copy-safe rollback owner handoff template. Before enabling any percentage rollout, fill that handoff in the launch record with owner/backup, decision window, trigger, rollback action, sanitized endpoint/fallback/open-session evidence, and privacy boundary. Do not launch with an unnamed rollback owner.

Use the rollback owner handoff copy-ready evidence note in `docs/audits/voice-canvas-real-device-evidence-packet.md`, the `npm run --silent canvas:qa:rollback-owner -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md` helper, and the `npm run --silent canvas:qa:rollback-owner -- --input=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-validation.json` validation artifact before filling the Operations/rollback owner final sign-off. It requires owner and backup, decision window, rollback trigger, enable-false or disabled rollout-0 action, sanitized endpoint/fallback/open-session evidence, Canvas closed or hidden behavior, privacy boundary, and fallback readiness.

Run the sign-off gate after filling the matrix:

```bash
npm run canvas:qa:validate
```

While the matrix is still pending execution, use the non-launching structure check:

```bash
npm run canvas:qa:validate -- --allow-pending
```

The structure check is not a launch approval. While the matrix remains pending, the final command without `--allow-pending` is expected to fail. The validator prints pending cells by section so QA can fill the environment, device, interaction, behavior, endpoint, task hub, rollback owner handoff, copy/accessibility, analytics, privacy, artifact inventory, and sign-off evidence systematically.

For a machine-readable QA artifact, add `--json`:

```bash
npm run --silent canvas:qa:validate -- --allow-pending --json
```

To save the JSON summary as a run-specific artifact, add `--output=<path>`:

```bash
npm run --silent canvas:qa:validate -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-qa-summary.json
```

Replace `YYYY-MM-DD` with the QA run date. The validator preserves existing output files by default. Use a new run-specific path for each QA pass; pass `--force` only when intentionally replacing an artifact.

```bash
npm run test -- src/components/voice-canvas/canvasLaunchSignoff.test.ts src/components/voice-canvas/canvasLaunchReadiness.test.ts src/components/voice-canvas/validateVoiceCanvasQaMatrixCommand.test.ts src/components/voice-canvas/collectVoiceCanvasFeatureEndpointEvidenceCommand.test.ts src/components/voice-canvas/validateVoiceCanvasAnalyticsEvidenceCommand.test.ts src/components/voice-canvas/validateVoiceCanvasRunSheetCommand.test.ts src/components/voice-canvas/validateVoiceCanvasEvidencePacketCommand.test.ts src/components/voice-canvas/prepareVoiceCanvasRollbackOwnerHandoffCommand.test.ts src/components/voice-canvas/preflightVoiceCanvasLaunchReadinessCommand.test.ts
```

If this gate fails, do not enable the feature.

## Focused verification commands

Run the focused component/readiness suite:

```bash
npm run test -- server/lib/canvasFeatureFlags.test.ts src/components/voice-canvas/canvasPlatform.test.tsx src/components/voice-canvas/canvasPlatformCompliance.test.ts src/components/voice-canvas/canvasLaunchTelemetry.test.ts src/components/voice-canvas/canvasLaunchReadiness.test.ts src/components/voice-canvas/canvasLaunchSignoff.test.ts src/components/voice-canvas/validateVoiceCanvasQaMatrixCommand.test.ts src/components/voice-canvas/collectVoiceCanvasFeatureEndpointEvidenceCommand.test.ts src/components/voice-canvas/validateVoiceCanvasAnalyticsEvidenceCommand.test.ts src/components/voice-canvas/validateVoiceCanvasRunSheetCommand.test.ts src/components/voice-canvas/validateVoiceCanvasEvidencePacketCommand.test.ts src/components/voice-canvas/prepareVoiceCanvasRollbackOwnerHandoffCommand.test.ts src/components/voice-canvas/preflightVoiceCanvasLaunchReadinessCommand.test.ts src/components/voice-canvas/providerReplyCanvasRollout.test.ts src/components/voice-canvas/ShoppingVoiceCanvas.test.tsx src/components/voice-canvas/ProviderReplyVoiceCanvas.test.tsx src/pages/ConciergeShoppingScreen.test.tsx src/pages/ConciergeTaskInboxPage.test.tsx src/pages/AdherenceReportScreen.actions.test.tsx
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
