# Shopping Delivery Voice Canvas rollout and rollback

## Safety invariants

- The Canvas prepares a shopping or delivery request only after explicit review confirmation.
- It never places an order, opens navigation, sends a message, calls a store, contacts a helper, or writes request details before confirmation.
- Duplicate confirmation, stale-response, abort, and safe-restoration guards remain enabled.
- Telemetry contains only event, scene, input category, attempt count, and restoration status; never shopping items, retailer names, prices, fees, addresses, transcripts, entered text, account identifiers, or personal details.

## Runtime controls

- `VYVA_ENABLE_SHOPPING_DELIVERY_VOICE_CANVAS=true` enables eligibility; every other value is the kill switch.
- `VYVA_SHOPPING_DELIVERY_VOICE_CANVAS_ROLLOUT_PERCENT=0..100` controls stable rollout.
- `/api/config/features/shopping-delivery-voice-canvas` is uncached with `Cache-Control: no-store` and refreshed by the client so rollback can take effect without a client rebuild.
- Missing, malformed, disabled, or rollout-0 configuration fails closed to the Existing shopping guide and recommendations.
- Fallback path: Existing shopping guide and recommendations.

Start with internal-only access, then 5%, 25%, 50%, and 100% only after reviewing aggregate scene-only started, resumed, abandoned, retry, blocked, confirmed, completed, and failed counts. Do not use event payloads to identify individual users.

## Immediate rollback

1. Set `VYVA_ENABLE_SHOPPING_DELIVERY_VOICE_CANVAS=false` and `VYVA_SHOPPING_DELIVERY_VOICE_CANVAS_ROLLOUT_PERCENT=0`, then restart the process if runtime configuration is read at process start. Do not rebuild the client for rollback.
2. Verify `/api/config/features/shopping-delivery-voice-canvas` reports `{ "enabled": false, "rolloutPercent": 0 }` with `Cache-Control: no-store`.
3. Capture sanitized rollback endpoint evidence with `npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=rollback-disabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json`. The artifact must contain endpoint/status/cache-control/timing plus enabled/rollout payload evidence only; never shopping items, retailer names, prices, fees, addresses, transcripts, entered text, account identifiers, or personal details.
4. Open `/concierge/shopping`, a shopping voice capture, and a task hub shopping draft resume; confirm the Existing shopping guide and recommendations appear instead of the Canvas.
5. Focus or refresh any open Shopping Delivery Canvas session and confirm the Canvas closes or hides without a write, order, call, message, navigation, resubmission, or external action. Sessions still cannot act without explicit confirmation during the short configuration-refresh interval.
6. Record the fallback and no-side-effect result in `docs/audits/voice-canvas-real-device-run-sheet.md`, `docs/audits/voice-canvas-real-device-evidence-packet.md`, and `docs/audits/voice-canvas-real-device-qa-matrix.md`; final launch sign-off still requires `npm run canvas:qa:preflight -- --final --date=YYYY-MM-DD` with the same-date, same deployed-origin launch evidence bundle: run plan, enabled and rollback-disabled endpoint artifacts, analytics, copy clarity, recovery behavior, real-use, entry-surface, and rollback-owner handoff artifacts, with endpoint auth metadata matching the launch run plan and no credential references.

## Failure triage

- Increased `failed`: inspect the request preparation path and Concierge task service health; disable the flag if sustained.
- Increased `retried`: check blocked-state copy, unavailable-option handling, and provider latency before expanding rollout.
- Increased `abandoned`: compare by scene only; never add entered values, item names, retailer names, addresses, or transcripts to diagnose.
- Reconnect reports: verify draft scenes restore entered information, while an in-flight waiting request returns to a safe state and is never automatically resubmitted.
- Privacy or safety concern: preserve privacy-safe event counts and request timing only; do not collect entered content, shopping items, retailer names, prices, fees, addresses, transcripts, account identifiers, or personal details while investigating.

## Release checks

- Run focused component, route, feature-flag, analytics, accessibility, responsive, and browser coverage for the shopping flow.
- Verify English and Spanish long labels at 390 px, 768 px, and desktop widths.
- Confirm no request write, order, call, message, navigation, or external action occurs before explicit confirmation.
- Confirm task hub shopping draft resume falls back to the existing shopping path when the destination Canvas flag is disabled or rollout 0.

## Rollback owner handoff

Before launch, name the rollback owner and backup owner in the launch record. The owner must be able to disable `VYVA_ENABLE_SHOPPING_DELIVERY_VOICE_CANVAS`, set `VYVA_SHOPPING_DELIVERY_VOICE_CANVAS_ROLLOUT_PERCENT=0`, verify the `/api/config/features/shopping-delivery-voice-canvas` rollback-disabled endpoint response, and confirm the Existing shopping guide and recommendations appear.

Use this copy-safe handoff note when recording ownership:

```text
Rollback owner handoff, reviewed on [YYYY-MM-DD] by [reviewer]:
- Owner/backup: [name or team] / [name or team]
- Decision time: [time window or incident bridge reference]
- Rollback trigger: pre-confirmation action, duplicate request/action, stale response accepted, privacy leak, fallback unavailable, restore failure, or sustained failed/retry/abandonment spike
- Rollback action: set enable false and rollout 0; restart only if runtime configuration is read at process start
- Evidence to capture: sanitized rollback-disabled endpoint artifact, Existing shopping guide and recommendations fallback screenshot, open-session Canvas closed/hidden observation, and no-write/no-external-action note
- Privacy boundary: no transcripts, entered text, shopping items, retailer names, prices, fees, addresses, account identifiers, or personal data in artifacts
```
