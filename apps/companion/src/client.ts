import { VERSION } from "./config";
import { backoffDelay } from "./scan";

export class CompanionError extends Error {
  constructor(
    readonly kind: "unauthorised" | "rejected" | "server" | "network",
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "CompanionError";
  }
}

export interface PendingTask {
  assetId: string;
  sha256: string;
  localPathHint: string | null;
}

export interface RegisterInput {
  filename: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  candidateMetadata: { title?: string; author?: string; pageCount?: number; producer?: string };
  localPathHint: string;
  departmentHint?: string;
}

export interface RegisterResponse {
  assetId: string;
  status: string;
  outcome: "registered" | "duplicate" | "known";
  storage: "none" | "requested" | "stored";
}

export interface HeartbeatStatus {
  watching: boolean;
  /** True only when a running watcher has been paused with `pause`; a one-shot sync never sets it. */
  paused?: boolean;
  pendingFiles: number;
  version: string;
  reportedAt: string;
}

/**
 * Outbound HTTPS only: the companion calls the university; nothing listens on the desktop.
 * Network failures and 5xx responses are retried with exponential back-off; 4xx responses are
 * final (a refused token is reported, not retried, so a revoked device stops at once).
 */
export class CompanionClient {
  constructor(
    private readonly server: string,
    private readonly token: string | null,
  ) {}

  private async request<T>(path: string, init: RequestInit & { retries?: number } = {}): Promise<T> {
    const retries = init.retries ?? 4;
    for (let attempt = 1; ; attempt++) {
      try {
        const headers = new Headers(init.headers);
        if (this.token) headers.set("authorization", `Bearer ${this.token}`);
        headers.set("user-agent", `corniversity-companion/${VERSION}`);
        const response = await fetch(new URL(path, this.server), { ...init, headers });
        if (response.ok) return (await response.json()) as T;
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (response.status === 401 || response.status === 403) {
          throw new CompanionError("unauthorised", body.error ?? "The device token was refused. Pair again from the Library page.", false);
        }
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new CompanionError("rejected", body.error ?? `The server refused the request (${response.status}).`, false);
        }
        throw new CompanionError("server", body.error ?? `Server error (${response.status}).`, true);
      } catch (error) {
        const wrapped = error instanceof CompanionError ? error : new CompanionError("network", error instanceof Error ? error.message : String(error), true);
        if (!wrapped.retryable || attempt > retries) throw wrapped;
        await new Promise((r) => setTimeout(r, backoffDelay(attempt)));
      }
    }
  }

  pair(code: string, deviceName: string, roots: string[]): Promise<{ token: string; pairingId: string; deviceName: string }> {
    return this.request("/api/companion/pair", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, deviceName, roots }),
      retries: 1,
    });
  }

  heartbeat(status: HeartbeatStatus): Promise<{ pending: PendingTask[]; serverTime: string }> {
    return this.request("/api/companion/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(status) });
  }

  whoami(): Promise<{ deviceName: string; roots: string[]; pending: number; serverTime: string }> {
    return this.request("/api/companion/status", { method: "GET", retries: 1 });
  }

  register(input: RegisterInput): Promise<RegisterResponse> {
    return this.request("/api/companion/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  }

  upload(assetId: string, bytes: Buffer, filename: string, mediaType: string): Promise<{ status: string; outcome: string }> {
    return this.request("/api/companion/upload", {
      method: "POST",
      headers: { "content-type": mediaType, "x-asset-id": assetId, "x-filename": encodeURIComponent(filename) },
      body: new Uint8Array(bytes),
      retries: 2,
    });
  }
}
