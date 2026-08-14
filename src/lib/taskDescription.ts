type TiptapNode = {
  content?: TiptapNode[];
  text?: string;
  type?: string;
};

const BLOCK_NODES = new Set([
  "paragraph",
  "heading",
  "listItem",
  "taskItem",
  "blockquote",
  "codeBlock",
  "tableCell",
  "tableHeader",
]);

/**
 * Returns display text for a task description while accepting legacy plain text.
 * New rich-text descriptions are serialized Tiptap documents stored in the text column.
 */
export function getTaskDescriptionText(description?: string): string {
  if (!description) return "";

  try {
    const parsed: unknown = JSON.parse(description);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed as TiptapNode).type !== "doc" ||
      !Array.isArray((parsed as TiptapNode).content)
    ) {
      return description;
    }

    let text = "";
    const appendNode = (node: TiptapNode) => {
      if (node.type === "hardBreak") {
        text += "\n";
        return;
      }
      if (typeof node.text === "string") text += node.text;
      node.content?.forEach(appendNode);
      if (BLOCK_NODES.has(node.type ?? "") && text && !text.endsWith("\n")) {
        text += "\n";
      }
    };

    (parsed as TiptapNode).content?.forEach(appendNode);
    return text.replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return description;
  }
}

export function hasTaskDescription(description?: string): boolean {
  return getTaskDescriptionText(description).trim().length > 0;
}
