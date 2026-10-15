# Spec Delta: knowledge-base

## MODIFIED Requirements

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
