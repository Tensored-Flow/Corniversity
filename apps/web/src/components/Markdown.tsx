import { renderMarkdown } from "@/lib/markdown";
import { RenderedHtml } from "./RenderedHtml";

interface Props {
  source: string;
  className?: string;
}

/** Server component: Markdown with mathematics, rendered and sanitised on the server. */
export async function Markdown({ source, className }: Props) {
  const html = await renderMarkdown(source);
  return <RenderedHtml html={html} className={className} />;
}
