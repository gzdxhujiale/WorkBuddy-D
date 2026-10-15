# knowledge-base Specification

## Purpose
Provides a hierarchical personal knowledge base capability covering knowledge bases, folders, note groups, rich-text note documents, full-text search indexing, debounced write-behind auto-save buffering, lossless partial updating, deep duplication, and cascade lifecycle management.

## Requirements

### Requirement: Lossless Partial Update and Optimistic Concurrency Control
The system SHALL apply partial updates exclusively to specified fields, preserving omitted note attributes with their existing persistent values. The system enforces matching lock versions during note updates, responding with version conflict status when outdated tokens are received. Write-behind auto-save buffers SHALL retain their unpersisted dirty status upon any database update failure, continuing to retry persistence in subsequent cycles without dropping in-memory changes.

#### Scenario: Renaming note in sidebar preserves unhydrated content
- **WHEN** user updates a note's title or location from navigation before its body is loaded into the editor
- **THEN** the system updates only the designated title or placement fields, preserving the existing persistent body content

#### Scenario: Concurrent note edit detects version conflict
- **WHEN** client submits a note update carrying a lock version that does not match the server's current version
- **THEN** the system responds with version conflict status, prompting the client to refresh and preventing silent data overwrites

#### Scenario: Write-behind buffer retry on persistence failure
- **WHEN** a scheduled write-behind buffer flush encounters a database failure or connection error
- **THEN** the buffer manager retains the note in dirty state and retries persistence during the next flush cycle

### Requirement: Deep Folder Duplication
The system SHALL atomically duplicate folders including child note groups and note records within a database transaction, preserving group hierarchies and content bindings. If any operation within the duplication process fails, all changes SHALL roll back entirely.

#### Scenario: Duplicating folder clones all child groups and notes
- **WHEN** user duplicates a folder containing multiple groups and notes
- **THEN** the system creates a new folder containing complete copies of all child groups and notes with their internal hierarchy intact

#### Scenario: Duplication failure triggers full rollback
- **WHEN** folder duplication encounters an error while cloning child notes
- **THEN** the system aborts the database transaction, removing any partially cloned records and leaving existing folders intact

### Requirement: On-Demand Hydration for Note Operations
The system SHALL asynchronously hydrate full document bodies on demand when cloning, templating, or exporting notes, ensuring complete content integrity across all output documents.

#### Scenario: Duplicating unhydrated note from list creates non-empty clone
- **WHEN** user duplicates a note directly from a list view without opening its editor
- **THEN** the system loads the note's full persistent body and creates an identical new note copy with complete content

#### Scenario: Batch exporting notes preserves full contents
- **WHEN** user initiates batch export on notes not previously opened in the active session
- **THEN** the system retrieves complete body contents for each selected note and generates non-empty formatted export files

### Requirement: Cascade Soft Deletion and Entity Retention
The system SHALL cascade soft-deletion to preserve subordinate entities: deleting a knowledge base transitions child folders to standalone status, and deleting a group transitions child notes to ungrouped status, maintaining continuous visibility in navigation.

#### Scenario: Deleting knowledge base converts folders to standalone
- **WHEN** user deletes a knowledge base
- **THEN** child folders have their parent knowledge base association cleared and remain visible as standalone root folders

#### Scenario: Deleting folder group converts notes to ungrouped
- **WHEN** user deletes a note group
- **THEN** member notes have their group association cleared and remain accessible within the folder's ungrouped section

### Requirement: Structured Template Storage and Canonical Identifiers
The system SHALL store and exchange templates in structured text formats using canonical UUID identifiers, ensuring complete content readability during template creation and application.

#### Scenario: Creating and applying note template
- **WHEN** user saves a note as a template and creates a new note from that template
- **THEN** the template is persisted with canonical UUID identifiers and instantiated with preserved structure and layout

### Requirement: Interruption-Free Active Editor Lifecycle
The system SHALL preserve active in-progress editing drafts and input focus during background synchronization events, reconciling remote updates without resetting active client state.

#### Scenario: Background sync reconciles around active draft typing
- **WHEN** background synchronization occurs while user is actively typing in the note editor
- **THEN** the system preserves the uncommitted draft, typing focus, and cursor position without resetting to remote snapshots

### Requirement: Full-text search across notes
The system SHALL provide search matching query terms against note titles and contents, returning ranked matching notes with relevant metadata.

#### Scenario: User searches notes by keyword
- **WHEN** user submits a text search query
- **THEN** the system returns active notes matching the query terms in title or content, ordered by relevance

### Requirement: In-memory write-behind auto-save buffering
The backend service SHALL buffer high-frequency note auto-save patches in memory, acknowledging receipt immediately and asynchronously flushing dirty notes to persistent storage within debounced intervals.

#### Scenario: Rapid typing triggers debounced persistence
- **WHEN** client submits rapid auto-save patches for an active note
- **THEN** the system acknowledges receipt immediately and flushes the accumulated note changes to persistent storage after the debounce interval

### Requirement: Flush in-memory buffers on graceful shutdown
The backend service SHALL commit all pending dirty note buffers to persistent storage before completing shutdown signals.

#### Scenario: Service receives termination signal
- **WHEN** the server process receives a termination signal
- **THEN** all unwritten note modifications in the buffer are committed to persistent storage before exit

### Requirement: Collapsible Details Content Blocks in Note Documents
The system SHALL support collapsible details content blocks within rich-text note documents, allowing users to nest summary titles and collapsible body blocks, toggle visual disclosure, and persist disclosure state through auto-save buffers.

#### Scenario: User inserts and toggles collapsible block in note
- **WHEN** user inserts a collapsible block into the active note editor and enters a summary title and body content
- **THEN** the editor renders a structured collapsible container with disclosure toggle controls and editable summary and content regions

#### Scenario: Collapsible block content persists across note reload
- **WHEN** user saves a note containing collapsible blocks and re-opens the note
- **THEN** the system re-renders the collapsible structure with summary headings, body elements, and disclosure states preserved without content truncation

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

