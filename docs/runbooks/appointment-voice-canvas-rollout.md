# Appointment Voice Canvas rollout and rollback

## Safety invariants
- The only request is created after explicit review confirmation.
- The Canvas never discovers or contacts providers, sends messages, opens booking pages, or records a booking.
- Duplicate, stale-response, abort, and safe-restoration guards remain enabled.
- Telemetry contains only event, scene, input category, attempt count, and restoration status; never personal details or transcripts.

## Runtime controls
- `VYVA_ENABLE_APPOINTMENT_VOICE_CANVAS=true` enables eligibility; every other value is the kill switch.
- `VYVA_APPOINTMENT_VOICE_CANVAS_ROLLOUT_PERCENT=0..100` controls stable rollout.
- `/api/config/features/appointment-voice-canvas` is uncached with `Cache-Control: no-store` and refreshed every ten seconds and on focus.
- Fallback path: Existing appointment panel.

Start at 5%, then 25%, 50%, and 100% after reviewing scene-only completion, abandonment, retry, and failure rates.

## Immediate rollback
1. Set `VYVA_ENABLE_APPOINTMENT_VOICE_CANVAS=false` and `VYVA_APPOINTMENT_VOICE_CANVAS_ROLLOUT_PERCENT=0`, then restart the process if runtime configuration is read at process start.
2. Verify `/api/config/features/appointment-voice-canvas` reports `{ "enabled": false, "rolloutPercent": 0 }` with `Cache-Control: no-store`.
3. Capture sanitized rollback endpoint evidence with `npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=rollback-disabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json`. The artifact must contain endpoint/status/cache-control/timing plus enabled/rollout payload evidence only; never provider names, appointment reasons, dates, times, transcripts, entered text, contact details, or booking details.
4. Confirm a voice appointment handoff displays the existing appointment panel.
5. Focus or refresh any open Canvas session and confirm the Canvas closes or hides without a write, booking, call, message, navigation, resubmission, or external action. Confirm an interrupted waiting request is never automatically resubmitted and cannot act without explicit confirmation.
6. Record the fallback and no-side-effect result in `docs/audits/voice-canvas-real-device-run-sheet.md`, `docs/audits/voice-canvas-real-device-evidence-packet.md`, and `docs/audits/voice-canvas-real-device-qa-matrix.md`; final launch sign-off still requires `npm run canvas:qa:preflight -- --final` with enabled and rollback-disabled endpoint artifacts.
