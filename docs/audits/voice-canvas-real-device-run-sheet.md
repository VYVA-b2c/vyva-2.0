# Voice Canvas real-device QA run sheet

Use this run sheet during staging or production-like real-device QA before filling `docs/audits/voice-canvas-real-device-qa-matrix.md`.

This file is not launch approval. It is the tester-facing execution sheet. Record sanitized artifacts in `docs/audits/voice-canvas-real-device-evidence-packet.md`, then copy final passing evidence into the QA matrix and run `npm run canvas:qa:validate` without `--allow-pending`.

Before starting a QA run, capture a read-only preflight snapshot:

```bash
npm run --silent canvas:qa:preflight -- --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-preflight.json
```

Use the QA run date in the output path. The preflight delegates to the run-sheet, matrix, and evidence-packet validators, preserves existing artifacts unless `--force` is explicit, and does not call feature endpoints, analytics, bookings, calls, messages, navigation, or data writes. After endpoint and analytics evidence are exported, include them in the same aggregate-only snapshot with `--features-enabled=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json`, `--features-rollback=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json`, and `--analytics=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json`. After all evidence is filled, run `npm run canvas:qa:preflight -- --final --features-enabled=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json --features-rollback=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json --analytics=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json` as the combined final local gate.

## Privacy and safety guardrails

- Use synthetic QA accounts and synthetic task details.
- Do not write spoken transcripts, typed free text, addresses, saved-place labels, medication details, provider names, reply text, notes, references, dates, times, shopping item details, phone numbers, emails, account identifiers, or personal details into this run sheet.
- Capture only sanitized screenshots, cropped photos, redacted logs, endpoint traces, analytics dashboard/query artifacts, and reviewer notes dated within the last 7 days.
- Stop and record a launch blocker if any flow performs a booking, call, message, navigation, order, refill request, provider reply, task completion, data write, or other external action before explicit final confirmation.
- Stop and record a launch blocker if feature-flag rollback does not restore the existing fallback path.

## Environment preflight

| Check | Expected result | Artifact/reference | Reviewer/date |
| --- | --- | --- | --- |
| Staging or production-like URL is deployed and non-local | Deployed URL opens on real phone, tablet, and desktop/laptop | Pending | Pending |
| Build or commit SHA matches the tested deployment | Commit/build is recorded before QA starts | Pending | Pending |
| Live voice session is available | Voice provider/session is live and not mocked | Pending | Pending |
| Initial feature flags are enabled for tested flows | Enabled true and rollout 100 are visible in flag artifact/log | Pending | Pending |
| Rollback feature flags are available | Disabled false and rollout 0 can be applied and verified | Pending | Pending |
| Analytics sink is available | Started, resumed, abandoned, blocked, confirmed, completed aggregate counts can be reviewed without sensitive fields | Pending | Pending |

Capture feature endpoint evidence from the deployed URL before filling the flag rows:

```bash
npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=enabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json
```

Replace `YYYY-MM-DD` with the QA run date and replace the base URL with the tested staging or production-like origin. Capture a second artifact after rollback using `--expected-state=rollback-disabled` and a distinct path such as `artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json`. The collector performs GET requests only, rejects local/private/placeholder hosts by default, preserves existing files unless `--force` is explicit, and records only sanitized endpoint status, cache-control, timing, expected state, `enabled`, `rolloutPercent`, recognized payload keys, and unexpected-key count. Launch evidence must show `Cache-Control: no-store`, enabled true/rollout 100 for the enabled artifact, enabled false/rollout 0 for the rollback-disabled artifact, and an integer `rolloutPercent` from 0 through 100.

Malformed-config and missing-config fail-closed behavior still require a sanitized manual deployment log, trace, or environment artifact. Print a manifest-filled template first:

```bash
npm run --silent canvas:qa:features -- --trace-template
```

Use this copy-safe shape from the command output for the evidence note; replace bracketed placeholders only, and do not paste raw response bodies, environment variable values, screenshots with personal data, or unexpected payload field names:

```text
Feature endpoint manual trace evidence, reviewed on [YYYY-MM-DD] by [reviewer]:
- Flow: [flow label]
- Endpoint: [exact /api/config/features/... endpoint]
- Server key: [server feature key]
- Malformed config artifact: [sanitized deployment log/trace/artifact reference]
- Missing config artifact: [sanitized deployment log/trace/artifact reference]
- Observed malformed-config behavior: fail-closed disabled false/rollout 0 and [named fallback path] visible
- Observed missing-config behavior: fail-closed disabled false/rollout 0 and [named fallback path] visible
- Privacy check: artifact contains no raw response body, unexpected field names, transcripts, entered text, addresses, medication details, provider details, shopping details, account identifiers, or personal data
```

