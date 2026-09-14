# Cross-Pillar Manual QA Pass v1

Date: 2026-07-21

## Scope

Manual QA target flows:

- Health: symptoms, vitals, prevention, visual scan, doctor next step
- Meds: tracking, adherence, cautious pharmacy/OTC support
- Concierge: transport, OTC pharmacy, home service, shopping, provider search
- Community: social rooms and shared plans
- Learning: lesson flow and read-aloud controls
- Mind & Memory: game entry and result/resume behavior
- Safe Home: home worry, scam review, visual/document scan

Each flow must be checked for:

- missing setup behavior
- provider/tool readiness
- final confirmation before external action
- receipt or confirmation moment
- resume from Home or original screen
- language and tone clarity

## Current Evidence

- Local client started successfully on `http://127.0.0.1:5184/`.
- Public landing page rendered successfully in the in-app browser.
- Protected user routes redirect to `/login` in the current local session.
- Admin workflow QA runner route redirects to `/admin/login` in the current local session.
- Backend initially failed because local dependencies were stale; `npm install` restored the declared `resend` package.
- Backend then needed regenerated Prisma client; `npx prisma generate --schema prisma/schema.prisma` succeeded.
- Backend still cannot support authenticated QA in this Codex shell because no `DATABASE_URL` is available to this process. In Replit, this can be supplied by Secrets instead of a literal `.env` file.

## Status

Runtime manual QA is not yet complete.

Current manual statuses should remain `not_tested` or `needs_review` until an authenticated test user/admin session and reachable local database are available.

## Blocker

Manual pass is blocked in this Codex shell by local QA environment setup:

- missing injected or `.env`-backed `DATABASE_URL`
- no authenticated senior test session
- no authenticated admin session for `/admin/workflows`

## Next Required Step

Set up a local QA environment with:

- reachable database configured through Replit Secrets or a local `.env`
- test senior account
- approved admin account

Run the preflight before starting the manual pass:

```bash
npm run qa:manual:preflight
```

The manual pass should not be treated as valid until the preflight confirms:

- a runtime environment source is available, either Replit Secrets or `.env`
- `DATABASE_URL` connects to PostgreSQL
- `users` and `profiles` tables exist
- a known senior QA account is available
- a known admin QA account is available

Then run the admin Manual QA runner and record pass/fail/needs-review for the high-risk flows first:

- Symptoms
- Visual scan
- Meds
- Doctor next step
- Safe Home
- Transport
- OTC pharmacy
- Home service
