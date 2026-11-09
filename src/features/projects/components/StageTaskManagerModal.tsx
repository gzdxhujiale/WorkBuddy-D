import { useEffect, useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Modal } from "@/components/ui/modal";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { sortStageTasks } from "@/lib/taskSort";
import { cn } from "@/lib/utils";
import type { ProjectStage, ProjectTask } from "@/types/project";
import {
  computeStageTaskMutations,
  type StageTaskBatchMutations,
} from "../lib/stagePipeline";

const StageTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-task-id": {
        default: null,
        keepOnSplit: false,
        parseHTML: (element) => element.getAttribute("data-task-id"),
        renderHTML: (attributes) => {
          if (!attributes["data-task-id"]) return {};
          return { "data-task-id": attributes["data-task-id"] };
        },
      },
    };
  },
});

function buildInitialHtml(tasks: ProjectTask[]): string {
  if (tasks.length === 0) {
    return `<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>`;
  }
  const items = tasks.map((t) => {
    const escaped = t.title
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    const checked = t.completed ? "true" : "false";
    return `<li data-type="taskItem" data-checked="${checked}" data-task-id="${t.id}"><p>${escaped}</p></li>`;
  });
  return `<ul data-type="taskList">${items.join("")}</ul>`;
}

export type { StageTaskBatchMutations };

export interface StageTaskManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: ProjectStage;
  stages: ProjectStage[];
  tasks: ProjectTask[];
  disabled?: boolean;
  onSyncTasks: (mutations: StageTaskBatchMutations) => Promise<void> | void;
}

export function StageTaskManagerModal({
  open,
  onOpenChange,
  stage,
  stages,
  tasks,
  disabled,
  onSyncTasks,
}: StageTaskManagerModalProps) {
  const { isPixelTheme } = useAppThemeStyle();
  const [saving, setSaving] = useState(false);

  // Active tasks directly assigned to this stage, sorted deterministically
  const activeTasks = useMemo(() => {
    return sortStageTasks(tasks.filter((t) => t.projectStageId === stage.id));
  }, [tasks, stage.id]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      TaskList,
      StageTaskItem.configure({
        nested: false,
        HTMLAttributes: {
          class: "tiptap-stage-task-item flex items-center gap-2 my-1.5",
        },
      }),
      Placeholder.configure({
        placeholder: "输入任务标题，按 Enter 换行新建，退格删除...",
      }),
    ],
    content: buildInitialHtml(activeTasks),
    autofocus: "end",
  });

  useEffect(() => {
    if (open && editor) {
      editor.commands.setContent(buildInitialHtml(activeTasks));
      setTimeout(() => {
        editor.commands.focus("end");
      }, 50);
    }
  }, [open, editor]);

  const handleSave = async () => {
    if (!editor || saving) return;
    setSaving(true);
    try {
      const json = editor.getJSON();
      const parsedItems: Array<{ taskId?: string; title: string; checked: boolean }> = [];

      const traverse = (node: any) => {
        if (node.type === "taskItem") {
          const text = (node.content || [])
            .map((c: any) => {
              if (c.type === "paragraph" && c.content) {
                return c.content.map((t: any) => t.text || "").join("");
              }
              return c.text || "";
            })
            .join("")
            .trim();

          if (text) {
            parsedItems.push({
              taskId: node.attrs?.["data-task-id"] || undefined,
              title: text,
              checked: Boolean(node.attrs?.checked),
            });
          }
        }
        if (node.content && Array.isArray(node.content)) {
          for (const child of node.content) {
            traverse(child);
          }
        }
      };

      traverse(json);

      const mutations = computeStageTaskMutations(
        parsedItems,
        activeTasks,
        stage,
        stages
      );

      await onSyncTasks(mutations);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={
        <div className="flex items-center gap-2">
          <span>📝 任务清单管理</span>
          <span
            className={cn(
              "px-2 py-0.5 text-xs font-semibold rounded",
              isPixelTheme
                ? "bg-amber-100 text-amber-900 border border-amber-800 shadow-[1px_1px_0px_#000]"
                : "bg-primary/10 text-primary"
            )}
          >
            {stage.name}
          </span>
        </div>
      }
      width={600}
      onCancel={() => onOpenChange(false)}
      onOk={handleSave}
      okText={saving ? "保存中..." : "保存更改"}
      okDisabled={disabled || saving}
      cancelText="取消"
    >
      <div className="flex flex-col gap-3 py-1">
        <p className="text-xs text-muted-foreground select-none">
          💡 提示：按 <strong>Enter</strong> 换行添加任务，<strong>Backspace</strong> 删除整行任务；勾选项目将在保存时触发流水线工序流转。
        </p>

        <div
          className={cn(
            "min-h-[220px] max-h-[55vh] overflow-y-auto px-3.5 py-2.5 rounded-lg border transition-all text-sm leading-relaxed cursor-text",
            isPixelTheme
              ? "border-2 border-border/90 bg-card font-mono shadow-[3px_3px_0px_rgba(0,0,0,0.12)] text-foreground"
              : "border-border/70 bg-background/80 hover:border-primary/40 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20"
          )}
          onClick={() => {
            if (editor && !editor.isFocused) {
              editor.commands.focus("end");
            }
          }}
        >
          <style>{`
            .tiptap-stage-task-editor,
            .tiptap-stage-task-editor * {
              outline: none !important;
            }
            .tiptap-stage-task-editor .ProseMirror,
            .tiptap-stage-task-editor .ProseMirror:focus,
            .tiptap-stage-task-editor .ProseMirror-focused {
              outline: none !important;
              border: none !important;
              box-shadow: none !important;
              min-height: 180px;
            }
            .tiptap-stage-task-editor ul[data-type="taskList"] {
              list-style: none;
              padding: 0;
              margin: 0;
              outline: none !important;
              border: none !important;
            }
            .tiptap-stage-task-editor li[data-type="taskItem"] {
              display: flex;
              align-items: flex-start;
              gap: 8px;
              margin: 6px 0;
              outline: none !important;
              border: none !important;
            }
            .tiptap-stage-task-editor li[data-type="taskItem"]:focus,
            .tiptap-stage-task-editor li[data-type="taskItem"]:focus-within {
              outline: none !important;
              border: none !important;
              box-shadow: none !important;
            }
            .tiptap-stage-task-editor li[data-type="taskItem"] > label {
              user-select: none;
              margin-top: 3px;
              cursor: pointer;
            }
            .tiptap-stage-task-editor li[data-type="taskItem"] > label input[type="checkbox"] {
              cursor: pointer;
              width: 15px;
              height: 15px;
            }
            .tiptap-stage-task-editor li[data-type="taskItem"] > div {
              flex: 1 1 auto;
              min-width: 0;
              outline: none !important;
              border: none !important;
            }
            .tiptap-stage-task-editor li[data-type="taskItem"][data-checked="true"] > div {
              text-decoration: line-through;
              opacity: 0.6;
            }
            .tiptap-stage-task-editor p {
              margin: 0;
              outline: none !important;
              border: none !important;
            }
          `}</style>
          <EditorContent
            editor={editor}
            className={cn(
              "tiptap-stage-task-editor outline-none min-h-[180px]",
              "[&_.ProseMirror]:outline-none [&_.ProseMirror]:border-0 [&_.ProseMirror]:min-h-[180px] [&_.ProseMirror]:cursor-text focus:outline-none focus-visible:outline-none"
            )}
          />
        </div>
      </div>
    </Modal>
  );
}
