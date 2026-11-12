import "server-only";
import type { ElementContent, Root } from "hast";
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

/** The only class names allowed through the sanitiser: what the maths and code renderers emit. */
const ALLOWED_CLASS_NAMES: [string, ...(string | RegExp)[]] = [
  "className",
  "math-inline",
  "math-display",
  "katex",
  "katex-display",
  "katex-mathml",
  "katex-html",
  /^language-./,
];

const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...mathmlTags, "span", "div", "sup", "sub"],
  attributes: {
    ...defaultSchema.attributes,
    // Class names are limited to what the renderer itself emits; otherwise text from a model or
    // a book could borrow any utility class in the bundle and redraw the page.
    "*": [...(defaultSchema.attributes?.["*"] ?? []), ALLOWED_CLASS_NAMES, "ariaHidden"],
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
  .use(namedEnvironments)
  .use(rehypeStringify);

/**
 * Named environments: a paragraph that starts with `**Definition.**`, `**Theorem (name).**`,
 * `**Example.**`, `**Warning.**` etc. is wrapped in a styled block. Implemented as a light
 * transform after sanitising. The document is parsed once, preserving reference definitions,
 * footnotes, lists and fenced code. Titles are text nodes, never raw HTML.
 */
const ENV_PATTERN =
  /^\*\*(Definition|Theorem|Lemma|Proposition|Corollary|Example|Non-example|Remark|Warning|Exercise|Proof)(?: \(([^)]+)\))?\.\*\*\s*/;

export async function renderMarkdown(markdown: string): Promise<string> {
  return String(await processor.process(markdown.replace(/\r\n/g, "\n")));
}

function namedEnvironments() {
  return (tree: Root, file: { value: unknown }) => {
    const source = String(file.value);
    tree.children = tree.children.map((node) => {
      if (node.type !== "element" || node.tagName !== "p") return node;
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (typeof start !== "number" || typeof end !== "number") return node;
      const match = ENV_PATTERN.exec(source.slice(start, end));
      const first = node.children[0];
      if (!match || first?.type !== "element" || first.tagName !== "strong") return node;
      const kind = match[1]!.toLowerCase().replace(/\s+/g, "-");
      const title = match[2] ? `${match[1]} (${match[2]})` : match[1]!;
      const body: ElementContent[] = node.children.slice(1);
      if (body[0]?.type === "text") body[0] = { ...body[0], value: body[0].value.replace(/^\s+/, "") };
      const cls = ["definition"].includes(kind)
        ? "env-definition"
        : ["example", "non-example"].includes(kind)
          ? "env-example"
          : kind === "warning"
            ? "env-warning"
            : "env-theorem";
      return {
        type: "element",
        tagName: "div",
        properties: { className: ["env-block", cls] },
        children: [
          { type: "element", tagName: "div", properties: { className: ["env-title"] }, children: [{ type: "text", value: title }] },
          { ...node, children: body },
        ],
      };
    });
  };
}
