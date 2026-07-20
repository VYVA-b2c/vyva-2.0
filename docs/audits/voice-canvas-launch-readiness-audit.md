# Voice Canvas launch readiness audit

Date: 2026-07-19  
Branch: `codex/canvas-launch-readiness-qa-v1`  
Scope: ride, appointment, medication refill, shopping or delivery, provider reply, and task hub resume.

## Current status

Status: **automated readiness strengthened; manual real-device/deployed rollback QA still required before launch sign-off.**

This pass found and fixed one launch-blocking rollout issue: provider-reply Canvas had client-side rollout wiring but no matching server feature endpoint. The endpoint now exists and all Canvas feature flags share the same server-side fail-closed resolver.

Manual execution must be recorded in `docs/audits/voice-canvas-real-device-qa-matrix.md`.

The matrix is protected by `src/components/voice-canvas/canvasLaunchSignoff.test.ts`: it may stay **pending execution** while real-device QA is incomplete, but a **ready for launch** status is rejected unless every required environment, device, interaction mode, behavior, rollback, task hub destination fallback, copy/accessibility, analytics signal, privacy, evidence artifact inventory, and sign-off row remains present; environment rows include a deployed non-local URL, commit, browser, live non-mock voice-session, affirmative valid non-future `YYYY-MM-DD` analytics review, initial enabled true/rollout-100 flag state, and rollback disabled false/rollout-0 flag state, and reject missing/unavailable/unreachable/not-returned/not-reviewed/not-verified/not-working environment, account, browser, voice-session, provider, commit/build, analytics, flag, rollout, or payload wording; device rows and evidence notes name affirmative real physical phone, tablet, and desktop/laptop evidence and reject not-tested, not-real, unavailable, failed-to-load/render/open/work/display/run, unable-to-test/use/verify, broken, crashed, blank-screen, white-screen, unusable, viewport, emulator, simulator, responsive-mode, device-toolbar, or DevTools evidence; interaction rows and evidence notes name voice, touch, and keyboard evidence plus affirmative completion or safe-exit outcome for every flow and reject not-completed, not-safely-exited, or not-tested wording; behavior rows and evidence notes name checked behavior affirmatively and reject not-restored, not-preserved, not-offered, not-prevented, not-ignored, unreadable, unavailable, or triggered-action wording while still requiring start/resume restored-work/entered-information-preserved/no-write/no-resubmission behavior, app-exit/reopen restored-draft/entered-information-preserved/no-write/no-resubmission behavior, refresh/reconnect restored-work/entered-information-preserved/no-write/no-resubmission behavior, voice-interruption preserved-work/entered-information-preserved/no-write/no-resubmission recovery, browser-back entered-information-preservation/no-write behavior, cancel/exit no-write behavior, open-session flag-rollback Canvas-closed existing-fallback/no-write behavior, duplicate-prevention/stale-response ignoring, recoverable-failure retry/exit entered-information-preserved/no-write/no-resubmission behavior, senior-friendly one-clear-decision/readable-or-legible-label copy behavior, privacy-safe aggregate/no-sensitive analytics behavior, and explicit no-external-action/no-write/no-booking/no-call/no-message/no-navigation-before-confirmation evidence; feature endpoint rows and evidence notes match the launch manifest and include concrete disabled false/rollout-0 payload evidence, enabled true/rollout-100 payload evidence, malformed-config and missing-config evidence that explicitly states fail-closed disabled fallback behavior, rollback disabled/rollout-0 with existing-fallback-visible evidence, and fallback evidence that names the actual existing, previous, or specific fallback path rather than generic existing-fallback wording, and reject unavailable/missing/not-returned payloads, fallback-missing/unavailable/not-visible/not-shown wording, and rollback/disable/enable/fallback-did-not-happen wording; task hub destination rows and evidence notes prove enabled resume, disabled destination fallback to the named actual existing/safe destination path, and no writes or external actions before confirmation, and reject did-not-resume, fallback-missing/unavailable, failed no-write/no-external-action, and write/external-action/endpoint/booking/call/message/navigation-happened wording; evidence cells include affirmative QA or reviewer notes with a valid non-future `YYYY-MM-DD` calendar date and reject missing, not-reviewed, not-captured, unverified, or contradictory rejected-outcome wording; copy/accessibility rows and evidence notes name the checked behavior and matching screenshots, keyboard-only rows prove completion or safe exit for every flow, focus rows prove focus moved to the new scene heading or control, waiting-state rows explain what is pending or in progress and what has not happened, screen-reader announcement notes cover waiting, blocked, and completed states, reduced-motion notes, or copy read-through evidence and reject not-announced, not-verified, not-readable, not-usable, no-focus, no-retry, no-exit, does-not-move, missing-announcements, announcements-missing, missing-focus, unavailable, overflowed, clipped, or truncated failure wording; Spanish long-label rows must explicitly state readable or legible labels plus no overflow, clipping, or truncation; analytics signal rows name the canonical source event and positive numeric aggregate count reviewed for started, resumed, abandoned, blocked, confirmed, and completed, and analytics signal evidence rejects contradictory leakage wording that says forbidden data was recorded, logged, sent, captured, included, stored, retained, or present; zero-count analytics rows are rejected; privacy rows state forbidden data was absent, not recorded, logged, sent, captured, or included, not merely that there was no issue or concern, reject contradictory leakage wording in both result and evidence, include ride pickup/dropoff/destination/route details as a required forbidden data class, and point to dated analytics or telemetry evidence with only allowed envelope fields and a valid non-future `YYYY-MM-DD` date; artifact inventory rows map sanitized concrete artifacts to environment, device, interaction, behavior, endpoint, task hub, copy/accessibility, analytics signal, and analytics privacy evidence without personal details; all required evidence is filled with passing results; no row contains a failed/blocked/not-ready result; and every final sign-off role has a name, a non-future `YYYY-MM-DD` date, an unconditional approved-for-launch decision, and notes with concrete reviewed, verified, confirmed, or completed launch evidence rather than vague approval-only notes like `OK`, `N/A`, `looks good`, or `no notes`, with no pending fixes, conditions, follow-up work, retests, open issues, or blockers.

