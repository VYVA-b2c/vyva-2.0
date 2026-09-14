# VYVA Voice Journey Map

This document maps common spoken requests to the intended product journey, owning agent, app route, confirmation rules, and implementation status.

Voice should behave like a continuous layer over the app:

- The user can start voice from any page.
- VYVA listens, classifies the request, and opens the right app surface when a screen helps.
- The voice dock remains active while the user views or completes the task.
- High-risk or external actions require explicit confirmation before any call, booking, contact, purchase, or order is made.
- Health flows open the real task screen and should not show internal "Done" action panels.

## Home Voice Presentation Lock

Home voice mode is the calm default. It may show only the VYVA mark, one compact utility dock, the greeting, one short supporting message when useful, the shared Zamora voice orb, and the bottom navigation/SOS affordance.

Cards, quick actions, chips, and broad choice grids belong in touch mode. Voice mode can remember the selected pillar or subflow, but should not reveal broad cards until the user switches to touch mode.

The utility dock is one visual block. It owns settings, text size, theme, and the interaction-mode switch. The mode switch must use the same compact button language as the other utility controls.

The orb is the assistant presence. Idle, listening, and speaking states must use the same `ZamoraVoiceOrb` surface. Listening and speaking may animate with mic or speech energy, but must not swap to a waveform badge, separate audio icon, eye, mouth, or decorative alternate.

Allowed voice-mode exceptions are exact active flow canvases that need confirmation/status, SOS or emergency escalation, auth/connectivity recovery, and short temporary first-use hints that do not add chips or a card grid.

Regression coverage should keep proving that voice mode renders greeting plus orb, touch mode reveals cards, broad voice intents stay hidden until touch mode, exact active flow canvases remain the normal exception, the utility dock keeps one compact control group, and active voice keeps using `ZamoraVoiceOrb`.

## Priority Journeys

| Priority | User says | Intent | Agent | Route | Required context | Confirmation |
|---|---|---|---|---|---|---|
| P0 | "I want to see a doctor" | Doctor support | Health / Doctor | `/health/doctor` | Symptom/topic, GP profile, recent reports if relevant | Confirm before calling, emailing, or booking |
| P0 | "I have chest pain" / "I feel dizzy" | Symptom support | Health | `/health/symptom-check` | Symptom, severity, onset, red flags | Escalate emergency language; do not diagnose |
| P0 | "I fell" / "SOS" | Safety support | Safety | `/safe-home` or SOS sheet | Immediate safety, location, emergency contact | Confirm before calling unless user explicitly says SOS/call emergency |
| P0 | "Measure my vitals" | Capture vitals | Health | `/health/vitals` | Desired reading type, device/manual input | Confirm before saving readings |
| P0 | "Book me a ride" | Ride booking | Concierge | `/concierge` | Pickup, destination, time, mobility/access needs | Confirm before booking/contacting provider |
| P0 | "Order groceries" / "I need an order" | Order request | Concierge | `/concierge/shopping` or `/concierge` | Items, budget, delivery timing, substitutions | Confirm cart/order before checkout/contact |
| P0 | "I think this is a scam" | Scam support | Safety | `/scam-guard` | Message/source, requested action, urgency | Never ask for bank details; confirm before contacting anyone |
| P1 | "Did I take my pills?" | Medication adherence | Meds | `/meds/adherence-report` | Medication name, dose/time, missed/taken status | Confirm before marking taken or changing routine |
| P1 | "I need more medicine" | Medication refill/order | Meds + Concierge | `/meds` then `/concierge` if logistics needed | Medication, supply left, pharmacy/contact preference | Confirm before contacting pharmacy/order service |
| P1 | "Book a doctor appointment" | Appointment booking | Concierge | `/concierge` | Provider type, reason, date/time, transport need | Confirm before booking/contacting |
| P1 | "Call my GP" | GP contact | Health / Doctor | `/health/doctor` | GP phone/email, reason, urgency | Confirm before call/email unless explicit "call now" |
| P1 | "Find a plumber" / "I need a cleaner" | Home service | Concierge | `/concierge` | Service type, issue, urgency, address/access notes | Confirm before contacting provider |
| P1 | "Show my reports" | Report review | Reports | `/informes` | Report type/time period | No external confirmation; sensitive context |
| P1 | "Do a daily check-in" | Daily check-in | Health | `/health/check-in` | Mood, symptoms, medication/vitals prompts | Confirm before saving/submitting |
| P2 | "Play a memory game" | Memory game | Brain Coach | `/memory-games` | Game type, difficulty | No high-risk confirmation |
| P2 | "Give me a brain exercise" | Brain activity | Brain Coach | `/activities` | Preference, difficulty, duration | No high-risk confirmation |
| P2 | "Help me relax" | Relax/breathe | Brain Coach | `/activities/relax-breathe` | Comfort, seated/standing preference | No high-risk confirmation |
| P2 | "Help me focus" | Attention booster | Brain Coach | `/attention-boosters` | Activity preference, time available | No high-risk confirmation |
| P2 | "I want to talk to someone" | Companion/social | Companion | `/companions` or `/social-rooms` | One-to-one vs community preference | Confirm before inviting/contacting others |
| P2 | "I want to learn something" | Learning | Brain Coach | `/learn` | Topic, language, difficulty | No high-risk confirmation |
| P2 | "Train my senses" | Senses | Brain Coach | `/senses` | Activity preference | No high-risk confirmation |
| P3 | "Change my settings" | Settings support | Main VYVA | `/settings` | Setting area | Confirm before destructive/account changes |
| P3 | "Remind me tomorrow" | Reminder/schedule | Concierge | `/settings/scheduled-support` or `/concierge` | Reminder text, date/time, recurrence, recipient | Confirm before saving reminder |

