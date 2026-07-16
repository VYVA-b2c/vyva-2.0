# Concierge Manual QA Execution Pass v1

Date: 2026-07-16

## Scope

This pass focuses the manual QA runner on the highest-risk Concierge flows:

- Book ride / transport
- OTC pharmacy help
- Medical appointment
- Home service
- Insurance / admin help
- Scam or safety check

## Result

The automated readiness checks and generated manual QA scripts are passing for the priority flows. The first runtime blocker found in this pass was fixed: the Concierge readiness admin page overflowed horizontally on a 320px viewport.

The marked dashboard export for this pass is saved in `docs/audits/concierge-priority-qa-dashboard-export.md`. The follow-up live-handoff hardening evidence is recorded in `docs/audits/concierge-live-handoff-qa-v1.md`.

## Priority Flow Status

| Flow | Automated readiness | Manual live action status | Notes |
| --- | --- | --- | --- |
| Book ride / transport | Pass | Needs review | Local checks confirm entry points, provider gate, confirmation, handoff, outcome capture, and history coverage. Live transport contact remains manual QA. |
| OTC pharmacy help | Pass | Needs review | Local checks confirm OTC-only guardrails, saved pharmacy gate, confirmation, handoff, outcome capture, and history coverage. Live pharmacy contact remains manual QA. |
| Medical appointment | Pass | Needs review | Local checks confirm provider, coverage, confirmation, handoff, outcome capture, and history coverage. Live clinic/provider contact remains manual QA. |
| Home service | Pass | Needs review | Local checks confirm provider/search path, intake details, confirmation, handoff, outcome capture, and history coverage. Live provider reply remains manual QA. |
| Insurance / admin help | Pass | Needs review | Local checks confirm document/task details, confirmation, handoff, outcome capture, and history coverage. Live send/call/upload remains manual QA. |
| Scam or safety check | Pass | Needs review | Local checks confirm upload/search/operator-review guardrails and confirmation coverage. Real document/email/phone reputation checks remain manual QA. |

## Fixed Blocker

- `Fail`: Concierge readiness admin page caused horizontal overflow at 320px.
- `Fix`: Manual QA script cards now use bounded grid columns and wrapped instruction text so long checkpoints do not widen the page.
- `Evidence`: `npx playwright test e2e/responsive-routes.spec.ts --project=chromium -g "admin workspace"` now passes.

## Evidence Commands

- `npm test -- src/conciergeManualQaRunner.test.ts src/pages/admin/ConciergeReadinessAdminPage.test.tsx src/conciergeManualQaScripts.test.ts src/conciergeReadinessDashboard.test.ts src/conciergeLaunchSmokeAudit.test.ts`
- `npm run typecheck`
- `npx playwright test e2e/responsive-routes.spec.ts --project=chromium -g "admin workspace"`

## Remaining Manual QA

The readiness dashboard now generates channel-specific live checks for ride phone calls, pharmacy WhatsApp, appointment email, and home-service booking forms. Each includes reload persistence, no-answer retry confirmation, reply capture, and completed-history checks.

Use only QA-controlled destinations. Mark each checkpoint as `Pass`, `Fail`, `Needs review`, or `Not tested` after live/manual testing, then export Markdown or JSON from the dashboard when sharing results across testers.
