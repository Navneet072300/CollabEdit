"use client";

import { useRef, useEffect } from "react";
import { X, Terminal, AlertCircle, CheckCircle, Clock } from "lucide-react";

export interface RunResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  timed_out: boolean;
}

interface Props {
  result: RunResult | null;
  running: boolean;
  onClear: () => void;
  height: number;
  onHeightChange: (h: number) => void;
}

export function OutputPanel({ result, running, onClear, height, onHeightChange }: Props) {
  const outputRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  // Auto-scroll to bottom on new output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [result, running]);

  function onDragStart(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: height };

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - ev.clientY;
      const newH = Math.min(600, Math.max(80, dragRef.current.startH + delta));
      onHeightChange(newH);
    }
    function onUp() {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const hasOutput = result && (result.stdout || result.stderr);
  const isError = result && (result.exit_code !== 0 || result.timed_out);

  return (
    <div
      style={{
        height,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "#0a0a0a",
        borderTop: "1px solid var(--bg-border)",
        position: "relative",
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        style={{
          position: "absolute",
          top: -3,
          left: 0,
          right: 0,
          height: 6,
          cursor: "row-resize",
          zIndex: 10,
          background: "transparent",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(34,211,238,0.15)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      />

      {/* Panel header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 12px",
          height: 32,
          borderBottom: "1px solid var(--bg-border)",
          flexShrink: 0,
        }}
      >
        <Terminal size={12} color="var(--text-secondary)" />
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-secondary)",
            fontFamily: "var(--font-sans)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Output
        </span>

        {/* Status badge */}
        {running && (
          <span
            style={{
              fontSize: 10,
              color: "var(--status-yellow)",
              fontFamily: "var(--font-mono)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Clock size={10} />
            Running…
          </span>
        )}
        {result && !running && (
          <span
            style={{
              fontSize: 10,
              color: isError ? "var(--status-red)" : "var(--status-green)",
              fontFamily: "var(--font-mono)",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {isError ? <AlertCircle size={10} /> : <CheckCircle size={10} />}
            {result.timed_out ? "Timed out" : `Exit ${result.exit_code}`}
          </span>
        )}

        <div style={{ flex: 1 }} />

        {hasOutput && (
          <button
            onClick={onClear}
            title="Clear output"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "2px 4px",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Output content */}
      <div
        ref={outputRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "8px 16px",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {running && !result && (
          <span style={{ color: "var(--text-muted)" }}>▶ Running…</span>
        )}

        {!running && !result && (
          <span style={{ color: "var(--text-muted)" }}>
            Press <kbd
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--bg-border)",
                borderRadius: 3,
                padding: "1px 5px",
                fontSize: 11,
                color: "var(--text-secondary)",
              }}
            >
              ⌘ Enter
            </kbd>{" "}
            or click Run to execute
          </span>
        )}

        {result && (
          <>
            {result.stdout && (
              <pre
                style={{
                  margin: 0,
                  color: "#e4e4e7",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {result.stdout}
              </pre>
            )}
            {result.stderr && (
              <pre
                style={{
                  margin: 0,
                  color: result.exit_code === 0 ? "#f97316" : "#f87171",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {result.stderr}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  );
}
