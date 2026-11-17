import { fromHtmlIsomorphic } from "hast-util-from-html-isomorphic";
import { toText } from "hast-util-to-text";
import { describe, expect, it } from "vitest";
import { isSameOriginImage, renderMarkdown } from "./markdown";

/**
 * Everything rendered through the Markdown pipeline is untrusted: learner text, model output,
 * extracted book passages. Script, event handlers and unsafe URL schemes must not survive;
 * mathematics must.
 */
describe("renderMarkdown", () => {
  it("drops script tags, event handlers and javascript: links", async () => {
    const html = await renderMarkdown(
      'Hello <script>alert(1)</script> <img src=x onerror="alert(1)"> [link](javascript:alert(1)) <a href="data:text/html,x">d</a>',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).not.toMatch(/href="data:/i);
  });
  it("keeps mathematics as MathML and chemistry via mhchem", async () => {
    const html = await renderMarkdown("Let $\\|f\\|_\\infty = 1$ and $$\\int_0^1 x^n\\,dx = \\frac{1}{n+1}.$$ Also $\\ce{A <=> B}$.");
    expect(html).toContain("<math");
    expect(html).toContain("mfrac");
    expect(html).not.toContain("katex-error");
  });
  it("wraps named environments and escapes their titles", async () => {
    const html = await renderMarkdown("**Theorem (Riesz <b>x</b>).** Every bounded functional is represented.");
    expect(html).toContain("env-theorem");
    expect(toText(fromHtmlIsomorphic(html, { fragment: true }))).toContain("Theorem (Riesz <b>x</b>)");
    expect(html).not.toContain("<b>");
  });
  it("neutralises raw HTML blocks", async () => {
    const html = await renderMarkdown('<iframe src="https://example.org"></iframe>\n\nplain');
    expect(html).not.toContain("<iframe");
    expect(html).toContain("plain");
  });
  it("preserves blank lines inside executable fenced code", async () => {
    const html = await renderMarkdown("```python\nimport math\n\ndef square(x):\n    return x*x\n\nprint(square(3))\n```");
    expect(html.match(/<pre>/g)).toHaveLength(1);
    expect(html).toContain("import math\n\ndef square(x):\n    return x*x\n\nprint(square(3))");
    expect(html).not.toContain("<p>def square");
  });
  it("keeps a multi-paragraph list as one ordered list", async () => {
    const html = await renderMarkdown("1. Choose a model.\n\n   State its assumptions.\n\n2. Test the prediction.");
    expect(html.match(/<ol(?:\s[^>]*)?>/g)).toHaveLength(1);
    expect(html.match(/<li>/g)).toHaveLength(2);
    expect(html).toContain("State its assumptions.");
  });
  it("resolves document-level references in prose and named environments", async () => {
    const html = await renderMarkdown(
      "[source]: https://example.test/reading\nRead [the source][source].\n\n**Definition.** See [the source][source].",
    );
    expect(html.match(/href="https:\/\/example.test\/reading"/g)).toHaveLength(2);
    expect(html).toContain("env-definition");
    expect(html).not.toContain("[the source]");
  });
  it("keeps footnote numbering and definitions across paragraphs", async () => {
    const html = await renderMarkdown("First[^a].\n\nSecond[^b].\n\n[^a]: First note.\n\n[^b]: Second note.");
    expect(html).toContain("First note.");
    expect(html).toContain("Second note.");
    expect(html.match(/data-footnotes/g)).toHaveLength(1);
  });
});

/**
 * Images: the production CSP allows images from this site only, and model output or owner text could
 * carry an image that calls out to another host. No content the app seeds uses Markdown images.
 */
describe("images in Markdown", () => {
  it("never loads an image from another site: it becomes a link named by its alternative text", async () => {
    const html = await renderMarkdown("See ![Figure 1](https://example.org/figure.png) below.");
    expect(html).not.toContain("<img");
    expect(html).toContain('href="https://example.org/figure.png"');
    expect(html).toContain("Image not shown: Figure 1");
    expect(html).toContain('rel="noopener noreferrer"');
    const unnamed = await renderMarkdown("![](https://example.org/x.png)");
    expect(unnamed).not.toContain("<img");
    expect(unnamed).toContain("Image not shown");
  });

  it("treats protocol-relative and other-scheme addresses as other sites", async () => {
    for (const src of ["//example.org/x.png", "http://example.org/x.png", "data:image/png;base64,AAAA"]) {
      const html = await renderMarkdown(`![x](${src})`);
      expect(html, src).not.toContain("<img");
      expect(html, src).toContain("Image not shown: x");
    }
    const script = await renderMarkdown("![x](javascript:alert(1))");
    expect(script).not.toContain("<img");
    expect(script).not.toMatch(/javascript:/i);
    // Markdown percent-encodes a backslash, so `/\host/…` arrives as a path on this site, which no browser reads as a host.
    expect(await renderMarkdown("![x](/\\example.org/x.png)")).toContain('<img src="/%5Cexample.org/x.png" alt="x">');
  });

  it("keeps an image on this site (a relative path)", async () => {
    const html = await renderMarkdown("![A diagram](/visuals/diagram.svg)");
    expect(html).toContain('<img src="/visuals/diagram.svg" alt="A diagram">');
  });

  it("puts no link inside a link: an image from elsewhere inside one becomes text", async () => {
    const html = await renderMarkdown("[![badge](https://example.org/b.svg)](https://example.org/)");
    expect(html).not.toContain("<img");
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain("Image not shown: badge");
  });

  it("never keeps an address with a scheme but no slashes, which a page served over http reads as another host", async () => {
    // Against an https page `https:example.org/x.png` is a relative path; against http://127.0.0.1:3300 it is example.org.
    for (const src of ["https:example.org/x.png", "https:/example.org/x.png", "http:example.org/x.png"]) {
      const html = await renderMarkdown(`![x](${src})`);
      expect(html, src).not.toContain("<img");
      expect(html, src).toContain("Image not shown: x");
    }
  });

  it("makes no link of an image whose address is not a web address: its text only, never a link that goes nowhere", async () => {
    for (const src of ["data:image/png;base64,iVBORw0KGgo=", "javascript:x"]) {
      const html = await renderMarkdown(`![d](${src})`);
      expect(html, src).not.toContain("<a");
      expect(html, src).not.toContain("<img");
      expect(html, src).toContain("Image not shown: d");
    }
  });

  it("leaves no link whose address the sanitiser removed: its text stays as text", async () => {
    const html = await renderMarkdown("Before [plain](javascript:alert(1)) after.");
    expect(html).not.toContain("<a");
    expect(html).toContain("Before plain after.");
    expect(await renderMarkdown("[kept](https://example.org/)")).toContain('<a href="https://example.org/">kept</a>');
  });
});

describe("isSameOriginImage", () => {
  it("accepts relative paths only", () => {
    expect(isSameOriginImage("/visuals/a.svg")).toBe(true);
    expect(isSameOriginImage("figure.png")).toBe(true);
    for (const src of [
      "https://example.org/a.png",
      "//example.org/a.png",
      "/\\example.org/a.png",
      "data:image/png;base64,AA",
      "blob:x",
      "https:example.org/a.png",
      "https:/example.org/a.png",
      "https://a.invalid/a.png",
      "http://a.invalid/a.png",
      "https://b.invalid/a.png",
      "//b.invalid/a.png",
    ])
      expect(isSameOriginImage(src), src).toBe(false);
  });
});
