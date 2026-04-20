import { create } from "zustand";
import type { UserPresence, Room, FileInfo } from "@/lib/types";
import type { ConnectionStatus } from "@/lib/ws/client";

interface EditorState {
  room: Room | null;
  roomName: string;
  status: ConnectionStatus;

  // File tree
  files: FileInfo[];
  activeFileId: string | null;
  openFileIds: string[];          // tabs order

  fileLanguages: Record<string, string>;
  fileContents: Record<string, string>;   // cached content per file id

  // Presence
  presence: Record<string, UserPresence>;

  // Actions
  setRoom: (room: Room) => void;
  setRoomName: (name: string) => void;
  setStatus: (s: ConnectionStatus) => void;

  setFiles: (files: FileInfo[]) => void;
  addFile: (file: FileInfo) => void;
  removeFile: (fileId: string) => void;
  renameFile: (fileId: string, newPath: string, newName: string) => void;
  setActiveFile: (fileId: string) => void;
  closeTab: (fileId: string) => void;

  setFileLanguage: (fileId: string, lang: string) => void;
  getFileLanguage: (fileId: string) => string;
  setFileContent: (fileId: string, content: string) => void;
  getFileContent: (fileId: string) => string;

  setPresence: (p: UserPresence) => void;
  removePresence: (userId: string) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  room: null,
  roomName: "",
  status: "connecting",
  files: [],
  activeFileId: null,
  openFileIds: [],
  fileLanguages: {},
  fileContents: {},
  presence: {},

  setRoom: (room) => set({ room, roomName: room.name }),
  setRoomName: (roomName) => set({ roomName }),
  setStatus: (status) => set({ status }),

  setFiles: (files) => set((s) => {
    const nonFolders = files.filter(f => !f.is_folder);
    // Open first file automatically
    const firstId = nonFolders[0]?.id ?? null;
    const openFileIds = firstId ? [firstId] : s.openFileIds;
    const activeFileId = firstId ?? s.activeFileId;
    return { files, openFileIds, activeFileId };
  }),

  addFile: (file) => set((s) => {
    const files = [...s.files.filter(f => f.id !== file.id), file]
      .sort((a, b) => a.path.localeCompare(b.path));
    if (file.is_folder) return { files };
    const openFileIds = s.openFileIds.includes(file.id)
      ? s.openFileIds : [...s.openFileIds, file.id];
    return { files, openFileIds, activeFileId: file.id };
  }),

  removeFile: (fileId) => set((s) => {
    const files = s.files.filter(f => f.id !== fileId && !f.path.startsWith(
      (s.files.find(x => x.id === fileId)?.path ?? "__NONE__") + "/"
    ));
    const openFileIds = s.openFileIds.filter(id => id !== fileId);
    const activeFileId = s.activeFileId === fileId
      ? (openFileIds[openFileIds.length - 1] ?? null)
      : s.activeFileId;
    return { files, openFileIds, activeFileId };
  }),

  renameFile: (fileId, newPath, newName) => set((s) => ({
    files: s.files.map(f => f.id === fileId ? { ...f, path: newPath, name: newName } : f),
  })),

  setActiveFile: (fileId) => set((s) => {
    const openFileIds = s.openFileIds.includes(fileId)
      ? s.openFileIds : [...s.openFileIds, fileId];
    return { activeFileId: fileId, openFileIds };
  }),

  closeTab: (fileId) => set((s) => {
    const openFileIds = s.openFileIds.filter(id => id !== fileId);
    const activeFileId = s.activeFileId === fileId
      ? (openFileIds[openFileIds.length - 1] ?? null)
      : s.activeFileId;
    return { openFileIds, activeFileId };
  }),

  setFileLanguage: (fileId, lang) => set((s) => ({
    fileLanguages: { ...s.fileLanguages, [fileId]: lang },
    files: s.files.map(f => f.id === fileId ? { ...f, language: lang } : f),
  })),

  getFileLanguage: (fileId) => {
    const s = get();
    return s.fileLanguages[fileId] ?? s.files.find(f => f.id === fileId)?.language ?? "plaintext";
  },

  setFileContent: (fileId, content) => set(s => ({
    fileContents: { ...s.fileContents, [fileId]: content },
  })),

  getFileContent: (fileId) => get().fileContents[fileId] ?? "",

  setPresence: (p) => set((s) => ({ presence: { ...s.presence, [p.user_id]: p } })),
  removePresence: (userId) => set((s) => {
    const next = { ...s.presence };
    delete next[userId];
    return { presence: next };
  }),
}));
