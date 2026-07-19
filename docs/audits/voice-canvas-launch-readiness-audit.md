# Voice Canvas launch readiness audit

Date: 2026-07-19  
Branch: `codex/canvas-launch-readiness-qa-v1`  
Scope: ride, appointment, medication refill, shopping or delivery, provider reply, and task hub resume.

## Current status

Status: **automated readiness strengthened; manual real-device/deployed rollback QA still required before launch sign-off.**

This pass found and fixed one launch-blocking rollout issue: provider-reply Canvas had client-side rollout wiring but no matching server feature endpoint. The endpoint now exists and all Canvas feature flags share the same server-side fail-closed resolver.

Manual execution must be recorded in `docs/audits/voice-canvas-real-device-qa-matrix.md`.

The matrix is protected by `src/components/voice-canvas/canvasLaunchSignoff.test.ts`: it may stay **pending execution** while real-device QA is incomplete, but a **ready for launch** status is rejected unless all required evidence and final sign-off roles are filled.

## Requirement audit

| Requirement | Evidence now in repo | Status |
| --- | --- | --- |
| Ride, appointment, refill, shopping, provider reply, and task hub resume are tracked as launch surfaces | `src/components/voice-canvas/canvasLaunchReadiness.ts`; `src/components/voice-canvas/canvasLaunchReadiness.test.ts` | Automated evidence complete |
| Mobile, tablet, and desktop presentation | Playwright screenshots for ride, appointment, refill, shopping, provider reply, and task hub resume under `src/dev/voice-canvas/`; task hub component coverage in `src/pages/ConciergeTaskInboxPage.test.tsx` | Browser evidence complete; physical-device pass pending |
| Refresh/reconnect restores editable work without resubmitting in-flight work | Flow component tests, task hub tests, `canvasPlatformCompliance.test.ts`, and launch runbook restore rules | Automated evidence complete; deployed reconnect pass pending |
| Back, cancel, and clear exit paths are safe | Flow component tests and task hub detail-exit tests | Automated evidence complete |
| No external action before explicit confirmation | Flow component tests, browser readiness specs, task hub tests, and `useCanvasExternalActionGate` coverage | Automated evidence complete |
| Duplicate and stale responses are ignored | `canvasPlatform.test.tsx`, flow component tests, Concierge voice-canvas response tests | Automated evidence complete |
| Feature flags and fallback restore old paths | `server/lib/canvasFeatureFlags.test.ts`, centralized server endpoint map, launch manifest server-key mapping, no-store HTTP endpoint check, rollout tests, shopping/refill page tests, unified rollback runbook | Local/runtime evidence complete; deployed endpoint toggle pending |
| Privacy-safe analytics for started, resumed, abandoned, blocked, confirmed, completed | `canvasLaunchSignalForTelemetry`, `canvasLaunchTelemetry.ts`, launch manifest signal map, widened forbidden-field manifest, dispatch boundary test, and aggregate-only counter/listener tests against forbidden fields | Automated evidence complete; production analytics sink review pending |
| Senior-friendly copy and what-happens-next clarity | Flow view model/component tests, screenshots, and launch runbook QA prompts | Browser evidence complete; senior copy read-through pending |
| Launch checklist and rollback notes | `docs/runbooks/voice-canvas-launch-readiness.md`, `docs/audits/voice-canvas-real-device-qa-matrix.md`, `src/components/voice-canvas/canvasLaunchSignoff.test.ts`, plus existing ride/appointment/refill rollout runbooks | Complete; final sign-off gate pending real-device evidence |

## Verification performed

- Focused readiness suite with server flag checks:
  - `$env:DATABASE_URL='file:./dev.db'; npm run test -- server/lib/canvasFeatureFlags.test.ts src/components/voice-canvas/canvasPlatform.test.tsx src/components/voice-canvas/canvasPlatformCompliance.test.ts src/components/voice-canvas/canvasLaunchTelemetry.test.ts src/components/voice-canvas/canvasLaunchReadiness.test.ts src/components/voice-canvas/canvasLaunchSignoff.test.ts src/components/voice-canvas/providerReplyCanvasRollout.test.ts src/components/voice-canvas/ShoppingVoiceCanvas.test.tsx src/components/voice-canvas/ProviderReplyVoiceCanvas.test.tsx src/pages/ConciergeShoppingScreen.test.tsx src/pages/ConciergeTaskInboxPage.test.tsx src/pages/AdherenceReportScreen.actions.test.tsx`
  - Result: 129 tests passed.
- Browser readiness:
  - `npm run test:e2e -- e2e/voice-canvas-production-readiness.spec.ts e2e/appointment-canvas-production-readiness.spec.ts e2e/medication-refill-canvas-production-readiness.spec.ts e2e/canvas-launch-readiness.spec.ts e2e/task-hub-resume-launch-readiness.spec.ts`
  - Result: 18 tests passed.
- Typecheck:
  - `npm run typecheck`
  - Result: passed.

## Remaining launch sign-off checklist

Complete these on a staging or production-like deployment before enabling the feature for real users:

1. Verify each feature endpoint returns the intended payload with flags disabled and enabled:
   - `/api/config/features/ride-voice-canvas`
   - `/api/config/features/appointment-voice-canvas`
   - `/api/config/features/medication-refill-voice-canvas`
   - `/api/config/features/shopping-delivery-voice-canvas`
   - `/api/config/features/provider-reply-voice-canvas`
2. On a real phone, tablet, and desktop, run ride, appointment, refill, shopping, provider reply, and task hub resume. Record results in `docs/audits/voice-canvas-real-device-qa-matrix.md`.
3. For each flow, verify refresh, browser back, app exit/reopen, and network reconnect.
4. Toggle the relevant flag off during an open Canvas session and confirm the existing flow is restored without submitting work.
5. Review English and Spanish copy with long labels and confirm the user always understands what happens next.
6. Confirm production analytics receives only aggregate launch signals and closed envelope samples, never spoken text, addresses, provider names, medication details, item names, reply text, notes, references, dates, times, contact details, or account identifiers.

## Launch decision

Do not mark the Canvas launch-readiness goal complete until the remaining deployed/manual checklist above is executed and recorded. The current branch makes the feature safer and reviewable, but it is not a substitute for real-device rollback and reconnect QA.
