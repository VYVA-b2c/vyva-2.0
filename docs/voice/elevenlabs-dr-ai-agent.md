# ElevenLabs VYVA Dr. AI Agent

Dr. AI is the voice layer for the canonical Ask Dr. AI flow. The existing VYVA triage backend remains the sole medical and safety decision-maker.

## Architecture

1. The app starts the dedicated `dr-ai` agent through `ELEVENLABS_DR_AI_AGENT_ID`.
2. `/api/voice-context` supplies user context, locale, conversation ID, and a short-lived triage token.
3. The agent sends every health answer to the `vyva_triage_step` webhook.
4. The backend returns the exact safe question, choices, emergency wording, or completed report.
5. The agent calls the blocking `sync_dr_ai_screen` client tool.
6. The app fetches and renders the matching canonical screen, acknowledges it, and only then does the agent speak the returned wording.
7. Touch answers are sent to the same triage session and injected into the live voice context.

The voice agent must never diagnose, prescribe, invent a medical question, or replace the triage engine.

## Configuration

The version-controlled provider manifest is [`config/elevenlabs/dr-ai-agent.json`](../../config/elevenlabs/dr-ai-agent.json). It defines one multilingual voice for English, Spanish, French, German, Italian, and Portuguese; patient turn-taking; the required webhook; the blocking screen-sync tool; and maximum-privacy defaults.

Required secure deployment variables:

```text
ELEVENLABS_API_KEY
ELEVENLABS_DR_AI_AGENT_ID
ELEVENLABS_DR_AI_VOICE_ID
VYVA_PUBLIC_URL
```

Rollout variables:

```text
VYVA_DR_AI_VOICE_MODE=disabled|pilot|active
VYVA_DR_AI_VOICE_PILOT_USER_IDS=user-id-1,user-id-2
```

Missing or invalid mode values fail closed as `disabled`. In `pilot`, only authenticated allowlisted user IDs may request readiness or a signed URL. The `dr-ai` slug never falls back to the companion.

## Provisioning

Validate without changing ElevenLabs:

```bash
npm run voice:dr-ai:provision
```

Create or update the tools and agent, apply privacy settings, and verify the result:

```bash
npm run voice:dr-ai:provision -- --apply
```

The apply command is idempotent by exact tool and agent name. It prints the resulting agent ID but never writes credentials to disk. Store the printed ID as `ELEVENLABS_DR_AI_AGENT_ID` in the deployment secret manager.

## Privacy

- ElevenLabs voice recording is disabled.
- Provider retention is set to zero days and Zero Retention Mode is requested.
- The app stores only the rolling triage text needed for an active check.
- Messages are cleared on complete, emergency, failure, or explicit abandonment.
- `POST /api/voice-triage/session/:conversation_id/end` ends an unfinished session and clears its messages.

Zero Retention Mode and processing health data still require the appropriate ElevenLabs commercial and legal configuration, including a BAA where applicable. Do not enable the production pilot until this has been confirmed.

## Optional audited admin review

VYVA includes an admin review path for deployments that deliberately retain Dr. AI recordings. It is disabled at the provider while the maximum-privacy manifest above remains active. Enabling it is a policy decision and must not happen until recording consent, the applicable agreement with ElevenLabs, and the production retention policy are approved.

When enabled, use the hybrid storage model:

1. Configure the ElevenLabs **post-call transcription** webhook as `https://<vyva-origin>/api/webhooks/elevenlabs/post-call` and copy its signing secret into `ELEVENLABS_POST_CALL_WEBHOOK_SECRET`.
2. Set `ELEVENLABS_ADMIN_REVIEW_AGENT_IDS` to the comma-separated agent IDs that may be indexed. If omitted, VYVA permits only `ELEVENLABS_DR_AI_AGENT_ID`.
3. Set `ELEVENLABS_CONVERSATION_RETENTION_DAYS` to the approved retrieval window (30 days by default, capped at 365), and configure the same or shorter retention in ElevenLabs.
4. Apply migration `0088_elevenlabs_conversation_reviews.sql`.
5. Open **Admin → Voice readiness → Audited conversation playback**.

The signed webhook stores only provider/session IDs, timing, availability, consent markers, and review metadata. It does not copy transcript text or recording bytes into VYVA. An admin must enter a reason before VYVA retrieves either item from ElevenLabs. Every successful or failed content request is written to `elevenlabs_conversation_access_events`; audio responses are delivered with browser caching disabled. VYVA refuses provider retrieval after its local retention deadline even if content still exists at ElevenLabs.

The voice session should pass `recording_consent`, `recording_consent_version`, and `recording_consent_at` as dynamic variables after explicit consent. Conversations lacking those markers remain visible as `not_captured` so reviewers can identify and escalate policy gaps.

## Pilot checklist

1. Provision and verify the agent.
2. Set the agent and voice IDs in the target environment.
3. Set pilot mode and add only test user IDs.
4. Test all six languages from the Ask Dr. AI mic and global mic handoff.
5. Confirm every backend step renders before its voice response.
6. Confirm touch answers continue the same voice session.
7. Confirm emergency wording is read exactly.
8. Confirm no provider audio or transcript remains after a test call.
9. Review the gated pilot before switching to `active`.
