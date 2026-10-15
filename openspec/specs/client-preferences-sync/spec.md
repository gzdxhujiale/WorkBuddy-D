# client-preferences-sync Specification

## Purpose
Provides user preferences and client-server synchronization capabilities, covering cross-window theme synchronization, desktop notification preferences, autostart environment adaptation, secure sign-out lifecycle, monotonic sequence-based delta streaming, reconnection reconciliation, and bounded connection multiplexing.

## Requirements

### Requirement: Cross-Window Visual Theme Synchronization
The system SHALL allow users to switch between supported visual theme styles and immediately synchronize the active theme selection across all open application windows.

#### Scenario: User switches theme style
- **WHEN** user selects a different application visual theme
- **THEN** the system updates the persistent preference and broadcasts the theme change, updating all open windows concurrently

### Requirement: Desktop Notification Preference Management
The system SHALL provide configurable desktop notification presentation formats, persisting user selections and synchronizing notification strategies across active surfaces.

#### Scenario: User updates notification preference
- **WHEN** user modifies active notification display options
- **THEN** the system persists the updated preferences and applies the active notification formats immediately

### Requirement: Autostart Environment Adaptation
The system SHALL manage autostart configurations in supported desktop environments, presenting the control in a disabled state with informational feedback in non-desktop environments.

#### Scenario: Accessing autostart settings in non-desktop environment
- **WHEN** user views general settings in a non-desktop browser environment
- **THEN** the system presents the autostart control as read-only with explanatory guidance

### Requirement: Safe Sign Out Lifecycle
The system SHALL clear local session storage, reset active real-time connections, reset user-scoped sequence identifiers, and dismiss modal surfaces upon user sign out.

#### Scenario: User signs out
- **WHEN** user confirms sign out
- **THEN** the system clears persisted authentication tokens, clears user-specific delta sequence markers, terminates active synchronization channels, and returns to the unauthenticated view

### Requirement: Authenticated Scoped Entity Management
The backend service SHALL expose authenticated endpoints for personal planning entities, scoping access strictly to the authenticated user identity.

#### Scenario: Authenticated entity retrieval
- **WHEN** an authenticated client requests user entity collections with valid session credentials
- **THEN** the system returns records scoped strictly to the authenticated user identity

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

### Requirement: Bounded Connection Pooling and Multiplexing
The backend service SHALL multiplex concurrent client requests across a bounded database connection pool, maintaining connection stability under high-concurrency bursts.

#### Scenario: Concurrent multi-window request burst
- **WHEN** multiple client windows dispatch concurrent requests simultaneously
- **THEN** requests are queued and multiplexed across the bounded connection pool without throwing connection limit errors
