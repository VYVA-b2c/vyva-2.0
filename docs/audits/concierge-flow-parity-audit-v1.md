# Concierge Flow Parity Audit v1

Date: 2026-07-20

This audit checks whether the major Concierge flows have the same minimum product shape. It is based on the current source files, tests, and workflow registries, especially:

- `shared/conciergeFlowRegistry.ts`
- `shared/conciergeFlowRequirements.ts`
- `shared/conciergeFlowCoverage.ts`
- `shared/crossAppWorkflowCompletionAudit.ts`
- `shared/conciergeActionExecution.ts`
- `shared/conciergeToolReadiness.ts`
- `shared/conciergeSavedProviders.ts`
- `shared/conciergeConfirmationReceipt.ts`
- `src/pages/ConciergeScreen.test.tsx`
- `src/pages/HomeScreen.actions.test.tsx`

## Legend

- OK: implemented and covered enough for parity.
- Partial: user path exists, but one parity expectation is weaker than the others.
- Blocked: intentionally depends on provider setup, external channel setup, or vendor/tool availability.
- Later: not required for parity, but a good future improvement.

## Parity Checklist

Every flow should have:

1. Clear entry from Home, Concierge, a module page, or voice handoff.
2. Guided intake that asks only for missing details.
3. Saved-provider path where the flow needs a provider.
4. Missing-provider path where the flow needs a provider.
5. Search/comparison criteria where provider choice matters.
6. Tool readiness handling for phone, email, WhatsApp, booking links, uploads, forms, search, or operator review.
7. Final user confirmation before any external action.
8. Provider reply, no-reply, unavailable, or needs-more-info handling where a provider is contacted.
9. Completion state and completed history.
10. Receipt / next-step closure.
11. Resume from Home when unfinished or recently completed.

## Current Flow Parity

| Flow | Entry | Intake | Saved Provider | Missing Provider | Search / Compare | Tool Readiness | Confirmation | Reply / No Reply | Completion | Receipt | Home Resume | Status | Gap / Next Slice |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ride / transport | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK after PR #863 | OK | Complete | Monitor real transport partner replies and keep price/accessibility source labels visible. |
| OTC pharmacy | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK after PR #863 | OK | Complete | Keep prescription medicine blocked. OTC only unless a regulated prescription model is later approved. |
| Medical appointment | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK after PR #863 | OK | Complete | Future expansion is direct booking/form integrations, not core flow parity. |
| Home service | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK after PR #863 | OK | Complete | Improve provider-owned availability and estimate sources, but current flow is parity-complete. |
| Shopping / groceries / meals | OK | OK | Not required | Not required | OK | OK | OK | Partial | OK | OK after PR #863 | OK | Partial | Shopping has completion and review outcomes, but provider/seller reply and unavailable follow-through is lighter than provider-heavy flows. |
| Care / residence / provider search | OK | OK | OK | OK | OK | OK | OK | OK | OK | OK after PR #863 | OK | Complete | Keep as shared provider comparison backbone. Future work is better source integrations. |
| Scam / company / document review | OK | OK | Not required | Not required | OK | OK | OK | Not required | OK | OK after PR #863 | OK | Complete | Future work is richer verified reputation sources and direct email/document intake. |
| Safe Home support | OK | OK | Sometimes | OK through home-service path | OK through home-service path | OK | OK | OK when routed to provider task | OK | OK after PR #863 | OK | Complete | Keep safety urgency separate from ordinary home-service booking. |
| Insurance / admin help | OK | OK | Not always required | Not required | Not required | OK | OK | OK for email/call/form outcomes | OK | OK after PR #863 | OK | Complete | Future work is more live form/upload execution once tools are configured. |
| Generic call / email / form / application | OK | OK | Not always required | Not required | Not required | OK | OK | OK for action outcomes | OK | OK after PR #863 | OK | Complete | Keep as fallback shell for new external actions. Add integrations behind readiness gates only. |

## What Is Actually Uneven

The main parity gap is not the booking backbone anymore. Ride, appointment, home service, provider search, OTC, admin help, Scam Guard, and Safe Home all have the same core safety shape.

The uneven area is **shopping / groceries / meals**:

- It has a strong review and comparison path.
- It has confirmation and completion.
- It does not yet have the same depth of provider/seller reply handling as ride, appointment, home service, OTC, and care-provider flows.
- It should not become checkout/payment in this slice. The gap is follow-through after VYVA prepares or contacts a seller/provider, especially changed availability, unavailable seller, replacement option, and completed receipt language.

## Provider Setup Parity

Provider-dependent flows are aligned:

| Provider Category | Used By | Current Path |
| --- | --- | --- |
| Pharmacy | OTC pharmacy | Focused trusted-provider setup, OTC-only confirmation |
| Doctor / Clinic | Medical appointment | Focused trusted-provider setup, coverage note, final confirmation |
| Transport / Taxi | Ride / transport | Focused trusted-provider setup, mobility details only when missing |
| Home service | Home service, Safe Home quote handoff | Focused trusted-provider setup, address/access/urgency |
| Personal care | Care / residence search | Search first, save provider when user chooses |
| Food / seller | Shopping / meals | Search/review first, seller/provider reply path needs more parity |

## Tool Readiness Parity

The shared readiness shell covers:

- Phone call
- Email
- WhatsApp
- Booking link
- Camera or upload
- Web search
- Operator review

This is the right model. We should not build flow-specific exceptions unless a new real integration requires it.

## Recommended Next Implementation

Next slice: **Shopping Seller Follow-Through Parity v1**

Goal:

- Bring shopping, groceries, prepared meals, and seller/deal checks up to the same follow-through standard as provider-heavy Concierge flows.

Scope:

- Add a seller/provider reply state for shopping support.
- Support outcomes: available, unavailable, changed price, changed delivery window, needs more info, no answer.
- If unavailable, offer replacement search using the same comparison criteria.
- Keep checkout, payment, purchase, and address sharing blocked behind final confirmation.
- Feed completed shopping outcomes into the shared receipt builder.
- Keep Home resume behavior consistent with other Concierge tasks.

Out of scope:

- Real checkout.
- Payment.
- Automatically ordering meals or groceries.
- New database tables unless current task payload cannot store the outcome.

## Decision

Do this next if the goal is equal flow maturity. The foundation is already there; shopping follow-through is the one flow that reads as slightly less finished than the others.
