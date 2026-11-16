import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  PanelLeft,
  Clock,
  Pin,
  PinOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { aiApi } from "../api/aiApi";
import type { AISession } from "../types";

interface AISessionListProps {
  currentSessionId: string | null;
  onSelectSession: (session: AISession) => void;
  onNewSession: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const AISessionList: React.FC<AISessionListProps> = ({
  currentSessionId,
  onSelectSession,
  onNewSession,
  collapsed,
  onToggleCollapse,
}) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [renameTarget, setRenameTarget] = useState<AISession | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // 1. Fetch sessions
  const { data: sessions = [], isLoading } = useQuery<AISession[]>({
    queryKey: ["ai-sessions"],
    queryFn: aiApi.listSessions,
  });

  // 2. Mutations
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AISession> }) =>
      aiApi.updateSession(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
      toast.success("会话已更新");
      setRenameTarget(null);
    },
    onError: (err: any) => {
      toast.error("更新失败: " + err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiApi.deleteSession(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
      queryClient.removeQueries({ queryKey: ["ai-messages", deletedId] });
      toast.success("会话已删除");
      setDeleteConfirmId(null);
      if (currentSessionId === deletedId) {
        onNewSession();
      }
    },
    onError: (err: any) => {
      toast.error("删除失败: " + err.message);
    },
  });

  // Global shortcut: Ctrl+B / Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        onToggleCollapse();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggleCollapse]);

  // Grouping logic
  const groupedSessions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = sessions.filter(
      (s) => !term || s.title.toLowerCase().includes(term)
    );

    const pinned: AISession[] = [];
    const today: AISession[] = [];
    const yesterday: AISession[] = [];
    const past7Days: AISession[] = [];
    const earlier: AISession[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const sevenDaysAgoStart = todayStart - 6 * 86400000;

    for (const s of filtered) {
      if (s.is_pinned) {
        pinned.push(s);
        continue;
      }
      const t = new Date(s.updated_at || s.created_at).getTime();
      if (t >= todayStart) {
        today.push(s);
      } else if (t >= yesterdayStart) {
        yesterday.push(s);
      } else if (t >= sevenDaysAgoStart) {
        past7Days.push(s);
      } else {
        earlier.push(s);
      }
    }

    return { pinned, today, yesterday, past7Days, earlier };
  }, [sessions, searchTerm]);

  const handleTogglePin = (session: AISession, e: React.MouseEvent) => {
    e.stopPropagation();
    updateMutation.mutate({
      id: session.id,
      data: { is_pinned: !session.is_pinned },
    });
  };

  const handleStartRename = (session: AISession, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameTarget(session);
    setNewTitle(session.title);
  };

  const handleConfirmRename = () => {
    if (!renameTarget || !newTitle.trim()) return;
    updateMutation.mutate({
      id: renameTarget.id,
      data: { title: newTitle.trim() },
    });
  };

  const renderGroup = (title: string, list: AISession[]) => {
    if (list.length === 0) return null;
    return (
      <div key={title} className="mb-4">
        <div className="px-3 mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase select-none">
          {title}
        </div>
        <div className="space-y-0.5">
          {list.map((session) => {
            const isSelected = session.id === currentSessionId;
            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session)}
                className={`group relative flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-xs ${
                  isSelected
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-accent/60"
                }`}
              >
                <div className="flex items-center gap-2 truncate pr-6">
                  {session.is_pinned && (
                    <Pin className="size-3 text-amber-500 shrink-0 fill-amber-500" />
                  )}
                  <span className="truncate" title={session.title}>
                    {session.title || "新对话"}
                  </span>
                </div>

                <div
                  className="opacity-0 group-hover:opacity-100 flex items-center shrink-0 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="size-6 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <MoreVertical className="size-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onClick={(e) => handleTogglePin(session, e as any)}>
                        {session.is_pinned ? (
                          <>
                            <PinOff className="size-3.5 mr-2" />
                            <span>取消置顶</span>
                          </>
                        ) : (
                          <>
                            <Pin className="size-3.5 mr-2" />
                            <span>置顶对话</span>
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleStartRename(session, e as any)}>
                        <Edit2 className="size-3.5 mr-2" />
                        <span>重命名</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteConfirmId(session.id)}
                      >
                        <Trash2 className="size-3.5 mr-2" />
                        <span>删除对话</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (collapsed) {
    return (
      <div className="w-12 border-r border-border flex flex-col items-center py-3 bg-card/40 shrink-0">
        <button
          type="button"
          title="展开历史会话 (Ctrl+B)"
          onClick={onToggleCollapse}
          className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent mb-3 cursor-pointer"
        >
          <PanelLeft className="size-4" />
        </button>
        <button
          type="button"
          title="新建对话"
          onClick={onNewSession}
          className="size-8 rounded-lg flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
        >
          <Plus className="size-4" />
        </button>
      </div>
    );
  }

  const hasAnySessions =
    groupedSessions.pinned.length > 0 ||
    groupedSessions.today.length > 0 ||
    groupedSessions.yesterday.length > 0 ||
    groupedSessions.past7Days.length > 0 ||
    groupedSessions.earlier.length > 0;

  return (
    <aside className="w-64 border-r border-border bg-card/30 flex flex-col h-full shrink-0 select-none">
      {/* Header action bar */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Clock className="size-3.5 text-muted-foreground" />
            <span>对话历史</span>
          </div>
          <button
            type="button"
            title="折叠侧边栏 (Ctrl+B)"
            onClick={onToggleCollapse}
            className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
          >
            <PanelLeft className="size-3.5" />
          </button>
        </div>

        <Button
          size="sm"
          className="w-full shadow-xs font-medium gap-1.5"
          onClick={onNewSession}
        >
          <Plus className="size-3.5" />
          <span>新建对话</span>
        </Button>

        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索会话..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 pl-8 text-xs bg-background/60"
          />
        </div>
      </div>

      {/* Sessions tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">加载历史对话中...</div>
        ) : !hasAnySessions ? (
          <div className="py-12 px-4 text-center text-muted-foreground text-xs">
            <p className="font-medium text-foreground">{searchTerm ? "未找到匹配会话" : "暂无历史对话"}</p>
            <p className="mt-1">{searchTerm ? "尝试其他关键词" : "点击上方新建对话开始交流"}</p>
          </div>
        ) : (
          <>
            {renderGroup("置顶会话", groupedSessions.pinned)}
            {renderGroup("今天", groupedSessions.today)}
            {renderGroup("昨天", groupedSessions.yesterday)}
            {renderGroup("过去 7 天", groupedSessions.past7Days)}
            {renderGroup("更早", groupedSessions.earlier)}
          </>
        )}
      </div>

      {/* Rename Modal */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重命名会话</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="请输入会话标题"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleConfirmRename();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>取消</Button>
            <Button onClick={handleConfirmRename}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Modal */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除会话</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确认删除该会话记录吗？删除后聊天历史将无法恢复。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
};
