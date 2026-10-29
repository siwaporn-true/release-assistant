# Release Decision Assistant

A blocker-first dashboard for Dev teams preparing a build for QA regression on Preprod. Jira Fix Version is the release scope, GitHub pull requests prove code readiness, and GitHub Actions proves that the current release commit built successfully.

The application answers one question first: **is this release ready to hand off to QA?** It does not deploy to production, run QA tests, or inspect/download build artifacts.

## Run locally

Requirements: Node.js 22+, pnpm 11+, and PostgreSQL.

```bash
cp .env.example .env.local
pnpm install --frozen-lockfile
pnpm db:generate
# Apply the SQL files in drizzle/ to your database using your deployment's migration runner.
pnpm dev
```

Open `http://localhost:3000`, connect Jira and the GitHub App at `/setup`, then choose a Project, Fix Version, and release branch at `/releases/new`.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
```

See [connection setup](docs/operations/connections.md) and [release policy](docs/operations/release-policy.md) for permissions and operating rules.
