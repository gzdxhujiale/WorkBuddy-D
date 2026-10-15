import { apiClient } from "./apiClient";

export interface DeltaEvent {
  type: string;
  seq_id?: number;
  table: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  id: string;
  folder_id?: string;
  data?: unknown;
}

interface SyncResponse {
  latest_seq: number;
  since_seq: number;
  has_more: boolean;
  changes: Array<{
    seq_id: number;
    entity_type: string;
    entity_id: string;
    action: "INSERT" | "UPDATE" | "DELETE";
    payload: unknown;
    created_at: string;
  }>;
}

type DeltaListener = (event: DeltaEvent) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Set<DeltaListener> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private isExplicitlyClosed = false;
  private token: string | null = null;
  private userId: string | null = null;
  private lastSeqId: number = 0;

  constructor() {
    this.loadSeqId();
  }

  setUserId(userId: string | null) {
    this.userId = userId;
    this.loadSeqId();
  }

  getUserId(): string | null {
    return this.userId;
  }

  getLastSeqId(): number {
    return this.lastSeqId;
  }

  private getStorageKey(): string {
    return this.userId ? `workbuddy_last_seq_id:${this.userId}` : "workbuddy_last_seq_id";
  }

  loadSeqId() {
    this.lastSeqId = 0;
    try {
      const saved = localStorage.getItem(this.getStorageKey());
      if (saved) {
        this.lastSeqId = parseInt(saved, 10) || 0;
      }
    } catch {
      // Storage unavailable
    }
  }

  saveSeqId(seqId: number) {
    if (seqId > this.lastSeqId) {
      this.lastSeqId = seqId;
      try {
        localStorage.setItem(this.getStorageKey(), String(seqId));
      } catch {
        // Storage unavailable
      }
    }
  }

  clearSeqId() {
    try {
      localStorage.removeItem(this.getStorageKey());
    } catch {
      // Storage unavailable
    }
    this.lastSeqId = 0;
  }

  async syncMissedDeltas() {
    if (!this.token) return;
    try {
      let hasMore = true;
      let iterations = 0;
      const MAX_ITERATIONS = 100;

      while (hasMore && iterations < MAX_ITERATIONS) {
        iterations++;
        const res = await apiClient.get<SyncResponse>(`/api/v1/sync?since_seq=${this.lastSeqId}`);
        if (!res || !res.changes || res.changes.length === 0) {
          if (res && typeof res.latest_seq === "number" && res.latest_seq > this.lastSeqId) {
            this.saveSeqId(res.latest_seq);
          }
          break;
        }

        for (const item of res.changes) {
          if (typeof item.seq_id === "number") {
            this.saveSeqId(item.seq_id);
          }
          const event: DeltaEvent = {
            type: "ENTITY_DELTA",
            seq_id: item.seq_id,
            table: item.entity_type,
            action: item.action,
            id: item.entity_id,
            data: item.payload,
          };
          this.listeners.forEach((listener) => listener(event));
        }

        if (res.latest_seq > this.lastSeqId && !res.has_more) {
          this.saveSeqId(res.latest_seq);
        }

        hasMore = Boolean(res.has_more);
      }
    } catch {
      // Offline or network error
    }
  }

  handleIncomingMessage(raw: unknown) {
    if (typeof raw !== "string") return;
    const lines = raw.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const payload = JSON.parse(trimmed);
        if (payload && payload.type === "ENTITY_DELTA") {
          if (typeof payload.seq_id === "number") {
            this.saveSeqId(payload.seq_id);
          }
          this.listeners.forEach((listener) => listener(payload as DeltaEvent));
        }
      } catch {
        // Ignore malformed JSON line
      }
    }
  }

  connect(token: string, userId?: string) {
    this.token = token;
    if (userId) {
      this.setUserId(userId);
    }
    this.isExplicitlyClosed = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws";
    const url = `${wsUrl}?token=${encodeURIComponent(token)}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        // Synchronize missed deltas immediately upon connection
        this.syncMissedDeltas();
      };

      this.ws.onmessage = (event) => {
        this.handleIncomingMessage(event.data);
      };

      this.ws.onclose = () => {
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  disconnect(clearState = false) {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (clearState) {
      this.clearSeqId();
      this.userId = null;
      this.token = null;
    }
  }

  subscribe(listener: DeltaListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.isExplicitlyClosed || !this.token) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (this.token && !this.isExplicitlyClosed) {
        this.connect(this.token, this.userId || undefined);
      }
    }, 3000);
  }
}

export const wsClient = new WebSocketClient();
