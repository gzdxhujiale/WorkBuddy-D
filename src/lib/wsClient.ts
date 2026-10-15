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

class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Set<DeltaListener> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private isExplicitlyClosed = false;
  private token: string | null = null;
  private lastSeqId: number = 0;

  constructor() {
    try {
      const saved = localStorage.getItem("workbuddy_last_seq_id");
      if (saved) {
        this.lastSeqId = parseInt(saved, 10) || 0;
      }
    } catch {
      // Storage unavailable
    }
  }

  private saveSeqId(seqId: number) {
    if (seqId > this.lastSeqId) {
      this.lastSeqId = seqId;
      try {
        localStorage.setItem("workbuddy_last_seq_id", String(seqId));
      } catch {
        // Storage unavailable
      }
    }
  }

  async syncMissedDeltas() {
    if (!this.token) return;
    try {
      const res = await apiClient.get<SyncResponse>(`/api/v1/sync?since_seq=${this.lastSeqId}`);
      if (res && res.changes && res.changes.length > 0) {
        for (const item of res.changes) {
          this.saveSeqId(item.seq_id);
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
      }
      if (res && res.latest_seq > this.lastSeqId) {
        this.saveSeqId(res.latest_seq);
      }
    } catch {
      // Offline or network error
    }
  }

  connect(token: string) {
    this.token = token;
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
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "ENTITY_DELTA") {
            if (typeof payload.seq_id === "number") {
              this.saveSeqId(payload.seq_id);
            }
            this.listeners.forEach((listener) => listener(payload as DeltaEvent));
          }
        } catch {
          // Ignore invalid frames
        }
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

  disconnect() {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
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
        this.connect(this.token);
      }
    }, 3000);
  }
}

export const wsClient = new WebSocketClient();
