import { useState, useEffect, useRef } from 'react';
import { useListsData, useListsActions } from '@/hooks/useListsQuery';
import { Note } from '@/types/lists';
import { MoreHorizontal, Pin, Cloud, Minus, Square, Copy, X } from 'lucide-react';
import * as listsService from '@/services/listsService';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ReactjsTiptapEditor, convertMarkdownToTipTapJson, convertTipTapJsonToMarkdown } from '../tiptap';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const logWarn = console.warn;
const EMPTY_NOTES: Note[] = [];

export function StandaloneNoteWindow() {
  const { data } = useListsData();
  const notes = data?.notes ?? EMPTY_NOTES;
  const [noteId, setNoteId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('noteId');
    if (id) {
      setNoteId(id);
    }
  }, []);

  const note = notes.find(n => n.id === noteId) || null;

  // 笔记被其他窗口删除（删除事件同步过来）：自动关闭本窗口，不停在"不存在"占位页
  const hadNoteRef = useRef(false);
  useEffect(() => {
    if (note) {
      hadNoteRef.current = true;
      return;
    }
    if (hadNoteRef.current) {
      getCurrentWindow().close().catch(() => window.close());
    }
  }, [note]);

  if (!noteId) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        未指定笔记 ID
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        正在加载笔记或笔记不存在...
      </div>
    );
  }

  return <StandaloneNoteEditorContent key={note.id} note={note} />;
}

