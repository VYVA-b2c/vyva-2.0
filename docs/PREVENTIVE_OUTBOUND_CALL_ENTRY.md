# Preventive Outbound Call Entry

Task 11 implements Stage 6 as a default-disabled outbound voice-call entry
adapter for `health.preventive_check@1.0.0`.

It does not make Task 8 executable, does not change callback onboarding, does
not change Concierge calls, and does not create a second Health Flow authority.

## Runtime authority

The Stage 6 adapter may request one preventive outbound call only after:

1. Task 8 policy is evaluated and written as a durable audit;
2. the Stage 6 flag resolves to `pilot` for the exact profile allowlist;
3. current preventive outbound-call consent is enabled;
4. a verified E.164 phone and phone verification provenance exist;
5. the schedule occurrence has not already produced a call attempt;
6. provider-attempt state is durably recorded.

Task 8 remains shadow-only and non-executable. Stage 4 remains authoritative for
the preventive Health Flow. The confirmation callback only marks entry into the
existing Flow; it does not submit answers or complete the Flow.

## Provider responsibilities

- ElevenLabs ConvAI starts the outbound call through its Twilio outbound-call
  endpoint.
- Twilio is the telephone transport status source.
- A signed Twilio `CallStatus=in-progress` callback proves only transport-level
  answer.
- `completed` alone is never answer evidence.
- Flow entry requires a separate ElevenLabs confirmation-tool callback with the
  one-time opaque confirmation token in the approved secret header plus both
  mandatory provider identifiers in the body: the ElevenLabs conversation ID and
  the Twilio CallSid.

Dedicated provider environment variables are required:

