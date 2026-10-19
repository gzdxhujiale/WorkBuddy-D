# Proposal: Tiptap Auto-Snapshots, Ubiquitous History & Daily Review Versioning

## Context & Problem
In the previous milestone, WorkBuddy-D established the Yjs collaborative relay, binary snapshot capture, and AST visual diffing. However, several interaction gaps remain:
1. **Manual Friction**: Snapshot creation currently requires explicit user action. In practice, users seldom pause their typing to manually take a snapshot, risking data loss during unintentional overwrites.
2. **Confined Access**: The version history drawer is currently accessible only from the full-screen knowledge workspace (`FullNoteEditor.tsx`). Neither the detached native window (`NoteStandaloneEditor.tsx`) nor the side drawer (`NoteDrawerContent`) expose history actions.
3. **Daily Review Vulnerability**: The Daily Review editor (`DailyReviewPanel.tsx`) contains critical personal reflections and summaries, but lacks any version snapshotting or diffing capability.
4. **Lack of Editor Commands**: There are no Tiptap commands or keyboard shortcuts (`Mod-Shift-S`) to quickly name milestone snapshots from within the editor canvas.

## Proposed Solution
1. **Inactivity Debounce Auto-Snapshot Engine**: Automatically capture a snapshot when user editing is followed by a 5-minute period of inactivity (or upon window/note close), preventing duplicate entries if content hasn't changed.
2. **Tiptap Snapshot Extension & Keyboard Shortcut**: Register `saveSnapshot` and `openSnapshotHistory` editor commands with a `Mod-Shift-S` (`Ctrl+Shift+S` / `Cmd+Shift+S`) shortcut for rapid milestone tagging.
3. **Ubiquitous Presentation in Knowledge Base**: Add version history buttons to `NoteStandaloneEditor.tsx` (native window header) and `KnowledgePanel.tsx` (side drawer header/menu), rendering `NoteVersionHistoryDrawer`.
4. **Daily Review Snapshots & Diffing**: Add `daily_review_snapshots` table in PostgreSQL with Go backend endpoints, integrate debounced auto-snapshots in `DailyReviewPanel.tsx`, and provide visual history comparison and rollback.

## Scope & Non-Goals
- **In Scope**:
  - Inactivity auto-snapshot in `useNoteCollab` and `useReviewAutoSave`.
  - Tiptap `SnapshotExtension` with commands and `Mod-Shift-S`.
  - Version history buttons in standalone window and side drawer.
  - Database migration and Go API for `daily_review_snapshots`.
  - Visual history drawer in `DailyReviewPanel.tsx`.
- **Non-Goals**:
  - No pre-AI generation automatic snapshots (per user decision).
  - No external Node.js daemon or proprietary Tiptap Cloud dependency.
