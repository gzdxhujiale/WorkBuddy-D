import { useState, useRef, useEffect, useCallback } from "react";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";

export function useWindowDrag() {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragDirection, setDragDirection] = useState<"left" | "right">("right");
  const lastDragEndedAt = useRef<number>(0);

  const dragSessionRef = useRef<{
    isDown: boolean;
    hasMoved: boolean;
    startScreenX: number;
    startScreenY: number;
    startWindowX: number;
    startWindowY: number;
    scaleFactor: number;
    lastScreenX: number;
    rafId: number | null;
    pendingX: number | null;
    pendingY: number | null;
  }>({
    isDown: false,
    hasMoved: false,
    startScreenX: 0,
    startScreenY: 0,
    startWindowX: 0,
    startWindowY: 0,
    scaleFactor: 1,
    lastScreenX: 0,
    rafId: null,
    pendingX: null,
    pendingY: null,
  });

  const handleDragPointerDown = useCallback(async (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("[role='menu']") ||
      target.closest("[data-no-drag='true']")
    ) {
      return;
    }

    try {
      const win = getCurrentWindow();
      const [pos, scale] = await Promise.all([
        win.outerPosition(),
        win.scaleFactor().catch(() => 1),
      ]);

      dragSessionRef.current = {
        isDown: true,
        hasMoved: false,
        startScreenX: e.screenX,
        startScreenY: e.screenY,
        startWindowX: pos.x,
        startWindowY: pos.y,
        scaleFactor: scale || 1,
        lastScreenX: e.screenX,
        rafId: null,
        pendingX: null,
        pendingY: null,
      };

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Fallback
    }
  }, []);

  const handleDragPointerMove = useCallback((e: React.PointerEvent) => {
    const s = dragSessionRef.current;
    if (!s.isDown) return;

    const totalDx = e.screenX - s.startScreenX;
    const totalDy = e.screenY - s.startScreenY;
    const instantaneousDx = e.screenX - s.lastScreenX;

    if (!s.hasMoved && Math.hypot(totalDx, totalDy) < 6) {
      s.lastScreenX = e.screenX;
      return;
    }

    s.hasMoved = true;
    setIsDragging(true);
    if (Math.abs(instantaneousDx) > 0.5) {
      setDragDirection(instantaneousDx > 0 ? "right" : "left");
    }
    s.lastScreenX = e.screenX;

    s.pendingX = Math.round(s.startWindowX + totalDx * s.scaleFactor);
    s.pendingY = Math.round(s.startWindowY + totalDy * s.scaleFactor);

    if (s.rafId === null) {
      s.rafId = requestAnimationFrame(() => {
        s.rafId = null;
        if (!s.isDown || s.pendingX === null || s.pendingY === null) return;
        void getCurrentWindow()
          .setPosition(new PhysicalPosition(s.pendingX, s.pendingY))
          .catch(() => {});
      });
    }
  }, []);

  const handleDragPointerUp = useCallback((e?: React.PointerEvent) => {
    const s = dragSessionRef.current;
    if (s.isDown) {
      if (s.hasMoved) lastDragEndedAt.current = Date.now();
      s.isDown = false;
      if (s.rafId !== null) {
        cancelAnimationFrame(s.rafId);
        s.rafId = null;
      }
      if (s.pendingX !== null && s.pendingY !== null) {
        void getCurrentWindow()
          .setPosition(new PhysicalPosition(s.pendingX, s.pendingY))
          .catch(() => {});
        s.pendingX = null;
        s.pendingY = null;
      }
      setIsDragging(false);
      if (e) {
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
      }
    }
  }, []);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (dragSessionRef.current.isDown) handleDragPointerUp();
    };
    const handleBlur = () => {
      if (dragSessionRef.current.isDown) handleDragPointerUp();
    };
    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("blur", handleBlur);
      if (dragSessionRef.current.rafId !== null) cancelAnimationFrame(dragSessionRef.current.rafId);
    };
  }, [handleDragPointerUp]);

  const hasMovedRecently = useCallback(() => {
    return dragSessionRef.current.hasMoved || Date.now() - lastDragEndedAt.current < 350;
  }, []);

  return {
    isDragging,
    dragDirection,
    handleDragPointerDown,
    handleDragPointerMove,
    handleDragPointerUp,
    hasMovedRecently,
  };
}
