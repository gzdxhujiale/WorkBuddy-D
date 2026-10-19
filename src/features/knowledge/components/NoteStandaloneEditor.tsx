import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauriEnv } from "../utils/noteWindowManager";
import {
  Cloud,
  LoaderCircle,
  Minus,
  Square,
  X,
  History,
  MoreHorizontal,
  FileDown,
  FileUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ReactjsTiptapEditor,
  convertMarkdownToTipTapJson,
  convertTipTapJsonToMarkdown,
} from "@/components/ui/reactjs-tiptap-editor";
import { useAppThemeStyle } from "@/hooks/useAppThemeStyle";
import { useAuth } from "@/features/auth";
import * as knowledgeService from "../api/knowledgeService";
import { useNoteCollab } from "../hooks/useNoteCollab";
import { NoteVersionHistoryDrawer } from "./NoteVersionHistoryDrawer";
import { cn } from "@/lib/utils";

export function NoteStandaloneEditor() {
  const { isPixelTheme } = useAppThemeStyle();
  const { userId } = useAuth();
  const searchParams = new URLSearchParams(window.location.search);
  const noteId = searchParams.get("noteId");

  const { data: initialNote, isLoading } = useQuery({
    queryKey: ["note-standalone", userId, noteId],
    queryFn: () => knowledgeService.loadNote(noteId!),
    enabled: Boolean(noteId),
  });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const { status: collabStatus, collabExtensions, ydoc } = useNoteCollab({
    noteId: noteId || "",
    enabled: Boolean(noteId),
    user: {
      name: "独立窗口编辑者",
      color: "#f59e0b",
    },
  });

  const lockVersionRef = useRef<number>(1);
  const isDirtyRef = useRef(false);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const latestDataRef = useRef({ title: "", content: "" });
  const hasInitializedRef = useRef(false);
  const isDeletedRef = useRef(false);

  // Broadcast window open/close state and listen for remote deletion
  useEffect(() => {
    if (!noteId || !isTauriEnv()) return;

    void emit("knowledge:note-window-state", { id: noteId, isOpen: true });

    let unlistenDeleted: UnlistenFn | undefined;
    const setupDeleteListener = async () => {
      try {
        unlistenDeleted = await listen<{ id: string }>("knowledge:note-deleted", (event) => {
          if (event.payload?.id === noteId) {
            isDeletedRef.current = true;
            isDirtyRef.current = false;
            try {
              void getCurrentWindow().close();
            } catch {
              window.close();
            }
          }
        });
      } catch (err) {
        console.error("Failed to listen to note-deleted event:", err);
      }
    };
    void setupDeleteListener();

    return () => {
      void emit("knowledge:note-window-state", { id: noteId, isOpen: false });
      if (unlistenDeleted) {
        unlistenDeleted();
      }
    };
  }, [noteId]);

  useEffect(() => {
    if (initialNote && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setTitle(initialNote.title || "");
      setContent(initialNote.content || "");
      lockVersionRef.current = initialNote.lockVersion ?? 1;
      latestDataRef.current = {
        title: initialNote.title || "",
        content: initialNote.content || "",
      };
    }
  }, [initialNote]);

  const saveNote = async (overrideTitle?: string, overrideContent?: string) => {
    if (!noteId || isDeletedRef.current) return;
    const titleToSave = overrideTitle !== undefined ? overrideTitle : latestDataRef.current.title;
    const contentToSave = overrideContent !== undefined ? overrideContent : latestDataRef.current.content;

    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    isSavingRef.current = true;
    setSaveStatus("saving");

    try {
      const res = await knowledgeService.bufferPatchNote({
        id: noteId,
        title: titleToSave,
        content: contentToSave,
        lockVersion: lockVersionRef.current,
      });
      if (res?.lockVersion) {
        lockVersionRef.current = res.lockVersion;
      }
      if (latestDataRef.current.title === titleToSave && latestDataRef.current.content === contentToSave) {
        isDirtyRef.current = false;
        setSaveStatus("saved");
      }
      if (isTauriEnv() && !isDeletedRef.current) {
        void emit("knowledge:note-updated", {
          id: noteId,
          title: titleToSave,
          content: contentToSave,
          lockVersion: lockVersionRef.current,
          updatedAt: Date.now(),
        });
      }
    } catch {
      try {
        const res = await knowledgeService.patchNote({
          id: noteId,
          title: titleToSave,
          content: contentToSave,
          lockVersion: lockVersionRef.current,
        });
        if (res?.lockVersion) {
          lockVersionRef.current = res.lockVersion;
        }
        if (latestDataRef.current.title === titleToSave && latestDataRef.current.content === contentToSave) {
          isDirtyRef.current = false;
          setSaveStatus("saved");
        }
        if (isTauriEnv() && !isDeletedRef.current) {
          void emit("knowledge:note-updated", {
            id: noteId,
            title: titleToSave,
            content: contentToSave,
            lockVersion: lockVersionRef.current,
            updatedAt: Date.now(),
          });
        }
      } catch (err) {
        console.error("Save note failed:", err);
        setSaveStatus("saved");
      }
    } finally {
      isSavingRef.current = false;
      if (pendingSaveRef.current && !isDeletedRef.current) {
        pendingSaveRef.current = false;
        void saveNote();
      }
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    latestDataRef.current.title = newTitle;
    isDirtyRef.current = true;
    setSaveStatus("saving");
    if (noteId && isTauriEnv() && !isDeletedRef.current) {
      void emit("knowledge:note-updated", {
        id: noteId,
        title: newTitle,
        updatedAt: Date.now(),
      });
    }
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    latestDataRef.current.content = newContent;
    isDirtyRef.current = true;
    setSaveStatus("saving");
  };

  // Debounced auto-save
  useEffect(() => {
    if (!hasInitializedRef.current || !noteId) return;
    if (isDirtyRef.current && !isDeletedRef.current) {
      const timer = setTimeout(() => {
        void saveNote();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [title, content, noteId]);

  // Flush on native window close event & unload
  useEffect(() => {
    let unlistenClose: (() => void) | undefined;
    const setupCloseHandler = async () => {
      try {
        unlistenClose = await getCurrentWindow().onCloseRequested(async () => {
          if (noteId && isDirtyRef.current && !isDeletedRef.current) {
            await saveNote(latestDataRef.current.title, latestDataRef.current.content);
          }
          if (noteId && isTauriEnv()) {
            void emit("knowledge:note-window-state", { id: noteId, isOpen: false });
          }
        });
      } catch {
        // Not running in Tauri window environment
      }
    };
    void setupCloseHandler();

    const handleUnload = () => {
      if (noteId && isDirtyRef.current && !isDeletedRef.current) {
        void knowledgeService.bufferPatchNote(
          {
            id: noteId,
            title: latestDataRef.current.title,
            content: latestDataRef.current.content,
            lockVersion: lockVersionRef.current,
          },
          { keepalive: true }
        );
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      if (unlistenClose) unlistenClose();
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [noteId]);

  const handleMinimize = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch {
      // Ignore
    }
  };

  const handleToggleMaximize = async () => {
    try {
      await getCurrentWindow().toggleMaximize();
    } catch {
      // Ignore
    }
  };

  const handleClose = async () => {
    if (noteId && isDirtyRef.current && !isDeletedRef.current) {
      await saveNote(latestDataRef.current.title, latestDataRef.current.content);
    }
    if (noteId && isTauriEnv()) {
      void emit("knowledge:note-window-state", { id: noteId, isOpen: false });
    }
    try {
      await getCurrentWindow().close();
    } catch {
      window.close();
    }
  };

  const handleImport = async () => {
    const imported = await knowledgeService.pickMarkdownFile();
    if (imported) {
      const jsonStr = convertMarkdownToTipTapJson(imported.content);
      setContent(jsonStr);
      latestDataRef.current.content = jsonStr;
      if (imported.title) {
        setTitle(imported.title);
        latestDataRef.current.title = imported.title;
      }
      isDirtyRef.current = true;
      setSaveStatus("saving");
      void saveNote(imported.title || latestDataRef.current.title, jsonStr);
      if (noteId && isTauriEnv() && !isDeletedRef.current) {
        void emit("knowledge:note-updated", {
          id: noteId,
          title: imported.title || latestDataRef.current.title,
          content: jsonStr,
          updatedAt: Date.now(),
        });
      }
    }
  };

  const handleExport = async () => {
    const exportText = convertTipTapJsonToMarkdown(content);
    await knowledgeService.saveMarkdownFile(
      `${title || (isPixelTheme ? "未命名卷轴" : "未命名笔记")}.md`,
      exportText
    );
  };

  if (!noteId) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        未指定笔记 ID
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle size={18} className="animate-spin" />
        加载笔记内容中...
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground overflow-hidden select-text">
      {/* Custom Window Titlebar & Header */}
      <header
        data-tauri-drag-region
        className={cn(
          "flex h-11 items-center justify-between border-b px-3 shrink-0 bg-card select-none",
          isPixelTheme ? "border-b-2 border-border font-mono" : "border-border"
        )}
      >
        <div className="flex items-center gap-2 flex-1 mr-4 overflow-hidden" data-tauri-drag-region>
          <Input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder={isPixelTheme ? "卷轴标题..." : "笔记标题"}
            className={cn(
              "text-sm font-semibold border-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1 h-7 max-w-sm",
              isPixelTheme && "font-mono text-amber-950 dark:text-amber-100"
            )}
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Collaboration Status Badge */}
          <span
            title={
              collabStatus === "connected"
                ? "多窗口实时协同连接成功"
                : collabStatus === "connecting"
                ? "正在连接多窗口协同服务..."
                : "单机离线模式"
            }
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 text-xs transition-all mr-1",
              isPixelTheme
                ? "border border-amber-900/40 rounded-xs font-mono font-bold"
                : "rounded-md border",
              collabStatus === "connected"
                ? isPixelTheme
                  ? "bg-emerald-100 text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-100"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                : collabStatus === "connecting"
                ? isPixelTheme
                  ? "bg-amber-100 text-amber-950 dark:bg-amber-900/60 dark:text-amber-100"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                : "bg-muted text-muted-foreground border-border"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                collabStatus === "connected"
                  ? "bg-emerald-500 animate-pulse"
                  : collabStatus === "connecting"
                  ? "bg-amber-500 animate-ping"
                  : "bg-muted-foreground/50"
              )}
            />
            <span>
              {collabStatus === "connected"
                ? "协同中"
                : collabStatus === "connecting"
                ? "连接中"
                : "单机"}
            </span>
          </span>

          <span
            title={saveStatus === "saving" ? "保存中..." : "已自动保存"}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 text-xs rounded-md mr-1",
              saveStatus === "saving"
                ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                : "bg-primary/10 text-primary"
            )}
          >
            <Cloud
              size={14}
              className={cn(
                "transition-opacity",
                saveStatus === "saving" ? "opacity-50 animate-pulse" : "opacity-100"
              )}
            />
            <span>{saveStatus === "saving" ? "保存中" : "已保存"}</span>
          </span>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsHistoryOpen(true)}
            title="版本历史与可视化对比"
            className="h-7 w-7 rounded-md"
          >
            <History size={14} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md">
                <MoreHorizontal size={15} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsHistoryOpen(true)}>
                <History size={14} className="mr-2" />
                版本历史对比
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleImport}>
                <FileUp size={14} className="mr-2" />
                导入 MD
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport}>
                <FileDown size={14} className="mr-2" />
                导出 MD
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Window Control Buttons */}
          <div className="flex items-center ml-2 border-l pl-1 border-border/60">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-sm hover:bg-muted"
              onClick={handleMinimize}
              title="最小化"
            >
              <Minus size={13} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-sm hover:bg-muted"
              onClick={handleToggleMaximize}
              title="最大化 / 还原"
            >
              <Square size={11} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-sm hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleClose}
              title="关闭窗口"
            >
              <X size={14} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Editor Body */}
      <main className="flex-1 flex flex-col p-0 overflow-hidden relative">
        <ReactjsTiptapEditor
          preset="full"
          content={content}
          onChange={handleContentChange}
          collabExtensions={collabExtensions}
          autofocus="start"
          placeholder={isPixelTheme ? "📜 开始书写笔记..." : "开始撰写笔记，或输入 / 使用命令..."}
        />
      </main>

      {/* Version History & Diff Comparison Drawer */}
      <NoteVersionHistoryDrawer
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        noteId={noteId}
        noteTitle={title}
        ydoc={ydoc}
        currentContent={content}
        onRestoreContent={(restored) => {
          setContent(restored);
          latestDataRef.current.content = restored;
          isDirtyRef.current = true;
          setSaveStatus("saving");
          void saveNote(latestDataRef.current.title, restored);
        }}
      />
    </div>
  );
}
