# Cross-App Workflow Completion Audit

This audit maps the current VYVA user workflows across Home, Health, Mind and Memory, Learning, Community, Concierge, Scam Guard, Safe Home, trusted providers, and external tools.

## Status Legend

- `complete`: the flow has an entry point, a reusable flow reference, guardrails, and a usable completion state.
- `partial`: the flow exists, but one important contract or integration is still unfinished.
- `missing`: the flow is not yet represented by a usable user path.
- `blocked_provider_setup`: the user needs a saved trusted provider or contact channel before the flow can proceed.
- `blocked_tool_setup`: the flow needs configured external tools such as phone calls, email, WhatsApp, uploads, forms, or booking links.

## Current State

The structured source of truth is `shared/crossAppWorkflowCompletionAudit.ts`.

The strongest areas are:

- Home main cards and rotating Fast help.
- Health symptom, medication, vitals, reports, and doctor next-step flows.
- Mind and Memory games and cognitive assessment.
- Community rooms, curated activities, Together Room plans, and social-room actions.
- Concierge transport, OTC pharmacy, medical appointment, home service, shopping, care navigation, Safe Home, and completed-history coverage.
- Trusted provider setup categories.

The biggest remaining gaps are:

- A single Show VYVA result contract across Health, Scam Guard, Safe Home, medication, shopping, documents, text, links, and phone numbers.
- A closed missing-provider loop that returns the user to the interrupted flow after setup.
- One external action readiness shell for calls, email, WhatsApp, uploads, booking links, forms, and applications.
- A reusable provider comparison output for care, home service, residence, seller, and shopping searches.
- Voice-readiness alignment for lesson read-aloud.

## Reusable Flows

- `RFL_SECTION_NAVIGATION`: main cards open sections only.
- `RFL_BOOKING_CONFIRMATION`: collect details, prepare booking, confirm before action.
- `RFL_TRUSTED_PROVIDER_SETUP`: focused provider setup by category.
- `RFL_PROVIDER_SEARCH_COMPARE`: compare by proximity, price, reputation, availability, accessibility, and coverage.
- `RFL_SHOW_VYVA_REVIEW`: capture photo, upload, pasted text, or link for review.
- `RFL_TOOL_GATED_ACTION`: prepare external actions behind readiness and confirmation.
- `RFL_SOCIAL_PLAN_COORDINATION`: shared plans, responses, and room coordination.

## Next Implementation Order

1. Finish the shared Show VYVA review contract.
2. Close the missing-provider setup and return loop.
3. Create one external action readiness shell.
4. Turn provider search into a reusable comparison output.
5. Align lesson read-aloud with voice readiness.
