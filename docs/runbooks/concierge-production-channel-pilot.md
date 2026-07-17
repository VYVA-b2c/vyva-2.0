# Concierge Production Channel Pilot Runbook

Date: 2026-07-17

Scope: enable one real Concierge provider-contact channel at a time. Start with email, then forms/applications. Phone, WhatsApp, and document upload use the same gate after their adapters and operational ownership are ready.

## Launch Rule

A Concierge flow may contact a real provider only when every item below is true:

1. The chosen production channel is configured.
2. The latest safe verification probe passed.
3. The admin Live-ready gate is enabled for that channel.
4. The Concierge task still has the same approved provider, contact, summary, and payload details.
5. The user gives final confirmation for the exact call, email, message, upload, booking, form, or application.

If any item fails, VYVA must keep the task in test mode, manual review, or blocked-channel review. It must not send, call, upload, submit, purchase, book, or share data with a provider.

## Admin Surfaces

| Surface | Use |
| --- | --- |
| `/admin/concierge-readiness` | Configure channel endpoints, save credential references, set reserved QA targets, run verification probes, and turn Live-ready on or off. |
| `/admin/concierge-queue` | Review confirmed tasks, adapter incidents, simulated/live status, retries, manual follow-up, and reconfirmation requests. |
| `/concierge` | Rehearse the user flow in test mode and run the controlled pilot task after final user confirmation. |

## Channel Order

| Order | Channel | Tool mapping | Pilot target |
| --- | --- | --- | --- |
| 1 | Email | `email` | A controlled pilot inbox owned by the team. |
| 2 | Forms / applications | `booking_link` | A controlled form with no payment, CAPTCHA, real submission side effects, or sensitive file upload. |
| 3 | WhatsApp | `whatsapp` | A controlled QA WhatsApp number. |
| 4 | Phone calls | `phone_call` | A controlled QA phone number answered by the team. |
| 5 | Document upload | `camera_or_upload` | A controlled upload endpoint with dummy documents only. |

Keep only one channel Live-ready during the first pilot for that channel. Turn it off again after evidence is captured.

## Setup Checklist

Before enabling a channel:

- Pick one channel and one owner for the pilot window.
- Confirm the latest migrations are applied, including `concierge_channel_readiness_settings`.
- Confirm the admin user can open `/admin/concierge-readiness` and `/admin/concierge-queue`.
- Confirm test mode still shows simulated outcomes for the 10 Concierge dry-run flows.
- Prepare a controlled pilot user and controlled pilot provider.
- Do not use production customer data, real payments, real prescriptions, real documents, or real service obligations.
- Store secrets in the deployment secret store only. In the admin console, save credential references such as `vault/vyva/email-adapter`, not secret values.

## Adapter Setup

Configure either environment variables or the admin console fields. The admin console can override the stored endpoint and QA target for the channel.

| Channel | Live endpoint env keys | QA target env keys |
| --- | --- | --- |
| Email | `CONCIERGE_EMAIL_LIVE_ENDPOINT`, `CONCIERGE_EMAIL_ADAPTER_ENDPOINT`, `CONCIERGE_CHANNEL_EMAIL_LIVE_ENDPOINT` | `CONCIERGE_EMAIL_QA_ENDPOINT`, `CONCIERGE_EMAIL_QA_RECIPIENT`, `CONCIERGE_CHANNEL_EMAIL_QA_ENDPOINT`, `CONCIERGE_CHANNEL_EMAIL_QA_RECIPIENT` |
| Forms / applications | `CONCIERGE_FORM_APPLICATION_LIVE_ENDPOINT`, `CONCIERGE_FORM_APPLICATION_ADAPTER_ENDPOINT`, `CONCIERGE_CHANNEL_FORM_APPLICATION_LIVE_ENDPOINT` | `CONCIERGE_FORM_APPLICATION_QA_ENDPOINT`, `CONCIERGE_FORM_APPLICATION_QA_URL`, `CONCIERGE_CHANNEL_FORM_APPLICATION_QA_ENDPOINT`, `CONCIERGE_CHANNEL_FORM_APPLICATION_QA_URL` |
| WhatsApp | `CONCIERGE_WHATSAPP_LIVE_ENDPOINT`, `CONCIERGE_WHATSAPP_ADAPTER_ENDPOINT`, `CONCIERGE_CHANNEL_WHATSAPP_LIVE_ENDPOINT` | `CONCIERGE_WHATSAPP_QA_ENDPOINT`, `CONCIERGE_WHATSAPP_QA_PHONE_NUMBER`, `CONCIERGE_CHANNEL_WHATSAPP_QA_ENDPOINT`, `CONCIERGE_CHANNEL_WHATSAPP_QA_PHONE_NUMBER` |
| Document upload | `CONCIERGE_DOCUMENT_UPLOAD_LIVE_ENDPOINT`, `CONCIERGE_DOCUMENT_UPLOAD_ADAPTER_ENDPOINT`, `CONCIERGE_CHANNEL_DOCUMENT_UPLOAD_LIVE_ENDPOINT` | `CONCIERGE_DOCUMENT_UPLOAD_QA_ENDPOINT`, `CONCIERGE_DOCUMENT_UPLOAD_QA_URL`, `CONCIERGE_CHANNEL_DOCUMENT_UPLOAD_QA_ENDPOINT`, `CONCIERGE_CHANNEL_DOCUMENT_UPLOAD_QA_URL` |

