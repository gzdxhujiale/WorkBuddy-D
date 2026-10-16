# Spec Delta: knowledge-base

## MODIFIED Requirements

### Requirement: Fidelity Markdown Document Import
The system SHALL parse imported Markdown documents into structured rich-text document AST nodes (including headings level 1 to 6, bullet lists, ordered lists, task lists, code blocks, blockquotes, and inline formatting). The system SHALL automatically extract the note title strictly from the selected file name (with file extension removed) and retain all original document content and headings in the note body.

#### Scenario: Single Markdown file imported into active note
- **WHEN** user selects a valid Markdown file via the note import action
- **THEN** system populates the rich-text editor with corresponding structured nodes preserving headings, lists, code blocks, and marks
- **AND** system sets the note title to the clean file name without file extension

#### Scenario: File dialog cancelled during single import
- **WHEN** user cancels or closes the file selection dialog without choosing a file
- **THEN** system terminates the import interaction safely without mutating editor content, title, or displaying error notices

## ADDED Requirements

### Requirement: Drag-and-Drop Markdown File Import
The system SHALL support dragging one or more Markdown or text files from the host operating system directly into the active knowledge base workspace, providing visual drop zone indications and importing each dropped file as a distinct note with its title derived from the file name.

#### Scenario: User drops multiple Markdown files into workspace
- **WHEN** user drags multiple Markdown files from the desktop file explorer and releases them over the active knowledge base area
- **THEN** system displays an active drop zone indicator during dragging
- **AND** system creates a corresponding note for each dropped file within the active folder using its base filename as title
- **AND** system displays a notification reporting the total count of successfully imported notes

#### Scenario: Non-file drag events ignored
- **WHEN** user drags internal non-file elements such as note reorder cards across the workspace
- **THEN** system does not activate the file drop zone overlay and preserves normal reorder handling

### Requirement: Dual-Format Note Export
The system SHALL export a single selected note directly as a `.md` Markdown file, and SHALL bundle two or more selected notes into a single compressed `.zip` archive containing individual Markdown files for each note.

#### Scenario: Exporting a single note
- **WHEN** user triggers export for exactly one note
- **THEN** system downloads a single `.md` file named with the note title and formatted markdown content

#### Scenario: Exporting two or more notes
- **WHEN** user triggers export for two or more selected notes
- **THEN** system generates a single `.zip` archive containing each note as an individual `.md` file with unique non-colliding filenames
- **AND** system triggers a single download prompt for the archive

### Requirement: Automated Editor Cursor Placement on Note Creation
The system SHALL automatically transfer input focus and cursor placement to the note editor body when a note is created from an entered title, releasing focus from the creation trigger input.

#### Scenario: Creating note by pressing enter in title input
- **WHEN** user inputs a title in the note creation input box and presses Enter
- **THEN** system creates the note, clears and blurs the creation input box
- **AND** system opens the note and places the editor cursor in the document body ready for immediate typing

#### Scenario: Creating empty note via quick action
- **WHEN** user triggers creation of a new untitled note
- **THEN** system opens the note and focuses the note title input field

### Requirement: Multi-Mode Note Presentation
The system SHALL support viewing and editing notes across slide-over drawer mode, full main content mode, and detached standalone native window mode, maintaining bidirectional content synchronization and allowing seamless transitions between modes.

#### Scenario: Switching from drawer to full main content mode
- **WHEN** user clicks the full-width presentation action from an active note drawer
- **THEN** system closes the drawer overlay and renders the note editor across the primary content container with navigation breadcrumbs and back-to-list controls

#### Scenario: Opening note in detached standalone window
- **WHEN** user triggers opening a note in a standalone window
- **THEN** system opens a dedicated native desktop window displaying the note editor
- **AND** system closes any open drawer or main content editor for that note in the primary window
- **AND** modifications made in the detached window synchronize back to persistent storage and update open views via WebSocket deltas
