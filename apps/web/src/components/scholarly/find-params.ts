import { MAX_FIND_INPUT_LENGTH } from "@corniversity/core";

/**
 * Find papers' address: `q` (the box), `scope` (`all` OpenAlex, `mine` the owner's works), the
 * filters (`from`, `to` years, `type`, `free` for free to read, `field` a subject slug) and `page`.
 * Anything malformed is dropped with a note rather than sent on; the services validate again.
 */

export type FindScope = "all" | "mine";

export interface FindParams {
  q: string;
  scope: FindScope;
  yearFrom: number | undefined;
  yearTo: number | undefined;
  type: string | undefined;
  freeToRead: boolean;
  field: string | undefined;
  page: number;
}

const one = (value: string | string[] | undefined): string => (typeof value === "string" ? value : "");

function year(raw: string): number | undefined {
  const text = raw.trim();
  if (!/^\d{4}$/.test(text)) return undefined;
  const n = Number(text);
  return n >= 1000 && n <= 2100 ? n : undefined;
}

export function parseFindParams(search: Record<string, string | string[] | undefined>): FindParams {
  const pageText = one(search.page).trim();
  const page = /^\d{1,5}$/.test(pageText) ? Math.max(1, Number(pageText)) : 1;
  const type = one(search.type).trim();
  const field = one(search.field).trim();
  let yearFrom = year(one(search.from));
  let yearTo = year(one(search.to));
  if (yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo) [yearFrom, yearTo] = [yearTo, yearFrom];
  return {
    q: one(search.q).slice(0, MAX_FIND_INPUT_LENGTH).trim(),
    scope: one(search.scope) === "mine" ? "mine" : "all",
    yearFrom,
    yearTo,
    type: /^[a-z-]{1,40}$/.test(type) ? type : undefined,
    freeToRead: one(search.free) === "1",
    field: /^[a-z-]{1,60}$/.test(field) ? field : undefined,
    page,
  };
}

/** The address of a Find page for these parameters (defaults left out). */
export function findHref(params: Partial<FindParams>): string {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.scope === "mine") query.set("scope", "mine");
  if (params.yearFrom !== undefined) query.set("from", String(params.yearFrom));
  if (params.yearTo !== undefined) query.set("to", String(params.yearTo));
  if (params.type) query.set("type", params.type);
  if (params.freeToRead) query.set("free", "1");
  if (params.field) query.set("field", params.field);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const text = query.toString();
  return text ? `/library/find?${text}` : "/library/find";
}

/** Whether any filter is set (they are shown open then). */
export function hasFilters(params: FindParams): boolean {
  return params.yearFrom !== undefined || params.yearTo !== undefined || Boolean(params.type) || params.freeToRead || Boolean(params.field);
}
