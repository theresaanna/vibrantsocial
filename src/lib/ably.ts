import * as Ably from "ably";

let realtimeClient: Ably.Realtime | null = null;

export function getAblyRealtimeClient(): Ably.Realtime {
  if (!realtimeClient) {
    realtimeClient = new Ably.Realtime({
      authUrl: "/api/ably-token",
      autoConnect: false,
    });
  }
  return realtimeClient;
}

// Server-side REST client for publishing from server actions
let restClient: Ably.Rest | null = null;

export function getAblyRestClient(): Ably.Rest {
  if (!restClient) {
    restClient = new Ably.Rest(process.env.ABLY_API_KEY!);
  }
  return restClient;
}
