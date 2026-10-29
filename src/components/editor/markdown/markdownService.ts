import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TaskList as TiptapTaskList } from "@tiptap/extension-task-list";
import { TaskItem as TiptapTaskItem } from "@tiptap/extension-task-item";
import { Table as TiptapTable } from "@tiptap/extension-table";
import { TableRow as TiptapTableRow } from "@tiptap/extension-table-row";
import { TableHeader as TiptapTableHeader } from "@tiptap/extension-table-header";
import { TableCell as TiptapTableCell } from "@tiptap/extension-table-cell";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import { CustomCallout } from "../extensions/CustomCallout";
import { CustomDetails, DetailsSummary, DetailsContent } from "../extensions/CustomDetails";
import { CustomCodeBlockLowlight } from "../extensions/CodeBlockWithLowlight";
import { CustomImage } from "../extensions/CustomImage";
import { EMPTY_DOCUMENT, type EditorContentValue } from "../types";

let singletonParserEditor: Editor | null = null;

function getSingletonParserEditor(): Editor | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (!singletonParserEditor || singletonParserEditor.isDestroyed) {
    try {
      singletonParserEditor = new Editor({
        extensions: [
          StarterKit.configure({
            codeBlock: false,
          }),
          Markdown,
          TiptapTaskList,
          TiptapTaskItem,
          TiptapTable,
          TiptapTableRow,
          TiptapTableHeader,
          TiptapTableCell,
          Highlight,
          Underline,
          CustomCallout,
          CustomDetails,
          DetailsSummary,
          DetailsContent,
          CustomCodeBlockLowlight,
          CustomImage,
        ],
        content: EMPTY_DOCUMENT,
      });
    } catch (err) {
      console.warn("[MarkdownService] Failed to initialize singleton parser editor:", err);
      singletonParserEditor = null;
    }
  }
  return singletonParserEditor;
}

export function convertMarkdownToTipTapJson(markdown: string): string {
  if (!markdown || !markdown.trim()) return JSON.stringify(EMPTY_DOCUMENT);

  const trimmed = markdown.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && parsed.type === "doc") {
        return trimmed;
      }
    } catch {
      // Treat invalid JSON as markdown text below.
    }
  }

  const editor = getSingletonParserEditor();
  if (editor) {
    try {
      editor.commands.setContent(markdown, { contentType: "markdown", emitUpdate: false });
      const json = editor.getJSON();
      if (json && json.type === "doc" && Array.isArray(json.content) && json.content.length > 0) {
        return JSON.stringify(json);
      }
    } catch (err) {
      console.warn("[MarkdownService] Error in singleton markdown parsing:", err);
    }
  }

  // Pure fallback: line-by-line paragraph generation
  return JSON.stringify({
    type: "doc",
    content: markdown.split(/\r?\n/).map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  });
}

export function formatInlineNode(inline: any): string {
  if (!inline) return "";
  if (inline.type === "hardBreak") return "\n";
  if (inline.type === "wikilink") {
    return `[[${inline.attrs?.noteTitle || "无标题"}]]`;
  }
  let text = inline.text ?? "";
  if (!text) return "";
  if (!Array.isArray(inline.marks) || inline.marks.length === 0) {
    return text;
  }

  const markMap = new Map<string, any>(inline.marks.map((m: any) => [m.type, m]));

  if (markMap.has("code")) {
    text = `\`${text}\``;
  }
  if (markMap.has("highlight")) {
    text = `==${text}==`;
  }
  if (markMap.has("underline")) {
    text = `<u>${text}</u>`;
  }
  if (markMap.has("strike")) {
    text = `~~${text}~~`;
  }
  if (markMap.has("italic")) {
    text = `*${text}*`;
  }
  if (markMap.has("bold")) {
    text = `**${text}**`;
  }
  const linkMark = markMap.get("link");
  if (linkMark?.attrs?.href) {
    text = `[${text}](${linkMark.attrs.href})`;
  }

  return text;
}

export function formatInlineNodes(content?: any[]): string {
  if (!Array.isArray(content)) return "";
  return content.map(formatInlineNode).join("");
}

