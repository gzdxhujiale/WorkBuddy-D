import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Cloud,
  Columns2,
  ExternalLink,
  MoreHorizontal,
  FileDown,
  FileUp,
  PanelRight,
  LayoutTemplate,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Popconfirm } from "@/components/ui/popconfirm";
import {
  ReactjsTiptapEditor,
  convertMarkdownToTipTapJson,
  convertTipTapJsonToMarkdown,
} from "@/components/ui/reactjs-tiptap-editor";
import { PixelHourglass, PixelSparkle } from "@/components/pixel/PixelIcons";
import { toast } from "@/components/ui/toast";
import { logSilent } from "@/lib/syncEngine";
import { cn } from "@/lib/utils";
import * as knowledgeService from "../api/knowledgeService";
import type { Note } from "../types";

export interface FullNoteEditorProps {
  note: Note;
  folderName?: string;
  isPixelTheme?: boolean;
  autoFocusEditor?: boolean;
  onBackToList: () => void;
  onUpdate: (id: string, title: string, content: string) => void;
  onFlush: (id: string) => Promise<void>;
  onDuplicate: (note: Note) => void;
  onSaveAsTemplate: (note: Note) => void;
  onDelete: (note: Note) => void;
  onSwitchToDrawer: () => void;
  onOpenStandaloneWindow: () => void;
}

