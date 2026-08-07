import React, { useState, useEffect, useMemo, useRef, cloneElement, ReactElement, ReactNode, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownUp, MoreHorizontal, Plus, PanelLeftClose, PanelLeftOpen, CheckCircle, AlertCircle,
  ChevronRight, Check, Sidebar, ExternalLink, Folder as FolderIcon, BookOpen, Briefcase, Home,
  Package, Activity, Star, ChevronDown, FileText, Search, Cloud, X, LayoutList, Columns, Trash2
} from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverEvent, useDroppable } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useListsData, useListsActions } from './useListsQuery';
import { sortLists, sortFolders } from './listsSelectors';
import { List, Folder, ViewType, Note, NoteGroup, Template } from './listsTypes';
import { getNoteOpenMode, setNoteOpenMode, openNoteInNewWindow, NoteOpenMode } from './noteOpenService';
import { TemplateModal, useTemplateData, useTemplateActions } from '../templates';
import * as listsService from './listsService';
import { logError, logSilent } from '@/lib/syncEngine';
import { computeNoteReorder, computeListReorder } from './listsReorder';
import { ReactjsTiptapEditor, convertMarkdownToTipTapJson, convertTipTapJsonToMarkdown } from '../reactjs-tiptap-v1';
import { useConfirmDialog } from '@/components/ui/ConfirmDeleteDialog';

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
  zIndex?: number;
}

