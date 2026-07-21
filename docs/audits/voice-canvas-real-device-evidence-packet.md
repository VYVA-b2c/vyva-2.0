# Voice Canvas real-device evidence packet

Use this packet after executing `docs/audits/voice-canvas-real-device-run-sheet.md` and before filling `docs/audits/voice-canvas-real-device-qa-matrix.md`. It gives QA one sanitized place to name artifacts, dates, reviewers, and the matrix rows each artifact proves.

This packet is not launch approval. The QA matrix remains the launch gate, and `npm run canvas:qa:validate` must pass without `--allow-pending` before Canvas is enabled for real users.

Validate this packet before copying evidence into the QA matrix:

```bash
npm run --silent canvas:qa:packet -- --allow-pending --json --output=artifacts/voice-canvas/YYYY-MM-DD-evidence-packet-summary.json
```

Use `--allow-pending` while gathering artifacts and omit it for the final packet gate. The validator reports pending packet cells by section, checks required inventory/flow/evidence-note rows, preserves existing output unless `--force` is explicit, and rejects unsafe artifact references without copying raw artifact-reference values into output.

For analytics evidence, use `npm run --silent canvas:qa:analytics -- --template` as a copy-safe starting shape when needed. The template is intentionally incomplete and must be filled with real staging or production-like aggregate evidence before `canvas:qa:analytics` validation can pass.

For copy clarity evidence, use `npm run --silent canvas:qa:copy -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-copy-clarity.md` as a copy-safe starting artifact. The template must be filled with a deployed non-local QA run URL and deployed QA proof that every launch flow uses warm plain senior-friendly restrained copy, shows one clear decision at a time, explains what happens next for primary, secondary/back/cancel/exit, waiting, blocked, and completed states, handles long translated Spanish labels without overflow, moves focus meaningfully, announces waiting/blocked/completed states to screen readers, and respects reduced motion, then validated with `npm run --silent canvas:qa:copy -- --input=artifacts/voice-canvas/YYYY-MM-DD-copy-clarity.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-copy-clarity-validation.json` before filling the copy/accessibility artifact inventory row.

For recovery behavior evidence, use `npm run --silent canvas:qa:recovery -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-recovery-behavior.md` as a copy-safe starting artifact. The template must be filled with a deployed non-local QA run URL and deployed QA proof that every launch flow restores entered work across start/resume, app exit/reopen, refresh/reconnect, voice interruption, browser back, cancel/exit, retry after recoverable failure, duplicate prevention, and stale-response handling without writes, resubmissions, or external actions, then validated with `npm run --silent canvas:qa:recovery -- --input=artifacts/voice-canvas/YYYY-MM-DD-recovery-behavior.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-recovery-behavior-validation.json` before filling the behavior recovery artifact inventory row.

For real-use device and interaction evidence, use `npm run --silent canvas:qa:real-use -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-real-use-coverage.md` as a copy-safe starting artifact. The template must be filled with a deployed non-local QA run URL and deployed QA proof that every launch flow completed or safely exited on real physical phone/mobile, tablet, and desktop/laptop sessions plus voice, touch, and keyboard paths, with dated sanitized screenshot, photo, recording, log, capture, or artifact references and no-write/no-external-action proof before explicit confirmation, then validated with `npm run --silent canvas:qa:real-use -- --input=artifacts/voice-canvas/YYYY-MM-DD-real-use-coverage.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-real-use-validation.json` before filling the real-device and interaction artifact inventory rows.

For entry-surface evidence, use `npm run --silent canvas:qa:entry-surfaces -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces.md` as a copy-safe starting artifact. The template must be filled with a deployed non-local QA run URL and deployed QA proof that every canonical launch surface for every flow was exercised, including dated sanitized screenshot, log, recording, capture, photo, or artifact references and no-write/no-external-action proof before explicit confirmation, then validated with `npm run --silent canvas:qa:entry-surfaces -- --input=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces-validation.json` before filling the entry surface artifact inventory row.

