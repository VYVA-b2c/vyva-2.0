# Medication refill Voice Canvas rollout

## Safety contract

This experience prepares a refill record only. It must not order or approve medication, contact a prescriber or pharmacy, navigate externally, or write refill data before explicit confirmation. It does not give dosing advice or infer medication identity, strength, or quantity.

Urgent language routes to visible urgent-help options. VYVA never silently calls or messages anyone. An unidentified medication blocks preparation.

## Rollout controls

- `VYVA_ENABLE_MEDICATION_REFILL_VOICE_CANVAS=true` enables eligibility.
- `VYVA_MEDICATION_REFILL_VOICE_CANVAS_ROLLOUT_PERCENT=0..100` controls deterministic rollout.
- Missing, malformed, or disabled configuration fails closed to the existing refill experience.
- `/api/config/features/medication-refill-voice-canvas` must return uncached responses with `Cache-Control: no-store`.
- Set the enable flag to `false` and rollout percent to `0` for immediate rollback. Open Canvas sessions close when the client refreshes configuration.
- Fallback path: Existing medication refill shopping/support path.

## Immediate rollback

1. Set `VYVA_ENABLE_MEDICATION_REFILL_VOICE_CANVAS=false` and `VYVA_MEDICATION_REFILL_VOICE_CANVAS_ROLLOUT_PERCENT=0`, then restart the process if runtime configuration is read at process start.
2. Verify `/api/config/features/medication-refill-voice-canvas` reports `{ "enabled": false, "rolloutPercent": 0 }` with `Cache-Control: no-store`.
3. Capture sanitized rollback endpoint evidence with `npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=rollback-disabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json`. The artifact must contain endpoint/status/cache-control/timing plus enabled/rollout payload evidence only; never medication names, strengths, quantities, symptoms, pharmacy or provider names, notes, transcripts, entered text, contact details, or preparation references.
4. Open a medication refill handoff and confirm the existing medication refill shopping/support path appears instead of the Canvas.
5. Focus or refresh any open Canvas session and confirm the Canvas closes or hides without a write, refill preparation, order, approval, call, message, navigation, resubmission, or external action. Confirm it cannot act without explicit confirmation.
6. Record the fallback and no-side-effect result in `docs/audits/voice-canvas-real-device-run-sheet.md`, `docs/audits/voice-canvas-real-device-evidence-packet.md`, and `docs/audits/voice-canvas-real-device-qa-matrix.md`; final launch sign-off still requires `npm run canvas:qa:preflight -- --final` with enabled and rollback-disabled endpoint artifacts.

## Privacy and observation

Telemetry contains only closed events such as `scene_viewed`, `draft_restored`, `abandoned`, `retried`, `confirmation_submitted`, `completed`, `failed`, and `urgent_help_shown`. Allowed fields are scene step, interaction type, attempt count, and restoration state.

Never log medication names, strengths, quantities, provider/pharmacy names, notes, symptoms, transcripts, contact preferences, or preparation references.

## Release checklist

1. Verify the fallback with the flag disabled and with malformed configuration.
2. Run focused unit, integration, accessibility, responsive, and browser tests.
3. Verify English and Spanish long labels at desktop, tablet, and mobile widths.
4. Begin with an internal cohort, then a small percentage while watching abandonment, retry, completion, failure, and urgent-help event rates.
5. Confirm no external action or preparation request occurs before the review confirmation.

## Incident response

Immediately disable the flag for any pre-confirmation action, duplicate preparation, privacy leak, stale response acceptance, unsafe urgent routing, or inability to restore the existing flow. Preserve privacy-safe event counts and request timing only; do not collect entered content while investigating.
