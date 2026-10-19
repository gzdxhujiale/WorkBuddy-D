# Spec Delta

## ADDED Requirements

### Requirement: Automatic Inactivity-Debounced Note Snapshots
The knowledge base SHALL automatically capture and persist a document snapshot when editing activity ceases for an inactivity debounce period (default 5 minutes) or upon session lifecycle termination, avoiding duplicate entries when document content remains unchanged.

#### Scenario: Background snapshot capture after typing pause
- **WHEN** a user modifies a note in any editing context and ceases typing for 5 minutes
- **THEN** the system silently generates a Yjs document snapshot, persists it to `note_snapshots` with a timestamped summary (e.g. `自动快照 - HH:mm`), and makes it available in the version history

#### Scenario: Session lifecycle boundary flush
- **WHEN** a user closes a detached note window or navigates away while uncommitted edits exist
- **THEN** the system immediately persists a final snapshot point before session disposal

### Requirement: Multi-Context Version History Access
The knowledge base SHALL provide accessible version history entry points across all editing presentations, including the detached standalone window and the side drawer, rendering historical snapshots, visual diffs, and one-click rollback without requiring full-screen workspace mode.

#### Scenario: Opening version history in detached window
- **WHEN** a user clicks the history button in the header of a detached note window
- **THEN** the system displays the version history drawer within the window, showing historical snapshots and visual text diffs

#### Scenario: Opening version history in side drawer
- **WHEN** a user clicks the history action in the note drawer header or menu
- **THEN** the system presents the version history interface overlaying or adjacent to the drawer view
