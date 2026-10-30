# Actions only you can take

Written for a non-specialist. Each item says why it is needed and the exact minimal step.
Nothing here is required to run Corniversity on your own computer.

1. Deploy to Railway (needed for the private website to exist outside your PC).
   Why: the Railway command-line tool on this machine is not signed in and no token is available.
   Step: open PowerShell in the project folder and run `railway login`, then run
   `pnpm deploy:railway`. The script creates a dedicated project with the pgvector PostgreSQL
   template, a web service and a worker service, sets the secrets it generates locally, runs the
   database migrations and prints the private URL. The expected monthly cost is recorded in
   docs/QA_REPORT.md.

2. Enable live AI teaching (optional; the site works without it in reading and notes mode).
   Why: no model-provider key is configured, so tutors currently run on deterministic fixtures.
   Step: create an Anthropic API key, then in Settings → Providers paste it and set a daily and a
   monthly budget. Nothing is charged until you do this.

3. Email delivery (optional). Password reset by email needs an SMTP provider.
   Until then, keep your password safe; the recovery command is `pnpm owner:reset-password`.
