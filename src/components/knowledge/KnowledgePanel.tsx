import React, { useState, useEffect, useMemo, useRef, type ReactNode, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import {
  MoreHorizontal, Plus, PanelLeftClose, PanelLeftOpen,
  ChevronDown, FileText, Cloud, LoaderCircle,
  Folder as FolderIcon, Check, Library
} from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverEvent, useDroppable } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useKnowledgeFolderContents, useKnowledgeData, useKnowledgeActions } from '@/hooks/useKnowledgeQuery';
import { sortKnowledgeFolders, sortKnowledgeBases } from '@/utils/knowledgeSelectors';
import { KnowledgeFolder, KnowledgeBase, Note, NoteGroup, KnowledgeTemplate } from '@/types/knowledge';

import { TemplateModal, useTemplateData, useTemplateActions } from '../templates';
import * as knowledgeService from '@/services/knowledgeService';
import { logSilent } from '@/lib/syncEngine';
import { computeNoteReorder, computeKnowledgeFolderReorder } from '@/utils/knowledgeReorder';
import {
  ReactjsTiptapEditor,
  convertMarkdownToTipTapJson,
  convertTipTapJsonToMarkdown,
} from '@/components/ui/reactjs-tiptap-editor';
import { Popconfirm } from '@/components/ui/popconfirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
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
        'group relative flex cursor-pointer select-none items-center gap-2 px-2 py-1.5 text-sm transition-all duration-150',
        isNested ? 'pl-9' : 'pl-7',
        isActive
          ? (isPixelTheme
              ? 'bg-amber-200/90 text-amber-950 dark:bg-amber-900/60 dark:text-amber-100 font-mono font-bold shadow-[2px_2px_0px_rgba(0,0,0,0.15)] border border-amber-900/40 dark:border-amber-600/40 rounded-xs'
              : 'bg-sidebar-primary/15 font-medium text-sidebar-primary rounded-md')
          : (isPixelTheme
              ? 'text-sidebar-foreground hover:bg-amber-100/60 dark:hover:bg-amber-950/40 hover:text-amber-900 dark:hover:text-amber-100 font-mono rounded-xs'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md'),
        isTarget && (isPixelTheme ? 'bg-amber-200/30 ring-2 ring-amber-500' : 'bg-sidebar-primary/10 ring-2 ring-sidebar-ring')
      )}
      onClick={() => onSelectList(list.id)}
    >
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

  const standaloneLists = useMemo(() => lists.filter(l => !l.knowledgeBaseId), [lists]);
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
            <LoaderCircle size={14} className="animate-spin text-sidebar-primary" aria-label="正在加载清单" />
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
                  title={`确定要删除清单 "${list.name}" 吗？`}
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
          'flex w-[210px] flex-none flex-col overflow-hidden border-r bg-sidebar text-sidebar-foreground transition-all duration-[250ms] ease-in-out',
          isPixelTheme ? 'border-r-2 border-border font-mono' : 'border-border',
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
            isPixelTheme ? "rounded-xs" : "rounded-md"
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
                      className={cn('text-sidebar-foreground/60 transition-transform duration-200', isCollapsedFolder && '-rotate-90')}
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
  isPixelTheme?: boolean;
}

function NoteItem({ note, onClick, onDuplicate, onDelete, isPixelTheme }: NoteItemProps) {
  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 border transition-all duration-200 mb-2.5 cursor-pointer text-card-foreground select-none",
        isPixelTheme
          ? "bg-card border-2 border-border/90 hover:bg-amber-50/70 dark:hover:bg-amber-950/40 rounded-xs px-4 py-2.5 shadow-[3px_3px_0px_rgba(0,0,0,0.1)] hover:shadow-[4px_4px_0px_rgba(217,119,6,0.3)] hover:-translate-x-0.5 hover:-translate-y-0.5 font-mono"
          : "bg-card border-border hover:border-muted-foreground/30 rounded-lg px-4 py-3 hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
      )}
      onClick={onClick}
    >
      {isPixelTheme ? (
        <PixelScroll size={16} className="shrink-0" />
      ) : (
        <FileText size={16} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      )}
      <div className={cn("flex-1 truncate", isPixelTheme ? "font-mono font-bold text-sm text-foreground" : "text-sm font-medium text-foreground")}>
        {note.title || (isPixelTheme ? '📜 无标题卷轴' : '无标题笔记')}
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
          <DropdownMenuContent align="end" className="min-w-32">
            <DropdownMenuItem onClick={() => onDuplicate(note)}>
              创建副本
            </DropdownMenuItem>
            <DropdownMenuItem
              destructive
              onClick={() => onDelete(note)}
            >
              删除
            </DropdownMenuItem>
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
}