export function renderBlockToMarkdown(block: any, indent = ""): string {
  if (!block) return "";

  if (block.type === "heading") {
    const level = block.attrs?.level || 1;
    return `${indent}${"#".repeat(level)} ${formatInlineNodes(block.content)}`;
  }

  if (block.type === "paragraph") {
    return `${indent}${formatInlineNodes(block.content)}`;
  }

  if (block.type === "bulletList" || block.type === "orderedList") {
    const isOrdered = block.type === "orderedList";
    return (block.content || [])
      .map((item: any, idx: number) => {
        const marker = isOrdered ? `${idx + 1}. ` : "- ";
        const itemChildren: any[] = item.content || [];
        const lines: string[] = [];
        for (const child of itemChildren) {
          if (child.type === "paragraph") {
            lines.push(formatInlineNodes(child.content));
          } else {
            lines.push(renderBlockToMarkdown(child, indent + "  "));
          }
        }
        const firstLine = lines[0] ?? "";
        const remainingLines = lines.slice(1);
        let result = `${indent}${marker}${firstLine}`;
        if (remainingLines.length > 0) {
          result += "\n" + remainingLines.join("\n");
        }
        return result;
      })
      .join("\n");
  }

  if (block.type === "taskList") {
    return (block.content || [])
      .map((item: any) => {
        const checked = item.attrs?.checked ? "x" : " ";
        const marker = `- [${checked}] `;
        const itemChildren: any[] = item.content || [];
        const lines: string[] = [];
        for (const child of itemChildren) {
          if (child.type === "paragraph") {
            lines.push(formatInlineNodes(child.content));
          } else {
            lines.push(renderBlockToMarkdown(child, indent + "  "));
          }
        }
        const firstLine = lines[0] ?? "";
        const remainingLines = lines.slice(1);
        let result = `${indent}${marker}${firstLine}`;
        if (remainingLines.length > 0) {
          result += "\n" + remainingLines.join("\n");
        }
        return result;
      })
      .join("\n");
  }

  if (block.type === "listItem") {
    const itemChildren: any[] = block.content || [];
    const lines: string[] = [];
    for (const child of itemChildren) {
      if (child.type === "paragraph") {
        lines.push(formatInlineNodes(child.content));
      } else {
        lines.push(renderBlockToMarkdown(child, indent + "  "));
      }
    }
    const firstLine = lines[0] ?? "";
    const remainingLines = lines.slice(1);
    let result = `${indent}- ${firstLine}`;
    if (remainingLines.length > 0) {
      result += "\n" + remainingLines.join("\n");
    }
    return result;
  }

  if (block.type === "taskItem") {
    const checked = block.attrs?.checked ? "x" : " ";
    const itemChildren: any[] = block.content || [];
    const lines: string[] = [];
    for (const child of itemChildren) {
      if (child.type === "paragraph") {
        lines.push(formatInlineNodes(child.content));
      } else {
        lines.push(renderBlockToMarkdown(child, indent + "  "));
      }
    }
    const firstLine = lines[0] ?? "";
    const remainingLines = lines.slice(1);
    let result = `${indent}- [${checked}] ${firstLine}`;
    if (remainingLines.length > 0) {
      result += "\n" + remainingLines.join("\n");
    }
    return result;
  }

  if (block.type === "codeBlock") {
    const lang = block.attrs?.language || "";
    const code = (block.content || []).map((inline: any) => inline.text || "").join("");
    return `${indent}\`\`\`${lang}\n${code}\n${indent}\`\`\``;
  }

  if (block.type === "blockquote") {
    const text = (block.content || [])
      .map((inner: any) => renderBlockToMarkdown(inner, ""))
      .join("\n");
    return text
      .split("\n")
      .map((line: string) => `${indent}> ${line}`)
      .join("\n");
  }

  if (block.type === "callout") {
    const calloutType = (block.attrs?.type || "NOTE").toUpperCase();
    const title = block.attrs?.title || "";
    const header = title ? `> [!${calloutType}] **${title}**` : `> [!${calloutType}]`;
    const lines: string[] = [header];
    if (block.attrs?.body) {
      block.attrs.body.split("\n").forEach((l: string) => lines.push(`> ${l}`));
    } else if (Array.isArray(block.content)) {
      const contentText = block.content.map((c: any) => renderBlockToMarkdown(c, "")).join("\n");
      contentText.split("\n").forEach((l: string) => lines.push(`> ${l}`));
    }
    return lines.map((l) => `${indent}${l}`).join("\n");
  }

  if (block.type === "details") {
    const summaryNode = (block.content || []).find((c: any) => c.type === "detailsSummary");
    const summaryText = formatInlineNodes(summaryNode?.content) || "详细信息";
    const contentNode = (block.content || []).find((c: any) => c.type === "detailsContent");
    const bodyText = (contentNode?.content || [])
      .map((c: any) => renderBlockToMarkdown(c, ""))
      .filter(Boolean)
      .join("\n\n");
    return `${indent}<details>\n${indent}<summary>${summaryText}</summary>\n\n${bodyText}\n${indent}</details>`;
  }

  if (block.type === "image") {
    const src = block.attrs?.src || "";
    const alt = block.attrs?.alt || "";
    return `${indent}![${alt}](${src})`;
  }

  if (block.type === "table") {
    const rows = (block.content || []).map((row: any) => {
      const cells = (row.content || []).map((cell: any) => {
        const cellText = (cell.content || [])
          .map((p: any) => formatInlineNodes(p.content))
          .join(" ")
          .replace(/\|/g, "\\|")
          .trim();
        return cellText || " ";
      });
      return `${indent}| ${cells.join(" | ")} |`;
    });
    if (rows.length > 0) {
      const colCount = block.content?.[0]?.content?.length || 1;
      const separator = `${indent}| ${Array(colCount).fill("---").join(" | ")} |`;
      return [rows[0], separator, ...rows.slice(1)].join("\n");
    }
    return "";
  }

  if (block.type === "horizontalRule") {
    return `${indent}---`;
  }

  if (Array.isArray(block.content)) {
    return `${indent}${formatInlineNodes(block.content)}`;
  }

  return "";
}

