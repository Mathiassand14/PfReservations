# Running Tests with Docker Compose

This repo includes a test-ready Compose setup that runs all Jest tests against a clean Postgres DB and persists readable logs for debugging.

## One‑liner

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml up \
  --build --abort-on-container-exit --exit-code-from app-test
```

- Builds a test image (`Dockerfile.test`)
- Waits for DB, runs migrations, runs Jest once (in‑band)
- Persists logs to `.data/test-logs/`

## Where logs live

- Latest run: `.data/test-logs/latest/`
  - Console log: `jest-console.log`
  - Machine‑readable: `jest-results.json`
  - Pointer to timestamped dir: `run-dir.txt`
- Historical runs: `.data/test-logs/<UTC-timestamp>/`

Open the console log to scan failures quickly:

```bash
less +G .data/test-logs/latest/jest-console.log
```

## Rebuild tips

- Force a clean rebuild (pick up server/service changes):

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml build --no-cache
```

## Run a specific test file or pattern

You can override the test command interactively:

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm app-test \
  sh -lc "node bin/wait-for-db.js && npm run migrate && npx jest tests/integration/api.test.js --runInBand --detectOpenHandles"
```

Or use a pattern:

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml run --rm app-test \
  sh -lc "node bin/wait-for-db.js && npm run migrate && npx jest --runInBand --detectOpenHandles \"tests/integration/.*\\.test\\.js\""
```

## Local (non‑Docker) run with saved logs

```bash
npm run test:ci
# Logs created under .data/test-logs/<timestamp>/ and .data/test-logs/latest/
```

## Environment knobs

- DB wait (if your DB starts slowly):
  - `DB_WAIT_ATTEMPTS` (default 60)
  - `DB_WAIT_DELAY_MS` (default 1000)
- Set in `docker-compose.test.yml` or via `-e` on the command line.

## Cleanup

```bash
rm -rf .data/test-logs
```

## Notes

- The test DB uses an ephemeral tmpfs volume to avoid stale data between runs.
- The app does not bind to a port during Jest runs (prevents EADDRINUSE).
- If tests still fail early, check `.data/test-logs/latest/jest-console.log` for the first error; it usually cascades.

