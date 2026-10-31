import { describe, expect, it } from "vitest";
import { assertSafeServerUrl } from "./config";

describe("assertSafeServerUrl", () => {
  it("accepts https anywhere and plain http only on this computer", () => {
    expect(assertSafeServerUrl("https://my-university.up.railway.app").hostname).toBe("my-university.up.railway.app");
    expect(assertSafeServerUrl("http://localhost:3000").port).toBe("3000");
    expect(assertSafeServerUrl("http://127.0.0.1:3000").hostname).toBe("127.0.0.1");
  });

  it("refuses to send the device token in clear to a remote server", () => {
    expect(() => assertSafeServerUrl("http://my-university.up.railway.app")).toThrow(/https/);
    expect(() => assertSafeServerUrl("ftp://localhost")).toThrow(/https/);
  });
});
