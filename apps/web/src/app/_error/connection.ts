/**
 * Whether a page error means the browser could not reach the server: it is offline, or a request
 * (a server action, a page's data) failed in the network. Browsers reject such a fetch with a
 * TypeError whose words differ: "Failed to fetch" (Chromium), "NetworkError when attempting to fetch
 * resource." (Firefox), "Load failed" (Safari). An error from the server arrives as an ordinary Error
 * with a digest, never as one of these.
 */
export function isConnectionFailure(error: unknown, online: boolean): boolean {
  if (!online) return true;
  return error instanceof TypeError && /failed to fetch|networkerror|load failed|network request failed/i.test(error.message);
}
