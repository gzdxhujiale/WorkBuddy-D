# knowledge-base Specification

## Purpose
Provides a hierarchical personal knowledge base capability covering knowledge bases, folders, note groups, rich-text note documents, full-text search indexing, debounced write-behind auto-save buffering, lossless partial updating, deep duplication, and cascade lifecycle management.

## Requirements

### Requirement: Lossless Partial Update and Optimistic Concurrency Control
The system SHALL apply partial updates exclusively to specified fields, preserving omitted note attributes with their existing persistent values. The system enforces matching lock versions during note updates, responding with version conflict status when outdated tokens are received.

#### Scenario: Renaming note in sidebar preserves unhydrated content
- **WHEN** user updates a note's title or location from navigation before its body is loaded into the editor
- **THEN** the system updates only the designated title or placement fields, preserving the existing persistent body content

#### Scenario: Concurrent note edit detects version conflict
- **WHEN** client submits a note update carrying a lock version that does not match the server's current version
- **THEN** the system responds with version conflict status, prompting the client to refresh and preventing silent data overwrites

### Requirement: Deep Folder Duplication
The system SHALL atomically duplicate folders including child note groups and note records within a database transaction, preserving group hierarchies and content bindings.

#### Scenario: Duplicating folder clones all child groups and notes
- **WHEN** user duplicates a folder containing multiple groups and notes
- **THEN** the system creates a new folder containing complete copies of all child groups and notes with their internal hierarchy intact

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
