# Spec Delta: task-management

## ADDED Requirements

### Requirement: Authoritative Task Synchronization and Transparent Error States
The system SHALL propagate task retrieval and mutation errors directly to presentation layers, preventing silent empty collections when network or server failures occur. The system SHALL enforce matching lock versions on task updates, returning version conflict indicators when concurrent modifications collide.

#### Scenario: Network failure during task loading presents error feedback
- **WHEN** client attempts to load user tasks while the server is unreachable or responds with an error
- **THEN** the system surfaces the failure state and retry controls rather than rendering an empty task list

#### Scenario: Concurrent task update detects version collision
- **WHEN** client submits a task update carrying a stale lock version
- **THEN** the system rejects the update with version conflict status and prompts the client to reconcile with latest data
