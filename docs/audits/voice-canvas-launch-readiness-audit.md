# Voice Canvas launch readiness audit

Date: 2026-07-19  
Branch: `codex/canvas-launch-readiness-qa-v1`  
Scope: ride, appointment, medication refill, shopping or delivery, provider reply, and task hub resume.

## Current status

Status: **automated readiness strengthened; manual real-device/deployed rollback QA still required before launch sign-off.**

This pass found and fixed one launch-blocking rollout issue: provider-reply Canvas had client-side rollout wiring but no matching server feature endpoint. The endpoint now exists and all Canvas feature flags share the same server-side fail-closed resolver.

Manual execution must be recorded in `docs/audits/voice-canvas-real-device-qa-matrix.md`.

The matrix is protected by `src/components/voice-canvas/canvasLaunchSignoff.test.ts`: it may stay **pending execution** while real-device QA is incomplete, but a **ready for launch** status is rejected unless every required environment, device, interaction mode, behavior, rollback, task hub destination fallback, copy/accessibility, analytics signal, privacy, and sign-off row remains present; environment rows include launch-specific URL, commit, browser, voice-session, analytics, and flag-state evidence; device rows name real physical phone, tablet, and desktop/laptop evidence and cannot substitute viewport, emulator, simulator, responsive-mode, device-toolbar, or DevTools evidence; interaction rows name voice, touch, and keyboard evidence plus completion or safe-exit outcome for every flow; behavior rows name the checked behavior instead of only saying that QA passed, including start/resume restored-work/no-write behavior, app-exit/reopen restored-draft/no-write behavior, refresh/reconnect restored-work/no-write behavior, voice-interruption preserved-work/no-write recovery, browser-back preservation/no-write behavior, cancel/exit no-write behavior, flag-rollback existing-fallback/no-write behavior, duplicate-prevention/stale-response ignoring, recoverable-failure retry/exit no-write behavior, senior-friendly one-clear-decision/readable-label copy behavior, privacy-safe aggregate/no-sensitive analytics behavior, and explicit no-external-action/no-write/no-booking/no-call/no-message/no-navigation-before-confirmation evidence; feature endpoint rows match the launch manifest and include concrete disabled, enabled, malformed-config, missing-config, rollback, and fallback evidence; malformed or missing feature config must fail closed to disabled/fallback behavior; task hub destination rows prove enabled resume, disabled destination fallback, and no writes before confirmation; evidence cells include dated QA or reviewer notes; copy/accessibility rows name the checked behavior and matching screenshots, keyboard/focus notes, screen-reader announcement notes, reduced-motion notes, or copy read-through evidence; analytics signal rows name the canonical source event and aggregate count reviewed for started, resumed, abandoned, blocked, confirmed, and completed; privacy rows state forbidden data was absent and point to analytics or telemetry evidence; all required evidence is filled with passing results; no row contains a failed/blocked/not-ready result; and every final sign-off role has a name, a `YYYY-MM-DD` date, and an approved-for-launch decision.

## Requirement audit

