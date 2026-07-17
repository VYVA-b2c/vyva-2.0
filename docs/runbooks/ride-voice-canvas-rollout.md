# Ride Voice Canvas rollout and rollback

## Safety invariants

- The Canvas never calls transport or Concierge action endpoints before review confirmation.
- Duplicate confirmation, stale response, and unmounted-request guards remain enabled.
- Telemetry contains only event name, enumerated scene, input category, attempt count, and restored status. It never contains addresses, place labels, dates, times, transcripts, or result references.

## Runtime controls

The endpoint `/api/config/features/ride-voice-canvas` reads these runtime settings on every request and sends `Cache-Control: no-store`:

- `VYVA_ENABLE_RIDE_VOICE_CANVAS=true` enables eligibility. Any other value is the global kill switch.
- `VYVA_RIDE_VOICE_CANVAS_ROLLOUT_PERCENT=0..100` controls the stable cohort percentage.

Start at 5%, then 25%, 50%, and 100% only after reviewing completion, abandonment, retry, and failure rates. Do not use event payloads to identify individual users.

## Immediate rollback

1. Set `VYVA_ENABLE_RIDE_VOICE_CANVAS=false` and restart the application process without rebuilding the client.
2. Confirm the feature endpoint returns `{ "enabled": false }`.
3. Open a voice ride handoff and confirm the existing Concierge transport panel appears instead of the Canvas.
4. Open Canvas sessions fall back on the next ten-second configuration refresh or immediately when the window regains focus. They still cannot act without explicit confirmation during that interval.

## Failure triage

- Increased `failed`: inspect transport options and Concierge action service health; disable the flag if sustained.
- Increased `retried`: check provider latency and blocked-state copy before expanding rollout.
- Increased `abandoned`: compare by scene only; never add entered values or transcripts to diagnose.
- Reconnect reports: verify a draft scene restores, while an in-flight waiting request returns to listening and is never resubmitted.

## Release checks

- Run focused component and Concierge tests, typecheck, changed-file lint, and the dedicated Playwright specification.
- Verify English and Spanish copy at 390 px, 768 px, and desktop widths.
- Confirm no transport or action request occurs before explicit confirmation.