For rollback-owner handoff evidence, use `npm run --silent canvas:qa:rollback-owner -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md` as a copy-safe starting artifact. The template must be filled with a deployed non-local QA run URL, real owner/backup, decision-window, rollback-trigger, rollback-action, endpoint/fallback/open-session evidence, privacy-boundary, and fallback-readiness proof, then validated with `npm run --silent canvas:qa:rollback-owner -- --input=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-validation.json` before final Operations sign-off. Use the same `YYYY-MM-DD` QA run date and the same deployed QA origin across launch run plan, enabled endpoint, rollback endpoint, analytics, copy-clarity, recovery-behavior, real-use, entry-surface, rollback-owner handoff, validation, and final preflight artifacts. If the QA origin uses preview-gateway auth, endpoint artifacts must prove only sanitized auth metadata matching the launch run plan request-header count and must not store credential names, values, tokens, cookies, passwords, API keys, or header values.

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
| Entry surface artifacts | `artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces.md` and `artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces-validation.json` | Per-flow entry surface screenshot/log/artifact coverage for every canonical launch surface in the manifest | Pending |
| Real-device screenshots or photos | `artifacts/voice-canvas/YYYY-MM-DD-real-use-coverage.md` and `artifacts/voice-canvas/YYYY-MM-DD-real-use-validation.json` | Device coverage for phone, tablet, and desktop/laptop | Pending |
| Interaction recordings or logs | `artifacts/voice-canvas/YYYY-MM-DD-real-use-coverage.md` and `artifacts/voice-canvas/YYYY-MM-DD-real-use-validation.json` | Interaction mode coverage for voice, touch, and keyboard | Pending |
| Behavior recovery artifacts | `artifacts/voice-canvas/YYYY-MM-DD-recovery-behavior.md` and `artifacts/voice-canvas/YYYY-MM-DD-recovery-behavior-validation.json` | Required behavior checklist for resume, app exit/reopen, refresh/reconnect, interruption, browser back, cancel, retry, duplicate/stale guard, and no side effects | Pending |
| Feature endpoint artifacts | `voice-canvas/endpoints/<YYYY-MM-DD>/feature-endpoints-enabled.json`, `voice-canvas/endpoints/<YYYY-MM-DD>/feature-endpoints-rollback-disabled.json`, and `<flow>-malformed-missing-rollback-trace` | Feature endpoint and rollback checks, including auth metadata matching the launch run plan | Pending |
| Task hub resume artifacts | `voice-canvas/task-hub/<YYYY-MM-DD>/resume-fallback-no-side-effects` | Task hub destination fallback checks | Pending |
| Rollback owner handoff artifacts | `voice-canvas/rollback-owner/<YYYY-MM-DD>/owner-backup-trigger-evidence` | Final Operations/rollback owner sign-off; owner/backup, decision window, rollback trigger, sanitized endpoint/fallback/open-session evidence, and privacy boundary | Pending |
| Copy and accessibility artifacts | `artifacts/voice-canvas/YYYY-MM-DD-copy-clarity.md` and `artifacts/voice-canvas/YYYY-MM-DD-copy-clarity-validation.json` | Copy and accessibility read-through | Pending |
| Analytics signal artifacts | `voice-canvas/analytics/<YYYY-MM-DD>/analytics-evidence.json` and `voice-canvas/analytics/<YYYY-MM-DD>/analytics-validation.json` | Analytics signal review | Pending |
| Analytics privacy artifacts | `voice-canvas/privacy/<YYYY-MM-DD>/allowed-envelope-forbidden-data-absent` plus `voice-canvas/analytics/<YYYY-MM-DD>/analytics-validation.json` | Analytics privacy review | Pending |
| Run sheet validation artifacts | `voice-canvas/run-sheet/<YYYY-MM-DD>/run-sheet-summary.json` | Run sheet validation evidence before copying packet notes into the matrix | Pending |
| Launch run plan artifacts | `voice-canvas/preflight/<YYYY-MM-DD>/launch-evidence-run.json` | Same-date and same deployed-origin launch artifact run plan for endpoint, analytics, copy-clarity, recovery-behavior, real-use, entry-surface, rollback-owner, run-sheet, matrix, packet, and final preflight evidence, including safe endpoint auth metadata alignment | Pending |
| Launch preflight artifacts | `voice-canvas/preflight/<YYYY-MM-DD>/launch-preflight.json` | Final combined local gate for run sheet, matrix, packet, run plan, endpoint, analytics, copy-clarity, recovery-behavior, real-use, entry-surface, and rollback-owner handoff evidence | Pending |

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
| Ride Voice Canvas | Entry surfaces: voice handoff, /concierge, and task hub pending resume; real phone/tablet/desktop evidence; voice/touch/keyboard completion or safe exit; saved-place or address path without exposing the address; review, explicit confirmation, waiting, completed or saved result, and blocked result; no booking, call, message, navigation, or write before confirmation; duplicate confirmation prevention; stale response ignored; flag rollback to Existing Concierge transport panel; sanitized artifact categories: device screenshots/photos, voice/touch/keyboard interaction logs, endpoint rollback, analytics signal, and privacy query |
| Appointment Voice Canvas | Entry surfaces: voice handoff, /concierge, and task hub provider setup resume; real phone/tablet/desktop evidence; voice/touch/keyboard completion or safe exit; date/time path without exposing date or time details; review, explicit confirmation, waiting, completed or saved result, and blocked result; no booking, call, message, navigation, or write before confirmation; duplicate confirmation prevention; stale response ignored; flag rollback to Existing appointment panel; sanitized artifact categories: device screenshots/photos, voice/touch/keyboard interaction logs, endpoint rollback, analytics signal, and privacy query |
| Medication Refill Voice Canvas | Entry surfaces: /meds/adherence-report, voice refill action, and task hub local resume; real phone/tablet/desktop evidence; voice/touch/keyboard completion or safe exit; refill path without exposing medication details; review, explicit confirmation, waiting, completed or saved result, and blocked result; no refill request, call, message, navigation, or write before confirmation; duplicate confirmation prevention; stale response ignored; flag rollback to Existing medication refill shopping/support path; sanitized artifact categories: device screenshots/photos, voice/touch/keyboard interaction logs, endpoint rollback, analytics signal, and privacy query |
| Shopping Delivery Voice Canvas | Entry surfaces: /concierge/shopping, shopping voice capture, and task hub local resume; real phone/tablet/desktop evidence; voice/touch/keyboard completion or safe exit; shopping path without exposing item or retailer details; review, explicit confirmation, waiting, completed or saved result, and blocked result; no order, call, message, navigation, or write before confirmation; duplicate confirmation prevention; stale response ignored; flag rollback to Existing shopping guide and recommendations; sanitized artifact categories: device screenshots/photos, voice/touch/keyboard interaction logs, endpoint rollback, analytics signal, and privacy query |
| Provider Reply Voice Canvas | Entry surfaces: /concierge task detail, provider reply panel, and task hub pending resume; real phone/tablet/desktop evidence; voice/touch/keyboard completion or safe exit; provider reply path without exposing provider names or reply text; review, explicit confirmation, waiting, completed or saved result, and blocked result; no reply, call, message, navigation, completion, or write before confirmation; duplicate confirmation prevention; stale response ignored; flag rollback to Existing provider reply panel; sanitized artifact categories: device screenshots/photos, voice/touch/keyboard interaction logs, endpoint rollback, analytics signal, and privacy query |
| Concierge Task Hub Resume | Entry surfaces: /concierge/tasks, /concierge/tasks/:taskKey, and home resume card; real phone/tablet/desktop evidence; voice/touch/keyboard completion or safe exit where supported; local shopping draft, local medication refill draft, pending provider reply task, and stale or blocked task resume; destination fallback to safe existing destination path; no writes or external actions before confirmation; sanitized artifact categories: task hub resume, destination fallback, no-write, and no-external-action artifacts |

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
| Feature endpoint and rollback | `QA endpoint collector JSON and trace/log artifact [reference] reviewed on [YYYY-MM-DD] by [reviewer]: [endpoint] using server key [server key] showed disabled false/rollout 0, enabled true/rollout 100, malformed-config fail-closed fallback, missing-config fail-closed fallback, and in-session rollback to [named fallback path]; artifacts include matching expected-state labels, Cache-Control no-store, auth metadata matching the launch run plan, no credential references, and only sanitized endpoint/status/cache-control/timing plus enabled/rollout payload evidence.` |
| Task hub destination fallback | `QA task hub artifact [reference] reviewed on [YYYY-MM-DD] by [reviewer]: [task path] resumed when destination Canvas was enabled, fell back to [named existing path] when disabled or rollout 0, and performed no writes and no external actions before confirmation.` |
| Rollback owner handoff | `QA rollback owner handoff artifact [reference] reviewed on [YYYY-MM-DD] by [reviewer]: Operations/rollback owner and backup owner, decision window, rollback trigger, enable false or disabled rollout 0 rollback action, sanitized endpoint/fallback/open-session evidence, Canvas closed or hidden behavior, privacy boundary, and fallback readiness were confirmed.` |
| Copy and accessibility | `QA copy/accessibility artifact [reference] reviewed on [YYYY-MM-DD] by [reviewer]: one clear decision, Spanish long-label readability with no overflow/clipping/truncation, waiting pending/no-action copy, blocked retry/exit copy, completed outcome/no-extra-action copy, keyboard completion or safe exit, focus movement, screen-reader announcements for waiting/blocked/completed, and calm reduced-motion behavior passed.` |
| Analytics signal | `QA analytics dashboard/query and canvas:qa:analytics validation artifact [reference] reviewed on [YYYY-MM-DD] by [reviewer]: [launch signal] source event [source event] produced aggregate signal count [positive number] with only allowed envelope fields and non-identifying allowed values; validation confirmed coveredFlows for ride, appointment, refill, shopping, provider_reply, and task_hub_resume plus positive observed sample counts for started, resumed, abandoned, blocked, confirmed, and completed, with completed proven by completed or terminal pending samples.` |
| Analytics privacy | `QA analytics privacy and canvas:qa:analytics validation artifact [reference] reviewed on [YYYY-MM-DD] by [reviewer]: [forbidden data class] was absent and was not recorded, logged, sent, captured, or included; sample contained only allowed envelope fields and non-identifying allowed values.` |

