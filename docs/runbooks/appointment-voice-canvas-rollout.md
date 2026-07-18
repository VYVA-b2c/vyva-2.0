# Appointment Voice Canvas rollout and rollback

## Safety invariants
- The only request is created after explicit review confirmation.
- The Canvas never discovers or contacts providers, sends messages, opens booking pages, or records a booking.
- Duplicate, stale-response, abort, and safe-restoration guards remain enabled.
- Telemetry contains only event, scene, input category, attempt count, and restoration status; never personal details or transcripts.

## Runtime controls
- `VYVA_ENABLE_APPOINTMENT_VOICE_CANVAS=true` enables eligibility; every other value is the kill switch.
- `VYVA_APPOINTMENT_VOICE_CANVAS_ROLLOUT_PERCENT=0..100` controls stable rollout.
- `/api/config/features/appointment-voice-canvas` is uncached and refreshed every ten seconds and on focus.

Start at 5%, then 25%, 50%, and 100% after reviewing scene-only completion, abandonment, retry, and failure rates.

## Immediate rollback
1. Set `VYVA_ENABLE_APPOINTMENT_VOICE_CANVAS=false` and restart the process.
2. Verify the endpoint reports `enabled: false`.
3. Confirm a voice appointment handoff displays the existing appointment panel.
4. Confirm an interrupted waiting request is never automatically resubmitted.
