/**
 * The body of a streamed persona reply. The turn runs to its end whether or not the browser stays
 * to read it: a learner who closes the tab mid-reply has still been billed for the run, so
 * `finish` (which records the run and stores the reply) is called after a cancelled response too.
 */
export function personaStream<T>(input: {
  prefix?: string;
  produce: () => AsyncGenerator<string, T, void>;
  finish: (raw: string, outcome: T) => Promise<void>;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let reading = true;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => {
        if (!reading || text.length === 0) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          reading = false; // cancelled between the check and the write
        }
      };
      let raw = input.prefix ?? "";
      send(raw);
      const generator = input.produce();
      let next = await generator.next();
      while (!next.done) {
        raw += next.value;
        send(next.value);
        next = await generator.next();
      }
      await input.finish(raw, next.value);
      if (reading) controller.close();
    },
    cancel() {
      reading = false;
    },
  });
}
