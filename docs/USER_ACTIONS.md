# Actions only you can take

Written for a non-specialist. Each item says why it is needed and the exact minimal step.
Nothing here is required to run Corniversity on your own computer. Never paste a password, the
bootstrap code or an API key into a chat.

1. Create your owner account on the live site (once).
   Why: Corniversity is deployed at https://web-production-4c692.up.railway.app, and nobody can
   use it until the owner account exists.
   Step: in the Railway dashboard open the project `corniversity`, the service `web`, then
   *Variables*, and reveal `OWNER_BOOTSTRAP_CODE`. Open
   https://web-production-4c692.up.railway.app/join and fill in your name, the owner email
   (the deployment's `OWNER_EMAIL` variable, beside the code), a password of at least twelve
   characters, and the code. Choose *Create account and begin*; orientation starts, and sign-up
   closes for good.

2. Retire the bootstrap code (after item 1).
   Why: once the owner exists the code can no longer create an account, but it need not stay in
   the deployment either.
   Step: in the Railway dashboard delete the variable `OWNER_BOOTSTRAP_CODE` from the service
   `web` and from the service `worker`. Each service restarts on its own; nothing else changes.
   Alternatively, tell the build agent that the account exists and approve it doing this.

3. Let the build agent check the signed-in site (after item 1, optional).
   Why: the checks behind sign-in (a study session, the notebook, a laboratory, the library, the
   studio) have so far run only on the build machine, because the live site has no account yet.
   Step: either walk through them yourself (sign in, open a session from the Timetable, write a
   notebook entry, run a laboratory, open the Library, start a studio project), or give the agent
   a signed-in browser session it may use. It must not be given your password.

4. Enable live tutoring (optional; everything else works without it).
   Why: no model is configured, so tutors, the assessor and the director answer with a labelled
   scripted demo that does not read your work.
   Step: create an API key in the Anthropic console. In Corniversity open *Settings → Live
   tutoring and its costs*, choose *Anthropic (live model, paid)* and a model, paste the key, keep
   or lower the limits per run, per day and per month, tick *I approve paid use of the selected
   model within these limits*, and save. Model use is billed by Anthropic to that account,
   separately from Railway. Then tell the build agent the test budget you authorise (for example
   $2), and it will run one small live check and record the result.

5. If you forget your password.
   Why: no email provider is configured, so there is no reset link; recovery is deliberately
   possible only for someone who controls the Railway project.
   Step: in PowerShell in the project folder run `railway ssh --service worker`, then in that
   shell `node node_modules/tsx/dist/cli.mjs apps/worker/src/admin/reset-owner-password.ts`.
   Type the new password twice (it is not shown); every signed-in browser is signed out. On your
   own computer the same command is `pnpm owner:reset-password`.

6. Publish the private GitHub repository (optional; the code is committed locally).
   Why: the build agent's attempt to create the repository was blocked by your approval
   controls, which treat repository creation as a sharing action.
   Step: in PowerShell in the project folder run
   `gh repo create Corniversity --private --source=. --remote=origin --push`
   (you are already signed in to GitHub as Tensored-Flow on this machine).

7. Optional decisions.
   - Psych-101, the dataset behind Centaur, is about 859 MB and stays undownloaded: say if you
     want a small labelled sample fetched for an exercise.
   - Library → Books to obtain lists the three sources still missing from the programme you
     follow (leads for COG-250 and COG-260). Add any you want to your list; nothing is fetched.
