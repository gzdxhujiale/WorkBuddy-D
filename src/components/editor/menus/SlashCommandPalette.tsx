import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import type { Editor, Range } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code2,
  Quote,
  AlertCircle,
  Table as TableIcon,
  ChevronDownSquare,
  Minus,
  Calendar,
  Clock,
  BookTemplate,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  category: "format" | "blocks" | "insert";
  command: (params: { editor: Editor; range: Range }) => void;
}

export const defaultSlashCommands: SlashCommandItem[] = [
  {
    title: "一级标题",
    description: "大标题",
    icon: <Heading1 size={15} />,
    category: "format",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run();
    },
  },
  {
    title: "二级标题",
    description: "中标题",
    icon: <Heading2 size={15} />,
    category: "format",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run();
    },
  },
  {
    title: "三级标题",
    description: "小标题",
    icon: <Heading3 size={15} />,
    category: "format",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run();
    },
  },
  {
    title: "无序列表",
    description: "项目符号清单",
    icon: <List size={15} />,
    category: "blocks",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "有序列表",
    description: "数字序号清单",
    icon: <ListOrdered size={15} />,
    category: "blocks",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "任务待办",
    description: "勾选检查清单",
    icon: <CheckSquare size={15} />,
    category: "blocks",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "代码块",
    description: "支持语法高亮的代码区",
    icon: <Code2 size={15} />,
    category: "blocks",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "引用块",
    description: "段落引用样式",
    icon: <Quote size={15} />,
    category: "blocks",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "高亮提示盒 (Callout)",
    description: "醒目的彩色提示框",
    icon: <AlertCircle size={15} />,
    category: "blocks",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleCallout({ type: "NOTE" })
        .run();
    },
  },
  {
    title: "表格",
    description: "插入 3x3 结构化表格",
    icon: <TableIcon size={15} />,
    category: "blocks",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    title: "折叠详情",
    description: "可展开/收起的内容块",
    icon: <ChevronDownSquare size={15} />,
    category: "blocks",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setDetails().run();
    },
  },
  {
    title: "分割线",
    description: "横向分割段落",
    icon: <Minus size={15} />,
    category: "format",
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: "今日日期",
    description: "快速插入当前年月日",
    icon: <Calendar size={15} />,
    category: "insert",
    command: ({ editor, range }) => {
      const today = new Date().toISOString().slice(0, 10);
      editor.chain().focus().deleteRange(range).insertContent(today).run();
    },
  },
  {
    title: "当前时间",
    description: "快速插入当前时刻",
    icon: <Clock size={15} />,
    category: "insert",
    command: ({ editor, range }) => {
      const time = new Date().toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      editor.chain().focus().deleteRange(range).insertContent(time).run();
    },
  },
  {
    title: "复盘结构模板",
    description: "插入今日复盘常用框架",
    icon: <BookTemplate size={15} />,
    category: "insert",
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent([
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "🎯 今日关键战果" }] },
          { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "完成重点任务" }] }] }] },
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "💡 洞察与认知" }] },
          { type: "paragraph", content: [{ type: "text", text: "记录今天最有价值的想法或收获..." }] },
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "🚀 明日要务规划" }] },
          { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "优先启动事项" }] }] }] },
        ])
        .run();
    },
  },
];

export interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  isPixelTheme?: boolean;
}

export interface SlashCommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  ({ items, command, isPixelTheme }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          const item = items[selectedIndex];
          if (item) {
            command(item);
            return true;
          }
          return false;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div
          className={cn(
            "z-50 min-w-[200px] rounded-lg border border-border bg-popover p-2 text-xs text-muted-foreground shadow-md",
            isPixelTheme && "font-mono border-2 border-border/90 rounded-xs shadow-[2px_2px_0px_#000]"
          )}
        >
          无匹配指令
        </div>
      );
    }

    return (
      <div
        className={cn(
          "z-50 max-h-72 min-w-[240px] max-w-[300px] overflow-y-auto rounded-lg border border-border bg-popover/95 p-1 shadow-xl backdrop-blur-md select-none",
          isPixelTheme && "font-mono border-2 border-border/90 rounded-xs shadow-[2px_2px_0px_#000]"
        )}
      >
        <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
          输入命令快捷插入
        </div>
        {items.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <button
              key={`${item.title}-${index}`}
              type="button"
              onClick={() => command(item)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                isSelected
                  ? isPixelTheme
                    ? "bg-amber-200/90 text-amber-950 dark:bg-amber-900/80 dark:text-amber-100 font-bold"
                    : "bg-accent text-accent-foreground font-medium"
                  : "text-foreground hover:bg-muted"
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted/60 text-muted-foreground">
                {item.icon}
              </span>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="truncate font-medium">{item.title}</span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {item.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }
);

SlashCommandList.displayName = "SlashCommandList";

export const SlashCommandPluginKey = new PluginKey("customSlashCommand");

export interface SlashCommandOptions {
  suggestion: Omit<SuggestionOptions<SlashCommandItem>, "editor">;
}

export const SlashCommandExtension = Extension.create<SlashCommandOptions>({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        pluginKey: SlashCommandPluginKey,
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
