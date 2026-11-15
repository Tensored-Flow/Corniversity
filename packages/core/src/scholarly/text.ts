/**
 * Provider strings (titles, abstracts, author names, venue names, licence labels) are third-party
 * text: OpenAlex and Crossref ship them unsanitised, Crossref abstracts are JATS XML and titles
 * carry inline HTML or MathML. `providerText` turns any of them into plain text that is safe to
 * render as text or to pass through the Markdown pipeline (no raw HTML), keeping `$…$` maths as
 * written. It never produces markup: the output is meant to be escaped when rendered.
 */

/** Longest input considered; longer strings are cut before any processing. */
const MAX_INPUT = 200_000;
export const DEFAULT_PROVIDER_TEXT_LIMIT = 20_000;

/** Elements whose content is not text (removed with their content). */
const DROP_WITH_CONTENT = ["script", "style", "iframe", "object", "embed", "noscript", "template", "svg", "head"];
/** Element names stripped as markup (HTML inline/block, JATS, MathML); anything else stays text. */
const KNOWN_ELEMENTS = new Set(
  [
    ...DROP_WITH_CONTENT,
    "a",
    "abbr",
    "b",
    "big",
    "blockquote",
    "body",
    "br",
    "caption",
    "cite",
    "code",
    "dd",
    "del",
    "dfn",
    "div",
    "dl",
    "dt",
    "em",
    "font",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "html",
    "i",
    "img",
    "ins",
    "kbd",
    "li",
    "link",
    "mark",
    "meta",
    "ol",
    "p",
    "pre",
    "q",
    "s",
    "samp",
    "section",
    "small",
    "span",
    "strike",
    "strong",
    "sub",
    "sup",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "tt",
    "u",
    "ul",
    "var",
    "wbr",
    // JATS (also seen without the jats: prefix)
    "abstract",
    "bold",
    "disp-formula",
    "ext-link",
    "inline-formula",
    "italic",
    "label",
    "list",
    "list-item",
    "monospace",
    "named-content",
    "overline",
    "roman",
    "sans-serif",
    "sc",
    "sec",
    "strike",
    "styled-content",
    "tex-math",
    "title",
    "underline",
    "uri",
    "xref",
    // MathML
    "annotation",
    "math",
    "menclose",
    "merror",
    "mfenced",
    "mfrac",
    "mi",
    "mmultiscripts",
    "mn",
    "mo",
    "mover",
    "mpadded",
    "mphantom",
    "mroot",
    "mrow",
    "ms",
    "mspace",
    "msqrt",
    "mstyle",
    "msub",
    "msubsup",
    "msup",
    "mtable",
    "mtd",
    "mtext",
    "mtr",
    "munder",
    "munderover",
    "semantics",
  ].map((n) => n.toLowerCase()),
);
/**
 * A tag: `<name …>`, `</name>` or `<name …/>` whose attributes all have values (`name="…"`,
 * `name='…'` or `name=value`). Refusing bare attributes keeps maths such as `a<b c>d` as text.
 * No part of the pattern matches `<`, so each attempt stops at the next `<` (no backtracking blow-up).
 */
