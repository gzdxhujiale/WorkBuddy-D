# Spec Delta: client-preferences-sync

## MODIFIED Requirements

### Requirement: Monotonic Sequence Assignment and Delta Streaming
The synchronization service SHALL assign a globally monotonic sequence identifier (seq_id) to every entity mutation and stream granular delta messages containing the sequence identifier to connected client windows. When streaming messages to clients, the service SHALL transmit discrete valid JSON payloads or newline-delimited JSON frames that clients unpack and process individually without frame truncation or parsing errors.

#### Scenario: Entity mutation streams ordered delta event
- **WHEN** an entity mutation occurs on the server
- **THEN** the system assigns an incremented sequence identifier and broadcasts the typed delta payload to all active client sessions of that user

#### Scenario: Client receives batched newline-separated delta events
- **WHEN** the server delivers multiple queued delta payloads in a single stream transmission separated by newlines
- **THEN** the client splits the payload by newline, parses each JSON event independently, and executes cache invalidation for each valid delta

### Requirement: Reconnection Catch-up Reconciliation
The system SHALL support catch-up synchronization upon client reconnection, allowing clients to retrieve missed change log records starting from their last confirmed sequence identifier. The client sequence identifier SHALL be isolated to the active authenticated user identity. When unread change log records exceed a single page limit, the system SHALL paginate through all subsequent pages until all missed change log records are reconciled.

#### Scenario: Client catches up after network reconnection
- **WHEN** a client sends a sync request specifying its last received sequence identifier
- **THEN** the server returns all subsequent change log items for that user ordered by sequence identifier

#### Scenario: Reconnection catch-up handles multi-page backlog
- **WHEN** missed change logs exceed a single query page capacity
- **THEN** the client continues requesting subsequent pages using the highest sequence identifier from each batch until no more change logs remain, updating the local sequence identifier progressively

### Requirement: Safe Sign Out Lifecycle
The system SHALL clear local session storage, reset active real-time connections, reset user-scoped sequence identifiers, and dismiss modal surfaces upon user sign out.

#### Scenario: User signs out
- **WHEN** user confirms sign out
- **THEN** the system clears persisted authentication tokens, clears user-specific delta sequence markers, terminates active synchronization channels, and returns to the unauthenticated view
