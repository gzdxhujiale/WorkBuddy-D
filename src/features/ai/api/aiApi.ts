import { apiClient, API_BASE_URL, getAuthToken } from "@/lib/apiClient";
import type {
  AIChannel,
  ChannelCreateInput,
  PingResult,
  AIMetricsResponse,
  SkillItem,
  ChatStreamPayload,
  AISession,
  AIMessage,
  SessionCreateInput,
  SessionUpdateInput,
  StreamChatCallbacks,
} from "../types";

export const aiApi = {
  listChannels: async (): Promise<AIChannel[]> => {
    return apiClient.get<AIChannel[]>("/api/v1/ai/channels");
  },

  createChannel: async (data: ChannelCreateInput): Promise<AIChannel> => {
    return apiClient.post<AIChannel>("/api/v1/ai/channels", data);
  },

  updateChannel: async (id: string, data: ChannelCreateInput): Promise<AIChannel> => {
    return apiClient.put<AIChannel>(`/api/v1/ai/channels/${id}`, data);
  },

  deleteChannel: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/api/v1/ai/channels/${id}`);
  },

  pingChannel: async (id: string): Promise<PingResult> => {
    return apiClient.post<PingResult>(`/api/v1/ai/channels/${id}/ping`);
  },

  getMetrics: async (days: number = 7): Promise<AIMetricsResponse> => {
    return apiClient.get<AIMetricsResponse>(`/api/v1/ai/metrics?days=${days}`);
  },

  listSkills: async (): Promise<SkillItem[]> => {
    return apiClient.get<SkillItem[]>("/api/v1/ai/skills");
  },

  listSessions: async (): Promise<AISession[]> => {
    return apiClient.get<AISession[]>("/api/v1/ai/sessions");
  },

  createSession: async (data: SessionCreateInput): Promise<AISession> => {
    return apiClient.post<AISession>("/api/v1/ai/sessions", data);
  },

  getSession: async (id: string): Promise<AISession> => {
    return apiClient.get<AISession>(`/api/v1/ai/sessions/${id}`);
  },

  updateSession: async (id: string, data: SessionUpdateInput): Promise<AISession> => {
    return apiClient.put<AISession>(`/api/v1/ai/sessions/${id}`, data);
  },

  deleteSession: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/api/v1/ai/sessions/${id}`);
  },

  listSessionMessages: async (sessionId: string): Promise<AIMessage[]> => {
    return apiClient.get<AIMessage[]>(`/api/v1/ai/sessions/${sessionId}/messages`);
  },

  streamChat: async (
    payload: ChatStreamPayload,
    callbacksOrChunk: StreamChatCallbacks | ((chunk: string) => void),
    signal?: AbortSignal
  ): Promise<void> => {
    const cb: StreamChatCallbacks =
      typeof callbacksOrChunk === "function"
        ? { onContent: callbacksOrChunk }
        : callbacksOrChunk;

    const token = getAuthToken();
    const url = `${API_BASE_URL}/api/v1/ai/chat`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      let errMsg = `请求失败: HTTP ${res.status}`;
      try {
        const data = await res.json();
        errMsg = data.error || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("环境不支持流式响应");
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";

      for (const block of blocks) {
        if (!block.trim()) continue;
        const lines = block.split("\n");
        let eventType = "message";
        let dataStr = "";
        for (const l of lines) {
          const trimmed = l.trim();
          if (trimmed.startsWith("event:")) {
            eventType = trimmed.slice(6).trim();
          } else if (trimmed.startsWith("data:")) {
            const val = trimmed.slice(5).trim();
            dataStr = dataStr ? `${dataStr}\n${val}` : val;
          }
        }

        if (!dataStr) continue;

        let parsed: any;
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          parsed = { content: dataStr };
        }

        if (eventType === "error" || parsed.error) {
          throw new Error(parsed.error || "AI service error");
        }

        if (eventType === "session" && parsed.session_id) {
          cb.onSession?.(parsed.session_id);
        } else if (eventType === "thinking") {
          const thinkingText = parsed.thinking ?? parsed.content;
          if (thinkingText) {
            cb.onThinking?.(thinkingText);
          }
        } else if (eventType === "content" && parsed.content) {
          cb.onContent?.(parsed.content);
        } else if (eventType === "tool_call") {
          cb.onToolCall?.(parsed);
        } else if (eventType === "tool_result") {
          cb.onToolResult?.(parsed);
        } else if (eventType === "done") {
          cb.onDone?.();
        } else if (eventType === "message" && parsed.content) {
          cb.onContent?.(parsed.content);
        }
      }
    }
  },
};