Environment evidence now requires concrete dashboard/query/log/artifact proof for analytics sink review and dated artifact/log proof for initial enabled and rollback disabled flag states; prose-only environment review or flag-state wording is rejected.

Evidence artifact inventory rows now require sanitized concrete artifact references for environment/flag, real-device, interaction, behavior recovery, feature endpoint, task hub, copy/accessibility, analytics signal, and analytics privacy proof; generic artifact-bucket prose and artifacts with personal details are rejected.

Feature endpoint launch evidence must also include sanitized endpoint artifact/log/trace evidence and must reject artifacts that captured transcripts, entered text, addresses, or personal details.

The recoverable-failure gate now requires explicit retry plus exit or cancel evidence; generic recovery wording alone is rejected so every blocked/failure state still proves a clear way out.

Behavior rows that require no-write evidence now require explicit no-write wording; submission-only wording and no-external-action wording alone are rejected so launch evidence cannot blur local writes, endpoint writes, and external side effects.

Behavior rows that require no-external-action evidence now require explicit no-external-action wording; sent/submitted shorthand alone is rejected so launch evidence cannot blur UI submission state with booking, call, message, navigation, endpoint, or other external-action safety.

Behavior evidence notes now require dated artifact/log/screenshot coverage for resume, recovery, rollback, confirmation safety, senior copy, privacy, and no side effects with no transcripts, entered text, addresses, or personal details; generic prose-only behavior evidence, generic screenshot/log evidence, and sensitive artifact evidence are rejected.

Duplicate/stale guard rows now require explicit duplicate prevention/handling language plus stale-response ignoring/rejection/discarding; submission-only wording is rejected so duplicate-confirmation protection cannot be implied by a vague non-submission claim.

Restore, reconnect, interruption, and recoverable-failure behavior rows now require explicit no-resubmission wording in addition to no-write and no-external-action evidence; restored-work wording alone is rejected so launch evidence cannot obscure automatic retry or in-flight request replay risk.

