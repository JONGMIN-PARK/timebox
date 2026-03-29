import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const SERVER_URL = import.meta.env?.DEV
  ? "http://localhost:3001"
  : window.location.origin;

// ── Context ──

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
});

// ── Provider ──

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("timebox_token");

    const sock = io(SERVER_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    setSocket(sock);

    sock.on("connect", () => {
      console.log("[socket] connected");
      setConnected(true);
      // Request missed messages since last seen
      const lastSeen = localStorage.getItem("timebox_last_seen");
      if (lastSeen) {
        sock.emit("sync:missed", { since: lastSeen });
      }
    });

    sock.on("disconnect", () => {
      console.log("[socket] disconnected");
      setConnected(false);
    });

    // Track last activity for missed message sync
    sock.onAny(() => {
      localStorage.setItem("timebox_last_seen", new Date().toISOString());
    });

    return () => {
      sock.disconnect();
      setSocket(null);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

// ── Hooks ──

/**
 * Returns the socket instance from context.
 * May be null if used outside SocketProvider or before connection.
 */
export function useSocket(): Socket | null {
  const { socket } = useContext(SocketContext);
  return socket;
}

/**
 * Returns the socket connection status.
 */
export function useSocketConnected(): boolean {
  const { connected } = useContext(SocketContext);
  return connected;
}

/**
 * Subscribe to a socket event with automatic cleanup.
 * The handler is stable-ref'd so it won't cause re-subscriptions
 * when the handler reference changes.
 */
export function useSocketEvent<T = any>(
  event: string,
  handler: (data: T) => void,
) {
  const { socket } = useContext(SocketContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket) return;

    const listener = (data: T) => {
      handlerRef.current(data);
    };

    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}
