import { describe, it, expect } from "vitest";
import { readReviewContent, EMPTY_TIPTAP_DOC } from "@/features/daily-review/api/dailyReviewService";
import { formatDateYMD, parseYMD, daysBetween } from "@/lib/dateUtils";

describe("Daily Review Content Normalization", () => {
  it("normalizes empty, null, and whitespace content into canonical empty Tiptap Doc", () => {
    const emptyDocJson = JSON.stringify(EMPTY_TIPTAP_DOC);

    expect(readReviewContent(null)).toBe(emptyDocJson);
    expect(readReviewContent(undefined)).toBe(emptyDocJson);
    expect(readReviewContent("")).toBe(emptyDocJson);
    expect(readReviewContent("   ")).toBe(emptyDocJson);
  });

  it("preserves valid structured Tiptap JSON document", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "今日复盘" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "完成了关键模块测试" }],
        },
      ],
    };
    const jsonStr = JSON.stringify(doc);

    expect(readReviewContent(jsonStr)).toBe(jsonStr);
    expect(readReviewContent(doc)).toBe(jsonStr);
  });

  it("wraps plain text into canonical paragraph node in Tiptap Doc", () => {
    const rawText = "这是一段未格式化的纯文本复盘";
    const result = readReviewContent(rawText);
    const parsed = JSON.parse(result);

    expect(parsed.type).toBe("doc");
    expect(parsed.content).toHaveLength(1);
    expect(parsed.content[0].type).toBe("paragraph");
    expect(parsed.content[0].content[0].text).toBe(rawText);
  });
});

describe("Timezone-Consistent Date Utilities", () => {
  it("formats Date as local YYYY-MM-DD without UTC day-shift at midnight", () => {
    // 01:30 AM local time
    const date = new Date(2026, 9, 16, 1, 30, 0); // Month is 0-indexed: 9 = October
    const formatted = formatDateYMD(date);
    expect(formatted).toBe("2026-10-16");
  });

  it("parses and calculates day difference accurately", () => {
    const d1 = "2026-10-10";
    const d2 = "2026-10-16";
    expect(daysBetween(d1, d2)).toBe(6);

    const parsed = parseYMD("2026-10-16");
    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(9);
    expect(parsed?.getDate()).toBe(16);
  });
});

describe("Editor CustomKeymap Extension", () => {
  it("exports standard CustomKeymap with Mod-1..9 and Mod-0 bindings", async () => {
    const { CustomKeymap } = await import("@/components/editor/extensions/CustomKeymapExtensions");
    expect(CustomKeymap.name).toBe("customKeymap");
    expect(typeof CustomKeymap.config.addKeyboardShortcuts).toBe("function");

    const shortcuts = CustomKeymap.config.addKeyboardShortcuts.call({
      editor: {
        commands: {
          toggleHeading: () => true,
          setParagraph: () => true,
          toggleBulletList: () => true,
          toggleOrderedList: () => true,
          toggleTaskList: () => true,
        },
      },
    });

    expect(shortcuts).toHaveProperty("Mod-1");
    expect(shortcuts).toHaveProperty("Mod-2");
    expect(shortcuts).toHaveProperty("Mod-3");
    expect(shortcuts).toHaveProperty("Mod-0");
    expect(shortcuts).toHaveProperty("Mod-7");
    expect(shortcuts).toHaveProperty("Mod-8");
    expect(shortcuts).toHaveProperty("Mod-9");
  });
});

