import { describe, expect, it } from "vitest";
import { boundedTeachingText, TUTOR_ATTEMPT_CHARACTERS } from "./context";

describe("bounded tutorial context", () => {
  it("keeps a long proof, including its conclusion beyond the former 1,500-character boundary", () => {
    const proof = `${"A premise. ".repeat(600)}Therefore the operator is continuous.`;
    const got = boundedTeachingText(proof, TUTOR_ATTEMPT_CHARACTERS);
    expect(got.text).toBe(proof);
    expect(got.truncated).toBe(false);
  });
  it("retains opening assumptions and a selected interior inference when a proof is too long", () => {
    const proof = `Assume completeness. ${"x".repeat(25_000)}SELECTED INFERENCE${"y".repeat(25_000)}Final claim.`;
    const got = boundedTeachingText(proof, TUTOR_ATTEMPT_CHARACTERS, "SELECTED INFERENCE");
    expect(got.text).toContain("Assume completeness.");
    expect(got.text).toContain("SELECTED INFERENCE");
    expect(got.text).toContain("CONTEXT OMITTED");
    expect(got.note).toContain("do not assess");
    expect(got.text.length).toBeLessThan(TUTOR_ATTEMPT_CHARACTERS + 200);
  });
  it("preserves the conclusion and discloses omissions without a selection", () => {
    const proof = `Assume compactness. ${"x".repeat(25_000)}CONCLUSION`;
    const got = boundedTeachingText(proof, 4_000);
    expect(got.text).toContain("Assume compactness.");
    expect(got.text).toContain("CONCLUSION");
    expect(got.truncated).toBe(true);
    expect(got.note).toContain("Excerpt only");
  });
});
