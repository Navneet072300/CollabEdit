"use client";

import { useEffect, useRef, useCallback } from "react";
import { WSClient, type ConnectionStatus } from "@/lib/ws/client";
import type { ServerMessage } from "@/lib/types";

interface UseWebSocketOptions {
  roomId: string;
  userId: string;
  userName: string;
  onMessage: (msg: ServerMessage) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  enabled: boolean;
}

export function useWebSocket({
  roomId,
  userId,
  userName,
  onMessage,
  onStatusChange,
  enabled,
}: UseWebSocketOptions) {
  const clientRef = useRef<WSClient | null>(null);

  useEffect(() => {
    if (!enabled || !roomId) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ||
      (typeof window !== "undefined" ? window.location.origin : "http://localhost:8000");
    const wsBase = apiUrl.replace(/^http/, "ws");
    const url = `${wsBase}/ws/${roomId}?user_id=${encodeURIComponent(userId)}&user_name=${encodeURIComponent(userName)}`;

    const client = new WSClient({
      url,
      onMessage: (raw) => onMessage(raw as ServerMessage),
      onStatusChange,
    });

    clientRef.current = client;

    return () => {
      client.close();
      clientRef.current = null;
    };
  }, [enabled, roomId, userId, userName]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback((msg: unknown) => {
    clientRef.current?.send(msg);
  }, []);

  return { send };
}
