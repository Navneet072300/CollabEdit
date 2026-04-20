"use client";

import { useState, useRef } from "react";
import { Check, Copy, Play, Monitor } from "lucide-react";
import { PresenceBar } from "@/components/presence/PresenceBar";
import { LanguageSelector } from "@/components/editor/LanguageSelector";
import { useEditorStore } from "@/store/editorStore";
import { WEB_LANGUAGES, RUNNABLE_LANGUAGES } from "@/lib/utils/language";

interface Props {
  roomCode: string;
  userId: string;
  userName: string;
  onLanguageChange: (lang: string) => void;
  onRoomRename: (name: string) => void;
  onRun: () => void;
  onPreview: () => void;
  running: boolean;
  previewOpen: boolean;
}

export function RoomHeader({
  roomCode, userId, userName,
  onLanguageChange, onRoomRename,
  onRun, onPreview, running, previewOpen,
}: Props) {
  const roomName = useEditorStore(s => s.roomName);
  const activeFileId = useEditorStore(s => s.activeFileId);
  const getFileLanguage = useEditorStore(s => s.getFileLanguage);
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const lang = activeFileId ? getFileLanguage(activeFileId) : "plaintext";
  const isWeb = WEB_LANGUAGES.has(lang);
  const isRunnable = RUNNABLE_LANGUAGES.has(lang);

  async function copyCode() {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function startEditName() {
    setDraftName(roomName);
    setEditingName(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commitName() {
    if (draftName.trim() && draftName !== roomName) onRoomRename(draftName.trim());
    setEditingName(false);
  }

  return (
    <header className="room-header">
      <div className="gradient-line-wrap"><div className="gradient-line-inner" /></div>

      {/* Logo */}
      <div className="header-section header-section-border-right">
        <div className="logo-dot" />
        <span className="logo-text">CollabEdit</span>
      </div>

      {/* Room name */}
      <div className="header-section header-section-border-right">
        {editingName ? (
          <input
            ref={inputRef}
            aria-label="Room name"
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => { if (e.key === "Enter") commitName(); if (e.key === "Escape") setEditingName(false); }}
            className="room-name-input"
          />
        ) : (
          <span className="room-name-label" onClick={startEditName} title="Click to rename">
            {roomName || "Untitled"}
          </span>
        )}
      </div>

      {/* Language */}
      <div className="header-section header-section-border-right">
        <LanguageSelector onLanguageChange={onLanguageChange} />
      </div>

      {/* Run / Preview */}
      {(isRunnable || isWeb) && (
        <div className="header-section header-section-border-right header-section-gap6">
          {isRunnable && (
            <button type="button" onClick={onRun} disabled={running} aria-label="Run code"
              className={`run-btn${running ? " running" : ""}`}>
              <Play size={11} />
              {running ? "Running…" : "Run"}
            </button>
          )}
          {isWeb && (
            <button type="button" onClick={onPreview} aria-label="Toggle web preview"
              className={`preview-btn${previewOpen ? " active" : ""}`}>
              <Monitor size={11} />
              Preview
            </button>
          )}
        </div>
      )}

      <div className="header-spacer" />

      {/* Presence */}
      <div className="header-presence">
        <PresenceBar userId={userId} userName={userName} />
      </div>

      {/* Room code */}
      <div className="header-section header-section-border-left header-section-gap8">
        <code className="room-code-badge">{roomCode}</code>
        <button type="button" onClick={copyCode} aria-label="Copy room code"
          className={`copy-btn${copied ? " copied" : ""}`}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied!" : "Share"}
        </button>
      </div>
    </header>
  );
}