The no-write/no-resubmission/no-external-action gate now also accepts the checklist-style phrase "without a write, resubmission, or external action" so real QA evidence can use the documented wording while still proving each safety boundary.

Resume, app-exit/reopen, refresh/reconnect, voice-interruption, browser-back, and recoverable-failure behavior rows now require explicit entered-information preservation wording; draft-restored wording alone is rejected so launch evidence proves user-entered details survived.

Flag rollback behavior rows now require explicit open-session evidence that Canvas closed, disappeared, or was hidden and the existing fallback path was restored; generic rollback/fallback wording alone is rejected so launch evidence proves the user-visible rollback outcome.

Waiting-state copy rows now require explicit pending or in-progress wording plus what has not happened; no-action wording alone is rejected so launch evidence proves users understand what is still pending.

Keyboard and focus copy/accessibility rows now require keyboard-only completion or safe-exit evidence for every flow and focus movement to the new scene heading or control; generic keyboard/focus visibility wording is rejected.

Screen-reader copy/accessibility evidence now requires waiting, blocked, and completed announcement coverage; generic screen-reader evidence wording is rejected.

Copy/accessibility evidence now requires the evidence note to name the checked outcome, such as one clear decision for each flow, Spanish long-label readability without overflow, waiting pending/no-action copy, blocked retry/exit copy, completed outcome/no-extra-action copy, keyboard completion or safe exit for each flow, focus movement, or calm usable reduced-motion behavior; generic screenshot-only evidence is rejected.

Privacy review rows now require the result and evidence to name the specific forbidden data class; generic no-sensitive-data wording is rejected.

Device coverage evidence now requires dated real phone, tablet, and desktop/laptop coverage plus screenshot, photo, or artifact evidence with no transcripts, entered text, addresses, or personal details; generic prose-only device evidence, generic screenshot evidence, and sensitive artifact evidence are rejected.

Interaction-mode evidence now requires dated voice, touch, and keyboard completion or safe-exit coverage plus a concrete screenshot, recording, log, or artifact reference with no spoken transcripts, entered text, addresses, or other personal details; generic prose-only interaction evidence, generic screenshot/log evidence, and sensitive artifact evidence are rejected.

Analytics signal evidence now requires dated source-event, positive aggregate count, allowed-envelope evidence, and a concrete analytics artifact/query/dashboard/log reference for the specific launch signal; generic analytics-review evidence is rejected.

Analytics privacy evidence now requires a concrete analytics artifact/query/dashboard/log reference for each forbidden data class in addition to dated allowed-envelope review evidence; prose-only sample review evidence is rejected.

Final sign-off notes now require concrete, role-specific launch evidence for Product, Engineering, QA, and Operations/rollback ownership; generic or role-swapped approval notes are rejected.

Feature endpoint evidence now requires the exact endpoint, server key, named fallback path, endpoint artifact/log/trace evidence, and endpoint payload coverage for malformed config, missing config, disabled false/rollout 0, enabled true/rollout 100, rollback, and fallback; generic prose-only payload evidence, generic screenshot/log evidence, and sensitive endpoint artifacts are rejected.

The task hub no-side-effects gate now requires explicit no-write and no-external-action wording before confirmation; softer submission-only wording is rejected so destination resume evidence cannot obscure booking, call, message, navigation, endpoint, or other external-action risk.

Task hub destination evidence now requires dated artifact resume, disabled fallback, no-write, and no-external-action coverage for the specific task hub path with no transcripts, entered text, addresses, or personal details; generic task-hub prose, generic screenshot/log evidence, and sensitive artifact evidence are rejected.

## Requirement audit

