# Connection setup

## Jira OAuth 2.0 (3LO)

Create an Atlassian OAuth app and configure the callback URL as:

`https://<release-assistant-host>/api/auth/jira/callback`

Use the minimum read scopes required by the connector:

- `read:jira-work` to read projects, versions, issues, status, type, assignee, and update times.
- `read:jira-user` only when your Jira tenant requires it to resolve assignee identity.
- `offline_access` so the server can refresh access without asking the user to reconnect each session.

Set `JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET`, and `JIRA_REDIRECT_URI`. Tokens are encrypted with `CONNECTION_ENCRYPTION_KEY` and are never sent to browser components.

## GitHub App

Create a GitHub App, install it only on repositories used for releases, and set:

- Repository metadata: read (mandatory GitHub baseline).
- Contents: read, for release-branch commit identity.
- Pull requests: read, for merge/review/target-branch evidence.
- Checks: read, for required-check outcomes.
- Actions: read and write; write is used only for a user-confirmed re-run of failed jobs.

Configure the setup/callback URL as `https://<release-assistant-host>/api/auth/github/callback`. Set `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_APP_SLUG`.

## Application secrets

- `SESSION_SECRET`: at least 32 random bytes; signs the HTTP-only session cookie.
- `CONNECTION_ENCRYPTION_KEY`: base64-encoded 32-byte key used for provider credentials.
- `DATABASE_URL`: PostgreSQL connection used by the server only.

Rotate a compromised key or provider secret immediately and reconnect affected installations. Never add `.env.local` to source control.