export function convertTipTapJsonToMarkdown(jsonOrText: string): string {
  if (!jsonOrText || !jsonOrText.trim()) return "";

  try {
    const parsed = JSON.parse(jsonOrText);
    if (parsed && typeof parsed === "object" && parsed.type === "doc" && Array.isArray(parsed.content)) {
      // Check if standard nodes can be serialized directly by singleton manager
      const hasCustomNodes = parsed.content.some(
        (b: any) => b.type === "callout" || b.type === "details" || b.type === "wikilink"
      );

      if (!hasCustomNodes) {
        const editor = getSingletonParserEditor();
        if (editor) {
          try {
            editor.commands.setContent(parsed, { emitUpdate: false });
            const md =
              typeof editor.getMarkdown === "function"
                ? editor.getMarkdown()
                : editor.storage.markdown?.manager?.serialize(editor.getJSON());
            if (md && md.trim()) {
              return md;
            }
          } catch {
            // Fall through to high-fidelity AST renderer
          }
        }
      }

      // High-fidelity AST renderer preserving callouts, details, tables, images, nested lists
      return parsed.content
        .map((block: any) => renderBlockToMarkdown(block))
        .filter((text: string) => text.trim().length > 0)
        .join("\n\n");
    }
  } catch {
    // Return raw string if not JSON
  }

  return jsonOrText;
}

export function parseContent(raw: string): EditorContentValue {
  if (!raw || !raw.trim()) return EMPTY_DOCUMENT;

  const trimmed = raw.trim();
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      if ((parsed as { type?: string }).type === "doc") {
        return parsed as Record<string, unknown>;
      }
      // Unwrap legacy wrappers e.g. { text: "..." }
      const wrapper = parsed as Record<string, unknown>;
      for (const key of ["text", "raw", "html"]) {
        const val = wrapper[key];
        if (typeof val === "string") {
          const inner = parseContent(val);
          if (inner && typeof inner === "object" && (inner as { type?: string }).type === "doc") {
            return inner;
          }
        } else if (val && typeof val === "object" && (val as { type?: string }).type === "doc") {
          return val as Record<string, unknown>;
        }
      }
    }
  } catch {
    // Treat as markdown / plain-text
  }

  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;

  try {
    const jsonStr = convertMarkdownToTipTapJson(raw);
    const parsed: unknown = JSON.parse(jsonStr);
    if (parsed && typeof parsed === "object" && (parsed as { type?: string }).type === "doc") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall back to line split
  }

  return {
    type: "doc",
    content: raw.split(/\r?\n/).map((line) => ({
      type: "paragraph",
      ...(line ? { content: [{ type: "text", text: line }] } : {}),
    })),
  };
}
