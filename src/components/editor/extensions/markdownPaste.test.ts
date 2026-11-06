// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { isLikelyMarkdown, hasSemanticRichHtml, MarkdownPaste } from "./MarkdownPaste";
import { createFullExtensions } from "../presets/full";
import { createCompactExtensions } from "../presets/compact";
import { createMinimalExtensions } from "../presets/minimal";

describe("MarkdownPaste detection utilities", () => {
  it("detects headings", () => {
    expect(isLikelyMarkdown("# Heading 1")).toBe(true);
    expect(isLikelyMarkdown("Some text\n## Heading 2")).toBe(true);
    expect(isLikelyMarkdown("### Subheading\ncontent")).toBe(true);
  });

  it("detects lists and task lists", () => {
    expect(isLikelyMarkdown("- item 1\n- item 2")).toBe(true);
    expect(isLikelyMarkdown("* item 1\n* item 2")).toBe(true);
    expect(isLikelyMarkdown("1. First\n2. Second")).toBe(true);
    expect(isLikelyMarkdown("- [ ] todo item")).toBe(true);
    expect(isLikelyMarkdown("- [x] done item")).toBe(true);
  });

  it("detects blockquotes and callouts", () => {
    expect(isLikelyMarkdown("> This is a quote")).toBe(true);
    expect(isLikelyMarkdown("> [!NOTE]\n> callout text")).toBe(true);
  });

  it("detects code blocks and tables", () => {
    expect(isLikelyMarkdown("```js\nconsole.log(1);\n```")).toBe(true);
    expect(isLikelyMarkdown("| A | B |\n| --- | --- |\n| 1 | 2 |")).toBe(true);
  });

  it("detects inline markdown formatting", () => {
    expect(isLikelyMarkdown("Text with **bold** word")).toBe(true);
    expect(isLikelyMarkdown("Text with `inline code`")).toBe(true);
    expect(isLikelyMarkdown("Text with ~~strikethrough~~")).toBe(true);
    expect(isLikelyMarkdown("Link [Google](https://google.com)")).toBe(true);
    expect(isLikelyMarkdown("Wikilink [[My Note]]")).toBe(true);
  });

  it("does NOT falsely detect plain text", () => {
    expect(isLikelyMarkdown("Just plain text without formatting")).toBe(false);
    expect(isLikelyMarkdown("Calculation: 5 * 10 = 50")).toBe(false);
    expect(isLikelyMarkdown("Email: user@example.com")).toBe(false);
    expect(isLikelyMarkdown("")).toBe(false);
    expect(isLikelyMarkdown("   ")).toBe(false);
  });

  it("differentiates semantic rich HTML from plain/code wrappers", () => {
    // Rich HTML from browsers / Word / Docs
    expect(hasSemanticRichHtml("<h1>Heading</h1>")).toBe(true);
    expect(hasSemanticRichHtml("<ul><li>item</li></ul>")).toBe(true);
    expect(hasSemanticRichHtml("<table><tr><td>cell</td></tr></table>")).toBe(true);
    expect(hasSemanticRichHtml('<p class="MsoNormal">Word doc text</p>')).toBe(true);
    expect(hasSemanticRichHtml('<b id="docs-internal-guid-123">Docs text</b>')).toBe(true);

    // VS Code / terminal / plain wrapper
    expect(hasSemanticRichHtml('<div style="font-family: Consolas;"><span># Title</span></div>')).toBe(false);
    expect(hasSemanticRichHtml("<p># Title\n- item 1</p>")).toBe(false);
    expect(hasSemanticRichHtml("")).toBe(false);
  });

  it("intercepts paste event and converts markdown text into rich nodes", () => {
    const editor = new Editor({
      extensions: [StarterKit, Markdown, MarkdownPaste],
      content: "<p></p>",
    });

    const preventDefault = vi.fn();
    const event = {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "# Pasted Heading\n\n- item 1\n- item 2" : ""),
        files: [],
      },
      preventDefault,
    } as any;

    const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event, null as any));
    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalled();

    const json = editor.getJSON();
    const types = json.content?.map((c) => c.type);
    expect(types).toContain("heading");
    expect(types).toContain("bulletList");
  });

  it("verifies full preset has native markdown support and getMarkdown", () => {
    const editor = new Editor({
      extensions: createFullExtensions(),
      content: "<p>Hello <strong>world</strong></p>",
    });

    expect(typeof editor.getMarkdown).toBe("function");
    expect(editor.getMarkdown()).toContain("Hello **world**");

    editor.commands.setContent("# Full Preset Title\n\n- task 1", {
      contentType: "markdown",
    });
    expect(editor.getJSON().content?.[0].type).toBe("heading");
  });

  it("verifies compact preset has native markdown support", () => {
    const editor = new Editor({
      extensions: createCompactExtensions(),
      content: "<p></p>",
    });

    expect(typeof editor.getMarkdown).toBe("function");

    editor.commands.setContent("## Compact Heading\n\n- [ ] Task item", {
      contentType: "markdown",
    });
    expect(editor.getJSON().content?.[0].type).toBe("heading");
  });

  it("verifies minimal preset has native markdown support", () => {
    const editor = new Editor({
      extensions: createMinimalExtensions(),
      content: "<p></p>",
    });

    expect(typeof editor.getMarkdown).toBe("function");

    editor.commands.setContent("Simple memo with **bold** mark", {
      contentType: "markdown",
    });
    const p = editor.getJSON().content?.[0];
    expect(p?.content?.some((c: any) => c.marks?.some((m: any) => m.type === "bold"))).toBe(true);
  });
});