const TAG =
  /<\/?([A-Za-z][A-Za-z0-9._-]*(?::[A-Za-z][A-Za-z0-9._-]*)?)((?:\s+[A-Za-z_:][A-Za-z0-9_.:-]*\s*=\s*(?:"[^"<>]*"|'[^'<>]*'|[^\s"'<>=`]+))*)\s*\/?>/g;
const BLOCK_ELEMENTS = new Set([
  "p",
  "br",
  "div",
  "li",
  "sec",
  "title",
  "tr",
  "td",
  "th",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "list-item",
  "label",
  "hr",
]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  ndash: "–",
  mdash: "—",
  minus: "−",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  times: "×",
  divide: "÷",
  plusmn: "±",
  le: "≤",
  ge: "≥",
  ne: "≠",
  asymp: "≈",
  equiv: "≡",
  infin: "∞",
  sum: "∑",
  prod: "∏",
  int: "∫",
  part: "∂",
  nabla: "∇",
  radic: "√",
  isin: "∈",
  notin: "∉",
  sub: "⊂",
  sup: "⊃",
  cap: "∩",
  cup: "∪",
  forall: "∀",
  exist: "∃",
  empty: "∅",
  rarr: "→",
  larr: "←",
  harr: "↔",
  rArr: "⇒",
  lArr: "⇐",
  hArr: "⇔",
  deg: "°",
  micro: "µ",
  middot: "·",
  bull: "•",
  prime: "′",
  Prime: "″",
  copy: "©",
  reg: "®",
  trade: "™",
  sect: "§",
  para: "¶",
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  sup1: "¹",
  sup2: "²",
  sup3: "³",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  iota: "ι",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  omicron: "ο",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  sigmaf: "ς",
  tau: "τ",
  upsilon: "υ",
  phi: "φ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  Alpha: "Α",
  Beta: "Β",
  Gamma: "Γ",
  Delta: "Δ",
  Epsilon: "Ε",
  Zeta: "Ζ",
  Eta: "Η",
  Theta: "Θ",
  Iota: "Ι",
  Kappa: "Κ",
  Lambda: "Λ",
  Mu: "Μ",
  Nu: "Ν",
  Xi: "Ξ",
  Omicron: "Ο",
  Pi: "Π",
  Rho: "Ρ",
  Sigma: "Σ",
  Tau: "Τ",
  Upsilon: "Υ",
  Phi: "Φ",
  Chi: "Χ",
  Psi: "Ψ",
  Omega: "Ω",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  Auml: "Ä",
  Ouml: "Ö",
  Uuml: "Ü",
  szlig: "ß",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  aacute: "á",
  agrave: "à",
  acirc: "â",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ccedil: "ç",
  ntilde: "ñ",
  Eacute: "É",
  oslash: "ø",
  Oslash: "Ø",
  aring: "å",
  Aring: "Å",
  aelig: "æ",
  AElig: "Æ",
};

/** C0/C1 controls (tab, line feed and carriage return become spaces) and bidi formatting characters. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: it matches control characters in order to remove them
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\ufeff]/g;

function decodeEntities(text: string): string {
  return text.replace(/&(#[0-9]{1,8}|#[xX][0-9a-fA-F]{1,7}|[A-Za-z][A-Za-z0-9]{1,31});/g, (whole, body: string) => {
    if (body.startsWith("#")) {
      const code = body[1] === "x" || body[1] === "X" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return "\ufffd";
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[body] ?? whole;
  });
}

/** ASCII-only lower-casing, so indices in the copy match the original string. */
function asciiLower(text: string): string {
  return text.replace(/[A-Z]+/g, (s) => s.toLowerCase());
}

/** Drops `<name …>…</name>` for elements whose content is not text, in one linear pass per name. */
function dropElements(text: string): string {
  let out = text;
  for (const name of DROP_WITH_CONTENT) {
    const lower = asciiLower(out);
    const open = `<${name}`;
    const close = `</${name}`;
    let result = "";
    let pos = 0;
    let from = 0;
    for (;;) {
      const start = lower.indexOf(open, from);
      if (start < 0) break;
      if (!/[\s>/]/.test(lower.charAt(start + open.length))) {
        from = start + open.length;
        continue;
      }
      const end = lower.indexOf(close, start);
      const gt = end < 0 ? -1 : lower.indexOf(">", end);
      if (gt < 0) break;
      result += `${out.slice(pos, start)} `;
      pos = gt + 1;
      from = pos;
    }
    out = result + out.slice(pos);
  }
  return out;
}

/** Removes known markup; keeps unknown angle-bracket text (maths such as `$a<b$`) as text. */
function stripMarkup(text: string): string {
  let out = text.replace(/<!--[\s\S]*?(?:-->|$)/g, " ");
  out = out.replace(/<!\[CDATA\[([\s\S]*?)(?:\]\]>|$)/g, "$1");
  out = out.replace(/<\?[\s\S]*?(?:\?>|$)/g, " ");
  out = out.replace(/<!DOCTYPE[^<>]*>/gi, " ");
  out = dropElements(out);
  return out.replace(TAG, (whole, name: string) => {
    const local = (name.includes(":") ? name.slice(name.indexOf(":") + 1) : name).toLowerCase();
    if (!name.includes(":") && !KNOWN_ELEMENTS.has(local)) return whole;
    return BLOCK_ELEMENTS.has(local) ? " " : "";
  });
}

/**
 * Plain text from any provider string: markup stripped, entities decoded once, controls removed,
 * whitespace collapsed, cut to `limit` characters (never inside a surrogate pair). Non-strings
 * become "".
 */
export function providerText(value: unknown, limit = DEFAULT_PROVIDER_TEXT_LIMIT): string {
  if (typeof value !== "string" || value.length === 0) return "";
  let text = value.length > MAX_INPUT ? value.slice(0, MAX_INPUT) : value;
  text = stripMarkup(text);
  text = decodeEntities(text);
  text = text.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  const chars = Array.from(text);
  return chars.length <= limit ? text : `${chars.slice(0, limit - 1).join("")}…`;
}

/** Like providerText, but null for empty results, for optional fields. */
export function providerTextOrNull(value: unknown, limit = DEFAULT_PROVIDER_TEXT_LIMIT): string | null {
  const text = providerText(value, limit);
  return text.length > 0 ? text : null;
}

/**
 * An external URL safe to use as a link (`https:` only) or, for `"display"`, to show as text
 * (`https:` or `http:`). Credentials, other schemes, whitespace and control characters are refused;
 * the result is the parsed URL's canonical form.
 */
export function safeExternalUrl(value: unknown, purpose: "link" | "display" = "link"): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  // biome-ignore lint/suspicious/noControlCharactersInRegex: it matches control characters in order to refuse them
  if (raw.length === 0 || raw.length > 2048 || /[\s\u0000-\u001f\u007f-\u009f]/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const allowed = purpose === "link" ? url.protocol === "https:" : url.protocol === "https:" || url.protocol === "http:";
  if (!allowed || url.username || url.password || !url.hostname) return null;
  return url.href;
}
