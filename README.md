# Subscription Auditor

![CI](https://github.com/dawsonrtech-ui/subscription-auditor/actions/workflows/ci.yml/badge.svg)

Track subscriptions, detect recurring charges via Plaid, and catch receipts
in Gmail before they turn into forgotten renewals.

## Project layout

```
client/   React + Vite frontend
server/   Express API (Postgres, JWT auth, Plaid, Gmail, email notifications)
```

## Local development

Requires Node 20+ and a local Postgres instance.

```bash
npm install --prefix server
npm install --prefix client
cp server/.env.example server/.env   # fill in DATABASE_URL, JWT_SECRET, etc.
npm run dev                           # runs client + server concurrently
```

## Testing

The server has two complementary test suites:

- **`npm test`** — fast, self-contained tests (`server/test/*.test.mjs`, run
  via [Vitest](https://vitest.dev)) that exercise the real Express routes
  and a real Postgres database, but replace the `plaid` and `googleapis`
  packages with mocked/sandboxed test doubles so no live Plaid or Gmail
  credentials or network access are required.
- **`npm run test:legacy`** — the original live-HTTP suite
  (`server/test-api.mjs`) that boots the actual server process and drives it
  end-to-end over `fetch`.

Both need a reachable Postgres database via `DATABASE_URL`
(`postgresql://user:pass@host:5432/dbname`). For example, with Docker:

```bash
docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16
createdb -h localhost -U postgres subaudit_test   # or: psql -c "CREATE DATABASE subaudit_test"

cd server
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/subaudit_test npm test
```

CI (`.github/workflows/ci.yml`) runs both suites on every push/PR, each
against its own ephemeral `postgres:16` service container:

- `unit-tests` — the mocked Vitest suite (`npm test`)
- `legacy-e2e` — boots the server and runs `npm run test:legacy` against it

## Deployment

See `Dockerfile` / `docker-compose.yml` for a containerized deployment, or
`npm run deploy` to build the client and start the server directly.
