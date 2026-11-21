# Dottie

A private, mobile-first cycle journal. React + Vite serves the frontend, Fastify owns the API, and only the API connects to Postgres. The included Compose stack is for local development. See the [production handoff](docs/production.md) for the HTTPS and Neon release checks.

## Run locally

Docker with Compose is the only prerequisite; Node, npm and Postgres run in containers.

```sh
# First run only. Do not overwrite this file: the Postgres volume uses these credentials.
test -e .env || (umask 077; sh db/dev-env.sh > .env)
docker compose up --build
```

The app is at [http://localhost:5173](http://localhost:5173). Use that exact origin for local sign-in. Vite proxies `/api` to Fastify. The API and database ports aren't published to the host; `curl http://localhost:5173/api/health` checks the proxy and database connection. Use `docker compose up --build --watch` for live source updates.

In another Bash terminal, provision a **test account**. The password is read from stdin, not a command-line argument or a committed seed file.

```bash
read -rsp 'Test account password (12–128 characters): ' TRACKER_PASSWORD; echo
printf '%s' "$TRACKER_PASSWORD" | docker compose exec -T api npm run --silent account -- journal@example.test
unset TRACKER_PASSWORD
```

Public signup is disabled. The account command deliberately runs inside the API container; there is no public account-creation or password-recovery route. Use synthetic records only in this local stack.

## Code layout

- `web/src/` — Today, Calendar, Insights and Settings, period and daily editors, local reminders and forecast ranges.
- `api/src/` — Fastify HTTP routes and schemas, Better Auth, account provisioning and migration commands.
- `db/migrations/` — Ordered SQL migrations, applied by the one-off Compose migration service. The runtime role cannot change the schema.
- `compose.yaml` — Local frontend, API, migrations and Postgres. The database volume survives `docker compose down`.

After signing in, a new account starts by saving a period start or a quick mood check-in. An unknown period end is not treated as ongoing. Accounts with existing entries skip setup; deleting all tracking data returns the account to welcome.

To apply a new migration to the running local database, run `docker compose run --rm migrate`. Add a new numbered migration instead of editing a migration already applied.

## Local checks

```sh
docker compose exec -T api npm test
docker compose exec -T api npm run build
docker compose exec -T web npm test
docker compose exec -T web npm run build
```

The API test creates and removes two synthetic accounts. Run it only on the local development database. It covers private setup, retry handling, signup restrictions, session recovery, sign-in throttling, settings compatibility, record ownership, export and deletion.

## Data and predictions

- Period dates are recorded separately from optional daily observations (flow, symptoms, mood, sleep, sexual activity, protection and notes). All categories are available without setup. Insights shows symptom totals and highlights symptoms logged in the two days before multiple recent period starts. Missing check-ins are shown separately. Daily observations do not affect the period forecast.
- A typical period length suggests an end date. It stays separate from recorded history until confirmed. Reminders are opt-in and appear on Today; this version does not send notifications when closed.
- Settings can export a JSON copy of all tracking data or delete tracking records and preferences. Deletion keeps the account. Export is a readable copy, not an automated restore workflow.
- Dottie’s forecast uses the [Dochia statistical model](web/vendor/dochia/README.md) to estimate a start range in the browser using only period start dates, after at least four logged starts. Variable history or gaps can suppress the forecast. It does not predict ovulation or identify days to have unprotected sex. It is not contraception.
- The database administrator can access records. Local HTTP is for loopback development only, not real intimate data. No analytics are included.

## Forecast experiment

The [offline forecast benchmark](web/experiments/forecast/README.md) compares the live date-range model with the app’s previous median. The benchmark and research data are not included in the app or API.
