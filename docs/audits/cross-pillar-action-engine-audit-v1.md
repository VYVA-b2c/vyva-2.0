# Cross-Pillar VYVA Action Engine Audit v1

Date: 2026-07-20

This audit explains how the work built for Concierge should be reused across all VYVA pillars without turning every screen into Concierge.

The core idea: Concierge gave us a reliable action pattern. We should reuse the right parts of that pattern wherever VYVA helps a user do something with steps, risk, setup, or follow-up.

## Source Evidence

Current source-of-truth files inspected:

- `shared/workflowRegistry.ts`
- `shared/crossAppWorkflowCompletionAudit.ts`
- `shared/conciergeFlowRegistry.ts`
- `shared/conciergeFlowRequirements.ts`
- `shared/conciergeFlowCoverage.ts`
- `shared/conciergeActionExecution.ts`
- `shared/conciergeToolReadiness.ts`
- `shared/conciergeSavedProviders.ts`
- `shared/conciergeConfirmationReceipt.ts`
- `src/pages/ConciergeScreen.test.tsx`
- `src/pages/HomeScreen.actions.test.tsx`

## The Reusable Pattern

Concierge already implements these reusable building blocks:

1. Intent: what the user wants to do.
2. Missing details: ask only what is missing.
3. Readiness: check profile, provider, document, address, channel, or tool.
4. Prepared action: show what VYVA will do.
5. Confirmation: nothing external happens until the user confirms.
6. Execution or handoff: call, email, WhatsApp, upload, booking link, web search, operator review, or internal save.
7. Outcome: provider reply, no answer, unavailable, changed details, needs more info, failed, or completed.
8. Receipt: what VYVA did, who/what it involved, current status, and what happens next.
9. Resume: unfinished or recent tasks can return from Home or the original surface.

## Action Levels

Not every workflow needs the full pattern.

| Level | Meaning | Must Reuse | Should Not Add |
| --- | --- | --- | --- |
| Light | User saves, completes, opens, resumes, or records something inside VYVA. | completion state, resume where useful, light receipt or progress note | provider setup, external action tools |
| Guided | VYVA helps structure an idea, report, plan, review, recommendation, or decision. | missing-detail prompts, prepared summary, confirmation before sensitive sharing, resume | live calls, sends, bookings unless it escalates |
| External Action | VYVA may contact, book, send, upload, search externally, or share details. | full readiness, provider/tool checks, final confirmation, outcome capture, receipt, resume | any unconfirmed external action |

## Cross-Pillar Classification

| Pillar / Flow Group | Level | What To Reuse From Concierge | Current State | Gap / Next Step |
| --- | --- | --- | --- | --- |
| Home main cards | Light | section navigation, contextual nudges, resume priority | Strong | Keep main cards simple; use action nudges rather than adding more primary cards. |
| Home Fast help | Guided / External Action depending on item | deduplication, action routing, resume cards | Strong | Continue tuning ranking, but use the action level to decide whether a shortcut opens a screen or starts a confirmed task. |
| Health symptom check | Guided | missing-detail intake, report completion, escalation confirmation, possible Concierge handoff | Strong | Add a clearer receipt/progress pattern after symptom report sharing or doctor handoff. |
| Health vitals and reports | Light / Guided | save state, share confirmation, receipt after sharing | Good | Reuse receipts when a report is shared or prepared for doctor/Concierge. |
| Medication plan and adherence | Light / Guided | save state, safe blockers, confirmation before sharing | Good | Add consistent next-step receipts when adherence or medication summaries are shared. |
| Medication safety / side effects / research | Guided / External Action when escalating | source evidence, prepared clinician questions, final confirmation before appointment/pharmacy handoff | Strong | Keep dose-change blockers. Use appointment/OTC flows only after explicit confirmation. |
| Doctor next step | External Action | provider readiness, appointment intake, confirmation, receipt, resume | Strong through Concierge | Keep this as the model for Health-to-Concierge escalation. |
| Mind & Memory games | Light | progress, results, recommendation, resume | Good | Do not add Concierge-style confirmation. Add better post-session recommendations and consistent "continue next" state. |
| Cognitive assessment | Guided | guided steps, completion result, recommendations, sharing confirmation | Good | Add receipt-like summary after recommendations are accepted or shared. |
| Learning plan | Light / Guided | progress, save for later, read-aloud readiness, resume | Good | Use light receipts for saved lesson, completed lesson, and read-aloud unavailable states. |
| Community room list and entry | Light | navigation, simple participation state | Good | Do not over-apply Concierge. Keep entry simple. |
| Together Room plans | Guided | missing-detail prompts, sensitive-category review, confirmation before sharing, status/resume | Strong | Reuse receipt/next-step language after a plan is shared or confirmed. |
| Community curated activities | Light / Guided | activity discovery, save/join intent, proximity where useful | Good | If activity booking/contact is added later, escalate to External Action pattern. |
| Share Stories / Music Room | Guided | simple composer, safe posting, reply loop | Good | Use light receipt after post/reply, not full action engine. |
| Scam Guard | Guided / External Action | input router, upload/search readiness, confirmation before forwarding/searching/sharing, receipt | Strong | Expand verified reputation sources. Keep all external checks behind confirmation. |
| Safe Home | Guided / External Action | urgency intake, photo/upload readiness, provider/home-service handoff, receipt | Strong | Keep urgent safety separate from ordinary service booking. |
| Concierge booking flows | External Action | full pattern | Strong | Shopping seller follow-through remains the weakest parity point. |
| Trusted Providers | Setup | focused setup, category readiness, return-to-task | Strong | Reuse as a cross-pillar setup screen, not just Concierge. |
| Admin content tools | Setup / Admin | readiness labels, route coverage, source editor links | Good | Keep separate from user action engine. Admin is operations, not user confirmation flow. |

