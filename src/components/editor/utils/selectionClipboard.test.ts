import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  serializeSliceToMarkdown,
  copyToClipboard,
} from "./selectionClipboard";

describe("selectionClipboard - serializeSliceToMarkdown", () => {
  it("returns empty string for empty or null slice", () => {
    expect(serializeSliceToMarkdown(null)).toBe("");
    expect(serializeSliceToMarkdown(undefined)).toBe("");
    expect(serializeSliceToMarkdown({ content: [] })).toBe("");
  });

  it("serializes inline text with single marks (bold, italic, code, strike, highlight, underline)", () => {
    // Bold
    expect(
      serializeSliceToMarkdown({
        openStart: 1,
        openEnd: 1,
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "bold text", marks: [{ type: "bold" }] },
            ],
          },
        ],
      })
    ).toBe("**bold text**");

    // Italic
    expect(
      serializeSliceToMarkdown({
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "italic text", marks: [{ type: "italic" }] },
            ],
          },
        ],
      })
    ).toBe("*italic text*");

    // Inline code
    expect(
      serializeSliceToMarkdown({
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "const x = 1;", marks: [{ type: "code" }] },
            ],
          },
        ],
      })
    ).toBe("`const x = 1;`");

    // Highlight & Underline & Strike
    expect(
      serializeSliceToMarkdown({
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "highlighted", marks: [{ type: "highlight" }] },
              { type: "text", text: " and " },
              { type: "text", text: "underlined", marks: [{ type: "underline" }] },
              { type: "text", text: " and " },
              { type: "text", text: "striked", marks: [{ type: "strike" }] },
            ],
          },
        ],
      })
    ).toBe("==highlighted== and <u>underlined</u> and ~~striked~~");
  });

  it("serializes inline links correctly", () => {
    expect(
      serializeSliceToMarkdown({
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Google",
                marks: [{ type: "link", attrs: { href: "https://google.com" } }],
              },
            ],
          },
        ],
      })
    ).toBe("[Google](https://google.com)");
  });

  it("serializes multi-block selections across paragraphs", () => {
    const slice = {
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "First paragraph" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Second " },
            { type: "text", text: "paragraph", marks: [{ type: "bold" }] },
          ],
        },
      ],
    };
    expect(serializeSliceToMarkdown(slice)).toBe("First paragraph\n\nSecond **paragraph**");
  });

  it("serializes headings, blockquotes, and code blocks", () => {
    const slice = {
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Section Title" }],
        },
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "A wise quote" }],
            },
          ],
        },
        {
          type: "codeBlock",
          attrs: { language: "typescript" },
          content: [{ type: "text", text: "console.log('hello');" }],
        },
      ],
    };

    const expected = [
      "## Section Title",
      "> A wise quote",
      "```typescript\nconsole.log('hello');\n```",
    ].join("\n\n");

    expect(serializeSliceToMarkdown(slice)).toBe(expected);
  });

  it("serializes task lists and nested lists", () => {
    const slice = {
      content: [
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: true },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Done item" }],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Todo item" }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(serializeSliceToMarkdown(slice)).toBe("- [x] Done item\n- [ ] Todo item");
  });

  it("serializes callouts with custom types and titles", () => {
    const slice = {
      content: [
        {
          type: "callout",
          attrs: { type: "TIP", title: "Pro Tip" },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Use shortcuts for speed." }],
            },
          ],
        },
      ],
    };

    expect(serializeSliceToMarkdown(slice)).toBe("> [!TIP] **Pro Tip**\n> Use shortcuts for speed.");
  });

  it("serializes tables into markdown grid format", () => {
    const slice = {
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "Header 1" }] }],
                },
                {
                  type: "tableHeader",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "Header 2" }] }],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "Cell A" }] }],
                },
                {
                  type: "tableCell",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "Cell B" }] }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(serializeSliceToMarkdown(slice)).toBe(
      "| Header 1 | Header 2 |\n| --- | --- |\n| Cell A | Cell B |"
    );
  });
});

describe("selectionClipboard - copyToClipboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false for empty string", async () => {
    const result = await copyToClipboard("");
    expect(result).toBe(false);
  });

  it("uses navigator.clipboard.writeText when available", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const result = await copyToClipboard("test content");
    expect(result).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith("test content");
  });
});
