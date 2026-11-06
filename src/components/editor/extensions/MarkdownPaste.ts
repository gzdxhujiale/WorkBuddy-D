import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export function isLikelyMarkdown(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  // 1. Markdown Headings: "# Heading", "## Heading", etc.
  if (/(?:^|\r?\n)#{1,6}[ \t]+\S+/m.test(trimmed)) return true;

  // 2. Unordered lists: "- item", "* item", "+ item"
  if (/(?:^|\r?\n)[ \t]*[-*+][ \t]+\S+/m.test(trimmed)) return true;

  // 3. Ordered lists: "1. item", "2. item"
  if (/(?:^|\r?\n)[ \t]*\d+\.[ \t]+\S+/m.test(trimmed)) return true;

  // 4. Task lists: "- [ ] todo", "- [x] done"
  if (/(?:^|\r?\n)[ \t]*[-*+][ \t]+\[[ xX]\][ \t]+\S+/m.test(trimmed)) return true;

  // 5. Blockquotes or Callouts: "> text", "> [!NOTE]"
  if (/(?:^|\r?\n)[ \t]*>[ \t]*\S+/m.test(trimmed)) return true;

  // 6. Fenced code blocks: "```lang\n...```"
  if (/```[\s\S]*?```/.test(trimmed)) return true;

  // 7. Markdown Tables: "| col | col |\n| --- | --- |"
  if (/\|[^\r\n]+\|[\r\n]+[ \t]*\|[\s\-:|]+\|/m.test(trimmed)) return true;

  // 8. Horizontal rules: "---", "***", "___" (on its own line)
  if (/(?:^|\r?\n)[ \t]*(?:---|\*\*\*|___)[ \t]*(?:\r?\n|$)/m.test(trimmed)) return true;

  // 9. Inline Markdown with pairs:
  // Bold: **text** or __text__
  if (/\*\*[^\*\r\n]+\*\*|__[^\_\r\n]+__/.test(trimmed)) return true;
  // Strike: ~~text~~
  if (/~~[^~\r\n]+~~/.test(trimmed)) return true;
  // Inline code: `text`
  if (/`[^`\r\n]+`/.test(trimmed)) return true;
  // Markdown links: [text](http... or /path)
  if (/\[[^\r\n\]]+\]\((?:https?:\/\/|\/)[^\s)]+\)/.test(trimmed)) return true;
  // Wikilinks: [[note]]
  if (/\[\[[^\r\n\]]+\]\]/.test(trimmed)) return true;

  return false;
}

export function hasSemanticRichHtml(html: string): boolean {
  if (!html || typeof html !== "string") return false;

  // Office / Google Docs markers
  if (/class=["']?[^"'>]*\bMso|\<o:p\b|id=["']docs-internal-guid/i.test(html)) {
    return true;
  }

  // Semantic block elements
  if (/<(h[1-6]|table|tbody|tr|td|th|ul|ol|li|blockquote|details)\b/i.test(html)) {
    return true;
  }

  return false;
}

export function insertMarkdownContent(editor: any, markdownText: string): boolean {
  if (!editor || editor.isDestroyed) return false;

  const mdManager = editor.markdown;
  if (!mdManager || typeof mdManager.parse !== "function") {
    return editor.commands.insertContent(markdownText);
  }

  try {
    const parsed = mdManager.parse(markdownText);
    const hasMultipleBlocks = parsed?.content && parsed.content.length > 1;
    const isSingleBlockNonParagraph =
      parsed?.content?.length === 1 && parsed.content[0].type !== "paragraph";

    if (!hasMultipleBlocks && !isSingleBlockNonParagraph && parsed?.content?.[0]?.content) {
      // Single paragraph inline content: insert inline children to prevent splitting paragraph
      return editor.commands.insertContent(parsed.content[0].content);
    } else if (parsed && parsed.content && parsed.content.length > 0) {
      return editor.commands.insertContent(parsed);
    }
  } catch (err) {
    console.warn("[MarkdownPaste] Failed to parse pasted markdown, falling back to insertContent:", err);
  }

  return editor.commands.insertContent(markdownText);
}

export const MarkdownPaste = Extension.create({
  name: "markdownPaste",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("markdownPaste"),
        props: {
          handlePaste: (_view, event) => {
            if (!this.editor.isEditable) return false;
            if (this.editor.isActive("codeBlock")) return false;

            const clipboardData = event.clipboardData;
            if (!clipboardData) return false;

            // If clipboard contains files (e.g. pasted screenshots), let image paste handler deal with it
            if (clipboardData.files && clipboardData.files.length > 0) {
              return false;
            }

            const text = clipboardData.getData("text/plain");
            if (!text || !text.trim()) return false;

            const html = clipboardData.getData("text/html");

            // If HTML contains semantic rich content (like actual table, heading, lists),
            // and is NOT a code-editor wrapper, let standard HTML paste handle it.
            if (html && hasSemanticRichHtml(html)) {
              return false;
            }

            // Check if text has Markdown syntax
            if (isLikelyMarkdown(text)) {
              event.preventDefault();
              insertMarkdownContent(this.editor, text);
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
