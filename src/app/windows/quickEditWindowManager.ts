import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow, currentMonitor, PhysicalPosition } from '@tauri-apps/api/window';
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { Task, QuadrantType, TaskDraft } from '@/types/task';
import type { Project, ProjectStage } from '@/types/project';

export function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
}

const POPUP_W = 1100;
const POPUP_H = 700;
const ANCHOR_X = 640;
const ANCHOR_Y = 36;
const POOL_LABEL = 'task-quick-edit';

export interface QuickEditWindowOptions {
  task?: Task;
  quadrant?: QuadrantType;
  projects?: Project[];
  stages?: ProjectStage[];
  anchorEl: HTMLElement;
  initialDate?: string;
  onCommit?: (taskId: string, updates: Partial<Task>) => void;
  onCreate?: (quadrant: QuadrantType, draft: TaskDraft) => void;
  onClosed: () => void;
}

function fromWire(wire: Record<string, unknown>): Partial<Task> {
  return Object.fromEntries(
    Object.entries(wire).map(([k, v]) => [k, v === null ? undefined : v])
  ) as Partial<Task>;
}

let pool: WebviewWindow | null = null;
let poolReady: Promise<void> | null = null;
let readyResolve: (() => void) | null = null;
let readyReject: ((e: unknown) => void) | null = null;
let readyTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let unlistenPoolFocus: UnlistenFn | null = null;
let listenersInstalled = false;
const listenerCleanups: UnlistenFn[] = [];
const activeSessions = new Map<string, QuickEditWindowOptions>();
let currentSessionId: string | null = null;
let latestRequestedSession: string | null = null;
let lastPos: { x: number; y: number } | null = null;

let mainFocused = true;
let popupFocused = false;
let popupEverFocused = false;
let focusTimer: number | null = null;

function scheduleFocusCheck(): void {
  if (focusTimer !== null) window.clearTimeout(focusTimer);
  focusTimer = window.setTimeout(() => {
    focusTimer = null;
    if (!currentSessionId || !popupEverFocused) return;
    if (!mainFocused && !popupFocused) void emitTo(POOL_LABEL, 'tqe:close-all').catch(() => {});
  }, 150);
}

function endSession(session: string): void {
  const sessionOpts = activeSessions.get(session);
  if (sessionOpts) {
    activeSessions.delete(session);
    sessionOpts.onClosed();
  }
  if (currentSessionId === session) {
    currentSessionId = null;
  }
}

async function installListeners(): Promise<void> {
  if (listenersInstalled) return;
  listenersInstalled = true;

  const cleanups = await Promise.all([
    listen('tqe:ready', () => {
      if (readyTimeoutTimer) {
        clearTimeout(readyTimeoutTimer);
        readyTimeoutTimer = null;
      }
      readyResolve?.();
      readyResolve = null;
      readyReject = null;
    }),
    listen<{ session: string; taskId: string; updates: Record<string, unknown> }>('tqe:commit', (e) => {
      const s = e.payload?.session;
      const sessionOpts = activeSessions.get(s);
      if (sessionOpts) {
        sessionOpts.onCommit?.(e.payload.taskId, fromWire(e.payload.updates));
      }
    }),
    listen<{ session: string; draft: TaskDraft }>('tqe:create', (e) => {
      const s = e.payload?.session;
      const sessionOpts = activeSessions.get(s);
      if (sessionOpts) {
        const q = e.payload.draft.quadrant || sessionOpts.quadrant || 'Q2';
        sessionOpts.onCreate?.(q, e.payload.draft);
      }
    }),
    listen<{ session: string }>('tqe:closed', (e) => {
      endSession(e.payload?.session ?? '');
    }),
    listen<{ session: string }>('tqe:shown', (e) => {
      if (e.payload?.session !== currentSessionId || !pool || !lastPos) return;
      void pool.setPosition(new PhysicalPosition(lastPos.x, lastPos.y)).catch(() => {});
    }),
    getCurrentWindow().onFocusChanged(({ payload }) => {
      mainFocused = payload;
      if (!payload) scheduleFocusCheck();
    }),
  ]);
  listenerCleanups.push(...cleanups);
}

function disposeListeners(): void {
  for (const cleanup of listenerCleanups.splice(0)) cleanup();
  listenersInstalled = false;
}

function attachPoolHandlers(webview: WebviewWindow, isNew: boolean): void {
  void webview.onFocusChanged(({ payload }) => {
    popupFocused = payload;
    if (payload) popupEverFocused = true;
    else scheduleFocusCheck();
  }).then(fn => { unlistenPoolFocus = fn; }).catch(() => {});

  if (isNew) {
    void webview.once('tauri://error', (e) => {
      console.error('[quick-edit] Sub-window creation error:', e);
      readyReject?.(e);
      readyResolve = null;
      readyReject = null;
      if (pool === webview) discardPool();
    });
  }
  void webview.once('tauri://destroyed', () => {
    if (pool === webview) discardPool();
  });
}

