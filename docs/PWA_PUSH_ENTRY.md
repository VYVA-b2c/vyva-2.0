# Stage 5 PWA Push Entry

Task 10 adds the first PWA push entry adapter for the frozen Stage 4 flow:
`health.preventive_check@1.0.0`.

This is an entry adapter, not a new Health Flow and not a proactive dispatcher.
Task 8 remains audit-only/shadow-only. Stage 5 evaluates the Task 8 policy and
writes the Task 8 audit before any push-specific delivery decision, then applies
its own dedicated flag and consent checks.

## Runtime boundary

1. Accept a normalized Task 8 proactive evaluation input for
   `daily_wellbeing_check` with proposed channel `web_push`.
2. Evaluate the Task 8 policy and persist the audit.
3. Resolve `flag.engagement.preventive_web_push`.
4. Re-check dedicated server-side preventive web-push consent and an active
   push subscription.
5. Create or load a durable `requested` delivery, then acquire an idempotent
   `sending` claim for the user, subscription and schedule occurrence.
6. Persist a durable provider-attempt identity before the network call.
7. Persist only a digest of the opaque entry token.
8. Send a fixed-shape Web Push payload through the dedicated `web-push` adapter.
9. If the provider accepts, record `delivery_uncertain` before the final `sent`
   commit. If the final commit or observability fails after provider acceptance,
   retries do not automatically call the provider again.
10. Record sent, failed, opened and flow-started outcomes.

No Stage 5 code sends SMS, voice, WhatsApp, email or in-app fallback. No Stage 5
code changes the preventive Health questions, answer contract, Specialist
proposal validation, completion identity or completion persistence.

## Consent and subscription

Browser notification permission is not sufficient. VYVA stores a separate
server-side preventive web-push consent bit and revision on
`user_channel_preferences`; it defaults to false and is distinct from Concierge
task notification preferences.

The entry redemption and `flow_started` APIs re-check the current authoritative
server consent and the active subscription/consent revision inside the same
store operation that would mark `opened` or `flow_started`. Revoking preventive
web-push consent invalidates outstanding unexpired owned entry tokens
idempotently. Historical sent/failed delivery rows remain as audit records, but
revoked tokens fail closed through the same minimized public failure shape used
for invalid, wrong-user, expired, replayed or revoked restoration attempts.

The authenticated subscription route validates browser subscription payloads
with a descriptor-safe inert clone, allows only known browser push-service HTTPS
endpoints, rejects localhost/IP/generic SSRF targets, and stores endpoint digests
for idempotency.

Subscription keys and VAPID provider keys are decoded and validated, not merely
checked for base64url-looking text. The shared decoder rejects whitespace,
padding, impossible base64url lengths, non-canonical round trips, wrong decoded
lengths, degenerate all-zero material and invalid P-256 public points. The VAPID
public/private pair must match, and invalid or missing provider configuration
keeps the Stage 5 pilot disabled.

The Stage 5 feature flag parser is strict. Empty CSV items, repeated separators,
leading/trailing whitespace, tabs, CR/LF, Unicode whitespace, duplicate entries,
malformed identity strings and excessive item counts or lengths disable the
pilot with a minimized stable reason. Denylist entries take precedence over
allowlist and rollout selection.

## Delivery state and guarantee

The durable delivery states are:

```text
requested
→ sending
→ provider_attempt_started
→ delivery_uncertain
→ sent
→ opened
→ flow_started
```

Pre-provider failures may move to `failed_retryable`; permanent provider
responses such as 404/410 move to `failed_permanent`. Terminal states do not
regress to `sending`.

Stage 5 does not claim exactly-once remote Web Push delivery. The implemented
guarantee is narrower: after a provider attempt is locally recorded, VYVA makes
at most one automatic provider call for that delivery occurrence. If provider
acceptance is ambiguous because the final `sent` commit or observability fails,
the delivery is classified as `delivery_uncertain` and is not blindly resent.

The provider adapter returns only minimized provider status/reason metadata
needed for reconciliation. Raw provider bodies, tokens, endpoints and key
material are not emitted in public responses or telemetry.

## Notification click restoration

The service worker accepts only the fixed `vyva.preventive_check` push payload
with a bounded opaque token. Notification content and route are fixed by VYVA;
payload title, body, URL or redirect values are not trusted.

Clicking the notification opens or focuses `/health/check-in?pushEntry=...`.
The PWA redeems the token through an authenticated API, removes the token from
the URL, and marks `flow_started` only after the user taps Start.

Normal navigation to `/health/check-in` remains available without push
restoration authority. A revoked, expired or invalid push token only denies the
restoration path; it does not block the ordinary preventive Health screen.

## Browser and service-worker boundary

The client requests Notification permission only inside the explicit enable
action. If the browser creates a new Push subscription and server persistence
fails, the client attempts to unsubscribe the newly-created subscription; it does
not remove a pre-existing browser subscription that it did not create.

The service worker keeps the existing cache/version/install/activate/fetch
behavior unchanged. Task 10 only adds fixed push and notification-click handling:
payload URLs are ignored, and the click route is the fixed same-origin
`/health/check-in?pushEntry=...` route.

Playwright coverage uses Chromium and the actual Vite-served client module with
browser-context instrumentation for Notification, Service Worker and PushManager
APIs. The tests prove the browser-facing adapter behavior and service-worker
click routing. They do not prove remote push-service delivery.

## Database and verification boundary

Migration 0079 and `shared/schema.ts` define the same Task 10 columns, defaults,
indexes and CHECK constraints for subscription status, digest shape, fixed
channel/purpose/Flow identity, fixed route, token expiry ordering, consent
revision and provider-attempt state. PostgreSQL freeze proof requires
`TASK10_POSTGRES_URL` to point at an approved disposable database whose name
contains `task10` and one of `test`, `tmp`, `ci` or `scratch`.

Stage 5 remains default-disabled and is not broadly rolled out. It does not add
auto-voice, proactive dispatch outside the dedicated flag, SMS/voice/WhatsApp/
email/in-app fallback, Mem0 writes, Specialist execution or broader Health Flow
changes.
