"use client";

import { useState, useRef, useCallback } from "react";
import { ChevronRight, ChevronDown, FilePlus, FolderPlus, Trash2, Pencil } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { languageFromPath, FILE_ICON } from "@/lib/utils/language";
import type { FileInfo } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Props {
  roomId: string;
  onFileSelect: (file: FileInfo) => void;
}

interface TreeNode {
  file: FileInfo;
  children: TreeNode[];
  depth: number;
}

function buildTree(files: FileInfo[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  const sorted = [...files].sort((a, b) => {
    if (a.is_folder !== b.is_folder) return a.is_folder ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  for (const f of sorted) {
    map.set(f.path, { file: f, children: [], depth: f.path.split("/").length - 1 });
  }

  for (const node of map.values()) {
    const parts = node.file.path.split("/");
    if (parts.length === 1) {
      roots.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join("/");
      const parent = map.get(parentPath);
      if (parent) parent.children.push(node);
      else roots.push(node); // orphan — show at root
    }
  }

  return roots;
}

function getFileEmoji(file: FileInfo): string {
  if (file.is_folder) return "📁";
  return FILE_ICON[file.language] ?? "📄";
}

export function FileTree({ roomId, onFileSelect }: Props) {
  const { files, activeFileId, addFile, removeFile, renameFile } = useEditorStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [creating, setCreating] = useState<{ parentPath: string; isFolder: boolean } | null>(null);
  const [createValue, setCreateValue] = useState("");
  const [contextMenu, setContextMenu] = useState<{ fileId: string; x: number; y: number } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  const tree = buildTree(files);

  const toggleFolder = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const startCreate = (parentPath: string, isFolder: boolean) => {
    setCreating({ parentPath, isFolder });
    setCreateValue("");
    setContextMenu(null);
    if (parentPath) setExpanded(prev => new Set([...prev, parentPath]));
    setTimeout(() => createInputRef.current?.focus(), 50);
  };

  const commitCreate = async () => {
    if (!creating || !createValue.trim()) { setCreating(null); return; }
    const name = createValue.trim();
    const path = creating.parentPath ? `${creating.parentPath}/${name}` : name;
    const language = creating.isFolder ? "plaintext" : languageFromPath(path);

    try {
      const res = await fetch(`${API}/api/rooms/${roomId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, name, language, is_folder: creating.isFolder, content: "" }),
      });
      if (res.ok) {
        const file: FileInfo = await res.json();
        addFile(file);
        if (!file.is_folder) onFileSelect(file);
      }
    } catch { /* ignore */ }
    setCreating(null);
  };

  const startRename = (file: FileInfo) => {
    setRenaming(file.id);
    setRenameValue(file.name);
    setContextMenu(null);
    setTimeout(() => { renameInputRef.current?.select(); }, 50);
  };

  const commitRename = async (file: FileInfo) => {
    const name = renameValue.trim();
    if (!name || name === file.name) { setRenaming(null); return; }
    const parts = file.path.split("/");
    parts[parts.length - 1] = name;
    const newPath = parts.join("/");

    try {
      const res = await fetch(`${API}/api/rooms/${roomId}/files/${file.id}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_path: newPath, new_name: name }),
      });
      if (res.ok) renameFile(file.id, newPath, name);
    } catch { /* ignore */ }
    setRenaming(null);
  };

  const deleteFile = async (file: FileInfo) => {
    setContextMenu(null);
    try {
      await fetch(`${API}/api/rooms/${roomId}/files/${file.id}`, { method: "DELETE" });
      removeFile(file.id);
    } catch { /* ignore */ }
  };

  const renderNode = (node: TreeNode): React.ReactNode => {
    const { file } = node;
    const isActive = activeFileId === file.id;
    const isOpen = expanded.has(file.path);
    const indent = node.depth * 16;

    return (
      <div key={file.id}>
        <div
          className={`file-tree-item${isActive ? " active" : ""}`}
          style={{ paddingLeft: 8 + indent }}
          onClick={() => {
            if (file.is_folder) toggleFolder(file.path);
            else onFileSelect(file);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ fileId: file.id, x: e.clientX, y: e.clientY });
          }}
        >
          {file.is_folder ? (
            <span style={{ color: "var(--text-muted)", fontSize: 10, marginRight: 2, flexShrink: 0 }}>
              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          ) : (
            <span style={{ width: 14, flexShrink: 0 }} />
          )}

          <span style={{ marginRight: 6, fontSize: 13 }}>{getFileEmoji(file)}</span>

          {renaming === file.id ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={() => commitRename(file)}
              onKeyDown={e => {
                if (e.key === "Enter") commitRename(file);
                if (e.key === "Escape") setRenaming(null);
              }}
              onClick={e => e.stopPropagation()}
              className="tree-inline-input"
            />
          ) : (
            <span style={{ fontSize: 13, color: isActive ? "var(--text-primary)" : "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {file.name}
            </span>
          )}
        </div>

        {/* Inline create input inside a folder */}
        {creating && creating.parentPath === file.path && (
          <div className="file-tree-item" style={{ paddingLeft: 8 + indent + 16 }}>
            <span style={{ marginRight: 6, fontSize: 13 }}>{creating.isFolder ? "📁" : "📄"}</span>
            <input
              ref={createInputRef}
              value={createValue}
              onChange={e => setCreateValue(e.target.value)}
              onBlur={commitCreate}
              onKeyDown={e => {
                if (e.key === "Enter") commitCreate();
                if (e.key === "Escape") setCreating(null);
              }}
              placeholder={creating.isFolder ? "folder name" : "filename.py"}
              className="tree-inline-input"
            />
          </div>
        )}

        {/* Children (only if folder is expanded) */}
        {file.is_folder && isOpen && node.children.map(renderNode)}
      </div>
    );
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--bg-border)",
        overflow: "hidden",
        userSelect: "none",
      }}
      onClick={() => setContextMenu(null)}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "8px 10px", borderBottom: "1px solid var(--bg-border)", flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", flex: 1, fontFamily: "var(--font-sans)" }}>
          Files
        </span>
        <button className="icon-btn" title="New File" onClick={e => { e.stopPropagation(); startCreate("", false); }}>
          <FilePlus size={13} />
        </button>
        <button className="icon-btn" title="New Folder" onClick={e => { e.stopPropagation(); startCreate("", true); }}>
          <FolderPlus size={13} />
        </button>
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {tree.map(renderNode)}

        {/* Root-level create input */}
        {creating && creating.parentPath === "" && (
          <div className="file-tree-item" style={{ paddingLeft: 8 }}>
            <span style={{ marginRight: 6, fontSize: 13 }}>{creating.isFolder ? "📁" : "📄"}</span>
            <input
              ref={createInputRef}
              value={createValue}
              onChange={e => setCreateValue(e.target.value)}
              onBlur={commitCreate}
              onKeyDown={e => {
                if (e.key === "Enter") commitCreate();
                if (e.key === "Escape") setCreating(null);
              }}
              placeholder={creating.isFolder ? "folder-name" : "filename.py"}
              className="tree-inline-input"
            />
          </div>
        )}

        {files.length === 0 && !creating && (
          <p style={{ padding: "12px 12px", fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-sans)" }}>
            No files yet. Click + to create one.
          </p>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (() => {
        const file = files.find(f => f.id === contextMenu.fileId);
        if (!file) return null;
        return (
          <div
            className="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={e => e.stopPropagation()}
          >
            {file.is_folder && (
              <>
                <button className="context-item" onClick={() => startCreate(file.path, false)}>
                  <FilePlus size={12} /> New File
                </button>
                <button className="context-item" onClick={() => startCreate(file.path, true)}>
                  <FolderPlus size={12} /> New Folder
                </button>
                <div className="context-divider" />
              </>
            )}
            <button className="context-item" onClick={() => startRename(file)}>
              <Pencil size={12} /> Rename
            </button>
            <button className="context-item danger" onClick={() => deleteFile(file)}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        );
      })()}
    </div>
  );
}