## Where Concierge Should Be Reused Directly

These flows should call or route into Concierge because they can involve external action:

| Origin Pillar | User Intent | Reuse |
| --- | --- | --- |
| Health | book doctor / clinic | medical appointment flow |
| Health | share report with provider | tool-gated email or medical appointment flow |
| Medication | ask pharmacy about OTC item | OTC pharmacy flow |
| Medication | discuss medicine safety with clinician | medical appointment flow |
| Safe Home | ask for quote or service visit | home service flow, preserving safety context |
| Scam Guard | search company reputation or forward suspicious item | scam check flow with readiness/confirmation |
| Community | arrange paid/shared service or venue booking | appropriate booking/tool-gated flow |
| Learning | no direct Concierge reuse by default | only escalate if user asks to contact someone or schedule support |
| Mind & Memory | no direct Concierge reuse by default | only escalate if user wants to share results or book a professional next step |

## Where Only The Pattern Should Be Reused

These should not become Concierge tasks, but should borrow small pieces:

| Flow | Borrowed Pattern | Why |
| --- | --- | --- |
| Brain games | result, next recommendation, resume | Keeps games light and rewarding. |
| Learning lessons | save, complete, resume, read aloud readiness | Makes learning sticky without feeling bureaucratic. |
| Together Room posts | guided composer, sensitive review, next step | Keeps social posting safe and low-friction. |
| Health check-in | completion, trend/recommendation, share confirmation | Useful without needing providers every time. |
| Community activities | join/save state, proximity, light confirmation | Avoids turning discovery into a booking form. |

## What This Means For Product Design

The user should feel one consistent VYVA behavior:

- VYVA asks fewer questions when profile data already exists.
- VYVA says what it is about to do before it does anything.
- VYVA never calls, books, sends, uploads, searches sensitive content, or shares details without confirmation.
- VYVA shows a clear outcome afterward.
- VYVA can resume the task from Home or the original module.

But the UI should stay proportional:

- Light flows get compact progress and next-step cards.
- Guided flows get a short guided composer or checklist.
- External Action flows get the full confirmation and receipt pattern.

## Current Biggest Cross-Pillar Gap

The strongest reusable pieces exist inside Concierge, but they are not yet named as a VYVA-wide action model in source or docs. As a result, future Health, Learning, Community, or Mind work could accidentally rebuild similar logic in slightly different ways.

## Recommended Next Slices

1. **VYVA Action Level Registry v1**
   - Add a small shared classification for workflows: `light`, `guided`, `external_action`, `setup`, `admin`.
   - Map existing `WORKFLOW_DEFINITIONS` and `CROSS_APP_WORKFLOW_COMPLETION_AUDIT` entries to those levels.
   - This gives every future feature a clear implementation lane.

2. **Cross-Pillar Receipt Moments v1**
   - Reuse receipt-style closure outside Concierge where it fits:
     - Health report shared.
     - Medication questions prepared.
     - Learning lesson saved/completed.
     - Together Room plan shared.
     - Scam/Safe Home review completed.
   - Keep wording compact and avoid "receipt" language where it feels too operational.

3. **Action Resume Unification v1**
   - Standardize which actions can reappear on Home:
     - unfinished external action
     - recently completed external action
     - unfinished guided flow
     - next recommended learning/game/community step
   - Prevent duplicate nudges.

4. **Shopping Seller Follow-Through Parity v1**
   - Complete the one Concierge flow that is still less mature than the others.
   - This remains the next Concierge-specific parity slice.

## Decision

To progress all pillars equally, do **VYVA Action Level Registry v1** before adding more individual flow features. It creates the shared language that tells us which Concierge pieces belong in each workflow and which would be overkill.
