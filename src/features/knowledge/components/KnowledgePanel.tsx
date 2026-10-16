import React, { useState, useEffect, useMemo, useRef, type ReactNode, memo, startTransition } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { createPortal } from 'react-dom';
import {
  MoreHorizontal, Plus, PanelLeftClose, PanelLeftOpen, Search,
  ChevronDown, FileText, Cloud, LoaderCircle,
  Folder as FolderIcon, Library, Maximize2, ExternalLink, Upload,
  Check, PanelRight, LayoutTemplate,
} from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverEvent, useDroppable } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useKnowledgeFolderContents, useKnowledgeData, useKnowledgeActions, type KnowledgeQueryData } from '../hooks/useKnowledgeQuery';
import { sortKnowledgeFolders, sortKnowledgeBases, getNotesByFolderId, getNoteGroups } from '../utils/knowledgeSelectors';
import { KnowledgeFolder, KnowledgeBase, Note, NoteGroup, KnowledgeTemplate } from '../types';

import { TemplateModal, useTemplateData, useTemplateActions } from './KnowledgeTemplateDialog';
import { useKnowledgeUiStore } from '../stores/knowledgeUiStore';
import * as knowledgeService from '../api/knowledgeService';
import { extractTitleFromMarkdown } from '../api/markdownIo';
import {
  openStandaloneNoteWindow,
  focusStandaloneNoteWindow,
  closeStandaloneNoteWindow,
  getActiveStandaloneNoteIds,
  isTauriEnv,
} from '../utils/noteWindowManager';
import { FullNoteEditor } from './FullNoteEditor';
import { logSilent } from '@/lib/syncEngine';
import { computeNoteReorder, computeKnowledgeFolderReorder } from '../utils/knowledgeReorder';
import {
  ReactjsTiptapEditor,
  convertMarkdownToTipTapJson,
  convertTipTapJsonToMarkdown,
} from '@/components/ui/reactjs-tiptap-editor';
import { Popconfirm } from '@/components/ui/popconfirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useAuth } from "@/features/auth";
import { useUiStore } from '@/stores/uiStore';
import { queryKeys } from '@/lib/syncEngine';
import { useAppThemeStyle } from '@/hooks/useAppThemeStyle';
import {
  PixelScroll,
  PixelFeather,
  PixelBookOpen,
  PixelLibrary,
  PixelFolder,
  PixelSparkle,
  PixelHourglass,
} from '@/components/pixel/PixelIcons';

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
  list: KnowledgeFolder;
  activeListId: string | null;
  dragOverListId?: string | null;
  onSelectList: (id: string) => void;
  isNested: boolean;
  isPixelTheme?: boolean;
  children: ReactNode;
}

const SidebarListItemDroppable: React.FC<SidebarListItemDroppableProps> = memo(({ list, activeListId, dragOverListId, onSelectList, isNested, isPixelTheme, children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `sidebar-list-${list.id}`,
    data: { type: 'sidebar-list', folderId: list.id }
  });
  const isTarget = isOver || dragOverListId === list.id;
  const isActive = activeListId === list.id;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group relative flex cursor-pointer select-none items-center gap-2 px-2 py-1.5 text-sm transition-all duration-100',
        isNested
          ? (isPixelTheme ? 'pl-8' : 'pl-9')
          : (isPixelTheme ? 'pl-6.5' : 'pl-7'),
        isActive
          ? (isPixelTheme
              ? 'bg-amber-200/95 text-amber-950 dark:bg-amber-900/80 dark:text-amber-100 font-mono font-bold shadow-[2px_2px_0px_#000] border-2 border-amber-800/90 dark:border-amber-500 rounded-xs'
              : 'bg-sidebar-primary/15 font-medium text-sidebar-primary rounded-md')
          : (isPixelTheme
              ? 'text-sidebar-foreground hover:bg-amber-100/60 dark:hover:bg-amber-950/40 hover:text-amber-900 dark:hover:text-amber-100 font-mono rounded-xs active:translate-x-[1px] active:translate-y-[1px]'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md'),
        isTarget && (isPixelTheme ? 'bg-amber-200/30 ring-2 ring-amber-500' : 'bg-sidebar-primary/10 ring-2 ring-sidebar-ring')
      )}
      onClick={() => onSelectList(list.id)}
    >
      {/* Retro Pixel Active Indicator */}
      {isPixelTheme && isActive && (
        <span
          className={cn(
            "absolute top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none select-none",
            isNested ? "left-4" : "left-1.5"
          )}
          aria-hidden="true"
        >
          <span className="text-amber-800 dark:text-amber-400 text-[8px] leading-none font-mono font-black animate-pixel-hop block">
            ▶
          </span>
        </span>
      )}
      {children}
    </div>
  );
});

// ============================================================================
// 2. ListsSidebar Component
// ============================================================================
interface ListsSidebarProps {
  lists: KnowledgeFolder[];
  folders: KnowledgeBase[];
  activeListId: string | null;
  loadingListId?: string | null;
  dragOverListId?: string | null;
  dragOverFolderId?: string | null;
  onSelectList: (id: string) => void;
  onAddClick: (knowledgeBaseId?: string) => void;
  onEditFolder: (folder: KnowledgeBase) => void;
  onDissolveFolder: (folder: KnowledgeBase) => void;
  onEditList: (list: KnowledgeFolder) => void;
  onDuplicateList: (list: KnowledgeFolder) => void;
  onDeleteList: (list: KnowledgeFolder) => void;
  isCollapsed?: boolean;
  isPixelTheme?: boolean;
}

function ListsSidebar({
  lists,
  folders,
  activeListId,
  loadingListId,
  dragOverListId,
  dragOverFolderId,
  onSelectList,
  onAddClick,
  onEditFolder,
  onDissolveFolder,
  onEditList,
  onDuplicateList,
  onDeleteList,
  isCollapsed,
  isPixelTheme,
}: ListsSidebarProps) {
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (knowledgeBaseId: string) => {
    setCollapsedFolders(prev => ({
      ...prev,
      [knowledgeBaseId]: !prev[knowledgeBaseId]
    }));
  };

  const folderIdSet = useMemo(() => new Set(folders.map(f => f.id)), [folders]);
  const standaloneLists = useMemo(() => lists.filter(l => !l.knowledgeBaseId || !folderIdSet.has(l.knowledgeBaseId)), [lists, folderIdSet]);
  const listsByFolder = useMemo(() => {
    const acc: Record<string, KnowledgeFolder[]> = {};
    folders.forEach(f => {
      acc[f.id] = lists.filter(l => l.knowledgeBaseId === f.id);
    });
    return acc;
  }, [folders, lists]);

  const renderSidebarItem = (list: KnowledgeFolder, isNested: boolean) => (
    <SortableItem key={list.id} id={list.id}>
      <SidebarListItemDroppable
        list={list}
        activeListId={activeListId}
        dragOverListId={dragOverListId}
        onSelectList={onSelectList}
        isNested={isNested}
        isPixelTheme={isPixelTheme}
      >
        {isPixelTheme ? (
          <PixelFolder size={14} className="shrink-0 text-amber-700 dark:text-amber-400" />
        ) : (
          <FolderIcon size={14} className="shrink-0 text-muted-foreground" />
        )}
        <span className="truncate flex-1">{list.name}</span>

        <div className="ml-auto flex items-center gap-1">
          {loadingListId === list.id && (
            <LoaderCircle size={14} className="animate-spin text-sidebar-primary" aria-label="正在加载文件夹" />
          )}
          <div className="relative ml-auto" onClick={e => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("opacity-0 group-hover:opacity-100 transition-opacity", isPixelTheme ? "rounded-xs" : "rounded-md")}
                >
                  <MoreHorizontal size={15} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-30">
                <DropdownMenuItem onClick={() => onEditList(list)}>
                  编辑
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicateList(list)}>
                  复制
                </DropdownMenuItem>
                <Popconfirm
                  title={`确定要删除文件夹 "${list.name}" 吗？`}
                  description="其中的笔记也会被删除。"
                  okText="删除"
                  cancelText="取消"
                  okType="danger"
                  position="right"
                  onOk={() => onDeleteList(list)}
                >
                  <DropdownMenuItem destructive closeOnClick={false}>
                    删除
                  </DropdownMenuItem>
                </Popconfirm>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </SidebarListItemDroppable>
    </SortableItem>
  );

  const isTargetStandalone = dragOverFolderId === 'standalone-area';

  return (
      <aside
        className={cn(
          'flex w-[210px] flex-none flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground transition-all duration-[220ms]',
          isPixelTheme
            ? 'border-r-2 border-border font-mono [transition-timing-function:steps(4,jump-none)]'
            : 'border-border ease-in-out',
          isCollapsed && 'pointer-events-none !w-0 border-r-transparent opacity-0'
        )}
      >
        <div className={cn(
          "group/header flex h-12 shrink-0 items-center justify-between border-b px-3 text-sm font-semibold select-none",
          isPixelTheme ? "border-b-2 border-border" : "border-border"
        )}>
          <div className="flex items-center text-base font-bold text-sidebar-foreground">
            <span>{isPixelTheme ? "📜 知识宝典" : "知识库"}</span>
          </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "text-sidebar-foreground opacity-0 transition-opacity hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-hover/header:opacity-100",
            isPixelTheme ? "rounded-xs active:translate-x-[1px] active:translate-y-[1px]" : "rounded-md"
          )}
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
            const containsActiveList = folderLists.some((list) => list.id === activeListId);

            return (
              <div key={folder.id} className="flex flex-col gap-0.5">
                <SortableItem id={folder.id}>
                  <DroppableArea
                    id={folder.id}
                    data={{ type: 'folder' }}
                    className={cn(
                      'group relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      containsActiveList && 'font-medium text-sidebar-primary',
                      isTarget && 'bg-sidebar-primary/10 ring-2 ring-sidebar-ring'
                    )}
                    onClick={() => toggleFolder(folder.id)}
                  >
                    <ChevronDown
                      size={14}
                      className={cn(
                        'text-sidebar-foreground/60 transition-transform duration-150',
                        isPixelTheme ? '[transition-timing-function:steps(2,jump-none)]' : 'ease-in-out',
                        isCollapsedFolder && '-rotate-90'
                      )}
                    />
                    <span className="flex-1 truncate">{folder.name}</span>

                    <div className="relative ml-auto" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-md text-sidebar-foreground opacity-0 transition-opacity hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-hover:opacity-100"
                          >
                            <MoreHorizontal size={15} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-30">
                          <DropdownMenuItem onClick={() => onAddClick(folder.id)}>
                            添加文件夹
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEditFolder(folder)}>
                            编辑
                          </DropdownMenuItem>
                          <Popconfirm
                            title={`确定要删除知识库 "${folder.name}" 吗？`}
                            description="其中的文件夹和笔记也会被删除。"
                            okText="解散"
                            cancelText="取消"
                            okType="danger"
                            position="right"
                            onOk={() => onDissolveFolder(folder)}
                          >
                            <DropdownMenuItem destructive closeOnClick={false}>
                              解散
                            </DropdownMenuItem>
                          </Popconfirm>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
  );
}

