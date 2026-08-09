import React, { useState, useEffect, useMemo, useRef, cloneElement, ReactElement, ReactNode, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownUp, MoreHorizontal, Plus, PanelLeftClose, PanelLeftOpen, CheckCircle, AlertCircle,
  ChevronRight, Check, Sidebar, ExternalLink, Folder as FolderIcon, BookOpen, Briefcase, Home,
  Package, Activity, Star, ChevronDown, FileText, Search, Cloud, X, LayoutList, Columns, Trash2, Library
} from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverEvent, useDroppable } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useListsData, useListsActions } from '@/hooks/useListsQuery';
import { sortLists, sortFolders } from '@/utils/listsSelectors';
import { List, Folder, ViewType, Note, NoteGroup, Template } from '@/types/lists';
import { getNoteOpenMode, setNoteOpenMode, openNoteInNewWindow, NoteOpenMode } from '@/services/noteOpenService';
import { TemplateModal, useTemplateData, useTemplateActions } from '../templates';
import * as listsService from '@/services/listsService';
import { logError, logSilent } from '@/lib/syncEngine';
import { computeNoteReorder, computeListReorder } from '@/utils/listsReorder';
import { ReactjsTiptapEditor, convertMarkdownToTipTapJson, convertTipTapJsonToMarkdown } from '../tiptap';
import { useConfirmDialog } from '@/components/ui/ConfirmDeleteDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ============================================================================
// 0. Shared Helpers & Custom Hooks
// ============================================================================
function useClickOutside<T extends HTMLElement>(handler: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler();
      }
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [handler]);
  return ref;
}

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  headerRight?: ReactNode;
}

/** Unified Modal Shell rendered via Portal with Dialog + semantic tokens */
const ModalShell: React.FC<ModalShellProps> = memo(({ title, onClose, children, footer, width = '520px', headerRight }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-black/20 flex items-center justify-center p-4 transition-all duration-200 animate-in fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-card text-card-foreground border border-border rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] w-full flex flex-col overflow-visible"
        style={{ maxWidth: width, width: '92vw' }}
      >
        <div className="relative flex items-center justify-center px-6 py-5">
          <DialogTitle className="text-lg font-semibold m-0">{title}</DialogTitle>
          {headerRight || (
            <Button variant="ghost" size="icon" className="absolute right-4 rounded-lg" onClick={onClose}>
              <X className="size-[18px]" />
            </Button>
          )}
        </div>
        <div className="px-6 pb-6 pt-0 flex flex-col gap-5 overflow-visible max-h-[75vh]">{children}</div>
        {footer && (
          <DialogFooter className="px-6 pb-6 pt-0">
            {footer}
          </DialogFooter>
        )}
      </div>
    </div>,
    document.body
  );
});

// ============================================================================
// 1. SortableItem & Droppable Helper Components
// ============================================================================
interface SortableItemProps {
  id: string;
  children: ReactNode;
  disabled?: boolean;
}

function SortableItem({ id, children, disabled }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

interface DroppableAreaProps {
  id: string;
  data?: Record<string, any>;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
}

function DroppableArea({ id, data, children, className, style, onClick }: DroppableAreaProps) {
  const { setNodeRef, isOver } = useDroppable({ id, data });
  const dynamicClassName = `${className || ''} ${isOver ? 'ring-2 ring-ring bg-accent/70 rounded-lg' : ''}`.trim();
  return <div ref={setNodeRef} className={dynamicClassName} style={style} onClick={onClick}>{children}</div>;
}

interface SidebarListItemDroppableProps {
  list: List;
  activeListId: string | null;
  dragOverListId?: string | null;
  onSelectList: (id: string) => void;
  isNested: boolean;
  children: ReactNode;
}

const SidebarListItemDroppable: React.FC<SidebarListItemDroppableProps> = memo(({ list, activeListId, dragOverListId, onSelectList, isNested, children }) => {
  const { moveNoteToList } = useListsActions();
  const [isHovered, setIsHovered] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: `sidebar-list-${list.id}`,
    data: { type: 'sidebar-list', listId: list.id }
  });
  const isTarget = isOver || isHovered || dragOverListId === list.id;
  const isActive = activeListId === list.id;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all duration-150',
        isNested ? 'pl-10' : 'pl-6',
        isActive
          ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        isTarget && 'bg-sidebar-primary/10 ring-2 ring-sidebar-ring'
      )}
      onClick={() => onSelectList(list.id)}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        if (!isHovered) setIsHovered(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsHovered(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsHovered(false);
        try {
          const raw = e.dataTransfer.getData('text/plain');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.type === 'note' && parsed.noteId) {
              moveNoteToList(parsed.noteId, list.id);
            }
          }
        } catch (err) {
          logSilent('listsPanel', 'invalid note drag payload', err);
        }
      }}
    >
      {children}
    </div>
  );
});

// ============================================================================
// 2. ListsSidebar Component
// ============================================================================
interface ListsSidebarProps {
  lists: List[];
  folders: Folder[];
  activeListId: string | null;
  dragOverListId?: string | null;
  dragOverFolderId?: string | null;
  onSelectList: (id: string) => void;
  onAddClick: (folderId?: string) => void;
  onEditFolder: (folder: Folder) => void;
  onPinFolder: (folder: Folder) => void;
  onDissolveFolder: (folder: Folder) => void;
  onEditList: (list: List) => void;
  onPinList: (list: List) => void;
  onDuplicateList: (list: List) => void;
  onDeleteList: (list: List) => void;
  isCollapsed?: boolean;
}

const ICON_MAP: Record<string, ReactNode> = {
  BookOpen: <FolderIcon size={16} />,
  Briefcase: <Briefcase size={16} />,
  Home: <Home size={16} />,
  Package: <Package size={16} />,
  Activity: <Activity size={16} />,
  Star: <Star size={16} />
};

