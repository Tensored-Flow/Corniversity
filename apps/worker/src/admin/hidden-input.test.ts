import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { askHidden } from "./hidden-input";

describe("the hidden password prompt", () => {
  it("shows only the prompt, even when the typed line is redrawn after an edit", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    let shown = "";
    output.on("data", (chunk: Buffer) => {
      shown += chunk.toString();
    });
    const answer = askHidden("New password: ", input, output);
    input.write("correct-horse");
    input.write("\x7f\x7f"); // two Backspaces, after which the line editor redraws the line
    input.write("se-battery\r");
    expect(await answer).toBe("correct-horse-battery");
    expect(shown).toBe("New password: \n");
  });
});
