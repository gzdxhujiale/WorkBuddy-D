# Product sense

## Purpose

This document guides product judgment when a request leaves room for interpretation. It does not replace exact behavior in [product specifications](product-specs/index.md).

## Product purpose

WorkBuddy-D is an authenticated personal desktop workspace for turning intentions into daily action. The shipped modules combine four-quadrant tasks, schedules and reminders, habits, knowledge capture, daily review, and focus sessions.

The repository supports an individual workspace, not collaboration or enterprise workflow assumptions. User data is private to the authenticated owner through Supabase RLS.

## Core user jobs

- See and act on today’s tasks, habits, and review work.
- Capture and organize task and knowledge content without losing in-progress edits.
- Plan tasks by urgency/importance and schedule them when useful.
- Build a dated habit history and complete one daily review per date.
- Run and record focus sessions, including through the focus-assistant window.

## Product principles

### Preserve user work over implementation convenience

Optimistic edits, debounced saves, offline replay, conflict visibility, and database versions exist to preserve intent. Do not silently discard, overwrite, or duplicate work to simplify a change.

### Keep the active surface focused

The app exposes a compact desktop tool rail and distinct routes for daily work, tasks, habits, knowledge, and review. Load and present the content needed for the active surface; avoid expanding every screen into a dashboard of unrelated data.

### Make state and consequences understandable

Actions that change completion, schedules, selection, saving, or account state should give a visible, local explanation. New asynchronous flows need loading, empty, failure, and disabled behavior appropriate to their surface.

### Prefer useful defaults to configuration

Existing flows create scoped records, derive database-owned timestamps/order, and keep preferences user-scoped. Add configuration only when it changes a meaningful user outcome; do not surface infrastructure details as settings.

### Treat personal data as private and recoverable

Privacy is implemented through RLS, not client convention. Deletion and state transitions must use the existing constrained paths, and transient network failure should retain recoverable work where the domain already supports replay.

## Decision heuristics

When several choices are technically valid:

- Prefer an existing domain workflow over a new cross-cutting abstraction.
- Prefer a reversible or explicitly confirmed destructive action when intent is ambiguous.
- Prefer precise updates to the active list, note, task, or review over broad refreshes or hidden global effects.
- Prefer keeping advanced controls out of the default path until a real product requirement needs them.
- Prefer database-confirmed results over client-generated timestamps, sort order, or conflict versions.

## Feature acceptance

A user-visible feature is ready only when it fits the current navigation model, explains its state during asynchronous work, preserves relevant user input, and respects the user and data boundaries documented in [Security](SECURITY.md) and [Reliability](RELIABILITY.md).

Use [DESIGN.md](DESIGN.md) for interaction and visual choices. If a specification conflicts with this document, the more specific file in `product-specs/` wins.
