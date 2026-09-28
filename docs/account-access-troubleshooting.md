# Account access across environments

Production and development can have independent account/profile records for the
same login email. A Git pull updates code, not database rows. An admin change
applies to that admin server's configured database; it is not a cross-environment
subscription sync.

Before changing a plan:

1. Record the app and admin origins. Do not compare a local mock to live data.
2. On each relevant server, run
   `npx tsx scripts/diagnose-account-access.ts "login email"`.
3. Compare runtime database target fingerprints, account IDs, active profile IDs,
   tiers, lifecycle evidence, and audit timestamps. Admin-only `/api/health/db`
   also reports runtime identity. Different fingerprints indicate different
   configured targets; aliases/poolers can point at the same database, so verify
   records too. Matching fingerprints alone do not prove matching schemas/data.
4. Treat missing evidence as unknown history, not proof of a downgrade. In
   particular, a stale trial timestamp on a Free profile does not explain how
   the profile became Free.
5. Test Premium flows with a deliberately provisioned development account and
   verify its plan before testing. Use the environment's normal audited admin
   access controls, with explicit approval. Do not copy production credentials,
   connect development to production to fix a test, auto-grant access by email,
   or automatically synchronize production entitlements into development.

The diagnostic enforces a read-only transaction and does not invoke the app's
self-healing entitlement/profile helpers. Its output contains internal IDs and
subscription history: keep it private. It omits login email, connection strings,
credentials, and payment identifiers. Do not publish diagnostic output.

## September 27 investigation

The Replit development record inspected for the reported login had a Free tier,
trial status, a May 20 trial date, May 6 creation and May 7 last update. It had no
matching lifecycle record by email or linked account/profile ID, and no matching
lifecycle audit events. Production admin displayed Premium active for that
email. These observations explain why development cannot recover Premium from
its own lifecycle records. They do not establish who created/copied the old
development data or which historical operation set its tier.
