# Voice Canvas real-device QA handoff

Use this as the “start here” sheet for the launch evidence run. The detailed execution tables remain in `docs/audits/voice-canvas-real-device-run-sheet.md`, the artifact inventory lives in `docs/audits/voice-canvas-real-device-evidence-packet.md`, and the launch approval gate remains `docs/audits/voice-canvas-real-device-qa-matrix.md`.

This handoff is not launch approval. It exists to make the remaining human QA work explicit and finishable.

## What still blocks launch

- Real-device QA has not been executed for every launch flow.
- The evidence packet and QA matrix still contain pending cells.
- Final preflight must fail until fresh same-date deployed evidence is attached.
- Canvas must not be enabled for real users until final preflight passes without `--allow-pending`.

## Run owner setup

Before testing, choose:

- QA run date: `YYYY-MM-DD`
- Deployed QA origin: `https://staging.vyva.app` or the production-like test origin
- Build or commit SHA under test
- QA reviewer
- Operations rollback owner
- Distinct backup rollback owner
- Launch monitoring or rollback decision window

Use only synthetic QA accounts and synthetic task details.

## Hard stop rules

Stop the run and record a launch blocker if any of these occur:

- A booking, call, message, navigation, order, refill request, provider reply, task completion, data write, or external action happens before explicit confirmation.
- Duplicate confirmation submits twice or resubmits an action.
- A stale voice, network, or action response changes the current scene.
- Refresh, reconnect, app exit/reopen, browser back, or voice interruption loses entered work.
- Cancel or exit leaves the user unsure what happened or performs a write.
- Feature-flag rollback does not close or hide Canvas in an open session.
- Rollback does not restore the named existing Concierge fallback path.
- Analytics, screenshots, logs, or notes include addresses, saved-place labels, transcripts, typed free text, medication details, provider details, shopping details, account identifiers, contact details, credential names, credential values, tokens, cookies, passwords, API keys, or other personal data.

## Required flows

Test each flow on a real phone, real tablet, and real desktop or laptop. Exercise voice, touch, and keyboard where supported.

| Flow | Entry surfaces to prove | Existing fallback to prove |
| --- | --- | --- |
| Ride Voice Canvas | voice handoff; `/concierge`; task hub pending resume | Existing Concierge transport panel |
| Appointment Voice Canvas | voice handoff; `/concierge`; task hub provider setup resume | Existing appointment panel |
| Medication Refill Voice Canvas | `/meds/adherence-report`; voice refill action; task hub local resume | Existing medication refill shopping/support path |
| Shopping Delivery Voice Canvas | `/concierge/shopping`; shopping voice capture; task hub local resume | Existing shopping guide and recommendations |
| Provider Reply Voice Canvas | `/concierge` task detail; provider reply panel; task hub pending resume | Existing provider reply panel |
| Concierge Task Hub Resume | `/concierge/tasks`; `/concierge/tasks/:taskKey`; home resume card | Safe existing destination path for the underlying task |

## Evidence run order

Replace `YYYY-MM-DD` and the base URL before running commands. Use the same QA run date and deployed origin across every artifact.

1. Capture the launch run plan.

   ```bash
   npm run --silent canvas:qa:run -- --date=YYYY-MM-DD --base-url=https://staging.vyva.app --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-evidence-run.json
   ```

2. Capture enabled feature endpoint evidence.

   ```bash
   npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=enabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-enabled.json
   ```

3. Create and fill copy-safe evidence templates during the real-device pass.

   ```bash
   npm run --silent canvas:qa:copy -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-copy-clarity.md
   npm run --silent canvas:qa:recovery -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-recovery-behavior.md
   npm run --silent canvas:qa:real-use -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-real-use-coverage.md
   npm run --silent canvas:qa:entry-surfaces -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces.md
   npm run --silent canvas:qa:rollback-owner -- --template --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md
   ```

4. Fill `docs/audits/voice-canvas-real-device-run-sheet.md` while testing.

5. Fill `docs/audits/voice-canvas-real-device-evidence-packet.md` with sanitized artifact references.

6. Copy final passing evidence into `docs/audits/voice-canvas-real-device-qa-matrix.md`.

7. Validate each filled supporting artifact.

   ```bash
   npm run --silent canvas:qa:copy -- --input=artifacts/voice-canvas/YYYY-MM-DD-copy-clarity.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-copy-clarity-validation.json
   npm run --silent canvas:qa:recovery -- --input=artifacts/voice-canvas/YYYY-MM-DD-recovery-behavior.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-recovery-behavior-validation.json
   npm run --silent canvas:qa:real-use -- --input=artifacts/voice-canvas/YYYY-MM-DD-real-use-coverage.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-real-use-validation.json
   npm run --silent canvas:qa:entry-surfaces -- --input=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-entry-surfaces-validation.json
   npm run --silent canvas:qa:rollback-owner -- --input=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-handoff.md --json --output=artifacts/voice-canvas/YYYY-MM-DD-rollback-owner-validation.json
   npm run --silent canvas:qa:analytics -- --input=artifacts/voice-canvas/YYYY-MM-DD-analytics-evidence.json --json --output=artifacts/voice-canvas/YYYY-MM-DD-analytics-validation.json
   ```

8. Apply rollback flags and capture rollback-disabled endpoint evidence.

   ```bash
   npm run --silent canvas:qa:features -- --base-url=https://staging.vyva.app --expected-state=rollback-disabled --json --output=artifacts/voice-canvas/YYYY-MM-DD-feature-endpoints-rollback-disabled.json
   ```

9. Validate the filled run sheet, matrix, and packet.

   ```bash
   npm run --silent canvas:qa:runsheet -- --json --output=artifacts/voice-canvas/YYYY-MM-DD-run-sheet-summary.json
   npm run --silent canvas:qa:validate -- --json --output=artifacts/voice-canvas/YYYY-MM-DD-qa-summary.json
   npm run --silent canvas:qa:packet -- --json --output=artifacts/voice-canvas/YYYY-MM-DD-evidence-packet-summary.json
   ```

10. Run the final launch preflight.

    ```bash
    npm run --silent canvas:qa:preflight -- --final --date=YYYY-MM-DD --json --output=artifacts/voice-canvas/YYYY-MM-DD-launch-preflight.json
    ```

## Acceptance bar

The run is launch-ready only when:

- Every required flow completes or safely exits on real phone, tablet, and desktop.
- Voice, touch, and keyboard paths work where supported.
- Leave, resume, refresh, reconnect, interruption, browser back, cancel, retry, duplicate confirmation, and stale response behavior are proven with no write, no resubmission, and no external action before explicit confirmation.
- Waiting, blocked, and completed states explain what is pending, what happened, and what happens next.
- Senior-friendly copy remains readable, including Spanish and long-label checks.
- Analytics evidence shows started, resumed, abandoned, blocked, confirmed, and completed aggregate signals without personal data.
- Enabled and rollback-disabled feature endpoint artifacts are captured from the same deployed origin.
- Rollback owner handoff names an owner, distinct backup, rollback trigger, decision window, rollback action, fallback proof, open-session Canvas closed or hidden proof, and privacy boundary.
- Final preflight passes without `--allow-pending`.

## If the run fails

Leave the feature disabled or roll it back to disabled rollout 0. Keep Canvas off for real users, attach the sanitized blocker evidence, patch the issue, and rerun the affected flow plus final preflight before sign-off.
