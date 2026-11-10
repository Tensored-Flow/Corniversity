import { describe, expect, it } from "vitest";
import { personaStream } from "./persona-stream";

describe("a streamed persona reply", () => {
  it("is read in full and finished once while the browser stays", async () => {
    const finished: { raw: string; outcome: string }[] = [];
    const stream = personaStream({
      prefix: "Note. ",
      produce: async function* () {
        yield "First ";
        yield "second.";
        return "billed";
      },
      finish: async (raw, outcome) => {
        finished.push({ raw, outcome });
      },
    });
    expect(await new Response(stream).text()).toBe("Note. First second.");
    expect(finished).toEqual([{ raw: "Note. First second.", outcome: "billed" }]);
  });

  it("runs to its end and is still finished when the browser leaves mid-reply", async () => {
    let release = () => {};
    const rest = new Promise<void>((resolve) => {
      release = resolve;
    });
    const finished = new Promise<{ raw: string; outcome: string }>((resolve) => {
      const stream = personaStream({
        produce: async function* () {
          yield "First ";
          await rest;
          yield "second ";
          yield "third.";
          return "billed";
        },
        finish: async (raw, outcome) => resolve({ raw, outcome }),
      });
      const reader = stream.getReader();
      void reader.read().then(async () => {
        await reader.cancel();
        release();
      });
    });
    expect(await finished).toEqual({ raw: "First second third.", outcome: "billed" });
  });
});