## Final pre-fill check

Before changing the QA matrix from `pending execution` to `ready for launch`, confirm:

- every packet row above has a sanitized artifact reference and a reviewer/date cell with explicit reviewed, verified, validated, approved, or sign-off wording;
- every launch flow has real phone, tablet, and desktop/laptop evidence;
- every launch flow has voice, touch, and keyboard completion or safe-exit evidence where supported;
- rollback evidence names the actual fallback path for each feature-flagged flow;
- enabled and rollback-disabled `canvas:qa:features` artifacts were captured from the deployed URL with distinct run-specific paths, matching expected-state labels, auth metadata matching the launch run plan, and no credential references;
- rollback owner handoff evidence names owner and backup, decision window, rollback trigger, rollback action, sanitized endpoint/fallback/open-session evidence, Canvas closed or hidden behavior, privacy boundary, and fallback readiness;
- task hub evidence covers local shopping draft, local medication refill draft, pending provider reply task, and stale or blocked task;
- `canvas:qa:runsheet` validation passed and produced a run-specific `run-sheet-summary.json` artifact before run-sheet evidence was copied into the packet or QA matrix;
- `canvas:qa:packet` validation passed and produced a run-specific `evidence-packet-summary.json` artifact before evidence was copied into the QA matrix;
- analytics evidence has coveredFlows for ride, appointment, refill, shopping, provider_reply, and task_hub_resume plus positive aggregate counts for started, resumed, abandoned, blocked, confirmed, and completed;
- `canvas:qa:analytics` validation passed for the sanitized analytics evidence artifact and produced a run-specific validation artifact;
- `canvas:qa:recovery` validation passed for the sanitized recovery behavior evidence artifact and produced a run-specific validation artifact before behavior recovery proof was copied into the packet or QA matrix;
- `canvas:qa:real-use` validation passed for the sanitized real-use device and interaction evidence artifact and produced a run-specific validation artifact before device or interaction proof was copied into the packet or QA matrix;
- `canvas:qa:entry-surfaces` validation passed for the sanitized entry-surface artifact and produced a run-specific validation artifact before entry-surface proof was copied into the packet or QA matrix;
- `canvas:qa:preflight -- --final --date=YYYY-MM-DD` passed with the run sheet, matrix, packet, launch run plan, enabled endpoint, rollback endpoint, analytics, copy-clarity, recovery-behavior, real-use, entry-surface, and rollback owner handoff artifact paths and produced a run-specific launch preflight artifact;
- privacy evidence names each forbidden data class and confirms it was absent from the telemetry sample;
- no artifact link exposes personal details.
