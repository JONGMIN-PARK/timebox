/// <reference types="vite/client" />
import { io, Socket } from "socket.io-client";

const SERVER_URL = (import.meta as any).env?.DEV
  ? "http://localhost:3001"
  : window.location.origin;

let socket: Socket | null = null;

function createSocket(): Socket {
  const token = localStorage.getItem("timebox_token");

  socket = io(SERVER_URL, {
    auth: { token },
    reconnection: true,
  });

  return socket;
}

export function getSocket(): Socket {
  if (!socket) {
    return createSocket();
  }
  return socket;
}

export function connectSocket(): void {
  if (socket?.connected) return;

  if (socket) {
    // Update token before reconnecting
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
