import { describe, expect, it } from "vitest";
import { speakableText } from "./speakable";

describe("speakable text", () => {
  it("replaces formulas with spoken markers instead of reading LaTeX", () => {
    expect(speakableText("Since $\\|f\\|_\\infty \\le 1$, we have\n$$\\int_0^1 x^n\\,dx = \\frac{1}{n+1}.$$")).toBe(
      "Since (formula) , we have (formula shown on screen)",
    );
  });

  it("drops Markdown syntax, link targets and evidence markers but keeps the words", () => {
    expect(speakableText("## Step 1\n- **Check** the [hypothesis](https://example.test) [E2] and `n`.")).toBe(
      "Step 1 Check the hypothesis and n.",
    );
  });
});
