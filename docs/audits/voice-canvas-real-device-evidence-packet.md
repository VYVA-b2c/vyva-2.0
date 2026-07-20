# Voice Canvas real-device evidence packet

Use this packet after executing `docs/audits/voice-canvas-real-device-run-sheet.md` and before filling `docs/audits/voice-canvas-real-device-qa-matrix.md`. It gives QA one sanitized place to name artifacts, dates, reviewers, and the matrix rows each artifact proves.

This packet is not launch approval. The QA matrix remains the launch gate, and `npm run canvas:qa:validate` must pass without `--allow-pending` before Canvas is enabled for real users.

Validate this packet before copying evidence into the QA matrix:

```bash
npm run --silent canvas:qa:packet -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-evidence-packet-summary.json
```

Use `--allow-pending` while gathering artifacts and omit it for the final packet gate. The validator reports pending packet cells by section, checks required inventory/flow/evidence-note rows, preserves existing output unless `--force` is explicit, and rejects unsafe artifact references without copying raw artifact-reference values into output.

For analytics evidence, use `npm run --silent canvas:qa:analytics -- --template` as a copy-safe starting shape when needed. The template is intentionally incomplete and must be filled with real staging or production-like aggregate evidence before `canvas:qa:analytics` validation can pass.

## Privacy rules for every artifact

- Do not capture spoken transcripts, typed free text, addresses, saved-place labels, medication details, provider names, reply text, notes, references, dates, times, shopping item details, account identifiers, phone numbers, emails, or other personal details.
- Use synthetic QA data and cropped or redacted screenshots whenever possible.
- Prefer sanitized artifact names over raw URLs when the destination may expose personal data.
- Each note and inventory reviewer/date cell must include a non-future `YYYY-MM-DD` date no older than 7 days, the reviewer or QA owner, and explicit reviewed, verified, validated, approved, or sign-off wording.
- If an artifact accidentally contains personal details, do not link it here or in the QA matrix. Replace it with a sanitized artifact.

## Evidence packet inventory

| Artifact set | Suggested sanitized reference | Matrix rows it should prove | Reviewer/date |
| --- | --- | --- | --- |
| Environment and flag artifacts | `voice-canvas/env-flags/<YYYY-MM-DD>/enabled-disabled-rollout-log` | Environment record; feature endpoint and rollback checks | Pending |
| Real-device screenshots or photos | `voice-canvas/devices/<YYYY-MM-DD>/<flow>-phone-tablet-desktop` | Device coverage for phone, tablet, and desktop/laptop | Pending |
| Interaction recordings or logs | `voice-canvas/interactions/<YYYY-MM-DD>/<flow>-voice-touch-keyboard` | Interaction mode coverage for voice, touch, and keyboard | Pending |
| Behavior recovery artifacts | `voice-canvas/recovery/<YYYY-MM-DD>/<flow>-resume-refresh-reconnect-back-cancel` | Required behavior checklist for resume, app exit/reopen, refresh/reconnect, interruption, browser back, cancel, retry, duplicate/stale guard, and no side effects | Pending |
| Feature endpoint artifacts | `voice-canvas/endpoints/<YYYY-MM-DD>/feature-endpoints-enabled.json`, `voice-canvas/endpoints/<YYYY-MM-DD>/feature-endpoints-rollback-disabled.json`, and `<flow>-malformed-missing-rollback-trace` | Feature endpoint and rollback checks | Pending |
| Task hub resume artifacts | `voice-canvas/task-hub/<YYYY-MM-DD>/resume-fallback-no-side-effects` | Task hub destination fallback checks | Pending |
| Copy and accessibility artifacts | `voice-canvas/accessibility/<YYYY-MM-DD>/copy-focus-screenreader-reduced-motion` | Copy and accessibility read-through | Pending |
| Analytics signal artifacts | `voice-canvas/analytics/<YYYY-MM-DD>/analytics-evidence.json` and `voice-canvas/analytics/<YYYY-MM-DD>/analytics-validation.json` | Analytics signal review | Pending |
| Analytics privacy artifacts | `voice-canvas/privacy/<YYYY-MM-DD>/allowed-envelope-forbidden-data-absent` plus `voice-canvas/analytics/<YYYY-MM-DD>/analytics-validation.json` | Analytics privacy review | Pending |
| Run sheet validation artifacts | `voice-canvas/run-sheet/<YYYY-MM-DD>/run-sheet-summary.json` | Run sheet validation evidence before copying packet notes into the matrix | Pending |
| Launch preflight artifacts | `voice-canvas/preflight/<YYYY-MM-DD>/launch-preflight.json` | Final combined local gate for run sheet, matrix, packet, endpoint, and analytics evidence | Pending |

## Feature endpoint manual trace template