## Flow execution checklist

For each flow below, test on a real phone, real tablet, and real desktop/laptop. Complete or safely exit with touch, keyboard, and voice where supported.

| Flow | Entry surface | Main path to exercise | Existing fallback path | Required sanitized artifacts |
| --- | --- | --- | --- | --- |
| Ride Voice Canvas | voice handoff, `/concierge`, task hub pending resume | Saved place or new address, date/time, review, explicit confirmation, waiting, completed or blocked | Existing Concierge transport panel | Device screenshots/photos; voice/touch/keyboard recording or log; endpoint rollback trace; analytics signal and privacy query |
| Appointment Voice Canvas | voice handoff, `/concierge`, task hub provider setup resume | Appointment choice, date/time, review, explicit confirmation, waiting, completed or blocked | Existing appointment panel | Device screenshots/photos; voice/touch/keyboard recording or log; endpoint rollback trace; analytics signal and privacy query |
| Medication Refill Voice Canvas | `/meds/adherence-report`, voice refill action, task hub local resume | Refill details, review, explicit confirmation, waiting, completed or blocked | Existing medication refill shopping/support path | Device screenshots/photos; voice/touch/keyboard recording or log; endpoint rollback trace; analytics signal and privacy query |
| Shopping Delivery Voice Canvas | `/concierge/shopping`, shopping voice capture, task hub local resume | Shopping request, review, explicit confirmation, waiting, completed or blocked | Existing shopping guide and recommendations | Device screenshots/photos; voice/touch/keyboard recording or log; endpoint rollback trace; analytics signal and privacy query |
| Provider Reply Voice Canvas | /concierge task detail, provider reply panel, task hub pending resume | Reply draft, review, explicit confirmation, waiting, saved or completed or blocked | Existing provider reply panel | Device screenshots/photos; voice/touch/keyboard recording or log; endpoint rollback trace; analytics signal and privacy query |
| Concierge Task Hub Resume | `/concierge/tasks`, `/concierge/tasks/:taskKey`, home resume card | Local shopping draft, local medication refill draft, pending provider reply task, stale or blocked task resume | Safe existing destination path for the underlying task | Task hub resume artifacts; destination fallback artifacts; no-write and no-external-action evidence |

## Per-flow behavior pass

Use one row per flow and device family if the artifacts differ by device.

| Flow | Device | Interaction mode | Start/resume restored work | App exit/reopen restored draft | Refresh/reconnect restored work | Voice interruption recovered work | Browser back preserved or returned safely | Cancel/exit left safely | Duplicate prevented and stale response ignored | Recoverable failure offered retry and exit | Evidence reference | Reviewer/date |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ride Voice Canvas | Phone | Voice/touch/keyboard | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Ride Voice Canvas | Tablet | Voice/touch/keyboard | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Ride Voice Canvas | Desktop/laptop | Voice/touch/keyboard | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Appointment Voice Canvas | Phone | Voice/touch/keyboard | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Appointment Voice Canvas | Tablet | Voice/touch/keyboard | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Appointment Voice Canvas | Desktop/laptop | Voice/touch/keyboard | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Medication Refill Voice Canvas | Phone | Voice/touch/keyboard | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Medication Refill Voice Canvas | Tablet | Voice/touch/keyboard | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Medication Refill Voice Canvas | Desktop/laptop | Voice/touch/keyboard | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Shopping Delivery Voice Canvas | Phone | Voice/touch/keyboard | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Shopping Delivery Voice Canvas | Tablet | Voice/touch/keyboard | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Shopping Delivery Voice Canvas | Desktop/laptop | Voice/touch/keyboard | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Provider Reply Voice Canvas | Phone | Voice/touch/keyboard | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Provider Reply Voice Canvas | Tablet | Voice/touch/keyboard | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Provider Reply Voice Canvas | Desktop/laptop | Voice/touch/keyboard | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Concierge Task Hub Resume | Phone | Voice/touch/keyboard where supported | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Concierge Task Hub Resume | Tablet | Voice/touch/keyboard where supported | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Concierge Task Hub Resume | Desktop/laptop | Voice/touch/keyboard where supported | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

## Confirmation and rollback pass

