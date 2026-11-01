# Actions only you can take

Written for a non-specialist. Each item says why it is needed and the exact minimal step.
Nothing here is required to run Corniversity on your own computer.

1. Create your owner account on the live site (once).
   Why: Corniversity is deployed at https://web-production-4c692.up.railway.app, and nobody can
   use it until the owner account exists.
   Step: open https://web-production-4c692.up.railway.app/join and fill in your name, the owner
   email from your `.env`, a password of at least twelve characters, and the one-time code. The
   code was given to you in the chat when the site was deployed; it is also the
   `OWNER_BOOTSTRAP_CODE` variable of the `web` service in the Railway dashboard. Choose *Create
   account and begin*; orientation starts, and sign-up closes for good. The site costs about $10
   to $25 a month on Railway's Hobby plan (docs/HANDOFF.md).

2. Enable live AI teaching (optional; the site works without it in reading and notes mode).
   Why: no model-provider key is configured, so tutors currently run on deterministic fixtures.
   Step: create an Anthropic API key, then in Settings → Providers paste it and set a daily and a
   monthly budget. Nothing is charged until you do this.

3. Email delivery (optional). Password reset by email needs an SMTP provider.
   Until then, keep your password safe; the recovery command is `pnpm owner:reset-password`.

4. Publish the private GitHub repository (optional; the code is complete and committed locally).
   Why: the build agent's attempt to create the repository was blocked by your approval
   controls, which treat repository creation as a sharing action.
   Step: in PowerShell in the project folder run
   `gh repo create Corniversity --private --source=. --remote=origin --push`
   (you are already signed in to GitHub as Tensored-Flow on this machine).

5. Send the rest of the Mind, Brain and AI update.
   Why: the message arrived cut off after section 12, at the heading "13. PRODUCT E…". Sections
   13 onward were not received, so nothing in them is implemented.
   Step: paste the remaining sections in a new message.

6. Two optional decisions the update raised.
   - Psych-101, the dataset behind Centaur, is about 859 MB, so it was not downloaded: say if you
     want a small labelled sample fetched for an exercise.
   - Library → Books to obtain now lists the sources still missing from the programme you follow
     (three leads, for COG-250 and COG-260). Add any you want to your list; nothing is fetched.