Use `npm run --silent canvas:qa:features -- --trace-template` to print a manifest-filled copy-safe shape for malformed-config and missing-config evidence that cannot be collected by `canvas:qa:features`. Replace bracketed placeholders only. Do not include raw response bodies, environment variable values, screenshots with personal data, unexpected payload field names, transcripts, entered text, addresses, medication details, provider details, shopping details, account identifiers, or personal data.

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

## Flow packet checklist

Use one flow packet per launch surface.

| Flow | Required packet coverage |
| --- | --- |
| Ride Voice Canvas | Real phone/tablet/desktop evidence; voice/touch/keyboard completion or safe exit; saved-place or address path without exposing the address; review and explicit confirmation; no booking, call, message, navigation, or write before confirmation; duplicate confirmation prevention; stale response ignored; flag rollback to Existing Concierge transport panel |
| Appointment Voice Canvas | Real phone/tablet/desktop evidence; voice/touch/keyboard completion or safe exit; date/time path without exposing date or time details; review and explicit confirmation; no booking, call, message, navigation, or write before confirmation; duplicate confirmation prevention; stale response ignored; flag rollback to Existing appointment panel |
| Medication Refill Voice Canvas | Real phone/tablet/desktop evidence; voice/touch/keyboard completion or safe exit; refill path without exposing medication details; review and explicit confirmation; no refill request, call, message, navigation, or write before confirmation; duplicate confirmation prevention; stale response ignored; flag rollback to Existing medication refill shopping/support path |
| Shopping Delivery Voice Canvas | Real phone/tablet/desktop evidence; voice/touch/keyboard completion or safe exit; shopping path without exposing item or retailer details; review and explicit confirmation; no order, call, message, navigation, or write before confirmation; duplicate confirmation prevention; stale response ignored; flag rollback to Existing shopping guide and recommendations |
| Provider Reply Voice Canvas | Real phone/tablet/desktop evidence; voice/touch/keyboard completion or safe exit; provider reply path without exposing provider names or reply text; review and explicit confirmation; no reply, call, message, navigation, completion, or write before confirmation; duplicate confirmation prevention; stale response ignored; flag rollback to Existing provider reply panel |
| Concierge Task Hub Resume | Real phone/tablet/desktop evidence; voice/touch/keyboard completion or safe exit where supported; local shopping draft, local medication refill draft, pending provider reply task, and stale or blocked task resume; destination flag fallback to named existing paths; no writes or external actions before confirmation |

## Behavior recovery evidence template

Use this copy-safe shape for each behavior recovery artifact before summarizing it in the QA matrix. Replace bracketed placeholders only. Do not include transcripts, entered text, addresses, medication details, provider details, shopping details, account identifiers, or personal data.

```text
Behavior recovery evidence, reviewed on [YYYY-MM-DD] by [reviewer], artifact [sanitized reference]:
- Flow/device/input: [flow] / [phone|tablet|desktop] / [voice|touch|keyboard]
- Start/resume: restored current scene or work with entered information preserved; no write, no resubmission, no external action
- App exit/reopen: restored draft with entered information preserved; no write, no resubmission, no external action
- Refresh/reconnect: restored work with entered information preserved; no write, no resubmission, no external action
- Voice interruption: recovered interrupted work with entered information preserved; no write, no resubmission, no external action
- Browser back: returned safely or preserved entered information; no write, no external action
- Cancel/exit: left safely; no write, no external action
- Duplicate/stale guard: duplicate confirmation/action was prevented, blocked, ignored, rejected, or discarded; stale response was ignored, rejected, or discarded
- Recoverable failure: retry and exit or cancel were offered with entered information preserved; no extra write, no resubmission, no external action
- Privacy check: artifact contains no transcripts, entered text, addresses, medication details, provider details, shopping details, account identifiers, or personal data
```

Use this copy/accessibility evidence template before summarizing copy/accessibility artifacts in the QA matrix. Replace bracketed placeholders only. Do not include transcripts, entered text, addresses, medication details, provider details, shopping details, account identifiers, or personal data.

```text
Copy/accessibility evidence, reviewed on [YYYY-MM-DD] by [reviewer], artifact [sanitized reference]:
- Flow/device/input: [flow] / [phone|tablet|desktop] / [voice|touch|keyboard]
- One clear decision: the scene shows one decision or safe exit at a time
- Spanish long labels: labels are readable or legible with no horizontal overflow, clipping, or truncation
- Waiting state: copy explains what is pending or in progress and what has not happened yet
- Blocked state: copy explains what information is needed and offers retry plus exit or cancel
- Completed state: copy explains the outcome without implying an extra action
- Keyboard: user can complete the flow or safely exit using only the keyboard
- Focus movement: scene change moves focus to the new scene heading or primary control
- Screen-reader announcements: waiting, blocked, and completed states are announced
- Reduced motion: reduced-motion mode remains calm and usable and does not rely on animation for meaning
- Privacy check: artifact contains no transcripts, entered text, addresses, medication details, provider details, shopping details, account identifiers, or personal data
```

