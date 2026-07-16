# Concierge Dry-Run Rehearsal

Date: 2026-07-16
Validated on: `main` at `3f151142`

Scope: all 10 Concierge flows were rehearsed with the shared dry-run fixtures. Test mode uses only reserved fake phone numbers, `example.test` URLs, and `example.test` inboxes. The safe completion path records a simulated outcome in completed history and does not call, email, message, upload, submit, purchase, book, or share data with a real provider.

| Flow | Result | Saved provider | Missing provider | No real contact | Completion history | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Book ride / transport | Pass | Pass | Pass | Pass | Pass | Uses VYVA Test Transport and `+12025550100`; missing transport provider stays gated until setup. |
| OTC pharmacy | Pass | Pass | Pass | Pass | Pass | Uses VYVA Test Pharmacy and `+12025550103`; non-prescription request only. |
| Medical appointment | Pass | Pass | Pass | Pass | Pass | Uses VYVA Test Clinic and `concierge-dry-run+clinic@example.test`; email draft stays disabled in test mode. |
| Home service | Pass | Pass | Pass | Pass | Pass | Uses VYVA Test Home Services and `https://example.test/vyva-dry-run/home-service/form`; form opening/submission stays disabled. |
| Shopping / groceries / meals | Pass | Pass | Pass | Pass | Pass | No provider required; simulated review desk prevents checkout, payment, or seller contact. |
| Find care / residence | Pass | Pass | Pass | Pass | Pass | Optional care-desk provider is fake; search/review does not contact residences or providers. |
| Scam or safety check | Pass | Pass | Pass | Pass | Pass | No provider required; fake suspicious link is under `example.test` and no details are forwarded or uploaded. |
| Safe home / safety support | Pass | Pass | Pass | Pass | Pass | No provider required before safety triage; simulated review prevents escalation or calls. |
| Insurance / admin help | Pass | Pass | Pass | Pass | Pass | Uses `concierge-dry-run+admin@example.test`; drafts stay test-only before simulated completion. |
| Call, email, form, or application | Pass | Pass | Pass | Pass | Pass | Uses `https://example.test/vyva-dry-run/application`; application/form submission stays disabled. |

Evidence checks:
- Dry-run fixtures exist for every Concierge registry flow.
- Every fixture has a saved-provider and missing-provider checklist path; provider-gated flows stay blocked until setup when the saved provider is missing.
- All external endpoints are reserved fake values.
- The active Concierge task shows "Test mode".
- Pending dry-run tasks keep simulated completion disabled until user confirmation/review has happened.
- Live-result links/buttons are disabled or hidden in test mode.
- Confirmed dry-run tasks for all 10 flows save through the completed-history endpoint with `dry_run`, `simulated_outcome`, and `no_real_provider_contact` markers.

Latest rehearsal command:

```powershell
npx vitest run src/conciergeDryRun.test.ts src/conciergeDryRunQaMatrix.test.ts src/pages/ConciergeScreen.test.tsx --reporter verbose
```

Result: pass, 3 files and 128 tests.

Blockers and follow-up issues:
- None found in the dry-run rehearsal.