Phone calls do not use a live endpoint URL. They require `ELEVENLABS_API_KEY`, one of `ELEVENLABS_CONCIERGE_CALLER_AGENT_ID`, `ELEVENLABS_CONCIERGE_OUTBOUND_AGENT_ID`, or `ELEVENLABS_OUTBOUND_AGENT_ID`, and one of `ELEVENLABS_CONCIERGE_PHONE_NUMBER_ID` or `ELEVENLABS_AGENT_PHONE_NUMBER_ID`.

The live endpoint must be an `http` or `https` URL without embedded username, password, token, secret, password, api key, signature, auth, or credential query parameters.

## Reserved QA Target Rules

The readiness probe is synthetic. It proves the channel is configured and that the QA target is reserved; it must not contact a real provider.

| Channel | Allowed reserved QA target examples |
| --- | --- |
| Phone calls | `+12025550100` through `+12025550199`, or `+15550100` style reserved numbers. |
| WhatsApp | `+12025550100` through `+12025550199`, or `+15550100` style reserved numbers. |
| Email | Addresses under `.test`, `.invalid`, `.localhost`, `example.com`, `example.org`, or `example.net`. |
| Forms / applications | `qa:form-pilot`, `test:form-pilot`, `dry-run:form-pilot`, localhost URLs, `.test`, `.invalid`, `.localhost`, `example.com`, `example.org`, or `example.net` URLs. |
| Document upload | `qa:document-upload`, `test:document-upload`, `dry-run:document-upload`, localhost URLs, `.test`, `.invalid`, `.localhost`, `example.com`, `example.org`, or `example.net` URLs. |

The controlled live pilot target is different from the reserved QA probe target. For example, the email readiness probe can use `concierge-pilot@example.test`, while the one live pilot action uses a real team-owned pilot inbox saved on the test provider.

## Pilot Path: Email

1. In the secret store or admin console, configure the email adapter live endpoint.
2. Save a credential reference only, such as `vault/vyva/email-adapter`.
3. Save a reserved email QA target, such as `concierge-pilot@example.test`.
4. Click Run verification in `/admin/concierge-readiness`.
5. Confirm the email row shows Configured, Verified by probe, and no ready blocker.
6. Leave Live-ready off.
7. In `/concierge`, run the medical appointment or admin help dry-run path and confirm no real email opens or sends.
8. Confirm completed history shows `Test mode, no real contact`.
9. Turn Live-ready on for Email only.
10. Create one controlled pilot task with a test provider whose recipient email is owned by the team.
11. Ask the user for final confirmation for the exact provider, recipient, subject/summary, and details.
12. Confirm the task sends through the adapter and appears in the queue/history with live markers.
13. Turn Live-ready off for Email.

Pass evidence:

- Readiness row: Email is Configured, Verified by probe, and Live-ready only during the pilot window.
- Dry-run history: Mode is `Test mode, no real contact`.
- Pilot history: Mode is `Live action`.
- Queue or adapter record: adapter is `concierge_email_adapter`, status is `sent`, and provider/contact match the approved pilot task.
- Command-line email self-check evidence is standalone-script-only. It does not create a completed-history row; use an app-triggered task for the `Live action` history check.

## Pilot Path: Forms / Applications

1. In the secret store or admin console, configure the form/application adapter live endpoint.
2. Save a credential reference only, such as `vault/vyva/form-application-adapter`.
3. Save a reserved form QA target, such as `https://example.test/vyva-pilot/form`.
4. Click Run verification in `/admin/concierge-readiness`.
5. Confirm the form/application row shows Configured, Verified by probe, and no ready blocker.
6. Leave Live-ready off.
7. In `/concierge`, run the home-service or tool-gated form dry-run path and confirm no real form opens or submits.
8. Confirm completed history shows `Test mode, no real contact`.
9. Turn Live-ready on for Forms / applications only.
10. Create one controlled pilot task with a test provider whose booking or form URL is owned by the team.
11. Ask the user for final confirmation for the exact provider, URL, service details, and data to submit.
12. Confirm the task submits through the adapter and appears in the queue/history with live markers.
13. Turn Live-ready off for Forms / applications.

Pass evidence:

- Readiness row: Forms / applications is Configured, Verified by probe, and Live-ready only during the pilot window.
- Dry-run history: Mode is `Test mode, no real contact`.
- Pilot history: Mode is `Live action`.
- Queue or adapter record: adapter is `concierge_form_application_adapter`, status is `sent`, and provider/contact match the approved pilot task.

## Final Confirmation Standard

The final confirmation must be specific enough that an operator can compare it with the adapter payload before live contact. The confirmation must include:

- Provider name.
- Provider contact or URL.
- User-approved summary.
- The channel and action, such as send email or submit form.
- Any details that would be shared externally.

If the provider, contact, URL, summary, or payload changes after confirmation, request reconfirmation before retrying or sending.

## Payload Checklist

Before live pilot send, verify the adapter payload has:

- `pending_id`
- `user_id`
- `channel`
- `tool`
- `provider_name`
- `provider_contact`
- `summary`
- `action_payload`

If any field is missing, the adapter must block the live action and the task must stay in safe review.

## Completion History Check

After dry-run rehearsal:

- The completed receipt shows Mode: `Test mode, no real contact`.
- The outcome payload includes `dry_run`, `simulated_outcome`, and `no_real_provider_contact`.
- No contact link opens to a real provider.

After the controlled live pilot:

- The completed receipt shows Mode: `Live action`.
- The outcome payload has `execution_mode: live` and `live_action: true`.
- The adapter result is attached with the expected adapter, channel, provider, contact, and `sent` status.

## Rollback

Rollback is a no-code admin action:

1. Open `/admin/concierge-readiness`.
2. Turn Live-ready off for the channel.
3. Refresh and confirm the row shows Blocked or Cannot contact providers.
4. Run one blocked-channel user flow and confirm it routes to safe VYVA review.
5. Leave an admin note with the reason, owner, and time.

If a live adapter attempt fails after contact was allowed, use `/admin/concierge-queue` to mark manual follow-up, request reconfirmation, or retry only after the user confirms again.

## Pilot Evidence Log

Use this table for the first pilot of each channel.

| Field | Value |
| --- | --- |
| Channel |  |
| Pilot owner |  |
| Date/time window |  |
| Live endpoint reference |  |
| Credential reference |  |
| Reserved QA target |  |
| Probe result and time |  |
| Dry-run flow used |  |
| Dry-run history mode |  |
| Pilot provider |  |
| Pilot contact or URL |  |
| User confirmation captured |  |
| Adapter result ID |  |
| Pilot history mode |  |
| Rollback time |  |
| Follow-up needed |  |

## Done Criteria

The channel pilot is complete when:

- Only one channel was Live-ready during the pilot.
- A reserved QA probe passed before live enablement.
- Dry-run behavior remained simulated.
- The controlled live pilot required final user confirmation.
- Completion history clearly distinguishes simulated and live outcomes.
- The channel was disabled again without a code change.