| Flow | No external action before explicit confirmation | Explicit confirmation accepted once | Waiting state explains what is pending and what has not happened | Completed or blocked result explains what happens next | In-session flag rollback closes or hides Canvas | Existing fallback path appears | No write or external action during rollback | Evidence reference | Reviewer/date |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ride Voice Canvas | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Appointment Voice Canvas | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Medication Refill Voice Canvas | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Shopping Delivery Voice Canvas | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Provider Reply Voice Canvas | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| Concierge Task Hub Resume | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

## Copy, accessibility, and analytics pass

| Check | Expected result | Evidence reference | Reviewer/date |
| --- | --- | --- | --- |
| English copy uses one clear decision at a time | Every flow has one clear decision and a clear exit path | Pending | Pending |
| Spanish long labels remain readable | Labels remain readable or legible with no horizontal overflow, clipping, or truncation | Pending | Pending |
| Focus moves meaningfully | Focus moves to the new scene heading or primary control when scenes change | Pending | Pending |
| Screen-reader announcements fire | Waiting, blocked, and completed states are announced | Pending | Pending |
| Reduced-motion mode remains calm | Reduced motion is usable and does not rely on animation for meaning | Pending | Pending |
| Analytics launch signals are present | Started, resumed, abandoned, blocked, confirmed, and completed have positive aggregate counts; completed may use completed or terminal pending source samples | Pending | Pending |
| Analytics privacy is preserved | Telemetry includes only `name`, `step`, `input`, `attempt`, `restored`, and `revision`, with forbidden data classes absent | Pending | Pending |

After exporting sanitized staging analytics evidence, validate it before filling the analytics rows:

```bash
npm run --silent canvas:qa:analytics -- --input=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json --json --output=artifacts/voice-canvas/YYYY-MM-DD-analytics-validation.json
```

If the analytics evidence file is being assembled by hand from aggregate QA evidence, start from the copy-safe template instead of a raw export:

```bash
npm run --silent canvas:qa:analytics -- --template
```

The template is intentionally not launch-ready. Replace the placeholder timestamp, source, zero counts, and empty sample array with real staging or production-like aggregate evidence before validation.

The analytics evidence JSON must include aggregate `coveredFlows` for `ride`, `appointment`, `refill`, `shopping`, `provider_reply`, and `task_hub_resume`; use only synthetic QA telemetry samples; and must not include transcripts, entered text, addresses, dates, names, medication details, provider details, shopping details, contact details, account identifiers, or personal data. The validator output is an aggregate validation artifact only; it does not copy raw sample rows or unexpected values.

Validate the evidence packet before copying packet notes into the final matrix:

```bash
npm run --silent canvas:qa:packet -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-evidence-packet-summary.json
```

Use a distinct run-specific output path and do not overwrite an earlier artifact. Omit `--allow-pending` for the final packet gate after every packet inventory row has a sanitized artifact reference and a reviewer/date note with explicit reviewed, verified, validated, approved, or sign-off wording dated within the last 7 days.

## Run-sheet closeout

Before filling the final QA matrix:

- Every `Pending` cell above has a passing result, sanitized artifact reference, and a reviewer/date note with explicit reviewed, verified, validated, approved, or sign-off wording dated within the last 7 days. Do not use generic closeout notes such as `pass`, `done`, or `OK`, and do not include street-address-shaped text, phone numbers, emails, or other personal details.
- Every artifact reference also appears in `docs/audits/voice-canvas-real-device-evidence-packet.md`.
- Every launch blocker has either been patched and retested or the feature remains disabled.
- `npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=enabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json` and a distinct `--expected-state=rollback-disabled` endpoint artifact have been captured from the deployed URL without overwriting an earlier artifact.
- `npm run --silent canvas:qa:analytics -- --input=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json --json --output=artifacts/voice-canvas/YYYY-MM-DD-analytics-validation.json` has passed for the sanitized analytics evidence artifact without overwriting an earlier artifact.
- `npm run --silent canvas:qa:packet -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-evidence-packet-summary.json` has been captured as a packet artifact while evidence is still pending, using the QA run date in the output path and not overwriting an earlier artifact.
- `npm run --silent canvas:qa:validate -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-qa-summary.json` has been captured as a QA artifact while the matrix is still pending, using the QA run date in the output path and not overwriting an earlier artifact.
- `npm run --silent canvas:qa:preflight -- --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-preflight.json` has been captured before QA starts, and `npm run canvas:qa:preflight -- --final --features-enabled=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json --features-rollback=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json --analytics=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json` passes after the run sheet, packet, matrix, sanitized feature endpoint evidence, and sanitized analytics evidence are complete.
- `npm run canvas:qa:validate` passes only after the matrix is complete and marked `ready for launch`.
