import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useListsActions } from '@/hooks/useListsQuery';
import { useAuth } from '@/lib/auth';
import { queryKeys } from '@/lib/syncEngine';
import { Note } from '@/types/lists';
import { MoreHorizontal, Pin, Cloud, CloudOff, AlertCircle, Minus, Square, Copy, X } from 'lucide-react';
import * as listsService from '@/services/listsService';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  DailyReviewEditor,
  convertMarkdownToTipTapJson,
  convertTipTapJsonToMarkdown,
} from '@/components/daily-review/DailyReviewEditor';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/ui/ConfirmDeleteDialog';
import { cn } from '@/lib/utils';

const logWarn = console.warn;
export function StandaloneNoteWindow() {
  const { userId } = useAuth();
  const [noteId, setNoteId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('noteId');
    if (id) {
      setNoteId(id);
    }
  }, []);

  const { data: noteDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: queryKeys.lists.noteWindow(userId, noteId ?? 'none'),
    queryFn: () => listsService.loadNote(noteId!),
    enabled: Boolean(noteId),
  });
  const editableNote = noteDetail;

  // 笔记被其他窗口删除（删除事件同步过来）：自动关闭本窗口，不停在"不存在"占位页
  const hadNoteRef = useRef(false);
  useEffect(() => {
    if (editableNote) {
      hadNoteRef.current = true;
      return;
    }
    if (hadNoteRef.current) {
      getCurrentWindow().close().catch(() => window.close());
    }
  }, [editableNote]);

  if (!noteId) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        未指定笔记 ID
      </div>
    );
  }

  if (!editableNote) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        {isLoadingDetail ? '正在加载笔记...' : '笔记不存在或已删除'}
      </div>
    );
  }

  return <StandaloneNoteEditorContent key={editableNote.id} note={editableNote} />;
}

function StandaloneNoteEditorContent({ note }: { note: Note }) {
  const { confirm: confirmDelete, dialogElement } = useConfirmDialog();
  const { updateNote, deleteNote, flushNote } = useListsActions();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content || '');
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'offline' | 'failed'>('saved');
  const [isClosing, setIsClosing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef(note);

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

  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  const latestDataRef = useRef({ title, content, noteId: note.id });
  useEffect(() => {
    latestDataRef.current = { title, content, noteId: note.id };
  }, [title, content, note.id]);

  // Save only when the editor is actually unmounted.  Depending on note
  // fields here makes React run this cleanup on every optimistic cache update,
  // which can write stale content back into the cache and cause a render loop.
  useEffect(() => {
    return () => {
      const currentId = latestDataRef.current.noteId;
      const currentTitle = latestDataRef.current.title;
      const currentContent = latestDataRef.current.content;
      const currentNote = noteRef.current;
      if (currentId && (currentTitle !== currentNote.title || currentContent !== currentNote.content)) {
        updateNote(currentId, { title: currentTitle, content: currentContent });
      }
    };
  }, [updateNote]);

  // Keep long-form edits local until the user pauses typing. Closing the
  // window below explicitly flushes the one pending save.
  useEffect(() => {
    if (title !== note.title || content !== note.content) {
      setSaveStatus('saving');
      const timer = setTimeout(() => {
        updateNote(note.id, { title, content });
        setSaveStatus('saved');
      }, 3000);
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
    if (isClosing) return;
    setIsClosing(true);
    try {
      const appWindow = getCurrentWindow();
      await appWindow.hide();
      if (title !== note.title || content !== note.content) updateNote(note.id, { title, content });
      setSaveStatus('saving');
      await flushNote(note.id);
      setSaveStatus('saved');
      await appWindow.close();
    } catch (error) {
      setSaveStatus(navigator.onLine ? 'failed' : 'offline');
      setIsClosing(false);
      try { await getCurrentWindow().show(); } catch { /* browser fallback */ }
      console.error('[note] final save failed; keeping editor open', error);
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

  const handleDelete = async (e?: React.MouseEvent) => {
    const confirmed = await confirmDelete({
      title: '删除笔记',
      description: `确定要删除笔记"${note.title || '未命名笔记'}"吗？`,
      confirmText: '删除',
    }, e);
    if (confirmed) {
      deleteNote(note.id);
      handleCloseWindow();
    }
  };

  return (
    <>
      {dialogElement}
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
            title={{ saving: '保存中…', saved: '已自动保存', offline: '离线：等待网络恢复', failed: '保存失败，请重试' }[saveStatus]}
            className="inline-flex items-center justify-center mr-1 p-1"
          >
            {saveStatus === 'offline' ? <CloudOff size={18} className="text-amber-500" /> : saveStatus === 'failed' ? <AlertCircle size={18} className="text-destructive" /> : <Cloud size={18} className={cn('transition-all duration-300', saveStatus === 'saved' ? 'text-primary fill-primary/20' : 'text-muted-foreground fill-none')} />}
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
                  onClick={(e) => { setMenuOpen(false); handleDelete(e); }}
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
        <DailyReviewEditor
          key={note.id}
          content={content}
          onChange={setContent}
        />
      </div>
    </div>
    </>
  );
}
