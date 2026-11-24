# Replit to Vercel and Sites cutover

This is the production exit checklist for the VYVA B2C v2 application. Vercel is the production runtime. ChatGPT Sites is a separate private review/presentation surface until its frontend is deliberately connected to the Vercel API. Replit stays online until every cutover gate below has passed.

## Current target

- GitHub source: `VYVA-b2c/vyva-2.0`
- Vercel team: `karim-assads-projects`
- New Vercel project: `vyva-b2c-v2` (`prj_VGpWhRR3bJZRA7MxMWhb1bCIEJ4w`)
- Production domain after verification: `v2.vyva.life`
- Runtime: Vite static frontend plus Express API as Vercel Functions
- Database target: a new, B2C-only PostgreSQL/Supabase project; never use either B2B database
- Sites audience: private until the deployed experience is verified

## Gate 1: repository and preview

1. Grant the Vercel GitHub App access to `VYVA-b2c/vyva-2.0` and connect it to `vyva-b2c-v2`.
2. Push the migration branch and let Vercel create a preview deployment.
3. Confirm that the build uses `npm ci`, `npm run build:client`, and `dist`.
4. Keep GitHub production deployments gated. Do not attach `v2.vyva.life` yet.

Required checks:

```powershell
npm ci
npm run typecheck
npm run build:client
```

## Gate 2: provision an isolated B2C database

Create a new Supabase/PostgreSQL project in the intended organization and region. This is a paid/external resource decision and must be confirmed before creation. Use:

- a direct or session-pooler connection for `pg_restore` and migrations;
- the transaction-pooler URL for Vercel `DATABASE_URL`;
- a separate non-production database for Preview deployments;
- SSL as required by the provider.

Do not point Preview at Production and do not reuse the VYVA B2B staging or production projects.

## Gate 3: rehearse the database copy

Run the rehearsal while Replit remains live. In the Replit shell, where `DATABASE_URL` is already available:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file=vyva-rehearsal.dump
```

Download the dump through an approved private path. Restore it into an empty B2C target database using a direct/session-pooler target URL held in the shell environment:

```bash
pg_restore --dbname="$TARGET_DATABASE_URL" --clean --if-exists --no-owner --no-acl --exit-on-error vyva-rehearsal.dump
```

Then run the application schema audit against the target:

```powershell
$env:DATABASE_URL='<target direct/session-pooler URL>'
npm run db:audit
```

Compare all `public` tables, columns, and row counts without printing credentials:

```powershell
$env:SOURCE_DATABASE_URL='<Replit database URL>'
$env:TARGET_DATABASE_URL='<target direct/session-pooler URL>'
npm run db:compare-cutover
```

The rehearsal passes only when `db:audit` succeeds and `db:compare-cutover` reports no differences.

## Gate 4: move configuration and secrets

Copy values from Replit Secrets into the new Vercel project, not into Git or chat. Use Vercel Secret variables for credentials and keys. Scope values separately to Production, Preview, and Development.

Minimum boot set:

- `DATABASE_URL`
- `JWT_SECRET`
- `CRON_SECRET`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `APP_URL`, `VITE_PUBLIC_APP_URL`, `VYVA_PUBLIC_URL`
- provider credentials used by enabled features (Stripe, ElevenLabs, OpenAI, Twilio, Resend/SendGrid, Meta, Google Places, Mem0)

Use `.env.example` as the full inventory. Rotate secrets that were ever exposed outside their provider dashboards. Generate independent values for `JWT_SECRET`, `CRON_SECRET`, encryption keys, and Preview.

## Gate 5: scheduled and webhook traffic

The Vercel runtime does not start in-process timers. `/api/cron/operations` drains communications and runs the existing operational sweeps through Vercel Cron with `CRON_SECRET` authentication. `/api/cron/health-insights` preserves the weekly, monthly, and daily health-insight schedule in `Europe/Madrid`; Vercel invokes it at the relevant UTC hours and the handler applies the local-time/DST guard. The health-insight function has the Vercel Pro 800-second duration limit.

Before production, review actual health-insight runtimes in Vercel. If a run approaches 800 seconds as the active-user count grows, move the per-user work to Vercel Workflow/Queues before it can time out.

Update external callbacks only after the preview API is healthy:

- Stripe webhook endpoint and signing secret
- ElevenLabs post-call/tool webhook URLs and signing secret
- Twilio SMS, WhatsApp, voice, and status callbacks
- Resend inbound webhook
- Meta OAuth redirect URI

Retain the Replit callbacks as rollback targets until the final domain cutover succeeds.

## Gate 6: application verification

On the protected Vercel preview, verify at minimum:

1. `/api/health` or the current health endpoint returns success.
2. Login, logout, token refresh, and an authenticated API request work.
3. Admin access works for the configured super-admin identity.
4. A read and a reversible write reach the new database.
5. Stripe webhook signature verification works in test mode.
6. One test delivery per enabled channel works without duplicate dispatch.
7. Both cron endpoints reject missing/wrong authorization and succeed with Vercel Cron authorization.
8. A health-insight cron dry run outside the scheduled local hours reports `skipped: true`; a scheduled test run completes within 800 seconds.
9. Browser console and Vercel runtime logs contain no new errors or secret values.

Do not promote a build that has only passed the static frontend check.

## Gate 7: private Sites deployment

The existing frontend calls relative `/api` routes, so a static Sites upload would render but its authenticated features would fail. Keep Sites private and choose one explicit role:

- recommended: a private launch/QA page linking to the protected Vercel preview; or
- a full frontend only after adding a reviewed API-origin/proxy design, CORS policy, cookie/token handling, and end-to-end tests.

Do not present a static mirror as the migrated production application.

## Gate 8: final cutover

1. Announce a maintenance window and stop writes on Replit.
2. Create a fresh final dump with the same `pg_dump` flags used in rehearsal.
3. Restore into the emptied production B2C target.
4. Re-run `db:audit` and `db:compare-cutover`; save the passing output with the release evidence.
5. Deploy the reviewed commit to a staged Vercel production deployment without assigning the domain.
6. Run the production smoke suite against its generated Vercel URL.
7. Point `v2.vyva.life` to the tested Vercel deployment and update the public URL variables/callbacks.
8. Monitor API errors, database connections, cron executions, webhook deliveries, login, and writes.

Rollback during the observation window means restoring the previous DNS/callback targets and reopening writes on Replit. Never allow writes to both databases at once.

## Gate 9: retire Replit

After the agreed observation window (recommended: at least 7 days):

1. Take and securely retain a final database dump.
2. Confirm Vercel has handled all scheduled jobs and webhook traffic for the full window.
3. Stop the Replit deployment first; do not delete it yet.
4. Observe another agreed period and verify rollback is no longer needed.
5. Delete the Replit deployment/database only after a separate, explicit destructive-action approval.

Replit is not considered retired merely because Vercel is reachable. Retirement requires a verified database copy, production traffic on Vercel, callback cutover, scheduled-job coverage, a retained backup, and explicit deletion approval.
