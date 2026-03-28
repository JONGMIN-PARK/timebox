import { io, Socket } from "socket.io-client";

const SERVER_URL = import.meta.env?.DEV
  ? "http://localhost:3001"
  : window.location.origin;

let socket: Socket | null = null;

function createSocket(): Socket {
  const token = localStorage.getItem("timebox_token");

  socket = io(SERVER_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect", () => {
    console.log("[socket] connected");
    // Request missed messages since last seen
    const lastSeen = localStorage.getItem("timebox_last_seen");
    if (lastSeen) {
      socket!.emit("sync:missed", { since: lastSeen });
    }
  });

  socket.on("disconnect", () => {
    console.log("[socket] disconnected");
  });

  // Track last activity for missed message sync
  socket.onAny(() => {
    localStorage.setItem("timebox_last_seen", new Date().toISOString());
  });

  return socket;
}

export function getSocket(): Socket {
  if (!socket) return createSocket();
  return socket;
}

export function connectSocket(): void {
  if (socket?.connected) return;
  if (socket) {
    const token = localStorage.getItem("timebox_token");
    socket.auth = { token };
    socket.connect();
  } else {
    createSocket();
  }
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
