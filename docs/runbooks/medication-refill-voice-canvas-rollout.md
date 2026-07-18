# Medication refill Voice Canvas rollout

## Safety contract

This experience prepares a refill record only. It must not order or approve medication, contact a prescriber or pharmacy, navigate externally, or write refill data before explicit confirmation. It does not give dosing advice or infer medication identity, strength, or quantity.

Urgent language routes to visible urgent-help options. VYVA never silently calls or messages anyone. An unidentified medication blocks preparation.

## Rollout controls

- `VYVA_ENABLE_MEDICATION_REFILL_VOICE_CANVAS=true` enables eligibility.
- `VYVA_MEDICATION_REFILL_VOICE_CANVAS_ROLLOUT_PERCENT=0..100` controls deterministic rollout.
- Missing, malformed, or disabled configuration fails closed to the existing refill experience.
- Set the enable flag to `false` for immediate rollback. Open Canvas sessions close when the client refreshes configuration.

## Privacy and observation

Monitor only the closed events `scene_viewed`, `draft_restored`, `abandoned`, `retried`, `confirmation_submitted`, `completed`, `failed`, and `urgent_help_shown`. Allowed fields are scene step, interaction type, attempt count, and restoration state.

Never log medication names, strengths, quantities, provider/pharmacy names, notes, symptoms, transcripts, contact preferences, or preparation references.

## Release checklist

1. Verify the fallback with the flag disabled and with malformed configuration.
2. Run focused unit, integration, accessibility, responsive, and browser tests.
3. Verify English and Spanish long labels at desktop, tablet, and mobile widths.
4. Begin with an internal cohort, then a small percentage while watching abandonment, retry, completion, failure, and urgent-help event rates.
5. Confirm no external action or preparation request occurs before the review confirmation.

## Incident response

Immediately disable the flag for any pre-confirmation action, duplicate preparation, privacy leak, stale response acceptance, unsafe urgent routing, or inability to restore the existing flow. Preserve privacy-safe event counts and request timing only; do not collect entered content while investigating.
