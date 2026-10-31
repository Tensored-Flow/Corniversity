import { readFile } from "node:fs/promises";
import { getDocumentProxy, getMeta } from "unpdf";

const str = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value.trim().slice(0, 300) : undefined);

/**
 * Candidate bibliographic metadata read locally from the PDF's information dictionary. It is a
 * guess for the owner to confirm in the app; a file that cannot be parsed still registers (the
 * server's own validation decides what happens to its bytes, if they are ever sent).
 */
export async function pdfCandidateMetadata(filePath: string): Promise<{ title?: string; author?: string; pageCount?: number; producer?: string }> {
  try {
    const data = await readFile(filePath);
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const meta = await getMeta(pdf).catch(() => ({ info: {} as Record<string, unknown> }));
    const info = (meta.info ?? {}) as Record<string, unknown>;
    return { title: str(info.Title), author: str(info.Author), producer: str(info.Producer), pageCount: pdf.numPages };
  } catch {
    return {};
  }
}
