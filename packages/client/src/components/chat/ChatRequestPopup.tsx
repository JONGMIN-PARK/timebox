import { useEffect, useState, useCallback, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { api } from "@/lib/api";
import { MessageCircle, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatRequest {
  fromUserId: number;
  fromUserName?: string;
  timestamp: number;
}

interface ChatRequestPopupProps {
  onAccept: (roomId: number) => void;
}

const AUTO_DISMISS_MS = 30_000;

export default function ChatRequestPopup({ onAccept }: ChatRequestPopupProps) {
  const [requests, setRequests] = useState<ChatRequest[]>([]);
  const [dismissing, setDismissing] = useState<Set<number>>(new Set());
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const removeRequest = useCallback((fromUserId: number) => {
    setDismissing((prev) => {
      const next = new Set(prev);
      next.add(fromUserId);
      return next;
    });
    // Wait for exit animation before removing from list
    setTimeout(() => {
      setRequests((prev) => prev.filter((r) => r.fromUserId !== fromUserId));
      setDismissing((prev) => {
        const next = new Set(prev);
        next.delete(fromUserId);
        return next;
      });
    }, 300);

    const timer = timersRef.current.get(fromUserId);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(fromUserId);
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const handleChatRequest = async (data: {
      fromUserId: number;
      fromUserName?: string;
    }) => {
      let name = data.fromUserName;

      // Fetch user name if not provided
      if (!name) {
        try {
          const res = await api.get<{ name: string; email: string }>(
            `/users/${data.fromUserId}`,
          );
          if (res.success && res.data) {
            name = res.data.name;
          }
        } catch {
          // Fallback to userId
        }
      }

      const request: ChatRequest = {
        fromUserId: data.fromUserId,
        fromUserName: name || `User #${data.fromUserId}`,
        timestamp: Date.now(),
      };

      setRequests((prev) => {
        // Don't add duplicate requests from the same user
        if (prev.some((r) => r.fromUserId === data.fromUserId)) return prev;
        return [...prev, request];
      });

      // Auto-dismiss after 30 seconds
      const timer = setTimeout(() => {
        removeRequest(data.fromUserId);
      }, AUTO_DISMISS_MS);
      timersRef.current.set(data.fromUserId, timer);
    };

    socket.on("chat:request", handleChatRequest);

    return () => {
      socket.off("chat:request", handleChatRequest);
      // Clear all auto-dismiss timers
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [removeRequest]);

  const handleAccept = async (request: ChatRequest) => {
    const socket = getSocket();

    try {
      const res = await api.post<{ id: number }>("/chat/direct", {
        targetUserId: request.fromUserId,
      });

      if (res.success && res.data) {
        const roomId = res.data.id;

        socket.emit("chat:request:accept", {
          targetUserId: request.fromUserId,
          roomId,
        });

        removeRequest(request.fromUserId);
        onAccept(roomId);
      }
    } catch {
      // Handle error silently
    }
  };

  const handleDecline = (request: ChatRequest) => {
    const socket = getSocket();

    socket.emit("chat:request:decline", {
      targetUserId: request.fromUserId,
    });

    removeRequest(request.fromUserId);
  };

  if (requests.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
      {requests.map((request) => {
        const isDismissing = dismissing.has(request.fromUserId);

        return (
          <div
            key={request.fromUserId}
            className={cn(
              "w-80 rounded-xl border border-gray-200 bg-white/80 p-4 shadow-xl backdrop-blur-md",
              "dark:border-gray-700 dark:bg-gray-800/80",
              "transition-all duration-300 ease-out",
              isDismissing
                ? "translate-x-full opacity-0"
                : "animate-slide-in-right translate-x-0 opacity-100",
            )}
          >
            {/* Header */}
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
                <MessageCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                채팅 요청
              </span>
            </div>

            {/* Body */}
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              <span className="font-medium text-gray-900 dark:text-white">
                {request.fromUserName}
              </span>
              님이 채팅을 요청했습니다.
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAccept(request)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium",
                  "bg-green-600 text-white hover:bg-green-700",
                  "dark:bg-green-600 dark:hover:bg-green-500",
                  "transition-colors duration-150",
                )}
              >
                <Check className="h-4 w-4" />
                수락
              </button>
              <button
                onClick={() => handleDecline(request)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium",
                  "bg-gray-200 text-gray-700 hover:bg-gray-300",
                  "dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600",
                  "transition-colors duration-150",
                )}
              >
                <X className="h-4 w-4" />
                거절
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
