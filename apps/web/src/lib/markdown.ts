import "server-only";
import { defaultSchema } from "hast-util-sanitize";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { rehypeKatexLocal } from "./rehype-katex-local";

/**
 * Markdown → sanitised HTML with mathematics (KaTeX, MathML output) and chemistry (mhchem).
 * Everything that reaches this function is treated as untrusted: learner text, model output,
 * extracted book passages and authored lessons all pass through the same sanitiser.
 *
 * MathML output is chosen deliberately: it needs no inline styles, so the sanitiser can stay
 * strict, and screen readers can read the mathematics.
 */
const mathmlTags = [
  "math",
  "semantics",
  "annotation",
  "mrow",
  "mi",
  "mo",
  "mn",
  "ms",
  "mtext",
  "msup",
  "msub",
  "msubsup",
  "mfrac",
  "msqrt",
  "mroot",
  "mover",
  "munder",
  "munderover",
  "mtable",
  "mtr",
  "mtd",
  "mspace",
  "mpadded",
  "mphantom",
  "menclose",
  "mstyle",
];

const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...mathmlTags, "span", "div", "sup", "sub"],
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "className", "ariaHidden"],
    math: ["display", "xmlns"],
    mo: [
      "stretchy",
      "fence",
      "separator",
      "lspace",
      "rspace",
      "minsize",
      "maxsize",
      "movablelimits",
      "largeop",
      "symmetric",
      "form",
      "accent",
    ],
    mspace: ["width", "height", "depth"],
    mtable: ["columnalign", "rowspacing", "columnspacing", "rowlines", "columnlines", "frame", "displaystyle"],
    mtd: ["columnalign", "columnspan", "rowspan"],
    mpadded: ["width", "lspace", "voffset", "height", "depth"],
    annotation: ["encoding"],
    mstyle: ["scriptlevel", "displaystyle", "mathvariant", "mathsize"],
    mi: ["mathvariant"],
    mtext: ["mathvariant"],
    menclose: ["notation"],
    a: [...(defaultSchema.attributes?.a ?? []), "target", "rel"],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
    src: ["http", "https"],
  },
  clobberPrefix: "md-",
};

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(rehypeKatexLocal)
  .use(rehypeSanitize, schema)
  .use(rehypeStringify);

/**
 * Named environments: a paragraph that starts with `**Definition.**`, `**Theorem (name).**`,
 * `**Example.**`, `**Warning.**` etc. is wrapped in a styled block. Implemented as a light
 * pre-pass on the Markdown so that the result is still plain HTML the sanitiser understands.
 */
const ENV_PATTERN =
  /^\*\*(Definition|Theorem|Lemma|Proposition|Corollary|Example|Non-example|Remark|Warning|Exercise|Proof)(?: \(([^)]+)\))?\.\*\*\s*/;

export async function renderMarkdown(markdown: string): Promise<string> {
  const blocks = markdown.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const html: string[] = [];
  for (const block of blocks) {
    const match = ENV_PATTERN.exec(block);
    if (match) {
      const kind = match[1]!.toLowerCase().replace(/\s+/g, "-");
      const title = match[2] ? `${match[1]} (${match[2]})` : match[1]!;
      const body = block.slice(match[0].length);
      const inner = String(await processor.process(body));
      const cls = ["definition"].includes(kind)
        ? "env-definition"
        : ["example", "non-example"].includes(kind)
          ? "env-example"
          : kind === "warning"
            ? "env-warning"
            : "env-theorem";
      html.push(`<div class="env-block ${cls}"><div class="env-title">${escapeHtml(title)}</div>${inner}</div>`);
    } else {
      html.push(String(await processor.process(block)));
    }
  }
  return html.join("\n");
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
