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
