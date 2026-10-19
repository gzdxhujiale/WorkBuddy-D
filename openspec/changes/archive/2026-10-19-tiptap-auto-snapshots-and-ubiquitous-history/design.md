# Design: Auto-Snapshots, Ubiquitous History & Daily Review Versioning

## Context & Architecture
Following the initial Yjs relay and snapshot implementation, this design addresses automated background version capture, ubiquitous history access across all editing contexts, Tiptap command/shortcut integration, and Daily Review snapshot persistence.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Tauri Frontend Editing Views                    │
│                                                                        │
│   ┌─────────────────────┐  ┌─────────────────────┐  ┌────────────────┐ │
│   │ FullNoteEditor      │  │ NoteStandaloneEditor│  │NoteDrawer      │ │
│   │ (Main Workspace)    │  │ (Detached Window)   │  │(Side Panel)    │ │
│   └──────────┬──────────┘  └──────────┬──────────┘  └────────┬───────┘ │
│              │                        │                      │         │
│              └────────────────────────┼──────────────────────┘         │
│                                       ▼                                │
│                     ┌───────────────────────────────────┐              │
│                     │ useNoteCollab Hook                │              │
│                     │ - Inactivity Timer (300s debounce)│              │
│                     │ - Lifecycle flush on window close │              │
│                     │ - SnapshotExtension (Mod-Shift-S) │              │
│                     └─────────────────┬─────────────────┘              │
│                                       ▼                                │
│                     ┌───────────────────────────────────┐              │
│                     │ NoteVersionHistoryDrawer          │              │
│                     │ - Visual AST Diff (snapshotDiff)  │              │
│                     └─────────────────┬─────────────────┘              │
│                                       │                                │
│   ┌───────────────────────────────────┼──────────────────────────────┐ │
│   │ DailyReviewPanel                  ▼                              │ │
│   │ - useReviewAutoSave Debounce ──▶ DailyReviewHistoryDrawer        │ │
│   └───────────────────────────────────┬──────────────────────────────┘ │
└───────────────────────────────────────┼────────────────────────────────┘
                                        │ HTTP REST & WebSocket
                                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Go 1.26 Backend (server/)                      │
│                                                                        │
│   ├── /api/v1/notes/:id/snapshots     (Existing: note_snapshots)       │
│   └── /api/v1/reviews/:date/snapshots (New: daily_review_snapshots)    │
│                                                                        │
│   Database (Neon PostgreSQL):                                          │
│   - note_snapshots (note_id, snapshot_data BYTEA, summary TEXT)        │
│   - daily_review_snapshots (user_id, review_date DATE, content JSONB)  │
└────────────────────────────────────────────────────────────────────────┘
```

## Decisions

### 1. Inactivity Debouncing & Duplicate Prevention
- **Inactivity Timer**: A 5-minute (300,000ms) timer is started upon any local editing event. Subsequent typing resets the timer. When 5 minutes elapse without edits, the system captures a snapshot.
- **Content Change Guard**: Before creating an automatic snapshot, the system compares the current state vector or raw text against the most recent snapshot. If no substantive change occurred, snapshot generation is suppressed to prevent clutter.
- **Session Boundary Flush**: In `NoteStandaloneEditor`, Tauri `onCloseRequested` and browser `beforeunload` events trigger an immediate snapshot flush if the document is dirty.

### 2. Tiptap Snapshot Extension & Keyboard Shortcut
- A dedicated Tiptap extension `SnapshotExtension` is created in `src/components/editor/extensions/snapshot/`:
  - Registers commands `saveSnapshot(name?: string)` and `openVersionHistory()`.
  - Binds the `Mod-Shift-S` shortcut (`Ctrl+Shift+S` on Windows, `Cmd+Shift+S` on macOS) to trigger a modal/prompt for naming a milestone snapshot.
  - Can be registered across both `full` and `compact` presets.

### 3. Ubiquitous Access in Knowledge Base
- **NoteStandaloneEditor**: Add a `<History size={15} />` action button in the native title bar header. Clicking it opens the `NoteVersionHistoryDrawer` within the detached window viewport.
- **NoteDrawerContent**: Add a `<History size={16} />` button in the drawer header and a "版本历史" item in the more dropdown menu, allowing users to inspect history without switching to full-screen view.

### 4. Daily Review Versioning & Persistence
- **Storage**: Add Goose migration `000009_add_daily_review_snapshots.sql` creating `daily_review_snapshots` table with `user_id`, `review_date`, `content` (JSONB), and `summary`.
- **Go Endpoints**:
  - `GET /api/v1/reviews/:date/snapshots`
  - `POST /api/v1/reviews/:date/snapshots`
- **Diffing**: Reuses the tested `computeRawTextDiff` engine from `snapshotDiff.ts` to compute word-level and block-level additions and deletions.
- **UI**: A `DailyReviewHistoryDrawer` provides review date snapshot browsing, visual diff inspection, and one-click rollback.