- `ELEVENLABS_API_KEY`
- `VYVA_PREVENTIVE_OUTBOUND_CALL_ELEVENLABS_AGENT_ID`
- `VYVA_PREVENTIVE_OUTBOUND_CALL_ELEVENLABS_PHONE_NUMBER_ID`
- `VYVA_PREVENTIVE_OUTBOUND_CALL_PUBLIC_WEBHOOK_BASE_URL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

Callback-onboarding and Concierge agent IDs are not used as fallbacks.

## Feature flag

Canonical flag ID:

- `flag.engagement.preventive_outbound_call`

Environment contract:

- `VYVA_PREVENTIVE_OUTBOUND_CALL_MODE=disabled|pilot`
- `VYVA_PREVENTIVE_OUTBOUND_CALL_ALLOW_USERS`
- `VYVA_PREVENTIVE_OUTBOUND_CALL_DENY_USERS`
- `VYVA_PREVENTIVE_OUTBOUND_CALL_ALLOW_PRODUCTION`
- `VYVA_PREVENTIVE_OUTBOUND_CALL_EXPIRES_AT`
- `VYVA_PREVENTIVE_OUTBOUND_CALL_OWNER`
- `VYVA_PREVENTIVE_OUTBOUND_CALL_AUDIT_REF`

The flag is default-disabled. The first slice supports explicit allowlist only:
deny wins, malformed CSV fails closed, production requires explicit
authorization, and provider configuration must be valid. The flag never grants
consent or phone verification.

## Consent and phone verification

Task 11 uses the dedicated `preventive_outbound_call_consents` table.

Consent is:

- disabled by default;
- purpose-specific;
- channel-specific;
- separate from push consent and general voice preferences;
- bound to a verified E.164 phone, phone digest, verification timestamp,
  source, and reference.

No public self-assertion endpoint is added. A controlled provisioning path must
record verified phone evidence before a user becomes eligible. Revocation is
idempotent, revokes unconsumed confirmation tokens, claims active correlated
attempts for cancellation, and then performs best-effort provider cancellation
outside the database transaction. Cancellation failure never restores consent.

## Durable state machine

The dedicated call-attempt table supports:

- `requested`
- `claimed`
- `provider_attempt_started`
- `provider_started`
- `ringing`
- `answered`
- `identity_confirmed`
- `flow_entry_started`
- `flow_started`
- `no_answer`
- `busy`
- `declined`
- `cancelled`
- `failed_retryable`
- `failed_permanent`
- `delivery_uncertain`

The state machine prevents duplicate calls for the same
schedule-occurrence/purpose identity. Provider conversation IDs, Twilio call
SIDs, confirmation-token digests, and webhook-event keys are unique where
present. States at or after `provider_started` require both provider
conversation ID and Twilio CallSid. `flow_started` requires Stage 4 evidence and
a consumed confirmation token. Terminal states are monotonic; late callbacks
cannot reopen them.

## Webhook security

Task 11 uses a dedicated route:

- `POST /api/preventive-outbound-call/twilio/status`
- `POST /api/preventive-outbound-call/elevenlabs/confirm`

The Twilio status route fails closed when `TWILIO_AUTH_TOKEN` or the canonical
public webhook base URL is missing. It verifies `X-Twilio-Signature` against the
externally visible URL and form parameters, rejects unknown call SIDs, and
persists webhook-event idempotency.

Status mapping:

| Twilio status | State |
| --- | --- |
| `queued`, `initiated` | `provider_started` |
| `ringing` | `ringing` |
| `in-progress` | `answered` |
| `no-answer` | `no_answer` |
| `busy` | `busy` |
| `failed` | `failed_permanent` |
| `canceled` | `cancelled` |
| `completed` | observed only; does not start Flow |

## Confirmation callback

The ElevenLabs confirmation route requires:

- one-time opaque token;
- token transport through the dedicated secret header, not the JSON body;
- provider conversation ID;
- Twilio CallSid;
- current consent;
- answered transport state;
- unused and unrevoked token.

It returns only minimized Flow entry metadata:

- Flow ID;
- Flow version;
- call-attempt ID;
- next-step hint for the dedicated agent.

The confirmation callback first creates an idempotent `flow_entry_started`
claim, then calls the Stage 4 preventive Health Flow entry seam. Task 11 marks
`flow_started` only after Stage 4 returns authoritative started/restored
evidence. If Stage 4 rejects or fails, the claim is released back to a
recoverable `identity_confirmed` state and no success is reported.

It never returns health history, symptoms, medications, diagnoses, transcript,
recording, raw token, raw phone number, or secrets.

## Privacy and voicemail

The provider request explicitly sets `call_recording_enabled: false`. The
dedicated preventive ElevenLabs agent must also have recording disabled at the
agent/provider configuration level. Task 11 ignores/redacts any recording or
transcript fields returned by a provider and does not persist recordings,
recording URLs, transcripts, or raw provider response bodies.

The provider payload contains only the call-attempt ID, confirmation URL, and
the raw confirmation token in the approved secret variable
`secret__preventive_call_confirmation_token`. The dedicated ElevenLabs tool must
bind that secret variable only to the `X-VYVA-Preventive-Call-Token` request
header. The raw token is not placed in ordinary dynamic variables, tool request
bodies, URLs, Twilio metadata, logs, telemetry, prompts, initial messages,
spoken output, or transcript storage. See
`docs/PREVENTIVE_OUTBOUND_CALL_AGENT_CONTRACT.md` for the versioned dedicated
agent/tool contract. It does not include PHI, health answers, symptoms,
medications, diagnoses, recordings, transcripts, or raw provider response
bodies.

The dedicated agent must use generic privacy-safe speech before identity and
continuation confirmation. Stage 6 does not hand-roll answering-machine
detection and does not persist recordings or transcripts.

## Retry and rollback

The first slice performs no automatic retry. No-answer, busy, cancelled,
failed-retryable, failed-permanent, and delivery-uncertain outcomes remain
distinct terminal outcomes for the current schedule occurrence. A future
occurrence may call again only after a new policy evaluation.

Rollback is disabling `flag.engagement.preventive_outbound_call`. That blocks
new calls. Existing correlated live calls are bounded by the consent-revocation
cancellation path. Rollback does not affect callback onboarding, Concierge
calls, browser voice, Task 8 audit policy, or Task 10 push.

## Current limitations

- No broad runtime rollout is enabled by default.
- The confirmation callback starts/restores entry state only; actual Health Flow
  question answering remains under the existing Stage 4 authority.
- Browser/provider delivery behavior remains mocked in unit tests; the freeze
  proof adds a GitHub Actions PostgreSQL 16 service job for migration, store and
  real-route persistence but does not place live external calls.
