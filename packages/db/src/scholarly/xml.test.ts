import { describe, expect, it } from "vitest";
import { childElement, childElements, childText, findElement, localName, parseXml, textContent, XmlError } from "./xml";

describe("parseXml", () => {
  it("reads elements, prefixed names, attributes, text, CDATA and character references", () => {
    const root = parseXml(
      `<?xml version="1.0"?><!-- c --><feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">` +
        `<entry><title>A &amp; B &lt;x&gt; &#8722;&#x2212;</title><arxiv:doi>10.1/x</arxiv:doi>` +
        `<category term='hep-th' scheme="s"/><summary><![CDATA[$a<b$]]></summary></entry></feed>`,
    );
    expect(root.name).toBe("feed");
    const entry = childElement(root, "entry")!;
    expect(childText(entry, "title")).toBe("A & B <x> −−");
    expect(childText(entry, "doi")).toBe("10.1/x");
    expect(childElement(entry, "arxiv:doi")).toBeDefined();
    expect(childElements(entry, "category")[0]!.attrs).toEqual({ term: "hep-th", scheme: "s" });
    expect(textContent(childElement(entry, "summary"))).toBe("$a<b$");
    expect(findElement(root, "doi")?.name).toBe("arxiv:doi");
    expect(localName("arxiv:primary_category")).toBe("primary_category");
    expect(childText(entry, "missing")).toBeNull();
  });

  it("refuses DOCTYPE declarations, so no entity expansion is possible", () => {
    const laughs = `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;">]><lolz>&lol2;</lolz>`;
    expect(() => parseXml(laughs)).toThrow(XmlError);
    expect(() => parseXml("<a>&lol;</a>")).toThrow(/Unknown entity/);
    expect(() => parseXml("<a>&#0;</a>")).toThrow(XmlError);
  });

  it("refuses malformed documents", () => {
    for (const bad of [
      "<a><b></a></b>",
      "<a>",
      "<a></a><b></b>",
      "text<a></a>",
      "<a b=c></a>",
      "<a b></a>",
      '<a b="<"></a>',
      "<a><!-- open </a>",
      "<a><![CDATA[x</a>",
      "",
      "</a>",
    ]) {
      expect(() => parseXml(bad), bad).toThrow(XmlError);
    }
    expect(() => parseXml(`${"<a>".repeat(70)}${"</a>".repeat(70)}`)).toThrow(/nested too deeply/);
  });

  it("does not let attribute names reach Object.prototype", () => {
    const root = parseXml('<a __proto__="x" constructor="y"/>');
    expect(Object.getOwnPropertyDescriptor(root.attrs, "__proto__")?.value).toBe("x");
    expect(Object.getPrototypeOf(root.attrs)).toBeNull();
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});
