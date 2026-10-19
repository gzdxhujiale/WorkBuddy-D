// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { SnapshotExtension } from "./snapshotExtension";

describe("SnapshotExtension", () => {
  it("should execute saveSnapshot and openVersionHistory commands with callbacks", () => {
    const onSaveSnapshot = vi.fn();
    const onOpenHistory = vi.fn();

    const editor = new Editor({
      extensions: [
        StarterKit,
        SnapshotExtension.configure({
          onSaveSnapshot,
          onOpenHistory,
        }),
      ],
      content: "<p>Hello Snapshot</p>",
    });

    const saveResult = editor.commands.saveSnapshot("发布定稿");
    expect(saveResult).toBe(true);
    expect(onSaveSnapshot).toHaveBeenCalledWith("发布定稿");

    const openResult = editor.commands.openVersionHistory();
    expect(openResult).toBe(true);
    expect(onOpenHistory).toHaveBeenCalled();

    editor.destroy();
  });

  it("should dispatch custom DOM events when no callback is provided", () => {
    const editor = new Editor({
      extensions: [StarterKit, SnapshotExtension],
      content: "<p>Hello Event</p>",
    });

    let capturedSaveEvent: any = null;
    let capturedOpenEvent: any = null;

    editor.view.dom.addEventListener("tiptap:save-snapshot", (e: any) => {
      capturedSaveEvent = e.detail;
    });

    editor.view.dom.addEventListener("tiptap:open-history", (e: any) => {
      capturedOpenEvent = e;
    });

    editor.commands.saveSnapshot("自动快照");
    expect(capturedSaveEvent).toEqual({ name: "自动快照" });

    editor.commands.openVersionHistory();
    expect(capturedOpenEvent).toBeDefined();

    editor.destroy();
  });
});
