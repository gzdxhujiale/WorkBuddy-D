export type AIProvider = "openai" | "deepseek" | "claude" | "ollama" | "siliconflow" | "custom";

export interface AIChannel {
  id: string;
  name: string;
  provider: AIProvider;
  base_url: string;
  api_key?: string;
  models: string[];
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface ChannelCreateInput {
  name: string;
  provider: AIProvider;
  base_url?: string;
  api_key?: string;
  models: string[];
  is_active: boolean;
  priority: number;
}

export interface PingResult {
  status: "online" | "offline";
  latency_ms: number;
  error?: string;
}

export interface AIInvocationLog {
  id: string;
  user_id: string;
  skill_code: string;
  model_name: string;
  provider: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_latency_ms: number;
  ttft_ms: number;
  status_code: number;
  error_msg: string;
  created_at: string;
}

export interface AIMetricsSummary {
  total_calls: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  avg_latency_ms: number;
  avg_ttft_ms: number;
}

export interface AIMetricsResponse {
  summary: AIMetricsSummary;
  logs: AIInvocationLog[];
}

export interface SkillItem {
  code: string;
  name: string;
  description: string;
  icon: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  reasoning_content?: string;
}

export interface ToolCallItem {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: string;
  status: "pending" | "running" | "success" | "error";
  duration_ms?: number;
}

export interface AIMessage {
  id: string;
  session_id: string;
  role: "system" | "user" | "assistant";
  content: string;
  reasoning_content?: string;
  tool_calls?: ToolCallItem[];
  created_at: string;
  thinking_duration_ms?: number;
}

export interface AISession {
  id: string;
  user_id: string;
  title: string;
  skill_code: string;
  model_name: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionCreateInput {
  title?: string;
  skill_code?: string;
  model_name?: string;
  is_pinned?: boolean;
}

export interface SessionUpdateInput {
  title?: string;
  skill_code?: string;
  model_name?: string;
  is_pinned?: boolean;
}

export interface ChatStreamPayload {
  session_id?: string;
  messages: ChatMessage[];
  model?: string;
  channel_id?: string;
  skill_code?: string;
  date?: string;
  enable_tools?: boolean;
}

export interface StreamChatCallbacks {
  onSession?: (sessionId: string) => void;
  onThinking?: (thinkingChunk: string) => void;
  onContent?: (contentChunk: string) => void;
  onToolCall?: (tool: { tool_id: string; tool_name: string; arguments: any }) => void;
  onToolResult?: (result: { tool_id: string; output: string }) => void;
  onDone?: () => void;
}

