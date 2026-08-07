import React from 'react';

export interface ReactjsTiptapEditorProps {
  content: string;
  initialContent?: string;
  onChange: (value: string) => void;
  enableCustomTemplates?: boolean;
  className?: string;
}

export const ReactjsTiptapEditor: React.FC<ReactjsTiptapEditorProps> = ({
  content,
  onChange,
  className = '',
}) => {
  return (
    <div className={`w-full h-full flex flex-col ${className}`}>
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder="开始书写笔记内容..."
        className="w-full h-full flex-1 p-4 bg-transparent border-none outline-none resize-none text-slate-800 dark:text-slate-200 text-sm leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-500 font-sans"
      />
    </div>
  );
};

export function convertMarkdownToTipTapJson(markdown: string): string {
  if (!markdown) return JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] });
  const trimmed = markdown.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
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
          if (block.content && Array.isArray(block.content)) {
            return block.content.map((inline: any) => inline.text || '').join('');
          }
          return '';
        })
        .join('\n');
    }
  } catch {
    // If not JSON, return plain text
  }
  return jsonOrText;
}