function StandaloneNoteEditorContent({ note }: { note: Note }) {
  const { updateNote, deleteNote } = useListsActions();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content || '');
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [isMaximized, setIsMaximized] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  // Focus and select title input when switching to edit mode
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Synchronize window state (isMaximized)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const initWindowState = async () => {
      try {
        const appWin = getCurrentWindow();
        setIsMaximized(await appWin.isMaximized());
        unlisten = await appWin.onResized(async () => {
          setIsMaximized(await appWin.isMaximized());
        });
      } catch (e) {
        logWarn('standaloneNote', 'Tauri window API listener warning', e);
      }
    };
    initWindowState();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Synchronize when note prop is updated externally
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content || '');
    document.title = note.title ? `${note.title} - 笔记` : '笔记编辑';
    latestDataRef.current = { title: note.title, content: note.content || '', noteId: note.id };
  }, [note.id, note.title, note.content]);

  const latestDataRef = useRef({ title, content, noteId: note.id });
  useEffect(() => {
    latestDataRef.current = { title, content, noteId: note.id };
  }, [title, content, note.id]);

  // Save changes on unmount or window close
  useEffect(() => {
    return () => {
      const currentId = latestDataRef.current.noteId;
      const currentTitle = latestDataRef.current.title;
      const currentContent = latestDataRef.current.content;
      if (currentId && (currentTitle !== note.title || currentContent !== note.content)) {
        updateNote(currentId, { title: currentTitle, content: currentContent });
      }
    };
  }, [updateNote, note.title, note.content]);

  // Debounced auto-save effect
  useEffect(() => {
    if (title !== note.title || content !== note.content) {
      setSaveStatus('saving');
      const timer = setTimeout(() => {
        updateNote(note.id, { title, content });
        setSaveStatus('saved');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [title, content, note.id, note.title, note.content, updateNote]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMinimizeWindow = async () => {
    try {
      await getCurrentWindow().minimize();
    } catch (err) {
      logWarn('standaloneNote', 'failed to minimize window', err);
    }
  };

  const handleToggleMaximizeWindow = async () => {
    try {
      const appWin = getCurrentWindow();
      await appWin.toggleMaximize();
      setIsMaximized(await appWin.isMaximized());
    } catch (err) {
      logWarn('standaloneNote', 'failed to toggle maximize', err);
    }
  };

  const handleCloseWindow = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.close();
    } catch {
      window.close();
    }
  };

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.closest('button') || target.closest('.lists-dropdown-menu')) {
      return;
    }
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
  };

  const handleHeaderMouseMove = (e: React.MouseEvent) => {
    if (!dragStartPosRef.current || isDraggingRef.current) return;
    const dx = e.clientX - dragStartPosRef.current.x;
    const dy = e.clientY - dragStartPosRef.current.y;
    if (Math.hypot(dx, dy) > 4) {
      isDraggingRef.current = true;
      try {
        getCurrentWindow().startDragging();
      } catch (err) {
        logWarn('standaloneNote', 'startDragging error', err);
      }
    }
  };

  const handleHeaderMouseUp = () => {
    dragStartPosRef.current = null;
    isDraggingRef.current = false;
  };

  const handleHeaderDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.closest('button') || target.closest('.lists-dropdown-menu')) {
      return;
    }
    setIsEditingTitle(true);
  };

  const handlePin = () => {
    updateNote(note.id, { isPinned: !note.isPinned });
  };

  const handleImport = async () => {
    const mdContent = await listsService.pickMarkdownFile();
    if (mdContent) {
      const jsonStr = convertMarkdownToTipTapJson(mdContent);
      setContent(jsonStr);
    }
  };

  const handleExport = async () => {
    try {
      const exportText = convertTipTapJsonToMarkdown(content);
      await listsService.saveMarkdownFile(`${title || '未命名笔记'}.md`, exportText);
    } catch (err) {
      // Cancellation surfaces as an error from the backend; already logged by `call`.
    }
  };

  const handleDelete = () => {
    if (window.confirm(`确定要删除笔记"${note.title || '未命名笔记'}"吗？`)) {
      deleteNote(note.id);
      handleCloseWindow();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Top Header Bar */}
      <div
        className="flex items-center justify-between px-4 py-2 pl-4 border-b border-border bg-background select-none h-12"
        onMouseDown={handleHeaderMouseDown}
        onMouseMove={handleHeaderMouseMove}
        onMouseUp={handleHeaderMouseUp}
        onDoubleClick={handleHeaderDoubleClick}
      >
        <div className="flex items-center flex-1 mr-4 min-w-0">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  setIsEditingTitle(false);
                }
              }}
              placeholder="笔记标题"
              className="flex-1 text-lg font-semibold border-none outline-none bg-transparent text-foreground placeholder:text-muted-foreground"
            />
          ) : (
            <div
              title="双击修改标题，按住拖拽窗口"
              className="flex-1 text-lg font-semibold text-foreground cursor-default truncate select-none py-1"
            >
              {title || <span className="text-muted-foreground font-normal">未命名笔记 (双击修改)</span>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span
            title={saveStatus === 'saving' ? '保存中...' : '已自动保存'}
            className="inline-flex items-center justify-center mr-1 p-1"
          >
            <Cloud
              size={18}
              className={cn(
                'transition-all duration-300',
                saveStatus === 'saved' ? 'text-primary fill-primary/20' : 'text-muted-foreground fill-none'
              )}
            />
          </span>

          <Button
            variant="ghost"
            size="icon"
            onClick={handlePin}
            title={note.isPinned ? '取消置顶' : '置顶'}
            className={cn(
              'rounded',
              note.isPinned && 'text-primary bg-primary/10'
            )}
          >
            <Pin size={16} />
          </Button>

          <div className="relative" ref={menuRef}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMenuOpen(!menuOpen)}
              title="更多操作"
              className="rounded"
            >
              <MoreHorizontal size={18} />
            </Button>

            {menuOpen && (
              <div className="absolute top-full right-0 mt-1 z-50 min-w-30 p-1 bg-popover border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.1)] flex flex-col animate-in fade-in zoom-in-95">
                <button
                  className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => { setMenuOpen(false); handlePin(); }}
                >
                  {note.isPinned ? '取消置顶' : '置顶笔记'}
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => { setMenuOpen(false); handleImport(); }}
                >
                  导入 MD
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => { setMenuOpen(false); handleExport(); }}
                >
                  导出 MD
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm rounded-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  onClick={() => { setMenuOpen(false); handleDelete(); }}
                >
                  删除笔记
                </button>
              </div>
            )}
          </div>

          {/* Window Control Buttons */}
          <div className="flex items-center h-full ml-2 gap-0.5">
            <button
              type="button"
              onClick={handleMinimizeWindow}
              title="最小化"
              aria-label="最小化"
              className="inline-flex items-center justify-center size-8 rounded bg-transparent border-none text-muted-foreground cursor-pointer transition-[background-color,color] duration-150 hover:bg-black/5 hover:text-foreground"
            >
              <Minus size={15} />
            </button>
            <button
              type="button"
              onClick={handleToggleMaximizeWindow}
              title={isMaximized ? "向下还原" : "最大化"}
              aria-label={isMaximized ? "向下还原" : "最大化"}
              className="inline-flex items-center justify-center size-8 rounded bg-transparent border-none text-muted-foreground cursor-pointer transition-[background-color,color] duration-150 hover:bg-black/5 hover:text-foreground"
            >
              {isMaximized ? <Copy size={13} /> : <Square size={13} />}
            </button>
            <button
              type="button"
              onClick={handleCloseWindow}
              title="关闭"
              aria-label="关闭"
              className="inline-flex items-center justify-center size-8 rounded bg-transparent border-none text-muted-foreground cursor-pointer transition-[background-color,color] duration-150 hover:bg-[#e81123] hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex flex-col flex-1 overflow-hidden relative">
        <ReactjsTiptapEditor
          key={note.id}
          content={content}
          onChange={setContent}
          initialContent={content}
          enableCustomTemplates={true}
          className="note-drawer-reactjs-tiptap"
        />
      </div>
    </div>
  );
}
