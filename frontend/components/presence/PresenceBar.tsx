"use client";

import { useEditorStore } from "@/store/editorStore";
import { UserAvatar } from "./UserAvatar";
import { userColor } from "@/lib/utils/colors";
import type { UserPresence } from "@/lib/types";

interface Props {
  userId: string;
  userName: string;
}

export function PresenceBar({ userId, userName }: Props) {
  const presence = useEditorStore((s) => s.presence);
  const status = useEditorStore((s) => s.status);
  const color = userColor(userId);

  const selfUser: UserPresence = { user_id: userId, user_name: userName, color, cursor: null };
  const others = Object.values(presence);

  const statusColor =
    status === "connected"
      ? "var(--status-green)"
      : status === "reconnecting"
      ? "var(--status-yellow)"
      : "var(--status-red)";

  const statusLabel =
    status === "connected"
      ? "Connected"
      : status === "reconnecting"
      ? "Reconnecting…"
      : "Disconnected";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 16px",
        height: "100%",
      }}
    >
      {/* Connection status dot */}
      <div
        title={statusLabel}
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: statusColor,
          flexShrink: 0,
          boxShadow: status === "connected" ? `0 0 6px ${statusColor}` : undefined,
          transition: "background 0.3s",
        }}
      />

      <span
        style={{
          fontSize: 11,
          color: "var(--text-secondary)",
          fontFamily: "var(--font-sans)",
          marginRight: 8,
        }}
      >
        {others.length + 1} online
      </span>

      {/* Avatars — self first, then others */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <UserAvatar user={selfUser} isSelf />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexDirection: "row-reverse",
          }}
        >
          {others.map((u) => (
            <div
              key={u.user_id}
              className="animate-fade-in"
              style={{ display: "flex", alignItems: "center" }}
            >
              <UserAvatar user={u} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
