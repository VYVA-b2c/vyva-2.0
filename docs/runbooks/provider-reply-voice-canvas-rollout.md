# Provider Reply Voice Canvas rollout and rollback

## Safety invariants

- The Canvas saves or completes a provider reply only after explicit review confirmation.
- It never sends a reply, marks a task complete, calls, messages, navigates externally, or writes reply details before confirmation.
- Duplicate confirmation, stale-response, abort, and safe-restoration guards remain enabled.
- Telemetry contains only event, scene, input category, attempt count, and restoration status; never provider names, reply text, notes, references, phone numbers, emails, transcripts, entered text, account identifiers, or personal details.

## Runtime controls

- `VYVA_ENABLE_PROVIDER_REPLY_VOICE_CANVAS=true` enables eligibility; every other value is the kill switch.
- `VYVA_PROVIDER_REPLY_VOICE_CANVAS_ROLLOUT_PERCENT=0..100` controls stable rollout.
- `/api/config/features/provider-reply-voice-canvas` is uncached with `Cache-Control: no-store` and refreshed by the client so rollback can take effect without a client rebuild.
- Missing, malformed, disabled, or rollout-0 configuration fails closed to the Existing provider reply panel.
- Fallback path: Existing provider reply panel.

Start with internal-only access, then 5%, 25%, 50%, and 100% only after reviewing aggregate scene-only started, resumed, abandoned, retry, blocked, confirmed, completed, and failed counts. Do not use event payloads to identify individual users.

## Immediate rollback

1. Set `VYVA_ENABLE_PROVIDER_REPLY_VOICE_CANVAS=false` and `VYVA_PROVIDER_REPLY_VOICE_CANVAS_ROLLOUT_PERCENT=0`, then restart the process if runtime configuration is read at process start. Do not rebuild the client for rollback.
2. Verify `/api/config/features/provider-reply-voice-canvas` reports `{ "enabled": false, "rolloutPercent": 0 }` with `Cache-Control: no-store`.
3. Capture sanitized rollback endpoint evidence with `npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=rollback-disabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json`. The artifact must contain endpoint/status/cache-control/timing plus enabled/rollout payload evidence only; never provider names, reply text, notes, references, phone numbers, emails, transcripts, entered text, account identifiers, or personal details.
4. Open a provider reply panel, a Concierge task detail, and a task hub pending-provider-reply resume; confirm the Existing provider reply panel appears instead of the Canvas.
5. Focus or refresh any open Provider Reply Canvas session and confirm the Canvas closes or hides without a write, save, completion, call, message, navigation, resubmission, or external action. Sessions still cannot act without explicit confirmation during the short configuration-refresh interval.
6. Record the fallback and no-side-effect result in `docs/audits/voice-canvas-real-device-run-sheet.md`, `docs/audits/voice-canvas-real-device-evidence-packet.md`, and `docs/audits/voice-canvas-real-device-qa-matrix.md`; final launch sign-off still requires `npm run canvas:qa:preflight -- --final` with enabled and rollback-disabled endpoint artifacts.

## Failure triage

- Increased `failed`: inspect provider reply save/complete actions and task service health; disable the flag if sustained.
- Increased `retried`: check blocked-state copy, validation, and task-service latency before expanding rollout.
- Increased `abandoned`: compare by scene only; never add reply text, provider names, notes, references, or transcripts to diagnose.
- Reconnect reports: verify draft scenes restore entered information, while an in-flight waiting request returns to a safe state and is never automatically resubmitted.
- Privacy or safety concern: preserve privacy-safe event counts and request timing only; do not collect entered content, provider names, reply text, notes, references, phone numbers, emails, transcripts, account identifiers, or personal details while investigating.

## Release checks

- Run focused component, task-inbox, feature-flag, analytics, accessibility, responsive, and browser coverage for provider reply.
- Verify English and Spanish long labels at 390 px, 768 px, and desktop widths.
- Confirm no reply save, completion, call, message, navigation, or external action occurs before explicit confirmation.
- Confirm task hub provider reply resume falls back to the existing provider reply panel when the destination Canvas flag is disabled or rollout 0.

## Rollback owner handoff

Before launch, name the rollback owner and backup owner in the launch record. The owner must be able to disable `VYVA_ENABLE_PROVIDER_REPLY_VOICE_CANVAS`, set `VYVA_PROVIDER_REPLY_VOICE_CANVAS_ROLLOUT_PERCENT=0`, verify the `/api/config/features/provider-reply-voice-canvas` rollback-disabled endpoint response, and confirm the Existing provider reply panel appears.

Use this copy-safe handoff note when recording ownership:

```text
Rollback owner handoff, reviewed on [YYYY-MM-DD] by [reviewer]:
- Owner/backup: [name or team] / [name or team]
- Decision time: [time window or incident bridge reference]
- Rollback trigger: pre-confirmation action, duplicate save/completion, stale response accepted, privacy leak, fallback unavailable, restore failure, or sustained failed/retry/abandonment spike
- Rollback action: set enable false and rollout 0; restart only if runtime configuration is read at process start
- Evidence to capture: sanitized rollback-disabled endpoint artifact, Existing provider reply panel fallback screenshot, open-session Canvas closed/hidden observation, and no-write/no-external-action note
- Privacy boundary: no transcripts, entered text, provider names, reply text, notes, references, phone numbers, emails, account identifiers, or personal data in artifacts
```
