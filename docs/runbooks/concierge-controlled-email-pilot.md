# Concierge Controlled Email Pilot

Date: 2026-07-17

Purpose: make Email the first live Concierge channel while keeping the pilot restricted to a team-owned inbox.

## Required Configuration

Set these in the deployment secret store:

- `CONCIERGE_EMAIL_OWNED_ADAPTER_ENABLED=true`
- `RESEND_API_KEY=<secret>`
- `RESEND_FROM_EMAIL=<verified VYVA sender>`
- `CONCIERGE_EMAIL_PILOT_RECIPIENTS=<team-owned pilot inbox>`
- `CONCIERGE_EMAIL_QA_RECIPIENT=concierge@example.test`

Optional aliases:

- `CONCIERGE_EMAIL_INTERNAL_ADAPTER_ENABLED=true`
- `CONCIERGE_EMAIL_PILOT_RECIPIENT=<single team-owned pilot inbox>`
- `CONCIERGE_EMAIL_PILOT_ALLOWLIST=<comma-separated team inboxes>`
- `CONCIERGE_EMAIL_LIVE_ALLOWLIST=<comma-separated team inboxes>`

Do not put real provider inboxes in the pilot allowlist. The pilot adapter blocks every non-allowlisted recipient before contacting Resend.

## Pilot Steps

1. Open `/admin/concierge-readiness`.
2. Confirm Email shows configured by environment and does not expose the Resend key or pilot inbox.
3. Run Email verification with the reserved QA target.
4. Confirm the probe passes and Email can be marked Live-ready.
5. Leave Live-ready off.
6. Run an Email dry-run flow in `/concierge`.
7. Confirm the completed receipt says `Test mode, no real contact`.
8. Turn Email Live-ready on.
9. Create one controlled pilot Concierge task with the provider email set to the team-owned pilot inbox.
10. Confirm the exact provider, inbox, subject, body, and shared details with the user.
11. Send the pilot task.
12. Confirm the team inbox receives the email.
13. Confirm completed history says `Live action`.
14. Turn Email Live-ready off.

## Deployment Self-Check

Before turning Live-ready on, run the safe check in the deployed environment:

```sh
npm run concierge:email-pilot:check
```

This validates adapter setup, the reserved QA probe, payload readiness, dry-run simulation, and the confirmation gate. It does not send email.

To send the one controlled pilot email from the command line, set the confirmation phrase and pass `--send`:

```sh
CONCIERGE_EMAIL_PILOT_SEND_CONFIRMATION=SEND_CONTROLLED_EMAIL_PILOT npm run concierge:email-pilot:check -- --send
```

Only use `--send` after the selected recipient is the team-owned pilot inbox and the user has confirmed the exact provider, inbox, subject, body, and shared details.

## Pass Evidence

- Email readiness is configured, verified by probe, and Live-ready only during the pilot window.
- Dry-run still records simulated/no-contact history.
- The live send uses `concierge_email_adapter` and a Resend message ID.
- The recipient matches the team-owned pilot inbox.
- Non-allowlisted recipients are blocked before provider contact.
- Rollback is done by turning Email Live-ready off in the admin console.
