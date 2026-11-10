/**
 * Records a short film of a visual explanation's storyboard, locally:
 *
 *   pnpm visuals:render <slug> [<slug> ...]
 *
 * Each scene is laid out as a 1280×720 slide (title, typeset equations, the plot drawn from the same
 * samples its checks use, and the caption as on-screen text), shown for its stated duration and
 * recorded by Playwright's Chromium. The film, its WebVTT captions and a render record naming the
 * storyboard it was made from are written to content/visuals/<slug>/render/. A storyboard edited
 * afterwards no longer matches the record, so the old film is withheld until it is recorded again.
 * Nothing here calls a model or a network service.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { defaultContentRoot, loadContent } from "../packages/content/src/load";
import {
  captionsVtt,
  filmIsCurrent,
  type PlotSpec,
  plotGeometry,
  runVisualChecks,
  storyboardHash,
  totalDuration,
  type VisualRender,
  type VisualSpec,
} from "../packages/core/src/visuals/visual";

const repo = resolve(import.meta.dirname, "..");
const webRequire = createRequire(join(repo, "apps", "web", "package.json"));
const katex = webRequire("katex") as { renderToString: (tex: string, options: Record<string, unknown>) => string };
const katexCss = pathToFileURL(webRequire.resolve("katex/dist/katex.min.css")).href;
const playwrightVersion = (createRequire(join(repo, "package.json"))("@playwright/test/package.json") as { version: string }).version;

/** The light register's colour roles, read from the application's own stylesheet. */
function themeTokens(): string {
  const css = readFileSync(join(repo, "apps", "web", "src", "app", "globals.css"), "utf8");
  const root = /:root\s*\{([^}]*)\}/.exec(css)?.[1];
  if (!root) throw new Error("no :root block in globals.css");
  return `:root{${root}}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const STROKES = ["var(--brass)", "var(--slate)", "var(--moss)", "var(--rust)"];
const DASHES = ["", "7 4", "2 3", "10 3 2 3"];

function plotSvg(plot: PlotSpec): string {
  const g = plotGeometry(plot, 640, 380);
  const parts: string[] = [];
  if (g.area) parts.push(`<path d="${g.area}" fill="var(--brass-soft)" class="fade"/>`);
  for (const t of g.yTicks) {
    parts.push(`<line x1="${g.frame.left}" x2="${g.frame.right}" y1="${t.y}" y2="${t.y}" stroke="var(--stone)"/>`);
    parts.push(`<text x="${g.frame.left - 8}" y="${t.y + 5}" text-anchor="end">${esc(t.label)}</text>`);
  }
  for (const t of g.xTicks) parts.push(`<text x="${t.x}" y="${g.frame.bottom + 20}" text-anchor="middle">${esc(t.label)}</text>`);
  parts.push(`<line x1="${g.frame.left}" x2="${g.frame.right}" y1="${g.frame.bottom}" y2="${g.frame.bottom}" stroke="var(--ink-3)"/>`);
  parts.push(`<line x1="${g.frame.left}" x2="${g.frame.left}" y1="${g.frame.top}" y2="${g.frame.bottom}" stroke="var(--ink-3)"/>`);
  for (const guide of g.guides) {
    parts.push(
      `<line x1="${g.frame.left}" x2="${g.frame.right}" y1="${guide.y}" y2="${guide.y}" stroke="var(--rust)" stroke-dasharray="4 4"/>`,
    );
    parts.push(`<text x="${g.frame.right}" y="${guide.y - 6}" text-anchor="end" fill="var(--rust)">${esc(guide.label)}</text>`);
  }
  g.series.forEach((s, i) => {
    const dash = DASHES[i % DASHES.length] ? ` stroke-dasharray="${DASHES[i % DASHES.length]}"` : "";
    parts.push(`<path d="${s.d}" fill="none" stroke="${STROKES[i % STROKES.length]}" stroke-width="2.5"${dash} class="fade"/>`);
  });
  parts.push(`<text x="${(g.frame.left + g.frame.right) / 2}" y="${g.height - 6}" text-anchor="middle">${esc(g.xLabel)}</text>`);
  const midY = (g.frame.top + g.frame.bottom) / 2;
  parts.push(`<text x="14" y="${midY}" text-anchor="middle" transform="rotate(-90 14 ${midY})">${esc(g.yLabel)}</text>`);
  const legend = g.series
    .map((s, i) => {
      const dash = DASHES[i % DASHES.length] ? ` stroke-dasharray="${DASHES[i % DASHES.length]}"` : "";
      return `<span><svg width="30" height="8"><line x1="0" x2="30" y1="4" y2="4" stroke="${STROKES[i % STROKES.length]}" stroke-width="2.5"${dash}/></svg>${esc(s.label)}</span>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${g.width} ${g.height}" width="${g.width}" height="${g.height}">${parts.join("")}</svg><div class="legend">${legend}</div>`;
}

