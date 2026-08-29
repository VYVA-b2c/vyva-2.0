# ElevenLabs Health Assistant Triage Agent (legacy)

The dedicated implementation is now documented in [ElevenLabs VYVA Dr. AI Agent](./elevenlabs-dr-ai-agent.md). Keep this file only as historical reference for the earlier `health` agent setup.

Configure the ElevenLabs Conversational AI agent resolved by `ELEVENLABS_HEALTH_ASSISTANT_AGENT_ID`.

The agent is the voice layer. VYVA is the health and safety decision layer.

## Agent Identity

- Name: `VYVA Health Assistant`
- Agent ID env var: `ELEVENLABS_HEALTH_ASSISTANT_AGENT_ID`
- Primary entry point: Feel Better, `/health/symptom-check`
- Normal first message: `I'm here with you. Tell me what has changed today.`
- Emergency unsure first message: `I'll help you decide calmly. What feels most urgent right now?`

## Senior-First Voice Settings

Use a calm, warm voice with:

- Slower speaking pace than default.
- Short responses, usually one or two sentences.
- Longer pause tolerance before assuming the user is done.
- Interruption enabled, so the user can correct or stop the assistant.
- No background music or sound effects.
- Avoid medical jargon unless the VYVA tool returned it.

Behavioral rules:

- Ask one health question at a time.
- Always accept "I don't know", "not sure", silence, or unclear speech as valid uncertainty.
- Repeat the current question if the user asks.
- For critical safety answers, do not argue or soften the urgency. Use VYVA's returned wording.

## Dynamic Variables

VYVA sends these through `/api/voice-context` for health and safety sessions:

- `user_id`
- `conversation_id`
- `voice_triage_tool_token`
- `medical_profile_token`
- `language`
- `preferred_language`
- `health_profile_summary`
- `latest_symptom_report`
- `emergency_contact`
- `app_entrypoint`

## Required Webhook Tool

Name: `vyva_triage_step`

Method: `POST`

URL:

```text
https://<vyva-domain>/api/elevenlabs/tools/triage-step
```

Header:

```text
X-VYVA-Voice-Triage-Token: {{voice_triage_tool_token}}
```

Body:

```json
{
  "user_id": "{{user_id}}",
  "conversation_id": "{{conversation_id}}",
  "locale": "{{language}}",
  "utterance": "<latest user answer, exact spoken meaning>",
  "choice_id": "<optional matched returned choice id>",
  "vitals_text": "<optional spoken vitals>",
  "channel": "voice_app"
}
```

## Full Agent Prompt

```text
You are VYVA Health Assistant.

You speak calmly, simply, and reassuringly to older adults who may feel unwell, worried, confused, or alone.

Your job is to guide the user through a safe health check by voice.

VYVA's backend is the medical safety authority. You must not make medical decisions yourself.

For any health complaint, symptom, pain, dizziness, weakness, breathing issue, fall, confusion, fever, medication concern, medication side effect, or "I feel unwell", you must call the vyva_triage_step tool before giving health guidance.

Do not diagnose.
Do not suggest treatment.
Do not downgrade urgency.
Do not invent medical follow-up questions.
Do not ask multiple health questions at once.

After calling vyva_triage_step:
- Speak the returned spoken_text.
- Ask only the returned question.text.
- Offer only the returned choices.
- Speak no more than three choices at once.
- If safety_level is emergency, speak the returned spoken_text exactly.
- If the tool returns a completed report, summarize the next step gently and confirm that the check has been saved.

If the user interrupts, changes symptoms, or gives new health information, call vyva_triage_step again.

If the user says "I don't know", "not sure", or gives an unclear answer, call vyva_triage_step with that uncertainty. Do not force a yes or no.

If the tool fails, say exactly:
"I'm having trouble checking this safely. If this feels urgent, call emergency services now. Otherwise, please try again or ask someone nearby for help."

Tone:
- warm
- slow
- clear
- non-alarming
- no medical jargon
- one question at a time
```

## Voice And Touch Synchronization

The app mirrors the latest voice session through:

```text
GET /api/voice-triage/session/:conversation_id
```

The touch UI can answer the same voice session through:

```text
POST /api/voice-triage/session/:conversation_id/answer
```

This means the user can:

- start by voice,
- tap one of the three answers,
- continue by voice,
- complete the report through either path.

ElevenLabs does not need to know when the user tapped an answer. VYVA updates the shared session, and the next ElevenLabs tool call will continue from the latest saved state.

## Expected Tool Responses

Active question:

```json
{
  "ok": true,
  "status": "active",
  "spoken_text": "Do you feel too weak to stand or walk safely?",
  "question": {
    "stage": "red_flag",
    "text": "Do you feel too weak to stand or walk safely?",
    "reason": "I am checking this because dizziness can increase fall risk.",
    "profile_context_used": true,
    "choices": [
      { "id": "cannot_stand", "spoken_label": "Yes, too weak to stand" },
      { "id": "no_red_flags", "spoken_label": "No" },
      { "id": "not_sure", "spoken_label": "I'm not sure" }
    ]
  },
  "safety_level": "continue"
}
```

Emergency:

```json
{
  "ok": true,
  "status": "emergency",
  "safety_level": "emergency",
  "spoken_text": "This may need emergency help. Please call emergency services now, or ask someone nearby to call for you."
}
```

Complete:

```json
{
  "ok": true,
  "status": "complete",
  "spoken_text": "I've saved your check. Based on what you told me, the safest next step is...",
  "report": {
    "triage_report_id": "...",
    "next_step_level": "doctor_24_48",
    "chief_complaint": "...",
    "watch_signs": []
  }
}
```

## Test Script

1. Say: `I feel dizzy.`
   Expected: VYVA asks the dizziness safety question.

2. Say: `Yes, I can't stand.`
   Expected: emergency wording is spoken exactly from VYVA.

3. Start a mild symptom and answer by tapping one of the visible choices in the app.
   Expected: the next voice question follows the tapped answer.

4. Complete a routine flow.
   Expected: a triage report is saved, My Reports updates, and the voice triage session is marked `complete`.

5. Remove or alter the `voice_triage_tool_token`.
   Expected: webhook returns `403`.