| Requirement | Evidence now in repo | Status |
| --- | --- | --- |
| Ride, appointment, refill, shopping, provider reply, and task hub resume are tracked as launch surfaces | `src/components/voice-canvas/canvasLaunchReadiness.ts`; `src/components/voice-canvas/canvasLaunchReadiness.test.ts` | Automated evidence complete |
| Mobile, tablet, and desktop presentation plus voice/touch/keyboard operation | Playwright screenshots for ride, appointment, refill, shopping, provider reply, and task hub resume under `src/dev/voice-canvas/`; task hub component coverage in `src/pages/ConciergeTaskInboxPage.test.tsx`; explicit real-physical-device/non-emulation and interaction-mode sign-off gates | Browser evidence complete; physical-device and interaction-mode pass pending |
| Refresh/reconnect, app exit/reopen, and voice interruption restore editable work without resubmitting in-flight work | Flow component tests, task hub tests, `canvasPlatformCompliance.test.ts`, launch runbook restore rules, and explicit app-exit/reopen restored-draft/entered-information-preserved/no-write/no-resubmission, refresh/reconnect restored-work/entered-information-preserved/no-write/no-resubmission, and voice-interruption preserved-work/entered-information-preserved/no-write/no-resubmission sign-off gates | Automated evidence complete; deployed reconnect/app-exit/interruption pass pending |
| Back, cancel, and clear exit paths are safe | Flow component tests, task hub detail-exit tests, explicit browser-back preservation/no-write sign-off gate, and explicit cancel/exit no-write sign-off gate | Automated evidence complete; deployed browser-back and cancel/exit pass pending |
| Recoverable failures provide retry or exit without submitting extra work | Flow blocked-state tests, launch runbook failure scenario, and explicit recoverable-failure retry/exit entered-information-preserved/no-write/no-resubmission sign-off gate | Automated evidence complete; deployed recoverable-failure pass pending |
| No external action before explicit confirmation | Flow component tests, browser readiness specs, task hub tests, `useCanvasExternalActionGate` coverage, and explicit sign-off gate for no external action, write, booking, call, message, or navigation before confirmation | Automated evidence complete |
| Duplicate and stale responses are ignored | `canvasPlatform.test.tsx`, flow component tests, Concierge voice-canvas response tests, and explicit duplicate-prevention/stale-response ignoring sign-off gate | Automated evidence complete; deployed duplicate/stale pass pending |
| Feature flags and fallback restore old paths | `server/lib/canvasFeatureFlags.test.ts`, centralized server endpoint map, launch manifest server-key mapping, no-store HTTP endpoint check, rollout tests, shopping/refill page tests, malformed/missing-config sign-off gate, task hub destination fallback sign-off gate, explicit open-session flag-rollback Canvas-closed existing-fallback/no-write sign-off gate, unified rollback runbook | Local/runtime evidence complete; deployed endpoint and task hub destination toggle pending |
| Privacy-safe analytics for started, resumed, abandoned, blocked, confirmed, completed | `canvasLaunchSignalForTelemetry`, `canvasLaunchTelemetry.ts`, launch manifest signal map, widened forbidden-field manifest, dispatch boundary test, aggregate-only counter/listener tests against forbidden fields, and signal-by-signal real-device sign-off gate | Automated evidence complete; production analytics sink review pending |
| Senior-friendly copy and what-happens-next clarity | Flow view model/component tests, screenshots, explicit senior-friendly one-clear-decision/readable-or-legible-label sign-off gate, Spanish readable/no-overflow long-label sign-off gate, and launch runbook QA prompts | Browser evidence complete; senior copy read-through pending |
| Launch checklist and rollback notes | `docs/runbooks/voice-canvas-launch-readiness.md`, `docs/audits/voice-canvas-real-device-qa-matrix.md`, `src/components/voice-canvas/canvasLaunchSignoff.test.ts`, plus existing ride/appointment/refill rollout runbooks | Complete; final sign-off gate pending real-device evidence |

## Verification performed

- Focused readiness suite with server flag checks:
  - `$env:DATABASE_URL='file:./dev.db'; npm run test -- server/lib/canvasFeatureFlags.test.ts src/components/voice-canvas/canvasPlatform.test.tsx src/components/voice-canvas/canvasPlatformCompliance.test.ts src/components/voice-canvas/canvasLaunchTelemetry.test.ts src/components/voice-canvas/canvasLaunchReadiness.test.ts src/components/voice-canvas/canvasLaunchSignoff.test.ts src/components/voice-canvas/providerReplyCanvasRollout.test.ts src/components/voice-canvas/ShoppingVoiceCanvas.test.tsx src/components/voice-canvas/ProviderReplyVoiceCanvas.test.tsx src/pages/ConciergeShoppingScreen.test.tsx src/pages/ConciergeTaskInboxPage.test.tsx src/pages/AdherenceReportScreen.actions.test.tsx`
  - Result: 255 tests passed after evidence artifact inventory hardening, environment artifact evidence hardening, duplicate/stale scoped evidence hardening, and the latest server flag, platform, telemetry, rollout, shopping, provider reply, task hub, and refill entry-point checks.
