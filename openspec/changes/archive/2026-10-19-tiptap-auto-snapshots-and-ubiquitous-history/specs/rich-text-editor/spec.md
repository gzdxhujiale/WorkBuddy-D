# Spec Delta

## ADDED Requirements

### Requirement: Editor Snapshot Commands and Milestone Keyboard Shortcuts
The rich-text editor SHALL provide programmable commands for saving named snapshots and opening history, and SHALL bind a global editor shortcut (`Mod-Shift-S`) to prompt for milestone naming and trigger instant snapshot persistence.

#### Scenario: Triggering milestone snapshot via keyboard shortcut
- **WHEN** a user presses `Mod-Shift-S` (`Ctrl+Shift+S` or `Cmd+Shift+S`) inside an active editor
- **THEN** the editor triggers a snapshot save dialog or prompt, allowing the user to provide a custom milestone name and persist the snapshot

#### Scenario: Invoking snapshot commands programmatically
- **WHEN** host containers execute `editor.commands.saveSnapshot(name)` or `editor.commands.openVersionHistory()`
- **THEN** the editor delegates to the registered snapshot handler without throwing errors
