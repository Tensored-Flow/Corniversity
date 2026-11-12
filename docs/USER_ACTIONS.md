# Actions only you can take

Written for a non-specialist. Each item says why it is needed and the exact minimal step. Never
paste a password, the bootstrap code, an API key or any token into a chat. Your Corniversity
sign-in and any sign-in with a model provider are separate: one never stands in for the other.

The hosted app and the earlier local owner installation have separate databases. The Linux build/QA stack is a third, disposable test environment:

- **The hosted site:** https://web-production-4c692.up.railway.app, reachable from any device.
  It teaches with an Anthropic API key, or with the labelled scripted demo.
- **Your earlier local owner installation:** on its original computer, at http://127.0.0.1:3300. It has its own
  database, separate from the hosted site and from the test stack. It is the only place you can
  teach through your ChatGPT plan.

## 1. Sign in to the existing hosted owner account

The owner account exists: verified read-only on 12 November 2026. Open https://web-production-4c692.up.railway.app/sign-in and use your existing credentials. Do not create a replacement account or reset the password as part of this release. If an agent needs the signed-in browser to enrol the five selected courses, sign in there and return to the chat; never paste credentials into the chat.

## 2. Retire the bootstrap code (after item 1)

In Railway, delete `OWNER_BOOTSTRAP_CODE` from service `web` and from service `worker`. Each
restarts by itself. Then tell the build agent: it checks from outside that sign-up is refused and
that the variable is gone. It checks variable names only, never values.

## 3. Choose who teaches

Everything works without a model except marking: notes, problem sheets and exams open, and exam answers wait unmarked.

### 3a. Hosted site: an Anthropic API key (optional; paid)

1. Create a key in the Anthropic Console.
2. Open *Settings → Teacher*. Choose *Anthropic API key (paid)* and a model.
3. Paste the key and set your limits. Small limits that let every role run: $1.50 a run, $3 a day,
   $10 a month.
4. Tick *I approve paid use…* and save. The notice should now read *Live:* and the model's name.

Each run is refused before it starts if its worst case could cross any limit. That includes course
preparation: its own budget (at most $20) is a further ceiling inside your limits, never a
replacement for them. Nothing here buys credits or turns on automatic reloads.

### 3b. Local installation: your ChatGPT plan (optional)

OpenAI documents ChatGPT plan usage for open-source and locally hosted apps. A remotely hosted
app, like the Railway site, must apply through OpenAI's interest form, so the hosted site does not
offer it.

Corniversity is a private app running on your own computer. OpenAI decides on its own consent page
whether to accept it. If OpenAI reports that plan usage is not available for your account,
Corniversity pauses and does not retry.

1. In PowerShell, in the project folder, start the database: `pnpm db:local`. Leave the window open.
2. In a second window, start the installation: `pnpm local:owner`. Wait for *Ready*, then open
   http://127.0.0.1:3300. Use that exact address, not `localhost`.
3. First time only: create your account at `/join`. Use the owner email and bootstrap code from
   your `.env` file, not Railway's.
4. Open *Settings → Teacher*. Choose *Your ChatGPT plan* and save.
5. In the *ChatGPT plan* card, choose *Continue with ChatGPT*.
6. On OpenAI's page, sign in and allow plan usage. The app registers as "Corniversity"; you may
   rename it. Back in Settings you should see *connected* and your ChatGPT email.
7. Choose a model from your account's list.
8. Keep or lower the request limits: 30 a day and 300 a month by default.
9. Tick *I approve teaching through my ChatGPT plan…* and save.

How it behaves once connected:
- **Cost:** requests count against your plan's usage, and its credits balance if it has one, never
  against an API key. On Plus, the five-hour limit is shared with every other app that uses your
  plan.
- **Usage limits:** when OpenAI reports a usage limit, plan requests pause. They resume only when
  you choose *Resume plan requests*. *Manage usage* opens ChatGPT's usage settings.
- **Failures:** a failed request keeps your message. It is never answered by another provider or by
  scripted text.
- **Signing out:** choose *Sign out of ChatGPT here*. This revokes the session and deletes the
  tokens on this computer. You can also disconnect Corniversity in ChatGPT's settings.
- **Where the tokens live:** only in owner-only files under `~/.config/corniversity/chatgpt-plan`.
  They are never in the database or the browser.

## 4. The owner acceptance journey (about 35 minutes)

Do this on the hosted site with 3a, or in the local installation with 3b. In the local
installation, "a second device" means a second browser on this computer, because the local
installation is not reachable from other devices. This is your real work and stays in your record.

