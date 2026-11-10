import { createInterface } from "node:readline";
import { Writable } from "node:stream";

export class InputCancelled extends Error {}

/**
 * Reads one line without showing it. The prompt goes to `output`; the line editor, which redraws
 * the typed line after every edit (Backspace, a wrapped line), writes only to a sink, and in a
 * terminal the input is raw, so the terminal does not echo either.
 */
export function askHidden(
  prompt: string,
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
): Promise<string> {
  output.write(prompt);
  const sink = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  return new Promise((resolve, reject) => {
    const rl = createInterface({ input, output: sink, terminal: true });
    rl.on("SIGINT", () => {
      rl.close();
      output.write("\n");
      reject(new InputCancelled("Cancelled."));
    });
    rl.question("", (answer) => {
      rl.close();
      output.write("\n");
      resolve(answer);
    });
  });
}
