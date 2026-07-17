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
- Health symptom, medication, source-backed medicine updates, vitals, reports, and doctor next-step flows.
- Mind and Memory games and cognitive assessment.
- Learning plans with resumable read-aloud in the selected app language.
- Community rooms, curated activities, Together Room plans, and social-room actions.
- Concierge transport, OTC pharmacy, medical appointment, home service, shopping, care navigation, Safe Home, and completed-history coverage.
- Trusted provider setup categories.

The shared Show VYVA result contract, provider setup return loop, external-action readiness shell, provider comparison experience, source-backed medication update review, and unified admin content index are now implemented.

All workflows represented in this audit now have a usable completion path. New work should be added to the structured audit before it is treated as a launch dependency.

## Reusable Flows

- `RFL_SECTION_NAVIGATION`: main cards open sections only.
- `RFL_BOOKING_CONFIRMATION`: collect details, prepare booking, confirm before action.
- `RFL_TRUSTED_PROVIDER_SETUP`: focused provider setup by category.
- `RFL_PROVIDER_SEARCH_COMPARE`: compare up to three options by sourced proximity, price, reputation, availability, accessibility, and coverage; keep unknowns visible, save a shortlist or trusted provider, and require confirmation before contact.
- `RFL_SHOW_VYVA_REVIEW`: capture photo, upload, pasted text, or link for review.
- `RFL_TOOL_GATED_ACTION`: prepare external actions behind readiness and confirmation.
- `RFL_SOCIAL_PLAN_COORDINATION`: shared plans, responses, and room coordination.

## Next Implementation Order

There are no incomplete workflows in the current structured audit.
