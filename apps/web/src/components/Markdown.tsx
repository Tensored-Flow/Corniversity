import { renderMarkdown } from "@/lib/markdown";

interface Props {
  source: string;
  className?: string;
}

/** Server component: Markdown with mathematics, rendered and sanitised on the server. */
export async function Markdown({ source, className }: Props) {
  const html = await renderMarkdown(source);
  return (
    <div
      className={["prose-reading", className].filter(Boolean).join(" ")}
      // Output of renderMarkdown is sanitised by rehype-sanitize with a strict schema.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
