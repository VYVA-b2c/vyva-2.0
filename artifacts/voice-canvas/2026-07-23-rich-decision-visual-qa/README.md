# Voice Canvas rich decision visual QA

Date: July 23, 2026  
Branch: `codex/live-visual-qa-screenshots-v1`

## Scope

Captured visual evidence for the unified rich-card decision pattern across the current live Canvas harnesses:

- Ride
- Medication refill
- Shopping and delivery
- Provider reply

The screenshots focus on the first rich decision scene in each flow, before any external action can occur.

## Local routes

| Flow | Route |
| --- | --- |
| Ride | `http://127.0.0.1:5000/voice-canvas-integration.html` |
| Medication refill | `http://127.0.0.1:5000/medication-refill-canvas-integration.html` |
| Shopping and delivery | `http://127.0.0.1:5000/shopping-delivery-canvas.html` |
| Provider reply | `http://127.0.0.1:5000/provider-reply-canvas.html` |

## Screenshot evidence

| Flow | Desktop | Mobile |
| --- | --- | --- |
| Ride | `ride-desktop.png` | `ride-mobile.png` |
| Medication refill | `refill-desktop.png` | `refill-mobile.png` |
| Shopping and delivery | `shopping-desktop.png` | `shopping-mobile.png` |
| Provider reply | `provider-reply-desktop.png` | `provider-reply-mobile.png` |

Desktop captures used a wide desktop browser viewport. Mobile captures used a narrow mobile browser viewport. The in-app browser chrome reports a smaller content width than the requested outer viewport, so the recorded screenshot pixel widths are expected to differ from the requested viewport values.

## Findings

- The shared rich-card pattern is visible across all four flows.
- Long labels wrap in the mobile captures, including the Spanish shopping retailer label and the deliberately long provider-reply intent label.
- Safety boundaries are visible before action:
  - Ride cards show review-before-booking and no-booking-yet reminders.
  - Refill cards show saved-medication context and an urgent/unclear medication path that stops the flow.
  - Shopping cards show unverified estimate/fee state and review-before-action reminders.
  - Provider reply cards show draft-only, no-message-sent, review-before-send, and urgent safety boundary messaging.
- Voice/orb presence is visually strongest in ride and shopping, where the VYVA voice-status band is visible in the first decision scene.
- Refill and provider reply do not show the same voice-status band in their first rich decision screenshots. They still show progress and focused scene content, but agent presence should be considered for parity if the intended UX is “audio + visual together” across every flow.
- During QA, the shopping mobile demo toolbar had a small horizontal overflow. The dev harness toolbar now wraps on small screens, and the recaptured shopping mobile screenshot no longer reports horizontal overflow.

## Width checks

After recapturing shopping mobile, the shopping page reported matching content and viewport widths at mobile size, confirming the toolbar overflow fix:

- `clientWidth`: 339
- `scrollWidth`: 339
- `bodyScrollWidth`: 339

## Follow-up recommendation

Add the same `agentPresence`/voice-status treatment to refill and provider reply first decision scenes so every flow makes the audio agent visible while the user is making a visual choice.