/** Unified Modal Shell rendered via Portal with Tailwind CSS v4 styling */
const ModalShell: React.FC<ModalShellProps> = memo(({ title, onClose, children, footer, width = '420px', headerRight, zIndex = 100 }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 transition-all duration-200 animate-in fade-in-0"
      style={{ zIndex }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 transition-all transform scale-100"
        style={{ width, maxWidth: '92vw' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          {headerRight || (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[75vh]">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
            {footer}
          </div>
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
  const dynamicClassName = `${className || ''} ${isOver ? 'ring-2 ring-indigo-500/80 bg-indigo-500/10 rounded-lg' : ''}`.trim();
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
      className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm font-medium transition-all duration-150 select-none ${
        isNested ? 'pl-8' : ''
      } ${
        isActive
          ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs'
          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
      } ${isTarget ? 'ring-2 ring-indigo-500 bg-indigo-100/50 dark:bg-indigo-950/70' : ''}`}
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
  BookOpen: <BookOpen size={16} />,
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
  const { confirm: confirmDelete } = useConfirmDialog();
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
        <div className="shrink-0 text-slate-400 group-hover:text-indigo-500 transition-colors">
          {getIcon(list.icon, list.color)}
        </div>
        <span className="truncate flex-1">{list.name}</span>
        {list.isPinned && <span className="text-[10px] text-amber-500">📌</span>}

        <div className="ml-auto flex items-center gap-1">
          {list.itemCount !== undefined && list.itemCount > 0 && (
            <span className="text-xs font-normal text-slate-400 dark:text-slate-500 group-hover:hidden">
              {list.itemCount}
            </span>
          )}
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              className={`p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity ${
                activeDropdown?.type === 'list' && activeDropdown.id === list.id ? 'opacity-100 bg-slate-200 dark:bg-slate-800' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setActiveDropdown(activeDropdown?.id === list.id ? null : { type: 'list', id: list.id });
              }}
            >
              <MoreHorizontal size={15} />
            </button>

            {activeDropdown?.type === 'list' && activeDropdown.id === list.id && (
              <div
                className="absolute top-full right-0 mt-1 z-50 min-w-32 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl flex flex-col gap-0.5 animate-in fade-in-0 zoom-in-95"
                ref={dropdownRef}
              >
                <button
                  className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => { setActiveDropdown(null); onEditList(list); }}
                >
                  编辑
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => { setActiveDropdown(null); onPinList(list); }}
                >
                  {list.isPinned ? '取消置顶' : '置顶'}
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => { setActiveDropdown(null); onDuplicateList(list); }}
                >
                  复制
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setActiveDropdown(null);
                    const confirmed = await confirmDelete({
                      title: '删除清单',
                      description: `确定要删除清单 "${list.name}" 吗？`,
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
    <aside
      className={`w-56 flex-none bg-slate-50/80 dark:bg-slate-900/80 border-r border-slate-200/80 dark:border-slate-800 flex flex-col transition-all duration-250 ease-in-out overflow-hidden ${
        isCollapsed ? 'w-0 opacity-0 border-r-transparent pointer-events-none' : 'w-56 opacity-100'
      }`}
    >
      <div className="group/header flex items-center justify-between px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 select-none">
        <span>清单</span>
        <button
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer opacity-0 group-hover/header:opacity-100 transition-opacity"
          onClick={() => onAddClick()}
          title="新建清单"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-1 space-y-1">
        <SortableContext items={folders.map(f => f.id)} strategy={verticalListSortingStrategy}>
          {folders.map(folder => {
            const isCollapsedFolder = collapsedFolders[folder.id];
            const folderLists = listsByFolder[folder.id] || [];
            const isTarget = dragOverFolderId === folder.id;

            return (
              <div key={folder.id} className="space-y-0.5">
                <SortableItem id={folder.id}>
                  <DroppableArea
                    id={folder.id}
                    data={{ type: 'folder' }}
                    className={`group relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors select-none ${
                      isTarget ? 'ring-2 ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/50' : ''
                    }`}
                    onClick={() => toggleFolder(folder.id)}
                  >
                    <ChevronDown
                      size={14}
                      className={`text-slate-400 transition-transform duration-200 ${isCollapsedFolder ? '-rotate-90' : ''}`}
                    />
                    <FolderIcon size={16} className="text-amber-500/90 dark:text-amber-400/90 shrink-0" />
                    <span className="truncate flex-1 font-semibold text-xs text-slate-600 dark:text-slate-400">{folder.name}</span>
                    {folder.isPinned && <span className="text-[10px] text-amber-500">📌</span>}

                    <div className="relative ml-auto" onClick={e => e.stopPropagation()}>
                      <button
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdown(activeDropdown?.id === folder.id ? null : { type: 'folder', id: folder.id });
                        }}
                      >
                        <MoreHorizontal size={15} />
                      </button>

                      {activeDropdown?.type === 'folder' && activeDropdown.id === folder.id && (
                        <div
                          className="absolute top-full right-0 mt-1 z-50 min-w-36 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl flex flex-col gap-0.5 animate-in fade-in-0 zoom-in-95"
                          ref={dropdownRef}
                        >
                          <button
                            className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            onClick={() => { setActiveDropdown(null); onAddClick(folder.id); }}
                          >
                            添加清单
                          </button>
                          <button
                            className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            onClick={() => { setActiveDropdown(null); onEditFolder(folder); }}
                          >
                            编辑
                          </button>
                          <button
                            className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            onClick={() => { setActiveDropdown(null); onPinFolder(folder); }}
                          >
                            {folder.isPinned ? '取消置顶' : '置顶'}
                          </button>
                          <button
                            className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            onClick={async (e) => {
                              e.stopPropagation();
                              setActiveDropdown(null);
                              const confirmed = await confirmDelete({
                                title: '解散文件夹',
                                description: `确定要解散文件夹 "${folder.name}" 吗？（其中的清单不会被删除）`,
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
                    <div className="space-y-0.5">
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
          className={`flex-1 min-h-[50px] pb-5 space-y-0.5 rounded-lg ${isTargetStandalone ? 'ring-2 ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/50' : ''}`}
        >
          <SortableContext items={standaloneLists.map(l => l.id)} strategy={verticalListSortingStrategy}>
            {standaloneLists.map(list => renderSidebarItem(list, false))}
          </SortableContext>
        </DroppableArea>
      </div>
    </aside>
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
      className="group relative flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700/80 rounded-xl px-4 py-3 cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200 mb-2.5 text-slate-900 dark:text-slate-100"
      onClick={onClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'note', noteId: note.id }));
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <FileText size={16} className="text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors shrink-0" />
      <div className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
        {note.title || '无标题笔记'}
      </div>
      {note.isPinned && (
        <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-900/50 shrink-0">
          📌 置顶
        </span>
      )}

      <div className="relative shrink-0" onClick={e => e.stopPropagation()} ref={menuRef}>
        <button
          className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-all ${
            menuOpen ? 'opacity-100 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200' : ''
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
            setShowMoveTo(false);
            setSearchQuery('');
          }}
        >
          <MoreHorizontal size={16} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1.5 z-50 min-w-44 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl flex flex-col gap-0.5 animate-in fade-in-0 zoom-in-95">
            {showMoveTo ? (
              <div className="flex flex-col gap-1 p-1">
                <div className="flex items-center gap-1.5 px-2 py-1 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <button
                    className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                    onClick={(e) => { e.stopPropagation(); setShowMoveTo(false); }}
                  >
                    <ChevronRight size={14} className="rotate-180" />
                  </button>
                  <span>移动到...</span>
                </div>
                <div className="p-1">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
                    <Search size={13} className="text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="搜索清单..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent border-none outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {otherLists.length === 0 ? (
                    <div className="p-2 text-xs text-slate-400 text-center">无匹配清单</div>
                  ) : (
                    otherLists.map(list => (
                      <button
                        key={list.id}
                        className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors truncate"
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
                  className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onPin(note); }}
                >
                  {note.isPinned ? '取消置顶' : '置顶'}
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
                  onClick={(e) => { e.stopPropagation(); setShowMoveTo(true); }}
                >
                  <span>移动到</span>
                  <ChevronRight size={14} />
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDuplicate(note); }}
                >
                  创建副本
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
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
      className={`mb-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/40 p-3 transition-all ${
        isDragOverTarget ? 'ring-2 ring-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/40' : ''
      }`}
    >
      <div
        className="group/gh flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-slate-200/40 dark:hover:bg-slate-800/40 transition-colors select-none"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
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
            className="text-sm font-semibold border border-indigo-400 bg-white dark:bg-slate-800 outline-none rounded-md px-2 py-0.5 text-slate-900 dark:text-slate-100"
          />
        ) : (
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{group.name}</span>
        )}

        <div className="ml-auto flex items-center gap-2 relative" onClick={e => e.stopPropagation()} ref={menuRef}>
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {notes.length}
          </span>
          {!isUngrouped && (
            <>
              <button
                className={`p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 opacity-0 group-hover/gh:opacity-100 transition-opacity ${
                  menuOpen ? 'opacity-100 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
              >
                <MoreHorizontal size={15} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-32 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl flex flex-col gap-0.5 animate-in fade-in-0 zoom-in-95">
                  <button
                    className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setIsEditing(true); setMenuOpen(false); }}
                  >
                    重命名
                  </button>
                  <button
                    className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors flex items-center gap-1.5"
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
            <div className="px-6 py-2 text-xs text-slate-400 dark:text-slate-500">暂无笔记</div>
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
  const { confirm: confirmDelete } = useConfirmDialog();
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="笔记标题"
          className="flex-1 mr-4 text-xl font-bold border-none outline-none bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
        />
        <div className="flex items-center gap-2 shrink-0">
          <span
            title={saveStatus === 'saving' ? '保存中...' : '已自动保存'}
            className="p-1.5 rounded-lg text-indigo-500 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40"
          >
            <Cloud
              size={18}
              className={`transition-all duration-300 ${saveStatus === 'saving' ? 'opacity-50 animate-pulse' : 'opacity-100'}`}
            />
          </span>
          <div className="relative" ref={menuRef}>
            <button
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <MoreHorizontal size={20} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 min-w-36 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl flex flex-col gap-0.5 animate-in fade-in-0 zoom-in-95">
                <button
                  className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => { setMenuOpen(false); onPin(note); }}
                >
                  {note.isPinned ? '取消置顶' : '置顶'}
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => { setMenuOpen(false); onDuplicate(note); }}
                >
                  创建副本
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => { setMenuOpen(false); onSaveAsTemplate(note); }}
                >
                  保存为模板
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => { setMenuOpen(false); handleImport(); }}
                >
                  导入MD
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => { setMenuOpen(false); handleExport(); }}
                >
                  导出MD
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
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
          className="flex-1 overflow-y-auto p-4"
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
          className="absolute inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-2xs z-20 transition-opacity"
          onClick={() => onClose()}
        />
      )}
      <div
        className={`absolute top-0 bottom-0 z-30 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transition-all duration-300 ease-out ${
          isOpen ? 'right-0' : '-right-full'
        }`}
        style={{ width: drawerWidth }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-indigo-500/40 transition-colors z-40"
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
// 5. Modal Components (FolderModal, AddListModal, ListSettingsModal, BatchExportModal)
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
      title={initialData ? '编辑文件夹' : '添加文件夹'}
      onClose={onClose}
      footer={
        <>
          <button
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSave}
            disabled={!name.trim()}
          >
            {initialData ? '保存' : '添加'}
          </button>
        </>
      }
    >
      <div className="pt-2">
        <div className="flex items-center gap-2.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
          <FolderIcon size={18} className="text-amber-500 shrink-0" />
          <input
            type="text"
            placeholder="文件夹名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full bg-transparent border-none outline-none text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
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
      title={initialData ? '编辑清单' : '添加清单'}
      onClose={onClose}
      footer={
        <>
          <button
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleAdd}
            disabled={!name.trim()}
          >
            {initialData ? '保存' : '添加'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
          <BookOpen size={18} className="text-indigo-500 shrink-0" />
          <input
            type="text"
            placeholder="清单名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full bg-transparent border-none outline-none text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">颜色主题</label>
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full cursor-pointer border-2 transition-transform hover:scale-110 ${
                color === 'none' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-300 dark:border-slate-600'
              }`}
              style={{ background: 'transparent' }}
              onClick={() => setColor('none')}
            />
            {COLORS.map(c => (
              <div
                key={c}
                className={`w-6 h-6 rounded-full cursor-pointer border-2 transition-transform hover:scale-110 ${
                  color === c ? 'border-slate-900 dark:border-white ring-2 ring-indigo-500/30' : 'border-transparent'
                }`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">视图模式</label>
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewType === 'list' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs' : 'text-slate-600 dark:text-slate-400'
              }`}
              onClick={() => setViewType('list')}
            >
              <LayoutList size={14} />
              <span>列表</span>
            </button>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewType === 'board' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs' : 'text-slate-600 dark:text-slate-400'
              }`}
              onClick={() => setViewType('board')}
            >
              <Columns size={14} />
              <span>看板</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between relative">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">所属文件夹</label>
          <div className="relative flex-1 max-w-[220px]" ref={dropdownRef}>
            <button
              type="button"
              className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200"
              onClick={() => setIsFolderDropdownOpen(!isFolderDropdownOpen)}
            >
              <span>{getFolderDisplay()}</span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>

            {isFolderDropdownOpen && (
              <div className="absolute top-full right-0 mt-1.5 z-50 w-full p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                <button
                  type="button"
                  className="flex items-center justify-between px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => { setFolderId(null); setIsFolderDropdownOpen(false); }}
                >
                  <span>无</span>
                  {folderId === null && <Check size={14} className="text-indigo-500" />}
                </button>
                {folders.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    className="flex items-center justify-between px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    onClick={() => { setFolderId(f.id); setIsFolderDropdownOpen(false); }}
                  >
                    <span>{f.name}</span>
                    {folderId === f.id && <Check size={14} className="text-indigo-500" />}
                  </button>
                ))}
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 px-2 py-1">
                  <Plus size={14} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="新建文件夹..."
                    className="w-full bg-transparent border-none outline-none text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
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
      title="清单设置"
      onClose={onClose}
      width="460px"
      zIndex={1000}
      footer={
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="px-5 py-2 rounded-xl text-sm font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
        >
          完成
        </button>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">笔记弹出方式</label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            选择点击笔记列表条目时的打开方式。设置将自动保存并同步至数据库。
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => handleSelectMode('sidebar')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-2 ${
                openMode === 'sidebar'
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <Sidebar size={20} className={openMode === 'sidebar' ? 'text-indigo-500' : 'text-slate-400'} />
                {openMode === 'sidebar' && <Check size={16} className="text-indigo-500" />}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">侧边栏弹出</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">在主界面右侧滑出抽屉编辑</div>
              </div>
            </div>

            <div
              onClick={() => handleSelectMode('window')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-2 ${
                openMode === 'window'
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <ExternalLink size={20} className={openMode === 'window' ? 'text-indigo-500' : 'text-slate-400'} />
                {openMode === 'window' && <Check size={16} className="text-indigo-500" />}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">新窗口弹出</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">在独立的窗口中多任务并发编辑</div>
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
      zIndex={100}
      footer={
        <>
          <button
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleConfirm}
            disabled={selectedIds.size === 0 || notes.length === 0}
          >
            导出选中的笔记 ({selectedIds.size})
          </button>
        </>
      }
    >
      <div className="overflow-y-auto max-h-[50vh] space-y-1">
        {notes.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">当前清单暂无笔记。</div>
        ) : (
          <>
            <label className="flex items-center gap-3 px-3 py-2 border-b border-slate-100 dark:border-slate-800 cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-200 select-none">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded-md accent-indigo-600 cursor-pointer"
              />
              <span>全选 ({notes.length})</span>
            </label>
            <div className="pt-1 space-y-1">
              {notes.map(note => {
                const isChecked = selectedIds.has(note.id);
                return (
                  <label
                    key={note.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer select-none transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleNote(note.id)}
                      className="w-4 h-4 rounded-md accent-indigo-600 cursor-pointer"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
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
          showToast(`已成功移动笔记到清单「${targetList.name}」`);
        }
        return;
      }

      if (overData?.type === 'folder' || folderIdSet.has(overId)) {
        const folderId = overId;
        const folderLists = lists.filter(l => l.folderId === folderId);
        if (folderLists.length > 0) {
          const targetList = folderLists[0];
          moveNoteToList(activeId, targetList.id);
          showToast(`已成功移动笔记到清单「${targetList.name}」`);
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
      <section className="flex h-full w-full bg-white dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100">
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
          className="flex-1 flex flex-col bg-white dark:bg-slate-950 relative overflow-hidden"
          onClick={() => setListMenuOpen(false)}
        >
          {activeList ? (
            <>
              <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
                <div className="flex items-center gap-3 font-bold text-xl text-slate-900 dark:text-slate-100">
                  <button
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    onClick={toggleSidebar}
                    title={isSidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
                  >
                    <MenuIcon isCollapsed={isSidebarCollapsed} />
                  </button>
                  <span>{activeList.name}</span>
                </div>
                <div className="flex items-center gap-4 text-slate-400 dark:text-slate-500">
                  <button className="p-1.5 rounded-lg hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                    <ArrowDownUp size={18} />
                  </button>
                  <div className="relative">
                    <button
                      className="p-1.5 rounded-lg hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); setListMenuOpen(!listMenuOpen); }}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {listMenuOpen && (
                      <div className="absolute right-0 top-full mt-2 z-20 min-w-44 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl flex flex-col gap-0.5 animate-in fade-in-0 zoom-in-95">
                        <div className="group/sub relative">
                          <button className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between">
                            <span>笔记打开方式</span>
                            <ChevronRight size={14} className="text-slate-400" />
                          </button>

                          <div className="hidden group-hover/sub:flex absolute right-full top-0 mr-1 min-w-40 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl flex-col gap-0.5">
                            <button
                              className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
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
                              {getNoteOpenMode() === 'sidebar' && <Check size={14} className="text-indigo-600 dark:text-indigo-400" />}
                            </button>

                            <button
                              className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
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
                              {getNoteOpenMode() === 'window' && <Check size={14} className="text-indigo-600 dark:text-indigo-400" />}
                            </button>
                          </div>
                        </div>

                        <button
                          className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          onClick={() => { handleAddGroupClick(); setListMenuOpen(false); }}
                        >
                          新建分组
                        </button>
                        <button
                          className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          onClick={() => { handleBatchImport(); setListMenuOpen(false); }}
                        >
                          批量导入MD
                        </button>
                        <button
                          className="w-full text-left px-3 py-1.5 text-xs rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 mb-6 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                  <Plus size={18} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="添加笔记..."
                    value={newNoteTitle}
                    onChange={e => setNewNoteTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddNote();
                    }}
                    className="w-full bg-transparent border-none outline-none text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                  />
                </div>

                {notes.length === 0 && !isAddingGroup ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                    暂无笔记
                  </div>
                ) : (
                  <div className="flex flex-col pb-8">
                    {isAddingGroup && (
                      <div className="mb-4">
                        <input
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
                          className="text-sm font-semibold border border-indigo-500 bg-white dark:bg-slate-900 outline-none rounded-lg px-3 py-1.5 text-slate-900 dark:text-slate-100 shadow-xs"
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
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
              请在左侧选择或创建一个清单
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
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900/90 dark:bg-slate-100/90 text-white dark:text-slate-900 shadow-2xl backdrop-blur-md border border-slate-800 dark:border-slate-200 text-sm font-medium transition-all duration-300 ${
                t.isFadingOut ? 'opacity-0 translate-y-2' : 'animate-in slide-in-from-bottom-4'
              }`}
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