function ListsSidebar({
  lists,
  folders,
  activeListId,
  dragOverListId,
  dragOverFolderId,
  onSelectList,
  onAddClick,
  onEditFolder,
  onPinFolder,
  onDissolveFolder,
  onEditList,
  onPinList,
  onDuplicateList,
  onDeleteList,
  isCollapsed
}: ListsSidebarProps) {
  const { confirm: confirmDelete, dialogElement } = useConfirmDialog();
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [activeDropdown, setActiveDropdown] = useState<{ type: 'folder' | 'list', id: string } | null>(null);

  const closeDropdown = useCallback(() => setActiveDropdown(null), []);
  const dropdownRef = useClickOutside<HTMLDivElement>(closeDropdown);

  const toggleFolder = (folderId: string) => {
    setCollapsedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  const getIcon = (iconName: string, color: string) => {
    const icon = ICON_MAP[iconName] || <BookOpen size={16} />;
    return cloneElement(icon as ReactElement<any>, { color: color !== 'none' ? color : 'currentColor' });
  };

  const standaloneLists = useMemo(() => lists.filter(l => !l.folderId), [lists]);
  const listsByFolder = useMemo(() => {
    const acc: Record<string, List[]> = {};
    folders.forEach(f => {
      acc[f.id] = lists.filter(l => l.folderId === f.id);
    });
    return acc;
  }, [folders, lists]);

  const renderSidebarItem = (list: List, isNested: boolean) => (
    <SortableItem key={list.id} id={list.id}>
      <SidebarListItemDroppable
        list={list}
        activeListId={activeListId}
        dragOverListId={dragOverListId}
        onSelectList={onSelectList}
        isNested={isNested}
      >
        <div className="shrink-0 text-sidebar-foreground/60 transition-colors group-hover:text-sidebar-primary">
          {getIcon(list.icon, list.color)}
        </div>
        <span className="truncate flex-1">{list.name}</span>
        {list.isPinned && <span className="text-[10px] text-amber-500">📌</span>}

        <div className="ml-auto flex items-center gap-1">
          {list.itemCount !== undefined && list.itemCount > 0 && (
            <span className="text-xs font-normal text-sidebar-foreground/60 group-hover:hidden">
              {list.itemCount}
            </span>
          )}
          <div className="relative ml-auto" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdown(activeDropdown?.id === list.id ? null : { type: 'list', id: list.id });
                        }}
                      >
                        <MoreHorizontal size={15} />
                      </Button>

                      {activeDropdown?.type === 'list' && activeDropdown.id === list.id && (
                        <div
                          className="absolute top-full right-0 mt-1 z-50 min-w-30 p-1 bg-popover border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.1)] flex flex-col animate-in fade-in zoom-in-95"
                          ref={dropdownRef}
                        >
                          <button
                            className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                            onClick={() => { setActiveDropdown(null); onEditList(list); }}
                          >
                            编辑
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                            onClick={() => { setActiveDropdown(null); onPinList(list); }}
                          >
                            {list.isPinned ? '取消置顶' : '置顶'}
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                            onClick={() => { setActiveDropdown(null); onDuplicateList(list); }}
                          >
                            复制
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-sm rounded-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            onClick={async (e) => {
                              e.stopPropagation();
                              setActiveDropdown(null);
                              const confirmed = await confirmDelete({
                                title: '删除文件夹',
                                description: `确定要删除文件夹 "${list.name}" 吗？其中的笔记也会被删除。`,
                                confirmText: '删除',
                              });
                              if (confirmed) {
                                onDeleteList(list);
                              }
                            }}
                          >
                            删除
                          </button>
                        </div>
                      )}
                    </div>
        </div>
      </SidebarListItemDroppable>
    </SortableItem>
  );

  const isTargetStandalone = dragOverFolderId === 'standalone-area';

  return (
    <>
      {dialogElement}
      <aside
        className={cn(
        'flex w-[206px] flex-none flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-[250ms] ease-in-out',
        isCollapsed && 'pointer-events-none !w-0 border-r-transparent opacity-0'
        )}
      >
      <div className="group/header flex h-12 shrink-0 items-center justify-between border-b border-sidebar-border px-4 text-sm font-semibold select-none">
        <span>知识库</span>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-md text-sidebar-foreground opacity-0 transition-opacity hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-hover/header:opacity-100"
          onClick={() => onAddClick()}
          title="新建文件夹"
        >
          <Plus size={16} />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
        <SortableContext items={folders.map(f => f.id)} strategy={verticalListSortingStrategy}>
          {folders.map(folder => {
            const isCollapsedFolder = collapsedFolders[folder.id];
            const folderLists = listsByFolder[folder.id] || [];
            const isTarget = dragOverFolderId === folder.id;

            return (
              <div key={folder.id} className="flex flex-col gap-0.5">
                <SortableItem id={folder.id}>
                  <DroppableArea
                    id={folder.id}
                    data={{ type: 'folder' }}
                    className={cn(
                      'group relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 pl-6 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      isTarget && 'bg-sidebar-primary/10 ring-2 ring-sidebar-ring'
                    )}
                    onClick={() => toggleFolder(folder.id)}
                  >
                    <ChevronDown
                      size={14}
                      className={cn('text-sidebar-foreground/60 transition-transform duration-200', isCollapsedFolder && '-rotate-90')}
                    />
                    <Library size={16} className="shrink-0 text-sidebar-foreground/70" />
                    <span className="flex-1 truncate">{folder.name}</span>
                    {folder.isPinned && <span className="text-[10px] text-amber-500">📌</span>}

                    <div className="relative ml-auto" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-md text-sidebar-foreground opacity-0 transition-opacity hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdown(activeDropdown?.id === folder.id ? null : { type: 'folder', id: folder.id });
                        }}
                      >
                        <MoreHorizontal size={15} />
                      </Button>

                      {activeDropdown?.type === 'folder' && activeDropdown.id === folder.id && (
                        <div
                          className="absolute top-full right-0 mt-1 z-50 min-w-30 p-1 bg-popover border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.1)] flex flex-col animate-in fade-in zoom-in-95"
                          ref={dropdownRef}
                        >
                          <button
                            className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                            onClick={() => { setActiveDropdown(null); onAddClick(folder.id); }}
                          >
                            添加文件夹
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                            onClick={() => { setActiveDropdown(null); onEditFolder(folder); }}
                          >
                            编辑
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                            onClick={() => { setActiveDropdown(null); onPinFolder(folder); }}
                          >
                            {folder.isPinned ? '取消置顶' : '置顶'}
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-sm rounded-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            onClick={async (e) => {
                              e.stopPropagation();
                              setActiveDropdown(null);
                              const confirmed = await confirmDelete({
                                title: '删除知识库',
                                description: `确定要删除知识库 "${folder.name}" 吗？其中的文件夹和笔记也会被删除。`,
                                confirmText: '解散',
                              });
                              if (confirmed) {
                                onDissolveFolder(folder);
                              }
                            }}
                          >
                            解散
                          </button>
                        </div>
                      )}
                    </div>
                  </DroppableArea>
                </SortableItem>

                {!isCollapsedFolder && (
                  <SortableContext items={folderLists.map(l => l.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-0.5">
                      {folderLists.map(list => renderSidebarItem(list, true))}
                    </div>
                  </SortableContext>
                )}
              </div>
            );
          })}
        </SortableContext>

        {folders.length > 0 && standaloneLists.length > 0 && <div className="h-2" />}

        <DroppableArea
          id="standalone-area"
          data={{ type: 'folder' }}
          className={cn('min-h-[50px] flex-1 rounded-md pb-5', isTargetStandalone && 'bg-sidebar-primary/10 ring-2 ring-sidebar-ring')}
        >
          <SortableContext items={standaloneLists.map(l => l.id)} strategy={verticalListSortingStrategy}>
            {standaloneLists.map(list => renderSidebarItem(list, false))}
          </SortableContext>
        </DroppableArea>
      </div>
      </aside>
    </>
  );
}

// ============================================================================
// 3. NoteItem & NoteGroupView Components
// ============================================================================
interface NoteItemProps {
  note: Note;
  allLists: List[];
  onClick: () => void;
  onPin: (note: Note) => void;
  onDuplicate: (note: Note) => void;
  onDelete: (note: Note) => void;
  onMove: (note: Note, targetListId: string) => void;
}

