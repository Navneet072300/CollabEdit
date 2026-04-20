"use client";

import { hexToRgba } from "@/lib/utils/colors";
import type { UserPresence } from "@/lib/types";

interface Props {
  user: UserPresence;
  isSelf?: boolean;
}

export function UserAvatar({ user, isSelf }: Props) {
  const initials = user.user_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      title={`${user.user_name}${isSelf ? " (you)" : ""}${
        user.cursor ? ` — line ${user.cursor.line + 1}` : ""
      }`}
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: hexToRgba(user.color, 0.2),
        border: `2px solid ${user.color}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 600,
        color: user.color,
        fontFamily: "var(--font-sans)",
        cursor: "default",
        flexShrink: 0,
        transition: "border-color 0.2s",
        boxShadow: isSelf ? `0 0 8px ${hexToRgba(user.color, 0.4)}` : undefined,
      }}
    >
      {initials}
    </div>
  );
}