## Current Implementation Status

| Journey | Status | Current mapping |
|---|---|---|
| Doctor support | Covered | `health.doctor_support` -> `/health/doctor` |
| Symptom support | Covered | `health.symptom_support` -> `/health/symptom-check` |
| Vitals review | Covered | `health.vitals_review` -> `/health/vitals` |
| Vitals capture | Wired | `health.vitals_capture` -> `/health/vitals` |
| Medication management | Covered | `meds.management` -> `/meds` |
| Medication adherence / stock | Covered | `meds.inventory_report` -> `/meds/adherence-report` |
| Medication refill/order | Wired | `meds.refill_request` -> `/meds/adherence-report` |
| Safety emergency | Covered | `safety.support` -> `/safe-home` |
| Scam support | Covered | `safety.scam_support` -> `/scam-guard` |
| Appointment booking | Covered | `concierge.appointment_help` -> `/concierge` |
| Ride booking | Wired | `concierge.ride_booking` -> `/concierge` with ride prefill |
| Home service | Covered | `concierge.home_service` -> `/concierge` |
| Shopping/product choice | Covered | `concierge.shopping` -> `/concierge/shopping` |
| Order request | Wired | `concierge.order_request` -> `/concierge/shopping` with shopping prefill |
| Reports/history | Covered | `reports.history` -> `/informes` |
| Brain activity | Covered | `brain.activity` -> `/activities` |
| Memory game | Covered | `brain.memory_game` -> `/memory-games` |
| Relax/breathe | Wired | `brain.relax_breathe` -> `/activities/relax-breathe` |
| Attention/focus | Wired | `brain.focus` -> `/attention-boosters` |
| Learning | Wired | `brain.learn` -> `/learn` |
| Senses | Wired | `brain.senses` -> `/senses` |
| Social rooms | Covered | `social.rooms` -> `/social-rooms` |
| Companion chat | Wired | `social.companion_chat` -> `/companions` |
| Daily check-in | Wired | `health.daily_checkin` -> `/health/check-in` |
| Reminder/schedule | Wired | `concierge.reminder` -> `/settings/scheduled-support` |

## Journey Rules

### Health

- Use Health for symptoms, vitals, medication context, and doctor support.
- Do not claim diagnosis.
- Ask one question at a time.
- Escalate urgent red flags to Safety/SOS.
- Open task screens directly; no internal action-completion cards.

### Concierge

- Use Concierge for logistics: rides, appointments, orders, shopping, home services, reminders.
- Gather the minimum details needed for the next step.
- Confirm before contacting a provider, booking, purchasing, or sending details.
- If a request has health context, preserve that context but let Concierge own logistics.

### Safety

- Highest priority.
- Keep wording calm and direct.
- Avoid collecting unnecessary sensitive information.
- For scams, never ask for banking credentials, OTPs, or full card details.

### Brain Coach

- Use for memory games, calm activities, focus, learning, relaxation, and sensory games.
- Keep voice supportive, low-pressure, and interruption-friendly.
- Voice should continue as a coach while the user interacts with the page.

### Companion / Social

- Distinguish one-to-one companion from community/social rooms.
- Avoid forcing the user into community if they asked for private company.
- Confirm before sharing, inviting, or contacting another person.

## Recommended Next Implementation Batch

1. Deepen route state payloads for task prefill:
   - Ride: pickup, destination, time, mobility needs.
   - Order: item/category, urgency, budget, delivery preference.
   - Vitals: reading type and capture mode.
   - Medication refill: medication name and supply concern.

2. Add end-to-end checks for priority phrases:
   - "I want to see a doctor"
   - "Book me a ride"
   - "Measure my blood pressure"
   - "Order groceries"
   - "I need more metformin"
   - "Remind me tomorrow morning"
   - "Help me relax"
   - "I want someone to talk to"

3. Review each opened screen for duplicate generic voice controls.
