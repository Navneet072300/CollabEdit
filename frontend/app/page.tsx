"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { Code2, Users, Zap, ArrowRight, Plus } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "";

function getOrCreateUser(): { userId: string; userName: string } {
  if (typeof window === "undefined") return { userId: "", userName: "" };
  const stored = localStorage.getItem("collab_user");
  if (stored) {
    try { return JSON.parse(stored); } catch {}
  }
  const userId = nanoid();
  const userName = `user_${userId.slice(0, 6)}`;
  const user = { userId, userName };
  localStorage.setItem("collab_user", JSON.stringify(user));
  return user;
}

export default function HomePage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const { userId, userName } = getOrCreateUser();
    setUserId(userId);
    setUserName(userName);
  }, []);

  async function createRoom() {
    if (!userName.trim()) return;
    setLoading(true);
    setError("");
    try {
      // Persist user name
      localStorage.setItem("collab_user", JSON.stringify({ userId, userName: userName.trim() }));

      const res = await fetch(`${API}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${userName.trim()}'s room`, language: "python" }),
      });
      if (!res.ok) throw new Error("Failed to create room");
      const room = await res.json();
      router.push(`/room/${room.code}`);
    } catch (e) {
      setError("Could not create room. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  async function joinRoom() {
    const code = roomCode.trim().toUpperCase();
    if (!code || !userName.trim()) return;
    setLoading(true);
    setError("");
    try {
      localStorage.setItem("collab_user", JSON.stringify({ userId, userName: userName.trim() }));
      const res = await fetch(`${API}/api/rooms/${code}`);
      if (!res.ok) throw new Error("Room not found");
      router.push(`/room/${code}`);
    } catch {
      setError("Room not found. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--bg-base)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Background grid */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: `radial-gradient(circle at 1px 1px, var(--bg-border) 1px, transparent 0)`,
          backgroundSize: "32px 32px",
          opacity: 0.4,
          pointerEvents: "none",
        }}
      />

      {/* Glow blob */}
      <div
        style={{
          position: "fixed",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 600,
          height: 400,
          background: "radial-gradient(ellipse, rgba(34,211,238,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 440,
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        {/* Logo + headline */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
              padding: "8px 16px",
              background: "var(--accent-glow)",
              border: "1px solid rgba(34,211,238,0.2)",
              borderRadius: 8,
            }}
          >
            <Code2 size={20} color="var(--accent)" />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--accent)",
                letterSpacing: "-0.5px",
              }}
            >
              CollabEdit
            </span>
          </div>

          <h1
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: "-1px",
            }}
          >
            Code together,
            <br />
            <span style={{ color: "var(--accent)" }}>in real time.</span>
          </h1>

          <p
            style={{
              marginTop: 12,
              fontSize: 14,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
            }}
          >
            Collaborative editing powered by Operational Transforms.
            <br />
            No signup required.
          </p>
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { icon: <Zap size={11} />, label: "OT-powered sync" },
            { icon: <Users size={11} />, label: "Live cursors" },
            { icon: <Code2 size={11} />, label: "9 languages" },
          ].map((f) => (
            <span
              key={f.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                color: "var(--text-secondary)",
                background: "var(--bg-elevated)",
                border: "1px solid var(--bg-border)",
                borderRadius: 20,
                padding: "3px 10px",
              }}
            >
              {f.icon}
              {f.label}
            </span>
          ))}
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--bg-border)",
            borderRadius: 12,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Name input */}
          <div>
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-secondary)",
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Your Name
            </label>
            <input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="e.g. Ada Lovelace"
              style={{
                width: "100%",
                background: "var(--bg-elevated)",
                border: "1px solid var(--bg-border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontSize: 14,
                fontFamily: "var(--font-sans)",
                padding: "10px 12px",
                outline: "none",
                transition: "border-color 0.2s",
                boxSizing: "border-box",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--bg-border)"; }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Create */}
            <button
              onClick={createRoom}
              disabled={loading || !userName.trim()}
              style={{
                background: "var(--accent)",
                color: "#0d0d0d",
                border: "none",
                borderRadius: 8,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "var(--font-sans)",
                cursor: loading || !userName.trim() ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                opacity: loading || !userName.trim() ? 0.5 : 1,
                transition: "opacity 0.2s, transform 0.1s",
              }}
              onMouseEnter={(e) => {
                if (!loading && userName.trim()) (e.currentTarget as HTMLElement).style.transform = "scale(1.02)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "scale(1)";
              }}
            >
              <Plus size={14} />
              New Room
            </button>

            {/* Join */}
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                placeholder="ROOM CODE"
                maxLength={8}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--bg-border)",
                  borderRadius: 8,
                  color: "var(--accent)",
                  fontSize: 13,
                  fontFamily: "var(--font-mono)",
                  padding: "10px 10px",
                  outline: "none",
                  letterSpacing: "0.08em",
                  transition: "border-color 0.2s",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--bg-border)"; }}
              />
              <button
                onClick={joinRoom}
                disabled={loading || !roomCode.trim() || !userName.trim()}
                title="Join room"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--bg-border)",
                  borderRadius: 8,
                  color: "var(--text-primary)",
                  padding: "10px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  opacity: loading || !roomCode.trim() || !userName.trim() ? 0.4 : 1,
                  transition: "border-color 0.2s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--bg-border)";
                }}
              >
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {error && (
            <p
              style={{
                fontSize: 12,
                color: "var(--status-red)",
                margin: 0,
                padding: "8px 12px",
                background: "rgba(239,68,68,0.1)",
                borderRadius: 6,
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
