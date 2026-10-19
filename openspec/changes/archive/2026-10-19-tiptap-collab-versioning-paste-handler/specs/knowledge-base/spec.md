# Spec Delta

## ADDED Requirements

### Requirement: Multi-Window Real-Time CRDT Collaborative Editing
The knowledge base SHALL support real-time collaborative editing across concurrent editing sessions (such as main workspace and detached standalone windows) for the same note via Yjs CRDT message relay, synchronizing character-level changes and cursor presence without overwrite conflicts.

#### Scenario: Concurrent typing across detached window and main editor
- **WHEN** a user opens the same note simultaneously in the main workspace and a detached standalone window and types in either view
- **THEN** character insertions and deletions are reflected in both windows with sub-second latency without triggering optimistic locking conflicts or content resets

#### Scenario: Awareness cursor presence indicator
- **WHEN** an additional editor session connects to the same active note
- **THEN** remote cursor positions and selection bounds are displayed in contrasting client colors within the editor viewport

### Requirement: Visual Rich-Text Version Comparison via Document Snapshots
The knowledge base SHALL maintain historical document snapshots and provide a visual diff comparison interface, rendering additions and deletions with distinctive typographic highlights and strikethroughs while preserving block structures.

#### Scenario: Opening visual version diff for a historical snapshot
- **WHEN** a user selects a historical snapshot from the note version history panel
- **THEN** the system displays a side-by-side or inline rich-text diff highlighting newly added text in green and removed text in red strikethrough without corrupting table or list layouts

#### Scenario: Restoring a historical snapshot
- **WHEN** a user confirms restoration of a selected historical snapshot
- **THEN** the active document content reverts to the state captured in that snapshot and propagates the update across all active collaborative sessions
