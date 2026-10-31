/**
 * The single place where HTML produced by `renderMarkdown` is injected. Every string reaching
 * this component has passed through rehype-sanitize with the strict schema in lib/markdown.ts;
 * nothing else may be rendered this way.
 */
export function RenderedHtml({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={["prose-reading", className].filter(Boolean).join(" ")}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: html is the sanitised output of renderMarkdown
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