- Browser readiness:
  - `npm run test:e2e -- e2e/voice-canvas-production-readiness.spec.ts e2e/appointment-canvas-production-readiness.spec.ts e2e/medication-refill-canvas-production-readiness.spec.ts e2e/canvas-launch-readiness.spec.ts e2e/task-hub-resume-launch-readiness.spec.ts`
  - Result: 18 tests passed on commit `7fcaeeef` after evidence artifact inventory hardening, with refreshed appointment and refill screenshots under `src/dev/voice-canvas/`.
- Focused real-device sign-off gate after no-resubmission hardening:
  - `$env:DATABASE_URL='file:./dev.db'; npm run test -- src/components/voice-canvas/canvasLaunchSignoff.test.ts src/components/voice-canvas/canvasLaunchReadiness.test.ts`
  - Result: 136 tests passed after evidence artifact inventory hardening, environment artifact evidence hardening, analytics artifact evidence hardening, feature endpoint artifact/privacy hardening, task-hub artifact evidence hardening, behavior artifact evidence hardening, interaction/device artifact privacy hardening, interaction-mode artifact evidence hardening, real-device screenshot/photo artifact evidence hardening, feature endpoint path/key/fallback evidence hardening, device coverage evidence hardening, analytics signal evidence hardening, privacy forbidden-data-class hardening, screen-reader announcement evidence hardening, keyboard/focus accessibility hardening, copy/accessibility evidence hardening, final sign-off role-specific evidence hardening, waiting-state pending-copy hardening, open-session rollback visibility hardening, entered-information preservation hardening, checklist-style no-write/no-resubmission/no-external-action wording alignment, task-hub evidence note hardening, and behavior evidence note hardening.
- Typecheck:
  - `npm run typecheck`
  - Result: passed.

## Remaining launch sign-off checklist

Complete these on a staging or production-like deployment before enabling the feature for real users:

1. Verify each feature endpoint returns the intended payload with flags disabled and enabled, and fails closed to disabled/fallback behavior for malformed or missing config:
   - `/api/config/features/ride-voice-canvas`
   - `/api/config/features/appointment-voice-canvas`
   - `/api/config/features/medication-refill-voice-canvas`
   - `/api/config/features/shopping-delivery-voice-canvas`
   - `/api/config/features/provider-reply-voice-canvas`
2. On a real phone, tablet, and desktop, run ride, appointment, refill, shopping, provider reply, and task hub resume using voice, touch, and keyboard where supported. Record whether each mode completed the flow or safely exited in `docs/audits/voice-canvas-real-device-qa-matrix.md`.
3. For each flow, verify refresh, browser back, app exit/reopen, and network reconnect, including restored work and no write/resubmission.
4. Toggle the relevant flag off during an open Canvas session and confirm the existing flow is restored without submitting work. For task hub resume, verify shopping, refill, provider reply, and stale/blocked task destinations use the safe fallback path when their destination Canvas is disabled.
5. Review English and Spanish copy with long labels and confirm the user always understands what happens next, labels remain readable or legible, and there is no horizontal overflow, clipping, or truncation.
6. Confirm production analytics receives started, resumed, abandoned, blocked, confirmed, and completed aggregate launch signals with closed envelope samples only, never spoken text, addresses, provider names, medication details, item names, reply text, notes, references, dates, times, contact details, or account identifiers.

## Launch decision

Do not mark the Canvas launch-readiness goal complete until the remaining deployed/manual checklist above is executed and recorded. The current branch makes the feature safer and reviewable, but it is not a substitute for real-device rollback and reconnect QA.
