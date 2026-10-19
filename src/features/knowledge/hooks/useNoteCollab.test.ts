// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNoteCollab } from "./useNoteCollab";
import * as Y from "yjs";
import * as notesApi from "../api/notes";

vi.mock("../api/notes", () => ({
  createNoteSnapshot: vi.fn().mockResolvedValue({
    id: "snap-1",
    noteId: "test-note-123",
    snapshotData: "base64",
    summary: "自动快照",
    createdAt: new Date().toISOString(),
  }),
}));

// Mock WebsocketProvider to avoid live network socket in pure unit test
vi.mock("y-websocket", () => {
  return {
    WebsocketProvider: class MockWebsocketProvider {
      awareness = {
        setLocalStateField: vi.fn(),
      };
      on = vi.fn((event, handler) => {
        if (event === "status") {
          handler({ status: "connected" });
        }
      });
      off = vi.fn();
      destroy = vi.fn();
    },
  };
});

describe("useNoteCollab", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns disconnected when noteId is not provided", () => {
    const { result } = renderHook(() => useNoteCollab({ enabled: true }));
    expect(result.current.status).toBe("disconnected");
    expect(result.current.ydoc).toBeNull();
    expect(result.current.collabExtensions).toEqual([]);
  });

  it("initializes ydoc, provider, and collab extensions when noteId is provided", () => {
    const { result } = renderHook(() =>
      useNoteCollab({
        noteId: "test-note-123",
        enabled: true,
        user: { name: "Tester", color: "#16a34a" },
      })
    );

    expect(result.current.ydoc).toBeInstanceOf(Y.Doc);
    expect(result.current.status).toBe("connected");
    expect(result.current.collabExtensions.length).toBe(2);

    const snapshot = result.current.getSnapshot();
    expect(snapshot).toBeInstanceOf(Uint8Array);
  });

  it("triggers debounced snapshot when document changes after inactivity delay", async () => {
    const { result } = renderHook(() =>
      useNoteCollab({
        noteId: "test-note-123",
        enabled: true,
        autoSnapshotDebounceMs: 1000,
      })
    );

    const doc = result.current.ydoc!;
    expect(doc).toBeDefined();

    // Mutate Yjs doc to trigger update
    act(() => {
      doc.getText("content").insert(0, "新输入的内容");
    });

    // Advance timers partially (less than debounce)
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(notesApi.createNoteSnapshot).not.toHaveBeenCalled();

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(notesApi.createNoteSnapshot).toHaveBeenCalled();
  });

  it("allows saving a named snapshot manually via saveNamedSnapshot", async () => {
    const { result } = renderHook(() =>
      useNoteCollab({
        noteId: "test-note-123",
        enabled: true,
      })
    );

    const doc = result.current.ydoc!;
    act(() => {
      doc.getText("content").insert(0, "重要版本内容");
    });

    let saved = false;
    await act(async () => {
      saved = await result.current.saveNamedSnapshot("评审版定稿");
    });

    expect(saved).toBe(true);
    expect(notesApi.createNoteSnapshot).toHaveBeenCalledWith(
      "test-note-123",
      expect.any(String),
      "评审版定稿"
    );
  });
});
