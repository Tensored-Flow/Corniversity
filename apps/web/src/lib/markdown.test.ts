import { fromHtmlIsomorphic } from "hast-util-from-html-isomorphic";
import { toText } from "hast-util-to-text";
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

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