Afterwards, tell the build agent what you saw at each step, never a password, code or key. It
records them as checks you ran.

1. **Account and bootstrap code.**
   - Sign out from the top right, then open `/campus`: it must send you to sign-in. Sign in again.
   - Open `/join`: it must say *Sign-up is closed*.
   - Complete item 2, and tell the agent so that it can confirm from outside.
2. **The teacher connection.**
   - *Settings → Teacher* must read *Live:* and the model (3a), or *Your ChatGPT plan:* and the model
     (3b).
   - The tutor's badge in a session must say the same, never *scripted demo*.
3. **A source-backed question.**
   - In *Library → Sources*, under *9.66J Computational Cognitive Science (Fall 2004)*, choose
     *Import* beside `sept_9_2004.pdf`. Wait until the Library shows it processed.
   - Take COG-201 from the catalogue, choose *Tutorial* on unit 1, and ask: *How does inductive
     reasoning differ from deductive reasoning?*
   - The reply must be headed with the model, and must carry a citation reading *Your library: …,
     PDF page N*.
   - Open that page: it must say what the reply attributes to it.
4. **A handwritten attempt with an ambiguous symbol.**
   - Take MAT-230, open unit 1's *Problem sheet*, and choose *Start* on *Two norms on C([0,1])*.
   - Under the attempt, open *Working on paper?* and attach a phone photo of handwritten work.
   - Write the transcription, marking one symbol you are unsure of as `[[?ε or e]]`. With a
     teacher connected you may instead tick the consent box and choose *Ask for a draft
     transcription*. Nothing is sent before that tick.
   - *Confirm* must refuse ("Please confirm this symbol first…"). Replace the mark with what you
     wrote, confirm, then submit.
   - *Submission v1* must receive feedback marked *paper work* and labelled with what wrote it.
5. **Feedback and revision.**
   - Revise the attempt and choose *Submit revision*.
   - *Submission v2* must receive its own feedback, while v1 keeps its feedback unchanged.
6. **An exam (optional).**
   - On a course page, under *Exam*, set the questions and minutes and choose *Start exam*. Answer,
     then *Submit exam*. Each answer gets a score once the teacher has marked it, and a worked
     solution where the problem's author releases one.
7. **Resume on a second device.**
   - On the first device, choose *Pause* in the session.
   - On a phone (hosted) or a second browser (local), sign in. *Your courses → Continue → Resume*
     must open the same session and problem, with your draft.
8. **Both attempts and their sources are kept.**
   - Unit 1's *Problem sheet* must show the problem as *submitted*; opening it shows v1 and v2, each
     with its pages, its confirmed transcription and its feedback.
   - The tutor conversation's citation must still open the source page.
   - Sign out and back in: everything is unchanged.

## 5. Backups

What the agent has already done:
- **Source code:** dated, verified git bundles in `C:\Users\leona\Documents\Corniversity-backups\`,
  each with a `.sha256` checksum. They are on this computer only.

What only you can do:
- **Hosted records and uploads:** the hosted site keeps both in its Postgres volume
  (`postgres-volume`). In Railway, open *Postgres → Backups* and check that a schedule exists.
  Enabling one may affect billing, so the choice is yours.
- **Local installation records and uploads:** run `pnpm local:owner backup`. It writes one file
  plus a `.blobs` folder under your data folder's `owner-installation\exports\backups`. Keep them
  together. A restore of this kind was rehearsed on test data; see `QA_REPORT.md`.
- **Off this computer:** copy the bundles and those backup files to a place you trust, such as an
  external drive or a private cloud folder. None of this is copied anywhere automatically.

## 6. If you forget your password

No email provider is configured, so there is no reset link. Recovery needs control of the Railway
project.

- **Hosted site:** in PowerShell, in the project folder, run `railway ssh --service worker`. In that
  shell, run `node node_modules/tsx/dist/cli.mjs apps/worker/src/admin/reset-owner-password.ts`.
- **On this computer:** run `pnpm owner:reset-password`.

Type the new password twice; it is not shown. Every signed-in browser is signed out.

## 7. GitHub repository (done)

The source is at https://github.com/Tensored-Flow/Corniversity, branch `main`, as the remote
`origin`. The repository is public: secrets stay in `.env` (ignored) and in Railway's variables,
never in a commit. Push new commits with `git push`.

## 8. Optional decisions

- **Psych-101 (about 859 MB):** it stays undownloaded. Say if you want a small labelled sample
  fetched.
- **Books to obtain:** *Library → Books to obtain* lists the sources still missing from the
  programme you follow. Nothing is fetched.