function filmHtml(spec: VisualSpec): string {
  const scenes = spec.scenes
    .map((s, i) => {
      const equations = s.equations.map((e) => katex.renderToString(e, { displayMode: true, throwOnError: true, output: "html" })).join("");
      const plot = s.plot ? plotSvg(s.plot) : "";
      return `<section class="scene" data-seconds="${s.durationSeconds}">
  <header><span class="count">${i + 1}/${spec.scenes.length}</span> ${esc(s.title)}</header>
  <div class="body${plot ? " with-plot" : ""}"><div class="eqs">${equations}</div>${plot ? `<div class="plot">${plot}</div>` : ""}</div>
  <p class="caption">${esc(s.caption)}</p>
</section>`;
    })
    .join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="${katexCss}">
<style>${themeTokens()}
html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:var(--paper);color:var(--ink);font-family:system-ui,"Segoe UI",sans-serif}
.title{position:absolute;top:22px;left:48px;right:48px;font-family:Georgia,serif;font-size:20px;color:var(--brass)}
.scene{display:none;position:absolute;inset:64px 48px 32px}
.scene.on{display:flex;flex-direction:column}
header{font-family:Georgia,serif;font-size:34px}
.count{color:var(--ink-3);font-size:24px}
.body{flex:1;display:flex;align-items:center;justify-content:center;gap:32px;font-size:26px}
.body.with-plot .eqs{flex:0 0 40%;font-size:22px}
.plot svg text{font-size:14px;fill:var(--ink-2)}
.legend{display:flex;gap:18px;font-size:16px;color:var(--ink-2);justify-content:center}
.legend span{display:inline-flex;align-items:center;gap:6px}
.caption{margin:0;font-size:24px;line-height:1.4;max-width:1100px;padding:14px 18px;background:var(--paper-2);border:1px solid var(--stone);border-radius:6px}
.scene.on .fade{animation:fade .6s ease-out both}
@keyframes fade{from{opacity:0}to{opacity:1}}
</style></head><body><div class="title">${esc(spec.title)}</div>
${scenes}
<script>
const scenes=[...document.querySelectorAll('.scene')];
let i=0;
function show(){scenes.forEach((s,j)=>s.classList.toggle('on',j===i));}
function next(){show();const ms=Number(scenes[i].dataset.seconds)*1000;i++;if(i<scenes.length)setTimeout(next,ms);else setTimeout(()=>{document.body.dataset.done='1'},ms);}
window.startFilm=next;show();
</script></body></html>`;
}

async function render(spec: VisualSpec, dir: string): Promise<void> {
  if (spec.status === "draft") throw new Error(`${spec.slug} is a draft; record only checked storyboards`);
  const failed = runVisualChecks(spec).filter((c) => !c.passed);
  if (failed.length) throw new Error(`${spec.slug} fails its checks: ${failed.map((f) => f.id).join(", ")}`);
  const work = mkdtempSync(join(tmpdir(), "visual-film-"));
  try {
    const page = join(work, "film.html");
    writeFileSync(page, filmHtml(spec), "utf8");
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: work, size: { width: 1280, height: 720 } },
    });
    const tab = await context.newPage();
    // The recording starts with the page; the first scene's timer starts later.
    const recordingStarted = Date.now();
    await tab.goto(pathToFileURL(page).href);
    await tab.evaluate(() => document.fonts.ready);
    const leadInSeconds = Math.round((Date.now() - recordingStarted) / 10) / 100;
    await tab.evaluate(() => (window as unknown as { startFilm: () => void }).startFilm());
    await tab.waitForFunction(() => document.body.dataset.done === "1", undefined, { timeout: (totalDuration(spec) + 30) * 1000 });
    const video = tab.video();
    await context.close();
    const out = join(dir, "render");
    mkdirSync(out, { recursive: true });
    await video?.saveAs(join(out, "film.webm"));
    await browser.close();
    writeFileSync(join(out, "captions.vtt"), captionsVtt(spec, leadInSeconds), "utf8");
    const { render: _old, ...storyboard } = spec;
    const record: VisualRender = {
      file: "film.webm",
      captionsFile: "captions.vtt",
      storyboardHash: storyboardHash(storyboard),
      durationSeconds: totalDuration(spec),
      renderedAt: new Date().toISOString(),
      tool: `Playwright ${playwrightVersion} (Chromium screen recording)`,
      leadInSeconds,
    };
    writeFileSync(join(out, "render.json"), `${JSON.stringify(record, null, 2)}\n`, "utf8");
    if (!filmIsCurrent({ ...storyboard, render: record })) throw new Error("the render record does not match the storyboard");
    console.log(`${spec.slug}: recorded ${record.durationSeconds} s to ${join(out, "film.webm")}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

const slugs = process.argv.slice(2);
if (slugs.length === 0) {
  console.error("usage: pnpm visuals:render <slug> [<slug> ...]");
  process.exit(1);
}
const bundle = loadContent(defaultContentRoot());
for (const slug of slugs) {
  const visual = bundle.visuals.find((v) => v.spec.slug === slug);
  if (!visual) {
    console.error(`no visual ${slug} in content/visuals`);
    process.exit(1);
  }
  await render(visual.spec, visual.dir);
}
