# Concierge Flow Alignment

This is the operating map for Concierge development. It keeps product, provider setup, channel readiness, and confirmation rules aligned before deeper implementation.

## Current Readiness

| Flow | Status | User asks for | VYVA needs saved | Provider/channel need | Blocked until user confirms | Saved outcome |
| --- | --- | --- | --- | --- | --- | --- |
| Transport / ride | Needs provider setup | A ride, pickup, destination, time | Default taxi or transport provider, home/pickup place, mobility notes | Phone, WhatsApp, or booking link | Call, message, booking, or sharing trip details | Ride request, provider response, or booking result |
| OTC pharmacy | Needs provider setup | Help getting a non-prescription item | Default pharmacy, item, pickup/delivery preference | Phone, email, WhatsApp, or operator review | Calling, messaging, order request, purchase, or sharing details | Pharmacy request, reply, or completed plan |
| Medical appointment | Needs provider setup | Help preparing or booking an appointment | Doctor/clinic, coverage note, reason, preferred time | Phone, email, booking link, or operator review | Calling, emailing, booking, or sharing health details | Appointment request, provider reply, or appointment status |
| Home service | Needs provider setup | A repair, visit, cleaning, or home service | Default home-service provider, address, access notes, urgency | Phone, email, WhatsApp, booking link, or operator review | Calling, messaging, booking, sharing address, or sending photos | Service request, provider reply, estimate, or visit result |
| Shopping / groceries / meals | Ready | Help choosing groceries, meals, or items | Preferences if available | Web search or operator review | Purchase, payment, delivery request, or sharing address | Options, recommendation, or confirmed order plan |
| Care / residence search | Needs UX cleanup | Find care, specialist, residence, or comparison options | Care need, location, preferences, contact channel | Web search, phone, email, WhatsApp, or operator review | Contacting providers, saving shortlist, or sharing personal context | Shortlist, comparison, or next-step handoff |
| Scam / company / document review | Ready | Check if something looks suspicious | Document, photo, text, link, phone, or company name if needed | Upload, web search, or operator review | Uploading, forwarding, contacting company, or sharing personal details | Risk review and recommended next step |
| Safe home support | Needs UX cleanup | Help with a home safety concern | Address, risk type, urgency, optional photo/document | Phone, upload, or operator review | Alerting, calling, uploading, or sharing location/details | Safety assessment or next-step task |
| Insurance / admin help | Needs channel setup | Help with paperwork, forms, insurance, government, or admin tasks | Coverage, document, recipient, deadline | Email, phone, upload, form/application, or operator review | Sending, calling, uploading, submitting a form, or sharing data | Prepared admin task, sent receipt, or completion result |
| Call / email / form / application | Needs channel setup | Ask VYVA to contact someone or submit something | Recipient/site, task goal, deadline, needed documents | Email, phone, form/application, upload, or operator review | Any live call, send, upload, submit, purchase, or shared data | Action receipt, reply, or blocked/manual-review outcome |

## Development Alignment

- The Concierge flows are ready as guided flows.
- Provider-heavy flows should first use trusted/default providers, then ask the user to add or choose one only when missing.
- Live actions remain blocked unless the channel is configured, verified, admin-enabled, and confirmed by the user.
- Email is the first live-ready channel. Phone, WhatsApp, forms/applications, and document uploads stay gated until their setup is verified.
- Task screens should stay simple: current status, provider reply if any, one recommended next action, and final confirmation before anything external happens.

## Next Three Development Goals

1. Provider setup by flow
   - Make transport, pharmacy, medical, and home-service flows consistently use saved/default providers first.
   - Missing-provider paths should open the simple provider setup path with the right category preselected.

2. Simplify Concierge task UX
   - Show one task status, one provider reply or update, and one next action.
   - Move technical data and audit details behind admin-only screens.

3. Channel rollout plan
   - Keep email live-ready first.
   - Choose the next channel per flow before implementation: phone for appointments/transport, WhatsApp for local providers, forms/uploads for admin tasks.
