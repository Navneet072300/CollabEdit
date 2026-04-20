"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { CollabEditor } from "@/components/editor/CollabEditor";
import { FileTabs } from "@/components/editor/FileTabs";
import { OutputPanel, type RunResult } from "@/components/editor/OutputPanel";
import { WebPreview } from "@/components/editor/WebPreview";
import { FileTree } from "@/components/sidebar/FileTree";
import { RoomHeader } from "@/components/layout/RoomHeader";
import { useEditorStore } from "@/store/editorStore";
import type { Room, FileInfo } from "@/lib/types";
import { WEB_LANGUAGES, RUNNABLE_LANGUAGES } from "@/lib/utils/language";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getOrCreateUser() {
  if (typeof window === "undefined") return { userId: "", userName: "" };
  try {
    const s = localStorage.getItem("collab_user");
    if (s) return JSON.parse(s);
  } catch { /* ignore */ }
  const userId = nanoid();
  const userName = `user_${userId.slice(0, 6)}`;
  localStorage.setItem("collab_user", JSON.stringify({ userId, userName }));
  return { userId, userName };
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);
  const [outputHeight, setOutputHeight] = useState(220);
  const [outputOpen, setOutputOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const setStoreRoom = useEditorStore(s => s.setRoom);
  const activeFileId = useEditorStore(s => s.activeFileId);
  const getFileLanguage = useEditorStore(s => s.getFileLanguage);
  const getFileContent = useEditorStore(s => s.getFileContent);
  const setActiveFile = useEditorStore(s => s.setActiveFile);
  const setFileLanguage = useEditorStore(s => s.setFileLanguage);

  const sendRef = useRef<((m: unknown) => void) | null>(null);

  useEffect(() => {
    const { userId, userName } = getOrCreateUser();
    setUserId(userId);
    setUserName(userName);
  }, []);

  useEffect(() => {
    if (!code) return;
    fetch(`${API}/api/rooms/${code}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((r: Room) => { setRoom(r); setStoreRoom(r); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [code, setStoreRoom]);

  // Keep editorContentRef in sync for run handler
  const editorContentRef = useRef("");
  useEffect(() => {
    const h = (e: Event) => { editorContentRef.current = (e as CustomEvent<string>).detail; };
    window.addEventListener("collab:content", h);
    return () => window.removeEventListener("collab:content", h);
  }, []);

  // Expose send to cross-component events
  useEffect(() => {
    const h = (e: Event) => sendRef.current?.((e as CustomEvent).detail);
    window.addEventListener("collab:send", h);
    return () => window.removeEventListener("collab:send", h);
  }, []);

  const handleFileSelect = useCallback((file: FileInfo) => {
    setActiveFile(file.id);
    const lang = file.language;
    if (WEB_LANGUAGES.has(lang) && previewOpen) setPreviewOpen(true);
  }, [setActiveFile, previewOpen]);

  const handleTabSelect = useCallback((fileId: string) => {
    setActiveFile(fileId);
  }, [setActiveFile]);

  const handleLanguageChange = useCallback((lang: string) => {
    if (activeFileId) {
      setFileLanguage(activeFileId, lang);
      window.dispatchEvent(new CustomEvent("collab:send", {
        detail: { type: "language_change", language: lang, file_id: activeFileId },
      }));
    }
  }, [activeFileId, setFileLanguage]);

  const handleRoomRename = useCallback((name: string) => {
    window.dispatchEvent(new CustomEvent("collab:send", { detail: { type: "room_update", name } }));
  }, []);

  const handleRun = useCallback(async () => {
    const lang = activeFileId ? getFileLanguage(activeFileId) : "plaintext";
    if (!RUNNABLE_LANGUAGES.has(lang)) return;

    const content = activeFileId ? getFileContent(activeFileId) : editorContentRef.current;
    setRunning(true);
    setRunResult(null);
    setOutputOpen(true);
    setPreviewOpen(false);
    try {
      const res = await fetch(`${API}/api/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: content, language: lang }),
      });
      setRunResult(await res.json());
    } catch {
      setRunResult({ stdout: "", stderr: "Failed to reach execution server.", exit_code: 1, timed_out: false });
    } finally {
      setRunning(false);
    }
  }, [activeFileId, getFileLanguage, getFileContent]);

  const handlePreview = useCallback(() => {
    setPreviewOpen(p => !p);
    setOutputOpen(false);
  }, []);

  // ⌘/Ctrl+Enter → run
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleRun(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [handleRun]);

  const lang = activeFileId ? getFileLanguage(activeFileId) : "plaintext";
  const htmlContent = activeFileId ? getFileContent(activeFileId) : "";

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-dot" />
      Connecting to room {code}…
    </div>
  );

  if (notFound) return (
    <div className="not-found-screen">
      <p className="not-found-msg">Room not found</p>
      <button type="button" className="back-btn" onClick={() => router.push("/")}>
        Back to home
      </button>
    </div>
  );

  if (!room || !userId) return null;

  return (
    <div className="room-layout">
      <RoomHeader
        roomCode={code}
        userId={userId}
        userName={userName}
        onLanguageChange={handleLanguageChange}
        onRoomRename={handleRoomRename}
        onRun={handleRun}
        onPreview={handlePreview}
        running={running}
        previewOpen={previewOpen}
      />

      <div className="room-body">
        {/* Sidebar file tree */}
        <div className="sidebar">
          <FileTree roomId={room.id} onFileSelect={handleFileSelect} />
        </div>

        {/* Editor + output/preview area */}
        <div className="editor-area">
          <FileTabs onSelect={handleTabSelect} />

          <div className="editor-and-panel">
            {/* Code editor (always mounted) */}
            <div className={`editor-pane${previewOpen ? " split" : ""}`}>
              <CollabEditor roomId={room.id} userId={userId} userName={userName} />
            </div>

            {/* Web preview panel (right side when open) */}
            {previewOpen && WEB_LANGUAGES.has(lang) && (
              <div className="preview-pane">
                <div className="preview-pane-header">
                  <span>Preview</span>
                  <button type="button" className="icon-btn" aria-label="Close preview"
                    onClick={() => setPreviewOpen(false)}>✕</button>
                </div>
                <div className="preview-pane-body">
                  <WebPreview htmlContent={htmlContent} roomId={room.id} />
                </div>
              </div>
            )}
          </div>

          {/* Output terminal */}
          {outputOpen && (
            <OutputPanel
              result={runResult}
              running={running}
              onClear={() => { setRunResult(null); setOutputOpen(false); }}
              height={outputHeight}
              onHeightChange={setOutputHeight}
            />
          )}
        </div>
      </div>
    </div>
  );
}
