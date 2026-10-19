import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import {
  bytesToBase64,
  base64ToBytes,
  createDocSnapshot,
  createDocSnapshotBase64,
  restoreDocFromSnapshot,
  tokenize,
  computeWordDiff,
  computeBlockDiffs,
  computeYDocDiff,
  computeSnapshotDiff,
  computeRawTextDiff,
} from "./snapshotDiff";

describe("snapshotDiff", () => {
  describe("Base64 Encoding & Decoding", () => {
    it("should roundtrip Uint8Array through base64 conversion", () => {
      const original = new Uint8Array([0, 1, 2, 255, 128, 64, 32]);
      const base64 = bytesToBase64(original);
      const decoded = base64ToBytes(base64);
      expect(Array.from(decoded)).toEqual(Array.from(original));
    });
  });

  describe("Tokenization", () => {
    it("should split English and Chinese text into tokens properly", () => {
      const tokens = tokenize("Hello 世界! 123");
      expect(tokens).toEqual(["Hello", " ", "世", "界", "!", " ", "123"]);
    });
  });

  describe("Word Diffing", () => {
    it("should detect unchanged string", () => {
      const diff = computeWordDiff("一致文本", "一致文本");
      expect(diff).toEqual([{ type: "unchanged", text: "一致文本" }]);
    });

    it("should detect added text", () => {
      const diff = computeWordDiff("", "新增加内容");
      expect(diff).toEqual([{ type: "added", text: "新增加内容" }]);
    });

    it("should detect removed text", () => {
      const diff = computeWordDiff("被删除内容", "");
      expect(diff).toEqual([{ type: "removed", text: "被删除内容" }]);
    });

    it("should detect inline modifications", () => {
      const diff = computeWordDiff("Hello World", "Hello WorkBuddy World");
      expect(diff).toEqual([
        { type: "unchanged", text: "Hello" },
        { type: "added", text: " WorkBuddy" },
        { type: "unchanged", text: " World" },
      ]);
    });

    it("should handle Chinese character modifications", () => {
      const diff = computeWordDiff("今天天气晴朗", "今天天气非常晴朗");
      expect(diff).toEqual([
        { type: "unchanged", text: "今天天气" },
        { type: "added", text: "非常" },
        { type: "unchanged", text: "晴朗" },
      ]);
    });
  });

  describe("Block and Y.Doc Diffing", () => {
    it("should diff raw text blocks correctly", () => {
      const oldText = "# 标题一\n旧段落文本\n- 列表项1";
      const newText = "# 标题一 (修改)\n新段落文本\n- 列表项1\n- 列表项2";

      const result = computeRawTextDiff(oldText, newText);
      expect(result.blocks.length).toBeGreaterThan(0);
      expect(result.stats.additions).toBeGreaterThan(0);
    });

    it("should capture and restore Yjs snapshots and compute snapshot diff", () => {
      const doc = new Y.Doc({ gc: false });
      const fragment = doc.getXmlFragment("default");

      // Initial paragraph
      const p1 = new Y.XmlElement("paragraph");
      const text1 = new Y.XmlText("版本一原始段落");
      p1.insert(0, [text1]);
      fragment.insert(0, [p1]);

      // Take snapshot 1
      const snapshot1Bytes = createDocSnapshot(doc);
      const snapshot1Base64 = createDocSnapshotBase64(doc);
      expect(snapshot1Bytes.length).toBeGreaterThan(0);
      expect(snapshot1Base64.length).toBeGreaterThan(0);

      // Modify document (Version 2)
      doc.transact(() => {
        text1.insert(7, "添加了更多细节");
        const p2 = new Y.XmlElement("paragraph");
        const text2 = new Y.XmlText("新增的第二段落");
        p2.insert(0, [text2]);
        fragment.insert(1, [p2]);
      });

      // Restore historical doc from snapshot 1
      const historicalDoc = restoreDocFromSnapshot(doc, snapshot1Bytes);
      expect(historicalDoc).toBeDefined();

      // Diff historical snapshot against current live doc
      const diffResult = computeSnapshotDiff(doc, snapshot1Bytes);
      const ydocDiffResult = computeYDocDiff(historicalDoc, doc);

      expect(diffResult.blocks.length).toBe(2);
      expect(ydocDiffResult.blocks.length).toBe(2);
      expect(diffResult.stats.additions).toBeGreaterThan(0);
      expect(diffResult.blocks[0].status).toBe("modified");
      expect(diffResult.blocks[1].status).toBe("added");

      const blockDiff = computeBlockDiffs(
        [{ type: "paragraph", text: "A" }],
        [{ type: "paragraph", text: "B" }]
      );
      expect(blockDiff.blocks.length).toBe(1);
    });

    it("should handle insertion at the top without breaking downstream unchanged blocks", () => {
      const oldBlocks = [
        { type: "heading" as const, level: 1, text: "大标题" },
        { type: "paragraph" as const, text: "第一段正文" },
        { type: "paragraph" as const, text: "第二段正文" },
      ];
      const newBlocks = [
        { type: "paragraph" as const, text: "新插入的顶栏声明" },
        { type: "heading" as const, level: 1, text: "大标题" },
        { type: "paragraph" as const, text: "第一段正文" },
        { type: "paragraph" as const, text: "第二段正文" },
      ];

      const diff = computeBlockDiffs(oldBlocks, newBlocks);
      expect(diff.blocks.length).toBe(4);
      expect(diff.blocks[0].status).toBe("added");
      expect(diff.blocks[1].status).toBe("unchanged");
      expect(diff.blocks[2].status).toBe("unchanged");
      expect(diff.blocks[3].status).toBe("unchanged");
    });
  });
});
