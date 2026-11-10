# Visual explanations: author, check, render, review, publish

A visual explanation is a storyboard (`visual.json`) whose plots are drawn from the same values its
numerical checks use, with an optional film recorded from that exact storyboard. Each lives in
`content/visuals/<slug>/`, and the folder name must equal its `slug`.

1. **Author** `visual.json` against `VisualSpec` (`packages/core/src/visuals/visual.ts`):
   - `unitIds`, `sourceLocatorIds` and `revealsExerciseIds` must name existing records.
   - Each scene lasts at most 30 seconds, and a storyboard has at most 12 scenes.
   - Every plot needs a `plotDescription` in words.
   - An answer-revealing visual lists its exercises in `revealsExerciseIds`. It then stays closed
     until the learner has attempted one of them.
   - Start at `"status": "draft"`. Drafts are never offered to the learner.
2. **Check:** `pnpm content:validate` runs the checks (`runVisualChecks`) and the rules in
   `packages/content/src/validate.ts`. A `checked` or `published` visual that fails a check is an
   error. The plot and check kinds are fixed in `visual.ts`, so a new kind of topic needs a new kind
   there, with its own test.
3. **Render (optional):** run `pnpm visuals:render <slug>` on this computer. It refuses a draft or a
   failing visual, records the film with Playwright, and writes `render/film.webm`,
   `render/captions.vtt` and `render/render.json`. The film is current only while the storyboard's
   hash matches `render.json`. Change the storyboard and the film is withheld until you render it
   again.
4. **Review:** set `"status": "checked"` once the checks pass. Only that status is claimed: the
   viewer says no second reader has reviewed it. To publish, a second reader goes through the
   storyboard, its checks and the film against the unit and its sources, then records:

   ```json
   "review": { "by": "Name", "on": "2026-11-10", "notes": "What was read and what was found." }
   ```

5. **Publish:** set `"status": "published"`. The validator refuses `published` without a `review`.
   Content is seeded by `pnpm db:seed` locally, and on Railway by the worker on start
   (`SEED_CONTENT_ON_START=1`). Both refuse content with validation errors. A film is stored only if
   it is current, and a replaced film's blob is deleted.

The status, the review and the render record are not part of the storyboard hash, so reviewing or
publishing does not invalidate a film.
