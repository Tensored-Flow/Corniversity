import type { WorkEdit } from "@corniversity/db/services/scholarly-works";

/** *Edit details* as a form holds it: the fields as text, before any parsing. */
export interface EditFormValues {
  title: string;
  authors: string;
  abstract: string;
  year: string;
  venue: string;
  workType: string;
}

export const EDIT_FIELDS = ["title", "authors", "abstract", "year", "venue", "workType"] as const;

/** The form's values under `prefix` (the shown values travel as hidden `shown_<field>` inputs). */
export function editFormValues(form: FormData, prefix = ""): EditFormValues {
  const read = (key: string) => String(form.get(`${prefix}${key}`) ?? "");
  return {
    title: read("title"),
    authors: read("authors"),
    abstract: read("abstract"),
    year: read("year"),
    venue: read("venue"),
    workType: read("workType"),
  };
}

const lines = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

/** A year as typed: empty is none, one to four digits a year, anything else not a year (the service refuses it). */
function year(text: string): number | null {
  const value = text.trim();
  if (value === "") return null;
  return /^\d{1,4}$/.test(value) ? Number(value) : Number.NaN;
}

/**
 * The owner's corrections from *Edit details*: only the fields the owner changed in this form
 * (`submitted` differs from what the form showed, `shown`) become edits, and `expected` carries what
 * the form showed for each of them, so the service can refuse an edit whose field changed meanwhile.
 * A field the owner left alone is never sent, so a form opened before the arXiv record arrived (or
 * left open in another tab) cannot blank or revert it.
 */
export function workEditFromForm(submitted: EditFormValues, shown: EditFormValues): { edit: WorkEdit; expected: WorkEdit } {
  const edit: WorkEdit = {};
  const expected: WorkEdit = {};
  if (submitted.title.trim() !== shown.title.trim()) {
    edit.title = submitted.title.trim();
    expected.title = shown.title.trim();
  }
  if (lines(submitted.authors).join("\n") !== lines(shown.authors).join("\n")) {
    edit.authors = lines(submitted.authors);
    expected.authors = lines(shown.authors);
  }
  if (submitted.abstract.trim() !== shown.abstract.trim()) {
    edit.abstract = submitted.abstract.trim() || null;
    expected.abstract = shown.abstract.trim() || null;
  }
  if (submitted.year.trim() !== shown.year.trim()) {
    edit.publicationYear = year(submitted.year);
    expected.publicationYear = year(shown.year);
  }
  if (submitted.venue.trim() !== shown.venue.trim()) {
    edit.venue = submitted.venue.trim() || null;
    expected.venue = shown.venue.trim() || null;
  }
  if (submitted.workType.trim() !== shown.workType.trim()) {
    edit.workType = submitted.workType.trim() || null;
    expected.workType = shown.workType.trim() || null;
  }
  return { edit, expected };
}
