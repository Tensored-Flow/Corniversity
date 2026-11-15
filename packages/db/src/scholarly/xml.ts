/**
 * A small, strict XML reader for the two shapes arXiv serves (Atom from the export API, OAI-PMH
 * from oaipmh.arxiv.org). It builds a plain element tree. It refuses DOCTYPE declarations (so no
 * entity expansion of any kind), decodes only the five XML entities and numeric character
 * references, and caps input size and nesting depth. Element and attribute names keep their
 * prefixes; lookups compare local names, because both feeds use default namespaces.
 */

export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: (XmlElement | string)[];
}

export class XmlError extends Error {}

export const MAX_XML_BYTES = 8 * 1024 * 1024;
const MAX_DEPTH = 64;
const NAME = /^[A-Za-z_][A-Za-z0-9._:-]*/;

function decode(text: string): string {
  return text.replace(/&(#[0-9]{1,8}|#x[0-9a-fA-F]{1,7}|[A-Za-z]+);/g, (whole, body: string) => {
    switch (body) {
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "amp":
        return "&";
      case "quot":
        return '"';
      case "apos":
        return "'";
    }
    if (!body.startsWith("#")) throw new XmlError(`Unknown entity ${whole}.`);
    const code = body[1] === "x" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
    if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff))
      throw new XmlError("Invalid character reference.");
    return String.fromCodePoint(code);
  });
}

export function parseXml(input: string): XmlElement {
  if (input.length > MAX_XML_BYTES) throw new XmlError("XML document too large.");
  const root: XmlElement = { name: "#document", attrs: {}, children: [] };
  const stack: XmlElement[] = [root];
  let i = 0;
  const n = input.length;
  while (i < n) {
    const lt = input.indexOf("<", i);
    if (lt < 0) {
      appendText(stack, input.slice(i));
      break;
    }
    if (lt > i) appendText(stack, input.slice(i, lt));
    if (input.startsWith("<!--", lt)) {
      const end = input.indexOf("-->", lt + 4);
      if (end < 0) throw new XmlError("Unterminated comment.");
      i = end + 3;
    } else if (input.startsWith("<![CDATA[", lt)) {
      const end = input.indexOf("]]>", lt + 9);
      if (end < 0) throw new XmlError("Unterminated CDATA section.");
      stack[stack.length - 1]!.children.push(input.slice(lt + 9, end));
      i = end + 3;
    } else if (input.startsWith("<?", lt)) {
      const end = input.indexOf("?>", lt + 2);
      if (end < 0) throw new XmlError("Unterminated processing instruction.");
      i = end + 2;
    } else if (input.startsWith("<!", lt)) {
      throw new XmlError("DOCTYPE and other declarations are not accepted.");
    } else if (input.startsWith("</", lt)) {
      const end = input.indexOf(">", lt + 2);
      if (end < 0) throw new XmlError("Unterminated end tag.");
      const name = input.slice(lt + 2, end).trim();
      const open = stack.pop();
      if (!open || open === root || open.name !== name) throw new XmlError(`Mismatched end tag </${name}>.`);
      i = end + 1;
    } else {
      const parsed = parseStartTag(input, lt + 1);
      const element: XmlElement = { name: parsed.name, attrs: parsed.attrs, children: [] };
      stack[stack.length - 1]!.children.push(element);
      if (!parsed.selfClosing) {
        if (stack.length > MAX_DEPTH) throw new XmlError("XML nested too deeply.");
        stack.push(element);
      }
      i = parsed.end;
    }
  }
  if (stack.length !== 1) throw new XmlError("Unclosed element.");
  const elements = root.children.filter((c): c is XmlElement => typeof c !== "string");
  if (elements.length !== 1) throw new XmlError("XML must have exactly one root element.");
  return elements[0]!;
}

function appendText(stack: XmlElement[], raw: string): void {
  if (stack.length === 1) {
    if (raw.trim().length > 0) throw new XmlError("Text outside the root element.");
    return;
  }
  stack[stack.length - 1]!.children.push(decode(raw));
}

function parseStartTag(input: string, start: number): { name: string; attrs: Record<string, string>; selfClosing: boolean; end: number } {
  const nameMatch = NAME.exec(input.slice(start, start + 256));
  if (!nameMatch) throw new XmlError("Malformed start tag.");
  const name = nameMatch[0];
  let i = start + name.length;
  const attrs: Record<string, string> = Object.create(null);
  for (;;) {
    while (i < input.length && /\s/.test(input[i]!)) i++;
    if (i >= input.length) throw new XmlError("Unterminated start tag.");
    if (input[i] === ">") return { name, attrs, selfClosing: false, end: i + 1 };
    if (input.startsWith("/>", i)) return { name, attrs, selfClosing: true, end: i + 2 };
    const attrMatch = NAME.exec(input.slice(i, i + 256));
    if (!attrMatch) throw new XmlError("Malformed attribute.");
    const attrName = attrMatch[0];
    i += attrName.length;
    while (i < input.length && /\s/.test(input[i]!)) i++;
    if (input[i] !== "=") throw new XmlError("Attribute without a value.");
    i++;
    while (i < input.length && /\s/.test(input[i]!)) i++;
    const quote = input[i];
    if (quote !== '"' && quote !== "'") throw new XmlError("Unquoted attribute value.");
    const close = input.indexOf(quote, i + 1);
    if (close < 0) throw new XmlError("Unterminated attribute value.");
    const value = input.slice(i + 1, close);
    if (value.includes("<")) throw new XmlError("'<' in an attribute value.");
    attrs[attrName] = decode(value);
    i = close + 1;
  }
}

export function localName(name: string): string {
  const colon = name.indexOf(":");
  return colon < 0 ? name : name.slice(colon + 1);
}

/** Child elements whose local name (or exact prefixed name, when `name` has a prefix) matches. */
export function childElements(element: XmlElement, name: string): XmlElement[] {
  const prefixed = name.includes(":");
  return element.children.filter(
    (c): c is XmlElement => typeof c !== "string" && (prefixed ? c.name === name : localName(c.name) === name),
  );
}

export function childElement(element: XmlElement, name: string): XmlElement | undefined {
  return childElements(element, name)[0];
}

/** All text inside an element, concatenated in document order. */
export function textContent(element: XmlElement | undefined): string {
  if (!element) return "";
  return element.children.map((c) => (typeof c === "string" ? c : textContent(c))).join("");
}

/** The trimmed text of the first matching child, or null when it is missing or empty. */
export function childText(element: XmlElement, name: string): string | null {
  const text = textContent(childElement(element, name)).trim();
  return text.length > 0 ? text : null;
}

/** First descendant (depth-first) with this local name. */
export function findElement(element: XmlElement, name: string): XmlElement | undefined {
  for (const child of element.children) {
    if (typeof child === "string") continue;
    if (localName(child.name) === name) return child;
    const found = findElement(child, name);
    if (found) return found;
  }
  return undefined;
}
