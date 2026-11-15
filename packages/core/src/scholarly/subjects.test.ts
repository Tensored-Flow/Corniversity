import { describe, expect, it } from "vitest";
import {
  DEFAULT_SUBJECT_SLUGS,
  fieldsOutside,
  isSubjectSlug,
  openAlexSubjectFilter,
  orderSubjects,
  SUBJECTS,
  subjectBySlug,
  subjectForOpenAlex,
  surpriseField,
} from "./subjects";

/** The 26 field ids of the live OpenAlex /fields response recorded on 2026-11-15. */
const RECORDED_FIELD_IDS = [
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
];

describe("subjects", () => {
  it("lists the four primary subjects first, in order, as the default", () => {
    expect(SUBJECTS.slice(0, 4).map((s) => s.slug)).toEqual(["mathematics", "physics", "computer-science", "artificial-intelligence"]);
    expect(DEFAULT_SUBJECT_SLUGS).toEqual(["mathematics", "physics", "computer-science", "artificial-intelligence"]);
    expect(SUBJECTS.slice(0, 4).every((s) => s.primary)).toBe(true);
    expect(SUBJECTS.slice(4).every((s) => !s.primary)).toBe(true);
  });

  it("reaches every OpenAlex field exactly once, with unique kebab-case slugs", () => {
    const fieldIds = SUBJECTS.filter((s) => s.openalex.level === "field").map((s) => s.openalex.id);
    expect([...fieldIds].sort()).toEqual([...RECORDED_FIELD_IDS].sort());
    const slugs = SUBJECTS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
  });

  it("maps artificial intelligence to its OpenAlex subfield and the primary subjects to arXiv categories", () => {
    expect(subjectBySlug("artificial-intelligence")?.openalex).toEqual({
      level: "subfield",
      id: "1702",
      name: "Artificial Intelligence",
      fieldId: "17",
    });
    expect(subjectBySlug("mathematics")?.arxivCategories).toEqual(["math.*"]);
    expect(subjectBySlug("physics")?.openalex.name).toBe("Physics and Astronomy");
    for (const s of SUBJECTS) for (const c of s.arxivCategories) expect(c).toMatch(/^[a-z-]{2,20}(?:\.[A-Za-z-]{2,20}|\.\*)?$/);
    expect(SUBJECTS.filter((s) => s.arxivCategories.length > 0).every((s) => s.primary)).toBe(true);
    expect(openAlexSubjectFilter(subjectBySlug("artificial-intelligence")!)).toEqual({ subfieldId: "1702" });
    expect(openAlexSubjectFilter(subjectBySlug("chemistry")!)).toEqual({ fieldId: "16" });
  });

  it("orders chosen subjects: primary first, then by name, ignoring unknown and repeated slugs", () => {
    expect(orderSubjects(["psychology", "physics", "chemistry", "nope", "mathematics", "chemistry"]).map((s) => s.slug)).toEqual([
      "mathematics",
      "physics",
      "chemistry",
      "psychology",
    ]);
    expect(isSubjectSlug("physics")).toBe(true);
    expect(isSubjectSlug("../physics")).toBe(false);
    expect(subjectBySlug("nope")).toBeNull();
  });

  it("finds the subject of a work's OpenAlex classification", () => {
    expect(subjectForOpenAlex("17", "1702")?.slug).toBe("artificial-intelligence");
    expect(subjectForOpenAlex("17", "1703")?.slug).toBe("computer-science");
    expect(subjectForOpenAlex("31", null)?.slug).toBe("physics");
    expect(subjectForOpenAlex("99", null)).toBeNull();
  });

  it("picks Surprise me fields outside the owner's subjects, deterministically", () => {
    const outside = fieldsOutside(DEFAULT_SUBJECT_SLUGS);
    expect(outside).toHaveLength(23);
    expect(outside.some((s) => ["17", "26", "31"].includes(s.openalex.fieldId))).toBe(false);
    expect(surpriseField(DEFAULT_SUBJECT_SLUGS, 5)).toEqual(surpriseField(DEFAULT_SUBJECT_SLUGS, 5));
    expect(
      surpriseField(
        SUBJECTS.map((s) => s.slug),
        5,
      ),
    ).toBeNull();
    // Choosing only artificial intelligence still excludes its field, computer science.
    expect(fieldsOutside(["artificial-intelligence"]).some((s) => s.openalex.fieldId === "17")).toBe(false);
  });
});
