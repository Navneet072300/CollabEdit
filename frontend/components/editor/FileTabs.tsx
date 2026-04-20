"use client";

import { X } from "lucide-react";
import { useEditorStore } from "@/store/editorStore";
import { FILE_ICON } from "@/lib/utils/language";

interface Props {
  onSelect: (fileId: string) => void;
}

export function FileTabs({ onSelect }: Props) {
  const { files, openFileIds, activeFileId, closeTab, setActiveFile } = useEditorStore();
  const openFiles = openFileIds.map(id => files.find(f => f.id === id)).filter(Boolean);

  if (openFiles.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--bg-border)",
        overflowX: "auto",
        flexShrink: 0,
        height: 36,
        scrollbarWidth: "none",
      }}
    >
      {openFiles.map((file) => {
        if (!file) return null;
        const isActive = file.id === activeFileId;
        const icon = FILE_ICON[file.language] ?? "📄";

        return (
          <div
            key={file.id}
            onClick={() => { setActiveFile(file.id); onSelect(file.id); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 12px 0 10px",
              height: "100%",
              cursor: "pointer",
              borderRight: "1px solid var(--bg-border)",
              borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
              background: isActive ? "var(--bg-elevated)" : "transparent",
              color: isActive ? "var(--text-primary)" : "var(--text-muted)",
              fontSize: 12,
              fontFamily: "var(--font-sans)",
              flexShrink: 0,
              transition: "background 0.1s, color 0.1s",
              position: "relative",
              minWidth: 0,
              maxWidth: 180,
            }}
            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <span style={{ fontSize: 12, flexShrink: 0 }}>{icon}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {file.name}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(file.id); }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "1px 2px",
                borderRadius: 3,
                display: "flex",
                alignItems: "center",
                marginLeft: 2,
                flexShrink: 0,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; (e.currentTarget as HTMLElement).style.background = "var(--bg-border)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <X size={11} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
