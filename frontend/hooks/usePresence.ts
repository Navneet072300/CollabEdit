"use client";

import { useEffect, useRef, useCallback } from "react";
import { useEditorStore } from "@/store/editorStore";
import type { CursorPos } from "@/lib/types";

const PRESENCE_PING_INTERVAL = 15_000; // refresh TTL every 15s
const PRESENCE_DEBOUNCE_MS = 50;       // debounce cursor sends

export function usePresence(
  send: (msg: unknown) => void,
  userId: string,
  userName: string,
  color: string,
) {
  const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCursor = useRef<CursorPos | null>(null);

  const sendPresence = useCallback((cursor: CursorPos) => {
    send({ type: "presence", cursor, user_id: userId, user_name: userName, color });
  }, [send, userId, userName, color]);

  // Debounced cursor update
  const updateCursor = useCallback((cursor: CursorPos) => {
    lastCursor.current = cursor;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      sendPresence(cursor);
    }, PRESENCE_DEBOUNCE_MS);
  }, [sendPresence]);

  // Periodic ping to keep Redis TTL alive
  useEffect(() => {
    pingTimer.current = setInterval(() => {
      if (lastCursor.current) {
        sendPresence(lastCursor.current);
      }
    }, PRESENCE_PING_INTERVAL);

    return () => {
      if (pingTimer.current) clearInterval(pingTimer.current);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [sendPresence]);

  return { updateCursor };
}
