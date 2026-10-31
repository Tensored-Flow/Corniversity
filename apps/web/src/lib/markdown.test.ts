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
    expect(html).toContain("Theorem (Riesz &lt;b&gt;x&lt;/b&gt;)");
  });
  it("neutralises raw HTML blocks", async () => {
    const html = await renderMarkdown('<iframe src="https://example.org"></iframe>\n\nplain');
    expect(html).not.toContain("<iframe");
    expect(html).toContain("plain");
  });
});
