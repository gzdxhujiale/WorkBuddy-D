import type { Editor } from "@tiptap/core";
import type { Slice } from "@tiptap/pm/model";
import { formatInlineNodes, renderBlockToMarkdown } from "../markdown/markdownService";

export interface SliceLikeJson {
  content?: any[];
  openStart?: number;
  openEnd?: number;
}

/**
 * Serializes a ProseMirror Slice or Slice-like JSON structure into Markdown.
 * Inline-only selections (within a single paragraph) are rendered as inline Markdown
 * without wrapping paragraph line breaks, while multi-block selections preserve their
 * structural AST Markdown representations (headings, lists, tables, callouts, code blocks).
 */
export function serializeSliceToMarkdown(
  sliceOrJson: Slice | SliceLikeJson | null | undefined
): string {
  if (!sliceOrJson) return "";

  const json: SliceLikeJson =
    typeof (sliceOrJson as Slice).toJSON === "function"
      ? (sliceOrJson as Slice).toJSON()
      : (sliceOrJson as SliceLikeJson);

  const content = Array.isArray(json?.content) ? json.content : [];
  if (content.length === 0) return "";

  const openStart = json.openStart ?? 0;
  const openEnd = json.openEnd ?? 0;

  // Single paragraph selection: render only inline content to avoid leading/trailing block breaks
  if (content.length === 1 && content[0]?.type === "paragraph") {
    return formatInlineNodes(content[0].content);
  }

  // Single codeBlock selection: if open-ended within code block, return raw code text
  if (content.length === 1 && content[0]?.type === "codeBlock") {
    if (openStart > 0 || openEnd > 0) {
      return (content[0].content || []).map((inline: any) => inline.text || "").join("");
    }
    return renderBlockToMarkdown(content[0]);
  }

  // Multi-block structure
  const renderedBlocks = content
    .map((block: any) => renderBlockToMarkdown(block))
    .filter((text: string) => text.trim().length > 0);

  return renderedBlocks.join("\n\n");
}

/**
 * Extracts and serializes the active selection from a Tiptap Editor instance into Markdown.
 */
export function serializeSelectionToMarkdown(editor: Editor): string {
  if (!editor || editor.isDestroyed) return "";
  const { selection } = editor.state;
  if (!selection || selection.empty) return "";

  const slice = selection.content();
  return serializeSliceToMarkdown(slice);
}

/**
 * Extracts the active selection from a Tiptap Editor instance as unformatted plain text.
 */
export function serializeSelectionToPlainText(editor: Editor): string {
  if (!editor || editor.isDestroyed) return "";
  const { selection, doc } = editor.state;
  if (!selection || selection.empty) return "";

  return doc.textBetween(selection.from, selection.to, "\n\n", "\n");
}

/**
 * Copies a string payload to the system clipboard, with graceful textarea fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to DOM fallback
    }
  }

  if (typeof document !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "0";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      return successful;
    } catch {
      return false;
    }
  }

  return false;
}
