import { describe, expect, it } from "vitest";
import { providerText, providerTextOrNull, safeExternalUrl } from "./text";

describe("providerText", () => {
  it("turns JATS, HTML and MathML into plain text", () => {
    expect(providerText("<jats:p>We prove <jats:italic>the</jats:italic> theorem.</jats:p><jats:p>Second.</jats:p>")).toBe(
      "We prove the theorem. Second.",
    );
    expect(providerText("H<sub>2</sub>O and <i>E</i> = <i>mc</i><sup>2</sup>")).toBe("H2O and E = mc2");
    expect(providerText("<mml:math><mml:msup><mml:mi>x</mml:mi><mml:mn>2</mml:mn></mml:msup></mml:math> grows")).toBe("x2 grows");
    expect(providerText('<p class="abstract">Text<br/>more</p>')).toBe("Text more");
  });

  it("decodes entities exactly once", () => {
    expect(providerText("Schr&ouml;dinger &amp; Bose &ndash; &alpha;&le;&beta;")).toBe("Schrödinger & Bose – α≤β");
    expect(providerText("&#8722;&#x2212;&#X2212;")).toBe("−−−");
    expect(providerText("&amp;lt;b&amp;gt;")).toBe("&lt;b&gt;");
    // Decoded angle brackets are text now; they are never parsed as markup again.
    expect(providerText("&lt;script&gt;alert(1)&lt;/script&gt;")).toBe("<script>alert(1)</script>");
    expect(providerText("&#0; &#xD800; &#1114112;")).toBe("\ufffd \ufffd \ufffd");
    expect(providerText("&unknownentity; stays")).toBe("&unknownentity; stays");
  });

  it("keeps $…$ maths and angle brackets that are not markup", () => {
    expect(providerText("for $0<p<1$ and $a<b c>d$")).toBe("for $0<p<1$ and $a<b c>d$");
    expect(providerText("If $x^2 + y_1 \\leq 1$ then x<y and y>z")).toBe("If $x^2 + y_1 \\leq 1$ then x<y and y>z");
    expect(providerText("a <unknowntag> b")).toBe("a <unknowntag> b");
  });

  it("removes hostile markup and its content", () => {
    expect(providerText("<img src=x onerror=alert(1)>Title")).toBe("Title");
    expect(providerText("<script>alert(1)</script>Safe")).toBe("Safe");
    expect(providerText('<SCRIPT type="text/javascript">alert(1)</SCRIPT>Safe')).toBe("Safe");
    expect(providerText("<style>body{display:none}</style>T")).toBe("T");
    expect(providerText('<a href="javascript:alert(1)">click</a>')).toBe("click");
    expect(providerText("<svg onload=alert(1)><circle/></svg>X")).toBe("X");
    expect(providerText("<!-- hidden -->Visible<!-- unterminated")).toBe("Visible");
    expect(providerText("<![CDATA[<b>x</b>]]> y")).toBe("x y");
    expect(providerText("<!DOCTYPE html><p>ok</p>")).toBe("ok");
    // An unterminated script tag loses the tag; what follows is inert text.
    expect(providerText("<script>alert(1)")).toBe("alert(1)");
  });

  it("removes control and bidirectional formatting characters and collapses whitespace", () => {
    expect(providerText("a\u0000b\u202ec\u2066d")).toBe("a b c d");
    expect(providerText("  line one\n\n\tline   two  ")).toBe("line one line two");
    expect(providerText("\ufeffTitle")).toBe("Title");
  });

  it("returns empty text for non-strings and cuts long text without splitting surrogate pairs", () => {
    expect(providerText(undefined)).toBe("");
    expect(providerText(12)).toBe("");
    expect(providerTextOrNull("   ")).toBeNull();
    const cut = providerText("𝔸".repeat(50), 10);
    expect(Array.from(cut)).toHaveLength(10);
    expect(cut.endsWith("…")).toBe(true);
    expect(
      Array.from(cut)
        .slice(0, 9)
        .every((c) => c === "𝔸"),
    ).toBe(true);
  });

  it("stays fast on adversarial input", () => {
    const started = Date.now();
    providerText("<a ".repeat(60_000));
    providerText(`${"<script>".repeat(20_000)}x`);
    providerText(`${"<!DOCTYPE ".repeat(20_000)}`);
    providerText(`<p ${'a="1" '.repeat(20_000)}`);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe("safeExternalUrl", () => {
  it("accepts https links and canonicalises them", () => {
    expect(safeExternalUrl("https://arxiv.org/abs/2305.18290")).toBe("https://arxiv.org/abs/2305.18290");
    expect(safeExternalUrl("  HTTPS://Example.org ")).toBe("https://example.org/");
  });

  it("allows http only for display, and refuses every other scheme, credentials and malformed input", () => {
    expect(safeExternalUrl("http://arxiv.org/abs/2312.14925")).toBeNull();
    expect(safeExternalUrl("http://arxiv.org/abs/2312.14925", "display")).toBe("http://arxiv.org/abs/2312.14925");
    for (const bad of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox",
      "file:///etc/passwd",
      "//example.org/x",
      "https://user:pw@example.org/",
      "https://example.org/a b",
      "https://example.org/\u0000",
      "",
      `https://example.org/${"a".repeat(3000)}`,
    ]) {
      expect(safeExternalUrl(bad), bad).toBeNull();
      expect(safeExternalUrl(bad, "display"), bad).toBeNull();
    }
    expect(safeExternalUrl(null)).toBeNull();
  });
});
