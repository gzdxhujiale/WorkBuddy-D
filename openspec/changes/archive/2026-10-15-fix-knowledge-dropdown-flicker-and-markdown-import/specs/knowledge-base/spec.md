# Spec Delta

## ADDED Requirements

### Requirement: Fidelity Markdown Document Import
The system SHALL parse imported Markdown documents into structured rich-text document AST nodes (including headings level 1 to 6, bullet lists, ordered lists, task lists, code blocks, blockquotes, and inline formatting). The system SHALL automatically extract the note title from the selected file name or the document's first top-level heading.

#### Scenario: Single Markdown file imported into active note
- **WHEN** user selects a valid Markdown file via the note import action
- **THEN** system populates the rich-text editor with corresponding structured nodes preserving headings, lists, code blocks, and marks
- **AND** system updates the note title matching the imported document identity

#### Scenario: File dialog cancelled during single import
- **WHEN** user cancels or closes the file selection dialog without choosing a file
- **THEN** system terminates the import interaction safely without mutating editor content, title, or displaying error notices

### Requirement: Batch Markdown Document Import with Cache Protection
The system SHALL support selecting multiple Markdown files simultaneously and importing them as distinct notes within the active folder. The system SHALL retain pending imported notes in local state while asynchronous persistence proceeds, preventing incoming synchronization deltas from purging uncommitted local drafts.

#### Scenario: Batch importing multiple Markdown files
- **WHEN** user selects multiple Markdown files and confirms batch import
- **THEN** system creates individual note entries for each file in the active folder with parsed content and titles
- **AND** system displays the total count of successfully imported notes upon completion

#### Scenario: Background synchronization delta during batch import
- **WHEN** remote synchronization events arrive while a batch import is persisting
- **THEN** system preserves all in-flight batch imported notes in the navigation list until persistence concludes

#### Scenario: File dialog cancelled during batch import
- **WHEN** user opens the batch import dialog and cancels selection
- **THEN** system safely aborts the operation without creating blank notes or displaying success toasts for zero items

### Requirement: Popover and Action Dropdown Menu Stability
The system SHALL render contextual action dropdown menus in an isolated portal layer with calculated viewport alignment. The menu trigger and popover container SHALL maintain invariant layout dimensions during pointer hover and active focus across all visual themes.

#### Scenario: Hovering and clicking action dropdown trigger
- **WHEN** user hovers over or clicks the note more action trigger in retro-pixel or default theme
- **THEN** trigger button preserves its layout box dimensions without border flutter or cursor thrashing
- **AND** action menu opens smoothly anchored to the trigger position without being clipped by scrollable parent containers

#### Scenario: Clicking outside or on trigger to toggle
- **WHEN** user clicks outside an active dropdown menu or clicks the trigger button while open
- **THEN** system closes the dropdown menu cleanly without flickering or reopening
