import { useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { DragHandle } from '@tiptap/extension-drag-handle';
import { Markdown } from '@tiptap/markdown';
import { SlashCommand } from './slash-command';

// ---- Types ----
export interface ReactjsTiptapEditorProps {
  content: string;
  initialContent?: string;
  onChange: (value: string) => void;
  enableCustomTemplates?: boolean;
  className?: string;
}

// ---- Drag handle icon ----
const createDragHandleElement = () => {
  const el = document.createElement('div');
  el.className = 'tiptap-drag-handle';
  el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-grip-vertical"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>`;
  return el;
};

// ---- Helper: parse content string to JSON object ----
function parseContent(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.type === 'doc') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// ---- Editor Component ----
export const ReactjsTiptapEditor: React.FC<ReactjsTiptapEditorProps> = ({
  content,
  onChange,
  className = '',
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      DragHandle.configure({
        render: createDragHandleElement,
      }),
      Markdown,
      SlashCommand,
    ],
    content: parseContent(content) || content,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      onChange(JSON.stringify(json));
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content prose prose-sm dark:prose-invert max-w-none focus:outline-none',
        'data-placeholder': '输入 / 使用命令，或直接开始书写...',
      },
    },
  });

  // Sync external content changes
  useEffect(() => {
    if (!editor) return;
    const currentJson = JSON.stringify(editor.getJSON());
    const contentJson = parseContent(content);
    if (contentJson && JSON.stringify(contentJson) !== currentJson) {
      editor.commands.setContent(contentJson);
    }
  }, [content, editor]);

  // Handle placeholder
  const handleFocus = useCallback(() => {
    editor?.commands.focus();
  }, [editor]);

  if (!editor) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${className}`}>
        <span className="text-muted-foreground text-sm">加载编辑器中...</span>
      </div>
    );
  }

  return (
    <div className={`w-full h-full flex flex-col ${className}`} onClick={handleFocus}>
      <EditorContent
        editor={editor}
        className="flex-1 overflow-y-auto px-6 py-4 h-full [&_.ProseMirror]:h-full [&_.ProseMirror]:outline-none"
      />
    </div>
  );
};

// ---- Markdown <-> JSON conversion utilities ----
export function convertMarkdownToTipTapJson(markdown: string): string {
  if (!markdown) return JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] });
  const trimmed = markdown.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.type === 'doc') return trimmed;
    } catch {
      // not valid JSON, treat as markdown
    }
  }
  // Fallback: wrap markdown lines as paragraphs
  return JSON.stringify({
    type: 'doc',
    content: markdown.split('\n').map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  });
}

export function convertTipTapJsonToMarkdown(jsonOrText: string): string {
  if (!jsonOrText) return '';
  try {
    const parsed = JSON.parse(jsonOrText);
    if (parsed && parsed.content && Array.isArray(parsed.content)) {
      return parsed.content
        .map((block: any) => {
          if (block.type === 'heading') {
            const level = block.attrs?.level || 1;
            const prefix = '#'.repeat(level) + ' ';
            const text = block.content?.map((inline: any) => inline.text || '').join('') || '';
            return prefix + text;
          }
          if (block.type === 'bulletList' || block.type === 'orderedList') {
            return block.content?.map((item: any, idx: number) => {
              const prefix = block.type === 'orderedList' ? `${idx + 1}. ` : '- ';
              const text = item.content?.[0]?.content?.map((inline: any) => inline.text || '').join('') || '';
              return prefix + text;
            }).join('\n') || '';
          }
          if (block.type === 'taskList') {
            return block.content?.map((item: any) => {
              const checked = item.attrs?.checked ? 'x' : ' ';
              const text = item.content?.[0]?.content?.map((inline: any) => inline.text || '').join('') || '';
              return `- [${checked}] ${text}`;
            }).join('\n') || '';
          }
          if (block.type === 'blockquote') {
            const text = block.content?.map((inner: any) => {
              if (inner.type === 'paragraph') {
                return inner.content?.map((inline: any) => inline.text || '').join('') || '';
              }
              return '';
            }).join('\n') || '';
            return text.split('\n').map((line: string) => `> ${line}`).join('\n');
          }
          if (block.type === 'codeBlock') {
            const lang = block.attrs?.language || '';
            const text = block.content?.map((inline: any) => inline.text || '').join('') || '';
            return `\`\`\`${lang}\n${text}\n\`\`\``;
          }
          if (block.type === 'horizontalRule') {
            return '---';
          }
          if (block.content && Array.isArray(block.content)) {
            return block.content.map((inline: any) => inline.text || '').join('');
          }
          return '';
        })
        .join('\n\n');
    }
  } catch {
    // Not JSON, return as-is
  }
  return jsonOrText;
}