"use client";

import { useEffect, useRef, useCallback } from "react";
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching, foldGutter, indentOnInput, StreamLanguage } from "@codemirror/language";
import { closeBrackets } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";

import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { rust } from "@codemirror/lang-rust";
import { go } from "@codemirror/lang-go";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { sql } from "@codemirror/lang-sql";

import { useCollabEditor } from "@/hooks/useCollabEditor";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { ServerMessage } from "@/lib/types";
import { useEditorStore } from "@/store/editorStore";

const langCompartment = new Compartment();

function getLangExtension(lang: string) {
  switch (lang) {
    case "javascript":  return javascript();
    case "typescript":  return javascript({ typescript: true });
    case "html":        return html();
    case "css":         return css();
    case "json":        return json();
    case "markdown":    return markdown();
    case "rust":        return rust();
    case "go":          return go();
    case "cpp":         return cpp();
    case "c":           return cpp();   // CM6 has no standalone C; cpp works for C syntax
    case "java":        return java();
    case "sql":         return sql();
    // Ruby and C# use legacy streaming modes (no dedicated CM6 package)
    case "ruby":
      return StreamLanguage.define(
        // lazy require so the import doesn't break SSR
        require("@codemirror/legacy-modes/mode/ruby").ruby
      );
    case "csharp":
      return StreamLanguage.define(
        require("@codemirror/legacy-modes/mode/clike").csharp
      );
    case "python":
    default:            return python();
  }
}

interface Props {
  roomId: string;
  userId: string;
  userName: string;
}

export function CollabEditor({ roomId, userId, userName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<((msg: unknown) => void) | null>(null);

  const activeFileId = useEditorStore(s => s.activeFileId);
  const getFileLanguage = useEditorStore(s => s.getFileLanguage);
  const setFileContent = useEditorStore(s => s.setFileContent);
  const prevLangRef = useRef("");
  const prevFileRef = useRef("");

  const { viewRef, applyingRemote, extractOpsFromTransaction, handleMessage, switchFile, sendCursorUpdate, onStatusChange } =
    useCollabEditor(userId, userName);

  const onMessage = useCallback((msg: ServerMessage) => {
    if (sendRef.current) handleMessage(msg, sendRef.current);
  }, [handleMessage]);

  const { send } = useWebSocket({ roomId, userId, userName, onMessage, onStatusChange, enabled: true });

  useEffect(() => { sendRef.current = send; }, [send]);

  // Cross-component send (language change, room rename, run)
  useEffect(() => {
    const handler = (e: Event) => sendRef.current?.((e as CustomEvent).detail);
    window.addEventListener("collab:send", handler);
    return () => window.removeEventListener("collab:send", handler);
  }, []);

  // Build editor once
  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const content = update.state.doc.toString();
        // Keep store + run-content in sync
        if (activeFileId) setFileContent(activeFileId, content);
        window.dispatchEvent(new CustomEvent("collab:content", { detail: content }));
        if (sendRef.current && !applyingRemote.current) {
          for (const tr of update.transactions) {
            extractOpsFromTransaction(tr, sendRef.current);
          }
        }
      }
      if (update.selectionSet && sendRef.current) {
        sendCursorUpdate(update.view, sendRef.current);
      }
    });

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: "",
        extensions: [
          lineNumbers(), highlightActiveLine(), history(), drawSelection(),
          bracketMatching(), closeBrackets(), indentOnInput(), foldGutter(),
          highlightSelectionMatches(),
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
          oneDark,
          langCompartment.of(python()),
          updateListener,
          EditorView.theme({
            "&": { height: "100%", background: "#0d1117" },
            ".cm-content": { padding: "8px 0", fontFamily: "var(--font-mono)", fontSize: "14px" },
            ".cm-gutters": { background: "#0d1117", border: "none", color: "#3f3f46" },
            ".cm-activeLineGutter": { background: "rgba(34,211,238,0.05)" },
            ".cm-activeLine": { background: "rgba(34,211,238,0.04)" },
            ".cm-cursor": { borderLeftColor: "#22d3ee" },
            ".cm-selectionBackground": { background: "rgba(34,211,238,0.15) !important" },
            ".cm-lineNumbers .cm-gutterElement": { minWidth: "3.5ch" },
          }),
        ],
      }),
    });

    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Hot-swap language when active file changes
  useEffect(() => {
    const view = viewRef.current;
    if (!activeFileId || !view) return;

    const lang = getFileLanguage(activeFileId);
    const fileChanged = activeFileId !== prevFileRef.current;
    const langChanged = lang !== prevLangRef.current;

    if (langChanged || fileChanged) {
      prevLangRef.current = lang;
      view.dispatch({ effects: langCompartment.reconfigure(getLangExtension(lang)) });
    }
  }); // run every render — cheap effect, guards prevent thrashing

  // Switch active file when activeFileId changes externally
  useEffect(() => {
    if (!activeFileId || activeFileId === prevFileRef.current) return;
    prevFileRef.current = activeFileId;
    if (sendRef.current) switchFile(activeFileId, sendRef.current);
  }, [activeFileId, switchFile]);

  return <div ref={containerRef} className="editor-container" />;
}
