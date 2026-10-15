import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage for node environment
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, val: string) => storage.set(key, String(val)),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

import { WebSocketClient, DeltaEvent } from "@/lib/wsClient";
import { apiClient } from "@/lib/apiClient";

describe("WebSocketClient", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("splits incoming newline-delimited WebSocket text frames and parses each line as JSON", () => {
    const client = new WebSocketClient();
    const received: DeltaEvent[] = [];
    client.subscribe((event) => received.push(event));

    // Single JSON message
    const single = JSON.stringify({
      type: "ENTITY_DELTA",
      seq_id: 10,
      table: "notes",
      action: "UPDATE",
      id: "note-1",
    });
    client.handleIncomingMessage(single);

    expect(received).toHaveLength(1);
    expect(received[0].id).toBe("note-1");
    expect(client.getLastSeqId()).toBe(10);

    // Multi-line batched frame (Gorilla WS coalesced buffer)
    const batched = [
      JSON.stringify({ type: "ENTITY_DELTA", seq_id: 11, table: "notes", action: "UPDATE", id: "note-2" }),
      JSON.stringify({ type: "ENTITY_DELTA", seq_id: 12, table: "tasks", action: "INSERT", id: "task-1" }),
      "malformed-garbage-that-should-not-throw",
      "",
    ].join("\n");

    client.handleIncomingMessage(batched);

    expect(received).toHaveLength(3);
    expect(received[1].id).toBe("note-2");
    expect(received[2].id).toBe("task-1");
    expect(client.getLastSeqId()).toBe(12);
  });

  it("isolates sequence IDs by authenticated userId and clears on sign-out", () => {
    const client = new WebSocketClient();

    // User A
    client.setUserId("user-A");
    expect(client.getLastSeqId()).toBe(0);
    client.saveSeqId(42);
    expect(client.getLastSeqId()).toBe(42);
    expect(storage.get("workbuddy_last_seq_id:user-A")).toBe("42");

    // Switch to User B
    client.setUserId("user-B");
    expect(client.getLastSeqId()).toBe(0);
    client.saveSeqId(100);
    expect(client.getLastSeqId()).toBe(100);
    expect(storage.get("workbuddy_last_seq_id:user-B")).toBe("100");

    // Switch back to User A
    client.setUserId("user-A");
    expect(client.getLastSeqId()).toBe(42);

    // Clear User A sequence
    client.clearSeqId();
    expect(client.getLastSeqId()).toBe(0);
    expect(storage.get("workbuddy_last_seq_id:user-A")).toBeUndefined();
    // User B should remain untouched
    expect(storage.get("workbuddy_last_seq_id:user-B")).toBe("100");
  });

  it("loops pagination during syncMissedDeltas when res.has_more is true", async () => {
    const client = new WebSocketClient();
    client.setUserId("user-pagination");

    const emitted: DeltaEvent[] = [];
    client.subscribe((e) => emitted.push(e));

    let callCount = 0;
    const getSpy = vi.spyOn(apiClient, "get").mockImplementation((async (endpoint: string) => {
      callCount++;
      if (endpoint.includes("since_seq=0")) {
        return {
          latest_seq: 30,
          since_seq: 0,
          has_more: true,
          changes: [
            { seq_id: 10, entity_type: "notes", entity_id: "n-1", action: "UPDATE", payload: {}, created_at: "" },
            { seq_id: 20, entity_type: "notes", entity_id: "n-2", action: "UPDATE", payload: {}, created_at: "" },
          ],
        };
      } else if (endpoint.includes("since_seq=20")) {
        return {
          latest_seq: 30,
          since_seq: 20,
          has_more: false,
          changes: [
            { seq_id: 30, entity_type: "tasks", entity_id: "t-1", action: "INSERT", payload: {}, created_at: "" },
          ],
        };
      }
      return { latest_seq: 30, since_seq: 30, has_more: false, changes: [] };
    }) as any);

    try {
      (client as any).token = "test-token";
      await client.syncMissedDeltas();

      expect(callCount).toBe(2);
      expect(emitted).toHaveLength(3);
      expect(client.getLastSeqId()).toBe(30);
    } finally {
      getSpy.mockRestore();
    }
  });
});
