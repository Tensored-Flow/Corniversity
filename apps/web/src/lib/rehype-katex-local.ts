import type { Element, ElementContent, Root } from "hast";
import { fromHtmlIsomorphic } from "hast-util-from-html-isomorphic";
import { toText } from "hast-util-to-text";
import katex from "katex";
import "katex/contrib/mhchem";
import { SKIP, visit } from "unist-util-visit";

/**
 * Renders remark-math nodes with the KaTeX instance imported in this file. The mhchem extension
 * registers `\ce` and `\pu` on that same instance by its side-effect import above, so chemistry
 * renders wherever this module renders mathematics. (rehype-katex imports its own copy of KaTeX,
 * which in the server bundle did not see the extension: `\ce{…}` came out as text.)
 */
export function rehypeKatexLocal() {
  return (tree: Root) => {
    visit(tree, "element", (element: Element, index, parent) => {
      const classes = Array.isArray(element.properties?.className) ? element.properties.className.map(String) : [];
      const inline = classes.includes("math-inline");
      const display = classes.includes("math-display");
      if (!inline && !display) return;
      const source = toText(element, { whitespace: "pre" });
      const html = katex.renderToString(source, {
        displayMode: display,
        output: "mathml",
        strict: "ignore",
        trust: false,
        throwOnError: false,
      });
      const children = fromHtmlIsomorphic(html, { fragment: true }).children as ElementContent[];
      if (display && parent && typeof index === "number") {
        parent.children[index] = { type: "element", tagName: "div", properties: { className: ["math-display"] }, children };
        return SKIP;
      }
      element.tagName = "span";
      element.properties = { className: ["math-inline"] };
      element.children = children;
      return SKIP;
    });
  };
}
