# Concierge Priority QA Dashboard Export

Exported at: 2026-07-16T00:00:00.000Z

This is the marked dashboard state for the first high-risk Concierge QA pass. Statuses use the same model as the Concierge readiness dashboard:

- `Pass`: covered by current automated, component, route, or smoke evidence.
- `Needs review`: requires a live/manual provider, contact, upload, search, or reply test before launch confidence.
- `Fail`: clear blocker found.
- `Not tested`: outside this priority pass.

## Summary

- Flows passed: 0/10
- Flows blocked: 0
- Needs-review flows: 6
- Failed checkpoints: 0
- Needs-review checkpoints: 16
- Not-tested checkpoints: 34

## Priority Pass

- Priority flows passed: 0/6
- Priority flows blocked: 0
- Priority needs-review flows: 6
- Priority failed checkpoints: 0
- Priority needs-review checkpoints: 16
- Priority not-tested checkpoints: 0

## Book Ride / Transport

| Checkpoint | Status |
| --- | --- |
| Start from Book Ride - Home fast help | Pass |
| Start from Book Ride - Concierge fast help | Pass |
| Start from Book ride - Concierge action | Pass |
| Missing provider path | Pass |
| Saved provider path | Needs review |
| Ask for needed details | Pass |
| Final user confirmation | Pass |
| Action handoff | Needs review |
| Outcome capture | Needs review |
| Completed history | Pass |

Needs review:

- Saved provider path: test with a real saved transport provider.
- Action handoff: test the real handoff to provider contact controls.
- Outcome capture: test recording a real provider reply or confirmed ride outcome.

## OTC Pharmacy Help

| Checkpoint | Status |
| --- | --- |
| Start from My Refills | Pass |
| Start from Refill Help | Pass |
| Start from OTC Pharmacy | Pass |
| Start from OTC pharmacy help | Pass |
| Missing provider path | Pass |
| Saved provider path | Needs review |
| Ask for needed details | Pass |
| Final user confirmation | Pass |
| Action handoff | Needs review |
| Outcome capture | Needs review |
| Completed history | Pass |

Needs review:

- Saved provider path: test with a real saved pharmacy.
- Action handoff: test the real WhatsApp, phone, or email draft handoff.
- Outcome capture: test recording a real pharmacy response.

## Medical Appointment

| Checkpoint | Status |
| --- | --- |
| Start from Book Medical - Health fast help | Pass |
| Start from Book Medical - Concierge fast help | Pass |
| Start from Medical appointment | Pass |
| Missing provider path | Pass |
| Saved provider path | Needs review |
| Ask for needed details | Pass |
| Final user confirmation | Pass |
| Action handoff | Needs review |
| Outcome capture | Needs review |
| Completed history | Pass |

Needs review:

- Saved provider path: test with a real saved clinic or doctor.
- Action handoff: test real appointment email, phone, or booking-link handoff.
- Outcome capture: test saving a confirmed appointment reply.

## Home Service

| Checkpoint | Status |
| --- | --- |
| Start from Find Plumber | Pass |
| Start from Home service | Pass |
| Missing provider path | Pass |
| Saved provider path | Needs review |
| Ask for needed details | Pass |
| Final user confirmation | Pass |
| Action handoff | Needs review |
| Outcome capture | Needs review |
| Completed history | Pass |

Needs review:

- Saved provider path: test with a real saved home-service provider.
- Action handoff: test the real follow-up provider action.
- Outcome capture: test saving a confirmed home-service visit or reply.

## Insurance / Admin Help

| Checkpoint | Status |
| --- | --- |
| Start from Paperwork Help - Home fast help | Pass |
| Start from Paperwork Help - Concierge fast help | Pass |
| Start from Government Help | Pass |
| Start from Insurance admin | Pass |
| Ask for needed details | Pass |
| Final user confirmation | Pass |
| Action handoff | Needs review |
| Outcome capture | Needs review |
| Completed history | Pass |

Needs review:

- Action handoff: test a real user-approved phone, email, form, or manual-review action.
- Outcome capture: test recording the real action outcome.

## Scam Or Safety Check

| Checkpoint | Status |
| --- | --- |
| Start from Check Scam | Pass |
| Start from Show VYVA | Pass |
| Start from Scam check | Pass |
| Ask for needed details | Pass |
| Final user confirmation | Pass |
| Action handoff | Needs review |
| Outcome capture | Needs review |
| Completed history | Pass |

Needs review:

- Action handoff: test a real user-approved safe search, upload, or forwarded-content path.
- Outcome capture: test recording the review result after the action.

## Remaining Flows

These were intentionally left `Not tested` in this priority pass:

- Shopping / groceries / meals
- Find care / residence
- Safe home / safety support
- Call, email, form, or application

## First Blocker Fixed

- Fail found: Concierge readiness admin page overflowed horizontally at 320px.
- Fix shipped in PR #769: bounded script-card grid columns and wrapped checkpoint text.
- Verification: `npx playwright test e2e/responsive-routes.spec.ts --project=chromium -g "admin workspace"` passed after the fix.
