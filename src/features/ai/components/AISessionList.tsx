import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Layout,
  Button,
  Input,
  Dropdown,
  Popconfirm,
  Modal,
  Tooltip,
  Empty,
  Toast,
} from "@douyinfe/semi-ui";
import {
  IconPlus,
  IconSearch,
  IconMore,
  IconEdit,
  IconDelete,
  IconSidebar,
  IconClock,
  IconTop,
} from "@douyinfe/semi-icons";
import { aiApi } from "../api/aiApi";
import type { AISession } from "../types";

const { Sider } = Layout;

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
      Toast.success("会话已更新");
      setRenameTarget(null);
    },
    onError: (err: any) => {
      Toast.error("更新失败: " + err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiApi.deleteSession(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
      queryClient.removeQueries({ queryKey: ["ai-messages", deletedId] });
      Toast.success("会话已删除");
      if (currentSessionId === deletedId) {
        onNewSession();
      }
    },
    onError: (err: any) => {
      Toast.error("删除失败: " + err.message);
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
        <div className="px-3 mb-1 text-[11px] font-semibold tracking-wider text-gray-400 uppercase select-none">
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
                    ? "bg-blue-50 text-blue-600 font-medium dark:bg-blue-900/30 dark:text-blue-400"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-800/60"
                }`}
              >
                <div className="flex items-center gap-2 truncate pr-6">
                  {session.is_pinned && (
                    <IconTop size="small" className="text-amber-500 shrink-0" />
                  )}
                  <span className="truncate" title={session.title}>
                    {session.title || "新对话"}
                  </span>
                </div>

                <div
                  className="opacity-0 group-hover:opacity-100 flex items-center shrink-0 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Dropdown
                    trigger="click"
                    position="bottomRight"
                    render={
                      <Dropdown.Menu>
                        <Dropdown.Item
                          icon={<IconTop />}
                          onClick={(e) => handleTogglePin(session, e as any)}
                        >
                          {session.is_pinned ? "取消置顶" : "置顶对话"}
                        </Dropdown.Item>
                        <Dropdown.Item
                          icon={<IconEdit />}
                          onClick={(e) => handleStartRename(session, e as any)}
                        >
                          重命名
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        <Popconfirm
                          title="确定删除此对话吗？"
                          content="删除后聊天记录将无法恢复"
                          okType="danger"
                          onConfirm={() => deleteMutation.mutate(session.id)}
                        >
                          <Dropdown.Item icon={<IconDelete />} type="danger">
                            删除对话
                          </Dropdown.Item>
                        </Popconfirm>
                      </Dropdown.Menu>
                    }
                  >
                    <Button
                      theme="borderless"
                      type="tertiary"
                      size="small"
                      icon={<IconMore size="small" />}
                      style={{ padding: "0 2px" }}
                    />
                  </Dropdown>
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
      <div className="w-12 border-r border-gray-200/80 dark:border-gray-800 flex flex-col items-center py-3 bg-gray-50/50 dark:bg-gray-900/40 shrink-0">
        <Tooltip content="展开历史会话 (Ctrl+B)" position="right">
          <Button
            theme="borderless"
            type="tertiary"
            icon={<IconSidebar />}
            onClick={onToggleCollapse}
            className="mb-3"
          />
        </Tooltip>
        <Tooltip content="新建对话" position="right">
          <Button
            theme="solid"
            type="primary"
            icon={<IconPlus />}
            onClick={onNewSession}
          />
        </Tooltip>
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
    <Sider
      style={{
        width: 260,
        backgroundColor: "var(--semi-color-nav-bg, rgba(249, 250, 251, 0.7))",
        borderRight: "1px solid var(--semi-color-border, rgba(229, 231, 235, 0.8))",
      }}
      className="flex flex-col h-full shrink-0 select-none"
    >
      {/* Header action bar */}
      <div className="p-3 border-b border-gray-200/60 dark:border-gray-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
            <IconClock size="small" className="text-gray-400" />
            <span>对话历史</span>
          </div>
          <Tooltip content="折叠侧边栏 (Ctrl+B)">
            <Button
              theme="borderless"
              type="tertiary"
              size="small"
              icon={<IconSidebar />}
              onClick={onToggleCollapse}
            />
          </Tooltip>
        </div>

        <Button
          theme="solid"
          type="primary"
          icon={<IconPlus />}
          block
          onClick={onNewSession}
          className="shadow-xs font-medium"
        >
          新建对话
        </Button>

        <Input
          prefix={<IconSearch />}
          placeholder="搜索会话..."
          size="small"
          showClear
          value={searchTerm}
          onChange={(val) => setSearchTerm(val)}
        />
      </div>

      {/* Sessions tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="p-4 text-center text-xs text-gray-400">加载历史对话中...</div>
        ) : !hasAnySessions ? (
          <div className="py-12 px-4 text-center">
            <Empty
              title={searchTerm ? "未找到匹配会话" : "暂无历史对话"}
              description={searchTerm ? "尝试其他关键词" : "点击上方新建对话开始交流"}
            />
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
      <Modal
        title="重命名会话"
        visible={!!renameTarget}
        onOk={handleConfirmRename}
        onCancel={() => setRenameTarget(null)}
        closeOnEsc
      >
        <div className="py-2">
          <Input
            value={newTitle}
            onChange={(val) => setNewTitle(val)}
            placeholder="请输入会话标题"
            autoFocus
            onEnterPress={handleConfirmRename}
          />
        </div>
      </Modal>
    </Sider>
  );
};
