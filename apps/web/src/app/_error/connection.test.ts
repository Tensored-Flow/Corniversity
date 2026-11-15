import { describe, expect, it } from "vitest";
import { isConnectionFailure } from "./connection";

describe("isConnectionFailure (the error page's offline wording)", () => {
  it("is a connection failure whenever the browser says it is offline", () => {
    expect(isConnectionFailure(new Error("An error occurred in the Server Components render."), false)).toBe(true);
  });

  it("recognises each browser's failed fetch while online (the connection dropped mid-request)", () => {
    for (const message of ["Failed to fetch", "NetworkError when attempting to fetch resource.", "Load failed"])
      expect(isConnectionFailure(new TypeError(message), true), message).toBe(true);
  });

  it("is not a connection failure for an error from the server or the page's own code", () => {
    const server = Object.assign(new Error("An error occurred in the Server Components render."), { digest: "123" });
    expect(isConnectionFailure(server, true)).toBe(false);
    expect(isConnectionFailure(new TypeError("Cannot read properties of undefined (reading 'x')"), true)).toBe(false);
    expect(isConnectionFailure(new Error("Failed to fetch"), true)).toBe(false);
    expect(isConnectionFailure("Failed to fetch", true)).toBe(false);
  });
});
