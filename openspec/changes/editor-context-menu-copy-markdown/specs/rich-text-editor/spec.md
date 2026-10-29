# Spec Delta: rich-text-editor

## ADDED Requirements

### Requirement: Selection Context Menu for Plain Text and Markdown Copying
The rich-text editor SHALL display a cascading context menu upon right-clicking an active selection, offering primary copy actions that export selected content to the system clipboard formatted as either unformatted plain text or structured Markdown.

#### Scenario: Opening context menu on right-clicking active selection
- **WHEN** a user selects a range of text or block elements in the editor and triggers a right-click pointer event over the editor area
- **THEN** the editor displays a context menu anchored at the cursor position containing a primary "复制" action with cascading options for "纯文本" and "Markdown"

#### Scenario: Copying selection as plain text
- **WHEN** a user activates the "纯文本" option in the selection context menu
- **THEN** the editor writes the raw text content of the active selection to the clipboard, displays a confirmation toast notification, and closes the context menu

#### Scenario: Copying selection as structured Markdown
- **WHEN** a user activates the "Markdown" option in the selection context menu
- **THEN** the editor serializes the active selection into syntactically valid Markdown matching its inline marks and block structure, writes the serialized Markdown string to the clipboard, displays a confirmation toast notification, and closes the context menu

#### Scenario: Dismissing bubble menu during context menu interaction
- **WHEN** the selection context menu opens while the floating selection bubble menu is visible
- **THEN** the editor conceals the floating selection bubble menu to prevent overlapping interface elements

#### Scenario: Right-clicking without active selection
- **WHEN** a user triggers a right-click pointer event inside the editor when no characters or blocks are selected
- **THEN** the editor preserves cursor positioning and suppresses the selection-specific copy submenu options
