# Production handoff

Local Compose uses HTTP on loopback for synthetic records. Do not expose that
stack publicly. The following gates apply before storing real records. Deployment
and live Neon verification are intentionally separate from the local build.

## Deploy and configure

- Build `web/` using Node 24, `npm ci`, and `npm run build`. Serve `dist/` over
  HTTPS. Preserve the font and license files in `public/`, which Vite copies.
- Build `api/` with the same Node version. Deploy the Fastify service from
  `api/` (entry point `src/server.ts`; for a regular Node host use
  `npm run build && npm start`). On Vercel, use a separate Fastify project
  and forward `/api/*` on the web project to that service without stripping
  `/api`. Do not cache proxied API responses.
- API secrets only: `NODE_ENV=production`, `APP_ORIGIN` set to the exact HTTPS
  frontend origin, a unique random `BETTER_AUTH_SECRET` of at least 32 characters,
  and `DATABASE_URL` for the app's restricted Postgres role. Do not copy
  local credentials or put these values in any frontend build setting.
- Create a separate Neon project for production. Create the `tracker_app` role
  and grant it `CONNECT` on the database and `USAGE` on schema `public`, but not
  schema creation. Apply versioned SQL using a separate migration role and a
  direct TLS connection, not the restricted runtime login. The migration
  runner uses one session and a Postgres advisory lock. From an API build
  environment, mount the migration folder and run `npm run migrate` with
  `MIGRATIONS_DIR` pointing to it and the migration role's `DATABASE_URL`.
  Keep preview deploys off the production database and verify cold-start
  behavior and connection limits on the chosen Neon plan.
- Set response headers on the hosting layer (including for static pages):
  `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, HSTS after
  validating all intended HTTPS routes, and a site-tested CSP limited to the
  same origin for scripts, styles, fonts, images and API calls, with
  `frame-ancestors 'none'` and `object-src 'none'`. Verify these on the
  deployed domain. Keep analytics, trace payload capture, and session replay
  disabled; do not collect health data in request or error logs.
- Apply an edge rate limit to `/api/auth/sign-in/email` so traffic is rejected
  before waking the API/database. The API itself limits sign-in to eight
  attempts per address per 15 minutes and 60 attempts per installation per
  minute. It does not trust client-supplied forwarded IP headers.

## Account provisioning and recovery

Use the account command from a trusted API environment with the production
database configuration. There is no public signup or reset form. Verify who
owns the account before resetting it. Run the same command documented in
the local README with `--reset` before the email to replace a password, revoke
existing sessions, and clear the account's sign-in throttle:

```bash
read -rsp 'New password (12–128 characters): ' TRACKER_PASSWORD; echo
printf '%s' "$TRACKER_PASSWORD" | npm run --silent account -- --reset owner@example.test
unset TRACKER_PASSWORD
```

Type the password without putting it in shell history, and use a secure,
separate channel to hand it to the owner. Test provisioning and recovery with
a synthetic account before onboarding the real account.

## Backup and release gates

- Treat database backups as sensitive: they include observations and account
  data. Verify what the Neon plan retains, and keep encrypted, access-limited
  backups outside Git. Define the backup frequency and retention before launch.
  A JSON user export is not an administrator backup.
- For a rehearsal use `pg_dump --format=custom --no-owner` with the migration
  connection and restore into a separate empty database with
  `pg_restore --exit-on-error --no-owner`. Pre-create required roles in that
  destination. Never restore over production during a test. Verify migration
  versions, auth, periods, notes, preferences, and export/deletion on the
  restored instance. Define how retained backups age out after deletion.
- Local rehearsals tested upgrades through migration 004 with synthetic data
  and restored a dump from migration 003 into a separate Postgres database.
  Rehearse both upgrade and restore on the actual Neon setup. Confirm existing
  journal entries still open Today directly, while a new account sees welcome
  setup after sign-in.
- On the actual HTTPS hostname, verify that sign-in uses a Secure, HttpOnly
  session cookie and that the same-origin API rejects unrelated origins.
  Confirm two accounts cannot access or alter each other's data; verify
  `Cache-Control: no-store`, export, deletion, and session revocation.
- Test the main flow on the target phone: record a start, distinguish the
  forecast and suggested end from history, confirm or correct the end, and
  retry a failed save. Reminders require opening the app; background delivery
  is not part of this release.

Explain to the account owner that the database administrator can access their
records, what gets backed up, and that estimates are not for contraception.
