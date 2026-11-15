import "server-only";
import type { Element, ElementContent, Root, RootContent } from "hast";
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

/**
 * Two bases no real page has, with different schemes and hosts. A relative address stays on each;
 * an address that names a scheme or a host leaves at least one of them, whatever the page's own
 * scheme: `https:host/x` reads as relative only against an https base, `//b.invalid/x` stays only on
 * its own host's base.
 */
const LOCAL_BASES = [new URL("http://a.invalid/"), new URL("https://b.invalid/")];

/**
 * Whether an image address stays on this site: a relative path. Anything that names a scheme or
 * another host (`https://…`, `https:host/…`, `//host/…`, `/\host/…`, `data:`) is not; URL parsing
 * decides, as the browser would, against both bases.
 */
export function isSameOriginImage(src: string): boolean {
  return LOCAL_BASES.every((base) => {
    try {
      return new URL(src, base).origin === base.origin;
    } catch {
      return false;
    }
  });
}

/** Whether an address would make a working link: http or https (protocol-relative counts). */
function isWebAddress(src: string): boolean {
  try {
    const { protocol } = new URL(src, LOCAL_BASES[1]);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** What an image from elsewhere becomes: its alternative text, said to be an image that is not shown. */
function imageLabel(image: Element): string {
  const alt = typeof image.properties?.alt === "string" ? image.properties.alt.trim() : "";
  return alt ? `Image not shown: ${alt}` : "Image not shown";
}

/**
 * Images from other sites are never loaded (the production CSP allows images from this site only,
 * so each would also log a violation, and model output could carry one to call out to its host):
 * each becomes a link to its address named by its alternative text, or plain text inside a link or
 * when the address is not a web address (`data:`, `javascript:`), which would make no working link.
 * Relative images, which stay on this site, are kept.
 */
export function rehypeExternalImages() {
  const walk = (children: (RootContent | ElementContent)[], inLink: boolean): (RootContent | ElementContent)[] =>
    children.map((child) => {
      if (child.type !== "element") return child;
      if (child.tagName === "img") {
        const src = typeof child.properties?.src === "string" ? child.properties.src : "";
        if (src && isSameOriginImage(src)) return child;
        const text: ElementContent = { type: "text", value: imageLabel(child) };
        if (inLink || !isWebAddress(src)) return text;
        return { type: "element", tagName: "a", properties: { href: src, rel: ["noopener", "noreferrer"] }, children: [text] };
      }
      child.children = walk(child.children, inLink || child.tagName === "a") as ElementContent[];
      return child;
    });
  return (tree: Root) => {
    tree.children = walk(tree.children, false) as RootContent[];
  };
}

/**
 * After sanitising: a link whose address the sanitiser removed (`javascript:`, `data:`) would still
 * look like a link but go nowhere and take no focus; its text stays, as plain text.
 */
function rehypeUnwrapDeadLinks() {
  const walk = (children: (RootContent | ElementContent)[]): (RootContent | ElementContent)[] =>
    children.flatMap((child): (RootContent | ElementContent)[] => {
      if (child.type !== "element") return [child];
      child.children = walk(child.children) as ElementContent[];
      return child.tagName === "a" && child.properties?.href === undefined ? child.children : [child];
    });
  return (tree: Root) => {
    tree.children = walk(tree.children) as RootContent[];
  };
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(rehypeKatexLocal)
  .use(rehypeExternalImages)
  .use(rehypeSanitize, schema)
  .use(rehypeUnwrapDeadLinks)
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
