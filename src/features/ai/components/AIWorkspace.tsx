import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Chat,
  Button,
  Tag,
  Dropdown,
  Toast,
  Spin,
  Layout,
  Tooltip,
  MarkdownRender,
} from "@douyinfe/semi-ui";
import {
  IconSetting,
  IconClear,
  IconSidebar,
  IconPlus,
  IconChevronDown,
  IconArrowRight,
} from "@douyinfe/semi-icons";
import type { Message } from "@douyinfe/semi-ui/lib/es/chat/interface";
import { aiApi } from "../api/aiApi";
import type {
  SkillItem,
  AIChannel,
  ChatMessage,
  AISession,
  AIMessage,
  ToolCallItem,
} from "../types";
import { AISessionList } from "./AISessionList";
import { AIThinkingBlock } from "./AIThinkingBlock";
import { AIToolCallBlock } from "./AIToolCallBlock";

const { Content } = Layout;

export interface ExtendedChatMessage extends Message {
  reasoning_content?: string;
  tool_calls?: ToolCallItem[];
  thinkingDurationMs?: number;
  isThinking?: boolean;
}

export function AIWorkspace({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const queryClient = useQueryClient();

  // Sidebar & Session State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // Session sync tracking ref to avoid wiping local optimistic messages
  const activeLoadedSessionIdRef = useRef<string | null>(null);

  // Model & Skill Selection
  const [selectedSkill, setSelectedSkill] = useState<string>("general");
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [enableTools, setEnableTools] = useState<boolean>(true);

  // Streaming State
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [currentAssistantMsgId, setCurrentAssistantMsgId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Input Box State
  const [inputText, setInputText] = useState("");
  const isComposingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  // Chat message list
  const [chats, setChats] = useState<ExtendedChatMessage[]>([]);

  // Fetch all sessions for title and state management
  const { data: allSessions = [] } = useQuery<AISession[]>({
    queryKey: ["ai-sessions"],
    queryFn: aiApi.listSessions,
  });

  const currentSession = allSessions.find((s) => s.id === currentSessionId);

  // 1. Fetch available skills
  const { data: skills = [] } = useQuery<SkillItem[]>({
    queryKey: ["ai-skills"],
    queryFn: aiApi.listSkills,
  });

  // 2. Fetch active channels for channel & model selection
  const { data: channels = [] } = useQuery<AIChannel[]>({
    queryKey: ["ai-channels"],
    queryFn: aiApi.listChannels,
  });

  const activeChannels = useMemo(() => channels.filter((c) => c.is_active), [channels]);

  // Model selection options
  const modelOptions = useMemo(() => {
    const opts: Array<{ label: string; value: string; channelId: string; modelName: string }> = [
      {
        label: "🚀 智能自动调度 (最高优先级渠道)",
        value: "auto",
        channelId: "",
        modelName: "",
      },
    ];

    for (const ch of activeChannels) {
      if (ch.models && ch.models.length > 0) {
        for (const m of ch.models) {
          opts.push({
            label: `[${ch.name}] ${m}`,
            value: `${ch.id}::${m}`,
            channelId: ch.id,
            modelName: m,
          });
        }
      } else {
        opts.push({
          label: `[${ch.name}] 默认模型`,
          value: `${ch.id}::default`,
          channelId: ch.id,
          modelName: "default",
        });
      }
    }
    return opts;
  }, [activeChannels]);

  const currentModelLabel = useMemo(() => {
    if (!selectedChannelId && !selectedModel) {
      return "🚀 智能调度";
    }
    const found = modelOptions.find(
      (opt) => opt.channelId === selectedChannelId && opt.modelName === selectedModel
    );
    if (found) {
      return found.label;
    }
    return selectedModel ? selectedModel : "🚀 智能调度";
  }, [selectedChannelId, selectedModel, modelOptions]);

  const currentSkillName = useMemo(() => {
    if (selectedSkill === "general") return "通用协同助手";
    const found = skills.find((s) => s.code === selectedSkill);
    return found ? found.name : "协同助手";
  }, [selectedSkill, skills]);

  // 3. Load messages when currentSessionId changes
  const { data: serverMessages, isFetching: isFetchingMessages } = useQuery<AIMessage[]>({
    queryKey: ["ai-messages", currentSessionId],
    queryFn: () => (currentSessionId ? aiApi.listSessionMessages(currentSessionId) : Promise.resolve([])),
    enabled: !!currentSessionId,
  });

  // Sync server messages only when user explicitly switches to another existing session from sidebar
  useEffect(() => {
    // 1. If currently streaming, NEVER overwrite local chats
    if (isStreaming) {
      return;
    }

    // 2. Only reload if user selected an existing session that hasn't been loaded into current view
    if (currentSessionId && currentSessionId !== activeLoadedSessionIdRef.current) {
      if (serverMessages && serverMessages.length > 0) {
        activeLoadedSessionIdRef.current = currentSessionId;
        const mapped: ExtendedChatMessage[] = serverMessages.map((m) => {
          let toolCalls: ToolCallItem[] = [];
          if (Array.isArray(m.tool_calls)) {
            toolCalls = m.tool_calls;
          } else if (typeof m.tool_calls === "string") {
            try {
              const parsed = JSON.parse(m.tool_calls);
              if (Array.isArray(parsed)) toolCalls = parsed;
            } catch {}
          }
          return {
            id: m.id,
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
            reasoning_content: m.reasoning_content,
            tool_calls: toolCalls,
            createAt: new Date(m.created_at).getTime(),
            thinkingDurationMs: m.thinking_duration_ms,
            status: "complete",
          };
        });
        setChats(mapped);
      }
    }
  }, [serverMessages, currentSessionId, isStreaming]);

  // Clean up streaming on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Handlers for session switching
  const handleSelectSession = (session: AISession) => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
      setIsThinking(false);
    }
    activeLoadedSessionIdRef.current = null; // Allow syncing the selected session's messages
    setCurrentSessionId(session.id);
    if (session.skill_code) {
      setSelectedSkill(session.skill_code);
    }
    if (session.model_name) {
      setSelectedModel(session.model_name);
    }
  };

  const handleNewSession = () => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
      setIsThinking(false);
    }
    activeLoadedSessionIdRef.current = null;
    setCurrentSessionId(null);
    setChats([]);
  };

  // Model switch
  const handleModelChange = (value: string) => {
    const found = modelOptions.find((opt) => opt.value === value);
    if (found) {
      setSelectedChannelId(found.channelId);
      setSelectedModel(found.modelName);
    }
  };

  // Main chat sending handler
  const handleSendMessage = async (inputContent: string) => {
    if (!inputContent.trim() || isStreaming) return;

    if (activeChannels.length === 0) {
      Toast.warning("尚未配置或启用任何 AI 模型渠道，请前往「设置 - AI配置」添加");
      return;
    }

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;
    const startTime = Date.now();

    const userMsg: ExtendedChatMessage = {
      role: "user",
      id: userMsgId,
      createAt: Date.now(),
      content: inputContent,
    };

    const assistantMsg: ExtendedChatMessage = {
      role: "assistant",
      id: assistantMsgId,
      createAt: Date.now(),
      content: "",
      reasoning_content: "",
      tool_calls: [],
      status: "loading",
      isThinking: true,
    };

    const newChats = [...chats, userMsg, assistantMsg];
    setChats(newChats);
    setIsStreaming(true);
    setIsThinking(true);
    setCurrentAssistantMsgId(assistantMsgId);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Prepare message history
    const apiMessages: ChatMessage[] = newChats
      .filter((c) => c.id !== assistantMsgId && typeof c.content === "string" && c.content.trim() !== "")
      .slice(-10)
      .map((c) => ({
        role: (c.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: typeof c.content === "string" ? c.content : "",
        reasoning_content: c.reasoning_content,
      }));

    let accumulatedContent = "";
    let accumulatedThinking = "";
    let accumulatedTools: ToolCallItem[] = [];
    let isStillThinking = true;
    let thinkingDuration: number | undefined;

    try {
      await aiApi.streamChat(
        {
          session_id: currentSessionIdRef.current || undefined,
          messages: apiMessages,
          channel_id: selectedChannelId || undefined,
          model: selectedModel || undefined,
          skill_code: selectedSkill !== "general" ? selectedSkill : undefined,
          date: new Date().toISOString().split("T")[0],
          enable_tools: enableTools,
        },
        {
          onSession: (sessionId) => {
            currentSessionIdRef.current = sessionId;
            activeLoadedSessionIdRef.current = sessionId;
            setCurrentSessionId(sessionId);
            queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
          },
          onThinking: (chunk) => {
            accumulatedThinking += chunk;
            setChats((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? {
                      ...msg,
                      reasoning_content: accumulatedThinking,
                      isThinking: true,
                      status: "loading",
                    }
                  : msg
              )
            );
          },
          onContent: (chunk) => {
            if (isStillThinking) {
              isStillThinking = false;
              thinkingDuration = Date.now() - startTime;
              setIsThinking(false);
            }
            accumulatedContent += chunk;
            setChats((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? {
                      ...msg,
                      content: accumulatedContent,
                      reasoning_content: accumulatedThinking,
                      thinkingDurationMs: thinkingDuration,
                      isThinking: false,
                      status: "loading",
                    }
                  : msg
              )
            );
          },
          onToolCall: (tool) => {
            const newItem: ToolCallItem = {
              id: tool.tool_id,
              name: tool.tool_name,
              arguments: tool.arguments,
              status: "running",
            };
            accumulatedTools = [...accumulatedTools, newItem];
            setChats((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? {
                      ...msg,
                      tool_calls: accumulatedTools,
                    }
                  : msg
              )
            );
          },
          onToolResult: (res) => {
            accumulatedTools = accumulatedTools.map((t) =>
              t.id === res.tool_id
                ? {
                    ...t,
                    result: res.output,
                    status: "success",
                  }
                : t
            );
            setChats((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? {
                      ...msg,
                      tool_calls: accumulatedTools,
                    }
                  : msg
              )
            );
          },
          onDone: () => {
            // Signal completed
          },
        },
        controller.signal
      );

      // Successfully finished
      setChats((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: accumulatedContent || "已完成响应。",
                reasoning_content: accumulatedThinking,
                thinkingDurationMs: thinkingDuration || (accumulatedThinking ? Date.now() - startTime : undefined),
                isThinking: false,
                status: "complete",
              }
            : msg
        )
      );

      // Invalidate sessions list and messages
      const finalSessionId = currentSessionIdRef.current;
      queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
      if (finalSessionId) {
        queryClient.invalidateQueries({ queryKey: ["ai-messages", finalSessionId] });
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        Toast.info("生成已中止");
        setChats((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: accumulatedContent ? `${accumulatedContent}\n\n*(已中止生成)*` : "*(已中止生成)*",
                  isThinking: false,
                  status: "complete",
                }
              : msg
          )
        );
      } else {
        const errorMsg = err.message || "请求 AI 服务失败";
        Toast.error(errorMsg);
        setChats((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: `⚠️ 生成遇到错误: ${errorMsg}\n\n请检查渠道端点与密钥配置。`,
                  isThinking: false,
                  status: "error",
                }
              : msg
          )
        );
      }
    } finally {
      setIsStreaming(false);
      setIsThinking(false);
      setCurrentAssistantMsgId(null);
      abortControllerRef.current = null;
    }
  };

  const handleStopGenerator = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleClearContext = () => {
    setChats([]);
    Toast.success("当前对话显示已清空");
  };

  return (
    <Layout className="h-full w-full overflow-hidden flex flex-row bg-background text-foreground">
      {/* Left Column: Session History Sider */}
      <AISessionList
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Right Column: Main Chat & Input Area */}
      <Content className="flex flex-col h-full flex-1 overflow-hidden min-w-0 bg-white dark:bg-gray-950">
        {/* Top Header */}
        <div className="border-b border-gray-200/80 dark:border-gray-800 bg-white/70 dark:bg-gray-950/70 backdrop-blur-sm px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {sidebarCollapsed && (
              <Tooltip content="展开对话历史 (Ctrl+B)">
                <Button
                  theme="borderless"
                  type="tertiary"
                  size="small"
                  icon={<IconSidebar />}
                  onClick={() => setSidebarCollapsed(false)}
                />
              </Tooltip>
            )}
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 font-bold text-sm shrink-0">
              ✨
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm truncate max-w-xs" title={currentSession?.title}>
                  {currentSession?.title || (currentSessionId ? "当前会话" : "新对话")}
                </span>
                <Tag color="violet" size="small" type="light">
                  Eino 驱动
                </Tag>
              </div>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="small"
              theme="borderless"
              type="tertiary"
              icon={<IconClear />}
              onClick={handleClearContext}
              title="清空当前消息"
            >
              清屏
            </Button>

            {onOpenSettings && (
              <Button
                size="small"
                theme="light"
                icon={<IconSetting />}
                onClick={onOpenSettings}
                title="AI 网关渠道配置"
              >
                AI配置
              </Button>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-hidden p-4 flex flex-col min-h-0 relative">
          {isFetchingMessages && (
            <div className="absolute top-2 right-4 z-10 bg-white/80 dark:bg-gray-900/80 px-2 py-1 rounded shadow-xs text-xs text-gray-400 flex items-center gap-1.5 backdrop-blur-xs">
              <Spin size="small" />
              <span>加载历史消息中...</span>
            </div>
          )}

          {/* Clean minimal empty state placeholder */}
          {chats.length === 0 && !isFetchingMessages && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none px-4 z-0">
              <div className="size-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-2xl font-bold mb-3 shadow-xs">
                ✨
              </div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                WorkBuddy AI 协同助手
              </h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                输入消息开启高效对话，可在输入框上方自由切换模型与专项技能
              </p>
            </div>
          )}

          <Chat
            chats={chats}
            onMessageSend={handleSendMessage}
            showStopGenerate={isStreaming}
            onStopGenerator={handleStopGenerator}
            mode="userBubble"
            roleConfig={{
              user: {
                name: "",
                avatar: null,
              },
              assistant: {
                name: "",
                avatar: null,
              },
            }}
            chatBoxRenderConfig={{
              renderChatBoxAvatar: () => null,
              renderChatBoxTitle: () => null,
              renderChatBoxContent: ({ message }) => {
                const msg = message as ExtendedChatMessage;
                const isAssistant = msg?.role === "assistant";
                const isThinkingNow =
                  isStreaming &&
                  isAssistant &&
                  msg?.id === currentAssistantMsgId &&
                  (msg?.isThinking ?? isThinking);

                if (!isAssistant) {
                  return (
                    <div className="bg-gray-100 dark:bg-gray-800/90 text-gray-900 dark:text-gray-100 rounded-2xl px-4 py-2.5 max-w-2xl border border-gray-200/60 dark:border-gray-700/60 shadow-xs text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {typeof msg?.content === "string" ? msg.content : ""}
                    </div>
                  );
                }

                return (
                  <div className="w-full space-y-2 text-foreground">
                    {/* 1. Deep Thinking Chain Block */}
                    {(msg?.reasoning_content || isThinkingNow) && (
                      <AIThinkingBlock
                        content={msg?.reasoning_content}
                        isGenerating={isThinkingNow}
                        durationMs={msg?.thinkingDurationMs}
                      />
                    )}

                    {/* 2. Tool Calls Block */}
                    {msg?.tool_calls && msg.tool_calls.length > 0 && (
                      <AIToolCallBlock toolCalls={msg.tool_calls} />
                    )}

                    {/* 3. Main Answer via Semi MarkdownRender */}
                    {msg?.content ? (
                      <div className="semi-markdown-wrapper text-sm leading-relaxed">
                        <MarkdownRender raw={typeof msg.content === "string" ? msg.content : ""} />
                      </div>
                    ) : isThinkingNow ? null : isStreaming ? (
                      <div className="flex items-center gap-2 text-xs text-gray-400 py-1.5">
                        <Spin size="small" />
                        <span>正在组织回答...</span>
                      </div>
                    ) : null}
                  </div>
                );
              },
            }}
            renderInputArea={() => {
              const currentModelValue = selectedChannelId && selectedModel
                ? `${selectedChannelId}::${selectedModel}`
                : "auto";

              return (
                <div className="border border-gray-200/90 dark:border-gray-800 rounded-2xl bg-white/95 dark:bg-gray-900/90 p-3 shadow-sm transition-all focus-within:border-blue-500/80 focus-within:ring-2 focus-within:ring-blue-500/20 backdrop-blur-xs flex flex-col gap-2">
                  {/* Top: Skill / Mode Badge */}
                  <div className="flex items-center justify-between">
                    <Dropdown
                      position="topLeft"
                      render={
                        <Dropdown.Menu style={{ maxHeight: 260, overflowY: "auto" }}>
                          <Dropdown.Item
                            active={selectedSkill === "general"}
                            onClick={() => setSelectedSkill("general")}
                          >
                            💬 通用协同助手
                          </Dropdown.Item>
                          {skills.map((s) => (
                            <Dropdown.Item
                              key={s.code}
                              active={selectedSkill === s.code}
                              onClick={() => setSelectedSkill(s.code)}
                            >
                              {s.code === "daily_review_synthesis" && "🌟 "}
                              {s.code === "task_quadrant_breakdown" && "🎯 "}
                              {s.code === "project_stage_planning" && "📊 "}
                              {s.name}
                            </Dropdown.Item>
                          ))}
                        </Dropdown.Menu>
                      }
                    >
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 hover:bg-gray-200/80 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer select-none"
                      >
                        <span className="text-blue-500">✨</span>
                        <span>{currentSkillName}</span>
                        <IconChevronDown size="extra-small" className="text-gray-400" />
                      </button>
                    </Dropdown>

                    <div className="text-[11px] text-gray-400 select-none hidden sm:block">
                      <span>Enter 发送 / Shift + Enter 换行</span>
                    </div>
                  </div>

                  {/* Middle: Borderless Auto-resizing Textarea */}
                  <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={handleInputChange}
                    onCompositionStart={() => {
                      isComposingRef.current = true;
                    }}
                    onCompositionEnd={() => {
                      isComposingRef.current = false;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        if (isComposingRef.current) return;
                        e.preventDefault();
                        if (inputText.trim() && !isStreaming) {
                          const text = inputText;
                          setInputText("");
                          if (textareaRef.current) {
                            textareaRef.current.style.height = "auto";
                          }
                          handleSendMessage(text);
                        }
                      }
                    }}
                    placeholder="输入你的想法，或让 AI 为你规划任务..."
                    rows={2}
                    className="w-full resize-none border-0 bg-transparent px-1 py-1 text-sm text-foreground placeholder:text-gray-400 focus:outline-hidden focus:ring-0 leading-relaxed max-h-48 overflow-y-auto"
                  />

                  {/* Bottom: Left (Plus + Model Capsule) & Right (MCP + Send Button) */}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800/60">
                    <div className="flex items-center gap-1.5">
                      <Tooltip content="添加附件与上下文 (规划中)">
                        <button
                          type="button"
                          className="size-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                        >
                          <IconPlus size="small" />
                        </button>
                      </Tooltip>

                      {/* Model Selector Capsule */}
                      <Dropdown
                        position="topLeft"
                        render={
                          <Dropdown.Menu style={{ maxHeight: 260, overflowY: "auto" }}>
                            {modelOptions.map((opt) => (
                              <Dropdown.Item
                                key={opt.value}
                                active={currentModelValue === opt.value}
                                onClick={() => handleModelChange(opt.value)}
                              >
                                {opt.label}
                              </Dropdown.Item>
                            ))}
                          </Dropdown.Menu>
                        }
                      >
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer select-none"
                        >
                          <span className="truncate max-w-[180px]">{currentModelLabel}</span>
                          <IconChevronDown size="extra-small" className="text-gray-400" />
                        </button>
                      </Dropdown>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* MCP Toggle */}
                      <button
                        type="button"
                        onClick={() => setEnableTools(!enableTools)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono transition-colors cursor-pointer select-none ${
                          enableTools
                            ? "bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 font-medium"
                            : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                        title={enableTools ? "点击关闭 MCP 工具调用" : "点击开启 MCP 工具调用"}
                      >
                        <span>⚡</span>
                        <span>MCP</span>
                      </button>

                      {/* Send / Stop Button */}
                      {isStreaming ? (
                        <button
                          type="button"
                          onClick={handleStopGenerator}
                          className="size-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                          title="停止生成"
                        >
                          <div className="size-2.5 bg-white rounded-xs" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!inputText.trim() || activeChannels.length === 0}
                          onClick={() => {
                            if (inputText.trim()) {
                              const text = inputText;
                              setInputText("");
                              if (textareaRef.current) {
                                textareaRef.current.style.height = "auto";
                              }
                              handleSendMessage(text);
                            }
                          }}
                          className={`size-7 rounded-full flex items-center justify-center transition-all ${
                            inputText.trim() && activeChannels.length > 0
                              ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs active:scale-95"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                          }`}
                          title="发送 (Enter)"
                        >
                          <IconArrowRight size="small" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }}
            placeholder="输入你的想法，或点击上方推荐提示词..."
            style={{ height: "100%", width: "100%" }}
          />
        </div>
      </Content>
    </Layout>
  );
}
