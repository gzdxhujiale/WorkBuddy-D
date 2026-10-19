import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { API_BASE_URL, getAuthToken } from "@/lib/apiClient";
import { createNoteSnapshot } from "../api/notes";
import { bytesToBase64 } from "../utils/snapshotDiff";

export interface NoteCollabUser {
  name: string;
  color: string;
}

export interface UseNoteCollabOptions {
  noteId?: string;
  enabled?: boolean;
  user?: Partial<NoteCollabUser>;
  autoSnapshotDebounceMs?: number;
}

export interface UseNoteCollabResult {
  ydoc: Y.Doc | null;
  provider: WebsocketProvider | null;
  status: "connected" | "connecting" | "disconnected";
  collabExtensions: any[];
  getSnapshot: () => Uint8Array | null;
  saveNamedSnapshot: (name?: string) => Promise<boolean>;
}

const DEFAULT_COLORS = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#9333ea",
  "#dc2626",
  "#0891b2",
];

function getRandomColor(): string {
  return DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
}

function areUint8ArraysEqual(a: Uint8Array | null, b: Uint8Array | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function useNoteCollab({
  noteId,
  enabled = true,
  user,
  autoSnapshotDebounceMs = 5 * 60 * 1000, // 5 minutes default
}: UseNoteCollabOptions): UseNoteCollabResult {
  const [status, setStatus] = useState<"connected" | "connecting" | "disconnected">("disconnected");
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);

  const lastSnapshotVectorRef = useRef<Uint8Array | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const noteIdRef = useRef<string | undefined>(noteId);
  noteIdRef.current = noteId;

  const currentUser = useMemo<NoteCollabUser>(() => ({
    name: user?.name || "本地编辑者",
    color: user?.color || getRandomColor(),
  }), [user?.name, user?.color]);

  const performSnapshot = async (customSummary?: string): Promise<boolean> => {
    const doc = ydocRef.current;
    const currentNoteId = noteIdRef.current;
    if (!doc || !currentNoteId) return false;

    const currentVector = Y.encodeStateVector(doc);
    if (areUint8ArraysEqual(currentVector, lastSnapshotVectorRef.current)) {
      return false; // No changes since last snapshot
    }

    try {
      const snapshot = Y.snapshot(doc);
      const snapshotBytes = Y.encodeSnapshot(snapshot);
      const base64Data = bytesToBase64(snapshotBytes);
      const summary =
        customSummary ||
        `自动快照 - ${new Date().toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        })}`;

      await createNoteSnapshot(currentNoteId, base64Data, summary);
      lastSnapshotVectorRef.current = currentVector;
      return true;
    } catch (err) {
      console.error("[useNoteCollab] Failed to create snapshot:", err);
      return false;
    }
  };

  useEffect(() => {
    if (!enabled || !noteId) {
      setYdoc(null);
      setProvider(null);
      setStatus("disconnected");
      ydocRef.current = null;
      return;
    }

    const doc = new Y.Doc({ gc: false });
    ydocRef.current = doc;
    lastSnapshotVectorRef.current = Y.encodeStateVector(doc);

    const token = getAuthToken() || "";
    const wsProtocol = API_BASE_URL.startsWith("https") ? "wss:" : "ws:";
    const host = API_BASE_URL.replace(/^https?:\/\//, "");
    const serverUrl = `${wsProtocol}//${host}/api/v1/notes`;
    const roomname = `${noteId}/collab`;

    const wsProvider = new WebsocketProvider(serverUrl, roomname, doc, {
      params: token ? { token } : {},
      connect: true,
    });

    wsProvider.awareness.setLocalStateField("user", currentUser);

    const handleStatus = (event: { status: "connected" | "connecting" | "disconnected" }) => {
      setStatus(event.status);
    };

    wsProvider.on("status", handleStatus);

    // Inactivity Debounced Auto-Snapshot Listener
    const handleDocUpdate = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      inactivityTimerRef.current = setTimeout(() => {
        void performSnapshot();
      }, autoSnapshotDebounceMs);
    };

    doc.on("update", handleDocUpdate);

    setYdoc(doc);
    setProvider(wsProvider);

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      // Lifecycle Boundary Flush
      void performSnapshot();

      doc.off("update", handleDocUpdate);
      wsProvider.off("status", handleStatus);
      wsProvider.destroy();
      doc.destroy();
      ydocRef.current = null;
      setYdoc(null);
      setProvider(null);
      setStatus("disconnected");
    };
  }, [noteId, enabled, autoSnapshotDebounceMs]);

  const collabExtensions = useMemo(() => {
    if (!ydoc || !provider) {
      return [];
    }

    return [
      Collaboration.configure({
        document: ydoc,
        field: "default",
      }),
      CollaborationCursor.configure({
        provider,
        user: currentUser,
      }),
    ];
  }, [ydoc, provider, currentUser]);

  const getSnapshot = () => {
    if (!ydoc) return null;
    const snapshot = Y.snapshot(ydoc);
    return Y.encodeSnapshot(snapshot);
  };

  const saveNamedSnapshot = async (name?: string): Promise<boolean> => {
    return performSnapshot(name);
  };

  return {
    ydoc,
    provider,
    status,
    collabExtensions,
    getSnapshot,
    saveNamedSnapshot,
  };
}