// ============================================================================
// 3. NoteItem & NoteGroupView Components
// ============================================================================
interface NoteItemProps {
  note: Note;
  onClick: () => void;
  onDuplicate: (note: Note) => void;
  onDelete: (note: Note) => void;
  onOpenWindow?: (note: Note) => void;
  onOpenMode?: (note: Note, mode: 'drawer' | 'full' | 'window') => void;
  isPixelTheme?: boolean;
}

function NoteItem({ note, onClick, onDuplicate, onDelete, onOpenWindow, onOpenMode, isPixelTheme }: NoteItemProps) {
  const isStandalone = useKnowledgeUiStore((state) => state.standaloneNoteIds.includes(note.id));

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 border transition-all duration-200 mb-2.5 cursor-pointer text-card-foreground select-none",
        isPixelTheme
          ? "bg-card border-2 border-border/90 hover:bg-amber-50/70 dark:hover:bg-amber-950/40 rounded-xs px-4 py-2.5 shadow-[3px_3px_0px_rgba(0,0,0,0.1)] hover:shadow-[4px_4px_0px_rgba(217,119,6,0.3)] hover:-translate-x-0.5 hover:-translate-y-0.5 font-mono"
          : "bg-card border-border hover:border-muted-foreground/30 rounded-lg px-4 py-3 hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)]",
        isStandalone && (isPixelTheme ? "border-amber-500/80 bg-amber-50/20" : "border-primary/40 bg-accent/20")
      )}
      onClick={onClick}
    >
      {isPixelTheme ? (
        <PixelScroll size={16} className="shrink-0" />
      ) : (
        <FileText size={16} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      )}
      <div className={cn("flex-1 min-w-0 flex items-center gap-2", isPixelTheme ? "font-mono font-bold text-sm text-foreground" : "text-sm font-medium text-foreground")}>
        <span className="truncate">{note.title || (isPixelTheme ? '📜 无标题卷轴' : '无标题笔记')}</span>
        {isStandalone && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full select-none shrink-0 font-normal transition-colors",
              isPixelTheme
                ? "bg-amber-200/90 text-amber-900 border border-amber-800/40 font-mono text-[10px]"
                : "bg-primary/10 text-primary border border-primary/20"
            )}
            title="该笔记正在独立窗口中编辑"
          >
            <ExternalLink size={10} className="stroke-[2.5]" />
            <span>独立窗口</span>
          </span>
        )}
      </div>

      <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={isPixelTheme ? "rounded-xs" : "rounded-lg"}
            >
              <MoreHorizontal size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36">
            <DropdownMenuItem onClick={() => onDuplicate(note)}>
              创建副本
            </DropdownMenuItem>
            {onOpenMode ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <LayoutTemplate size={14} />
                  <span>打开方式</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-36">
                  <DropdownMenuItem onClick={() => onOpenMode(note, 'drawer')}>
                    <PanelRight size={14} className="mr-1.5" />
                    <span>侧边抽屉</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onOpenMode(note, 'full')}>
                    <Maximize2 size={14} className="mr-1.5" />
                    <span>主区域铺满</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onOpenMode(note, 'window')}>
                    <ExternalLink size={14} className="mr-1.5" />
                    <span>独立窗口</span>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : onOpenWindow ? (
              <DropdownMenuItem onClick={() => onOpenWindow(note)}>
                <ExternalLink size={14} className="mr-2" />
                在独立窗口打开
              </DropdownMenuItem>
            ) : null}
            <Popconfirm
              title={`确定要删除笔记 "${note.title || '未命名笔记'}" 吗？`}
              okText="删除"
              cancelText="取消"
              okType="danger"
              position="bottomRight"
              onOk={() => onDelete(note)}
            >
              <DropdownMenuItem destructive closeOnClick={false}>
                删除
              </DropdownMenuItem>
            </Popconfirm>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

interface NoteGroupViewProps {
  group: { id: string; folderId: string; name: string };
  notes: Note[];
  isUngrouped?: boolean;
  isDragOverTarget?: boolean;
  isPixelTheme?: boolean;
  onRenameGroup: (id: string, newName: string) => void;
  onDeleteGroup: (id: string) => void;
  onNoteClick: (note: Note) => void;
  onDuplicateNote: (note: Note) => void;
  onDeleteNote: (note: Note) => void;
  onOpenNoteWindow?: (note: Note) => void;
  onOpenNoteMode?: (note: Note, mode: 'drawer' | 'full' | 'window') => void;
}

function NoteGroupView({ group, notes, isUngrouped, isDragOverTarget, isPixelTheme, onRenameGroup, onDeleteGroup, onNoteClick, onDuplicateNote, onDeleteNote, onOpenNoteWindow, onOpenNoteMode }: NoteGroupViewProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef } = useDroppable({
    id: group.id,
    data: { type: 'group' }
  });

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
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
      className={cn(
        "mb-5 border p-3 transition-all",
        isPixelTheme
          ? "rounded-xs border-2 border-border/80 bg-amber-50/30 dark:bg-amber-950/20 shadow-[2px_2px_0px_rgba(0,0,0,0.06)] font-mono"
          : "rounded-lg border-border/60 bg-muted/30",
        isDragOverTarget && (isPixelTheme ? "ring-2 ring-amber-500 bg-amber-100/40" : "ring-2 ring-ring bg-accent/30")
      )}
    >
      <div
        className={cn(
          "group/gh flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors select-none",
          isPixelTheme ? "rounded-xs hover:bg-amber-100/60 dark:hover:bg-amber-900/30 font-mono" : "rounded-md hover:bg-muted"
        )}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <ChevronDown
          size={14}
          className={cn('text-muted-foreground transition-transform duration-200', isCollapsed && '-rotate-90')}
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
            className={cn(
              "text-sm font-semibold border bg-card outline-none px-2 py-0.5 text-foreground",
              isPixelTheme ? "border-2 border-amber-600 rounded-xs font-mono" : "border-primary rounded-md"
            )}
          />
        ) : (
          <span className={cn("text-sm font-semibold text-foreground", isPixelTheme && "font-mono font-bold")}>{group.name}</span>
        )}

        <div className="ml-auto flex items-center gap-2 relative" onClick={e => e.stopPropagation()}>
          <span className={cn(
            "text-xs font-medium px-2 py-0.5",
            isPixelTheme
              ? "font-mono font-bold rounded-xs bg-amber-200/80 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100 border border-amber-900/30 shadow-[1px_1px_0px_rgba(0,0,0,0.1)]"
              : "rounded-full text-muted-foreground bg-muted"
          )}>
            {notes.length}
          </span>
          {!isUngrouped && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={isPixelTheme ? "rounded-xs" : "rounded-md"}
                >
                  <MoreHorizontal size={15} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-32">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  重命名
                </DropdownMenuItem>
                <Popconfirm
                  title={`确定要删除分组 "${group.name}" 吗？`}
                  description="分组内的笔记将被移至未分组。"
                  okText="删除"
                  cancelText="取消"
                  okType="danger"
                  position="left"
                  onOk={() => onDeleteGroup(group.id)}
                >
                  <DropdownMenuItem destructive closeOnClick={false}>
                    删除
                  </DropdownMenuItem>
                </Popconfirm>
              </DropdownMenuContent>
            </DropdownMenu>
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
                    isPixelTheme={isPixelTheme}
                    onClick={() => onNoteClick(note)}
                    onDuplicate={onDuplicateNote}
                    onDelete={onDeleteNote}
                    onOpenWindow={onOpenNoteWindow}
                    onOpenMode={onOpenNoteMode}
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
  onFlush: (id: string) => Promise<void>;
  onDuplicate: (note: Note) => void;
  onSaveAsTemplate: (note: Note) => void;
  onDelete: (note: Note) => void;
  onOpenTemplate?: () => void;
  onSwitchToFull?: () => void;
  onOpenStandaloneWindow?: () => void;
  autoFocusEditor?: boolean;
  isPixelTheme?: boolean;
}

