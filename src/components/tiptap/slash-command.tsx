import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import { Suggestion } from '@tiptap/suggestion';
import type { SuggestionProps } from '@tiptap/suggestion';
import {
  Heading1, Heading2, Heading3, List, ListOrdered,
  ListTodo, Quote, Code, Minus, Text,
} from 'lucide-react';

// ---- Slash Command Item ----
interface SlashCommandItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  command: (props: SuggestionProps<SlashCommandItem>) => void;
}

const getSlashCommands = (): SlashCommandItem[] => [
  {
    title: '正文',
    description: '普通文本段落',
    icon: <Text size={16} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: '标题 1',
    description: '一级标题',
    icon: <Heading1 size={16} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run();
    },
  },
  {
    title: '标题 2',
    description: '二级标题',
    icon: <Heading2 size={16} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run();
    },
  },
  {
    title: '标题 3',
    description: '三级标题',
    icon: <Heading3 size={16} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run();
    },
  },
  {
    title: '无序列表',
    description: '创建无序列表',
    icon: <List size={16} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: '有序列表',
    description: '创建有序列表',
    icon: <ListOrdered size={16} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: '任务列表',
    description: '创建待办任务列表',
    icon: <ListTodo size={16} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: '引用块',
    description: '创建引用块',
    icon: <Quote size={16} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: '代码块',
    description: '插入代码块',
    icon: <Code size={16} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: '分割线',
    description: '插入分割线',
    icon: <Minus size={16} />,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
];

// ---- React Component for the dropdown ----
interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

const SlashCommandList: React.FC<SlashCommandListProps> = ({ items, command }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedRef = useRef<HTMLButtonElement>(null);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) {
        command(item);
      }
    },
    [items, command],
  );

  // Reset index when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  // Scroll selected into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent): boolean => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return true;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
        return true;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
    [items, selectedIndex, selectItem],
  );

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [onKeyDown]);

  if (items.length === 0) return null;

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-1 w-56 overflow-hidden">
      {items.map((item, index) => (
        <button
          key={item.title}
          ref={index === selectedIndex ? selectedRef : undefined}
          className={`flex items-center gap-3 w-full px-3 py-2 text-left rounded-md text-sm transition-colors ${
            index === selectedIndex
              ? 'bg-accent text-accent-foreground'
              : 'text-foreground hover:bg-muted'
          }`}
          onClick={() => selectItem(index)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className="flex items-center justify-center w-7 h-7 rounded bg-muted text-muted-foreground shrink-0">
            {item.icon}
          </span>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-foreground">{item.title}</span>
            <span className="text-xs text-muted-foreground truncate">{item.description}</span>
          </div>
        </button>
      ))}
    </div>
  );
};

// ---- Tiptap Extension wrapping Suggestion plugin ----
export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    const plugin = Suggestion<SlashCommandItem>({
      editor: this.editor,
      char: '/',
      startOfLine: false,
      allowedPrefixes: [' '],
      decorationClass: 'slash-command-decoration',
      command: ({ editor, range, props }) => {
        props.command({ editor, range, props } as unknown as SuggestionProps<SlashCommandItem>);
      },
      items: ({ query }) => {
        const commands = getSlashCommands();
        if (!query) return commands;
        const lower = query.toLowerCase();
        return commands.filter(
          (item) =>
            item.title.toLowerCase().includes(lower) ||
            item.description.toLowerCase().includes(lower),
        );
      },
      render: () => {
        let component: ReactRenderer | null = null;
        let popup: HTMLElement | null = null;

        return {
          onStart: (props) => {
            component = new ReactRenderer(SlashCommandList, {
              props: {
                items: props.items,
                command: (item: SlashCommandItem) => {
                  item.command(props as unknown as SuggestionProps<SlashCommandItem>);
                },
              },
              editor: props.editor,
            });

            popup = document.createElement('div');
            popup.className = 'slash-command-popup';
            popup.style.position = 'fixed';
            popup.style.zIndex = '100';
            document.body.appendChild(popup);
            popup.appendChild(component.element as unknown as HTMLElement);
          },
          onUpdate(props) {
            component?.updateProps({
              items: props.items,
              command: (item: SlashCommandItem) => {
                item.command(props as unknown as SuggestionProps<SlashCommandItem>);
              },
            });
            if (!popup) return;
            const rect = props.clientRect?.();
            if (rect) {
              popup.style.left = `${rect.left}px`;
              popup.style.top = `${rect.bottom + 4}px`;
            }
          },
          onKeyDown(props) {
            if (component?.ref) {
              const handled = (component.ref as unknown as { onKeyDown?: (e: KeyboardEvent) => boolean }).onKeyDown?.(props.event);
              return handled ?? false;
            }
            return false;
          },
          onExit() {
            component?.destroy();
            component = null;
            popup?.remove();
            popup = null;
          },
        };
      },
    });

    return [plugin];
  },
});