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

3. Enable live tutoring (optional; everything else works without it).
   Why: no model is configured, so tutors, the assessor and the director answer with a labelled
   scripted demo that does not read your work.
   Step: create an API key in the Anthropic console. In Corniversity open *Settings → Live
   tutoring and its costs*, choose *Anthropic (live model, paid)* and a model, paste the key, set
   the limits, tick *I approve paid use of the selected model within these limits*, and save; the
   notice above the form then reads *Live:* and the model. Each run is refused before it starts if
   its worst case could cross a limit. The worst case counts every byte of the prompt as a token
   (deliberately pessimistic), so it is several times what a turn usually costs: on Claude Opus 5.5
   with fallback on, up to about $1.20 for the assessor on a long submission and $0.80 for a tutor
   turn (about half with fallback off). *Per run* must cover the dearest role you use. Small limits
   that let every role run: $1.50 per run, $3 per day, $10 per month. A run whose cost the provider
   could not report (a lost connection) is held at its worst case under *Settings → Unsettled runs*
   until you enter the amount your Anthropic Console shows for it. An API key from an Anthropic
   Console organization is required; a Claude subscription does not provide one, though some
   include Console credits (see the link in Settings). Model use is billed by Anthropic to that
   account, separately from Railway.

4. Check the signed-in site and live tutoring yourself (after items 1 and 3; about 35 minutes).
   Why: the build agent cannot sign in as you and must not be given your password. Tell it the
   outcome of each step afterwards (never a password, code or key), and it records them as checks
   you ran on the live site.
   a. Sign-in: choose *Sign out* (top right), then open `/campus`; it must send you to sign-in.
      Sign in. Close the browser completely and reopen the site: you are still signed in.
   b. Closed sign-up: `/join` must say *Sign-up is closed*. Then do item 2 and tell the agent; it
      confirms from outside that sign-up is refused and that the code is gone from both services.
   c. One live tutoring turn on open material: in *Library → Sources*, under *9.66J Computational
      Cognitive Science (Fall 2004)*, choose *Import* beside `sept_9_2004.pdf` (its licence permits
      the import and sets the item's AI permission). When the Library shows it processed, open a
      session of COG-201 unit 1 (or any prepared unit of a course you take whose source offers
      *Import*) and ask the tutor: *How does inductive reasoning differ from deductive reasoning?*
      The reply must be headed with the model's name, not *Scripted demo*; a citation under it
      must read *Your library: …, PDF page N*, and that page in the reader must say what the reply
      attributes to it; no *unverifiable citation removed* badge. *Settings → Recent model runs*
      must show the tutor run as *ok* with tokens and a cost (*Tokens in* counts only uncached
      input; the cached prompt is included in the cost).
   d. Limits: set *Per run* to 0.05, save, and send the tutor one more message. It must be refused
      ("This run could cost up to …, above your per-run limit of $0.05") and Recent model runs must
      show *budget blocked* with 0 / 0 tokens and $0.0000. Set *Per run* back; a value not above
      the approved one needs no new approval.
   e. One learning journey, as real work (it stays in your record): in the same session write an
      exercise attempt and choose *Submit attempt*; *Submission v1* gets feedback badged
      *AI assessor ·* and the model. Revise and choose *Submit revision*; *Submission v2* gets its
      own feedback. *Records* lists the attempt with both versions. Sign out and sign in again: the
      versions, the feedback and the tutor conversation are still there, each still labelled with
      what wrote it.
   f. Study workspace and paper (about 5 minutes): in a session choose *Pause*; from *Campus*,
      *Resume* returns to the same place. Under the attempt, attach a phone photo of handwritten
      work, type its transcription with one unsure symbol written as `[[?x]]`, confirm it, then
      submit: the feedback card says *paper work*. With live tutoring on, *Ask for a draft
      transcription* stays disabled until you tick the box to send the page images; nothing is sent before that.
   g. Visual explanations: open NEU-220 unit 1, then *The leaky integrate-and-fire neuron* under
      *Visual explanations*; step through the scenes and play the film (captions under *CC*).
      In MAT-230 unit 1, *Two norms on C([0,1])* stays closed until you have submitted an attempt
      at its exercise or chosen to see the reasoning.
   h. Voice (Chrome sends dictated audio to Google's speech service; skip if you prefer not to):
      *Settings → Voice*, tick the box and *Allow dictation*; in a session choose *Dictate*, speak a
      sentence, correct the text in the box, then send it yourself. *Stop allowing dictation* hides
      the button again. *Read aloud* under a tutor reply uses a voice on your device only.
   i. Operations and proposals: *Operations* (top right) shows the figures for your account.
      *Catalogue → Propose a subject or reading programme* saves a draft; record a decision on each
      overlapping course. Publishing adds a catalogue item at readiness *proposed* (it stays in the
      catalogue); choose *Reject* instead if you only want to see the workflow.
   j. Course preparation with a live model (spends from your budget; only if you want a drafted unit):
      NEU-220 → *Ask for preparation*, keep the budget at $2 or less, *See the proposal*, then
      *Confirm*. A draft appears with its checks; *Publish this unit* or *Reject*.

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
