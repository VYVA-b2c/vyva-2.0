# Preventive Outbound Call Agent Contract

Version: `1.0.0`

This document defines the dedicated ElevenLabs preventive outbound-call agent
contract used by Task 11. It is intentionally narrow and must not be reused by
callback onboarding, Concierge, browser voice, SMS, WhatsApp, email, or in-app
flows.

## Required agent configuration

- Agent ID comes only from
  `VYVA_PREVENTIVE_OUTBOUND_CALL_ELEVENLABS_AGENT_ID`.
- Phone-number ID comes only from
  `VYVA_PREVENTIVE_OUTBOUND_CALL_ELEVENLABS_PHONE_NUMBER_ID`.
- The outbound request must set `call_recording_enabled: false`.
- The dedicated provider-side agent configuration must also have recording
  disabled.
- The agent must not store or expose transcript, recording URL, raw audio, raw
  provider response body, raw health answers, symptoms, medications or
  diagnoses.

## Confirmation tool

Tool name:

- `vyva_preventive_outbound_call_confirm_identity`

Tool request body:

```json
{
  "providerConversationId": "<ElevenLabs conversation_id>",
  "twilioCallSid": "<Twilio CallSid>",
  "confirmed": true
}
```

Tool request headers:

```text
X-VYVA-Preventive-Call-Token: {{secret__preventive_call_confirmation_token}}
```

The confirmation callback requires the secret header plus all three body
fields. Token-only confirmation is invalid. Body-carried tokens are rejected.
Missing or mismatched `providerConversationId` or `twilioCallSid` fails closed.

## Secret variable transport

Approved secret variable:

- `secret__preventive_call_confirmation_token`

Approved ordinary dynamic variables:

- `preventive_call_attempt_id`
- `preventive_call_confirmation_url`

The raw confirmation token must appear only in the approved `secret__...`
variable and must be bound only to the confirmation tool header
`X-VYVA-Preventive-Call-Token`. It must not appear in ordinary dynamic
variables, tool request bodies, URLs, Twilio metadata, logs, telemetry, prompts,
initial messages, spoken output, transcript storage, or persisted database rows.
The database stores only the SHA-256 token digest.

## Stage 4 ownership

The agent confirmation tool does not start the Health Flow by itself. It calls
the Task 11 confirmation route, which creates an idempotent
`flow_entry_started` claim and then invokes the Stage 4 preventive Health Flow
entry seam. Task 11 may persist `flow_started` only after Stage 4 returns
authoritative started/restored evidence.