function NoteGroupView({ group, notes, isUngrouped, isDragOverTarget, isPixelTheme, onRenameGroup, onDeleteGroup, onNoteClick, onDuplicateNote, onDeleteNote }: NoteGroupViewProps) {
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
  isPixelTheme?: boolean;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content || '');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');

  const isDirtyRef = useRef(false);
  const wasOpenRef = useRef(isOpen);
  const latestDataRef = useRef({ title: note.title, content: note.content || '', note, contentLoaded: note.contentLoaded === true });
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content || '');
    setSaveStatus('saved');
    isDirtyRef.current = false;
    latestDataRef.current = { title: note.title, content: note.content || '', note, contentLoaded: note.contentLoaded === true };
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
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [title, content, note.id, note.title, note.content, isOpen]);

  const handleImport = async () => {
    const mdContent = await knowledgeService.pickMarkdownFile();
    if (mdContent) {
      const jsonStr = convertMarkdownToTipTapJson(mdContent);
      setContent(jsonStr);
      toast.success('导入成功！');
    }
  };

  const handleExport = async () => {
    try {
      const exportText = convertTipTapJsonToMarkdown(content);
      await knowledgeService.saveMarkdownFile(`${title || (isPixelTheme ? '未命名卷轴' : '未命名笔记')}.md`, exportText);
      toast.success('导出成功！');
    } catch (err) {
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
  const [name, setName] = useState(initialData?.name || '');

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <Modal
      visible={true}
      title={initialData ? '编辑知识库' : '添加知识库'}
      onCancel={onClose}
      onOk={handleSave}
      okText={initialData ? '保存' : '添加'}
      okDisabled={!name.trim()}
      width={480}
    >
      <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3">
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
  const [name, setName] = useState(initialData?.name || '');
  const [knowledgeBaseId, setFolderId] = useState<string | null>(initialData?.knowledgeBaseId !== undefined ? initialData.knowledgeBaseId : (initialFolderId || null));
  const [newFolderName, setNewFolderName] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({ name, knowledgeBaseId });
  };

  const getFolderDisplay = () => {
    if (!knowledgeBaseId) return '无';
    const folder = folders.find(f => f.id === knowledgeBaseId);
    return folder ? folder.name : '无';
  };

  return (
    <Modal
      visible={true}
      title={initialData ? '编辑文件夹' : '添加文件夹'}
      onCancel={onClose}
      onOk={handleAdd}
      okText={initialData ? '保存' : '添加'}
      okDisabled={!name.trim()}
      width={500}
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

        <div className="flex items-center justify-between relative">
          <span className="text-xs font-semibold text-muted-foreground">所属知识库</span>
          <div className="relative flex-1 max-w-[220px]">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full flex items-center justify-between px-3 text-xs font-medium"
                >
                  <span>{getFolderDisplay()}</span>
                  <ChevronDown size={14} className="text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[220px] max-h-48 overflow-y-auto">
                <DropdownMenuItem
                  className="flex items-center justify-between"
                  onClick={() => setFolderId(null)}
                >
                  <span>无</span>
                  {knowledgeBaseId === null && <Check size={14} className="text-primary" />}
                </DropdownMenuItem>
                {folders.map(f => (
                  <DropdownMenuItem
                    key={f.id}
                    className="flex items-center justify-between"
                    onClick={() => setFolderId(f.id)}
                  >
                    <span>{f.name}</span>
                    {knowledgeBaseId === f.id && <Check size={14} className="text-primary" />}
                  </DropdownMenuItem>
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
                        }
                      }
                    }}
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
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
      title="批量导出笔记"
      onCancel={onClose}
      onOk={handleConfirm}
      okText={`导出选中的笔记 (${selectedIds.size})`}
      okDisabled={selectedIds.size === 0 || notes.length === 0}
      width={500}
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
  // Query-backed data + write actions (connected to knowledgeService Supabase backend)
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
  const isTemplateModalOpen = useUiStore((state) => state.isTemplateModalOpen);
  const setIsTemplateModalOpen = useUiStore((state) => state.setTemplateModalOpen);
  const { isFetching: isListContentsFetching } = useKnowledgeFolderContents(activeListId);
  const noteMap = useMemo(() => new Map(rawNotes.map(n => [n.id, n])), [rawNotes]);
  const templates = useTemplateData(isTemplateModalOpen).data ?? [];

  const notes = useMemo(() => {
    if (!activeListId) return [];
    return rawNotes
      .filter(n => n.folderId === activeListId)
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) {
          return (a.sortOrder || 0) - (b.sortOrder || 0);
        }
        return b.updatedAt - a.updatedAt;
      });
  }, [rawNotes, activeListId]);

  const noteGroups = useMemo(() => {
    if (!activeListId) return [];
    return rawNoteGroups
      .filter(g => g.folderId === activeListId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
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
  const activeNoteId = useUiStore((state) => state.activeNoteId);
  const setActiveNoteId = useUiStore((state) => state.setActiveNoteId);
  const isDrawerOpen = useUiStore((state) => state.isDrawerOpen);
  const setIsDrawerOpen = useUiStore((state) => state.setDrawerOpen);
  const activeNote = useMemo(() => {
    if (!activeNoteId) return null;
    return noteMap.get(activeNoteId) || null;
  }, [noteMap, activeNoteId]);
  const { data: activeNoteDetail } = useQuery({
    queryKey: queryKeys.lists.note(userId, activeNoteId ?? 'none'),
    queryFn: () => knowledgeService.loadNote(activeNoteId!),
    enabled: isDrawerOpen && Boolean(activeNoteId) && !activeNote?.contentLoaded,
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

  const handleDuplicateList = (list: KnowledgeFolder) => {
    const newList = duplicateKnowledgeFolder(list);
    setActiveListId(newList.id);
  };

  const handleDeleteList = (list: KnowledgeFolder) => {
    deleteKnowledgeFolder(list.id);
    if (activeListId === list.id) setActiveListId(null);
  };

  // --- Note Actions ---
  const handleOpenNote = (noteId: string, _noteTitle?: string) => {
    setActiveNoteId(noteId);
    setIsDrawerOpen(true);
  };

  const handleAddNote = () => {
    if (!activeListId || !newNoteTitle.trim()) return;
    const newNote = addNote({
      folderId: activeListId,
      title: newNoteTitle.trim(),
      content: '',
      contentLoaded: true,
    });
    setNewNoteTitle('');
    handleOpenNote(newNote.id, newNote.title);
  };

  const handleBatchImport = async () => {
    if (!activeListId) return;
    try {
      const importedFiles = await knowledgeService.pickMultipleMarkdownFiles();
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
    }
  };

  const handleBatchExport = async (selectedNoteIds: string[]) => {
    try {
      const count = await knowledgeService.exportNotesToMarkdown(notes, selectedNoteIds, convertTipTapJsonToMarkdown);
      if (count > 0) {
        setBatchExportModalOpen(false);
        toast.success(`已成功导出 ${count} 条笔记！`);
      }
    } catch (err) {
      logSilent('listsPanel', 'batch export cancelled or failed', err);
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
      title: source.title + ' (副本)',
      content: source.content,
      contentLoaded: true,
    });
    handleOpenNote(newNote.id, newNote.title);
  };

  const handleDeleteNote = (note: Note) => {
    deleteNote(note.id);
    if (activeNoteId === note.id) {
      setActiveNoteId(null);
      setIsDrawerOpen(false);
    }
  };

  const handleSaveAsTemplate = (note: Note) => {
    addTemplate(note.title || '未命名模板', note.content);
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
  const ungroupedNotes = useMemo(() => notes.filter(n => !n.groupId), [notes]);
  const activeNoteItem = useMemo(() => (activeDragNoteId ? noteMap.get(activeDragNoteId) : null), [noteMap, activeDragNoteId]);
  const isUngroupedDragOverTarget = dragOverGroupId === 'ungrouped' && activeNoteItem && activeNoteItem.groupId !== null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <section className="flex h-full w-full bg-transparent overflow-hidden text-foreground">
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
                <div className="flex items-center gap-4 text-muted-foreground">
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="px-8 flex-1 overflow-y-auto flex flex-col py-6">
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
                    onKeyDown={e => { if (e.key === 'Enter') handleAddNote(); }}
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
                          />
                        )}
                      </>
                    )}
                  </div>
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
              />
            </>
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
