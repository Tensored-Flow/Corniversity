import { crossrefLicence, normaliseDoi, providerText, providerTextOrNull } from "@corniversity/core/scholarly/index";
import { z } from "zod";
import { ScholarlyProviderError } from "./errors";
import { provenanceOf } from "./openalex";
import type { RequestOptions, ScholarlyTransport } from "./transport";
import type { CrossrefWork, IntegrityNotice, IntegrityNoticeType, ScholarlyAuthor } from "./types";

/**
 * Crossref adapter: one work by DOI, for bibliographic detail and for the corrections and retractions
 * recorded against it (`updated-by`, including Retraction Watch entries). Public pool by default; the
 * transport adds `mailto` only when the owner set CROSSREF_MAILTO. arXiv DOIs (10.48550) are
 * registered with DataCite and are not in Crossref, so callers do not ask Crossref about them.
 */

const HOST = "api.crossref.org";
const Str = z.string().nullish();
const DateParts = z.looseObject({ "date-parts": z.array(z.array(z.number().int().nullable())).nullish(), "date-time": Str }).nullish();
const Message = z.looseObject({
  DOI: z.string(),
  title: z.array(z.string()).nullish(),
  subtitle: z.array(z.string()).nullish(),
  author: z.array(z.looseObject({ given: Str, family: Str, name: Str, ORCID: Str })).nullish(),
  "container-title": z.array(z.string()).nullish(),
  publisher: Str,
  type: Str,
  issued: DateParts,
  license: z
    .array(
      z.looseObject({
        URL: Str,
        "content-version": Str,
        "delay-in-days": z.number().nullish(),
        start: z.looseObject({ "date-time": Str }).nullish(),
      }),
    )
    .nullish(),
  "updated-by": z
    .array(
      z.looseObject({
        DOI: Str,
        type: Str,
        label: Str,
        source: Str,
        updated: DateParts,
      }),
    )
    .nullish(),
  abstract: Str,
  "is-referenced-by-count": z.number().nullish(),
  relation: z.record(z.string(), z.array(z.looseObject({ id: Str, "id-type": Str })).nullish()).nullish(),
});
const Envelope = z.looseObject({ status: z.string(), message: Message });

/** Crossref update types that are integrity notices, and how they are recorded. */
const NOTICE_TYPES: Record<string, IntegrityNoticeType> = {
  retraction: "retraction",
  partial_retraction: "retraction",
  correction: "correction",
  erratum: "correction",
  corrigendum: "correction",
  expression_of_concern: "expression_of_concern",
  withdrawal: "withdrawal",
  removal: "withdrawal",
};

function day(parts: z.infer<typeof DateParts>): string | undefined {
  const time = parts?.["date-time"] ? Date.parse(parts["date-time"]) : Number.NaN;
  if (Number.isFinite(time)) return new Date(time).toISOString().slice(0, 10);
  const [y, m, d] = parts?.["date-parts"]?.[0] ?? [];
  if (y && m && d) return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return undefined;
}

/** Integrity notices from a Crossref record's `updated-by` list, concerning that record's DOI. */
export function integrityNoticesFromCrossref(
  doi: string,
  updatedBy: z.infer<typeof Message>["updated-by"],
  retrievedAt: string,
): IntegrityNotice[] {
  const notices: IntegrityNotice[] = [];
  for (const update of updatedBy ?? []) {
    const type = update.type ? NOTICE_TYPES[update.type.toLowerCase()] : undefined;
    if (!type) continue;
    const noticeDoi = normaliseDoi(update.DOI);
    const date = day(update.updated);
    notices.push({
      type,
      source: update.source === "retraction-watch" ? "retraction-watch" : "crossref",
      concerns: doi,
      ...(noticeDoi ? { noticeDoi } : {}),
      ...(date ? { date } : {}),
      label: providerText(update.label, 200) || providerText(update.type, 100),
      retrievedAt,
    });
  }
  return notices;
}

export async function getCrossrefWork(
  transport: ScholarlyTransport,
  rawDoi: string,
  options?: RequestOptions & { now?: Date },
): Promise<CrossrefWork> {
  const doi = normaliseDoi(rawDoi);
  if (!doi) throw new ScholarlyProviderError("crossref", "invalid_identifier", "Not a valid DOI.");
  const response = await transport.get(
    {
      provider: "crossref",
      host: HOST,
      path: `/works/${encodeURIComponent(doi)}`,
      kind: "metadata",
      cacheKind: "crossref",
      accept: "application/json",
    },
    options,
  );
  if (response.status === 404)
    throw new ScholarlyProviderError("crossref", "not_found", "Crossref has no record of this DOI.", { status: 404 });
  let data: unknown;
  try {
    data = JSON.parse(response.body);
  } catch {
    throw new ScholarlyProviderError("crossref", "invalid_response", "Crossref's response was not valid JSON.");
  }
  const parsed = Envelope.safeParse(data);
  if (!parsed.success || parsed.data.status !== "ok")
    throw new ScholarlyProviderError("crossref", "invalid_response", "Crossref's response did not have the expected shape.");
  const message = parsed.data.message;
  const provenance = provenanceOf(response, "crossref");
  const returned = normaliseDoi(message.DOI);
  if (returned !== doi) throw new ScholarlyProviderError("crossref", "invalid_response", "Crossref returned a record for a different DOI.");

  const authors: ScholarlyAuthor[] = [];
  for (const a of message.author ?? []) {
    const name = providerText(a.name ?? [a.given, a.family].filter(Boolean).join(" "), 300);
    if (!name) continue;
    const orcid = a.ORCID ? /(\d{4}-\d{4}-\d{4}-\d{3}[\dX])$/.exec(a.ORCID)?.[1] : undefined;
    authors.push({ name, ...(orcid ? { orcid } : {}) });
  }
  const issuedParts = message.issued?.["date-parts"]?.[0] ?? [];
  const issuedYear = issuedParts[0];
  const licences = (message.license ?? [])
    .filter((l) => typeof l.URL === "string" && l.URL.length > 0)
    .map((l) => ({
      url: providerText(l.URL, 500),
      contentVersion: providerTextOrNull(l["content-version"], 30),
      start: l.start?.["date-time"] ?? null,
      delayInDays: typeof l["delay-in-days"] === "number" ? l["delay-in-days"] : null,
    }));
  const relations: CrossrefWork["relations"] = [];
  for (const [type, targets] of Object.entries(message.relation ?? {})) {
    if (!/^[a-z-]{1,40}$/.test(type)) continue;
    for (const target of targets ?? []) {
      if (target.id) relations.push({ type, id: providerText(target.id, 300), idType: providerText(target["id-type"], 30) });
    }
  }
  return {
    provenance,
    doi,
    title: providerTextOrNull(message.title?.[0], 2000),
    subtitle: providerTextOrNull(message.subtitle?.[0], 2000),
    authors,
    containerTitle: providerTextOrNull(message["container-title"]?.[0], 500),
    publisher: providerTextOrNull(message.publisher, 500),
    type: message.type && /^[a-z-]{1,40}$/.test(message.type) ? message.type : null,
    issued: issuedYear ? { year: issuedYear, month: issuedParts[1] ?? null, day: issuedParts[2] ?? null } : null,
    licences,
    licence: crossrefLicence(message.license ?? [], options?.now ?? new Date()),
    integrityNotices: integrityNoticesFromCrossref(doi, message["updated-by"], provenance.retrievedAt),
    abstract: providerTextOrNull(message.abstract),
    isReferencedByCount: typeof message["is-referenced-by-count"] === "number" ? message["is-referenced-by-count"] : null,
    relations,
  };
}
