## Context

See proposal.md for motivation and `specs/today-workbench/spec.md` for the behavior contract. TodayQuickAdd currently retains only a project identifier while the shared task editor already models the association as a project plus one of its stages. The persisted task relation has server-side validation for ownership, activity, and project/stage membership, so the UI must prepare a complete pair but cannot become the authority for that relationship.

## Goals / Non-Goals

**Goals:**

- Match TodayQuickAdd’s association behavior to the established TaskQuickEdit model.
- Make the project-to-stage dependency understandable without interrupting rapid keyboard entry.
- Preserve entered input and provide a recovery path for validation or persistence failures.

**Non-Goals:**

- Creating, editing, reordering, or restoring project stages from the quick-add surface.
- Changing the data schema, the server-side relation trigger, task scheduling semantics, or project lifecycle rules.
- Changing association behavior in task editors outside TodayQuickAdd.

## Decisions

### Use a two-level project → stage menu

The association control will show the independent-task option followed by active projects and their active stages. Selecting a stage is the commit point for project association; selecting a parent project only reveals its valid child-stage choices and leaves the form incomplete.

This avoids a second selector consuming limited horizontal space in the persistent input row while still making the hierarchy explicit. A flat stage list was rejected because it hides the parent relationship and permits ambiguity between similarly named stages.

### Keep project and stage as one atomic client-side selection

The draft stores both identifiers. Changing the parent project invalidates the previously chosen child stage; choosing independent work clears both. Submission derives no association from partial state.

This mirrors the global quick editor and prevents stale stage identifiers from crossing projects. Retaining the previous stage when the project changes was rejected because it creates an invalid intermediate state that looks selected.

### Treat project/stage data as advisory and the database as authoritative

The selector renders only the active project and stage metadata loaded through existing query hooks. On submit the existing task write path sends both identifiers; database validation remains responsible for ownership, deleted-record checks, and stage membership.

Client-only validation was rejected as the sole guard because project stages can change in another window between load and write.

### Surface feedback in the quick-add row

An attempted partial association produces an inline validation state without clearing the title. While persistence is pending, duplicate submissions are disabled. A failed write retains the draft and offers a readable retry/reselection path.

This follows the existing local-action and asynchronous-feedback rules; a global-only toast was rejected because it separates the correction from the field that needs it.

## Risks / Trade-offs

- [Nested selector is less immediately scannable than a flat list] → Show the selected result as “项目 · 阶段” and use clear parent/child grouping.
- [Concurrent project/stage deletion can invalidate loaded options] → Preserve the draft on server rejection and allow refresh/reselection; rely on database validation to prevent invalid persistence.
- [Projects without stages create an unavailable action] → State the reason in the selector and keep independent-task creation available.

## Migration Plan

No persisted-data migration is required. Existing standalone tasks and existing project tasks remain readable. Deployment changes only creation behavior: new TodayQuickAdd project tasks will supply both current relation fields. Rollback restores the prior UI; no stored data needs conversion.
