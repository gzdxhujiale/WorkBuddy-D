import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import {
  Settings,
  Eraser,
  Sparkles,
  ChevronDown,
  Square,
  ArrowUp,
  Loader2,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
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

export interface ExtendedChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createAt?: number;
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  // 2. Fetch configured channels
  const { data: channels = [] } = useQuery<AIChannel[]>({
    queryKey: ["ai-channels"],
    queryFn: aiApi.listChannels,
  });

  // Flat list of model options with channel tagging
  const modelOptions = useMemo(() => {
    const list: Array<{ label: string; value: string; channelId: string; modelName: string }> = [
      {
        label: "⚡ 智能自动调度 (基于渠道优先级)",
        value: "auto",
        channelId: "",
        modelName: "",
      },
    ];

    channels
      .filter((c) => c.is_active)
      .forEach((ch) => {
        if (ch.models && ch.models.length > 0) {
          ch.models.forEach((m) => {
            list.push({
              label: `${m} (${ch.name})`,
              value: `${ch.id}::${m}`,
              channelId: ch.id,
              modelName: m,
            });
          });
        }
      });

    return list;
  }, [channels]);

  // Sync historical messages on session change
  const { data: serverMessages = [], isFetching: isFetchingMessages } = useQuery<AIMessage[]>({
    queryKey: ["ai-messages", currentSessionId],
    queryFn: () => (currentSessionId ? aiApi.listSessionMessages(currentSessionId) : Promise.resolve([])),
    enabled: !!currentSessionId,
  });

  useEffect(() => {
    if (!currentSessionId) {
      setChats([]);
      activeLoadedSessionIdRef.current = null;
      return;
    }

    if (activeLoadedSessionIdRef.current !== currentSessionId) {
      activeLoadedSessionIdRef.current = currentSessionId;
      const formatted: ExtendedChatMessage[] = serverMessages.map((m) => {
        let toolCalls: ToolCallItem[] | undefined;
        if (m.tool_calls) {
          try {
            toolCalls = typeof m.tool_calls === "string" ? JSON.parse(m.tool_calls) : m.tool_calls;
          } catch {}
        }
        return {
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          content: m.content || "",
          createAt: new Date(m.created_at).getTime(),
          reasoning_content: m.reasoning_content,
          tool_calls: toolCalls,
        };
      });
      setChats(formatted);
    }
  }, [currentSessionId, serverMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, isStreaming, isThinking]);

  // Clean-up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleStopGenerator = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setIsThinking(false);
    toast.info("已停止生成");
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    let targetSessionId = currentSessionId;
    if (!targetSessionId) {
      try {
        const titleSnippet = text.trim().slice(0, 16) || "新对话";
        const newSess = await aiApi.createSession({
          title: titleSnippet,
          skill_code: selectedSkill !== "general" ? selectedSkill : undefined,
          model_name: selectedModel || undefined,
        });
        targetSessionId = newSess.id;
        setCurrentSessionId(newSess.id);
        currentSessionIdRef.current = newSess.id;
        activeLoadedSessionIdRef.current = newSess.id;
        queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
      } catch (err: any) {
        toast.error("创建会话失败: " + err.message);
        return;
      }
    }

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ExtendedChatMessage = {
      id: userMsgId,
      role: "user",
      content: text,
      createAt: Date.now(),
    };

    const assistantMsgId = `assistant-${Date.now()}`;
    const placeholderAssistantMsg: ExtendedChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      createAt: Date.now(),
      reasoning_content: "",
      tool_calls: [],
      isThinking: false,
    };

    setChats((prev) => [...prev, userMsg, placeholderAssistantMsg]);
    setIsStreaming(true);
    setIsThinking(false);
    setCurrentAssistantMsgId(assistantMsgId);

    const historyPayload: ChatMessage[] = chats
      .slice(-10)
      .filter((c) => c.role === "user" || c.role === "assistant")
      .map((c) => ({
        role: c.role,
        content: c.content,
      }));

    historyPayload.push({ role: "user", content: text });

    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;
    const thinkingStartTime = Date.now();

    try {
      await aiApi.streamChat(
        {
          session_id: targetSessionId,
          messages: historyPayload,
          skill_code: selectedSkill !== "general" ? selectedSkill : undefined,
          channel_id: selectedChannelId || undefined,
          model: selectedModel || undefined,
          enable_tools: enableTools,
        },
        {
          onThinking: (chunk: string) => {
            setIsThinking(true);
            setChats((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      reasoning_content: (m.reasoning_content || "") + chunk,
                      isThinking: true,
                    }
                  : m
              )
            );
          },
          onContent: (chunk: string) => {
            setIsThinking(false);
            setChats((prev) =>
              prev.map((m) => {
                if (m.id === assistantMsgId) {
                  const duration = m.isThinking ? Date.now() - thinkingStartTime : m.thinkingDurationMs;
                  return {
                    ...m,
                    content: (m.content || "") + chunk,
                    isThinking: false,
                    thinkingDurationMs: duration,
                  };
                }
                return m;
              })
            );
          },
          onToolCall: (tool) => {
            setChats((prev) =>
              prev.map((m) => {
                if (m.id === assistantMsgId) {
                  const toolItem: ToolCallItem = {
                    id: tool.tool_id,
                    name: tool.tool_name,
                    arguments: tool.arguments,
                    status: "running",
                  };
                  const existingTools = m.tool_calls || [];
                  const foundIdx = existingTools.findIndex((t) => t.id === tool.tool_id);
                  let updatedTools: ToolCallItem[];
                  if (foundIdx >= 0) {
                    updatedTools = [...existingTools];
                    updatedTools[foundIdx] = toolItem;
                  } else {
                    updatedTools = [...existingTools, toolItem];
                  }
                  return {
                    ...m,
                    tool_calls: updatedTools,
                  };
                }
                return m;
              })
            );
          },
          onToolResult: (res) => {
            setChats((prev) =>
              prev.map((m) => {
                if (m.id === assistantMsgId) {
                  const existingTools = (m.tool_calls || []).map((t) =>
                    t.id === res.tool_id ? { ...t, result: res.output, status: "success" as const } : t
                  );
                  return {
                    ...m,
                    tool_calls: existingTools,
                  };
                }
                return m;
              })
            );
          },
          onDone: () => {
            setIsStreaming(false);
            setIsThinking(false);
            abortControllerRef.current = null;
            if (targetSessionId) {
              queryClient.invalidateQueries({ queryKey: ["ai-messages", targetSessionId] });
              queryClient.invalidateQueries({ queryKey: ["ai-sessions"] });
            }
          },
        },
        abortCtrl.signal
      );
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setIsStreaming(false);
        setIsThinking(false);
        toast.error("请求发送异常: " + err.message);
      }
    }
  };

  const handleClearContext = () => {
    setChats([]);
    toast.success("已清空当前聊天记录显示");
  };

  const currentSkillName = useMemo(() => {
    if (selectedSkill === "general") return "通用协同助手";
    const found = skills.find((s) => s.code === selectedSkill);
    return found ? found.name : selectedSkill;
  }, [selectedSkill, skills]);

  const currentModelLabel = useMemo(() => {
    if (!selectedChannelId || !selectedModel) return "自动模型分配";
    const found = modelOptions.find(
      (opt) => opt.channelId === selectedChannelId && opt.modelName === selectedModel
    );
    return found ? found.label : selectedModel;
  }, [selectedChannelId, selectedModel, modelOptions]);

  const handleModelChange = (val: string) => {
    if (val === "auto") {
      setSelectedChannelId("");
      setSelectedModel("");
    } else {
      const [chId, model] = val.split("::");
      setSelectedChannelId(chId || "");
      setSelectedModel(model || "");
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* 1. Left Session Sidebar */}
      <AISessionList
        currentSessionId={currentSessionId}
        onSelectSession={(session) => {
          setCurrentSessionId(session.id);
        }}
        onNewSession={() => {
          setCurrentSessionId(null);
          setChats([]);
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* 2. Main Chat Workspace */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Control Bar */}
        <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-card/40 shrink-0">
          <div className="flex items-center gap-2 overflow-hidden mr-2">
            <span className="text-sm font-semibold truncate text-foreground">
              {currentSession?.title || "新对话"}
            </span>
            <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground shrink-0">
              {currentSkillName}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearContext}
              title="清空当前消息"
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <Eraser className="size-3.5" />
              <span>清屏</span>
            </Button>

            {onOpenSettings && (
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenSettings}
                title="AI 网关渠道配置"
                className="h-8 text-xs gap-1"
              >
                <Settings className="size-3.5" />
                <span>AI配置</span>
              </Button>
            )}
          </div>
        </div>

        {/* Chat History Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 relative">
          {isFetchingMessages && (
            <div className="absolute top-2 right-4 z-10 bg-card/90 border border-border px-2.5 py-1 rounded-md shadow-xs text-xs text-muted-foreground flex items-center gap-1.5 backdrop-blur-xs">
              <Loader2 className="size-3 animate-spin text-primary" />
              <span>加载历史消息中...</span>
            </div>
          )}

          {chats.length === 0 && !isFetchingMessages && (
            <div className="h-full flex flex-col items-center justify-center text-center select-none px-4">
              <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3 shadow-xs">
                <Sparkles className="size-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                WorkBuddy AI 协同助手
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                输入消息开启高效对话，可在输入框上方自由切换模型与专项技能
              </p>
            </div>
          )}

          {chats.map((msg) => {
            const isAssistant = msg.role === "assistant";
            const isThinkingNow =
              isStreaming &&
              isAssistant &&
              msg.id === currentAssistantMsgId &&
              (msg.isThinking ?? isThinking);

            if (!isAssistant) {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="bg-primary/10 text-foreground rounded-2xl px-4 py-2.5 max-w-2xl border border-primary/20 shadow-xs text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {msg.content}
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className="flex justify-start">
                <div className="w-full max-w-3xl space-y-2 text-foreground">
                  {/* 1. Reasoning content block */}
                  {(msg.reasoning_content || isThinkingNow) && (
                    <AIThinkingBlock
                      content={msg.reasoning_content}
                      isGenerating={isThinkingNow}
                      durationMs={msg.thinkingDurationMs}
                    />
                  )}

                  {/* 2. Tool Calls Block */}
                  {msg.tool_calls && msg.tool_calls.length > 0 && (
                    <AIToolCallBlock toolCalls={msg.tool_calls} />
                  )}

                  {/* 3. Main Answer Markdown */}
                  {msg.content ? (
                    <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : isThinkingNow ? null : isStreaming ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-1.5">
                      <Loader2 className="size-3.5 animate-spin text-primary" />
                      <span>正在组织回答...</span>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Dock Area */}
        <div className="p-4 pt-1 bg-background shrink-0">
          <div className="border border-border rounded-2xl bg-card p-3 shadow-xs transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 flex flex-col gap-2">
            {/* Top Toolbar in Input Capsule */}
            <div className="flex items-center justify-between">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer select-none"
                  >
                    <Sparkles className="size-3 text-primary" />
                    <span>{currentSkillName}</span>
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48 max-h-60 overflow-y-auto">
                  <DropdownMenuItem onClick={() => setSelectedSkill("general")}>
                    💬 通用协同助手
                  </DropdownMenuItem>
                  {skills.map((s) => (
                    <DropdownMenuItem key={s.code} onClick={() => setSelectedSkill(s.code)}>
                      {s.code === "daily_review_synthesis" && "🌟 "}
                      {s.code === "task_quadrant_breakdown" && "🎯 "}
                      {s.code === "project_stage_planning" && "📊 "}
                      {s.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="text-[11px] text-muted-foreground select-none hidden sm:block">
                <span>Enter 发送 / Shift + Enter 换行</span>
              </div>
            </div>

            {/* Textarea */}
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
              className="w-full resize-none border-0 bg-transparent px-1 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed max-h-48 overflow-y-auto"
            />

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-border/60">
              <div className="flex items-center gap-1.5">
                {/* Model Selector Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      <span>{currentModelLabel}</span>
                      <ChevronDown className="size-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 max-h-60 overflow-y-auto">
                    {modelOptions.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => handleModelChange(opt.value)}
                      >
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Enable Tools Button */}
                <button
                  type="button"
                  onClick={() => setEnableTools(!enableTools)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] transition-colors cursor-pointer ${
                    enableTools
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                  title="启用工具调用与外部 MCP 能力"
                >
                  <Wrench className="size-3" />
                  <span>工具调用</span>
                </button>
              </div>

              {/* Stop / Send Button */}
              <div>
                {isStreaming ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleStopGenerator}
                    className="size-8 p-0 rounded-lg text-destructive hover:text-destructive"
                    title="停止生成"
                  >
                    <Square className="size-3.5 fill-current" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
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
                    disabled={!inputText.trim()}
                    className="size-8 p-0 rounded-lg shadow-xs"
                    title="发送"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