function ensurePool(): Promise<void> {
  if (pool && poolReady) return poolReady;

  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  poolReady = ready;

  void (async () => {
    try {
      await installListeners();

      const existing = await WebviewWindow.getByLabel(POOL_LABEL).catch(() => null);
      if (existing) {
        pool = existing;
        void existing.hide().catch(() => {});
        attachPoolHandlers(existing, false);
        void emitTo(POOL_LABEL, 'tqe:ping').catch(() => {});
        readyResolve?.();
        readyResolve = null;
        readyReject = null;
        return;
      }

      const webview = new WebviewWindow(POOL_LABEL, {
        url: `${window.location.origin}/quick-edit.html`,
        title: '任务快捷编辑',
        x: 0,
        y: 0,
        width: POPUP_W,
        height: POPUP_H,
        resizable: false,
        decorations: false,
        transparent: true,
        shadow: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        visible: false,
        focus: false,
      });
      pool = webview;
      attachPoolHandlers(webview, true);

      if (readyTimeoutTimer) clearTimeout(readyTimeoutTimer);
      readyTimeoutTimer = setTimeout(() => {
        readyTimeoutTimer = null;
        if (readyResolve) {
          console.warn('[quick-edit] Window ready timeout reached; resolving ready promise');
          readyResolve();
          readyResolve = null;
          readyReject = null;
        }
      }, 3000);
    } catch (err) {
      if (readyTimeoutTimer) {
        clearTimeout(readyTimeoutTimer);
        readyTimeoutTimer = null;
      }
      readyReject?.(err);
      readyResolve = null;
      readyReject = null;
      discardPool();
    }
  })();

  return ready;
}

function discardPool(): void {
  if (readyTimeoutTimer) {
    clearTimeout(readyTimeoutTimer);
    readyTimeoutTimer = null;
  }
  pool = null;
  poolReady = null;
  unlistenPoolFocus?.();
  unlistenPoolFocus = null;
  for (const [_, sessionOpts] of activeSessions) {
    sessionOpts.onClosed();
  }
  activeSessions.clear();
  currentSessionId = null;
}

export function prewarmQuickEditWindow(): void {
  if (!isTauriEnv()) return;
  void ensurePool().catch(() => {});
}

export function requestQuickEditCloseLayer(): void {
  if (!isTauriEnv()) return;
  if (currentSessionId) {
    void emitTo(POOL_LABEL, 'tqe:close-layer').catch(() => {});
  }
}

export async function openQuickEditWindow(opts: QuickEditWindowOptions): Promise<void> {
  if (!isTauriEnv()) {
    console.warn('[quick-edit] Window manager requires Tauri desktop environment');
    return;
  }

  const prevSessionId = currentSessionId;
  if (prevSessionId) {
    // Flush any pending uncommitted draft of the previous session before starting new one
    void emitTo(POOL_LABEL, 'tqe:flush', { session: prevSessionId }).catch(() => {});
  }

  // A UUID keeps events from an old Vite-HMR module instance from matching a
  // new editing session after its module counter has been reset.
  const session = crypto.randomUUID();
  currentSessionId = session;
  latestRequestedSession = session;
  activeSessions.set(session, opts);

  const readyP = ensurePool();
  const main = getCurrentWindow();

  let r: DOMRect;
  if (
    opts.anchorEl &&
    typeof opts.anchorEl.getBoundingClientRect === 'function' &&
    document.body.contains(opts.anchorEl) &&
    opts.anchorEl !== document.body
  ) {
    r = opts.anchorEl.getBoundingClientRect();
  } else {
    // Safe viewport center fallback
    const vw = typeof window !== 'undefined' ? window.innerWidth : 800;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
    r = new DOMRect(vw / 2 - 120, vh / 2 - 80, 240, 48);
  }

  const [factor, inner, mon] = await Promise.all([
    main.scaleFactor().catch(() => 1),
    main.innerPosition().catch(() => ({ x: 0, y: 0 })),
    currentMonitor().catch(() => null),
  ]);

  const scale = factor || 1;
  const innerPos = inner || { x: 0, y: 0 };
  const anchorScreen = {
    x: innerPos.x / scale + r.left,
    y: innerPos.y / scale + r.top,
    w: r.width,
    h: r.height,
  };

  let winX = anchorScreen.x - ANCHOR_X;
  let winY = anchorScreen.y - ANCHOR_Y;
  if (mon) {
    const mx = mon.position.x / scale;
    const my = mon.position.y / scale;
    const mw = mon.size.width / scale;
    const mh = mon.size.height / scale;
    winX = Math.min(Math.max(winX, mx), Math.max(mx, mx + mw - POPUP_W));
    winY = Math.min(Math.max(winY, my), Math.max(my, my + mh - POPUP_H));
  }

  const localAnchor = {
    left: anchorScreen.x - winX,
    top: anchorScreen.y - winY,
    right: anchorScreen.x - winX + anchorScreen.w,
    bottom: anchorScreen.y - winY + anchorScreen.h,
    width: anchorScreen.w,
  };

  try {
    await readyP;
  } catch (err) {
    console.error('[quick-edit] ensurePool failed:', err);
  }

  if (latestRequestedSession !== session || !pool) {
    if (!pool) endSession(session);
    return;
  }

  popupEverFocused = false;
  lastPos = { x: Math.round(winX * scale), y: Math.round(winY * scale) };
  await pool.setPosition(new PhysicalPosition(lastPos.x, lastPos.y)).catch(() => {});
  try {
    await emitTo(POOL_LABEL, 'tqe:init', {
      session,
      task: opts.task ?? null,
      quadrant: opts.quadrant ?? null,
      projects: opts.projects ?? [],
      stages: opts.stages ?? [],
      anchor: localAnchor,
      initialDate: opts.initialDate,
    });
  } catch (emitErr) {
    console.error('[quick-edit] Failed to emit tqe:init:', emitErr);
  }
}

/** Discard the active draft, e.g. during logout or a parent-window teardown. */
export function discardQuickEditDraft(): void {
  if (!isTauriEnv()) return;
  const session = currentSessionId;
  currentSessionId = null;
  if (session) {
    activeSessions.delete(session);
    void emitTo(POOL_LABEL, 'tqe:discard', { session }).catch(() => {});
  }
}

// Tauri listeners live outside React. Explicitly remove them when Vite swaps
// this module so an old callback cannot persist a later editor event again.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposeListeners();
    unlistenPoolFocus?.();
    unlistenPoolFocus = null;
  });
}