export function FullNoteEditor({
  note,
  folderName,
  isPixelTheme,
  autoFocusEditor,
  onBackToList,
  onUpdate,
  onFlush,
  onDuplicate,
  onSaveAsTemplate,
  onDelete,
  onSwitchToDrawer,
  onOpenStandaloneWindow,
}: FullNoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content || "");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");

  const isDirtyRef = useRef(false);
  const activeEditingNoteIdRef = useRef(note.id);
  const latestDataRef = useRef({
    title: note.title,
    content: note.content || "",
    note,
    contentLoaded: note.contentLoaded === true,
  });
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (activeEditingNoteIdRef.current !== note.id) {
      activeEditingNoteIdRef.current = note.id;
      setTitle(note.title);
      setContent(note.content || "");
      setSaveStatus("saved");
      isDirtyRef.current = false;
      latestDataRef.current = {
        title: note.title,
        content: note.content || "",
        note,
        contentLoaded: note.contentLoaded === true,
      };
    } else if (!isDirtyRef.current) {
      setTitle(note.title);
      setContent(note.content || "");
      latestDataRef.current = {
        title: note.title,
        content: note.content || "",
        note,
        contentLoaded: note.contentLoaded === true,
      };
    }
  }, [note.id, note.title, note.content, note.contentLoaded]);

  useEffect(() => {
    latestDataRef.current = {
      title,
      content,
      note,
      contentLoaded: note.contentLoaded === true,
    };
  }, [title, content, note]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (isDirtyRef.current) {
        const {
          note: currentNote,
          title: currentTitle,
          content: currentContent,
          contentLoaded,
        } = latestDataRef.current;
        if (currentNote && contentLoaded) {
          isDirtyRef.current = false;
          onUpdateRef.current(currentNote.id, currentTitle, currentContent);
          void onFlush(currentNote.id);
        }
      }
    };
  }, [onFlush]);

  // Debounced auto-save
  useEffect(() => {
    if (note.contentLoaded !== true) return;
    if (title !== note.title || content !== note.content) {
      isDirtyRef.current = true;
      setSaveStatus("saving");
      const timer = setTimeout(() => {
        isDirtyRef.current = false;
        onUpdateRef.current(note.id, title, content);
        setSaveStatus("saved");
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [title, content, note.id, note.title, note.content, note.contentLoaded]);

  const handleImport = async () => {
    const imported = await knowledgeService.pickMarkdownFile();
    if (imported) {
      const jsonStr = convertMarkdownToTipTapJson(imported.content);
      setContent(jsonStr);
      if (imported.title) {
        setTitle(imported.title);
      }
      toast.success("导入成功！");
    }
  };

  const handleExport = async () => {
    try {
      const exportText = convertTipTapJsonToMarkdown(content);
      await knowledgeService.saveMarkdownFile(
        `${title || (isPixelTheme ? "未命名卷轴" : "未命名笔记")}.md`,
        exportText
      );
      toast.success("导出成功！");
    } catch (err) {
      logSilent("fullNoteEditor", "note export failed", err);
      toast.error("导出失败，请检查文件权限后重试。");
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground overflow-hidden">
      {/* Top Navbar */}
      <header
        className={cn(
          "flex h-12 items-center justify-between border-b px-4 shrink-0 bg-card z-10",
          isPixelTheme ? "border-b-2 border-border font-mono" : "border-border"
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToList}
            className="flex items-center gap-1.5 px-2 text-muted-foreground hover:text-foreground"
            title="返回笔记列表"
          >
            <ArrowLeft size={16} />
            <span className="text-xs font-medium">返回列表</span>
          </Button>

          {folderName && (
            <>
              <span className="text-muted-foreground/60 text-xs">/</span>
              <span className="text-xs text-muted-foreground truncate max-w-40 font-medium">
                {folderName}
              </span>
            </>
          )}

          <span className="text-muted-foreground/60 text-xs">/</span>
          <span className="text-xs font-semibold text-foreground truncate max-w-64">
            {title || "未命名笔记"}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Save Status Badge */}
          <span
            title={saveStatus === "saving" ? "保存中..." : "已自动保存"}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-xs transition-all",
              isPixelTheme
                ? saveStatus === "saving"
                  ? "bg-amber-100 text-amber-900 border border-amber-900/40 rounded-xs font-mono font-bold"
                  : "bg-amber-200/90 text-amber-950 dark:bg-amber-900/60 dark:text-amber-100 border border-amber-900/40 rounded-xs font-mono font-bold"
                : "rounded-lg bg-primary/10 text-primary"
            )}
          >
            {isPixelTheme ? (
              saveStatus === "saving" ? (
                <PixelHourglass size={14} className="animate-spin" />
              ) : (
                <PixelSparkle size={14} />
              )
            ) : (
              <Cloud
                size={16}
                className={cn(
                  "transition-all duration-300",
                  saveStatus === "saving" ? "opacity-50 animate-pulse" : "opacity-100"
                )}
              />
            )}
            <span>
              {isPixelTheme
                ? saveStatus === "saving"
                  ? "刻印中"
                  : "已封印"
                : saveStatus === "saving"
                ? "保存中"
                : "已保存"}
            </span>
          </span>

          {/* Mode Switch: Switch back to Drawer */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onSwitchToDrawer}
            title="切换为侧边抽屉"
            className={isPixelTheme ? "rounded-xs" : "rounded-lg"}
          >
            <Columns2 size={17} />
          </Button>

          {/* Mode Switch: Open in Standalone Native Window */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenStandaloneWindow}
            title="在独立窗口中打开"
            className={isPixelTheme ? "rounded-xs" : "rounded-lg"}
          >
            <ExternalLink size={17} />
          </Button>

          {/* More Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={isPixelTheme ? "rounded-xs" : "rounded-lg"}
              >
                <MoreHorizontal size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36">
              <DropdownMenuItem onClick={() => onDuplicate(note)}>
                创建副本
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSaveAsTemplate(note)}>
                保存为模板
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleImport}>
                <FileUp size={14} className="mr-2" />
                导入 MD
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport}>
                <FileDown size={14} className="mr-2" />
                导出 MD
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <LayoutTemplate size={14} />
                  <span>切换模式</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-36">
                  <DropdownMenuItem onClick={onSwitchToDrawer}>
                    <PanelRight size={14} className="mr-1.5" />
                    <span>侧边抽屉</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenStandaloneWindow}>
                    <ExternalLink size={14} className="mr-1.5" />
                    <span>独立窗口</span>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <Popconfirm
                title={`确定要删除笔记 "${note.title || "未命名笔记"}" 吗？`}
                okText="删除"
                cancelText="取消"
                okType="danger"
                position="bottomRight"
                onOk={() => {
                  onDelete(note);
                  onBackToList();
                }}
              >
                <DropdownMenuItem destructive closeOnClick={false}>
                  删除
                </DropdownMenuItem>
              </Popconfirm>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Full-Width Content Container */}
      <main className="flex-1 overflow-y-auto flex flex-col items-center px-6 py-8">
        <div className="w-full max-w-4xl flex flex-col flex-1">
          {/* Note Title Input */}
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isPixelTheme ? "卷轴标题..." : "输入笔记标题..."}
            className={cn(
              "text-3xl font-extrabold border-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-auto mb-6",
              isPixelTheme && "font-mono font-bold text-amber-950 dark:text-amber-100"
            )}
          />

          {/* Tiptap Rich Text Editor */}
          <div className="flex-1 flex flex-col min-h-[500px]">
            <ReactjsTiptapEditor
              content={content}
              onChange={setContent}
              autofocus={autoFocusEditor ? "start" : undefined}
              placeholder={
                isPixelTheme
                  ? "📜 展开羊皮纸卷轴，开始书写魔法笔记..."
                  : "开始撰写笔记，或输入 / 使用命令..."
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}