## Copy-ready evidence note patterns

Replace bracketed text before copying into the QA matrix.

| Matrix area | Evidence note pattern |
| --- | --- |
| Device coverage | `QA real-device screenshot/photo artifact [reference] reviewed on [YYYY-MM-DD] by [reviewer]: real phone, tablet, and desktop/laptop coverage passed for [flow] with no transcripts, entered text, addresses, or personal details visible.` |
| Interaction mode coverage | `QA interaction recording/log artifact [reference] reviewed on [YYYY-MM-DD] by [reviewer]: [flow] completed or safely exited with voice, touch, and keyboard; artifact excludes spoken transcripts, entered text, addresses, and personal details.` |
| Required behavior | `QA behavior artifact [reference] reviewed on [YYYY-MM-DD] by [reviewer]: [flow] restored entered information across start/resume, app exit/reopen, refresh/reconnect, voice interruption, browser back, cancel/exit, and recoverable failure retry/exit with no write, no resubmission, and no external action before explicit confirmation; duplicate confirmation was prevented and stale response was ignored.` |
| Feature endpoint and rollback | `QA endpoint collector JSON and trace/log artifact [reference] reviewed on [YYYY-MM-DD] by [reviewer]: [endpoint] using server key [server key] showed disabled false/rollout 0, enabled true/rollout 100, malformed-config fail-closed fallback, missing-config fail-closed fallback, and in-session rollback to [named fallback path]; artifacts include matching expected-state labels, Cache-Control no-store, and only sanitized endpoint/status/cache-control/timing plus enabled/rollout payload evidence.` |
| Task hub destination fallback | `QA task hub artifact [reference] reviewed on [YYYY-MM-DD] by [reviewer]: [task path] resumed when destination Canvas was enabled, fell back to [named existing path] when disabled or rollout 0, and performed no writes and no external actions before confirmation.` |
| Copy and accessibility | `QA copy/accessibility artifact [reference] reviewed on [YYYY-MM-DD] by [reviewer]: one clear decision, Spanish long-label readability with no overflow/clipping/truncation, waiting pending/no-action copy, blocked retry/exit copy, completed outcome/no-extra-action copy, keyboard completion or safe exit, focus movement, screen-reader announcements for waiting/blocked/completed, and calm reduced-motion behavior passed.` |
| Analytics signal | `QA analytics dashboard/query and canvas:qa:analytics validation artifact [reference] reviewed on [YYYY-MM-DD] by [reviewer]: [launch signal] source event [source event] produced aggregate signal count [positive number] with only allowed envelope fields; validation confirmed coveredFlows for ride, appointment, refill, shopping, provider_reply, and task_hub_resume plus positive observed sample counts for started, resumed, abandoned, blocked, confirmed, and completed, with completed proven by completed or terminal pending samples.` |
| Analytics privacy | `QA analytics privacy and canvas:qa:analytics validation artifact [reference] reviewed on [YYYY-MM-DD] by [reviewer]: [forbidden data class] was absent and was not recorded, logged, sent, captured, or included; sample contained only allowed envelope fields.` |

## Final pre-fill check

Before changing the QA matrix from `pending execution` to `ready for launch`, confirm:

- every packet row above has a sanitized artifact reference and a reviewer/date cell with explicit reviewed, verified, validated, approved, or sign-off wording;
- every launch flow has real phone, tablet, and desktop/laptop evidence;
- every launch flow has voice, touch, and keyboard completion or safe-exit evidence where supported;
- rollback evidence names the actual fallback path for each feature-flagged flow;
- enabled and rollback-disabled `canvas:qa:features` artifacts were captured from the deployed URL with distinct run-specific paths and matching expected-state labels;
- task hub evidence covers local shopping draft, local medication refill draft, pending provider reply task, and stale or blocked task;
- `canvas:qa:runsheet` validation passed and produced a run-specific `run-sheet-summary.json` artifact before run-sheet evidence was copied into the packet or QA matrix;
- `canvas:qa:packet` validation passed and produced a run-specific `evidence-packet-summary.json` artifact before evidence was copied into the QA matrix;
- analytics evidence has coveredFlows for ride, appointment, refill, shopping, provider_reply, and task_hub_resume plus positive aggregate counts for started, resumed, abandoned, blocked, confirmed, and completed;
- `canvas:qa:analytics` validation passed for the sanitized analytics evidence artifact and produced a run-specific validation artifact;
- `canvas:qa:preflight -- --final` passed with the run sheet, matrix, packet, enabled endpoint, rollback endpoint, and analytics artifact paths and produced a run-specific launch preflight artifact;
- privacy evidence names each forbidden data class and confirms it was absent from the telemetry sample;
- no artifact link exposes personal details.
