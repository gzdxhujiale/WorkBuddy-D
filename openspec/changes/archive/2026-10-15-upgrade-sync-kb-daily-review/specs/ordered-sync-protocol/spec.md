# Spec Delta

## Purpose

Provides ordered sequence-based change logging and synchronization for multi-window desktop clients, enabling robust delta event streaming and seamless reconnection reconciliation.

## ADDED Requirements

### Requirement: Ordered sequence assignment for entity modifications
The synchronization system SHALL assign a globally monotonic sequence identifier (`seq_id`) to every create, update, and soft-delete mutation across user entities, persisting the change payload in an audit log.

#### Scenario: Mutation assigns sequence identifier
- **WHEN** an authenticated user creates or updates an entity (such as a note, task, or review)
- **THEN** the system generates a monotonic `seq_id` and records the entity type, ID, action, and payload in the change log

### Requirement: Sequence delivery over WebSocket delta messages
The WebSocket synchronization hub SHALL attach the assigned `seq_id` to every outgoing `ENTITY_DELTA` payload dispatched to connected desktop Webviews.

#### Scenario: Webview receives ordered delta event
- **WHEN** an entity mutation occurs while desktop Webviews are connected
- **THEN** each connected client receives an `ENTITY_DELTA` message containing the entity payload and its corresponding `seq_id`

### Requirement: Catch-up synchronization on reconnection
The system SHALL provide a synchronization endpoint allowing disconnected or waking clients to fetch missed deltas starting from their last recorded sequence identifier.

#### Scenario: Client catches up after network reconnection
- **WHEN** a client sends a sync request with `since_seq`
- **THEN** the server returns all change log items for that user strictly greater than `since_seq` ordered by sequence ID