function NoteDrawerContent({
  note,
  isOpen,
  onClose,
  onUpdate,
  onFlush,
  onDuplicate,
  onSaveAsTemplate,
  onDelete,
  onSwitchToFull,
  onOpenStandaloneWindow,
  autoFocusEditor,
  isPixelTheme,
}: {
  note: Note;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, title: string, content: string) => void;
  onFlush: (id: string) => Promise<void>;
  onDuplicate: (note: Note) => void;
  onSaveAsTemplate: (note: Note) => void;
  onDelete: (note: Note) => void;
  onSwitchToFull?: () => void;
  onOpenStandaloneWindow?: () => void;
  autoFocusEditor?: boolean;
  isPixelTheme?: boolean;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content || '');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

  const isDirtyRef = useRef(false);
  const wasOpenRef = useRef(isOpen);
  const activeEditingNoteIdRef = useRef(note.id);
  const latestDataRef = useRef({ title: note.title, content: note.content || '', note, contentLoaded: note.contentLoaded === true });
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    if (activeEditingNoteIdRef.current !== note.id) {
      activeEditingNoteIdRef.current = note.id;
      setTitle(note.title);
      setContent(note.content || '');
      setSaveStatus('saved');
      isDirtyRef.current = false;
      latestDataRef.current = { title: note.title, content: note.content || '', note, contentLoaded: note.contentLoaded === true };
    } else if (!isDirtyRef.current) {
      setTitle(note.title);
      setContent(note.content || '');
      latestDataRef.current = { title: note.title, content: note.content || '', note, contentLoaded: note.contentLoaded === true };
    }
  }, [note.id, note.title, note.content]);

  useEffect(() => {
    latestDataRef.current = { title, content, note, contentLoaded: note.contentLoaded === true };
  }, [title, content, note]);

  useEffect(() => {
    return () => {
      if (isDirtyRef.current) {
        const { note: currentNote, title: currentTitle, content: currentContent, contentLoaded } = latestDataRef.current;
        if (currentNote && contentLoaded) {
          isDirtyRef.current = false;
          onUpdateRef.current(currentNote.id, currentTitle, currentContent);
          void onFlush(currentNote.id);
        }
      }
    };
  }, []);

  // The drawer stays mounted while it animates off-screen. Closing therefore
  // clears the UI debounce without unmounting the component; explicitly
  // commit and drain the final draft before the parent can tear down.
  useEffect(() => {
    if (wasOpenRef.current && !isOpen && isDirtyRef.current) {
      const { note: currentNote, title: currentTitle, content: currentContent, contentLoaded } = latestDataRef.current;
      if (contentLoaded) {
        isDirtyRef.current = false;
        onUpdateRef.current(currentNote.id, currentTitle, currentContent);
        void onFlush(currentNote.id);
      }
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, onFlush]);

  useEffect(() => {
    if (!isOpen || note.contentLoaded !== true) return;
    if (title !== note.title || content !== note.content) {
      isDirtyRef.current = true;
      setSaveStatus('saving');
      const timer = setTimeout(() => {
        isDirtyRef.current = false;
        onUpdateRef.current(note.id, title, content);
        setSaveStatus('saved');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [title, content, note.id, note.title, note.content, isOpen]);

  const handleImport = async () => {
    const imported = await knowledgeService.pickMarkdownFile();
    if (imported) {
      const jsonStr = convertMarkdownToTipTapJson(imported.content);
      setContent(jsonStr);
      if (imported.title) {
        setTitle(imported.title);
      }
      toast.success('导入成功！');
    }
  };

  const handleExport = async () => {
    try {
      const exportText = convertTipTapJsonToMarkdown(content);
      await knowledgeService.saveMarkdownFile(`${title || (isPixelTheme ? '未命名卷轴' : '未命名笔记')}.md`, exportText);
      toast.success('导出成功！');
    } catch (err) {
      logSilent('noteDrawer', 'note export failed', err);
      toast.error('导出失败，请检查文件权限后重试。');
    }
  };

  return (
    <>
      <div className={cn(
        "flex h-12 items-center justify-between border-b px-4 shrink-0",
        isPixelTheme ? "border-b-2 border-border/90 bg-card font-mono" : "border-border"
      )}>
        <Input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={isPixelTheme ? "卷轴标题..." : "笔记标题"}
          className={cn(
            "flex-1 mr-4 text-xl font-bold border-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-auto",
            isPixelTheme && "font-mono font-bold text-amber-950 dark:text-amber-100"
          )}
        />
        <div className="flex items-center gap-2 shrink-0">
          <span
            title={saveStatus === 'saving' ? '保存中...' : '已自动保存'}
            aria-live="polite"
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-xs transition-all",
              isPixelTheme
                ? (saveStatus === 'saving'
                    ? 'bg-amber-100 text-amber-900 border border-amber-900/40 rounded-xs font-mono font-bold'
                    : 'bg-amber-200/90 text-amber-950 dark:bg-amber-900/60 dark:text-amber-100 border border-amber-900/40 rounded-xs font-mono font-bold')
                : 'rounded-lg bg-primary/10 text-primary'
            )}
          >
            {isPixelTheme ? (
              saveStatus === 'saving' ? <PixelHourglass size={14} className="animate-spin" /> : <PixelSparkle size={14} />
            ) : (
              <Cloud
                size={18}
                className={cn('transition-all duration-300', saveStatus === 'saving' ? 'opacity-50 animate-pulse' : 'opacity-100')}
              />
            )}
            <span>
              {isPixelTheme
                ? (saveStatus === 'saving' ? '刻印中' : '已封印')
                : (saveStatus === 'saving' ? '保存中' : '已保存')}
            </span>
          </span>
          {onSwitchToFull && (
            <Button
              variant="ghost"
              size="icon"
              className={isPixelTheme ? "rounded-xs" : "rounded-lg"}
              onClick={onSwitchToFull}
              title="铺满主内容区"
            >
              <Maximize2 size={16} />
            </Button>
          )}
          {onOpenStandaloneWindow && (
            <Button
              variant="ghost"
              size="icon"
              className={isPixelTheme ? "rounded-xs" : "rounded-lg"}
              onClick={onOpenStandaloneWindow}
              title="在独立窗口中打开"
            >
              <ExternalLink size={16} />
            </Button>
          )}
          <div className="relative">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={isPixelTheme ? "rounded-xs" : "rounded-lg"}
                >
                  <MoreHorizontal size={20} />
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
                  导入MD
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport}>
                  导出MD
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <LayoutTemplate size={14} />
                    <span>切换模式</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-36">
                    {onSwitchToFull && (
                      <DropdownMenuItem onClick={onSwitchToFull}>
                        <Maximize2 size={14} className="mr-1.5" />
                        <span>主区域铺满</span>
                      </DropdownMenuItem>
                    )}
                    {onOpenStandaloneWindow && (
                      <DropdownMenuItem onClick={onOpenStandaloneWindow}>
                        <ExternalLink size={14} className="mr-1.5" />
                        <span>独立窗口</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <Popconfirm
                  title={`确定要删除笔记 "${note.title || '未命名笔记'}" 吗？`}
                  okText="删除"
                  cancelText="取消"
                  okType="danger"
                  position="bottomRight"
                  onOk={() => {
                    onDelete(note);
                    onClose();
                  }}
                >
                  <DropdownMenuItem destructive closeOnClick={false}>
                    删除
                  </DropdownMenuItem>
                </Popconfirm>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div
        className="flex-1 flex flex-col p-0 overflow-hidden relative"
        onKeyDown={(e) => e.stopPropagation()}
      >
        <ReactjsTiptapEditor
          content={content}
          onChange={setContent}
          autofocus={autoFocusEditor ? 'start' : undefined}
          placeholder={isPixelTheme ? "📜 展开羊皮纸卷轴，开始书写魔法笔记..." : "开始撰写笔记，或输入 / 使用命令..."}
        />
      </div>
    </>
  );
}

function NoteDrawer({
  note,
  isOpen,
  isLoading,
  onClose,
  onUpdate,
  onFlush,
  onDuplicate,
  onSaveAsTemplate,
  onDelete,
  onSwitchToFull,
  onOpenStandaloneWindow,
  autoFocusEditor,
  isPixelTheme,
}: NoteDrawerProps & { isLoading?: boolean; isPixelTheme?: boolean }) {
  const [drawerWidth, setDrawerWidth] = useState(600);
  const isResizing = useRef(false);

  const handleMouseDown = () => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 320 && newWidth <= window.innerWidth * 0.8) {
      setDrawerWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = '';
  };

  if (!note && !isLoading) return null;

  return createPortal(
    <>
      {isOpen && (
        <div
          className="fixed bottom-0 left-[58px] right-0 top-[38px] z-[50] bg-black/30 backdrop-blur-2xs transition-opacity dark:bg-black/50 animate-in fade-in duration-200"
          onClick={() => onClose()}
        />
      )}
      <div
        className={cn(
          'fixed top-[38px] bottom-0 z-[60] bg-card text-card-foreground border-l shadow-2xl flex flex-col transition-all duration-300 ease-out',
          isPixelTheme ? 'border-l-2 border-border shadow-[-6px_0px_0px_rgba(0,0,0,0.12)] font-mono' : 'border-border',
          isOpen ? 'right-0' : '-right-full'
        )}
        style={{ width: drawerWidth }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary/40 transition-colors z-40"
          onMouseDown={handleMouseDown}
        />
        {note ? (
          <NoteDrawerContent
            key={note.id}
            note={note}
            isOpen={isOpen}
            onClose={onClose}
            onUpdate={onUpdate}
            onFlush={onFlush}
            onDuplicate={onDuplicate}
            onSaveAsTemplate={onSaveAsTemplate}
            onDelete={onDelete}
            onSwitchToFull={onSwitchToFull}
            onOpenStandaloneWindow={onOpenStandaloneWindow}
            autoFocusEditor={autoFocusEditor}
            isPixelTheme={isPixelTheme}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground font-mono">
            <LoaderCircle size={18} className="animate-spin" />
            正在加载卷轴正文…
          </div>
        )}
      </div>
    </>,
    document.body
  );
}

// ============================================================================
// 5. Modal Components (KnowledgeBaseModal, FolderModal, ListSettingsModal, BatchExportModal)
// ============================================================================
interface FolderModalProps {
  initialData?: KnowledgeBase;
  onClose: () => void;
  onSave: (name: string) => void;
}

function FolderModal({ initialData, onClose, onSave }: FolderModalProps) {
  const { isPixelTheme } = useAppThemeStyle();
  const [name, setName] = useState(initialData?.name || '');

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <Modal
      visible={true}
      title={
        <div className="flex items-center gap-2">
          {isPixelTheme ? <PixelLibrary size={18} /> : <Library size={18} className="text-primary shrink-0" />}
          <span className={isPixelTheme ? "font-mono font-bold" : ""}>
            {isPixelTheme
              ? (initialData ? '📜 编辑知识宝库' : '✨ 创建新知识宝库')
              : (initialData ? '编辑知识库' : '添加知识库')}
          </span>
        </div>
      }
      onCancel={onClose}
      onOk={handleSave}
      okText={isPixelTheme ? (initialData ? '刻印保存' : '建立宝库') : (initialData ? '保存' : '添加')}
      cancelText={isPixelTheme ? '放弃' : '取消'}
      okDisabled={!name.trim()}
      width={480}
    >
      <div className={cn("grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3 py-2", isPixelTheme && "font-mono")}>
        <label className="text-sm font-medium text-muted-foreground text-right">
          {isPixelTheme ? '宝库代号' : '知识库名称'}
        </label>
        <Input
          type="text"
          placeholder={isPixelTheme ? '输入知识宝库名称...' : '知识库名称'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="h-10"
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
        />
      </div>
    </Modal>
  );
}

interface AddListModalProps {
  folders: KnowledgeBase[];
  initialFolderId?: string;
  initialData?: KnowledgeFolder;
  onClose: () => void;
  onAdd: (data: { name: string; knowledgeBaseId: string | null }, newFolderName?: string) => void;
  onAddFolder: (name: string) => KnowledgeBase;
}

function AddListModal({ folders, initialFolderId, initialData, onClose, onAdd, onAddFolder }: AddListModalProps) {
  const { isPixelTheme } = useAppThemeStyle();
  const [name, setName] = useState(initialData?.name || '');
  const [knowledgeBaseId, setFolderId] = useState<string | null>(
    initialData?.knowledgeBaseId !== undefined ? initialData.knowledgeBaseId : (initialFolderId || null)
  );
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({ name, knowledgeBaseId });
  };

  const handleCreateNewFolder = () => {
    if (!newFolderName.trim()) return;
    const newFolder = onAddFolder(newFolderName.trim());
    setFolderId(newFolder.id);
    setNewFolderName('');
    setIsCreatingFolder(false);
    toast.success(`已创建新知识库「${newFolder.name}」`);
  };

  return (
    <Modal
      visible={true}
      title={
        <div className="flex items-center gap-2">
          {isPixelTheme ? <PixelFolder size={18} /> : <FolderIcon size={18} className="text-primary shrink-0" />}
          <span className={isPixelTheme ? "font-mono font-bold" : ""}>
            {isPixelTheme
              ? (initialData ? '📜 编辑卷轴文件夹' : '✨ 新建卷轴文件夹')
              : (initialData ? '编辑文件夹' : '添加文件夹')}
          </span>
        </div>
      }
      onCancel={onClose}
      onOk={handleAdd}
      okText={isPixelTheme ? (initialData ? '保存变更' : '新建文件夹') : (initialData ? '保存' : '添加')}
      cancelText={isPixelTheme ? '放弃' : '取消'}
      okDisabled={!name.trim()}
      width={500}
    >
      <div className={cn("flex flex-col gap-4 py-2", isPixelTheme && "font-mono")}>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground text-right">
            {isPixelTheme ? '文件夹名' : '文件夹名称'}
          </label>
          <Input
            type="text"
            placeholder={isPixelTheme ? '输入文件夹名称...' : '文件夹名称'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="h-10"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          />
        </div>

        <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground text-right">
            {isPixelTheme ? '所属宝库' : '所属知识库'}
          </label>
          <div className="flex items-center gap-2 min-w-0">
            <Select
              value={knowledgeBaseId || ""}
              onChange={(val) => setFolderId(val ? String(val) : null)}
              className="flex-1"
              placeholder={isPixelTheme ? "选择所属知识宝库" : "选择所属知识库"}
            >
              <Select.Option value="">{isPixelTheme ? "无 (独立卷轴文件夹)" : "无 (独立文件夹)"}</Select.Option>
              {folders.map((f) => (
                <Select.Option key={f.id} value={f.id}>
                  {f.name}
                </Select.Option>
              ))}
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreatingFolder(!isCreatingFolder)}
              className={cn("shrink-0", isPixelTheme && "rounded-xs font-mono text-xs")}
              title="新建所属知识库"
            >
              <Plus size={14} className="mr-1" />
              {isPixelTheme ? "新建宝库" : "新建库"}
            </Button>
          </div>
        </div>

        {isCreatingFolder && (
          <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3 bg-muted/40 p-2.5 rounded-md border border-border">
            <span className="text-xs font-medium text-muted-foreground text-right">
              {isPixelTheme ? "新宝库名称" : "新知识库"}
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder={isPixelTheme ? "输入新宝库名称..." : "输入新知识库名称..."}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="h-8 flex-1 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateNewFolder();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                disabled={!newFolderName.trim()}
                onClick={handleCreateNewFolder}
                className={cn("h-8 text-xs shrink-0", isPixelTheme && "rounded-xs font-mono font-bold bg-amber-500 hover:bg-amber-600 text-amber-950 border border-amber-900 shadow-[1px_1px_0px_#000]")}
              >
                确定创建
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

interface BatchExportModalProps {
  notes: Note[];
  onExport: (selectedNoteIds: string[]) => void;
  onClose: () => void;
}

function BatchExportModal({ notes, onExport, onClose }: BatchExportModalProps) {
  const { isPixelTheme } = useAppThemeStyle();
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
      toast.error('请至少选择一条笔记进行导出。');
      return;
    }
    onExport(Array.from(selectedIds));
  };

  const allSelected = selectedIds.size === notes.length && notes.length > 0;

  return (
    <Modal
      visible={true}
      title={
        <div className="flex items-center gap-2">
          {isPixelTheme ? <PixelScroll size={18} /> : <FileText size={18} className="text-primary shrink-0" />}
          <span className={isPixelTheme ? "font-mono font-bold" : ""}>
            {isPixelTheme ? "📜 批量导出魔法卷轴笔记" : "批量导出笔记"}
          </span>
        </div>
      }
      onCancel={onClose}
      onOk={handleConfirm}
      okText={isPixelTheme ? `导出选中卷轴 (${selectedIds.size})` : `导出选中的笔记 (${selectedIds.size})`}
      cancelText={isPixelTheme ? "放弃" : "取消"}
      okDisabled={selectedIds.size === 0 || notes.length === 0}
      width={500}
    >
      <div className={cn("overflow-y-auto max-h-[50vh] space-y-1 py-1", isPixelTheme && "font-mono")}>
        {notes.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {isPixelTheme ? "当前文件夹暂无卷轴笔记。" : "当前文件夹暂无笔记。"}
          </div>
        ) : (
          <>
            <label className={cn(
              "flex items-center gap-3 px-3 py-2 border-b border-border cursor-pointer text-sm font-semibold text-foreground select-none",
              isPixelTheme && "hover:bg-amber-50/40 dark:hover:bg-amber-950/20"
            )}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleToggleSelectAll}
                className={cn(
                  "size-4 cursor-pointer",
                  isPixelTheme ? "accent-amber-600 rounded-xs" : "rounded-md accent-primary"
                )}
              />
              <span>{isPixelTheme ? `全选卷轴 (${notes.length})` : `全选 (${notes.length})`}</span>
            </label>
            <div className="pt-1 space-y-1">
              {notes.map(note => {
                const isChecked = selectedIds.has(note.id);
                return (
                  <label
                    key={note.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 cursor-pointer select-none transition-colors",
                      isPixelTheme
                        ? "rounded-xs hover:bg-amber-100/60 dark:hover:bg-amber-950/40 text-foreground"
                        : "rounded-lg hover:bg-accent hover:text-accent-foreground text-foreground"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleNote(note.id)}
                      className={cn(
                        "size-4 cursor-pointer",
                        isPixelTheme ? "accent-amber-600 rounded-xs" : "rounded-md accent-primary"
                      )}
                    />
                    <span className="text-sm text-foreground truncate">
                      {note.title || (isPixelTheme ? '未命名卷轴' : '未命名笔记')}
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
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

const EMPTY_LISTS: KnowledgeFolder[] = [];
const EMPTY_FOLDERS: KnowledgeBase[] = [];
const EMPTY_NOTES: Note[] = [];
const EMPTY_NOTE_GROUPS: NoteGroup[] = [];

export function KnowledgePanel() {
  const { isPixelTheme } = useAppThemeStyle();
  const { userId } = useAuth();
  // Query-backed data + write actions (connected to knowledgeService Go backend)
  const { data } = useKnowledgeData();
  const rawLists = data?.lists ?? EMPTY_LISTS;
  const rawFolders = data?.folders ?? EMPTY_FOLDERS;
  const rawNotes = data?.notes ?? EMPTY_NOTES;
  const rawNoteGroups = data?.noteGroups ?? EMPTY_NOTE_GROUPS;

  const {
    moveNoteToList,
    reorderNotes,
    moveNoteAndReorder,
    reorderKnowledgeBases,
    reorderKnowledgeFolders,
    moveKnowledgeFolder,
    addFolder,
    updateFolder,
    deleteKnowledgeBase,
    addList,
    updateList,
    duplicateKnowledgeFolder,
    deleteKnowledgeFolder,
    addNote,
    updateNote,
    flushNote,
    deleteNote,
    addGroup,
    updateGroup,
    deleteGroup,
  } = useKnowledgeActions();
  const { addTemplate, updateTemplate, deleteTemplate } = useTemplateActions();

  const lists = useMemo(() => sortKnowledgeFolders(rawLists), [rawLists]);
  const folders = useMemo(() => sortKnowledgeBases(rawFolders), [rawFolders]);

  const knowledgeBaseIdSet = useMemo(() => new Set(folders.map(f => f.id)), [folders]);
  const listMap = useMemo(() => new Map(lists.map(l => [l.id, l])), [lists]);

  const activeListId = useUiStore((state) => state.activeListId);
  const setActiveListId = useUiStore((state) => state.setActiveListId);
  const isTemplateModalOpen = useKnowledgeUiStore((state) => state.isTemplateModalOpen);
  const setIsTemplateModalOpen = useKnowledgeUiStore((state) => state.setTemplateModalOpen);
  const { isFetching: isListContentsFetching } = useKnowledgeFolderContents(activeListId);
  const noteMap = useMemo(() => new Map(rawNotes.map(n => [n.id, n])), [rawNotes]);
  const templates = useTemplateData(isTemplateModalOpen).data ?? [];

  const notes = useMemo(() => {
    if (!activeListId) return [];
    return getNotesByFolderId(rawNotes, activeListId);
  }, [rawNotes, activeListId]);

  const noteGroups = useMemo(() => {
    if (!activeListId) return [];
    return getNoteGroups(rawNoteGroups, activeListId);
  }, [rawNoteGroups, activeListId]);

  const isSidebarCollapsed = useUiStore((state) => state.isSidebarCollapsed);
  const setIsSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed);

  const toggleSidebar = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
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



  // Note state
  const activeNoteId = useKnowledgeUiStore((state) => state.activeNoteId);
  const setActiveNoteId = useKnowledgeUiStore((state) => state.setActiveNoteId);
  const isDrawerOpen = useKnowledgeUiStore((state) => state.isDrawerOpen);
  const setIsDrawerOpen = useKnowledgeUiStore((state) => state.setDrawerOpen);
  const viewMode = useKnowledgeUiStore((state) => state.viewMode);
  const setViewMode = useKnowledgeUiStore((state) => state.setViewMode);
  const defaultOpenMode = useKnowledgeUiStore((state) => state.defaultOpenMode);
  const setDefaultOpenMode = useKnowledgeUiStore((state) => state.setDefaultOpenMode);
  const autoFocusEditor = useKnowledgeUiStore((state) => state.autoFocusEditor);
  const setAutoFocusEditor = useKnowledgeUiStore((state) => state.setAutoFocusEditor);
  const addStandaloneNoteId = useKnowledgeUiStore((state) => state.addStandaloneNoteId);
  const removeStandaloneNoteId = useKnowledgeUiStore((state) => state.removeStandaloneNoteId);
  const setStandaloneNoteIds = useKnowledgeUiStore((state) => state.setStandaloneNoteIds);
  const queryClient = useQueryClient();

  // Synchronize standalone note windows and IPC events
  useEffect(() => {
    if (!isTauriEnv()) return;

    // Initialize currently open standalone note windows
    void getActiveStandaloneNoteIds().then((ids) => {
      if (ids.length > 0) {
        setStandaloneNoteIds(ids);
      }
    });

    let unlistenUpdated: UnlistenFn | undefined;
    let unlistenWindowState: UnlistenFn | undefined;

    const setupListeners = async () => {
      try {
        unlistenUpdated = await listen<{
          id: string;
          title?: string;
          content?: string;
          lockVersion?: number;
          updatedAt?: number;
        }>('knowledge:note-updated', (event) => {
          const payload = event.payload;
          if (!payload?.id) return;

          // In-memory update of lists.all cache
          queryClient.setQueryData<KnowledgeQueryData>(queryKeys.lists.all(userId), (prev) => {
            if (!prev) return prev;
            const noteIndex = prev.notes.findIndex((n) => n.id === payload.id);
            if (noteIndex === -1) return prev;
            const updatedNotes = [...prev.notes];
            updatedNotes[noteIndex] = {
              ...updatedNotes[noteIndex],
              ...(payload.title !== undefined ? { title: payload.title } : {}),
              ...(payload.content !== undefined ? { content: payload.content, contentLoaded: true } : {}),
              ...(payload.lockVersion !== undefined ? { lockVersion: payload.lockVersion } : {}),
              updatedAt: payload.updatedAt ?? Date.now(),
            };
            return {
              ...prev,
              notes: updatedNotes,
            };
          });

          // Also update lists.contents cache for activeListId
          if (activeListId) {
            queryClient.setQueryData<{ noteGroups: NoteGroup[]; notes: Note[] }>(
              queryKeys.lists.contents(userId, activeListId),
              (prev) => {
                if (!prev) return prev;
                const noteIndex = prev.notes.findIndex((n) => n.id === payload.id);
                if (noteIndex === -1) return prev;
                const updatedNotes = [...prev.notes];
                updatedNotes[noteIndex] = {
                  ...updatedNotes[noteIndex],
                  ...(payload.title !== undefined ? { title: payload.title } : {}),
                  ...(payload.content !== undefined ? { content: payload.content, contentLoaded: true } : {}),
                  ...(payload.lockVersion !== undefined ? { lockVersion: payload.lockVersion } : {}),
                  updatedAt: payload.updatedAt ?? Date.now(),
                };
                return {
                  ...prev,
                  notes: updatedNotes,
                };
              }
            );
          }
        });

        unlistenWindowState = await listen<{ id: string; isOpen: boolean }>(
          'knowledge:note-window-state',
          (event) => {
            const { id, isOpen } = event.payload || {};
            if (!id) return;
            if (isOpen) {
              addStandaloneNoteId(id);
            } else {
              removeStandaloneNoteId(id);
            }
          }
        );
      } catch (err) {
        console.error('Failed to setup Tauri IPC note listeners:', err);
      }
    };

    void setupListeners();

    return () => {
      if (unlistenUpdated) unlistenUpdated();
      if (unlistenWindowState) unlistenWindowState();
    };
  }, [queryClient, userId, activeListId, addStandaloneNoteId, removeStandaloneNoteId, setStandaloneNoteIds]);
  const activeNote = useMemo(() => {
    if (!activeNoteId) return null;
    return noteMap.get(activeNoteId) || null;
  }, [noteMap, activeNoteId]);

  const [searchQuery, setSearchQuery] = useState('');
  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ['notes-search', searchQuery],
    queryFn: () => knowledgeService.searchNotes(searchQuery),
    enabled: searchQuery.trim().length > 0,
    staleTime: 3000,
  });
  const { data: activeNoteDetail } = useQuery({
    queryKey: queryKeys.lists.note(userId, activeNoteId ?? 'none'),
    queryFn: () => knowledgeService.loadNote(activeNoteId!),
    enabled: (isDrawerOpen || viewMode === 'full') && Boolean(activeNoteId) && !activeNote?.contentLoaded,
  });
  const drawerNote = activeNote?.contentLoaded ? activeNote : activeNoteDetail ?? null;
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const [activeDragNoteId, setActiveDragNoteId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<DragOverTarget>(null);

  const dragOverSidebarListId = dragOverTarget?.type === 'sidebar-list' ? dragOverTarget.id : null;
  const dragOverFolderId = dragOverTarget?.type === 'folder' || dragOverTarget?.type === 'standalone-area'
    ? (dragOverTarget.type === 'standalone-area' ? 'standalone-area' : dragOverTarget.id)
    : null;
  const dragOverGroupId = dragOverTarget?.type === 'group' ? dragOverTarget.id : null;

  // KnowledgeTemplate & Export state
  const [batchExportModalOpen, setBatchExportModalOpen] = useState(false);

  const didInitActiveList = useRef(false);
  useEffect(() => {
    if (didInitActiveList.current) return;
    if (lists.length === 0) return;
    didInitActiveList.current = true;

    const exists = activeListId && lists.some(l => l.id === activeListId);
    if (exists) {
      return;
    }

    let defaultListId = lists[0].id;
    if (folders.length > 0) {
      const firstFolder = folders[0];
      const folderLists = lists.filter(l => l.knowledgeBaseId === firstFolder.id);
      if (folderLists.length > 0) {
        defaultListId = folderLists[0].id;
      }
    }

    setActiveListId(defaultListId);
  }, [activeListId, lists, folders, setActiveListId]);

  useEffect(() => {
    if (activeListId) {
      setActiveNoteId(null);
      setIsDrawerOpen(false);
    }
  }, [activeListId, setActiveNoteId, setIsDrawerOpen]);

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
    const overData = over.data?.current as { type?: string; folderId?: string } | undefined;
    const activeId = String(active.id);

    const isDraggingNote = noteMap.has(activeId);

    if (isDraggingNote) {
      if (overData?.type === 'sidebar-list' && overData.folderId) {
        setDragOverTarget({ type: 'sidebar-list', id: overData.folderId });
      } else if (overData?.type === 'folder' || knowledgeBaseIdSet.has(overId)) {
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
      const activeFolder = knowledgeBaseIdSet.has(activeId);
      if (activeFolder) {
        setDragOverTarget(null);
        return;
      }
      if (overId === 'standalone-area') {
        setDragOverTarget({ type: 'standalone-area' });
      } else if (overData?.type === 'folder' || knowledgeBaseIdSet.has(overId)) {
        setDragOverTarget({ type: 'folder', id: overId });
      } else {
        const overList = listMap.get(overId);
        if (overList) {
          const fId = overList.knowledgeBaseId;
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
    const overData = over.data?.current as { type?: string; folderId?: string } | undefined;

    const isDraggingNote = noteMap.has(activeId);

    if (isDraggingNote) {
      let targetListId: string | null = null;
      if (overData?.type === 'sidebar-list' && overData.folderId) {
        targetListId = overData.folderId;
      } else if (overId.startsWith('sidebar-list-')) {
        targetListId = overId.replace('sidebar-list-', '');
      } else if (listMap.has(overId)) {
        targetListId = overId;
      }

      if (targetListId) {
        const targetList = listMap.get(targetListId);
        moveNoteToList(activeId, targetListId);
        if (targetList) {
          toast.success(`已成功移动笔记到文件夹「${targetList.name}」`);
        }
        return;
      }

      if (overData?.type === 'folder' || knowledgeBaseIdSet.has(overId)) {
        const knowledgeBaseId = overId;
        const folderLists = lists.filter(l => l.knowledgeBaseId === knowledgeBaseId);
        if (folderLists.length > 0) {
          const targetList = folderLists[0];
          moveNoteToList(activeId, targetList.id);
          toast.success(`已成功移动笔记到文件夹「${targetList.name}」`);
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
      else if (overData?.type === 'folder' || knowledgeBaseIdSet.has(overId)) overType = 'folder';
      else if (listMap.has(overId)) overType = 'list';

      const action = computeKnowledgeFolderReorder({
        activeId,
        overId,
        lists,
        folders,
        overType,
      });

      switch (action.kind) {
        case 'reorder':
          if (knowledgeBaseIdSet.has(activeId)) {
            reorderKnowledgeBases(action.newOrder);
          } else {
            reorderKnowledgeFolders(action.newOrder);
          }
          break;
        case 'move':
          moveKnowledgeFolder(activeId, action.targetGroup, action.targetIndex);
          break;
      }
    }
  };

  // --- Handlers ---
  const handleAddListClick = (knowledgeBaseId?: string) => {
    setEditListId(null);
    setAddModalInitialFolderId(knowledgeBaseId);
    setIsAddModalOpen(true);
  };

  const handleAddFolder = (name: string): KnowledgeBase => {
    return addFolder(name);
  };

  const handleAddList = (data: { name: string; knowledgeBaseId: string | null; newFolderName?: string }) => {
    let finalFolderId = data.knowledgeBaseId;
    if (data.newFolderName) {
      const created = handleAddFolder(data.newFolderName);
      finalFolderId = created.id;
    }

    if (editListId) {
      updateList(editListId, {
        name: data.name,
        knowledgeBaseId: finalFolderId,
      });
    } else {
      const newList = addList({
        name: data.name,
        knowledgeBaseId: finalFolderId,
      });
      setActiveListId(newList.id);
    }
    setIsAddModalOpen(false);
    setEditListId(null);
  };

  const handleEditFolder = (folder: KnowledgeBase) => {
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

  const handleDissolveFolder = (folder: KnowledgeBase) => {
    deleteKnowledgeBase(folder.id);
  };

  const handleEditList = (list: KnowledgeFolder) => {
    setEditListId(list.id);
    setIsAddModalOpen(true);
  };

  const handleDuplicateList = async (list: KnowledgeFolder) => {
    try {
      const newList = await duplicateKnowledgeFolder(list);
      setActiveListId(newList.id);
      toast.success(`已复制文件夹「${newList.name}」`);
    } catch (error) {
      logSilent('listsPanel', 'knowledge folder clone failed', error);
      toast.error('复制文件夹失败，请重试。');
    }
  };

  const handleDeleteList = (list: KnowledgeFolder) => {
    deleteKnowledgeFolder(list.id);
    if (activeListId === list.id) setActiveListId(null);
  };

  // --- Native File Drag & Drop ---
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragCounterRef = useRef(0);

  // Prevent browser default behavior of opening dropped files on unhandled window areas
  useEffect(() => {
    const preventFileDropDefault = (e: DragEvent) => {
      if (e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes('Files')) {
        e.preventDefault();
      }
    };
    window.addEventListener('dragover', preventFileDropDefault);
    window.addEventListener('drop', preventFileDropDefault);
    return () => {
      window.removeEventListener('dragover', preventFileDropDefault);
      window.removeEventListener('drop', preventFileDropDefault);
    };
  }, []);

  const isFileDrag = (e: React.DragEvent) => {
    const types = e.dataTransfer?.types;
    if (!types) return false;
    return Array.from(types).includes('Files') || Array.from(types).includes('application/x-moz-file');
  };

  const handleNativeDragEnter = (e: React.DragEvent) => {
    if (isFileDrag(e)) {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current += 1;
      setIsDraggingFiles(true);
    }
  };

  const handleNativeDragOver = (e: React.DragEvent) => {
    if (isFileDrag(e)) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleNativeDragLeave = (e: React.DragEvent) => {
    if (isFileDrag(e)) {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) {
        setIsDraggingFiles(false);
      }
    }
  };

  const handleNativeDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingFiles(false);

    const rawFiles = Array.from(e.dataTransfer?.files || []);
    if (rawFiles.length === 0) {
      return;
    }

    if (!activeListId) {
      toast.error('请先在左侧选择一个文件夹再导入文件。');
      return;
    }

    const files = rawFiles.filter((f) => {
      const lower = f.name.toLowerCase();
      return lower.endsWith('.md') || lower.endsWith('.txt') || lower.endsWith('.markdown');
    });

    if (files.length === 0) {
      toast.info('仅支持导入 .md、.markdown 或 .txt 格式的 Markdown 文件。');
      return;
    }

    let count = 0;
    for (const file of files) {
      try {
        const text = await file.text();
        const title = extractTitleFromMarkdown(file.name, text);
        const jsonContent = convertMarkdownToTipTapJson(text);
        addNote({
          folderId: activeListId,
          title,
          content: jsonContent,
          contentLoaded: true,
        });
        count++;
      } catch (err) {
        logSilent('listsPanel', 'Failed to read dropped file', err);
      }
    }

    if (count > 0) {
      toast.success(`成功拖拽导入 ${count} 篇 Markdown 笔记！`);
    }
  };

  // --- Note Actions ---
  const handleOpenNote = async (
    noteId: string,
    noteTitle?: string,
    options?: { forceMode?: 'drawer' | 'full' | 'window'; focusEditor?: boolean }
  ) => {
    const targetMode = options?.forceMode || defaultOpenMode;

    if (targetMode === 'window') {
      await openStandaloneNoteWindow(noteId, noteTitle);
      addStandaloneNoteId(noteId);
      setActiveNoteId(null);
      setIsDrawerOpen(false);
      return;
    }

    // Anti-conflict: if already open in standalone window, bring it to front
    const isAlreadyOpen = await focusStandaloneNoteWindow(noteId);
    if (isAlreadyOpen) {
      addStandaloneNoteId(noteId);
      toast.info('该笔记正在独立窗口中编辑，已为您前置聚焦。如需在主窗口中打开，请先关闭独立窗口。');
      return;
    }

    if (options?.focusEditor) {
      setAutoFocusEditor(true);
    } else {
      setAutoFocusEditor(false);
    }

    startTransition(() => {
      setActiveNoteId(noteId);
      if (targetMode === 'full') {
        setViewMode('full');
        setIsDrawerOpen(false);
      } else {
        setViewMode('drawer');
        setIsDrawerOpen(true);
      }
    });
  };

  const handleAddNote = (e?: React.KeyboardEvent<HTMLInputElement>) => {
    if (!activeListId || !newNoteTitle.trim()) return;
    if (e) {
      e.currentTarget.blur();
    }
    const newNote = addNote({
      folderId: activeListId,
      title: newNoteTitle.trim(),
      content: '',
      contentLoaded: true,
    });
    setNewNoteTitle('');
    handleOpenNote(newNote.id, newNote.title, { focusEditor: true });
  };

  const handleBatchImport = async () => {
    if (!activeListId) return;
    try {
      const importedFiles = await knowledgeService.pickMultipleMarkdownFiles();
      if (!importedFiles || importedFiles.length === 0) {
        return;
      }
      for (const file of importedFiles) {
        const jsonContent = convertMarkdownToTipTapJson(file.content);
        addNote({
          folderId: activeListId,
          title: file.title,
          content: jsonContent,
          contentLoaded: true,
        });
      }
      toast.success(`已成功导入 ${importedFiles.length} 条笔记！`);
    } catch (err) {
      logSilent('listsPanel', 'batch import cancelled or failed', err);
      toast.error('导入失败，请检查文件后重试。');
    }
  };

  const handleBatchExport = async (selectedNoteIds: string[]) => {
    try {
      const count = await knowledgeService.exportNotesToMarkdown(notes, selectedNoteIds, convertTipTapJsonToMarkdown, knowledgeService.loadNote);
      if (count > 0) {
        setBatchExportModalOpen(false);
        toast.success(`已成功导出 ${count} 条笔记！`);
      }
    } catch (err) {
      logSilent('listsPanel', 'batch export cancelled or failed', err);
      toast.error('导出失败，请检查文件权限后重试。');
    }
  };

  const handleNoteUpdate = (id: string, title: string, content: string) => {
    updateNote(id, { title, content });
  };

  const handleDuplicateNote = async (note: Note) => {
    const source = note.contentLoaded ? note : await knowledgeService.loadNote(note.id);
    if (!source) return;
    const newNote = addNote({
      folderId: source.folderId,
      groupId: source.groupId ?? null,
      title: source.title + ' (副本)',
      content: source.content,
      contentLoaded: true,
    });
    handleOpenNote(newNote.id, newNote.title);
  };

  const handleDeleteNote = async (note: Note) => {
    deleteNote(note.id);
    if (activeNoteId === note.id) {
      setActiveNoteId(null);
      setIsDrawerOpen(false);
    }
    removeStandaloneNoteId(note.id);
    await closeStandaloneNoteWindow(note.id);
    if (isTauriEnv()) {
      void emit('knowledge:note-deleted', { id: note.id });
    }
  };

  const handleSaveAsTemplate = async (note: Note) => {
    const source = note.contentLoaded ? note : await knowledgeService.loadNote(note.id);
    const fullContent = source ? source.content : note.content;
    const fullTitle = source ? source.title : note.title;
    addTemplate(fullTitle || '未命名模板', fullContent);
    toast.success('已成功保存为模板！');
  };

  const handleSelectTemplate = (template: KnowledgeTemplate) => {
    if (!activeListId) return;
    const newNote = addNote({
      folderId: activeListId,
      title: template.name,
      content: template.content,
      contentLoaded: true,
    });
    handleOpenNote(newNote.id, newNote.title);
    setIsTemplateModalOpen(false);
  };

  const handleEditTemplate = (id: string, name: string, content: string) => {
    updateTemplate(id, { name, content });
  };

  const handleDeleteTemplate = (id: string) => {
    deleteTemplate(id);
  };

  // Group actions
  const handleAddGroupClick = () => {
    setIsAddingGroup(true);
    setNewGroupName('');
  };

  const handleConfirmAddGroup = () => {
    if (!activeListId || !newGroupName.trim()) {
      setIsAddingGroup(false);
      return;
    }
    addGroup(activeListId, newGroupName.trim());
    setNewGroupName('');
    setIsAddingGroup(false);
  };

  const handleRenameGroup = (id: string, name: string) => {
    updateGroup(id, { name });
  };

  const handleDeleteGroup = (id: string) => {
    deleteGroup(id);
  };

  const activeList = listMap.get(activeListId || '');
  const noteGroupIdSet = useMemo(() => new Set(noteGroups.map(g => g.id)), [noteGroups]);
  const ungroupedNotes = useMemo(() => notes.filter(n => !n.groupId || !noteGroupIdSet.has(n.groupId)), [notes, noteGroupIdSet]);
  const activeNoteItem = useMemo(() => (activeDragNoteId ? noteMap.get(activeDragNoteId) : null), [noteMap, activeDragNoteId]);
  const isUngroupedDragOverTarget = dragOverGroupId === 'ungrouped' && activeNoteItem && activeNoteItem.groupId !== null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <section
        className="flex h-full w-full bg-transparent overflow-hidden text-foreground relative"
        onDragEnter={handleNativeDragEnter}
        onDragOver={handleNativeDragOver}
        onDragLeave={handleNativeDragLeave}
        onDrop={handleNativeDrop}
      >
        {isDraggingFiles && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/85 backdrop-blur-xs border-2 border-dashed border-primary m-3 rounded-lg pointer-events-none animate-in fade-in duration-150">
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="p-3.5 rounded-full bg-primary/10 text-primary">
                <Upload size={32} />
              </div>
              <p className="text-base font-bold text-foreground">松开鼠标直接导入 Markdown 笔记</p>
              <p className="text-xs text-muted-foreground">
                {activeList ? `将导入至当前文件夹「${activeList.name}」` : '请先在左侧选择目标文件夹'}
              </p>
            </div>
          </div>
        )}

        <ListsSidebar
          lists={lists}
          folders={folders}
          activeListId={activeListId}
          loadingListId={isListContentsFetching ? activeListId : null}
          dragOverListId={dragOverSidebarListId}
          dragOverFolderId={dragOverFolderId}
          onSelectList={setActiveListId}
          onAddClick={handleAddListClick}
          onEditFolder={handleEditFolder}
          onDissolveFolder={handleDissolveFolder}
          onEditList={handleEditList}
          onDuplicateList={handleDuplicateList}
          onDeleteList={handleDeleteList}
          isCollapsed={isSidebarCollapsed}
          isPixelTheme={isPixelTheme}
        />

        <main className="flex-1 flex flex-col bg-transparent relative overflow-hidden">

          {activeList ? (
            viewMode === 'full' && activeNoteId ? (
              drawerNote ? (
                <FullNoteEditor
                  note={drawerNote}
                  folderName={activeList.name}
                  isPixelTheme={isPixelTheme}
                  autoFocusEditor={autoFocusEditor}
                  onBackToList={() => {
                    setActiveNoteId(null);
                    setAutoFocusEditor(false);
                  }}
                  onUpdate={handleNoteUpdate}
                  onFlush={flushNote}
                  onDuplicate={handleDuplicateNote}
                  onSaveAsTemplate={handleSaveAsTemplate}
                  onDelete={handleDeleteNote}
                  onSwitchToDrawer={() => {
                    setViewMode('drawer');
                    setIsDrawerOpen(true);
                  }}
                  onOpenStandaloneWindow={() => {
                    void handleOpenNote(drawerNote.id, drawerNote.title, { forceMode: 'window' });
                  }}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
                  <LoaderCircle size={20} className="animate-spin text-primary" />
                  <span>正在加载笔记正文...</span>
                </div>
              )
            ) : (
              <>
                <div className={cn(
                  "flex h-12 items-center justify-between border-b bg-card px-6 shrink-0 z-30 relative",
                  isPixelTheme ? "border-b-2 border-border font-mono" : "border-border"
                )}>
                <div className="flex items-center gap-2 text-base font-bold text-foreground">
                  <Button variant="ghost" size="icon" className={isPixelTheme ? "rounded-xs" : "rounded-lg"} onClick={toggleSidebar} title={isSidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}>
                    <MenuIcon isCollapsed={isSidebarCollapsed} />
                  </Button>
                  {isPixelTheme && <PixelBookOpen size={18} className="shrink-0" />}
                  <span>{activeList.name}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="relative flex items-center">
                    <Search size={14} className="absolute left-2.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      placeholder="全文搜索笔记..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className={cn(
                        "pl-8 pr-6 py-1 text-xs bg-muted/60 border border-input rounded-md outline-none w-36 transition-all focus:w-56 focus:bg-background focus:border-ring",
                        isPixelTheme && "font-mono rounded-xs border-2 border-border shadow-[1px_1px_0px_rgba(0,0,0,0.1)]"
                      )}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className={isPixelTheme ? "rounded-xs" : "rounded-lg"}>
                        <MoreHorizontal size={18} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-44">
                      <DropdownMenuItem onClick={handleAddGroupClick}>新建分组</DropdownMenuItem>
                      <DropdownMenuItem onClick={handleBatchImport}>批量导入MD</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setBatchExportModalOpen(true)}>批量导出MD</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <LayoutTemplate size={14} />
                          <span>默认打开模式</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-40">
                          <DropdownMenuItem
                            onClick={() => {
                              setDefaultOpenMode('drawer');
                              toast.success('默认打开模式已设为：侧边抽屉');
                            }}
                            className={cn(defaultOpenMode === 'drawer' && "font-bold text-primary")}
                          >
                            <PanelRight size={14} className="mr-1.5" />
                            <span>侧边抽屉</span>
                            {defaultOpenMode === 'drawer' && <Check size={14} className="ml-auto" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setDefaultOpenMode('full');
                              toast.success('默认打开模式已设为：主区域铺满');
                            }}
                            className={cn(defaultOpenMode === 'full' && "font-bold text-primary")}
                          >
                            <Maximize2 size={14} className="mr-1.5" />
                            <span>主区域铺满</span>
                            {defaultOpenMode === 'full' && <Check size={14} className="ml-auto" />}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setDefaultOpenMode('window');
                              toast.success('默认打开模式已设为：独立窗口');
                            }}
                            className={cn(defaultOpenMode === 'window' && "font-bold text-primary")}
                          >
                            <ExternalLink size={14} className="mr-1.5" />
                            <span>独立窗口</span>
                            {defaultOpenMode === 'window' && <Check size={14} className="ml-auto" />}
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="px-8 flex-1 overflow-y-auto flex flex-col py-6">
                {searchQuery.trim().length > 0 ? (
                  <div className="flex flex-col gap-3 pb-8">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span>搜索结果（{searchResults?.length ?? 0} 条）</span>
                      {isSearching && <span className="animate-pulse">正在检索...</span>}
                    </div>
                    {searchResults && searchResults.length > 0 ? (
                      searchResults.map((result) => (
                        <div
                          key={result.id}
                          onClick={() => handleOpenNote(result.id, result.title)}
                          className={cn(
                            "p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-all flex flex-col gap-1 shadow-2xs",
                            isPixelTheme && "rounded-xs font-mono border-2 border-border"
                          )}
                        >
                          <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                            <FileText size={15} className="text-primary shrink-0" />
                            <span>{result.title || "未命名笔记"}</span>
                          </div>
                          {result.content && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                              {result.content.slice(0, 150)}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      !isSearching && (
                        <div className="text-center py-12 text-sm text-muted-foreground font-mono">
                          未找到与 "{searchQuery}" 相关的笔记
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <>
                <div className={cn(
                  "flex items-center gap-3 border px-3 py-2 mb-6 transition-all",
                  isPixelTheme
                    ? "bg-amber-50/60 dark:bg-amber-950/30 border-2 border-border/90 rounded-xs shadow-[2px_2px_0px_rgba(0,0,0,0.08)] focus-within:border-amber-600 focus-within:shadow-[3px_3px_0px_rgba(217,119,6,0.3)] font-mono"
                    : "bg-muted border-input rounded-lg focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20"
                )}>
                  {isPixelTheme ? (
                    <PixelFeather size={18} className="shrink-0" />
                  ) : (
                    <Plus size={18} className="text-muted-foreground shrink-0" />
                  )}
                  <Input
                    type="text"
                    placeholder={isPixelTheme ? "📜 撰写新的魔法卷轴 / 笔记... (按 Enter 保存)" : "添加笔记..."}
                    value={newNoteTitle}
                    onChange={e => setNewNoteTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddNote(e); }}
                    className={cn(
                      "border-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-auto",
                      isPixelTheme && "font-mono text-sm"
                    )}
                  />
                </div>

                {notes.length === 0 && !isAddingGroup ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground py-16">
                    {isPixelTheme ? (
                      <>
                        <PixelScroll size={36} className="mb-2 opacity-60" />
                        <span className="font-mono text-sm text-amber-900/70 dark:text-amber-300/70">
                          📜 当前宝典暂无卷轴笔记，点击上方开始撰写
                        </span>
                      </>
                    ) : (
                      <span>暂无笔记</span>
                    )}
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
                          className={cn(
                            "text-sm font-semibold bg-card shadow-xs max-w-xs",
                            isPixelTheme ? "border-2 border-amber-600 rounded-xs font-mono" : "border-primary"
                          )}
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
                              isPixelTheme={isPixelTheme}
                              onClick={() => handleOpenNote(note.id, note.title)}
                              onDuplicate={handleDuplicateNote}
                              onDelete={handleDeleteNote}
                              onOpenWindow={(n) => void handleOpenNote(n.id, n.title, { forceMode: 'window' })}
                              onOpenMode={(n, mode) => handleOpenNote(n.id, n.title, { forceMode: mode })}
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
                              isDragOverTarget={!!isDragOverTarget}
                              isPixelTheme={isPixelTheme}
                              onRenameGroup={handleRenameGroup}
                              onDeleteGroup={handleDeleteGroup}
                              onNoteClick={(note) => handleOpenNote(note.id, note.title)}
                              onDuplicateNote={handleDuplicateNote}
                              onDeleteNote={handleDeleteNote}
                              onOpenNoteWindow={(n) => void handleOpenNote(n.id, n.title, { forceMode: 'window' })}
                              onOpenNoteMode={(n, mode) => handleOpenNote(n.id, n.title, { forceMode: mode })}
                            />
                          );
                        })}
                        {ungroupedNotes.length > 0 && (
                          <NoteGroupView
                            key="ungrouped"
                            group={{ id: 'ungrouped', folderId: activeListId!, name: '未分组' }}
                            notes={ungroupedNotes}
                            isUngrouped={true}
                            isDragOverTarget={!!isUngroupedDragOverTarget}
                            isPixelTheme={isPixelTheme}
                            onRenameGroup={() => { }}
                            onDeleteGroup={() => { }}
                            onNoteClick={(note) => handleOpenNote(note.id, note.title)}
                            onDuplicateNote={handleDuplicateNote}
                            onDeleteNote={handleDeleteNote}
                            onOpenNoteWindow={(n) => void handleOpenNote(n.id, n.title, { forceMode: 'window' })}
                            onOpenNoteMode={(n, mode) => handleOpenNote(n.id, n.title, { forceMode: mode })}
                          />
                        )}
                      </>
                    )}
                  </div>
                )}
                  </>
                )}
              </div>

              <NoteDrawer
                note={drawerNote}
                isLoading={isDrawerOpen && Boolean(activeNoteId) && !drawerNote}
                isOpen={isDrawerOpen}
                isPixelTheme={isPixelTheme}
                onClose={() => setIsDrawerOpen(false)}
                onUpdate={handleNoteUpdate}
                onFlush={flushNote}
                onDuplicate={handleDuplicateNote}
                onSaveAsTemplate={handleSaveAsTemplate}
                onDelete={handleDeleteNote}
                onSwitchToFull={() => {
                  setIsDrawerOpen(false);
                  setViewMode('full');
                }}
                onOpenStandaloneWindow={() => {
                  if (drawerNote) {
                    void handleOpenNote(drawerNote.id, drawerNote.title, { forceMode: 'window' });
                  }
                }}
                autoFocusEditor={autoFocusEditor}
              />
            </>
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-sm text-muted-foreground py-16 font-mono">
              {isPixelTheme ? (
                <>
                  <PixelLibrary size={42} className="mb-2 opacity-50" />
                  <span>📜 请在左侧选择或创建一个知识卷轴文件夹</span>
                </>
              ) : (
                <span>请在左侧选择或创建一个文件夹</span>
              )}
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
      </section>
    </DndContext>
  );
}

