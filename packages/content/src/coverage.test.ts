import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { coverageTables, withCoverage } from "./coverage";
import { defaultContentRoot, loadContent } from "./load";

const bundle = loadContent(defaultContentRoot());
const tables = coverageTables(bundle, "mind-and-computation");
const rowsUnder = (text: string, heading: string) => {
  const section = `\n${text}`.split("\n### ").find((s) => s.startsWith(heading)) ?? "";
  return section
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| ---") && !/^\| (Block|Elective|Method|Source|Lead) \|/.test(line));
};

describe("the generated coverage tables", () => {
  it("are the ones committed in docs/MIND_BRAIN_AI.md (regenerate with pnpm content:coverage)", () => {
    const document = readFileSync(resolve(defaultContentRoot(), "..", "docs", "MIND_BRAIN_AI.md"), "utf8");
    expect(withCoverage(document, tables)).toBe(document);
  });

  it("have one row for each of the twelve blocks, eight electives and eight methods", () => {
    expect(rowsUnder(tables, "Blocks")).toHaveLength(12);
    expect(rowsUnder(tables, "Electives")).toHaveLength(8);
    expect(rowsUnder(tables, "Modelling methods")).toHaveLength(8);
  });

  it("list a shelf name without a source record as a lead, never as a verified source", () => {
    const changed = structuredClone(bundle);
    const block = changed.programmes.find((p) => p.id === "mind-and-computation")!.blocks![0]!;
    block.sourceShelf.push({ candidate: "An unregistered handbook", role: "supplement", note: "Named in a test." });
    const text = coverageTables(changed, "mind-and-computation");
    expect(rowsUnder(text, "Leads awaiting resolution").some((row) => row.startsWith("| An unregistered handbook | MBI-01 shelf |"))).toBe(
      true,
    );
    expect(rowsUnder(text, "Sources on the block shelves").some((row) => row.includes("unregistered handbook"))).toBe(false);
  });
});
