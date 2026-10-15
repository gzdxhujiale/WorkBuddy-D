# Spec Delta

## Purpose

Enables fast fuzzy and substring search across personal knowledge base notes, along with an in-memory debounced write-behind buffer that mitigates high-frequency auto-save database writes.

## ADDED Requirements

### Requirement: Full-text search across notes
The knowledge base system SHALL provide a search endpoint that matches user search terms against note titles and content using trigram indexing, returning ranked matching notes with relevant metadata.

#### Scenario: User searches notes by keyword
- **WHEN** an authenticated user issues a search query with parameter `q`
- **THEN** the system returns non-deleted notes whose title or content matches the query, sorted by relevance

### Requirement: In-memory write-behind auto-save buffering
The backend SHALL accept high-frequency note auto-save patches into an in-memory buffer, confirming receipt immediately to the client and asynchronously flushing dirty notes to persistent storage within a debounced interval.

#### Scenario: Rapid typing triggers debounced persistence
- **WHEN** the client submits rapid auto-save patches for an active note
- **THEN** the server returns a successful status immediately from memory and flushes the latest note content to Postgres after a short quiet period

### Requirement: Flush in-memory buffers on graceful shutdown
The backend service SHALL flush all pending dirty note buffers to PostgreSQL before completing server shutdown signals.

#### Scenario: Server receives termination signal
- **WHEN** the server process receives SIGINT or SIGTERM
- **THEN** all dirty notes in the in-memory buffer are committed to the database before the process exits
