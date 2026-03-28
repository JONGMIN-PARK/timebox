import { Server, type Socket } from "socket.io";
import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === "production" ? "" : "dev-secret-change-me");

// ── Online presence tracking ──────────────────────────────────────────
// Maps userId to the set of socket IDs for that user (supports multiple tabs/devices)
const onlineUsers = new Map<number, Set<string>>();

let io: Server | null = null;

// ── Authenticated socket type ─────────────────────────────────────────
interface AuthenticatedSocket extends Socket {
  data: {
    userId: number;
  };
}

// ── Initialise Socket.io server ───────────────────────────────────────
export function initSocket(httpServer: HttpServer): Server {
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : undefined;

  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin ?? "*",
      credentials: true,
    },
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  // ── JWT authentication middleware ─────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
      (socket as AuthenticatedSocket).data.userId = payload.userId;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  // ── Connection handler ────────────────────────────────────────────
  io.on("connection", (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const userId = socket.data.userId;

    // Track this socket
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    // Broadcast updated online list to everyone
    broadcastOnlineUsers();

    console.log(
      `[socket] User ${userId} connected (socket ${socket.id}, ` +
        `${onlineUsers.get(userId)!.size} active connection(s))`
    );

    // ── Chat room events ──────────────────────────────────────────

    socket.on("chat:join", (roomId: string) => {
      if (!roomId || typeof roomId !== "string") return;
      socket.join(roomId);
      socket.to(roomId).emit("chat:user-joined", { userId, roomId });
    });

    socket.on("chat:leave", (roomId: string) => {
      if (!roomId || typeof roomId !== "string") return;
      socket.leave(roomId);
      socket.to(roomId).emit("chat:user-left", { userId, roomId });
    });

    socket.on(
      "chat:message",
      (data: { roomId: string; message: unknown }) => {
        if (!data?.roomId || typeof data.roomId !== "string") return;
        // Broadcast to everyone in the room (including sender for confirmation)
        io!.to(data.roomId).emit("chat:message", {
          userId,
          roomId: data.roomId,
          message: data.message,
          timestamp: new Date().toISOString(),
        });
      }
    );

    socket.on("chat:typing", (data: { roomId: string; typing: boolean }) => {
      if (!data?.roomId || typeof data.roomId !== "string") return;
      socket.to(data.roomId).emit("chat:typing", {
        userId,
        roomId: data.roomId,
        typing: data.typing ?? true,
      });
    });

    // ── 1:1 Chat request flow ─────────────────────────────────────

    socket.on(
      "chat:request",
      (data: { targetUserId: number; metadata?: unknown }) => {
        if (!data?.targetUserId || typeof data.targetUserId !== "number") return;

        const targetSockets = onlineUsers.get(data.targetUserId);
        if (!targetSockets || targetSockets.size === 0) {
          socket.emit("chat:request:error", {
            targetUserId: data.targetUserId,
            error: "User is offline",
          });
          return;
        }

        // Deliver the request to all of the target user's connections
        for (const sid of targetSockets) {
          io!.to(sid).emit("chat:request", {
            fromUserId: userId,
            metadata: data.metadata,
          });
        }
      }
    );

    socket.on(
      "chat:request:accept",
      (data: { targetUserId: number; roomId: string }) => {
        if (
          !data?.targetUserId ||
          typeof data.targetUserId !== "number" ||
          !data?.roomId ||
          typeof data.roomId !== "string"
        )
          return;

        const targetSockets = onlineUsers.get(data.targetUserId);
        if (targetSockets) {
          for (const sid of targetSockets) {
            io!.to(sid).emit("chat:request:accepted", {
              fromUserId: userId,
              roomId: data.roomId,
            });
          }
        }

        // Auto-join both users into the room
        socket.join(data.roomId);
        if (targetSockets) {
          for (const sid of targetSockets) {
            io!.in(sid).socketsJoin(data.roomId);
          }
        }
      }
    );

    socket.on(
      "chat:request:decline",
      (data: { targetUserId: number; reason?: string }) => {
        if (!data?.targetUserId || typeof data.targetUserId !== "number")
          return;

        const targetSockets = onlineUsers.get(data.targetUserId);
        if (targetSockets) {
          for (const sid of targetSockets) {
            io!.to(sid).emit("chat:request:declined", {
              fromUserId: userId,
              reason: data.reason,
            });
          }
        }
      }
    );

    // ── Project room events ──────────────────────────────────────

    socket.on("project:join", (projectId: number) => {
      if (typeof projectId !== "number") return;
      socket.join(`project-${projectId}`);
    });

    socket.on("project:leave", (projectId: number) => {
      if (typeof projectId !== "number") return;
      socket.leave(`project-${projectId}`);
    });

    // ── Disconnection ─────────────────────────────────────────────

    socket.on("disconnect", (reason: string) => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
        }
      }

      broadcastOnlineUsers();

      console.log(
        `[socket] User ${userId} disconnected (${reason}, ` +
          `${onlineUsers.get(userId)?.size ?? 0} remaining connection(s))`
      );
    });
  });

  console.log("[socket] Socket.io server initialised");
  return io;
}

// ── Broadcast helpers ─────────────────────────────────────────────────

function broadcastOnlineUsers(): void {
  if (!io) return;
  io.emit("presence:online", { userIds: getOnlineUserIds() });
}

// ── Exported helpers ──────────────────────────────────────────────────

/** Returns an array of user IDs that currently have at least one active socket. */
export function getOnlineUserIds(): number[] {
  return Array.from(onlineUsers.keys());
}

/** Checks whether the given user has at least one active socket connection. */
export function isUserOnline(userId: number): boolean {
  const sockets = onlineUsers.get(userId);
  return !!sockets && sockets.size > 0;
}

/** Emits an event to every socket belonging to the specified user. */
export function emitToUser(userId: number, event: string, data: unknown): void {
  if (!io) return;
  const sockets = onlineUsers.get(userId);
  if (!sockets) return;
  for (const sid of sockets) {
    io.to(sid).emit(event, data);
  }
}

/** Returns the underlying Socket.io Server instance (or null before init). */
export function getIO(): Server | null {
  return io;
}
