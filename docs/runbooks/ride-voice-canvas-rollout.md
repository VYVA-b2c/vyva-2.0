# Ride Voice Canvas rollout and rollback

## Safety invariants

- The Canvas never calls transport or Concierge action endpoints before review confirmation.
- Duplicate confirmation, stale response, and unmounted-request guards remain enabled.
- Telemetry contains only event name, enumerated scene, input category, attempt count, and restored status. It never contains addresses, place labels, dates, times, transcripts, or result references.

## Runtime controls

The endpoint `/api/config/features/ride-voice-canvas` reads these runtime settings on every request and sends `Cache-Control: no-store`:

- `VYVA_ENABLE_RIDE_VOICE_CANVAS=true` enables eligibility. Any other value is the global kill switch.
- `VYVA_RIDE_VOICE_CANVAS_ROLLOUT_PERCENT=0..100` controls the stable cohort percentage.
- Fallback path: Existing Concierge transport panel.

Start at 5%, then 25%, 50%, and 100% only after reviewing completion, abandonment, retry, and failure rates. Do not use event payloads to identify individual users.

## Immediate rollback

1. Set `VYVA_ENABLE_RIDE_VOICE_CANVAS=false` and `VYVA_RIDE_VOICE_CANVAS_ROLLOUT_PERCENT=0`, then restart the application process if runtime configuration is read at process start. Do not rebuild the client for rollback.
2. Confirm `/api/config/features/ride-voice-canvas` returns `{ "enabled": false, "rolloutPercent": 0 }` with `Cache-Control: no-store`.
3. Capture sanitized rollback endpoint evidence with `npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=rollback-disabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json`. The artifact must contain endpoint/status/cache-control/timing plus enabled/rollout payload evidence only; never addresses, saved-place labels, spoken transcripts, entered text, dates, times, or ride details.
4. Open a voice ride handoff and confirm the existing Concierge transport panel appears instead of the Canvas.
5. Focus or refresh any open Canvas session and confirm the Canvas closes or hides without a write, booking, call, message, navigation, resubmission, or external action. Sessions still cannot act without explicit confirmation during the short configuration-refresh interval.
6. Record the fallback and no-side-effect result in `docs/audits/voice-canvas-real-device-run-sheet.md`, `docs/audits/voice-canvas-real-device-evidence-packet.md`, and `docs/audits/voice-canvas-real-device-qa-matrix.md`; final launch sign-off still requires `npm run canvas:qa:preflight -- --final` with the same-date launch evidence bundle: run plan, enabled and rollback-disabled endpoint artifacts, analytics, copy clarity, recovery behavior, real-use, entry-surface, and rollback-owner handoff artifacts.

## Failure triage

- Increased `failed`: inspect transport options and Concierge action service health; disable the flag if sustained.
- Increased `retried`: check provider latency and blocked-state copy before expanding rollout.
- Increased `abandoned`: compare by scene only; never add entered values or transcripts to diagnose.
- Reconnect reports: verify a draft scene restores, while an in-flight waiting request returns to listening and is never resubmitted.
- Privacy or safety concern: preserve privacy-safe event counts and request timing only; do not collect entered content, addresses, saved-place labels, transcripts, dates, times, or ride details while investigating.

## Release checks

- Run focused component and Concierge tests, typecheck, changed-file lint, and the dedicated Playwright specification.
- Verify English and Spanish copy at 390 px, 768 px, and desktop widths.
- Confirm no transport or action request occurs without explicit confirmation.

## Rollback owner handoff

Before launch, name the rollback owner and backup owner in the launch record. The owner must be able to disable `VYVA_ENABLE_RIDE_VOICE_CANVAS`, set `VYVA_RIDE_VOICE_CANVAS_ROLLOUT_PERCENT=0`, verify the `/api/config/features/ride-voice-canvas` rollback-disabled endpoint response, and confirm the Existing Concierge transport panel appears.

Use this copy-safe handoff note when recording ownership:

```text
Rollback owner handoff, reviewed on [YYYY-MM-DD] by [reviewer]:
- Owner/backup: [name or team] / [name or team]
- Decision time: [time window or incident bridge reference]
- Rollback trigger: pre-confirmation action, duplicate booking/action, stale response accepted, privacy leak, fallback unavailable, restore failure, or sustained failed/retry/abandonment spike
- Rollback action: set enable false and rollout 0; restart only if runtime configuration is read at process start
- Evidence to capture: sanitized rollback-disabled endpoint artifact, Existing Concierge transport panel fallback screenshot, open-session Canvas closed/hidden observation, and no-write/no-external-action note
- Privacy boundary: no transcripts, entered text, addresses, saved-place labels, dates, times, ride details, account identifiers, or personal data in artifacts
```