| Requirement | Evidence now in repo | Status |
| --- | --- | --- |
| Ride, appointment, refill, shopping, provider reply, and task hub resume are tracked as launch surfaces | `src/components/voice-canvas/canvasLaunchReadiness.ts`; `src/components/voice-canvas/canvasLaunchReadiness.test.ts` | Automated evidence complete |
| Mobile, tablet, and desktop presentation plus voice/touch/keyboard operation | Playwright screenshots for ride, appointment, refill, shopping, provider reply, and task hub resume under `src/dev/voice-canvas/`; task hub component coverage in `src/pages/ConciergeTaskInboxPage.test.tsx`; explicit real-physical-device/non-emulation and interaction-mode sign-off gates | Browser evidence complete; physical-device and interaction-mode pass pending |
| Refresh/reconnect, app exit/reopen, and voice interruption restore editable work without resubmitting in-flight work | Flow component tests, task hub tests, `canvasPlatformCompliance.test.ts`, launch runbook restore rules, and explicit app-exit/reopen restored-draft/no-write, refresh/reconnect restored-work/no-write, and voice-interruption preserved-work/no-write sign-off gates | Automated evidence complete; deployed reconnect/app-exit/interruption pass pending |
| Back, cancel, and clear exit paths are safe | Flow component tests, task hub detail-exit tests, explicit browser-back preservation/no-write sign-off gate, and explicit cancel/exit no-write sign-off gate | Automated evidence complete; deployed browser-back and cancel/exit pass pending |
| Recoverable failures provide retry or exit without submitting extra work | Flow blocked-state tests, launch runbook failure scenario, and explicit recoverable-failure retry/exit no-write sign-off gate | Automated evidence complete; deployed recoverable-failure pass pending |
| No external action before explicit confirmation | Flow component tests, browser readiness specs, task hub tests, `useCanvasExternalActionGate` coverage, and explicit sign-off gate for no external action, write, booking, call, message, or navigation before confirmation | Automated evidence complete |
| Duplicate and stale responses are ignored | `canvasPlatform.test.tsx`, flow component tests, Concierge voice-canvas response tests, and explicit duplicate-prevention/stale-response ignoring sign-off gate | Automated evidence complete; deployed duplicate/stale pass pending |
| Feature flags and fallback restore old paths | `server/lib/canvasFeatureFlags.test.ts`, centralized server endpoint map, launch manifest server-key mapping, no-store HTTP endpoint check, rollout tests, shopping/refill page tests, malformed/missing-config sign-off gate, task hub destination fallback sign-off gate, explicit flag-rollback existing-fallback/no-write sign-off gate, unified rollback runbook | Local/runtime evidence complete; deployed endpoint and task hub destination toggle pending |
| Privacy-safe analytics for started, resumed, abandoned, blocked, confirmed, completed | `canvasLaunchSignalForTelemetry`, `canvasLaunchTelemetry.ts`, launch manifest signal map, widened forbidden-field manifest, dispatch boundary test, aggregate-only counter/listener tests against forbidden fields, and signal-by-signal real-device sign-off gate | Automated evidence complete; production analytics sink review pending |
| Senior-friendly copy and what-happens-next clarity | Flow view model/component tests, screenshots, explicit senior-friendly one-clear-decision/readable-label sign-off gate, and launch runbook QA prompts | Browser evidence complete; senior copy read-through pending |
| Launch checklist and rollback notes | `docs/runbooks/voice-canvas-launch-readiness.md`, `docs/audits/voice-canvas-real-device-qa-matrix.md`, `src/components/voice-canvas/canvasLaunchSignoff.test.ts`, plus existing ride/appointment/refill rollout runbooks | Complete; final sign-off gate pending real-device evidence |

## Verification performed

- Focused readiness suite with server flag checks:
  - `$env:DATABASE_URL='file:./dev.db'; npm run test -- server/lib/canvasFeatureFlags.test.ts src/components/voice-canvas/canvasPlatform.test.tsx src/components/voice-canvas/canvasPlatformCompliance.test.ts src/components/voice-canvas/canvasLaunchTelemetry.test.ts src/components/voice-canvas/canvasLaunchReadiness.test.ts src/components/voice-canvas/canvasLaunchSignoff.test.ts src/components/voice-canvas/providerReplyCanvasRollout.test.ts src/components/voice-canvas/ShoppingVoiceCanvas.test.tsx src/components/voice-canvas/ProviderReplyVoiceCanvas.test.tsx src/pages/ConciergeShoppingScreen.test.tsx src/pages/ConciergeTaskInboxPage.test.tsx src/pages/AdherenceReportScreen.actions.test.tsx`
  - Result: 165 tests passed.
- Browser readiness:
  - `npm run test:e2e -- e2e/voice-canvas-production-readiness.spec.ts e2e/appointment-canvas-production-readiness.spec.ts e2e/medication-refill-canvas-production-readiness.spec.ts e2e/canvas-launch-readiness.spec.ts e2e/task-hub-resume-launch-readiness.spec.ts`
  - Result: 18 tests passed on the current launch-readiness branch after the latest sign-off gate hardening, with refreshed appointment and refill screenshots under `src/dev/voice-canvas/`.
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
5. Review English and Spanish copy with long labels and confirm the user always understands what happens next.
6. Confirm production analytics receives started, resumed, abandoned, blocked, confirmed, and completed aggregate launch signals with closed envelope samples only, never spoken text, addresses, provider names, medication details, item names, reply text, notes, references, dates, times, contact details, or account identifiers.

## Launch decision

Do not mark the Canvas launch-readiness goal complete until the remaining deployed/manual checklist above is executed and recorded. The current branch makes the feature safer and reviewable, but it is not a substitute for real-device rollback and reconnect QA.