function NoteItem({ note, allLists, onClick, onPin, onDuplicate, onDelete, onMove }: NoteItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMoveTo, setShowMoveTo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setShowMoveTo(false);
    setSearchQuery('');
  }, []);
  const menuRef = useClickOutside<HTMLDivElement>(closeMenu);

  const otherLists = allLists.filter(l => l.id !== note.listId && l.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div
      className="group relative flex items-center gap-3 bg-card border border-border hover:border-muted-foreground/30 rounded-lg px-4 py-3 cursor-pointer hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all duration-200 mb-3 text-card-foreground"
      onClick={onClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'note', noteId: note.id }));
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <FileText size={16} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      <div className="flex-1 text-sm font-medium text-foreground truncate">
        {note.title || '无标题笔记'}
      </div>
      {note.isPinned && (
        <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-900/50 shrink-0">
          📌 置顶
        </span>
      )}

      <div className="relative shrink-0" onClick={e => e.stopPropagation()} ref={menuRef}>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'rounded-lg',
            menuOpen && 'bg-accent text-accent-foreground'
          )}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
            setShowMoveTo(false);
            setSearchQuery('');
          }}
        >
          <MoreHorizontal size={16} />
        </Button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1.5 z-50 min-w-44 p-1 bg-popover border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.1)] flex flex-col animate-in fade-in zoom-in-95">
            {showMoveTo ? (
              <div className="flex flex-col p-1">
                <div className="flex items-center gap-1.5 px-2 py-2 border-b border-border text-sm text-foreground">
                  <button
                    className="p-0.5 hover:bg-muted rounded-sm transition-colors cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setShowMoveTo(false); }}
                  >
                    <ChevronRight size={14} className="rotate-180" />
                  </button>
                  <span>移动到...</span>
                </div>
                <div className="p-1">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted rounded-md text-sm">
                    <Search size={13} className="text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      placeholder="搜索文件夹..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
                    />
                  </div>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {otherLists.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">无匹配文件夹</div>
                  ) : (
                    otherLists.map(list => (
                      <button
                        key={list.id}
                        className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors truncate cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          setShowMoveTo(false);
                          onMove(note, list.id);
                        }}
                      >
                        {list.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <>
                <button
                  className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onPin(note); }}
                >
                  {note.isPinned ? '取消置顶' : '置顶'}
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors flex items-center justify-between cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setShowMoveTo(true); }}
                >
                  <span>移动到</span>
                  <ChevronRight size={14} />
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDuplicate(note); }}
                >
                  创建副本
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm rounded-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDelete(note);
                  }}
                >
                  删除
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface NoteGroupViewProps {
  group: { id: string; listId: string; name: string };
  notes: Note[];
  allLists: List[];
  isUngrouped?: boolean;
  isDragOverTarget?: boolean;
  onRenameGroup: (id: string, newName: string) => void;
  onDeleteGroup: (id: string) => void;
  onNoteClick: (note: Note) => void;
  onPinNote: (note: Note) => void;
  onDuplicateNote: (note: Note) => void;
  onDeleteNote: (note: Note) => void;
  onMoveNote: (note: Note, targetListId: string) => void;
}

