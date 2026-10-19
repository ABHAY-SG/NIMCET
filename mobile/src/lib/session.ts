// Cross-module signal for auth failures detected outside React (the API layer).
//
// api.ts raises `unauthorized` when a protected call is rejected even after a
// token refresh; the AuthProvider listens, clears the dead session, and shows
// the reason on the login screen. Keeping this out of React avoids importing
// hooks into the fetch client.

export type UnauthorizedReason = "expired";

type Listener = (reason: UnauthorizedReason) => void;

const listeners = new Set<Listener>();

export function onUnauthorized(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitUnauthorized(reason: UnauthorizedReason): void {
  for (const listener of [...listeners]) {
    try {
      listener(reason);
    } catch {
      /* a broken listener must never break the caller */
    }
  }
}
