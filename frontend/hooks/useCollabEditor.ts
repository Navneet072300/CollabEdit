"use client";

import { useRef, useCallback } from "react";
import { EditorView } from "@codemirror/view";
import type { Transaction } from "@codemirror/state";
import { ClientOTState } from "@/lib/ot/client";
import type { Operation } from "@/lib/ot/operations";
import type { ServerMessage, CursorPos } from "@/lib/types";
import { useEditorStore } from "@/store/editorStore";
import type { ConnectionStatus } from "@/lib/ws/client";

function offsetToPos(doc: string, offset: number) {
  const lines = doc.slice(0, offset).split("\n");
  return { line: lines.length - 1, ch: lines[lines.length - 1].length };
}

export function useCollabEditor(userId: string, userName: string) {
  const viewRef = useRef<EditorView | null>(null);
  // OT state is per-file — keyed by fileId
  const otStates = useRef<Record<string, ClientOTState>>({});
  const activeFileId = useRef<string | null>(null);
  const applyingRemote = useRef(false);

  const {
    setFiles, addFile, removeFile, renameFile,
    setActiveFile, setFileLanguage, setFileContent,
    setPresence, removePresence, setRoomName, setStatus,
  } = useEditorStore();

  const onStatusChange = useCallback((s: ConnectionStatus) => setStatus(s), [setStatus]);

  function getOTState(fileId: string): ClientOTState {
    if (!otStates.current[fileId]) {
      otStates.current[fileId] = new ClientOTState(0);
    }
    return otStates.current[fileId];
  }

  function extractOpsFromTransaction(tr: Transaction, send: (m: unknown) => void): void {
    if (!tr.docChanged || applyingRemote.current || !activeFileId.current) return;
    const fileId = activeFileId.current;
    const ot = getOTState(fileId);

    tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
      const insertedText = inserted.toString();
      const deleteLen = toA - fromA;

      if (deleteLen > 0) {
        const op: Operation = { op_type: "delete", position: fromA, length: deleteLen };
        const { op: sent, revision } = ot.localOp(op);
        send({ type: "op", file_id: fileId, op: sent, revision, user_id: userId, user_name: userName });
      }
      if (insertedText.length > 0) {
        const op: Operation = { op_type: "insert", position: fromA, text: insertedText };
        const { op: sent, revision } = ot.localOp(op);
        send({ type: "op", file_id: fileId, op: sent, revision, user_id: userId, user_name: userName });
      }
    });
  }

  function applyRemoteOpToEditor(op: Operation): void {
    const view = viewRef.current;
    if (!view) return;
    applyingRemote.current = true;
    try {
      if (op.op_type === "insert") {
        view.dispatch({ changes: { from: op.position, insert: op.text } });
      } else if (op.op_type === "delete" && op.length > 0) {
        view.dispatch({ changes: { from: op.position, to: op.position + op.length } });
      }
    } finally {
      applyingRemote.current = false;
    }
  }

  const handleMessage = useCallback((msg: ServerMessage, send: (m: unknown) => void) => {
    const view = viewRef.current;

    switch (msg.type) {
      case "file_tree": {
        setFiles(msg.files);
        // Request the first non-folder file
        const first = msg.files.find(f => !f.is_folder);
        if (first) {
          send({ type: "join_file", file_id: first.id });
          setActiveFile(first.id);
          activeFileId.current = first.id;
        }
        break;
      }

      case "file_sync": {
        // Server sends full file state (on join or file switch)
        const ot = getOTState(msg.file_id);
        ot.revision = msg.revision;
        ot.pendingOps = [];
        setFileContent(msg.file_id, msg.content);
        setFileLanguage(msg.file_id, msg.language);

        if (activeFileId.current === msg.file_id && view) {
          applyingRemote.current = true;
          view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: msg.content } });
          applyingRemote.current = false;
        }
        break;
      }

      case "ack": {
        getOTState(msg.file_id).ack(msg.revision);
        break;
      }

      case "remote_op": {
        // Only apply to the editor if it's the active file
        const transformed = getOTState(msg.file_id).remoteOp(msg.op, msg.revision);
        // Always update the cached content
        const { fileContents } = useEditorStore.getState();
        const current = fileContents[msg.file_id] ?? "";
        const { applyOp } = require("@/lib/ot/document");
        setFileContent(msg.file_id, applyOp(current, transformed));

        if (msg.file_id === activeFileId.current) {
          applyRemoteOpToEditor(transformed);
        }
        break;
      }

      case "file_created": addFile(msg.file); break;
      case "file_deleted": removeFile(msg.file_id); break;
      case "file_renamed": renameFile(msg.file_id, msg.new_path, msg.new_name); break;

      case "presence": {
        if (msg.user_id !== userId) {
          setPresence({ user_id: msg.user_id, user_name: msg.user_name, color: msg.color, cursor: msg.cursor });
        }
        break;
      }
      case "presence_leave": removePresence(msg.user_id); break;

      case "language_change": {
        if (msg.file_id) setFileLanguage(msg.file_id, msg.language);
        break;
      }
      case "room_update": {
        if (msg.name) setRoomName(msg.name);
        break;
      }
    }
  }, [userId, setFiles, setActiveFile, setFileContent, setFileLanguage, addFile, removeFile, renameFile, setPresence, removePresence, setRoomName]);

  const switchFile = useCallback((fileId: string, send: (m: unknown) => void) => {
    activeFileId.current = fileId;
    setActiveFile(fileId);
    send({ type: "join_file", file_id: fileId });
  }, [setActiveFile]);

  const sendCursorUpdate = useCallback((view: EditorView, send: (m: unknown) => void) => {
    const sel = view.state.selection.main;
    const docStr = view.state.doc.toString();
    const pos = offsetToPos(docStr, sel.head);
    const cursor: CursorPos = { line: pos.line, ch: pos.ch };
    if (sel.from !== sel.to) {
      cursor.selection_from = offsetToPos(docStr, sel.from);
      cursor.selection_to = offsetToPos(docStr, sel.to);
    }
    send({ type: "presence", cursor, user_id: userId, user_name: userName });
  }, [userId, userName]);

  return { viewRef, activeFileId, applyingRemote, extractOpsFromTransaction, handleMessage, switchFile, sendCursorUpdate, onStatusChange };
}
