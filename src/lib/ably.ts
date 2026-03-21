import * as Ably from "ably";

let realtimeClient: Ably.Realtime | null = null;

export function getAblyRealtimeClient(): Ably.Realtime {
  if (!realtimeClient) {
    realtimeClient = new Ably.Realtime({
      authUrl: "/api/ably-token",
      authMethod: "GET",
      autoConnect: false,
      // When Ably auth fails (e.g. 503 when ABLY_API_KEY not set),
      // don't keep retrying — just stay disconnected.
      authCallback: async (_data, callback) => {
        try {
          const res = await fetch("/api/ably-token");
          if (!res.ok) {
            // Non-retryable error — Ably will move to "failed" state
            callback(new Error(`Ably auth failed: ${res.status}`), null);
            return;
          }
          const tokenRequest = await res.json();
          callback(null, tokenRequest);
        } catch (err) {
          callback(err as Error, null);
        }
      },
    });
  }
  return realtimeClient;
}

// Server-side REST client for publishing from server actions
let restClient: Ably.Rest | null = null;

// No-op stub when Ably is not configured (e.g. CI/test)
const noopChannel = { publish: async () => {} };
const noopClient = { channels: { get: () => noopChannel } } as unknown as Ably.Rest;

export function getAblyRestClient(): Ably.Rest {
  if (!process.env.ABLY_API_KEY) return noopClient;
  if (!restClient) {
    restClient = new Ably.Rest(process.env.ABLY_API_KEY);
  }
  return restClient;
}
