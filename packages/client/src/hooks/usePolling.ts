import { useEffect, useRef } from "react";

/**
 * @deprecated Prefer WebSocket events via `getSocket().on(...)` for real-time updates.
 * This hook is kept as a fallback for cases where socket connectivity is unreliable
 * or for data that doesn't have a corresponding socket event.
 */
export function usePolling(fn: () => void | Promise<void>, intervalMs: number, enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    fnRef.current();
    const id = setInterval(() => fnRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