function NoteGroupView({ group, notes, allLists, isUngrouped, isDragOverTarget, onRenameGroup, onDeleteGroup, onNoteClick, onPinNote, onDuplicateNote, onDeleteNote, onMoveNote }: NoteGroupViewProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuRef = useClickOutside<HTMLDivElement>(closeMenu);
  const inputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef } = useDroppable({
    id: group.id,
    data: { type: 'group' }
  });

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSaveRename = () => {
    if (editName.trim()) {
      onRenameGroup(group.id, editName.trim());
    } else {
      setEditName(group.name);
    }
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={`mb-6 rounded-lg border border-border/60 bg-muted/30 p-3 transition-all ${
        isDragOverTarget ? 'ring-2 ring-ring bg-accent/30' : ''
      }`}
    >
      <div
        className="group/gh flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-muted transition-colors select-none"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <ChevronDown
          size={14}
          className={`text-muted-foreground transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
        />

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={handleSaveRename}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSaveRename();
              if (e.key === 'Escape') {
                setEditName(group.name);
                setIsEditing(false);
              }
            }}
            onClick={e => e.stopPropagation()}
            className="text-sm font-semibold border border-primary bg-card outline-none rounded-md px-2 py-0.5 text-foreground"
          />
        ) : (
          <span className="text-sm font-semibold text-foreground">{group.name}</span>
        )}

        <div className="ml-auto flex items-center gap-2 relative" onClick={e => e.stopPropagation()} ref={menuRef}>
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {notes.length}
          </span>
          {!isUngrouped && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'rounded-md',
                  menuOpen && 'bg-accent text-accent-foreground'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
              >
                <MoreHorizontal size={15} />
              </Button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-32 p-1 bg-popover border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.1)] flex flex-col animate-in fade-in zoom-in-95">
                  <button
                    className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setIsEditing(true); setMenuOpen(false); }}
                  >
                    重命名
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm rounded-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDeleteGroup(group.id);
                    }}
                  >
                    <Trash2 size={13} />
                    <span>删除</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="pt-2 min-h-[12px]">
          {notes.length === 0 ? (
            <div className="px-6 py-2 text-xs text-muted-foreground">暂无笔记</div>
          ) : (
            <SortableContext items={notes.map(n => n.id)} strategy={verticalListSortingStrategy}>
              {notes.map(note => (
                <SortableItem key={note.id} id={note.id}>
                  <NoteItem
                    note={note}
                    allLists={allLists}
                    onClick={() => onNoteClick(note)}
                    onPin={onPinNote}
                    onDuplicate={onDuplicateNote}
                    onDelete={onDeleteNote}
                    onMove={onMoveNote}
                  />
                </SortableItem>
              ))}
            </SortableContext>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 4. NoteDrawer & NoteDrawerContent Components
// ============================================================================
interface NoteDrawerProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, title: string, content: string) => void;
  onPin: (note: Note) => void;
  onDuplicate: (note: Note) => void;
  onSaveAsTemplate: (note: Note) => void;
  onDelete: (note: Note) => void;
  onOpenTemplate?: () => void;
  showToast?: (message: string, type?: 'success' | 'error') => void;
}

function NoteDrawerContent({
  note,
  isOpen,
  onClose,
  onUpdate,
  onPin,
  onDuplicate,
  onSaveAsTemplate,
  onDelete,
  showToast,
}: {
  note: Note;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, title: string, content: string) => void;
  onPin: (note: Note) => void;
  onDuplicate: (note: Note) => void;
  onSaveAsTemplate: (note: Note) => void;
  onDelete: (note: Note) => void;
  showToast?: (message: string, type?: 'success' | 'error') => void;
}) {
  const { confirm: confirmDelete, dialogElement } = useConfirmDialog();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content || '');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuRef = useClickOutside<HTMLDivElement>(closeMenu);

  const isDirtyRef = useRef(false);
  const latestDataRef = useRef({ title: note.title, content: note.content || '', note });

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content || '');
    setSaveStatus('saved');
    isDirtyRef.current = false;
    latestDataRef.current = { title: note.title, content: note.content || '', note };
  }, [note.id, note.title, note.content]);

  useEffect(() => {
    latestDataRef.current = { title, content, note };
  }, [title, content, note]);

  // Clean unmount auto-save
  useEffect(() => {
    return () => {
      if (isDirtyRef.current) {
        const { note: currentNote, title: currentTitle, content: currentContent } = latestDataRef.current;
        if (currentNote) {
          onUpdate(currentNote.id, currentTitle, currentContent);
        }
      }
    };
  }, [onUpdate]);

  // Debounced auto-save effect
  useEffect(() => {
    if (!isOpen) return;
    if (title !== note.title || content !== note.content) {
      isDirtyRef.current = true;
      setSaveStatus('saving');
      const timer = setTimeout(() => {
        onUpdate(note.id, title, content);
        isDirtyRef.current = false;
        setSaveStatus('saved');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [title, content, note.id, note.title, note.content, isOpen, onUpdate]);

  const handleImport = async () => {
    const mdContent = await listsService.pickMarkdownFile();
    if (mdContent) {
      const jsonStr = convertMarkdownToTipTapJson(mdContent);
      setContent(jsonStr);
      if (showToast) showToast('导入成功！');
    }
  };

  const handleExport = async () => {
    try {
      const exportText = convertTipTapJsonToMarkdown(content);
      await listsService.saveMarkdownFile(`${title || '未命名笔记'}.md`, exportText);
      if (showToast) showToast('导出成功！');
    } catch (err) {
      // Cancellation handled gracefully
    }
  };

  return (
    <>
      {dialogElement}
      <div className="flex h-12 items-center justify-between border-b border-border px-4 shrink-0">
        <Input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="笔记标题"
          className="flex-1 mr-4 text-xl font-bold border-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-auto"
        />
        <div className="flex items-center gap-2 shrink-0">
          <span
            title={saveStatus === 'saving' ? '保存中...' : '已自动保存'}
            aria-live="polite"
            className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2 py-1.5 text-xs text-primary"
          >
            <Cloud
              size={18}
              className={cn('transition-all duration-300', saveStatus === 'saving' ? 'opacity-50 animate-pulse' : 'opacity-100')}
            />
            <span>{saveStatus === 'saving' ? '保存中' : '已保存'}</span>
          </span>
          <div className="relative" ref={menuRef}>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-lg"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <MoreHorizontal size={20} />
            </Button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 min-w-36 p-1 bg-popover border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.1)] flex flex-col animate-in fade-in zoom-in-95">
                <button
                  className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => { setMenuOpen(false); onPin(note); }}
                >
                  {note.isPinned ? '取消置顶' : '置顶'}
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => { setMenuOpen(false); onDuplicate(note); }}
                >
                  创建副本
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => { setMenuOpen(false); onSaveAsTemplate(note); }}
                >
                  保存为模板
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => { setMenuOpen(false); handleImport(); }}
                >
                  导入MD
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => { setMenuOpen(false); handleExport(); }}
                >
                  导出MD
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm rounded-sm text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    const confirmed = await confirmDelete({
                      title: '删除笔记',
                      description: `确定要删除笔记"${note.title || '未命名笔记'}"吗？`,
                      confirmText: '删除',
                    });
                    if (confirmed) {
                      onDelete(note);
                      onClose();
                    }
                  }}
                >
                  删除
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className="flex-1 flex flex-col p-0 overflow-hidden relative"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <ReactjsTiptapEditor
          content={content}
          initialContent={content}
          onChange={setContent}
          enableCustomTemplates={true}
        />
      </div>
    </>
  );
}

function NoteDrawer({ note, isOpen, onClose, onUpdate, onPin, onDuplicate, onSaveAsTemplate, onDelete, showToast }: NoteDrawerProps) {
  const [drawerWidth, setDrawerWidth] = useState(600);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = drawerWidth;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const deltaX = startX.current - e.clientX;
    const newWidth = Math.min(Math.max(400, startWidth.current + deltaX), window.innerWidth - 200);
    setDrawerWidth(newWidth);
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = '';
  };

  if (!note) return null;

  return (
    <>
      {isOpen && (
        <div
          className="fixed bottom-0 left-[58px] right-0 top-[38px] z-20 bg-black/20 backdrop-blur-2xs transition-opacity dark:bg-black/40"
          onClick={() => onClose()}
        />
      )}
      <div
        className={cn(
          'absolute top-0 bottom-0 z-30 bg-card text-card-foreground border-l border-border shadow-2xl flex flex-col transition-all duration-300 ease-out',
          isOpen ? 'right-0' : '-right-full'
        )}
        style={{ width: drawerWidth }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary/40 transition-colors z-40"
          onMouseDown={handleMouseDown}
        />
        <NoteDrawerContent
          key={note.id}
          note={note}
          isOpen={isOpen}
          onClose={onClose}
          onUpdate={onUpdate}
          onPin={onPin}
          onDuplicate={onDuplicate}
          onSaveAsTemplate={onSaveAsTemplate}
          onDelete={onDelete}
          showToast={showToast}
        />
      </div>
    </>
  );
}

// ============================================================================
// 5. Modal Components (KnowledgeBaseModal, FolderModal, ListSettingsModal, BatchExportModal)
// ============================================================================
interface FolderModalProps {
  initialData?: Folder;
  onClose: () => void;
  onSave: (name: string) => void;
}

function FolderModal({ initialData, onClose, onSave }: FolderModalProps) {
  const [name, setName] = useState(initialData?.name || '');

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <ModalShell
      title={initialData ? '编辑知识库' : '添加知识库'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button variant="default" onClick={handleSave} disabled={!name.trim()}>
            {initialData ? '保存' : '添加'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3 pt-2">
        <label className="text-sm font-medium text-muted-foreground">知识库名称</label>
        <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
          <Library size={18} className="text-primary shrink-0" />
          <Input
            type="text"
            placeholder="知识库名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="h-full border-none bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          />
        </div>
      </div>
    </ModalShell>
  );
}

interface AddListModalProps {
  folders: Folder[];
  initialFolderId?: string;
  initialData?: List;
  onClose: () => void;
  onAdd: (data: { name: string; color: string; viewType: ViewType; folderId: string | null; icon: string }, newFolderName?: string) => void;
  onAddFolder: (name: string) => Folder;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#3b82f6', '#6366f1', '#a855f7'];

function AddListModal({ folders, initialFolderId, initialData, onClose, onAdd, onAddFolder }: AddListModalProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [color, setColor] = useState(initialData?.color || COLORS[6]);
  const [viewType, setViewType] = useState<ViewType>(initialData?.viewType || 'list');
  const [folderId, setFolderId] = useState<string | null>(initialData?.folderId !== undefined ? initialData.folderId : (initialFolderId || null));
  const [isFolderDropdownOpen, setIsFolderDropdownOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const closeDropdown = useCallback(() => setIsFolderDropdownOpen(false), []);
  const dropdownRef = useClickOutside<HTMLDivElement>(closeDropdown);

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({ name, color, viewType, folderId, icon: 'BookOpen' });
  };

  const getFolderDisplay = () => {
    if (!folderId) return '无';
    const folder = folders.find(f => f.id === folderId);
    return folder ? folder.name : '无';
  };

  return (
    <ModalShell
      title={initialData ? '编辑文件夹' : '添加文件夹'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button variant="default" onClick={handleAdd} disabled={!name.trim()}>
            {initialData ? '保存' : '添加'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground">文件夹名称</label>
          <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
          <FolderIcon size={18} className="text-primary shrink-0" />
          <Input
            type="text"
            placeholder="文件夹名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="h-full border-none bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">颜色主题</span>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'size-5 rounded-full cursor-pointer border-2 transition-transform hover:scale-110',
                color === 'none' ? 'border-ring ring-2 ring-ring/20' : 'border-border'
              )}
              onClick={() => setColor('none')}
            />
            {COLORS.map(c => (
              <div
                key={c}
                className={cn(
                  'size-5 rounded-full cursor-pointer border-2 transition-transform hover:scale-110',
                  color === c ? 'border-foreground ring-2 ring-ring/30' : 'border-transparent'
                )}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">视图模式</span>
          <div className="flex items-center bg-muted p-1 rounded-lg gap-1">
            <button
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer',
                viewType === 'list' ? 'bg-card text-primary border border-primary' : 'text-muted-foreground border border-transparent'
              )}
              onClick={() => setViewType('list')}
            >
              <LayoutList size={14} />
              <span>列表</span>
            </button>
            <button
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer',
                viewType === 'board' ? 'bg-card text-primary border border-primary' : 'text-muted-foreground border border-transparent'
              )}
              onClick={() => setViewType('board')}
            >
              <Columns size={14} />
              <span>看板</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between relative">
              <span className="text-xs font-semibold text-muted-foreground">所属知识库</span>
          <div className="relative flex-1 max-w-[220px]" ref={dropdownRef}>
            <Button
              variant="outline"
              size="sm"
              className="w-full flex items-center justify-between px-3 text-xs font-medium"
              onClick={() => setIsFolderDropdownOpen(!isFolderDropdownOpen)}
            >
              <span>{getFolderDisplay()}</span>
              <ChevronDown size={14} className="text-muted-foreground" />
            </Button>

            {isFolderDropdownOpen && (
              <div className="absolute top-full right-0 mt-1.5 z-50 w-full p-1 bg-popover border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.1)] flex flex-col max-h-48 overflow-y-auto">
                <button
                  type="button"
                  className="flex items-center justify-between px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer w-full text-left"
                  onClick={() => { setFolderId(null); setIsFolderDropdownOpen(false); }}
                >
                  <span>无</span>
                  {folderId === null && <Check size={14} className="text-primary" />}
                </button>
                {folders.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    className="flex items-center justify-between px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer w-full text-left"
                    onClick={() => { setFolderId(f.id); setIsFolderDropdownOpen(false); }}
                  >
                    <span>{f.name}</span>
                    {folderId === f.id && <Check size={14} className="text-primary" />}
                  </button>
                ))}
                <div className="pt-1 border-t border-border flex items-center gap-1.5 px-2 py-1">
                  <Plus size={14} className="text-muted-foreground shrink-0" />
                  <Input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="新建知识库..."
                    className="border-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-auto text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (newFolderName.trim()) {
                          const newFolder = onAddFolder(newFolderName.trim());
                          setFolderId(newFolder.id);
                          setNewFolderName('');
                          setIsFolderDropdownOpen(false);
                        }
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

interface ListSettingsModalProps {
  onClose: () => void;
  showToast?: (message: string, type?: 'success' | 'error') => void;
}

function ListSettingsModal({ onClose, showToast }: ListSettingsModalProps) {
  const [openMode, setOpenMode] = useState<NoteOpenMode>('sidebar');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setOpenMode(getNoteOpenMode());
  }, []);

  const handleSelectMode = async (mode: NoteOpenMode) => {
    setOpenMode(mode);
    setIsSaving(true);
    try {
      await setNoteOpenMode(mode);
      if (showToast) {
        showToast(`已成功将笔记弹出方式切换为：${mode === 'sidebar' ? '侧边栏弹出' : '新窗口弹出'}`);
      }
    } catch (e) {
      logError('listsPanel', 'failed to save note open mode preference', e);
      if (showToast) {
        showToast('保存配置失败', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell
      title="文件夹设置"
      onClose={onClose}
      width="460px"
      footer={
        <Button variant="secondary" onClick={onClose} disabled={isSaving}>
          完成
        </Button>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="block text-sm font-semibold text-foreground mb-1">笔记弹出方式</span>
          <p className="text-xs text-muted-foreground mb-3">
            选择点击笔记列表条目时的打开方式。设置将自动保存并同步至数据库。
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => handleSelectMode('sidebar')}
              className={cn(
                'p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-2',
                openMode === 'sidebar'
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-muted/50 hover:border-muted-foreground/30'
              )}
            >
              <div className="flex items-center justify-between">
                <Sidebar size={20} className={openMode === 'sidebar' ? 'text-primary' : 'text-muted-foreground'} />
                {openMode === 'sidebar' && <Check size={16} className="text-primary" />}
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">侧边栏弹出</div>
                <div className="text-xs text-muted-foreground mt-0.5">在主界面右侧滑出抽屉编辑</div>
              </div>
            </div>

            <div
              onClick={() => handleSelectMode('window')}
              className={cn(
                'p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-2',
                openMode === 'window'
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-muted/50 hover:border-muted-foreground/30'
              )}
            >
              <div className="flex items-center justify-between">
                <ExternalLink size={20} className={openMode === 'window' ? 'text-primary' : 'text-muted-foreground'} />
                {openMode === 'window' && <Check size={16} className="text-primary" />}
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">新窗口弹出</div>
                <div className="text-xs text-muted-foreground mt-0.5">在独立的窗口中多任务并发编辑</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

interface BatchExportModalProps {
  notes: Note[];
  onExport: (selectedNoteIds: string[]) => void;
  onClose: () => void;
}

function BatchExportModal({ notes, onExport, onClose }: BatchExportModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(notes.map(n => n.id)));

  const handleToggleSelectAll = () => {
    if (selectedIds.size === notes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notes.map(n => n.id)));
    }
  };

  const handleToggleNote = (noteId: string) => {
    const next = new Set(selectedIds);
    if (next.has(noteId)) {
      next.delete(noteId);
    } else {
      next.add(noteId);
    }
    setSelectedIds(next);
  };

  const handleConfirm = () => {
    if (selectedIds.size === 0) {
      alert('请至少选择一条笔记进行导出。');
      return;
    }
    onExport(Array.from(selectedIds));
  };

  const allSelected = selectedIds.size === notes.length && notes.length > 0;

  return (
    <ModalShell
      title="批量导出笔记"
      onClose={onClose}
      width="500px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button variant="default" onClick={handleConfirm} disabled={selectedIds.size === 0 || notes.length === 0}>
            导出选中的笔记 ({selectedIds.size})
          </Button>
        </>
      }
    >
      <div className="overflow-y-auto max-h-[50vh] space-y-1">
        {notes.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">当前文件夹暂无笔记。</div>
        ) : (
          <>
            <label className="flex items-center gap-3 px-3 py-2 border-b border-border cursor-pointer text-sm font-semibold text-foreground select-none">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleToggleSelectAll}
                className="size-4 rounded-md accent-primary cursor-pointer"
              />
              <span>全选 ({notes.length})</span>
            </label>
            <div className="pt-1 space-y-1">
              {notes.map(note => {
                const isChecked = selectedIds.has(note.id);
                return (
                  <label
                    key={note.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground cursor-pointer select-none transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleNote(note.id)}
                      className="size-4 rounded-md accent-primary cursor-pointer"
                    />
                    <span className="text-sm text-foreground truncate">
                      {note.title || '未命名笔记'}
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

// ============================================================================
// 6. Main ListsPanel Component
// ============================================================================
function MenuIcon({ isCollapsed }: { isCollapsed: boolean }) {
  return isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />;
}

type DragOverTarget =
  | { type: 'sidebar-list'; id: string }
  | { type: 'folder'; id: string }
  | { type: 'group'; id: string }
  | { type: 'standalone-area' }
  | null;

const EMPTY_LISTS: List[] = [];
const EMPTY_FOLDERS: Folder[] = [];
const EMPTY_NOTES: Note[] = [];
const EMPTY_NOTE_GROUPS: NoteGroup[] = [];

export function ListsPanel() {
  // Query-backed data + write actions (connected to listNotesService Supabase backend)
  const { data } = useListsData();
  const rawLists = data?.lists ?? EMPTY_LISTS;
  const rawFolders = data?.folders ?? EMPTY_FOLDERS;
  const rawNotes = data?.notes ?? EMPTY_NOTES;
  const rawNoteGroups = data?.noteGroups ?? EMPTY_NOTE_GROUPS;

  const {
    moveNoteToList,
    reorderNotes,
    moveNoteAndReorder,
    reorderFolders,
    reorderLists,
    moveList,
    addFolder,
    updateFolder,
    deleteFolder,
    addList,
    updateList,
    duplicateList,
    deleteList,
    addNote,
    updateNote,
    deleteNote,
    addGroup,
    updateGroup,
    deleteGroup,
  } = useListsActions();
  const { addTemplate, updateTemplate, deleteTemplate } = useTemplateActions();

  const lists = useMemo(() => sortLists(rawLists), [rawLists]);
  const folders = useMemo(() => sortFolders(rawFolders), [rawFolders]);

  const folderIdSet = useMemo(() => new Set(folders.map(f => f.id)), [folders]);
  const noteMap = useMemo(() => new Map(rawNotes.map(n => [n.id, n])), [rawNotes]);
  const listMap = useMemo(() => new Map(lists.map(l => [l.id, l])), [lists]);

  const templates = useTemplateData().data ?? [];

  const [activeListId, setActiveListId] = useState<string | null>(() => {
    return localStorage.getItem('lists-active-list-id');
  });

  const notes = useMemo(() => {
    if (!activeListId) return [];
    return rawNotes
      .filter(n => n.listId === activeListId)
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        if (a.sortOrder !== b.sortOrder) {
          return (a.sortOrder || 0) - (b.sortOrder || 0);
        }
        return b.updatedAt - a.updatedAt;
      });
  }, [rawNotes, activeListId]);

  const noteGroups = useMemo(() => {
    if (!activeListId) return [];
    return rawNoteGroups
      .filter(g => g.listId === activeListId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [rawNoteGroups, activeListId]);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('lists-sidebar-collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('lists-sidebar-collapsed', String(next));
      return next;
    });
  };

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalInitialFolderId, setAddModalInitialFolderId] = useState<string | undefined>();

  const [editListId, setEditListId] = useState<string | null>(null);
  const editListTarget = useMemo(
    () => (editListId ? lists.find(l => l.id === editListId) : undefined),
    [lists, editListId]
  );

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const editFolderTarget = useMemo(
    () => (editFolderId ? folders.find(f => f.id === editFolderId) : undefined),
    [folders, editFolderId]
  );

  const [isListSettingsOpen, setIsListSettingsOpen] = useState(false);

  // Note state
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const activeNote = useMemo(() => {
    if (!activeNoteId) return null;
    return noteMap.get(activeNoteId) || null;
  }, [noteMap, activeNoteId]);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const [activeDragNoteId, setActiveDragNoteId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<DragOverTarget>(null);

  const dragOverSidebarListId = dragOverTarget?.type === 'sidebar-list' ? dragOverTarget.id : null;
  const dragOverFolderId = dragOverTarget?.type === 'folder' || dragOverTarget?.type === 'standalone-area'
    ? (dragOverTarget.type === 'standalone-area' ? 'standalone-area' : dragOverTarget.id)
    : null;
  const dragOverGroupId = dragOverTarget?.type === 'group' ? dragOverTarget.id : null;

  // Template & Export state
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [batchExportModalOpen, setBatchExportModalOpen] = useState(false);

  // Toast state
  interface ToastMessage {
    id: string;
    message: string;
    type: 'success' | 'error';
    isFadingOut?: boolean;
  }
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev =>
        prev.map(t => (t.id === id ? { ...t, isFadingOut: true } : t))
      );
    }, 2700);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const didInitActiveList = useRef(false);
  useEffect(() => {
    if (didInitActiveList.current) return;
    if (lists.length === 0) return;
    didInitActiveList.current = true;

    const savedId = localStorage.getItem('lists-active-list-id');
    const exists = savedId && lists.some(l => l.id === savedId);
    if (exists) return;

    let defaultListId = lists[0].id;
    if (folders.length > 0) {
      const firstFolder = folders[0];
      const folderLists = lists.filter(l => l.folderId === firstFolder.id);
      if (folderLists.length > 0) {
        defaultListId = folderLists[0].id;
      }
    }

    setActiveListId(defaultListId);
    localStorage.setItem('lists-active-list-id', defaultListId);
  }, [lists, folders]);

  useEffect(() => {
    if (activeListId) {
      setActiveNoteId(null);
      setIsDrawerOpen(false);
      localStorage.setItem('lists-active-list-id', activeListId);
    } else {
      localStorage.removeItem('lists-active-list-id');
    }
  }, [activeListId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      shouldHandleEvent(event: KeyboardEvent) {
        const target = event.target as HTMLElement | null;
        if (
          target &&
          (target.isContentEditable ||
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.closest('.ProseMirror') ||
            target.closest('[contenteditable="true"]'))
        ) {
          return false;
        }
        return true;
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragNoteId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      if (dragOverTarget !== null) setDragOverTarget(null);
      return;
    }
    const overId = String(over.id);
    const overData = over.data?.current as { type?: string; listId?: string } | undefined;
    const activeId = String(active.id);

    const isDraggingNote = noteMap.has(activeId);

    if (isDraggingNote) {
      if (overData?.type === 'sidebar-list' && overData.listId) {
        setDragOverTarget({ type: 'sidebar-list', id: overData.listId });
      } else if (overData?.type === 'folder' || folderIdSet.has(overId)) {
        setDragOverTarget({ type: 'folder', id: overId });
      } else if (overData?.type === 'group') {
        setDragOverTarget({ type: 'group', id: overId === 'ungrouped' ? 'ungrouped' : overId });
      } else {
        const overNote = noteMap.get(overId);
        if (overNote) {
          setDragOverTarget({ type: 'group', id: overNote.groupId || 'ungrouped' });
        } else {
          setDragOverTarget(null);
        }
      }
    } else {
      const activeFolder = folderIdSet.has(activeId);
      if (activeFolder) {
        setDragOverTarget(null);
        return;
      }
      if (overId === 'standalone-area') {
        setDragOverTarget({ type: 'standalone-area' });
      } else if (overData?.type === 'folder' || folderIdSet.has(overId)) {
        setDragOverTarget({ type: 'folder', id: overId });
      } else {
        const overList = listMap.get(overId);
        if (overList) {
          const fId = overList.folderId;
          setDragOverTarget(fId ? { type: 'folder', id: fId } : { type: 'standalone-area' });
        } else {
          setDragOverTarget(null);
        }
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragNoteId(null);
    setDragOverTarget(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const overData = over.data?.current as { type?: string; listId?: string } | undefined;

    const isDraggingNote = noteMap.has(activeId);

    if (isDraggingNote) {
      let targetListId: string | null = null;
      if (overData?.type === 'sidebar-list' && overData.listId) {
        targetListId = overData.listId;
      } else if (overId.startsWith('sidebar-list-')) {
        targetListId = overId.replace('sidebar-list-', '');
      } else if (listMap.has(overId)) {
        targetListId = overId;
      }

      if (targetListId) {
        const targetList = listMap.get(targetListId);
        moveNoteToList(activeId, targetListId);
        if (targetList) {
          showToast(`已成功移动笔记到文件夹「${targetList.name}」`);
        }
        return;
      }

      if (overData?.type === 'folder' || folderIdSet.has(overId)) {
        const folderId = overId;
        const folderLists = lists.filter(l => l.folderId === folderId);
        if (folderLists.length > 0) {
          const targetList = folderLists[0];
          moveNoteToList(activeId, targetList.id);
          showToast(`已成功移动笔记到文件夹「${targetList.name}」`);
        }
        return;
      }

      let overType: 'group' | 'note' | 'other' = 'other';
      let overGroupId: string | null | undefined = undefined;
      if (overData?.type === 'group') {
        overType = 'group';
        overGroupId = overId === 'ungrouped' ? null : overId;
      } else if (noteMap.has(overId)) {
        overType = 'note';
      }

      const action = computeNoteReorder({
        activeId,
        overId,
        notes,
        overType,
        overGroupId,
      });

      switch (action.kind) {
        case 'reorder':
          reorderNotes(action.newOrder);
          break;
        case 'move':
          moveNoteAndReorder(activeId, action.targetGroup, action.targetIndex);
          break;
      }
    } else {
      let overType: 'folder' | 'standalone' | 'list' | 'other' = 'other';
      if (overId === 'standalone-area') overType = 'standalone';
      else if (overData?.type === 'folder' || folderIdSet.has(overId)) overType = 'folder';
      else if (listMap.has(overId)) overType = 'list';

      const action = computeListReorder({
        activeId,
        overId,
        lists,
        folders,
        overType,
      });

      switch (action.kind) {
        case 'reorder':
          if (folderIdSet.has(activeId)) {
            reorderFolders(action.newOrder);
          } else {
            reorderLists(action.newOrder);
          }
          break;
        case 'move':
          moveList(activeId, action.targetGroup, action.targetIndex);
          break;
      }
    }
  };

  // --- List Handlers ---
  const handleAddListClick = (folderId?: string) => {
    setEditListId(null);
    setAddModalInitialFolderId(folderId);
    setIsAddModalOpen(true);
  };

  const handleAddFolder = (name: string) => {
    return addFolder(name);
  };

  const handleAddList = (data: { name: string; color: string; viewType: ViewType; folderId: string | null; icon: string }, newFolderName?: string) => {
    let finalFolderId = data.folderId;
    if (newFolderName) {
      const newFolder = addFolder(newFolderName);
      finalFolderId = newFolder.id;
    }
    if (editListId) {
      updateList(editListId, {
        name: data.name,
        color: data.color,
        viewType: data.viewType,
        folderId: finalFolderId,
        icon: data.icon,
      });
    } else {
      const newList = addList({
        name: data.name,
        color: data.color,
        viewType: data.viewType,
        folderId: finalFolderId,
        icon: data.icon,
      });
      setActiveListId(newList.id);
    }
    setIsAddModalOpen(false);
    setEditListId(null);
  };

  // --- Sidebar Actions ---
  const handleEditFolder = (folder: Folder) => {
    setEditFolderId(folder.id);
    setIsFolderModalOpen(true);
  };

  const handleSaveFolder = (name: string) => {
    if (editFolderId) {
      updateFolder(editFolderId, { name });
    }
    setIsFolderModalOpen(false);
    setEditFolderId(null);
  };

  const handlePinFolder = (folder: Folder) => {
    updateFolder(folder.id, { isPinned: !folder.isPinned });
  };

  const handleDissolveFolder = (folder: Folder) => {
    deleteFolder(folder.id);
  };

  const handleEditList = (list: List) => {
    setEditListId(list.id);
    setIsAddModalOpen(true);
  };

  const handlePinList = (list: List) => {
    updateList(list.id, { isPinned: !list.isPinned });
  };

  const handleDuplicateList = (list: List) => {
    const newList = duplicateList(list);
    setActiveListId(newList.id);
  };

  const handleDeleteList = (list: List) => {
    deleteList(list.id);
    if (activeListId === list.id) setActiveListId(null);
  };

  // --- Note Actions ---
  const handleOpenNote = (noteId: string, noteTitle?: string) => {
    const mode = getNoteOpenMode();
    if (mode === 'window') {
      openNoteInNewWindow(noteId, noteTitle);
    } else {
      setActiveNoteId(noteId);
      setIsDrawerOpen(true);
    }
  };

  const handleAddNote = () => {
    if (!activeListId || !newNoteTitle.trim()) return;
    const newNote = addNote({
      listId: activeListId,
      title: newNoteTitle.trim(),
      content: '',
    });
    setNewNoteTitle('');
    handleOpenNote(newNote.id, newNote.title);
  };

  const handleBatchImport = async () => {
    if (!activeListId) return;
    try {
      const importedFiles = await listsService.pickMultipleMarkdownFiles();
      for (const file of importedFiles) {
        const jsonContent = convertMarkdownToTipTapJson(file.content);
        addNote({
          listId: activeListId,
          title: file.title,
          content: jsonContent,
        });
      }
      showToast(`已成功导入 ${importedFiles.length} 条笔记！`);
    } catch (err) {
      logSilent('listsPanel', 'batch import cancelled or failed', err);
    }
  };

  const handleBatchExport = async (selectedNoteIds: string[]) => {
    const notesToExport = notes.filter(n => selectedNoteIds.includes(n.id));
    if (notesToExport.length === 0) return;

    const files = notesToExport.map(n => ({
      title: n.title,
      content: convertTipTapJsonToMarkdown(n.content || ''),
    }));

    try {
      await listsService.saveMultipleMarkdownFiles(files);
      setBatchExportModalOpen(false);
      showToast(`已成功导出 ${files.length} 条笔记！`);
    } catch (err) {
      logSilent('listsPanel', 'batch export cancelled or failed', err);
    }
  };

  const handleNoteUpdate = (id: string, title: string, content: string) => {
    updateNote(id, { title, content });
  };

  const handlePinNote = (note: Note) => {
    updateNote(note.id, { isPinned: !note.isPinned });
  };

  const handleDuplicateNote = (note: Note) => {
    const newNote = addNote({
      listId: note.listId,
      title: note.title + ' (副本)',
      content: note.content,
    });
    handleOpenNote(newNote.id, newNote.title);
  };

  const handleSaveAsTemplate = (note: Note) => {
    addTemplate(note.title || '自定义模板', note.content);
    showToast('已保存为模板！');
  };

  const handleDeleteNote = (note: Note) => {
    deleteNote(note.id);
    if (activeNoteId === note.id) {
      setActiveNoteId(null);
      setIsDrawerOpen(false);
    }
  };

  const ensureJsonFormat = (text: string) => {
    if (!text) return JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] });
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed;
    }
    return convertMarkdownToTipTapJson(text);
  };

  const handleSelectTemplate = (template: Template) => {
    if (!activeNoteId) return;
    const jsonContent = ensureJsonFormat(template.content);
    updateNote(activeNoteId, { content: jsonContent });
    setIsTemplateModalOpen(false);
  };

  const handleEditTemplate = (id: string, name: string, content: string) => {
    updateTemplate(id, { name, content: { raw: content } });
  };

  const handleDeleteTemplate = (id: string) => {
    deleteTemplate(id);
  };

  // --- Group Actions ---
  const handleAddGroupClick = () => {
    setIsAddingGroup(true);
    setNewGroupName('');
  };

  const handleConfirmAddGroup = () => {
    if (!activeListId) return;
    if (newGroupName.trim()) {
      addGroup(activeListId, newGroupName.trim());
    }
    setIsAddingGroup(false);
  };

  const handleRenameGroup = (id: string, name: string) => {
    updateGroup(id, { name });
  };

  const handleDeleteGroup = (id: string) => {
    deleteGroup(id);
  };

  const handleMoveNote = (note: Note, targetListId: string) => {
    updateNote(note.id, { listId: targetListId, groupId: null });
    if (activeNoteId === note.id && activeListId !== targetListId) {
      setActiveNoteId(null);
      setIsDrawerOpen(false);
    }
  };

  const activeList = listMap.get(activeListId || '');

  const ungroupedNotes = useMemo(() => notes.filter(n => !n.groupId), [notes]);
  const activeNoteItem = useMemo(() => (activeDragNoteId ? noteMap.get(activeDragNoteId) : null), [noteMap, activeDragNoteId]);
  const isUngroupedDragOverTarget = dragOverGroupId === 'ungrouped' && activeNoteItem && activeNoteItem.groupId !== null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <section className="flex h-full w-full bg-background overflow-hidden text-foreground">
        <ListsSidebar
          lists={lists}
          folders={folders}
          activeListId={activeListId}
          dragOverListId={dragOverSidebarListId}
          dragOverFolderId={dragOverFolderId}
          onSelectList={setActiveListId}
          onAddClick={handleAddListClick}
          onEditFolder={handleEditFolder}
          onPinFolder={handlePinFolder}
          onDissolveFolder={handleDissolveFolder}
          onEditList={handleEditList}
          onPinList={handlePinList}
          onDuplicateList={handleDuplicateList}
          onDeleteList={handleDeleteList}
          isCollapsed={isSidebarCollapsed}
        />

        <main
          className="flex-1 flex flex-col bg-background relative overflow-hidden"
          onClick={() => setListMenuOpen(false)}
        >
          {activeList ? (
            <>
              <div className="flex h-12 items-center justify-between border-b border-border px-6 shrink-0">
                <div className="flex items-center gap-3 font-bold text-xl text-foreground">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-lg"
                    onClick={toggleSidebar}
                    title={isSidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
                  >
                    <MenuIcon isCollapsed={isSidebarCollapsed} />
                  </Button>
                  <span>{activeList.name}</span>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <Button variant="ghost" size="icon" className="rounded-lg">
                    <ArrowDownUp size={18} />
                  </Button>
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-lg"
                      onClick={(e) => { e.stopPropagation(); setListMenuOpen(!listMenuOpen); }}
                    >
                      <MoreHorizontal size={18} />
                    </Button>
                    {listMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 z-20 min-w-44 p-1 bg-popover border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.1)] flex flex-col animate-in fade-in zoom-in-95">
                        <div className="group/sub relative before:absolute before:-left-2.5 before:inset-y-0 before:w-3">
                          <button className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors flex items-center justify-between cursor-pointer">
                            <span>笔记打开方式</span>
                            <ChevronRight size={14} className="text-muted-foreground" />
                          </button>

                          <div className="hidden group-hover/sub:flex absolute right-full top-0 mr-0 min-w-40 p-1 bg-popover border border-border rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.1)] flex-col">
                            <button
                              className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors flex items-center justify-between cursor-pointer"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await setNoteOpenMode('sidebar');
                                showToast('已成功切换为：侧边栏弹出笔记');
                                setListMenuOpen(false);
                              }}
                            >
                              <span className="flex items-center gap-1.5">
                                <Sidebar size={14} />
                                侧边栏弹出
                              </span>
                              {getNoteOpenMode() === 'sidebar' && <Check size={14} className="text-primary" />}
                            </button>

                            <button
                              className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors flex items-center justify-between cursor-pointer"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await setNoteOpenMode('window');
                                showToast('已成功切换为：新窗口弹出笔记');
                                setListMenuOpen(false);
                              }}
                            >
                              <span className="flex items-center gap-1.5">
                                <ExternalLink size={14} />
                                新窗口弹出
                              </span>
                              {getNoteOpenMode() === 'window' && <Check size={14} className="text-primary" />}
                            </button>
                          </div>
                        </div>

                        <button
                          className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                          onClick={() => { handleAddGroupClick(); setListMenuOpen(false); }}
                        >
                          新建分组
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                          onClick={() => { handleBatchImport(); setListMenuOpen(false); }}
                        >
                          批量导入MD
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-sm rounded-sm text-foreground hover:bg-muted transition-colors cursor-pointer"
                          onClick={() => { setBatchExportModalOpen(true); setListMenuOpen(false); }}
                        >
                          批量导出MD
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-8 flex-1 overflow-y-auto flex flex-col py-6">
                <div className="flex items-center gap-3 bg-muted border border-input rounded-lg px-3 py-2 mb-6 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 transition-all">
                  <Plus size={18} className="text-muted-foreground shrink-0" />
                  <Input
                    type="text"
                    placeholder="添加笔记..."
                    value={newNoteTitle}
                    onChange={e => setNewNoteTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddNote();
                    }}
                    className="border-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-auto"
                  />
                </div>

                {notes.length === 0 && !isAddingGroup ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                    暂无笔记
                  </div>
                ) : (
                  <div className="flex flex-col pb-8">
                    {isAddingGroup && (
                      <div className="mb-4">
                        <Input
                          autoFocus
                          type="text"
                          value={newGroupName}
                          onChange={e => setNewGroupName(e.target.value)}
                          placeholder="输入分组名称..."
                          onBlur={handleConfirmAddGroup}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleConfirmAddGroup();
                            if (e.key === 'Escape') setIsAddingGroup(false);
                          }}
                          className="text-sm font-semibold border-primary bg-card shadow-xs max-w-xs"
                        />
                      </div>
                    )}
                    {noteGroups.length === 0 && !isAddingGroup ? (
                      <SortableContext items={notes.map(n => n.id)} strategy={verticalListSortingStrategy}>
                        {notes.map(note => (
                          <SortableItem key={note.id} id={note.id}>
                            <NoteItem
                              key={note.id}
                              note={note}
                              allLists={lists}
                              onClick={() => handleOpenNote(note.id, note.title)}
                              onPin={handlePinNote}
                              onDuplicate={handleDuplicateNote}
                              onDelete={handleDeleteNote}
                              onMove={handleMoveNote}
                            />
                          </SortableItem>
                        ))}
                      </SortableContext>
                    ) : (
                      <>
                        {noteGroups.map(group => {
                          const groupNotes = notes.filter(n => n.groupId === group.id);
                          const isDragOverTarget = dragOverGroupId === group.id && activeNoteItem && activeNoteItem.groupId !== group.id;
                          return (
                            <NoteGroupView
                              key={group.id}
                              group={group}
                              notes={groupNotes}
                              allLists={lists}
                              isDragOverTarget={!!isDragOverTarget}
                              onRenameGroup={handleRenameGroup}
                              onDeleteGroup={handleDeleteGroup}
                              onNoteClick={(note) => handleOpenNote(note.id, note.title)}
                              onPinNote={handlePinNote}
                              onDuplicateNote={handleDuplicateNote}
                              onDeleteNote={handleDeleteNote}
                              onMoveNote={handleMoveNote}
                            />
                          );
                        })}
                        {ungroupedNotes.length > 0 && (
                          <NoteGroupView
                            key="ungrouped"
                            group={{ id: 'ungrouped', listId: activeListId!, name: '未分组' }}
                            notes={ungroupedNotes}
                            allLists={lists}
                            isUngrouped={true}
                            isDragOverTarget={!!isUngroupedDragOverTarget}
                            onRenameGroup={() => { }}
                            onDeleteGroup={() => { }}
                            onNoteClick={(note) => handleOpenNote(note.id, note.title)}
                            onPinNote={handlePinNote}
                            onDuplicateNote={handleDuplicateNote}
                            onDeleteNote={handleDeleteNote}
                            onMoveNote={handleMoveNote}
                          />
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <NoteDrawer
                note={activeNote}
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                onUpdate={handleNoteUpdate}
                onPin={handlePinNote}
                onDuplicate={handleDuplicateNote}
                onSaveAsTemplate={handleSaveAsTemplate}
                onDelete={handleDeleteNote}
                showToast={showToast}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              请在左侧选择或创建一个文件夹
            </div>
          )}
        </main>

        {isAddModalOpen && (
          <AddListModal
            folders={folders}
            initialFolderId={addModalInitialFolderId}
            initialData={editListTarget}
            onClose={() => { setIsAddModalOpen(false); setEditListId(null); }}
            onAdd={handleAddList}
            onAddFolder={handleAddFolder}
          />
        )}

        {isFolderModalOpen && (
          <FolderModal
            initialData={editFolderTarget}
            onClose={() => { setIsFolderModalOpen(false); setEditFolderId(null); }}
            onSave={handleSaveFolder}
          />
        )}

        {isTemplateModalOpen && (
          <TemplateModal
            templates={templates}
            onSelect={handleSelectTemplate}
            onClose={() => setIsTemplateModalOpen(false)}
            onEdit={handleEditTemplate}
            onDelete={handleDeleteTemplate}
          />
        )}

        {batchExportModalOpen && (
          <BatchExportModal
            notes={notes}
            onExport={handleBatchExport}
            onClose={() => setBatchExportModalOpen(false)}
          />
        )}

        {isListSettingsOpen && (
          <ListSettingsModal
            onClose={() => setIsListSettingsOpen(false)}
            showToast={showToast}
          />
        )}

        {/* Toast notifications */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
          {toasts.map(t => (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl bg-foreground/90 dark:bg-background/90 text-background dark:text-foreground shadow-2xl backdrop-blur-md border border-border text-sm font-medium transition-all duration-300',
                t.isFadingOut ? 'opacity-0 translate-y-2' : 'animate-in slide-in-from-bottom-4'
              )}
            >
              {t.type === 'success' ? (
                <CheckCircle size={18} className="text-emerald-400 dark:text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle size={18} className="text-red-400 dark:text-red-600 shrink-0" />
              )}
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      </section>
    </DndContext>
  );
}
