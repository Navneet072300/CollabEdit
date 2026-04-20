import type { Operation } from "./ot/operations";

export interface CursorPos {
  line: number;
  ch: number;
  selection_from?: { line: number; ch: number };
  selection_to?: { line: number; ch: number };
}

export interface UserPresence {
  user_id: string;
  user_name: string;
  color: string;
  cursor: CursorPos | null;
}

export interface FileInfo {
  id: string;
  room_id: string;
  path: string;
  name: string;
  language: string;
  is_folder: boolean;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  language: string;
  content: string;
  revision: number;
  created_at: string;
  updated_at: string;
}

// ── Discriminated WS message union ─────────────────────────────────────────

export type FileTreeMessage       = { type: "file_tree"; files: FileInfo[] };
export type FileSyncMessage       = { type: "file_sync"; file_id: string; content: string; revision: number; language: string };
export type FileCreatedMessage    = { type: "file_created"; file: FileInfo };
export type FileDeletedMessage    = { type: "file_deleted"; file_id: string };
export type FileRenamedMessage    = { type: "file_renamed"; file_id: string; old_path: string; new_path: string; new_name: string };
export type AckMessage            = { type: "ack"; file_id: string; revision: number };
export type RemoteOpMessage       = { type: "remote_op"; file_id: string; op: Operation; revision: number; user_id: string; user_name: string; color: string };
export type PresenceMessage       = { type: "presence"; user_id: string; user_name: string; color: string; cursor: CursorPos | null };
export type PresenceLeaveMessage  = { type: "presence_leave"; user_id: string };
export type LanguageChangeMessage = { type: "language_change"; language: string; file_id: string | null; user_id: string };
export type RoomUpdateMessage     = { type: "room_update"; name?: string };

export type ServerMessage =
  | FileTreeMessage | FileSyncMessage
  | FileCreatedMessage | FileDeletedMessage | FileRenamedMessage
  | AckMessage | RemoteOpMessage
  | PresenceMessage | PresenceLeaveMessage
  | LanguageChangeMessage | RoomUpdateMessage;
