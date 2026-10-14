export interface DeltaEvent {
  type: string;
  table: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  id: string;
  folder_id?: string;
  data?: unknown;
}

type DeltaListener = (event: DeltaEvent) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Set<DeltaListener> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private isExplicitlyClosed = false;
  private token: string | null = null;

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
        // Connected
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "ENTITY_DELTA") {
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
